import ImageKit from '@imagekit/nodejs'
import { isAdminRequest, requiredEnv, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type UploadItem = {
  fileId?: string
  filePath?: string
  name?: string
  url?: string
  width?: number
  height?: number
  size?: number
}

type Body = {
  action?: 'delete'
  eventId?: string
  photoId?: string
  category?: string
  photoCode?: string
  upload?: {
    original?: UploadItem
    preview?: UploadItem
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'ADMIN_LOGIN_REQUIRED' })
  const body = (req.body || {}) as Body

  if (body.action === 'delete') {
    if (!body.eventId || !body.photoId) return res.status(400).json({ error: 'PHOTO_ID_REQUIRED' })
    try {
      const photos = await supabaseRest<Array<{ id: string; photo_code: string }>>(
        `event_photo_photos?id=eq.${encodeURIComponent(body.photoId)}&event_id=eq.${encodeURIComponent(body.eventId)}&select=id,photo_code&limit=1`,
      )
      const photo = photos[0]
      if (!photo) return res.status(404).json({ error: 'PHOTO_NOT_FOUND' })

      const orderItems = await supabaseRest<Array<{ id: string }>>(
        `event_photo_order_items?photo_id=eq.${encodeURIComponent(photo.id)}&select=id&limit=1`,
      )
      if (orderItems.length) {
        return res.status(409).json({
          error: `รูป ${photo.photo_code} อยู่ในคำสั่งซื้อแล้ว จึงลบไม่ได้`,
          code: 'PHOTO_USED_IN_ORDER',
        })
      }

      const assets = await supabaseRest<Array<{
        imagekit_file_id: string | null
        preview_imagekit_file_id: string | null
      }>>(
        `event_photo_photo_assets?photo_id=eq.${encodeURIComponent(photo.id)}&select=imagekit_file_id,preview_imagekit_file_id&limit=1`,
      )
      const fileIds = [...new Set([
        assets[0]?.imagekit_file_id,
        assets[0]?.preview_imagekit_file_id,
      ].filter((fileId): fileId is string => Boolean(fileId)))]

      if (fileIds.length) {
        const imagekit = new ImageKit({ privateKey: requiredEnv('IMAGEKIT_PRIVATE_KEY').trim() })
        for (const fileId of fileIds) {
          try {
            await imagekit.files.delete(fileId)
          } catch (error) {
            const candidate = error as { statusCode?: number; response?: { status?: number }; message?: string }
            const statusCode = candidate.statusCode || candidate.response?.status
            if (statusCode !== 404 && !/not found|404/i.test(candidate.message || '')) throw error
          }
        }
      }

      await supabaseRest(`event_photo_photos?id=eq.${encodeURIComponent(photo.id)}&event_id=eq.${encodeURIComponent(body.eventId)}`, {
        method: 'DELETE',
        headers: { prefer: 'return=minimal' },
      })
      return res.status(200).json({ deleted: true, photoId: photo.id })
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'DELETE_PHOTO_FAILED' })
    }
  }

  const original = body.upload?.original
  const preview = body.upload?.preview
  if (!body.eventId || !body.photoCode || !original?.fileId || !original.filePath || !original.name || !preview?.fileId || !preview.filePath || !preview.url) {
    return res.status(400).json({ error: 'INVALID_PHOTO_PAIR_PAYLOAD' })
  }

  let photoId = ''
  try {
    const rows = await supabaseRest<Array<{ id: string }>>('event_photo_photos?select=id', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        event_id: body.eventId,
        photo_code: body.photoCode,
        category: body.category || 'ไม่ระบุหมวด',
        filename: original.name,
        preview_url: preview.url,
        width: original.width || null,
        height: original.height || null,
        is_visible: true,
      }),
    })
    photoId = rows[0]?.id || ''
    if (!photoId) throw new Error('PHOTO_INSERT_FAILED')

    await supabaseRest('event_photo_photo_assets', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        photo_id: photoId,
        imagekit_file_id: original.fileId,
        imagekit_original_path: original.filePath,
        original_filename: original.name,
        byte_size: original.size || null,
        preview_imagekit_file_id: preview.fileId,
        preview_imagekit_path: preview.filePath,
        preview_byte_size: preview.size || null,
        original_storage_status: 'online',
      }),
    })
    return res.status(200).json({ ok: true, photoId, previewUrl: preview.url })
  } catch (error) {
    // Avoid leaving a visible, purchasable photo without its private original
    // when the asset metadata insert fails after the photo row was created.
    if (photoId) {
      await supabaseRest(`event_photo_photos?id=eq.${encodeURIComponent(photoId)}`, {
        method: 'DELETE',
        headers: { prefer: 'return=minimal' },
      }).catch(() => undefined)
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : 'SAVE_PHOTO_FAILED' })
  }
}
