import * as THREE from 'three';

export class BFInjection extends THREE.Group {
  constructor(options = {}) {
    super();

    this.name = 'BFInjection';

    // ============================================================
    // MASTER DIMENSIONS
    // ============================================================

    this.WHEEL_DIAMETER = 0.95;
    this.WHEEL_RADIUS = this.WHEEL_DIAMETER / 2;

    this.WHEELBASE = 2.30;

    this.FRONT_TRACK = 1.55;
    this.REAR_TRACK = 1.60;

    this.BODY_LENGTH = 2.95;
    this.BODY_WIDTH = 1.64;
    this.BODY_HEIGHT = 1.22;

    this.LENGTH = 3.65;
    this.WIDTH = 1.90;

    this.GROUND_CLEARANCE = 0.28;

    // ============================================================
    // MATERIALS
    // ============================================================

    // Main mid-tone paint.
    this.bodyPaint = new THREE.MeshStandardMaterial({
      color: 0xc8c0b8,
      roughness: 0.7,
      metalness: 0.1
    });

    // Clearly lighter panel material.
    this.bodyPanelLight = new THREE.MeshStandardMaterial({
      color: 0xe2dbd2,
      roughness: 0.62,
      metalness: 0.08
    });

    // Clearly darker panel material.
    this.bodyPanelDark = new THREE.MeshStandardMaterial({
      color: 0x928a80,
      roughness: 0.76,
      metalness: 0.06
    });

    // Dark rear engine deck.
    this.bodyDark = new THREE.MeshStandardMaterial({
      color: 0x817b75,
      roughness: 0.78,
      metalness: 0.05
    });

    this.blackMetal = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.6,
      metalness: 0.5
    });

    this.rubber = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.95,
      metalness: 0
    });

    this.metal = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.6
    });

    this.whiteParts = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      roughness: 0.5,
      metalness: 0.2
    });

    this.interior = new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.85,
      metalness: 0
    });

    this.glass = new THREE.MeshStandardMaterial({
       color: 0x243038,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55
    });

    // ============================================================
    // GROUPS
    // ============================================================

    this.wheels = new THREE.Group();
    this.chassis = new THREE.Group();
    this.body = new THREE.Group();
    this.fenders = new THREE.Group();
    this.cage = new THREE.Group();
    this.suspension = new THREE.Group();
    this.interiorGroup = new THREE.Group();
    this.details = new THREE.Group();

    this.add(
      this.wheels,
      this.chassis,
      this.body,
      this.fenders,
      this.cage,
      this.suspension,
      this.interiorGroup,
      this.details
    );

    this.parts = {};

    // ============================================================
    // BUILD
    // ============================================================

    this.createWheels();
    this.createChassis();
    this.createBody();
    this.createFenders();
    this.createCockpit();
    this.createWindshield();
    this.createPanelSeams();
    this.createRollCage();
    this.createBumpers();

    // ============================================================
    // VEHICLE STATE
    // ============================================================

    this.speed = 0;
    this.steering = 0;

    this.maxSpeed = options.maxSpeed ?? 15;

    this.maxReverseSpeed =
      options.maxReverseSpeed ?? 5;

    this.acceleration =
      options.acceleration ?? 7;

    this.brakePower =
      options.brakePower ?? 10;

    this.drag =
      options.drag ?? 2.5;

    this.turnRate =
      options.turnRate ?? 1.6;
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

  createWheel(
    name,
    x,
    z,
    width,
    radius,
    isFront
  ) {
    const steeringPivot =
      new THREE.Group();

    steeringPivot.name =
      name;

    steeringPivot.position.set(
      x,
      radius,
      z
    );

    const rollPivot =
      new THREE.Group();

    rollPivot.name =
      `${name}_Roll`;

    steeringPivot.add(
      rollPivot
    );

    // ------------------------------------------------------------
    // Tire
    // ------------------------------------------------------------

    const tireGeometry =
      new THREE.TorusGeometry(
        radius * 0.86,
        radius * 0.14,
        16,
        32
      );

    const tire =
      this.mesh(
        tireGeometry,
        this.rubber,
        `${name}_Tire`
      );

    tire.rotation.y =
      Math.PI / 2;

    rollPivot.add(
      tire
    );

    // ------------------------------------------------------------
    // Rim
    // ------------------------------------------------------------

    const rimRadius =
      radius * 0.67;

    const rimGeometry =
      new THREE.CylinderGeometry(
        rimRadius,
        rimRadius,
        width * 0.30,
        24
      );

    const rim =
      this.mesh(
        rimGeometry,
        this.metal,
        `${name}_Rim`
      );

    rim.rotation.z =
      Math.PI / 2;

    rollPivot.add(
      rim
    );

    // ------------------------------------------------------------
    // Five spokes
    // ------------------------------------------------------------

    const spokes =
      new THREE.Group();

    for (let i = 0; i < 5; i++) {
      const angle =
        (i / 5) *
        Math.PI *
        2;

      const spokeGeometry =
        new THREE.BoxGeometry(
          width * 0.055,
          rimRadius * 0.72,
          width * 0.024
        );

      const spoke =
        this.mesh(
          spokeGeometry,
          this.metal,
          `${name}_Spoke_${i}`
        );

      spoke.position.y =
        Math.cos(angle) *
        rimRadius *
        0.32;

      spoke.position.z =
        Math.sin(angle) *
        rimRadius *
        0.32;

      spoke.rotation.x =
        angle;

      spokes.add(
        spoke
      );
    }

    rollPivot.add(
      spokes
    );

    this.wheels.add(
      steeringPivot
    );

    this.parts[name] =
      steeringPivot;

    this.parts[
      `${name}_Roll`
    ] = rollPivot;

    this.parts[
      `${name}_Tire`
    ] = tire;

    this.parts[
      `${name}_Rim`
    ] = rim;

    this.parts[
      `${name}_IsFront`
    ] = isFront;

    return steeringPivot;
  }

  createWheels() {
    const frontZ =
      this.WHEELBASE / 2;

    const rearZ =
      -this.WHEELBASE / 2;

    const frontWidth =
      this.WHEEL_DIAMETER * 0.24;

    const rearWidth =
      this.WHEEL_DIAMETER * 0.36;

    this.frontWheelLeft =
      this.createWheel(
        'FrontWheelLeft',
        -this.FRONT_TRACK / 2,
        frontZ,
        frontWidth,
        this.WHEEL_RADIUS,
        true
      );

    this.frontWheelRight =
      this.createWheel(
        'FrontWheelRight',
        this.FRONT_TRACK / 2,
        frontZ,
        frontWidth,
        this.WHEEL_RADIUS,
        true
      );

    this.rearWheelLeft =
      this.createWheel(
        'RearWheelLeft',
        -this.REAR_TRACK / 2,
        rearZ,
        rearWidth,
        this.WHEEL_RADIUS,
        false
      );

    this.rearWheelRight =
      this.createWheel(
        'RearWheelRight',
        this.REAR_TRACK / 2,
        rearZ,
        rearWidth,
        this.WHEEL_RADIUS,
        false
      );
  }

  // ============================================================
  // CHASSIS
  // ============================================================

  createChassis() {
    const floor =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.60,
          0.12,
          this.WHEELBASE * 0.92
        ),
        this.blackMetal,
        'FloorPan'
      );

    floor.position.y =
      this.GROUND_CLEARANCE;

    this.chassis.add(
      floor
    );

    this.parts.floorPan =
      floor;

    const spine =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.13,
          0.20,
          this.WHEELBASE * 0.86
        ),
        this.metal,
        'CentralBackbone'
      );

    spine.position.y =
      this.GROUND_CLEARANCE +
      0.10;

    this.chassis.add(
      spine
    );

    this.parts.backbone =
      spine;

    for (const side of [-1, 1]) {
      const rail =
        this.mesh(
          new THREE.BoxGeometry(
            0.09,
            0.12,
            this.WHEELBASE * 0.84
          ),
          this.blackMetal,
          side === -1
            ? 'LeftChassisRail'
            : 'RightChassisRail'
        );

      rail.position.set(
        side *
          this.BODY_WIDTH *
          0.29,
        this.GROUND_CLEARANCE +
          0.05,
        0
      );

      this.chassis.add(
        rail
      );
    }
  }

  // ============================================================
  // BODY
  // ============================================================

  createBody() {
    // ------------------------------------------------------------
    // Lower side body
    // ------------------------------------------------------------

    const lower =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.72,
          0.30,
          this.BODY_LENGTH * 0.72
        ),
        this.bodyPaint,
        'LowerBody'
      );

    lower.position.set(
      0,
      0.50,
      -0.02
    );

    this.body.add(
      lower
    );

    this.parts.lowerBody =
      lower;

    // ------------------------------------------------------------
    // Front nose
    // ------------------------------------------------------------

    const nose =
      this.mesh(
        new THREE.SphereGeometry(
          1,
          28,
          18
        ),
        this.bodyPanelLight,
        'FrontNose'
      );

    nose.scale.set(
      this.BODY_WIDTH * 0.38,
      0.27,
      this.BODY_LENGTH * 0.16
    );

    nose.position.set(
      0,
      0.69,
      this.WHEELBASE * 0.40
    );

    this.body.add(
      nose
    );

    this.parts.frontNose =
      nose;

    // ------------------------------------------------------------
    // Hood
    // ------------------------------------------------------------

    const hood =
      this.mesh(
        new THREE.SphereGeometry(
          1,
          28,
          18
        ),
        this.bodyPanelLight,
        'Hood'
      );

    // Slightly shorter so its rear edge doesn't bury the
    // windshield/cabin transition.
    hood.scale.set(
      this.BODY_WIDTH * 0.36,
      0.22,
      this.BODY_LENGTH * 0.135
    );

    hood.position.set(
      0,
      0.82,
      this.WHEELBASE * 0.30
    );

    this.body.add(
      hood
    );

    this.parts.hood =
      hood;

    // ------------------------------------------------------------
    // Cabin lower
    // ------------------------------------------------------------

    const cabinLower =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.62,
          0.32,
          this.BODY_LENGTH * 0.33
        ),
        this.bodyPanelDark,
        'CabinLower'
      );

    cabinLower.position.set(
      0,
      0.86,
      -0.02
    );

    cabinLower.rotation.x =
      -0.02;

    this.body.add(
      cabinLower
    );

    this.parts.cabinLower =
      cabinLower;

    // ------------------------------------------------------------
    // Rounded upper greenhouse
    // ------------------------------------------------------------

    const roof =
      this.mesh(
        new THREE.SphereGeometry(
          1,
          32,
          20
        ),
        this.bodyPanelLight,
        'CabinRoof'
      );

    roof.scale.set(
  this.BODY_WIDTH * 0.34,
  0.34,
  this.BODY_LENGTH * 0.14
);

    roof.position.set(
      0,
      1.12,
      -0.10
    );

    this.body.add(
      roof
    );

    this.parts.cabinRoof =
      roof;

    // ------------------------------------------------------------
    // Rear taper
    // ------------------------------------------------------------

    const rearTaper =
      this.mesh(
        new THREE.SphereGeometry(
          1,
          24,
          16
        ),
        this.bodyPanelDark,
        'RearTaper'
      );

    rearTaper.scale.set(
      this.BODY_WIDTH * 0.34,
      0.30,
      this.BODY_LENGTH * 0.19
    );

    rearTaper.position.set(
      0,
      0.76,
      -this.WHEELBASE * 0.30
    );

    rearTaper.rotation.x =
      0.08;

    this.body.add(
      rearTaper
    );

    this.parts.rearTaper =
      rearTaper;

    // ------------------------------------------------------------
    // Rear engine deck
    // ------------------------------------------------------------

    const rearDeck =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.66,
          0.24,
          this.BODY_LENGTH * 0.19
        ),
        this.bodyDark,
        'RearEngineDeck'
      );

    rearDeck.position.set(
      0,
      0.65,
      -this.WHEELBASE * 0.46
    );

    this.body.add(
      rearDeck
    );

    this.parts.rearDeck =
      rearDeck;

    // ------------------------------------------------------------
    // Rear lower apron
    // ------------------------------------------------------------

    const rearApron =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.64,
          0.28,
          this.BODY_LENGTH * 0.12
        ),
        this.bodyDark,
        'RearLowerApron'
      );

    rearApron.position.set(
      0,
      0.49,
      -this.WHEELBASE * 0.52
    );

    this.body.add(
      rearApron
    );

    this.parts.rearLowerApron =
      rearApron;

    // ------------------------------------------------------------
    // Rear engine opening
    // ------------------------------------------------------------

    const engineOpening =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.36,
          0.10,
          this.BODY_LENGTH * 0.07
        ),
        this.blackMetal,
        'RearEngineOpening'
      );

    engineOpening.position.set(
      0,
      0.80,
      -this.WHEELBASE * 0.52
    );

    this.body.add(
      engineOpening
    );

    this.parts.engineOpening =
      engineOpening;
  }

  // ============================================================
  // FENDER PANELS
  // ============================================================

  createFenderPanel(
    name,
    side,
    wheelZ,
    track,
    wheelRadius,
    material
  ) {
    const outerR =
      wheelRadius * 1.18;

    const innerR =
      wheelRadius * 0.96;

    const shape =
      new THREE.Shape();

    const segments = 18;

    // Outer arc.
    for (let i = 0; i <= segments; i++) {
      const t =
        Math.PI -
        (Math.PI * i) /
          segments;

      const z =
        Math.cos(t) *
        outerR;

      const y =
        Math.sin(t) *
        outerR;

      if (i === 0) {
        shape.moveTo(
          z,
          y
        );
      } else {
        shape.lineTo(
          z,
          y
        );
      }
    }

    // Inner arc.
    for (let i = segments; i >= 0; i--) {
      const t =
        Math.PI -
        (Math.PI * i) /
          segments;

      const z =
        Math.cos(t) *
        innerR;

      const y =
        Math.sin(t) *
        innerR;

      shape.lineTo(
        z,
        y
      );
    }

    shape.closePath();

    const geometry =
      new THREE.ExtrudeGeometry(
        shape,
        {
          depth: 0.09,
          bevelEnabled: false,
          steps: 1
        }
      );

    geometry.rotateY(
      -Math.PI / 2
    );

    const panel =
      this.mesh(
        geometry,
        material,
        name
      );

    panel.position.set(
      side * track / 2,
      this.WHEEL_RADIUS +
        0.03,
      wheelZ
    );

    panel.position.x +=
      side * 0.025;

    this.fenders.add(
      panel
    );

    this.parts[name] =
      panel;

    return panel;
  }

  createFenders() {
    this.createFenderPanel(
      'LeftFrontFender',
      -1,
      this.WHEELBASE / 2,
      this.FRONT_TRACK,
      this.WHEEL_RADIUS,
      this.whiteParts
    );

    this.createFenderPanel(
      'RightFrontFender',
      1,
      this.WHEELBASE / 2,
      this.FRONT_TRACK,
      this.WHEEL_RADIUS,
      this.whiteParts
    );

    this.createFenderPanel(
      'LeftRearFender',
      -1,
      -this.WHEELBASE / 2,
      this.REAR_TRACK,
      this.WHEEL_RADIUS,
      this.bodyPaint
    );

    this.createFenderPanel(
  'RightRearFender',
  1,
  -this.WHEELBASE / 2,
  this.REAR_TRACK,
  this.WHEEL_RADIUS,
  this.bodyPaint
);
  }

  // ============================================================
  // COCKPIT
  // ============================================================

  createCockpit() {
    const floor =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.48,
          0.06,
          this.BODY_LENGTH * 0.34
        ),
        this.interior,
        'CockpitFloor'
      );

    floor.position.set(
      0,
      this.GROUND_CLEARANCE +
        0.12,
      -0.04
    );

    this.interiorGroup.add(
      floor
    );

    this.parts.cockpitFloor =
      floor;

    for (const side of [-1, 1]) {
      const seat =
        this.mesh(
          new THREE.BoxGeometry(
            this.BODY_WIDTH * 0.15,
            0.34,
            0.46
          ),
          this.interior,
          side === -1
            ? 'DriverSeat'
            : 'PassengerSeat'
        );

      seat.position.set(
        side * 0.25,
        0.70,
        -0.04
      );

      this.interiorGroup.add(
        seat
      );
    }

    const dash =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.48,
          0.14,
          0.16
        ),
        this.interior,
        'Dashboard'
      );

    dash.position.set(
      0,
      0.93,
      this.WHEELBASE * 0.20
    );

    this.interiorGroup.add(
      dash
    );

    this.parts.dashboard =
      dash;

    const steeringWheel =
      this.mesh(
        new THREE.TorusGeometry(
          0.14,
          0.025,
          8,
          20
        ),
        this.blackMetal,
        'SteeringWheel'
      );

    steeringWheel.rotation.x =
      Math.PI / 2;

    steeringWheel.position.set(
      -0.22,
      0.92,
      this.WHEELBASE * 0.16
    );

    this.interiorGroup.add(
      steeringWheel
    );

    this.parts.steeringWheel =
      steeringWheel;
  }

  // ============================================================
  // WINDSHIELD
  // ============================================================

  createWindshield() {
    const windshield =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.48,
          0.16,
          0.025
        ),
        this.glass,
        'Windshield'
      );

    // Moved forward and upward so it clears the hood volume.
    windshield.position.set(
      0,
      1.08,
      0.42
    );

    windshield.rotation.x =
      -0.18;

    this.body.add(
      windshield
    );

    this.parts.windshield =
      windshield;

    // Thin upper/lower black glass frame.
    const frameTop =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.50,
          0.025,
          0.035
        ),
        this.blackMetal,
        'WindshieldTopFrame'
      );

    frameTop.position.set(
      0,
      1.17,
      0.41
    );

    frameTop.rotation.x =
      -0.18;

    this.body.add(
      frameTop
    );

    const frameBottom =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.50,
          0.025,
          0.035
        ),
        this.blackMetal,
        'WindshieldBottomFrame'
      );

    frameBottom.position.set(
      0,
      1.00,
      0.41
    );

    frameBottom.rotation.x =
      -0.18;

    this.body.add(
      frameBottom
    );
  }

  // ============================================================
  // PANEL SEAMS
  //
  // These are deliberately thin, dark separation lines. They
  // guarantee the major body sections read as separate panels.
  // ============================================================

  createPanelSeams() {
    // Hood -> cabin seam.
    const hoodSeam =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.54,
          0.025,
          0.025
        ),
        this.blackMetal,
        'HoodCabinSeam'
      );

    hoodSeam.position.set(
      0,
      1.015,
      0.10
    );

    this.body.add(
      hoodSeam
    );

    // Cabin -> rear section seam.
    const rearSeam =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.48,
          0.025,
          0.025
        ),
        this.blackMetal,
        'CabinRearSeam'
      );

    rearSeam.position.set(
      0,
      0.99,
      -0.34
    );

    this.body.add(
      rearSeam
    );

    // Lower side break.
    const lowerSeam =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.68,
          0.025,
          0.025
        ),
        this.bodyDark,
        'LowerBodySeam'
      );

    lowerSeam.position.set(
      0,
      0.64,
      0.02
    );

    this.body.add(
      lowerSeam
    );

    this.parts.hoodCabinSeam =
      hoodSeam;

    this.parts.cabinRearSeam =
      rearSeam;
  }

  // ============================================================
  // ROLL CAGE
  // ============================================================

  createRollCage() {
    const cageRadius =
      0.035;

    const addTube = (
      start,
      end,
      name
    ) => {
      const direction =
        new THREE.Vector3()
          .subVectors(
            end,
            start
          );

      const length =
        direction.length();

      const geometry =
        new THREE.CylinderGeometry(
          cageRadius,
          cageRadius,
          length,
          10
        );

      const tube =
        this.mesh(
          geometry,
          this.whiteParts,
          name
        );

      tube.position
        .copy(start)
        .add(end)
        .multiplyScalar(0.5);

      tube.quaternion.setFromUnitVectors(
        new THREE.Vector3(
          0,
          1,
          0
        ),
        direction.normalize()
      );

      this.cage.add(
        tube
      );
    };

    const frontLowLeft =
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.29,
        0.78,
        this.WHEELBASE * 0.16
      );

    const frontLowRight =
      new THREE.Vector3(
        this.BODY_WIDTH * 0.29,
        0.78,
        this.WHEELBASE * 0.16
      );

    const frontHighLeft =
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.29,
        1.42,
        this.WHEELBASE * 0.16
      );

    const frontHighRight =
      new THREE.Vector3(
        this.BODY_WIDTH * 0.29,
        1.42,
        this.WHEELBASE * 0.16
      );

    const rearLowLeft =
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.29,
        0.80,
        -this.WHEELBASE * 0.27
      );

    const rearLowRight =
      new THREE.Vector3(
        this.BODY_WIDTH * 0.29,
        0.80,
        -this.WHEELBASE * 0.27
      );

    const rearHighLeft =
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.30,
        1.48,
        -this.WHEELBASE * 0.27
      );

    const rearHighRight =
      new THREE.Vector3(
        this.BODY_WIDTH * 0.30,
        1.48,
        -this.WHEELBASE * 0.27
      );

    addTube(
      frontLowLeft,
      frontHighLeft,
      'CageFrontLeft'
    );

    addTube(
      frontLowRight,
      frontHighRight,
      'CageFrontRight'
    );

    addTube(
      rearLowLeft,
      rearHighLeft,
      'CageRearLeft'
    );

    addTube(
      rearLowRight,
      rearHighRight,
      'CageRearRight'
    );

    addTube(
      frontHighLeft,
      frontHighRight,
      'CageFrontTop'
    );

    addTube(
      rearHighLeft,
      rearHighRight,
      'CageRearTop'
    );

    addTube(
      frontHighLeft,
      rearHighLeft,
      'CageLeftRoofRail'
    );

    addTube(
      frontHighRight,
      rearHighRight,
      'CageRightRoofRail'
    );

    addTube(
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.30,
        1.13,
        -this.WHEELBASE * 0.18
      ),
      new THREE.Vector3(
        this.BODY_WIDTH * 0.30,
        1.13,
        -this.WHEELBASE * 0.18
      ),
      'CageSeatCrossbar'
    );
  }

  // ============================================================
  // BUMPERS
  // ============================================================

  createBumpers() {
    const front =
      this.mesh(
        new THREE.CylinderGeometry(
          0.045,
          0.045,
          this.WIDTH * 0.82,
          10
        ),
        this.whiteParts,
        'FrontBumper'
      );

    front.rotation.z =
      Math.PI / 2;

    front.position.set(
      0,
      0.42,
      this.WHEELBASE * 0.61
    );

    this.details.add(
      front
    );

    const skid =
      this.mesh(
        new THREE.BoxGeometry(
          this.WIDTH * 0.36,
          0.06,
          0.18
        ),
        this.metal,
        'FrontSkidPlate'
      );

    skid.position.set(
      0,
      0.37,
      this.WHEELBASE * 0.57
    );

    this.details.add(
      skid
    );

    const rear =
      this.mesh(
        new THREE.CylinderGeometry(
          0.045,
          0.045,
          this.WIDTH * 0.76,
          10
        ),
        this.blackMetal,
        'RearBumper'
      );

    rear.rotation.z =
      Math.PI / 2;

    rear.position.set(
      0,
      0.44,
      -this.WHEELBASE * 0.61
    );

    this.details.add(
      rear
    );

    this.parts.frontBumper =
      front;

    this.parts.rearBumper =
      rear;
  }

  // ============================================================
  // STEERING
  // ============================================================

  setSteering(amount) {
    const maxSteer =
      THREE.MathUtils.degToRad(30);

    this.steering =
      THREE.MathUtils.clamp(
        amount,
        -1,
        1
      );

    // A / LEFT  = -1
    // D / RIGHT = +1
    //
    // Visual wheel steering axis is inverted.
    // The negative sign is intentional.

    this.frontWheelLeft.rotation.y =
      -this.steering *
      maxSteer;

    this.frontWheelRight.rotation.y =
      -this.steering *
      maxSteer;

    if (this.parts.steeringWheel) {
      this.parts.steeringWheel.rotation.z =
        -this.steering *
        THREE.MathUtils.degToRad(35);
    }
  }

  // ============================================================
  // WHEEL ROTATION
  // ============================================================

  rotateWheels(amount) {
    const wheels = [
      this.parts.FrontWheelLeft_Roll,
      this.parts.FrontWheelRight_Roll,
      this.parts.RearWheelLeft_Roll,
      this.parts.RearWheelRight_Roll
    ];

    for (const wheel of wheels) {
      if (wheel) {
        wheel.rotation.x -= amount;
      }
    }
  }

  // ============================================================
  // DRIVE
  // ============================================================

  drive(
    throttle,
    brake,
    steering,
    dt
  ) {
    this.setSteering(
      steering
    );

    if (throttle > 0) {
      this.speed +=
        this.acceleration *
        throttle *
        dt;
    }

    if (brake > 0) {
      if (this.speed > 0) {
        this.speed -=
          this.brakePower *
          brake *
          dt;
      } else {
        this.speed -=
          this.acceleration *
          brake *
          dt;
      }
    }

    if (
      throttle === 0 &&
      brake === 0
    ) {
      if (this.speed > 0) {
        this.speed =
          Math.max(
            0,
            this.speed -
              this.drag * dt
          );
      } else if (
        this.speed < 0
      ) {
        this.speed =
          Math.min(
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

    const speedRatio =
      THREE.MathUtils.clamp(
        Math.abs(this.speed) /
          this.maxSpeed,
        0,
        1
      );

    if (
      Math.abs(this.speed) >
      0.01
    ) {
      const reverse =
        this.speed < 0
          ? -1
          : 1;

      this.rotation.y -=
        this.steering *
        this.turnRate *
        speedRatio *
        reverse *
        dt;
    }

    this.translateZ(
      this.speed * dt
    );

    this.rotateWheels(
      this.speed *
        dt /
        this.WHEEL_RADIUS
    );
  }
}