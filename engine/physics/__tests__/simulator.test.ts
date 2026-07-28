import { BallState, MotionState } from "../ball-state";
import { BALL_RADIUS, G, STANDARD_9_FOOT } from "../constants";
import { computeNextEvent } from "../event-prediction";
import { resolveEvent } from "../event-resolution";
import { cueStrike, rollingMotion, slidingMotion } from "../motion-models";
import { SimulationState } from "../simulation-state";
import { advanceState, simulate } from "../simulator";
import { norm, sub } from "../vec2";

function q3(n: number): string {
  return n.toFixed(3);
}

// ── advance_state: base cases ──

test("advance state single sliding ball", () => {
  const ball = new BallState([1.0, 0.7], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);
  const dt = 0.1;
  const exp = slidingMotion(
    new BallState([1.0, 0.7], [2.0, 0.0], [0, 0], MotionState.SLIDING),
    dt,
    G,
  );
  advanceState(state, dt);
  expect(ball.pos[0]).toBeCloseTo(exp.pos[0], 6);
  expect(ball.pos[1]).toBeCloseTo(exp.pos[1], 6);
  expect(ball.vel[0]).toBeCloseTo(exp.vel[0], 6);
  expect(ball.vel[1]).toBeCloseTo(exp.vel[1], 6);
  expect(norm(sub(ball.omega, exp.omega))).toBeLessThan(1e-9);
});

test("advance state single rolling ball", () => {
  const ball = new BallState([1.0, 0.7], [2.0, 0.0], [0, 0], MotionState.ROLLING);
  const state = new SimulationState([ball], 0.0);
  const dt = 0.1;
  const exp = rollingMotion(
    new BallState([1.0, 0.7], [2.0, 0.0], [0, 0], MotionState.ROLLING),
    dt,
    G,
  );
  advanceState(state, dt);
  expect(ball.pos[0]).toBeCloseTo(exp.pos[0], 6);
  expect(ball.pos[1]).toBeCloseTo(exp.pos[1], 6);
  expect(ball.vel[0]).toBeCloseTo(exp.vel[0], 6);
  expect(ball.vel[1]).toBeCloseTo(exp.vel[1], 6);
  expect(norm(sub(ball.omega, exp.omega))).toBeLessThan(1e-9);
});

