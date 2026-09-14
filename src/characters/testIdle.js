import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

document.body.appendChild(
  renderer.domElement
);

// ============================================================
// LIGHTING
// ============================================================

scene.add(
  new THREE.HemisphereLight(
    0xffffff,
    0x303030,
    1.8
  )
);

const light =
  new THREE.DirectionalLight(
    0xffffff,
    2.2
  );

light.position.set(
  4,
  7,
  5
);

light.castShadow = true;

scene.add(light);

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
// IDLE MODEL DIRECTLY
// ============================================================

const loader =
  new GLTFLoader();

loader.load(
  '/assets/characters/animations/Idle.glb',

  (gltf) => {

    const model =
      gltf.scene;

    model.traverse(
      (object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      }
    );

    scene.add(model);

    const mixer =
      new THREE.AnimationMixer(
        model
      );

    if (
      gltf.animations &&
      gltf.animations.length > 0
    ) {

      const action =
        mixer.clipAction(
          gltf.animations[0]
        );

      action.setLoop(
        THREE.LoopRepeat,
        Infinity
      );

      action.play();

      console.log(
        'Idle animation:',
        gltf.animations[0].name
      );
    }

    console.log(
      'Idle GLB loaded directly.'
    );

    function update() {

      requestAnimationFrame(
        update
      );

      const dt =
        clock.getDelta();

      mixer.update(dt);

      controls.update();

      renderer.render(
        scene,
        camera
      );
    }

    const controls =
      new OrbitControls(
        camera,
        renderer.domElement
      );

    controls.target.set(
      0,
      0.9,
      0
    );

    controls.enableDamping = true;

    const clock =
      new THREE.Clock();

    update();
  },

  undefined,

  (error) => {
    console.error(
      'Failed to load Idle.glb:',
      error
    );
  }
);

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