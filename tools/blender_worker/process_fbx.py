import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import traceback

import bpy
from mathutils import Vector

BRANCH = "feature/3d-racing-foundation"
PUBLISH_JSON = Path("docs/blender/generated/processing-report.json")
PUBLISH_MD = Path("docs/blender/generated/processing-report.md")


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser(description="Racing Life Blender FBX processor")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument(
        "--mode",
        choices=("convert", "normalize", "preview", "process"),
        default="process",
    )
    parser.add_argument(
        "--target-height",
        type=float,
        default=1.80,
        help="Target world-space character height in meters for normalize/process modes.",
    )
    parser.add_argument("--publish", action="store_true")
    return parser.parse_args(argv)


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


def import_fbx(path):
    try:
        bpy.ops.import_scene.fbx(filepath=str(path), use_anim=True)
        return
    except Exception as first_error:
        try:
            bpy.ops.wm.fbx_import(filepath=str(path))
            return
        except Exception:
            raise first_error


def scene_objects():
    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    return objects, meshes, armatures


def world_bounds(meshes):
    min_v = Vector((math.inf, math.inf, math.inf))
    max_v = Vector((-math.inf, -math.inf, -math.inf))
    found = False

    for obj in meshes:
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
        return None

    dimensions = max_v - min_v
    return {
        "min": [round(v, 6) for v in min_v],
        "max": [round(v, 6) for v in max_v],
        "dimensions": [round(v, 6) for v in dimensions],
        "center": [round(v, 6) for v in ((min_v + max_v) * 0.5)],
    }


def bounds_height(bounds):
    if not bounds:
        return 0.0
    try:
        return float(bounds["dimensions"][2])
    except Exception:
        return 0.0


def scale_root_objects(scale_factor):
    if abs(scale_factor - 1.0) < 1e-8:
        return []

    changed = []
    for obj in bpy.context.scene.objects:
        if obj.parent is not None:
            continue
        obj.scale = tuple(float(v) * scale_factor for v in obj.scale)
        changed.append(obj.name)

    bpy.context.view_layer.update()
    return changed


def primary_action_info(armatures):
    action_names = []
    for arm in armatures:
        try:
            if arm.animation_data and arm.animation_data.action:
                action_names.append(arm.animation_data.action.name)
        except Exception:
            pass

    actions = list(bpy.data.actions)
    fps = float(bpy.context.scene.render.fps) / float(
        bpy.context.scene.render.fps_base or 1.0
    )

    if not actions:
        return {
            "count": 0,
            "names": [],
            "frame_start": None,
            "frame_end": None,
            "fps": round(fps, 4),
            "duration_seconds": 0.0,
        }

    starts = []
    ends = []
    for action in actions:
        try:
            start, end = action.frame_range
            starts.append(float(start))
            ends.append(float(end))
        except Exception:
            pass

    start = min(starts) if starts else None
    end = max(ends) if ends else None
    duration = ((end - start) / fps) if start is not None and end is not None and fps else 0.0

    all_names = sorted({a.name for a in actions} | set(action_names))
    return {
        "count": len(actions),
        "names": all_names,
        "frame_start": round(start, 3) if start is not None else None,
        "frame_end": round(end, 3) if end is not None else None,
        "fps": round(fps, 4),
        "duration_seconds": round(duration, 4),
    }


def set_export_selection(armatures):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(True)

    if armatures:
        bpy.context.view_layer.objects.active = armatures[0]
    elif bpy.context.scene.objects:
        bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]


def export_glb(path, armatures):
    path.parent.mkdir(parents=True, exist_ok=True)
    set_export_selection(armatures)

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
            export_frame_range=False,
        )
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)


def create_preview_camera(meshes):
    bounds = world_bounds(meshes)
    if not bounds:
        return None

    min_v = Vector(bounds["min"])
    max_v = Vector(bounds["max"])
    center = (min_v + max_v) * 0.5
    size = max_v - min_v
    radius = max(size.length * 0.5, 0.5)

    camera_data = bpy.data.cameras.new("RLPreviewCamera")
    camera = bpy.data.objects.new("RLPreviewCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera

    camera.location = center + Vector((radius * 1.6, -radius * 2.4, radius * 0.55))
    direction = center - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 55
    camera.data.clip_start = max(radius / 500.0, 0.001)
    camera.data.clip_end = max(radius * 20.0, 100.0)
    return camera


def render_preview(path, meshes, frame):
    scene = bpy.context.scene
    camera = create_preview_camera(meshes)
    if camera is None:
        raise RuntimeError("Cannot preview asset without mesh bounds.")

    scene.frame_set(int(round(frame)))
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(path)

    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except Exception:
        pass

    try:
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "MATERIAL"
        scene.display.shading.show_shadows = True
        scene.display.shading.show_cavity = True
    except Exception:
        pass

    scene.world.color = (0.035, 0.035, 0.045)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)


