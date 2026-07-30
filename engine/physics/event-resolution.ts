import { BallState, MotionState } from "./ball-state";
import {
  BALL_FRICTION,
  BALL_RADIUS,
  CUSHION_CONTACT_SIN_THETA,
  CUSHION_RESTITUTION,
  MU_SLIDE,
  RAIL_FRICTION,
  Table,
} from "./constants";
import type { Event } from "./event-prediction";
import type { SimulationState } from "./simulation-state";
import { sub, dot, scale, norm, add, rotate90, Vec2 } from "./vec2";

const CONTACT_THRESHOLD = BALL_RADIUS * 2 + 1e-4;

// Solid-sphere moment of inertia about its own center: I = (2/5) m R².
function momentOfInertia(mass: number): number {
  return (2 / 5) * mass * BALL_RADIUS * BALL_RADIUS;
}

function resolveBallCollision(a: BallState, b: BallState): void {
  const n = sub(a.pos, b.pos);
  const nLen = norm(n);
  if (nLen === 0) return;
  const nHat: Vec2 = [n[0] / nLen, n[1] / nLen];

  const relVel = sub(a.vel, b.vel);
  const velNorm = dot(relVel, nHat);

  // Only resolve if balls are approaching
  if (velNorm > 0) return;

  const impulse = (-2 * velNorm) / (a.mass + b.mass);
  const normalImpulse = impulse * a.mass * b.mass;

  a.vel = add(a.vel, scale(nHat, impulse * b.mass));
  b.vel = sub(b.vel, scale(nHat, impulse * a.mass));

  // Throw: sidespin (spinZ) gives the contact point a tangential slip velocity — the
  // horizontal-plane omega used for cloth contact only contributes a *vertical* velocity
  // here (the table's normal force absorbs that; we don't model it), so only spinZ matters.
  // Deliberately spin-only, not cut-angle-tangential-velocity-based: this engine already
  // treats a spinless cut/stun shot as following the exact geometric tangent line elsewhere
  // (see event-resolution.test.ts), so cut-angle-alone contributes no slip here — only
  // english does. Kinetic friction opposes that slip, bounded by BALL_FRICTION * the normal
  // impulse just applied. This is what deflects a cut ball (and the cue ball) off the pure
  // tangent line when the cue ball carries english.
  const tangentDir = rotate90(nHat);
  const relSlipTangential = -BALL_RADIUS * (a.spinZ + b.spinZ);

  if (Math.abs(relSlipTangential) > 1e-9) {
    const tangentImpulse = -Math.sign(relSlipTangential) * BALL_FRICTION * normalImpulse;

    a.vel = add(a.vel, scale(tangentDir, tangentImpulse / a.mass));
    b.vel = sub(b.vel, scale(tangentDir, tangentImpulse / b.mass));

    // Equal and opposite torque (about each ball's own center, lever arm = radius) on both
    // balls — friction acts at the same physical point, R away from each ball's own center.
    a.spinZ += (-BALL_RADIUS * tangentImpulse) / momentOfInertia(a.mass);
    b.spinZ += (-BALL_RADIUS * tangentImpulse) / momentOfInertia(b.mass);
  }

  const pairs: [BallState, Vec2][] = [
    [a, scale(nHat, -1)],
    [b, nHat],
  ];

  for (const [ball, spinDir] of pairs) {
    const speed = norm(ball.vel);
    if (speed < 1e-9 && norm(ball.omega) < 1e-9 && Math.abs(ball.spinZ) < 1e-9) {
      ball.vel = [0, 0];
      ball.motion = MotionState.STOPPED;
    } else if (speed < 1e-9 && (norm(ball.omega) > 1e-9 || Math.abs(ball.spinZ) > 1e-9)) {
      ball.vel = scale(spinDir, 1e-6);
      ball.motion = MotionState.SLIDING;
    } else {
      ball.motion = MotionState.SLIDING;
    }
  }
}

/**
 * After a ball-ball collision, propagate impulses through any chain of
 * touching balls. Uses sequential impulse resolution — iterate until
 * no approaching contacts remain.
 */
