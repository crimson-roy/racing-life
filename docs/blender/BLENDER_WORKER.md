# Racing Life Blender Worker

The local Blender worker lets a Windows Blender installation inspect and process FBX assets while only publishing small structured reports to the Racing Life feature branch. Source FBX files and generated binary outputs stay on the local computer unless the user explicitly moves them into the game.

## Quick use

1. Pull the latest feature branch.
2. Put FBX files in:

   Blender\worker_input

3. Double-click:

   RacingLife-Blender.bat

Double-clicking with no arguments runs the safe inspection mode.

## Worker modes

### inspect

    RacingLife-Blender.bat inspect

Reads each FBX and reports meshes, armatures, bones, animation actions/takes, frame ranges, FPS, duration, geometry information, bounds and rig clues.

Local reports:

- Blender\worker_output\asset-report.json
- Blender\worker_output\asset-report.md

Published reports:

- docs/blender/generated/asset-report.json
- docs/blender/generated/asset-report.md

### convert

    RacingLife-Blender.bat convert

Imports each FBX and exports a GLB while preserving the imported world scale. This is useful when the source scale is already trustworthy.

Generated binaries are placed under:

    Blender\worker_output\processed\<asset-name>\

### normalize

    RacingLife-Blender.bat normalize

Imports each FBX, measures its current mesh height, scales the top-level imported hierarchy to the configured target height, and exports a normalized GLB.

The default target height is 1.80 meters. It is a processing default, not a locked Racing Life avatar-height design decision.

To test another target height in the current Command Prompt:

    set RACING_LIFE_TARGET_HEIGHT=1.75
    RacingLife-Blender.bat normalize

The original FBX is never overwritten.

### preview

    RacingLife-Blender.bat preview

Creates quick 512x512 Blender Workbench PNGs at the start and middle of the detected animation. These are diagnostic previews, not final-quality renders.

### process

    RacingLife-Blender.bat process

Runs the useful processing bundle in one pass:

- imports the FBX
- measures source scale
- normalizes to the configured target height
- exports a GLB
- renders start and middle preview PNGs
- creates a processing report
- attempts to publish only the small processing report to GitHub

Local processing reports:

- Blender\worker_output\processing-report.json
- Blender\worker_output\processing-report.md

Published processing reports:

- docs/blender/generated/processing-report.json
- docs/blender/generated/processing-report.md

Generated GLB/PNG files stay under Blender\worker_output\processed and are ignored by Git.

## Custom source folder

A folder can be supplied after the mode:

    RacingLife-Blender.bat process "D:\My FBX Files"

The default remains Blender\worker_input.

## Local-only mode

To skip GitHub publication:

    RacingLife-Blender.bat process --local-only

Or:

    RacingLife-Blender.bat process "D:\My FBX Files" --local-only

## Blender detection

The launcher checks:

1. RACING_LIFE_BLENDER_EXE
2. blender.exe on PATH
3. normal Program Files Blender Foundation folders
4. the current portable install at C:\Windows\desktop\blender.exe
5. Steam
6. common per-user/custom install folders

To force a Blender executable:

    set RACING_LIFE_BLENDER_EXE=C:\Path\To\blender.exe

## Source asset safety

The following folders are ignored by Git:

- Blender\worker_input
- Blender\worker_output

Source FBX files are never added by the worker. Processing reports are published through an isolated temporary Git worktree so the user's current checkout and uncommitted work are not rebased or committed.

## Current limits

The worker can now inspect, convert, scale-normalize, preview and batch-process FBXs. It does not yet automatically retarget between skeletons, clean root motion, create loops, or generate hand/foot IK corrections.

Those operations are deliberately separate because the inspected tester assets already contain both 33-bone and 65-bone Mixamo variants. Retargeting should use an explicit Racing Life target skeleton rather than assuming every Mixamo-looking file is identical.

The next planned worker layer is target-rig validation and animation extraction/retargeting, followed by root-motion and loop cleanup.
