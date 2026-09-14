import bpy
import os

# ============================================================
# RACING LIFE 3D
# MIXAMO FBX -> GLB CONVERTER
# ============================================================

PROJECT_DIR = r"C:\Users\USER\Desktop\Racing Life\Racing Life 3D"

INPUT_DIR = os.path.join(
    PROJECT_DIR,
    "public",
    "assets",
    "characters",
    "animations",
    "FBX"
)

OUTPUT_DIR = os.path.join(
    PROJECT_DIR,
    "public",
    "assets",
    "characters",
    "animations"
)

os.makedirs(
    OUTPUT_DIR,
    exist_ok=True
)

# ------------------------------------------------------------
# GET FBX FILES
# ------------------------------------------------------------

fbx_files = [
    filename
    for filename in os.listdir(INPUT_DIR)
    if filename.lower().endswith(".fbx")
]

if not fbx_files:
    print("")
    print("==============================================")
    print("NO FBX FILES FOUND")
    print("==============================================")
    print(INPUT_DIR)
    print("")
    raise SystemExit

print("")
print("==============================================")
print("RACING LIFE 3D")
print("BLENDER MIXAMO FBX -> GLB CONVERTER")
print("==============================================")
print("")

converted = 0
skipped = 0
failed = 0

# ============================================================
# CONVERT EACH FBX
# ============================================================

for filename in fbx_files:

    input_path = os.path.join(
        INPUT_DIR,
        filename
    )

    base_name = os.path.splitext(
        filename
    )[0]

    output_path = os.path.join(
        OUTPUT_DIR,
        base_name + ".glb"
    )

    print("----------------------------------------------")
    print("Converting:", filename)

    # --------------------------------------------------------
    # DON'T OVERWRITE EXISTING GLB
    # --------------------------------------------------------

    if os.path.exists(output_path):

        print(
            "SKIPPED - already exists:",
            os.path.basename(output_path)
        )

        skipped += 1
        continue

    # --------------------------------------------------------
    # CLEAR BLENDER
    # --------------------------------------------------------

    bpy.ops.object.select_all(
        action='SELECT'
    )

    bpy.ops.object.delete(
        use_global=False
    )

    # Remove leftover datablocks from previous file
    for action in list(
        bpy.data.actions
    ):
        bpy.data.actions.remove(
            action
        )

    # --------------------------------------------------------
    # IMPORT FBX
    # --------------------------------------------------------

    try:

        bpy.ops.import_scene.fbx(
            filepath=input_path,

            use_anim=True,

            # Keep Blender's normal Mixamo-friendly
            # coordinate conversion.
            use_manual_orientation=False,

            bake_space_transform=False,

            automatic_bone_orientation=False,

            primary_bone_axis='Y',

            secondary_bone_axis='X',

            use_prepost_rot=True,

            axis_forward='-Z',

            axis_up='Y'
        )

    except Exception as error:

        print(
            "IMPORT FAILED:",
            error
        )

        failed += 1
        continue

    # --------------------------------------------------------
    # FIND ARMATURE
    # --------------------------------------------------------

    armatures = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == 'ARMATURE'
    ]

    if not armatures:

        print(
            "FAILED - no armature found."
        )

        failed += 1
        continue

    # Prefer the first imported armature
    armature = armatures[0]

    # Select all imported objects
    bpy.ops.object.select_all(
        action='DESELECT'
    )

    for obj in bpy.context.scene.objects:
        obj.select_set(True)

    bpy.context.view_layer.objects.active = armature

    # --------------------------------------------------------
    # MAKE SURE ARMATURE IS ACTIVE
    # --------------------------------------------------------

    armature.select_set(True)

    # --------------------------------------------------------
    # EXPORT GLB
    # --------------------------------------------------------

    try:

        bpy.ops.export_scene.gltf(

            filepath=output_path,

            export_format='GLB',

            # Preserve animation
            export_animations=True,

            export_animation_mode='ACTIONS',

            export_frame_range=False,

            export_frame_step=1,

            export_force_sampling=True,

            # Keep skin/armature data
            export_skins=True,

            export_anim_single_armature=True,

            export_reset_pose_bones=True,

            export_rest_position_armature=True,

            # Don't bake object transforms into the
            # animation in a way that changes the rig.
            export_apply=False,

            # Export what Blender imported.
            use_selection=True,

            # No camera/light needed.
            export_cameras=False,

            export_lights=False
        )

    except Exception as error:

        print(
            "EXPORT FAILED:",
            error
        )

        failed += 1
        continue

    # --------------------------------------------------------
    # VERIFY FILE
    # --------------------------------------------------------

    if os.path.exists(output_path):

        print(
            "SUCCESS ->",
            os.path.basename(output_path)
        )

        converted += 1

    else:

        print(
            "FAILED - GLB was not created."
        )

        failed += 1

# ============================================================
# SUMMARY
# ============================================================

print("")
print("==============================================")
print("CONVERSION COMPLETE")
print("==============================================")
print("Converted:", converted)
print("Skipped:  ", skipped)
print("Failed:   ", failed)
print("Output:")
print(OUTPUT_DIR)
print("==============================================")
print("")