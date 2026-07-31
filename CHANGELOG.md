# Changelog

ANIMA ships one aspect of an animated character per minor version — a rig, a
gait, a controller, a wardrobe system — each taken end to end: code, unit
tests, a runnable example, headless verification in Chromium that the body
actually moves the way the release claims, and docs.

The format is one line per release, taken from that release's own commit
message. Those were written at the time and are more accurate than a summary
written now. The commit messages carry the long form, including the bugs each
release found.

`0.x` means minor versions may add and occasionally reshape API.

## Not on npm

`0.1.0`–`0.5.0` predate the first publish; the package reached the registry at
`0.6.0`. Every other committed version is published. (Verified against
`npm view anima3d versions`, not assumed.)

## Releases

## [0.44.0] — 2026-07-31

### Added

- **`Mood` — a modulation layer, not a pose set.** An emotion has no keyframe:
  sadness is eight degrees of head pitch, a chest that has stopped opening,
  four centimetres off your height and a walk a third slower, applied to
  standing, sitting, climbing and fighting alike. Two axes (`valence`,
  `arousal`), thirteen named corners in `MOODS`, and the same additive
  give-it-back machinery `Cockpit` uses for g-load.
- **It publishes rather than applies.** `pace`, `gestureScale`,
  `mannerismRate` and `gazeAuthority` — a mood that quietly slowed
  `Locomotion` would desynchronise the stride from the declared speed and
  slide the foot every step. Mood describes; the game applies.
- **`measurePosture` and `npm run mood`** — the fourth gate, after `skate`,
  `climb` and `parkour`. Monotone on both axes over 41 samples; `neutral`
  moves the body by exactly nothing; 3600 frames and three mood changes leave
  6.4e-7 behind; no mood saturates its own clamp; and `pace`, re-timed the way
  a game re-times, costs **0.551%** foot skate — the baseline walk's own
  number. Four mutations verified firing.

## [0.43.0] — 2026-07-31

### Added

- **The `dogfight` playground — a jet fight you actually fly.** SCENA builds
  the deltas and the ammunition, GAMA flies them and throws the shells and
  missiles, ANIMA puts a pilot in the seat who wears the g. Keyboard and touch.
- **The ammunition handshake, used in anger.** The guns are
  `ballisticsOf('autocannon')` — the same table entry that shapes the cartridge
  model decides muzzle velocity, drop, tracer size and colour. The 60-round
  belt and the four-round missile rack are SCENA `Countable`s mounted on the
  airframe: firing calls `consume()`, so what the HUD says and what the
  aircraft is carrying are one fact. Explosions are three `createEffects`
  bursts plus a `GameFeel` shake.

### Changed

- Bumped to `scena3d@0.107.0` and `gama3d@0.45.0`.

### Fixed

- Four bugs, all found by flying it headlessly rather than screenshotting it:
  a scaled-down muzzle velocity (0.16×) that made the gun unhittable — sixty
  rounds at a bandit closing to thirteen metres, zero hits; bandit AI that
  chased a lead point and so parked all three permanently on the player's six;
  a 29° seeker cone that never tripped a lock from a keyboard; and discrete
  actions (missile, flares, camera, rearm) sampled as held state, so a quick
  tap of F landed and cleared between two frames and the rack stayed full at
  four with the lock solid. Discrete inputs are latched now.

## [0.42.0] — 2026-07-31

### Added

- **Parkour Tier 2 — down and across.** `drop` and `gap-jump` join the four
  climbing moves, with `landingFor(fall, reach)` → `'absorb' | 'roll' | 'hurt'`
  and `canClear(gap, reach, speed)`. Three questions, three calls, because they
  are not the same question: `attempt` chooses between techniques a body may or
  may not have, `descend` reports what a landing **costs** rather than whether
  it is allowed (you fall whether or not you have a technique), and `leap` asks
  about speed. A `Gap { edge, width }` is its own shape — describing a hole in
  terms of `height` and `depth` would be a lie about what is measured.
- **`Obstacle.landing` finally means something.** It had been declared and read
  by nothing. The drop and both vaults now use it: step off a 1.3 m parapet
  onto ground 1.3 m lower than the near side and you have fallen 2.6 m.
