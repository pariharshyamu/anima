# Speech

Visemes, and the observation that **the table already exists**.

```
npm run speech
```

---

## Every lipsync system starts by inventing a list of mouth shapes

That list has been published since 1888. It is the IPA vowel chart, and its two
axes are exactly the two things a mouth visibly does:

```
VOWEL HEIGHT    close ... open        is how far the jaw is down
ROUNDEDNESS     spread ... rounded    is what the lips are doing
```

So `mouthOf` is two lookups and a subtraction. There is no viseme table in this
module, because the IPA is one:

```
vowel   height  round  ->   open   round  spread
/i/      0.05   0.00       0.05   0.00    0.05
/y/      0.05   0.90       0.05   0.90    0.00
/u/      0.05   1.00       0.05   1.00    0.00
/e/      0.35   0.00       0.35   0.00    0.35
/o/      0.35   0.85       0.35   0.85    0.05
/ɛ/      0.60   0.00       0.60   0.00    0.60
/a/      0.95   0.00       0.95   0.00    0.95
/ɑ/      1.00   0.05       1.00   0.05    0.95
/ɔ/      0.70   0.75       0.70   0.75    0.17
```

`/i/` and `/y/` differ only in rounding, and they come out differing only in
rounding. `/u/` and `/ɯ/` likewise. **Two axes, not one** — and the gate checks
that openness is monotone in height across the whole inventory, which it can
only be if it is the same number.

---

## Visemes are fewer than phonemes, and that is a fact about eyes

```
31 phonemes collapse to 9 visemes  (3.4 to one)
```

`/p/`, `/b/` and `/m/` are three different sounds and **one picture** — the lips
are shut and you cannot see which. They differ in voicing and nasality, neither
of which is visible.

That many-to-one collapse is the whole reason lipsync is tractable and the
reason lip-reading is hard, and it is a classification of places of articulation
rather than a design.

---

## A bilabial must close the lips

```
"mama"   lips 100% sealed, jaw 77% open    ← bilabial closes
"papa"   lips 100% sealed, jaw 77% open    ← bilabial closes
"baba"   lips 100% sealed, jaw 77% open    ← bilabial closes
"halo"   lips   5% sealed, jaw 77% open
"sisi"   lips  15% sealed, jaw  9% open
```

Real mouths blend — the shape at any instant is a weighted sum of the
neighbouring targets, each with a dominance that rises and falls (Cohen and
Massaro, 1993). But blending has one thing it must never do.

If "mama" is blended until the seal is only 60% shut, it reads as a mouth
flapping vaguely, and every viewer knows something is wrong without being able
to say what. It is the single most recognisable broken lipsync there is.

So **closure is not blended like the other channels**. It is taken as a
`Math.max` over the neighbours, which is what a seal physically is: the lips are
shut or they are not, and averaging shut with open does not give you half-shut,
it gives you wrong.

---

## The lips bridge; the jaw does not follow them

A seal is not the jaw shutting. The lips are soft tissue and they stretch to
meet across a gap the jaw left open — which is exactly what a nasal is. **You
can hum with your mouth open.**

```
JAW_TRAVEL   52.5 mm    shut to fully open, on a 1.75 m body
LIP_BRIDGE     24 mm    what the lips close on their own
             ───────
              46%       the widest jaw a sealed mouth may be drawn with
```

That ratio is a division of two anatomical lengths, and it is the budget the
gate holds the blend to. Both sides stay inside it:

```
the blend asks for a seal across at most 21% of the jaw's travel
the rate-limited face draws                45%
```

---

## The jaw is a bone, and it moves at a bone's speed

Phonemes run 60 to 190 ms and the raw dominance blend swings the jaw at over a
metre a second. A jaw peaks around **200 mm/s**. So the blend is the *target*,
and `Speech.update` rate-limits what the face actually reaches.

The difference between them has a name:

> **UNDERSHOOT.** A short vowel between two consonants does not reach its own
> opening, because the jaw cannot get there and back in eighty milliseconds.

