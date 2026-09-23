const DEFAULT_TRACK_ORDER = [
  'barcelona',
  'glen_canyon_dam',
  'lake_como',
  'mount_rainier',
  'track_05'
];

let activeMatchManager = null;

// The app owns one MatchManager in main.js. Race scenes are constructed from
// the current session object, so exposing that same active instance lets the
// P0 runtime commit results without moving match ownership into Three.js.
export function getActiveMatchManager() {
  return activeMatchManager;
}

export class MatchManager {
  constructor(options = {}) {
    const winTarget = options.winTarget ?? 3;
    const trackOrder = options.trackOrder ?? DEFAULT_TRACK_ORDER;

    if (!Number.isInteger(winTarget) || winTarget < 1) {
      throw new Error('MatchManager winTarget must be a positive integer.');
    }
    if (!Array.isArray(trackOrder) || trackOrder.length === 0) {
      throw new Error('MatchManager requires at least one race track.');
    }
    if (trackOrder.some((trackId) => typeof trackId !== 'string' || trackId.trim() === '')) {
      throw new Error('MatchManager trackOrder requires non-empty track ids.');
    }
    if (winTarget > trackOrder.length) {
      throw new Error('MatchManager winTarget cannot exceed the available race count.');
    }

    this.winTarget = winTarget;
    this.trackOrder = [...trackOrder];
    this.factionA = options.factionA ?? 'azure';
    this.factionB = options.factionB ?? 'crimson';
    this.reset();
    activeMatchManager = this;
  }

  reset() {
    this.scoreA = 0;
    this.scoreB = 0;
    this.currentRaceIndex = 0;
    this.completed = false;
    this.results = [];
  }

  getCurrentRace() {
    if (this.completed) return null;

    const index = Math.min(
      this.currentRaceIndex,
      this.trackOrder.length - 1
    );

    return {
      id: `race_${index + 1}`,
      raceNumber: index + 1,
      trackId: this.trackOrder[index],
      factionA: this.factionA,
      factionB: this.factionB,
      scoreA: this.scoreA,
      scoreB: this.scoreB
    };
  }

  // `details` is intentionally optional so existing callers remain valid.
  // When a scene supplies raceNumber/trackId, use them as an idempotency and
  // stale-scene guard. A completed render loop must never score the next race.
  recordResult(winnerSide, details = {}) {
    const suppliedRaceNumber = Number.isInteger(details.raceNumber)
      ? details.raceNumber
      : null;

    if (suppliedRaceNumber !== null) {
      const existing = this.results.find(
        (result) => result.raceNumber === suppliedRaceNumber
      );

      if (existing) {
        return this.getSummary();
      }
    }

    if (this.completed) {
      return this.getSummary();
    }

    const expectedRaceNumber = this.currentRaceIndex + 1;
    const expectedTrackId = this.trackOrder[this.currentRaceIndex];

    if (
      suppliedRaceNumber !== null &&
      suppliedRaceNumber !== expectedRaceNumber
    ) {
      throw new Error(
        `Stale race result: expected race ${expectedRaceNumber}, received ${suppliedRaceNumber}.`
      );
    }

    if (
      details.trackId &&
      details.trackId !== expectedTrackId
    ) {
      throw new Error(
        `Race track mismatch: expected "${expectedTrackId}", received "${details.trackId}".`
      );
    }

    if (winnerSide === 'A') {
      this.scoreA += 1;
    } else if (winnerSide === 'B') {
      this.scoreB += 1;
    } else {
      throw new Error('winnerSide must be "A" or "B".');
    }

    const raceNumber = expectedRaceNumber;
    const trackId = expectedTrackId;

    this.results.push({
      ...details,
      // Authoritative match identity cannot be overwritten by scene details.
      raceNumber,
      trackId,
      winnerSide,
      scoreA: this.scoreA,
      scoreB: this.scoreB
    });

    if (
      this.scoreA >= this.winTarget ||
      this.scoreB >= this.winTarget
    ) {
      this.completed = true;
    } else {
      this.currentRaceIndex += 1;

      if (this.currentRaceIndex >= this.trackOrder.length) {
        this.completed = true;
      }
    }

    return this.getSummary();
  }

  getSummary() {
    return {
      factionA: this.factionA,
      factionB: this.factionB,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      winTarget: this.winTarget,
      currentRaceIndex: this.currentRaceIndex,
      completed: this.completed,
      winner:
        this.completed
          ? this.scoreA > this.scoreB
            ? 'A'
            : this.scoreB > this.scoreA
              ? 'B'
              : null
          : null,
      results: this.results.map((result) => ({ ...result }))
    };
  }
}
