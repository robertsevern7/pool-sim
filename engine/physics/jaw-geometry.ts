// Angled jaw/nose cushion segments bridging the straight rails to each pocket mouth.
//
// Real tables (and this app's own renderer, components/Cushions.tsx) don't have pockets
// cut as a simple gap in the rail — each pocket mouth is flanked by one or two angled
// "nose" cushions. Those noses are collidable surfaces: a ball approaching a pocket at a
// shallow angle bounces off them rather than sailing through into open space. This module
// derives that geometry in physics-space (meters) from the same POCKET_CONFIG angle/mouth
// constants the renderer already uses, so detection/resolution can treat each nose as an
// ordinary flat cushion segment.
import { BALL_RADIUS, POCKET_CONFIG, getPockets, heelAlongRail } from "./constants";
import type { Table, Pocket } from "./constants";
import { add, sub, scale, dot, normalize, rotate90, Vec2 } from "./vec2";

const INCHES_TO_M = 0.0254;

// A bounded ball-center collision segment — the common shape shared by straight-rail
// pieces and jaw noses, so both can race for "earliest hit" the same way instead of
// treating the rail as a special-cased infinite line with an exclusion zone.
export interface CushionSegment {
  p1: Vec2;
  p2: Vec2;
  normal: Vec2; // unit normal, into the table
}

export interface JawSegment extends CushionSegment {
  pocketIndex: number;
  // p1: heel — where the nose meets the straight rail's ball-center collision line
  // p2: tip — where the nose hands off to the pocket's fall (capture) circle
  // normal: unit normal, continuous with the adjoining straight rail's normal at p1
  // The TRUE (zero-radius) physical cushion face endpoints — for rendering, not collision.
  // p1/p2 are deliberately offset by BALL_RADIUS from the real cushion surface (that's what
  // makes them valid ball-center collision boundaries); renderP1/renderP2 are the actual
  // architectural nose line a ball's edge touches, which is what should be drawn on screen.
  // renderP1 sits exactly on the straight rail's true line (fixed axis = 0/width/height,
  // matching where the straight cushion rectangles are drawn); renderP2 sits on the same
  // fall circle p2 does (that circle is already defined in true, non-offset space).
  renderP1: Vec2;
  renderP2: Vec2;
}

// Nearest intersection (s >= 0) of the ray `origin + s*dir` with the circle
// `(center, radius)`, assuming `origin` starts outside the circle.
function rayCircleEntry(origin: Vec2, dir: Vec2, center: Vec2, radius: number): Vec2 {
  const dp = sub(origin, center);
  const b = 2 * dot(dp, dir);
  const c = dot(dp, dp) - radius * radius;
  const disc = Math.max(b * b - 4 * c, 0);
  const sqrtDisc = Math.sqrt(disc);
  const s1 = (-b - sqrtDisc) / 2;
  const s2 = (-b + sqrtDisc) / 2;
  const s = s1 > 1e-9 ? s1 : s2;
  return add(origin, scale(dir, s));
}

function buildNoseSegment(
  pocketIndex: number,
  pocket: Pocket,
  railDir: Vec2, // unit vector along the rail, pointing away from the pocket
  railPerp: Vec2, // the adjoining straight rail's own into-table unit normal
  angleDeg: number,
  cushionThicknessM: number,
): JawSegment {
  const angle = (angleDeg * Math.PI) / 180;
  const r = BALL_RADIUS;

  // Heel: the exact same along-rail position components/Cushions.tsx renders — heelAlongRail
  // (constants.ts) is the single shared source for that formula, not a separate copy of it —
  // shifted onto the ball-center rail line by the rail's own perpendicular offset (+r). The
  // perpendicular +r is a separate, physically necessary concept (the ball-center line vs.
  // the true wall) the renderer has no opinion about, so it doesn't conflict with "render and
  // collision positions are identical".
  const heel = heelAlongRail(pocket.type, pocket.mouthWidth, cushionThicknessM, angleDeg);
  const p1 = add(add(pocket.center, scale(railDir, heel)), scale(railPerp, r));

  const segDir = normalize([
    -Math.cos(angle) * railDir[0] - Math.sin(angle) * railPerp[0],
    -Math.cos(angle) * railDir[1] - Math.sin(angle) * railPerp[1],
  ]);

  let normal = rotate90(segDir);
  if (dot(normal, railPerp) < 0) normal = scale(normal, -1);

  // Tip: nearest point where the ray p1 + s*segDir (s >= 0) meets the pocket's own fall
  // circle — not re-derived independently from trig, so the nose hands off to the capture
  // circle with zero gap or overlap by construction.
  const p2 = rayCircleEntry(p1, segDir, pocket.fallCenter, pocket.fallRadius);

  // The TRUE (zero-radius) physical nose face, for rendering — same direction (offsetting a
  // line doesn't change it), starting from the true architectural vertex (no ball-radius
  // miter correction, no perpendicular railPerp offset) instead of the ball-center heel.
  const renderP1 = add(pocket.center, scale(railDir, heel));
  const renderP2 = rayCircleEntry(renderP1, segDir, pocket.fallCenter, pocket.fallRadius);

  return { pocketIndex, p1, p2, normal, renderP1, renderP2 };
}

