import { Mesh, PlaneGeometry, Vector3 } from 'three';
import {
  applyFog,
  createLightingRig,
  createPhone,
  createSky,
  createSurface,
  createTable,
  PALETTES,
} from 'scena3d';
import {
  createHumanoid,
  Locomotion,
  LookAt,
  Mannerisms,
  OUTFITS,
  PhoneUse,
} from 'anima3d';
import { Attention, broadcast, Game, TouchControls } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(120, 120), createSurface('floortile', { seed: 6 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const table = createTable({ palette, seed: 2 });
table.object.position.set(0, 0, -0.1);
scene.add(table.object);

// Six people round a table, each with their own temperament.
interface Person {
  rig: ReturnType<typeof createHumanoid>;
  loco: Locomotion;
  gaze: LookAt;
  idle: Mannerisms;
  attention: Attention;
  position: Vector3;
  turned: number;
}

const people: Person[] = [];
for (let i = 0; i < 6; i++) {
  // A row, not a ring. Seated in a circle everybody faces the middle, so an
  // alert at the centre is already in front of them (no turn to see) and an
  // alert outside it is behind half of them (no turn possible — LookAt fades
  // out rather than swivel a head 145 degrees, quite rightly). A shallow arc
  // all facing the same way is the arrangement where a head turn is visible.
  // Facing +z (toward the camera and the man off to the right); the seat
  // rotation below is a + PI, so a = PI puts them square to the front.
  const a = Math.PI;
  const at = new Vector3(-2.25 + i * 0.9, 0, -1.4 + (i % 2) * 0.25);
  const rig = createHumanoid({ seed: 40 + i * 7, palette: OUTFITS.villager });
  rig.object.position.copy(at);
  rig.object.rotation.y = a + Math.PI;
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  // Standing, deliberately. Seating them meant a stool per person and a slot
  // offset to reconcile, for a shot where the only thing that matters is
  // which heads turn and when.
  people.push({
    rig,
    loco,
    gaze: new LookAt(rig),
    idle: new Mannerisms(rig, loco, { context: 'seated', seed: 70 + i }),
    // Temperaments differ. The one at index 3 barely looks up at anything.
    attention: new Attention({
      seed: 11 + i * 5,
      sensitivity: i === 3 ? 0.28 : 0.6 + (i % 3) * 0.15,
      latency: 0.32 + (i % 4) * 0.12,
      fatigue: 0.4,
      recovery: 14,
    }),
    position: at,
    turned: 0,
  });
  // Standing gaze: the table in front of them. The glance overrides it and
  // then expires, so nothing has to remember to put it back.
  people[i].gaze.target = table.object.position;
  const p = people[i];
  p.attention.onNotice = (alert) => {
    if (alert.at) p.gaze.glance(alert.at, (alert.duration ?? 1.6) * 0.85);
    p.turned++;
  };
  // When it is over, back to the table — the gaze target was never cleared,
  // so the glance simply expires and the standing target takes back over.
}

// The phone that goes off, sitting on the table.
const handset = createPhone({ seed: 3, mode: 'standby', brightness: 1.2 });
handset.object.position.set(0, 0.78, 0);
handset.object.rotation.x = -Math.PI / 2;
scene.add(handset.object);
// The alert comes from the man standing off to one side, NOT from the middle
// of the table. Six people seated in a ring around a source are already
// facing it, so every head turn is a couple of degrees and the whole effect
// is invisible — the metrics said 6/6 looking and the picture showed nothing.
const phoneAt = new Vector3(2.4, 1.25, 2.6);

// Somebody standing off to the side, on their phone, who owns it.
const ownerRig = createHumanoid({ seed: 91, palette: OUTFITS.villager });
ownerRig.object.position.set(2.4, 0, 2.6);
ownerRig.object.rotation.y = Math.PI - 0.5;
scene.add(ownerRig.object);
const ownerLoco = new Locomotion(ownerRig);
const owner = new PhoneUse(ownerRig, ownerLoco, { seed: 2 });
const ownerPhone = createPhone({ seed: 12, mode: 'feed', scrollRate: 1.2 });
scene.add(ownerPhone.object);
owner.hold(ownerPhone);
owner.use('scroll');

let rings = 0;
let ringGlow = 0;
const hud = document.getElementById('hud')!;

new TouchControls(game.input, {
  buttons: [
    { label: 'Ring', code: 'Space', css: 'right:26px;bottom:40px' },
    { label: 'Buzz', code: 'KeyB', css: 'right:120px;bottom:40px' },
    { label: 'Reset', code: 'KeyR', css: 'right:214px;bottom:40px' },
  ],
});

function ring(kind: 'ring' | 'buzz'): void {
  rings++;
  ringGlow = 1;
  handset.screen.setMode(kind === 'ring' ? 'call' : 'home');
  ownerPhone.screen.setMode(kind === 'ring' ? 'call' : 'home');
  broadcast(
    {
      kind,
      urgency: kind === 'ring' ? 0.92 : 0.45,
      at: phoneAt,
      range: 9,
      duration: kind === 'ring' ? 2.2 : 1.3,
    },
    people
  );
}

game.onUpdate((t) => {
  const dt = t.delta;
  if (game.input.wasPressed('Space')) ring('ring');
  if (game.input.wasPressed('KeyB')) ring('buzz');
  if (game.input.wasPressed('KeyR')) location.reload();

  ringGlow = Math.max(0, ringGlow - dt * 0.5);
  if (ringGlow <= 0 && handset.screen.mode !== 'standby') handset.screen.setMode('standby');
  handset.screen.update(dt);
  ownerPhone.screen.update(dt);

  for (const p of people) {
    p.attention.update(dt);
    p.loco.update(dt, 0);
    p.idle.update(dt);
    p.gaze.update(dt);
  }
  ownerLoco.update(dt, 0);
  owner.update(dt);

  const a = t.elapsed * 0.1;
  game.camera.position.set(Math.sin(a) * 2.2 - 0.4, 2.7, 5.6 + Math.cos(a) * 0.8);
  game.camera.lookAt(0.4, 1.05, -0.2);

  const looking = people.filter((p) => p.gaze.glancing).length;
  hud.innerHTML =
    `<b>${rings}</b> alerts<br>${looking}/6 looking<br>` +
    `interest ${(people[0].attention.interestIn('ring') * 100) | 0}%`;
});

game.camera.position.set(-0.4, 2.7, 6.4);
game.start();

declare global {
  interface Window {
    attnDebug: () => Record<string, unknown>;
    attnRing: (kind?: string) => void;
  }
}
window.attnRing = (kind = 'ring') => ring(kind as 'ring' | 'buzz');
window.attnDebug = () => {
  const gl = game.renderer.getContext();
  for (const p of people) p.rig.object.updateWorldMatrix(true, true);
  return {
    glError: gl.getError(),
    drawCalls: game.renderer.info.render.calls,
    rings,
    looking: people.filter((p) => p.gaze.glancing).length,
    reacting: people.filter((p) => p.attention.reacting).length,
    turned: people.map((p) => p.turned),
    interest: +people[0].attention.interestIn('ring').toFixed(3),
    // How far each head has swung toward the phone. The payoff is that these
    // are not equal and do not arrive together.
    aim: people.map((p) => {
      const head = p.rig.bones.Head.getWorldPosition(new Vector3());
      const fwd = new Vector3(0, 0, 1).transformDirection(p.rig.bones.Head.matrixWorld);
      return +fwd.angleTo(phoneAt.clone().sub(head).normalize()).toFixed(3);
    }),
  };
};
