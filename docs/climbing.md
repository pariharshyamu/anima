# Climbing

Climbing a ladder is the one thing in ANIMA where the *whole body* is a
contact problem. A walk can be a little wrong and read fine; a climb that is a
little wrong reads as a man being dragged up a ladder by a wire.

```ts
import { Climb, createClimbClip, measureClimbContact } from 'anima3d';

const climb = new Climb(rig, loco);
climb.start(ladder);                 // SCENA's createLadder fits structurally
game.onUpdate((t) => climb.update(t.delta));
climb.onState((s) => { if (s === 'done') walkOn(); });
```

## Three points of contact

Four beats, one limb at a time, one rung per cycle:

```
  beat 0   left hand  up a rung
  beat 1   right foot up a rung
  beat 2   right hand up a rung
  beat 3   left foot  up a rung
```

At every instant exactly one limb is moving and the other three are holding
on. That is the rule painted on every ladder in the world, and it is why the
sequence is four beats rather than two. The order is **contralateral** — a
hand followed by the opposite foot — the same cross-body pattern as walking,
for the same reason: it keeps the climber's mass over the supporting triangle.

## Why the hands do not slide

A limb's height is `(advance − p) × rungSpacing` from its rung, where
`advance` steps 0→1 during that limb's beat and `p` is the body's rise through
the cycle.

Subtracting the body's rise is the whole trick. While a limb is *not* on its
beat the two terms cancel, so its **world position does not change at all** —
which is what holding a rung means. The clip loops seamlessly for the same
reason: one rung of advance minus one rung of rise is zero.

## Why the limbs are solved rather than posed

Hands are placed on rungs by two-link IK against the rig's own arm lengths,
and feet likewise. A seeded ANIMA body can be 1.5 m or 1.9 m tall with its own
proportions, and angles that put one character's hands on the rungs put
another's through them.

Two details that only appear once you solve rather than pose:

- A bone's quaternion is relative to its **parent**, and the solve works in
  the rig's space. Skip the conversion and a limb inherits the torso's lean a
  second time — measured as the foot sliding 2.5 mm a frame *along* the rung.
- Feet go on **whole rungs**, so the rung index is an integer, and rounding to
  the nearest one can land half a rung out. On a 1.67 m body that was the
  difference between a comfortable stance and a leg locked straight. The clip
  now tries both neighbouring rungs and stands on whichever leaves more bend
  in the knee — which is what a person does without thinking about it.

Standoff is not cosmetic either. An arm is a fixed length, so every centimetre
spent standing back from the ladder comes off the vertical reach: at 0.24 m the
grip lands 0.04 m above the head bone, at 0.20 m it lands 0.15 m above it.
Climbers hold ladders close for exactly that reason.

## The gate — `npm run climb`

The hand-and-rung sibling of [`npm run skate`](skate.md), and it exists for the
same reason: a limb that slides while it is supposed to be gripping is
invisible in a still frame and unmistakable in motion.

```ts
const report = measureClimbContact(rig, { rungSpacing: 0.3 });
```

| | |
|---|---|
| `handSlip` / `footSlip` | **peak** deviation from the rung being gripped, not summed path length |
| `overlap` | fraction of the cycle with more than one limb moving. Three points of contact means 0 |
| `stretch` | worst limb extension. 1.0 is the solve saying "I could not reach that" by clamping |
| `overhead` | how far the highest grip reaches above the head bone |

Swept over ten seeded bodies × four rung spacings. Worst measured: **1.5 mm**
of grip slip, **0** overlap, **0.94** extension, **0.14 m** of overhead.

`handSlip` is a peak and not a sum on purpose. Interpolating between keyframes
leaves a limb jittering a fraction of a millimetre either side of its rung;
sum that over 200 frames and it reads as 19 mm of "slip" for a hand that never
goes anywhere. Peak deviation tells a wobble from a slide.

`stretch` earns its place separately: a limb at full extension is not on its
rung and **does not slip either** — it just hangs short of where it claims to
be. Nothing else in the report can see it, and it was at 0.999 on the shortest
body before the rung choice was fixed.

## What this replaced

The previous loop claimed contralateral movement and three points of contact
in its own doc comment, and did neither. Measured:

| | before | after |
|---|---|---|
| grip slip, per cycle | 0.367 m | 0.0015 m |
| cycle with >1 limb moving | 0.604 | 0 |
| left/right leg pose difference | 0.0025 m — a bunny-hop | alternating |
| peak hand height vs the head | below it | 0.14 m above |

The arms were the clearest tell. The rig rests in a T-pose, so a raised arm is
a `Z` rotation of one sign — and the clip used the other, holding the arms out
sideways between 20° below and 4° above horizontal. The `[X, …]` term on the
upper arm rotated the bone about its own axis: a pure twist that moved the
hand nowhere at all.

None of it was visible in a screenshot. All of it was visible the moment
anything measured a hand.
