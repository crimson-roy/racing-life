import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { MixamoPlayer } from '../characters/MixamoPlayer.js';
import { WesternBagger } from '../vehicles/WesternBagger.js';

class OrientedBoxCollider {
  constructor(
    x,
    z,
    rotationY,
    halfWidth,
    halfDepth
  ) {
    this.x = x;
    this.z = z;
    this.rotationY = rotationY;
    this.halfWidth = halfWidth;
    this.halfDepth = halfDepth;

    this.cos = Math.cos(
      -rotationY
    );

    this.sin = Math.sin(
      -rotationY
    );
  }

  overlapsCircle(
    px,
    pz,
    radius
  ) {
    const dx =
      px - this.x;

    const dz =
      pz - this.z;

    const localX =
      dx * this.cos -
      dz * this.sin;

    const localZ =
      dx * this.sin +
      dz * this.cos;

    const clampedX =
      THREE.MathUtils.clamp(
        localX,
        -this.halfWidth,
        this.halfWidth
      );

    const clampedZ =
      THREE.MathUtils.clamp(
        localZ,
        -this.halfDepth,
        this.halfDepth
      );

    const distX =
      localX -
      clampedX;

    const distZ =
      localZ -
      clampedZ;

    return (
      distX * distX +
      distZ * distZ
    ) <
    radius * radius;
  }
}

export class FreeRoamScene {
  constructor(
    options = {}
  ) {
    this.container =
      options.container ??
      document.body;

    this.onExit =
      options.onExit ??
      (() => {});

    this.running =
      false;

    this.disposed =
      false;

    this.rafId =
      null;

    // ========================================================
    // SCENE
    // ========================================================

    this.scene =
      new THREE.Scene();

    this.scene.background =
      new THREE.Color(
        0x88b8d1
      );

    this.scene.fog =
      new THREE.Fog(
        0x88b8d1,
        450,
        2200
      );

    // ========================================================
    // CAMERA
    // ========================================================

    this.camera =
      new THREE.PerspectiveCamera(
        58,

        Math.max(
          1,
          window.innerWidth
        ) /
        Math.max(
          1,
          window.innerHeight
        ),

        0.1,
        3000
      );

    // ========================================================
    // RENDERER
    // ========================================================

    this.renderer =
      new THREE.WebGLRenderer({
        antialias: true
      });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio ||
          1,
        2
      )
    );

    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    this.renderer.shadowMap.enabled =
      true;

    this.renderer.shadowMap.type =
      THREE.PCFShadowMap;

    Object.assign(
      this.renderer
        .domElement
        .style,

      {
        position:
          'fixed',

        inset:
          '0',

        zIndex:
          '1',

        pointerEvents:
          'auto',

        touchAction:
          'none'
      }
    );

    this.container.appendChild(
      this.renderer.domElement
    );

    // ========================================================
    // CAMERA CONTROLS
    // ========================================================

    this.controls =
      new OrbitControls(
        this.camera,
        this.renderer.domElement
      );

    this.controls.enableDamping =
      true;

    this.controls.dampingFactor =
      0.08;

    this.controls.enablePan =
      false;

    this.controls.minDistance =
      2.4;

    this.controls.maxDistance =
      10;

    this.controls.minPolarAngle =
      THREE.MathUtils.degToRad(
        5
      );

    this.controls.maxPolarAngle =
      THREE.MathUtils.degToRad(
        84
      );

    // ========================================================
    // CLOCK
    // ========================================================

    this.clock =
      new THREE.Clock();

    // ========================================================
    // WORLD
    // ========================================================

    this.gltfLoader =
      new GLTFLoader();

    this.worldRoot =
      new THREE.Group();

    this.worldRoot.name =
      'WorldRoot';

    this.scene.add(
      this.worldRoot
    );

    this.streetCity =
      null;

    this.streetCityReady =
      false;

    this.CITY_SCALE =
      1;

    this.WORLD_LIMIT =
      2300;

    // ========================================================
    // SPAWN POSITIONS
    // ========================================================

    this.PLAYER_SPAWN =
      new THREE.Vector3(
        -6.4,
        0.08,
        0.45
      );

    this.BAGGER_SPAWN =
      new THREE.Vector3(
        -9.4,
        0.08,
        15.45
      );

    this.SUBARU_SPAWN =
      new THREE.Vector3(
        2.5,
        0.08,
        -10
      );

    this.SUBARU_ROTATION_Y =
      0;

    // ========================================================
    // PLAYER
    // ========================================================

    this.player =
      null;

    this.PLAYER_RADIUS =
      0.38;

    this.WALK_SPEED =
      1.8;

    this.TURN_SPEED =
      THREE.MathUtils
        .degToRad(
          115
        );

    this.lastPlayerPosition =
      new THREE.Vector3();

    // ========================================================
    // INPUT
    // ========================================================

    this.keys = {
      KeyW:
        false,

      KeyS:
        false,

      KeyA:
        false,

      KeyD:
        false
    };

    // ========================================================
    // GROUNDING
    // ========================================================

    this.groundRaycaster =
      new THREE.Raycaster();

    this.groundOrigin =
      new THREE.Vector3();

    this.groundDirection =
      new THREE.Vector3(
        0,
        -1,
        0
      );

    this.groundObjects =
      [];

    this.GROUND_RAY_HEIGHT =
      5;

    this.GROUND_RAY_DISTANCE =
      10;

    // ========================================================
    // CAMERA COLLISION
    // ========================================================

    this.cameraCollisionRaycaster =
      new THREE.Raycaster();

    this.cameraCollisionDirection =
      new THREE.Vector3();

    this.cameraDesiredPosition =
      new THREE.Vector3();

    this.cameraCollisionObjects =
      [];

    // ========================================================
    // PLAYER COLLISION
    // ========================================================

    this.boxColliders =
      [];

    this.orientedBoxColliders =
      [];

    this.circleColliders =
      [];

    // ========================================================
    // VEHICLES
    // ========================================================

    this.bagger =
      null;

    this.subaruRoot =
      null;

    this.subaruModel =
      null;

    this.subaruVisualOrientation =
      null;

    this.subaruReady =
      false;

    this.subaruCollider =
      null;

    this.subaruColliderCenterLocal =
      new THREE.Vector3();

    this.subaruLocalFrontDirection =
      new THREE.Vector3(
        0,
        0,
        1
      );

    this.subaruWheelObjects =
      [];

    // ========================================================
    // SUBARU INTERACTION POINTS
    // ========================================================

    this.subaruBonnetInteractPoint =
      null;

    this.subaruBonnetSitPoint =
      null;

    this.subaruBonnetStandPoint =
      null;

    this.subaruDriverEntryPoint =
      null;

    this.subaruDriverExitPoint =
      null;

    this.subaruDriverSeatPoint =
      null;

    this.subaruDriverDoorObject =
      null;

    this.subaruDriverSeatObject =
      null;

    this.subaruSteeringWheelObject =
      null;

    // ========================================================
    // VEHICLE STATE / DRIVING
    // ========================================================

    this.vehicleState =
      'on-foot';

    this.VEHICLE_INTERACTION_RADIUS =
      2.25;

    this.subaruSpeed =
      0;

    this.SUBARU_MAX_SPEED =
      18;

    this.SUBARU_MAX_REVERSE_SPEED =
      6;

    this.SUBARU_ACCELERATION =
      8.5;

    this.SUBARU_BRAKE_POWER =
      14;

    this.SUBARU_DRAG =
      3.1;

    this.SUBARU_STEER_RATE =
      THREE.MathUtils.degToRad(
        72
      );

    this.DRIVER_SEAT_Y_OFFSET =
  0.05;

// ========================================================
// ENTER CAR ANIMATION ALIGNMENT
// ========================================================

// Mixamo Entering Car animation is rotated sideways
// relative to our normal character forward direction.
this.ENTER_CAR_YAW_OFFSET =
  -Math.PI / 2;

  // Extra distance outward AFTER F is pressed.
// Does not affect where the F prompt appears.
this.ENTER_CAR_START_EXTRA_DISTANCE =
  0.65;

// Only lowers Entering Car.glb.
// Does NOT affect Driving.glb.
this.ENTER_CAR_Y_OFFSET =
  0.02;

this.ENTER_CAR_HANDLE_OFFSET =
  -0.25;

this.subaruDriverDoorPivot =
  null;

this.SUBARU_DRIVER_DOOR_OPEN_ANGLE =
  THREE.MathUtils.degToRad(
    -68
  );

this.subaruDriverDoorAnimating =
  false;

    this.vehicleFollowPosition =
      new THREE.Vector3();

    this.vehicleTempDirection =
      new THREE.Vector3();

    this.vehicleTempQuaternion =
      new THREE.Quaternion();

    // ========================================================
    // BONNET INTERACTION
    // ========================================================

    this.BONNET_INTERACTION_RADIUS =
      2.3;

    this.BONNET_SIT_Y_OFFSET =
      0.22;

    this.currentInteraction =
      null;

    this.bonnetSitting =
      false;

    this.interactionBusy =
      false;

    this.tempWorldPoint =
      new THREE.Vector3();

    this.tempWorldPoint2 =
      new THREE.Vector3();

    this.bonnetSitEmote = {
      id:
        'bonnet-sitting',

      label:
        'Sit On Bonnet',

      file:
        'Sitting.glb'
    };

    this.enterCarEmote = {
  id: 'enter-car',
  label: 'Enter Car',
  file: 'Entering Car.glb',

  // We control the character's movement ourselves.
  // Do not let Mixamo root translation launch him.
  lockRootPosition: true
};

this.drivingEmote = {
  id: 'driving',
  label: 'Driving',
  file: 'Driving.glb',
  inPlace: true
};

this.exitCarEmote = {
  id: 'exit-car',
  label: 'Exit Car',
  file: 'Exiting Car.glb',
  inPlace: true
};

