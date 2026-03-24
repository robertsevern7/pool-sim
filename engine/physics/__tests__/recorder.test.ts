import { BallState, MotionState } from "../ball-state";
import { BALL_RADIUS, STANDARD_9_FOOT } from "../constants";
import { cueStrike } from "../motion-models";
import { recordTrajectories, recordSimulation } from "../recorder";

const TABLE = STANDARD_9_FOOT;
const R = BALL_RADIUS;
const CY = TABLE.height / 2;

// ── recordTrajectories: structure ──

test("single stopped ball produces no trajectory (length < 2)", () => {
  const ball = new BallState([1.0, CY], [0, 0], 0, MotionState.STOPPED);
  const trajs = recordTrajectories([ball], TABLE);
  expect(trajs).toHaveLength(1);
  // start and final resting are the same spot — only 1 point
  expect(trajs[0]).toHaveLength(1);
});

test("single rolling ball has start and final resting ghost", () => {
  const ball = new BallState([0.5, CY], [1.0, 0], 1.0 / R, MotionState.ROLLING);
  const trajs = recordTrajectories([ball], TABLE);
  expect(trajs).toHaveLength(1);
  const traj = trajs[0];

  // First point: starting position, not a ghost
  expect(traj[0].ghost).toBe(false);
  expect(traj[0].pos[0]).toBeCloseTo(0.5, 4);
  expect(traj[0].pos[1]).toBeCloseTo(CY, 4);

  // Last point: final resting position, is a ghost
  const last = traj[traj.length - 1];
  expect(last.ghost).toBe(true);
  expect(last.pos[0]).toBeGreaterThan(0.5);
});

test("ball hitting rail has ghost at rail contact", () => {
  // Fast ball aimed at the far rail
  const ball = new BallState([1.0, CY], [3.0, 0], 3.0 / R, MotionState.ROLLING);
  const trajs = recordTrajectories([ball], TABLE);
  const traj = trajs[0];

  // Should have at least: start, rail collision ghost, final ghost
  expect(traj.length).toBeGreaterThanOrEqual(3);

  // Find rail collision ghost (not the first, not necessarily the last)
  const railGhosts = traj.filter((p, i) => p.ghost && i > 0 && i < traj.length - 1);
  expect(railGhosts.length).toBeGreaterThanOrEqual(1);

  // Rail ghost should be near the far rail (x ≈ TABLE.width - R)
  const nearFarRail = railGhosts.some(
    (p) => Math.abs(p.pos[0] - (TABLE.width - R)) < 0.01,
  );
  expect(nearFarRail).toBe(true);
});

// ── recordTrajectories: ball-ball collision ──

test("two-ball collision produces ghosts on both balls", () => {
  const cue = cueStrike([0.5, CY], [1, 0], 2.0);
  const obj = new BallState([1.2, CY], [0, 0], 0, MotionState.STOPPED);
  const trajs = recordTrajectories([cue, obj], TABLE);

  expect(trajs).toHaveLength(2);

  // Cue ball should have a ghost at the collision point
  const cueGhosts = trajs[0].filter((p) => p.ghost);
  expect(cueGhosts.length).toBeGreaterThanOrEqual(1);

  // Object ball should have a ghost at the collision point
  const objGhosts = trajs[1].filter((p) => p.ghost);
  expect(objGhosts.length).toBeGreaterThanOrEqual(1);

  // At contact, ball centres are separated by exactly 2*R
  const cueCollision = trajs[0].find((p, i) => p.ghost && i > 0);
  const objCollision = trajs[1].find((p, i) => p.ghost && i > 0);
  expect(cueCollision).toBeDefined();
  expect(objCollision).toBeDefined();
  const separation = Math.abs(objCollision!.pos[0] - cueCollision!.pos[0]);
  expect(separation).toBeCloseTo(2 * R, 2);
});

