import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import traceback

import bpy
from mathutils import Vector

BRANCH = "feature/3d-racing-foundation"
PUBLISH_JSON = Path("docs/blender/generated/retarget-test-report.json")
PUBLISH_MD = Path("docs/blender/generated/retarget-test-report.md")
PUBLISH_PREVIEW_ROOT = Path("docs/blender/generated/retarget-previews")


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser(description="Racing Life Mixamo to target retarget test")
    p.add_argument("--source", required=True)
    p.add_argument("--target", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--repo", required=True)
    p.add_argument("--publish", action="store_true")
    return p.parse_args(argv)


def run(cmd, cwd=None, check=True, env=None):
    result = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            "Command failed ({}):\n{}".format(
                " ".join(map(str, cmd)),
                result.stdout.strip(),
            )
        )
    return result


def normalize_bone_name(name):
    name = str(name).split(":")[-1]
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def detect_rig_family(names, armature_name=""):
    raw = [str(name) for name in names]
    lower = [name.lower() for name in raw]
    normalized = {normalize_bone_name(name) for name in raw}

    if any("mixamorig" in name for name in lower):
        return "mixamo"

    if (
        str(armature_name).lower() == "metarig"
        or (
            "spine001" in normalized
            and "upperarml" in normalized
            and "thighl" in normalized
        )
    ):
        return "rigify-metarig"

    if any(name.startswith("DEF-") or name.startswith("ORG-") for name in raw):
        return "rigify"
    return "generic-or-unknown"


def canonical_bone_name(name, rig_family):
    n = normalize_bone_name(name)
    if rig_family != "rigify-metarig":
        return n

    direct = {
        "spine": "hips",
        "spine001": "spine",
        "spine002": "spine1",
        "spine003": "spine2",
        "spine004": "neck",
        "spine005": "head",
        "shoulderl": "leftshoulder",
        "upperarml": "leftarm",
        "forearml": "leftforearm",
        "handl": "lefthand",
        "thighl": "leftupleg",
        "shinl": "leftleg",
        "footl": "leftfoot",
        "toel": "lefttoebase",
        "shoulderr": "rightshoulder",
        "upperarmr": "rightarm",
        "forearmr": "rightforearm",
        "handr": "righthand",
        "thighr": "rightupleg",
        "shinr": "rightleg",
        "footr": "rightfoot",
        "toer": "righttoebase",
    }
    if n in direct:
        return direct[n]

    finger_patterns = (
        ("findex", "index"),
        ("fmiddle", "middle"),
        ("fring", "ring"),
        ("fpinky", "pinky"),
        ("thumb", "thumb"),
    )
    for prefix, part in finger_patterns:
        if not n.startswith(prefix):
            continue
        side = "left" if n.endswith("l") else "right" if n.endswith("r") else None
        if side is None:
            return n
        digits = "".join(ch for ch in n[len(prefix):-1] if ch.isdigit())
        if not digits:
            return n
        return "{}hand{}{}".format(side, part, int(digits))

    return n


def import_asset(path):
    ext = path.suffix.lower()
    if ext == ".fbx":
        try:
            bpy.ops.import_scene.fbx(filepath=str(path), use_anim=True)
        except Exception as first_error:
            try:
                bpy.ops.wm.fbx_import(filepath=str(path))
            except Exception:
                raise first_error
        return

    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=str(path))
        return

    raise RuntimeError("Unsupported asset format: {}".format(ext))


def newly_imported(before_names):
    return [obj for obj in bpy.context.scene.objects if obj.name not in before_names]


def choose_armature(objects):
    arms = [obj for obj in objects if obj.type == "ARMATURE"]
    if not arms:
        return None
    return max(arms, key=lambda obj: len(obj.data.bones))


def bone_map(armature):
    names = [bone.name for bone in armature.data.bones]
    family = detect_rig_family(names, armature.name)
    mapping = {}
    for bone in armature.data.bones:
        canonical = canonical_bone_name(bone.name, family)
        mapping.setdefault(canonical, bone.name)
    return family, mapping


def skeleton_height_world(armature):
    points = []
    for bone in armature.data.bones:
        try:
            points.append(armature.matrix_world @ bone.head_local)
            points.append(armature.matrix_world @ bone.tail_local)
        except Exception:
            pass
    if not points:
        return 1.0
    z_values = [point.z for point in points]
    value = max(z_values) - min(z_values)
    return float(value) if value > 1e-8 else 1.0


