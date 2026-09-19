import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MixamoPlayer } from './MixamoPlayer.js';

const OUTFIT_PALETTES = [
  {
    top: 0xb92525,
    pants: 0x20242b,
    shoes: 0x17191d
  },
  {
    top: 0x2b4c96,
    pants: 0x161a22,
    shoes: 0x17191d
  },
  {
    top: 0x2e7f55,
    pants: 0x20251f,
    shoes: 0x17191d
  },
  {
    top: 0x8c5e2c,
    pants: 0x26201b,
    shoes: 0x17191d
  }
];

const HAIR_COLORS = [
  0x171717,
  0x3a2417,
  0x5b3925,
  0x6d6d6d,
  0x2b2f36
];

export class CreatorPreview3D {
  constructor(options = {}) {
    this.container =
      options.container ??
      null;

    if (!this.container) {
      throw new Error(
        'CreatorPreview3D requires a container.'
      );
    }

    this.characterState = {
      head: 1,
      face: 1,
      hair: 1,
      outfit: 1,
      helmet: 1,
      ...(options.characterState || {})
    };

    this.disposed = false;
    this.running = false;
    this.rafId = null;
    this.lastTime = performance.now();
    this.lastAppearanceSignature = '';

    this.scene =
      new THREE.Scene();

    this.scene.background =
      new THREE.Color(
        0x11161d
      );

    this.camera =
      new THREE.PerspectiveCamera(
        32,
        1,
        0.1,
        100
      );

    this.camera.position.set(
      0,
      1.45,
      4.3
    );

    this.renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
      });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        2
      )
    );

    this.renderer.shadowMap.enabled =
      true;

    this.renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;

    this.renderer.domElement.className =
      'character-canvas';

    this.renderer.domElement.style.width =
      '100%';

    this.renderer.domElement.style.height =
      '100%';

    this.renderer.domElement.style.display =
      'block';

    this.container.innerHTML =
      '';

    this.container.appendChild(
      this.renderer.domElement
    );

    this.controls =
      new OrbitControls(
        this.camera,
        this.renderer.domElement
      );

    this.controls.enableDamping =
      true;

    this.controls.dampingFactor =
      0.08;

    this.controls.enablePan =
      false;

    this.controls.minDistance =
      2.6;

    this.controls.maxDistance =
      6.5;

    this.controls.minPolarAngle =
      THREE.MathUtils.degToRad(
        58
      );

    this.controls.maxPolarAngle =
      THREE.MathUtils.degToRad(
        86
      );

    this.controls.target.set(
      0,
      1.15,
      0
    );

    this.controls.update();

    this.buildEnvironment();
    this.buildPlayer();
    this.bindResize();
    this.resize();
    this.start();
  }

  buildEnvironment() {
    const hemi =
      new THREE.HemisphereLight(
        0xffffff,
        0x1b222b,
        2.0
      );

    this.scene.add(
      hemi
    );

    const key =
      new THREE.DirectionalLight(
        0xffffff,
        2.6
      );

    key.position.set(
      3.5,
      6.0,
      5.0
    );

    key.castShadow =
      true;

    this.scene.add(
      key
    );

    const rim =
      new THREE.DirectionalLight(
        0xff6a3d,
        1.15
      );

    rim.position.set(
      -4,
      3,
      -4
    );

    this.scene.add(
      rim
    );

    const floor =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          2.15,
          64
        ),
        new THREE.MeshStandardMaterial({
          color: 0x202832,
          roughness: 0.92,
          metalness: 0.04
        })
      );

    floor.rotation.x =
      -Math.PI / 2;

    floor.position.y =
      0.01;

    floor.receiveShadow =
      true;

    this.scene.add(
      floor
    );

    const ring =
      new THREE.Mesh(
        new THREE.TorusGeometry(
          1.62,
          0.018,
          8,
          80
        ),
        new THREE.MeshStandardMaterial({
          color: 0xff6a3d,
          emissive: 0xff3515,
          emissiveIntensity: 1.2,
          roughness: 0.35
        })
      );

    ring.rotation.x =
      Math.PI / 2;

    ring.position.y =
      0.035;

    this.scene.add(
      ring
    );
  }

  buildPlayer() {
    this.player =
      new MixamoPlayer({
        path:
          '/assets/characters/MixamoRacer.glb',

        idlePath:
          '/assets/characters/animations/Idle.glb'
      });

    this.player.position.set(
      0,
      0.03,
      0
    );

    this.player.groundOffsetY =
      0.03;

    this.player.rotation.y =
      THREE.MathUtils.degToRad(
        4
      );

    this.scene.add(
      this.player
    );
  }

  getAppearanceSignature() {
    return JSON.stringify(
      this.characterState
    );
  }

  setCharacterState(
    characterState
  ) {
    this.characterState = {
      ...this.characterState,
      ...(characterState || {})
    };

    this.applyAppearance(
      true
    );
  }

  applyAppearance(
    force = false
  ) {
    if (
      !this.player?.model
    ) {
      return;
    }

    const signature =
      this.getAppearanceSignature();

    if (
      !force &&
      signature ===
        this.lastAppearanceSignature
    ) {
      return;
    }

    this.lastAppearanceSignature =
      signature;

    const outfitIndex =
      Math.max(
        0,
        (
          Number(
            this.characterState.outfit
          ) || 1
        ) - 1
      ) %
      OUTFIT_PALETTES.length;

    const hairIndex =
      Math.max(
        0,
        (
          Number(
            this.characterState.hair
          ) || 1
        ) - 1
      ) %
      HAIR_COLORS.length;

    const palette =
      OUTFIT_PALETTES[
        outfitIndex
      ];

    this.player.model.traverse(
      (object) => {
        if (
          !object.isMesh ||
          !object.material
        ) {
          return;
        }

        const materials =
          Array.isArray(
            object.material
          )
            ? object.material
            : [
                object.material
              ];

        const cloned =
          materials.map(
            (material) => {
              if (
                !material.userData
                  .creatorPreviewClone
              ) {
                const next =
                  material.clone();

                next.userData =
                  {
                    ...next.userData,
                    creatorPreviewClone:
                      true,
                    creatorBaseColor:
                      material.color
                        ? material.color
                            .getHex()
                        : null
                  };

                return next;
              }

              return material;
            }
          );

        object.material =
          Array.isArray(
            object.material
          )
            ? cloned
            : cloned[0];

        const objectName =
          String(
            object.name || ''
          ).toLowerCase();

        const paintMaterial = (
          material
        ) => {
          if (
            !material?.color
          ) {
            return;
          }

          const descriptor =
            `${objectName} ${String(
              material.name || ''
            ).toLowerCase()}`;

          if (
            /hair/.test(
              descriptor
            )
          ) {
            material.color.setHex(
              HAIR_COLORS[
                hairIndex
              ]
            );

            return;
          }

          if (
            /shirt|jacket|hood|jersey|top|upper|cloth|outfit/.test(
              descriptor
            )
          ) {
            material.color.setHex(
              palette.top
            );

            return;
          }

          if (
            /pant|trouser|jean|short|lower/.test(
              descriptor
            )
          ) {
            material.color.setHex(
              palette.pants
            );

            return;
          }

          if (
            /shoe|boot|sneaker/.test(
              descriptor
            )
          ) {
            material.color.setHex(
              palette.shoes
            );

            return;
          }

          const base =
            material.userData
              .creatorBaseColor;

          if (
            Number.isFinite(
              base
            )
          ) {
            material.color.setHex(
              base
            );
          }
        };

        cloned.forEach(
          paintMaterial
        );
      }
    );
  }

  bindResize() {
    this.resizeObserver =
      new ResizeObserver(
        () => {
          this.resize();
        }
      );

    this.resizeObserver.observe(
      this.container
    );
  }

  resize() {
    if (
      this.disposed
    ) {
      return;
    }

    const width =
      Math.max(
        1,
        this.container.clientWidth
      );

    const height =
      Math.max(
        1,
        this.container.clientHeight
      );

    this.renderer.setSize(
      width,
      height,
      false
    );

    this.camera.aspect =
      width /
      height;

    this.camera
      .updateProjectionMatrix();
  }

  start() {
    if (
      this.running
    ) {
      return;
    }

    this.running =
      true;

    const tick = (
      time
    ) => {
      if (
        !this.running ||
        this.disposed
      ) {
        return;
      }

      const dt =
        Math.min(
          0.05,
          Math.max(
            0,
            (
              time -
              this.lastTime
            ) /
            1000
          )
        );

      this.lastTime =
        time;

      if (
        this.player
      ) {
        this.player.update(
          dt
        );

        this.applyAppearance();
      }

      this.controls.update();

      this.renderer.render(
        this.scene,
        this.camera
      );

      this.rafId =
        requestAnimationFrame(
          tick
        );
    };

    this.rafId =
      requestAnimationFrame(
        tick
      );
  }

  dispose() {
    if (
      this.disposed
    ) {
      return;
    }

    this.disposed =
      true;

    this.running =
      false;

    if (
      this.rafId
    ) {
      cancelAnimationFrame(
        this.rafId
      );
    }

    this.resizeObserver
      ?.disconnect();

    this.controls
      ?.dispose();

    this.scene.traverse(
      (object) => {
        if (
          object.geometry
        ) {
          object.geometry.dispose();
        }

        const materials =
          Array.isArray(
            object.material
          )
            ? object.material
            : object.material
              ? [
                  object.material
                ]
              : [];

        materials.forEach(
          (material) => {
            material.dispose?.();
          }
        );
      }
    );

    this.renderer.dispose();

    if (
      this.renderer.domElement
        .parentNode
    ) {
      this.renderer.domElement
        .parentNode
        .removeChild(
          this.renderer.domElement
        );
    }
  }
}
