import { BallState, MotionState } from "./physics/ball-state";
import { BALL_RADIUS, STANDARD_9_FOOT, MU_ROLL, G } from "./physics/constants";
import { cueStrike } from "./physics/motion-models";
import { strings, ScenarioId } from "../constants/strings";

const TABLE = STANDARD_9_FOOT;
const R = BALL_RADIUS;

// Balls placed 1/3 of a table apart, centred on the table
const GAP = TABLE.width / 3;
const CUE_X = TABLE.width / 2 - GAP / 2;
const OBJ_X = CUE_X + GAP;
const CY = TABLE.height / 2;

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  createBalls: () => BallState[];
}

function scenario(id: ScenarioId, createBalls: () => BallState[]): Scenario {
  const { name, description } = strings.scenarios[id];
  return { id, name, description, createBalls };
}

export const ALL_SCENARIOS: Scenario[] = [
  scenario("rolling_direct", () => [
    cueStrike([CUE_X, CY], [1, 0], 2.0),
    new BallState([OBJ_X, CY], [0, 0], 0, MotionState.STOPPED),
  ]),
  scenario("half_ball_rolling", () => [
    cueStrike([CUE_X, CY], [1, 0], 2.5),
    new BallState([OBJ_X, CY + R], [0, 0], 0, MotionState.STOPPED),
  ]),
  scenario("stop_shot", () => [
    cueStrike([CUE_X, CY], [1, 0], 3.0, -0.435),
    new BallState([OBJ_X, CY], [0, 0], 0, MotionState.STOPPED),
  ]),
  scenario("half_ball_stun", () => [
    cueStrike([CUE_X, CY], [1, 0], 3.0, -0.435),
    new BallState([OBJ_X, CY + R], [0, 0], 0, MotionState.STOPPED),
  ]),
  scenario("max_draw", () => [
    cueStrike([CUE_X, CY], [1, 0], 3.0, -1.0),
    new BallState([OBJ_X, CY], [0, 0], 0, MotionState.STOPPED),
  ]),
  scenario("max_follow", () => [
    cueStrike([CUE_X, CY], [1, 0], 3.0, 1.0),
    new BallState([OBJ_X, CY], [0, 0], 0, MotionState.STOPPED),
  ]),
  scenario("lag_shot", () => {
    const baulkX = TABLE.width / 4;
    const speed = 1.832;
    return [
      new BallState([baulkX, CY], [speed, 0], speed / R, MotionState.ROLLING),
    ];
  }),
  scenario("baulk_to_rail", () => {
    const baulkX = TABLE.width / 4;
    const farRailDist = TABLE.width - R - baulkX;
    const speed = Math.sqrt(2 * MU_ROLL * G * farRailDist);
    return [
      new BallState([baulkX, CY], [speed, 0], speed / R, MotionState.ROLLING),
    ];
  }),
  scenario("pot_corner_tr", () => {
    const pX = TABLE.width, pY = 0;
    const objX = pX - 0.4, objY = pY + 0.4;
    const cueX = objX - 0.6, cueY = objY + 0.6;
    const dx = objX - cueX, dy = objY - cueY, len = Math.sqrt(dx * dx + dy * dy);
    return [
      cueStrike([cueX, cueY], [dx / len, dy / len], 2.5),
      new BallState([objX, objY], [0, 0], 0, MotionState.STOPPED),
    ];
  }),
  scenario("pot_corner_tl", () => {
    const pX = 0, pY = 0;
    const objX = pX + 0.4, objY = pY + 0.4;
    const cueX = objX + 0.6, cueY = objY + 0.6;
    const dx = objX - cueX, dy = objY - cueY, len = Math.sqrt(dx * dx + dy * dy);
    return [
      cueStrike([cueX, cueY], [dx / len, dy / len], 2.5),
      new BallState([objX, objY], [0, 0], 0, MotionState.STOPPED),
    ];
  }),
  scenario("pot_corner_br", () => {
    const pX = TABLE.width, pY = TABLE.height;
    const objX = pX - 0.4, objY = pY - 0.4;
    const cueX = objX - 0.6, cueY = objY - 0.6;
    const dx = objX - cueX, dy = objY - cueY, len = Math.sqrt(dx * dx + dy * dy);
    return [
      cueStrike([cueX, cueY], [dx / len, dy / len], 2.5),
      new BallState([objX, objY], [0, 0], 0, MotionState.STOPPED),
    ];
  }),
  scenario("pot_corner_bl", () => {
    const pX = 0, pY = TABLE.height;
    const objX = pX + 0.4, objY = pY - 0.4;
    const cueX = objX + 0.6, cueY = objY - 0.6;
    const dx = objX - cueX, dy = objY - cueY, len = Math.sqrt(dx * dx + dy * dy);
    return [
      cueStrike([cueX, cueY], [dx / len, dy / len], 2.5),
      new BallState([objX, objY], [0, 0], 0, MotionState.STOPPED),
    ];
  }),
  scenario("pot_side", () => {
    // Object ball near the top side pocket, cue ball lined up straight
    const pocketX = TABLE.width / 2;
    const pocketY = 0;
    const objX = pocketX;
    const objY = pocketY + 0.15;
    const cueX = pocketX;
    const cueY = objY + 0.5;
    return [
      cueStrike([cueX, cueY], [0, -1], 1.7),
      new BallState([objX, objY], [0, 0], 0, MotionState.STOPPED),
    ];
  }),

  scenario("pot_side_higher", () => {
    // Object ball near the top side pocket, cue ball lined up straight
    const pocketX = TABLE.width / 2;
    const pocketY = 0;
    const objX = pocketX - 0.02;
    const objY = pocketY + 0.15;
    const cueX = pocketX - 0.02;
    const cueY = objY + 0.5;
    return [
      cueStrike([cueX, cueY], [0, -1], 1.7),
      new BallState([objX, objY], [0, 0], 0, MotionState.STOPPED),
    ];
  }),

  scenario("pot_side_right", () => {
    // Object ball near the bottom side pocket (right rail), cue ball lined up straight
    const pocketX = TABLE.width / 2;
    const pocketY = TABLE.height;
    const objX = pocketX;
    const objY = pocketY - 0.15;
    const cueX = pocketX;
    const cueY = objY - 0.5;
    return [
      cueStrike([cueX, cueY], [0, 1], 1.7),
      new BallState([objX, objY], [0, 0], 0, MotionState.STOPPED),
    ];
  }),
];
