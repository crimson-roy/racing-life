// Lightweight, renderer-agnostic racing-line helpers for P0 AI driving.
// Track-specific authored waypoints can be supplied later without changing
// vehicle AI. For development, a saved grid can seed a deterministic loop.

function normalizePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) {
    throw new Error('RacingLine points require finite x/z values.');
  }

  return {
    x: point.x,
    y: Number.isFinite(point.y) ? point.y : 0,
    z: point.z
  };
}

export class RacingLine {
  constructor(points = [], options = {}) {
    this.reachRadius = Math.max(1, options.reachRadius ?? 7);
    this.points = [];
    this.setPoints(points);
  }

  setPoints(points = []) {
    this.points = points.map(normalizePoint);
    return this.points.length;
  }

  get length() {
    return this.points.length;
  }

  getPoint(index) {
    if (this.points.length === 0) return null;
    const wrapped = ((index % this.points.length) + this.points.length) % this.points.length;
    return this.points[wrapped];
  }

  advanceIndex(index, position) {
    if (this.points.length === 0 || !position) return 0;
    const target = this.getPoint(index);
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    return dx * dx + dz * dz <= this.reachRadius * this.reachRadius
      ? (index + 1) % this.points.length
      : index;
  }
}

export function createLoopFromGrid(spawn, options = {}) {
  if (!spawn || !Number.isFinite(spawn.x) || !Number.isFinite(spawn.z)) {
    return [];
  }

  const forward = Math.max(20, options.forward ?? 70);
  const halfWidth = Math.max(10, options.halfWidth ?? 28);
  const sin = Math.sin(spawn.yaw ?? 0);
  const cos = Math.cos(spawn.yaw ?? 0);

  const localToWorld = (right, ahead) => ({
    x: spawn.x + right * cos + ahead * sin,
    y: Number.isFinite(spawn.y) ? spawn.y : 0,
    z: spawn.z - right * sin + ahead * cos
  });

  // Temporary deterministic development loop. It is intentionally generated
  // from the saved grid rather than hard-coded Barcelona world coordinates.
  // Authored track waypoints can replace it through TrackRegistry later.
  return [
    localToWorld(0, 0),
    localToWorld(0, forward),
    localToWorld(halfWidth, forward * 1.35),
    localToWorld(halfWidth, forward * 0.25),
    localToWorld(-halfWidth, forward * 0.25),
    localToWorld(-halfWidth, forward * 1.35)
  ];
}

export function getWaypointControls(car, target, options = {}) {
  if (!car || !target) {
    return { throttle: 0, brake: 1, steering: 0 };
  }

  const dx = target.x - car.position.x;
  const dz = target.z - car.position.z;
  const desiredYaw = Math.atan2(dx, dz);
  let error = desiredYaw - car.rotation.y;
  error = Math.atan2(Math.sin(error), Math.cos(error));

  const steering = Math.max(-1, Math.min(1, error / (Math.PI * 0.32)));
  const absError = Math.abs(error);
  const cornerBrakeAngle = options.cornerBrakeAngle ?? 0.9;
  const hardTurn = absError > cornerBrakeAngle;

  return {
    throttle: hardTurn ? 0.32 : 1,
    brake: hardTurn ? 0.42 : 0,
    steering
  };
}
