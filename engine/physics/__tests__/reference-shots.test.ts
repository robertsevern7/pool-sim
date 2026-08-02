// Reference-shot suite: real diamond-system shots a pool player would expect to work, used
// to guard the rail-cushion physics. Each shot encodes a specific real-world technique; if a
// future physics change breaks one of these, the game will have stopped feeling correct to
// an experienced player even though nothing "looks" wrong in isolation.
//
// The rail-cushion model (see resolveRailCollision in event-resolution.ts) now follows
// Mathavan, Jackson & Parkin (2010) directly: every rail constant left in constants.ts is
// either a fixed geometric fact (CUSHION_CONTACT_SIN_THETA) or a literature-fitted value
// (CUSHION_RESTITUTION, RAIL_FRICTION) — there is no free "outcome tuning" knob left at the
// physics-constant level. If one of these shots is to pot, the lever is the shot's own
// aim/speed/spin below (or in engine/debug-scenarios.ts), not a rail constant.
//
// Aim/placement geometry below is kept in lockstep with the matching scenarios in
// engine/debug-scenarios.ts (bank_corner_to_2nd, bank_1st_to_3rd_firm, three_rail_corner5)
// — that's the source of truth, visually confirmed against the rendered table. The three
// tests below are currently EXPECTED TO FAIL: the aim/placement is confirmed correct, but
// none of the three shots reach their intended pocket yet at the current speed/sidespin —
// outcome tuning is deliberately deferred, and these failures are the marker for that.
import { BallState, MotionState } from "../ball-state";
import { STANDARD_9_FOOT, BALL_RADIUS, MAX_SQUIRT_ANGLE, POCKET_CONFIG, getPockets } from "../constants";
import { add, norm, normalize, rotate90, rotateByAngle, scale, sub, Vec2 } from "../vec2";
import { SimulationState } from "../simulation-state";
import { computeNextEvent } from "../event-prediction";
import { resolveEvent } from "../event-resolution";
import { advanceState } from "../simulator";
import { cueStrike } from "../motion-models";

const TABLE = STANDARD_9_FOOT;
const R = BALL_RADIUS;

// Diamonds sit at 1/8-table-length intervals along each long rail, skipping the side
// pocket at the midpoint — same convention TableView.tsx uses for its diamond markers.
function diamond(n: number): number {
  return (n / 8) * TABLE.width;
}

// A rendered diamond marker sits on the wooden rail, set back beyond the cushion face by
// (at least) the cushion's own thickness — see longRailDiamond in debug-scenarios.ts for
// the full explanation. Sighting a line through a diamond's TRUE (set-back) position
// crosses the cushion at a different along-rail spot than the diamond's raw coordinate.
const CUSHION_SETBACK_M = POCKET_CONFIG.cushionThickness * 0.0254;
function longRailDiamond(fraction: number, side: "near" | "far"): Vec2 {
  const y = side === "near" ? -CUSHION_SETBACK_M : TABLE.height + CUSHION_SETBACK_M;
  return [fraction * TABLE.width, y];
}

// Runs to completion (pocket or rest) and returns the ball's position at the moment of
// capture — null if it never gets pocketed within maxSteps.
function capturePosition(ball: BallState, maxSteps = 60): Vec2 | null {
  const state = new SimulationState([ball], 0);
  for (let i = 0; i < maxSteps; i++) {
    const event = computeNextEvent(state, TABLE);
    if (!event) return null;
    advanceState(state, event.time - state.time);
    if (event.eventType === "POCKET") return [...ball.pos] as Vec2;
    resolveEvent(state, event, TABLE);
  }
  return null;
}

// Pockets are far enough apart (at least half a diamond-spacing) that a generous tolerance
// still unambiguously distinguishes the intended pocket from any other on the table.
const POCKET_TOLERANCE_M = 0.25;

function expectPotsNear(ball: BallState, target: Vec2) {
  const captured = capturePosition(ball);
  expect(captured).not.toBeNull();
  expect(norm(sub(captured as Vec2, target))).toBeLessThan(POCKET_TOLERANCE_M);
}

