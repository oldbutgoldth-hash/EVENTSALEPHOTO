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
