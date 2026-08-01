# Foot skate

Sliding feet are the loudest thing a procedural character does wrong, and the
hardest to notice on purpose. Nothing catches it: the clip compiles, the pose
is valid, the numbers are finite, the screenshot looks like a person mid-stride.
You only see it in motion, and then you can't unsee it.

So ANIMA ships it as a number.

```ts
import { createHumanoid, createLocomotionClips, measureFootSkate } from 'anima3d';

const rig = createHumanoid({ seed: 7 });
const clips = createLocomotionClips(rig);

const report = measureFootSkate(rig, clips.run, { speed: clips.runSpeed });
report.mismatch      // -0.0009  — a tenth of a per cent
report.slipPerStep   // -0.0007  — 0.7 mm of slide per step
```

`npm run skate` runs it across twelve humanoid seeds, four species of
quadruped and three tempos, and fails the build on any clip whose feet have
drifted from the speed it declares.

## What it measures

A locomotion clip is **in place**. Something else moves the character —
`MotionAgent`, a `PlatformerController`, your own code — and the clip is played
at a rate meant to make the feet agree with the ground covered. Get the rate
wrong and the planted foot slides, every step, the same way.

| | |
|---|---|
| `float` | how far the **lower** foot rises above its own lowest point over the cycle |
| `airborne` | fraction of the cycle with **no** foot within tolerance of that point |
| `bodyRise` | how far the pelvis travels vertically over the cycle |
| `stride` | how far a foot travels while planted, **measured from the bones** |
| `stepDuration` | how long it's planted: `duration / stepsPerCycle`, or `duty × duration` |
| `impliedSpeed` | `stride / stepDuration` — the speed at which these feet do not slip |
| `mismatch` | `speed / impliedSpeed - 1`. **The number to gate on.** |
| `slipPerStep` | the same fact in metres |
| `spread` | how much the individual feet disagree about the length of a step |
| `peakDeviation` | worst instantaneous error — see below, and don't gate on it |

Positive `mismatch` means the body outruns the feet: the classic forward
slide. Negative means the legs cycle faster than the ground needs, which reads
as running on the spot.

## It samples the rig; it does not do the arithmetic

`clips.ts` and `gaits.ts` already predict a stride in closed form. Predicting
it a second time here and comparing the two would prove only that two copies
of one formula agree. So `measureFootSkate` drives a real `AnimationMixer` over
the real bones and reads world positions — the numbers come out of the
transform hierarchy that ships, including every secondary rotation, body yaw
and ride-height term the closed form leaves out.

That independence is the entire value, and it has a consequence worth stating
plainly: **the declared speeds must never be computed from this function.** It
would be strictly more accurate and it would make the gate compare the
measurement to itself and pass forever.

## Any rig, not just ANIMA's

```ts
measureFootSkate({ object, bones }, clip, { speed, feet: ['LeftAnkle', 'RightAnkle'] });
```

The rig parameter is structural — anything with an `Object3D` root and named
bones under it. `HumanoidRig` and `QuadrupedRig` both satisfy it, and so does a
skeleton you loaded from a GLB, which is the point: the metric is useful on
animation ANIMA did not author.

## Bipeds: peak to peak. Quadrupeds: the contact window.

By default the stride is the foot's whole backward excursion, found by walking
from its forward-most sample until it turns around. For a sine-driven biped
that is exactly right — the foot touches down at its own forward extreme.

A horse's hoof does not. It reaches *past* its landing point in late swing, so
peak-to-peak overstates the ground it covers, by 10% on the canter. The gait
specs declare when each foot lands and for how long, so pass them:

```ts
measureFootSkate(horse, clips.canter, {
  speed: clips.speeds.canter,
  feet: ['LFHoof', 'RFHoof', 'LHHoof', 'RHHoof'],
  contact: { LFHoof: 0.28, RFHoof: 0.56, LHHoof: 0, RHHoof: 0.28 },  // GAITS.canter.contact
  duty: 0.35,
});
```

## `peakDeviation` is not a defect

A sinusoidal gait **cannot** hold a foot still. The hip swings through a sine,
so the foot's backward speed peaks mid-step and falls to zero at each extreme.
Measured on ANIMA's own clips it deviates from the travel speed by ~140% (walk)
and ~158% (run) at some point in every single step, however perfectly the
stride is matched.

That is the shape of the curve, not an error. It is reported because a number
you can see is better than a number you assume, and it is deliberately not
gated: gating it would be gating the choice of curve. What matters is that the
stride is right, because *that* error repeats identically every step, and
repetition is what the eye picks up.

## Five defects it found, all of them shipped

