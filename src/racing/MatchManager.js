const DEFAULT_TRACK_ORDER = [
  'track_01',
  'track_02',
  'track_03',
  'track_04',
  'track_05'
];

export class MatchManager {
  constructor(options = {}) {
    this.winTarget = options.winTarget ?? 3;
    this.trackOrder = options.trackOrder ?? DEFAULT_TRACK_ORDER;
    this.factionA = options.factionA ?? 'azure';
    this.factionB = options.factionB ?? 'crimson';
    this.reset();
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

  recordResult(winnerSide) {
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

    this.results.push({
      raceNumber: this.currentRaceIndex + 1,
      trackId: this.trackOrder[this.currentRaceIndex],
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
      results: [...this.results]
    };
  }
}
