import { BallState } from "./ball-state";

export class SimulationState {
  balls: BallState[];
  time: number;

  constructor(balls: BallState[], time: number) {
    this.balls = balls;
    this.time = time;
  }
}