def bone_depth(armature, bone_name):
    depth = 0
    bone = armature.data.bones.get(bone_name)
    while bone is not None and bone.parent is not None:
        depth += 1
        bone = bone.parent
    return depth


def source_action(armature):
    if armature.animation_data and armature.animation_data.action:
        return armature.animation_data.action
    if bpy.data.actions:
        return bpy.data.actions[0]
    return None


def matrix_with_rotation_translation(rotation, translation):
    matrix = rotation.to_matrix().to_4x4()
    matrix.translation = Vector(translation)
    return matrix


def retarget(source_arm, target_arm, source_map, target_map, frame_start, frame_end):
    scene = bpy.context.scene
    source_height = skeleton_height_world(source_arm)
    target_height = skeleton_height_world(target_arm)
    translation_scale = target_height / source_height if source_height > 1e-8 else 1.0

    # First-pass production-safe set: body + hands + toe bases.
    # Finger chains are deliberately excluded for now because the source
    # and target finger rigs differ in detail and were amplifying errors.
    body_canonicals = {
        "hips", "spine", "spine1", "spine2", "neck", "head",
        "leftshoulder", "leftarm", "leftforearm", "lefthand",
        "rightshoulder", "rightarm", "rightforearm", "righthand",
        "leftupleg", "leftleg", "leftfoot", "lefttoebase",
        "rightupleg", "rightleg", "rightfoot", "righttoebase",
    }

    mapped = sorted(
        (set(source_map) & set(target_map) & body_canonicals),
        key=lambda canonical: bone_depth(target_arm, target_map[canonical]),
    )

    target_arm.animation_data_clear()
    target_arm.animation_data_create()
    action = bpy.data.actions.new("RL_Retarget_Test")
    target_arm.animation_data.action = action

    source_rest_local = {}
    target_rest_local = {}

    for canonical in mapped:
        source_bone = source_arm.data.bones[source_map[canonical]]
        target_bone = target_arm.data.bones[target_map[canonical]]

        source_rest_local[canonical] = (
            source_bone.parent.matrix_local.inverted() @ source_bone.matrix_local
            if source_bone.parent
            else source_bone.matrix_local.copy()
        )
        target_rest_local[canonical] = (
            target_bone.parent.matrix_local.inverted() @ target_bone.matrix_local
            if target_bone.parent
            else target_bone.matrix_local.copy()
        )

    for frame in range(int(frame_start), int(frame_end) + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()

        for canonical in mapped:
            source_pose = source_arm.pose.bones.get(source_map[canonical])
            target_pose = target_arm.pose.bones.get(target_map[canonical])
            if source_pose is None or target_pose is None:
                continue

            source_pose_local = (
                source_pose.parent.matrix.inverted() @ source_pose.matrix
                if source_pose.parent
                else source_pose.matrix.copy()
            )

            # Animation delta in the SOURCE bone's own parent-local rest frame.
            source_delta = (
                source_rest_local[canonical].inverted()
                @ source_pose_local
            )

            # Keep only rotation for normal joints so the target keeps its own
            # proportions. Root/hips also receives scaled translation.
            delta_rotation = source_delta.to_quaternion()
            # Keep the prototype in place during body-retarget validation.
            # The imported Surprise Uppercut FBX uses a very different unit
            # scale, and its root translation was sending the target more than
            # 100 world units away from the viewer. Root locomotion will be
            # reintroduced only after the rotational retarget is visually sane.
            delta_translation = Vector((0.0, 0.0, 0.0))

            delta_matrix = delta_rotation.to_matrix().to_4x4()
            delta_matrix.translation = delta_translation

            # Apply the source local animation delta to the TARGET's own rest
            # transform, then rebuild the target pose down its hierarchy.
            desired_local = target_rest_local[canonical] @ delta_matrix

            if target_pose.parent:
                desired_armature = target_pose.parent.matrix @ desired_local
            else:
                desired_armature = desired_local

            target_pose.matrix = desired_armature
            bpy.context.view_layer.update()

            target_pose.rotation_mode = "QUATERNION"
            target_pose.keyframe_insert(
                data_path="rotation_quaternion",
                frame=frame,
                group=target_pose.name,
            )

            if canonical == "hips":
                target_pose.keyframe_insert(
                    data_path="location",
                    frame=frame,
                    group=target_pose.name,
                )

    scene.frame_start = int(frame_start)
    scene.frame_end = int(frame_end)

    sample_frames = [
        int(frame_start),
        int(round((frame_start + frame_end) * 0.5)),
        int(frame_end),
    ]
    sample_positions = []
    for sample_frame in sample_frames:
        scene.frame_set(sample_frame)
        bpy.context.view_layer.update()
        frame_positions = {}
        for canonical in mapped:
            pose_bone = target_arm.pose.bones.get(target_map[canonical])
            if pose_bone is None:
                continue
            world_pos = (target_arm.matrix_world @ pose_bone.matrix).translation
            frame_positions[canonical] = [
                float(world_pos.x),
                float(world_pos.y),
                float(world_pos.z),
            ]
        sample_positions.append(frame_positions)

    moving_bones = []
    if len(sample_positions) >= 2:
        first = sample_positions[0]
        for canonical in mapped:
            if canonical not in first:
                continue
            start_pos = Vector(first[canonical])
            max_distance = 0.0
            for frame_positions in sample_positions[1:]:
                if canonical not in frame_positions:
                    continue
                distance = float(
                    (Vector(frame_positions[canonical]) - start_pos).length
                )
                max_distance = max(max_distance, distance)
            if max_distance > 1e-5:
                moving_bones.append({
                    "bone": canonical,
                    "sampled_world_displacement": round(max_distance, 6),
                })

    return {
        "mapped_bones": mapped,
        "mapped_count": len(mapped),
        "translation_scale": round(float(translation_scale), 6),
        "action_name": action.name,
        "rotation_method": "parent_local_rest_delta",
        "root_translation_method": "locked-in-place-for-body-validation",
        "finger_transfer": "disabled-for-body-validation",
        "sample_frames": sample_frames,
        "moving_bone_count": len(moving_bones),
        "moving_bones": moving_bones,
    }


def canonical_pose_positions(armature, mapping, frame):
    bpy.context.scene.frame_set(int(frame))
    bpy.context.view_layer.update()

    result = {}
    for canonical, bone_name in mapping.items():
        pose_bone = armature.pose.bones.get(bone_name)
        if pose_bone is None:
            continue
        world_matrix = armature.matrix_world @ pose_bone.matrix
        p = world_matrix.translation
        result[canonical] = [float(p.x), float(p.y), float(p.z)]
    return result


def anatomical_coordinates(positions):
    hips = Vector(positions.get("hips", [0.0, 0.0, 0.0]))
    head = Vector(positions.get("head", [0.0, 0.0, 1.0]))
    left_shoulder = Vector(positions.get("leftshoulder", [-1.0, 0.0, 0.0]))
    right_shoulder = Vector(positions.get("rightshoulder", [1.0, 0.0, 0.0]))

    up = head - hips
    if up.length <= 1e-8:
        up = Vector((0.0, 0.0, 1.0))
    up.normalize()

    right = right_shoulder - left_shoulder
    right -= up * right.dot(up)
    if right.length <= 1e-8:
        right = Vector((1.0, 0.0, 0.0))
    right.normalize()

    forward = right.cross(up)
    if forward.length <= 1e-8:
        forward = Vector((0.0, 1.0, 0.0))
    forward.normalize()

    # Re-orthogonalize right so every rig is compared in its own
    # anatomical frame instead of Blender/FBX world axes.
    right = up.cross(forward)
    right.normalize()

    result = {}
    for name, raw in positions.items():
        relative = Vector(raw) - hips
        result[name] = Vector((
            relative.dot(right),
            relative.dot(forward),
            relative.dot(up),
        ))
    return result


def normalized_pose_error(source_arm, target_arm, source_map, target_map, frame):
    source_positions = canonical_pose_positions(source_arm, source_map, frame)
    target_positions = canonical_pose_positions(target_arm, target_map, frame)

    source_coords = anatomical_coordinates(source_positions)
    target_coords = anatomical_coordinates(target_positions)

    shared = sorted(set(source_coords) & set(target_coords))
    source_height = skeleton_height_world(source_arm)
    target_height = skeleton_height_world(target_arm)

    bones = []
    distances = []
    core_distances = []
    hand_distances = []

    for canonical in shared:
        source_relative = source_coords[canonical] / max(source_height, 1e-8)
        target_relative = target_coords[canonical] / max(target_height, 1e-8)

        distance = float((source_relative - target_relative).length)
        distances.append(distance)

        is_hand_detail = (
            "hand" in canonical
            and canonical not in {"lefthand", "righthand"}
        )
        if canonical in {
            "hips", "spine", "spine1", "spine2", "neck", "head",
            "leftshoulder", "leftarm", "leftforearm", "lefthand",
            "rightshoulder", "rightarm", "rightforearm", "righthand",
            "leftupleg", "leftleg", "leftfoot",
            "rightupleg", "rightleg", "rightfoot",
        }:
            core_distances.append(distance)
        elif is_hand_detail:
            hand_distances.append(distance)

        bones.append({
            "bone": canonical,
            "source_anatomical": [round(float(v), 5) for v in source_relative],
            "target_anatomical": [round(float(v), 5) for v in target_relative],
            "normalized_position_error": round(distance, 5),
        })

    def stats(values):
        return {
            "mean": round(sum(values) / len(values), 5) if values else None,
            "max": round(max(values), 5) if values else None,
            "count": len(values),
        }

    return {
        "frame": int(frame),
        "shared_bones": len(shared),
        "coordinate_space": "anatomical-facing-normalized",
        "all_joints": stats(distances),
        "core_body": stats(core_distances),
        "finger_detail": stats(hand_distances),
        "bones": bones,
    }


def classify_unmapped(name):
    normalized = normalize_bone_name(name)
    if normalized.endswith("end") or normalized == "headtopend":
        return "terminal/helper"
    if any(token in normalized for token in ("thumb", "index", "middle", "ring", "pinky")):
        return "finger-detail"
    if normalized.startswith("heel") or normalized.startswith("pelvis"):
        return "rig-helper"
    return "unmapped"


def export_target_glb(path, target_objects, target_arm):
    path.parent.mkdir(parents=True, exist_ok=True)

    # Export only the baked retarget action. Imported source/target files can
    # carry extra actions; ACTIVE_ACTIONS prevents a wrong/static clip from
    # becoming animation[0] in the GLB.
    if target_arm.animation_data is None or target_arm.animation_data.action is None:
        raise RuntimeError("Target armature has no active retarget action before export.")
    active_action_name = target_arm.animation_data.action.name

    bpy.ops.object.select_all(action="DESELECT")
    for obj in target_objects:
        if obj.name in bpy.context.scene.objects:
            obj.select_set(True)
    target_arm.select_set(True)
    bpy.context.view_layer.objects.active = target_arm

    kwargs = dict(
        filepath=str(path),
        export_format="GLB",
        export_animations=True,
        export_skins=True,
        export_cameras=False,
        export_lights=False,
        use_selection=True,
    )

    try:
        bpy.ops.export_scene.gltf(
            **kwargs,
            export_animation_mode="ACTIVE_ACTIONS",
            export_force_sampling=True,
            export_frame_range=True,
        )
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)


