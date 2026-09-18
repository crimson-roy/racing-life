import './ui.css';
import * as THREE from 'three';

import { HomeScene } from './scenes/HomeScene.js';
import { FreeRoamScene } from './scenes/FreeRoamScene.js';
import { RaceScene3D } from './scenes/RaceScene3D.js';
import { MatchManager } from './racing/MatchManager.js';

const STORAGE_KEY =
  'racingLifeProfile';

// ============================================================
// GLOBAL STATE
// ============================================================

const state = {
  screen: 'welcome',

  racerName: '',

  age: 18,

  character: {
    head: 1,
    face: 1,
    hair: 1,
    outfit: 1,
    helmet: 1,
  },
};

// ============================================================
// 3D SCENES
// ============================================================

let homeScene = null;

let freeRoamScene = null;

let raceScene3D = null;

const matchManager =
  new MatchManager({
    factionA: 'azure',
    factionB: 'crimson',
    winTarget: 3
  });

// ============================================================
// CHARACTER CREATOR OPTIONS
// ============================================================

const characterOptions = {

  head: [
    'Round',
    'Square',
    'Soft',
    'Angular',
    'Sport'
  ],

  face: [
    'Calm',
    'Focused',
    'Confident',
    'Friendly',
    'Determined'
  ],

  hair: [
    'Short',
    'Fade',
    'Curly',
    'Spiky',
    'Long'
  ],

  outfit: [
    'Racing',
    'Street',
    'Track',
    'Classic'
  ],

  helmet: [
    'Open',
    'Full',
    'Visor',
    'Pro'
  ]

};

// ============================================================
// LOAD PROFILE
// ============================================================

function loadProfile() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(
          STORAGE_KEY
        ) || 'null'
      );

    if (!saved) {

      return false;

    }

    state.racerName =
      saved.racerName || '';

    state.age =
      Number(saved.age) || 18;

    state.character = {
      ...state.character,
      ...(saved.character || {})
    };

    return Boolean(
      state.racerName
    );

  } catch {

    return false;

  }

}

// ============================================================
// SAVE PROFILE
// ============================================================

function saveProfile() {

  localStorage.setItem(

    STORAGE_KEY,

    JSON.stringify({

      racerName:
        state.racerName,

      age:
        state.age,

      character:
        state.character,

    })

  );

}

// ============================================================
// ROOT
// ============================================================

const root =
  document.getElementById(
    'game'
  );

// ============================================================
// BASE HTML
// ============================================================

