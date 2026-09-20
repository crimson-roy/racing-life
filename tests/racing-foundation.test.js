import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceProgress } from '../src/racing/RaceProgress.js';
import { RaceController } from '../src/racing/RaceController.js';
import { RaceRuntime } from '../src/racing/RaceRuntime.js';
import { RaceSceneRuntimeBridge } from '../src/racing/RaceSceneRuntimeBridge.js';
import { MatchManager, getActiveMatchManager } from '../src/racing/MatchManager.js';
import { commitRaceToMatch, createCareerRaceResult } from '../src/racing/RaceSession.js';
import { TrackSetupStore } from '../src/racing/TrackSetupStore.js';
import { getTrack, isTrackAvailable } from '../src/racing/TrackRegistry.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function point(x, z, y = 0) {
  return { x, y, z };
}

function carAt(x, z) {
  return {
    position: point(x, z),
    rotation: { y: 0 },
    driveCalls: 0,
    drive() { this.driveCalls += 1; }
  };
}

test('RaceProgress requires ordered checkpoints before finishing a lap', () => {
  const race = new RaceProgress({ totalLaps: 1, checkpointRadius: 2 });
  race.registerRacer('player');
  race.setCheckpoints([point(10, 0), point(20, 0), point(0, 0)]);
  race.updateRacer('player', point(20, 0), 1000);
  assert.equal(race.getRacerState('player').checkpointsPassed, 0);
  race.updateRacer('player', point(10, 0), 2000);
  race.updateRacer('player', point(20, 0), 3000);
  race.updateRacer('player', point(0, 0), 4000);
  const state = race.getRacerState('player');
  assert.equal(state.finished, true);
  assert.equal(state.finishPosition, 1);
  assert.equal(state.finishTimeMs, 4000);
});

test('RaceProgress counts an ordered checkpoint crossed between physics samples', () => {
  const race = new RaceProgress({ totalLaps: 1, checkpointRadius: 1 });
  race.registerRacer('player');
  race.setCheckpoints([point(10, 0), point(20, 0)]);
  race.updateRacer('player', point(7, 0), 1000);
  race.updateRacer('player', point(13, 0), 1100);
  const state = race.getRacerState('player');
  assert.equal(state.checkpointsPassed, 1);
  assert.equal(state.nextCheckpoint, 1);
  assert.deepEqual(state.previousPosition, point(13, 0));
});

test('RaceController treats authored point zero as finish rather than instant grid progress', () => {
  const controller = new RaceController({ totalLaps: 1, checkpointRadius: 1 });
  controller.configure([point(0, 0), point(10, 0), point(20, 0)]);
  assert.equal(controller.start(1000), true);
  controller.update(point(0, 0), point(0, 0), 0);
  assert.equal(controller.getSnapshot().racers[0].checkpointsPassed, 0);
  controller.update(point(10, 0), point(0, 0), 1000);
  controller.update(point(20, 0), point(0, 0), 2000);
  const snapshot = controller.update(point(0, 0), point(0, 0), 3000);
  assert.equal(snapshot.completed, true);
  assert.equal(snapshot.winnerSide, 'A');
  assert.deepEqual(snapshot.finishOrder, ['player']);
});

test('MatchManager ends confirmed faction format when one side reaches three wins', () => {
  const match = new MatchManager({ factionA: 'azure', factionB: 'crimson', winTarget: 3, trackOrder: ['one', 'two', 'three', 'four', 'five'] });
  match.recordResult('A');
  match.recordResult('B');
  match.recordResult('A');
  const summary = match.recordResult('A');
  assert.equal(summary.completed, true);
  assert.equal(summary.winner, 'A');
  assert.equal(summary.scoreA, 3);
  assert.equal(summary.scoreB, 1);
  assert.equal(summary.results.length, 4);
});

test('latest MatchManager is available to incrementally integrated 3D race scenes', () => {
  const match = new MatchManager({ factionA: 'azure', factionB: 'crimson' });
  assert.equal(getActiveMatchManager(), match);
});

