import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MixamoPlayer } from '../characters/MixamoPlayer.js';
import { WesternBagger } from '../vehicles/WesternBagger.js';
import { BFInjection } from '../vehicles/BFInjection.js';
import { EmoteWheel } from '../ui/EmoteWheel.js';

/**
 * ============================================================
 * RACING LIFE 3D — HOME / LOBBY SCENE
 * ============================================================
 *
 * This is the HOME/Lobby scene.
 *
 * IMPORTANT:
 * - The character does NOT walk here.
 * - The character is a showcase character.
 * - Mouse drag rotates the camera around the character.
 * - Mouse wheel zooms the camera.
 * - FREE ROAM and NEXT MATCH are callbacks for main.js.
 * - Garage can later switch between the Bagger and BFInjection.
 *
 * Gameplay controls such as W/A/S/D, E, F and G belong to
 * FREE ROAM, not this lobby.
 */

export class HomeScene {

  constructor(options = {}) {

    // ========================================================
    // CALLBACKS
    // ========================================================

    this.container =
      options.container ??
      document.body;

    this.onFreeRoam =
      options.onFreeRoam ??
      (() => {});

    this.onNextMatch =
      options.onNextMatch ??
      (() => {});

    this.onGarage =
      options.onGarage ??
      (() => {});

    this.onComingSoon =
      options.onComingSoon ??
      (() => {});

    // ========================================================
    // SCENE
    // ========================================================

    this.scene =
      new THREE.Scene();

    this.scene.background =
      new THREE.Color(
        0x11151b
      );

    // ========================================================
    // CAMERA
    // ========================================================

    this.camera =
      new THREE.PerspectiveCamera(
        42,
        Math.max(
          1,
          window.innerWidth
        ) /
        Math.max(
          1,
          window.innerHeight
        ),
        0.1,
        100
      );

    this.cameraDistance =
  5.5;

this.cameraHeightAngle =
  THREE.MathUtils.degToRad(
    18
  );

    // ========================================================
    // RENDERER
    // ========================================================

    this.renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
      });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        2
      )
    );

    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    this.renderer.shadowMap.enabled =
      true;

    this.renderer.domElement.style.position =
      'fixed';

    this.renderer.domElement.style.inset =
      '0';

    this.renderer.domElement.style.zIndex =
      '0';

    this.container.appendChild(
      this.renderer.domElement
    );

    // ========================================================
    // CAMERA ORBIT CONTROLS
    // ========================================================

    this.controls =
      new OrbitControls(
        this.camera,
        this.renderer.domElement
      );

    this.controls.enableDamping =
      true;

    this.controls.dampingFactor =
      0.07;

    this.controls.target.set(
      0,
      1.25,
      0
    );

    this.controls.minDistance =
      4.2;

    this.controls.maxDistance =
      10;

    this.controls.maxPolarAngle =
      THREE.MathUtils.degToRad(
        82
      );

    this.controls.minPolarAngle =
      THREE.MathUtils.degToRad(
        50
      );

    // We don't want the user moving
    // the entire showcase around.
    this.controls.enablePan =
      false;

    this.controls.update();

    // ========================================================
    // STATE
    // ========================================================

    this.clock =
      new THREE.Clock();

   this.player = null;
this.vehicle = null;
this.vehicleType = 'Bagger';
this.running = false;
this.ui = null;

this.emoteWheel = null;
this.raycaster = new THREE.Raycaster();
this.pointer = new THREE.Vector2();

    // ========================================================
    // BUILD
    // ========================================================

    this.buildEnvironment();

    this.buildPlayer();
    
    this.buildVehicle();

    this.buildUI();

this.buildEmoteWheel();

