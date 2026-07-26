import { Archive, Check, Plus, ZoomIn } from 'lucide-react'
import type { Photo } from '../data/mockData'
import { radii } from '../lib/designTokens'

type Props = {
  photo: Photo
  selected: boolean
  selectable?: boolean
  onToggle: (id: number | string) => void
  onPreview: (photo: Photo) => void
}

export function PhotoCard({ photo, selected, selectable = true, onToggle, onPreview }: Props) {
  return (
    <article
      style={{ borderRadius: radii.wobblyMd }}
      className={`group relative mb-6 break-inside-avoid border-[3px] border-pencil bg-white p-2 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:rotate-[.5deg] ${selected ? '-rotate-1 bg-sticky shadow-hard-lg' : 'rotate-[0.35deg] shadow-hard'}`}
    >
      <div className="relative overflow-hidden" style={{ borderRadius: radii.wobblySm }}>
        <img
          src={photo.src}
          alt={`ภาพตัวอย่าง ${photo.code}`}
          className={`w-full object-cover ${photo.orientation === 'portrait' ? 'aspect-[4/5]' : 'aspect-[4/3]'}`}
          loading="lazy"
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center -rotate-12 text-center font-heading text-2xl font-bold tracking-[0.12em] text-white/65 [text-shadow:2px_2px_0_#2d2d2d]">
          KO’AKE<br />PREVIEW
        </span>
        {!selectable && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 border-2 border-pencil bg-sticky px-2 py-1 font-body text-sm font-bold shadow-[2px_2px_0_#2d2d2d]" style={{ borderRadius: radii.wobblySm }}>
            <Archive size={15} strokeWidth={2.8} /> Preview เท่านั้น
          </span>
        )}
        <button
          type="button"
          onClick={() => onPreview(photo)}
          aria-label={`ขยายภาพ ${photo.code}`}
          className="absolute bottom-2 right-2 grid h-11 w-11 place-items-center border-2 border-pencil bg-white shadow-[2px_2px_0_#2d2d2d] transition-transform hover:-rotate-6"
          style={{ borderRadius: radii.blob }}
        >
          <ZoomIn size={21} strokeWidth={2.8} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 px-1 pb-1 pt-3">
        <div>
          <p className="font-heading text-xl font-bold leading-none">{photo.code}</p>
          <p className="mt-1 font-body text-base text-pencil/60">{photo.category}</p>
        </div>
        {selectable ? (
          <button
            type="button"
            onClick={() => onToggle(photo.id)}
            aria-pressed={selected}
            className={`grid h-12 w-12 place-items-center border-[3px] border-pencil transition-all duration-100 active:translate-x-1 active:translate-y-1 active:shadow-none ${selected ? 'bg-marker text-white shadow-[2px_2px_0_#2d2d2d]' : 'bg-white shadow-hard hover:bg-sticky'}`}
            style={{ borderRadius: radii.blob }}
          >
            {selected ? <Check size={25} strokeWidth={3} /> : <Plus size={25} strokeWidth={3} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onPreview(photo)}
            className="grid h-12 w-12 place-items-center border-[3px] border-pencil bg-muted text-pencil/65 shadow-hard"
            style={{ borderRadius: radii.blob }}
            aria-label={`ดูรหัสภาพ ${photo.code}`}
          >
            <ZoomIn size={23} strokeWidth={2.8} />
          </button>
        )}
      </div>
    </article>
  )
}
