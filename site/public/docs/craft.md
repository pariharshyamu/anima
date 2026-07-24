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

Six procedural **poses** ship (`createPoseClip`): `sit` / `sitLow` / `straddle`, `sleep` (a slow breathing loop — the *anchor* supplies the lying orientation), `drive` (hands at the standard wheel), and `cycle` (one crank revolution per loop — `setRate` is the cadence). Three **arm loops** layer on top via `loop:` — `strum`, `hammer`, `knead` — so a bench slot with `loop: 'strum'` is a guitarist, and a smithy's anvil `work` marker finally swings a hammer.

Blending is honest: the pose crossfades against the whole gait via `Locomotion.influence`, the root tweens in the rig's **parent space** (rooms and vehicles welcome), and GAMA still owns getting there — walk to the slot with an agent, `use()` on arrival.

**No hand IK — and that's a feature.** The exported `GRIPS` constants standardize where wheels, handlebars and seats sit relative to a slot's anchor; SCENA props are *built to those offsets*, so hands land on steering wheels by construction. `furnishRoom`'s sit/sleep/work markers are slots waiting to happen: stand an anchor on one and villagers sit at the benches they've been standing beside since 0.31.
