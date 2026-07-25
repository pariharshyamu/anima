import { AmbientLight, PointLight, Vector3 } from 'three';
import {
  createDeskSet,
  createFixture,
  createLaptop,
  createMonitor,
  createRoom,
  createScreenLight,
  createSeat,
  createTable,
  PALETTES,
} from 'scena3d';
import {
  createHumanoid,
  DeskWork,
  Interaction,
  Locomotion,
  LookAt,
  OUTFITS,
} from 'anima3d';
import { Attention, Automation, Device, Game, TouchControls } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;

const room = createRoom(
  ['#######', '#.....#', '#.....#', '#..S..#', '#.....#', '#######'],
  { palette, unit: 1.2, wallHeight: 2.6, floor: 'plank', ceiling: true, hearthLight: false, seed: 3 }
);
scene.add(room.group);
const ambient = new AmbientLight(0x2b3550, 0.09);
scene.add(ambient);

// The lamp the automation drives. Off to begin with.
const lamp = new PointLight(0xffe0b0, 0, 8, 1.8);
lamp.position.set(0, 2.3, 0.3);
scene.add(lamp);

// ---- the desk ----------------------------------------------------------

const desk = createTable({ palette, seed: 7 });
desk.object.position.set(0, 0, -1.9);
desk.object.scale.set(1.25, 1, 0.85);
scene.add(desk.object);

const monitor = createMonitor({ diagonal: 0.6, mode: 'chart', seed: 21, palette });
monitor.object.position.set(0.1, 0.74, -2.15);
scene.add(monitor.object);
const monitorGlow = createScreenLight(monitor.screen, { gain: 0.9 });
const workstation = new Device({ boot: 1.4, idle: 0 });
workstation.attach(monitor.screen);
workstation.turnOn(true);
workstation.show('chart');

const laptop = createLaptop({ diagonal: 0.33, mode: 'feed', scrollRate: 0.8, seed: 31 });
laptop.object.position.set(-0.62, 0.74, -1.95);
laptop.object.rotation.y = 0.5;
scene.add(laptop.object);

const set = createDeskSet({ seed: 5 });
set.object.position.set(0.05, 0.74, -1.62);
scene.add(set.object);

// ---- the fixtures ------------------------------------------------------

const sensor = createFixture({ style: 'sensor', seed: 2, palette });
sensor.object.position.set(-2.4, 2.3, -3.0);
sensor.object.rotation.y = 0.7;
scene.add(sensor.object);

const bell = createFixture({ style: 'doorbell', seed: 4, palette });
// Forward and to the right. Put square on the side wall it sits at 90\u00b0,
// which is inside LookAt's behind-the-shoulder fade — the glance fires and
// the head does not move.
bell.object.position.set(1.9, 1.3, -2.9);
scene.add(bell.object);

const stat = createFixture({ style: 'thermostat', seed: 6, palette });
stat.object.position.set(-2.38, 1.42, 0.4);
stat.object.rotation.y = Math.PI / 2;
scene.add(stat.object);

// ---- the wiring --------------------------------------------------------

const home = new Automation({ seed: 8, delay: 0.45 });
// A sensor that drops the moment you stop moving turns the lights off on
// somebody sitting still at a desk. It holds.
home.hold('motion', 14);
home.link('motion', 'lamp');
home.link('motion', 'statLed', { delay: 0.9 });
home.on('lamp', (v) => sensor.setIndicator(v > 0.5 ? 0x5cff9a : 0x1e2a24, v > 0.5 ? 2 : 0.4));
home.on('statLed', (v) => stat.setIndicator(v > 0.5 ? 0xff9a4d : 0x2a2420, v > 0.5 ? 1.6 : 0.3));
bell.setIndicator(0x2a3038, 0.4);

// ---- the worker --------------------------------------------------------

const chair = createSeat({ style: 'chair', palette, seed: 9 });
chair.object.position.set(0.05, 0, -1.05);
// Turned to face the desk. A SCENA seat slot faces its own +z, so a chair
// dropped in unrotated seats somebody with their back to the monitor —
// which every hand-position check passes quite happily.
chair.object.rotation.y = Math.PI;
scene.add(chair.object);

const rig = createHumanoid({ seed: 44, palette: OUTFITS.villager });
scene.add(rig.object);
const loco = new Locomotion(rig);
const gaze = new LookAt(rig);
const sitting = new Interaction(rig, loco);
const work = new DeskWork(rig, loco, { seed: 12, rate: 6 });
const attention = new Attention({ seed: 3, sensitivity: 0.85, latency: 0.4 });

