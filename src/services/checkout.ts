import type { PriceTier } from '../lib/pricing'

export type CheckoutInput = {
  shareToken: string
  photoIds: Array<number | string>
  tier: PriceTier
  buyerPhone?: string
}

export async function createLiveCheckout(input: CheckoutInput): Promise<{ checkoutUrl: string; publicToken: string; orderNumber: string }> {
  const response = await fetch('/api/create-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      shareToken: input.shareToken,
      photoIds: input.photoIds,
      photoCount: input.tier.count,
      buyerPhone: input.buyerPhone,
    }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    checkoutUrl?: string
    publicToken?: string
    orderNumber?: string
    error?: string
  }
  if (!response.ok || !payload.checkoutUrl || !payload.publicToken) {
    throw new Error(payload.error || 'สร้างรายการชำระเงินไม่สำเร็จ')
  }
  return { checkoutUrl: payload.checkoutUrl, publicToken: payload.publicToken, orderNumber: payload.orderNumber || '' }
}
