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

## [0.69.0] — 2026-08-05

**The pupil is not an emotion dial. It is a light meter.** Every rig dilates
pupils for interest and shrinks them for fear. Hess & Polt (1964) and Kahneman &
Beatty (1966) did find the pupil responds to mental effort — by half a
millimetre, against the five and a half the light reflex covers across eight
decades of luminance. Eleven to one.

### And the consequence runs the other way, which is the interesting half

**You cannot read a mood off a pupil unless you hold the light constant.** That
is why every pupillometry protocol ever published fixes the luminance first, and
it is a claim this model can be held to:

```
                      effort readable   tracks the light
changing light           r=0.23            r=0.98
fixed light              r=1.00            r=0.00

4.3x more readable with the light held still.
the mood-dial control: 1.0x — it says the same thing in any light,
and tracks the luminance at r=0.15, which is to say not at all.
```

The control is a mood dial: a pupil that answers to the character and has never
heard of the scene's lighting. It gets the published result exactly backwards.

### Added

- **`Pupils`** — Moon & Spencer's (1944) `D = 4.9 − 3 tanh(0.4 log₁₀ L)`, a
  reflex latency, constriction four times faster than redilation, and the
  task-evoked response added on its own slower pathway.
- **`createEyes` draws the pupil** at `D / 12` of the iris, because an adult
  iris is twelve millimetres. A stylised face shows the same *fraction* black
  rather than the same millimetres.
- **`npm run pupils`**, and the `aloud` playground now steps the stage light
  between dusk and noon every six seconds — **driven from the luminance the
  model is given**, so the pupil is metering that scene rather than a number
  invented alongside it.

### The cross-check is the weak one, and the gate says so

De Groot & Gebhard's (1952) independent fit disagrees with Moon & Spencer by up
to **1.39 mm — a quarter of the whole range**, and that spread is the budget. But
unlike the saccade gate, where the model was given Bahill's duration law and held
to a peak-velocity law it had never seen, **this model IS Moon & Spencer**.
Comparing it to De Groot measures two 1940s curve fits against each other and not
the quality of anything here. It is kept for what it does catch — a units error,
a wrong branch, dynamics that fail to settle, an effort term big enough to drag
the settled value out of the band — and labelled for what it does not.

What is independently falsifiable: the anatomical 2–8 mm range, the logarithmic
shape (a decade at dusk moves the pupil **801×** what the same nine units move it
at noon, where a log law gives 257 and a linear one gives 1), and the
mood-readability result above.

### Fixed

- **The task response was compounding into the reflex.** The first version added
  the effort term into `diameter` and let the next frame's reflex chase from
  there, so a face thinking hard in a fixed light drifted open without limit
  until the clamp caught it. The reflex has its own state now.

### The same gate bug, for the third release running

Two of seven mutations survived the first run, and both were **the gate
computing its expectation from the constant it was testing**:

- the latency window was `PUPIL_LATENCY * 0.9`, so setting the latency to zero
  shrank the loop to nothing and it passed — a literal 150 ms now, inside
  anybody's measurement of the published 200–250;
- the iris ratio was asserted against `IRIS_MM` on both sides, so setting it to 6
  sailed straight through — the gate says twelve now.

`BLINK_OPEN / BLINK_CLOSE` in 0.66.0, `CORNER_TRAVEL` in 0.68.0, and two at once
here. It is invisible in review because the assertion reads as though it checks
something. **Mutation testing is the only thing that finds it**, which is the
argument for running mutations before writing the documentation rather than
after.

## [0.68.0] — 2026-08-05

**A smile is two muscles, and only one of them can be faked.** Duchenne de
Boulogne put electrodes on faces in the 1850s and found that zygomaticus major —
the lip corners — obeys the will, while orbicularis oculi, the ring around the
eye, *"only obeys the sweet emotions of the soul"*. It cannot be contracted on
purpose. That is why a posed smile reaches the mouth and stops there, why every
viewer can tell, and why almost nobody can say what they noticed.

### Which is a fact about an API

Every smile in every rig is one number, and a one-number smile is *always* a
posed smile — it cannot express the thing Duchenne found. So there is no
`setSmile` here. There are two verbs and no third:

```ts
face.pose(0.8);   // deliberate: AU12, and AU6 stays where it is
face.feel(0.8);   // enjoyment:  both, together
```

### Added

- **`Smile`** — `pose()` and `feel()`, with the deliberate one arriving too fast
  to be felt, lopsided, and stepped, all of which are published tells.
- **`readSmile`** — an observer scoring a recorded expression against four
  markers from four laboratories. It never asks the controller what it intended.
- **`createSmile(rig)`** — lip corners that travel up AND out, and cheek pads
  that only exist for AU6.
- **`createEyes` gains `cheek`** — AU6 narrows the eye **from below**, where a
  blink comes down from above. Two muscles, two edges, one gap: the aperture is
  their product, so a blink during a smile still shuts the eye completely and a
  full cheek raise never does.
- **`npm run smile`**, and the `aloud` playground alternates felt and posed
  smiles line by line. The mouth does the same thing both times.

### The control is the release

```
                  AU6      window   symmetric  smooth   score
a felt smile     felt     felt     felt       felt     4/4
a posed smile    posed    felt     posed      posed    1/4

separation 3
the one-number control: felt 4/4, posed 4/4, separation 0
```

The claim is not that the model can produce a Duchenne smile — any model can, by
setting two numbers. It is that the DIFFERENCE survives being looked at. A
one-number smile scores identically whatever it is asked for, because it has no
difference to express.

Each marker is asserted separately, not just the total: scoring only the sum lets
a model drop one tell and pass on the other three, which is how a gate quietly
stops testing what it says it tests.

### Two bugs, and both were in the claim rather than the model

- **TypeScript's `private` is a compile-time courtesy.** The first version had a
  `private begin(intensity, felt)`. The source read exactly as if the claim held,
  and any JavaScript caller could have written `smile.begin(0.9, true)` for a
  perfect posed Duchenne smile. It is `#begin` now, and the gate enumerates the
  prototype at run time rather than reading the source text. Found by the unit
  test that listed the class's own methods.
- **The corner-travel check was circular.** It asserted the measured rise
  against `CORNER_TRAVEL × intensity` — the number that produced it — so it held
  for every value it was given. Setting the constant to 16 mm sailed through, and
  it was the only one of seven mutations that survived. The face supplies real
  bounds instead: under about 5 mm the smile is invisible, over about 19 mm the
  corner reaches the nose base and becomes a snarl. **That bracket is wide, and
  `CORNER_TRAVEL` is now labelled as the one judgement in the module the gate
  cannot really pin** — rather than dressed up as a measurement.

### And four in the scene, three of them about the tape

The observer is only as good as the trace it is handed, and handing it one
turned out to be where all the difficulty was.

- **`relax()` was called every frame.** It restarts the release from wherever
  the face currently is, so calling it per-frame pins the smile in place for
  ever: the cheek raised by the first FELT line was still up during every posed
  line after it — the exact thing this release says cannot happen.
- **A smile is not as long as a sentence.** The scene held it for the whole
  four-second line and failed its own observer, because Ekman & Friesen put a
  felt expression between half a second and four. The expression runs on its own
  clock now, which is what an expression does.
- **Resampling by repetition manufactures the artefact.** Pushing the current
  value onto a fixed 1/60 grid means every value lands twice at 30 fps; the
  trace becomes a staircase and its second difference flips sign at every tread,
  which is precisely the stepped onset the observer looks for. It scored the felt
  smile 3/4 and blamed the model.
- **...and one sample per frame is evenly spaced only on paper.** A headless
  frame jitters about 30%, which is the same size as the curvature being
  measured across an 18-sample onset. Ticks land on a fixed grid with
  interpolated values now — uniform by construction rather than by assumption.

**And the probe printed a failing number and passed anyway.** `cheek during a
POSE 0.8500 (must be 0)` was in the output while the run said PASS, because the
edit that added the assertions silently did not match. A gate that prints a value
and does not check it is a decoration. Six assertions cover that readout now.

### And a third time on the same rake

A playground debug field reached for a `const` declared inside the update body —
`grinned` this time, `speaking` in 0.66.0, `look` in 0.67.0. **The probe caught
it and said so out loud**, which is the fix 0.67.0 shipped for exactly this, and
the whole diagnosis took one run instead of four. The rule is now written where
the fields are: a debug hook reads controller state, never an update-body local,
because `grin.shape` is the same numbers and is always in scope.

## [0.67.0] — 2026-08-05

**The eye does not glide, and how fast it goes is not a choice.** Bahill, Clark
& Stark (1975) named the main sequence after the stellar diagram, because
saccades sit on a line rather than in a cloud: amplitude alone predicts both the
duration and the peak velocity of a movement. **Two laws for one movement is one
law more than is needed to build it**, which is the entire reason this release
can be checked — the model was given the duration, and the peak velocity is a
prediction.

### Added

- **`Saccades`** — ballistic eye movements with main-sequence kinematics, a
  scanpath that comes out of the task, microsaccades, and a hand-over to the
  head past the orbital range.
- **The velocity profile is a half-sine, and nothing chose it.** Divide the
  published peak by the mean the published duration implies and a pure number
  falls out — about 1.6 — and that number IS the profile. A half-sine is 1.571.
  The smoothstep in every easing library is 2.0 and overshoots by a third.
