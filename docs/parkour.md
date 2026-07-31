# Parkour

Parkour is a contact problem wearing a movement problem's clothes. The
animations are the easy part; making the hand land *on* the wall — not near
it, not inside it — is the whole job.

```ts
import { Parkour, reachOf, chooseMove } from 'anima3d';

const pk = new Parkour(rig, loco);
pk.attempt({ edge: wall.edge, height: 0.85, depth: 0.3 }, agent.speed);
game.onUpdate((t) => { if (pk.busy) pk.update(t.delta); });
```

## Reach comes from the body

Every parkour system in every engine warps authored mocap toward the obstacle.
ANIMA has no mocap — its clips are functions of the rig — and `createHumanoid`
makes bodies with genuinely different proportions. So the move set is derived
from **reach** instead:

```ts
const r = reachOf(rig);
r.step;    // knee height, from the rig's own leg length
r.vault;   // hip
r.mantle;  // shoulder
r.catch;   // fingertips overhead
```

A 1.67 m and a 1.77 m character therefore make **different choices at the same
wall** — one vaults it, the other has to mantle — for free, from one code
path. That is the thing a warping system structurally cannot do.

## The honest `null`

```ts
chooseMove({ height: 2.0, depth: 0.5 }, reach, { speed: 5 });  // null
```

`null` matters as much as the moves. A system that always finds something will
put a character through a wall, and the honest answer to a two-metre wall is
that this person is not getting over it. Measured across eight bodies and 790
obstacles: **100% of reachable obstacles get a move, 120 unreachable ones are
refused, and none is wrongly accepted.**

## The obstacle is a shape, not a package

```ts
interface Obstacle { edge: Object3D; height: number; depth: number; landing?: number }
```

SCENA's railings, crates, walls and parapets satisfy it; so does an object
literal. **ANIMA does not raycast** — finding the obstacle is the game's job,
exactly as terrain height is.

## Why the trajectory is derived, not authored

This is the part that took a rewrite.

The first version authored each body path in absolute metres and then asked
whether the contacts were reachable from it. That is backwards. A vaulter's
shoulder only gets down to an 0.85 m wall by **folding over the planted arm**,
so the reachable set depends on the torso pose, which depends on the phase,
which is the thing being solved for. Standing upright, a 1.77 m body's
shoulder is 0.60 m above that wall and its arm is 0.50 m long: the hand could
not touch the top at all. Contact error ran to **1.1 metres**.

Now each move authors where a body **landmark** should be *relative to the
contact, in units of limb length* — a hand contact anchors the shoulder at
0.78 of an arm, a foot contact anchors the hips at 0.74–0.97 of a leg — and
the root falls out of it, measured from the posed body each frame. Those
fractions **are** the reachability guarantee, and they hold for any body
because they are fractions of that body.

Two details that only show up once you build it this way:

- **The offset must be a radius, not components.** Author the vertical and
  the forward separately and each looks reasonable while their combination
  does not: a shoulder asked for 0.72 of an arm above the hand and 0.40 m past
  it ends up 0.536 m from a 0.496 m arm, and the solver quietly clamps. Moves
  place landmarks on a circle around the contact, which cannot do that.
- **A handover blends roots, not targets.** A mantle changes what holds the
  body up halfway through — hands on the lip, then a foot on the top — and the
  two anchor different landmarks. Converting one landmark's frame into the
  other's is a guess, and the guess cost 462 mm.

## The gate — `npm run parkour`

The third of ANIMA's contact gates, after [`npm run skate`](skate.md) (feet on
ground) and [`npm run climb`](climbing.md) (hands on rungs).

| | |
|---|---|
| `contactSlip` | peak wander of a planted limb from its hold |
| `penetration` | how far any planted limb sinks *below* the top surface |
| `stretch` | worst limb extension; 1.0 is the solver clamping rather than reaching |
| `snap` | biggest single-frame move of a limb across its ease ramps, as a ratio to its own median — a teleport is a discontinuity, not a distance |
| coverage | fraction of *reachable* obstacles that got a move |

Swept over eight bodies × the whole height band each move is chosen for ×
thin/thick × standing/walking/running — 670 moves. Worst measured:

| move | cases | worst slip | penetration | stretch |
|---|---|---|---|---|
| step | 160 | 0.22 mm | 0 | 0.926 |
| safety-vault | 52 | 3.76 mm | 0 | 0.783 |
| speed-vault | 52 | 8.65 mm | 0 | 0.806 |
| mantle | 406 | 8.25 mm | 0 | 0.935 |

Coverage is split from refusal deliberately. Counting them together buries
both: the sweep runs past what a body can do *on purpose*, and a refusal up
there is the right answer rather than a gap. A selector that says "no" too
readily is caught by no contact number at all — it just leaves characters
standing at knee-high walls.

## The ease, and why it took two tries to measure

Limbs blend on and off their holds over ~0.08 of a move so they do not
teleport onto the wall. That used to be ungated — the slip and penetration
numbers only look at frames where a limb is already *planted*, and a limb
that snaps into place arrives correct.

The first attempt measured the biggest single-frame move in metres. That
reads **186 mm/frame for a step-up that is perfectly smooth**, because a limb
swinging onto a hold legitimately moves fast. A teleport is not a distance,
it is a **discontinuity** — so `snap` is a ratio against the limb's own median
step.

The second attempt measured that ratio across the whole contact window and
got **4210×**, because the window includes the long planted stretch where the
limb is deliberately motionless and the median is therefore zero. Measured
across the ease *ramps* only: **5.88× with the ease, 138.90× without it.**

## What is not here yet

Drop landings and rolls, gap jumps, cat leaps onto a hanging lip, wall runs,
slides, balance. `reachOf` already publishes `catch` and `gapAt` for the first
two.

The [`parkour` playground](?example=parkour) runs two bodies down one course:
they agree about the curb, split at the rail — one vaults, one mantles — and
split again at the wall, which the taller clears and the shorter refuses.
