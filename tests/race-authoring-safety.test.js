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

function point(x, z = 0) {
  return { x, y: 0, z };
}

function createBridge() {
  const store = new TrackSetupStore('barcelona', new MemoryStorage());
  store.saveRacingLine([point(0), point(10), point(20)]);
  const runtime = new RaceRuntime({ trackId: 'barcelona', store, checkpointRadius: 1 });
  const bridge = new RaceSceneRuntimeBridge({ runtime });
  bridge.load();
  return { bridge, runtime };
}

test('track authoring cannot begin or clear the route during an active race', () => {
  const { bridge, runtime } = createBridge();
  assert.equal(bridge.start(1000), true);
  runtime.controller.update(point(10), point(100, 100), 1000);

  assert.equal(bridge.beginAuthoring(point(10)), false);
  assert.equal(bridge.clearAuthoring(), false);
  assert.equal(runtime.getSnapshot().racingLinePointCount, 3);
  assert.equal(runtime.getSnapshot().racers.find((racer) => racer.id === 'player').checkpointsPassed, 1);
});

test('race cannot start while racing-line authoring is still recording', () => {
  const { bridge, runtime } = createBridge();
  assert.ok(bridge.beginAuthoring(point(0)));
  assert.equal(runtime.recordingLine, true);
  assert.equal(bridge.start(1000), false);
  assert.equal(runtime.getSnapshot().started, false);

  bridge.cancelAuthoring();
  assert.equal(runtime.recordingLine, false);
  assert.equal(bridge.start(1100), true);
});
