import { Download, Images, RotateCcw } from 'lucide-react'
import type { Photo } from '../data/mockData'
import { SketchButton } from './SketchButton'
import { SketchCard } from './SketchCard'

export function DownloadPanel({ photos, onReset }: { photos: Photo[]; onReset: () => void }) {
  return (
    <section id="downloads" className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center border-[3px] border-pencil bg-sticky shadow-hard [border-radius:43%_57%_38%_62%/55%_38%_62%_45%]">
          <Images size={42} strokeWidth={2.6} />
        </div>
        <p className="font-body text-xl text-marker">ชำระเงินเรียบร้อย</p>
        <h2 className="font-heading text-5xl font-bold md:text-6xl">รูปของคุณพร้อมแล้ว!</h2>
        <p className="mx-auto mt-3 max-w-2xl font-body text-xl text-pencil/70">ระบบจริงจะเปิด Signed URL ของไฟล์ต้นฉบับเฉพาะรูปที่ซื้อ และกำหนดวันหมดอายุดาวน์โหลด</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {photos.map((photo, index) => (
          <SketchCard key={photo.id} decoration={index % 2 ? 'tack' : 'tape'} className={`${index % 2 ? 'rotate-1' : '-rotate-1'} p-3`}>
            <img src={photo.src} alt={photo.code} className="aspect-[4/5] w-full object-cover [border-radius:20px_7px_23px_9px/8px_24px_9px_21px]" />
            <div className="p-3">
              <p className="font-heading text-2xl font-bold">{photo.code}.JPG</p>
              <button className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 border-[3px] border-pencil bg-white font-body text-xl font-bold shadow-hard transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-pen hover:text-white hover:shadow-[2px_2px_0_#2d2d2d] active:translate-x-1 active:translate-y-1 active:shadow-none [border-radius:255px_15px_225px_15px/15px_225px_15px_255px]">
                <Download size={22} strokeWidth={2.8} /> ดาวน์โหลดไฟล์เต็ม
              </button>
            </div>
          </SketchCard>
        ))}
      </div>

      <div className="mt-12 text-center">
        <SketchButton variant="secondary" onClick={onReset} className="inline-flex items-center gap-2">
          <RotateCcw size={21} strokeWidth={2.8} /> ทดลองเลือกใหม่
        </SketchButton>
      </div>
    </section>
  )
}
