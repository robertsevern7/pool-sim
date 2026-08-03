import { projectSpinMarker } from "../ball-spin";

test("marker facing the camera dead-on projects to the center with full opacity", () => {
  const result = projectSpinMarker([0, 0, 1], 10);
  expect(result).toEqual({ dx: 0, dy: 0, opacity: 1 });
});

test("marker on the far side of the ball is fully transparent", () => {
  const result = projectSpinMarker([0, 0, -1], 10);
  expect(result.opacity).toBe(0);
});

test("table-plane axes map onto screen dx/dy scaled by radius", () => {
  const result = projectSpinMarker([0.6, 0.8, 0], 5);
  expect(result.dx).toBeCloseTo(4); // table-y -> screen dx
  expect(result.dy).toBeCloseTo(3); // table-x -> screen dy
  expect(result.opacity).toBe(0);
});
