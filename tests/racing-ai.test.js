import test from 'node:test';
import assert from 'node:assert/strict';

import { getWaypointControls } from '../src/racing/RacingLine.js';

function makeCar(front = { x: 0, z: 1 }) {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { y: 0 },
    getFrontDirection() {
      return { ...front };
    }
  };
}

test('AI keeps steering neutral for a waypoint directly ahead', () => {
  const controls = getWaypointControls(makeCar(), { x: 0, y: 0, z: 20 });
  assert.equal(controls.steering, 0);
  assert.equal(controls.throttle, 1);
  assert.equal(controls.brake, 0);
});

test('AI steering sign matches RaceSubaru drive rotation convention', () => {
  const right = getWaypointControls(makeCar(), { x: 20, y: 0, z: 0 });
  const left = getWaypointControls(makeCar(), { x: -20, y: 0, z: 0 });

  // RaceSubaru.drive performs rotation.y -= steering * turnRate * dt.
  assert.ok(right.steering < 0, 'right-side waypoint must increase Subaru yaw');
  assert.ok(left.steering > 0, 'left-side waypoint must decrease Subaru yaw');
  assert.ok(right.brake > 0);
  assert.ok(left.brake > 0);
});

test('AI uses the Subaru reported front direction rather than raw group yaw', () => {
  const car = makeCar({ x: 1, z: 0 });
  car.rotation.y = 0;

  const controls = getWaypointControls(car, { x: 20, y: 0, z: 0 });
  assert.ok(Math.abs(controls.steering) < 1e-9);
  assert.equal(controls.throttle, 1);
});
