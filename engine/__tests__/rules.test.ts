import { analyzeShot, INITIAL_RULES, type GameRules } from "../rules";

function ballNumbers(count: number): number[] {
  // 0=cue, 1-7=solids, 8=eight, 9-15=stripes
  return [0, ...Array.from({ length: count }, (_, i) => i + 1)];
}

const ALL_BALLS = ballNumbers(15);

// Helper: most tests assume a rail was hit (no rail foul)
function analyze(
  before: number[],
  after: number[],
  firstHit: number | null,
  prev: GameRules,
  railHit = true,
) {
  return analyzeShot(before, after, firstHit, railHit, prev);
}

describe("set assignment", () => {
  test("assigns solids when solid potted first", () => {
    const after = ALL_BALLS.filter((n) => n !== 3);
    const rules = analyze(ALL_BALLS, after, 3, INITIAL_RULES);
    expect(rules.assignedSet).toBe("solid");
    expect(rules.pottedSolids).toEqual([3]);
  });

  test("assigns stripes when stripe potted first", () => {
    const after = ALL_BALLS.filter((n) => n !== 12);
    const rules = analyze(ALL_BALLS, after, 12, INITIAL_RULES);
    expect(rules.assignedSet).toBe("stripe");
    expect(rules.pottedStripes).toEqual([12]);
  });

  test("no assignment when nothing potted", () => {
    const rules = analyze(ALL_BALLS, ALL_BALLS, 5, INITIAL_RULES);
    expect(rules.assignedSet).toBeNull();
  });

  test("no assignment when both sets potted on break", () => {
    const after = ALL_BALLS.filter((n) => n !== 1 && n !== 2 && n !== 10);
    const rules = analyze(ALL_BALLS, after, 1, INITIAL_RULES);
    expect(rules.assignedSet).toBeNull();
  });
});

describe("first hit fouls", () => {
  const solidAssigned: GameRules = { ...INITIAL_RULES, assignedSet: "solid" };

  test("no foul when hitting own set first", () => {
    const rules = analyze(ALL_BALLS, ALL_BALLS, 3, solidAssigned);
    expect(rules.foul).toBeNull();
  });

  test("foul when hitting opponent set first", () => {
    const rules = analyze(ALL_BALLS, ALL_BALLS, 11, solidAssigned);
    expect(rules.foul).toContain("solid");
  });

  test("foul when hitting 8-ball before clearing set", () => {
    const rules = analyze(ALL_BALLS, ALL_BALLS, 8, solidAssigned);
    expect(rules.foul).toContain("solid");
  });

  test("no foul hitting 8-ball when set is cleared", () => {
    const cleared: GameRules = {
      ...INITIAL_RULES,
      assignedSet: "solid",
      pottedSolids: [1, 2, 3, 4, 5, 6, 7],
    };
    const remaining = ALL_BALLS.filter((n) => !(n >= 1 && n <= 7));
    const rules = analyze(remaining, remaining, 8, cleared);
    expect(rules.foul).toBeNull();
  });

  test("foul when set cleared but not hitting 8-ball first", () => {
    const cleared: GameRules = {
      ...INITIAL_RULES,
      assignedSet: "solid",
      pottedSolids: [1, 2, 3, 4, 5, 6, 7],
    };
    const remaining = ALL_BALLS.filter((n) => !(n >= 1 && n <= 7));
    const rules = analyze(remaining, remaining, 10, cleared);
    expect(rules.foul).toContain("8-ball");
  });

  test("foul when cue ball hits nothing", () => {
    const rules = analyze(ALL_BALLS, ALL_BALLS, null, solidAssigned);
    expect(rules.foul).toContain("didn't hit");
  });
});

describe("rail after contact", () => {
  const solidAssigned: GameRules = { ...INITIAL_RULES, assignedSet: "solid" };

  test("foul when no rail hit after contact and no ball potted", () => {
    const rules = analyze(ALL_BALLS, ALL_BALLS, 3, solidAssigned, false);
    expect(rules.foul).toContain("No rail");
  });

  test("no foul when no rail but ball was potted", () => {
    const after = ALL_BALLS.filter((n) => n !== 3);
    const rules = analyze(ALL_BALLS, after, 3, solidAssigned, false);
    expect(rules.foul).toBeNull();
  });

  test("no foul when rail hit after contact", () => {
    const rules = analyze(ALL_BALLS, ALL_BALLS, 3, solidAssigned, true);
    expect(rules.foul).toBeNull();
  });
});

describe("cue ball potted", () => {
  test("foul when cue ball potted", () => {
    const after = ALL_BALLS.filter((n) => n !== 0);
    const rules = analyze(ALL_BALLS, after, 3, INITIAL_RULES);
    expect(rules.cueBallPotted).toBe(true);
    expect(rules.foul).toContain("Cue ball potted");
  });
});

describe("8-ball", () => {
  test("loss when 8-ball potted early", () => {
    const after = ALL_BALLS.filter((n) => n !== 8);
    const assigned: GameRules = { ...INITIAL_RULES, assignedSet: "solid" };
    const rules = analyze(ALL_BALLS, after, 8, assigned);
    expect(rules.eightBallPotted).toBe(true);
    expect(rules.result).toBe("loss");
  });

  test("loss when 8-ball potted with no set assigned", () => {
    const after = ALL_BALLS.filter((n) => n !== 8);
    const rules = analyze(ALL_BALLS, after, 8, INITIAL_RULES);
    expect(rules.result).toBe("loss");
  });

  test("win when 8-ball potted after clearing set", () => {
    const cleared: GameRules = {
      ...INITIAL_RULES,
      assignedSet: "solid",
      pottedSolids: [1, 2, 3, 4, 5, 6, 7],
    };
    const remaining = [0, 8, 9, 10, 11, 12, 13, 14, 15];
    const after = remaining.filter((n) => n !== 8);
    const rules = analyze(remaining, after, 8, cleared);
    expect(rules.result).toBe("win");
  });
});

describe("state accumulation", () => {
  test("potted balls accumulate across shots", () => {
    const after1 = ALL_BALLS.filter((n) => n !== 1);
    const rules1 = analyze(ALL_BALLS, after1, 1, INITIAL_RULES);
    expect(rules1.pottedSolids).toEqual([1]);
    expect(rules1.assignedSet).toBe("solid");

    const after2 = after1.filter((n) => n !== 2);
    const rules2 = analyze(after1, after2, 2, rules1);
    expect(rules2.pottedSolids).toEqual([1, 2]);
    expect(rules2.assignedSet).toBe("solid");
  });
});
