# KO’AKE Event Photo v1.3.4

เว็บขายภาพกิจกรรมสำหรับช่างภาพ ลูกค้าค้นหาและเลือกภาพ ระบบคิดราคาตามจำนวน แสดง QR พร้อมเพย์ตามยอด รับสลิปแบบ private และเปิดดาวน์โหลดไฟล์เต็มเมื่อแอดมินอนุมัติ

## ขั้นตอนของลูกค้า

1. เปิดลิงก์อัลบั้มและเลือก 1–10 รูป
2. ระบบคำนวณราคาอัตโนมัติ
3. สร้างคำสั่งซื้อและสแกน QR พร้อมเพย์
4. อัปโหลดสลิป JPG, PNG หรือ WebP ไม่เกิน 6 MB
5. รอช่างภาพตรวจสลิป
6. เมื่ออนุมัติแล้ว ดาวน์โหลดไฟล์ต้นฉบับแบบไม่มีลายน้ำได้ 7 วัน

## ราคาเริ่มต้น

| จำนวน | ราคา |
|---:|---:|
| 1 รูป | 50 บาท |
| 2 รูป | 80 บาท |
| 3 รูป | 100 บาท |
| 4 รูป | 130 บาท |
| 5 รูป | 150 บาท |
| 6 รูป | 170 บาท |
| 7 รูป | 190 บาท |
| 8 รูป | 210 บาท |
| 9 รูป | 230 บาท |
| 10 รูป | 250 บาท |

## โครงสร้างระบบ

- Vercel: หน้าเว็บและ API
- Supabase: ฐานข้อมูลอัลบั้ม รูป ราคา ออเดอร์ และ Storage private สำหรับสลิป
- ImageKit: พรีวิวลายน้ำและไฟล์ต้นฉบับ private
- PromptPay: สร้าง QR แบบระบุยอดจาก `PROMPTPAY_ID`

API ถูกจัดรวมให้เหลือ 12 Vercel Functions เพื่อรองรับข้อจำกัดของแผน Hobby โดย URL เดิมยังใช้งานได้ผ่าน `vercel.json`

## เริ่มใช้งานในเครื่อง

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

- หน้าร้าน: `http://localhost:5173/`
- หลังบ้าน: `http://localhost:5173/?admin=1`

โหมดเริ่มต้นเป็น demo หากต้องการเชื่อมระบบจริงให้ตั้ง `VITE_DATA_MODE=live`

## ตั้งฐานข้อมูล

รัน migration ใน Supabase SQL Editor ตามลำดับ:

1. `supabase/migrations/20260724_event_photo_complete.sql`
2. `supabase/migrations/20260724_event_photo_lifecycle_v120.sql`
3. `supabase/migrations/20260726_payment_slips_v130.sql`
4. `supabase/migrations/20260726_event_photo_hardening_v131.sql`

Migration ลำดับที่ 3 จะสร้าง bucket `payment-slips` แบบ private และจำกัดไฟล์ไม่เกิน 6 MB ส่วนลำดับที่ 4 เพิ่มการตรวจสถานะสลิปแบบ atomic และป้องกันการอนุมัติเมื่อไฟล์ต้นฉบับไม่พร้อม

## Deploy

ดูรายการตั้งค่าใน `docs/DEPLOY_VERCEL.md`
