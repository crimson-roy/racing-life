import { RaceProgress } from './RaceProgress.js';
import { RacingLine, getWaypointControls } from './RacingLine.js';

// Renderer-agnostic P0 race coordinator. RaceScene3D owns Three.js geometry,
// collision and grounding; this class owns ordered progress plus opponent input.
// Authored track waypoints can replace development points without changing AI.
export class RaceController {
  constructor(options = {}) {
    this.playerId = options.playerId ?? 'player';
    this.opponentId = options.opponentId ?? 'opponent';
    this.requiredFinishers = Math.max(1, options.requiredFinishers ?? 1);
    this.racingLine = new RacingLine([], {
      reachRadius: options.waypointRadius ?? 7
    });
    this.progress = new RaceProgress({
      totalLaps: options.totalLaps ?? 1,
      checkpointRadius: options.checkpointRadius ?? 8
    });
    this.progress.registerRacer(this.playerId);
    this.progress.registerRacer(this.opponentId);
    this.opponentWaypointIndex = 0;
    this.opponentPreviousPosition = null;
    this.startedAtMs = null;
    this.completed = false;
  }

  configure(points = [], options = {}) {
    const count = this.racingLine.setPoints(points);
    this.progress.totalLaps = Math.max(
      1,
      Math.floor(options.totalLaps ?? this.progress.totalLaps)
    );

    // Point 0 is the authored start/finish. Racers spawn close to it, so using
    // it as checkpoint zero would award progress before they have moved. Make
    // the first target point 1 and require point 0 last to complete each lap.
    const lapCheckpoints = count > 1
      ? [...points.slice(1), points[0]]
      : points;

    this.progress.setCheckpoints(lapCheckpoints);
    this.opponentWaypointIndex = count > 1 ? 1 : 0;
    this.opponentPreviousPosition = null;
    this.startedAtMs = null;
    this.completed = false;
    return count;
  }

  get ready() {
    return this.racingLine.length >= 2;
  }

  start(nowMs = performance.now()) {
    if (!this.ready) {
      return false;
    }

    this.progress.resetRace();
    this.opponentWaypointIndex = this.racingLine.length > 1 ? 1 : 0;
    this.opponentPreviousPosition = null;
    this.startedAtMs = nowMs;
    this.completed = false;
    return true;
  }

  get elapsedMs() {
    if (!Number.isFinite(this.startedAtMs)) return 0;
    return Math.max(0, performance.now() - this.startedAtMs);
  }

  getOpponentControls(car) {
    if (!car || !this.ready || !Number.isFinite(this.startedAtMs) || this.completed) {
      return { throttle: 0, brake: 1, steering: 0 };
    }

    this.opponentWaypointIndex = this.racingLine.advanceIndex(
      this.opponentWaypointIndex,
      car.position,
      this.opponentPreviousPosition
    );

    this.opponentPreviousPosition = {
      x: car.position.x,
      y: Number.isFinite(car.position.y) ? car.position.y : 0,
      z: car.position.z
    };

    const target = this.racingLine.getPoint(this.opponentWaypointIndex);
    return getWaypointControls(car, target);
  }

  // Convenience used by Three.js scenes: vehicle physics remains on the
  // vehicle itself while the race controller decides the AI inputs.
  driveOpponent(car, dt) {
    const controls = this.getOpponentControls(car);
    if (car?.drive && Number.isFinite(dt) && dt > 0) {
      car.drive(controls.throttle, controls.brake, controls.steering, dt);
    }
    return controls;
  }

  update(playerPosition, opponentPosition, elapsedMs = this.elapsedMs) {
    if (!this.ready || !Number.isFinite(this.startedAtMs)) return this.getSnapshot();

    this.progress.updateRacer(this.playerId, playerPosition, elapsedMs);
    this.progress.updateRacer(this.opponentId, opponentPosition, elapsedMs);
    this.completed = this.progress.isComplete(this.requiredFinishers);
    return this.getSnapshot();
  }

  getWinnerSide() {
    const winner = this.progress.getWinner();
    if (winner === this.playerId) return 'A';
    if (winner === this.opponentId) return 'B';
    return null;
  }

  getSnapshot() {
    return {
      ready: this.ready,
      started: Number.isFinite(this.startedAtMs),
      completed: this.completed,
      winnerSide: this.getWinnerSide(),
      opponentWaypointIndex: this.opponentWaypointIndex,
      racingLinePointCount: this.racingLine.length,
      ...this.progress.getSnapshot()
    };
  }
}
