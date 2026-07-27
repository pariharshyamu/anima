# Yoga — the held frame

Yoga is the anti-dance. Everything in `Dance` is a function of count: the clock is a tempo, energy arrives off the bass, and the interest lives *between* the beats. An asana inverts all three. The clock is **breath** — ten times slower than any dance, and a sine rather than a tick: breath has no beat edge, it has a turning point. The content is the pose itself, **held**; the transitions are connective tissue. And the energy is inward — nothing arrives from outside at all.

```js
import { createHumanoid, Asana } from 'anima3d';

const rig = createHumanoid({ seed: 900 });
const asana = new Asana(rig, { seed: 7 });
asana.strike('downwardDog');

game.onUpdate((t) => asana.update(t.delta));
```

## The repertoire

Fifteen asanas, each a named `AsanaSpec` in the exported `ASANAS` table (with `ASANA_NAMES` alongside): the eight distinct positions of the sun salutation — `mountain`, `prayer`, `upwardSalute`, `forwardFold`, `lowLunge`, `plank`, `eightLimbed`, `cobra`, `downwardDog` — plus `tree`, `warrior2`, `triangle`, `child`, `lotus` and `corpse`. Every spec carries its classical name (`ASANAS.tree.sanskrit === 'Vrikshasana'`).

A spec is data, not code: per-bone rotations, a **root** (hip height as a fraction of standing, and a whole-body pitch), and a `support` tag. You can author your own and hand it anywhere a name goes.

## A pose is one frame, held alive

A held pose with literally zero motion reads as a mannequin glitch. Real holding has three small signals, and they are the whole craft of this module:

- **the settle** — the chase toward a struck pose is exponential: the first second does most of the work and the last five percent takes its own time, the way weight actually arrives in a shape. `settled` reports when the body has found the pose to a whisper.
- **the breath** — the chest lifts and the shoulders rise on a slow sine (default six breaths a minute; set `breathsPerMinute`), and the whole body bobs millimetres with it. Poses breathe into different places: cobra into the chest, child's pose into the back, savasana into the belly — each spec says where.
- **the sway** — balance is a verb. Seeded, slow, sum-of-sines corrections run through the hips: small on two feet, **three times larger on one** (tree pose visibly works for its stillness), and absent entirely lying down, because a body on the floor has nothing to balance.

Every `Asana` gets a seeded sway personality — phases and a size of its own — so a room full of holders is a class, not an array of clones.

## The root is part of the pose

Standing poses never leave the feet, but most of a sun salutation lives on the floor: folds, lunges, planks, prone backbends, the inverted V. So the spec owns the **root** as well as the bones, and every pose declares what holds it up:

| `support` | poses |
| --- | --- |
| `feet` | mountain, prayer, upwardSalute, forwardFold, lowLunge, tree, warrior2, triangle |
| `handsFeet` | plank, downwardDog |
| `kneeling` | eightLimbed, child |
| `seated` | lotus |
| `prone` / `supine` | cobra / corpse |

The support tag is a floor-contact *contract*, tested as one: every shipped pose keeps every bone out of the floor and its declared supports on it. This is the library's first floor-support machinery — flows, floorwork and breaking's downrock will all stand on it.

## The breath turns, and you can hear them

`onBreath` fires at the cycle's two turning points — `'inhale'` at the bottom, `'exhale'` at the top. Those are the moments a flow steps on (fold on the exhale, cobra on the inhale), so a hand-rolled sun salutation is four lines:

```js
const SURYA = ['prayer', 'upwardSalute', 'forwardFold', 'lowLunge',
  'plank', 'eightLimbed', 'cobra', 'downwardDog',
  'lowLunge', 'forwardFold', 'upwardSalute', 'prayer'];
let step = 0;
asana.strike(SURYA[0]);
asana.onBreath(() => asana.strike(SURYA[step = (step + 1) % SURYA.length]));
```

Strikes flow from wherever the body is — the chase is exponential, so nothing snaps, mid-transition strikes included. `release()` eases home to whatever the body was doing before the first strike.

## `strikePose` — the single-frame API

Not every posed body needs a clock:

```js
import { strikePose } from 'anima3d';

strikePose(rig, 'tree');   // the rig IS the pose when this returns
```

No easing, no breath, no updates — for screenshots, thumbnails, character selects, and statues: pose a rig, paint it stone, park it on a pedestal, and a SCENA garden has a Vrikshasana statue without either library importing the other.

## API

```js
const asana = new Asana(rig, {
  seed: 7,                 // sway personality + breath offset
  breathsPerMinute: 6,     // the clock
  settle: 2.2,             // seconds for the fast part of the chase
});

asana.strike('tree');      // take a pose (first strike remembers home)
asana.release();           // ease home
asana.update(dt);          // one tick of the practice

asana.pose;                // 'tree'
asana.holding;             // true between strike() and release()
asana.settled;             // found the pose, to a whisper
asana.breath;              // 0..1 — inhale first half, exhale second
const off = asana.onBreath((side) => {});   // 'inhale' | 'exhale'
```

See the **yoga** playground example for the full scene: a rank of holders breathing on their own clocks, a lead practitioner breathing through the sun salutation, and a struck stone statue that never updates at all.
