@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem Racing Life Blender Worker
rem
rem Double-click:
rem   inspect Blender\worker_input and publish the report.
rem
rem Commands:
rem   RacingLife-Blender.bat inspect
rem   RacingLife-Blender.bat convert
rem   RacingLife-Blender.bat normalize
rem   RacingLife-Blender.bat preview
rem   RacingLife-Blender.bat process
rem   RacingLife-Blender.bat validate-rig
rem   RacingLife-Blender.bat compare-skeletons
rem   RacingLife-Blender.bat extract-animation
rem
rem Optional:
rem   add a folder path to use it instead of Blender\worker_input
rem   add --local-only to skip GitHub report publishing
rem
rem process = normalize + GLB export + start/mid preview PNGs
rem ============================================================

cd /d "%~dp0"
set "REPO_ROOT=%CD%"
set "MODE=inspect"
set "INPUT_DIR=%REPO_ROOT%\Blender\worker_input"
set "OUTPUT_DIR=%REPO_ROOT%\Blender\worker_output"
set "LOCAL_ONLY=0"
set "TARGET_HEIGHT=%RACING_LIFE_TARGET_HEIGHT%"
if not defined TARGET_HEIGHT set "TARGET_HEIGHT=1.80"

:parse_args
if "%~1"=="" goto args_done

if /I "%~1"=="inspect" (
    set "MODE=inspect"
    shift
    goto parse_args
)
if /I "%~1"=="convert" (
    set "MODE=convert"
    shift
    goto parse_args
)
if /I "%~1"=="normalize" (
    set "MODE=normalize"
    shift
    goto parse_args
)
if /I "%~1"=="preview" (
    set "MODE=preview"
    shift
    goto parse_args
)
if /I "%~1"=="process" (
    set "MODE=process"
    shift
    goto parse_args
)
if /I "%~1"=="validate-rig" (
    set "MODE=validate-rig"
    shift
    goto parse_args
)
if /I "%~1"=="compare-skeletons" (
    set "MODE=compare-skeletons"
    shift
    goto parse_args
)
if /I "%~1"=="extract-animation" (
    set "MODE=extract-animation"
    shift
    goto parse_args
)
if /I "%~1"=="--local-only" (
    set "LOCAL_ONLY=1"
    shift
    goto parse_args
)

rem Anything else is treated as the source folder.
set "INPUT_DIR=%~1"
shift
goto parse_args

:args_done

if not exist "%INPUT_DIR%" mkdir "%INPUT_DIR%"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

dir /b "%INPUT_DIR%\*.fbx" >nul 2>nul
if errorlevel 1 (
    echo.
    echo ============================================================
    echo NO FBX FILES FOUND
    echo ============================================================
    echo Put FBX files here:
    echo   %INPUT_DIR%
    echo.
    echo Or pass/drag a folder containing FBX files.
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

rem User portable/current Blender location.
if not defined BLENDER_EXE (
    if exist "C:\Windows\desktop\blender.exe" (
        set "BLENDER_EXE=C:\Windows\desktop\blender.exe"
    )
)

rem Steam installation.
if not defined BLENDER_EXE (
    if exist "%ProgramFiles(x86)%\Steam\steamapps\common\Blender\blender.exe" (
        set "BLENDER_EXE=%ProgramFiles(x86)%\Steam\steamapps\common\Blender\blender.exe"
    )
)

rem Per-user/custom locations.
if not defined BLENDER_EXE (
    for /f "delims=" %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$roots=@($env:ProgramFiles+'\Blender Foundation',$env:LOCALAPPDATA+'\Programs'); foreach($r in $roots){if($r -and (Test-Path $r)){Get-ChildItem -Path $r -Filter blender.exe -File -Recurse -ErrorAction SilentlyContinue}} ^| Sort-Object FullName -Descending ^| Select-Object -First 1 -ExpandProperty FullName"') do (
        if not defined BLENDER_EXE set "BLENDER_EXE=%%I"
    )
)

