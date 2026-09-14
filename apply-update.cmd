@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-update.ps1" -ZipPath %1
pause