const slot = chair.slots?.[0];
if (slot) {
  chair.object.updateWorldMatrix(true, true);
  const slotAt = slot.anchor.getWorldPosition(new Vector3());
  chair.object.position.add(new Vector3(0.05, 0, -1.05).sub(slotAt).setY(0));
  sitting.use(slot, { approach: false });
}
work.do('type');
gaze.target = monitor.screen.surface.getWorldPosition(new Vector3());

// A doorbell interrupts. The glance and the return are free — the attention
// system decides whether and when, the gaze does the turning.
const bellAt = new Vector3(1.9, 1.3, -2.9);
attention.onNotice = (alert) => {
  if (alert.at) gaze.glance(alert.at, 1.6);
};

let rings = 0;
let closeUp = false;
new TouchControls(game.input, {
  buttons: [
    { label: 'Bell', code: 'Space', css: 'right:26px;bottom:40px' },
    { label: 'Motion', code: 'KeyM', css: 'right:120px;bottom:40px' },
    { label: 'Cam', code: 'KeyC', css: 'right:230px;bottom:40px' },
  ],
});
const hud = document.getElementById('hud')!;

function ring(): void {
  rings++;
  bell.setIndicator(0xffd36b, 2.4);
  attention.notice({ kind: 'ring', urgency: 0.92, at: bellAt, duration: 1.9 });
}

game.onUpdate((t) => {
  const dt = t.delta;
  if (game.input.wasPressed('Space')) ring();
  if (game.input.wasPressed('KeyM')) home.set('motion', true);
  if (game.input.wasPressed('KeyC')) closeUp = !closeUp;

  home.update(dt);
  attention.update(dt);
  workstation.update(dt);
  monitor.screen.update(dt);
  laptop.screen.update(dt);
  stat.screen?.update(dt);
  monitorGlow.update();

  lamp.intensity += (home.get('lamp') * 5.5 - lamp.intensity) * Math.min(1, dt * 3);
  if (!attention.engaged && rings > 0) bell.setIndicator(0x2a3038, 0.4);

  loco.update(dt, 0);
  sitting.update(dt);
  work.update(dt);
  gaze.update(dt);

  const head = rig.bones.Head.getWorldPosition(new Vector3());
  if (closeUp) {
    game.camera.position.set(head.x + 0.35, head.y + 0.1, head.z + 1.15);
    game.camera.lookAt(head.x, head.y - 0.05, head.z - 0.4);
  } else {
    game.camera.position.set(2.0, 1.9, 1.7);
    game.camera.lookAt(-0.1, 1.05, -1.7);
  }

  hud.innerHTML =
    `<b>${work.task ?? 'idle'}</b><br>` +
    `lamp ${(home.get('lamp') * 100) | 0}%` +
    (home.holdLeft('motion') > 0 ? ` · ${home.holdLeft('motion').toFixed(0)}s` : '') +
    (home.pending ? `<br>${home.pending} in flight` : '') +
    (gaze.glancing ? '<br>looked up' : '');
});

game.camera.position.set(2.0, 1.9, 1.7);
game.start();

declare global {
  interface Window {
    officeDebug: () => Record<string, unknown>;
    officeDo: (what: string) => void;
  }
}
window.officeDo = (what) => {
  if (what === 'bell') ring();
  else if (what === 'motion') home.set('motion', true);
  else if (what === 'closeup') closeUp = true;
  else if (what === 'wide') closeUp = false;
};
window.officeDebug = () => {
  const gl = game.renderer.getContext();
  rig.object.updateWorldMatrix(true, true);
  const head = rig.bones.Head.getWorldPosition(new Vector3());
  const fwd = new Vector3(0, 0, 1).transformDirection(rig.bones.Head.matrixWorld);
  const hands = [rig.bones.LeftHand, rig.bones.RightHand].map((b) =>
    b.getWorldPosition(new Vector3())
  );
  return {
    glError: gl.getError(),
    drawCalls: game.renderer.info.render.calls,
    task: work.task,
    lamp: +home.get('lamp').toFixed(2),
    lampIntensity: +lamp.intensity.toFixed(2),
    holdLeft: +home.holdLeft('motion').toFixed(1),
    pending: home.pending,
    glancing: gaze.glancing,
    // Toward the monitor normally; toward the doorbell when it goes.
    aimAtBell: +fwd.angleTo(bellAt.clone().sub(head).normalize()).toFixed(3),
    // Are the hands actually ON the desk?
    handY: hands.map((h) => +h.y.toFixed(3)),
    handZ: hands.map((h) => +h.z.toFixed(3)),
    seated: rig.bones.Hips.getWorldPosition(new Vector3()).y < 0.8,
  };
};
