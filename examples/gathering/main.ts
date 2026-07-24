import { Mesh, PlaneGeometry, Vector3 } from 'three';
import type { Object3D } from 'three';
import {
  applyFog,
  createDiningTable,
  createGameTable,
  createLightingRig,
  createLongBench,
  createSky,
  createSurface,
  createTree,
  PALETTES,
  type Gathering,
  type PropSlot,
} from 'scena3d';
import {
  Conversation,
  createHumanoid,
  FootIK,
  Interaction,
  Locomotion,
  LookAt,
  Mannerisms,
  OUTFITS,
  type Talker,
} from 'anima3d';
import { FollowPath, Game, MotionAgent, Occupancy, Path, stagger } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(140, 140), createSurface('dirt', { seed: 3 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
for (const [x, z, seed] of [
  [-9, -7, 31],
  [9, -6, 32],
  [-10, 6, 33],
] as const) {
  const tree = createTree({ species: 'oak', seed, height: 5.5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
}

// ---- the gatherings ----------------------------------------------------

const place = (g: Gathering, x: number, z: number, rotY = 0): Gathering => {
  g.object.position.set(x, 0, z);
  g.object.rotation.y = rotY;
  scene.add(g.object);
  g.object.updateWorldMatrix(true, true);
  return g;
};
const table = place(createDiningTable({ seed: 5, seats: 4, style: 'round', palette }), -3.2, -0.4);
const board = place(createGameTable({ seed: 9, game: 'chess', palette }), 3.8, -2.4, 0.5);
const bench = place(createLongBench({ seed: 7, seats: 4, palette }), 2.2, 3.4);

// One Occupancy per prop. `personalSpace` is what makes strangers spread
// along the bench instead of piling onto the nearest end.
// The seat type flows through, so `claim` hands back a full SCENA slot —
// pose and approach included — ready for ANIMA's `Interaction.use`.
const seating = new Map<Gathering, Occupancy<Villager, PropSlot>>([
  [table, new Occupancy<Villager, PropSlot>(table.seats, { seed: 2, personalSpace: 0.6, spacing: 1.1 })],
  [board, new Occupancy<Villager, PropSlot>(board.seats, { seed: 3, personalSpace: 0 })],
  [bench, new Occupancy<Villager, PropSlot>(bench.seats, { seed: 4, personalSpace: 1.6, spacing: 2.4, whim: 0 })],
]);

// ---- the people --------------------------------------------------------

const world = (object: Object3D): Vector3 => {
  object.updateWorldMatrix(true, false);
  return object.getWorldPosition(new Vector3());
};

interface Villager {
  name: string;
  rig: ReturnType<typeof createHumanoid>;
  loco: Locomotion;
  ik: FootIK;
  gaze: LookAt;
  habits: Mannerisms;
  interaction: Interaction;
  agent: MotionAgent;
  body: ReturnType<typeof game.world.spawn>;
  home: Gathering;
  seat: PropSlot | null;
  state: 'waiting' | 'walking' | 'sitting' | 'seated';
  wait: number;
}

const villagers: Villager[] = [];

function makeVillager(name: string, seed: number, home: Gathering, from: Vector3, delay: number): Villager {
  const rig = createHumanoid({ seed, palette: OUTFITS.villager });
  const loco = new Locomotion(rig);
  const body = game.world.spawn(name);
  body.add(rig.object);
  body.position.copy(from);
  const agent = body.addComponent(new MotionAgent({ maxSpeed: 1.6, maxForce: 14, planar: true }));
  const v: Villager = {
    name,
    rig,
    loco,
    ik: new FootIK(rig, { ground: () => 0 }),
    gaze: new LookAt(rig),
    // The same seed drives the body and the habits, so each villager both
    // looks and behaves like themselves.
    habits: new Mannerisms(rig, loco, { seed }),
    interaction: new Interaction(rig, loco),
    agent,
    body,
    home,
    seat: null,
    state: 'waiting',
    wait: delay,
  };
  villagers.push(v);
  return v;
}

// Three parties, each arriving from its own direction. `stagger` gives every
// group uneven start times — a group that moves in step is a puppet show.
// The bench party is deliberately slow-drip, so you can watch each newcomer
// pick a seat away from whoever is already sitting there.
interface Party {
  role: string;
  home: Gathering;
  from: Vector3;
  delays: number[];
}
const PARTIES: Party[] = [
  {
    role: 'diner',
    home: table,
    from: new Vector3(-6.5, 0, 5.5),
    delays: stagger(4, { spread: 1.0, lead: 0.2, seed: 6 }),
  },
  {
    role: 'player',
    home: board,
    from: new Vector3(7.5, 0, 2.5),
    delays: stagger(2, { spread: 0.9, lead: 0.6, seed: 8 }),
  },
  {
    role: 'sitter',
    home: bench,
    from: new Vector3(-5.5, 0, 8.5),
    delays: stagger(4, { spread: 2.8, lead: 1.6, seed: 9 }),
  },
];
let index = 0;
for (const party of PARTIES) {
  party.delays.forEach((delay, i) => {
    const from = party.from.clone().add(new Vector3((i % 2 ? 1 : -1) * (0.6 + i * 0.5), 0, i * 0.7));
    makeVillager(`${party.role}${i}`, 20 + index * 7, party.home, from, delay);
    index++;
  });
}

const talkers = (g: Gathering): Talker[] =>
  villagers.filter((v) => v.home === g).map((v) => ({ gaze: v.gaze, head: v.rig.bones.Head }));

// A conversation per table: the floor passes around, listeners follow it in
// their own time, and every so often somebody's eyes drift to the food. Each
// stays off until its OWN table has company to talk to.
const chats = new Map<Gathering, Conversation>([
  [table, new Conversation(talkers(table), { seed: 12, focus: table.focus, turn: 4.5, wander: 0.3 })],
  [board, new Conversation(talkers(board), { seed: 13, focus: board.focus, turn: 6, wander: 0.45 })],
  [bench, new Conversation(talkers(bench), { seed: 14, focus: bench.focus, turn: 7, wander: 0.6 })],
]);
for (const chat of chats.values()) chat.enabled = false;

// ---- behaviour ---------------------------------------------------------

const walkTo = (v: Villager, target: Vector3): void => {
  v.agent.clearBehaviors();
  v.agent.maxSpeed = 1.5;
  v.agent.addBehavior(new FollowPath(new Path([v.body.position.clone(), target], false), 0.35));
};

/** Pick a seat and set off for the spot beside it — not for the seat itself. */
function goSit(v: Villager): void {
  const occupancy = seating.get(v.home)!;
  const seat = occupancy.claim(v, { from: v.body.position });
  if (!seat) return;
  v.seat = seat;
  v.state = 'walking';
  walkTo(v, world(seat.approach ?? seat.anchor));
}

function sitDown(v: Villager): void {
  v.state = 'sitting';
  v.agent.clearBehaviors();
  v.agent.maxSpeed = 0;
  v.agent.velocity.set(0, 0, 0);
  // The slot carries its own approach anchor, so `use` stages the sit:
  // stand beside it → turn → lower, with the pose fading in on the way down.
  v.interaction.use(v.seat!, { fade: 0.4, settle: 0.75 });
  v.habits.context = 'seated';
}

game.onUpdate((t) => {
  const dt = t.delta;

  for (const v of villagers) {
    if (v.state === 'waiting') {
      v.wait -= dt;
      if (v.wait <= 0) goSit(v);
    } else if (v.state === 'walking') {
      const spot = world(v.seat!.approach ?? v.seat!.anchor);
      if (v.body.position.distanceTo(spot) < 0.45) sitDown(v);
    } else if (v.state === 'sitting' && v.interaction.phase === 'held') {
      v.state = 'seated';
      // A table starts talking once IT has company — not when some other
      // table does.
      const company = villagers.filter((o) => o.home === v.home && o.state === 'seated').length;
      const chat = chats.get(v.home);
      if (chat && company >= 2) {
        chat.enabled = true;
        chat.retarget();
      }
    }

    v.loco.update(dt, v.state === 'walking' ? v.agent.velocity : 0);
    v.interaction.update(dt);
    v.ik.update();
    v.habits.update(dt);
  }

  // Conversations write gaze targets; LookAt does the actual turning, and
  // must run last so it composes over the pose the mixer just wrote.
  for (const chat of chats.values()) chat.update(dt);
  for (const v of villagers) v.gaze.update(dt);

  const angle = t.elapsed * 0.06;
  game.camera.position.set(Math.sin(angle) * 11.5, 5.4, Math.cos(angle) * 11.5 + 2);
  game.camera.lookAt(0, 1.0, 0.6);
});

game.camera.position.set(0, 5.4, 13);
game.start();

// Fixed camera framings, for screenshots and for looking closely.
const SHOTS: Record<string, [Vector3, Vector3]> = {
  table: [new Vector3(-3.4, 2.4, 4.2), new Vector3(-3.4, 1.15, 0)],
  bench: [new Vector3(2.2, 2.2, 8.4), new Vector3(2.2, 0.95, 3.4)],
  game: [new Vector3(4.2, 2.2, 3.4), new Vector3(4.2, 1.1, -1.4)],
  wide: [new Vector3(0.5, 7.5, 13.5), new Vector3(0, 1, 0.6)],
};

declare global {
  interface Window {
    gatheringDebug: () => Record<string, unknown>;
    gatheringShot: (name: string) => void;
  }
}
window.gatheringShot = (name) => {
  const shot = SHOTS[name];
  if (!shot) return;
  game.camera.position.copy(shot[0]);
  game.camera.lookAt(shot[1]);
  (game.camera as unknown as { userData: Record<string, unknown> }).userData.locked = true;
  game.onUpdate(() => {
    game.camera.position.copy(shot[0]);
    game.camera.lookAt(shot[1]);
  });
};
window.gatheringDebug = () => {
  const gl = game.renderer.getContext();
  const benchSeats = bench.seats.map((s) => (seating.get(bench)!.isFree(s) ? '.' : '#')).join('');
  return {
    glError: gl.getError(),
    states: villagers.map((v) => v.state),
    seated: villagers.filter((v) => v.state === 'seated').length,
    phases: villagers.map((v) => v.interaction.phase),
    benchPattern: benchSeats,
    // Anyone still walking, and how far they have left to go.
    enRoute: villagers
      .filter((v) => v.state === 'walking' && v.seat)
      .map((v) => `${v.name}:${v.body.position.distanceTo(world(v.seat!.approach ?? v.seat!.anchor)).toFixed(2)}`),
    benchTaken: seating.get(bench)!.taken,
    tableTaken: seating.get(table)!.taken,
    speakers: [...chats.values()].map((c) => c.speaker),
    chatting: [...chats.values()].map((c) => c.enabled),
    // Are the diners actually looking at one another?
    gazeAtPeople: villagers.filter((v) => v.gaze.target !== null).length,
    fidgeting: villagers.filter((v) => v.habits.busy).length,
    // The rig (not the GameObject) is what `Interaction` puts on the seat.
    seatGap: (() => {
      const gaps = villagers
        .filter((v) => v.state === 'seated' && v.seat)
        .map((v) => world(v.rig.object).distanceTo(world(v.seat!.anchor)));
      return gaps.length ? +Math.max(...gaps).toFixed(3) : null;
    })(),
    drawCalls: game.renderer.info.render.calls,
  };
};
