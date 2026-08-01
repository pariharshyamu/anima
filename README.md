# ANIMA — humanoid characters & animation for three.js

[![CI](https://github.com/pariharshyamu/anima/actions/workflows/ci.yml/badge.svg)](https://github.com/pariharshyamu/anima/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/anima3d.svg)](https://www.npmjs.com/package/anima3d)

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
- **`createLocomotionClips(rig, gait?)`** — idle, walk and run `AnimationClip`s synthesized from gait parameters: hip swing, a knee curve whose stance half is **solved** for the flattest pelvis and whose swing half peaks a third of the way through it, ankle leveling, arm counter-swing, pelvis/chest counter-twist, run lean. No authored bob, no stride factor: ground speed is the ankle's own travel, taken from the leg's forward kinematics, and `npm run skate` gates both the stride and how far the pelvis bounces (2.1% of body height walking, 5.0% running — it was 5.4% and 13.3%).
- **`Locomotion`** — the 1D blend controller: smoothed speed in, weighted actions out, with phase sync across the walk↔run blend and stride-matched `timeScale`. Exposes `weights` and `speed` for debugging.
- **`measureFootSkate(rig, clip, { speed })`** — foot skate as a number. Drives a real `AnimationMixer` over the real bones, reads world positions, and reports the stride the clip *actually* delivers against the speed it claims: `mismatch` is the gate, `slipPerStep` is the same fact in centimetres, `spread` catches feet that disagree with each other. Structural in its rig argument, so it measures a GLB's skeleton as happily as ANIMA's own. `npm run skate` is the gate built on it, and it is deliberately independent of the closed-form geometry that declares the speeds — a metric derived from the formula it checks proves only that two copies agree.

- **`OUTFITS`** — palette pools (villager, guard, winter) the generator picks from per seed, so a crowd looks like inhabitants of the same place while every individual differs.
- **`FootIK`** — closed-form two-bone leg IK that plants each foot on the actual ground under it (SCENA's `terrain.heightAt` drops straight in), eases the pelvis toward the lower foot on slopes, preserves the clip's swing lift, and ignores sub-perceptual ripples (deadzone) so straight legs don't over-bend.
- **`LookAt`** — a clamped, smoothed gaze chain distributing yaw/pitch across chest → neck → head on top of the animation; targets behind the back are ignored.
- **Overlays & masks** — `loco.overlay(clip, { bones })` layers additive clips over the gait (`createWaveClip` waves while walking; `maskClip` + `UPPER_BODY` restrict any clip to a bone set).
- **Animation events** — `loco.onFootstep((foot) => ...)` fires at each heel strike, derived from gait phase: footstep audio, dust, gameplay.
- **`retargetClip(rig, gltf.scene, clip)`** — play real animation assets (Mixamo and friends) on ANIMA bodies. The solve is exact: each frame, every mapped bone receives the source's world-rotation delta composed down the actual hierarchy — differing rest poses, extra bones (Mixamo's Spine1), centimeter units and name prefixes are all absorbed. `inPlace` strips ground-plane root motion.
- **Sockets** — `attach(rig, 'handRight', torch)`: named, height-scaled attachment points (hands, back, hips, head) that ride their bones through every animation. A SCENA prop's `.object` attaches directly.
- **Accessories** — seeded modular gear (`cap`, `hat`, `backpack`, `pouch`, `shoulderPads`) merged into the same single-draw-call body mesh; `'auto'` (default) rolls per seed, so crowds come pre-equipped.
- **`bakeVAT(rig, clip)`** — Vertex Animation Textures: a clip's skinned deformation baked into float textures (positions *and* normals, loop-seamless), replayed entirely on the GPU.
- **Body types** — `bodyType: 'feminine' | 'masculine' | 'neutral'` presets (or explicit `{ shoulders, waist, hips, chest }` multipliers): figure differences in the skeleton and silhouette, seeded across crowds.
- **Wardrobe** — garment layers, not painted-on colors: tops (`shirt · tunic · dress · jacket · apron`), bottoms (`pants · shorts · skirt`), sleeve lengths, collars, belts — seeded per character, composable with accessories, and clothing-aware (dresses bare the legs, long sleeves clothe the forearms).
- **`describeHumanoid(options)`** — the creator API: every seeded decision (figure, outfit, colors, face, hair, gear) resolved into one JSON-serializable spec. Tweak any field and feed it back — `createHumanoid(describeHumanoid(o))` is byte-identical to `createHumanoid(o)`, and every rig carries its own `description`. NPC generator and character-creator UI, one API.
- **Faces** — every character has one: eyes (seeded size/spacing/iris color), brows whose angle sets the resting expression (kind, stern, worried), nose, mouth with a smile/frown parameter, ears, and facial hair — all overridable via `face: {...}` for character-creator UIs. Faces bake into VAT crowds for free.
- **Hair** — a style catalog (`bald · cap · side-part · bob · ponytail · bun · long · spiky`) with seeded style + color; hats force sensible short hair unless a style is explicit.
- **`Crowd`** — background characters at scale: N seeded villagers as a handful of VAT `InstancedMesh`es — no skeletons, no mixers, no per-character CPU cost. Per-instance phase offsets and tints keep shared bodies looking individual; `crowd.followRoute(road.route, { surface: terrain.heightAt })` sends the whole crowd walking a SCENA road at the bake's stride-matched speed. Heroes stay heroes: full rigs near the camera, the crowd fills the distance.

- **`Cockpit`** — the body of somebody strapped to an aeroplane, and the exact mirror of `SeaLegs`: a sailor stands *up out of* a deck's frame, a pilot is **bolted into** the airframe's and goes inverted with it. What is left is the four things a pilot still owns — the **weight** (`1/cos(bank)` in the turn plus `V·q/g` in the pull, sagging the head and compressing the spine into the seat, floating the body off the cushion at zero g), the **gaze** that leads the aeroplane (computed in the aircraft's frame, because half a dogfight is spent inverted), the **cost of both together** (gaze authority falls as load rises), and **losing it** — greyout, G-LOC, and a recovery that lags the g coming off. Consumes GAMA's `FlightController`/`HoverController` structurally: `{ pitch, bank, speed }`.

- **`Cricketer`** — the bowling action (run-up, gather, braced front leg, arm coming over vertically, elbow that never bends), seven strokes, the keeper's crouch, the fielder's throw, and a batting stance that breathes. **Both hands are on the bat**: strokes are authored as a path for the grip and a direction for the blade, and the arms are *solved* onto it with two-bone IK, so the grip is an invariant rather than a coincidence — and `batPoint()` gives a game something real to collide a ball against. `holdBat(bat)` drives a bat from that grip; it can never leave the hands.

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
- [x] v0.6 "The Wardrobe": body types, garment layers (dresses, tunics, jackets, skirts, belts, collars), and the `describeHumanoid` creator API with byte-identical round-trips
- [x] v0.35 "The Reaction": `Reactions` — directional flinch/stagger, crumple-and-kneel knockout, get-up, celebrate & dejected, applied capture-and-restore after the mixer so nothing drifts; wired to GAMA `Health` events ([docs](docs/reactions.md))
- [x] v0.36 "The Lamplighter": the lighting arc's payoff demo — a villager makes dusk rounds with a hand lantern (socket-attached SCENA `createLanternLight`, its claim in the same `LightBudget` as the street lamps), lighting each lamp by the same `setLit` a photocell or a lever would use; deps to gama3d 0.31 / scena3d 0.98
- [x] v0.37 "The Sortie": `Cockpit` — a pilot strapped into a SCENA fighter, wearing the g GAMA's flight model is pulling; plus the `pilot` pose (stick hand in on the centreline, throttle hand out on the quadrant) and the aviation arc's finale playground, where all three libraries fly one dogfight over the airfield ([docs](docs/craft.md))

## Development

```bash
npm install
npm test          # 439 vitest unit tests (skeleton, skinning, clips, blending, IK, gaze, overlays, events, retargeting, sockets, gear, VAT, crowds)
npm run typecheck
npm run build     # tsup → dist (ESM + CJS + d.ts)
npm run dev       # the ANIMA × GAMA × SCENA parade demo
npm run dev:portrait  # the character gallery (?seed=N · ?wardrobe=1 · ?view=face)
npm run dev:hoops     # MEADOW HOOPS — a complete single-file basketball game (all three libraries)
```

And the two parts a unit test cannot do. A clip's numbers can be right while
the knee bends backwards:

```bash
npm run verify:playgrounds   # every example, headless, measured by pixels
```

…and a clip can look perfect in every still frame while the feet slide along
the ground, which is the loudest thing a procedural character does wrong:

```bash
npm run skate     # foot skate, measured from the bones, against declared speed
npm run climb     # hands on rungs
npm run parkour   # hands and feet on the wall, and the landing on the floor
npm run mood      # a layer that is monotone, bounded, and given back
npm run lifting   # a bar over mid-foot, a rep that is not a sine, a set that decays
npm run dining    # the fork reaches the mouth, and the spoon still has soup on it
npm run archery   # the anchor holds, and the arrows group by exactly as much as it moved
```

`skate` has found three shipped defects — a run stride factor nobody had measured
(18.4% of slide), a constant the horse's poser and speed formula disagreed
about (8.5%), and keyframe density that quietly followed the playback rate
(skate doubled at 1.4× tempo). See [docs/skate.md](docs/skate.md).

All of them run in CI on every push
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Release notes live in
[CHANGELOG.md](CHANGELOG.md).

## License

MIT