def object_bounds(objects):
    min_v = Vector((math.inf, math.inf, math.inf))
    max_v = Vector((-math.inf, -math.inf, -math.inf))
    found = False

    for obj in objects:
        if obj.type != "MESH":
            continue
        try:
            for corner in obj.bound_box:
                point = obj.matrix_world @ Vector(corner)
                min_v.x = min(min_v.x, point.x)
                min_v.y = min(min_v.y, point.y)
                min_v.z = min(min_v.z, point.z)
                max_v.x = max(max_v.x, point.x)
                max_v.y = max(max_v.y, point.y)
                max_v.z = max(max_v.z, point.z)
                found = True
        except Exception:
            pass

    if not found:
        return Vector((0, 0, 0)), Vector((1, 1, 2))
    return min_v, max_v


def render_preview(path, target_objects, frame):
    scene = bpy.context.scene
    scene.frame_set(int(frame))
    bpy.context.view_layer.update()

    min_v, max_v = object_bounds(target_objects)
    center = (min_v + max_v) * 0.5
    size = max_v - min_v
    radius = max(float(size.length) * 0.6, 0.75)

    cam_data = bpy.data.cameras.new("RLRetargetPreviewCamera")
    camera = bpy.data.objects.new("RLRetargetPreviewCamera", cam_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    camera.location = center + Vector((radius * 1.4, -radius * 2.1, radius * 0.75))
    direction = center - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = 55

    if scene.world is None:
        scene.world = bpy.data.worlds.new("RLRetargetPreviewWorld")
    scene.world.color = (0.04, 0.04, 0.05)

    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)


