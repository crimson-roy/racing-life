import * as THREE from 'three';
import { WesternBagger } from './WesternBagger.js';

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
  4,
  2.8,
  -5
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
// LIGHTING
// ============================================================

const ambient =
  new THREE.HemisphereLight(
    0xffffff,
    0x333333,
    1.5
  );

scene.add(ambient);

const keyLight =
  new THREE.DirectionalLight(
    0xffffff,
    2
  );

keyLight.position.set(
  5,
  8,
  5
);

keyLight.castShadow = true;

scene.add(keyLight);

const fillLight =
  new THREE.DirectionalLight(
    0x88ccff,
    0.5
  );

fillLight.position.set(
  -5,
  3,
  -4
);

scene.add(fillLight);

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

// Grid for movement reference.
const grid =
  new THREE.GridHelper(
    100,
    50
  );

grid.position.y = 0.01;

scene.add(grid);

// ============================================================
// VEHICLE
// ============================================================

const bike =
  new WesternBagger({
    maxSpeed: 14,
    maxReverseSpeed: 5,
    acceleration: 8,
    brakePower: 13,
    drag: 2.8,
    turnRate: 1.8
  });

bike.position.set(
  0,
  0,
  0
);

scene.add(bike);

// ============================================================
// INPUT
// ============================================================

const keys = {};

window.addEventListener(
  'keydown',
  event => {
    keys[event.code] = true;
  }
);

window.addEventListener(
  'keyup',
  event => {
    keys[event.code] = false;
  }
);

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
  'rgba(0,0,0,0.65)';
hud.style.color = 'white';
hud.style.fontFamily =
  'Arial, sans-serif';
hud.style.fontSize = '16px';
hud.style.lineHeight = '1.5';
hud.style.borderRadius = '8px';
hud.style.userSelect = 'none';

document.body.appendChild(
  hud
);

// ============================================================
// CAMERA
// ============================================================

const cameraOffset =
  new THREE.Vector3(
    4,
    2.8,
    -5
  );

function updateCamera() {
  const desired =
    cameraOffset
      .clone()
      .applyQuaternion(
        bike.quaternion
      )
      .add(bike.position);

  camera.position.lerp(
    desired,
    0.08
  );

  const lookTarget =
    bike.position
      .clone()
      .add(
        new THREE.Vector3(
          0,
          0.8,
          1.5
        ).applyQuaternion(
          bike.quaternion
        )
      );

  camera.lookAt(
    lookTarget
  );
}

// ============================================================
// CLOCK
// ============================================================

const clock =
  new THREE.Clock();

// ============================================================
// GAME LOOP
// ============================================================

function animate() {
  requestAnimationFrame(
    animate
  );

  const dt =
    Math.min(
      clock.getDelta(),
      0.05
    );

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

  bike.drive(
    accelerating ? 1 : 0,
    braking ? 1 : 0,
    steering,
    dt
  );

  updateCamera();

  const speed =
    bike.speed;

  const direction =
    speed < -0.01
      ? 'REVERSE'
      : 'FORWARD';

  hud.innerHTML = `
    <strong>RACING LIFE — 3D VEHICLE TEST</strong><br><br>

    W / ↑ — Accelerate<br>
    S / ↓ — Brake / Reverse<br>
    A / ← — Steer Left<br>
    D / → — Steer Right<br><br>

    Speed: ${Math.abs(speed).toFixed(1)}<br>
    Direction: ${direction}<br>
    Steering: ${bike.steering.toFixed(2)}
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