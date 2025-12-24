# ===================================================================
#  SAFE NODE / NVM PATH FIX FOR JULIAN'S SYSTEM
# ===================================================================
#  This script:
#   ✔ Backs up current PATH values
#   ✔ Removes ONLY the broken nvm4w paths
#   ✔ Keeps the correct NVM paths
#   ✔ Rebuilds PATH cleanly (User + Machine)
#   ✔ NO file deletions
# ===================================================================

Write-Host "==== BACKING UP CURRENT PATH VARIABLES ====" -ForegroundColor Yellow

# Backup directory
$backupDir = "$env:USERPROFILE\node_path_backup"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# Back up PATH
[IO.File]::WriteAllText("$backupDir\PATH_USER_BACKUP.txt",
    [Environment]::GetEnvironmentVariable("Path","User"))

[IO.File]::WriteAllText("$backupDir\PATH_MACHINE_BACKUP.txt",
    [Environment]::GetEnvironmentVariable("Path","Machine"))

Write-Host "Backups stored in: $backupDir" -ForegroundColor Green



# ===================================================================
#  DEFINING WHICH PATH ENTRIES TO KEEP (CORRECT PATH)
# ===================================================================

$KeepPaths = @(
    "C:\Users\triha\AppData\Local\nvm",                   # Correct NVM root
    "C:\Users\triha\AppData\Local\nvm\20.19.0",           # This will be active after install
    "C:\Program Files\cursor\resources\app\bin",          # Cursor
    "C:\Users\triha\AppData\Local\Programs\cursor\resources\app\codeBin",  # Cursor bin
    "C:\Users\triha\AppData\Local\Programs\Microsoft VS Code\bin"          # VSCode bin
)

# ===================================================================
#  DEFINING WHICH PATHS TO REMOVE (BAD ENTRIES)
# ===================================================================

$RemovePaths = @(
    "C:\nvm4w",
    "C:\nvm4w\nodejs"
)

Write-Host "==== CLEANING USER PATH ====" -ForegroundColor Yellow

$userPath = [Environment]::GetEnvironmentVariable("Path","User").Split(";")

# Remove bad paths, keep the good ones + everything else not related to node
$newUserPath = $userPath |
    Where-Object {
        $p = $_.Trim()
        if ($p -eq "") { return $false }

        # Remove the broken paths
        if ($RemovePaths -contains $p) { return $false }

        # Keep everything else
        return $true
    }

# Add required keep paths if missing
foreach ($kp in $KeepPaths) {
    if (-not ($newUserPath -contains $kp)) {
        $newUserPath += $kp
    }
}

# Save new PATH
$newUserPathString = ($newUserPath -join ";")
[Environment]::SetEnvironmentVariable("Path", $newUserPathString, "User")

Write-Host "User PATH cleaned successfully." -ForegroundColor Green



Write-Host "==== CLEANING MACHINE PATH ====" -ForegroundColor Yellow

$machinePath = [Environment]::GetEnvironmentVariable("Path","Machine").Split(";")

$newMachinePath = $machinePath |
    Where-Object {
        $p = $_.Trim()
        if ($p -eq "") { return $false }

        if ($RemovePaths -contains $p) { return $false }

        return $true
    }

foreach ($kp in $KeepPaths) {
    if (-not ($newMachinePath -contains $kp)) {
        $newMachinePath += $kp
    }
}

$newMachinePathString = ($newMachinePath -join ";")
[Environment]::SetEnvironmentVariable("Path", $newMachinePathString, "Machine")

Write-Host "Machine PATH cleaned successfully." -ForegroundColor Green

Write-Host ""
Write-Host "=============================================="
Write-Host "   PATH CLEAN COMPLETE — RESTART POWERSHELL"
Write-Host "=============================================="
Write-Host ""
Write-Host "Next:"
Write-Host "1. Close PowerShell completely"
Write-Host "2. Re-open PowerShell"
Write-Host "3. Run the following:"
Write-Host ""
Write-Host "   nvm uninstall 18.20.4"
Write-Host "   nvm install 20.19.0"
Write-Host "   nvm use 20.19.0"
Write-Host ""
Write-Host "Then check:"
Write-Host "   node -v"
Write-Host ""
Write-Host "Expected: v20.19.0" -ForegroundColor Green
Write-Host ""
