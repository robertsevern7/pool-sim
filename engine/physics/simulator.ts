import { MotionState } from "./ball-state";
import { G } from "./constants";
import type { Table } from "./constants";
import { computeNextEvent } from "./event-prediction";
import { resolveEvent } from "./event-resolution";
import { rollingMotion, slidingMotion } from "./motion-models";
import type { SimulationState } from "./simulation-state";

export function advanceState(state: SimulationState, dt: number): void {
  for (const ball of state.balls) {
    if (ball.motion === MotionState.SLIDING) {
      const result = slidingMotion(ball, dt, G);
      ball.pos = result.pos;
      ball.vel = result.vel;
      ball.omega = result.omega;
    } else if (ball.motion === MotionState.ROLLING) {
      const result = rollingMotion(ball, dt, G);
      ball.pos = result.pos;
      ball.vel = result.vel;
      ball.omega = result.omega;
    }
  }
  state.time += dt;
}

export function simulate(state: SimulationState, table: Table): void {
  const maxEvents = 10000;

  for (let step = 0; step < maxEvents; step++) {
    const event = computeNextEvent(state, table);

    if (event === null) break;

    const dt = event.time - state.time;

    if (dt < 0) break;

    advanceState(state, dt);
    resolveEvent(state, event, table);
  }
}
