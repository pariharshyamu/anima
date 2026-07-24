/**
 * Havenbrook — a medieval village, the whole trilogy at once.
 *
 *   SCENA  builds the world: terrain, sky, golden light, and every prop —
 *          a town hall, cottages, a market, a fountain, banners, bunting,
 *          braziers, carts, statues, wells, fences, lamps, and a forest.
 *   ANIMA  gives it people: seeded farmers, villagers and knights, each a
 *          full rig with gaits, foot IK and gaze — plus a VAT crowd.
 *   GAMA   makes them live: steering agents walk the lanes, dodging the
 *          buildings via each prop's obstacle metadata.
 *
 * Nothing here changes the libraries — it is pure consumer code.
 *
 *   ?view=aerial | plaza | street | tavern   pick a framing (tavern = indoors)
 *   ?t=0.82                                  freeze the time of day (0..1)
 */
import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import {
  createTerrain,
  createSky,
  createLightingRig,
  applyFog,
  createDayCycle,
  createPath,
  createHouse,
  createWell,
  createRuin,
  createTower,
  createStall,
  createStatue,
  createBanner,
  createBunting,
  createBrazier,
  createCampfire,
  createFountain,
  createCart,
  createLamp,
  createFence,
  createTree,
  createRock,
  createBush,
  createGrassTuft,
  createSurface,
  createWindField,
  applyWind,
  createWeather,
  createSeasons,
  createRoom,
  furnishRoom,
  createInteriorLight,
  createFlock,
  createHerd,
  treeBiome,
  treeLOD,
  scatter,
  type TreeSpecies,
  type TreeSeason,
  type Season,
  collectObstacles,
  PALETTES,
  type Prop,
} from 'scena3d';
import {
  createHumanoid,
  Locomotion,
  FootIK,
  LookAt,
  Crowd,
  Interaction,
  OUTFITS,
  attach,
  createWaveClip,
  type HumanoidRig,
} from 'anima3d';
import { Game, MotionAgent, FollowPath, Path, ObstacleAvoidance, Separation } from 'gama3d';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'orbit';
const palette = PALETTES.meadow;

const game = new Game();
const scene = game.world.scene;

// ---------------------------------------------------------------- world
const terrain = createTerrain({ seed: 77, size: 120, amplitude: 2.2, palette });
scene.add(terrain.mesh);
const sky = createSky({ palette });
scene.add(sky.mesh);
const rig = createLightingRig('golden-hour');
scene.add(rig.group);
applyFog(scene, 'haze', palette);

const groundAt = (x: number, z: number): number => terrain.heightAt(x, z);
const at = (x: number, z: number): Vector3 => new Vector3(x, groundAt(x, z), z);

// A loop lane threading the village, and a tight plaza ring for patrols.
const lanePts = [
  { x: -22, z: -10 }, { x: -10, z: -20 }, { x: 12, z: -20 }, { x: 22, z: -8 },
  { x: 20, z: 12 }, { x: 6, z: 22 }, { x: -12, z: 20 }, { x: -22, z: 8 },
];
const lane = createPath(lanePts, { surface: groundAt, width: 2.4, loop: true, palette });
scene.add(lane.mesh);
const plazaRing = [
  { x: -8, z: -8 }, { x: 8, z: -8 }, { x: 9, z: 8 }, { x: -9, z: 9 },
];
const ringPath = createPath(plazaRing, { surface: groundAt, width: 1.6, loop: true, palette });
scene.add(ringPath.mesh);

// Everything that should block a walker is collected here.
const buildings: Prop[] = [];
const place = (prop: Prop, x: number, z: number, ry = 0, blocks = true): Prop => {
  prop.object.position.copy(at(x, z));
  prop.object.rotation.y = ry;
  scene.add(prop.object);
  if (blocks) buildings.push(prop);
  return prop;
};

