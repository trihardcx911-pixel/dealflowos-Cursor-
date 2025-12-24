# Node.js Environment Setup Guide

## Current Status
- Node.js: NOT in PATH
- NVM: NOT installed
- Action Required: Install NVM for Windows

## Step-by-Step Instructions

### Step 1: Install NVM for Windows
1. Download from: https://github.com/coreybutler/nvm-windows/releases
2. Download: nvm-setup.exe (latest version)
3. Run installer as Administrator
4. Restart PowerShell after installation

### Step 2: Configure NVM Environment
Run: .\setup-nvm.ps1
Then restart PowerShell

### Step 3: Install Node 18.20.4
Run: .\install-node18.ps1

### Step 4: Clean and Reinstall
Run: .\clean-install.ps1

### Step 5: Verify
Run: npm run dev:all

## Alternative: Manual Setup

If scripts don't work, manually:

1. Install NVM from GitHub
2. Set environment variables:
   - NVM_HOME = %USERPROFILE%\AppData\Roaming\nvm
   - NVM_SYMLINK = %USERPROFILE%\AppData\Roaming\nvm\nodejs
3. Add to PATH:
   - %NVM_HOME%
   - %NVM_SYMLINK%
4. Restart PowerShell
5. Run: nvm install 18.20.4
6. Run: nvm use 18.20.4
7. Run: nvm alias default 18.20.4
8. Navigate to project: cd C:\Code\wholesale-crm
9. Run: Remove-Item -Recurse -Force node_modules
10. Run: npm install
11. Run: npx prisma generate
