import { BallState, MotionState } from "../ball-state";
import { BALL_RADIUS, RAIL_RESTITUTION, STANDARD_9_FOOT } from "../constants";
import { resolveEvent } from "../event-resolution";
import type { Event } from "../event-prediction";
import { SimulationState } from "../simulation-state";
import { dot, norm, sub, scale, add } from "../vec2";

function q3(n: number): string {
  return n.toFixed(3);
}

// Helper to resolve ball collision directly (since it's not exported, we go through resolveEvent)
function resolveBallCollision(a: BallState, b: BallState) {
  const state = new SimulationState([a, b], 0.0);
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);
}

function resolveRailCollision(ball: BallState, normalVec: [number, number]) {
  // Position the ball at the appropriate wall edge so resolveEvent picks the right normal
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
}

// ── resolve_ball_collision: base cases ──

test("resolve ball collision head on equal speed", () => {
  const a = new BallState([0.0, 0.0], [2.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [-2.0, 0.0], 0.0, MotionState.SLIDING);
  resolveBallCollision(a, b);
  expect(q3(a.vel[0])).toBe("-2.000");
  expect(q3(a.vel[1])).toBe("0.000");
  expect(q3(b.vel[0])).toBe("2.000");
  expect(q3(b.vel[1])).toBe("0.000");
});

test("resolve ball collision moving hits stationary", () => {
  const a = new BallState([0.0, 0.0], [3.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [0.0, 0.0], 0.0, MotionState.STOPPED);
  resolveBallCollision(a, b);
  expect(q3(a.vel[0])).toBe("0.000");
  expect(q3(a.vel[1])).toBe("0.000");
  expect(q3(b.vel[0])).toBe("3.000");
  expect(q3(b.vel[1])).toBe("0.000");
});

test("resolve ball collision topspin re-accelerates cue ball", () => {
  const omegaInitial = 50.0;
  const a = new BallState([0.0, 0.0], [3.0, 0.0], omegaInitial, MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [0.0, 0.0], 0.0, MotionState.STOPPED);
  resolveBallCollision(a, b);
  expect(q3(a.vel[0])).toBe("0.000");
  expect(a.omega).toBe(omegaInitial);
  expect(a.motion).toBe(MotionState.SLIDING);
});

test("resolve ball collision stun shot follows tangent line", () => {
  const r = BALL_RADIUS;
  const s2 = Math.sqrt(2);
  const a = new BallState([0.0, 0.0], [3.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([r * s2, r * s2] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED);
  resolveBallCollision(a, b);
  // A's velocity should be perpendicular to collision normal
  const n = sub(a.pos, b.pos);
  const nLen = norm(n);
  const nHat = scale(n, 1 / nLen);
  expect(Math.abs(dot(a.vel, nHat))).toBeLessThan(1e-10);
  expect(q3(a.vel[0])).toBe("1.500");
  expect(q3(a.vel[1])).toBe("-1.500");
});

// ── resolve_ball_collision: edge cases ──

test("resolve ball collision separating no change", () => {
  const a = new BallState([0.0, 0.0], [-1.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [1.0, 0.0], 0.0, MotionState.SLIDING);
  const velABefore: [number, number] = [...a.vel];
  const velBBefore: [number, number] = [...b.vel];
  resolveBallCollision(a, b);
  expect(a.vel[0]).toBe(velABefore[0]);
  expect(a.vel[1]).toBe(velABefore[1]);
  expect(b.vel[0]).toBe(velBBefore[0]);
  expect(b.vel[1]).toBe(velBBefore[1]);
});

test("resolve ball collision sets motion states", () => {
  const a = new BallState([0.0, 0.0], [3.0, 0.0], 0.0, MotionState.ROLLING);
  const b = new BallState([0.05715, 0.0], [0.0, 0.0], 0.0, MotionState.STOPPED);
  resolveBallCollision(a, b);
  expect(a.motion).toBe(MotionState.STOPPED);
  expect(b.motion).toBe(MotionState.SLIDING);
});

// ── resolve_ball_collision: self-consistency ──

test("resolve ball collision momentum conserved", () => {
  const a = new BallState([0.0, 0.0], [3.0, 1.0], 0.0, MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [-1.0, 0.5], 0.0, MotionState.SLIDING);
  const pBefore = add(scale(a.vel, a.mass), scale(b.vel, b.mass));
  resolveBallCollision(a, b);
  const pAfter = add(scale(a.vel, a.mass), scale(b.vel, b.mass));
  expect(q3(pAfter[0])).toBe(q3(pBefore[0]));
  expect(q3(pAfter[1])).toBe(q3(pBefore[1]));
});

// ── resolve_rail_collision: base cases ──

test("resolve rail collision perpendicular", () => {
  // Ball at right wall
  const ball = new BallState(
    [STANDARD_9_FOOT.width - BALL_RADIUS, 0.7],
    [3.0, 0.0],
    0.0,
    MotionState.SLIDING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("-2.460");
  expect(q3(ball.vel[1])).toBe("0.000");
});

test("resolve rail collision angled", () => {
  // Ball at top wall
  const ball = new BallState(
    [0.5, STANDARD_9_FOOT.height - BALL_RADIUS],
    [2.0, 2.0],
    0.0,
    MotionState.SLIDING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("2.000");
  expect(q3(ball.vel[1])).toBe("-1.640");
});

test("resolve rail collision sets sliding", () => {
  const ball = new BallState(
    [STANDARD_9_FOOT.width - BALL_RADIUS, 0.7],
    [3.0, 0.0],
    0.0,
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(ball.motion).toBe(MotionState.SLIDING);
});

// ── resolve_event: state changes ──

test("resolve event state change sliding to rolling", () => {
  const ball = new BallState([1.0, 0.7], [2.0, 0.0], 0.0, MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "STATE_CHANGE", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(ball.motion).toBe(MotionState.ROLLING);
});

test("resolve event state change rolling to stopped", () => {
  const ball = new BallState([1.0, 0.7], [0.5, 0.0], 0.0, MotionState.ROLLING);
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "STATE_CHANGE", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(ball.motion).toBe(MotionState.STOPPED);
  expect(ball.vel[0]).toBe(0.0);
  expect(ball.vel[1]).toBe(0.0);
});

// ── resolve_event: rail collisions ──

test("resolve event rail collision right wall", () => {
  const ball = new BallState(
    [STANDARD_9_FOOT.width - BALL_RADIUS, 0.7],
    [3.0, 0.0],
    0.0,
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("-2.460");
  expect(q3(ball.vel[1])).toBe("0.000");
  expect(ball.motion).toBe(MotionState.SLIDING);
});

test("resolve event ball collision", () => {
  const a = new BallState([0.0, 0.0], [3.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([2 * BALL_RADIUS, 0.0] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const state = new SimulationState([a, b], 0.0);
  const event: Event = { time: 0.1, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(a.vel[0])).toBe("0.000");
  expect(q3(b.vel[0])).toBe("3.000");
});

test("resolve event rail collision left wall", () => {
  const ball = new BallState([BALL_RADIUS, 0.7], [-3.0, 0.0], 0.0, MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("2.460");
  expect(q3(ball.vel[1])).toBe("0.000");
});

test("resolve event rail collision bottom wall", () => {
  const ball = new BallState([1.0, BALL_RADIUS], [0.0, -3.0], 0.0, MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("0.000");
  expect(q3(ball.vel[1])).toBe("2.460");
});

// ── contact chain resolution ──

const D = 2 * BALL_RADIUS; // center-to-center distance for touching balls

test("chain resolution: three balls in a line", () => {
  // A hits B which is touching C, all in a line along x-axis
  const a = new BallState([0.0, 0.0], [3.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([D, 0.0] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const c = new BallState([D * 2, 0.0] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const state = new SimulationState([a, b, c], 0.0);
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);

  // Energy should propagate through: A stops, B stops, C gets the velocity
  expect(q3(a.vel[0])).toBe("0.000");
  expect(q3(b.vel[0])).toBe("0.000");
  expect(q3(c.vel[0])).toBe("3.000");
});

test("chain resolution: momentum conserved through chain", () => {
  const a = new BallState([0.0, 0.0], [4.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([D, 0.0] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const c = new BallState([D * 2, 0.0] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const state = new SimulationState([a, b, c], 0.0);
  const pBefore = add(scale(a.vel, a.mass), add(scale(b.vel, b.mass), scale(c.vel, c.mass)));
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);
  const pAfter = add(scale(a.vel, a.mass), add(scale(b.vel, b.mass), scale(c.vel, c.mass)));
  expect(q3(pAfter[0])).toBe(q3(pBefore[0]));
  expect(q3(pAfter[1])).toBe(q3(pBefore[1]));
});

test("chain resolution: break-like triangle rack", () => {
  // Cue hits apex ball which touches two balls behind it (triangle formation)
  const rowGap = BALL_RADIUS * Math.sqrt(3);
  const a = new BallState([0.0, 0.0], [3.0, 0.0], 0.0, MotionState.SLIDING); // cue
  const b = new BallState([D, 0.0] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED); // apex
  const c = new BallState(
    [D + rowGap, -BALL_RADIUS] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED,
  );
  const d = new BallState(
    [D + rowGap, BALL_RADIUS] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED,
  );
  const state = new SimulationState([a, b, c, d], 0.0);
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);

  // All balls that received energy should be moving
  expect(norm(c.vel)).toBeGreaterThan(0.1);
  expect(norm(d.vel)).toBeGreaterThan(0.1);

  // Momentum conserved
  const totalP = state.balls.reduce(
    (p, ball) => add(p, scale(ball.vel, ball.mass)),
    [0, 0] as [number, number],
  );
  expect(totalP[0]).toBeCloseTo(3.0 * a.mass, 4);
  expect(totalP[1]).toBeCloseTo(0, 4);
});

test("chain resolution: no effect on separated balls", () => {
  // A hits B, C is far away — C should not be affected
  const a = new BallState([0.0, 0.0], [3.0, 0.0], 0.0, MotionState.SLIDING);
  const b = new BallState([D, 0.0] as [number, number], [0.0, 0.0], 0.0, MotionState.STOPPED);
  const c = new BallState([1.0, 1.0], [0.0, 0.0], 0.0, MotionState.STOPPED); // far away
  const state = new SimulationState([a, b, c], 0.0);
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);

  expect(c.vel[0]).toBe(0);
  expect(c.vel[1]).toBe(0);
  expect(c.motion).toBe(MotionState.STOPPED);
});
