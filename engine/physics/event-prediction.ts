import { MotionState } from "./ball-state";
import { G, BALL_RADIUS, getPockets } from "./constants";
import type { Table, Pocket } from "./constants";
import type { SimulationState } from "./simulation-state";
import type { BallState } from "./ball-state";
import {
  ballAcceleration,
  timeRollingToStop,
  timeSlidingToRolling,
} from "./motion-models";
import { sub, scale, dot, norm, Vec2 } from "./vec2";
import { solvePolynomial } from "./polynomial";

export interface Event {
  time: number;
  eventType: "BALL_COLLISION" | "RAIL_COLLISION" | "STATE_CHANGE" | "POCKET";
  a: number;
  b: number | null;
}

export function predictBallBallCollision(
  a: BallState,
  b: BallState,
  g: number,
): number | null {
  const dp = sub(a.pos, b.pos);
  const dv = sub(a.vel, b.vel);
  const da = sub(ballAcceleration(a, g), ballAcceleration(b, g));

  const r = a.radius + b.radius;

  const halfDa: Vec2 = scale(da, 0.5);

  const c4 = dot(halfDa, halfDa);
  const c3 = 2 * dot(dv, halfDa);
  const c2 = dot(dv, dv) + 2 * dot(dp, halfDa);
  const c1 = 2 * dot(dp, dv);
  const c0 = dot(dp, dp) - r * r;

  let coeffs = [c4, c3, c2, c1, c0];

  // Strip leading zeros to avoid degenerate polynomial
  while (coeffs.length > 1 && coeffs[0] === 0) {
    coeffs.shift();
  }

  if (coeffs.length <= 1) return null;

  // Cap at the earliest state transition for either ball
  let tMax = Infinity;
  for (const ball of [a, b]) {
    const tTrans = predictStateTransition(ball);
    if (tTrans !== null && tTrans < tMax) {
      tMax = tTrans;
    }
  }

  // If balls are already at (or very near) collision distance and separating, skip
  if (Math.abs(c0) < 1e-6 && c1 >= 0) return null;

  const roots = solvePolynomial(coeffs);

  // Filter: real, positive, beyond epsilon, within current motion regime
  const realRoots = roots.filter((t) => t > 1e-4 && t <= tMax);

  if (realRoots.length === 0) return null;

  // Validate: substitute back and check distance ≈ 2r
  for (const t of realRoots.sort((a, b) => a - b)) {
    const sepX = dp[0] + dv[0] * t + halfDa[0] * t * t;
    const sepY = dp[1] + dv[1] * t + halfDa[1] * t * t;
    const dist = Math.sqrt(sepX * sepX + sepY * sepY);
    if (Math.abs(dist - r) < 1e-4) {
      return t;
    }
  }

  return null;
}

// Check if a rail collision position falls within a pocket mouth gap (no cushion there)
export function isInPocketGap(pos: Vec2, table: Table, pockets: Pocket[]): boolean {
  const r = BALL_RADIUS;
  const h = table.height;

  for (const pocket of pockets) {
    const halfMouth = pocket.mouthWidth / 2;
    const [cx, cy] = pocket.center;

    if (pocket.type === "side") {
      // Side pockets: gap along the x-axis at y=0 or y=h
      // Ball hits rail at y=r or y=h-r; check if x is within mouth
      if (Math.abs(pos[0] - cx) <= halfMouth) {
        if (cy === 0 && pos[1] <= r + 0.01) return true;
        if (cy === h && pos[1] >= h - r - 0.01) return true;
      }
    } else {
      // Corner pockets: gap near the corner on both adjacent rails
      // Check if position is within mouthWidth of the corner along either axis
      if (Math.abs(pos[0] - cx) <= pocket.mouthWidth && Math.abs(pos[1] - cy) <= pocket.mouthWidth) {
        return true;
      }
    }
  }
  return false;
}

function predictRailCollisionPosition(
  ball: BallState,
  table: Table,
): { time: number; position: Vec2 } | null {
  const [vx, vy] = ball.vel;
  const [x, y] = ball.pos;
  const r = ball.radius;
  const a = ballAcceleration(ball, G);
  const pockets = getPockets(table);

  // Acceleration is only constant within the ball's current motion regime, so cap
  // candidate roots at the next state transition (same approach as predictBallBallCollision).
  const tMax = predictStateTransition(ball) ?? Infinity;

  // Solve for time to reach each rail boundary using exact kinematics:
  // pos(t) = pos + vel*t + 0.5*a*t²
  // For x-boundary: x + vx*t + 0.5*ax*t² = boundary → 0.5*ax*t² + vx*t + (x - boundary) = 0
  const collisions: { time: number; position: Vec2 }[] = [];

  const boundaries: { axis: 0 | 1; value: number }[] = [];
  if (vx > 0 || a[0] > 0) boundaries.push({ axis: 0, value: table.width - r });
  if (vx < 0 || a[0] < 0) boundaries.push({ axis: 0, value: r });
  if (vy > 0 || a[1] > 0) boundaries.push({ axis: 1, value: table.height - r });
  if (vy < 0 || a[1] < 0) boundaries.push({ axis: 1, value: r });

  for (const b of boundaries) {
    const p0 = ball.pos[b.axis];
    const v0 = ball.vel[b.axis];
    const a0 = a[b.axis];
    // 0.5*a0*t² + v0*t + (p0 - b.value) = 0
    const coeffA = 0.5 * a0;
    const coeffB = v0;
    const coeffC = p0 - b.value;

    let roots: number[];
    if (Math.abs(coeffA) < 1e-12) {
      // Linear: v0*t + (p0 - b.value) = 0
      if (Math.abs(coeffB) < 1e-12) continue;
      roots = [-coeffC / coeffB];
    } else {
      const disc = coeffB * coeffB - 4 * coeffA * coeffC;
      if (disc < 0) continue;
      const sqrtDisc = Math.sqrt(disc);
      roots = [(-coeffB + sqrtDisc) / (2 * coeffA), (-coeffB - sqrtDisc) / (2 * coeffA)];
    }

    for (const t of roots) {
      if (t <= 1e-6) continue;
      // Compute exact position at time t
      const px = x + vx * t + 0.5 * a[0] * t * t;
      const py = y + vy * t + 0.5 * a[1] * t * t;
      collisions.push({ time: t, position: [px, py] });
    }
  }

  // Filter out collisions in pocket zones and beyond the current motion regime's validity
  const valid = collisions.filter(
    (c) => c.time > 1e-6 && c.time <= tMax && !isInPocketGap(c.position, table, pockets),
  );
  if (valid.length === 0) return null;

  valid.sort((a, b) => a.time - b.time);
  return valid[0];
}

