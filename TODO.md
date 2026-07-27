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
- [x] **No squirt/deflection from cue tip offset.** `cueStrike` now deflects the ball's actual
      initial direction away from the aimed `direction` by an angle proportional to `sidespin`
      (`MAX_SQUIRT_ANGLE` in `constants.ts`). Calibrated to 2.5° at max offset from published
      measurements (Ron Shepard's squirt paper / Dr. Dave Alciatore's pool physics FAQ: ~0.5°
      for low-deflection shafts up to ~2.5° for standard wood shafts) rather than derived from
      a cue-mass model — this engine doesn't simulate shaft stiffness/tip contact mechanics,
      and an invented "effective mass ratio" produced an unrealistic ~5.7°, way outside the
      measured range, before being corrected. `omega`/`spinZ` are still set from the original
      aim direction (the tip contact geometry), only `vel` uses the deflected direction — so
      omega ends up not quite perpendicular to vel, meaning a heavy-english shot now also
      curves slightly during its initial slide, for the same reason the post-collision curving
      fix works. Fixed `extractCueParams` in `game-reducer.ts` to undo the squirt rotation
      before projecting omega back out, or recovered `spin` would carry an error whenever
      `sidespin != 0`. Covered by new tests in `motion-models.test.ts` and
      `game-reducer.test.ts`; playable via the new "Squirt Miss" debug scenario (a
      dead-straight aim at an object ball misses entirely with uncompensated max sidespin, but
      hits it dead center with none). Also had to re-tune "Throw Off Line" — squirt was
      confounding it — its aim is now pre-compensated for its own sidespin's squirt so it
      isolates ball-ball throw the way a player compensating for squirt would.

      Also fixed, found via manual testing: `computeNextEvent` in `event-prediction.ts` used
      `if (t && ...)` to gate each predicted event time, which silently drops a legitimate
      `t = 0` (0 is falsy in JS). This became a live, hittable crash once `timeSlidingToRolling`
      could validly return exactly 0 (e.g. `spin = 0.8` puts a ball exactly at the natural-roll
      condition right out of `cueStrike`) — a follow-on regression from the "pure spin" fix
      above, which changed that function's guard from `vel = 0` to `slip = 0` but didn't
      account for a *moving* ball already at zero slip. The event was silently dropped, leaving
      the ball stuck mid-preview, and a later action (changing the aim) crashed deep inside
      code that assumed that couldn't happen. Fixed the guard to only throw when truly at rest
      (`vel = 0` and `omega = 0`), and fixed all four `computeNextEvent` checks to use
      `t !== null`. Covered by regression tests in `motion-models.test.ts`,
      `event-prediction.test.ts`, `simulator.test.ts`, and `game-reducer.test.ts` (the exact
      set-spin-then-change-aim repro).
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
