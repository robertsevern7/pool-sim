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
- [x] **Rail contact has no spin transfer or spin-dependent throw.** `resolveRailCollision` in
      `engine/physics/event-resolution.ts` now applies the same Coulomb-friction tangential
      impulse mechanism as ball-ball throw, driven by `spinZ` alone (a spinless bounce still
      reflects with `vt` exactly preserved, as already tested) — this is "cushion english,"
      the classic effect where sidespin changes a ball's rebound angle off a rail. New
      `RAIL_FRICTION` constant (0.14, notably higher than `BALL_FRICTION`'s 0.05 — cushion
      rubber grips more than a ball's phenolic surface) is a measured value from Mathavan,
      Jackson & Parkin's peer-reviewed cushion-impact paper (Proc. IMechE, 2010), not
      invented. Also confirmed the side note from when this item was written: since `omega`
      (follow/draw axis) is untouched by a rail bounce, a natural-roll ball's omega stays
      tied to its *pre-bounce* direction, which the bounce changes — so it now visibly curves
      afterward, for the same reason the ball-ball curving fix works. Covered by new tests in
      `event-resolution.test.ts` (exact hand-derived numbers, sign-flip symmetry, slip
      reduction, and the curving-after-bounce confirmation); playable via the new "Cushion
      English" debug scenario (a single-rail bank shot lands in a very different spot with
      sidespin than without).

      Also found and fixed via this scenario: `buildAimedBalls` in `game-reducer.ts` had a
      third bug in the same family as the `extractCueParams` squirt round-trip fix — its
      fallback aim direction (used when there's no explicit aim and no target ball, e.g. a
      single-ball scenario) fed the cue ball's already squirt-deflected `vel` direction
      straight back into `cueStrike`, applying squirt a *second* time on top of itself. In
      this case that was enough to send the ball's rebound past a corner pocket's cushion
      gap and off into unbounded space (pockets have no physical jaws — a separate, known,
      lower-priority limitation below — so a clipped corner just sails off-table instead of
      rattling out). Fixed by sharing the same "undo squirt" rotation `extractCueParams`
      already used. Covered by a regression test in `game-reducer.test.ts`; reproduced and
      confirmed fixed both through the reducer directly and in the browser.
- [ ] **Pockets are instant absorption, not physical jaws** — no rattle/rim-out modeling.
