import { BallState, MotionState } from "./ball-state";
import { MAX_CUE_SPIN, MAX_SQUIRT_ANGLE } from "./constants";
import { Vec2, add, norm, normalize, roundVec, rotate90, rotateByAngle, scale } from "./vec2";

const POSITION_DP = 6;

export function ballAcceleration(ball: BallState, g: number): Vec2 {
  if (ball.motion === MotionState.STOPPED) return [0, 0];

  if (ball.motion === MotionState.ROLLING) {
    const speed = norm(ball.vel);
    if (speed === 0) return [0, 0];
    const direction = scale(ball.vel, 1 / speed);
    return scale(direction, -ball.mu()! * g);
  }

  // Sliding: friction opposes the contact-point slip velocity. This is generally
  // NOT colinear with vel — e.g. right after a collision, vel jumps to the tangent
  // direction but omega (spin axis) is unchanged, so the ball curves as it slides.
  // Notably this slip can be nonzero even when vel = 0: a ball spinning in place still
  // has a moving contact point, so friction accelerates it from rest.
  const slip = add(ball.vel, scale(rotate90(ball.omega), ball.radius));
  if (norm(slip) === 0) return [0, 0];
  const slipDir = normalize(slip);
  return scale(slipDir, -ball.mu()! * g);
}

export function cueStrike(
  position: Vec2,
  direction: Vec2,
  speed: number,
  spin: number = 0.0,
  sidespin: number = 0.0,
): BallState {
  if (speed === 0) {
    return new BallState(position, [0, 0], [0, 0], MotionState.STOPPED);
  }

  const n = norm(direction);
  if (n === 0) {
    throw new Error("direction must be non-zero when speed is non-zero");
  }
  if (spin < -1 || spin > 1) {
    throw new Error("spin must be between -1 (max draw) and 1 (max follow)");
  }
  if (sidespin < -1 || sidespin > 1) {
    throw new Error("sidespin must be between -1 (max left english) and 1 (max right english)");
  }
  // Both spin and sidespin come from a single tip offset point (bounded by radius/2 before
  // a miscue) — same derivation as MAX_CUE_SPIN, just resolved into two axes instead of one.
  // Small epsilon so a caller that normalizes to exactly the unit circle isn't tripped up by
  // floating-point rounding landing a hair past 1.
  if (spin * spin + sidespin * sidespin > 1 + 1e-9) {
    throw new Error("combined spin and sidespin exceed the tip offset that avoids a miscue");
  }

  const dir = normalize(direction);

  // Squirt: the tip's impulse on an off-center (sidespin) hit isn't perfectly aligned with
  // the cue's aim direction — the tip has some give relative to the ball — so the ball's
  // actual initial path deflects by a small angle, to the opposite side from the sidespin.
  // The spin axes are set by the tip contact geometry (the aim direction itself), not by
  // the resulting deflected path — so omega/spinZ below still use `dir`, only vel uses the
  // deflected direction. That mismatch (omega no longer quite perpendicular to vel) means
  // the ball also curves slightly during its initial slide, same mechanism as the
  // post-collision curving fix.
  const squirtAngle = -sidespin * MAX_SQUIRT_ANGLE;
  const squirtDir = rotateByAngle(dir, squirtAngle);

  const vel: Vec2 = scale(squirtDir, speed);
  const omega = scale(rotate90(dir), spin * MAX_CUE_SPIN * speed);
  const spinZ = sidespin * MAX_CUE_SPIN * speed;

  return new BallState(position, vel, omega, MotionState.SLIDING, 0, spinZ);
}

export function slidingMotion(
  ball: BallState,
  t: number,
  g: number,
): { pos: Vec2; vel: Vec2; omega: Vec2 } {
  const v0 = ball.vel;
  const u0 = add(v0, scale(rotate90(ball.omega), ball.radius));

  // Zero slip means zero friction, so nothing changes — but that's not the same as v0 = 0:
  // a ball spinning in place (v0 = 0, omega != 0) still slips and starts to translate.
  if (norm(u0) === 0) {
    return { pos: ball.pos, vel: ball.vel, omega: ball.omega };
  }

  const uHat = normalize(u0);

  const a = scale(uHat, -ball.mu()! * g);

  const newVel: Vec2 = add(v0, scale(a, t));
  const newPos = roundVec(
    add(ball.pos, add(scale(v0, t), scale(a, 0.5 * t * t))),
    POSITION_DP,
  );

  const alpha = scale(rotate90(uHat), (5 * ball.mu()! * g) / (2 * ball.radius));
  const newOmega = add(ball.omega, scale(alpha, t));

  return { pos: newPos, vel: newVel, omega: newOmega };
}

export function rollingMotion(
  ball: BallState,
  t: number,
  g: number,
): { pos: Vec2; vel: Vec2; omega: Vec2 } {
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
  // Rolling without slipping: omega stays locked to the rolling-constraint direction as vel decays.
  const omega = scale(rotate90(vel), 1 / ball.radius);

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
  // Slip (not vel) is what drives this transition — a ball spinning in place (vel = 0)
  // has nonzero slip and a well-defined time to reach natural roll, same as any other
  // sliding ball (see ballAcceleration). But slip = 0 doesn't necessarily mean the ball is
  // at rest: a genuinely moving ball can have vel/omega that already satisfy the
  // natural-roll condition exactly (e.g. a cue strike whose follow spin happens to match
  // natural roll for that speed) — that's a real, valid state, just with zero time left to
  // reach it, not an error. Only a ball with no vel *and* no omega is actually stationary.
  const slip = norm(add(ball.vel, scale(rotate90(ball.omega), ball.radius)));
  if (slip === 0) {
    if (norm(ball.vel) === 0 && norm(ball.omega) === 0) {
      throw new Error("ball is stationary, not sliding");
    }
    return 0;
  }
  return (2 * slip) / (7 * ball.mu()! * g);
}

export function timeRollingToStop(ball: BallState, g: number): number {
  const speed = norm(ball.vel);
  if (speed === 0) {
    throw new Error("ball is rolling with zero velocity");
  }
  return speed / (ball.mu()! * g);
}