- **`createEyes` now moves the iris**, by `R sin θ` off a twelve-millimetre
  globe. A character drawn with bigger eyes gets the same swing across a wider
  white, not a bigger one — which is the assertion that catches "travel is a
  fraction of the eye's width".
- **`SCAN`** — Rayner's (1998, 2009) fixation times and amplitudes for reading,
  visual search and scene viewing. Yarbus (1967) again: the scanpath is a
  property of the question, not of the picture.
- **`headDemand`** — what the eye could not reach, in degrees, for `LookAt` to
  finish. Clamping silently leaves an agent staring past what it was told to
  look at.
- **`npm run saccades`**, and the `aloud` playground scene now speaks, moves a
  mouth, punctuates with brows, blinks AND scans — four papers, none of which
  have heard of each other.

### The gate holds the model to a law it never saw

```
amplitude   measured    Bahill    error
     2°      124°/s     124°/s    -0.5%
    10°      365°/s     380°/s    -3.9%
    20°      483°/s     471°/s     2.5%

worst 4.4% against a floor of 4.6%
```

- **The budget is the best any fixed shape could do**, computed from the two
  published laws alone with nothing of the model in it. The peak-to-mean ratio
  drifts from 1.63 at 5° to 1.53 at 20° because real large saccades are skewed,
  so no fixed profile can sit on the curve everywhere; 4.6% is that floor. The
  shipped shape scores 4.4% — as close as its own form permits, without fitting.
- **The controls lose by a lot**: a parabola 8.7%, smoothstep 30.6%, constant
  speed 39.2%.
- **The gate greps the source** to prove the model never references
  `PEAK_VELOCITY_MAX` or `VELOCITY_CONSTANT`. An argument that rests on the
  model not having seen something should not rest on my having remembered.
- Every velocity is **differenced off the angle trace** the controller produces,
  frame by frame. A closed form checked against itself is not checked.
- All seven mutations fail on the assertion meant to catch them: smoothstep,
  per-axis diagonal amplitude, mid-flight steering, microsaccades counted as
  fixations, iris travel as a fraction of eye width, a head that is never told,
  and a model that peeks at the peak-velocity law.

### Fixed

- **A microsaccade is not a fixation.** It happens DURING one, so it must not
  restart the dwell or get counted — otherwise a face fixates for 330 ms as
  published, twitches at 200 ms, and starts a fresh 330 ms, which turns Rayner's
  table into something else. It read 4.60 saccades a second against a published
  3.99 before the fix.
- **A diagonal saccade's amplitude is the hypotenuse.** Feeding the law one axis
  at a time makes a 45° movement travel 1.41× as far in the time its horizontal
  component was allotted, which is faster than an eye can go.

### And two the arithmetic could not find

- **The one-layer iris was correct and looked terrible.** `createHumanoid` bakes
  both the white and the iris into the mesh, so a moving iris has to cover the
  baked one across its whole travel while never leaving the white. Those two
  conditions have exactly one solution — `half = (baked + white) / 2` — it fits,
  it never clips, and the algebra is pretty. It also makes the iris 73% of the
  width of the eye and gives every character in the library a black-eyed
  thousand-yard stare. The overlay redraws the whole eye now, white and all, in
  three 1 mm layers half a millimetre apart — which also brings the assembly
  back BEHIND the nose tip instead of 8 mm proud of it. A screenshot took four
  seconds to disprove what the algebra had made look inevitable.
- **A swallowed error reads as a dead feature.** The headless probe caught and
  discarded whatever the scene threw, so a `ReferenceError` in the debug readout
  — a `const` inside the update body the hook could not see, the same scope slip
  as 0.66.0's — printed as zero blinks, zero saccades and a dead jaw, on a scene
  that was working. The probe reports what the scene throws now.

## [0.66.0] — 2026-08-05

**The blink rate is not a constant. It is what the agent is doing.** Bentivoglio
et al. (1997) counted spontaneous blinks in ninety adults: 17 a minute at rest,
**4.5 reading**, **26 in conversation**. Reading suppresses it to a quarter and
talking nearly doubles it — a factor of six on nothing but the task. So a face
here does not get a blink parameter; it says what it is doing, and the rate
falls out of a table nobody chose.

### Added

- **`Blinking` and `createEyes(rig)`** — lids parented to the Head, a rate off
  the task table, and a blink whose down phase is half the length of its up
  phase because the lid falls with gravity behind it and is lifted against it.
  An even split is the gate's control, and it loses.
- **`LID_SPEED`, `BLINK_OPEN`, `BLINK_SECONDS`** — all derived. The aperture is
  10 mm and the close is 90 ms, so the lid moves at 0.111 m/s; change either
  published number and the rest move with it.
- **The lid rides the eye.** Levator palpebrae and superior rectus share an
  origin, so a downward gaze hoods the lid and an upward one widens it, and the
  blink then takes it the rest of the way down rather than adding to it.
- **`npm run blink`** — twelve seeds, thirty simulated minutes each, every rate
  inside `4 × se + 0.05` of Bentivoglio, and everything below the rate table
  measured off the **rig's own aperture in metres** rather than off the number
  the model just produced.
- The `aloud` playground scene now speaks, moves a mouth, punctuates with brows
  AND blinks, switching between `conversing` and `rest` as the line starts and
  ends. Nothing in the scene translates that into a rate.

### Fixed

- **The blink's duration comes OUT of the gap, not on top of it.** Bentivoglio
  counted complete blinks per minute, so the CYCLE has to average `60 / rate`.
  Drawing an exponential about the full mean and then spending 270 ms blinking
  put every rate 15–20% low — 20.7 a minute against a published 26 — which in a
  random process looks like noise and is arithmetic.
- **`GAZE_LID` was applied twice**, so the lid moved a ninth of what the constant
  says: 11% of the aperture across the whole gaze range instead of 33%. Caught
  by asserting the model does what its own number says.
- **A change of task re-draws the wait.** Without it a face that stops reading
  and starts talking keeps counting down the four-a-minute interval it was
  already on, and the rate catches up a blink late.
- **The lids rendered behind the eyes.** At `0.0575 H` they sat level with the
  baked whites, which is 0.6 mm behind the irises — `createHumanoid` sets those
  proudest of all. Every number in the headless probe was right and the eye
  stayed wide open through a blink the readout said had closed to 0.954. Only a
  screenshot finds that.

### Two of the four gate bugs were the gate

- It **hung**: the asymmetry check waited for `lid > 0.05` to call the eye shut,
  and at a downward gaze the RESTING lid is 0.111, so the condition was
  permanently true. It watches maximum aperture over a window now.
- The **speed check was wrong, not the model** — it read 0.093 against a derived
  0.111 because a blink is a fixed duration, so the lid's speed depends on where
  it started. Measured at full upward gaze now, the only place the travel is the
  whole aperture.
- The symmetry control compared against `BLINK_OPEN / BLINK_CLOSE`, **which moves
  with the mutation it is controlling for**. It is a literal `2` now.
- And a 16.3-versus-16.4 pair looked like a 4% systematic bias until
  twenty-four seeds returned 16.88. The standard error on one seed is 3%.

## [0.65.0] — 2026-08-04

**A brow raise is punctuation before it is emotion.** Ekman's *About Brows*
(1979): it marks the emphasised word, it goes up on a question, and it fires on
greeting whether or not anyone is pleased about anything. Cavé et al. (1996) put
about seven in ten of them on a rise in F0. So the brow does not need a mood — it
needs a pitch contour, and GAMA 0.53.0's `SpokenLine.pitchAt` has exactly the
signature `PitchSource` asks for.

### Added

- **`Brows` and `createBrows(rig)`** — a pair parented to the Head, driven by
  pitch above a running baseline, rate-limited by a speed nobody chose.
- **`flash()`** — Eibl-Eibesfeldt's (1972) cross-cultural greeting flash, a
  sixth of a second, which is also where the speed limit comes from: a flash is
  up and back, so up is half of it, and 10 mm in 83 ms is 0.12 m/s.
- **`npm run brows`**, and the `aloud` playground scene now drives a mouth AND a
  pair of brows off one line, from two functions, with no import between the
  packages that produce them.

### Fixed

- **A symmetric baseline is the wrong model.** 't Hart, Collier & Cohen draw the
  declination line through the VALLEYS — accents ride on it and do not define it
  — so a baseline that could also rise gets pulled up by the accent train, and
  each accent is measured against a floor its own predecessors raised. The last
  accent of a six-second line held 92% of the first when it should hold all of
  it, and the gate showed it was not the muscle: the TARGET held 92% before the
  speed limit ever saw it. The line only falls now. 94% held, against 64% for the
  same model with no baseline at all.

### Known — three of the four failures were the gate, not the model

- **The shuffled control was correlated against its own input**, so it scored
  0.897 against the subject's 0.869: faithfully following the wrong contour and
  being praised for it. Both are scored against the true contour now, and it
  drops to −0.12.
- **The no-baseline control sat clamped at 1.0.** The test contour started four
  semitones up, so a naive `pitch / accent` model saturated end to end and held
  100% for free — which made deleting the baseline entirely PASS. The contour now
  sits where `pronounce` puts one, declining through the speaker's own f0.
- **The budget was a round number.** It asserted 0.95, measured 0.94, and said
  nothing about whether 0.94 was right. It is now the lag of a first-order filter
  on a ramp — `rate × tau`, 8% of an accent — so more than that is a bug and less
  would mean the tracker is doing something unaccounted for.

