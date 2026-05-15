@echo off
cd /d D:\pro.cardesign

echo === Killing existing processes ===
taskkill /f /im node.exe 2>nul
taskkill /f /im vite 2>nul
taskkill /f /im electron 2>nul
timeout /t 2 /nobreak >nul

echo === Starting Vite dev server on port 5176 ===
start /B cmd /c "npx vite --port 5176 --strictPort > %TEMP%\vite.log 2>&1"

echo === Waiting for Vite to start... ===
timeout /t 6 /nobreak >nul

echo === Testing Vite server ===
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5176/' -TimeoutSec 3; Write-Host 'STATUS: OK - ' $r.StatusCode } catch { Write-Host 'STATUS: FAIL - ' $_.Exception.Message }"

echo === Starting Electron ===
start /B cmd /c "cd /d D:\pro.cardesign && npx electron . > %TEMP%\electron.log 2>&1"

echo === Done ===
type %TEMP%\vite.log