import crypto from 'node:crypto'
import { queryValue, supabaseAdmin, supabaseRest, type ApiRequest, type ApiResponse } from './utils.js'

const allowedTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

type OrderRow = { id: string; payment_status: string }

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  const body = (req.body || {}) as { token?: string; contentType?: string; fileSize?: number }
  const token = queryValue(body.token)
  const extension = allowedTypes[body.contentType || '']
  if (token.length < 32 || !extension || !Number.isInteger(body.fileSize) || (body.fileSize || 0) < 1 || (body.fileSize || 0) > 6 * 1024 * 1024) {
    return res.status(400).json({ error: 'SLIP_MUST_BE_JPG_PNG_WEBP_UNDER_6MB' })
  }

  try {
    const orders = await supabaseRest<OrderRow[]>(`event_photo_orders?public_token=eq.${encodeURIComponent(token)}&select=id,payment_status&limit=1`)
    const order = orders[0]
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
    if (!['unpaid', 'failed', 'rejected'].includes(order.payment_status)) {
      return res.status(409).json({ error: order.payment_status === 'paid' ? 'ORDER_ALREADY_PAID' : 'SLIP_ALREADY_UNDER_REVIEW' })
    }

    const path = `${order.id}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`
    const { data, error } = await supabaseAdmin().storage.from('payment-slips').createSignedUploadUrl(path)
    if (error || !data?.token) throw error || new Error('SIGNED_UPLOAD_FAILED')
    res.setHeader('cache-control', 'no-store')
    return res.status(200).json({ path, uploadToken: data.token })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'SLIP_UPLOAD_URL_FAILED' })
  }
}