root.innerHTML = `

  <div class="app-shell">

    <div
      class="scene-layer"
      aria-hidden="true"
    ></div>

    <div
      class="grain"
      aria-hidden="true"
    ></div>

    <main class="ui-layer">

      <!-- ================================================= -->
      <!-- WELCOME -->
      <!-- ================================================= -->

      <section
        class="screen active"
        data-screen="welcome"
      >

        <div class="hero-card welcome-card">

          <div class="eyebrow">
            RACING LIFE
          </div>

          <h1>
            Start your racing life.
          </h1>

          <p class="lead">
            Build your racer, make your first career decision,
            then take the wheel.
          </p>

          <button
            class="primary"
            data-action="new-career"
          >
            START NEW CAREER
          </button>

          <button
            class="ghost subtle"
            data-action="continue"
            hidden
          >
            CONTINUE CAREER
          </button>

          <p class="tiny">
            Your profile is saved on this device.
          </p>

        </div>

      </section>

      <!-- ================================================= -->
      <!-- NAME -->
      <!-- ================================================= -->

      <section
        class="screen"
        data-screen="name"
      >

        <div class="form-card">

          <div class="step">
            01 / 04
          </div>

          <h2>
            What should we call you?
          </h2>

          <p>
            Choose the name that will appear on your profile,
            race results and career screens.
          </p>

          <label
            class="field-label"
            for="name-input"
          >
            Preferred name
          </label>

          <input
            id="name-input"
            maxlength="18"
            autocomplete="off"
            placeholder="Enter your name"
          />

          <p
            class="error"
            id="name-error"
          ></p>

          <div class="actions">

            <button
              class="ghost"
              data-action="back-welcome"
            >
              BACK
            </button>

            <button
              class="primary"
              data-action="to-age"
            >
              NEXT
            </button>

          </div>

        </div>

      </section>

      <!-- ================================================= -->
      <!-- AGE -->
      <!-- ================================================= -->

      <section
        class="screen"
        data-screen="age"
      >

        <div class="form-card age-card">

          <div class="step">
            02 / 04
          </div>

          <h2>
            Tell us a little about your racer.
          </h2>

          <p>
            Your age is stored as part of the career profile.
            It doesn't affect driving performance.
          </p>

          <label
            class="field-label"
            for="age-input"
          >
            Age
          </label>

          <div class="age-row">

            <button
              class="round-btn"
              data-action="age-down"
              aria-label="Decrease age"
            >
              −
            </button>

            <input
              id="age-input"
              type="number"
              min="13"
              max="80"
              value="18"
            />

            <button
              class="round-btn"
              data-action="age-up"
              aria-label="Increase age"
            >
              +
            </button>

          </div>

          <p
            class="error"
            id="age-error"
          ></p>

          <div class="actions">

            <button
              class="ghost"
              data-action="back-name"
            >
              BACK
            </button>

            <button
              class="primary"
              data-action="to-creator"
            >
              NEXT
            </button>

          </div>

        </div>

      </section>

      <!-- ================================================= -->
      <!-- CHARACTER CREATOR -->
      <!-- ================================================= -->

      <section
        class="screen creator-screen"
        data-screen="creator"
      >

        <div class="creator-layout">

          <div class="creator-copy panel">

            <div class="step">
              03 / 04
            </div>

            <h2>
              Create your racer.
            </h2>

            <p>
              Choose a starter look. We'll turn these into
              fully modelled character assets as the 3D
              career system grows.
            </p>

            <div class="selector-grid">

              ${Object.entries(
                characterOptions
              ).map(
                ([key, options]) => `

                  <div class="selector-row">

                    <span>
                      ${
                        key[0].toUpperCase() +
                        key.slice(1)
                      }
                    </span>

                    <div
                      class="selector-controls"
                    >

                      <button
                        class="small-btn"
                        data-action="prev-${key}"
                        aria-label="Previous ${key}"
                      >
                        ‹
                      </button>

                      <strong
                        data-value="${key}"
                      >
                        ${options[0]}
                      </strong>

                      <button
                        class="small-btn"
                        data-action="next-${key}"
                        aria-label="Next ${key}"
                      >
                        ›
                      </button>

                    </div>

                  </div>

                `
              ).join('')}

            </div>

            <div class="actions">

              <button
                class="ghost"
                data-action="back-age"
              >
                BACK
              </button>

              <button
                class="primary"
                data-action="finish-creator"
              >
                CONFIRM RACER
              </button>

            </div>

          </div>

          <!-- ============================================= -->
          <!-- CREATOR PREVIEW -->
          <!-- ============================================= -->

          <div
            class="preview-panel panel"
          >

            <div
              class="preview-top"
            >

              <span>
                3D PREVIEW
              </span>

              <span
                class="preview-tag"
                id="preview-tag"
              >
                ROOKIE
              </span>

            </div>

            <div
              class="character-preview"
              id="character-preview"
            ></div>

          </div>

        </div>

      </section>

      <!-- ================================================= -->
      <!-- REAL 3D HOME -->
      <!-- ================================================= -->

      <section
        class="screen"
        data-screen="home"
      >

        <div
          id="home-3d-root"
          style="
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100%;
          "
        ></div>

      </section>

      <!-- ================================================= -->
      <!-- PLACEHOLDER -->
      <!-- ================================================= -->

      <section
        class="screen"
        data-screen="placeholder"
      >

        <div class="form-card">

          <div class="eyebrow">
            COMING NEXT
          </div>

          <h2
            id="placeholder-title"
          >
            Race
          </h2>

          <p
            id="placeholder-text"
          >
            This feature is coming next.
          </p>

          <button
            class="primary"
            data-action="back-home"
          >
            BACK TO HOME
          </button>

        </div>

      </section>

    </main>

  </div>

`;

// ============================================================
// START HOME SCENE
// ============================================================

function startHomeScene() {

  const container =
    document.getElementById(
      'home-3d-root'
    );

  if (!container) {

    console.error(
      'Racing Life: #home-3d-root not found.'
    );

    return;

  }

  // ----------------------------------------------------------
  // CREATE HOME ONLY ONCE
  // ----------------------------------------------------------

  if (!homeScene) {

    homeScene =
      new HomeScene({

        container,

        // ======================================================
        // FREE ROAM
        // ======================================================

        onFreeRoam: () => {

          console.log(
            'Racing Life: entering FREE ROAM.'
          );

          enterFreeRoam();

        },

        // ======================================================
        // NEXT MATCH
        // ======================================================

        onNextMatch: () => {

          console.log(
            'Racing Life: NEXT MATCH selected.'
          );

          enterNextMatch();

        },

        // ======================================================
        // GARAGE
        // ======================================================

        onGarage: () => {

          console.log(
            'Racing Life: GARAGE selected.'
          );

          const title =
            document.getElementById(
              'placeholder-title'
            );

          const text =
            document.getElementById(
              'placeholder-text'
            );

          if (title) {

            title.textContent =
              'Garage';

          }

          if (text) {

            text.textContent =
              'The Garage will be connected here next with the Western Bagger and BFInjection.';

          }

          showScreen(
            'placeholder'
          );

        },

        // ======================================================
        // COMING SOON
        // ======================================================

        onComingSoon: (
          name
        ) => {

          const prettyName =
            String(name)
              .replace(
                /-/g,
                ' '
              )
              .replace(
                /\b\w/g,
                (
                  character
                ) =>
                  character.toUpperCase()
              );

          const title =
            document.getElementById(
              'placeholder-title'
            );

          const text =
            document.getElementById(
              'placeholder-text'
            );

          if (title) {

            title.textContent =
              prettyName;

          }

          if (text) {

            text.textContent =
              `${prettyName} is coming soon.`;

          }

          showScreen(
            'placeholder'
          );

        }

      });

  }

  // ----------------------------------------------------------
  // SHOW HOME RENDERER
  // ----------------------------------------------------------

  if (
    homeScene.renderer &&
    homeScene.renderer.domElement
  ) {

    homeScene.renderer.domElement.style.display =
      'block';

  }

  if (
    homeScene.ui
  ) {

    homeScene.ui.style.display =
      'block';

  }

}

