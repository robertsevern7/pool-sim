import { MotionState } from "./ball-state";
import { G, getPockets } from "./constants";
import type { Table, Pocket } from "./constants";
import type { SimulationState } from "./simulation-state";
import type { BallState } from "./ball-state";
import {
  ballAcceleration,
  timeRollingToStop,
  timeSlidingToRolling,
  timeToReachPoint,
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

function isInPocketZone(pos: Vec2, pockets: Pocket[]): boolean {
  for (const pocket of pockets) {
    const dx = pos[0] - pocket.center[0];
    const dy = pos[1] - pocket.center[1];
    if (dx * dx + dy * dy <= pocket.fallRadius * pocket.fallRadius) {
      return true;
    }
  }
  return false;
}

function predictRailCollisionPosition(
  ball: BallState,
  table: Table,
): Vec2 | null {
  const [vx, vy] = ball.vel;
  const [x, y] = ball.pos;
  const r = ball.radius;
  const pockets = getPockets(table);

  const collisions: { time: number; position: Vec2 }[] = [];

  if (vx > 0) {
    const ct = (table.width - r - x) / vx;
    collisions.push({ time: ct, position: [table.width - r, y + vy * ct] });
  }
  if (vx < 0) {
    const ct = (r - x) / vx;
    collisions.push({ time: ct, position: [r, y + vy * ct] });
  }
  if (vy > 0) {
    const ct = (table.height - r - y) / vy;
    collisions.push({ time: ct, position: [x + vx * ct, table.height - r] });
  }
  if (vy < 0) {
    const ct = (r - y) / vy;
    collisions.push({ time: ct, position: [x + vx * ct, r] });
  }

  // Filter out collisions in pocket zones
  const valid = collisions.filter(
    (c) => c.time > 1e-6 && !isInPocketZone(c.position, pockets),
  );
  if (valid.length === 0) return null;

  valid.sort((a, b) => a.time - b.time);
  return valid[0].position;
}

export function predictRailCollision(
  ball: BallState,
  table: Table,
): number | null {
  const pos = predictRailCollisionPosition(ball, table);
  if (pos === null) return null;
  return timeToReachPoint(ball, pos, G);
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

function predictPocketEntry(
  ball: BallState,
  table: Table,
): { time: number; pocketIndex: number } | null {
  const pockets = getPockets(table);
  let earliest: { time: number; pocketIndex: number } | null = null;

  for (let pi = 0; pi < pockets.length; pi++) {
    const pocket = pockets[pi];
    const t = timeToReachPoint(ball, pocket.center, G);
    if (t !== null && t > 1e-6) {
      // Check if ball will actually be within fall radius at this time
      // Use a simple linear approximation for the check
      const px = ball.pos[0] + ball.vel[0] * t;
      const py = ball.pos[1] + ball.vel[1] * t;
      const dx = px - pocket.center[0];
      const dy = py - pocket.center[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= pocket.fallRadius && (earliest === null || t < earliest.time)) {
        earliest = { time: t, pocketIndex: pi };
      }
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
