# Physics engine — missing real-world behavior

Follow-ups after the tangent-line curving fix (`engine/physics/ball-state.ts`,
`motion-models.ts`, `event-resolution.ts`, `event-prediction.ts`). Roughly ordered by how much
they'd change existing behavior — the deferred items from that fix's planning are marked.

## Deferred from the curving fix

- [x] **Pocket-entry prediction still assumes straight-line motion.** `predictPocketEntry` in
      `engine/physics/event-prediction.ts` now solves the same quartic (ball-vs-fixed-point,
      constant-acceleration) root finding as `predictBallBallCollision`, instead of casting a
      straight ray. Exact for both ROLLING and SLIDING (the sliding acceleration direction is
      fixed for the sub-phase, so this is not an approximation). Covered by new tests in
      `engine/physics/__tests__/event-prediction.test.ts` and playable via the "Curve Into
      Pocket" debug scenario.
- [x] **A ball with pure spin and zero velocity stays frozen.** `ballAcceleration` and
      `slidingMotion` in `engine/physics/motion-models.ts` now key off the contact-point slip
      (`vel + rotate90(omega) * radius`) instead of `vel` alone, so a ball with `vel = 0` and
      `omega != 0` correctly accelerates from rest. `timeSlidingToRolling`'s zero-velocity guard
      and `predictPocketEntry`'s zero-speed early exit had the same bug and are fixed too —
      both are on the hot path for any SLIDING ball, spinning-in-place or not. Covered by new
      tests in `motion-models.test.ts` and `simulator.test.ts`, and playable via the "Draw
      Creep" debug scenario (a full/head-on draw shot: the cue ball stops dead on contact but
      now draws back afterward from leftover backspin, instead of staying frozen).

## Bigger gaps (not touched by that fix)

- [x] **No sidespin/English.** `BallState` now carries a third spin component, `spinZ`
      (vertical-axis angular velocity), alongside the existing horizontal-plane `omega`.
      `cueStrike` takes a new `sidespin` parameter (mirroring `spin`, bounds-checked together
      against the same tip-offset/miscue limit). `spinZ` doesn't interact with cloth friction
      (a flat-table point-contact model has no lever arm for it there — only omega does), but
      `resolveBallCollision` now applies a small Coulomb-friction tangential impulse at
      ball-ball contact driven by the two balls' combined `spinZ`, which "throws" a cut ball
      off the pure tangent line — deliberately spin-only, not cut-angle-driven, so a spinless
      cut/stun shot still lands exactly on the tangent line as tested elsewhere. Also threaded
      `cueSidespin` through the game reducer's aim/shoot/undo/replay state (mirroring `cueSpin`)
      and fixed a real bug in `recorder.ts` where its deep-copy silently dropped `spinZ`. Rail
      spin-transfer and cue-tip squirt remain separate follow-up items below. Covered by new
      tests in `motion-models.test.ts`, `event-resolution.test.ts`, `recorder.test.ts`, and
      `game-reducer.test.ts`; playable via the "Throw Off Line" debug scenario (same thin cut
      and speed as a spinless shot, but heavy english visibly sends the object ball to a
      different spot on the far rail).
- [ ] **No squirt/deflection from cue tip offset.** Off-center hits for english should deflect
      the cue ball's initial direction slightly from where the cue was aimed; `cueStrike` takes
      direction and spin as independent, already-resolved inputs.
- [ ] **Rail contact has no spin transfer or spin-dependent throw.** `resolveRailCollision` in
      `engine/physics/event-resolution.ts` is a pure reflection + restitution coefficient on
      `vel`; `omega` is untouched. (Side note: because of that, a spinning ball should already
      curve after a rail bounce too, for the same reason the ball-ball fix works — worth
      confirming with a test once this is revisited.)
- [ ] **No elevated-cue shots** (masse, swerve-via-elevation, jump shots) — engine is a flat 2D
      table plane, no z-axis.
- [ ] **Pockets are instant absorption, not physical jaws** — no rattle/rim-out modeling.
- [ ] **Constant friction coefficients** (`MU_SLIDE`, `MU_ROLL`) rather than speed- or
      cloth-condition-dependent — minor, low priority.
