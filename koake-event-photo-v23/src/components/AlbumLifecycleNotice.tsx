import { Archive, Clock3, MessageCircle, Phone, ShieldCheck } from 'lucide-react'
import type { EventLifecycleFields } from '../lib/eventLifecycle'
import { formatThaiDateTime, getSaleCountdownLabel, isEventSaleOpen } from '../lib/eventLifecycle'
import { radii } from '../lib/designTokens'
import { SketchButton } from './SketchButton'
import { SketchCard } from './SketchCard'

export function AlbumLifecycleNotice({ event, now }: { event: EventLifecycleFields; now: number }) {
  const saleOpen = isEventSaleOpen(event, now)
  const startsAt = event.saleStartsAt ? new Date(event.saleStartsAt).getTime() : 0
  const scheduled = !saleOpen && startsAt > now && (event.status === 'active' || event.status === 'reactivated' || event.status === 'published')

  if (scheduled) {
    return (
      <div className="mt-6 inline-flex flex-wrap items-center gap-3 border-[3px] border-pencil bg-sticky px-4 py-3 font-body text-lg font-bold shadow-hard" style={{ borderRadius: radii.wobblyMd }}>
        <Clock3 size={22} strokeWidth={2.8} />
        <span>อัลบั้มกำลังเตรียมเปิดขาย</span>
        <span className="text-pencil/60">เริ่ม {formatThaiDateTime(event.saleStartsAt)}</span>
      </div>
    )
  }

  if (saleOpen) {
    return (
      <div
        className="mt-6 inline-flex flex-wrap items-center gap-3 border-[3px] border-pencil bg-[#d9f7df] px-4 py-3 font-body text-lg font-bold shadow-hard"
        style={{ borderRadius: radii.wobblyMd }}
      >
        <Clock3 size={22} strokeWidth={2.8} />
        <span>เปิดขายออนไลน์ · {getSaleCountdownLabel(event.saleEndsAt, now)}</span>
        <span className="text-pencil/60">ปิดขาย {formatThaiDateTime(event.saleEndsAt)}</span>
      </div>
    )
  }

  const originalPurged = Boolean(event.originalsPurgedAt) || event.status === 'purged'

  return (
    <SketchCard decoration="tape" className="mt-8 border-marker bg-[#fff2f2] p-6 shadow-hard-lg">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center border-[3px] border-pencil bg-sticky shadow-hard" style={{ borderRadius: radii.blob }}>
            <Archive size={32} strokeWidth={2.7} />
          </div>
          <div>
            <p className="font-heading text-3xl font-bold text-marker">หมดเวลาสั่งซื้อออนไลน์แล้ว</p>
            <p className="mt-1 max-w-2xl font-body text-xl leading-relaxed text-pencil/75">
              ยังเปิดดูภาพตัวอย่างและรหัสภาพได้ตามปกติ หากต้องการซื้อ กรุณาส่งรหัสภาพให้ช่างภาพโดยตรง
            </p>
            <p className="mt-2 inline-flex items-center gap-2 font-body text-lg text-pen">
              <ShieldCheck size={20} strokeWidth={2.8} />
              {originalPurged
                ? 'ไฟล์ต้นฉบับถูกย้ายออกจากพื้นที่ออนไลน์แล้ว ช่างภาพจะตรวจไฟล์สำรองให้ก่อนยืนยันคำสั่งซื้อ'
                : `ไฟล์ต้นฉบับออนไลน์มีกำหนดเก็บถึง ${formatThaiDateTime(event.originalPurgeAt)}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
          {event.contactLineUrl && (
            <a href={event.contactLineUrl} target="_blank" rel="noreferrer">
              <SketchButton className="flex w-full items-center justify-center gap-2 whitespace-nowrap">
                <MessageCircle size={22} strokeWidth={2.8} /> ติดต่อผ่าน LINE
              </SketchButton>
            </a>
          )}
          {event.contactPhone && (
            <a href={`tel:${event.contactPhone}`}>
              <SketchButton variant="secondary" className="flex w-full items-center justify-center gap-2 whitespace-nowrap">
                <Phone size={22} strokeWidth={2.8} /> {event.contactPhone}
              </SketchButton>
            </a>
          )}
        </div>
      </div>
    </SketchCard>
  )
}
