import type { Vec3 } from "../engine/physics/orientation";

export interface SpinMarker {
  /** Offset from the ball's center, in the same units as `radius`. */
  dx: number;
  dy: number;
  /** 0 (on the far side, hidden) to 1 (facing the camera dead-on). */
  opacity: number;
}

/**
 * Project a spin marker's current 3D surface point (see orientation.ts) onto the
 * top-down screen view: table-x/table-y map straight onto screen dy/dx (no rotation —
 * TableView's toScreen does the same [1]→x, [0]→y swap), and table-z (vertical, toward
 * a bird's-eye camera) becomes depth: positive is the near/visible hemisphere, negative
 * is the far side of the ball and shouldn't be drawn.
 */
export function projectSpinMarker(point: Vec3, radius: number): SpinMarker {
  const [tableX, tableY, tableZ] = point;
  return {
    dx: tableY * radius,
    dy: tableX * radius,
    opacity: Math.max(0, tableZ),
  };
}
