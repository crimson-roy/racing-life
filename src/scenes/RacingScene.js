import Phaser from 'phaser';
import { careerState, applyRaceResult } from '../state/careerState.js';

const WORLD = {
  width: 1600,
  height: 1000
};

const TRACK = {
  cx: 800,
  cy: 500,
  radiusX: 520,
  radiusY: 330,
  sCurve: 110,
  roadWidth: 118,
  samples: 96
};

const TOTAL_LAPS = 3;

const MAPS = {
  desert: {
    name: 'DESERT RUN',
    ground: 0xcda56a,
    road: 0x3a3a3a,
    edge: 0xe7b75b
  },

  city: {
    name: 'CITY CIRCUIT',
    ground: 0x34424e,
    road: 0x2f3237,
    edge: 0xe53935
  },

  forest: {
    name: 'FOREST LOOP',
    ground: 0x477247,
    road: 0x303336,
    edge: 0x5bc47b
  },

  mountain: {
    name: 'MOUNTAIN PASS',
    ground: 0x6f7478,
    road: 0x303236,
    edge: 0x8ab4ff
  }
};

const AI_DRIVERS = [
  {
    name: 'Nova',
    color: 0x3388ff,
    speed: 278,
    lane: -34
  },

  {
    name: 'Rex',
    color: 0x24b36b,
    speed: 294,
    lane: -11
  },

  {
    name: 'Kai',
    color: 0xf1c40f,
    speed: 306,
    lane: 13
  },

  {
    name: 'Mika',
    color: 0x9b59ff,
    speed: 286,
    lane: 36
  }
];

function hex(value) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function makeCar(scene, x, y, color, scale = 1) {
  const container = scene.add.container(x, y);

  container.setScale(scale);

  const body = scene.add.rectangle(
    0,
    0,
    34,
    60,
    color,
    1
  );

  const windshield = scene.add.rectangle(
    0,
    -10,
    23,
    18,
    0x87ceeb,
    0.95
  );

  const stripe = scene.add.rectangle(
    0,
    15,
    8,
    24,
    0xffffff,
    1
  );

  const wheelA = scene.add.circle(
    -13,
    22,
    6,
    0x101215,
    1
  );

  const wheelB = scene.add.circle(
    13,
    22,
    6,
    0x101215,
    1
  );

  container.add([
    body,
    windshield,
    stripe,
    wheelA,
    wheelB
  ]);

  container.setDepth(10);

  return container;
}

export class RacingScene extends Phaser.Scene {
  constructor() {
    super('RacingScene');

    this.mapId = 'city';

    this.speed = 0;

    this.maxSpeed = 360;
    this.maxReverseSpeed = 150;

    this.acceleration = 270;
    this.brakePower = 400;

    this.turnSpeed = 2.8;

    this.totalLaps = TOTAL_LAPS;
    this.completedLaps = 0;

    this.playerTrackIndex = 0;
    this.previousPlayerTrackIndex = 0;

    this.playerStarted = false;

    this.raceOver = false;

    this.finishOrder = [];

    this.aiDrivers = [];

    this.viewMode = 'chase';
  }

  init(data) {
    this.mapId = data?.mapId || this.mapId || 'city';
  }

