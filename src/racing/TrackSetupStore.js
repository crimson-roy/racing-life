const VERSION = 1;

function storageKey(trackId) {
  return `racingLifeTrackSetup:v${VERSION}:${trackId}`;
}

function legacyGridKey(trackId) {
  return `racingLifeGrid:v2:${trackId}`;
}

function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.z);
}

function normalizePoint(point) {
  if (!finitePoint(point)) return null;
  return {
    x: point.x,
    y: Number.isFinite(point.y) ? point.y : 0,
    z: point.z
  };
}

function normalizeSpawn(spawn) {
  const point = normalizePoint(spawn);
  if (!point) return null;
  return {
    ...point,
    yaw: Number.isFinite(spawn.yaw) ? spawn.yaw : 0
  };
}

// Browser-local authoring data for downloaded tracks. This deliberately keeps
// guessed Barcelona coordinates out of source control: the user can place a
// real grid/racing line against the imported GLB, then RaceScene3D can consume
// the exact saved points. A later editor/export step can promote approved data
// into TrackRegistry once the coordinates are verified.
export class TrackSetupStore {
  constructor(trackId, storage = globalThis.localStorage) {
    if (!trackId) throw new Error('TrackSetupStore requires a trackId.');
    this.trackId = trackId;
    this.storage = storage;
  }

  load() {
    try {
      const raw = this.storage?.getItem(storageKey(this.trackId));
      if (!raw) return this.loadLegacyOrEmpty();
      const parsed = JSON.parse(raw);
      return {
        version: VERSION,
        grid: normalizeSpawn(parsed.grid),
        racingLine: Array.isArray(parsed.racingLine)
          ? parsed.racingLine.map(normalizePoint).filter(Boolean)
          : []
      };
    } catch {
      return this.loadLegacyOrEmpty();
    }
  }

  loadLegacyOrEmpty() {
    try {
      const legacyRaw = this.storage?.getItem(legacyGridKey(this.trackId));
      const legacyGrid = legacyRaw ? normalizeSpawn(JSON.parse(legacyRaw)) : null;
      if (!legacyGrid) return this.empty();

      const setup = {
        version: VERSION,
        grid: legacyGrid,
        racingLine: []
      };

      // Preserve the old key for rollback, but immediately write the unified
      // setup so future reads use one source of truth.
      this.save(setup);
      return setup;
    } catch {
      return this.empty();
    }
  }

  empty() {
    return { version: VERSION, grid: null, racingLine: [] };
  }

  saveGrid(spawn) {
    const grid = normalizeSpawn(spawn);
    if (!grid) throw new Error('Track grid requires finite x/z values.');
    const setup = this.load();
    setup.grid = grid;
    this.save(setup);
    return grid;
  }

  saveRacingLine(points) {
    const racingLine = Array.isArray(points)
      ? points.map(normalizePoint).filter(Boolean)
      : [];
    if (racingLine.length < 2) {
      throw new Error('Racing line requires at least two valid points.');
    }
    const setup = this.load();
    setup.racingLine = racingLine;
    this.save(setup);
    return racingLine.length;
  }

  appendWaypoint(point) {
    const normalized = normalizePoint(point);
    if (!normalized) throw new Error('Waypoint requires finite x/z values.');
    const setup = this.load();
    setup.racingLine.push(normalized);
    this.save(setup);
    return setup.racingLine.length;
  }

  clearRacingLine() {
    const setup = this.load();
    setup.racingLine = [];
    this.save(setup);
  }

  save(setup) {
    this.storage?.setItem(storageKey(this.trackId), JSON.stringify(setup));
  }
}
