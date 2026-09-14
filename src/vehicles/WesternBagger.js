import * as THREE from 'three';

export class WesternBagger extends THREE.Group {
  constructor(options = {}) {
    super();

    this.name = 'WesternBagger';

    // ============================================================
    // MASTER SCALE
    // ============================================================

    this.WHEEL_DIAMETER = options.wheelDiameter ?? 1.0;
    this.WHEEL_RADIUS = this.WHEEL_DIAMETER / 2;

    this.WHEELBASE = this.WHEEL_DIAMETER * 3.2;
    this.SEAT_HEIGHT = this.WHEEL_DIAMETER * 0.6;

    // ============================================================
    // MATERIALS
    // ============================================================

    this.paint = new THREE.MeshStandardMaterial({
      color: 0xf2f2f2,
      roughness: 0.25,
      metalness: 0.1
    });

    this.blackMetal = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.5,
      metalness: 0.6
    });

    this.leather = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.8,
      metalness: 0
    });

    this.rubber = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.9,
      metalness: 0
    });

    this.chrome = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.15,
      metalness: 0.9
    });

    this.redLight = new THREE.MeshStandardMaterial({
      color: 0x550000,
      emissive: 0xff0000,
      emissiveIntensity: 0.53,
      roughness: 0.2
    });

    // ============================================================
    // SUB-GROUPS
    // ============================================================

    this.wheels = new THREE.Group();
    this.frame = new THREE.Group();
    this.engine = new THREE.Group();
    this.body = new THREE.Group();
    this.controls = new THREE.Group();
    this.lights = new THREE.Group();

    this.add(
      this.wheels,
      this.frame,
      this.engine,
      this.body,
      this.controls,
      this.lights
    );

    // Public references for vehicle systems.
    this.parts = {};

    // ============================================================
    // BUILD
    // ============================================================

    this.createWheels();
    this.createFrame();
    this.createEngine();
    this.createTank();
    this.createSeat();
    this.createRearFender();
    this.createSaddlebags();
    this.createFrontFork();
    this.createFairing();
    this.createHandlebars();
    this.createExhaust();
    this.createLights();

    // ============================================================
    // DRIVING STATE
    // ============================================================

    this.speed = 0;
    this.steering = 0;
    this.throttle = 0;

    this.maxSpeed = options.maxSpeed ?? 14;
    this.maxReverseSpeed = options.maxReverseSpeed ?? 5;

    this.acceleration = options.acceleration ?? 8;
    this.brakePower = options.brakePower ?? 13;
    this.drag = options.drag ?? 2.8;

    this.turnRate = options.turnRate ?? 1.8;

    this.setSteering(0);
    this.resetLean();
  }

  // ============================================================
  // UTILITY
  // ============================================================

  mesh(geometry, material, name) {
    const object = new THREE.Mesh(
      geometry,
      material
    );

    object.name = name;

    object.castShadow = true;
    object.receiveShadow = true;

    return object;
  }

  // ============================================================
  // WHEELS
  // ============================================================

  createWheel(name, radius, width, x, z) {
    const wheel = new THREE.Group();

    wheel.name = name;

    const tireGeometry = new THREE.TorusGeometry(
      radius * 0.86,
      radius * 0.14,
      16,
      32
    );

    const tire = this.mesh(
      tireGeometry,
      this.rubber,
      `${name}_Tire`
    );

    tire.rotation.y = Math.PI / 2;

    wheel.add(tire);

    const rimRadius = radius * 0.72;

    const rimGeometry = new THREE.CylinderGeometry(
      rimRadius,
      rimRadius,
      width * 0.18,
      24
    );

    const rim = this.mesh(
      rimGeometry,
      this.chrome,
      `${name}_Rim`
    );

    rim.rotation.z = Math.PI / 2;

    wheel.add(rim);

    const spokeGroup = new THREE.Group();

    spokeGroup.name = `${name}_Spokes`;

    for (let i = 0; i < 16; i++) {
      const angle =
        (i / 16) * Math.PI * 2;

      const spokeGeometry =
        new THREE.BoxGeometry(
          width * 0.08,
          rimRadius * 0.9,
          width * 0.04
        );

      const spoke = this.mesh(
        spokeGeometry,
        this.chrome,
        `${name}_Spoke_${i}`
      );

      spoke.position.y =
        Math.cos(angle) *
        rimRadius *
        0.45;

      spoke.position.z =
        Math.sin(angle) *
        rimRadius *
        0.45;

      spoke.rotation.x = angle;

      spokeGroup.add(spoke);
    }

    wheel.add(spokeGroup);

    const discGeometry =
      new THREE.CylinderGeometry(
        rimRadius * 0.62,
        rimRadius * 0.62,
        width * 0.04,
        24
      );

    const disc = this.mesh(
      discGeometry,
      this.blackMetal,
      `${name}_BrakeDisc`
    );

    disc.rotation.z = Math.PI / 2;
    disc.position.x = width * 0.08;

    wheel.add(disc);

    wheel.position.set(
      x,
      radius,
      z
    );

    this.wheels.add(wheel);

    this.parts[name] = wheel;

    return wheel;
  }

  createWheels() {
    const frontZ =
      this.WHEELBASE / 2;

    const rearZ =
      -this.WHEELBASE / 2;

    const frontWidth =
      this.WHEEL_DIAMETER * 0.20;

    const rearWidth =
      frontWidth * 1.4;

    this.frontWheel =
      this.createWheel(
        'FrontWheel',
        this.WHEEL_RADIUS,
        frontWidth,
        0,
        frontZ
      );

    this.rearWheel =
      this.createWheel(
        'RearWheel',
        this.WHEEL_RADIUS,
        rearWidth,
        0,
        rearZ
      );
  }

  // ============================================================
  // FRAME
  // ============================================================

  createFrame() {
    const frameMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.6,
        metalness: 0.5
      });

    const frameWidth =
      this.WHEEL_DIAMETER * 0.18;

    const addTube = (
      start,
      end,
      radius = 0.035
    ) => {
      const direction =
        new THREE.Vector3()
          .subVectors(end, start);

      const length =
        direction.length();

      const geometry =
        new THREE.CylinderGeometry(
          radius,
          radius,
          length,
          10
        );

      const tube = this.mesh(
        geometry,
        frameMaterial,
        'FrameTube'
      );

      tube.position
        .copy(start)
        .add(end)
        .multiplyScalar(0.5);

      tube.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize()
      );

      this.frame.add(tube);

      return tube;
    };

    const rearZ =
      -this.WHEELBASE / 2;

    const frontZ =
      this.WHEELBASE / 2;

    const engineY =
      this.WHEEL_RADIUS * 0.75;

    addTube(
      new THREE.Vector3(
        -frameWidth,
        engineY,
        rearZ * 0.65
      ),
      new THREE.Vector3(
        -frameWidth,
        engineY,
        frontZ * 0.55
      )
    );

    addTube(
      new THREE.Vector3(
        frameWidth,
        engineY,
        rearZ * 0.65
      ),
      new THREE.Vector3(
        frameWidth,
        engineY,
        frontZ * 0.55
      )
    );

    addTube(
      new THREE.Vector3(
        -frameWidth,
        engineY,
        frontZ * 0.55
      ),
      new THREE.Vector3(
        0,
        this.SEAT_HEIGHT * 0.85,
        frontZ * 0.15
      )
    );

    addTube(
      new THREE.Vector3(
        frameWidth,
        engineY,
        frontZ * 0.55
      ),
      new THREE.Vector3(
        0,
        this.SEAT_HEIGHT * 0.85,
        frontZ * 0.15
      )
    );

    addTube(
      new THREE.Vector3(
        -frameWidth,
        engineY,
        rearZ * 0.65
      ),
      new THREE.Vector3(
        0,
        this.SEAT_HEIGHT * 0.72,
        rearZ * 0.2
      )
    );

    addTube(
      new THREE.Vector3(
        frameWidth,
        engineY,
        rearZ * 0.65
      ),
      new THREE.Vector3(
        0,
        this.SEAT_HEIGHT * 0.72,
        rearZ * 0.2
      )
    );
  }

  // ============================================================
  // ENGINE
  // ============================================================

  createEngine() {
    const cylinderRadius =
      this.WHEEL_RADIUS * 0.125;

    const cylinderLength =
      this.WHEEL_RADIUS * 0.55;

    const blockGeometry =
      new THREE.BoxGeometry(
        this.WHEEL_DIAMETER * 0.35,
        this.WHEEL_DIAMETER * 0.25,
        this.WHEEL_DIAMETER * 0.55
      );

    const block = this.mesh(
      blockGeometry,
      this.blackMetal,
      'EngineBlock'
    );

    block.position.set(
      0,
      this.WHEEL_RADIUS * 0.65,
      0
    );

    this.engine.add(block);

    for (const side of [-1, 1]) {
      const cylinderGeometry =
        new THREE.CylinderGeometry(
          cylinderRadius,
          cylinderRadius * 1.08,
          cylinderLength,
          16
        );

      const cylinder = this.mesh(
        cylinderGeometry,
        this.chrome,
        side === -1
          ? 'EngineCylinderLeft'
          : 'EngineCylinderRight'
      );

      cylinder.position.set(
        side * cylinderRadius * 0.9,
        this.WHEEL_RADIUS * 0.9,
        side * 0.02
      );

      cylinder.rotation.z =
        side * 0.25;

      this.engine.add(cylinder);

      for (let i = 0; i < 5; i++) {
        const finGeometry =
          new THREE.CylinderGeometry(
            cylinderRadius * 1.12,
            cylinderRadius * 1.12,
            0.025,
            16
          );

        const fin = this.mesh(
          finGeometry,
          this.blackMetal,
          'EngineCoolingFin'
        );

        fin.position.copy(
          cylinder.position
        );

        fin.position.y +=
          (i - 2) *
          cylinderLength *
          0.16;

        fin.rotation.z =
          cylinder.rotation.z;

        this.engine.add(fin);
      }
    }

    this.parts.engine =
      this.engine;
  }

  // ============================================================
  // TANK
  // ============================================================

  createTank() {
    const tankGeometry =
      new THREE.SphereGeometry(
        0.5,
        24,
        16
      );

    tankGeometry.scale(
      this.WHEEL_DIAMETER * 0.48,
      this.WHEEL_DIAMETER * 0.30,
      this.WHEELBASE * 0.16
    );

    const tank = this.mesh(
      tankGeometry,
      this.paint,
      'FuelTank'
    );

    tank.position.set(
      0,
      this.SEAT_HEIGHT * 0.96,
      this.WHEELBASE * 0.16
    );

    this.body.add(tank);

    const stripeGeometry =
      new THREE.BoxGeometry(
        this.WHEEL_DIAMETER * 0.055,
        this.WHEEL_DIAMETER * 0.02,
        this.WHEELBASE * 0.28
      );

    const stripe = this.mesh(
      stripeGeometry,
      this.blackMetal,
      'TankStripe'
    );

    stripe.position.set(
      0,
      tank.position.y +
        this.WHEEL_DIAMETER * 0.285,
      tank.position.z
    );

    this.body.add(stripe);

    this.parts.tank = tank;
  }

  // ============================================================
  // SEAT
  // ============================================================

  createSeat() {
    const riderSeat =
      this.mesh(
        new THREE.BoxGeometry(
          this.WHEEL_DIAMETER * 0.48,
          this.WHEEL_DIAMETER * 0.12,
          this.WHEELBASE * 0.16
        ),
        this.leather,
        'RiderSeat'
      );

    riderSeat.position.set(
      0,
      this.SEAT_HEIGHT * 0.91,
      -this.WHEELBASE * 0.04
    );

    this.body.add(riderSeat);

    const passengerSeat =
      riderSeat.clone();

    passengerSeat.name =
      'PassengerSeat';

    passengerSeat.scale.set(
      0.95,
      0.85,
      0.7
    );

    passengerSeat.position.z =
      -this.WHEELBASE * 0.16;

    passengerSeat.position.y +=
      this.WHEEL_DIAMETER * 0.07;

    this.body.add(passengerSeat);

    this.parts.riderSeat =
      riderSeat;

    this.parts.passengerSeat =
      passengerSeat;
  }

  // ============================================================
  // REAR FENDER
  // ============================================================

  createRearFender() {
    const geometry =
      new THREE.CylinderGeometry(
        this.WHEEL_RADIUS * 1.12,
        this.WHEEL_RADIUS * 1.12,
        this.WHEEL_DIAMETER * 0.12,
        32,
        1,
        false,
        0,
        Math.PI
      );

    const fender = this.mesh(
      geometry,
      this.paint,
      'RearFender'
    );

    fender.rotation.z =
      Math.PI / 2;

    fender.position.set(
      0,
      this.WHEEL_RADIUS * 1.25,
      -this.WHEELBASE / 2
    );

    this.body.add(fender);

    this.parts.rearFender =
      fender;
  }

  // ============================================================
  // SADDLEBAGS
  // ============================================================

  createSaddlebags() {
    const bagWidth =
      this.WHEEL_DIAMETER * 0.25;

    const bagHeight =
      this.WHEEL_RADIUS * 0.9;

    const bagLength =
      this.WHEELBASE * 0.25;

    for (const side of [-1, 1]) {
      const geometry =
        new THREE.BoxGeometry(
          bagWidth,
          bagHeight,
          bagLength
        );

      const bag = this.mesh(
        geometry,
        this.paint,
        side === -1
          ? 'LeftSaddlebag'
          : 'RightSaddlebag'
      );

      bag.position.set(
        side * this.WHEEL_DIAMETER * 0.62,
        this.WHEEL_RADIUS * 0.95,
        -this.WHEELBASE * 0.30
      );

      this.body.add(bag);

      this.parts[
        side === -1
          ? 'leftSaddlebag'
          : 'rightSaddlebag'
      ] = bag;
    }
  }

  // ============================================================
  // FRONT FORK
  // ============================================================

  createFrontFork() {
    const forkGroup =
      new THREE.Group();

    forkGroup.name =
      'FrontFork';

    const forkRadius =
      this.WHEEL_DIAMETER * 0.06;

    const forkLength =
      this.WHEEL_DIAMETER * 0.8;

    for (const side of [-1, 1]) {
      const geometry =
        new THREE.CylinderGeometry(
          forkRadius,
          forkRadius,
          forkLength,
          12
        );

      const fork = this.mesh(
        geometry,
        this.blackMetal,
        side === -1
          ? 'LeftFork'
          : 'RightFork'
      );

      fork.position.set(
        side * this.WHEEL_DIAMETER * 0.11,
        this.WHEEL_RADIUS +
          forkLength * 0.35,
        this.WHEELBASE / 2
      );

      fork.rotation.x = -0.12;

      forkGroup.add(fork);
    }

    this.controls.add(
      forkGroup
    );

    this.parts.frontFork =
      forkGroup;
  }

  // ============================================================
  // FAIRING
  // ============================================================

  createFairing() {
    const fairingGroup =
      new THREE.Group();

    fairingGroup.name =
      'FrontFairing';

    const geometry =
      new THREE.SphereGeometry(
        0.5,
        24,
        16
      );

    geometry.scale(
      this.WHEEL_DIAMETER * 0.78,
      this.WHEEL_DIAMETER * 0.48,
      this.WHEEL_DIAMETER * 0.30
    );

    const fairing = this.mesh(
      geometry,
      this.paint,
      'FairingBody'
    );

    fairing.position.set(
      0,
      this.WHEEL_DIAMETER * 1.02,
      this.WHEELBASE / 2 +
        this.WHEEL_DIAMETER * 0.08
    );

    fairingGroup.add(
      fairing
    );

    const windshieldGeometry =
      new THREE.BoxGeometry(
        this.WHEEL_DIAMETER * 0.58,
        this.WHEEL_DIAMETER * 0.22,
        this.WHEEL_DIAMETER * 0.025
      );

    const windshieldMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x111820,
        transparent: true,
        opacity: 0.55,
        roughness: 0.15,
        metalness: 0.1
      });

    const windshield = this.mesh(
      windshieldGeometry,
      windshieldMaterial,
      'Windshield'
    );

    windshield.position.set(
      0,
      this.WHEEL_DIAMETER * 1.30,
      this.WHEELBASE / 2 +
        this.WHEEL_DIAMETER * 0.08
    );

    windshield.rotation.x =
      -0.15;

    fairingGroup.add(
      windshield
    );

    const headlightGeometry =
      new THREE.CylinderGeometry(
        this.WHEEL_DIAMETER * 0.13,
        this.WHEEL_DIAMETER * 0.13,
        this.WHEEL_DIAMETER * 0.05,
        24
      );

    const headlightMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.8,
        roughness: 0.15,
        metalness: 0.2
      });

    const headlight = this.mesh(
      headlightGeometry,
      headlightMaterial,
      'Headlight'
    );

    headlight.rotation.z =
      Math.PI / 2;

    headlight.position.set(
      0,
      this.WHEEL_DIAMETER * 1.03,
      this.WHEELBASE / 2 +
        this.WHEEL_DIAMETER * 0.40
    );

    fairingGroup.add(
      headlight
    );

    this.body.add(
      fairingGroup
    );

    this.parts.fairing =
      fairingGroup;

    this.parts.headlight =
      headlight;
  }

  // ============================================================
  // HANDLEBARS
  // ============================================================

  createHandlebars() {
    const barGroup =
      new THREE.Group();

    barGroup.name =
      'Handlebars';

    const width =
      this.WHEEL_DIAMETER * 1.35;

    const barGeometry =
      new THREE.CylinderGeometry(
        this.WHEEL_DIAMETER * 0.025,
        this.WHEEL_DIAMETER * 0.025,
        width,
        12
      );

    const bar = this.mesh(
      barGeometry,
      this.blackMetal,
      'Handlebar'
    );

    bar.rotation.z =
      Math.PI / 2;

    barGroup.add(bar);

    for (const side of [-1, 1]) {
      const gripGeometry =
        new THREE.CylinderGeometry(
          this.WHEEL_DIAMETER * 0.045,
          this.WHEEL_DIAMETER * 0.045,
          this.WHEEL_DIAMETER * 0.20,
          12
        );

      const grip = this.mesh(
        gripGeometry,
        this.leather,
        side === -1
          ? 'LeftGrip'
          : 'RightGrip'
      );

      grip.rotation.z =
        Math.PI / 2;

      grip.position.x =
        side * width * 0.48;

      barGroup.add(grip);
    }

    barGroup.position.set(
      0,
      this.WHEEL_DIAMETER * 1.45,
      this.WHEELBASE * 0.32
    );

    this.controls.add(
      barGroup
    );

    this.parts.handlebars =
      barGroup;
  }

  // ============================================================
  // EXHAUST
  // ============================================================

  createExhaust() {
    const exhaustGroup =
      new THREE.Group();

    exhaustGroup.name =
      'Exhaust';

    const exhaustMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.6,
        metalness: 0.3
      });

    const createPipe = (
      yOffset,
      zOffset
    ) => {
      const geometry =
        new THREE.CylinderGeometry(
          this.WHEEL_RADIUS * 0.06,
          this.WHEEL_RADIUS * 0.06,
          this.WHEELBASE * 0.75,
          12
        );

      const pipe = this.mesh(
        geometry,
        exhaustMaterial,
        'ExhaustPipe'
      );

      pipe.rotation.x =
        Math.PI / 2;

      pipe.position.set(
        this.WHEEL_DIAMETER * 0.38,
        yOffset,
        zOffset
      );

      exhaustGroup.add(pipe);
    };

    createPipe(
      this.WHEEL_RADIUS * 0.45,
      -this.WHEELBASE * 0.08
    );

    createPipe(
      this.WHEEL_RADIUS * 0.36,
      -this.WHEELBASE * 0.28
    );

    this.body.add(
      exhaustGroup
    );

    this.parts.exhaust =
      exhaustGroup;
  }

  // ============================================================
  // LIGHTS
  // ============================================================

  createLights() {
    const tailGeometry =
      new THREE.BoxGeometry(
        this.WHEEL_DIAMETER * 0.16,
        this.WHEEL_DIAMETER * 0.10,
        this.WHEEL_DIAMETER * 0.06
      );

    const tailLight = this.mesh(
      tailGeometry,
      this.redLight,
      'TailLight'
    );

    tailLight.position.set(
      0,
      this.WHEEL_RADIUS * 1.25,
      -this.WHEELBASE * 0.48
    );

    this.lights.add(
      tailLight
    );

    this.parts.tailLight =
      tailLight;
  }

  // ============================================================
  // VEHICLE CONTROL
  // ============================================================

  setSteering(amount) {
  // -1 = left
  //  0 = center
  // +1 = right

  const maxSteer = THREE.MathUtils.degToRad(28);

  if (this.parts.frontFork) {
    this.parts.frontFork.rotation.y =
      -amount * maxSteer;
  }

  if (this.parts.handlebars) {
    this.parts.handlebars.rotation.y =
      -amount * maxSteer;
  }
}

  rotateWheels(amount) {
    if (this.frontWheel) {
      this.frontWheel.rotation.x -=
        amount;
    }

    if (this.rearWheel) {
      this.rearWheel.rotation.x -=
        amount;
    }
  }

  setLean(amount) {
    const lean =
      THREE.MathUtils.clamp(
        amount,
        -1,
        1
      );

    const maxLean =
      THREE.MathUtils.degToRad(18);

    this.rotation.z =
      lean * maxLean;
  }

  resetLean() {
    this.rotation.z = 0;
  }

  // ============================================================
  // SIMPLE PHYSICS
  // ============================================================

  drive(
    throttle,
    braking,
    steering,
    dt
  ) {
    throttle =
      THREE.MathUtils.clamp(
        throttle,
        -1,
        1
      );

    braking =
      THREE.MathUtils.clamp(
        braking,
        0,
        1
      );

    steering =
      THREE.MathUtils.clamp(
        steering,
        -1,
        1
      );

    this.throttle = throttle;

    this.setSteering(
      steering
    );

    // Acceleration.
    if (throttle > 0) {
      this.speed +=
        this.acceleration *
        throttle *
        dt;
    }

    // Braking.
    if (braking > 0) {
      if (this.speed > 0) {
        this.speed -=
          this.brakePower *
          braking *
          dt;
      } else {
        this.speed -=
          this.acceleration *
          braking *
          dt;
      }
    }

    // Natural drag.
    if (
      throttle === 0 &&
      braking === 0
    ) {
      if (this.speed > 0) {
        this.speed = Math.max(
          0,
          this.speed -
            this.drag * dt
        );
      } else if (
        this.speed < 0
      ) {
        this.speed = Math.min(
          0,
          this.speed +
            this.drag * dt
        );
      }
    }

    this.speed =
      THREE.MathUtils.clamp(
        this.speed,
        -this.maxReverseSpeed,
        this.maxSpeed
      );

    // Steering becomes stronger with speed.
    const speedRatio =
      THREE.MathUtils.clamp(
        Math.abs(this.speed) /
          this.maxSpeed,
        0,
        1
      );

    if (Math.abs(this.speed) > 0.05) {
      const reverse =
        this.speed < 0
          ? -1
          : 1;

      this.rotation.y +=
        steering *
        this.turnRate *
        speedRatio *
        reverse *
        dt;
    }

    // Move forward along local +Z.
    const forward =
      new THREE.Vector3(
        0,
        0,
        1
      );

    forward.applyQuaternion(
      this.quaternion
    );

    this.position.addScaledVector(
      forward,
      this.speed * dt
    );

    // Visual wheel rotation.
    this.rotateWheels(
      this.speed * dt /
        this.WHEEL_RADIUS
    );

    // Visual lean.
    const leanAmount =
      steering *
      speedRatio;

    this.setLean(
      leanAmount
    );
  }
}