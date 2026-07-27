import crypto from 'node:crypto'

// Automatic slip verification via Slip2Go API Connect.
//
// Important contract details (confirmed live against a real order + the
// Slip2Go dashboard's own "Authentication" code sample on 2026-07-27):
// - Upload slip images to POST /api/verify-slip/qr-image/info.
// - The Authorization header IS "Bearer <secretKey>" — the dashboard's own
//   JS example shows `Authorization: 'Bearer {secretKey}'`. An earlier
//   attempt without "Bearer " produced "Authentication Token Mismatch"
//   (HTTP 401); adding it back resolved auth immediately.
// - When check conditions are supplied, a fully valid slip returns code
//   200200. Code 200000 only means the bank found the slip; it does not prove
//   that the requested receiver/amount/duplicate conditions passed. Confirmed
//   live: a real paid slip came back with code !== '200200' at first, which
//   is why 200000 must never be treated as success.
//
// Configure with SLIP2GO_SECRET_KEY and a 10-digit phone PROMPTPAY_ID.
// Anything that cannot be proved safe falls back to manual review.

export type SlipCheckResult =
  | { outcome: 'verified'; transRef: string; amount: number; note: string }
  | { outcome: 'duplicate'; note: string; transRef?: string }
  | { outcome: 'amount_mismatch'; note: string; transRef?: string }
  | { outcome: 'wrong_account'; note: string; transRef?: string }
  | { outcome: 'invalid_slip'; note: string; transRef?: string }
  | { outcome: 'inconclusive'; note: string }

type Slip2GoResponse = {
  code?: string
  message?: string
  data?: {
    referenceId?: string
    transRef?: string
    amount?: number
  }
}

const supportedAutoVerifyTypes = new Set(['image/jpeg', 'image/png'])

function transactionReference(result: Slip2GoResponse): string {
  return result.data?.transRef?.trim() || result.data?.referenceId?.trim() || ''
}

