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
- **`Guard`** — defence with **no block chance anywhere**. `coverageOf()` samples every direction a strike could arrive from and asks whether a limb is on the line: a cross-arm covers **50.9%** of the head and a low guard **5.5%**, while the low guard takes **26.0%** of the body against the cross-arm's 8.8% — the same two arms, and a trade nobody wrote down. The other half is a race: simple visual reaction is 180 ms, a jab's wind-up is 130, so **nobody reacts to a jab**. `Defence` splits the impulse into what got `through` and what a limb `absorbed`, and they sum to what was thrown. Gated by `npm run guard`.
- **`Grappling`** — a throw is a **consequence of the balance**, not a cutscene. An attempt completes if, and only if, the uke's centre of mass has left the polygon their feet make on the floor — judo's definition of *kuzushi*, and exactly what `stability()` was already measuring for `Striking`. **At skill 0.35 six of twenty-four attempts land; at 0.95 all twenty-four do.** `breakEffort()` says a body goes over backwards for **4.6°** and forwards for **11.8°** — a heel 75 mm behind an ankle and a toe 190 mm in front, read off the feet. The landing is `mass × sqrt(2gh)` from a fall nobody typed in, a breakfall takes **62%** off the torso without shrinking the fall, and a grip past **520 mm** is not a grip. Gated by `npm run grappling`.
- **`FightStyle`** — a style is **where the feet are**, not a damage multiplier: a stance, a guard and a repertoire, with every other number a consequence some other module already measures. Six styles, and **nobody wins every column**. `applyStance()` states a stance as two footprints so it means the same thing on any body — and a **long stance is automatically a low one** (karate 115 mm of forced crouch against a brawler's 41 mm), because a pelvis is already 90 mm wide. The long stance is also the rooted one: **karate takes 12.4° of tip and a brawler 9.5°, and the brawler goes over backwards.** Wing chun's long guard is the only one in the library with anything on the **centre line** (20.0% against a peekaboo's 0.0%). Gated by `npm run fightstyle`.
- **`Fencing`** — the armed bout, and **it does not stand still**. `Sparring` stands two fighters at a fixed gap; with weapons that is worse than a simplification, because the interesting half of a fight with a sword in it is the **footwork**. So they close, break, circle, lunge into the cut and step back out, and the blade sweeps because the **arm** sweeps — `poseSwordArm` puts the hand on a real arc and `solveLimb` solves the elbow, with no clip anywhere. The tempo is `t = √(2θI/τ)`: the blade's second moment about the grip from `Blade`, against the couple its hilt allows from `Bind`. **Nothing in the weapon table says "speed"** — it says how thick the blade is. A longsword is **2.0×** an arming sword to turn and has **2.1×** the couple on it, so the two nearly cancel, which is the whole case for a hand-and-a-half grip. `measure = reach + blade`, so two fencers have different ones and between them is a band where only one can reach: a spear beats an arming sword **10–0**. Footwork is `π√(L/g)`, a leg as a pendulum, so a taller fencer steps slower *and* further. Blades meeting is `Bind`. Gated by `npm run fencing`, whose first assertion is that they moved.
- **`MotionMatcher`** — a locomotion controller that is a **search**, not a blend tree, and **no weights anywhere**. Every published motion-matching cost function carries a table of hand-tuned weights beside it, because it adds foot positions (metres) to foot velocities (metres per second) to trajectory points (metres) — a sum that is not a quantity at all. **The weights are unit conversions**: a velocity becomes a length when multiplied by a time, an angle when multiplied by a radius. So the table collapses to one time constant per quantity, every term is in square metres, and every weight is 1. The check a weighted cost cannot pass: **writing the velocities in a different unit must not change which frame is nearest**, and for a hand-weighted cost it does — run on the real database, against the two frames that genuinely disagree. The constants are measured, not chosen: `τ_foot = σ(position)/σ(velocity) = 0.16 s`, a length over a length per second, so it is **identical on a 1.4 m body and a 2.1 m one** while every other feature scales with them; the trajectory needs no conversion because `speed × time` is already a distance, sampled at thirds of a step. Take them away and watch — without the velocity term a foot swinging forward looks like one passing backwards and the pop rate goes from **1% of searches to 21%**; without the trajectory the character never hears a command. Against the blend tree it replaces it answers in **0.13 s against 0.27**, because `Locomotion` smooths the speed and then stride-matches the smoothed number, so it is late by construction. Gated by `npm run motion`, which also reports the defect it exposed: ANIMA's cadence is a flat 0.5 s at every body size, so the **Froude number spreads 46%** instead of being constant, and two bodies are not dynamically similar.
- **`Speech`** — visemes, and the observation that **the table already exists**. Every lipsync system starts by inventing a list of mouth shapes; that list has been published since 1888. The IPA vowel chart's two axes are exactly the two things a mouth visibly does — **vowel height is how far the jaw is down, roundedness is what the lips are doing** — so `mouthOf` is two lookups and a subtraction, and there is no viseme table in the file because the IPA is one. **31 phonemes collapse onto 9 visemes, 3.4 to one**, which is why lipsync is tractable and lip-reading is hard. Then the one that matters: **a bilabial must close the lips.** Coarticulation blends everything else (Cohen and Massaro's dominance functions, with the visible shape **leading the sound by 100 ms**), but closure is a `Math.max` over the neighbours and never an average, because a seal is a contact — averaging shut with open does not give half-shut, it gives wrong. "mama", "papa" and "baba" reach **100%** sealed; "halo" **5%** and "sisi" **15%**. Three published numbers do the rest: a jaw peaks at **200 mm/s** against a blend that swings it at over a metre a second, so the face is rate-limited and the shortfall is **undershoot** — Lindblom, 1963, and nobody wrote it down. The lips are not limited but they are only **24 mm** long, so the seal is capped at `LIP_BRIDGE / (open × JAW_TRAVEL)` and **completes when the jaw arrives**, which predicts unprompted that fast speech loses its closures. Gated by `npm run speech`.
- **`Sparring`** — the payoff. Two fighters, and an AI that reads **four measurements** — how far this limb gets, what the strike costs in balance, what fuel is left, where they are open — and **not height, weight, style or who should win**. The longer fighter still wins **40 of 45 pairs**, with the reach gap predicting the margin at **r = 0.673**, because a longer arm measures further. **Reach is not height**: four pairs are taller *and* shorter-reaching, and all four lose. Fatigue is a real budget (20% muscle efficiency, 300 J/kg anaerobic reserve — 20.6 kJ in a 68.7 kg body), so the last round is jabs because that is what is affordable. Gated by `npm run sparring`.
- **The armour handshake** (`npm run armour`) — the second gate that imports two libraries, and **the one that finishes**. Tameshiwari could not: settling whether a strike breaks a board needed the *compliance of a fist*, which neither library had and neither invented. A plate is different — it fails when a hole is open all the way through, and the work that takes is the metal's indentation pressure over **the point's own frontal area**. What the comparison needs is a **contact diameter**, and that is a ruler measurement `Cut` has had all along. So the energy required goes as the **square** of it: 76 J for a 9 mm bodkin, **9425 J for a 100 mm foot**. A compound bow's arrow at 75 J gets **99%** of the way through 2 mm of wrought iron; a 800 J roundhouse gets **8%**. The kick carries eleven times the energy and is twelve times further from getting through, and comparing joules to joules would have said the opposite. Nothing in the library defeats 2 mm of steel, which is the historical answer. The **mail** half still does not finish, and now says why: a riveted ring bursts at 3.05 J and cutting a slit through twenty layers of linen costs 2.2 more, against Williams's measured **120 J** — so what stops an arrow in a gambeson is the textile *stretching*, not being cut, and that is not a fracture toughness and is not in either package.
- **The tameshiwari handshake** (`npm run tameshiwari`) — the only gate here that imports two libraries. ANIMA derives a strike's energy from segment masses and a measured velocity; **SCENA** derives what a board takes from the Wood Handbook, ASTM D245 and beam bending; **neither package imports the other**, and SCENA's 3.62 kN sits 17% from a 3.1 kN measurement published in 1979. Crossing them settled a question neither could answer alone: **the lightest strike clears the dearest board 1.9× over on energy and the heaviest by 425×, so energy is not what limits board breaking — force is.** The piece still missing is how compliant a fist is, which neither library measures and neither has invented.
- **`Blade`** — a weapon is a **mass distribution held in a hand**, and there is no `damage`, no `speed`, no tier and no rarity anywhere in the file. Nine objects described with a ruler — lengths, widths, thicknesses, materials — and **not one mass in the table**: the weight, the balance point, the moment of inertia, the centre of percussion and the swing period are all sums over it. Checked two ways from outside. A **uniform steel bar** is exported so the checking is public, and its inertia comes out at `mL²/3` about the end and `mL²/12` about the centre, its sweet spot at exactly `2L/3` and its period at `2π√(2L/3g)`, **to the twelfth decimal place**. A **men's javelin** is checked against a rule book rather than a range: from a 1.5 mm aluminium wall and a ruler it lands at **807.9 g** against a regulation 800 g minimum and balances **1.003 m from the tip** against the 0.90–1.06 m the 1986 rule demands — neither number typed in. And getting that right broke the sweet spot, which was the finding: the rules put the binding **on** the centre of mass, so the distance both `percussion` and `pendulumPeriod` divide by is zero, and **an object held at its own balance point has no period and no sweet spot. It does not swing. It is thrown.** Gated by `npm run blade`.
- **`Javelin`** — the object whose rules were changed to make it fly worse, and the only module here checked against **a committee's stated intention**. On 1 April 1986 the IAAF moved the men's javelin's centre of mass 4 cm forward, to take about 10% off distances that had reached Uwe Hohn's 104.80 m — still the only throw past a hundred metres. `shiftBalance` runs that as a **one-variable experiment**, which the real change was not: mass moves *within* the javelin, so the weight, shape, volume, planform and every drag term are bit-identical and only the balance differs. **The direction falls out of the geometry**: across 27 release conditions the pre-1986 javelin flies further and holds more angle of attack without exception, and lands *flatter* at every release angle a competitor uses — the exact thing the rule was written to stop. Nothing was told which way the rule went. **The magnitude does not**: the cost comes out at 1.3% where the change was worth 10%, and the reason is in the same table — this flight beats a cannonball by 1–5% where real throws beat one by 10–17%, so the lift is about a quarter of the real thing. Allen–Perkins crossflow under-predicts a javelin and the wind-tunnel tables that would fix it are not here and have not been invented, because the rule change is the check and fitting to it would delete the check. The gate budgets the shortfall from **both** sides. Three degrees of freedom, three published coefficients, and a Munk moment that is destabilising on purpose. Gated by `npm run javelin`.
- **`Bind`** — two blades in contact **stop being two objects**: they become one linkage with a hand at each end and a sliding joint in the middle that neither fencer put there. The joint is where two lines cross, and that is all it is — the distance from your hand to it is your lever arm, `F = τ/a`, so contact near your hilt is an enormous force and contact near your point is almost none. That is the *strong* and the *weak* of the blade, and it is `τ = F·r` rearranged. **Two mechanisms point opposite ways.** Friction says a shallow crossing sticks: the press splits normal and tangential as `tan θ`, so it holds below `atan(µ)` — **11.31°** for steel on steel, a published coefficient through an arctangent. Geometry says a shallow crossing is unstable: rotate by `dα` and the contact runs `a·dα/sin θ`, the conditioning of a line intersection, which diverges. **The steepest crossing that still grips is 5.10× as twitchy as a perpendicular one**, and sweeping every degree from 1 to 89 there is no angle that does both. Nobody encoded that trade — one half is Coulomb and the other is `1/sin θ`. **Winding** falls out the same way: turn your blade and the contact walks back toward your hilt and out along theirs, monotonically, with no technique anywhere in the code. Two hands on a longsword's hilt make **2.13×** an arming sword's one-handed couple, from a subtraction on the hilt lengths. The one chosen constant — how hard a hand pushes — is run at ten times its value in the gate and changes nothing but the newtons. Gated by `npm run bind`.
- **`Cut`** — a hit is a **pressure**, and a pressure is a force over an area. `Striking` says what a blow arrives with and `Blade` says what the object is; neither knows what happens when they meet, because that needs a third number — how small an area the force lands on. **Two criteria, four orders of magnitude apart.** A stress criterion puts a sharp 10 µm point through skin at **6.3 milli-newtons**, the weight of a paperclip; instrumented knives measure **tens of newtons**. What costs is making new surface: `F = R·w`, the work of fracture times the width of the wound, which gives **12 N** across the first 4 mm of blade and **60 N** at full width — both ends of the measured band, from one derivation. **Sharpness decides whether a cut starts; toughness decides what it costs**, and they are not the same question. Seven targets, four of their toughnesses derived as `K²/E`; pine is the same timber twice and costs **11×** more across the grain than along it. **Curvature is a pressure multiplier** — a curved edge meets a flat target on a chord, `L = 2√(2Rδ)`, so a sabre engages 85 mm where a straight blade engages 200 and takes 2.4× the pressure for free. And the axe is the honest case: 60× the apex radius, the shortest contact in the table, and **still nine times worse on pressure than the sharp sword**. An axe is not a sharp thing, it is a heavy thing. `cutDepth` returns a **bound** and is named one — a 113 J swing bounds at 1502 mm into pine, which is not a thing that happens, and the missing friction and wedging terms have not been invented to hide it. Gated by `npm run cut`.
- **`Striking`** — fourteen strikes where the **damage is a measurement**. `effective mass = Σ mᵢ(vᵢ·n̂)⁺ / (v_surface·n̂)`: Dempster's segment fractions, and velocities read off the bone transforms while the strike plays. A cross measures **1.88×** a jab and kicks **1.94×** punches, because half a body drives one and a leg weighs three times an arm — not because a table says so. `skill` is the kinetic chain: worth **3.55×** on a cross and **1.0×** on a roundhouse, because a straight punch *is* its chain and a leg is heavy enough without one. At skill 0 the hip peaks *after* the fist — an arm punch, measured. `stability()` is the commitment cost, from the same mass table. Publishes a `Blow` with an impulse in kg·m/s; ANIMA does not compute damage. Gated by `npm run striking`.
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
