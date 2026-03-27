export type BallSet = "solid" | "stripe";

export interface GameRules {
  assignedSet: BallSet | null;
  pottedSolids: number[];   // ball numbers 1-7
  pottedStripes: number[];  // ball numbers 9-15
  eightBallPotted: boolean;
  cueBallPotted: boolean;
  foul: string | null;
  result: "win" | "loss" | null;
}

export const INITIAL_RULES: GameRules = {
  assignedSet: null,
  pottedSolids: [],
  pottedStripes: [],
  eightBallPotted: false,
  cueBallPotted: false,
  foul: null,
  result: null,
};

export function ballSet(ballNumber: number): BallSet | "eight" | "cue" {
  if (ballNumber === 0) return "cue";
  if (ballNumber === 8) return "eight";
  if (ballNumber >= 1 && ballNumber <= 7) return "solid";
  return "stripe";
}

export function analyzeShot(
  ballNumbersBefore: number[],
  ballNumbersAfter: number[],
  firstHitBallNumber: number | null,
  railHitAfterContact: boolean,
  prev: GameRules,
): GameRules {
  // Start from previous state, clear per-shot fields
  const rules: GameRules = {
    ...prev,
    foul: null,
    result: null,
    cueBallPotted: false,
  };

  // Determine which balls were potted this shot
  const afterSet = new Set(ballNumbersAfter);
  const pottedThisShot = ballNumbersBefore.filter((n) => !afterSet.has(n));

  // Track potted balls
  for (const n of pottedThisShot) {
    const set = ballSet(n);
    if (set === "solid" && !rules.pottedSolids.includes(n)) {
      rules.pottedSolids = [...rules.pottedSolids, n];
    } else if (set === "stripe" && !rules.pottedStripes.includes(n)) {
      rules.pottedStripes = [...rules.pottedStripes, n];
    } else if (set === "eight") {
      rules.eightBallPotted = true;
    } else if (set === "cue") {
      rules.cueBallPotted = true;
    }
  }

  // Assign set on first object ball pot (if not yet assigned)
  if (rules.assignedSet === null) {
    const pottedSolidsThisShot = pottedThisShot.filter((n) => ballSet(n) === "solid");
    const pottedStripesThisShot = pottedThisShot.filter((n) => ballSet(n) === "stripe");
    if (pottedSolidsThisShot.length > 0 && pottedStripesThisShot.length === 0) {
      rules.assignedSet = "solid";
    } else if (pottedStripesThisShot.length > 0 && pottedSolidsThisShot.length === 0) {
      rules.assignedSet = "stripe";
    }
    // Both potted on break — no assignment yet, decided on next shot
  }

  // Check 8-ball potted
  if (rules.eightBallPotted) {
    const mySet = rules.assignedSet;
    // Check if any balls of the assigned set remain on the table
    const remainingOnTable = ballNumbersAfter.filter(
      (n) => ballSet(n) === mySet,
    );
    if (mySet === null || remainingOnTable.length > 0) {
      rules.result = "loss";
      rules.foul = "8-ball potted early";
    } else {
      rules.result = "win";
    }
    return rules;
  }

  // Check cue ball potted
  if (rules.cueBallPotted) {
    rules.foul = "Cue ball potted";
    return rules;
  }

  // Check first-hit ball (only if set is assigned)
  if (rules.assignedSet !== null && firstHitBallNumber !== null) {
    const hitSet = ballSet(firstHitBallNumber);

    // Must hit own set first, unless no balls of own set remain (then must hit 8)
    const myRemaining = ballNumbersBefore.filter(
      (n) => ballSet(n) === rules.assignedSet,
    );
    const allCleared = myRemaining.length === 0;

    if (allCleared) {
      // Must hit the 8-ball
      if (hitSet !== "eight") {
        rules.foul = `Must hit 8-ball first (hit ${hitSet})`;
      }
    } else {
      // Must hit own set
      if (hitSet !== rules.assignedSet) {
        rules.foul = `Must hit ${rules.assignedSet} first (hit ${hitSet === "cue" ? "nothing" : hitSet})`;
      }
    }
  }

  // No hit at all
  if (firstHitBallNumber === null && rules.assignedSet !== null) {
    rules.foul = "Cue ball didn't hit any ball";
  }

  // No rail after contact and no ball potted
  if (!rules.foul && firstHitBallNumber !== null && !railHitAfterContact && pottedThisShot.length === 0) {
    rules.foul = "No rail hit after contact";
  }

  return rules;
}