// ------------------------------------------------------------- town hall
/** A grand two-storey town hall with a bell tower — composed inline. */
function makeTownHall(seed: number): Prop {
  const g = new Group();
  g.name = 'townhall';
  // A grand civic hall: ashlar block walls, a mossed stone plinth, tiled roof.
  const wall = createSurface('ashlar', { color: 0xbdb6a4, seed });
  const stone = createSurface('stone', { color: palette.rock[0], seed: seed + 1, cap: 0.35, capColor: 0x455a2c, capUp: 0.5 });
  const roofMat = createSurface('tile', { color: 0x7a3a2c, seed: seed + 2 });
  const beam = createSurface('wood', { color: palette.woodDark, seed: seed + 3 });
  const glassMat = new MeshStandardMaterial({
    color: palette.lampGlow, emissive: palette.lampGlow, emissiveIntensity: 1.0,
  });

  const W = 9, D = 6.5, H = 5.2;
  g.add(meshAt(new BoxGeometry(W + 0.6, 1.4, D + 0.6), stone, 0, -0.5, 0)); // plinth
  g.add(meshAt(new BoxGeometry(W, H, D), wall, 0, H / 2, 0)); // body
  // Corner quoins.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(meshAt(new BoxGeometry(0.5, H, 0.5), stone, sx * W / 2, H / 2, sz * D / 2));
  }
  // Hip roof (a squared pyramid, stretched to the footprint).
  const roof = meshAt(new ConeGeometry((W / 2 + 0.5) * Math.SQRT2, 2.6, 4), roofMat, 0, H + 1.3, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = (D + 1) / (W + 1);
  g.add(roof);
  // Timber banding between the storeys.
  g.add(meshAt(new BoxGeometry(W + 0.1, 0.22, D + 0.1), beam, 0, H * 0.52, 0));
  // Rows of tall windows, both storeys, all four... front & sides.
  for (const storey of [H * 0.3, H * 0.74]) {
    for (let i = -1; i <= 1; i++) {
      g.add(meshAt(new BoxGeometry(0.7, 1.1, 0.1), glassMat, i * 2.4, storey, D / 2 + 0.02));
    }
  }
  // Arched double door with steps.
  g.add(meshAt(new BoxGeometry(1.7, 2.4, 0.15), beam, 0, 1.2, D / 2 + 0.04));
  const arch = meshAt(new CylinderGeometry(0.85, 0.85, 0.15, 12, 1, false, 0, Math.PI), beam, 0, 2.4, D / 2 + 0.04);
  arch.rotation.z = Math.PI / 2; arch.rotation.x = Math.PI / 2;
  g.add(arch);
  g.add(meshAt(new BoxGeometry(2.6, 0.2, 0.7), stone, 0, 0.1, D / 2 + 0.5));
  g.add(meshAt(new BoxGeometry(3.0, 0.2, 1.0), stone, 0, -0.02, D / 2 + 0.75));

  // Central bell tower rising through the roof.
  const tW = 2.4, tH = H + 4.4;
  g.add(meshAt(new BoxGeometry(tW, tH, tW), wall, 0, tH / 2, -0.4));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(meshAt(new BoxGeometry(0.3, tH, 0.3), stone, sx * tW / 2, tH / 2, -0.4 + sz * tW / 2));
  }
  // Belfry openings (dark) + a hanging bell.
  for (const [dx, dz] of [[0, tW / 2], [0, -tW / 2], [tW / 2, 0], [-tW / 2, 0]] as const) {
    g.add(meshAt(new BoxGeometry(dz ? 1.0 : 0.12, 1.3, dz ? 0.12 : 1.0), new MeshStandardMaterial({ color: 0x1a1712 }), dx, tH - 1.2, -0.4 + dz));
  }
  const bell = meshAt(new CylinderGeometry(0.34, 0.44, 0.6, 10), createSurface('metal', { color: 0x8a6a2f, seed: seed + 5 }), 0, tH - 1.25, -0.4);
  g.add(bell);
  // A clock face on the front of the tower.
  const clock = meshAt(new CylinderGeometry(0.62, 0.62, 0.12, 16), new MeshStandardMaterial({ color: 0xe8e2d0, emissive: 0x2a2a22, flatShading: true }), 0, tH - 2.8, tW / 2 - 0.35);
  clock.rotation.x = Math.PI / 2; g.add(clock);
  for (const [rot, len] of [[0, 0.42], [Math.PI / 2.2, 0.3]] as const) {
    const hand = meshAt(new BoxGeometry(0.05, len, 0.03), new MeshStandardMaterial({ color: 0x1a1a1a }), 0, tH - 2.8, tW / 2 - 0.28);
    hand.position.y += Math.cos(rot) * len / 2; hand.position.x += Math.sin(rot) * len / 2;
    hand.rotation.z = rot; g.add(hand);
  }
  // Tower cap + a flag on the spire.
  const cap = meshAt(new ConeGeometry(tW * 0.95, 2.2, 4), roofMat, 0, tH + 1.1, -0.4);
  cap.rotation.y = Math.PI / 4; g.add(cap);
  const flag = createBanner({ seed: seed + 9, style: 'flag', pattern: 'cross', poleHeight: 1.6, palette });
  flag.object.position.set(0, tH + 2.1, -0.4); flag.object.scale.setScalar(0.9);
  g.add(flag.object);

  return { object: g, obstacleRadius: Math.hypot(W, D) / 2 + 0.4 };
}

