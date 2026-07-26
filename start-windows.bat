@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo KO'AKE Event Photo v1.2.0 Album Lifecycle
echo ================================================
where node >nul 2>nul || (
  echo ERROR: ไม่พบ Node.js กรุณาติดตั้ง Node.js 20 LTS
  pause
  exit /b 1
)
node -v
npm -v
if not exist node_modules (
  echo.
  echo กำลังติดตั้ง package...
  call npm install
  if errorlevel 1 (
    echo.
    echo ติดตั้ง package ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่
    pause
    exit /b 1
  )
)
echo.
echo Vite จะแสดง URL ที่เปิดได้ในหน้าต่างนี้ (ปกติ http://localhost:5173/)
call npm run dev
pause