// ============================================================
// ENTER NEXT 3D RACE
// ============================================================

function enterNextMatch() {

  const homeScreen =
    root.querySelector(
      '[data-screen="home"]'
    );

  if (homeScreen) {
    homeScreen.classList.remove(
      'active'
    );
  }

  const uiLayer =
    root.querySelector(
      '.ui-layer'
    );

  if (uiLayer) {
    uiLayer.style.pointerEvents =
      'none';
  }

  state.screen =
    'race-3d';

  if (homeScene) {

    homeScene.dispose();

    homeScene =
      null;

  }

  const homeContainer =
    document.getElementById(
      'home-3d-root'
    );

  if (homeContainer) {

    homeContainer.innerHTML =
      '';

  }

  if (
    matchManager.completed
  ) {

    matchManager.reset();

  }

  const session =
    matchManager.getCurrentRace();

  if (!session) {

    console.warn(
      'Racing Life: no race session available.'
    );

    exitRace3D();

    return;

  }

  if (!raceScene3D) {

    raceScene3D =
      new RaceScene3D({

        container:
          document.body,

        session,

        onExit: () => {

          exitRace3D();

        }

      });

  }

}

// ============================================================
// EXIT 3D RACE
// ============================================================

function exitRace3D() {

  if (raceScene3D) {

    raceScene3D.dispose();

    raceScene3D =
      null;

  }

  const uiLayer =
    root.querySelector(
      '.ui-layer'
    );

  if (uiLayer) {

    uiLayer.style.pointerEvents =
      'auto';

  }

  state.screen =
    'home';

  showScreen(
    'home'
  );

}

// ============================================================
// ENTER FREE ROAM
// ============================================================

function enterFreeRoam() {

  // ----------------------------------------------------------
  // Remove the active Home screen from above the Free Roam
  // canvas so mouse input can reach Three.js / OrbitControls.
  // ----------------------------------------------------------

  const homeScreen =
    root.querySelector(
      '[data-screen="home"]'
    );

  if (homeScreen) {
    homeScreen.classList.remove(
      'active'
    );
  }

  // ----------------------------------------------------------
  // Disable the main HTML UI layer while Free Roam is active.
  // FreeRoamScene has its own UI.
  // ----------------------------------------------------------

  const uiLayer =
    root.querySelector(
      '.ui-layer'
    );

  if (uiLayer) {
    uiLayer.style.pointerEvents =
      'none';
  }

  state.screen =
    'free-roam';

  // ----------------------------------------------------------
  // Dispose Home scene.
  // ----------------------------------------------------------

  if (homeScene) {

    homeScene.dispose();

    homeScene =
      null;
  }

  // ----------------------------------------------------------
  // Clear the Home 3D container.
  // ----------------------------------------------------------

  const homeContainer =
    document.getElementById(
      'home-3d-root'
    );

  if (homeContainer) {

    homeContainer.innerHTML =
      '';

  }

  // ----------------------------------------------------------
  // Create Free Roam.
  // ----------------------------------------------------------

  if (!freeRoamScene) {

    freeRoamScene =
      new FreeRoamScene({

        container:
          document.body,

        onExit: () => {

          exitFreeRoam();

        }

      });

  }
}

// ============================================================
// EXIT FREE ROAM
// ============================================================

function exitFreeRoam() {

  // ----------------------------------------------------------
  // Dispose Free Roam.
  // ----------------------------------------------------------

  if (freeRoamScene) {

    freeRoamScene.dispose();

    freeRoamScene =
      null;

  }

  // ----------------------------------------------------------
  // Restore normal UI input.
  // ----------------------------------------------------------

  const uiLayer =
    root.querySelector(
      '.ui-layer'
    );

  if (uiLayer) {

    uiLayer.style.pointerEvents =
      'auto';

  }

  state.screen =
    'home';

  // ----------------------------------------------------------
  // Return to Home.
  // ----------------------------------------------------------

  showScreen(
    'home'
  );
}

// ============================================================
// SHOW SCREEN
// ============================================================

function showScreen(
  name
) {

  state.screen =
    name;

  // ----------------------------------------------------------
  // CHANGE ACTIVE HTML SCREEN
  // ----------------------------------------------------------

  root
    .querySelectorAll(
      '.screen'
    )
    .forEach(
      (screen) => {

        screen.classList.toggle(
          'active',
          screen.dataset.screen ===
            name
        );

      }
    );

  // ----------------------------------------------------------
  // HOME
  // ----------------------------------------------------------

  if (
    name === 'home'
  ) {

    updateHome();

    startHomeScene();

  }

  // ----------------------------------------------------------
  // HIDE HOME WHEN LEAVING HOME
  // ----------------------------------------------------------

  if (
    homeScene &&
    name !== 'home'
  ) {

    if (
      homeScene.renderer &&
      homeScene.renderer.domElement
    ) {

      homeScene.renderer.domElement.style.display =
        'none';

    }

    if (
      homeScene.ui
    ) {

      homeScene.ui.style.display =
        'none';

    }

  }

  // ----------------------------------------------------------
  // CREATOR PREVIEW
  // ----------------------------------------------------------

  updateCharacterPreview();

}

