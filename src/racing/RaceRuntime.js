import { RaceController } from './RaceController.js';
import { TrackSetupStore } from './TrackSetupStore.js';
import { TrackAuthoringSession } from './TrackAuthoringSession.js';

// Thin scene-facing P0 bridge. It keeps persistence, authoring and race state
// out of RaceScene3D so the Three.js scene only needs to provide car positions
// and apply the returned AI controls.
export class RaceRuntime {
  constructor(options = {}) {
    if (!options.trackId) throw new Error('RaceRuntime requires trackId.');

    this.trackId = options.trackId;
    this.store = options.store ?? new TrackSetupStore(this.trackId);
    this.controller = options.controller ?? new RaceController({
      totalLaps: options.totalLaps ?? 1,
      requiredFinishers: options.requiredFinishers ?? 1,
      waypointRadius: options.waypointRadius,
      checkpointRadius: options.checkpointRadius
    });
    this.authoring = options.authoring ?? new TrackAuthoringSession({
      minSpacing: options.authoringSpacing ?? 8
    });
    this.resultCommitted = false;
  }

  load() {
    const setup = this.store.load();
    if (setup.racingLine.length >= 2) {
      this.controller.configure(setup.racingLine);
    }
    return {
      grid: setup.grid,
      racingLinePointCount: setup.racingLine.length,
      ready: this.controller.ready
    };
  }

  saveGrid(spawn) {
    return this.store.saveGrid(spawn);
  }

  beginLineRecording(position = null) {
    return this.authoring.start(position);
  }

  sampleLine(position) {
    return this.authoring.sample(position);
  }

  finishLineRecording() {
    const points = this.authoring.stop();
    if (points.length < 2) return 0;
    this.authoring.saveTo(this.store);
    this.controller.configure(points);
    return points.length;
  }

  clearLine() {
    this.authoring.clear();
    this.store.clearRacingLine();
    this.controller.configure([]);
    this.resultCommitted = false;
  }

  start(nowMs = performance.now()) {
    this.resultCommitted = false;
    return this.controller.start(nowMs);
  }

  driveOpponent(car, dt) {
    return this.controller.driveOpponent(car, dt);
  }

  update(playerCar, opponentCar) {
    if (!playerCar?.position || !opponentCar?.position) {
      return this.controller.getSnapshot();
    }
    return this.controller.update(playerCar.position, opponentCar.position);
  }

  markResultCommitted() {
    if (this.resultCommitted) return false;
    this.resultCommitted = true;
    return true;
  }

  getSnapshot() {
    return this.controller.getSnapshot();
  }
}
