export interface Example {
  id: string;
  title: string;
  group: string;
  code: string;
}

// Studio prelude for character showcases: dark stage, portrait lighting.
const STUDIO = `import { Game } from 'gama3d';
import { AmbientLight, Color, DirectionalLight, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';

const game = new Game();
const scene = game.world.scene;
scene.background = new Color(0x1a2230);
const key = new DirectionalLight(0xfff2e0, 1.6);
key.position.set(2, 6, 10);
const fill = new DirectionalLight(0xbcd8ff, 0.5);
fill.position.set(-6, 3, 4);
scene.add(key, fill, new AmbientLight(0xffffff, 0.45));
const ground = new Mesh(new PlaneGeometry(60, 60), new MeshStandardMaterial({ color: 0x2c3547 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);`;

export const EXAMPLES: Example[] = [
  {
    id: 'gallery',
    title: 'Every character is a seed',
    group: 'Characters',
    code: `// Five strangers from five integers: bodies, figures, outfits, faces,
// hair and gear — all seeded, all one draw call each. Change baseSeed.
import { createHumanoid, Locomotion } from 'anima3d';
${STUDIO}

const baseSeed = 300;
const cast = [];
for (let i = 0; i < 5; i++) {
  const rig = createHumanoid({ seed: baseSeed + i });
  rig.object.position.set((i - 2) * 0.85, 0, 0);
  scene.add(rig.object);
  cast.push(new Locomotion(rig));
}

game.camera.position.set(0, 1.35, 4.6);
game.camera.lookAt(0, 1.05, 0);
game.onUpdate((t) => cast.forEach((loco) => loco.update(t.delta, 0)));
game.start();`,
  },

  {
    id: 'creator',
    title: 'The creator API',
    group: 'Characters',
    code: `// describeHumanoid resolves EVERY seeded decision into a plain spec.
// Tweak any field and feed it back — same person, new choices.
// create(describe(o)) is byte-identical to create(o).
import { createHumanoid, describeHumanoid, Locomotion } from 'anima3d';
${STUDIO}

const spec = describeHumanoid({ seed: 7 });
console.log('resolved spec:', JSON.parse(JSON.stringify({ ...spec, palette: undefined })));

const variants = [
  spec,                                                        // as rolled
  { ...spec, hair: { style: 'ponytail', color: 0x8a2f1e } },   // new hair
  { ...spec, outfit: { ...spec.outfit, top: 'dress' } },       // new outfit
  { ...spec, face: { ...spec.face, mouth: { width: 1, smile: 1 },
                     brows: { angle: 0.35, thickness: 1 } } }, // new mood
];
const cast = [];
variants.forEach((v, i) => {
  const rig = createHumanoid(v);
  rig.object.position.set((i - 1.5) * 0.9, 0, 0);
  scene.add(rig.object);
  cast.push(new Locomotion(rig));
});

game.camera.position.set(0, 1.35, 4.4);
game.camera.lookAt(0, 1.05, 0);
game.onUpdate((t) => cast.forEach((loco) => loco.update(t.delta, 0)));
game.start();`,
  },

  {
    id: 'faces',
    title: 'Faces & expressions',
    group: 'Characters',
    code: `// One person, five moods: the brow angle and mouth corners ARE the
// resting expression. Everything else stays fixed.
import { createHumanoid, Locomotion } from 'anima3d';
${STUDIO}

const moods = [
  { label: 'furious', brows: -0.45, smile: -1 },
  { label: 'stern', brows: -0.2, smile: -0.3 },
  { label: 'neutral', brows: 0, smile: 0.1 },
  { label: 'warm', brows: 0.2, smile: 0.6 },
  { label: 'delighted', brows: 0.4, smile: 1 },
];
const cast = [];
moods.forEach((mood, i) => {
  const rig = createHumanoid({
    seed: 42,
    accessories: 'none',
    hair: { style: 'side-part' },
    face: {
      brows: { angle: mood.brows, thickness: 1.2 },
      mouth: { width: 1, smile: mood.smile },
      facialHair: 'none',
    },
  });
  rig.object.position.set((i - 2) * 0.62, 0, 0);
  scene.add(rig.object);
  cast.push(new Locomotion(rig));
});

game.camera.position.set(0, 1.52, 2.3); // in close — faces are the show
game.camera.lookAt(0, 1.42, 0);
game.onUpdate((t) => cast.forEach((loco) => loco.update(t.delta, 0)));
game.start();`,
  },

  {
    id: 'wardrobe',
    title: 'Wardrobe & body types',
    group: 'Characters',
    code: `// Garment layers, not painted-on colors: dress, top+skirt, jacket,
// apron, tunic+shorts — over feminine/masculine/neutral figures.
import { createHumanoid, Locomotion } from 'anima3d';
${STUDIO}

const outfits = [
  { bodyType: 'feminine', outfit: { top: 'dress', sleeves: 'short', collar: true, belt: true } },
  { bodyType: 'feminine', outfit: { top: 'shirt', bottom: 'skirt', sleeves: 'long' } },
  { bodyType: 'masculine', outfit: { top: 'jacket', bottom: 'pants', sleeves: 'long' } },
  { bodyType: 'neutral', outfit: { top: 'apron', bottom: 'pants', belt: true } },
  { bodyType: 'masculine', outfit: { top: 'tunic', bottom: 'shorts', belt: true } },
];
const cast = [];
outfits.forEach((choice, i) => {
  const rig = createHumanoid({ seed: 300 + i, ...choice, accessories: 'none' });
  rig.object.position.set((i - 2) * 0.85, 0, 0);
  scene.add(rig.object);
  cast.push(new Locomotion(rig));
});

game.camera.position.set(0, 1.15, 5.0);
game.camera.lookAt(0, 0.98, 0);
game.onUpdate((t) => cast.forEach((loco) => loco.update(t.delta, 0)));
game.start();`,
  },

  {
    id: 'locomotion',
    title: 'Idle → walk → run',
    group: 'Animation',
    code: `// The 1D blend: velocity in, correct gait out — phase-synced, with
// stride-matched playback so feet grip the ground. Three speeds, three
// characters, walking rings. Footsteps log to the console.
import { createHumanoid, Locomotion } from 'anima3d';
import { Vector3 } from 'three';
${STUDIO}

const speeds = [0.9, 1.6, 3.4];
const walkers = [];
speeds.forEach((speed, i) => {
  const rig = createHumanoid({ seed: 20 + i, accessories: 'none' });
  const loco = new Locomotion(rig);
  loco.onFootstep((foot) => console.log('step', i, foot));
  scene.add(rig.object);
  walkers.push({ rig, loco, speed, radius: 1.6 + i * 1.3, angle: i * 2 });
});

const velocity = new Vector3();
game.onUpdate((t) => {
  for (const w of walkers) {
    w.angle += (w.speed / w.radius) * t.delta;
    w.rig.object.position.set(Math.cos(w.angle) * w.radius, 0, Math.sin(w.angle) * w.radius);
    velocity.set(-Math.sin(w.angle), 0, Math.cos(w.angle)).multiplyScalar(w.speed);
    w.rig.object.rotation.y = Math.atan2(velocity.x, velocity.z);
    w.loco.update(t.delta, velocity);
  }
});
game.camera.position.set(0, 4.6, 8.2);
game.camera.lookAt(0, 0.7, 0);
game.start();`,
  },

  {
    id: 'craft',
    title: 'Foot IK, gaze & a wave',
    group: 'Animation',
    code: `// The craft layer on a SCENA hillside: feet plant on the actual
// slope (two-bone IK + pelvis ease), every head tracks the drifting
// orb, and one villager waves forever — an additive overlay on top of
// the idle breathing.
import { createHumanoid, createWaveClip, FootIK, Locomotion, LookAt } from 'anima3d';
import { createTerrain, createSky, createLightingRig, applyFog, PALETTES } from 'scena3d';
import { Game } from 'gama3d';
import { Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
const terrain = createTerrain({ seed: 9, size: 60, amplitude: 6, palette });
scene.add(terrain.mesh, createSky({ palette }).mesh, createLightingRig('golden-hour').group);
applyFog(scene, 'haze', palette);

const orb = new Mesh(new SphereGeometry(0.12, 10, 8),
  new MeshStandardMaterial({ color: 0xffd889, emissive: 0xffb347, emissiveIntensity: 1.5 }));
scene.add(orb);

const cast = [];
for (let i = 0; i < 4; i++) {
  const x = -2.4 + i * 1.6;
  const z = -1 + (i % 2) * 1.4;
  const rig = createHumanoid({ seed: 60 + i });
  rig.object.position.set(x, terrain.heightAt(x, z), z);
  rig.object.rotation.y = Math.PI;
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  if (i === 3) loco.overlay(createWaveClip(rig), { fadeIn: 0.1 });
  cast.push({ loco, ik: new FootIK(rig, { ground: terrain.heightAt }), gaze: new LookAt(rig) });
}

game.onUpdate((t) => {
  const a = t.elapsed * 0.7;
  orb.position.set(Math.sin(a) * 2.6, terrain.heightAt(0, -3) + 1.6 + Math.sin(a * 1.7) * 0.5, -3.2);
  for (const c of cast) {
    c.loco.update(t.delta, 0);
    c.ik.update();
    c.gaze.target = orb.position;
    c.gaze.update(t.delta);
  }
});
const y = terrain.heightAt(0, -4);
game.camera.position.set(0.5, y + 1.9, -4.6);
game.onUpdate(() => game.camera.lookAt(0, y + 1.2, 0));
game.start();`,
  },

  {
    id: 'sockets',
    title: 'Sockets: carry things',
    group: 'Animation',
    code: `// Props ride bones through every animation: a torch attached to the
// hand socket swings with the arm, stride after stride.
import { attach, createHumanoid, Locomotion } from 'anima3d';
import { CylinderGeometry, Group, PointLight, SphereGeometry, Vector3 } from 'three';
${STUDIO}

const rig = createHumanoid({ seed: 11, accessories: 'none' });
scene.add(rig.object);
const loco = new Locomotion(rig);

const torch = new Group();
const handle = new Mesh(new CylinderGeometry(0.02, 0.028, 0.5, 6),
  new MeshStandardMaterial({ color: 0x5d4030, flatShading: true }));
handle.position.y = 0.18;
const flame = new Mesh(new SphereGeometry(0.055, 8, 6),
  new MeshStandardMaterial({ color: 0xffd889, emissive: 0xffb347, emissiveIntensity: 2.2 }));
flame.position.y = 0.48;
flame.scale.y = 1.5;
torch.add(handle, flame, new PointLight(0xffb347, 4, 8, 1.8));
attach(rig, 'handRight', torch);

// Walk a ring so the torch swings through the whole gait.
const velocity = new Vector3();
let angle = 0;
game.onUpdate((t) => {
  angle += (1.5 / 2.2) * t.delta;
  rig.object.position.set(Math.cos(angle) * 2.2, 0, Math.sin(angle) * 2.2);
  velocity.set(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(1.5);
  rig.object.rotation.y = Math.atan2(velocity.x, velocity.z);
  loco.update(t.delta, velocity);
});
game.camera.position.set(0, 2.2, 5.4);
game.camera.lookAt(0, 1, 0);
game.start();`,
  },

  {
    id: 'crowd',
    title: 'A VAT crowd on a road',
    group: 'Scale',
    code: `// Sixty villagers as three draw calls: bodies baked into Vertex
// Animation Textures, walking a SCENA road — no skeletons, no mixers,
// no per-character CPU cost. Heroes stay full rigs; crowds fill worlds.
import { Crowd } from 'anima3d';
import { createTerrain, createSky, createLightingRig, applyFog, createPath, PALETTES } from 'scena3d';
import { Game } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
const terrain = createTerrain({ seed: 18, size: 90, amplitude: 5, palette });
scene.add(terrain.mesh, createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);

const road = createPath(
  [{ x: -18, z: -10 }, { x: 0, z: -16 }, { x: 16, z: -6 },
   { x: 14, z: 12 }, { x: -2, z: 14 }, { x: -20, z: 6 }],
  { surface: terrain.heightAt, width: 2.2, loop: true, palette });
scene.add(road.mesh);

const crowd = new Crowd({ count: 60, seed: 9 });
scene.add(crowd.group);
crowd.followRoute(road.route, { surface: terrain.heightAt });
game.onUpdate((t) => crowd.update(t.delta));

game.onUpdate((t) => {
  const a = t.elapsed * 0.05;
  const y = terrain.heightAt(0, 0);
  game.camera.position.set(Math.cos(a) * 26, y + 10, Math.sin(a) * 26);
  game.camera.lookAt(0, y + 1, 0);
});
game.start();`,
  },

  {
    id: 'trio',
    title: 'The trio, together',
    group: 'Scale',
    code: `// The whole family in one scene: SCENA terrain/road/forest, GAMA
// steering the travelers, ANIMA bodies walking with real gaits — plus a
// runner overtaking everyone. Nothing imports anything: the handshake
// is structural.
import { createHumanoid, Locomotion } from 'anima3d';
import { createTerrain, createSky, createLightingRig, applyFog, createPath,
         createTree, scatter, PALETTES } from 'scena3d';
import { Game, MotionAgent, FollowPath, Path, ObstacleAvoidance, Separation } from 'gama3d';

const palette = PALETTES.autumn;
const game = new Game();
const scene = game.world.scene;
const terrain = createTerrain({ seed: 18, size: 90, amplitude: 5, palette });
scene.add(terrain.mesh, createSky({ palette }).mesh, createLightingRig('golden-hour').group);
applyFog(scene, 'haze', palette);

const road = createPath(
  [{ x: -18, z: -10 }, { x: 0, z: -16 }, { x: 16, z: -6 },
   { x: 14, z: 12 }, { x: -2, z: 14 }, { x: -20, z: 6 }],
  { surface: terrain.heightAt, width: 2.2, loop: true, palette });
scene.add(road.mesh);

const forest = scatter({
  seed: 21,
  area: { min: { x: -40, z: -40 }, max: { x: 40, z: 40 } },
  surface: terrain.heightAt,
  density: 0.05, minSpacing: 1.7,
  items: [{ create: (rng) => createTree({ seed: rng.int(1, 1e9), palette }), variants: 6 }],
  mask: (x, z, y) => y < 3.6,
  keepOut: road.keepOut,
});
scene.add(forest.group);

const agents = [];
const cast = [];
[1.3, 1.5, 3.6].forEach((maxSpeed, i) => {
  const rig = createHumanoid({ seed: 101 + i });
  const walker = game.world.spawn('walker');
  walker.add(rig.object);
  const patrol = new Path(road.route.map((p) => p.clone()), true);
  for (let s = 0; s < (i * road.route.length) / 3; s++) patrol.advance();
  walker.position.copy(patrol.current());
  const agent = walker.addComponent(new MotionAgent({ maxSpeed, maxForce: 24, planar: true }));
  agent.addBehavior(new FollowPath(patrol, 1.6));
  agent.addBehavior(new ObstacleAvoidance(() => forest.obstacles, 3.5, 0.5), 2.5);
  agent.addBehavior(new Separation(() => agents, 1.5), 1.1);
  agents.push(agent);
  cast.push({ agent, loco: new Locomotion(rig) });
});

game.onUpdate((t) => {
  for (const c of cast) {
    const p = c.agent.owner.position;
    p.y = terrain.heightAt(p.x, p.z);
    c.loco.update(t.delta, c.agent.velocity);
  }
  const a = t.elapsed * 0.04;
  const y = terrain.heightAt(0, 0);
  game.camera.position.set(Math.cos(a) * 20, y + 6.5, Math.sin(a) * 20);
  game.camera.lookAt(0, y + 1.5, 0);
});
game.start();`,
  },

  {
    id: 'village',
    title: 'Havenbrook: a medieval village',
    group: 'Scale',
    code: `// The whole trilogy in one scene. SCENA builds the world and every prop —
// an inline town hall with a bell tower, cottages, a market, a fountain,
// banners, bunting, braziers and carts. ANIMA fills it with seeded farmers,
// villagers and knights (full rigs) plus a VAT crowd. GAMA walks them down
// the lanes, steering around the buildings. Nothing imports anything else.
import { createHumanoid, Locomotion, FootIK, LookAt, Crowd, OUTFITS, attach } from 'anima3d';
import { createTerrain, createSky, createLightingRig, applyFog, createDayCycle, createPath,
         createHouse, createWell, createRuin, createTower, createStall, createStatue, createBanner, createBunting,
         createBrazier, createCampfire, createFountain, createCart, createLamp, createFence,
         createTree, createRock, createBush, createGrassTuft, createSurface, createWindField, applyWind, createSeasons, createFlock, createHerd, scatter,
         collectObstacles, PALETTES } from 'scena3d';
import { Game, MotionAgent, FollowPath, Path, ObstacleAvoidance, Separation } from 'gama3d';
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial,
         SphereGeometry, Vector3 } from 'three';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
const terrain = createTerrain({ seed: 77, size: 110, amplitude: 2, palette });
scene.add(terrain.mesh);
const sky = createSky({ palette }); scene.add(sky.mesh);
const light = createLightingRig('golden-hour'); scene.add(light.group);
applyFog(scene, 'haze', palette);
const groundAt = (x, z) => terrain.heightAt(x, z);
const at = (x, z) => new Vector3(x, groundAt(x, z), z);

const lane = createPath([{ x: -20, z: -9 }, { x: -9, z: -18 }, { x: 11, z: -18 }, { x: 20, z: -7 },
  { x: 18, z: 11 }, { x: 5, z: 20 }, { x: -11, z: 18 }, { x: -20, z: 7 }],
  { surface: groundAt, width: 2.4, loop: true, palette });
scene.add(lane.mesh);
const ring = createPath([{ x: -8, z: -8 }, { x: 8, z: -8 }, { x: 9, z: 8 }, { x: -9, z: 9 }],
  { surface: groundAt, width: 1.5, loop: true, palette });
scene.add(ring.mesh);

const buildings = [];
const place = (prop, x, z, ry = 0, blocks = true) => {
  prop.object.position.copy(at(x, z)); prop.object.rotation.y = ry;
  scene.add(prop.object); if (blocks) buildings.push(prop); return prop;
};
const meshAt = (geo, mat, x, y, z) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); return m; };

// --- Inline grand town hall with a bell tower.
function makeTownHall(seed) {
  const g = new Group();
  const wall = createSurface('ashlar', { color: 0xbdb6a4, seed });
  const stone = createSurface('stone', { color: palette.rock[0], seed: seed + 1, cap: 0.35, capColor: 0x455a2c, capUp: 0.5 });
  const roofMat = createSurface('tile', { color: 0x7a3a2c, seed: seed + 2 });
  const beam = createSurface('wood', { color: palette.woodDark, seed: seed + 3 });
  const glass = new MeshStandardMaterial({ color: palette.lampGlow, emissive: palette.lampGlow, emissiveIntensity: 1 });
  const W = 9, D = 6.5, H = 5.2;
  g.add(meshAt(new BoxGeometry(W + 0.6, 1.4, D + 0.6), stone, 0, -0.5, 0));
  g.add(meshAt(new BoxGeometry(W, H, D), wall, 0, H / 2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(meshAt(new BoxGeometry(0.5, H, 0.5), stone, sx * W / 2, H / 2, sz * D / 2));
  const roof = meshAt(new ConeGeometry((W / 2 + 0.5) * Math.SQRT2, 2.6, 4), roofMat, 0, H + 1.3, 0);
  roof.rotation.y = Math.PI / 4; roof.scale.z = (D + 1) / (W + 1); g.add(roof);
  g.add(meshAt(new BoxGeometry(W + 0.1, 0.22, D + 0.1), beam, 0, H * 0.52, 0));
  for (const storey of [H * 0.3, H * 0.74]) for (let i = -1; i <= 1; i++)
    g.add(meshAt(new BoxGeometry(0.7, 1.1, 0.1), glass, i * 2.4, storey, D / 2 + 0.02));
  g.add(meshAt(new BoxGeometry(1.7, 2.4, 0.15), beam, 0, 1.2, D / 2 + 0.04));
  g.add(meshAt(new BoxGeometry(3, 0.2, 1), stone, 0, -0.02, D / 2 + 0.75));
  const tW = 2.4, tH = H + 4.4;
  g.add(meshAt(new BoxGeometry(tW, tH, tW), wall, 0, tH / 2, -0.4));
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(meshAt(new BoxGeometry(0.3, tH, 0.3), stone, sx * tW / 2, tH / 2, -0.4 + sz * tW / 2));
  const dark = new MeshStandardMaterial({ color: 0x1a1712 });
  for (const dz of [tW / 2, -tW / 2]) g.add(meshAt(new BoxGeometry(1, 1.3, 0.12), dark, 0, tH - 1.2, -0.4 + dz));
  g.add(meshAt(new CylinderGeometry(0.34, 0.44, 0.6, 10), createSurface('metal', { color: 0x8a6a2f, seed: seed + 5 }), 0, tH - 1.25, -0.4));
  const clock = meshAt(new CylinderGeometry(0.6, 0.6, 0.12, 16), new MeshStandardMaterial({ color: 0xe8e2d0, emissive: 0x2a2a22, flatShading: true }), 0, tH - 2.8, tW / 2 - 0.35);
  clock.rotation.x = Math.PI / 2; g.add(clock);
  const cap = meshAt(new ConeGeometry(tW * 0.95, 2.2, 4), roofMat, 0, tH + 1.1, -0.4);
  cap.rotation.y = Math.PI / 4; g.add(cap);
  const flag = createBanner({ seed: seed + 9, style: 'flag', pattern: 'cross', poleHeight: 1.6, palette });
  flag.object.position.set(0, tH + 2.1, -0.4); flag.object.scale.setScalar(0.9); g.add(flag.object);
  return { object: g, obstacleRadius: Math.hypot(W, D) / 2 + 0.4 };
}

const hall = place(makeTownHall(1), 0, -14, 0);
const houses = [];
[[-16, -6], [-15, 6], [-12, 15], [2, 17], [14, 13], [17, 2], [16, -9], [-7, -13], [-20, 0]]
  .forEach(([x, z], i) => { const h = createHouse({ seed: 40 + i, palette }); place(h, x, z, Math.atan2(-x, -z)); houses.push(h); });

// A cobblestone apron paves the plaza; it sinks into the slope so edges never float.
const plaza = new Mesh(new CylinderGeometry(9.5, 9.5, 1.6, 44), createSurface('cobblestone', { seed: 6 }));
plaza.position.set(0, groundAt(0, 1) - 0.72, 1); scene.add(plaza);

place(createFountain({ seed: 4, palette }), 0, 2, 0);
place(createStatue({ seed: 71, figure: 'figure', palette }), -5, -10.5, Math.PI);
place(createStatue({ seed: 72, figure: 'obelisk', palette }), 5, -10.5, Math.PI);
place(createWell({ seed: 3, palette }), -8.5, 4, 0);
place(createRuin({ seed: 88, size: 4.2, palette }), -19, -17, 0.6);
place(createTower({ seed: 44, palette }), 19, 15, 0);
['produce', 'pottery', 'bakery', 'textiles'].forEach((goods, i) =>
  place(createStall({ seed: 30 + i, goods, palette }), 12.5, -5 + i * 3, -Math.PI / 2));
place(createCart({ seed: 2, style: 'wagon', cargo: 'barrels', palette }), 8.5, 6, 0.6);
place(createCart({ seed: 9, style: 'wagon', cargo: 'hay', palette }), -16, 10, 2.2);
[[-6, 6], [6, 6], [-6, -6], [6, -5]].forEach(([x, z], i) => place(createBrazier({ seed: 50 + i, palette }), x, z, 0, false));
place(createCampfire({ seed: 3, palette }), 13, 8, 0, false);
for (let i = 0; i < 3; i++) place(createBunting({ seed: 60 + i, span: 5.5, palette }), -6 + i * 6, 0, 10.5, false);
place(createBanner({ seed: 80, style: 'banner', pattern: 'saltire', palette }), -3.4, -8.8, 0, false);
place(createBanner({ seed: 81, style: 'banner', pattern: 'bands', palette }), 3.4, -8.8, 0, false);
const lamps = [];
[[-11, -3], [-3, -11], [11, -3], [3, 11], [-11, 9]].forEach(([x, z], i) =>
  lamps.push(place(createLamp({ seed: 20 + i, light: true, palette }), x, z, 0, false)));
place(createFence({ seed: 13, length: 8, palette }), -18, -11, 0.3, false);

const inTown = (x, z) => Math.hypot(x, z) < 24;
const forest = scatter({ seed: 21, area: { min: { x: -52, z: -52 }, max: { x: 52, z: 52 } },
  surface: groundAt, density: 0.045, minSpacing: 1.8,
  items: [{ create: (r) => createTree({ seed: r.int(1, 1e9), palette }), weight: 4, variants: 6 },
          { create: (r) => createRock({ seed: r.int(1, 1e9), palette }), weight: 1 },
          { create: (r) => createBush({ seed: r.int(1, 1e9), palette }), weight: 1 }],
  mask: (x, z) => !inTown(x, z) && !lane.contains(x, z) });
scene.add(forest.group);
const grass = scatter({ seed: 22, area: { min: { x: -34, z: -34 }, max: { x: 34, z: 34 } },
  surface: groundAt, density: 0.1, minSpacing: 0.9,
  items: [{ create: (r) => createGrassTuft({ seed: r.int(1, 1e9), palette }), variants: 8 }],
  mask: (x, z) => !lane.contains(x, z) && Math.hypot(x, z) > 11 });
scene.add(grass.group);
// One breeze over the valley — wood and meadow lean with the same gust.
const wind = createWindField({ direction: 40, strength: 0.32, gust: 0.6, waveLength: 7, waveSpeed: 2.2 });
applyWind(forest.group, { field: wind, height: 4, stiffness: 2.4, anchor: 1 });
applyWind(grass.group, { field: wind, height: 0.5, stiffness: 1.2, anchor: 0.03 });
// One createSeasons turns the whole wood — spring, summer, autumn, winter —
// re-grading the canopies in the shader (only foliage; trunks stay). It rides
// the same wind, so the trees sway and turn together. Auto-cycling.
const seasons = createSeasons({ initial: 'summer' });
seasons.apply(forest.group);
const SEASON = ['spring', 'summer', 'autumn', 'winter'];
let sIdx = 1;
setInterval(() => { sIdx = (sIdx + 1) % 4; seasons.set(SEASON[sIdx], { fade: 4 }); }, 9000);
// Birds wheeling around the bell tower.
const birds = createFlock({ type: 'birds', count: 44, center: [0, 16, -14], bounds: [16, 5, 16], circle: 11, seed: 12 });
scene.add(birds.object);
// Deer grazing the meadow beyond the village, feet on the terrain.
const deer = createHerd({ type: 'deer', count: 9, center: [32, 28], radius: 12, ground: groundAt, seed: 21 });
scene.add(deer.object);
const obstacles = [...collectObstacles(buildings), ...forest.obstacles];

// --- Farmers, villagers, knights.
function hoe() {
  const g = new Group();
  const h = new Mesh(new CylinderGeometry(0.018, 0.022, 0.95, 6), new MeshStandardMaterial({ color: palette.woodDark, flatShading: true }));
  h.position.y = 0.3; g.add(h);
  const head = new Mesh(new BoxGeometry(0.16, 0.05, 0.1), new MeshStandardMaterial({ color: palette.metal, flatShading: true }));
  head.position.set(0, 0.76, 0.06); g.add(head); g.rotation.x = 0.5; return g;
}
function spear() {
  const g = new Group();
  const s = new Mesh(new CylinderGeometry(0.02, 0.025, 2, 6), new MeshStandardMaterial({ color: palette.woodDark, flatShading: true }));
  s.position.y = 0.6; g.add(s);
  const t = new Mesh(new ConeGeometry(0.05, 0.28, 6), new MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.6, roughness: 0.4, flatShading: true }));
  t.position.y = 1.72; g.add(t); return g;
}
function shield() {
  const g = new Group();
  const d = new Mesh(new CylinderGeometry(0.3, 0.3, 0.06, 12), createSurface('metal', { color: 0x5a6270 }));
  d.rotation.x = Math.PI / 2; g.add(d); return g;
}
function makeNpc(seed, kind) {
  if (kind === 'knight') { const r = createHumanoid({ seed, palette: OUTFITS.guard, accessories: ['shoulderPads', 'cap'] }); attach(r, 'handRight', spear()); attach(r, 'handLeft', shield()); return r; }
  if (kind === 'farmer') { const r = createHumanoid({ seed, palette: OUTFITS.villager, accessories: ['hat'] }); attach(r, 'handRight', hoe()); return r; }
  return createHumanoid({ seed, palette: seed % 4 === 0 ? OUTFITS.winter : OUTFITS.villager });
}
const cast = []; const agents = [];
function walker(seed, kind, route, offset, speed) {
  const r = makeNpc(seed, kind);
  const obj = game.world.spawn('npc'); obj.add(r.object);
  const patrol = new Path(route.map((p) => p.clone()), true);
  for (let s = 0; s < offset; s++) patrol.advance();
  obj.position.copy(patrol.current());
  const agent = obj.addComponent(new MotionAgent({ maxSpeed: speed, maxForce: 20, planar: true }));
  agent.addBehavior(new FollowPath(patrol, 1.6));
  agent.addBehavior(new ObstacleAvoidance(() => obstacles, 3, 0.5), 2.4);
  agent.addBehavior(new Separation(() => agents, 1.3), 1.1);
  agents.push(agent);
  cast.push({ rig: r, loco: new Locomotion(r), ik: new FootIK(r, { ground: groundAt }), agent });
}
for (let i = 0; i < 6; i++) walker(100 + i, i % 3 === 0 ? 'farmer' : 'villager', lane.route, (i * lane.route.length) / 6, 1.1 + (i % 3) * 0.2);
for (let i = 0; i < 3; i++) walker(200 + i, 'knight', ring.route, (i * ring.route.length) / 3, 1.3);
[[11, -5, 'villager'], [11, 0, 'farmer'], [11, 5, 'villager'], [-7, 6.5, 'farmer'], [-2, -8, 'knight'], [2.5, -8, 'knight']]
  .forEach(([x, z, kind], i) => {
    const r = makeNpc(300 + i, kind);
    r.object.position.copy(at(x, z)); r.object.rotation.y = Math.atan2(-x, -z) + (i % 2 ? 0.5 : -0.5);
    scene.add(r.object);
    cast.push({ rig: r, loco: new Locomotion(r), ik: new FootIK(r, { ground: groundAt }), gaze: new LookAt(r) });
  });

const crowd = new Crowd({ count: 36, seed: 9, variants: 4 });
scene.add(crowd.group); crowd.followRoute(lane.route, { surface: groundAt });
game.onUpdate((t) => crowd.update(t.delta));

const cycle = createDayCycle({ sky, rig: light, scene, lamps: [...lamps, ...houses, hall], palette, dayLength: 90, timeOfDay: 0.4 });
game.onUpdate((t) => cycle.update(t.delta));

game.onUpdate((t) => {
  for (const c of cast) {
    if (c.agent) { const p = c.agent.owner.position; p.y = groundAt(p.x, p.z); c.loco.update(t.delta, c.agent.velocity); }
    else { c.loco.update(t.delta, 0); if (c.gaze) { let best = null, bd = 9; for (const a of agents) { const d = a.owner.position.distanceTo(c.rig.object.position); if (d < bd) { bd = d; best = a.owner.position; } } c.gaze.target = best; c.gaze.update(t.delta); } }
    c.ik.update();
  }
  const a = t.elapsed * 0.05, y = groundAt(0, 0);
  game.camera.position.set(Math.cos(a) * 28, y + 14, Math.sin(a) * 28);
  game.camera.lookAt(0, y + 2, 0);
});
game.start();`,
  },

  {
    id: 'race',
    title: 'Pocket racer (playable!)',
    group: 'Games',
    code: `// A playable racer — phone AND desktop — where the whole game (player car,
// AI rivals, chase camera, on-screen joystick, car-vs-car collision, and lap
// standings with a finish) is one call: GAMA's createRace. SCENA paves the
// ring and builds the cars; your ANIMA driver rides the moving seat. All
// that's left below is world-building and a HUD.
import { createCar, createPath, createPlanter, createTree, createSky,
         createLightingRig, applyFog, createSurface, PALETTES } from 'scena3d';
import { createHumanoid, Interaction, Locomotion, OUTFITS } from 'anima3d';
import { Game } from 'gama3d';
import { createRace, Circuit } from 'gama3d/templates';
import { Mesh, PlaneGeometry } from 'three';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(320, 320), createSurface('concrete'));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

// The circuit: SCENA paves the kinked ring, GAMA's Circuit tracks it.
const WAYPOINTS = [];
for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2;
  const r = 26 + Math.sin(a * 2) * 7;
  WAYPOINTS.push({ x: Math.cos(a) * r * 1.35, z: Math.sin(a) * r });
}
scene.add(createPath(WAYPOINTS, { width: 7, loop: true, palette }).mesh);
const circuit = new Circuit(WAYPOINTS);
[4, 9, 13, 16].forEach((i) => {
  const planter = createPlanter({ seed: 20 + i, length: 1.2, palette });
  planter.object.position.set(WAYPOINTS[i].x * 1.22, 0, WAYPOINTS[i].z * 1.28);
  scene.add(planter.object);
});
[[0, 0], [46, 30], [-48, -22], [10, -38]].forEach(([x, z], i) => {
  const tree = createTree({ species: 'maple', seed: 40 + i, height: 5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
});

// The whole race — player + two rivals + camera + touch + collisions + laps.
const player = createCar({ seed: 3, color: 0xb8433a, palette });
const rivalCars = [0x3a6ea5, 0x3f7f5c].map((color, i) =>
  createCar({ seed: 11 + i, color, palette }));
const race = createRace(game, {
  circuit,
  player: { object: player.object, vehicle: player, name: 'you' },
  rivals: rivalCars.map((car, i) => ({
    object: car.object, vehicle: car, speed: 10 + i, name: 'rival ' + (i + 1),
  })),
  laps: 3,
});

// An ANIMA driver rides the player's (moving) seat.
const rig = createHumanoid({ seed: 9, palette: OUTFITS.villager });
race.player.object.add(rig.object);
const loco = new Locomotion(rig);
const act = new Interaction(rig, loco);
act.use(player.slots[0], { fade: 0.01 });

// HUD + finish screen.
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;top:10px;right:12px;z-index:10;color:#fff;' +
  'text-align:right;font:600 15px/1.5 system-ui;text-shadow:0 1px 3px #000';
if (innerWidth < 560) hud.style.top = '84px';
document.body.appendChild(hud);

game.onUpdate((t) => {
  loco.update(t.delta, 0);
  act.update(t.delta);
  const s = race.state;
  const best = s.bestLap < Infinity ? ' · best ' + s.bestLap.toFixed(1) + 's' : '';
  hud.textContent = 'P' + s.position + '/' + s.total + ' · LAP ' +
    Math.min(s.lap + 1, 3) + '/3 · ' + s.lapTime.toFixed(1) + 's' + best +
    ' · ' + Math.round(race.player.controller.speed * 3.6) + ' km/h';
});

race.onFinish((r) => {
  const place = ['🏆 1st', '🥈 2nd', '🥉 3rd'][r.position - 1] || ('P' + r.position);
  const card = document.createElement('div');
  card.style.cssText = 'position:fixed;inset:0;z-index:30;display:grid;' +
    'place-items:center;background:rgba(6,9,16,.72);color:#eef2f7;' +
    'font:600 20px/1.6 system-ui;text-align:center';
  card.innerHTML = '<div><div style="font-size:44px">' + place + '</div>Total ' +
    r.totalTime.toFixed(1) + 's</div>';
  document.body.appendChild(card);
});

game.start();`
  },

  {
    id: 'mechanisms',
    title: 'Manipulables (operate the world)',
    group: 'Games',
    code: `// Props with STATE that animate when operated: a keeper throws a lever
// (an ANIMA reach gesture), which raises the LINKED portcullis; walks
// through the automatic door; and opens the chest. SCENA builds the
// stateful props, GAMA wires the level logic, ANIMA does the reaching.
import { createSky, createLightingRig, applyFog, createSurface, createTree,
         createDoor, createLever, createHatch, createPortcullis, PALETTES } from 'scena3d';
import { createHumanoid, createReachClip, FootIK, Gesture, Locomotion, OUTFITS } from 'anima3d';
import { Game, MotionAgent, FollowPath, Path, Interactable, linkMechanism } from 'gama3d';
import { Mesh, PlaneGeometry, Vector3 } from 'three';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(120, 120), createSurface('cobblestone', { seed: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
[[-9, 4], [9, -2]].forEach(([x, z], i) => {
  const tree = createTree({ species: 'oak', seed: 30 + i, height: 5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
});

// A curtain wall with a portcullis gateway; a lever beside it raises the gate.
for (const s of [-1, 1]) {
  const wall = new Mesh(new PlaneGeometry(6, 3.4), createSurface('ashlar', { seed: 4 }));
  wall.position.set(s * 4.9, 1.7, 0);
  scene.add(wall);
}
const portcullis = createPortcullis({ seed: 2, width: 2.4, height: 3 });
scene.add(portcullis.object);
const lever = createLever({ seed: 5 });
lever.object.position.set(2.6, 0, 1.4);
lever.object.rotation.y = -0.5;
scene.add(lever.object);
linkMechanism(lever, portcullis);   // throw the lever → the gate rises

// Beyond the gate: an AUTOMATIC door (opens on approach), then a chest.
const door = createDoor({ seed: 7, width: 1.1, height: 2.1 });
const doorObj = game.world.spawn('door');
doorObj.position.set(0, 0, -5);
doorObj.add(door.object);
doorObj.addComponent(new Interactable(door, { mode: 'auto', radius: 2.4, tag: 'player' }));
const chest = createHatch({ seed: 9 });
chest.object.position.set(0, 0, -7.5);
scene.add(chest.object);

// The keeper.
const rig = createHumanoid({ seed: 12, palette: OUTFITS.villager });
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const walker = game.world.spawn('keeper');
walker.tags.add('player');
walker.add(rig.object);
walker.position.set(2.4, 0, 6);
const agent = walker.addComponent(new MotionAgent({ maxSpeed: 2.8, maxForce: 18, planar: true }));

const standAt = (m) => { m.object.updateWorldMatrix(true, true);
  return m.slots[0].anchor.getWorldPosition(new Vector3()); };
const leverStand = standAt(lever), chestStand = standAt(chest);
const walkTo = (...pts) => { agent.clearBehaviors(); agent.maxSpeed = 2.8;
  agent.addBehavior(new FollowPath(new Path([walker.position.clone(), ...pts], false), 0.4)); };
walkTo(leverStand);

let phase = 'toLever';
let reach = null;
const startReach = (onApex) => { agent.maxSpeed = 0; reach = new Gesture(loco, createReachClip(rig), { onApex }); };
const face = (p) => { walker.rotation.y = Math.atan2(p.x - walker.position.x, p.z - walker.position.z); };

game.onUpdate((t) => {
  const dt = t.delta;
  loco.update(dt, reach ? 0 : agent.velocity);
  ik.update();
  if (reach && !reach.update(dt)) reach = null;

  if (phase === 'toLever' && walker.position.distanceTo(leverStand) < 0.6) {
    phase = 'throwing'; face(lever.object.position); startReach(() => lever.toggle());
  } else if (phase === 'throwing' && !reach && portcullis.state > 0.85) {
    phase = 'toChest'; walkTo(new Vector3(0, 0, 1), new Vector3(0, 0, -3), chestStand);
  } else if (phase === 'toChest' && walker.position.distanceTo(chestStand) < 0.6) {
    phase = 'opening'; face(chest.object.position); startReach(() => chest.toggle());
  } else if (phase === 'opening' && !reach) phase = 'done';

  lever.update(dt); portcullis.update(dt); chest.update(dt);

  const f = walker.position;
  camTarget.set(f.x + 5, 4.5, f.z + 8);
  game.camera.position.lerp(camTarget, Math.min(1, 2 * dt));
  game.camera.lookAt(f.x, 1, f.z - 1);
});
const camTarget = new Vector3(6, 5, 12);
game.camera.position.set(6, 5, 12);
game.start();`
  },

  {
    id: 'carry',
    title: 'Carryables (pick up · carry · throw)',
    group: 'Games',
    code: `// The carry verb: a porter picks up a crate, carries it (still walking),
// and THROWS it onto the cart; then shoulders a sack and hands it to a mate.
// SCENA builds the carryables, ANIMA's Carry does the holding, GAMA's
// throwObject does the arc.
import { createSky, createLightingRig, applyFog, createSurface, createTree,
         createCart, createCrate, createBarrel, createBasket, createSack,
         createLantern, PALETTES } from 'scena3d';
import { createHumanoid, Carry, createReachClip, FootIK, Gesture,
         Locomotion, OUTFITS } from 'anima3d';
import { Game, MotionAgent, FollowPath, Path, throwObject } from 'gama3d';
import { Mesh, PlaneGeometry, Vector3 } from 'three';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(120, 120), createSurface('dirt', { seed: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const cart = createCart({ seed: 3, style: 'wagon', cargo: 'empty', palette });
cart.object.position.set(4.5, 0, -2.5);
cart.object.rotation.y = -0.5;
scene.add(cart.object);
const cartBed = new Vector3(4.5, 0.8, -2.5); // the wagon's bed-top height
const place = (obj, x, z) => { obj.position.set(x, 0, z); scene.add(obj); };
place(createBarrel({ seed: 5, palette }).object, -5.5, 4.2);
place(createBasket({ seed: 6, palette }).object, -6.2, 2.4);
place(createLantern({ seed: 7 }).object, -5.6, 0.6);

const crate = createCrate({ seed: 2, size: 0.45, palette });
crate.object.position.set(-3, 0, 3);
scene.add(crate.object);
const sack = createSack({ seed: 4 });
sack.object.position.set(-4, 0, -3);
scene.add(sack.object);

const rig = createHumanoid({ seed: 12, palette: OUTFITS.villager });
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const carry = new Carry(rig, loco);
const walker = game.world.spawn('porter');
walker.add(rig.object);
walker.position.set(0, 0, 6);
const agent = walker.addComponent(new MotionAgent({ maxSpeed: 2.6, maxForce: 18, planar: true }));

const mate = createHumanoid({ seed: 21, palette: OUTFITS.villager });
mate.object.position.set(2.2, 0, -5);
mate.object.rotation.y = Math.PI;
scene.add(mate.object);
const mateLoco = new Locomotion(mate);
const mateCarry = new Carry(mate, mateLoco);

const approach = (p, gap = 0.9) => {
  const dir = new Vector3().subVectors(walker.position, p).setY(0).normalize();
  return p.clone().addScaledVector(dir, gap);
};
const walkTo = (p) => { agent.clearBehaviors(); agent.maxSpeed = 2.6;
  agent.addBehavior(new FollowPath(new Path([walker.position.clone(), p], false), 0.4)); };
const face = (p) => { walker.rotation.y = Math.atan2(p.x - walker.position.x, p.z - walker.position.z); };

const cratePos = crate.object.position.clone();
const sackPos = sack.object.position.clone();
const cartStand = new Vector3(cartBed.x - 1.6, 0, cartBed.z + 1.2);
const mateStand = new Vector3(mate.object.position.x + 0.1, 0, mate.object.position.z + 1.1);
walkTo(approach(cratePos));

let phase = 'toCrate';
let reach = null, fly = null;
const startReach = (onApex) => { agent.maxSpeed = 0; reach = new Gesture(loco, createReachClip(rig), { onApex }); };

game.onUpdate((t) => {
  const dt = t.delta;
  loco.update(dt, reach ? 0 : agent.velocity);
  mateLoco.update(dt, 0);
  ik.update();
  if (reach && !reach.update(dt)) reach = null;
  if (fly && !fly(dt)) fly = null;

  if (phase === 'toCrate' && walker.position.distanceTo(approach(cratePos)) < 0.5) {
    phase = 'toCart'; face(cratePos); carry.pickUp(crate); walkTo(cartStand);
  } else if (phase === 'toCart' && walker.position.distanceTo(cartStand) < 0.5) {
    phase = 'throwing'; face(cartBed);
    startReach(() => { const box = carry.putDown();
      if (box) fly = throwObject(box, { to: cartBed, peak: 1.8, gravity: 20,
        ground: cartBed.y, spin: new Vector3(2, 0.6, 0) }); });
  } else if (phase === 'throwing' && !reach && !fly) {
    phase = 'toSack'; walkTo(approach(sackPos));
  } else if (phase === 'toSack' && walker.position.distanceTo(approach(sackPos)) < 0.5) {
    phase = 'toMate'; face(sackPos); carry.pickUp(sack); walkTo(mateStand);
  } else if (phase === 'toMate' && walker.position.distanceTo(mateStand) < 0.5) {
    phase = 'done'; face(mate.object.position); carry.handTo(mateCarry);
  }

  const f = walker.position;
  camTarget.set(f.x + 4.5, 4.2, f.z + 7);
  game.camera.position.lerp(camTarget, Math.min(1, 2 * dt));
  game.camera.lookAt(f.x, 1, f.z - 1);
});
const camTarget = new Vector3(5, 5, 12);
game.camera.position.set(5, 5, 12);
game.start();`
  },

  {
    id: 'labor',
    title: 'Work stations (chop · mine · saw · stir)',
    group: 'Games',
    code: `// Rhythmic work: the worker chops, mines, saws and stirs — each a looping
// action that throws chips/sparks/dust/steam and YIELDS a resource into a
// stockpile (top-right HUD). SCENA builds the stations, ANIMA plays the loop
// over idle, GAMA counts the produce. Work over time, produce something.
import { createSky, createLightingRig, applyFog, createSurface, createTree,
         createChoppingBlock, createOreVein, createSawhorse, createCookpot,
         PALETTES } from 'scena3d';
import { attach, createHumanoid, createLoopClip, FootIK, Locomotion, OUTFITS } from 'anima3d';
import { Game, MotionAgent, FollowPath, Path, Stockpile } from 'gama3d';
import { Mesh, PlaneGeometry, Vector3 } from 'three';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(120, 120), createSurface('dirt', { seed: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
[[-8, -6], [8, 5]].forEach(([x, z], i) => {
  const t = createTree({ species: 'oak', seed: 30 + i, height: 5, palette });
  t.object.position.set(x, 0, z); scene.add(t.object);
});

const place = (s, x, z, rotY) => {
  s.object.position.set(x, 0, z); s.object.rotation.y = rotY;
  scene.add(s.object); s.object.updateWorldMatrix(true, true);
  return { station: s, at: s.slots[0].anchor.getWorldPosition(new Vector3()) };
};
const jobs = [
  { ...place(createChoppingBlock({ seed: 2, palette }), -3, 0, 0.4), resource: 'wood' },
  { ...place(createOreVein({ seed: 3, palette }), 0.5, -3.2, 0), resource: 'ore' },
  { ...place(createSawhorse({ seed: 4, palette }), 3, 0.5, -0.5), resource: 'plank' },
  { ...place(createCookpot({ seed: 5, palette }), 0, 3, Math.PI), resource: 'stew' },
];

const rig = createHumanoid({ seed: 14, palette: OUTFITS.villager });
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const worker = game.world.spawn('worker');
worker.add(rig.object);
worker.position.set(0, 0, 6);
const agent = worker.addComponent(new MotionAgent({ maxSpeed: 2.4, maxForce: 18, planar: true }));

const stock = new Stockpile();
const ICON = { wood: '🪵', ore: '⛏️', plank: '🪚', stew: '🍲' };
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;top:10px;right:12px;z-index:10;color:#fff;' +
  'text-align:right;font:600 16px/1.6 system-ui;text-shadow:0 1px 3px #000';
document.body.appendChild(hud);
const renderHud = () => { hud.innerHTML = ['wood','ore','plank','stew']
  .map((r) => ICON[r] + ' ' + stock.count(r)).join('<br>'); };
stock.events.on('change', renderHud); renderHud();

const walkTo = (p) => { agent.clearBehaviors(); agent.maxSpeed = 2.4;
  agent.addBehavior(new FollowPath(new Path([worker.position.clone(), p], false), 0.4)); };
let index = 0, phase = 'walk', tool = null, loopAct = null, yieldsHere = 0;
let current = jobs[0];
walkTo(current.at);

const startWork = () => {
  phase = 'work'; agent.maxSpeed = 0; yieldsHere = 0;
  current.station.onYield = () => { stock.add(current.resource); yieldsHere += 1; };
  const c = current.station.object.position;
  worker.rotation.y = Math.atan2(c.x - worker.position.x, c.z - worker.position.z);
  loopAct = loco.overlay(createLoopClip(rig, current.station.action), { fadeIn: 0.3 });
  tool = current.station.tool;
  attach(rig, 'handRight', tool);
};
const leaveWork = () => {
  current.station.onYield = undefined;
  if (loopAct) { loco.stopOverlay(loopAct, 0.3); loopAct = null; }
  if (tool) { tool.removeFromParent(); tool = null; }
  index = (index + 1) % jobs.length;
  current = jobs[index]; phase = 'walk'; walkTo(current.at);
};

game.onUpdate((t) => {
  const dt = t.delta;
  loco.update(dt, phase === 'work' ? 0 : agent.velocity);
  ik.update();
  for (const j of jobs) j.station.update(dt, phase === 'work' && j === current);
  if (phase === 'walk' && worker.position.distanceTo(current.at) < 0.55) startWork();
  else if (phase === 'work' && yieldsHere >= 4) leaveWork();
  const f = worker.position;
  camTarget.set(f.x + 4.5, 4, f.z + 6.5);
  game.camera.position.lerp(camTarget, Math.min(1, 2 * dt));
  game.camera.lookAt(f.x, 0.9, f.z - 1);
});
const camTarget = new Vector3(5, 5, 12);
game.camera.position.set(5, 5, 12);
game.start();`
  },

  {
    id: 'miami',
    title: 'Miami beach walk (playable!)',
    group: 'Games',
    code: `// A PLAYABLE HUMANOID ON A SCENA BEACH — phone and desktop, one code
// path. Drag anywhere to swing the camera; WASD / arrows to walk, hold
// SHIFT to run. On a phone the joystick and the RUN button appear by
// themselves (GAMA's TouchControls writes the same virtual axis the
// keyboard writes, so nothing in the game branches on input type).
//
// THE WHOLE TRILOGY IN ONE LOOP: SCENA owns the beach (its props, its
// sand profile, its sea), ANIMA owns the body (the rig, the blended
// gaits, the feet), GAMA owns the game (input, camera, the clock) — and
// the ONLY things crossing between them are a velocity vector and a
// heightAt function.
import { createLifeguardTower, createBeachUmbrella, createLounger,
  createPalm, createBananaTree, createSmallCraft, createOcean,
  createFlock, createSurface } from 'scena3d';
import { createHumanoid, Locomotion, FootIK, Swimming } from 'anima3d';
import { Game, TouchControls } from 'gama3d';
import { Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial,
  AmbientLight, DirectionalLight, HemisphereLight, Color, Fog,
  Group, Quaternion, Raycaster, RingGeometry, Vector2,
  Vector3 } from 'three';

const game = new Game();
const scene = game.world.scene;
scene.background = new Color(0x6fc6e8);
scene.fog = new Fog(0x9fd8ea, 260, 900);
scene.add(new HemisphereLight(0xdff2ff, 0xe8d9a8, 0.75));
scene.add(new AmbientLight(0xffffff, 0.25));
const sun = new DirectionalLight(0xfff6e0, 1.35);
sun.position.set(-30, 40, 22);
scene.add(sun);

// THE BEACH PROFILE — one function, and everything reads it: the sand
// mesh, the sea's shore fade, the props' footings, and the player's feet.
const profile = (x, z) => {
  const face = Math.max(-4.2, Math.min(2.1, (z - 4) * 0.155));
  const dune = Math.max(0, Math.min(1, (z - 34) / 18));
  const dry = Math.max(0, Math.min(1, (z - 7) / 10));
  return face + dune * dune * 2.8
    + dry * (Math.sin(x * 0.07) * 0.2 + Math.cos(z * 0.05 + x * 0.02) * 0.16);
};
const sandGeo = new PlaneGeometry(330, 220, 100, 80);
sandGeo.rotateX(-Math.PI / 2);
{
  const pos = sandGeo.getAttribute('position');
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i) + 55;
    pos.setY(i, profile(x, z));
    // Wet sand, dark and wide enough to cover everything the swash can
    // reach — otherwise the drained beach flashes dry tan between waves.
    const wet = Math.max(0, Math.min(1, (13 - z) / 11));
    cols.push(1 - wet * 0.46, 1 - wet * 0.44, 1 - wet * 0.38);
  }
  sandGeo.setAttribute('color',
    new (Object.getPrototypeOf(pos).constructor)(new Float32Array(cols), 3));
  sandGeo.computeVertexNormals();
}
const sandMat = createSurface('sand', { seed: 4, color: 0xf3e6c4 });
sandMat.vertexColors = true;
const sand = new Mesh(sandGeo, sandMat);
sand.position.z = 55;
scene.add(sand);

const ocean = createOcean({
  level: 0, size: 700, segments: 200, amplitude: 0.42, wavelength: 23,
  choppiness: 0.6, direction: 180, shore: profile,
  shallowColor: 0x51e3d6, deepColor: 0x0a6fb4, skyColor: 0x9fd8ea,
  // Breakers running in, and a waterline that runs up the sand and drains.
  surf: { breakDepth: 1.8, runUp: 0.45, period: 8, bands: 2.4 },
  // A WIDE turquoise shelf, the chop that breaks the light on it, and
  // water you can see the bottom through — which is the whole point of
  // swimming out to a reef.
  shoalDepth: 13,
  ripples: { strength: 0.4, scale: 0.8 },
  clarity: 0.8,
});

// LIFE IN THE SHALLOWS. A school out on the turquoise shelf — and it
// KNOWS you are there: wade toward it and it slides away, which is the
// single cheapest thing that makes water feel inhabited rather than
// decorated.
const school = createFlock({
  type: 'fish', count: 70, center: [6, -1.2, -22], bounds: [16, 0.9, 12],
  speed: 2.2, size: 0.42, color: 0x86d8e8, seed: 5,
});
scene.add(school.object);
// One list, so a school added later cannot forget to be shy.
const schools = [{ flock: school, home: new Vector3(6, -1.2, -22),
  shy: 14, give: 1.1 }];
const scatterAt = new Vector3();
const away = new Vector3();

// THE REEF — somewhere to swim TO. Exploring needs a destination, so the
// deep water gets a patch of coral heads and three schools of different
// fish hanging over it, each at its own depth.
const reef = new Group();
reef.position.set(4, 0, -30);
scene.add(reef);
[0xff7a59, 0xffc04d, 0xd86bd8, 0x6be3c6, 0xf2f0dd].forEach((c, i) => {
  const mat = new MeshStandardMaterial({ color: c, roughness: 0.85,
    flatShading: true });
  for (let k = 0; k < 7; k++) {
    const a = (i * 7 + k) * 1.31;
    const head = new Mesh(new BoxGeometry(0.7 + (k % 3) * 0.35,
      0.5 + (k % 4) * 0.4, 0.7 + (k % 2) * 0.4), mat);
    head.position.set(Math.sin(a) * (2 + (k % 5) * 1.7),
      profile(4, -30) + 0.3 + (k % 3) * 0.25, Math.cos(a * 1.7) * (2 + k * 1.1));
    head.rotation.y = a;
    reef.add(head);
  }
});
const reefFish = [
  createFlock({ type: 'fish', count: 45, center: [4, -2.4, -30],
    bounds: [7, 0.7, 7], speed: 1.5, size: 0.34, color: 0xffd166, seed: 11 }),
  createFlock({ type: 'fish', count: 35, center: [1, -3.1, -33],
    bounds: [6, 0.6, 6], speed: 1.2, size: 0.3, color: 0xff6f91, seed: 12 }),
  createFlock({ type: 'fish', count: 30, center: [8, -1.9, -27],
    bounds: [5, 0.6, 5], speed: 1.8, size: 0.38, color: 0x7ac6ff, seed: 13 }),
];
reefFish.forEach((f, i) => {
  scene.add(f.object);
  const home = [[4, -2.4, -30], [1, -3.1, -33], [8, -1.9, -27]][i];
  // Shy, but loyal: they part at four metres and re-form behind you.
  schools.push({ flock: f, home: new Vector3(...home), shy: 4.5, give: 0.9 });
});

// SPLASH RINGS: rings that bloom where a foot breaks the surface and
// fade as they spread. Pooled — a beach walk would otherwise leak meshes
// for as long as you play.
const ringGeo = new RingGeometry(0.18, 0.3, 14).rotateX(-Math.PI / 2);
const splashes = [];
for (let i = 0; i < 14; i++) {
  const ring = new Mesh(ringGeo, new MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0, roughness: 0.6 }));
  ring.visible = false;
  scene.add(ring);
  splashes.push({ ring, life: 0 });
}
let splashNext = 0;
const splash = (x, y, z) => {
  const s = splashes[splashNext = (splashNext + 1) % splashes.length];
  s.ring.position.set(x, y + 0.03, z);
  s.ring.scale.setScalar(0.6);
  s.ring.visible = true;
  s.life = 1;
};
scene.add(ocean.mesh);

// The kit, seated on the profile so nothing floats or sinks. The blocker
// list is everything the camera must not see through — filled as we build.
const kit = [];
const blockers = [];
[[-28, 9, 3], [-3, 7, 7], [25, 10, 11]].forEach(([x, z, seed]) => {
  const tower = createLifeguardTower({ seed });
  tower.object.scale.setScalar(1.25);
  tower.object.position.set(x, profile(x, z), z);
  tower.object.rotation.y = Math.PI + x / 90;
  scene.add(tower.object);
  kit.push(tower);
  blockers.push(tower.object);
});
for (let row = 0; row < 3; row++) {
  for (let i = 0; i < 9; i++) {
    const x = -34 + i * 8.5 + (row % 2) * 3.6;
    const z = 14 + row * 6.5;
    const umbrella = createBeachUmbrella({ seed: row * 20 + i });
    umbrella.object.position.set(x, profile(x, z), z);
    scene.add(umbrella.object);
    kit.push(umbrella);
    for (const side of [-1.05, 1.05]) {
      const lounger = createLounger({ seed: row * 40 + i * 3 + (side > 0 ? 1 : 0),
        recline: ['flat', 'reading', 'upright'][(i + row) % 3] });
      lounger.object.position.set(x + side, profile(x + side, z + 0.6), z + 0.6);
      lounger.object.rotation.y = Math.PI + side * 0.12;
      scene.add(lounger.object);
      kit.push(lounger);
    }
  }
}
[[-42, 33, 10], [-30, 31, 8.6], [-18, 33, 10.5], [-6, 31, 9],
 [6, 32, 10.2], [18, 31, 8.8], [30, 33, 10], [42, 31, 9.4]]
  .forEach(([x, z, h], i) => {
  const palm = createPalm({ seed: 60 + i, height: h, lean: 0.13 });
  palm.object.position.set(x, profile(x, z), z);
  palm.object.rotation.y = (i % 2 ? 1 : -1) * Math.PI / 2;
  scene.add(palm.object);
  kit.push(palm);
});
[[-36, 39], [-11, 40], [14, 39], [37, 40]].forEach(([x, z], i) => {
  const banana = createBananaTree({ seed: 80 + i, fruiting: i % 2 === 0 });
  banana.object.position.set(x, profile(x, z), z);
  scene.add(banana.object);
  kit.push(banana);
});
[[-36, 3], [-19, 1], [-2, 4], [15, 2], [32, 5]].forEach(([x, seed], i) => {
  const hue = [0xff9ec4, 0x6fdcd2, 0xffd166, 0xa9b8ff, 0xffab7a][i];
  const wall = new MeshStandardMaterial({ color: hue, roughness: 0.85 });
  const trim = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const storeys = 2 + (seed % 3), w = 11 + (seed % 4);
  const block = new Mesh(new BoxGeometry(w, storeys * 3.4, 9), wall);
  block.position.set(x, 2.6 + storeys * 1.7, 54);
  scene.add(block);
  for (let f = 1; f <= storeys; f++) {
    const brow = new Mesh(new BoxGeometry(w + 0.9, 0.35, 9.6), trim);
    brow.position.set(x, 2.6 + f * 3.4 - 0.5, 54);
    scene.add(brow);
  }
});
const boat = createSmallCraft({ fit: 'open', length: 4.6, seed: 12 });
boat.object.position.set(34, profile(34, 8) + 0.2, 8);
boat.object.rotation.set(0, 2.5, 0.09);
scene.add(boat.object);

// ── THE PLAYER ────────────────────────────────────────────────────────
// A seeded ANIMA body, its synthesized gaits, and feet that read SCENA's
// ground. Nothing here knows it is in a game.
const hero = createHumanoid({ seed: 27, height: 1.78,
  outfit: { top: 'shirt', bottom: 'shorts', sleeves: 'short' } });
hero.object.position.set(0, profile(0, 20), 20);
scene.add(hero.object);
const loco = new Locomotion(hero);
const feet = new FootIK(hero, { ground: profile, hipsAdapt: 0.5 });

// GAMA's touch layer: a joystick and a RUN button, on phones only. The
// keyboard keeps working — the game reads ONE axis either way.
new TouchControls(game.input, {
  buttons: [
    { label: 'RUN', code: 'ShiftLeft', css: 'right:26px;bottom:38px' },
    { label: 'DIVE', code: 'Space', css: 'right:112px;bottom:38px' },
  ],
});

// Drag to swing the camera. (On a phone the joystick owns the bottom-left
// corner, so drags elsewhere are look-around — no mode switch needed.)
// Yaw 0 puts the camera BEHIND the walker, looking out over the water:
// push forward and you walk away from the camera, down the beach.
let camYaw = 0;
let dragging = false;
const canvas = game.renderer.domElement;
canvas.addEventListener('pointerdown', (e) => { dragging = e.button === 0; });
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointermove', (e) => {
  if (dragging) camYaw -= e.movementX * 0.005;
});

// A third-person camera that will not be shoved through solid things:
// it casts a ray out from the body each frame and pulls in short of
// whatever it hits. Only STANDING things are blockers — letting parasols
// push the lens jams it into the sand, and you can see under a parasol
// anyway.
const camAim = new Vector3();
const camWant = new Vector3();
const ray = new Raycaster();

// THE WATER BODY. ANIMA's Swimming asks three things — where the surface
// is, how deep it is here, and a place to send ripples — and SCENA can
// answer all three off the ocean it is already drawing. depthOver folds
// in the swash, so the water the swimmer feels is the water on screen,
// and disturb() lands as the same splash ring a footfall throws.
const water = {
  surfaceY: ocean.level,
  depthAt: (x, z) => ocean.depthOver(profile(x, z)),
  disturb: (x, z) => splash(x, ocean.level, z),
};
// pace lifts the whole water gait: a real crawl is ~1.3 m/s, which is
// honest and also a long wait when the shelf is eighty metres wide.
const swim = new Swimming(hero, loco, { stroke: 'crawl', pace: 1.7 });

const WALK = 1.5, RUN = 4.2;
const axis = new Vector2();
const velocity = new Vector3();
let facing = Math.PI;
let splashClock = 1;
let dive = 0;                  // 0 at the surface, 1 fully under
const qDive = new Quaternion();
const X_AXIS = new Vector3(1, 0, 0);
let wasUnder = false;
const AIR_FOG = scene.fog;
const SEA_FOG = new Fog(0x0d5f78, 2, 34);

game.onUpdate((t) => {
  const dt = t.delta;
  ocean.update(dt);
  for (const prop of kit) prop.update(dt);

  // ONE axis, whatever wrote it: keys, gamepad stick or thumb.
  game.input.moveAxis(axis);
  const running = game.input.isDown('ShiftLeft') || game.input.isDown('ShiftRight');
  const speed = running ? RUN : WALK;

  // Camera-relative: "forward" is wherever you are looking.
  const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  velocity.set(
    (axis.x * cos - axis.y * sin) * speed, 0,
    (axis.x * -sin - axis.y * cos) * speed
  );
  if (axis.lengthSq() > 0.001) {
    // Turn toward travel by the shortest way, never snapping.
    const want = Math.atan2(velocity.x, velocity.z);
    let d = want - facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    facing += d * Math.min(1, dt * 9);
  }
  const p = hero.object.position;

  // ── IN OR OUT OF THE WATER ──────────────────────────────────────────
  // Swimming OWNS the body once it floats: it moves the root, sets the
  // height and the roll, and derives stroke rate from speed so the
  // swimmer never skates. Out of the water it hands everything straight
  // back, so the branch below is just "is anybody else driving?".
  swim.steer(facing, axis.lengthSq() > 0.001 ? (running ? 1 : 0.8) : 0);
  swim.update(dt, water);
  const swimming = swim.state !== 'dry';

  if (!swimming) {
    p.x = Math.max(-70, Math.min(70, p.x + velocity.x * dt));
    p.z = Math.max(-44, Math.min(46, p.z + velocity.z * dt));
    p.y = profile(p.x, p.z);
    hero.object.rotation.y = facing;
  }
  p.x = Math.max(-70, Math.min(70, p.x));
  p.z = Math.max(-44, Math.min(46, p.z));

  // THE DIVE. Hold SPACE and the swimmer goes under — but only where
  // there is water to go under, so you cannot submerge in the shallows.
  // Swimming writes the height every frame, so the duck is applied AFTER
  // it: last writer wins, and the two never argue.
  const here = water.depthAt(p.x, p.z);
  const canDive = swim.state === 'swimming' && here > 1.6;
  const wantDive = canDive && game.input.isDown('Space');
  dive += ((wantDive ? 1 : 0) - dive) * Math.min(1, dt * 2.2);
  if (dive > 0.001) {
    p.y -= dive * Math.min(here - 0.6, 2.4);
    // Nose down as they go: a body that sinks flat is a corpse.
    qDive.setFromAxisAngle(X_AXIS, dive * 0.55);
    hero.object.quaternion.multiply(qDive);
  }

  // THE SWASH IS NOT JUST A PICTURE. depthOver reads the very run-up the
  // shader is drawing, so the walker is caught by the wave you watched
  // arrive: ankle deep it wades short and heavy, deeper it slows right
  // down. One simulation — the water never disagrees with itself.
  const wade = here;
  // EVERY school gives way, not just the one in the shallows: a fish that
  // ignores a diver in its face is scenery. Reef fish hold tighter to
  // home than the shelf school — a reef IS the thing they will not
  // leave — so they bulge aside and slide straight back.
  for (const sc of schools) {
    scatterAt.copy(sc.home);
    away.copy(scatterAt).sub(p);
    const near = away.length();
    if (near < sc.shy) {
      away.normalize().multiplyScalar((sc.shy - near) * sc.give);
      scatterAt.add(away);
    }
    sc.flock.setCenter(scatterAt.x, scatterAt.y, scatterAt.z);
    sc.flock.update(dt);
  }

  // A footfall in water throws a ring; deeper water, bigger splash.
  if (wade > 0.06) {
    splashClock -= dt * (2.2 + velocity.length() * 0.7);
    if (splashClock <= 0) {
      splashClock = 1;
      splash(p.x, ocean.level + ocean.runUp * 0.3, p.z);
    }
  }
  for (const s of splashes) {
    if (s.life <= 0) continue;
    s.life -= dt * 1.4;
    s.ring.scale.setScalar(0.6 + (1 - s.life) * 2.6);
    s.ring.material.opacity = Math.max(0, s.life) * 0.5;
    if (s.life <= 0) s.ring.visible = false;
  }
  // Ashore the gait drives; afloat Swimming has already muted it and the
  // mixer only needs the clock. Feet stop planting the moment they are
  // off the bottom — an IK foot reaching for sand two metres below is
  // the swimmer doing the splits.
  loco.update(dt, swimming ? 0 : velocity.clone().multiplyScalar(wade > 0.15 ? 0.45 : 1));
  feet.weight = swimming || wade > 0.25 ? 0 : 1;
  feet.update();

  const REACH = 4.3;
  camAim.set(p.x, p.y + 1.25 - dive * 0.35, p.z);
  camWant.set(Math.sin(camYaw) * REACH, 2.6 - dive * 2.9, Math.cos(camYaw) * REACH);
  ray.set(camAim, camWant.clone().normalize());
  ray.far = REACH;
  const hit = ray.intersectObjects(blockers, true)[0];
  camWant.setLength(hit ? Math.max(2.6, hit.distance - 0.3) : REACH).add(camAim);
  game.camera.position.lerp(camWant, Math.min(1, dt * 7));
  game.camera.lookAt(camAim);

  // UNDER THE SURFACE the world is a different place: the air's long
  // clear fog gives way to a close blue-green one, and the sky goes with
  // it. Without this the dive is just a camera that moved down.
  const under = game.camera.position.y < ocean.level - 0.05;
  if (under !== wasUnder) {
    wasUnder = under;
    scene.fog = under ? SEA_FOG : AIR_FOG;
    scene.background = new Color(under ? 0x0d5f78 : 0x6fc6e8);
  }
});
game.start();`,
  },

  {
    id: 'cricket',
    title: 'Two-over cricket (playable!)',
    group: 'Games',
    code: `// A PLAYABLE TWO-OVER MATCH — phone and desktop, one code path. You bat.
// The bowler runs in, the ball pitches, and you have about a third of a
// second to pick one of SEVEN strokes:
//
//   D drive · F flick · C cut · P pull · S sweep · B block · L loft
//
// And the stroke has to be the right one, because the bat is a real
// object in the world: sweep at a short ball and it passes over the bat,
// pull at a full one and it goes under. On a phone the buttons appear by
// themselves.
//
// THE WHOLE TRILOGY, EACH DOING ONLY ITS OWN JOB. SCENA owns the ground —
// 22 yards, stumps 28 inches, the rope 62 metres out, and the bails that
// fly. ANIMA owns the bodies — the bowling arm coming over vertically,
// the seven swing planes with both hands solved onto the handle, the
// keeper's crouch that breathes. GAMA owns the game — the ball's flight
// through its one bounce, the timing window, and the laws' own scoring.
// Nothing imports anything else: they meet at a position, a callback, a
// breakWicket() and one function that answers "where is the bat?".
import { createCricketGround, createCricketBall, createBat, createTree,
         createSky, createLightingRig, applyFog, PALETTES } from 'scena3d';
import { createHumanoid, Locomotion, Cricketer } from 'anima3d';
import { Game, TouchControls } from 'gama3d';
import { CricketMatch } from 'gama3d/templates';
import { Vector3 } from 'three';

const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette: PALETTES.meadow }).mesh,
          createLightingRig('day').group);
applyFog(scene, 'clear', PALETTES.meadow);

// ── THE GROUND ──────────────────────────────────────────────────────────
const ground = createCricketGround({ seed: 3, boundary: 62 });
scene.add(ground.object);
for (let i = 0; i < 24; i++) {
  const a = (i / 24) * Math.PI * 2;
  const tree = createTree({ seed: 40 + i, species: i % 3 === 0 ? 'pine' : 'oak',
    palette: PALETTES.meadow });
  tree.object.position.set(Math.cos(a) * 74, 0, Math.sin(a) * 74);
  scene.add(tree.object);
}
const ball = createCricketBall({ seed: 2 });
scene.add(ball.object);

// ── THE PLAYERS ─────────────────────────────────────────────────────────
// One helper, because a cricketer is a rig, a gait and a Cricketer, and
// there are nine of them.
const cast = [];
const player = (seed, x, z, facing) => {
  const rig = createHumanoid({ seed, height: 1.78 });
  rig.object.position.set(x, 0, z);
  rig.object.rotation.y = facing;
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  const who = { rig, loco, cricketer: new Cricketer(rig, loco) };
  cast.push(who);
  return who;
};

// You: on the popping crease, facing up the pitch. The bat is parented to
// the hand, so every swing plane carries it — nothing animates the bat.
const striker = ground.strikerEnd;
const batter = player(21, striker.x, striker.z, 0);
// THE BAT IS HELD WITH BOTH HANDS. holdBat drives it from the grip the
// swing path defines, and the arms are SOLVED onto that path every frame
// — so the two hands are always on the same 11 cm of handle, and the bat
// can never drift out of them.
const bat = createBat({ seed: 4 });
batter.cricketer.holdBat(bat.object, { grip: 0.7 });
// And he TAKES GUARD: a held, breathing stance whose hands are already
// where a stroke starts, so no shot has to snatch the bat into place.
batter.cricketer.stance();
batter.cricketer.onDone(() => batter.cricketer.stance());

// The bowler starts back at his mark and runs in; the keeper crouches up
// to the stumps; the ring stands where a ring stands.
const bowlerEnd = ground.bowlerEnd;
const MARK = bowlerEnd.z + 9;
const bowler = player(34, 0.4, MARK, Math.PI);
const keeper = player(52, 0, striker.z - 3.2, 0);
keeper.cricketer.keep();
const RING = [[13, 6], [-13, 6], [19, -14], [-19, -14], [0, 26],
              [28, 12], [-28, 12], [7, -21]];
const fielders = RING.map((p, i) =>
  player(60 + i, p[0], striker.z + p[1], Math.atan2(-p[0], -p[1])));

// ── THE MATCH ───────────────────────────────────────────────────────────
// swingLead is the beat between committing a stroke and the bat arriving,
// and it is ANIMA's CONTACT_PHASE on a shot clip. Set it to anything else
// and the bat swings through a ball that is somewhere else.
const match = new CricketMatch({
  overs: 2, wickets: 2, boundary: 62, seed: 9, swingLead: 0.42,
  // Where this rig's bat actually is, in front of its own stumps.
  contact: 1.5,
  // AND THE COLLISION. The match asks ANIMA where the middle of the bat
  // is at the instant the bat lands, and the stroke only connects if the
  // ball is there — which is what makes choosing between seven strokes a
  // decision rather than a flavour.
  bat: () => batter.cricketer.batPoint(),
  reach: 0.45,
});

const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;top:10px;left:12px;z-index:10;color:#fff;' +
  'font:600 15px/1.5 system-ui,sans-serif;text-shadow:0 1px 4px #0009;' +
  'pointer-events:none';
document.body.appendChild(hud);
const call = document.createElement('div');
call.style.cssText = 'position:fixed;top:32%;left:0;right:0;z-index:10;' +
  'text-align:center;color:#fff;font:800 40px/1.2 system-ui,sans-serif;' +
  'text-shadow:0 2px 10px #000b;pointer-events:none';
document.body.appendChild(call);

const board = () => {
  const inn = match.innings === 1 ? '1st innings' :
    'CHASING ' + match.target + ' · need ' + match.needed;
  hud.textContent = match.runs + '/' + match.wickets + '  (' +
    match.oversBowled + ' of 2)   ' + inn;
};
board();

// ── THE BALL IS THE ONLY THING THE THREE LIBRARIES SHARE ────────────────
// The bowler's hand says WHERE the ball starts; the match says where it
// goes from there; the ground says what a wicket looks like.
bowler.cricketer.onRelease(() => {
  match.bowl(bowler.cricketer.releasePoint());
});

let restart = 0;
match.onBall((o) => {
  if (o.wicket === 'bowled') ground.breakWicket(-1);
  call.textContent = o.wicket === 'bowled' ? 'BOWLED HIM'
    : o.wicket === 'caught' ? 'CAUGHT'
    : o.runs === 6 ? 'SIX'
    : o.runs === 4 ? 'FOUR'
    : o.runs > 0 ? o.runs + (o.runs === 1 ? ' run' : ' runs')
    : o.timing === 'missed'
      ? (o.miss > 0.45 ? 'WRONG SHOT' : 'beaten')
    : 'no run';
  board();
  restart = o.innings ? 3.4 : 2.2;
});
match.onEnd((result) => {
  call.textContent = result;
  hud.textContent = 'Innings 1: ' + match.firstInnings + '   ·   Innings 2: ' +
    match.runs + '/' + match.wickets;
});

// ── THE CONTROLS ────────────────────────────────────────────────────────
// GAMA's touch layer writes the same key codes the keyboard writes, so
// nothing below branches on input type.
new TouchControls(game.input, {
  joystick: false,
  buttons: [
    { label: 'DRIVE', code: 'KeyD', css: 'right:24px;bottom:132px' },
    { label: 'FLICK', code: 'KeyF', css: 'right:110px;bottom:132px' },
    { label: 'CUT', code: 'KeyC', css: 'right:196px;bottom:132px' },
    { label: 'LOFT', code: 'KeyL', css: 'right:282px;bottom:132px' },
    { label: 'PULL', code: 'KeyP', css: 'right:24px;bottom:44px' },
    { label: 'SWEEP', code: 'KeyS', css: 'right:110px;bottom:44px' },
    { label: 'BLOCK', code: 'KeyB', css: 'right:196px;bottom:44px' },
  ],
});
const KEYS = [
  ['drive', ['KeyD', 'ArrowUp']],
  ['flick', ['KeyF']],
  ['cut', ['KeyC']],
  ['pull', ['KeyP', 'ArrowLeft']],
  ['sweep', ['KeyS', 'ArrowDown']],
  ['defend', ['KeyB']],
  ['loft', ['KeyL', 'ArrowRight']],
];
let held = false;

// ── THE LOOP ────────────────────────────────────────────────────────────
const camAim = new Vector3(0, 1.1, striker.z + 5);
const look = new Vector3();
let runIn = -1;

game.onUpdate((t) => {
  const dt = t.delta;
  ground.update(dt);
  for (const who of cast) {
    who.cricketer.update(dt);
    who.loco.update(dt, 0);
    // AFTER the gait, like FootIK: the clip has to be sampled before the
    // arms can be solved on top of it.
    who.cricketer.lateUpdate();
  }

  // THE RUN-UP. The clip does not translate the root — a bowling action is
  // a body, not a journey — so the body is carried in from the mark and
  // through the crease against the same phase the arm is swinging on.
  if (runIn >= 0) {
    const p = bowler.cricketer.progress;
    bowler.rig.object.position.z = p < 0.62
      ? MARK - (MARK - bowlerEnd.z) * (p / 0.62)
      : bowlerEnd.z - (p - 0.62) * 5;
  }

  // A delivery every few seconds, until somebody has won.
  if (restart > 0) {
    restart -= dt;
    if (restart <= 0 && !match.over) {
      ground.resetWicket();
      match.next();
      call.textContent = '';
      bowler.rig.object.position.z = MARK;
      bowler.cricketer.bowl();
      runIn = 1;
      held = false;
      board();
    }
  } else if (match.phase === 'ready' && runIn < 0) {
    bowler.cricketer.bowl();
    runIn = 1;
  }

  // ONE STROKE PER BALL. swing() commits; the bat lands 0.42 s later and
  // only then does the game find out where the ball was.
  //
  // wasPressed, not isDown: a stroke is an EDGE. A held-key poll drops any
  // tap shorter than a frame, and on a phone mid-frame taps are most of
  // them — the stroke you played simply never happened.
  if (!held) {
    for (const k of KEYS) {
      if (k[1].some((code) => game.input.wasPressed(code))) {
        if (match.swing(k[0])) {
          batter.cricketer.play(k[0]);
          held = true;
        }
        break;
      }
    }
  }

  match.update(dt);
  ball.object.position.copy(match.ball);
  ball.object.rotation.x -= dt * 14;

  // Behind the batter down the pitch, and the moment the ball is struck
  // the camera lets it go and follows it — which is what a broadcast does,
  // and the only way you see where your shot went.
  const struck = match.phase === 'struck';
  look.set(0, 1.1, striker.z + 5);
  if (struck) look.copy(match.ball);
  camAim.lerp(look, Math.min(1, dt * 2.4));
  game.camera.position.set(0, 4.0, striker.z - 8.4);
  game.camera.lookAt(camAim);
});
game.start();`,
  },
  {
    id: 'club',
    title: 'The club (web radio · DJ tiles · dance styles)',
    group: 'Games',
    code: `// THE THREE-WAY COMPOSITION: SCENA owns the woofer and the DJ tiles,
// ANIMA owns the dancers, and the only thing passing between them is the
// pulse — { bass, mid, treble, beat, bpm } — one direction, no backchannel.
//
// CLICK to operate the woofer: it plays REAL web radio (SomaFM); further
// clicks and the arrow keys toggle channels (LEDs on the cabinet = the
// dial). Until then — and whenever the stream drops — the rig's seeded BED
// drives everything, so the floor never freezes on a network hiccup and
// the dancers keep dancing exactly the way a real floor does when the DJ
// is fixing a skip.
import { createWoofer, createDanceTiles } from 'scena3d';
import { createHumanoid, Dance, Couple, Cypher, DANCE_STYLES } from 'anima3d';
import { Game } from 'gama3d';
import { Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial,
  AmbientLight, DirectionalLight, PointLight, Color } from 'three';

const game = new Game();
const scene = game.world.scene;
scene.background = new Color(0x07080c);
scene.add(new AmbientLight(0x9aa4c0, 0.55));
const key = new DirectionalLight(0xb8c4ff, 0.65);
key.position.set(6, 12, 8);
scene.add(key);
const glow = new PointLight(0xff66aa, 30, 30);
glow.position.set(0, 5, -4);
scene.add(glow);
const ground = new Mesh(new PlaneGeometry(60, 60),
  new MeshStandardMaterial({ color: 0x111318, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const rig = createWoofer({ seed: 11 });
rig.object.scale.setScalar(1.8);
rig.object.position.set(0, 0, -7);
scene.add(rig.object);
const tiles = createDanceTiles({ cols: 11, rows: 9, size: 1.0, seed: 11 });
tiles.object.position.set(0, 0, 0.8);
scene.add(tiles.object);

// THE DANCERS — and now the STYLES. One pulse feeds them all; each dancer
// has a seeded flair (their own lag and amplitude) so nobody is in
// lockstep, and each has an IDIOM: the salsa pair count to eight and hold
// the 4 and the 8, the waltzers keep three beats to the bar with the
// rise-and-fall, the bhangra dancer spends half of every cycle with both
// arms in the air, and the club dancers work the freestyle repertoire.
const dancers = [];
[ [-3.8, 1.5, 'salsa'], [-2.6, 2.8, 'salsa'],
  [0.2, 1.9, 'bhangra'],
  [-1.2, 4.1, 'popping'], [1.8, 4.3, 'tutting'],
  [-3.4, 4.6, 'waving'], [3.4, 4.6, 'toprock'],
  [0.3, 5.6, 'locking'], [-0.9, 3.0, 'club'],
  [-4.6, 3.2, 'ballet'], [4.6, 3.4, 'bharatanatyam'],
  [-2.2, 6.0, 'moonwalk'], [2.4, 6.2, 'runningMan'],
  [-4.2, 5.8, 'glide'], [4.2, 5.9, 'house'],
  [-5.2, 4.6, 'vogue'], [5.2, 4.7, 'krump'],
].forEach(([x, z, style], i) => {
  const h = createHumanoid({ seed: 640 + i });
  h.object.position.set(x, 0, z);
  h.object.rotation.y = Math.PI + (x < 0 ? -0.15 : 0.15);
  scene.add(h.object);
  const d = new Dance(h, { seed: 40 + i * 13 });
  d.setStyle(style);
  d.start();
  dancers.push(d);
});
// THE COUPLE — one dance, two bodies, the first skeleton-to-skeleton
// constraint in the trilogy. The follower keeps the LEADER'S clock (half a
// cycle out — the natural opposite — and a connection-lag late), and after
// both have danced, the couple re-holds the joined hands at a point both
// arms can reach. Watch the hands: they stay met through every figure.
const lead = createHumanoid({ seed: 700 });
const follow = createHumanoid({ seed: 701 });
scene.add(lead.object, follow.object);
const couple = new Couple(lead, follow, { style: 'waltz', seed: 12 });
couple.place(3.7, 1.9, 0.9);
couple.start();

// THE CYPHER — the floor becomes a social structure. Six dancers form a
// circle off the main floor; one takes the centre and SHOWS OUT in a
// seeded showcase style while the ring grooves small and holds the space;
// after two bars the centre is handed on, eased, round-robin — the
// turn-taking IS the dance. One pulse, dealt unevenly: boosted to the
// centre, damped to the ring.
const ringRigs = [];
for (let i = 0; i < 6; i++) {
  const h = createHumanoid({ seed: 760 + i });
  scene.add(h.object);
  ringRigs.push(h);
}
const cypher = new Cypher(ringRigs, { seed: 21, radius: 2.1, barsPerTurn: 2 });
cypher.place(9.6, 3.4);
cypher.start();

// THE REVERSE COUPLING. Until now the pulse has only ever flowed one way:
// woofer -> tiles, woofer -> dancers. The Bharatanatyam dancer's stamps
// flow BACK — every strike of her feet fires a ring through the tiles,
// which is what it feels like to stand near that dance in real life.
const bharata = dancers[dancers.length - 1];
bharata.onStamp(() =>
  tiles.feed({ bass: 0.9, mid: 0.2, treble: 0.7, beat: true, bpm: 0 }));

// THE CHORUS LINE: three dancers at the back share one STRICT routine —
// choreography as data, flair zeroed — and dance it identically to the
// quaternion, which is what makes them read as staged where everyone
// else reads as a crowd.
const SET = [
  { move: 'bounce', counts: 8 }, { move: 'raiseTheRoof', counts: 8 },
  { move: 'clap', counts: 8 }, { move: 'robot', counts: 8 },
];
[[-1.5, 7.4], [0.1, 7.5], [1.7, 7.4]].forEach(([x, z], i) => {
  const h = createHumanoid({ seed: 720 + i });
  h.object.position.set(x, 0, z);
  h.object.rotation.y = Math.PI;
  scene.add(h.object);
  const d = new Dance(h, { seed: 300 + i * 7 });
  d.start();
  d.routine(SET, { loop: true, strict: true });
  dancers.push(d);
});

// Press S to send EVERYBODY round the styles together — seventeen idioms,
// (the couple keeps its waltz: a couple is not a solo act times two),
// ballroom, street, classical, illusion, vogue and krump, on one clock.
// (The chorus line keeps its set: routines outrank the style cycle.)
let styleIdx = 0;
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 's') return;
  styleIdx = (styleIdx + 1) % DANCE_STYLES.length;
  for (const d of dancers) d.setStyle(DANCE_STYLES[styleIdx]);
});

rig.play();   // the deck idles on the bed until somebody clicks
window.addEventListener('pointerdown', () => rig.operate());
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') rig.next();
  else if (e.key === 'ArrowLeft') rig.prev();
  else if (/^[1-9]$/.test(e.key)) rig.play(Number(e.key) - 1);
});
rig.onStation((s) => console.log('tuned:', s.name, '—', s.genre));

game.onUpdate((t) => {
  rig.update(t.delta);
  const pulse = rig.pulse();            // the whole coupling, all three ways
  tiles.feed(pulse);
  tiles.update(t.delta);
  for (const d of dancers) d.update(t.delta, pulse);
  couple.update(t.delta, pulse);
  cypher.update(t.delta, pulse);
  glow.intensity = 12 + pulse.bass * 40;
  game.camera.position.set(5.4, 3.6, 9.8);
  game.camera.lookAt(-0.4, 1.1, -2);
});
game.start();`,
  },

  {
    id: 'yoga',
    title: 'Yoga (asanas · breath · the held frame)',
    group: 'Animation',
    code: `// YOGA is the anti-dance: the clock is BREATH (a sine, not a tick), and
// the content is the HOLD. A held pose with zero motion reads as a
// mannequin glitch, so every Asana holds ALIVE: an exponential settle
// (most of the way fast, the last five percent at its own pace), a breath
// that visibly lifts the chest, and a seeded balance sway — small on two
// feet, three times larger on one, absent entirely lying down.
import { createHumanoid, Asana, YogaClass, strikePose, ASANAS,
  ASANA_NAMES } from 'anima3d';
import { Game } from 'gama3d';
import { Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial,
  AmbientLight, DirectionalLight, Color, Fog } from 'three';

const game = new Game();
const scene = game.world.scene;
scene.background = new Color(0xf2e4cf);            // dawn
scene.fog = new Fog(0xf2e4cf, 26, 60);
scene.add(new AmbientLight(0xfff0dc, 0.75));
const sun = new DirectionalLight(0xffd9a0, 1.1);   // surya, low in the east
sun.position.set(-14, 6, 18);
scene.add(sun);
const ground = new Mesh(new PlaneGeometry(80, 80),
  new MeshStandardMaterial({ color: 0xcdb98f, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const deck = new Mesh(new BoxGeometry(16, 0.14, 10),
  new MeshStandardMaterial({ color: 0x9a7b52, roughness: 0.85 }));
deck.position.y = 0.07;
scene.add(deck);
const matMat = new MeshStandardMaterial({ color: 0x7a4f9e, roughness: 0.95 });
const mat = (x, z) => {
  const m = new Mesh(new BoxGeometry(0.8, 0.02, 2.0), matMat);
  m.position.set(x, 0.15, z);
  scene.add(m);
};

// THE CLASS — one practice, many bodies, none of them clones. The
// instructor (front mat, facing the room) is the only body running the
// sequence: SURYA NAMASKAR on the Sivananda breath map — rise on the
// inhale, fold on the exhale, cobra IS an inhale, and plank is 'retain':
// kumbhaka, struck MID-breath on air inhaled into the lunge and not yet
// let go. The students keep THE INSTRUCTOR'S clock a watching-lag late
// (you see the teacher move, then you move), and each draws a seeded
// DEPTH — a stiff student's fold simply does not go as deep, in the
// spine and arms only, so nobody's shallow practice ever breaks the
// floor. Watch one salutation: the wave of each pose rolls back through
// the room, and no two folds match.
const classRigs = [];
for (let i = 0; i < 7; i++) {
  const h = createHumanoid({ seed: 880 + i });
  scene.add(h.object);
  classRigs.push(h);
}
const cls = new YogaClass(classRigs, { seed: 6, breathsPerMinute: 10 });
cls.place(0, 1.2);                            // instructor front, class behind
for (const r of classRigs) {
  mat(r.object.position.x, r.object.position.z);
  r.object.position.y = 0.16;                 // up onto the mats
}
cls.start();                                  // the salutation, looped
cls.instructor.onPose((pose) => console.log('surya:', pose));

// THE HOLDERS: the poses the salutation never visits, held alive on
// their own seeded clocks — balancing, lateral, seated, supine. Watch
// tree pose WORK for its balance while savasana lies perfectly still.
const HOLDS = ['tree', 'warrior2', 'triangle', 'lotus', 'corpse'];
const holders = [];
HOLDS.forEach((pose, i) => {
  const x = -6.4 + i * 3.2;
  mat(x, 4.2);
  const h = createHumanoid({ seed: 900 + i });
  h.object.position.set(x, 0.16, 4.2);
  h.object.rotation.y = Math.PI;
  scene.add(h.object);
  const a = new Asana(h, { seed: 30 + i * 11, breathsPerMinute: 5 + (i % 3) });
  a.strike(pose);
  holders.push(a);
});

// strikePose — the SINGLE-FRAME API. No clock, no class: the rig simply
// IS the pose when the call returns. Pose a body, paint it stone, park it
// on a pedestal: a statue, and SCENA never imported ANIMA to get one.
const plinth = new Mesh(new BoxGeometry(1.3, 0.5, 1.3),
  new MeshStandardMaterial({ color: 0x8d8578, roughness: 0.9 }));
plinth.position.set(7.2, 0.25, -2.4);
scene.add(plinth);
const statue = createHumanoid({ seed: 41, colors: { skin: 0x9b9489,
  hair: 0x8d8578, top: 0x9b9489, bottom: 0x8d8578, boots: 0x847c6f } });
statue.object.position.set(7.2, 0.5, -2.4);
statue.object.rotation.y = Math.PI + 0.4;
scene.add(statue.object);
strikePose(statue, 'tree');                  // one call; done — never updated

// Press S and the holders flow to the next asana in the repertoire
// (the class keeps its salutation: a sequence outranks a whim).
let round = 0;
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 's') return;
  round++;
  holders.forEach((a, i) =>
    a.strike(ASANA_NAMES[(i + round) % ASANA_NAMES.length]));
});
console.log('poses:', ASANA_NAMES.length, '— e.g. tree =', ASANAS.tree.sanskrit);

game.onUpdate((t) => {
  cls.update(t.delta);
  for (const a of holders) a.update(t.delta);
  game.camera.position.set(6.5, 4.6, 9.6);
  game.camera.lookAt(-0.6, 0.8, 0.4);
});
game.start();`,
  },

  {
    id: 'gathering',
    title: 'Gatherings (choosing a seat · sitting down · talking)',
    group: 'Games',
    code: `// Several people to one prop — and the behaviour that makes them read as
// people rather than mannequins. They arrive on their own clocks, CHOOSE a
// seat (spreading along the bench before filling the gaps), walk to the spot
// beside it, turn, and lower into it. Seated, they never quite hold still,
// and the table's gaze passes round with whoever is talking.
import { createSky, createLightingRig, applyFog, createSurface, createTree,
         createDiningTable, createGameTable, createLongBench, PALETTES } from 'scena3d';
import { Conversation, createHumanoid, FootIK, Interaction, Locomotion, LookAt,
         Mannerisms, OUTFITS } from 'anima3d';
import { Game, MotionAgent, FollowPath, Path, Occupancy, stagger } from 'gama3d';
import { Mesh, PlaneGeometry, Vector3 } from 'three';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(140, 140), createSurface('dirt', { seed: 3 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
[[-9, -7, 31], [9, -6, 32], [-10, 6, 33]].forEach(([x, z, seed]) => {
  const t = createTree({ species: 'oak', seed, height: 5.5, palette });
  t.object.position.set(x, 0, z); scene.add(t.object);
});

const place = (g, x, z, rotY = 0) => {
  g.object.position.set(x, 0, z); g.object.rotation.y = rotY;
  scene.add(g.object); g.object.updateWorldMatrix(true, true); return g;
};
const table = place(createDiningTable({ seed: 5, seats: 4, style: 'round', palette }), -3.2, -0.4);
const board = place(createGameTable({ seed: 9, game: 'chess', palette }), 3.8, -2.4, 0.5);
const bench = place(createLongBench({ seed: 7, seats: 4, palette }), 2.2, 3.4);

// personalSpace is what makes strangers spread along the bench instead of
// all piling onto the nearest end.
const seating = new Map([
  [table, new Occupancy(table.seats, { seed: 2, personalSpace: 0.6, spacing: 1.1 })],
  [board, new Occupancy(board.seats, { seed: 3, personalSpace: 0 })],
  [bench, new Occupancy(bench.seats, { seed: 4, personalSpace: 1.6, spacing: 2.4, whim: 0 })],
]);

const world = (o) => { o.updateWorldMatrix(true, false); return o.getWorldPosition(new Vector3()); };
const villagers = [];
function makeVillager(name, seed, home, from, delay) {
  const rig = createHumanoid({ seed, palette: OUTFITS.villager });
  const loco = new Locomotion(rig);
  const body = game.world.spawn(name);
  body.add(rig.object); body.position.copy(from);
  const agent = body.addComponent(new MotionAgent({ maxSpeed: 1.6, maxForce: 14, planar: true }));
  const v = { name, rig, loco, ik: new FootIK(rig, { ground: () => 0 }), gaze: new LookAt(rig),
    // Same seed for body and habits: each villager looks AND behaves like themselves.
    habits: new Mannerisms(rig, loco, { seed }), interaction: new Interaction(rig, loco),
    agent, body, home, seat: null, state: 'waiting', wait: delay };
  villagers.push(v); return v;
}

const PARTIES = [
  { role: 'diner', home: table, from: new Vector3(-6.5, 0, 5.5), delays: stagger(4, { spread: 1.0, lead: 0.2, seed: 6 }) },
  { role: 'player', home: board, from: new Vector3(7.5, 0, 2.5), delays: stagger(2, { spread: 0.9, lead: 0.6, seed: 8 }) },
  // Slow-drip, so you can watch each newcomer pick a seat away from the rest.
  { role: 'sitter', home: bench, from: new Vector3(-5.5, 0, 8.5), delays: stagger(4, { spread: 2.8, lead: 1.6, seed: 9 }) },
];
let index = 0;
for (const party of PARTIES) {
  party.delays.forEach((delay, i) => {
    const from = party.from.clone().add(new Vector3((i % 2 ? 1 : -1) * (0.6 + i * 0.5), 0, i * 0.7));
    makeVillager(party.role + i, 20 + index * 7, party.home, from, delay);
    index++;
  });
}

const talkers = (g) => villagers.filter((v) => v.home === g)
  .map((v) => ({ gaze: v.gaze, head: v.rig.bones.Head }));
const chats = new Map([
  [table, new Conversation(talkers(table), { seed: 12, focus: table.focus, turn: 4.5, wander: 0.3 })],
  [board, new Conversation(talkers(board), { seed: 13, focus: board.focus, turn: 6, wander: 0.45 })],
  [bench, new Conversation(talkers(bench), { seed: 14, focus: bench.focus, turn: 7, wander: 0.6 })],
]);
for (const chat of chats.values()) chat.enabled = false;

const walkTo = (v, target) => {
  v.agent.clearBehaviors(); v.agent.maxSpeed = 1.6;
  v.agent.addBehavior(new FollowPath(new Path([v.body.position.clone(), target], false), 0.35));
};
function goSit(v) {
  const seat = seating.get(v.home).claim(v, { from: v.body.position });
  if (!seat) return;
  v.seat = seat; v.state = 'walking';
  walkTo(v, world(seat.approach ?? seat.anchor));   // to the spot BESIDE it
}

game.onUpdate((t) => {
  const dt = t.delta;
  for (const v of villagers) {
    if (v.state === 'waiting') {
      v.wait -= dt; if (v.wait <= 0) goSit(v);
    } else if (v.state === 'walking') {
      if (v.body.position.distanceTo(world(v.seat.approach ?? v.seat.anchor)) < 0.45) {
        v.state = 'sitting';
        v.agent.clearBehaviors(); v.agent.maxSpeed = 0; v.agent.velocity.set(0, 0, 0);
        // The slot carries its approach anchor, so use() STAGES the sit:
        // stand beside it -> turn -> lower, pose fading in on the way down.
        v.interaction.use(v.seat, { fade: 0.4, settle: 0.75 });
        v.habits.context = 'seated';
      }
    } else if (v.state === 'sitting' && v.interaction.phase === 'held') {
      v.state = 'seated';
      const company = villagers.filter((o) => o.home === v.home && o.state === 'seated').length;
      const chat = chats.get(v.home);
      if (chat && company >= 2) { chat.enabled = true; chat.retarget(); }
    }
    v.loco.update(dt, v.state === 'walking' ? v.agent.velocity : 0);
    v.interaction.update(dt);
    v.ik.update();
    v.habits.update(dt);
  }
  // Conversations write gaze targets; LookAt does the turning, and runs last.
  for (const chat of chats.values()) chat.update(dt);
  for (const v of villagers) v.gaze.update(dt);

  const a = t.elapsed * 0.06;
  game.camera.position.set(Math.sin(a) * 11.5, 5.4, Math.cos(a) * 11.5 + 2);
  game.camera.lookAt(0, 1.0, 0.6);
});
game.camera.position.set(0, 5.4, 13);
game.start();`
  },
  {
    id: 'rowing',
    title: 'A crew, and one number',
    group: 'Animation',
    code: `// SCENA's oar bank works out the stroke and publishes phaseAt(seat).
// ANIMA's Rowing takes that same scalar and writes a body with it. Nothing
// else passes between them — no clip, no event, no shared object. A shared
// CLOCK is the third kind of handshake in the trilogy, after fields and
// frames, and the only one that can say "together".
import { createDeckedShip, createOarBank, createOcean, createSky,
         createLightingRig, PALETTES } from 'scena3d';
import { createHumanoid, OUTFITS, Rowing } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);

const sea = createOcean({ amplitude: 0.2, wavelength: 26, size: 500, segments: 140 });
scene.add(sea.mesh);

const ship = createDeckedShip({ era: 'galley', seed: 6, palette });
ship.float((x, z) => sea.heightAt(x, z));
scene.add(ship.object);

const SEAT = 0.45;
const bank = createOarBank({
  kind: 'longship', seats: 7, beam: ship.beam * 1.05,
  gunwale: 1.3, together: 1, seed: 3, palette,
});
bank.setRate(22);
ship.object.add(bank.object);

const crew = bank.oars.map((oar, i) => {
  const rig = createHumanoid({ seed: 20 + i * 7, height: 1.72, palette: OUTFITS.villager });
  // A ROWER FACES AFT. Seat him facing the bow and the whole crew rows the
  // wrong way while every number still agrees.
  rig.object.rotation.y = Math.PI;
  // The seat slot is the THWART; a rig is built from the soles of its feet.
  const t = oar.seatSlot.anchor;
  rig.object.position.set(t.position.x, t.position.y - SEAT, t.position.z);
  ship.object.add(rig.object);
  return { rig, oar, row: new Rowing(rig, { side: oar.side, style: 'fixed', seatHeight: SEAT, seed: i + 1 }) };
});

game.onUpdate((t) => {
  sea.update(t.delta);
  bank.update(t.delta);
  ship.update(t.delta, { speed: bank.way, turn: bank.yaw * 0.25 });
  for (const m of crew) m.row.update(t.delta, bank.phaseAt(m.oar.seat), m.oar.crabbing);
  if (Math.floor(t.elapsed) % 19 === 0 && bank.crabbing === 0 && t.elapsed > 12) bank.crab(3);
  const at = ship.object.position;
  game.camera.position.set(at.x - 6.5, 3.9, at.z + 9.5);
  game.camera.lookAt(at.x, 1.25, at.z - 0.5);
});
game.start();`,
  },

  {
    id: 'riding',
    title: 'Riding a horse (mount \u00b7 gaits \u00b7 ladder)',
    group: 'Games',
    code: `// A horse, built as a real quadruped: the skeleton is laid out to horse
// proportions and the four gaits use the actual footfall orders — walk is
// 4-beat LATERAL (LH-LF-RH-RF), trot is 2-beat DIAGONAL pairs, canter is
// 3-beat with a lead leg, gallop splits the diagonal into four. Mounting
// is the real sequence too, and the rider changes SEAT to match the gait.
// W/S urge on and steady, A/D rein, Space halt, E mount, C climb.
import { createSky, createLightingRig, applyFog, createSurface, createTree,
         createFence, createLadder, createSaddle, createBridle, PALETTES } from 'scena3d';
import { createHumanoid, createQuadruped, QuadrupedLocomotion, Locomotion,
         FootIK, Mount, Climb, OUTFITS } from 'anima3d';
import { Game, RideController, TouchControls } from 'gama3d';
import { Mesh, PlaneGeometry, Vector2, Vector3 } from 'three';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(400, 400), createSurface('dirt', { seed: 4 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
[[-14,-10,41],[16,-14,42],[-18,12,43],[20,10,44]].forEach(([x, z, seed]) => {
  const t = createTree({ species: 'oak', seed, height: 6, palette });
  t.object.position.set(x, 0, z); scene.add(t.object);
});
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  const f = createFence({ seed: 50 + i, palette });
  f.object.position.set(Math.sin(a) * 26, 0, Math.cos(a) * 26);
  f.object.rotation.y = a + Math.PI / 2; scene.add(f.object);
}

const horse = createQuadruped({ seed: 11, coat: 'bay', marking: 'blaze' });
horse.object.position.set(2.4, 0, 0);
scene.add(horse.object);
const gaits = new QuadrupedLocomotion(horse);
// Tack is built to the rig's own fixtures, so it lands where the seat is.
horse.saddle.add(createSaddle({ horseHeight: horse.height }).object);
horse.bones.Head.add(createBridle({ horseHeight: horse.height }).object);

const rig = createHumanoid({ seed: 21, palette: OUTFITS.villager });
scene.add(rig.object);
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const mount = new Mount(rig, loco);
const climb = new Climb(rig, loco);

const ladder = createLadder({ seed: 7, height: 4.2, palette });
ladder.object.position.set(-6, 0, -5);
ladder.object.rotation.y = Math.PI;
scene.add(ladder.object);
const deck = new Mesh(new PlaneGeometry(2.6, 2.6), createSurface('plank', { color: palette.wood, seed: 8 }));
deck.rotation.x = -Math.PI / 2;
deck.position.set(-6, ladder.rungs * ladder.rungSpacing, -5.9);
scene.add(deck);

const ride = new RideController({ topSpeed: 11.5 });
new TouchControls(game.input, { buttons: [
  { label: 'Mount', code: 'KeyE', css: 'right:26px;bottom:118px' },
  { label: 'Halt', code: 'Space', css: 'right:26px;bottom:40px' },
  { label: 'Climb', code: 'KeyC', css: 'right:132px;bottom:40px' },
]});

const axis = new Vector2();
const onFoot = new Vector3();
game.onUpdate((t) => {
  const dt = t.delta;
  game.input.moveAxis(axis);
  if (game.input.wasPressed('KeyE')) {
    if (mount.phase === 'off' && !climb.climbing) {
      const gap = rig.object.getWorldPosition(new Vector3())
        .distanceTo(horse.object.getWorldPosition(new Vector3()));
      if (gap < 3.5) mount.mount(horse);
    } else if (mount.mounted) mount.dismount();
  }
  if (game.input.wasPressed('KeyC') && mount.phase === 'off' && !climb.climbing) {
    climb.start({ bottom: ladder.bottom, top: ladder.top, rungSpacing: ladder.rungSpacing });
  }

  // The horse runs its own physics whether or not anyone is aboard.
  const seated = mount.phase === 'seated';
  ride.update(dt, { urge: seated ? axis.y : 0, rein: seated ? axis.x : 0,
                    halt: seated && game.input.isDown('Space') });
  ride.applyTo(horse.object, dt);
  gaits.update(dt, ride.speed);       // the horse picks its own gait

  if (seated) {
    // Sit the walk, POST the trot, two-point the gallop — in time with
    // the trot's own stride, not some unrelated clock.
    mount.followGait(gaits.gait, gaits.mixer.clipAction(gaits.clips.trot).timeScale || 1);
    loco.update(dt, 0);
  } else if (!climb.climbing && mount.phase === 'off') {
    onFoot.set(axis.x, 0, axis.y).multiplyScalar(2.4);
    if (onFoot.lengthSq() > 0.01) {
      rig.object.position.addScaledVector(onFoot, dt);
      rig.object.rotation.y = Math.atan2(onFoot.x, onFoot.z);
    }
    loco.update(dt, onFoot); ik.update();
  } else loco.update(dt, 0);
  mount.update(dt);
  climb.update(dt);

  const subject = seated ? horse.object : rig.object;
  const at = subject.getWorldPosition(new Vector3());
  const behind = seated ? 7.5 + ride.effort * 4 : 5;
  const heading = seated ? ride.heading : rig.object.rotation.y;
  game.camera.position.lerp(new Vector3(
    at.x - Math.sin(heading) * behind, at.y + 2.6 + ride.effort * 0.8,
    at.z - Math.cos(heading) * behind), Math.min(1, dt * 3));
  game.camera.lookAt(at.x, at.y + 1.2, at.z);
});
game.camera.position.set(0, 3, -8);
game.start();`
  },
{
    id: 'screens',
    title: 'Screens (a room lit by television)',
    group: 'Scale',
    code: `// A flat after dark. Nothing in this room emits light except screens.
// The television's lamp is a wide SPOT aimed out of the glass, not a point
// light: a point radiates in every direction and lights the wall the set
// stands against harder than the person watching it, which is how the
// first version came out — a halo behind the TV, the viewer in shadow.
// The lamp carries the colour and level of the shot being drawn, so the
// room flickers on the picture's own cuts rather than on a timer.
// Space = the remote (watch it boot). 1-5 = change what is playing.
import { AmbientLight, Vector3 } from 'three';
import { createRoom, createSeat, createTable, createTelevision, createMonitor,
         createLaptop, createScreenLight, PALETTES } from 'scena3d';
import { createHumanoid, Interaction, Locomotion, LookAt, Mannerisms,
         OUTFITS, Watching } from 'anima3d';
import { Device, Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;

// '.' is a FLOOR tile; ' ' is nothing at all. A room drawn with spaces has
// walls, a ceiling and no floor — and looks merely very dark.
const room = createRoom([
  '########', '#......#', '#......#', '#......#', '#..S...#', '#......#', '########',
], { palette, unit: 1.2, wallHeight: 2.7, floor: 'plank', ceiling: true, hearthLight: false, seed: 5 });
scene.add(room.group);
const ambient = new AmbientLight(0x2a3550, 0.075);
scene.add(ambient);

const media = createTable({ palette, seed: 12 });
media.object.position.set(0, 0, -2.75);
media.object.scale.set(1.15, 0.62, 0.75);
scene.add(media.object);

const tv = createTelevision({ diagonal: 1.25, mount: 'stand', mode: 'off', seed: 21, palette });
tv.object.position.set(0, 0.47, -2.7);
scene.add(tv.object);
const tvGlow = createScreenLight(tv.screen, { gain: 1.15 });

// GAMA owns whether it is on; SCENA owns what that looks like. The only
// thing crossing between them is setMode(string).
const set = new Device({ boot: 2.4, modes: { booting: 'standby' } });
set.attach(tv.screen);
set.show('video');
set.turnOn();

const desk = createTable({ palette, seed: 3 });
desk.object.position.set(-2.9, 0, -1.0);
desk.object.rotation.y = Math.PI / 2;
scene.add(desk.object);
const monitor = createMonitor({ diagonal: 0.58, mode: 'chart', seed: 31, palette });
monitor.object.position.set(-3.05, 0.74, -1.0);
monitor.object.rotation.y = Math.PI / 2;
scene.add(monitor.object);
const laptop = createLaptop({ diagonal: 0.33, mode: 'feed', scrollRate: 1.4, seed: 41 });
laptop.object.position.set(-2.85, 0.74, -1.6);
laptop.object.rotation.y = Math.PI / 2 + 0.35;
scene.add(laptop.object);
const screens = [tv.screen, monitor.screen, laptop.screen];

const sofa = createSeat({ style: 'bench', palette, seed: 8 });
sofa.object.position.set(0, 0, 1.05);
// A seat slot faces its own +z, so an unrotated bench seats you with your
// back to the only light in the room.
sofa.object.rotation.y = Math.PI;
scene.add(sofa.object);

const rig = createHumanoid({ seed: 17, palette: OUTFITS.villager });
scene.add(rig.object);
const loco = new Locomotion(rig);
const gaze = new LookAt(rig);
const sitting = new Interaction(rig, loco);
const idle = new Mannerisms(rig, loco, { context: 'seated', seed: 23 });
// She does not stare: fixations jump around the picture, and she looks
// away now and then and comes back to about where she left off.
const watch = new Watching(rig, gaze, { engagement: 0.82, seed: 6 });
if (sofa.slots?.[0]) sitting.use(sofa.slots[0], { approach: false });
watch.watch(tv.screen);

const CONTENT = ['video', 'feed', 'map', 'chart', 'call'];
game.onUpdate((t) => {
  const dt = t.delta;
  if (game.input.wasPressed('Space')) set.press();
  for (let i = 0; i < CONTENT.length; i++) {
    if (game.input.wasPressed('Digit' + (i + 1))) set.show(CONTENT[i]);
  }
  set.update(dt);
  for (const s of screens) s.update(dt);
  tvGlow.update();
  // Stand-in for bounce: the cone is right, but with no global illumination
  // the corners get nothing, so tint the ambient with what is on screen.
  ambient.color.set(0x2a3550).lerp(tv.screen.glow.color, 0.55);
  ambient.intensity = 0.055 + Math.min(0.9, tv.screen.glow.intensity) * 0.1;
  loco.update(dt, 0);
  sitting.update(dt);
  idle.update(dt);
  watch.update(dt);
  gaze.update(dt);
  const head = rig.bones.Head.getWorldPosition(new Vector3());
  const a = 2.5 + Math.sin(t.elapsed * 0.12) * 0.5;
  game.camera.position.set(a, 1.5, 1.55);
  game.camera.lookAt(-0.15, 1.0, -1.4);
});
game.camera.position.set(2.5, 1.5, 1.55);
game.start();`
  },
{
    id: 'phone',
    title: 'On the phone (pose, not prop)',
    group: 'Characters',
    code: `// The handset is a few pixels across at this distance, so the POSE does
// all the work — you read "she's on her phone" off the head angle and the
// one raised forearm. Every posture is an upper-body mask over whatever the
// legs are doing, so walking-while-texting is the same code with a slower
// velocity. 1-6 change posture, 0 pockets it, W walks.
import { Mesh, PlaneGeometry, Vector3 } from 'three';
import { applyFog, createLightingRig, createPhone, createSky, createSurface,
         createTree, PALETTES } from 'scena3d';
import { createHumanoid, FootIK, Locomotion, OUTFITS, PhoneUse } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(200, 200), createSurface('concrete', { seed: 3 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
for (const [x, z, s] of [[-5, -6, 1], [6, -9, 2], [-7, 7, 3], [8, 6, 4]]) {
  const tree = createTree({ species: 'oak', seed: 10 + s, height: 5.5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
}

const rig = createHumanoid({ seed: 31, palette: OUTFITS.villager });
scene.add(rig.object);
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const phone = new PhoneUse(rig, loco, { hand: 'Right', seed: 4, glanceEvery: 3.4 });

// A phone is a Carryable with a Screen — the same prop as the television, at
// six inches. Pick-up and hand-off already work on it.
const handset = createPhone({ seed: 7, mode: 'feed', scrollRate: 1.1 });
scene.add(handset.object);
phone.hold(handset);
phone.use('scroll');

const POSES = ['scroll', 'type', 'call', 'photo', 'selfie', 'show'];
let walking = true;
const velocity = new Vector3();

game.onUpdate((t) => {
  const dt = t.delta;
  for (let i = 0; i < POSES.length; i++) {
    if (game.input.wasPressed('Digit' + (i + 1))) phone.use(POSES[i]);
  }
  if (game.input.wasPressed('Digit0')) phone.stow();
  if (game.input.wasPressed('KeyW')) walking = !walking;

  if (walking) {
    const a = t.elapsed * 0.28;
    // walkScale is 0.82 scrolling, less typing, and 0 for a photo — nobody
    // walks and frames a shot.
    velocity.set(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(1.5 * phone.walkScale);
    if (velocity.lengthSq() > 0.0001) {
      rig.object.position.addScaledVector(velocity, dt);
      rig.object.rotation.y = Math.atan2(velocity.x, velocity.z);
    }
  } else {
    velocity.set(0, 0, 0);
  }
  loco.update(dt, velocity);
  phone.update(dt);
  ik.update();

  const at = rig.object.getWorldPosition(new Vector3());
  game.camera.position.lerp(new Vector3(at.x + 2.6, 1.9, at.z + 3.2), Math.min(1, dt * 2.5));
  game.camera.lookAt(at.x, 1.05, at.z);
});
game.camera.position.set(2.6, 1.9, 3.2);
game.start();`
  },
{
    id: 'queue',
    title: 'Queueing at a cash machine',
    group: 'Scale',
    code: `// SCENA says where the line is; GAMA says who is where along it. Waiting
// itself is free — the mannerisms and the phone-checking already existed.
// What makes the line read is that it does NOT advance as one: each person
// notices the gap in their own time, so the shuffle travels backwards like
// a wave. Space = another customer, S = serve the front.
import { Mesh, PlaneGeometry, Vector3 } from 'three';
import { applyFog, createLightingRig, createPhone, createSky, createSurface,
         createTerminal, PALETTES } from 'scena3d';
import { createHumanoid, Locomotion, LookAt, Mannerisms, OUTFITS, PhoneUse } from 'anima3d';
import { Game, Queue } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(120, 120), createSurface('concrete', { seed: 9 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const atm = createTerminal({ style: 'atm', seed: 4, palette });
atm.object.position.set(0, 0, -1.2);
scene.add(atm.object);
const vending = createTerminal({ style: 'vending', seed: 8, palette });
vending.object.position.set(3.4, 0, -1.2);
scene.add(vending.object);

const queue = new Queue({ spacing: atm.spacing, service: 16, patience: 5,
                          giveUpAfter: 34, reaction: 0.55, seed: 5 });
const customers = [];
let made = 0;
const velocity = new Vector3();
const want = new Vector3();

function arrive() {
  const i = made++;
  const rig = createHumanoid({ seed: 120 + i * 13, palette: OUTFITS.villager });
  rig.object.position.set(4.5 + (i % 3) * 0.6, 0, 5.5 + (i % 4) * 0.5);
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  const c = {
    rig, loco, gaze: new LookAt(rig),
    idle: new Mannerisms(rig, loco, { context: 'standing', seed: 200 + i }),
    phone: new PhoneUse(rig, loco, { seed: 300 + i, glanceEvery: 5 }),
    at: rig.object.position, bored: 4 + (i % 5) * 2.5, leaving: null,
  };
  const handset = createPhone({ seed: 400 + i, mode: 'feed', scrollRate: 1.1 });
  scene.add(handset.object);
  c.phone.hold(handset);
  customers.push(c);
  // They may take one look at the line and keep walking.
  if (queue.join(c) === null) c.leaving = new Vector3(-7, 0, 7);
}
queue.onServed = (c) => { c.leaving = new Vector3(-8, 0, 6.5); c.phone.stow(); };
queue.onGiveUp = (c) => { c.leaving = new Vector3(-8, 0, 8); c.phone.stow(); };
queue.onBalk = (c) => { c.leaving = new Vector3(-7, 0, 7); };
for (let i = 0; i < 5; i++) arrive();

game.onUpdate((t) => {
  const dt = t.delta;
  if (game.input.wasPressed('Space')) arrive();
  if (game.input.wasPressed('KeyS')) queue.serve();
  queue.update(dt);
  atm.screen.update(dt);
  vending.screen.update(dt);

  for (const c of customers) {
    const place = queue.placeOf(c);
    if (c.leaving) want.copy(c.leaving);
    // A DISTANCE from the queue becomes a place to stand on the terminal's
    // own line. Neither library knows about the other.
    else want.copy(atm.line.localToWorld(new Vector3(0, 0, -queue.distanceOf(c))));

    velocity.copy(want).sub(c.at).setY(0);
    const gap = velocity.length();
    if (gap > 0.08) {
      velocity.normalize().multiplyScalar(Math.min(1.5, gap * 2.2) * c.phone.walkScale);
      c.at.addScaledVector(velocity, dt);
      c.rig.object.rotation.y = Math.atan2(velocity.x, velocity.z);
    } else {
      velocity.set(0, 0, 0);
      if (!c.leaving) c.rig.object.rotation.y = Math.PI;
    }
    // Waiting is boring — and costs nothing to build, twice over.
    if (!c.leaving && place > 0) {
      c.bored -= dt;
      if (c.bored <= 0 && c.phone.stowed) c.phone.use('scroll');
    } else if (place === 0 && !c.phone.stowed) {
      c.phone.stow();   // you put it away when you get to the front
    }
    c.gaze.target = place === 0 ? atm.screen.surface.getWorldPosition(new Vector3()) : null;
    c.loco.update(dt, velocity);
    c.phone.update(dt);
    c.idle.update(dt);
    c.gaze.update(dt);
  }
  const a = t.elapsed * 0.08;
  game.camera.position.set(Math.sin(a) * 3.2 + 3.4, 3.4, 6.6 + Math.cos(a) * 0.9);
  game.camera.lookAt(0.6, 1.0, 0.6);
});
game.camera.position.set(3.4, 3.4, 6.6);
game.start();`
  },
{
    id: 'office',
    title: 'Smart office (wiring \u00b7 desk work)',
    group: 'Scale',
    code: `// Two things at once. The desk poses are ANIMA's: typing is carried by the
// forearms, not the wrists, and the head stays near LEVEL — a keyboard is
// not a phone, the screen is at eye height. The wiring is GAMA's: the lamp
// is not switched by the code that trips the sensor, it is LINKED to it and
// arrives a beat later, which is the one thing that makes a smart home feel
// like hardware. Space = doorbell, M = trip the sensor.
import { AmbientLight, PointLight, Vector3 } from 'three';
import { createDeskSet, createFixture, createLaptop, createMonitor, createRoom,
         createScreenLight, createSeat, createTable, PALETTES } from 'scena3d';
import { createHumanoid, DeskWork, Interaction, Locomotion, LookAt, OUTFITS } from 'anima3d';
import { Attention, Automation, Device, Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
const room = createRoom(['#######','#.....#','#.....#','#..S..#','#.....#','#######'],
  { palette, unit: 1.2, wallHeight: 2.6, floor: 'plank', ceiling: true, hearthLight: false, seed: 3 });
scene.add(room.group);
const ambient = new AmbientLight(0x2b3550, 0.09);
scene.add(ambient);
const lamp = new PointLight(0xffe0b0, 0, 8, 1.8);
lamp.position.set(0, 2.3, 0.3);
scene.add(lamp);

const desk = createTable({ palette, seed: 7 });
desk.object.position.set(0, 0, -1.9);
desk.object.scale.set(1.25, 1, 0.85);
scene.add(desk.object);
const monitor = createMonitor({ diagonal: 0.6, mode: 'chart', seed: 21, palette });
monitor.object.position.set(0.1, 0.74, -2.15);
scene.add(monitor.object);
const monitorGlow = createScreenLight(monitor.screen, { gain: 0.9 });
const workstation = new Device({ boot: 1.4, idle: 0 });
workstation.attach(monitor.screen);
workstation.turnOn(true);
workstation.show('chart');
const laptop = createLaptop({ diagonal: 0.33, mode: 'feed', scrollRate: 0.8, seed: 31 });
laptop.object.position.set(-0.62, 0.74, -1.95);
laptop.object.rotation.y = 0.5;
scene.add(laptop.object);
const set = createDeskSet({ seed: 5 });
set.object.position.set(0.05, 0.74, -1.62);
scene.add(set.object);

const sensor = createFixture({ style: 'sensor', seed: 2, palette });
sensor.object.position.set(-2.4, 2.3, -3.0);
sensor.object.rotation.y = 0.7;
scene.add(sensor.object);
const bell = createFixture({ style: 'doorbell', seed: 4, palette });
bell.object.position.set(1.9, 1.3, -2.9);
scene.add(bell.object);

const home = new Automation({ seed: 8, delay: 0.45 });
// Holds after the last movement — otherwise it turns the lights off on
// somebody sitting still at a desk, which is the classic real failure.
home.hold('motion', 14);
home.link('motion', 'lamp');
home.on('lamp', (v) => sensor.setIndicator(v > 0.5 ? 0x5cff9a : 0x1e2a24, v > 0.5 ? 2 : 0.4));

const chair = createSeat({ style: 'chair', palette, seed: 9 });
chair.object.position.set(0.05, 0, -1.05);
// A seat slot faces its own +z: unrotated, this sits somebody with their
// back to the monitor, and every hand-position check still passes.
chair.object.rotation.y = Math.PI;
scene.add(chair.object);

const rig = createHumanoid({ seed: 44, palette: OUTFITS.villager });
scene.add(rig.object);
const loco = new Locomotion(rig);
const gaze = new LookAt(rig);
const sitting = new Interaction(rig, loco);
const work = new DeskWork(rig, loco, { seed: 12, rate: 6 });
const attention = new Attention({ seed: 3, sensitivity: 0.85, latency: 0.4 });
const slot = chair.slots && chair.slots[0];
if (slot) {
  chair.object.updateWorldMatrix(true, true);
  const slotAt = slot.anchor.getWorldPosition(new Vector3());
  chair.object.position.add(new Vector3(0.05, 0, -1.05).sub(slotAt).setY(0));
  sitting.use(slot, { approach: false });
}
work.do('type');
gaze.target = monitor.screen.surface.getWorldPosition(new Vector3());
const bellAt = new Vector3(1.9, 1.3, -2.9);
attention.onNotice = (a) => { if (a.at) gaze.glance(a.at, 1.6); };

game.onUpdate((t) => {
  const dt = t.delta;
  if (game.input.wasPressed('Space')) {
    bell.setIndicator(0xffd36b, 2.4);
    attention.notice({ kind: 'ring', urgency: 0.92, at: bellAt, duration: 1.9 });
  }
  if (game.input.wasPressed('KeyM')) home.set('motion', true);
  home.update(dt);
  attention.update(dt);
  workstation.update(dt);
  monitor.screen.update(dt);
  laptop.screen.update(dt);
  monitorGlow.update();
  lamp.intensity += (home.get('lamp') * 5.5 - lamp.intensity) * Math.min(1, dt * 3);
  if (!attention.engaged) bell.setIndicator(0x2a3038, 0.4);
  loco.update(dt, 0);
  sitting.update(dt);
  work.update(dt);   // wanders between type / mouse / read / think on its own
  gaze.update(dt);
  game.camera.position.set(2.0, 1.9, 1.7);
  game.camera.lookAt(-0.1, 1.05, -1.7);
});
game.camera.position.set(2.0, 1.9, 1.7);
game.start();`
  },
  {
    id: 'knockout',
    title: 'Dodgeball: hits, KO & the get-up',
    group: 'Games',
    code: `// PHASE C OF THE GAMING ROADMAP, all three libraries in one loop.
// GAMA's Health decides what a hit costs (i-frames, the death edge);
// GAMA's Projectiles deliver it; ANIMA's Reactions make the body SHOW
// it — the directional flinch, the stagger on the heavy ball, the
// crumple-and-kneel knockout, the get-up. SCENA bursts and rings at
// every impact. The thrower celebrates the KO; the get-up deflates him.
import { Mesh, PlaneGeometry, Vector3 } from 'three';
import { applyFog, createEffects, createLightingRig, createSky,
         createSurface, PALETTES } from 'scena3d';
import { createHumanoid, Locomotion, Reactions, OUTFITS } from 'anima3d';
import { Game, Health, Projectiles, Hud, Soundboard } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'clear', palette);
const ground = new Mesh(new PlaneGeometry(80, 80),
  createSurface('moss', { seed: 5 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const hud = new Hud();
const sounds = new Soundboard({ seed: 4 });
sounds.unlock();
sounds.onCaption((c) => hud.caption('♪ ' + c.text));
hud.objective('Dodgeball. Nobody dodges.');
const fx = createEffects({ seed: 7 });
scene.add(fx.group);

// The two of them, six metres apart.
const victim = createHumanoid({ seed: 21, palette: OUTFITS.villager });
victim.object.position.set(-3, 0, 0);
victim.object.rotation.y = Math.PI / 2;
scene.add(victim.object);
const victimLoco = new Locomotion(victim);
const victimReact = new Reactions(victim);

const thrower = createHumanoid({ seed: 34, palette: OUTFITS.knight });
thrower.object.position.set(3, 0, 0);
thrower.object.rotation.y = -Math.PI / 2;
scene.add(thrower.object);
const throwerLoco = new Locomotion(thrower);
const throwerReact = new Reactions(thrower);

let koCount = 0, reviveAt = Infinity, heavyCounter = 0, elapsed = 0;
const health = new Health({
  max: 5,
  invulnerable: 0.7,
  onDamage: (e) => {
    hud.hearts(health.current, 5);
    sounds.impact('soft', 0.5 + e.amount * 0.2, { at: victim.object.position });
    // The heavy ball staggers; the light ones flinch. Direction matters:
    // the recoil bends AWAY from where the ball came from.
    if (e.amount > 1) victimReact.stagger(e.from, e.amount);
    else victimReact.flinch(e.from, 1);
    fx.burst('dust', new Vector3().copy(victim.object.position).setY(1),
      { count: 5 });
  },
  onDeath: (e) => {
    koCount++;
    victimReact.knockOut();
    throwerReact.celebrate(1.6);
    hud.banner('KNOCKED OUT', 2);
    sounds.fail();
    fx.ring(new Vector3().copy(victim.object.position).setY(0.02),
      { radius: 1.6 });
    reviveAt = elapsed + 3;
  },
  onRevive: () => {
    victimReact.getUp();
    throwerReact.dejected(1.8); // back up already?
    hud.banner('BACK UP!', 1.4);
    hud.hearts(5, 5);
    sounds.success();
  },
});
hud.hearts(5, 5);

const shots = new Projectiles({
  gravity: 7,
  floor: 0,
  size: 0.16,
  color: 0xd9534f,
  onHit: ({ target, at }) => {
    const heavy = heavyCounter % 3 === 0;
    health.damage({ amount: heavy ? 2 : 1, from: at, knockback: 3 }, target.center);
    fx.burst('sparks', new Vector3(at.x, at.y, at.z), { count: 6 });
  },
  onExpire: (at) => fx.burst('dust', new Vector3(at.x, 0.15, at.z), { count: 4 }),
});
scene.add(shots.mesh);
// The hitbox lives at CHEST height. A target centred on the object's
// origin sits at the feet — and a ball crossing at 1.1 m never comes
// within half a metre of the floor, so every throw would miss. The
// centre is a live vector the loop keeps at the victim's chest.
const chest = new Vector3(-3, 1.05, 0);
shots.addTarget({ center: chest, radius: 0.6, team: 'victim' });

let nextThrow = 1.5;
game.onUpdate((t) => {
  const dt = t.delta;
  elapsed += dt;
  health.update(dt);
  chest.set(victim.object.position.x, 1.05, victim.object.position.z);

  // The thrower lobs — a bigger one every third ball.
  if (elapsed > nextThrow && health.alive) {
    heavyCounter++;
    nextThrow = elapsed + 1.7;
    const from = new Vector3().copy(thrower.object.position).setY(1.4);
    const to = new Vector3().copy(victim.object.position).setY(1.1);
    const flight = 0.7;
    shots.fire(from, new Vector3(
      (to.x - from.x) / flight,
      (to.y - from.y) / flight + 7 * flight * 0.5,
      (to.z - from.z) / flight
    ), { team: 'thrower' });
    sounds.whoosh(0.7);
    throwerReact.flinch(undefined, 0.6); // the follow-through reads as effort
  }
  if (elapsed > reviveAt) {
    reviveAt = Infinity;
    health.revive();
  }

  // THE ORDER: locomotion writes the pose, reactions bend the result.
  victimLoco.update(dt);
  victimReact.update(dt);
  throwerLoco.update(dt);
  throwerReact.update(dt);
  shots.update(dt);
  fx.update(dt);
  hud.update(dt);

  game.camera.position.set(Math.sin(elapsed * 0.1) * 3, 2.6, 7.5);
  game.camera.lookAt(0, 1, 0);
});

window.knockoutDebug = () => ({
  victimHp: health.current,
  down: victimReact.down,
  koCount,
  shotsActive: shots.active,
});

game.start();`,
  },
  {
    id: 'lamplighter',
    title: 'The lamplighter',
    group: 'Scale',
    code: `// THE LIGHTING ARC'S PAYOFF. Dusk falls on a village lane (SCENA's
// day cycle), and instead of a photocell, a PERSON: the lamplighter
// makes their rounds, lantern in hand, lighting each street lamp in
// turn — setLit is the same verb a photocell or a lever would use.
// Thirteen glows, six real lights: the LightBudget follows the camera.
// At dawn the lamps are doused and the rounds begin again.
import { Mesh, PlaneGeometry, Vector3 } from 'three';
import { applyFog, createDayCycle, createHouse, createLanternLight,
         createLightBudget, createLightingRig, createSky, createStreetLight,
         createSurface, PALETTES } from 'scena3d';
import { createHumanoid, Locomotion, attach, OUTFITS } from 'anima3d';
import { Game, Hud, Soundboard } from 'gama3d';

const palette = PALETTES.dusk;
const game = new Game();
const scene = game.world.scene;
const sky = createSky({ palette });
const rig = createLightingRig('day');
scene.add(sky.mesh, rig.group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(80, 60),
  createSurface('moss', { seed: 9 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const hud = new Hud();
const sounds = new Soundboard({ seed: 14 });
sounds.unlock();
sounds.onCaption((c) => hud.caption('♪ ' + c.text));

// The lane: houses on the far side (their windows warm after dark).
const houses = [-14, -7, 0, 7, 14].map((x, i) => {
  const house = createHouse({ seed: 31 + i, palette });
  house.object.position.set(x, 0, -7);
  scene.add(house.object);
  return house;
});

// Six lamps down the lane, all dark until someone comes.
const lamps = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5].map((x, i) => {
  const lamp = createStreetLight({ style: 'village', seed: 41 + i });
  lamp.object.position.set(x, 0, -1);
  scene.add(lamp.object);
  lamp.setLit(false);
  return lamp;
});

// The budget: every glow claims; six real lights follow the camera.
const budget = createLightBudget({ max: 6 });
scene.add(budget.group);
for (const lamp of lamps) budget.register(lamp.claim);

// The day, turning. Houses hand their nightGlow panes to the cycle.
const cycle = createDayCycle({ sky, rig, scene, lamps: houses,
  dayLength: 80, timeOfDay: 0.62 });

// ---- The lamplighter, hand-lantern swinging.
const walker = createHumanoid({ seed: 77, palette: OUTFITS.villager,
  accessories: ['hat'] });
walker.object.position.set(-16, 0, 1.5);
scene.add(walker.object);
const loco = new Locomotion(walker);
const handLantern = createLanternLight({ hanging: true, seed: 3 });
handLantern.object.scale.setScalar(0.62);
attach(walker, 'handLeft', handLantern.object);
budget.register(handLantern.claim);
handLantern.setLit(false);

const HOME = new Vector3(-16, 0, 1.5);
let target = -1;       // which lamp we're walking to; -1 = home
let dwell = 0;         // seconds left standing at the current lamp
let phase = 'waiting'; // waiting → rounds → done → (dawn) waiting
hud.objective('Dusk approaches. The lamplighter waits.');

game.onUpdate((t) => {
  const dt = t.delta;
  cycle.update(dt);

  // Dusk: pick up the lantern and go. Dawn: douse and go home.
  if (phase === 'waiting' && cycle.sunElevation < 0.12) {
    phase = 'rounds';
    target = 0;
    handLantern.setLit(true);
    hud.banner('LAMPS AHOY', 1.6);
    hud.objective('The rounds: 0/' + lamps.length + ' lamps lit');
  }
  if (phase !== 'waiting' && cycle.sunElevation > 0.2) {
    phase = 'waiting';
    target = -1;
    for (const lamp of lamps) lamp.setLit(false);
    handLantern.setLit(false);
    hud.objective('Morning. The lamps sleep; so should the lamplighter.');
  }

  // Walk toward the target (a lamp, or home), dwell, ignite, move on.
  const goal = target >= 0
    ? new Vector3(lamps[target].object.position.x, 0,
        lamps[target].object.position.z + 1.1)
    : HOME;
  const dx = goal.x - walker.object.position.x;
  const dz = goal.z - walker.object.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  let speed = 0;
  if (dwell > 0) {
    dwell -= dt;
    if (dwell <= 0 && phase === 'rounds') {
      lamps[target].setLit(true);
      sounds.chime(target);
      const lit = lamps.filter((l) => l.lit).length;
      hud.objective('The rounds: ' + lit + '/' + lamps.length + ' lamps lit');
      target++;
      if (target >= lamps.length) {
        phase = 'done';
        target = -1;
        hud.banner('ALL LIT — good night', 2.2);
        sounds.success();
      }
    }
  } else if (dist > 0.5) {
    speed = Math.min(1.4, dist);
    walker.object.position.x += (dx / dist) * speed * dt;
    walker.object.position.z += (dz / dist) * speed * dt;
    walker.object.rotation.y = Math.atan2(dx, dz);
  } else if (phase === 'rounds' && target >= 0 && !lamps[target].lit) {
    dwell = 1.1; // the pause at the post — reach up, touch flame to mantle
  }
  loco.update(dt, speed);

  hud.update(dt);
  const cx = walker.object.position.x * 0.55;
  game.camera.position.set(cx, 4.6, 12.5);
  game.camera.lookAt(cx * 0.8, 1.4, -2);
  budget.update(game.camera.position);
});

window.lamplighterDebug = () => ({
  timeOfDay: Number(cycle.timeOfDay.toFixed(3)),
  sunElevation: Number(cycle.sunElevation.toFixed(3)),
  phase,
  target,
  lit: lamps.filter((l) => l.lit).length,
  handLantern: handLantern.lit,
  granted: budget.active,
  walkerX: Number(walker.object.position.x.toFixed(2)),
});

game.start();`,
  },
  {
    id: 'sortie',
    title: 'The sortie',
    group: 'Scale',
    code: `// THE SORTIE — the aviation arc's finale, and the trilogy's handshake in
// one scene. SCENA builds the airfield and both deltas; GAMA flies them,
// locks on and launches; ANIMA puts a PILOT in the cockpit who WEARS the
// g the turn is pulling — head sagging, gaze dragging, greying out if the
// pull is held too long — and a ground crew on the apron whose heads
// track the fight across the sky. Nothing here imports anything else.
// The view cuts every nine seconds: cockpit, chase, apron.
import { AnimationMixer, Mesh, PlaneGeometry, Vector3 } from 'three';
import { applyFog, createEffects, createFighterJet, createHangar,
         createLightingRig, createRunway, createSky, createSurface,
         createTrail, createWindsock, PALETTES } from 'scena3d';
import { Cockpit, createHumanoid, createPoseClip, LookAt, Locomotion,
         OUTFITS } from 'anima3d';
import { FlightController, Game, GameFeel, Hud, LockOn, Missiles } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const grass = new Mesh(new PlaneGeometry(2000, 2000), createSurface('moss', { seed: 5 }));
grass.rotation.x = -Math.PI / 2;
scene.add(grass);

// ---- SCENA: the airfield the sortie flies from.
scene.add(createRunway({ length: 90, width: 10, number: 27, seed: 3 }).object);
const hangar = createHangar({ width: 14, depth: 11, seed: 4 });
hangar.object.position.set(-26, 0, -18);
scene.add(hangar.object);
const sock = createWindsock({ seed: 6 });
sock.object.position.set(20, 0, -34);
scene.add(sock.object);
const fx = createEffects({ seed: 8 });
scene.add(fx.group);

// ---- SCENA: two deltas, and the contrails behind them.
const jet = createFighterJet({ seed: 7, color: 0x5d6a78 });
const bandit = createFighterJet({ seed: 11, color: 0x6e5a48 });
scene.add(jet.object, bandit.object);
const trails = [jet, bandit].map(() => {
  const trail = createTrail({ length: 60, width: 0.5, life: 2.4, opacity: 0.4 });
  scene.add(trail.mesh);
  return trail;
});

// ---- GAMA: the flight models. Both are the same arcade physics; only
// the autopilot flying each stick differs.
const air = (o) => new FlightController(Object.assign({
  maxSpeed: 68, stallSpeed: 20, rotateSpeed: 22,
  pitchRate: 1.05, rollRate: 2.4, turnCoupling: 1.15,
}, o));
const mine = air({});
const his = air({ maxSpeed: 52 });
for (const [f, x, z, h] of [[mine, 0, -150, 0], [his, 60, 40, 2.4]]) {
  f.position.set(x, 70, z);
  f.heading = h;
  f.speed = 55;
  f.throttle = 0.85;
  f.grounded = false;
}

const missiles = new Missiles({
  seed: 5, speed: 105, turnRate: 2.8, motorTime: 6, capacity: 6,
  onHit: () => {
    fx.burst('debris', his.position);
    feel.shake(0.7);
    kills++;
    hud.banner('SPLASH — ' + kills);
    // The bandit is replaced by another one, well out in front.
    his.position.set(mine.position.x + 90, 60 + (kills % 3) * 12, mine.position.z + 110);
    his.speed = 58;
    jet.rearm();
  },
  onMiss: () => { hud.caption('Missile timed out'); jet.rearm(); },
});
scene.add(missiles.group);
const lock = new LockOn({ halfAngle: 0.62, range: 130, lockTime: 0.9 });
const feel = new GameFeel({ seed: 3 });
const hud = new Hud();
let kills = 0;

// ---- ANIMA: the pilot, strapped into the SCENA airframe.
const pilot = createHumanoid({ seed: 41, height: 1.76, palette: OUTFITS.guard,
  accessories: ['cap'] }); // the helmet
pilot.object.scale.setScalar(0.72);
// The tolerance numbers are deliberately intolerant, and it is worth
// knowing why: GAMA's arcade model clamps bank, so its SUSTAINED load
// tops out near 2.5g (level-turn load is 1/cos(bank)) and a realistic
// five-g-for-several-seconds threshold would never once bite. Every g
// worth watching here is a transient — the break. Tune these to the
// flight model you actually fly.
const seat = new Cockpit(pilot, {
  gLimit: 8, greyAt: 2.4, greyIn: 1.6, greyOut: 3.5,
  onGLOC: () => hud.banner('G-LOC'),
  onRecover: () => hud.caption('…back'),
});
// The canopy on SCENA's delta sits just forward of the wing root. The
// harness does the rest: after this the body has no world transform of
// its own — the aircraft's attitude IS the pilot's attitude.
seat.seat(jet.object, { y: 1.24, z: 2.3 });
const mixer = new AnimationMixer(pilot.mesh);
mixer.clipAction(createPoseClip(pilot, 'pilot')).play();
seat.watch(bandit.object);

// ---- ANIMA: the ground crew, watching the fight go over.
const crew = [-3.5, -1, 1.5].map((x, i) => {
  const rig = createHumanoid({ seed: 60 + i, palette: OUTFITS.villager });
  rig.object.position.set(-14 + x, 0, -32 + (i % 2) * 1.4);
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  const gaze = new LookAt(rig);
  gaze.target = jet.object; // heads follow the jets, not the camera
  return { rig, loco, gaze };
});

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const forward = (f) => new Vector3(
  Math.sin(f.heading) * Math.cos(f.pitch),
  Math.sin(f.pitch),
  Math.cos(f.heading) * Math.cos(f.pitch)
);

/**
 * Fly at a point. Two rules, and the second one cost a whole test flight.
 *
 * THE STICK IS A RATE: chase the target ATTITUDE proportionally and never
 * command a raw rate, or the roll integrates into a saturated bank and the
 * aircraft orbits its waypoint forever.
 *
 * AND THE TURN LIVES IN THE BANK: in a bank-to-turn model the nose being
 * off is a ROLL problem. The first version answered it with pitch as well
 * — hold the nose up whenever the target is wide, the way a hard turn
 * looks from outside — and the jet simply climbed away from the fight:
 * 950 metres up, three kilometres out, still dutifully pulling. Pitch
 * points at the target and no further.
 */
const steer = (f, aim, pull) => {
  const dx = aim.x - f.position.x;
  const dz = aim.z - f.position.z;
  const dy = aim.y - f.position.y;
  const range = Math.hypot(dx, dz);
  let off = Math.atan2(dx, dz) - f.heading;
  while (off > Math.PI) off -= Math.PI * 2;
  while (off < -Math.PI) off += Math.PI * 2;
  // NEGATIVE off. In this model positive bank is a LEFT turn (heading
  // integrates -sin(bank)), so getting this backwards does not wobble —
  // it turns the jet away and parks the bandit at exactly six o'clock
  // forever, which is a stable equilibrium and looks disconcertingly
  // like working code.
  const bank = clamp(-off * 2.2, -1.12, 1.12);
  // Pitch points at the target — plus whatever break the caller is
  // pulling. A sustained turn in this model tops out around 2.5g
  // (bank is clamped, and level-turn load is 1/cos(bank)); everything
  // above that is a PULL, and pull is a pitch RATE, not a pitch.
  const climb = clamp(Math.atan2(dy, Math.max(range, 25)) + (pull || 0), -0.32, 0.62);
  f.control({
    roll: clamp((bank - f.bank) * 3.2, -1, 1),
    pitch: clamp((climb - f.pitch) * 3.4, -1, 1),
  });
  return Math.abs(off);
};

// Where the bandit WILL be. Pure pursuit against something that turns is
// a stern chase you never win; a lead point closes the geometry.
const lead = new Vector3();
const leadPoint = (f, foe) => {
  const range = f.position.distanceTo(foe.position);
  return lead.copy(foe.velocity).multiplyScalar(Math.min(range / 70, 3)).add(foe.position);
};

// The bandit runs a wide racetrack and jinks; it is not trying to win,
// it is trying to make the pursuit expensive.
// Kept deliberately tight, and over the field: SCENA's 'haze' fog dies
// at 160 m, so a fight that wanders 300 m out is a fight nobody on the
// ground can see. The circuit is sized to the visibility, not the map.
const LEGS = [
  new Vector3(95, 65, 110), new Vector3(-110, 80, 120),
  new Vector3(-120, 55, -90), new Vector3(90, 70, -110),
];
let leg = 0;
let view = 'cockpit';
let clock = 0;
let flareTimer = 4;
let reload = 0;   // rails empty faster than a lock decides
let offNose = 0;  // radians the bandit sits off the nose
let breaking = 0; // seconds of break turn still to pull
const aim = new Vector3();
const toJet = new Vector3();
const look = new Vector3();
const CREW_AT = new Vector3(-14, 1.55, -31.3); // where the crew stand

game.onUpdate((t) => {
  const dt = t.delta;
  clock += dt;
  const jp = jet.object.position; // read by the crew, the trails and the camera
  view = ['cockpit', 'chase', 'apron'][Math.floor(clock / 9) % 3];

  // --- The bandit: waypoints, plus a jink that keeps the shot honest.
  aim.copy(LEGS[leg]);
  aim.x += Math.sin(clock * 0.7) * 22;
  aim.y += Math.sin(clock * 0.5) * 12;
  if (his.position.distanceTo(LEGS[leg]) < 45) leg = (leg + 1) % LEGS.length;
  steer(his, aim);
  his.throttle = 0.85;
  his.update(dt);
  his.apply(bandit.object);
  bandit.update(dt, his.aircraftInput);

  // Flares, on a timer — the bandit knows what is behind it.
  flareTimer -= dt;
  if (flareTimer <= 0) {
    flareTimer = 5.5;
    missiles.flare(his.position);
    fx.burst('sparks', his.position);
  }

  // --- The player's jet: pursue, and pull hard doing it.
  // Inside knife range: break. You do not fly through the bandit, you
  // haul the nose up and go over the top — and THAT is where the g that
  // costs the pilot their vision comes from. A break is a MANEUVER, not
  // a condition: once committed it is held, which is the difference
  // between a one-second snatch (harmless) and a sustained pull (not).
  if (mine.position.distanceTo(his.position) < 75) breaking = Math.max(breaking, 3.2);
  breaking = Math.max(0, breaking - dt);
  offNose = steer(mine, leadPoint(mine, his), breaking > 0 ? 0.62 : 0);
  // …and if the pilot is out, nobody is flying it. Stick neutral: the
  // bank decays, the jet flies itself straight, and the fight waits.
  if (seat.gloc) mine.control({});
  mine.throttle = 1;
  mine.update(dt);
  mine.apply(jet.object);
  jet.update(dt, mine.aircraftInput);

  // --- The shot. LockOn wants a seeker pose; the airframe has one.
  const dir = forward(mine);
  lock.update(dt, { position: mine.position, direction: dir },
    { center: his.position, radius: 4 });
  reload -= dt;
  // A lock is not a trigger held down: one round, then a pause.
  if (lock.state === 'locked' && jet.armed > 0 && reload <= 0 && !seat.gloc) {
    reload = 2.6;
    // The round leaves the RAIL: SCENA hands back a world-space pose and
    // GAMA flies exactly that. The missile a game flies is the missile
    // the wing stops carrying.
    const launch = jet.launchFrom(jet.armed - 1);
    if (launch) {
      missiles.fire(launch.position, launch.direction,
        { center: his.position, radius: 4 });
      fx.burst('dust', launch.position);
      hud.caption('Fox two');
    }
  }
  missiles.update(dt);

  // --- ANIMA. The mixer holds the seated pose; the Cockpit layers the
  // g on top of it. Order matters: pose first, then what it costs.
  mixer.update(dt);
  seat.update(dt, mine);
  for (const c of crew) {
    // They turn to follow it. A head alone runs out of neck — LookAt
    // clamps, correctly — so the body comes round too, the way anybody
    // watching an aeroplane go over actually does it.
    let turn = Math.atan2(jp.x - c.rig.object.position.x, jp.z - c.rig.object.position.z)
      - c.rig.object.rotation.y;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    c.rig.object.rotation.y += clamp(turn, -1.2 * dt, 1.2 * dt);
    c.loco.update(dt, { x: 0, y: 0, z: 0 });
    c.gaze.update(dt);
  }
  for (const [i, trail] of trails.entries()) {
    trail.push((i === 0 ? jet : bandit).object.position);
    trail.update(dt);
  }

  // --- Camera. Three ways of telling the same nine seconds.
  if (view === 'cockpit') {
    // Right ON the canopy, in the jet's own frame: the pilot is 0.3 m of
    // a 9 m aeroplane, so any framing that flatters the airframe loses
    // the person — and the person is the only thing this view is for.
    const canopy = new Vector3(0, 2.05, 2.5).applyQuaternion(jet.object.quaternion).add(jp);
    const off = new Vector3(-1.5, 0.55, 1.0).applyQuaternion(jet.object.quaternion);
    game.camera.position.copy(canopy).add(off);
    game.camera.lookAt(canopy);
  } else if (view === 'chase') {
    const off = new Vector3(0, 4.5, -18).applyQuaternion(jet.object.quaternion);
    game.camera.position.copy(jp).add(off);
    game.camera.lookAt(his.position.distanceTo(jp) < 300 ? his.position : jp);
  } else {
    // From the apron, and the framing is the whole point: a camera that
    // simply points at the jet pitches up past the crew and photographs
    // an empty sky. Stand behind them, and aim HALFWAY UP to the fight —
    // then the heads and the thing the heads are following are both in
    // the picture, which is the only reason this view exists.
    const flat = Math.hypot(jp.x - CREW_AT.x, jp.z - CREW_AT.z);
    toJet.set(jp.x - CREW_AT.x, 0, jp.z - CREW_AT.z).normalize();
    game.camera.position.copy(CREW_AT).addScaledVector(toJet, -6).setY(1.95);
    look.copy(CREW_AT).addScaledVector(toJet, 6);
    look.y = 1.6 + Math.tan(Math.atan2(jp.y - 1.6, Math.max(flat, 1)) * 0.5) * 6;
    game.camera.lookAt(look);
  }

  feel.update(dt);
  feel.apply(game.camera);
  hud.update(dt);
  hud.objective(
    'G ' + seat.load.toFixed(1) + '   ' +
    (seat.gloc ? 'UNCONSCIOUS' : 'GREY ' + Math.round(seat.grey * 100) + '%') +
    '   ' + lock.state.toUpperCase() + '   RAILS ' + jet.armed
  );
});

window.sortieDebug = () => ({
  view,
  g: Number(seat.load.toFixed(2)),
  grey: Number(seat.grey.toFixed(2)),
  gloc: seat.gloc,
  gazeYaw: Number(seat.gaze.yaw.toFixed(2)),
  headSag: Number(pilot.bones.Head.rotation.x.toFixed(3)),
  offNose: Number(offNose.toFixed(2)),
  crewYaw: Number(crew[0].rig.object.rotation.y.toFixed(2)),
  jetBearing: Number(Math.atan2(jet.object.position.x - crew[0].rig.object.position.x,
    jet.object.position.z - crew[0].rig.object.position.z).toFixed(2)),
  crewHeadY: Number(crew[0].rig.bones.Head.rotation.x.toFixed(2)),
  lock: lock.state,
  rails: jet.armed,
  missiles: missiles.alive,
  kills,
  alt: Number(mine.position.y.toFixed(1)),
  speed: Number(mine.speed.toFixed(1)),
  range: Number(mine.position.distanceTo(his.position).toFixed(0)),
});

game.start();`,
  },
  {
    id: 'parkour',
    title: 'Parkour: two bodies, one course',
    group: 'Scale',
    code: `// TWO BODIES, ONE COURSE — and they do not agree about it.
//
// Every parkour system in every engine warps authored mocap toward the
// obstacle. ANIMA has no mocap: its clips are functions of the rig. So the
// move set is derived from REACH, and the same wall is a different problem
// for a different body.
//
// The course asks all three questions, because they are not the same one.
// Going OVER something is a choice between techniques. Going DOWN off it is
// not a choice at all — you fall whether or not you have a technique — so
// \`descend\` reports what the landing COSTS instead of whether it is allowed.
// Going ACROSS a hole is a question about speed.
//
// Watch the middle rail: the tall one vaults it, the short one has to mantle.
// Watch the last wall: the tall one gets up it and the short one CANNOT, and
// says so rather than pretending. That refusal is the feature.
import { Mesh, BoxGeometry, Object3D, Vector3 } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         createTree, PALETTES } from 'scena3d';
import { canClear, chooseMove, createHumanoid, landingFor, Locomotion,
         OUTFITS, Parkour, reachOf } from 'anima3d';
import { Game, Hud } from 'gama3d';

const palette = PALETTES.urban ?? PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const hud = new Hud();

// ── The course ──────────────────────────────────────────────────────
// Heights chosen to STRADDLE the two bodies' bands, because the whole
// point is that a band is a property of a person. Every climb is paid for
// by a descent: a system that only goes up leaves characters walking on air
// past the far edge of everything they got onto.
const COURSE = [
  { kind: 'over',   label: 'CURB',   z: 4,     height: 0.30, depth: 0.9 },
  { kind: 'down',   label: 'CURB',   z: 4.9,   height: 0.30, depth: 0.4 },
  { kind: 'over',   label: 'RAIL',   z: 8,     height: 0.91, depth: 0.28 },
  { kind: 'down',   label: 'RAIL',   z: 8.28,  height: 0.91, depth: 0.3 },
  { kind: 'over',   label: 'LEDGE',  z: 12,    height: 1.10, depth: 2.6 },
  { kind: 'down',   label: 'LEDGE',  z: 14.6,  height: 1.10, depth: 0.4 },
  { kind: 'across', label: 'GAP',    z: 18,    width: 1.5 },
  { kind: 'over',   label: 'WALL',   z: 22.5,  height: 1.42, depth: 0.8 },
  { kind: 'down',   label: 'WALL',   z: 23.3,  height: 1.42, depth: 0.4 },
];
// Where a body is standing once an entry is done. THE GAME OWNS THIS, not
// ANIMA — the same division of labour as "ANIMA does not raycast". A step or
// a mantle finishes on top of the thing; everything else finishes beside it.
const groundAfter = (o, move) =>
  move === 'step' || move === 'mantle' ? o.height : 0;
const GAP = COURSE.find((o) => o.kind === 'across');

// The ground has a HOLE in it, so the gap is a gap and not a painted line.
// SLABS, not planes: a plane has no thickness, so a hole cut in one has no
// walls and the trench renders as a slit of sky.
const road = createSurface('concrete', { seed: 3 });
const strip = (from, to) => {
  const g = new Mesh(new BoxGeometry(220, 2, to - from), road);
  g.position.set(0, -1, (from + to) / 2);
  scene.add(g);
};
strip(-110, GAP.z);
strip(GAP.z + GAP.width, 110);
const pit = new Mesh(new BoxGeometry(24, 0.4, GAP.width), createSurface('concrete', { seed: 21 }));
pit.position.set(0, -1.9, GAP.z + GAP.width / 2);
scene.add(pit);

for (const [x, z, s] of [[-11, 6, 2], [10, 26, 5], [-10, 20, 9], [12, -6, 12]]) {
  const t = createTree({ species: 'oak', seed: s, height: 6, palette });
  t.object.position.set(x, 0, z);
  scene.add(t.object);
}

const stone = createSurface('concrete', { seed: 11 });
for (const o of COURSE) {
  // The handshake is an ANCHOR on the edge the runner meets, +z facing the
  // way it is travelling. ANIMA never raycasts: finding the obstacle is the
  // game's job. A 'down' entry re-anchors the SAME slab at its far edge —
  // that is all a drop is, geometrically.
  o.edge = new Object3D();
  o.edge.position.set(0, o.kind === 'across' ? 0 : o.height, o.z);
  scene.add(o.edge);
  if (o.kind !== 'over') continue;
  const slab = new Mesh(new BoxGeometry(8, o.height, o.depth), stone);
  slab.position.set(0, o.height / 2, o.z + o.depth / 2);
  scene.add(slab);
}

// ── The runners ─────────────────────────────────────────────────────
const makeRunner = (seed, lane, outfit) => {
  const rig = createHumanoid({ seed, outfit });
  rig.object.position.set(lane, 0, -3);
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  const parkour = new Parkour(rig, loco);
  return {
    rig, loco, parkour, lane,
    reach: reachOf(rig),
    at: 0,            // index into COURSE
    ground: 0,        // what this body is standing on, in metres
    last: null,       // the move it just finished
    speed: 3.2,
    moves: [],
    refused: null,
    banner: '',
    bannerFor: 0,
  };
};
const runners = [
  makeRunner(5, -2.6, OUTFITS.athlete ?? undefined),
  makeRunner(12, 2.6, OUTFITS.worker ?? undefined),
];
// Where the ankle bone rests above the ground when a body is simply standing.
const LIFT = (() => {
  const r = runners[0].rig;
  r.object.updateWorldMatrix(true, true);
  return r.bones.LeftFoot.getWorldPosition(new Vector3()).y - r.object.position.y;
})();
// Tallest first, so the readout reads top to bottom like the lanes do.
runners.sort((a, b) => b.rig.height - a.rig.height);

const RESET_AFTER = 2.5;
const velocity = new Vector3();

const restart = (r) => {
  r.rig.object.position.set(r.lane, 0, -3);
  r.rig.object.rotation.set(0, 0, 0);
  r.at = 0;
  r.ground = 0;
  r.refused = null;
  r.moves = [];
  r.parkour.reset();
};

// How close to stand before asking. A drop is taken from the very lip; the
// others start from a run-up behind the obstacle.
const REACH_AT = { over: 1.15, across: 1.0, down: 0.5 };

game.onUpdate((t) => {
  const dt = t.delta;
  for (const r of runners) {
    if (r.bannerFor > 0) r.bannerFor -= dt;

    // Mid-move: the controller owns the body and nothing else may steer it.
    // \`busy\` is the whole handshake, exactly as Climb does it.
    if (r.parkour.busy) {
      r.parkour.update(dt);
      r.loco.update(dt, 0);
      continue;
    }
    if (r.parkour.state === 'done') {
      r.parkour.reset();
      r.ground = groundAfter(COURSE[r.at], r.last);
      // Put the body ON the surface. The move ends within ~70 mm of it, and
      // the last 70 mm is the game's to close because the game is the only
      // one that knows what the surface IS.
      r.rig.object.position.y = r.ground;
      r.at++;
    }
    // A descent you are not up for. The tall one VAULTS the rail and is
    // already on the road; the short one mantles it and has to get down.
    while (COURSE[r.at] && COURSE[r.at].kind === 'down' && r.ground <= 0.001) r.at++;

    // Stopped at something it cannot do: wait, then walk the course again.
    if (r.refused !== null) {
      r.refused -= dt;
      r.loco.update(dt, 0);
      if (r.refused <= 0) restart(r);
      continue;
    }

    const next = COURSE[r.at];
    if (!next) {
      // Course complete — jog on, then start over.
      r.rig.object.position.z += r.speed * dt;
      r.rig.object.position.y = r.ground;
      r.loco.update(dt, velocity.set(0, 0, r.speed));
      if (r.rig.object.position.z > 29) restart(r);
      continue;
    }

    if (next.z - r.rig.object.position.z > REACH_AT[next.kind]) {
      r.rig.object.position.z += r.speed * dt;
      r.rig.object.position.y = r.ground;
      r.loco.update(dt, velocity.set(0, 0, r.speed));
      continue;
    }

    // At the obstacle. Ask THIS body what it can do about it — a different
    // question for each of the three, which is why they are three calls.
    let did = null;
    if (next.kind === 'over') did = r.parkour.attempt(next, r.speed);
    else if (next.kind === 'down') did = r.parkour.descend(next);
    else did = r.parkour.leap(next, r.speed);

    if (did) {
      r.last = next.kind === 'over' ? did : next.kind === 'down' ? 'drop' : 'gap-jump';
      r.moves.push(next.label + ':' + did);
      r.banner = next.label + ' \\u2192 ' + String(did).toUpperCase();
      r.bannerFor = 2.2;
    } else {
      // The honest null. A system that always finds a move puts characters
      // through walls; this one stops and admits the wall won.
      r.banner = next.label + ' \\u2192 ' + (next.kind === 'across' ? 'TOO FAR' : 'NO WAY UP');
      r.bannerFor = RESET_AFTER;
      r.refused = RESET_AFTER;
      r.loco.update(dt, 0);
    }
  }

  const line = (r) => {
    const k = r.rig.height.toFixed(2) + 'm';
    return k + '  vault\\u2264' + r.reach.vault.toFixed(2) +
      ' mantle\\u2264' + r.reach.mantle.toFixed(2) +
      ' jump\\u2264' + (r.reach.gap * (0.55 + 0.22 * r.speed)).toFixed(2) +
      (r.bannerFor > 0 ? '   ' + r.banner : '');
  };
  hud.objective(line(runners[0]));
  hud.prompt(line(runners[1]));
  hud.update(dt);
});

game.camera.position.set(6.4, 2.7, 0.8);
game.camera.lookAt(-0.4, 1.0, 13.5);

window.parkourDebug = () => {
  // The ankle's rest height above whatever it stands on. Read from the rig,
  // not assumed: it is where the foot bone sits, not where the sole is.
  const ankle = (r) => {
    r.rig.object.updateWorldMatrix(true, true);
    const l = r.rig.bones.LeftFoot.getWorldPosition(new Vector3()).y;
    const rr = r.rig.bones.RightFoot.getWorldPosition(new Vector3()).y;
    return Math.min(l, rr);
  };
  const of = (r) => ({
    height: Number(r.rig.height.toFixed(2)),
    // How far the lower foot is from the surface this body is standing on.
    // Positive floats, negative sinks. Nothing else in the scene can see it.
    foot: Number((ankle(r) - r.ground - LIFT).toFixed(3)),
    phase: r.parkour.state,
    vault: Number(r.reach.vault.toFixed(2)),
    mantle: Number(r.reach.mantle.toFixed(2)),
    at: r.at,
    moves: r.moves.slice(0, 8),
    stopped: r.refused !== null,
    z: Number(r.rig.object.position.z.toFixed(2)),
    y: Number(r.rig.object.position.y.toFixed(2)),
  });
  // What each body WOULD do at every entry, asked directly. This is the
  // claim the scene is making, in numbers a gate can read — including the
  // one nothing else checks: after a drop the body is back on the ground.
  const verdicts = runners.map((r) =>
    COURSE.map((o) =>
      o.kind === 'over' ? String(chooseMove(o, r.reach, { speed: r.speed }))
      : o.kind === 'down' ? landingFor(o.landing ?? o.height, r.reach)
      : canClear(o.width, r.reach, r.speed) ? 'gap-jump' : 'null')
  );
  return {
    tall: of(runners[0]),
    short: of(runners[1]),
    verdicts,
    disagree: verdicts[0].filter((v, i) => v !== verdicts[1][i]).length,
    // Nobody walks on air and nobody wades through the road. Mid-move the
    // controller owns the body, so this only judges the frames the SCENE is
    // responsible for — which are exactly the ones it used to get wrong.
    offGround: runners.filter(
      (r) => r.parkour.state === 'idle' && Math.abs(r.rig.object.position.y - r.ground) > 0.02
    ).length,
    draws: game.renderer.info.render.calls,
  };
};

game.start();`,
  },
  {
    id: 'dogfight',
    title: 'Dogfight: fly it, and count the rounds',
    group: 'Scale',
    code: `// A DOGFIGHT YOU FLY, and the whole trilogy under it.
//
// SCENA builds the deltas and the ammunition; GAMA flies them, tracks the
// lock, throws the shells and the missiles; ANIMA puts a pilot in the seat
// who WEARS the g you are pulling. Nothing imports anything else.
//
// The point of the scene is the AMMUNITION HANDSHAKE. The 30 mm the guns
// fire is not a number typed into a projectile system — it is
// ballisticsOf('autocannon'), the same table entry that decides how long
// the cartridge model is. Muzzle velocity, drop, tracer size and colour all
// come out of it, so the round you see on the belt and the round that flies
// CANNOT disagree. The belt drains as you shoot, and it drains because
// consume() was called, not because a counter went down beside it.
//
//   ARROWS / WASD  pitch + roll     SHIFT / CTRL  throttle
//   SPACE  guns                     F  missile (needs a LOCK)
//   X  flares                       C  camera        R  rearm
//   Touch: drag to fly, tap right half for guns, left half for missile.
import { AnimationMixer, Mesh, PlaneGeometry, Vector3 } from 'three';
import { applyFog, ballisticsOf, createBelt, createEffects,
         createFighterJet, createLightingRig, createRack, createSky,
         createSurface, createTrail, PALETTES } from 'scena3d';
import { Cockpit, createHumanoid, createPoseClip, OUTFITS } from 'anima3d';
import { FlightController, Game, GameFeel, Health, Hud, LockOn, Missiles,
         Projectiles } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(4000, 4000), createSurface('moss', { seed: 5 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const fx = createEffects({ seed: 8, capacity: 420 });
scene.add(fx.group);
const feel = new GameFeel({ seed: 3 });
const hud = new Hud();

// ── The armament, from SCENA's ammunition table ──────────────────────
// One lookup, and it decides everything downstream: how fast the shell
// leaves, how hard it drops, how big and what colour the tracer is, and
// how many are in a belt. Change 'autocannon' to 'heavy-mg' and the whole
// weapon changes character without another line moving.
const GUN = ballisticsOf('autocannon');
const AAM = ballisticsOf('missile');

const belt = createBelt('autocannon', { capacity: 60, drape: false });
belt.object.scale.setScalar(1.6);
const rack = createRack('missile', { capacity: 4 });
rack.object.scale.setScalar(0.6);

const guns = new Projectiles({
  capacity: 96,
  // Straight off the table. A 30 mm shell leaves at 1080 m/s and falls at
  // 9.81 like everything else unpowered — what makes it flat is the SPEED,
  // not a special gravity, and that is the table's opinion and not mine.
  gravity: GUN.gravity,
  size: GUN.size * 1.8,
  color: GUN.color,
  floor: 0,
  onHit: ({ target, at }) => {
    const foe = foes.find((f) => f.target === target);
    if (!foe || !foe.alive) return;
    fx.burst('sparks', at);
    foe.health.damage({ amount: 1, from: at }, foe.flight.position);
  },
  onExpire: (at) => { if (at.y < 1.5) fx.burst('dust', new Vector3(at.x, 0.2, at.z)); },
});
scene.add(guns.mesh);

const missiles = new Missiles({
  seed: 5, speed: AAM.speed || 120, turnRate: 2.6, motorTime: 7, capacity: 8,
  onHit: (hit) => {
    const foe = foes.find((f) => f.target === hit.target);
    if (foe) kill(foe, foe.flight.position);
    else boom(hit.at ?? hit.position ?? new Vector3());
  },
  onMiss: () => hud.caption('Missile timed out'),
});
scene.add(missiles.group);
// A 29-degree seeker is realistic and miserable to fly against with a
// keyboard: flown headlessly the bandit sat at 33 degrees off the nose for
// most of a pass and never once tripped the lock. 46 degrees is an arcade
// cone, and it is the difference between a weapon and an ornament.
const lock = new LockOn({ halfAngle: 0.8, range: 260, lockTime: 0.9 });

// ── The player's jet, and the pilot in it ───────────────────────────
const jet = createFighterJet({ seed: 7, color: 0x5d6a78 });
scene.add(jet.object);
// The belt rides on the airframe's flank and the rack under the wing, so
// what the HUD says and what the aircraft is CARRYING are the same fact.
belt.object.position.set(0.9, 0.2, -0.6);
rack.object.position.set(0, -0.55, 0.4);
jet.object.add(belt.object, rack.object);

const flight = new FlightController({
  maxSpeed: 78, stallSpeed: 20, rotateSpeed: 22,
  pitchRate: 1.15, rollRate: 2.6, turnCoupling: 1.2,
});
flight.position.set(0, 220, -260);
flight.speed = 60;
flight.throttle = 0.85;
flight.grounded = false;

const pilot = createHumanoid({ seed: 41, height: 1.76, palette: OUTFITS.guard,
  accessories: ['cap'] });
pilot.object.scale.setScalar(0.72);
const seat = new Cockpit(pilot, {
  gLimit: 9, greyAt: 2.6, greyIn: 1.8, greyOut: 3.2,
  onGLOC: () => { hud.banner('G-LOC'); feel.shake(0.5); },
  onRecover: () => hud.caption('…back'),
});
seat.seat(jet.object, { y: 1.24, z: 2.3 });
const mixer = new AnimationMixer(pilot.mesh);
mixer.clipAction(createPoseClip(pilot, 'pilot')).play();

const myTrail = createTrail({ length: 70, width: 0.55, life: 2.6, opacity: 0.45 });
scene.add(myTrail.mesh);

// ── The bandits ─────────────────────────────────────────────────────
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const forward = (f) => new Vector3(
  Math.sin(f.heading) * Math.cos(f.pitch), Math.sin(f.pitch),
  Math.cos(f.heading) * Math.cos(f.pitch)
);

const boom = (at) => {
  // Three bursts, not one. An explosion that is a single puff reads as a
  // sprite; debris out, sparks up the middle and dust settling under it
  // reads as something coming apart.
  fx.burst('debris', at);
  fx.burst('sparks', at);
  fx.burst('dust', new Vector3(at.x, at.y - 2, at.z));
};

let kills = 0;
let lost = 0;
const makeFoe = (i) => {
  const body = createFighterJet({ seed: 11 + i * 7, color: [0x6e5a48, 0x4a5a48, 0x6a4a52][i % 3] });
  scene.add(body.object);
  const f = new FlightController({
    maxSpeed: 58 + i * 3, stallSpeed: 18, rotateSpeed: 22,
    pitchRate: 0.95, rollRate: 2.1, turnCoupling: 1.1,
  });
  f.grounded = false;
  const trail = createTrail({ length: 40, width: 0.4, life: 1.8, opacity: 0.3 });
  scene.add(trail.mesh);
  const foe = {
    body, flight: f, trail, alive: true, respawn: 0,
    target: { center: f.position, radius: 11, team: 'foes' },
    health: null,
  };
  foe.health = new Health({
    max: 5, invulnerable: 0.05,
    onDamage: () => fx.burst('sparks', f.position),
    onDeath: () => kill(foe, f.position),
  });
  guns.addTarget(foe.target);
  return foe;
};
const foes = [0, 1, 2].map(makeFoe);

const place = (foe, i) => {
  const a = Math.random() * Math.PI * 2;
  foe.flight.position.set(
    flight.position.x + Math.sin(a) * 320,
    140 + i * 40,
    flight.position.z + Math.cos(a) * 320
  );
  foe.flight.heading = a + Math.PI;
  foe.flight.speed = 52;
  foe.flight.throttle = 0.9;
  foe.alive = true;
  foe.respawn = 0;
  foe.health.revive();
  foe.body.object.visible = true;
};
foes.forEach(place);

function kill(foe, at) {
  if (!foe.alive) return;
  foe.alive = false;
  foe.respawn = 2.6;
  foe.body.object.visible = false;
  boom(at.clone ? at.clone() : new Vector3(at.x, at.y, at.z));
  feel.shake(0.85);
  kills++;
  hud.banner('SPLASH — ' + kills);
}

// ── Input: keyboard and touch, because a playground is both ─────────
const keys = new Set();
// Discrete actions are LATCHED, not sampled. Firing a missile, popping
// flares and cutting the camera all happen once per press, and asking
// "is F down right now?" inside the frame loop misses a quick tap
// entirely — the key goes down and up between two rAFs and the frame
// never sees it. Flown headlessly the lock went solid, the trigger was
// tapped, and the rack stayed full at four: the weapon was fine and the
// INPUT dropped it. Continuous controls (stick, throttle, guns) still
// sample held state, because that is what they are.
const tapped = new Set();
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!keys.has(k)) tapped.add(k);
  keys.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
const held = (...names) => names.some((n) => keys.has(n));
/** True once per press. Reading it consumes it. */
const tap = (...names) => {
  let hit = false;
  for (const n of names) if (tapped.delete(n)) hit = true;
  return hit;
};

let touch = null;
let touchFire = 0;
let touchMissile = false;
const onDown = (e) => {
  const t = e.touches ? e.touches[0] : e;
  touch = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
  if (t.clientX > innerWidth * 0.5) touchFire = 1;
  else touchMissile = true;
};
const onMove = (e) => {
  if (!touch) return;
  const t = e.touches ? e.touches[0] : e;
  touch.x = t.clientX;
  touch.y = t.clientY;
};
const onUp = () => { touch = null; touchFire = 0; };
addEventListener('touchstart', onDown, { passive: true });
addEventListener('touchmove', onMove, { passive: true });
addEventListener('touchend', onUp);
addEventListener('pointerdown', onDown);
addEventListener('pointermove', onMove);
addEventListener('pointerup', onUp);

// ── The fight ───────────────────────────────────────────────────────
const RELOAD = 3.2;
let heat = 0;          // seconds of fire left before the barrels need a rest
let reloading = 0;
let gunTimer = 0;
let view = 0;
let viewCool = 0;
let flareCool = 0;
const GUN_RPS = 12;    // rounds per second off the belt

const steer = (f, aim, pull) => {
  const dx = aim.x - f.position.x;
  const dz = aim.z - f.position.z;
  const dy = aim.y - f.position.y;
  const range = Math.hypot(dx, dz);
  let off = Math.atan2(dx, dz) - f.heading;
  while (off > Math.PI) off -= Math.PI * 2;
  while (off < -Math.PI) off += Math.PI * 2;
  // Positive bank is a LEFT turn in this model, so the sign here is not
  // cosmetic: get it wrong and the bandit parks at six o'clock forever,
  // which is a stable equilibrium and looks disconcertingly like working.
  const bank = clamp(-off * 2.2, -1.1, 1.1);
  const climb = clamp(Math.atan2(dy, Math.max(range, 30)) + (pull || 0), -0.3, 0.6);
  f.control({
    roll: clamp((bank - f.bank) * 3.2, -1, 1),
    pitch: clamp((climb - f.pitch) * 3.4, -1, 1),
  });
  return Math.abs(off);
};

const nose = new Vector3();
const muzzle = new Vector3();
const aim = new Vector3();
let bogey = null;

game.onUpdate((t) => {
  const dt = t.delta;
  viewCool -= dt;
  flareCool -= dt;

  // ---- the stick
  let pitch = 0;
  let roll = 0;
  if (held('arrowup', 'w')) pitch += 1;
  if (held('arrowdown', 's')) pitch -= 1;
  if (held('arrowleft', 'a')) roll += 1;
  if (held('arrowright', 'd')) roll -= 1;
  if (touch) {
    roll += clamp(-(touch.x - touch.x0) / 120, -1, 1);
    pitch += clamp(-(touch.y - touch.y0) / 120, -1, 1);
  }
  if (held('shift')) flight.throttle = Math.min(1, flight.throttle + dt * 0.7);
  if (held('control')) flight.throttle = Math.max(0.15, flight.throttle - dt * 0.7);
  flight.control({ pitch, roll });
  flight.update(dt);
  for (const f of foes) if (f.alive) f.flight.update(dt);

  // ---- the bandits fly at me, and break when I am close behind them
  for (let i = 0; i < foes.length; i++) {
    const foe = foes[i];
    if (!foe.alive) {
      foe.respawn -= dt;
      if (foe.respawn <= 0) place(foe, i);
      continue;
    }
    // ARCADE, and deliberately so — this is the one place the scene is not
    // trying to be a simulation. Told to chase a lead point ahead of the
    // player, all three bandits did exactly that and parked permanently on
    // his six: flown headlessly it was sixty rounds fired, a bandit closing
    // to thirteen metres, and zero hits, because the target was never once
    // in front. That is not a dogfight, it is being hunted with no counter.
    //
    // So each bandit orbits a station AHEAD of the player and weaves on its
    // own phase. They cross the nose, they are shootable, and the fight is
    // winnable — which for a playground is the property that matters more
    // than a faithful pursuit curve.
    const ahead = flight.position.clone().add(forward(flight).multiplyScalar(230));
    const phase = t.elapsed * 0.35 + (i * Math.PI * 2) / foes.length;
    const aimAt = ahead.add(new Vector3(
      Math.cos(phase) * 110,
      20 + Math.sin(phase * 1.7) * 30,
      Math.sin(phase) * 110
    ));
    steer(foe.flight, aimAt, 0.05);
    foe.body.object.position.copy(foe.flight.position);
    foe.body.object.rotation.set(-foe.flight.pitch, foe.flight.heading, foe.flight.bank, 'YXZ');
    foe.body.update(dt, { throttle: foe.flight.throttle, speed: foe.flight.speed });
    foe.trail.push(foe.flight.position);
    foe.trail.update(dt);
    foe.health.update(dt);
    // Fly into the ground and it counts as a kill nobody scored.
    if (foe.flight.position.y < 6) kill(foe, foe.flight.position);
  }

  // ---- the airframe follows the flight model
  jet.object.position.copy(flight.position);
  jet.object.rotation.set(-flight.pitch, flight.heading, flight.bank, 'YXZ');
  jet.update(dt, { throttle: flight.throttle, speed: flight.speed });
  myTrail.push(flight.position);
  myTrail.update(dt);

  // ---- lock: nearest bandit in the seeker cone
  nose.copy(forward(flight)).normalize();
  bogey = null;
  let best = Infinity;
  for (const foe of foes) {
    if (!foe.alive) continue;
    const d = foe.flight.position.distanceTo(flight.position);
    if (d < best) { best = d; bogey = foe; }
  }
  lock.update(dt, { position: flight.position, direction: nose }, bogey ? bogey.target : null);
  seat.watch(bogey ? bogey.body.object : null);

  // ---- guns. The belt is the magazine: consume() or do not fire.
  if (reloading > 0) {
    reloading -= dt;
    if (reloading <= 0) { belt.setCount(belt.capacity); hud.caption('Belt reloaded'); }
  }
  const firing = (held(' ') || touchFire > 0) && reloading <= 0;
  gunTimer -= dt;
  if (firing && gunTimer <= 0) {
    if (belt.consume()) {
      gunTimer = 1 / GUN_RPS;
      muzzle.copy(flight.position).add(nose.clone().multiplyScalar(3.2));
      // The table's own muzzle velocity, plus the aircraft's — a shell fired
      // forward from something doing 78 m/s is not doing 1080, it is doing
      // 1158. This was scaled down by 0.16 at first, to "make the tracers
      // visible", and that fudge was the single worst thing in the scene:
      // at 173 m/s a shell takes 0.37 s to reach a bandit 64 m away and the
      // lead you have to pull is enormous. Flown headlessly it fired sixty
      // rounds at a target closing to THIRTEEN METRES and hit nothing. A
      // 30 mm really does arrive almost instantly, and using the number the
      // table already published is both more honest and better to play.
      aim.copy(nose).multiplyScalar(GUN.speed + flight.speed);
      guns.fire(muzzle, aim, { team: 'player' });
      fx.burst('sparks', muzzle);
      feel.shake(0.06);
      heat += 1;
    } else {
      reloading = RELOAD;
      hud.banner('BELT DRY — reloading');
    }
  }
  if (tap('r') && belt.count < belt.capacity && reloading <= 0) reloading = RELOAD;

  // ---- missiles. The rack is the magazine, and it EMPTIES on the model.
  if ((tap('f') || touchMissile) && lock.state === 'locked' && rack.count > 0) {
    if (rack.consume()) {
      const hp = jet.launchFrom(rack.capacity - rack.count - 1);
      const from = hp ? new Vector3(hp.position.x, hp.position.y, hp.position.z) : flight.position;
      missiles.fire(from, nose, bogey.target);
      feel.shake(0.3);
      hud.banner('FOX TWO');
    }
  }
  touchMissile = false;
  if (tap('x') && flareCool <= 0) {
    missiles.flare(flight.position);
    fx.burst('sparks', flight.position);
    flareCool = 0.35;
  }

  guns.update(dt);
  missiles.update(dt);
  fx.update(dt);
  mixer.update(dt);
  // The pilot wears the turn: g comes from the flight model, not from a
  // guess about how hard the scene looks like it is pulling.
  seat.update(dt, flight);
  feel.update(dt);

  // ---- camera
  if (tap('c')) view = (view + 1) % 3;
  const back = nose.clone().multiplyScalar(-1);
  if (view === 0) {
    game.camera.position.copy(flight.position).add(back.multiplyScalar(26)).add(new Vector3(0, 7, 0));
    game.camera.lookAt(flight.position.clone().add(nose.clone().multiplyScalar(60)));
  } else if (view === 1) {
    game.camera.position.copy(flight.position).add(nose.clone().multiplyScalar(2.4)).add(new Vector3(0, 1.5, 0));
    game.camera.lookAt(flight.position.clone().add(nose.clone().multiplyScalar(90)));
  } else {
    game.camera.position.copy(flight.position).add(new Vector3(52, 22, 0));
    game.camera.lookAt(flight.position);
  }
  feel.apply(game.camera);

  // ---- readouts
  const bar = (n, of) => '\\u2588'.repeat(Math.round((n / of) * 12)).padEnd(12, '\\u2591');
  hud.objective(
    'GUN ' + bar(belt.count, belt.capacity) + ' ' + String(belt.count).padStart(3) +
    '   AAM ' + '\\u25c6'.repeat(rack.count).padEnd(rack.capacity, '\\u25c7') +
    '   KILLS ' + kills
  );
  hud.prompt(
    (reloading > 0 ? 'RELOADING ' + reloading.toFixed(1) + 's' :
     lock.state === 'locked' ? 'LOCK \\u2014 FOX TWO READY' :
     lock.state === 'locking' ? 'LOCKING ' + Math.round(lock.progress * 100) + '%' : 'SEEKING') +
    '   ' + Math.round(flight.speed) + ' m/s   ' + Math.round(flight.position.y) + ' m' +
    '   ' + Math.round(seat.load * 10) / 10 + 'g'
  );
  hud.update(dt);
  tapped.clear();
});

window.dogfightDebug = () => ({
  // The claim: the shells flying are the shells the table describes.
  gun: { speed: GUN.speed, gravity: GUN.gravity, color: GUN.color, size: Number(GUN.size.toFixed(3)) },
  belt: belt.count,
  beltCapacity: belt.capacity,
  rack: rack.count,
  shotsInFlight: guns.active,
  missilesInFlight: missiles.alive,
  kills,
  lock: lock.state,
  alt: Number(flight.position.y.toFixed(1)),
  speed: Number(flight.speed.toFixed(1)),
  g: Number(seat.load.toFixed(2)),
  foesAlive: foes.filter((f) => f.alive).length,
  nearest: Number(Math.min(...foes.filter((f) => f.alive)
    .map((f) => f.flight.position.distanceTo(flight.position))).toFixed(0)),
  foeAlt: foes.map((f) => Number(f.flight.position.y.toFixed(0))),
  offBore: Number((() => {
    let b = null; let best = Infinity;
    for (const f of foes) { if (!f.alive) continue;
      const d = f.flight.position.distanceTo(flight.position);
      if (d < best) { best = d; b = f; } }
    if (!b) return 9;
    const to = b.flight.position.clone().sub(flight.position).normalize();
    return Math.acos(Math.max(-1, Math.min(1, to.dot(nose))));
  })().toFixed(2)),
  draws: game.renderer.info.render.calls,
});

game.start();`,
  },
  {
    id: 'mood',
    title: 'Mood: one walk, thirteen ways to carry it',
    group: 'Scale',
    code: `// THIRTEEN IDENTICAL BODIES, ONE WALK CYCLE, THIRTEEN MOODS.
//
// An emotion is not a pose. Sadness has no keyframe: it is eight degrees of
// head pitch, a chest that has stopped opening, shoulders forward, four
// centimetres off your height and a walk a third slower. Author it as a clip
// and you need a sad version of every clip in the library. Author it as a
// LAYER and every clip already in the library gets one for free.
//
// So every body here is playing the SAME walk. Nothing below picks a
// different animation for anybody. The differences you can see — and you can
// see them from here — are one additive layer riding on top.
//
// Two axes, not a list of feelings: valence (miserable…elated) and arousal
// (torpid…keyed up). Fear is not a third axis, it is low valence with high
// arousal, and what falls out is fear.
//
// Watch the front row. \`pace\` is published, not applied: the scene multiplies
// BOTH the travel speed and the clip's timeScale by it, because slowing a body
// without re-timing its gait slides the planted foot on every step.
import { Mesh, PlaneGeometry, Vector3 } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { createHumanoid, Locomotion, LookAt, Mannerisms, Mood, MOODS,
         MOOD_NAMES, measurePosture, OUTFITS } from 'anima3d';
import { Game, Hud } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('concrete', { seed: 4 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const hud = new Hud();

// ── One body per mood, and the SAME seed for all of them ────────────
// Same seed on purpose: any difference you can see is the layer, because
// there is nothing else left for it to be.
const COLS = 7;
const PITCH = 2.0;
const walkers = MOOD_NAMES.map((name, i) => {
  const rig = createHumanoid({ seed: 5, palette: OUTFITS.villager });
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = (col - (COLS - 1) / 2) * PITCH;
  const z = row * 3.4;
  rig.object.position.set(x, 0, z);
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  // The layer. Rise fast, fade slow — bad news lands in under a second and
  // takes a minute to leave.
  const mood = new Mood(rig, { ...MOODS[name], rise: 0.7, fall: 4 });
  // Mannerisms and gaze both take their orders from the mood rather than
  // reaching for it: a dejected body fidgets less and does not hold your eye.
  const tics = new Mannerisms(rig, loco, { seed: 20 + i });
  const gaze = new LookAt(rig);
  return { name, rig, loco, mood, tics, gaze, x, z, posture: measurePosture(rig, name) };
});

// ── The lap ─────────────────────────────────────────────────────────
// Everyone walks the same short beat, turns, and walks back. Identical
// distance, identical clip; the ones in a hurry simply get there first, which
// is what \`pace\` means.
const LEG = 5.5;
const BASE = 1.15;              // metres per second at pace 1
const velocity = new Vector3();
const look = new Vector3();
let t = 0;

game.onUpdate((tick) => {
  const dt = tick.delta;
  t += dt;

  for (const w of walkers) {
    w.mood.update(dt);
    const pace = w.mood.pace;
    const speed = BASE * pace;

    // Out and back on a shared clock, so the row stays a row.
    const cycle = (t * speed) / LEG;
    const leg = Math.floor(cycle) % 2;
    const along = (cycle % 1) * LEG;
    const z = w.z + (leg === 0 ? along : LEG - along);
    w.rig.object.position.set(w.x, 0, z);
    w.rig.object.rotation.y = leg === 0 ? 0 : Math.PI;

    // BOTH the travel speed and the clip. Passing the scaled velocity is what
    // keeps the stride matched to the ground — Locomotion derives its playback
    // rate from the speed it is handed, so a mood that slowed the body without
    // telling it would slide the foot on every step.
    velocity.set(0, 0, speed);
    w.loco.update(dt, velocity);

    // The mood drives the fidgeting and the gaze without either of them
    // knowing what a mood is.
    w.tics.rate = w.mood.mannerismRate;
    w.tics.update(dt);
    look.set(0, 1.5, w.z + LEG * 0.5 + 6);
    w.gaze.target = look;
    w.gaze.weight = w.mood.gazeAuthority;
    w.gaze.update(dt);
  }

  // Every twelve seconds the whole row swaps to one shared mood and back to
  // its own, so the RISE and the FADE are both visible on the same bodies.
  const phase = Math.floor(t / 12) % 3;
  for (const w of walkers) {
    if (phase === 1) w.mood.set('grieving');
    else if (phase === 2) w.mood.set('elated');
    else w.mood.set(MOODS[w.name]);
  }

  const shown = walkers[Math.floor(t / 3) % walkers.length];
  hud.objective(
    shown.name.toUpperCase() +
    '   valence ' + MOODS[shown.name].valence.toFixed(2) +
    '   arousal ' + MOODS[shown.name].arousal.toFixed(2) +
    '   pace ' + shown.mood.pace.toFixed(2)
  );
  hud.prompt(
    'head ' + shown.posture.headPitch.toFixed(3) + ' rad' +
    '   stature ' + (shown.posture.stature * 1000).toFixed(0) + ' mm' +
    '   gaze ' + shown.mood.gazeAuthority.toFixed(2) +
    (phase === 1 ? '   \\u2014 ALL GRIEVING' : phase === 2 ? '   \\u2014 ALL ELATED' : '')
  );
  hud.update(dt);
});

game.camera.position.set(0, 6.2, -9.5);
game.camera.lookAt(0, 1.1, 4.2);

window.moodDebug = () => ({
  moods: walkers.length,
  // The scene's OWN clock and phase. A probe that checks the shared-mood
  // swap against wall time is guessing: the two are not the same number, and
  // a swap that never fired looks exactly like one read at the wrong moment.
  clock: Number(t.toFixed(1)),
  phase: Math.floor(t / 12) % 3,
  // Monotone means AT FIXED AROUSAL. These thirteen differ on both axes, so
  // sorting them by valence and expecting an ordered head pitch is a
  // comparison that was never controlled — arousal lifts the head too.
  sweep: [-1, -0.5, 0, 0.5, 1].map((v) => {
    const r = measurePosture(walkers[0].rig, { valence: v, arousal: 0.5 });
    return { v, head: Number(r.headPitch.toFixed(3)), stature: Number((r.stature * 1000).toFixed(1)) };
  }),
  // The claim the scene makes, in numbers: same body, same clip, and the
  // posture still orders itself by valence.
  byValence: walkers
    .slice()
    .sort((a, b) => MOODS[a.name].valence - MOODS[b.name].valence)
    .map((w) => ({
      name: w.name,
      head: Number(w.posture.headPitch.toFixed(3)),
      stature: Number((w.posture.stature * 1000).toFixed(1)),
      pace: Number(w.mood.pace.toFixed(2)),
    })),
  // Live, not settled — this is what the layer is doing right now.
  live: walkers.map((w) => Number(w.mood.valence.toFixed(2))),
  draws: game.renderer.info.render.calls,
});

game.start();`,
  },
  {
    id: 'gym',
    title: 'The gym: eight reps, and the eighth is not the first',
    group: 'Scale',
    code: `// TWELVE LIFTERS, TWELVE MOVEMENTS, AND A LINE BEHIND EVERY BAR.
//
// Everything rhythmic in this library before now is a LOOP: a clip goes to the
// mixer and rep forty is bit-for-bit rep one. That is exactly wrong for
// lifting, and it is why a gym built out of looped clips reads as a
// screensaver. Two properties are doing all the work here and neither survives
// being baked:
//
//   THE REP IS ASYMMETRIC   you lower a bar in two seconds and drive it up in
//                           one. A symmetric rep is what a sine gives you free,
//                           and it is the instant tell of a fake gym animation.
//   THE REP DECAYS          rep eight is slower, shallower and shakier than rep
//                           one, and eventually the bar stops moving.
//
// Neither is visible in a still frame, so this scene draws the thing that IS:
// the white line trailing each bar is where it has actually been, and the thin
// grey post beside it is the middle of that lifter's foot. A loaded bar has to
// stay over that post or the lifter falls over — which is why the torso angle
// is SOLVED here rather than authored, and why the back squat and the front
// squat come out at different angles from identical legs.
//
// Watch the traces thicken outward as the sets go on. That is the form drift:
// rep one is over mid-foot to the micron, and by rep eight it is 20 mm out.
//
// Station 1 is loaded to 93% of a maximum. It will not finish.
import { BoxGeometry, BufferGeometry, BufferAttribute, CylinderGeometry, Group, Line,
         LineBasicMaterial, Mesh, MeshStandardMaterial, PlaneGeometry,
         SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { createHumanoid, LIFTS, LIFT_NAMES, Lifting, OUTFITS } from 'anima3d';
import { Game, Hud } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('concrete', { seed: 9 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const hud = new Hud();

// ── The iron ────────────────────────────────────────────────────────
// A \`Holdable\` is a SHAPE, not a package: \`{ object }\` and nothing else, which
// is all \`Lifting.hold\` ever looks at. A SCENA barbell would drop in here
// unchanged; these are three primitives so the example imports nothing extra.
const STEEL = new MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.85, roughness: 0.35 });
const RUBBER = new MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.9 });

function makeIron(kind, half) {
  const g = new Group();
  if (kind === 'kettlebell') {
    const bell = new Mesh(new SphereGeometry(0.085, 14, 10), RUBBER);
    bell.position.y = -0.09;
    const handle = new Mesh(new TorusGeometry(0.055, 0.012, 8, 16), STEEL);
    g.add(bell, handle);
    return g;
  }
  if (kind === 'dumbbells') {
    for (const s of [-1, 1]) {
      const shaft = new Mesh(new CylinderGeometry(0.014, 0.014, 0.15, 8), STEEL);
      shaft.rotation.z = Math.PI / 2;
      shaft.position.x = s * half;
      g.add(shaft);
      for (const e of [-0.07, 0.07]) {
        const head = new Mesh(new CylinderGeometry(0.055, 0.055, 0.05, 12), RUBBER);
        head.rotation.z = Math.PI / 2;
        head.position.set(s * half + e, 0, 0);
        g.add(head);
      }
    }
    return g;
  }
  // A barbell: the origin is the middle of the bar and the length runs along X,
  // which is the contract \`Lifting.hold\` documents.
  const bar = new Mesh(new CylinderGeometry(0.014, 0.014, half * 2.5, 10), STEEL);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  for (const s of [-1, 1]) {
    for (let p = 0; p < 3; p++) {
      const plate = new Mesh(new CylinderGeometry(0.22, 0.22, 0.035, 18), RUBBER);
      plate.rotation.z = Math.PI / 2;
      plate.position.x = s * (half * 1.06 + p * 0.04);
      g.add(plate);
    }
  }
  return g;
}

// ── Twelve stations, all in PROFILE ─────────────────────────────────
// A bar path lives in the sagittal plane, which is why every video a lifter
// ever films of themselves is shot from the side. So every rig here is turned
// side-on to the camera: the trace behind each bar is then a real bar-path
// diagram rather than a line seen end-on.
const FADE = 0.4;      // seconds to walk into the lift
const REST = 2.4;      // seconds of breather between sets
const COLS = 4;
const PITCH = 2.1;
const ROW = 2.5;
const TRACE = 1400;

const stations = LIFT_NAMES.map((name, i) => {
  const spec = LIFTS[name];
  const rig = createHumanoid({ seed: 3 + i, palette: OUTFITS.villager });
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = (col - (COLS - 1) / 2) * PITCH;
  const z = row * ROW;
  rig.object.position.set(x, 0, z);
  rig.object.rotation.y = Math.PI / 2;   // side-on: the lean and the bar read
  scene.add(rig.object);
  rig.object.updateMatrixWorld(true);

  // Station 1 is loaded to 93% of a maximum and given twelve reps to do.
  // Epley never offered twelve at that weight, so it will stall — the whole
  // difference between a set and a loop.
  const heavy = i === 0;
  const set = new Lifting(rig, name, {
    load: spec.oneRepMax * (heavy ? 0.93 : 0.72),
    reps: heavy ? 12 : 8,
    seed: 4 + i * 3,
    fade: FADE,
  });
  const half = rig.height * spec.grip;
  const iron = makeIron(spec.implement, half);
  if (spec.implement !== 'bodyweight') set.hold({ object: iron });

  // One frame before anything reads a position. \`loadPoint\` maps out of the
  // rig's world matrix, and a rig that has never been posed has neither a pose
  // nor a matrix — the first version hung every bar path off the world origin
  // and drew twelve white spokes across the floor.
  set.update(1e-3);

  // A pull-up bar is not held — it holds YOU. Bolted to the world, and the
  // gate's job is proving the hands never leave it.
  if (spec.base === 'bar') {
    const fixed = new Mesh(new CylinderGeometry(0.022, 0.022, half * 2.6, 10), STEEL);
    fixed.rotation.z = Math.PI / 2;
    fixed.position.copy(set.loadPoint(new Vector3()));
    scene.add(fixed);
  }

  // A bench press needs a bench. That is a SCENA-shaped problem — furniture,
  // not motion — but a lifter lying flat in mid-air reads as a bug, so the
  // example supplies one the same way a game would.
  if (name === 'benchPress') {
    const pad = new Mesh(new BoxGeometry(0.32, 0.09, 1.25),
                         new MeshStandardMaterial({ color: 0x2b3038, roughness: 0.8 }));
    pad.position.set(x - 0.06, 0.26 * rig.height - 0.1, z);
    pad.rotation.y = Math.PI / 2;
    const leg = new Mesh(new BoxGeometry(0.1, 0.26 * rig.height - 0.15, 0.9), STEEL);
    leg.position.set(x, (0.26 * rig.height - 0.15) / 2, z);
    leg.rotation.y = Math.PI / 2;
    scene.add(pad, leg);
  }

  // The plumb post: the middle of this lifter's foot, straight up. The bar is
  // supposed to stay on it. Placed along the rig's OWN forward, because these
  // are turned side-on and "forward" is not the world's +Z any more.
  const fwd = new Vector3(0, 0, 1).applyQuaternion(rig.object.quaternion);
  const post = new Mesh(new CylinderGeometry(0.005, 0.005, 1.9, 5),
                        new MeshStandardMaterial({ color: 0x39424f, roughness: 1 }));
  post.position.set(x + fwd.x * 0.026 * rig.height, 0.95, z + fwd.z * 0.026 * rig.height);
  scene.add(post);

  // The bar path itself, as a line that grows behind the load.
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(TRACE * 3), 3));
  geo.setDrawRange(0, 0);
  // Amber, not white: a bar path drawn in white over grey concrete under a
  // blue sky is a line nobody can see, which for the one thing this scene
  // exists to show is not a small problem.
  const line = new Line(geo, new LineBasicMaterial({ color: 0xffb020 }));
  line.frustumCulled = false;
  scene.add(line);

  return { name, spec, rig, set, iron, line, geo, i, n: 0, x, z, half, heavy, fwd, worst: 0, since: 0, resting: 0 };
});

const here = new Vector3();
const plumb = new Vector3();
const other = new Vector3();
let t = 0;
let done = 0;

/** Put a station back under the bar for another set. */
function reset(s) {
  s.set = new Lifting(s.rig, s.name, {
    load: LIFTS[s.name].oneRepMax * (s.heavy ? 0.93 : 0.72),
    reps: s.heavy ? 12 : 8,
    seed: 4 + s.i * 3,
    fade: FADE,
  });
  if (s.spec.implement !== 'bodyweight') s.set.hold({ object: s.iron });
  s.n = 0;
  s.geo.setDrawRange(0, 0);
  s.worst = 0;
  s.since = 0;
}

game.onUpdate((tick) => {
  const dt = tick.delta;
  t += dt;

  for (const s of stations) {
    s.set.update(dt);
    s.since += dt;
    s.set.loadPoint(here);

    // Nothing is measured or traced until the lifter is actually under the
    // bar. During the fade the pose is part lift and part whatever the body
    // was doing before, and the bar is 60 mm off a plumb line it has not
    // reached yet — a number about the blend, not about the lift.
    const under = s.since > FADE * 1.6;

    // Everything below is READING the controller, never steering it. The trace
    // is the load's own world position out of the transform hierarchy — the
    // same place \`measureBarPath\` takes its numbers from.
    if (under && s.n < TRACE) {
      const a = s.geo.attributes.position;
      a.setXYZ(s.n, here.x, here.y, here.z);
      s.n++;
      a.needsUpdate = true;
      s.geo.setDrawRange(0, s.n);
    }
    if (under && s.spec.plumb === 'midfoot') {
      // Both feet, so the stance width cancels, and PROJECTED onto the rig's
      // own forward — the deviation that matters is fore-and-aft, and reading
      // it off the world's Z axis reports the row number for anyone not stood
      // at the origin facing north.
      s.rig.bones.LeftFoot.getWorldPosition(plumb);
      s.rig.bones.RightFoot.getWorldPosition(other);
      plumb.add(other).multiplyScalar(0.5).addScaledVector(s.fwd, 0.026 * s.rig.height);
      s.worst = Math.max(s.worst, Math.abs(here.clone().sub(plumb).dot(s.fwd)));
    }
    // Bodyweight movements have nothing in the hands; everything else has its
    // iron parented to the rig by \`hold\`, so it is already where it should be.
    if (s.spec.implement !== 'bodyweight' && !s.iron.parent) scene.add(s.iron);

    // A finished set racks the bar, hands the body back, and after a breather
    // the lifter goes again — a gym is a place where people do more than one
    // set, and \`release()\` is what makes the body available in between.
    if (s.set.done) {
      if (s.resting === 0) {
        s.set.release();
        done++;
      }
      s.resting += dt;
      if (s.resting > REST) {
        s.resting = 0;
        reset(s);
      }
    }
  }

  const shown = stations[Math.floor(t / 4) % stations.length];
  hud.objective(
    shown.spec.label.toUpperCase() +
    '   rep ' + shown.set.reps +
    '   fatigue ' + (shown.set.fatigue * 100).toFixed(0) + '%' +
    '   ' + shown.set.repsLeft.toFixed(1) + ' left' +
    (shown.set.failed ? '   — FAILED' : '')
  );
  hud.prompt(
    'bar off mid-foot ' + (shown.worst * 1000).toFixed(1) + ' mm' +
    '   grind ' + shown.set.grind.toFixed(2) +
    '   tempo ' + LIFTS[shown.name].eccentric.toFixed(1) + 's down / ' +
    LIFTS[shown.name].concentric.toFixed(1) + 's up' +
    '   — station 1 is at 93% of a max'
  );
  hud.update(dt);
});

game.camera.position.set(0, 2.9, -7.3);
game.camera.lookAt(0, 1.0, 1.9);

window.liftingDebug = () => ({
  stations: stations.length,
  // The scene's OWN clock. A probe that checks rep counts against wall time is
  // guessing — headless SwiftShader runs this at roughly a third of real time,
  // and a set that never started looks exactly like one read too early.
  clock: Number(t.toFixed(1)),
  reps: stations.map((s) => s.set.reps),
  failed: stations.filter((s) => s.set.failed).map((s) => s.name),
  // Millimetres off the plumb line, live. Rep one is zero by construction; a
  // number growing here IS the fatigue reaching the bar.
  plumb: stations
    .filter((s) => s.spec.plumb === 'midfoot')
    .map((s) => ({ name: s.name, mm: Number((s.worst * 1000).toFixed(1)) })),
  // Where the bar path actually starts, so a trace hung off the world origin
  // shows up as a number rather than as twelve white spokes in a screenshot.
  origin: stations.map((s) => Number(
    Math.hypot(s.geo.attributes.position.getX(0) - s.x,
               s.geo.attributes.position.getZ(0) - s.z).toFixed(3))),
  traced: stations.map((s) => s.n),
  sets: done,
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'dining',
    title: 'The table: eight utensils, one body',
    group: 'Scale',
    code: `// EIGHT DINERS, EIGHT UTENSILS, ONE BODY.
//
// Every character here is the same seed. Nothing below picks a different
// animation for anybody: they are all running one controller, and the only
// thing that differs is what is in their hand. If they look like they are
// eating differently — and they do — that is the utensil doing it.
//
// Three of those differences are physics rather than taste:
//
//   THE SPOON STAYS LEVEL   soup does not survive a wrist that rotates on the
//                           way up, which is why the elbow comes up. Measured:
//                           a spoon holds 0.000 rad off level where a fork
//                           sits at 0.350 — twenty degrees.
//   THE GLASS GOES FURTHER  a vessel tips by atan(h(1-fill)/r), so the last
//                           sip goes half a radian past the first. Watch the
//                           near-empty cups at the far end of the table.
//   THE PLATE EMPTIES       food is Countable, so the meal ENDS. The stacks
//                           in front of each diner are the count, and when
//                           they are gone the cutlery goes down.
//
// The white line under each chin is the plumb from the mouth socket to the
// business end of the utensil — when a diner is mid-bite it has no length,
// which is the whole of what \`npm run dining\` measures.
import { BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Group,
         Line, LineBasicMaterial, Mesh, MeshStandardMaterial, PlaneGeometry,
         Quaternion, SphereGeometry, Vector3 } from 'three';
import { applyFog, createDiningTable, createLightingRig, createSky,
         createSurface, PALETTES } from 'scena3d';
import { createHumanoid, Dining, getSocket, OUTFITS, servings,
         UTENSILS, UTENSIL_NAMES } from 'anima3d';
import { Game, Hud } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(120, 120), createSurface('floortile', { seed: 6 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const hud = new Hud();

const TABLE = 0.76;          // metres — where the top of the table is
const CHAIR = 0.44;          // …and the seat

// ── The room ────────────────────────────────────────────────────────
// SCENA's table publishes its own seats as \`slots\` — the same
// \`InteractionSlot\` shape \`Interaction.use()\` takes. So nobody here decides
// where eight people sit: the furniture already knows, and ANIMA reads it.
const table = createDiningTable({ seats: 8, style: 'trestle', seed: 3, palette });
table.object.position.set(0, 0, 3.2);
scene.add(table.object);
table.object.updateMatrixWorld(true);
const seats = table.slots.filter((s) => s.kind === 'seat');

const CROCKERY = new MeshStandardMaterial({ color: 0xece7de, roughness: 0.55 });
const FOOD = new MeshStandardMaterial({ color: 0xc8763a, roughness: 0.85 });
const STEEL = new MeshStandardMaterial({ color: 0x9aa1ab, metalness: 0.8, roughness: 0.3 });
const GLASS = new MeshStandardMaterial({
  color: 0x8fd0e8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55,
});

/** A place setting: something to eat off, and something to eat WITH. */
function makeSetting(spec) {
  const g = new Group();
  if (spec.vessel) {
    // A glass, and the liquid in it — which is the count, made visible.
    const cup = new Mesh(
      new CylinderGeometry(spec.vessel.radius, spec.vessel.radius * 0.85, spec.vessel.height, 14, 1, true),
      GLASS
    );
    cup.position.y = spec.vessel.height / 2;
    const drink = new Mesh(
      new CylinderGeometry(spec.vessel.radius * 0.94, spec.vessel.radius * 0.8, spec.vessel.height * 0.9, 14),
      FOOD
    );
    g.add(cup, drink);
    return { object: g, hold: g, level: drink, height: spec.vessel.height };
  }
  const plate = new Mesh(new CylinderGeometry(0.1, 0.085, 0.02, 18), CROCKERY);
  const stack = new Group();
  stack.position.y = 0.02;
  g.add(plate, stack);
  // A tool, held handle-up so it reads from across the table.
  const tool = new Group();
  const handle = new Mesh(new CylinderGeometry(0.005, 0.005, 0.11, 6), STEEL);
  handle.rotation.z = Math.PI / 2;
  const head = new Mesh(
    spec.label === 'Spoon' ? new SphereGeometry(0.018, 10, 6) : new BoxGeometry(0.03, 0.004, 0.022),
    STEEL
  );
  head.position.x = 0.062;
  if (spec.label === 'Spoon') head.scale.set(1, 0.45, 0.8);
  tool.add(handle, head);
  return { object: g, hold: tool, stack };
}

// ── Eight diners, one seed ──────────────────────────────────────────
const diners = UTENSIL_NAMES.map((name, i) => {
  const spec = UTENSILS[name];
  const anchor = seats[i % seats.length].anchor;
  const at = anchor.getWorldPosition(new Vector3());
  const facing = new Vector3(0, 0, 1).applyQuaternion(anchor.getWorldQuaternion(new Quaternion()));
  const x = at.x;
  const z = at.z;

  const rig = createHumanoid({ seed: 9, palette: OUTFITS.villager });
  rig.object.position.set(x, 0, z);
  rig.object.quaternion.copy(anchor.getWorldQuaternion(new Quaternion()));
  scene.add(rig.object);
  seat(rig);
  rig.object.updateMatrixWorld(true);

  // The place setting goes on the table, in front of THIS diner — which is
  // the seat's own forward, whichever side of the board they are on.
  const set = makeSetting(spec);
  const plate = set.object;
  plate.position.set(x + facing.x * 0.3, TABLE, z + facing.z * 0.3);
  scene.add(plate);
  scene.add(set.hold);

  const helpings = spec.vessel ? 5 : 6;
  const food = servings(helpings);
  const crumbs = [];
  if (set.stack) {
    for (let k = 0; k < helpings; k++) {
      const bite = new Mesh(new BoxGeometry(0.035, 0.018, 0.035), FOOD);
      const a = (k / helpings) * Math.PI * 2;
      bite.position.set(Math.cos(a) * 0.045, 0.01 + (k % 2) * 0.016, Math.sin(a) * 0.045);
      set.stack.add(bite);
      crumbs.push(bite);
    }
  }

  const meal = new Dining(rig, {
    utensil: name,
    plate,
    food,
    held: set.hold,
    seed: 5 + i * 3,
    fade: 0.5,
    tempo: 0.9 + (i % 3) * 0.12,
  });

  // The plate emptying, made visible: a helping disappears with each mouthful,
  // and a glass's liquid drops. Everything here READS the meal — nothing
  // steers it.
  meal.onBite((e) => {
    if (crumbs.length) {
      const gone = crumbs[helpings - 1 - Math.min(helpings - 1, e.index - 1)];
      if (gone) gone.visible = false;
    }
    if (set.level) {
      set.level.scale.y = Math.max(0.03, e.left);
      set.level.position.y = (set.height * 0.9 * set.level.scale.y) / 2 + 0.005;
    }
  });

  // The plumb: mouth socket to the business end. It has no length at the bite.
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
  const line = new Line(geo, new LineBasicMaterial({ color: 0xf4f7ff }));
  line.frustumCulled = false;
  scene.add(line);

  return { name, spec, rig, meal, food, helpings, crumbs, set, line, geo, x, z, worst: 0 };
});

/**
 * A seated pose, by hand.
 *
 * \`Dining\` never touches the hips or the legs — that is the whole reason a sit
 * and a meal can share one body — so the chair is somebody else's problem, and
 * here "somebody else" is six lines.
 */
function seat(rig) {
  const h = rig.height;
  rig.bones.Hips.position.y = CHAIR + 0.045 * h;
  rig.bones.Hips.rotation.x = 0.06;
  for (const s of ['Left', 'Right']) {
    const side = s === 'Left' ? 1 : -1;
    rig.bones[\`\${s}UpLeg\`].rotation.set(-1.44, 0, side * 0.1);
    rig.bones[\`\${s}Leg\`].rotation.x = 1.42;
    rig.bones[\`\${s}Foot\`].rotation.x = 0.02;
  }
}

const tip = new Vector3();
const lips = new Vector3();
let t = 0;

game.onUpdate((tick) => {
  const dt = tick.delta;
  t += dt;

  for (const d of diners) {
    d.meal.update(dt);

    // The plumb, straight off the transforms — the same two points the gate
    // takes its headline number from.
    const hand = d.rig.bones.RightHand;
    tip.set(d.spec.tip[0] * d.rig.height, d.spec.tip[1] * d.rig.height, d.spec.tip[2] * d.rig.height);
    hand.localToWorld(tip);
    getSocket(d.rig, 'mouth').getWorldPosition(lips);
    const a = d.geo.attributes.position;
    a.setXYZ(0, lips.x, lips.y, lips.z);
    a.setXYZ(1, tip.x, tip.y, tip.z);
    a.needsUpdate = true;
    if (d.meal.phase === 'bite') d.worst = Math.max(d.worst, d.meal.mouthGap);

    // Cleared, and served again — a table where everyone finishes at once and
    // then sits there forever is not a table.
    if (d.meal.done && !d.clearing) {
      d.clearing = t + 3;
      d.meal.release();
    }
    if (d.clearing && t > d.clearing) {
      d.clearing = 0;
      d.food.setCount(d.helpings);
      for (const c of d.crumbs) c.visible = true;
      if (d.set.level) {
        d.set.level.scale.y = 1;
        d.set.level.position.y = (d.set.height * 0.9) / 2 + 0.005;
      }
      d.meal = new Dining(d.rig, {
        utensil: d.name,
        plate: d.set.object,
        food: d.food,
        held: d.set.hold,
        seed: 5,
        fade: 0.5,
      });
      d.meal.onBite((e) => {
        const gone = d.crumbs[d.helpings - 1 - Math.min(d.helpings - 1, e.index - 1)];
        if (gone) gone.visible = false;
        if (d.set.level) {
          d.set.level.scale.y = Math.max(0.03, e.left);
          d.set.level.position.y = (d.set.height * 0.9 * d.set.level.scale.y) / 2 + 0.005;
        }
      });
    }
  }

  const shown = diners[Math.floor(t / 4) % diners.length];
  hud.objective(
    shown.spec.label.toUpperCase() +
    '   mouthful ' + shown.meal.bites +
    '   ' + Math.round(shown.meal.left * 100) + '% left' +
    '   ' + shown.meal.phase
  );
  hud.prompt(
    'to the mouth ' + (shown.worst * 1000).toFixed(1) + ' mm' +
    '   off level ' + shown.meal.spill.toFixed(3) + ' rad' +
    '   tilt ' + shown.meal.tilt.toFixed(2) +
    '   lean ' + shown.meal.lean.toFixed(2) +
    (shown.meal.canSpeak ? '' : '   — mouth full')
  );
  hud.update(dt);
});

// Down the length of the board, so everybody is in profile: the arm path and
// the head coming to meet the food both live in the sagittal plane, which is
// the plane a side view shows and a head-on view hides.
game.camera.position.set(-3.7, 1.78, 3.2);
game.camera.lookAt(0.4, 1.02, 3.2);

window.diningDebug = () => ({
  diners: diners.length,
  // The scene's OWN clock. Headless SwiftShader runs this at roughly a third
  // of real time, and a meal that has not started looks exactly like one that
  // never will.
  clock: Number(t.toFixed(1)),
  bites: diners.map((d) => d.meal.bites),
  left: diners.map((d) => Number(d.meal.left.toFixed(2))),
  // Millimetres from the utensil to the lips at the closest point of a bite.
  // Zero is the answer; anything else is the tell this module exists for.
  mouth: diners.map((d) => ({ name: d.name, mm: Number((d.worst * 1000).toFixed(1)) })),
  // The claim the scene is named for: one body, eight utensils, and the spoon
  // holding its load flat while the fork does not.
  spill: diners.map((d) => ({ name: d.name, rad: Number(d.meal.spill.toFixed(3)) })),
  tilt: diners.filter((d) => d.spec.vessel).map((d) => ({
    name: d.name, left: Number(d.meal.left.toFixed(2)), rad: Number(d.meal.tilt.toFixed(2)),
  })),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'archery',
    title: 'The range: five bows, and the anchor decides the group',
    group: 'Scale',
    code: `// FIVE ARCHERS, FIVE BOWS, AND THE ARROWS ACTUALLY FLY.
//
// This is the trilogy's loop closed in one scene. ANIMA decides where the
// nock is and how fast the arrow leaves; GAMA flies it and tells you what it
// hit; the target is a prop. Nothing imports anything.
//
// Nothing about the flight was chosen:
//
//   THE SPEED   comes out of the bow's stored energy — peak x draw x storage
//               x efficiency, then half-m-v-squared rearranged. A longbow
//               lands on 54.9 m/s, and SCENA's ammunition table independently
//               says an arrow does 55.
//   THE ANGLE   comes out of the ballistic solution. Watch the far butts:
//               the bow arm visibly rises for them and does not for the near
//               ones, and past v-squared-over-g there is no angle at all.
//   THE GROUP   comes out of the anchor. Millimetres of wander at the face
//               become centimetres of miss at the target, and the number you
//               can turn is \`skill\` — which is what the row is showing.
//
// Left to right the archers go from a novice to an Olympian, with the same
// bodies and the same bows. The white marks on each butt are where their
// arrows went.
import { BufferAttribute, BufferGeometry, CylinderGeometry, Group, Line,
         LineBasicMaterial, Mesh, MeshStandardMaterial, PlaneGeometry,
         TorusGeometry, Vector3 } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { Archery, BOWS, BOW_STYLES, createHumanoid, OUTFITS,
         quiverOf } from 'anima3d';
import { Game, Hud, Projectiles } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(400, 400), createSurface('grass', { seed: 4 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const hud = new Hud();

// GAMA flies the arrows. It is handed a launch and it does the rest — the
// same gravity SCENA puts on an arrow.
const shots = new Projectiles({ capacity: 220, gravity: 9.81, floor: 0 });
scene.add(shots.mesh);

const GOLD = new MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.8 });
const STRAW = new MeshStandardMaterial({ color: 0xd9c48f, roughness: 0.95 });
const RING = new MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 });
const HIT = new MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.6 });
const WOOD = new MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });

const LANE = 2.6;
const RANGE = 22;

/** A boss: straw, three rings, and somewhere to stick arrows. */
function makeButt(x) {
  const g = new Group();
  const face = new Mesh(new CylinderGeometry(0.62, 0.62, 0.1, 22), STRAW);
  face.rotation.x = Math.PI / 2;
  face.position.y = 1.2;
  g.add(face);
  for (const [r, m] of [[0.4, RING], [0.2, RING], [0.09, GOLD]]) {
    const ring = new Mesh(new TorusGeometry(r, 0.012, 6, 24), m);
    ring.position.set(0, 1.2, -0.055);
    g.add(ring);
  }
  const leg = new Mesh(new CylinderGeometry(0.05, 0.05, 1.2, 8), WOOD);
  leg.position.y = 0.6;
  g.add(leg);
  g.position.set(x, 0, RANGE);
  scene.add(g);
  return g;
}

// ── Five archers, five bows, five skills ────────────────────────────
const archers = BOW_STYLES.map((style, i) => {
  const spec = BOWS[style];
  const x = (i - 2) * LANE;
  const butt = makeButt(x);

  const rig = createHumanoid({ seed: 6 + i * 4, palette: OUTFITS.villager });
  rig.object.position.set(x, 0, 0);
  scene.add(rig.object);

  // The skill ramp, left to right. One number, and it decides the group.
  const skill = 0.3 + i * 0.17;
  const arrows = quiverOf(10);
  const bow = new Archery(rig, {
    style, target: butt, arrows, skill,
    seed: 3 + i * 5, fade: 0.5, tempo: 1,
  });

  // The line the bow arm is making, so the elevation reads from here.
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
  const aim = new Line(geo, new LineBasicMaterial({ color: 0xffd889 }));
  aim.frustumCulled = false;
  scene.add(aim);

  const marks = [];
  const record = new Group();
  record.position.set(x, 0, RANGE - 0.06);
  scene.add(record);

  // ANIMA publishes the launch; GAMA takes it from here.
  bow.onLoose((s) => {
    shots.fire(s.from, s.velocity, { life: 6, radius: 0.03 });
    // …and where it would land, marked on the face. The lateral miss is the
    // anchor error over the draw, times the range — which is \`groupAt\`, and
    // which is the whole of why an anchor point exists.
    const dot = new Mesh(new CylinderGeometry(0.028, 0.028, 0.02, 8), HIT);
    dot.rotation.x = Math.PI / 2;
    const across = new Vector3(1, 0, 0).dot(s.velocity.clone().normalize()) * RANGE;
    const drop = (s.velocity.y / s.speed) * RANGE - 0.5 * 9.81 * (RANGE / s.speed) ** 2;
    dot.position.set(across, 1.2 + drop * 0.5, 0);
    record.add(dot);
    marks.push(dot);
    if (marks.length > 10) marks.shift().removeFromParent();
  });

  return { style, spec, rig, bow, arrows, butt, aim, geo, x, skill, marks, record };
});

const from = new Vector3();
const to = new Vector3();
let t = 0;
let loosed = 0;
for (const a of archers) a.bow.onLoose(() => loosed++);

game.onUpdate((tick) => {
  const dt = tick.delta;
  t += dt;
  shots.update(dt);

  for (const a of archers) {
    a.bow.update(dt);

    // The aim line: bow hand out to where the arrow is going. It rises for a
    // far butt because the ballistic solution says it has to.
    a.rig.bones[a.style === 'crossbow' ? 'RightHand' : 'LeftHand'].getWorldPosition(from);
    to.copy(from).add(new Vector3(0, Math.sin(a.bow.elevation), Math.cos(a.bow.elevation)).multiplyScalar(2.2));
    const p = a.geo.attributes.position;
    p.setXYZ(0, from.x, from.y, from.z);
    p.setXYZ(1, to.x, to.y, to.z);
    p.needsUpdate = true;

    // A quiver that empties gets refilled — an archery range is a place where
    // people shoot more than ten arrows.
    if (a.bow.done && !a.resting) a.resting = t + 2.5;
    if (a.resting && t > a.resting) {
      a.resting = 0;
      a.arrows.setCount(10);
      for (const m of a.marks) m.removeFromParent();
      a.marks.length = 0;
      a.bow.release();
      a.bow = new Archery(a.rig, {
        style: a.style, target: a.butt, arrows: a.arrows, skill: a.skill,
        seed: 3, fade: 0.5,
      });
      a.bow.onLoose((s) => {
        shots.fire(s.from, s.velocity, { life: 6, radius: 0.03 });
        loosed++;
        const dot = new Mesh(new CylinderGeometry(0.028, 0.028, 0.02, 8), HIT);
        dot.rotation.x = Math.PI / 2;
        const across = new Vector3(1, 0, 0).dot(s.velocity.clone().normalize()) * RANGE;
        dot.position.set(across, 1.2, 0);
        a.record.add(dot);
        a.marks.push(dot);
        if (a.marks.length > 10) a.marks.shift().removeFromParent();
      });
    }
  }

  const shown = archers[Math.floor(t / 4) % archers.length];
  hud.objective(
    shown.spec.label.toUpperCase() +
    '   skill ' + shown.skill.toFixed(2) +
    '   arrow ' + shown.bow.shots +
    '   ' + shown.bow.phase
  );
  hud.prompt(
    shown.bow.speed.toFixed(1) + ' m/s from ' + shown.spec.peak + ' N' +
    '   holding ' + shown.bow.hold.toFixed(0) + ' N' +
    '   elevation ' + shown.bow.elevation.toFixed(3) +
    '   predicted group ' + (shown.bow.spread * 100).toFixed(0) + ' cm' +
    '   reach ' + shown.bow.reach.toFixed(0) + ' m'
  );
  hud.update(dt);
});

// Behind the shooting line and above it, so all five lanes and all five
// butts are in one frame — the elevation difference and the groups are both
// comparisons, and a comparison you cannot see both halves of is not one.
game.camera.position.set(0, 4.6, -7.4);
game.camera.lookAt(0, 1.5, 13);

window.archeryDebug = () => ({
  archers: archers.length,
  // The scene's OWN clock. Headless SwiftShader runs this at about a third of
  // real time, and a range where nobody has shot yet looks exactly like one
  // where nobody ever will.
  clock: Number(t.toFixed(1)),
  loosed,
  inFlight: shots.active,
  arrows: archers.map((a) => a.bow.shots),
  // One body, one bow each, and one number between them. If these do not
  // order by skill, the thing the scene is named for is not happening.
  group: archers.map((a) => ({
    bow: a.style,
    skill: Number(a.skill.toFixed(2)),
    speed: Number(a.bow.speed.toFixed(1)),
    holdN: Number(a.bow.hold.toFixed(0)),
    predictedCm: Number((a.bow.spread * 100).toFixed(1)),
  })),
  marks: archers.map((a) => a.marks.length),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'striking',
    title: 'The bag room: the mass is the body behind it',
    group: 'Scale',
    code: `// SIX FIGHTERS, FOURTEEN STRIKES, AND NOBODY TYPED A DAMAGE NUMBER.
//
// Every figure over every head is MEASURED off the body that threw it while
// the strike plays. The mass is Dempster's segment fractions summed along the
// strike line; the speed is the striking surface's own travel; the impulse is
// the product. ANIMA publishes it and something upstream decides what it
// costs — here, how hard the bag swings.
//
// Three things to watch, all consequences rather than settings:
//
//   THE CROSS OUTWEIGHS THE JAB by about 1.9x, because half a body drives one
//   and nothing drives the other. Turning the shoulders is not what does it —
//   a trunk rotating about its own axis moves almost no mass, since its centre
//   of mass is ON that axis. It is the shove off the back foot.
//
//   THE KICKS OUTWEIGH THE PUNCHES by about 2x, because a leg weighs three
//   times what an arm does. Nothing in the module says so; Dempster does.
//
//   SKILL IS THE CHAIN — ON THE STRAIGHT PUNCHES. Left to right the fighters
//   go from novice to champion, one body six times, and the spread opens up on
//   the jab, cross, uppercut and palm strike (up to 3.5x) and closes to
//   nothing on the kicks and the swings. That is the model working: a straight
//   punch IS its chain, a leg is heavy enough without one, and a hook's power
//   is its rotation whatever order it arrives in. The novice throws an ARM
//   PUNCH — measured, their hip peaks AFTER their fist.
//
// The bar in front of each fighter is their balance: how much base of support
// is left. Watch it empty on a roundhouse and barely move on a jab.
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial,
         PlaneGeometry, Vector3 } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { createHumanoid, STRIKES, STRIKE_NAMES, Striking, bodyMass } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('concrete', { seed: 3 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const SKILLS = [0.05, 0.25, 0.45, 0.65, 0.85, 1];
const SPACING = 1.95;
const fighters = SKILLS.map((skill, i) => {
  // ONE BODY, six times, down to the kit. Varying the seed as well as the
  // skill was comparing BODIES: the novice drew a heavier build and out-hit
  // the champion, which is true of those two people and says nothing whatever
  // about skill. Identical fighters is the whole point — the only thing that
  // differs down the line is the number handed to the skill option.
  const rig = createHumanoid({ seed: 5 });
  rig.object.position.set((i - (SKILLS.length - 1) / 2) * SPACING, 0, 0);
  scene.add(rig.object);

  // A heavy bag on a chain. A pendulum has no opinion about how hard it was
  // hit, so what it does is entirely the impulse's doing.
  const bag = new Group();
  const body = new Mesh(
    new CylinderGeometry(0.155, 0.17, 1.1, 14),
    new MeshStandardMaterial({ color: 0x33323a, roughness: 0.85 })
  );
  body.position.y = -0.575;
  const chain = new Mesh(
    new CylinderGeometry(0.012, 0.012, 0.75, 6),
    new MeshStandardMaterial({ color: 0x8a8a92, metalness: 0.7, roughness: 0.4 })
  );
  chain.position.y = 0.375;
  bag.add(body, chain);
  bag.position.set(rig.object.position.x, 1.62, 0.62);
  scene.add(bag);

  const bar = new Mesh(
    new BoxGeometry(1, 0.06, 0.06),
    new MeshStandardMaterial({ color: 0x4caf50, emissive: 0x123a15 })
  );
  bar.position.set(rig.object.position.x, 0.06, -1.1);
  scene.add(bar);

  const striker = new Striking(rig, { target: bag, skill, fade: 0.08 });
  const state = {
    rig, bag, bar, striker, skill,
    mass: bodyMass(rig),
    swing: 0, swingVel: 0,
    last: null, lastCross: null, hardest: 0, thrown: 0,
  };
  striker.onBlow((blow) => {
    // Impulse over the bag's mass. That is the whole conversion.
    state.swingVel += blow.impulse / 26;
    state.last = blow;
    state.hardest = Math.max(state.hardest, blow.impulse);
    if (blow.strike === 'cross') state.lastCross = blow;
    state.thrown++;
  });
  return state;
});

// Everybody works the same rotation, so what varies is the BODY and the SKILL.
const ROUND = STRIKE_NAMES;
let step = 0;
let cool = 0.6;
let t = 0;

game.onUpdate((frame) => {
  const dt = Math.min(0.05, frame.delta);
  t += dt;
  cool -= dt;
  if (cool <= 0) {
    for (const f of fighters) f.striker.throwStrike(ROUND[step % ROUND.length]);
    step++;
    cool = 1.6;
  }
  for (const f of fighters) {
    f.striker.update(dt);
    // Gravity restores the bag, the air takes it back out of it.
    f.swingVel += (-9.81 / 1.15) * Math.sin(f.swing) * dt;
    f.swingVel *= Math.exp(-1.1 * dt);
    f.swing += f.swingVel * dt;
    f.bag.rotation.x = -f.swing;
    const bal = Math.max(0, Math.min(1, f.striker.balance));
    f.bar.scale.x = 0.08 + bal;
    f.bar.material.color.setHSL(0.33 * bal, 0.65, 0.45);
  }
});

// Along the line and slightly above it: the comparison runs left to right, and
// a comparison you cannot see both ends of is not one.
// Front three-quarters and back far enough for all SIX. Straight on from
// behind put the bags between the camera and the punches and cut the outer
// two fighters out of frame entirely, which is no use for a comparison whose
// whole content is left to right.
game.camera.position.set(2.6, 4.4, 10.2);
game.camera.lookAt(0, 1.15, 0.15);

window.strikingDebug = () => ({
  fighters: fighters.length,
  // The scene's OWN clock. Headless SwiftShader runs at about a third of real
  // time, and a bag room where nobody has thrown yet looks exactly like one
  // where nobody ever will.
  clock: Number(t.toFixed(1)),
  thrown: fighters[0].thrown,
  strike: ROUND[(step - 1 + ROUND.length) % ROUND.length],
  // Skill against the number over their head. If these do not order by skill,
  // the thing the scene is named for is not happening.
  bySkill: fighters.map((f) => ({
    skill: Number(f.skill.toFixed(2)),
    kg: Number((f.last ? f.last.mass : 0).toFixed(2)),
    impulse: Number((f.last ? f.last.impulse : 0).toFixed(1)),
    hardest: Number(f.hardest.toFixed(1)),
    // The cross specifically, because that is where the chain shows.
    cross: Number((f.lastCross ? f.lastCross.mass : 0).toFixed(2)),
    balance: Number(f.striker.balance.toFixed(2)),
  })),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'sparring',
    title: 'Sparring: what gets through is geometry',
    group: 'Scale',
    code: `// SEVEN GUARDS, ONE ATTACKER, AND NO BLOCK CHANCE ANYWHERE.
//
// One striker works down a line of defenders, each holding a different guard,
// throwing the same rotation at every one. What gets through is decided by two
// measurements and nothing else:
//
//   WHERE THE ARMS ARE. Coverage is sampled off the pose — every direction a
//   strike could come from, asking whether the line passes through a limb. A
//   cross-arm buries the head at 51% and a low guard gives it away at 5%; the
//   low guard takes 26% of the BODY where the cross-arm takes 9%. Same two
//   arms, and the trade is measured rather than declared.
//
//   WHETHER THERE WAS TIME. Simple visual reaction is 180 ms. A jab's wind-up
//   is 130. Nobody reacts to a jab — not the expert, not anyone — and that is
//   why it is the most thrown punch in boxing. The slower committed shots CAN
//   be answered, and the defenders slip them when they can.
//
// The bar over each defender is what has got through them, in kg·m/s. The
// green pips under the bar are the strikes their guard stopped.
import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial,
         PlaneGeometry, Vector3 } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { createHumanoid, Guard, GUARDS, GUARD_NAMES, STRIKE_NAMES, STRIKES,
         Striking, canReactTo, coverageOf } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('concrete', { seed: 7 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const SPACING = 2.05;
const SKILL = 0.85;

// One defender per guard, all the same body, so the only thing that differs
// down the line is where the hands are.
const posts = GUARD_NAMES.map((name, i) => {
  const x = (i - (GUARD_NAMES.length - 1) / 2) * SPACING;

  const def = createHumanoid({ seed: 5 });
  def.object.position.set(x, 0, 0.66);
  def.object.rotation.y = Math.PI;
  scene.add(def.object);
  const guard = new Guard(def, { style: name, skill: SKILL, fade: 0.08 });

  const atk = createHumanoid({ seed: 12 });
  atk.object.position.set(x, 0, 0);
  scene.add(atk.object);
  const striker = new Striking(atk, { target: def.bones.Head, skill: 0.8, fade: 0.08 });

  // A post over the defender: how much has reached them.
  const bar = new Mesh(
    new BoxGeometry(0.09, 1, 0.09),
    new MeshStandardMaterial({ color: 0xcc3333, emissive: 0x3a1010 })
  );
  bar.position.set(x, 2.15, 0.66);
  scene.add(bar);
  const pip = new Mesh(
    new CylinderGeometry(0.05, 0.05, 0.03, 10),
    new MeshStandardMaterial({ color: 0x44cc55, emissive: 0x0f3a14 })
  );
  pip.position.set(x, 0.03, 0.66);
  scene.add(pip);

  const post = {
    name, def, atk, guard, striker, bar, pip,
    through: 0, stopped: 0, landed: 0, last: null,
  };
  striker.onBlow((blow) => {
    const answer = guard.defend(blow);
    post.last = answer;
    post.landed++;
    if (answer.stopped) post.stopped++;
    else post.through += answer.through;
  });
  return post;
});

const ROUND = STRIKE_NAMES;
let step = 0;
let cool = 0.8;
let t = 0;

game.onUpdate((frame) => {
  const dt = Math.min(0.05, frame.delta);
  t += dt;
  cool -= dt;
  if (cool <= 0) {
    const strike = ROUND[step % ROUND.length];
    for (const p of posts) {
      p.striker.throwStrike(strike);
      // The defenders answer what they can SEE. A jab is not one of them.
      if (canReactTo(strike, SKILL)) p.pending = strike;
      else p.pending = null;
      p.seen = 0;
    }
    step++;
    cool = 1.7;
  }
  for (const p of posts) {
    p.striker.update(dt);
    p.guard.update(dt);
    // Reacting takes as long as it takes. Trigger the slip when the defender
    // would actually have seen the shot, not when it was declared.
    if (p.pending) {
      p.seen += dt;
      if (p.seen >= p.guard.reaction) {
        p.guard.react(p.pending, 'slip');
        p.pending = null;
      }
    }
    const h = 0.12 + Math.min(3, p.through / 90);
    p.bar.scale.y = h;
    p.bar.position.y = 1.5 + h / 2;
    p.pip.scale.setScalar(0.4 + p.stopped * 0.22);
  }
});

// Along the line, high enough that all seven pairs and all seven posts fit.
game.camera.position.set(1.1, 5.6, 13.2);
game.camera.lookAt(0, 1.2, 0.3);

window.sparringDebug = () => ({
  posts: posts.length,
  // The scene's OWN clock — headless SwiftShader runs this at about a third of
  // real time, and a gym where nobody has thrown yet looks exactly like one
  // where nobody ever will.
  clock: Number(t.toFixed(1)),
  thrown: step,
  landed: posts[0].landed,
  // Coverage against what got through. If the guards that cover more are not
  // taking less, the thing the scene is named for is not happening.
  byGuard: posts.map((p) => ({
    guard: p.name,
    head: Number((coverageOf(p.def, 'head') * 100).toFixed(1)),
    body: Number((coverageOf(p.def, 'body') * 100).toFixed(1)),
    stopped: p.stopped,
    through: Number(p.through.toFixed(0)),
  })),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'dojo',
    title: 'Dojo: no kuzushi, no throw',
    group: 'Scale',
    code: `// FIVE PAIRS, THE SAME THROW, AND NOTHING BUT THE PULL BETWEEN THEM.
//
// Every pair on this line is attempting an identical seoi nage on an identical
// body. The only thing that changes from left to right is how hard the tori
// pulls — skill 0.35 at the near end, 0.95 at the far one — and the line
// splits in the middle.
//
// Nothing in the scene decides who goes over. A throw completes if, and only
// if, the uke\'s centre of mass has actually left the polygon their feet make
// on the floor. That is judo\'s definition of kuzushi, and it is also exactly
// what stability() measures, in foot lengths, off Dempster\'s segment masses.
//
//   the ones still standing   pulled hard enough to lean somebody, not to
//                             break them. They report failed: notBroken, and
//                             their tori is left committed and out of position
//   the ones on the floor     went past zero, and then fell. The post is what
//                             they arrived with, in kg-m/s: mass times
//                             sqrt(2gh), from a fall nobody typed in
//
// A body only has to come about 11 degrees over its toes before it is going
// down, and 4 over its heels. Kuzushi is small, and this is the difference
// between enough of it and not quite.
import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial,
         PlaneGeometry } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { createHumanoid, Grappling, Locomotion, THROWS,
         breakEffort } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('floortile', { seed: 3 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const THROW = 'seoiNage';
const SPACING = 2.25;
const SKILLS = [0.35, 0.5, 0.65, 0.8, 0.95];

const pairs = SKILLS.map((skill, i) => {
  const x = (i - (SKILLS.length - 1) / 2) * SPACING;

  const tori = createHumanoid({ seed: 1 });
  tori.object.position.set(x, 0, 0);
  scene.add(tori.object);

  const uke = createHumanoid({ seed: 42 });
  uke.object.position.set(x, 0, 0.44);
  uke.object.rotation.y = Math.PI;
  scene.add(uke.object);

  // An idle underneath, so anybody NOT being thrown is standing rather than
  // holding the rest pose with their arms out. Grappling takes the bones it
  // needs on top of this and hands them straight back.
  const idle = [new Locomotion(tori), new Locomotion(uke)];

  // tempo below 1 because a real seoi nage is over in about a second, which
  // is not long enough to watch.
  const grapple = new Grappling(tori, uke, { skill, tempo: 0.7, fade: 0.08 });

  // What arrived, in kg-m/s. Nothing at all for anybody still on their feet.
  const post = new Mesh(
    new BoxGeometry(0.12, 1, 0.12),
    new MeshStandardMaterial({ color: 0xcc4422, emissive: 0x3a1408 })
  );
  post.position.set(x, 2.1, 0.22);
  scene.add(post);
  // Green while the balance is actually gone. Not a result — read every frame
  // off where the centre of mass is right now.
  const pip = new Mesh(
    new CylinderGeometry(0.16, 0.16, 0.05, 16),
    new MeshStandardMaterial({ color: 0x33aa55, emissive: 0x0c2e16 })
  );
  pip.position.set(x, 0.05, -0.55);
  scene.add(pip);

  const p = { skill, tori, uke, grapple, idle, post, pip, impulse: 0, thrown: 0, tries: 0 };
  grapple.onThrow((e) => { p.tries++; p.failed = e.failed; if (e.completed) p.thrown++; });
  grapple.onLand((l) => { p.impulse = l.impulse; p.torso = l.toTorso; });
  return p;
});

let cool = 0.8;
let round = 0;
let t = 0;

game.onUpdate((frame) => {
  const dt = Math.min(0.05, frame.delta);
  t += dt;
  cool -= dt;
  if (cool <= 0 && pairs.every((p) => p.grapple.current === null)) {
    for (const p of pairs) p.grapple.attempt(THROW);
    round++;
    cool = 4.2;
  }
  for (const p of pairs) {
    // The idle runs only between attempts. Two systems driving one pelvis at
    // once is an argument, and the throw would win it every frame anyway.
    if (!p.grapple.current) for (const l of p.idle) l.update(dt, 0);
    p.grapple.update(dt);
    const h = 0.05 + Math.min(1.15, p.impulse / 260);
    p.post.scale.y = h;
    p.post.position.y = 1.62 + h / 2;
    p.pip.scale.setScalar(p.grapple.ukeBalance < 0 ? 1 : 0.28);
  }
});

game.camera.position.set(0, 3.1, 12.2);
game.camera.lookAt(0, 1.15, 0.2);

// How far this body has to be tipped in the direction this throw breaks — the
// number every pair on the line is being measured against.
const needed = breakEffort(createHumanoid({ seed: 42 }), THROWS[THROW].breaks);

window.dojoDebug = () => ({
  pairs: pairs.length,
  // The scene\'s OWN clock. Headless SwiftShader runs at about a third of real
  // time, and a dojo where nobody has thrown yet looks exactly like one where
  // nobody ever will.
  clock: Number(t.toFixed(1)),
  rounds: round,
  breaks: THROWS[THROW].breaks,
  tipNeeded: Number(((needed.lean * 180) / Math.PI).toFixed(1)),
  travelNeeded: Number((needed.travel * 1000).toFixed(0)),
  // The far end of the line — the one that always has the pull to finish.
  phase: pairs[pairs.length - 1].grapple.phase,
  bySkill: pairs.map((p) => ({
    skill: p.skill,
    tries: p.tries,
    thrown: p.thrown,
    failed: p.failed ?? null,
    balance: Number(p.grapple.ukeBalance.toFixed(3)),
    impulse: Number(p.impulse.toFixed(0)),
  })),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'styles',
    title: 'Styles: a style is where the feet are',
    group: 'Scale',
    code: `// SIX FIGHTERS, SIX STYLES, AND NOT ONE DAMAGE MULTIPLIER BETWEEN THEM.
//
// Every fighter on this line is the same body. What differs is three facts:
// where the feet are, which guard the hands hold, and what the fighter throws
// at all. Everything else you can see is a CONSEQUENCE, measured by a module
// that was already there for its own reasons.
//
//   the footprints    stability() reads the polygon the feet make, so the
//                     stance decides what every strike costs in balance and
//                     which way this fighter gets thrown
//   the guard         coverageOf() samples the directions a strike could come
//                     from and asks whether an arm is on the line
//   the repertoire    availability, not advantage. A style does not make an
//                     elbow hurt more; it makes an elbow available
//
// The green ring under each fighter is how rooted they are — how far they have
// to be tipped before they are going over, measured by breakEffort() on the
// body actually standing there. The post behind them is what their guard
// covers. Watch the karate stance sink as it settles: nobody typed that in,
// the pelvis has to come down 115 mm just for the legs to REACH a stance that
// long, and a brawler standing twice as wide barely crouches at all.
import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial,
         PlaneGeometry, RingGeometry, DoubleSide } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { createHumanoid, FightStyle, FIGHT_STYLES, FIGHT_STYLE_NAMES,
         Guard, Striking, styleProfile } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('concrete', { seed: 11 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const SPACING = 2.1;

const fighters = FIGHT_STYLE_NAMES.map((name, i) => {
  const x = (i - (FIGHT_STYLE_NAMES.length - 1) / 2) * SPACING;
  const spec = FIGHT_STYLES[name];

  const rig = createHumanoid({ seed: 5 });
  rig.object.position.set(x, 0, 0);
  scene.add(rig.object);

  // Measured BEFORE anybody poses anything, on a clean body.
  const profile = styleProfile(rig, name);

  // The stance goes first every frame; Striking composes on top of it.
  const style = new FightStyle(rig, name, { fade: 0.5 });
  const guard = new Guard(rig, { style: spec.guard, skill: 0.8, fade: 0.3 });
  const striking = new Striking(rig, {
    target: null, skill: 0.8, fade: 0.12, footing: spec.stance,
  });

  // How rooted they are: the ring grows with the tip they can take.
  const ring = new Mesh(
    // Centred on the range the six actually span (9.0° to 12.4°) rather than
    // on zero, because a ring that starts at zero makes a 38% difference look
    // like a 6% one. The number is in the readout; this is the shape of it.
    new RingGeometry(0.2, 0.2 + (profile.rooted - 0.14) * 9, 28),
    new MeshStandardMaterial({ color: 0x33aa55, emissive: 0x0c2e16, side: DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.02, 0);
  scene.add(ring);

  // What the guard covers of the head.
  const post = new Mesh(
    new BoxGeometry(0.1, Math.max(0.06, profile.cover * 2.6), 0.1),
    new MeshStandardMaterial({ color: 0x4488cc, emissive: 0x0e2438 })
  );
  post.position.set(x - 0.18, 1.8 + (profile.cover * 2.6) / 2, -0.35);
  scene.add(post);

  // ...and of the centre line, which is a different question entirely.
  const pip = new Mesh(
    new CylinderGeometry(0.07, 0.07, Math.max(0.03, profile.centre * 1.4), 12),
    new MeshStandardMaterial({ color: 0xddaa33, emissive: 0x3a2b08 })
  );
  pip.position.set(x + 0.18, 1.8 + (profile.centre * 1.4) / 2, -0.35);
  scene.add(pip);

  return { name, rig, style, guard, striking, profile, beat: 0 };
});

let cool = 1.2;
let t = 0;
let round = 0;

game.onUpdate((frame) => {
  const dt = Math.min(0.05, frame.delta);
  t += dt;
  cool -= dt;
  if (cool <= 0) {
    for (const f of fighters) {
      // Each fighter throws from their OWN repertoire, in order. Nobody is
      // throwing a strike their style does not have.
      f.striking.throwStrike(f.style.at(f.beat));
      f.beat++;
    }
    round++;
    cool = 1.9;
  }
  for (const f of fighters) {
    f.style.update(dt);
    f.guard.update(dt);
    f.striking.update(dt);
  }
});

game.camera.position.set(0, 2.6, 10.4);
game.camera.lookAt(0, 1.2, -0.15);

window.stylesDebug = () => ({
  fighters: fighters.length,
  // The scene's OWN clock. Headless SwiftShader runs at about a third of real
  // time, and a gym where nobody has thrown yet looks exactly like one where
  // nobody ever will.
  clock: Number(t.toFixed(1)),
  rounds: round,
  byStyle: fighters.map((f) => ({
    style: f.name,
    guard: FIGHT_STYLES[f.name].guard,
    thrown: f.beat,
    strike: f.style.at(Math.max(0, f.beat - 1)),
    base: Number(f.profile.base.toFixed(3)),
    cover: Number((f.profile.cover * 100).toFixed(1)),
    centre: Number((f.profile.centre * 100).toFixed(1)),
    rooted: Number(((f.profile.rooted * 180) / Math.PI).toFixed(1)),
    weakLine: f.profile.weakLine,
  })),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'bout',
    title: 'Bout: nobody encoded the reach advantage',
    group: 'Scale',
    code: `// TWO FIGHTERS. THE AI READS FOUR NUMBERS AND NOT ONE OF THEM IS HEIGHT.
//
// The tall one on the left and the short one on the right are the same code
// with different seeds. The decision each of them makes, every time, is:
//
//   can this limb GET there          strikeReach() on my own body vs the gap
//   can I afford the BALANCE         stability(), right now
//   can I afford the FUEL            joules left in a 300 J/kg tank
//   where are they OPEN              coverageOf() on their current pose
//
// No height. No weight. No style matchup table. No dice.
//
// And the longer fighter wins — 40 of 45 pairs across ten seeded bodies, with
// the reach gap predicting the margin at r = 0.673 — because a longer arm
// MEASURES further, so there is a band of distance where one of them can
// reach and the other has to walk through it.
//
// Watch the corner between rounds. Round one blocks nothing: both open in the
// guard their style chose, and each aims at whatever it does not cover. Then
// they cover it, and the incoming drops by a third and stays there. The only
// memory in the whole bout is 'where have I been hit', and which guard to
// switch to is measured off every guard in the library tried on that body.
import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial,
         PlaneGeometry, RingGeometry, DoubleSide } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { createHumanoid, Bout, Fighter } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('floortile', { seed: 5 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// The mat, so the eye has somewhere to put the fight.
const mat = new Mesh(
  new RingGeometry(1.25, 1.33, 48),
  new MeshStandardMaterial({ color: 0x99332a, emissive: 0x2a0f0c, side: DoubleSide })
);
mat.rotation.x = -Math.PI / 2;
mat.position.y = 0.012;
scene.add(mat);

// Seed 42 is 1.750 m; seed 7 is 1.603 m. Same code, same style, same skill.
const tall = new Fighter(createHumanoid({ seed: 42 }), { style: 'boxing', skill: 0.8 });
const short = new Fighter(createHumanoid({ seed: 7 }), { style: 'boxing', skill: 0.8 });
scene.add(tall.rig.object, short.rig.object);

const bout = new Bout(tall, short, { rounds: 4, roundSeconds: 22 });

// A post each: what has got through them, in kg-m/s.
const posts = [tall, short].map((f, i) => {
  const post = new Mesh(
    new BoxGeometry(0.11, 1, 0.11),
    new MeshStandardMaterial({ color: 0xcc4422, emissive: 0x3a1408 })
  );
  post.position.set(i === 0 ? -0.95 : 0.95, 1.2, 0);
  scene.add(post);
  return post;
});
// ...and a ring under each, sized by how far that body can actually reach.
for (const [i, f] of [tall, short].entries()) {
  const ring = new Mesh(
    new RingGeometry(f.range - 0.02, f.range, 40),
    new MeshStandardMaterial({ color: 0x3a8fd0, emissive: 0x0b2438, side: DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.userData.who = f;
  scene.add(ring);
  posts[i].userData.ring = ring;
}

let t = 0;

game.onUpdate((frame) => {
  const dt = Math.min(0.05, frame.delta);
  t += dt;
  if (!bout.done) bout.update(dt);
  for (const [i, f] of [tall, short].entries()) {
    const h = 0.06 + Math.min(2.4, f.through / 220);
    posts[i].scale.y = h;
    posts[i].position.y = 0.9 + h / 2;
    // The reach ring follows the body, so you can SEE the band where one of
    // them can touch the other and the other cannot.
    posts[i].userData.ring.position.z = f.rig.object.position.z;
  }
});

game.camera.position.set(2.5, 1.6, 2.2);
game.camera.lookAt(0, 1.0, 0);

window.boutDebug = () => ({
  // The scene's OWN clock. Headless SwiftShader runs at about a third of real
  // time, and a gym where nobody has thrown yet looks exactly like one where
  // nobody ever will.
  clock: Number(t.toFixed(1)),
  round: bout.round,
  gap: Number(bout.gap.toFixed(3)),
  exchanges: bout.exchanges.length,
  stopped: bout.exchanges.filter((e) => e.stopped).length,
  guards: bout.guards,
  fighters: [tall, short].map((f) => ({
    height: Number(f.rig.height.toFixed(3)),
    reach: Number(f.range.toFixed(3)),
    guard: f.guarding,
    thrown: f.thrown,
    through: Number(f.through.toFixed(0)),
    taken: Number(f.taken.toFixed(0)),
    fatigue: Number((f.fatigue * 100).toFixed(0)),
  })),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'armoury',
    title: 'Armoury: nine objects, and not one of them was weighed',
    group: 'Scale',
    code: `// NINE WEAPONS HANGING FROM THEIR OWN GRIPS, RELEASED TOGETHER.
//
// Every shape here is built from the SAME segment table the physics reads — a
// list of lengths, widths, thicknesses and materials, with no mass anywhere in
// it. The weight, the balance point and the swing all come out of that table,
// and the meshes below are drawn from it, so what is on screen is what is
// being measured.
//
// They are released at the same angle at the same instant, and they come
// apart, because each swings with the period of ITS OWN mass distribution:
//
//   T = 2π√(I / m·g·d)
//
// which is the compound pendulum, and the one number in this whole library a
// person with a real sword, a piece of string and a stopwatch can walk up and
// falsify.
//
// The swing is INTEGRATED, not played back: θ'' = −(m·g·d / I)·sin θ, stepped
// every frame from the derived m, d and I. Nothing tells it the period. That
// the timed period comes back equal to the closed form is the check.
//
// Watch the javelin, eighth along. Its rules put the binding ON its centre of
// mass, so d = 0, so there is no restoring torque and it hangs at exactly the
// angle it was released at while the other eight swing past it. That is not a
// special case in the code — it is the same formula everyone else uses,
// dividing by a distance that has gone to zero. An object held at its own
// balance point is not swung. It is thrown.
//
// Blue bead = the balance point. Orange ring = the centre of percussion, the
// spot that does not sting the hand. The javelin has neither.
import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial,
         PlaneGeometry, RingGeometry, Group, DoubleSide } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { BALANCE_TOLERANCE, BLADES, BLADE_NAMES, balancePoint, bladeMass,
         inertia, measureBlade, percussion } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('floortile', { seed: 3 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const COLOUR = { steel: 0x9aa3ad, alloy: 0xb9c3cd, ash: 0xc8a06a,
                 oak: 0x8a6a42, grip: 0x4a3a30, brass: 0xc9a227 };
const PIVOT_Y = 1.8;
const SPACING = 0.5;
const RELEASE = 0.25;   // radians, the same for all nine

// The rail they all hang from.
const rail = new Mesh(
  new BoxGeometry(BLADE_NAMES.length * SPACING + 0.4, 0.05, 0.05),
  new MeshStandardMaterial({ color: 0x555b63, metalness: 0.3, roughness: 0.5 })
);
rail.position.set(0, PIVOT_Y, 0);
scene.add(rail);

const hung = BLADE_NAMES.map((name, i) => {
  const spec = BLADES[name];
  const report = measureBlade(name);
  const pivot = new Group();
  pivot.position.set((i - (BLADE_NAMES.length - 1) / 2) * SPACING, PIVOT_Y, 0);
  scene.add(pivot);

  // ONE MESH PER SEGMENT, straight off the table the physics sums. A tapered
  // segment is drawn as a tapered cylinder because that is what it is: the
  // volume the mass came from and the volume you are looking at are the same
  // description of the same object.
  for (const s of spec.segments) {
    const len = Math.max(0.001, s.to - s.from);
    const metal = s.material === 'steel' || s.material === 'alloy' || s.material === 'brass';
    const bar = new Mesh(
      new CylinderGeometry(
        Math.max(0.0015, (s.width[1] + s.thick[1]) / 4),
        Math.max(0.0015, (s.width[0] + s.thick[0]) / 4),
        len, 12
      ),
      new MeshStandardMaterial({
        color: COLOUR[s.material],
        // Metalness without an environment map renders BLACK in three.js —
        // a rack of physically-correct steel that looks like nine wires. The
        // shapes are the measurement here, so they have to be visible.
        metalness: metal ? 0.3 : 0.05,
        roughness: metal ? 0.42 : s.material === 'grip' ? 0.9 : 0.6,
        emissive: metal ? 0x1a1f24 : 0x120d08,
      })
    );
    // Hanging from the grip: the butt is UP, the tip is DOWN.
    bar.position.y = -((s.from + s.to) / 2 - spec.grip);
    pivot.add(bar);
  }

  // Where the mass actually is.
  const bead = new Mesh(
    new CylinderGeometry(0.03, 0.03, 0.014, 16),
    new MeshStandardMaterial({ color: 0x3a8fd0, emissive: 0x0b2438 })
  );
  bead.position.y = -(report.balance - spec.grip);
  pivot.add(bead);

  // ...and where it can be hit without punishing the hand. Not drawn for the
  // javelin, because the javelin does not have one.
  const cop = percussion(spec);
  if (Number.isFinite(cop)) {
    const ring = new Mesh(
      new RingGeometry(0.032, 0.046, 20),
      new MeshStandardMaterial({ color: 0xd8862a, emissive: 0x3a1c06, side: DoubleSide })
    );
    ring.position.y = -(cop - spec.grip);
    pivot.add(ring);
  }

  // The three numbers the swing needs, and all three are sums over the table.
  //
  // The javelin's balance lands about 20 MICRONS from its grip, and whether
  // that lands + or − is arithmetic, not physics — nobody can find a real
  // javelin's balance point to a fifth of a millimetre. Integrated raw, a
  // negative one turns it into a very slow INVERTED pendulum and it topples
  // over the length of the demo, which would be a story about floating point
  // dressed up as a story about javelins. Inside the tolerance the library
  // already publishes, the honest value is zero: no lever, no torque, and it
  // stays exactly where it was let go.
  const lever = balancePoint(spec) - spec.grip;
  return {
    name, pivot, report,
    m: bladeMass(spec),
    d: Math.abs(lever) < BALANCE_TOLERANCE ? 0 : lever,
    I: inertia(spec),
    theta: RELEASE, omega: 0, crossings: [], measured: 0,
  };
});

let t = 0;

game.onUpdate((frame) => {
  const dt = Math.min(0.033, frame.delta);
  t += dt;
  for (const h of hung) {
    // θ'' = −(m·g·d / I)·sin θ. Not the small-angle version, and not a sine
    // wave played back at a chosen rate: the equation, with the derived
    // numbers, sub-stepped so the integrator is not what is being measured.
    const steps = 8;
    const sub = dt / steps;
    for (let k = 0; k < steps; k++) {
      const before = h.theta;
      h.omega -= ((h.m * 9.81 * h.d) / h.I) * Math.sin(h.theta) * sub;
      h.theta += h.omega * sub;
      // Time it the way a person with a stopwatch would: count the passes
      // through the bottom. Two of them make one period.
      if (before > 0 !== h.theta > 0) h.crossings.push(t + k * sub);
    }
    if (h.crossings.length > 2) {
      const spanned = h.crossings[h.crossings.length - 1] - h.crossings[0];
      h.measured = (2 * spanned) / (h.crossings.length - 1);
    }
    h.pivot.rotation.z = h.theta;
  }
});

// The rail hangs low on purpose: a sword is a few millimetres thick, and nine
// of them against a bright sky is nine hairlines. Against the floor they read.
// The javelin still reaches 1.6 m ABOVE the rail, because that is what hanging
// something from its own balance point looks like.
game.camera.position.set(0, 1.15, 5.0);
game.camera.lookAt(0, 1.95, 0);

window.armouryDebug = () => ({
  // The scene's own clock — headless runs at about a third of real time, and a
  // rack nobody has released yet looks exactly like one that never swings.
  clock: Number(t.toFixed(1)),
  release: RELEASE,
  blades: hung.map((h) => ({
    name: h.name,
    mass: Number(h.report.mass.toFixed(3)),
    length: Number(h.report.length.toFixed(3)),
    balance: Number(h.report.balance.toFixed(3)),
    // What the formula says, and what the integrated swing actually did.
    period: Number.isFinite(h.report.period) ? Number(h.report.period.toFixed(3)) : null,
    measured: h.measured ? Number(h.measured.toFixed(3)) : null,
    swings: h.crossings.length,
    theta: Number(h.theta.toFixed(3)),
  })),
  // Nine objects, and the table they came from has no mass in it.
  segments: BLADE_NAMES.reduce((n, k) => n + BLADES[k].segments.length, 0),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'proving',
    title: 'The proving ground: sharpness starts it, toughness pays for it',
    group: 'Scale',
    code: `// FIVE EDGES OF THE SAME STEEL, ONE PUSH, AND A LINE THEY EITHER CLEAR OR DO NOT.
//
// The five blades below are identical objects. The only thing that differs is
// the radius of the apex — the last hundredth of a millimetre, a dimension
// nobody can see, and the single most consequential number about a blade:
//
//   razor    0.10 µm      sharp    0.50 µm      service  3.00 µm
//   blunt   30.00 µm      dull   200.00 µm
//
// Each one is pushed with the SAME 300 N. The column above it is the pressure
// that develops, on a log scale, because the range is four orders of magnitude
// and a linear axis would show one bar and four stubs.
//
// The moving plane is the material's ultimate tensile strength. A column that
// clears it cuts. A column under it does not — it bruises, and no amount of
// pushing harder changes what KIND of thing is happening. Watch the plane
// climb through the ladder as the target cycles: skin, muscle, linen, leather,
// pine both ways, mail.
//
// And watch what does NOT happen. Nothing here gets sharper or blunter. The
// blades never move. All that changes is what they are being pushed into, and
// the same five objects go from all-cutting to none-cutting and back.
//
// The bead on each column is where that edge sits. The plane is where the
// material sits. Pressure is force over area, and that is the whole file.
import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial,
         PlaneGeometry, SphereGeometry, DoubleSide } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { EDGES, EDGE_NAMES, TARGETS, TARGET_NAMES, BLADES, sectionAt,
         measureCut, propagationForce } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('floortile', { seed: 11 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const PUSH = 300;          // newtons, the same for every blade
const CONTACT = 0.15;      // metres of edge laid across the target
const SPACING = 0.75;
// log10(Pa) mapped onto metres of column. 5 is 100 kPa, 11 is 100 GPa, and
// everything in this library lives between them.
const LO = 5, HI = 11, TALL = 3.2;
const height = (pa) => Math.max(0.02, ((Math.log10(Math.max(1, pa)) - LO) / (HI - LO)) * TALL);

// The blade the section comes from — real steel, read where a cut would land.
const section = sectionAt(BLADES.arming, 0.7);

const bench = new Mesh(
  new BoxGeometry(EDGE_NAMES.length * SPACING + 0.5, 0.12, 0.5),
  new MeshStandardMaterial({ color: 0x4a5158, roughness: 0.7 })
);
bench.position.y = 0.06;
scene.add(bench);

const rigs = EDGE_NAMES.map((name, i) => {
  const x = (i - (EDGE_NAMES.length - 1) / 2) * SPACING;

  // The blade itself: the same arming-sword section, five times over.
  const blade = new Mesh(
    new BoxGeometry(section.width, 0.42, section.thick * 3),
    new MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.3, roughness: 0.35,
                               emissive: 0x1a1f24 })
  );
  blade.position.set(x, 0.33, 0);
  scene.add(blade);

  // ...and the pressure it develops, as a column.
  const column = new Mesh(
    new CylinderGeometry(0.055, 0.055, 1, 14),
    new MeshStandardMaterial({ color: 0x3a8fd0, emissive: 0x0b2438 })
  );
  column.position.x = x;
  scene.add(column);

  const bead = new Mesh(
    new SphereGeometry(0.075, 14, 10),
    new MeshStandardMaterial({ color: 0xd8862a, emissive: 0x3a1c06 })
  );
  bead.position.x = x;
  scene.add(bead);

  return { name, radius: EDGES[name], blade, column, bead, top: 0, bites: false };
});

// The line the material draws. Everything above it cuts; everything below it
// does not, and pushing harder only moves the columns, never the plane.
const line = new Mesh(
  new BoxGeometry(EDGE_NAMES.length * SPACING + 1.2, 0.035, 1.1),
  new MeshStandardMaterial({ color: 0xcc4422, emissive: 0x3a1408,
                             transparent: true, opacity: 0.75, side: DoubleSide })
);
scene.add(line);

let t = 0;
let index = 0;
let target = TARGETS[TARGET_NAMES[0]];
let planeY = 0;
// Whether the plane has arrived where the current material puts it. Anything
// reading this scene and comparing a column against the line has to wait for
// it: mid-ease, the line is somewhere no material is.
let settled = false;

function retarget() {
  target = TARGETS[TARGET_NAMES[index % TARGET_NAMES.length]];
  for (const r of rigs) {
    // The library does the whole of it. Nothing here decides anything.
    const cut = measureCut(
      { energy: 60, force: PUSH, radius: r.radius, width: section.width, contact: CONTACT },
      target
    );
    r.top = height(cut.pressure);
    r.bites = cut.bites;
    r.column.material.color.setHex(cut.bites ? 0x3a8fd0 : 0x555b63);
    r.column.material.emissive.setHex(cut.bites ? 0x0b2438 : 0x121417);
  }
}
retarget();

game.onUpdate((frame) => {
  const dt = Math.min(0.05, frame.delta);
  t += dt;
  // Four seconds a material, so there is time to see which columns cleared.
  const want = Math.floor(t / 4);
  if (want !== index) { index = want; retarget(); }

  for (const r of rigs) {
    const h = r.top;
    r.column.scale.y = h;
    r.column.position.y = 0.12 + h / 2;
    r.bead.position.y = 0.12 + h;
  }
  // The plane eases to the new strength rather than jumping, so the eye can
  // follow which columns it crossed on the way.
  const wantY = 0.12 + height(target.strength);
  planeY += (wantY - planeY) * Math.min(1, dt * 3);
  settled = Math.abs(wantY - planeY) < 0.004;
  line.position.y = planeY;
});

game.camera.position.set(0, 1.9, 5.4);
game.camera.lookAt(0, 1.7, 0);

window.provingDebug = () => ({
  // The scene's own clock: headless runs at about a third of real time, and a
  // bench that has not cycled yet looks exactly like one that never will.
  clock: Number(t.toFixed(1)),
  target: TARGET_NAMES[index % TARGET_NAMES.length],
  strength: target.strength,
  planeY: Number(planeY.toFixed(3)),
  settled,
  // What it takes to KEEP cutting, which is the other criterion entirely and
  // has nothing to do with any of the columns.
  toContinue: Number(propagationForce(target, section.width).toFixed(1)),
  width: Number(section.width.toFixed(4)),
  edges: rigs.map((r) => ({
    edge: r.name,
    micron: Number((r.radius * 1e6).toFixed(2)),
    pressure: measureCut(
      { energy: 60, force: PUSH, radius: r.radius, width: section.width, contact: CONTACT },
      target
    ).pressure,
    bites: r.bites,
    // The column top against the plane — the picture and the physics agreeing.
    top: Number((0.12 + r.top).toFixed(3)),
  })),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'crossing',
    title: 'The crossing: shallow grips and will not hold still',
    group: 'Scale',
    code: `// TWO BLADES IN CONTACT STOP BEING TWO OBJECTS.
//
// They become one linkage with a hand at each end and a sliding joint in the
// middle that neither fencer put there. The joint is where two lines cross,
// and that is all it is.
//
// The left blade sweeps. The right one never moves. Watch the ORANGE BEAD —
// the contact — and watch the trail of dots it leaves behind, one every tenth
// of a second.
//
// When the blades are nearly parallel the dots are stretched metres apart:
// the contact is bolting along both blades, because two nearly-parallel lines
// meet somewhere hypersensitive to both of them. Rotate one a degree and the
// meeting point runs
//
//   ds = a · dα / sin θ
//
// which is the conditioning of a line intersection, and it diverges. When the
// blades are near square the same dots bunch into a knot: the contact barely
// moves at all.
//
// And the bead's COLOUR is a completely different physics. Press across
// another blade and the force splits normal and tangential in the ratio tan θ,
// so below atan(µ) friction holds it. Steel on steel, µ = 0.2, that is 11.31°.
// Green means the crossing grips. Grey means one blade is skating along the
// other.
//
// So the two states never coincide. Where the dots are stretched, it grips.
// Where it holds still, it slips. Nobody encoded that — one half is Coulomb
// and the other half is 1/sinθ, and they were not consulted about each other.
//
// The bars from each hand to the bead are the LEVER ARMS. The bright one is
// winning: force at the contact is torque over lever, so the short one wins.
import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial,
         PlaneGeometry, SphereGeometry } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { BLADES, STEEL_FRICTION, frictionAngle, gripSpan, handCouple,
         measureBind } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('floortile', { seed: 7 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const PLANE_Y = 1.5;                 // the crossing plane, held at chest height
const OPTS = { hands: [2, 1], hilts: [BLADES.longsword.cross, BLADES.arming.cross] };

// Two hands, and neither of them moves for the whole demo.
// The hands sit 200 mm apart, which is where a real pair of hands is in a
// bind. It also has to be: two nearly-parallel lines whose origins are far
// apart meet a long way away, so with the hands at arm's length the crossing
// runs 11 metres down a 1.1 metre sword and there is no bind to look at. The
// spacing is what decides how shallow a crossing can land ON both blades, and
// at 200 mm the shallowest is about 5.5°, which straddles the 11.31° where
// friction gives up.
const A = { hand: { x: -0.1, y: -0.30 }, angle: 0, length: 1.11 };
const B = { hand: { x: 0.1, y: -0.34 }, angle: (150 * Math.PI) / 180, length: 0.89 };

// A blade is a cylinder from a hand along an angle. Both are the real reach
// past the hand out of BLADES, so the lengths are not made up either.
function bar(len, radius, colour, emissive) {
  const m = new Mesh(
    new CylinderGeometry(radius, radius, 1, 10),
    new MeshStandardMaterial({ color: colour, emissive, metalness: 0.3, roughness: 0.4 })
  );
  scene.add(m);
  return m;
}
// Place a cylinder so it runs from (hand) to (hand + len along angle), in the
// crossing plane. Cylinders point up the Y axis, so it is a rotation about Z.
function lay(mesh, hand, angle, len, z) {
  mesh.scale.y = Math.max(0.001, len);
  mesh.position.set(hand.x + (Math.cos(angle) * len) / 2, PLANE_Y + hand.y + (Math.sin(angle) * len) / 2, z);
  mesh.rotation.z = angle - Math.PI / 2;
}

const bladeA = bar(1, 0.011, 0x9aa3ad, 0x1a1f24);
const bladeB = bar(1, 0.011, 0x9aa3ad, 0x1a1f24);
const leverA = bar(1, 0.022, 0x3a8fd0, 0x0b2438);
const leverB = bar(1, 0.022, 0x3a8fd0, 0x0b2438);

for (const h of [A, B]) {
  const knuckle = new Mesh(
    new SphereGeometry(0.045, 12, 10),
    new MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.9 })
  );
  knuckle.position.set(h.hand.x, PLANE_Y + h.hand.y, 0);
  scene.add(knuckle);
}

const bead = new Mesh(
  new SphereGeometry(0.05, 16, 12),
  new MeshStandardMaterial({ color: 0xd8862a, emissive: 0x3a1c06 })
);
scene.add(bead);

// The trail. One dot every tenth of a second — so the SPACING between dots is
// the speed the contact is running at, which is the conditioning, drawn.
const TRAIL = 90;
const dots = [];
for (let i = 0; i < TRAIL; i++) {
  const d = new Mesh(
    new SphereGeometry(0.024, 8, 6),
    new MeshStandardMaterial({ color: 0xe8dfd2, emissive: 0x3a352d })
  );
  d.visible = false;
  scene.add(d);
  dots.push(d);
}
let head = 0;
let lastDot = 0;

const LIMIT = frictionAngle(STEEL_FRICTION);
let t = 0;
let report = null;
let grippedFor = 0;
let slippedFor = 0;

game.onUpdate((frame) => {
  const dt = Math.min(0.05, frame.delta);
  t += dt;

  // Sweep A from nearly parallel with B to nearly square with it, and back.
  // Nothing else in the scene changes for the whole demo.
  const phase = (Math.sin(t * 0.35) + 1) / 2;                 // 0..1
  // 60° to 144° of A. At one end the blades are nearly square; at the other
  // they lie almost along each other, and the crossing is still on both.
  A.angle = ((60 + phase * 84) * Math.PI) / 180;

  report = measureBind(A, B, OPTS);
  lay(bladeA, A.hand, A.angle, A.length, 0);
  lay(bladeB, B.hand, B.angle, B.length, 0);

  const x = report.crossing;
  if (x && x.onBoth) {
    bead.visible = true;
    bead.position.set(x.point.x, PLANE_Y + x.point.y, 0.03);
    // Green grips, grey slips. This is friction, and it has nothing to do with
    // how fast the bead is moving.
    bead.material.color.setHex(report.binds ? 0x46b361 : 0x6d757d);
    bead.material.emissive.setHex(report.binds ? 0x11331a : 0x1a1d20);
    if (report.binds) grippedFor += dt; else slippedFor += dt;

    // The lever arms, hand to contact. The winner is the bright one, and the
    // winner is whoever has the SHORTER bar, because force is torque over it.
    lay(leverA, A.hand, A.angle, x.alongA, 0.015);
    lay(leverB, B.hand, B.angle, x.alongB, 0.015);
    leverA.material.emissive.setHex(report.winner === 0 ? 0x1e5f9c : 0x0b2438);
    leverB.material.emissive.setHex(report.winner === 1 ? 0x1e5f9c : 0x0b2438);
    leverA.visible = leverB.visible = true;

    if (t - lastDot > 0.1) {
      lastDot = t;
      const d = dots[head % TRAIL];
      d.position.copy(bead.position);
      d.position.z = 0.01;
      d.visible = true;
      head++;
    }
  } else {
    // The crossing has run off the end of a blade. That is not a bind.
    bead.visible = leverA.visible = leverB.visible = false;
  }
});

// The contact lives between the two hands and about half a metre up-left of
// them, so the frame is put there rather than on the origin.
game.camera.position.set(-0.22, 1.42, 1.9);
game.camera.lookAt(-0.22, 1.42, 0);

window.crossingDebug = () => {
  const x = report && report.crossing;
  return {
    // The scene's own clock — headless runs at about a third of real time, and
    // a sweep that has not started looks exactly like one that never does.
    clock: Number(t.toFixed(1)),
    frictionLimit: Number(((LIMIT * 180) / Math.PI).toFixed(3)),
    angle: x ? Number(((x.angle * 180) / Math.PI).toFixed(2)) : null,
    alongA: x ? Number(x.alongA.toFixed(4)) : null,
    alongB: x ? Number(x.alongB.toFixed(4)) : null,
    onBoth: x ? x.onBoth : false,
    binds: report ? report.binds : false,
    ratio: report ? Number(report.ratio.toFixed(3)) : null,
    winner: report ? report.winner : -1,
    // Metres the contact runs per radian. The trail spacing IS this number.
    sensitivity: report ? Number(report.sensitivity[0].toFixed(4)) : null,
    // Both states have to actually happen, or the demo shows one of them.
    grippedFor: Number(grippedFor.toFixed(1)),
    slippedFor: Number(slippedFor.toFixed(1)),
    couples: [handCouple(gripSpan(OPTS.hilts[0], 2)), handCouple(gripSpan(OPTS.hilts[1], 1))],
    draws: game.renderer.info.render.calls,
  };
};

game.start();
`,
  },
  {
    id: 'thrown',
    title: 'Thrown: the four centimetres that ended the hundred-metre javelin',
    group: 'Scale',
    code: `// TWO JAVELINS, RELEASED IDENTICALLY, AND THE ONLY DIFFERENCE IS 4 cm OF BALANCE.
//
// On 1 April 1986 the IAAF moved the men's javelin's centre of mass four
// centimetres forward. Uwe Hohn had thrown 104.80 m two years before — still
// the only throw past a hundred metres there has ever been — and javelins were
// landing flat, sliding, and becoming impossible to judge.
//
// The BLUE one is today's. The AMBER one is the same javelin with 35 grams
// moved from its fore-shaft into its tail: same weight, same length, same
// external shape, same volume, same drag. \`shiftBalance\` moves mass WITHIN
// the object rather than adding any, so this is a one-variable experiment,
// which the real rule change was not.
//
// The pale dotted line is a cannonball from the same release — the vacuum
// trajectory, no air at all. Everything above it is lift.
//
// Watch the ATTITUDE, not the distance. The amber javelin is the less stable
// one: its mass sits nearer its centre of pressure, so it under-follows the
// descending flight path, holds a bigger angle of attack, keeps making lift,
// and comes down flat. The blue one noses over and arrives point-first, which
// is precisely and only what the rule was written to produce.
//
// The distance gap here is about 1.5%. The real rule was worth about 10%, and
// the reason for the difference is in the scene: these flights beat the
// cannonball by a couple of percent where real throws beat it by ten to
// seventeen. Slender-body theory under-predicts a javelin's lift, and the
// wind-tunnel tables that would fix it are not in this library — the 1986
// change is the check, so fitting to it would delete the check.
import { CylinderGeometry, Mesh, MeshStandardMaterial, PlaneGeometry,
         SphereGeometry, BoxGeometry } from 'three';
import { createLightingRig, createSky, createSurface, PALETTES } from 'scena3d';
import { BLADES, shiftBalance, aeroOf, staticMargin, flyJavelin,
         ballisticRange, balancePoint } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
// NO FOG. A throw is ninety metres long, and atmospheric perspective at that
// range turns both trajectories into the same grey smear — which erases the
// only thing this scene exists to show.
const floor = new Mesh(new PlaneGeometry(400, 400), createSurface('grass', { seed: 4 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const SPEED = 30, ANGLE = (34 * Math.PI) / 180, ATTACK = (5 * Math.PI) / 180;
const RELEASE = { speed: SPEED, angle: ANGLE, attack: ATTACK, height: 1.9 };

// Today's javelin, and the same object with its balance 40 mm further back.
const modern = BLADES.javelin;
const older = shiftBalance(modern, -0.04);
const bodies = [
  { name: '1986 rules', spec: modern, colour: 0x3a8fd0, glow: 0x0b2438, z: -1.2 },
  { name: 'pre-1986', spec: older, colour: 0xd8862a, glow: 0x3a1c06, z: 1.2 },
].map((b) => {
  const body = aeroOf(b.spec);
  const flight = flyJavelin(body, RELEASE);

  // The javelin itself, drawn from its own segment table so the thing in the
  // air is the thing being flown.
  // Drawn six times thick. A javelin is 26 mm across and this shot is a
  // hundred metres wide, so at true scale it is a third of a pixel. The LENGTH
  // and the ATTITUDE are honest — those are what is being compared.
  const shaft = new Mesh(
    new CylinderGeometry(0.05, 0.085, body.length, 8),
    new MeshStandardMaterial({ color: b.colour, emissive: b.glow, metalness: 0.3, roughness: 0.4 })
  );
  scene.add(shaft);

  // Where the mass is — the whole difference between these two, made visible.
  const bead = new Mesh(
    new SphereGeometry(0.16, 12, 10),
    new MeshStandardMaterial({ color: 0xe8dfd2, emissive: 0x3a352d })
  );
  scene.add(bead);

  // A dot every twentieth of a second along the path.
  const dots = [];
  for (let i = 0; i < 110; i++) {
    const d = new Mesh(
      new SphereGeometry(0.14, 6, 5),
      new MeshStandardMaterial({ color: b.colour, emissive: b.glow })
    );
    d.visible = false;
    scene.add(d);
    dots.push(d);
  }

  // ...and a post where it lands.
  const post = new Mesh(
    new BoxGeometry(0.35, 3.2, 0.35),
    new MeshStandardMaterial({ color: b.colour, emissive: b.glow })
  );
  post.position.set(flight.range, 1.6, b.z);
  scene.add(post);

  return { ...b, body, flight, shaft, bead, dots, laid: 0 };
});

// The cannonball, for scale. No air in it at all.
const vacuum = ballisticRange(SPEED, ANGLE, RELEASE.height);
for (let i = 0; i <= 60; i++) {
  const f = i / 60;
  const t = (f * 2 * SPEED * Math.sin(ANGLE)) / 9.81;
  const g = new Mesh(
    new SphereGeometry(0.1, 5, 4),
    new MeshStandardMaterial({ color: 0xb8bfc6, emissive: 0x24282c })
  );
  g.position.set(SPEED * Math.cos(ANGLE) * t, RELEASE.height + SPEED * Math.sin(ANGLE) * t - 4.905 * t * t, 0);
  if (g.position.y >= 0) scene.add(g);
}

let t = 0;
const REPLAY = 0.75;   // three-quarter speed, so the attitude is readable

game.onUpdate((frame) => {
  t += Math.min(0.05, frame.delta) * REPLAY;
  const longest = Math.max(...bodies.map((b) => b.flight.duration));
  if (t > longest + 2.5) {
    t = 0;
    for (const b of bodies) { b.laid = 0; for (const d of b.dots) d.visible = false; }
  }

  for (const b of bodies) {
    // The path is already integrated; this walks it. Nothing is being
    // simulated per frame, so the picture cannot disagree with the flight.
    const path = b.flight.path;
    const i = Math.min(path.length - 1, Math.floor((t / b.flight.duration) * (path.length - 1)));
    const p = path[Math.max(0, i)];
    b.shaft.position.set(p.x, Math.max(0, p.y), b.z);
    // Cylinders point up Y, so a pitch of 0 (level, nose along +x) is -90°.
    b.shaft.rotation.z = p.pitch - Math.PI / 2;
    // The centre of mass, at its own distance along the shaft from the butt.
    const d = balancePoint(b.spec) - b.body.length / 2;
    b.bead.position.set(p.x + Math.cos(p.pitch) * d, Math.max(0, p.y) + Math.sin(p.pitch) * d, b.z);

    const want = Math.min(b.dots.length, Math.floor(t * 20));
    while (b.laid < want) {
      const j = Math.min(path.length - 1, Math.floor((b.laid / 20 / b.flight.duration) * (path.length - 1)));
      const q = path[Math.max(0, j)];
      const dot = b.dots[b.laid];
      dot.position.set(q.x, Math.max(0, q.y), b.z);
      dot.visible = true;
      b.laid++;
    }
  }
});

// Far enough back that the whole flight fits, low enough that the arcs read
// against the sky rather than down the length of the field.
game.camera.position.set(46, 18, 104);
game.camera.lookAt(46, 11, 0);

window.thrownDebug = () => ({
  clock: Number(t.toFixed(2)),
  vacuum: Number(vacuum.toFixed(2)),
  javelins: bodies.map((b) => ({
    name: b.name,
    fromTip: Number((b.body.length - b.body.balance).toFixed(4)),
    margin: Number((staticMargin(b.body) * 100).toFixed(3)),
    range: Number(b.flight.range.toFixed(2)),
    surplus: Number(((b.flight.range / vacuum - 1) * 100).toFixed(2)),
    peakAttack: Number(((b.flight.peakAttack * 180) / Math.PI).toFixed(1)),
    landingAttitude: Number(((b.flight.landingAttitude * 180) / Math.PI).toFixed(1)),
    pointFirst: b.flight.pointFirst,
    dragFraction: Number((b.flight.releaseDragFraction * 100).toFixed(2)),
    laid: b.laid,
  })),
  // Same mass to the microgram, and that is what makes this an experiment.
  sameMass: Math.abs(bodies[0].body.mass - bodies[1].body.mass) < 1e-9,
  cost: Number((100 * (1 - bodies[0].flight.range / bodies[1].flight.range)).toFixed(2)),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'fence',
    title: 'The bout: two fencers, and they do not stand still',
    group: 'Scale',
    code: `// AN ARMED BOUT, AND THE FEET ARE HALF OF IT.
//
// The unarmed bout in this playground stands two fighters at a fixed gap and
// lets them trade. That is a measurement rig, not a fight — and with weapons
// it would be worse, because the interesting half of any fight with a sword in
// it is the FOOTWORK. Two unarmed fighters are in range or they are not. Two
// armed ones spend the whole exchange arguing about where the line is.
//
// So everything here moves. They close, they break, they circle, they lunge
// into the cut and step back out of it, and the blade in the hand sweeps
// because the ARM sweeps — solveLimb puts the hand on an arc and the steel
// follows, with no clip anywhere.
//
// Nothing about the timing was chosen. How long a cut takes is
//
//   t = √(2θ·I / τ)
//
// the blade's second moment about the grip, from BLADES, against the couple two
// hands can make on that hilt, from Bind. A longsword is twice an arming sword
// to turn and has twice the couple on it, so the two nearly cancel — which is
// the entire reason a hand-and-a-half grip is worth the extra steel.
//
// The rings are each fencer's MEASURE: arm reach plus blade past the hand.
// Watch the band between them. When the gap sits inside the blue ring and
// outside the amber one, the longsword can reach and the arming sword cannot,
// and that is where it attacks from. Nobody encoded that — it is a subtraction
// of two numbers, one from a bone length and one from a blade length.
//
// Blades meeting is Bind: the crossing is where two lines meet and whoever has
// the shorter lever arm owns it. A parry that lands forte-on-foible throws the
// attack aside; one that lands the other way round does not.
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry,
         RingGeometry, Vector3, DoubleSide } from 'three';
import { applyFog, createLightingRig, createSky, createSurface,
         PALETTES } from 'scena3d';
import { BLADES, Fence, Fencer, createHumanoid, fencerCard,
         poseSwordArm } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(200, 200), createSurface('floortile', { seed: 9 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// The blade, built from the SAME segment table the physics sums — so the steel
// on screen is the steel whose inertia is setting the tempo.
const COLOUR = { steel: 0x9aa3ad, alloy: 0xb9c3cd, ash: 0xc8a06a,
                 oak: 0x8a6a42, grip: 0x4a3a30, brass: 0xc9a227 };
function buildBlade(name) {
  const spec = BLADES[name];
  const g = new Group();
  for (const s of spec.segments) {
    const len = Math.max(0.004, s.to - s.from);
    const metal = s.material === 'steel' || s.material === 'brass';
    const bar = new Mesh(
      new CylinderGeometry(
        Math.max(0.004, (s.width[1] + s.thick[1]) / 3),
        Math.max(0.004, (s.width[0] + s.thick[0]) / 3),
        len, 8
      ),
      new MeshStandardMaterial({
        color: COLOUR[s.material] ?? 0x9aa3ad,
        metalness: metal ? 0.35 : 0.05,
        roughness: metal ? 0.4 : 0.85,
        emissive: metal ? 0x1a1f24 : 0x120d08,
      })
    );
    // The socket sits at the palm, so the blade runs out along +Y from the grip.
    bar.position.y = (s.from + s.to) / 2 - spec.grip;
    g.add(bar);
  }
  return g;
}

const LONG = 'longsword';
const SHORT = 'arming';

const a = new Fencer(createHumanoid({ seed: 42 }), {
  blade: LONG, hands: 2, style: 'karate', skill: 0.85,
  prop: buildBlade(LONG), at: new Vector3(-1.9, 0, 0),
});
const b = new Fencer(createHumanoid({ seed: 7 }), {
  blade: SHORT, hands: 1, style: 'boxing', skill: 0.85,
  prop: buildBlade(SHORT), at: new Vector3(1.9, 0, 0),
});
scene.add(a.rig.object, b.rig.object);

const bout = new Fence(a, b, { roundSeconds: 45 });

// Each fencer's measure, drawn on the floor. The BAND between the two rings is
// where one of them can reach and the other cannot.
const rings = [a, b].map((f, i) => {
  const ring = new Mesh(
    new RingGeometry(f.measure - 0.03, f.measure, 64),
    new MeshStandardMaterial({
      color: i === 0 ? 0x3a8fd0 : 0xd8862a,
      emissive: i === 0 ? 0x0b2438 : 0x3a1c06,
      side: DoubleSide, transparent: true, opacity: 0.55,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);
  return ring;
});

// A post each: what has landed on them.
const posts = [a, b].map((f, i) => {
  const post = new Mesh(
    new CylinderGeometry(0.06, 0.06, 1, 10),
    new MeshStandardMaterial({ color: 0xcc4422, emissive: 0x3a1408 })
  );
  post.position.set(i === 0 ? -3.4 : 3.4, 0.5, -1.6);
  scene.add(post);
  return post;
});

let t = 0;

game.onUpdate((frame) => {
  const dt = Math.min(0.05, frame.delta);
  t += dt;
  if (!bout.done) bout.update(dt);

  // THE ARMS. The hand travels a real arc through the phase and solveLimb
  // solves the elbow for it, so the blade sweeps because the arm swept.
  poseSwordArm(a);
  poseSwordArm(b);

  for (const [i, f] of [a, b].entries()) {
    rings[i].position.set(f.at.x, 0.02, f.at.z);
    const h = 0.08 + f.taken * 0.16;
    posts[i].scale.y = h;
    posts[i].position.y = h / 2;
  }

  // Track the midpoint of the engagement, easing so the camera does not jitter.
  const mx = (a.at.x + b.at.x) / 2;
  const mz = (a.at.z + b.at.z) / 2;
  look.lerp(new Vector3(mx, 1.1, mz), Math.min(1, dt * 2));
  eye.lerp(new Vector3(mx, 3.4, mz + 6.4), Math.min(1, dt * 2));
  game.camera.position.copy(eye);
  game.camera.lookAt(look);
});

// The camera FOLLOWS. A bout that circles drifts across the floor, and a fixed
// camera watches it walk out of frame — which is what the first screenshot of
// this scene showed.
const eye = new Vector3(0, 3.4, 6.4);
const look = new Vector3(0, 1.1, 0);
game.camera.position.copy(eye);
game.camera.lookAt(look);

window.fenceDebug = () => ({
  // The scene's own clock — headless runs at about a third of real time, and a
  // bout nobody has started looks exactly like one that never moves.
  clock: Number(t.toFixed(1)),
  gap: Number(bout.gap.toFixed(3)),
  contested: Number(bout.contested.toFixed(1)),
  arrivals: bout.touches.length,
  parried: bout.touches.filter((x) => x.parried).length,
  fencers: [a, b].map((f) => ({
    blade: f.blade,
    // Derived, every one: mass and inertia from the segment table, couple from
    // the hilt, tempo from those two, measure from a bone length plus steel.
    measure: Number(f.measure.toFixed(3)),
    tempo: Number(f.tempo.toFixed(4)),
    torque: Number(f.torque.toFixed(1)),
    speed: Number(f.speed.toFixed(3)),
    phase: f.phase,
    attacks: f.attacks,
    parries: f.parries,
    inBand: f.inBand,
    touches: f.touches,
    taken: f.taken,
    // THE POINT OF THE RELEASE: metres of floor covered.
    travelled: Number(f.travelled.toFixed(2)),
    at: [Number(f.at.x.toFixed(2)), Number(f.at.z.toFixed(2))],
  })),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
  {
    id: 'aloud',
    title: 'Aloud: the browser speaks, ANIMA moves the mouth',
    group: 'Character',
    code: `// THE SEAM, WITH A REAL VOICE ON THE OTHER SIDE OF IT.
//
// This is the first scene in the trilogy where a face and a voice are the same
// event and the two packages that produce them have never heard of each other.
//
//   gama3d   speakAloud() hands the line to the BROWSER's speech synthesizer,
//            and returns an object whose mouthAt(seconds) says what a mouth
//            should be doing then. It knows nothing about rigs.
//   anima3d  Speech.attach() takes that function and drives a jaw with it. It
//            knows nothing about formants, lexicons or SpeechSynthesis.
//
// What they share is not a type and not an import. It is that F1 IS MOUTH
// OPENING — a jaw that drops raises the first formant, in the geometry and in
// the air — so a shape derived from a pronunciation and a shape drawn on a face
// are descriptions of one thing.
//
// WHY attach() AND NOT follow()
//
// follow() bakes a timeline when you call it. SpeechSynthesis will not give you
// one: it reports WORD boundaries as it reaches them, and each one re-anchors
// everything after it. It also starts whenever it feels like starting. So the
// face reads the source every frame, off the SOURCE's clock, not its own.
//
// Watch the readout. Every time a word boundary lands, the platform has told us
// something the plan did not know, and the mouth's future moves.
//
// WITH NO PLATFORM VOICE INSTALLED — headless Chromium, a Linux box with no
// speech-dispatcher — the line falls back to its own plan and the face still
// talks. A missing voice costs you the audio, not the animation.
//
// Click the face to hear it.
import { createHumanoid, createMouth, createBrows, createEyes, Locomotion, Speech,
         Brows, Blinking, ANTICIPATION, ACCENT_SEMITONES, BLINK_RATE } from 'anima3d';
import { speakAloud, speechAvailable, voiceOf } from 'gama3d';
// STUDIO already imports Mesh and MeshStandardMaterial.
import { BoxGeometry } from 'three';
${STUDIO}

const LINE = 'the traveller stopped at the gate and asked for the keeper by name';

// The body decides the voice. voiceOf derives a vocal tract from a height
// through the same tube the formants come from, and speakAloud maps that onto
// utterance.pitch as a RATIO — so a tall NPC is lower than a short one by the
// same factor whatever the platform's neutral voice happens to be.
const HEIGHT = 1.82;
const VOICE = voiceOf({ height: HEIGHT });

const rig = createHumanoid({
  seed: 41, height: HEIGHT, accessories: 'none',
  hair: { style: 'side-part' }, face: { facialHair: 'none' },
});
scene.add(rig.object);
const idle = new Locomotion(rig);
const mouth = createMouth(rig);
const speech = new Speech('', {});

// THE SECOND HALF OF THE SEAM, and it is the same shape as the first.
//
// Ekman's "About Brows" (1979): a brow raise is a CONVERSATIONAL signal before
// it is an emotional one — it marks the emphasised word and it goes up on a
// question. Cavé et al. (1996) put about seven in ten of them on a rise in F0.
// So the brows do not need a mood. They need the pitch contour, and
// SpokenLine.pitchAt has exactly the signature PitchSource asks for.
//
// What the brow tracks is pitch above a RUNNING FLOOR, not pitch. English
// declines about half a semitone a second, so over this line the whole contour
// sinks a couple of semitones while the accents keep landing — a brow wired
// straight to pitch would sink with it and the speaker would look like they
// were falling asleep by the full stop.
const brows = createBrows(rig);
const face = new Brows();

// AND THE BLINK RATE IS NOT A NUMBER SOMEBODY PICKED.
//
// Bentivoglio et al. (1997) counted spontaneous blinks in ninety adults: 17 a
// minute at rest, 4.5 READING, and 26 IN CONVERSATION. Reading suppresses it to
// a quarter and talking nearly doubles it — a factor of six from nothing but
// the task. So this face does not have a blink parameter; it says what it is
// doing, and the rate comes out of the table.
//
// Watch the counter. While it is speaking the eyes blink about six times as
// often as they do in the pause between lines, and nothing here schedules that.
const eyes = createEyes(rig);
const lids = new Blinking({ task: 'rest', seed: 12 });

// The word ticks: one block per word, lighting up as the platform reports it.
// Nothing here schedules them — they arrive when the engine says so.
const WORDS = LINE.split(' ');
const ticks = WORDS.map((w, i) => {
  const m = new Mesh(
    new BoxGeometry(0.028, 0.02, 0.02),
    new MeshStandardMaterial({ color: 0x475569, emissive: 0x475569, emissiveIntensity: 0.3 })
  );
  // Above the head, not below the chin: the preview pane is a head-and-
//   shoulders framing and the first screenshot had the whole strip off the
//   bottom edge, which is a readout nobody can read.
  m.position.set((i - (WORDS.length - 1) / 2) * 0.034, 1.90, 0.12);
  scene.add(m);
  return m;
});

let line = null;
let marks = 0;
let said = 0;
const say = () => {
  if (line && !line.done) return;
  marks = 0;
  said++;
  for (const t of ticks) t.material.emissiveIntensity = 0.3;
  line = speakAloud(LINE, VOICE, {
    onWord: (index) => {
      marks++;
      if (ticks[index]) ticks[index].material.emissiveIntensity = 1.6;
    },
  });
  // THE WHOLE WIRING, and it is three arguments. The face asks the line what
  // the mouth should be, at the line's own clock, until the line says it is
  // done. anima3d adds its own ANTICIPATION lead to that clock, because a mouth
  // arriving before the sound is a fact about faces and belongs on this side.
  const clock = () => Math.max(0, line.elapsed());
  speech.attach(line.mouthAt, { clock, done: () => line.done });
  face.attach(line.pitchAt, { clock, done: () => line.done });
};
game.renderer.domElement.addEventListener('pointerdown', say);

let idleFor = 0;
game.onUpdate(({ delta }) => {
  const dt = Math.min(0.05, delta);
  idleFor += dt;
  if (!line || (line.done && idleFor > 2.5)) { idleFor = 0; say(); }

  idle.update(dt, { speed: 0 });
  mouth.apply(speech.update(dt));
  brows.apply(face.update(dt));
  // The task IS what the agent is doing. Nothing here translates it into a
  // rate: 'conversing' and 'rest' are two rows of Bentivoglio's table, and the
  // six-fold swing in the counter is what the table says, not what this says.
  const speaking = !!line && !line.done && line.elapsed() >= 0;
  eyes.apply(lids.update(dt, { task: speaking ? 'conversing' : 'rest' }));

  game.camera.position.set(0, 1.70, 1.30);
  game.camera.lookAt(0, 1.70, 0);
});

window.aloudDebug = () => {
  const s = speech.shape;
  return {
    // Whether the API exists — NOT whether it can speak. Headless Chromium has
    // the API and zero voices, which is exactly the case fellBack covers.
    platformApi: speechAvailable(),
    fellBack: !!line && line.fellBack,
    live: speech.live,
    said,
    words: WORDS.length,
    // Word boundaries the engine has reported. Zero without a voice, and the
    // face still moves, which is the point.
    marks,
    elapsed: line ? Number(Math.max(-1, line.elapsed()).toFixed(2)) : -1,
    speaking: !!line && !line.done && line.elapsed() >= 0,
    anticipation: ANTICIPATION,
    accentSemitones: ACCENT_SEMITONES,
    // The contour the face is punctuating with, and the lift it produced.
    pitch: line ? Number(line.pitchAt().toFixed(2)) : 0,
    brow: Number(face.shape.raise.toFixed(3)),
    // The eyes: the rate the task asks for, and the lid the rig is showing.
    blinkTask: lids.task,
    blinkRate: BLINK_RATE[lids.task],
    blinks: lids.count,
    lid: Number(lids.shape.lid.toFixed(3)),
    aperture: Number(eyes.aperture().toFixed(5)),
    browY: Number(brows.group.children[0].position.y.toFixed(5)),
    mouth: {
      open: Number(s.open.toFixed(3)),
      close: Number(s.close.toFixed(3)),
      round: Number(s.round.toFixed(3)),
      spread: Number(s.spread.toFixed(3)),
    },
    // The jaw gap the RIG actually shows, in metres — not the number the
    // controller reports, because a controller that returns a beautiful shape
    // and a prop that ignores it look identical from the controller.
    gap: Number(Math.max(0,
      mouth.group.children[1].position.y - mouth.group.children[2].position.y - 0.0075 * HEIGHT
    ).toFixed(4)),
    draws: game.renderer.info.render.calls,
  };
};

game.start();
`,
  },
  {
    id: 'talking',
    title: 'Speech: two mouths, and only one of them shuts',
    group: 'Character',
    code: `// THE VISEME TABLE HAS BEEN PUBLISHED SINCE 1888.
//
// Every lipsync system starts by inventing a list of mouth shapes and a mapping
// from sounds onto them. That list already exists. It is the IPA vowel chart,
// and its two axes are exactly the two things a mouth visibly does:
//
//   VOWEL HEIGHT   close ... open       is how far the jaw is down
//   ROUNDEDNESS    spread ... rounded   is what the lips are doing
//
// So mouthOf() is two lookups and a subtraction. /i/ is close and unrounded, so
// the jaw is nearly shut and the lips are wide; /u/ is close and rounded, so the
// jaw is nearly shut and the lips are pursed. Nobody decided any of that.
//
// WHAT THIS SCENE IS ARGUING
//
// Two heads. The left one is saying "mama papa mama". The right one is saying
// "halo sisi halo". Watch the LIPS, not the jaws.
//
// The left mouth SLAMS SHUT four times a second and the right one never does,
// and that is the whole release. /p/, /b/ and /m/ are made by sealing the lips —
// three different sounds and one picture, which is why lip-reading is hard — and
// if the seal is blended down to 60% the face reads as flapping vaguely and
// every viewer knows something is wrong without being able to say what.
//
// So closure is NOT blended like the other channels. It is taken as a MAXIMUM
// over the neighbours, because that is what a seal physically is: the lips are
// shut or they are not, and averaging shut with open does not give half-shut, it
// gives wrong.
//
// THE PALE BAR
//
// Hanging between them is the readout: five bars per talker, left group for the
// left mouth. Four are solid — jaw, round, seal, spread — and one is pale.
//
// The pale bar is what the coarticulation blend ASKED the jaw for. The solid
// one next to it is what the jaw actually reached. The difference between them
// is UNDERSHOOT: a short vowel between two consonants never gets to its own
// opening, because a jaw peaks at about 200 mm/s and there is not time to get
// there and back. Lindblom measured that in 1963, and nothing here encodes it —
// it falls out of one published speed limiting one published duration.
//
// AND THE SEAL WAITS FOR THE JAW
//
// The lips are not rate-limited; they are light and they shut in fifty
// milliseconds. The jaw is a bone. So the blend calls for a seal while the jaw
// is still twenty-five millimetres down from the vowel — and lips are only
// about twenty-four millimetres long, so for a moment there is no seal
// available to have.
//
// Watch the red bar on "mama": it rises fast, hesitates just short of full, and
// completes as the jaw arrives. That hesitation is LIP_BRIDGE / (open ×
// JAW_TRAVEL) — two anatomical lengths and a division. It also predicts that at
// speech fast enough for the jaw never to get back up, bilabial closure
// degrades, which is the lips' half of the same undershoot.
import { BoxGeometry, Group } from 'three';
import { JAW_SPEED, JAW_TRAVEL, PHONEMES, Locomotion, Speech, createHumanoid,
         createMouth, mouthAt, visemeOf } from 'anima3d';
${STUDIO}

// Two talkers. The only difference that matters between them is whether there
// is a bilabial in the line.
const LINES = [
  { keys: 'mama.papa.mama.', seed: 42, x: -0.3, bilabial: true },
  { keys: 'halo.sisi.halo.', seed: 7, x: 0.3, bilabial: false },
];

const BAR = { ghost: 0x7d8698, jaw: 0xd8a83a, round: 0x3a8fd0, seal: 0xcc4422, spread: 0x54b070 };
const CHANNELS = ['ghost', 'jaw', 'round', 'seal', 'spread'];

// ONE readout, hung between the two of them and in front, so the two seal bars
// end up side by side. Two panels beside two heads did not fit the frame, and a
// readout you cannot see is not instrumentation.
const panel = new Group();
panel.position.set(0, 1.4, 0.38);
scene.add(panel);

const talkers = LINES.map((line, side) => {
  // No hat, no moustache: this scene is an argument about a mouth, and the
  // first screenshot of it had the left talker's seal hidden under facial hair.
  const rig = createHumanoid({
    seed: line.seed, height: 1.75, accessories: 'none',
    hair: { style: 'side-part' }, face: { facialHair: 'none' },
  });
  rig.object.position.x = line.x;
  // Turned a few degrees toward the camera, so a seal is a silhouette change
  // and not only a head-on one.
  rig.object.rotation.y = line.x > 0 ? -0.22 : 0.22;
  scene.add(rig.object);
  // Idle locomotion, purely so the arms hang. A rig straight out of the
  // constructor is in its bind pose, and the first screenshot was two people
  // in a T-pose talking about phonetics.
  const idle = new Locomotion(rig);

  // The face createHumanoid builds is baked into the skinned mesh — no jaw bone
  // and no morph target — so a moving mouth is an overlay parented to the Head,
  // sized off the same body height the baked face was.
  const mouth = createMouth(rig);
  const speech = new Speech(line.keys, { loop: true });

  // This talker's five channels, HANGING DOWN from the panel so they never
  // climb across the faces.
  const bars = CHANNELS.map((name, i) => {
    const bar = new Mesh(
      new BoxGeometry(0.03, 1, 0.03),
      new MeshStandardMaterial({
        color: BAR[name],
        emissive: BAR[name],
        emissiveIntensity: name === 'ghost' ? 0.12 : 0.5,
        transparent: name === 'ghost',
        opacity: name === 'ghost' ? 0.5 : 1,
      })
    );
    bar.position.x = (side - 0.5) * 0.26 + (i - 2) * 0.042;
    // The ghost stands just behind the jaw bar it is the target for, so
    // undershoot reads as one bar falling short of another.
    bar.position.z = name === 'ghost' ? -0.045 : 0;
    if (name === 'ghost') bar.position.x += 0.042;
    panel.add(bar);
    return bar;
  });

  return { keys: line.keys, bilabial: line.bilabial, rig, idle, mouth, speech, bars };
});

const sealedFrames = [0, 0];
let t = 0;
// A seal lasts about fifty milliseconds, and a screenshot cannot be aimed that
// precisely. So the scene can be stopped on one — window.speechPause() — which
// is how the picture in the docs was taken with the lips actually shut.
let paused = false;
window.speechPause = () => { paused = true; };

game.onUpdate((frame) => {
  if (paused) return;
  const dt = Math.min(0.05, frame.delta);
  t += dt;

  talkers.forEach((talker, i) => {
    talker.idle.update(dt, 0);

    // The controller steps the utterance and rate-limits the jaw.
    const shape = talker.speech.update(dt);
    talker.mouth.apply(shape);
    if (shape.close > 0.9) sealedFrames[i]++;

    // ...and this is the unlimited target it was chasing, for the pale bar.
    const want = mouthAt(talker.speech.track, talker.speech.elapsed);
    const set = (bar, v) => {
      const h = Math.max(0.008, v * 0.13);
      bar.scale.y = h;
      bar.position.y = -h / 2;
    };
    set(talker.bars[0], want.open);
    set(talker.bars[1], shape.open);
    set(talker.bars[2], shape.round);
    set(talker.bars[3], shape.close);
    set(talker.bars[4], shape.spread);

    // A head that never moves reads as a mask with a mouth cut in it. The nod
    // rides the jaw a little, because an open jaw drops the chin.
    talker.rig.bones.Head.rotation.x = Math.sin(t * 0.9 + i) * 0.05 - shape.open * 0.06;
    talker.rig.bones.Head.rotation.z = Math.sin(t * 0.6 + i * 2) * 0.04;
  });

  // Head-and-shoulders, close enough that a lip seal is legible. It is not
  // legible from across a room, which is exactly why lip-reading is hard — and
  // the first screenshot of this scene was taken from across a room.
  game.camera.position.set(Math.sin(t * 0.25) * 0.14, 1.6, 1.05);
  game.camera.lookAt(0, 1.58, 0);
});

window.speechDebug = () => {
  const at = (talker) => {
    const e = talker.speech.elapsed;
    const seg = talker.speech.track.find((s) => e >= s.at && e < s.at + s.duration);
    return seg ? seg.key : '.';
  };
  return {
    // The scene's own clock — a headless run is about a third of real time, and
    // a mouth nobody has started looks exactly like one that never moves.
    clock: Number(t.toFixed(1)),
    jawSpeed: JAW_SPEED,
    jawTravel: JAW_TRAVEL,
    phonemes: Object.keys(PHONEMES).length,
    talkers: talkers.map((talker, i) => ({
      line: talker.keys,
      length: Number(talker.speech.length.toFixed(3)),
      phoneme: at(talker),
      viseme: visemeOf(at(talker)),
      // THE POINT OF THE SCENE: the left mouth seals and the right one cannot.
      bilabial: talker.bilabial,
      sealedFrames: sealedFrames[i],
      seal: Number(talker.speech.shape.close.toFixed(3)),
      jaw: Number(talker.speech.shape.open.toFixed(3)),
      // ...and the undershoot, as two numbers: asked for, against reached.
      wanted: Number(mouthAt(talker.speech.track, talker.speech.elapsed).open.toFixed(3)),
      syllables: talker.speech.track.filter((s) => PHONEMES[s.key].kind === 'vowel').length,
    })),
    draws: game.renderer.info.render.calls,
  };
};

game.start();
`,
  },
  {
    id: 'matching',
    title: 'Motion matching: the weights were units all along',
    group: 'Character',
    code: `// A CONTROLLER THAT IS A SEARCH, NOT A BLEND TREE.
//
// Motion matching holds a database of poses, each described by a feature
// vector; every frame it builds a query out of what the character is doing and
// what it has been asked to do, and plays whichever frame is nearest. No state
// machine, no blend graph. The data is the controller.
//
// THE PART EVERYBODY HAS A TABLE FOR
//
// The cost function adds foot positions to foot velocities to trajectory
// points, and those are metres, metres per second and metres. You cannot add
// them, so every implementation puts a table of weights beside the sum:
//
//   w_footPosition = 1.0     w_footVelocity = 0.4     w_trajectory = 1.5
//
// Nobody can say why. They are tuned by eye and re-tuned per character.
//
// They are not preferences. They are UNIT CONVERSIONS. A velocity becomes a
// length when multiplied by a time; a trajectory point already is one. So the
// table collapses to a single time constant, every term is in square metres,
// and every weight is 1.
//
// And the time constant is measured rather than chosen: it is
// σ(foot position) / σ(foot velocity) over the database's own samples — the
// time that makes both halves span the same range of numbers.
//
// WHAT THIS SCENE IS FOR
//
// Two identical people. The near one is driven by the matcher, the far one by
// ANIMA's ordinary blend tree, and BOTH ARE GIVEN THE SAME COMMAND — the amber
// bar overhead. Each then travels at the speed its own feet are actually doing,
// which is the honest way to move a character with in-place clips.
//
// So watch the gap OPEN AND SHUT. The blend tree smooths the commanded speed
// and then stride-matches to the smoothed number, which makes it late by
// construction; the search just picks a frame that is already going that fast.
//
// On a command to speed up, the matcher is away first and pulls ahead. On a
// command to slow down it slows first and drops behind. Over a symmetric run
// the two very nearly cancel — the matcher is not FASTER, it is EARLIER, and
// the lead in the readout swings either side of zero for exactly that reason.
// What the search buys is the 0.13 s answer against the blend tree's 0.27.
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { applyFog, createLightingRig, createSky, createSurface, PALETTES } from 'scena3d';
import { Locomotion, MotionMatcher, buildMotionDatabase, createHumanoid } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const floor = new Mesh(new PlaneGeometry(400, 40), createSurface('concrete', { seed: 4 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// A mark every four metres, so travel is legible without a HUD.
for (let i = -10; i < 60; i++) {
  const stripe = new Mesh(
    new BoxGeometry(0.14, 0.02, 11),
    new MeshStandardMaterial({ color: i % 5 === 0 ? 0xd8c8a0 : 0x55555c })
  );
  stripe.position.set(i * 4, 0.011, 0);
  scene.add(stripe);
}

// The same person twice: same seed, same body, same clips.
const near = createHumanoid({ seed: 21, height: 1.75 });
const far = createHumanoid({ seed: 21, height: 1.75 });
near.object.position.set(0, 0, 2.6);
far.object.position.set(0, 0, -2.6);
near.object.rotation.y = Math.PI / 2;
far.object.rotation.y = Math.PI / 2;
scene.add(near.object, far.object);

const database = buildMotionDatabase(near);
const matcher = new MotionMatcher(near, { database });
const blend = new Locomotion(far);

const WALK = database.clips.walkSpeed;
const RUN = database.clips.runSpeed;
// A square wave of commands, because a step change is the only thing that tells
// two controllers apart. In the steady state they agree almost exactly.
const COMMANDS = [0.0, WALK, RUN, WALK * 0.6, RUN, 0.0, WALK];
const HOLD = 3.2;

// The command, and what each controller is actually doing about it, as bars.
const bar = (colour, z) => {
  const m = new Mesh(
    new BoxGeometry(0.44, 1, 0.44),
    new MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.4 })
  );
  m.position.z = z;
  scene.add(m);
  return m;
};
// All three at the SAME depth, side by side, or perspective does the comparing
// instead of the numbers: with each bar standing over its own runner, the near
// one read as taller while being the slower of the two.
const commandBar = bar(0xd8a83a, -7.6);
const matcherBar = bar(0x54b070, -7.6);
const blendBar = bar(0x3a8fd0, -7.6);

// A post dropped wherever the matcher jumped, so the pops are countable.
const pops = new Group();
scene.add(pops);
let seenJumps = 0;

let t = 0;
let travelNear = 0;
let travelFar = 0;

game.onUpdate((frame) => {
  const dt = Math.min(0.05, frame.delta);
  t += dt;
  const want = COMMANDS[Math.floor(t / HOLD) % COMMANDS.length];

  matcher.update(dt, want);
  blend.update(dt, want);

  // EACH TRAVELS AT THE SPEED ITS OWN FEET ARE DOING. The clips are in-place
  // and stride-matched, so this is exactly the ground the feet are covering —
  // no sliding, and no cheating the comparison by moving both at the command.
  travelNear += matcher.speed * dt;
  travelFar += blend.speed * dt;
  near.object.position.x = travelNear;
  far.object.position.x = travelFar;

  if (matcher.jumps > seenJumps) {
    seenJumps = matcher.jumps;
    const post = new Mesh(
      new BoxGeometry(0.08, 0.4, 0.08),
      new MeshStandardMaterial({ color: 0xcc4422, emissive: 0x3a1408 })
    );
    // Behind the lanes: a pop is a footnote, not the subject.
    post.position.set(travelNear, 0.2, -4.6);
    pops.add(post);
  }

  // Each bar stands over the runner it belongs to, so it is that runner's
  // speed and not a chart. The amber one out in front is the command both were
  // given.
  const set = (m, v, x) => {
    const h = Math.max(0.04, (v / RUN) * 3.2);
    m.scale.y = h;
    m.position.set(x, h / 2, m.position.z);
  };
  const lead = Math.max(travelNear, travelFar);
  // green matcher, amber command, blue blend tree — in that order, left to
  // right, so the two controllers flank what they were both asked for.
  set(matcherBar, matcher.speed, lead - 1.3);
  set(commandBar, want, lead);
  set(blendBar, blend.speed, lead + 1.3);

  // Follow from the side, close enough to see two people and the gap between
  // them. The first framing of this scene was from thirty metres and showed
  // two dots on a grid.
  game.camera.position.set(lead - 2.0, 2.3, 8.2);
  game.camera.lookAt(lead + 0.2, 1.15, 0);
});

window.matchingDebug = () => ({
  // The scene's own clock — headless runs at about a third of real time, and a
  // controller nobody has started looks exactly like one that never moves.
  clock: Number(t.toFixed(1)),
  commanded: Number((COMMANDS[Math.floor(t / HOLD) % COMMANDS.length]).toFixed(3)),
  // Fifteen features, and every one of them a length in metres.
  features: database.frames[0].feature.length,
  frames: database.frames.length,
  // MEASURED from the data, not chosen: σ(position) / σ(foot velocity).
  tauFoot: Number(database.tauFoot.toFixed(4)),
  horizons: database.horizons.map((h) => Number(h.toFixed(3))),
  matcher: {
    speed: Number(matcher.speed.toFixed(3)),
    clip: matcher.frame.clip,
    rate: matcher.frame.rate,
    travelled: Number(travelNear.toFixed(2)),
    jumps: matcher.jumps,
    searches: matcher.searches,
  },
  blend: {
    speed: Number(blend.speed.toFixed(3)),
    travelled: Number(travelFar.toFixed(2)),
  },
  // Signed, and it swings: ahead after a command to go faster, behind after a
  // command to slow down. Being earlier is not the same as being faster.
  lead: Number((travelNear - travelFar).toFixed(2)),
  draws: game.renderer.info.render.calls,
});

game.start();
`,
  },
];

export function findExample(id: string): Example {
  return EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0];
}
