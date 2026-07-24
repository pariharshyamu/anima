import { Mesh, PlaneGeometry, Vector3 } from 'three';
import {
  applyFog,
  createCar,
  createLightingRig,
  createPath,
  createPlanter,
  createSky,
  createSurface,
  createTree,
  PALETTES,
} from 'scena3d';
import { createHumanoid, Interaction, Locomotion, OUTFITS } from 'anima3d';
import { Game, MotionAgent, FollowPath, Path } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(320, 320), createSurface('concrete', { seed: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

// ---- the circuit: a kinked ring, paved by createPath -------------------
const WAYPOINTS: Array<{ x: number; z: number }> = [];
for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2;
  const r = 26 + Math.sin(a * 2) * 7;
  WAYPOINTS.push({ x: Math.cos(a) * r * 1.35, z: Math.sin(a) * r });
}
const track = createPath(WAYPOINTS, { width: 7, loop: true, palette });
scene.add(track.mesh);
// Apex planters + trees beyond the verge.
for (const i of [4, 9, 13, 16]) {
  const planter = createPlanter({ seed: 20 + i, length: 1.2, palette });
  const w = WAYPOINTS[i];
  planter.object.position.set(w.x * 1.22, 0, w.z * 1.28);
  scene.add(planter.object);
}
[[0, 0], [46, 30], [-48, -22], [10, -38], [-16, 40]].forEach(([x, z], i) => {
  const tree = createTree({ species: 'maple', seed: 40 + i, height: 5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
});

// ---- the player's car + driver ----------------------------------------
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
act.use(car.slots![0], { fade: 0.01 });

// ---- two GAMA rivals ---------------------------------------------------
const lapPoints = WAYPOINTS.map((p) => new Vector3(p.x, 0, p.z));
const rivals = [0x3a6ea5, 0x3f7f5c].map((color, i) => {
  const rival = createCar({ seed: 11 + i, color, palette });
  const carrier = game.world.spawn(`rival-${i}`);
  carrier.add(rival.object);
  const startAt = lapPoints[(3 + i * 6) % lapPoints.length];
  carrier.position.copy(startAt);
  const agent = carrier.addComponent(
    new MotionAgent({ maxSpeed: 9 + i * 2, maxForce: 16, planar: true })
  );
  agent.addBehavior(new FollowPath(new Path(lapPoints, true), 2.4));
  return { rival, agent, carrier };
});

// ---- input: keyboard + touch pads --------------------------------------
const keys = { left: false, right: false, up: false, down: false };
const KEYMAP: Record<string, keyof typeof keys> = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
};
addEventListener('keydown', (e) => { const k = KEYMAP[e.key]; if (k) { keys[k] = true; e.preventDefault(); } });
addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });

const pad = (label: string, css: string, key: keyof typeof keys): void => {
  const b = document.createElement('div');
  b.textContent = label;
  b.style.cssText =
    'position:fixed;z-index:10;width:64px;height:64px;border-radius:16px;' +
    'background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.35);' +
    'color:#fff;font:700 24px system-ui;display:flex;align-items:center;' +
    'justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none;' + css;
  b.className = 'race-pad';
  const on = (e: Event): void => { e.preventDefault(); keys[key] = true; };
  const off = (): void => { keys[key] = false; };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('pointerleave', off);
  document.body.appendChild(b);
};
pad('◀', 'left:16px;bottom:24px', 'left');
pad('▶', 'left:96px;bottom:24px', 'right');
pad('▼', 'right:96px;bottom:24px', 'down');
pad('▲', 'right:16px;bottom:24px', 'up');

const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:10px;right:12px;z-index:10;color:#fff;text-align:right;' +
  'font:600 15px/1.5 system-ui;text-shadow:0 1px 3px #000;user-select:none';
if (innerWidth < 560) hud.style.top = '84px'; // clear the intro note on phones
document.body.appendChild(hud);

