import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceRuntime } from '../src/racing/RaceRuntime.js';
import { RaceSceneRuntimeBridge } from '../src/racing/RaceSceneRuntimeBridge.js';
import { TrackSetupStore } from '../src/racing/TrackSetupStore.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const point = (x, z = 0) => ({ x, y: 0, z });

function createBridge(options = {}) {
  const store = new TrackSetupStore('barcelona', new MemoryStorage());
  store.saveRacingLine([point(0), point(10), point(20)]);
  const runtime = new RaceRuntime({ trackId: 'barcelona', store, checkpointRadius: 1 });
  runtime.load();
  return { runtime, store, bridge: new RaceSceneRuntimeBridge({ runtime, ...options }) };
}

test('disposed bridge becomes inert and cannot restart or mutate setup', () => {
  const { runtime, store, bridge } = createBridge();
  const setupBefore = store.load();

  assert.equal(bridge.dispose(), true);
  assert.equal(bridge.dispose(), false);
  assert.equal(bridge.start(1000), false);
  assert.equal(bridge.beginAuthoring(point(1)), false);
  assert.equal(bridge.finishAuthoring(), 0);
  assert.equal(bridge.cancelAuthoring(), false);
  assert.equal(bridge.clearAuthoring(), false);
  assert.equal(bridge.saveGrid({ x: 4, y: 0, z: 5, yaw: 0 }), false);
  assert.deepEqual(store.load(), setupBefore);
  assert.equal(runtime.getSnapshot().started, false);
});

test('disposed bridge cannot commit a stale race completion or call completion callback', () => {
  let callbackCount = 0;
  let careerCount = 0;
  const { runtime, bridge } = createBridge({
    applyCareerResult: () => { careerCount += 1; },
    onCompletion: () => { callbackCount += 1; }
  });

  assert.equal(bridge.start(1000), true);
  assert.equal(bridge.dispose(), true);

  // Even if stale scene code attempts another update after teardown, the
  // bridge must not advance/commit the terminal race or notify old UI/state.
  runtime.controller.update(point(10), point(100, 100), 1100);
  runtime.controller.update(point(20), point(100, 100), 1200);
  runtime.controller.update(point(0), point(100, 100), 1300);
  assert.equal(runtime.getSnapshot().completed, true);

  const result = bridge.update({
    playerCar: { position: point(0) },
    opponentCar: { position: point(100, 100) },
    driveOpponent: false
  });

  assert.equal(result.completion, null);
  assert.equal(runtime.resultCommitted, false);
  assert.equal(callbackCount, 0);
  assert.equal(careerCount, 0);
});
