import { BallState, MotionState } from "./ball-state";
import { MAX_CUE_SPIN } from "./constants";
import { Vec2, add, norm, normalize, roundVec, scale } from "./vec2";

const POSITION_DP = 6;

export function ballAcceleration(ball: BallState, g: number): Vec2 {
  if (ball.motion === MotionState.STOPPED) return [0, 0];

  const speed = norm(ball.vel);
  if (speed === 0) return [0, 0];

  const direction = scale(ball.vel, 1 / speed);

  if (ball.motion === MotionState.ROLLING) {
    return scale(direction, -ball.mu()! * g);
  }

  // Sliding: friction opposes slip direction
  const slip = speed - ball.radius * ball.omega;
  const s = slip >= 0 ? 1.0 : -1.0;
  return scale(direction, -s * ball.mu()! * g);
}

export function cueStrike(
  position: Vec2,
  direction: Vec2,
  speed: number,
  spin: number = 0.0,
): BallState {
  if (speed === 0) {
    return new BallState(position, [0, 0], 0, MotionState.STOPPED);
  }

  const n = norm(direction);
  if (n === 0) {
    throw new Error("direction must be non-zero when speed is non-zero");
  }
  if (spin < -1 || spin > 1) {
    throw new Error("spin must be between -1 (max draw) and 1 (max follow)");
  }

  const dir = normalize(direction);
  const vel: Vec2 = scale(dir, speed);
  const omega = spin * MAX_CUE_SPIN * speed;

  return new BallState(position, vel, omega, MotionState.SLIDING);
}

export function slidingMotion(
  ball: BallState,
  t: number,
  g: number,
): { pos: Vec2; vel: Vec2; omega: number } {
  const v0 = ball.vel;
  const speed = norm(v0);

  if (speed === 0) {
    return { pos: ball.pos, vel: ball.vel, omega: ball.omega };
  }

  const direction = scale(v0, 1 / speed);

  const slip = speed - ball.radius * ball.omega;
  const s = slip >= 0 ? 1.0 : -1.0;

  const a = scale(direction, -s * ball.mu()! * g);

  const newVel: Vec2 = add(v0, scale(a, t));
  const newPos = roundVec(
    add(ball.pos, add(scale(v0, t), scale(a, 0.5 * t * t))),
    POSITION_DP,
  );

  const alpha = (s * (5 * ball.mu()! * g)) / (2 * ball.radius);
  const newOmega = ball.omega + alpha * t;

  return { pos: newPos, vel: newVel, omega: newOmega };
}

export function rollingMotion(
  ball: BallState,
  t: number,
  g: number,
): { pos: Vec2; vel: Vec2; omega: number } {
  const v = ball.vel;
  const speed = norm(v);

  if (speed === 0) {
    return { pos: ball.pos, vel: ball.vel, omega: ball.omega };
  }

  const direction = scale(v, 1 / speed);
  const a = scale(direction, -ball.mu()! * g);

  const pos = roundVec(
    add(ball.pos, add(scale(v, t), scale(a, 0.5 * t * t))),
    POSITION_DP,
  );
  const vel = add(v, scale(a, t));
  const omega = norm(vel) / ball.radius;

  return { pos, vel, omega };
}

export function timeToReachPoint(
  ball: BallState,
  target: Vec2,
  g: number,
): number | null {
  if (norm(ball.vel) === 0) return null;

  const dx = target[0] - ball.pos[0];
  const dy = target[1] - ball.pos[1];
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return 0;

  const dir: Vec2 = [dx / distance, dy / distance];
  const vAlong = ball.vel[0] * dir[0] + ball.vel[1] * dir[1];
  if (vAlong <= 0) return null;

  let a: number;
  let tMax: number;

  if (ball.motion === MotionState.SLIDING) {
    a = ball.mu()! * g;
    tMax = timeSlidingToRolling(ball, g);
  } else if (ball.motion === MotionState.ROLLING) {
    a = ball.mu()! * g;
    tMax = timeRollingToStop(ball, g);
  } else {
    return null;
  }

  // Solve 0.5*a*t² - vAlong*t + distance = 0
  const A = 0.5 * a;
  const B = -vAlong;
  const C = distance;

  const discriminant = B * B - 4 * A * C;
  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-B + sqrtDisc) / (2 * A);
  const t2 = (-B - sqrtDisc) / (2 * A);

  const candidates = [t1, t2].filter((t) => t >= 0);
  if (candidates.length === 0) return null;

  const t = Math.min(...candidates);
  if (t > tMax) return null;

  return t;
}

/**
 * Time for a ball to travel a given distance along its current velocity direction.
 * Unlike timeToReachPoint, this doesn't project onto ball→target direction,
 * so it works correctly for off-axis targets.
 */
export function timeToTravelDistance(
  ball: BallState,
  distance: number,
  g: number,
): number | null {
  const speed = norm(ball.vel);
  if (speed <= 0) return null;
  if (distance <= 0) return 0;

  let a: number;
  let tMax: number;

  if (ball.motion === MotionState.SLIDING) {
    a = ball.mu()! * g;
    tMax = timeSlidingToRolling(ball, g);
  } else if (ball.motion === MotionState.ROLLING) {
    a = ball.mu()! * g;
    tMax = timeRollingToStop(ball, g);
  } else {
    return null;
  }

  // Solve: distance = speed*t - 0.5*a*t²  →  0.5*a*t² - speed*t + distance = 0
  const A = 0.5 * a;
  const B = -speed;
  const C = distance;

  const discriminant = B * B - 4 * A * C;
  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-B + sqrtDisc) / (2 * A);
  const t2 = (-B - sqrtDisc) / (2 * A);

  const candidates = [t1, t2].filter((t) => t >= 0);
  if (candidates.length === 0) return null;

  const t = Math.min(...candidates);
  if (t > tMax) return null;

  return t;
}

export function timeSlidingToRolling(ball: BallState, g: number): number {
  const v0 = norm(ball.vel);
  if (v0 === 0) {
    throw new Error("ball is sliding with zero velocity");
  }
  const slip = Math.abs(v0 - ball.radius * ball.omega);
  return (2 * slip) / (7 * ball.mu()! * g);
}

export function timeRollingToStop(ball: BallState, g: number): number {
  const speed = norm(ball.vel);
  if (speed === 0) {
    throw new Error("ball is rolling with zero velocity");
  }
  return speed / (ball.mu()! * g);
}
