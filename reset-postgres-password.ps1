# Reset PostgreSQL superuser password script (password-prompt version)

$pgHbaPath = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$serviceName = "postgresql-x64-18"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

# Prompt for new postgres password
$newPassword = Read-Host -AsSecureString "Enter new Postgres password"
$newPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($newPassword))

Write-Host "Stopping PostgreSQL service..." -ForegroundColor Yellow
Stop-Service $serviceName -Force

# Read pg_hba.conf
$lines = Get-Content $pgHbaPath

# Replace scram-sha-256 with trust (ONLY the 3 targeted lines)
$updated = $lines -replace '^\s*local\s+all\s+all\s+scram-sha-256\s*$', 'local   all             all                                     trust'
$updated = $updated -replace '^\s*host\s+all\s+all\s+127\.0\.0\.1/32\s+scram-sha-256\s*$', 'host    all             all             127.0.0.1/32            trust'
$updated = $updated -replace '^\s*host\s+all\s+all\s+::1/128\s+scram-sha-256\s*$', 'host    all             all             ::1/128                 trust'

# Write updated pg_hba.conf
Set-Content $pgHbaPath $updated -Encoding UTF8

Write-Host "Starting PostgreSQL service with TRUST authentication..." -ForegroundColor Yellow
Start-Service $serviceName
Start-Sleep -Seconds 2

# Run ALTER USER to change the password
& $psql -U postgres -c "ALTER USER postgres WITH PASSWORD '$newPasswordPlain';"

Write-Host "Restoring secure scram-sha-256 authentication..." -ForegroundColor Yellow

# Restore back to scram-sha-256
$lines = Get-Content $pgHbaPath
$restored = $lines -replace '^\s*local\s+all\s+all\s+trust\s*$', 'local   all             all                                     scram-sha-256'
$restored = $restored -replace '^\s*host\s+all\s+all\s+127\.0\.0\.1/32\s+trust\s*$', 'host    all             all             127.0.0.1/32            scram-sha-256'
$restored = $restored -replace '^\s*host\s+all\s+all\s+::1/128\s+trust\s*$', 'host    all             all             ::1/128                 scram-sha-256'

Set-Content $pgHbaPath $restored -Encoding UTF8

Write-Host "Restarting PostgreSQL service..." -ForegroundColor Yellow
Restart-Service $serviceName

Write-Host "PostgreSQL password reset successfully." -ForegroundColor Green
