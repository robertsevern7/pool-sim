import { BallState, MotionState } from "./physics/ball-state";
import { BALL_RADIUS, STANDARD_9_FOOT, MU_ROLL, G, MAX_SQUIRT_ANGLE } from "./physics/constants";
import { cueStrike } from "./physics/motion-models";
import { normalize, rotate90, rotateByAngle, scale, Vec2 } from "./physics/vec2";
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
  scenario("curve_into_pocket", () => {
    // Thin cut with max follow: the cue ball separates onto a tangent line that alone
    // would slide past the top-right corner, but retains its pre-collision topspin —
    // now misaligned with the new direction — so it curves the rest of the way in.
    // See predictPocketEntry in engine/physics/event-prediction.ts.
    return [
      cueStrike([2.2, 0.14], [1, 0], 2.5, 1.0),
      obj([2.7, 0.15], 1),
    ];
  }),
  scenario("corner_jaw_skim", () => {
    // Regression demo: this trajectory skims through the top-right corner pocket's mouth at
    // a shallow angle, missing the small capture (fall) circle. Before the fix, the physics
    // engine had no collision geometry for the angled jaw/nose cushions that bridge the
    // straight rail to a pocket opening — a ball on this path would sail straight off the
    // table and never stop. It now bounces off the jaw and stays in play. See
    // jaw-geometry.ts and predictJawCollision in engine/physics/event-prediction.ts.
    const pos: Vec2 = [TABLE.width - 0.4, R + 0.01];
    const vel: Vec2 = [4, 0.3];
    return [new BallState(pos, vel, [0, 0], MotionState.SLIDING)];
  }),
  scenario("straight_down_x15th", () => {
    // Debug scenario: a ball shot straight down the RENDERED table. TableView's toScreen
    // maps engine pos[0] -> screen-y and pos[1] -> screen-x, so "straight down" (screen-
    // vertical) means moving along pos[0] with pos[1] held fixed, and the fixed on-screen
    // x position (1/15 of the way across the table, i.e. table height / 15 — screen-x
    // corresponds to the engine's height axis) sits close enough to the corner to be near
    // jaw territory. Checks whether the ball correctly bounces off the plain straight rail
    // here rather than skipping ahead to a jaw/corner collision.
    const screenXPos = TABLE.height / 15;
    const startX = R + 0.05;
    return [new BallState([startX, screenXPos], [3, 0], [0, 0], MotionState.ROLLING)];
  }),
  scenario("draw_creep", () => {
    // A full/head-on hit transfers the cue ball's entire velocity to the object ball
    // (there's no tangential component to leave behind), so the cue ball's vel drops to
    // ~0 right at contact — but the collision doesn't touch omega, so its backspin
    // survives untouched. That's pure spin with zero velocity, still SLIDING. It should
    // draw back afterward under spin-driven friction rather than stay frozen at the
    // point of contact. See ballAcceleration/slidingMotion in engine/physics/motion-models.ts.
    const gap = 0.4;
    const cueX = TABLE.width / 2 - gap / 2;
    const objX = cueX + gap;
    return [
      cueStrike([cueX, CY], [1, 0], 2.0, -0.8),
      obj([objX, CY], 1),
    ];
  }),
  scenario("throw_off_line", () => {
    // Sidespin (english) on the cue ball gives the ball-ball contact point a tangential
    // slip, which kinetic friction opposes during the collision — this "throws" the cut
    // ball off the pure geometric tangent line. Same thin cut, same speed, as a spinless
    // shot would use — only the english differs. See resolveBallCollision in
    // engine/physics/event-resolution.ts.
    //
    // Sidespin also squirts the cue ball off its aim line (see "squirt_miss" below), which
    // would otherwise confound this demo by changing where the cut even lands — so the aim
    // direction here is pre-compensated for the squirt this exact sidespin will produce,
    // isolating throw the same way a player aiming to compensate for squirt would.
    const cueX = 0.4;
    const objX = 1.2;
    const objY = CY + 0.01;
    const sidespin = 1.0;
    const desiredDir = normalize([objX - cueX, objY - CY]);
    const squirtAngle = -sidespin * MAX_SQUIRT_ANGLE;
    const aimDir = rotateByAngle(desiredDir, -squirtAngle);
    return [
      cueStrike([cueX, CY], aimDir, 2.5, 0, sidespin),
      obj([objX, objY], 1),
    ];
  }),
  scenario("squirt_miss", () => {
    // Squirt: sidespin's tip offset gives the cue impulse a small reaction component not
    // aligned with the aim direction, deflecting the ball's actual initial path away from
    // where the cue was aimed — the tip has some "give" relative to the ball (see
    // MAX_SQUIRT_ANGLE in engine/physics/constants.ts). A dead-straight aim at an object
    // ball, with max sidespin and no compensation, squirts enough over this distance to
    // miss it completely — the same shot with no sidespin hits it dead center.
    // See cueStrike in engine/physics/motion-models.ts.
    const cueX = 0.4;
    const objX = 1.8;
    return [
      cueStrike([cueX, CY], [1, 0], 2.5, 0, 1.0),
      obj([objX, CY], 1),
    ];
  }),
  scenario("cushion_english", () => {
    // Rail throw ("cushion english"): sidespin gives the ball-cushion contact point a
    // tangential slip, same mechanism as ball-ball throw — kinetic friction opposes it,
    // changing the ball's rebound angle off the rail. Same bank shot, same speed, as a
    // spinless shot would use — only the english differs, and it lands in a very
    // different spot after just one rail bounce. See resolveRailCollision in
    // engine/physics/event-resolution.ts.
    return [cueStrike([0.4, 0.4], [1, 0.6], 2.5, 0, 1.0)];
  }),
  scenario("two_ball", () => [
    cueStrike([CUE_X, CY], [1, 0], 2.5),
    obj([OBJ_X, CY], 1),
    obj([OBJ_X, CY + 0.3], 10),
  ]),
];
