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

// Ball-to-cushion Coulomb friction coefficient — responsible for "cushion throw"/english
// carrying through a rail bounce, changing the rebound angle. Notably higher than
// BALL_FRICTION (cushion rubber grips more than a ball's phenolic surface does). Measured
// value from Mathavan, Jackson & Parkin, "A theoretical analysis of billiard ball dynamics
// under cushion impacts" (Proc. IMechE, 2010): coefficient of sliding friction ≈ 0.14
// (alongside a cushion coefficient of restitution ≈ 0.98 for the raw normal impact — not
// the same thing as this engine's RAIL_RESTITUTION, which is a separate, already-tuned
// simplification of the whole tangential-preserving bounce).
export const RAIL_FRICTION = 0.14;

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

// Distance, measured along the rail from a pocket's true center, to where the straight
// cushion ends and the angled jaw nose begins — i.e. the nose's heel. This is the single
// shared source for that position: components/Cushions.tsx's nose placement and
// engine/physics/jaw-geometry.ts's collision heel must both derive from this function, not
// duplicate their own copy of it, so they can never silently drift apart again (see project
// history — they did, twice, before this was extracted).
//
// The two pocket types genuinely use different formulas, reverse-derived by equating this
// function's output (converted to screen pixels) against Cushions.tsx's original, untouched
// rendering math, corner by corner:
//   corner: dTip + ccd - cushionThickness  (the render's "R + cm" turns out to be exactly
//           "border + dTip + ccd - cushionThickness" once R is rewritten as border - CT)
//   side:   dTip alone — the render never adds the angled ccd term for the side nose's
//           straight-cushion boundary (only for the decorative triangle's own leg length)
// dTip is half the mouth width for a side pocket, or the diagonal mouth width divided by
// sqrt(2) for a corner pocket (the mouth is measured diagonally across the corner).
export function heelAlongRail(
  type: PocketType,
  mouthWidth: number,
  cushionThickness: number,
  angleDeg: number,
): number {
  const dTip = type === "corner" ? mouthWidth / Math.SQRT2 : mouthWidth / 2;
  if (type === "side") return dTip;
  const ccd = angleDeg >= 90 ? 0 : cushionThickness / Math.tan((angleDeg * Math.PI) / 180);
  return dTip + ccd - cushionThickness;
}

export interface Pocket {
  type: PocketType;
  center: [number, number]; // meters — nominal pocket position (corner of table or midpoint of rail)
  fallCenter: [number, number]; // meters — center of the cloth arc circle (used for potting detection)
  fallRadius: number;       // meters — cloth arc circle radius (ball potted when center crosses)
  mouthWidth: number;       // meters — input to the jaw-angle construction (see jaw-geometry.ts);
                            // the actual computed nose-tip-to-nose-tip distance, once each tip
                            // is snapped onto the fall circle for seamless collision handoff,
                            // differs slightly from this nominal value
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

  // Corner pocket fallCenter is offset diagonally into the rail
  const co = 1.25 * ct; // corner offset from table edge

  const corner = (cx: number, cy: number, fcx: number, fcy: number): Pocket => ({
    type: "corner", center: [cx, cy], fallCenter: [fcx, fcy],
    fallRadius: cornerCr, mouthWidth: cornerMouth, backRadius: cornerBackR,
  });
  const side = (cx: number, cy: number, fcx: number, fcy: number): Pocket => ({
    type: "side", center: [cx, cy], fallCenter: [fcx, fcy],
    fallRadius: sideCr, mouthWidth: sideMouth, backRadius: sideBackR,
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
