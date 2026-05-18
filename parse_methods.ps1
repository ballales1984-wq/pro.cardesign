param([string]$filePath)

$content = Get-Content -Path $filePath
$inClass = $false
$braceCount = 0
$classStartLine = 0
$classEndLine = 0
$methods = @()

for ($i = 0; $i -lt $content.Length; $i++) {
    $line = $content[$i]
    $lineNum = $i + 1
    
    # Find class start
    if ($line -match '^\s*export\s+class\s+VoxelEngine') {
        $inClass = $true
        $classStartLine = $lineNum
        $braceCount = 0
        continue
    }
    
    if ($inClass) {
        # Count braces to find class end
        foreach ($char in $line.ToCharArray()) {
            if ($char -eq '{') { $braceCount++ }
            if ($char -eq '}') { $braceCount-- }
        }
        
        # If we've closed all braces, we're at the end of class
        if ($braceCount -le 0) {
            $classEndLine = $lineNum
            $inClass = $false
            break
        }
        
        # Look for method definitions (4 spaces + method name + parameters)
        if ($line -match '^\s{4}[_a-zA-Z][\w]*\s*\([^)]*\)\s*\{') {
            # Extract method name
            if ($line -match '^\s{4}([_a-zA-Z][\w]*)\s*\(') {
                $methodName = $matches[1]
                # Get leading spaces
                $leadingSpaces = ($line -replace '\S.*', '').Length
                $methods += @{Line=$lineNum; Name=$methodName; Spaces=$leadingSpaces}
            }
        }
    }
}

# Output results
Write-Host "Class VoxelEngine:"
Write-Host "  Start line: $classStartLine"
Write-Host "  End line: $classEndLine"
Write-Host ""
Write-Host "Methods found:"
foreach ($method in $methods) {
    Write-Host ("  Line {0}: {1} (leading spaces: {2})" -f $method.Line, $method.Name, $method.Spaces)
}