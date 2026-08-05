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

## Three questions, not one

Over, down and across are different problems, and the API says so rather than
forcing them through one selector.

```ts
pk.attempt(obstacle, speed);  // over:   'speed-vault' | 'mantle' | … | null
pk.descend(obstacle);         // down:   'absorb' | 'roll' | 'hurt' | null
pk.leap({ edge, width }, speed);  // across: 'gap-jump' | null
```

Going **over** something is a choice between techniques a body may or may not
have. Going **down** off it is not a choice at all — a character who walks off
a roof falls whether or not there is a technique for it — so `descend` reports
what the landing *costs* instead of whether it is allowed. Going **across** a
hole is a question about speed: the same ditch is crossable at a sprint and not
from a standstill, for the same character.

Routing all three through `chooseMove` would mean asking "which move gets me
over this?" about a wall already underfoot, and describing a gap in terms of
`height` and `depth` would be a lie about what is being measured. So a gap is
its own shape:

```ts
interface Gap { edge: Object3D; width: number }
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

The same applies going down and across:

```ts
landingFor(fall, reach);        // 'absorb' | 'roll' | 'hurt'
canClear(width, reach, speed);  // boolean
gapAt(reach, speed);            // how far this body clears, in metres
```

`landingFor`'s thresholds are **leg lengths**, not constants — a long-legged
body has further to travel absorbing the same drop, so it takes more of it
standing. For the two bodies above that is 0.94 m vs 0.89 m before a roll is
needed, and 2.12 m vs 2.00 m before there is no technique left.

`hurt` is returned rather than clamped away, and `descend` plays the drop
anyway. What a fall past technique *costs* is the game's business, not
ANIMA's — the same division of labour as "ANIMA does not raycast".

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

`landing` is the drop on the far side when it differs from `height`, and the
drop is the only move that reads it — because it is the only one for which the
difference is the whole story. Step off a 1.3 m parapet onto ground 1.3 m lower
than the near side and you have fallen 2.6 m, not 1.3.

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
| `penetration` | how far a planted limb sinks below **the surface it is holding** |
| `stretch` | worst limb extension; 1.0 is the solver clamping rather than reaching |
| `snap` | biggest single-frame move of a limb across one ease ramp, as a ratio to that ramp's own median — a teleport is a discontinuity, not a distance |
| coverage | fraction of *reachable* obstacles that got a move |
| landed | how far a drop ends from the ground it fell **to** |
| clearance | how far past the far lip a gap jump ends |

Three sweeps over eight bodies — every height from ankle to past what the body
can mantle, every fall from a kerb to past what any technique survives, and
every gap the body accepts at four approach speeds. **1175 moves.**

| move | cases | worst slip | penetration | stretch | snap |
|---|---|---|---|---|---|
| step | 160 | 0.22 mm | 0.16 mm | 0.926 | 1.83× |
| safety-vault | 52 | 3.76 mm | 2.62 mm | 0.783 | 1.38× |
| speed-vault | 52 | 8.65 mm | 6.52 mm | 0.806 | 1.08× |
| mantle | 406 | 8.25 mm | 3.40 mm | 0.935 | 1.55× |
| drop | 194 | 0.46 mm | 0.35 mm | 0.939 | 1.32× |
| gap-jump | 311 | 9.08 mm | 8.77 mm | 0.957 | 1.79× |

Plus: 100% coverage of reachable obstacles, 0 wrongly accepted; a drop lands
within **68 mm** of the ground it fell to at every height; and every gap the
selector accepts is cleared with at least **240 mm** to spare.

Coverage is split from refusal deliberately. Counting them together buries
both: the sweep runs past what a body can do *on purpose*, and a refusal up
there is the right answer rather than a gap. A selector that says "no" too
readily is caught by no contact number at all — it just leaves characters
standing at knee-high walls.

`landed` and `clearance` exist because a move can hold its feet **perfectly on
holds that are in the wrong place**. Every contact number would stay green
while a character finished a gap jump inside the hole. Both are mutation-tested:
making the drop read `height` instead of the fall puts it 1237 mm out, and
authoring the landing foot 300 mm short of the far lip ends the jump 280 mm
into the gap. Each fires the gate.

## The ease, and why it took four tries to measure

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
across the ease *ramps* only, it read 5.88×, and 0.41.0 shipped a budget of 10.

Both of those numbers were wrong, and building the drop and the gap jump is
what exposed it. Two bugs, both in the **harness** rather than the animation:

- **The mixer was left on `LoopRepeat`.** These clips are one-shots and
  `Parkour` plays them as one-shots, but `clipAction()` defaults to repeating,
  and a repeating action asked for the time at *exactly* the clip's duration
  wraps to zero. So the final sample of every measurement ever taken was the
  move's **first frame**. It read as a 185 mm jump in a foot's last frame on a
  step-up whose real worst frame was 7 mm.
- **A contact's two ease ramps were pooled into one track.** The step from the
  last frame of the ramp *on* to the first frame of the ramp *off* then looks
  consecutive while actually spanning the entire plant between them. For a foot
  held to the end of a gap jump that is a quarter of the move: 282 mm reported
  as a single frame, on a move whose worst real frame was 32 mm.

With both fixed the worst case across every move is **1.83×**, and the budget
is 2.5 — not 1.83 plus a comfortable margin, but a number taken from the
distribution. Over twelve bodies, four of them outside the sweep, `snap` runs
p50 1.54, p90 1.83, p99 1.83, max 1.83: the whole thing sits in a band a third
of a unit wide, because the ratio is a property of the **ease curve** and not
of the body. A metric that does not vary with anatomy does not need anatomical
headroom.

The lesson is the one that keeps recurring: a number that has never been
watched fire is not evidence of health. A budget of 10 could not have failed.

## What is not here yet

Cat leaps onto a hanging lip, drop-rolls (the roll `landingFor` already names —
it needs a pitch axis on the move, which nothing else has yet), wall runs and
tic-tacs, slides, balance. `reachOf` already publishes `catch` for the first.

The [`parkour` playground](?example=parkour) runs two bodies down one course:
they agree about the curb, split at the rail — one vaults, one mantles — split
again at the wall, which the taller clears and the shorter refuses, then jump
the gap and drop off the end.
