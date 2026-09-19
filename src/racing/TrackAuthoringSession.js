function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.z);
}

function copyPoint(point) {
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

// Development-only helper for authoring a real racing line by driving the
// imported track. It is deliberately renderer-agnostic: RaceScene3D can feed
// player positions into sample(), then persist the result through
// TrackSetupStore. This avoids guessing Barcelona coordinates in source code.
export class TrackAuthoringSession {
  constructor(options = {}) {
    this.minSpacing = Math.max(1, options.minSpacing ?? 8);
    this.maxPoints = Math.max(16, Math.floor(options.maxPoints ?? 4096));
    this.recording = false;
    this.points = [];
  }

  start(seedPoint = null) {
    this.points = [];
    this.recording = true;
    if (finitePoint(seedPoint)) this.points.push(copyPoint(seedPoint));
    return this.points.length;
  }

  sample(position) {
    if (!this.recording || !finitePoint(position) || this.points.length >= this.maxPoints) {
      return false;
    }

    const point = copyPoint(position);
    const previous = this.points[this.points.length - 1];
    if (previous && distanceSqXZ(previous, point) < this.minSpacing * this.minSpacing) {
      return false;
    }

    this.points.push(point);
    return true;
  }

  stop() {
    this.recording = false;
    return this.getPoints();
  }

  clear() {
    this.recording = false;
    this.points = [];
  }

  getPoints() {
    return this.points.map(copyPoint);
  }

  // Remove accidental near-duplicate samples without smoothing away authored
  // corners. The first point remains the start/finish anchor.
  compact(minSpacing = this.minSpacing) {
    if (this.points.length < 2) return this.getPoints();

    const spacing = Math.max(1, minSpacing);
    const spacingSq = spacing * spacing;
    const compacted = [this.points[0]];

    for (let i = 1; i < this.points.length; i += 1) {
      const point = this.points[i];
      if (distanceSqXZ(compacted[compacted.length - 1], point) >= spacingSq) {
        compacted.push(point);
      }
    }

    this.points = compacted.map(copyPoint);
    return this.getPoints();
  }

  saveTo(store) {
    if (!store?.saveRacingLine) {
      throw new Error('TrackAuthoringSession.saveTo requires a TrackSetupStore.');
    }

    const points = this.compact();
    if (points.length < 2) {
      throw new Error('Record at least two racing-line points before saving.');
    }

    return store.saveRacingLine(points);
  }
}
