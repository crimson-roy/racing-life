import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class MixamoPlayer extends THREE.Group {
  constructor(options = {}) {
    super();

    this.name = 'MixamoPlayer';

    this.model = null;
    this.mixer = null;

    this.actions = {};

    this.currentAction = null;
    this.currentAnimationName = null;

    this.ready = false;

    this.walking = false;
    this.emoting = false;

    this.emoteCache = {};
    this.emotePromises = {};

    this.postPoseAdjustment =
      null;

    // Animations that should be downloaded
    // and cached automatically.
    this.preloadEmotes =
      Array.isArray(
        options.preloadEmotes
      )
        ? options.preloadEmotes
        : [];

    this.emoteFinishedHandler =
      null;

    // One-shot vehicle animations.
    this.oneShotFinishedHandler =
      null;

    this.oneShotResolve =
      null;

    // Sitting loop system.
    this.sittingLoopAction =
      null;

    this.sittingLoopSourceAction =
      null;

    this.sittingLoopStartTime =
      0;

    // ========================================================
    // EMOTE TRANSFORM SETTINGS
    // ========================================================

    this.emoteYawOffset =
      0;

    this.emoteYOffset =
      0;

    // ========================================================
    // MODEL GROUNDING
    // ========================================================

    this.baseModelY =
      0;

    this.groundOffsetY =
      0;

    // ========================================================
    // LOADER
    // ========================================================

    this.loader =
      new GLTFLoader();

    // ========================================================
    // FILES
    // ========================================================

    this.characterPath =
      options.path ??
      '/assets/characters/MixamoRacer.glb';

    this.idlePath =
      options.idlePath ??
      '/assets/characters/animations/Idle.glb';

    this.loadCharacter();
  }

  // ============================================================
  // LOAD CHARACTER
  // ============================================================

  loadCharacter() {
    this.loader.load(
      this.characterPath,

      (gltf) => {
        this.model =
          gltf.scene;

        // Hide character until Idle loads.
        this.model.visible =
          false;

        this.model.traverse(
          (object) => {
            if (
              object.isMesh
            ) {
              object.castShadow =
                true;

              object.receiveShadow =
                true;
            }
          }
        );

        this.add(
          this.model
        );

        this.mixer =
          new THREE.AnimationMixer(
            this.model
          );

        // ======================================================
        // WALK
        // ======================================================

        if (
          gltf.animations &&
          gltf.animations.length >
            0
        ) {
          const walkClip =
            this.makeInPlaceClip(
              gltf.animations[0],
              'Walk'
            );

          this.createLoopAction(
            'Walk',
            walkClip
          );

          console.log(
            'Mixamo Walk animation loaded.'
          );
        }

        // ======================================================
        // GROUND MODEL ONCE
        // ======================================================

        this.model.updateMatrixWorld(
          true
        );

        const box =
          new THREE.Box3()
            .setFromObject(
              this.model
            );

        this.baseModelY =
          this.model.position.y -
          box.min.y;

        this.model.position.y =
          this.baseModelY;

        // ======================================================
        // IDLE
        // ======================================================

        this.loadIdle();
      },

      undefined,

      (error) => {
        console.error(
          'Failed to load MixamoRacer.glb:',
          error
        );
      }
    );
  }

  // ============================================================
  // LOAD IDLE
  // ============================================================

  loadIdle() {
    this.loader.load(
      this.idlePath,

      (gltf) => {
        if (
          !gltf.animations ||
          gltf.animations.length ===
            0
        ) {
          console.error(
            'Idle.glb contains no animation.'
          );

          return;
        }

        const idleClip =
          this.makeInPlaceClip(
            gltf.animations[0],
            'Idle'
          );

        this.createLoopAction(
          'Idle',
          idleClip
        );

        console.log(
          'Mixamo Idle animation loaded.'
        );

        console.log(
          'Available actions:',
          Object.keys(
            this.actions
          )
        );

        this.ready =
          true;

        this.play(
          'Idle',
          true
        );

        if (
          this.model
        ) {
          this.model.visible =
            true;
        }

        // Preload configured animations.
        this.preloadConfiguredEmotes();

        console.log(
          'Mixamo player ready.'
        );
      },

      undefined,

      (error) => {
        console.error(
          'Failed to load Idle.glb:',
          error
        );

        this.ready =
          true;

        if (
          this.actions.Walk
        ) {
          this.play(
            'Walk',
            true
          );
        }

        this.preloadConfiguredEmotes();
      }
    );
  }

  // ============================================================
  // REMOVE ROOT MOTION
  // ============================================================

  // ============================================================
// REMOVE HORIZONTAL ROOT MOTION
// KEEP VERTICAL MOTION
// ============================================================

// ============================================================
// NORMAL WALK / IDLE — REMOVE ROOT MOTION COMPLETELY
// ============================================================

makeInPlaceClip(
  originalClip,
  name
) {
  const tracks =
    originalClip.tracks.filter(
      (track) => {
        if (
          !track.name.endsWith(
            '.position'
          )
        ) {
          return true;
        }

        const lower =
          track.name.toLowerCase();

        return !(
          lower.includes(
            'hips'
          ) ||
          lower.includes(
            'root'
          ) ||
          lower.includes(
            'pelvis'
          )
        );
      }
    );

  return new THREE.AnimationClip(
    name,
    originalClip.duration,
    tracks
  );
}


// ============================================================
// VEHICLE ANIMATIONS
//
// Keep vertical hip movement so sitting/crouching works,
// but prevent the animation itself from travelling away
// from our manually controlled vehicle anchor.
// ============================================================

makeVehicleInPlaceClip(
  originalClip,
  name,
  options = {}
) {
  const tracks =
    originalClip.tracks.map(
      (sourceTrack) => {
        const track =
          sourceTrack.clone();

        if (
          !track.name.endsWith(
            '.position'
          )
        ) {
          return track;
        }

        const lower =
          track.name.toLowerCase();

        const rootTrack =
          lower.includes(
            'hips'
          ) ||
          lower.includes(
            'root'
          ) ||
          lower.includes(
            'pelvis'
          );

        if (
          !rootTrack
        ) {
          return track;
        }

        const values =
          track.values;

        if (
          values.length >=
          3
        ) {
          const startX =
            values[0];

          const startZ =
            values[2];

          // Some vehicle clips were authored with the Hips already
          // translated several metres away from the rig origin.
          // FreeRoamScene positions the whole MixamoPlayer at the
          // actual door/seat anchor, so keeping that first X/Z value
          // would add the clip's baked offset on top and make the
          // visible body appear far behind the car.
          const lockedX =
            options.zeroHorizontalRoot
              ? 0
              : startX;

          const lockedZ =
            options.zeroHorizontalRoot
              ? 0
              : startZ;

          for (
            let i = 0;
            i < values.length;
            i += 3
          ) {
            // Lock horizontal animation movement.
            values[i] =
              lockedX;

            // DON'T change:
            // values[i + 1]
            //
            // That's Y and contains the real
            // sitting/crouching vertical motion.

            values[i + 2] =
              lockedZ;
          }

          if (
            options.zeroHorizontalRoot &&
            (
              Math.abs(startX) > 0.001 ||
              Math.abs(startZ) > 0.001
            )
          ) {
            console.log(
              `MixamoPlayer: removed baked horizontal root offset from ${name}.`,
              {
                startX,
                startZ
              }
            );
          }
        }

        return track;
      }
    );

  return new THREE.AnimationClip(
    name,
    originalClip.duration,
    tracks
  );
}

  // ============================================================
  // CREATE TIME-RANGE ANIMATION CLIP
  // ============================================================

  makeTimeRangeClip(
    originalClip,
    name,
    startTime,
    endTime
  ) {
    const tracks =
      [];

    for (
      const sourceTrack
      of originalClip.tracks
    ) {
      const track =
        sourceTrack.clone();

      track.trim(
        startTime,
        endTime
      );

      if (
        track.times.length ===
        0
      ) {
        continue;
      }

      track.shift(
        -startTime
      );

      tracks.push(
        track
      );
    }

    return new THREE.AnimationClip(
      name,

      Math.max(
        0,
        endTime -
          startTime
      ),

      tracks
    );
  }

  // ============================================================
  // CREATE LOOP ACTION
  // ============================================================

  createLoopAction(
    name,
    clip
  ) {
    const action =
      this.mixer.clipAction(
        clip
      );

    action.enabled =
      true;

    action.setLoop(
      THREE.LoopRepeat,
      Infinity
    );

    action.clampWhenFinished =
      false;

    this.actions[
      name
    ] =
      action;
  }

  // ============================================================
  // KEEP IDLE ON GROUND
  // ============================================================

  keepIdleOnGround() {
    if (
      !this.model ||
      this.currentAnimationName !==
        'Idle' ||
      this.emoting
    ) {
      return;
    }

    this.model.updateMatrixWorld(
      true
    );

    const box =
      new THREE.Box3()
        .setFromObject(
          this.model
        );

    const targetFeetY =
      this.position.y +
      this.groundOffsetY;

    this.model.position.y +=
      targetFeetY -
      box.min.y;
  }

  // ============================================================
  // PLAY NORMAL ANIMATION
  // ============================================================

  play(
    name,
    immediate =
      false
  ) {
    if (
      !this.mixer ||
      !this.actions[
        name
      ]
    ) {
      console.warn(
        `MixamoPlayer: animation "${name}" not available.`
      );

      return;
    }

    // Don't restart same animation.
    if (
      this.currentAction &&
      this.currentAnimationName ===
        name
    ) {
      return;
    }

    const nextAction =
      this.actions[
        name
      ];

    if (
      this.currentAction
    ) {
      if (
        immediate
      ) {
        this.currentAction.stop();
      } else {
        this.currentAction.fadeOut(
          0.20
        );
      }
    }

    nextAction.reset();

    nextAction.setLoop(
      THREE.LoopRepeat,
      Infinity
    );

    nextAction.clampWhenFinished =
      false;

    if (
      immediate
    ) {
      nextAction.play();
    } else {
      nextAction
        .fadeIn(
          0.20
        )
        .play();
    }

    nextAction.paused =
      false;

    this.currentAction =
      nextAction;

    this.currentAnimationName =
      name;

    this.walking =
      name ===
      'Walk';

    this.emoting =
      false;

    this.resetEmoteTransform();
  }

  // ============================================================
  // START WALK
  // ============================================================

  startWalking() {
    if (
      !this.ready
    ) {
      return;
    }

    if (
      this.emoting
    ) {
      this.cancelEmote();
    }

    this.play(
      'Walk'
    );
  }

  // ============================================================
  // STOP WALK
  // ============================================================

  stopWalking() {
    if (
      !this.ready
    ) {
      return;
    }

    if (
      this.emoting
    ) {
      this.cancelEmote();

      return;
    }

    this.play(
      'Idle'
    );
  }

  // ============================================================
  // RESET EMOTE TRANSFORM
  // ============================================================

  resetEmoteTransform() {
    if (
      !this.model
    ) {
      return;
    }

    this.model.rotation.y =
      0;

    this.model.position.y =
      this.baseModelY +
      this.groundOffsetY;
  }

  // ============================================================
  // APPLY EMOTE TRANSFORM
  // ============================================================

  applyEmoteTransform() {
    if (
      !this.model
    ) {
      return;
    }

    this.model.rotation.y =
      this.emoteYawOffset;

    this.model.position.y =
      this.baseModelY +
      this.groundOffsetY +
      this.emoteYOffset;
  }

  // ============================================================
  // CHECK SITTING EMOTE
  // ============================================================

  isSittingEmote(
    emote
  ) {
    const file =
      String(
        emote.file ??
          ''
      ).toLowerCase();

    const id =
      String(
        emote.id ??
          ''
      ).toLowerCase();

    return (
      file.includes(
        'sitting'
      ) ||
      id.includes(
        'sitting'
      ) ||
      id ===
        'sit'
    );
  }

  // ============================================================
  // PRELOAD CONFIGURED EMOTES
  // ============================================================

  preloadConfiguredEmotes() {
    if (
      !this.ready ||
      !this.mixer ||
      this.preloadEmotes.length ===
        0
    ) {
      return;
    }

    for (
      const emote
      of this.preloadEmotes
    ) {
      this.loadEmote(
        emote
      )
        .then(
          () => {
            console.log(
              `Preloaded animation: ${emote.label}`
            );
          }
        )
        .catch(
          (error) => {
            console.warn(
              `Could not preload ${emote.label}:`,
              error
            );
          }
        );
    }
  }

  // ============================================================
  // LOAD EMOTE
  // ============================================================

  loadEmote(
    emote
  ) {
    if (
      this.emoteCache[
        emote.id
      ]
    ) {
      return Promise.resolve(
        this.emoteCache[
          emote.id
        ]
      );
    }

    if (
      this.emotePromises[
        emote.id
      ]
    ) {
      return this.emotePromises[
        emote.id
      ];
    }

    const url =
      '/assets/characters/animations/' +
      encodeURIComponent(
        emote.file
      );

    console.log(
      `Loading GLB emote: ${emote.label}`
    );

    this.emotePromises[
      emote.id
    ] =
      new Promise(
        (
          resolve,
          reject
        ) => {
          this.loader.load(
            url,

            (gltf) => {
              if (
                !gltf.animations ||
                gltf.animations.length ===
                  0
              ) {
                reject(
                  new Error(
                    'No animation in GLB'
                  )
                );

                return;
              }

              const originalClip =
  gltf.animations[0];

const clip =
  emote.lockRootPosition
    ? this.makeInPlaceClip(
        originalClip,
        emote.id
      )
    : emote.inPlace
      ? this.makeVehicleInPlaceClip(
          originalClip,
          emote.id,
          {
            zeroHorizontalRoot:
              emote.zeroHorizontalRoot ===
              true
          }
        )
      : new THREE.AnimationClip(
          emote.id,
          originalClip.duration,
          originalClip.tracks
        );

              const action =
                this.mixer.clipAction(
                  clip
                );

              action.enabled =
                true;

              this.emoteCache[
                emote.id
              ] = {
                clip,
                action
              };

              console.log(
                `GLB emote loaded: ${emote.label}`
              );

              resolve(
                this.emoteCache[
                  emote.id
                ]
              );
            },

            undefined,

            (error) => {
              console.error(
                `Failed to load ${emote.file}:`,
                error
              );

              reject(
                error
              );
            }
          );
        }
      );

    return this.emotePromises[
      emote.id
    ];
  }

  // ============================================================
  // PLAY ONE-SHOT EMOTE AND WAIT
  // ============================================================
  //
  // Used by actions where the game must wait
  // for the animation to finish:
  //
  // Enter car
  // Exit car
  // Future ladder transitions
  // etc.
  //
  // Returns true if it reached the end.
  // Returns false if cancelled.
  // ============================================================

 async playOneShotEmoteAndWait(
  emote,
  fadeSeconds =
    0.12
) {
  if (
    !this.ready ||
    !this.mixer
  ) {
    return false;
  }

  try {
    this.cancelEmote(
      false
    );

    const data =
      await this.loadEmote(
        emote
      );

    const action =
      data.action;

    // ========================================================
    // VEHICLE ANIMATION GETS EXCLUSIVE SKELETON CONTROL
    // ========================================================
    //
    // This kills Walk / Idle / old emotes before Enter Car
    // starts. Otherwise multiple actions can blend together.
    // ========================================================

    this.mixer.stopAllAction();

    this.currentAction =
      null;

    this.currentAnimationName =
      null;

    this.walking =
      false;

    this.emoting =
      true;

    this.applyEmoteTransform();

    this.currentAction =
      action;

    this.currentAnimationName =
      emote.id;

    action.reset();

    action.enabled =
      true;

    action.setEffectiveWeight(
      1
    );

    action.setEffectiveTimeScale(
      1
    );

    action.setLoop(
      THREE.LoopOnce,
      1
    );

    action.clampWhenFinished =
      true;

    action
      .fadeIn(
        fadeSeconds
      )
      .play();

    console.log(
      `Playing one-shot emote: ${emote.label}`
    );

    return await new Promise(
      (resolve) => {
        let resolved =
          false;

        const finish =
          (
            completed
          ) => {
            if (
              resolved
            ) {
              return;
            }

            resolved =
              true;

            if (
              this.oneShotFinishedHandler &&
              this.mixer
            ) {
              this.mixer
                .removeEventListener(
                  'finished',
                  this.oneShotFinishedHandler
                );
            }

            this.oneShotFinishedHandler =
              null;

            this.oneShotResolve =
              null;

            resolve(
              completed
            );
          };

        this.oneShotResolve =
          finish;

        this.oneShotFinishedHandler =
          (event) => {
            if (
              event.action !==
              action
            ) {
              return;
            }

            action.stop();

            if (
              this.currentAction ===
              action
            ) {
              this.currentAction =
                null;

              this.currentAnimationName =
                null;
            }

            this.emoting =
              false;

            finish(
              true
            );
          };

        this.mixer.addEventListener(
          'finished',
          this.oneShotFinishedHandler
        );
      }
    );
  } catch (
    error
  ) {
    console.error(
      `Could not play one-shot emote ${emote.label}:`,
      error
    );

    this.emoting =
      false;

    return false;
  }
}

  // ============================================================
  // PLAY LOOPING EMOTE
  // ============================================================
  //
  // Used for animations that remain active
  // until something else stops them.
  //
  // Driving.glb uses this.
  // ============================================================

  async playLoopingEmote(
  emote,
  fadeSeconds =
    0.15
) {
  if (
    !this.ready ||
    !this.mixer
  ) {
    return false;
  }

  try {
    this.cancelEmote(
      false
    );

    const data =
      await this.loadEmote(
        emote
      );

    const action =
      data.action;

    // ========================================================
    // DRIVING MUST BE THE ONLY ACTIVE ANIMATION
    // ========================================================

    this.mixer.stopAllAction();

    this.currentAction =
      null;

    this.currentAnimationName =
      null;

    this.walking =
      false;

    this.emoting =
      true;

    this.applyEmoteTransform();

    this.currentAction =
      action;

    this.currentAnimationName =
      emote.id;

    action.reset();

    action.enabled =
      true;

    action.setEffectiveWeight(
      1
    );

    action.setEffectiveTimeScale(
      1
    );

    action.setLoop(
      THREE.LoopRepeat,
      Infinity
    );

    action.clampWhenFinished =
      false;

    action
      .fadeIn(
        fadeSeconds
      )
      .play();

    console.log(
      `Playing looping emote: ${emote.label}`
    );

    return true;
  } catch (
    error
  ) {
    console.error(
      `Could not play looping emote ${emote.label}:`,
      error
    );

    this.emoting =
      false;

    return false;
  }
}

  // ============================================================
  // PLAY NORMAL EMOTE
  // ============================================================

  async playEmote(
    emote
  ) {
    if (
      !this.ready
    ) {
      return;
    }

    try {
      this.cancelEmote(
        false
      );

      const data =
        await this.loadEmote(
          emote
        );

      const action =
        data.action;

      if (
        this.currentAction
      ) {
        this.currentAction.fadeOut(
          0.15
        );
      }

      this.walking =
        false;

      this.emoting =
        true;

      this.applyEmoteTransform();

      this.currentAction =
        action;

      this.currentAnimationName =
        emote.id;

      action.reset();

      const sitting =
        this.isSittingEmote(
          emote
        );

      // ======================================================
      // SITTING
      // ======================================================

      if (
        sitting
      ) {
        const fullClip =
          data.clip;

        const duration =
          fullClip.duration;

        const loopSeconds =
          Math.min(
            1,
            duration
          );

        const loopStart =
          Math.max(
            0,

            duration -
              loopSeconds
          );

        const loopClip =
          this.makeTimeRangeClip(
            fullClip,

            `${emote.id}_SitLoop`,

            loopStart,
            duration
          );

        const loopAction =
          this.mixer.clipAction(
            loopClip
          );

        loopAction.enabled =
          true;

        loopAction.setLoop(
          THREE.LoopRepeat,
          Infinity
        );

        loopAction.clampWhenFinished =
          false;

        this.sittingLoopAction =
          loopAction;

        this.sittingLoopSourceAction =
          action;

        this.sittingLoopStartTime =
          loopStart;

        action.setLoop(
          THREE.LoopOnce,
          1
        );

        action.clampWhenFinished =
          false;

        action
          .fadeIn(
            0.15
          )
          .play();

        console.log(
          `Playing sitting emote → final ${loopSeconds.toFixed(2)} second loop: ${emote.label}`
        );

        return;
      }

      // ======================================================
      // NORMAL ONE-TIME EMOTE
      // ======================================================

      action.setLoop(
        THREE.LoopOnce,
        1
      );

      action.clampWhenFinished =
        true;

      action
        .fadeIn(
          0.15
        )
        .play();

      this.emoteFinishedHandler =
        (event) => {
          if (
            event.action !==
            action
          ) {
            return;
          }

          this.mixer
            .removeEventListener(
              'finished',
              this.emoteFinishedHandler
            );

          this.emoteFinishedHandler =
            null;

          action.stop();

          this.emoting =
            false;

          this.resetEmoteTransform();

          this.play(
            'Idle'
          );
        };

      this.mixer.addEventListener(
        'finished',
        this.emoteFinishedHandler
      );

      console.log(
        `Playing emote: ${emote.label}`
      );
    } catch (
      error
    ) {
      console.error(
        `Could not play emote ${emote.label}:`,
        error
      );

      this.emoting =
        false;

      this.resetEmoteTransform();

      this.play(
        'Idle'
      );
    }
  }

  // ============================================================
  // CANCEL EMOTE
  // ============================================================

  cancelEmote(
    returnToIdle =
      true
  ) {
    // ----------------------------------------------------------
    // VEHICLE ONE-SHOT LISTENER
    // ----------------------------------------------------------

    if (
      this.oneShotFinishedHandler &&
      this.mixer
    ) {
      this.mixer
        .removeEventListener(
          'finished',
          this.oneShotFinishedHandler
        );

      this.oneShotFinishedHandler =
        null;
    }

    if (
      this.oneShotResolve
    ) {
      const resolveOneShot =
        this.oneShotResolve;

      this.oneShotResolve =
        null;

      resolveOneShot(
        false
      );
    }

    // ----------------------------------------------------------
    // NORMAL EMOTE LISTENER
    // ----------------------------------------------------------

    if (
      this.emoteFinishedHandler &&
      this.mixer
    ) {
      this.mixer
        .removeEventListener(
          'finished',
          this.emoteFinishedHandler
        );

      this.emoteFinishedHandler =
        null;
    }

    // ----------------------------------------------------------
    // CURRENT ACTION
    // ----------------------------------------------------------

    if (
      this.currentAction &&
      this.emoting
    ) {
      this.currentAction.stop();
    }

    // ----------------------------------------------------------
    // SITTING LOOP
    // ----------------------------------------------------------

    if (
      this.sittingLoopAction &&
      this.sittingLoopAction !==
        this.currentAction
    ) {
      this.sittingLoopAction.stop();
    }

    if (
      this.sittingLoopSourceAction &&
      this.sittingLoopSourceAction !==
        this.currentAction
    ) {
      this.sittingLoopSourceAction.stop();
    }

    this.sittingLoopAction =
      null;

    this.sittingLoopSourceAction =
      null;

    this.sittingLoopStartTime =
      0;

    this.emoting =
      false;

    this.walking =
      false;

    this.resetEmoteTransform();

    if (
      returnToIdle &&
      this.ready &&
      this.actions.Idle
    ) {
      this.play(
        'Idle'
      );
    }
  }

  // ============================================================
  // POST-ANIMATION POSE CORRECTION
  // ============================================================

  setPostPoseAdjustment(
    callback
  ) {
    this.postPoseAdjustment =
      callback;
  }

  clearPostPoseAdjustment() {
    this.postPoseAdjustment =
      null;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(
    dt
  ) {
    if (
      !this.ready ||
      !this.mixer
    ) {
      return;
    }

    this.mixer.update(
      dt
    );

    // Apply bonnet hand corrections
    // AFTER the animation mixer.
    if (
      this.postPoseAdjustment
    ) {
      this.postPoseAdjustment(
        this
      );
    }

    // ========================================================
    // SITTING → FINAL LOOP
    // ========================================================

    if (
      this.emoting &&
      this.sittingLoopAction &&
      this.sittingLoopSourceAction &&
      this.currentAction ===
        this.sittingLoopSourceAction &&
      this.sittingLoopSourceAction
        .time >=
        this.sittingLoopStartTime
    ) {
      const sourceAction =
        this.sittingLoopSourceAction;

      const loopAction =
        this.sittingLoopAction;

      loopAction.reset();

      loopAction
        .fadeIn(
          0.15
        )
        .play();

      sourceAction.fadeOut(
        0.15
      );

      this.currentAction =
        loopAction;

      console.log(
        'Sitting animation entered final loop.'
      );
    }

    this.keepIdleOnGround();
  }

  // ============================================================
  // READY
  // ============================================================

  isReady() {
    return this.ready;
  }
}