import { MotionState } from "./ball-state";
import { G } from "./constants";
import type { Table } from "./constants";
import { computeNextEvent } from "./event-prediction";
import { resolveEvent } from "./event-resolution";
import { rollingMotion, slidingMotion } from "./motion-models";
import { SimulationState } from "./simulation-state";
import { BallState } from "./ball-state";
import type { Vec2 } from "./vec2";

export interface Frame {
  time: number;
  balls: { pos: Vec2; motion: MotionState }[];
}

function snapshotBalls(state: SimulationState): Frame {
  return {
    time: state.time,
    balls: state.balls.map((b) => ({ pos: [b.pos[0], b.pos[1]], motion: b.motion })),
  };
}

function interpolateState(state: SimulationState, dt: number): Frame {
  const balls = state.balls.map((ball) => {
    if (ball.motion === MotionState.SLIDING) {
      const { pos } = slidingMotion(ball, dt, G);
      return { pos: pos as Vec2, motion: ball.motion };
    } else if (ball.motion === MotionState.ROLLING) {
      const { pos } = rollingMotion(ball, dt, G);
      return { pos: pos as Vec2, motion: ball.motion };
    }
    return { pos: [ball.pos[0], ball.pos[1]] as Vec2, motion: ball.motion };
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

/**
 * Run the simulation and record frames at a fixed interval.
 * Returns an array of frames suitable for playback.
 */
export function recordSimulation(
  initialBalls: BallState[],
  table: Table,
  fps: number = 60,
): Frame[] {
  // Deep copy initial balls so we don't mutate the originals
  const balls = initialBalls.map(
    (b) => new BallState([b.pos[0], b.pos[1]], [b.vel[0], b.vel[1]], b.omega, b.motion),
  );
  const state = new SimulationState(balls, 0);
  const interval = 1 / fps;
  const frames: Frame[] = [snapshotBalls(state)];
  const maxEvents = 10000;
  let nextFrameTime = interval;

  for (let step = 0; step < maxEvents; step++) {
    const event = computeNextEvent(state, table);

    if (event === null) {
      // No more events — record final frame if needed
      if (state.time < nextFrameTime) {
        frames.push(snapshotBalls(state));
      }
      break;
    }

    const eventTime = event.time;

    // Record frames up to this event
    while (nextFrameTime <= eventTime) {
      const dt = nextFrameTime - state.time;
      frames.push(interpolateState(state, dt));
      nextFrameTime += interval;
    }

    // Advance to event and resolve
    const dt = eventTime - state.time;
    if (dt < 0) break;
    advanceState(state, dt);
    resolveEvent(state, event, table);
  }

  return frames;
}