// ============================================================
// AGE CLAMP
// ============================================================

function clampAge(
  value
) {

  return Math.min(
    80,
    Math.max(
      13,
      Number(value) || 18
    )
  );

}

// ============================================================
// NAME VALIDATION
// ============================================================

function validateName() {

  const input =
    document.getElementById(
      'name-input'
    );

  const value =
    input.value
      .trim()
      .replace(
        /\s+/g,
        ' '
      );

  const error =
    document.getElementById(
      'name-error'
    );

  if (
    value.length < 2
  ) {

    error.textContent =
      'Enter at least 2 characters.';

    input.focus();

    return false;

  }

  state.racerName =
    value;

  error.textContent =
    '';

  return true;

}

// ============================================================
// AGE VALIDATION
// ============================================================

function validateAge() {

  const input =
    document.getElementById(
      'age-input'
    );

  const age =
    Number(
      input.value
    );

  const error =
    document.getElementById(
      'age-error'
    );

  if (
    !Number.isFinite(age) ||
    age < 13 ||
    age > 80
  ) {

    error.textContent =
      'Choose an age from 13 to 80.';

    input.focus();

    return false;

  }

  state.age =
    Math.round(
      age
    );

  error.textContent =
    '';

  return true;

}

// ============================================================
// SELECTOR INDEX
// ============================================================

function selectorIndex(
  key
) {

  return (
    state.character[key] -
    1
  );

}

// ============================================================
// CYCLE CHARACTER OPTION
// ============================================================

function cycle(
  key,
  amount
) {

  const options =
    characterOptions[key];

  const next =
    (
      selectorIndex(key) +
      amount +
      options.length
    ) %
    options.length;

  state.character[key] =
    next + 1;

  updateCharacterPreview();

}

// ============================================================
// UPDATE CREATOR LABELS
// ============================================================

function updateCreatorLabels() {

  Object.keys(
    characterOptions
  ).forEach(
    (key) => {

      const target =
        root.querySelector(
          `[data-value="${key}"]`
        );

      if (target) {

        target.textContent =
          characterOptions[key][
            selectorIndex(key)
          ];

      }

    }
  );

}

// ============================================================
// CHARACTER CREATOR PREVIEW
// ============================================================
//
// This old primitive preview is intentionally kept for the
// Character Creator.
//
// The Home screen uses the real MixamoPlayer.
// ============================================================

