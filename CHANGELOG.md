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

## [0.46.0] — 2026-07-31

### Added

- **`Dining` — where the utensil is the mechanism, not the prop.** Swap a spoon
  for chopsticks and the *bowl comes to your face*; swap it for a glass and the
  *wrist tilts further as it empties*; swap it for a knife and fork and there is
  a whole sawing sub-action before every few bites. Eight of them — `fork`,
  `spoon`, `knifeAndFork`, `chopsticks`, `hands`, `cup`, `bowl`, `straw` — and
  83.8 mm of difference in how far the head travels between them.
- **A spoon has to stay level, and that is measured.** The wrist is corrected
  toward horizontal and the correction is clamped to a wrist's real range, so
  when it binds the load tips rather than the shoulder doing something a
  shoulder cannot. Across plate placements chosen to make a level carry hard, a
  spoon holds **0.000 rad** off level and a fork sits at **0.350** — twenty
  degrees, and enough to lose everything on it.
- **`pourAngle(fill, height, radius)` = `atan(h(1 − f) / r)`.** Geometry, not
  feel: a full glass needs no tilt and an empty one needs seventy degrees, and
  a wide soup bowl goes over far less than a narrow highball holding the same.
  Measured: **+0.55 rad from the first sip to the last.** A straw is the one
  vessel that never tips, and that is the whole of what a straw is.
- **The plate empties.** Food is `Countable` — the shape SCENA's counted props
  publish — so mouthfuls come out of a real number and the meal **ends**.
- **The reach is a closed loop.** A plate further away than an arm cannot be
  eaten from, so the body folds until it can: **0.00 rad** under the chin,
  **0.57** at arm's length, and a published limit of **474 mm** past which this
  body simply cannot reach.
- **A `mouth` socket**, taken from the face layout rather than guessed, so it
  sits between the lips on every seeded character and moves with the head.
- **`npm run dining` — the sixth gate.** `measureBite` eats a whole plate of all
  eight utensils on six bodies — 240 mouthfuls — and holds them to eleven
  budgets. Contact is a **closest-approach** question, not a worst-frame one: a
  gather is a scoop, and a worst-frame reading called that 40 mm of miss on a
  plate the hand was holding.
- **The `dining` playground** — eight diners on SCENA's own table slots, one
  seed between them, plates visibly emptying, and a plumb line from each mouth
  to the business end of each utensil.
- `Dining` takes the arms outright, only ADDS to the spine, chest, neck and
  head, and never touches the hips or the legs — which is what lets a sit pose
  and a meal share one body. `chewPhase` and `canSpeak` are published rather
  than applied, because this rig has no jaw and `Conversation` is the thing
  that should know nobody talks with their mouth full.

### Fixed

- Found by the new gate: a straw whose glass stayed on the table while the head
  went down to it, needing 47 cm of neck the rig does not have; an analytic
  reach solve that reported convergence with the fork 94 mm short of the plate;
  a knife and fork that cut at the plate and then "reached" for it from a
  resting pose, teleporting the tines 310 mm on one frame; a meal that ended
  the instant the plate hit zero, jumping the utensil 272 mm to a pose it had
  not travelled to; a `meet` routed through the head alone and worth 12 mm; a
  sip tilt read before the wrist had gone over, reporting 0.00 for every drink;
  and a spill number reported only for the utensils that correct, so a fork
  came out as level as a spoon because nobody had asked the fork.
- `npm run climb`, `parkour`, `mood`, `lifting` and `dining` now all run in CI.
  A gate CI does not run is not a gate.

## [0.45.0] — 2026-07-31

### Added

- **`Lifting` — gym work, and the first motion here that gets WORSE as it goes
  on.** Everything rhythmic before this is a loop, so rep forty is bit-for-bit
  rep one; lifting is defined by the two properties that kills. The rep is
  **asymmetric** (you lower a bar in two seconds and drive it up in one — a
  symmetric rep is what a sine gives you free, and it is the instant tell), and
  the rep **decays** (rep eight is slower, shallower and shakier, the sticking
  point deepens, and eventually there are no more reps left in the weight).
  Twelve movements: `squat`, `frontSquat`, `deadlift`, `romanianDeadlift`,
  `overheadPress`, `benchPress`, `row`, `curl`, `lateralRaise`, `lunge`,
  `kettlebellSwing`, `pullUp`.
- **The decay is Epley's formula, not a curve someone liked.** `repsInReserve`
  is `30 × (1RM / load − 1)`, the arithmetic every strength coach uses; at 75%
  of a maximum it predicts ten reps, at 85% five. Everything that decays is a
  function of how far through that budget the set has got — which means the set
  can be **lost**: twelve reps at 93% of a maximum ends at rep three, twelve at
  40% finishes all twelve. `onFailure` is the difference between a set and a
  loop with a counter on it.
- **The torso angle is solved, not authored.** A loaded bar has to stay over
  mid-foot or the lifter falls over, so `Lifting` solves the pitch that puts it
  there against the rig's real three-joint spine (four Newton steps). A front
  squat comes out at 0.60 rad and a back squat at 1.08 rad **from identical
  legs** — the load moved 9 cm forward and the torso came up to meet it — and a
  long-femured character leans further than a short-femured one. The ankles are
  IK'd onto fixed targets for the whole set, so planted feet are true by
  construction.
- **`npm run lifting` — the fifth gate.** `measureBarPath` drives a real set
  through the skinned rig and reports bar-path deviation from the plumb line,
  tempo from the load's own vertical velocity, depth and duration decay, foot
  slip, grip gap, per-frame pop and rep range. Nine budgets over twelve
  movements and six bodies. The bar-path budget is **two-sided**: the upper
  bound keeps the form inside coaching tolerance, the lower proves the fatigue
  model reached the bar at all.
- **`createLiftClip`** — one clean rep, loopable, for background crowds.
  Explicitly rep one forever, and cross-checked against the live controller by
  the gate (they agree to 3.6 mm).
- **The `gym` playground** — twelve lifters in profile with an amber bar-path
  trace behind each bar and a post at each lifter's mid-foot. Station 1 is at
  93% of a maximum and does not finish.

### Fixed

- Found by the new gate, none of them visible in a screenshot: a set that reset
  to lockout when it ended (441 mm of bar teleport on one frame); a bent-over
  row whose bar rose on the way down (an arm counter-rotation with the wrong
  sign — tempo 0.59× instead of 1.61×); a lunge whose split stance was wider
  than the legs could reach, floating both feet 70 mm off the floor; a
  single-hinge balance model 65 mm off mid-foot, then a three-segment one that
  double-counted the torso and was worse; a fade-out that stopped one frame
  early, leaving 0.011 rad of hip rotation on a body it had handed back; a
  bench press whose bar was further from the shoulder than the arm is long; and
  a shape reading its own hips height back out of the rig it was posing.

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