this.hornEmote = {
  id: 'horn',
  label: 'Honking Horn',
  file: 'Honking Horn.glb',
  inPlace: true
};

    // ========================================================
    // UI
    // ========================================================

    this.ui =
      null;

    this.styleEl =
      null;

    this.statusEl =
      null;

    this.interactionPromptEl =
      null;

    this.interactionKeyEl =
      null;

    this.interactionTitleEl =
      null;

    this.interactionDetailEl =
      null;

    // ========================================================
    // BUILD
    // ========================================================

    this.buildLighting();

    this.buildGround();

    this.loadStreetCity();

    this.buildBagger();

    this.loadSubaru();

    this.buildPlayer();

    this.setupInitialCamera();

    this.buildUI();

    this.bindEvents();

    // ========================================================
    // RESIZE
    // ========================================================

    this.resizeHandler =
      () => {
        this.resize();
      };

    window.addEventListener(
      'resize',
      this.resizeHandler
    );

    this.start();
  }

  // ============================================================
  // LIGHTING
  // ============================================================

  buildLighting() {
    const hemi =
      new THREE.HemisphereLight(
        0xffffff,
        0x46604b,
        2
      );

    this.scene.add(
      hemi
    );

    const sun =
      new THREE.DirectionalLight(
        0xfff4df,
        2.8
      );

    sun.position.set(
      35,
      55,
      30
    );

    sun.castShadow =
      true;

    sun.shadow.mapSize.width =
      2048;

    sun.shadow.mapSize.height =
      2048;

    sun.shadow.camera.left =
      -110;

    sun.shadow.camera.right =
      110;

    sun.shadow.camera.top =
      110;

    sun.shadow.camera.bottom =
      -110;

    sun.shadow.bias =
      -0.0003;

    this.scene.add(
      sun
    );

    const fill =
      new THREE.DirectionalLight(
        0xffc7a3,
        0.42
      );

    fill.position.set(
      -30,
      18,
      -30
    );

    this.scene.add(
      fill
    );
  }

  // ============================================================
  // GROUND
  // ============================================================

  buildGround() {
    const visibleGround =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          5000,
          5000
        ),

        new THREE.MeshStandardMaterial({
          color:
            0x34383b,

          roughness:
            0.98,

          metalness:
            0
        })
      );

    visibleGround.name =
      'WorldVisibleFallbackGround';

    visibleGround.rotation.x =
      -Math.PI / 2;

    visibleGround.position.y =
      -0.2;

    visibleGround.receiveShadow =
      true;

    this.scene.add(
      visibleGround
    );

    this.backupGround =
      visibleGround;

    const walkGround =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          5000,
          5000
        ),

        new THREE.MeshBasicMaterial({
          transparent:
            true,

          opacity:
            0,

          depthWrite:
            false
        })
      );

    walkGround.name =
      'TemporaryWalkGround';

    walkGround.rotation.x =
      -Math.PI / 2;

    walkGround.position.y =
      0.08;

    this.scene.add(
      walkGround
    );

    this.walkGround =
      walkGround;

    this.groundObjects.push(
      walkGround
    );
  }

  // ============================================================
  // LOAD CITY
  // ============================================================

  loadStreetCity() {
    const url =
      '/assets/world/test_maps/big_city_2.glb';

    this.gltfLoader.load(
      url,

      (gltf) => {
        if (
          this.disposed
        ) {
          this.disposeObject3D(
            gltf.scene
          );

          return;
        }

        const model =
          gltf.scene;

        model.name =
          'StreetCity';

        model.position.set(
          0,
          1.41,
          0
        );

        model.rotation.set(
          0,
          0,
          0
        );

        model.scale.setScalar(
          this.CITY_SCALE
        );

        model.traverse(
          (object) => {
            if (
              !object.isMesh
            ) {
              return;
            }

            const materials =
              Array.isArray(
                object.material
              )
                ?
                object.material
                :
                [
                  object.material
                ];

            const transparent =
              materials.some(
                (
                  material
                ) =>
                  material &&
                  material.transparent &&
                  material.opacity <
                    0.95
              );

            object.castShadow =
              !transparent;

            object.receiveShadow =
              true;
          }
        );

        this.worldRoot.add(
          model
        );

        this.streetCity =
          model;

        this.streetCityReady =
          true;

        console.log(
          'Racing Life: Big City 2 loaded.'
        );

        this.refreshStatus();
      },

      undefined,

      (error) => {
        console.error(
          'Racing Life: city load failed.',
          error
        );

        this.refreshStatus(
          'City failed to load — check console'
        );
      }
    );
  }

  // ============================================================
  // OLD BAGGER
  // ============================================================

  buildBagger() {
    const rotationY =
      Math.PI *
      0.06;

    this.bagger =
      new WesternBagger();

    this.bagger.position.copy(
      this.BAGGER_SPAWN
    );

    this.bagger.rotation.y =
      rotationY;

    this.scene.add(
      this.bagger
    );

    this.orientedBoxColliders.push(
      new OrientedBoxCollider(
        this.BAGGER_SPAWN.x,
        this.BAGGER_SPAWN.z,
        rotationY,
        0.55,
        1.15
      )
    );

    this.cameraCollisionObjects.push(
      this.bagger
    );
  }

  // ============================================================
  // LOAD SUBARU WRX
  // ============================================================

  loadSubaru() {
    const url =
      '/assets/world/vehicles/subaru_wrx.glb';

    const carRoot =
      new THREE.Group();

    carRoot.name =
      'SubaruWRXRoot';

    carRoot.position.copy(
      this.SUBARU_SPAWN
    );

    carRoot.rotation.y =
      this.SUBARU_ROTATION_Y;

    this.scene.add(
      carRoot
    );

    this.subaruRoot =
      carRoot;

    // ==========================================================
    // INTERACTION ANCHORS
    // ==========================================================

    this.subaruBonnetInteractPoint =
      new THREE.Object3D();

    this.subaruBonnetInteractPoint.name =
      'BonnetInteractPoint';

    carRoot.add(
      this.subaruBonnetInteractPoint
    );

    this.subaruBonnetSitPoint =
      new THREE.Object3D();

    this.subaruBonnetSitPoint.name =
      'BonnetSitPoint';

    carRoot.add(
      this.subaruBonnetSitPoint
    );

    this.subaruBonnetStandPoint =
      new THREE.Object3D();

    this.subaruBonnetStandPoint.name =
      'BonnetStandPoint';

    carRoot.add(
      this.subaruBonnetStandPoint
    );

    this.subaruDriverEntryPoint =
      new THREE.Object3D();

    this.subaruDriverEntryPoint.name =
      'DriverEntryPoint';

    carRoot.add(
      this.subaruDriverEntryPoint
    );

    this.subaruDriverExitPoint =
      new THREE.Object3D();

    this.subaruDriverExitPoint.name =
      'DriverExitPoint';

    carRoot.add(
      this.subaruDriverExitPoint
    );

    this.subaruDriverSeatPoint =
      new THREE.Object3D();

    this.subaruDriverSeatPoint.name =
      'DriverSeatPoint';

    carRoot.add(
      this.subaruDriverSeatPoint
    );

    // ==========================================================
    // LOAD GLB
    // ==========================================================

    this.gltfLoader.load(
      url,

      (gltf) => {
        if (
          this.disposed
        ) {
          this.disposeObject3D(
            gltf.scene
          );

          return;
        }

        const model =
          gltf.scene;

        model.name =
          'SubaruWRXModel';

        model.traverse(
          (object) => {
            if (
              object.isMesh
            ) {
              object.castShadow =
                true;

              object.receiveShadow =
                true;
            }
          }
        );

        // ========================================================
        // ORIENTATION WRAPPER
        // ========================================================

        const orientation =
          new THREE.Group();

        orientation.name =
          'SubaruVisualOrientation';

        orientation.add(
          model
        );

        carRoot.add(
          orientation
        );

        // ========================================================
        // FIND WHEELS
        // ========================================================

        const wheelObjects =
          [];

        const frontWheels =
          [];

        const rearWheels =
          [];

        model.traverse(
          (object) => {
            const name =
              String(
                object.name ||
                ''
              );

            if (
              /Wheel1A_|Wheel Front|Wheel Rear/i.test(
                name
              )
            ) {
              wheelObjects.push(
                object
              );
            }

            if (
              /Wheel1A_LF|Wheel1A_RF|Wheel Front/i.test(
                name
              )
            ) {
              frontWheels.push(
                object
              );
            }

            if (
              /Wheel1A_LR|Wheel1A_RR|Wheel Rear/i.test(
                name
              )
            ) {
              rearWheels.push(
                object
              );
            }
          }
        );

        this.subaruWheelObjects =
          wheelObjects;

        // ========================================================
        // TEST POSSIBLE ORIENTATIONS
        // ========================================================

        const candidates = [
          {
            x: 0,
            z: 0
          },

          {
            x:
              Math.PI / 2,

            z:
              0
          },

          {
            x:
              -Math.PI / 2,

            z:
              0
          },

          {
            x:
              Math.PI,

            z:
              0
          },

          {
            x:
              0,

            z:
              Math.PI / 2
          },

          {
            x:
              0,

            z:
              -Math.PI / 2
          }
        ];

        let bestCandidate =
          null;

        let bestScore =
          Infinity;

        const testSize =
          new THREE.Vector3();

        const tempWheelPosition =
          new THREE.Vector3();

        for (
          const candidate
          of candidates
        ) {
          orientation.rotation.set(
            candidate.x,
            0,
            candidate.z
          );

          orientation.position.set(
            0,
            0,
            0
          );

          carRoot.updateMatrixWorld(
            true
          );

          const box =
            new THREE.Box3()
              .setFromObject(
                model
              );

          box.getSize(
            testSize
          );

          let score =
            testSize.y *
            10;

          if (
            wheelObjects.length >
              0 &&
            testSize.y >
              0.001
          ) {
            let wheelYTotal =
              0;

            for (
              const wheel
              of wheelObjects
            ) {
              wheel.getWorldPosition(
                tempWheelPosition
              );

              wheelYTotal +=
                tempWheelPosition.y;
            }

            const averageWheelY =
              wheelYTotal /
              wheelObjects.length;

            const normalizedWheelHeight =
              (
                averageWheelY -
                box.min.y
              ) /
              testSize.y;

            score +=
              normalizedWheelHeight;
          }

          if (
            score <
            bestScore
          ) {
            bestScore =
              score;

            bestCandidate = {
              x:
                candidate.x,

              z:
                candidate.z
            };
          }
        }

        // ========================================================
        // APPLY BEST ORIENTATION
        // ========================================================

        orientation.rotation.set(
          bestCandidate?.x ??
            0,

          0,

          bestCandidate?.z ??
            0
        );

        orientation.position.set(
          0,
          0,
          0
        );

        carRoot.updateMatrixWorld(
          true
        );

        // ========================================================
        // RECENTER + GROUND + ROAD OFFSET
        // ========================================================

        let tempBox =
          new THREE.Box3()
            .setFromObject(
              model
            );

        const tempCenter =
          new THREE.Vector3();

        tempBox.getCenter(
          tempCenter
        );

        const centerLocal =
          carRoot.worldToLocal(
            tempCenter.clone()
          );

        orientation.position.x -=
          centerLocal.x;

        orientation.position.z -=
          centerLocal.z;

        carRoot.updateMatrixWorld(
          true
        );

        tempBox =
          new THREE.Box3()
            .setFromObject(
              model
            );

        const roadY =
          this.SUBARU_SPAWN.y;

        const groundClearance =
          0.015;

        orientation.position.y +=
          roadY -
          tempBox.min.y +
          groundClearance;

        carRoot.updateMatrixWorld(
          true
        );

        const ROAD_INSET =
          -7.35;

        const carRight =
          new THREE.Vector3(
            1,
            0,
            0
          )
            .applyQuaternion(
              carRoot.quaternion
            );

        carRoot.position.addScaledVector(
          carRight,
          ROAD_INSET
        );

        carRoot.updateMatrixWorld(
          true
        );

        // ========================================================
        // FINAL BOUNDS
        // ========================================================

        const finalBox =
          new THREE.Box3()
            .setFromObject(
              model
            );

        const finalSize =
          new THREE.Vector3();

        const finalCenter =
          new THREE.Vector3();

        finalBox.getSize(
          finalSize
        );

        finalBox.getCenter(
          finalCenter
        );

        // ========================================================
        // DETERMINE REAL FRONT USING HOOD + TRUNK
        // ========================================================

        const frontDirection =
          new THREE.Vector3(
            0,
            0,
            1
          );

        let hoodAnchor =
          null;

        let trunkAnchor =
          null;

        model.traverse(
          (object) => {
            const name =
              String(
                object.name ||
                ''
              );

            if (
              !hoodAnchor &&
              name.startsWith(
                'Animate_Hood_'
              ) &&
              !name.includes(
                'Piston'
              ) &&
              !name.includes(
                'Rod'
              )
            ) {
              hoodAnchor =
                object;
            }

            if (
              !trunkAnchor &&
              name.startsWith(
                'Animate_Trunk_'
              )
            ) {
              trunkAnchor =
                object;
            }
          }
        );

        if (
          hoodAnchor &&
          trunkAnchor
        ) {
          const hoodWorld =
            new THREE.Vector3();

          const trunkWorld =
            new THREE.Vector3();

          hoodAnchor.getWorldPosition(
            hoodWorld
          );

          trunkAnchor.getWorldPosition(
            trunkWorld
          );

          frontDirection
            .subVectors(
              hoodWorld,
              trunkWorld
            );

          frontDirection.y =
            0;

          if (
            frontDirection.lengthSq() >
            0.001
          ) {
            frontDirection.normalize();
          } else {
            frontDirection.set(
              0,
              0,
              1
            );
          }
        } else {
          frontDirection.set(
            0,
            0,
            1
          );

          frontDirection
            .applyQuaternion(
              carRoot.quaternion
            );

          frontDirection.y =
            0;

          frontDirection.normalize();
        }

        console.log(
          'SUBARU FRONT DEBUG:',
          {
            hoodFound:
              Boolean(
                hoodAnchor
              ),

            trunkFound:
              Boolean(
                trunkAnchor
              ),

            direction: {
              x:
                frontDirection.x
                  .toFixed(
                    3
                  ),

              z:
                frontDirection.z
                  .toFixed(
                    3
                  )
            }
          }
        );

        // ========================================================
        // BONNET INTERACTION POSITIONS
        // ========================================================

        const halfLength =
          Math.max(
            finalSize.x,
            finalSize.z
          ) /
          2;

        const interactWorld =
          finalCenter.clone()
            .addScaledVector(
              frontDirection,
              halfLength +
                0.9
            );

        interactWorld.y =
          roadY;

        const sitWorld =
          finalCenter.clone()
            .addScaledVector(
              frontDirection,
              halfLength -
                0.30
            );

        sitWorld.y =
          roadY;

        const standWorld =
          finalCenter.clone()
            .addScaledVector(
              frontDirection,
              halfLength +
                0.75
            );

        standWorld.y =
          roadY;

        carRoot.updateMatrixWorld(
          true
        );

        this.subaruBonnetInteractPoint
          .position
          .copy(
            carRoot.worldToLocal(
              interactWorld.clone()
            )
          );

        this.subaruBonnetSitPoint
          .position
          .copy(
            carRoot.worldToLocal(
              sitWorld.clone()
            )
          );

        this.subaruBonnetStandPoint
          .position
          .copy(
            carRoot.worldToLocal(
              standWorld.clone()
            )
          );

        // ========================================================
        // INTERACTION DIRECTIONS
        // ========================================================

        this.setInteractionAnchorFacing(
          this.subaruBonnetSitPoint,
          frontDirection
        );

        this.setInteractionAnchorFacing(
          this.subaruBonnetStandPoint,
          frontDirection
            .clone()
            .multiplyScalar(
              -1
            )
        );

        this.setInteractionAnchorFacing(
          this.subaruBonnetInteractPoint,
          frontDirection
            .clone()
            .multiplyScalar(
              -1
            )
        );

        this.subaruBonnetSitPoint
          .userData
          .emoteYOffset =
            this.BONNET_SIT_Y_OFFSET;

    // ========================================================
// DRIVER / DOOR / SEAT DETECTION
// ========================================================

const findObject =
  (
    regex
  ) => {
    let result =
      null;

    model.traverse(
      (object) => {
        if (
          result
        ) {
          return;
        }

        const name =
          String(
            object.name ||
            ''
          );

        if (
          regex.test(
            name
          )
        ) {
          result =
            object;
        }
      }
    );

    return result;
  };


// --------------------------------------------------------
// FIND IMPORTANT SUBARU PARTS
// --------------------------------------------------------

const steeringWheel =
  findObject(
    /SteeringWheelInterior/i
  ) ??
  findObject(
    /SteeringWheel/i
  );


const driverDoor =
  findObject(
    /^Animate_Door_FrontLeft$/i
  ) ??
  findObject(
    /Animate_Door_FrontLeft/i
  ) ??
  findObject(
    /DoorLF/i
  );


this.subaruSteeringWheelObject =
  steeringWheel;

this.subaruDriverDoorObject =
  driverDoor;


// --------------------------------------------------------
// PRINT ALL USEFUL NAMES
//
// Keep this temporarily.
// If something still isn't found,
// console will tell us the real GLB names.
// --------------------------------------------------------

const usefulNames =
  [];

model.traverse(
  (object) => {
    const name =
      String(
        object.name ||
          ''
      );

    if (
      /door|seat|steer/i.test(
        name
      )
    ) {
      usefulNames.push(
        name
      );
    }
  }
);

console.log(
  'SUBARU USEFUL NODES:',
  usefulNames
);


// ========================================================
// DETERMINE DRIVER SIDE FROM STEERING WHEEL
// ========================================================

const rightDirection =
  new THREE.Vector3(
    frontDirection.z,
    0,
    -frontDirection.x
  )
    .normalize();


let driverSideDirection =
  rightDirection.clone();


let steeringWorld =
  null;


if (
  steeringWheel
) {
  steeringWorld =
    new THREE.Vector3();

  steeringWheel.getWorldPosition(
    steeringWorld
  );

  const steeringOffset =
    steeringWorld
      .clone()
      .sub(
        finalCenter
      );

  const sideAmount =
    steeringOffset.dot(
      rightDirection
    );

  if (
    sideAmount <
    0
  ) {
    driverSideDirection
      .multiplyScalar(
        -1
      );
  }
}


// ========================================================
// DRIVER SEAT POSITION
// ========================================================
//
// Steering wheel gives us the correct side.
//
// Driver seat is slightly BEHIND the steering wheel.
// ========================================================

let seatWorld;


if (
  steeringWorld
) {
  seatWorld =
    steeringWorld.clone();

  seatWorld.addScaledVector(
    frontDirection,
    -0.28
  );
} else {
  seatWorld =
    finalCenter.clone();

  seatWorld.addScaledVector(
    driverSideDirection,
    0.34
  );

  seatWorld.addScaledVector(
    frontDirection,
    -0.10
  );
}


// Player root remains around floor height.
//
// DRIVER_SEAT_Y_OFFSET raises his visual model.

seatWorld.y =
  roadY;


// ========================================================
// DRIVER DOOR POSITION
// ========================================================

let doorWorld =
  null;


if (
  driverDoor
) {
  const doorBox =
    new THREE.Box3()
      .setFromObject(
        driverDoor
      );

  if (
    !doorBox.isEmpty()
  ) {
    doorWorld =
      new THREE.Vector3();

    doorBox.getCenter(
      doorWorld
    );
  } else {
    doorWorld =
      new THREE.Vector3();

    driverDoor.getWorldPosition(
      doorWorld
    );
  }
}


if (
  !doorWorld
) {
  doorWorld =
    finalCenter.clone();

  doorWorld.addScaledVector(
    driverSideDirection,
    finalSize.x *
      0.48
  );

  doorWorld.addScaledVector(
    frontDirection,
    0.05
  );
}


// ========================================================
// ENTRY / EXIT POSITIONS
// ========================================================

const entryWorld =
  doorWorld.clone();

entryWorld.addScaledVector(
  driverSideDirection,
  1.00
);

entryWorld.y =
  roadY;


const exitWorld =
  doorWorld.clone();

exitWorld.addScaledVector(
  driverSideDirection,
  0.60
);

exitWorld.y =
  roadY;


// ========================================================
// STORE ANCHORS
// ========================================================

carRoot.updateMatrixWorld(
  true
);


this.subaruDriverEntryPoint
  .position
  .copy(
    carRoot.worldToLocal(
      entryWorld.clone()
    )
  );


this.subaruDriverExitPoint
  .position
  .copy(
    carRoot.worldToLocal(
      exitWorld.clone()
    )
  );


this.subaruDriverSeatPoint
  .position
  .copy(
    carRoot.worldToLocal(
      seatWorld.clone()
    )
  );


// ========================================================
// FACING
// ========================================================
//
// Enter / Exit / Driving all face toward the HOOD.
// No more facing the boot.
// ========================================================

// ========================================================
// ENTER CAR MUST FACE FROM OUTSIDE -> DRIVER SEAT
// ========================================================

const enterCarFacing =
  seatWorld
    .clone()
    .sub(
      entryWorld
    );

enterCarFacing.y =
  0;

if (
  enterCarFacing.lengthSq() >
  0.0001
) {
  enterCarFacing.normalize();
}

this.setInteractionAnchorFacing(
  this.subaruDriverEntryPoint,
  enterCarFacing
);

this.setInteractionAnchorFacing(
  this.subaruDriverExitPoint,
  frontDirection
);

this.setInteractionAnchorFacing(
  this.subaruDriverSeatPoint,
  frontDirection
);


// ========================================================
// SAVE LOCAL FRONT DIRECTION
// ========================================================

this.subaruLocalFrontDirection
  .copy(
    frontDirection
  )
  .applyQuaternion(
    carRoot.quaternion
      .clone()
      .invert()
  );

this.subaruLocalFrontDirection.y =
  0;

this.subaruLocalFrontDirection
  .normalize();


console.log(
  'SUBARU VEHICLE DETECTION:',
  {
    steeringWheel:
      steeringWheel?.name ??
      'NOT FOUND',

    driverDoor:
      driverDoor?.name ??
      'NOT FOUND',

    driverSideDirection: {
      x:
        driverSideDirection.x
          .toFixed(
            3
          ),

      z:
        driverSideDirection.z
          .toFixed(
            3
          )
    }
  }
);

        // ========================================================
        // CAR COLLIDER
        // ========================================================

        this.subaruCollider =
          new OrientedBoxCollider(
            finalCenter.x,
            finalCenter.z,
            carRoot.rotation.y,

            finalSize.x /
              2 +
              0.05,

            finalSize.z /
              2 +
              0.05
          );

        this.subaruColliderCenterLocal
          .copy(
            carRoot.worldToLocal(
              finalCenter.clone()
            )
          );

        this.orientedBoxColliders.push(
          this.subaruCollider
        );

        this.cameraCollisionObjects.push(
          carRoot
        );

        // ========================================================
        // SAVE REFERENCES
        // ========================================================

        this.subaruModel =
          model;

        this.subaruVisualOrientation =
          orientation;

        this.subaruReady =
          true;

        console.log(
          'Racing Life: Subaru normalized.',
          {
            orientationX:
              THREE.MathUtils
                .radToDeg(
                  orientation.rotation.x
                ),

            orientationZ:
              THREE.MathUtils
                .radToDeg(
                  orientation.rotation.z
                ),

            width:
              finalSize.x
                .toFixed(
                  2
                ),

            height:
              finalSize.y
                .toFixed(
                  2
                ),

            length:
              finalSize.z
                .toFixed(
                  2
                ),

            bottomY:
              finalBox.min.y
                .toFixed(
                  3
                )
          }
        );

        this.refreshStatus();
      },

      undefined,

      (error) => {
        console.error(
          'Racing Life: Subaru load failed.',
          error
        );

        this.refreshStatus(
          'Subaru failed to load — check console'
        );
      }
    );
  }

  // ============================================================
  // PLAYER
  // ============================================================

  buildPlayer() {
    this.player =
      new MixamoPlayer({
        path:
          '/assets/characters/MixamoRacer.glb',

        idlePath:
          '/assets/characters/animations/Idle.glb',

        preloadEmotes: [
          this.bonnetSitEmote,
          this.enterCarEmote,
          this.drivingEmote,
          this.exitCarEmote,
          this.hornEmote
        ]
      });

    this.player.position.copy(
      this.PLAYER_SPAWN
    );

    this.player.rotation.y =
      Math.PI;

    this.player.groundOffsetY =
      0;

    this.scene.add(
      this.player
    );

    this.controls.target.set(
      this.player.position.x,

      this.player.position.y +
        1,

      this.player.position.z
    );
  }

  // ============================================================
  // GROUND HEIGHT
  // ============================================================

  getGroundHeight() {
    if (
      !this.player
    ) {
      return this.PLAYER_SPAWN.y;
    }

    this.groundOrigin.set(
      this.player.position.x,

      this.player.position.y +
        this.GROUND_RAY_HEIGHT,

      this.player.position.z
    );

    this.groundRaycaster.set(
      this.groundOrigin,
      this.groundDirection
    );

    this.groundRaycaster.near =
      0;

    this.groundRaycaster.far =
      this.GROUND_RAY_DISTANCE;

    const hits =
      this.groundRaycaster
        .intersectObjects(
          this.groundObjects,
          true
        );

    for (
      const hit
      of hits
    ) {
      if (
        Number.isFinite(
          hit.point.y
        )
      ) {
        return hit.point.y;
      }
    }

    return this.PLAYER_SPAWN.y;
  }

  // ============================================================
  // APPLY GROUNDING
  // ============================================================

  applyGrounding() {
    if (
      !this.player ||
      !this.player.isReady() ||
      this.bonnetSitting ||
      this.vehicleState !==
        'on-foot'
    ) {
      return;
    }

    this.player.position.y =
      this.getGroundHeight();
  }

  // ============================================================
  // INITIAL CAMERA
  // ============================================================

  setupInitialCamera() {
    if (
      !this.player ||
      !this.controls
    ) {
      return;
    }

    const target =
      new THREE.Vector3(
        this.player.position.x,

        this.player.position.y +
          1,

        this.player.position.z
      );

    const distance =
      3.7;

    const heightAngle =
      THREE.MathUtils
        .degToRad(
          14
        );

    const horizontalDistance =
      distance *
      Math.cos(
        heightAngle
      );

    const verticalDistance =
      distance *
      Math.sin(
        heightAngle
      );

    this.controls.target.copy(
      target
    );

    this.camera.position.set(
      this.player.position.x,

      target.y +
        verticalDistance,

      this.player.position.z +
        horizontalDistance
    );

    this.camera.lookAt(
      target
    );

    this.controls.update();

    this.lastPlayerPosition.copy(
      this.player.position
    );
  }

  // ============================================================
  // INTERACTION ANCHOR DIRECTION
  // ============================================================

  setInteractionAnchorFacing(
    anchor,
    worldDirection
  ) {
    if (
      !anchor ||
      !anchor.parent
    ) {
      return;
    }

    const direction =
      worldDirection.clone();

    direction.y =
      0;

    if (
      direction.lengthSq() <
      0.0001
    ) {
      return;
    }

    direction.normalize();

    const parentQuaternion =
      new THREE.Quaternion();

    anchor.parent.getWorldQuaternion(
      parentQuaternion
    );

    const localDirection =
      direction.clone()
        .applyQuaternion(
          parentQuaternion.invert()
        );

    localDirection.y =
      0;

    localDirection.normalize();

    anchor.rotation.set(
      0,

      Math.atan2(
        localDirection.x,
        localDirection.z
      ),

      0
    );
  }

  // ============================================================
  // FACE PLAYER USING INTERACTION ANCHOR
  // ============================================================

  facePlayerFromAnchor(
    anchor
  ) {
    if (
      !anchor ||
      !this.player
    ) {
      return;
    }

    const worldQuaternion =
      new THREE.Quaternion();

    anchor.getWorldQuaternion(
      worldQuaternion
    );

    const direction =
      new THREE.Vector3(
        0,
        0,
        1
      )
        .applyQuaternion(
          worldQuaternion
        );

    direction.y =
      0;

    if (
      direction.lengthSq() <
      0.0001
    ) {
      return;
    }

    direction.normalize();

    this.player.rotation.y =
      Math.atan2(
        direction.x,
        direction.z
      );
  }

  // ============================================================
  // SUBARU WORLD DIRECTION
  // ============================================================

  getSubaruFrontDirection() {
    const direction =
      this.subaruLocalFrontDirection
        .clone();

    if (
      this.subaruRoot
    ) {
      direction.applyQuaternion(
        this.subaruRoot.quaternion
      );
    }

    direction.y =
      0;

    if (
      direction.lengthSq() <
      0.0001
    ) {
      direction.set(
        0,
        0,
        1
      );
    }

    return direction.normalize();
  }

  // ============================================================
  // KEEP MOVING SUBARU COLLIDER IN SYNC
  // ============================================================

  syncSubaruCollider() {
    if (
      !this.subaruRoot ||
      !this.subaruCollider
    ) {
      return;
    }

    const centerWorld =
      this.subaruColliderCenterLocal
        .clone();

    this.subaruRoot.localToWorld(
      centerWorld
    );

    this.subaruCollider.x =
      centerWorld.x;

    this.subaruCollider.z =
      centerWorld.z;

    this.subaruCollider.rotationY =
      this.subaruRoot.rotation.y;

    this.subaruCollider.cos =
      Math.cos(
        -this.subaruCollider.rotationY
      );

    this.subaruCollider.sin =
      Math.sin(
        -this.subaruCollider.rotationY
      );
  }

  // ============================================================
  // KEEP PLAYER IN DRIVER SEAT
  // ============================================================

  syncPlayerToDriverSeat() {
    if (
      !this.player ||
      !this.subaruDriverSeatPoint
    ) {
      return;
    }

    this.subaruDriverSeatPoint
      .getWorldPosition(
        this.vehicleFollowPosition
      );

    this.player.position.copy(
      this.vehicleFollowPosition
    );

    this.facePlayerFromAnchor(
      this.subaruDriverSeatPoint
    );
  }

  // ============================================================
  // DRIVING CAMERA
  // ============================================================

  setupDrivingCamera() {
    if (
      !this.player ||
      !this.subaruRoot ||
      !this.controls
    ) {
      return;
    }

    const front =
      this.getSubaruFrontDirection();

    const target =
      this.player.position
        .clone();

    target.y +=
      1.0;

    const desiredCamera =
      target
        .clone()
        .addScaledVector(
          front,
          -5.2
        );

    desiredCamera.y +=
      2.0;

    this.controls.target.copy(
      target
    );

    this.camera.position.copy(
      desiredCamera
    );

    this.camera.lookAt(
      target
    );

    this.controls.update();

    this.lastPlayerPosition.copy(
      this.player.position
    );
  }