// ---- the race ----------------------------------------------------------
let speed = 0;
let lap = 0;
let lapTime = 0;
let best = Infinity;
let progress = 0;
let lastTheta = Math.atan2(start.z, start.x);
const debugInput = { throttle: NaN, steer: NaN }; // headless override

game.onUpdate((t) => {
  const dt = Math.min(t.delta, 0.05);
  const throttle = Number.isNaN(debugInput.throttle)
    ? (keys.up ? 1 : keys.down ? -0.45 : 0)
    : debugInput.throttle;
  const steerIn = Number.isNaN(debugInput.steer)
    ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
    : debugInput.steer;

  // Kinematic car: eager throttle, coast drag, speed-scaled steering.
  const top = throttle >= 0 ? 19 * throttle : 6 * throttle;
  const rate = Math.abs(top) > Math.abs(speed) ? 10 : 16;
  speed += Math.sign(top - speed) * Math.min(Math.abs(top - speed), rate * dt);
  if (throttle === 0) speed *= Math.max(0, 1 - 1.1 * dt);
  // Grass drag off the ribbon: nearest-waypoint distance as the track probe.
  const p = car.object.position;
  let near = Infinity;
  for (const w of WAYPOINTS) near = Math.min(near, Math.hypot(p.x - w.x, p.z - w.z));
  if (near > 5.5) speed *= Math.max(0, 1 - 2.2 * dt);

  heading -= steerIn * 1.75 * dt * Math.min(1, Math.abs(speed) / 5) * Math.sign(speed || 1);
  car.object.rotation.y = heading;
  p.x += Math.sin(heading) * speed * dt;
  p.z += Math.cos(heading) * speed * dt;
  car.update(dt, { speed: Math.abs(speed), steer: steerIn * 0.5 });
  loco.update(dt, 0);
  act.update(dt);

  // Rivals: heading-smoothed agents on the loop.
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

  // Laps: accumulate swept angle around the circuit's centre.
  lapTime += dt;
  const theta = Math.atan2(p.z, p.x);
  let dTheta = theta - lastTheta;
  while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
  while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
  lastTheta = theta;
  progress += dTheta;
  if (Math.abs(progress) >= Math.PI * 2) {
    progress = 0;
    lap += 1;
    best = Math.min(best, lapTime);
    lapTime = 0;
  }

  hud.textContent =
    `LAP ${lap}  ·  ${lapTime.toFixed(1)}s` +
    (best < Infinity ? `  ·  best ${best.toFixed(1)}s` : '') +
    `  ·  ${Math.round(Math.abs(speed) * 3.6)} km/h`;

  // Chase camera, height and lag scaled for any screen.
  camTarget.set(
    p.x - Math.sin(heading) * 8.5,
    4.4,
    p.z - Math.cos(heading) * 8.5
  );
  game.camera.position.lerp(camTarget, Math.min(1, 3.2 * dt));
  game.camera.lookAt(p.x + Math.sin(heading) * 4, 1, p.z + Math.cos(heading) * 4);
});
const camTarget = new Vector3(start.x, 5, start.z + 10);
game.camera.position.copy(camTarget);
game.start();

// Headless verification hook: override input, read the race state.
declare global {
  interface Window {
    raceDebug: (throttle?: number, steer?: number) => Record<string, unknown>;
  }
}
window.raceDebug = (throttle?: number, steer?: number) => {
  debugInput.throttle = throttle ?? NaN;
  debugInput.steer = steer ?? NaN;
  const gl = game.renderer.getContext();
  return {
    glError: gl.getError(),
    speed: +speed.toFixed(2),
    heading: +heading.toFixed(3),
    lap,
    carPos: car.object.position.toArray().map((n) => +n.toFixed(1)),
    riderGap: +rig.object
      .getWorldPosition(new Vector3())
      .distanceTo(car.object.position)
      .toFixed(2),
    pads: document.querySelectorAll('.race-pad').length,
    rivalSpeeds: rivals.map(({ agent }) => +Math.hypot(agent.velocity.x, agent.velocity.z).toFixed(1)),
    drawCalls: game.renderer.info.render.calls,
  };
};
