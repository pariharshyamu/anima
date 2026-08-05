# Brows

**A brow raise is punctuation before it is emotion.**

```
npm run brows
```

---

Every rig that animates eyebrows animates them from a mood: up for surprise,
down for anger, still the rest of the time. A face built that way is motionless
through an entire sentence, which is the thing that reads as dead and which
nobody can name when they see it.

Ekman's *About Brows* (1979) is about exactly this. The brow raise is a
**conversational signal** — it marks the word being emphasised, it goes up on a
question, and it fires on greeting whether or not anyone is pleased about
anything. Cavé, Guaïtella, Bertrand, Santi, Harlay & Espesser (1996) measured it
directly: roughly **seven in ten brow raises coincide with a rise in F0**.

So the brow does not need a mood. It needs a pitch contour.

## The seam

```ts
const line = speakAloud('the traveller stopped at the gate', voiceOf({ height: 1.82 }));
const clock = () => Math.max(0, line.elapsed());

speech.attach(line.mouthAt, { clock, done: () => line.done });   // the mouth
face.attach(line.pitchAt,  { clock, done: () => line.done });    // the brows
```

`PitchSource` is `(seconds) => number`, in **semitones relative to whoever is
speaking**. GAMA's `SpokenLine.pitchAt` has that signature. It imports nothing
from here, this imports nothing from there, and what makes them agree is not a
type — it is that a pitch accent and a brow raise are one gesture, made by two
muscles a hundred millimetres apart, at the same instant, for the same reason.

Semitones and not hertz, because a face does not care how big a larynx is.

## The part that is not a copy of the pitch

A brow tracks the **accent**, not the pitch. English declines: 't Hart, Collier
and Cohen (1990) put the drift at about half a semitone a second, so across a
six-second sentence the whole contour sinks nearly three semitones — more than
half an accent's own height — while the accents keep landing on top of it. **A
brow wired straight to pitch sinks with it**, and the speaker looks like they
are falling asleep by the full stop.

So what drives the brow is pitch above a running baseline, and the baseline is
a **floor, not a mean**. 't Hart draws the declination line through the valleys
of a contour, because that is what declination is: the accents ride on it and do
not define it. A baseline that could also rise gets pulled up by the accent train
itself, so each accent is measured against a floor its own predecessors raised.

```
                                       last accent, as a fraction of the first
tracking the floor                                    94%
the same model with the baseline removed              64%   ← the control
the budget                                            92%
```

**The budget is derived.** A first-order filter following a ramp lags it by
`rate × tau` for ever — that is what a first-order filter does — so a line
falling 0.55 semitones a second sits 0.41 semitones high once settled, which is
8% of a five-semitone accent. More than that is a bug; less would mean the
tracker is doing something unaccounted for.

## Every constant here is derived from a published one

| | | |
|---|---|---|
| `BROW_TRAVEL` | 10 mm | frontalis at full voluntary contraction, scaled off body height |
| `BROW_FLASH` | 1/6 s | Eibl-Eibesfeldt (1972), the cross-cultural greeting flash |
| `BROW_SPEED` | 0.12 m/s | **derived**: a flash is up and back, so up is half of it |
| `ACCENT_SEMITONES` | 5 | 't Hart et al. (1990), an accent-lending pitch movement |
| `BASELINE_TAU` | 0.755 s | **derived**: the geometric mean of a syllable and a phrase |

The speed limit is the interesting one. Nothing chose it: a flash covers the
travel and returns in a published sixth of a second, so the way up is half of
that, and 10 mm in 83 ms is 0.12 m/s. Change either published number and it
moves. It matters because a contour has steps in it — a syllable boundary is a
discontinuity — and a brow that teleported between them would read as a switch
rather than a muscle. It also gives the brow the same undershoot the jaw has, on
the same fast excursions, for the same reason.

## What the gate had to learn

Four ways it was wrong before it was right, and three of them were the gate.

- **The shuffled control was correlated against its own input.** It scored
  **0.897** against the subject's 0.869 — faithfully following the wrong contour
  and being praised for it. Both are scored against the true contour now, and it
  drops to −0.12.
- **The no-baseline control sat clamped at 1.0.** The test contour started four
  semitones up, so a naive `pitch / accent` model saturated end to end and held
  100% for free — which made *deleting the baseline entirely* pass the gate. The
  contour now sits where `pronounce` actually puts one, declining through the
  speaker's own f0.
- **The budget was a round number.** It asserted 0.95, measured 0.94, and said
  nothing about whether 0.94 was right. It is now the filter's own lag.
- **And the model was wrong**: a symmetric baseline held only 92% because the
  accent train dragged it up. The gate caught it as the *target* holding 92%
  before the speed limit ever saw it, which is how it was clear the muscle was
  not to blame.

## Where this is still wrong

**One channel.** `raise` is AU1 and AU2 together. AU4 — the corrugator, the brow
*lowerer* — is not here, and it is what a frown is; nor is the inner/outer split
that separates a sad brow from a surprised one.

**Symmetric.** Real brows are not, and an asymmetric raise is one of the reliable
markers of a posed expression rather than a felt one.

**Prosody only.** A brow raise is also a backchannel, a question mark on someone
else's sentence, and a greeting. `flash()` covers the last of those; the rest
needs a conversational state this module cannot see.