## [0.64.0] — 2026-08-04

**A face driven by a voice that has not decided yet.** GAMA moved its dialogue
onto the platform's `SpeechSynthesis`, which reports word boundaries as it
reaches them and starts whenever it starts. `follow()` bakes a timeline at the
moment it is called and cannot serve that.

### Added

- **`Speech.attach(source, options)`** — a `MouthSource` is
  `(seconds) => MouthShape | null`, re-read every frame. GAMA's
  `SpokenLine.mouthAt` has that signature; neither package imports the other,
  and what makes them agree is still that **F1 is mouth opening**.
- **`options.clock`** — the AUTHORITATIVE clock. A face counting its own frames
  is ahead by the platform's start latency for the rest of the utterance.
- **`options.done`**, `Speech.live`, `Speech.detach()`, and `LIVE_WINDOW`.
- **A playground example, `aloud`** — the first scene in the trilogy where an
  ANIMA face and a real browser voice are one event, with the word ticks
  lighting up as the engine reports them.

### Fixed

- **A live source was handed to the jaw as a square wave.** `mouthAt` overlaps
  each segment's raised-cosine dominance so the target is already smooth; a
  point-sampled source has no segments, and the first version of `attach` passed
  the raw step straight to the rate limiter — which is a jaw with mass, not a
  filter. It scored **0.55** against the baked path's 0.83 on a source it was
  tracking perfectly. `attach` now samples across `LIVE_WINDOW`, which is the
  median published phoneme duration times `DOMINANCE` — a number that moves when
  `PHONEMES` does, rather than one anybody chose.
- **A live source is clamped at the seam.** A baked track is checked once when
  it is handed over; a live source is a function someone else wrote, called
  sixty times a second, and one `NaN` reaches a bone position and stays there.

### Known — three ways the gate was wrong first

- **The simulator moved the whole timeline instead of pinning the past.** A
  re-anchor stretches what has not been said and leaves what has alone;
  `anchorTrack` is monotonic and passes through the boundaries already observed.
  Scaling everything jumped the mouth backwards at the revision, and the live
  path scored 0.553 for faithfully following a source that had contradicted
  itself. A simulator that asks for something impossible is not a hard test.
- **The external clock carried no information.** It advanced in lockstep with
  the frame clock, so deleting `options.clock` scored 0.821 against the correct
  code's 0.790 — BETTER. A parameter a mutation can improve on is not being
  tested. The simulated platform now starts 350 ms late, and that mutation
  scores −0.447.
- **The nonsense-source case found the missing clamp**, which is the only reason
  it is in the gate rather than the changelog of a later release.

## [0.63.0] — 2026-08-04

### Added

- **`Speech.follow()` — a face driven from outside, and the far half of a
  handshake.** `Segment` gained an optional `shape`, and `shapedUtterance` lays
  out a track of `{ open, round, close, spread }` with durations decided
  elsewhere. Everything downstream treats a supplied shape identically to one
  this package looked up: the same dominance blend, the same seal maximum, the
  same jaw speed limit, the same lip bridge.
- **`npm run lipsync` — the gate, and it imports nothing from the other side.**
  A spoken line is written out as mouth geometry in the bench file itself,
  because a gate that fetched the shapes would be testing the import. The jaw
  gap is then measured **in metres off the rig** — not off the shape the
  controller reports, because a controller that returns a beautiful shape and a
  prop that ignores it look identical from the controller's side.

```
aligned:                 r = 0.834   over 259 frames at 120 Hz
the track 100 ms early:  r = 0.029   ← the control
fastest the jaw moved:   0.200 m/s   against a published 0.200
a 227 ms opening reaches 54% of itself
a  49 ms opening reaches 12%   ← Lindblom's undershoot, still free
```

- **The seam is a fact, not a type.** A synthesizer that knows about vocal
  tracts knows what shape a mouth is in — it has to, because **F1 is mouth
  opening** — but its phoneme alphabet is not this one and never will be. So
  nothing is shared except the shape. GAMA measures **r = 0.832** between the
  same `open` and the first formant of the audio it renders; this measures
  **0.834** against the jaw. Compose them and the mouth and the sound are one
  event, with neither package having heard of the other.

### Fixed

- **The gate's control beat the thing it was controlling for.** `mouthAt`
  deliberately leads the sound by `ANTICIPATION` — a real mouth reaches its
  shape before the sound arrives — and the first version of this gate compared
  against a track shifted by exactly 100 ms, which CANCELLED the anticipation.
  The control scored **0.834** against the aligned case's **0.353**. A control
  that beats its subject is not a weak control; it is a sign the alignment is
  wrong.
- **The jaw speed check was measuring the lips.** The visible aperture is the
  gap between the two lips, and the lips are deliberately not rate-limited — a
  bilabial that had to wait for the jaw would stop being one. Measuring it
  reported 1.19 m/s against a jaw limit of 0.20.
- **And then it was measuring frame zero.** Seeding the previous gap at zero
  made the first step look like the jaw crossed the whole rest posture in one
  frame: 0.452 m/s, an artefact, with the limiter never violated.

## [0.62.0] — 2026-08-03

### Added

- **`MotionMatcher` — a controller that is a search, and the weights turn out to
  be units.** Motion matching holds a database of poses, builds a query every
  frame out of what the character is doing and what it was asked for, and plays
  the nearest frame. Every published implementation carries a table of
  hand-tuned weights beside its cost function, because that function adds foot
  positions in metres to foot velocities in metres per second to trajectory
  points in metres, and a sum of those is not a quantity at all. The weights are
  what makes it finite, which means each one is silently carrying a UNIT
  CONVERSION — and a conversion is fixed by dimensional analysis: a velocity
  becomes a length when multiplied by a time, an angle when multiplied by a
  radius. The table collapses, every term is in square metres, and every weight
  is 1.
- **The check a weighted cost cannot pass.** Writing the velocities in a
  different unit — the same velocities, a different name — must not change which
  frame is nearest. Run on the real database against the two frames that
  genuinely disagree, a hand-weighted cost picks differently in m/min than in
  m/s. The gate asserts the control FAILS, because a check whose control passes
  is proving nothing.
- **Constants measured rather than chosen.** `τ_foot = σ(position) / σ(foot
  velocity) = 0.1595 s`, a length over a length per second, so it is identical
  on a 1.4 m body and a 2.1 m one to nine decimal places while every other
  feature scales with them. The trajectory needs no conversion — `speed × time`
  is already a distance — and its horizons are thirds of a step, because a step
  is the interval over which a walker can act on an instruction. One conversion
  per quantity, not one shared between two different velocities.
- **`buildMotionDatabase`, `matchFrame`, `queryFeature`, `froudeNumber`** and
  the twenty-first gate, `npm run motion`, plus the playground example
  `matching`: the same command given to a matcher and to a blend tree, each
  travelling at the speed its own feet are actually doing.

### Fixed

- One shared time constant for foot velocity and travel speed left the travel
  term too quiet to overcome pose continuity: the character stood in idle
  through every command, at a mean speed error of 1.27 m/s.
- The search was built from the pose left over at the end of the previous frame
  while the clock had moved on, so it described where the character HAD BEEN.
  85 of 85 threshold-crossing searches came back backwards, by a median of 0.018
  of a cycle — 1/60 s at a one-second cycle, exactly the frame it was stale by.
  A 29% pop rate that no amount of blending would have fixed.
- Two attempts at hiding a jump each made a second seam, both caught by a
  joint-speed budget derived from the clips' own peak rate: a per-bone
  quaternion offset (2.17 rad of forearm in one frame) and a live cross-fade
  between two frames, which has no honest source when a second jump lands
  mid-fade (1.48 rad). Refusing the second jump closed the hole and cost the
  responsiveness the search exists for — 0.13 s became 0.33 and lost to the
  blend tree outright. What shipped freezes the pixels instead.
- The query was reading its own smoothing, which put the controller in a loop
  with itself: 15 pops a second, 76% of every search, and it never once answered
  a command.
- The pop rate depended on the frame rate. What counts as a jump was a fixed
  fraction of a cycle, but one frame advances the phase by `dt × rate /
  duration`, so the same controller reported 1% at 60 Hz and 39% in a headless
  browser at 20.

### Reported, not yet gated

- ANIMA's step time is a flat 0.50 s at every body size, so the Froude number
  `v²/gL` spreads by 46% across the height range instead of being constant.
  Alexander (1976) says geometrically similar walkers move alike at equal Froude
  number; cadence should go as `√(L/g)` and does not. It matters here because a
  motion database is built per body.

## [0.61.0] — 2026-08-03

### Added

- **`Speech` — visemes, and the observation that the table already exists.**
  Every lipsync system starts by inventing a list of mouth shapes and a mapping
  from sounds onto them. That list has been published since 1888: it is the IPA
  vowel chart, and its two axes are exactly the two things a mouth visibly does
  — vowel HEIGHT is how far the jaw is down, and ROUNDEDNESS is what the lips
  are doing. `mouthOf` is two lookups and a subtraction, and there is no viseme
  table in the file because the IPA is one. 31 phonemes collapse onto 9 visemes,
  3.4 to one, which is why lipsync is tractable and lip-reading is hard.
