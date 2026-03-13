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
