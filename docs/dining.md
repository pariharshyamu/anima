# Dining

Where the utensil is **the mechanism**, not the prop.

```ts
import { createHumanoid, Dining } from 'anima3d';

const meal = new Dining(rig, {
  utensil: 'spoon',
  plate: bowl.object,     // any Object3D — a SCENA prop's `.object`
  food: bowl,             // anything Countable-shaped; the plate empties
  held: spoonProp,        // moved to the hand every frame
});

meal.onBite(() => sfx.play('bite'));
meal.onFinish(() => waiter.clear());
game.onUpdate((t) => meal.update(t.delta));
```

Eight utensils: `fork`, `spoon`, `knifeAndFork`, `chopsticks`, `hands`, `cup`,
`bowl`, `straw`.

---

## Why this is not one animation with a different object in the hand

It is tempting to treat eating that way. It is not that. Swap a spoon for
chopsticks and **the bowl comes to your face**; swap it for a glass and **the
wrist tilts further as it empties**; swap it for a knife and fork and there is a
whole rhythmic sub-action before every few bites. None of that is a re-skin.
Each one changes what the arm has to do.

| | what changes |
| --- | --- |
| `fork` | the control case: nothing is loose, so the wrist is free |
| `spoon` | must stay **level**, which is why the elbow comes up |
| `knifeAndFork` | two hands, and a sawing `cut` phase every three bites |
| `chopsticks` | the free hand lifts the bowl; the head comes 75% of the way |
| `hands` | two hands, and the mouth meets the food halfway |
| `cup` | the wrist tilts by `pourAngle`, further every sip |
| `bowl` | the same tilt, wider vessel, so much less of it |
| `straw` | the glass comes up and **never goes over** — that is the whole of it |

Measured across the eight: 83.8 mm of difference in how far the head travels.

---

## Three things that are physics rather than taste

**A spoon has to stay level.** Not approximately — a spoonful of soup does not
survive a wrist that rotates on the way up, and that constraint is the whole
reason a person carrying soup raises their elbow. The wrist is corrected toward
level every frame and **the correction is clamped to a wrist's actual range**,
so when the clamp binds the spoon tips rather than the shoulder doing something
a shoulder cannot. The number that makes this a mechanism rather than a field:
across plate placements chosen to make a level carry hard, a **spoon holds
0.000 rad off level and a fork sits at 0.350** — twenty degrees, and enough to
lose everything on it.

**A glass tilts further as it empties.** By exactly how much is geometry:

```
pourAngle(fill, height, radius) = atan(height × (1 − fill) / radius)
```

Liquid `fill` deep leaves `height × (1 − fill)` of dry wall above it, and the
surface reaches the lip when tipping drops the far rim by that much across the
diameter. A full glass needs nothing; an empty one needs seventy degrees. It is
also why a soup bowl barely goes over and a highball nearly inverts — same
formula, different radius. Measured: **+0.55 rad from the first sip to the
last.**

**The plate empties.** Food is `Countable` — the same shape SCENA's ammunition
publishes — so mouthfuls come out of a real number and the meal **ends**. A
diner who eats forever off a full plate is the tell that this is a loop.

---

## The reach is a loop, not a constant

A plate further away than an arm cannot be eaten from, and what a person does
about that is lean. So the body folds toward the plate by however much the last
frame's measurement said was still missing:

```ts
meal.lean        // radians, closed-loop
```

The first version solved it analytically, rotating the shoulder about the hips.
That is what the body would do if it bent in one place. It does not — the fold
is spread over the spine and the chest, and it is **added on top of a pose this
module does not own**, because the diner is sitting in a chair somebody else
put them in. The closed form over-predicted the benefit by enough to leave the
fork **94 mm short of the plate while reporting that it had converged**.
Feeding back the distance actually left is the only number that is true of the
body rather than of a model of it.

Measured: a plate under the chin folds the body **0.00 rad**; one at arm's
length folds it **0.57**. And the sweep publishes the limit — **a plate more
than 474 mm forward cannot be eaten from at all** without standing up.

---

## What it owns, and what it leaves alone

A diner is usually sitting, and the sit came from somewhere else. So `Dining`

