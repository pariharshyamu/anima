import { Mesh, PlaneGeometry, Vector3 } from 'three';
import {
  applyFog,
  createBungalow,
  createCar,
  createGate,
  createLightingRig,
  createSky,
  createSurface,
  createTree,
  PALETTES,
} from 'scena3d';
import { createHumanoid, FootIK, Interaction, Locomotion, OUTFITS } from 'anima3d';
import { Game, MotionAgent, FollowPath, Path } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const court = new Mesh(new PlaneGeometry(160, 160), createSurface('concrete', { seed: 1 }));
court.rotation.x = -Math.PI / 2;
scene.add(court);

// The plot: a villa, its driveway gate, and the car waiting on the drive.
const villa = createBungalow({ seed: 23, palette });
villa.object.position.set(-14, 0, -10);
villa.object.rotation.y = 0.3;
scene.add(villa.object);
const gate = createGate({ style: 'slat', width: 3.4, seed: 4, palette });
gate.object.position.set(-4, 0, 2);
gate.object.rotation.y = 0.3;
scene.add(gate.object);
const car = createCar({ seed: 7, palette });
car.object.position.set(-8.5, 0, -2.5);
car.object.rotation.y = 2.2;
scene.add(car.object);
[[6, -14], [16, 6], [-20, 12]].forEach(([x, z], i) => {
  const tree = createTree({ species: 'maple', seed: 30 + i, height: 5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
});

// The commuter.
const rig = createHumanoid({ seed: 12, palette: OUTFITS.villager });
scene.add(rig.object);
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const interaction = new Interaction(rig, loco);

// Phase 1 — GAMA walks them from the villa door to the driver's door.
const walker = game.world.spawn('commuter');
walker.add(rig.object);
walker.position.copy(villa.object.localToWorld(villa.entry.clone()));
const doorPoint = car.object.localToWorld(new Vector3(-1.3, 0, -0.15));
const agent = walker.addComponent(new MotionAgent({ maxSpeed: 1.5, maxForce: 18, planar: true }));
agent.addBehavior(new FollowPath(new Path([walker.position.clone(), doorPoint], false), 0.5));

// Phase 3 — the CAR becomes the agent: a lap of the block, out the gate.
const lap = [
  { x: -6.2, z: 0.6 }, { x: -1, z: 9 }, { x: 12, z: 16 }, { x: 24, z: 8 },
  { x: 26, z: -8 }, { x: 12, z: -18 }, { x: -2, z: -14 }, { x: -8.5, z: -4 },
].map((p) => new Vector3(p.x, 0, p.z));
let carAgent: MotionAgent | null = null;
const startDriving = (): void => {
  const carrier = game.world.spawn('car-agent');
  carrier.position.copy(car.object.position);
  carrier.add(car.object);
  car.object.position.set(0, 0, 0);
  carAgent = carrier.addComponent(new MotionAgent({ maxSpeed: 6.5, maxForce: 14, planar: true }));
  carAgent.addBehavior(new FollowPath(new Path(lap, true), 2.2));
};

type PhaseName = 'walk' | 'board' | 'drive';
let phase: PhaseName = 'walk';
let boardTimer = 0;

game.onUpdate((t) => {
  const dt = t.delta;

  if (phase === 'walk') {
    loco.update(dt, agent.velocity);
    ik.update();
    if (walker.position.distanceTo(doorPoint) < 0.7) {
      phase = 'board';
      agent.maxSpeed = 0; // GAMA lets go…
      interaction.use({ ...car.slots![0] }, { fade: 0.7 }); // …ANIMA takes the seat
    }
  } else {
    loco.update(dt, 0);
    interaction.update(dt);
    if (phase === 'board') {
      boardTimer += dt;
      if (boardTimer > 1.6) {
        phase = 'drive';
        startDriving(); // …and GAMA takes the car
      }
    }
  }

  // The car's running gear follows its agent; the gate opens as it nears.
  if (carAgent) {
    const speed = Math.hypot(carAgent.velocity.x, carAgent.velocity.z);
    const carrier = carAgent.owner;
    if (speed > 0.2) {
      const desired = Math.atan2(carAgent.velocity.x, carAgent.velocity.z);
      let delta = desired - carrier.rotation.y;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      carrier.rotation.y += delta * Math.min(1, 3.2 * dt);
      car.update(dt, { speed, steer: delta * 1.4 });
    } else {
      car.update(dt, { speed, steer: 0 });
    }
    const gateDistance = carrier.position.distanceTo(gate.object.position);
    gate.setOpen(Math.min(1, Math.max(0, (10 - gateDistance) / 6)));
  }

  // Camera: wide while walking, loose chase once the car rolls.
  const focus = carAgent ? carAgent.owner.position : walker.position;
  const behind = carAgent ? 13 : 8;
  camTarget.set(focus.x + 6, carAgent ? 6.5 : 3.6, focus.z + behind);
  game.camera.position.lerp(camTarget, Math.min(1, 2.2 * dt));
  game.camera.lookAt(focus.x, 1.0, focus.z);
});
const camTarget = new Vector3(0, 4, 14);
game.camera.position.set(2, 4, 12);
game.start();

// Headless verification hook.
declare global {
  interface Window {
    commuteDebug: () => Record<string, unknown>;
  }
}
window.commuteDebug = () => {
  const gl = game.renderer.getContext();
  const carrier = carAgent?.owner;
  return {
    glError: gl.getError(),
    phase,
    poseWeight: +interaction.poseWeight.toFixed(3),
    walkerToDoor: +walker.position.distanceTo(doorPoint).toFixed(2),
    carSpeed: carAgent ? +Math.hypot(carAgent.velocity.x, carAgent.velocity.z).toFixed(2) : 0,
    carPos: carrier ? carrier.position.toArray().map((n) => +n.toFixed(1)) : null,
    riderPos: rig.object.getWorldPosition(new Vector3()).toArray().map((n) => +n.toFixed(1)),
    drawCalls: game.renderer.info.render.calls,
  };
};
