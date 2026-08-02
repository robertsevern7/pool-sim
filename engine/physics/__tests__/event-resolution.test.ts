import { BallState, MotionState } from "../ball-state";
import { BALL_RADIUS, G, STANDARD_9_FOOT } from "../constants";
import { resolveEvent } from "../event-resolution";
import { computeNextEvent, type Event } from "../event-prediction";
import { getJawSegments } from "../jaw-geometry";
import { slidingMotion } from "../motion-models";
import { SimulationState } from "../simulation-state";
import { advanceState } from "../simulator";
import { cross, dot, norm, normalize, rotate90, rotateByAngle, sub, scale, add } from "../vec2";

function q3(n: number): string {
  return n.toFixed(3);
}

// Helper to resolve ball collision directly (since it's not exported, we go through resolveEvent)
function resolveBallCollision(a: BallState, b: BallState) {
  const state = new SimulationState([a, b], 0.0);
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);
}

function resolveRailCollision(ball: BallState, normalVec: [number, number]) {
  // Position the ball at the appropriate wall edge so resolveEvent picks the right normal
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
}

// ── resolve_ball_collision: base cases ──

test("resolve ball collision head on equal speed", () => {
  const a = new BallState([0.0, 0.0], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [-2.0, 0.0], [0, 0], MotionState.SLIDING);
  resolveBallCollision(a, b);
  expect(q3(a.vel[0])).toBe("-2.000");
  expect(q3(a.vel[1])).toBe("0.000");
  expect(q3(b.vel[0])).toBe("2.000");
  expect(q3(b.vel[1])).toBe("0.000");
});

test("resolve ball collision moving hits stationary", () => {
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  resolveBallCollision(a, b);
  expect(q3(a.vel[0])).toBe("0.000");
  expect(q3(a.vel[1])).toBe("0.000");
  expect(q3(b.vel[0])).toBe("3.000");
  expect(q3(b.vel[1])).toBe("0.000");
});

