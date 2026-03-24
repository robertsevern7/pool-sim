import { MotionState } from "./ball-state";
import { G } from "./constants";
import type { Table } from "./constants";
import { computeNextEvent } from "./event-prediction";
import { resolveEvent } from "./event-resolution";
import { rollingMotion, slidingMotion } from "./motion-models";
import { SimulationState } from "./simulation-state";
import { BallState } from "./ball-state";
import type { Vec2 } from "./vec2";

export interface FrameBall {
  pos: Vec2;
  motion: MotionState;
  number: number;
}

export interface Frame {
  time: number;
  balls: FrameBall[];
}

function snapshotBalls(state: SimulationState): Frame {
  return {
    time: state.time,
    balls: state.balls.map((b) => ({ pos: [b.pos[0], b.pos[1]], motion: b.motion, number: b.number })),
  };
}

function interpolateState(state: SimulationState, dt: number): Frame {
  const balls = state.balls.map((ball) => {
    if (ball.motion === MotionState.SLIDING) {
      const { pos } = slidingMotion(ball, dt, G);
      return { pos: pos as Vec2, motion: ball.motion, number: ball.number };
    } else if (ball.motion === MotionState.ROLLING) {
      const { pos } = rollingMotion(ball, dt, G);
      return { pos: pos as Vec2, motion: ball.motion, number: ball.number };
    }
    return { pos: [ball.pos[0], ball.pos[1]] as Vec2, motion: ball.motion, number: ball.number };
  });
  return { time: state.time + dt, balls };
}

function advanceState(state: SimulationState, dt: number): void {
  for (const ball of state.balls) {
    if (ball.motion === MotionState.SLIDING) {
      const r = slidingMotion(ball, dt, G);
      ball.pos = r.pos;
      ball.vel = r.vel;
      ball.omega = r.omega;
    } else if (ball.motion === MotionState.ROLLING) {
      const r = rollingMotion(ball, dt, G);
      ball.pos = r.pos;
      ball.vel = r.vel;
      ball.omega = r.omega;
    }
  }
  state.time += dt;
}

export interface TrajectoryPoint {
  pos: Vec2;
  ghost: boolean; // true at ball-ball or rail collision
}

export type Trajectory = TrajectoryPoint[];

/**
 * Run the simulation and extract per-ball waypoints at collision events.
 * Between events the path is a straight line, so this gives clean segments.
 */
export function recordTrajectories(
  initialBalls: BallState[],
  table: Table,
): Trajectory[] {
  const balls = initialBalls.map(
    (b) => new BallState([b.pos[0], b.pos[1]], [b.vel[0], b.vel[1]], b.omega, b.motion, b.number),
  );
  const state = new SimulationState(balls, 0);
  const maxEvents = 10000;

  const trajectories: Trajectory[] = balls.map((b) => [
    { pos: [b.pos[0], b.pos[1]] as Vec2, ghost: false },
  ]);

  // Maps current state.balls index → original trajectory index
  const ballIndexMap: number[] = balls.map((_, i) => i);
  const pottedIndices = new Set<number>();

  for (let step = 0; step < maxEvents; step++) {
    const event = computeNextEvent(state, table);
    if (event === null) break;

    const dt = event.time - state.time;
    if (dt < 0) break;
    advanceState(state, dt);

    const isCollision = event.eventType === "BALL_COLLISION" || event.eventType === "RAIL_COLLISION";

    if (isCollision) {
      // Record waypoint for ball A
      trajectories[ballIndexMap[event.a]].push({
        pos: [state.balls[event.a].pos[0], state.balls[event.a].pos[1]],
        ghost: true,
      });
      // Record waypoint for ball B (ball-ball only)
      if (event.b !== null) {
        trajectories[ballIndexMap[event.b]].push({
          pos: [state.balls[event.b].pos[0], state.balls[event.b].pos[1]],
          ghost: true,
        });
      }
    }

    if (event.eventType === "POCKET") {
      // Record the pot position as a final ghost before the ball is removed
      trajectories[ballIndexMap[event.a]].push({
        pos: [state.balls[event.a].pos[0], state.balls[event.a].pos[1]],
        ghost: true,
      });
      pottedIndices.add(ballIndexMap[event.a]);
    }

    resolveEvent(state, event, table);

    // After a pocket event, the ball array shifts — update the index map
    if (event.eventType === "POCKET") {
      ballIndexMap.splice(event.a, 1);
    }
  }

  // Add final resting positions for non-potted balls
  for (let i = 0; i < state.balls.length; i++) {
    const origIdx = ballIndexMap[i];
    const b = state.balls[i];
    const t = trajectories[origIdx];
    const last = t[t.length - 1];
    if (last.pos[0] !== b.pos[0] || last.pos[1] !== b.pos[1]) {
      t.push({ pos: [b.pos[0], b.pos[1]], ghost: true });
    } else {
      last.ghost = true;
    }
  }

  return trajectories;
}

export interface SimulationResult {
  frames: Frame[];
  /** Ball number of the first ball the cue ball collides with, or null */
  firstHitBallNumber: number | null;
  /** Whether any ball hit a rail after the first ball-ball contact */
  railHitAfterContact: boolean;
}

/**
 * Run the simulation and record frames at a fixed interval.
 */
export function recordSimulation(
  initialBalls: BallState[],
  table: Table,
  fps: number = 60,
): SimulationResult {
  // Deep copy initial balls so we don't mutate the originals
  const balls = initialBalls.map(
    (b) => new BallState([b.pos[0], b.pos[1]], [b.vel[0], b.vel[1]], b.omega, b.motion, b.number),
  );
  const state = new SimulationState(balls, 0);
  const interval = 1 / fps;
  const frames: Frame[] = [snapshotBalls(state)];
  const maxEvents = 10000;
  let nextFrameTime = interval;

  let cueIdx = balls.findIndex((b) => b.number === 0);
  let firstHitBallNumber: number | null = null;
  let hadBallContact = false;
  let railHitAfterContact = false;

  for (let step = 0; step < maxEvents; step++) {
    const event = computeNextEvent(state, table);

    if (event === null) {
      if (state.time < nextFrameTime) {
        frames.push(snapshotBalls(state));
      }
      break;
    }

    const eventTime = event.time;

    while (nextFrameTime <= eventTime) {
      const dt = nextFrameTime - state.time;
      frames.push(interpolateState(state, dt));
      nextFrameTime += interval;
    }

    const dt = eventTime - state.time;
    if (dt < 0) break;
    advanceState(state, dt);

    // Track first hit by cue ball
    if (event.eventType === "BALL_COLLISION") {
      if (firstHitBallNumber === null && cueIdx >= 0) {
        if (event.a === cueIdx && event.b !== null) {
          firstHitBallNumber = state.balls[event.b].number;
        } else if (event.b === cueIdx) {
          firstHitBallNumber = state.balls[event.a].number;
        }
      }
      hadBallContact = true;
    }

    // Track rail hit after any ball-ball contact
    if (hadBallContact && !railHitAfterContact && event.eventType === "RAIL_COLLISION") {
      railHitAfterContact = true;
    }

    // If cue ball is pocketed, update cueIdx
    if (event.eventType === "POCKET") {
      if (event.a === cueIdx) {
        cueIdx = -1;
      } else if (event.a < cueIdx) {
        cueIdx--;
      }
    }

    resolveEvent(state, event, table);
  }

  return { frames, firstHitBallNumber, railHitAfterContact };
}
