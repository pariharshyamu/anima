# Motion matching

A controller that is a **search**, not a blend tree — and the weights turn out
to be unit conversions.

```
npm run motion
```

---

## Every implementation has a table of weights

Motion matching holds a database of poses, each described by a feature vector.
Every frame it builds a query from what the character is doing and what it has
been asked to do, and plays whichever frame is nearest. No state machine, no
blend graph: the data is the controller.

And beside the cost function, always, is this:

```
cost = Σ wᵢ (aᵢ − bᵢ)²      w_footPosition = 1.0
                            w_footVelocity = 0.4     ← why 0.4?
                            w_trajectory   = 1.5     ← why 1.5?
                            w_facing       = 0.8     ← why 0.8?
```

Nobody can say why. They are tuned by eye, re-tuned per character, and they are
why motion matching has a reputation for being fiddly.

## They are not tuning parameters

Look at what is being added. Foot position is in **metres**. Foot velocity is in
**metres per second**. Facing is in **radians**. A sum of those is not a quantity
at all — it is a type error that happens to compile, and the weights are what
makes it finite.

Which means each weight is carrying a conversion factor, and a conversion factor
is not free:

```
a velocity becomes a length when multiplied by a TIME
an angle becomes a length when multiplied by a RADIUS
```

So the table collapses. Every term is in square metres, and **every weight is 1**.

---

## The test a weighted cost cannot pass

If the weights were preferences, then writing the velocities in a different unit
— the same velocities, a different name for them — could not change which frame
is nearest. The gate runs this on the real database, on the two frames it finds
that actually disagree (one nearer in position, one nearer in velocity):

```
velocity written in    cost in lengths     hand-weighted cost
m/s                    walk@0.25×0.7       walk@0.25×0.7
m/ms                   walk@0.25×0.7       walk@0.25×0.7
m/min                  walk@0.25×0.7       walk@0.85×0.7
```

The weighted cost changes its mind about the same motion. That is the whole
argument, and the check has teeth **only because the control fails it** — the
gate asserts that too.

---

## Where the constants come from

There are two, and both are read off the data rather than typed in.

```
σ(foot position)   0.3543 m
σ(foot velocity)   2.2212 m/s
τ_foot             0.1595 s     ← the ratio, and nothing else
horizons           0.167, 0.333, 0.500 s     ← thirds of a step
```

`τ_foot = σ(position) / σ(velocity)` is the time that makes both halves of the
vector span the same range of numbers. It is a **length over a length per
second**, so it does not move when the body does: a 1.4 m person and a 2.1 m
person come out with the same number to nine decimal places, while every other
feature scales with them.

The trajectory needs no conversion at all — `speed × time` is already how far the
character will have gone. The horizons are thirds of a step, because a step is
the interval over which a walker can do anything about an instruction: you can
only redirect at a footfall.

**One conversion per quantity, not one shared between them.** Foot velocity and
travel speed are both velocities and they are not the same velocity. Sharing a
constant is the tidy-looking mistake, and it makes the travel term too quiet to
overcome pose continuity — the character stands in idle through every command it
is given.

---

## Take the constants away and watch

```
variant                        speed error   pops/s   answers in
measured                           0.034     0.27       0.13s
foot velocity ignored              0.015     4.20       0.03s
trajectory ignored                 1.240     0.00       never
foot velocity six times too loud   1.240     0.00       never
at 20 frames a second              0.048     0.93       0.10s
```

Without the **velocity** term the search cannot tell a foot swinging forward from
the same foot passing backwards through the same place, and flips between them:
the pop rate goes from 1% of searches to 21%. Without the **trajectory** the
character never hears a command at all. Turn the velocity term up and it drowns
the command out — the failure in the other direction, and the reason the number
is measured rather than raised until it looks right.

---

## A jump is not allowed to show

```
fastest a bone turns in the source clips   694.8 mrad/frame
what a raised cosine can add on top of it  164.5
budget                                     859.3
fastest the controller actually turns one  699.8 mrad/frame
```

