$lines = Get-Content -Path 'D:\pro.cardesign\src\voxel-engine.js'
$braceCount = 0
$inClass = $false
$classStartLine = 0

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    $lineNum = $i + 1
    
    if (-not $inClass -and $line -match '^\s*export\s+class\s+VoxelEngine') {
        $inClass = $true
        $classStartLine = $lineNum
        $braceCount = 0
        Write-Host "CLASS START: Line $lineNum"
        continue
    }
    
    if ($inClass) {
        $opens = [regex]::Matches($line, '\{').Count
        $closes = [regex]::Matches($line, '\}').Count
        $braceCount += $opens - $closes
        
        if ($opens -gt 0 -or $closes -gt 0) {
            Write-Host ("Line {0}: +{1} -{2} (running: {3}) {4}" -f `
                $lineNum, $opens, $closes, $braceCount, `
                ($line.Substring(0, [Math]::Min(40, $line.Length))))
        }
        
        if ($braceCount -lt 0) {
            Write-Host ""
            Write-Host "ERROR: Brace count went negative at line $lineNum!"
            Write-Host "This suggests the class ended early."
            break
        }
        
        if ($braceCount -eq 0 -and $classStartLine -gt 0) {
            Write-Host ""
            Write-Host "CLASS ENDS AT LINE $lineNum (brace count returned to zero)"
            break
        }
    }
}