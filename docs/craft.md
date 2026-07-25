# IK, gaze, overlays, events

The layer that separates demos from production. Everything here applies **on top of** the animated pose, after `Locomotion.update`.

## Foot IK: terrain planting

```js
const ik = new FootIK(rig, { ground: terrain.heightAt });   // SCENA drops straight in
game.onUpdate((t) => { loco.update(t.delta, v); ik.update(); });
```

Closed-form two-bone leg IK plants each foot on the actual ground under it. It works in **terrain deltas**, so the clip's swing lift is preserved; the pelvis eases toward the lower foot on slopes (`hipsAdapt`); and a deadzone (default 2.5 cm) ignores sub-perceptual ripples — near-straight legs need large knee bends to absorb even tiny height changes (the two-link cosine is singular at full extension), so without it flat ground reads as crouching.

## LookAt: gaze chains

```js
const gaze = new LookAt(rig);
gaze.target = ball.position;          // Vector3 or Object3D; null eases back
game.onUpdate((t) => gaze.update(t.delta));
```

Clamped, smoothed gaze distributed across Chest → Neck → Head (15/25/60 by default) on top of the animation. Targets behind the back are ignored — people don't owl-turn. It is remarkable how much *alive* one moving head makes a character feel.

## Overlays & bone masks

```js
loco.overlay(createWaveClip(rig), { loop: false });          // wave while walking
loco.overlay(clip, { bones: UPPER_BODY, weight: 0.8 });      // masked layer
```

`overlay()` layers clips over the gait. **Additive** clips (deltas from their own neutral first frame — see `createWaveClip`, or `AnimationUtils.makeClipAdditive` for your own) blend cleanly over moving limbs; `maskClip(clip, bones)` restricts any clip to a bone set (`UPPER_BODY` ships as a preset). Non-looping overlays fade themselves out; `stopOverlay(action)` fades one manually. The basketball demo's jump-shot is a 20-line additive overlay authored inline.

## Interactions: using the world's props

Characters don't just walk past furniture anymore. An **interaction slot** — published structurally by a SCENA prop or authored by hand — says where a body goes and what it does there:

```js
const slot = { anchor, pose: 'sit' };        // anchor: an Object3D at floor level, +z = facing
const interaction = new Interaction(rig, loco);
interaction.use(slot);                        // tween onto the anchor, pose takes over
game.onUpdate((t) => { loco.update(t.delta, agent.velocity); interaction.update(t.delta); });
interaction.release();                        // hand the body back to locomotion
```

Seven procedural **poses** ship (`createPoseClip`): `sit` / `sitLow` / `straddle`, `sleep` (a slow breathing loop — the *anchor* supplies the lying orientation), `drive` (hands at the standard wheel), `cycle` (one crank revolution per loop — `setRate` is the cadence), and `operate` (standing at a control, forearms raised — for consoles, levers and machines). Seven **arm/upper-body loops** (`createLoopClip`) layer over a pose or the gait — `strum`, `hammer`, `knead`, and the work-station actions `chop`, `mine`, `saw`, `stir`. Layer them over a *held pose* via `loop:` (a bench slot with `loop: 'strum'` is a guitarist), or — for the whole-body work actions — over the **idle** stance directly:

```js
// A worker at a SCENA station: the loop owns the arms, so overlay it on idle
// (don't also hold `operate`, or the two fight for the same bones).
worker.rotation.y = faceToward(station);
const swing = loco.overlay(createLoopClip(rig, station.action)); // 'chop' | 'mine' | 'saw' | 'stir'
loco.stopOverlay(swing);                                          // when they down tools
```

### One-shot gestures: `Gesture`

Where `Interaction` *holds* a pose, a **`Gesture`** plays once and is gone — a reach, a knock, a press — layered over whatever the body is doing. Its point is the moment it fires `onApex`, where you actuate a SCENA **manipulable** so the hand and the mechanism move together:

```js
const reach = new Gesture(loco, createReachClip(rig), { onApex: () => lever.toggle() });
game.onUpdate((t) => { loco.update(t.delta, vel); if (!reach.done) reach.update(t.delta); });
```

`createReachClip` is an additive arm/chest overlay (the near arm extends forward and returns, peaking mid-clip); `apexAt` tunes when the callback fires. This is the ANIMA half of the **manipulables** verb — SCENA builds the door/lever/portcullis, GAMA wires the level logic, and the reach is what actuates it on screen. See the **manipulables** example.

### Carrying things: `Carry`

