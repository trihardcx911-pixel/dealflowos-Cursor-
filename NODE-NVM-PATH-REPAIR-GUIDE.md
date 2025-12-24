# Node.js/NVM PATH Conflict Repair Guide

## ⚠️ IMPORTANT: READ THIS FIRST

**DO NOT run any destructive commands until you have:**
1. Run the diagnostic script
2. Reviewed the output
3. Confirmed which paths need to be removed

---

## Step 1: Run Diagnostic Script

Run the diagnostic script to gather information about your current PATH:

```powershell
.\diagnose-node-path.ps1
```

This will:
- Show which Node.exe is currently active
- List ALL Node-related PATH entries
- Check common Node installation locations
- Identify NVM installation
- Show PATH priority order
- Save a diagnostic report to a file

**Review the output carefully before proceeding.**

---

## Step 2: Understanding the Diagnostic Output

### What to Look For:

1. **Current Node Location** (Section 1)
   - This shows which `node.exe` is being used
   - Compare this with NVM's expected location

2. **Node-Related PATH Entries** (Section 3)
   - Entries tagged with **NVM** = KEEP (these are needed)
   - Entries tagged with **NODEJS** or **NODE** = REMOVE (rogue installations)
   - Entries tagged with **CURSOR** or **VSCODE** = REVIEW (may need to stay but should come after NVM)

3. **PATH Priority** (Section 6)
   - Windows uses PATH entries in order (first match wins)
   - NVM entries should come BEFORE any other Node installations
   - Cursor/VS Code entries can stay but should come AFTER NVM

---

## Step 3: Manual PATH Inspection (Optional)

If you want to inspect PATH manually:

```powershell
# View current PATH (what's actually being used)
$env:PATH -split ';' | ForEach-Object { $i = 0 } { Write-Host "[$i] $_"; $i++ }

# View Machine-level PATH
[Environment]::GetEnvironmentVariable("Path", "Machine") -split ';' | ForEach-Object { $i = 0 } { Write-Host "[MACHINE $i] $_"; $i++ }

# View User-level PATH
[Environment]::GetEnvironmentVariable("Path", "User") -split ';' | ForEach-Object { $i = 0 } { Write-Host "[USER $i] $_"; $i++ }

# Find all Node executables in PATH
$env:PATH -split ';' | ForEach-Object {
    $nodePath = Join-Path $_ "node.exe"
    if (Test-Path $nodePath) {
        Write-Host "Found node.exe at: $nodePath"
        $version = & $nodePath --version 2>&1
        Write-Host "  Version: $version"
    }
}
```

---

## Step 4: Safety Checks Before Making Changes

Run these commands to create backups:

```powershell
# Backup current PATH settings
$machinePathBackup = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPathBackup = [Environment]::GetEnvironmentVariable("Path", "User")

# Save backups to files
$machinePathBackup | Out-File -FilePath "PATH_MACHINE_BACKUP_$(Get-Date -Format 'yyyyMMdd-HHmmss').txt" -Encoding UTF8
$userPathBackup | Out-File -FilePath "PATH_USER_BACKUP_$(Get-Date -Format 'yyyyMMdd-HHmmss').txt" -Encoding UTF8

Write-Host "Backups saved!" -ForegroundColor Green
```

---

## Step 5: Identify Paths to Remove

Based on your diagnostic output, identify:

### ❌ PATHS TO REMOVE (Rogue Node Installations):
- `C:\Program Files\nodejs` (or `C:\Program Files (x86)\nodejs`)
- `C:\nodejs`
- Any other Node installation directories that are NOT NVM

### ✅ PATHS TO KEEP (NVM-Related):
- NVM installation directory (e.g., `C:\Users\<username>\AppData\Local\nvm` or `C:\nvm4w`)
- NVM's nodejs symlink directory (e.g., `C:\Users\<username>\AppData\Local\nvm\nodejs`)

### ⚠️ PATHS TO REVIEW (Editor-Related):
- Cursor's Node (usually safe to keep, but should come after NVM)
- VS Code's Node (usually safe to keep, but should come after NVM)

---

## Step 6: Fix PATH (Machine Scope)

**⚠️ Run these commands ONE AT A TIME and verify after each step:**

