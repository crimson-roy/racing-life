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
from mathutils import Matrix, Vector

BRANCH = "feature/3d-racing-foundation"
PUBLISH_JSON = Path("docs/blender/generated/mixamo-base-test-report.json")
PUBLISH_MD = Path("docs/blender/generated/mixamo-base-test-report.md")


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser(description="Build prototype on canonical Mixamo skeleton")
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
    return re.sub(
        r"[^a-z0-9]+",
        "",
        str(name).split(":")[-1].lower(),
    )


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
    return [
        obj
        for obj in bpy.context.scene.objects
        if obj.name not in before_names
    ]


def choose_armature(objects):
    arms = [obj for obj in objects if obj.type == "ARMATURE"]
    if not arms:
        return None
    return max(arms, key=lambda obj: len(obj.data.bones))


def mixamo_map(armature):
    result = {}
    for bone in armature.data.bones:
        result.setdefault(normalize_bone_name(bone.name), bone.name)
    return result


def target_canonical_name(name):
    n = normalize_bone_name(name)
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
    return direct.get(n, n)


def target_map(armature):
    result = {}
    for bone in armature.data.bones:
        result.setdefault(target_canonical_name(bone.name), bone.name)
    return result


def bone_world_head(armature, bone_name):
    bone = armature.data.bones[bone_name]
    return armature.matrix_world @ bone.head_local


def bone_world_tail(armature, bone_name):
    bone = armature.data.bones[bone_name]
    return armature.matrix_world @ bone.tail_local


def skeleton_height(armature):
    points = []
    for bone in armature.data.bones:
        points.append(armature.matrix_world @ bone.head_local)
        points.append(armature.matrix_world @ bone.tail_local)
    if not points:
        return 1.0
    zs = [p.z for p in points]
    value = max(zs) - min(zs)
    return float(value) if value > 1e-8 else 1.0


def body_basis(armature, mapping):
    hips = bone_world_head(armature, mapping["hips"])
    head = bone_world_head(armature, mapping["head"])
    left_shoulder = bone_world_head(armature, mapping["leftshoulder"])
    right_shoulder = bone_world_head(armature, mapping["rightshoulder"])

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

    right = up.cross(forward)
    right.normalize()

    basis = Matrix((
        (right.x, forward.x, up.x),
        (right.y, forward.y, up.y),
        (right.z, forward.z, up.z),
    ))

    return hips, basis


def align_source_armature(source_arm, source_mapping, target_arm, target_mapping):
    source_hips, source_basis = body_basis(source_arm, source_mapping)
    target_hips, target_basis = body_basis(target_arm, target_mapping)

    source_height = skeleton_height(source_arm)
    target_height = skeleton_height(target_arm)
    scale = target_height / source_height if source_height > 1e-8 else 1.0

    rotation = (
        target_basis
        @ source_basis.inverted()
    ).to_quaternion()

    align = (
        Matrix.Translation(target_hips)
        @ rotation.to_matrix().to_4x4()
        @ Matrix.Scale(scale, 4)
        @ Matrix.Translation(-source_hips)
    )

    source_arm.matrix_world = align @ source_arm.matrix_world
    bpy.context.view_layer.update()

    # Bone-heat weighting is much more reliable when the armature object has
    # unit rotation/scale. Bake the global alignment into the armature data
    # before attempting automatic weights. Pose animation remains on the same
    # bones; only the armature object's transform is normalized.
    bpy.ops.object.select_all(action="DESELECT")
    source_arm.select_set(True)
    bpy.context.view_layer.objects.active = source_arm
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.context.view_layer.update()

    return {
        "source_height": round(source_height, 6),
        "target_height": round(target_height, 6),
        "scale_factor": round(scale, 6),
        "rotation_angle_degrees": round(
            math.degrees(float(rotation.angle)),
            4,
        ),
    }


def remove_source_meshes(source_objects, source_arm):
    for obj in list(source_objects):
        if obj == source_arm:
            continue
        if obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)