export function predictRailCollision(
  ball: BallState,
  table: Table,
): number | null {
  const result = predictRailCollisionPosition(ball, table);
  if (result === null) return null;
  return result.time;
}

export function predictStateTransition(ball: BallState): number | null {
  if (ball.motion === MotionState.SLIDING) {
    return timeSlidingToRolling(ball, G);
  }
  if (ball.motion === MotionState.ROLLING) {
    return timeRollingToStop(ball, G);
  }
  return null;
}

// Predicts when the ball's center crosses a pocket's fall circle, using the ball's exact
// constant-acceleration trajectory within its current motion regime — the same quartic
// root-finding as predictBallBallCollision, against a fixed point instead of a moving ball.
// This is exact for both ROLLING (acceleration colinear with vel) and SLIDING (acceleration
// fixed in the initial slip direction, per slidingMotion in motion-models.ts — the direction
// doesn't change during a sliding sub-phase, only its magnitude decays), so it correctly
// follows the curved path a spinning ball takes while sliding, unlike a straight-line ray cast.
function predictPocketEntry(
  ball: BallState,
  table: Table,
): { time: number; pocketIndex: number } | null {
  if (ball.motion === MotionState.STOPPED) return null;

  const speed = norm(ball.vel);
  if (speed < 1e-9) return null;

  const a = ballAcceleration(ball, G);
  const halfA: Vec2 = scale(a, 0.5);
  const tMax = predictStateTransition(ball) ?? Infinity;
  const pockets = getPockets(table);

  let earliest: { time: number; pocketIndex: number } | null = null;

  for (let pi = 0; pi < pockets.length; pi++) {
    const pocket = pockets[pi];
    const r = pocket.fallRadius;
    const dp = sub(ball.pos, pocket.fallCenter);

    // |dp + vel*t + halfA*t²| = r
    const c4 = dot(halfA, halfA);
    const c3 = 2 * dot(ball.vel, halfA);
    const c2 = dot(ball.vel, ball.vel) + 2 * dot(dp, halfA);
    const c1 = 2 * dot(dp, ball.vel);
    const c0 = dot(dp, dp) - r * r;

    let coeffs = [c4, c3, c2, c1, c0];
    while (coeffs.length > 1 && coeffs[0] === 0) {
      coeffs.shift();
    }
    if (coeffs.length <= 1) continue;

    const roots = solvePolynomial(coeffs);

    // Validate: substitute back and check distance ≈ fall radius, same as predictBallBallCollision.
    let best: number | null = null;
    for (const t of roots.filter((t) => t > 1e-6 && t <= tMax).sort((x, y) => x - y)) {
      const sepX = dp[0] + ball.vel[0] * t + halfA[0] * t * t;
      const sepY = dp[1] + ball.vel[1] * t + halfA[1] * t * t;
      const dist = Math.sqrt(sepX * sepX + sepY * sepY);
      if (Math.abs(dist - r) < 1e-4) {
        best = t;
        break;
      }
    }
    if (best === null) continue;

    if (earliest === null || best < earliest.time) {
      earliest = { time: best, pocketIndex: pi };
    }
  }

  return earliest;
}

export function computeNextEvent(
  state: SimulationState,
  table: Table,
): Event | null {
  let earliest: Event | null = null;

  // ball-ball collisions
  for (let i = 0; i < state.balls.length; i++) {
    for (let j = i + 1; j < state.balls.length; j++) {
      const t = predictBallBallCollision(state.balls[i], state.balls[j], G);
      if (t && (earliest === null || state.time + t < earliest.time)) {
        earliest = {
          time: state.time + t,
          eventType: "BALL_COLLISION",
          a: i,
          b: j,
        };
      }
    }
  }

  // rail collisions
  for (let i = 0; i < state.balls.length; i++) {
    const t = predictRailCollision(state.balls[i], table);
    if (t && (earliest === null || state.time + t < earliest.time)) {
      earliest = {
        time: state.time + t,
        eventType: "RAIL_COLLISION",
        a: i,
        b: null,
      };
    }
  }

  // pocket entries
  for (let i = 0; i < state.balls.length; i++) {
    const result = predictPocketEntry(state.balls[i], table);
    if (result && (earliest === null || state.time + result.time < earliest.time)) {
      earliest = {
        time: state.time + result.time,
        eventType: "POCKET",
        a: i,
        b: result.pocketIndex,
      };
    }
  }

  // state transitions
  for (let i = 0; i < state.balls.length; i++) {
    const t = predictStateTransition(state.balls[i]);
    if (t && (earliest === null || state.time + t < earliest.time)) {
      earliest = {
        time: state.time + t,
        eventType: "STATE_CHANGE",
        a: i,
        b: null,
      };
    }
  }

  return earliest;
}
