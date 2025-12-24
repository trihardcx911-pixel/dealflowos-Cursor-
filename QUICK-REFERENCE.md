# Quick Reference: Node/NVM PATH Fix

## 🚀 Quick Start

### Step 1: Run Diagnostic
```powershell
.\diagnose-node-path.ps1
```

### Step 2: Review Output
- Look for "NODE-RELATED PATH ENTRIES" section
- Identify which paths are NVM (keep) vs rogue Node (remove)

### Step 3: Customize Fix Script
- Open `fix-node-path.ps1`
- Update `$NVM_PATH` with your actual NVM path
- Update `$PATHS_TO_REMOVE` with paths from diagnostic

### Step 4: Run Fix (Dry Run First)
```powershell
.\fix-node-path.ps1 -DryRun
```

### Step 5: Run Fix (For Real)
```powershell
.\fix-node-path.ps1
```

### Step 6: Reload & Verify
```powershell
# Close and reopen PowerShell, then:
nvm use 20.19.0
node -v
Get-Command node | Select-Object Source
```

---

## 🔍 Manual Diagnostic Commands

```powershell
# Which Node is active?
Get-Command node | Select-Object Source

# Current Node version
node -v

# All Node-related PATH entries
$env:PATH -split ';' | Select-String -Pattern "node|nvm"

# All node.exe locations
$env:PATH -split ';' | ForEach-Object {
    $nodePath = Join-Path $_ "node.exe"
    if (Test-Path $nodePath) {
        $version = & $nodePath --version 2>&1
        Write-Host "$nodePath ($version)"
    }
}

# NVM status
nvm version
nvm list
nvm current
```

---

## 🛠️ Manual PATH Fix (If Script Doesn't Work)

### Backup First
```powershell
[Environment]::GetEnvironmentVariable("Path", "Machine") | Out-File "PATH_MACHINE_BACKUP.txt"
[Environment]::GetEnvironmentVariable("Path", "User") | Out-File "PATH_USER_BACKUP.txt"
```

### Remove Rogue Paths (Machine)
```powershell
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine") -split ';'
$cleaned = $machinePath | Where-Object { $_ -notlike "*Program Files\nodejs*" -and $_ -notlike "*\nodejs" }
$newPath = ($cleaned | Where-Object { $_ -ne '' }) -join ';'
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
```

### Add NVM Path First (Machine)
```powershell
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine") -split ';'
$nvmPath = "C:\Users\$env:USERNAME\AppData\Local\nvm"  # Your NVM path
$newPath = ($nvmPath + ($machinePath | Where-Object { $_ -ne $nvmPath })) -join ';'
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
```

### Repeat for User PATH
```powershell
# Same commands but use "User" instead of "Machine"
```

### Reload PATH
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

---

## ✅ Verification Checklist

- [ ] `node -v` shows correct version
- [ ] `Get-Command node` points to NVM directory
- [ ] `nvm current` matches `node -v`
- [ ] No `C:\Program Files\nodejs` in PATH
- [ ] NVM path is first in PATH
- [ ] Only one `node.exe` found in PATH

---

## 📝 Common NVM Paths

- `C:\Users\<username>\AppData\Local\nvm` (most common)
- `C:\nvm4w`
- `C:\nvm`
- `%APPDATA%\nvm`
- `%LOCALAPPDATA%\nvm`

---

## ⚠️ Paths to Remove

- `C:\Program Files\nodejs`
- `C:\Program Files (x86)\nodejs`
- `C:\nodejs`
- Any other Node installation NOT managed by NVM

---

## 🔄 Reinstall Node via NVM

```powershell
# Install
nvm install 20.19.0

# Use
nvm use 20.19.0

# Set as default
nvm alias default 20.19.0

# Verify
node -v
npm -v
```












