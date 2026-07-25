import { Mesh, PlaneGeometry, Vector2, Vector3 } from 'three';
import {
  applyFog,
  createBridle,
  createFence,
  createLadder,
  createLightingRig,
  createSaddle,
  createSky,
  createSurface,
  createTree,
  PALETTES,
} from 'scena3d';
import {
  Climb,
  createHumanoid,
  createQuadruped,
  FootIK,
  Locomotion,
  Mount,
  OUTFITS,
  QuadrupedLocomotion,
} from 'anima3d';
import { Game, RideController, TouchControls } from 'gama3d';

const palette = PALETTES.meadow;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(400, 400), createSurface('dirt', { seed: 4 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
for (const [x, z, seed] of [
  [-14, -10, 41],
  [16, -14, 42],
  [-18, 12, 43],
  [20, 10, 44],
] as const) {
  const tree = createTree({ species: 'oak', seed, height: 6, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
}
// A paddock rail to give the speed something to read against.
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  const fence = createFence({ seed: 50 + i, palette });
  fence.object.position.set(Math.sin(a) * 26, 0, Math.cos(a) * 26);
  fence.object.rotation.y = a + Math.PI / 2;
  scene.add(fence.object);
}

// ---- the horse ---------------------------------------------------------

const horse = createQuadruped({ seed: 11, species: 'horse', coat: 'bay', marking: 'blaze' });
horse.object.position.set(2.4, 0, 0);
scene.add(horse.object);
const gaits = new QuadrupedLocomotion(horse);
// Tack, built to the rig's own fixtures — it lands where the seat is.
const saddle = createSaddle({ horseHeight: horse.height, style: 'english' });
horse.saddle.add(saddle.object);
const bridle = createBridle({ horseHeight: horse.height });
horse.bones.Head.add(bridle.object);

// ---- the rider ---------------------------------------------------------

const rig = createHumanoid({ seed: 21, palette: OUTFITS.villager });
rig.object.position.set(0, 0, 0);
scene.add(rig.object);
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const mount = new Mount(rig, loco);
const climb = new Climb(rig, loco);

// ---- the ladder --------------------------------------------------------

const ladder = createLadder({ seed: 7, height: 4.2, style: 'wooden', palette });
ladder.object.position.set(-6, 0, -5);
ladder.object.rotation.y = Math.PI; // rungs face the paddock
scene.add(ladder.object);
const platform = new Mesh(
  new PlaneGeometry(2.6, 2.6),
  createSurface('plank', { color: palette.wood, seed: 8 })
);
platform.rotation.x = -Math.PI / 2;
platform.position.set(-6, ladder.rungs * ladder.rungSpacing, -5.9);
scene.add(platform);

// ---- control -----------------------------------------------------------

const ride = new RideController({ topSpeed: 11.5 });
ride.reset(0);
ride.heading = 0;
horse.object.rotation.y = ride.heading;

new TouchControls(game.input, {
  buttons: [
    { label: 'Mount', code: 'KeyE', css: 'right:26px;bottom:118px' },
    { label: 'Halt', code: 'Space', css: 'right:26px;bottom:40px' },
    { label: 'Climb', code: 'KeyC', css: 'right:132px;bottom:40px' },
  ],
});

let holdSpeed = false; // test hook: freeze speed to measure steady-state skate
let testUrge: number | null = null; // test hook: a sustained ask
let sideView = false; // test hook: watch from the side, where a seat reads
const hud = document.getElementById('hud')!;
const axis = new Vector2();

// Walking the rider around on foot, before they get on.
const onFoot = new Vector3();

game.onUpdate((t) => {
  const dt = t.delta;
  game.input.moveAxis(axis);

  if (game.input.wasPressed('KeyE')) {
    if (mount.phase === 'off' && !climb.climbing) {
      // Walk-up range: you have to be beside the horse to get on it.
      const gap = rig.object.getWorldPosition(new Vector3()).distanceTo(
        horse.object.getWorldPosition(new Vector3())
      );
      if (gap < 3.5) mount.mount(horse);
    } else if (mount.mounted) {
      mount.dismount();
    }
  }
  if (game.input.wasPressed('KeyC') && mount.phase === 'off' && !climb.climbing) {
    climb.start({ bottom: ladder.bottom, top: ladder.top, rungSpacing: ladder.rungSpacing });
  }

  // The horse is always running its own physics, ridden or not — step off a
  // galloping horse and it carries on and settles to a halt by itself,
  // rather than freezing mid-stride the moment nobody is aboard.
  const seated = mount.phase === 'seated';
  if (!holdSpeed) {
    ride.update(dt, {
      urge: seated ? (testUrge ?? axis.y) : 0,
      rein: seated ? axis.x : 0,
      halt: seated && game.input.isDown('Space'),
    });
  }
  ride.applyTo(horse.object, dt);
  gaits.update(dt, ride.speed);

  if (seated) {
    // The rider takes the seat that matches the gait — and posts in time
    // with the trot's own stride, not on some unrelated clock.
    const stride = gaits.mixer.clipAction(gaits.clips.trot).timeScale || 1;
    mount.followGait(gaits.gait, stride);
    loco.update(dt, 0);
  } else {
    // On foot: the rider walks.
    if (!climb.climbing && mount.phase === 'off') {
      onFoot.set(axis.x, 0, axis.y).multiplyScalar(2.4);
      if (onFoot.lengthSq() > 0.01) {
        rig.object.position.addScaledVector(onFoot, dt);
        rig.object.rotation.y = Math.atan2(onFoot.x, onFoot.z);
      }
      loco.update(dt, onFoot);
      ik.update();
    } else {
      loco.update(dt, 0);
    }
  }
  mount.update(dt);
  climb.update(dt);

  // Camera: behind whatever the player is currently being.
  const subject = mount.phase === 'seated' ? horse.object : rig.object;
  const at = subject.getWorldPosition(new Vector3());
  const behind = mount.phase === 'seated' ? 7.5 + ride.effort * 4 : 5;
  const heading = mount.phase === 'seated' ? ride.heading : rig.object.rotation.y;
  const want = new Vector3(
    at.x - Math.sin(heading) * behind,
    at.y + 2.6 + ride.effort * 0.8,
    at.z - Math.cos(heading) * behind
  );
  if (sideView) {
    // Broadside, level with the saddle — the view a seat is judged from.
    want.set(at.x - Math.cos(heading) * 4.2, at.y + 1.35, at.z + Math.sin(heading) * 4.2);
    game.camera.position.copy(want);
    game.camera.lookAt(at.x, at.y + 1.15, at.z);
  } else {
    game.camera.position.lerp(want, Math.min(1, dt * 3));
    game.camera.lookAt(at.x, at.y + 1.2, at.z);
  }

  hud.innerHTML =
    `<b>${gaits.gait}</b><br>${ride.speed.toFixed(1)} m/s<br>` +
    `seat: ${mount.phase === 'seated' ? mount.seat : mount.phase}` +
    (climb.climbing ? `<br>climb ${(climb.progress * 100) | 0}%` : '');
});

game.camera.position.set(0, 3, -8);
game.start();

// Headless verification hook.
declare global {
  interface Window {
    ridingDebug: () => Record<string, unknown>;
    ridingDo: (what: string) => void;
    ridingSkate: () => Record<string, number>;
    ridingLimbs: () => Record<string, number>;
  }
}
// Foot-skate probe: a PLANTED hoof should be motionless in world space
// while the horse moves under it. Any residual world speed IS the slide.
const hoofLast = new Map<string, Vector3>();
let slipWorst = 0;
let slipMin = Infinity;
game.onUpdate((t) => {
  if (t.delta <= 0) return;
  for (const leg of ['LF', 'RF', 'LH', 'RH']) {
    const at = horse.bones[`${leg}Hoof` as never] as unknown as {
      getWorldPosition: (v: Vector3) => Vector3;
    };
    const now = at.getWorldPosition(new Vector3());
    const was = hoofLast.get(leg);
    if (was) {
      const v = now.clone().sub(was).setY(0).length() / t.delta;
      slipWorst = Math.max(slipWorst, v);
      slipMin = Math.min(slipMin, v);
    }
    hoofLast.set(leg, now);
  }
});

window.ridingDo = (what) => {
  if (what === 'mount') mount.mount(horse);
  else if (what === 'walk') testUrge = 0.22;
  else if (what === 'dismount') mount.dismount();
  else if (what === 'climb')
    climb.start({ bottom: ladder.bottom, top: ladder.top, rungSpacing: ladder.rungSpacing });
  else if (what === 'gallop') testUrge = 1;
  else if (what === 'stop') testUrge = 0;
  else if (what === 'resetSlip') { slipWorst = 0; slipMin = Infinity; }
  else if (what === 'hold') holdSpeed = true;
  else if (what === 'sideview') sideView = true;
  else if (what === 'release') holdSpeed = false;
};
window.ridingLimbs = () => {
  // Hoof positions in the horse's OWN space. If the gait clip is driving
  // the legs these swing back and forth; if the clip is dead they are
  // frozen, and every hoof rides along with the body — which looks exactly
  // like the horse skating across the ground.
  const out: Record<string, number> = {};
  for (const leg of ['LF', 'RF', 'LH', 'RH']) {
    const bone = horse.bones[`${leg}Hoof` as never] as unknown as {
      getWorldPosition: (v: Vector3) => Vector3;
    };
    const world = bone.getWorldPosition(new Vector3());
    out[leg] = +horse.object.worldToLocal(world).z.toFixed(3);
  }
  return out;
};
window.ridingSkate = () => ({
  // The slowest hoof over the sample window is the planted one. If the
  // horse is walking properly that number is near zero; if it is skating,
  // every hoof moves at the horse's own speed.
  plantedSlip: +slipMin.toFixed(3),
  fastestHoof: +slipWorst.toFixed(2),
  horseSpeed: +ride.speed.toFixed(2),
});
window.ridingDebug = () => {
  const gl = game.renderer.getContext();
  const riderWorld = rig.object.getWorldPosition(new Vector3());
  return {
    glError: gl.getError(),
    gait: gaits.gait,
    speed: +ride.speed.toFixed(2),
    mountPhase: mount.phase,
    seat: mount.seat,
    climbState: climb.climbing ? 'climbing' : 'off',
    climbProgress: +climb.progress.toFixed(2),
    riderY: +riderWorld.y.toFixed(2),
    // When seated the rider's HIPS must be on the saddle. (Their root is
    // between their feet, which hang well below it — that is the point.)
    seatGap: mount.phase === 'seated'
      ? +rig.bones.Hips.getWorldPosition(new Vector3())
          .distanceTo(horse.saddle.getWorldPosition(new Vector3()))
          .toFixed(3)
      : null,
    footDrop: mount.phase === 'seated'
      ? +(horse.saddle.getWorldPosition(new Vector3()).y - riderWorld.y).toFixed(2)
      : null,
    drawCalls: game.renderer.info.render.calls,
    mixerTime: +gaits.mixer.time.toFixed(2),
    actionWeight: +gaits.mixer.clipAction(gaits.clips.canter).getEffectiveWeight().toFixed(2),
    actionTime: +gaits.mixer.clipAction(gaits.clips.canter).time.toFixed(2),
    actionRunning: gaits.mixer.clipAction(gaits.clips.canter).isRunning(),
    boneQ: +horse.bones.LFUpper.quaternion.x.toFixed(4),
  };
};
