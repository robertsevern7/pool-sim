import { BallState, MotionState } from "../ball-state";
import { G, MAX_CUE_SPIN } from "../constants";
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
import { add, norm, rotate90, scale } from "../vec2";

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

test("cue strike sidespin does not affect vel or omega", () => {
  const withSidespin = cueStrike([0.5, 0.7], [1, 0], 2.0, 0.3, 0.7);
  const without = cueStrike([0.5, 0.7], [1, 0], 2.0, 0.3);
  expect(withSidespin.vel).toEqual(without.vel);
  expect(withSidespin.omega).toEqual(without.omega);
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
  expect(q3(timeSlidingToRolling(DEFAULT_CUE_BALL(), G))).toBe("0.291");
});

test("time sliding to rolling soft", () => {
  expect(q3(timeSlidingToRolling(SOFT_CUE_BALL(), G))).toBe("0.146");
});

test("time sliding to rolling hard", () => {
  expect(q3(timeSlidingToRolling(HARD_CUE_BALL(), G))).toBe("0.437");
});

test("time sliding to rolling zero velocity throws", () => {
  const cue = new BallState([0.5, 0.7], [0, 0], [0, 0], MotionState.SLIDING);
  expect(() => timeSlidingToRolling(cue, G)).toThrow();
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
  expect(q3(pos[0])).toBe("0.999");
  expect(q3(pos[1])).toBe("0.700");
  expect(q3(vel[0])).toBe("1.429");
  expect(q3(vel[1])).toBe("0.000");
});

// ── sliding_motion: base cases ──

test("sliding motion x axis", () => {
  const cue = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const { pos, vel } = slidingMotion(cue, 0.1, G);
  expect(q3(pos[0])).toBe("0.190");
  expect(q3(pos[1])).toBe("0.000");
  expect(q3(vel[0])).toBe("1.804");
  expect(q3(vel[1])).toBe("0.000");
});

test("sliding motion angled", () => {
  const cue = new BallState([0.0, 0.0], [1.0, 1.0], [0, 0], MotionState.SLIDING);
  const { pos, vel } = slidingMotion(cue, 0.1, G);
  expect(q3(pos[0])).toBe("0.093");
  expect(q3(pos[1])).toBe("0.093");
  expect(q3(vel[0])).toBe("0.861");
  expect(q3(vel[1])).toBe("0.861");
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
  expect(q3(pos[0])).toBe("0.010");
  expect(q3(pos[1])).toBe("0.000");
  expect(q3(vel[0])).toBe("0.196");
  expect(q3(vel[1])).toBe("0.000");
  // Spin decays as translation picks up, from the same friction torque.
  expect(q3(omega[1])).toBe("32.835");
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
  expect(q3(pos[0])).toBe("4.467");
  expect(q3(pos[1])).toBe("0.700");
  expect(vel[0]).toBe(0);
  expect(vel[1]).toBe(0);
});

test("state after rolling angled", () => {
  const cue = ANGLED_CUE_BALL();
  const t1 = timeSlidingToRolling(cue, G);
  expect(q3(t1)).toBe("0.291");
  const r1 = slidingMotion(cue, t1, G);
  expect(q3(r1.pos[0])).toBe("0.853");
  expect(q3(r1.pos[1])).toBe("1.053");
  expect(q3(r1.vel[0])).toBe("1.010");
  expect(q3(r1.vel[1])).toBe("1.010");

  cue.pos = r1.pos;
  cue.vel = r1.vel;
  cue.motion = MotionState.ROLLING;
  const t2 = timeRollingToStop(cue, G);
  const { pos, vel } = rollingMotion(cue, t2, G);
  expect(q3(pos[0])).toBe("3.305");
  expect(q3(pos[1])).toBe("3.505");
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
  expect(q3(timeSlidingToRolling(cue, G))).toBe("0.291");
});

test("time sliding to rolling draw", () => {
  const cue = new BallState([0.5, 0.7], [2.0, 0.0], [0, -20.0], MotionState.SLIDING);
  expect(q3(timeSlidingToRolling(cue, G))).toBe("0.374");
});

test("time sliding to rolling topspin", () => {
  const cue = new BallState([0.5, 0.7], [2.0, 0.0], [0, 100.0], MotionState.SLIDING);
  expect(q3(timeSlidingToRolling(cue, G))).toBe("0.125");
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
  expect(q3(a[0])).toBe("-1.962");
  expect(q3(a[1])).toBe("0.000");
});

test("ball acceleration sliding topspin", () => {
  const ball = new BallState([0, 0], [2.0, 0.0], [0, 100.0], MotionState.SLIDING);
  const a = ballAcceleration(ball, G);
  expect(q3(a[0])).toBe("1.962");
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
  expect(q3(a[0])).toBe("1.962");
  expect(q3(a[1])).toBe("0.000");
});

// ── time_to_reach_point ──

test("time to reach point sliding", () => {
  const ball = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const t = timeToReachPoint(ball, [0.19, 0.0], G);
  expect(t).not.toBeNull();
  expect(q3(t!)).toBe("0.100");
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
