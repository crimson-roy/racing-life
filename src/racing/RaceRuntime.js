import { RaceController } from './RaceController.js';
import { TrackSetupStore } from './TrackSetupStore.js';
import { TrackAuthoringSession } from './TrackAuthoringSession.js';
import { commitRaceToMatch, createCareerRaceResult } from './RaceSession.js';

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
    this.completion = null;
    this.loadedSetup = null;
  }

  get raceActive() {
    const snapshot = this.controller.getSnapshot();
    return snapshot.started && !snapshot.completed;
  }

  // A committed runtime represents a terminal race session. Setup mutations
  // must wait for a fresh runtime/scene so a stale caller cannot silently alter
  // the grid or authoring state that produced the recorded result.
  get setupLocked() {
    return this.raceActive || this.resultCommitted;
  }

  load() {
    // Once the green light has gone out (or the result has been committed), the
    // setup used by this runtime is immutable. TrackSetupStore can be shared by
    // another scene/tab, so re-reading it here during a live race must not
    // reconfigure checkpoints/AI underneath cars that are already progressing.
    // Return the setup snapshot this race actually started with instead.
    if (this.setupLocked && this.loadedSetup) {
      return {
        grid: this.loadedSetup.grid,
        racingLinePointCount: this.loadedSetup.racingLine.length,
        ready: this.controller.ready
      };
    }

    const setup = this.store.load();
    this.loadedSetup = setup;
    if (setup.racingLine.length >= 2) {
      this.controller.configure(setup.racingLine);
    } else {
      this.controller.configure([]);
    }
    return {
      grid: setup.grid,
      racingLinePointCount: setup.racingLine.length,
      ready: this.controller.ready
    };
  }

  saveGrid(spawn) {
    if (this.setupLocked) return false;
    const grid = this.store.saveGrid(spawn);
    this.loadedSetup = this.store.load();
    return grid;
  }

  beginLineRecording(position = null) {
    if (this.setupLocked) return false;
    return this.authoring.start(position);
  }

  sampleLine(position) {
    if (this.setupLocked) return false;
    return this.authoring.sample(position);
  }

  finishLineRecording() {
    if (this.setupLocked) return 0;
    const points = this.authoring.stop();
    if (points.length < 2) return 0;
    this.authoring.saveTo(this.store);
    this.controller.configure(points);
    this.loadedSetup = this.store.load();
    this.resultCommitted = false;
    this.completion = null;
    return points.length;
  }

  cancelLineRecording() {
    if (this.setupLocked) return false;
    this.authoring.clear();
    return true;
  }

  clearLine() {
    if (this.setupLocked) return false;
    this.authoring.clear();
    this.store.clearRacingLine();
    this.controller.configure([]);
    this.loadedSetup = this.store.load();
    this.resultCommitted = false;
    this.completion = null;
    return true;
  }

  get recordingLine() {
    return this.authoring.recording;
  }

  get authoredPointCount() {
    return this.authoring.points.length;
  }

  start(nowMs = performance.now()) {
    if (this.setupLocked || this.recordingLine) return false;
    this.resultCommitted = false;
    this.completion = null;
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

  getHudState() {
    const snapshot = this.controller.getSnapshot();
    const player = snapshot.racers.find((racer) => racer.id === this.controller.playerId) ?? null;
    const opponent = snapshot.racers.find((racer) => racer.id === this.controller.opponentId) ?? null;

    return {
      ready: snapshot.ready,
      started: snapshot.started,
      completed: snapshot.completed,
      winnerSide: snapshot.winnerSide,
      finishOrder: [...snapshot.finishOrder],
      classification: snapshot.racers.map((racer) => racer.id),
      totalLaps: snapshot.totalLaps,
      checkpointCount: snapshot.checkpointCount,
      racingLinePointCount: snapshot.racingLinePointCount,
      recordingLine: this.recordingLine,
      authoredPointCount: this.authoredPointCount,
      player,
      opponent
    };
  }

  // Scene-facing completion bridge. It is deliberately idempotent because a
  // render loop can observe the completed race for many frames. The first call
  // commits the 1v1 result; later calls return the same completion payload.
  // Career mutation remains injected so RaceRuntime does not own reward rules.
  commitCompletion(options = {}) {
    const snapshot = this.controller.getSnapshot();
    if (!snapshot.completed || !snapshot.winnerSide) return null;
    if (this.resultCommitted) return this.completion;

    const sessionDetails = {
      trackId: this.trackId,
      ...(options.details ?? {})
    };

    const matchSummary = options.matchManager
      ? commitRaceToMatch(
          options.matchManager,
          this.controller,
          sessionDetails
        )
      : null;

    const careerResult = createCareerRaceResult(
      this.controller,
      sessionDetails
    );
    if (typeof options.applyCareerResult === 'function') {
      options.applyCareerResult(careerResult);
    }

    const racers = snapshot.racers.map((racer, index) => ({
      id: racer.id,
      classificationPosition: index + 1,
      finished: racer.finished,
      finishPosition: racer.finishPosition,
      finishTimeMs: racer.finishTimeMs,
      completedLaps: racer.completedLaps,
      checkpointsPassed: racer.checkpointsPassed
    }));

    this.resultCommitted = true;
    this.completion = {
      trackId: this.trackId,
      raceNumber: Number.isInteger(sessionDetails.raceNumber)
        ? sessionDetails.raceNumber
        : null,
      winnerSide: snapshot.winnerSide,
      // finishOrder contains only cars that crossed the finish before the race
      // locked. classification is the complete ordered 1v1 result.
      finishOrder: [...snapshot.finishOrder],
      classification: racers.map((racer) => racer.id),
      racers,
      careerResult,
      matchSummary
    };

    return this.completion;
  }

  getSnapshot() {
    return this.controller.getSnapshot();
  }
}
