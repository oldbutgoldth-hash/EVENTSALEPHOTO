import { createClient } from '@supabase/supabase-js'
import { runtimeConfig } from '../lib/runtimeConfig'

type SignedUpload = { path: string; uploadToken: string; error?: string }

// "Failed to fetch" is Chrome's generic message for ANY network-level failure
// (dropped connection, weak signal, DNS hiccup) — it says nothing about which
// of the 3 network calls below broke. We now label each step so the real
// culprit is obvious next time, and retry the heaviest step (the actual file
// upload) once, since a single dropped packet on a weak mobile connection is
// often transient rather than a real bug.
function describeNetworkFailure(cause: unknown, fallback: string): Error {
  const message = cause instanceof Error ? cause.message : ''
  if (!message || message === 'Failed to fetch') return new Error(fallback)
  return cause instanceof Error ? cause : new Error(fallback)
}

export async function uploadPaymentSlip(orderToken: string, file: File): Promise<void> {
  if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase สำหรับอัปโหลดสลิป')
  }

  let signed: SignedUpload
  try {
    const response = await fetch('/api/payment-slip-upload-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: orderToken,
        contentType: file.type,
        fileSize: file.size,
      }),
    })
    signed = (await response.json().catch(() => ({}))) as SignedUpload
    if (!response.ok || !signed.path || !signed.uploadToken) {
      throw new Error(signed.error || 'เตรียมพื้นที่อัปโหลดสลิปไม่สำเร็จ')
    }
  } catch (cause) {
    throw describeNetworkFailure(cause, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ตอนเตรียมอัปโหลด (เช็คสัญญาณอินเทอร์เน็ตแล้วลองใหม่)')
  }

  const client = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let uploadError: unknown = null
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const uploaded = await client.storage
      .from('payment-slips')
      .uploadToSignedUrl(signed.path, signed.uploadToken, file, { contentType: file.type })
    uploadError = uploaded.error
    if (!uploadError) break
  }
  if (uploadError) {
    throw describeNetworkFailure(uploadError, 'อัปโหลดไฟล์สลิปไม่สำเร็จ (สัญญาณอินเทอร์เน็ตไม่พอ ลองใหม่หรือเปลี่ยนไปใช้ Wi-Fi)')
  }

  try {
    const submitResponse = await fetch('/api/payment-slip-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: orderToken,
        path: signed.path,
        contentType: file.type,
        fileSize: file.size,
      }),
    })
    const submit = (await submitResponse.json().catch(() => ({}))) as { error?: string }
    if (!submitResponse.ok) throw new Error(submit.error || 'บันทึกสลิปไม่สำเร็จ')
  } catch (cause) {
    throw describeNetworkFailure(cause, 'ไฟล์อัปโหลดสำเร็จแล้ว แต่บันทึกไม่สำเร็จ (เช็คอินเทอร์เน็ตแล้วกดส่งสลิปใหม่อีกครั้ง)')
  }
}

export async function reviewPayment(orderId: string, decision: 'approve' | 'reject', note = ''): Promise<void> {
  const response = await fetch('/api/admin-review-payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ orderId, decision, note }),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error || 'ตรวจสลิปไม่สำเร็จ')
}

export type BulkReviewResult = { orderId: string; ok: boolean; paymentStatus?: string; error?: string }

export async function bulkReviewPayments(orderIds: string[], decision: 'approve' | 'reject', note = ''): Promise<BulkReviewResult[]> {
  const response = await fetch('/api/admin-review-payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ orderIds, decision, note }),
  })
  const payload = (await response.json().catch(() => ({}))) as { results?: BulkReviewResult[]; error?: string }
  if (!response.ok || !payload.results) throw new Error(payload.error || 'ตรวจสลิปแบบกลุ่มไม่สำเร็จ')
  return payload.results
}

export type ReverifyResult = { outcome: 'paid' | 'rejected' | 'under_review'; note: string }

// Re-runs Slip2Go against a slip that's already uploaded — for orders stuck in
// under_review from before a Slip2Go config fix, without asking the customer
// to resubmit anything.
export async function reverifySlip(orderId: string): Promise<ReverifyResult> {
  const response = await fetch('/api/payment-slip?action=reverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ orderId }),
  })
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; outcome?: ReverifyResult['outcome']; note?: string; error?: string }
  if (!response.ok || !payload.ok || !payload.outcome) throw new Error(payload.error || 'ตรวจสลิปใหม่ไม่สำเร็จ')
  return { outcome: payload.outcome, note: payload.note || '' }
}