- **takes the arms outright** — an idle sit pose has nothing to say about where
  a fork goes;
- **only adds** to the spine, chest, neck and head, giving last frame's
  contribution back before applying this one;
- **never touches** the hips or the legs.

That is what lets `Interaction`'s `sit` and this run on the same body.

## The jaw this rig does not have

`BONE_NAMES` has no jaw, and inventing one would reshape every character in the
library for one feature. So chewing is conveyed by the pause and by a small
head motion, and the phase itself is **published** rather than applied:

```ts
meal.chewPhase   // 0..1 — drive a jaw bone or a blend shape if your rig has one
meal.canSpeak    // false while there is food in the mouth
```

Hand `canSpeak` to `Conversation` and nobody talks with their mouth full —
which is a rule of the room rather than of the body, and so belongs out here
rather than inside a pose.

---

## `measureBite` — the gate

```ts
const r = measureBite(rig, 'spoon', { plate, food: servings(5) });
r.mouthGap    // closest approach to the mouth, per mouthful, metres
r.spill       // worst tilt off level on the way up, radians
r.plateGap    // closest approach to the plate
r.lean        // deepest fold toward the plate
r.tiltFirst   // and r.tiltLast — the drink going further over
r.handIdle    // fraction of the meal the hand was NOT travelling
```

`npm run dining` eats a whole plate of all eight utensils on six bodies —
240 mouthfuls — and holds them to eleven budgets.

```
dining: 8 utensils, a whole plate of each on 6 bodies — 240 mouthfuls
  to the mouth      0.0 mm at closest approach     budget 20 mm
  to the plate      8.4 mm                         budget 30 mm
  spoon stays level 0.000 rad where the wrist has to work   budget 0.14
  …and a fork need not: 0.350 rad
  the body leans    0.00 rad under the chin → 0.57 rad at arm's length
  reach limit       a plate 474 mm forward is the furthest this body can eat from
  the drink tips    +0.55 rad from the first sip to the last   budget +0.15
  …and a straw does not: 0.000 rad
  styles differ     83.8 mm of head travel between them   budget 30 mm
  the hand rests    26.3% of the meal                budget 20%
  no pops           15.4 mm per frame                budget 25 mm
```

**Contact is a closest-approach question**, not a worst-frame one — the same
lesson the climb gate had to learn one contact over. A gather is a *scoop*: the
utensil deliberately dips and circles, and a worst-frame reading called that
40 mm of miss on a plate the hand was holding.

Things this gate caught while it was being written:

- a straw whose glass stayed on the table while the head went down to it, which
  needed **47 cm of neck the rig does not have**;
- an analytic reach solve that reported convergence with the fork **94 mm short
  of the plate**;
- a knife and fork that cut at the plate and then "reached" for it from a
  resting pose, teleporting the tines **310 mm on one frame**;
- a meal that ended the instant the plate hit zero, cutting the hand off
  mid-bite and jumping the utensil **272 mm** to a pose it had not travelled to;
- a `meet` routed through the head alone, worth **12 mm** of mouth travel —
  true of the neck and useless as a difference between eating styles, which is
  what the whole module is for;
- a sip tilt read at the moment the mouthful was counted, which is before the
  wrist has gone over, reporting **0.00 for every drink in the library**;
- a spill number reported only for the utensils that correct, so **a fork came
  out as level as a spoon** because nobody had asked the fork.

The mutation pass: deleting the wrist levelling fires `LEVEL DOES NOTHING` and
`SPILLS`; ignoring how full the glass is fires `FLAT DRINK`; giving every
utensil the same `meet` fires `ONE STYLE`; freezing the fold fires
`DOESN'T LEAN`.

---

## The handshake

SCENA already has the crockery — `createUtensil`, `createCrockery`,
`createDiningTable`, `createVessel` — and it publishes `Countable`. ANIMA's
problem is the reach. Neither imports the other:

```ts
import { createUtensil, createCrockery } from 'scena3d';

const spoon = createUtensil({ style: 'spoon' });
new Dining(rig, { utensil: 'spoon', held: spoon.object, plate, food });
```
