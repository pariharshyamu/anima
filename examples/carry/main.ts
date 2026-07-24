import { Mesh, PlaneGeometry, Vector3 } from 'three';
import {
  applyFog,
  createLightingRig,
  createSky,
  createSurface,
  createTree,
  createCart,
  createCrate,
  createBarrel,
  createBasket,
  createSack,
  createLantern,
  PALETTES,
} from 'scena3d';
import { createHumanoid, Carry, createReachClip, FootIK, Gesture, Locomotion, OUTFITS } from 'anima3d';
import { Game, MotionAgent, FollowPath, Path, throwObject } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(120, 120), createSurface('dirt', { seed: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
[[-9, 5], [9, -4]].forEach(([x, z], i) => {
  const tree = createTree({ species: 'oak', seed: 30 + i, height: 5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
});

// The cart the crate gets thrown onto, plus carryables dressing the yard.
const cart = createCart({ seed: 3, style: 'wagon', cargo: 'empty', palette });
cart.object.position.set(4.5, 0, -2.5);
cart.object.rotation.y = -0.5;
scene.add(cart.object);
// The wagon bed top: wheelR(0.5)*TYRE(1.11) + 0.18 + half the 0.12 deck.
const cartBed = new Vector3(4.5, 0.8, -2.5);
const place = (obj: import('three').Object3D, x: number, z: number): void => {
  obj.position.set(x, 0, z);
  scene.add(obj);
};
place(createBarrel({ seed: 5, palette }).object, -5.5, 4.2);
place(createBasket({ seed: 6, palette }).object, -6.2, 2.4);
place(createLantern({ seed: 7 }).object, -5.6, 0.6);

// The two things the porter will move.
const crate = createCrate({ seed: 2, size: 0.45, palette });
crate.object.position.set(-3, 0, 3);
scene.add(crate.object);
const sack = createSack({ seed: 4 });
sack.object.position.set(-4, 0, -3);
scene.add(sack.object);

// The porter, and a mate who receives the sack.
const rig = createHumanoid({ seed: 12, palette: OUTFITS.villager });
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const carry = new Carry(rig, loco);
const walker = game.world.spawn('porter');
walker.add(rig.object);
walker.position.set(0, 0, 6);
const agent = walker.addComponent(new MotionAgent({ maxSpeed: 2.6, maxForce: 18, planar: true }));

const mate = createHumanoid({ seed: 21, palette: OUTFITS.villager });
mate.object.position.set(2.2, 0, -5);
mate.object.rotation.y = Math.PI;
scene.add(mate.object);
const mateLoco = new Locomotion(mate);
const mateCarry = new Carry(mate, mateLoco);

// Walk helpers: approach a ground spot, stopping a little short of it.
const approach = (p: Vector3, gap = 0.9): Vector3 => {
  const dir = new Vector3().subVectors(walker.position, p).setY(0).normalize();
  return p.clone().addScaledVector(dir, gap);
};
const walkTo = (p: Vector3): void => {
  agent.clearBehaviors();
  agent.maxSpeed = 2.6;
  agent.addBehavior(new FollowPath(new Path([walker.position.clone(), p], false), 0.4));
};
const face = (p: Vector3): void => {
  walker.rotation.y = Math.atan2(p.x - walker.position.x, p.z - walker.position.z);
};

const cratePos = crate.object.position.clone();
const sackPos = sack.object.position.clone();
walkTo(approach(cratePos));

type Phase = 'toCrate' | 'toCart' | 'throwing' | 'toSack' | 'toMate' | 'done';
let phase: Phase = 'toCrate';
let reach: Gesture | null = null;
let fly: ((dt: number) => boolean) | null = null;

const startReach = (onApex: () => void): void => {
  agent.maxSpeed = 0;
  reach = new Gesture(loco, createReachClip(rig), { onApex });
};

game.onUpdate((t) => {
  const dt = t.delta;
  loco.update(dt, reach ? 0 : agent.velocity);
  mateLoco.update(dt, 0);
  ik.update();
  if (reach && !reach.update(dt)) reach = null;
  if (fly && !fly(dt)) fly = null;

  if (phase === 'toCrate' && walker.position.distanceTo(approach(cratePos)) < 0.5) {
    phase = 'toCart';
    face(cratePos);
    carry.pickUp(crate);
    walkTo(new Vector3(cartBed.x - 1.6, 0, cartBed.z + 1.2));
  } else if (phase === 'toCart' && walker.position.distanceTo(new Vector3(cartBed.x - 1.6, 0, cartBed.z + 1.2)) < 0.5) {
    phase = 'throwing';
    face(cartBed);
    startReach(() => {
      const box = carry.putDown();
      if (box) fly = throwObject(box, {
        to: cartBed, peak: 1.8, gravity: 20, ground: cartBed.y,
        spin: new Vector3(2, 0.6, 0), // a gentle tumble — lands tidily on the deck
      });
    });
  } else if (phase === 'throwing' && !reach && !fly) {
    phase = 'toSack';
    walkTo(approach(sackPos));
  } else if (phase === 'toSack' && walker.position.distanceTo(approach(sackPos)) < 0.5) {
    phase = 'toMate';
    face(sackPos);
    carry.pickUp(sack); // shoulder style
    walkTo(new Vector3(mate.object.position.x + 0.1, 0, mate.object.position.z + 1.1));
  } else if (phase === 'toMate' && walker.position.distanceTo(new Vector3(mate.object.position.x + 0.1, 0, mate.object.position.z + 1.1)) < 0.5) {
    phase = 'done';
    face(mate.object.position);
    carry.handTo(mateCarry);
  }

  const f = walker.position;
  camTarget.set(f.x + 4.5, 4.2, f.z + 7);
  game.camera.position.lerp(camTarget, Math.min(1, 2 * dt));
  game.camera.lookAt(f.x, 1, f.z - 1);
});
const camTarget = new Vector3(5, 5, 12);
game.camera.position.set(5, 5, 12);
game.start();

// Headless verification hook.
declare global {
  interface Window {
    carryDebug: () => Record<string, unknown>;
  }
}
const worldY = (o: { getWorldPosition: (v: Vector3) => Vector3 }): number =>
  +o.getWorldPosition(new Vector3()).y.toFixed(2);
window.carryDebug = () => {
  const gl = game.renderer.getContext();
  return {
    glError: gl.getError(),
    phase,
    holding: carry.holding ? carry.holding.object.name : null,
    crateY: worldY(crate.object),
    crateOnCart: +crate.object.getWorldPosition(new Vector3()).distanceTo(cartBed).toFixed(2),
    sackHeldY: worldY(sack.object),
    mateHolding: mateCarry.holding ? mateCarry.holding.object.name : null,
    reaching: reach !== null,
    flying: fly !== null,
    keeperPos: walker.position.toArray().map((n) => +n.toFixed(1)),
    riderGap: +rig.object.getWorldPosition(new Vector3()).distanceTo(walker.position).toFixed(2),
    drawCalls: game.renderer.info.render.calls,
  };
};
