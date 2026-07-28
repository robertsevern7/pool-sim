import { BallState, MotionState } from "../ball-state";
import { G, STANDARD_9_FOOT, BALL_RADIUS, getPockets } from "../constants";
import {
  predictBallBallCollision,
  predictRailCollision,
  predictStateTransition,
  computeNextEvent,
} from "../event-prediction";
import { getJawSegments, getRailSegments } from "../jaw-geometry";
import { cueStrike, slidingMotion } from "../motion-models";
import { SimulationState } from "../simulation-state";
import { norm, sub, Vec2 } from "../vec2";

// We need the internal function for position tests — export it or test via predictRailCollision
// Since the Python tests test _predict_rail_collision_position directly, we'll test the public API
// and verify positions indirectly.

function q3(n: number): string {
  return n.toFixed(3);
}

// ── predict_rail_collision: position tests (via the public API's time) ──

test("predict rail roll before collide", () => {
  const cue = cueStrike([0.5, 0.7], [0, 1], 2.0);
  expect(predictRailCollision(cue, STANDARD_9_FOOT)).toBeNull();
});

test("predict rail collision top", () => {
  const cue = cueStrike([0.5, 0.7], [0, 1], 3.0);
  const t = predictRailCollision(cue, STANDARD_9_FOOT);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("0.251");
});

test("predict rail collision top start rolling", () => {
  const cue = cueStrike([0.5, 0.7], [0, 1], 3.0);
  cue.motion = MotionState.ROLLING;
  const t = predictRailCollision(cue, STANDARD_9_FOOT);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("0.233");
});

test("predict rail collision top rolling slower", () => {
  const cue = cueStrike([0.5, 0.7], [0, 1], 2.0);
  cue.motion = MotionState.ROLLING;
  const t = predictRailCollision(cue, STANDARD_9_FOOT);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("0.355");
});

test("predict rail collision at angle", () => {
  const cue = cueStrike([0.5, 0.7], [-1, -1], 2.0);
  cue.motion = MotionState.ROLLING;
  const t = predictRailCollision(cue, STANDARD_9_FOOT);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("0.342");
});

// ── state transitions ──

test("state change slide to roll detection", () => {
  const cue = cueStrike([0.5, 0.7], [1, 1], 2.0);
  const t = predictStateTransition(cue);
  expect(t).not.toBeNull();
  // Note: Python test uses 0.251 which is time_sliding_to_rolling for speed=2 angled
  // speed = 2.0, |vel| = 2.0 (after cue_strike normalization), so same as straight
  // Actually for angled [1,1] with speed=2.0, the velocity magnitude is 2.0
  // timeSlidingToRolling: slip = |2.0 - 0.028575*0| = 2.0
  // t = 2*2.0 / (7*0.20*9.81) = 4/13.734 = 0.2913 → but Python says 0.251
  // Wait, let me reconsider. The Python test_state_change_slide_to_roll_detection
  // with direction=[1,1] speed=2.0 gets 0.251? Let me check...
  // Actually the Python file has TWO functions with the same name. The first one
  // at line 181-188 tests sliding→rolling and expects 0.251
  // This seems wrong — for speed=2.0 stun, t = 0.291. For angled, speed is still 2.0.
  // But Python cue_strike normalizes [1,1], so |vel| = 2.0. Hmm.
  // Actually wait: in Python the duplicate function at line 191 overwrites the first.
  // So effectively only the second one (rolling→stopped, expects 6.796) runs.
  // The first test (expects 0.251) is dead code due to duplicate name.
  // Let's just test what we know is correct:
  expect(q3(t!)).toBe("0.291");
});

test("state change roll to stop detection", () => {
  const cue = cueStrike([0.5, 0.7], [1, 1], 2.0);
  cue.motion = MotionState.ROLLING;
  const t = predictStateTransition(cue);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("6.796");
});

test("state change when stopped detection", () => {
  const cue = new BallState([0.5, 0.7], [0, 0], [0, 0], MotionState.STOPPED);
  expect(predictStateTransition(cue)).toBeNull();
});

// ── predict_ball_ball_collision: base cases ──

