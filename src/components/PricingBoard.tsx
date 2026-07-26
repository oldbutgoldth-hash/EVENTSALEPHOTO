import { BadgePercent, Check, Images } from 'lucide-react'
import type { PriceTier } from '../lib/pricing'
import { formatBaht, unitPrice } from '../lib/pricing'
import { radii } from '../lib/designTokens'
import { SketchCard } from './SketchCard'

export function PricingBoard({ tiers }: { tiers: PriceTier[] }) {
  return (
    <section id="pricing" className="border-y-2 border-dashed border-pencil/35 bg-sticky/45 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="sticky-tag inline-flex -rotate-2 items-center gap-2"><BadgePercent size={20} strokeWidth={2.8} /> ยิ่งเลือกหลายรูป ยิ่งคุ้ม</span>
          <h2 className="mt-5 font-heading text-5xl font-bold md:text-6xl">ราคา 1–10 รูป</h2>
          <p className="mt-3 font-body text-xl text-pencil/70">ระบบคิดราคาตามจำนวนที่เลือกทันที ไม่ต้องจำโค้ดส่วนลด</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {tiers.map((tier, index) => {
            const featured = tier.count === 3 || tier.count === 10
            return (
              <SketchCard
                key={tier.count}
                decoration={tier.count === 3 ? 'tack' : index % 3 === 0 ? 'tape' : undefined}
                className={`${featured ? 'bg-white shadow-hard-lg md:-translate-y-2' : 'bg-paper'} ${index % 2 ? 'rotate-[.6deg]' : '-rotate-[.5deg]'} p-4 text-center transition-transform hover:rotate-1`}
              >
                {featured && (
                  <span className="absolute -right-2 -top-3 border-2 border-pencil bg-marker px-2 py-1 font-body text-sm font-bold text-white" style={{ borderRadius: radii.wobblySm }}>
                    {tier.count === 3 ? 'ยอดนิยม' : 'คุ้มสุด'}
                  </span>
                )}
                <div className="mx-auto grid h-12 w-12 place-items-center border-2 border-pencil bg-sticky" style={{ borderRadius: radii.blob }}>
                  <Images size={25} strokeWidth={2.7} />
                </div>
                <p className="mt-3 font-heading text-3xl font-bold">{tier.count} รูป</p>
                <p className="font-heading text-3xl font-bold text-marker">{formatBaht(tier.price)}</p>
                <p className="font-body text-base text-pencil/55">เฉลี่ย {Math.round(unitPrice(tier))}฿/รูป</p>
                <p className="mt-2 inline-flex items-center gap-1 font-body text-sm text-pen"><Check size={15} strokeWidth={3} /> {tier.label}</p>
              </SketchCard>
            )
          })}
        </div>
      </div>
    </section>
  )
}