- **`float` and `airborne` on `FootSkateReport`**, gated at zero for bipeds.
- **`footing`, `clearance` and drop-technique lines on `npm run parkour`**,
  which now sweeps three questions over eight bodies — **1189 moves**.

### Fixed

- **The gaits had no foot on the ground.** 43% of the walk cycle and 63% of the
  run, peaking 79 mm and 222 mm up, since 0.1.0. A sine-driven leg is a
  pendulum and its foot traces an arc — `leg × (1 − cos θ)`, which is 277 mm at
  the run's hip swing. `createLocomotionClips` now measures the lower ankle on
  the posed body and lowers the hips onto it; the authored `bob` sine is gone,
  because what planting produces is the compass gait and the vertical motion of
  a gait is a consequence of leg geometry rather than a free parameter. A foot
  is down 100% of the cycle on every body, float ≤ 1 mm. The fix moves only
  `Hips.position.y`, so no foot's Z changes and the stride is untouched by
  construction — `npm run skate` is unmoved, and its worst slide per step
  improved 121.0 mm → 70.3 mm.
- **Both vaults ended 410 mm below the road.** The exit kept the shoulder
  anchored near the wall top, and a standing body's shoulder is a metre and a
  half up, so the clip finished with the body still folded over the rail. The
  contact gate stops looking when the hand lets go at 0.62, and the one test
  that checked where a move ends vertically covered the step and the mantle and
  skipped the vaults. Vaults now hand over to a hips anchor on the far ground.
- **The gap jump ended at its deepest crouch**, 250 mm under, because the
  anchor moves the root: "hips low" reads as "body below the ground" to
  anything that asks where the move ended. A landing now absorbs *and* recovers.
- **`measureParkourContact` played one-shot clips on a repeating action.**
  `clipAction()` defaults to `LoopRepeat`, and a repeating action asked for the
  time at exactly the clip's duration wraps to zero — so the final sample of
  every measurement ever taken was the move's **first frame**. It read as a
  185 mm jump in a foot's last frame on a step-up whose real worst frame was
  7 mm.
- **`snap` pooled a contact's two ease ramps into one track**, making the step
  from the last frame of one to the first frame of the other look consecutive
  while spanning the entire plant between them — 282 mm reported as a single
  frame on a gap jump whose worst real frame was 32 mm.
- **`snap`'s budget was 10 and could not fail.** With both harness bugs gone
  the worst real case is 1.83×, and over twelve bodies the metric runs p50
  1.54, p90 1.83, p99 1.83, max 1.83 — a band a third of a unit wide, because
  the ratio is a property of the ease curve and not of the body. Now 2.5.

### Changed

- The `parkour` playground pays for every climb with a descent, jumps a real
  trench cut in the road, and reports whether either runner is off its own
  ground. Its previous course walked both runners through the air past the far
  edge of everything they got onto.

## [0.41.0] — 2026-07-30

### Added

- **The `parkour` playground example — two bodies, one course.** Both runners
  take the identical obstacle course; they agree about the curb, split at the
  0.91 m rail (the taller speed-vaults it, the shorter has to mantle) and split
  again at the 1.40 m wall, which the taller clears and the shorter **refuses**.
  The refusal is the feature: a system that always finds a move puts characters
  through walls. Heights were chosen to straddle the two bodies' bands, because
  the entire claim is that a band is a property of a person.
- **`snap` in `ParkourContactReport`, and a budget for it in `npm run parkour`**
  — the contact ease, finally measured. 0.40.0 shipped with this stated as a
  known hole: four of five injected defects moved the gate and removing the
  ease entirely moved nothing. It moves now.

### Learned — two wrong ways to measure an ease

Both worth keeping, because both looked reasonable and neither was:

- **In metres.** The largest single-frame move of a contact limb reads
  **186 mm/frame for a step-up that is perfectly smooth**, because a limb
  swinging onto a hold legitimately moves fast. A teleport is not a distance.
- **As a ratio, across the whole contact window.** A discontinuity is an
  outlier, so `snap` became a ratio against the limb's own median step — and
  read **4210×**, because the window includes the long planted stretch where
  the limb is deliberately motionless and the median is therefore zero.

Measured across the ease *ramps* alone it separates cleanly: **5.88× with the
ease, 138.90× without.** The budget is 10×, which leaves real headroom and
still catches the defect by 14×.

