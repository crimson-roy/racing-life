import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Crimson extends THREE.Group {
  constructor(options = {}) {
    super();

    this.name = 'Crimson';
    this.H = options.height ?? 1.8;

    this.loader = new GLTFLoader();

    this.model = null;
    this.mixer = null;
    this.ready = false;

    this.walkTime = 0;
    this.walking = false;

    this.bones = {};
    this.bindQuaternions = {};

    this.loadModel(
      options.path ?? '/assets/characters/Crimson.glb'
    );
  }

  // ============================================================
  // LOAD MODEL
  // ============================================================

  loadModel(path) {
    this.loader.load(
      path,

      (gltf) => {
        const model = gltf.scene;

        model.name = 'CrimsonModel';

        model.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });

        // --------------------------------------------------------
        // Normalize height
        // --------------------------------------------------------

        const initialBox =
          new THREE.Box3().setFromObject(model);

        const initialSize =
          new THREE.Vector3();

        initialBox.getSize(initialSize);

        if (initialSize.y > 0) {
          const scale =
            this.H / initialSize.y;

          model.scale.multiplyScalar(scale);
        }

        // --------------------------------------------------------
        // Ground model at Y = 0
        // --------------------------------------------------------

        const finalBox =
          new THREE.Box3().setFromObject(model);

        model.position.y -= finalBox.min.y;

        this.model = model;

        this.add(model);

        // --------------------------------------------------------
        // Find skinned mesh
        // --------------------------------------------------------

        const skinnedMeshes = [];

        model.traverse((object) => {
          if (object.isSkinnedMesh) {
            skinnedMeshes.push(object);
          }
        });

        const skinnedMesh =
          skinnedMeshes[0];

        if (
          !skinnedMesh ||
          !skinnedMesh.skeleton
        ) {
          console.error(
            'Crimson: no skinned mesh/skeleton found.'
          );
          return;
        }

        const skeleton =
          skinnedMesh.skeleton;

        console.log(
          'CRIMSON SKELETON BONES:',
          skeleton.bones.map(
            (bone) => bone.name
          )
        );

        // --------------------------------------------------------
        // Bone lookup
        // --------------------------------------------------------

        const getBone = (name) => {
          const bone =
            skeleton.bones.find(
              (b) => b.name === name
            );

          if (!bone) {
            console.warn(
              `Crimson: bone "${name}" not found.`
            );
          }

          return bone;
        };

        this.bones = {
          root: getBone('spine'),

          spine: getBone('spine001'),
          spine2: getBone('spine002'),
          spine3: getBone('spine003'),

          leftShoulder:
            getBone('shoulderL'),

          rightShoulder:
            getBone('shoulderR'),

          leftUpperArm:
            getBone('upper_armL'),

          rightUpperArm:
            getBone('upper_armR'),

          leftForearm:
            getBone('forearmL'),

          rightForearm:
            getBone('forearmR'),

          leftHand:
            getBone('handL'),

          rightHand:
            getBone('handR'),

          leftThigh:
            getBone('thighL'),

          rightThigh:
            getBone('thighR'),

          leftShin:
            getBone('shinL'),

          rightShin:
            getBone('shinR'),

          leftFoot:
            getBone('footL'),

          rightFoot:
            getBone('footR'),

          leftToe:
            getBone('toeL'),

          rightToe:
            getBone('toeR')
        };

        // --------------------------------------------------------
        // Capture Blender rest pose
        // --------------------------------------------------------

        this.bindQuaternions = {};

        for (
          const [name, bone]
          of Object.entries(this.bones)
        ) {
          if (bone) {
            this.bindQuaternions[name] =
              bone.quaternion.clone();
          }
        }

        // --------------------------------------------------------
        // Validate
        // --------------------------------------------------------

        const missingBones =
          Object.entries(this.bones)
            .filter(
              ([, bone]) => !bone
            )
            .map(
              ([name]) => name
            );

        if (
          missingBones.length > 0
        ) {
          console.warn(
            'Crimson: missing bones:',
            missingBones
          );
        }

        // --------------------------------------------------------
        // GLB animations
        // --------------------------------------------------------

        if (
          gltf.animations &&
          gltf.animations.length > 0
        ) {
          this.mixer =
            new THREE.AnimationMixer(
              model
            );

          console.log(
            'Crimson GLB animations:',
            gltf.animations.map(
              (clip) => clip.name
            )
          );
        }

        this.ready = true;

        console.log(
          'Crimson GLB loaded successfully.'
        );
      },

      undefined,

      (error) => {
        console.error(
          'Failed to load Crimson.glb:',
          error
        );
      }
    );
  }

  // ============================================================
  // APPLY REST POSE
  // ============================================================

  restoreBone(
    name,
    bone,
    alpha = 0.12
  ) {
    const bind =
      this.bindQuaternions[name];

    if (!bind || !bone) {
      return;
    }

    bone.quaternion.slerp(
      bind,
      alpha
    );
  }

  // ============================================================
  // APPLY ROTATION OFFSET
  // ============================================================

  applyRotationOffset(
    name,
    bone,
    angle
  ) {
    const bind =
      this.bindQuaternions[name];

    if (!bind || !bone) {
      return;
    }

    const offset =
      new THREE.Quaternion();

    offset.setFromAxisAngle(
      new THREE.Vector3(
        1,
        0,
        0
      ),
      angle
    );

    bone.quaternion
      .copy(bind)
      .multiply(offset);
  }

  // ============================================================
  // WALK ANIMATION
  // ============================================================

  updateAnimation(
    dt,
    movementAmount = 0
  ) {
    if (!this.ready) {
      return;
    }

    if (this.mixer) {
      this.mixer.update(dt);
    }

    const amount =
      THREE.MathUtils.clamp(
        Math.abs(movementAmount),
        0,
        1
      );

    this.walking =
      amount > 0.01;

    const {
      leftThigh,
      rightThigh,
      leftShin,
      rightShin,
      leftUpperArm,
      rightUpperArm
    } = this.bones;

    // ----------------------------------------------------------
    // IDLE
    // ----------------------------------------------------------

    if (!this.walking) {
      this.walkTime = 0;

      this.restoreBone(
        'leftThigh',
        leftThigh
      );

      this.restoreBone(
        'rightThigh',
        rightThigh
      );

      this.restoreBone(
        'leftShin',
        leftShin
      );

      this.restoreBone(
        'rightShin',
        rightShin
      );

      this.restoreBone(
        'leftUpperArm',
        leftUpperArm
      );

      this.restoreBone(
        'rightUpperArm',
        rightUpperArm
      );

      return;
    }

    // ----------------------------------------------------------
    // WALK
    // ----------------------------------------------------------

    this.walkTime +=
      dt *
      (4 + amount * 5);

    const swing =
      Math.sin(
        this.walkTime
      ) *
      amount *
      0.30;

    const opposite =
      -swing;

    // Legs
    this.applyRotationOffset(
      'leftThigh',
      leftThigh,
      swing
    );

    this.applyRotationOffset(
      'rightThigh',
      rightThigh,
      opposite
    );

    // Knees
    this.applyRotationOffset(
      'leftShin',
      leftShin,
      Math.max(
        0,
        -swing
      ) * 0.20
    );

    this.applyRotationOffset(
      'rightShin',
      rightShin,
      Math.max(
        0,
        swing
      ) * 0.20
    );

    // Arms
    this.applyRotationOffset(
      'leftUpperArm',
      leftUpperArm,
      opposite * 0.40
    );

    this.applyRotationOffset(
      'rightUpperArm',
      rightUpperArm,
      swing * 0.40
    );
  }

  // ============================================================
  // LOOK
  // ============================================================

  setLookRotation(
    yaw,
    pitch = 0
  ) {
    if (!this.ready) {
      return;
    }

    const spine3 =
      this.bones.spine3;

    const bind =
      this.bindQuaternions.spine3;

    if (!spine3 || !bind) {
      return;
    }

    const yawOffset =
      new THREE.Quaternion();

    const pitchOffset =
      new THREE.Quaternion();

    yawOffset.setFromAxisAngle(
      new THREE.Vector3(
        0,
        1,
        0
      ),
      yaw
    );

    pitchOffset.setFromAxisAngle(
      new THREE.Vector3(
        1,
        0,
        0
      ),
      pitch
    );

    spine3.quaternion
      .copy(bind)
      .multiply(yawOffset)
      .multiply(pitchOffset);
  }

  // ============================================================
  // READY CHECK
  // ============================================================

  isReady() {
    return this.ready;
  }
}