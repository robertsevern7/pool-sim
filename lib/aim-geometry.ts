/**
 * Pure geometry helpers for computing floating aim-control positions.
 * No React dependencies — fully testable in a node environment.
 */

export interface ButtonPositions {
  coarseLeft: { x: number; y: number };
  coarseRight: { x: number; y: number };
  fineLeft: { x: number; y: number };
  fineRight: { x: number; y: number };
}

/**
 * Compute the centre positions of the four floating aim buttons given the
 * cue ball screen position, aim angle (radians, screen-space), and ball radius.
 *
 * Buttons are placed perpendicular to the aim direction and shifted slightly
 * forward along it. Fine buttons sit just beyond the coarse ones on each side.
 */
export function computeButtonPositions(
  cueScreen: { x: number; y: number },
  aimAngle: number,
  ballRadius: number,
): ButtonPositions {
  const perpX = -Math.sin(aimAngle);
  const perpY = Math.cos(aimAngle);
  const fwdX = Math.cos(aimAngle);
  const fwdY = Math.sin(aimAngle);

  const perpOffset = ballRadius * 5;
  const btnSize = Math.max(ballRadius * 4.5, 42);
  const fineBtnSize = Math.max(ballRadius * 3.3, 33);
  // Shift everything forward by the fine button size so fine buttons sit behind coarse
  const forwardShift = ballRadius * 4 + fineBtnSize;
  const fineBackward = btnSize / 2 + fineBtnSize / 2 + 4;

  const baseX = cueScreen.x + fwdX * forwardShift;
  const baseY = cueScreen.y + fwdY * forwardShift;

  return {
    coarseLeft:  { x: baseX + perpX * perpOffset,                        y: baseY + perpY * perpOffset },
    coarseRight: { x: baseX - perpX * perpOffset,                        y: baseY - perpY * perpOffset },
    fineLeft:    { x: baseX + perpX * perpOffset - fwdX * fineBackward,  y: baseY + perpY * perpOffset - fwdY * fineBackward },
    fineRight:   { x: baseX - perpX * perpOffset - fwdX * fineBackward,  y: baseY - perpY * perpOffset - fwdY * fineBackward },
  };
}
