@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Node.js. Hay cai Node.js roi chay lai file nay.
  pause
  exit /b 1
)

echo Dang khoi dong Hom Nay tai http://localhost:3000
echo Nhan Ctrl+C de dung server.
node server.js

echo.
echo Server da dung hoac gap loi. Xem thong bao phia tren.
pause
