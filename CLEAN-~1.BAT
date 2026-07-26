@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ลบ package เดิมและติดตั้งใหม่...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
call npm cache verify
call npm install
if errorlevel 1 (
  echo ติดตั้งไม่สำเร็จ
  pause
  exit /b 1
)
call npm run dev
pause