const pockets = getPockets(TABLE);
const TOP_SIDE_POCKET = pockets.find((p) => p.type === "side" && p.center[1] === 0)!.center;
// The table renders with engine x (long axis) as the screen's VERTICAL axis and engine y
// (short axis) as the screen's HORIZONTAL axis (see TableView.tsx's toScreen: screenX =
// pos[1]*scaleX, screenY = pos[0]*scaleY) — so the corner that appears at the screen's
// top-right is engine (0, height), not (width, 0). This is the far end of the SAME near
// (y=0) rail the three-rail kick starts on, per its own comment below.
const TOP_RIGHT_CORNER = pockets.find((p) => p.type === "corner" && p.center[0] === 0 && p.center[1] === TABLE.height)!.center;

test("bank shot: corner to 2nd diamond at medium speed pots the near-side pocket", () => {
  // Sight a line from the corner (0,0) through the ball to the 2nd diamond's true
  // (rendered, set-back) position on the far rail — a standard "sight through the corner"
  // one-rail bank. At medium rolling speed it should bank off the far rail and return into
  // the side pocket on the corner's own (near, y=0) side.
  const corner: Vec2 = [0, 0];
  const diamond2 = longRailDiamond(2 / 8, "far");
  const dir = normalize(sub(diamond2, corner));
  const start: Vec2 = scale(dir, 0.28); // roughly in front of the corner, on the sightline

  const speed = 2.1; // medium pace
  const vel = scale(dir, speed);
  const ball = new BallState(start, vel, scale(rotate90(vel), 1 / R), MotionState.ROLLING);

  expectPotsNear(ball, TOP_SIDE_POCKET);
});

test("bank shot: firm sliding contact on the 1st-to-3rd-diamond line pots the near-side pocket", () => {
  // The cue ball's placement line runs through the rendered 1st diamond's (near rail) and
  // rendered 3rd diamond's (far rail) TRUE (set-back) positions — the ball sits on that
  // line, roughly in front of the 1st diamond — and the shot is aimed through that same
  // rendered 3rd diamond's true position. Struck firmly enough that the ball is still
  // SLIDING (not yet naturally rolling) when it reaches the rail — see "banking long"
  // coverage in event-resolution.test.ts for how a rolling ball's leftover, mismatched
  // topspin throws a bank wide of this same line.
  const diamond1 = longRailDiamond(1 / 8, "near");
  const diamond3 = longRailDiamond(3 / 8, "far");
  const start = add(diamond1, scale(sub(diamond3, diamond1), 0.08));
  const dir = normalize(sub(diamond3, start));

  const speed = 3.6; // firm
  const ball = cueStrike(start, dir, speed, 0, 0); // stun: no follow/draw, no sidespin

  expectPotsNear(ball, TOP_SIDE_POCKET);
});

test("three-rail kick: Corner-5 benchmark with a hair of running english pots the top-right corner", () => {
  // Cue ball essentially at the top-left corner, banked long rail -> short rail -> long
  // rail, landing in the top-right corner (the far end of the SAME near/top rail it
  // started on — not a corner reached by crossing the table's width). Aimed through the
  // true (rendered, set-back) position of the diamond at fraction 4.85/8 along the far
  // rail — just past the side pocket's own along-rail position (4/8), which would
  // otherwise clip the pocket's jaw — with a pre-compensated aim so the cue ball's
  // sidespin-induced squirt doesn't throw it off that sighted line (see throw_off_line in
  // debug-scenarios.ts).
  const start: Vec2 = [0.03, 0.03]; // essentially at the top-left corner
  const firstRailTarget = longRailDiamond(4.85 / 8, "far");
  const desiredDir = normalize(sub(firstRailTarget, start));

  const speed = 3.25;
  const topspin = 0.14;
  const sidespin = 0.36;
  const squirtAngle = -sidespin * MAX_SQUIRT_ANGLE;
  const aimDir = rotateByAngle(desiredDir, -squirtAngle);
  const ball = cueStrike(start, aimDir, speed, topspin, sidespin);

  expectPotsNear(ball, TOP_RIGHT_CORNER);
});
