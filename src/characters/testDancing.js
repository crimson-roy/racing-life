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
document.body.style.overflow = 'hidden';

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

grid.position.y = 0.01;

scene.add(grid);

// ============================================================
// DANCING GLB
// ============================================================

const loader =
  new GLTFLoader();

loader.load(
  '/assets/characters/animations/Dancing.glb',

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

    // --------------------------------------------------------
    // Ground the imported Dancing GLB.
    // --------------------------------------------------------

    model.updateMatrixWorld(true);

    const box =
      new THREE.Box3().setFromObject(
        model
      );

    model.position.y -=
      box.min.y;

    // --------------------------------------------------------
    // Animation
    // --------------------------------------------------------

    if (
      gltf.animations &&
      gltf.animations.length > 0
    ) {

      const mixer =
        new THREE.AnimationMixer(
          model
        );

      const action =
        mixer.clipAction(
          gltf.animations[0]
        );

      action.setLoop(
        THREE.LoopRepeat,
        Infinity
      );

      action.clampWhenFinished =
        false;

      action.play();

      console.log(
        'Dancing animation:',
        gltf.animations[0].name
      );

      const clock =
        new THREE.Clock();

      function animate() {

        requestAnimationFrame(
          animate
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

      controls.enableDamping = true;

      controls.dampingFactor =
        0.08;

      controls.target.set(
        0,
        0.9,
        0
      );

      controls.minDistance = 1.5;
      controls.maxDistance = 8;

      controls.update();

      animate();
    }

    console.log(
      'Dancing.glb loaded successfully.'
    );
  },

  undefined,

  (error) => {
    console.error(
      'Failed to load Dancing.glb:',
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