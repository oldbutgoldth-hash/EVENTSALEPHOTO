import { useState } from 'react'
import { ArrowRight, LoaderCircle, Phone, ShieldCheck, Upload, X } from 'lucide-react'
import type { PriceTier } from '../lib/pricing'
import { formatBaht } from '../lib/pricing'
import { isLiveMode } from '../lib/runtimeConfig'
import { rememberOrder } from '../lib/orderMemory'
import { createLiveCheckout } from '../services/checkout'
import { SketchButton } from './SketchButton'
import { SketchCard } from './SketchCard'
import { radii } from '../lib/designTokens'

type Props = {
  open: boolean
  tier?: PriceTier
  selectedIds: Array<number | string>
  shareToken: string
  onClose: () => void
  onPaid: () => void
}

export function PromptPayModal({ open, tier, selectedIds, shareToken, onClose, onPaid }: Props) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open || !tier) return null

  const createOrder = async () => {
    if (!isLiveMode) {
      onPaid()
      return
    }
    if (!shareToken) {
      setError('ไม่พบอัลบั้มนี้ในระบบ กรุณาเปิดลิงก์อัลบั้มใหม่อีกครั้ง')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await createLiveCheckout({
        shareToken,
        photoIds: selectedIds,
        tier,
        buyerPhone: phone,
      })
      rememberOrder({ token: result.publicToken, orderNumber: result.orderNumber, createdAt: new Date().toISOString() })
      window.location.assign(result.checkoutUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'สร้างคำสั่งซื้อไม่สำเร็จ')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-pencil/70 p-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="payment-title">
      <SketchCard decoration="tape" className="my-5 w-full max-w-md p-6 md:p-8">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-11 w-11 place-items-center border-2 border-pencil bg-white shadow-[2px_2px_0_#2d2d2d] transition-transform hover:rotate-6" style={{ borderRadius: radii.blob }} aria-label="ปิดหน้าชำระเงิน">
          <X size={22} strokeWidth={3} />
        </button>

        <p className="sticky-tag mb-3 inline-block -rotate-2">พร้อมเพย์ + แนบสลิป</p>
        <h2 id="payment-title" className="pr-10 font-heading text-4xl font-bold leading-tight">ยืนยันรายการที่เลือก</h2>
        <p className="mt-2 font-body text-xl text-pencil/70">แพ็ก {tier.count} รูป · ยอดชำระ {formatBaht(tier.price)}</p>
        <p className="mt-1 font-body text-base text-pencil/50">ยอดจริงหน้าชำระเงินจะมีเศษสตางค์เพิ่มเล็กน้อย (เช่น .12 บาท) เพื่อให้ตรวจสลิปง่ายขึ้น</p>

        <div className="my-6 grid gap-3">
          {[
            { icon: ArrowRight, text: 'สร้างคำสั่งซื้อและแสดง QR พร้อมเพย์ตามยอดจริง' },
            { icon: Upload, text: 'อัปโหลดภาพสลิป JPG, PNG หรือ WebP ไม่เกิน 6 MB' },
            { icon: ShieldCheck, text: 'ช่างภาพตรวจสลิป แล้วระบบจะเปิดไฟล์เต็มให้ดาวน์โหลด' },
          ].map((item) => (
            <div key={item.text} className="flex gap-3 border-2 border-dashed border-pencil/45 bg-paper p-3 font-body text-lg" style={{ borderRadius: radii.wobblySm }}>
              <item.icon className="mt-0.5 shrink-0" size={22} strokeWidth={2.7} />
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        <label className="block font-body text-lg">
          <span className="mb-1 flex items-center gap-2"><Phone size={18} strokeWidth={2.7} /> เบอร์โทรสำหรับค้นหาคำสั่งซื้อ</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="เช่น 0812345678" className="admin-input" />
        </label>

        {error && <p role="alert" className="mt-4 border-2 border-marker bg-[#ffe4e4] p-3 font-body text-lg text-marker" style={{ borderRadius: radii.wobblySm }}>{error}</p>}
        <SketchButton disabled={busy} onClick={createOrder} className="mt-6 flex w-full items-center justify-center gap-2">
          {busy ? <LoaderCircle className="animate-spin" size={23} strokeWidth={2.8} /> : <ArrowRight size={23} strokeWidth={2.8} />}
          {busy ? 'กำลังสร้างคำสั่งซื้อ…' : isLiveMode ? 'ไปหน้าชำระเงินและแนบสลิป' : 'จำลองชำระสำเร็จ'}
        </SketchButton>
      </SketchCard>
    </div>
  )
}
