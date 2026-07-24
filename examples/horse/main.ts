import { Mesh, PlaneGeometry, Vector3 } from 'three';
import { applyFog, createLightingRig, createSky, createSurface, PALETTES } from 'scena3d';
import { createQuadruped, QuadrupedLocomotion, type GaitName } from 'anima3d';
import { Game } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(200, 200), createSurface('dirt', { seed: 3 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// A row of horses, one per gait, so footfalls can be compared side by side.
const GAITS: GaitName[] = ['idle', 'walk', 'trot', 'canter', 'gallop'];
const horses = GAITS.map((gait, i) => {
  const rig = createQuadruped({ seed: 3 + i * 5, coat: (['bay','chestnut','grey','black','palomino'] as const)[i] });
  // Muybridge layout: all five in profile, facing the same way, so the
  // footfall patterns can be read against each other.
  rig.object.position.set((i - 2) * 3.3, 0, 0);
  rig.object.rotation.y = Math.PI / 2;
  scene.add(rig.object);
  const loco = new QuadrupedLocomotion(rig);
  loco.setGait(gait);
  return { rig, loco, gait };
});

game.onUpdate((t) => {
  for (const h of horses) {
    h.loco.update(t.delta, 0);
    h.loco.setGait(h.gait); // hold it, ignore speed-based selection
  }
});
game.camera.position.set(0, 1.35, 11);
game.camera.lookAt(0, 0.95, 0);
game.start();

declare global { interface Window { horseDebug: (a?: unknown) => Record<string, unknown>; horseShot: (n: string) => void; } }
const SHOTS: Record<string, [Vector3, Vector3]> = {
  row: [new Vector3(0, 1.35, 11.5), new Vector3(0, 0.95, 0)],
  profile: [new Vector3(-6.6, 0.95, 3.6), new Vector3(-6.6, 0.9, 0)],
  trot: [new Vector3(0, 0.95, 3.4), new Vector3(0, 0.9, 0)],
  gallop: [new Vector3(6.6, 0.95, 3.6), new Vector3(6.6, 0.9, 0)],
  front: [new Vector3(-6.6, 1.1, -3.2), new Vector3(-6.6, 0.9, 0)],
};
window.horseShot = (n) => { const s = SHOTS[n]; if (!s) return;
  game.onUpdate(() => { game.camera.position.copy(s[0]); game.camera.lookAt(s[1]); }); };
window.horseDebug = () => {
  const gl = game.renderer.getContext();
  const h = horses[1].rig;
  const hoofY: Record<string, number> = {};
  for (const leg of ['LF','RF','LH','RH']) {
    const b = h.bones[`${leg}Hoof` as never] as unknown as { getWorldPosition: (v: Vector3) => Vector3 };
    hoofY[leg] = +b.getWorldPosition(new Vector3()).y.toFixed(3);
  }
  return { glError: gl.getError(), gaits: horses.map((x) => x.loco.gait), hoofY,
    withers: h.height, drawCalls: game.renderer.info.render.calls };
};
