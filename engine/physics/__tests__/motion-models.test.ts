import { BallState, MotionState } from "../ball-state";
import { G, MAX_CUE_SPIN, MAX_SQUIRT_ANGLE } from "../constants";
import {
  ballAcceleration,
  cueStrike,
  rollingMotion,
  slidingMotion,
  timeRollingToStop,
  timeSlidingToRolling,
  timeToReachPoint,
  timeToTravelDistance,
} from "../motion-models";
import { add, dot, norm, rotate90, scale } from "../vec2";

function q3(n: number): string {
  return n.toFixed(3);
}

function DEFAULT_CUE_BALL() {
  return cueStrike([0.5, 0.7], [1, 0], 2.0);
}
function HARD_CUE_BALL() {
  return cueStrike([0.5, 0.7], [1, 0], 3.0);
}
function SOFT_CUE_BALL() {
  return cueStrike([0.5, 0.7], [1, 0], 1.0);
}
function ANGLED_CUE_BALL() {
  return cueStrike([0.5, 0.7], [1, 1], 2.0);
}

// ── cue_strike: base cases ──

test("initial state", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 2.0);
  expect(cue.pos[0]).toBe(0.5);
  expect(cue.pos[1]).toBe(0.7);
  expect(cue.vel[0]).toBe(2.0);
  expect(cue.vel[1]).toBe(0.0);
  expect(cue.motion).toBe(MotionState.SLIDING);
});

test("cue strike angled direction", () => {
  const cue = cueStrike([0.5, 0.7], [1, 1], 2.0);
  expect(q3(cue.vel[0])).toBe("1.414");
  expect(q3(cue.vel[1])).toBe("1.414");
  expect(cue.motion).toBe(MotionState.SLIDING);
});

test("cue strike negative direction", () => {
  const cue = cueStrike([0.5, 0.7], [-1, 0], 3.0);
  expect(cue.vel[0]).toBe(-3.0);
  expect(cue.vel[1]).toBe(0.0);
  expect(cue.motion).toBe(MotionState.SLIDING);
});

// ── cue_strike: edge cases ──

test("cue strike zero speed", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 0.0);
  expect(cue.vel[0]).toBe(0.0);
  expect(cue.vel[1]).toBe(0.0);
  expect(cue.motion).toBe(MotionState.STOPPED);
});

test("cue strike zero direction throws", () => {
  expect(() => cueStrike([0.5, 0.7], [0, 0], 2.0)).toThrow();
});

// ── cue_strike: sidespin (english) ──

test("cue strike with no sidespin has zero spinZ", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 2.0, 0.5);
  expect(cue.spinZ).toBe(0);
});

test("cue strike sidespin sets spinZ proportional to speed", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 2.0, 0, 0.5);
  expect(q3(cue.spinZ)).toBe(q3(0.5 * MAX_CUE_SPIN * 2.0));
});

test("cue strike max sidespin", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 3.0, 0, 1.0);
  expect(q3(cue.spinZ)).toBe(q3(MAX_CUE_SPIN * 3.0));
});

test("cue strike negative sidespin gives negative spinZ", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 2.0, 0, -0.5);
  expect(cue.spinZ).toBeLessThan(0);
});

test("cue strike sidespin out of range throws", () => {
  expect(() => cueStrike([0.5, 0.7], [1, 0], 2.0, 0, 1.5)).toThrow();
  expect(() => cueStrike([0.5, 0.7], [1, 0], 2.0, 0, -1.5)).toThrow();
});

test("cue strike combined spin and sidespin within miscue limit is fine", () => {
  expect(() => cueStrike([0.5, 0.7], [1, 0], 2.0, 0.6, 0.6)).not.toThrow();
});

test("cue strike combined spin and sidespin beyond miscue limit throws", () => {
  expect(() => cueStrike([0.5, 0.7], [1, 0], 2.0, 0.9, 0.9)).toThrow();
});

test("cue strike sidespin does not affect omega (follow/draw axis) or speed", () => {
  // omega is set from the tip contact geometry (the aim direction), not the resulting
  // (squirt-deflected) path — only vel's *direction* should differ with sidespin.
  const withSidespin = cueStrike([0.5, 0.7], [1, 0], 2.0, 0.3, 0.7);
  const without = cueStrike([0.5, 0.7], [1, 0], 2.0, 0.3);
  expect(withSidespin.omega).toEqual(without.omega);
  expect(q3(norm(withSidespin.vel))).toBe(q3(norm(without.vel)));
});