function resolveContactChain(state: SimulationState, seedA: number, seedB: number): void {
  const maxIterations = 1000;

  // Start by checking all pairs that include the two initially colliding balls
  const dirty = new Set<number>([seedA, seedB]);

  for (let iter = 0; iter < maxIterations; iter++) {
    let resolved = false;

    for (let i = 0; i < state.balls.length; i++) {
      for (let j = i + 1; j < state.balls.length; j++) {
        // Only check pairs involving a ball that recently changed velocity
        if (!dirty.has(i) && !dirty.has(j)) continue;

        const a = state.balls[i];
        const b = state.balls[j];
        const d = norm(sub(a.pos, b.pos));

        if (d > CONTACT_THRESHOLD) continue;

        // Check if approaching
        const n = sub(a.pos, b.pos);
        const nLen = norm(n);
        if (nLen === 0) continue;
        const nHat: Vec2 = [n[0] / nLen, n[1] / nLen];
        const relVelNorm = dot(sub(a.vel, b.vel), nHat);

        if (relVelNorm >= 0) continue; // separating or stationary

        resolveBallCollision(a, b);
        dirty.add(i);
        dirty.add(j);
        resolved = true;
      }
    }

    if (!resolved) break;
    // Clear dirty set and refill with all balls that moved
    // (keep checking until stable)
    dirty.clear();
    for (let i = 0; i < state.balls.length; i++) {
      if (norm(state.balls[i].vel) > 1e-9) dirty.add(i);
    }
  }
}

const SIN_THETA = CUSHION_CONTACT_SIN_THETA;
const COS_THETA = Math.sqrt(1 - SIN_THETA * SIN_THETA);