That is three metrics in this module now that had to be reformulated before
they measured the thing they were named after — `handSlip` (peak, not sum),
`stretch` (which sees a clamp that nothing else can), and `snap`. The pattern
is consistent enough to be worth naming: **a number that never fires is not
evidence of health until you have watched it fire.**


## [0.40.0] — 2026-07-30

### Added — the parkour system

`reachOf`, `chooseMove`, `createMove`, `Parkour`, `measureParkourContact`,
`npm run parkour`, [docs/parkour.md](docs/parkour.md), and an `Obstacle`
handshake that SCENA's props satisfy structurally. Four moves: step-up, safety
vault, speed vault, mantle.

The move set is derived from the BODY. `reachOf(rig)` returns knee, hip,
shoulder and overhead bands from the rig's own leg length and stature, so a
1.67 m and a 1.77 m character make different choices at the same wall — one
vaults it, the other mantles — from one code path. Warping authored mocap
cannot do that; ANIMA has no mocap to warp.

`chooseMove` returns `null` and means it. Measured over eight bodies and 790
obstacles: 100% of reachable obstacles get a move, 120 unreachable ones are
refused, none is wrongly accepted.

### The rewrite

The first attempt authored each body path in absolute metres and then asked
whether the contacts were reachable from it. That is backwards, and it does
not converge: a vaulter's shoulder only reaches an 0.85 m wall by FOLDING over
the planted arm, so the reachable set depends on the pose, which depends on
the phase, which is what is being solved for. Standing upright a 1.77 m body's
shoulder is 0.60 m above that wall and its arm is 0.50 m long — the hand could
not touch the top at all.

Moves now author where a body LANDMARK belongs relative to the contact, in
units of limb length, and the root falls out of it — measured from the posed
body each frame, so the fold is accounted for rather than assumed.

| move | before | after |
|---|---|---|
| step | 271 mm | **0.22 mm** |
| safety-vault | 1086 mm | **3.76 mm** |
| speed-vault | 1105 mm | **8.65 mm** |
| mantle | 789 mm | **8.25 mm** |

Penetration went from up to 692 mm to **0**, and no limb is left clamped.

### Six defects, each found by measurement

- **`solveChain` returns a WORLD rotation; `toParentFrame` expects one in RIG
  space.** Invisible in `climb`, where a ladder-climbing rig is never turned.
  Worth 350 mm on a vault, which turns by a radian — and the tell was that the
  step, the one move with no yaw, was already exact to 0.2 mm.
- **Left and right were swapped.** In this rig left is +x; the two hand
  contacts were written the other way round. Survivable for a one-handed move
  because the body just shifts to suit — but on the two-handed mantle it put
  the left shoulder over the right hand's mark and stranded the right arm
  0.88 m from a target a 0.50 m arm was meant to reach.
- **Authoring an offset as components instead of a radius.** A shoulder asked
  for 0.72 of an arm above the hand and 0.40 m past it is 0.536 m from a
  0.496 m arm. Each component looked fine; their combination did not.
- **A handover that converted between landmark frames.** "The shoulder is 0.72
  of a leg above the hips" is a guess whose true value depends on how folded
  the torso is. Blending the resulting ROOTS needs no conversion; the guess
  cost 462 mm.
- **`buildClip` discovers its track list from frame 0 alone**, so a bone only
  posed once its contact goes live never got a track at all — the solve was
  computed and thrown away. 1.8 m of apparent slip from a hand nothing drove.
- **`buildClip` made the last frame a repeat of the first.** Correct for a
  loop, wrong for a one-shot: a vault that rewinds itself in its final frame.
  It now takes a `loop` flag.

### Changed

- `buildClip` takes an optional `loop` argument (default `true`, unchanged for
  every existing caller).
- The two-link solver the ladder climb earned now lives in `src/solve.ts` and
  is shared: `solveChain`, `toParentFrame`, `restDirection`, `chainLengths`.

### Known gaps, stated rather than papered over

- **The contact ease is not gated.** Limbs blend on and off their holds so
  they do not teleport onto the wall, but the gate skips a keyframe either
  side of each plant — exactly where a snap would show. Removing the ease
  entirely leaves every number in the table above unchanged. Four of five
  injected defects move the gate; this is the fifth, and it does not.
- **No playground example yet.** This release is the library slice; the
  two-bodies-one-course demo is the next piece of work.
