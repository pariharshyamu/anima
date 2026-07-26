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

## Stepping on and off the floor

`start()` captures the pose the body arrived in and eases into the dance from there; `stop()` eases back to exactly that pose, because whatever owned the body before — an idle, a conversation — is going to want it back the way it was left. Every frame is composed fresh from the entry pose, so nothing compounds and there is always a way back.

```js
dance.dancing;   // true between start() and the end of the ease-out
dance.bar;       // bars danced since start
dance.energy;    // what the music is putting in, 0–1
```

See **the club** in the playground: SCENA's woofer playing real web radio, SCENA's DJ tiles, six ANIMA dancers on one pulse — the trilogy's first genuine three-way composition, and the only thing crossing the seams is `{ bass, mid, treble, beat, bpm }`.
