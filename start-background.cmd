@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-background.ps1"
if errorlevel 1 (
  echo.
  echo Khong the khoi dong server.
  pause
)