- **The one that matters: a bilabial closes the lips.** `/p/`, `/b/` and `/m/`
  are three sounds and one picture. Coarticulation blends everything else —
  Cohen and Massaro's dominance functions, and the visible shape LEADS the sound
  by a measured tenth of a second — but closure is taken as a MAXIMUM over the
  neighbours and never an average, because a seal is a contact: the lips are
  shut or they are not, and averaging shut with open does not give half-shut, it
  gives wrong. "mama", "papa" and "baba" reach 100%; "halo" 5% and "sisi" 15%.
- **`JAW_SPEED`, `JAW_TRAVEL`, `LIP_BRIDGE`** — three published lengths and
  speeds, and everything awkward falls out of them. A jaw peaks at 200 mm/s and
  the raw blend swings it at over a metre a second, so the blend is the target
  and the controller rate-limits the face; the difference is UNDERSHOOT, which
  Lindblom measured in 1963 and which nobody here wrote down. The lips are not
  limited — they are light and shut in 50 ms — but they are only 24 mm long, so
  the seal is capped at `LIP_BRIDGE / (open × JAW_TRAVEL)` and COMPLETES WHEN
  THE JAW ARRIVES. That predicts, unprompted, that fast speech loses its
  closures.
- **`createMouth(rig)`** — a moving mouth as an overlay parented to the Head,
  because the face `createHumanoid` builds is baked into the skinned mesh: no
  jaw bone, no morph target.
- **The twentieth gate, `npm run speech`,** and the playground example
  `talking`: two heads, one saying "mama papa mama" and one saying "halo sisi
  halo", with the seal and the jaw drawn as bars under them.

### Fixed

- The mouth snapped shut at the end of every line — 49% of the jaw's range in
  one 120 Hz frame, because the dominance accumulator emptied the instant no
  segment was in reach, which the anticipatory lead guarantees. The blend is now
  seeded with `REST` at a standing weight: a mouth returns to rest, it does not
  fall to it.
- The jaw was FOLLOWING the lips. `open` was gated by `(1 − seal)`, so every
  `/m/` slammed the blended opening to zero over 50 ms — 1099 mm/s against a
  jaw's 200. You can hum with your mouth open; that is what a nasal is.
- The gate's own budget encoded that same bug. "A sealed mouth is not also an
  open one" was written at 15%, which is the jaw-follows-lips assumption stated
  as a number. It is now `LIP_BRIDGE / JAW_TRAVEL` — a division of two
  anatomical lengths.
- A "100% sealed" mouth was drawn 23 mm apart, found by a screenshot rather than
  a number: every value in the report was right and the picture was a bilabial
  whose lips did not meet. The prop now has the lips travel toward each other,
  up to their own span and no further.
- The controller sealed across 25 mm of gap with 24 mm of lip, caught by the
  derived budget the moment it stopped being a chosen one.

## [0.60.0] — 2026-08-03

### Added

- **`Fencing` — the armed bout, and it does not stand still.** `Sparring` put
  two fighters at a fixed gap and let them trade; that is a measurement rig, and
  an armed bout cannot be one, because the interesting half of a fight with a
  sword in it is the FOOTWORK.
- **`npm run fencing`, the nineteenth gate**, whose first assertion is that the
  fencers MOVED.
- `fence` playground example: two fencers who close, break, circle, lunge and
  recover, with the blade sweeping because the ARM sweeps — `poseSwordArm` puts
  the hand on a real arc and `solveLimb` solves the elbow. No clip anywhere.

### Tempo, from the blade's own inertia

    τ = F · span        the couple two hands make on the hilt   (Bind)
    t = √(2θ·I / τ)     the time to sweep θ                     (Blade)

Nothing in the weapon table says "speed". It says how thick the blade is.

A longsword is **2.0×** an arming sword to turn and has **2.1×** the couple on
it, so the two nearly cancel — which is the entire reason a hand-and-a-half grip
is worth the extra steel, and it falls out of dividing `Blade` by `Bind`.

### Measure, the band, and a leg as a pendulum

`measure = strikeReach + bladeExtension`. Two fencers have different ones, and
between them is a band where one can reach and the other cannot — a subtraction
of a bone length and a blade length. A spear beats an arming sword **10-0**.

Footwork is `t_step = π√(L/g)`, the classic walking-cadence derivation, over the
stance's own fore-aft stagger. A taller fencer steps slower AND further.

### Bugs this found, all four visible only in motion

- **A standoff.** The first opening test was "attack when they are busy", and
  two fencers who are both waiting are never busy: ONE attack in thirty seconds.
- **The blade line came off a bone axis.** `Fencer.line()` read the direction
  from the hand socket's local +Y — an axis of the skeleton that points nowhere
  in particular — so every crossing handed to `Bind` was arbitrary and a
  thirty-second bout resolved ZERO parries.
- **A parry made from the hip never reaches.** With the hand left where it
  stands, the crossing falls centimetres PAST the attacker's point, `onBoth`
  comes back false, and `Bind` is never consulted: seven parries attempted, zero
  resolved.
- **Two swordsmen chest to chest.** The lunge had nothing stopping it, so a long
  bout ended with the fencers inside each other and the two measure rings
  concentric. Only the screenshot showed it.

## [0.59.0] — 2026-08-03

### Added

- **`npm run armour`, the eighteenth gate — and the second that imports two
  libraries.** It crosses ANIMA's bows, strikes and contact geometry with SCENA
  0.109.0's armour plate, and neither package imports the other.

### The handshake that finishes, and why this one could

`npm run tameshiwari` could not finish. Settling whether a strike breaks a board
needed one number neither library had — **how compliant a fist is** — and that
was never invented.

A plate is a different mechanism. It fails when a hole has been opened all the
way through it, and the work that takes is the metal's indentation pressure over
**the point's own frontal area**, through the thickness. So the comparison needs
a **contact diameter**, not a compliance — and a contact diameter is a ruler
measurement that `Cut` has had since 0.56.0, because `tipArea` is πr².

### What the finished half settles

The energy required goes as the SQUARE of the contact diameter:

    bodkin        9 mm       76 J
    spear point  20 mm      377 J
    sword tip    30 mm      848 J
    fist         60 mm     3393 J
    foot        100 mm     9425 J

    compound arrow     75 J behind   9 mm    99% of what it needs
    roundhouse kick   800 J behind 100 mm     8% of what it needs

**The kick carries eleven times the arrow's energy and is twelve times further
from getting through.** Comparing joules to joules would have said the opposite,
and that is exactly the mistake tameshiwari was left unable to rule out.

Nothing in the library defeats 2 mm of steel plate, which is the historical
answer.

### And the half that still does not

    one riveted ring     3.05 J
    20 layers of linen   2.2 J
    together             5.2 J     against a measured 120 J

The first draft of this gate asserted that the padding is what stops the arrow —
the standard explanation — and the derivation came back at 2.2 J and **the
assertion failed**. It was the assertion that was wrong: what stops an arrow in
a gambeson is not the textile being CUT, it is the textile stretching, dragging
on the shaft and spreading the load. None of those is a fracture toughness.

So the gate finishes one half and NAMES the missing number in the other, and it
is not the number tameshiwari lacked.

### Bugs this found

- **The first four mutation tests all passed, and none of them should have.**
  ANIMA resolves `scena3d` from `node_modules`, so mutating SCENA's source
  changed nothing the gate could see. Dropping Tabor's factor entirely, putting
  the force on the perimeter instead of the frontal area, taking the energy over
  a fixed stroke, and making a mail ring a hundred times stronger all "passed".
  A cross-repository mutation test has to mutate **the artefact that is actually
  imported**; with the built dist copied into place, all four die.

Mutation-tested four ways against the resolved build.

## [0.58.0] — 2026-08-03

### Added

- **`Javelin` — the object whose rules were changed to make it fly worse.** On
  1 April 1986 the IAAF moved the men's javelin's centre of mass **four
  centimetres forward**, to take about ten percent off distances that had
  reached Uwe Hohn's 104.80 m — still the only throw past a hundred metres
  there has ever been. This is the only module in the library checked against a
  committee's stated intention rather than a measurement.
- **`npm run javelin`, the seventeenth gate.**
- **`shiftBalance(spec, metres)` on `Blade`** — moves the balance point by an
  exact distance WITHOUT changing the mass, by taking metal off the heaviest
  segment on one side and putting it on the heaviest on the other. Closed form,
  because a first moment is linear in the mass you move.

### The experiment, with one variable

The real rule change was not one variable — manufacturers rebuilt the whole
object. `shiftBalance` makes it one: the weight, the external shape, the
enclosed volume, the planform, the wetted area and every drag term come back
bit-identical, and the only difference in the universe is where the mass sits.

### What comes out of the geometry

    speed  angle  attack |    new      old    cost | vacuum   surplus  | landing attitude
    30 m/s   32°     0°  |   87.4    89.0   1.8% |  85.2     4.4%  |  51.4° vs 48.7°
    30 m/s   36°     0°  |   90.1    91.4   1.5% |  89.7     2.0%  |  58.0° vs 57.0°
    32 m/s   40°     0°  |  102.5   103.6   1.0% | 104.9    -1.2%  |  62.4° vs 64.0°

- **All 27 releases**: the pre-1986 javelin flies further.
- **All 27**: it holds a larger angle of attack — being less stable, it
  under-follows the descending flight path and keeps making lift.
- **All 18 at 32-36°**: it lands FLATTER, which is the thing the rule was
  written to stop.

Nothing was told which way the rule went, or that there was a rule. The static
margin moved by `0.04 / 2.6` and everything else followed.

