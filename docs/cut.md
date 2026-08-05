# Cut

A hit is a **pressure**, and a pressure is a force over an area.

```
npm run cut
```

---

## The third thing

`Striking` measures what a blow arrives with — an effective mass, a speed, an
impulse. `Blade` measures what the object is — a mass distribution, a width at
every point, a curve. Neither knows what happens when the two meet, because
that needs a third number: **how small an area the force lands on**.

```ts
import { measureCut, measureThrust, TARGETS, EDGES, BLADES, sectionAt } from 'anima3d';

measureThrust({ energy: 60, force: 150, radius: 1e-5, width: 0.02 }, TARGETS.skin);
// { area: 3.1e-10 m², pressure: 4.8e11 Pa, bites: true,
//   toStart: 0.0063 N, toContinue: 60 N, disagreement: 9552 }
```

---

## Two criteria, four orders of magnitude apart

Everybody's intuition about cutting is a **stress** criterion: press until the
pressure reaches the material's strength.

```
F_start = σ · A          20 MPa × π(10 µm)²  =  6.3 milli-newtons
```

Six milli-newtons. The weight of a paperclip. Instrumented knives put the force
to push a sharp blade through human skin in the region of **ten to fifty
newtons**, so the stress criterion is out by four orders of magnitude and it is
the one that is wrong about the world.

What actually costs is making new **surface**. A cut is a crack, a crack has
two faces, and every square metre costs the material's work of fracture:

```
E = R · w · d               w the width of the wound, d how deep
F_keep = dE/dd = R · w      3 kJ/m² × 20 mm  =  60 N
```

> **Sharpness decides whether a cut STARTS. Toughness decides what it COSTS.**
> They are not the same question and they do not have the same answer.

A wound is narrow at entry and widens as the blade goes in, which puts both
ends of the measured band inside one derivation: **12 N** across the first 4 mm
of blade, **60 N** at full width.

---

## What each thing is made of

| | strength σ | toughness R | start (10 µm point) | keep (20 mm wound) |
|---|---|---|---|---|
| skin | 20.0 MPa | 3000 J/m² | 6.3 mN | 60 N |
| muscle | 0.3 MPa | 1000 J/m² | 0.09 mN | 20 N |
| linen | 50.0 MPa | 6000 J/m² | 16 mN | 120 N |
| leather | 25.0 MPa | 10000 J/m² | 7.9 mN | 200 N |
| pine, across grain | 41.4 MPa | 2500 J/m² | 13 mN | 50 N |
| pine, along grain | 3.0 MPa | 229 J/m² | 0.9 mN | 4.6 N |
| mail | 400.0 MPa | 12500 J/m² | 126 mN | 250 N |

**Strength and toughness are independent axes**, and the table exists to show
it. Mail is 16× leather's strength and 1.25× its toughness. Skin is 67× muscle's
strength and 3× its toughness — which is Knight's 1975 finding restated: the
skin is the resistance, and what is under it is not.

Four of the seven toughnesses are **derived**, `R = K²/E`, from a published
fracture toughness and modulus. Skin and muscle are measured directly, because
linear elastic fracture mechanics does not describe them — they are non-linear
and dissipate most of the energy in a process zone far larger than any crack
tip, and `K²/E` there would be arithmetic on an assumption that does not hold.

**Pine is the same timber twice.** Across the grain it costs eleven times what
it costs along it, and that one ratio is the whole argument for a splitting
maul over an axe.

---

## Curvature is a pressure multiplier

A curved edge meets a flat target on a **chord**:

```
L = 2√(2Rδ)
```

Same edge, same 200 N, same leather:

```
straight blade   engages 200 mm   1000 MPa
sabre, R = 0.9 m  engages  85 mm   2357 MPa    2.4× for free
axe,   R = 0.12 m engages  31 mm    108 MPa    on a 30 µm edge
```

Nobody has to be told a sabre is curved. The chord of a circle says it.

And the axe is the honest case: 60× the apex radius of a sword, the shortest
contact in the table, and **still nine times worse on pressure than the sharp
straight sword**. An axe is not a sharp thing. It is a heavy thing — which is
the same mass-at-the-far-end that made it slow to swing in `Blade`.

---

## What this does not know

`cutDepth` returns a **bound**, and it is named one:

```
d ≤ E / (R·w)
```

Every joule into new crack surface, nothing to friction on the blade flanks,
nothing to wedging the two halves apart around a blade that has its own
thickness, nothing to pushing the whole target. For a thin weak target that is
nearly the truth. For a plank it is out by more than an order of magnitude:

> a 113 J hammerfist through a 30 mm blade bounds at **1502 mm into pine**,
> which is not a thing that happens.

Atkins gives the missing terms — a plasticity term and a friction term — and
both need a measurement of how the blade's flanks load the material, which is
not in this library and has not been invented for it. The bound is kept, named,
and asserted **as a bound**, because a number fitted until it looked plausible
would be a number about the fit.

This is the same shape of admission as the [tameshiwari
handshake](./tameshiwari.md), and for the same reason.

---

## What is checked

- **The geometry is closed form.** `2rL`, `πr²`, `2√(2Rδ)`, and four times the
  bite giving exactly twice the chord.
- **`bluntestThatBites` is checked against its own inverse.** It solves
  `σ = F/(2rL)` for `r`; hand its answer back to `measureCut` and the pressure
  lands exactly on the strength, for every target in the table.
- **Pressure falls exactly as 1/r** across all five edge presets — it is a
  division — and somewhere along that list a blade stops cutting, or `EDGES` is
  a list of synonyms.
- **The two criteria stay far apart.** If the disagreement ever drops below
  1000×, somebody has fitted one to the other.
- **The measured band.** 12 N entering and 60 N at full width, against the ten
  to fifty newtons instrumented knives report.

Mutation-tested eleven ways. Halve the edge area, turn a point into a
circumference, make the chord linear in curvature, drop the square from
Griffith, take skin's toughness off the measured band, fudge the stress
criterion up to meet the energy one, quietly fit the bound until pine looks
plausible, straighten the axe bit, lose the factor of two in the inversion,
make the grain stop mattering, let everything bite regardless of pressure. All
eleven die.
