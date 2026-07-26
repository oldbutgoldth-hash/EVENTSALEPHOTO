import { createPromptPayPayload, normalizePromptPayId } from '../server/promptpay.js'
import { requiredEnv, siteUrl, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type RpcResult = { order_id: string; order_number: string; public_token: string; amount_satang: number }

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  const body = (req.body || {}) as { shareToken?: string; photoIds?: Array<string | number>; photoCount?: number; buyerPhone?: string }
  const selectedCount = Array.isArray(body.photoIds) ? new Set(body.photoIds.map(String)).size : 0
  if (!body.shareToken || !Array.isArray(body.photoIds) || selectedCount < 1 || selectedCount > 10 || body.photoCount !== selectedCount) {
    return res.status(400).json({ error: 'INVALID_ORDER_INPUT' })
  }

  try {
    // Validate configuration before writing an order. Otherwise a missing or
    // malformed PromptPay ID would leave an orphaned unpaid order on every retry.
    const promptPayId = requiredEnv('PROMPTPAY_ID')
    normalizePromptPayId(promptPayId)
    const result = await supabaseRest<RpcResult[]>('rpc/create_event_photo_order', {
      method: 'POST',
      body: JSON.stringify({
        p_share_token: body.shareToken,
        p_photo_ids: body.photoIds.map(String),
        p_buyer_phone: body.buyerPhone || null,
      }),
    })
    const order = result[0]
    if (!order) throw new Error('ORDER_CREATE_FAILED')

    const origin = siteUrl(req)
    const orderUrl = `${origin}/?order=${encodeURIComponent(order.public_token)}`
    return res.status(200).json({
      checkoutUrl: orderUrl,
      publicToken: order.public_token,
      orderNumber: order.order_number,
      amount: order.amount_satang / 100,
      promptPayPayload: createPromptPayPayload(promptPayId, order.amount_satang, order.order_number),
    })
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'CHECKOUT_FAILED' })
  }
}
