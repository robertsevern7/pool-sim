import { BallState, MotionState } from "./physics/ball-state";
import { BALL_RADIUS, STANDARD_9_FOOT, MU_ROLL, G } from "./physics/constants";
import { cueStrike } from "./physics/motion-models";
import { rotate90, scale, Vec2 } from "./physics/vec2";
import { scenario, obj, type Scenario } from "./scenarios";

const TABLE = STANDARD_9_FOOT;
const R = BALL_RADIUS;

const GAP = TABLE.width / 3;
const CUE_X = TABLE.width / 2 - GAP / 2;
const OBJ_X = CUE_X + GAP;
const CY = TABLE.height / 2;

export const DEBUG_SCENARIOS: Scenario[] = [
  scenario("rolling_direct", () => [
    cueStrike([CUE_X, CY], [1, 0], 2.0),
    obj([OBJ_X, CY], 1),
  ]),
  scenario("half_ball_rolling", () => [
    cueStrike([CUE_X, CY], [1, 0], 2.5),
    obj([OBJ_X, CY + R], 1),
  ]),
  scenario("stop_shot", () => [
    cueStrike([CUE_X, CY], [1, 0], 3.0, -0.435),
    obj([OBJ_X, CY], 1),
  ]),
  scenario("half_ball_stun", () => [
    cueStrike([CUE_X, CY], [1, 0], 3.0, -0.435),
    obj([OBJ_X, CY + R], 1),
  ]),
  scenario("max_draw", () => [
    cueStrike([CUE_X, CY], [1, 0], 3.0, -1.0),
    obj([OBJ_X, CY], 1),
  ]),
  scenario("max_follow", () => [
    cueStrike([CUE_X, CY], [1, 0], 3.0, 1.0),
    obj([OBJ_X, CY], 1),
  ]),
  scenario("lag_shot", () => {
    const baulkX = TABLE.width / 4;
    const speed = 1.832;
    const vel: Vec2 = [speed, 0];
    return [
      new BallState([baulkX, CY], vel, scale(rotate90(vel), 1 / R), MotionState.ROLLING),
    ];
  }),
  scenario("baulk_to_rail", () => {
    const baulkX = TABLE.width / 4;
    const farRailDist = TABLE.width - R - baulkX;
    const speed = Math.sqrt(2 * MU_ROLL * G * farRailDist);
    const vel: Vec2 = [speed, 0];
    return [
      new BallState([baulkX, CY], vel, scale(rotate90(vel), 1 / R), MotionState.ROLLING),
    ];
  }),
  scenario("pot_corner_tr", () => {
    const pX = TABLE.width, pY = 0;
    const objX = pX - 0.4, objY = pY + 0.4;
    const cueX = objX - 0.6, cueY = objY + 0.6;
    const dx = objX - cueX, dy = objY - cueY, len = Math.sqrt(dx * dx + dy * dy);
    return [
      cueStrike([cueX, cueY], [dx / len, dy / len], 2.5),
      obj([objX, objY], 2),
    ];
  }),
  scenario("pot_corner_tl", () => {
    const pX = 0, pY = 0;
    const objX = pX + 0.4, objY = pY + 0.4;
    const cueX = objX + 0.6, cueY = objY + 0.6;
    const dx = objX - cueX, dy = objY - cueY, len = Math.sqrt(dx * dx + dy * dy);
    return [
      cueStrike([cueX, cueY], [dx / len, dy / len], 2.5),
      obj([objX, objY], 3),
    ];
  }),
  scenario("pot_corner_br", () => {
    const pX = TABLE.width, pY = TABLE.height;
    const objX = pX - 0.4, objY = pY - 0.4;
    const cueX = objX - 0.6, cueY = objY - 0.6;
    const dx = objX - cueX, dy = objY - cueY, len = Math.sqrt(dx * dx + dy * dy);
    return [
      cueStrike([cueX, cueY], [dx / len, dy / len], 2.5),
      obj([objX, objY], 4),
    ];
  }),
  scenario("pot_corner_bl", () => {
    const pX = 0, pY = TABLE.height;
    const objX = pX + 0.4, objY = pY - 0.4;
    const cueX = objX + 0.6, cueY = objY - 0.6;
    const dx = objX - cueX, dy = objY - cueY, len = Math.sqrt(dx * dx + dy * dy);
    return [
      cueStrike([cueX, cueY], [dx / len, dy / len], 2.5),
      obj([objX, objY], 5),
    ];
  }),
  scenario("pot_side", () => {
    const pocketX = TABLE.width / 2;
    const pocketY = 0;
    const objX = pocketX;
    const objY = pocketY + 0.15;
    const cueX = pocketX;
    const cueY = objY + 0.5;
    return [
      cueStrike([cueX, cueY], [0, -1], 1.7),
      obj([objX, objY], 6),
    ];
  }),
  scenario("pot_side_higher", () => {
    const pocketX = TABLE.width / 2;
    const pocketY = 0;
    const objX = pocketX - 0.02;
    const objY = pocketY + 0.15;
    const cueX = pocketX - 0.02;
    const cueY = objY + 0.5;
    return [
      cueStrike([cueX, cueY], [0, -1], 1.7),
      obj([objX, objY], 7),
    ];
  }),
  scenario("pot_side_right", () => {
    const pocketX = TABLE.width / 2;
    const pocketY = TABLE.height;
    const objX = pocketX;
    const objY = pocketY - 0.15;
    const cueX = pocketX;
    const cueY = objY - 0.5;
    return [
      cueStrike([cueX, cueY], [0, 1], 1.7),
      obj([objX, objY], 9),
    ];
  }),
  scenario("two_ball", () => [
    cueStrike([CUE_X, CY], [1, 0], 2.5),
    obj([OBJ_X, CY], 1),
    obj([OBJ_X, CY + 0.3], 10),
  ]),
];
