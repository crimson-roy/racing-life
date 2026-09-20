import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const container = document.getElementById('retarget-test');
const status = document.getElementById('status');
const playPause = document.getElementById('play-pause');
const restart = document.getElementById('restart');
const speed = document.getElementById('speed');

const ASSET =
  '/assets/characters/retarget-tests/surprise-uppercut-prototype.glb';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11161d);

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / Math.max(1, window.innerHeight),
  0.1,
  100
);
camera.position.set(3.2, 1.9, 4.8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1.0, 0);
controls.minDistance = 2.2;
controls.maxDistance = 8;
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x1e2732, 2.0));

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(4, 7, 5);
key.castShadow = true;
scene.add(key);

const rim = new THREE.DirectionalLight(0xff6339, 1.0);
rim.position.set(-4, 4, -3);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(3.2, 64),
  new THREE.MeshStandardMaterial({
    color: 0x202832,
    roughness: 0.92,
    metalness: 0.02
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(8, 16, 0x39424f, 0x252c35);
grid.position.y = 0.002;
scene.add(grid);

let mixer = null;
let action = null;
let model = null;
let paused = false;
let elapsed = 0;
let clipDuration = 0;

function normalizeAndGround(object) {
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);

  if (size.y > 0) {
    object.scale.multiplyScalar(1.78 / size.y);
  }

  object.updateMatrixWorld(true);

  const finalBox = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  finalBox.getCenter(center);

  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= finalBox.min.y;

  object.updateMatrixWorld(true);
}

function updateStatus() {
  if (!action || !clipDuration) return;
  const time = action.time % clipDuration;
  status.textContent =
    'Playing · ' +
    time.toFixed(2) +
    ' / ' +
    clipDuration.toFixed(2) +
    ' s · ' +
    speed.value +
    '×';
}

new GLTFLoader().load(
  ASSET,
  (gltf) => {
    model = gltf.scene;
    model.name = 'RetargetPrototype';

    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    normalizeAndGround(model);
    scene.add(model);

    if (!gltf.animations?.length) {
      status.textContent = 'Loaded, but no animation clip was found.';
      return;
    }

    mixer = new THREE.AnimationMixer(model);

    const clip = gltf.animations[0];
    clipDuration = clip.duration;

    action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.play();

    status.textContent =
      'Loaded · ' +
      clip.name +
      ' · ' +
      clip.duration.toFixed(2) +
      ' s';
  },
  undefined,
  (error) => {
    console.error('Retarget test asset failed to load:', error);
    status.textContent =
      'Retarget GLB not found. Run RacingLife-Blender.bat retarget-test first.';
  }
);

playPause.addEventListener('click', () => {
  if (!action) return;
  paused = !paused;
  action.paused = paused;
  playPause.textContent = paused ? 'Play' : 'Pause';
});

restart.addEventListener('click', () => {
  if (!action) return;
  action.reset();
  action.paused = false;
  paused = false;
  playPause.textContent = 'Pause';
  action.play();
});

speed.addEventListener('change', () => {
  if (!action) return;
  action.setEffectiveTimeScale(Number(speed.value) || 1);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (mixer) {
    mixer.update(dt);
  }

  controls.update();
  updateStatus();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});