function meshAt(geo: BufferGeometry, mat: MeshStandardMaterial, x: number, y: number, z: number): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// ------------------------------------------------------------ the layout
const hall = place(makeTownHall(1), 0, -15, 0);

// Cottages ringing the plaza and lining the lane, each facing inward.
const houseSpots: Array<[number, number]> = [
  [-16, -6], [-15, 6], [-12, 15], [2, 17], [14, 13],
  [17, 2], [16, -9], [10, -16], [-7, -14], [-20, 0],
];
const houses: Prop[] = [];
houseSpots.forEach(([x, z], i) => {
  const h = createHouse({ seed: 40 + i, palette });
  place(h, x, z, Math.atan2(-x, -z)); // face the centre
  houses.push(h);
});

// A cobblestone apron paves the plaza; it sinks into the slope so the edges
// never float. Purely decorative — walkers still plant on the terrain.
const plaza = new Mesh(
  new CylinderGeometry(9.5, 9.5, 1.6, 44),
  createSurface('cobblestone', { seed: 6 })
);
plaza.position.set(0, groundAt(0, 1) - 0.72, 1);
scene.add(plaza);

// The plaza: a fountain at its heart, statues flanking the hall, a well.
place(createFountain({ seed: 4, palette }), 0, 2, 0);
place(createStatue({ seed: 71, figure: 'figure', palette }), -5.5, -11, Math.PI);
place(createStatue({ seed: 72, figure: 'obelisk', palette }), 5.5, -11, Math.PI);
place(createWell({ seed: 3, palette }), -9, 4, 0);

// A moss-reclaimed ruin and a timber watchtower at the town's edge.
place(createRuin({ seed: 88, size: 4.2, palette }), -19, -17, 0.6);
place(createTower({ seed: 44, palette }), 19, 15, 0);

// A market row along the east side, with a cart and stacked crates.
const trades = ['produce', 'pottery', 'bakery', 'textiles'] as const;
trades.forEach((goods, i) => {
  place(createStall({ seed: 30 + i, goods, palette }), 13, -6 + i * 3.2, -Math.PI / 2);
});
place(createCart({ seed: 2, style: 'wagon', cargo: 'barrels', palette }), 9, 6, 0.6);
place(createCart({ seed: 7, style: 'cart', cargo: 'sacks', palette }), -13, -12, 1.1);
place(createCart({ seed: 9, style: 'wagon', cargo: 'hay', palette }), -17, 11, 2.2);

