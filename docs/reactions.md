# Reactions: the body showing what the numbers did

GAMA's `Health` decides that a hit landed, what it cost, and when the
lights go out. `Reactions` is the character *displaying* it: the
directional flinch, the heavier stagger, the crumple-and-kneel
knockout, the get-up, and the two match-end postures. Kept in the
trilogy's wholesome register — a knockout is a fold to the knees and a
slump, not a ragdoll.

```ts
import { Reactions } from 'anima3d';

const reactions = new Reactions(rig);

// GAMA events in, body language out:
const health = new Health({
  onDamage: (e) => reactions.flinch(e.from, e.amount),
  onDeath:  () => reactions.knockOut(),
  onRevive: () => reactions.getUp(),
});

// per frame — THE ORDER MATTERS:
loco.update(dt);
reactions.update(dt);
```

## The repertoire

- **`flinch(from?, power?)`** — a quick recoil *away from the blow*.
  `from` is world-space (the damage event's `from`); the reaction works
  out the local recoil for itself given where the character is facing.
  The head whips a little further than the torso — that lag is what
  makes a recoil read as involuntary.
- **`stagger(from?, power?)`** — the heavy hit: longer, larger, with a
  hip sway off axis.
- **`knockOut()` / `getUp()`** — the fold to kneeling height and the
  rise. The fold is a *state*, not an envelope: it holds until told
  otherwise, and while down, flinches and celebrations are refused —
  the floor has already won.
- **`celebrate(duration?)`** — both arms thrown up (not raised
  politely), a little hop, chin up. The boundary four, the finish line.
- **`dejected(duration?)`** — shoulders forward, head down, a slow
  droop that holds before releasing. The other kind of result.

## How it applies — and why that's safe

Reactions is a **post-processor**, the same discipline as foot IK: the
locomotion writes the pose, then reactions bend the result. Nothing
touches the mixer, so a flinch layers over a walk, a run, or a held
pose without negotiating with any of them.

The subtle part is bones the mixer *doesn't* write. An idle gait may
never track the knees — so a naive post-multiply would accumulate on
them forever, and the first knockout would never fully stand back up
(ours didn't, until the test caught it). The fix is capture-and-restore:
each frame records what every touched bone held before and after the
edit; next frame, a bone still holding *exactly* the post-edit value
was not rewritten by the mixer, and the pre-edit value goes back before
new work. Tracked bones get the mixer's fresh pose; untracked bones
never drift.

## The whole loop

```ts
// GAMA delivers, ANIMA displays, SCENA decorates, the HUD narrates:
const shots = new Projectiles({
  onHit: ({ at }) => {
    const e = health.damage({ from: at, knockback: 3 }, chest);
    if (!e) return;                     // i-frames said no
    fx.burst('sparks', at);             // scena
    sounds.impact('soft', 0.7, { at }); // gama Soundboard
    hud.hearts(health.current, 5);
  },
});
```

The playground's *Dodgeball* example runs this loop end to end — and
its development history is a free lesson: the first draft centred the
victim's hitbox on the object origin, which is at the *feet*, so every
chest-high throw missed by half a metre. A hitbox lives where the body
is, not where the transform is.
