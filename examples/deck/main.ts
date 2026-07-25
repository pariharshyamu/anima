import {
  AmbientLight, Clock, DirectionalLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from 'three';
import { createDeckedShip, createOcean, PALETTES } from 'scena3d';
import { createHumanoid, Locomotion, OUTFITS, SeaLegs, type HumanoidRig } from 'anima3d';

const palette = PALETTES.meadow;
const scene = new Scene();
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 900);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
scene.add(new AmbientLight(0xffffff, 0.62));
const key = new DirectionalLight(0xffffff, 1.2);
key.position.set(5, 9, 4);
scene.add(key);

const sea = createOcean({ amplitude: 0.95, wavelength: 22, size: 700, segments: 200 });
scene.add(sea.mesh);

const ship = createDeckedShip({ era: 'carrack', seed: 4, palette });
ship.float((x, z) => sea.heightAt(x, z));
scene.add(ship.object);

interface Sailor { rig: HumanoidRig; loco: Locomotion; legs: SeaLegs }
const crew: Sailor[] = [];
// One on each level, plus a second in the waist.
const spots: Array<[number, number]> = [[0, 0], [1.8, -1.5], [0, 9], [0, -8.5]];
spots.forEach(([x, z], i) => {
  const rig = createHumanoid({ seed: 11 + i * 5, height: 1.75, palette: OUTFITS.villager });
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  const legs = new SeaLegs(rig, loco, { seed: i * 3 + 1, footing: 0.4 });
  ship.update(1 / 60, {});
  const y = ship.deckAt(x, z);
  rig.object.position.set(x, y ?? 2, z);
  crew.push({ rig, loco, legs });
});

const clock = new Clock();
let time = 0;
let pinned = false;

function step(dt: number): void {
  time += dt;
  sea.update(dt);
  ship.update(dt, { speed: 5, turn: Math.sin(time * 0.09) * 0.04 });
  for (const s of crew) {
    s.loco.update(dt, 0);
    s.legs.update(dt, ship);   // ride → plant → lean → stagger
  }
}

renderer.setAnimationLoop(() => {
  if (pinned) return;
  step(Math.min(clock.getDelta(), 0.1));
  const p = ship.object.position;
  camera.position.set(p.x + 16, p.y + 9, p.z - 20);
  camera.lookAt(p.x, p.y + 2.5, p.z);
  renderer.render(scene, camera);
});

// --- headless verification -----------------------------------------------
declare global {
  interface Window {
    deckDebug: () => Record<string, unknown>;
    deckLook: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => void;
    deckStep: (dt: number) => void;
  }
}
/** Steps WITHOUT drawing — rendering belongs to look/debug. */
window.deckStep = (dt) => step(dt);
window.deckLook = (x, y, z, tx, ty, tz) => {
  pinned = true;
  camera.position.set(x, y, z);
  camera.lookAt(tx, ty, tz);
  renderer.render(scene, camera);
};
window.deckDebug = () => {
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const p = ship.object.position;
  return {
    glError: gl.getError(),
    drawCalls: renderer.info.render.calls,
    ship: {
      x: +p.x.toFixed(1),
      z: +p.z.toFixed(1),
      heading: +ship.object.rotation.y.toFixed(3),
      roll: +ship.roll.toFixed(3),
      motion: +ship.motion.toFixed(3),
    },
    crew: crew.map((s) => {
      s.rig.object.updateWorldMatrix(true, true);
      const up = new Vector3(0, 1, 0).applyQuaternion(s.rig.object.quaternion);
      return {
        aboard: s.legs.aboard,
        // How far off the deck he is standing, vertically. Should be ~0.
        offDeck: +Math.abs(
          s.rig.object.position.y -
            (ship.deckAt(s.rig.object.position.x, s.rig.object.position.z, s.rig.object.position.y) ?? 0)
        ).toFixed(3),
        tilt: +up.angleTo(new Vector3(0, 1, 0)).toFixed(3),
        effort: +s.legs.effort.toFixed(2),
        staggering: s.legs.staggering,
      };
    }),
  };
};
