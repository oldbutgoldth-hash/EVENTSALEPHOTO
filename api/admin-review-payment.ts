import { isAdminRequest, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type OrderRow = { id: string; payment_status: string; payment_slip_path: string | null }

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'ADMIN_LOGIN_REQUIRED' })
  const body = (req.body || {}) as { orderId?: string; decision?: 'approve' | 'reject'; note?: string }
  if (!body.orderId || !['approve', 'reject'].includes(body.decision || '')) return res.status(400).json({ error: 'INVALID_REVIEW_INPUT' })

  try {
    const orders = await supabaseRest<OrderRow[]>(`event_photo_orders?id=eq.${encodeURIComponent(body.orderId)}&select=id,payment_status,payment_slip_path&limit=1`)
    const order = orders[0]
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
    if (!order.payment_slip_path) return res.status(409).json({ error: 'PAYMENT_SLIP_REQUIRED' })
    if (order.payment_status !== 'under_review') return res.status(409).json({ error: 'PAYMENT_NOT_UNDER_REVIEW' })

    const reviewed = await supabaseRest<Array<{ payment_status: string }>>('rpc/review_event_photo_payment', {
      method: 'POST',
      body: JSON.stringify({
        p_order_id: order.id,
        p_decision: body.decision,
        p_note: body.note?.trim() || null,
      }),
    })
    return res.status(200).json({ ok: true, paymentStatus: reviewed[0]?.payment_status || (body.decision === 'approve' ? 'paid' : 'rejected') })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'PAYMENT_REVIEW_FAILED' })
  }
}
