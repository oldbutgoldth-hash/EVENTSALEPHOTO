// Automatic slip verification via SlipOK (https://slipok.com/api-documentation/).
// SlipOK reads the bank QR embedded in the slip image itself, so it checks the
// real transaction — not just the picture — for the amount and for reuse.
//
// Configure with SLIPOK_API_KEY and SLIPOK_BRANCH_ID (from the SlipOK dashboard).
// If those aren't set, verification is skipped and treated as inconclusive so the
// existing manual-review flow keeps working exactly as before.

export type SlipCheckResult =
  | { outcome: 'verified'; transRef: string; amount: number; note: string }
  | { outcome: 'duplicate'; note: string; transRef?: string }
  | { outcome: 'amount_mismatch'; note: string; transRef?: string }
  | { outcome: 'wrong_account'; note: string; transRef?: string }
  | { outcome: 'inconclusive'; note: string }

type SlipOkSlipData = {
  transRef?: string
  amount?: number
  transDate?: string
  transTime?: string
}

type SlipOkSuccessResponse = { success: true; data: SlipOkSlipData }
type SlipOkErrorResponse = { code: number; message: string; data?: SlipOkSlipData }

export async function verifySlipWithSlipOk(
  fileBytes: Uint8Array,
  contentType: string,
  expectedAmountBaht: number,
): Promise<SlipCheckResult> {
  const apiKey = process.env.SLIPOK_API_KEY
  const branchId = process.env.SLIPOK_BRANCH_ID
  if (!apiKey || !branchId) {
    return { outcome: 'inconclusive', note: 'ยังไม่ได้ตั้งค่าระบบตรวจสลิปอัตโนมัติ (SLIPOK_API_KEY / SLIPOK_BRANCH_ID) — ตรวจด้วยตนเอง' }
  }

  try {
    const form = new FormData()
    form.append('files', new Blob([fileBytes], { type: contentType }), 'slip.jpg')
    form.append('log', 'true')
    form.append('amount', String(expectedAmountBaht))

    const response = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: 'POST',
      headers: { 'x-authorization': apiKey },
      body: form,
    })
    const payload = (await response.json().catch(() => null)) as SlipOkSuccessResponse | SlipOkErrorResponse | null
    if (!payload) return { outcome: 'inconclusive', note: 'ระบบตรวจสลิปอัตโนมัติตอบกลับไม่ถูกต้อง กรุณาตรวจด้วยตนเอง' }

    if (response.ok && 'success' in payload && payload.success) {
      const data = payload.data
      return {
        outcome: 'verified',
        transRef: data.transRef || '',
        amount: data.amount ?? expectedAmountBaht,
        note: `ตรวจสอบอัตโนมัติผ่าน ✅ ยอด ${data.amount ?? '-'} บาท ตรงกับราคา · เลขอ้างอิง ${data.transRef || '-'}`,
      }
    }

    const errorPayload = payload as SlipOkErrorResponse
    const transRef = errorPayload.data?.transRef || undefined
    if (errorPayload.code === 1012) {
      return { outcome: 'duplicate', note: `สลิปนี้เคยถูกใช้ไปแล้ว — ${errorPayload.message || ''}`.trim(), transRef }
    }
    if (errorPayload.code === 1013) {
      const slipAmount = errorPayload.data?.amount
      return {
        outcome: 'amount_mismatch',
        note: `ยอดในสลิป${slipAmount != null ? ` (${slipAmount} บาท)` : ''} ไม่ตรงกับยอดที่ต้องชำระ (${expectedAmountBaht} บาท)`,
        transRef,
      }
    }
    if (errorPayload.code === 1014) {
      return { outcome: 'wrong_account', note: errorPayload.message || 'บัญชีผู้รับในสลิปไม่ตรงกับบัญชีร้าน', transRef }
    }
    // Bad/unreadable QR, bank-delay slips, quota issues, etc. — don't auto-reject on these,
    // since they can be false negatives. Let the photographer review the slip manually;
    // the note just explains why the automatic check couldn't confirm it either way.
    return { outcome: 'inconclusive', note: errorPayload.message ? `ตรวจอัตโนมัติไม่สำเร็จ: ${errorPayload.message}` : 'ระบบตรวจสลิปอัตโนมัติไม่สามารถยืนยันได้ กรุณาตรวจด้วยตนเอง' }
  } catch (error) {
    return {
      outcome: 'inconclusive',
      note: error instanceof Error ? `เรียกระบบตรวจสลิปอัตโนมัติไม่สำเร็จ: ${error.message}` : 'เรียกระบบตรวจสลิปอัตโนมัติไม่สำเร็จ',
    }
  }
}
