import { BallState, MotionState } from "../physics/ball-state";
import { BALL_RADIUS, STANDARD_9_FOOT } from "../physics/constants";
import { cueStrike } from "../physics/motion-models";
import {
  reducer,
  INITIAL_STATE,
  extractCueParams,
  buildAimedBalls,
  type InternalState,
  type Action,
} from "../game-reducer";

// ── Helpers ──────────────────────────────────────────────────────────

const TABLE = STANDARD_9_FOOT;
const CY = TABLE.height / 2;
const CUE_X = TABLE.width / 3;
const OBJ_X = CUE_X + TABLE.width / 3;

function makeTwoBallScenario(): BallState[] {
  return [
    cueStrike([CUE_X, CY], [1, 0], 2.0),
    new BallState([OBJ_X, CY], [0, 0], [0, 0], MotionState.STOPPED, 1),
  ];
}

function loadScenario(balls: BallState[]): InternalState {
  return reducer(INITIAL_STATE, { type: "LOAD_SCENARIO", balls });
}

/** Run TICK until mode is no longer "playing" (shot animation completes) */
function tickUntilDone(state: InternalState): InternalState {
  let s = state;
  let safety = 0;
  while (s.mode === "playing" && safety < 100_000) {
    s = reducer(s, { type: "TICK" });
    safety++;
  }
  return s;
}

/** Load scenario, shoot, and tick until done — returns state after first shot */
function shootOnce(balls: BallState[]): InternalState {
  let s = loadScenario(balls);
  s = reducer(s, { type: "SHOOT" });
  return tickUntilDone(s);
}

/** Take N identical shots in sequence (re-aiming at ball index 1 each time) */
function shootNTimes(balls: BallState[], n: number): InternalState {
  let s = shootOnce(balls);
  for (let i = 1; i < n; i++) {
    // Transition to preview for next shot
    s = reducer(s, { type: "SET_TARGET", ballIndex: 1 });
    s = reducer(s, { type: "SHOOT" });
    s = tickUntilDone(s);
  }
  return s;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("shot history snapshotting", () => {
  test("SHOOT adds a snapshot to shotHistory", () => {
    const balls = makeTwoBallScenario();
    let s = loadScenario(balls);
    expect(s.shotHistory).toHaveLength(0);

    s = reducer(s, { type: "SHOOT" });
    expect(s.shotHistory).toHaveLength(1);
    expect(s.mode).toBe("playing");
  });

  test("snapshot captures pre-shot ball positions", () => {
    const balls = makeTwoBallScenario();
    let s = loadScenario(balls);
    const preShotBalls = s.initialBalls;

    s = reducer(s, { type: "SHOOT" });
    const snapshot = s.shotHistory[0];
    expect(snapshot.initialBalls).toBe(preShotBalls);
  });

  test("multiple shots accumulate history", () => {
    const s = shootNTimes(makeTwoBallScenario(), 3);
    expect(s.shotHistory).toHaveLength(3);
    expect(s.shotsTaken).toBe(3);
  });

  test("latestBalls is populated after shot completes", () => {
    const s = shootOnce(makeTwoBallScenario());
    expect(s.latestBalls.length).toBeGreaterThan(0);
    // latestBalls should all be stopped
    for (const b of s.latestBalls) {
      expect(b.motion).toBe(MotionState.STOPPED);
    }
  });
});

describe("RESTORE_TO_SHOT", () => {
  test("restores ball positions from the selected snapshot", () => {
    const balls = makeTwoBallScenario();
    const s = shootNTimes(balls, 3);
    const shot1Balls = s.shotHistory[0].initialBalls;

    const restored = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 0 });
    expect(restored.initialBalls).toEqual(shot1Balls);
    expect(restored.mode).toBe("preview");
  });

  test("preserves full shot history (does not trim)", () => {
    const s = shootNTimes(makeTwoBallScenario(), 3);
    const restored = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 0 });
    expect(restored.shotHistory).toHaveLength(3);
  });

  test("sets restoredToIndex", () => {
    const s = shootNTimes(makeTwoBallScenario(), 3);
    const restored = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 1 });
    expect(restored.restoredToIndex).toBe(1);
    expect(restored.shotsTaken).toBe(1);
  });

  test("saves tipSnapshot on first branch", () => {
    const s = shootNTimes(makeTwoBallScenario(), 2);
    expect(s.tipSnapshot).toBeNull();

    const restored = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 0 });
    expect(restored.tipSnapshot).not.toBeNull();
    expect(restored.tipSnapshot!.initialBalls).toEqual(s.latestBalls);
  });

  test("tipSnapshot is not overwritten on subsequent restores", () => {
    const s = shootNTimes(makeTwoBallScenario(), 3);
    const r1 = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 0 });
    const tip1 = r1.tipSnapshot;

    const r2 = reducer(r1, { type: "RESTORE_TO_SHOT", shotIndex: 1 });
    expect(r2.tipSnapshot).toBe(tip1);
  });

  test("latestBalls is preserved through restore", () => {
    const s = shootNTimes(makeTwoBallScenario(), 2);
    const latestBefore = s.latestBalls;

    const restored = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 0 });
    expect(restored.latestBalls).toEqual(latestBefore);
  });

  test("rejects out of range shotIndex", () => {
    const s = shootNTimes(makeTwoBallScenario(), 2);
    expect(reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: -1 })).toBe(s);
    expect(reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 5 })).toBe(s);
  });
});

