import { isAdminRequest, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

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
  eventId?: string
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
