# Physics engine — missing real-world behavior

Follow-ups after the tangent-line curving fix (`engine/physics/ball-state.ts`,
`motion-models.ts`, `event-resolution.ts`, `event-prediction.ts`). Roughly ordered by how much
they'd change existing behavior — the deferred items from that fix's planning are marked.

## Deferred from the curving fix

- [ ] **Pocket-entry prediction still assumes straight-line motion.** `predictPocketEntry` in
      `engine/physics/event-prediction.ts` casts a straight ray to the pocket's fall circle. Now
      that sliding balls can curve post-collision, this is an approximation during the sliding
      sub-phase (bounded error, documented with a comment at the function). Exact fix needs
      numeric ray-vs-curve root finding.
- [ ] **A ball with pure spin and zero velocity stays frozen.** `ballAcceleration` and
      `slidingMotion` in `engine/physics/motion-models.ts` return no motion at all when
      `vel = 0`, regardless of `omega`. In reality a ball spinning in place would start to
      translate from cloth friction.

## Bigger gaps (not touched by that fix)

- [ ] **No sidespin/English.** `cueStrike` only has a follow/draw parameter — no rotation about
      the vertical axis. Blocks: swerve on cloth, english carrying through rail rebounds, and
      cut-/spin-induced **throw** at ball-ball contact (today's collision is a purely elastic
      normal impulse with no tangential friction during contact). This is the natural next step
      after the curving fix, since it needs a third spin component beyond the horizontal
      (topspin/backspin) `omega` vector introduced there.
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
