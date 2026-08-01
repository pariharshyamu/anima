# Striking

Where the damage is a **measurement**, not a table.

```ts
import { createHumanoid, Striking } from 'anima3d';

const fighter = new Striking(rig, { target: opponent, skill: 0.8 });

fighter.onBlow((blow) => health.damage(blow.impulse));   // kg·m/s
fighter.throwStrike('cross');
game.onUpdate((t) => fighter.update(t.delta));
```

Fourteen strikes: `jab`, `cross`, `hook`, `uppercut`, `overhand`, `backfist`,
`hammerfist`, `palmStrike`, `elbow`, `knee`, `teep`, `frontKick`, `roundhouse`,
`sideKick`.

---

## One formula, and nothing in it was chosen

A punch in most games is an animation plus a number somebody typed. Here it is
neither:

```
effective mass = Σ mᵢ (vᵢ · n̂)⁺ / (v_surface · n̂)
```

The momentum of the whole body along the strike line, over the speed of the
thing doing the striking. Every term is either an anthropometric fact or read
off the bone transforms while the strike plays:

- **`mᵢ`** — Dempster's segment mass fractions, the table biomechanics has used
  since 1955. Hand 0.6%, forearm 1.6%, upper arm 2.8%; foot 1.45%, shank 4.65%,
  thigh 10.0%; trunk 49.7%. They sum to exactly 1 and the tests check it.
- **`vᵢ`, `v_surface`** — finite differences on world positions, the way
  `measureFootSkate` reads a stride.
- **body mass** — `bmi × height²`, with the BMI anchored at 22.5 (the midpoint
  of the WHO healthy range) and scaled by the rig's own `build²`, because mass
  goes with cross-section. A 1.77 m body comes out at 80.9 kg.

Only what is travelling *into* the target counts (`⁺`). Half a body always
moves the other way in a strike — the pulling hand, the head slipping off the
line, the hips squaring after a side kick — and that momentum is balanced by
the floor, not delivered to anybody.

### What falls out of it

```
strike        reach    kg   %body   m/s   kg·m/s      J   balance
jab          0.497   2.65    4.2%   12.5    33.3    209     0.61
cross        0.585   4.98    7.8%    5.3    26.3     69     0.70
hook         0.393   2.89    4.6%   11.6    33.6    195     0.20
elbow        0.236   2.25    3.5%    7.5    16.3     60     0.68
knee         0.400   5.79    9.2%    4.3    24.9     54     0.27
teep         0.904   6.76   10.7%   12.7    86.2    550     0.38
roundhouse   0.600   6.07    9.6%   16.1    97.8    788    -0.03
sideKick     0.917   6.76   10.7%    9.3    63.0    294     0.12
```

**A cross measures 1.88× a jab. Kicks measure 1.94× punches.** Published
effective-mass figures for a jab are 2–4 kg and for a kick 5–10; this module
chose neither, and neither did anybody writing it.

ANIMA does not compute damage any more than it flies arrows. `Blow` carries
`impulse` in kg·m/s and something upstream decides what that costs — the same
handshake `Archery`'s `Loose` has with a projectile system.

---

## Skill is the kinetic chain

Not a multiplier on anything. `skill` decides how far the pelvis runs ahead of
the fist, and the mass follows from the geometry:

```
skill 0.00   →  2.02 kg     the hip peaks 21 ms AFTER the fist
skill 1.00   →  7.15 kg     the hip peaks 192 ms BEFORE it
```

**3.55×**, and at skill 0 it is a literal arm punch — the distal end arrives
first, which is the definition of one and the commonest failure in fight
animation. Nothing enforces the weakness. It falls out, because the momentum
sum is taken at contact and half the body has already stopped.

### It does not pay everywhere, and that is the interesting part

```
cross      3.55x        hook        1.08x
palmStrike 2.71x        frontKick   1.07x
uppercut   2.23x        knee        1.02x
jab        1.79x        roundhouse  0.99x
```

Skill buys mass on the **straight punches** and essentially nothing on the
kicks or the swings. That is not a gap in the model, it is the model working:

- A straight punch **is** its chain. There is nothing else driving it, which is
  why coaches spend years on the sequence and why it is the first thing that
  separates a boxer from somebody swinging.
- A **leg is 16% of body mass** — three times an arm — and heavy enough that
  the timing of what is behind it barely registers. A bad roundhouse still
  hurts.
- A **hook's** power is its rotation, and the rotation is there whatever order
  it arrives in.

The gate holds the ratio on the four chain-driven punches and prints the others
without gating them.

---

## Balance is the cost of throwing

```ts
stability(rig)   // margin from the centre of mass to the edge of the base,
                 // in foot lengths. 0 is on the edge. Negative is going over.
```

Same segment-mass table as the effective mass — one set of fractions answers
both "how hard did that land" and "is this body about to fall over", and in a
fight those are the same question.

