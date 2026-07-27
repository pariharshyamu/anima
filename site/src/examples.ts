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
  createSurface } from 'scena3d';
import { createHumanoid, Locomotion, FootIK } from 'anima3d';
import { Game, TouchControls } from 'gama3d';
import { Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial,
  AmbientLight, DirectionalLight, HemisphereLight, Color, Fog,
  Raycaster, Vector2, Vector3 } from 'three';

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
  shallowColor: 0x45dcd2, deepColor: 0x0a6fb4, skyColor: 0x9fd8ea,
  // Breakers running in, and a waterline that runs up the sand and drains.
  surf: { breakDepth: 1.8, runUp: 0.45, period: 8, bands: 2.4 },
});
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
  buttons: [{ label: 'RUN', code: 'ShiftLeft', css: 'right:26px;bottom:38px' }],
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

const WALK = 1.5, RUN = 4.2;
const axis = new Vector2();
const velocity = new Vector3();
let facing = Math.PI;

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
  p.x = Math.max(-70, Math.min(70, p.x + velocity.x * dt));
  p.z = Math.max(-3, Math.min(46, p.z + velocity.z * dt));   // shallows to dune
  p.y = profile(p.x, p.z);
  hero.object.rotation.y = facing;

  // THE SWASH IS NOT JUST A PICTURE. depthOver reads the very run-up the
  // shader is drawing, so the walker is caught by the wave you watched
  // arrive: ankle deep it wades short and heavy, deeper it slows right
  // down. One simulation — the water never disagrees with itself.
  const wade = ocean.depthOver(p.y);
  loco.update(dt, velocity.clone().multiplyScalar(wade > 0.15 ? 0.45 : 1));
  feet.weight = wade > 0.25 ? 0 : 1;   // no foot planting once they are in it

  feet.update();                 // plants the feet on SCENA's sand

  const REACH = 6.6;
  camAim.set(p.x, p.y + 1.4, p.z);
  camWant.set(Math.sin(camYaw) * REACH, 4.4, Math.cos(camYaw) * REACH);
  ray.set(camAim, camWant.clone().normalize());
  ray.far = REACH;
  const hit = ray.intersectObjects(blockers, true)[0];
  camWant.setLength(hit ? Math.max(3.8, hit.distance - 0.35) : REACH).add(camAim);
  game.camera.position.lerp(camWant, Math.min(1, dt * 7));
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
];

export function findExample(id: string): Example {
  return EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0];
}
