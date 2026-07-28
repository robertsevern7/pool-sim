import { MotionState } from "./ball-state";
import { G, getPockets } from "./constants";
import type { Table } from "./constants";
import { getJawSegments, getRailSegments } from "./jaw-geometry";
import type { CushionSegment } from "./jaw-geometry";
import type { SimulationState } from "./simulation-state";
import type { BallState } from "./ball-state";
import {
  ballAcceleration,
  timeRollingToStop,
  timeSlidingToRolling,
} from "./motion-models";
import { add, sub, scale, dot, norm, Vec2 } from "./vec2";
import { solvePolynomial } from "./polynomial";

export interface Event {
  time: number;
  eventType: "BALL_COLLISION" | "RAIL_COLLISION" | "STATE_CHANGE" | "POCKET";
  a: number;
  b: number | null;
  normal?: Vec2; // set on every RAIL_COLLISION computeNextEvent produces (rail or jaw alike —
                 // both are just CushionSegments); optional only for hand-constructed Events
                 // (tests) that want resolveEvent's axis-aligned fallback derivation instead.
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

// Predicts collision with the earliest of a set of bounded ball-center collision segments
// (straight rail pieces and/or angled jaw noses — see jaw-geometry.ts, both share the same
// CushionSegment shape). Exact closed-form approach: solve the quadratic-in-acceleration for
// when the ball's center reaches a segment's line, then clamp to the segment's finite
// extent. Rail and jaw segments tile the table boundary with no gap or overlap (each rail
// piece is bounded exactly by the heels of the jaw segments flanking it), so racing them all
// by time — rather than treating the rail as an infinite line with a special-cased
// exclusion zone — is both simpler and exact: whichever segment the ball's center actually
// reaches first wins, with no separate notion of "is this position in a gap".
function predictSegmentCollision(
  ball: BallState,
  table: Table,
  segments: CushionSegment[],
): { time: number; normal: Vec2 } | null {
  const a = ballAcceleration(ball, G);
  const tMax = predictStateTransition(ball) ?? Infinity;

  let best: { time: number; normal: Vec2 } | null = null;

  for (const seg of segments) {
    const segVec = sub(seg.p2, seg.p1);
    const segLen = norm(segVec);
    const segDir = scale(segVec, 1 / segLen);

    // p1/p2 already sit on the ball-center collision line (offset by BALL_RADIUS from the
    // true cushion surface during construction — see jaw-geometry.ts), so the condition is
    // simply dot(pos(t) - p1, normal) = 0, not offset by radius again.
    const p0rel = sub(ball.pos, seg.p1);
    const coeffA = 0.5 * dot(a, seg.normal);
    const coeffB = dot(ball.vel, seg.normal);
    const coeffC = dot(p0rel, seg.normal);

    let coeffs = [coeffA, coeffB, coeffC];
    while (coeffs.length > 1 && coeffs[0] === 0) {
      coeffs.shift();
    }
    if (coeffs.length <= 1) continue;

    for (const t of solvePolynomial(coeffs)) {
      if (t <= 1e-6 || t > tMax) continue;
      if (best !== null && t >= best.time) continue;

      // Only a genuine approach (signed distance from the face decreasing through zero)
      // counts as a collision — a root where the ball is moving away from the face is
      // either separating or, at a segment's own endpoint, just the ball passing tangent
      // to this segment's infinite line while actually under an adjoining segment's
      // jurisdiction (e.g. rolling straight along a rail, through the heel, onto a jaw).
      const derivAtT = coeffB + 2 * coeffA * t;
      if (derivAtT >= 0) continue;

      const pos = add(add(ball.pos, scale(ball.vel, t)), scale(a, 0.5 * t * t));
      const s = dot(sub(pos, seg.p1), segDir);
      if (s < -1e-6 || s > segLen + 1e-6) continue;

      best = { time: t, normal: seg.normal };
    }
  }

  return best;
}

// All cushion collisions (straight rail pieces + angled jaw noses) raced together — see
// predictSegmentCollision. This is what computeNextEvent uses; predictRailCollision and
// predictJawCollision below are the same underlying race restricted to just one segment
// set, kept for callers/tests that only care about one kind of cushion.
export function predictCushionCollision(
  ball: BallState,
  table: Table,
): { time: number; normal: Vec2 } | null {
  const segments = [...getRailSegments(table), ...getJawSegments(table)];
  return predictSegmentCollision(ball, table, segments);
}

export function predictRailCollision(
  ball: BallState,
  table: Table,
): number | null {
  const result = predictSegmentCollision(ball, table, getRailSegments(table));
  return result ? result.time : null;
}

export function predictJawCollision(
  ball: BallState,
  table: Table,
): { time: number; normal: Vec2 } | null {
  return predictSegmentCollision(ball, table, getJawSegments(table));
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

  // No early exit on vel = 0: a spinning ball can accelerate from rest (see
  // ballAcceleration), so its trajectory can still cross a pocket's fall circle. The
  // quartic below handles that case directly — it degenerates to "no roots" on its own
  // when the ball is truly motionless (vel = 0 and no spin-driven acceleration).
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
      if (t !== null && (earliest === null || state.time + t < earliest.time)) {
        earliest = {
          time: state.time + t,
          eventType: "BALL_COLLISION",
          a: i,
          b: j,
        };
      }
    }
  }

  // cushion collisions (straight rail pieces + angled jaw noses, raced together as one
  // set of bounded segments — see predictCushionCollision / getRailSegments / getJawSegments)
  for (let i = 0; i < state.balls.length; i++) {
    const result = predictCushionCollision(state.balls[i], table);
    if (result !== null && (earliest === null || state.time + result.time < earliest.time)) {
      earliest = {
        time: state.time + result.time,
        eventType: "RAIL_COLLISION",
        a: i,
        b: null,
        normal: result.normal,
      };
    }
  }

  // pocket entries
  for (let i = 0; i < state.balls.length; i++) {
    const result = predictPocketEntry(state.balls[i], table);
    if (result !== null && (earliest === null || state.time + result.time < earliest.time)) {
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
    if (t !== null && (earliest === null || state.time + t < earliest.time)) {
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
