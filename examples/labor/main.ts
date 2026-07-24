import { Mesh, PlaneGeometry, Vector3 } from 'three';
import {
  applyFog,
  createLightingRig,
  createSky,
  createSurface,
  createTree,
  createChoppingBlock,
  createOreVein,
  createSawhorse,
  createCookpot,
  PALETTES,
  type WorkStation,
} from 'scena3d';
import { attach, createHumanoid, createLoopClip, FootIK, Locomotion, OUTFITS } from 'anima3d';
import { Game, MotionAgent, FollowPath, Path, Stockpile } from 'gama3d';
import type { AnimationAction, Object3D } from 'three';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(120, 120), createSurface('dirt', { seed: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
[[-8, -6], [8, 5]].forEach(([x, z], i) => {
  const tree = createTree({ species: 'oak', seed: 30 + i, height: 5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
});

// Four work stations around a little yard — each yields its own resource.
interface Job {
  station: WorkStation;
  resource: string;
  at: Vector3; // where the worker stands
}
const stationAt = (s: WorkStation, x: number, z: number, rotY = 0): Job => {
  s.object.position.set(x, 0, z);
  s.object.rotation.y = rotY;
  scene.add(s.object);
  s.object.updateWorldMatrix(true, true);
  return { station: s, resource: '', at: s.slots![0].anchor.getWorldPosition(new Vector3()) };
};
const jobs: Job[] = [
  { ...stationAt(createChoppingBlock({ seed: 2, palette }), -3, 0, 0.4), resource: 'wood' },
  { ...stationAt(createOreVein({ seed: 3, palette }), 0.5, -3.2, 0), resource: 'ore' },
  { ...stationAt(createSawhorse({ seed: 4, palette }), 3, 0.5, -0.5), resource: 'plank' },
  { ...stationAt(createCookpot({ seed: 5, palette }), 0, 3, Math.PI), resource: 'stew' },
];

// The worker.
const rig = createHumanoid({ seed: 14, palette: OUTFITS.villager });
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const worker = game.world.spawn('worker');
worker.add(rig.object);
worker.position.set(0, 0, 6);
const agent = worker.addComponent(new MotionAgent({ maxSpeed: 2.4, maxForce: 18, planar: true }));

// The stockpile the yields flow into, and a HUD reading it.
const stock = new Stockpile();
const ICON: Record<string, string> = { wood: '🪵', ore: '⛏️', plank: '🪚', stew: '🍲' };
const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:10px;right:12px;z-index:10;color:#fff;text-align:right;' +
  'font:600 16px/1.6 system-ui;text-shadow:0 1px 3px #000;user-select:none';
document.body.appendChild(hud);
const renderHud = () => {
  hud.innerHTML = ['wood', 'ore', 'plank', 'stew']
    .map((r) => `${ICON[r]} ${stock.count(r)}`)
    .join('<br>');
};
stock.events.on('change', renderHud);
renderHud();

// Cycle through the jobs: walk to each, work a few strikes, move on.
const walkTo = (p: Vector3): void => {
  agent.clearBehaviors();
  agent.maxSpeed = 2.4;
  agent.addBehavior(new FollowPath(new Path([worker.position.clone(), p], false), 0.4));
};

let index = 0;
let phase: 'walk' | 'work' = 'walk';
let tool: Object3D | null = null;
let loopAct: AnimationAction | null = null;
let yieldsHere = 0;
const TARGET = 4; // strikes per station before moving on
let current = jobs[0];
walkTo(current.at);

const startWork = (): void => {
  phase = 'work';
  agent.maxSpeed = 0;
  yieldsHere = 0;
  current.station.onYield = () => {
    stock.add(current.resource);
    yieldsHere += 1;
  };
  // Face the station, then layer the action loop over the idle stance — the
  // loop is the ONLY thing driving the arms, so it reads cleanly (no held pose
  // fighting it for the same bones).
  const c = current.station.object.position;
  worker.rotation.y = Math.atan2(c.x - worker.position.x, c.z - worker.position.z);
  loopAct = loco.overlay(createLoopClip(rig, current.station.action as never), { fadeIn: 0.3 });
  tool = current.station.tool;
  attach(rig, 'handRight', tool); // parent the tool into the right-hand socket
};
const leaveWork = (): void => {
  current.station.onYield = undefined;
  if (loopAct) {
    loco.stopOverlay(loopAct, 0.3);
    loopAct = null;
  }
  tool?.removeFromParent();
  tool = null;
  index += 1;
  if (index < jobs.length) {
    current = jobs[index];
    phase = 'walk';
    walkTo(current.at);
  } else {
    phase = 'walk';
    index = 0; // loop the round again
    current = jobs[0];
    walkTo(current.at);
  }
};

game.onUpdate((t) => {
  const dt = t.delta;
  loco.update(dt, phase === 'work' ? 0 : agent.velocity);
  ik.update();

  // The station only advances (effects + yield) while actively worked.
  for (const j of jobs) j.station.update(dt, phase === 'work' && j === current);

  if (phase === 'walk' && worker.position.distanceTo(current.at) < 0.55) {
    startWork();
  } else if (phase === 'work' && yieldsHere >= TARGET) {
    leaveWork();
  }

  const f = worker.position;
  camTarget.set(f.x + 4.5, 4, f.z + 6.5);
  game.camera.position.lerp(camTarget, Math.min(1, 2 * dt));
  game.camera.lookAt(f.x, 0.9, f.z - 1);
});
const camTarget = new Vector3(5, 5, 12);
game.camera.position.set(5, 5, 12);
game.start();

// Headless verification hook.
declare global {
  interface Window {
    laborDebug: () => Record<string, unknown>;
  }
}
window.laborDebug = () => {
  const gl = game.renderer.getContext();
  return {
    glError: gl.getError(),
    phase,
    station: current.station.object.name,
    progress: +current.station.progress.toFixed(2),
    stock: { wood: stock.count('wood'), ore: stock.count('ore'), plank: stock.count('plank'), stew: stock.count('stew') },
    total: stock.total,
    riderGap: +rig.object.getWorldPosition(new Vector3()).distanceTo(worker.position).toFixed(2),
    drawCalls: game.renderer.info.render.calls,
  };
};
