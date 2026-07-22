# ANIMA — humanoid characters & animation for three.js

**ANIMA** gives three.js games *people*: seeded rigged humanoid bodies, procedurally-synthesized locomotion clips, and a blending locomotion controller — no model files, no animation files, no dependencies beyond three.js.

three.js renders. [GAMA](https://github.com/pariharshyamu/gama) makes it a game. [SCENA](https://github.com/pariharshyamu/scena) gives it a world. **ANIMA gives it people.**

## Install

```bash
npm install anima3d three
```

## A walking character in six lines

```ts
import { createHumanoid, Locomotion } from 'anima3d';

const villager = createHumanoid({ seed: 7 });   // rigged, skinned, outfitted
scene.add(villager.object);

const loco = new Locomotion(villager);          // idle/walk/run synthesized from the rig
onFrame((dt, velocity) => loco.update(dt, velocity));
```

Feed `update()` any velocity — a plain speed, or GAMA's `agent.velocity` directly — and the controller blends idle ↔ walk ↔ run, keeps the two gaits phase-synchronized, and stride-matches playback so feet grip the ground instead of sliding.

## What's inside

- **`createHumanoid({ seed, height, build, palette })`** — a seeded, stylized low-poly humanoid: 19-bone animation-ready skeleton (identity rest rotations, T-pose bind, feet on y = 0), one vertex-colored `SkinnedMesh` (a single draw call), seeded proportions and outfit colors. Same seed, same person; a crowd is a `for` loop.
- **`createLocomotionClips(rig, gait?)`** — idle, walk and run `AnimationClip`s synthesized from gait parameters: hip swing, knee flexion timed to the swing phase, ankle leveling, arm counter-swing with elbow bend, pelvis/chest counter-twist, hip bob, run lean. Loop-seamless, in-place, deterministic; reference ground speeds are derived from the rig's leg length for stride matching.
- **`Locomotion`** — the 1D blend controller: smoothed speed in, weighted actions out, with phase sync across the walk↔run blend and stride-matched `timeScale`. Exposes `weights` and `speed` for debugging.
- **`OUTFITS`** — palette pools (villager, guard, winter) the generator picks from per seed, so a crowd looks like inhabitants of the same place while every individual differs.
- **`FootIK`** — closed-form two-bone leg IK that plants each foot on the actual ground under it (SCENA's `terrain.heightAt` drops straight in), eases the pelvis toward the lower foot on slopes, preserves the clip's swing lift, and ignores sub-perceptual ripples (deadzone) so straight legs don't over-bend.
- **`LookAt`** — a clamped, smoothed gaze chain distributing yaw/pitch across chest → neck → head on top of the animation; targets behind the back are ignored.
- **Overlays & masks** — `loco.overlay(clip, { bones })` layers additive clips over the gait (`createWaveClip` waves while walking; `maskClip` + `UPPER_BODY` restrict any clip to a bone set).
- **Animation events** — `loco.onFootstep((foot) => ...)` fires at each heel strike, derived from gait phase: footstep audio, dust, gameplay.
- **`retargetClip(rig, gltf.scene, clip)`** — play real animation assets (Mixamo and friends) on ANIMA bodies. The solve is exact: each frame, every mapped bone receives the source's world-rotation delta composed down the actual hierarchy — differing rest poses, extra bones (Mixamo's Spine1), centimeter units and name prefixes are all absorbed. `inPlace` strips ground-plane root motion.
- **Sockets** — `attach(rig, 'handRight', torch)`: named, height-scaled attachment points (hands, back, hips, head) that ride their bones through every animation. A SCENA prop's `.object` attaches directly.
- **Accessories** — seeded modular gear (`cap`, `hat`, `backpack`, `pouch`, `shoulderPads`) merged into the same single-draw-call body mesh; `'auto'` (default) rolls per seed, so crowds come pre-equipped.
- **`bakeVAT(rig, clip)`** — Vertex Animation Textures: a clip's skinned deformation baked into float textures (positions *and* normals, loop-seamless), replayed entirely on the GPU.
- **Faces** — every character has one: eyes (seeded size/spacing/iris color), brows whose angle sets the resting expression (kind, stern, worried), nose, mouth with a smile/frown parameter, ears, and facial hair — all overridable via `face: {...}` for character-creator UIs. Faces bake into VAT crowds for free.
- **Hair** — a style catalog (`bald · cap · side-part · bob · ponytail · bun · long · spiky`) with seeded style + color; hats force sensible short hair unless a style is explicit.
- **`Crowd`** — background characters at scale: N seeded villagers as a handful of VAT `InstancedMesh`es — no skeletons, no mixers, no per-character CPU cost. Per-instance phase offsets and tints keep shared bodies looking individual; `crowd.followRoute(road.route, { surface: terrain.heightAt })` sends the whole crowd walking a SCENA road at the bake's stride-matched speed. Heroes stay heroes: full rigs near the camera, the crowd fills the distance.

## The family handshake

Nothing imports anything — the shapes are structural:

```ts
const rig = createHumanoid({ seed: 7 });
const agent = walker.addComponent(new MotionAgent({ maxSpeed: 1.5, planar: true })); // GAMA
agent.addBehavior(new FollowPath(new Path(road.route, true), 1.5));                  // SCENA road
game.onUpdate((t) => {
  walker.position.y = terrain.heightAt(walker.position.x, walker.position.z);       // SCENA ground
  loco.update(t.delta, agent.velocity);                                             // ANIMA legs
});
```

Run the trio demo: `npm run dev` — seeded villagers strolling a SCENA road on GAMA steering, a runner overtaking them, and an idle cast lineup breathing by the clearing. `?follow=0..3` tracks a traveler up close; `?cam=`, `?r=`, `?h=` set the orbit.

## Principles

- **Playable before assets exist.** The placeholder era shouldn't look like capsules. Bodies, gaits and variety come from seeds; real art replaces them later, if ever.
- **Seeded determinism.** `Math.random` appears nowhere. Same seed → identical character and identical clips, across machines.
- **The controller outlives the assets.** `Locomotion` doesn't care that today's clips are synthesized — retargeted Mixamo clips will drop into the same slots.
- **A skeleton built for the future.** Identity rest rotations and a canonical bone set make procedural clip math simple now, and retargeting corrections explicit later.

## Roadmap

- [x] v0.1 "The Body": seeded rigged humanoid, procedural idle/walk/run, blending locomotion controller, GAMA/SCENA handshake
- [x] v0.2 "The Craft": foot IK with terrain planting + slope pelvis, look-at chains, additive overlays with bone masks, footstep events
- [x] v0.3 "The Others": exact Mixamo/glTF clip retargeting, attachment sockets, seeded modular accessories
- [x] v0.4 "The Crowd": VAT baking (positions + normals), instanced crowds with per-instance phase/tint, route-following walkers
- [x] v0.5 "The Face": eyes/brows/nose/mouth/ears, resting expressions, hair style catalog, facial hair — seeded and overridable
- [ ] v0.6 "The Wardrobe": body types (feminine/masculine/neutral), garment layers (dresses, tunics, skirts, sleeves), outfit presets, `describeHumanoid` creator API

## Development

```bash
npm install
npm test          # 49 vitest unit tests (skeleton, skinning, clips, blending, IK, gaze, overlays, events, retargeting, sockets, gear, VAT, crowds)
npm run typecheck
npm run build     # tsup → dist (ESM + CJS + d.ts)
npm run dev       # the ANIMA × GAMA × SCENA parade demo
npm run dev:portrait  # the face gallery (?seed=N reseeds the row)
```

## License

MIT