this.bindCharacterTap();

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

    // ========================================================
    // START
    // ========================================================

    this.start();
  }

  // ============================================================
  // ENVIRONMENT
  // ============================================================

  buildEnvironment() {

    // --------------------------------------------------------
    // HEMISPHERE LIGHT
    // --------------------------------------------------------

    const hemi =
      new THREE.HemisphereLight(
        0xffffff,
        0x26303a,
        1.9
      );

    this.scene.add(
      hemi
    );

    // --------------------------------------------------------
    // KEY LIGHT
    // --------------------------------------------------------

    const key =
      new THREE.DirectionalLight(
        0xffffff,
        2.3
      );

    key.position.set(
      5,
      8,
      6
    );

    key.castShadow =
      true;

    this.scene.add(
      key
    );

    // --------------------------------------------------------
    // RIM LIGHT
    // --------------------------------------------------------

    const rim =
      new THREE.DirectionalLight(
        0xff5a2f,
        0.6
      );

    rim.position.set(
      -4,
      4,
      -5
    );

    this.scene.add(
      rim
    );

    // --------------------------------------------------------
    // FLOOR
    // --------------------------------------------------------

    const floor =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          11,
          64
        ),
        new THREE.MeshStandardMaterial({
          color: 0x1d252d,
          roughness: 0.92,
          metalness: 0
        })
      );

    floor.rotation.x =
      -Math.PI / 2;

    floor.receiveShadow =
      true;

    this.scene.add(
      floor
    );

    // --------------------------------------------------------
    // CHARACTER / VEHICLE SHOWCASE PAD
    // --------------------------------------------------------

    const pad =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      2.6,
      2.9,
      0.18,
      64
    ),
    new THREE.MeshStandardMaterial({
      color: 0x252c36,
      roughness: 0.82,
      metalness: 0.15
    })
  );

    pad.position.set(
      0,
      0.09,
      0
    );

    pad.receiveShadow =
      true;

    this.scene.add(
      pad
    );

const padRing =
  new THREE.Mesh(
    new THREE.TorusGeometry(
      2.52,
      0.035,
      10,
      96
    ),
    new THREE.MeshStandardMaterial({
      color: 0xff6a3d,
      emissive: 0xff3414,
      emissiveIntensity: 1.8,
      roughness: 0.3
    })
  );

padRing.rotation.x =
  Math.PI / 2;

padRing.position.y =
  0.19;

this.scene.add(
  padRing
);

    // --------------------------------------------------------
    // BACKGROUND ROAD
    // --------------------------------------------------------

    const road =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          18,
          5.5
        ),
        new THREE.MeshStandardMaterial({
          color: 0x171b20,
          roughness: 0.96
        })
      );

    road.rotation.x =
      -Math.PI / 2;

    road.position.set(
      0,
      0.015,
      -4.4
    );

    road.receiveShadow =
      true;

    this.scene.add(
      road
    );

    // --------------------------------------------------------
    // BACKDROP
    // --------------------------------------------------------

    this.addSimpleBackdrop();
  }

  // ============================================================
  // BACKDROP BUILDINGS
  // ============================================================

  addSimpleBackdrop() {

  // ==========================================================
  // MATERIALS
  // ==========================================================

  const buildingMat =
    new THREE.MeshStandardMaterial({
      color: 0x343b48,
      roughness: 0.82
    });

  const buildingDarkMat =
    new THREE.MeshStandardMaterial({
      color: 0x202631,
      roughness: 0.88
    });

  const glassMat =
    new THREE.MeshStandardMaterial({
      color: 0x263f52,
      emissive: 0x102838,
      emissiveIntensity: 0.65,
      roughness: 0.18,
      metalness: 0.15
    });

  const neonWarmMat =
    new THREE.MeshStandardMaterial({
      color: 0xff7043,
      emissive: 0xff3d18,
      emissiveIntensity: 2.5,
      roughness: 0.3
    });

  const neonCoolMat =
    new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      emissive: 0x147ea6,
      emissiveIntensity: 2.0,
      roughness: 0.3
    });

  const roadMat =
    new THREE.MeshStandardMaterial({
      color: 0x11151b,
      roughness: 0.94
    });

  const stripeMat =
    new THREE.MeshStandardMaterial({
      color: 0xd9d9d9,
      roughness: 0.65
    });

  const greeneryMat =
    new THREE.MeshStandardMaterial({
      color: 0x294b3a,
      roughness: 0.95
    });

  // ==========================================================
  // BUILDINGS
  // ==========================================================

  const buildings = [
    {
      x: -6.5,
      y: 1.8,
      z: -3.2,
      w: 3.0,
      h: 3.6,
      d: 1.8,
      material: buildingDarkMat
    },
    {
      x: 6.2,
      y: 1.5,
      z: -3.8,
      w: 2.6,
      h: 3.0,
      d: 1.7,
      material: buildingMat
    },
    {
      x: -3.8,
      y: 1.1,
      z: -6.4,
      w: 2.2,
      h: 2.2,
      d: 1.5,
      material: buildingMat
    },
    {
      x: 4.0,
      y: 1.25,
      z: -6.8,
      w: 2.8,
      h: 2.5,
      d: 1.8,
      material: buildingDarkMat
    }
  ];

  for (
    const buildingData of buildings
  ) {

    const building =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          buildingData.w,
          buildingData.h,
          buildingData.d
        ),
        buildingData.material
      );

    building.position.set(
      buildingData.x,
      buildingData.y,
      buildingData.z
    );

    building.castShadow =
      true;

    building.receiveShadow =
      true;

    this.scene.add(
      building
    );

    // --------------------------------------------------------
    // GLASS FRONT
    // --------------------------------------------------------

    const glass =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          buildingData.w * 0.58,
          buildingData.h * 0.34,
          0.04
        ),
        glassMat
      );

    glass.position.set(
      buildingData.x,
      buildingData.y + 0.12,
      buildingData.z +
        buildingData.d / 2 +
        0.025
    );

    this.scene.add(
      glass
    );

    // --------------------------------------------------------
    // WARM NEON STRIP
    // --------------------------------------------------------

    const neon =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          buildingData.w * 0.72,
          0.045,
          0.045
        ),
        neonWarmMat
      );

    neon.position.set(
      buildingData.x,
      buildingData.y +
        buildingData.h * 0.30,
      buildingData.z +
        buildingData.d / 2 +
        0.05
    );

    this.scene.add(
      neon
    );
  }

  // ==========================================================
  // ROAD MARKINGS
  // ==========================================================

  for (
    let i = -7;
    i <= 7;
    i++
  ) {

    const stripe =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.35,
          0.018,
          0.08
        ),
        stripeMat
      );

    stripe.position.set(
      i * 1.05,
      0.03,
      -4.4
    );

    this.scene.add(
      stripe
    );
  }

  // ==========================================================
  // GREENERY
  // ==========================================================

  const treePositions = [
    [-5.4, -3.8],
    [-4.5, -5.2],
    [5.1, -4.5],
    [5.8, -5.8]
  ];

  for (
    const [x, z] of treePositions
  ) {

    const trunk =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.07,
          0.09,
          0.7,
          10
        ),
        new THREE.MeshStandardMaterial({
          color: 0x4a3327,
          roughness: 1
        })
      );

    trunk.position.set(
      x,
      0.35,
      z
    );

    trunk.castShadow =
      true;

    this.scene.add(
      trunk
    );

    const leaves =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.35,
          14,
          10
        ),
        greeneryMat
      );

    leaves.position.set(
      x,
      0.95,
      z
    );

    leaves.castShadow =
      true;

    this.scene.add(
      leaves
    );
  }

  // ==========================================================
  // SMALL NEON LIGHT POLES
  // ==========================================================

  const polePositions = [
    [-2.9, -3.5],
    [3.0, -3.5]
  ];

  for (
    const [x, z] of polePositions
  ) {

    const pole =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.035,
          0.045,
          2.3,
          10
        ),
        new THREE.MeshStandardMaterial({
          color: 0x3a414b,
          metalness: 0.65,
          roughness: 0.45
        })
      );

    pole.position.set(
      x,
      1.15,
      z
    );

    this.scene.add(
      pole
    );

    const lamp =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.09,
          12,
          10
        ),
        neonCoolMat
      );

    lamp.position.set(
      x,
      2.32,
      z
    );

    this.scene.add(
      lamp
    );

    const light =
      new THREE.PointLight(
        0x4fc3f7,
        2.2,
        4.5
      );

    light.position.set(
      x,
      2.32,
      z
    );

    this.scene.add(
      light
    );
  }
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
          '/assets/characters/animations/Idle.glb'
      });

    // Showcase position.
    this.player.position.set(
  -0.95,
  0,
  0.3
);

