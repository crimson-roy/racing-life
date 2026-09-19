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
    this.startedAtMs = null;
    this.completed = false;
  }

  configure(points = [], options = {}) {
    const count = this.racingLine.setPoints(points);
    this.progress.totalLaps = Math.max(
      1,
      Math.floor(options.totalLaps ?? this.progress.totalLaps)
    );
    this.progress.setCheckpoints(points);
    this.opponentWaypointIndex = count > 1 ? 1 : 0;
    this.startedAtMs = null;
    this.completed = false;
    return count;
  }

  start(nowMs = performance.now()) {
    this.progress.resetRace();
    this.opponentWaypointIndex = this.racingLine.length > 1 ? 1 : 0;
    this.startedAtMs = nowMs;
    this.completed = false;
  }

  get elapsedMs() {
    if (!Number.isFinite(this.startedAtMs)) return 0;
    return Math.max(0, performance.now() - this.startedAtMs);
  }

  getOpponentControls(car) {
    if (!car || this.completed || this.racingLine.length < 2) {
      return { throttle: 0, brake: 1, steering: 0 };
    }

    this.opponentWaypointIndex = this.racingLine.advanceIndex(
      this.opponentWaypointIndex,
      car.position
    );

    const target = this.racingLine.getPoint(this.opponentWaypointIndex);
    return getWaypointControls(car, target);
  }

  update(playerPosition, opponentPosition, elapsedMs = this.elapsedMs) {
    if (this.racingLine.length === 0) return this.getSnapshot();

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
      started: Number.isFinite(this.startedAtMs),
      completed: this.completed,
      winnerSide: this.getWinnerSide(),
      opponentWaypointIndex: this.opponentWaypointIndex,
      ...this.progress.getSnapshot()
    };
  }
}
