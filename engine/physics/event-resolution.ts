import { BallState, MotionState } from "./ball-state";
import { BALL_RADIUS, RAIL_RESTITUTION, Table } from "./constants";
import type { Event } from "./event-prediction";
import type { SimulationState } from "./simulation-state";
import { sub, dot, scale, norm, add, Vec2 } from "./vec2";

const CONTACT_THRESHOLD = BALL_RADIUS * 2 + 1e-4;

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

  a.vel = add(a.vel, scale(nHat, impulse * b.mass));
  b.vel = sub(b.vel, scale(nHat, impulse * a.mass));

  const pairs: [BallState, Vec2][] = [
    [a, scale(nHat, -1)],
    [b, nHat],
  ];

  for (const [ball, spinDir] of pairs) {
    const speed = norm(ball.vel);
    if (speed < 1e-9 && norm(ball.omega) < 1e-9) {
      ball.vel = [0, 0];
      ball.motion = MotionState.STOPPED;
    } else if (speed < 1e-9 && norm(ball.omega) > 1e-9) {
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

  ball.vel = sub(vt, scale(vn, restitution));
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
    if (ball.pos[0] <= ball.radius) {
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
