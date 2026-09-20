@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem Racing Life Blender Worker
rem Double-click: scans Blender\worker_input and publishes report.
rem Drag a folder onto this file: scans that folder instead.
rem Second argument --local-only: do not publish to GitHub.
rem ============================================================

cd /d "%~dp0"
set "REPO_ROOT=%CD%"

set "INPUT_DIR=%REPO_ROOT%\Blender\worker_input"
if not "%~1"=="" (
    if /I not "%~1"=="--local-only" set "INPUT_DIR=%~1"
)

set "OUTPUT_DIR=%REPO_ROOT%\Blender\worker_output"
if not exist "%INPUT_DIR%" mkdir "%INPUT_DIR%"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

dir /b "%INPUT_DIR%\*.fbx" >nul 2>nul
if errorlevel 1 (
    echo.
    echo ============================================================
    echo NO FBX FILES FOUND
    echo ============================================================
    echo Put the FBX files here:
    echo   %INPUT_DIR%
    echo.
    echo Or drag a folder containing FBX files onto this .bat file.
    echo.
    pause
    exit /b 2
)

set "BLENDER_EXE=%RACING_LIFE_BLENDER_EXE%"

if defined BLENDER_EXE (
    if not exist "%BLENDER_EXE%" (
        echo RACING_LIFE_BLENDER_EXE points to a missing file:
        echo   %BLENDER_EXE%
        set "BLENDER_EXE="
    )
)

if not defined BLENDER_EXE (
    for /f "delims=" %%I in ('where blender.exe 2^>nul') do (
        if not defined BLENDER_EXE set "BLENDER_EXE=%%I"
    )
)

if not defined BLENDER_EXE (
    if exist "%ProgramFiles%\Blender Foundation" (
        for /f "delims=" %%D in ('dir /b /ad /o-n "%ProgramFiles%\Blender Foundation\Blender *" 2^>nul') do (
            if not defined BLENDER_EXE (
                if exist "%ProgramFiles%\Blender Foundation\%%D\blender.exe" (
                    set "BLENDER_EXE=%ProgramFiles%\Blender Foundation\%%D\blender.exe"
                )
            )
        )
    )
)

rem User portable/current Blender location
if not defined BLENDER_EXE (
    if exist "C:\Windows\desktop\blender.exe" (
        set "BLENDER_EXE=C:\Windows\desktop\blender.exe"
    )
)

rem Extra detection: Steam and per-user Blender installs
if not defined BLENDER_EXE (
    if exist "%ProgramFiles(x86)%\Steam\steamapps\common\Blender\blender.exe" (
        set "BLENDER_EXE=%ProgramFiles(x86)%\Steam\steamapps\common\Blender\blender.exe"
    )
)

if not defined BLENDER_EXE (
    for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$roots=@($env:ProgramFiles+'\Blender Foundation',$env:LOCALAPPDATA+'\Programs'); $steam=${env:ProgramFiles(x86)}+'\Steam\steamapps\common\Blender'; if($steam){$roots+=$steam}; foreach($r in $roots){if($r -and (Test-Path $r)){Get-ChildItem -Path $r -Filter blender.exe -File -Recurse -ErrorAction SilentlyContinue}} | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName"`) do (
        if not defined BLENDER_EXE set "BLENDER_EXE=%%I"
    )
)

if not defined BLENDER_EXE (
    echo.
    echo ============================================================
    echo BLENDER NOT FOUND
    echo ============================================================
    echo Install Blender or set this environment variable:
    echo   RACING_LIFE_BLENDER_EXE=C:\Path\To\blender.exe
    echo.
    pause
    exit /b 3
)

echo.
echo ============================================================
echo RACING LIFE BLENDER WORKER
echo ============================================================
echo Blender:
echo   %BLENDER_EXE%
echo Input:
echo   %INPUT_DIR%
echo Output:
echo   %OUTPUT_DIR%
echo ============================================================
echo.

set "PUBLISH_ARG=--publish"
if /I "%~1"=="--local-only" set "PUBLISH_ARG="
if /I "%~2"=="--local-only" set "PUBLISH_ARG="
if /I "%RACING_LIFE_BLENDER_LOCAL_ONLY%"=="1" set "PUBLISH_ARG="

"%BLENDER_EXE%" --background --factory-startup ^
  --python "%REPO_ROOT%\tools\blender_worker\inspect_fbx.py" -- ^
  --input "%INPUT_DIR%" ^
  --output "%OUTPUT_DIR%" ^
  --repo "%REPO_ROOT%" ^
  %PUBLISH_ARG%

set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
    echo ============================================================
    echo BLENDER WORKER FINISHED
    echo ============================================================
    echo Local reports:
    echo   %OUTPUT_DIR%\asset-report.json
    echo   %OUTPUT_DIR%\asset-report.md
    if defined PUBLISH_ARG (
        echo.
        echo The worker also attempted to publish the report to:
        echo   feature/3d-racing-foundation
    )
) else (
    echo ============================================================
    echo BLENDER WORKER FAILED - EXIT CODE %EXIT_CODE%
    echo ============================================================
    echo Scroll up for the exact error.
)

echo.
pause
exit /b %EXIT_CODE%
