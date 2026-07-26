import crypto from 'node:crypto'
import { queryValue, requiredEnv, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type OrderRow = { id: string; payment_status: string; download_expires_at: string | null }
type ItemRow = { photo_id: string }
type AssetRow = {
  imagekit_original_path: string
  original_filename: string
  original_storage_status: 'online' | 'purging' | 'purged' | 'error'
  original_purged_at: string | null
}

// Built by hand, following ImageKit's documented signing algorithm exactly
// (https://imagekit.io/docs/media-delivery-basic-security#pseudo-code-to-generate-signed-url).
// The @imagekit/nodejs SDK's helper.buildSrc({ queryParameters: { 'ik-attachment': 'true' } })
// combination produced a malformed response from ImageKit's edge for every file (ERR_INVALID_RESPONSE
// in the browser), so this bypasses the SDK for this one endpoint instead of guessing at its internals.
function buildSignedAttachmentUrl(urlEndpoint: string, filePath: string, privateKey: string, expiresInSeconds: number): string {
  const endpoint = urlEndpoint.replace(/\/+$/, '')
  const path = filePath.startsWith('/') ? filePath.slice(1) : filePath
  const expiryTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const signature = crypto.createHmac('sha1', privateKey).update(`${path}${expiryTimestamp}`).digest('hex')
  return `${endpoint}/${path}?ik-t=${expiryTimestamp}&ik-s=${signature}&ik-attachment=true`
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  const orderToken = queryValue(req.query?.orderToken)
  const photoId = queryValue(req.query?.photoId)
  if (orderToken.length < 32 || !photoId) return res.status(400).json({ error: 'INVALID_DOWNLOAD_INPUT' })

  try {
    const orders = await supabaseRest<OrderRow[]>(`event_photo_orders?public_token=eq.${encodeURIComponent(orderToken)}&select=id,payment_status,download_expires_at&limit=1`)
    const order = orders[0]
    if (!order || order.payment_status !== 'paid') return res.status(403).json({ error: 'ORDER_NOT_PAID' })
    if (order.download_expires_at && new Date(order.download_expires_at).getTime() <= Date.now()) return res.status(403).json({ error: 'DOWNLOAD_EXPIRED' })

    const items = await supabaseRest<ItemRow[]>(`event_photo_order_items?order_id=eq.${order.id}&photo_id=eq.${encodeURIComponent(photoId)}&select=photo_id&limit=1`)
    if (!items[0]) return res.status(403).json({ error: 'PHOTO_NOT_PURCHASED' })
    const assets = await supabaseRest<AssetRow[]>(`event_photo_photo_assets?photo_id=eq.${encodeURIComponent(photoId)}&select=imagekit_original_path,original_filename,original_storage_status,original_purged_at&limit=1`)
    const asset = assets[0]
    if (!asset) return res.status(404).json({ error: 'ORIGINAL_NOT_FOUND' })
    if (asset.original_purged_at || asset.original_storage_status === 'purged') {
      return res.status(410).json({ error: 'ORIGINAL_ARCHIVED_OFFLINE_CONTACT_PHOTOGRAPHER' })
    }
    if (asset.original_storage_status === 'purging') return res.status(409).json({ error: 'ORIGINAL_MAINTENANCE_TRY_AGAIN' })

    const signedUrl = buildSignedAttachmentUrl(
      requiredEnv('IMAGEKIT_URL_ENDPOINT'),
      asset.imagekit_original_path,
      requiredEnv('IMAGEKIT_PRIVATE_KEY'),
      300,
    )
    res.setHeader('cache-control', 'no-store')
    return res.redirect(302, signedUrl)
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'DOWNLOAD_FAILED' })
  }
}