// Warmth & festivity: braziers ring the plaza, a campfire by the market,
// bunting between poles, banners flanking the hall.
const fires: Prop[] = [];
[[-6, 6], [6, 6], [-6, -6], [6, -5]].forEach(([x, z], i) => {
  fires.push(place(createBrazier({ seed: 50 + i, palette }), x, z, 0, false));
});
fires.push(place(createCampfire({ seed: 3, palette }), 14, 8, 0, false));
for (let i = 0; i < 3; i++) {
  place(createBunting({ seed: 60 + i, span: 5.5, palette }), -6 + i * 6, 0, 11, false);
}
place(createBanner({ seed: 80, style: 'banner', pattern: 'saltire', palette }), -3.4, -9.2, 0, false);
place(createBanner({ seed: 81, style: 'banner', pattern: 'bands', palette }), 3.4, -9.2, 0, false);

// Street lamps along the lane, a fence line near the fields.
const lampProps: Prop[] = [];
[[-11, -3], [-3, -11], [11, -3], [3, 11], [-11, 9], [12, 4]].forEach(([x, z], i) => {
  lampProps.push(place(createLamp({ seed: 20 + i, light: true, palette }), x, z, 0, false));
});
place(createFence({ seed: 13, length: 8, palette }), -20, -12, 0.3, false);
place(createFence({ seed: 14, length: 8, palette }), 18, 16, -0.6, false);

// ------------------------------------------------------------ the forest
const inTown = (x: number, z: number): boolean => Math.hypot(x, z) < 26;
const forest = scatter({
  seed: 21,
  area: { min: { x: -58, z: -58 }, max: { x: 58, z: 58 } },
  surface: groundAt,
  density: 0.05,
  minSpacing: 1.8,
  items: [
    // A temperate wood — oak, pine, birch and maple mixed by biome.
    ...treeBiome('temperate', { palette, variants: 5 }),
    { create: (r) => createRock({ seed: r.int(1, 1e9), palette }), weight: 2 },
    { create: (r) => createBush({ seed: r.int(1, 1e9), palette }), weight: 2 },
  ],
  mask: (x, z) => !inTown(x, z) && !lane.contains(x, z),
});
scene.add(forest.group);
const grass = scatter({
  seed: 22,
  area: { min: { x: -40, z: -40 }, max: { x: 40, z: 40 } },
  surface: groundAt,
  density: 0.12,
  minSpacing: 0.8,
  items: [{ create: (r) => createGrassTuft({ seed: r.int(1, 1e9), palette }), variants: 8 }],
  mask: (x, z) => !lane.contains(x, z) && (Math.hypot(x, z) > 11 || Math.hypot(x, z) > 24),
});
scene.add(grass.group);

// A distant redwood ridge closing the valley: towering sequoias among pines,
// each paired with its billboard impostor via treeLOD. Out on the ring they
// stand as single camera-facing quads; as the camera swings near they resolve
// to full geometry — the LOD swap driven each frame (SCENA's createImpostor).
const ridge = scatter({
  seed: 33,
  area: { min: { x: -58, z: -58 }, max: { x: 58, z: 58 } },
  surface: groundAt,
  density: 0.02,
  minSpacing: 5,
  items: [
    treeLOD('sequoia', { palette, weight: 2 }),
    treeLOD('pine', { palette, weight: 3 }),
  ],
  lod: { distance: 34, tileSize: 20 },
  mask: (x, z) => Math.hypot(x, z) > 40, // a far ring only, well beyond the town
});
scene.add(ridge.group);

// One breeze over the whole valley: the surrounding wood and the meadow grass
// lean with the same travelling gust (SCENA's WindField).
const wind = createWindField({ direction: 40, strength: 0.32, gust: 0.6, waveLength: 7, waveSpeed: 2.2 });
applyWind(forest.group, { field: wind, height: 4, stiffness: 2.4, anchor: 1 });
applyWind(grass.group, { field: wind, height: 0.5, stiffness: 1.2, anchor: 0.03 });
applyWind(ridge.group, { field: wind, height: 10, stiffness: 3, anchor: 1.5 });
game.onUpdate(() => ridge.update?.(game.camera));

