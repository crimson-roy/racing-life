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

function pointDistanceSquared(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function segmentDistanceSquared(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 1e-9) return pointDistanceSquared(point, start);

  const t = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared
  ));
  const closest = {
    x: start.x + dx * t,
    z: start.z + dz * t
  };
  return pointDistanceSquared(point, closest);
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

  advanceIndex(index, position, previousPosition = null) {
    if (this.points.length === 0 || !position) return 0;

    let nextIndex = ((index % this.points.length) + this.points.length) % this.points.length;
    const radiusSquared = this.reachRadius * this.reachRadius;
    const maxAdvances = this.points.length;

    // A fast vehicle can cross more than one authored waypoint in one physics
    // frame. Check both the current position and the travelled segment, and
    // keep advancing in authored order while waypoints were genuinely crossed.
    // This prevents the AI from turning back toward a waypoint it skipped at
    // speed without allowing it to jump arbitrarily around the lap.
    for (let advances = 0; advances < maxAdvances; advances += 1) {
      const target = this.getPoint(nextIndex);
      const reachedAtEnd = pointDistanceSquared(target, position) <= radiusSquared;
      const crossedThisFrame = previousPosition
        ? segmentDistanceSquared(target, previousPosition, position) <= radiusSquared
        : false;

      if (!reachedAtEnd && !crossedThisFrame) break;
      nextIndex = (nextIndex + 1) % this.points.length;
    }

    return nextIndex;
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

function getCarHeading(car) {
  if (typeof car?.getFrontDirection === 'function') {
    const front = car.getFrontDirection();
    if (front && Number.isFinite(front.x) && Number.isFinite(front.z)) {
      return Math.atan2(front.x, front.z);
    }
  }

  return Number.isFinite(car?.rotation?.y) ? car.rotation.y : 0;
}

export function getWaypointControls(car, target, options = {}) {
  if (!car || !target) {
    return { throttle: 0, brake: 1, steering: 0 };
  }

  const dx = target.x - car.position.x;
  const dz = target.z - car.position.z;
  const desiredYaw = Math.atan2(dx, dz);
  const currentYaw = getCarHeading(car);
  let error = desiredYaw - currentYaw;
  error = Math.atan2(Math.sin(error), Math.cos(error));

  // RaceSubaru.drive subtracts positive steering from rotation.y, so steering
  // has the opposite sign from the usual mathematical yaw error. Deriving the
  // current heading from getFrontDirection also respects the imported Subaru's
  // normalized visual/front orientation instead of assuming local +Z.
  const rawSteering = Math.max(
    -1,
    Math.min(1, -error / (Math.PI * 0.32))
  );
  // JavaScript preserves signed zero. Normalize it because neutral steering is
  // an input value, not a direction, and strict diagnostics should see 0.
  const steering = Object.is(rawSteering, -0) ? 0 : rawSteering;
  const absError = Math.abs(error);
  const cornerBrakeAngle = options.cornerBrakeAngle ?? 0.9;
  const hardTurn = absError > cornerBrakeAngle;

  return {
    throttle: hardTurn ? 0.32 : 1,
    brake: hardTurn ? 0.42 : 0,
    steering
  };
}
