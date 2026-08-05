# Sparring

The payoff, and the point of the whole fighting track: **nobody encoded the
reach advantage.**

```ts
import { createHumanoid, Fighter, measureBout } from 'anima3d';

const a = new Fighter(createHumanoid({ seed: 42 }), { style: 'boxing', skill: 0.8 });
const b = new Fighter(createHumanoid({ seed: 7 }), { style: 'muayThai', skill: 0.8 });

const report = measureBout(a, b, { rounds: 3, roundSeconds: 25 });
report.tallerAhead; // true, and nothing in here knows what "taller" means
```

---

## The decision function reads four numbers

```ts
for (const c of me.card) {
  if (c.reach < gap) continue;                    // can this limb get there
  if (headroom - c.cost <= 0) continue;           // can I afford the balance
  if (me.spent + c.fuel > me.budget) continue;    // can I afford the fuel
  const unseen = canReactTo(c.strike, them.skill) ? 1 : 1.6;
  const value = (c.impulse * unseen) / c.fuel;
  for (const zone of ['head', 'body'])
    score(value * (1 - coverageOf(them.rig, zone)));
}
```

`strikeReach`, `stability`, `canReactTo`, `coverageOf` — every one of them a
measurement some module here already makes off a real body, for its own
reasons.

**It does not read height.** Or weight, or style, or who is supposed to win.
There is no matchup table between the six styles and no hidden roll anywhere.

---

## And yet

```
reach gap   height gap   impulse ratio (longer / shorter)
   -8 mm        6 mm       0.88x
    8 mm       15 mm       1.21x
   13 mm       62 mm       2.84x
   19 mm       92 mm       2.95x
   26 mm       69 mm       4.09x
   36 mm       96 mm       3.22x
   45 mm      111 mm       4.39x
   57 mm      147 mm       4.78x
```

**The longer fighter wins 40 of 45 pairs, and the correlation between the reach
gap and the log of the result is r = 0.673.** The bigger the reach gap, the
more lopsided the bout — because a longer arm measures further, so there is a
band of distance in which one fighter can reach and the other cannot, and the
fighter who cannot has to walk through it.

### Reach is not height

Look at the first row. That fighter is **6 mm taller and 8 mm shorter in the
reach**, and they lose. Four pairs in the sweep have a height advantage and a
reach disadvantage, and **all four of them lose** — because the model tracks
limb length, which is what actually hits you, not stature.

That is gated. If a body ever comes out taller *and* longer-reaching in a pair
where it loses, the gate fails.

---

## The corner is the only memory in the bout

An attacker who can see an opening walks into it every single time, so without
memory both fighters are metronomes. The one piece of state is what a corner
would tell you between rounds:

```ts
adapt(): GuardName {
  const hurting = this.takenAt.body > this.takenAt.head ? 'body' : 'head';
  // ...and switch to whichever guard covers THAT best, on THIS body
}
```

Which guard to switch to is measured off the fighter's own `guardCard` — every
guard in the library, tried on this body — rather than picked from a table of
counters.

```
round   thrown   through   stopped
    1       62       195         0
    2       63       119        31
    3       63       115        32
    4       62       115        31
```

**Round one blocks nothing.** Both fighters open in a guard chosen by their
style, and their opponent aims at whatever it does not cover. Then they cover
it, and the incoming drops 39% and stays there. A block is worth about 99% of
the strike here — but not 100%, because `Guard` has always said a limb is not a
wall.

---

## The fatigue is a budget, not a timer

`Striking` already reports the kinetic energy of every strike in Joules. Muscle
converts chemical energy at about **20% efficiency**, and a body's anaerobic
reserve is roughly **300 J per kilogram** before power falls away. Both are
published figures rather than tuning knobs, and between them they say how many
strikes a given body has in it:

```
20.6 kJ in a 68.7 kg body; eight rounds spends 52% of it
```

A tired fighter has no debuff applied. They have spent the energy, and what
decays is what spending it costs — `skill` falls, which is the number
`Striking` reads for the kinetic chain and `Guard` reads for reaction time. And
when the tank runs low the expensive strikes simply stop being affordable, so
the last round is jabs. Nobody wrote that down either.

---

## The gate — `npm run sparring`, the twelfth

45 bouts over ten seeded bodies, three rounds each.

### What it caught

- **The defender's guard was being overwritten by the defender's own
  `Striking`, every frame.** `Striking` drives both arms; whoever updates last
  owns the hands. Running the guard first meant every fighter defended with
  their hands wherever their own last punch left them, and the guard stopped
  **0 of 83 crosses** — in a module whose own gate says a peekaboo stops a
  cross.
- **A parry triggered on declaration rather than on sight** — the exact defect
  `Guard`'s gate caught in 0.50.0, reintroduced one release later by a
  consumer of it.
- **A fighter standing at the edge of their longest reach**, so exactly one
  strike in the repertoire was ever available and the bout was 83 identical
  crosses. A metronome, not a fighter. Standing where the best-*value* strike
  works fixed it.

And one assertion of the gate's own that was simply wrong: it demanded that a
*stopped* strike deliver zero. `Guard` has never claimed that — the deeper into
a limb the line passes, the more it takes, so grazing a glove is not a block.
The assertion now checks that being blocked is worth something, which is the
thing that was actually claimed.

---

## What this is not

The six styles are **not balanced against each other and nothing here pretends
they are.** Put a karate fighter in against a boxer and let them kick freely
and they do seven times the damage, because a leg is 16% of a body and a fist
is 5% — which `Striking` gated two releases ago. That is the measurement being
honest, not a matchup being tuned.

There is also no ring. A longer fighter can retreat indefinitely, because
nothing here has ropes to put their back against.
