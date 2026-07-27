# Dancing — the beat is not the character's idea

Everything else in this library starts inside the body: a walk is where the legs want to go, a mannerism is a private itch. A dancer is driven by something **outside** — a beat that arrives from a woofer, a band, a busker — and the whole craft is staying on that beat while it wanders, drops out and comes back.

```js
import { createHumanoid, Dance } from 'anima3d';
import { createWoofer } from 'scena3d';   // or anything with a pulse

const rig = createHumanoid({ seed: 640 });
const dance = new Dance(rig, { seed: 7 });
dance.start();

game.onUpdate((t) => {
  dance.update(t.delta, woofer.pulse());   // the whole coupling
});
```

`Dance` consumes anything shaped `{ bass, mid, treble, beat, bpm }` — structurally SCENA's `AudioPulse`, with neither library importing the other, as ever.

## The moves are skills, not clips

Seven in the repertoire: `bounce`, `stepTouch`, `twist`, `raiseTheRoof`, `headBang`, `clap`, `robot`. Each is a pure function of beat phase and energy, sampled fresh every frame, so it locks to whatever the tempo happens to be — a clip baked at 120 BPM is wrong at every other tempo, and wrong *cumulatively*.

```js
dance.use('robot');       // pick a skill and hold it (turns auto off)
dance.start('headBang');  // use + start in one
dance.auto = true;        // work the repertoire: a new skill every 8 bars
```

`auto` never re-picks the current move — a change you cannot see is not a change — and `barsPerMove` sets the attention span.

Energy comes off the music, mostly the bass: the same move danced to a quiet bar and a loud one is the same shape at a different size, which is how dancing actually scales. `robot` is the odd one out on the clock — it quantises to the eighth note and *holds* between snaps, dancing the grid rather than the groove.

## The beat clock free-runs

The phase advances at the reported tempo and is only **nudged** by arriving beats — a third of the way toward the nearest kick, never snapped. A dancer who teleports onto the beat every kick looks like a glitch; a dancer who drifts and corrects looks like a person.

And when the pulse stops entirely — the stream died, or nobody called with music at all — the clock keeps the last tempo and the body keeps dancing:

```js
dance.update(dt);   // no pulse: free-runs, exactly like a floor
                    // during the seconds it takes the DJ to fix the skip
```

Absurd tempo readings (a beat detector having a bad moment) are ignored rather than obeyed; the clock holds its last good number.

## A crowd, not a chorus line

Every dancer gets a seeded **flair**: a fixed timing lag (±45 ms), an amplitude of their own, and a handedness. Feed one pulse to twenty dancers and they dance *together but not in lockstep*:

```js
const floor = seeds.map((seed) => {
  const d = new Dance(createHumanoid({ seed }), { seed });
  d.start();
  return d;
});
game.onUpdate((t) => {
  const pulse = rig.pulse();
  for (const d of floor) d.update(t.delta, pulse);
});
```

Same seed, same night: two dancers built alike are deterministic to the quaternion, which is what makes a dancing crowd verifiable headless.

## Styles: the count is not the beat

The club moves treat every beat the same. A **style** has a meter, a count cycle, a posture held under everything, and steps — real weight transfer, travel and return:

```js
dance.setStyle('salsa');   // 'club' | 'salsa' | 'waltz' | 'bhangra'
dance.meter;               // 3 in a waltz, and there is no arguing with it
dance.count;               // where we are in the figure, 0-based
```

**Salsa** counts to eight and *holds the 4 and the 8* — quick-quick-slow is a rhythm you can write down, so here it is data (the chart marks which counts step, where, and which carry the accent). The hips answer the weight **half a count late**: that lag is Cuban motion, and removing it turns salsa into someone walking sideways.

**Waltz** is the meter generalisation — three beats to the bar, the box over two bars, and the rise-and-fall: down into the one, rising through the two and three. Its frame holds the arms carried wide the whole time, and its `hipAnswer` is turned nearly off, because a waltz that dances salsa hips is neither.

**Bhangra** keeps 4/4 but spends the back half of every cycle with both arms above the head, shoulders bouncing on each count, weight swapping side to side with a light hop in the bar.

## Street: the hit and the freeze

Street time is not smooth time, and the five street styles each break the smoothness a different way:

