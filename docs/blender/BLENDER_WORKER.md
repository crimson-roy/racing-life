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


## Rig validation and animation extraction

### validate-rig

    RacingLife-Blender.bat validate-rig

Checks the main humanoid skeleton in every FBX, including:

- rig family clues
- total bone count
- root bones
- Racing Life core-humanoid bone coverage
- missing core bones
- finger-bone detail
- animation/action metadata
- exact skeleton grouping

This is structural validation only. It does not claim that every animation will retarget perfectly.

### compare-skeletons

    RacingLife-Blender.bat compare-skeletons

Runs the rig validation above, then compares every successful skeleton pair. The report records:

- exact bone-set matches
- shared/union bone counts
- full bone-set similarity
- non-finger similarity
- compatibility category
- bones present in one rig but missing from the other

The non-finger comparison is important for the currently inspected 33-bone and 65-bone Mixamo-style variants, because a reduced finger setup can still have a compatible core body skeleton.

### extract-animation

    RacingLife-Blender.bat extract-animation

Extracts the primary armature and animation action from each FBX into a local animation-only GLB package under:

    Blender\worker_output\extracted\

The source FBX is not modified. The extracted package still contains the source skeleton because retargeting to a Racing Life target skeleton is intentionally a later step.

Local rig reports:

- Blender\worker_output\rig-report.json
- Blender\worker_output\rig-report.md

Published rig reports:

- docs/blender/generated/rig-report.json
- docs/blender/generated/rig-report.md


## Target rig inspection

Run:

    RacingLife-Blender.bat inspect-target

The default target is:

    Blender\male_base_mesh.glb

This stage checks whether the target character actually contains an armature and compares its normalized body-bone set against every source FBX in Blender\worker_input.

It publishes:

- docs/blender/generated/target-rig-report.json
- docs/blender/generated/target-rig-report.md

To inspect a different rigged character, set:

    set RACING_LIFE_TARGET_RIG=C:\Path\To\RiggedCharacter.glb
    RacingLife-Blender.bat inspect-target

This command validates compatibility only. It does not retarget animation yet.


## Retarget test

Run:

    RacingLife-Blender.bat retarget-test

Defaults:

- source animation: Blender\worker_input\Surprise Uppercut.fbx
- target rig: Blender\male_base_mesh.glb

The test performs a first-pass matrix-delta retarget bake. It maps equivalent Mixamo and Rigify/metarig bones semantically, compensates for different rest-bone orientations, scales hips translation by source/target skeleton height, bakes the motion to the target armature, exports a local GLB, and renders start/middle/end preview PNGs.

Outputs:

- Blender\worker_output\retarget-test-report.json
- Blender\worker_output\retarget-test-report.md
- Blender\worker_output\retarget\<source>\<source>_on_<target>.glb
- local start/middle/end PNG previews

Published report and small diagnostic previews:

- docs/blender/generated/retarget-test-report.json
- docs/blender/generated/retarget-test-report.md
- docs/blender/generated/retarget-previews/<source>/preview_start.png
- docs/blender/generated/retarget-previews/<source>/preview_mid.png
- docs/blender/generated/retarget-previews/<source>/preview_end.png

Only the 512x512 diagnostic PNGs are published. The source FBX/GLB/GLTF and retargeted GLB remain local.

To test another source animation:

    set RACING_LIFE_RETARGET_SOURCE=C:\Path\To\Animation.fbx
    RacingLife-Blender.bat retarget-test

This is a visual/structural test, not a production retarget guarantee. Foot contact, hand contact, root motion and deformation still need review.


## Browser retarget playback

After running:

    RacingLife-Blender.bat retarget-test

the worker copies the generated prototype retarget GLB into the local, Git-ignored runtime path:

    public\assets\characters\retarget-tests\surprise-uppercut-prototype.glb

Start Vite:

    npm run dev

Then open:

    http://localhost:5173/retarget-test.html

The standalone Three.js viewer plays the full retargeted Surprise Uppercut on the prototype rig and includes pause, restart, playback-speed, orbit and zoom controls.

The runtime retarget GLB remains local and is intentionally ignored by Git.
