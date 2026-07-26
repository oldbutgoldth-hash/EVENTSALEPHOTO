import { createClient } from '@supabase/supabase-js'
import { runtimeConfig } from '../lib/runtimeConfig'

type SignedUpload = { path: string; uploadToken: string; error?: string }

export async function uploadPaymentSlip(orderToken: string, file: File): Promise<void> {
  if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase สำหรับอัปโหลดสลิป')
  }
  const response = await fetch('/api/payment-slip-upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token: orderToken,
      contentType: file.type,
      fileSize: file.size,
    }),
  })
  const signed = (await response.json().catch(() => ({}))) as SignedUpload
  if (!response.ok || !signed.path || !signed.uploadToken) {
    throw new Error(signed.error || 'เตรียมพื้นที่อัปโหลดสลิปไม่สำเร็จ')
  }

  const client = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const uploaded = await client.storage
    .from('payment-slips')
    .uploadToSignedUrl(signed.path, signed.uploadToken, file, { contentType: file.type })
  if (uploaded.error) throw uploaded.error

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
