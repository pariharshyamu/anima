# The armour handshake

Two libraries, one physics, **neither importing the other** — and the one that
finishes.

```
npm run armour
```

---

## Why tameshiwari could not finish

[The first handshake](./tameshiwari.md) put ANIMA's strikes beside SCENA's
boards and found that every strike in the library carries ten to four hundred
times the energy a board needs. An energy criterion says everything breaks
everything, which is not what happens in a dojo.

To settle it properly needed one number neither library had: **how compliant a
fist is**. That was never invented, and the gate says so.

## Why this one does

A plate does not fail by bending to a stress. It fails when a hole has been
opened all the way through it, and the work that takes is the metal's
indentation pressure over **the point's own frontal area**, through the
thickness.

So what the comparison needs is not a compliance. It is a **contact diameter** —
and a contact diameter is a ruler measurement. ANIMA has had one since
[`Cut`](./cut.md): `tipArea` is πr², and a bodkin is 9 mm.

---

## What the finished half settles

The energy required goes as the **square** of the contact diameter.

```
contact        needed to hole 2 mm of wrought iron
  bodkin         9 mm       76 J
  spear point   20 mm      377 J
  sword tip     30 mm      848 J
  fist          60 mm     3393 J
  foot         100 mm     9425 J
```

```
compound arrow     75 J behind   9 mm    99% of what it needs
roundhouse kick   800 J behind 100 mm     8% of what it needs
```

> **The kick carries eleven times the arrow's energy and is twelve times
> further from getting through.**

Comparing joules to joules would have said the opposite — and that is exactly
the mistake the tameshiwari gate was left unable to rule out.

---

## What each side derives, alone

```
ANIMA says a shot arrives with        SCENA says a plate takes
----------------------------------------------------------------
longbow      25.5 J                   1mm wroughtIron       38.2 J
recurve      35.1 J                   1mm mediumCarbon      76.3 J
compound     75.3 J                   1mm hardened         209.9 J
horsebow     36.8 J                   2mm wroughtIron       76.3 J
crossbow     42.4 J                   2mm mediumCarbon     152.7 J
                                      2mm hardened         419.9 J
                                      mail, one ring         3.05 J
```

ANIMA derives an arrow's energy from a bow's peak force, draw length, storage
fraction and efficiency, and has never heard of a plate. SCENA derives a plate's
from Tabor's indentation relation and a ruler, and has never heard of an arrow.
Both happen to produce joules.

Nothing in the library defeats 2 mm of steel. That is the historical answer.

---

## And the half that still does not finish

```
one riveted ring     3.05 J
20 layers of linen   2.2 J     ← from ANIMA's fracture toughness of linen
together             5.2 J     against a measured 120 J
```

Alan Williams measured mail over padding at about **120 J**. The two mechanisms
these libraries can derive between them come to **five**.

The first draft of this gate asserted that the padding is what stops the arrow —
it is the standard explanation, and mail's three joules seem to demand it. The
derivation came back at 2.2 J and **the assertion failed**. It was the assertion
that was wrong.

What stops an arrow in a gambeson is not the textile being *cut*. It is the
textile stretching, dragging on the shaft, and spreading the load over a hand's
breadth. None of those is a fracture toughness, none is in either package, and
none has been invented for the occasion.

> So this gate finishes one half and **names the missing number in the other** —
> and it is not the number tameshiwari lacked. That is progress of a kind a gate
> can record.

---

## What is checked

- **Both sides in SI**, and each side's own claim verified from the other
  repository: SCENA's `p = 3σ_y` against ANIMA's `tipArea`, and ANIMA's `½mv²`
  against `peak × draw × storage × efficiency`.
- **The quadratic**, exactly: a foot needs `(100/9)²` times a bodkin.
- **The whole cross-product** of five bows against six alloys at two thicknesses,
  with no bow ever failing a thin plate and beating a thick one.
- **The prop takes joules**, and holes only at or above its own threshold.
- **The units deliberately differ.** Plate energy is linear in thickness and
  plate *force* does not depend on thickness at all — which is what makes it
  indentation rather than bending.

Mutation-tested four ways against the resolved build: drop Tabor's factor, put
the force on the perimeter instead of the frontal area, take the energy over a
fixed stroke instead of the thickness, make a mail ring a hundred times stronger.
All four die.

All four *survived* the first attempt, because ANIMA resolves `scena3d` from
`node_modules` and mutating SCENA's source changed nothing the gate could see. A
cross-repository mutation test has to mutate the artefact that is actually
imported.
