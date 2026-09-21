import test from 'node:test';
import assert from 'node:assert/strict';

import { MatchManager } from '../src/racing/MatchManager.js';
import { RaceRuntime } from '../src/racing/RaceRuntime.js';
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

function createRuntime(trackId) {
  const store = new TrackSetupStore(trackId, new MemoryStorage());
  store.saveRacingLine([point(0, 0), point(10, 0)]);
  const runtime = new RaceRuntime({
    trackId,
    store,
    totalLaps: 1,
    checkpointRadius: 1,
    requiredFinishers: 1
  });
  runtime.load();
  assert.equal(runtime.start(1000), true);
  return runtime;
}

function finishRace(runtime, winner) {
  const player = carAt(0, 0);
  const opponent = carAt(0, 0);
  runtime.update(player, opponent);

  const winnerCar = winner === 'A' ? player : opponent;
  winnerCar.position = point(10, 0);
  runtime.update(player, opponent);
  winnerCar.position = point(0, 0);
  return runtime.update(player, opponent);
}

test('five race runtimes can complete a full first-to-three match and persist career results once', () => {
  const tracks = ['barcelona', 'glen_canyon_dam', 'lake_como', 'mount_rainier', 'track_05'];
  // Use the production win target (3) and force a 2-2 split so this exercises
  // every configured track before the deciding fifth race.
  const match = new MatchManager({ trackOrder: tracks });
  const careerResults = [];
  const winners = ['A', 'B', 'A', 'B', 'A'];

  winners.forEach((winner, index) => {
    const currentRace = match.getCurrentRace();
    assert.equal(currentRace.raceNumber, index + 1);
    assert.equal(currentRace.trackId, tracks[index]);

    const runtime = createRuntime(currentRace.trackId);
    const terminal = finishRace(runtime, winner);
    assert.equal(terminal.completed, true);
    assert.equal(terminal.winnerSide, winner);

    const completion = runtime.commitCompletion({
      matchManager: match,
      applyCareerResult: (result) => careerResults.push(result),
      details: {
        raceNumber: currentRace.raceNumber,
        // These deliberately bogus outcome fields must not override measured data.
        winnerSide: winner === 'A' ? 'B' : 'A',
        finishOrder: ['bogus']
      }
    });

    assert.equal(completion.trackId, currentRace.trackId);
    assert.equal(completion.raceNumber, currentRace.raceNumber);
    assert.equal(completion.winnerSide, winner);
    assert.deepEqual(completion.finishOrder, [winner === 'A' ? 'player' : 'opponent']);

    // Render loops can observe terminal state repeatedly. Completion, match score,
    // and career persistence must all remain one-shot for this runtime.
    assert.strictEqual(
      runtime.commitCompletion({
        matchManager: match,
        applyCareerResult: (result) => careerResults.push(result),
        details: { raceNumber: currentRace.raceNumber }
      }),
      completion
    );
    assert.equal(careerResults.length, index + 1);
    assert.equal(match.getSummary().results.length, index + 1);

    if (index < winners.length - 1) {
      assert.equal(match.getSummary().completed, false);
    }
  });

  const summary = match.getSummary();
  assert.equal(summary.completed, true);
  assert.equal(summary.winner, 'A');
  assert.equal(summary.scoreA, 3);
  assert.equal(summary.scoreB, 2);
  assert.equal(summary.results.length, 5);
  assert.equal(match.getCurrentRace(), null);

  assert.deepEqual(
    careerResults.map((result) => ({
      trackId: result.trackId,
      raceNumber: result.raceNumber,
      winnerSide: result.winnerSide,
      classificationPosition: result.classificationPosition
    })),
    [
      { trackId: tracks[0], raceNumber: 1, winnerSide: 'A', classificationPosition: 1 },
      { trackId: tracks[1], raceNumber: 2, winnerSide: 'B', classificationPosition: 2 },
      { trackId: tracks[2], raceNumber: 3, winnerSide: 'A', classificationPosition: 1 },
      { trackId: tracks[3], raceNumber: 4, winnerSide: 'B', classificationPosition: 2 },
      { trackId: tracks[4], raceNumber: 5, winnerSide: 'A', classificationPosition: 1 }
    ]
  );
});