  create() {
    const map = MAPS[this.mapId] || MAPS.city;

    this.raceOver = false;
    this.speed = 0;

    this.completedLaps = 0;

    this.playerStarted = false;

    this.finishOrder = [];

    this.aiDrivers = [];

    this.viewMode = 'chase';

    /*
     * THIS IS THE NEW TRACK.
     *
     * Instead of the old rounded rectangle, both the visual track
     * and the AI racing line now use this same S-shaped circuit.
     */
    this.trackPath = this.buildTrackPath();

    this.cameras.main.setBackgroundColor(
      hex(map.ground)
    );

    this.cameras.main.setBounds(
      0,
      0,
      WORLD.width,
      WORLD.height
    );

    this.drawWorld(map);

    this.drawTrack(map);

    this.drawStartLine();

    const start = this.trackPath[0];

    this.car = makeCar(
      this,
      start.x,
      start.y,
      0xe53935,
      1
    );

    this.car.rotation =
      this.rotationForPathIndex(0);

    this.playerTrackIndex = 0;
    this.previousPlayerTrackIndex = 0;

    this.createAIGrid();

    this.setupInput();

    this.setupCamera();

    this.info = this.add.text(
      20,
      18,
      '',
      {
        fontFamily: 'Arial',
        fontSize: 19,
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: {
          x: 12,
          y: 8
        }
      }
    )
      .setScrollFactor(0)
      .setDepth(50);

    this.status = this.add.text(
      20,
      70,
      '',
      {
        fontFamily: 'Arial',
        fontSize: 15,
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: {
          x: 10,
          y: 6
        }
      }
    )
      .setScrollFactor(0)
      .setDepth(50);

    this.mapLabel = this.add.text(
      940,
      18,
      `${map.name}  •  5 RACERS`,
      {
        fontFamily: 'Arial',
        fontSize: 16,
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: {
          x: 10,
          y: 6
        }
      }
    )
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(50);

    this.help = this.add.text(
      20,
      640,
      'W/↑ accelerate   S/↓ brake/reverse   A/D or ←/→ steer   V camera   R reset   ESC menu',
      {
        fontFamily: 'Arial',
        fontSize: 15,
        color: '#ffffff',
        backgroundColor: '#00000066',
        padding: {
          x: 8,
          y: 5
        }
      }
    )
      .setScrollFactor(0)
      .setDepth(50);

    this.input.keyboard.on(
      'keydown-R',
      () => this.resetRace()
    );

    this.input.keyboard.on(
      'keydown-V',
      () => this.toggleView()
    );

    this.input.keyboard.once(
      'keydown-ESC',
      () => this.returnToMenu()
    );

    this.updateHud();
  }

  buildTrackPath() {
    const points = [];

    /*
     * Closed S-shaped circuit.
     *
     * The extra sine term bends the left and right sides,
     * producing the S/esses instead of the old rectangle.
     */
    for (
      let i = 0;
      i < TRACK.samples;
      i++
    ) {
      const t =
        Math.PI / 2 +
        (Math.PI * 2 * i) / TRACK.samples;

      points.push({
        x:
          TRACK.cx +
          TRACK.radiusX * Math.cos(t) +
          TRACK.sCurve * Math.sin(t * 2),

        y:
          TRACK.cy +
          TRACK.radiusY * Math.sin(t)
      });
    }

    return points;
  }

  drawWorld(map) {
    const g = this.add.graphics();

    g.fillStyle(map.ground, 1);

    g.fillRect(
      0,
      0,
      WORLD.width,
      WORLD.height
    );

    const scenery = this.add.graphics();

    scenery.fillStyle(
      0x000000,
      0.08
    );

    scenery.fillCircle(
      180,
      170,
      90
    );

    scenery.fillCircle(
      1400,
      780,
      110
    );

    scenery.fillCircle(
      1360,
      180,
      70
    );

    scenery.fillCircle(
      210,
      780,
      100
    );
  }

  drawTrack(map) {
    const shadow = this.add.graphics();

    shadow.lineStyle(
      TRACK.roadWidth + 18,
      0x000000,
      0.22
    );

    this.strokeClosedPath(shadow);

    const roadEdge = this.add.graphics();

    roadEdge.lineStyle(
      TRACK.roadWidth + 8,
      map.edge,
      1
    );

    this.strokeClosedPath(roadEdge);

    const road = this.add.graphics();

    road.lineStyle(
      TRACK.roadWidth,
      map.road,
      1
    );

    this.strokeClosedPath(road);

    const center = this.add.graphics();

    center.lineStyle(
      3,
      0xffffff,
      0.25
    );

    this.strokeClosedPath(center);

    const dashes = this.add.graphics();

    dashes.lineStyle(
      3,
      0xffffff,
      0.35
    );

    for (
      let i = 0;
      i < this.trackPath.length;
      i += 6
    ) {
      const a =
        this.trackPath[i];

      const b =
        this.trackPath[
          (i + 2) %
          this.trackPath.length
        ];

      dashes.lineBetween(
        a.x,
        a.y,
        b.x,
        b.y
      );
    }
  }

