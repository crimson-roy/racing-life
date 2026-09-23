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

// Return where along a movement segment the racer comes closest to a checkpoint.
// Keeping the projection parameter lets one physics sample legitimately cross
// several ordered checkpoints without accepting them in reverse travel order.
function checkpointHitOnSegmentXZ(point, start, end, radiusSq, minT = 0) {
  const segmentX = end.x - start.x;
  const segmentZ = end.z - start.z;
  const lengthSq = segmentX * segmentX + segmentZ * segmentZ;

  if (lengthSq <= Number.EPSILON) {
    return distanceSqXZ(point, end) <= radiusSq ? 1 : null;
  }

  const offsetX = point.x - start.x;
  const offsetZ = point.z - start.z;
  const projectionT = (
    offsetX * segmentX + offsetZ * segmentZ
  ) / lengthSq;
  const t = Math.max(minT, Math.min(1, projectionT));

  if (t > 1) return null;

  const closest = {
    x: start.x + segmentX * t,
    z: start.z + segmentZ * t
  };

  return distanceSqXZ(point, closest) <= radiusSq ? t : null;
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
      finishTimeMs: null,
      previousPosition: null
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

    const currentPosition = normalizePoint(position);
    const previousPosition = state.previousPosition;
    const radiusSq = this.checkpointRadius * this.checkpointRadius;

    // Always remember the latest accepted scene position, even when no
    // checkpoint was reached. RaceScene3D only calls this after collision
    // rollback, so rejected wall/sidewalk movement never enters this segment.
    state.previousPosition = currentPosition;

    // The first accepted sample has no movement segment. It may still be inside
    // its next checkpoint, but it cannot sweep through any later checkpoints.
    if (!previousPosition) {
      const checkpoint = this.checkpoints[state.nextCheckpoint];
      if (distanceSqXZ(currentPosition, checkpoint) <= radiusSq) {
        this.advanceCheckpoint(state, elapsedMs);
      }
      return this.getRacerState(id);
    }

    // A stationary sample is not a sweep. Award at most the current checkpoint
    // just like the initial sample. This prevents overlapping/coincident
    // checkpoints from being consumed all at once while a racer is motionless.
    if (distanceSqXZ(previousPosition, currentPosition) <= Number.EPSILON) {
      const checkpoint = this.checkpoints[state.nextCheckpoint];
      if (distanceSqXZ(currentPosition, checkpoint) <= radiusSq) {
        this.advanceCheckpoint(state, elapsedMs);
      }
      return this.getRacerState(id);
    }

    // A fast car can cross more than one checkpoint between physics samples.
    // Consume every checkpoint hit by the segment in authored order, while
    // requiring monotonically increasing segment time so reverse-order geometry
    // cannot award impossible progress. The bound prevents looping forever on
    // overlapping checkpoints or a multi-lap line whose start/finish coincides.
    let segmentT = 0;
    const maxAdvances = this.checkpoints.length;

    for (let advances = 0; advances < maxAdvances && !state.finished; advances += 1) {
      const checkpoint = this.checkpoints[state.nextCheckpoint];
      const hitT = checkpointHitOnSegmentXZ(
        checkpoint,
        previousPosition,
        currentPosition,
        radiusSq,
        segmentT
      );

      if (hitT === null) break;

      segmentT = Math.min(1, hitT + Number.EPSILON);
      this.advanceCheckpoint(state, elapsedMs);
    }

    return this.getRacerState(id);
  }

  advanceCheckpoint(state, elapsedMs = null) {
    state.checkpointsPassed += 1;
    state.nextCheckpoint += 1;

    if (state.nextCheckpoint < this.checkpoints.length) return;

    state.completedLaps += 1;

    if (state.completedLaps >= this.totalLaps) {
      state.finished = true;
      state.lap = this.totalLaps;
      state.nextCheckpoint = 0;
      state.finishPosition = this.finishOrder.length + 1;
      state.finishTimeMs = Number.isFinite(elapsedMs) ? elapsedMs : null;
      this.finishOrder.push(state.id);
      return;
    }

    state.lap = state.completedLaps + 1;
    state.nextCheckpoint = 0;
  }

  getRacerState(id) {
    const state = this.racers.get(id);
    if (!state) return null;
    return {
      ...state,
      previousPosition: state.previousPosition
        ? { ...state.previousPosition }
        : null
    };
  }

  getDistanceToNextCheckpointSq(state) {
    if (
      state.finished ||
      !state.previousPosition ||
      this.checkpoints.length === 0
    ) {
      return state.finished ? 0 : Number.POSITIVE_INFINITY;
    }

    const checkpoint = this.checkpoints[state.nextCheckpoint];
    return checkpoint
      ? distanceSqXZ(state.previousPosition, checkpoint)
      : Number.POSITIVE_INFINITY;
  }

  getLeaderBoard() {
    return [...this.racers.values()]
      .map((state) => ({
        ...state,
        previousPosition: state.previousPosition
          ? { ...state.previousPosition }
          : null
      }))
      .sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished && b.finished) {
          return a.finishPosition - b.finishPosition;
        }

        // Ordered checkpoint count is authoritative. When two racers have
        // passed the same number, rank the one closer to the same next target
        // ahead so the live HUD/result classification is deterministic and
        // useful instead of falling back to registration order.
        const checkpointDelta = b.checkpointsPassed - a.checkpointsPassed;
        if (checkpointDelta !== 0) return checkpointDelta;

        return (
          this.getDistanceToNextCheckpointSq(a) -
          this.getDistanceToNextCheckpointSq(b)
        );
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
