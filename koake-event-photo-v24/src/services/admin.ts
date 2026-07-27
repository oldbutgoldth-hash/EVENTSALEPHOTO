import type { EventLifecycleStatus } from '../lib/eventLifecycle'

export type SaveEventInput = {
  eventId?: string
  title: string
  slug: string
  shareToken?: string
  eventDate: string
  venue: string
  description: string
  category: string
  status: EventLifecycleStatus
  saleStartsAt: string | null
  saleEndsAt: string | null
  originalPurgeAt: string | null
  contactLineUrl: string
  contactPhone: string
}

export async function saveEvent(input: SaveEventInput): Promise<{ eventId: string; shareToken: string }> {
  const response = await fetch('/api/admin-save-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { eventId?: string; shareToken?: string; error?: string }
  if (!response.ok || !payload.eventId || !payload.shareToken) throw new Error(payload.error || 'บันทึกงานไม่สำเร็จ')
  return { eventId: payload.eventId, shareToken: payload.shareToken }
}

async function adminEventMutation(method: 'PATCH' | 'DELETE', body: Record<string, string>) {
  const response = await fetch('/api/admin-save-event', {
    method,
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    deleted?: boolean
    archived?: boolean
    updated?: boolean
    error?: string
  }
  if (!response.ok) throw new Error(payload.error || 'จัดการอัลบั้มไม่สำเร็จ')
  return payload
}

export function deleteEvent(eventId: string) {
  return adminEventMutation('DELETE', { eventId })
}

export async function resetEventOrders(eventId: string): Promise<{ deletedCount: number }> {
  const response = await fetch('/api/admin-save-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'reset-orders', eventId }),
  })
  const payload = (await response.json().catch(() => ({}))) as { reset?: boolean; deletedCount?: number; error?: string }
  if (!response.ok || !payload.reset) throw new Error(payload.error || 'รีเซตคำสั่งซื้อไม่สำเร็จ')
  return { deletedCount: payload.deletedCount || 0 }
}

export type Slip2GoDiagnostics = {
  secretConfigured: boolean
  secretLength: number
  secretHasLeadingWhitespace: boolean
  secretHasTrailingWhitespace: boolean
  secretContainsNewline: boolean
  secretContainsQuotes: boolean
  secretFingerprint: string | null
  promptPayConfigured: boolean
  promptPayMasked: string | null
  probe: { httpStatus: number; code: string | null; message: string | null } | null
  quota: { remaining: number | null; limit: number | null } | null
  error?: string
}

// Never returns the real secret — just enough to tell "env var not set/has a
// stray space" apart from "Slip2Go rejected a real, well-formed key". The
// live probe (checked box) burns one Slip2Go request on a dummy image, so it
// is opt-in rather than run on every dashboard load.
export async function getSlip2GoDiagnostics(probe: boolean): Promise<Slip2GoDiagnostics> {
  const response = await fetch(`/api/admin-dashboard?diagnostic=slip2go${probe ? '&probe=1' : ''}`, {
    credentials: 'include',
  })
  const payload = (await response.json().catch(() => ({}))) as Slip2GoDiagnostics
  if (!response.ok) throw new Error(payload.error || 'ตรวจสอบระบบ Slip2Go ไม่สำเร็จ')
  return payload
}

export function renameCategory(eventId: string, categoryId: string, name: string) {
  return adminEventMutation('PATCH', { action: 'rename-category', eventId, categoryId, name })
}

export function deleteCategory(eventId: string, categoryId: string) {
  return adminEventMutation('DELETE', { eventId, categoryId })
}

export async function deletePhoto(eventId: string, photoId: string) {
  const response = await fetch('/api/admin-save-photo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'delete', eventId, photoId }),
  })
  const payload = (await response.json().catch(() => ({}))) as { deleted?: boolean; error?: string }
  if (!response.ok || !payload.deleted) throw new Error(payload.error || 'ลบรูปไม่สำเร็จ')
  return payload
}
