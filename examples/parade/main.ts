import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three';
import {
  attach,
  createHumanoid,
  createWaveClip,
  FootIK,
  LookAt,
  Locomotion,
  OUTFITS,
  type HumanoidRig,
} from 'anima3d';
import {
  createTerrain,
  createSky,
  createLightingRig,
  applyFog,
  createPath,
  createTree,
  createRock,
  scatter,
  PALETTES,
} from 'scena3d';
import { Game, MotionAgent, FollowPath, Path, ObstacleAvoidance, Separation } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;

// --- The world (SCENA).
const terrain = createTerrain({ seed: 18, size: 90, amplitude: 5, palette });
scene.add(terrain.mesh, createSky({ palette }).mesh, createLightingRig('golden-hour').group);
applyFog(scene, 'haze', palette);

const road = createPath(
  [
    { x: -18, z: -10 }, { x: 0, z: -16 }, { x: 16, z: -6 },
    { x: 14, z: 12 }, { x: -2, z: 14 }, { x: -20, z: 6 },
  ],
  { surface: terrain.heightAt, width: 2.2, loop: true, palette }
);
scene.add(road.mesh);

const forest = scatter({
  seed: 21,
  area: { min: { x: -40, z: -40 }, max: { x: 40, z: 40 } },
  surface: terrain.heightAt,
  density: 0.045,
  minSpacing: 1.7,
  items: [
    { create: (rng) => createTree({ seed: rng.int(1, 1e9), palette }), weight: 4, variants: 6 },
    { create: (rng) => createRock({ seed: rng.int(1, 1e9), palette }) },
  ],
  mask: (x, z, y) => y < 3.6,
  keepOut: [{ center: { x: 0, z: 0 }, radius: 10 }, ...road.keepOut],
});
scene.add(forest.group);

// --- The people (ANIMA driven by GAMA).
interface Character {
  rig: HumanoidRig;
  loco: Locomotion;
  ik: FootIK;
  agent?: MotionAgent;
  gaze?: LookAt;
}
const characters: Character[] = [];
const agents: MotionAgent[] = [];

function traveler(seed: number, maxSpeed: number, routeOffset: number, outfit = OUTFITS.villager): void {
  const rig = createHumanoid({ seed, palette: outfit });
  const walker = game.world.spawn(`traveler-${seed}`);
  walker.add(rig.object);
  const patrol = new Path(road.route.map((p) => p.clone()), true);
  for (let s = 0; s < routeOffset; s++) patrol.advance();
  walker.position.copy(patrol.current());
  const agent = walker.addComponent(
    new MotionAgent({ maxSpeed, maxForce: 22, planar: true })
  );
  agent.addBehavior(new FollowPath(patrol, 1.5));
  agent.addBehavior(new ObstacleAvoidance(() => forest.obstacles, 3, 0.5), 2.2);
  agent.addBehavior(new Separation(() => agents, 1.4), 1.1);
  agents.push(agent);
  characters.push({
    rig,
    loco: new Locomotion(rig),
    ik: new FootIK(rig, { ground: terrain.heightAt }),
    agent,
  });
}

// Three walkers at strolling speeds, one runner overtaking everyone.
traveler(101, 1.3, 0);
traveler(102, 1.5, 12, OUTFITS.guard);
traveler(103, 1.2, 24);
traveler(104, 3.6, 30, OUTFITS.guard);

// The lead traveler carries a torch — attached to the hand socket, it
// swings with the arm through every stride.
const torch = new Group();
const handle = new Mesh(
  new CylinderGeometry(0.02, 0.028, 0.5, 6),
  new MeshStandardMaterial({ color: 0x5d4030, flatShading: true })
);
handle.position.y = 0.18;
const flame = new Mesh(
  new SphereGeometry(0.055, 8, 6),
  new MeshStandardMaterial({ color: 0xffd889, emissive: 0xffb347, emissiveIntensity: 2.2 })
);
flame.position.y = 0.48;
flame.scale.y = 1.5;
torch.add(handle, flame, new PointLight(0xffb347, 4, 8, 1.8));
attach(characters[0].rig, 'handRight', torch);

// The cast lineup: idle villagers near the clearing — every one a seed.
// Their feet plant on the slope (FootIK) and their heads follow whoever
// walks past (LookAt). The last one waves at the road, forever.
for (let i = 0; i < 6; i++) {
  const rig = createHumanoid({ seed: 200 + i });
  const x = -5 + i * 2.1;
  const z = -5.5;
  rig.object.position.set(x, terrain.heightAt(x, z), z);
  rig.object.rotation.y = Math.PI + (i - 2.5) * 0.12; // loosely facing camera side
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  characters.push({
    rig,
    loco,
    ik: new FootIK(rig, { ground: terrain.heightAt }),
    gaze: new LookAt(rig),
  });
  if (i === 5) loco.overlay(createWaveClip(rig), { fadeIn: 0.1 });
}

const scratch = new Vector3();
game.onUpdate((t) => {
  for (const { rig, loco, ik, agent, gaze } of characters) {
    if (agent) {
      const p = agent.owner.position;
      p.y = terrain.heightAt(p.x, p.z);
      loco.update(t.delta, agent.velocity);
    } else {
      loco.update(t.delta, 0);
      if (gaze) {
        // Watch the nearest traveler strolling past.
        let best: MotionAgent | null = null;
        let bestDistance = 14;
        for (const candidate of agents) {
          const d = candidate.owner.position.distanceTo(
            rig.object.getWorldPosition(scratch)
          );
          if (d < bestDistance) {
            bestDistance = d;
            best = candidate;
          }
        }
        gaze.target = best ? best.owner.position : null;
        gaze.update(t.delta);
      }
    }
    ik.update();
  }
});

// --- Camera: low, close orbit so legs and gait are the show.
const params = new URLSearchParams(location.search);
const follow = params.get('follow');
if (follow !== null) {
  // Track a traveler up close — the gait is the show (?follow=0..3).
  const target = agents[Math.min(agents.length - 1, Math.max(0, parseInt(follow, 10) || 0))];
  game.onUpdate(() => {
    const p = target.owner.position;
    const side = target.owner.getWorldDirection(new Vector3());
    game.camera.position.set(p.x - side.z * 3.4 + side.x * 1.2, p.y + 1.5, p.z + side.x * 3.4 + side.z * 1.2);
    game.camera.lookAt(p.x, p.y + 1.0, p.z);
  });
} else {
  const cameraStart = parseFloat(params.get('cam') ?? '0');
  const radius = parseFloat(params.get('r') ?? '17');
  const height = parseFloat(params.get('h') ?? '5.5');
  game.onUpdate((time) => {
    const a = cameraStart + time.elapsed * 0.035;
    const y = terrain.heightAt(0, 0);
    game.camera.position.set(Math.cos(a) * radius, y + height, Math.sin(a) * radius);
    game.camera.lookAt(0, y + 1.2, -3);
  });
}

game.start();