**The run's stride factor was a guess.** `createLocomotionClips` used an
empirical 1.6 for the run against 1.35 for the walk. Both gaits are the same
geometry — the same legs swinging through the same kind of arc — so there was
never a reason for two numbers. Solving for the factor that stride-matches the
run gave 1.3507, 1.3512, 1.3525 and 1.3507 on four different seeds: the walk's
number, four times. The declared `runSpeed` had been overstating the real
stride by **18.4% on every seed**, and since `Locomotion` derives its playback
rate from those constants, the run clip played 18% too slowly for the ground
covered — about **15 cm of slide per step**.

**The horse's formula and its poser disagreed about one constant.**
`gaitSpeed` predicted a hoof sweep of `2·R·sin(reach)`; `poseLeg` swung the
hind limb through `0.95·reach`, a factor that lived in the poser alone. Up to
**8.5%** of the horse's declared ground speed was never delivered by its legs.
The fix was to hoist `HIND_DRIVE` to where both can read it.

**Tempo bought fewer keyframes.** `createGaitClips` baked at a fixed *output*
fps, so a 1.4× canter got 13 keyframes where a 1× canter got 19; the coarse
bake rounded the hoof's arc off and skate doubled to 7.5%. Keyframe density
belongs to the shape of the motion, not to how fast it is played back. This one
was found *only* because the gate sweeps tempo — measuring the default would
have called it clean.

## What is still wrong, and why it is left alone

The trotting foreleg is out by **6.5%**. `limbState` widens the shorter
foreleg's arc so both ends sweep the same ground and the horse tracks up, but
it compensates against the hind's *nominal* arc rather than the slightly
smaller one `HIND_DRIVE` actually delivers.

Narrowing it is the tidier claim and makes both formulas agree exactly. It also
moves the cantering forefoot from 3.0% to **8.2%**, because a rigid pendulum is
a poor model of a foreleg on a horse whose spine flexes through the stride. So
it stays, it is reported, and it is held at a ceiling.

Tuning a constant until the table looks better is fitting the code to the
measurement, and the measurement stops meaning anything the moment that
happens. A known 6.5% you can see beats a hidden 8.2% you tuned your way into.

## Budgets, not baselines

`bench/skate.mjs` holds a ceiling per case, at roughly 1.4× the measured worst,
and prints how much of each is spent:

```
  case                 mismatch   budget   used  spread   budget   worst case
  ----------------------------------------------------------------------------
  humanoid walk           0.57%    1.00%    57%   0.00%    2.00%   seed 11
  humanoid run           -0.30%    1.00%    30%   0.97%    2.00%   seed 3
  horse walk              0.82%    1.50%    54%   5.52%      n/a   horse @1.4×
  horse trot fore        -6.52%    8.00%    82%   0.00%      n/a   pony
  horse canter            3.60%    5.00%    72%  39.52%      n/a   horse @0.75×
```

A recorded baseline would pin these to five decimals and fail on any three.js
interpolation change. Ceilings survive that; the `used` column is what stops
them being decoration, because a budget nothing ever approaches is not a gate.

The mismatches are identical across every species, tempo and seed — which is
itself the geometry's prediction, since stride, stance time and declared speed
all scale together. A row that starts varying by species is a finding.

`spread` is gated only where the feet are actually claimed to agree. A canter
has a **lead**: its two hind limbs do different jobs and the leading one sweeps
40% further. Demanding symmetry there would be demanding the gait be wrong, so
horse `spread` is reported and each end is instead held to its own ceiling.


## The half this gate could not see

Foot skate is a **horizontal** measurement. It asks how far a planted foot
slides and it is silent on whether a foot is planted at all — and those are not
the same question.

ANIMA's own gaits had no foot on the ground for **43% of the walk cycle and 63%
of the run**, peaking 79 mm and 222 mm up, through thirty-odd releases with
this gate passing on every one of them. A sine-driven leg is a pendulum, and a
pendulum's foot traces an arc: with a straight knee and the hip swung by θ the
ankle rides `leg × (1 − cos θ)` above the floor, which at the run's 0.85 rad is
277 mm. A walk is *defined* by always having a foot down. These did not.

No other check could have caught it either. The clips compile, the poses are
valid, the unit tests assert bone rotations, and a still frame of a floating
character is indistinguishable from a still frame of a walking one. It took
somebody watching the playground and saying the feet were not touching.

So `float` and `airborne` now come out of the same measurement pass, and the
bipeds are gated at zero:

```
  worst airborne fraction       0.00% of the cycle
  worst lower-foot float        1.0 mm
```

Both are **reference-free** — `float` is the lower foot's excursion about its
own minimum, so the metric needs no notion of where the floor is, only that the
body keeps returning to it. A rig posed anywhere, at any scale, answers the
same.

