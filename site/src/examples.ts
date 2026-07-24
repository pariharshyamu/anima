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
];

export function findExample(id: string): Example {
  return EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0];
}
