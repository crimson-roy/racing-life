import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class RaceSubaru extends THREE.Group {
  constructor(options = {}) {
    super();

    this.name = 'RaceSubaru';

    this.path =
      options.path ??
      '/assets/world/vehicles/subaru_wrx.glb';

    this.speed = 0;

    this.maxSpeed =
      options.maxSpeed ?? 22;

    this.maxReverseSpeed =
      options.maxReverseSpeed ?? 6;

    this.acceleration =
      options.acceleration ?? 8.5;

    this.brakePower =
      options.brakePower ?? 14;

    this.drag =
      options.drag ?? 3.1;

    this.turnRate =
      options.turnRate ??
      THREE.MathUtils.degToRad(72);

    this.ready = false;

    this.loader =
      new GLTFLoader();

    this.visualRoot =
      new THREE.Group();

    this.visualRoot.name =
      'RaceSubaruVisualRoot';

    this.add(
      this.visualRoot
    );

    this.localFrontDirection =
      new THREE.Vector3(
        0,
        0,
        1
      );

    this.wheelObjects = [];

    this.factionMarker = null;

    this.load();
  }

  load() {
    this.loader.load(
      this.path,

      (gltf) => {
        const model =
          gltf.scene;

        model.name =
          'RaceSubaruModel';

        model.traverse(
          (object) => {
            if (
              !object.isMesh
            ) {
              return;
            }

            object.castShadow =
              true;

            object.receiveShadow =
              true;
          }
        );

        this.visualRoot.add(
          model
        );

        // Find wheel nodes BEFORE orientation testing.
        // We use their vertical position to reject upside-down candidates.
        this.findWheels(
          model
        );

        this.normalizeOrientation(
          model
        );

        this.findFrontDirection(
          model
        );

        this.ready = true;

        console.log(
          'Racing Life: race Subaru ready.'
        );
      },

      undefined,

      (error) => {
        console.error(
          'Racing Life: race Subaru load failed.',
          error
        );
      }
    );
  }

  normalizeOrientation(model) {
    const candidates = [
      { x: 0, z: 0 },
      { x: Math.PI / 2, z: 0 },
      { x: -Math.PI / 2, z: 0 },
      { x: Math.PI, z: 0 },
      { x: 0, z: Math.PI / 2 },
      { x: 0, z: -Math.PI / 2 }
    ];

    let bestCandidate =
      candidates[0];

    let bestScore =
      Infinity;

    const size =
      new THREE.Vector3();

    const wheelWorld =
      new THREE.Vector3();

    for (
      const candidate
      of candidates
    ) {
      this.visualRoot.rotation.set(
        candidate.x,
        0,
        candidate.z
      );

      this.updateMatrixWorld(
        true
      );

      const box =
        new THREE.Box3()
          .setFromObject(
            model
          );

      box.getSize(
        size
      );

      let score =
        size.y *
        10;

      // Upright candidates should have the wheels close to the
      // bottom of the vehicle bounds. A 180° flipped candidate has
      // almost the same dimensions, so height alone cannot detect it.
      if (
        this.wheelObjects.length >
          0 &&
        size.y >
          0.001
      ) {
        let wheelYTotal =
          0;

        for (
          const wheel
          of this.wheelObjects
        ) {
          wheel.getWorldPosition(
            wheelWorld
          );

          wheelYTotal +=
            wheelWorld.y;
        }

        const averageWheelY =
          wheelYTotal /
          this.wheelObjects.length;

        const normalizedWheelHeight =
          (
            averageWheelY -
            box.min.y
          ) /
          size.y;

        score +=
          normalizedWheelHeight *
          8;
      }

      if (
        score <
        bestScore
      ) {
        bestScore =
          score;

        bestCandidate =
          candidate;
      }
    }

    this.visualRoot.rotation.set(
      bestCandidate.x,
      0,
      bestCandidate.z
    );

    this.visualRoot.position.set(
      0,
      0,
      0
    );

    this.updateMatrixWorld(
      true
    );

    let box =
      new THREE.Box3()
        .setFromObject(
          model
        );

    const center =
      box.getCenter(
        new THREE.Vector3()
      );

    this.visualRoot.position.x -=
      center.x;

    this.visualRoot.position.z -=
      center.z;

    this.updateMatrixWorld(
      true
    );

    box =
      new THREE.Box3()
        .setFromObject(
          model
        );

    this.visualRoot.position.y -=
      box.min.y;

    this.updateMatrixWorld(
      true
    );

    console.log(
      'RaceSubaru: orientation normalized.',
      {
        rotationX:
          THREE.MathUtils.radToDeg(
            this.visualRoot.rotation.x
          ),
        rotationZ:
          THREE.MathUtils.radToDeg(
            this.visualRoot.rotation.z
          ),
        wheels:
          this.wheelObjects.length
      }
    );
  }

  findFrontDirection(model) {
    let hoodAnchor =
      null;

    let trunkAnchor =
      null;

    model.traverse(
      (object) => {
        const name =
          String(
            object.name || ''
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

      this.localFrontDirection
        .subVectors(
          hoodWorld,
          trunkWorld
        );

      this.localFrontDirection.y =
        0;

      if (
        this.localFrontDirection
          .lengthSq() >
        0.001
      ) {
        this.localFrontDirection
          .normalize();

        return;
      }
    }

    this.localFrontDirection.set(
      0,
      0,
      1
    );
  }

  findWheels(model) {
    const wheels = [];

    model.traverse(
      (object) => {
        const name =
          String(
            object.name || ''
          );

        if (
          /Wheel1A_|Wheel Front|Wheel Rear/i.test(
            name
          )
        ) {
          wheels.push(
            object
          );
        }
      }
    );

    this.wheelObjects =
      wheels;
  }

  setFactionColor(color) {
    if (
      this.factionMarker
    ) {
      this.remove(
        this.factionMarker
      );

      this.factionMarker.geometry
        ?.dispose();

      this.factionMarker.material
        ?.dispose();
    }

    const marker =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.90,
          1.15,
          32
        ),

        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.48,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );

    marker.name =
      'FactionMarker';

    marker.rotation.x =
      -Math.PI / 2;

    marker.position.y =
      0.035;

    this.factionMarker =
      marker;

    this.add(
      marker
    );
  }

  getFrontDirection() {
    const direction =
      this.localFrontDirection
        .clone()
        .applyQuaternion(
          this.quaternion
        );

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

  drive(
    throttle,
    brake,
    steering,
    dt
  ) {
    if (
      throttle > 0
    ) {
      this.speed +=
        this.acceleration *
        throttle *
        dt;
    } else if (
      brake > 0
    ) {
      if (
        this.speed >
        0.4
      ) {
        this.speed -=
          this.brakePower *
          brake *
          dt;
      } else {
        this.speed -=
          this.acceleration *
          0.70 *
          brake *
          dt;
      }
    } else {
      const dragAmount =
        this.drag *
        dt;

      if (
        Math.abs(
          this.speed
        ) <=
        dragAmount
      ) {
        this.speed =
          0;
      } else {
        this.speed -=
          Math.sign(
            this.speed
          ) *
          dragAmount;
      }
    }

    this.speed =
      THREE.MathUtils.clamp(
        this.speed,
        -this.maxReverseSpeed,
        this.maxSpeed
      );

    const absSpeed =
      Math.abs(
        this.speed
      );

    if (
      steering !==
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
        this.speed >=
        0
          ? 1
          : -1;

      this.rotation.y -=
        steering *
        this.turnRate *
        speedFactor *
        reverseFactor *
        dt;
    }

    const front =
      this.getFrontDirection();

    this.position
      .addScaledVector(
        front,
        this.speed *
          dt
      );

    this.updateMatrixWorld(
      true
    );
  }
}
