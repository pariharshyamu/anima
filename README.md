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
- [ ] v0.2 "The Craft": foot IK + terrain planting, look-at chains, animation layers + bone masks, animation events, richer gait styling
- [ ] v0.3 "The Others": Mixamo/glTF retargeting adapter, attachment sockets, modular outfit variation
- [ ] v0.4 "The Crowd": vertex-animation-texture baking, crowd LOD tiers, village population presets

## Development

```bash
npm install
npm test          # 16 vitest unit tests (skeleton, skinning, clips, blending)
npm run typecheck
npm run build     # tsup → dist (ESM + CJS + d.ts)
npm run dev       # the ANIMA × GAMA × SCENA parade demo
```

## License

MIT
