# FightStyle

A style is **where the feet are, where the hands are, and what the fighter
knows how to throw**. There is no damage multiplier in this module and nowhere
one could be added.

```ts
import { createHumanoid, FightStyle, Striking, Guard } from 'anima3d';

const style = new FightStyle(fighter, 'muayThai');
const guard = new Guard(fighter, { style: style.spec.guard });
const striking = new Striking(fighter, { target, footing: style.spec.stance });

// The stance goes first. Striking composes its weight shift and hip turn on
// top as deltas, and takes the kicking leg outright while a kick is in the air.
style.update(dt);
striking.update(dt);

striking.throwStrike(style.at(beat)); // walks the repertoire
```

Six styles: `boxing`, `karate`, `muayThai`, `wingChun`, `taekwondo`, `brawler`.

---

## Everything else is a consequence

| | measured by | for its own reasons |
|---|---|---|
| the stance | `stability()`, `breakEffort()` | balance, and which way you get thrown |
| the guard | `coverageOf()` | what a limb is on the line of |
| the repertoire | `measureStrike()` | what each strike actually weighs |

Nobody balanced these six against each other. They are six sets of footprints
and the numbers come out where they come out:

```
style        base   reach   power   poise    cover   body  centre   rooted  broken
boxing      0.707   0.591    3.36   0.678    35.7%   8.8%    0.0%    12.4°  left
karate      0.657   0.919    4.05  -0.592    30.2%  22.0%    4.0%    12.4°  left
muayThai    0.636   0.906    4.57   0.267    30.2%   8.2%    0.0%    10.7°  back
wingChun    0.490   0.593    4.81   0.243    36.3%  13.7%   20.0%     9.0°  back
taekwondo   0.609   0.919    5.05  -0.280     5.5%  25.8%    0.0%    10.7°  left
brawler     0.551   0.591    3.31   0.336     5.5%  17.0%    0.0%     9.5°  back
```

**Nobody wins every column and nobody loses every column.** That is the gate's
headline, and it is a shape rather than a value — because the two ways this
module can fail look identical from outside. Either the stance stops mattering
and six styles produce six identical profiles, or one style quietly becomes
best at everything.

---

## A stance is two footprints, not a pile of angles

```ts
interface StanceShape {
  spread: number;   // ankles apart ACROSS, fraction of height
  stagger: number;  // lead ankle ahead, fraction of height
  sink: number;     // extra crouch, on top of what the footprints force
  blade: number;    // hips turned away from the line, radians
}
```

Stated as joint angles, a stance that is right on a 1.6 m frame puts a 1.9 m
one's feet somewhere else, and every number downstream quietly moves with it.
Stated as footprints, the angles are whatever IK needs them to be on *this*
body.

### A long stance is automatically a low one

`sink` is **extra** crouch. The drop needed just to reach the footprints is
computed — Pythagoras on the worst leg — so:

```
karate    115 mm of forced crouch
boxing     56 mm
brawler    41 mm
```

Which way round that goes was not obvious and was assumed backwards here first.
A pelvis is already 90 mm wide, so spreading the feet **across** costs a leg
almost nothing; standing one 350 mm **in front** costs it the whole 350. A
karate front stance is deep because it is long. A brawler standing with their
feet wide is barely crouching at all.

### ...and the long stance is the rooted one

```
karate    12.4°, broken over the LEFT
brawler    9.5°, broken BACKWARDS
```

A body goes over the shortest way out of its own base. The wide square stance
has no depth, so it goes backwards; the long narrow one goes sideways. Judo has
taught that for a century and nothing here had to be told it — `breakEffort`
tips the real body and watches the real `stability()`.

---

## The centre line is its own column

`cover` averages every direction a strike could arrive from. `centre` samples a
narrow cone straight down the line of engagement, and the two are very
different questions:

```
guard        head   centre
crossArm    50.5%    64.0%
longGuard   36.3%    20.0%
peekaboo    35.7%     0.0%
philly      30.2%     4.0%
highCover   30.2%     0.0%
lowGuard     5.5%     0.0%
open         5.5%     0.0%
```

**A peekaboo covers 35.7% of the head and 0% of the centre line.** The gloves
sit either side of it and a punch down the middle splits them — which `Guard`
noticed in passing when it was built, and which this column exists to hold on
to. Wing chun's long guard is the only one in the library with anything on that
line, which is what wing chun is for.

---

## The knob that is deliberately not used

`Striking` now exposes `follow` — how far the hips and thorax keep turning
*through* contact, which used to be a module-level constant. It was built for
this module: *kime* against swinging through is a real difference between
karate and muay thai.

Measured, it buys a cross **4.13× the effective mass** for −0.000 of balance
and 0.000 s of recovery. That is a free damage multiplier with a
physical-sounding name on it.

So `follow` stays available to anybody who wants it, **every style uses the
same value, and the gate asserts that they do.** If a real cost is found later,
the styles can start differing on it. Until then, no.

---

## The gate — `npm run fightstyle`, the eleventh

Six styles × eight columns over three bodies. Mutation-tested: give every style
the boxing stance and the base column collapses to 1.00×; stop forcing the
crouch and both stances drop 0 mm; revert the rest-pose fix and reach depends on
when it was first asked; measure the guard after the strikes and the centre-line
leader changes.

### What it caught

Three defects, all found by **one invariant** — profile the six forwards, then
backwards, and demand the same numbers.

- **`restJoint` cached "at rest" from whatever pose the body was in the first
  time anybody asked.** Ask for a reach with a fighter already stood in a wide
  stance and the cache freezes a pelvis that dropped 50 mm to get there — and
  every reach that body reports for the rest of the session is 50 mm short.
  Worse, it was short *depending on the order things were measured in*, which
  is the kind of defect that survives a green test suite indefinitely. It now
  reads the skeleton's bind pose.
- **`measureStrike` does not lower the guard when it finishes**, so guard
  coverage measured after it was measured on a body still carrying the last
  punch. The same long guard came out 36.3% standalone and 28.0% in a profile.
- **A centre-line cone sampled along +forward instead of −forward**, which asks
  what covers the back of somebody's head. The answer is nothing, for
  everybody, and it reads exactly like a working measurement.

Two of the gate's own assertions also turned out to be **vacuous** and had to
be rewritten: comparing styles that share a guard, when all six hold different
guards; and asserting that kicks out-reach punches, which came out true by two
millimetres. A budget that passes by a coincidence is not a budget.

---

## And one thing that turned out not to be true

Reach was assumed to be a stance consequence. It is not. `strikeReach` measures
how far a limb gets from its own root, and with `restJoint` reading the bind
pose that is a fact about the **arm** — the same cross reaches 0.591 m from all
six stances, to the millimetre. The reach column separates the styles purely by
whether the repertoire contains a leg.

That is asserted, so a future change that quietly makes reach pose-dependent
again has to argue with the gate first.
