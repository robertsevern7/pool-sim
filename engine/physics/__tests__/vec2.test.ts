import { cross, norm, rotate90 } from "../vec2";

// ── rotate90 ──

test("rotate90 on x axis unit vector", () => {
  const [x, y] = rotate90([1, 0]);
  expect(x).toBeCloseTo(0, 9);
  expect(y).toBeCloseTo(1, 9);
});

test("rotate90 on y axis unit vector", () => {
  const [x, y] = rotate90([0, 1]);
  expect(x).toBeCloseTo(-1, 9);
  expect(y).toBeCloseTo(0, 9);
});

test("rotate90 applied twice negates the vector", () => {
  const v: [number, number] = [3, -4];
  const twice = rotate90(rotate90(v));
  expect(twice[0]).toBeCloseTo(-v[0], 9);
  expect(twice[1]).toBeCloseTo(-v[1], 9);
});

test("rotate90 preserves the vector norm", () => {
  const v: [number, number] = [3, -4];
  expect(norm(rotate90(v))).toBeCloseTo(norm(v), 9);
});

// ── cross ──

test("cross of parallel vectors is zero", () => {
  expect(cross([2, 0], [5, 0])).toBeCloseTo(0, 9);
});

test("cross of perpendicular unit vectors is +-1", () => {
  expect(cross([1, 0], [0, 1])).toBeCloseTo(1, 9);
  expect(cross([0, 1], [1, 0])).toBeCloseTo(-1, 9);
});

test("cross matches dot with rotate90", () => {
  const a: [number, number] = [2, 3];
  const b: [number, number] = [-1, 4];
  // a x b === dot(rotate90(a), b)
  const rotated = rotate90(a);
  const dotVal = rotated[0] * b[0] + rotated[1] * b[1];
  expect(cross(a, b)).toBeCloseTo(dotVal, 9);
});