this.player.groundOffsetY =
  0.18;

    // Showcase facing direction.
    this.player.rotation.y =
      THREE.MathUtils.degToRad(
        18
      );

    this.scene.add(
      this.player
    );
  }

  // ============================================================
  // VEHICLE
  // ============================================================

  buildVehicle() {

    this.replaceVehicle(
      'Bagger'
    );
  }

  // ============================================================
  // REPLACE SHOWCASE VEHICLE
  // ============================================================

  replaceVehicle(type) {

    // --------------------------------------------------------
    // Remove old vehicle.
    // --------------------------------------------------------

    if (
      this.vehicle
    ) {

      this.scene.remove(
        this.vehicle
      );
    }

    // --------------------------------------------------------
    // BF INJECTION
    // --------------------------------------------------------

    if (
      type ===
      'BFInjection'
    ) {

      this.vehicle =
        new BFInjection();

      this.vehicle.position.set(
  1.45,
  0.18,
  -0.25
);

      this.vehicle.rotation.y =
        THREE.MathUtils.degToRad(
          -8
        );

      this.vehicle.scale.setScalar(
        0.98
      );
    }

    // --------------------------------------------------------
    // WESTERN BAGGER
    // --------------------------------------------------------

    else {

      this.vehicle =
        new WesternBagger();

      this.vehicle.position.set(
  1.35,
  0.18,
  0.05
);

      this.vehicle.rotation.y =
        THREE.MathUtils.degToRad(
          -8
        );

      this.vehicle.scale.setScalar(
        1.0
      );

      type =
        'Bagger';
    }

    this.vehicleType =
      type;

    this.scene.add(
      this.vehicle
    );
  }

