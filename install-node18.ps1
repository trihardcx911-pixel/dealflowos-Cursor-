# Node 18 Installation Script
# Run this AFTER NVM is installed and PATH is updated

Write-Host "Installing Node 18.20.4..." -ForegroundColor Cyan

# Refresh environment
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Install Node 18.20.4
nvm install 18.20.4

# Set as default
nvm use 18.20.4
nvm alias default 18.20.4

Write-Host "Node 18.20.4 installed and set as default" -ForegroundColor Green
Write-Host "Verifying installation..." -ForegroundColor Cyan

node -v
npm -v