export function getJawSegments(table: Table): JawSegment[] {
  const pockets = getPockets(table);
  const cushionThicknessM = POCKET_CONFIG.cushionThickness * INCHES_TO_M;
  const segments: JawSegment[] = [];

  const corners = pockets
    .map((p, i) => ({ pocket: p, index: i }))
    .filter((p) => p.pocket.type === "corner");
  const sides = pockets
    .map((p, i) => ({ pocket: p, index: i }))
    .filter((p) => p.pocket.type === "side");

  // Corner pockets: two noses, one per adjoining rail (horizontal + vertical).
  for (const { pocket, index } of corners) {
    const [cx, cy] = pocket.center;
    const horizRailDir: Vec2 = cx === 0 ? [1, 0] : [-1, 0];
    const horizRailPerp: Vec2 = cy === 0 ? [0, 1] : [0, -1];
    const vertRailDir: Vec2 = cy === 0 ? [0, 1] : [0, -1];
    const vertRailPerp: Vec2 = cx === 0 ? [1, 0] : [-1, 0];

    segments.push(
      buildNoseSegment(index, pocket, horizRailDir, horizRailPerp, POCKET_CONFIG.cornerAngle, cushionThicknessM),
    );
    segments.push(
      buildNoseSegment(index, pocket, vertRailDir, vertRailPerp, POCKET_CONFIG.cornerAngle, cushionThicknessM),
    );
  }

  // Side pockets: two noses, both on the same horizontal rail, one on each side of the mouth.
  for (const { pocket, index } of sides) {
    const [, cy] = pocket.center;
    const railPerp: Vec2 = cy === 0 ? [0, 1] : [0, -1];

    segments.push(buildNoseSegment(index, pocket, [-1, 0], railPerp, POCKET_CONFIG.sideAngle, cushionThicknessM));
    segments.push(buildNoseSegment(index, pocket, [1, 0], railPerp, POCKET_CONFIG.sideAngle, cushionThicknessM));
  }

  return segments;
}

type RailKey = "x0" | "xw" | "y0" | "yh";

// Which straight rail a jaw's heel (p1) is pinned to — p1 sits exactly on one of the 4
// ball-center rail lines by construction (see buildNoseSegment).
function railKeyOf(p: Vec2, table: Table): RailKey {
  const r = BALL_RADIUS;
  const eps = 1e-6;
  if (Math.abs(p[0] - r) < eps) return "x0";
  if (Math.abs(p[0] - (table.width - r)) < eps) return "xw";
  if (Math.abs(p[1] - r) < eps) return "y0";
  return "yh";
}

// The straight-rail ball-center collision lines, bounded to where they actually exist —
// each stops exactly at the heel of the jaw segment(s) flanking it, with no gap or overlap.
// Short rails (x=0, x=width) are a single piece bounded by two corner heels; long rails
// (y=0, y=height) are two pieces, split by the two side-pocket heels in the middle.
export function getRailSegments(table: Table): CushionSegment[] {
  const jaws = getJawSegments(table);
  const byRail: Record<RailKey, JawSegment[]> = { x0: [], xw: [], y0: [], yh: [] };
  for (const seg of jaws) byRail[railKeyOf(seg.p1, table)].push(seg);

  const x0 = [...byRail.x0].sort((a, b) => a.p1[1] - b.p1[1]);
  const xw = [...byRail.xw].sort((a, b) => a.p1[1] - b.p1[1]);
  const y0 = [...byRail.y0].sort((a, b) => a.p1[0] - b.p1[0]);
  const yh = [...byRail.yh].sort((a, b) => a.p1[0] - b.p1[0]);

  return [
    { p1: x0[0].p1, p2: x0[1].p1, normal: [1, 0] },
    { p1: xw[0].p1, p2: xw[1].p1, normal: [-1, 0] },
    { p1: y0[0].p1, p2: y0[1].p1, normal: [0, 1] },
    { p1: y0[2].p1, p2: y0[3].p1, normal: [0, 1] },
    { p1: yh[0].p1, p2: yh[1].p1, normal: [0, -1] },
    { p1: yh[2].p1, p2: yh[3].p1, normal: [0, -1] },
  ];
}
