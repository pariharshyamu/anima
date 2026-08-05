# Mood

**An emotion is not a pose.**

Sadness has no keyframe. It is eight degrees of head pitch, a chest that has
stopped opening, shoulders forward, four centimetres off your height and a walk
a third slower — applied to standing, sitting, eating, climbing and fighting
alike. Author it as a clip and you need a sad version of every clip in the
library. Author it as a **layer** and every clip already in the library gets one
for free.

```ts
const mood = new Mood(rig, 'dejected');
game.onUpdate((t) => {
  loco.update(t.delta, velocity.multiplyScalar(mood.pace));
  mood.update(t.delta);
});
```

It is the same machinery [`Cockpit`](characters.md) uses for g-load with a
different input: an additive contribution to eight bones, given back at the top
of every frame before the next one is computed. It rides on top of the pose
that is playing and never replaces it.

## Two axes, not a list of feelings

`valence` (−1 miserable … +1 elated) and `arousal` (0 torpid … 1 keyed up).

A list of named emotions forces you to author their overlaps — `sad`, `tired`,
`defeated` and `bored` are one posture wearing four different faces, and four
separate authorings of it drift apart within a release. **Fear is not a third
axis** either: it is low valence with high arousal, and what falls out — head
down, body narrow, movements fast — is fear.

`MOODS` names thirteen useful corners so nobody has to think in coordinates.
Note what the coordinates say that the names do not: `furious` sits at high
arousal with valence only slightly negative, because rage is not sadness, it is
energy pointed at something — and a system that treats them as one axis makes an
angry character slump.

## What it publishes rather than applies

```ts
mood.pace            // travel-speed multiplier
mood.gestureScale    // amplitude for gestures and mannerisms
mood.mannerismRate   // how often idle noise fires
mood.gazeAuthority   // how much of a LookAt the body will spend
```

It reaches into none of them. A mood that quietly slowed `Locomotion` would
desynchronise the stride from the declared speed and slide the planted foot on
every step — the exact defect [`npm run skate`](skate.md) exists to catch. Mood
describes; the game applies.

The one thing a caller **must** do is scale the travel speed and the clip
together. That is what `pace` is for, and the gate proves it costs nothing:
re-timed for every named mood, the worst foot skate is **0.551%**, which is the
baseline walk's own number. Slowing a body for a mood is free if you tell
locomotion about it and ruinous if you don't.

## The gate — `npm run mood`

The fourth of ANIMA's gates, after `skate`, `climb` and `parkour`. A layer like
this fails in ways nothing else can see: it is not a clip, so no screenshot
shows it wrong, and it has no contacts, so no contact gate covers it.

| | |
|---|---|
| monotone | swept on both axes, 41 samples, no reversals |
| neutral | `neutral` must move the body by **nothing** |
| leak | 3600 frames and 3 mood changes, then `release()` — everything back |
| bone | no mood may **saturate** the layer's own clamp |
| skate | `pace`, re-timed, must not slide the feet |
| stature | the layer has to be visible at all |

Measured:

```
  monotone           valence and arousal, 41 samples each, no reversals
  neutral is nothing 0.00e+0                             budget 1e-6
  gives the body back 6.40e-7 after 3600 frames          budget 1e-6
  worst bone         0.330 rad                           budget 0.38
  pace vs the gait   0.551% foot skate re-timed          budget 1%
  stature swing      38.9 mm across the valence axis     budget 20 mm
```

Four mutations verified firing: removing the give-back (leak 27.7 rad), a
`neutral` that tilts the neck 0.02 rad, a head term made non-monotone, and a
term pushed hard enough to saturate the clamp.

### Two of these budgets were decorations first

**`bone` was budgeted at `MOOD_LIMIT` itself** — which `contribute` clamps to,
so the assertion held by construction and proved nothing. What matters is that
no mood *reaches* the clamp: past saturation every mood looks the same and
monotonicity dies quietly at the top of the axis. Tightened to 0.38, the
saturation mutation fires at exactly 0.420 — a number the original budget would
have passed.

**`skate` modelled re-timing by rebuilding the clips** at `duration / pace`.
That is not re-timing, it is a different clip: `createLocomotionClips` samples
at 30 fps, so a different duration is a different frame count and a slightly
different sampled gait. It reported 0.96% against a 1% budget and was measuring
the resampling. A game sets `timeScale` instead, which leaves the poses
untouched and only changes how long a foot is planted — and modelled that way
the answer is the baseline, exactly as the arithmetic predicts.

## Stature is measured at the spine, not the crown

This took a gate failure to work out. Crown height conflates two facts: an
elated body both stands taller **and** lifts its chin, and lifting the chin arcs
the top of the head backward and *down*. Swept, the crown turns over at valence
0.85, and the gate reported a body that shrank as its mood improved — which was
true of the crown and false of the body.

Head pitch is reported separately. Two facts, two numbers, neither pretending to
be the other.

## What is not here yet

The same layer should carry **fatigue, age, encumbrance, intoxication, injury
and cold** — they are all persistent states that colour whatever the body is
doing, and none of them needs a second mechanism. Facial expression is a
separate problem and is not attempted here: this moves the body, not the face.

The [`mood` playground](?example=mood) walks thirteen identical bodies — same
seed, same clip — and every difference you can see is the layer.