test("advance state mixed balls", () => {
  const sliding = new BallState([0.5, 0.5], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const rolling = new BallState([1.5, 0.5], [1.0, 0.0], [0, 0], MotionState.ROLLING);
  const state = new SimulationState([sliding, rolling], 0.0);
  const dt = 0.05;
  const expS = slidingMotion(
    new BallState([0.5, 0.5], [2.0, 0.0], [0, 0], MotionState.SLIDING),
    dt,
    G,
  );
  const expR = rollingMotion(
    new BallState([1.5, 0.5], [1.0, 0.0], [0, 0], MotionState.ROLLING),
    dt,
    G,
  );
  advanceState(state, dt);
  expect(sliding.pos[0]).toBeCloseTo(expS.pos[0], 6);
  expect(sliding.pos[1]).toBeCloseTo(expS.pos[1], 6);
  expect(rolling.pos[0]).toBeCloseTo(expR.pos[0], 6);
  expect(rolling.pos[1]).toBeCloseTo(expR.pos[1], 6);
});

// ── advance_state: edge cases ──

test("advance state stopped ball unchanged", () => {
  const ball = new BallState([1.0, 0.7], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const state = new SimulationState([ball], 0.0);
  advanceState(state, 0.1);
  expect(ball.pos[0]).toBe(1.0);
  expect(ball.pos[1]).toBe(0.7);
  expect(ball.vel[0]).toBe(0.0);
  expect(ball.vel[1]).toBe(0.0);
});

test("advance state updates time", () => {
  const ball = new BallState([1.0, 0.7], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const state = new SimulationState([ball], 1.5);
  advanceState(state, 0.3);
  expect(q3(state.time)).toBe("1.800");
});

// ── simulate: base cases ──

test("simulate single ball slides rolls stops", () => {
  const ball = cueStrike([0.5, 0.71], [1, 0], 1.0);
  const state = new SimulationState([ball], 0.0);
  simulate(state, STANDARD_9_FOOT);
  expect(ball.motion).toBe(MotionState.STOPPED);
  expect(norm(ball.vel)).toBeCloseTo(0, 6);
  expect(ball.pos[0]).toBeGreaterThan(0.5);
  expect(ball.pos[0]).toBeLessThan(STANDARD_9_FOOT.width - BALL_RADIUS);
});

test("simulate a shot already at the natural-roll condition (spin = 0.8) does not crash", () => {
  // Regression: spin = 0.8 makes vel/omega satisfy the natural-roll condition exactly right
  // out of cueStrike, so timeSlidingToRolling used to throw here instead of returning 0.
  const ball = cueStrike([0.5, 0.71], [1, 0], 2.0, 0.8);
  const state = new SimulationState([ball], 0.0);
  expect(() => simulate(state, STANDARD_9_FOOT)).not.toThrow();
  expect(ball.motion).toBe(MotionState.STOPPED);
});

test("simulate ball with pure spin and zero velocity starts moving and stops", () => {
  // Regression for the fix to ballAcceleration/slidingMotion: a ball with vel = 0 but
  // omega != 0 used to be treated as fully at rest. It should now translate away from
  // its starting spot purely from spin-driven friction, then settle like any other shot.
  const startPos: [number, number] = [1.42, 0.71];
  const ball = new BallState(startPos, [0, 0], [0, 50], MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);
  simulate(state, STANDARD_9_FOOT);
  expect(ball.motion).toBe(MotionState.STOPPED);
  expect(norm(ball.vel)).toBeCloseTo(0, 6);
  expect(norm(sub(ball.pos, startPos))).toBeGreaterThan(0.01);
});

test("simulate ball hits rail and stops", () => {
  const ball = new BallState([2.5, 0.71], [3.0, 0.0], [0, 0], MotionState.ROLLING);
  const state = new SimulationState([ball], 0.0);
  simulate(state, STANDARD_9_FOOT);
  expect(ball.motion).toBe(MotionState.STOPPED);
  expect(norm(ball.vel)).toBeCloseTo(0, 6);
});

// ── regression: balls escaping near a pocket mouth ──
//
// Direct regression test for the reported bug: a ball skimming through a pocket's mouth
// "gap" at a shallow angle — missing the small capture (fall) circle — used to have nothing
// to bounce off (the engine had no collision geometry for the angled jaw/nose cushions real
// tables use there) and would sail past the table's coordinate bounds forever. This drives
// the event loop itself (mirroring what simulate() does internally) so it can sample the
// ball's position after every step and confirm it never wanders off into open space.

test("regression: ball skimming past a pocket mouth never escapes — it either pots or comes to rest", () => {
  const ball = new BallState(
    [STANDARD_9_FOOT.width - 0.4, BALL_RADIUS + 0.01],
    [4, 0.3],
    [0, 0],
    MotionState.SLIDING,
  );
  const state = new SimulationState([ball], 0.0);
  // Generous slack: the pocket mouth/fall-circle legitimately extends a bit past the
  // table's nominal rectangle (corner fallCenters sit outside it by design).
  const margin = 0.2;
  let outcome: "potted" | "stopped" | "unresolved" = "unresolved";

  for (let step = 0; step < 10000; step++) {
    const event = computeNextEvent(state, STANDARD_9_FOOT);
    if (event === null) break;
    const dt = event.time - state.time;
    if (dt < 0) break;
    advanceState(state, dt);

    if (state.balls.length > 0) {
      const [x, y] = state.balls[0].pos;
      expect(x).toBeGreaterThan(-margin);
      expect(x).toBeLessThan(STANDARD_9_FOOT.width + margin);
      expect(y).toBeGreaterThan(-margin);
      expect(y).toBeLessThan(STANDARD_9_FOOT.height + margin);
    }

    resolveEvent(state, event, STANDARD_9_FOOT);

    if (state.balls.length === 0) {
      outcome = "potted";
      break;
    }
    if (state.balls[0].motion === MotionState.STOPPED) {
      outcome = "stopped";
      break;
    }
  }

  expect(outcome).not.toBe("unresolved");
});

// ── simulate: edge cases ──

test("simulate all stopped immediately", () => {
  const a = new BallState([0.5, 0.5], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const b = new BallState([1.5, 0.5], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const state = new SimulationState([a, b], 0.0);
  simulate(state, STANDARD_9_FOOT);
  expect(state.time).toBe(0.0);
  expect(a.pos[0]).toBe(0.5);
  expect(a.pos[1]).toBe(0.5);
  expect(b.pos[0]).toBe(1.5);
  expect(b.pos[1]).toBe(0.5);
});
