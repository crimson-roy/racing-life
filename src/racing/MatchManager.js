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
    this.winTarget = options.winTarget ?? 3;
    this.trackOrder = options.trackOrder ?? DEFAULT_TRACK_ORDER;
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
  // RaceScene3D/RaceController can attach lap, finish-time and racer metadata
  // without MatchManager needing to know about Three.js or checkpoint state.
  recordResult(winnerSide, details = {}) {
    if (this.completed) {
      return this.getSummary();
    }

    if (winnerSide === 'A') {
      this.scoreA += 1;
    } else if (winnerSide === 'B') {
      this.scoreB += 1;
    } else {
      throw new Error('winnerSide must be "A" or "B".');
    }

    const raceNumber = this.currentRaceIndex + 1;
    const trackId = this.trackOrder[this.currentRaceIndex];

    this.results.push({
      raceNumber,
      trackId,
      winnerSide,
      scoreA: this.scoreA,
      scoreB: this.scoreB,
      ...details
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
