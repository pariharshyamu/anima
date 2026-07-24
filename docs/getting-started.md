# Getting started

**ANIMA** gives three.js games *people*: seeded rigged humanoid bodies with faces, figures and wardrobes; procedurally-synthesized locomotion; foot IK, gaze and overlays; Mixamo retargeting; and VAT crowds — with **zero asset files** and zero dependencies beyond three.js.

three.js renders. [GAMA](https://github.com/pariharshyamu/gama) makes it a game. [SCENA](https://github.com/pariharshyamu/scena) gives it a world. **ANIMA gives it people.**

## Install

```
npm install anima3d three
```

## A character in six lines

```js
import { createHumanoid, Locomotion } from 'anima3d';

const villager = createHumanoid({ seed: 7 });   // rigged, skinned, outfitted, with a face
scene.add(villager.object);

const loco = new Locomotion(villager);          // idle/walk/run synthesized from the rig
onFrame((dt, velocity) => loco.update(dt, velocity));
```

Feed `update()` any velocity — a number, or GAMA's `agent.velocity` directly — and the controller blends idle ↔ walk ↔ run with phase sync and stride-matched playback, so feet grip the ground instead of sliding.

## Principles

- **Playable before assets exist.** The placeholder era shouldn't look like capsules. Bodies, faces, gaits and variety come from seeds; real art replaces them later, if ever.
- **Seeded determinism.** `Math.random` appears nowhere. Same seed → identical character and identical clips, across machines — crowds can agree over a network from a few integers.
- **The controller outlives the assets.** `Locomotion` doesn't care that today's clips are synthesized — retargeted Mixamo clips drop into the same slots.
- **One draw call per character.** Everything — body, face, hair, garments, gear — merges into a single vertex-colored `SkinnedMesh`.

## Where next

- [Characters: seeds → people](./characters.md) — bodies, faces, wardrobes, the creator API
- [Locomotion & gaits](./locomotion.md) — the synthesized clips and the blend controller
- [IK, gaze, overlays, events](./craft.md) — the professional layer
- [Retargeting, sockets, gear](./assets.md) — real animation assets and carried props
- [VAT crowds at scale](./crowds.md) — sixty characters, three draw calls
- [GAMA & SCENA: the trio](./handshake.md) — the structural handshake (and a basketball game)
