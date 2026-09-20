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

    mapped = sorted(
        set(source_map) & set(target_map),
        key=lambda canonical: bone_depth(target_arm, target_map[canonical]),
    )

    target_arm.animation_data_clear()
    target_arm.animation_data_create()
    action = bpy.data.actions.new("RL_Retarget_Test")
    target_arm.animation_data.action = action

    source_rest_world = {}
    target_rest_world = {}
    for canonical in mapped:
        source_bone = source_arm.data.bones[source_map[canonical]]
        target_bone = target_arm.data.bones[target_map[canonical]]
        source_rest_world[canonical] = source_arm.matrix_world @ source_bone.matrix_local
        target_rest_world[canonical] = target_arm.matrix_world @ target_bone.matrix_local

    source_hips_rest_pos = None
    target_hips_rest_pos = None
    if "hips" in mapped:
        source_hips_rest_pos = source_rest_world["hips"].translation.copy()
        target_hips_rest_pos = target_rest_world["hips"].translation.copy()

    target_world_rot_inv = target_arm.matrix_world.to_quaternion().inverted()

    for frame in range(int(frame_start), int(frame_end) + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()

        for canonical in mapped:
            source_pose = source_arm.pose.bones.get(source_map[canonical])
            target_pose = target_arm.pose.bones.get(target_map[canonical])
            if source_pose is None or target_pose is None:
                continue

            source_pose_world = source_arm.matrix_world @ source_pose.matrix
            source_rest = source_rest_world[canonical]
            target_rest = target_rest_world[canonical]

            delta_world_rot = (
                source_pose_world.to_quaternion()
                @ source_rest.to_quaternion().inverted()
            )
            desired_world_rot = delta_world_rot @ target_rest.to_quaternion()
            desired_arm_rot = target_world_rot_inv @ desired_world_rot

            current_translation = target_pose.matrix.translation.copy()

            if canonical == "hips" and source_hips_rest_pos is not None:
                source_delta_world = (
                    source_pose_world.translation - source_hips_rest_pos
                ) * translation_scale
                desired_world_pos = target_hips_rest_pos + source_delta_world
                current_translation = target_arm.matrix_world.inverted() @ desired_world_pos

            target_pose.matrix = matrix_with_rotation_translation(
                desired_arm_rot,
                current_translation,
            )
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

    return {
        "mapped_bones": mapped,
        "mapped_count": len(mapped),
        "translation_scale": round(float(translation_scale), 6),
        "action_name": action.name,
    }


def export_target_glb(path, target_objects, target_arm):
    path.parent.mkdir(parents=True, exist_ok=True)

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
            export_animation_mode="ACTIONS",
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


def publish_reports(repo_root, json_path, md_path):
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

            run(["git", "add", str(PUBLISH_JSON), str(PUBLISH_MD)], cwd=worktree)
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
        "",
        "## Output",
        "",
        "- Retargeted GLB: {}".format(report.get("outputs", {}).get("glb", "-")),
        "- Start preview: {}".format(report.get("outputs", {}).get("preview_start", "-")),
        "- Mid preview: {}".format(report.get("outputs", {}).get("preview_mid", "-")),
        "- End preview: {}".format(report.get("outputs", {}).get("preview_end", "-")),
        "",
        "## Interpretation",
        "",
        "This is a first-pass matrix-delta retarget bake. It compensates for different rest-bone orientations instead of directly copying Mixamo rotation channels. Visual inspection is still required before treating the result as production-ready.",
        "",
    ]
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

        middle = int(round((frame_start + frame_end) * 0.5))
        render_preview(preview_start, target_objects, frame_start)
        render_preview(preview_mid, target_objects, middle)
        render_preview(preview_end, target_objects, frame_end)

        report["outputs"] = {
            "glb": str(glb_path.relative_to(output_root)).replace("\\", "/"),
            "preview_start": str(preview_start.relative_to(output_root)).replace("\\", "/"),
            "preview_mid": str(preview_mid.relative_to(output_root)).replace("\\", "/"),
            "preview_end": str(preview_end.relative_to(output_root)).replace("\\", "/"),
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
        publish_reports(repo_root, json_path, md_path)

    if report["status"] != "ok":
        raise SystemExit(8)


if __name__ == "__main__":
    main()
