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
PUBLISH_JSON = Path("docs/blender/generated/asset-report.json")
PUBLISH_MD = Path("docs/blender/generated/asset-report.md")


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--repo", required=True)
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
        raise RuntimeError("Command failed ({}):\n{}".format(" ".join(map(str, cmd)), result.stdout.strip()))
    return result


def safe_float(value):
    try:
        return round(float(value), 4)
    except Exception:
        return None


def action_summary(action, fps):
    try:
        start, end = [float(v) for v in action.frame_range]
    except Exception:
        start, end = 0.0, 0.0
    span = max(0.0, end - start)
    return {
        "name": action.name,
        "frame_start": round(start, 3),
        "frame_end": round(end, 3),
        "frame_span": round(span, 3),
        "duration_seconds": round(span / fps, 4) if fps > 0 else None,
    }


def detect_rig_clues(bone_names):
    lowered = [name.lower() for name in bone_names]
    clues = []
    if any("mixamorig" in name for name in lowered):
        clues.append("mixamo")
    if any(name.startswith("def-") or name.startswith("org-") for name in lowered):
        clues.append("rigify")
    if any(name in lowered for name in ("root", "pelvis", "spine_01", "upperarm_l")):
        clues.append("unreal-style")
    if any("bip001" in name or name.startswith("bip") for name in lowered):
        clues.append("biped/3ds-max-style")
    if any(name == "hips" or name.endswith(":hips") for name in lowered):
        clues.append("humanoid-hips")
    if any("j_bip" in name for name in lowered):
        clues.append("j_bip-style")
    return sorted(set(clues))


def world_bounds(meshes):
    min_v = Vector((math.inf, math.inf, math.inf))
    max_v = Vector((-math.inf, -math.inf, -math.inf))
    found = False
    for obj in meshes:
        try:
            for corner in obj.bound_box:
                p = obj.matrix_world @ Vector(corner)
                min_v.x, min_v.y, min_v.z = min(min_v.x, p.x), min(min_v.y, p.y), min(min_v.z, p.z)
                max_v.x, max_v.y, max_v.z = max(max_v.x, p.x), max(max_v.y, p.y), max(max_v.z, p.z)
                found = True
        except Exception:
            pass
    if not found:
        return None
    dims = max_v - min_v
    return {
        "min": [round(v, 4) for v in min_v],
        "max": [round(v, 4) for v in max_v],
        "dimensions": [round(v, 4) for v in dims],
    }


def import_asset(path):
    ext = path.suffix.lower()
    if ext == ".fbx":
        try:
            bpy.ops.import_scene.fbx(filepath=str(path), use_anim=True)
            return
        except Exception as first_error:
            try:
                bpy.ops.wm.fbx_import(filepath=str(path))
                return
            except Exception:
                raise first_error
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=str(path))
        return
    raise RuntimeError("Unsupported asset format: {}".format(ext))


def classify(mesh_count, armature_count, action_count):
    if mesh_count > 0 and armature_count > 0 and action_count > 0:
        return "mixed rigged character/model + animation"
    if mesh_count > 0 and armature_count > 0:
        return "rigged character/model"
    if mesh_count == 0 and armature_count > 0 and action_count > 0:
        return "likely animation/emote-only FBX"
    if mesh_count > 0 and armature_count == 0 and action_count == 0:
        return "static model/prop"
    if action_count > 0 and mesh_count == 0:
        return "animation-only or animation package (uncertain)"
    if mesh_count > 0:
        return "model/prop (rig status uncertain)"
    return "unknown/empty"


