import { BallState, MotionState } from "../ball-state";
import { BALL_RADIUS, G, STANDARD_9_FOOT } from "../constants";
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