def ascii_preview(path, columns=48, rows=48):
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        width, height = int(image.size[0]), int(image.size[1])
        pixels = list(image.pixels[:])
        chars = " .:-=+*#%@"
        lines = []

        for row in range(rows):
            source_y = min(
                height - 1,
                max(0, int((rows - 1 - row + 0.5) * height / rows)),
            )
            line = []
            for col in range(columns):
                source_x = min(
                    width - 1,
                    max(0, int((col + 0.5) * width / columns)),
                )
                idx = (source_y * width + source_x) * 4
                r, g, b = pixels[idx], pixels[idx + 1], pixels[idx + 2]
                luminance = max(0.0, min(1.0, 0.2126 * r + 0.7152 * g + 0.0722 * b))
                char_index = int(round(luminance * (len(chars) - 1)))
                line.append(chars[char_index])
            lines.append("".join(line).rstrip())
        return "\n".join(lines)
    finally:
        bpy.data.images.remove(image)


def publish_reports(repo_root, json_path, md_path, preview_files=None):
    if not (repo_root / ".git").exists():
        return False

    for attempt in range(1, 4):
        temp_base = Path(tempfile.mkdtemp(prefix="racing-life-retarget-test-"))
        worktree = temp_base / "worktree"
        added = False
        try:
            run(["git", "fetch", "origin", BRANCH], cwd=repo_root)
            run(
                ["git", "worktree", "add", "--detach", str(worktree), "origin/{}".format(BRANCH)],
                cwd=repo_root,
            )
            added = True

            out_json = worktree / PUBLISH_JSON
            out_md = worktree / PUBLISH_MD
            out_json.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(json_path, out_json)
            shutil.copy2(md_path, out_md)

            publish_paths = [str(PUBLISH_JSON), str(PUBLISH_MD)]
            for local_path, relative_publish_path in (preview_files or []):
                destination = worktree / relative_publish_path
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(local_path, destination)
                publish_paths.append(str(relative_publish_path))

            run(["git", "add", *publish_paths], cwd=worktree)
            diff = run(["git", "diff", "--cached", "--quiet"], cwd=worktree, check=False)
            if diff.returncode == 0:
                return True

            name = run(["git", "config", "user.name"], cwd=repo_root, check=False).stdout.strip()
            email = run(["git", "config", "user.email"], cwd=repo_root, check=False).stdout.strip()
            env = os.environ.copy()
            env["GIT_AUTHOR_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_AUTHOR_EMAIL"] = email or "racing-life-blender@local"
            env["GIT_COMMITTER_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_COMMITTER_EMAIL"] = email or "racing-life-blender@local"

            run(["git", "commit", "-m", "Update Blender retarget test report"], cwd=worktree, env=env)
            pushed = run(
                ["git", "push", "origin", "HEAD:{}".format(BRANCH)],
                cwd=worktree,
                check=False,
            )
            if pushed.returncode == 0:
                return True
        except Exception as exc:
            print("Publish attempt {} failed: {}".format(attempt, exc))
        finally:
            if added:
                run(
                    ["git", "worktree", "remove", "--force", str(worktree)],
                    cwd=repo_root,
                    check=False,
                )
            shutil.rmtree(temp_base, ignore_errors=True)

    return False


