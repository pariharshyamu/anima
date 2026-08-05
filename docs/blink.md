# Blink

**The blink rate is not a constant. It is what the agent is doing.**

```
npm run blink
```

---

Every rig that blinks blinks on a timer. Pick a number, add some jitter, call it
done. The number is almost always wrong, and — this is the part that reads as
mechanical — it is always the SAME number. A real face's blink rate moves by a
factor of six on nothing but the task.

Bentivoglio, Bressman, Cassetta, Carretta, Tonali and Albanese (1997) counted
spontaneous blinks in ninety adults across three conditions:

```
at rest            17 blinks a minute
reading             4.5
in conversation    26
```

Reading suppresses it to a quarter of rest. Talking nearly doubles it. So an NPC
reading a sign and an NPC in a conversation do not need a blink parameter
between them — they need to say what they are doing:

```ts
const lids = new Blinking({ task: 'rest', seed: 12 });

// every frame
eyes.apply(lids.update(dt, { task: speaking ? 'conversing' : 'rest' }));
```

There is no rate in that. `BLINK_RATE` is a three-row table and it is labelled
as data, the same way `PHONEMES` is. What this module models is what to do with
it.

## A blink is not symmetric

The lid falls with orbicularis oculi behind it and gravity helping, and is
dragged back up by levator palpebrae against that gravity. The down phase is
about **twice as fast** as the up phase. A symmetric blink reads as a twitch,
and it is one of those things every viewer notices and nobody can name — which
is why an even split is the gate's control, and has to lose.

That asymmetry is also where the lid's speed comes from. Nothing here picks it:

| | | |
|---|---|---|
| `APERTURE` | 10 mm | the adult palpebral aperture, scaled off body height |
| `BLINK_CLOSE` | 90 ms | the down phase |
| `BLINK_OPEN` | 180 ms | **derived**: twice the down phase |
| `LID_SPEED` | 0.111 m/s | **derived**: the aperture, closed in the closing time |
| `BLINK_SECONDS` | 270 ms | **derived**: the two phases |
| `GAZE_LID` | 1/3 | a judgement, and the only one here |

## The lid rides the eye

Look down and the upper lid follows; look up and it retracts. Levator palpebrae
and superior rectus share an origin, so they are mechanically coupled, and a rig
whose lids stay put while the eyes travel looks reptilian. It costs one multiply:

```ts
const resting = GAZE_LID * ((1 - gaze) / 2);
```

...and the blink then takes the lid **the rest of the way down from wherever it
was resting**, rather than adding to it. A downward-looking eye therefore shuts
sooner, which is what happens, and it also means the closure can never exceed 1
without a clamp doing the work.

`GAZE_LID` is the one number in this file that is a judgement rather than a
measurement. It is labelled as one, and the gate asserts the model does what the
constant says: across the full gaze range the aperture must move by a third.

## The duration comes OUT of the gap

Bentivoglio counted complete blinks per minute, so a cycle is the blink plus the
wait, and it is the **cycle** that has to average `60 / rate`. The first version
drew an exponential wait about the full mean and then spent 270 ms blinking on
top of it, which put every rate 15 to 20 per cent low — 20.7 a minute against a
published 26. In a random process that looks like noise. It is arithmetic.

A change of task also **re-draws the wait**. Without that a face which stops
reading and starts talking keeps counting down the four-a-minute interval it was
already on, and the rate only catches up a blink later.

## What the gate measures

Twelve seeds, thirty simulated minutes each, at a coarse 1/60 s step — because a
gate nobody can afford to run is a gate nobody runs.

```
task          measured   Bentivoglio   error
rest          16.76/min       17       1.2 se
reading        4.34/min      4.5       1.8 se
conversing    25.52/min       26       2.7 se

reading against conversing      5.9x, published 5.8x
down in 83 ms, back up in 167   2.00x, published 2.0x
  an even split                 1.06x   ← the control

narrowest aperture reached      0.09 mm of 9.1
fastest the lid moved           0.111 m/s against a derived 0.111
up 10.0 / level 8.3 / down 6.7  33%, GAZE_LID says 33%
```

The budget is `4 × se + 0.05`, not a round tolerance: with twelve seeds the
standard error on one task is about three per cent, which is most of the gap
between 16.76 and 17. **Two of these were sampling noise that looked like bias**
until the seed count went up, and one 16.3-versus-16.4 pair looked like a 4%
systematic error for as long as it took to run twenty-four seeds and get 16.88.

Everything below the rate table is measured off the **rig's own aperture** — the
metres the mesh is actually showing — and not off `shape.lid`. A formula checked
against itself is not checked.

## What the gate had to learn

Four ways this was wrong, and **two of the four were the gate**.

- **It hung.** The asymmetry check waited for `shape.lid > 0.05` to call the eye
  shut. At a downward gaze the *resting* lid is 0.111, so that condition is
  permanently true and the loop never terminated. It watches the maximum
  aperture over a window now.
- **It cost 31 million updates** on the first attempt and had to be killed.
- **The speed check was wrong**, not the model: it failed 0.093 against a
  derived 0.111 because a blink is a fixed *duration*, so the lid's speed
  depends on where it started. It is measured at a full upward gaze now, which
  is the only place the travel is the whole aperture.
- **The symmetry control failed on the wrong assertion.** It compared against
  `BLINK_OPEN / BLINK_CLOSE`, which moves with the mutation being tested — a
  control that moves with what it is controlling for is not a control. It is a
  literal `2` now.

And one that only a screenshot could find: the lids rendered flawlessly at
`0.0575 H`, level with the baked whites — which is 0.6 mm **behind the irises**,
because `createHumanoid` sets those proudest of all. Every number in the probe
was right and the eye stayed wide open through a blink the readout said had
closed to 0.954.

## Where this is still wrong

**Blinks are not Poisson.** The wait here is exponential about the published
mean, which is the honest simple thing and gets the mean right by construction.
Real inter-blink intervals are not memoryless — they cluster, and they attach to
syntactic boundaries in speech and to saccades. This will produce a run of three
quick blinks where a face would not.

**No reflex blinks.** A looming object, a bright light and a loud noise all
trigger one, on a latency of about 50 ms. Nothing here can see any of that; a
consumer that can should call `blink()`.

**One eye's worth of state, drawn twice.** Both lids do the same thing at the
same instant. A wink is not expressible, and neither is the mild asymmetry real
blinks have.

**Vertical gaze only.** `gaze` is one number, so the lid couples to looking up
and down and nothing couples to looking sideways. There is no saccade model here
at all — the eyes do not move on their own.