```powershell
# 1. Get current Machine PATH
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine") -split ';'

# 2. Remove rogue Node paths (REPLACE WITH ACTUAL PATHS FROM YOUR DIAGNOSTIC)
$pathsToRemove = @(
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs",
    "C:\nodejs"
    # Add other rogue paths from your diagnostic here
)

$cleanedMachinePath = $machinePath | Where-Object {
    $path = $_.Trim()
    $shouldKeep = $true
    foreach ($removePath in $pathsToRemove) {
        if ($path -eq $removePath -or $path -like "*$removePath*") {
            $shouldKeep = $false
            break
        }
    }
    $shouldKeep
}

# 3. Ensure NVM paths are at the beginning (REPLACE WITH YOUR NVM PATHS)
$nvmPaths = @(
    "C:\Users\$env:USERNAME\AppData\Local\nvm"  # Adjust to your NVM path
    # Add other NVM-related paths here
)

# Remove NVM paths from current list (to avoid duplicates)
$cleanedMachinePath = $cleanedMachinePath | Where-Object {
    $path = $_.Trim()
    $isNvmPath = $false
    foreach ($nvmPath in $nvmPaths) {
        if ($path -eq $nvmPath -or $path -like "*$nvmPath*") {
            $isNvmPath = $true
            break
        }
    }
    -not $isNvmPath
}

# 4. Prepend NVM paths to the beginning
$newMachinePath = ($nvmPaths + $cleanedMachinePath) -join ';'

# 5. Preview the new PATH (REVIEW THIS CAREFULLY!)
Write-Host "New Machine PATH will be:" -ForegroundColor Yellow
$newMachinePath -split ';' | ForEach-Object { $i = 0 } { Write-Host "[$i] $_"; $i++ }

# 6. Ask for confirmation before applying
$confirm = Read-Host "Apply this change? (yes/no)"
if ($confirm -eq "yes") {
    [Environment]::SetEnvironmentVariable("Path", $newMachinePath, "Machine")
    Write-Host "Machine PATH updated!" -ForegroundColor Green
} else {
    Write-Host "Change cancelled." -ForegroundColor Yellow
}
```

---

## Step 7: Fix PATH (User Scope)

**⚠️ Run these commands ONE AT A TIME and verify after each step:**

```powershell
# 1. Get current User PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User") -split ';'

# 2. Remove rogue Node paths (REPLACE WITH ACTUAL PATHS FROM YOUR DIAGNOSTIC)
$pathsToRemove = @(
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs",
    "C:\nodejs"
    # Add other rogue paths from your diagnostic here
)

$cleanedUserPath = $userPath | Where-Object {
    $path = $_.Trim()
    $shouldKeep = $true
    foreach ($removePath in $pathsToRemove) {
        if ($path -eq $removePath -or $path -like "*$removePath*") {
            $shouldKeep = $false
            break
        }
    }
    $shouldKeep
}

# 3. Ensure NVM paths are at the beginning (REPLACE WITH YOUR NVM PATHS)
$nvmPaths = @(
    "C:\Users\$env:USERNAME\AppData\Local\nvm"  # Adjust to your NVM path
    # Add other NVM-related paths here
)

# Remove NVM paths from current list (to avoid duplicates)
$cleanedUserPath = $cleanedUserPath | Where-Object {
    $path = $_.Trim()
    $isNvmPath = $false
    foreach ($nvmPath in $nvmPaths) {
        if ($path -eq $nvmPath -or $path -like "*$nvmPath*") {
            $isNvmPath = $true
            break
        }
    }
    -not $isNvmPath
}

# 4. Prepend NVM paths to the beginning
$newUserPath = ($nvmPaths + $cleanedUserPath) -join ';'

# 5. Preview the new PATH (REVIEW THIS CAREFULLY!)
Write-Host "New User PATH will be:" -ForegroundColor Yellow
$newUserPath -split ';' | ForEach-Object { $i = 0 } { Write-Host "[$i] $_"; $i++ }

# 6. Ask for confirmation before applying
$confirm = Read-Host "Apply this change? (yes/no)"
if ($confirm -eq "yes") {
    [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
    Write-Host "User PATH updated!" -ForegroundColor Green
} else {
    Write-Host "Change cancelled." -ForegroundColor Yellow
}
```

---

## Step 8: Reload Environment Variables

After modifying PATH, you need to reload it:

```powershell
# Reload PATH from registry
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verify the new PATH
Write-Host "Updated PATH:" -ForegroundColor Green
$env:PATH -split ';' | Select-String -Pattern "node|nvm" | ForEach-Object { Write-Host "  $_" }
```

**OR** simply close and reopen your PowerShell terminal.

---

## Step 9: Verify NVM is Working