function buildCharacterPreview(
  container,
  large = false
) {

  container.innerHTML =
    '';

  const previewScene =
    new THREE.Scene();

  previewScene.background =
    new THREE.Color(
      0x11161d
    );

  const camera =
    new THREE.PerspectiveCamera(
      24,
      1,
      0.1,
      50
    );

  camera.position.set(
    0,
    2.78,
    8.5
  );

  camera.lookAt(
    0,
    1.45,
    0
  );

  const renderer =
    new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      2
    )
  );

  renderer.domElement.className =
    'character-canvas';

  container.appendChild(
    renderer.domElement
  );

  // ----------------------------------------------------------
  // LIGHTING
  // ----------------------------------------------------------

  const hemi =
    new THREE.HemisphereLight(
      0xffffff,
      0x20252c,
      2.2
    );

  previewScene.add(
    hemi
  );

  const keyLight =
    new THREE.DirectionalLight(
      0xffffff,
      2.2
    );

  keyLight.position.set(
    3.5,
    6.5,
    5.5
  );

  keyLight.castShadow =
    true;

  previewScene.add(
    keyLight
  );

  const rim =
    new THREE.PointLight(
      0xff5a2f,
      8,
      11
    );

  rim.position.set(
    -3.5,
    2.5,
    2.8
  );

  previewScene.add(
    rim
  );

  // ----------------------------------------------------------
  // CHARACTER GROUP
  // ----------------------------------------------------------

  const group =
    new THREE.Group();

  group.position.y =
    0.10;

  group.rotation.z =
    0.045;

  group.position.x =
    0.02;

  previewScene.add(
    group
  );

  // ----------------------------------------------------------
  // MATERIALS
  // ----------------------------------------------------------

  const skinTones = [
    0xc98e6f,
    0xb87355,
    0x8f5b43,
    0xe0ab86,
    0x704332
  ];

  const skin =
    new THREE.MeshStandardMaterial({
      color:
        skinTones[
          (state.character.face - 1) %
          skinTones.length
        ],
      roughness:
        0.82
    });

  const hairColors = [
    0x171717,
    0x3a2417,
    0x5b3925,
    0x6d6d6d,
    0x2b2f36
  ];

  const hairMat =
    new THREE.MeshStandardMaterial({
      color:
        hairColors[
          selectorIndex('hair')
        ],
      roughness:
        0.9
    });

  const outfitPresets = [

    {
      top: 0xb92525,
      trim: 0xf3f3f3,
      pants: 0x20242b,
      shoes: 0x17191d,
      accent: 0xffa052
    },

    {
      top: 0x2b4c96,
      trim: 0xdbe8ff,
      pants: 0x161a22,
      shoes: 0x17191d,
      accent: 0x69a7ff
    },

    {
      top: 0x2e7f55,
      trim: 0xf3f7f4,
      pants: 0x20251f,
      shoes: 0x17191d,
      accent: 0x6bdca1
    },

    {
      top: 0x8c5e2c,
      trim: 0xf4dfbf,
      pants: 0x26201b,
      shoes: 0x17191d,
      accent: 0xffc16e
    }

  ];

  const outfit =
    outfitPresets[
      selectorIndex('outfit')
    ];

  const mat = (
    color,
    roughness = 0.78,
    metalness = 0
  ) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness
    });

  const add = (
    geometry,
    material,
    position,
    scale = [1, 1, 1],
    rotation = [0, 0, 0]
  ) => {

    const mesh =
      new THREE.Mesh(
        geometry,
        material
      );

    mesh.position.set(
      ...position
    );

    mesh.scale.set(
      ...scale
    );

    mesh.rotation.set(
      ...rotation
    );

    mesh.castShadow =
      true;

    mesh.receiveShadow =
      true;

    group.add(
      mesh
    );

    return mesh;

  };

  // ----------------------------------------------------------
  // LEGS
  // ----------------------------------------------------------

  const pantsMat =
    mat(
      outfit.pants,
      0.95
    );

  const shoeMat =
    mat(
      outfit.shoes,
      0.5
    );

  const kneeMat =
    mat(
      outfit.pants,
      0.9
    );

  add(
    new THREE.CapsuleGeometry(
      0.19,
      0.60,
      5,
      12
    ),
    pantsMat,
    [-0.27, 0.10, 0],
    [1, 1, 1],
    [0, 0, -0.035]
  );

  add(
    new THREE.CapsuleGeometry(
      0.19,
      0.60,
      5,
      12
    ),
    pantsMat,
    [0.27, 0.16, 0],
    [1, 1, 1],
    [0, 0, 0.035]
  );

  add(
    new THREE.SphereGeometry(
      0.175,
      14,
      10
    ),
    kneeMat,
    [-0.28, -0.30, 0.02]
  );

  add(
    new THREE.SphereGeometry(
      0.175,
      14,
      10
    ),
    kneeMat,
    [0.28, -0.23, 0.02]
  );

  add(
    new THREE.CapsuleGeometry(
      0.155,
      0.74,
      5,
      12
    ),
    pantsMat,
    [-0.27, -0.76, 0.01],
    [1, 1, 1],
    [0, 0, 0.035]
  );

  add(
    new THREE.CapsuleGeometry(
      0.155,
      0.74,
      5,
      12
    ),
    pantsMat,
    [0.27, -0.69, 0.01],
    [1, 1, 1],
    [0, 0, -0.035]
  );

  add(
    new THREE.BoxGeometry(
      0.34,
      0.18,
      0.78
    ),
    shoeMat,
    [-0.27, -1.24, 0.14],
    [1.1, 0.9, 1.25]
  );

  add(
    new THREE.BoxGeometry(
      0.34,
      0.18,
      0.78
    ),
    shoeMat,
    [0.27, -1.17, 0.14],
    [1.1, 0.9, 1.25]
  );

  // ----------------------------------------------------------
  // HIPS + WAIST
  // ----------------------------------------------------------

  add(
    new THREE.CylinderGeometry(
      0.48,
      0.52,
      0.36,
      18
    ),
    pantsMat,
    [0, 0.46, 0]
  );

  add(
    new THREE.CylinderGeometry(
      0.43,
      0.47,
      0.30,
      18
    ),
    mat(
      outfit.top
    ),
    [0, 0.72, 0]
  );

  // ----------------------------------------------------------
  // TORSO
  // ----------------------------------------------------------

  const shoulderMat =
    mat(
      outfit.top,
      0.70
    );

  add(
    new THREE.CapsuleGeometry(
      0.42,
      0.30,
      7,
      18
    ),
    mat(
      outfit.top,
      0.72
    ),
    [0, 1.35, 0],
    [1.0, 0.88, 0.78]
  );

  add(
    new THREE.CapsuleGeometry(
      0.155,
      1.05,
      6,
      12
    ),
    shoulderMat,
    [0, 1.82, 0],
    [1, 1, 1],
    [0, 0, Math.PI / 2]
  );

  // ----------------------------------------------------------
  // SHIRT DETAILS
  // ----------------------------------------------------------

  add(
    new THREE.BoxGeometry(
      0.34,
      0.62,
      0.05
    ),
    mat(
      outfit.trim,
      0.68
    ),
    [0, 1.42, 0.32]
  );

  add(
    new THREE.BoxGeometry(
      0.06,
      0.66,
      0.045
    ),
    mat(
      outfit.accent,
      0.6,
      0.05
    ),
    [-0.16, 1.42, 0.34]
  );

  add(
    new THREE.BoxGeometry(
      0.06,
      0.66,
      0.045
    ),
    mat(
      outfit.accent,
      0.6,
      0.05
    ),
    [0.16, 1.42, 0.34]
  );

  const seamMat =
    mat(
      outfit.trim,
      0.9
    );

  const foldMat =
    mat(
      outfit.accent,
      0.86
    );

  add(
    new THREE.BoxGeometry(
      0.50,
      0.022,
      0.03
    ),
    seamMat,
    [0, 1.78, 0.32]
  );

  add(
    new THREE.BoxGeometry(
      0.026,
      0.28,
      0.026
    ),
    foldMat,
    [-0.22, 1.30, 0.30]
  );

  add(
    new THREE.BoxGeometry(
      0.026,
      0.22,
      0.026
    ),
    foldMat,
    [0.22, 1.20, 0.30]
  );

  add(
    new THREE.BoxGeometry(
      0.30,
      0.022,
      0.03
    ),
    seamMat,
    [-0.27, 0.68, 0.31]
  );

  add(
    new THREE.BoxGeometry(
      0.30,
      0.022,
      0.03
    ),
    seamMat,
    [0.27, 0.68, 0.31]
  );

  // ----------------------------------------------------------
  // NECK + HEAD
  // ----------------------------------------------------------

  add(
    new THREE.CylinderGeometry(
      0.13,
      0.16,
      0.26,
      18
    ),
    skin,
    [0, 1.98, 0]
  );

  const headScale =
    [
      1.0,
      1.08,
      0.98,
      1.04,
      1.01
    ][
      selectorIndex('head')
    ];

  add(
    new THREE.SphereGeometry(
      0.35,
      32,
      24
    ),
    skin,
    [0, 2.44, 0],
    [
      0.92 * headScale,
      1.05,
      0.9
    ]
  );

  // ----------------------------------------------------------
  // EARS
  // ----------------------------------------------------------

  add(
    new THREE.SphereGeometry(
      0.05,
      14,
      10
    ),
    skin,
    [-0.34, 2.44, 0]
  );

  add(
    new THREE.SphereGeometry(
      0.05,
      14,
      10
    ),
    skin,
    [0.34, 2.44, 0]
  );

  // ----------------------------------------------------------
  // NOSE
  // ----------------------------------------------------------

  add(
    new THREE.ConeGeometry(
      0.04,
      0.10,
      12
    ),
    skin,
    [0, 2.39, 0.32],
    [1, 1, 1],
    [
      Math.PI / 2,
      0,
      0
    ]
  );

  // ----------------------------------------------------------
  // MOUTH
  // ----------------------------------------------------------

  add(
    new THREE.BoxGeometry(
      0.11,
      0.02,
      0.015
    ),
    mat(
      0x7f3b35,
      0.8
    ),
    [0, 2.30, 0.34]
  );

  // ----------------------------------------------------------
  // EYES + BROWS
  // ----------------------------------------------------------

  const eyeMat =
    mat(
      0x1a1d22,
      0.42
    );

  const browMat =
    mat(
      0x2a211c,
      0.95
    );

  const faceShapeOffset =
    (
      selectorIndex('face') -
      2
    ) *
    0.007;

  for (
    const x
    of [-0.12, 0.12]
  ) {

    add(
      new THREE.SphereGeometry(
        0.035,
        16,
        12
      ),
      eyeMat,
      [
        x,
        2.54 +
          faceShapeOffset,
        0.31
      ]
    );

    add(
      new THREE.BoxGeometry(
        0.08,
        0.013,
        0.015
      ),
      browMat,
      [
        x,
        2.54 +
          faceShapeOffset,
        0.31
      ],
      [1, 1, 1],
      [
        0,
        0,
        x < 0
          ? -0.08
          : 0.08
      ]
    );

  }

  // ----------------------------------------------------------
  // HAIR
  // ----------------------------------------------------------

  const hairType =
    selectorIndex('hair');

  add(
    new THREE.SphereGeometry(
      0.37,
      28,
      20,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.55
    ),
    hairMat,
    [0, 2.61, 0],
    [1, 0.9, 0.96]
  );

  if (
    hairType === 1
  ) {

    group.children[
      group.children.length - 1
    ].scale.set(
      1.02,
      0.95,
      1.04
    );

  }

  if (
    hairType === 2
  ) {

    for (
      const x
      of [
        -0.20,
        -0.07,
        0.07,
        0.20
      ]
    ) {

      add(
        new THREE.SphereGeometry(
          0.11,
          16,
          12
        ),
        hairMat,
        [x, 2.72, 0.01],
        [1.1, 0.8, 1]
      );

    }

  }

  if (
    hairType === 3
  ) {

    for (
      const x
      of [
        -0.19,
        -0.06,
        0.07,
        0.20
      ]
    ) {

      add(
        new THREE.ConeGeometry(
          0.07,
          0.17,
          8
        ),
        hairMat,
        [x, 2.74, 0.01],
        [1, 1, 1],
        [
          0,
          0,
          x * 0.55
        ]
      );

    }

  }

  if (
    hairType === 4
  ) {

    add(
      new THREE.CapsuleGeometry(
        0.06,
        0.43,
        5,
        10
      ),
      hairMat,
      [0, 2.42, -0.24],
      [1.5, 1, 0.9],
      [
        Math.PI / 2,
        0,
        0
      ]
    );

  }

  // ----------------------------------------------------------
  // ARMS
  // ----------------------------------------------------------

  const sleeveMat =
    mat(
      outfit.top,
      0.72
    );

  const forearmMat =
    mat(
      outfit.top,
      0.78
    );

  add(
    new THREE.CapsuleGeometry(
      0.16,
      0.42,
      5,
      12
    ),
    sleeveMat,
    [-0.82, 1.45, 0],
    [1, 1, 1],
    [
      0,
      0,
      0.10
    ]
  );

  add(
    new THREE.CapsuleGeometry(
      0.12,
      0.46,
      5,
      12
    ),
    forearmMat,
    [-0.98, 1.03, 0.02],
    [1, 1, 1],
    [
      0,
      0,
      0.30
    ]
  );

  add(
    new THREE.SphereGeometry(
      0.12,
      16,
      12
    ),
    skin,
    [-1.05, 0.67, 0.03]
  );

  add(
    new THREE.CapsuleGeometry(
      0.16,
      0.42,
      5,
      12
    ),
    sleeveMat,
    [0.82, 1.41, 0],
    [1, 1, 1],
    [
      0,
      0,
      -0.08
    ]
  );

  add(
    new THREE.CapsuleGeometry(
      0.12,
      0.42,
      5,
      12
    ),
    forearmMat,
    [0.94, 1.13, 0.05],
    [1, 1, 1],
    [
      0,
      0,
      -0.38
    ]
  );

  add(
    new THREE.SphereGeometry(
      0.12,
      16,
      12
    ),
    skin,
    [0.98, 0.83, 0.08]
  );

  // ----------------------------------------------------------
  // FINGERS
  // ----------------------------------------------------------

  for (
    const x
    of [-1, 1]
  ) {

    const baseX =
      x < 0
        ? -1.05
        : 0.98;

    const baseY =
      x < 0
        ? 0.63
        : 0.79;

    for (
      let f = -1;
      f <= 1;
      f++
    ) {

      add(
        new THREE.CapsuleGeometry(
          0.028,
          0.10,
          4,
          8
        ),
        skin,
        [
          baseX +
            f * 0.034,
          baseY -
            0.07,
          0.075 +
            Math.abs(f) *
            0.004
        ]
      );

    }

  }

  // ----------------------------------------------------------
  // HELMET
  // ----------------------------------------------------------

  const helmetColors = [
    0x2b3139,
    0xf2f2f2,
    0x1b5eaa,
    0xd66e22
  ];

  if (
    selectorIndex('helmet') >
    0
  ) {

    const helmetMat =
      mat(
        helmetColors[
          selectorIndex('helmet')
        ],
        0.38,
        0.12
      );

    add(
      new THREE.SphereGeometry(
        0.41,
        32,
        20,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.62
      ),
      helmetMat,
      [0, 2.64, 0]
    );

    const visor =
      add(
        new THREE.SphereGeometry(
          0.22,
          24,
          16,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.42
        ),
        mat(
          0x101820,
          0.18,
          0.65
        ),
        [0, 2.55, 0.28]
      );

    visor.rotation.x =
      Math.PI;

    add(
      new THREE.BoxGeometry(
        0.34,
        0.03,
        0.05
      ),
      mat(
        0xffffff,
        0.3,
        0.1
      ),
      [0, 2.71, 0.22]
    );

  }

  // ----------------------------------------------------------
  // DISPLAY PLATFORM
  // ----------------------------------------------------------

  add(
    new THREE.CylinderGeometry(
      1.55,
      1.82,
      0.15,
      48
    ),
    mat(
      0x20252c,
      0.95
    ),
    [0, -1.30, 0]
  );

  // ==========================================================
  // PREVIEW RESIZE
  // ==========================================================

  function resizePreview() {

    const width =
      Math.max(
        1,
        container.clientWidth
      );

    const height =
      Math.max(
        1,
        container.clientHeight
      );

    const size =
      Math.min(
        width,
        height
      );

    renderer.setSize(
      size,
      size,
      false
    );

    camera.aspect =
      1;

    camera.updateProjectionMatrix();

  }

  resizePreview();

  const resizeObserver =
    new ResizeObserver(
      resizePreview
    );

  resizeObserver.observe(
    container
  );

  // ==========================================================
  // PREVIEW LOOP
  // ==========================================================

  const clock =
    new THREE.Clock();

  function animatePreview() {

    if (
      !document.body.contains(
        renderer.domElement
      )
    ) {

      resizeObserver.disconnect();

      renderer.dispose();

      return;

    }

    requestAnimationFrame(
      animatePreview
    );

    const t =
      clock.getElapsedTime();

    group.rotation.y =
      Math.sin(
        t * 0.45
      ) *
      0.12;

    group.rotation.x =
      Math.sin(
        t * 0.7
      ) *
      0.012;

    renderer.render(
      previewScene,
      camera
    );

  }

  animatePreview();

}