At 40° the landing-attitude ordering reverses in all nine cases, and that is
asserted too: up there the surplus over a cannonball has gone negative, both
javelins are simply falling, and claiming "all twenty-seven" would have been
claiming something false.

### What does not

The cost comes out at **1.3%**. The rule was worth about **10%**.

The reason is legible in the same table: this flight beats a cannonball by
1-5%, where real throws beat one by 10-17%. The model's total lift is about a
quarter of the real thing, because Allen-Perkins crossflow under-predicts a
javelin and the published aerodynamics uses wind-tunnel coefficient tables this
library does not have. They have not been invented for the occasion: the 1986
change is the external check, and fitting a lift coefficient until it
reproduced ten percent would delete the only falsifiable thing in the file.

The gate budgets the shortfall from BOTH sides — the cost must exceed 0.3% and
must stay under 4%. If it ever reaches ten, either somebody found a measured
lift curve or somebody fitted one.

### Bugs this found

- **THE PITCHING MOMENT SIGN WAS INVERTED**, and it did not look like a crash.
  `M = N·(x_cp − x_cm)`; I wrote `−N·(…)`, which is divergent instead of
  restoring. The javelin tumbled through 180° of angle of attack, wound its
  pitch past 464°, and landed at 44 m — half what a cannonball manages — and
  `flyJavelin` returned a perfectly well-formed report about it. The gate now
  asserts three things a divergent moment cannot satisfy: peak angle of attack
  under 45°, range beating the vacuum trajectory, and arriving point-first.
- **A RECOMPUTED VALUE HID A MUTANT, FOR THE SECOND RELEASE RUNNING.** The
  report computed its release drag with its own copy of the drag formula rather
  than the one the integrator used, so swapping wetted-area skin friction for
  bluff-body drag on the frontal area changed the flight and not the report.
  Same mistake as `bind`'s winding check one release ago. It is now a closure
  with one definition, used by both.
- **A BLIND FIRST-OCCURRENCE EDIT BROKE TWO OTHER EXAMPLES.** Removing the fog
  from the new playground scene matched the first `applyFog` in a 6000-line
  file rather than the intended one, which stripped `mood`'s import and
  `archery`'s call. Both threw `ReferenceError` at runtime and both were caught
  by `npm run verify:playgrounds`, which is the entire reason that check
  listens for page errors on every frame.

Mutation-tested seven ways: invert the pitching moment, flip the static-margin
convention, drop the Munk moment, make crossflow linear in α instead of
quadratic, make `shiftBalance` add mass instead of moving it, inflate the
enclosed volume, compute drag on the frontal area. All seven die.

### Also

- `thrown` playground example: two javelins released identically, 35 g of mass
  moved between segments, and a pale dotted cannonball trajectory for scale.
  The blue one noses over and arrives point-first; the amber one sails and
  lands flat.
- `aeroOf`, `staticMargin`, `flyJavelin`, `ballisticRange`, and an `AeroBody`
  that is structural — so an object that could not be built can still be asked
  whether it would be stable.

## [0.57.0] — 2026-08-03

### Added

- **`Bind` — two blades in contact stop being two objects.** They become one
  linkage with a hand at each end and a sliding joint in the middle that
  neither fencer put there. The joint is where two lines cross, and that is all
  it is.
- **`npm run bind`, the sixteenth gate.**

### The lever, which is the oldest idea in the art

The distance from your hand to the crossing is your lever arm. The force you
can put on the contact is `τ/a`. Contact near your own hilt is a short lever
and an enormous force; contact out near your point is a long lever and almost
none. That is the *strong* and the *weak* of the blade, and it is `τ = F·r`
rearranged — nothing here has been told about forte or foible.

The same weapon on both sides, crossing at 20% of one blade and 80% of the
other, wins by exactly **4.00×**.

### The finding: two mechanisms, pointing opposite ways

**Friction says a shallow crossing STICKS.** Press across another blade and the
force splits normal and tangential in the ratio `tan θ`, so below `atan(µ)` the
tangential part cannot overcome friction. Steel on steel, µ = 0.2: **11.31°**,
a published coefficient run through an arctangent.

**Geometry says a shallow crossing is UNSTABLE.** Rotate your blade by `dα` and
the contact runs along theirs by `a·dα/sin θ` — the conditioning of a line
intersection, which diverges as the lines approach parallel.

    crossing   grips?     contact runs, per degree (0.5 m lever)
       2.00°   grips        250.1 mm
       5.00°   grips        100.1 mm
      11.31°   slips         44.5 mm
      30.00°   slips         17.5 mm
      90.00°   slips          8.7 mm

The steepest crossing that still grips is **5.10×** as twitchy as a
perpendicular one, which is `1/sin(atan µ)` — two constants that were never
introduced to each other. Sweeping every degree from 1 to 89 there is no angle
that does both, and the gate asserts it degree by degree.

### Winding is what an intersection does

    turn      A's lever    B's lever    ratio
     -8°         635 mm       475 mm    1.59
      0°         577 mm       577 mm    2.13
      8°         539 mm       664 mm    2.62

Turn one way and the contact walks back toward your hilt and out along theirs,
monotonically, and your advantage grows. Turn the other way and it reverses.
There is no technique in the code — that is a line being moved.

### The one chosen number, and the check that it does not matter

`HAND_FORCE` is the only value in the module somebody picked. Every claim is a
ratio or an angle, so it divides out. The gate runs every comparison at that
force and again at **ten times** it: the geometry comes back BIT-IDENTICAL, the
force ratio within four ulps, and the contact force — the one thing that should
move — scales by ten.

Two hands on a longsword hilt sit **170 mm** apart, not 250: hand *centres* are
inset by half a palm each. That subtraction makes the two-handed couple
**2.13×** the arming sword's one-handed one, which is the whole mechanical case
for a long grip.

### Bugs this found

- **The gate's winding check was a formula checked against itself.** It
  recomputed `bindSensitivity` locally instead of reading the report's own
  field, so a mutant that dropped the crossing angle from `measureBind`
  entirely walked straight through. It was the only one of eleven that
  survived. Now it reads `report.sensitivity`, and it dies.
- **The first "forte beats foible" test was a division by nearly zero.** The
  geometry put B's hand exactly on the crossing, reported a 335867× win, and
  looked like a spectacular result. Rebuilt backwards from where the contact
  has to be: 20% along one blade, 80% along the other, 4.00×.
- **The example's blades never actually crossed.** With the hands at arm's
  length the contact ran 11 metres down a 1.1 metre sword for the whole sweep,
  so `onBoth` was false throughout and neither the grip nor the slip state ever
  occurred — a demo of a bind with no bind in it. Two nearly-parallel lines
  whose origins are far apart meet a long way away, and the hand spacing is
  what decides how shallow a crossing can land on both blades. At 200 mm — where
  a real pair of hands is in a bind — the shallowest is 5.5°, which straddles
  the friction limit.

Mutation-tested eleven ways: invert the conditioning, drop the arctangent,
invert grip and slip, stop folding obtuse crossings to acute, span the whole
hilt with two hands, make the contact force `τ·r`, shift a lever arm by 20 mm,
make the couple quadratic in the span, drop the crossing angle from the report,
decide the winner by torque alone, hand parallel blades a fake crossing. All
eleven die.

### Also

- `crossing` playground example: one blade sweeps, the other never moves, and
  the contact leaves a dot every tenth of a second. Where the dots are stretched
  metres apart the bead is green and the crossing grips; where they bunch into a
  knot it is grey and slipping. The two states never coincide.

## [0.56.0] — 2026-08-03

### Added

- **`Cut` — a hit is a pressure, and a pressure is a force over an area.**
  `Striking` measures what a blow arrives with. `Blade` measures what the
  object is. Neither knows what happens when the two meet, because that needs
  a third number — **how small an area the force lands on** — and that is what
  this module is.
- **`npm run cut`, the fifteenth gate**, and the first that checks a
  DISAGREEMENT rather than an agreement.
- `sectionAt(spec, x)` on `Blade`: how wide and thick the weapon is exactly
  where it touched, interpolated along the taper. A wound is the width of the
  blade at the point of entry, not an average of the whole thing.
- `curve` on `BladeSpec` — a sabre's 0.9 m, a messer's 2.4 m, an axe bit's
  0.12 m. A ruler measurement of the same object, and it belongs with the
  object rather than with whatever consumes it.

### The finding: two criteria, four orders of magnitude apart

Everybody's intuition about cutting is a STRESS criterion — press until the
pressure reaches the material's strength:

    F_start = σ · A     20 MPa × π(10 µm)²  =  6.3 MILLI-NEWTONS

Six milli-newtons. The weight of a paperclip. Instrumented knives put the force
to push a sharp blade through human skin in the region of ten to fifty newtons,
so the stress criterion is out by four orders of magnitude, and it is the one
that is wrong about the world.

What costs is making new SURFACE. A cut is a crack, a crack has two faces, and
every square metre costs the material's work of fracture:

    E = R·w·d           F_keep = dE/dd = R·w

For skin at 3 kJ/m² that is **12 N across the first 4 mm of blade and 60 N at
full width** — both ends of the measured band out of one derivation, because a
wound is narrow at entry and widens as the blade goes in.

**Sharpness decides whether a cut STARTS. Toughness decides what it COSTS.**
They are not the same question and they do not have the same answer, and the
gate budgets the gap between them at 1000× precisely so that closing it
requires an argument.

