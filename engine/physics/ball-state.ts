import { BALL_MASS, BALL_RADIUS, MU_ROLL, MU_SLIDE } from "./constants";
import type { Vec2 } from "./vec2";

export enum MotionState {
  SLIDING = 1,
  ROLLING = 2,
  STOPPED = 3,
}

export class BallState {
  static readonly radius = BALL_RADIUS;
  static readonly mass = BALL_MASS;

  pos: [number, number];
  vel: [number, number];
  /** Horizontal-plane angular velocity vector (spin axis), independent of vel's direction. */
  omega: Vec2;
  motion: MotionState;
  /** Ball identity: 0 = cue, 1–15 = object balls */
  number: number;

  constructor(
    pos: [number, number],
    vel: [number, number],
    omega: Vec2,
    motion: MotionState,
    ballNumber: number = 0,
  ) {
    this.pos = [pos[0], pos[1]];
    this.vel = [vel[0], vel[1]];
    this.omega = [omega[0], omega[1]];
    this.motion = motion;
    this.number = ballNumber;
  }

  get radius() {
    return BallState.radius;
  }
  get mass() {
    return BallState.mass;
  }

  mu(): number | null {
    if (this.motion === MotionState.SLIDING) return MU_SLIDE;
    if (this.motion === MotionState.ROLLING) return MU_ROLL;
    return null;
  }
}
