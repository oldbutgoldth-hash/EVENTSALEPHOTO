import ImageKit from '@imagekit/nodejs'
import { isAdminRequest, requiredEnv, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type EventRow = { id: string; share_token: string }

const allowedStatuses = new Set(['draft', 'active', 'expired', 'reactivated', 'archived', 'purged'])

function validIsoOrNull(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'ADMIN_LOGIN_REQUIRED' })
  const body = (req.body || {}) as {
    action?: string
    eventId?: string
    categoryId?: string
    name?: string
    title?: string
    slug?: string
    shareToken?: string
    eventDate?: string
    venue?: string
    description?: string
    category?: string
    status?: string
    saleStartsAt?: string | null
    saleEndsAt?: string | null
    originalPurgeAt?: string | null
    contactLineUrl?: string
    contactPhone?: string
  }

  if (req.method === 'PATCH' && body.action === 'rename-category') {
    if (!body.eventId || !body.categoryId || !body.name?.trim()) {
      return res.status(400).json({ error: 'CATEGORY_DATA_REQUIRED' })
    }
    try {
      const categories = await supabaseRest<Array<{ name: string }>>(
        `event_photo_categories?id=eq.${body.categoryId}&event_id=eq.${body.eventId}&select=name&limit=1`,
      )
      const current = categories[0]
      if (!current) return res.status(404).json({ error: 'CATEGORY_NOT_FOUND' })
      const nextName = body.name.trim()
      await supabaseRest(`event_photo_categories?id=eq.${body.categoryId}&event_id=eq.${body.eventId}`, {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ name: nextName }),
      })
      await supabaseRest(`event_photo_photos?event_id=eq.${body.eventId}&category=eq.${encodeURIComponent(current.name)}`, {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ category: nextName }),
      })
      return res.status(200).json({ updated: true })
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'CATEGORY_UPDATE_FAILED' })
    }
  }

  if (req.method === 'DELETE' && body.categoryId) {
    if (!body.eventId) return res.status(400).json({ error: 'EVENT_ID_REQUIRED' })
    try {
      const categories = await supabaseRest<Array<{ name: string }>>(
        `event_photo_categories?id=eq.${body.categoryId}&event_id=eq.${body.eventId}&select=name&limit=1`,
      )
      const current = categories[0]
      if (!current) return res.status(404).json({ error: 'CATEGORY_NOT_FOUND' })
      await supabaseRest(`event_photo_photos?event_id=eq.${body.eventId}&category=eq.${encodeURIComponent(current.name)}`, {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ category: null }),
      })
      await supabaseRest(`event_photo_categories?id=eq.${body.categoryId}&event_id=eq.${body.eventId}`, {
        method: 'DELETE',
        headers: { prefer: 'return=minimal' },
      })
      return res.status(200).json({ deleted: true })
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'CATEGORY_DELETE_FAILED' })
    }
  }

  if (req.method === 'DELETE') {
    if (!body.eventId) return res.status(400).json({ error: 'EVENT_ID_REQUIRED' })
    try {
      const orders = await supabaseRest<Array<{ id: string }>>(
        `event_photo_orders?event_id=eq.${body.eventId}&select=id&limit=1`,
      )
      if (orders.length) {
        await supabaseRest(`event_photo_events?id=eq.${body.eventId}`, {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'archived' }),
        })
        return res.status(200).json({ archived: true })
      }

      const assets = await supabaseRest<Array<{
        imagekit_file_id: string | null
        preview_imagekit_file_id: string | null
      }>>(
        `event_photo_photo_assets?event_photo_photos.event_id=eq.${body.eventId}&select=imagekit_file_id,preview_imagekit_file_id,event_photo_photos!inner(event_id)`,
      )
      const fileIds = [...new Set(assets.flatMap((asset) => [
        asset.imagekit_file_id,
        asset.preview_imagekit_file_id,
      ]).filter((fileId): fileId is string => Boolean(fileId)))]
      if (fileIds.length) {
        const imagekit = new ImageKit({ privateKey: requiredEnv('IMAGEKIT_PRIVATE_KEY') })
        for (let index = 0; index < fileIds.length; index += 100) {
          await imagekit.files.bulk.delete({ fileIds: fileIds.slice(index, index + 100) })
        }
      }
      await supabaseRest(`event_photo_events?id=eq.${body.eventId}`, {
        method: 'DELETE',
        headers: { prefer: 'return=minimal' },
      })
      return res.status(200).json({ deleted: true })
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'EVENT_DELETE_FAILED' })
    }
  }

  if (!body.title || !body.slug) return res.status(400).json({ error: 'TITLE_AND_SLUG_REQUIRED' })

  const now = new Date()
  const defaultSaleEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const defaultPurge = new Date(defaultSaleEnd.getTime() + 7 * 24 * 60 * 60 * 1000)
  const saleStartsAt = validIsoOrNull(body.saleStartsAt) || now.toISOString()
  const saleEndsAt = validIsoOrNull(body.saleEndsAt) || defaultSaleEnd.toISOString()
  const originalPurgeAt = validIsoOrNull(body.originalPurgeAt) || defaultPurge.toISOString()
  if (new Date(saleEndsAt).getTime() <= new Date(saleStartsAt).getTime()) {
    return res.status(400).json({ error: 'SALE_END_MUST_BE_AFTER_START' })
  }
  if (new Date(originalPurgeAt).getTime() <= new Date(saleEndsAt).getTime()) {
    return res.status(400).json({ error: 'ORIGINAL_PURGE_MUST_BE_AFTER_SALE_END' })
  }

  try {
    const payload = {
      title: body.title,
      slug: body.slug,
      share_token: body.shareToken || undefined,
      event_date: body.eventDate || null,
      venue: body.venue || null,
      description: body.description || null,
      status: allowedStatuses.has(body.status || '') ? body.status : 'active',
      sale_starts_at: saleStartsAt,
      sale_ends_at: saleEndsAt,
      expires_at: saleEndsAt,
      original_purge_at: originalPurgeAt,
      contact_line_url: body.contactLineUrl || null,
      contact_phone: body.contactPhone || null,
    }
    const rows = body.eventId && !body.eventId.startsWith('00000000-')
      ? await supabaseRest<EventRow[]>(`event_photo_events?id=eq.${body.eventId}&select=id,share_token`, {
          method: 'PATCH',
          headers: { prefer: 'return=representation' },
          body: JSON.stringify(payload),
        })
      : await supabaseRest<EventRow[]>('event_photo_events?on_conflict=slug&select=id,share_token', {
          method: 'POST',
          headers: { prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(payload),
        })
    const event = rows[0]
    if (!event) throw new Error('EVENT_SAVE_FAILED')

    await supabaseRest('rpc/seed_event_photo_price_tiers', {
      method: 'POST',
      body: JSON.stringify({ p_event_id: event.id }),
    })

    if (body.category) {
      await supabaseRest('event_photo_categories?on_conflict=event_id,name', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ event_id: event.id, name: body.category }),
      })
    }

    return res.status(200).json({ eventId: event.id, shareToken: event.share_token })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'EVENT_SAVE_FAILED' })
  }
}