def inspect_one(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rec = {
        "file": path.name,
        "size_bytes": path.stat().st_size,
        "size_mb": round(path.stat().st_size / (1024 * 1024), 3),
        "status": "ok",
    }
    try:
        import_asset(path)
        scene = bpy.context.scene
        fps = float(scene.render.fps) / float(scene.render.fps_base or 1.0)
        objects = list(scene.objects)
        meshes = [o for o in objects if o.type == "MESH"]
        armatures = [o for o in objects if o.type == "ARMATURE"]

        material_names = sorted({
            slot.material.name
            for obj in meshes
            for slot in obj.material_slots
            if slot.material is not None
        })

        vertices = 0
        polygons = 0
        for obj in meshes:
            try:
                vertices += len(obj.data.vertices)
                polygons += len(obj.data.polygons)
            except Exception:
                pass

        all_bones = []
        armature_info = []
        for arm in armatures:
            bone_names = [bone.name for bone in arm.data.bones]
            all_bones.extend(bone_names)
            roots = [bone.name for bone in arm.data.bones if bone.parent is None]
            assigned_action = None
            try:
                if arm.animation_data and arm.animation_data.action:
                    assigned_action = arm.animation_data.action.name
            except Exception:
                pass

            nla = []
            try:
                if arm.animation_data:
                    for track in arm.animation_data.nla_tracks:
                        for strip in track.strips:
                            nla.append({
                                "track": track.name,
                                "strip": strip.name,
                                "action": strip.action.name if strip.action else None,
                                "frame_start": safe_float(strip.frame_start),
                                "frame_end": safe_float(strip.frame_end),
                            })
            except Exception:
                pass

            armature_info.append({
                "object_name": arm.name,
                "data_name": arm.data.name,
                "bone_count": len(bone_names),
                "root_bones": roots,
                "assigned_action": assigned_action,
                "nla_strips": nla,
                "bone_names": bone_names[:160],
                "bone_names_truncated": len(bone_names) > 160,
            })

        actions = sorted(
            [action_summary(action, fps) for action in bpy.data.actions],
            key=lambda item: item["name"].lower(),
        )
        max_duration = max([a["duration_seconds"] or 0 for a in actions] or [0])

        rec.update({
            "scene_fps": round(fps, 4),
            "object_count": len(objects),
            "mesh_count": len(meshes),
            "armature_count": len(armatures),
            "material_count": len(material_names),
            "materials": material_names[:100],
            "materials_truncated": len(material_names) > 100,
            "total_vertices": vertices,
            "total_polygons": polygons,
            "bounds": world_bounds(meshes),
            "armatures": armature_info,
            "rig_clues": detect_rig_clues(all_bones),
            "action_count": len(actions),
            "actions": actions,
            "max_animation_duration_seconds": round(max_duration, 4),
            "classification": classify(len(meshes), len(armatures), len(actions)),
        })
    except Exception as exc:
        rec["status"] = "error"
        rec["classification"] = "import failed / unknown"
        rec["error"] = "{}: {}".format(type(exc).__name__, str(exc))
        rec["traceback_tail"] = traceback.format_exc().splitlines()[-12:]
    return rec


def build_markdown(report):
    lines = [
        "# Racing Life Blender Asset Inspection",
        "",
        "Generated automatically by the local Blender worker.",
        "",
        "- Blender: **{}**".format(report["blender_version"]),
        "- 3D assets inspected: **{}**".format(report["summary"]["files"]),
        "- Successful imports: **{}**".format(report["summary"]["ok"]),
        "- Failed imports: **{}**".format(report["summary"]["errors"]),
        "",
        "## Files",
        "",
        "| File | Classification | Meshes | Armatures | Actions | Max animation | Rig clues | Status |",
        "|---|---|---:|---:|---:|---:|---|---|",
    ]

    for item in report["assets"]:
        clues = ", ".join(item.get("rig_clues", [])) or "-"
        duration = item.get("max_animation_duration_seconds")
        duration_text = "{:.2f}s".format(duration) if isinstance(duration, (int, float)) else "-"
        lines.append("| {} | {} | {} | {} | {} | {} | {} | {} |".format(
            item["file"].replace("|", "\\|"),
            item.get("classification", "-").replace("|", "\\|"),
            item.get("mesh_count", "-"),
            item.get("armature_count", "-"),
            item.get("action_count", "-"),
            duration_text,
            clues.replace("|", "\\|"),
            item.get("status", "-"),
        ))

    lines.extend(["", "## Detailed animation takes", ""])
    for item in report["assets"]:
        lines.append("### {}".format(item["file"]))
        lines.append("")
        lines.append("- Classification: **{}**".format(item.get("classification", "unknown")))
        lines.append("- File size: {} MB".format(item.get("size_mb", 0)))

        if item.get("status") != "ok":
            lines.append("- Import error: {}".format(item.get("error", "unknown")))
            lines.append("")
            continue

        lines.append("- Geometry: {} mesh(es), {:,} vertices, {:,} polygons".format(
            item.get("mesh_count", 0),
            item.get("total_vertices", 0),
            item.get("total_polygons", 0),
        ))
        lines.append("- Rig: {} armature(s); clues: {}".format(
            item.get("armature_count", 0),
            ", ".join(item.get("rig_clues", [])) or "none detected",
        ))

        roots = []
        for arm in item.get("armatures", []):
            roots.extend(arm.get("root_bones", []))
        lines.append("- Root bones: {}".format(", ".join(roots) if roots else "none detected"))

        actions = item.get("actions", [])
        if actions:
            lines.append("- Actions/takes:")
            for action in actions:
                lines.append("  - {}: frames {}-{} (~{}s at {} fps)".format(
                    action["name"],
                    action["frame_start"],
                    action["frame_end"],
                    action["duration_seconds"],
                    item.get("scene_fps"),
                ))
        else:
            lines.append("- Actions/takes: none detected")
        lines.append("")

    lines.extend([
        "## Notes",
        "",
        "- Classification is structural, not artistic: an armature plus animation actions but no mesh is likely an animation/emote FBX.",
        "- Exact retargeting quality still depends on skeleton compatibility, rest pose, bone orientation, root motion, and hand/foot contact.",
        "- Source FBX/GLB/GLTF files are intentionally not uploaded by this worker.",
        "",
    ])
    return "\n".join(lines)


def make_report(input_dir):
    files = sorted(
        [p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() in (".fbx", ".glb", ".gltf")],
        key=lambda p: p.name.lower(),
    )
    assets = []
    for index, path in enumerate(files, 1):
        print("[{}/{}] Inspecting {}".format(index, len(files), path.name))
        item = inspect_one(path)
        assets.append(item)
        print("    -> {} [{}]".format(item.get("classification"), item.get("status")))

    ok = sum(1 for item in assets if item.get("status") == "ok")
    return {
        "schema_version": 1,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "blender_version": bpy.app.version_string,
        "summary": {"files": len(assets), "ok": ok, "errors": len(assets) - ok},
        "assets": assets,
    }


def publish_reports(repo_root, json_path, md_path):
    print("")
    print("Publishing inspection report to GitHub feature branch...")
    if not (repo_root / ".git").exists():
        print("Publish skipped: repository .git directory was not found.")
        return False

    for attempt in range(1, 4):
        temp_base = Path(tempfile.mkdtemp(prefix="racing-life-blender-report-"))
        temp_dir = temp_base / "worktree"
        added_worktree = False
        try:
            run(["git", "fetch", "origin", BRANCH], cwd=repo_root)
            run(["git", "worktree", "add", "--detach", str(temp_dir), "origin/{}".format(BRANCH)], cwd=repo_root)
            added_worktree = True

            target_json = temp_dir / PUBLISH_JSON
            target_md = temp_dir / PUBLISH_MD
            target_json.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(json_path, target_json)
            shutil.copy2(md_path, target_md)

            run(["git", "add", str(PUBLISH_JSON), str(PUBLISH_MD)], cwd=temp_dir)
            diff = run(["git", "diff", "--cached", "--quiet"], cwd=temp_dir, check=False)
            if diff.returncode == 0:
                print("Published report is already up to date; no commit needed.")
                return True

            name = run(["git", "config", "user.name"], cwd=repo_root, check=False).stdout.strip()
            email = run(["git", "config", "user.email"], cwd=repo_root, check=False).stdout.strip()
            env = os.environ.copy()
            env["GIT_AUTHOR_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_AUTHOR_EMAIL"] = email or "racing-life-blender@local"
            env["GIT_COMMITTER_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_COMMITTER_EMAIL"] = email or "racing-life-blender@local"

            run(["git", "commit", "-m", "Update Blender asset inspection report"], cwd=temp_dir, env=env)
            push = run(["git", "push", "origin", "HEAD:{}".format(BRANCH)], cwd=temp_dir, check=False)
            if push.returncode == 0:
                print("Report published to {}.".format(BRANCH))
                return True

            print("Publish attempt {} failed or lost a branch race:".format(attempt))
            print(push.stdout.strip())
            if attempt < 3:
                print("Retrying from the newest remote branch...")
        except Exception as exc:
            print("Publish attempt {} failed: {}".format(attempt, exc))
        finally:
            if added_worktree:
                run(["git", "worktree", "remove", "--force", str(temp_dir)], cwd=repo_root, check=False)
            shutil.rmtree(temp_base, ignore_errors=True)

    print("Local reports were created, but automatic GitHub publication failed.")
    print("Rerun the worker later; no source FBX files were uploaded.")
    return False


def main():
    args = parse_args()
    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    repo_root = Path(args.repo).resolve()

    if not input_dir.exists():
        raise SystemExit("Input folder does not exist: {}".format(input_dir))
    if not any(
        p.is_file() and p.suffix.lower() in (".fbx", ".glb", ".gltf")
        for p in input_dir.iterdir()
    ):
        raise SystemExit("No FBX, GLB or GLTF files found in: {}".format(input_dir))

    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "asset-report.json"
    md_path = output_dir / "asset-report.md"

    report = make_report(input_dir)
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path.write_text(build_markdown(report), encoding="utf-8")

    print("")
    print("============================================================")
    print("INSPECTION COMPLETE")
    print("============================================================")
    print("Blender: {}".format(report["blender_version"]))
    print("Files:   {}".format(report["summary"]["files"]))
    print("OK:      {}".format(report["summary"]["ok"]))
    print("Errors:  {}".format(report["summary"]["errors"]))
    print("JSON:    {}".format(json_path))
    print("Markdown:{}".format(md_path))
    print("============================================================")

    if args.publish:
        publish_reports(repo_root, json_path, md_path)


if __name__ == "__main__":
    main()
