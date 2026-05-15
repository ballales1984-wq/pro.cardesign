@echo off
cd /d D:\pro.cardesign

echo [1/4] Pulizia processi esistenti...
taskkill /f /im node.exe 2>nul
timeout /t 3 /nobreak >nul

echo [2/4] Avvio Vite dev server sulla porta 5176...
npx vite --port 5176 --strictPort