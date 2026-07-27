import { BallState, MotionState } from "../ball-state";
import { G, STANDARD_9_FOOT, BALL_RADIUS, getPockets } from "../constants";
import {
  predictBallBallCollision,
  predictRailCollision,
  predictStateTransition,
  computeNextEvent,
  isInPocketGap,
} from "../event-prediction";
import { cueStrike, slidingMotion } from "../motion-models";
import { SimulationState } from "../simulation-state";
import { norm, sub } from "../vec2";

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
  const ball = new BallState([TABLE.width - 0.5, 0.1], [2, 0], [60, 0], MotionState.SLIDING);
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

// --- isInPocketGap ---

describe("isInPocketGap", () => {
  const pockets = getPockets(TABLE);

  test("ball at top side pocket gap is detected", () => {
    // Ball at center of top rail, at rail collision position
    const pos: [number, number] = [TABLE.width / 2, BALL_RADIUS];
    expect(isInPocketGap(pos, TABLE, pockets)).toBe(true);
  });

  test("ball at bottom side pocket gap is detected", () => {
    const pos: [number, number] = [TABLE.width / 2, TABLE.height - BALL_RADIUS];
    expect(isInPocketGap(pos, TABLE, pockets)).toBe(true);
  });

  test("ball outside side pocket gap is not detected", () => {
    // Ball at rail but away from pocket center
    const pos: [number, number] = [0.5, BALL_RADIUS];
    expect(isInPocketGap(pos, TABLE, pockets)).toBe(false);
  });

  test("ball at corner pocket gap is detected", () => {
    // Near top-left corner
    const pos: [number, number] = [BALL_RADIUS, BALL_RADIUS];
    expect(isInPocketGap(pos, TABLE, pockets)).toBe(true);
  });

  test("ball at corner pocket gap on opposite corner is detected", () => {
    // Near bottom-right corner
    const pos: [number, number] = [TABLE.width - BALL_RADIUS, TABLE.height - BALL_RADIUS];
    expect(isInPocketGap(pos, TABLE, pockets)).toBe(true);
  });

  test("ball mid-rail is not in any pocket gap", () => {
    const pos: [number, number] = [TABLE.width / 4, BALL_RADIUS];
    expect(isInPocketGap(pos, TABLE, pockets)).toBe(false);
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
