# Bind

Two blades in contact stop being two objects.

```
npm run bind
```

---

## They become one linkage with a sliding joint

A hand at each end, and a joint in the middle that neither fencer put there.
Everything a fencing manual spends a chapter on is a consequence of where that
joint is.

Each blade is a line through a hand. Two lines cross at one point. The distance
from your hand to it is your lever arm; the distance from theirs is theirs:

```
F_you  = τ_you  / a
F_them = τ_them / b
```

Contact near your own hilt is a short lever and an enormous force. Contact out
near your point is a long lever and almost none. That is the **strong** and the
**weak** of the blade, the oldest idea in the art, and it is `τ = F·r`
rearranged.

```ts
import { measureBind, wind } from 'anima3d';

const mine   = { hand: { x: -0.5, y: 0 }, angle: Math.PI / 6, length: 1.11 };
const theirs = { hand: { x:  0.5, y: 0 }, angle: (5 * Math.PI) / 6, length: 0.89 };

measureBind(mine, theirs, { hands: [2, 1], hilts: [0.25, 0.13] });
// { crossing: { alongA: 0.577, alongB: 0.577, angle: 1.047 },
//   torque: [34, 16], force: [58.9, 27.7], ratio: 2.13, winner: 0,
//   binds: false, sensitivity: [0.667, 0.667] }
```

---

## Two mechanisms, pointing opposite ways

This is what the module is for, because neither half is obvious and the two
halves come from completely unrelated physics.

### Friction says a shallow crossing STICKS

Press across another blade and the force splits normal and tangential in the
ratio `tan θ`. Below `atan(µ)` the tangential part cannot overcome friction and
the blades hold. Steel on steel, µ = 0.2:

```
atan(0.2) = 11.31°
```

A published coefficient run through an arctangent. Nobody picked a threshold.

### Geometry says a shallow crossing is UNSTABLE

Rotate your blade by `dα` and the contact runs along theirs by

```
ds = a · dα / sin θ
```

which is the conditioning of a line intersection, and it diverges as the lines
approach parallel.

```
crossing   grips?     contact runs, per degree (0.5 m lever)
   2.00°   grips        250.1 mm
   5.00°   grips        100.1 mm
  11.31°   slips         44.5 mm
  15.00°   slips         33.7 mm
  30.00°   slips         17.5 mm
  60.00°   slips         10.1 mm
  90.00°   slips          8.7 mm
```

> **A shallow bind grips and will not stay put. A steep bind stays put and will
> not grip.** The steepest crossing that still holds is **5.10×** as twitchy as
> a perpendicular one — which is `1/sin(atan µ)`, two constants that were never
> introduced to each other.

Sweep every degree from 1 to 89 and there is no angle that does both.

---

## The one chosen number, and why it does not matter

`HAND_FORCE` is the only value in the file somebody picked. Everything the gate
asserts is a **ratio** or an **angle**: who wins, by how much, at what crossing,
how fast the contact runs. The force divides out of all of them.

So the gate runs every comparison at that force and again at **ten times** it.
The geometry comes back bit-identical, because no force enters it at all. The
force ratio comes back within four ulps, because demanding that `34/0.577` and
`340/0.577` round the same way is a claim about IEEE 754 rather than about
binds. The contact force — the one thing that *should* move — scales by ten.

A constant that changes nothing is a constant nobody has to defend.

---

## The levers, off the hilts in the blade table

```
arming sword, one hand      80 mm apart    16.0 N·m
longsword, two hands       170 mm apart    34.0 N·m    2.13×
strong against weak     20% vs 80% along the blades →  4.00×
```

A hand does not push a sword, it **turns** one: the heel drives one way and the
fingers the other, and the couple is that force times how far apart they are.
Two hands on a longsword sit 170 mm apart — the hilt from `BLADES.longsword`,
less a palm, because hand *centres* are inset from the ends. That subtraction is
the whole mechanical case for a long grip, and it is 2.13×.

The 4.00× is the same weapon on both sides. Nothing differs but where the
crossing landed.

---

## Winding is what an intersection does

```
turn      A's lever    B's lever    ratio
 -8°         635 mm       475 mm    1.59
 -4°         603 mm       529 mm    1.86
  0°         577 mm       577 mm    2.13
  4°         556 mm       622 mm    2.38
  8°         539 mm       664 mm    2.62
```

Turn one way and the contact walks back toward your hilt and out along theirs,
and your advantage grows monotonically. Turn the other way and it does the
reverse.

Nobody encoded a technique. That is a line being moved and an intersection
moving, and the rate it moves at is the same `a/sin θ` that makes a shallow bind
unstable — checked against the report's own `sensitivity` rather than a fresh
call to the formula, because a formula checked against itself is not checked.

---

## What is checked

- **The crossing, exactly.** Two blades at 45° and 135° from (0,0) and (1,0)
  meet at (0.5, 0.5), each `1/√2` out, at a right angle.
- **Parallel is `null`**, not a very large number — including anti-parallel.
- **170° is 10°.** The acute normalisation is load-bearing for everything below.
- **The friction threshold flips at the arctangent**, to within a thousandth of
  it, and grips at 0° and slips at 90°.
- **The conditioning is `a/sin θ`**, monotone all the way, and proportional to
  the lever arm — so a contact already out at your point is unstable twice over.
- **The winding rate is the reported sensitivity**, measured off a 0.05°
  perturbation.

Mutation-tested eleven ways: invert the conditioning, drop the arctangent,
invert grip and slip, stop folding obtuse crossings, span the whole hilt with
two hands, make the contact force `τ·r`, shift a lever arm by 20 mm, make the
couple quadratic, drop the crossing angle from the report, decide the winner by
torque alone, hand parallel blades a fake crossing. All eleven die.

The tenth of those survived the first draft of the gate. The winding-rate check
recomputed `bindSensitivity` locally instead of reading the report's field, so a
report that dropped the crossing angle entirely walked straight through — a
formula checked against itself.
