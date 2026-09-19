import './ui.css';
import * as THREE from 'three';

import { HomeScene } from './scenes/HomeScene.js';
import { FreeRoamScene } from './scenes/FreeRoamScene.js';
import { CreatorPreview3D } from './characters/CreatorPreview3D.js';
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

let creatorPreview3D = null;

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
              Choose your starter look. The preview now uses
              the same real 3D racer model used in the game.
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

  if (
    name ===
    'creator'
  ) {

    updateCharacterPreview();

  } else {

    disposeCreatorPreview();

  }

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
// The old capsule/sphere mannequin has been removed.
// The creator now previews the real Mixamo racer used by
// Home / Free Roam.
// ============================================================

function ensureCreatorPreview() {

  const preview =
    document.getElementById(
      'character-preview'
    );

  if (!preview) {

    return;

  }

  if (!creatorPreview3D) {

    creatorPreview3D =
      new CreatorPreview3D({

        container:
          preview,

        characterState:
          state.character

      });

  } else {

    creatorPreview3D
      .setCharacterState(
        state.character
      );

  }

}

function disposeCreatorPreview() {

  if (!creatorPreview3D) {

    return;

  }

  creatorPreview3D.dispose();

  creatorPreview3D =
    null;

}

// ============================================================
// UPDATE CREATOR / CHARACTER PREVIEW
// ============================================================

function updateCharacterPreview() {

  updateCreatorLabels();

  if (
    state.screen !==
    'creator'
  ) {

    return;

  }

  ensureCreatorPreview();

  creatorPreview3D
    ?.setCharacterState(
      state.character
    );

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