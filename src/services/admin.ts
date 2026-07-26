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
