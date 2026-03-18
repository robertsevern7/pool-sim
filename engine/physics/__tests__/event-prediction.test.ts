import { BallState, MotionState } from "../ball-state";
import { G, STANDARD_9_FOOT, BALL_RADIUS, getPockets } from "../constants";
import {
  predictBallBallCollision,
  predictRailCollision,
  predictStateTransition,
  computeNextEvent,
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
  const cue = new BallState([0.5, 0.7], [0, 0], 0.0, MotionState.STOPPED);
  expect(predictStateTransition(cue)).toBeNull();
});

// ── predict_ball_ball_collision: base cases ──

test("ball ball collision moving hits stationary", () => {
  const a = new BallState([0.0, 0.0], [5.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.2, 0.0], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const t = predictBallBallCollision(a, b, G);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("0.029");
});

test("ball ball collision moving away no collision", () => {
  const a = new BallState([0.5, 0.0], [-2.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([1.0, 0.0], [0.0, 0.0], 0.0, MotionState.STOPPED);
  expect(predictBallBallCollision(a, b, G)).toBeNull();
});

// ── predict_ball_ball_collision: edge cases ──

test("ball ball collision both stopped", () => {
  const a = new BallState([0.0, 0.0], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const b = new BallState([1.0, 0.0], [0.0, 0.0], 0.0, MotionState.STOPPED);
  expect(predictBallBallCollision(a, b, G)).toBeNull();
});

test("ball ball collision parallel same speed", () => {
  const a = new BallState([0.0, 0.0], [2.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.0, 0.2], [2.0, 0.0], 0.0, MotionState.SLIDING);
  expect(predictBallBallCollision(a, b, G)).toBeNull();
});

// ── predict_ball_ball_collision: self-consistency ──

test("ball ball collision distance equals 2r at collision", () => {
  const a = new BallState([0.0, 0.0], [5.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.2, 0.0], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const t = predictBallBallCollision(a, b, G)!;
  expect(t).not.toBeNull();

  const { pos: posA } = slidingMotion(a, t, G);
  const dist = norm(sub(posA, b.pos));
  expect(q3(dist)).toBe(q3(2 * BALL_RADIUS));
});

// ── predict_ball_ball_collision: additional base cases ──

test("ball ball collision head on", () => {
  const a = new BallState([0.0, 0.0], [3.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.5, 0.0], [-3.0, 0.0], 0.0, MotionState.SLIDING);
  const t = predictBallBallCollision(a, b, G);
  expect(t).not.toBeNull();
  expect(t!).toBeLessThan(0.1);
});

test("ball ball collision overtaking", () => {
  const a = new BallState([0.0, 0.0], [5.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.2, 0.0], [1.0, 0.0], 0.0, MotionState.SLIDING);
  const t = predictBallBallCollision(a, b, G);
  expect(t).not.toBeNull();
  expect(t!).toBeLessThan(0.1);
});

test("ball ball collision slow ball stops before reaching", () => {
  const a = new BallState([0.0, 0.0], [0.1, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([5.0, 0.0], [0.0, 0.0], 0.0, MotionState.STOPPED);
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
  const ball = new BallState([2.5, 0.71], [3.0, 0.0], 0.0, MotionState.ROLLING);
  const state = new SimulationState([ball], 0.0);
  const event = computeNextEvent(state, STANDARD_9_FOOT);
  expect(event).not.toBeNull();
  expect(event!.eventType).toBe("RAIL_COLLISION");
  expect(event!.a).toBe(0);
});

test("compute next event ball collision first", () => {
  const a = new BallState([0.5, 0.5], [5.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.7, 0.5], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const state = new SimulationState([a, b], 0.0);
  const event = computeNextEvent(state, STANDARD_9_FOOT);
  expect(event).not.toBeNull();
  expect(event!.eventType).toBe("BALL_COLLISION");
  expect(event!.a).toBe(0);
  expect(event!.b).toBe(1);
});

test("compute next event all stopped", () => {
  const a = new BallState([0.5, 0.5], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const b = new BallState([1.0, 0.5], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const state = new SimulationState([a, b], 0.0);
  expect(computeNextEvent(state, STANDARD_9_FOOT)).toBeNull();
});

// ── pocket detection ──

const TABLE = STANDARD_9_FOOT;
const pockets = getPockets(TABLE);

test("ball rolling into corner pocket is detected as pocket event", () => {
  // Ball near top-right corner, rolling toward the pocket at (w, 0)
  const ball = new BallState(
    [TABLE.width - 0.2, 0.2],
    [2.0, -2.0],
    0.0,
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
    0.0,
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
    0.0,
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event = computeNextEvent(state, TABLE);
  expect(event).not.toBeNull();
  // Should be state change or rail, not pocket
  expect(event!.eventType).not.toBe("POCKET");
});

test("ball rolling along rail near pocket does not bounce off rail in pocket zone", () => {
  // Ball heading toward corner pocket — should NOT get a rail collision
  const ball = new BallState(
    [TABLE.width - 0.3, BALL_RADIUS],
    [3.0, 0.0],
    0.0,
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event = computeNextEvent(state, TABLE);
  expect(event).not.toBeNull();
  // Should be pocket, not rail collision
  expect(event!.eventType).toBe("POCKET");
});
