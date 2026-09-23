import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceController } from '../src/racing/RaceController.js';
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

function createRuntime() {
  const store = new TrackSetupStore('barcelona', new MemoryStorage());
  store.saveRacingLine([point(0), point(10), point(20)]);
  const runtime = new RaceRuntime({
    trackId: 'barcelona',
    store,
    checkpointRadius: 1
  });
  runtime.load();
  return { runtime, store };
}

test('RaceController rejects a duplicate start without erasing live progress', () => {
  const controller = new RaceController({ checkpointRadius: 1 });
  controller.configure([point(0), point(10), point(20)]);

  assert.equal(controller.start(1000), true);
  controller.update(point(10), point(100, 100), 1000);
  assert.equal(controller.getSnapshot().racers.find((racer) => racer.id === 'player').checkpointsPassed, 1);

  assert.equal(controller.start(2000), false);
  const player = controller.getSnapshot().racers.find((racer) => racer.id === 'player');
  assert.equal(player.checkpointsPassed, 1);
  assert.equal(controller.startedAtMs, 1000);
});

test('RaceSceneRuntimeBridge ignores duplicate starts without resetting live progress', () => {
  const { runtime } = createRuntime();
  const bridge = new RaceSceneRuntimeBridge({ runtime });

  assert.equal(bridge.start(1000), true);
  runtime.controller.update(point(10), point(100, 100), 1000);
  assert.equal(runtime.getSnapshot().racers.find((racer) => racer.id === 'player').checkpointsPassed, 1);

  assert.equal(bridge.start(2000), false);
  const player = runtime.getSnapshot().racers.find((racer) => racer.id === 'player');
  assert.equal(player.checkpointsPassed, 1);
  assert.equal(runtime.controller.startedAtMs, 1000);
});

test('RaceRuntime itself rejects restart and authoring mutations while race is live', () => {
  const { runtime, store } = createRuntime();

  assert.equal(runtime.start(1000), true);
  runtime.controller.update(point(10), point(100, 100), 1000);
  const before = runtime.getSnapshot();
  const storedBefore = store.load();

  assert.equal(runtime.start(2000), false);
  assert.equal(runtime.beginLineRecording(point(50)), false);
  assert.equal(runtime.sampleLine(point(60)), false);
  assert.equal(runtime.finishLineRecording(), 0);
  assert.equal(runtime.cancelLineRecording(), false);
  assert.equal(runtime.clearLine(), false);
  assert.equal(runtime.saveGrid({ x: 1, y: 0, z: 2, yaw: 0 }), false);

  const after = runtime.getSnapshot();
  assert.equal(after.racers.find((racer) => racer.id === 'player').checkpointsPassed, 1);
  assert.equal(runtime.controller.startedAtMs, 1000);
  assert.deepEqual(store.load(), storedBefore);
  assert.deepEqual(after.finishOrder, before.finishOrder);
});

test('RaceRuntime load cannot reconfigure an active race from externally changed setup', () => {
  const { runtime, store } = createRuntime();
  const committedSetup = runtime.load();

  assert.equal(runtime.start(1000), true);
  runtime.controller.update(point(10), point(100, 100), 1000);
  const before = runtime.getSnapshot();

  // Simulate another scene/tab changing the shared persistent setup. The live
  // runtime must continue using the line and grid it committed at race start.
  store.saveRacingLine([point(0), point(100), point(200), point(300)]);
  store.saveGrid({ x: 99, y: 0, z: 99, yaw: 2 });

  const reloaded = runtime.load();
  const after = runtime.getSnapshot();

  assert.deepEqual(reloaded, committedSetup);
  assert.equal(after.racingLinePointCount, 3);
  assert.equal(after.checkpointCount, before.checkpointCount);
  assert.equal(after.racers.find((racer) => racer.id === 'player').checkpointsPassed, 1);
  assert.equal(runtime.controller.startedAtMs, 1000);
});

test('RaceRuntime keeps setup immutable after a result is committed', () => {
  const { runtime, store } = createRuntime();
  const storedBefore = store.load();

  assert.equal(runtime.start(1000), true);
  runtime.controller.update(point(10), point(100, 100), 1000);
  runtime.controller.update(point(20), point(100, 100), 2000);
  runtime.controller.update(point(0), point(100, 100), 3000);
  assert.ok(runtime.commitCompletion());
  assert.equal(runtime.resultCommitted, true);

  assert.equal(runtime.start(4000), false);
  assert.equal(runtime.beginLineRecording(point(50)), false);
  assert.equal(runtime.sampleLine(point(60)), false);
  assert.equal(runtime.finishLineRecording(), 0);
  assert.equal(runtime.cancelLineRecording(), false);
  assert.equal(runtime.clearLine(), false);
  assert.equal(runtime.saveGrid({ x: 9, y: 0, z: 9, yaw: 1 }), false);
  assert.deepEqual(store.load(), storedBefore);
});

test('RaceSceneRuntimeBridge blocks grid and authoring writes after completion delivery', () => {
  const { runtime, store } = createRuntime();
  const bridge = new RaceSceneRuntimeBridge({ runtime });
  const storedBefore = store.load();

  assert.equal(bridge.start(1000), true);
  const playerCar = { position: point(10) };
  const opponentCar = { position: point(100, 100) };
  bridge.update({ playerCar, opponentCar, driveOpponent: false });
  playerCar.position = point(20);
  bridge.update({ playerCar, opponentCar, driveOpponent: false });
  playerCar.position = point(0);
  const result = bridge.update({ playerCar, opponentCar, driveOpponent: false });

  assert.ok(result.completion);
  assert.equal(bridge.completionDelivered, true);
  assert.equal(bridge.beginAuthoring(point(50)), false);
  assert.equal(bridge.finishAuthoring(), 0);
  assert.equal(bridge.cancelAuthoring(), false);
  assert.equal(bridge.clearAuthoring(), false);
  assert.equal(bridge.saveGrid({ x: 1, y: 0, z: 2, yaw: 0 }), false);
  assert.deepEqual(store.load(), storedBefore);
});
