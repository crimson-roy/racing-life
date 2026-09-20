# Racing Life Retarget Test

- Blender: **5.2.0 LTS**
- Source: **Surprise Uppercut.fbx**
- Target: **male_base_mesh.glb**
- Status: **ok**
- Mapped bones: **52**
- Translation scale: **21.177588**

## Output

- Retargeted GLB: retarget/Surprise Uppercut/Surprise Uppercut_on_male_base_mesh.glb
- Start preview: retarget/Surprise Uppercut/preview_start.png
- Mid preview: retarget/Surprise Uppercut/preview_mid.png
- End preview: retarget/Surprise Uppercut/preview_end.png

## Interpretation

This is a first-pass matrix-delta retarget bake. It compensates for different rest-bone orientations instead of directly copying Mixamo rotation channels. Visual inspection is still required before treating the result as production-ready.
