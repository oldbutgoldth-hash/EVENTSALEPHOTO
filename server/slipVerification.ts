// Automatic slip verification via Slip2Go (https://connect.slip2go.com/api),
// a sibling product to SlipOK with its own REST API and a different contract
// (Bearer secret key, no branch id, JSON "payload" alongside the file). It
// reads the real bank QR embedded in the slip image — not just the picture —
// so a clean success response with a matching amount is trustworthy enough
// to skip the manual review click.
//
// Configure with SLIP2GO_SECRET_KEY (from the shop dashboard's
// API Connect > Authentication page). If it isn't set, verification is
// skipped and treated as inconclusive so the existing manual-review flow
// keeps working exactly as before.
//
// Note: this only auto-approves on a clean, amount-matching success — it does
// not auto-reject on Slip2Go-reported mismatches yet, since the exact
// non-success codes for "wrong amount"/"wrong account" weren't available to
// confirm against. Anything that isn't a confirmed match just falls back to
// manual review, which is always safe. Reuse is still caught two ways: the
// free SHA-256 image-hash check (in paymentSlipSubmit.ts, independent of this
// file) and, new here, a check on the bank's own transaction reference.

export type SlipCheckResult =
  | { outcome: 'verified'; transRef: string; amount: number; note: string }
  | { outcome: 'duplicate'; note: string; transRef?: string }
  | { outcome: 'amount_mismatch'; note: string; transRef?: string }
  | { outcome: 'wrong_account'; note: string; transRef?: string }
  | { outcome: 'inconclusive'; note: string }

type Slip2GoResponse = {
  code: string
  message: string
  data?: {
    transRef?: string
    amount?: number
  }
}

export async function verifySlipWithSlipOk(
  fileBytes: Uint8Array,
  contentType: string,
  expectedAmountBaht: number,
): Promise<SlipCheckResult> {
  // .trim() guards against a stray trailing space/newline from copy-pasting the
  // key out of the Slip2Go dashboard into Vercel — a very common cause of a
  // silent 401 that has nothing to do with the key itself being wrong.
  const secretKey = process.env.SLIP2GO_SECRET_KEY?.trim()
  if (!secretKey) {
    return { outcome: 'inconclusive', note: 'ยังไม่ได้ตั้งค่าระบบตรวจสลิปอัตโนมัติ (SLIP2GO_SECRET_KEY) — ตรวจด้วยตนเอง' }
  }

  try {
    // PROMPTPAY_ID is reused here (not a separate env var) — it's already the
    // phone number the shop's PromptPay QR is generated from, in the same
    // plain 10-digit form Slip2Go expects for accountType 02001 (PromptPay by
    // phone). If the shop ever switches to a national-ID-based PromptPay
    // account, this receiver check should be revisited (different accountType).
    const receiverPhone = (process.env.PROMPTPAY_ID || '').replace(/\D/g, '')
    const payload: Record<string, unknown> = {
      checkDuplicate: true,
      checkAmount: { type: 'eq', amount: expectedAmountBaht.toFixed(2) },
    }
    if (receiverPhone.length === 10) {
      payload.checkReceiver = [{ accountType: '02001', accountNumber: receiverPhone }]
    }

    const form = new FormData()
    form.append('file', new Blob([fileBytes], { type: contentType }), 'slip.jpg')
    form.append('payload', JSON.stringify(payload))

    // Confirmed against Slip2Go's own "Authentication" page code sample:
    // headers: { Authorization: 'Bearer {secretKey}' } — the Bearer prefix IS
    // required (an earlier attempt without it produced "Authentication Token
    // Mismatch").
    const response = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
      method: 'POST',
      headers: { authorization: `Bearer ${secretKey}` },
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
    if (!response.ok || !result) {
      const detail = result?.message ? ` — ${result.message}` : ''
      return {
        outcome: 'inconclusive',
        note: `ระบบตรวจสลิปอัตโนมัติตอบกลับผิดปกติ (HTTP ${response.status}${detail}) กรุณาตรวจด้วยตนเอง`,
      }
    }

    const transRef = result.data?.transRef
    if (result.code !== '200000' || !result.data) {
      return {
        outcome: 'inconclusive',
        note: result.message ? `ตรวจอัตโนมัติไม่สำเร็จ: ${result.message}` : 'ระบบตรวจสลิปอัตโนมัติไม่สามารถยืนยันได้ กรุณาตรวจด้วยตนเอง',
      }
    }

    // Belt-and-suspenders: data.amount isn't masked (unlike account numbers),
    // so re-confirm it ourselves even though checkAmount already asked
    // Slip2Go to do the same check server-side.
    const slipAmount = result.data.amount
    if (typeof slipAmount !== 'number' || Math.round(slipAmount * 100) !== Math.round(expectedAmountBaht * 100)) {
      return {
        outcome: 'amount_mismatch',
        note: `ยอดในสลิป (${slipAmount ?? '-'} บาท) ไม่ตรงกับยอดที่ต้องชำระ (${expectedAmountBaht.toFixed(2)} บาท)`,
        transRef,
      }
    }

    return {
      outcome: 'verified',
      transRef: transRef || '',
      amount: slipAmount,
      note: `ตรวจสอบอัตโนมัติผ่าน ✅ ยอด ${slipAmount.toFixed(2)} บาท ตรงกับราคา · เลขอ้างอิง ${transRef || '-'}`,
    }
  } catch (error) {
    return {
      outcome: 'inconclusive',
      note: error instanceof Error ? `เรียกระบบตรวจสลิปอัตโนมัติไม่สำเร็จ: ${error.message}` : 'เรียกระบบตรวจสลิปอัตโนมัติไม่สำเร็จ',
    }
  }
}