Non-zero is not automatically wrong: a gallop has a real suspension phase. It
is wrong when the body does not rise with the feet. The horse gaits are
reported and not yet gated for exactly that reason — the gallop currently reads
**92.92% airborne with 780 mm of float**, which is a finding waiting for its
own release.

### What the fix was

`createLocomotionClips` measures where the lower ankle actually sits on the
posed body each frame and lowers the hips onto it. It touches only
`Hips.position.y`, so every descendant translates straight down and no foot's
Z moves — the stride, and this whole gate, are untouched by construction.

The authored `bob` sine is gone from the walk and the run. What the planting
produces is the **compass gait**: the pelvis rides highest at midstance and
drops as the legs spread, because that is what legs of a fixed length do. The
vertical motion of a gait is a consequence of the leg geometry, not a free
parameter, and having both meant the free one was fighting the real one.

## `bodyRise` — the pelvis, which the compass gait leaves bouncing

Planting the feet does not make a gait right; it makes the *feet* right. The
compass arc it exposes is real geometry and it is far too big: a leg of fixed
length swung about the hip carries the pelvis up by `leg × (1 − cos θ)`, which
gave ANIMA **95 mm of pelvis travel at a walk and 234 mm at a run** — 5.4% and
13.3% of body height, against the **46 mm, 2.6%,** a real walking pelvis moves.
It reads as a bobbing, hopping gait. It is invisible to skate, which is a
horizontal measurement, and invisible to a still frame.

`bodyRise` is that number, read off the transform hierarchy in the same pass,
and it is gated as a fraction of body height:

```
  humanoid walk  pelvis rise    38.5 mm  (2.15% of height, budget 3.00%)
  humanoid run   pelvis rise    90.2 mm  (5.02% of height, budget 6.00%)
```

Three things had to change to get there, and the first two were *why* the
correction had been parked as "its own piece of work" for several releases.

**The swing knee was firing at the wrong moment.** It peaked at maximum hip
flexion — the leg bent most while reaching forward — where a real knee is
almost straight at heel strike and most bent just after toe-off. So the
swinging leg hung *below* the planted one in terminal swing, by 106 mm at the
run, and the body rode the wrong foot. Nothing the stance knee did could
matter while that was true: bending the stance knee just handed the pelvis to
the other leg. Retiming the bump to peak a third of the way through the swing
(toe-off at 60% of the cycle, peak knee flexion at 73%, heel strike at 100% —
so `sin(pi · s^SKEW)` rather than a symmetric bump) is most of the fix.

**The stance knee is solved, not authored.** There is a real optimum and it is
not "as much as possible": bending lowers the top of the arc, but past a point
it lowers the bottom too and the excursion grows again. What comes out is
about **14 degrees**, against the 18 the literature puts on loading response —
two of the six determinants of gait are modelled here, and the missing ones
are the difference.

**`STRIDE_FACTOR` is gone.** It was 1.35, and it was fitted: solved for
whatever made the measurement agree. It was covering for the mistimed knee,
which shortened the real stride by about a third while the constant put a
third back — two errors cancelling in the declared speed. With the knee timed
properly the stride is `2 · leg · sin(hipSwing)` and nothing else, and the hip
swing is now the real excursion: **21 degrees at a walk, 30 at a run**, where
it used to be 31 and 49. The declared speeds barely moved (1.15 → 1.18 m/s,
2.67 → 2.71) because the two errors had been cancelling all along.

An earlier attempt solved the *swing* knee from a clearance target as well.
It reads better and it is wrong: the depth equation has two roots, they
coincide only where the leg is straight, and approaching heel strike the
continuous branch folds the shank back under the hips. It jumped the knee 41
degrees at every heel strike — 27 mm of foot float, 95% of the cycle airborne,
the run 15% out on stride. A foot that has to reach forward and touch down
level with the other one is not something a knee can do alone; a real leg
spends its heel on it.

### And the bake, which had been hiding behind the fitted constant

With the geometry honest, the gate had something new to say: the biped's
mismatch jumped to **2.87% at the walk and 3.14% at the run**, and it was not
monotone in `fps` — 0.03% at 60 for the walk, 1.47% for the run, 0.03% at 45
for the run. The good cases were exactly the ones where `round(duration × fps)
` divided evenly.

A gait's stride ends on a **corner**: the hip reverses and the knee's two
curves meet. Bake a key either side of a corner and the interpolation cuts it
off. `buildClip` now rounds the frame count up to a multiple of eight, so the
quarter phases — both stride ends, midstance and mid-swing — are keys. It
costs at most seven frames and takes the walk to 0.09% and the run to 0.23%.

This is the horse's `tempo` defect again, one species over, and it had been
invisible on the bipeds for as long as a constant fitted to the measurement
was absorbing it. That is the argument against fitted constants in one line.