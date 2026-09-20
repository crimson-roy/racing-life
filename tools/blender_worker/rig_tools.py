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

BRANCH = "feature/3d-racing-foundation"
PUBLISH_JSON = Path("docs/blender/generated/rig-report.json")
PUBLISH_MD = Path("docs/blender/generated/rig-report.md")

CORE_BONES = {
    "hips",
    "spine",
    "spine1",
    "spine2",
    "neck",
    "head",
    "leftshoulder",
    "leftarm",
    "leftforearm",
    "lefthand",
    "rightshoulder",
    "rightarm",
    "rightforearm",
    "righthand",
    "leftupleg",
    "leftleg",
    "leftfoot",
    "rightupleg",
    "rightleg",
    "rightfoot",
}


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser(description="Racing Life rig and animation tools")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument(
        "--mode",
        choices=("validate-rig", "compare-skeletons", "extract-animation"),
        required=True,
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


def normalize_bone_name(name):
    name = str(name).split(":")[-1]
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def is_finger_bone(name):
    n = normalize_bone_name(name)
    return any(token in n for token in ("thumb", "index", "middle", "ring", "pinky", "little"))


def detect_rig_family(bone_names):
    raw = [str(name) for name in bone_names]
    lowered = [name.lower() for name in raw]
    if any("mixamorig" in name for name in lowered):
        return "mixamo"
    if any(name.startswith("DEF-") or name.startswith("ORG-") for name in raw):
        return "rigify"
    if any(name.lower().startswith("bip") for name in raw):
        return "biped"
    if any(normalize_bone_name(name) in ("root", "pelvis", "spine01") for name in raw):
        return "unreal-style-or-generic"
    return "generic-or-unknown"


def choose_armature():
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not armatures:
        return None
    return max(armatures, key=lambda arm: len(arm.data.bones))


def armature_height(armature):
    if armature is None or not armature.data.bones:
        return 0.0
    points = []
    for bone in armature.data.bones:
        try:
            points.append(armature.matrix_world @ bone.head_local)
            points.append(armature.matrix_world @ bone.tail_local)
        except Exception:
            pass
    if not points:
        return 0.0
    z_values = [point.z for point in points]
    return max(z_values) - min(z_values)


def action_info(armature):
    fps = float(bpy.context.scene.render.fps) / float(
        bpy.context.scene.render.fps_base or 1.0
    )
    actions = list(bpy.data.actions)
    assigned = None
    try:
        if armature and armature.animation_data and armature.animation_data.action:
            assigned = armature.animation_data.action.name
    except Exception:
        pass

    rows = []
    for action in actions:
        try:
            start, end = [float(v) for v in action.frame_range]
        except Exception:
            start, end = 0.0, 0.0
        rows.append({
            "name": action.name,
            "frame_start": round(start, 3),
            "frame_end": round(end, 3),
            "fps": round(fps, 4),
            "duration_seconds": round(max(0.0, end - start) / fps, 4) if fps else None,
        })

    return {
        "assigned_action": assigned,
        "count": len(rows),
        "actions": rows,
    }


def skeleton_record(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rec = {
        "file": path.name,
        "status": "ok",
    }

    try:
        import_asset(path)
        armature = choose_armature()
        if armature is None:
            raise RuntimeError("No armature found.")

        bone_names = [bone.name for bone in armature.data.bones]
        normalized = [normalize_bone_name(name) for name in bone_names]
        normalized_set = set(normalized)
        core_present = sorted(CORE_BONES & normalized_set)
        core_missing = sorted(CORE_BONES - normalized_set)
        finger_bones = sorted(name for name in normalized if is_finger_bone(name))
        root_bones = [bone.name for bone in armature.data.bones if bone.parent is None]

        rec.update({
            "armature_object": armature.name,
            "rig_family": detect_rig_family(bone_names),
            "bone_count": len(bone_names),
            "normalized_bones": sorted(normalized_set),
            "root_bones": root_bones,
            "core_bones_present": core_present,
            "core_bones_missing": core_missing,
            "core_coverage": round(len(core_present) / len(CORE_BONES), 4),
            "finger_bone_count": len(finger_bones),
            "finger_bones": finger_bones,
            "armature_height": round(armature_height(armature), 6),
            "animation": action_info(armature),
        })

        if not core_missing:
            rec["validation"] = "core humanoid complete"
        elif len(core_missing) <= 2:
            rec["validation"] = "core humanoid mostly complete"
        else:
            rec["validation"] = "core humanoid incomplete"

    except Exception as exc:
        rec["status"] = "error"
        rec["validation"] = "failed"
        rec["error"] = "{}: {}".format(type(exc).__name__, str(exc))
        rec["traceback_tail"] = traceback.format_exc().splitlines()[-14:]

    return rec


def compare_pair(a, b):
    bones_a = set(a.get("normalized_bones", []))
    bones_b = set(b.get("normalized_bones", []))
    shared = bones_a & bones_b
    union = bones_a | bones_b
    jaccard = len(shared) / len(union) if union else 0.0

    nonfinger_a = {name for name in bones_a if not is_finger_bone(name)}
    nonfinger_b = {name for name in bones_b if not is_finger_bone(name)}
    nonfinger_shared = nonfinger_a & nonfinger_b
    nonfinger_union = nonfinger_a | nonfinger_b
    nonfinger_jaccard = (
        len(nonfinger_shared) / len(nonfinger_union)
        if nonfinger_union
        else 0.0
    )

    exact = bones_a == bones_b and bool(bones_a)
    core_a = not a.get("core_bones_missing")
    core_b = not b.get("core_bones_missing")

    if exact:
        compatibility = "exact skeleton match"
    elif core_a and core_b and nonfinger_jaccard >= 0.95:
        compatibility = "core-compatible; detail/finger mismatch"
    elif core_a and core_b and nonfinger_jaccard >= 0.80:
        compatibility = "retargetable humanoid; review hierarchy/detail"
    elif nonfinger_jaccard >= 0.65:
        compatibility = "partial humanoid compatibility; manual retarget review"
    else:
        compatibility = "low compatibility"

    return {
        "a": a["file"],
        "b": b["file"],
        "compatibility": compatibility,
        "exact_bone_set": exact,
        "shared_bones": len(shared),
        "union_bones": len(union),
        "jaccard": round(jaccard, 4),
        "nonfinger_jaccard": round(nonfinger_jaccard, 4),
        "a_bone_count": a.get("bone_count"),
        "b_bone_count": b.get("bone_count"),
        "a_finger_bones": a.get("finger_bone_count"),
        "b_finger_bones": b.get("finger_bone_count"),
        "missing_from_b": sorted(bones_a - bones_b),
        "missing_from_a": sorted(bones_b - bones_a),
    }


def skeleton_groups(records):
    groups = {}
    for rec in records:
        if rec.get("status") != "ok":
            continue
        key = tuple(rec.get("normalized_bones", []))
        groups.setdefault(key, []).append(rec["file"])

    output = []
    for index, files in enumerate(groups.values(), 1):
        output.append({
            "group": index,
            "files": sorted(files),
            "count": len(files),
        })
    return output


def prepare_animation_export(armature, source_stem):
    if armature.animation_data is None:
        armature.animation_data_create()

    action = armature.animation_data.action
    if action is None and bpy.data.actions:
        action = bpy.data.actions[0]
        armature.animation_data.action = action

    if action is None:
        raise RuntimeError("No animation action found to extract.")

    action.name = source_stem

    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature

    return action


def export_animation_glb(path, armature):
    path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        filepath=str(path),
        export_format="GLB",
        export_animations=True,
        export_skins=False,
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


def extract_animation(path, output_root):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rec = {
        "file": path.name,
        "status": "ok",
        "outputs": {},
    }

    try:
        import_asset(path)
        armature = choose_armature()
        if armature is None:
            raise RuntimeError("No armature found.")

        bones = [bone.name for bone in armature.data.bones]
        rec["rig_family"] = detect_rig_family(bones)
        rec["bone_count"] = len(bones)
        rec["root_bones"] = [bone.name for bone in armature.data.bones if bone.parent is None]
        rec["animation"] = action_info(armature)

        action = prepare_animation_export(armature, path.stem)
        rec["extracted_action_name"] = action.name

        out_dir = output_root / "extracted"
        out_path = out_dir / (path.stem + "_animation.glb")
        export_animation_glb(out_path, armature)
        rec["outputs"]["animation_glb"] = str(
            out_path.resolve().relative_to(output_root.resolve())
        ).replace("\\", "/")

    except Exception as exc:
        rec["status"] = "error"
        rec["error"] = "{}: {}".format(type(exc).__name__, str(exc))
        rec["traceback_tail"] = traceback.format_exc().splitlines()[-14:]

    return rec


def build_markdown(report):
    lines = [
        "# Racing Life Rig Report",
        "",
        "Generated by the local Blender worker.",
        "",
        "- Blender: **{}**".format(report["blender_version"]),
        "- Mode: **{}**".format(report["mode"]),
        "- Files: **{}**".format(report["summary"]["files"]),
        "- Successful: **{}**".format(report["summary"]["ok"]),
        "- Failed: **{}**".format(report["summary"]["errors"]),
        "",
    ]

    if report["mode"] == "extract-animation":
        lines.extend([
            "| File | Rig | Bones | Action count | Extracted GLB | Status |",
            "|---|---|---:|---:|---|---|",
        ])
        for item in report["assets"]:
            lines.append("| {} | {} | {} | {} | {} | {} |".format(
                item.get("file", "-").replace("|", "\\|"),
                item.get("rig_family", "-"),
                item.get("bone_count", "-"),
                item.get("animation", {}).get("count", "-"),
                item.get("outputs", {}).get("animation_glb", "-").replace("|", "\\|"),
                item.get("status", "-"),
            ))
    else:
        lines.extend([
            "| File | Rig | Bones | Core coverage | Finger bones | Validation | Status |",
            "|---|---|---:|---:|---:|---|---|",
        ])
        for item in report["assets"]:
            lines.append("| {} | {} | {} | {} | {} | {} | {} |".format(
                item.get("file", "-").replace("|", "\\|"),
                item.get("rig_family", "-"),
                item.get("bone_count", "-"),
                item.get("core_coverage", "-"),
                item.get("finger_bone_count", "-"),
                item.get("validation", "-"),
                item.get("status", "-"),
            ))

    groups = report.get("skeleton_groups", [])
    if groups:
        lines.extend(["", "## Exact skeleton groups", ""])
        for group in groups:
            lines.append("- Group {}: {}".format(group["group"], ", ".join(group["files"])))

    comparisons = report.get("comparisons", [])
    if comparisons:
        lines.extend([
            "",
            "## Pairwise compatibility",
            "",
            "| A | B | Compatibility | Bone Jaccard | Non-finger Jaccard |",
            "|---|---|---|---:|---:|",
        ])
        for row in comparisons:
            lines.append("| {} | {} | {} | {} | {} |".format(
                row["a"].replace("|", "\\|"),
                row["b"].replace("|", "\\|"),
                row["compatibility"],
                row["jaccard"],
                row["nonfinger_jaccard"],
            ))

    lines.extend([
        "",
        "## Notes",
        "",
        "- Validation checks structural humanoid compatibility, not final animation quality.",
        "- A 33-bone and 65-bone Mixamo-style rig can still be core-compatible when the main body hierarchy matches; finger detail may be lost or require a target-specific mapping.",
        "- Animation extraction exports only the selected armature and animation tracks into a local GLB package. It does not retarget the motion yet.",
        "- Source FBX/GLB/GLTF files are never overwritten or uploaded by this worker.",
        "",
    ])
    return "\n".join(lines)


def publish_reports(repo_root, json_path, md_path):
    if not (repo_root / ".git").exists():
        print("Publish skipped: repository .git directory was not found.")
        return False

    for attempt in range(1, 4):
        temp_base = Path(tempfile.mkdtemp(prefix="racing-life-rig-report-"))
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
                print("Rig report already up to date.")
                return True

            name = run(["git", "config", "user.name"], cwd=repo_root, check=False).stdout.strip()
            email = run(["git", "config", "user.email"], cwd=repo_root, check=False).stdout.strip()
            env = os.environ.copy()
            env["GIT_AUTHOR_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_AUTHOR_EMAIL"] = email or "racing-life-blender@local"
            env["GIT_COMMITTER_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_COMMITTER_EMAIL"] = email or "racing-life-blender@local"

            run(
                ["git", "commit", "-m", "Update Blender rig report"],
                cwd=worktree,
                env=env,
            )
            push = run(
                ["git", "push", "origin", "HEAD:{}".format(BRANCH)],
                cwd=worktree,
                check=False,
            )
            if push.returncode == 0:
                print("Rig report published to {}.".format(BRANCH))
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

    print("Local rig work finished, but GitHub report publication failed.")
    return False


def main():
    args = parse_args()
    input_dir = Path(args.input).resolve()
    output_root = Path(args.output).resolve()
    repo_root = Path(args.repo).resolve()

    if not input_dir.exists():
        raise SystemExit("Input folder does not exist: {}".format(input_dir))

    files = sorted(
        [p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() in (".fbx", ".glb", ".gltf")],
        key=lambda p: p.name.lower(),
    )
    if not files:
        raise SystemExit("No FBX, GLB or GLTF files found in: {}".format(input_dir))

    output_root.mkdir(parents=True, exist_ok=True)

    assets = []
    if args.mode == "extract-animation":
        for index, path in enumerate(files, 1):
            print("[{}/{}] Extracting {}".format(index, len(files), path.name))
            assets.append(extract_animation(path, output_root))
    else:
        for index, path in enumerate(files, 1):
            print("[{}/{}] Validating {}".format(index, len(files), path.name))
            assets.append(skeleton_record(path))

    valid = [item for item in assets if item.get("status") == "ok"]
    comparisons = []
    if args.mode == "compare-skeletons":
        for i in range(len(valid)):
            for j in range(i + 1, len(valid)):
                comparisons.append(compare_pair(valid[i], valid[j]))

    ok = len(valid)
    report = {
        "schema_version": 1,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "blender_version": bpy.app.version_string,
        "mode": args.mode,
        "summary": {
            "files": len(assets),
            "ok": ok,
            "errors": len(assets) - ok,
        },
        "assets": assets,
        "skeleton_groups": skeleton_groups(valid) if args.mode != "extract-animation" else [],
        "comparisons": comparisons,
    }

    json_path = output_root / "rig-report.json"
    md_path = output_root / "rig-report.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path.write_text(build_markdown(report), encoding="utf-8")

    print("")
    print("============================================================")
    print("RACING LIFE RIG WORKER COMPLETE")
    print("============================================================")
    print("Mode:   {}".format(args.mode))
    print("Files:  {}".format(report["summary"]["files"]))
    print("OK:     {}".format(report["summary"]["ok"]))
    print("Errors: {}".format(report["summary"]["errors"]))
    print("Report: {}".format(json_path))
    if args.mode == "extract-animation":
        print("Output: {}".format(output_root / "extracted"))
    print("============================================================")

    if args.publish:
        publish_reports(repo_root, json_path, md_path)

    if report["summary"]["errors"]:
        raise SystemExit(5)


if __name__ == "__main__":
    main()
