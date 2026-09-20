// Incremental adapter between RaceScene3D and RaceRuntime. Keeping this small
// lets the large Three.js scene adopt P0 race state without moving collision,
// camera or Barcelona setup code into the racing domain modules.
export class RaceSceneRuntimeBridge {
  constructor(options = {}) {
    if (!options.runtime) throw new Error('RaceSceneRuntimeBridge requires runtime.');

    this.runtime = options.runtime;
    this.matchManager = options.matchManager ?? null;
    this.applyCareerResult = options.applyCareerResult ?? null;
    this.onCompletion = options.onCompletion ?? null;
    this.started = false;
    this.completionDelivered = false;
  }

  load() {
    return this.runtime.load();
  }

  start(nowMs = performance.now()) {
    this.started = this.runtime.start(nowMs);
    this.completionDelivered = false;
    return this.started;
  }

  update(options = {}) {
    const { playerCar, opponentCar, dt = 0, driveOpponent = true } = options;

    if (this.runtime.recordingLine && playerCar?.position) {
      this.runtime.sampleLine(playerCar.position);
    }

    if (driveOpponent && this.started && opponentCar) {
      this.runtime.driveOpponent(opponentCar, dt);
    }

    const snapshot = this.runtime.update(playerCar, opponentCar);
    if (!snapshot.completed) return { snapshot, completion: null };

    const completion = this.runtime.commitCompletion({
      matchManager: this.matchManager,
      applyCareerResult: this.applyCareerResult,
      details: options.details
    });

    if (completion && !this.completionDelivered) {
      this.completionDelivered = true;
      this.onCompletion?.(completion);
    }

    return { snapshot, completion };
  }

  beginAuthoring(position) {
    return this.runtime.beginLineRecording(position);
  }

  finishAuthoring() {
    return this.runtime.finishLineRecording();
  }

  cancelAuthoring() {
    this.runtime.cancelLineRecording();
  }

  clearAuthoring() {
    this.runtime.clearLine();
  }

  saveGrid(spawn) {
    return this.runtime.saveGrid(spawn);
  }

  getHudState() {
    return this.runtime.getHudState();
  }
}
