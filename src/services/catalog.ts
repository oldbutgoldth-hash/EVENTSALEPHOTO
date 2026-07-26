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

export async function fetchEventCatalog(shareToken: string): Promise<EventCatalog> {
  const response = await fetch(`/api/catalog?shareToken=${encodeURIComponent(shareToken)}`, { cache: 'no-store' })
  const payload = (await response.json().catch(() => ({}))) as EventCatalog & { error?: string }
  if (!response.ok || !payload.event || !Array.isArray(payload.photos)) {
    throw new Error(payload.error || 'โหลดอัลบั้มไม่สำเร็จ')
  }
  return payload
}
