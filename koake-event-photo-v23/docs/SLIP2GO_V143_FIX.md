# Slip2Go Auto-Unlock Fix v1.4.3

## ปัญหาที่แก้

1. เปลี่ยน Header จาก `Authorization: Bearer <secret>` เป็น `Authorization: <secret>` ตามคู่มือ Authentication ปัจจุบันของ Slip2Go
2. เปลี่ยนเงื่อนไขอนุมัติอัตโนมัติจาก `200000` เป็น `200200`
   - `200000` = ธนาคารพบสลิปเท่านั้น
   - `200200` = สลิปผ่านเงื่อนไขที่ส่งไป
3. จัดการรหัสผิดเงื่อนไขโดยตรง
   - `200401` บัญชีผู้รับไม่ตรง
   - `200402` ยอดไม่ตรง
   - `200404` ไม่พบสลิป
   - `200500` สลิปเสีย/ปลอม
   - `200501` สลิปซ้ำ
4. บังคับให้ `PROMPTPAY_ID` เป็นเบอร์ 10 หลักก่อนยอม Auto Approve
5. เพิ่ม Log แบบไม่เปิดเผย Secret
   - `SLIP2GO_VERIFY_RESULT`
   - `SLIP_AUTO_APPROVAL_FAILED`
6. เพิ่ม SQL hotfix ติดตั้ง `review_event_photo_payment` RPC อีกครั้ง

## ขั้นตอนติดตั้ง

1. รันไฟล์นี้ใน Supabase SQL Editor:
   `supabase/migrations/20260727_slip2go_auto_unlock_fix_v143.sql`
2. Push โปรเจกต์ขึ้น GitHub/Vercel
3. ตรวจ Environment Variables:
   - `SLIP2GO_SECRET_KEY` = Secret ตรง ๆ ไม่มี `Bearer`
   - `PROMPTPAY_ID=0660611066`
4. ใน Slip2Go Authentication ให้ IP Whitelist เป็น `*` ระหว่างทดสอบ
5. Redeploy Production
6. สร้างออเดอร์ใหม่และโอนตามยอดใหม่ทุกสตางค์ ห้ามใช้สลิปที่เคยส่งทดสอบแล้ว

## ผลที่ควรเห็น

เมื่อลูกค้าแนบ JPG/PNG ที่ถูกต้อง ระบบจะ:

`upload → Slip2Go 200200 → payment_status=paid → download_expires_at=+7 days → หน้าเว็บแสดงปุ่มดาวน์โหลด`
