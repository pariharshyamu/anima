# Characters: seeds → people

`createHumanoid({ seed })` returns a `HumanoidRig`: a 19-bone animation-ready skeleton (identity rest rotations, T-pose bind, feet on y = 0, facing +Z), one vertex-colored `SkinnedMesh`, and gameplay metadata (`height`, `legLength`, `obstacleRadius` — GAMA/SCENA-compatible). Every visual decision is seeded *and* overridable.

## Body types

```js
createHumanoid({ seed, bodyType: 'feminine' });               // or 'masculine' | 'neutral'
createHumanoid({ seed, bodyType: { shoulders: 1.1, waist: 0.9, hips: 1.05, chest: 0.6 } });
```

Presets (with per-seed jitter) or explicit multipliers shape the skeleton — shoulder and hip bone offsets move — and the silhouette: torso boxes, plus a stylized bust box for feminine builds. Combined with `height` and `build`, crowds sample the whole spectrum.

## The wardrobe

```js
createHumanoid({
  seed,
  outfit: { top: 'dress', bottom: 'pants', sleeves: 'long', collar: true, belt: true },
  colors: { top: 0x2456a8, bottom: 0x1c3d78, boots: 0xe8e4dc },
});
```

Garment layers, not painted-on colors: tops (`shirt · tunic · dress · jacket · apron`), bottoms (`pants · shorts · skirt`), sleeve lengths, collars, belts with buckles. The layering is clothing-aware — dresses and skirts bare the legs, shorts bare the calves, long sleeves clothe the forearms, jackets force collars. All of it composes with accessories (`cap`, `hat`, `backpack`, `pouch`, `shoulderPads`).

## Faces

Every character has one: white-sclera + iris eyes (size, spacing, color), brows whose **angle is the resting expression** (positive kind, negative stern), a nose, a mouth whose corners rise or fall with `smile` (−1…1), ears, and facial hair. Hair comes from a style catalog (`bald · cap · side-part · bob · ponytail · bun · long · spiky`).

```js
createHumanoid({
  seed,
  face: { brows: { angle: 0.3 }, mouth: { smile: 1 }, facialHair: 'none' },
  hair: { style: 'ponytail', color: 0x8a2f1e },
});
```

## The creator API: describeHumanoid

```js
const spec = describeHumanoid({ seed: 7 });   // every decision, resolved, JSON-serializable
spec.outfit.top = 'dress';
spec.face.mouth.smile = 1;
const rig = createHumanoid(spec);             // byte-identical round trip when untweaked
```

`describeHumanoid` resolves everything the generator would decide — figure, outfit, colors, face, hair, gear — into one plain object. Feed it back with any field changed. Three independent seeded streams (decisions / geometry details / color jitter) guarantee `createHumanoid(describeHumanoid(o))` is **byte-identical** to `createHumanoid(o)`, and that overriding a face never reshuffles an outfit. Every rig also carries its own `.description`. One API: NPC generator *and* player character creator.
