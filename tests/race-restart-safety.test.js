import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceRuntime } from '../src/racing/RaceRuntime.js';
import { RaceSceneRuntimeBridge } from '../src/racing/RaceSceneRuntimeBridge.js';
import { TrackSetupStore } from '../src/racing/TrackSetupStore.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function point(x, z = 0) {
  return { x, y: 0, z };
}

test('RaceSceneRuntimeBridge ignores duplicate starts without resetting live progress', () => {
  const store = new TrackSetupStore('barcelona', new MemoryStorage());
  store.saveRacingLine([point(0), point(10), point(20)]);

  const runtime = new RaceRuntime({
    trackId: 'barcelona',
    store,
    checkpointRadius: 1
  });
  const bridge = new RaceSceneRuntimeBridge({ runtime });
  bridge.load();

  assert.equal(bridge.start(1000), true);
  runtime.controller.update(point(10), point(100, 100), 1000);
  assert.equal(runtime.getSnapshot().racers.find((racer) => racer.id === 'player').checkpointsPassed, 1);

  assert.equal(bridge.start(2000), false);
  const player = runtime.getSnapshot().racers.find((racer) => racer.id === 'player');
  assert.equal(player.checkpointsPassed, 1);
  assert.equal(runtime.controller.startedAtMs, 1000);
});
