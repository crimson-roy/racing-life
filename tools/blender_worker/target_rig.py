import argparse
import datetime as dt
import json
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
PUBLISH_JSON = Path("docs/blender/generated/target-rig-report.json")
PUBLISH_MD = Path("docs/blender/generated/target-rig-report.md")

CORE_BONES = {
    "hips", "spine", "spine1", "spine2", "neck", "head",
    "leftshoulder", "leftarm", "leftforearm", "lefthand",
    "rightshoulder", "rightarm", "rightforearm", "righthand",
    "leftupleg", "leftleg", "leftfoot",
    "rightupleg", "rightleg", "rightfoot",
}


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
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


def is_finger_bone(name):
    n = normalize_bone_name(name)
    return any(token in n for token in ("thumb", "index", "middle", "ring", "pinky", "little"))


def detect_rig_family(names):
    raw = [str(name) for name in names]
    lower = [name.lower() for name in raw]
    if any("mixamorig" in name for name in lower):
        return "mixamo"
    if any(name.startswith("DEF-") or name.startswith("ORG-") for name in raw):
        return "rigify"
    if any(name.lower().startswith("bip") for name in raw):
        return "biped"
    if any(normalize_bone_name(name) in ("root", "pelvis", "spine01") for name in raw):
        return "unreal-style-or-generic"
    return "generic-or-unknown"


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
    raise RuntimeError("Unsupported rig format: {}".format(ext))