def markdown(report):
    lines = [
        "# Racing Life Retarget Test",
        "",
        "- Blender: **{}**".format(report["blender_version"]),
        "- Source: **{}**".format(report["source_file"]),
        "- Target: **{}**".format(report["target_file"]),
        "- Status: **{}**".format(report["status"]),
        "- Mapped bones: **{}**".format(report.get("retarget", {}).get("mapped_count", 0)),
        "- Translation scale: **{}**".format(report.get("retarget", {}).get("translation_scale", "-")),
        "- Shared mapped joints: **{}**".format(report.get("mapping", {}).get("shared_count", "-")),
        "- Source-only joints: **{}**".format(len(report.get("mapping", {}).get("source_only", []))),
        "- Target-only joints: **{}**".format(len(report.get("mapping", {}).get("target_only", []))),
        "",
        "## Pose diagnostics",
        "",
    ]

    for snapshot in report.get("pose_diagnostics", {}).get("snapshots", []):
        lines.append(
            "- Frame {}: core-body mean error {}, max {}".format(
                snapshot.get("frame"),
                snapshot.get("core_body", {}).get("mean"),
                snapshot.get("core_body", {}).get("max"),
            )
        )

    lines.extend([
        "",
        "## Output",
        "",
        "- Retargeted GLB: {}".format(report.get("outputs", {}).get("glb", "-")),
        "- Start preview: {}".format(report.get("outputs", {}).get("preview_start", "-")),
        "- Mid preview: {}".format(report.get("outputs", {}).get("preview_mid", "-")),
        "- End preview: {}".format(report.get("outputs", {}).get("preview_end", "-")),
        "",
        "## Published previews",
        "",
        "- Start: {}".format(report.get("published_previews", {}).get("preview_start", "-")),
        "- Mid: {}".format(report.get("published_previews", {}).get("preview_mid", "-")),
        "- End: {}".format(report.get("published_previews", {}).get("preview_end", "-")),
        "",
        "## ASCII diagnostic previews",
        "",
    ])

    for label in ("start", "mid", "end"):
        preview = report.get("ascii_previews", {}).get(label)
        if preview:
            lines.extend([
                "### {}".format(label.title()),
                "",
                "~~~text",
                preview,
                "~~~",
                "",
            ])

    lines.extend([
        "## Interpretation",
        "",
        "This is a first-pass matrix-delta retarget bake. It compensates for different rest-bone orientations instead of directly copying Mixamo rotation channels. Visual inspection is still required before treating the result as production-ready.",
        "",
    ])
    if report.get("error"):
        lines.extend(["## Error", "", report["error"], ""])
    return "\n".join(lines)