// ============================================================
// ANIMATE DRIVER DOOR
// ============================================================

animateSubaruDriverDoor(
  open,
  duration =
    0.34
) {
  if (
    !this.subaruDriverDoorPivot
  ) {
    return Promise.resolve(
      false
    );
  }

  if (
    this.subaruDriverDoorAnimating
  ) {
    return Promise.resolve(
      false
    );
  }

  this.subaruDriverDoorAnimating =
    true;

  const pivot =
    this.subaruDriverDoorPivot;

  const startAngle =
    pivot.rotation.z;

  const targetAngle =
    open
      ?
      this.SUBARU_DRIVER_DOOR_OPEN_ANGLE
      :
      0;

  return new Promise(
    (resolve) => {
      const startTime =
        performance.now();

      const step =
        (
          now
        ) => {
          if (
            this.disposed
          ) {
            this.subaruDriverDoorAnimating =
              false;

            resolve(
              false
            );

            return;
          }

          const rawT =
            (
              now -
              startTime
            ) /
            Math.max(
              1,
              duration *
                1000
            );

          const t =
            THREE.MathUtils.clamp(
              rawT,
              0,
              1
            );

          const eased =
            t *
            t *
            (
              3 -
              2 *
              t
            );

          pivot.rotation.z =
            THREE.MathUtils.lerp(
              startAngle,
              targetAngle,
              eased
            );

          if (
            t <
            1
          ) {
            requestAnimationFrame(
              step
            );

            return;
          }

          pivot.rotation.z =
            targetAngle;

          this.subaruDriverDoorAnimating =
            false;

          resolve(
            true
          );
        };

      requestAnimationFrame(
        step
      );
    }
  );
}

