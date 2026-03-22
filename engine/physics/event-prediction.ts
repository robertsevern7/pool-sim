import { MotionState } from "./ball-state";
import { G, BALL_RADIUS, getPockets } from "./constants";
import type { Table, Pocket } from "./constants";
import type { SimulationState } from "./simulation-state";
import type { BallState } from "./ball-state";
import {
  ballAcceleration,
  timeRollingToStop,
  timeSlidingToRolling,
  timeToReachPoint,
  timeToTravelDistance,
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
): Vec2 | null {
  const [vx, vy] = ball.vel;
  const [x, y] = ball.pos;
  const r = ball.radius;
  const a = ballAcceleration(ball, G);
  const pockets = getPockets(table);

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

  // Filter out collisions in pocket zones
  const valid = collisions.filter(
    (c) => c.time > 1e-6 && !isInPocketGap(c.position, table, pockets),
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

// Line-circle intersection: find where the ball's trajectory ray crosses the pocket's fall circle.
// Returns the intersection point closest to the cloth (playing surface), or null.
export function linePocketIntersection(
  ballPos: Vec2,
  ballDir: Vec2,
  pocket: Pocket,
): Vec2 | null {
  const cx = pocket.fallCenter[0];
  const cy = pocket.fallCenter[1];
  const r = pocket.fallRadius;

  // Ray: P(t) = ballPos + ballDir * t, t >= 0
  const ex = ballPos[0] - cx;
  const ey = ballPos[1] - cy;
  const dx = ballDir[0];
  const dy = ballDir[1];

  const a = dx * dx + dy * dy;
  const b = 2 * (ex * dx + ey * dy);
  const c = ex * ex + ey * ey - r * r;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  // Return the first intersection ahead of the ball (smallest positive t = entry point)
  if (t1 > 1e-6) return [ballPos[0] + dx * t1, ballPos[1] + dy * t1];
  if (t2 > 1e-6) return [ballPos[0] + dx * t2, ballPos[1] + dy * t2];
  return null;
}

function predictPocketEntry(
  ball: BallState,
  table: Table,
): { time: number; pocketIndex: number } | null {
  if (ball.motion === MotionState.STOPPED) return null;

  const speed = norm(ball.vel);
  if (speed < 1e-9) return null;

  const dir: Vec2 = [ball.vel[0] / speed, ball.vel[1] / speed];
  const pockets = getPockets(table);
  let earliest: { time: number; pocketIndex: number } | null = null;

  for (let pi = 0; pi < pockets.length; pi++) {
    const pocket = pockets[pi];
    const hitPoint = linePocketIntersection(ball.pos, dir, pocket);
    if (hitPoint === null) continue;

    // Distance from ball center to the intersection point on the fall circle
    const dx = hitPoint[0] - ball.pos[0];
    const dy = hitPoint[1] - ball.pos[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 0) continue;

    const t = timeToTravelDistance(ball, dist, G);
    if (t !== null && t > 1e-6) {
      if (earliest === null || t < earliest.time) {
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
