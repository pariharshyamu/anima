import { Mesh, PlaneGeometry, Vector3 } from 'three';
import {
  applyFog,
  createLamp,
  createLightingRig,
  createPhone,
  createSky,
  createSurface,
  createTree,
  PALETTES,
} from 'scena3d';
import { createHumanoid, FootIK, Locomotion, OUTFITS, PhoneUse, type PhonePose } from 'anima3d';
import { Game, TouchControls } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(200, 200), createSurface('concrete', { seed: 3 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Something to walk past, so the slower texting pace reads against the world.
for (const [x, z, s] of [[-5, -6, 1], [6, -9, 2], [-7, 7, 3], [8, 6, 4]] as const) {
  const tree = createTree({ species: 'oak', seed: 10 + s, height: 5.5, palette });
  tree.object.position.set(x, 0, z);
  scene.add(tree.object);
}
for (const [x, z] of [[-3.2, 0], [3.2, -4]] as const) {
  const lamp = createLamp({ seed: 20 + x, palette });
  lamp.object.position.set(x, 0, z);
  scene.add(lamp.object);
}

const rig = createHumanoid({ seed: 31, palette: OUTFITS.villager });
scene.add(rig.object);
const loco = new Locomotion(rig);
const ik = new FootIK(rig, { ground: () => 0 });
const phone = new PhoneUse(rig, loco, { hand: 'Right', seed: 4, glanceEvery: 3.4 });

// A phone is a Carryable with a Screen — the same prop the tablet and the
// television are, at 6 inches.
const handset = createPhone({ seed: 7, mode: 'feed', scrollRate: 1.1 });
scene.add(handset.object);
phone.hold(handset);
phone.use('scroll');

const POSES: PhonePose[] = ['scroll', 'type', 'call', 'photo', 'selfie', 'show'];
let closeUp = false;
let walking = false;
const hud = document.getElementById('hud')!;
const velocity = new Vector3();

new TouchControls(game.input, {
  buttons: [
    { label: 'Walk', code: 'KeyW', css: 'right:26px;bottom:40px' },
    { label: 'Cam', code: 'KeyC', css: 'right:120px;bottom:40px' },
  ],
});

game.onUpdate((t) => {
  const dt = t.delta;
  for (let i = 0; i < POSES.length; i++) {
    if (game.input.wasPressed(`Digit${i + 1}`)) phone.use(POSES[i]);
  }
  if (game.input.wasPressed('Digit0')) phone.stow();
  if (game.input.wasPressed('KeyC')) closeUp = !closeUp;
  if (game.input.wasPressed('KeyW')) walking = !walking;

  // Walk a slow circle. The phone only scales the speed — the gait, the feet
  // and the arms below the mask carry on exactly as they would empty-handed.
  if (walking) {
    const a = t.elapsed * 0.28;
    velocity.set(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(1.5 * phone.walkScale);
    if (velocity.lengthSq() > 0.0001) {
      rig.object.position.addScaledVector(velocity, dt);
      rig.object.rotation.y = Math.atan2(velocity.x, velocity.z);
    }
  } else {
    velocity.set(0, 0, 0);
  }
  loco.update(dt, velocity);
  phone.update(dt);
  ik.update();

  const head = rig.bones.Head.getWorldPosition(new Vector3());
  const at = rig.object.getWorldPosition(new Vector3());
  if (closeUp) {
    const fwd = new Vector3(0, 0, 1).applyQuaternion(rig.object.quaternion);
    game.camera.position.set(head.x + fwd.x * 1.5 + 0.55, head.y + 0.05, head.z + fwd.z * 1.5 + 0.3);
    game.camera.lookAt(head.x, head.y - 0.08, head.z);
  } else {
    game.camera.position.lerp(new Vector3(at.x + 3.4, 2.3, at.z + 4.2), Math.min(1, dt * 2.5));
    game.camera.lookAt(at.x, 1.05, at.z);
  }

  hud.innerHTML =
    `<b>${phone.pose ?? 'pocketed'}</b><br>` +
    `${walking ? `${loco.speed.toFixed(1)} m/s · ×${phone.walkScale.toFixed(2)}` : 'standing'}` +
    (phone.glancing ? '<br><span style="opacity:.7">looked up</span>' : '');
});

game.camera.position.set(3.4, 2.3, 4.2);
game.start();

declare global {
  interface Window {
    phoneDebug: () => Record<string, unknown>;
    phoneDo: (what: string) => void;
  }
}
window.phoneDo = (what) => {
  if (what === 'walk') walking = true;
  else if (what === 'stand') walking = false;
  else if (what === 'closeup') closeUp = true;
  else if (what === 'wide') closeUp = false;
  else if (what === 'stow') phone.stow();
  else phone.use(what as PhonePose);
};
window.phoneDebug = () => {
  const gl = game.renderer.getContext();
  rig.object.updateWorldMatrix(true, true);
  const head = rig.bones.Head.getWorldPosition(new Vector3());
  const at = handset.object.getWorldPosition(new Vector3());
  const fwd = new Vector3(0, 0, 1).transformDirection(rig.bones.Head.matrixWorld);
  const screen = new Vector3(0, 0, 1).transformDirection(handset.screen.surface.matrixWorld);
  return {
    glError: gl.getError(),
    drawCalls: game.renderer.info.render.calls,
    pose: phone.pose,
    // Is the handset on her line of sight, and is the screen turned to her?
    gazeAngle: +fwd.angleTo(at.clone().sub(head).normalize()).toFixed(3),
    screenFacesUser: +screen.dot(head.clone().sub(at).normalize()).toFixed(3),
    headPitch: +fwd.y.toFixed(3),
    handGap: +at.distanceTo(rig.bones.RightHand.getWorldPosition(new Vector3())).toFixed(3),
    speed: +loco.speed.toFixed(2),
    walkScale: phone.walkScale,
    glancing: phone.glancing,
    footSplit: +(rig.bones.LeftFoot.getWorldPosition(new Vector3()).distanceTo(
      rig.bones.RightFoot.getWorldPosition(new Vector3()))).toFixed(3),
  };
};