// ── cue_strike: squirt (cue ball deflection from sidespin) ──

test("cue strike with no sidespin has no squirt", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 2.0, 0, 0);
  expect(q3(cue.vel[0])).toBe("2.000");
  expect(q3(cue.vel[1])).toBe("0.000");
});

test("cue strike sidespin deflects vel away from the aim direction", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 2.0, 0, 0.7);
  const angle = Math.atan2(cue.vel[1], cue.vel[0]);
  expect(q3(angle)).toBe(q3(-0.7 * MAX_SQUIRT_ANGLE));
  // Speed is preserved — only direction changes.
  expect(q3(norm(cue.vel))).toBe("2.000");
});

test("cue strike squirt angle scales linearly with sidespin", () => {
  const half = cueStrike([0.5, 0.7], [1, 0], 2.0, 0, 0.3);
  const full = cueStrike([0.5, 0.7], [1, 0], 2.0, 0, 0.6);
  const angleHalf = Math.atan2(half.vel[1], half.vel[0]);
  const angleFull = Math.atan2(full.vel[1], full.vel[0]);
  expect(q3(angleFull)).toBe(q3(2 * angleHalf));
});

test("cue strike squirt direction flips with sidespin sign", () => {
  const positiveSidespin = cueStrike([0.5, 0.7], [1, 0], 2.0, 0, 0.5);
  const negativeSidespin = cueStrike([0.5, 0.7], [1, 0], 2.0, 0, -0.5);
  const anglePositive = Math.atan2(positiveSidespin.vel[1], positiveSidespin.vel[0]);
  const angleNegative = Math.atan2(negativeSidespin.vel[1], negativeSidespin.vel[0]);
  // Squirt deflects to the opposite side from the sidespin, so the two are mirror images.
  expect(anglePositive).toBeLessThan(0);
  expect(angleNegative).toBeGreaterThan(0);
  expect(q3(anglePositive)).toBe(q3(-angleNegative));
});

test("cue strike squirt leaves omega not quite perpendicular to vel (ball curves slightly after the strike)", () => {
  // Same mechanism as the post-collision curving fix: once vel and omega aren't exactly
  // perpendicular, ballAcceleration's slip direction isn't colinear with vel, so the ball
  // curves while sliding. A dot product of exactly 0 would mean no curving at all.
  const cue = cueStrike([0.5, 0.7], [1, 0], 2.0, 0.4, 0.6);
  expect(Math.abs(dot(cue.vel, cue.omega))).toBeGreaterThan(1e-6);
});

test("cue strike unnormalized direction", () => {
  const cue = cueStrike([1.0, 1.0], [3, 4], 5.0);
  expect(q3(cue.vel[0])).toBe("3.000");
  expect(q3(cue.vel[1])).toBe("4.000");
});

// ── cue_strike: self-consistency ──

test("cue strike speed matches input", () => {
  const cue = cueStrike([0.0, 0.0], [3, 4], 5.0);
  expect(q3(norm(cue.vel))).toBe("5.000");
});

test("cue strike direction preserved", () => {
  const cue = cueStrike([0.0, 0.0], [1, 2], 3.0);
  const speed = norm(cue.vel);
  const velDir = [cue.vel[0] / speed, cue.vel[1] / speed];
  const expNorm = Math.sqrt(1 + 4);
  const expDir = [1 / expNorm, 2 / expNorm];
  expect(q3(velDir[0])).toBe(q3(expDir[0]));
  expect(q3(velDir[1])).toBe(q3(expDir[1]));
});

// ── time_sliding_to_rolling ──

test("default time sliding to rolling", () => {
  expect(q3(timeSlidingToRolling(DEFAULT_CUE_BALL(), G))).toBe("0.582");
});

test("time sliding to rolling soft", () => {
  expect(q3(timeSlidingToRolling(SOFT_CUE_BALL(), G))).toBe("0.291");
});

test("time sliding to rolling hard", () => {
  expect(q3(timeSlidingToRolling(HARD_CUE_BALL(), G))).toBe("0.874");
});

test("time sliding to rolling zero velocity throws", () => {
  const cue = new BallState([0.5, 0.7], [0, 0], [0, 0], MotionState.SLIDING);
  expect(() => timeSlidingToRolling(cue, G)).toThrow();
});

