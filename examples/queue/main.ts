import { Mesh, PlaneGeometry, Vector3 } from 'three';
import {
  applyFog,
  createLightingRig,
  createPhone,
  createSky,
  createSurface,
  createTerminal,
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
import { Game, Queue, TouchControls } from 'gama3d';

const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;
scene.add(createSky({ palette }).mesh, createLightingRig('day').group);
applyFog(scene, 'haze', palette);
const ground = new Mesh(new PlaneGeometry(120, 120), createSurface('concrete', { seed: 9 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const atm = createTerminal({ style: 'atm', seed: 4, palette });
atm.object.position.set(0, 0, -1.2);
scene.add(atm.object);
const vending = createTerminal({ style: 'vending', seed: 8, palette });
vending.object.position.set(3.4, 0, -1.2);
scene.add(vending.object);

// SCENA says where the line is; GAMA says who is where along it.
const queue = new Queue<Customer>({
  spacing: atm.spacing,
  service: 16,
  patience: 5,
  giveUpAfter: 34,
  reaction: 0.55,
  seed: 5,
});

interface Customer {
  rig: ReturnType<typeof createHumanoid>;
  loco: Locomotion;
  gaze: LookAt;
  idle: Mannerisms;
  phone: PhoneUse;
  at: Vector3;
  /** How long until they get bored enough to take their phone out. */
  bored: number;
  leaving: Vector3 | null;
}

const customers: Customer[] = [];
let made = 0;
const velocity = new Vector3();
const want = new Vector3();

function arrive(): void {
  const i = made++;
  const rig = createHumanoid({ seed: 120 + i * 13, palette: OUTFITS.villager });
  // They walk in from off to the side, not from thin air.
  rig.object.position.set(4.5 + (i % 3) * 0.6, 0, 5.5 + (i % 4) * 0.5);
  scene.add(rig.object);
  const loco = new Locomotion(rig);
  const customer: Customer = {
    rig,
    loco,
    gaze: new LookAt(rig),
    idle: new Mannerisms(rig, loco, { context: 'standing', seed: 200 + i }),
    phone: new PhoneUse(rig, loco, { seed: 300 + i, glanceEvery: 5 }),
    at: rig.object.position,
    bored: 4 + (i % 5) * 2.5,
    leaving: null,
  };
  const handset = createPhone({ seed: 400 + i, mode: 'feed', scrollRate: 1.1 });
  scene.add(handset.object);
  customer.phone.hold(handset);
  customers.push(customer);

  // ...and they may take one look at the line and keep walking.
  if (queue.join(customer) === null) customer.leaving = new Vector3(-7, 0, 7);
}

queue.onServed = (c) => {
  c.leaving = new Vector3(-8, 0, 6.5);
  c.phone.stow();
};
queue.onGiveUp = (c) => {
  c.leaving = new Vector3(-8, 0, 8);
  c.phone.stow();
};
queue.onBalk = (c) => {
  c.leaving = new Vector3(-7, 0, 7);
};

for (let i = 0; i < 4; i++) arrive();

const hud = document.getElementById('hud')!;
new TouchControls(game.input, {
  buttons: [
    { label: 'Arrive', code: 'Space', css: 'right:26px;bottom:40px' },
    { label: 'Serve', code: 'KeyS', css: 'right:130px;bottom:40px' },
  ],
});

game.onUpdate((t) => {
  const dt = t.delta;
  if (game.input.wasPressed('Space')) arrive();
  if (game.input.wasPressed('KeyS')) queue.serve();
  if (game.input.wasPressed('KeyR')) location.reload();

  queue.update(dt);
  atm.screen.update(dt);
  vending.screen.update(dt);

  for (const c of customers) {
    const place = queue.placeOf(c);
    if (c.leaving) {
      want.copy(c.leaving);
    } else {
      // The queue hands back a DISTANCE; the terminal turns it into a place
      // to stand. Neither library knows about the other.
      want.copy(atm.line.localToWorld(new Vector3(0, 0, -queue.distanceOf(c))));
    }

    velocity.copy(want).sub(c.at).setY(0);
    const gap = velocity.length();
    if (gap > 0.08) {
      velocity.normalize().multiplyScalar(Math.min(1.5, gap * 2.2) * c.phone.walkScale);
      c.at.addScaledVector(velocity, dt);
      c.rig.object.rotation.y = Math.atan2(velocity.x, velocity.z);
    } else {
      velocity.set(0, 0, 0);
      // Settled in line: face the machine, like everybody else waiting.
      if (!c.leaving) c.rig.object.rotation.y = Math.PI;
    }

    // Waiting is boring. This is the whole composition argument: nothing here
    // is new — mannerisms from one track, the phone from another.
    if (!c.leaving && place > 0) {
      c.bored -= dt;
      if (c.bored <= 0 && c.phone.stowed) c.phone.use('scroll');
    } else if (place === 0 && !c.phone.stowed) {
      c.phone.stow(); // you put it away when you get to the front
    }

    c.gaze.target = place === 0 ? atm.screen.surface.getWorldPosition(new Vector3()) : null;
    c.loco.update(dt, velocity);
    c.phone.update(dt);
    c.idle.update(dt);
    c.gaze.update(dt);
  }

  const a = t.elapsed * 0.08;
  game.camera.position.set(Math.sin(a) * 3.2 + 3.4, 3.4, 6.6 + Math.cos(a) * 0.9);
  game.camera.lookAt(0.6, 1.0, 0.6);

  hud.innerHTML =
    `<b>${queue.length}</b> in line<br>` +
    `served ${(queue.progress * 100) | 0}%<br>` +
    `${customers.filter((c) => c.leaving).length} leaving`;
});

game.camera.position.set(3.4, 3.4, 6.6);
game.start();

declare global {
  interface Window {
    queueDebug: () => Record<string, unknown>;
    queueDo: (what: string) => void;
  }
}
window.queueDo = (what) => {
  if (what === 'arrive') arrive();
  else if (what === 'serve') queue.serve();
};
window.queueDebug = () => {
  const gl = game.renderer.getContext();
  const inLine = customers.filter((c) => queue.placeOf(c) >= 0);
  return {
    glError: gl.getError(),
    drawCalls: game.renderer.info.render.calls,
    length: queue.length,
    made,
    leaving: customers.filter((c) => c.leaving).length,
    onPhone: customers.filter((c) => !c.phone.stowed).length,
    // Distances back along the line, front first — the shape of the queue.
    distances: inLine.map((c) => +queue.distanceOf(c).toFixed(3)),
    places: inLine.map((c) => queue.placeOf(c)),
    // Where they actually ARE, so a queue that exists only in the data model
    // and not on the pavement cannot pass.
    spread: inLine.map((c) => +c.at.distanceTo(atm.line.getWorldPosition(new Vector3())).toFixed(2)),
  };
};
