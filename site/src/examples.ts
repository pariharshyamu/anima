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
    code: `// A playable racing game, phone AND desktop: drive with WASD/arrows or
// the on-screen touch pads. SCENA paves the circuit and builds the cars,
// your ANIMA driver holds the wheel (glued to the moving seat), and two
// GAMA rivals lap the ring on FollowPath agents. Lap timer top right.
import { createCar, createPath, createPlanter, createTree, createSky,
         createLightingRig, applyFog, createSurface, PALETTES } from 'scena3d';
import { createHumanoid, Interaction, Locomotion, OUTFITS } from 'anima3d';
import { Game, MotionAgent, FollowPath, Path } from 'gama3d';
import { Mesh, PlaneGeometry, Vector3 } from 'three';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(320, 320), createSurface('concrete'));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

// The circuit: a kinked ring, paved by createPath.
const WAYPOINTS = [];
for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2;
  const r = 26 + Math.sin(a * 2) * 7;
  WAYPOINTS.push({ x: Math.cos(a) * r * 1.35, z: Math.sin(a) * r });
}
scene.add(createPath(WAYPOINTS, { width: 7, loop: true, palette }).mesh);
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

// Your car — with your driver glued to the seat.
const car = createCar({ seed: 3, color: 0xb8433a, palette });
scene.add(car.object);
const start = WAYPOINTS[0];
let heading = Math.atan2(WAYPOINTS[1].x - start.x, WAYPOINTS[1].z - start.z);
car.object.position.set(start.x, 0, start.z);
car.object.rotation.y = heading;
const rig = createHumanoid({ seed: 9, palette: OUTFITS.villager });
scene.add(rig.object);
const loco = new Locomotion(rig);
const act = new Interaction(rig, loco);
act.use(car.slots[0], { fade: 0.01 });

// Two GAMA rivals on the loop.
const lapPoints = WAYPOINTS.map((p) => new Vector3(p.x, 0, p.z));
const rivals = [0x3a6ea5, 0x3f7f5c].map((color, i) => {
  const rival = createCar({ seed: 11 + i, color, palette });
  const carrier = game.world.spawn('rival-' + i);
  carrier.add(rival.object);
  carrier.position.copy(lapPoints[(3 + i * 6) % lapPoints.length]);
  const agent = carrier.addComponent(
    new MotionAgent({ maxSpeed: 9 + i * 2, maxForce: 16, planar: true }));
  agent.addBehavior(new FollowPath(new Path(lapPoints, true), 2.4));
  return { rival, agent, carrier };
});

// Input: keyboard + touch pads (drawn into the page — works on phones).
const keys = { left: false, right: false, up: false, down: false };
const KEYMAP = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
                 ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.key]; if (k) { keys[k] = true; e.preventDefault(); }
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });
const pad = (label, css, key) => {
  const b = document.createElement('div');
  b.textContent = label;
  b.style.cssText = 'position:fixed;z-index:10;width:64px;height:64px;' +
    'border-radius:16px;background:rgba(255,255,255,.13);border:1px solid ' +
    'rgba(255,255,255,.35);color:#fff;font:700 24px system-ui;display:flex;' +
    'align-items:center;justify-content:center;user-select:none;touch-action:none;' + css;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys[key] = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
    b.addEventListener(ev, () => { keys[key] = false; }));
  document.body.appendChild(b);
};
pad('\\u25C0', 'left:16px;bottom:24px', 'left');
pad('\\u25B6', 'left:96px;bottom:24px', 'right');
pad('\\u25BC', 'right:96px;bottom:24px', 'down');
pad('\\u25B2', 'right:16px;bottom:24px', 'up');
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;top:10px;right:12px;z-index:10;color:#fff;' +
  'text-align:right;font:600 15px/1.5 system-ui;text-shadow:0 1px 3px #000';
if (innerWidth < 560) hud.style.top = '84px';
document.body.appendChild(hud);

// The race.
let speed = 0, lap = 0, lapTime = 0, best = Infinity;
let progress = 0, lastTheta = Math.atan2(start.z, start.x);
const camTarget = new Vector3(start.x, 5, start.z + 10);
game.camera.position.copy(camTarget);

game.onUpdate((t) => {
  const dt = Math.min(t.delta, 0.05);
  const throttle = keys.up ? 1 : keys.down ? -0.45 : 0;
  const steerIn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

  const top = throttle >= 0 ? 19 * throttle : 6 * throttle;
  const rate = Math.abs(top) > Math.abs(speed) ? 10 : 16;
  speed += Math.sign(top - speed) * Math.min(Math.abs(top - speed), rate * dt);
  if (throttle === 0) speed *= Math.max(0, 1 - 1.1 * dt);
  const p = car.object.position;
  let near = Infinity;                       // grass drag off the ribbon
  for (const w of WAYPOINTS) near = Math.min(near, Math.hypot(p.x - w.x, p.z - w.z));
  if (near > 5.5) speed *= Math.max(0, 1 - 2.2 * dt);

  heading -= steerIn * 1.75 * dt * Math.min(1, Math.abs(speed) / 5) * Math.sign(speed || 1);
  car.object.rotation.y = heading;
  p.x += Math.sin(heading) * speed * dt;
  p.z += Math.cos(heading) * speed * dt;
  car.update(dt, { speed: Math.abs(speed), steer: steerIn * 0.5 });
  loco.update(dt, 0);
  act.update(dt);

  for (const { rival, agent, carrier } of rivals) {
    const s = Math.hypot(agent.velocity.x, agent.velocity.z);
    if (s > 0.2) {
      const desired = Math.atan2(agent.velocity.x, agent.velocity.z);
      let delta = desired - carrier.rotation.y;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      carrier.rotation.y += delta * Math.min(1, 3.4 * dt);
      rival.update(dt, { speed: s, steer: delta * 1.3 });
    } else rival.update(dt, {});
  }

  // Laps: swept angle around the circuit centre.
  lapTime += dt;
  const theta = Math.atan2(p.z, p.x);
  let dTheta = theta - lastTheta;
  while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
  while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
  lastTheta = theta;
  progress += dTheta;
  if (Math.abs(progress) >= Math.PI * 2) {
    progress = 0; lap += 1; best = Math.min(best, lapTime); lapTime = 0;
  }
  hud.textContent = 'LAP ' + lap + ' \\u00B7 ' + lapTime.toFixed(1) + 's' +
    (best < Infinity ? ' \\u00B7 best ' + best.toFixed(1) + 's' : '') +
    ' \\u00B7 ' + Math.round(Math.abs(speed) * 3.6) + ' km/h';

  camTarget.set(p.x - Math.sin(heading) * 8.5, 4.4, p.z - Math.cos(heading) * 8.5);
  game.camera.position.lerp(camTarget, Math.min(1, 3.2 * dt));
  game.camera.lookAt(p.x + Math.sin(heading) * 4, 1, p.z + Math.cos(heading) * 4);
});
game.start();`,
  },
];

export function findExample(id: string): Example {
  return EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0];
}
