import { Clock, Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import {
  createBathtub,
  createBed,
  createGuitar,
  createInteriorLight,
  createRoom,
  createRug,
  createSeat,
  createSink,
  createToilet,
  createTreadmill,
  PALETTES,
  type Prop,
} from 'scena3d';
import { createHumanoid, Interaction, Locomotion, OUTFITS } from 'anima3d';

const scene = new Scene();
scene.background = new Color(0x0a0d13);
const palette = PALETTES.urban;

const camera = new PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 100);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// The home: one open room, morning light through the windows.
const room = createRoom(
  [
    '#########',
    '#.......#',
    'W.......W',
    '#.......#',
    '##WDW####',
  ],
  { seed: 8, palette }
);
scene.add(room.group);
const light = createInteriorLight(room, { sun: { elevation: 0.55, azimuth: 0.8 }, shaftStrength: 0.16 });
light.hemisphere.intensity = 0.95;

const place = <T extends Prop>(prop: T, x: number, z: number, ry = 0): T => {
  prop.object.position.set(x, 0, z);
  prop.object.rotation.y = ry;
  scene.add(prop.object);
  return prop;
};

// ---- the props ---------------------------------------------------------
const bed = place(createBed({ seed: 3, size: 'single', palette }), -5.6, -1.6, Math.PI / 2);
const treadmill = place(createTreadmill({ seed: 4, speed: 2.5, palette }), 5.2, -1.6, -0.35);
const chair = place(createSeat({ seed: 5, style: 'chair', palette }), 0.4, 0.2, -0.35);
place(createRug({ seed: 6, shape: 'round', palette }), 0.2, 0.6);
place(createToilet({ seed: 7 }), 6.5, 0.6, -Math.PI / 2);
place(createSink({ seed: 8 }), 6.2, 2.3, Math.PI);
place(createBathtub({ seed: 9, palette }), 4.3, 2.2, Math.PI / 2);

// ---- the people --------------------------------------------------------
interface Actor {
  loco: Locomotion;
  act: Interaction;
}
const actors: Actor[] = [];
const cast = (seed: number): ReturnType<typeof createHumanoid> => {
  const rig = createHumanoid({ seed, palette: OUTFITS.villager });
  scene.add(rig.object);
  return rig;
};

// The sleeper: on the bed's sleep slot, breathing.
const sleeperRig = cast(21);
{
  const loco = new Locomotion(sleeperRig);
  const act = new Interaction(sleeperRig, loco);
  act.use(bed.slots![0], { fade: 0.05 });
  actors.push({ loco, act });
}

// The guitarist: seated on the chair's sit slot, strumming, guitar on lap.
const playerRig = cast(22);
{
  const loco = new Locomotion(playerRig);
  const act = new Interaction(playerRig, loco);
  act.use({ ...chair.slots![0], loop: 'strum' }, { fade: 0.05 });
  actors.push({ loco, act });
  const guitar = createGuitar({ seed: 2 });
  guitar.object.scale.setScalar(0.9);
  guitar.object.position.set(0.02, 0.02, 0.16);
  guitar.object.rotation.set(0.25, 0.35, -1.1); // across the lap, neck up-left
  playerRig.bones.Chest.add(guitar.object);
}

// The runner: standing on the treadmill's run slot, gait fed by the belt.
const runnerRig = cast(23);
const runnerLoco = new Locomotion(runnerRig);
{
  const slot = treadmill.slots![0];
  slot.anchor.updateWorldMatrix(true, false);
  slot.anchor.getWorldPosition(runnerRig.object.position);
  runnerRig.object.quaternion.copy(slot.anchor.getWorldQuaternion(runnerRig.object.quaternion));
}

const clock = new Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  for (const actor of actors) {
    actor.loco.update(dt, 0);
    actor.act.update(dt);
  }
  runnerLoco.update(dt, treadmill.speed); // running, going nowhere
  const t = clock.elapsedTime;
  camera.position.set(0.2 + Math.sin(t * 0.1) * 0.9, 2.5, 2.85);
  camera.lookAt(0.1, 0.75, -1.9);
  renderer.render(scene, camera);
});

// Headless verification hook.
declare global {
  interface Window {
    homeDebug: () => Record<string, unknown>;
  }
}
window.homeDebug = () => {
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  return {
    glError: gl.getError(),
    sleepWeight: +actors[0].act.poseWeight.toFixed(3),
    strumWeight: +actors[1].act.poseWeight.toFixed(3),
    runnerSpeed: +runnerLoco.speed.toFixed(2),
    runnerWalkRun: +(runnerLoco.weights.walk + runnerLoco.weights.run).toFixed(2),
    treadmillSpeed: treadmill.speed,
    sleeperY: +sleeperRig.object.position.y.toFixed(2),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };
};