### Seven targets, and strength and toughness stay independent

Four toughnesses are derived, `R = K²/E`, from a published fracture toughness
and modulus. Skin and muscle are measured directly, because linear elastic
fracture mechanics does not describe them — they dissipate most of the energy
in a process zone far larger than any crack tip, and `K²/E` there would be
arithmetic on an assumption that does not hold.

Mail is **16×** leather's strength and **1.25×** its toughness. Skin is **67×**
muscle's strength and **3×** its toughness, which is Knight's 1975 forensic
finding restated: the skin is the resistance and what is under it is not. Pine
is the same timber entered twice and costs **11× more across the grain than
along it**, which is the whole argument for a splitting maul.

### Curvature is a pressure multiplier

A curved edge meets a flat target on a chord, `L = 2√(2Rδ)`. Same edge, same
200 N, same leather:

    straight blade      engages 200 mm    1000 MPa
    sabre,  R = 0.9 m   engages  85 mm    2357 MPa    2.4x, for free
    axe,    R = 0.12 m  engages  31 mm     108 MPa    on a 30 µm edge

Nobody has to be told a sabre is curved; the chord of a circle says it. And the
axe is the honest case — the shortest contact in the table, and **still nine
times worse on pressure than the sharp straight sword**. An axe is not a sharp
thing. It is a heavy thing, which is the same mass-at-the-far-end that made it
slow to swing in 0.55.0.

### What this does not know, stated rather than fitted

`cutDepth` returns a BOUND and is named one: `d ≤ E/(R·w)`, every joule into
new crack surface and nothing into friction, wedging or pushing the target. A
113 J hammerfist through a 30 mm blade bounds at **1502 mm into pine**, which
is not a thing that happens. Atkins gives the missing plasticity and friction
terms and both need a measurement of how a blade's flanks load the material,
which this library does not have and has not invented. The gate asserts the
bound IS enormous, because a number fitted until it looked plausible would be a
number about the fit.

### Bugs this found

- **The first draft called the bound a depth.** It reported 1.5 m into pine as
  `depth` and would have been read as one. Renamed to `depthBound` in both
  reports, with the gap documented where the function is rather than in a note
  somewhere — the honesty is structural or it is decorative.
- **The playground probe compared a moving plane against a settled claim.** It
  sampled the first frame after the target cycled, while the threshold plane
  was still easing to the new material, and reported a column that clears as
  one that does not. The scene now publishes whether the plane has arrived, and
  the probe only reads settled frames.

Mutation-tested eleven ways: halve the edge area, turn a point into a
circumference, make the chord linear in curvature, drop the square from
Griffith, take skin's toughness off the measured band, fudge the stress
criterion up to meet the energy one, quietly fit the bound until pine looks
plausible, straighten the axe bit, lose the factor of two in the closed-form
inversion, make the grain stop mattering, let everything bite regardless of
pressure. All eleven die.

### Also

- `proving` playground example: five edges of the same steel under the same
  300 N, their pressures as columns on a log scale, and the material's strength
  as a plane they either clear or do not. Nothing gets sharper or blunter —
  only the target changes, and the same five objects go from all-cutting to
  none-cutting and back.
- `bluntestThatBites(target, force, contact)`, the closed-form inversion of the
  stress criterion, checked against `measureCut` rather than believed.

## [0.55.0] — 2026-08-01

### Added

- **`Blade` — a weapon is a mass distribution held in a hand.** There is no
  `damage` in the file, no `speed`, no tier, no rarity, and nowhere any of them
  could go. Nine objects described with a ruler — lengths, widths, thicknesses,
  materials and a cross-section fraction — and **not one mass in the table**.
  The weight, the balance point, the moment of inertia about whatever point the
  hand holds, the centre of percussion and the pendulum period are all sums
  over it.
- **`npm run blade`, the fourteenth gate**, and the first with a closed form on
  the other side of it.

### The two checks, both from outside

- **A uniform steel bar is in the shipped table, not in the gate**, so what is
  checked is what is exported. Every one of its answers is on a textbook page,
  and every one of them comes back exact to 1e-12: `I = mL²/3` about the end,
  `mL²/12` about the centre, the centre of percussion at exactly `2L/3`, the
  period at `2π√(2L/3g)`. A segment sum that gets a tapered sword subtly wrong
  gets a uniform rod **exactly** wrong.
- **The javelin has a rule book, which is stronger than a range.** World
  Athletics: at least 800 g, 2.60–2.70 m, a 150–160 mm cord, and — since the
  1986 change that shortened the world record by 10% overnight — the centre of
  mass 0.90–1.06 m from the tip. What is typed in is a 1.5 mm aluminium wall, a
  2.5 mm steel one and a ruler. What comes out is **807.9 g** and **1.003 m
  from the tip**. The two wall thicknesses are the only free numbers in the
  entry, and they are the same two a manufacturer has.

### What getting the javelin right broke, which was the finding

The rules put the binding **on** the centre of mass. `percussion` and
`pendulumPeriod` both divide by the distance from the hand to the balance
point, and that distance is now zero, so both diverged.

That is not a numerical guard to add. **An object held at its own centre of
mass has no restoring torque, no pendulum period and no centre of percussion.
It does not swing. It is thrown** — and the arithmetic says so before anybody
does. Both return `Infinity`, which is the limit rather than an error code, and
the javelin is the one row in the table with neither number.

It also forced a correction to a number that had already been written down:
`sweetSpot` was the fraction of the way from the **cross** to the tip, which is
meaningless for a pole arm. A spear is held a third of the way up its own shaft
and its cross sits 1.2 m past the balance point, so the spear read −70 cm of
blade and the javelin read 517%. It is measured from the **hand** to the tip
now — the two landmarks every weapon in the table actually has.

### And a folk claim that turned out to be two different claims

A pommel is a counterweight, and "lighter in the hand, slower in the air" is
**two different inertias**, which only became visible with both printed side by
side. 200 g at the butt of a longsword moves the balance 32 mm back toward the
hand, costs **0.4%** of the inertia about the hand — the pommel sits almost on
the pivot, so it is nearly free there — and **8.7%** of the inertia in free
rotation, which is what "slower" is actually about. The swing period gets
*longer*, not shorter, because `d` shrinks faster than `I` grows.

### Bugs this found

- **Four of the nine entries described the wrong object.** A rapier at 2.610 kg
  against a real 1.0–1.3, a javelin at 2.367 kg against a regulation 0.800, an
  axe at 3.662 and a longsword at 1.787 — every one of them a cross-section
  described too generously, and none of them detectable without comparing
  against what museums weigh.
- **One of the gate's own assertions was vacuous.** The sweet spot was budgeted
  as "between 0 and 1.2", and measuring it from the cross instead of the hand
  passed that budget cleanly — the mutant survived. Replaced with the physical
  claim: the centre of percussion is a point on the weapon, past the hand, past
  the cross, no further than the tip, and the reported fraction is that point
  expressed between those landmarks. A range the number already sits in is not
  an assertion.

Mutation-tested eight ways: drop the parallel-axis term, drop the own-centre
term, replace the tapered centroid with a midpoint, make the javelin shaft
solid, paper over the divergence at the balance point, measure the sweet spot
from the cross, move the steel density 5%, round the node fraction to a quarter.
All eight die.

### Also

- `armoury` playground example: nine weapons hanging from their own grips,
  released together, each swinging by `θ'' = −(m·g·d/I)·sin θ` integrated from
  the derived numbers rather than played back. The meshes are built from the
  same segment table the physics sums. The javelin does not move.
- `tubeFill(diameter, wall)` and `SOLID_ROUND`, so a cross-section fraction is
  derived from a wall thickness — the number a manufacturer actually has —
  rather than typed in.

## [0.54.0] — 2026-08-01

### Added

- **`npm run tameshiwari`, the thirteenth gate — and the only one that imports
  two libraries.** ANIMA derives what a strike arrives with from Dempster's
  segment masses and a measured surface velocity. SCENA 0.108.0 derives what a
  board takes to break from the Wood Handbook, ASTM D245 and three-point beam
  bending. **Neither package imports the other.** Both produce SI units, so
  they can be put side by side — and either they agree about the world or one
  of them is wrong about physics rather than about an API.
- SCENA's number is checked from this repository against a published
  measurement: Feld, McNair and Wilk put a 30 × 15 × 2.5 cm pine board at about
  **3.1 kN** in *Scientific American* in 1979, and the derivation says **3.62
  kN** with nothing fitted. A number only its own tests believe is a number
  nobody has checked.

### What it settled, which was not what it was written to check

The gate was written to ask whether a hammerfist breaks a board. **The question
turned out to be in the wrong units.**

> The lightest strike in the library clears the dearest board **1.9× over on
> energy**. The heaviest clears a pine board by **425×**.

A jab carries 16 J; a pine board needs 1.9 J. An energy criterion says
everything breaks everything, which is not what happens in a dojo. **What a
person runs out of is force, in the first millimetre** — which is why SCENA
states its threshold in newtons, and a conclusion neither library could have
reached alone.

### And the piece that is deliberately still missing

Finishing the comparison — *does this strike break this board* — needs one
number **neither library measures**: how compliant a fist is. It could be
invented. It has not been, because inventing it is the thing these gates exist
to refuse, and because the honest result is more interesting than the fudged
one. There is no board-breaking playground in this release for the same reason.

## [0.53.0] — 2026-08-01

### Added

