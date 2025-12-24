# NVM for Windows Setup Script
# Run this AFTER installing NVM for Windows

Write-Host "Setting up NVM environment..." -ForegroundColor Cyan

# Set NVM environment variables (default locations)
$nvmHome = "$env:USERPROFILE\AppData\Roaming\nvm"
$nvmSymlink = "$env:USERPROFILE\AppData\Roaming\nvm\nodejs"

# Add to user PATH if not already present
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathParts = $userPath -split ';'

if ($pathParts -notcontains $nvmHome) {
    $newPath = $userPath + ";" + $nvmHome
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Added NVM_HOME to PATH" -ForegroundColor Green
}

if ($pathParts -notcontains $nvmSymlink) {
    $newPath = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + $nvmSymlink
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Added NVM_SYMLINK to PATH" -ForegroundColor Green
}

# Set environment variables
[Environment]::SetEnvironmentVariable("NVM_HOME", $nvmHome, "User")
[Environment]::SetEnvironmentVariable("NVM_SYMLINK", $nvmSymlink, "User")

Write-Host "NVM environment configured. Please restart PowerShell." -ForegroundColor Green
