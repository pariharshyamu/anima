import {
  AmbientLight,
  Clock,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createPool, PALETTES, type Pool } from 'scena3d';
import {
  createHumanoid,
  Locomotion,
  OUTFITS,
  Swimming,
  type HumanoidRig,
  type Stroke,
} from 'anima3d';

const palette = PALETTES.urban;
const scene = new Scene();
const camera = new PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 200);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

scene.add(new AmbientLight(0xffffff, 0.6));
const key = new DirectionalLight(0xffffff, 1.3);
key.position.set(5, 10, 6);
scene.add(key);

// No ground plane: a pool is a hole, and a floor laid across one is a lid over
// it. The pool brings its own deck.
const pool: Pool = createPool({
  style: 'lido',
  length: 16,
  width: 8,
  shallow: 0.8,
  deep: 2.6,
  seed: 3,
  palette,
});
scene.add(pool.object);

const UP = new Vector3(0, 1, 0);

interface Bather {
  rig: HumanoidRig;
  loco: Locomotion;
  swim: Swimming;
  heading: number;
}

const bathers: Bather[] = [];
const add = (stroke: Stroke, lane: number, x: number, height: number, seed: number): void => {
  const rig = createHumanoid({ seed, height, palette: OUTFITS.villager });
  const loco = new Locomotion(rig);
  const swim = new Swimming(rig, loco, { stroke });
  rig.object.position.set(x, 0, lane);
  scene.add(rig.object);
  const b: Bather = { rig, loco, swim, heading: Math.PI / 2 };
  swim.steer(b.heading, stroke === 'tread' ? 0 : 1);
  bathers.push(b);
};

add('crawl', -2.8, -6, 1.78, 11);
add('breast', -1.0, -2, 1.68, 12);
add('back', 1.0, 2, 1.82, 13);
add('tread', 2.8, 5, 1.72, 14);
// A short one down the shallow end: the same water that is chest-deep on
// everyone else is over their head, and nobody had to configure that.
add('crawl', 3.4, -6.5, 1.3, 15);

const clock = new Clock();
let time = 0;

function step(dt: number): void {
  time += dt;
  pool.update(dt);
  for (const b of bathers) {
    b.loco.update(dt, 0);
    b.swim.update(dt, pool);
    // Turn at the ends, like anyone swimming lengths.
    const x = b.rig.object.position.x;
    const throttle = b.swim.stroke === 'tread' ? 0 : 1;
    if (x > 7 && b.heading > 0) {
      b.heading = -Math.PI / 2;
      b.swim.steer(b.heading, throttle);
    } else if (x < -7 && b.heading < 0) {
      b.heading = Math.PI / 2;
      b.swim.steer(b.heading, throttle);
    }
  }
}

renderer.setAnimationLoop(() => {
  if (pinned) return;
  step(Math.min(clock.getDelta(), 0.1));
  camera.position.set(Math.sin(time * 0.09) * 6, 5.5, 13);
  camera.lookAt(0, -0.4, 0);
  renderer.render(scene, camera);
});

// --- headless verification -----------------------------------------------
declare global {
  interface Window {
    poolDebug: () => Record<string, unknown>;
    poolLook: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => void;
    poolStep: (dt: number) => void;
  }
}
/**
 * Placing the camera PINS it. Without that the animation loop puts it back
 * on the next frame and every screenshot comes out from the same orbit,
 * which looks exactly like a camera that was never moved.
 */
let pinned = false;
window.poolStep = (dt: number) => {
  step(dt);
  renderer.render(scene, camera);
};
window.poolLook = (x, y, z, tx, ty, tz) => {
  pinned = true;
  camera.position.set(x, y, z);
  camera.lookAt(tx, ty, tz);
  renderer.render(scene, camera);
};
window.poolDebug = () => {
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  return {
    glError: gl.getError(),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    surfaceY: Number(pool.surfaceY.toFixed(3)),
    bathers: bathers.map((b) => ({
      stroke: b.swim.stroke,
      state: b.swim.state,
      height: Number(b.rig.height.toFixed(2)),
      depth: Number(pool.depthAt(b.rig.object.position.x, b.rig.object.position.z).toFixed(2)),
      x: Number(b.rig.object.position.x.toFixed(2)),
      z: Number(b.rig.object.position.z.toFixed(2)),
      y: Number(b.rig.object.position.y.toFixed(3)),
      // 1 = standing straight up, 0 = lying flat.
      upright: Number(UP.clone().applyQuaternion(b.rig.object.quaternion).y.toFixed(2)),
      cycles: b.swim.cycles,
    })),
  };
};