  strokeClosedPath(graphics) {
    graphics.beginPath();

    const first =
      this.trackPath[0];

    graphics.moveTo(
      first.x,
      first.y
    );

    for (
      let i = 1;
      i < this.trackPath.length;
      i++
    ) {
      const p =
        this.trackPath[i];

      graphics.lineTo(
        p.x,
        p.y
      );
    }

    graphics.closePath();

    graphics.strokePath();
  }

  drawStartLine() {
    const p =
      this.trackPath[0];

    const next =
      this.trackPath[1];

    const dx =
      next.x - p.x;

    const dy =
      next.y - p.y;

    const len =
      Math.hypot(dx, dy) || 1;

    const nx =
      -dy / len;

    const ny =
      dx / len;

    const line =
      this.add.graphics();

    const half =
      TRACK.roadWidth * 0.48;

    const tiles = 8;

    const tileLength =
      (half * 2) / tiles;

    for (
      let i = 0;
      i < tiles;
      i++
    ) {
      const a =
        -half +
        i * tileLength;

      const b =
        a + tileLength;

      line.lineStyle(
        10,
        i % 2 === 0
          ? 0xffffff
          : 0x111111,
        1
      );

      line.lineBetween(
        p.x + nx * a,
        p.y + ny * a,

        p.x + nx * b,
        p.y + ny * b
      );
    }

    line.setDepth(4);
  }

  createAIGrid() {
    const start =
      this.trackPath[0];

    const next =
      this.trackPath[1];

    const dx =
      next.x - start.x;

    const dy =
      next.y - start.y;

    const len =
      Math.hypot(dx, dy) || 1;

    const nx =
      -dy / len;

    const ny =
      dx / len;

    AI_DRIVERS.forEach(
      (driver, index) => {
        const x =
          start.x +
          nx * driver.lane;

        const y =
          start.y +
          ny * driver.lane;

        const car =
          makeCar(
            this,
            x,
            y,
            driver.color,
            0.82
          );

        car.rotation =
          this.rotationForPathIndex(0);

        this.aiDrivers.push({
          ...driver,

          sprite: car,

          waypointIndex: 1,

          completedLaps: 0,

          started: false,

          finished: false,

          seed:
            index * 37 + 11,

          impact: 0
        });
      }
    );
  }

