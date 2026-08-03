import { advanceSpinMarker, rollRate, SPIN_MARKER_REST, Vec3 } from "../orientation";

function expectVec3Close(a: Vec3, b: Vec3, precision = 5) {
  expect(a[0]).toBeCloseTo(b[0], precision);
  expect(a[1]).toBeCloseTo(b[1], precision);
  expect(a[2]).toBeCloseTo(b[2], precision);
}

test("zero angular velocity leaves the marker unchanged", () => {
  const p: Vec3 = [0.3, 0.4, Math.sqrt(1 - 0.09 - 0.16)];
  expect(advanceSpinMarker(p, [0, 0], 0, 1)).toEqual(p);
});

test("pure roll rotates the marker about the horizontal omega axis", () => {
  // omega = [pi/2, 0] is a rotation axis along table-x; a quarter turn over 1s
  // should carry the north pole down into the -y table axis.
  const result = advanceSpinMarker([0, 0, 1], [Math.PI / 2, 0], 0, 1);
  expectVec3Close(result, [0, -1, 0]);
});

test("pure sidespin (english) rotates the marker about the vertical axis", () => {
  const result = advanceSpinMarker([1, 0, 0], [0, 0], Math.PI / 2, 1);
  expectVec3Close(result, [0, 1, 0]);
});

test("rotation is exact regardless of step size (no drift)", () => {
  const omega: [number, number] = [0.7, -1.3];
  const spinZ = 0.9;
  const dt = 0.4;

  const oneStep = advanceSpinMarker(SPIN_MARKER_REST, omega, spinZ, dt);
  let twoSteps = SPIN_MARKER_REST;
  twoSteps = advanceSpinMarker(twoSteps, omega, spinZ, dt / 2);
  twoSteps = advanceSpinMarker(twoSteps, omega, spinZ, dt / 2);

  expectVec3Close(oneStep, twoSteps);
});

test("rotation preserves the marker's distance from center", () => {
  const result = advanceSpinMarker(SPIN_MARKER_REST, [0.5, -0.2], 0.3, 0.7);
  const mag = Math.sqrt(result[0] ** 2 + result[1] ** 2 + result[2] ** 2);
  expect(mag).toBeCloseTo(1, 10);
});

test("SPIN_MARKER_REST is off both the roll axis and the vertical axis", () => {
  expect(SPIN_MARKER_REST[1]).toBe(0);
  expect(SPIN_MARKER_REST[0]).toBeGreaterThan(0);
  expect(SPIN_MARKER_REST[2]).toBeGreaterThan(0);
});

test("rollRate reads only the horizontal (omega) component, ignoring spinZ", () => {
  expect(rollRate([0, 0])).toBe(0);
  expect(rollRate([3, 4])).toBeCloseTo(5);
});
