import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Download, ImagePlus, LoaderCircle, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { radii } from '../lib/designTokens'
import { formatBahtExact } from '../lib/pricing'
import { uploadPaymentSlip } from '../services/payment'
import { QrCodeImage } from './QrCodeImage'
import { SketchButton } from './SketchButton'
import { SketchCard } from './SketchCard'

type PaymentStatus = 'unpaid' | 'processing' | 'under_review' | 'paid' | 'failed' | 'rejected' | 'refunded'

type OrderState = {
  orderNumber: string
  eventTitle: string
  paymentStatus: PaymentStatus
  amount: number
  downloadExpiresAt: string | null
  slipUploadedAt: string | null
  reviewNote: string | null
  promptPayPayload: string | null
  promptPayAccountName: string
  photos: Array<{ id: string; code: string; src: string; filename: string }>
}

export function OrderStatusPage({ token }: { token: string }) {
  const [state, setState] = useState<OrderState | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [slip, setSlip] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const slipPreview = useMemo(() => slip ? URL.createObjectURL(slip) : '', [slip])

  useEffect(() => () => { if (slipPreview) URL.revokeObjectURL(slipPreview) }, [slipPreview])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const load = async () => {
      try {
        const response = await fetch(`/api/order-status?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
        const payload = (await response.json().catch(() => ({}))) as OrderState & { error?: string }
        if (!response.ok) throw new Error(payload.error || 'ตรวจสอบคำสั่งซื้อไม่สำเร็จ')
        if (cancelled) return
        setState(payload)
        setError('')
        if (payload.paymentStatus === 'under_review' || payload.paymentStatus === 'processing') {
          timer = window.setTimeout(load, 10000)
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'ตรวจสอบคำสั่งซื้อไม่สำเร็จ')
      }
    }
    load()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [token, reloadKey])

  const submitSlip = async () => {
    if (!slip) return
    setUploading(true)
    setUploadError('')
    try {
      await uploadPaymentSlip(token, slip)
      setSlip(null)
      setReloadKey((value) => value + 1)
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'อัปโหลดสลิปไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  const awaitingSlip = state && ['unpaid', 'rejected', 'failed'].includes(state.paymentStatus)

  return (
    <main className="min-h-screen bg-paper px-5 py-8 text-pencil sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="inline-flex min-h-12 items-center gap-2 border-[3px] border-pencil bg-white px-4 font-body text-lg font-bold shadow-hard" style={{ borderRadius: radii.wobbly }}><ArrowLeft size={20} strokeWidth={2.8} /> กลับหน้าร้าน</a>

        {!state && !error && (
          <SketchCard decoration="tape" className="mx-auto mt-16 max-w-xl p-10 text-center">
            <LoaderCircle className="mx-auto animate-spin" size={52} strokeWidth={2.4} />
            <h1 className="mt-5 font-heading text-5xl font-bold">กำลังโหลดคำสั่งซื้อ</h1>
          </SketchCard>
        )}

        {error && (
          <SketchCard decoration="tack" className="mx-auto mt-16 max-w-xl bg-[#ffe4e4] p-8 text-center">
            <h1 className="font-heading text-4xl font-bold text-marker">ตรวจสอบไม่สำเร็จ</h1>
            <p className="mt-3 font-body text-xl">{error}</p>
            <SketchButton onClick={() => setReloadKey((value) => value + 1)} className="mt-6 inline-flex items-center gap-2"><RefreshCw size={20} /> ลองใหม่</SketchButton>
          </SketchCard>
        )}

        {awaitingSlip && (
          <section className="mx-auto mt-10 grid max-w-4xl gap-7 lg:grid-cols-[.9fr_1.1fr]">
            <SketchCard decoration="tape" className="p-6 text-center">
              <p className="font-body text-lg text-marker">คำสั่งซื้อ {state.orderNumber}</p>
              <h1 className="mt-1 font-heading text-4xl font-bold">สแกนพร้อมเพย์</h1>
              <p className="font-body text-xl text-pencil/65">{state.promptPayAccountName}</p>
              {state.promptPayPayload && <QrCodeImage value={state.promptPayPayload} className="mx-auto mt-5 aspect-square w-full max-w-[280px] border-[3px] border-pencil bg-white p-3 shadow-hard" />}
              <div className="mx-auto mt-5 max-w-xs border-2 border-dashed border-pencil bg-sticky p-4" style={{ borderRadius: radii.wobblySm }}>
                <p className="font-body text-lg">ยอดที่ต้องชำระ</p>
                <p className="font-heading text-5xl font-bold text-marker">{formatBahtExact(state.amount)}</p>
              </div>
              <p className="mt-4 font-body text-lg text-pencil/60">โอนตามยอดนี้ให้ตรงทศนิยมทุกสตางค์ เพื่อให้ช่างภาพตรวจสอบสลิปได้ง่ายและรวดเร็วขึ้น</p>
            </SketchCard>

            <SketchCard decoration="tack" className="p-6">
              <div className="flex items-center gap-3"><ImagePlus size={30} strokeWidth={2.7} /><h2 className="font-heading text-4xl font-bold">แนบสลิปโอนเงิน</h2></div>
              {state.paymentStatus === 'rejected' && (
                <div className="mt-4 border-2 border-marker bg-[#ffe4e4] p-4 font-body text-lg" style={{ borderRadius: radii.wobblySm }}>
                  <p className="flex items-center gap-2 font-bold text-marker"><AlertCircle size={21} /> สลิปเดิมไม่ผ่านการตรวจสอบ</p>
                  <p className="mt-1">{state.reviewNote || 'กรุณาตรวจสอบยอดและอัปโหลดสลิปใหม่'}</p>
                </div>
              )}
              <label className="mt-5 grid cursor-pointer place-items-center border-[3px] border-dashed border-pencil bg-white p-5 text-center transition-colors hover:bg-sticky" style={{ borderRadius: radii.wobbly }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null
                    setUploadError('')
                    if (file && file.size > 6 * 1024 * 1024) setUploadError('ไฟล์สลิปต้องไม่เกิน 6 MB')
                    else setSlip(file)
                  }}
                />
                {slipPreview ? <img src={slipPreview} alt="ตัวอย่างสลิป" className="max-h-72 w-full object-contain" /> : <><Upload size={42} strokeWidth={2.2} /><b className="mt-2 font-heading text-2xl">แตะเพื่อเลือกรูปสลิป</b><span className="font-body text-lg text-pencil/60">JPG, PNG หรือ WebP · ไม่เกิน 6 MB</span></>}
              </label>
              {slip && <p className="mt-3 break-all font-body text-lg">{slip.name} · {(slip.size / 1024 / 1024).toFixed(2)} MB</p>}
              {uploadError && <p role="alert" className="mt-3 font-body text-lg text-marker">{uploadError}</p>}
              <SketchButton disabled={!slip || uploading} onClick={submitSlip} className="mt-5 flex w-full items-center justify-center gap-2">
                {uploading ? <LoaderCircle className="animate-spin" size={22} /> : <ShieldCheck size={22} />}
                {uploading ? 'กำลังส่งสลิป…' : 'ส่งสลิปให้ช่างภาพตรวจ'}
              </SketchButton>
              <p className="mt-3 text-center font-body text-base text-pencil/55">สลิปจะถูกเก็บแบบ private และใช้เพื่อตรวจสอบคำสั่งซื้อนี้เท่านั้น</p>
            </SketchCard>
          </section>
        )}

        {state && ['under_review', 'processing'].includes(state.paymentStatus) && (
          <SketchCard decoration="tape" className="mx-auto mt-16 max-w-xl bg-sticky p-8 text-center">
            <Clock3 className="mx-auto" size={52} strokeWidth={2.5} />
            <p className="mt-3 font-body text-xl text-marker">คำสั่งซื้อ {state.orderNumber}</p>
            <h1 className="font-heading text-5xl font-bold">ได้รับสลิปแล้ว</h1>
            <p className="mt-3 font-body text-xl text-pencil/65">กำลังรอช่างภาพตรวจสอบ หน้านี้จะอัปเดตอัตโนมัติทุก 10 วินาที</p>
            <SketchButton onClick={() => setReloadKey((value) => value + 1)} className="mt-6 inline-flex items-center gap-2"><RefreshCw size={20} /> ตรวจสถานะตอนนี้</SketchButton>
          </SketchCard>
        )}

        {state?.paymentStatus === 'paid' && (
          <section className="mt-12">
            <div className="text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center border-[3px] border-pencil bg-[#d9f7df] shadow-hard" style={{ borderRadius: radii.blob }}><CheckCircle2 size={44} strokeWidth={2.5} /></div>
              <p className="mt-4 font-body text-xl text-marker">อนุมัติการชำระเงินแล้ว · {state.orderNumber}</p>
              <h1 className="font-heading text-5xl font-bold md:text-6xl">ดาวน์โหลดภาพได้แล้ว!</h1>
              <p className="mx-auto mt-3 max-w-2xl font-body text-xl text-pencil/65">ไฟล์ต้นฉบับไม่มีลายน้ำ ลิงก์ดาวน์โหลดแต่ละครั้งมีอายุสั้นเพื่อป้องกันการแชร์โดยไม่ได้รับอนุญาต</p>
            </div>
            <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {state.photos.map((photo, index) => (
                <SketchCard key={photo.id} decoration={index % 2 ? 'tack' : 'tape'} className={`${index % 2 ? 'rotate-[.5deg]' : '-rotate-[.5deg]'} p-3`}>
                  <img src={photo.src} alt={photo.code} className="aspect-[4/5] w-full object-cover" style={{ borderRadius: radii.wobblySm }} />
                  <div className="p-3">
                    <p className="font-heading text-2xl font-bold">{photo.code}</p>
                    <a href={`/api/download?orderToken=${encodeURIComponent(token)}&photoId=${encodeURIComponent(photo.id)}`} className="mt-3 flex min-h-12 items-center justify-center gap-2 border-[3px] border-pencil bg-white font-body text-xl font-bold shadow-hard transition-all hover:bg-pen hover:text-white" style={{ borderRadius: radii.wobbly }}>
                      <Download size={22} strokeWidth={2.8} /> ดาวน์โหลดไฟล์เต็ม
                    </a>
                  </div>
                </SketchCard>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