test("time sliding to rolling with vel already at the natural-roll condition returns 0, does not throw", () => {
  // Regression: a moving ball (vel != 0) can have vel/omega that already satisfy the
  // natural-roll condition exactly — e.g. a cue strike whose follow spin happens to match
  // natural roll for that speed (spin = 1 / (MAX_CUE_SPIN * radius) = 0.8 here). That's a
  // real, valid state with zero time left to reach rolling, not an error — only a ball with
  // neither vel nor omega is actually stationary.
  const cue = cueStrike([0.5, 0.7], [1, 0], 2.0, 0.8);
  const slip = norm(add(cue.vel, scale(rotate90(cue.omega), cue.radius)));
  expect(slip).toBeLessThan(1e-9);
  expect(timeSlidingToRolling(cue, G)).toBe(0);
});

test("time sliding to rolling pure spin zero velocity does not throw", () => {
  // vel = 0 alone isn't "no slip" — a spinning ball still slips at the contact point
  // and has a well-defined time to reach natural roll, same as any sliding ball.
  const ball = new BallState([0.5, 0.7], [0, 0], [0, 50], MotionState.SLIDING);
  const t = timeSlidingToRolling(ball, G);
  expect(t).toBeGreaterThan(0);

  const { vel, omega } = slidingMotion(ball, t, G);
  const slip = norm(add(vel, scale(rotate90(omega), ball.radius)));
  expect(slip).toBeLessThan(1e-6);
  // The ball didn't stay frozen — it picked up real forward speed purely from spin.
  expect(norm(vel)).toBeGreaterThan(0.1);
});

test("time sliding to rolling very slow", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 0.001);
  const t = timeSlidingToRolling(cue, G);
  expect(t).toBeGreaterThan(0);
});

// ── time_sliding_to_rolling: self-consistency ──

test("sliding velocity at rolling time equals 5/7 v0", () => {
  const cue = DEFAULT_CUE_BALL();
  const v0 = norm(cue.vel);
  const t = timeSlidingToRolling(cue, G);
  const { vel } = slidingMotion(cue, t, G);
  const expectedSpeed = (5.0 / 7.0) * v0;
  expect(q3(norm(vel))).toBe(q3(expectedSpeed));
});

test("state after sliding", () => {
  const t = timeSlidingToRolling(DEFAULT_CUE_BALL(), G);
  const { pos, vel } = slidingMotion(DEFAULT_CUE_BALL(), t, G);
  expect(q3(pos[0])).toBe("1.499");
  expect(q3(pos[1])).toBe("0.700");
  expect(q3(vel[0])).toBe("1.429");
  expect(q3(vel[1])).toBe("0.000");
});

// ── sliding_motion: base cases ──

test("sliding motion x axis", () => {
  const cue = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const { pos, vel } = slidingMotion(cue, 0.1, G);
  expect(q3(pos[0])).toBe("0.195");
  expect(q3(pos[1])).toBe("0.000");
  expect(q3(vel[0])).toBe("1.902");
  expect(q3(vel[1])).toBe("0.000");
});

test("sliding motion angled", () => {
  const cue = new BallState([0.0, 0.0], [1.0, 1.0], [0, 0], MotionState.SLIDING);
  const { pos, vel } = slidingMotion(cue, 0.1, G);
  expect(q3(pos[0])).toBe("0.097");
  expect(q3(pos[1])).toBe("0.097");
  expect(q3(vel[0])).toBe("0.931");
  expect(q3(vel[1])).toBe("0.931");
});

// ── sliding_motion: edge cases ──

test("sliding motion zero velocity returns unchanged", () => {
  const cue = new BallState([1.0, 2.0], [0.0, 0.0], [0, 0], MotionState.SLIDING);
  const { pos, vel } = slidingMotion(cue, 0.5, G);
  expect(pos[0]).toBe(1.0);
  expect(pos[1]).toBe(2.0);
  expect(vel[0]).toBe(0.0);
  expect(vel[1]).toBe(0.0);
});

test("sliding motion pure spin zero velocity starts moving", () => {
  // Zero vel with nonzero omega is not the same as fully stopped — the spinning contact
  // point still slips against the cloth, so friction should accelerate the ball from rest.
  const ball = new BallState([0, 0], [0.0, 0.0], [0, 50], MotionState.SLIDING);
  const { pos, vel, omega } = slidingMotion(ball, 0.1, G);
  expect(q3(pos[0])).toBe("0.005");
  expect(q3(pos[1])).toBe("0.000");
  expect(q3(vel[0])).toBe("0.098");
  expect(q3(vel[1])).toBe("0.000");
  // Spin decays as translation picks up, from the same friction torque.
  expect(q3(omega[1])).toBe("41.417");
});

