# Racing Life Mixamo Base Test

- Status: **ok**
- Blender: **5.2.0 LTS**
- Source Mixamo asset: **Surprise Uppercut.fbx**
- Prototype target: **male_base_mesh.glb**
- Strategy: **reuse-prototype-skin-weights-on-canonical-mixamo-skeleton**

## Alignment

- Source skeleton height: 0.083266
- Target skeleton height: 1.763366
- Scale factor: 21.177588
- Global facing correction: 96.5741 degrees

## Binding

- Meshes found: 2
- Weighted meshes remapped: 1
- Rigid helper meshes attached: 1
- Meshes left unbound: 0
- Mesh names: mesh, Icosphere

## Animation

- Action: RL_Mixamo_Uppercut
- Frames: 1–106
- FPS: 30.0
- Duration: 3.5 s

## Runtime asset

/assets/characters/retarget-tests/surprise-uppercut-prototype.glb

This test changes the prototype's skinning once so it uses a canonical Mixamo armature, instead of retargeting every Mixamo animation onto the prototype's Rigify/metarig skeleton.