- **`popping`** — THE HIT. Each count draws a fresh pose from a seeded die; the body crosses to it in the first tenth of the count and then *does not move*. A dime stop, four times a bar. Smooth it out and it is just somebody swaying.
- **`locking`** — wind up (wrist circles), throw the point, and **LOCK**: from the 2 to halfway through the 4 the pose function is simply not asked again. The pause is the content; everything else is how you arrive at it.
- **`waving`** — the body as a transmission line: one rotation enters at the left hand and leaves at the right, each joint a fixed delay behind the last. The ragged oar crew's ripple, danced.
- **`tutting`** — right angles on the half-count, snapped harder than popping and held dead flat between: the grid, danced as strictly as it can be.
- **`toprock`** — breaking's standing footwork on the step engine: the cross-step kicked over the standing leg, arms rocking open against the feet. (Downrock and power moves wait for floor support states — deliberately.)

The freezes and hits needed **no new machinery**: a freeze is the pose function evaluated at the instant the lock lands, and a hit is an interpolation weight that spends nine tenths of the count at 1. Everything stays a pure function of the count, which is why a popper at 96 BPM and the same popper at 128 BPM hit equally hard.

## The two classicals: where the dance keeps its time

Ballet and Bharatanatyam sit at opposite poles of the same question, which is why they ship together.

**`ballet`** is **phrase time**: twelve counts of 3/4 — plié and port de bras, the arabesque line, the gather to fifth, and a **pirouette** — and none of it lands *on* a beat. The style's clock runs a fifth of a count **early** (`lead`), because a dancer arrives and settles where everyone else drifts and corrects: anticipation, the exact inverse of the club's nudge. The pirouette turns the whole body through a revolution while the head **spots** — it cancels the body's turn as far as the neck will bear, and when the wrapped angle flips sign it whips through: one fast move per revolution, which is all spotting is, and it falls straight out of `wrapPi`.

**`bharatanatyam`** is **subdivision time**, stricter than any club beat: **araimandi** — the half-sit — is held for the entire dance (a posture *is* a height: even its highest moment is well below standing), the arms hold flat geometric lines that change like flags, and the feet stamp the **ta-ka-di-mi** — singles on the counts, doubles across the back half, finer than the beat itself.

And the stamps are **events**:

```js
dancer.onStamp(() => tiles.feed({ bass: 0.9, treble: 0.7, beat: true, ... }));
```

Until now the pulse has only flowed one way — music to body. A stamp flows *back*: the floor can hear the dancer. In the club playground the Bharatanatyam dancer's strikes fire rings through the DJ tiles, which is the trilogy's first piece of motion the scenery reacts to.

## The illusions and the house

The illusion styles are the first that are *about lying*, and the lie is stated as data. `moonwalk`'s chart says the feet **walk forward**; its `travel` channel says the body **glides back**; the contradiction is the dance — four counts of the lie, four counts of honest walking to come home, juxtaposed every cycle. `runningMan` runs at full stride and goes nowhere: every count one foot drives forward with the knee high while the *other* — a second, quieter chart commitment — slides back under the body without a lift. `glide` crosses a metre of floor with the knees barely bent and no step anybody can see.

The machinery behind all three is one deliberate bypass: **travel is not weight**. The hip-answer lag that makes salsa salsa never sees the glide, so a gliding body slides as one rigid piece — which is exactly what makes a moonwalk read as a moonwalk, and it is verified: a crossing glide carries less than half the hip roll of a salsa basic.

`house` is two clocks in one body: **the jack** — the torso waving at *double* the count, each segment a phase step behind the one below (the wave machinery turned vertical) — over fast, light skating feet on the single count. The ratio between the two clocks is the style.

Underneath the styles sits the **step engine**: counts commit marks from the chart, feet spend the count getting there, the body's weight eases onto the support foot, and the travelling figure always averages home — travel-and-return, not drift. `stop()` brings a mid-figure dancer all the way back to where they started standing.

## Stepping on and off the floor

`start()` captures the pose the body arrived in and eases into the dance from there; `stop()` eases back to exactly that pose, because whatever owned the body before — an idle, a conversation — is going to want it back the way it was left. Every frame is composed fresh from the entry pose, so nothing compounds and there is always a way back.

```js
dance.dancing;   // true between start() and the end of the ease-out
dance.bar;       // bars danced since start
dance.energy;    // what the music is putting in, 0–1
```

See **the club** in the playground: SCENA's woofer playing real web radio, SCENA's DJ tiles, six ANIMA dancers on one pulse — the trilogy's first genuine three-way composition, and the only thing crossing the seams is `{ bass, mid, treble, beat, bpm }`.
