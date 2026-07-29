import { BallState, MotionState } from "./ball-state";
import {
  BALL_FRICTION,
  BALL_RADIUS,
  RAIL_CONTACT_HEIGHT_RATIO,
  RAIL_FRICTION,
  RAIL_RESTITUTION,
  RAIL_TANGENTIAL_RESTITUTION,
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

function resolveRailCollision(
  ball: BallState,
  normal: Vec2,
  restitution: number,
): void {
  const vn = scale(normal, dot(ball.vel, normal));
  const vt = sub(ball.vel, vn);
  const normalImpulse = ball.mass * norm(vn) * (1 + restitution);

  // Tangential velocity isn't fully preserved either — see RAIL_TANGENTIAL_RESTITUTION.
  ball.vel = sub(scale(vt, RAIL_TANGENTIAL_RESTITUTION), scale(vn, restitution));

  // The cushion nose contacts the ball above its center (see RAIL_CONTACT_HEIGHT_RATIO), so
  // the normal impulse just applied doesn't act through the center — it also torques the
  // ball about the rotate90(normal) axis, changing rolling-plane spin (omega), not just
  // spinZ. Unlike ball-ball contact (which is center-to-center, so omega never enters that
  // collision), this height offset is rail-specific.
  const contactHeight = RAIL_CONTACT_HEIGHT_RATIO * BALL_RADIUS;
  ball.omega = add(ball.omega, scale(rotate90(normal), (contactHeight * normalImpulse) / momentOfInertia(ball.mass)));

  // Rail throw: sidespin (spinZ) gives the ball-cushion contact point an *additional*
  // tangential slip on top of RAIL_TANGENTIAL_RESTITUTION's speed-only effect above — same
  // mechanism as ball-ball throw (the horizontal-plane omega used for cloth contact only
  // contributes a *vertical* velocity at this contact, which the table's normal force
  // absorbs — we don't model that). This is "cushion english": a spinning ball comes off a
  // rail at a different angle than a spinless one at the same speed, on top of the
  // spin-independent tangential loss every bounce gets.
  const tangentDir = rotate90(normal);
  const slipTangential = -ball.spinZ * BALL_RADIUS;

  if (Math.abs(slipTangential) > 1e-9) {
    const tangentImpulse = -Math.sign(slipTangential) * RAIL_FRICTION * normalImpulse;

    ball.vel = add(ball.vel, scale(tangentDir, tangentImpulse / ball.mass));
    ball.spinZ += (-BALL_RADIUS * tangentImpulse) / momentOfInertia(ball.mass);
  }

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

    resolveRailCollision(ball, normal, RAIL_RESTITUTION);
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
