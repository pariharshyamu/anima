import { Mesh, PlaneGeometry, Vector3 } from 'three';
import {
  applyFog,
  createLightingRig,
  createSky,
  createSurface,
  createTree,
  createDoor,
  createLever,
  createHatch,
  createPortcullis,
  PALETTES,
  type Manipulable,
} from 'scena3d';
import {
  createHumanoid,
  createReachClip,
  FootIK,
  Gesture,
  Locomotion,
  OUTFITS,
} from 'anima3d';
import { Game, MotionAgent, FollowPath, Path, Interactable, linkMechanism } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(120, 120), createSurface('cobblestone', { seed: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
[[-9, 4], [9, -2], [-7, -12]].forEach(([x, z], i) => {
  const tree = createTree({ species: 'oak', seed: 30 + i, height: 5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
});

// A curtain wall with a portcullis gateway; a lever beside it raises the gate.
for (const s of [-1, 1]) {
  const wall = new Mesh(new PlaneGeometry(6, 3.4), createSurface('ashlar', { seed: 4 }));
  wall.position.set(s * 4.9, 1.7, 0);
  scene.add(wall);
}
const portcullis = createPortcullis({ seed: 2, width: 2.4, height: 3.0 });
scene.add(portcullis.object);

const lever = createLever({ seed: 5, mount: 'base' });
lever.object.position.set(2.6, 0, 1.4);
lever.object.rotation.y = -0.5;
scene.add(lever.object);
linkMechanism(lever, portcullis); // throw the lever → the gate rises

// Beyond the gate: an automatic door, then a chest to open.
const door = createDoor({ seed: 7, width: 1.1, height: 2.1 });
door.object.position.set(0, 0, -5);
scene.add(door.object);
const doorObj = game.world.spawn('door');
doorObj.add(door.object);
doorObj.position.copy(door.object.position);
door.object.position.set(0, 0, 0);
doorObj.addComponent(new Interactable(door, { mode: 'auto', radius: 2.4, tag: 'player' }));

const chest = createHatch({ seed: 9, width: 0.9, depth: 0.6 });
chest.object.position.set(0, 0, -7.5);
scene.add(chest.object);

// The keeper.
const rig = createHumanoid({ seed: 12, palette: OUTFITS.villager });
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const walker = game.world.spawn('keeper');
walker.tags.add('player');
walker.add(rig.object);
walker.position.set(2.4, 0, 6);
const agent = walker.addComponent(new MotionAgent({ maxSpeed: 2.8, maxForce: 18, planar: true }));

// Where the keeper stands to work a manipulable: its operate slot, in world space.
const standAt = (m: Manipulable): Vector3 => {
  m.object.updateWorldMatrix(true, true);
  return m.slots![0].anchor.getWorldPosition(new Vector3());
};
const leverStand = standAt(lever);
const chestStand = standAt(chest);

const walkTo = (...points: Vector3[]): void => {
  agent.clearBehaviors();
  agent.maxSpeed = 2.8;
  agent.addBehavior(new FollowPath(new Path([walker.position.clone(), ...points], false), 0.4));
};
walkTo(leverStand);

type Phase = 'toLever' | 'throwing' | 'toChest' | 'opening' | 'done';
let phase: Phase = 'toLever';
let reach: Gesture | null = null;

const faceToward = (p: Vector3): void => {
  walker.rotation.y = Math.atan2(p.x - walker.position.x, p.z - walker.position.z);
};
const startReach = (onApex: () => void): void => {
  agent.maxSpeed = 0;
  reach = new Gesture(loco, createReachClip(rig), { onApex });
};

game.onUpdate((t) => {
  const dt = t.delta;
  loco.update(dt, reach ? 0 : agent.velocity);
  ik.update();
  if (reach && !reach.update(dt)) reach = null;

  if (phase === 'toLever' && walker.position.distanceTo(leverStand) < 0.6) {
    phase = 'throwing';
    faceToward(lever.object.position);
    startReach(() => lever.toggle()); // → portcullis rises via the link
  } else if (phase === 'throwing' && !reach && portcullis.state > 0.85) {
    phase = 'toChest';
    walkTo(new Vector3(0, 0, 1.2), new Vector3(0, 0, -3), chestStand);
  } else if (phase === 'toChest' && walker.position.distanceTo(chestStand) < 0.6) {
    phase = 'opening';
    faceToward(chest.object.position);
    startReach(() => chest.toggle());
  } else if (phase === 'opening' && !reach) {
    phase = 'done';
  }

  // Ease every mechanism toward its target (the auto-door's Interactable does its own).
  lever.update(dt);
  portcullis.update(dt);
  chest.update(dt);

  // Camera: follow the keeper down the approach.
  const f = walker.position;
  camTarget.set(f.x + 5, 4.5, f.z + 8);
  game.camera.position.lerp(camTarget, Math.min(1, 2 * dt));
  game.camera.lookAt(f.x, 1, f.z - 1);
});
const camTarget = new Vector3(6, 5, 12);
game.camera.position.set(6, 5, 12);
game.start();

// Headless verification hook.
declare global {
  interface Window {
    mechDebug: () => Record<string, unknown>;
  }
}
window.mechDebug = () => {
  const gl = game.renderer.getContext();
  return {
    glError: gl.getError(),
    phase,
    lever: +lever.state.toFixed(2),
    portcullis: +portcullis.state.toFixed(2),
    door: door.open,
    doorState: +door.state.toFixed(2),
    chest: +chest.state.toFixed(2),
    reaching: reach !== null,
    speed: +agent.velocity.length().toFixed(2),
    maxSpeed: agent.maxSpeed,
    chestDist: +walker.position.distanceTo(chestStand).toFixed(2),
    keeperPos: walker.position.toArray().map((n) => +n.toFixed(1)),
    riderGap: +rig.object.getWorldPosition(new Vector3()).distanceTo(walker.position).toFixed(2),
    drawCalls: game.renderer.info.render.calls,
  };
};
