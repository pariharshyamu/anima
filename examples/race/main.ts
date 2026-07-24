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
import { Game } from 'gama3d';
import { createRace, Circuit } from 'gama3d/templates';

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

// The whole race — player + two rivals + camera + touch + collisions + laps —
// packaged by GAMA's createRace. All that's left is world-building and a HUD.
const player = createCar({ seed: 3, color: 0xb8433a, palette });
const rivalCars = [0x3a6ea5, 0x3f7f5c].map((color, i) =>
  createCar({ seed: 11 + i, color, palette })
);
const race = createRace(game, {
  circuit,
  player: { object: player.object, vehicle: player, name: 'you' },
  rivals: rivalCars.map((car, i) => ({
    object: car.object,
    vehicle: car,
    speed: 10 + i,
    name: `rival ${i + 1}`,
  })),
  laps: 3,
  camera: { distance: 8.5, height: 4.4 },
});

// An ANIMA driver rides the player's (moving) seat.
const rig = createHumanoid({ seed: 9, palette: OUTFITS.villager });
race.player.object.add(rig.object);
const loco = new Locomotion(rig);
const act = new Interaction(rig, loco);
act.use(player.slots![0], { fade: 0.01 });

// HUD.
const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:10px;right:12px;z-index:10;color:#fff;text-align:right;' +
  'font:600 15px/1.5 system-ui;text-shadow:0 1px 3px #000;user-select:none';
if (innerWidth < 560) hud.style.top = '84px';
document.body.appendChild(hud);

game.onUpdate((t) => {
  loco.update(t.delta, 0);
  act.update(t.delta);
  const s = race.state;
  const best = s.bestLap === Infinity ? 0 : s.bestLap;
  hud.textContent =
    `P${s.position}/${s.total} · LAP ${Math.min(s.lap + 1, 3)}/3 · ${s.lapTime.toFixed(1)}s` +
    (best ? ` · best ${best.toFixed(1)}s` : '') +
    ` · ${Math.round(race.player.controller.speed * 3.6)} km/h`;
});

// Finish screen — the race has a terminal state now.
race.onFinish((r) => {
  const place = ['🏆 1st', '🥈 2nd', '🥉 3rd'][r.position - 1] ?? `P${r.position}`;
  const card = document.createElement('div');
  card.style.cssText =
    'position:fixed;inset:0;z-index:30;display:grid;place-items:center;' +
    'background:rgba(6,9,16,.72);backdrop-filter:blur(3px)';
  const best = r.bestLap === Infinity ? 0 : r.bestLap;
  card.innerHTML =
    `<div style="text-align:center;color:#eef2f7;font:600 20px/1.6 system-ui">` +
    `<div style="font-size:44px;margin-bottom:6px">${place}</div>` +
    `<div>Total ${r.totalTime.toFixed(1)}s · best lap ${best.toFixed(1)}s</div>` +
    `<button id="again" style="margin-top:18px;padding:10px 22px;font:600 15px system-ui;` +
    `border:0;border-radius:8px;background:#b8433a;color:#fff;cursor:pointer">Race again</button></div>`;
  document.body.appendChild(card);
  card.querySelector('#again')!.addEventListener('click', () => {
    card.remove();
    race.reset();
  });
});

game.start();

// Headless verification hook.
declare global {
  interface Window {
    raceDebug: (throttle?: number, steer?: number) => Record<string, unknown>;
  }
}
window.raceDebug = (throttle?: number, steer?: number) => {
  if (throttle !== undefined)
    race.player.controller.setIntentSource(() => ({ throttle, steer: steer ?? 0 }));
  else race.player.controller.setIntentSource(null);
  const s = race.state;
  const gl = game.renderer.getContext();
  return {
    glError: gl.getError(),
    speed: +race.player.controller.speed.toFixed(2),
    heading: +race.player.body.rotation.y.toFixed(3),
    position: s.position,
    lap: s.lap,
    standings: s.standings.map((x) => `${x.name} L${x.lap} ${(x.progress * 100) | 0}%`),
    riderGap: +rig.object
      .getWorldPosition(new Vector3())
      .distanceTo(race.player.body.position)
      .toFixed(2),
    pads: document.querySelectorAll('.gama-touch').length,
    rivalSpeeds: race.rivals.map((r) => +r.agent.velocity.length().toFixed(1)),
    drawCalls: game.renderer.info.render.calls,
  };
};
