// Remembers in-progress orders on this browser (localStorage) so a customer
// who closes the tab while waiting for admin approval can still find their
// way back to the order status page later, without needing an account.

export type RememberedOrder = {
  token: string
  orderNumber: string
  createdAt: string
}

const STORAGE_KEY = 'koake_pending_orders'
const MAX_REMEMBERED = 8

function readAll(): RememberedOrder[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is RememberedOrder =>
      Boolean(item) && typeof item === 'object' && typeof (item as RememberedOrder).token === 'string',
    )
  } catch {
    return []
  }
}

function writeAll(orders: RememberedOrder[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(0, MAX_REMEMBERED)))
  } catch {
    // Private browsing / storage disabled — remembering is a nice-to-have, not required.
  }
}

export function rememberOrder(order: RememberedOrder): void {
  const existing = readAll().filter((item) => item.token !== order.token)
  writeAll([order, ...existing])
}

export function forgetOrder(token: string): void {
  writeAll(readAll().filter((item) => item.token !== token))
}

export function getRememberedOrders(): RememberedOrder[] {
  return readAll()
}
