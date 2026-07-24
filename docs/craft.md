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

**No hand IK — and that's a feature.** The exported `GRIPS` constants standardize where wheels, handlebars and seats sit relative to a slot's anchor; SCENA props are *built to those offsets*, so hands land on steering wheels by construction. `furnishRoom`'s sit/sleep/work markers are slots waiting to happen: stand an anchor on one and villagers sit at the benches they've been standing beside since 0.31.