test("resolve ball collision topspin re-accelerates cue ball", () => {
  const omegaInitial: [number, number] = [0, 50.0];
  const a = new BallState([0.0, 0.0], [3.0, 0.0], omegaInitial, MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  resolveBallCollision(a, b);
  expect(q3(a.vel[0])).toBe("0.000");
  expect(a.omega[0]).toBeCloseTo(omegaInitial[0], 9);
  expect(a.omega[1]).toBeCloseTo(omegaInitial[1], 9);
  expect(a.motion).toBe(MotionState.SLIDING);
});

test("resolve ball collision stun shot follows tangent line", () => {
  const r = BALL_RADIUS;
  const s2 = Math.sqrt(2);
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([r * s2, r * s2] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  resolveBallCollision(a, b);
  // A's velocity should be perpendicular to collision normal
  const n = sub(a.pos, b.pos);
  const nLen = norm(n);
  const nHat = scale(n, 1 / nLen);
  expect(Math.abs(dot(a.vel, nHat))).toBeLessThan(1e-10);
  expect(q3(a.vel[0])).toBe("1.500");
  expect(q3(a.vel[1])).toBe("-1.500");
  // Zero spin in, zero spin out — nothing left to curve the path away from the tangent.
  expect(a.omega[0]).toBeCloseTo(0, 9);
  expect(a.omega[1]).toBeCloseTo(0, 9);
});

test("resolve ball collision follow shot curves off tangent line", () => {
  const r = BALL_RADIUS;
  const s2 = Math.sqrt(2);
  const vel0: [number, number] = [3.0, 0];
  // Natural roll before contact: spin locked to the rolling-without-slip direction.
  const followOmega = scale(rotate90(vel0), 1 / BALL_RADIUS);

  const a = new BallState([0.0, 0.0], vel0, followOmega, MotionState.ROLLING);
  const b = new BallState([r * s2, r * s2] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  resolveBallCollision(a, b);

  // Core correctness property this fix relies on: a central collision impulse imparts no
  // torque, so spin must be unchanged by the collision itself.
  expect(a.omega[0]).toBeCloseTo(followOmega[0], 9);
  expect(a.omega[1]).toBeCloseTo(followOmega[1], 9);

  // Velocity still lands exactly on the tangent line right at the moment of impact...
  expect(q3(a.vel[0])).toBe("1.500");
  expect(q3(a.vel[1])).toBe("-1.500");

  // ...but omega no longer matches the new velocity direction, so the contact-point slip
  // is not parallel to vel — friction has a lateral component, which is what curves the path.
  const u = add(a.vel, scale(rotate90(a.omega), BALL_RADIUS));
  expect(Math.abs(cross(a.vel, u))).toBeGreaterThan(1e-6);

  // Step forward and compare against a synthetic pure-tangent (stun) baseline starting from
  // the same post-collision velocity with zero spin. The follow ball's path should diverge
  // from that baseline, and the divergence should grow over time (not just numerical noise).
  const stunBaseline = () => new BallState([0, 0], [1.5, -1.5], [0, 0], MotionState.SLIDING);
  const follow1 = slidingMotion(a, 0.01, G);
  const stun1 = slidingMotion(stunBaseline(), 0.01, G);
  const follow2 = slidingMotion(a, 0.05, G);
  const stun2 = slidingMotion(stunBaseline(), 0.05, G);

  const dev1 = follow1.vel[0] - stun1.vel[0];
  const dev2 = follow2.vel[0] - stun2.vel[0];
  expect(dev1).toBeGreaterThan(1e-6);
  expect(dev2).toBeGreaterThan(dev1);
});

test("resolve ball collision draw shot curves off tangent line the other way", () => {
  const r = BALL_RADIUS;
  const s2 = Math.sqrt(2);
  const vel0: [number, number] = [3.0, 0];
  // Backspin: same magnitude as the follow case, opposite sign.
  const drawOmega = scale(rotate90(vel0), -1 / BALL_RADIUS);

  const a = new BallState([0.0, 0.0], vel0, drawOmega, MotionState.SLIDING);
  const b = new BallState([r * s2, r * s2] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  resolveBallCollision(a, b);

  expect(a.omega[0]).toBeCloseTo(drawOmega[0], 9);
  expect(a.omega[1]).toBeCloseTo(drawOmega[1], 9);
  expect(q3(a.vel[0])).toBe("1.500");
  expect(q3(a.vel[1])).toBe("-1.500");

  const stunBaseline = () => new BallState([0, 0], [1.5, -1.5], [0, 0], MotionState.SLIDING);
  const draw1 = slidingMotion(a, 0.01, G);
  const stun1 = slidingMotion(stunBaseline(), 0.01, G);
  const draw2 = slidingMotion(a, 0.05, G);
  const stun2 = slidingMotion(stunBaseline(), 0.05, G);

  const dev1 = draw1.vel[0] - stun1.vel[0];
  const dev2 = draw2.vel[0] - stun2.vel[0];
  // Mirror of the follow case: deviation flips sign and still grows in magnitude over time.
  expect(dev1).toBeLessThan(-1e-6);
  expect(dev2).toBeLessThan(dev1);
});

// ── resolve_ball_collision: edge cases ──

test("resolve ball collision separating no change", () => {
  const a = new BallState([0.0, 0.0], [-1.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [1.0, 0.0], [0, 0], MotionState.SLIDING);
  const velABefore: [number, number] = [...a.vel];
  const velBBefore: [number, number] = [...b.vel];
  resolveBallCollision(a, b);
  expect(a.vel[0]).toBe(velABefore[0]);
  expect(a.vel[1]).toBe(velABefore[1]);
  expect(b.vel[0]).toBe(velBBefore[0]);
  expect(b.vel[1]).toBe(velBBefore[1]);
});

test("resolve ball collision sets motion states", () => {
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.ROLLING);
  const b = new BallState([0.05715, 0.0], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  resolveBallCollision(a, b);
  expect(a.motion).toBe(MotionState.STOPPED);
  expect(b.motion).toBe(MotionState.SLIDING);
});

// ── resolve_ball_collision: self-consistency ──

test("resolve ball collision momentum conserved", () => {
  const a = new BallState([0.0, 0.0], [3.0, 1.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([0.05715, 0.0], [-1.0, 0.5], [0, 0], MotionState.SLIDING);
  const pBefore = add(scale(a.vel, a.mass), scale(b.vel, b.mass));
  resolveBallCollision(a, b);
  const pAfter = add(scale(a.vel, a.mass), scale(b.vel, b.mass));
  expect(q3(pAfter[0])).toBe(q3(pBefore[0]));
  expect(q3(pAfter[1])).toBe(q3(pBefore[1]));
});

// ── resolve_ball_collision: throw (sidespin) ──
//
// Regression coverage for adding sidespin/English: ball-ball contact now has a small
// tangential friction impulse driven by spinZ (vertical-axis spin), which "throws" a cut
// ball off the pure geometric/tangent line. Deliberately spin-only — a spinless cut shot
// must still land exactly on the tangent line (see the "stun/follow/draw" tests above),
// so cut angle alone must never trigger this on its own.

test("resolve ball collision no sidespin has zero throw (regression)", () => {
  const r = BALL_RADIUS;
  const s2 = Math.sqrt(2);
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([r * s2, r * s2] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  resolveBallCollision(a, b);
  // Exactly the pure tangent-line split, unaffected by the throw mechanism.
  expect(q3(a.vel[0])).toBe("1.500");
  expect(q3(a.vel[1])).toBe("-1.500");
  expect(q3(b.vel[0])).toBe("1.500");
  expect(q3(b.vel[1])).toBe("1.500");
});

test("resolve ball collision with cue-ball sidespin throws the cut ball off the tangent line", () => {
  const r = BALL_RADIUS;
  const s2 = Math.sqrt(2);
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING, 0, 60);
  const b = new BallState([r * s2, r * s2] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  resolveBallCollision(a, b);

  // Hand-derived reference values for this exact setup (see PR/commit notes) — cross-checked
  // below against momentum conservation and slip-reduction, not just copied from the code.
  expect(q3(a.vel[0])).toBe("1.575");
  expect(q3(a.vel[1])).toBe("-1.575");
  expect(q3(b.vel[0])).toBe("1.425");
  expect(q3(b.vel[1])).toBe("1.575");
  expect(q3(a.spinZ)).toBe("50.720");
  expect(q3(b.spinZ)).toBe("-9.280");
});

test("resolve ball collision throw conserves momentum", () => {
  const r = BALL_RADIUS;
  const s2 = Math.sqrt(2);
  const a = new BallState([0.0, 0.0], [3.0, 1.0], [0, 0], MotionState.SLIDING, 0, -40);
  const b = new BallState([r * s2, 0.0] as [number, number], [-0.5, 0.2], [0, 0], MotionState.SLIDING, 1, 15);
  const pBefore = add(scale(a.vel, a.mass), scale(b.vel, b.mass));
  resolveBallCollision(a, b);
  const pAfter = add(scale(a.vel, a.mass), scale(b.vel, b.mass));
  expect(q3(pAfter[0])).toBe(q3(pBefore[0]));
  expect(q3(pAfter[1])).toBe(q3(pBefore[1]));
});

test("resolve ball collision throw reduces spin-driven slip (friction opposes it, doesn't reverse or amplify it)", () => {
  const r = BALL_RADIUS;
  const s2 = Math.sqrt(2);
  const spinZBefore = { a: 60, b: -10 };
  const slipBefore = -BALL_RADIUS * (spinZBefore.a + spinZBefore.b);

  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING, 0, spinZBefore.a);
  const b = new BallState([r * s2, r * s2] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED, 1, spinZBefore.b);
  resolveBallCollision(a, b);

  const slipAfter = -BALL_RADIUS * (a.spinZ + b.spinZ);
  expect(Math.sign(slipAfter)).toBe(Math.sign(slipBefore));
  expect(Math.abs(slipAfter)).toBeLessThan(Math.abs(slipBefore));
});

test("resolve ball collision throw direction flips with sidespin direction", () => {
  // Kinetic (Coulomb) friction is bounded by BALL_FRICTION * normal impulse regardless of
  // *how much* slip there is — only the slip's sign picks which way the throw deflects.
  const r = BALL_RADIUS;
  const s2 = Math.sqrt(2);

  function throwDeflectionAlongTangent(spinZ: number): number {
    const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING, 0, spinZ);
    const b = new BallState([r * s2, r * s2] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
    resolveBallCollision(a, b);
    const nHat = normalize(sub([0.0, 0.0] as [number, number], [r * s2, r * s2] as [number, number]));
    const tangentDir = rotate90(nHat);
    return dot(b.vel, tangentDir);
  }

  const positive = throwDeflectionAlongTangent(60);
  const negative = throwDeflectionAlongTangent(-60);
  expect(positive).not.toBeCloseTo(0, 6);
  expect(Math.sign(positive)).toBe(-Math.sign(negative));
  expect(q3(Math.abs(positive))).toBe(q3(Math.abs(negative)));
});

// ── resolve_rail_collision: base cases ──

test("resolve rail collision perpendicular", () => {
  // Ball at right wall
  const ball = new BallState(
    [STANDARD_9_FOOT.width - BALL_RADIUS, 0.7],
    [3.0, 0.0],
    [0, 0],
    MotionState.SLIDING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("-2.730");
  expect(q3(ball.vel[1])).toBe("0.000");
});

test("resolve rail collision angled", () => {
  // Ball at top wall
  const ball = new BallState(
    [0.5, STANDARD_9_FOOT.height - BALL_RADIUS],
    [2.0, 2.0],
    [0, 0],
    MotionState.SLIDING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("1.568");
  expect(q3(ball.vel[1])).toBe("-1.891");
});

test("resolve rail collision sets sliding", () => {
  const ball = new BallState(
    [STANDARD_9_FOOT.width - BALL_RADIUS, 0.7],
    [3.0, 0.0],
    [0, 0],
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(ball.motion).toBe(MotionState.SLIDING);
});

// ── resolve_rail_collision: throw (sidespin / "cushion english") ──
//
// Regression coverage for the coupled cushion/table-felt impact model: sidespin (spinZ)
// couples into the cushion contact's own slip term (see resolveRailCollision), which changes
// a spinning ball's rebound angle off a rail — the classic "cushion english" effect — on top
// of whatever a spinless ball at the same incoming velocity gets (see "resolve rail collision
// angled" above, which is exactly this same setup with zero spinZ).

test("resolve rail collision with no sidespin has zero rail throw (regression)", () => {
  const ball = new BallState(
    [0.5, STANDARD_9_FOOT.height - BALL_RADIUS],
    [2.0, 2.0],
    [0, 0],
    MotionState.SLIDING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("1.568");
  expect(q3(ball.vel[1])).toBe("-1.891");
});

test("resolve rail collision with sidespin changes the rebound angle (cushion throw)", () => {
  const ball = new BallState(
    [0.5, STANDARD_9_FOOT.height - BALL_RADIUS],
    [2.0, 2.0],
    [0, 0],
    MotionState.SLIDING,
    0,
    50,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("1.669");
  expect(q3(ball.vel[1])).toBe("-1.864");
  expect(q3(ball.spinZ)).toBe("64.498");
});

test("resolve rail collision throw direction flips with sidespin sign", () => {
  function reboundTangential(spinZ: number): number {
    const ball = new BallState(
      [0.5, STANDARD_9_FOOT.height - BALL_RADIUS],
      [2.0, 2.0],
      [0, 0],
      MotionState.SLIDING,
      0,
      spinZ,
    );
    const state = new SimulationState([ball], 0.0);
    const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
    resolveEvent(state, event, STANDARD_9_FOOT);
    return ball.vel[0]; // tangential axis for this (top-wall) bounce
  }

  const baseline = reboundTangential(0);
  const positive = reboundTangential(50);
  const negative = reboundTangential(-50);
  expect(positive).toBeGreaterThan(baseline);
  expect(negative).toBeLessThan(baseline);
  // Note: unlike the old bolt-on throw term, the coupled cushion-contact model resolves
  // spinZ's slip contribution (R·cosθ·wZ) together with the ball's own tangential slide
  // (vT) at the *same* contact point, so a sign flip on spinZ does not produce an equal and
  // opposite deflection here — the two spinZ magnitudes interact differently with vT's fixed
  // sign. Only the direction of the effect is guaranteed to flip, not its size.
});

test("resolve rail collision throw does not reverse the sign of spinZ", () => {
  // Unlike the old bolt-on throw term (a simple friction-opposes-slip decay, always shrinking
  // |spinZ|), the coupled model resolves spinZ's cushion-contact slip together with the
  // ball's own tangential slide at the same contact point (see resolveRailCollision's slipAT
  // term). For this setup that coupling actually *grows* |spinZ| (50 -> ~65.8) rather than
  // shrinking it — a real consequence of full coupling, not a bug. What still must hold:
  // friction can't overshoot and flip spinZ's sign in a single impact.
  const spinZBefore = 50;

  const ball = new BallState(
    [0.5, STANDARD_9_FOOT.height - BALL_RADIUS],
    [2.0, 2.0],
    [0, 0],
    MotionState.SLIDING,
    0,
    spinZBefore,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);

  expect(Math.sign(ball.spinZ)).toBe(Math.sign(spinZBefore));
});

test("resolve rail collision leaves omega not quite perpendicular to vel when sidespin throws it (curves after the bounce)", () => {
  // A natural-roll ball's omega is tied to its *pre-bounce* vel direction, which the bounce
  // changes. The cushion's tilted contact normal (CUSHION_CONTACT_SIN_THETA, see
  // resolveRailCollision) torques omega partway toward the new direction but — outside of
  // special-case angles — not all the way, so omega and the new vel still end up misaligned
  // and the ball still curves afterward.
  const R = BALL_RADIUS;
  const vel0: [number, number] = [2.0, 2.0];
  // Natural roll before impact: omega locked to the incoming velocity direction.
  const rollOmega = scale(rotate90(vel0), 1 / R);
  const ball = new BallState(
    [0.5, STANDARD_9_FOOT.height - R],
    vel0,
    rollOmega,
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);

  // omega isn't fully realigned by the bounce (only partially corrected, plus spinZ change),
  // so it no longer points anywhere close to perpendicular to the new (reflected) vel.
  expect(Math.abs(dot(ball.vel, ball.omega))).toBeGreaterThan(1e-3);
});

test("resolve rail collision on a rolling ball: rebound angle is speed-independent (Mathavan et al. 2010, Fig. 8 regression)", () => {
  // The paper's headline experimental+theoretical finding for a rolling ball with no
  // sidespin: the rebound angle off the cushion's normal is set entirely by the roll
  // condition's geometry, not by impact speed — only rebound *speed* scales with incident
  // speed. This is the clearest, most distinctive regression check for the coupled model
  // (see resolveRailCollision), so it replaces the old height-torque hand-derivation here.
  const R = BALL_RADIUS;

  function reboundAngleAndSpeed(speed: number, incidentAngleDeg: number) {
    const theta = (incidentAngleDeg * Math.PI) / 180; // measured off the rail normal
    const vel0: [number, number] = [Math.sin(theta) * speed, Math.cos(theta) * speed];
    const omega0 = scale(rotate90(vel0), 1 / R); // natural roll: omega locked to vel0's direction
    const ball = new BallState([0.5, STANDARD_9_FOOT.height - R], vel0, omega0, MotionState.ROLLING);
    const state = new SimulationState([ball], 0.0);
    const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
    resolveEvent(state, event, STANDARD_9_FOOT);

    const normal: [number, number] = [0, -1]; // ball is at the y = height rail
    const speedAfter = norm(ball.vel);
    const angleAfterDeg =
      (Math.acos(Math.min(1, Math.abs(dot(normalize(ball.vel), normal)))) * 180) / Math.PI;
    return { speedAfter, angleAfterDeg };
  }

  const slow = reboundAngleAndSpeed(1.0, 40);
  const fast = reboundAngleAndSpeed(2.5, 40);

  // Rebound speed does scale up with incident speed...
  expect(fast.speedAfter).toBeGreaterThan(slow.speedAfter);
  // ...but the rebound angle is (to numerical precision) the same at both speeds.
  expect(fast.angleAfterDeg).toBeCloseTo(slow.angleAfterDeg, 4);
});

// ── resolve_event: jaw (angled) rail collisions via event.normal ──
//
// Regression coverage for wiring jaw/nose cushion collisions through the existing
// RAIL_COLLISION machinery: resolveRailCollision already accepted an arbitrary normal, so
// the only change was resolveEvent preferring event.normal when present, falling back to
// the axis-aligned derivation otherwise. These confirm both paths.

test("resolve event rail collision with an arbitrary non-axis-aligned normal reflects velocity correctly", () => {
  // resolveRailCollision has no privileged axis — it works entirely in (normal, tangent,
  // spinZ) coordinates. So the physically correct check isn't a closed-form formula (the
  // coupled model has none), it's rotational invariance: resolving the same collision
  // against an axis-aligned normal, or against that whole setup rotated by some angle phi
  // and resolved against the rotated normal, must give the same answer up to that same
  // rotation.
  const R = BALL_RADIUS;
  const vel0: [number, number] = [1.3, -2.1];
  const omega0: [number, number] = [4, -7];
  const spinZ0 = 12;
  const normal0: [number, number] = [0, -1];

  const reference = new BallState(
    [0.5, STANDARD_9_FOOT.height - R],
    vel0,
    omega0,
    MotionState.SLIDING,
    0,
    spinZ0,
  );
  const refState = new SimulationState([reference], 0.0);
  resolveEvent(
    refState,
    { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null },
    STANDARD_9_FOOT,
  );

  const phi = 0.7;
  const normal1 = rotateByAngle(normal0, phi);
  const rotated = new BallState(
    [1.2, 0.6], // position is irrelevant here — event.normal is passed explicitly
    rotateByAngle(vel0, phi),
    rotateByAngle(omega0, phi),
    MotionState.SLIDING,
    0,
    spinZ0,
  );
  const rotState = new SimulationState([rotated], 0.0);
  resolveEvent(
    rotState,
    { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null, normal: normal1 },
    STANDARD_9_FOOT,
  );

  const velBack = rotateByAngle(rotated.vel, -phi);
  const omegaBack = rotateByAngle(rotated.omega, -phi);

  expect(q3(velBack[0])).toBe(q3(reference.vel[0]));
  expect(q3(velBack[1])).toBe(q3(reference.vel[1]));
  expect(q3(omegaBack[0])).toBe(q3(reference.omega[0]));
  expect(q3(omegaBack[1])).toBe(q3(reference.omega[1]));
  expect(q3(rotated.spinZ)).toBe(q3(reference.spinZ));
});

test("resolve event rail collision without a normal falls back to the axis-aligned derivation (no regression)", () => {
  // Same setup as "resolve rail collision perpendicular" — confirms omitting event.normal
  // (as every pre-existing Event literal in this file does) leaves behavior unchanged.
  const ball = new BallState(
    [STANDARD_9_FOOT.width - BALL_RADIUS, 0.7],
    [3.0, 0.0],
    [0, 0],
    MotionState.SLIDING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("-2.730");
  expect(q3(ball.vel[1])).toBe("0.000");
});

test("resolve event rail collision with a real jaw-segment normal bounces the ball back into play", () => {
  const seg = getJawSegments(STANDARD_9_FOOT)[0];
  // Approaching the face head-on (velocity opposite the outward normal).
  const ball = new BallState([1.0, 0.7], [-seg.normal[0] * 2, -seg.normal[1] * 2], [0, 0], MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0, eventType: "RAIL_COLLISION", a: 0, b: null, normal: seg.normal };
  resolveEvent(state, event, STANDARD_9_FOOT);

  // Was approaching (negative dot with normal); after reflection it's moving away (positive).
  expect(dot(ball.vel, seg.normal)).toBeGreaterThan(0);
});

// ── regression: diamond-system bank shot shouldn't rebound absurdly long ──
//
// Reported bug: a rolling cue ball aimed (per the diamond system) from in front of the 2nd
// diamond on one long rail at the 3rd diamond on the opposite rail, at a moderate pace,
// should bank roughly back toward the near-side side pocket at the table's midpoint, not
// carry several diamonds past it toward the far corner. Under the current (Mathavan et al.
// 2010-based) coupled cushion model, this exact shot now goes one better than "roughly back
// towards" — it pockets in the near side pocket on the return leg.
test("bank shot off a long rail returns close to the mirror-image target, not several diamonds long (regression)", () => {
  const TABLE = STANDARD_9_FOOT;
  const R = BALL_RADIUS;

  // 2nd diamond on the y = 0 rail, pulled off the cushion a bit ("in front of" the diamond).
  const start: [number, number] = [0.25 * TABLE.width, 0.15];
  // 3rd diamond on the far (y = height) rail — the aiming target for the bank.
  const target: [number, number] = [0.375 * TABLE.width, TABLE.height - R];

  const dir = normalize(sub(target, start));
  const speed = 2.0; // medium pace
  const vel = scale(dir, speed);
  const ball = new BallState(start, vel, scale(rotate90(vel), 1 / R), MotionState.ROLLING);
  const state = new SimulationState([ball], 0);

  const railHitXs: number[] = [];
  let pocketedNearX: number | null = null;
  for (let i = 0; i < 30; i++) {
    const event = computeNextEvent(state, TABLE);
    if (!event) break;
    advanceState(state, event.time - state.time);
    const posBeforeResolve = ball.pos[0];
    resolveEvent(state, event, TABLE);
    if (event.eventType === "RAIL_COLLISION") railHitXs.push(posBeforeResolve);
    if (event.eventType === "POCKET") pocketedNearX = posBeforeResolve;
    if (state.balls.length === 0) break;
  }

  // First rail hit is the aimed-at bank off the far rail.
  expect(q3(railHitXs[0])).toBe(q3(target[0]));

  // Then either it pockets near the side pocket (width / 2), or — if it doesn't quite drop —
  // the second rail hit lands within a diamond's width (one 8th of the table) of it. Either
  // way, it must not sail several diamonds past it toward the far corner.
  const sidePocketX = TABLE.width / 2;
  const landingX = pocketedNearX ?? railHitXs[1];
  expect(landingX).not.toBeUndefined();
  expect(Math.abs(landingX - sidePocketX)).toBeLessThan(TABLE.width / 8);
});

// ── resolve_event: state changes ──

test("resolve event state change sliding to rolling", () => {
  const ball = new BallState([1.0, 0.7], [2.0, 0.0], [0, 0], MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "STATE_CHANGE", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(ball.motion).toBe(MotionState.ROLLING);
});

test("resolve event state change rolling to stopped", () => {
  const ball = new BallState([1.0, 0.7], [0.5, 0.0], [0, 0], MotionState.ROLLING);
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "STATE_CHANGE", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(ball.motion).toBe(MotionState.STOPPED);
  expect(ball.vel[0]).toBe(0.0);
  expect(ball.vel[1]).toBe(0.0);
});

// ── resolve_event: rail collisions ──

test("resolve event rail collision right wall", () => {
  const ball = new BallState(
    [STANDARD_9_FOOT.width - BALL_RADIUS, 0.7],
    [3.0, 0.0],
    [0, 0],
    MotionState.ROLLING,
  );
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("-2.730");
  expect(q3(ball.vel[1])).toBe("0.000");
  expect(ball.motion).toBe(MotionState.SLIDING);
});

test("resolve event ball collision", () => {
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([2 * BALL_RADIUS, 0.0] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const state = new SimulationState([a, b], 0.0);
  const event: Event = { time: 0.1, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(a.vel[0])).toBe("0.000");
  expect(q3(b.vel[0])).toBe("3.000");
});

test("resolve event rail collision left wall", () => {
  const ball = new BallState([BALL_RADIUS, 0.7], [-3.0, 0.0], [0, 0], MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("2.730");
  expect(q3(ball.vel[1])).toBe("0.000");
});

test("resolve event rail collision bottom wall", () => {
  const ball = new BallState([1.0, BALL_RADIUS], [0.0, -3.0], [0, 0], MotionState.SLIDING);
  const state = new SimulationState([ball], 0.0);
  const event: Event = { time: 0.1, eventType: "RAIL_COLLISION", a: 0, b: null };
  resolveEvent(state, event, STANDARD_9_FOOT);
  expect(q3(ball.vel[0])).toBe("0.000");
  expect(q3(ball.vel[1])).toBe("2.730");
});

// ── contact chain resolution ──

const D = 2 * BALL_RADIUS; // center-to-center distance for touching balls

test("chain resolution: three balls in a line", () => {
  // A hits B which is touching C, all in a line along x-axis
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([D, 0.0] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const c = new BallState([D * 2, 0.0] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const state = new SimulationState([a, b, c], 0.0);
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);

  // Energy should propagate through: A stops, B stops, C gets the velocity
  expect(q3(a.vel[0])).toBe("0.000");
  expect(q3(b.vel[0])).toBe("0.000");
  expect(q3(c.vel[0])).toBe("3.000");
});

test("chain resolution: momentum conserved through chain", () => {
  const a = new BallState([0.0, 0.0], [4.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([D, 0.0] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const c = new BallState([D * 2, 0.0] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const state = new SimulationState([a, b, c], 0.0);
  const pBefore = add(scale(a.vel, a.mass), add(scale(b.vel, b.mass), scale(c.vel, c.mass)));
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);
  const pAfter = add(scale(a.vel, a.mass), add(scale(b.vel, b.mass), scale(c.vel, c.mass)));
  expect(q3(pAfter[0])).toBe(q3(pBefore[0]));
  expect(q3(pAfter[1])).toBe(q3(pBefore[1]));
});

test("chain resolution: break-like triangle rack", () => {
  // Cue hits apex ball which touches two balls behind it (triangle formation)
  const rowGap = BALL_RADIUS * Math.sqrt(3);
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING); // cue
  const b = new BallState([D, 0.0] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED); // apex
  const c = new BallState(
    [D + rowGap, -BALL_RADIUS] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED,
  );
  const d = new BallState(
    [D + rowGap, BALL_RADIUS] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED,
  );
  const state = new SimulationState([a, b, c, d], 0.0);
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);

  // All balls that received energy should be moving
  expect(norm(c.vel)).toBeGreaterThan(0.1);
  expect(norm(d.vel)).toBeGreaterThan(0.1);

  // Momentum conserved
  const totalP = state.balls.reduce(
    (p, ball) => add(p, scale(ball.vel, ball.mass)),
    [0, 0] as [number, number],
  );
  expect(totalP[0]).toBeCloseTo(3.0 * a.mass, 4);
  expect(totalP[1]).toBeCloseTo(0, 4);
});

test("chain resolution: no effect on separated balls", () => {
  // A hits B, C is far away — C should not be affected
  const a = new BallState([0.0, 0.0], [3.0, 0.0], [0, 0], MotionState.SLIDING);
  const b = new BallState([D, 0.0] as [number, number], [0.0, 0.0], [0, 0], MotionState.STOPPED);
  const c = new BallState([1.0, 1.0], [0.0, 0.0], [0, 0], MotionState.STOPPED); // far away
  const state = new SimulationState([a, b, c], 0.0);
  const event: Event = { time: 0, eventType: "BALL_COLLISION", a: 0, b: 1 };
  resolveEvent(state, event, STANDARD_9_FOOT);

  expect(c.vel[0]).toBe(0);
  expect(c.vel[1]).toBe(0);
  expect(c.motion).toBe(MotionState.STOPPED);
});
