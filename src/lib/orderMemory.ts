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
const DOWNLOAD_KEY_PREFIX = 'koake_downloaded_'

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
  try {
    window.localStorage.removeItem(DOWNLOAD_KEY_PREFIX + token)
  } catch {
    // ignore
  }
}

export function getRememberedOrders(): RememberedOrder[] {
  return readAll()
}

function readDownloaded(token: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(DOWNLOAD_KEY_PREFIX + token)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeDownloaded(token: string, ids: Set<string>): void {
  try {
    window.localStorage.setItem(DOWNLOAD_KEY_PREFIX + token, JSON.stringify([...ids]))
  } catch {
    // Private browsing / storage disabled — this is a nice-to-have, not required.
  }
}

// Marks one purchased photo as downloaded on this browser. Once every photo in
// `allPhotoIds` has been marked, the order is dropped from the pending-orders
// reminder automatically — the customer already has everything, so there's
// nothing left to remind them about.
export function markPhotoDownloaded(token: string, photoId: string, allPhotoIds: string[]): void {
  const downloaded = readDownloaded(token)
  downloaded.add(photoId)
  const complete = allPhotoIds.length > 0 && allPhotoIds.every((id) => downloaded.has(id))
  if (complete) {
    forgetOrder(token)
  } else {
    writeDownloaded(token, downloaded)
  }
}
