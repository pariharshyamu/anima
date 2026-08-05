# The conversational floor

```js
import { Dialogue, Floor } from 'anima3d';
```

```
npm run floor
```

`Conversation` in this library gives everyone in a group one gaze rate, with a
`wander` parameter defaulting to 0.3 — so a listener looks at the speaker 70% of
the time, and so does a speaker, and so does everybody. It is a reasonable
number and it is wrong for everybody, because there is no such thing as one
rate.

Adam Kendon sat two people down, filmed them, and counted (*Some functions of
gaze-direction in social interaction*, 1967):

```
    while LISTENING     75% of the time on the other person
    while SPEAKING      40%
```

Nearly twice as much. Talking is expensive — you are planning a sentence — and
looking at a face is expensive too, so speakers buy one with the other. A rig
that splits the difference is not modelling either half.

## Two rates

```js
const you = new Floor({ role: 'listening' });

// every frame
you.update(dt, { role: 'listening' });
you.atPartner;   // true when the eye is on the other person
you.target;      // { yaw, pitch } — hand this to Saccades.look()
```

The away time is not a second parameter. If a look lasts `LOOK_SECONDS` and the
eye is to be on the other person a fraction `p` of the time, the gap between
looks has to be `look × (1 − p) / p` and there is nothing left to pick:

```
    a listener    3s look, 1.00s away
    a speaker     3s look, 4.50s away
```

Pick both by hand and the proportions stop being Kendon's.

## And the ends of utterances are not like the middles

Kendon's second finding is the one that makes gaze a **protocol** rather than a
decoration. A speaker looks away as they begin — the planning load is highest
there — and looks back at the listener as they finish. That terminal gaze is a
turn-yielding signal: when it is absent, the transition to the next speaker is
measurably delayed, because the listener has not been told the floor is free.

```js
you.update(dt, { role: 'speaking', untilEnd, since });
```

`untilEnd` is what makes the signal possible. It is a fact about the speaker's
own plan and not something an observer could have, which is exactly why a
turn-yielding signal exists at all. Leave it out and you get the rate without
the structure.

### The budget is re-allocated, not added to

This is the single easiest thing here to get wrong, and it does not look wrong.
Hold the middle of the utterance at 40%, bolt a second of planning aversion onto
the front and a second of terminal gaze onto the back — both halves defensible
on their own — and the speaker ends up looking at the listener **55%** of the
time. That is not Kendon's finding any more. It is a new one, invented by
accident, and it would survive review.

So the middle supplies whatever the ends did not:

```
    looking = terminal + free-part gaze     must equal     0.40 x total
```

A consequence nobody chose: **the speaker's glances come out shorter than the
listener's.** A five-second turn has three free seconds that must contain one
second of gaze, and a three-second look does not fit in it.

```
    mean glance   listening 2.95s    speaking 1.26s
```

## The part that is a prediction

Kendon's two numbers are about individuals. Put two people together, each
following their own rule, and mutual gaze — both looking at once — falls out as
a third number nobody set:

```js
const talk = new Dialogue();
talk.update(dt);
talk.mutual;   // both looking, this frame
```

```
    0.75 x 0.40 = 0.30
```

Argyle and Ingham (1972), a different laboratory measuring a different thing,
put mutual gaze in a two-person conversation at about 30% of the time. `npm run
floor` measures 28.1% off two agents who have never been told what it should be.
The number 0.30 appears nowhere in `src/floor.ts`.

### And that agreement on its own proves almost nothing

The gate says so, in section 3, because it is the sort of result that is easy to
oversell. Take the one-rate rig this module is arguing against, set its single
rate to the mean of Kendon's two, and mutual gaze comes out at 0.575² = **33%** —
inside anybody's reading of "about 30%". The agreement is real and it does not
discriminate.

What discriminates is the asymmetry, which is Kendon's actual finding and the
thing a single rate cannot produce at any setting:

```
    model      78.7% listening / 40.3% speaking = 1.96x
    control    58.5% / 57.9%                    = 1.01x
    published                                     1.88x
```

### A second prediction, about grain

A rate says nothing about how it arrives. 40% of the time is 40% whether it
comes as one long stare or forty flickers, and only one of those is a face.

Two independent looks overlap only for as long as it takes whichever ends first
to end, so a shared look is shorter than either look making it up — about half,
for equal glances. Argyle & Ingham's own two means, 2.95 s and 1.18 s, give a
ratio of 2.50. The model, which knows neither number, gives 3.27.

## Handing the floor over

```js
const talk = new Dialogue({ yieldOnGaze: false });   // no terminal gaze
```

```
    with the terminal gaze     0.37s to change hands
    without it                 1.20s
```

The delay existing is built in — this is a **model** of Kendon's finding rather
than a rediscovery of it, and the gate says so. What is not built in is how fast
an invited handover goes. The signal only lands if the listener happens to be
looking, so the speed falls out of Kendon's listening rate and nothing chosen
for it.

It also must not be instant. Stivers et al. (2009) put the gap between turns
across ten languages within a couple of hundred milliseconds of zero, not at
zero — a transition nobody had to perceive is not a transition.

## Where the eye actually goes

`Floor` decides **where** to look. `Saccades` decides **how the eye gets there**.

```js
import { ORBITAL_RANGE } from 'anima3d';

floor.update(dt, state);
// Saccades speaks DEGREES; `target` is the normalised -1..1 pair the eye rig
// takes. Hand the target over every frame — a Saccades left without one is
// free-viewing, and it will pick its own fixations over the top of yours.
saccades.update(dt, {
  task: 'scene',
  target: { yaw: floor.target.yaw * ORBITAL_RANGE, pitch: floor.target.pitch * ORBITAL_RANGE },
});
eyes.apply({ lid, ...saccades.shape });
```

That split is the whole handshake: a conversational rule has no business knowing
about Bahill's duration law, and a ballistic eye movement has no business
knowing whose turn it is to speak.

One consequence worth expecting: the eye does not move the instant the
intention does. `Saccades` holds its fixation until the dwell expires, so an
aversion begins up to a third of a second after `atPartner` flips. That is the
published fixation duration doing its job, not lag.

Which way someone looks when they look away is a judgement here and is labelled
as one. What is not a judgement is that it has to be far enough — gaze direction
is discriminated to within a couple of degrees at conversational distance, so an
aversion of half a degree is a face still looking at you. The widest aversion in
the model is 20°, which the rig draws as 4.29 mm of iris travel.

## What is data and what is not

| | |
|---|---|
| `GAZE_LISTENING` 0.75 | Kendon 1967. Data. |
| `GAZE_SPEAKING` 0.40 | Kendon 1967. Data. |
| `LOOK_SECONDS` 3 | Argyle & Ingham's mean glance, near enough. Data. |
| the away time | derived from the two above. Not a choice. |
| `TERMINAL_GAZE` 1 | the finding is data; the second is a judgement. |
| `PLANNING_AVERSION` 1 | same. |
| the aversion direction | a judgement, bounded by what reads as an aversion. |

Falsifiable without touching any of them: the mutual gaze rate, the
listener/speaker asymmetry, the mutual-glance ratio, and that every utterance
ends on the listener's eye.
