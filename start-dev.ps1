#!/usr/bin/env pwsh
# start-dev.ps1 — Avvia Vite e Electron per lo sviluppo

$ErrorActionPreference = 'Continue'

# Kill stale processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start Vite dev server
Write-Host "  Avvio Vite su http://localhost:5176  ..." -ForegroundColor Cyan
$viteJob = Start-Job { Set-Location D:\pro.cardesign; npx vite --port 5176 --strictPort 2>&1 }

# Wait for Vite to be ready (poll localhost)
$maxWait = 30
$ready = $false
for ($i = 0; $i -lt $maxWait; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5176" -UseBasicParsing -TimeoutSec 2
        Write-Host "  Vite pronto (HTTP $($r.StatusCode))" -ForegroundColor Green
        $ready = $true
        break
    } catch {
        Write-Host "  Attendo Vite... ($($i+1)/$maxWait)" -ForegroundColor Gray
    }
}

if (-not $ready) {
    Write-Host "  Vite non risponde dopo ${maxWait}s. Controlla logs." -ForegroundColor Red
    Receive-Job $viteJob
    exit 1
}

# Start Electron
Write-Host "  Avvio Electron..." -ForegroundColor Cyan
$electronJob = Start-Job { Set-Location D:\pro.cardesign; npx electron . 2>&1 }

Write-Host ""
Write-Host "  VoxelCAD avviato." -ForegroundColor Green
Write-Host "  Vite  : job $($viteJob.Id)  (http://localhost:5176)" -ForegroundColor Gray
Write-Host "  Electron: job $($electronJob.Id)" -ForegroundColor Gray
Write-Host "  Premi Ctrl+C per fermare." -ForegroundColor Yellow
Write-Host ""

# Forward jobs output to console
try {
    while ($true) {
        Start-Sleep -Milliseconds 500
        foreach ($j in @($viteJob, $electronJob)) {
            $out = Receive-Job $j -Keep
            if ($out) { Write-Host $out -NoNewline }
        }
    }
} finally {
    Write-Host "`n  Arresto processi..." -ForegroundColor Yellow
    Stop-Job $viteJob, $electronJob -ErrorAction SilentlyContinue
    Remove-Job $viteJob, $electronJob -Force -ErrorAction SilentlyContinue
    Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  Fatto." -ForegroundColor Green
}
