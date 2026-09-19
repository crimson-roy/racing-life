import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { RaceSubaru } from '../vehicles/RaceSubaru.js';
import { getTrack } from '../racing/TrackRegistry.js';
import { getFaction } from '../racing/Factions.js';

export class RaceScene3D {
  constructor(options = {}) {
    this.container = options.container ?? document.body;
    this.session = options.session ?? {
      raceNumber: 1,
      trackId: 'barcelona',
      factionA: 'azure',
      factionB: 'crimson',
      scoreA: 0,
      scoreB: 0
    };

    this.onExit = options.onExit ?? (() => {});

    this.running = false;
    this.disposed = false;
    this.rafId = null;
    this.lastTime = performance.now();

    this.keys = new Set();
    this.trackRoot = null;
    this.trackBounds = null;
    this.playableBounds = null;
    this.trackSurfaceObjects = [];
    this.playableMeshCenters = [];

    // Static obstacle collision generated from the imported venue.
    // These are lightweight world-space AABBs for buildings, barriers,
    // poles, walls, trees, etc. Roads/ground/background are excluded.
    this.solidColliders = [];
    this.PLAYER_COLLISION_RADIUS = 0.95;
    this.PLAYER_COLLISION_HEIGHT = 1.45;
    this.denseOverviewCenter = null;
    this.denseOverviewRadius = null;

    // Development setup mode: show the entire imported venue first.
    // This prevents the camera from spawning somewhere useless before
    // we know the real start-grid coordinates of each downloaded track.
    this.setupMode = true;
    this.trackSize = new THREE.Vector3();
    this.trackCenter = new THREE.Vector3();

    this.trackRaycaster = new THREE.Raycaster();
    this.trackRayOrigin = new THREE.Vector3();
    this.trackRayDirection = new THREE.Vector3(0, -1, 0);

    this.pointerRaycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();

    this.lastValidPlayerPosition =
      new THREE.Vector3();

    this.lastValidPlayerRotationY =
      0;

    this.collisionStatusUntil =
      0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8eb8ce);

    // Keep a reusable driving fog, but disable it while we are in
    // track-overview setup mode. Some downloaded circuits are several
    // kilometres wide, so a fixed 5,000-unit fog distance can hide the
    // entire venue even though the GLB loaded correctly.
    this.drivingFog = new THREE.Fog(
      0x8eb8ce,
      500,
      5000
    );

    this.scene.fog = null;

    this.camera = new THREE.PerspectiveCamera(
      58,
      Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
      0.1,
      8000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    Object.assign(
      this.renderer.domElement.style,
      {
        position: 'fixed',
        inset: '0',
        zIndex: '30',
        width: '100%',
        height: '100%'
      }
    );

    this.container.appendChild(
      this.renderer.domElement
    );

    this.controls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );

    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    // Setup camera should feel like a map/editor camera:
    // - wheel zooms toward the mouse cursor, not the old water-center target
    // - right-drag pans freely
    // - left-drag orbits
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.controls.zoomSpeed = 1.15;
    this.controls.panSpeed = 1.0;
    this.controls.rotateSpeed = 0.65;

    this.controls.minDistance = 3;
    this.controls.maxDistance = 20000;

    this.controls.mouseButtons.LEFT =
      THREE.MOUSE.ROTATE;

    this.controls.mouseButtons.MIDDLE =
      THREE.MOUSE.DOLLY;

    this.controls.mouseButtons.RIGHT =
      THREE.MOUSE.PAN;

    this.controls.enabled = true;

    this.loader = new GLTFLoader();

    this.setupLights();
    this.createCars();
    this.createOverlay();
    this.bindEvents();
    this.loadTrack();
    this.start();
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(
      0xffffff,
      0x25303a,
      2.1
    );

    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(
      0xffffff,
      2.6
    );

    sun.position.set(120, 220, 90);
    sun.castShadow = true;

