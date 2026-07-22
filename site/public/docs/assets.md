# Retargeting, sockets, gear

The placeholder era ends when you want it to — real animation assets and carried props are first-class.

## retargetClip: play Mixamo on ANIMA bodies

```js
const gltf = await new GLTFLoader().loadAsync('mixamo-dance.glb');
const dance = retargetClip(rig, gltf.scene, gltf.animations[0]);
loco.overlay(dance);          // or play it on its own mixer
```

The solve is exact, not name-by-name approximate: the source clip is played frame by frame, and each mapped ANIMA bone receives the source's **world-rotation delta from rest**, composed down the actual target hierarchy. That absorbs everything a real download throws at you — non-identity rest orientations, extra bones (Mixamo's `Spine1` is skipped; the world solve compensates), centimeter units under scaled roots, and name prefixes. Hips translation rescales by relative hip height; `inPlace` (default) strips ground-plane root motion so your movement code stays in charge. `MIXAMO_MAP` ships as the default bone map; pass your own for other skeletons.

This is where ANIMA's identity-rest skeleton design pays off: the retarget correction collapses to clean world-space deltas.

## Sockets

```js
attach(rig, 'handRight', torch);      // a SCENA prop's .object works directly
const socket = getSocket(rig, 'back');
```

Named, height-proportional attachment points — `handLeft`, `handRight`, `back`, `hipLeft`, `hipRight`, `head` — parented to bones, so props ride every animation: a torch swings with the arm through the whole stride. Sockets are lazily created, cached, and scale with the character's height.

## Accessories

Seeded modular gear merged into the same single-draw-call mesh: `cap`, `hat`, `backpack`, `pouch`, `shoulderPads`. `'auto'` (the default) rolls per seed *after* the base body draws, so a given seed keeps its face and outfit; pass an explicit list or `'none'` to control it.
