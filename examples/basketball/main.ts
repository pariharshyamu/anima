// ============================================================================
// MEADOW HOOPS — a complete single-file basketball game.
//
//   three.js renders. GAMA makes it a game. SCENA gives it a world.
//   ANIMA gives it people. This file gives it a ball.
//
//   You (blue) vs CPU (red), 90-second match on a forest court.
//   WASD/arrows move · SPACE shoots (closer = safer, beyond the arc = 3)
//   · bump the ball-carrier to steal · R restarts after the buzzer.
//
//   GAMA:  game loop, keyboard input, steering AI (Seek), agent physics
//   SCENA: terrain, sky, fog, lighting, forest, court-side lamps
//   ANIMA: seeded players in team kits, gaits, gaze, hand sockets,
//          a procedural jump-shot overlay, and a VAT spectator crowd
// ============================================================================

import {
  AnimationClip,
  AnimationUtils,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { Game, MotionAgent, Seek } from 'gama3d';
import {
  createTerrain,
  createSky,
  createLightingRig,
  applyFog,
  createTree,
  createRock,
  createLamp,
  scatter,
  PALETTES,
} from 'scena3d';
import {
  attach,
  createHumanoid,
  Crowd,
  getSocket,
  Locomotion,
  LookAt,
  type HumanoidRig,
} from 'anima3d';

// ----------------------------------------------------------- the world (SCENA)
const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;

const terrain = createTerrain({ seed: 18, size: 110, amplitude: 4, palette });
scene.add(terrain.mesh, createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);

const COURT_W = 13; // x extent
const COURT_L = 22; // z extent
const RIM_H = 3.05;
const courtTop = terrain.heightAt(0, 0) + 0.18;

const forest = scatter({
  seed: 21,
  area: { min: { x: -50, z: -50 }, max: { x: 50, z: 50 } },
  surface: terrain.heightAt,
  density: 0.045,
  minSpacing: 1.8,
  items: [
    { create: (rng) => createTree({ seed: rng.int(1, 1e9), palette }), weight: 4, variants: 6 },
    { create: (rng) => createRock({ seed: rng.int(1, 1e9), palette }) },
  ],
  mask: (_x, _z, y) => y < 3.4,
  keepOut: [{ center: { x: 0, z: 0 }, radius: 19 }],
});
scene.add(forest.group);

for (const [x, z] of [[-8.5, -12.5], [8.5, -12.5], [-8.5, 12.5], [8.5, 12.5]] as const) {
  const lamp = createLamp({ seed: 4, light: true, lightIntensity: 3, palette });
  lamp.object.position.set(x, terrain.heightAt(x, z), z);
  scene.add(lamp.object);
}

// ------------------------------------------------------------------ the court
const wood = new MeshStandardMaterial({ color: 0xc09a63, flatShading: true });
const lineMat = new MeshStandardMaterial({ color: 0xf2efe6 });
const slab = new Mesh(new BoxGeometry(COURT_W + 2, 0.36, COURT_L + 2.5), wood);
slab.position.set(0, courtTop - 0.18, 0);
scene.add(slab);

const line = (w: number, d: number, x: number, z: number): void => {
  const mesh = new Mesh(new BoxGeometry(w, 0.012, d), lineMat);
  mesh.position.set(x, courtTop + 0.006, z);
  scene.add(mesh);
};
line(COURT_W, 0.08, 0, -COURT_L / 2); // baselines
line(COURT_W, 0.08, 0, COURT_L / 2);
line(0.08, COURT_L, -COURT_W / 2, 0); // sidelines
line(0.08, COURT_L, COURT_W / 2, 0);
line(COURT_W, 0.08, 0, 0); // half court
const centerCircle = new Mesh(new RingGeometry(1.7, 1.8, 40), lineMat);
centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = courtTop + 0.006;
scene.add(centerCircle);
for (const end of [-1, 1]) {
  const arc = new Mesh(new RingGeometry(5.6, 5.7, 48, 1, Math.PI, Math.PI), lineMat);
  arc.rotation.x = -Math.PI / 2;
  arc.rotation.z = end === 1 ? 0 : Math.PI;
  arc.position.set(0, courtTop + 0.006, end * (COURT_L / 2 - 1.2));
  scene.add(arc);
  line(3.6, 0.08, 0, end * (COURT_L / 2 - 4)); // free-throw line
  line(0.08, 4, -1.8, end * (COURT_L / 2 - 2)); // the key
  line(0.08, 4, 1.8, end * (COURT_L / 2 - 2));
}

interface Hoop {
  rim: Vector3;
  boardZ: number;
  dir: number; // which way the board faces (toward court center)
}
const hoops: Hoop[] = [];
for (const end of [-1, 1]) {
  const baseline = end * (COURT_L / 2);
  const metal = new MeshStandardMaterial({ color: 0x3d4451, flatShading: true });
  const pole = new Mesh(new CylinderGeometry(0.09, 0.11, 3.9, 8), metal);
  pole.position.set(0, courtTop + 1.95, baseline + end * 1.15);
  const arm = new Mesh(new BoxGeometry(0.1, 0.1, 1.0), metal);
  arm.position.set(0, courtTop + 3.55, baseline + end * 0.6);
  const board = new Mesh(
    new BoxGeometry(1.8, 1.1, 0.06),
    new MeshStandardMaterial({ color: 0xe8ecef, flatShading: true })
  );
  const boardZ = baseline + end * 0.12;
  board.position.set(0, courtTop + 3.45, boardZ);
  const rim = new Vector3(0, courtTop + RIM_H, boardZ - end * 0.42);
  const ring = new Mesh(new TorusGeometry(0.28, 0.025, 8, 20), new MeshStandardMaterial({ color: 0xd8622a }));
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(rim);
  const net = new Mesh(
    new CylinderGeometry(0.27, 0.16, 0.42, 10, 3, true),
    new MeshStandardMaterial({ color: 0xf2efe6, wireframe: true })
  );
  net.position.copy(rim).y -= 0.24;
  scene.add(pole, arm, board, ring, net);
  hoops.push({ rim, boardZ, dir: -end });
}
const HOOP_PLAYER = hoops[1]; // you attack +z
const HOOP_AI = hoops[0]; // CPU attacks −z

// ------------------------------------------------------- the people (ANIMA)
interface Athlete {
  rig: HumanoidRig;
  loco: Locomotion;
  gaze: LookAt;
  object: Group;
  velocity: Vector3;
  shootClip: AnimationClip;
}
function makeAthlete(seed: number, jersey: number, shorts: number): Athlete {
  const rig = createHumanoid({
    seed,
    height: 1.82,
    bodyType: 'masculine',
    outfit: { top: 'shirt', bottom: 'shorts', sleeves: 'short', collar: false, belt: false },
    colors: { top: jersey, bottom: shorts, boots: 0xe8e4dc },
    accessories: 'none',
  });
  scene.add(rig.object);
  // A procedural jump-shot: both arms rise overhead, authored as an
  // additive clip so it layers on top of running or standing.
  const hang = Math.PI / 2 - 0.14;
  const frames = 18;
  const times = new Float32Array(frames + 1);
  const left = new Float32Array((frames + 1) * 4);
  const right = new Float32Array((frames + 1) * 4);
  const q = new Quaternion();
  const axisZ = new Vector3(0, 0, 1);
  const axisX = new Vector3(1, 0, 0);
  const spin = new Quaternion();
  for (let i = 0; i <= frames; i++) {
    times[i] = (i / frames) * 0.7;
    const w = i / frames;
    const lift = Math.sin(Math.min(1, w / 0.45) * Math.PI * 0.5) * Math.sin(Math.min(1, (1 - w) / 0.35) * Math.PI * 0.5);
    for (const [side, out] of [[1, left], [-1, right]] as const) {
      q.setFromAxisAngle(axisX, -lift * 1.1).multiply(spin.setFromAxisAngle(axisZ, -side * (hang - lift * (hang + 0.5))));
      out.set([q.x, q.y, q.z, q.w], i * 4);
    }
  }
  const shootClip = AnimationUtils.makeClipAdditive(
    new AnimationClip('shoot', 0.7, [
      new QuaternionKeyframeTrack('LeftArm.quaternion', times as unknown as number[], left as unknown as number[]),
      new QuaternionKeyframeTrack('RightArm.quaternion', times as unknown as number[], right as unknown as number[]),
    ])
  );
  return {
    rig,
    loco: new Locomotion(rig),
    gaze: new LookAt(rig, { maxYaw: 0.9 }),
    object: rig.object,
    velocity: new Vector3(),
    shootClip,
  };
}
const player = makeAthlete(11, 0x2456a8, 0x1c3d78);
const cpu = makeAthlete(23, 0xb03a30, 0x7d2822);

// Spectators: a VAT crowd on simple bleachers along both sidelines.
const bleacherMat = new MeshStandardMaterial({ color: 0x8a6642, flatShading: true });
for (const side of [-1, 1]) {
  for (const step of [0, 1]) {
    const bench = new Mesh(new BoxGeometry(1.1, 0.42 + step * 0.42, 18), bleacherMat);
    bench.position.set(side * (COURT_W / 2 + 2 + step * 1.15), courtTop + (0.21 + step * 0.21), 0);
    scene.add(bench);
  }
}
const crowd = new Crowd({ count: 26, seed: 9, clip: 'idle', variants: 3 });
scene.add(crowd.group);
for (let i = 0; i < crowd.count; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const step = i % 4 < 2 ? 0 : 1;
  const z = -8 + Math.floor(i / 2) * 1.35 + (i % 3) * 0.2;
  crowd.set(
    i,
    side * (COURT_W / 2 + 2 + step * 1.15),
    z,
    side === -1 ? Math.PI / 2 : -Math.PI / 2,
    courtTop + 0.42 + step * 0.42
  );
}
game.onUpdate((t) => crowd.update(t.delta));

// --------------------------------------------------------------- the ball
const ball = new Mesh(
  new SphereGeometry(0.14, 12, 10),
  new MeshStandardMaterial({ color: 0xd8622a, flatShading: true })
);
scene.add(ball);
const ballVel = new Vector3();
const GRAV = -11.5;
// Dev cheat for playtesting the scoring pipeline: ?swish makes every shot.
const SWISH_MODE = new URLSearchParams(location.search).has('swish');
type Holder = Athlete | null;
let holder: Holder = player;
let shotPlan: { made: boolean; hoop: Hoop; three: boolean; by: Athlete } | null = null;
const prevBallPos = new Vector3();
const stats = { shots: 0, planned: 0, crossings: [] as number[], clanks: 0, lastShot: null as unknown, lastClank: null as unknown };
let deadBallTime = 0;

function giveBall(to: Athlete): void {
  holder = to;
  shotPlan = null;
  getSocket(to.rig, 'handRight').add(ball);
  ball.position.set(0, 0, 0);
}
function releaseBall(): Vector3 {
  const world = ball.getWorldPosition(new Vector3());
  getSocket((holder as Athlete).rig, 'handRight').remove(ball);
  scene.add(ball);
  ball.position.copy(world);
  holder = null;
  return world;
}

// -------------------------------------------------------------- match state
let scoreYou = 0;
let scoreCpu = 0;
let clock = 90;
let running = true;
let stealGrace = 0; // seconds during which no steal can happen
let contactTime = 0;
let aiSettle = 0;
let shootLock = 0;

const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:10px;left:50%;transform:translateX(-50%);color:#eef2f7;' +
  'font:700 22px/1.4 system-ui,sans-serif;text-shadow:0 2px 6px rgba(0,0,0,.7);text-align:center;z-index:10';
const flash = document.createElement('div');
flash.style.cssText =
  'position:fixed;top:34%;left:50%;transform:translateX(-50%);color:#ffd889;' +
  'font:800 44px system-ui,sans-serif;text-shadow:0 3px 10px rgba(0,0,0,.8);opacity:0;transition:opacity .3s;z-index:10';
const help = document.createElement('div');
help.style.cssText =
  'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);color:#b9c3dd;' +
  'font:14px system-ui,sans-serif;text-shadow:0 1px 4px rgba(0,0,0,.7);z-index:10';
help.textContent = 'WASD/arrows move · SPACE shoot (beyond the arc = 3) · bump the carrier to steal · R restart';
document.body.append(hud, flash, help);
let flashTimer = 0;
function say(message: string): void {
  flash.textContent = message;
  flash.style.opacity = '1';
  flashTimer = 1.4;
}

function resetAfterScore(scoredOnPlayerHoop: boolean): void {
  player.object.position.set(0, courtTop, -4);
  cpu.object.position.set(0, courtTop, 4);
  giveBall(scoredOnPlayerHoop ? cpu : player); // inbound to whoever conceded
}

// ------------------------------------------------------------- CPU steering
const cpuTarget = new Vector3(0, courtTop, 4);
const cpuWalker = game.world.spawn('cpu-anchor'); // GAMA drives this proxy…
const cpuAgent = cpuWalker.addComponent(new MotionAgent({ maxSpeed: 4.6, maxForce: 26, planar: true }));
cpuAgent.addBehavior(new Seek(cpuTarget));
cpuWalker.position.copy(cpu.object.position);

// ------------------------------------------------------------ shot mechanics
function shoot(by: Athlete, hoop: Hoop): void {
  const from = releaseBall();
  const distance = Math.hypot(from.x - hoop.rim.x, from.z - hoop.rim.z);
  const three = distance > 5.7;
  const defender = by === player ? cpu : player;
  const pressure = Math.max(0, 1.4 - defender.object.position.distanceTo(by.object.position)) * 0.22;
  const chance = Math.max(0.06, Math.min(0.93, 1.06 - distance * 0.07 - pressure));
  const made = SWISH_MODE || Math.random() < chance;
  const target = hoop.rim.clone();
  if (!made) {
    const miss = 0.32 + Math.random() * 0.35;
    const angle = Math.random() * Math.PI * 2;
    target.x += Math.cos(angle) * miss;
    target.z += Math.sin(angle) * miss * 0.6;
  }
  const T = 0.9 + distance * 0.09; // high rainbow arc → steep, clean entry angle
  ballVel.copy(target).sub(from).multiplyScalar(1 / T);
  ballVel.y = (target.y - from.y) / T - 0.5 * GRAV * T;
  stats.shots++;
  if (made) stats.planned++;
  stats.lastShot = {
    from: from.toArray().map((n) => +n.toFixed(2)),
    vel: ballVel.toArray().map((n) => +n.toFixed(2)),
    T: +T.toFixed(3),
    rim: hoop.rim.toArray().map((n) => +n.toFixed(2)),
  };
  shotPlan = { made, hoop, three, by };
  by.loco.overlay(by.shootClip, { loop: false, fadeIn: 0.04 });
  shootLock = 0.45;
}

// ------------------------------------------------------------- ball physics
function stepBall(frameDt: number): void {
  if (holder) return;
  // Fixed 1/120s substeps: launch velocities are exact ballistics, and
  // coarse frames (or slow machines) would otherwise sag the arc by
  // ~0.5*g*dt per second — enough to clank every made shot off the rim.
  let remaining = frameDt;
  while (remaining > 1e-6 && !holder) {
    const dt = Math.min(1 / 120, remaining);
    remaining -= dt;
    substepBall(dt);
  }
}

function substepBall(dt: number): void {
  prevBallPos.copy(ball.position);
  ballVel.y += GRAV * dt;
  ball.position.addScaledVector(ballVel, dt);

  // Score detection: falling through the rim disk. The crossing point is
  // interpolated along this frame's segment, so low frame rates (or fast
  // shots) can never tunnel past the rim without being counted.
  if (shotPlan && ballVel.y < 0) {
    const { hoop } = shotPlan;
    if (prevBallPos.y > hoop.rim.y && ball.position.y <= hoop.rim.y) {
      const f = (prevBallPos.y - hoop.rim.y) / (prevBallPos.y - ball.position.y);
      const cx = prevBallPos.x + (ball.position.x - prevBallPos.x) * f;
      const cz = prevBallPos.z + (ball.position.z - prevBallPos.z) * f;
      const d = Math.hypot(cx - hoop.rim.x, cz - hoop.rim.z);
      stats.crossings.push(+d.toFixed(3));
      if (d < 0.26) {
        const points = shotPlan.three ? 3 : 2;
        if (shotPlan.by === player) {
          scoreYou += points;
          say(shotPlan.three ? 'SPLASH! +3' : '+2');
        } else {
          scoreCpu += points;
          say(points === 3 ? 'CPU hits a three' : 'CPU scores');
        }
        const conceded = shotPlan.by === player;
        shotPlan = null;
        setTimeout(() => running && resetAfterScore(conceded), 900);
        stealGrace = 1.2;
        return;
      }
    }
  }

  // Rim clank: exact ball-vs-ring-tube contact (nearest point on the
  // ring circle) — a clean swish through the middle never touches it.
  for (const hoop of hoops) {
    const dx = ball.position.x - hoop.rim.x;
    const dz = ball.position.z - hoop.rim.z;
    const horizontal = Math.hypot(dx, dz);
    if (horizontal > 1e-4 && Math.abs(ball.position.y - hoop.rim.y) < 0.2 && Math.abs(horizontal - 0.28) < 0.25) {
      const ringX = hoop.rim.x + (dx / horizontal) * 0.28;
      const ringZ = hoop.rim.z + (dz / horizontal) * 0.28;
      const nx = ball.position.x - ringX;
      const ny = ball.position.y - hoop.rim.y;
      const nz = ball.position.z - ringZ;
      const gap = Math.hypot(nx, ny, nz);
      if (gap < 0.165 && gap > 1e-4) {
        const inv = 1 / gap;
        const dot = ballVel.x * nx * inv + ballVel.y * ny * inv + ballVel.z * nz * inv;
        if (dot < 0) {
          ballVel.x -= 1.5 * dot * nx * inv;
          ballVel.y -= 1.5 * dot * ny * inv;
          ballVel.z -= 1.5 * dot * nz * inv;
          stats.clanks++;
          stats.lastClank = { pos: ball.position.toArray().map((n) => +n.toFixed(3)), gap: +gap.toFixed(3) };
          shotPlan = null;
        }
      }
    }
    // Backboard.
    if (
      Math.abs(ball.position.z - hoop.boardZ) < 0.12 &&
      Math.abs(ball.position.x) < 0.95 &&
      ball.position.y > courtTop + 2.9 &&
      ball.position.y < courtTop + 4.05 &&
      ballVel.z * hoop.dir < 0
    ) {
      ballVel.z *= -0.55;
    }
  }

  // Floor and invisible walls keep the ball in play.
  if (ball.position.y < courtTop + 0.14) {
    ball.position.y = courtTop + 0.14;
    ballVel.y *= -0.68;
    ballVel.x *= 0.88;
    ballVel.z *= 0.88;
    if (Math.abs(ballVel.y) < 0.6) ballVel.y = 0;
    shotPlan = null;
  }
  // Keep the ball where the athletes can legally reach it.
  const limitX = COURT_W / 2 - 0.1;
  const limitZ = COURT_L / 2 - 0.1;
  if (Math.abs(ball.position.x) > limitX) {
    ball.position.x = Math.sign(ball.position.x) * limitX;
    ballVel.x *= -0.6;
  }
  if (Math.abs(ball.position.z) > limitZ) {
    ball.position.z = Math.sign(ball.position.z) * limitZ;
    ballVel.z *= -0.6;
  }
  ball.rotation.x += ballVel.length() * dt * 2;

  // Loose-ball pickup.
  if (!shotPlan || ballVel.length() < 6) {
    for (const athlete of [player, cpu]) {
      if (ball.position.distanceTo(athlete.object.position.clone().setY(ball.position.y)) < 0.8 && ball.position.y < courtTop + 1.7) {
        giveBall(athlete);
        return;
      }
    }
  }
  // Dead-ball failsafe: if it settles unclaimed, award it to the nearest.
  if (ballVel.lengthSq() < 0.25 && ball.position.y < courtTop + 0.2) {
    deadBallTime += dt;
    if (deadBallTime > 2) {
      deadBallTime = 0;
      giveBall(
        player.object.position.distanceTo(ball.position) < cpu.object.position.distanceTo(ball.position)
          ? player
          : cpu
      );
    }
  } else {
    deadBallTime = 0;
  }
}

// --------------------------------------------------------------- main loop
const keys = { shootHeld: false };
const scratch = new Vector3();
const camGoal = new Vector3();

game.onUpdate((t) => {
  const dt = t.delta;
  if (flashTimer > 0) {
    flashTimer -= dt;
    if (flashTimer <= 0) flash.style.opacity = '0';
  }
  stealGrace = Math.max(0, stealGrace - dt);
  shootLock = Math.max(0, shootLock - dt);

  if (running) {
    clock -= dt;
    if (clock <= 0) {
      clock = 0;
      running = false;
      say(scoreYou > scoreCpu ? `BUZZER — YOU WIN ${scoreYou}–${scoreCpu}` : scoreYou < scoreCpu ? `BUZZER — CPU WINS ${scoreCpu}–${scoreYou}` : 'BUZZER — TIE GAME');
      flashTimer = 9999;
    }
  } else if (game.input.isDown('KeyR')) {
    scoreYou = 0;
    scoreCpu = 0;
    clock = 90;
    running = true;
    flash.style.opacity = '0';
    flashTimer = 0;
    resetAfterScore(true);
  }
  const seconds = Math.ceil(clock);
  hud.textContent = `YOU ${scoreYou}  —  ${scoreCpu} CPU     ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  // ---- Player movement (camera-relative, GAMA input).
  const input = game.input;
  const mx = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
  const mz = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
  const speed = holder === player ? 4.6 : 5.2;
  const desired = running ? scratch.set(-mx, 0, mz).normalize().multiplyScalar(speed * (mx || mz ? 1 : 0)) : scratch.set(0, 0, 0);
  player.velocity.lerp(desired, 1 - Math.exp(-10 * dt));
  player.object.position.addScaledVector(player.velocity, dt);
  player.object.position.x = Math.max(-COURT_W / 2, Math.min(COURT_W / 2, player.object.position.x));
  player.object.position.z = Math.max(-COURT_L / 2, Math.min(COURT_L / 2, player.object.position.z));
  player.object.position.y = courtTop;
  if (player.velocity.length() > 0.4) {
    player.object.rotation.y = Math.atan2(player.velocity.x, player.velocity.z);
  } else if (holder === player) {
    player.object.rotation.y = Math.atan2(HOOP_PLAYER.rim.x - player.object.position.x, HOOP_PLAYER.rim.z - player.object.position.z);
  }

  // Shooting (edge-triggered).
  const shootDown = input.isDown('Space');
  if (running && shootDown && !keys.shootHeld && holder === player && shootLock <= 0) shoot(player, HOOP_PLAYER);
  keys.shootHeld = shootDown;

  // ---- CPU brain: GAMA MotionAgent steering toward a living target.
  if (running) {
    if (holder === cpu) {
      aiSettle += dt;
      const spot = scratch.copy(HOOP_AI.rim).setY(courtTop);
      spot.z += 3.4; // attack from the free-throw area
      spot.x = Math.max(-3, Math.min(3, cpu.object.position.x * 0.4));
      cpuTarget.copy(spot);
      const rimDist = Math.hypot(cpu.object.position.x - HOOP_AI.rim.x, cpu.object.position.z - HOOP_AI.rim.z);
      if (rimDist < 6.0 && aiSettle > 0.4 && shootLock <= 0) {
        shoot(cpu, HOOP_AI);
        aiSettle = 0;
      }
    } else if (holder === player) {
      aiSettle = 0;
      // Defend: sit on the line between the player and the hoop they attack.
      cpuTarget.copy(player.object.position).lerp(scratch.copy(HOOP_PLAYER.rim).setY(courtTop), 0.22);
    } else {
      aiSettle = 0;
      cpuTarget.copy(ball.position).setY(courtTop);
    }
  } else {
    cpuTarget.copy(cpu.object.position);
  }
  cpuWalker.position.y = courtTop;
  cpu.object.position.copy(cpuWalker.position);
  cpu.object.position.x = Math.max(-COURT_W / 2, Math.min(COURT_W / 2, cpu.object.position.x));
  cpu.object.position.z = Math.max(-COURT_L / 2, Math.min(COURT_L / 2, cpu.object.position.z));
  cpu.object.position.y = courtTop;
  cpu.velocity.copy(cpuAgent.velocity);
  if (cpu.velocity.length() > 0.4) {
    cpu.object.rotation.y = Math.atan2(cpu.velocity.x, cpu.velocity.z);
  } else if (holder === cpu) {
    cpu.object.rotation.y = Math.atan2(HOOP_AI.rim.x - cpu.object.position.x, HOOP_AI.rim.z - cpu.object.position.z);
  }

  // ---- Steals: bump the carrier.
  if (running && holder && stealGrace <= 0) {
    const defender = holder === player ? cpu : player;
    if (defender.object.position.distanceTo(holder.object.position) < 0.8) {
      contactTime += dt;
      if (contactTime > 0.7) {
        say(holder === player ? 'STOLEN!' : 'You strip the ball!');
        const from = releaseBall();
        ballVel.set((Math.random() - 0.5) * 4, 3.2, (Math.random() - 0.5) * 4);
        ball.position.copy(from);
        contactTime = 0;
        stealGrace = 1.0;
      }
    } else {
      contactTime = 0;
    }
  }

  // ---- Ball, bodies, gazes.
  stepBall(dt);
  player.loco.update(dt, player.velocity);
  cpu.loco.update(dt, cpu.velocity);
  const ballWorld = ball.getWorldPosition(scratch);
  player.gaze.target = ballWorld;
  player.gaze.update(dt);
  cpu.gaze.target = ballWorld;
  cpu.gaze.update(dt);

  // ---- Camera: over the player's shoulder, framing the action.
  camGoal.copy(player.object.position).add(scratch.set(0, 3.1, -6.2));
  game.camera.position.lerp(camGoal, 1 - Math.exp(-4.5 * dt));
  scratch.copy(player.object.position).lerp(HOOP_PLAYER.rim, 0.45).setY(courtTop + 1.6);
  game.camera.lookAt(scratch);
});

// Debug hook for automated playtesting.
(window as unknown as { hoopsDebug: () => unknown }).hoopsDebug = () => ({
  holder: holder === player ? 'player' : holder === cpu ? 'cpu' : 'none',
  // Head yaw (local, radians) — used to verify the gaze doesn't whip around
  // while the ball is carried right beside the character's head.
  playerHeadYaw: +player.rig.bones.Head.quaternion.y.toFixed(4),
  cpuHeadYaw: +cpu.rig.bones.Head.quaternion.y.toFixed(4),
  ball: ball.getWorldPosition(new Vector3()).toArray().map((n) => +n.toFixed(2)),
  ballVel: ballVel.toArray().map((n) => +n.toFixed(2)),
  player: player.object.position.toArray().map((n) => +n.toFixed(2)),
  cpu: cpu.object.position.toArray().map((n) => +n.toFixed(2)),
  shotPlan: shotPlan ? { made: shotPlan.made, three: shotPlan.three } : null,
  scoreYou,
  scoreCpu,
  stats,
  courtTop: +courtTop.toFixed(2),
});

// Tip-off.
player.object.position.set(0, courtTop, -4);
cpu.object.position.set(0, courtTop, 4);
cpuWalker.position.copy(cpu.object.position);
attach(player.rig, 'handRight', ball); // establishes the socket
giveBall(player);
game.camera.position.set(0, courtTop + 3.1, -10);
game.start();