Lindblom measured that in 1963. Nothing in this module encodes it — it falls out
of one published speed against one published duration, and the gate checks that
an `/a/` hemmed in by bilabials reaches materially less than a free one.

The lips are *not* limited. They are light, they shut in fifty milliseconds, and
a bilabial that had to wait for the jaw would stop being a bilabial. The seal
instead **completes when the jaw arrives**: it is capped at
`LIP_BRIDGE / (open × JAW_TRAVEL)`, so for the first twenty milliseconds of a
`/m/` after an open vowel there is simply no full seal available to have.

That also predicts something nobody put in: at speech rates fast enough that the
jaw never gets back up, **bilabial closure degrades**. It is the lips' half of
the same undershoot.

---

## Timing, and the lead

Every duration is a published mean for read speech — vowels 100–200 ms, stops
50–80, fricatives 80–120. Nothing is a frame count and nothing is evenly spaced:
an `/m/` and an `/a/` do not come out the same length, because they are not.

```
ANTICIPATION = 0.1 s
```

The visible articulation **leads the sound** by about a tenth of a second,
because the lips start toward a shape before the sound that needs it begins. It
is why a lipsync locked exactly to the audio looks a beat late.

`syllableRate` counts vowels, because a syllable is a vowel with whatever hangs
off it. "mama" comes out at **3.8 syllables/s**, and read speech is 3–8.

---

## API

```ts
import {
  PHONEMES, VISEMES, Speech, createMouth,
  mouthOf, mouthAt, utterance, utteranceLength, syllableRate, visemeOf,
  ANTICIPATION, DOMINANCE, JAW_SPEED, JAW_TRAVEL, LIP_BRIDGE, REST, REST_WEIGHT,
} from 'anima3d';

const talker = new Speech('mama.papa.', { loop: true });
const mouth = createMouth(rig);          // an overlay, parented to the Head

game.onUpdate(({ delta }) => mouth.apply(talker.update(delta)));
```

`MouthShape` is four numbers a renderer can use: `open`, `round`, `close`,
`spread`. `createMouth` exists because the face `createHumanoid` builds is baked
into the skinned mesh — there is no jaw bone and no morph target — so a moving
mouth is an overlay sized off the same body height the baked face was.

Playground: **`talking`** — two heads, one saying "mama papa mama" and one
saying "halo sisi halo". Watch the lips, not the jaws.

---

## What the gate found

1. **The mouth snapped shut at the end of every line.** The dominance
   accumulator emptied the instant no segment was in reach — which the
   anticipatory lead guarantees at the end of an utterance — and the jaw fell
   49% of its range in one 120 Hz frame. Fixed by seeding the blend with `REST`
   at a standing `REST_WEIGHT`: a mouth returns to rest, it does not fall to it.

2. **The jaw was following the lips.** `open` was gated by `(1 − seal)`, so
   every `/m/` slammed the blended opening to zero over the fifty milliseconds
   the seal took — **1099 mm/s** against a jaw's 200, about thirty times what a
   jaw can do. Removed, and a rate limit added in its place. The undershoot
   above is what came out.

3. **The gate's own budget encoded the same bug.** The assertion "a sealed mouth
   is not also an open one" was written at 15%, which is the jaw-follows-lips
   assumption stated as a number. It is now `LIP_BRIDGE / JAW_TRAVEL` — a
   division of two anatomical lengths rather than anybody's opinion.

4. **A "100% sealed" mouth was drawn twenty-three millimetres apart.** Found by
   a screenshot, not by a number: every value in the report was right, and the
   picture was a bilabial whose lips did not meet. `close` and `open` are
   separate channels and the jaw is deliberately not gated by the seal, so the
   prop had to be taught that the lips travel toward each other — up to their
   own span and no further. The seal cap in (5) came out of the same look.

5. **The seal switched on across gaps the lips could not reach.** Once the
   budget was derived rather than chosen, the controller was found sealing
   across 25 mm with 24 mm of lip to do it with. The cap is now geometric, and
   the emergent consequence is that fast speech loses its closures.