describe("RESTORE_TO_LATEST", () => {
  test("restores to the tip state after branching", () => {
    const s = shootNTimes(makeTwoBallScenario(), 2);
    const latestBalls = s.latestBalls;

    const branched = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 0 });
    const restored = reducer(branched, { type: "RESTORE_TO_LATEST" });

    expect(restored.initialBalls).toEqual(latestBalls);
    expect(restored.tipSnapshot).toBeNull();
    expect(restored.restoredToIndex).toBeNull();
    expect(restored.shotsTaken).toBe(2);
  });

  test("latestBalls survives restore-to-latest", () => {
    const s = shootNTimes(makeTwoBallScenario(), 2);
    const branched = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 0 });
    const restored = reducer(branched, { type: "RESTORE_TO_LATEST" });
    expect(restored.latestBalls).toEqual(s.latestBalls);
  });

  test("is a no-op when not branched", () => {
    const s = shootNTimes(makeTwoBallScenario(), 2);
    expect(reducer(s, { type: "RESTORE_TO_LATEST" })).toBe(s);
  });
});

describe("SHOOT after restore trims future history", () => {
  test("shooting from restored position trims later snapshots", () => {
    const s = shootNTimes(makeTwoBallScenario(), 3);
    expect(s.shotHistory).toHaveLength(3);

    // Restore to shot 1 (index 0)
    let restored = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 0 });

    // Shoot from that position — should trim shots 1,2 and add the new one
    restored = reducer(restored, { type: "SHOOT" });
    expect(restored.shotHistory).toHaveLength(1);
    expect(restored.shotsTaken).toBe(1);
    expect(restored.restoredToIndex).toBeNull();
    expect(restored.tipSnapshot).toBeNull();
  });

  test("shooting from latest (after restore-to-latest) trims nothing", () => {
    const s = shootNTimes(makeTwoBallScenario(), 2);
    const branched = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 0 });
    const atLatest = reducer(branched, { type: "RESTORE_TO_LATEST" });

    // Transition to preview and shoot
    const previewing = reducer(atLatest, { type: "SET_TARGET", ballIndex: 1 });
    const shot = reducer(previewing, { type: "SHOOT" });

    // Should have original 2 + 1 new = 3
    expect(shot.shotHistory).toHaveLength(3);
  });

  test("shooting from middle position keeps earlier history", () => {
    const s = shootNTimes(makeTwoBallScenario(), 4);
    const restored = reducer(s, { type: "RESTORE_TO_SHOT", shotIndex: 2 });

    const shot = reducer(restored, { type: "SHOOT" });
    // Kept shots 0,1 from before index 2, plus new shot = 3
    expect(shot.shotHistory).toHaveLength(3);
    expect(shot.shotsTaken).toBe(3);
  });
});

describe("LOAD_SCENARIO resets history", () => {
  test("loading a new scenario clears all history", () => {
    const s = shootNTimes(makeTwoBallScenario(), 2);
    expect(s.shotHistory).toHaveLength(2);

    const fresh = reducer(s, {
      type: "LOAD_SCENARIO",
      balls: makeTwoBallScenario(),
    });
    expect(fresh.shotHistory).toHaveLength(0);
    expect(fresh.latestBalls).toHaveLength(0);
    expect(fresh.tipSnapshot).toBeNull();
    expect(fresh.shotsTaken).toBe(0);
  });
});