// ============================================================
// MOVE PLAYER BETWEEN VEHICLE INTERACTION ANCHORS
// ============================================================

tweenPlayerToAnchor(
  anchor,
  durationSeconds =
    0.8,
  delaySeconds =
    0
) {
  if (
    !anchor ||
    !this.player
  ) {
    return Promise.resolve(
      false
    );
  }

  const startPosition =
    this.player.position.clone();

  const targetPosition =
    new THREE.Vector3();

  anchor.getWorldPosition(
    targetPosition
  );

  // Keep the player root at world floor level.
  // The animation itself handles the vertical
  // body pose through the Hips Y track.
  targetPosition.y =
    this.SUBARU_SPAWN.y;

  return new Promise(
    (resolve) => {
      const startTime =
        performance.now();

      const animate =
        (now) => {
          if (
            this.disposed
          ) {
            resolve(
              false
            );

            return;
          }

          const elapsed =
            (
              now -
              startTime
            ) /
            1000;

          // Wait for the animation to begin
          // before moving into the car.
          if (
            elapsed <
            delaySeconds
          ) {
            requestAnimationFrame(
              animate
            );

            return;
          }

          const t =
            THREE.MathUtils.clamp(
              (
                elapsed -
                delaySeconds
              ) /
              Math.max(
                0.001,
                durationSeconds
              ),

              0,
              1
            );

          // Smooth start + stop.
          const eased =
            t *
            t *
            (
              3 -
              2 *
              t
            );

          this.player.position
            .lerpVectors(
              startPosition,
              targetPosition,
              eased
            );

          if (
            t <
            1
          ) {
            requestAnimationFrame(
              animate
            );

            return;
          }

          this.player.position.copy(
            targetPosition
          );

          resolve(
            true
          );
        };

      requestAnimationFrame(
        animate
      );
    }
  );
}

  // ============================================================
  // HANDLE F — ENTER / EXIT VEHICLE
  // ============================================================

  async handleVehicleAction() {
    if (
      !this.player ||
      !this.player.isReady() ||
      !this.subaruReady
    ) {
      return;
    }

    if (
      this.vehicleState ===
        'entering' ||
      this.vehicleState ===
        'exiting'
    ) {
      return;
    }

    if (
      this.vehicleState ===
        'driving'
    ) {
      if (
        Math.abs(
          this.subaruSpeed
        ) >
        0.75
      ) {
        this.showInteractionPrompt(
          'STOP CAR',
          'Slow down before exiting',
          'F'
        );

        return;
      }

      await this.exitSubaru();

      return;
    }

    if (
      this.bonnetSitting
    ) {
      return;
    }

    if (
      this.currentInteraction ===
      'vehicle-enter'
    ) {
      await this.enterSubaru();
    }
  }

  // ============================================================
  // ENTER SUBARU
  // ============================================================


  // ============================================================
