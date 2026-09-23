import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceRuntime } from '../src/racing/RaceRuntime.js';
import { MatchManager } from '../src/racing/MatchManager.js';
import { TrackSetupStore } from '../src/racing/TrackSetupStore.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const point = (x, z) => ({ x, y: 0, z });
const carAt = (x, z) => ({ position: point(x, z), rotation: { y: 0 }, drive() {} });

function completedRuntime() {
  const store = new TrackSetupStore('barcelona', new MemoryStorage());
  store.saveRacingLine([point(0, 0), point(10, 0)]);
  const runtime = new RaceRuntime({ trackId: 'barcelona', store, checkpointRadius: 1 });
  runtime.load();
  runtime.start(1000);
  const player = carAt(10, 0);
  const opponent = carAt(7, 0);
  runtime.update(player, opponent);
  player.position = point(0, 0);
  runtime.update(player, opponent);
  return runtime;
}

test('throwing career persistence cannot duplicate match scoring on retry', () => {
  const runtime = completedRuntime();
  const match = new MatchManager({ trackOrder: ['barcelona', 'glen_canyon_dam'], winTarget: 2 });

  assert.throws(() => runtime.commitCompletion({
    matchManager: match,
    details: { raceNumber: 1 },
    applyCareerResult() { throw new Error('storage unavailable'); }
  }), /storage unavailable/);

  assert.equal(match.getSummary().results.length, 1);
  const retry = runtime.commitCompletion({ matchManager: match, details: { raceNumber: 1 } });
  assert.equal(match.getSummary().results.length, 1);
  assert.equal(retry.raceNumber, 1);
  assert.equal(retry.winnerSide, 'A');
});

test('re-entrant career persistence observes the sealed completion without rescoring', () => {
  const runtime = completedRuntime();
  const match = new MatchManager({ trackOrder: ['barcelona', 'glen_canyon_dam'], winTarget: 2 });
  let nested = null;

  const completion = runtime.commitCompletion({
    matchManager: match,
    details: { raceNumber: 1 },
    applyCareerResult() {
      nested = runtime.commitCompletion({ matchManager: match, details: { raceNumber: 1 } });
    }
  });

  assert.strictEqual(nested, completion);
  assert.equal(match.getSummary().results.length, 1);
});
