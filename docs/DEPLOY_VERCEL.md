# Deploy บน Vercel

## 1. เตรียมบริการ

- สร้าง Supabase project และรัน migration ทั้ง 4 ไฟล์ตาม README
- สร้าง ImageKit account และเตรียม Public Key, Private Key และ URL Endpoint
- เตรียมหมายเลขพร้อมเพย์ (เบอร์โทร 10 หลักหรือเลขบัตร 13 หลัก)

## 2. นำโปรเจกต์ขึ้น Git

สร้าง repository แล้ว push โฟลเดอร์นี้ โดยไฟล์ `.gitignore` จะกัน `node_modules`, `dist`, `.env.local` และข้อมูลลับออกจาก Git

## 3. Import ใน Vercel

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

## 4. Environment Variables

เพิ่มค่าต่อไปนี้ทั้ง Production และ Preview ตามความเหมาะสม:

### หน้าเว็บ

```env
VITE_DATA_MODE=live
VITE_SITE_URL=https://YOUR-DOMAIN.vercel.app
VITE_EVENT_SHARE_TOKEN=TOKEN_อัลบั้ม
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/YOUR_ID
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### Server only

```env
SITE_URL=https://YOUR-DOMAIN.vercel.app
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
IMAGEKIT_PUBLIC_KEY=YOUR_PUBLIC_KEY
IMAGEKIT_PRIVATE_KEY=YOUR_PRIVATE_KEY
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/YOUR_ID
PROMPTPAY_ID=0812345678
PROMPTPAY_ACCOUNT_NAME=ชื่อที่ต้องการแสดง
ADMIN_PASSWORD=รหัสผ่านหลังบ้านที่เดายาก
ADMIN_SESSION_SECRET=ข้อความสุ่มยาวอย่างน้อย32ตัวอักษร
CRON_SECRET=ข้อความสุ่มยาวอย่างน้อย16ตัวอักษร

# ไม่บังคับ — ถ้าไม่ใส่ ระบบจะข้ามการตรวจสลิปอัตโนมัติและใช้การตรวจด้วยมือเหมือนเดิม
SLIPOK_API_KEY=API_KEY_จาก_slipok.com
SLIPOK_BRANCH_ID=BRANCH_ID_จาก_slipok.com

# ไม่บังคับ — ฟรี ถ้าไม่ใส่ ระบบจะข้ามการแจ้งเตือน Telegram (วิธีสร้างดูใน README)
TELEGRAM_BOT_TOKEN=โทเคนบอทจาก_BotFather
TELEGRAM_CHAT_ID=chat_id_ของคุณ
```

ห้ามเติม `VITE_` หน้า Service Role Key, ImageKit Private Key, รหัสแอดมิน หรือ Session Secret เพราะค่าที่ขึ้นต้นด้วย `VITE_` จะถูกส่งไปที่เบราว์เซอร์

## 5. ตรวจหลัง Deploy

1. ล็อกอินหลังบ้านที่ `/?admin=1`
2. สร้างงานและอัปโหลดรูปทดสอบ 1 รูป
3. ตรวจว่า ImageKit มีไฟล์ `original` แบบ private และ `preview` แบบมีลายน้ำ
4. เปิดลิงก์อัลบั้ม เลือกรูป สร้างออเดอร์ และสแกน QR
5. อัปโหลดสลิป แล้วตรวจว่าหลังบ้านเปิดสลิปได้
6. กดอนุมัติ และตรวจว่าลูกค้าดาวน์โหลดไฟล์ต้นฉบับได้

Vercel Cron จะเรียก `/api/cron-lifecycle` ทุกวันเวลา 20:00 UTC (ประมาณ 03:00 น. เวลาไทย) เพื่อปิดอัลบั้มและจัดการไฟล์ตามอายุที่ตั้งไว้