def prepare_target_meshes(target_objects, old_target_armature):
    meshes = [obj for obj in target_objects if obj.type == "MESH"]

    if old_target_armature is not None:
        old_target_armature.data.pose_position = "REST"

    bpy.context.view_layer.update()

    for mesh in meshes:
        world_matrix = mesh.matrix_world.copy()

        for modifier in list(mesh.modifiers):
            if modifier.type == "ARMATURE":
                mesh.modifiers.remove(modifier)

        mesh.parent = None
        mesh.matrix_world = world_matrix

        # Old Rigify/metarig groups are not valid for the canonical Mixamo
        # skeleton. Automatic weights will rebuild the skinning groups.
        mesh.vertex_groups.clear()

    return meshes


def bind_automatic(meshes, source_arm):
    if not meshes:
        raise RuntimeError("Target contains no meshes to bind.")

    results = []
    bound_count = 0

    source_arm.data.pose_position = "REST"
    bpy.context.view_layer.update()

    for mesh in meshes:
        record = {
            "mesh": mesh.name,
            "vertices": len(mesh.data.vertices),
            "method": None,
            "status": "pending",
            "vertex_groups": 0,
        }

        # Normalize mesh rotation/scale before bone-heat weighting while
        # preserving its world-space position.
        bpy.ops.object.select_all(action="DESELECT")
        mesh.select_set(True)
        bpy.context.view_layer.objects.active = mesh
        try:
            bpy.ops.object.transform_apply(
                location=False,
                rotation=True,
                scale=True,
            )
        except Exception as exc:
            record["transform_warning"] = "{}: {}".format(
                type(exc).__name__,
                str(exc),
            )

        methods = (
            ("automatic", "ARMATURE_AUTO"),
            ("envelope", "ARMATURE_ENVELOPE"),
        )

        last_error = None

        for method_name, parent_type in methods:
            # Clear any partial result from a previous attempt.
            for modifier in list(mesh.modifiers):
                if modifier.type == "ARMATURE":
                    mesh.modifiers.remove(modifier)

            mesh.vertex_groups.clear()
            mesh.parent = None

            bpy.ops.object.select_all(action="DESELECT")
            mesh.select_set(True)
            source_arm.select_set(True)
            bpy.context.view_layer.objects.active = source_arm

            try:
                bpy.ops.object.parent_set(type=parent_type)
                bpy.context.view_layer.update()
            except Exception as exc:
                last_error = "{}: {}".format(
                    type(exc).__name__,
                    str(exc),
                )
                continue

            modifiers = [
                modifier
                for modifier in mesh.modifiers
                if modifier.type == "ARMATURE"
            ]

            # A modifier plus at least one generated vertex group is enough
            # for this prototype playback test. Envelope mode is deliberately
            # allowed as a fallback when bone heat cannot solve a mesh.
            if modifiers and len(mesh.vertex_groups) > 0:
                record["method"] = method_name
                record["status"] = "bound"
                record["vertex_groups"] = len(mesh.vertex_groups)
                bound_count += 1
                break

            last_error = (
                "{} produced no usable armature binding "
                "(modifiers={}, groups={})".format(
                    method_name,
                    len(modifiers),
                    len(mesh.vertex_groups),
                )
            )

        if record["status"] != "bound":
            # Do not kill the entire prototype test because one accessory or
            # tiny helper mesh cannot be automatically weighted. Leave it
            # static, record it, and continue so we can still judge the main
            # body deformation.
            record["status"] = "unbound"
            record["error"] = last_error or "Unknown binding failure"

        results.append(record)

    if bound_count == 0:
        raise RuntimeError(
            "No prototype meshes could be rebound to the Mixamo armature."
        )

    return {
        "mesh_count": len(meshes),
        "bound_count": bound_count,
        "unbound_count": len(meshes) - bound_count,
        "meshes": [mesh.name for mesh in meshes],
        "results": results,
        "vertex_group_counts": {
            mesh.name: len(mesh.vertex_groups)
            for mesh in meshes
        },
    }


def primary_action(armature):
    if armature.animation_data and armature.animation_data.action:
        return armature.animation_data.action
    if bpy.data.actions:
        return bpy.data.actions[0]
    return None


def rename_action(action):
    if action is None:
        return None
    action.name = "RL_Mixamo_Uppercut"
    return action


def export_glb(path, meshes, armature):
    path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature

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


