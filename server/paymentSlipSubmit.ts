import crypto from 'node:crypto'
import { queryValue, supabaseAdmin, supabaseRest, type ApiRequest, type ApiResponse } from './utils.js'
import { verifySlipWithSlipOk } from './slipVerification.js'

type OrderRow = { id: string; payment_status: string; payment_slip_path: string | null; amount_satang: number }
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxSlipBytes = 6 * 1024 * 1024
const autoRejectOutcomes = new Set(['duplicate', 'amount_mismatch', 'wrong_account'])

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
    const orders = await supabaseRest<OrderRow[]>(`event_photo_orders?public_token=eq.${encodeURIComponent(token)}&select=id,payment_status,payment_slip_path,amount_satang&limit=1`)
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

    let slipStatus: 'under_review' | 'rejected' = 'under_review'
    let autoCheckNote: string | null = null
    let transRef: string | null = null
    let fileHash: string | null = null
    const download = await supabaseAdmin().storage.from('payment-slips').download(body.path)
    if (download.data) {
      const bytes = new Uint8Array(await download.data.arrayBuffer())
      fileHash = crypto.createHash('sha256').update(bytes).digest('hex')

      // Free, zero-cost check first: has this exact slip image already been used on a
      // different order? Catches someone re-uploading the same screenshot to pay twice
      // without needing any external service.
      const duplicates = await supabaseRest<Array<{ order_number: string }>>(
        `event_photo_orders?slip_file_sha256=eq.${fileHash}&id=neq.${order.id}&select=order_number&limit=1`,
      )
      if (duplicates[0]) {
        slipStatus = 'rejected'
        autoCheckNote = `สลิปนี้เคยถูกใช้กับคำสั่งซื้อ ${duplicates[0].order_number} มาแล้ว ไม่สามารถใช้ซ้ำได้`
      } else {
        // Optional paid upgrade (SlipOK): confirms the slip's real bank amount matches
        // the order price. Skipped automatically if SLIPOK_API_KEY isn't configured —
        // falls back to the photographer's manual review exactly as before.
        const check = await verifySlipWithSlipOk(bytes, body.contentType, order.amount_satang / 100)
        autoCheckNote = check.note
        if ('transRef' in check) transRef = check.transRef || null
        if (autoRejectOutcomes.has(check.outcome)) slipStatus = 'rejected'
      }
    }

    const updated = await supabaseRest<Array<{ id: string }>>(`event_photo_orders?id=eq.${order.id}&payment_status=in.(unpaid,failed,rejected)&select=id`, {
      method: 'PATCH',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        payment_status: slipStatus,
        payment_slip_path: body.path,
        payment_slip_content_type: body.contentType,
        payment_slip_size: body.fileSize,
        payment_slip_uploaded_at: new Date().toISOString(),
        payment_reviewed_at: slipStatus === 'rejected' ? new Date().toISOString() : null,
        payment_review_note: slipStatus === 'rejected' ? autoCheckNote : null,
        slip_auto_check_note: autoCheckNote,
        slip_trans_ref: transRef,
        slip_file_sha256: fileHash,
      }),
    })
    if (!updated[0]) {
      await supabaseAdmin().storage.from('payment-slips').remove([body.path])
      return res.status(409).json({ error: 'ORDER_STATUS_CHANGED_RELOAD' })
    }
    if (order.payment_slip_path && order.payment_slip_path !== body.path) {
      await supabaseAdmin().storage.from('payment-slips').remove([order.payment_slip_path]).catch(() => undefined)
    }
    if (slipStatus === 'rejected') {
      return res.status(200).json({ ok: true, autoRejected: true, reason: autoCheckNote })
    }
    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'SLIP_SUBMIT_FAILED' })
  }
}
