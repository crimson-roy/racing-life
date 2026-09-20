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

        # Blender metarig names are typically .01/.02/.03 while Mixamo
        # uses 1/2/3 for the corresponding finger joints.
        return "{}hand{}{}".format(side, part, int(digits))

    return n


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


def mesh_world_center(mesh):
    if mesh.type != "MESH" or not mesh.data.vertices:
        return mesh.matrix_world.translation.copy()

    total = Vector((0.0, 0.0, 0.0))
    for vertex in mesh.data.vertices:
        total += mesh.matrix_world @ vertex.co
    return total / len(mesh.data.vertices)


HELPER_GROUP_MAP = {
    "pelvisl": "leftupleg",
    "pelvisr": "rightupleg",
    "heel02l": "leftfoot",
    "heel02r": "rightfoot",
}


def group_to_canonical(group_name):
    canonical = target_canonical_name(group_name)
    return HELPER_GROUP_MAP.get(canonical, canonical)


def nearest_target_bone(mesh, target_arm, target_mapping):
    center = mesh_world_center(mesh)
    best = None
    best_distance = math.inf

    preferred = {
        "hips", "spine", "spine1", "spine2", "neck", "head",
        "leftshoulder", "leftarm", "leftforearm", "lefthand",
        "rightshoulder", "rightarm", "rightforearm", "righthand",
        "leftupleg", "leftleg", "leftfoot",
        "rightupleg", "rightleg", "rightfoot",
    }

    for canonical in sorted(preferred & set(target_mapping)):
        head = bone_world_head(target_arm, target_mapping[canonical])
        tail = bone_world_tail(target_arm, target_mapping[canonical])
        midpoint = (head + tail) * 0.5
        distance = float((center - midpoint).length)

        if distance < best_distance:
            best_distance = distance
            best = canonical

    return best, best_distance


def mapped_rest_transfer_matrices(
    old_target_armature,
    target_mapping,
    source_arm,
    source_mapping,
):
    transfers = {}

    for canonical in sorted(set(target_mapping) & set(source_mapping)):
        target_bone = old_target_armature.data.bones[
            target_mapping[canonical]
        ]
        source_bone = source_arm.data.bones[
            source_mapping[canonical]
        ]

        target_world = (
            old_target_armature.matrix_world
            @ target_bone.matrix_local
        )
        source_world = (
            source_arm.matrix_world
            @ source_bone.matrix_local
        )

        transfers[canonical] = (
            source_world
            @ target_world.inverted()
        )

    return transfers


def bake_mesh_into_mixamo_rest_pose(
    mesh,
    old_target_armature,
    target_mapping,
    source_arm,
    source_mapping,
):
    transfers = mapped_rest_transfer_matrices(
        old_target_armature,
        target_mapping,
        source_arm,
        source_mapping,
    )

    mesh_world = mesh.matrix_world.copy()
    mesh_world_inverse = mesh_world.inverted()

    group_names = {
        group.index: group.name
        for group in mesh.vertex_groups
    }

    moved_vertices = 0
    max_world_move = 0.0
    unmapped_weight_total = 0.0

    new_positions = []

    for vertex in mesh.data.vertices:
        original_world = mesh_world @ vertex.co

        mapped_sum = Vector((0.0, 0.0, 0.0))
        mapped_weight = 0.0
        unmapped_weight = 0.0

        for membership in vertex.groups:
            group_name = group_names.get(membership.group)
            if not group_name:
                continue

            canonical = group_to_canonical(group_name)
            transfer = transfers.get(canonical)

            if transfer is None:
                unmapped_weight += float(membership.weight)
                continue

            weight = float(membership.weight)
            mapped_sum += (transfer @ original_world) * weight
            mapped_weight += weight

        if mapped_weight > 1e-8:
            # Normalize mapped weights. Any genuinely unmapped helper influence
            # is deliberately excluded instead of leaving vertices behind in
            # the old A-pose, which created the long waist/heel spikes.
            new_world = mapped_sum / mapped_weight
            new_local = mesh_world_inverse @ new_world
            move = float((new_world - original_world).length)
            max_world_move = max(max_world_move, move)
            if move > 1e-6:
                moved_vertices += 1
        else:
            new_local = vertex.co.copy()

        unmapped_weight_total += unmapped_weight
        new_positions.append(new_local)

    for vertex, position in zip(mesh.data.vertices, new_positions):
        vertex.co = position

    mesh.data.update()

    return {
        "vertices": len(mesh.data.vertices),
        "vertices_reposed": moved_vertices,
        "max_world_vertex_move": round(max_world_move, 6),
        "unmapped_weight_total": round(unmapped_weight_total, 6),
    }