```
a jab         0.61     costs essentially nothing
a hook        0.20
a roundhouse -0.03     the centre of mass leaves the base entirely
```

That is risk and reward with no move table and no recovery frames: a strike is
expensive exactly to the extent that it commits the body, and the number says
by how much.

---

## Reach is geometry

Not a range band. The striking surface can be at most one limb from the joint
it hangs off; the target sits on the body's forward axis at the strike's own
height; solve for how far forward that can be:

```
(R − rootZ)² = limb² − rootX² − (targetY − rootY)²
```

Which is why a head kick reaches less than a body kick off the same leg — the
rise eats the budget — and why a cross out-reaches a jab: turning the trunk
swings the shoulder forward and squares it up, cutting `rootX` and adding to
`rootZ` at once. A tall fighter genuinely out-ranges a short one and nothing
had to be told so.

An elbow and a knee are special: the striking joint sits on a **sphere** of one
segment's radius about its root and cannot be anywhere else, so they have a
single range rather than a reach they can throw short into.

---

## What it owns

The **arms outright**, and the **kicking leg** for the duration of a kick.
Nothing else has anything useful to say about where a fist goes.

The **pelvis, spine, chest and head additively** — giving back last frame's
contribution before applying this one — because a fighter is standing in a
stance somebody else may have put them in and `Mood` may be layered over the
top. `Hips.position` is touched only horizontally, for the weight transfer,
because the ride height belongs to whatever is driving the legs.

`lower()` hands it all back. Between strikes the fighter stands in their guard,
because that is what a fighter does.

---

## The gate — `npm run striking`, the eighth

Five bodies, fourteen strikes, ten claims:

```
a cross outweighs a jab       1.88x   budget 1.20x
kicks outweigh punches        1.94x   budget 1.50x   (9.6% of body mass vs 5.0%)
skill buys mass               3.55x   budget 2.00x   (2.02 -> 7.15 kg on a cross)
...because the chain fires    -21 ms at skill 0 -> +192 ms at skill 1
a jab costs no balance        0.59 against a roundhouse's -0.05
the centre of mass is real    within 0.5% of 56% of stature
the guard stays up            39.9 mm of drift, budget 140 mm
no pops                       85.9 mm worst frame, budget 110 mm
every strike lands            70 of 70
effective mass < body mass    3.5% to 10.7%
```

Mutation-tested: delete the weight transfer and a cross comes out at **0.50×** a
jab; freeze the chain lag and skill buys **1.00×**.

### What it caught

Every one of these was found by reading a number, and not one could have failed
a unit test — in every case the code did what it said and the pose looked
plausible in a still frame.

- **The trunk turned the striking shoulder away from the target.** A cross lost
  157 mm of reach it geometrically had, and fell short.
- **A kick read its own foot as the origin of the path that foot was travelling
  along**, so the path fled ahead of it. 100 m/s.
- **Closest approach was taken over the whole strike** — but a strike passes
  *through* its target, so the return trip crosses the same distance again,
  more slowly and with the body already stopping. Half the time contact was
  recorded on the way back: impulse near zero on a punch that had visibly
  landed.
- **The limb was driven by a smoothstep**, which has zero slope at the end, so
  every strike was stationary at exactly the moment it landed.
- **Arcs were scaled by body height instead of by the path.** A front kick
  detoured 390 mm off its own line and measured 24 m/s.
- **A hook was a straight line with a bulge on it.** Its steepest sideways slope
  landed at contact, so the fist arrived carrying a metre per second that had
  nothing to do with the punch. A hook is a *swing*, and interpolating in
  cylindrical coordinates about the body's own axis is what a swing is.
- **A knee's chamber dipped its path below the hip.** A knee is pinned to a
  sphere, so an off-sphere detour only swings the direction — 140 mm in one
  frame at 240 fps, on a joint that travels 600 mm in total.
- **A front kick chambered with the uppercut's sign**, dropping the foot half a
  metre below its own chord.
- **The arms were taken outright and never given back.** `lower()` was a lie.
- **The idle guard IK'd the lead hand at the world origin**, so a fighter
  between punches stood with one hand by their knee.

And the one worth the whole gate:

> **A trunk rotating about its own vertical axis moves almost no mass, because
> its centre of mass is on that axis.**

Turning the shoulders does not put a body behind a punch. Driving off the back
foot does. Measured, before the weight transfer existed, a cross came out
*lighter* than a jab — the exact opposite of the thing this module exists to
say, and it looked completely fine on screen.

---

## Composing

`Blow.impulse` is the handshake. GAMA's `Health` converts it to damage;
`GameFeel` can derive a hit-stop duration from it rather than choosing one;
SCENA's destructibles can declare what they take to break and meet it in the
middle. `Reactions` handles the hit response — this module does not duplicate
it. `Mood` layers over the top, because the spine is additive.
