# ============================================================================
# Node.js/NVM PATH Conflict Diagnostic Script
# ============================================================================
# Run this script FIRST to gather diagnostic information
# DO NOT run any destructive commands until you review the output
# ============================================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "NODE.JS/NVM PATH DIAGNOSTIC REPORT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ============================================================================
# 1. CURRENT NODE VERSION AND LOCATION
# ============================================================================
Write-Host "1. CURRENT NODE STATE" -ForegroundColor Yellow
Write-Host "   --------------------" -ForegroundColor Yellow

$nodeVersion = node -v 2>&1
Write-Host "   Node version (node -v): $nodeVersion" -ForegroundColor White

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    Write-Host "   Node executable path: $($nodeCommand.Source)" -ForegroundColor White
    Write-Host "   Node executable directory: $($nodeCommand.Path)" -ForegroundColor White
} else {
    Write-Host "   WARNING: 'node' command not found!" -ForegroundColor Red
}

$npmVersion = npm -v 2>&1
Write-Host "   NPM version (npm -v): $npmVersion" -ForegroundColor White

$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCommand) {
    Write-Host "   NPM executable path: $($npmCommand.Source)" -ForegroundColor White
}

Write-Host ""

# ============================================================================
# 2. NVM STATUS
# ============================================================================
Write-Host "2. NVM STATUS" -ForegroundColor Yellow
Write-Host "   -----------" -ForegroundColor Yellow

$nvmCommand = Get-Command nvm -ErrorAction SilentlyContinue
if ($nvmCommand) {
    Write-Host "   NVM command found: $($nvmCommand.Source)" -ForegroundColor Green
} else {
    Write-Host "   WARNING: 'nvm' command not found!" -ForegroundColor Red
}

# Try to get NVM version
try {
    $nvmVersion = nvm version 2>&1
    Write-Host "   NVM version: $nvmVersion" -ForegroundColor White
} catch {
    Write-Host "   Could not get NVM version" -ForegroundColor Yellow
}

# Check NVM installed versions
Write-Host "`n   Installed Node versions:" -ForegroundColor White
try {
    $nvmList = nvm list 2>&1
    $nvmList | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
} catch {
    Write-Host "     Could not list NVM versions" -ForegroundColor Yellow
}

