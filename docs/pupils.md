# Pupils

**The pupil is not an emotion dial. It is a light meter.**

```
npm run pupils
```

---

Every rig that animates pupils dilates them for interest and shrinks them for
fear. That is not wrong, exactly — Hess & Polt (1964) did find the pupil dilates
with mental effort, and Kahneman & Beatty (1966) measured it against memory
load. It is just **an order of magnitude smaller than the thing the pupil is
actually doing**.

```
the light reflex, over eight decades of luminance   5.5 mm
the task-evoked response, at full effort            0.5 mm
```

So a character whose pupils widen with drama and ignore the scene's lighting has
the physics upside down by a factor of eleven.

## And the consequence runs the other way, which is the interesting half

**You cannot read a mood off a pupil unless you hold the light constant.** That
is not a stylistic claim — it is why every pupillometry protocol ever published
fixes the luminance first. It is also a claim this model can be held to, and it
is the centre of the gate:

```
                      effort readable   tracks the light
changing light           r=0.23            r=0.98
fixed light              r=1.00            r=0.00

4.3x more readable with the light held still.
the mood-dial control: 1.0x — it says the same thing in any light,
and tracks the luminance at r=0.15, which is to say not at all.
```

**The control is a mood dial**: a pupil that answers to the character's state and
has never heard of the scene's lighting, which is what rigs ship. It gets the
published result exactly backwards — mood equally readable whatever the light is
doing — and that is the thing that is false about faces.

## The static law

Moon & Spencer (1944), diameter in millimetres against field luminance in cd/m²:

```
D = 4.9 − 3 tanh(0.4 log₁₀ L)
```

```
luminance    measured   Moon&Spencer   DeGroot 1952
    0.001      7.40 mm       7.40          6.10
        1      4.90 mm       4.90          3.99
      100      2.91 mm       2.91          2.39
    10000      2.13 mm       2.13          1.13

range 2.13–7.40 mm of an anatomical 2–8
the two published fits disagree by up to 1.39 mm
```

### That cross-check is the weak one, and the gate says so

In the [saccade gate](guide.html?page=saccades) the model was given Bahill's
duration law and then held to his peak-velocity law, which it had never seen —
the agreement was a **prediction**. Nothing of the sort happens here. This model
*is* Moon & Spencer, so comparing it to De Groot & Gebhard measures the
disagreement between two 1940s curve fits and not the quality of anything I
wrote.

It is kept because it still catches a units error, a wrong branch, dynamics that
fail to settle, a rig that does not draw millimetres, and an effort term large
enough to drag the settled value out of the band. **It is not evidence that the
curve is right**, and a gate that let you believe otherwise would be worse than
no gate.

What *is* independently falsifiable: the anatomical 2–8 mm range, which neither
curve fit can move; the shape; and the mood-readability result above.

### And the shape is logarithmic

A decade of light at dusk moves the pupil **801 times** what the same nine units
of luminance move it at noon. For a pure log law that ratio is `1 / log₁₀(1009/1000)`
= 257; for a linear-in-luminance one it is 1. The bound is bracketed by the two
candidate shapes rather than chosen between them.

## The two muscles are not the same muscle

```
shut in   0.40 s   sphincter pupillae, parasympathetic
opened in 1.60 s   dilator pupillae, sympathetic
4.0x slower to open than to shut, and blind for the first 0.22 s
```

Same asymmetry the eyelid has, for the same kind of reason — and it is why
walking into a dark room takes a moment. The latency is why a pupil in a
flickering scene lags rather than strobing.

## And it reaches the rig

```
at 8 mm the pupil is 67% of the iris
at 2 mm                17%   — a 4.00x change, drawn
```

The pupil is drawn as `D / 12` of the iris, because an adult iris is twelve
millimetres and the pupil runs 2 to 8 of them. A stylised face draws the iris
however large it likes; **the fraction is what has to be right**, so a
big-eyed character shows the same proportion black rather than the same
millimetres.

## What the gate had to learn, twice

Two of seven mutations survived the first run, and both were the *same* error —
**the gate computing its expectation from the constant it was testing**:

- The latency window was `PUPIL_LATENCY * 0.9`, so setting the latency to zero
  shrank the loop to nothing and it passed. It is a literal 150 ms now, which is
  inside anybody's measurement of the published 200–250 ms.
- The iris ratio was asserted against `IRIS_MM`, on both sides. Setting the
  constant to 6 sailed straight through. The gate says twelve.

This is the third release running that this exact shape of mistake has appeared
— `BLINK_OPEN / BLINK_CLOSE` in 0.66.0, `CORNER_TRAVEL` in 0.68.0, and now two
at once. It is invisible in review, because the assertion reads as though it
checks something. **Mutation testing is the only thing that finds it**, which is
the argument for running mutations before writing the documentation rather than
after.

## Where this is still wrong

**No consensual response.** Both pupils are driven by one luminance. A real pair
responds to the light entering *either* eye, which is what a clinician's
swinging-flashlight test exploits.

**Luminance is a number the caller supplies.** Nothing here samples the scene, so
a character standing in shadow has whatever pupil the game says. Getting real
adapted luminance out of a renderer is a tone-mapping problem and not this
module's.

**No adaptation.** The pupil is only about a factor of sixteen of the eye's
dynamic range; the rest is photochemical and takes minutes. A character walking
into a dark room gets the pupil part right and the going-blind-then-recovering
part not at all.

**No accommodation, and no near triad.** Focusing on something close constricts
the pupil, converges the eyes and thickens the lens together. This has none of
it, which is the same gap `Saccades` has on vergence.
