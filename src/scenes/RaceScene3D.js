import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8eb8ce);
    this.scene.fog = new THREE.Fog(0x8eb8ce, 500, 5000);

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
        W/S accelerate & reverse · A/D steer<br>
        R reset to grid · G save current grid position<br>
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
      };

    this.handleKeyUp =
      (event) => {
        this.keys.delete(
          event.code
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

        const size =
          this.trackBounds.getSize(
            new THREE.Vector3()
          );

        const center =
          this.trackBounds.getCenter(
            new THREE.Vector3()
          );

        this.applyInitialGrid(
          center,
          size
        );

        this.setStatus(
          `Loaded · ${size.x.toFixed(1)} × ${size.z.toFixed(1)} world units`
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

  applyInitialGrid(center, size) {
    const saved =
      this.loadSavedGrid();

    const spawn = saved ?? {
      x: center.x,
      y:
        this.trackBounds
          ? this.trackBounds.min.y + 1
          : center.y + Math.max(0.6, size.y * 0.02),
      z: center.z,
      yaw: 0
    };

    this.playerCar.position.set(
      spawn.x - 2.1,
      spawn.y,
      spawn.z
    );

    this.playerCar.rotation.y =
      spawn.yaw;

    this.opponentCar.position.set(
      spawn.x + 2.1,
      spawn.y,
      spawn.z
    );

    this.opponentCar.rotation.y =
      spawn.yaw;

    this.playerCar.speed = 0;
    this.opponentCar.speed = 0;

    this.updateCamera(true);
  }

  saveGridFromPlayer() {
    const value = {
      x:
        this.playerCar.position.x + 2.1,
      y:
        this.playerCar.position.y,
      z:
        this.playerCar.position.z,
      yaw:
        this.playerCar.rotation.y
    };

    localStorage.setItem(
      `racingLifeGrid:${this.session.trackId}`,
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
          `racingLifeGrid:${this.session.trackId}`
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

        this.playerCar.drive(
          input.throttle,
          input.brake,
          input.steering,
          dt
        );

        this.updateCamera();
        this.readStatus();

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