// CONTROLLED ENTER-CAR MOVEMENT
// ============================================================

tweenPlayerIntoSubaru(
  durationSeconds
) {
  if (
    !this.player ||
    !this.subaruDriverSeatPoint
  ) {
    return Promise.resolve(
      false
    );
  }

  const start =
    this.player.position.clone();

  const seat =
    new THREE.Vector3();

  this.subaruDriverSeatPoint
    .getWorldPosition(
      seat
    );

  seat.y =
    this.SUBARU_SPAWN.y;

  // ----------------------------------------------------------
  // DOOR THRESHOLD
  //
  // About halfway between the outside animation position
  // and the actual driver's seat.
  // ----------------------------------------------------------

  const doorway =
    start
      .clone()
      .lerp(
        seat,
        0.48
      );

  doorway.y =
    this.SUBARU_SPAWN.y;

  return new Promise(
    (resolve) => {
      const startTime =
        performance.now();

      const animate =
        (now) => {
          if (
            this.disposed
          ) {
            resolve(
              false
            );

            return;
          }

          const elapsed =
            (
              now -
              startTime
            ) /
            1000;

          const t =
            THREE.MathUtils.clamp(
              elapsed /
                Math.max(
                  durationSeconds,
                  0.001
                ),
              0,
              1
            );

          // ==================================================
          // PHASE 1 — HAND REACHES DOOR HANDLE
          // 0% -> 35%
          //
          // DO NOT MOVE THE PLAYER ROOT.
          // ==================================================

          if (
            t <
            0.35
          ) {
            this.player.position.copy(
              start
            );
          }

          // ==================================================
          // PHASE 2 — STEP TOWARD DOOR OPENING
          // 35% -> 70%
          // ==================================================

          else if (
            t <
            0.70
          ) {
            const localT =
              (
                t -
                0.35
              ) /
              0.35;

            const smooth =
              localT *
              localT *
              (
                3 -
                2 *
                localT
              );

            this.player.position
              .lerpVectors(
                start,
                doorway,
                smooth
              );
          }

          // ==================================================
          // PHASE 3 — MOVE INTO DRIVER SEAT
          // 70% -> 100%
          // ==================================================

          else {
            const localT =
              (
                t -
                0.70
              ) /
              0.30;

            const smooth =
              localT *
              localT *
              (
                3 -
                2 *
                localT
              );

            this.player.position
              .lerpVectors(
                doorway,
                seat,
                smooth
              );
          }

          if (
            t <
            1
          ) {
            requestAnimationFrame(
              animate
            );

            return;
          }

          this.player.position.copy(
            seat
          );

          resolve(
            true
          );
        };

      requestAnimationFrame(
        animate
      );
    }
  );
}
 // ============================================================
// ENTER SUBARU
// ============================================================

async enterSubaru() {
  if (
    this.vehicleState !==
      'on-foot' ||
    !this.subaruDriverEntryPoint ||
    !this.subaruDriverSeatPoint ||
    !this.player
  ) {
    return;
  }

  this.vehicleState =
    'entering';

  this.interactionBusy =
    true;

  this.clearInteraction();

  this.player
    .clearPostPoseAdjustment();

  this.player.cancelEmote(
    false
  );

  // ----------------------------------------------------------
  // PLACE PLAYER BESIDE DRIVER DOOR
  // ----------------------------------------------------------

 // ==========================================================
// GET DRIVER-DOOR INTERACTION POSITION
// ==========================================================

this.subaruDriverEntryPoint
  .getWorldPosition(
    this.tempWorldPoint
  );

// Get driver-seat position too.
// We use seat -> door direction to know which way is OUTSIDE.
this.subaruDriverSeatPoint
  .getWorldPosition(
    this.tempWorldPoint2
  );

const outsideDirection =
  this.tempWorldPoint
    .clone()
    .sub(
      this.tempWorldPoint2
    );

outsideDirection.y =
  0;

if (
  outsideDirection.lengthSq() >
  0.0001
) {
  outsideDirection.normalize();
}

// ==========================================================
// SEPARATE ANIMATION START FROM F INTERACTION POINT
// ==========================================================
//
// subaruDriverEntryPoint:
//     stays near the car so F still appears.
//
// animationStart:
//     farther outward and only used AFTER F is pressed.
// ==========================================================

const animationStart =
  this.tempWorldPoint
    .clone()
    .addScaledVector(
      outsideDirection,
      this.ENTER_CAR_START_EXTRA_DISTANCE
    );

animationStart.y =
  this.SUBARU_SPAWN.y;

this.player.position.set(
  animationStart.x,
  animationStart.y,
  animationStart.z
);

// Still use the original entry anchor's facing direction.
this.facePlayerFromAnchor(
  this.subaruDriverEntryPoint
);

// Correct Entering Car.glb direction.
this.player.emoteYawOffset =
  this.ENTER_CAR_YAW_OFFSET;

// Lower ONLY the entering animation.
this.player.emoteYOffset =
  this.ENTER_CAR_Y_OFFSET;

  this.lastPlayerPosition.copy(
    this.player.position
  );

  console.log(
    'Racing Life: entering Subaru.'
  );

// Move slightly toward the rear edge of the front door,
// where the exterior handle actually is.
animationStart.addScaledVector(
  this.getSubaruFrontDirection(),
  this.ENTER_CAR_HANDLE_OFFSET
);

  // ----------------------------------------------------------
  // OPEN DRIVER DOOR
  // ----------------------------------------------------------

  await this.animateSubaruDriverDoor(
    true
  );

  // ----------------------------------------------------------
  // GET ENTER ANIMATION LENGTH
  // ----------------------------------------------------------

  const enterData =
    await this.player.loadEmote(
      this.enterCarEmote
    );

  const enterDuration =
    Math.max(
      0.4,
      enterData.clip.duration
    );

  // ----------------------------------------------------------
  // PLAY ENTER ANIMATION + MOVE TOWARD SEAT
  // ----------------------------------------------------------

  const animationPromise =
    this.player
      .playOneShotEmoteAndWait(
        this.enterCarEmote
      );

  const movementPromise =
  this.tweenPlayerIntoSubaru(
    enterDuration *
      0.90
  );

  const [
    completed
  ] =
    await Promise.all([
      animationPromise,
      movementPromise
    ]);

  if (
    this.disposed
  ) {
    return;
  }

  if (
    !completed
  ) {
    this.vehicleState =
      'on-foot';

    this.interactionBusy =
      false;

    this.player.emoteYawOffset =
      0;

    this.player.emoteYOffset =
      0;

    this.player.cancelEmote(
      true
    );

    await this
      .animateSubaruDriverDoor(
        false
      );

    return;
  }

  // ----------------------------------------------------------
  // EXACT DRIVER SEAT POSITION
  // ----------------------------------------------------------

  this.syncPlayerToDriverSeat();

  this.vehicleState =
    'driving';

  this.interactionBusy =
    false;

  // IMPORTANT:
  // Enter Car needed the 90-degree correction,
  // but Driving.glb uses normal vehicle-forward orientation.
  this.player.emoteYawOffset =
    0;

  this.player.emoteYOffset =
    this.DRIVER_SEAT_Y_OFFSET;

  // ----------------------------------------------------------
  // DRIVING LOOP
  // ----------------------------------------------------------

  await this.player
    .playLoopingEmote(
      this.drivingEmote
    );

  await this
    .animateSubaruDriverDoor(
      false,
      0.30
    );

  this.setupDrivingCamera();

  console.log(
    'Racing Life: driving Subaru.'
  );
}

