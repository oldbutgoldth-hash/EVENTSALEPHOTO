// Automatic slip verification via Slip2Go API Connect.
//
// Important contract details (verified against the current Slip2Go guide):
// - Upload slip images to POST /api/verify-slip/qr-image/info.
// - Send the API secret directly in the Authorization header. Do NOT add
//   a "Bearer " prefix.
// - When check conditions are supplied, a fully valid slip returns code
//   200200. Code 200000 only means the bank found the slip; it does not prove
//   that the requested receiver/amount/duplicate conditions passed.
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

    const form = new FormData()
    form.append('file', new Blob([fileBytes], { type: contentType }), contentType === 'image/png' ? 'slip.png' : 'slip.jpg')
    form.append('payload', JSON.stringify(payload))

    const response = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
      method: 'POST',
      headers: { Authorization: secretKey },
      body: form,
    })

    const responseText = await response.text()
    const result = (() => {
      try {
        return JSON.parse(responseText) as Slip2GoResponse
      } catch {
        return null
      }
    })()

    console.info('SLIP2GO_VERIFY_RESULT', {
      httpStatus: response.status,
      code: result?.code || null,
      message: result?.message || null,
      hasData: Boolean(result?.data),
    })

    if (!response.ok || !result) {
      const detail = result?.message ? ` — ${result.message}` : ''
      return {
        outcome: 'inconclusive',
        note: `Slip2Go ตอบกลับผิดปกติ (HTTP ${response.status}${detail}) — ต้องตรวจด้วยตนเอง`,
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