def remap_vertex_groups(
    mesh,
    source_mapping,
):
    original_names = [group.name for group in mesh.vertex_groups]

    # Capture helper weights before deleting/merging those groups.
    helper_weights = {}
    for helper_raw, destination_canonical in HELPER_GROUP_MAP.items():
        helper_group = None
        for group in mesh.vertex_groups:
            if normalize_bone_name(group.name) == helper_raw:
                helper_group = group
                break

        if helper_group is None:
            continue

        weights = {}
        for vertex in mesh.data.vertices:
            try:
                weight = helper_group.weight(vertex.index)
            except RuntimeError:
                continue
            if weight > 0:
                weights[vertex.index] = float(weight)

        helper_weights[helper_group.name] = (
            destination_canonical,
            weights,
        )

    rename_plan = []
    unmapped_groups = []

    for group_name in original_names:
        canonical = group_to_canonical(group_name)
        source_bone_name = source_mapping.get(canonical)

        if source_bone_name:
            rename_plan.append(
                (group_name, source_bone_name, canonical)
            )
        else:
            unmapped_groups.append(group_name)

    # Rename through temporary names so collisions cannot create .001 groups.
    for index, (old_name, new_name, canonical) in enumerate(rename_plan):
        group = mesh.vertex_groups.get(old_name)
        if group is not None:
            group.name = "__RL_TMP_{}__".format(index)

    final_groups = {}
    mapped_count = 0

    for index, (old_name, new_name, canonical) in enumerate(rename_plan):
        group = mesh.vertex_groups.get("__RL_TMP_{}__".format(index))
        if group is None:
            continue

        existing = final_groups.get(new_name)
        if existing is None:
            group.name = new_name
            final_groups[new_name] = group
            mapped_count += 1
            continue

        # Multiple old helper/deform groups can intentionally collapse into
        # one Mixamo bone. Merge their vertex weights rather than keeping a
        # duplicate group with a .001 suffix.
        for vertex in mesh.data.vertices:
            try:
                weight = group.weight(vertex.index)
            except RuntimeError:
                continue
            if weight > 0:
                existing.add(
                    [vertex.index],
                    weight,
                    "ADD",
                )
        mesh.vertex_groups.remove(group)

    # Remove any still-unmapped helper groups that have no Mixamo equivalent.
    removed_groups = []
    for group_name in list(unmapped_groups):
        group = mesh.vertex_groups.get(group_name)
        if group is not None:
            mesh.vertex_groups.remove(group)
            removed_groups.append(group_name)

    return {
        "mapped_group_count": mapped_count,
        "removed_unmapped_groups": removed_groups,
        "remaining_group_count": len(mesh.vertex_groups),
    }


def normalize_vertex_weights(mesh):
    groups_by_index = {
        group.index: group
        for group in mesh.vertex_groups
    }

    normalized_vertices = 0
    max_pre_normalize_sum = 0.0
    min_pre_normalize_sum = math.inf

    for vertex in mesh.data.vertices:
        memberships = [
            (membership.group, float(membership.weight))
            for membership in vertex.groups
            if membership.group in groups_by_index
            and membership.weight > 0
        ]

        if not memberships:
            continue

        total = sum(weight for _, weight in memberships)
        max_pre_normalize_sum = max(max_pre_normalize_sum, total)
        min_pre_normalize_sum = min(min_pre_normalize_sum, total)

        if total <= 1e-8:
            continue

        if abs(total - 1.0) > 1e-5:
            normalized_vertices += 1

        for group_index, weight in memberships:
            groups_by_index[group_index].add(
                [vertex.index],
                weight / total,
                "REPLACE",
            )

    return {
        "vertices_normalized": normalized_vertices,
        "min_pre_normalize_sum": (
            round(min_pre_normalize_sum, 6)
            if min_pre_normalize_sum is not math.inf
            else None
        ),
        "max_pre_normalize_sum": round(max_pre_normalize_sum, 6),
    }


