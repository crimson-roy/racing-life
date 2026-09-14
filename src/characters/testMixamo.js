import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MixamoPlayer } from './MixamoPlayer.js';
import { EmoteWheel } from '../ui/EmoteWheel.js';

const scene = new THREE.Scene();

scene.background =
  new THREE.Color(0x202020);

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

renderer.shadowMap.enabled = true;

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

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

scene.add(ambient);

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

key.castShadow = true;

scene.add(key);

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

scene.add(rim);

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

ground.receiveShadow = true;

scene.add(ground);

const grid =
  new THREE.GridHelper(
    30,
    30
  );

grid.position.y =
  0.01;

scene.add(grid);

// ============================================================
// PLAYER
// ============================================================

const player =
  new MixamoPlayer();

scene.add(player);

player.position.set(
  0,
  0,
  0
);

// ============================================================
// MOVEMENT SETTINGS
// ============================================================

const WALK_SPEED = 1.4;

const TURN_SPEED =
  THREE.MathUtils.degToRad(110);

const keys = {
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false
};

// ============================================================
// CAMERA CONTROLS
// ============================================================

const controls =
  new OrbitControls(
    camera,
    renderer.domElement
  );

controls.enableDamping = true;
controls.dampingFactor = 0.08;

controls.target.set(
  0,
  0.9,
  0
);

controls.minDistance = 1.5;
controls.maxDistance = 8;

controls.update();

// ============================================================
// HUD
// ============================================================

const hud =
  document.createElement(
    'div'
  );

hud.style.position = 'fixed';
hud.style.top = '20px';
hud.style.left = '20px';
hud.style.padding = '16px 18px';
hud.style.background =
  'rgba(0,0,0,0.75)';
hud.style.color = 'white';
hud.style.fontFamily =
  'Arial, sans-serif';
hud.style.fontSize = '15px';
hud.style.lineHeight = '1.5';
hud.style.borderRadius = '10px';
hud.style.userSelect = 'none';
hud.style.zIndex = '10';
hud.style.minWidth = '270px';

document.body.appendChild(
  hud
);

// ============================================================
// TITLE
// ============================================================

const title =
  document.createElement(
    'div'
  );

title.textContent =
  'RACING LIFE — MIXAMO PLAYER TEST';

title.style.fontSize =
  '18px';

title.style.fontWeight =
  'bold';

title.style.marginBottom =
  '12px';

hud.appendChild(title);

// ============================================================
// STATUS
// ============================================================

const status =
  document.createElement(
    'div'
  );

status.textContent =
  'Status: LOADING';

hud.appendChild(status);

// ============================================================
// HELP
// ============================================================

const help =
  document.createElement(
    'div'
  );

help.style.marginTop =
  '10px';

help.innerHTML =
  'W — Forward<br>' +
  'S — Backward<br>' +
  'A — Turn Left<br>' +
  'D — Turn Right<br>' +
  'E — Emote Wheel<br>' +
  'ESC — Stop / Close';

hud.appendChild(help);

// ============================================================
// EMOTE WHEEL
// ============================================================

const emoteWheel =
  new EmoteWheel({
    onSelect: (emote) => {

      // Playing an emote cancels walking.
      keys.KeyW = false;
      keys.KeyS = false;
      keys.KeyA = false;
      keys.KeyD = false;

      status.textContent =
        `Status: ${emote.label}`;

      player.playEmote(
        emote
      );
    }
  });

// ============================================================
// KEYBOARD DOWN
// ============================================================

