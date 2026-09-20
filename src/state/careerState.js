// Central career state for the prototype.
// Kept as a simple mutable object for now — not persisted between sessions yet.
// This is the seed of the "Career Area" table from the GDD (racer identity,
// skills, manager trust, reputation, money, team status, calendar).

export const careerState = {
  racerName: 'Rookie',
  team: 'Independent',

  // Core career stats (0-100 unless noted).
  trust: 50,
  reputation: 20,
  money: 5000,

  // Very rough calendar tracking for the prototype.
  week: 1,
  season: 1,

  // History of race results this prototype has generated.
  raceHistory: []
};

/**
 * Apply the outcome of a completed race to the career state.
 * Existing prototype reward values stay here; the race runtime only supplies
 * measured race/session metadata and never invents progression rules.
 * @param {{
 *   finished: boolean,
 *   lapsCompleted: number,
 *   totalLaps: number,
 *   trackId?: string,
 *   raceNumber?: number,
 *   winnerSide?: 'A'|'B',
 *   classificationPosition?: number|null,
 *   finishPosition?: number|null,
 *   finishTimeMs?: number|null,
 *   classification?: string[],
 *   finishOrder?: string[]
 * }} result
 */
export function applyRaceResult(result) {
  careerState.week += 1;

  if (result.finished) {
    careerState.trust = clamp(careerState.trust + 6, 0, 100);
    careerState.reputation = clamp(careerState.reputation + 4, 0, 100);
    careerState.money += 800;
  } else {
    careerState.trust = clamp(careerState.trust - 4, 0, 100);
    careerState.money += 150; // small appearance fee even on a DNF
  }

  careerState.raceHistory.push({
    week: careerState.week - 1,
    finished: Boolean(result.finished),
    lapsCompleted: result.lapsCompleted,
    totalLaps: result.totalLaps,
    trackId: result.trackId ?? null,
    raceNumber: Number.isInteger(result.raceNumber) ? result.raceNumber : null,
    winnerSide: result.winnerSide ?? null,
    classificationPosition: result.classificationPosition ?? null,
    finishPosition: result.finishPosition ?? null,
    finishTimeMs: Number.isFinite(result.finishTimeMs) ? result.finishTimeMs : null,
    classification: Array.isArray(result.classification)
      ? [...result.classification]
      : [],
    finishOrder: Array.isArray(result.finishOrder)
      ? [...result.finishOrder]
      : []
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
