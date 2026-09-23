import test from 'node:test';
import assert from 'node:assert/strict';

import { MatchManager } from '../src/racing/MatchManager.js';

test('MatchManager rejects configurations that cannot produce a valid race', () => {
  assert.throws(
    () => new MatchManager({ trackOrder: [] }),
    /at least one race track/
  );
  assert.throws(
    () => new MatchManager({ trackOrder: ['barcelona', ''], winTarget: 1 }),
    /non-empty track ids/
  );
  assert.throws(
    () => new MatchManager({ trackOrder: ['barcelona'], winTarget: 0 }),
    /positive integer/
  );
  assert.throws(
    () => new MatchManager({ trackOrder: ['barcelona', 'lake_como'], winTarget: 3 }),
    /cannot exceed the available race count/
  );
});

test('MatchManager snapshots track order so external mutation cannot change a live match', () => {
  const trackOrder = ['barcelona', 'glen_canyon_dam', 'lake_como'];
  const match = new MatchManager({ trackOrder, winTarget: 2 });

  trackOrder[0] = 'tampered';
  trackOrder.push('extra');

  assert.equal(match.getCurrentRace().trackId, 'barcelona');
  match.recordResult('A', { raceNumber: 1, trackId: 'barcelona' });
  assert.equal(match.getCurrentRace().trackId, 'glen_canyon_dam');
  assert.deepEqual(match.trackOrder, ['barcelona', 'glen_canyon_dam', 'lake_como']);
});
