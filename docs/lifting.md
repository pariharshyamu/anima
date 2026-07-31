# Lifting

Gym work — and the first motion in ANIMA that gets **worse as it goes on**.

```ts
import { createHumanoid, Lifting } from 'anima3d';

const rig = createHumanoid({ seed: 7 });
const set = new Lifting(rig, 'squat', { load: 100, reps: 8 });

set.onRep((r) => hud.count(r.index));
set.onFailure((n) => crowd.gasp(n));

game.onUpdate((t) => set.update(t.delta));
```

Twelve movements: `squat`, `frontSquat`, `deadlift`, `romanianDeadlift`,
`overheadPress`, `benchPress`, `row`, `curl`, `lateralRaise`, `lunge`,
`kettlebellSwing`, `pullUp`.

---

## Why this is a controller and not a clip

Everything rhythmic in this library before now is a loop. `createLoopClip`
hands back a cycle, the mixer plays it forever, and rep forty is bit-for-bit
rep one. That is exactly wrong for lifting, and it is why a gym built out of
looped clips reads as a screensaver. Two properties are doing all the work,
and neither survives being baked:

**The rep is asymmetric.** You lower a bar in about two seconds and drive it up
in about one. A symmetric rep is what you get free from a sine, and it is the
instant tell of a fake gym animation. Measured from the load's own vertical
velocity — not read back off the spec — these come out between 1.43× and 1.97×.

**The rep decays.** Rep eight is slower, shallower and shakier than rep one; the
sticking point deepens; and eventually there are no more reps left in the weight.
Measured: the last rep reaches 88% of the first rep's depth and takes 1.11× as
long, and the bar path has drifted 20 mm off where rep one put it.

A clip cannot express either, because a clip is the same every time it plays.

`createLiftClip(rig, 'squat')` exists anyway — one clean rep, loopable, for the
twenty people in the background of a gym scene where nobody is going to count
anyone's reps. It is explicitly rep one forever: no deepening sticking point,
no shortening range, no failure.

---

## Where the decay comes from

Not from a curve someone liked. `repsInReserve` is **Epley's formula**
rearranged —

```
reps = 30 × (1RM / load − 1)
```

— the same arithmetic every strength coach uses to turn a working weight into a
rep target. At 75% of a maximum it predicts ten reps; at 85%, five. Fatigue is
simply how far through that budget the set has got, and everything that decays
is a function of it:

| what | how it changes |
| --- | --- |
| concentric duration | ×(1 + 0.7·fatigue) — the push grinds |
| eccentric duration | ×(1 − 0.18·fatigue) — control is the first thing to go |
| depth | ×(1 − 0.2·fatigue) |
| sticking point | 0.25 → 0.80 of the velocity profile |
| tremor | 0 → 13 mrad |
| form drift | the torso closes a further 0.09 rad under effort |

Load a bar light and the set never visibly tires. Load it near a maximum and the
third rep already grinds — and then the set **ends short**:

```ts
const set = new Lifting(rig, 'squat', { load: 140, reps: 12 });  // 93% of a max
// …onFailure fires at rep 3. Epley never offered twelve.
set.repsLeft   // falls toward zero as the set goes
set.grind      // 0..1, peaks at the sticking point of a late rep
```

`grind` is the number to hand GAMA's `GameFeel` for a camera that strains with
the lifter, or an audio bridge for the breath.

---

## The bar path, and why the torso angle is solved

A loaded bar has to stay over the middle of the foot. That is not a style
preference — a system whose centre of mass leaves its base of support falls
over — and it is the first thing any coach corrects.

So the torso angle is **not authored**. Given where the hips have travelled and
where the load rides, `Lifting` solves the pitch that puts the load over
mid-foot, against the chain the rig actually has:

```
holdZ = hipsZ + L₁·sin(½φ) + L₂·sin(0.78φ) + r·sin(φ + arch + base)
```

There is no closed form for φ; four Newton steps from the single-hinge estimate
converge to under a millimetre.

That one decision buys two things nobody authored:

