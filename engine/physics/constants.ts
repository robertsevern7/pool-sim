export interface Table {
  width: number; // meters
  height: number;
  railRestitution: number;
}

export const G = 9.81;

// cloth friction (sliding)
export const MU_SLIDE = 0.2;

// rolling resistance
export const MU_ROLL = 0.03;

// rail restitution
export const RAIL_RESTITUTION = 0.82;

// Ball-to-ball Coulomb friction coefficient — small but nonzero, responsible for "throw"
// (a cut ball gets deflected slightly off the true line by cue-ball sidespin/english).
export const BALL_FRICTION = 0.05;

export const BALL_RADIUS = 0.028575; // meters
export const BALL_MASS = 0.17;

// Maximum omega per unit speed from a cue strike.
// Derived from striking at max offset (R/2) before miscue:
//   omega = 5*v*h / (2*R²), h_max = R/2  →  omega_max = 5*v / (4*R)
export const MAX_CUE_SPIN = 5.0 / (4.0 * BALL_RADIUS); // ≈ 43.7 rad/s per m/s

// Squirt (cue ball deflection) angle at max sidespin/tip offset (just under the miscue
// limit). Squirt exists because the tip has some "give" relative to the ball — a rigid,
// infinite-mass cue would produce zero deflection regardless of offset — but the exact
// value depends on shaft stiffness and tip contact mechanics this engine doesn't model, so
// this is taken directly from published measurements rather than derived here. Per Ron
// Shepard's squirt paper and Dr. Dave Alciatore's pool physics FAQ, measured squirt angles
// at max offset range roughly 0.5°–2.5° across real cues, from low-deflection shafts at the
// low end to standard/high-deflection wood shafts at the high end. 2.5° models a standard
// shaft, since this engine doesn't offer an equipment/shaft choice.
export const MAX_SQUIRT_ANGLE = (2.5 * Math.PI) / 180; // ≈ 0.0436 rad

export const STANDARD_9_FOOT: Table = {
  width: 2.84,
  height: 1.42,
  railRestitution: RAIL_RESTITUTION,
};

// --- Pocket configuration (BCA spec) ---
const INCHES_TO_M = 0.0254;

export const POCKET_CONFIG = {
  cornerAngle: 38,           // degrees — cut angle at corner pockets (BCA: 142° opening)
  sideAngle: 77,             // degrees — cut angle at side pockets (BCA: 103° opening)
  cornerPocketMouth: 4.625,  // inches — nose-to-nose at corner pockets
  sidePocketMouth: 5.25,     // inches — nose-to-nose at side pockets
  cornerClothRadius: 4.5,    // inches — cloth-side arc radius at corners
  sideClothRadius: 2.5,      // inches — cloth-side arc radius at sides
  cushionThickness: 2,       // inches — cushion nose width
  sidePocketInset: 0.5,      // inches — how far the side pocket arc is inset from the outer cushion edge
};

export type PocketType = "corner" | "side";

export interface Pocket {
  type: PocketType;
  center: [number, number]; // meters — nominal pocket position (corner of table or midpoint of rail)
  fallCenter: [number, number]; // meters — center of the cloth arc circle (used for potting detection)
  fallRadius: number;       // meters — cloth arc circle radius (ball potted when center crosses)
  zoneRadius: number;       // meters — rail collisions are suppressed within this radius
  mouthWidth: number;       // meters — distance between nose tips at pocket opening
  backRadius: number;       // meters — radius of the back semicircle
}

export function getPockets(table: Table): Pocket[] {
  const w = table.width;
  const h = table.height;
  const cornerMouth = POCKET_CONFIG.cornerPocketMouth * INCHES_TO_M;
  const cornerCr = POCKET_CONFIG.cornerClothRadius * INCHES_TO_M;
  const cornerBackR = cornerMouth / 2;

  // Side pocket cloth arc geometry — same computation as rendering
  const sideCr = POCKET_CONFIG.sideClothRadius * INCHES_TO_M;
  const ct = POCKET_CONFIG.cushionThickness * INCHES_TO_M;
  const sideMouth = POCKET_CONFIG.sidePocketMouth * INCHES_TO_M;
  const scd = POCKET_CONFIG.sideAngle >= 90 ? 0
    : ct / Math.tan((POCKET_CONFIG.sideAngle * Math.PI) / 180);
  const sideBackR = sideMouth / 2 - scd;
  // The back points are inset from the outer cushion edge by sidePocketInset.
  // Total offset from playing surface = arcSetback + ct - inset.
  const sideInset = POCKET_CONFIG.sidePocketInset * INCHES_TO_M;
  const sideArcSetback = Math.sqrt(sideCr * sideCr - sideBackR * sideBackR) + ct - sideInset;
  // zoneRadius must reach from the fall center past y=BALL_RADIUS to suppress rail collisions
  const sideZone = sideArcSetback + BALL_RADIUS;

  // Corner pocket fallCenter is offset diagonally into the rail
  const co = 1.25 * ct; // corner offset from table edge

  const corner = (cx: number, cy: number, fcx: number, fcy: number): Pocket => ({
    type: "corner", center: [cx, cy], fallCenter: [fcx, fcy],
    fallRadius: cornerCr, zoneRadius: cornerCr, mouthWidth: cornerMouth, backRadius: cornerBackR,
  });
  const side = (cx: number, cy: number, fcx: number, fcy: number): Pocket => ({
    type: "side", center: [cx, cy], fallCenter: [fcx, fcy],
    fallRadius: sideCr, zoneRadius: sideZone, mouthWidth: sideMouth, backRadius: sideBackR,
  });

  return [
    corner(0, 0, -co, -co),
    corner(w, 0, w + co, -co),
    corner(0, h, -co, h + co),
    corner(w, h, w + co, h + co),
    side(w / 2, 0, w / 2, -sideArcSetback),
    side(w / 2, h, w / 2, h + sideArcSetback),
  ];
}
