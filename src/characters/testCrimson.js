import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Crimson } from './Crimson.js';

const scene =
  new THREE.Scene();

scene.background =
  new THREE.Color(
    0x202020
  );

// ============================================================
// CAMERA
// ============================================================

const camera =
  new THREE.PerspectiveCamera(
    45,
    window.innerWidth /
      window.innerHeight,
    0.1,
    100
  );

camera.position.set(
  2.8,
  1.9,
  4.5
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

renderer.shadowMap.enabled =
  true;

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
    0x303030,
    1.8
  );

scene.add(
  ambient
);

const key =
  new THREE.DirectionalLight(
    0xffffff,
    2.2
  );

key.position.set(
  4,
  7,
  5
);

key.castShadow =
  true;

scene.add(
  key
);

const rim =
  new THREE.DirectionalLight(
    0xff5a2f,
    0.7
  );

rim.position.set(
  -4,
  3,
  -5
);

scene.add(
  rim
);

// ============================================================
// GROUND
// ============================================================

const ground =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      30,
      30
    ),
    new THREE.MeshStandardMaterial({
      color: 0x303030,
      roughness: 0.9
    })
  );

ground.rotation.x =
  -Math.PI / 2;

ground.receiveShadow =
  true;

scene.add(
  ground
);

const grid =
  new THREE.GridHelper(
    30,
    30
  );

grid.position.y =
  0.01;

scene.add(
  grid
);

// ============================================================
// CRIMSON
// ============================================================

const crimson =
  new Crimson({
    height: 1.80
  });

scene.add(
  crimson
);

crimson.position.y =
  0;

// ============================================================
// CONTROLS
// ============================================================

const controls =
  new OrbitControls(
    camera,
    renderer.domElement
  );

controls.enableDamping =
  true;

controls.dampingFactor =
  0.08;

controls.target.set(
  0,
  0.9,
  0
);

controls.minDistance =
  1.5;

controls.maxDistance =
  8;

controls.update();

// ============================================================
// HUD
// ============================================================

const hud =
  document.createElement(
    'div'
  );

hud.style.position =
  'fixed';

hud.style.top =
  '20px';

hud.style.left =
  '20px';

hud.style.padding =
  '14px 18px';

hud.style.background =
  'rgba(0,0,0,0.70)';

hud.style.color =
  'white';

hud.style.fontFamily =
  'Arial, sans-serif';

hud.style.fontSize =
  '16px';

hud.style.lineHeight =
  '1.5';

hud.style.borderRadius =
  '8px';

hud.style.userSelect =
  'none';

hud.innerHTML = `
  <strong>RACING LIFE — CRIMSON TEST</strong><br><br>
  Mouse — Orbit / Zoom / Pan<br>
  SPACE — Walk animation<br>
  ↑ / ↓ — Look up / down
`;

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
  }
);

window.addEventListener(
  'keyup',
  event => {
    keys[event.code] = false;
  }
);

// ============================================================
// LOOP
// ============================================================

let previousTime =
  performance.now() /
  1000;

function animate() {
  requestAnimationFrame(
    animate
  );

  const now =
    performance.now() /
    1000;

  const dt =
    Math.min(
      now - previousTime,
      0.05
    );

  previousTime =
    now;

  const walking =
    keys.Space;

 crimson.updateAnimation(
  dt,
  walking ? 1 : 0
);

  const lookPitch =
    (keys.ArrowDown ? 1 : 0) -
    (keys.ArrowUp ? 1 : 0);

crimson.setLookRotation(
  0,
  lookPitch * 0.25
);

  controls.update();

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