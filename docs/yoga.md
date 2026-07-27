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

`onBreath` fires at the cycle's two turning points — `'inhale'` at the bottom, `'exhale'` at the top. Those are the moments a flow steps on. `onPose` fires on every strike, manual or flow-driven.

Strikes flow from wherever the body is — the chase is exponential, so nothing snaps, mid-transition strikes included. `release()` eases home to whatever the body was doing before the first strike.

## Flows — a vinyasa is a list of breaths

A `FlowStep` names an asana **and the half-breath it rides**, because a vinyasa is not a list of poses — it is a list of breaths that happen to have poses attached:

```js
import { SURYA_NAMASKAR } from 'anima3d';

asana.flow(SURYA_NAMASKAR, { loop: true });   // the body breathes it
```

`'inhale'` and `'exhale'` steps strike at the breath's turning points. `'retain'` is **kumbhaka** — the held breath — and strikes *mid* half-breath, riding inside the previous step's air: in the shipped salutation, plank is position five precisely because you inhaled into the lunge and have not let it go yet.

`SURYA_NAMASKAR` is the classical twelve on the Sivananda breath map — exhale into prayer, inhale to salute, exhale to fold, inhale to the lunge, retain into plank, exhale down through eight limbs, inhale the cobra, exhale back into the dog, and the same road home. Eleven turns plus one kumbhaka: **one salutation ≈ 5.5 breaths**, which at the default six breaths a minute is the classical ~55 seconds a round.

A step may also own extra time — `{ asana: 'downwardDog', breath: 'exhale', holdBreaths: 4 }` stays five breaths where the sequence would otherwise move on. A finished non-looping flow stays in its last pose, still holding, still breathing; `clearFlow()` abandons the pointer the same way; `flowStep` reports the position, `-1` outside a flow. The whole salutation is tested floor-honest *through the transitions*, not just at the poses.

## The class — one practice, many bodies

`YogaClass` is `Couple` re-keyed from music to breath: the instructor keeps the clock and the sequence, and the students keep **the instructor's** — a watching-lag late, because that lag is physically what following a class *is*: you see the teacher move, then you move. Each student's own breath clock is surrendered (`slaveTo`); the front of the room outranks the lungs.

```js
import { YogaClass } from 'anima3d';

const cls = new YogaClass(rigs, { seed: 7 });   // rigs[0] teaches
cls.place(0, 0, sunriseBearing);                 // instructor front, rows behind
cls.start();                                     // Surya Namaskar, looped
game.onUpdate((t) => cls.update(t.delta));
```

Imperfection is the realism budget — a room of identical perfect folds screams CGI instantly — so every student draws a seeded practice of their own:

- a **watching lag** (~0.3–0.8 s), different per student, applied to poses *and* breath: each strike at the front rolls back through the room as a wave;
- a **depth** — how much of each pose's upper body they can actually reach. A stiff student's fold simply does not go as deep. Depth never touches the legs or the root, so the floor contract survives every shallow practice (tested);
- their own sway personality, inherited from `Asana`'s seed.

`cls.instructor` and `cls.students` are ordinary `Asana`s — subscribe to `onPose`/`onBreath`, or hand `start()` any `FlowStep[]` instead of the default salutation. `stop()` sends everyone home, latest lag last.

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