- **A front squat comes out upright and a back squat comes out leaning, from
  identical legs.** Both shapes hand the legs the same numbers. Only the load
  moved — 9 cm forward, from the traps to the front rack — and the torso came
  up to meet it. Measured: 1.08 rad against 0.60 rad at the bottom.
- **A long-femured character leans further than a short-femured one**, because
  their hips travel further back and the torso has to close more to bring the
  bar home.

The feet are handled the same way and for the same reason: the ankles are
**IK'd onto fixed targets** for the whole set, so "the feet did not move" is
true by construction rather than by luck, and the knee and hip angles are
whatever the hips travelling demands.

---

## The handshake

A barbell is a SCENA prop and a `Holdable` — the same shape `Carry` takes, so
anything with an `object` will do and neither library imports the other:

```ts
import { createBarbell } from 'scena3d';       // or your own mesh

const bar = createBarbell({ plates: 4 });
set.hold({ object: bar });                     // moved to the load every frame
```

Build the object with its **origin at the middle of the bar** and its length
along X. `set.loadPoint()` gives you the world position directly if you would
rather place it yourself.

---

## `measureBarPath` — the gate

```ts
import { measureBarPath } from 'anima3d';

const r = measureBarPath(rig, 'squat');
r.plumbEarly       // 0.0000 — rep one, over mid-foot to the micron
r.plumbDeviation   // 0.0205 — rep eight, 20 mm out, and that IS the feature
r.tempo            // 1.80 — eccentric ÷ concentric, from the motion
r.depthDecay       // 0.880
r.slip             // 0.0000 — planted feet
r.gripGap          // 0.0000 — hands on the bar
```

`npm run lifting` drives a full set of all twelve movements on six bodies and
holds them to nine budgets. `npm run lifting -- --why` prints the table.

```
lifting: 12 movements, a full set of each on 6 bodies
  bar path          35.9 mm off the plumb line   budget 10–50 mm
  rep asymmetry     1.43x eccentric              budget 1.35x
  ballistic         0.60x                        budget under 0.85x
  rep decay         depth to 89.4%, duration to 1.088x
  feet planted      0.04 mm                      budget 5 mm
  hands on the bar  8.7 mm                       budget 15 mm
  no pops           19.2 mm per frame            budget 30 mm
  it reads          242 mm of travel             budget 150 mm
  clip vs live      3.6 mm over rep one          budget 8 mm
  a set can be lost 93% of a max ended at rep 3 of 12; 40% finished all 12
```

The **bar-path budget is two-sided** on purpose. The upper bound says the form
stays inside coaching tolerance; the lower says the fatigue model reached the
bar at all. With the form drift deleted, the tremor alone still moves the load
2–4 mm, and a one-sided "worse than rep one" check passed happily — which is
how a gate ends up proving that a number is not exactly zero.

Things this gate caught while it was being written, none of which a screenshot
or a unit test would have seen:

- a set that **reset to lockout when it ended**, teleporting the bar 441 mm on
  one frame;
- a bent-over row whose bar **rose on the way down**, from an arm counter-rotation
  applied with the wrong sign — the tempo came out at 0.59× instead of 1.61×;
- a lunge whose split stance was **wider than the legs could reach**, floating
  both feet 70 mm off the floor at the top of every rep;
- a single-hinge balance model that put the squat bar **65 mm forward of
  mid-foot**, because a chain that bends in three places carries its top further
  forward than one that bends in one;
- a fade-out that stopped **one frame early**, leaving 0.011 rad of hip rotation
  on a body that had been handed back;
- a bench press whose bar was **further from the shoulder than the arm is long**.

---

## What is not here

Anything that needs a bench, a rack or a machine to *exist* is a SCENA problem,
not an ANIMA one, and half a movement is worse than none. The bench press is
here because it needs nothing but a height; the leg press is not.

`plumb: 'free'` on a curl, a row, a lateral raise, a bench press or a kettlebell
swing is not an exemption either. Those paths are arcs by construction — a curl's
hand travels forward because the forearm rotates about the elbow, and a bench
press bar path is a shallow J on purpose — and holding them to a plumb line
would be gating the definition of the movement rather than the quality of the
animation. They are still held to every other check.
