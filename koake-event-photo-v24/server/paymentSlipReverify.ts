import crypto from 'node:crypto'
import { isAdminRequest, supabaseAdmin, supabaseRest, type ApiRequest, type ApiResponse } from './utils.js'
import { verifySlipWithSlip2Go } from './slipVerification.js'

type OrderRow = { id: string; order_number: string; payment_status: string; payment_slip_path: string | null; amount_satang: number }
const autoRejectOutcomes = new Set(['duplicate', 'amount_mismatch', 'wrong_account', 'invalid_slip'])

// Lets the photographer re-run Slip2Go against an already-uploaded slip
// without asking the customer to resubmit anything — needed because orders
// that got stuck under_review during the 401 outage never got a second
// chance at auto-approval once the auth bug was fixed.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'ADMIN_LOGIN_REQUIRED' })
  const body = (req.body || {}) as { orderId?: string }
  const orderId = body.orderId
  if (!orderId) return res.status(400).json({ error: 'INVALID_REVERIFY_INPUT' })

  try {
    const orders = await supabaseRest<OrderRow[]>(
      `event_photo_orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,payment_status,payment_slip_path,amount_satang&limit=1`,
    )
    const order = orders[0]
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
    if (order.payment_status === 'paid') return res.status(409).json({ error: 'ORDER_ALREADY_PAID' })
    if (!order.payment_slip_path) return res.status(409).json({ error: 'PAYMENT_SLIP_REQUIRED' })
    if (order.payment_status !== 'under_review') return res.status(409).json({ error: 'PAYMENT_NOT_UNDER_REVIEW' })

    const download = await supabaseAdmin().storage.from('payment-slips').download(order.payment_slip_path)
    if (!download.data) return res.status(500).json({ error: 'SLIP_FILE_DOWNLOAD_FAILED' })
    const bytes = new Uint8Array(await download.data.arrayBuffer())
    const contentType = download.data.type || 'image/jpeg'
    const fileHash = crypto.createHash('sha256').update(bytes).digest('hex')

    // Same reuse check the original submit flow runs — the slip could since
    // have become a duplicate of a newer order.
    const duplicates = await supabaseRest<Array<{ order_number: string }>>(
      `event_photo_orders?slip_file_sha256=eq.${fileHash}&id=neq.${order.id}&select=order_number&limit=1`,
    )
    if (duplicates[0]) {
      const note = `สลิปนี้เคยถูกใช้กับคำสั่งซื้อ ${duplicates[0].order_number} มาแล้ว ไม่สามารถใช้ซ้ำได้`
      await patchOrder(order.id, 'under_review', { payment_status: 'rejected', payment_reviewed_at: new Date().toISOString(), payment_review_note: note, slip_auto_check_note: note, slip_file_sha256: fileHash })
      console.info('SLIP2GO_REVERIFY_RESULT', { orderId: order.id, orderNumber: order.order_number, outcome: 'duplicate_hash' })
      return res.status(200).json({ ok: true, outcome: 'rejected', note })
    }

    const check = await verifySlipWithSlip2Go(bytes, contentType, order.amount_satang / 100)
    const note = check.note
    const transRef = 'transRef' in check ? check.transRef || null : null

    if (check.outcome === 'verified' && transRef) {
      const transRefDuplicates = await supabaseRest<Array<{ order_number: string }>>(
        `event_photo_orders?slip_trans_ref=eq.${encodeURIComponent(transRef)}&id=neq.${order.id}&select=order_number&limit=1`,
      )
      if (transRefDuplicates[0]) {
        const dupeNote = `เลขอ้างอิงธุรกรรมนี้เคยถูกใช้กับคำสั่งซื้อ ${transRefDuplicates[0].order_number} มาแล้ว ไม่สามารถใช้ซ้ำได้`
        await patchOrder(order.id, 'under_review', { payment_status: 'rejected', payment_reviewed_at: new Date().toISOString(), payment_review_note: dupeNote, slip_auto_check_note: dupeNote, slip_trans_ref: transRef, slip_file_sha256: fileHash })
        console.info('SLIP2GO_REVERIFY_RESULT', { orderId: order.id, orderNumber: order.order_number, outcome: 'duplicate_transref' })
        return res.status(200).json({ ok: true, outcome: 'rejected', note: dupeNote })
      }
    }

    if (autoRejectOutcomes.has(check.outcome)) {
      await patchOrder(order.id, 'under_review', { payment_status: 'rejected', payment_reviewed_at: new Date().toISOString(), payment_review_note: note, slip_auto_check_note: note, slip_trans_ref: transRef, slip_file_sha256: fileHash })
      console.info('SLIP2GO_REVERIFY_RESULT', { orderId: order.id, orderNumber: order.order_number, outcome: check.outcome })
      return res.status(200).json({ ok: true, outcome: 'rejected', note })
    }

    if (check.outcome !== 'verified') {
      await patchOrder(order.id, 'under_review', { slip_auto_check_note: note, slip_file_sha256: fileHash })
      console.info('SLIP2GO_REVERIFY_RESULT', { orderId: order.id, orderNumber: order.order_number, outcome: 'inconclusive' })
      return res.status(200).json({ ok: true, outcome: 'under_review', note })
    }

    // Verified — approve through the exact same RPC the manual "approve" button
    // and the original auto-approval path both use, so side effects are identical.
    try {
      const reviewed = await supabaseRest<Array<{ payment_status: string }>>('rpc/review_event_photo_payment', {
        method: 'POST',
        body: JSON.stringify({ p_order_id: order.id, p_decision: 'approve', p_note: note }),
      })
      const approved = reviewed[0]?.payment_status === 'paid'
      await supabaseRest(`event_photo_orders?id=eq.${order.id}&select=id`, {
        method: 'PATCH',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({ slip_auto_check_note: note, slip_trans_ref: transRef, slip_file_sha256: fileHash }),
      }).catch(() => undefined)
      console.info('SLIP_AUTO_APPROVAL_RESULT', { orderId: order.id, orderNumber: order.order_number, outcome: approved ? 'approved' : 'rpc_no_effect', source: 'reverify' })
      if (!approved) return res.status(200).json({ ok: true, outcome: 'under_review', note: 'ตรวจผ่านแต่ปลดล็อกไม่สำเร็จ ลองใหม่อีกครั้งหรืออนุมัติเองในหลังบ้าน' })
      return res.status(200).json({ ok: true, outcome: 'paid', note })
    } catch (error) {
      console.error('SLIP_AUTO_APPROVAL_FAILED', { orderId: order.id, orderNumber: order.order_number, error: error instanceof Error ? error.message : 'UNKNOWN', source: 'reverify' })
      return res.status(200).json({ ok: true, outcome: 'under_review', note: 'ตรวจผ่านแต่เรียกระบบอนุมัติไม่สำเร็จ ลองใหม่อีกครั้งหรืออนุมัติเองในหลังบ้าน' })
    }
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'SLIP_REVERIFY_FAILED' })
  }
}

// Every write is guarded by the order still being in the state we last saw it
// in (usually payment_status=under_review), so two overlapping reverify
// clicks just race harmlessly — whichever request's write lands first wins,
// and the loser's guarded PATCH matches zero rows instead of corrupting state.
async function patchOrder(orderId: string, requiredStatus: string, body: Record<string, unknown>): Promise<void> {
  await supabaseRest(`event_photo_orders?id=eq.${orderId}&payment_status=eq.${requiredStatus}&select=id`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
}
