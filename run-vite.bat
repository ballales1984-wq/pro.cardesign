@echo off
cd /d D:\pro.cardesign
echo === Killing existing node processes ===
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul
echo === Starting Vite on port 5176 ===
npx vite --port 5176 --strictPort --host 0.0.0.0