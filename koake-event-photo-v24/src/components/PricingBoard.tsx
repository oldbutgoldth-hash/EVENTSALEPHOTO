import { BadgePercent } from 'lucide-react'
import type { PriceTier } from '../lib/pricing'
import { formatBaht } from '../lib/pricing'
import { radii } from '../lib/designTokens'

export function PricingBoard({ tiers }: { tiers: PriceTier[] }) {
  return (
    <section id="pricing" className="border-y-2 border-dashed border-pencil/35 bg-sticky/45 py-10">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="sticky-tag inline-flex -rotate-1 items-center gap-2 !px-3 !py-1 text-base"><BadgePercent size={16} strokeWidth={2.8} /> ยิ่งเลือกหลายรูป ยิ่งคุ้ม</span>
            <h2 className="mt-2 font-heading text-3xl font-bold md:text-4xl">ราคา 1–10 รูป</h2>
          </div>
          <p className="max-w-xs font-body text-base text-pencil/60">เลื่อนดูราคาแต่ละแพ็ก ระบบคิดราคาให้อัตโนมัติตามจำนวนที่เลือก</p>
        </div>

        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
          {tiers.map((tier) => {
            const featured = tier.count === 3 || tier.count === 10
            return (
              <div
                key={tier.count}
                className={`relative mt-3 shrink-0 border-2 border-pencil px-5 py-3 text-center transition-transform duration-150 ease-out hover:-translate-y-0.5 ${featured ? 'bg-white shadow-hard' : 'bg-white/85 shadow-hard-soft'}`}
                style={{ borderRadius: radii.wobbly }}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap border-2 border-dashed border-pencil bg-paper px-2 py-0.5 font-body text-xs font-bold">
                    {tier.count === 3 ? 'ยอดนิยม' : 'คุ้มสุด'}
                  </span>
                )}
                <p className="font-heading text-lg font-bold leading-none">{tier.count} รูป</p>
                <p className="mt-1 font-heading text-xl font-bold text-marker">{formatBaht(tier.price)}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
