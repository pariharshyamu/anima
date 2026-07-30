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

## Three defects it found, all of them shipped

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
