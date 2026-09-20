# Racing Life Asset Requirements

This file records external asset needs discovered while implementing the game. It is not an instruction to automatically download or commit third-party binaries. Verify the current license on the source page before acquisition and preserve required attribution.

## P0 — first-to-three faction race circuits

### Why this is needed

`TrackRegistry` defines five circuits for the confirmed first-to-three faction match flow, but the repository currently contains no circuit GLB binaries under `public/assets/tracks/` (only the track README is versioned). Barcelona may exist in a developer's local ignored asset set, but the remaining match races must not silently rely on invented files.

Runtime target paths already registered by the game:

- `public/assets/tracks/gt_racing_2_-_barcelona.glb`
- `public/assets/tracks/gt_racing_2_-_glen_canyon_dam.glb`
- `public/assets/tracks/gt_racing_2_-_lake_como.glb`
- `public/assets/tracks/gt_racing_2_-_mount_rainier.glb`
- `public/assets/tracks/track_05.glb`

### Desired asset characteristics

- Game-usable circuit/environment mesh with a continuous drivable road surface.
- GLB/glTF preferred; FBX/OBJ is acceptable as an import source if converted and optimized before runtime use.
- Separate or identifiable road/ground geometry is strongly preferred because `RaceScene3D` raycasts the imported venue for vehicle grounding and builds collision data from non-road geometry.
- Practical real-time triangle/material count after optimization; very high-resolution terrain should be decimated/LOD'd before use.
- Redistribution terms must permit the intended project use. Do not commit marketplace/download binaries until their redistribution terms have been checked.

### Glen Canyon Dam

Exact-location candidate:

- Source: TurboSquid — **Glen Canyon Dam**, creator **SENSIET**
- Link: https://www.turbosquid.com/3d-models/glen-canyon-dam-3d-model-2040664
- Listed formats: Blender, OBJ, Collada, FBX, STL; about 29.5k polygons.
- Usage note: paid TurboSquid Standard License. Purchase/use terms and redistribution restrictions must be reviewed before adding any binary to the repository.

Free structural alternative/search seed if an exact-location commercial asset is not suitable:

- Source: Sketchfab — **Dam**, creator **mamiexfanchen**
- Link: https://sketchfab.com/3d-models/dam-4a542f1c96044fc390ec4fb1612046a3
- License shown by source: **CC BY**; about 8.2k triangles.
- This is not Glen Canyon specifically. It is only an environment-building alternative if canon permits constructing the circuit from separate terrain/road/dam pieces; do not silently substitute it for the named circuit.

Search terms: `Glen Canyon Dam game ready 3D`, `Arizona canyon terrain glTF`, `Lake Powell canyon road 3D`, `dam low poly CC BY`.

### Lake Como

Exact-location candidate:

- Source: TurboSquid — **Lake Como Italy mountain landscape**, creator **clickpay3d**
- Link: https://www.turbosquid.com/3d-models/lake-como-italy-mountain-landscape-3d-1844720
- Listed formats include Blender, FBX, OBJ, Unity and Collada.
- Source lists a very high polygon count; substantial optimization/LOD work would be required before runtime use.
- Usage note: paid TurboSquid Standard License. Verify redistribution restrictions before acquisition/commit.

Free terrain-style alternative/search seed:

- Source: Sketchfab — **Mountain Lake**, creator **ill_drakon**
- Link: https://sketchfab.com/3d-models/mountain-lake-3043ead27ac74144950e634197a1490b
- License shown by source: **CC BY**.
- This is not Lake Como specifically and is not a drop-in replacement for the named circuit.

Search terms: `Lake Como Italy terrain 3D glTF`, `Lake Como road environment game ready`, `Italian lake mountain road CC BY 3D`.

### Mount Rainier

Useful location-specific terrain candidate:

- Source: Sketchfab — **Mount Rainer**, creator **Tom / trbaker (Tompro)**
- Link: https://sketchfab.com/3d-models/mount-rainer-41d0da2090a24927b14fc7aaa342e66c
- License shown by source: **CC BY**.
- Source describes glTF terrain generated from color/elevation data, roughly 2.1M triangles, with buildings in the landscape.
- Optimization/LOD and a purpose-built drivable road/circuit layer would be required before runtime use.

Lower-detail paid alternative:

- Source: CGTrader — **Mount Rainier 3D model**, creator **LowPoly-3DStore**
- Link: https://www.cgtrader.com/3d-models/exterior/landmark/mount-rainier-3d-model
- Listed formats include OBJ, DAE and FBX; source labels it Royalty Free.
- Verify the marketplace license and redistribution terms before acquisition/commit.

Search terms: `Mount Rainier game ready terrain glTF`, `Mount Rainier road 3D`, `Washington mountain road CC BY 3D`.

### Fifth circuit (`track_05`)

The circuit identity is not decided in the current registry. **Do not choose a location or asset until canon resolves it.** Keep `track_05` as a requirement placeholder rather than inventing a circuit.

### Integration checklist for any selected circuit asset

1. Verify license and attribution requirements at acquisition time.
2. Import/convert to GLB and normalize scale/orientation.
3. Identify road/ground meshes for `RaceScene3D` grounding raycasts.
4. Verify obstacle collider generation does not classify the road as a wall.
5. Establish grid placement through the existing setup controls.
6. Author and persist the racing line with the P0 authoring controls.
7. Test Subaru AI, swept checkpoint detection, lap counting and finish detection on the optimized asset.
8. Record attribution in the appropriate public credits file if required by the selected license.
