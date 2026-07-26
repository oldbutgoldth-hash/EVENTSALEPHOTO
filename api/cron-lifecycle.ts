import ImageKit from '@imagekit/nodejs'
import { requiredEnv, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type DueEvent = { id: string; title: string }
type AssetRow = {
  photo_id: string
  imagekit_file_id: string
  preview_imagekit_file_id: string | null
  original_storage_status: string
  event_photo_photos?: { event_id?: string } | Array<{ event_id?: string }>
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function isCronAuthorized(req: ApiRequest): boolean {
  const secret = requiredEnv('CRON_SECRET')
  return headerValue(req.headers.authorization) === `Bearer ${secret}`
}

async function listAssetsForEvent(eventId: string): Promise<AssetRow[]> {
  const pageSize = 500
  const all: AssetRow[] = []
  for (let page = 0; page < 100; page += 1) {
    const start = page * pageSize
    const end = start + pageSize - 1
    const rows = await supabaseRest<AssetRow[]>(
      `event_photo_photo_assets?select=photo_id,imagekit_file_id,preview_imagekit_file_id,original_storage_status,event_photo_photos!inner(event_id)&event_photo_photos.event_id=eq.${encodeURIComponent(eventId)}&original_purged_at=is.null&original_storage_status=neq.purged`,
      { headers: { range: `${start}-${end}`, 'range-unit': 'items' } },
    )
    all.push(...rows)
    if (rows.length < pageSize) break
  }
  return all
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

async function patchAssets(assets: AssetRow[], payload: Record<string, unknown>): Promise<void> {
  if (!assets.length) return
  const ids = assets.map((asset) => asset.photo_id).join(',')
  await supabaseRest(`event_photo_photo_assets?photo_id=in.(${ids})`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  try {
    if (!isCronAuthorized(req)) return res.status(401).json({ error: 'CRON_UNAUTHORIZED' })

    const lifecycle = await supabaseRest<Record<string, unknown>>('rpc/event_photo_refresh_lifecycle', {
      method: 'POST',
      body: '{}',
    })

    const now = new Date().toISOString()
    const dueEvents = await supabaseRest<DueEvent[]>(
      `event_photo_events?original_purge_at=lte.${encodeURIComponent(now)}&originals_purged_at=is.null&status=in.(expired,archived)&select=id,title&order=original_purge_at.asc`,
    )
    if (dueEvents.length === 0) {
      res.setHeader('cache-control', 'no-store')
      return res.status(200).json({ ok: true, lifecycle, dueEvents: 0, report: [] })
    }

    const client = new ImageKit({ privateKey: requiredEnv('IMAGEKIT_PRIVATE_KEY') })
    const report: Array<Record<string, unknown>> = []

    for (const event of dueEvents) {
      const assets = await listAssetsForEvent(event.id)
      let deleted = 0
      let failed = 0
      let skippedWithoutIndependentPreview = 0

      const eligibleAssets = assets.filter((asset) => {
        if (asset.preview_imagekit_file_id) return true
        skippedWithoutIndependentPreview += 1
        return false
      })

      // ImageKit accepts at most 100 file IDs per bulk delete request. Batching
      // avoids hundreds of sequential network calls and Vercel timeouts.
      for (const batch of chunks(eligibleAssets, 100)) {
        try {
          await patchAssets(batch, { original_storage_status: 'purging', original_purge_error: null })
          const result = await client.files.bulk.delete({
            fileIds: batch.map((asset) => asset.imagekit_file_id),
          })
          const confirmed = new Set(result.successfullyDeletedFileIds || [])
          const successful = batch.filter((asset) => confirmed.has(asset.imagekit_file_id))
          const unconfirmed = batch.filter((asset) => !confirmed.has(asset.imagekit_file_id))
          await patchAssets(successful, {
            original_storage_status: 'purged',
            original_purged_at: new Date().toISOString(),
            original_purge_error: null,
          })
          await patchAssets(unconfirmed, {
            original_storage_status: 'error',
            original_purge_error: 'IMAGEKIT_BULK_DELETE_NOT_CONFIRMED',
          })
          deleted += successful.length
          failed += unconfirmed.length
        } catch (error) {
          failed += batch.length
          await patchAssets(batch, {
            original_storage_status: 'error',
            original_purge_error: error instanceof Error ? error.message.slice(0, 500) : 'IMAGEKIT_BULK_DELETE_FAILED',
          }).catch(() => undefined)
        }
      }

      const remaining = await listAssetsForEvent(event.id)
      if (remaining.length === 0 && failed === 0) {
        await supabaseRest(`event_photo_events?id=eq.${event.id}`, {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({
            originals_purged_at: new Date().toISOString(),
            status: 'purged',
          }),
        })
      }

      report.push({
        eventId: event.id,
        title: event.title,
        found: assets.length,
        deleted,
        failed,
        skippedWithoutIndependentPreview,
        remaining: remaining.length,
      })
    }

    res.setHeader('cache-control', 'no-store')
    return res.status(200).json({ ok: true, lifecycle, dueEvents: dueEvents.length, report })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'LIFECYCLE_CRON_FAILED' })
  }
}
