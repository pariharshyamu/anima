# Cricket: the actions, not the game

A cricket body does three things nothing else in this library does, and each is a whole-body **sequence** rather than a loop: the bowling action, the stroke, and the keeper's crouch.

```js
import { createHumanoid, Locomotion, Cricketer } from 'anima3d';

const rig = createHumanoid({ seed: 21 });
const loco = new Locomotion(rig);
const player = new Cricketer(rig, loco);

player.stance();               // take guard, and wait
player.play('cut');            // one stroke
player.bowl();                 // run in and bowl
player.keep();                 // and hold the crouch

game.onUpdate((t) => {
  player.update(t.delta);
  loco.update(t.delta, velocity);
  player.lateUpdate();         // AFTER the gait — see below
});
```

The controller is deliberately event-shaped. It does not know about balls, runs or overs; it tells you the instant the ball leaves the hand and the instant the bat is at the point of contact, and a game — GAMA's `CricketMatch`, or your own — does the rest.

```js
player.onRelease(() => match.bowl(player.releasePoint()));
player.onContact(() => bowlerReacts());
player.onDone((action) => player.stance());
```

## The bowling action

Run-up, gather, a leap with the body side-on, a braced front leg, and the arm coming over vertically past the ear. **The arm never bends** — that is the law as well as the look, and a test asserts it.

The clip is one-shot and the release is at a fixed phase, `RELEASE_PHASE = 0.62`, just past the vertical, because everything downstream — the ball leaving, the umpire's call, the batter's cue — has to agree about when the ball is out of the hand. A controller that guesses is a controller that drifts.

The swing is measured as an **offset from vertical**, not as an absolute angle: −π in the gather, 0 at release, positive after. Getting that backwards puts the hand below the knees at the moment of release, which is why there is a test that the hand passes above the head.

`arm: -1` bowls left-arm, and mirrors the release point.

## The strokes

Seven of them — `SHOTS` lists them in the order a coach would teach:

| | |
|---|---|
| `defend` | bat angled down, soft hands, no follow-through |
| `drive` | straight bat, down the ground, high elbow, high finish |
| `flick` | the same vertical bat, wrists rolled, worked away off the pads |
| `cut` | horizontal bat, back foot, late, square on the off side |
| `pull` | horizontal bat, across the line, into the leg side |
| `sweep` | down on one knee, bat along the turf, round the corner |
| `loft` | everything, upward: the swing that clears the rope or misses |

Contact is at `CONTACT_PHASE = 0.45` of the clip.

## Both hands are on the bat

The strokes used to be composed out of per-bone Euler angles, and it showed: the top hand went where the formula sent it and the bottom hand went somewhere else, so the batter held the bat one-handed, like a briefcase. A real cricketer holds it with **both hands**, and both hands are on the same 11 cm of handle in every frame of every stroke.

So a stroke is authored the way it actually looks — as a path for the **grip** and a direction for the **blade**, through three keys: the backlift, the point of contact, and the finish. The clip animates the *body*; the arms are then **solved** onto the path with closed-form two-bone IK. That makes the grip an invariant rather than a coincidence, and it makes the bat's position something a game can collide a ball against.

```js
import { swingAt, SWINGS, STANCE_KEY, ARM_REACH } from 'anima3d';

swingAt('cut', 0.45);     // { grip, blade } at the point of contact
```

Everything is in the **chest's** space, not the body's — because that is where a batter's hands live. The shoulders sit at a fixed (±0.213, 0.169, 0) from the chest bone whatever the clip is doing, and each arm reaches `ARM_REACH` (0.498 m on a 1.78 m body), so a grip authored there is reachable by both arms *by construction*. Author it in root space instead and the torso turn slides the hands out of reach halfway through every stroke. A test walks every key and asserts both arms can get there — mirrored as well, for a left-hander.

`lateUpdate()` does the solving, and like `FootIK` it must run **after** `Locomotion.update`: the clip has to be sampled before anything can be solved on top of it.

### Holding a bat

```js
player.holdBat(bat.object, { grip: 0.7 });
```

The bat is re-parented to the rig and driven from the grip every `lateUpdate`, so nothing has to animate it and it can never drift out of the hands. `grip` is how far along the object's own +Y the handle is — for a bat modelled with its toe at the origin and the blade running up +Y, as SCENA's `createBat` is, that is a little over the blade length.

### Where the bat is

```js
player.gripPoint();   // the hands, world space
player.batPoint();    // the middle of the blade — collide a ball with this
```

`batPoint` is what makes the choice of stroke a decision rather than a flavour. The strokes meet the ball at genuinely different places: a sweep at ankle height and a foot to leg, a pull off the chest, a cut out towards point. Hand `batPoint` to GAMA's `CricketMatch` as its `bat` probe and sweeping a bouncer misses under it, exactly as it should.

## The stance

A batter between balls is on screen half the time, and a rig at rest holds the bat out sideways. `stance()` is a held, breathing pose — side-on, knees soft, weight forward, head turned back down the pitch — whose hands are already **where a stroke starts**, so no shot has to snatch the bat into place. Like `keep()` it holds until something else takes over.

## Keeping and fielding

`keep()` is the crouch, and it breathes, because a keeper waiting is not a statue. `field()` is a gather and a throw — the fielder's one job that reads at a hundred metres.

`stand()` gives the body straight back to `Locomotion`.
