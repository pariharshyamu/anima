# Grappling

Where a throw is a **consequence of the balance**, not a cutscene.

```ts
import { createHumanoid, Grappling } from 'anima3d';

const throwing = new Grappling(tori, uke, { skill: 0.8 });

throwing.onThrow((e) => {
  if (!e.completed) console.log('failed:', e.failed); // 'noGrip' | 'notBroken'
});
throwing.onLand((l) => health.damage(l.toTorso)); // kg·m/s

throwing.attempt('oGoshi');
```

Eight throws: `osotoGari`, `oGoshi`, `seoiNage`, `uchiMata`, `haraiGoshi`,
`taiOtoshi`, `footSweep`, `doubleLeg`.

---

## Kuzushi already had a definition, and the library was already measuring it

Judo names the three things a throw is made of — **kuzushi** break the balance,
**tsukuri** fit in underneath it, **kake** finish — and the first one has an
exact physical meaning: put their centre of mass outside their base of support.

`stability()`, written for `Striking` to answer a completely different
question, is the margin between the two, in foot lengths, from Dempster's
segment masses. Positive is standing. Negative is going over and has not
noticed yet.

So there is no success chance here, and nowhere one could be added:

```ts
const gripped = this.gripGap <= GRIP_TOLERANCE;
this.broken = this.ukeBalance < 0;
this.completed = gripped && this.broken;
```

Both halves are measurements of the world. A throw attempted on somebody who is
still standing over their own feet does not complete, and the tori is left
committed and out of position — which is what happens to people, and nothing
here had to encode it.

```
                skill 0.35        skill 0.95
  24 attempts   6 landed          24 landed
```

**Both numbers have to be non-zero.** A module where nothing ever fails is a
cutscene; one where nothing ever works is broken.

---

## Breaking a base is a measurement, not a table

```ts
breakEffort(rig, 'back')     // { lean, travel, before, after }
weakestDirection(rig)        // the cheapest of the eight, for this stance
```

`breakEffort` tips the real body a little further each step and watches the
real `stability()` come down. It reports the angle at which it crossed zero and
how far the centre of mass had to travel to get there.

```
direction     tip needed    the centre of mass travels
front          11.8°          184 mm
back            4.6°           70 mm
left           11.8°          182 mm
right          11.8°          182 mm
frontLeft      16.5°          257 mm
frontRight     16.5°          257 mm
backLeft        6.9°          104 mm
backRight       6.9°          104 mm
```

**A body goes over backwards for 4.6° and forwards for 11.8° — a 3.6× spread
on the same person.** Nothing wrote that down. A heel sits 75 mm behind an
ankle and a toe 190 mm in front of it, and the numbers above are those two
distances, read off the feet. Move the feet and they move.

*Happo no kuzushi* — the eight points — is judo's compass and is used as such.
Which of the eight is cheapest is deliberately **not** stated in the module,
because it is a property of a stance rather than of a compass.

---

## The lean is a servo, and it is a whole body

The tori does not compute how far they have to pull. They pull, and the loop
watches the balance come down — because how far is enough depends on how this
particular body happens to be standing.

The tip is three steps and none of them is optional:

1. rotate the pelvis, which takes the whole body with it;
2. translate the pelvis back so **the ankle line has not moved** — otherwise
   the base of support travels with the body and by definition nothing can ever
   be broken;
3. put both feet back on the exact footprints they started on, which the legs
   pay for by bending.

`MAX_LEAN` (0.4 rad, 23° at skill 1) is the one authored number in the module,
and it is authored because nothing in a rig knows how strong anybody's arms
are. Everything the pull *does* from there is measured.

---

## Range is a real constraint

```
grips hold to 520 mm, and not past it
```

The sleeve grip **moves an arm** — a hand on a sleeve draws it in, it does not
wait to be offered one. The lapel does not: a collar is on somebody's chest and
cannot come to you. That asymmetry is what makes engagement distance a real
thing here rather than a decorative one, and past 520 mm the attempt returns
`failed: 'noGrip'` and nobody goes anywhere.

The gap is measured against the cloth every frame while the grip is doing its
work, the same way `climb` gates a hand on a rung.

---

## The landing

```ts
interface Landing {
  height: number;    // how far the centre of mass fell, m
  speed: number;     // sqrt(2gh), m/s
  impulse: number;   // mass x speed, kg·m/s
  breakfall: boolean;
  armFirst: boolean;
  toTorso: number;   // what is left after a breakfall spreads it
}
```