def publish_report(repo_root, json_path, md_path):
    if not (repo_root / ".git").exists():
        return False

    for attempt in range(1, 4):
        temp_base = Path(tempfile.mkdtemp(prefix="racing-life-mixamo-base-"))
        worktree = temp_base / "worktree"
        added = False
        try:
            run(["git", "fetch", "origin", BRANCH], cwd=repo_root)
            run(
                [
                    "git",
                    "worktree",
                    "add",
                    "--detach",
                    str(worktree),
                    "origin/{}".format(BRANCH),
                ],
                cwd=repo_root,
            )
            added = True

            dst_json = worktree / PUBLISH_JSON
            dst_md = worktree / PUBLISH_MD
            dst_json.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(json_path, dst_json)
            shutil.copy2(md_path, dst_md)

            run(
                ["git", "add", str(PUBLISH_JSON), str(PUBLISH_MD)],
                cwd=worktree,
            )
            diff = run(
                ["git", "diff", "--cached", "--quiet"],
                cwd=worktree,
                check=False,
            )
            if diff.returncode == 0:
                return True

            name = run(
                ["git", "config", "user.name"],
                cwd=repo_root,
                check=False,
            ).stdout.strip()
            email = run(
                ["git", "config", "user.email"],
                cwd=repo_root,
                check=False,
            ).stdout.strip()

            env = os.environ.copy()
            env["GIT_AUTHOR_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_AUTHOR_EMAIL"] = email or "racing-life-blender@local"
            env["GIT_COMMITTER_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_COMMITTER_EMAIL"] = email or "racing-life-blender@local"

            run(
                ["git", "commit", "-m", "Update Blender Mixamo base test report"],
                cwd=worktree,
                env=env,
            )

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
        "# Racing Life Mixamo Base Test",
        "",
        "- Status: **{}**".format(report["status"]),
        "- Blender: **{}**".format(report["blender_version"]),
        "- Source Mixamo asset: **{}**".format(report["source_file"]),
        "- Prototype target: **{}**".format(report["target_file"]),
        "- Strategy: **{}**".format(report.get("strategy", "-")),
        "",
    ]

    if report.get("alignment"):
        lines.extend([
            "## Alignment",
            "",
            "- Source skeleton height: {}".format(report["alignment"]["source_height"]),
            "- Target skeleton height: {}".format(report["alignment"]["target_height"]),
            "- Scale factor: {}".format(report["alignment"]["scale_factor"]),
            "- Global facing correction: {} degrees".format(
                report["alignment"]["rotation_angle_degrees"]
            ),
            "",
        ])

    if report.get("binding"):
        lines.extend([
            "## Binding",
            "",
            "- Meshes found: {}".format(report["binding"]["mesh_count"]),
            "- Meshes rebound: {}".format(report["binding"]["bound_count"]),
            "- Meshes left unbound: {}".format(report["binding"]["unbound_count"]),
            "- Mesh names: {}".format(", ".join(report["binding"]["meshes"])),
            "",
        ])

    if report.get("animation"):
        lines.extend([
            "## Animation",
            "",
            "- Action: {}".format(report["animation"]["name"]),
            "- Frames: {}–{}".format(
                report["animation"]["frame_start"],
                report["animation"]["frame_end"],
            ),
            "- FPS: {}".format(report["animation"]["fps"]),
            "- Duration: {} s".format(report["animation"]["duration_seconds"]),
            "",
        ])

    if report.get("error"):
        lines.extend([
            "## Error",
            "",
            report["error"],
            "",
        ])

    lines.extend([
        "## Runtime asset",
        "",
        report.get("runtime_test_asset", "-"),
        "",
        "This test changes the prototype's skinning once so it uses a canonical Mixamo armature, instead of retargeting every Mixamo animation onto the prototype's Rigify/metarig skeleton.",
        "",
    ])

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
        "strategy": "rebind-prototype-to-canonical-mixamo-skeleton",
        "status": "ok",
    }

    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)

        before = {obj.name for obj in bpy.context.scene.objects}
        import_asset(source_path)
        source_objects = newly_imported(before)
        source_arm = choose_armature(source_objects)
        if source_arm is None:
            raise RuntimeError("Source contains no armature.")

        source_mapping = mixamo_map(source_arm)
        required = {
            "hips", "head", "leftshoulder", "rightshoulder",
        }
        if not required.issubset(source_mapping):
            raise RuntimeError(
                "Source is missing required Mixamo body bones: {}".format(
                    sorted(required - set(source_mapping))
                )
            )

        source_action = rename_action(primary_action(source_arm))
        if source_action is None:
            raise RuntimeError("Source contains no animation action.")

        frame_start, frame_end = [
            int(round(value))
            for value in source_action.frame_range
        ]
        fps = (
            float(bpy.context.scene.render.fps)
            / float(bpy.context.scene.render.fps_base or 1.0)
        )

        remove_source_meshes(source_objects, source_arm)

        before = {obj.name for obj in bpy.context.scene.objects}
        import_asset(target_path)
        target_objects = newly_imported(before)
        old_target_arm = choose_armature(target_objects)
        if old_target_arm is None:
            raise RuntimeError("Prototype target contains no armature.")

        target_mapping = target_map(old_target_arm)
        if not required.issubset(target_mapping):
            raise RuntimeError(
                "Prototype target is missing required body bones: {}".format(
                    sorted(required - set(target_mapping))
                )
            )

        source_arm.data.pose_position = "REST"
        old_target_arm.data.pose_position = "REST"
        bpy.context.view_layer.update()

        report["alignment"] = align_source_armature(
            source_arm,
            source_mapping,
            old_target_arm,
            target_mapping,
        )

        meshes = prepare_target_meshes(
            target_objects,
            old_target_arm,
        )

        report["binding"] = bind_automatic(
            meshes,
            source_arm,
        )

        source_arm.data.pose_position = "POSE"
        source_arm.animation_data_create()
        source_arm.animation_data.action = source_action

        bpy.context.scene.frame_start = frame_start
        bpy.context.scene.frame_end = frame_end
        bpy.context.scene.render.fps = max(1, int(round(fps)))

        out_dir = output_root / "mixamo-base-test"
        out_glb = out_dir / "prototype_mixamo_uppercut.glb"
        export_glb(out_glb, meshes, source_arm)

        runtime_dir = (
            repo_root
            / "public"
            / "assets"
            / "characters"
            / "retarget-tests"
        )
        runtime_dir.mkdir(parents=True, exist_ok=True)

        runtime_glb = (
            runtime_dir
            / "surprise-uppercut-prototype.glb"
        )
        shutil.copy2(out_glb, runtime_glb)

        report["runtime_test_asset"] = (
            "/assets/characters/retarget-tests/"
            "surprise-uppercut-prototype.glb"
        )
        report["output_glb"] = str(
            out_glb.relative_to(output_root)
        ).replace("\\", "/")

        report["animation"] = {
            "name": source_action.name,
            "frame_start": frame_start,
            "frame_end": frame_end,
            "fps": fps,
            "duration_seconds": round(
                max(0, frame_end - frame_start) / fps,
                4,
            ) if fps else None,
        }

    except Exception as exc:
        report["status"] = "error"
        report["error"] = "{}: {}".format(
            type(exc).__name__,
            str(exc),
        )
        report["traceback_tail"] = traceback.format_exc().splitlines()[-18:]

    json_path = output_root / "mixamo-base-test-report.json"
    md_path = output_root / "mixamo-base-test-report.md"

    json_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    md_path.write_text(
        markdown(report),
        encoding="utf-8",
    )

    print("")
    print("============================================================")
    print("RACING LIFE MIXAMO BASE TEST COMPLETE")
    print("============================================================")
    print("Status: {}".format(report["status"]))
    print("Source: {}".format(report["source_file"]))
    print("Target: {}".format(report["target_file"]))
    print("Report: {}".format(json_path))
    if report["status"] == "ok":
        print("Runtime asset: {}".format(report["runtime_test_asset"]))
    print("============================================================")

    if args.publish:
        publish_report(
            repo_root,
            json_path,
            md_path,
        )

    if report["status"] != "ok":
        raise SystemExit(9)


if __name__ == "__main__":
    main()
