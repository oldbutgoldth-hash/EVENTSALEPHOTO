export type EventLifecycleStatus =
  | 'draft'
  | 'published'
  | 'active'
  | 'expired'
  | 'reactivated'
  | 'archived'
  | 'purged'
  | 'closed'

export type EventLifecycleFields = {
  status?: EventLifecycleStatus
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  originalPurgeAt?: string | null
  originalsPurgedAt?: string | null
  contactLineUrl?: string | null
  contactPhone?: string | null
  saleOpen?: boolean
}

const ACTIVE_STATUSES = new Set<EventLifecycleStatus>(['published', 'active', 'reactivated'])

export function isEventSaleOpen(event: EventLifecycleFields, now = Date.now()): boolean {
  if (typeof event.saleOpen === 'boolean') return event.saleOpen
  const status = event.status || 'active'
  if (!ACTIVE_STATUSES.has(status)) return false
  const startsAt = event.saleStartsAt ? new Date(event.saleStartsAt).getTime() : Number.NEGATIVE_INFINITY
  const endsAt = event.saleEndsAt ? new Date(event.saleEndsAt).getTime() : Number.POSITIVE_INFINITY
  return startsAt <= now && endsAt > now
}

export function formatThaiDateTime(value?: string | null): string {
  if (!value) return 'ไม่กำหนด'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'ไม่กำหนด'
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date)
}

export function getSaleCountdownLabel(value?: string | null, now = Date.now()): string {
  if (!value) return 'ไม่กำหนดวันหมดอายุ'
  const end = new Date(value).getTime()
  if (Number.isNaN(end)) return 'ไม่กำหนดวันหมดอายุ'
  const diff = end - now
  if (diff <= 0) return 'หมดเวลาสั่งซื้อออนไลน์แล้ว'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  if (days > 0) return `เหลือ ${days} วัน ${hours} ชม.`
  const minutes = Math.max(1, Math.floor(diff / 60_000))
  if (hours > 0) return `เหลือ ${hours} ชม. ${minutes % 60} นาที`
  return `เหลือ ${minutes} นาที`
}

export function toDateTimeLocal(value?: string | Date | null): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

export function addDaysToLocalDateTime(value: string, days: number): string {
  const base = value ? new Date(value) : new Date()
  const safe = Number.isNaN(base.getTime()) ? new Date() : base
  safe.setDate(safe.getDate() + days)
  return toDateTimeLocal(safe)
}

export function addHoursToLocalDateTime(value: string, hours: number): string {
  const base = value ? new Date(value) : new Date()
  const safe = Number.isNaN(base.getTime()) ? new Date() : base
  safe.setHours(safe.getHours() + hours)
  return toDateTimeLocal(safe)
}

export function localDateTimeToIso(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