// Ornamental planting — species chosen for place, all leaning in the one breeze:
// blossoming cherries by the plaza, willows weeping over the well, a cypress
// avenue framing the town hall, and a lone sequoia landmark out on the meadow.
// Decorative (non-blocking), so they never fence in the walkers.
const plantOrn = (species: TreeSpecies, x: number, z: number, seed: number, season?: TreeSeason): void => {
  place(createTree({ species, seed, palette, wind, season }), x, z, 0, false);
};
plantOrn('sakura', 6, 9, 201, 'spring');
plantOrn('sakura', -4, 9, 202, 'spring');
plantOrn('willow', -13, 3, 203);
plantOrn('willow', -12, 7, 204);
[-8, 8].forEach((x, i) => {
  plantOrn('cypress', x, -11, 210 + i);
  plantOrn('cypress', x, -19, 212 + i);
});
plantOrn('sequoia', 40, 34, 220);

// ------------------------------------------------------------- seasons
// ?season=<spring|summer|autumn|winter|cycle> turns the whole valley's foliage
// with one createSeasons controller — the wood, the ridge and the ornamentals
// re-graded together in the shader (only tagged canopies; trunks stay planted).
// It composes with the wind, so the trees sway *and* turn. Default: summer
// (the as-authored look), so nothing changes unless you ask.
const seasonParam = params.get('season');
const seasons = createSeasons({ initial: 'summer' });
seasons.apply(scene);
if (seasonParam && seasonParam !== 'cycle') {
  seasons.set(seasonParam as Season, { fade: 5 });
} else if (seasonParam === 'cycle') {
  const ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];
  let si = 1;
  setInterval(() => { si = (si + 1) % ORDER.length; seasons.set(ORDER[si], { fade: 4 }); }, 8000);
}

// Obstacles the NPCs steer around: buildings + trees.
const obstacles = [...collectObstacles(buildings), ...forest.obstacles];

// -------------------------------------------------------------- the cast
interface Character {
  rig: HumanoidRig;
  loco: Locomotion;
  ik: FootIK;
  agent?: MotionAgent;
  gaze?: LookAt;
}
const cast: Character[] = [];
const agents: MotionAgent[] = [];

function hoe(): Group {
  const g = new Group();
  const mat = new MeshStandardMaterial({ color: palette.woodDark, flatShading: true });
  const handle = new Mesh(new CylinderGeometry(0.018, 0.022, 0.95, 6), mat);
  handle.position.y = 0.3; g.add(handle);
  const head = new Mesh(new BoxGeometry(0.16, 0.05, 0.1), new MeshStandardMaterial({ color: palette.metal, flatShading: true }));
  head.position.set(0, 0.76, 0.06); g.add(head);
  g.rotation.x = 0.5;
  return g;
}
function spear(): Group {
  const g = new Group();
  const shaft = new Mesh(new CylinderGeometry(0.02, 0.025, 2.0, 6), new MeshStandardMaterial({ color: palette.woodDark, flatShading: true }));
  shaft.position.y = 0.6; g.add(shaft);
  const tip = new Mesh(new ConeGeometry(0.05, 0.28, 6), new MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.6, roughness: 0.4, flatShading: true }));
  tip.position.y = 1.72; g.add(tip);
  return g;
}
function shield(): Group {
  const g = new Group();
  const disc = new Mesh(new CylinderGeometry(0.3, 0.3, 0.06, 12), createSurface('metal', { color: 0x5a6270 }));
  disc.rotation.x = Math.PI / 2; g.add(disc);
  const boss = new Mesh(new SphereGeometry(0.07, 8, 6), new MeshStandardMaterial({ color: 0xd8d8dc, metalness: 0.7, roughness: 0.3 }));
  boss.position.z = 0.05; g.add(boss);
  return g;
}