Nothing in there is stored. A centre of mass that falls `h` arrives at
`sqrt(2gh)`, and its momentum is that times a mass `bodyMass` derives from the
body's own height and build.

```
throw        breaks       fall       arrives at    into the torso
osotoGari    backRight     786 mm    248 kg·m/s     94 kg·m/s
oGoshi       front         933 mm    270 kg·m/s    103 kg·m/s
seoiNage     frontRight    880 mm    262 kg·m/s    100 kg·m/s
uchiMata     frontLeft     864 mm    260 kg·m/s     99 kg·m/s
haraiGoshi   frontRight    909 mm    267 kg·m/s    101 kg·m/s
taiOtoshi    frontRight    808 mm    251 kg·m/s     96 kg·m/s
footSweep    left          463 mm    190 kg·m/s     72 kg·m/s
doubleLeg    back          629 mm    222 kg·m/s     84 kg·m/s
```

A hip throw picks somebody up before dropping them; a foot sweep takes a leg
and lets the floor do the rest. **270 against 190 kg·m/s**, and the difference
is a lift measured over an arc rather than a damage number typed into a table.

### A breakfall does not make the fall smaller

It spreads the arrival — over an arm, and over a longer contact. So `impulse`
is the same either way and only `toTorso` moves: **62% comes off it**, and the
fall itself shifts by under 3% (an arm really is 5% of a body, and putting one
out really does move a centre of mass).

And the ordering is *measured*, not assumed. `trackFall` records when the arm
and the torso each actually arrived, and `armFirst` compares two timestamps. An
arm that is late gets no relief, which is exactly what happens to people.

---

## The gate — `npm run grappling`, the tenth

48 attempts, 48 ukemi comparisons and 21 engagement ranges over three bodies.
Mutation-tested: flip the tip axis and the weak line moves to the front; ignore
the balance and a weak pull throws everybody; take away the tori's step and
three throws in eight become impossible; remove the floor and every throw
reports a zero-millimetre fall.

### What it caught

- **A lean that bent only the spine.** It moved 68% of the mass through a short
  lever and got 93 mm out of a full fold, against the 191 mm a body has to
  travel to be over its own toes. It could not break anybody forwards,
  sideways, or over a corner — only straight backwards — and from inside the
  animation it looked like a man being hauled about convincingly.
- **The tip axis the wrong way round**, so every body leaned *away* from the
  direction it was being broken in.
- **A grip measured while the hands were still travelling to it.** Every throw
  in the module reported `noGrip`.
- **A tori who stood still.** A backward break takes the uke's lapel 370 mm
  away from them, and losing it that way meant an *osoto gari* could not be
  landed by anybody, at any skill, on any body. Judo's word for the entry is
  *tsukuri*, and it is a step.
- **A breakfall credited to anybody whose hand ended up near the floor**, which
  after a throw is everybody. `ukemi: false` read as a no-op.
- **A rigid rotation with no floor under it**: a *tai otoshi* reported a
  two-metre fall, because the arc went underground and the clamp lifted the
  whole body back out of it.

### And one in `Striking` rather than here

> **The "fixed" internal timestep was capped but not floored.**

`steps = ceil(dt / FIXED_STEP); step = dt / steps` runs at 1/240 on a fast
frame and 1/120 on a slow one. That is not a fixed step; it is a step that
happens to be small. Five of the eight throws moved by up to **17%** between 30
and 240 fps — and going back to `Striking`, so did five of its fourteen
strikes, a teep by **1.36×**.

`Striking`'s own gate could not see it because it checked *one* strike, and a
cross was one of the three that happened to be stable. Both modules now carry
the leftover so every frame rate integrates on the same lattice, and both gates
check **every** move, exactly, bit for bit.

---

## Ownership

Two rigs is the hard part, and the rule is the one `Mount` uses: whoever is
being moved gives up the bones that are being moved, and gets them back.

| | |
|---|---|
| the tori's arms | taken outright — they are holding a jacket |
| the tori's legs | taken while loading, so the hips can drop without the feet going through the floor |
| the tori's spine/hips | added to, so a `Mood` layer survives the throw |
| the uke's pelvis + legs | taken outright from the moment the pull starts |
| the uke, from `kake` on | taken entirely, object transform included |

`release()` hands both bodies back exactly as they were found — stability, pose
and transform, to 1e-9 — and the tests check it after every throw.
