import ImageKit from '@imagekit/nodejs'
import { queryValue, requiredEnv, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type OrderRow = { id: string; payment_status: string; download_expires_at: string | null }
type ItemRow = { photo_id: string }
type AssetRow = {
  imagekit_original_path: string
  original_filename: string
  original_storage_status: 'online' | 'purging' | 'purged' | 'error'
  original_purged_at: string | null
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

    const client = new ImageKit({ privateKey: requiredEnv('IMAGEKIT_PRIVATE_KEY') })
    const signedUrl = client.helper.buildSrc({
      urlEndpoint: requiredEnv('IMAGEKIT_URL_ENDPOINT'),
      src: asset.imagekit_original_path,
      signed: true,
      expiresIn: 300,
      queryParameters: { 'ik-attachment': asset.original_filename },
    })
    res.setHeader('cache-control', 'no-store')
    return res.redirect(302, signedUrl)
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'DOWNLOAD_FAILED' })
  }
}
