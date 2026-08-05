# The smile

**Two muscles, and only one of them can be faked.**

```
npm run smile
```

---

Guillaume Duchenne de Boulogne spent the 1850s applying electrodes to the faces
of his subjects and photographing what contracted. In *Mécanisme de la
physionomie humaine* (1862) he reported that a smile is not one muscle but two,
and that they are not equal:

```
zygomaticus major (AU12)   pulls the lip corners up and out
orbicularis oculi (AU6)    raises the cheek, narrows the eye
```

The first obeys the will. The second, he wrote, **"only obeys the sweet emotions
of the soul"** — it cannot be reliably contracted on purpose. That is why a posed
smile reaches the mouth and stops there, why every viewer on earth can tell, and
why almost nobody can say what they noticed.

## Which is a fact about an API, not just about a face

Every smile in every rig is one number. Turn it up, the mouth curves, done — and
it is *always* a posed smile, because one number cannot express the thing
Duchenne found. So there is no `setSmile` here. There are two verbs:

```ts
face.pose(0.8);   // deliberate: AU12, and AU6 stays where it is
face.feel(0.8);   // enjoyment:  both, together
```

**There is no way to command AU6 on its own, and that is the design.** The gate
enumerates the prototype at run time to prove it, and mutating the class to add
one collapses everything below.

## The observer

`readSmile` scores a recorded expression against four markers from four
laboratories. It never asks the controller what it intended — it reads what the
face did:

| | |
|---|---|
| **AU6 present at the apex** | Duchenne (1862) |
| **duration inside 0.5–4 s** | Ekman & Friesen (1982) |
| **the two sides match** | Ekman, Hager & Friesen (1981) |
| **onset smooth, single-peaked** | Schmidt et al. (2006), Hess & Kleck (1990) |

```
                  AU6      window   symmetric  smooth   score
a felt smile     felt     felt     felt       felt     4/4
a posed smile    posed    felt     posed      posed    1/4

separation 3
the one-number control: felt 4/4, posed 4/4, separation 0
```

**The control is the point.** The claim is not "the model can produce a Duchenne
smile" — any model can, by setting two numbers. The claim is that the
*difference* between a felt smile and a posed one survives being looked at. A
one-number smile scores **identically whatever it is asked for**, because it has
no difference to express. It can look like a Duchenne smile; it just cannot look
like anything else.

Each marker is asserted separately, not just the total. Scoring only the sum
lets a model drop one tell and still pass on the other three, which is how a gate
quietly stops testing what it says it tests.

## Where the numbers come from

| | | |
|---|---|---|
| `FELT_MIN` / `FELT_MAX` | 0.5 s / 4 s | Ekman & Friesen (1982), published |
| `POSED_ONSET` | `FELT_MIN / 3` | **derived** — too fast to be felt |
| `CHEEK_LID` | 1/3 | anatomically forced: a sphincter closes what it surrounds |
| `POSED_ASYMMETRY` | 0.2 | direction published, magnitude a judgement |
| `CORNER_TRAVEL` | 10 mm | **a judgement, and the weakest number here** |

`POSED_ONSET` is the nice one. A posed smile's tell is that it is too fast to be
felt, so its onset is the published floor's own fraction — the whole expression
lands *under* `FELT_MIN` and therefore outside Ekman's window. Move the floor and
this moves with it.

## And it reaches the rig, in millimetres

```
eye open               10.00 mm
...during a felt smile  7.00 mm   — crinkled, not shut
...during a posed one  10.00 mm   — untouched
lip corner rose         9.00 mm
a posed smile: left 9.00 mm, right 7.20 mm — lopsided
```

**AU6 narrows the eye from BELOW.** A blink comes down from above; orbicularis
oculi is a sphincter and comes up from underneath. Drawing both off one panel
would make a Duchenne smile read as a half-blink, which is exactly what it is
most often mistaken for and the reason a squint and a crinkle look nothing alike.

The two share one gap, so the aperture is the product — which means a blink
during a smile still shuts the eye completely, and a full cheek raise never does.

## What the gate had to learn

**TypeScript's `private` is a compile-time courtesy.** The first version had a
`private begin(intensity, felt)`. The source read exactly as if the claim held —
and any JavaScript caller could have written `smile.begin(0.9, true)` for a
perfect posed Duchenne smile. The claim is about what a caller *can* do, so it
has to hold in the language the package ships as. It is `#begin` now, and the
gate enumerates the prototype rather than reading the source text.

**The corner-travel check was circular.** It asserted the measured rise against
`CORNER_TRAVEL × intensity` — the number that produced it — so it held for every
value it was given. Setting the constant to 16 mm sailed straight through, and it
was the only one of seven mutations that survived. The face supplies real bounds
instead: below about 5 mm the smile is invisible, above about 19 mm the corner
reaches the nose base and becomes a snarl. That bracket is **wide**, and 10 mm
sits in the middle of it rather than on a measurement. Said plainly rather than
dressed up: this is the one constant here the gate cannot really pin.

## Handing the observer a trace is the hard part

`readSmile` counts sign changes in the acceleration, which makes it a second
difference — and a second difference assumes the samples are evenly spaced. Two
ways of getting that wrong, both of which scored a genuine felt smile 3/4 and
blamed the model:

```
repeat the current value onto a 1/60 grid   a staircase, and every tread
                                            is a sign change
one sample per frame, average the dt        evenly spaced on paper only; a
                                            headless frame jitters 30%, the
                                            same size as the curvature
```

Ticks land on a fixed grid with values interpolated between frames. If you feed
`readSmile` a variable-rate trace it will tell you your smiles are stepped.

## And the probe earned its keep

A playground debug field reached for a `const` inside the update body — the
third time in three releases. The difference is that 0.67.0 taught the headless
probe to report what the scene throws instead of swallowing it, so this one
printed `ReferenceError: grinned is not defined` on the first run rather than
masquerading as a dead face. A debug hook reads controller state, never an
update-body local.

## Where this is still wrong

**Enjoyment only.** AU6+AU12 is the *enjoyment* smile. Embarrassment, contempt,
the polite acknowledgement and the suppressed laugh are all different
configurations, and none of them are here.

**No suppression.** A real face fighting a smile shows AU12 briefly, then AU15
or AU17 pulling against it. That fight is one of the most legible things a face
does and this cannot express it.

**The asymmetry is static.** Real deliberate expressions are *more variable* in
their asymmetry, not reliably lopsided by a fixed fraction. A fixed 20% is a
caricature of the finding.

**No main sequence.** Schmidt et al. (2006) found smile onsets obey an
amplitude–peak-velocity relation much like saccades do. `Saccades` implements
exactly that structure and this does not — a bigger smile here takes the same
time as a small one, which is wrong in the same way a lerped eye is.
