import { BallState, MotionState } from "./ball-state";
import { RAIL_RESTITUTION, Table } from "./constants";
import type { Event } from "./event-prediction";
import type { SimulationState } from "./simulation-state";
import { sub, dot, scale, norm, add, Vec2 } from "./vec2";

function resolveBallCollision(a: BallState, b: BallState): void {
  const n = sub(a.pos, b.pos);
  const nLen = norm(n);
  const nHat: Vec2 = [n[0] / nLen, n[1] / nLen];

  const relVel = sub(a.vel, b.vel);
  const velNorm = dot(relVel, nHat);

  if (velNorm > 0) return;

  const impulse = (-2 * velNorm) / (a.mass + b.mass);

  a.vel = add(a.vel, scale(nHat, impulse * b.mass));
  b.vel = sub(b.vel, scale(nHat, impulse * a.mass));

  // For each ball: if velocity is ~0 but spin remains, seed a tiny velocity
  const pairs: [BallState, Vec2][] = [
    [a, scale(nHat, -1)],
    [b, nHat],
  ];

  for (const [ball, spinDir] of pairs) {
    const speed = norm(ball.vel);
    if (speed < 1e-9 && Math.abs(ball.omega) < 1e-9) {
      ball.vel = [0, 0];
      ball.motion = MotionState.STOPPED;
    } else if (speed < 1e-9 && Math.abs(ball.omega) > 1e-9) {
      ball.vel = scale(spinDir, 1e-6);
      ball.motion = MotionState.SLIDING;
    } else {
      ball.motion = MotionState.SLIDING;
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
    // Remove the potted ball
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