- No drop landings, gap jumps, cat leaps, wall runs, slides or balance.
  `reachOf` already publishes `catch` and `gapAt` toward the first two.


## [0.39.0] — 2026-07-30

### Fixed — the ladder climb, which was not a climb

The loop shipped in 0.24.0 claimed contralateral movement and three points of
contact in its own doc comment, and did neither. Every number below is
measured, before and after.

| | before | after |
|---|---|---|
| grip slip, per cycle | 0.367 m | 0.0015 m |
| cycle with more than one limb moving | 0.604 | 0 |
| left/right leg pose difference | 0.0025 m — both legs together | alternating |
| peak hand height vs the head bone | 0.014 m **below** | 0.14 m above |
| worst limb extension | 0.999 — locked straight, silently clamped | 0.94 |

Five separate defects:

- **A modulo cancelled the alternation.** `reach()` took `q % 0.5` while the
  two sides were offset by exactly 0.5, making `reach(p) ≡ reach(p+0.5)`. Both
  hands reached together and both feet stepped together — a bunny-hop up a
  ladder, with the doc describing a cross-body pattern the arithmetic had
  removed.
- **The arms never went overhead.** The rig rests in a T-pose, so a raised arm
  is a `Z` rotation of one sign; the clip used the other, holding the arms out
  sideways between 20° below and 4° above horizontal. The `[X, …]` term on the
  upper arm rotated the bone about its own axis — a pure twist that moved the
  hand nowhere.
- **The hands did not hold the rungs.** The body rose 0.60 m per cycle while a
  hand travelled 0.153 m relative to it. The module's own comment warned that
  decoupling these "slides the hands through the ladder", as if it had not.