Pick a thing up and it rides the body — hands landing on it by construction — **carried while walking**; put it down, hand it off, or let GAMA throw it. A **`Holdable`** is anything with `{ object, carry?, grip? }` (SCENA's carryables satisfy it):

```js
const carry = new Carry(rig, loco);
carry.pickUp(crate);                       // rides the chest; both hands on it
game.onUpdate((t) => loco.update(t.delta, agent.velocity)); // still walking, still holding
const box = carry.putDown({ at: table });  // set it down, or hand `box` to throwObject
carry.handTo(otherCarry);                  // pass it straight to a mate
```

The carry pose is a masked arm (and, for weight, chest) overlay over the gait — the legs keep walking. Four styles pick the posture and where the thing rides: `crate` (hugged to the chest), `tray` (out at the belly), `shoulder` (hoisted up, one hand steadying), and `side` (hanging from one hand, the other arm free to swing). `createCarryClip(rig, style)` is the clip if you want it directly. Pair with GAMA's `throwObject` for the release arc — see the **carryables** example.

Blending is honest: the pose crossfades against the whole gait via `Locomotion.influence`, the root tweens in the rig's **parent space** (rooms and vehicles welcome), and GAMA still owns getting there — walk to the slot with an agent, `use()` on arrival.

### Sitting down like a person

A body that translates into a chair without ever standing beside it is the most obvious tell in a scene full of NPCs. When a slot publishes an **`approach`** anchor (SCENA's gatherings do), `use()` stages the move the way sitting actually works:

```ts
interaction.use(seat, { settle: 0.7 });   // arrive → turn → lower
interaction.phase;                        // 'arriving' | 'settling' | 'held' | 'leaving'
interaction.release();                    // rise and step clear, then locomotion resumes
```

The body walks to the spot beside the chair and turns to face out — **still standing**, pose weight zero — and only on the last beat does it move back onto the seat while the sit fades in. `release()` reverses it: standing up is a movement too, and characters who dissolve out of chairs give the game away as surely as ones who slide into them. Slots with no `approach` (a driver's seat, a helm) behave exactly as before, and `{ approach: false }` opts out.

### Mannerisms: the body that never quite holds still

A standing person is never still. They unload one hip and then the other, roll a shoulder, glance at nothing, scratch their neck. None of it means anything, all of it is constant, and its **absence** is what makes an idle character read as switched off.

```ts
const habits = new Mannerisms(rig, loco, { seed: villager.seed });
habits.context = 'seated';                  // switch repertoire when they sit down
game.onUpdate((t) => { loco.update(t.delta, v); habits.update(t.delta); });
```

Eight small additive one-shots — `weightShift`, `shoulderRoll`, `headTurn`, `scratch`, `stretch`, `leanBack`, `leanIn`, `fidget` — fire on an uneven, exponential schedule, so a row of characters never twitches in unison. Each is a few centimetres of bone rotation, because that is the scale real idle motion happens at; anything you can clearly read *as a gesture* is already too big to repeat every few seconds. Give it **the same seed as the humanoid** and restlessness, favourite mannerisms and leading side become part of that character — one villager fidgets constantly, another barely moves, and they stay that way. They suppress themselves while walking (the gait is motion enough) and resume at the next pause.

### Conversation: turn-taking gaze

The cheapest thing that turns several seated bodies into a group. It writes `gaze.target` and nothing else — `LookAt` still does the turning, clamping and smoothing.

```ts
const chat = new Conversation(
  diners.map((d) => ({ gaze: d.gaze, head: d.rig.bones.Head })),
  { focus: table.focus }                       // SCENA's gathering focus
);
game.onUpdate((t) => { chat.update(t.delta); for (const d of diners) d.gaze.update(t.delta); });
```

What it encodes is the real asymmetry of talking: **listeners watch the speaker far more than the speaker watches any one listener.** Whoever holds the floor sweeps the group and looks away to think; the listeners hold a steady gaze on them — but not all of them, not perfectly, and never all snapping across on the same frame. Turns are wildly uneven (a one-word answer, then a long story), and each listener takes their own beat to notice the floor has changed hands. Every one of those hedges is doing work: a table that turns in unison reads as radio-controlled. `handOver(i)` forces the floor, `onTurn` fires when it changes, and `enabled = false` freezes everyone's gaze where it is. See the **gatherings** example.

**No hand IK — and that's a feature.** The exported `GRIPS` constants standardize where wheels, handlebars and seats sit relative to a slot's anchor; SCENA props are *built to those offsets*, so hands land on steering wheels by construction. `furnishRoom`'s sit/sleep/work markers are slots waiting to happen: stand an anchor on one and villagers sit at the benches they've been standing beside since 0.31.

## Quadrupeds: the horse

ANIMA's first non-humanoid body. `createQuadruped` builds a rigged, skinned horse (or `pony`, `draft`, `donkey`) from the same low-poly primitives as a humanoid, laid out to real horse proportions — measured, as horse people measure, in fractions of **withers height**.

```js
const horse = createQuadruped({ seed: 3, coat: 'bay', marking: 'blaze' });
const gaits = new QuadrupedLocomotion(horse);
game.onUpdate((t) => gaits.update(t.delta, ride.speed));  // it picks its own gait
```

Two details decide whether a quadruped reads as an animal:

- **The hind-leg zigzag.** A horse's femur points down and *forward* to the stifle, the tibia runs down and *back* to the hock, and the cannon drops forward again. The foreleg does the opposite. Straighten those and you have a table with legs, however good the animation on top is.
- **A bay is not "brown".** It is a brown body with **black points** — mane, tail and lower legs. Eight coats ship (`bay`, `darkBay`, `chestnut`, `black`, `grey`, `palomino`, `dun`, `buckskin`), with dorsal stripes on the duns, seeded socks and four face markings.

### Gaits: the footfalls are the gait

`createGaitClips` synthesizes the four natural gaits, and what makes them right is the **order the feet land in** — not the secondary motion:

| gait | beats | footfall | duty |
| --- | --- | --- | --- |
| walk | 4 | **lateral**: LH, LF, RH, RF | 0.62 — never fewer than two feet down |
| trot | 2 | **diagonal pairs**: LF+RH, then RF+LH | 0.42 |
| canter | 3 | LH, then RH+LF together, then the leading RF | 0.35 |
| gallop | 4 | LH, RH, LF, RF, then suspension | 0.27 — a moment with no feet down at all |

A horse whose diagonals are out of sync reads as *broken* to anyone who has watched one move, and obscurely wrong to everyone else. Two further things fall out of that table rather than being tuned by eye:

- **Body height comes from the legs.** A limb swung as a rigid pendulum sweeps its foot along an arc; hold the body still and the hoof rises at both ends of the stance. But the foot is the fixed thing — the *body* vaults up and over the supporting limb. So the ride height is derived from whichever planted limb props the body highest, then smoothed, because a body has mass and cannot turn corners at every footfall.
- **Horses nod at walk and canter and stay level at the trot.** That is precisely why a rider can post to a trot and not to a canter, and it is the most visible thing to get backwards.
- **Ground speed is arithmetic, not a setting.** While a hoof is planted it sweeps a fixed arc under the body (`2·R·sin(reach)`), and the body must cover exactly that in exactly the time the hoof is down (`duty × duration`). Declaring a stride length by hand instead is the classic way to end up with a horse skating along the ground with its legs cycling uselessly — so `gaitSpeed` derives it, and fore and hind limbs are angled to sweep the *same* distance (a horse "tracks up": the hind foot lands in the print the forefoot just left).

`QuadrupedLocomotion` takes a speed and picks the gait, because horses **change** gait rather than blending — there is no such thing as half a trot — then stride-matches *within* the gait so hooves don't skate.

## Riding

```js
const mount = new Mount(rig, loco);
mount.mount(horse);                       // the whole get-on sequence
mount.followGait(gaits.gait, strideRate); // sit / post / two-point
mount.dismount();
```

**Mounting** is a sequence with a shape, not a teleport: stand at the near shoulder facing the tail and take the saddle (`reaching`) → left foot in the stirrup and push up (`stirrup`) → right leg over the croup (`swinging`) → sink into the seat (`seated`). Riders mount from the horse's **left** by convention old enough to come from wearing a sword on the left hip. Once seated the rider is parented to the horse's `saddle` fixture, so they ride whatever it does.

**The seat changes with the gait**, and using the wrong one is instantly readable: `seat` (deep, for walk and canter), `posting` (the rising trot — up and down once per stride, locked to the trot's own rhythm), and `twoPoint` (out of the saddle and folded forward, for the gallop). Heels down throughout, hands forward where the reins actually are.

## Climbing a ladder

```js
const climb = new Climb(rig, loco);
climb.start(ladder);          // SCENA's createLadder fits structurally
```

Real climbing is **contralateral** — left hand moves with the *right* foot, then right hand with left foot — the same cross-body pattern as walking, and the reason is that it keeps the centre of mass over the supporting diagonal. Three points of contact are held at all times. `Climb` locks the clip to the translation (two rungs per cycle) so hands arrive where rungs actually are, and finishes with a proper **top-out**: fold over the edge, one knee up, press and stand. Cut that and the character rides the last metre like a lift.

## Watching a screen

`LookAt` will happily point a character's head at a television and hold it there. The result is unmistakably a mannequin — nobody watches anything that way.

```ts
const gaze = new LookAt(rig);
const watch = new Watching(rig, gaze, { engagement: 0.8 });
watch.watch(tv.screen);          // anything with { surface, width, height }
game.onUpdate((t) => { watch.update(t.delta); gaze.update(t.delta); });
```

Real attention on a screen is a sequence of small jumps around the picture with occasional trips off it entirely. So:

- **Fixations, not a stare.** A gaze point is held for a while and then jumps — saccades, not sliding. Dwell times are drawn exponentially, because a fixed interval reads as a metronome the moment there is more than one watcher in the room.
- **Biased toward the middle.** Spots are picked from a triangular distribution, which puts most fixations near the centre of the picture and few at the edges — which is where they actually land.
- **It glances away.** How often is set by `engagement`: fully engaged, almost never; distracted, every few seconds.
- **It comes back to about where it left off.** Resumed attention, not a fresh thought — a jump to a brand-new spot after a glance away reads as a change of subject.

`Watching` drives `LookAt.target` and nothing else, so it composes with locomotion, mannerisms and sitting exactly the way a bare gaze target does.

`Viewable` is `{ surface, width, height }` — structurally SCENA's `ScreenPanel`, so a television drops straight in with no cross-import.

## Using a phone

The handset is a few pixels across at any distance you would actually film from, so **the pose does all the work**. You do not read "she's on her phone" off the prop; you read it off the head angle, the rounded shoulders and the one raised forearm, from across a street.

```ts
const phone = new PhoneUse(rig, loco);
phone.hold(createPhone());        // anything with { object }
phone.use('scroll');
game.onUpdate((t) => {
  loco.update(t.delta, velocity.multiplyScalar(phone.walkScale));
  phone.update(t.delta);
});
```

Six postures — `scroll`, `type`, `call`, `photo`, `selfie`, `show` — plus `stow()` to pocket it (a hip socket; a phone lives in a pocket, not in mid-air).

Every pose is an **upper-body mask** overlaid on whatever the legs are doing, so walking-while-texting is the same code as standing-while-texting with a different velocity. `walkScale` is what makes it read: 0.82 while scrolling, less again for two-handed typing, and **0 for `photo` and `selfie`** — nobody walks and frames a shot.

Things worth knowing:

- **The head turns toward the hand, not just down.** Pitching the head down alone leaves a one-handed hold about 40° off the line of sight — the handset held perfectly while the character stares past it. The one-handed poses add a yaw toward the holding side; the two-handed one does not, because the phone is already on the centreline.
- **The screen is aimed at the eyes every frame.** This began as a fixed rotation per pose and was wrong in every pose: an angle that reads correctly for one arm posture is edge-on in the next, and a phone seen edge-on is a grey sliver. Solving it live is simpler and is what people do — you tilt the thing until you can see it. `show` inverts the target.
- **The pose overlay runs at weight 6, not 1.** three blends actions by *normalised* weight, so an overlay at weight 1 against the idle clip at weight 1 comes out as a 50/50 average: every arm reaches exactly halfway and a phone call ends up held at chest height with the elbow barely bent. These are replacement postures, not seasoning.
- **There are no finger bones.** The hand is one bone, so a thumb flick has to be read off the wrist — which is all that reads at any distance anyway. The flick is a quick swipe and then a pause while the eye catches up, not a sine wave.
- **Walkers glance up.** Every few seconds, exponentially spaced, the head comes level for about a second and then goes back down. Standing still, it never happens — there is nothing to check.

## Glancing

`LookAt.target` is sustained tracking: it holds until something changes it. A glance is the other thing eyes do — a phone goes off across the room, a head turns for a second, and comes back.

```ts
gaze.target = table.position;      // what they are attending to
gaze.glance(phone.position, 1.2);  // ...until this goes off
```

A glance overrides the standing target for as long as it runs and then simply expires, so nothing has to remember to put the old target back. A newer glance replaces an older one — you look at the newer thing. `endGlance()` cuts it short.

It goes through the same clamped, smoothed chain as everything else, which means it inherits the behind-the-shoulder fade: a character will not swivel their head 85° to look at something behind them. That is correct, and it is worth knowing when staging a scene — an alert placed behind a group produces no visible reaction at all, however loud it is.
