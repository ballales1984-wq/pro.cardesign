#!/usr/bin/env pwsh
# Download ONNX models for Fase 7 AI Engine
# Run from project root: pwsh scripts/download-models.ps1

$ErrorActionPreference = 'Stop'

$modelsDir = "public/models"
$samDir = "$modelsDir/sam_vit_b"

Write-Host "Downloading MiDaS small model..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx" -OutFile "$modelsDir/model-small.onnx" -UseBasicParsing

Write-Host "Downloading SAM ViT-B quantized model..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $samDir | Out-Null
Invoke-WebRequest -Uri "https://huggingface.co/vietanhdev/segment-anything-onnx-models/resolve/main/sam_vit_b_01ec64_quant.zip" -OutFile "$modelsDir/sam_vit_b.zip" -UseBasicParsing
Expand-Archive -Path "$modelsDir/sam_vit_b.zip" -DestinationPath $samDir -Force
Remove-Item "$modelsDir/sam_vit_b.zip"

# Rename to match code expectation
if (Test-Path "$modelsDir/model-small.onnx") {
    Rename-Item -Path "$modelsDir/model-small.onnx" -NewName "midas_small.onnx" -Force
}

Write-Host "✓ Models downloaded successfully!" -ForegroundColor Green
Write-Host "  - public/models/midas_small.onnx (66.7 MB)"
Write-Host "  - public/models/sam_vit_b/*.quant.onnx (71.9 MB total)"