type Kind = 'villager' | 'farmer' | 'knight';
function makeNpc(seed: number, kind: Kind): HumanoidRig {
  if (kind === 'knight') {
    const r = createHumanoid({ seed, palette: OUTFITS.guard, accessories: ['shoulderPads', 'cap'] });
    attach(r, 'handRight', spear());
    attach(r, 'handLeft', shield());
    return r;
  }
  if (kind === 'farmer') {
    const r = createHumanoid({ seed, palette: OUTFITS.villager, accessories: ['hat'] });
    attach(r, 'handRight', hoe());
    return r;
  }
  return createHumanoid({ seed, palette: seed % 4 === 0 ? OUTFITS.winter : OUTFITS.villager });
}

// Walkers on the lane and the plaza ring.
function walker(seed: number, kind: Kind, route: Vector3[], offset: number, speed: number): void {
  const r = makeNpc(seed, kind);
  const obj = game.world.spawn(`npc-${seed}`);
  obj.add(r.object);
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

// Townsfolk strolling the lane.
for (let i = 0; i < 8; i++) {
  const kind: Kind = i % 3 === 0 ? 'farmer' : 'villager';
  walker(100 + i, kind, lane.route, (i * lane.route.length) / 8, 1.1 + (i % 3) * 0.25);
}
// Knights patrolling the plaza ring.
for (let i = 0; i < 3; i++) {
  walker(200 + i, 'knight', ringPath.route, (i * ringPath.route.length) / 3, 1.35);
}

// Idle folk: market-goers and workers, planted, gazing about; one waves.
const idleSpots: Array<[number, number, Kind]> = [
  [11, -6, 'villager'], [11, -2, 'farmer'], [10.6, 2, 'villager'], [11, 5, 'villager'],
  [-7, 6.5, 'farmer'], [7.5, 7.5, 'villager'], [-2, -8, 'knight'], [2.5, -8, 'knight'],
  [13, 9.5, 'farmer'], [-9, -10, 'villager'],
];
idleSpots.forEach(([x, z, kind], i) => {
  const r = makeNpc(300 + i, kind);
  r.object.position.copy(at(x, z));
  r.object.rotation.y = Math.atan2(-x, -z) + (i % 2 ? 0.5 : -0.5);
  scene.add(r.object);
  const loco = new Locomotion(r);
  if (i === 0) loco.overlay(createWaveClip(r), { fadeIn: 0.1 });
  cast.push({ rig: r, loco, ik: new FootIK(r, { ground: groundAt }), gaze: new LookAt(r) });
});

// -------------------------------------------------------------- the mob
const crowd = new Crowd({ count: 55, seed: 9, variants: 4 });
scene.add(crowd.group);
crowd.followRoute(lane.route, { surface: groundAt });
game.onUpdate((t) => crowd.update(t.delta));

// --------------------------------------------------------- day & night
const fixedT = params.get('t');
const cycle = createDayCycle({
  sky, rig, scene,
  lamps: [...lampProps, ...houses, hall],
  palette,
  dayLength: 90,
  timeOfDay: fixedT ? parseFloat(fixedT) : 0.38, // bright warm morning by default
});
if (!fixedT) game.onUpdate((t) => cycle.update(t.delta));

// ------------------------------------------------------------- weather
// ?weather=<state> rolls a named sky in through the createWeather controller —
// clear, overcast, fog, rain, storm, snow, blizzard. It reuses the village's
// wind (so the trees already bound to it lean harder as a storm rises) and
// settles snow on the roofs; the day cycle keeps ownership of sky, fog & light.
const weatherType = params.get('weather');
if (weatherType) {
  const weather = createWeather(scene, {
    wind,
    fog: false,
    background: false,
    accumulateOn: scene,
    initial: 'clear',
  });
  weather.set(weatherType, { fade: 5 });
}

// A flock of birds wheeling around the bell tower.
const birds = createFlock({ type: 'birds', count: 44, center: [0, 16, -15], bounds: [16, 5, 16], circle: 11, seed: 12 });
scene.add(birds.object);

// A herd of deer grazing the meadow beyond the village, feet on the terrain.
const deer = createHerd({ type: 'deer', count: 9, center: [34, 30], radius: [12, 12], ground: groundAt, seed: 21 });
scene.add(deer.object);

// ------------------------------------------------------- the animation
const focus = new Vector3();
game.onUpdate((t) => {
  for (const c of cast) {
    if (c.agent) {
      const p = c.agent.owner.position;
      p.y = groundAt(p.x, p.z);
      c.loco.update(t.delta, c.agent.velocity);
    } else {
      c.loco.update(t.delta, 0);
      if (c.gaze) {
        // Glance at the nearest passing walker.
        let best: Vector3 | null = null;
        let bd = 9;
        for (const a of agents) {
          const d = a.owner.position.distanceTo(c.rig.object.position);
          if (d < bd) { bd = d; best = a.owner.position; }
        }
        c.gaze.target = best;
        c.gaze.update(t.delta);
      }
    }
    c.ik.update();
  }
});

// ------------------------------------------------------ tavern interior
// ?view=tavern steps indoors: a createRoom taproom furnished by furnishRoom,
// lit by createInteriorLight bound to the SAME day cycle as the village —
// dusk in the lanes is dusk through these windows, and the hearth's flicker
// takes over as the shafts die. Villagers inhabit the furnisher's markers:
// one at the bar, one warming at the hearth, one pacing the floor.
const TAVERN = new Vector3(0, 0, -300); // its own interior cell, off the map
const taproom = createRoom(
  [
    '##H######',
    '#.......#',
    'W...~...W',
    '#.......#',
    '#.......#',
    '##WDW####',
  ],
  { seed: 41, palette }
);
taproom.group.position.copy(TAVERN);
scene.add(taproom.group);
const taps = furnishRoom(taproom, { role: 'tavern', seed: 4, palette });
const taplight = createInteriorLight(taproom, { cycle, shaftStrength: 0.2 });
game.onUpdate(() => taplight.update());
taproom.setActive(view === 'tavern');

const tavernCast: Array<{ rig: HumanoidRig; loco: Locomotion; ik: FootIK }> = [];
function tavernNpc(seed: number, kind: Kind, local: Vector3, faceLocal: Vector3) {
  const r = makeNpc(seed, kind);
  r.object.position.set(local.x, 0, local.z);
  taproom.group.add(r.object); // parented: setActive hides the whole cell
  r.object.lookAt(TAVERN.x + faceLocal.x, 0, TAVERN.z + faceLocal.z);
  const entry = { rig: r, loco: new Locomotion(r), ik: new FootIK(r, { ground: () => 0 }) };
  tavernCast.push(entry);
  return entry;
}
const barSpot = taps.markers.work[0];
const counterPos = taps.props.find((p) => p.object.name === 'counter')?.object.position;
if (barSpot) tavernNpc(401, 'villager', barSpot, counterPos ?? barSpot);
const hearthSpot = taps.markers.hearth[0];
if (hearthSpot) tavernNpc(402, 'farmer', hearthSpot, taproom.hearths[0].position);
// Guests actually SIT: the furnisher's sit markers become interaction
// slots — anima's sit pose takes the body over from locomotion.
const sitters: Array<{ loco: Locomotion; act: Interaction }> = [];
taps.markers.sit.slice(0, 2).forEach((marker, i) => {
  const r = makeNpc(410 + i, 'villager');
  taproom.group.add(r.object);
  const anchor = new Object3D();
  anchor.position.set(marker.x, 0, marker.z);
  // Face the nearest table.
  let towards: Vector3 | null = null;
  let bd = 1e9;
  for (const p of taps.props) {
    if (!p.object.name.startsWith('table')) continue;
    const d = p.object.position.distanceTo(marker);
    if (d < bd) { bd = d; towards = p.object.position; }
  }
  if (towards) anchor.rotation.y = Math.atan2(towards.x - marker.x, towards.z - marker.z);
  taproom.group.add(anchor);
  const loco = new Locomotion(r);
  const act = new Interaction(r, loco);
  act.use({ kind: 'bench', anchor, pose: 'sit' }, { fade: 0.01 + i * 0.2 });
  sitters.push({ loco, act });
});
game.onUpdate((t) => {
  for (const s of sitters) {
    s.loco.update(t.delta, 0);
    s.act.update(t.delta);
  }
});

const paceA = new Vector3(-2, 0, 3.6);
const paceB = new Vector3(-2.7, 0, -0.6);
const pacer = tavernNpc(403, 'villager', paceA, paceB);
const paceVel = new Vector3();
game.onUpdate((t) => {
  const k = (t.elapsed % 14) / 14;
  const forth = k < 0.5;
  const s = forth ? k * 2 : (1 - k) * 2;
  pacer.rig.object.position.copy(paceA).lerp(paceB, s).setY(0);
  paceVel.copy(paceB).sub(paceA).normalize().multiplyScalar(forth ? 1.1 : -1.1);
  pacer.rig.object.rotation.y = Math.atan2(paceVel.x, paceVel.z);
  pacer.loco.update(t.delta, paceVel);
  pacer.ik.update();
  for (const c of tavernCast) {
    if (c === pacer) continue;
    c.loco.update(t.delta, 0);
    c.ik.update();
  }
});

// ------------------------------------------------------------- camera
const centre = at(0, 0);
game.onUpdate((time) => {
  const e = time.elapsed;
  if (view === 'aerial') {
    game.camera.position.set(Math.cos(e * 0.05) * 46, 40, Math.sin(e * 0.05) * 46);
    game.camera.lookAt(centre.x, centre.y, centre.z);
  } else if (view === 'plaza') {
    game.camera.position.set(Math.sin(e * 0.15) * 9, centre.y + 3.2, 12);
    game.camera.lookAt(0, centre.y + 1.6, 0);
  } else if (view === 'street') {
    focus.set(11, centre.y + 1.5, -6 + Math.sin(e * 0.2) * 4);
    game.camera.position.set(4 + Math.sin(e * 0.1) * 2, centre.y + 1.7, -2);
    game.camera.lookAt(focus);
  } else if (view === 'tavern') {
    game.camera.position.set(TAVERN.x + 0.8 + Math.sin(e * 0.12) * 0.5, 2.0, TAVERN.z + 3.7);
    game.camera.lookAt(TAVERN.x, 1.15, TAVERN.z - 3.4);
  } else {
    game.camera.position.set(Math.cos(e * 0.06) * 30, centre.y + 15, Math.sin(e * 0.06) * 30);
    game.camera.lookAt(centre.x, centre.y + 2, centre.z);
  }
});

game.start();

// Diagnostics for headless verification.
(window as unknown as { villageDebug: (settle?: boolean) => unknown }).villageDebug = (settle) => {
  const gl = game.renderer.getContext();
  // Force the season fade to complete (headless SwiftShader renders too slowly
  // for the self-driven, dt-clamped fade to finish in wall-clock time).
  if (settle) {
    for (let i = 0; i < 120; i++) seasons.update(0.1);
    game.renderer.render(scene, game.camera);
  }
  const su = seasons.uniforms;
  return {
    drawCalls: game.renderer.info.render.calls,
    triangles: game.renderer.info.render.triangles,
    glError: gl.getError(),
    seasonsGraded: seasons.materials.length,
    seasonTintAmt: +(su.uSeasonTintAmt.value as number).toFixed(3),
    seasonSat: +(su.uSeasonSat.value as number).toFixed(3),
    fullRigs: cast.length,
    crowd: 55,
    walkers: agents.length,
    tavern: {
      active: taproom.group.visible,
      furniture: taps.props.length,
      sit: taps.markers.sit.length,
      work: taps.markers.work.length,
      cast: tavernCast.length,
      pacerX: +pacer.rig.object.position.x.toFixed(2),
      seated: sitters.length,
      sitWeight: +(sitters[0]?.act.poseWeight ?? 0).toFixed(3),
    },
    npcPositions: agents.slice(0, 3).map((a) => a.owner.position.toArray().map((n) => +n.toFixed(2))),
  };
};