// ============================================================
// EMOTE WHEEL
// ============================================================

buildEmoteWheel() {

  this.emoteWheel =
    new EmoteWheel({

      onSelect: (emote) => {

        // ------------------------------------------------------
        // The Home/Lobby is a showcase scene.
        // Selecting a showcase emote simply plays it.
        // ------------------------------------------------------

        if (!this.player) {
          return;
        }

        console.log(
          `Home emote selected: ${emote.label}`
        );

        this.player.playEmote(
          emote
        );
      }

    });
}

// ============================================================
// TAP CHARACTER TO OPEN EMOTE WHEEL
// ============================================================

bindCharacterTap() {

  this.renderer.domElement.addEventListener(
    'pointerdown',
    (event) => {

      // Don't react if the EmoteWheel is already open.
      if (
        this.emoteWheel &&
        this.emoteWheel.isOpen
      ) {
        return;
      }

      if (
        !this.player ||
        !this.player.model
      ) {
        return;
      }

      this.pointer.x =
        (
          event.clientX /
          window.innerWidth
        ) *
        2 -
        1;

      this.pointer.y =
        -(
          event.clientY /
          window.innerHeight
        ) *
        2 +
        1;

      this.raycaster.setFromCamera(
        this.pointer,
        this.camera
      );

      const hits =
        this.raycaster.intersectObject(
          this.player.model,
          true
        );

      if (
        hits.length > 0
      ) {

        this.emoteWheel.open();

      }

    }
  );
}

  // ============================================================
  // UI
  // ============================================================

  buildUI() {

    // --------------------------------------------------------
    // STYLE
    // --------------------------------------------------------

    const style =
      document.createElement(
        'style'
      );

    style.dataset.racingLifeHomeStyle =
      'true';

    style.textContent = `
      .rl-home-ui {
        position: fixed;
        inset: 0;
        z-index: 5;
        pointer-events: none;
        font-family: Arial, sans-serif;
        color: white;
      }

      .rl-home-top {
        position: absolute;
        top: 24px;
        left: 28px;
        right: 28px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
      }

      .rl-home-brand {
        text-shadow:
          0 2px 12px
          rgba(0,0,0,.45);
      }

      .rl-home-brand small {
        display: block;
        font-size: 12px;
        letter-spacing: .22em;
        opacity: .72;
        margin-bottom: 4px;
      }

      .rl-home-brand h1 {
        margin: 0;
        font-size: 30px;
        letter-spacing: .04em;
      }

      .rl-home-profile {
        pointer-events: auto;
        padding: 10px 14px;
        border-radius: 12px;
        background:
          rgba(10,12,16,.72);
        border:
          1px solid
          rgba(255,255,255,.14);
        backdrop-filter: blur(10px);
      }

      .rl-home-left,
      .rl-home-right {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .rl-home-left {
        left: 24px;
      }

      .rl-home-right {
        right: 24px;
      }

      .rl-home-btn {
        pointer-events: auto;
        min-width: 170px;
        padding: 13px 16px;
        border-radius: 13px;
        border:
          1px solid
          rgba(255,255,255,.16);
        background:
          rgba(13,16,21,.78);
        color: white;
        text-align: left;
        cursor: pointer;
        backdrop-filter: blur(10px);
        transition:
          transform .12s ease,
          background .12s ease;
      }

      .rl-home-btn:hover {
        transform:
          translateX(3px);
        background:
          rgba(45,48,56,.9);
      }

      .rl-home-btn b {
        display: block;
        font-size: 13px;
        letter-spacing: .08em;
      }

      .rl-home-btn span {
        display: block;
        margin-top: 4px;
        font-size: 11px;
        opacity: .62;
      }

      .rl-home-actions {
        position: absolute;
        right: 30px;
        bottom: 30px;
        width: 220px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .rl-home-mode {
        pointer-events: auto;
        border: 0;
        border-radius:
          13px 13px 4px 4px;
        padding: 10px 14px;
        background:
          rgba(10,12,16,.88);
        color: white;
        text-align: left;
        cursor: pointer;
        font-size: 12px;
        letter-spacing: .12em;
      }

      .rl-home-primary {
        pointer-events: auto;
        border: 0;
        border-radius:
          5px 5px 13px 13px;
        padding: 16px;
        background: #f0f0f0;
        color: #111;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: .08em;
        cursor: pointer;
        box-shadow:
          0 12px 30px
          rgba(0,0,0,.28);
      }

      .rl-home-vehicle {
        position: absolute;
        left: 50%;
        bottom: 26px;
        transform:
          translateX(-50%);
        pointer-events: none;
        padding: 7px 12px;
        border-radius: 999px;
        background:
          rgba(10,12,16,.68);
        border:
          1px solid
          rgba(255,255,255,.12);
        font-size: 11px;
        letter-spacing: .12em;
      }

      @media (max-width: 850px) {

        .rl-home-left,
        .rl-home-right {
          gap: 7px;
        }

        .rl-home-btn {
          min-width: 135px;
        }

        .rl-home-actions {
          width: 190px;
          right: 16px;
          bottom: 16px;
        }
      }
    `;

    document.head.appendChild(
      style
    );

    // --------------------------------------------------------
    // UI ROOT
    // --------------------------------------------------------

    const ui =
      document.createElement(
        'div'
      );

    ui.className =
      'rl-home-ui';

    ui.innerHTML = `
      <div class="rl-home-top">

        <div class="rl-home-brand">
          <small>RACING LIFE</small>
          <h1>Welcome back</h1>
        </div>

        <div class="rl-home-profile">
          INDEPENDENT · CAREER 01
        </div>

      </div>

      <div class="rl-home-left">

        <button
          class="rl-home-btn"
          data-home-action="assets"
        >
          <b>ASSETS</b>
          <span>Coming soon</span>
        </button>

        <button
          class="rl-home-btn"
          data-home-action="wardrobe"
        >
          <b>WARDROBE</b>
          <span>Coming soon</span>
        </button>

        <button
          class="rl-home-btn"
          data-home-action="character"
        >
          <b>CHARACTER</b>
          <span>Coming soon</span>
        </button>

      </div>

      <div class="rl-home-right">

        <button
          class="rl-home-btn"
          data-home-action="garage"
        >
          <b>GARAGE</b>
          <span>Bagger · BFInjection</span>
        </button>

        <button
          class="rl-home-btn"
          data-home-action="headquarters"
        >
          <b>HEADQUARTERS</b>
          <span>Coming soon</span>
        </button>

      </div>

      <div
        class="rl-home-vehicle"
        id="rl-home-vehicle"
      >
        SHOWCASE · BAGGER
      </div>

      <div class="rl-home-actions">

        <button
          class="rl-home-mode"
          data-home-action="free-roam"
        >
          FREE ROAM
        </button>

        <button
          class="rl-home-primary"
          data-home-action="next-match"
        >
          NEXT MATCH
        </button>

      </div>
    `;

    // --------------------------------------------------------
    // BUTTON EVENTS
    // --------------------------------------------------------

    ui.addEventListener(
      'click',
      (event) => {

        const button =
          event.target.closest(
            '[data-home-action]'
          );

        if (!button) {
          return;
        }

        const action =
          button.dataset.homeAction;

        // ------------------------------------------------------
        // FREE ROAM
        // ------------------------------------------------------

        if (
          action ===
          'free-roam'
        ) {

          this.onFreeRoam();

        }

        // ------------------------------------------------------
        // NEXT MATCH
        // ------------------------------------------------------

        else if (
          action ===
          'next-match'
        ) {

          this.onNextMatch();

        }

        // ------------------------------------------------------
        // GARAGE
        // ------------------------------------------------------

        else if (
          action ===
          'garage'
        ) {

          this.onGarage();

        }

        // ------------------------------------------------------
        // EVERYTHING ELSE
        // ------------------------------------------------------

        else {

          this.onComingSoon(
            action
          );

        }
      }
    );

    document.body.appendChild(
      ui
    );

    this.ui =
      ui;
  }

  // ============================================================
  // CHANGE SHOWCASE VEHICLE
  // ============================================================

  setVehicle(type) {

    this.replaceVehicle(
      type
    );

    const label =
      this.ui?.querySelector(
        '#rl-home-vehicle'
      );

    if (label) {

      label.textContent =
        `SHOWCASE · ${
          this.vehicleType.toUpperCase()
        }`;

    }
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(dt) {

    if (
      this.player
    ) {

      this.player.update(
        dt
      );

    }
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

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      width,
      height
    );
  }

  // ============================================================
  // START LOOP
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
  // DISPOSE
  // ============================================================

  dispose() {

    this.running =
      false;

    window.removeEventListener(
      'resize',
      this.resizeHandler
    );

    this.controls.dispose();

    if (
      this.ui
    ) {

      this.ui.remove();

    }

    if (
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
  this.emoteWheel
) {
  this.emoteWheel.close();
}

    this.renderer.dispose();
  }
}