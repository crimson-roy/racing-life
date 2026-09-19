// Race-local progress tracking for ordered checkpoints, laps and finish order.
// Geometry/rendering stays in RaceScene3D; this module is intentionally pure
// state so the same rules can later be reused by local AI and authoritative
// multiplayer race controllers.

function normalizePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) {
    throw new Error('RaceProgress checkpoint points require finite x/z values.');
  }

  return {
    x: point.x,
    y: Number.isFinite(point.y) ? point.y : 0,
    z: point.z
  };
}

function distanceSqXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export class RaceProgress {
  constructor(options = {}) {
    this.totalLaps = Math.max(1, Math.floor(options.totalLaps ?? 1));
    this.checkpointRadius = Math.max(0.5, options.checkpointRadius ?? 8);
    this.checkpoints = [];
    this.racers = new Map();
    this.finishOrder = [];
  }

  setCheckpoints(points = []) {
    this.checkpoints = points.map(normalizePoint);
    this.resetRace();
    return this.checkpoints.length;
  }

  registerRacer(id) {
    if (!id) {
      throw new Error('RaceProgress racer id is required.');
    }

    if (!this.racers.has(id)) {
      this.racers.set(id, this.createRacerState(id));
    }

    return this.getRacerState(id);
  }

  createRacerState(id) {
    return {
      id,
      lap: 1,
      completedLaps: 0,
      nextCheckpoint: 0,
      checkpointsPassed: 0,
      finished: false,
      finishPosition: null,
      finishTimeMs: null
    };
  }

  resetRacer(id) {
    if (!this.racers.has(id)) return null;
    this.racers.set(id, this.createRacerState(id));
    return this.getRacerState(id);
  }

  resetRace() {
    this.finishOrder = [];

    for (const id of this.racers.keys()) {
      this.racers.set(id, this.createRacerState(id));
    }
  }

  updateRacer(id, position, elapsedMs = null) {
    const state = this.racers.get(id);

    if (!state) {
      throw new Error(`RaceProgress racer "${id}" is not registered.`);
    }

    if (state.finished || this.checkpoints.length === 0 || !position) {
      return this.getRacerState(id);
    }

    const checkpoint = this.checkpoints[state.nextCheckpoint];
    const radiusSq = this.checkpointRadius * this.checkpointRadius;

    if (distanceSqXZ(position, checkpoint) > radiusSq) {
      return this.getRacerState(id);
    }

    state.checkpointsPassed += 1;
    state.nextCheckpoint += 1;

    if (state.nextCheckpoint >= this.checkpoints.length) {
      state.completedLaps += 1;

      if (state.completedLaps >= this.totalLaps) {
        state.finished = true;
        state.lap = this.totalLaps;
        state.nextCheckpoint = 0;
        state.finishPosition = this.finishOrder.length + 1;
        state.finishTimeMs = Number.isFinite(elapsedMs) ? elapsedMs : null;
        this.finishOrder.push(id);
      } else {
        state.lap = state.completedLaps + 1;
        state.nextCheckpoint = 0;
      }
    }

    return this.getRacerState(id);
  }

  getRacerState(id) {
    const state = this.racers.get(id);
    return state ? { ...state } : null;
  }

  getLeaderBoard() {
    return [...this.racers.values()]
      .map((state) => ({ ...state }))
      .sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished && b.finished) {
          return a.finishPosition - b.finishPosition;
        }
        return b.checkpointsPassed - a.checkpointsPassed;
      });
  }

  getWinner() {
    return this.finishOrder[0] ?? null;
  }

  isComplete(requiredFinishers = 1) {
    return this.finishOrder.length >= Math.max(1, requiredFinishers);
  }

  getSnapshot() {
    return {
      totalLaps: this.totalLaps,
      checkpointRadius: this.checkpointRadius,
      checkpointCount: this.checkpoints.length,
      finishOrder: [...this.finishOrder],
      racers: this.getLeaderBoard()
    };
  }
}
