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
rem   RacingLife-Blender.bat inspect-target
rem   RacingLife-Blender.bat retarget-test
rem   RacingLife-Blender.bat mixamo-base-test
rem   RacingLife-Blender.bat inspect-mixamo-player
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
set "TARGET_RIG=%RACING_LIFE_TARGET_RIG%"
if not defined TARGET_RIG set "TARGET_RIG=%REPO_ROOT%\Blender\male_base_mesh.glb"
set "RETARGET_SOURCE=%RACING_LIFE_RETARGET_SOURCE%"
if not defined RETARGET_SOURCE set "RETARGET_SOURCE=%INPUT_DIR%\Surprise Uppercut.fbx"

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
if /I "%~1"=="inspect-target" (
    set "MODE=inspect-target"
    shift
    goto parse_args
)
if /I "%~1"=="retarget-test" (
    set "MODE=retarget-test"
    shift
    goto parse_args
)
if /I "%~1"=="mixamo-base-test" (
    set "MODE=mixamo-base-test"
    shift
    goto parse_args
)
if /I "%~1"=="inspect-mixamo-player" (
    set "MODE=inspect-mixamo-player"
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

if /I "%MODE%"=="inspect-mixamo-player" (
    set "FOUND_MIXAMO_PLAYER="

    if exist "%REPO_ROOT%\Blender\inspect-target\MixamoPlayer.glb" (
        set "FOUND_MIXAMO_PLAYER=%REPO_ROOT%\Blender\inspect-target\MixamoPlayer.glb"
    )

    if not defined FOUND_MIXAMO_PLAYER (
        if exist "%REPO_ROOT%\Blender\worker_input\inspect-target\MixamoPlayer.glb" (
            set "FOUND_MIXAMO_PLAYER=%REPO_ROOT%\Blender\worker_input\inspect-target\MixamoPlayer.glb"
        )
    )

    if not defined FOUND_MIXAMO_PLAYER (
        for /r "%REPO_ROOT%" %%F in (MixamoPlayer.glb) do (
            if not defined FOUND_MIXAMO_PLAYER set "FOUND_MIXAMO_PLAYER=%%~fF"
        )
    )

    if not defined FOUND_MIXAMO_PLAYER (
        echo.
        echo ============================================================
        echo MIXAMOPLAYER.GLB NOT FOUND
        echo ============================================================
        echo Put MixamoPlayer.glb anywhere inside the Racing Life repo,
        echo preferably:
        echo   %REPO_ROOT%\Blender\inspect-target\MixamoPlayer.glb
        echo.
        pause
        exit /b 10
    )

    set "TARGET_RIG=%FOUND_MIXAMO_PLAYER%"
)

if not exist "%INPUT_DIR%" mkdir "%INPUT_DIR%"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

set "HAS_ASSET="
if exist "%INPUT_DIR%\*.fbx" set "HAS_ASSET=1"
if exist "%INPUT_DIR%\*.glb" set "HAS_ASSET=1"
if exist "%INPUT_DIR%\*.gltf" set "HAS_ASSET=1"

if not defined HAS_ASSET (
    echo.
    echo ============================================================
    echo NO SUPPORTED 3D ASSETS FOUND
    echo ============================================================
    echo Put FBX, GLB or GLTF files here:
    echo   %INPUT_DIR%
    echo.
    echo Or pass/drag a folder containing supported files.
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
if /I "%MODE%"=="inspect-target" echo Target rig: %TARGET_RIG%
if /I "%MODE%"=="inspect-mixamo-player" echo Target rig: %TARGET_RIG%
if /I "%MODE%"=="mixamo-base-test" echo Target rig: %TARGET_RIG%
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
) else if /I "%MODE%"=="inspect-target" (
    if not exist "%TARGET_RIG%" (
        echo.
        echo ============================================================
        echo TARGET RIG NOT FOUND
        echo ============================================================
        echo Expected:
        echo   %TARGET_RIG%
        echo.
        echo Or set:
        echo   RACING_LIFE_TARGET_RIG=C:\Path\To\RiggedCharacter.glb
        echo.
        pause
        exit /b 7
    )
    "%BLENDER_EXE%" --background --factory-startup ^
      --python "%REPO_ROOT%\tools\blender_worker\target_rig.py" -- ^
      --input "%INPUT_DIR%" ^
      --target "%TARGET_RIG%" ^
      --output "%OUTPUT_DIR%" ^
      --repo "%REPO_ROOT%" ^
      %PUBLISH_ARG%
) else if /I "%MODE%"=="inspect-mixamo-player" (
    "%BLENDER_EXE%" --background --factory-startup ^
      --python "%REPO_ROOT%\tools\blender_worker\target_rig.py" -- ^
      --input "%INPUT_DIR%" ^
      --target "%TARGET_RIG%" ^
      --output "%OUTPUT_DIR%" ^
      --repo "%REPO_ROOT%" ^
      %PUBLISH_ARG%
) else if /I "%MODE%"=="retarget-test" (
    if not exist "%TARGET_RIG%" (
        echo.
        echo TARGET RIG NOT FOUND:
        echo   %TARGET_RIG%
        echo.
        pause
        exit /b 7
    )
    if not exist "%RETARGET_SOURCE%" (
        echo.
        echo RETARGET SOURCE NOT FOUND:
        echo   %RETARGET_SOURCE%
        echo.
        echo Set RACING_LIFE_RETARGET_SOURCE to another FBX/GLB/GLTF animation asset.
        echo.
        pause
        exit /b 8
    )
    "%BLENDER_EXE%" --background --factory-startup ^
      --python "%REPO_ROOT%\tools\blender_worker\retarget_test.py" -- ^
      --source "%RETARGET_SOURCE%" ^
      --target "%TARGET_RIG%" ^
      --output "%OUTPUT_DIR%" ^
      --repo "%REPO_ROOT%" ^
      %PUBLISH_ARG%
) else if /I "%MODE%"=="mixamo-base-test" (
    if not exist "%TARGET_RIG%" (
        echo.
        echo TARGET RIG NOT FOUND:
        echo   %TARGET_RIG%
        echo.
        pause
        exit /b 7
    )
    if not exist "%RETARGET_SOURCE%" (
        echo.
        echo MIXAMO SOURCE NOT FOUND:
        echo   %RETARGET_SOURCE%
        echo.
        echo Set RACING_LIFE_RETARGET_SOURCE to another Mixamo FBX.
        echo.
        pause
        exit /b 8
    )
    "%BLENDER_EXE%" --background --factory-startup ^
      --python "%REPO_ROOT%\tools\blender_worker\mixamo_base_test.py" -- ^
      --source "%RETARGET_SOURCE%" ^
      --target "%TARGET_RIG%" ^
      --output "%OUTPUT_DIR%" ^
      --repo "%REPO_ROOT%" ^
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
    ) else if /I "%MODE%"=="inspect-target" (
        echo Target rig reports:
        echo   %OUTPUT_DIR%\target-rig-report.json
        echo   %OUTPUT_DIR%\target-rig-report.md
    ) else if /I "%MODE%"=="inspect-mixamo-player" (
        echo MixamoPlayer target report:
        echo   %OUTPUT_DIR%\target-rig-report.json
        echo   %OUTPUT_DIR%\target-rig-report.md
    ) else if /I "%MODE%"=="retarget-test" (
        echo Retarget test reports:
        echo   %OUTPUT_DIR%\retarget-test-report.json
        echo   %OUTPUT_DIR%\retarget-test-report.md
        echo.
        echo Retargeted test asset:
        echo   %OUTPUT_DIR%\retarget\
    ) else if /I "%MODE%"=="mixamo-base-test" (
        echo Mixamo base test reports:
        echo   %OUTPUT_DIR%\mixamo-base-test-report.json
        echo   %OUTPUT_DIR%\mixamo-base-test-report.md
        echo.
        echo Rebound runtime test asset:
        echo   %OUTPUT_DIR%\mixamo-base-test\prototype_mixamo_uppercut.glb
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