test("ball ball collision moving hits stationary", () => {
  const a = new BallState([0.0, 0.0], [5.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.2, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const t = predictBallBallCollision(a, b, G);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("0.029");
});

test("ball ball collision moving away no collision", () => {
  const a = new BallState([0.5, 0.0], [-2.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([1.0, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  expect(predictBallBallCollision(a, b, G)).toBeNull();
});

// ── predict_ball_ball_collision: edge cases ──

test("ball ball collision both stopped", () => {
  const a = new BallState([0.0, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const b = new BallState([1.0, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  expect(predictBallBallCollision(a, b, G)).toBeNull();
});

test("ball ball collision parallel same speed", () => {
  const a = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.0, 0.2], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  expect(predictBallBallCollision(a, b, G)).toBeNull();
});

// ── predict_ball_ball_collision: self-consistency ──

test("ball ball collision distance equals 2r at collision", () => {
  const a = new BallState([0.0, 0.0], [5.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.2, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const t = predictBallBallCollision(a, b, G)!;
  expect(t).not.toBeNull();

  const { pos: posA } = slidingMotion(a, t, G);
  const dist = norm(sub(posA, b.pos));
  expect(q3(dist)).toBe(q3(2 * BALL_RADIUS));
});

// ── predict_ball_ball_collision: additional base cases ──

test("ball ball collision head on", () => {
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.5, 0.0], [-3.0, 0.0], [0, 0], MotionState.SLIDING);
  const t = predictBallBallCollision(a, b, G);
  expect(t).not.toBeNull();
  expect(t!).toBeLessThan(0.1);
});

test("ball ball collision overtaking", () => {
  const a = new BallState([0.0, 0.0], [5.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.2, 0.0], [1.0, 0.0], [0, 0], MotionState.SLIDING);
  const t = predictBallBallCollision(a, b, G);
  expect(t).not.toBeNull();
  expect(t!).toBeLessThan(0.1);
});

test("ball ball collision slow ball stops before reaching", () => {
  const a = new BallState([0.0, 0.0], [0.1, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([5.0, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  expect(predictBallBallCollision(a, b, G)).toBeNull();
});

// ── compute_next_event ──

test("compute next event single sliding ball state change", () => {
  const ball = cueStrike([1.42, 0.71], [1, 0], 2.0);
  const state = new SimulationState([ball], 0.0);
  const event = computeNextEvent(state, STANDARD_9_FOOT);
  expect(event).not.toBeNull();
  expect(event!.eventType).toBe("STATE_CHANGE");
  expect(event!.a).toBe(0);
});

test("compute next event single rolling ball hits rail", () => {
  const ball = new BallState([2.5, 0.71], [3.0, 0.0], [0, 0], MotionState.ROLLING);
  const state = new SimulationState([ball], 0.0);
  const event = computeNextEvent(state, STANDARD_9_FOOT);
  expect(event).not.toBeNull();
  expect(event!.eventType).toBe("RAIL_COLLISION");
  expect(event!.a).toBe(0);
});

test("compute next event ball collision first", () => {
  const a = new BallState([0.5, 0.5], [5.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.7, 0.5], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const state = new SimulationState([a, b], 0.0);
  const event = computeNextEvent(state, STANDARD_9_FOOT);
  expect(event).not.toBeNull();
  expect(event!.eventType).toBe("BALL_COLLISION");
  expect(event!.a).toBe(0);
  expect(event!.b).toBe(1);
});

test("compute next event all stopped", () => {
  const a = new BallState([0.5, 0.5], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const b = new BallState([1.0, 0.5], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const state = new SimulationState([a, b], 0.0);
  expect(computeNextEvent(state, STANDARD_9_FOOT)).toBeNull();
});

test("compute next event finds a zero-time state transition (falsy-zero regression)", () => {
  // Regression: `if (t && ...)` treats a legitimate t=0 (this ball is already exactly at
  // the natural-roll condition, see timeSlidingToRolling) as "no event", since 0 is falsy
  // in JS — computeNextEvent must use `t !== null` instead, or the event is silently
  // dropped and the ball gets stuck in SLIDING forever.
  const cue = cueStrike([0.5, 0.71], [1, 0], 2.0, 0.8);
  const state = new SimulationState([cue], 0.0);
  const event = computeNextEvent(state, STANDARD_9_FOOT);
  expect(event).not.toBeNull();
  expect(event!.eventType).toBe("STATE_CHANGE");
  expect(event!.time).toBe(0);
});

// ── pocket detection ──

const TABLE = STANDARD_9_FOOT;
const pockets = getPockets(TABLE);

test("ball rolling into corner pocket is detected as pocket event", () => {
  // Ball near top-right corner, rolling toward the pocket at (w, 0)
  const ball = new BallState(
    [TABLE.width - 0.2, 0.2],
    [2.0, -2.0],
    [0, 0],
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event = computeNextEvent(state, TABLE);
  expect(event).not.toBeNull();
  expect(event!.eventType).toBe("POCKET");
  expect(event!.a).toBe(0);
});

test("ball rolling into side pocket is detected as pocket event", () => {
  // Ball near top side pocket at (w/2, 0), rolling straight toward it
  const ball = new BallState(
    [TABLE.width / 2, 0.3],
    [0.0, -3.0],
    [0, 0],
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event = computeNextEvent(state, TABLE);
  expect(event).not.toBeNull();
  expect(event!.eventType).toBe("POCKET");
  expect(event!.a).toBe(0);
});

test("ball rolling away from pocket does not trigger pocket event", () => {
  // Ball in the middle of the table rolling away from all pockets
  const ball = new BallState(
    [TABLE.width / 2, TABLE.height / 2],
    [-2.0, 0.0],
    [0, 0],
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event = computeNextEvent(state, TABLE);
  expect(event).not.toBeNull();
  // Should be state change or rail, not pocket
  expect(event!.eventType).not.toBe("POCKET");
});

test("ball rolling along rail near pocket does not bounce off rail in pocket zone", () => {
  // Ball heading toward corner pocket at speed — should NOT get a rail collision
  const ball = new BallState(
    [TABLE.width - 0.3, BALL_RADIUS],
    [5.0, 0.0],
    [0, 0],
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event = computeNextEvent(state, TABLE);
  expect(event).not.toBeNull();
  // Should be pocket, not rail collision
  expect(event!.eventType).toBe("POCKET");
});

// ── pocket entry: curved (sliding) trajectory ──
//
// Regression coverage for the fix to predictPocketEntry: it used to ray-cast in a
// straight line along the ball's current velocity direction, which ignores the curving a
// sliding ball undergoes when its spin isn't aligned with vel (see slidingMotion in
// motion-models.ts, and ballAcceleration's slip-velocity direction). These tests set up a
// ball whose velocity alone (a straight line at constant y) would pass just outside a
// corner pocket's fall circle, but whose spin curves it inward until it actually crosses
// the circle — the case a straight-line ray cast gets wrong.

test("spinning slide curves into a pocket a straight-line prediction would miss", () => {
  const pocket = getPockets(TABLE)[1]; // top-right corner
  // Spin bumped from the original 60 to 120: the pocket-mouth jaw geometry was corrected to
  // match components/Cushions.tsx's actual rendered nose position (see heelAlongRail in
  // constants.ts) rather than an independently-derived, slightly-too-long approximation —
  // that moved the jaw/straight-rail boundary a few centimeters closer to the pocket, so this
  // trajectory needs a bit more curve to still reach the fall circle before the rail.
  const ball = new BallState([TABLE.width - 0.5, 0.1], [2, 0], [120, 0], MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);

  const event = computeNextEvent(state, TABLE);
  expect(event).not.toBeNull();
  expect(event!.eventType).toBe("POCKET");
  expect(event!.b).toBe(1);

  // Self-consistency: the ball's actual position at the predicted time (via the same
  // constant-acceleration sliding motion the simulator advances by) sits on the fall circle.
  const { pos } = slidingMotion(ball, event!.time - state.time, G);
  const dx = pos[0] - pocket.fallCenter[0];
  const dy = pos[1] - pocket.fallCenter[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  expect(q3(dist)).toBe(q3(pocket.fallRadius));
});

test("same shot without spin does not pocket — travels in a straight line and misses", () => {
  // Same position/velocity as above, but zero spin: vel alone points straight along y=0.1,
  // which stays outside the corner pocket's fall circle (offset 0.1635 > radius 0.1143).
  const ball = new BallState([TABLE.width - 0.5, 0.1], [2, 0], [0, 0], MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);

  const event = computeNextEvent(state, TABLE);
  expect(event).not.toBeNull();
  expect(event!.eventType).not.toBe("POCKET");
});

// ── jaw (pocket nose) collision ──
//
// Regression coverage for the bug where a ball skimming through a pocket's mouth "gap" at
// a shallow angle — missing the small capture (fall) circle — had nothing to bounce off,
// since the physics engine had no collision geometry for the angled jaw/nose cushions real
// tables use to bridge the straight rail to the pocket opening. It would sail past the
// table's coordinate bounds and never trigger another event. These tests confirm the jaw
// segments (jaw-geometry.ts) are now live collision surfaces.

describe("jaw collision", () => {
  test("ball skimming past a corner pocket mouth at a shallow angle now bounces off the jaw instead of escaping", () => {
    // Aimed to miss the top-right corner pocket's fall circle by drifting upward (+y) too
    // early — under the old rectangular-gap model this trajectory found no collision at all
    // once past the straight rail's suppressed zone near the corner.
    const ball = new BallState(
      [TABLE.width - 0.4, BALL_RADIUS + 0.01],
      [4, 0.3],
      [0, 0],
      MotionState.SLIDING,
    );
    const state = new SimulationState([ball], 0.0);
    const event = computeNextEvent(state, TABLE);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("RAIL_COLLISION");
    expect(event!.normal).toBeDefined();
    expect(norm(event!.normal!)).toBeCloseTo(1, 6);

    // The ball's actual position at the predicted time lies on the jaw segment responsible
    // (within the segment's finite extent, not off the end of an infinite line).
    const { pos } = slidingMotion(ball, event!.time, G);
    const segs = getJawSegments(TABLE);
    const onSomeSegment = segs.some((seg) => {
      const segVec = sub(seg.p2, seg.p1);
      const segLen = norm(segVec);
      const segDir: Vec2 = [segVec[0] / segLen, segVec[1] / segLen];
      const s = (pos[0] - seg.p1[0]) * segDir[0] + (pos[1] - seg.p1[1]) * segDir[1];
      return s >= -1e-3 && s <= segLen + 1e-3;
    });
    expect(onSomeSegment).toBe(true);
  });

  test("ball aimed squarely at a corner jaw face bounces off it", () => {
    const segs = getJawSegments(TABLE);
    // Top-right corner's top-rail nose (p1 sits on the y = BALL_RADIUS rail line).
    const seg = segs.find((s) => s.pocketIndex === 1 && Math.abs(s.p1[1] - BALL_RADIUS) < 1e-6)!;
    const mid: Vec2 = [(seg.p1[0] + seg.p2[0]) / 2, (seg.p1[1] + seg.p2[1]) / 2];
    const start: Vec2 = [mid[0] + seg.normal[0] * 0.05, mid[1] + seg.normal[1] * 0.05];
    const vel: Vec2 = [-seg.normal[0] * 2, -seg.normal[1] * 2];

    const ball = new BallState(start, vel, [0, 0], MotionState.SLIDING);
    const state = new SimulationState([ball], 0.0);
    const event = computeNextEvent(state, TABLE);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("RAIL_COLLISION");
    expect(event!.normal).toBeDefined();
    expect(event!.normal![0]).toBeCloseTo(seg.normal[0], 5);
    expect(event!.normal![1]).toBeCloseTo(seg.normal[1], 5);
  });

  test("ball aimed squarely at a side pocket jaw face bounces off it", () => {
    const segs = getJawSegments(TABLE);
    const pockets = getPockets(TABLE);
    const seg = segs.find((s) => pockets[s.pocketIndex].type === "side")!;
    const mid: Vec2 = [(seg.p1[0] + seg.p2[0]) / 2, (seg.p1[1] + seg.p2[1]) / 2];
    const start: Vec2 = [mid[0] + seg.normal[0] * 0.05, mid[1] + seg.normal[1] * 0.05];
    const vel: Vec2 = [-seg.normal[0] * 2, -seg.normal[1] * 2];

    const ball = new BallState(start, vel, [0, 0], MotionState.SLIDING);
    const state = new SimulationState([ball], 0.0);
    const event = computeNextEvent(state, TABLE);

    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("RAIL_COLLISION");
    expect(event!.normal).toBeDefined();
    expect(event!.normal![0]).toBeCloseTo(seg.normal[0], 5);
    expect(event!.normal![1]).toBeCloseTo(seg.normal[1], 5);
  });

  test("ball rolling into corner pocket still pots cleanly (jaw detection doesn't steal a clean shot)", () => {
    const ball = new BallState([TABLE.width - 0.2, 0.2], [2.0, -2.0], [0, 0], MotionState.ROLLING);
    const state = new SimulationState([ball], 0.0);
    const event = computeNextEvent(state, TABLE);
    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("POCKET");
  });

  test("ball rolling into side pocket still pots cleanly (jaw detection doesn't steal a clean shot)", () => {
    const ball = new BallState([TABLE.width / 2, 0.3], [0.0, -3.0], [0, 0], MotionState.ROLLING);
    const state = new SimulationState([ball], 0.0);
    const event = computeNextEvent(state, TABLE);
    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("POCKET");
  });
});

// --- rail vs jaw segment boundary (bounded rail segments — no isInPocketGap special case) ---
//
// The straight rail is no longer an infinite line with a "point is in the pocket gap"
// exclusion check bolted on — it's a bounded CushionSegment per rail piece (getRailSegments),
// exactly like a jaw nose. A position is "in the gap" (jaw territory, not plain-rail
// territory) simply when it falls outside every rail segment's own range.

function inPlainRailRange(pos: [number, number], table = TABLE): boolean {
  return getRailSegments(table).some((seg) => {
    const fixedAxis: 0 | 1 = seg.p1[0] === seg.p2[0] ? 0 : 1;
    if (Math.abs(pos[fixedAxis] - seg.p1[fixedAxis]) > 1e-4) return false;
    const freeAxis: 0 | 1 = fixedAxis === 0 ? 1 : 0;
    const lo = Math.min(seg.p1[freeAxis], seg.p2[freeAxis]);
    const hi = Math.max(seg.p1[freeAxis], seg.p2[freeAxis]);
    return pos[freeAxis] >= lo - 1e-6 && pos[freeAxis] <= hi + 1e-6;
  });
}

describe("rail vs jaw segment boundary", () => {
  const pockets = getPockets(TABLE);

  test("top side pocket gap position is outside the plain rail's range", () => {
    const pos: [number, number] = [TABLE.width / 2, BALL_RADIUS];
    expect(inPlainRailRange(pos)).toBe(false);
  });

  test("bottom side pocket gap position is outside the plain rail's range", () => {
    const pos: [number, number] = [TABLE.width / 2, TABLE.height - BALL_RADIUS];
    expect(inPlainRailRange(pos)).toBe(false);
  });

  test("position away from any pocket is within the plain rail's range", () => {
    const pos: [number, number] = [0.5, BALL_RADIUS];
    expect(inPlainRailRange(pos)).toBe(true);
  });

  test("corner pocket gap position is outside the plain rail's range", () => {
    const pos: [number, number] = [BALL_RADIUS, BALL_RADIUS];
    expect(inPlainRailRange(pos)).toBe(false);
  });

  test("opposite corner pocket gap position is outside the plain rail's range", () => {
    const pos: [number, number] = [TABLE.width - BALL_RADIUS, TABLE.height - BALL_RADIUS];
    expect(inPlainRailRange(pos)).toBe(false);
  });

  test("mid-rail position is within the plain rail's range", () => {
    const pos: [number, number] = [TABLE.width / 4, BALL_RADIUS];
    expect(inPlainRailRange(pos)).toBe(true);
  });

  // Heel-precise boundary: the straight rail segment's endpoint is exactly the jaw's heel
  // (see jaw-geometry.ts/getRailSegments) — pin down that exact cutoff.
  test("position 1mm on the table-interior side of a corner heel is within the plain rail's range", () => {
    const segs = getJawSegments(TABLE);
    const seg = segs.find((s) => s.pocketIndex === 1 && Math.abs(s.p1[1] - BALL_RADIUS) < 1e-6)!;
    const pos: [number, number] = [seg.p1[0] - 0.001, seg.p1[1]];
    expect(inPlainRailRange(pos)).toBe(true);
  });

  test("position 1mm on the pocket side of a corner heel is outside the plain rail's range", () => {
    const segs = getJawSegments(TABLE);
    const seg = segs.find((s) => s.pocketIndex === 1 && Math.abs(s.p1[1] - BALL_RADIUS) < 1e-6)!;
    const pos: [number, number] = [seg.p1[0] + 0.001, seg.p1[1]];
    expect(inPlainRailRange(pos)).toBe(false);
  });

  test("position 1mm on the table-interior side of a side pocket heel is within the plain rail's range", () => {
    const segs = getJawSegments(TABLE);
    const seg = segs.find((s) => pockets[s.pocketIndex].type === "side" && s.p1[0] < TABLE.width / 2)!;
    const pos: [number, number] = [seg.p1[0] - 0.001, seg.p1[1]];
    expect(inPlainRailRange(pos)).toBe(true);
  });

  test("position 1mm on the pocket side of a side pocket heel is outside the plain rail's range", () => {
    const segs = getJawSegments(TABLE);
    const seg = segs.find((s) => pockets[s.pocketIndex].type === "side" && s.p1[0] < TABLE.width / 2)!;
    const pos: [number, number] = [seg.p1[0] + 0.001, seg.p1[1]];
    expect(inPlainRailRange(pos)).toBe(false);
  });

  // Direct regression test for the bug found via user report: a ball shot straight down
  // the table close to a corner (inside the jaw's reach along the rail) must register as a
  // jaw hit, not silently pass through where the plain rail would have been.
  test("ball shot straight down near a corner registers a jaw hit, not nothing", () => {
    const screenXPos = TABLE.height / 15;
    const startX = BALL_RADIUS + 0.05;
    const ball = new BallState([startX, screenXPos], [3, 0], [0, 0], MotionState.ROLLING);
    const state = new SimulationState([ball], 0.0);
    const event = computeNextEvent(state, TABLE);
    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("RAIL_COLLISION");
    expect(event!.normal).toBeDefined();
    // A jaw normal is diagonal, not one of the 4 axis-aligned rail normals.
    const isAxisAligned =
      (Math.abs(event!.normal![0]) < 1e-6 || Math.abs(event!.normal![1]) < 1e-6);
    expect(isAxisAligned).toBe(false);
  });
});

// --- getPockets ---

describe("getPockets", () => {
  const pockets = getPockets(TABLE);

  test("returns 6 pockets", () => {
    expect(pockets).toHaveLength(6);
  });

  test("4 corner pockets and 2 side pockets", () => {
    expect(pockets.filter(p => p.type === "corner")).toHaveLength(4);
    expect(pockets.filter(p => p.type === "side")).toHaveLength(2);
  });

  test("all fallRadius values are positive", () => {
    for (const p of pockets) {
      expect(p.fallRadius).toBeGreaterThan(0);
    }
  });

  test("all mouthWidth values are positive", () => {
    for (const p of pockets) {
      expect(p.mouthWidth).toBeGreaterThan(0);
    }
  });

  test("all backRadius values are positive", () => {
    for (const p of pockets) {
      expect(p.backRadius).toBeGreaterThan(0);
    }
  });

  test("side pocket fallCenter is behind the rail", () => {
    const sidePockets = pockets.filter(p => p.type === "side");
    // Top rail pocket: fallCenter y should be negative
    expect(sidePockets[0].fallCenter[1]).toBeLessThan(0);
    // Bottom rail pocket: fallCenter y should be beyond table height
    expect(sidePockets[1].fallCenter[1]).toBeGreaterThan(TABLE.height);
  });

  test("corner pocket fallCenter is offset from corner", () => {
    // Top-left corner: both x and y should be negative
    expect(pockets[0].fallCenter[0]).toBeLessThan(0);
    expect(pockets[0].fallCenter[1]).toBeLessThan(0);
    // Bottom-right corner: both beyond table dimensions
    expect(pockets[3].fallCenter[0]).toBeGreaterThan(TABLE.width);
    expect(pockets[3].fallCenter[1]).toBeGreaterThan(TABLE.height);
  });
});
