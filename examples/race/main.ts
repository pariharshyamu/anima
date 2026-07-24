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
import {
  Game,
  MotionAgent,
  FollowPath,
  Path,
  VehicleController,
  driveVehicle,
  ChaseCamera,
  TouchControls,
} from 'gama3d';
import { Circuit, LapTracker } from 'gama3d/templates';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(320, 320), createSurface('concrete', { seed: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

// The circuit: SCENA paves the kinked ring, GAMA's Circuit tracks it.
const WAYPOINTS: Array<{ x: number; z: number }> = [];
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

// The player's car: SCENA visual + driver, GAMA drives it (keyboard + touch).
const car = createCar({ seed: 3, color: 0xb8433a, palette });
const body = game.world.spawn('player');
body.add(car.object);
const start = WAYPOINTS[0];
body.position.set(start.x, 0, start.z);
body.rotation.y = Math.atan2(WAYPOINTS[1].x - start.x, WAYPOINTS[1].z - start.z);
const drive = body.addComponent(
  new VehicleController(game.input, { vehicle: car, offTrack: (x, z) => circuit.distanceTo(x, z) > 4.5 })
);
const rig = createHumanoid({ seed: 9, palette: OUTFITS.villager });
car.object.add(rig.object);
const loco = new Locomotion(rig);
const act = new Interaction(rig, loco);
act.use(car.slots![0], { fade: 0.01 });
const cam = new ChaseCamera(game.camera, body, { distance: 8.5, height: 4.4 });
new TouchControls(game.input); // on-screen joystick, phones only

// Two GAMA rivals lapping the ring.
const lapPoints = WAYPOINTS.map((p) => new Vector3(p.x, 0, p.z));
const rivals = [0x3a6ea5, 0x3f7f5c].map((color, i) => {
  const rival = createCar({ seed: 11 + i, color, palette });
  const rb = game.world.spawn(`rival-${i}`);
  rb.add(rival.object);
  rb.position.copy(lapPoints[(3 + i * 6) % lapPoints.length]);
  const agent = rb.addComponent(new MotionAgent({ maxSpeed: 9 + i * 2, maxForce: 16, planar: true }));
  agent.addBehavior(new FollowPath(new Path(lapPoints, true), 2.4));
  const spin = driveVehicle(agent, rival);
  return { agent, spin };
});

// Lap HUD.
const laps = new LapTracker(circuit, { laps: 3 });
const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:10px;right:12px;z-index:10;color:#fff;text-align:right;' +
  'font:600 15px/1.5 system-ui;text-shadow:0 1px 3px #000;user-select:none';
if (innerWidth < 560) hud.style.top = '84px';
document.body.appendChild(hud);

game.onUpdate((t) => {
  loco.update(t.delta, 0);
  act.update(t.delta);
  for (const { spin } of rivals) spin(t.delta);
  cam.update(t.delta);
  const s = laps.update(t.delta, body.position.x, body.position.z);
  hud.textContent =
    `LAP ${Math.min(s.lap + 1, 3)}/3 · ${s.lapTime.toFixed(1)}s` +
    (s.bestLap < Infinity ? ` · best ${s.bestLap.toFixed(1)}s` : '') +
    ` · ${Math.round(drive.speed * 3.6)} km/h`;
});
game.start();

// Headless verification hook.
declare global {
  interface Window {
    raceDebug: (throttle?: number, steer?: number) => Record<string, unknown>;
  }
}
window.raceDebug = (throttle?: number, steer?: number) => {
  if (throttle !== undefined) drive.setIntentSource(() => ({ throttle, steer: steer ?? 0 }));
  else drive.setIntentSource(null);
  const gl = game.renderer.getContext();
  return {
    glError: gl.getError(),
    speed: +drive.speed.toFixed(2),
    heading: +body.rotation.y.toFixed(3),
    lap: laps.lap,
    bodyPos: body.position.toArray().map((n) => +n.toFixed(1)),
    riderGap: +rig.object.getWorldPosition(new Vector3()).distanceTo(body.position).toFixed(2),
    pads: document.querySelectorAll('.gama-touch').length,
    rivalSpeeds: rivals.map(({ agent }) => +Math.hypot(agent.velocity.x, agent.velocity.z).toFixed(1)),
    drawCalls: game.renderer.info.render.calls,
  };
};