- **`Sparring` — the payoff, and the point of the whole fighting track.** Two
  fighters, and a decision function that reads four numbers: `strikeReach` on
  its own body against the gap, `stability()` for what the strike costs in
  balance, joules left in the tank, and `coverageOf()` for where the opponent
  is open. **It does not read height, weight, style or who should win.**
  And yet **the longer fighter wins 40 of 45 pairs across ten seeded bodies,
  with the reach gap predicting the margin at r = 0.673** — because a longer
  arm measures further, so there is a band of distance one fighter can reach
  across and the other has to walk through.
- **Reach is not height.** Four pairs in the sweep are taller *and* shorter in
  the reach, and **all four lose.** Gated: if a body ever wins a pair it is
  taller but shorter-reaching in, the gate fails.
- **`Fighter`** — a body, a style, a `Guard`, a `Striking` and a card of what
  it can do, measured once. `adapt()` is the only memory in a bout: between
  rounds a fighter covers where they have been hit, choosing the guard by
  measuring **every** guard in the library on that body rather than from a
  table of counters. **Round one blocks nothing and round two blocks 31 of 63,
  taking 39% less.**
- **Fatigue is a work budget.** Muscle runs at ~20% efficiency and a body holds
  ~300 J/kg of anaerobic reserve — both published figures — so a 68.7 kg body
  has 20.6 kJ in it and eight rounds spends 52% of it. A tired fighter has no
  debuff: they have spent the energy, `skill` falls, and the expensive strikes
  stop being affordable, so the last round is jabs.
- **`npm run sparring`, the twelfth gate**, and CI runs all twelve.
- **The `bout` playground** — two seeded fighters, reach rings drawn at their
  measured range, and the corner between rounds.

### Fixed

- **A defender's `Guard` was being overwritten by their own `Striking` every
  frame.** `Striking` drives both arms and whoever updates last owns the hands,
  so every fighter defended with their hands wherever their own last punch left
  them. The guard stopped **0 of 83 crosses** in a module whose own gate says a
  peekaboo stops a cross. The guard now owns the hands except while a strike is
  in the air.
- **A parry triggered on declaration rather than on sight** — the exact defect
  `Guard`'s gate caught in 0.50.0, reintroduced one release later by a consumer
  of it. Reactions are now scheduled at `reaction` seconds after the strike is
  thrown.

## [0.52.0] — 2026-08-01

### Added

- **`FightStyle` — a style is where the feet are.** Six: `boxing`, `karate`,
  `muayThai`, `wingChun`, `taekwondo`, `brawler`. Each is three facts — a
  stance, a guard and a repertoire — and there is no damage multiplier in the
  table and nowhere one could be added. Everything else is a consequence
  measured by a module that was already there: `stability()` and
  `breakEffort()` for the stance, `coverageOf()` for the guard,
  `measureStrike()` for the strikes. **Nobody wins every column and nobody
  loses every column**, which is the gate's headline because the two ways this
  can fail look identical from outside.
- **`StanceShape` and `applyStance()`** — a stance stated as two footprints and
  a pelvis height rather than a pile of joint angles, so it means the same
  thing on a 1.6 m body and a 1.9 m one. `sink` is *extra* crouch: the drop
  needed to reach the footprints at all is Pythagoras on the worst leg.
  **A long stance is automatically a low one — karate 115 mm against a
  brawler's 41 mm** — and it is the length that does it, not the width, because
  a pelvis is already 90 mm wide. That came out backwards on the first attempt.
- **`styleProfile()`** — eight measured columns per style. The long stance is
  the rooted one (**karate 12.4° against a brawler's 9.5°, and the brawler goes
  over backwards**); the centre line is its own column and **wing chun's long
  guard is the only one in the library with anything on it, at 20.0%** against
  a peekaboo's 0.0%.
- **`Striking` gains `footing` and `follow`.** `follow` is how far the hips and
  thorax keep turning through contact — what `TAIL` was. It was built to
  express *kime*, and then **measured: it buys a cross 4.13× the effective mass
  for −0.000 of balance and 0.000 s of recovery.** That is a free damage
  multiplier with a physical-sounding name, so no style sets it and the gate
  asserts that none ever does.
- **`src/limbik.ts`** — the two-bone IK, in one place instead of two.
- **`npm run fightstyle`, the eleventh gate**, and CI runs all eleven.
- **The `styles` playground** — six fighters, six styles, one body.

### Fixed

- **`restJoint` cached "at rest" from whatever pose the body was in the first
  time anybody asked.** Ask for a reach with a fighter already stood in a wide
  stance and the cache freezes a pelvis that dropped 50 mm to get there, and
  every reach that body reports afterwards is 50 mm short — *depending on the
  order things were measured in*. It now reads the skeleton's bind pose.
  A consequence: **reach is a fact about an arm, not about a stance**, and the
  same cross reaches 0.591 m from all six stances to the millimetre.
- `styleProfile` measures the guard from a clean body. `measureStrike` does not
  lower the guard when it finishes, and measuring afterwards read the same long
  guard as 36.3% standalone and 28.0% in a profile.

## [0.51.0] — 2026-08-01

### Added

- **`Grappling` — a throw is a consequence of the balance, not a cutscene.**
  Eight throws: `osotoGari`, `oGoshi`, `seoiNage`, `uchiMata`, `haraiGoshi`,
  `taiOtoshi`, `footSweep`, `doubleLeg`. There is no success chance in the
  module and nowhere one could be added: an attempt completes if, and only if,
  the uke's centre of mass has left the polygon their feet make on the floor.
  That is judo's definition of *kuzushi*, and it is also exactly what
  `stability()` — written for `Striking`, for a different reason — measures.
  **At skill 0.35 six of twenty-four attempts land; at 0.95 all twenty-four
  do.** Both numbers have to be non-zero.
- **`breakEffort(rig, direction)` and `weakestDirection(rig)`** — how hard this
  body is to break, measured rather than tabulated: tip it a little further
  each step and watch the real `stability()` come down. **A body goes over
  backwards for 4.6° and forwards for 11.8°, a 3.6× spread on the same
  person** — which is a heel sitting 75 mm behind an ankle and a toe 190 mm in
  front of it, read off the feet. *Happo no kuzushi* supplies the eight points;
  which one is cheapest is deliberately not written down anywhere.
- **`Landing`** — `height`, `speed`, `impulse`, `toTorso`, all derived. A
  centre of mass that falls `h` arrives at `sqrt(2gh)` carrying that times a
  mass `bodyMass` gets from the body's own height and build. A hip throw lands
  270 kg·m/s against a foot sweep's 190, because it lifts somebody first.
- **`ukemi`** — a breakfall spreads an arrival; it does not shrink it. The fall
  is identical to within 2.8% and **62% comes off the torso**. The ordering is
  measured, not assumed: an arm that arrives late gets no relief.
- **Grips are contact-gated**, the way `climb` gates a hand on a rung. A sleeve
  grip moves an arm; a lapel cannot come to you, so **engagement range comes
  out at 520 mm** and past it the attempt returns `failed: 'noGrip'`.
- **`npm run grappling`, the tenth gate**, and CI runs all ten.
- **The `dojo` playground** — five pairs, the same throw, nothing but the pull
  between them, and the line splits in the middle.

### Fixed

- **The "fixed" internal timestep in `Striking` was capped but not floored.**
  `steps = ceil(dt / FIXED_STEP); step = dt / steps` runs at 1/240 on a fast
  frame and 1/120 on a slow one, which is not a fixed step at all — it is a
  step that happens to be small. **Five of the fourteen strikes moved with the
  frame rate, a teep by 1.36×.** `Striking`'s own gate could not see it because
  it checked one strike and a cross was one of the stable ones. Both modules
  now carry the leftover, and both gates check every move, exactly.
- `measureStrike` differenced joint positions by its own `dt` rather than by
  the time actually simulated, which put a phantom double-speed spike on the
  first frame that moved. It now divides by `Striking.elapsed`.
- `StrikeReport.worstSpeed` — the pop budget is a speed now, because how far a
  surface moves in one step is a property of the engine, not of the punch.

## [0.50.0] — 2026-08-01

### Added

- **`Guard` — defence is geometry and a stopwatch, not a dice roll.** Seven
  guards: `peekaboo`, `philly`, `longGuard`, `highCover`, `lowGuard`,
  `crossArm`, `open`. There is no block chance in the module and nowhere one
  could be added.
- **`coverageOf(rig, zone)`** — the fraction of the directions a strike could
  arrive from that a limb is currently on. Sampled off the pose the body is in,
  so it answers for a guard, a guard mid-parry, and a guard that has not got
  the hand back yet. **A cross-arm covers 50.9% of the head and a low guard
  5.5% — and the low guard takes 26.0% of the body where the cross-arm takes
  8.8%.** A trade, made with the same two arms, and neither number is written
  down.
- **`reactionTime(skill)` and `canReactTo(strike, skill)`** — the other half.
  Simple visual reaction is 180 ms, choice reaction 350; `skill` interpolates,
  and that interval is what "reading" somebody means. Raced against the wind-up
  `Striking` measures: **nobody reacts to a jab**, an expert answers the
  committed shots, a novice answers none.
- **`Defence`** — `through` and `absorbed` in kg·m/s, which sum to exactly what
  was thrown. A limb in the way is not a wall: the deeper the line passes into
  it, the more it takes. A slip absorbs nothing and delivers nothing.
