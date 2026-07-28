import { BALL_RADIUS, STANDARD_9_FOOT, POCKET_CONFIG, getPockets, heelAlongRail } from "../constants";
import type { Pocket } from "../constants";
import { getJawSegments } from "../jaw-geometry";
import type { JawSegment } from "../jaw-geometry";
import { dot, norm, sub, Vec2 } from "../vec2";

const TABLE = STANDARD_9_FOOT;
const pockets = getPockets(TABLE);
const segments = getJawSegments(TABLE);

// The straight rail's own canonical into-table normal at this segment's heel (mirrors the
// axis-aligned derivation in event-resolution.ts's RAIL_COLLISION branch), used to check
// the nose's normal is continuous with the rail it's attached to.
function canonicalRailNormal(pocket: Pocket, seg: JawSegment): Vec2 {
  const d0 = seg.p1[0] - pocket.center[0];
  const d1 = seg.p1[1] - pocket.center[1];
  if (Math.abs(Math.abs(d0) - BALL_RADIUS) < Math.abs(Math.abs(d1) - BALL_RADIUS)) {
    return [Math.sign(d0), 0];
  }
  return [0, Math.sign(d1)];
}

test("returns 12 jaw segments", () => {
  expect(segments).toHaveLength(12);
});

test("8 segments belong to corner pockets and 4 to side pockets", () => {
  const cornerCount = segments.filter((s) => pockets[s.pocketIndex].type === "corner").length;
  const sideCount = segments.filter((s) => pockets[s.pocketIndex].type === "side").length;
  expect(cornerCount).toBe(8);
  expect(sideCount).toBe(4);
});

test("each segment has positive length", () => {
  for (const seg of segments) {
    expect(norm(sub(seg.p2, seg.p1))).toBeGreaterThan(0);
  }
});

test("each segment's normal is a unit vector", () => {
  for (const seg of segments) {
    expect(norm(seg.normal)).toBeCloseTo(1, 6);
  }
});

test("each heel (p1) sits exactly on a straight rail collision line", () => {
  for (const seg of segments) {
    const onVertical =
      Math.abs(seg.p1[0] - BALL_RADIUS) < 1e-6 || Math.abs(seg.p1[0] - (TABLE.width - BALL_RADIUS)) < 1e-6;
    const onHorizontal =
      Math.abs(seg.p1[1] - BALL_RADIUS) < 1e-6 || Math.abs(seg.p1[1] - (TABLE.height - BALL_RADIUS)) < 1e-6;
    expect(onVertical || onHorizontal).toBe(true);
  }
});

test("each tip (p2) sits exactly on its pocket's fall circle", () => {
  for (const seg of segments) {
    const pocket = pockets[seg.pocketIndex];
    const dist = norm(sub(seg.p2, pocket.fallCenter));
    expect(dist).toBeCloseTo(pocket.fallRadius, 6);
  }
});

test("each normal agrees (positive dot product) with its adjoining straight rail's normal", () => {
  for (const seg of segments) {
    const pocket = pockets[seg.pocketIndex];
    const railNormal = canonicalRailNormal(pocket, seg);
    expect(dot(seg.normal, railNormal)).toBeGreaterThan(0);
  }
});

test("corner pockets each contribute exactly 2 segments", () => {
  for (let i = 0; i < pockets.length; i++) {
    if (pockets[i].type !== "corner") continue;
    expect(segments.filter((s) => s.pocketIndex === i)).toHaveLength(2);
  }
});

test("side pockets each contribute exactly 2 segments", () => {
  for (let i = 0; i < pockets.length; i++) {
    if (pockets[i].type !== "side") continue;
    expect(segments.filter((s) => s.pocketIndex === i)).toHaveLength(2);
  }
});

// heelAlongRail is the single shared source for the nose-heel position, used by both this
// module and components/Cushions.tsx (see that function's doc comment in constants.ts). This
// oracle reproduces Cushions.tsx's original, untouched pixel arithmetic verbatim — copied,
// not imported, so this test would actually notice if that component's math ever diverges
// from the shared formula (the whole reason the two were unified: they silently drifted
// apart before, by exactly one cushion-thickness at the corners — see project history).
describe("heelAlongRail matches components/Cushions.tsx's original rendering formula", () => {
  const INCHES_TO_M = 0.0254;

  function originalCornerHeelPx(scale: number): number {
    const CT = POCKET_CONFIG.cushionThickness * INCHES_TO_M * scale;
    const ccd = Math.round(
      POCKET_CONFIG.cornerAngle >= 90 ? 0 : CT / Math.tan((POCKET_CONFIG.cornerAngle * Math.PI) / 180),
    );
    const cm = Math.round((POCKET_CONFIG.cornerPocketMouth * INCHES_TO_M * scale) / Math.SQRT2 + ccd);
    // Original places the straight cushion segment at screen-x = R + cm; border = R + CT, so
    // relative to the shared physics origin (border) that's cm - CT.
    return cm - CT;
  }

  function originalSideHeelPx(scale: number): number {
    // Original never adds a ccd-equivalent term for the side nose's straight-cushion
    // boundary — see sm in Cushions.tsx.
    return Math.round((POCKET_CONFIG.sidePocketMouth / 2) * INCHES_TO_M * scale);
  }

  test.each([100, 150, 200, 239, 280, 350, 500])("corner heel, scale=%i", (scale) => {
    const heelM = heelAlongRail("corner", POCKET_CONFIG.cornerPocketMouth * INCHES_TO_M, POCKET_CONFIG.cushionThickness * INCHES_TO_M, POCKET_CONFIG.cornerAngle);
    // Tolerance of 1.5px absorbs Cushions.tsx's own double-rounding (ccd rounded, then cm
    // rounded again on top of it) — not a real formula mismatch.
    expect(Math.abs(heelM * scale - originalCornerHeelPx(scale))).toBeLessThan(1.5);
  });

  test.each([100, 150, 200, 239, 280, 350, 500])("side heel, scale=%i", (scale) => {
    const heelM = heelAlongRail("side", POCKET_CONFIG.sidePocketMouth * INCHES_TO_M, POCKET_CONFIG.cushionThickness * INCHES_TO_M, POCKET_CONFIG.sideAngle);
    expect(Math.abs(heelM * scale - originalSideHeelPx(scale))).toBeLessThan(1.5);
  });
});