// ============================================================
// UPDATE CREATOR / CHARACTER PREVIEW
// ============================================================

function updateCharacterPreview() {

  updateCreatorLabels();

  // ----------------------------------------------------------
  // CHARACTER CREATOR ONLY
  // ----------------------------------------------------------

  const preview =
    document.getElementById(
      'character-preview'
    );

  if (
    preview &&
    !preview.querySelector(
      'canvas'
    )
  ) {

    buildCharacterPreview(
      preview,
      true
    );

  }

}

// ============================================================
// UPDATE HOME
// ============================================================

function updateHome() {

  if (
    !homeScene
  ) {

    return;

  }

  const profile =
    homeScene.ui?.querySelector(
      '.rl-home-profile'
    );

  if (
    profile
  ) {

    const name =
      (
        state.racerName ||
        'RACER'
      ).toUpperCase();

    profile.textContent =
      `${name} · CAREER 01`;

  }

}

// ============================================================
// FINISH CREATOR
// ============================================================

function finishCreator() {

  saveProfile();

  showScreen(
    'home'
  );

}

// ============================================================
// BUTTON EVENTS
// ============================================================

root.addEventListener(
  'click',
  (event) => {

    const button =
      event.target.closest(
        'button[data-action]'
      );

    if (!button) {

      return;

    }

    const action =
      button.dataset.action;

    // ========================================================
    // NEW CAREER
    // ========================================================

    if (
      action ===
      'new-career'
    ) {

      state.racerName =
        '';

      state.age =
        18;

      state.character = {
        head: 1,
        face: 1,
        hair: 1,
        outfit: 1,
        helmet: 1
      };

      document.getElementById(
        'name-input'
      ).value =
        '';

      document.getElementById(
        'age-input'
      ).value =
        '18';

      showScreen(
        'name'
      );

    }

    // ========================================================
    // CONTINUE
    // ========================================================

    else if (
      action ===
      'continue'
    ) {

      showScreen(
        'home'
      );

    }

    // ========================================================
    // BACK WELCOME
    // ========================================================

    else if (
      action ===
      'back-welcome'
    ) {

      showScreen(
        'welcome'
      );

    }

    // ========================================================
    // NAME → AGE
    // ========================================================

    else if (
      action ===
      'to-age'
    ) {

      if (
        validateName()
      ) {

        showScreen(
          'age'
        );

      }

    }

    // ========================================================
    // AGE → NAME
    // ========================================================

    else if (
      action ===
      'back-name'
    ) {

      showScreen(
        'name'
      );

    }

    // ========================================================
    // AGE → CREATOR
    // ========================================================

    else if (
      action ===
      'to-creator'
    ) {

      if (
        validateAge()
      ) {

        showScreen(
          'creator'
        );

      }

    }

    // ========================================================
    // CREATOR → AGE
    // ========================================================

    else if (
      action ===
      'back-age'
    ) {

      showScreen(
        'age'
      );

    }

    // ========================================================
    // FINISH CREATOR
    // ========================================================

    else if (
      action ===
      'finish-creator'
    ) {

      finishCreator();

    }

    // ========================================================
    // AGE UP
    // ========================================================

    else if (
      action ===
      'age-up'
    ) {

      const input =
        document.getElementById(
          'age-input'
        );

      input.value =
        clampAge(
          Number(
            input.value
          ) + 1
        );

    }

    // ========================================================
    // AGE DOWN
    // ========================================================

    else if (
      action ===
      'age-down'
    ) {

      const input =
        document.getElementById(
          'age-input'
        );

      input.value =
        clampAge(
          Number(
            input.value
          ) - 1
        );

    }

    // ========================================================
    // NEXT CHARACTER OPTION
    // ========================================================

    else if (
      action.startsWith(
        'next-'
      )
    ) {

      cycle(
        action.slice(5),
        1
      );

    }

    // ========================================================
    // PREVIOUS CHARACTER OPTION
    // ========================================================

    else if (
      action.startsWith(
        'prev-'
      )
    ) {

      cycle(
        action.slice(5),
        -1
      );

    }

    // ========================================================
    // BACK TO HOME
    // ========================================================

    else if (
      action ===
      'back-home'
    ) {

      showScreen(
        'home'
      );

    }

  }
);