test("object ball trajectory starts at its initial position", () => {
  const cue = cueStrike([0.5, CY], [1, 0], 2.0);
  const obj = new BallState([1.2, CY], [0, 0], 0, MotionState.STOPPED);
  const trajs = recordTrajectories([cue, obj], TABLE);

  expect(trajs[1][0].pos[0]).toBeCloseTo(1.2, 4);
  expect(trajs[1][0].pos[1]).toBeCloseTo(CY, 4);
  expect(trajs[1][0].ghost).toBe(false);
});

// ── recordTrajectories: final resting positions ──

test("final resting position is always a ghost", () => {
  const cue = cueStrike([0.5, CY], [1, 0], 2.0);
  const obj = new BallState([1.2, CY], [0, 0], 0, MotionState.STOPPED);
  const trajs = recordTrajectories([cue, obj], TABLE);

  for (const traj of trajs) {
    const last = traj[traj.length - 1];
    expect(last.ghost).toBe(true);
  }
});

test("no duplicate final point when last event is at resting position", () => {
  // A ball aimed at a rail that loses most energy on bounce
  const ball = new BallState([2.5, CY], [0.5, 0], 0.5 / R, MotionState.ROLLING);
  const trajs = recordTrajectories([ball], TABLE);
  const traj = trajs[0];

  // Check no two consecutive points have the same position
  for (let i = 1; i < traj.length; i++) {
    const same =
      traj[i].pos[0] === traj[i - 1].pos[0] && traj[i].pos[1] === traj[i - 1].pos[1];
    expect(same).toBe(false);
  }
});

// ── recordTrajectories: does not mutate input ──

test("does not mutate initial ball states", () => {
  const cue = cueStrike([0.5, CY], [1, 0], 2.0);
  const obj = new BallState([1.2, CY], [0, 0], 0, MotionState.STOPPED);
  const origCuePos: [number, number] = [cue.pos[0], cue.pos[1]];
  const origObjPos: [number, number] = [obj.pos[0], obj.pos[1]];

  recordTrajectories([cue, obj], TABLE);

  expect(cue.pos[0]).toBe(origCuePos[0]);
  expect(cue.pos[1]).toBe(origCuePos[1]);
  expect(obj.pos[0]).toBe(origObjPos[0]);
  expect(obj.pos[1]).toBe(origObjPos[1]);
});

// ── recordTrajectories: waypoints are only at collisions ──

test("intermediate non-ghost points do not exist (only start is non-ghost)", () => {
  const ball = new BallState([1.0, CY], [3.0, 0], 3.0 / R, MotionState.ROLLING);
  const trajs = recordTrajectories([ball], TABLE);
  const traj = trajs[0];

  // Only the first point should be non-ghost
  const nonGhosts = traj.filter((p) => !p.ghost);
  expect(nonGhosts).toHaveLength(1);
  expect(nonGhosts[0]).toBe(traj[0]);
});

// ── recordSimulation: basic sanity ──

test("recordSimulation returns frames at roughly 60fps", () => {
  const ball = new BallState([0.5, CY], [1.0, 0], 1.0 / R, MotionState.ROLLING);
  const { frames } = recordSimulation([ball], TABLE, 60);

  expect(frames.length).toBeGreaterThan(1);

  // Check frame interval is approximately 1/60
  if (frames.length >= 3) {
    const dt = frames[2].time - frames[1].time;
    expect(dt).toBeCloseTo(1 / 60, 3);
  }
});

test("recordSimulation first and last frames bracket the motion", () => {
  const ball = new BallState([0.5, CY], [1.0, 0], 1.0 / R, MotionState.ROLLING);
  const { frames } = recordSimulation([ball], TABLE, 60);

  expect(frames[0].time).toBe(0);
  expect(frames[0].balls[0].pos[0]).toBeCloseTo(0.5, 4);

  const last = frames[frames.length - 1];
  expect(last.balls[0].motion).toBe(MotionState.STOPPED);
});