    this.scene.add(sun);
  }

  createCars() {
    const factionA = getFaction(
      this.session.factionA
    );

    const factionB = getFaction(
      this.session.factionB
    );

    this.playerCar = new RaceSubaru({
      maxSpeed: 22,
      acceleration: 8.8,
      brakePower: 14,
      turnRate:
        THREE.MathUtils.degToRad(
          72
        )
    });

    this.opponentCar = new RaceSubaru({
      maxSpeed: 21,
      acceleration: 8.4,
      brakePower: 13.5,
      turnRate:
        THREE.MathUtils.degToRad(
          70
        )
    });

    this.tintVehicle(
      this.playerCar,
      factionA
    );

    this.tintVehicle(
      this.opponentCar,
      factionB
    );

    this.scene.add(
      this.playerCar,
      this.opponentCar
    );
  }

  tintVehicle(vehicle, faction) {
    if (!vehicle) return;

    vehicle.setFactionColor(
      faction.primary
    );
  }

  createOverlay() {
    const factionA = getFaction(
      this.session.factionA
    );

    const factionB = getFaction(
      this.session.factionB
    );

    const track = getTrack(
      this.session.trackId
    );

    this.ui = document.createElement('div');

    Object.assign(
      this.ui.style,
      {
        position: 'fixed',
        inset: '0',
        zIndex: '31',
        pointerEvents: 'none',
        color: '#fff',
        fontFamily:
          'Inter, system-ui, sans-serif'
      }
    );

    this.ui.innerHTML = `
      <div style="
        position:absolute;
        top:18px;
        left:50%;
        transform:translateX(-50%);
        min-width:340px;
        padding:12px 18px;
        border-radius:14px;
        background:rgba(7,10,14,.78);
        text-align:center;
        border:1px solid rgba(255,255,255,.12);
      ">
        <div style="
          font-size:12px;
          opacity:.7;
          letter-spacing:.16em;
        ">
          FACTION MATCH · RACE ${this.session.raceNumber}
        </div>

        <div style="
          display:flex;
          align-items:center;
          justify-content:center;
          gap:14px;
          margin-top:6px;
          font-weight:800;
          font-size:18px;
        ">
          <span style="color:#${factionA.primary.toString(16).padStart(6, '0')}">
            ${factionA.name}
          </span>

          <span>
            ${this.session.scoreA} - ${this.session.scoreB}
          </span>

          <span style="color:#${factionB.primary.toString(16).padStart(6, '0')}">
            ${factionB.name}
          </span>
        </div>

        <div style="
          margin-top:4px;
          font-size:13px;
          opacity:.8;
        ">
          ${track.name}
        </div>
      </div>

      <div style="
        position:absolute;
        left:18px;
        bottom:18px;
        max-width:390px;
        padding:12px 14px;
        border-radius:12px;
        background:rgba(7,10,14,.78);
        border:1px solid rgba(255,255,255,.12);
        font-size:13px;
        line-height:1.55;
      ">
        <strong>Subaru Race Test</strong><br>
        <strong>SETUP:</strong> wheel = zoom toward cursor · left-drag = orbit · right-drag = pan<br>
        Double-click the road = place cars there · P = place at screen center<br>
        F refocus track · C toggle overview/driving · G save grid · R reset<br>
        <strong>DRIVE:</strong> W/S accelerate & reverse · A/D steer · ground + object collision ON<br>
        Esc return home
        <div id="race-debug-status" style="
          margin-top:6px;
          opacity:.72;
        ">
          Loading track…
        </div>
      </div>
    `;

    this.container.appendChild(
      this.ui
    );

    this.statusElement =
      this.ui.querySelector(
        '#race-debug-status'
      );
  }

  bindEvents() {
    this.handleKeyDown =
      (event) => {
        if (event.repeat) return;

        this.keys.add(
          event.code
        );

        if (event.code === 'Escape') {
          this.onExit();
        }

        if (event.code === 'KeyR') {
          this.resetCarsToGrid();
        }

        if (event.code === 'KeyG') {
          this.saveGridFromPlayer();
        }

        if (event.code === 'KeyP') {
          this.placeGridFromCameraRay(
            0,
            0
          );
        }

        if (event.code === 'KeyC') {
          this.toggleSetupMode();
        }

        if (event.code === 'KeyF') {
          this.frameTrackOverview();
        }
      };

    this.handleKeyUp =
      (event) => {
        this.keys.delete(
          event.code
        );
      };

    this.handleDoubleClick =
      (event) => {
        if (
          !this.setupMode ||
          !this.trackRoot
        ) {
          return;
        }

        const rect =
          this.renderer.domElement
            .getBoundingClientRect();

        const x =
          (
            (
              event.clientX -
              rect.left
            ) /
            Math.max(
              1,
              rect.width
            )
          ) *
            2 -
          1;

        const y =
          -(
            (
              event.clientY -
              rect.top
            ) /
            Math.max(
              1,
              rect.height
            )
          ) *
            2 +
          1;

        this.placeGridFromCameraRay(
          x,
          y
        );
      };

    this.handleResize =
      () => {
        this.camera.aspect =
          Math.max(
            1,
            window.innerWidth
          ) /
          Math.max(
            1,
            window.innerHeight
          );

        this.camera
          .updateProjectionMatrix();

        this.renderer.setSize(
          window.innerWidth,
          window.innerHeight
        );
      };

    window.addEventListener(
      'keydown',
      this.handleKeyDown
    );

    window.addEventListener(
      'keyup',
      this.handleKeyUp
    );

    window.addEventListener(
      'resize',
      this.handleResize
    );

    this.renderer.domElement
      .addEventListener(
        'dblclick',
        this.handleDoubleClick
      );
  }

  loadTrack() {
    const track = getTrack(
      this.session.trackId
    );

    this.setStatus(
      `Loading ${track.name}…`
    );

    this.loader.load(
      track.path,

      (gltf) => {
        if (this.disposed) {
          return;
        }

        this.trackRoot = gltf.scene;

        this.trackRoot.traverse(
          (object) => {
            if (!object.isMesh) return;

            object.receiveShadow = true;
            object.castShadow = false;
          }
        );

        this.scene.add(
          this.trackRoot
        );

        this.trackRoot
          .updateMatrixWorld(true);

        this.trackBounds =
          new THREE.Box3()
            .setFromObject(
              this.trackRoot
            );

        this.analyzePlayableGeometry();
        this.buildStaticColliders();

        const activeBounds =
          this.playableBounds ??
          this.trackBounds;

        const size =
          activeBounds.getSize(
            new THREE.Vector3()
          );

        const center =
          activeBounds.getCenter(
            new THREE.Vector3()
          );

        this.trackSize.copy(
          size
        );

        this.trackCenter.copy(
          center
        );

        console.log(
          'RaceScene3D: track loaded.',
          {
            track: track.name,
            path: track.path,
            center: {
              x: center.x,
              y: center.y,
              z: center.z
            },
            size: {
              x: size.x,
              y: size.y,
              z: size.z
            },
            fullMin: {
              x: this.trackBounds.min.x,
              y: this.trackBounds.min.y,
              z: this.trackBounds.min.z
            },
            fullMax: {
              x: this.trackBounds.max.x,
              y: this.trackBounds.max.y,
              z: this.trackBounds.max.z
            },
            playableMin: this.playableBounds
              ? {
                  x: this.playableBounds.min.x,
                  y: this.playableBounds.min.y,
                  z: this.playableBounds.min.z
                }
              : null,
            playableMax: this.playableBounds
              ? {
                  x: this.playableBounds.max.x,
                  y: this.playableBounds.max.y,
                  z: this.playableBounds.max.z
                }
              : null
          }
        );

        this.applyInitialGrid(
          center,
          size
        );

        this.frameTrackOverview();

        this.setStatus(
          `Loaded ${track.name} · ${size.x.toFixed(1)} × ${size.z.toFixed(1)} · P place grid · C drive`
        );
      },

      (event) => {
        if (
          !event.total ||
          !this.statusElement
        ) {
          return;
        }

        const percent =
          Math.round(
            (event.loaded /
              event.total) *
              100
          );

        this.setStatus(
          `Loading track… ${percent}%`
        );
      },

      (error) => {
        console.error(
          'RaceScene3D: failed to load track:',
          error
        );

        this.setStatus(
          `Could not load ${track.path}. Put the GLB in public/assets/tracks/.`
        );

        this.applyInitialGrid(
          new THREE.Vector3(),
          new THREE.Vector3(
            40,
            1,
            80
          )
        );
      }
    );
  }

  analyzePlayableGeometry() {
    if (
      !this.trackRoot ||
      !this.trackBounds ||
      this.trackBounds.isEmpty()
    ) {
      return;
    }

    const fullSize =
      this.trackBounds.getSize(
        new THREE.Vector3()
      );

    const candidates = [];
    const excluded = [];

    this.trackRoot.traverse(
      (object) => {
        if (!object.isMesh) {
          return;
        }

        const box =
          new THREE.Box3()
            .setFromObject(
              object
            );

        if (box.isEmpty()) {
          return;
        }

        const size =
          box.getSize(
            new THREE.Vector3()
          );

        const coversMostOfMap =
          size.x >=
            fullSize.x * 0.72 &&
          size.z >=
            fullSize.z * 0.72;

        if (coversMostOfMap) {
          excluded.push({
            name:
              object.name ||
              '(unnamed mesh)',
            x:
              Number(
                size.x.toFixed(1)
              ),
            y:
              Number(
                size.y.toFixed(1)
              ),
            z:
              Number(
                size.z.toFixed(1)
              )
          });

          return;
        }

        candidates.push({
          object,
          box,
          center:
            box.getCenter(
              new THREE.Vector3()
            )
        });
      }
    );

    if (
      candidates.length ===
      0
    ) {
      this.playableBounds =
        this.trackBounds.clone();

      this.trackSurfaceObjects =
        [];

      return;
    }

    const playable =
      new THREE.Box3();

    playable.makeEmpty();

    for (
      const candidate
      of candidates
    ) {
      playable.union(
        candidate.box
      );
    }

    const playableSize =
      playable.getSize(
        new THREE.Vector3()
      );

    const usable =
      !playable.isEmpty() &&
      playableSize.x >
        fullSize.x * 0.05 &&
      playableSize.z >
        fullSize.z * 0.05;

    this.playableBounds =
      usable
        ? playable
        : this.trackBounds.clone();

    this.trackSurfaceObjects =
      usable
        ? candidates.map(
            (entry) =>
              entry.object
          )
        : [];

    this.playableMeshCenters =
      usable
        ? candidates.map(
            (entry) =>
              entry.center.clone()
          )
        : [];

    this.computeDenseOverview();

    console.log(
      'RaceScene3D: excluded huge background meshes from setup bounds.',
      excluded
    );

    console.log(
      'RaceScene3D: playable geometry meshes:',
      this.trackSurfaceObjects.length
    );
  }

  getMeshDescriptor(object) {
    const materialNames =
      (
        Array.isArray(
          object?.material
        )
          ? object.material
          : [
              object?.material
            ]
      )
        .map(
          (material) =>
            String(
              material?.name ||
              ''
            )
        )
        .join(
          ' '
        );

    return `${object?.name || ''} ${materialNames}`
      .toLowerCase();
  }

  isDriveableLikeMesh(
    object,
    size
  ) {
    const descriptor =
      this.getMeshDescriptor(
        object
      );

    if (
      /road|street|asphalt|tarmac|ground|floor|track|lane|crosswalk|pavement|sidewalk|terrain|landscape|grass|sand|dirt|soil|water|sea|ocean|sky|cloud|background|dome/.test(
        descriptor
      )
    ) {
      return true;
    }

    // Very flat meshes are normally ground/road decals, not solid walls.
    return size.y <
      0.38;
  }

  shouldUseAsSolidCollider(
    object,
    box,
    fullSize
  ) {
    if (
      !object?.isMesh ||
      !box ||
      box.isEmpty() ||
      this.isBackgroundLikeMesh(
        object
      )
    ) {
      return false;
    }

    const size =
      box.getSize(
        new THREE.Vector3()
      );

    if (
      this.isDriveableLikeMesh(
        object,
        size
      )
    ) {
      return false;
    }

    // Ignore enormous scenery chunks/mountains. Their AABBs can cover
    // roads even when the real triangles do not.
    const tooWide =
      size.x >
        fullSize.x * 0.16 ||
      size.z >
        fullSize.z * 0.16;

    if (tooWide) {
      return false;
    }

    const descriptor =
      this.getMeshDescriptor(
        object
      );

    const explicitObstacle =
      /building|house|wall|barrier|guard|rail|fence|tree|pole|lamp|light|sign|bollard|gate|garage|stand|grandstand|bridge|column|pillar|container|crate/.test(
        descriptor
      );

    // Unknown meshes still become colliders if they have meaningful height.
    // This catches oddly named imported buildings without hardcoding Barcelona.
    const tallEnough =
      size.y >=
        0.85;

    return explicitObstacle ||
      tallEnough;
  }

  buildStaticColliders() {
    this.solidColliders = [];

    if (
      !this.trackRoot ||
      !this.trackBounds
    ) {
      return;
    }

    const fullSize =
      this.trackBounds.getSize(
        new THREE.Vector3()
      );

    const names = [];

    this.trackRoot.traverse(
      (object) => {
        if (!object.isMesh) {
          return;
        }

        const box =
          new THREE.Box3()
            .setFromObject(
              object
            );

        if (
          !this.shouldUseAsSolidCollider(
            object,
            box,
            fullSize
          )
        ) {
          return;
        }

        // Expand a tiny amount so thin walls/rails are not easy to tunnel through.
        box.expandByScalar(
          0.08
        );

        this.solidColliders.push({
          object,
          box
        });

        if (
          names.length <
          30
        ) {
          names.push(
            object.name ||
            '(unnamed)'
          );
        }
      }
    );

    console.log(
      'RaceScene3D: static object colliders built.',
      {
        count:
          this.solidColliders.length,
        examples:
          names
      }
    );
  }

  circleOverlapsBoxXZ(
    x,
    z,
    radius,
    box
  ) {
    const closestX =
      THREE.MathUtils.clamp(
        x,
        box.min.x,
        box.max.x
      );

    const closestZ =
      THREE.MathUtils.clamp(
        z,
        box.min.z,
        box.max.z
      );

    const dx =
      x -
      closestX;

    const dz =
      z -
      closestZ;

    return (
      dx * dx +
      dz * dz
    ) <=
      radius * radius;
  }

  getCarObjectCollision(
    car
  ) {
    if (
      !car ||
      this.solidColliders.length ===
        0
    ) {
      return null;
    }

    const carBottom =
      car.position.y +
      0.08;

    const carTop =
      carBottom +
      this.PLAYER_COLLISION_HEIGHT;

    for (
      const collider
      of this.solidColliders
    ) {
      const box =
        collider.box;

      // Cheap Y rejection first.
      if (
        box.max.y <
          carBottom ||
        box.min.y >
          carTop
      ) {
        continue;
      }

      if (
        !this.circleOverlapsBoxXZ(
          car.position.x,
          car.position.z,
          this.PLAYER_COLLISION_RADIUS,
          box
        )
      ) {
        continue;
      }

      return collider;
    }

    return null;
  }

  computeDenseOverview() {
    if (
      this.playableMeshCenters.length <
      6
    ) {
      this.denseOverviewCenter =
        null;

      this.denseOverviewRadius =
        null;

      return;
    }

    const xs =
      this.playableMeshCenters
        .map(
          (point) =>
            point.x
        )
        .sort(
          (a, b) =>
            a - b
        );

    const zs =
      this.playableMeshCenters
        .map(
          (point) =>
            point.z
        )
        .sort(
          (a, b) =>
            a - b
        );

    const median = (
      values
    ) => {
      const middle =
        Math.floor(
          values.length /
          2
        );

      return values.length %
        2 ===
        0
        ? (
            values[
              middle - 1
            ] +
            values[
              middle
            ]
          ) /
            2
        : values[
            middle
          ];
    };

    const centerX =
      median(
        xs
      );

    const centerZ =
      median(
        zs
      );

    const distances =
      this.playableMeshCenters
        .map(
          (point) =>
            Math.hypot(
              point.x -
                centerX,
              point.z -
                centerZ
            )
        )
        .sort(
          (a, b) =>
            a - b
        );

    const percentileIndex =
      Math.min(
        distances.length -
          1,
        Math.floor(
          distances.length *
            0.62
        )
      );

    const clusterRadius =
      Math.max(
        220,
        distances[
          percentileIndex
        ] *
          1.15
      );

    const closePoints =
      this.playableMeshCenters
        .filter(
          (point) =>
            Math.hypot(
              point.x -
                centerX,
              point.z -
                centerZ
            ) <=
            clusterRadius
        );

    const centerY =
      closePoints.length >
        0
        ? closePoints.reduce(
            (
              total,
              point
            ) =>
              total +
              point.y,
            0
          ) /
          closePoints.length
        : this.trackCenter.y;

    this.denseOverviewCenter =
      new THREE.Vector3(
        centerX,
        centerY,
        centerZ
      );

    this.denseOverviewRadius =
      clusterRadius;

    console.log(
      'RaceScene3D: dense overview.',
      {
        center: {
          x:
            centerX.toFixed(
              1
            ),
          y:
            centerY.toFixed(
              1
            ),
          z:
            centerZ.toFixed(
              1
            )
        },
        radius:
          clusterRadius.toFixed(
            1
          ),
        meshes:
          closePoints.length
      }
    );
  }

  frameTrackOverview() {
    const bounds =
      this.playableBounds ??
      this.trackBounds;

    if (
      !bounds ||
      bounds.isEmpty()
    ) {
      return;
    }

    const boundsCenter =
      bounds.getCenter(
        new THREE.Vector3()
      );

    const size =
      bounds.getSize(
        new THREE.Vector3()
      );

    const fullRadius =
      Math.max(
        size.x,
        size.y,
        size.z,
        20
      );

    const center =
      this.denseOverviewCenter
        ? this.denseOverviewCenter
            .clone()
        : boundsCenter;

    const radius =
      this.denseOverviewRadius
        ? Math.max(
            220,
            Math.min(
              this.denseOverviewRadius,
              fullRadius *
                0.32
            )
          )
        : fullRadius *
            0.24;

    this.camera.near =
      Math.max(
        0.1,
        radius / 10000
      );

    this.camera.far =
      Math.max(
        8000,
        radius * 10
      );

    this.camera
      .updateProjectionMatrix();

    this.controls.target.copy(
      center
    );

    // Focus on the dense cluster of track/city meshes rather than
    // the whole mountain/coast environment.
    const horizontalDistance =
      Math.max(
        170,
        radius * 0.95
      );

    const verticalDistance =
      Math.max(
        120,
        radius * 0.58
      );

    this.camera.position.set(
      center.x + horizontalDistance,
      center.y + verticalDistance,
      center.z + horizontalDistance
    );

    this.camera.lookAt(
      center
    );

    this.controls.enabled =
      true;

    // Overview must stay clear regardless of map size.
    this.scene.fog =
      null;

    this.controls.update();

    this.setupMode =
      true;
  }

  toggleSetupMode() {
    if (!this.trackRoot) {
      return;
    }

    this.setupMode =
      !this.setupMode;

    this.controls.enabled =
      this.setupMode;

    if (this.setupMode) {
      this.frameTrackOverview();

      this.setStatus(
        'Overview mode · orbit/pan with mouse · P places grid at view target'
      );
    } else {
      const mapRadius =
        Math.max(
          this.trackSize.x,
          this.trackSize.z,
          100
        );

      this.drivingFog.near =
        Math.max(
          500,
          mapRadius * 0.10
        );

      this.drivingFog.far =
        Math.max(
          5000,
          mapRadius * 1.75
        );

      this.scene.fog =
        this.drivingFog;

      this.updateCamera(
        true
      );

      this.setStatus(
        'Driving mode · W/S drive · A/D steer · C returns to overview'
      );
    }
  }

  isBackgroundLikeMesh(object) {
    if (!object) {
      return false;
    }

    const materialNames =
      (
        Array.isArray(
          object.material
        )
          ? object.material
          : [
              object.material
            ]
      )
        .map(
          (material) =>
            String(
              material?.name ||
              ''
            )
        )
        .join(
          ' '
        );

    const descriptor =
      `${object.name || ''} ${materialNames}`
        .toLowerCase();

    return /sky|cloud|water|sea|ocean|background|dome/.test(
      descriptor
    );
  }

  choosePlacementHit(hits) {
    if (
      !hits ||
      hits.length ===
        0
    ) {
      return null;
    }

    const normalWorld =
      new THREE.Vector3();

    const usable =
      hits.filter(
        (hit) => {
          if (
            this.isBackgroundLikeMesh(
              hit.object
            )
          ) {
            return false;
          }

          if (
            !hit.face
          ) {
            return true;
          }

          normalWorld
            .copy(
              hit.face.normal
            )
            .transformDirection(
              hit.object.matrixWorld
            );

          // Reject near-vertical walls for car placement.
          return normalWorld.y >
            0.30;
        }
      );

    return usable[0] ??
      hits.find(
        (hit) =>
          !this.isBackgroundLikeMesh(
            hit.object
          )
      ) ??
      null;
  }

  placeGridFromCameraRay(
    ndcX,
    ndcY
  ) {
    if (
      !this.trackRoot
    ) {
      return;
    }

    this.pointerNdc.set(
      ndcX,
      ndcY
    );

    this.pointerRaycaster
      .setFromCamera(
        this.pointerNdc,
        this.camera
      );

    // Always raycast the complete imported hierarchy recursively.
    // Some downloaded tracks wrap road meshes inside nested groups, so
    // raycasting only our filtered mesh list can miss visible road pieces.
    const hits =
      this.pointerRaycaster
        .intersectObject(
          this.trackRoot,
          true
        );

    const hit =
      this.choosePlacementHit(
        hits
      );

    if (!hit) {
      console.warn(
        'RaceScene3D: pointer ray hit nothing usable.',
        {
          totalHits:
            hits.length,
          hitNames:
            hits
              .slice(
                0,
                12
              )
              .map(
                (entry) =>
                  entry.object?.name ||
                  '(unnamed)'
              )
        }
      );

      this.setStatus(
        'No usable road surface there. Double-click directly on the visible road.'
      );

      return;
    }

    console.log(
      'RaceScene3D: grid surface selected.',
      {
        object:
          hit.object?.name ||
          '(unnamed)',
        point: {
          x:
            hit.point.x.toFixed(
              2
            ),
          y:
            hit.point.y.toFixed(
              2
            ),
          z:
            hit.point.z.toFixed(
              2
            )
        }
      }
    );

    const cameraDirection =
      this.camera.getWorldDirection(
        new THREE.Vector3()
      );

    cameraDirection.y =
      0;

    if (
      cameraDirection.lengthSq() <
      0.0001
    ) {
      cameraDirection.set(
        0,
        0,
        1
      );
    }

    cameraDirection.normalize();

    const spawn = {
      x:
        hit.point.x,
      y:
        hit.point.y +
        0.04,
      z:
        hit.point.z,
      yaw:
        Math.atan2(
          cameraDirection.x,
          cameraDirection.z
        )
    };

    this.setCarsFromSpawn(
      spawn
    );

    this.controls.target.copy(
      hit.point
    );

    this.controls.update();

    this.setStatus(
      `Grid preview on ${hit.object?.name || 'track surface'} · X ${spawn.x.toFixed(1)} Z ${spawn.z.toFixed(1)} · G saves`
    );
  }

  findGroundHitForCar(
    car
  ) {
    if (
      !car ||
      !this.trackRoot
    ) {
      return null;
    }

    const rayHeight =
      18;

    this.trackRayOrigin.set(
      car.position.x,
      car.position.y +
        rayHeight,
      car.position.z
    );

    this.trackRaycaster.set(
      this.trackRayOrigin,
      this.trackRayDirection
    );

    this.trackRaycaster.near =
      0;

    this.trackRaycaster.far =
      45;

    const hits =
      this.trackRaycaster
        .intersectObject(
          this.trackRoot,
          true
        );

    const candidates =
      hits.filter(
        (hit) => {
          if (
            this.isBackgroundLikeMesh(
              hit.object
            )
          ) {
            return false;
          }

          if (!hit.face) {
            return true;
          }

          const normal =
            hit.face.normal
              .clone()
              .transformDirection(
                hit.object.matrixWorld
              );

          return normal.y >
            0.25;
        }
      );

    if (
      candidates.length ===
        0
    ) {
      return null;
    }

    let best =
      candidates[0];

    let bestDelta =
      Math.abs(
        best.point.y -
        car.position.y
      );

    for (
      const hit
      of candidates
    ) {
      const delta =
        Math.abs(
          hit.point.y -
          car.position.y
        );

      if (
        delta <
        bestDelta
      ) {
        best =
          hit;

        bestDelta =
          delta;
      }
    }

    return best;
  }

  snapCarToSurface(
    car
  ) {
    const hit =
      this.findGroundHitForCar(
        car
      );

    if (!hit) {
      return false;
    }

    car.position.y =
      hit.point.y +
      0.035;

    return true;
  }

  setCarsFromSpawn(spawn) {
    const right =
      new THREE.Vector3(
        1,
        0,
        0
      ).applyAxisAngle(
        new THREE.Vector3(
          0,
          1,
          0
        ),
        spawn.yaw
      );

    this.playerCar.position.set(
      spawn.x,
      spawn.y,
      spawn.z
    );

    this.playerCar.position
      .addScaledVector(
        right,
        -2.1
      );

    this.playerCar.rotation.y =
      spawn.yaw;

    this.opponentCar.position.set(
      spawn.x,
      spawn.y,
      spawn.z
    );

    this.opponentCar.position
      .addScaledVector(
        right,
        2.1
      );

    this.opponentCar.rotation.y =
      spawn.yaw;

    this.playerCar.speed = 0;
    this.opponentCar.speed = 0;

    this.snapCarToSurface(
      this.playerCar
    );

    this.snapCarToSurface(
      this.opponentCar
    );

    this.lastValidPlayerPosition
      .copy(
        this.playerCar.position
      );

    this.lastValidPlayerRotationY =
      this.playerCar.rotation.y;
  }

  applyInitialGrid(center, size) {
    const saved =
      this.loadSavedGrid();

    const spawn = saved ?? {
      x: center.x,
      y:
        this.playableBounds
          ? this.playableBounds.min.y + 1
          : this.trackBounds
            ? this.trackBounds.min.y + 1
            : center.y + Math.max(0.6, size.y * 0.02),
      z: center.z,
      yaw: 0
    };

    this.setCarsFromSpawn(
      spawn
    );

    if (
      !this.setupMode
    ) {
      this.updateCamera(
        true
      );
    }
  }

  saveGridFromPlayer() {
    const midpoint =
      this.playerCar.position
        .clone()
        .add(
          this.opponentCar.position
        )
        .multiplyScalar(
          0.5
        );

    const value = {
      x:
        midpoint.x,
      y:
        midpoint.y,
      z:
        midpoint.z,
      yaw:
        this.playerCar.rotation.y
    };

    localStorage.setItem(
      `racingLifeGrid:v2:${this.session.trackId}`,
      JSON.stringify(value)
    );

    this.setStatus(
      'Grid saved for this track.'
    );
  }

  loadSavedGrid() {
    try {
      return JSON.parse(
        localStorage.getItem(
          `racingLifeGrid:v2:${this.session.trackId}`
        ) || 'null'
      );
    } catch {
      return null;
    }
  }

  resetCarsToGrid() {
    const center =
      this.trackBounds
        ? this.trackBounds.getCenter(
            new THREE.Vector3()
          )
        : new THREE.Vector3();

    const size =
      this.trackBounds
        ? this.trackBounds.getSize(
            new THREE.Vector3()
          )
        : new THREE.Vector3(
            40,
            1,
            80
          );

    this.applyInitialGrid(
      center,
      size
    );
  }

  readPlayerControls() {
    const throttle =
      this.keys.has('KeyW') ||
      this.keys.has('ArrowUp')
        ? 1
        : 0;

    const brake =
      this.keys.has('KeyS') ||
      this.keys.has('ArrowDown')
        ? 1
        : 0;

    let steering = 0;

    if (
      this.keys.has('KeyA') ||
      this.keys.has('ArrowLeft')
    ) {
      steering -= 1;
    }

    if (
      this.keys.has('KeyD') ||
      this.keys.has('ArrowRight')
    ) {
      steering += 1;
    }

    return {
      throttle,
      brake,
      steering
    };
  }

  updateCamera(force = false) {
    if (!this.playerCar) return;

    const target =
      this.playerCar.position
        .clone()
        .add(
          new THREE.Vector3(
            0,
            1.1,
            0
          )
        );

    const behind =
      new THREE.Vector3(
        0,
        4.6,
        -9.5
      )
        .applyQuaternion(
          this.playerCar.quaternion
        )
        .add(
          this.playerCar.position
        );

    if (force) {
      this.camera.position.copy(
        behind
      );
    } else {
      this.camera.position.lerp(
        behind,
        0.12
      );
    }

    this.camera.lookAt(
      target
    );
  }

  readStatus() {
    if (
      !this.playerCar ||
      !this.trackRoot
    ) {
      return;
    }

    if (
      performance.now() <
      this.collisionStatusUntil
    ) {
      return;
    }

    const speed =
      Math.abs(
        this.playerCar.speed ?? 0
      );

    this.setStatus(
      `Speed ${speed.toFixed(1)} · G saves grid · R resets`
    );
  }

  setStatus(text) {
    if (
      this.statusElement
    ) {
      this.statusElement.textContent =
        text;
    }
  }

  start() {
    if (this.running) return;

    this.running = true;

    const tick =
      (time) => {
        if (
          !this.running ||
          this.disposed
        ) {
          return;
        }

        const dt =
          Math.min(
            0.05,
            Math.max(
              0,
              (time -
                this.lastTime) /
                1000
            )
          );

        this.lastTime = time;

        const input =
          this.readPlayerControls();

        if (!this.setupMode) {
          const beforeMove =
            this.playerCar.position
              .clone();

          const beforeRotation =
            this.playerCar.rotation.y;

          this.playerCar.drive(
            input.throttle,
            input.brake,
            input.steering,
            dt
          );

          const grounded =
            this.snapCarToSurface(
              this.playerCar
            );

          const objectCollision =
            grounded
              ? this.getCarObjectCollision(
                  this.playerCar
                )
              : null;

          if (
            !grounded ||
            objectCollision
          ) {
            this.playerCar.position
              .copy(
                beforeMove
              );

            this.playerCar.rotation.y =
              beforeRotation;

            this.playerCar.speed =
              0;

            if (
              objectCollision &&
              this.statusElement
            ) {
              this.collisionStatusUntil =
                performance.now() +
                500;

              this.setStatus(
                `Collision: ${objectCollision.object?.name || 'track object'}`
              );
            }
          } else {
            this.lastValidPlayerPosition
              .copy(
                this.playerCar.position
              );

            this.lastValidPlayerRotationY =
              this.playerCar.rotation.y;
          }

          this.updateCamera();
          this.readStatus();
        } else {
          this.controls.update();
        }

        this.renderer.render(
          this.scene,
          this.camera
        );

        this.rafId =
          requestAnimationFrame(
            tick
          );
      };

    this.rafId =
      requestAnimationFrame(
        tick
      );
  }

  dispose() {
    if (this.disposed) return;

    this.disposed = true;
    this.running = false;

    if (this.rafId) {
      cancelAnimationFrame(
        this.rafId
      );
    }

    window.removeEventListener(
      'keydown',
      this.handleKeyDown
    );

    window.removeEventListener(
      'keyup',
      this.handleKeyUp
    );

    window.removeEventListener(
      'resize',
      this.handleResize
    );

    this.renderer?.domElement
      ?.removeEventListener(
        'dblclick',
        this.handleDoubleClick
      );

    if (
      this.renderer?.domElement
        ?.parentNode
    ) {
      this.renderer.domElement
        .parentNode
        .removeChild(
          this.renderer.domElement
        );
    }

    if (
      this.ui?.parentNode
    ) {
      this.ui.parentNode
        .removeChild(
          this.ui
        );
    }

    this.renderer.dispose();
  }
}
