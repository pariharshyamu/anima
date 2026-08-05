# Fencing

The armed bout, and **it does not stand still**.

```
npm run fencing
```

---

## Why the unarmed bout could be static and this one cannot

`Sparring` stands two fighters at a fixed gap and lets them trade. That is a
measurement rig. With weapons it would be worse, because the interesting half of
any fight with a sword in it is the **footwork** — two unarmed fighters are in
range or they are not, and two armed ones spend the whole exchange arguing about
where the line is.

So everything here moves. They close, they break, they circle, they lunge into
the cut and step back out of it, and the blade sweeps because the **arm** sweeps:
`poseSwordArm` puts the hand on a real arc and `solveLimb` solves the elbow for
it. There is no clip anywhere.

---

## Tempo — from the blade's own inertia

```
τ = F · span          the couple two hands make on the hilt    (Bind)
α = τ / I             the blade's angular acceleration          (Blade)
t = √(2θ / α)         the time to sweep θ from a standing start
```

```
blade        mass    I(grip)   couple    TEMPO    measure   foot
messer      0.84kg  0.1240   16.0 N·m  0.180s   1.29 m   0.41 m/s
arming      1.14kg  0.1290   16.0 N·m  0.184s   1.38 m   0.41 m/s
sabre       1.01kg  0.1260   16.0 N·m  0.182s   1.38 m   0.41 m/s
longsword   1.62kg  0.2551   34.0 N·m  0.177s   1.60 m   0.41 m/s
spear       1.49kg  1.0870   80.0 N·m  0.239s   2.04 m   0.41 m/s
```

**Nothing in the weapon table says "speed".** It says how thick the blade is.

> A longsword is **2.0×** an arming sword to turn and has **2.1×** the couple on
> it, so the two nearly cancel — which is the entire reason a hand-and-a-half
> grip is worth the extra steel, and it comes out of `Blade` and `Bind` being
> divided by each other.

---

## Measure, and the band

```
measure = strikeReach(rig, 'jab') + bladeExtension(spec)
```

The arm's reach, which `Striking` solves from bone lengths, plus the blade past
the hand, which `Blade` gets by subtraction. Two fencers have **different**
measures, and between them is a band where one can reach and the other cannot.

That band is where a long weapon attacks from, and nobody encoded it — it is a
subtraction of two numbers, one from a bone length and one from a blade length.
Over thirty seconds a spear beats an arming sword **10–0**.

## Footwork — a leg is a pendulum

```
t_step = π · √(L / g)
```

The classic derivation of walking cadence. `rig.legLength` is measured off the
bones, so a taller fencer steps more slowly **and** further, and neither was
typed in. Step length is the stance's own fore-aft stagger, which `FightStyle`
already published for a different reason.

---

## What thirty seconds looks like

```
travelled        7.5 m and 7.0 m
gap ranged       1.10 to 3.59 m
actions          9 and 9 attacks, 9 and 9 parries
of 18 arrivals   9 were parried, and Bind decided every one
```

An attack commits on one of three openings: they are **busy** (recovering or
parrying), the gap is in **the band**, or **patience ran out**. A parry lays the
blade across the line, and `Bind` decides whether that was any use — forte on
foible throws the attack aside, the other way round does not.

---

## The bugs this found, all four of them visible only in motion

- **A standoff.** The first opening test was "attack when they are busy", and two
  fencers who are both waiting are never busy. One attack in thirty seconds.
  The reach band and a patience countdown fixed it.
- **The blade line came off a bone axis.** `Fencer.line()` read the blade's
  direction from the hand socket's local `+Y`, which is an axis of the skeleton
  and points nowhere in particular. Every crossing it gave `Bind` was arbitrary,
  and a thirty-second bout resolved **zero** parries. The fencer now states
  where its point is: along the line when attacking, across it when parrying.
- **A parry made from the hip never reaches.** With the defending hand left
  where it stands, the crossing of the two blade lines falls a few centimetres
  **past** the attacker's point, `onBoth` comes back false, and `Bind` is never
  consulted. Seven parries attempted, zero resolved. A parry is made forward —
  half an arm, measured off the body.
- **Two swordsmen chest to chest.** The lunge had nothing stopping it, so a long
  bout ended with the fencers inside each other's bodies and the two measure
  rings concentric. Only the screenshot showed it. There is now a floor at the
  two bodies' own steering radii, and the lunge stops once the point is well
  inside measure.

---

## What is checked

- **`t = √(2θI/τ)`** in closed form, and the tempo ratio between two blades as
  exactly the square root of the inertia ratio.
- **A step is `π√(L/g)`**, and a taller body steps both slower and further.
- **They moved.** More than 3 m each in 30 s, with the gap ranging over more
  than a metre. A bout where nobody walked is the thing this release exists to
  stop shipping, and it is asserted before anything about who won.
- **Every phase happens**, the action count is between 6 and 60, and at least
  one arrival was parried — so `Bind` is connected to something.
- **The bout is not a frame rate**: 60 Hz and 240 Hz agree to 50 ms of elapsed
  time and 15% of distance travelled.