  setupInput() {
    this.cursors =
      this.input.keyboard.createCursorKeys();

    this.keys =
      this.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D
      });
  }

  setupCamera() {
    const camera =
      this.cameras.main;

    camera.setZoom(1.12);

    camera.startFollow(
      this.car,
      true,
      0.09,
      0.09,
      0,
      95
    );
  }

  toggleView() {
    if (
      !this.car ||
      this.raceOver
    ) {
      return;
    }

    const camera =
      this.cameras.main;

    if (
      this.viewMode === 'chase'
    ) {
      this.viewMode =
        'cockpit';

      /*
       * Hide the player's own car for
       * the first-person-style view.
       */
      this.car.setVisible(false);

      camera.setZoom(1.28);

      camera.stopFollow();

      camera.startFollow(
        this.car,
        true,
        0.11,
        0.11,
        0,
        145
      );

      this.status.setText(
        'CAMERA: COCKPIT'
      );
    } else {
      this.viewMode =
        'chase';

      this.car.setVisible(true);

      camera.setZoom(1.12);

      camera.stopFollow();

      camera.startFollow(
        this.car,
        true,
        0.09,
        0.09,
        0,
        95
      );

      this.status.setText(
        'CAMERA: CHASE'
      );
    }

    this.time.delayedCall(
      900,
      () => {
        if (!this.raceOver) {
          this.status.setText('');
        }
      }
    );
  }

  update(_, delta) {
    if (this.raceOver) {
      return;
    }

    const dt =
      Math.min(
        delta / 1000,
        0.05
      );

    this.updatePlayer(dt);

    this.updateAI(dt);

    this.resolveCarCollisions();

    this.updateHud();
  }

  updatePlayer(dt) {
    const accelerating =
      this.cursors.up.isDown ||
      this.keys.W.isDown;

    const braking =
      this.cursors.down.isDown ||
      this.keys.S.isDown;

    const left =
      this.cursors.left.isDown ||
      this.keys.A.isDown;

    const right =
      this.cursors.right.isDown ||
      this.keys.D.isDown;

    if (accelerating) {
      this.speed +=
        this.acceleration * dt;
    } else if (braking) {
      this.speed -=
        (
          this.speed > 0
            ? this.brakePower
            : this.acceleration
        ) * dt;
    } else if (
      this.speed > 0
    ) {
      this.speed =
        Math.max(
          0,
          this.speed -
          75 * dt
        );
    } else if (
      this.speed < 0
    ) {
      this.speed =
        Math.min(
          0,
          this.speed +
          75 * dt
        );
    }

    this.speed =
      Phaser.Math.Clamp(
        this.speed,
        -this.maxReverseSpeed,
        this.maxSpeed
      );

    const steering =
      (right ? 1 : 0) -
      (left ? 1 : 0);

    const steeringStrength =
      Phaser.Math.Clamp(
        Math.abs(this.speed) /
          this.maxSpeed,
        0.12,
        1
      );

    const steerDirection =
      this.speed < 0
        ? -1
        : 1;

    this.car.rotation +=
      steering *
      steerDirection *
      this.turnSpeed *
      steeringStrength *
      dt;

    const movementAngle =
      this.car.rotation -
      Math.PI / 2;

    this.car.x +=
      Math.cos(movementAngle) *
      this.speed *
      dt;

    this.car.y +=
      Math.sin(movementAngle) *
      this.speed *
      dt;

    this.keepPlayerOnTrack();

    this.updatePlayerLap();
  }

  updateAI(dt) {
    for (
      const ai of this.aiDrivers
    ) {
      if (ai.finished) {
        continue;
      }

      ai.impact =
        Math.max(
          0,
          ai.impact - dt
        );

      const target =
        this.trackPath[
          ai.waypointIndex
        ];

      const dx =
        target.x -
        ai.sprite.x;

      const dy =
        target.y -
        ai.sprite.y;

      const distanceToTarget =
        Math.hypot(dx, dy);

      const targetAngle =
        Math.atan2(
          dy,
          dx
        );

      const targetRotation =
        targetAngle +
        Math.PI / 2;

      ai.sprite.rotation =
        Phaser.Math.Angle.RotateTo(
          ai.sprite.rotation,
          targetRotation,
          4.2 * dt
        );

      const wobble =
        Math.sin(
          (
            this.time.now +
            ai.seed * 1000
          ) * 0.0012
        ) * 7;

      const impactMultiplier =
        ai.impact > 0
          ? 0.58
          : 1;

      const currentSpeed =
        Math.max(
          170,
          (
            ai.speed +
            wobble
          ) *
          impactMultiplier
        );

      ai.sprite.x +=
        Math.cos(targetAngle) *
        currentSpeed *
        dt;

      ai.sprite.y +=
        Math.sin(targetAngle) *
        currentSpeed *
        dt;

      if (
        distanceToTarget < 48
      ) {
        const previousIndex =
          ai.waypointIndex;

        ai.waypointIndex =
          (
            ai.waypointIndex + 1
          ) %
          this.trackPath.length;

        if (!ai.started) {
          ai.started = true;
        } else if (
          ai.waypointIndex <
          previousIndex
        ) {
          ai.completedLaps += 1;

          if (
            ai.completedLaps >=
            this.totalLaps
          ) {
            this.finishAI(ai);
          }
        }
      }
    }
  }

  keepPlayerOnTrack() {
    const nearest =
      this.nearestTrackPoint(
        this.car.x,
        this.car.y
      );

    if (
      nearest.distance >
      TRACK.roadWidth * 0.48
    ) {
      const allowed =
        TRACK.roadWidth * 0.44;

      const pull =
        Math.min(
          1,
          (
            nearest.distance -
            allowed
          ) / 45
        );

      this.car.x =
        Phaser.Math.Linear(
          this.car.x,
          nearest.x,
          pull
        );

      this.car.y =
        Phaser.Math.Linear(
          this.car.y,
          nearest.y,
          pull
        );

      this.speed *= 0.72;
    }
  }

  nearestTrackPoint(x, y) {
    let best = {
      distance: Infinity,
      x: this.trackPath[0].x,
      y: this.trackPath[0].y,
      index: 0
    };

    for (
      let i = 0;
      i < this.trackPath.length;
      i++
    ) {
      const a =
        this.trackPath[i];

      const b =
        this.trackPath[
          (i + 1) %
          this.trackPath.length
        ];

      const abx =
        b.x - a.x;

      const aby =
        b.y - a.y;

      const ab2 =
        abx * abx +
        aby * aby ||
        1;

      const t =
        Phaser.Math.Clamp(
          (
            (x - a.x) * abx +
            (y - a.y) * aby
          ) / ab2,
          0,
          1
        );

      const px =
        a.x + abx * t;

      const py =
        a.y + aby * t;

      const d =
        Math.hypot(
          x - px,
          y - py
        );

      if (
        d <
        best.distance
      ) {
        best = {
          distance: d,
          x: px,
          y: py,
          index: i
        };
      }
    }

    return best;
  }

  rotationForPathIndex(index) {
    const a =
      this.trackPath[
        index %
        this.trackPath.length
      ];

    const b =
      this.trackPath[
        (index + 1) %
        this.trackPath.length
      ];

    return (
      Math.atan2(
        b.y - a.y,
        b.x - a.x
      ) +
      Math.PI / 2
    );
  }

  updatePlayerLap() {
    const nearest =
      this.nearestTrackPoint(
        this.car.x,
        this.car.y
      );

    const currentIndex =
      nearest.index;

    this.playerTrackIndex =
      currentIndex;

    if (
      !this.playerStarted &&
      currentIndex > 4
    ) {
      this.playerStarted = true;
    }

    const wrappedForward =
      this.playerStarted &&
      this.previousPlayerTrackIndex >
        this.trackPath.length *
        0.78 &&
      currentIndex <
        this.trackPath.length *
        0.22 &&
      this.speed > 45;

    if (wrappedForward) {
      this.completedLaps += 1;

      if (
        this.completedLaps >=
        this.totalLaps
      ) {
        this.finishPlayer();
        return;
      }
    }

    this.previousPlayerTrackIndex =
      currentIndex;
  }

  resolveCarCollisions() {
    const racers = [
      {
        sprite: this.car,
        isPlayer: true,
        ai: null
      },

      ...this.aiDrivers
        .filter(
          ai => !ai.finished
        )
        .map(ai => ({
          sprite: ai.sprite,
          isPlayer: false,
          ai
        }))
    ];

    for (
      let i = 0;
      i < racers.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < racers.length;
        j++
      ) {
        const a =
          racers[i];

        const b =
          racers[j];

        const dx =
          b.sprite.x -
          a.sprite.x;

        const dy =
          b.sprite.y -
          a.sprite.y;

        const dist =
          Math.hypot(
            dx,
            dy
          ) || 0.001;

        const minDist = 31;

        if (
          dist >= minDist
        ) {
          continue;
        }

        const nx =
          dx / dist;

        const ny =
          dy / dist;

        const push =
          (
            minDist -
            dist
          ) * 0.55;

        a.sprite.x -=
          nx * push;

        a.sprite.y -=
          ny * push;

        b.sprite.x +=
          nx * push;

        b.sprite.y +=
          ny * push;

        if (a.isPlayer) {
          this.speed *= 0.72;
        } else if (a.ai) {
          a.ai.impact = 0.28;
        }

        if (b.isPlayer) {
          this.speed *= 0.72;
        } else if (b.ai) {
          b.ai.impact = 0.28;
        }
      }
    }

    this.keepPlayerOnTrack();
  }

  finishAI(ai) {
    if (ai.finished) {
      return;
    }

    ai.finished = true;

    ai.sprite.setVisible(false);

    this.finishOrder.push({
      type: 'ai',
      name: ai.name,
      position:
        this.finishOrder.length + 1
    });

    this.status.setText(
      `${ai.name} finished ${
        this.ordinal(
          this.finishOrder.length
        )
      }!`
    );

    this.time.delayedCall(
      1200,
      () => {
        if (!this.raceOver) {
          this.status.setText('');
        }
      }
    );
  }

  finishPlayer() {
    if (this.raceOver) {
      return;
    }

    const position =
      this.finishOrder.length + 1;

    this.finishOrder.push({
      type: 'player',
      name:
        careerState.racerName ||
        'YOU',
      position
    });

    this.raceOver = true;

    this.speed = 0;

    applyRaceResult({
      finished: true,
      lapsCompleted:
        this.totalLaps,
      totalLaps:
        this.totalLaps,
      position
    });

    this.car.setVisible(true);

    this.info.setText(
      `🏁 FINISHED ${
        this.ordinal(position)
      } / 5`
    );

    this.status.setText(
      position === 1
        ? 'YOU WON THE RACE!'
        : `You finished ${
            this.ordinal(position)
          }.`
    );

    this.time.delayedCall(
      1800,
      () => {
        this.scene.start(
          'HubScene'
        );
      }
    );
  }

  ordinal(value) {
    if (value === 1) {
      return '1ST';
    }

    if (value === 2) {
      return '2ND';
    }

    if (value === 3) {
      return '3RD';
    }

    return `${value}TH`;
  }

  getPlayerPosition() {
    const existing =
      this.finishOrder.find(
        result =>
          result.type ===
          'player'
      );

    if (existing) {
      return existing.position;
    }

    const playerProgress =
      this.completedLaps *
        this.trackPath.length +
      this.playerTrackIndex;

    let ahead = 0;

    for (
      const ai of this.aiDrivers
    ) {
      const aiProgress =
        ai.completedLaps *
          this.trackPath.length +
        ai.waypointIndex;

      if (
        aiProgress >
        playerProgress
      ) {
        ahead++;
      }
    }

    return Phaser.Math.Clamp(
      ahead + 1,
      1,
      5
    );
  }

  updateHud() {
    const speedLabel =
      this.speed < -1
        ? `REV ${Math.round(
            -this.speed
          )}`
        : `SPEED ${Math.round(
            this.speed
          )}`;

    const displayLap =
      Math.min(
        this.completedLaps + 1,
        this.totalLaps
      );

    const position =
      this.getPlayerPosition();

    this.info.setText(
      `RACING LIFE  •  LAP ${
        displayLap
      }/${this.totalLaps}  •  POS ${
        position
      }/5  •  ${speedLabel}`
    );

    if (
      !this.raceOver &&
      this.finishOrder.length > 0
    ) {
      const last =
        this.finishOrder[
          this.finishOrder.length - 1
        ];

      if (
        last.type === 'ai'
      ) {
        this.status.setText(
          `${last.name} finished ${
            this.ordinal(
              last.position
            )
          }`
        );
      }
    }
  }

  resetRace() {
    this.scene.restart({
      mapId: this.mapId
    });
  }

  returnToMenu() {
    if (this.raceOver) {
      return;
    }

    this.raceOver = true;

    applyRaceResult({
      finished: false,
      lapsCompleted:
        this.completedLaps,
      totalLaps:
        this.totalLaps,
      position:
        this.getPlayerPosition()
    });

    this.scene.start(
      'RaceMenuScene'
    );
  }
}