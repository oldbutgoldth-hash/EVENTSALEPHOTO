import { queryValue, supabaseAdmin, supabaseRest, type ApiRequest, type ApiResponse } from './utils.js'

type OrderRow = { id: string; payment_status: string; payment_slip_path: string | null }
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxSlipBytes = 6 * 1024 * 1024

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  const body = (req.body || {}) as { token?: string; path?: string; contentType?: string; fileSize?: number }
  const token = queryValue(body.token)
  if (
    token.length < 32
    || !body.path
    || !body.contentType
    || !allowedTypes.has(body.contentType)
    || !Number.isInteger(body.fileSize)
    || (body.fileSize || 0) < 1
    || (body.fileSize || 0) > maxSlipBytes
  ) return res.status(400).json({ error: 'INVALID_SLIP_SUBMISSION' })

  try {
    const orders = await supabaseRest<OrderRow[]>(`event_photo_orders?public_token=eq.${encodeURIComponent(token)}&select=id,payment_status,payment_slip_path&limit=1`)
    const order = orders[0]
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
    if (!body.path.startsWith(`${order.id}/`) || body.path.includes('..')) return res.status(403).json({ error: 'INVALID_SLIP_PATH' })
    if (!['unpaid', 'failed', 'rejected'].includes(order.payment_status)) {
      return res.status(409).json({ error: order.payment_status === 'paid' ? 'ORDER_ALREADY_PAID' : 'SLIP_ALREADY_UNDER_REVIEW' })
    }

    const folder = body.path.slice(0, body.path.lastIndexOf('/'))
    const filename = body.path.slice(body.path.lastIndexOf('/') + 1)
    const { data, error } = await supabaseAdmin().storage.from('payment-slips').list(folder, { search: filename, limit: 1 })
    if (error || !data?.some((item) => item.name === filename)) return res.status(400).json({ error: 'SLIP_FILE_NOT_FOUND' })

    const updated = await supabaseRest<Array<{ id: string }>>(`event_photo_orders?id=eq.${order.id}&payment_status=in.(unpaid,failed,rejected)&select=id`, {
      method: 'PATCH',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        payment_status: 'under_review',
        payment_slip_path: body.path,
        payment_slip_content_type: body.contentType,
        payment_slip_size: body.fileSize,
        payment_slip_uploaded_at: new Date().toISOString(),
        payment_reviewed_at: null,
        payment_review_note: null,
      }),
    })
    if (!updated[0]) {
      await supabaseAdmin().storage.from('payment-slips').remove([body.path])
      return res.status(409).json({ error: 'ORDER_STATUS_CHANGED_RELOAD' })
    }
    if (order.payment_slip_path && order.payment_slip_path !== body.path) {
      await supabaseAdmin().storage.from('payment-slips').remove([order.payment_slip_path]).catch(() => undefined)
    }
    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'SLIP_SUBMIT_FAILED' })
  }
}
