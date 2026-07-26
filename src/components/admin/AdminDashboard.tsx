import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  Clock3,
  CheckCircle2,
  CloudUpload,
  Copy,
  Database,
  ExternalLink,
  Image as ImageIcon,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldCheck,
  PackageCheck,
  QrCode,
  RefreshCw,
  Save,
  Settings2,
  ShoppingCart,
  Trash2,
  XCircle,
} from 'lucide-react'
import { DEFAULT_PRICE_TIERS, formatBaht } from '../../lib/pricing'
import { addDaysToLocalDateTime, addHoursToLocalDateTime, formatThaiDateTime, localDateTimeToIso, toDateTimeLocal, type EventLifecycleStatus } from '../../lib/eventLifecycle'
import { deleteCategory, deleteEvent, renameCategory, saveEvent } from '../../services/admin'
import { reviewPayment } from '../../services/payment'
import { BrandLogo } from '../BrandLogo'
import { radii } from '../../lib/designTokens'
import { runtimeConfig } from '../../lib/runtimeConfig'
import { saveUploadedPhoto, uploadEventPhotoPair, type EventPhotoUploadResult } from '../../services/imagekit'
import { SketchButton } from '../SketchButton'
import { QrCodeImage } from '../QrCodeImage'
import { SketchCard } from '../SketchCard'

type UploadItem = {
  id: string
  file: File
  preview: string
  progress: number
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
  upload?: EventPhotoUploadResult
}

type AdminOrder = {
  id: string
  orderNumber: string
  count: number
  total: number
  status: string
  paymentStatus: string
  slipUrl: string | null
  slipUploadedAt: string | null
  reviewNote: string | null
}

type AdminEvent = {
  id: string
  title: string
  slug: string
  share_token: string
  event_date: string | null
  venue: string | null
  status: EventLifecycleStatus
  sale_starts_at: string | null
  sale_ends_at: string | null
  original_purge_at: string | null
  originals_purged_at: string | null
  contact_line_url: string | null
  contact_phone: string | null
}

type AdminCategory = {
  id: string
  name: string
  sort_order: number
}

const mockOrders: AdminOrder[] = [
  { id: 'demo-142', orderNumber: 'EP-2569-0142', count: 3, total: 100, status: 'ชำระแล้ว', paymentStatus: 'paid', slipUrl: null, slipUploadedAt: null, reviewNote: null },
  { id: 'demo-141', orderNumber: 'EP-2569-0141', count: 10, total: 250, status: 'รอตรวจสลิป', paymentStatus: 'under_review', slipUrl: null, slipUploadedAt: new Date().toISOString(), reviewNote: null },
  { id: 'demo-140', orderNumber: 'EP-2569-0140', count: 2, total: 80, status: 'รอชำระ', paymentStatus: 'unpaid', slipUrl: null, slipUploadedAt: null, reviewNote: null },
]

const defaultSaleStart = toDateTimeLocal(new Date())
const defaultSaleEnd = addDaysToLocalDateTime(defaultSaleStart, 7)
const defaultOriginalPurge = addDaysToLocalDateTime(defaultSaleStart, 30)

