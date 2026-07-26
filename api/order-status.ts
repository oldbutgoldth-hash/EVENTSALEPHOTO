import { createPromptPayPayload } from '../server/promptpay.js'
import { queryValue, requiredEnv, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type OrderRow = {
  id: string
  order_number: string
  public_token: string
  payment_status: string
  amount_satang: number
  download_expires_at: string | null
  payment_slip_uploaded_at: string | null
  payment_review_note: string | null
  event_photo_events: { title: string }
}
type ItemRow = { photo_id: string; event_photo_photos: { id: string; photo_code: string; preview_url: string; filename: string } }

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  const token = queryValue(req.query?.token)
  if (token.length < 32) return res.status(400).json({ error: 'INVALID_TOKEN' })
  try {
    const orders = await supabaseRest<OrderRow[]>(`event_photo_orders?public_token=eq.${encodeURIComponent(token)}&select=id,order_number,public_token,payment_status,amount_satang,download_expires_at,payment_slip_uploaded_at,payment_review_note,event_photo_events(title)&limit=1`)
    const order = orders[0]
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
    const items = await supabaseRest<ItemRow[]>(`event_photo_order_items?order_id=eq.${order.id}&select=photo_id,event_photo_photos(id,photo_code,preview_url,filename)`)
    res.setHeader('cache-control', 'no-store')
    return res.status(200).json({
      orderNumber: order.order_number,
      eventTitle: order.event_photo_events.title,
      paymentStatus: order.payment_status,
      amount: order.amount_satang / 100,
      downloadExpiresAt: order.download_expires_at,
      slipUploadedAt: order.payment_slip_uploaded_at,
      reviewNote: order.payment_review_note,
      promptPayPayload: order.payment_status === 'paid'
        ? null
        : createPromptPayPayload(requiredEnv('PROMPTPAY_ID'), order.amount_satang, order.order_number),
      promptPayAccountName: process.env.PROMPTPAY_ACCOUNT_NAME || 'บัญชีช่างภาพ',
      photos: items.map((item) => ({ id: item.event_photo_photos.id, code: item.event_photo_photos.photo_code, src: item.event_photo_photos.preview_url, filename: item.event_photo_photos.filename })),
    })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'ORDER_STATUS_FAILED' })
  }
}