test('TrackRegistry never silently substitutes Barcelona for missing or unavailable circuits', () => {
  assert.equal(getTrack('barcelona').id, 'barcelona');
  assert.equal(isTrackAvailable('barcelona'), true);
  assert.equal(isTrackAvailable('glen_canyon_dam'), false);
  assert.equal(isTrackAvailable('track_05'), false);
  assert.equal(getTrack('does-not-exist'), null);
});

test('RaceSession commits one completed 1v1 result into MatchManager only when finished', () => {
  const controller = new RaceController({ totalLaps: 1, checkpointRadius: 1 });
  controller.configure([point(0, 0), point(10, 0)]);
  controller.start(1000);
  const match = new MatchManager({ trackOrder: ['barcelona', 'next'], winTarget: 2 });
  assert.equal(commitRaceToMatch(match, controller), null);
  controller.update(point(10, 0), point(0, 0), 1000);
  controller.update(point(0, 0), point(0, 0), 2000);
  const summary = commitRaceToMatch(match, controller, { source: 'p0-test' });
  assert.equal(summary.scoreA, 1);
  assert.equal(summary.scoreB, 0);
  assert.equal(summary.results[0].trackId, 'barcelona');
  assert.equal(summary.results[0].source, 'p0-test');
  assert.deepEqual(summary.results[0].finishOrder, ['player']);
  const career = createCareerRaceResult(controller, { trackId: 'barcelona', raceNumber: 1 });
  assert.equal(career.finished, true);
  assert.equal(career.lapsCompleted, 1);
  assert.equal(career.totalLaps, 1);
  assert.equal(career.trackId, 'barcelona');
  assert.equal(career.raceNumber, 1);
  assert.equal(career.winnerSide, 'A');
  assert.equal(career.classificationPosition, 1);
  assert.equal(career.finishPosition, 1);
  assert.deepEqual(career.classification, ['player', 'opponent']);
  assert.deepEqual(career.finishOrder, ['player']);
});

test('TrackSetupStore migrates the existing v2 grid without losing it', () => {
  const legacy = { x: 12, y: 3, z: -8, yaw: 1.25 };
  const storage = new MemoryStorage({ 'racingLifeGrid:v2:barcelona': JSON.stringify(legacy) });
  const store = new TrackSetupStore('barcelona', storage);
  const setup = store.load();
  assert.deepEqual(setup.grid, legacy);
  assert.deepEqual(setup.racingLine, []);
  assert.ok(storage.getItem('racingLifeTrackSetup:v1:barcelona'));
});

test('TrackSetupStore keeps authored racing-line points with the grid', () => {
  const storage = new MemoryStorage();
  const store = new TrackSetupStore('barcelona', storage);
  store.saveGrid({ x: 1, y: 2, z: 3, yaw: 0.5 });
  store.saveRacingLine([point(1, 3, 2), point(9, 12, 2)]);
  const setup = store.load();
  assert.equal(setup.racingLine.length, 2);
  assert.equal(setup.grid.yaw, 0.5);
});

test('RaceRuntime loads authored setup and exposes a ready controller without scene coupling', () => {
  const storage = new MemoryStorage();
  const store = new TrackSetupStore('barcelona', storage);
  store.saveGrid({ x: 2, y: 0, z: 4, yaw: 0.25 });
  store.saveRacingLine([point(2, 4), point(12, 4), point(12, 14)]);
  const runtime = new RaceRuntime({ trackId: 'barcelona', store });
  const loaded = runtime.load();
  assert.equal(loaded.ready, true);
  assert.equal(loaded.racingLinePointCount, 3);
  assert.equal(loaded.grid.yaw, 0.25);
  assert.equal(runtime.start(1000), true);
  assert.equal(runtime.getSnapshot().started, true);
});

