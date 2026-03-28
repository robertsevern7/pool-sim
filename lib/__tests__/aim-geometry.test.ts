import { computeButtonPositions } from "../aim-geometry";

const BALL_RADIUS = 10;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

describe("computeButtonPositions", () => {
  const cue = { x: 200, y: 300 };

  it("places buttons symmetrically either side of the trajectory", () => {
    const pos = computeButtonPositions(cue, 0, BALL_RADIUS);

    expect(dist(cue, pos.coarseLeft)).toBeCloseTo(dist(cue, pos.coarseRight), 5);
    expect(dist(cue, pos.fineLeft)).toBeCloseTo(dist(cue, pos.fineRight), 5);
  });

  it("places fine buttons behind coarse buttons along the aim direction", () => {
    // Aim angle 0 → aim direction is (1, 0), so "behind" means lower x
    const pos = computeButtonPositions(cue, 0, BALL_RADIUS);

    expect(pos.fineLeft.x).toBeLessThan(pos.coarseLeft.x);
    expect(pos.fineRight.x).toBeLessThan(pos.coarseRight.x);
  });

  it("shifts buttons forward along the aim direction", () => {
    const pos = computeButtonPositions(cue, 0, BALL_RADIUS);

    // Aim angle 0 → aim direction is (1, 0) in screen space
    // Midpoint of left+right coarse should be ahead of the cue ball (higher x)
    const coarseMidX = (pos.coarseLeft.x + pos.coarseRight.x) / 2;
    expect(coarseMidX).toBeGreaterThan(cue.x);
  });

  it("rotates correctly for a non-zero aim angle", () => {
    // Aim straight down (angle = π/2)
    const pos = computeButtonPositions(cue, Math.PI / 2, BALL_RADIUS);

    // Forward shift should be in the +y direction
    const coarseMidY = (pos.coarseLeft.y + pos.coarseRight.y) / 2;
    expect(coarseMidY).toBeGreaterThan(cue.y);

    // Left/right should be spread along x axis, centred on cue x
    const coarseMidX = (pos.coarseLeft.x + pos.coarseRight.x) / 2;
    expect(coarseMidX).toBeCloseTo(cue.x, 5);
  });

  it("coarse buttons are perpendicular to the aim direction", () => {
    const angle = Math.PI / 4;
    const pos = computeButtonPositions(cue, angle, BALL_RADIUS);

    // Vector from coarseLeft to coarseRight
    const lrX = pos.coarseRight.x - pos.coarseLeft.x;
    const lrY = pos.coarseRight.y - pos.coarseLeft.y;

    // Aim direction vector
    const aimX = Math.cos(angle);
    const aimY = Math.sin(angle);

    // Dot product should be ~0 (perpendicular)
    expect(dot(lrX, lrY, aimX, aimY)).toBeCloseTo(0, 5);
  });

  it("fine buttons are at the same perpendicular offset as coarse buttons", () => {
    // Aim angle 0 → perp is (0, 1), so perpendicular offset = y difference from aim line
    const pos = computeButtonPositions(cue, 0, BALL_RADIUS);

    // coarseLeft.y and fineLeft.y should match (same perpendicular offset)
    expect(pos.fineLeft.y).toBeCloseTo(pos.coarseLeft.y, 5);
    expect(pos.fineRight.y).toBeCloseTo(pos.coarseRight.y, 5);
  });
});
