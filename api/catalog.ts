import { queryValue, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type EventRow = {
  id: string
  title: string
  event_date: string | null
  venue: string | null
  description: string | null
  share_token: string
  status: 'draft' | 'active' | 'expired' | 'reactivated' | 'archived' | 'purged' | 'published' | 'closed'
  sale_starts_at: string | null
  sale_ends_at: string | null
  original_purge_at: string | null
  originals_purged_at: string | null
  contact_line_url: string | null
  contact_phone: string | null
}

type CategoryRow = { name: string }
type TierRow = { photo_count: number; price_satang: number; label: string | null }
type PhotoRow = { id: string; photo_code: string; category: string | null; preview_url: string; width: number | null; height: number | null }

const activeStatuses = new Set(['active', 'reactivated', 'published'])

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  const shareToken = queryValue(req.query?.shareToken)
  if (!shareToken) return res.status(400).json({ error: 'SHARE_TOKEN_REQUIRED' })

  try {
    const selection = 'id,title,event_date,venue,description,share_token,status,sale_starts_at,sale_ends_at,original_purge_at,originals_purged_at,contact_line_url,contact_phone'
    const events = await supabaseRest<EventRow[]>(`event_photo_events?share_token=eq.${encodeURIComponent(shareToken)}&select=${selection}&limit=1`)
    const event = events[0]
    if (!event || event.status === 'draft') return res.status(404).json({ error: 'EVENT_NOT_FOUND' })

    const now = Date.now()
    const startsAt = event.sale_starts_at ? new Date(event.sale_starts_at).getTime() : Number.NEGATIVE_INFINITY
    const endsAt = event.sale_ends_at ? new Date(event.sale_ends_at).getTime() : Number.POSITIVE_INFINITY
    const saleOpen = activeStatuses.has(event.status) && startsAt <= now && endsAt > now
    const scheduled = activeStatuses.has(event.status) && startsAt > now
    const effectiveStatus = event.originals_purged_at
      ? 'purged'
      : saleOpen || scheduled
        ? event.status
        : event.status === 'archived' || event.status === 'purged'
          ? event.status
          : 'expired'

    const [categories, tiers, photos] = await Promise.all([
      supabaseRest<CategoryRow[]>(`event_photo_categories?event_id=eq.${event.id}&select=name&order=sort_order.asc`),
      supabaseRest<TierRow[]>(`event_photo_price_tiers?event_id=eq.${event.id}&is_active=eq.true&select=photo_count,price_satang,label&order=photo_count.asc`),
      supabaseRest<PhotoRow[]>(`event_photo_photos?event_id=eq.${event.id}&is_visible=eq.true&select=id,photo_code,category,preview_url,width,height&order=sort_order.asc,created_at.asc`),
    ])

    res.setHeader('cache-control', saleOpen ? 'public, max-age=20, s-maxage=30' : 'public, max-age=60, s-maxage=300')
    return res.status(200).json({
      event: {
        id: event.id,
        title: event.title,
        subtitle: [event.event_date, event.venue].filter(Boolean).join(' · '),
        description: event.description || 'เลือกรูปที่ชอบ จ่ายผ่านพร้อมเพย์ แนบสลิป แล้วรอช่างภาพอนุมัติเพื่อดาวน์โหลดไฟล์เต็ม',
        shareToken: event.share_token,
        status: effectiveStatus,
        saleOpen,
        saleStartsAt: event.sale_starts_at,
        saleEndsAt: event.sale_ends_at,
        originalPurgeAt: event.original_purge_at,
        originalsPurgedAt: event.originals_purged_at,
        contactLineUrl: event.contact_line_url,
        contactPhone: event.contact_phone,
      },
      categories: ['ทั้งหมด', ...categories.map((item) => item.name)],
      tiers: tiers.map((tier) => ({ count: tier.photo_count, price: Math.round(tier.price_satang / 100), label: tier.label || '' })),
      photos: photos.map((photo) => ({
        id: photo.id,
        code: photo.photo_code,
        category: photo.category || 'ไม่ระบุหมวด',
        src: photo.preview_url,
        orientation: photo.width && photo.height && photo.width > photo.height ? 'landscape' : 'portrait',
      })),
    })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'CATALOG_FAILED' })
  }
}
