# Blade

A weapon is a **mass distribution held in a hand**.

```
npm run blade
```

---

## There is no stat block in this file

No `damage`, no `speed`, no tier, no rarity, and nowhere any of them could go.
A weapon is a list of shapes and what they are made of:

```ts
{ label: 'blade', material: 'steel', from: 0.135, to: 0.95,
  width: [0.048, 0.022], thick: [0.006, 0.0035], fill: 0.55 }
```

Lengths, widths, thicknesses, a material and a cross-section fraction. **There
is not one mass in the table.** Everything a game would want to know is a sum
over it:

| | what it is |
|---|---|
| `bladeMass` | volume × density |
| `balancePoint` | the first moment. The number every arms catalogue quotes |
| `inertia` | the second moment, about whatever point the hand is holding. This is what "fast" and "slow" actually are |
| `percussion` | `I / (m·d)` — why hitting near the guard stings and hitting the sweet spot does not |
| `pendulumPeriod` | `2π√(I/mgd)`, and a thing you can **time on a real sword with a stopwatch** |
| `vibrationNodes` | the first free-free bending mode, at 22.42% from each end |

```ts
import { measureBlade, BLADES, withPommel, inertia } from 'anima3d';

measureBlade('longsword');
// { mass: 1.621, length: 1.21, balance: 0.320, fromCross: 0.070,
//   inertia: 0.2551, percussion: 0.815, sweetSpot: 0.644, period: 1.696 }
```

---

## The check that matters: hand it something with a known answer

`BLADES.rod` is a plain uniform steel bar, one metre, 20 mm square, and it is
**exported** so the checking can be public. Every one of its answers is on a
textbook page:

```
I about the end        m·L²/3         1.04666667  ✓
I about the centre     m·L²/12        0.26166667  ✓
centre of percussion   exactly 2L/3   0.66666667  ✓
period about the end   2π√(2L/3g)     1.63794659  ✓
```

Agreement to the twelfth decimal place, not to a tolerance. A segment sum that
gets a tapered sword subtly wrong gets a uniform rod **exactly** wrong, and
against a closed form there is nowhere for it to hide.

---

## And the check that is harder: hand it a real object

```
weapon         mass   length  balance  I(hand)   sweet   period
--------------------------------------------------------------
rod         3.140 kg  1.00 m   50.0 cm  1.0467    67%  1.638 s
arming      1.138 kg  0.95 m   26.2 cm  0.1290    63%  1.502 s
longsword   1.621 kg  1.21 m   32.0 cm  0.2551    64%  1.696 s
rapier      1.424 kg  1.24 m   24.2 cm  0.1653    67%  1.755 s
sabre       1.006 kg  0.96 m   29.3 cm  0.1260    63%  1.504 s
messer      0.837 kg  0.86 m   35.6 cm  0.1240    63%  1.420 s
spear       1.490 kg  2.30 m  124.4 cm  1.0870    95%  2.438 s
javelin     0.808 kg  2.60 m  159.7 cm  0.3848      —        —
axe         1.791 kg  0.86 m   74.4 cm  0.6941    92%  1.620 s
```

Surviving arming swords weigh 1.0–1.4 kg and balance 8–18 cm ahead of the
cross. Nothing in the table says so; a ruler does, and the sums agree. Four of
the nine entries described the **wrong object** on the first pass — a rapier at
2.6 kg, a javelin at 2.4 kg — and every one of those was a cross-section
described too generously, caught by comparing against what museums weigh.

### The javelin has a rule book

The strongest external check available, because it is not a range that survivors
happen to fall in — it is a rule an object is **disqualified** for breaking.
World Athletics, men's javelin:

```
at least 800 g          derived: 807.9 g
2.60 - 2.70 m           derived: 2.60 m
150 - 160 mm cord       derived: 155 mm, centred on the balance
centre of mass
0.90 - 1.06 m from      derived: 1.003 m
the tip                 — the 1986 rule that shortened the
                          world record by 10% overnight
```

None of those four numbers is typed in. What is typed in is an aluminium tube
with a **1.5 mm wall**, a steel head with a 2.5 mm one, and a ruler. The two
wall thicknesses are the only free numbers in the entry, and they are the same
two a manufacturer has.

---

## What the javelin cost, which was not planned for

Getting it right **broke the sweet spot**, and the breakage was the interesting
part.

The rules put the binding on the centre of mass. `percussion` and
`pendulumPeriod` both divide by the distance from the hand to the balance
point. That distance is now zero, and both diverged.

That is not a numerical guard to add. It is the physics:

> **An object held at its own centre of mass has no restoring torque, no
> pendulum period and no centre of percussion. It does not swing. It is
> thrown** — and the arithmetic says so before anybody does.

So both functions return `Infinity`, which is the limit rather than an error
code, and the javelin is the one row in the table with no period and no sweet
spot. The threshold is a millimetre, and it is a *measurement* tolerance — you
cannot balance a real 2.6 m javelin on a knife edge closer than that.

It also forced a correction. `sweetSpot` was originally the fraction of the way
from the **cross** to the tip, which is meaningless for a pole arm: a spear is
held a third of the way up its own shaft and its cross sits 1.2 m past the
balance point, so the spear read −70 cm of blade and the javelin read 517%. It
is now measured from the **hand** to the tip, which are the two landmarks every
weapon in the table actually has.

---

## The pommel trade, and why the folk version is half of it

A pommel is a counterweight, and "lighter in the hand, slower in the air" turns
out to be **two different inertias** — something only visible with both printed
side by side.

```
+200 g at the butt of a longsword

  balance   32.0 → 28.8 cm     32 mm back toward the hand: it FEELS lighter
  I(hand)   0.2551 → 0.2562    +0.4%   the pommel is ON the pivot: nearly free
  I(free)   0.1764 → 0.1918    +8.7%   and THIS is what "slower" means
  period    1.696 → 1.735 s    longer: d shrinks faster than I grows
```

A pommel is an unusually good bargain: it buys 32 mm of balance for a 0.4%
penalty at the pivot and pays for it in free rotation. Nobody encoded that
trade — it is three sums over one table, pointing three different ways.

---

## What is checked

- **The closed forms, to 1e-12.** `mL²/3`, `mL²/12`, `2L/3`, `2π√(2L/3g)`, and
  the node fraction fed back through `cos(βL)·cosh(βL) = 1`.
- **`fill` is a cross-section, not a fudge.** A tube whose wall meets in the
  middle is a solid bar; a wall-less tube has no mass; the same wall is a
  smaller fraction of a fatter tube.
- **The catalogue windows.** Seven weapons against the mass, length and balance
  ranges surviving examples fall in.
- **The rule book.** Four World Athletics limits, none of them an input.
- **The divergence is continuous.** Walk the pivot in toward the balance and the
  period grows without bound the whole way, and only becomes `Infinity` inside
  the measuring tolerance.
- **The sweet spot is a point on the weapon.** Past the hand, past the cross,
  and no further than the tip — for every entry, pole arms included.

Mutation-tested. Drop the parallel-axis term and the rod's inertia about its end
collapses to its inertia about its centre. Replace the tapered centroid with a
midpoint and the javelin's balance leaves the legal window. Make the shaft solid
instead of a tube and it weighs 1.8 kg. Measure the sweet spot from the cross
again and the identity check catches it — which it did not, the first time the
budget was written as a range, because **a range the number already sits in is
not an assertion**.
