# Saccades

**The eye does not glide, and how fast it goes is not a choice.**

```
npm run saccades
```

---

Every rig that moves its eyes lerps them: pick a speed, ease toward the target,
done. Real eyes do not do that at any speed. A saccade is **ballistic** —
launched, uncorrectable, over in a few tens of milliseconds — and its kinematics
are pinned by one of the most reproduced results in oculomotor physiology.

## Two laws for one movement

Bahill, Clark and Stark (1975) named it the **main sequence**, after the stellar
diagram, because saccades occupy a line rather than a cloud. Amplitude alone
predicts both how long the movement takes and how fast it gets:

```
duration        D = 2.2 A + 21           ms, A in degrees
peak velocity   V = Vmax (1 − e^(−A/C))  Vmax ≈ 500 °/s, C ≈ 7°
```

**Two laws for one movement is one law more than is needed to build it.** That
is the entire reason this module can be checked. The model uses the duration
law. It never reads `PEAK_VELOCITY_MAX` or `VELOCITY_CONSTANT` — and the gate
greps the source to prove it, because an argument that rests on the model not
having seen something should not rest on my having remembered.

So the peak velocity is a **prediction**, and here is what it predicts:

```
amplitude   measured    Bahill    error
     2°      124°/s     124°/s    -0.5%
     5°      245°/s     255°/s    -3.9%
    10°      365°/s     380°/s    -3.9%
    20°      483°/s     471°/s     2.5%

worst 4.4% against a floor of 4.6%
```

Every one of those velocities is **differenced off the angle trace** the
controller actually produces, frame by frame. None of it re-evaluates the
formula.

## Which fixes the shape, and it is not the obvious one

A movement of amplitude `A` in duration `D` has mean velocity `A/D`. Divide the
published peak by that mean and a pure number falls out — and that number *is*
the shape of the velocity profile:

| | peak / mean | off the published curve |
|---|---|---|
| **a half-sine** (shipped) | 1.571 | **4.4%** |
| a parabola | 1.500 | 8.7% |
| smoothstep | 2.000 | 30.6% |
| a constant speed | 1.000 | 39.2% |

Nothing here chose a half-sine. It is what is left when both laws have to hold
at once — and **the smoothstep in every easing library is the 2.0 on that
list**, which overshoots the published peak by a third. A half-sine in velocity
is a raised cosine in position, which is one line:

```ts
const s = 0.5 * (1 - Math.cos(Math.PI * t));
```

### The budget is the best any fixed shape could do

The ratio is not quite constant: it drifts from about 1.63 at 5° to 1.53 at 20°,
because real large saccades are skewed — a short acceleration and a long
deceleration tail (Van Opstal & Van Gisbergen, 1987). So **no fixed profile can
sit on the published curve everywhere**, and the best one could possibly do is
sit in the middle of that drift. That residual is 4.6%, and it is computed from
the two published laws alone with nothing of the model in it.

The shipped shape scores 4.4% against that 4.6% floor. It is not merely close to
the data — it is as close as its own form permits, and it got there without
fitting anything.

## Where it looks is the task

Yarbus (1967) showed the same painting to the same viewers under different
questions and got completely different scanpaths: eyes went to clothing when
asked about wealth, to faces when asked about ages. **The scanpath is a property
of the question, not of the picture.**

So, exactly as with blinking, there is no fixation-time parameter. There is a
task, and Rayner's (1998, 2009) reviews supply the numbers:

```
task        saccades/s   Rayner     size   Rayner
reading        3.89       3.99      1.8°     2°
search         3.22       3.30      2.6°     3°
scene          2.71       2.78      3.4°     4°

scene against reading is 1.9x, published 2.0x
```

The **spread** is the claim, the same way it was for blinking. A rig with one
scanpath has a spread of one.

## The eye is never still

Martinez-Conde, Macknik and Hubel (2004): during a fixation the eye makes one to
two microsaccades a second, a third of a degree or so, and without them vision
fades. A rig that parks its eyes between saccades looks embalmed for the 330 ms
a fixation lasts, which is most of the time.

They obey the same law — they are just small enough that their duration is
essentially the 21 ms intercept. What they must **not** do is reset the fixation
clock or get counted as fixations, or Rayner's rate is being met by a different
movement than the one he measured. The gate checks both.

## And the eye hands over to the head

```
asked for 60°: the eye took 25.0°, the head got 35.2°
```

The eye *can* reach about 45°, but in natural gaze shifts it hands over to the
head well before that (Guitton & Volle, 1987). `ORBITAL_RANGE` is 25° and the
residual comes out as `headDemand`, for `LookAt` to finish. Clamping silently
would leave an agent that has been told to look at something staring past it.

## The iris is a spot on a ball

```ts
offset = EYE_RADIUS * Math.sin(theta)
```

The eyeball is about **twelve millimetres in everybody** — it is the one part of
a face that barely varies — so a character drawn with big eyes does not get a
bigger swing, they get the same swing across a wider white. `npm run saccades`
measures the travel in millimetres off the rig and checks that a face with 20%
larger eyes moves its iris exactly as far, which is the assertion that catches
"travel is a fraction of the eye's width".

Both of the overlay iris's own dimensions fall out of the two baked ones. It has
to hide the baked iris everywhere it goes, and it must never leave the white:

```
half ≥ baked + travel
half + travel ≤ white
```

Add them and the travel cancels: `half = (baked + white) / 2`. Pick either
number by hand and the other one stops working.

## Where this is still wrong

**No skew.** Above about 20° real saccades develop a long deceleration tail and
a fixed profile cannot follow it. The model is honest inside 2–20°, which is
where nearly every natural saccade lives, and increasingly optimistic past it.

**No smooth pursuit.** Tracking a moving object is a completely different system
with its own gain and latency, and it is not here. An NPC watching a thrown ball
will saccade after it in steps instead of following it.

**No vergence.** Both eyes point in exactly the same direction, so nothing
converges on a near object and nobody can go cross-eyed.

**Saccadic suppression is reported, not modelled.** `moving` tells you vision is
suppressed; nothing in this library acts on it. An agent that should not have
seen something during its own saccade has to check that itself.

**No corrective-saccade pairing.** A real fixation is often two movements — a
big one that undershoots by about 10% and a small one that fixes it. The
`target` path here scatters the landing but does not then correct it.