// Ball-cushion impact, following Mathavan, Jackson & Parkin (2010) in full: the cushion's
// true contact normal is tilted off horizontal by θ (see CUSHION_CONTACT_SIN_THETA), and
// the ball is in contact with the table felt (point B) at the same time it's in contact
// with the cushion (point A) — two coupled friction contacts, not one. Neither contact's
// dynamics can be written down as a single closed-form step, so — exactly as the paper
// does — this integrates forward using the cushion's own accumulated normal impulse as the
// independent variable, small increment by small increment, until the compression phase
// (ball still driving into the cushion) and then the restitution phase (rebounding) both
// complete. The paper's own kinematic simplification carries over directly: the cushion's
// slope is built so the ball's center never accelerates vertically during the impact, so
// the table's own normal reaction is derived from that constraint each step rather than
// tracked as a free variable, and the ball's vertical velocity never needs representing at
// all — this function only ever touches the existing (normal, tangent, spinZ) state.
function resolveRailCollision(ball: BallState, normal: Vec2): void {
  const tangentDir = rotate90(normal);
  const R = BALL_RADIUS;
  const M = ball.mass;
  const I = momentOfInertia(M);

  // State along the rail-local (normal, tangent) axes, plus vertical-axis spin.
  let vN = dot(ball.vel, normal);
  let vT = dot(ball.vel, tangentDir);
  let wN = dot(ball.omega, normal);
  let wT = dot(ball.omega, tangentDir);
  let wZ = ball.spinZ;

  // Size of the normal-impulse increment: a rough estimate of the total impulse a simple
  // (1+e) rebound would take along the cushion's true (tilted) normal, divided into enough
  // steps for a stable integration — same idea as the paper's own Section 3.4 note that an
  // initial estimate of ~5000 steps "worked satisfactorily".
  const closingSpeed = Math.max(Math.abs(COS_THETA * vN), 1e-6);
  const totalImpulseEstimate = (1 + CUSHION_RESTITUTION) * M * closingSpeed;
  const STEPS = 4000;
  const dPn = totalImpulseEstimate / STEPS;
  const MAX_ITERATIONS = STEPS * 10;

  let compressionDone = vN >= 0; // guard: already separating (shouldn't normally happen)
  let work = 0;
  let targetWork = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // Slip at the cushion contact (A), resolved in ITS tangent plane: along the rail (T)
    // and along the in-plane direction perpendicular to the tilted contact normal (Y').
    const slipAT = vT - R * COS_THETA * wZ - R * SIN_THETA * wN;
    const slipAY = SIN_THETA * vN + R * wT;
    const slipA = Math.hypot(slipAT, slipAY);

    // Slip at the table/felt contact (B) — the same horizontal slip this engine already
    // uses for ordinary rolling/sliding on the cloth, since B is a plain flat contact.
    const slipBN = vN - R * wT;
    const slipBT = vT + R * wN;
    const slipB = Math.hypot(slipBN, slipBT);

    // Cushion friction impulse this step (zero if the ball is momentarily rolling at A).
    const fricAT = slipA > 1e-9 ? -RAIL_FRICTION * dPn * (slipAT / slipA) : 0;
    const fricAY = slipA > 1e-9 ? -RAIL_FRICTION * dPn * (slipAY / slipA) : 0;

    // The cushion's normal force acts at height R·sinθ above center, tilted by θ off
    // horizontal — its impulse decomposes into the table-plane normal and vertical axes,
    // and the cushion friction's Y'-component (in-plane, perpendicular to the tilt) does
    // too. Vertical: the table's own normal impulse is whatever keeps that sum at zero
    // (the ball's center never accelerates vertically — see the function comment above).
    const dPa_N = dPn * COS_THETA + fricAY * SIN_THETA;
    const dPa_Z = -dPn * SIN_THETA + fricAY * COS_THETA;
    const dPb_normal = -dPa_Z;

    // Table friction impulse this step (zero if momentarily rolling at B).
    const fricBN = slipB > 1e-9 ? -MU_SLIDE * dPb_normal * (slipBN / slipB) : 0;
    const fricBT = slipB > 1e-9 ? -MU_SLIDE * dPb_normal * (slipBT / slipB) : 0;

    const dvN = (dPa_N + fricBN) / M;
    const dvT = (fricAT + fricBT) / M;
    const dwN = (-R * SIN_THETA * fricAT + R * fricBT) / I;
    const dwT = (R * COS_THETA * dPa_Z + R * SIN_THETA * dPa_N - R * fricBN) / I;
    const dwZ = (-R * COS_THETA * fricAT) / I;

    const zDotPrimeBefore = -COS_THETA * vN;

    vN += dvN;
    vT += dvT;
    wN += dwN;
    wT += dwT;
    wZ += dwZ;

    const zDotPrimeAfter = -COS_THETA * vN;
    work += dPn * (zDotPrimeBefore + zDotPrimeAfter) * 0.5;

    if (!compressionDone) {
      if (vN >= 0) {
        compressionDone = true;
        targetWork = (1 - CUSHION_RESTITUTION * CUSHION_RESTITUTION) * work;
      }
    } else if (work <= targetWork) {
      break;
    }
  }

  ball.vel = add(scale(normal, vN), scale(tangentDir, vT));
  ball.omega = add(scale(normal, wN), scale(tangentDir, wT));
  ball.spinZ = wZ;
  ball.motion = MotionState.SLIDING;
}

export function resolveEvent(
  state: SimulationState,
  event: Event,
  table: Table,
): void {
  if (event.eventType === "BALL_COLLISION") {
    resolveBallCollision(state.balls[event.a], state.balls[event.b!]);
    resolveContactChain(state, event.a, event.b!);
  } else if (event.eventType === "RAIL_COLLISION") {
    const ball = state.balls[event.a];

    let normal: Vec2;
    if (event.normal) {
      normal = event.normal;
    } else if (ball.pos[0] <= ball.radius) {
      normal = [1, 0];
    } else if (ball.pos[0] >= table.width - ball.radius) {
      normal = [-1, 0];
    } else if (ball.pos[1] <= ball.radius) {
      normal = [0, 1];
    } else {
      normal = [0, -1];
    }

    resolveRailCollision(ball, normal);
  } else if (event.eventType === "POCKET") {
    state.balls.splice(event.a, 1);
  } else if (event.eventType === "STATE_CHANGE") {
    const ball = state.balls[event.a];

    if (ball.motion === MotionState.SLIDING) {
      ball.motion = MotionState.ROLLING;
    } else if (ball.motion === MotionState.ROLLING) {
      ball.motion = MotionState.STOPPED;
      ball.vel = [0, 0];
    }
  }
}
