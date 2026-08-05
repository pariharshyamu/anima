# Archery

Where the draw is a **force**, the anchor is a **contact**, and the group is the
only number that matters.

```ts
import { createHumanoid, Archery, quiverOf } from 'anima3d';

const bow = new Archery(rig, {
  style: 'longbow',
  target: butt,          // any Object3D
  arrows: quiver,        // anything Countable-shaped; it empties
  skill: 0.8,
});

bow.onLoose((shot) => projectiles.fire(shot.from, shot.velocity));
game.onUpdate((t) => bow.update(t.delta));
```

Five bows: `longbow`, `recurve`, `compound`, `horsebow`, `crossbow`.

---

## Nothing here is a chosen number

**The arrow's speed comes out of the bow's stored energy.** A bow is a spring;
the area under its force–draw curve is joules, efficiency turns some of that
into the arrow, and the rest is `½mv²` rearranged:

```
speed = sqrt(2 × peak × draw × storage × efficiency / mass)
```

A 170 N (38 lb) longbow at a 0.71 m draw, storing half of peak × draw and
delivering three quarters of it to a 30 g arrow, gives **54.9 m/s**. SCENA's
ammunition table independently declares an arrow's muzzle velocity as **55**.
Neither library imports the other and neither number was copied from the other;
they agree to **0.20%** because they are describing the same object, and
`npm run archery` checks that they still do.

**The elevation comes out of the ballistic solution.** `R = v²·sin(2θ)/g`
inverted, so a distant butt visibly raises the bow arm and a close one does
not — and past `v²/g` the shot is simply not on. `elevationFor` returns `NaN`
there, which is the honest answer: there is no angle that gets you to 400 m
with a longbow.

**The group comes out of the anchor.** An anchor that lands `e` off, with the
bow hand `d` in front of it, tilts the arrow by `e/d` radians, so the miss at
range `R` is `R·e/d`. Five millimetres over a 0.71 m draw is **14 cm at
twenty metres**. That is why archers have an anchor point at all.

---

## Skill is one number, and it moves the whole thing

`skill` scales how far the anchor lands from where it should, and everything
else follows:

| skill | anchor scatter | group at 18 m |
| --- | --- | --- |
| 0.3 | 20.1 mm | 49.5 cm |
| 0.5 | 13.8 mm | 34.1 cm |
| 0.7 | 8.8 mm | 21.9 cm |
| 0.9 | 4.7 mm | 11.8 cm |
| 1.0 | 2.9 mm | 7.3 cm |

Nothing in that table was authored. The anchor miss is seeded and roughly
Gaussian — form error is a sum of many small things, and a flat distribution
puts as many arrows on the edge of the group as in the middle, which is not
what a target face looks like.

---

## The compound is a different machine

Not a re-skin. Its cams flatten the top of the force–draw curve, so it stores
**80%** of peak × draw where a longbow stores 50 — and then **lets off**, so
the archer holds a quarter of the peak instead of all of it.

Both of those fall out of two numbers in the table, and both show:

- **94.3 m/s** against a longbow's 54.9, from the storage alone;
- **68 N** in the fingers against 170, from the let-off — which is why it can
  be aimed for three and a half seconds and a longbow cannot;
- and the same archer at the same skill groups **18.6 cm** with it against
  **30.5 cm** with a longbow, because a bow you can hold still is a bow you can
  anchor consistently.

A crossbow goes further still: it is held by a **catch**, so `holdForce` is
zero, nothing shakes, and the whole discipline of the anchor does not apply. It
gets a stock and a trigger.

---

## The handshake, both ways

SCENA supplies the quiver and the arrow; GAMA flies it. ANIMA decides where it
leaves from and how fast — and nothing imports anything:

```ts
import { createQuiver, ballisticsOf } from 'scena3d';
import { Projectiles } from 'gama3d';

const arrows = createQuiver({ count: 24 });      // Countable
const shots = new Projectiles({ gravity: ballisticsOf('arrow').gravity });

const bow = new Archery(rig, { style: 'longbow', target, arrows });
bow.onLoose((s) => shots.fire(s.from, s.velocity));
```

`Archery` also publishes what a game would want to read rather than apply:

```ts
bow.strain        // 0..1 — hand to GameFeel for a sight that shakes
bow.anchorError   // metres, live
bow.spread        // the group this shot's anchor predicts at the target
bow.reach         // the furthest this bow can throw an arrow at all
```

It owns the arms, only **adds** to the chest, neck and head, and never touches
the hips or the legs — so the stance belongs to whoever set it and a `Mood`
layer still reads on top.

---

## `measureShot` — the gate

`npm run archery` shoots a quiver of all five bows on six bodies — 180
arrows — and holds them to ten budgets.

```
archery: 5 bows, a quiver of each on 6 bodies — 180 arrows
  SCENA agrees      ANIMA derives 54.9 m/s from the draw; SCENA declares 55   0.20% apart
  the anchor        35.3 mm off at full draw            budget 45 mm
  …and it holds     16.7 mm of wander between arrows    budget 25 mm
  the bow arm       5.4 mm of drift at full draw        budget 10 mm
  the group obeys   1.5% between what the anchor predicted and what left the bow
  skill decides it  49.5 cm at skill 0.3 → 7.3 cm at 1.0   (6.8x)
  the let-off       a compound asks 40% of a longbow's hold and groups 18.6 cm against 30.5
  follow-through    every bow, the hand goes BACK at the release
  no pops           31.8 mm per frame                   budget 40 mm
```

**The group check is the good one.** It compares two independent routes to the
same number: the anchor scatter read off the posed rig, and the launch
velocities that actually left the bow. They meet to 1.5%, and if the arrow ever
stops leaving along the line the body is making they will not.

Things this gate caught while it was being written:

- an anchor error measured against the anchor the hand had been **aimed at**
  rather than the one the face has, which reported **zero error** for an archer
  who was all over the place;
- a deflection that applied the anchor error's **magnitude to both axes with a
  sign**, so the arrows grouped four times wider than the anchor that caused
  them;
- a follow-through sampled on the **single frame** the string goes, where the
  tremor is bigger than the travel and the answer is a coin flip;
- a bow hand that was **exactly still**, because it was IK'd to a fixed point —
  true of a post and not of a person holding 170 N at arm's length;
- a drawing hand that reappeared beside the bow the instant the follow-through
  ended, **483 mm on one frame**;
- and the same ending bug one release later: a quiver that emptied snapped the
  hand back to nought on the last frame.

The mutation pass: tripling the deflection fires `GROUP LIES`; making the
anchor scatter independent of skill fires `SKILL IS FLAT`; removing the
compound's let-off fires `NO LET-OFF`; and telling the longbow it stores 70% of
peak × draw fires `DISAGREES` — 18% away from the arrow SCENA has on file.
