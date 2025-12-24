# Clean Machine PATH: Remove outdated Node v18.20.4 entries, ensure NVM v20.19.0 paths are present, preserve all other system/dev tool paths
$machinePath = ([Environment]::GetEnvironmentVariable("Path","Machine") -split ';' | Where-Object { $_.Trim() -ne '' -and $_ -notlike '*nvm4w*' -and $_ -notlike '*\v18.20.4*' -and $_ -notlike '*\18.20.4*' }) + @('C:\Users\triha\AppData\Local\nvm','C:\Users\triha\AppData\Local\nvm\v20.19.0') | Select-Object -Unique; [Environment]::SetEnvironmentVariable("Path", ($machinePath -join ';'), "Machine")

