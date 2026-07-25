import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createPrepStation, PALETTES, PREP_KINDS, type PrepStation } from 'scena3d';
import {
  createHumanoid,
  Locomotion,
  OUTFITS,
  Prepping,
  type HumanoidRig,
  type PrepTask,
} from 'anima3d';

const palette = PALETTES.meadow;
const scene = new Scene();
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
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
const key = new DirectionalLight(0xffffff, 1.15);
key.position.set(3, 7, 5);
scene.add(key);
const floor = new Mesh(
  new PlaneGeometry(40, 40),
  new MeshStandardMaterial({ color: 0x5d5852, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

interface Cook {
  rig: HumanoidRig;
  loco: Locomotion;
  prep: Prepping;
  station: PrepStation;
}

const cooks: Cook[] = [];
PREP_KINDS.forEach((kind, i) => {
  const station = createPrepStation({ kind, seed: i + 4, batch: 400, palette });
  station.object.position.set(-2.9 + i * 1.45, 0, 0);
  scene.add(station.object);

  const rig = createHumanoid({ seed: 30 + i * 7, palette: OUTFITS.villager });
  const loco = new Locomotion(rig);
  const prep = new Prepping(rig, loco, { hand: i === 3 ? 'Left' : 'Right' });
  // Stand at the station's own work slot, which it publishes for exactly
  // this — nobody has to guess where a cook goes.
  station.object.updateMatrixWorld(true);
  const slot = station.slots![0];
  rig.object.position.copy(slot.anchor.getWorldPosition(new Vector3()));
  rig.object.rotation.y = slot.anchor.rotation.y;
  scene.add(rig.object);
  prep.do(station.action as PrepTask);
  cooks.push({ rig, loco, prep, station });
});

const clock = new Clock();
let time = 0;
let pinned = false;

function step(dt: number): void {
  time += dt;
  for (const c of cooks) {
    c.loco.update(dt, 0);
    // AFTER the mixer: the feed retreat is applied on top of its result.
    c.prep.update(dt);
    c.station.update(dt, true);
  }
}

renderer.setAnimationLoop(() => {
  if (pinned) return;
  step(Math.min(clock.getDelta(), 0.1));
  camera.position.set(Math.sin(time * 0.11) * 1.6, 1.68, 3.3);
  camera.lookAt(0, 1.0, 0);
  renderer.render(scene, camera);
});

// --- headless verification -----------------------------------------------
declare global {
  interface Window {
    prepDebug: () => Record<string, unknown>;
    prepLook: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => void;
    prepStep: (dt: number) => void;
  }
}
/** Steps WITHOUT drawing — rendering belongs to look/debug. */
window.prepStep = (dt: number) => step(dt);
window.prepLook = (x, y, z, tx, ty, tz) => {
  pinned = true;
  camera.position.set(x, y, z);
  camera.lookAt(tx, ty, tz);
  renderer.render(scene, camera);
};
window.prepDebug = () => {
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  return {
    glError: gl.getError(),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    cooks: cooks.map((c) => {
      c.rig.object.updateWorldMatrix(true, true);
      const root = c.rig.object.getWorldPosition(new Vector3());
      const l = c.rig.bones.LeftHand.getWorldPosition(new Vector3()).sub(root);
      const r = c.rig.bones.RightHand.getWorldPosition(new Vector3()).sub(root);
      return {
        kind: c.station.kind,
        task: c.prep.task,
        cycles: c.prep.count,
        feed: Number(c.prep.feed.toFixed(2)),
        gap: Number(Math.abs(l.x - r.x).toFixed(3)),
        handY: [Number(l.y.toFixed(2)), Number(r.y.toFixed(2))],
      };
    }),
  };
};
