# Racing Life 3D race tracks

Place the five downloaded race-map GLB files in this folder using these names:

- `track_01.glb`
- `track_02.glb`
- `track_03.glb`
- `track_04.glb`
- `track_05.glb`

The runtime paths are registered in `src/racing/TrackRegistry.js`.

## Current setup workflow

1. Start the game and choose **NEXT MATCH** from Home.
2. The first 3D race scene loads `track_01.glb`.
3. Use W/S to move and A/D to steer.
4. Find the real starting grid on the imported venue.
5. Press **G** to save that track's grid position in local storage.
6. Press **R** to reset both cars to the saved grid.
7. Press **Esc** to return Home.

This is a development setup step. Checkpoints, racing-line recording, lap logic, AI, spectators, manager staging and the full 5v5 flow are added after each venue has a verified start/grid and scale.

Keep the original asset license/attribution information for every downloaded track.