window.addEventListener(
  'keydown',
  (event) => {

    // --------------------------------------------------------
    // Movement keys
    // --------------------------------------------------------

    if (
      Object.prototype.hasOwnProperty.call(
        keys,
        event.code
      )
    ) {
      keys[event.code] = true;
    }

    // --------------------------------------------------------
    // Emote wheel
    // --------------------------------------------------------

    if (
      event.code === 'KeyE' &&
      !event.repeat
    ) {
      event.preventDefault();

      emoteWheel.toggle();
    }

    // --------------------------------------------------------
    // Escape
    // --------------------------------------------------------

    if (
      event.code === 'Escape'
    ) {
      emoteWheel.close();

      keys.KeyW = false;
      keys.KeyS = false;
      keys.KeyA = false;
      keys.KeyD = false;

      if (player.emoting) {
        player.cancelEmote();
      } else {
        player.stopWalking();
      }

      status.textContent =
        'Status: IDLE';
    }
  }
);

// ============================================================
// KEYBOARD UP
// ============================================================

window.addEventListener(
  'keyup',
  (event) => {

    if (
      Object.prototype.hasOwnProperty.call(
        keys,
        event.code
      )
    ) {
      keys[event.code] = false;
    }
  }
);

// ============================================================
// TAP CHARACTER TO OPEN EMOTE WHEEL
// ============================================================

const raycaster =
  new THREE.Raycaster();

const pointer =
  new THREE.Vector2();

renderer.domElement.addEventListener(
  'pointerdown',
  (event) => {

    if (
      emoteWheel.isOpen
    ) {
      return;
    }

    if (
      !player.model
    ) {
      return;
    }

    pointer.x =
      (
        event.clientX /
        window.innerWidth
      ) *
      2 -
      1;

    pointer.y =
      -(
        event.clientY /
        window.innerHeight
      ) *
      2 +
      1;

    raycaster.setFromCamera(
      pointer,
      camera
    );

    const hits =
      raycaster.intersectObject(
        player.model,
        true
      );

    if (
      hits.length > 0
    ) {
      emoteWheel.open();
    }
  }
);

// ============================================================
// LOOP
// ============================================================

let previousTime =
  performance.now() / 1000;

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

  previousTime =
    now;

  // ==========================================================
  // MOVEMENT INPUT
  // ==========================================================

  const moving =
    keys.KeyW ||
    keys.KeyS;

  const turning =
    keys.KeyA ||
    keys.KeyD;

  // ==========================================================
  // CANCEL EMOTE WHEN PLAYER ACTS
  // ==========================================================

  if (
    player.emoting &&
    (moving || turning)
  ) {
    player.cancelEmote();

    status.textContent =
      'Status: IDLE';
  }

  // ==========================================================
  // NORMAL PLAYER MOVEMENT
  // ==========================================================

  if (
    !player.emoting
  ) {

    // --------------------------------------------------------
    // WALK / IDLE
    // --------------------------------------------------------

    if (moving) {

      player.startWalking();

      status.textContent =
        'Status: WALKING';

    } else if (
      player.walking
    ) {

      player.stopWalking();

      status.textContent =
        'Status: IDLE';
    }

    // --------------------------------------------------------
    // TURNING
    //
    // A = LEFT
    // D = RIGHT
    // --------------------------------------------------------

    if (keys.KeyA) {

  player.rotation.y +=
    TURN_SPEED * dt;
}

if (keys.KeyD) {

  player.rotation.y -=
    TURN_SPEED * dt;
}

    // --------------------------------------------------------
    // FORWARD / BACKWARD
    //
    // This racer faces +Z.
    //
    // W = +Z
    // S = -Z
    // --------------------------------------------------------

    if (keys.KeyW) {

      player.translateZ(
        WALK_SPEED * dt
      );
    }

    if (keys.KeyS) {

      player.translateZ(
        -WALK_SPEED * dt
      );
    }
  }

  // ==========================================================
  // UPDATE ANIMATION MIXER
  // ==========================================================

  player.update(dt);

  // ==========================================================
  // CAMERA FOLLOW
  // ==========================================================

  const target =
    new THREE.Vector3(
      player.position.x,
      player.position.y + 0.9,
      player.position.z
    );

  controls.target.lerp(
    target,
    0.08
  );

  controls.update();

  // ==========================================================
  // RENDER
  // ==========================================================

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