async function callSlip2Go(
  secretKey: string,
  fileBytes: Uint8Array,
  contentType: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; result: Slip2GoResponse | null; networkError?: string }> {
  try {
    const form = new FormData()
    form.append('file', new Blob([fileBytes], { type: contentType }), contentType === 'image/png' ? 'slip.png' : 'slip.jpg')
    form.append('payload', JSON.stringify(payload))

    const response = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}` },
      body: form,
      signal: AbortSignal.timeout(12000),
    })
    const responseText = await response.text()
    const result = (() => {
      try {
        return JSON.parse(responseText) as Slip2GoResponse
      } catch {
        return null
      }
    })()
    return { ok: response.ok, status: response.status, result }
  } catch (error) {
    return { ok: false, status: 0, result: null, networkError: error instanceof Error ? error.message : 'NETWORK_ERROR' }
  }
}

// A tiny, valid 1x1 JPEG with no QR code in it. Used only to prove whether the
// Authorization header is being accepted at all — Slip2Go will reject it for
// "no slip found", but the *shape* of that rejection (not a 401) is proof the
// secret key itself works. Never used for anything that could unlock an order.
const authProbeJpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMDAwMDAwMDAwMEAwMEBQQEBAQFBQUFBQUFBQYGBgYGBgYHBwcHBwcICAgICAoKCgoKCgsLCwsLCwsLCwsLAwMDBAQEBQUFBgYGBgYHBwcHBwgICAgICgoKCgoLCwsLCwsLCwsLCwv/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AKp//9k=',
  'base64',
)

export type Slip2GoSecretDiagnostics = {
  secretConfigured: boolean
  secretLength: number
  secretHasLeadingWhitespace: boolean
  secretHasTrailingWhitespace: boolean
  secretContainsNewline: boolean
  secretContainsQuotes: boolean
  secretFingerprint: string | null
  promptPayConfigured: boolean
  promptPayMasked: string | null
}

// Reports whether the secret/env look sane WITHOUT ever exposing the actual
// value — safe to return straight to an admin-gated API response or log line.
export function getSlip2GoSecretDiagnostics(): Slip2GoSecretDiagnostics {
  const raw = process.env.SLIP2GO_SECRET_KEY
  const promptPayRaw = process.env.PROMPTPAY_ID || ''
  const promptPayDigits = promptPayRaw.replace(/\D/g, '')
  return {
    secretConfigured: Boolean(raw && raw.trim().length > 0),
    secretLength: raw ? raw.trim().length : 0,
    secretHasLeadingWhitespace: Boolean(raw && /^\s/.test(raw)),
    secretHasTrailingWhitespace: Boolean(raw && /\s$/.test(raw)),
    secretContainsNewline: Boolean(raw && /[\r\n]/.test(raw)),
    secretContainsQuotes: Boolean(raw && /["']/.test(raw)),
    secretFingerprint: raw
      ? crypto.createHash('sha256').update(raw.trim()).digest('hex').slice(0, 8)
      : null,
    promptPayConfigured: promptPayDigits.length === 10,
    promptPayMasked: promptPayDigits.length === 10
      ? `${promptPayDigits.slice(0, 3)}***${promptPayDigits.slice(-4)}`
      : null,
  }
}

// Live auth-only probe: proves whether Vercel's runtime has a SLIP2GO_SECRET_KEY
// that Slip2Go actually accepts, without spending a real verification on a
// real slip and without ever needing to screenshot the secret again.
export async function probeSlip2GoAuth(): Promise<{ httpStatus: number; code: string | null; message: string | null; networkError?: string }> {
  const secretKey = process.env.SLIP2GO_SECRET_KEY?.trim()
  if (!secretKey) return { httpStatus: 0, code: null, message: 'SLIP2GO_SECRET_KEY_NOT_CONFIGURED' }
  const attempt = await callSlip2Go(secretKey, new Uint8Array(authProbeJpeg), 'image/jpeg', { checkDuplicate: false })
  return {
    httpStatus: attempt.status,
    code: attempt.result?.code || null,
    message: attempt.result?.message || attempt.networkError || null,
    networkError: attempt.networkError,
  }
}

export async function verifySlipWithSlip2Go(
  fileBytes: Uint8Array,
  contentType: string,
  expectedAmountBaht: number,
): Promise<SlipCheckResult> {
  const secretKey = process.env.SLIP2GO_SECRET_KEY?.trim()
  if (!secretKey) {
    return {
      outcome: 'inconclusive',
      note: 'ยังไม่ได้ตั้งค่า SLIP2GO_SECRET_KEY — ต้องตรวจสลิปด้วยตนเอง',
    }
  }

  // Slip2Go documents JPG/JPEG/PNG for the image endpoint. Keep WebP upload
  // compatible with the old manual flow, but do not pretend it was verified.
  if (!supportedAutoVerifyTypes.has(contentType)) {
    return {
      outcome: 'inconclusive',
      note: 'ไฟล์ชนิดนี้อัปโหลดได้ แต่ Slip2Go ตรวจอัตโนมัติรองรับเฉพาะ JPG หรือ PNG — ต้องตรวจด้วยตนเอง',
    }
  }

  const receiverPhone = (process.env.PROMPTPAY_ID || '').replace(/\D/g, '')
  if (receiverPhone.length !== 10) {
    return {
      outcome: 'inconclusive',
      note: 'PROMPTPAY_ID ต้องเป็นเบอร์โทรศัพท์ 10 หลัก จึงจะตรวจบัญชีผู้รับอัตโนมัติได้',
    }
  }

  try {
    const payload = {
      checkDuplicate: true,
      checkReceiver: [{ accountType: '02001', accountNumber: receiverPhone }],
      checkAmount: { type: 'eq', amount: expectedAmountBaht.toFixed(2) },
    }

    // One bounded retry for genuinely transient failures (network blip, Slip2Go
    // rate-limiting, or a 5xx on their end). Never retried: 401 or any parsed
    // business-rejection code — those are deterministic, so a second attempt
    // would just waste time before falling back to manual review anyway.
    let attempt = await callSlip2Go(secretKey, fileBytes, contentType, payload)
    const isTransient = Boolean(attempt.networkError) || attempt.status === 429 || attempt.status >= 500
    if (isTransient) {
      console.warn('SLIP2GO_VERIFY_RETRY', { firstStatus: attempt.status, networkError: attempt.networkError || null })
      await new Promise((resolve) => setTimeout(resolve, 800))
      attempt = await callSlip2Go(secretKey, fileBytes, contentType, payload)
    }

    const { ok: httpOk, status: httpStatus, result } = attempt

    console.info('SLIP2GO_VERIFY_RESULT', {
      httpStatus,
      code: result?.code || null,
      message: result?.message || null,
      hasData: Boolean(result?.data),
    })

    if (!httpOk || !result) {
      const detail = result?.message ? ` — ${result.message}` : attempt.networkError ? ` — ${attempt.networkError}` : ''
      return {
        outcome: 'inconclusive',
        note: `Slip2Go ตอบกลับผิดปกติ (HTTP ${httpStatus}${detail}) — ต้องตรวจด้วยตนเอง`,
      }
    }

    const transRef = transactionReference(result)

    switch (result.code) {
      case '200401':
        return { outcome: 'wrong_account', transRef: transRef || undefined, note: 'บัญชีผู้รับในสลิปไม่ตรงกับพร้อมเพย์ของร้าน' }
      case '200402':
        return { outcome: 'amount_mismatch', transRef: transRef || undefined, note: `ยอดในสลิปไม่ตรงกับยอดที่ต้องชำระ ${expectedAmountBaht.toFixed(2)} บาท` }
      case '200404':
        return { outcome: 'invalid_slip', transRef: transRef || undefined, note: 'ไม่พบข้อมูลสลิปนี้ในระบบธนาคาร' }
      case '200500':
        return { outcome: 'invalid_slip', transRef: transRef || undefined, note: 'Slip2Go ระบุว่าสลิปเสียหรืออาจเป็นสลิปปลอม' }
      case '200501':
        return { outcome: 'duplicate', transRef: transRef || undefined, note: 'Slip2Go ตรวจพบว่าสลิปนี้ถูกใช้ซ้ำ' }
      case '200502':
        return { outcome: 'inconclusive', note: 'ธนาคารตอบกลับผิดปกติ กรุณาตรวจสลิปด้วยตนเองหรือลองใหม่ภายหลัง' }
      case '200000':
        // The bank found the slip, but the current API uses 200200 to confirm
        // that requested conditions passed. Never auto-unlock on 200000 alone.
        return {
          outcome: 'inconclusive',
          note: 'ธนาคารพบสลิป แต่ Slip2Go ยังไม่ได้ยืนยันเงื่อนไขยอดและบัญชีผู้รับ — ต้องตรวจด้วยตนเอง',
        }
      case '200200':
        break
      default:
        return {
          outcome: 'inconclusive',
          note: result.message
            ? `Slip2Go ยังไม่ยืนยันสลิป: ${result.message} (${result.code || 'NO_CODE'})`
            : `Slip2Go ยังไม่ยืนยันสลิป (${result.code || 'NO_CODE'})`,
        }
    }

    if (!result.data) {
      return { outcome: 'inconclusive', note: 'Slip2Go แจ้งว่าสลิปผ่าน แต่ไม่มีข้อมูลธุรกรรมกลับมา — ต้องตรวจด้วยตนเอง' }
    }

    const slipAmount = result.data.amount
    if (typeof slipAmount !== 'number' || !Number.isFinite(slipAmount)) {
      return { outcome: 'inconclusive', note: 'Slip2Go ไม่ส่งยอดเงินกลับมา — ต้องตรวจด้วยตนเอง' }
    }

    if (Math.round(slipAmount * 100) !== Math.round(expectedAmountBaht * 100)) {
      return {
        outcome: 'amount_mismatch',
        note: `ยอดในสลิป ${slipAmount.toFixed(2)} บาท ไม่ตรงกับยอดที่ต้องชำระ ${expectedAmountBaht.toFixed(2)} บาท`,
        transRef: transRef || undefined,
      }
    }

    if (!transRef) {
      return {
        outcome: 'inconclusive',
        note: 'Slip2Go ยืนยันยอดและบัญชีแล้ว แต่ไม่มีเลขอ้างอิงธุรกรรม จึงยังไม่ปลดล็อกอัตโนมัติเพื่อความปลอดภัย',
      }
    }

    return {
      outcome: 'verified',
      transRef,
      amount: slipAmount,
      note: `ตรวจสอบผ่านอัตโนมัติ ✅ ยอด ${slipAmount.toFixed(2)} บาท บัญชีผู้รับถูกต้อง · เลขอ้างอิง ${transRef}`,
    }
  } catch (error) {
    console.error('SLIP2GO_VERIFY_EXCEPTION', error)
    return {
      outcome: 'inconclusive',
      note: error instanceof Error
        ? `เรียก Slip2Go ไม่สำเร็จ: ${error.message} — ต้องตรวจด้วยตนเอง`
        : 'เรียก Slip2Go ไม่สำเร็จ — ต้องตรวจด้วยตนเอง',
    }
  }
}