//Exit Subaru//

  // ============================================================
// EXIT SUBARU
// ============================================================

async exitSubaru() {
  if (
    this.vehicleState !==
      'driving' ||
    !this.subaruDriverExitPoint ||
    !this.player
  ) {
    return;
  }

  this.vehicleState =
    'exiting';

  this.interactionBusy =
    true;

  this.subaruSpeed =
    0;

  this.clearInteraction();

  this.syncPlayerToDriverSeat();

  // ----------------------------------------------------------
  // EXIT ANIMATION ALIGNMENT
  // ----------------------------------------------------------

  this.player.emoteYawOffset =
    this.EXIT_CAR_YAW_OFFSET;

  this.player.emoteYOffset =
    this.DRIVER_SEAT_Y_OFFSET;

  // ----------------------------------------------------------
  // OPEN DRIVER DOOR
  // ----------------------------------------------------------

  await this.animateSubaruDriverDoor(
    true
  );

  console.log(
    'Racing Life: exiting Subaru.'
  );

  // ----------------------------------------------------------
  // EXIT CAR ANIMATION
  // ----------------------------------------------------------

  await this.player
    .playOneShotEmoteAndWait(
      this.exitCarEmote
    );

  if (
    this.disposed
  ) {
    return;
  }

  // ----------------------------------------------------------
  // PLACE PLAYER OUTSIDE DRIVER DOOR
  // ----------------------------------------------------------

  this.subaruDriverExitPoint
    .getWorldPosition(
      this.tempWorldPoint
    );

  this.player.position.set(
    this.tempWorldPoint.x,
    this.SUBARU_SPAWN.y,
    this.tempWorldPoint.z
  );

  this.facePlayerFromAnchor(
    this.subaruDriverExitPoint
  );

  // Back to ordinary character orientation.
  this.player.emoteYawOffset =
    0;

  this.player.emoteYOffset =
    0;

  this.player.cancelEmote(
    true
  );

  this.vehicleState =
    'on-foot';

  this.interactionBusy =
    false;

  this.lastPlayerPosition.copy(
    this.player.position
  );

  this.clearInteraction();

  await this.animateSubaruDriverDoor(
    false,
    0.30
  );

  this.refreshStatus();

  console.log(
    'Racing Life: exited Subaru.'
  );
}

  // ============================================================
  // SUBARU DRIVING
  // ============================================================

  updateSubaruDriving(
    dt
  ) {
    if (
      this.vehicleState !==
        'driving' ||
      !this.subaruRoot
    ) {
      return;
    }

    const accelerating =
      this.keys.KeyW;

    const brakingOrReverse =
      this.keys.KeyS;

    const steerInput =
      (
        this.keys.KeyA
          ? 1
          : 0
      ) -
      (
        this.keys.KeyD
          ? 1
          : 0
      );

    if (
      accelerating
    ) {
      this.subaruSpeed +=
        this.SUBARU_ACCELERATION *
        dt;
    } else if (
      brakingOrReverse
    ) {
      if (
        this.subaruSpeed >
        0.4
      ) {
        this.subaruSpeed -=
          this.SUBARU_BRAKE_POWER *
          dt;
      } else {
        this.subaruSpeed -=
          this.SUBARU_ACCELERATION *
          0.70 *
          dt;
      }
    } else {
      const dragAmount =
        this.SUBARU_DRAG *
        dt;

      if (
        Math.abs(
          this.subaruSpeed
        ) <=
        dragAmount
      ) {
        this.subaruSpeed =
          0;
      } else {
        this.subaruSpeed -=
          Math.sign(
            this.subaruSpeed
          ) *
          dragAmount;
      }
    }

    this.subaruSpeed =
      THREE.MathUtils.clamp(
        this.subaruSpeed,
        -this.SUBARU_MAX_REVERSE_SPEED,
        this.SUBARU_MAX_SPEED
      );

    const absSpeed =
      Math.abs(
        this.subaruSpeed
      );

    if (
      steerInput !==
        0 &&
      absSpeed >
        0.05
    ) {
      const speedFactor =
        THREE.MathUtils.clamp(
          absSpeed /
            5,
          0.18,
          1
        );

      const reverseFactor =
        this.subaruSpeed >=
        0
          ? 1
          : -1;

      this.subaruRoot.rotation.y +=
        steerInput *
        this.SUBARU_STEER_RATE *
        speedFactor *
        reverseFactor *
        dt;
    }

    const front =
      this.getSubaruFrontDirection();

    this.subaruRoot.position
      .addScaledVector(
        front,
        this.subaruSpeed *
          dt
      );

    this.subaruRoot.updateMatrixWorld(
      true
    );

    this.syncSubaruCollider();

    this.syncPlayerToDriverSeat();

    if (
      this.statusEl
    ) {
      const speedKmh =
        Math.abs(
          this.subaruSpeed *
          3.6
        );

      this.statusEl.textContent =
        `Driving Subaru · ${speedKmh.toFixed(0)} km/h · F — Exit`;
    }
  }

  // ============================================================
  // BONNET SITTING ARM CORRECTION
  // ============================================================

  setupBonnetSitPoseCorrection() {
    if (
      !this.player ||
      !this.player.model
    ) {
      return;
    }

    let rightArm =
      null;

    let rightForeArm =
      null;

    let leftArm =
      null;

    let leftForeArm =
      null;

    this.player.model.traverse(
      (object) => {
        const name =
          String(
            object.name ||
              ''
          ).toLowerCase();

        if (
          name.includes(
            'rightarm'
          ) &&
          !name.includes(
            'forearm'
          )
        ) {
          rightArm =
            object;
        }

        if (
          name.includes(
            'rightforearm'
          )
        ) {
          rightForeArm =
            object;
        }

        if (
          name.includes(
            'leftarm'
          ) &&
          !name.includes(
            'forearm'
          )
        ) {
          leftArm =
            object;
        }

        if (
          name.includes(
            'leftforearm'
          )
        ) {
          leftForeArm =
            object;
        }
      }
    );

    const rightArmCorrection =
      new THREE.Quaternion()
        .setFromEuler(
          new THREE.Euler(
            THREE.MathUtils
              .degToRad(-34),
            0,
            THREE.MathUtils
              .degToRad(20)
          )
        );

    const rightForeArmCorrection =
      new THREE.Quaternion()
        .setFromEuler(
          new THREE.Euler(
            THREE.MathUtils
              .degToRad(40),
            0,
            THREE.MathUtils
              .degToRad(2)
          )
        );

    const leftArmCorrection =
      new THREE.Quaternion()
        .setFromEuler(
          new THREE.Euler(
            THREE.MathUtils
              .degToRad(-34),
            0,
            THREE.MathUtils
              .degToRad(-20)
          )
        );

    const leftForeArmCorrection =
      new THREE.Quaternion()
        .setFromEuler(
          new THREE.Euler(
            THREE.MathUtils
              .degToRad(40),
            0,
            THREE.MathUtils
              .degToRad(-2)
          )
        );

    this.player.setPostPoseAdjustment(
      () => {
        if (
          !this.bonnetSitting
        ) {
          return;
        }

        if (
          rightArm
        ) {
          rightArm.quaternion.multiply(
            rightArmCorrection
          );
        }

        if (
          rightForeArm
        ) {
          rightForeArm.quaternion.multiply(
            rightForeArmCorrection
          );
        }

        if (
          leftArm
        ) {
          leftArm.quaternion.multiply(
            leftArmCorrection
          );
        }

        if (
          leftForeArm
        ) {
          leftForeArm.quaternion.multiply(
            leftForeArmCorrection
          );
        }
      }
    );
  }

  // ============================================================
  // INTERACTION DETECTION
  // ============================================================

  updateInteraction() {
    if (
      !this.player ||
      !this.player.isReady()
    ) {
      this.clearInteraction();

      return;
    }

    if (
      this.vehicleState ===
        'entering' ||
      this.vehicleState ===
        'exiting'
    ) {
      this.clearInteraction();

      return;
    }

    if (
      this.vehicleState ===
        'driving'
    ) {
      this.currentInteraction =
        'vehicle-exit';

      if (
        Math.abs(
          this.subaruSpeed
        ) >
        0.75
      ) {
        this.showInteractionPrompt(
          'STOP CAR',
          'Slow down before exiting',
          'F'
        );
      } else {
        this.showInteractionPrompt(
          'EXIT VEHICLE',
          'Exit Subaru',
          'F'
        );
      }

      return;
    }

    if (
      this.bonnetSitting
    ) {
      this.currentInteraction =
        'bonnet-stand';

      this.showInteractionPrompt(
        'STAND UP',
        'Leave the bonnet',
        'G'
      );

      return;
    }

    if (
      this.interactionBusy ||
      !this.subaruReady
    ) {
      this.clearInteraction();

      return;
    }

    // ----------------------------------------------------------
    // DRIVER DOOR / F
    // ----------------------------------------------------------

    if (
      this.subaruDriverEntryPoint
    ) {
      this.subaruDriverEntryPoint
        .getWorldPosition(
          this.tempWorldPoint2
        );

      const vehicleDx =
        this.player.position.x -
        this.tempWorldPoint2.x;

      const vehicleDz =
        this.player.position.z -
        this.tempWorldPoint2.z;

      const vehicleDistance =
        Math.hypot(
          vehicleDx,
          vehicleDz
        );

      if (
        vehicleDistance <=
        this.VEHICLE_INTERACTION_RADIUS
      ) {
        this.currentInteraction =
          'vehicle-enter';

        this.showInteractionPrompt(
          'ENTER VEHICLE',
          'Enter Subaru',
          'F'
        );

        return;
      }
    }

    // ----------------------------------------------------------
    // BONNET / G
    // ----------------------------------------------------------

    if (
      this.subaruBonnetInteractPoint
    ) {
      this.subaruBonnetInteractPoint
        .getWorldPosition(
          this.tempWorldPoint
        );

      const dx =
        this.player.position.x -
        this.tempWorldPoint.x;

      const dz =
        this.player.position.z -
        this.tempWorldPoint.z;

      const distance =
        Math.hypot(
          dx,
          dz
        );

      if (
        distance <=
        this.BONNET_INTERACTION_RADIUS
      ) {
        this.currentInteraction =
          'bonnet-sit';

        this.showInteractionPrompt(
          'INTERACT',
          'Sit on bonnet',
          'G'
        );

        return;
      }
    }

    this.clearInteraction();
  }

  // ============================================================
  // HANDLE G
  // ============================================================

  async handleInteract() {
    if (
      this.interactionBusy ||
      !this.player ||
      !this.player.isReady()
    ) {
      return;
    }

    if (
      this.vehicleState !==
        'on-foot'
    ) {
      return;
    }

    if (
      this.bonnetSitting
    ) {
      this.exitBonnetSit();

      return;
    }

    if (
      this.currentInteraction ===
        'bonnet-sit'
    ) {
      await this.startBonnetSit();
    }
  }

  // ============================================================
  // START BONNET SIT
  // ============================================================

  async startBonnetSit() {
    if (
      !this.subaruReady ||
      !this.subaruRoot ||
      !this.subaruBonnetSitPoint ||
      !this.player
    ) {
      return;
    }

    this.interactionBusy =
      true;

    this.clearInteraction();

    this.subaruBonnetSitPoint
      .getWorldPosition(
        this.tempWorldPoint
      );

    this.player.position.set(
      this.tempWorldPoint.x,

      this.SUBARU_SPAWN.y,

      this.tempWorldPoint.z
    );

    this.facePlayerFromAnchor(
      this.subaruBonnetSitPoint
    );

    this.player.emoteYawOffset =
      0;

    this.player.emoteYOffset =
      this.subaruBonnetSitPoint
        .userData
        .emoteYOffset ??
      0;

    this.bonnetSitting =
      true;

    this.lastPlayerPosition.copy(
      this.player.position
    );

    this.setupBonnetSitPoseCorrection();

    await this.player.playEmote(
      this.bonnetSitEmote
    );

    if (
      !this.player.emoting
    ) {
      this.bonnetSitting =
        false;

      this.interactionBusy =
        false;

      this.exitBonnetSit();

      return;
    }

    this.interactionBusy =
      false;

    this.currentInteraction =
      'bonnet-stand';

    this.showInteractionPrompt(
      'STAND UP',
      'Leave the bonnet',
      'G'
    );
  }

  // ============================================================
  // EXIT BONNET SIT
  // ============================================================

  exitBonnetSit() {
    if (
      !this.player
    ) {
      return;
    }

    this.bonnetSitting =
      false;

    this.interactionBusy =
      false;

    this.player.cancelEmote(
      true
    );

    this.player.clearPostPoseAdjustment();

    this.player.emoteYawOffset =
      0;

    this.player.emoteYOffset =
      0;

    if (
      this.subaruBonnetStandPoint &&
      this.subaruRoot
    ) {
      this.subaruBonnetStandPoint
        .getWorldPosition(
          this.tempWorldPoint2
        );

      this.player.position.set(
        this.tempWorldPoint2.x,

        this.SUBARU_SPAWN.y,

        this.tempWorldPoint2.z
      );

      this.facePlayerFromAnchor(
        this.subaruBonnetStandPoint
      );
    }

    this.lastPlayerPosition.copy(
      this.player.position
    );

    this.clearInteraction();
  }

  // ============================================================
  // UI
  // ============================================================

  buildUI() {
    const style =
      document.createElement(
        'style'
      );

    style.dataset.racingLifeFreeRoam =
      'true';

    style.textContent = `
      .rl-roam-ui {
        position: fixed;
        inset: 0;
        z-index: 5;
        pointer-events: none;
        font-family: Arial, sans-serif;
        color: white;
      }

      .rl-roam-top {
        position: absolute;
        top: 20px;
        left: 22px;
        padding: 12px 15px;
        border-radius: 13px;
        background: rgba(8,12,16,.72);
        border: 1px solid rgba(255,255,255,.12);
        backdrop-filter: blur(8px);
        box-shadow: 0 10px 30px rgba(0,0,0,.15);
      }

      .rl-roam-title {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: .13em;
      }

      .rl-roam-help {
        margin-top: 5px;
        font-size: 11px;
        opacity: .74;
      }

      .rl-roam-bottom {
        position: absolute;
        left: 22px;
        bottom: 22px;
        padding: 10px 13px;
        border-radius: 12px;
        background: rgba(8,12,16,.72);
        border: 1px solid rgba(255,255,255,.12);
        font-size: 11px;
        opacity: .88;
      }

      .rl-roam-exit {
        position: absolute;
        right: 22px;
        top: 20px;
        pointer-events: auto;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 11px;
        background: rgba(8,12,16,.75);
        color: white;
        padding: 10px 14px;
        cursor: pointer;
        backdrop-filter: blur(8px);
      }

      .rl-roam-exit:hover {
        background: rgba(45,48,56,.92);
      }

      .rl-interact-prompt {
        position: absolute;
        left: 50%;
        bottom: 82px;
        transform: translateX(-50%) translateY(8px);
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        min-width: 130px;
        opacity: 0;
        transition:
          opacity .12s ease,
          transform .12s ease;
      }

      .rl-interact-prompt.visible {
        display: flex;
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .rl-interact-key {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        background: rgba(10,14,18,.90);
        border: 1px solid rgba(255,255,255,.30);
        box-shadow: 0 8px 24px rgba(0,0,0,.25);
        font-size: 18px;
        font-weight: 900;
      }

      .rl-interact-title {
        padding: 5px 9px;
        border-radius: 8px;
        background: rgba(8,12,16,.78);
        border: 1px solid rgba(255,255,255,.10);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .10em;
      }

      .rl-interact-detail {
        font-size: 10px;
        text-shadow: 0 2px 6px rgba(0,0,0,.9);
        opacity: .90;
      }
    `;

    document.head.appendChild(
      style
    );

    this.styleEl =
      style;

    const ui =
      document.createElement(
        'div'
      );

    ui.className =
      'rl-roam-ui';

    ui.innerHTML = `
      <div class="rl-roam-top">
        <div class="rl-roam-title">
          FREE ROAM
        </div>

        <div class="rl-roam-help">
          W/S — Move/Drive · A/D — Turn/Steer · G — Interact · F — Vehicle · Mouse — Camera
        </div>
      </div>

      <button
        class="rl-roam-exit"
        data-roam-action="exit"
      >
        HOME
      </button>

      <div
        class="rl-roam-bottom"
        data-roam-status
      >
        Loading city and Subaru...
      </div>

      <div
        class="rl-interact-prompt"
        data-interaction-prompt
      >
        <div
          class="rl-interact-key"
          data-interaction-key
        >
          G
        </div>

        <div
          class="rl-interact-title"
          data-interaction-title
        >
          INTERACT
        </div>

        <div
          class="rl-interact-detail"
          data-interaction-detail
        >
          Sit on bonnet
        </div>
      </div>
    `;

    ui.addEventListener(
      'click',

      (event) => {
        const button =
          event.target.closest(
            '[data-roam-action]'
          );

        if (
          !button
        ) {
          return;
        }

        if (
          button.dataset
            .roamAction ===
          'exit'
        ) {
          this.onExit();
        }
      }
    );

    document.body.appendChild(
      ui
    );

    this.ui =
      ui;

    this.statusEl =
      ui.querySelector(
        '[data-roam-status]'
      );

    this.interactionPromptEl =
      ui.querySelector(
        '[data-interaction-prompt]'
      );

    this.interactionKeyEl =
      ui.querySelector(
        '[data-interaction-key]'
      );

    this.interactionTitleEl =
      ui.querySelector(
        '[data-interaction-title]'
      );

    this.interactionDetailEl =
      ui.querySelector(
        '[data-interaction-detail]'
      );

    this.refreshStatus();
  }

  // ============================================================
  // STATUS
  // ============================================================

  refreshStatus(
    forcedText =
      null
  ) {
    if (
      !this.statusEl
    ) {
      return;
    }

    if (
      forcedText
    ) {
      this.statusEl.textContent =
        forcedText;

      return;
    }

    if (
      this.streetCityReady &&
      this.subaruReady
    ) {
      this.statusEl.textContent =
        'Big City 2 + Subaru loaded · G bonnet · F driver door';

      return;
    }

    if (
      this.streetCityReady
    ) {
      this.statusEl.textContent =
        'Big City 2 loaded · Loading Subaru...';

      return;
    }

    if (
      this.subaruReady
    ) {
      this.statusEl.textContent =
        'Subaru loaded · Loading Big City 2...';

      return;
    }

    this.statusEl.textContent =
      'Loading Big City 2 and Subaru...';
  }

  // ============================================================
  // INTERACTION PROMPT
  // ============================================================

  showInteractionPrompt(
    title,
    detail,
    key =
      'G'
  ) {
    if (
      !this.interactionPromptEl
    ) {
      return;
    }

    if (
      this.interactionKeyEl
    ) {
      this.interactionKeyEl
        .textContent =
          key;
    }

    if (
      this.interactionTitleEl
    ) {
      this.interactionTitleEl
        .textContent =
          title;
    }

    if (
      this.interactionDetailEl
    ) {
      this.interactionDetailEl
        .textContent =
          detail;
    }

    this.interactionPromptEl
      .classList
      .add(
        'visible'
      );
  }

  hideInteractionPrompt() {
    if (
      !this.interactionPromptEl
    ) {
      return;
    }

    this.interactionPromptEl
      .classList
      .remove(
        'visible'
      );
  }

  clearInteraction() {
    if (
      !this.bonnetSitting
    ) {
      this.currentInteraction =
        null;
    }

    this.hideInteractionPrompt();
  }

  // ============================================================
  // INPUT
  // ============================================================

  bindEvents() {
    this.keyDownHandler =
      (event) => {
        if (
          Object.prototype
            .hasOwnProperty
            .call(
              this.keys,
              event.code
            )
        ) {
          this.keys[
            event.code
          ] =
            true;
        }

        if (
          event.code ===
            'KeyG' &&
          !event.repeat
        ) {
          event.preventDefault();

          console.log(
            'G PRESSED:',
            {
              currentInteraction:
                this.currentInteraction,

              bonnetSitting:
                this.bonnetSitting,

              interactionBusy:
                this.interactionBusy
            }
          );

          this.handleInteract();
        }

        if (
          event.code ===
            'KeyF' &&
          !event.repeat
        ) {
          event.preventDefault();

          this.handleVehicleAction();
        }
      };

    this.keyUpHandler =
      (event) => {
        if (
          Object.prototype
            .hasOwnProperty
            .call(
              this.keys,
              event.code
            )
        ) {
          this.keys[
            event.code
          ] =
            false;
        }
      };

    window.addEventListener(
      'keydown',
      this.keyDownHandler
    );

    window.addEventListener(
      'keyup',
      this.keyUpHandler
    );
  }

  // ============================================================
  // COLLISION
  // ============================================================

  collidesAt(
    x,
    z
  ) {
    for (
      const box
      of this.boxColliders
    ) {
      if (
        x +
          this.PLAYER_RADIUS >
          box.minX &&

        x -
          this.PLAYER_RADIUS <
          box.maxX &&

        z +
          this.PLAYER_RADIUS >
          box.minZ &&

        z -
          this.PLAYER_RADIUS <
          box.maxZ
      ) {
        return true;
      }
    }

    for (
      const box
      of this.orientedBoxColliders
    ) {
      if (
        box.overlapsCircle(
          x,
          z,
          this.PLAYER_RADIUS
        )
      ) {
        return true;
      }
    }

    for (
      const circle
      of this.circleColliders
    ) {
      const dx =
        x -
        circle.x;

      const dz =
        z -
        circle.z;

      const radius =
        circle.radius +
        this.PLAYER_RADIUS;

      if (
        dx * dx +
          dz * dz <
        radius *
          radius
      ) {
        return true;
      }
    }

    return false;
  }

  // ============================================================
  // MOVE PLAYER
  // ============================================================

  movePlayer(
    dx,
    dz
  ) {
    if (
      !this.player ||
      this.bonnetSitting ||
      this.interactionBusy ||
      this.vehicleState !==
        'on-foot'
    ) {
      return;
    }

    const nextX =
      this.player.position.x +
      dx;

    if (
      !this.collidesAt(
        nextX,
        this.player.position.z
      )
    ) {
      this.player.position.x =
        nextX;
    }

    const nextZ =
      this.player.position.z +
      dz;

    if (
      !this.collidesAt(
        this.player.position.x,
        nextZ
      )
    ) {
      this.player.position.z =
        nextZ;
    }
  }

  // ============================================================
  // WORLD LIMIT
  // ============================================================

  constrainPlayerToWorld() {
    if (
      !this.player ||
      this.bonnetSitting ||
      this.vehicleState !==
        'on-foot'
    ) {
      return;
    }

    const x =
      this.player.position.x;

    const z =
      this.player.position.z;

    const distance =
      Math.sqrt(
        x * x +
        z * z
      );

    if (
      distance <=
      this.WORLD_LIMIT
    ) {
      return;
    }

    const scale =
      this.WORLD_LIMIT /
      distance;

    this.player.position.x *=
      scale;

    this.player.position.z *=
      scale;
  }

  // ============================================================
  // UPDATE PLAYER
  // ============================================================

  updatePlayer(
    dt
  ) {
    if (
      !this.player ||
      !this.player.isReady()
    ) {
      return;
    }

    if (
      this.bonnetSitting ||
      this.interactionBusy ||
      this.vehicleState !==
        'on-foot'
    ) {
      return;
    }

    const moving =
      this.keys.KeyW ||
      this.keys.KeyS;

    if (
      moving
    ) {
      this.player.startWalking();
    } else if (
      this.player.walking
    ) {
      this.player.stopWalking();
    }

    if (
      this.keys.KeyA
    ) {
      this.player.rotation.y +=
        this.TURN_SPEED *
        dt;
    }

    if (
      this.keys.KeyD
    ) {
      this.player.rotation.y -=
        this.TURN_SPEED *
        dt;
    }

    let movement =
      0;

    if (
      this.keys.KeyW
    ) {
      movement =
        this.WALK_SPEED *
        dt;
    }

    if (
      this.keys.KeyS
    ) {
      movement =
        -this.WALK_SPEED *
        dt;
    }

    if (
      movement !==
      0
    ) {
      const angle =
        this.player.rotation.y;

      const dx =
        Math.sin(
          angle
        ) *
        movement;

      const dz =
        Math.cos(
          angle
        ) *
        movement;

      this.movePlayer(
        dx,
        dz
      );
    }

    this.constrainPlayerToWorld();

    this.applyGrounding();
  }

  // ============================================================
  // CAMERA
  // ============================================================

  updateCamera() {
    if (
      !this.player ||
      !this.controls
    ) {
      return;
    }

    const delta =
      new THREE.Vector3()
        .subVectors(
          this.player.position,
          this.lastPlayerPosition
        );

    if (
      delta.lengthSq() >
      0.0000001
    ) {
      this.camera.position.add(
        delta
      );

      this.controls.target.add(
        delta
      );

      this.lastPlayerPosition.copy(
        this.player.position
      );
    }

    const target =
      new THREE.Vector3(
        this.player.position.x,

        this.player.position.y +
          1,

        this.player.position.z
      );

    this.controls.target.lerp(
      target,
      0.12
    );

    this.cameraCollisionDirection
      .subVectors(
        this.camera.position,
        target
      );

    const distance =
      this.cameraCollisionDirection
        .length();

    if (
      distance <=
        0.001 ||
      this.cameraCollisionObjects
        .length ===
        0
    ) {
      return;
    }

    this.cameraCollisionDirection
      .normalize();

    this.cameraCollisionRaycaster.set(
      target,
      this.cameraCollisionDirection
    );

    this.cameraCollisionRaycaster.near =
      0;

    this.cameraCollisionRaycaster.far =
      distance;

    const cameraCollisionTargets =
      this.vehicleState ===
        'driving'
        ?
        this.cameraCollisionObjects
          .filter(
            (object) =>
              object !==
              this.subaruRoot
          )
        :
        this.cameraCollisionObjects;

    const hits =
      this.cameraCollisionRaycaster
        .intersectObjects(
          cameraCollisionTargets,
          true
        );

    if (
      hits.length ===
      0
    ) {
      return;
    }

    const safeDistance =
      Math.max(
        1.15,

        hits[0].distance -
          0.3
      );

    this.cameraDesiredPosition
      .copy(
        this.cameraCollisionDirection
      )
      .multiplyScalar(
        safeDistance
      )
      .add(
        target
      );

    this.camera.position.lerp(
      this.cameraDesiredPosition,
      0.22
    );
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(
    dt
  ) {
    if (
      this.vehicleState ===
        'driving'
    ) {
      this.updateSubaruDriving(
        dt
      );
    } else {
      this.updatePlayer(
        dt
      );
    }

    if (
      this.player
    ) {
      this.player.update(
        dt
      );
    }

    this.updateInteraction();

    this.updateCamera();
  }

  // ============================================================
  // RESIZE
  // ============================================================

  resize() {
    const width =
      Math.max(
        1,
        window.innerWidth
      );

    const height =
      Math.max(
        1,
        window.innerHeight
      );

    this.camera.aspect =
      width /
      height;

    this.camera
      .updateProjectionMatrix();

    this.renderer.setSize(
      width,
      height
    );
  }

  // ============================================================
  // LOOP
  // ============================================================

  start() {
    if (
      this.running
    ) {
      return;
    }

    this.running =
      true;

    const loop =
      () => {
        if (
          !this.running
        ) {
          return;
        }

        this.rafId =
          requestAnimationFrame(
            loop
          );

        const dt =
          Math.min(
            this.clock.getDelta(),
            0.05
          );

        this.update(
          dt
        );

        this.controls.update();

        this.renderer.render(
          this.scene,
          this.camera
        );
      };

    loop();
  }

  // ============================================================
  // MATERIAL CLEANUP
  // ============================================================

  disposeMaterial(
    material
  ) {
    if (
      !material
    ) {
      return;
    }

    for (
      const value
      of Object.values(
        material
      )
    ) {
      if (
        value &&
        value.isTexture &&
        typeof value.dispose ===
          'function'
      ) {
        value.dispose();
      }
    }

    if (
      typeof material.dispose ===
        'function'
    ) {
      material.dispose();
    }
  }

  // ============================================================
  // OBJECT CLEANUP
  // ============================================================

  disposeObject3D(
    root
  ) {
    if (
      !root
    ) {
      return;
    }

    root.traverse(
      (object) => {
        if (
          object.geometry &&
          typeof object.geometry
            .dispose ===
            'function'
        ) {
          object.geometry.dispose();
        }

        if (
          Array.isArray(
            object.material
          )
        ) {
          for (
            const material
            of object.material
          ) {
            this.disposeMaterial(
              material
            );
          }
        } else if (
          object.material
        ) {
          this.disposeMaterial(
            object.material
          );
        }
      }
    );
  }

  // ============================================================
  // DISPOSE
  // ============================================================

  dispose() {
    if (
      this.disposed
    ) {
      return;
    }

    this.disposed =
      true;

    this.running =
      false;

    if (
      this.rafId !==
      null
    ) {
      cancelAnimationFrame(
        this.rafId
      );

      this.rafId =
        null;
    }

    window.removeEventListener(
      'resize',
      this.resizeHandler
    );

    window.removeEventListener(
      'keydown',
      this.keyDownHandler
    );

    window.removeEventListener(
      'keyup',
      this.keyUpHandler
    );

    if (
      this.player &&
      this.player.emoting
    ) {
      this.player.cancelEmote(
        false
      );
    }

    this.currentInteraction =
      null;

    this.bonnetSitting =
      false;

    this.interactionBusy =
      false;

    this.hideInteractionPrompt();

    if (
      this.controls
    ) {
      this.controls.dispose();
    }

    if (
      this.ui
    ) {
      this.ui.remove();

      this.ui =
        null;
    }

    if (
      this.styleEl
    ) {
      this.styleEl.remove();

      this.styleEl =
        null;
    }

    this.disposeObject3D(
      this.scene
    );

    if (
      this.renderer &&
      this.renderer.domElement &&
      this.renderer
        .domElement
        .parentNode
    ) {
      this.renderer
        .domElement
        .parentNode
        .removeChild(
          this.renderer.domElement
        );
    }

    if (
      this.renderer
    ) {
      this.renderer.dispose();
    }
  }
}