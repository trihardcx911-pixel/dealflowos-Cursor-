# Manual Node 18 Switch Script
# Use this if NVM commands fail

$nvmHome = "C:\Users\triha\AppData\Local\nvm"
$node18Path = "$nvmHome\v18.20.4"
$symlink = "C:\nvm4w\nodejs"

if (Test-Path $node18Path) {
    Write-Host "Node 18.20.4 found, creating symlink..." -ForegroundColor Cyan
    
    # Remove existing symlink
    if (Test-Path $symlink) {
        Remove-Item $symlink -Force -ErrorAction SilentlyContinue
    }
    
    # Create symlink to Node 18
    New-Item -ItemType SymbolicLink -Path $symlink -Target $node18Path -Force | Out-Null
    
    Write-Host "Symlink created" -ForegroundColor Green
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Host "Verifying..." -ForegroundColor Cyan
    node -v
    npm -v
} else {
    Write-Host "Node 18.20.4 not found. Please install it first." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/dist/v18.20.4/node-v18.20.4-x64.msi" -ForegroundColor Yellow
}
