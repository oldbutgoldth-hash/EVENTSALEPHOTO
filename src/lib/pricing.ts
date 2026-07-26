export type PriceTier = {
  count: number
  price: number
  label: string
}

export const DEFAULT_PRICE_TIERS: PriceTier[] = [
  { count: 1, price: 50, label: 'เริ่มต้น' },
  { count: 2, price: 80, label: 'ประหยัด 20฿' },
  { count: 3, price: 100, label: 'ขายดี' },
  { count: 4, price: 130, label: 'ครอบครัว' },
  { count: 5, price: 150, label: 'คุ้มขึ้น' },
  { count: 6, price: 170, label: 'เฉลี่ย 28฿' },
  { count: 7, price: 190, label: 'เก็บครบช่วง' },
  { count: 8, price: 210, label: 'คุ้มมาก' },
  { count: 9, price: 230, label: 'เกือบครบชุด' },
  { count: 10, price: 250, label: 'คุ้มสุด' },
]

export const MAX_PHOTOS_PER_ORDER = 10

export function getTierForCount(tiers: PriceTier[], count: number): PriceTier | undefined {
  return tiers.find((tier) => tier.count === count)
}

export function formatBaht(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(value)
}

// Orders carry a few random extra satang (e.g. 100.12 instead of 100) so every
// order has a near-unique amount to transfer — this formatter must not round
// that away, or the customer/admin can't see the exact figure to match a slip to.
export function formatBahtExact(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function unitPrice(tier: PriceTier): number {
  return tier.price / tier.count
}