export function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(runtimeConfig.dataMode === 'demo')
  const [checkingSession, setCheckingSession] = useState(runtimeConfig.dataMode === 'live')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [eventTitle, setEventTitle] = useState('ขบวนกีฬาสี โรงเรียนสวีวิทยา')
  const [eventSlug, setEventSlug] = useState('sawi-sport-day-2569')
  const [venue, setVenue] = useState('สนามกีฬาโรงเรียน')
  const [eventDate, setEventDate] = useState('2026-07-24')
  const [category, setCategory] = useState('ขบวนพาเหรด')
  const [eventStatus, setEventStatus] = useState<EventLifecycleStatus>('active')
  const [saleStartsAt, setSaleStartsAt] = useState(defaultSaleStart)
  const [saleEndsAt, setSaleEndsAt] = useState(defaultSaleEnd)
  const [originalPurgeAt, setOriginalPurgeAt] = useState(defaultOriginalPurge)
  const [contactLineUrl, setContactLineUrl] = useState('https://line.me/ti/p/~koake')
  const [contactPhone, setContactPhone] = useState('081-234-5678')
  const [originalsPurgedAt, setOriginalsPurgedAt] = useState('')
  const [eventId, setEventId] = useState('')
  const [shareToken, setShareToken] = useState(runtimeConfig.eventShareToken)
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([])
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([])
  const [loadingEventId, setLoadingEventId] = useState('')
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [dashboardOrders, setDashboardOrders] = useState(runtimeConfig.dataMode === 'live' ? [] : mockOrders)
  const [dashboardPhotoCount, setDashboardPhotoCount] = useState(runtimeConfig.dataMode === 'live' ? 0 : 128)
  const [dashboardRevenue, setDashboardRevenue] = useState(runtimeConfig.dataMode === 'live' ? 0 : 430)
  const [reviewingOrderId, setReviewingOrderId] = useState('')

  const eventUrl = `${runtimeConfig.siteUrl}/?event=${encodeURIComponent(shareToken || eventSlug)}`
  const completeCount = uploads.filter((item) => item.status === 'done').length

  useEffect(() => {
    if (runtimeConfig.dataMode !== 'live') return
    fetch('/api/admin-session', { credentials: 'include' })
      .then((response) => response.json())
      .then((payload: { authenticated?: boolean }) => setAuthenticated(Boolean(payload.authenticated)))
      .catch(() => setAuthenticated(false))
      .finally(() => setCheckingSession(false))
  }, [])

  const loadDashboard = useCallback(async (selectedEventId = '') => {
    if (runtimeConfig.dataMode !== 'live') return
    setLoadingEventId(selectedEventId || 'latest')
    try {
      const suffix = selectedEventId ? `?eventId=${encodeURIComponent(selectedEventId)}` : ''
      const response = await fetch(`/api/admin-dashboard${suffix}`, { credentials: 'include', cache: 'no-store' })
      const payload = (await response.json()) as {
        event?: AdminEvent | null
        events?: AdminEvent[]
        categories?: AdminCategory[]
        photoCount?: number
        revenue?: number
        orders?: AdminOrder[]
        error?: string
      }
      if (!response.ok) throw new Error(payload.error || 'โหลดข้อมูลหลังบ้านไม่สำเร็จ')
      setAdminEvents(payload.events || [])
      setAdminCategories(payload.categories || [])
      if (payload.event) {
        setEventId(payload.event.id)
        setEventTitle(payload.event.title)
        setEventSlug(payload.event.slug)
        setShareToken(payload.event.share_token)
        setEventDate(payload.event.event_date || '')
        setVenue(payload.event.venue || '')
        setEventStatus(payload.event.status || 'active')
        setSaleStartsAt(toDateTimeLocal(payload.event.sale_starts_at || new Date()))
        setSaleEndsAt(toDateTimeLocal(payload.event.sale_ends_at || addDaysToLocalDateTime(defaultSaleStart, 7)))
        setOriginalPurgeAt(toDateTimeLocal(payload.event.original_purge_at || addDaysToLocalDateTime(defaultSaleStart, 30)))
        setOriginalsPurgedAt(payload.event.originals_purged_at || '')
        setContactLineUrl(payload.event.contact_line_url || '')
        setContactPhone(payload.event.contact_phone || '')
      } else {
        setEventId('')
        setEventTitle('')
        setEventSlug('')
        setShareToken('')
        setEventDate('')
        setVenue('')
        setAdminCategories([])
      }
      setDashboardPhotoCount(payload.photoCount || 0)
      setDashboardRevenue(payload.revenue || 0)
      setDashboardOrders(payload.orders || [])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'โหลดข้อมูลหลังบ้านไม่สำเร็จ')
    } finally {
      setLoadingEventId('')
    }
  }, [])

  useEffect(() => {
    if (runtimeConfig.dataMode !== 'live' || !authenticated) return
    void loadDashboard()
  }, [authenticated, loadDashboard])

  const login = async () => {
    setLoginError('')
    const response = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    })
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) { setLoginError(payload.error || 'เข้าสู่ระบบไม่สำเร็จ'); return }
    setAuthenticated(true)
    setPassword('')
  }

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST', credentials: 'include' })
    setAuthenticated(false)
  }

  const startNewEvent = () => {
    const start = toDateTimeLocal(new Date())
    setEventId('')
    setEventTitle('')
    setEventSlug('')
    setShareToken('')
    setEventDate('')
    setVenue('')
    setCategory('')
    setEventStatus('active')
    setSaleStartsAt(start)
    setSaleEndsAt(addDaysToLocalDateTime(start, 7))
    setOriginalPurgeAt(addDaysToLocalDateTime(start, 30))
    setOriginalsPurgedAt('')
    setAdminCategories([])
    setDashboardOrders([])
    setDashboardPhotoCount(0)
    setDashboardRevenue(0)
    setUploads([])
    setNotice('พร้อมสร้างอัลบั้มใหม่ กรอกข้อมูลแล้วกดบันทึกงาน')
  }

  const removeEvent = async (item: AdminEvent) => {
    if (!window.confirm(`ต้องการลบอัลบั้ม “${item.title}” ใช่หรือไม่?\nหากมีคำสั่งซื้อ ระบบจะเก็บถาวรแทนเพื่อรักษาประวัติลูกค้า`)) return
    setSaving(true)
    setNotice('')
    try {
      const result = await deleteEvent(item.id)
      setNotice(result.archived ? 'อัลบั้มมีคำสั่งซื้อ จึงถูกเก็บถาวรและซ่อนจากหน้าร้านแล้ว' : 'ลบอัลบั้มและไฟล์ที่เกี่ยวข้องแล้ว')
      await loadDashboard()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ลบอัลบั้มไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const editCategory = async (item: AdminCategory) => {
    if (!eventId) return
    const name = window.prompt('แก้ไขชื่อหมวด', item.name)?.trim()
    if (!name || name === item.name) return
    setSaving(true)
    try {
      await renameCategory(eventId, item.id, name)
      setNotice(`เปลี่ยนชื่อหมวดเป็น “${name}” แล้ว`)
      await loadDashboard(eventId)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'แก้ไขหมวดไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const removeCategory = async (item: AdminCategory) => {
    if (!eventId || !window.confirm(`ลบหมวด “${item.name}” ใช่หรือไม่?\nรูปจะยังอยู่และย้ายไปหมวดไม่ระบุ`)) return
    setSaving(true)
    try {
      await deleteCategory(eventId, item.id)
      setNotice(`ลบหมวด “${item.name}” แล้ว รูปเดิมยังไม่ถูกลบ`)
      await loadDashboard(eventId)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ลบหมวดไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const reviewOrder = async (order: AdminOrder, decision: 'approve' | 'reject') => {
    if (runtimeConfig.dataMode === 'demo') {
      setDashboardOrders((items) => items.map((item) => item.id === order.id ? {
        ...item,
        paymentStatus: decision === 'approve' ? 'paid' : 'rejected',
        status: decision === 'approve' ? 'ชำระแล้ว' : 'สลิปไม่ผ่าน',
      } : item))
      return
    }
    const note = decision === 'reject' ? window.prompt('ระบุเหตุผลที่สลิปไม่ผ่าน เพื่อแจ้งลูกค้า', 'ยอดหรือบัญชีไม่ตรง กรุณาอัปโหลดใหม่') || '' : ''
    setReviewingOrderId(order.id)
    setNotice('')
    try {
      await reviewPayment(order.id, decision, note)
      setDashboardOrders((items) => items.map((item) => item.id === order.id ? {
        ...item,
        paymentStatus: decision === 'approve' ? 'paid' : 'rejected',
        status: decision === 'approve' ? 'ชำระแล้ว' : 'สลิปไม่ผ่าน',
        reviewNote: note,
      } : item))
      if (decision === 'approve') setDashboardRevenue((value) => value + order.total)
      setNotice(decision === 'approve' ? `อนุมัติ ${order.orderNumber} และเปิดดาวน์โหลดแล้ว` : `ปฏิเสธสลิป ${order.orderNumber} แล้ว`)
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'ตรวจสลิปไม่สำเร็จ')
    } finally {
      setReviewingOrderId('')
    }
  }

  const persistEvent = async () => {
    setSaving(true)
    setNotice('')
    if (runtimeConfig.dataMode === 'demo') {
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      setShareToken(eventSlug)
      setNotice(`โหมดเดโม: บันทึกงาน “${eventTitle}” แล้ว`)
      setSaving(false)
      return
    }
    try {
      const saved = await saveEvent({
        eventId: eventId || undefined,
        title: eventTitle,
        slug: eventSlug,
        shareToken: shareToken || undefined,
        eventDate,
        venue,
        description: 'เลือกรูปที่ชอบ จ่ายผ่าน PromptPay แล้วดาวน์โหลดไฟล์เต็มได้ทันที',
        category,
        status: eventStatus,
        saleStartsAt: localDateTimeToIso(saleStartsAt),
        saleEndsAt: localDateTimeToIso(saleEndsAt),
        originalPurgeAt: localDateTimeToIso(originalPurgeAt),
        contactLineUrl,
        contactPhone,
      })
      setEventId(saved.eventId)
      setShareToken(saved.shareToken)
      setNotice('บันทึกงาน ราคา และวงจรอัลบั้ม 7/30 วันใน Supabase แล้ว')
      await loadDashboard(saved.eventId)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'บันทึกงานไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const applySaleWindow = (days: number) => {
    const start = toDateTimeLocal(new Date())
    setSaleStartsAt(start)
    setSaleEndsAt(addDaysToLocalDateTime(start, days))
    setOriginalPurgeAt(addDaysToLocalDateTime(start, Math.max(30, days + 7)))
    setOriginalsPurgedAt('')
    setEventStatus('active')
  }

  const expireNow = () => {
    setSaleEndsAt(toDateTimeLocal(new Date()))
    setEventStatus('expired')
  }

  const extendSale = (hours: number) => {
    const base = new Date(saleEndsAt).getTime() > Date.now() ? saleEndsAt : toDateTimeLocal(new Date())
    const nextEnd = addHoursToLocalDateTime(base, hours)
    setSaleEndsAt(nextEnd)
    if (new Date(originalPurgeAt).getTime() <= new Date(nextEnd).getTime()) {
      setOriginalPurgeAt(addDaysToLocalDateTime(nextEnd, 7))
    }
    setEventStatus('reactivated')
  }

  const totals = useMemo(() => ({
    orders: dashboardOrders.length,
    revenue: dashboardRevenue,
    photos: dashboardPhotoCount + completeCount,
  }), [completeCount, dashboardOrders.length, dashboardPhotoCount, dashboardRevenue])

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const incoming = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'queued' as const,
      }))
    setUploads((current) => [...current, ...incoming])
  }

  const updateUpload = (id: string, patch: Partial<UploadItem>) => {
    setUploads((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const removeUpload = (id: string) => {
    setUploads((current) => {
      const target = current.find((item) => item.id === id)
      if (target?.preview.startsWith('blob:')) URL.revokeObjectURL(target.preview)
      return current.filter((item) => item.id !== id)
    })
  }

  const uploadAll = async () => {
    const queue = uploads.filter((item) => item.status === 'queued' || item.status === 'error')
    if (!queue.length) return
    if (runtimeConfig.dataMode === 'live' && !eventId) {
      setNotice('กรุณากดบันทึกงานก่อนเริ่มอัปโหลดภาพ')
      return
    }
    setSaving(true)
    setNotice('')

    if (runtimeConfig.dataMode === 'demo') {
      for (const item of queue) {
        updateUpload(item.id, { status: 'uploading', progress: 35 })
        await new Promise((resolve) => window.setTimeout(resolve, 300))
        updateUpload(item.id, { status: 'uploading', progress: 78 })
        await new Promise((resolve) => window.setTimeout(resolve, 250))
        updateUpload(item.id, { status: 'done', progress: 100 })
      }
      setNotice('โหมดเดโม: จำลองอัปโหลดสำเร็จแล้ว เมื่อใส่คีย์ระบบจะส่งไฟล์ไป ImageKit จริง')
      setSaving(false)
      return
    }

    let sequence = dashboardPhotoCount + completeCount + 1
    for (const item of queue) {
      try {
        updateUpload(item.id, { status: 'uploading', progress: 1, error: undefined })
        const upload = await uploadEventPhotoPair(item.file, eventSlug, (progress) => updateUpload(item.id, { progress }))
        await saveUploadedPhoto({
          eventId,
          category,
          photoCode: `KAE-${String(sequence).padStart(4, '0')}`,
          upload,
        })
        sequence += 1
        if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview)
        updateUpload(item.id, { status: 'done', progress: 100, upload, preview: upload.preview.url })
      } catch (error) {
        updateUpload(item.id, { status: 'error', error: error instanceof Error ? error.message : 'อัปโหลดไม่สำเร็จ' })
      }
    }
    setSaving(false)
    setNotice('อัปโหลดคิวเสร็จแล้ว กรุณาตรวจรายการที่มีสถานะผิดพลาด')
  }

  if (checkingSession) {
    return <main className="grid min-h-screen place-items-center bg-paper p-6"><LoaderCircle className="animate-spin" size={48} strokeWidth={2.5} /></main>
  }

  if (runtimeConfig.dataMode === 'live' && !authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-pencil">
        <SketchCard decoration="tape" className="w-full max-w-md p-7">
          <BrandLogo priority admin className="mx-auto mb-5 h-24 max-w-full" />
          <div className="mx-auto grid h-20 w-20 place-items-center border-[3px] border-pencil bg-sticky shadow-hard" style={{ borderRadius: radii.blob }}><ShieldCheck size={42} strokeWidth={2.6} /></div>
          <h1 className="mt-5 text-center font-heading text-4xl font-bold">เข้าสู่หลังบ้าน</h1>
          <p className="mt-2 text-center font-body text-xl text-pencil/65">รหัสผ่านถูกตรวจสอบฝั่ง Server และเก็บ Session ใน HttpOnly Cookie</p>
          <label className="mt-6 block font-body text-lg">รหัสผ่านผู้ดูแล<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void login() }} className="admin-input" autoFocus /></label>
          {loginError && <p className="mt-3 font-body text-lg text-marker">{loginError}</p>}
          <SketchButton onClick={login} className="mt-5 flex w-full items-center justify-center gap-2"><LogIn size={21} strokeWidth={2.8} /> เข้าสู่ระบบ</SketchButton>
          <a href="/" className="mt-5 block text-center font-body text-lg underline">กลับหน้าร้าน</a>
        </SketchCard>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-paper text-pencil">
      <header className="sticky top-0 z-50 border-b-2 border-dashed border-pencil/40 bg-paper/95">
        <div className="mx-auto flex min-h-20 max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <BrandLogo priority admin className="h-16 sm:h-[72px]" />
            <span className="hidden -rotate-1 border-2 border-dashed border-pencil bg-sticky px-3 py-1 font-body text-base font-bold sm:inline-block" style={{ borderRadius: radii.wobblySm }}>ADMIN</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {runtimeConfig.dataMode === 'live' && <button type="button" onClick={logout} className="inline-flex min-h-12 items-center gap-2 border-[3px] border-pencil bg-sticky px-4 font-body text-lg font-bold shadow-hard" style={{ borderRadius: radii.wobbly }}><LogOut size={20} strokeWidth={2.8} /> ออกจากระบบ</button>}
            <a href="/" className="inline-flex min-h-12 items-center gap-2 border-[3px] border-pencil bg-white px-4 font-body text-lg font-bold shadow-hard transition-transform hover:-rotate-1" style={{ borderRadius: radii.wobbly }}>
              <ArrowLeft size={20} strokeWidth={2.8} /> กลับหน้าร้าน
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div><span className="sticky-tag inline-block -rotate-1">หลังบ้านเวอร์ชัน 1.3.7 · Album Manager</span><h1 className="mt-4 font-heading text-5xl font-bold md:text-6xl">จัดการงานขายภาพ</h1></div>
          <span className={`border-2 border-dashed border-pencil px-4 py-2 font-body text-lg ${runtimeConfig.dataMode === 'live' ? 'bg-[#d9f7df]' : 'bg-sticky'}`} style={{ borderRadius: radii.wobblySm }}>
            โหมด: {runtimeConfig.dataMode === 'live' ? 'LIVE เชื่อมระบบจริง' : 'DEMO ทดลองหน้าจอ'}
          </span>
        </div>

        {runtimeConfig.dataMode === 'live' && (
          <SketchCard decoration="tape" className="mb-10 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-heading text-4xl font-bold">อัลบั้มทั้งหมด</h2>
                <p className="font-body text-xl text-pencil/65">เลือกอัลบั้มเพื่อแก้ไข หรือสร้างอัลบั้มใหม่ รายการที่เปิดใช้งานจะขึ้นหน้าเว็บไซต์อัตโนมัติ</p>
              </div>
              <button type="button" onClick={startNewEvent} className="admin-mini-button !bg-[#d9f7df]"><ImageIcon size={19} /> สร้างอัลบั้มใหม่</button>
            </div>
            {adminEvents.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {adminEvents.map((item) => (
                  <article key={item.id} className={`border-[3px] p-4 ${eventId === item.id ? 'border-marker bg-[#fff4e8]' : 'border-pencil bg-white'}`} style={{ borderRadius: radii.wobblySm }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-heading text-2xl font-bold">{item.title}</h3>
                        <p className="font-body text-base text-pencil/60">{item.event_date || 'ไม่ระบุวันที่'} · {item.status}</p>
                      </div>
                      <span className="shrink-0 border-2 border-dashed border-pencil bg-sticky px-2 py-1 font-body text-sm">{item.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void loadDashboard(item.id)} disabled={loadingEventId === item.id} className="admin-mini-button"><Settings2 size={17} /> {loadingEventId === item.id ? 'กำลังโหลด…' : 'แก้ไข'}</button>
                      <a href={`${runtimeConfig.siteUrl}/?event=${encodeURIComponent(item.share_token)}`} target="_blank" rel="noreferrer" className="admin-mini-button"><ExternalLink size={17} /> เปิดหน้าร้าน</a>
                      <button type="button" onClick={() => void removeEvent(item)} disabled={saving} className="admin-mini-button !bg-[#ffe4e4]"><Trash2 size={17} /> ลบ/เก็บถาวร</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 border-[3px] border-dashed border-pencil/40 bg-muted/35 p-7 text-center font-body text-xl" style={{ borderRadius: radii.wobblySm }}>ยังไม่มีอัลบั้ม กด “สร้างอัลบั้มใหม่” เพื่อเริ่มต้น</div>
            )}
          </SketchCard>
        )}

        <section className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: ImageIcon, label: 'ภาพในงาน', value: totals.photos.toLocaleString('th-TH') },
            { icon: ShoppingCart, label: 'คำสั่งซื้อ', value: totals.orders.toLocaleString('th-TH') },
            { icon: PackageCheck, label: 'ยอดขายเดโม', value: formatBaht(totals.revenue) },
          ].map((stat, index) => (
            <SketchCard key={stat.label} decoration={index === 1 ? 'tack' : 'tape'} className={`${index === 0 ? '-rotate-[.6deg]' : index === 2 ? 'rotate-[.6deg]' : ''} p-5`}>
              <stat.icon size={30} strokeWidth={2.7} />
              <p className="mt-3 font-body text-lg text-pencil/60">{stat.label}</p>
              <p className="font-heading text-4xl font-bold">{stat.value}</p>
            </SketchCard>
          ))}
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
          <SketchCard decoration="tape" className="p-6">
            <div className="mb-6 flex items-center gap-3"><Settings2 size={28} strokeWidth={2.7} /><h2 className="font-heading text-4xl font-bold">ข้อมูลงาน</h2></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="font-body text-lg sm:col-span-2">ชื่องาน<input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} className="admin-input" /></label>
              <label className="font-body text-lg">Slug / ลิงก์งาน<input value={eventSlug} onChange={(event) => setEventSlug(event.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase())} className="admin-input" /></label>
              <label className="font-body text-lg">Event ID<input value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="ปล่อยว่างเมื่อสร้างงานใหม่" className="admin-input" /></label>
              <label className="font-body text-lg sm:col-span-2">Share Token สำหรับ QR<input value={shareToken} onChange={(event) => setShareToken(event.target.value)} placeholder="ปล่อยว่างให้ระบบสุ่ม" className="admin-input" /></label>
              <label className="font-body text-lg">วันที่<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="admin-input" /></label>
              <label className="font-body text-lg">สถานที่<input value={venue} onChange={(event) => setVenue(event.target.value)} className="admin-input" /></label>
              <div className="sm:col-span-2">
                <label className="font-body text-lg">หมวดสำหรับรูปชุดนี้
                  <input value={category} onChange={(event) => setCategory(event.target.value)} list="event-category-options" placeholder="เช่น ขบวนพาเหรด หรือ สีแดง" className="admin-input" />
                </label>
                <datalist id="event-category-options">{adminCategories.map((item) => <option key={item.id} value={item.name} />)}</datalist>
                <p className="mt-2 font-body text-base text-pencil/60">พิมพ์ชื่อใหม่เพื่อสร้างหมวดตอนบันทึก หรือเลือกหมวดเดิมสำหรับรูปที่จะอัปโหลด</p>
                {adminCategories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {adminCategories.map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-1 border-2 border-pencil bg-sticky px-2 py-1 font-body text-base" style={{ borderRadius: radii.wobblySm }}>
                        {item.name}
                        <button type="button" onClick={() => void editCategory(item)} className="grid h-7 w-7 place-items-center hover:bg-white" aria-label={`แก้ไขหมวด ${item.name}`}><Settings2 size={15} /></button>
                        <button type="button" onClick={() => void removeCategory(item)} className="grid h-7 w-7 place-items-center text-marker hover:bg-white" aria-label={`ลบหมวด ${item.name}`}><Trash2 size={15} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="sm:col-span-2 border-t-2 border-dashed border-pencil/35 pt-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><Clock3 size={25} strokeWidth={2.8} /><h3 className="font-heading text-3xl font-bold">อายุอัลบั้ม</h3></div>
                  <div className="flex flex-wrap gap-2">
                    {[7, 14, 30].map((days) => <button type="button" key={days} onClick={() => applySaleWindow(days)} className="admin-mini-button">เปิดขาย {days} วัน</button>)}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="font-body text-lg">สถานะ<select value={eventStatus} onChange={(event) => setEventStatus(event.target.value as EventLifecycleStatus)} className="admin-input"><option value="draft">DRAFT · ยังไม่เปิด</option><option value="active">ACTIVE · เปิดขาย</option><option value="expired">EXPIRED · หมดอายุ</option><option value="reactivated">REACTIVATED · เปิดใหม่ชั่วคราว</option><option value="archived">ARCHIVED · เหลือ Preview</option><option value="purged" disabled>PURGED · ระบบลบ Original ออนไลน์แล้ว</option></select></label>
                  <label className="font-body text-lg">เริ่มเปิดขาย<input type="datetime-local" value={saleStartsAt} onChange={(event) => setSaleStartsAt(event.target.value)} className="admin-input" /></label>
                  <label className="font-body text-lg">ปิดขายออนไลน์<input type="datetime-local" value={saleEndsAt} onChange={(event) => setSaleEndsAt(event.target.value)} className="admin-input" /></label>
                  <label className="font-body text-lg">ลบ Original ออนไลน์<input type="datetime-local" value={originalPurgeAt} onChange={(event) => setOriginalPurgeAt(event.target.value)} className="admin-input" /></label>
                  <label className="font-body text-lg">ลิงก์ LINE<input value={contactLineUrl} onChange={(event) => setContactLineUrl(event.target.value)} placeholder="https://line.me/..." className="admin-input" /></label>
                  <label className="font-body text-lg">เบอร์โทร<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className="admin-input" /></label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={expireNow} className="admin-mini-button !bg-[#ffe4e4]"><Archive size={18} /> ปิดขายตอนนี้</button>
                  <button type="button" onClick={() => extendSale(24)} className="admin-mini-button !bg-[#d9f7df]"><RefreshCw size={18} /> เปิดเพิ่ม 24 ชั่วโมง</button>
                </div>
                <div className="mt-4 border-2 border-dashed border-pencil bg-sticky/70 p-4 font-body text-lg" style={{ borderRadius: radii.wobblySm }}>
                  <b>ลำดับอัตโนมัติ:</b> เปิดขายถึง {formatThaiDateTime(localDateTimeToIso(saleEndsAt))} → หน้าเว็บยังเก็บ Preview → Original ออนไลน์ถึง {formatThaiDateTime(localDateTimeToIso(originalPurgeAt))}
                  {originalsPurgedAt && <p className="mt-1 text-marker">ลบ Original ออนไลน์แล้วเมื่อ {formatThaiDateTime(originalsPurgedAt)}</p>}
                </div>
              </div>
            </div>
            <SketchButton disabled={saving} className="mt-6 inline-flex items-center gap-2" onClick={persistEvent}><Save size={21} strokeWidth={2.8} /> {saving ? 'กำลังบันทึก…' : 'บันทึกงาน'}</SketchButton>
          </SketchCard>

          <SketchCard decoration="tack" className="bg-sticky p-6 text-center">
            <QrCode className="mx-auto" size={38} strokeWidth={2.7} />
            <h2 className="mt-2 font-heading text-4xl font-bold">QR ประจำงาน</h2>
            <QrCodeImage value={eventUrl} className="mx-auto my-5 aspect-square w-48 border-[3px] border-pencil bg-white p-3 shadow-hard" />
            <p className="break-all border-2 border-dashed border-pencil bg-white p-3 font-body text-base" style={{ borderRadius: radii.wobblySm }}>{eventUrl}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button onClick={() => navigator.clipboard?.writeText(eventUrl)} className="admin-mini-button"><Copy size={18} /> คัดลอก</button>
              <a href={eventUrl} target="_blank" rel="noreferrer" className="admin-mini-button"><ExternalLink size={18} /> เปิดหน้า</a>
            </div>
          </SketchCard>
        </section>

        <section className="mt-10">
          <SketchCard decoration="tape" className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div><div className="flex items-center gap-3"><CloudUpload size={30} strokeWidth={2.8} /><h2 className="font-heading text-4xl font-bold">อัปโหลดภาพไป ImageKit</h2></div><p className="mt-1 font-body text-xl text-pencil/65">ระบบอัปโหลด Original แบบ Private และสร้าง Preview พร้อมลายน้ำเป็นไฟล์แยก เพื่อให้ลบ Original หลัง 30 วันได้โดย Preview ยังอยู่</p></div>
              <div className="grid w-full gap-3 lg:max-w-sm">
                <label className="font-body text-lg font-bold">อัลบั้มปลายทาง
                  <select
                    value={eventId}
                    onChange={(event) => { if (event.target.value) void loadDashboard(event.target.value) }}
                    className="admin-input"
                  >
                    <option value="">— เลือกอัลบั้มก่อน —</option>
                    {adminEvents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
                <label className={`inline-flex min-h-14 items-center justify-center gap-2 border-[3px] border-pencil px-5 font-body text-xl font-bold shadow-hard transition-transform ${eventId ? 'cursor-pointer bg-sticky hover:-rotate-1' : 'cursor-not-allowed bg-muted opacity-50'}`} style={{ borderRadius: radii.wobbly }}>
                  <ImageIcon size={22} strokeWidth={2.8} /> เลือกหลายรูป
                  <input disabled={!eventId} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = '' }} />
                </label>
              </div>
            </div>
            {!eventId && <div className="mt-5 border-[3px] border-marker bg-[#ffe4e4] p-4 font-body text-xl text-marker" style={{ borderRadius: radii.wobblySm }}>กรุณาสร้างและบันทึกอัลบั้ม หรือเลือกอัลบั้มปลายทางก่อนเลือกรูป</div>}

            {uploads.length === 0 ? (
              <div className="mt-7 border-[3px] border-dashed border-pencil/50 bg-muted/35 p-10 text-center" style={{ borderRadius: radii.wobblyMd }}>
                <CloudUpload className="mx-auto" size={45} strokeWidth={2.4} /><p className="mt-3 font-heading text-3xl font-bold">ยังไม่มีรูปในคิว</p><p className="font-body text-xl text-pencil/60">เลือก JPG, PNG หรือ WebP ได้หลายไฟล์พร้อมกัน</p>
              </div>
            ) : (
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {uploads.map((item) => (
                  <article key={item.id} className="border-[3px] border-pencil bg-white p-2 shadow-hard" style={{ borderRadius: radii.wobblySm }}>
                    <img src={item.preview} alt={item.file.name} className="aspect-square w-full object-cover" style={{ borderRadius: radii.wobblySm }} />
                    <p className="mt-2 truncate font-body text-base font-bold">{item.file.name}</p>
                    <div className="mt-2 h-3 overflow-hidden border-2 border-pencil bg-muted" style={{ borderRadius: radii.wobblySm }}><div className={`h-full ${item.status === 'error' ? 'bg-marker' : 'bg-pen'} transition-all`} style={{ width: `${item.progress}%` }} /></div>
                    <div className="mt-2 flex items-center justify-between gap-2 font-body text-sm">
                      <span>{item.status === 'queued' ? 'รออัปโหลด' : item.status === 'uploading' ? `${item.progress}%` : item.status === 'done' ? 'สำเร็จ' : item.error}</span>
                      {item.status === 'done' ? <CheckCircle2 size={19} className="text-[#218b3a]" /> : item.status === 'uploading' ? <LoaderCircle size={19} className="animate-spin" /> : <button onClick={() => removeUpload(item.id)} aria-label="ลบออกจากคิว"><Trash2 size={18} /></button>}
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <SketchButton disabled={saving || !uploads.some((item) => item.status !== 'done')} onClick={uploadAll} className="inline-flex items-center gap-2"><CloudUpload size={21} strokeWidth={2.8} /> {saving ? 'กำลังอัปโหลด…' : 'เริ่มอัปโหลดทั้งหมด'}</SketchButton>
              <span className="font-body text-lg text-pencil/60">สำเร็จ {completeCount}/{uploads.length} รูป</span>
            </div>
          </SketchCard>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
          <SketchCard decoration="tack" className="p-6">
            <div className="flex items-center gap-3"><Database size={28} strokeWidth={2.7} /><h2 className="font-heading text-4xl font-bold">จุดเชื่อมระบบ</h2></div>
            <div className="mt-5 grid gap-3 font-body text-lg">
              {[
                { icon: ImageIcon, label: 'ImageKit', text: 'Original Private + Preview แยกไฟล์ เพื่อรองรับการลบอัตโนมัติ' },
                { icon: Database, label: 'Supabase', text: 'เก็บงาน หมวด ราคา คำสั่งซื้อ และสิทธิ์ดาวน์โหลด' },
                { icon: KeyRound, label: 'PromptPay + สลิป', text: 'สร้าง QR ตามยอด เก็บสลิปแบบ Private และเปิดดาวน์โหลดหลังแอดมินอนุมัติ' },
              ].map((row) => <div key={row.label} className="flex gap-3 border-2 border-dashed border-pencil/40 bg-paper p-3" style={{ borderRadius: radii.wobblySm }}><row.icon className="mt-1 shrink-0" size={22} strokeWidth={2.7} /><div><b>{row.label}</b><p className="text-pencil/65">{row.text}</p></div></div>)}
            </div>
          </SketchCard>

          <SketchCard decoration="tape" className="p-6">
            <h2 className="font-heading text-4xl font-bold">ราคาที่ตั้งไว้</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {DEFAULT_PRICE_TIERS.map((tier) => <div key={tier.count} className={`${tier.count === 3 || tier.count === 10 ? 'bg-sticky' : 'bg-white'} border-2 border-pencil p-3 text-center`} style={{ borderRadius: radii.wobblySm }}><p className="font-heading text-2xl font-bold">{tier.count} รูป</p><p className="font-body text-xl text-marker">{tier.price}฿</p></div>)}
            </div>
          </SketchCard>
        </section>

        <section className="mt-10">
          <SketchCard decoration="tape" className="overflow-x-auto p-6">
            <h2 className="font-heading text-4xl font-bold">คำสั่งซื้อล่าสุด</h2>
            <table className="mt-5 w-full min-w-[620px] border-separate border-spacing-y-2 font-body text-lg">
              <thead><tr className="text-left"><th className="px-3">เลขคำสั่งซื้อ</th><th>จำนวน</th><th>ยอด</th><th>สถานะ / ตรวจสลิป</th></tr></thead>
              <tbody>{dashboardOrders.map((order) => (
                <tr key={order.id} className="bg-white">
                  <td className="border-y-2 border-l-2 border-pencil px-3 py-3">{order.orderNumber}</td>
                  <td className="border-y-2 border-pencil">{order.count} รูป</td>
                  <td className="border-y-2 border-pencil">{formatBaht(order.total)}</td>
                  <td className="border-y-2 border-r-2 border-pencil py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`${order.status === 'ชำระแล้ว' ? 'bg-[#d9f7df]' : order.paymentStatus === 'rejected' ? 'bg-[#ffe4e4]' : 'bg-sticky'} border-2 border-pencil px-3 py-1`} style={{ borderRadius: radii.wobblySm }}>{order.status}</span>
                      {order.slipUrl && <a href={order.slipUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 border-2 border-pencil bg-white px-3 font-bold hover:bg-paper"><ExternalLink size={17} /> เปิดสลิป</a>}
                      {order.paymentStatus === 'under_review' && <>
                        <button disabled={reviewingOrderId === order.id} onClick={() => reviewOrder(order, 'approve')} className="inline-flex min-h-10 items-center gap-1 border-2 border-pencil bg-[#d9f7df] px-3 font-bold disabled:opacity-50"><CheckCircle2 size={18} /> อนุมัติ</button>
                        <button disabled={reviewingOrderId === order.id} onClick={() => reviewOrder(order, 'reject')} className="inline-flex min-h-10 items-center gap-1 border-2 border-pencil bg-[#ffe4e4] px-3 font-bold disabled:opacity-50"><XCircle size={18} /> ไม่ผ่าน</button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </SketchCard>
        </section>

        {notice && <div className="fixed bottom-5 left-1/2 z-[100] w-[min(92vw,620px)] -translate-x-1/2 border-[3px] border-pencil bg-sticky p-4 font-body text-xl shadow-hard-lg" style={{ borderRadius: radii.wobblyMd }}>{notice}<button onClick={() => setNotice('')} className="float-right font-bold">×</button></div>}
      </main>
    </div>
  )
}
