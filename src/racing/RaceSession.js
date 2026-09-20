// Small bridge between a completed 1v1 RaceController and the confirmed
// first-to-three faction MatchManager flow. Keeping this outside RaceScene3D
// prevents rendering code from owning match/career progression rules.
export function commitRaceToMatch(matchManager, raceController, details = {}) {
  if (!matchManager || !raceController) {
    throw new Error('commitRaceToMatch requires matchManager and raceController.');
  }

  const snapshot = raceController.getSnapshot();
  const winnerSide = snapshot.winnerSide;

  if (!snapshot.completed || !winnerSide) {
    return null;
  }

  const player = snapshot.racers.find((racer) => racer.id === raceController.playerId) ?? null;
  const opponent = snapshot.racers.find((racer) => racer.id === raceController.opponentId) ?? null;

  return matchManager.recordResult(winnerSide, {
    // finishOrder remains the strict list of racers that actually crossed the
    // finish. classification is the complete current leaderboard, so a 1v1
    // result can still present winner/runner-up when the race locks on P1.
    finishOrder: [...snapshot.finishOrder],
    classification: snapshot.racers.map((racer) => racer.id),
    playerFinishTimeMs: player?.finishTimeMs ?? null,
    opponentFinishTimeMs: opponent?.finishTimeMs ?? null,
    totalLaps: snapshot.totalLaps,
    ...details
  });
}

// Convert race state into the shape used by the current prototype career
// result function. This does not invent new rewards or progression values;
// careerState remains the single owner of those existing prototype rules.
export function createCareerRaceResult(raceController) {
  if (!raceController) {
    throw new Error('createCareerRaceResult requires a raceController.');
  }

  const snapshot = raceController.getSnapshot();
  const player = snapshot.racers.find((racer) => racer.id === raceController.playerId);

  return {
    finished: Boolean(player?.finished),
    lapsCompleted: player?.completedLaps ?? 0,
    totalLaps: snapshot.totalLaps
  };
}