def output_rel(path, output_root):
    try:
        return str(path.resolve().relative_to(output_root.resolve())).replace("\\", "/")
    except Exception:
        return str(path)


def process_one(source, output_root, mode, target_height):
    bpy.ops.wm.read_factory_settings(use_empty=True)

    result = {
        "source_file": source.name,
        "mode": mode,
        "status": "ok",
        "outputs": {},
    }

    try:
        import_fbx(source)
        objects, meshes, armatures = scene_objects()

        before = world_bounds(meshes)
        source_height = bounds_height(before)
        result["source_bounds"] = before
        result["source_height"] = round(source_height, 6)
        result["mesh_count"] = len(meshes)
        result["armature_count"] = len(armatures)
        result["animation"] = primary_action_info(armatures)

        should_normalize = mode in ("normalize", "process")
        scale_factor = 1.0

        if should_normalize:
            if source_height <= 1e-8:
                raise RuntimeError("Could not determine a usable mesh height for normalization.")
            scale_factor = target_height / source_height
            scale_root_objects(scale_factor)

        result["normalized"] = should_normalize
        result["target_height"] = target_height if should_normalize else None
        result["scale_factor"] = round(scale_factor, 8)

        objects, meshes, armatures = scene_objects()
        after = world_bounds(meshes)
        result["output_bounds"] = after
        result["output_height"] = round(bounds_height(after), 6)

        stem = source.stem
        asset_dir = output_root / "processed" / stem
        asset_dir.mkdir(parents=True, exist_ok=True)

        if mode in ("convert", "normalize", "process"):
            suffix = "_normalized.glb" if should_normalize else ".glb"
            glb_path = asset_dir / (stem + suffix)
            export_glb(glb_path, armatures)
            result["outputs"]["glb"] = output_rel(glb_path, output_root)

        if mode in ("preview", "process"):
            anim = result["animation"]
            start = anim.get("frame_start")
            end = anim.get("frame_end")
            if start is None:
                start = bpy.context.scene.frame_start
            if end is None:
                end = bpy.context.scene.frame_end
            middle = (float(start) + float(end)) * 0.5

            start_path = asset_dir / (stem + "_preview_start.png")
            mid_path = asset_dir / (stem + "_preview_mid.png")
            render_preview(start_path, meshes, start)
            _, meshes, _ = scene_objects()
            render_preview(mid_path, meshes, middle)
            result["outputs"]["preview_start"] = output_rel(start_path, output_root)
            result["outputs"]["preview_mid"] = output_rel(mid_path, output_root)

    except Exception as exc:
        result["status"] = "error"
        result["error"] = "{}: {}".format(type(exc).__name__, str(exc))
        result["traceback_tail"] = traceback.format_exc().splitlines()[-16:]

    return result


def markdown_report(report):
    lines = [
        "# Racing Life Blender Processing Report",
        "",
        "Generated by the local Blender worker.",
        "",
        "- Blender: **{}**".format(report["blender_version"]),
        "- Mode: **{}**".format(report["mode"]),
        "- Files: **{}**".format(report["summary"]["files"]),
        "- Successful: **{}**".format(report["summary"]["ok"]),
        "- Failed: **{}**".format(report["summary"]["errors"]),
        "",
        "| File | Status | Source height | Output height | Scale | Animation | GLB | Previews |",
        "|---|---|---:|---:|---:|---:|---|---|",
    ]

    for item in report["assets"]:
        anim = item.get("animation", {})
        duration = anim.get("duration_seconds")
        anim_text = "{}s".format(duration) if duration is not None else "-"
        outputs = item.get("outputs", {})
        previews = "yes" if outputs.get("preview_start") or outputs.get("preview_mid") else "-"
        lines.append(
            "| {} | {} | {} | {} | {} | {} | {} | {} |".format(
                item.get("source_file", "-").replace("|", "\\|"),
                item.get("status", "-"),
                item.get("source_height", "-"),
                item.get("output_height", "-"),
                item.get("scale_factor", "-"),
                anim_text,
                outputs.get("glb", "-").replace("|", "\\|"),
                previews,
            )
        )

    lines.extend([
        "",
        "## Safety / interpretation",
        "",
        "- Source FBX files are not uploaded by the worker.",
        "- Normalize and process modes scale the imported top-level hierarchy so the mesh height matches the configured target height; source files are never overwritten.",
        "- Convert mode preserves imported scale and only exports a GLB copy.",
        "- Preview PNGs use Blender Workbench rendering and are intended for quick structural/animation inspection, not final art quality.",
        "- Retargeting and root-motion cleanup are intentionally separate future steps because they require a target skeleton and animation-specific decisions.",
        "",
    ])
    return "\n".join(lines)


