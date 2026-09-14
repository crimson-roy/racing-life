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

    this.LENGTH = 3.65;
    this.WIDTH = 1.90;

    this.BODY_LENGTH = 2.95;
    this.BODY_WIDTH = 1.64;
    this.BODY_HEIGHT = 1.22;

    this.GROUND_CLEARANCE = 0.28;

    // ============================================================
    // MATERIALS
    // ============================================================

    this.bodyPaint = new THREE.MeshStandardMaterial({
      color: 0xc8c0b8,
      roughness: 0.70,
      metalness: 0.10
    });

    this.bodyLight = new THREE.MeshStandardMaterial({
      color: 0xe2dbd2,
      roughness: 0.60,
      metalness: 0.08
    });

    this.bodyDark = new THREE.MeshStandardMaterial({
      color: 0x928a80,
      roughness: 0.76,
      metalness: 0.06
    });

    this.enginePaint = new THREE.MeshStandardMaterial({
      color: 0x55514d,
      roughness: 0.72,
      metalness: 0.25
    });

    this.blackMetal = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.55,
      metalness: 0.65
    });

    this.darkRubber = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.96,
      metalness: 0
    });

    this.metal = new THREE.MeshStandardMaterial({
      color: 0x414141,
      roughness: 0.45,
      metalness: 0.72
    });

    this.chrome = new THREE.MeshStandardMaterial({
      color: 0xbfc1c2,
      roughness: 0.18,
      metalness: 0.90
    });

    this.whiteParts = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      roughness: 0.45,
      metalness: 0.20
    });

    this.interior = new THREE.MeshStandardMaterial({
      color: 0x121212,
      roughness: 0.88,
      metalness: 0
    });

    this.glass = new THREE.MeshStandardMaterial({
      color: 0x243038,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55
    });

    this.lightLens = new THREE.MeshStandardMaterial({
      color: 0xddddcc,
      emissive: 0xffffee,
      emissiveIntensity: 1.4,
      roughness: 0.18,
      metalness: 0.05
    });

    this.redLens = new THREE.MeshStandardMaterial({
      color: 0x550000,
      emissive: 0xff0000,
      emissiveIntensity: 1.1,
      roughness: 0.20,
      metalness: 0.05
    });

    this.yellowLens = new THREE.MeshStandardMaterial({
      color: 0x996600,
      emissive: 0xffaa22,
      emissiveIntensity: 1.0,
      roughness: 0.25,
      metalness: 0.05
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
    this.engine = new THREE.Group();
    this.exhaust = new THREE.Group();
    this.lighting = new THREE.Group();
    this.details = new THREE.Group();

    this.add(
      this.wheels,
      this.chassis,
      this.body,
      this.fenders,
      this.cage,
      this.suspension,
      this.interiorGroup,
      this.engine,
      this.exhaust,
      this.lighting,
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
    this.createRollCage();
    this.createSuspension();
    this.createFrontBumper();
    this.createRearBumper();
    this.createEngine();
    this.createExhaust();
    this.createSpareWheel();
    this.createLights();
    this.createAntenna();
    this.createPanelDetails();

    // ============================================================
    // VEHICLE STATE
    // ============================================================

    this.speed = 0;
    this.steering = 0;

    this.maxSpeed = options.maxSpeed ?? 15;
    this.maxReverseSpeed = options.maxReverseSpeed ?? 5;

    this.acceleration = options.acceleration ?? 7;
    this.brakePower = options.brakePower ?? 10;
    this.drag = options.drag ?? 2.5;
    this.turnRate = options.turnRate ?? 1.6;
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

  addBox(
    group,
    name,
    size,
    position,
    material,
    rotation = [0, 0, 0]
  ) {
    const mesh = this.mesh(
      new THREE.BoxGeometry(
        size[0],
        size[1],
        size[2]
      ),
      material,
      name
    );

    mesh.position.set(
      position[0],
      position[1],
      position[2]
    );

    mesh.rotation.set(
      rotation[0],
      rotation[1],
      rotation[2]
    );

    group.add(mesh);

    this.parts[name] = mesh;

    return mesh;
  }

  addCylinder(
    group,
    name,
    radius,
    length,
    position,
    material,
    rotation = [0, 0, 0],
    radialSegments = 12
  ) {
    const mesh = this.mesh(
      new THREE.CylinderGeometry(
        radius,
        radius,
        length,
        radialSegments
      ),
      material,
      name
    );

    mesh.position.set(
      position[0],
      position[1],
      position[2]
    );

    mesh.rotation.set(
      rotation[0],
      rotation[1],
      rotation[2]
    );

    group.add(mesh);

    this.parts[name] = mesh;

    return mesh;
  }

  addTube(
    group,
    name,
    start,
    end,
    radius,
    material,
    radialSegments = 10
  ) {
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
        radialSegments
      );

    const tube = this.mesh(
      geometry,
      material,
      name
    );

    tube.position
      .copy(start)
      .add(end)
      .multiplyScalar(0.5);

    tube.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );

    group.add(tube);

    this.parts[name] = tube;

    return tube;
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

    steeringPivot.name = name;

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
        radius * 0.84,
        radius * 0.16,
        18,
        36
      );

    const tire =
      this.mesh(
        tireGeometry,
        this.darkRubber,
        `${name}_Tire`
      );

    tire.rotation.y =
      Math.PI / 2;

    rollPivot.add(tire);

    // ------------------------------------------------------------
    // Rim
    // ------------------------------------------------------------

    const rimRadius =
      radius * 0.66;

    const rim =
      this.mesh(
        new THREE.CylinderGeometry(
          rimRadius,
          rimRadius,
          width * 0.30,
          24
        ),
        this.metal,
        `${name}_Rim`
      );

    rim.rotation.z =
      Math.PI / 2;

    rollPivot.add(rim);

    // ------------------------------------------------------------
    // Five spokes
    // ------------------------------------------------------------

    const spokes =
      new THREE.Group();

    spokes.name =
      `${name}_Spokes`;

    for (let i = 0; i < 5; i++) {
      const angle =
        (i / 5) *
        Math.PI *
        2;

      const spoke =
        this.mesh(
          new THREE.BoxGeometry(
            width * 0.065,
            rimRadius * 0.70,
            width * 0.025
          ),
          this.chrome,
          `${name}_Spoke_${i}`
        );

      spoke.position.y =
        Math.cos(angle) *
        rimRadius *
        0.31;

      spoke.position.z =
        Math.sin(angle) *
        rimRadius *
        0.31;

      spoke.rotation.x =
        angle;

      spokes.add(spoke);
    }

    rollPivot.add(spokes);

    // Center cap.
    const cap =
      this.mesh(
        new THREE.CylinderGeometry(
          radius * 0.11,
          radius * 0.11,
          width * 0.34,
          16
        ),
        this.chrome,
        `${name}_CenterCap`
      );

    cap.rotation.z =
      Math.PI / 2;

    rollPivot.add(cap);

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
      this.WHEEL_DIAMETER * 0.25;

    const rearWidth =
      this.WHEEL_DIAMETER * 0.38;

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
        this.WHEEL_RADIUS * 1.06,
        false
      );

    this.rearWheelRight =
      this.createWheel(
        'RearWheelRight',
        this.REAR_TRACK / 2,
        rearZ,
        rearWidth,
        this.WHEEL_RADIUS * 1.06,
        false
      );
  }

  // ============================================================
  // CHASSIS
  // ============================================================

  createChassis() {
    this.addBox(
      this.chassis,
      'FloorPan',
      [
        this.BODY_WIDTH * 0.62,
        0.12,
        this.WHEELBASE * 0.92
      ],
      [
        0,
        this.GROUND_CLEARANCE,
        0
      ],
      this.blackMetal
    );

    this.addBox(
      this.chassis,
      'CentralBackbone',
      [
        this.BODY_WIDTH * 0.13,
        0.20,
        this.WHEELBASE * 0.86
      ],
      [
        0,
        this.GROUND_CLEARANCE + 0.10,
        0
      ],
      this.metal
    );

    for (const side of [-1, 1]) {
      this.addBox(
        this.chassis,
        side === -1
          ? 'LeftChassisRail'
          : 'RightChassisRail',
        [
          0.09,
          0.12,
          this.WHEELBASE * 0.84
        ],
        [
          side *
            this.BODY_WIDTH *
            0.29,
          this.GROUND_CLEARANCE +
            0.05,
          0
        ],
        this.blackMetal
      );
    }
  }

  // ============================================================
  // MAIN BODY
  // ============================================================

  createBody() {
    // ------------------------------------------------------------
    // Lower tub
    // ------------------------------------------------------------

    this.addBox(
      this.body,
      'LowerBody',
      [
        this.BODY_WIDTH * 0.68,
        0.30,
        this.BODY_LENGTH * 0.72
      ],
      [
        0,
        0.50,
        -0.01
      ],
      this.bodyPaint
    );

    // ------------------------------------------------------------
    // Front nose
    // ------------------------------------------------------------

    const nose =
      this.mesh(
        new THREE.SphereGeometry(
          1,
          32,
          20
        ),
        this.bodyLight,
        'FrontNose'
      );

    nose.scale.set(
      this.BODY_WIDTH * 0.37,
      0.28,
      this.BODY_LENGTH * 0.15
    );

    nose.position.set(
      0,
      0.67,
      this.WHEELBASE * 0.43
    );

    this.body.add(nose);

    this.parts.FrontNose = nose;

    // ------------------------------------------------------------
    // Hood
    // ------------------------------------------------------------

    const hood =
      this.mesh(
        new THREE.SphereGeometry(
          1,
          32,
          20
        ),
        this.bodyPaint,
        'Hood'
      );

    hood.scale.set(
      this.BODY_WIDTH * 0.35,
      0.21,
      this.BODY_LENGTH * 0.14
    );

    hood.position.set(
      0,
      0.81,
      this.WHEELBASE * 0.30
    );

    this.body.add(hood);

    this.parts.Hood = hood;

    // ------------------------------------------------------------
    // Hood center ridge
    // ------------------------------------------------------------

    this.addBox(
      this.body,
      'HoodCenterRidge',
      [
        0.08,
        0.035,
        this.BODY_LENGTH * 0.22
      ],
      [
        0,
        1.00,
        this.WHEELBASE * 0.29
      ],
      this.bodyDark
    );

    // ------------------------------------------------------------
    // Cabin lower side shell
    // ------------------------------------------------------------

    this.addBox(
      this.body,
      'CabinLower',
      [
        this.BODY_WIDTH * 0.60,
        0.31,
        this.BODY_LENGTH * 0.34
      ],
      [
        0,
        0.86,
        -0.02
      ],
      this.bodyDark
    );

    // ------------------------------------------------------------
    // Cabin roof
    // ------------------------------------------------------------

    const roof =
      this.mesh(
        new THREE.SphereGeometry(
          1,
          32,
          20
        ),
        this.bodyLight,
        'CabinRoof'
      );

    roof.scale.set(
      this.BODY_WIDTH * 0.32,
      0.33,
      this.BODY_LENGTH * 0.23
    );

    roof.position.set(
      0,
      1.13,
      -0.08
    );

    this.body.add(roof);

    this.parts.CabinRoof = roof;

    // ------------------------------------------------------------
    // Rear taper
    // ------------------------------------------------------------

    const rearTaper =
      this.mesh(
        new THREE.SphereGeometry(
          1,
          28,
          18
        ),
        this.bodyDark,
        'RearTaper'
      );

    rearTaper.scale.set(
      this.BODY_WIDTH * 0.32,
      0.27,
      this.BODY_LENGTH * 0.17
    );

    rearTaper.position.set(
      0,
      0.75,
      -this.WHEELBASE * 0.29
    );

    rearTaper.rotation.x =
      0.08;

    this.body.add(rearTaper);

    this.parts.RearTaper =
      rearTaper;

    // ------------------------------------------------------------
    // Rear engine deck
    // ------------------------------------------------------------

    this.addBox(
      this.body,
      'RearEngineDeck',
      [
        this.BODY_WIDTH * 0.63,
        0.23,
        this.BODY_LENGTH * 0.19
      ],
      [
        0,
        0.65,
        -this.WHEELBASE * 0.46
      ],
      this.bodyDark,
      [-0.04, 0, 0]
    );

    // ------------------------------------------------------------
    // Rear lower apron
    // ------------------------------------------------------------

    this.addBox(
      this.body,
      'RearLowerApron',
      [
        this.BODY_WIDTH * 0.64,
        0.30,
        this.BODY_LENGTH * 0.12
      ],
      [
        0,
        0.49,
        -this.WHEELBASE * 0.51
      ],
      this.bodyDark
    );

    // ------------------------------------------------------------
    // Engine opening / vents
    // ------------------------------------------------------------

    this.addBox(
      this.body,
      'EngineOpening',
      [
        this.BODY_WIDTH * 0.38,
        0.10,
        this.BODY_LENGTH * 0.07
      ],
      [
        0,
        0.80,
        -this.WHEELBASE * 0.53
      ],
      this.blackMetal
    );

    // Rear deck vents.
    for (let i = -2; i <= 2; i++) {
      this.addBox(
        this.body,
        `RearVent_${i}`,
        [
          0.035,
          0.025,
          0.15
        ],
        [
          i * 0.085,
          0.82,
          -this.WHEELBASE * 0.47
        ],
        this.blackMetal,
        [0.15, 0, 0]
      );
    }
  }

  // ============================================================
  // FENDERS
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
      wheelRadius * 1.22;

    const innerR =
      wheelRadius * 0.93;

    const shape =
      new THREE.Shape();

    const segments = 20;

    // Outer upper arc.
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
        shape.moveTo(z, y);
      } else {
        shape.lineTo(z, y);
      }
    }

    // Inner return arc.
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

      shape.lineTo(z, y);
    }

    shape.closePath();

    const geometry =
      new THREE.ExtrudeGeometry(
        shape,
        {
          depth: 0.13,
          bevelEnabled: true,
          bevelThickness: 0.025,
          bevelSize: 0.02,
          bevelSegments: 2,
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
      this.WHEEL_RADIUS * 1.00,
      wheelZ
    );

    panel.position.x +=
      side * 0.035;

    this.fenders.add(panel);

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
      this.bodyLight
    );

    this.createFenderPanel(
      'RightFrontFender',
      1,
      this.WHEELBASE / 2,
      this.FRONT_TRACK,
      this.WHEEL_RADIUS,
      this.bodyLight
    );

    this.createFenderPanel(
      'LeftRearFender',
      -1,
      -this.WHEELBASE / 2,
      this.REAR_TRACK,
      this.WHEEL_RADIUS * 1.06,
      this.bodyPaint
    );

    this.createFenderPanel(
      'RightRearFender',
      1,
      -this.WHEELBASE / 2,
      this.REAR_TRACK,
      this.WHEEL_RADIUS * 1.06,
      this.bodyPaint
    );

    // Fender mounting strips.
    for (const side of [-1, 1]) {
      this.addBox(
        this.fenders,
        side === -1
          ? 'LeftFrontFenderMount'
          : 'RightFrontFenderMount',
        [
          0.035,
          0.035,
          0.68
        ],
        [
          side *
            (this.FRONT_TRACK / 2 +
              0.035),
          0.79,
          this.WHEELBASE / 2
        ],
        this.blackMetal
      );

      this.addBox(
        this.fenders,
        side === -1
          ? 'LeftRearFenderMount'
          : 'RightRearFenderMount',
        [
          0.035,
          0.035,
          0.72
        ],
        [
          side *
            (this.REAR_TRACK / 2 +
              0.035),
          0.77,
          -this.WHEELBASE / 2
        ],
        this.blackMetal
      );
    }
  }

  // ============================================================
  // COCKPIT
  // ============================================================

  createCockpit() {
    this.addBox(
      this.interiorGroup,
      'CockpitFloor',
      [
        this.BODY_WIDTH * 0.48,
        0.06,
        this.BODY_LENGTH * 0.35
      ],
      [
        0,
        this.GROUND_CLEARANCE + 0.13,
        -0.04
      ],
      this.interior
    );

    // Seat bases.
    for (const side of [-1, 1]) {
      this.addBox(
        this.interiorGroup,
        side === -1
          ? 'DriverSeat'
          : 'PassengerSeat',
        [
          this.BODY_WIDTH * 0.15,
          0.34,
          0.46
        ],
        [
          side * 0.25,
          0.70,
          -0.04
        ],
        this.interior
      );

      // Small seat back.
      this.addBox(
        this.interiorGroup,
        side === -1
          ? 'DriverSeatBack'
          : 'PassengerSeatBack',
        [
          this.BODY_WIDTH * 0.14,
          0.40,
          0.10
        ],
        [
          side * 0.25,
          0.88,
          -0.27
        ],
        this.interior,
        [0.18, 0, 0]
      );
    }

    // Dashboard.
    this.addBox(
      this.interiorGroup,
      'Dashboard',
      [
        this.BODY_WIDTH * 0.46,
        0.14,
        0.17
      ],
      [
        0,
        0.93,
        this.WHEELBASE * 0.20
      ],
      this.interior
    );

    // Instrument cluster.
    for (let i = -1; i <= 1; i++) {
      this.addCylinder(
        this.interiorGroup,
        `Gauge_${i}`,
        0.045,
        0.018,
        [
          i * 0.08,
          0.96,
          this.WHEELBASE * 0.205
        ],
        this.chrome,
        [Math.PI / 2, 0, 0],
        12
      );
    }

    // Steering wheel.
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
          this.BODY_WIDTH * 0.46,
          0.18,
          0.03
        ),
        this.glass,
        'Windshield'
      );

    windshield.position.set(
      0,
      1.07,
      0.42
    );

    windshield.rotation.x =
      -0.18;

    this.body.add(
      windshield
    );

    this.parts.windshield =
      windshield;

    // Windshield frame.
    this.addBox(
      this.body,
      'WindshieldTopFrame',
      [
        this.BODY_WIDTH * 0.48,
        0.025,
        0.04
      ],
      [
        0,
        1.16,
        0.40
      ],
      this.blackMetal,
      [-0.18, 0, 0]
    );

    this.addBox(
      this.body,
      'WindshieldBottomFrame',
      [
        this.BODY_WIDTH * 0.48,
        0.025,
        0.04
      ],
      [
        0,
        0.98,
        0.42
      ],
      this.blackMetal,
      [-0.18, 0, 0]
    );
  }

  // ============================================================
  // ROLL CAGE
  // ============================================================

  createRollCage() {
    const r = 0.038;

    const frontLeft =
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.29,
        0.80,
        this.WHEELBASE * 0.15
      );

    const frontRight =
      new THREE.Vector3(
        this.BODY_WIDTH * 0.29,
        0.80,
        this.WHEELBASE * 0.15
      );

    const frontTopLeft =
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.29,
        1.43,
        this.WHEELBASE * 0.15
      );

    const frontTopRight =
      new THREE.Vector3(
        this.BODY_WIDTH * 0.29,
        1.43,
        this.WHEELBASE * 0.15
      );

    const rearLeft =
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.30,
        0.82,
        -this.WHEELBASE * 0.27
      );

    const rearRight =
      new THREE.Vector3(
        this.BODY_WIDTH * 0.30,
        0.82,
        -this.WHEELBASE * 0.27
      );

    const rearTopLeft =
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.30,
        1.48,
        -this.WHEELBASE * 0.27
      );

    const rearTopRight =
      new THREE.Vector3(
        this.BODY_WIDTH * 0.30,
        1.48,
        -this.WHEELBASE * 0.27
      );

    this.addTube(
      this.cage,
      'CageFrontLeft',
      frontLeft,
      frontTopLeft,
      r,
      this.whiteParts
    );

    this.addTube(
      this.cage,
      'CageFrontRight',
      frontRight,
      frontTopRight,
      r,
      this.whiteParts
    );

    this.addTube(
      this.cage,
      'CageRearLeft',
      rearLeft,
      rearTopLeft,
      r,
      this.whiteParts
    );

    this.addTube(
      this.cage,
      'CageRearRight',
      rearRight,
      rearTopRight,
      r,
      this.whiteParts
    );

    this.addTube(
      this.cage,
      'CageFrontTop',
      frontTopLeft,
      frontTopRight,
      r,
      this.whiteParts
    );

    this.addTube(
      this.cage,
      'CageRearTop',
      rearTopLeft,
      rearTopRight,
      r,
      this.whiteParts
    );

    this.addTube(
      this.cage,
      'CageLeftRoofRail',
      frontTopLeft,
      rearTopLeft,
      r,
      this.whiteParts
    );

    this.addTube(
      this.cage,
      'CageRightRoofRail',
      frontTopRight,
      rearTopRight,
      r,
      this.whiteParts
    );

    this.addTube(
      this.cage,
      'CageSeatCrossbar',
      new THREE.Vector3(
        -this.BODY_WIDTH * 0.30,
        1.12,
        -this.WHEELBASE * 0.18
      ),
      new THREE.Vector3(
        this.BODY_WIDTH * 0.30,
        1.12,
        -this.WHEELBASE * 0.18
      ),
      r,
      this.whiteParts
    );
  }

  // ============================================================
  // SUSPENSION
  // ============================================================

  createSuspension() {
    // Front A-arms.
    for (const side of [-1, 1]) {
      this.addTube(
        this.suspension,
        side === -1
          ? 'LeftFrontUpperArm'
          : 'RightFrontUpperArm',
        new THREE.Vector3(
          side * 0.18,
          0.38,
          this.WHEELBASE * 0.42
        ),
        new THREE.Vector3(
          side * (this.FRONT_TRACK / 2 - 0.05),
          0.45,
          this.WHEELBASE * 0.49
        ),
        0.025,
        this.blackMetal
      );

      this.addTube(
        this.suspension,
        side === -1
          ? 'LeftFrontLowerArm'
          : 'RightFrontLowerArm',
        new THREE.Vector3(
          side * 0.22,
          0.31,
          this.WHEELBASE * 0.42
        ),
        new THREE.Vector3(
          side * (this.FRONT_TRACK / 2 - 0.05),
          0.30,
          this.WHEELBASE * 0.49
        ),
        0.035,
        this.blackMetal
      );

      // Front shock.
      this.addCylinder(
        this.suspension,
        side === -1
          ? 'LeftFrontShock'
          : 'RightFrontShock',
        0.025,
        0.34,
        [
          side * 0.30,
          0.47,
          this.WHEELBASE * 0.42
        ],
        this.metal,
        [0, 0, side * 0.18],
        10
      );
    }

    // Rear trailing arms.
    for (const side of [-1, 1]) {
      this.addTube(
        this.suspension,
        side === -1
          ? 'LeftRearTrailingArm'
          : 'RightRearTrailingArm',
        new THREE.Vector3(
          side * 0.18,
          0.36,
          -this.WHEELBASE * 0.39
        ),
        new THREE.Vector3(
          side * (this.REAR_TRACK / 2 - 0.05),
          0.34,
          -this.WHEELBASE * 0.49
        ),
        0.04,
        this.blackMetal
      );

      this.addCylinder(
        this.suspension,
        side === -1
          ? 'LeftRearShock'
          : 'RightRearShock',
        0.03,
        0.38,
        [
          side * 0.30,
          0.46,
          -this.WHEELBASE * 0.37
        ],
        this.metal,
        [0, 0, side * 0.15],
        10
      );
    }
  }

  // ============================================================
  // FRONT BUMPER
  // ============================================================

  createFrontBumper() {
    const y = 0.43;
    const z = this.WHEELBASE * 0.62;

    this.addTube(
      this.details,
      'FrontBumperMain',
      new THREE.Vector3(
        -this.WIDTH * 0.43,
        y,
        z
      ),
      new THREE.Vector3(
        this.WIDTH * 0.43,
        y,
        z
      ),
      0.045,
      this.whiteParts
    );

    this.addTube(
      this.details,
      'FrontBumperLeftGuard',
      new THREE.Vector3(
        -this.WIDTH * 0.43,
        y,
        z
      ),
      new THREE.Vector3(
        -this.WIDTH * 0.34,
        0.65,
        z - 0.04
      ),
      0.04,
      this.whiteParts
    );

    this.addTube(
      this.details,
      'FrontBumperRightGuard',
      new THREE.Vector3(
        this.WIDTH * 0.43,
        y,
        z
      ),
      new THREE.Vector3(
        this.WIDTH * 0.34,
        0.65,
        z - 0.04
      ),
      0.04,
      this.whiteParts
    );

    this.addBox(
      this.details,
      'FrontSkidPlate',
      [
        this.WIDTH * 0.34,
        0.06,
        0.20
      ],
      [
        0,
        0.36,
        this.WHEELBASE * 0.58
      ],
      this.metal
    );

    // Winch.
    this.addCylinder(
      this.details,
      'FrontWinch',
      0.065,
      0.12,
      [
        0,
        0.48,
        this.WHEELBASE * 0.62
      ],
      this.blackMetal,
      [0, 0, Math.PI / 2],
      16
    );

    const hook =
      this.mesh(
        new THREE.TorusGeometry(
          0.045,
          0.012,
          8,
          16,
          Math.PI
        ),
        this.metal,
        'WinchHook'
      );

    hook.rotation.x =
      Math.PI / 2;

    hook.position.set(
      0,
      0.42,
      this.WHEELBASE * 0.70
    );

    this.details.add(hook);
  }

  // ============================================================
  // REAR BUMPER
  // ============================================================

  createRearBumper() {
    this.addTube(
      this.details,
      'RearBumperMain',
      new THREE.Vector3(
        -this.WIDTH * 0.40,
        0.44,
        -this.WHEELBASE * 0.62
      ),
      new THREE.Vector3(
        this.WIDTH * 0.40,
        0.44,
        -this.WHEELBASE * 0.62
      ),
      0.045,
      this.blackMetal
    );
  }

  // ============================================================
  // REAR ENGINE
  // ============================================================

  createEngine() {
    // Central engine block.
    this.addBox(
      this.engine,
      'EngineBlock',
      [
        0.56,
        0.34,
        0.50
      ],
      [
        0,
        0.68,
        -this.WHEELBASE * 0.55
      ],
      this.enginePaint
    );

    // Two banks.
    for (const side of [-1, 1]) {
      this.addBox(
        this.engine,
        side === -1
          ? 'LeftCylinderBank'
          : 'RightCylinderBank',
        [
          0.20,
          0.24,
          0.38
        ],
        [
          side * 0.19,
          0.78,
          -this.WHEELBASE * 0.55
        ],
        this.metal,
        [0, side * 0.18, 0]
      );

      // Cooling fins.
      for (let i = 0; i < 4; i++) {
        this.addBox(
          this.engine,
          `${side === -1 ? 'Left' : 'Right'}CoolingFin_${i}`,
          [
            0.24,
            0.018,
            0.40
          ],
          [
            side * 0.19,
            0.69 + i * 0.055,
            -this.WHEELBASE * 0.55
          ],
          this.blackMetal
        );
      }
    }

    // Air box.
    this.addBox(
      this.engine,
      'AirBox',
      [
        0.28,
        0.16,
        0.22
      ],
      [
        0,
        0.94,
        -this.WHEELBASE * 0.55
      ],
      this.blackMetal
    );

    // Intake stacks.
    for (const side of [-1, 1]) {
      this.addCylinder(
        this.engine,
        side === -1
          ? 'LeftIntake'
          : 'RightIntake',
        0.055,
        0.12,
        [
          side * 0.12,
          1.02,
          -this.WHEELBASE * 0.55
        ],
        this.chrome,
        [0, 0, 0],
        12
      );
    }
  }

  // ============================================================
  // EXHAUST
  // ============================================================

  createExhaust() {
    for (const side of [-1, 1]) {
      const start =
        new THREE.Vector3(
          side * 0.20,
          0.61,
          -this.WHEELBASE * 0.58
        );

      const mid =
        new THREE.Vector3(
          side * 0.38,
          0.54,
          -this.WHEELBASE * 0.67
        );

      const end =
        new THREE.Vector3(
          side * 0.40,
          0.58,
          -this.WHEELBASE * 0.74
        );

      this.addTube(
        this.exhaust,
        side === -1
          ? 'LeftExhaustPipe'
          : 'RightExhaustPipe',
        start,
        mid,
        0.035,
        this.blackMetal
      );

      this.addTube(
        this.exhaust,
        side === -1
          ? 'LeftExhaustTip'
          : 'RightExhaustTip',
        mid,
        end,
        0.040,
        this.metal
      );
    }
  }

  // ============================================================
  // SPARE WHEEL
  // ============================================================

  createSpareWheel() {
    const spareGroup =
      new THREE.Group();

    spareGroup.name =
      'SpareWheelMount';

    const tire =
      this.mesh(
        new THREE.TorusGeometry(
          this.WHEEL_RADIUS * 0.86,
          this.WHEEL_RADIUS * 0.14,
          16,
          32
        ),
        this.darkRubber,
        'SpareTire'
      );

    tire.rotation.y =
      Math.PI / 2;

    spareGroup.add(tire);

    const rim =
      this.mesh(
        new THREE.CylinderGeometry(
          this.WHEEL_RADIUS * 0.64,
          this.WHEEL_RADIUS * 0.64,
          0.15,
          24
        ),
        this.metal,
        'SpareRim'
      );

    rim.rotation.z =
      Math.PI / 2;

    spareGroup.add(rim);

    spareGroup.position.set(
      0,
      0.82,
      -this.WHEELBASE * 0.69
    );

    spareGroup.rotation.x =
      THREE.MathUtils.degToRad(-15);

    this.details.add(
      spareGroup
    );

    this.parts.spareWheel =
      spareGroup;
  }

  // ============================================================
  // LIGHTS
  // ============================================================

  createLights() {
    // Round front headlights.
    for (const side of [-1, 1]) {
      const headlight =
        this.mesh(
          new THREE.SphereGeometry(
            0.10,
            18,
            12
          ),
          this.lightLens,
          side === -1
            ? 'LeftHeadlight'
            : 'RightHeadlight'
        );

      headlight.position.set(
        side * this.BODY_WIDTH * 0.27,
        0.77,
        this.WHEELBASE * 0.47
      );

      this.lighting.add(
        headlight
      );

      // Small headlight housing.
      const housing =
        this.mesh(
          new THREE.TorusGeometry(
            0.105,
            0.018,
            8,
            20
          ),
          this.blackMetal,
          side === -1
            ? 'LeftHeadlightHousing'
            : 'RightHeadlightHousing'
        );

      housing.rotation.x =
        Math.PI / 2;

      housing.position.copy(
        headlight.position
      );

      this.lighting.add(
        housing
      );
    }

    // Rear taillights.
    for (const side of [-1, 1]) {
      const tail =
        this.mesh(
          new THREE.SphereGeometry(
            0.075,
            16,
            10
          ),
          this.redLens,
          side === -1
            ? 'LeftTailLight'
            : 'RightTailLight'
        );

      tail.position.set(
        side * this.BODY_WIDTH * 0.27,
        0.69,
        -this.WHEELBASE * 0.60
      );

      this.lighting.add(
        tail
      );
    }

    // Cage LED bar.
    const led =
      this.mesh(
        new THREE.BoxGeometry(
          this.BODY_WIDTH * 0.28,
          0.045,
          0.06
        ),
        this.lightLens,
        'RollCageLED'
      );

    led.position.set(
      0,
      1.50,
      -this.WHEELBASE * 0.22
    );

    this.lighting.add(
      led
    );
  }

  // ============================================================
  // ANTENNA
  // ============================================================

  createAntenna() {
    this.addCylinder(
      this.details,
      'AntennaBase',
      0.045,
      0.10,
      [
        this.BODY_WIDTH * 0.33,
        0.82,
        -this.WHEELBASE * 0.32
      ],
      this.blackMetal,
      [0, 0, -0.18],
      10
    );

    this.addTube(
      this.details,
      'Antenna',
      new THREE.Vector3(
        this.BODY_WIDTH * 0.33,
        0.86,
        -this.WHEELBASE * 0.32
      ),
      new THREE.Vector3(
        this.BODY_WIDTH * 0.39,
        1.42,
        -this.WHEELBASE * 0.30
      ),
      0.012,
      this.blackMetal
    );
  }

  // ============================================================
  // PANEL DETAILS
  // ============================================================

  createPanelDetails() {
    // Hood seam.
    this.addBox(
      this.details,
      'HoodCabinSeam',
      [
        this.BODY_WIDTH * 0.55,
        0.025,
        0.025
      ],
      [
        0,
        0.99,
        0.10
      ],
      this.blackMetal
    );

    // Rear cabin seam.
    this.addBox(
      this.details,
      'CabinRearSeam',
      [
        this.BODY_WIDTH * 0.45,
        0.025,
        0.025
      ],
      [
        0,
        1.00,
        -0.34
      ],
      this.blackMetal
    );

    // Side body seam.
    for (const side of [-1, 1]) {
      this.addBox(
        this.details,
        side === -1
          ? 'LeftSideSeam'
          : 'RightSideSeam',
        [
          0.025,
          0.035,
          this.BODY_LENGTH * 0.33
        ],
        [
          side *
            this.BODY_WIDTH *
            0.365,
          0.63,
          -0.02
        ],
        this.blackMetal
      );
    }

    // Fender bolts.
    const boltPositions = [
      -0.30,
      -0.15,
      0,
      0.15,
      0.30
    ];

    for (const side of [-1, 1]) {
      for (let i = 0; i < boltPositions.length; i++) {
        const bolt =
          this.mesh(
            new THREE.CylinderGeometry(
              0.018,
              0.018,
              0.015,
              10
            ),
            this.chrome,
            `${side === -1 ? 'Left' : 'Right'}FenderBolt_${i}`
          );

        bolt.rotation.z =
          Math.PI / 2;

        bolt.position.set(
          side *
            (this.FRONT_TRACK / 2 +
              0.045),
          this.WHEEL_RADIUS +
            0.11,
          this.WHEELBASE / 2 +
            boltPositions[i]
        );

        this.details.add(
          bolt
        );
      }
    }
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
    // Visual wheel axis is inverted intentionally.

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

    if (this.parts.spareWheel) {
      // Spare is mounted and should remain stationary.
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

    // Acceleration.
    if (throttle > 0) {
      this.speed +=
        this.acceleration *
        throttle *
        dt;
    }

    // Brake / reverse.
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

    // Natural drag.
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