if not defined BLENDER_EXE (
    echo.
    echo ============================================================
    echo BLENDER NOT FOUND
    echo ============================================================
    echo Install Blender or set:
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
echo Mode:
echo   %MODE%
echo Input:
echo   %INPUT_DIR%
echo Output:
echo   %OUTPUT_DIR%
if /I "%MODE%"=="normalize" echo Target height: %TARGET_HEIGHT%m
if /I "%MODE%"=="process" echo Target height: %TARGET_HEIGHT%m
echo ============================================================
echo.

set "PUBLISH_ARG=--publish"
if "%LOCAL_ONLY%"=="1" set "PUBLISH_ARG="
if /I "%RACING_LIFE_BLENDER_LOCAL_ONLY%"=="1" set "PUBLISH_ARG="

if /I "%MODE%"=="inspect" (
    "%BLENDER_EXE%" --background --factory-startup ^
      --python "%REPO_ROOT%\tools\blender_worker\inspect_fbx.py" -- ^
      --input "%INPUT_DIR%" ^
      --output "%OUTPUT_DIR%" ^
      --repo "%REPO_ROOT%" ^
      %PUBLISH_ARG%
) else if /I "%MODE%"=="validate-rig" (
    "%BLENDER_EXE%" --background --factory-startup ^
      --python "%REPO_ROOT%\tools\blender_worker\rig_tools.py" -- ^
      --input "%INPUT_DIR%" ^
      --output "%OUTPUT_DIR%" ^
      --repo "%REPO_ROOT%" ^
      --mode "%MODE%" ^
      %PUBLISH_ARG%
) else if /I "%MODE%"=="compare-skeletons" (
    "%BLENDER_EXE%" --background --factory-startup ^
      --python "%REPO_ROOT%\tools\blender_worker\rig_tools.py" -- ^
      --input "%INPUT_DIR%" ^
      --output "%OUTPUT_DIR%" ^
      --repo "%REPO_ROOT%" ^
      --mode "%MODE%" ^
      %PUBLISH_ARG%
) else if /I "%MODE%"=="extract-animation" (
    "%BLENDER_EXE%" --background --factory-startup ^
      --python "%REPO_ROOT%\tools\blender_worker\rig_tools.py" -- ^
      --input "%INPUT_DIR%" ^
      --output "%OUTPUT_DIR%" ^
      --repo "%REPO_ROOT%" ^
      --mode "%MODE%" ^
      %PUBLISH_ARG%
) else (
    "%BLENDER_EXE%" --background --factory-startup ^
      --python "%REPO_ROOT%\tools\blender_worker\process_fbx.py" -- ^
      --input "%INPUT_DIR%" ^
      --output "%OUTPUT_DIR%" ^
      --repo "%REPO_ROOT%" ^
      --mode "%MODE%" ^
      --target-height "%TARGET_HEIGHT%" ^
      %PUBLISH_ARG%
)

set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
    echo ============================================================
    echo BLENDER WORKER FINISHED
    echo ============================================================
    if /I "%MODE%"=="inspect" (
        echo Inspection reports:
        echo   %OUTPUT_DIR%\asset-report.json
        echo   %OUTPUT_DIR%\asset-report.md
    ) else if /I "%MODE%"=="validate-rig" (
        echo Rig reports:
        echo   %OUTPUT_DIR%\rig-report.json
        echo   %OUTPUT_DIR%\rig-report.md
    ) else if /I "%MODE%"=="compare-skeletons" (
        echo Rig comparison reports:
        echo   %OUTPUT_DIR%\rig-report.json
        echo   %OUTPUT_DIR%\rig-report.md
    ) else if /I "%MODE%"=="extract-animation" (
        echo Rig/extraction reports:
        echo   %OUTPUT_DIR%\rig-report.json
        echo   %OUTPUT_DIR%\rig-report.md
        echo.
        echo Extracted animation GLBs:
        echo   %OUTPUT_DIR%\extracted\
    ) else (
        echo Processing reports:
        echo   %OUTPUT_DIR%\processing-report.json
        echo   %OUTPUT_DIR%\processing-report.md
        echo.
        echo Generated asset files:
        echo   %OUTPUT_DIR%\processed\
    )
    if defined PUBLISH_ARG (
        echo.
        echo The small report was also sent to:
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