def main():
    args = parse_args()
    source_path = Path(args.source).resolve()
    target_path = Path(args.target).resolve()
    output_root = Path(args.output).resolve()
    repo_root = Path(args.repo).resolve()

    output_root.mkdir(parents=True, exist_ok=True)
    report = {
        "schema_version": 1,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "blender_version": bpy.app.version_string,
        "source_file": source_path.name,
        "target_file": target_path.name,
        "status": "ok",
        "outputs": {},
    }

    try:
        if not source_path.exists():
            raise RuntimeError("Source animation file does not exist: {}".format(source_path))
        if not target_path.exists():
            raise RuntimeError("Target rig file does not exist: {}".format(target_path))

        bpy.ops.wm.read_factory_settings(use_empty=True)

        before = {obj.name for obj in bpy.context.scene.objects}
        import_asset(source_path)
        source_objects = newly_imported(before)
        source_arm = choose_armature(source_objects)
        if source_arm is None:
            raise RuntimeError("No armature found in source animation asset.")

        fps = float(bpy.context.scene.render.fps) / float(
            bpy.context.scene.render.fps_base or 1.0
        )
        action = source_action(source_arm)
        if action is None:
            raise RuntimeError("Source contains no animation action.")
        frame_start, frame_end = [int(round(v)) for v in action.frame_range]
        source_family, source_map = bone_map(source_arm)

        before = {obj.name for obj in bpy.context.scene.objects}
        import_asset(target_path)
        target_objects = newly_imported(before)
        target_arm = choose_armature(target_objects)
        if target_arm is None:
            raise RuntimeError("No armature found in target asset.")
        target_family, target_map = bone_map(target_arm)

        shared_canonical = sorted(set(source_map) & set(target_map))
        source_only = sorted(set(source_map) - set(target_map))
        target_only = sorted(set(target_map) - set(source_map))
        report["mapping"] = {
            "shared_count": len(shared_canonical),
            "source_only": [
                {
                    "canonical": name,
                    "source_bone": source_map[name],
                    "category": classify_unmapped(name),
                }
                for name in source_only
            ],
            "target_only": [
                {
                    "canonical": name,
                    "target_bone": target_map[name],
                    "category": classify_unmapped(name),
                }
                for name in target_only
            ],
        }

        bpy.context.scene.render.fps = max(1, int(round(fps)))
        retarget_info = retarget(
            source_arm,
            target_arm,
            source_map,
            target_map,
            frame_start,
            frame_end,
        )

        report["retarget"] = retarget_info

        middle_frame = int(round((frame_start + frame_end) * 0.5))
        report["pose_diagnostics"] = {
            "snapshots": [
                normalized_pose_error(
                    source_arm,
                    target_arm,
                    source_map,
                    target_map,
                    frame,
                )
                for frame in (frame_start, middle_frame, frame_end)
            ]
        }

        report["source_rig_family"] = source_family
        report["target_rig_family"] = target_family
        report["frame_start"] = frame_start
        report["frame_end"] = frame_end
        report["fps"] = fps
        report["duration_seconds"] = round(
            max(0, frame_end - frame_start) / fps,
            4,
        ) if fps else None

        out_dir = output_root / "retarget" / source_path.stem
        glb_path = out_dir / (source_path.stem + "_on_" + target_path.stem + ".glb")
        preview_start = out_dir / "preview_start.png"
        preview_mid = out_dir / "preview_mid.png"
        preview_end = out_dir / "preview_end.png"

        export_target_glb(glb_path, target_objects, target_arm)

        report["export"] = {
            "animation_mode": "ACTIVE_ACTIONS",
            "active_action": (
                target_arm.animation_data.action.name
                if target_arm.animation_data and target_arm.animation_data.action
                else None
            ),
        }

        runtime_dir = (
            repo_root
            / "public"
            / "assets"
            / "characters"
            / "retarget-tests"
        )
        runtime_dir.mkdir(parents=True, exist_ok=True)
        runtime_glb = runtime_dir / "surprise-uppercut-prototype.glb"
        shutil.copy2(glb_path, runtime_glb)
        report["runtime_test_asset"] = (
            "/assets/characters/retarget-tests/"
            "surprise-uppercut-prototype.glb"
        )

        render_preview(preview_start, target_objects, frame_start)
        render_preview(preview_mid, target_objects, middle_frame)
        render_preview(preview_end, target_objects, frame_end)

        report["ascii_previews"] = {
            "start": ascii_preview(preview_start),
            "mid": ascii_preview(preview_mid),
            "end": ascii_preview(preview_end),
        }

        report["outputs"] = {
            "glb": str(glb_path.relative_to(output_root)).replace("\\", "/"),
            "preview_start": str(preview_start.relative_to(output_root)).replace("\\", "/"),
            "preview_mid": str(preview_mid.relative_to(output_root)).replace("\\", "/"),
            "preview_end": str(preview_end.relative_to(output_root)).replace("\\", "/"),
        }

        safe_source = re.sub(r"[^A-Za-z0-9._-]+", "_", source_path.stem).strip("_") or "source"
        published_preview_root = PUBLISH_PREVIEW_ROOT / safe_source
        report["published_previews"] = {
            "preview_start": str(published_preview_root / "preview_start.png").replace("\\", "/"),
            "preview_mid": str(published_preview_root / "preview_mid.png").replace("\\", "/"),
            "preview_end": str(published_preview_root / "preview_end.png").replace("\\", "/"),
        }

    except Exception as exc:
        report["status"] = "error"
        report["error"] = "{}: {}".format(type(exc).__name__, str(exc))
        report["traceback_tail"] = traceback.format_exc().splitlines()[-18:]

    json_path = output_root / "retarget-test-report.json"
    md_path = output_root / "retarget-test-report.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path.write_text(markdown(report), encoding="utf-8")

    print("")
    print("============================================================")
    print("RACING LIFE RETARGET TEST COMPLETE")
    print("============================================================")
    print("Status: {}".format(report["status"]))
    print("Source: {}".format(report["source_file"]))
    print("Target: {}".format(report["target_file"]))
    print("Report: {}".format(json_path))
    if report["status"] == "ok":
        print("GLB: {}".format(report["outputs"]["glb"]))
    print("============================================================")

    if args.publish:
        preview_files = []
        if report.get("status") == "ok":
            for key in ("preview_start", "preview_mid", "preview_end"):
                local_rel = report.get("outputs", {}).get(key)
                publish_rel = report.get("published_previews", {}).get(key)
                if local_rel and publish_rel:
                    local_path = output_root / local_rel
                    if local_path.exists():
                        preview_files.append((local_path, Path(publish_rel)))

        publish_reports(
            repo_root,
            json_path,
            md_path,
            preview_files=preview_files,
        )

    if report["status"] != "ok":
        raise SystemExit(8)


if __name__ == "__main__":
    main()
