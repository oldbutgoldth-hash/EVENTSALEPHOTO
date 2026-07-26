@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================
echo KOAKE Event Photo - QRCode Dependency Repair
echo ==============================================
echo.

if not exist package.json (
  echo [ERROR] ไม่พบ package.json
  echo กรุณานำไฟล์นี้ไปวางในโฟลเดอร์โปรเจกต์เดียวกับ package.json แล้วดับเบิลคลิกใหม่
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] ไม่พบ Node.js กรุณาติดตั้ง Node.js 20 LTS ก่อน
  pause
  exit /b 1
)

echo [1/4] ปิด cache ของ Vite...
if exist node_modules\.vite rmdir /s /q node_modules\.vite

echo [2/4] ติดตั้ง qrcode 1.5.4...
call npm install qrcode@1.5.4 --save
if errorlevel 1 goto :failed

echo [3/4] ติดตั้ง TypeScript definitions...
call npm install @types/qrcode@1.5.5 --save-dev
if errorlevel 1 goto :failed

echo [4/4] เปิด Development Server...
echo.
call npm run dev -- --force
exit /b %errorlevel%

:failed
echo.
echo [ERROR] ติดตั้งไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่
pause
exit /b 1