def inspect_rig(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rec = {"file": path.name, "status": "ok"}

    try:
        import_asset(path)
        armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
        if not armatures:
            raise RuntimeError("No armature found in asset.")

        arm = max(armatures, key=lambda obj: len(obj.data.bones))
        names = [bone.name for bone in arm.data.bones]
        normalized = sorted(set(normalize_bone_name(name) for name in names))
        normalized_set = set(normalized)
        core_present = sorted(CORE_BONES & normalized_set)
        core_missing = sorted(CORE_BONES - normalized_set)
        fingers = sorted(name for name in normalized if is_finger_bone(name))

        rec.update({
            "armature_object": arm.name,
            "rig_family": detect_rig_family(names),
            "bone_count": len(names),
            "normalized_bones": normalized,
            "root_bones": [bone.name for bone in arm.data.bones if bone.parent is None],
            "core_bones_present": core_present,
            "core_bones_missing": core_missing,
            "core_coverage": round(len(core_present) / len(CORE_BONES), 4),
            "finger_bone_count": len(fingers),
            "finger_bones": fingers,
        })
    except Exception as exc:
        rec["status"] = "error"
        rec["error"] = "{}: {}".format(type(exc).__name__, str(exc))
        rec["traceback_tail"] = traceback.format_exc().splitlines()[-14:]

    return rec


def compare(source, target):
    src = set(source.get("normalized_bones", []))
    dst = set(target.get("normalized_bones", []))
    shared = src & dst
    union = src | dst
    full_similarity = len(shared) / len(union) if union else 0.0

    src_body = {name for name in src if not is_finger_bone(name)}
    dst_body = {name for name in dst if not is_finger_bone(name)}
    body_shared = src_body & dst_body
    body_union = src_body | dst_body
    body_similarity = len(body_shared) / len(body_union) if body_union else 0.0

    src_core = not source.get("core_bones_missing")
    dst_core = not target.get("core_bones_missing")

    if src == dst and src:
        verdict = "direct skeleton match"
    elif src_core and dst_core and body_similarity >= 0.95:
        verdict = "body-compatible; finger/detail mapping only"
    elif src_core and dst_core and body_similarity >= 0.80:
        verdict = "good retarget candidate; explicit mapping required"
    elif body_similarity >= 0.65:
        verdict = "partial humanoid match; manual review required"
    else:
        verdict = "not safe for automatic retargeting"

    return {
        "source": source.get("file"),
        "target": target.get("file"),
        "verdict": verdict,
        "full_bone_similarity": round(full_similarity, 4),
        "body_bone_similarity": round(body_similarity, 4),
        "source_bones": source.get("bone_count"),
        "target_bones": target.get("bone_count"),
        "missing_on_target": sorted(src - dst),
        "target_only": sorted(dst - src),
    }


def build_markdown(report):
    target = report["target"]
    lines = [
        "# Racing Life Target Rig Report",
        "",
        "Generated by the local Blender worker.",
        "",
        "- Blender: **{}**".format(report["blender_version"]),
        "- Target file: **{}**".format(target.get("file", "-")),
        "- Target status: **{}**".format(target.get("status", "-")),
        "- Target rig family: **{}**".format(target.get("rig_family", "-")),
        "- Target bones: **{}**".format(target.get("bone_count", "-")),
        "- Target core coverage: **{}**".format(target.get("core_coverage", "-")),
        "",
        "## Source compatibility",
        "",
        "| Source | Verdict | Full similarity | Body similarity | Source bones | Target bones |",
        "|---|---|---:|---:|---:|---:|",
    ]

    for row in report.get("comparisons", []):
        lines.append("| {} | {} | {} | {} | {} | {} |".format(
            row["source"].replace("|", "\\|"),
            row["verdict"],
            row["full_bone_similarity"],
            row["body_bone_similarity"],
            row["source_bones"],
            row["target_bones"],
        ))

    if target.get("error"):
        lines.extend(["", "## Target error", "", target["error"], ""])

    lines.extend([
        "",
        "## Notes",
        "",
        "- This stage validates retarget compatibility only; it does not transfer animation yet.",
        "- Finger differences are evaluated separately from the main body skeleton.",
        "- A target with no armature cannot receive skeletal animation until a rigged target is supplied.",
        "- Source and target FBX/GLB/GLTF assets are not published by this worker.",
        "",
    ])
    return "\n".join(lines)


def publish_reports(repo_root, json_path, md_path):
    if not (repo_root / ".git").exists():
        return False

    for attempt in range(1, 4):
        temp_base = Path(tempfile.mkdtemp(prefix="racing-life-target-rig-"))
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
                return True

            name = run(["git", "config", "user.name"], cwd=repo_root, check=False).stdout.strip()
            email = run(["git", "config", "user.email"], cwd=repo_root, check=False).stdout.strip()
            env = os.environ.copy()
            env["GIT_AUTHOR_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_AUTHOR_EMAIL"] = email or "racing-life-blender@local"
            env["GIT_COMMITTER_NAME"] = name or "Racing Life Blender Worker"
            env["GIT_COMMITTER_EMAIL"] = email or "racing-life-blender@local"

            run(["git", "commit", "-m", "Update Blender target rig report"], cwd=worktree, env=env)
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
                run(["git", "worktree", "remove", "--force", str(worktree)], cwd=repo_root, check=False)
            shutil.rmtree(temp_base, ignore_errors=True)

    return False


def main():
    args = parse_args()
    source_dir = Path(args.input).resolve()
    target_path = Path(args.target).resolve()
    output_root = Path(args.output).resolve()
    repo_root = Path(args.repo).resolve()

    if not target_path.exists():
        raise SystemExit("Target rig file does not exist: {}".format(target_path))

    sources = sorted(
        [
            p
            for p in source_dir.iterdir()
            if p.is_file() and p.suffix.lower() in (".fbx", ".glb", ".gltf")
        ],
        key=lambda p: p.name.lower(),
    )
    if not sources:
        raise SystemExit("No source FBX, GLB or GLTF files found in: {}".format(source_dir))

    output_root.mkdir(parents=True, exist_ok=True)

    print("Target rig: {}".format(target_path.name))
    target = inspect_rig(target_path)

    source_records = []
    comparisons = []
    for index, path in enumerate(sources, 1):
        print("[{}/{}] {}".format(index, len(sources), path.name))
        source = inspect_rig(path)
        source_records.append(source)
        if source.get("status") == "ok" and target.get("status") == "ok":
            comparisons.append(compare(source, target))

    report = {
        "schema_version": 1,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "blender_version": bpy.app.version_string,
        "target": target,
        "sources": source_records,
        "comparisons": comparisons,
        "summary": {
            "sources": len(source_records),
            "source_errors": sum(1 for item in source_records if item.get("status") != "ok"),
            "target_ok": target.get("status") == "ok",
        },
    }

    json_path = output_root / "target-rig-report.json"
    md_path = output_root / "target-rig-report.md"
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path.write_text(build_markdown(report), encoding="utf-8")

    print("")
    print("============================================================")
    print("TARGET RIG INSPECTION COMPLETE")
    print("============================================================")
    print("Target status: {}".format(target.get("status")))
    print("Sources: {}".format(len(source_records)))
    print("Report: {}".format(json_path))
    print("============================================================")

    if args.publish:
        publish_reports(repo_root, json_path, md_path)

    if target.get("status") != "ok" or report["summary"]["source_errors"]:
        raise SystemExit(6)


if __name__ == "__main__":
    main()