- **`intercepts`, `zonePoint`, `zoneOf`, `GUARDS`, `GUARD_ZONES`.**
- **`npm run guard`** — the ninth gate. Seven guards × three zones × three
  bodies, plus 28 exchanges driven through `Striking`. Mutation-tested: give
  every guard the peekaboo's hands and *hands down* covers 57.9% of the head;
  make reaction independent of skill and a novice slips roundhouses.
- The `sparring` playground: one striker per guard, working the same rotation
  into all seven, with a post over each showing what got through.

### Fixed

- **`Striking` published the `Blow` when the strike FINISHED, not when it
  LANDED.** A roundhouse lands at 260 ms and finishes at 520, so anything that
  had to answer in real time — a guard deciding whether to slip, a hit
  reaction, a hit-stop — was told a quarter of a second late. Nothing in
  `Striking`'s own gate could see it, because from inside one strike the number
  was right either way.

## [0.49.0] — 2026-08-01

### Added

- **`Striking` — the damage is a measurement, not a table.** Fourteen strikes:
  `jab`, `cross`, `hook`, `uppercut`, `overhand`, `backfist`, `hammerfist`,
  `palmStrike`, `elbow`, `knee`, `teep`, `frontKick`, `roundhouse`, `sideKick`.
- **Effective mass is derived, not chosen**:
  `Σ mᵢ(vᵢ·n̂)⁺ / (v_surface·n̂)` — the momentum of the body along the strike
  line over the speed of the thing striking. `mᵢ` is Dempster's segment mass
  table (sums to exactly 1, asserted); the velocities are read off the bone
  transforms while the strike plays. **A cross measures 1.88× a jab and kicks
  1.94× punches**, because half a body drives one and a leg weighs three times
  an arm.
- **`skill` is the kinetic chain** — how far the pelvis runs ahead of the fist.
  Worth **3.55× on a cross**, 2.71× on a palm strike, and **1.0× on a
  roundhouse**: a straight punch *is* its chain, and a leg is heavy enough
  without one. At skill 0 the hip peaks *after* the fist, which is an arm
  punch, measured.
- **`stability(rig)`** — margin from the centre of mass to the edge of the base
  of support, in foot lengths, from the same segment table. A jab costs 0.61, a
  roundhouse −0.03. Commitment with no move table and no recovery frames.
- **`strikeReach(rig, name)`** — geometry, not a range band:
  `(R − rootZ)² = limb² − rootX² − (targetY − rootY)²`. A head kick reaches
  less than a body kick off the same leg; a cross out-reaches a jab.
- **`bodyMass`, `centreOfMass`, `SEGMENT_MASS_TOTAL`** and `measureStrike`.
- `Blow` carries `impulse` in kg·m/s. ANIMA does not compute damage.
- **`npm run striking`** — the eighth gate. Five bodies, fourteen strikes, ten
  budgets. Mutation-tested: delete the weight transfer and a cross reads 0.50×
  a jab; freeze the chain lag and skill buys 1.00×.
- The `striking` playground: six identical fighters, one skill each, heavy bags
  as pendulums, and a live balance bar.

### Fixed

- **The published impulse depended on the frame rate.** A cross measured 43.7
  kg·m/s on a 20 fps frame and 34.6 at 480 — the effective mass is a ratio of
  two finite differences and was only as good as the step they were taken over.
  A game would have been easier to win on a slow machine and GAMA's replay
  would not have been deterministic. `Striking` now steps at a fixed internal
  rate whatever it is handed, and reads identically from 20 to 120 fps.

## [0.48.0] — 2026-08-01

### Fixed

- **The pelvis was pogoing.** A leg of fixed length swung about the hip is a
  compass: it carries the body up by `leg × (1 − cos θ)`, and nothing corrected
  it. ANIMA's walk moved its pelvis **95 mm** a cycle and its run **234 mm** —
  5.4% and 13.3% of body height, against the **46 mm, 2.6%**, a real walking
  pelvis moves. Now **37 mm (2.1%)** and **88 mm (5.0%)**, and gated.
- **The swing knee fired at the wrong moment** — peaking at maximum hip
  flexion, where a real knee is nearly straight at heel strike and most bent
  just after toe-off. The swinging leg hung 106 mm BELOW the planted one in
  terminal swing, so the body rode the wrong foot. This is why the stance-knee
  hook had been parked at zero for several releases: nothing it did could
  matter while the other leg was competing to carry the pelvis. Retimed to
  peak a third of the way through the swing, from the standard gait-cycle
  landmarks (toe-off 60%, peak swing knee 73%, heel strike 100%).
- **`STRIDE_FACTOR` is gone.** It was 1.35 and it was *fitted* — solved for
  whatever made the measurement agree — and it was covering for the mistimed
  knee, which shortened the real stride by about a third while the constant put
  a third back. Two errors cancelling. The stride is now the ankle's own travel
  over the leg's forward kinematics, which comes out at `2 · leg ·
  sin(hipSwing)` because the knee is straight at both ends of stance.
- **The bake was rounding off the stride's corners.** With the fitted constant
  gone the gate could finally see it: 2.87% short at the walk, 3.14% at the
  run, and *not monotone in `fps`* — the good cases were exactly the ones where
  `round(duration × fps)` divided evenly. `buildClip` now rounds the frame
  count up to a multiple of eight so the quarter phases are keyframes. Walk
  0.09%, run 0.23%. Same disease as the horse's `tempo` defect, one species
  over, invisible for as long as a fitted constant was absorbing it.

### Changed

- **`walkHipSwing` / `runHipSwing` defaults are now the real hip excursion**:
  0.36 and 0.53 rad (21 and 30 degrees) where they were 0.55 and 0.85 (31 and
  49). The stance flexion and both declared speeds are re-derived from whatever
  you pass. Declared speeds barely moved — 1.15 → 1.18 m/s and 2.67 → 2.71 —
  because the two cancelling errors had been landing in roughly the right
  place all along.
- **Stance-knee flexion is solved, not authored**: a scan for the flexion that
  leaves the pelvis flattest. There is a real optimum — bending lowers the top
  of the arc, but past a point it lowers the bottom too — and it lands around
  **14 degrees**, against the 18 the literature puts on loading response. Two
  of the six determinants of gait are modelled here; the missing ones are the
  difference.

### Added

- **`bodyRise` on `FootSkateReport`** — how far the pelvis travels vertically
  over a cycle, read off the transform hierarchy. The companion to `airborne`:
  skate is a HORIZONTAL measurement, and every foot can be exactly where it
  should be while the body pogos over them. Gated in `npm run skate` as a
  fraction of body height (3% walking, 6% running), and watched failing — with
  the solve removed it reads 3.02% and 6.23%.
- `FootSkateOptions.body` — which bone `bodyRise` follows. Default `Hips`; 0
  when the rig has no such bone, rather than throwing.

## [0.47.0] — 2026-08-01

### Added

- **`Archery` — the draw is a force, the anchor is a contact, the group is the
  metric.** Five bows: `longbow`, `recurve`, `compound`, `horsebow`,
  `crossbow`.
- **The arrow's speed is derived, not chosen.** `arrowSpeed` is the area under
  a force–draw curve turned into `½mv²`: a 170 N longbow at a 0.71 m draw
  gives **54.9 m/s**, and SCENA's ammunition table independently declares an
  arrow at **55**. Neither library imports the other and neither number was
  copied; they agree to **0.20%**, and `npm run archery` checks that they
  still do.
- **`elevationFor` / `maxRange`** — the ballistic solution, so a far butt
  visibly raises the bow arm and a target past `v²/g` returns `NaN` rather
  than an angle that does not exist.
- **`groupAt` — millimetres of anchor become centimetres of miss.** An anchor
  `e` off over a draw `d` tilts the arrow by `e/d`, so the group at range `R`
  is `R·e/d`. One `skill` number moves the whole thing: 20 mm of anchor
  scatter and a 50 cm group at 0.3, 3 mm and 7 cm at 1.0.
- **The compound is a different machine, from two numbers.** Its cams store
  80% of peak × draw where a longbow stores 50 (94.3 m/s against 54.9), and
  its let-off leaves 68 N in the fingers against 170 — which is why the same
  archer at the same skill groups 18.6 cm with it and 30.5 with a longbow.
  A crossbow is held by a catch, so `holdForce` is zero and the anchor does
  not apply at all.
- **`npm run archery` — the seventh gate.** A quiver of every bow on six
  bodies, 180 arrows, ten budgets. The best check compares two independent
  routes to the same number — the anchor scatter read off the posed rig, and
  the launch velocities that actually left — and they meet to **1.5%**.
- **The `archery` playground** closes the trilogy loop in one scene: ANIMA
  publishes the launch, GAMA's `Projectiles` flies it, and the marks
  accumulate on SCENA-shaped butts. Measured live: 37 arrows loosed, one in
  flight, zero console errors.

### Fixed

- Found by the new gate: an anchor error measured against the anchor the hand
  had been aimed at rather than the one the face has, reporting zero error for
  an archer who was all over the place; a deflection that applied the error's
  magnitude to both axes with a sign, grouping four times wider than the
  anchor that caused it; a follow-through sampled on the single frame the
  string goes, where the tremor is bigger than the travel; a bow hand that was
  exactly still because it was IK'd to a fixed point; and a drawing hand that
  reappeared beside the bow the instant the follow-through ended, 483 mm on
  one frame.
- CI now runs all seven gates.

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
