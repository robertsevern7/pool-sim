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

export const BALL_RADIUS = 0.028575; // meters
export const BALL_MASS = 0.17;

// Maximum omega per unit speed from a cue strike.
// Derived from striking at max offset (R/2) before miscue:
//   omega = 5*v*h / (2*R²), h_max = R/2  →  omega_max = 5*v / (4*R)
export const MAX_CUE_SPIN = 5.0 / (4.0 * BALL_RADIUS); // ≈ 43.7 rad/s per m/s

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
};

export interface Pocket {
  center: [number, number]; // meters — position on the table
  fallRadius: number;       // meters — ball is potted when center enters this radius
}

export function getPockets(table: Table): Pocket[] {
  const w = table.width;
  const h = table.height;
  const cornerFallRadius = (POCKET_CONFIG.cornerPocketMouth * INCHES_TO_M) / 2;
  const sideFallRadius = (POCKET_CONFIG.sidePocketMouth * INCHES_TO_M) / 2;

  return [
    // Corner pockets (at the four corners of the playing surface)
    { center: [0, 0],     fallRadius: cornerFallRadius },
    { center: [w, 0],     fallRadius: cornerFallRadius },
    { center: [0, h],     fallRadius: cornerFallRadius },
    { center: [w, h],     fallRadius: cornerFallRadius },
    // Side pockets (midpoints of the long rails)
    { center: [w / 2, 0], fallRadius: sideFallRadius },
    { center: [w / 2, h], fallRadius: sideFallRadius },
  ];
}
