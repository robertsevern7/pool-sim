import { MotionState } from "./ball-state";
import { G } from "./constants";
import type { Table } from "./constants";
import { computeNextEvent } from "./event-prediction";
import { resolveEvent } from "./event-resolution";
import { rollingMotion, slidingMotion } from "./motion-models";
import { advanceSpinMarker, rollRate, SPIN_MARKER_REST, Vec3 } from "./orientation";
import { SimulationState } from "./simulation-state";
import { BallState } from "./ball-state";
import type { Vec2 } from "./vec2";

export interface FrameBall {
  pos: Vec2;
  motion: MotionState;
  number: number;
  /** Where a fixed point on the ball's surface has rotated to — see orientation.ts. */
  point: Vec3;
  /** Signed accumulated spinZ (radians) — the real on-screen rotation angle for english. */
  sideSpinAngle: number;
  /** Accumulated |omega| (radians) — the roll rate, kept separate from sideSpinAngle
   * because rotation about a horizontal axis doesn't look like an on-screen rotation
   * (see orientation.ts's rollRate doc). */
  rollPhase: number;
}

export interface Frame {
  time: number;
  balls: FrameBall[];
}

// Spin markers are integrated one recorder step at a time (see orientation.ts for why
// there's no closed form), so — unlike pos/vel/omega, which are recomputed fresh from
// each ball's last-event baseline — they need state that persists *across* calls. Keyed
// by ball identity rather than array index so a POCKET event's `state.balls.splice` can
// never desync it from the balls it describes.
interface MarkerTracker {
  point: Vec3;
  sideSpinAngle: number;
  rollPhase: number;
  /** How far into the current sliding/rolling phase (since its last real event) this marker has already caught up to. */
  lastDt: number;
}

function getTracker(trackers: WeakMap<BallState, MarkerTracker>, ball: BallState): MarkerTracker {
  let tracker = trackers.get(ball);
  if (!tracker) {
    tracker = { point: SPIN_MARKER_REST, sideSpinAngle: 0, rollPhase: 0, lastDt: 0 };
    trackers.set(ball, tracker);
  }
  return tracker;
}

/** Catch a ball's marker up to `dt` (elapsed since its last real event) using `omega` at that instant. */
function markerAt(
  trackers: WeakMap<BallState, MarkerTracker>,
  ball: BallState,
  omega: Vec2,
  dt: number,
): MarkerTracker {
  const tracker = getTracker(trackers, ball);
  const deltaT = dt - tracker.lastDt;
  if (deltaT > 0) {
    tracker.point = advanceSpinMarker(tracker.point, omega, ball.spinZ, deltaT);
    tracker.sideSpinAngle += ball.spinZ * deltaT;
    tracker.rollPhase += rollRate(omega) * deltaT;
    tracker.lastDt = dt;
  }
  return tracker;
}

/** Reset a ball's marker back to `dt = 0` — call once its state has actually committed to a new baseline. */
function resetTracker(trackers: WeakMap<BallState, MarkerTracker>, ball: BallState): void {
  getTracker(trackers, ball).lastDt = 0;
}

function snapshotBalls(state: SimulationState, trackers: WeakMap<BallState, MarkerTracker>): Frame {
  return {
    time: state.time,
    balls: state.balls.map((b) => {
      const tracker = getTracker(trackers, b);
      return {
        pos: [b.pos[0], b.pos[1]],
        motion: b.motion,
        number: b.number,
        point: tracker.point,
        sideSpinAngle: tracker.sideSpinAngle,
        rollPhase: tracker.rollPhase,
      };
    }),
  };
}

function interpolateState(
  state: SimulationState,
  dt: number,
  trackers: WeakMap<BallState, MarkerTracker>,
): Frame {
  const balls = state.balls.map((ball) => {
    if (ball.motion === MotionState.SLIDING) {
      const { pos, omega } = slidingMotion(ball, dt, G);
      const tracker = markerAt(trackers, ball, omega, dt);
      return { pos: pos as Vec2, motion: ball.motion, number: ball.number, point: tracker.point, sideSpinAngle: tracker.sideSpinAngle, rollPhase: tracker.rollPhase };
    } else if (ball.motion === MotionState.ROLLING) {
      const { pos, omega } = rollingMotion(ball, dt, G);
      const tracker = markerAt(trackers, ball, omega, dt);
      return { pos: pos as Vec2, motion: ball.motion, number: ball.number, point: tracker.point, sideSpinAngle: tracker.sideSpinAngle, rollPhase: tracker.rollPhase };
    }
    const tracker = getTracker(trackers, ball);
    return { pos: [ball.pos[0], ball.pos[1]] as Vec2, motion: ball.motion, number: ball.number, point: tracker.point, sideSpinAngle: tracker.sideSpinAngle, rollPhase: tracker.rollPhase };
  });
  return { time: state.time + dt, balls };
}

function advanceState(state: SimulationState, dt: number, trackers: WeakMap<BallState, MarkerTracker>): void {
  for (const ball of state.balls) {
    if (ball.motion === MotionState.SLIDING) {
      const r = slidingMotion(ball, dt, G);
      markerAt(trackers, ball, r.omega, dt);
      ball.pos = r.pos;
      ball.vel = r.vel;
      ball.omega = r.omega;
    } else if (ball.motion === MotionState.ROLLING) {
      const r = rollingMotion(ball, dt, G);
      markerAt(trackers, ball, r.omega, dt);
      ball.pos = r.pos;
      ball.vel = r.vel;
      ball.omega = r.omega;
    }
    resetTracker(trackers, ball);
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
    (b) => new BallState([b.pos[0], b.pos[1]], [b.vel[0], b.vel[1]], b.omega, b.motion, b.number, b.spinZ),
  );
  const state = new SimulationState(balls, 0);
  const maxEvents = 10000;
  // recordTrajectories doesn't render spin, but advanceState needs a tracker map regardless.
  const trackers = new WeakMap<BallState, MarkerTracker>();

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
    advanceState(state, dt, trackers);

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
    (b) => new BallState([b.pos[0], b.pos[1]], [b.vel[0], b.vel[1]], b.omega, b.motion, b.number, b.spinZ),
  );
  const state = new SimulationState(balls, 0);
  const interval = 1 / fps;
  const trackers = new WeakMap<BallState, MarkerTracker>();
  const frames: Frame[] = [snapshotBalls(state, trackers)];
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
        frames.push(snapshotBalls(state, trackers));
      }
      break;
    }

    const eventTime = event.time;

    while (nextFrameTime <= eventTime) {
      const dt = nextFrameTime - state.time;
      frames.push(interpolateState(state, dt, trackers));
      nextFrameTime += interval;
    }

    const dt = eventTime - state.time;
    if (dt < 0) break;
    advanceState(state, dt, trackers);

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
