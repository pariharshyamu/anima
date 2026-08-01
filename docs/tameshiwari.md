# The tameshiwari handshake

Two libraries, one physics, **neither importing the other**.

```
npm run tameshiwari
```

---

## What each side derives, alone

**ANIMA** derives what a strike arrives with from Dempster's segment mass
fractions and a measured surface velocity. It has never heard of a board.

**SCENA** derives what a board takes to break from the Wood Handbook, ASTM
D245 visual grading, and three-point beam bending. It has never heard of a
fist.

Both were built months apart for their own reasons. Both happen to produce
numbers in SI units. So they can be put side by side — and either they agree
about the world or **one of them is wrong about physics rather than about an
API**, which is a far better kind of bug to have.

```
ANIMA says a strike arrives with          SCENA says a board takes
----------------------------------------------------------------
jab           16.0 J   10.2 kg·m/s   pine        4.10 kN    1.9 J
cross         77.9 J   30.3 kg·m/s   poplar      6.90 kN    4.4 J
hook          43.2 J   17.6 kg·m/s   cedar       5.12 kN    3.4 J
uppercut      57.8 J   22.3 kg·m/s   oak        10.14 kN    8.4 J
overhand      79.3 J   22.1 kg·m/s   pineWet     3.42 kN    1.7 J
hammerfist   112.6 J   23.8 kg·m/s
roundhouse   800.3 J  101.3 kg·m/s
```

---

## What it settled, which was not what it was written to check

This gate was written to ask "does the hammerfist break the board". The answer
turned out to be that **the question was in the wrong units**.

> **The lightest strike in the library clears the dearest board 1.9× over, on
> energy. The heaviest clears a pine board by 425×.**

A jab carries 16 J. A pine board needs 1.9 J. Every strike ANIMA can measure
carries between ten and four hundred times the energy a board needs — so an
energy criterion says everything breaks everything, which is not what happens
in a dojo.

**What a person runs out of is force, in the first millimetre.** That is why
SCENA states its threshold in newtons and why `createBoard().strike()` takes
newtons, and it is a conclusion neither library could have reached alone.

---

## The piece that is still missing, stated plainly

To finish the comparison — *does this particular strike break this particular
board* — one number is needed that **neither library measures**: how compliant
a fist is.

The force in a collision depends on the contact stiffness of both bodies. SCENA
knows the board's (`force / deflection`, both derived). ANIMA knows the mass and
the speed. Nobody knows the hand's.

That could be invented. It has not been, because inventing it is exactly the
thing this project spends its gates refusing to do — and because the honest
version of the result is more interesting than the fudged one. A demonstration
that broke boards convincingly would be a demonstration of a number somebody
made up.

---

## What is checked

- **Both sides are in SI.** `E = ½mv²` and `J = mv` on one side against
  `F = 2σbd²/3L` on the other, each verified against its own formula from
  outside its own repository.
- **The derivation still matches 1979.** Feld, McNair and Wilk measured a
  30 × 15 × 2.5 cm pine board at about **3.1 kN** in *Scientific American*.
  SCENA says **3.62 kN** — 17% out, nothing fitted. Checked from a second
  repository, because a number only its own tests believe is a number nobody
  has checked.
- **The energy margin.** If the lightest strike ever stops clearing the dearest
  board, one of the two libraries has moved by an order of magnitude and
  somebody should find out which.
- **Both orderings hold** against their own sources: five timbers ordered by
  modulus of rupture, fourteen strikes ordered by how much of the body is
  behind them.
- **Spacers are a force argument.** A glued stack of six takes **36× the force**
  and *exactly the same energy* — which is the algebra's answer, not
  intuition's.

Mutation-tested: drop SCENA's ASTM strength ratio and the energy margin
inverts; make the breaking force linear in thickness instead of quadratic and
the units check catches it before anything else runs.
