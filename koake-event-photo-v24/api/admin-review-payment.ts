import { isAdminRequest, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type OrderRow = { id: string; payment_status: string; payment_slip_path: string | null }
type ReviewResult = { orderId: string; ok: boolean; paymentStatus?: string; error?: string }

async function reviewOne(orderId: string, decision: 'approve' | 'reject', note: string): Promise<ReviewResult> {
  try {
    const orders = await supabaseRest<OrderRow[]>(`event_photo_orders?id=eq.${encodeURIComponent(orderId)}&select=id,payment_status,payment_slip_path&limit=1`)
    const order = orders[0]
    if (!order) return { orderId, ok: false, error: 'ORDER_NOT_FOUND' }
    if (!order.payment_slip_path) return { orderId, ok: false, error: 'PAYMENT_SLIP_REQUIRED' }
    if (order.payment_status !== 'under_review') return { orderId, ok: false, error: 'PAYMENT_NOT_UNDER_REVIEW' }

    const reviewed = await supabaseRest<Array<{ payment_status: string }>>('rpc/review_event_photo_payment', {
      method: 'POST',
      body: JSON.stringify({ p_order_id: order.id, p_decision: decision, p_note: note || null }),
    })
    return { orderId, ok: true, paymentStatus: reviewed[0]?.payment_status || (decision === 'approve' ? 'paid' : 'rejected') }
  } catch (error) {
    return { orderId, ok: false, error: error instanceof Error ? error.message : 'PAYMENT_REVIEW_FAILED' }
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'ADMIN_LOGIN_REQUIRED' })
  const body = (req.body || {}) as { orderId?: string; orderIds?: string[]; decision?: 'approve' | 'reject'; note?: string }
  if (!['approve', 'reject'].includes(body.decision || '')) return res.status(400).json({ error: 'INVALID_REVIEW_INPUT' })

  // Bulk mode: approve/reject several orders in one request, e.g. after a batch of
  // customers all pay around the same time. Each order still goes through the exact
  // same atomic per-order checks/RPC as a single review — one bad order (already
  // reviewed by someone else, missing slip, etc.) never blocks the rest.
  if (Array.isArray(body.orderIds)) {
    const orderIds = [...new Set(body.orderIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    if (!orderIds.length) return res.status(400).json({ error: 'INVALID_REVIEW_INPUT' })
    const note = body.decision === 'reject' ? (body.note?.trim() || '') : ''
    const results: ReviewResult[] = []
    for (const orderId of orderIds) {
      results.push(await reviewOne(orderId, body.decision as 'approve' | 'reject', note))
    }
    return res.status(200).json({ ok: true, results })
  }

  if (!body.orderId) return res.status(400).json({ error: 'INVALID_REVIEW_INPUT' })
  const result = await reviewOne(body.orderId, body.decision as 'approve' | 'reject', body.note?.trim() || '')
  if (!result.ok) {
    const status = result.error === 'ORDER_NOT_FOUND' ? 404 : result.error === 'PAYMENT_REVIEW_FAILED' ? 500 : 409
    return res.status(status).json({ error: result.error })
  }
  return res.status(200).json({ ok: true, paymentStatus: result.paymentStatus })
}
