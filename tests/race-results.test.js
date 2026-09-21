import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceProgress } from '../src/racing/RaceProgress.js';
import { RaceRuntime } from '../src/racing/RaceRuntime.js';
import { MatchManager } from '../src/racing/MatchManager.js';
import { TrackSetupStore } from '../src/racing/TrackSetupStore.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function point(x, z, y = 0) {
  return { x, y, z };
}

function carAt(x, z) {
  return {
    position: point(x, z),
    rotation: { y: 0 },
    drive() {}
  };
}

test('unfinished racers tied on checkpoints are ranked by proximity to next ordered checkpoint', () => {
  const progress = new RaceProgress({ totalLaps: 1, checkpointRadius: 1 });
  progress.registerRacer('player');
  progress.registerRacer('opponent');
  progress.setCheckpoints([point(10, 0), point(20, 0)]);

  progress.updateRacer('player', point(2, 0), 100);
  progress.updateRacer('opponent', point(8, 0), 100);

  assert.deepEqual(
    progress.getSnapshot().racers.map((racer) => racer.id),
    ['opponent', 'player']
  );
});

test('completion payload keeps strict finishers separate from full 1v1 classification', () => {
  const storage = new MemoryStorage();
  const store = new TrackSetupStore('barcelona', storage);
  store.saveRacingLine([point(0, 0), point(10, 0)]);

  const runtime = new RaceRuntime({
    trackId: 'barcelona',
    store,
    totalLaps: 1,
    checkpointRadius: 1
  });

  runtime.load();
  runtime.start(1000);

  const player = carAt(10, 0);
  const opponent = carAt(7, 0);
  runtime.update(player, opponent);

  player.position = point(0, 0);
  runtime.update(player, opponent);

  const completion = runtime.commitCompletion();
  assert.deepEqual(completion.finishOrder, ['player']);
  assert.deepEqual(completion.classification, ['player', 'opponent']);
  assert.equal(completion.racers.length, 2);
  assert.equal(completion.racers[0].classificationPosition, 1);
  assert.equal(completion.racers[0].finished, true);
  assert.equal(completion.racers[1].classificationPosition, 2);
  assert.equal(completion.racers[1].finished, false);
});

test('completed race freezes progress and classification before result commit', () => {
  const storage = new MemoryStorage();
  const store = new TrackSetupStore('barcelona', storage);
  store.saveRacingLine([point(0, 0), point(10, 0)]);

  const runtime = new RaceRuntime({
    trackId: 'barcelona',
    store,
    totalLaps: 1,
    checkpointRadius: 1,
    requiredFinishers: 1
  });

  runtime.load();
  runtime.start(1000);

  const player = carAt(10, 0);
  const opponent = carAt(7, 0);
  runtime.update(player, opponent);
  player.position = point(0, 0);
  runtime.update(player, opponent);

  const terminal = runtime.getSnapshot();
  assert.equal(terminal.completed, true);
  assert.deepEqual(terminal.finishOrder, ['player']);
  assert.deepEqual(terminal.racers.map((racer) => racer.id), ['player', 'opponent']);

  // The render loop may run again before commitCompletion is called. Even if
  // the runner-up physically crosses every remaining checkpoint, the terminal
  // classification must stay exactly as it was when the race locked.
  opponent.position = point(10, 0);
  runtime.update(player, opponent);
  opponent.position = point(0, 0);
  const repeated = runtime.update(player, opponent);

  assert.deepEqual(repeated.finishOrder, terminal.finishOrder);
  assert.deepEqual(
    repeated.racers.map((racer) => ({
      id: racer.id,
      finished: racer.finished,
      checkpointsPassed: racer.checkpointsPassed
    })),
    terminal.racers.map((racer) => ({
      id: racer.id,
      finished: racer.finished,
      checkpointsPassed: racer.checkpointsPassed
    }))
  );

  const completion = runtime.commitCompletion();
  assert.deepEqual(completion.finishOrder, ['player']);
  assert.deepEqual(completion.classification, ['player', 'opponent']);
  assert.equal(completion.racers[1].finished, false);
});

test('MatchManager ignores duplicate committed race numbers and rejects stale future scoring', () => {
  const match = new MatchManager({
    trackOrder: ['barcelona', 'glen_canyon_dam', 'lake_como'],
    winTarget: 2
  });

  match.recordResult('A', { raceNumber: 1, trackId: 'barcelona' });
  match.recordResult('A', { raceNumber: 1, trackId: 'barcelona' });

  let summary = match.getSummary();
  assert.equal(summary.scoreA, 1);
  assert.equal(summary.results.length, 1);
  assert.equal(match.getCurrentRace().raceNumber, 2);

  assert.throws(
    () => match.recordResult('B', { raceNumber: 3, trackId: 'lake_como' }),
    /Stale race result/
  );

  assert.throws(
    () => match.recordResult('B', { raceNumber: 2, trackId: 'lake_como' }),
    /Race track mismatch/
  );

  summary = match.getSummary();
  assert.equal(summary.scoreB, 0);
  assert.equal(summary.results.length, 1);
});
