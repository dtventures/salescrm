@echo off
rem Double-click to start the CRM on Windows.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the download page - install it, then double-click this file again.
  start https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules call npm install
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
if exist .env (call npm start) else (
  echo No .env yet, so showing sample data.
  node scripts\demo.js && set NO_SYNC=1&& set COMPANY_LOGOS=off&& set DATA_FILE=data\demo.json&& node server.js
)
pause
