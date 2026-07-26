# Vercel Build Fix v1.4.4

แก้ข้อผิดพลาด `vite: command not found` / exit code 127

## สาเหตุ
Vercel install กำลัง omit/prune devDependencies ทำให้ `vite`, `typescript` และ build tooling ไม่ถูกติดตั้ง

## สิ่งที่แก้
- บังคับ `npm ci --include=dev` ผ่าน `vercel.json`
- บังคับ `npm run build`
- ระบุ framework เป็น Vite และ output เป็น `dist`
- เพิ่ม `.npmrc` ด้วย `include=dev` เป็น fallback

## Vercel Dashboard
ลบ Environment Variables ต่อไปนี้หากมี:
- `NODE_ENV=production`
- `NPM_CONFIG_PRODUCTION=true`
- `NPM_CONFIG_OMIT=dev`

Build Command ใช้ `npm run build` หรือปิด Override เพื่อให้ `vercel.json` ทำงาน
Install Command ใช้ `npm ci --include=dev` หรือปิด Override
