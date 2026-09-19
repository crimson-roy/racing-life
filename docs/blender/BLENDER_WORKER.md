# Racing Life Blender Worker

This worker lets a local Windows Blender installation inspect FBX files and publish a small structured report to the Racing Life feature branch. Source FBX files stay on the local computer.

## Quick use

1. Pull the latest feature branch.
2. Copy FBX files into:

   Blender\worker_input

3. Double-click:

   RacingLife-Blender.bat

The launcher finds Blender automatically when it is installed normally. You can also drag a folder containing FBX files onto RacingLife-Blender.bat instead of copying files into the default inbox.

## What it inspects

For each FBX the worker records:

- file size
- mesh/object count
- armature count
- bone count and root bones
- useful bone-name clues such as Mixamo/Rigify-style naming
- material count
- approximate geometry size and bounds
- animation actions/takes
- frame ranges
- FPS and approximate duration
- a structural classification such as rigged character/model, likely animation/emote-only FBX, mixed character plus animation, or static prop

Local reports are written to:

- Blender\worker_output\asset-report.json
- Blender\worker_output\asset-report.md

The worker then attempts to publish only the two generated reports to:

- docs/blender/generated/asset-report.json
- docs/blender/generated/asset-report.md

on the feature/3d-racing-foundation branch.

It uses an isolated temporary Git worktree for publishing so it does not need to rebase, commit, or alter the user's current working checkout. It retries when the remote branch changes during publication.

## Source asset safety

Blender\worker_input and Blender\worker_output are ignored by Git. The FBX source files are not added or pushed by this worker.

## Blender detection

The launcher checks, in order:

1. RACING_LIFE_BLENDER_EXE environment variable
2. blender.exe on PATH
3. standard Program Files Blender Foundation folders

To set a custom portable Blender path for one Command Prompt session:

    set RACING_LIFE_BLENDER_EXE=C:\Path\To\Blender\blender.exe

Then run:

    RacingLife-Blender.bat

## Local-only mode

To inspect files without attempting to publish a report:

    RacingLife-Blender.bat --local-only

Or, for a custom folder:

    RacingLife-Blender.bat "D:\My FBX Files" --local-only

## Why this exists

The generated report gives the GitHub-side development workflow enough information to reason about rigs and animation packages without uploading large FBX source assets or requiring screenshots of Blender's UI. Later worker commands can build on this foundation for retargeting, root-motion cleanup, looping, validation, and GLB export.
