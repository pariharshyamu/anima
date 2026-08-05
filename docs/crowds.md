# VAT crowds at scale

Hero characters get full rigs — skeletons, mixers, IK, gaze. Crowds get **Vertex Animation Textures**: the same seeded bodies, replayed entirely on the GPU.

## bakeVAT

```js
const vat = bakeVAT(rig, clips.walk, 15);
// vat.positions / vat.normals: float DataTextures, one texel per vertex per frame
```

A clip's skinned deformation is sampled into float textures — positions *and* normals (rigid skinning lets one normal matrix per bone per frame cover every vertex), with the last row duplicating frame 0 so the shader wraps seamlessly. Lighting stays honest at any distance.

## The Crowd

```js
const crowd = new Crowd({ count: 60, seed: 9, variants: 3, clip: 'walk' });
scene.add(crowd.group);
game.onUpdate((t) => crowd.update(t.delta));
```

N seeded villagers as a handful of `InstancedMesh`es (one per variant body — three draw calls for sixty walkers). The `MeshStandardMaterial` is patched via `onBeforeCompile`: a per-instance phase attribute plus a shared clock pick the frame; the shader fetches interpolated baked positions and normals. Per-instance tints keep shared bodies reading as individuals, and since faces and outfits are just vertices, **crowds inherit the whole character system for free**. No skeletons, no mixers, no per-character CPU cost.

Place instances with `crowd.set(i, x, z, rotationY, y)`.

## Route following

```js
crowd.followRoute(road.route, { surface: terrain.heightAt });  // SCENA's road drops in
```

The whole crowd walks a route: spread evenly, advancing at the bake's stride-matched speed with slight per-instance variation, facing travel direction, draped on the surface. One SCENA road becomes a populated thoroughfare in two lines.

**The pattern:** full `createHumanoid` rigs for the few characters near the camera; a `Crowd` for everyone else. The basketball demo seats 26 VAT spectators on bleachers while two full rigs play the game.
