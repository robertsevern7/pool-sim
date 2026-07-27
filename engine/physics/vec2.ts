// Minimal 2D vector math utilities replacing numpy operations.

export type Vec2 = [number, number];

export function add(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

export function scale(v: Vec2, s: number): Vec2 {
  return [v[0] * s, v[1] * s];
}

export function dot(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

export function norm(v: Vec2): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

export function normalize(v: Vec2): Vec2 {
  const n = norm(v);
  if (n === 0) return [0, 0];
  return [v[0] / n, v[1] / n];
}

export function roundVec(v: Vec2, dp: number): Vec2 {
  const f = 10 ** dp;
  return [Math.round(v[0] * f) / f, Math.round(v[1] * f) / f];
}

export function rotate90(v: Vec2): Vec2 {
  return [-v[1], v[0]];
}

export function rotateByAngle(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

export function cross(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0];
}