def publish_reports(repo_root, json_path, md_path):
    if not (repo_root / ".git").exists():
        print("Publish skipped: repository .git directory was not found.")
        return False

    for attempt in range(1, 4):
        temp_base = Path(tempfile.mkdtemp(prefix="racing-life-blender-process-"))
        worktree = temp_base / "worktree"
        added = False
        try:
            run(["git", "fetch", "origin", BRANCH], cwd=repo_root)
            run(
                ["git", "worktree", "add", "--detach", str(worktree), "origin/{}".format(BRANCH)],
                cwd=repo_root,
            )
            added = True

            target_json = worktree / PUBLISH_JSON
            target_md = worktree / PUBLISH_MD
            target_json.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(json_path, target_json)
            shutil.copy2(md_path, target_md)

            run(["git", "add", str(PUBLISH_JSON), str(PUBLISH_MD)], cwd=worktree)
            diff = run(["git", "diff", "--cached", "--quiet"], cwd=worktree, check=False)
            if diff.returncode == 0:
                print("Processing report already up to date.")
                return True

            name = run(["git", "config", "user.name"], cwd=repo_root, check=False).stdout.strip()
            email = run(["git", "config", "user.email"], cwd=repo_root, check=False).stdout.strip()
            env = os.environ.copy()
            env["GIT_AUTHOR_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_AUTHOR_EMAIL"] = email or "racing-life-blender@local"
            env["GIT_COMMITTER_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_COMMITTER_EMAIL"] = email or "racing-life-blender@local"

            run(
                ["git", "commit", "-m", "Update Blender processing report"],
                cwd=worktree,
                env=env,
            )
            push = run(
                ["git", "push", "origin", "HEAD:{}".format(BRANCH)],
                cwd=worktree,
                check=False,
            )
            if push.returncode == 0:
                print("Processing report published to {}.".format(BRANCH))
                return True

            print("Publish attempt {} failed:".format(attempt))
            print(push.stdout.strip())
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

    print("Local processing finished, but GitHub report publication failed.")
    return False


def main():
    args = parse_args()
    input_dir = Path(args.input).resolve()
    output_root = Path(args.output).resolve()
    repo_root = Path(args.repo).resolve()

    if not input_dir.exists():
        raise SystemExit("Input folder does not exist: {}".format(input_dir))

    files = sorted(
        [p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() == ".fbx"],
        key=lambda p: p.name.lower(),
    )
    if not files:
        raise SystemExit("No FBX files found in: {}".format(input_dir))

    output_root.mkdir(parents=True, exist_ok=True)

    assets = []
    for index, source in enumerate(files, 1):
        print("")
        print("[{}/{}] {} -> {}".format(index, len(files), args.mode, source.name))
        item = process_one(source, output_root, args.mode, args.target_height)
        assets.append(item)
        print("    {}".format(item.get("status")))
        if item.get("error"):
            print("    {}".format(item["error"]))

    ok = sum(1 for item in assets if item.get("status") == "ok")
    report = {
        "schema_version": 1,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "blender_version": bpy.app.version_string,
        "mode": args.mode,
        "target_height": args.target_height if args.mode in ("normalize", "process") else None,
        "summary": {
            "files": len(assets),
            "ok": ok,
            "errors": len(assets) - ok,
        },
        "assets": assets,
    }

    json_path = output_root / "processing-report.json"
    md_path = output_root / "processing-report.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path.write_text(markdown_report(report), encoding="utf-8")

    print("")
    print("============================================================")
    print("RACING LIFE BLENDER PROCESSING COMPLETE")
    print("============================================================")
    print("Mode:   {}".format(args.mode))
    print("Files:  {}".format(report["summary"]["files"]))
    print("OK:     {}".format(report["summary"]["ok"]))
    print("Errors: {}".format(report["summary"]["errors"]))
    print("Report: {}".format(json_path))
    print("============================================================")

    if args.publish:
        publish_reports(repo_root, json_path, md_path)

    if report["summary"]["errors"]:
        raise SystemExit(4)


if __name__ == "__main__":
    main()
