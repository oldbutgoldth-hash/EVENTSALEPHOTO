import type { Photo } from '../data/mockData'
import type { EventLifecycleFields } from '../lib/eventLifecycle'
import type { PriceTier } from '../lib/pricing'

export type EventCatalog = {
  event: {
    id?: string
    title: string
    subtitle: string
    description: string
    shareToken?: string
  } & EventLifecycleFields
  categories: string[]
  tiers: PriceTier[]
  photos: Photo[]
}

export type AlbumSummary = {
  id: string
  title: string
  eventDate: string | null
  venue: string | null
  description: string | null
  shareToken: string
  status: string
  saleStartsAt: string | null
  saleEndsAt: string | null
  photoCount: number
  coverUrl: string | null
}

export async function fetchAlbums(): Promise<AlbumSummary[]> {
  const response = await fetch('/api/catalog?list=1', { cache: 'no-store' })
  const payload = (await response.json().catch(() => ({}))) as { albums?: AlbumSummary[]; error?: string }
  if (!response.ok || !Array.isArray(payload.albums)) {
    throw new Error(payload.error || 'โหลดรายการอัลบั้มไม่สำเร็จ')
  }
  return payload.albums
}

export async function fetchEventCatalog(shareToken: string): Promise<EventCatalog> {
  const response = await fetch(`/api/catalog?shareToken=${encodeURIComponent(shareToken)}`, { cache: 'no-store' })
  const payload = (await response.json().catch(() => ({}))) as EventCatalog & { error?: string }
  if (!response.ok || !payload.event || !Array.isArray(payload.photos)) {
    throw new Error(payload.error || 'โหลดอัลบั้มไม่สำเร็จ')
  }
  return payload
}
