import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BFInjection } from './BFInjection.js';

const scene = new THREE.Scene();

scene.background =
  new THREE.Color(0x202020);

// ============================================================
// CAMERA
// ============================================================

const camera =
  new THREE.PerspectiveCamera(
    55,
    window.innerWidth /
      window.innerHeight,
    0.1,
    100
  );

camera.position.set(
  5,
  3.5,
  -6
);

// ============================================================
// RENDERER
// ============================================================

const renderer =
  new THREE.WebGLRenderer({
    antialias: true
  });

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio,
    2
  )
);

renderer.shadowMap.enabled = true;

document.body.style.margin = '0';

document.body.appendChild(
  renderer.domElement
);

// ============================================================
// ORBIT CONTROLS
// ============================================================

const orbitControls =
  new OrbitControls(
    camera,
    renderer.domElement
  );

orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;

orbitControls.enablePan = true;
orbitControls.enableZoom = true;

orbitControls.minDistance = 2;
orbitControls.maxDistance = 12;

orbitControls.target.set(
  0,
  0.8,
  0
);

orbitControls.update();

// Start in inspection mode.
let cameraMode = 'orbit';

// ============================================================
// LIGHTING
// ============================================================

const ambient =
  new THREE.HemisphereLight(
    0xffffff,
    0x333333,
    1.5
  );

scene.add(ambient);

const sun =
  new THREE.DirectionalLight(
    0xfff4e6,
    1.8
  );

sun.position.set(
  5,
  8,
  5
);

sun.castShadow = true;

scene.add(sun);

// Extra rear light makes the silhouette easier to inspect.
const rim =
  new THREE.DirectionalLight(
    0xffffff,
    0.6
  );

rim.position.set(
  -4,
  5,
  -6
);

scene.add(rim);

// ============================================================
// GROUND
// ============================================================

const ground =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      100,
      100
    ),
    new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9
    })
  );

ground.rotation.x =
  -Math.PI / 2;

ground.receiveShadow = true;

scene.add(ground);

const grid =
  new THREE.GridHelper(
    100,
    50
  );

grid.position.y = 0.01;

scene.add(grid);

// ============================================================
// BUGGY
// ============================================================

const buggy =
  new BFInjection();

scene.add(buggy);

// ============================================================
// HUD
// ============================================================

const hud =
  document.createElement('div');

hud.style.position = 'fixed';
hud.style.top = '20px';
hud.style.left = '20px';
hud.style.padding = '14px 18px';
hud.style.background =
  'rgba(0,0,0,0.72)';
hud.style.color = 'white';
hud.style.fontFamily =
  'Arial, sans-serif';
hud.style.fontSize = '16px';
hud.style.lineHeight = '1.5';
hud.style.borderRadius = '8px';
hud.style.userSelect = 'none';
hud.style.zIndex = '20';

document.body.appendChild(
  hud
);

// ============================================================
// INPUT
// ============================================================

const keys = {};

window.addEventListener(
  'keydown',
  event => {
    keys[event.code] = true;

    // Toggle camera mode.
    if (
      event.code === 'KeyO' &&
      !event.repeat
    ) {
      toggleCameraMode();
    }

    // Reset vehicle.
    if (
      event.code === 'KeyR' &&
      !event.repeat
    ) {
      resetBuggy();
    }
  }
);

window.addEventListener(
  'keyup',
  event => {
    keys[event.code] = false;
  }
);

// ============================================================
// DRIVE CAMERA
// ============================================================

const cameraOffset =
  new THREE.Vector3(
    5,
    3.5,
    -6
  );

function updateDriveCamera() {
  const desired =
    cameraOffset
      .clone()
      .applyQuaternion(
        buggy.quaternion
      )
      .add(
        buggy.position
      );

  camera.position.lerp(
    desired,
    0.08
  );

  const target =
    buggy.position
      .clone()
      .add(
        new THREE.Vector3(
          0,
          0.75,
          1.5
        ).applyQuaternion(
          buggy.quaternion
        )
      );

  camera.lookAt(
    target
  );
}

// ============================================================
// CAMERA MODE
// ============================================================

function toggleCameraMode() {
  if (cameraMode === 'orbit') {
    cameraMode = 'drive';

    orbitControls.enabled = false;

    // Put camera behind the buggy immediately.
    const desired =
      cameraOffset
        .clone()
        .applyQuaternion(
          buggy.quaternion
        )
        .add(
          buggy.position
        );

    camera.position.copy(
      desired
    );

    camera.lookAt(
      buggy.position
    );
  } else {
    cameraMode = 'orbit';

    orbitControls.enabled = true;

    orbitControls.target.copy(
      buggy.position
    );

    orbitControls.update();
  }
}

// ============================================================
// RESET
// ============================================================

function resetBuggy() {
  buggy.position.set(
    0,
    0,
    0
  );

  buggy.rotation.set(
    0,
    0,
    0
  );

  buggy.speed = 0;
  buggy.steering = 0;

  buggy.setSteering(0);

  orbitControls.target.set(
    0,
    0.8,
    0
  );

  orbitControls.update();
}

// ============================================================
// FRAME TIMER
// ============================================================

let previousTime =
  performance.now() / 1000;

// ============================================================
// GAME LOOP
// ============================================================

function animate() {
  requestAnimationFrame(
    animate
  );

  const now =
    performance.now() / 1000;

  const dt =
    Math.min(
      now - previousTime,
      0.05
    );

  previousTime = now;

  // ------------------------------------------------------------
  // PLAYER INPUT
  // ------------------------------------------------------------

  const accelerating =
    keys.KeyW ||
    keys.ArrowUp;

  const braking =
    keys.KeyS ||
    keys.ArrowDown;

  const left =
    keys.KeyA ||
    keys.ArrowLeft;

  const right =
    keys.KeyD ||
    keys.ArrowRight;

  const steering =
    (right ? 1 : 0) -
    (left ? 1 : 0);

  // ------------------------------------------------------------
  // DRIVE
  // ------------------------------------------------------------

  buggy.drive(
    accelerating ? 1 : 0,
    braking ? 1 : 0,
    steering,
    dt
  );

  // ------------------------------------------------------------
  // CAMERA
  // ------------------------------------------------------------

  if (cameraMode === 'drive') {
    updateDriveCamera();
  } else {
    orbitControls.target.lerp(
      new THREE.Vector3(
        buggy.position.x,
        buggy.position.y + 0.5,
        buggy.position.z
      ),
      0.05
    );

    orbitControls.update();
  }

  // ------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------

  const direction =
    buggy.speed < -0.01
      ? 'REVERSE'
      : buggy.speed > 0.01
        ? 'FORWARD'
        : 'STOPPED';

  hud.innerHTML = `
    <strong>RACING LIFE — BF INJECTION TEST</strong><br><br>

    <b>CAMERA</b><br>
    O — Toggle Orbit / Drive<br>
    Mouse — Orbit / Zoom / Pan in Orbit mode<br><br>

    <b>DRIVING</b><br>
    W / ↑ — Accelerate<br>
    S / ↓ — Brake / Reverse<br>
    A / ← — Steer Left<br>
    D / → — Steer Right<br>
    R — Reset<br><br>

    Mode: ${cameraMode.toUpperCase()}<br>
    Speed: ${Math.abs(
      buggy.speed
    ).toFixed(1)}<br>
    Direction: ${direction}<br>
    Steering: ${
      buggy.steering.toFixed(2)
    }
  `;

  renderer.render(
    scene,
    camera
  );
}

animate();

// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
  'resize',
  () => {
    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
  }
);