test('RaceRuntime line authoring persists recorded route and reconfigures controller', () => {
  const storage = new MemoryStorage();
  const store = new TrackSetupStore('barcelona', storage);
  const runtime = new RaceRuntime({ trackId: 'barcelona', store, authoringSpacing: 2 });
  runtime.beginLineRecording(point(0, 0));
  runtime.sampleLine(point(1, 0));
  runtime.sampleLine(point(4, 0));
  runtime.sampleLine(point(8, 0));
  const count = runtime.finishLineRecording();
  assert.ok(count >= 2);
  assert.equal(runtime.getSnapshot().ready, true);
  assert.equal(store.load().racingLine.length, count);
  assert.equal(runtime.getHudState().recordingLine, false);
});

test('RaceSceneRuntimeBridge samples authoring while preserving scene-owned vehicle physics', () => {
  const storage = new MemoryStorage();
  const store = new TrackSetupStore('barcelona', storage);
  store.saveRacingLine([point(0, 0), point(10, 0)]);
  const runtime = new RaceRuntime({ trackId: 'barcelona', store, authoringSpacing: 2, checkpointRadius: 1 });
  const bridge = new RaceSceneRuntimeBridge({ runtime });
  bridge.load();
  const player = carAt(0, 0);
  const opponent = carAt(0, 0);
  bridge.beginAuthoring(player.position);
  player.position = point(4, 0);
  bridge.update({ playerCar: player, opponentCar: opponent, dt: 1 / 60, driveOpponent: false });
  player.position = point(8, 0);
  bridge.update({ playerCar: player, opponentCar: opponent, dt: 1 / 60, driveOpponent: false });
  assert.equal(bridge.finishAuthoring(), 3);
  assert.equal(store.load().racingLine.length, 3);
  assert.equal(opponent.driveCalls, 0);
});

test('RaceSceneRuntimeBridge commits match and career completion exactly once', () => {
  const storage = new MemoryStorage();
  const store = new TrackSetupStore('barcelona', storage);
  store.saveRacingLine([point(0, 0), point(10, 0)]);
  const runtime = new RaceRuntime({ trackId: 'barcelona', store, checkpointRadius: 1 });
  const match = new MatchManager({ trackOrder: ['barcelona', 'next'], winTarget: 2 });
  const careerResults = [];
  const delivered = [];
  const bridge = new RaceSceneRuntimeBridge({ runtime, matchManager: match, applyCareerResult: (result) => careerResults.push(result), onCompletion: (completion) => delivered.push(completion) });
  bridge.load();
  bridge.start(1000);
  const player = carAt(10, 0);
  const opponent = carAt(100, 100);
  bridge.update({ playerCar: player, opponentCar: opponent, dt: 1 / 60, driveOpponent: false });
  player.position = point(0, 0);
  const first = bridge.update({ playerCar: player, opponentCar: opponent, dt: 1 / 60, driveOpponent: false, details: { raceNumber: 1 } });
  const second = bridge.update({ playerCar: player, opponentCar: opponent, dt: 1 / 60, driveOpponent: false, details: { raceNumber: 1 } });
  assert.equal(first.completion.winnerSide, 'A');
  assert.equal(first.completion.raceNumber, 1);
  assert.equal(first.completion.careerResult.trackId, 'barcelona');
  assert.equal(first.completion.careerResult.raceNumber, 1);
  assert.equal(first.completion.careerResult.classificationPosition, 1);
  assert.deepEqual(first.completion.careerResult.classification, ['player', 'opponent']);
  assert.equal(second.completion, first.completion);
  assert.equal(match.getSummary().results.length, 1);
  assert.equal(careerResults.length, 1);
  assert.equal(delivered.length, 1);
  assert.equal(bridge.start(3000), false);
  assert.equal(bridge.beginAuthoring(player.position), false);
  assert.equal(bridge.clearAuthoring(), false);
  bridge.update({ playerCar: player, opponentCar: opponent, dt: 1 / 60, driveOpponent: false });
  assert.equal(match.getSummary().results.length, 1);
  assert.equal(careerResults.length, 1);
  assert.equal(delivered.length, 1);
});
