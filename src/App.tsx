import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Check,
  Images,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react'
import { AdminDashboard } from './components/admin/AdminDashboard'
import { AlbumLifecycleNotice } from './components/AlbumLifecycleNotice'
import { DownloadPanel } from './components/DownloadPanel'
import { PhotoCard } from './components/PhotoCard'
import { PricingBoard } from './components/PricingBoard'
import { OrderStatusPage } from './components/OrderStatusPage'
import { PromptPayModal } from './components/PromptPayModal'
import { SketchButton } from './components/SketchButton'
import { SketchCard } from './components/SketchCard'
import { categories as mockCategories, event as mockEvent, photos as mockPhotos, type Photo } from './data/mockData'
import { BrandLogo } from './components/BrandLogo'
import { radii } from './lib/designTokens'
import { isEventSaleOpen } from './lib/eventLifecycle'
import { DEFAULT_PRICE_TIERS, MAX_PHOTOS_PER_ORDER, getTierForCount } from './lib/pricing'
import { isLiveMode, runtimeConfig } from './lib/runtimeConfig'
import { fetchAlbums, fetchEventCatalog, type AlbumSummary, type EventCatalog } from './services/catalog'

function StorefrontApp() {
  const [catalog, setCatalog] = useState<EventCatalog>({
    event: mockEvent,
    categories: isLiveMode ? [] : mockCategories,
    tiers: DEFAULT_PRICE_TIERS,
    photos: isLiveMode ? [] : mockPhotos,
  })
  const [albums, setAlbums] = useState<AlbumSummary[]>([])
  const [catalogLoading, setCatalogLoading] = useState(isLiveMode)
  const [catalogError, setCatalogError] = useState('')
  const [category, setCategory] = useState(mockCategories[0])
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set())
  const [preview, setPreview] = useState<Photo | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paid, setPaid] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [limitNotice, setLimitNotice] = useState('')
  const [clock, setClock] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isLiveMode) return
    let cancelled = false
    const load = async () => {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const nextAlbums = await fetchAlbums()
        if (cancelled) return
        setAlbums(nextAlbums)
        const requestedToken = runtimeConfig.eventShareToken || nextAlbums[0]?.shareToken || ''
        if (!requestedToken) {
          setCatalogError('ยังไม่มีอัลบั้มที่เปิดให้แสดง กรุณาสร้างอัลบั้มจากหน้าแอดมิน')
          return
        }
        const next = await fetchEventCatalog(requestedToken)
        if (cancelled) return
        setCatalog(next)
        setCategory(next.categories[0] || 'ทั้งหมด')
      } catch (error) {
        if (!cancelled) setCatalogError(error instanceof Error ? error.message : 'โหลดอัลบั้มไม่สำเร็จ')
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const forceExpiredDemo = !isLiveMode && new URLSearchParams(window.location.search).get('expired') === '1'
  const event = forceExpiredDemo
    ? { ...catalog.event, status: 'expired' as const, saleOpen: false, saleEndsAt: new Date(clock - 60_000).toISOString() }
    : catalog.event
  const saleOpen = isEventSaleOpen(event, clock)
  const categories = catalog.categories
  const photos = catalog.photos
  const priceTiers = catalog.tiers.length ? catalog.tiers : DEFAULT_PRICE_TIERS
  const heroImage = photos[0]?.src || albums.find((album) => album.shareToken === event.shareToken)?.coverUrl || '/photos/photo-hero.svg'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return photos.filter((photo) => {
      const matchCategory = category === 'ทั้งหมด' || photo.category === category
      const matchQuery = !q || photo.code.toLowerCase().includes(q) || photo.category.toLowerCase().includes(q)
      return matchCategory && matchQuery
    })
  }, [category, photos, query])

  const selectedPhotos = useMemo(() => photos.filter((photo) => selectedIds.has(photo.id)), [photos, selectedIds])
  const exactPackage = getTierForCount(priceTiers, selectedIds.size)
  const nextPackage = priceTiers.find((item) => item.count > selectedIds.size)

  useEffect(() => {
    if (saleOpen) return
    const timer = window.setTimeout(() => {
      setSelectedIds(new Set())
      setPaymentOpen(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [saleOpen])

  const togglePhoto = (id: number | string) => {
    if (!saleOpen) return
    if (!selectedIds.has(id) && selectedIds.size >= MAX_PHOTOS_PER_ORDER) {
      setLimitNotice('หนึ่งคำสั่งซื้อเลือกได้สูงสุด 10 รูป')
      window.setTimeout(() => setLimitNotice(''), 2200)
      return
    }
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reset = () => {
    setSelectedIds(new Set())
    setPaid(false)
    setCategory('ทั้งหมด')
    setQuery('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navItems = saleOpen
    ? [
        { id: 'event', label: 'งานล่าสุด' },
        { id: 'gallery', label: 'เลือกรูป' },
        { id: 'how', label: 'วิธีซื้อ' },
        { id: 'pricing', label: 'ราคา' },
      ]
    : [
        { id: 'event', label: 'ข้อมูลงาน' },
        { id: 'gallery', label: 'ดู Preview' },
        { id: 'how', label: 'วิธีสั่งย้อนหลัง' },
      ]

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper text-pencil">
      <header className="sticky top-0 z-50 border-b-2 border-dashed border-pencil/40 bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between px-6 py-1">
          <a href="#top" className="group flex items-center" aria-label="KO’AKE Event Photo หน้าแรก">
            <BrandLogo priority className="h-16 sm:h-[74px] transition-transform duration-100 group-hover:-rotate-1" />
          </a>

          <nav className="hidden items-center gap-7 font-body text-lg md:flex" aria-label="เมนูหลัก">
            {navItems.map((item) => <a key={item.id} className="sketch-link" href={`#${item.id}`}>{item.label}</a>)}
            <SketchButton className="flex items-center gap-2 !px-4 !text-lg" onClick={() => document.querySelector('#gallery')?.scrollIntoView({ behavior: 'smooth' })}>
              <ShoppingBag size={19} strokeWidth={2.7} /> {saleOpen ? 'ซื้อภาพ' : 'ดูรหัสภาพ'}
            </SketchButton>
          </nav>

          <button
            type="button"
            className="grid h-12 w-12 place-items-center border-[3px] border-pencil bg-white shadow-hard md:hidden"
            style={{ borderRadius: radii.blob }}
            onClick={() => setMobileMenu((value) => !value)}
            aria-expanded={mobileMenu}
            aria-label="เปิดเมนู"
          >
            {mobileMenu ? <X size={25} strokeWidth={3} /> : <Menu size={25} strokeWidth={3} />}
          </button>
        </div>
        {mobileMenu && (
          <nav className="border-t-2 border-dashed border-pencil/40 bg-sticky px-6 py-5 font-body text-xl md:hidden">
            <div className="mx-auto grid max-w-5xl gap-3">
              {navItems.map((item) => (
                <a key={item.id} href={`#${item.id}`} onClick={() => setMobileMenu(false)} className="border-b-2 border-dashed border-pencil/25 py-2">
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main id="top">
        {catalogLoading && <div className="mx-auto mt-5 max-w-5xl border-[3px] border-pencil bg-sticky px-5 py-3 font-body text-xl shadow-hard" style={{ borderRadius: radii.wobblyMd }}>กำลังโหลดอัลบั้มจากระบบ…</div>}
        {catalogError && <div className="mx-auto mt-5 max-w-5xl border-[3px] border-marker bg-[#ffe4e4] px-5 py-3 font-body text-xl text-marker shadow-hard" style={{ borderRadius: radii.wobblyMd }}>{catalogError}</div>}
        <section id="event" className="relative mx-auto grid max-w-5xl gap-12 px-6 py-14 md:min-h-[calc(100vh-5rem)] md:grid-cols-[1.08fr_.92fr] md:items-center md:py-16">
          <div className="relative z-10">
            <span className="sticky-tag inline-block -rotate-2">สแกน QR แล้วเลือกรูปได้เลย</span>
            <h1 className="mt-5 font-heading text-[clamp(3.15rem,8vw,5.15rem)] font-bold leading-[.95] [text-wrap:balance]">
              <span className="block">รูปดี ๆ ของวันนี้</span>
              <span className="relative mt-2 inline-block text-marker">
                อย่าปล่อยให้หาย!
                <svg className="absolute -bottom-4 left-0 h-5 w-full" viewBox="0 0 320 22" fill="none" aria-hidden="true">
                  <path d="M4 14C52 2 90 23 139 11C187 0 239 22 316 7" stroke="#2d2d2d" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-8 max-w-xl font-body text-xl leading-relaxed text-pencil/75 md:text-2xl">{event.description}</p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <SketchButton onClick={() => document.querySelector('#gallery')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center justify-center gap-2 text-2xl">
                <Images size={24} strokeWidth={2.8} /> {saleOpen ? 'เปิดอัลบั้ม' : 'ดูภาพตัวอย่าง'}
              </SketchButton>
              <SketchButton variant="secondary" onClick={() => document.querySelector('#how')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center justify-center gap-2 text-2xl">
                ดูวิธีซื้อ <ArrowDown size={23} strokeWidth={2.8} />
              </SketchButton>
            </div>

            <div className="mt-10 flex flex-wrap gap-4 font-body text-lg">
              <span className="sketch-pill"><ShieldCheck size={20} strokeWidth={2.8} /> {saleOpen ? 'จ่ายแล้วโหลดทันที' : 'ยังดูรหัสภาพได้'}</span>
              <span className="sketch-pill"><Sparkles size={20} strokeWidth={2.8} /> {saleOpen ? 'ไฟล์เต็มไม่มีลายน้ำ' : 'ติดต่อช่างภาพเพื่อสั่งซื้อ'}</span>
            </div>
            <AlbumLifecycleNotice event={event} now={clock} />

            <svg className="absolute -right-4 bottom-0 hidden h-32 w-40 rotate-6 md:block" viewBox="0 0 160 120" fill="none" aria-hidden="true">
              <path d="M6 14C65 8 119 35 121 89M121 89L102 68M121 89L141 64" stroke="#ff4d4d" strokeWidth="4" strokeDasharray="8 8" strokeLinecap="round" strokeLinejoin="round" />
              <text x="8" y="112" fontFamily="Patrick Hand" fontSize="18" fill="#2d2d2d">เริ่มตรงนี้!</text>
            </svg>
          </div>

          <div className="relative mx-auto w-full max-w-[390px] md:max-w-[430px]">
            <div className="absolute -left-5 -top-8 hidden h-20 w-20 animate-floaty border-[3px] border-pencil bg-marker md:block" style={{ borderRadius: radii.blob }} />
            <SketchCard decoration="tape" className="rotate-1 bg-sticky p-4 shadow-hard-lg transition-transform hover:-rotate-1">
              <img src={heroImage} alt={event.title} className="aspect-[4/5] w-full object-cover" style={{ borderRadius: radii.wobblyMd }} />
              <div className="p-4 text-center">
                <p className="font-heading text-3xl font-bold">{event.title}</p>
                <p className="mt-1 font-body text-xl text-pencil/65">{event.subtitle}</p>
              </div>
            </SketchCard>
            <div className="absolute -bottom-5 -right-1 grid h-24 w-24 -rotate-6 place-items-center sm:-bottom-7 sm:-right-5 sm:h-28 sm:w-28 border-[3px] border-dashed border-pencil bg-white p-3 text-center font-heading text-xl font-bold shadow-hard" style={{ borderRadius: radii.blob }}>
              {saleOpen ? <>3 รูป<br /><span className="text-3xl text-marker">100฿</span></> : <>หมดอายุ<br /><span className="text-2xl text-marker">ดู Preview</span></>}
            </div>
          </div>
        </section>

        {isLiveMode && (
          <section id="albums" className="border-y-2 border-dashed border-pencil/35 bg-white/65 py-16">
            <div className="mx-auto max-w-5xl px-6">
              <div className="mb-9">
                <p className="font-body text-xl text-marker">สร้างและจัดการจากหน้าแอดมิน</p>
                <h2 className="font-heading text-5xl font-bold md:text-6xl">อัลบั้มทั้งหมด</h2>
                <p className="mt-2 font-body text-xl text-pencil/65">อัลบั้มที่เปิดใช้งานจะปรากฏตรงนี้โดยอัตโนมัติ</p>
              </div>
              {albums.length ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {albums.map((album, index) => (
                    <a
                      key={album.id}
                      href={`/?event=${encodeURIComponent(album.shareToken)}#gallery`}
                      className={`${index % 2 ? 'rotate-[.5deg]' : '-rotate-[.5deg]'} block border-[3px] border-pencil bg-white p-3 shadow-hard transition-transform hover:rotate-0`}
                      style={{ borderRadius: radii.wobblyMd }}
                    >
                      {album.coverUrl ? (
                        <img src={album.coverUrl} alt={album.title} className="aspect-[4/3] w-full object-cover" style={{ borderRadius: radii.wobblySm }} />
                      ) : (
                        <div className="grid aspect-[4/3] place-items-center bg-muted" style={{ borderRadius: radii.wobblySm }}><Images size={48} strokeWidth={2.3} /></div>
                      )}
                      <div className="p-3">
                        <h3 className="font-heading text-3xl font-bold">{album.title}</h3>
                        <p className="mt-1 font-body text-lg text-pencil/65">{[album.eventDate, album.venue].filter(Boolean).join(' · ') || 'ยังไม่ระบุวันที่และสถานที่'}</p>
                        <p className="mt-3 font-body text-lg font-bold text-pen">{album.photoCount.toLocaleString('th-TH')} รูป · เปิดอัลบั้ม</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : !catalogLoading && (
                <SketchCard className="p-8 text-center">
                  <Images className="mx-auto" size={46} strokeWidth={2.4} />
                  <p className="mt-3 font-heading text-3xl font-bold">ยังไม่มีอัลบั้มบนหน้าเว็บไซต์</p>
                  <a href="/?admin=1" className="mt-3 inline-block font-body text-xl font-bold text-pen underline">ไปสร้างอัลบั้มที่หน้าแอดมิน</a>
                </SketchCard>
              )}
            </div>
          </section>
        )}

        <section id="how" className="relative border-y-2 border-dashed border-pencil/35 bg-muted/55 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-12 text-center">
              <p className="font-body text-xl text-pen">ง่ายเหมือนเลือกภาพในมือถือ</p>
              <h2 className="font-heading text-5xl font-bold md:text-6xl">3 ขั้นตอน จบ!</h2>
            </div>
            <div className="relative grid gap-8 md:grid-cols-3">
              <svg className="absolute left-[17%] top-20 hidden h-16 w-[66%] md:block" viewBox="0 0 700 70" preserveAspectRatio="none" fill="none" aria-hidden="true">
                <path d="M5 35C95 2 156 69 250 31C348 -9 407 73 493 30C565 -5 624 64 695 27" stroke="#2d5da1" strokeWidth="4" strokeDasharray="9 9" strokeLinecap="round" />
              </svg>
              {[
                { icon: Search, number: '1', title: 'ค้นหารูป', text: 'เลือกหมวดหรือพิมพ์เลขภาพที่อยู่บนรูปตัวอย่าง' },
                { icon: ShoppingBag, number: '2', title: 'เลือกแพ็ก', text: 'เลือกได้ตั้งแต่ 1–10 รูป ระบบจะคำนวณราคาให้เอง' },
                { icon: Check, number: '3', title: 'จ่ายแล้วโหลด', text: 'สแกน PromptPay และดาวน์โหลดภาพความละเอียดสูง' },
              ].map((step, index) => (
                <SketchCard key={step.number} decoration={index === 1 ? 'tack' : 'tape'} className={`${index === 0 ? '-rotate-1' : index === 2 ? 'rotate-1' : ''} z-10 p-6 text-center transition-transform hover:rotate-1`}>
                  <div className="mx-auto -mt-12 mb-5 grid h-20 w-20 place-items-center border-[3px] border-pencil bg-sticky shadow-hard" style={{ borderRadius: radii.blob }}>
                    <step.icon size={37} strokeWidth={2.7} />
                  </div>
                  <span className="absolute -right-2 -top-3 grid h-10 w-10 place-items-center border-2 border-pencil bg-marker font-heading text-xl font-bold text-white" style={{ borderRadius: radii.blob }}>{step.number}</span>
                  <h3 className="font-heading text-3xl font-bold">{step.title}</h3>
                  <p className="mt-2 font-body text-xl leading-relaxed text-pencil/70">{step.text}</p>
                </SketchCard>
              ))}
            </div>
          </div>
        </section>

        {saleOpen && <PricingBoard tiers={priceTiers} />}

        {!paid ? (
          <section id="gallery" className="mx-auto max-w-5xl px-6 py-20">
            <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-body text-xl text-marker">{saleOpen ? 'อัลบั้มล่าสุด' : 'อัลบั้มย้อนหลัง'}</p>
                <h2 className="font-heading text-5xl font-bold md:text-6xl">{saleOpen ? 'เลือกรูปที่ชอบ' : 'ดู Preview และจดรหัสภาพ'}</h2>
                <p className="mt-2 font-body text-xl text-pencil/65">{saleOpen ? 'ภาพ Preview มีลายน้ำ ไฟล์ที่ซื้อจะไม่มีลายน้ำ · เลือกได้สูงสุด 10 รูปต่อคำสั่งซื้อ' : 'การซื้อออนไลน์ปิดแล้ว แต่ยังค้นหา เปิดดู และส่งรหัสภาพให้ช่างภาพได้'}</p>
              </div>
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" size={24} strokeWidth={2.7} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหา KAE-001 หรือชื่อหมวด"
                  className="min-h-14 w-full border-[3px] border-pencil bg-white py-3 pl-12 pr-4 font-body text-xl shadow-hard outline-none placeholder:text-pencil/35 focus:border-pen focus:ring-2 focus:ring-pen/20"
                  style={{ borderRadius: radii.wobbly }}
                />
              </div>
            </div>

            <div className="mb-10 flex gap-3 overflow-x-auto pb-3">
              {categories.map((item, index) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`min-h-12 shrink-0 border-[3px] border-pencil px-5 font-body text-xl font-bold shadow-hard transition-all duration-100 hover:-rotate-1 active:translate-x-1 active:translate-y-1 active:shadow-none ${category === item ? 'bg-marker text-white' : index % 2 ? 'bg-sticky' : 'bg-white'}`}
                  style={{ borderRadius: radii.wobbly }}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="columns-2 gap-3 sm:columns-3 sm:gap-5 lg:columns-4">
              {filtered.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} selected={selectedIds.has(photo.id)} selectable={saleOpen} onToggle={togglePhoto} onPreview={setPreview} />
              ))}
            </div>

            {filtered.length === 0 && (
              <SketchCard className="mx-auto max-w-xl p-8 text-center">
                <p className="font-heading text-3xl font-bold">ยังไม่เจอรูปนี้นะ</p>
                <p className="mt-2 font-body text-xl text-pencil/65">ลองค้นด้วยเลขรูป หรือเปลี่ยนหมวดดูอีกครั้ง</p>
              </SketchCard>
            )}
          </section>
        ) : (
          <DownloadPanel photos={selectedPhotos} onReset={reset} />
        )}
      </main>

      {saleOpen && !paid && selectedIds.size > 0 && (
        <aside className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex max-w-4xl flex-col gap-3 border-[3px] border-pencil bg-pencil p-3 text-white shadow-[8px_8px_0_#ff4d4d] sm:flex-row sm:items-center" style={{ borderRadius: radii.wobblyMd }} aria-label="ตะกร้าภาพ">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center bg-sticky font-heading text-3xl font-bold text-pencil" style={{ borderRadius: radii.blob }}>{selectedIds.size}</span>
            <div className="min-w-0">
              <p className="font-heading text-2xl font-bold leading-none">รูปที่เลือก</p>
              <p className="truncate font-body text-base text-white/70">
                {exactPackage ? `ราคา ${exactPackage.count} รูป · ${exactPackage.price} บาท${selectedIds.size === MAX_PHOTOS_PER_ORDER ? ' · ครบจำนวนสูงสุดแล้ว' : ''}` : nextPackage ? `เลือกเพิ่มอีก ${nextPackage.count - selectedIds.size} รูป` : 'เลือกได้สูงสุด 10 รูปต่อรายการ'}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setSelectedIds(new Set())} className="min-h-12 px-4 font-body text-xl text-white/80 hover:text-white">ล้าง</button>
          <button
            type="button"
            disabled={!exactPackage}
            onClick={() => setPaymentOpen(true)}
            className="flex min-h-14 items-center justify-center gap-2 border-[3px] border-white bg-marker px-6 font-body text-xl font-bold text-white shadow-[4px_4px_0_#fff] transition-all disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:translate-x-0.5 enabled:hover:translate-y-0.5 enabled:hover:shadow-[2px_2px_0_#fff] active:translate-x-1 active:translate-y-1 active:shadow-none"
            style={{ borderRadius: radii.wobbly }}
          >
            {exactPackage ? `ซื้อ ${exactPackage.count} รูป · ${exactPackage.price}฿` : 'เลือกจำนวนให้ตรงแพ็ก'} <ArrowRight size={22} strokeWidth={2.8} />
          </button>
        </aside>
      )}

      <footer className="border-t-[3px] border-pencil bg-sticky px-6 py-14">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.2fr_.8fr_.8fr]">
          <div>
            <p className="font-heading text-4xl font-bold">KO’AKE Event Photo</p>
            <p className="mt-2 max-w-md font-body text-xl text-pencil/70">ระบบค้นหา เลือกซื้อ และดาวน์โหลดภาพกิจกรรม สำหรับโรงเรียน งานกีฬา งานวิ่ง และอีเวนต์ต่าง ๆ</p>
          </div>
          <div>
            <h3 className="footer-heading">ช่วยเหลือ</h3>
            <div className="mt-3 grid gap-2 font-body text-lg"><a href="#how">วิธีซื้อภาพ</a><a href="#gallery">ค้นหารูป</a><a href="#pricing">ตารางราคา</a><a href="/?admin=1">เข้าสู่หลังบ้าน</a></div>
          </div>
          <div>
            <h3 className="footer-heading">ความปลอดภัย</h3>
            <p className="mt-3 font-body text-lg text-pencil/70">ไฟล์ต้นฉบับจะถูกล็อก และเปิดให้เฉพาะคำสั่งซื้อที่ชำระแล้ว</p>
          </div>
        </div>
      </footer>

      {preview && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-pencil/80 p-4" role="dialog" aria-modal="true" aria-label={`ดูภาพ ${preview.code}`}>
          <button onClick={() => setPreview(null)} className="absolute right-5 top-5 grid h-12 w-12 place-items-center border-[3px] border-white bg-marker text-white shadow-[3px_3px_0_#fff]" style={{ borderRadius: radii.blob }} aria-label="ปิดภาพขยาย"><X size={26} strokeWidth={3} /></button>
          <SketchCard decoration="tape" className="max-h-[88vh] w-full max-w-3xl bg-white p-3">
            <img src={preview.src} alt={preview.code} className="max-h-[75vh] w-full object-contain" style={{ borderRadius: radii.wobblyMd }} />
            <div className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div><p className="font-heading text-3xl font-bold">{preview.code}</p><p className="font-body text-lg text-pencil/60">{preview.category}</p></div>
              {saleOpen ? (
                <SketchButton onClick={() => { togglePhoto(preview.id); setPreview(null) }} className="flex items-center gap-2">
                  {selectedIds.has(preview.id) ? <Check size={22} strokeWidth={3} /> : <ShoppingBag size={22} strokeWidth={2.8} />}
                  {selectedIds.has(preview.id) ? 'เลือกแล้ว' : 'เลือกรูปนี้'}
                </SketchButton>
              ) : (
                <div className="border-2 border-dashed border-pencil bg-sticky px-4 py-2 text-right font-body text-lg" style={{ borderRadius: radii.wobblySm }}>
                  ส่งรหัส <b>{preview.code}</b> ให้ช่างภาพเพื่อสอบถาม
                </div>
              )}
            </div>
          </SketchCard>
        </div>
      )}

      {limitNotice && <div className="fixed left-1/2 top-24 z-[110] -translate-x-1/2 border-[3px] border-pencil bg-sticky px-5 py-3 font-body text-xl font-bold shadow-hard" style={{ borderRadius: radii.wobblyMd }}>{limitNotice}</div>}

      <PromptPayModal
        open={paymentOpen && saleOpen}
        tier={exactPackage}
        selectedIds={[...selectedIds]}
        onClose={() => setPaymentOpen(false)}
        onPaid={() => {
          setPaymentOpen(false)
          setPaid(true)
          setTimeout(() => document.querySelector('#downloads')?.scrollIntoView({ behavior: 'smooth' }), 80)
        }}
      />
    </div>
  )
}

function App() {
  const params = new URLSearchParams(window.location.search)
  const isAdmin = params.get('admin') === '1'
  const orderToken = params.get('order')
  if (isAdmin) return <AdminDashboard />
  if (orderToken) return <OrderStatusPage token={orderToken} />
  return <StorefrontApp />
}

export default App
