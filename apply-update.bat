@echo off
if "%~1"=="" (
  echo Usage: apply-update.bat "C:\path\to\update.zip"
  goto :eof
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$zip='%~1'; $proj='%~dp0'; $tmp=Join-Path $env:TEMP ('rlupd_'+[guid]::NewGuid()); New-Item -ItemType Directory -Path $tmp | Out-Null; Expand-Archive -Path $zip -DestinationPath $tmp -Force; $items=Get-ChildItem -Path $tmp; if($items.Count -eq 1 -and $items[0].PSIsContainer){ $src=$items[0].FullName } else { $src=$tmp }; Copy-Item -Path (Join-Path $src '*') -Destination $proj -Recurse -Force; Remove-Item -Path $tmp -Recurse -Force; Write-Host 'Update applied successfully.'"
pause