The budget is derived twice over. The controller is made **entirely** of these
clips, so it has no business moving a joint faster than they do — measured at the
same 60 Hz step and the same playback rates the database stocks, because these
curves have corners and a budget read off another grid is not this controller's
budget. On top of that, the cross-fade can add `π²·dt / (2·span)` and no more,
because a raised cosine's weight moves at most `(π/2)/span` and two poses differ
by at most π.

A jump fades out over one step against a snapshot of the pose it left.

---

## Against the blend tree it replaces

```
matcher      answers a command in 0.08, 0.13, 0.13 s
Locomotion   answers a command in 0.18, 0.12, 0.27 s
steady-state error 0.034 against 0.028 m/s
```

`Locomotion` smooths the commanded speed and then stride-matches to the smoothed
number, so it is **late by construction**. The search just picks a frame that is
already going that fast.

Note what this is not: the matcher is not *faster*, it is *earlier*. On a command
to speed up it is away first and pulls ahead; on a command to slow down it slows
first and drops behind. In the steady state the blend tree is very slightly the
more accurate of the two.

---

## API

```ts
import { MotionMatcher, buildMotionDatabase, matchFrame, queryFeature } from 'anima3d';

const matcher = new MotionMatcher(rig);
game.onUpdate(({ delta }) => matcher.update(delta, agent.velocity));
```

`buildMotionDatabase(rig)` samples the rig's own procedural clips at a set of
playback rates — 528 frames from three clips, and a continuum of speeds without
capturing anything, because the clips are in-place and stride-matched.
`matchFrame` is a plain squared distance over fifteen lengths. `MotionMatcher`
plays the chosen frame forward and searches every tenth of a step.

Playground: **`matching`** — the same command to a matcher and a blend tree, each
travelling at the speed its own feet are doing.

---

## What the gate found

1. **One shared time constant for two different velocities.** The travel term
   was too quiet to overcome pose continuity, and the character stood in idle
   through every command, at a mean speed error of 1.27 m/s.

2. **A stale query.** The search was built from the pose left over at the end of
   the previous frame while the clock had already moved on, so it described
   where the character *had been* and duly retrieved a frame that far behind.
   85 of 85 threshold-crossing searches came back **backwards**, by a median of
   0.018 of a cycle — which is 1/60 s at a one-second cycle, exactly the frame
   it was stale by. It read as a 29% pop rate that no amount of blending would
   have fixed, because nothing was wrong with the choice.

3. **The smoothing was making a second seam.** Two attempts at hiding a jump
   both failed the joint-speed budget: a per-bone quaternion offset (2.17 rad of
   forearm in one frame, cause never found), then a live cross-fade between two
   frames, which has no honest source pose when a second jump lands mid-fade
   (1.48 rad). Refusing the second jump closed the hole and cost the
   responsiveness the search was bought for — 0.13 s became 0.33 and lost to the
   blend tree outright. What shipped freezes the pixels instead.

4. **The query was reading its own smoothing.** Taking it from the faded pose put
   the controller in a loop with itself: the render lags, so the query says the
   feet are behind the clip, so the search disagrees and jumps, which starts
   another fade. 15 pops a second, 76% of every search, and it never once
   answered a command. The database's features are raw clip poses, so the query
   has to be one too.

5. **The pop rate depended on the frame rate.** What counts as a jump was a
   fixed fraction of a cycle, but one frame advances the phase by `dt × rate /
   duration`. The same controller reported 1% at 60 Hz and **39%** in a headless
   browser running at 20, and nothing was wrong except that line.

---

## And one thing this gate only reports

Alexander (1976): geometrically similar walkers move in a dynamically similar
way at equal **Froude number**, `v²/gL`. It is how a dinosaur's speed is read off
its trackway.

```
height    leg     walk m/s   step(s)   Froude
1.40    0.644     0.934   0.500    0.1381
1.60    0.736     1.068   0.500    0.1579
1.75    0.805     1.168   0.500    0.1727
1.90    0.874     1.268   0.500    0.1875
2.05    0.943     1.368   0.500    0.2023
```

ANIMA's step time is a flat **0.50 s at every body size**, so the Froude number
spreads by **46%** instead of being constant. Cadence should go as `√(L/g)` and
does not.

This matters here and not before, because a motion database is built per body: a
short character and a tall one are not answering the same command with the same
gait. It is measured, printed and not yet gated, and it is the subject of the
next release.
