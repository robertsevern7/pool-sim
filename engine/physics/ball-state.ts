import { BALL_MASS, BALL_RADIUS, MU_ROLL, MU_SLIDE } from "./constants";

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
  omega: number;
  motion: MotionState;

  constructor(
    pos: [number, number],
    vel: [number, number],
    omega: number,
    motion: MotionState,
  ) {
    this.pos = [pos[0], pos[1]];
    this.vel = [vel[0], vel[1]];
    this.omega = omega;
    this.motion = motion;
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
