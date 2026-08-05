# Javelin

The object whose rules were changed to make it fly worse — and how much of that
comes out of the geometry.

```
npm run javelin
```

---

## The experiment

On 1 April 1986 the IAAF moved the men's javelin's centre of mass **four
centimetres forward**. Uwe Hohn had thrown 104.80 m two years earlier — still
the only throw past a hundred metres there has ever been — javelins were landing
flat and sliding, and the new specification was written to bring them down
nose-first and take about **ten percent** off the distances.

`shiftBalance` runs that as a **one-variable** experiment, which the real change
was not:

```ts
import { BLADES, shiftBalance, aeroOf, flyJavelin } from 'anima3d';

const now = aeroOf(BLADES.javelin);
const old = aeroOf(shiftBalance(BLADES.javelin, -0.04));
```

Mass moves *within* the javelin, from one segment to another, so the weight, the
external shape, the volume, the planform, the wetted area and every drag term
are bit-identical. The only difference in the universe is where the mass sits.

---

## What comes out of the geometry

```
speed  angle  attack |    new      old    cost | vacuum   surplus  |  landing attitude
28 m/s   32°     0°  |   77.0    78.4   1.7% |  74.6     5.1%  |  50.9° against 47.7°
30 m/s   32°     0°  |   87.4    89.0   1.8% |  85.2     4.4%  |  51.4° against 48.7°
30 m/s   36°     0°  |   90.1    91.4   1.5% |  89.7     2.0%  |  58.0° against 57.0°
32 m/s   32°     0°  |   98.3   100.3   1.9% |  96.6     3.8%  |  51.5° against 48.9°
32 m/s   40°     0°  |  102.5   103.6   1.0% | 104.9    -1.2%  |  62.4° against 64.0°
```

- **All 27 releases**: the pre-1986 javelin flies further.
- **All 27**: it holds a larger angle of attack — it is the less stable one, so
  it under-follows the descending flight path and keeps making lift.
- **All 18 at 32–36°**: it lands *flatter*, which is the thing the rule was
  written to stop.

Nothing was told which way the rule went, or that there was a rule. The static
margin moved by `0.04 / 2.6` and everything else followed.

### ...and one place it reverses

At 40° the landing-attitude ordering flips, in all nine cases. Up there the
surplus over a cannonball has gone **negative** — drag beats lift — and both
javelins are simply falling along the same steep path. That reversal is asserted
too, because claiming "all twenty-seven" would have been claiming something
false.

---

## What does not come out

> The cost is **1.3%**. The rule was worth about **10%**.

And the reason is visible in the same table: this flight beats a cannonball by
1–5%, where real throws beat one by 10–17%. **The model's total lift is about a
quarter of the real thing.**

Allen–Perkins crossflow theory under-predicts a javelin, which is why published
javelin aerodynamics uses wind-tunnel coefficient tables. Those are not in this
library and have not been invented for the occasion — the 1986 rule change is
the external check, and fitting a lift coefficient until it reproduced 10% would
delete the only falsifiable thing in the file.

The gate therefore budgets the shortfall from **both** sides: the cost must
exceed 0.3%, and it must stay under 4%. If it ever reaches ten, either somebody
found a measured lift curve or somebody fitted one.

---

## The model

Three degrees of freedom: two of position and one of pitch. The pitch is the
whole story.

```
α = θ − atan2(vy, vx)          attitude minus flight path
```

| | |
|---|---|
| **Munk moment** | `q·V·sin(2α)`, a pure couple from potential flow, **destabilising**. Munk 1924, for airship hulls |
| **Crossflow** | `q·C_dc·A_plan·α│α│` at the planform centroid. Allen & Perkins 1951 |
| **Skin friction** | `q·C_f·A_wet` — a slender body's drag is its sides, not its nose |

Three published coefficients: the density of air, the crossflow drag of a
circular cylinder (1.2), and a turbulent flat-plate friction coefficient
(0.004). Every geometric input — mass, balance, inertia about the balance,
enclosed volume, planform, wetted area — is a sum over the same segment table
that says a javelin weighs 808 g.

### The static margin

```
(x_cm − x_cp) / L
```

Measured from the centre of *pressure* toward the tip, because a javelin flies
point-first: the mass has to be ahead of the pressure, the same way an arrow's is
ahead of its fletching. Modern javelin: **+8.70%**. Pre-1986: **+7.16%**.

---

## The bug that made this file

The pitching moment is `M = N·(x_cp − x_cm)`. I wrote `−N·(…)`.

That makes the moment **divergent** instead of restoring, and it did not look
like a crash. The javelin tumbled through 180° of angle of attack, wound its
pitch past 464°, and landed at 44 m — *half what a cannonball manages* — and the
function returned a perfectly well-formed report about it.

The gate now asserts three things that a divergent moment cannot satisfy: the
peak angle of attack stays under 45°, the range beats the vacuum trajectory, and
the thing arrives point-first.

---

## What is checked

- **`shiftBalance` is one variable.** Mass preserved to 1e-12, balance moved by
  exactly what was asked, and volume/planform/wetted/centre-of-pressure
  unchanged to 1e-15.
- **The wetted area is exactly π times the planform**, because the body is round.
- **The vacuum range is `v²sin2θ/g`**, closed form.
- **The drag is reported**, and it is 4–6% of weight. A drag term computed on
  the wrong area does not announce itself — swap wetted-area skin friction for
  bluff-body drag on the frontal area and the flight still looks like a flight,
  every ordering survives, and the range moves by two metres. Only the force
  shows it.
- **The timestep is not the answer.** Halving it moves the range under 0.5%.

Mutation-tested seven ways: invert the pitching moment, flip the static-margin
convention, drop the Munk moment, make crossflow linear in α, make
`shiftBalance` add mass instead of moving it, inflate the enclosed volume, and
compute drag on the frontal area. All seven die.

The last two of those survived their first attempt. The drag one survived
because the report recomputed the drag instead of reading what the integrator
used — **the second time in two releases** that a recomputed value hid a mutant,
after the same mistake in [`bind`](./bind.md). It is now a closure with one
definition, used by both.