describe("sidespin (english) round-trips through the reducer", () => {
  test("extractCueParams recovers sidespin from a cueStrike ball", () => {
    const cue = cueStrike([CUE_X, CY], [1, 0], 3.0, 0, 0.6);
    const { sidespin } = extractCueParams(cue);
    expect(sidespin).toBeCloseTo(0.6, 6);
  });

  test("extractCueParams recovers both spin and sidespin when squirt has deflected vel", () => {
    // Regression: cueStrike now deflects vel away from the aim direction (squirt) whenever
    // sidespin != 0, so extractCueParams must undo that rotation before projecting omega
    // back out, or `spin` would come back wrong for any shot that also has sidespin.
    const cue = cueStrike([CUE_X, CY], [1, 0], 3.0, 0.4, 0.6);
    const { spin, sidespin } = extractCueParams(cue);
    expect(spin).toBeCloseTo(0.4, 6);
    expect(sidespin).toBeCloseTo(0.6, 6);
  });

  test("LOAD_SCENARIO extracts cueSidespin from the scenario's cue ball", () => {
    const balls = [
      cueStrike([CUE_X, CY], [1, 0], 3.0, 0, 0.6),
      new BallState([OBJ_X, CY], [0, 0], [0, 0], MotionState.STOPPED, 1),
    ];
    const s = loadScenario(balls);
    expect(s.cueSidespin).toBeCloseTo(0.6, 6);
  });

  test("buildAimedBalls carries cueSidespin into the re-aimed cue ball", () => {
    const s = loadScenario(makeTwoBallScenario());
    const withSidespin: InternalState = { ...s, cueSidespin: 0.7 };
    const aimed = buildAimedBalls(withSidespin);
    expect(aimed[0].spinZ).not.toBe(0);
  });

  test("a scenario shot with sidespin throws the object ball off the no-sidespin outcome", () => {
    // End-to-end regression: LOAD_SCENARIO -> SHOOT must not silently drop sidespin anywhere
    // along the way (a real bug found in recorder.ts's internal deep copy).
    const cutBalls = (sidespin: number): BallState[] => [
      cueStrike([CUE_X, CY], [1, 0], 3.0, 0, sidespin),
      new BallState([OBJ_X, CY + 0.02], [0, 0], [0, 0], MotionState.STOPPED, 1),
    ];

    const thrown = shootOnce(cutBalls(0.8));
    const straight = shootOnce(cutBalls(0));

    const thrownObj = thrown.latestBalls.find((b) => b.number === 1)!;
    const straightObj = straight.latestBalls.find((b) => b.number === 1)!;
    expect(thrownObj.pos[0]).not.toBeCloseTo(straightObj.pos[0], 4);
  });

  // Regression: SET_SPIN used to only touch cueSpin, leaving a scenario-loaded cueSidespin
  // untouched. Adjusting vertical spin (e.g. dragging the cue ball control) after loading a
  // scenario with heavy english would then push spin²+sidespin² past 1 and crash cueStrike's
  // miscue check. SET_TIP_OFFSET must clamp the combined vector instead of throwing.
  test("SET_TIP_OFFSET does not crash when combined with an existing max sidespin", () => {
    const balls = [
      cueStrike([CUE_X, CY], [1, 0], 3.0, 0, 1.0), // scenario loaded with max sidespin
      new BallState([OBJ_X, CY], [0, 0], [0, 0], MotionState.STOPPED, 1),
    ];
    const s = loadScenario(balls);
    expect(s.cueSidespin).toBeCloseTo(1.0, 6);

    expect(() =>
      reducer(s, { type: "SET_TIP_OFFSET", spin: 0.5, sidespin: s.cueSidespin }),
    ).not.toThrow();
  });

  test("SET_TIP_OFFSET clamps the combined vector to the unit disk rather than each axis independently", () => {
    const s = loadScenario(makeTwoBallScenario());
    const next = reducer(s, { type: "SET_TIP_OFFSET", spin: 0.9, sidespin: 0.9 });
    expect(next.cueSpin * next.cueSpin + next.cueSidespin * next.cueSidespin).toBeLessThanOrEqual(1 + 1e-9);
    // Direction (ratio between the two) should be preserved by the clamp.
    expect(next.cueSpin).toBeCloseTo(next.cueSidespin, 6);
  });

  // Regression: spin = 0.8 (no sidespin) puts the cue ball exactly at the natural-roll
  // condition right out of cueStrike (timeSlidingToRolling returns 0, not an error — see
  // motion-models.ts). computeNextEvent used to drop that zero-time transition entirely
  // (`if (t && ...)` treats t=0 as falsy), so the ball got stuck mid-preview and any further
  // aim recompute — e.g. changing the aim direction — threw deep inside cueStrike/predictor
  // code that assumed a "stuck" ball couldn't happen.
  test("setting spin to the natural-roll value then changing aim does not crash", () => {
    let s = loadScenario(makeTwoBallScenario());
    s = reducer(s, { type: "SET_TIP_OFFSET", spin: 0.8, sidespin: 0 });
    expect(() =>
      reducer(s, { type: "AIM_AT_POINT", point: [OBJ_X, CY + 0.05] }),
    ).not.toThrow();
  });
});
