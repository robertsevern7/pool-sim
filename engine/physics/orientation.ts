import type { Vec2 } from "./vec2";

// Cosmetic-only: tracks where a fixed point on a ball's surface has rotated to, so the
// UI can render a spin marker. Never read by anything gameplay-related — collisions only
// ever consume vel/omega/spinZ (see ball-state.ts), not orientation.
//
// Coordinate frame: (x, y, z) where x/y are the table-plane axes matching `pos`
// (BallState.pos[0]/[1]) and z is vertical, pointing up out of the cloth toward a
// bird's-eye camera. A ball's full 3D angular velocity is therefore
// Ω = (omega[0], omega[1], spinZ) — the engine's horizontal-plane spin vector plus its
// independent vertical-axis english, both already expressed in this same frame.
export type Vec3 = [number, number, number];

/** Rodrigues' rotation formula: rotate `v` by `angle` radians about a unit `axis`. */
function rotateAboutAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const d = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
  const cx = axis[1] * v[2] - axis[2] * v[1];
  const cy = axis[2] * v[0] - axis[0] * v[2];
  const cz = axis[0] * v[1] - axis[1] * v[0];

  return [
    v[0] * cos + cx * sin + axis[0] * d * (1 - cos),
    v[1] * cos + cy * sin + axis[1] * d * (1 - cos),
    v[2] * cos + cz * sin + axis[2] * d * (1 - cos),
  ];
}

/**
 * Advance a point fixed on the ball's surface by `dt` seconds under angular velocity
 * Ω = (omega[0], omega[1], spinZ). Ω isn't constant over a whole sliding/rolling phase —
 * it decays continuously as the ball loses speed, and (unlike vel/omega/pos, which have
 * closed-form solutions — see motion-models.ts) there's no closed form for the total
 * rotation once the axis itself drifts over time. So this only takes one step at a time,
 * treating Ω as constant over that single `dt` — a fine approximation at a 60fps frame
 * step, since each step is a few milliseconds. Because the rotation is exact (Rodrigues,
 * with a re-normalized axis) rather than a linear-velocity integration, `point` never
 * drifts off the unit sphere regardless of step count.
 */
export function advanceSpinMarker(point: Vec3, omega: Vec2, spinZ: number, dt: number): Vec3 {
  const wx = omega[0];
  const wy = omega[1];
  const wz = spinZ;
  const speedSq = wx * wx + wy * wy + wz * wz;
  if (speedSq === 0) return point;

  const speed = Math.sqrt(speedSq);
  const axis: Vec3 = [wx / speed, wy / speed, wz / speed];
  return rotateAboutAxis(point, axis, speed * dt);
}

// Off both the roll axis and the vertical axis, so a marker starting here is visibly
// sensitive to pure roll (omega only) and pure english (spinZ only) alike — a marker
// sitting exactly on either axis would be invariant to rotation about that same axis.
export const SPIN_MARKER_REST: Vec3 = [Math.SQRT1_2, 0, Math.SQRT1_2];

/**
 * |omega| — the ball's roll/follow/draw rate, deliberately excluding spinZ. Viewed from
 * directly above, rotation about the vertical axis (spinZ, english) really does look like
 * a flat on-screen spin — but rotation about a horizontal axis (omega, plain topspin or
 * backspin) does not: it tips the ball's near side toward and away from the camera, which
 * a flat `rotate` transform can't represent and would misrepresent as english if it tried.
 * The UI instead uses this to drive a bounded "tumbling" pulse (see ball-spin.ts) that
 * reads as rolling without pretending to be a screen-plane rotation.
 */
export function rollRate(omega: Vec2): number {
  return Math.sqrt(omega[0] * omega[0] + omega[1] * omega[1]);
}