- **The clip/translation sync was off by the clip's duration.** `timeScale =
  speed / 2` looks like a rate and is not one, so at the default the body rose
  at 1.6 rungs/s while the arms delivered 1.0.
- **A 35% single-frame discontinuity**, where the arm snapped back in one frame.

### Added

- **`measureClimbContact` and `npm run climb`** — the hand-and-rung sibling of
  `npm run skate`, swept over ten seeded bodies × four rung spacings. Reports
  peak grip slip, limb-movement overlap, worst extension and overhead reach.
  `stretch` earns its own place: a limb at full extension is not on its rung
  and does not slip either — it just hangs short, and nothing else can see it.
- `createClimbClip` now takes `ClimbClipOptions` (`rungSpacing`, `standoff`,
  `spread`, `duration`); a bare `duration` number still works as before.
- `Pose.set`, for poses that are solved rather than authored.
- [docs/climbing.md](docs/climbing.md), and the first tests this module has
  ever had — it shipped with none.

### Changed

- The loop is four beats and **one rung per cycle** (was two), with limbs
  solved onto rungs by two-link IK against the rig's own segment lengths
  rather than posed by angle. Angles that put a 1.9 m character's hands on the
  rungs put a 1.5 m character's through them.
- `Climb`'s default `standoff` is 0.2 m (was 0.3). It is not cosmetic: an arm
  is a fixed length, so every centimetre spent standing back from the ladder
  comes off the vertical reach.

### Learned

Three of these were found by writing the measurement, not by looking. The
screenshot of the broken climb looks like a person on a ladder — the arms are
in roughly the right place, the legs bend, the body rises. What a still frame
cannot show is that both legs move together, that the hands slide 37 cm a
cycle, or that a limb is locked straight because the solver quietly gave up.

The two metric mistakes are worth keeping too. Calling the quietest 70% of
frames "holding" flattered two opposite errors at once — it swallowed the
easing tail of a limb's own beat, and on a clip where everything slid gently
it would have found no holding frames and reported nothing wrong. And summing
path length cannot tell a limb that wobbles 0.08 mm between keyframes from one
that slides away; that is a peak, not a sum, and it is the same lesson the
foot-skate gate had to learn about stride deviation.


### 2026-07-30

- **0.38.0** — `measureFootSkate` and the `npm run skate` gate: foot skate as a
  number, measured off the bones and checked against the speed each clip
  declares. It found three shipped defects, none of them visible to a unit test
  or a still frame — the run's stride factor was an unmeasured 1.6 against the
  walk's 1.35 (**18.4%** of slide, ~15 cm a step); `gaitSpeed` predicted a hoof
  sweep of `2·R·sin(reach)` while `poseLeg` drove the hind limb through
  `0.95·reach` (**8.5%**); and `createGaitClips` baked keyframes at a fixed
  *output* fps, so 1.4× tempo bought 13 of them instead of 19 and doubled the
  canter's skate to **7.5%**. **Behaviour change:** `runSpeed` drops (2.859 →
  2.412 on seed 7) and every horse gait speed drops ~5%, which moves where
  `Locomotion` and `QuadrupedLocomotion` change gait
- **0.37.1** — CI on every push, this changelog, and `playwright` as a
  devDependency so `verify:playgrounds` runs on a fresh clone

### 2026-07-29

- **0.37.0** — The sortie: a pilot who wears the g

### 2026-07-28

- **0.36.0** — The lamplighter: the lighting arc comes home
- **0.35.0** — Reactions: the body showing what the numbers did, and r185

### 2026-07-27

- **0.34.0** — Cricket: the actions, and both hands on the bat
- **0.33.0** — YogaClass: one practice, many bodies
- **0.32.0** — Flow: a vinyasa is a list of breaths
- **0.31.0** — Yoga: the asana engine — the held frame
- **0.30.0** — The Cypher — the floor becomes a social structure
- **0.29.0** — The Couple — one dance, two bodies
- **0.28.0** — Routines, vogue & krump — choreography as data
- **0.27.0** — The illusions and the house — travel is not weight
- **0.26.0** — The two classicals — where the dance keeps its time

### 2026-07-26

- **0.25.0** — Street styles — the hit and the freeze: popping, locking, waving, tutting, toprock
- **0.24.0** — Dance styles — the count is not the beat: salsa, waltz, bhangra
- **0.23.0** — Dance skills + the club: the trilogy's first three-way composition
- **0.22.1** — Bump scena3d to ^0.74.1, and carry the playground verifier across
- **0.22.0** — Add Rowing — a body driven by somebody else's clock

### 2026-07-25

- **0.21.0** — Add sea legs — standing up on ground that moves
- **0.20.1** — Fix the carry poses, which never held anything
- **0.20.0** — Add asymmetric two-handed prep work
- **0.19.0** — Add swimming
- **0.18.0** — Washing at a basin
- **0.17.0** — Working at a desk
- **0.16.1** — Example(queue): waiting, assembled from parts that already existed
- **0.16.0** — Glancing, and the attention demo
- **0.15.0** — The pose does all the work
- **0.14.0** — Nobody watches television by staring at it
- **0.13.0** — The horse was sliding, and the rider was standing

### 2026-07-24

- **0.12.0** — Horses — quadruped rig, real gaits, mounting, riding, ladders
- **0.11.0** — Mannerisms, conversation, and sitting down like a person
- **0.10.1** — Fix work poses: chop raises the axe overhead and strikes; stir dips in
- **0.10.0** — Work loops + labor demo: chop/mine/saw/stir over idle
- **0.9.0** — Carry: pick up, carry-while-walking, put down, hand off
- **0.8.0** — Manipulables: operate pose + one-shot Gesture, and the mechanisms demo
- **0.7.2** — The commute: GAMA drives the car
- **0.7.1** — At home: the interactive-props demo + friction-free slot typing
- **0.7.0** — Interactions: poses, loops and the Interaction controller

### 2026-07-22

- **0.6.2** — Stop the gaze winding un-animated bones like a rotor
- **0.6.1** — Fix gaze whipping around when a character carries the ball
- **0.6.0** — V0.6.0 'The Wardrobe': body types, garment layers, describeHumanoid creator API
- **0.5.0** — V0.5.0 'The Face': eyes, brows, noses, mouths, ears, hair styles, facial hair  *(not published)*
- **0.4.0** — V0.4.0 'The Crowd': VAT baking and instanced route-walking crowds  *(not published)*
- **0.3.0** — V0.3.0 'The Others': exact clip retargeting, sockets, seeded accessories  *(not published)*
- **0.2.0** — V0.2.0 'The Craft': foot IK, look-at chains, overlays, footstep events  *(not published)*
- **0.1.0** — ANIMA v0.1.0 'The Body': seeded humanoids, procedural gaits, locomotion blending  *(not published)*