```powershell
# Check NVM is accessible
nvm version

# List installed versions
nvm list

# Check current version
nvm current

# Try switching to Node 20.19.0
nvm use 20.19.0

# Verify Node version
node -v

# Verify Node location
Get-Command node | Select-Object Source

# The Source should point to NVM's directory, not C:\Program Files\nodejs
```

---

## Step 10: Reinstall Node via NVM (If Needed)

If NVM still doesn't work correctly, reinstall from scratch:

```powershell
# 1. Uninstall all Node versions via NVM (optional - only if you want a clean slate)
nvm list
# Note: You may need to manually delete versions if nvm uninstall doesn't work

# 2. Install Node 20.19.0
nvm install 20.19.0

# 3. Set it as default
nvm use 20.19.0

# 4. Verify
node -v
npm -v

# 5. (Optional) Set as default for new terminals
nvm alias default 20.19.0
```

---

## Step 11: Final Verification

Run this comprehensive check:

```powershell
Write-Host "`n=== FINAL VERIFICATION ===" -ForegroundColor Cyan

# Check Node version
$nodeVersion = node -v
Write-Host "Node version: $nodeVersion" -ForegroundColor $(if ($nodeVersion -like "v20*") { "Green" } else { "Red" })

# Check Node location
$nodePath = (Get-Command node).Source
Write-Host "Node path: $nodePath" -ForegroundColor White
$isNvmPath = $nodePath -like "*nvm*"
Write-Host "Is NVM path: $isNvmPath" -ForegroundColor $(if ($isNvmPath) { "Green" } else { "Red" })

# Check NVM current
$nvmCurrent = nvm current 2>&1
Write-Host "NVM current: $nvmCurrent" -ForegroundColor White

# Check all Node executables in PATH
Write-Host "`nAll node.exe locations in PATH:" -ForegroundColor Yellow
$nodeExes = @()
$env:PATH -split ';' | ForEach-Object {
    $nodePath = Join-Path $_ "node.exe"
    if (Test-Path $nodePath) {
        $version = & $nodePath --version 2>&1
        $nodeExes += [PSCustomObject]@{
            Path = $nodePath
            Version = $version
        }
        Write-Host "  $nodePath ($version)" -ForegroundColor $(if ($nodePath -like "*nvm*") { "Green" } else { "Red" })
    }
}

if ($nodeExes.Count -gt 1) {
    Write-Host "`nWARNING: Multiple node.exe found in PATH!" -ForegroundColor Red
    Write-Host "Only the first one (from NVM) should be active." -ForegroundColor Yellow
} else {
    Write-Host "`n✓ Only one node.exe found - Good!" -ForegroundColor Green
}

Write-Host "`n=== VERIFICATION COMPLETE ===" -ForegroundColor Cyan
```

---

## Troubleshooting

### If NVM still doesn't work after fixing PATH:

1. **Check NVM installation:**
   ```powershell
   # Find NVM installation
   Get-ChildItem -Path "$env:LOCALAPPDATA", "$env:APPDATA", "C:\" -Filter "nvm.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
   ```

2. **Reinstall NVM:**
   - Download from: https://github.com/coreybutler/nvm-windows/releases
   - Or use: `winget install CoreyButler.NVMforWindows`

3. **Check NVM settings:**
   ```powershell
   # Find settings.txt
   Get-ChildItem -Path "$env:LOCALAPPDATA", "$env:APPDATA", "C:\" -Filter "settings.txt" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Directory.Name -eq "nvm" } | Select-Object FullName
   ```

4. **Manual NVM PATH setup:**
   If NVM isn't adding itself to PATH automatically, you may need to add:
   - `C:\Users\<username>\AppData\Local\nvm` (or your NVM install path)
   - This should be the FIRST entry in your PATH

---

## Summary Checklist

- [ ] Run diagnostic script
- [ ] Review diagnostic output
- [ ] Backup current PATH
- [ ] Identify paths to remove
- [ ] Fix Machine PATH
- [ ] Fix User PATH
- [ ] Reload environment variables
- [ ] Verify NVM is working
- [ ] Reinstall Node via NVM (if needed)
- [ ] Run final verification
- [ ] Confirm Node version is correct

---

## Need Help?

If you're stuck, share:
1. The diagnostic script output
2. The output of `Get-Command node | Select-Object Source`
3. The output of `$env:PATH -split ';' | Select-String -Pattern "node|nvm"`

This will help identify the exact issue.












