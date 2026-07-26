import { useEffect, useState } from 'react'
import { Clock3, Download, RefreshCw, X } from 'lucide-react'
import { radii } from '../lib/designTokens'
import { forgetOrder, getRememberedOrders, type RememberedOrder } from '../lib/orderMemory'
import { SketchCard } from './SketchCard'

type OrderSnapshot = RememberedOrder & {
  paymentStatus?: string
  loading: boolean
}

const statusLabel: Record<string, string> = {
  unpaid: 'รอชำระเงิน',
  processing: 'กำลังตรวจสอบ',
  under_review: 'ส่งสลิปแล้ว รอช่างภาพตรวจสอบ',
  paid: 'ชำระแล้ว ดาวน์โหลดได้เลย',
  failed: 'ทำรายการไม่สำเร็จ',
  rejected: 'สลิปไม่ผ่าน กรุณาอัปโหลดใหม่',
  refunded: 'คืนเงินแล้ว',
}

// Reminds a returning customer which orders they still have pending on this
// browser (e.g. paid but waiting for admin approval), in case they closed the
// tab before downloading their photos. Stored client-side only — no account
// or login is required.
export function PendingOrdersBanner() {
  const [orders, setOrders] = useState<OrderSnapshot[]>([])

  useEffect(() => {
    const remembered = getRememberedOrders()
    if (!remembered.length) return
    setOrders(remembered.map((item) => ({ ...item, loading: true })))
    remembered.forEach(async (item) => {
      try {
        const response = await fetch(`/api/order-status?token=${encodeURIComponent(item.token)}`, { cache: 'no-store' })
        if (response.status === 404) {
          forgetOrder(item.token)
          setOrders((current) => current.filter((order) => order.token !== item.token))
          return
        }
        const payload = (await response.json().catch(() => ({}))) as { paymentStatus?: string }
        setOrders((current) => current.map((order) => order.token === item.token
          ? { ...order, loading: false, paymentStatus: payload.paymentStatus }
          : order))
      } catch {
        setOrders((current) => current.map((order) => order.token === item.token ? { ...order, loading: false } : order))
      }
    })
  }, [])

  const dismiss = (token: string) => {
    forgetOrder(token)
    setOrders((current) => current.filter((order) => order.token !== token))
  }

  if (!orders.length) return null

  return (
    <div className="mx-auto mt-5 max-w-5xl px-6">
      <SketchCard decoration="tape" className="p-5">
        <div className="flex items-center gap-2"><Clock3 size={22} strokeWidth={2.7} /><h2 className="font-heading text-2xl font-bold">คำสั่งซื้อของคุณที่ยังไม่เสร็จ</h2></div>
        <div className="mt-4 grid gap-3">
          {orders.map((order) => (
            <div key={order.token} className="flex flex-wrap items-center justify-between gap-3 border-2 border-dashed border-pencil/40 bg-paper p-3" style={{ borderRadius: radii.wobblySm }}>
              <div className="min-w-0">
                <p className="font-body text-lg font-bold">{order.orderNumber}</p>
                <p className="font-body text-base text-pencil/60">
                  {order.loading ? 'กำลังตรวจสอบสถานะ…' : statusLabel[order.paymentStatus || ''] || 'ไม่ทราบสถานะ'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={`/?order=${encodeURIComponent(order.token)}`} className="admin-mini-button">
                  {order.paymentStatus === 'paid' ? <Download size={17} /> : <RefreshCw size={17} />}
                  {order.paymentStatus === 'paid' ? 'ไปดาวน์โหลด' : 'ตรวจสถานะ'}
                </a>
                <button type="button" onClick={() => dismiss(order.token)} aria-label="ลบออกจากรายการนี้" className="grid h-9 w-9 place-items-center border-2 border-pencil bg-white" style={{ borderRadius: radii.blob }}>
                  <X size={16} strokeWidth={2.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SketchCard>
    </div>
  )
}
