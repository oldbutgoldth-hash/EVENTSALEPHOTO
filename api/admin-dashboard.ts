import { isAdminRequest, queryValue, supabaseAdmin, supabaseRest, type ApiRequest, type ApiResponse } from '../server/utils.js'

type EventRow = {
  id: string
  title: string
  slug: string
  share_token: string
  event_date: string | null
  venue: string | null
  status: string
  sale_starts_at: string | null
  sale_ends_at: string | null
  original_purge_at: string | null
  originals_purged_at: string | null
  contact_line_url: string | null
  contact_phone: string | null
}
type CategoryRow = {
  id: string
  name: string
  sort_order: number
}
type PhotoRow = {
  id: string
  photo_code: string
  category: string | null
  filename: string
  preview_url: string
  is_visible: boolean
  created_at: string
}
type PhotoAssetRow = {
  photo_id: string
  imagekit_file_id: string | null
  preview_imagekit_file_id: string | null
  original_storage_status: string | null
}
type OrderRow = {
  id: string
  order_number: string
  selected_count: number
  amount_satang: number
  payment_status: string
  payment_slip_path: string | null
  payment_slip_uploaded_at: string | null
  payment_review_note: string | null
  slip_auto_check_note: string | null
  slip_trans_ref: string | null
  created_at: string
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'ADMIN_LOGIN_REQUIRED' })
  try {
    const requestedEventId = queryValue(req.query?.eventId)
    const selection = 'id,title,slug,share_token,event_date,venue,status,sale_starts_at,sale_ends_at,original_purge_at,originals_purged_at,contact_line_url,contact_phone'
    const allEvents = await supabaseRest<EventRow[]>(`event_photo_events?select=${selection}&order=created_at.desc&limit=100`)
    const event = requestedEventId
      ? allEvents.find((item) => item.id === requestedEventId)
      : allEvents[0]
    if (!event) {
      return res.status(200).json({
        event: null,
        events: [],
        categories: [],
        photos: [],
        photoCount: 0,
        orderCount: 0,
        revenue: 0,
        orders: [],
      })
    }

    const [photos, assets, orders, categories] = await Promise.all([
      supabaseRest<PhotoRow[]>(`event_photo_photos?event_id=eq.${event.id}&select=id,photo_code,category,filename,preview_url,is_visible,created_at&order=sort_order.asc,created_at.asc&limit=500`),
      supabaseRest<PhotoAssetRow[]>(`event_photo_photo_assets?event_photo_photos.event_id=eq.${event.id}&select=photo_id,imagekit_file_id,preview_imagekit_file_id,original_storage_status,event_photo_photos!inner(event_id)`),
      supabaseRest<OrderRow[]>(`event_photo_orders?event_id=eq.${event.id}&select=id,order_number,selected_count,amount_satang,payment_status,payment_slip_path,payment_slip_uploaded_at,payment_review_note,slip_auto_check_note,slip_trans_ref,created_at&order=created_at.desc&limit=50`),
      supabaseRest<CategoryRow[]>(`event_photo_categories?event_id=eq.${event.id}&select=id,name,sort_order&order=sort_order.asc,name.asc`),
    ])
    const assetsByPhoto = new Map(assets.map((asset) => [asset.photo_id, asset]))
    const paidOrders = orders.filter((order) => order.payment_status === 'paid')
    return res.status(200).json({
      event,
      events: allEvents,
      categories,
      photos: photos.map((photo) => ({
        id: photo.id,
        code: photo.photo_code,
        category: photo.category,
        filename: photo.filename,
        previewUrl: photo.preview_url,
        isVisible: photo.is_visible,
        createdAt: photo.created_at,
        originalStatus: assetsByPhoto.get(photo.id)?.original_storage_status || 'unknown',
      })),
      photoCount: photos.length,
      orderCount: orders.length,
      revenue: paidOrders.reduce((sum, order) => sum + order.amount_satang, 0) / 100,
      orders: await Promise.all(orders.slice(0, 20).map(async (order) => {
        let slipUrl: string | null = null
        if (order.payment_slip_path) {
          const signed = await supabaseAdmin().storage.from('payment-slips').createSignedUrl(order.payment_slip_path, 10 * 60)
          slipUrl = signed.data?.signedUrl || null
        }
        return {
          id: order.id,
          orderNumber: order.order_number,
          count: order.selected_count,
          total: order.amount_satang / 100,
          paymentStatus: order.payment_status,
          status: order.payment_status === 'paid'
            ? 'ชำระแล้ว'
            : order.payment_status === 'under_review'
              ? 'รอตรวจสลิป'
              : order.payment_status === 'rejected'
                ? 'สลิปไม่ผ่าน'
                : order.payment_status === 'failed'
                  ? 'ไม่สำเร็จ'
                  : 'รอชำระ',
          slipUrl,
          slipUploadedAt: order.payment_slip_uploaded_at,
          reviewNote: order.payment_review_note,
          autoCheckNote: order.slip_auto_check_note,
          transRef: order.slip_trans_ref,
        }
      })),
    })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'ADMIN_DASHBOARD_FAILED' })
  }
}
