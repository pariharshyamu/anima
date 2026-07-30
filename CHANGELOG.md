# Changelog

ANIMA ships one aspect of an animated character per minor version — a rig, a
gait, a controller, a wardrobe system — each taken end to end: code, unit
tests, a runnable example, headless verification in Chromium that the body
actually moves the way the release claims, and docs.

The format is one line per release, taken from that release's own commit
message. Those were written at the time and are more accurate than a summary
written now. The commit messages carry the long form, including the bugs each
release found.

`0.x` means minor versions may add and occasionally reshape API.

## Not on npm

`0.1.0`–`0.5.0` predate the first publish; the package reached the registry at
`0.6.0`. Every other committed version is published. (Verified against
`npm view anima3d versions`, not assumed.)

## Releases

### 2026-07-30

- **0.37.1** — CI on every push, this changelog, and `playwright` as a
  devDependency so `verify:playgrounds` runs on a fresh clone

### 2026-07-29

- **0.37.0** — The sortie: a pilot who wears the g

### 2026-07-28

- **0.36.0** — The lamplighter: the lighting arc comes home
- **0.35.0** — Reactions: the body showing what the numbers did, and r185

### 2026-07-27

- **0.34.0** — Cricket: the actions, and both hands on the bat
- **0.33.0** — YogaClass: one practice, many bodies
- **0.32.0** — Flow: a vinyasa is a list of breaths
- **0.31.0** — Yoga: the asana engine — the held frame
- **0.30.0** — The Cypher — the floor becomes a social structure
- **0.29.0** — The Couple — one dance, two bodies
- **0.28.0** — Routines, vogue & krump — choreography as data
- **0.27.0** — The illusions and the house — travel is not weight
- **0.26.0** — The two classicals — where the dance keeps its time

### 2026-07-26

- **0.25.0** — Street styles — the hit and the freeze: popping, locking, waving, tutting, toprock
- **0.24.0** — Dance styles — the count is not the beat: salsa, waltz, bhangra
- **0.23.0** — Dance skills + the club: the trilogy's first three-way composition
- **0.22.1** — Bump scena3d to ^0.74.1, and carry the playground verifier across
- **0.22.0** — Add Rowing — a body driven by somebody else's clock

### 2026-07-25

- **0.21.0** — Add sea legs — standing up on ground that moves
- **0.20.1** — Fix the carry poses, which never held anything
- **0.20.0** — Add asymmetric two-handed prep work
- **0.19.0** — Add swimming
- **0.18.0** — Washing at a basin
- **0.17.0** — Working at a desk
- **0.16.1** — Example(queue): waiting, assembled from parts that already existed
- **0.16.0** — Glancing, and the attention demo
- **0.15.0** — The pose does all the work
- **0.14.0** — Nobody watches television by staring at it
- **0.13.0** — The horse was sliding, and the rider was standing

### 2026-07-24

- **0.12.0** — Horses — quadruped rig, real gaits, mounting, riding, ladders
- **0.11.0** — Mannerisms, conversation, and sitting down like a person
- **0.10.1** — Fix work poses: chop raises the axe overhead and strikes; stir dips in
- **0.10.0** — Work loops + labor demo: chop/mine/saw/stir over idle
- **0.9.0** — Carry: pick up, carry-while-walking, put down, hand off
- **0.8.0** — Manipulables: operate pose + one-shot Gesture, and the mechanisms demo
- **0.7.2** — The commute: GAMA drives the car
- **0.7.1** — At home: the interactive-props demo + friction-free slot typing
- **0.7.0** — Interactions: poses, loops and the Interaction controller

### 2026-07-22

- **0.6.2** — Stop the gaze winding un-animated bones like a rotor
- **0.6.1** — Fix gaze whipping around when a character carries the ball
- **0.6.0** — V0.6.0 'The Wardrobe': body types, garment layers, describeHumanoid creator API
- **0.5.0** — V0.5.0 'The Face': eyes, brows, noses, mouths, ears, hair styles, facial hair  *(not published)*
- **0.4.0** — V0.4.0 'The Crowd': VAT baking and instanced route-walking crowds  *(not published)*
- **0.3.0** — V0.3.0 'The Others': exact clip retargeting, sockets, seeded accessories  *(not published)*
- **0.2.0** — V0.2.0 'The Craft': foot IK, look-at chains, overlays, footstep events  *(not published)*
- **0.1.0** — ANIMA v0.1.0 'The Body': seeded humanoids, procedural gaits, locomotion blending  *(not published)*
