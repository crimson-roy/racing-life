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
    // Scene/session identity metadata is accepted, but measured race outcome
    // fields below remain authoritative and cannot be overwritten by callers.
    ...details,
    // finishOrder remains the strict list of racers that actually crossed the
    // finish. classification is the complete current leaderboard, so a 1v1
    // result can still present winner/runner-up when the race locks on P1.
    finishOrder: [...snapshot.finishOrder],
    classification: snapshot.racers.map((racer) => racer.id),
    playerFinishTimeMs: player?.finishTimeMs ?? null,
    opponentFinishTimeMs: opponent?.finishTimeMs ?? null,
    totalLaps: snapshot.totalLaps
  });
}

// Convert race state into the shape owned by the current prototype career
// result function. Reward values remain in careerState; this function only
// preserves authoritative measured race/session facts for career history.
export function createCareerRaceResult(raceController, details = {}) {
  if (!raceController) {
    throw new Error('createCareerRaceResult requires a raceController.');
  }

  const snapshot = raceController.getSnapshot();
  const player = snapshot.racers.find((racer) => racer.id === raceController.playerId);
  const classification = snapshot.racers.map((racer) => racer.id);
  const classificationIndex = classification.indexOf(raceController.playerId);

  return {
    finished: Boolean(player?.finished),
    lapsCompleted: player?.completedLaps ?? 0,
    totalLaps: snapshot.totalLaps,
    trackId: details.trackId ?? null,
    raceNumber: Number.isInteger(details.raceNumber) ? details.raceNumber : null,
    winnerSide: snapshot.winnerSide,
    classificationPosition: classificationIndex >= 0
      ? classificationIndex + 1
      : null,
    finishPosition: player?.finishPosition ?? null,
    finishTimeMs: player?.finishTimeMs ?? null,
    classification,
    finishOrder: [...snapshot.finishOrder]
  };
}