test("sliding motion t zero", () => {
  const cue = new BallState([1.0, 2.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const { pos, vel } = slidingMotion(cue, 0.0, G);
  expect(pos[0]).toBe(1.0);
  expect(pos[1]).toBe(2.0);
  expect(vel[0]).toBe(2.0);
  expect(vel[1]).toBe(0.0);
});

// ── sliding_motion: self-consistency ──

test("sliding motion decelerates monotonically", () => {
  const cue1 = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const { vel: vel1 } = slidingMotion(cue1, 0.1, G);
  const cue2 = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const { vel: vel2 } = slidingMotion(cue2, 0.2, G);
  expect(norm(vel1)).toBeGreaterThan(norm(vel2));
});

// ── rolling_to_stop ──

test("rolling to stop time standard", () => {
  const cue = DEFAULT_CUE_BALL();
  const t = timeSlidingToRolling(cue, G);
  const { pos, vel } = slidingMotion(cue, t, G);
  cue.pos = pos;
  cue.vel = vel;
  cue.motion = MotionState.ROLLING;
  expect(q3(timeRollingToStop(cue, G))).toBe("4.854");
});

test("rolling to stop time soft", () => {
  const cue = SOFT_CUE_BALL();
  const t = timeSlidingToRolling(cue, G);
  const { pos, vel } = slidingMotion(cue, t, G);
  cue.pos = pos;
  cue.vel = vel;
  cue.motion = MotionState.ROLLING;
  expect(q3(timeRollingToStop(cue, G))).toBe("2.427");
});

test("rolling to stop time hard", () => {
  const cue = HARD_CUE_BALL();
  const t = timeSlidingToRolling(cue, G);
  const { pos, vel } = slidingMotion(cue, t, G);
  cue.pos = pos;
  cue.vel = vel;
  cue.motion = MotionState.ROLLING;
  expect(q3(timeRollingToStop(cue, G))).toBe("7.281");
});

test("rolling to stop time isolated", () => {
  const cue = new BallState([0.5, 0.7], [2.0, 0.0], [0, 0], MotionState.ROLLING);
  expect(q3(timeRollingToStop(cue, G))).toBe("6.796");
});

test("time rolling to stop zero velocity throws", () => {
  const cue = new BallState([0.5, 0.7], [0, 0], [0, 0], MotionState.ROLLING);
  expect(() => timeRollingToStop(cue, G)).toThrow();
});

test("rolling velocity is zero at stop time", () => {
  const cue = new BallState([0.5, 0.7], [2.0, 0.0], [0, 0], MotionState.ROLLING);
  const t = timeRollingToStop(cue, G);
  const { vel } = rollingMotion(cue, t, G);
  expect(q3(norm(vel))).toBe("0.000");
});

test("state after rolling standard", () => {
  const cue = DEFAULT_CUE_BALL();
  const t1 = timeSlidingToRolling(cue, G);
  const r1 = slidingMotion(cue, t1, G);
  cue.pos = r1.pos;
  cue.vel = r1.vel;
  cue.motion = MotionState.ROLLING;
  const t2 = timeRollingToStop(cue, G);
  const { pos, vel } = rollingMotion(cue, t2, G);
  expect(q3(pos[0])).toBe("4.966");
  expect(q3(pos[1])).toBe("0.700");
  expect(vel[0]).toBe(0);
  expect(vel[1]).toBe(0);
});

test("state after rolling angled", () => {
  const cue = ANGLED_CUE_BALL();
  const t1 = timeSlidingToRolling(cue, G);
  expect(q3(t1)).toBe("0.582");
  const r1 = slidingMotion(cue, t1, G);
  expect(q3(r1.pos[0])).toBe("1.206");
  expect(q3(r1.pos[1])).toBe("1.406");
  expect(q3(r1.vel[0])).toBe("1.010");
  expect(q3(r1.vel[1])).toBe("1.010");

  cue.pos = r1.pos;
  cue.vel = r1.vel;
  cue.motion = MotionState.ROLLING;
  const t2 = timeRollingToStop(cue, G);
  const { pos, vel } = rollingMotion(cue, t2, G);
  expect(q3(pos[0])).toBe("3.658");
  expect(q3(pos[1])).toBe("3.858");
  expect(Math.abs(vel[0])).toBeLessThan(1e-10);
  expect(Math.abs(vel[1])).toBeLessThan(1e-10);
});

// ── rolling_motion: base cases ──

test("rolling motion x axis", () => {
  const cue = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.ROLLING);
  const { pos, vel } = rollingMotion(cue, 0.5, G);
  expect(q3(pos[0])).toBe("0.963");
  expect(q3(pos[1])).toBe("0.000");
  expect(q3(vel[0])).toBe("1.853");
  expect(q3(vel[1])).toBe("0.000");
});

// ── rolling_motion: edge cases ──

test("rolling motion zero velocity returns unchanged", () => {
  const cue = new BallState([1.0, 2.0], [0.0, 0.0], [0, 0], MotionState.ROLLING);
  const { pos, vel } = rollingMotion(cue, 0.5, G);
  expect(pos[0]).toBe(1.0);
  expect(pos[1]).toBe(2.0);
  expect(vel[0]).toBe(0.0);
  expect(vel[1]).toBe(0.0);
});

test("rolling motion t zero", () => {
  const cue = new BallState([1.0, 2.0], [2.0, 0.0], [0, 0], MotionState.ROLLING);
  const { pos, vel } = rollingMotion(cue, 0.0, G);
  expect(pos[0]).toBe(1.0);
  expect(pos[1]).toBe(2.0);
  expect(vel[0]).toBe(2.0);
  expect(vel[1]).toBe(0.0);
});

// ── spin effects ──

test("time sliding to rolling stun shot", () => {
  const cue = cueStrike([0.5, 0.7], [1, 0], 2.0);
  expect(q3(timeSlidingToRolling(cue, G))).toBe("0.582");
});

test("time sliding to rolling draw", () => {
  const cue = new BallState([0.5, 0.7], [2.0, 0.0], [0, -20.0], MotionState.SLIDING);
  expect(q3(timeSlidingToRolling(cue, G))).toBe("0.749");
});

test("time sliding to rolling topspin", () => {
  const cue = new BallState([0.5, 0.7], [2.0, 0.0], [0, 100.0], MotionState.SLIDING);
  expect(q3(timeSlidingToRolling(cue, G))).toBe("0.250");
});

test("sliding to rolling self consistency v equals r omega", () => {
  const cue = new BallState([0.5, 0.7], [2.0, 0.0], [0, -20.0], MotionState.SLIDING);
  const t = timeSlidingToRolling(cue, G);
  const { vel, omega } = slidingMotion(cue, t, G);
  const speed = norm(vel);
  expect(q3(speed)).toBe(q3(cue.radius * norm(omega)));
});

test("sliding motion backspin omega increases", () => {
  const cue = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const { omega } = slidingMotion(cue, 0.1, G);
  expect(omega[1]).toBeGreaterThan(0.0);
  expect(omega[0]).toBeCloseTo(0, 9);
});

test("sliding motion topspin omega decreases", () => {
  const cue = new BallState([0.0, 0.0], [2.0, 0.0], [0, 100.0], MotionState.SLIDING);
  const { omega } = slidingMotion(cue, 0.1, G);
  expect(omega[1]).toBeLessThan(100.0);
  expect(omega[0]).toBeCloseTo(0, 9);
});

test("sliding motion topspin self consistency v equals r omega", () => {
  const cue = new BallState([0.5, 0.7], [2.0, 0.0], [0, 100.0], MotionState.SLIDING);
  const t = timeSlidingToRolling(cue, G);
  const { vel, omega } = slidingMotion(cue, t, G);
  expect(q3(norm(vel))).toBe(q3(cue.radius * norm(omega)));
});

// ── ball_acceleration ──

test("ball acceleration sliding stun", () => {
  const ball = new BallState([0, 0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const a = ballAcceleration(ball, G);
  expect(q3(a[0])).toBe("-0.981");
  expect(q3(a[1])).toBe("0.000");
});

test("ball acceleration sliding topspin", () => {
  const ball = new BallState([0, 0], [2.0, 0.0], [0, 100.0], MotionState.SLIDING);
  const a = ballAcceleration(ball, G);
  expect(q3(a[0])).toBe("0.981");
  expect(q3(a[1])).toBe("0.000");
});

test("ball acceleration rolling", () => {
  const ball = new BallState([0, 0], [2.0, 0.0], [0, 0], MotionState.ROLLING);
  const a = ballAcceleration(ball, G);
  expect(q3(a[0])).toBe("-0.294");
  expect(q3(a[1])).toBe("0.000");
});

test("ball acceleration stopped", () => {
  const ball = new BallState([0, 0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const a = ballAcceleration(ball, G);
  expect(a[0]).toBe(0.0);
  expect(a[1]).toBe(0.0);
});

test("ball acceleration zero velocity sliding", () => {
  const ball = new BallState([0, 0], [0.0, 0.0], [0, 0], MotionState.SLIDING);
  const a = ballAcceleration(ball, G);
  expect(a[0]).toBe(0.0);
  expect(a[1]).toBe(0.0);
});

test("ball acceleration pure spin zero velocity is nonzero", () => {
  // A ball with vel = 0 but omega != 0 still has a slipping contact point, so friction
  // should accelerate it from rest rather than leaving it frozen.
  const ball = new BallState([0, 0], [0.0, 0.0], [0, 50.0], MotionState.SLIDING);
  const a = ballAcceleration(ball, G);
  expect(q3(a[0])).toBe("0.981");
  expect(q3(a[1])).toBe("0.000");
});

// ── time_to_reach_point ──

test("time to reach point sliding", () => {
  const ball = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const t = timeToReachPoint(ball, [0.19, 0.0], G);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("0.097");
});

test("time to reach point rolling", () => {
  const ball = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.ROLLING);
  const t = timeToReachPoint(ball, [0.988, 0.0], G);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("0.513");
});

test("time to reach point stopped", () => {
  const ball = new BallState([0.0, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  expect(timeToReachPoint(ball, [1.0, 0.0], G)).toBeNull();
});

test("time to reach point already at target", () => {
  const ball = new BallState([1.0, 1.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  expect(timeToReachPoint(ball, [1.0, 1.0], G)).toBe(0.0);
});

test("time to reach point moving away", () => {
  const ball = new BallState([0.0, 0.0], [-2.0, 0.0], [0, 0], MotionState.SLIDING);
  expect(timeToReachPoint(ball, [1.0, 0.0], G)).toBeNull();
});

test("time to reach point stops before target", () => {
  const ball = new BallState([0.0, 0.0], [0.1, 0.0], [0, 0], MotionState.SLIDING);
  expect(timeToReachPoint(ball, [100.0, 0.0], G)).toBeNull();
});

test("time to reach point position at time equals target", () => {
  const ball = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const target: [number, number] = [0.19, 0.0];
  const t = timeToReachPoint(ball, target, G)!;
  const { pos } = slidingMotion(ball, t, G);
  expect(q3(pos[0])).toBe(q3(target[0]));
  expect(q3(pos[1])).toBe(q3(target[1]));
});

// --- timeToTravelDistance ---

describe("timeToTravelDistance", () => {
  test("stopped ball returns null", () => {
    const ball = new BallState([1, 1], [0, 0], [0, 0], MotionState.STOPPED);
    expect(timeToTravelDistance(ball, 0.5, G)).toBeNull();
  });

  test("zero distance returns 0", () => {
    const ball = new BallState([1, 1], [1, 0], [0, 0], MotionState.ROLLING);
    expect(timeToTravelDistance(ball, 0, G)).toBe(0);
  });

  test("rolling ball reaches a short distance", () => {
    const ball = new BallState([1, 1], [2, 0], [0, 0], MotionState.ROLLING);
    const t = timeToTravelDistance(ball, 0.1, G);
    expect(t).not.toBeNull();
    expect(t).toBeGreaterThan(0);
    // Verify: distance = speed*t - 0.5*a*t²
    const speed = 2;
    const a = ball.mu()! * G;
    const traveled = speed * t! - 0.5 * a * t! * t!;
    expect(traveled).toBeCloseTo(0.1, 4);
  });

  test("ball that stops before reaching distance returns null", () => {
    // Very slow ball, long distance
    const ball = new BallState([1, 1], [0.1, 0], [0, 0], MotionState.ROLLING);
    const t = timeToTravelDistance(ball, 10, G);
    expect(t).toBeNull();
  });

  test("sliding ball reaches distance before transition", () => {
    const ball = cueStrike([1, 0.71], [1, 0], 3);
    expect(ball.motion).toBe(MotionState.SLIDING);
    const t = timeToTravelDistance(ball, 0.05, G);
    expect(t).not.toBeNull();
    expect(t).toBeGreaterThan(0);
  });

  test("agrees with timeToReachPoint for straight-line case", () => {
    const ball = new BallState([0, 0], [1, 0], [0, 0], MotionState.ROLLING);
    const target: [number, number] = [0.5, 0];
    const t1 = timeToReachPoint(ball, target, G);
    const t2 = timeToTravelDistance(ball, 0.5, G);
    expect(t1).not.toBeNull();
    expect(t2).not.toBeNull();
    expect(t2).toBeCloseTo(t1!, 6);
  });
});
