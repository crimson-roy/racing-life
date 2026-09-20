# Racing Life Mixamo Base Test

- Status: **error**
- Blender: **5.2.0 LTS**
- Source Mixamo asset: **Surprise Uppercut.fbx**
- Prototype target: **male_base_mesh.glb**
- Strategy: **rebind-prototype-to-canonical-mixamo-skeleton**

## Alignment

- Source skeleton height: 0.083266
- Target skeleton height: 1.763366
- Scale factor: 21.177588
- Global facing correction: 96.5741 degrees

## Error

RuntimeError: Automatic binding created no armature modifier for Icosphere

## Runtime asset

-

This test changes the prototype's skinning once so it uses a canonical Mixamo armature, instead of retargeting every Mixamo animation onto the prototype's Rigify/metarig skeleton.
