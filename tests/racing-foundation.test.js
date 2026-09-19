import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceProgress } from '../src/racing/RaceProgress.js';
import { MatchManager } from '../src/racing/MatchManager.js';
import { TrackSetupStore } from '../src/racing/TrackSetupStore.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test('RaceProgress requires ordered checkpoints before finishing a lap', () => {
  const race = new RaceProgress({ totalLaps: 1, checkpointRadius: 2 });
  race.registerRacer('player');
  race.setCheckpoints([
    { x: 10, z: 0 },
    { x: 20, z: 0 },
    { x: 0, z: 0 }
  ]);

  race.updateRacer('player', { x: 20, z: 0 }, 1000);
  assert.equal(race.getRacerState('player').checkpointsPassed, 0);

  race.updateRacer('player', { x: 10, z: 0 }, 2000);
  race.updateRacer('player', { x: 20, z: 0 }, 3000);
  race.updateRacer('player', { x: 0, z: 0 }, 4000);

  const state = race.getRacerState('player');
  assert.equal(state.finished, true);
  assert.equal(state.finishPosition, 1);
  assert.equal(state.finishTimeMs, 4000);
});

test('MatchManager ends confirmed faction format when one side reaches three wins', () => {
  const match = new MatchManager({
    factionA: 'azure',
    factionB: 'crimson',
    winTarget: 3,
    trackOrder: ['one', 'two', 'three', 'four', 'five']
  });

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

test('TrackSetupStore migrates the existing v2 grid without losing it', () => {
  const legacy = { x: 12, y: 3, z: -8, yaw: 1.25 };
  const storage = new MemoryStorage({
    'racingLifeGrid:v2:barcelona': JSON.stringify(legacy)
  });
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
  store.saveRacingLine([
    { x: 1, y: 2, z: 3 },
    { x: 9, y: 2, z: 12 }
  ]);

  const setup = store.load();
  assert.equal(setup.racingLine.length, 2);
  assert.equal(setup.grid.yaw, 0.5);
});
