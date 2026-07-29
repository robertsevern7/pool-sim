import { BallState, MotionState } from "./physics/ball-state";
import { BALL_RADIUS, STANDARD_9_FOOT, MU_ROLL, G, MAX_SQUIRT_ANGLE, POCKET_CONFIG } from "./physics/constants";
import { cueStrike } from "./physics/motion-models";
import { add, normalize, rotate90, rotateByAngle, scale, sub, Vec2 } from "./physics/vec2";
import { scenario, obj, type Scenario } from "./scenarios";

const TABLE = STANDARD_9_FOOT;
const R = BALL_RADIUS;
const INCHES_TO_M = 0.0254;

// A rendered diamond marker sits on the wooden rail itself, not on the cushion face where
// the ball actually contacts — it's set back beyond the cushion by (at least) the cushion's
// own thickness. That matters for sighting: a straight line from a near point (a corner, or
// another diamond) THROUGH the diamond's true, set-back position crosses the cushion face
// at a different along-rail spot than the diamond's own along-rail coordinate — sighting
// directly at "the diamond's coordinate, placed on the cushion line" is a different, wrong
// line. This is the diamond's true position (fraction along the rail, at the rail's real
// perpendicular setback), for building a sightline through it — not a collision target.
const CUSHION_SETBACK_M = POCKET_CONFIG.cushionThickness * INCHES_TO_M;
function longRailDiamond(fraction: number, side: "near" | "far"): Vec2 {
  const y = side === "near" ? -CUSHION_SETBACK_M : TABLE.height + CUSHION_SETBACK_M;
  return [fraction * TABLE.width, y];
}

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
    // Tuned (via simulation, not closed-form) so the ball bounces off the far rail and
    // rolls all the way back to just touch the near rail — the far-rail rebound isn't a
    // simple restitution scaling, since the ball's post-bounce spin doesn't match its
    // reversed velocity, so it slides before settling back into a roll.
    const baulkX = TABLE.width / 4;
    const speed = 1.936;
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
    // Positions are the original demo's, scaled by TABLE.width / 2.84 (this table's width
    // when the demo was tuned) — verified to still curve the cue ball into the pocket.
    return [
      cueStrike([1.9676, 0.1252], [1, 0], 2.5, 1.0),
      obj([2.4148, 0.1342], 1),
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

  // ── Reference shots ──────────────────────────────────────────────────
  // Real diamond-system shots an experienced player would expect to work, used to tune
  // (and now guard, see engine/physics/__tests__/reference-shots.test.ts) the rail-cushion
  // physics — RAIL_CONTACT_HEIGHT_RATIO and RAIL_TANGENTIAL_RESTITUTION in particular.
  // Diamonds are at 1/8-table-length intervals along each long rail (skipping the side
  // pocket at the midpoint), matching TableView's own diamond markers.

  scenario("bank_corner_to_2nd", () => {
    // Sight from the corner THROUGH the 2nd diamond's true (rendered, set-back) position —
    // not at the diamond's raw along-rail coordinate placed on the cushion line, which is a
    // different, incorrect line (see CUSHION_SETBACK_M / longRailDiamond above).
    const corner: Vec2 = [0, 0];
    const diamond2 = longRailDiamond(2 / 8, "far");
    const dir = normalize(sub(diamond2, corner));
    const start: Vec2 = scale(dir, 0.28); // roughly in front of the corner, on the sightline
    const vel = scale(dir, 2.75); // medium pace
    return [new BallState(start, vel, scale(rotate90(vel), 1 / R), MotionState.ROLLING)];
  }, { section: "Reference Shots" }),

  scenario("bank_1st_to_3rd_firm", () => {
    // The cue ball's placement line runs through the rendered 1st diamond's and rendered
    // 3rd diamond's TRUE (set-back) positions — the ball sits on that line, roughly in
    // front of the 1st diamond — and the shot is AIMED through that same rendered 3rd
    // diamond's true position (see CUSHION_SETBACK_M / longRailDiamond above).
    const diamond1 = longRailDiamond(1 / 8, "near");
    const diamond3 = longRailDiamond(3 / 8, "far");
    const start = add(diamond1, scale(sub(diamond3, diamond1), 0.08));
    const dir = normalize(sub(diamond3, start));
    // Firm — cue ball is still sliding (not yet naturally rolling) when it reaches the rail.
    return [cueStrike(start, dir, 3.6, 0, 0)];
  }, { section: "Reference Shots" }),

  scenario("three_rail_corner5", () => {
    // The side pocket sits at the rail-numbering midpoint (fraction 4/8). The 4th diamond
    // — counting only the actual rendered markers, 1st through 6th, which skip over the
    // pocket itself — is the marker directly past it in the direction of travel, at
    // fraction 5/8 (LONG_RAIL_POSITIONS' own "5"). Aiming at the midpoint itself clips the
    // pocket's jaw and gets captured immediately with no rail bounce at all; this marker
    // sits a full diamond-spacing clear of the pocket's mouth. Sight through its TRUE
    // (rendered, set-back) position, same as the corner-to-diamond shots above — not its
    // raw along-rail coordinate placed on the cushion line.
    const start: Vec2 = [0.03, 0.03]; // essentially at the corner
    const firstRailTarget = longRailDiamond(4.85 / 8, "far");
    const desiredDir = normalize(sub(firstRailTarget, start));
    // Sidespin squirts the cue ball's actual initial path off the sighted line (see
    // throw_off_line above) — pre-compensate so it actually travels toward the diamond.
    const sidespin = 0.15; // a hair of running english
    const squirtAngle = -sidespin * MAX_SQUIRT_ANGLE;
    const aimDir = rotateByAngle(desiredDir, -squirtAngle);
    return [cueStrike(start, aimDir, 3.25, 0, sidespin)];
  }, { section: "Reference Shots" }),
];
