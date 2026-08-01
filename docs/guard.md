# Guard

Where defence is **geometry and a stopwatch**, not a dice roll.

```ts
import { createHumanoid, Guard, Striking, canReactTo } from 'anima3d';

const guard = new Guard(defender, { style: 'peekaboo', skill: 0.8 });

striker.onBlow((blow) => {
  const answer = guard.defend(blow);
  if (!answer.stopped) health.damage(answer.through);   // kg·m/s
});
```

Seven guards: `peekaboo`, `philly`, `longGuard`, `highCover`, `lowGuard`,
`crossArm`, `open`.

---

## There is no block chance, and nowhere to put one

Two measurements decide whether a strike arrives.

### 1. Whether a limb was on the line

```ts
coverageOf(rig, 'head')   // fraction of the ways in that are currently blocked
```

Sample every direction a strike could come from, put one out at the end of it,
and ask whether the line back to the target passes through an arm. It is a
measurement of **the pose the body is in right now** — so it answers for a
guard, for a guard mid-parry, for a guard that has just thrown a punch and not
got the hand back yet, and for somebody standing there with their hands down.

```
guard          head     body     legs
peekaboo      36.1%     8.2%    12.8%
philly        29.3%    21.1%    12.8%
longGuard     35.9%    13.2%    12.8%
highCover     31.1%     8.1%    12.8%
lowGuard       5.5%    26.0%    12.8%
crossArm      50.9%     8.8%    12.8%
open           5.7%    16.7%    12.8%
```

**A cross-arm buries the head at 50.9% and a low guard gives it away at 5.5%
— and the low guard takes 26.0% of the body where the cross-arm takes 8.8%.**
That is a trade, made with the same two arms, and neither number is written
down anywhere. Move a hand and both change.

The `open` row exists so the model has something that **must** come out near
zero. A coverage model that flatters a fighter with their hands by their sides
is measuring the body, not the guard.

**Nothing covers the legs.** The spread across all seven guards is 0.0% —
because no boxing guard has ever had a leg in it, and a low kick is answered by
an *action* (lifting the shin into it) rather than by a posture. That is worth
gating so a future guard cannot quietly start claiming otherwise.

### 2. Whether there was time

```ts
reactionTime(skill)        // 350 ms at 0, 180 ms at 1
canReactTo('jab', 1)       // false. For anybody.
```

Simple visual reaction time is about **180 ms** and has been since Donders
measured it in 1868. Choice reaction — several possible signals, and you have
to work out which one arrived — is roughly twice that. `skill` interpolates
between them, and that interval *is* what "reading" somebody means.

Then it is just a race against the wind-up `Striking` already measures:

```
nobody reacts to      jab, cross, uppercut, palmStrike, elbow
an expert reacts to   hook, overhand, backfist, hammerfist, knee,
                      teep, frontKick, roundhouse, sideKick
```

**A jab's 130 ms beats everybody's 180.** Nothing here invented that rule; it
falls out of two numbers that were both already being measured for other
reasons, and it is why the jab is the most thrown punch in boxing.

So a guard defends in two ways with completely different characters: the
**static cover**, which needs no reaction and is on all the time, and the
**active defences** — parry, slip, roll, check — which need triggering and
therefore need the time to be there.

---

## What comes out

```ts
interface Defence {
  stopped: boolean;
  by: 'cover' | 'parry' | 'slip' | 'check' | 'none';
  limb: string;      // which arm took it
  through: number;   // kg·m/s that reached the target
  absorbed: number;  // kg·m/s that went into the limb instead
  reacted: boolean;  // was there time to do anything deliberate?
  coverage: number;
}
```

`through + absorbed` is exactly what was thrown — impulse does not evaporate,
and the tests check it on every guard against every strike. A limb in the way
is not a wall either: the deeper into it the line passes, the more it takes, so
grazing the edge of a glove is not a block and the number does not pretend it
is.

A **slip** is the exception: it moves the target rather than stopping anything,
so it absorbs nothing *and* delivers nothing.

---

## The gate — `npm run guard`, the ninth

Seven guards × three zones × three bodies, plus 28 real exchanges driven
through `Striking`. Mutation-tested: give every guard the peekaboo's hand
positions and *hands down* covers 57.9% of the head; make reaction independent
of skill and a novice starts slipping roundhouses.

### What it caught

- **Limb capsules nearly four times too thick.** Every guard covered 100% of
  everything, including one with its hands by its sides, and the module read as
  though it were working perfectly.
- **The leg zone taken as the midpoint *between* the knees** — a point inside
  the body, which both legs occlude every line to. 100% leg coverage for
  everybody, for the same reason. A limb cannot shield itself.
- **Directions sampled over the whole forward hemisphere**, including straight
  down onto the crown and straight up off the floor. Nothing strikes from
  there, and averaging them in pulled every guard toward the same number.
- **A slip that had already finished by the time the punch landed.** Triggering
  it when the strike was *declared* rather than when it was *seen* is a defence
  260 ms early, and the gate was right to call it.

And one in `Striking` rather than here:

> **The `Blow` was published when the strike FINISHED, not when it LANDED.**

A roundhouse lands at 260 ms and finishes at 520. Anything that has to answer
in real time — a guard deciding whether to slip, a hit reaction, a hit-stop —
was being told a quarter of a second late. It is the difference between a
defence system and a post-mortem. Nothing in `Striking`'s own gate could see
it, because from inside one strike the number was correct either way.

---

## A thing the geometry says without being asked

A strike straight down the centre line into the face is **not** blocked by a
peekaboo. The gloves sit either side of it and a punch down the middle splits
them — which is exactly why fighters are told to keep them together, and
nobody had to encode it.
