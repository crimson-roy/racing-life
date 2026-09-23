import test from 'node:test';
import assert from 'node:assert/strict';

import { RaceProgress } from '../src/racing/RaceProgress.js';

function point(x, z = 0) {
  return { x, y: 0, z };
}

test('RaceProgress consumes multiple ordered checkpoints crossed in one physics sample', () => {
  const race = new RaceProgress({ totalLaps: 1, checkpointRadius: 0.5 });
  race.registerRacer('player');
  race.setCheckpoints([point(10), point(20), point(30)]);

  race.updateRacer('player', point(5), 1000);
  const state = race.updateRacer('player', point(25), 1100);

  assert.equal(state.checkpointsPassed, 2);
  assert.equal(state.nextCheckpoint, 2);
  assert.equal(state.finished, false);
});

test('RaceProgress does not award checkpoints encountered in reverse authored order', () => {
  const race = new RaceProgress({ totalLaps: 1, checkpointRadius: 0.5 });
  race.registerRacer('player');
  race.setCheckpoints([point(20), point(10), point(30)]);

  race.updateRacer('player', point(5), 1000);
  const state = race.updateRacer('player', point(25), 1100);

  // The segment reaches checkpoint 20 first. Checkpoint 10 lies behind that
  // point on the same segment and must not be counted afterward.
  assert.equal(state.checkpointsPassed, 1);
  assert.equal(state.nextCheckpoint, 1);
  assert.equal(state.finished, false);
});

test('RaceProgress can finish when a high-speed sample crosses the remaining ordered checkpoints', () => {
  const race = new RaceProgress({ totalLaps: 1, checkpointRadius: 0.5 });
  race.registerRacer('player');
  race.setCheckpoints([point(10), point(20), point(30)]);

  race.updateRacer('player', point(5), 1000);
  const state = race.updateRacer('player', point(35), 1200);

  assert.equal(state.checkpointsPassed, 3);
  assert.equal(state.completedLaps, 1);
  assert.equal(state.finished, true);
  assert.equal(state.finishPosition, 1);
  assert.equal(state.finishTimeMs, 1200);
  assert.deepEqual(race.finishOrder, ['player']);
});

test('RaceProgress stationary samples cannot sweep through coincident checkpoints', () => {
  const race = new RaceProgress({ totalLaps: 1, checkpointRadius: 0.5 });
  race.registerRacer('player');
  race.setCheckpoints([point(10), point(10), point(10)]);

  const first = race.updateRacer('player', point(10), 1000);
  assert.equal(first.checkpointsPassed, 1);
  assert.equal(first.finished, false);

  const second = race.updateRacer('player', point(10), 1100);
  assert.equal(second.checkpointsPassed, 2);
  assert.equal(second.nextCheckpoint, 2);
  assert.equal(second.finished, false);

  const third = race.updateRacer('player', point(10), 1200);
  assert.equal(third.checkpointsPassed, 3);
  assert.equal(third.finished, true);
  assert.equal(third.finishTimeMs, 1200);
});