# Check current NVM active version
Write-Host "`n   Current NVM active version:" -ForegroundColor White
try {
    $nvmCurrent = nvm current 2>&1
    Write-Host "     $nvmCurrent" -ForegroundColor Gray
} catch {
    Write-Host "     Could not get current NVM version" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# 3. COMPLETE PATH ANALYSIS
# ============================================================================
Write-Host "3. COMPLETE PATH ANALYSIS" -ForegroundColor Yellow
Write-Host "   -----------------------" -ForegroundColor Yellow

# Get all PATH entries
$envPath = $env:PATH -split ';'
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine") -split ';'
$userPath = [Environment]::GetEnvironmentVariable("Path", "User") -split ';'

Write-Host "`n   Total PATH entries: $($envPath.Count)" -ForegroundColor White
Write-Host "   Machine PATH entries: $($machinePath.Count)" -ForegroundColor White
Write-Host "   User PATH entries: $($userPath.Count)" -ForegroundColor White

# Find all Node-related paths
Write-Host "`n   NODE-RELATED PATH ENTRIES:" -ForegroundColor Cyan
Write-Host "   (Entries containing: nodejs, node.exe, nvm, cursor)" -ForegroundColor Gray

$nodeRelatedPaths = @()
$index = 0

foreach ($pathEntry in $envPath) {
    $pathEntry = $pathEntry.Trim()
    if ([string]::IsNullOrWhiteSpace($pathEntry)) { continue }
    
    $lowerPath = $pathEntry.ToLower()
    $isNodeRelated = $false
    $tags = @()
    
    if ($lowerPath -like "*nodejs*") { $isNodeRelated = $true; $tags += "NODEJS" }
    if ($lowerPath -like "*node.exe*") { $isNodeRelated = $true; $tags += "NODE.EXE" }
    if ($lowerPath -like "*\node*") { $isNodeRelated = $true; $tags += "NODE" }
    if ($lowerPath -like "*nvm*") { $isNodeRelated = $true; $tags += "NVM" }
    if ($lowerPath -like "*cursor*") { $isNodeRelated = $true; $tags += "CURSOR" }
    if ($lowerPath -like "*vscode*" -or $lowerPath -like "*code*") { $isNodeRelated = $true; $tags += "VSCODE" }
    
    if ($isNodeRelated) {
        $scope = "Unknown"
        if ($machinePath -contains $pathEntry) { $scope = "Machine" }
        if ($userPath -contains $pathEntry) { $scope = "User" }
        if ($machinePath -contains $pathEntry -and $userPath -contains $pathEntry) { $scope = "Both" }
        
        $nodeRelatedPaths += [PSCustomObject]@{
            Index = $index
            Path = $pathEntry
            Tags = ($tags -join ", ")
            Scope = $scope
            Exists = (Test-Path $pathEntry)
        }
        
        $color = if ($tags -contains "NVM") { "Green" } 
                 elseif ($tags -contains "CURSOR" -or $tags -contains "VSCODE") { "Yellow" }
                 else { "Red" }
        
        Write-Host "     [$index] [$scope] [$($tags -join ', ')]" -ForegroundColor $color
        Write-Host "         $pathEntry" -ForegroundColor Gray
        Write-Host "         Exists: $(if (Test-Path $pathEntry) { 'YES' } else { 'NO' })" -ForegroundColor $(if (Test-Path $pathEntry) { "Green" } else { "Red" })
    }
    $index++
}

if ($nodeRelatedPaths.Count -eq 0) {
    Write-Host "     No Node-related paths found in PATH" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# 4. COMMON NODE INSTALLATION LOCATIONS
# ============================================================================
Write-Host "4. COMMON NODE INSTALLATION LOCATIONS" -ForegroundColor Yellow
Write-Host "   -----------------------------------" -ForegroundColor Yellow

$commonLocations = @(
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs",
    "C:\Users\$env:USERNAME\AppData\Local\nvm",
    "C:\nvm4w",
    "C:\nvm4w\nodejs",
    "C:\nvm",
    "C:\nodejs",
    "$env:APPDATA\npm",
    "$env:APPDATA\nvm",
    "$env:LOCALAPPDATA\nvm",
    "$env:LOCALAPPDATA\nodejs"
)

foreach ($location in $commonLocations) {
    $expanded = $location -replace '\$env:USERNAME', $env:USERNAME -replace '\$env:APPDATA', $env:APPDATA -replace '\$env:LOCALAPPDATA', $env:LOCALAPPDATA
    if (Test-Path $expanded) {
        $nodeExe = Join-Path $expanded "node.exe"
        $hasNode = Test-Path $nodeExe
        $version = "N/A"
        
        if ($hasNode) {
            try {
                $versionInfo = & $nodeExe --version 2>&1
                $version = $versionInfo.ToString().Trim()
            } catch {
                $version = "Could not get version"
            }
        }
        
        Write-Host "   [$expanded]" -ForegroundColor $(if ($hasNode) { "Red" } else { "Gray" })
        Write-Host "     Exists: YES | Has node.exe: $(if ($hasNode) { "YES ($version)" } else { "NO" })" -ForegroundColor $(if ($hasNode) { "Red" } else { "Gray" })
    } else {
        Write-Host "   [$expanded]" -ForegroundColor DarkGray
        Write-Host "     Exists: NO" -ForegroundColor DarkGray
    }
}

Write-Host ""

# ============================================================================
# 5. NVM INSTALLATION CHECK
# ============================================================================
Write-Host "5. NVM INSTALLATION CHECK" -ForegroundColor Yellow
Write-Host "   -----------------------" -ForegroundColor Yellow

$nvmPaths = @(
    "$env:APPDATA\nvm",
    "$env:LOCALAPPDATA\nvm",
    "C:\Users\$env:USERNAME\AppData\Local\nvm",
    "C:\nvm4w",
    "C:\nvm"
)

$nvmFound = $false
foreach ($nvmPath in $nvmPaths) {
    if (Test-Path $nvmPath) {
        Write-Host "   Found NVM directory: $nvmPath" -ForegroundColor Green
        $nvmFound = $true
        
        # Check for nvm.exe
        $nvmExe = Join-Path $nvmPath "nvm.exe"
        if (Test-Path $nvmExe) {
            Write-Host "     ✓ nvm.exe found" -ForegroundColor Green
        }
        
        # Check for settings.txt
        $settingsFile = Join-Path $nvmPath "settings.txt"
        if (Test-Path $settingsFile) {
            Write-Host "     ✓ settings.txt found" -ForegroundColor Green
            $settings = Get-Content $settingsFile -Raw
            Write-Host "     Settings content:" -ForegroundColor Gray
            $settings -split "`n" | ForEach-Object { Write-Host "       $_" -ForegroundColor DarkGray }
        }
        
        # List nodejs versions
        $nodejsDir = Join-Path $nvmPath "nodejs"
        if (Test-Path $nodejsDir) {
            $versions = Get-ChildItem $nodejsDir -Directory -ErrorAction SilentlyContinue
            if ($versions) {
                Write-Host "     Installed Node versions:" -ForegroundColor White
                foreach ($ver in $versions) {
                    Write-Host "       - $($ver.Name)" -ForegroundColor Gray
                }
            }
        }
    }
}

if (-not $nvmFound) {
    Write-Host "   WARNING: No NVM installation directory found!" -ForegroundColor Red
}

Write-Host ""

# ============================================================================
# 6. PATH PRIORITY ANALYSIS
# ============================================================================
Write-Host "6. PATH PRIORITY ANALYSIS" -ForegroundColor Yellow
Write-Host "   -----------------------" -ForegroundColor Yellow
Write-Host "   (Earlier entries take priority)" -ForegroundColor Gray

if ($nodeRelatedPaths.Count -gt 0) {
    Write-Host "`n   PATH ORDER (first match wins):" -ForegroundColor White
    foreach ($pathInfo in $nodeRelatedPaths) {
        $priority = if ($pathInfo.Tags -like "*NVM*") { "✓ KEEP (NVM)" } 
                   elseif ($pathInfo.Tags -like "*CURSOR*" -or $pathInfo.Tags -like "*VSCODE*") { "⚠ REVIEW (Editor)" }
                   else { "✗ REMOVE (Rogue Node)" }
        
        Write-Host "     [$($pathInfo.Index)] $priority" -ForegroundColor $(if ($priority -like "*KEEP*") { "Green" } elseif ($priority -like "*REVIEW*") { "Yellow" } else { "Red" })
        Write-Host "         $($pathInfo.Path)" -ForegroundColor Gray
    }
} else {
    Write-Host "   No Node-related paths to analyze" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# 7. RECOMMENDATIONS
# ============================================================================
Write-Host "7. RECOMMENDATIONS" -ForegroundColor Yellow
Write-Host "   ---------------" -ForegroundColor Yellow

Write-Host "`n   Based on the analysis above:" -ForegroundColor White
Write-Host "   1. Review the Node-related PATH entries listed in section 3" -ForegroundColor White
Write-Host "   2. Identify which entries are NVM-related (should be KEPT)" -ForegroundColor White
Write-Host "   3. Identify which entries are rogue Node installations (should be REMOVED)" -ForegroundColor White
Write-Host "   4. Cursor/VS Code entries may need to stay, but should come AFTER NVM" -ForegroundColor White
Write-Host "`n   NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   - Review this output carefully" -ForegroundColor White
Write-Host "   - Run the fix script ONLY after confirming which paths to remove" -ForegroundColor White
Write-Host "   - The fix script will be generated based on YOUR specific PATH structure" -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DIAGNOSTIC COMPLETE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Export results to file
$outputFile = "node-path-diagnostic-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$diagnosticOutput = @"
NODE.JS/NVM PATH DIAGNOSTIC REPORT
Generated: $(Get-Date)

CURRENT NODE STATE:
- Node version: $nodeVersion
- Node path: $($nodeCommand.Source)
- NPM version: $npmVersion
- NPM path: $($npmCommand.Source)

NODE-RELATED PATH ENTRIES:
$($nodeRelatedPaths | Format-Table -AutoSize | Out-String)

COMMON LOCATIONS CHECKED:
$(foreach ($loc in $commonLocations) { "- $loc" })

"@

$diagnosticOutput | Out-File -FilePath $outputFile -Encoding UTF8
Write-Host "Diagnostic report saved to: $outputFile" -ForegroundColor Green
Write-Host ""