// ============================================================
// AGE INPUT
// ============================================================

root
  .querySelector(
    '#age-input'
  )
  .addEventListener(
    'change',
    (event) => {

      event.target.value =
        clampAge(
          event.target.value
        );

    }
  );

// ============================================================
// EXISTING PROFILE
// ============================================================

const existingProfile =
  loadProfile();

if (
  existingProfile
) {

  root
    .querySelector(
      '[data-action="continue"]'
    )
    .hidden =
      false;

}

// ============================================================
// SCREEN CHANGE OBSERVER
// ============================================================

function rebuildPreviewOnScreenChange() {

  updateCharacterPreview();

  const active =
    root.querySelector(
      '.screen.active'
    );

  // ----------------------------------------------------------
  // CREATOR
  // ----------------------------------------------------------

  if (
    active?.dataset.screen ===
    'creator'
  ) {

    const container =
      document.getElementById(
        'character-preview'
      );

    if (
      container
    ) {

      container.innerHTML =
        '';

      buildCharacterPreview(
        container,
        true
      );

    }

  }

  // ----------------------------------------------------------
  // HOME
  // ----------------------------------------------------------

  if (
    active?.dataset.screen ===
    'home'
  ) {

    startHomeScene();

  }

}

// ============================================================
// MUTATION OBSERVER
// ============================================================

const observer =
  new MutationObserver(
    rebuildPreviewOnScreenChange
  );

observer.observe(
  root,
  {
    subtree: true,
    attributes: true,
    attributeFilter: [
      'class'
    ]
  }
);

// ============================================================
// INITIAL SCREEN
// ============================================================

if (
  existingProfile
) {

  showScreen(
    'welcome'
  );

}