def rebind_using_existing_weights(
    target_objects,
    old_target_armature,
    source_arm,
    source_mapping,
    target_mapping,
):
    meshes = [obj for obj in target_objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("Target contains no meshes.")

    old_target_armature.data.pose_position = "REST"
    source_arm.data.pose_position = "REST"
    bpy.context.view_layer.update()

    results = []
    weighted_meshes = []
    rigid_meshes = []

    for mesh in meshes:
        record = {
            "mesh": mesh.name,
            "vertices": len(mesh.data.vertices),
            "status": "pending",
            "original_parent": mesh.parent.name if mesh.parent else None,
            "original_parent_type": mesh.parent_type,
            "original_parent_bone": mesh.parent_bone if mesh.parent_type == "BONE" else None,
        }

        world_matrix = mesh.matrix_world.copy()

        for modifier in list(mesh.modifiers):
            if modifier.type == "ARMATURE":
                mesh.modifiers.remove(modifier)

        mesh.parent = None
        mesh.matrix_world = world_matrix

        if len(mesh.vertex_groups) > 0:
            # Repose the geometry from the prototype/metarig bind pose into
            # the aligned Mixamo bind pose BEFORE swapping the armature.
            # This is the missing step that caused elbows/joints to separate:
            # correct old weights were being driven by bones whose rest joints
            # lived in a different pose.
            record["rest_pose_bake"] = bake_mesh_into_mixamo_rest_pose(
                mesh,
                old_target_armature,
                target_mapping,
                source_arm,
                source_mapping,
            )

            record["group_remap"] = remap_vertex_groups(
                mesh,
                source_mapping,
            )

            record["weight_normalization"] = normalize_vertex_weights(
                mesh,
            )

            modifier = mesh.modifiers.new(
                name="RacingLifeMixamoArmature",
                type="ARMATURE",
            )
            modifier.object = source_arm

            weighted_meshes.append(mesh)
            record["status"] = "rest-pose-baked-and-remapped"
            record["method"] = (
                "prototype-weights-plus-rest-pose-geometry-transfer"
            )
            record["vertex_groups"] = len(mesh.vertex_groups)

        else:
            canonical, distance = nearest_target_bone(
                mesh,
                old_target_armature,
                target_mapping,
            )

            if canonical and canonical in source_mapping:
                source_bone = source_mapping[canonical]
                mesh.parent = source_arm
                mesh.parent_type = "BONE"
                mesh.parent_bone = source_bone
                mesh.matrix_world = world_matrix

                rigid_meshes.append(mesh)
                record["status"] = "rigid-bone-parent"
                record["method"] = "nearest-body-bone"
                record["canonical_bone"] = canonical
                record["source_bone"] = source_bone
                record["distance"] = round(distance, 6)
            else:
                record["status"] = "unbound"
                record["method"] = None

        results.append(record)

    if not weighted_meshes:
        raise RuntimeError(
            "No prototype mesh had reusable skin weights for the Mixamo rig."
        )

    return {
        "mesh_count": len(meshes),
        "weighted_mesh_count": len(weighted_meshes),
        "rigid_mesh_count": len(rigid_meshes),
        "unbound_count": sum(
            1 for item in results if item["status"] == "unbound"
        ),
        "meshes": [mesh.name for mesh in meshes],
        "results": results,
    }, meshes


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
            "- Weighted meshes remapped: {}".format(report["binding"]["weighted_mesh_count"]),
            "- Rigid helper meshes attached: {}".format(report["binding"]["rigid_mesh_count"]),
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
        "strategy": "bake-prototype-bind-pose-to-mixamo-rest-and-reuse-skin-weights",
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

        report["binding"], meshes = rebind_using_existing_weights(
            target_objects,
            old_target_arm,
            source_arm,
            source_mapping,
            target_mapping,
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
