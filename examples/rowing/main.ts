import {
  AmbientLight, Clock, Color, DirectionalLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from 'three';
import { createDeckedShip, createOarBank, createOcean, PALETTES } from 'scena3d';
import { createHumanoid, OUTFITS, Rowing, type HumanoidRig } from 'anima3d';

/**
 * A crew, and one number between them.
 *
 * SCENA's oar bank works out the stroke and publishes `phaseAt(seat)`.
 * ANIMA's `Rowing` takes that same scalar and writes a body with it. Neither
 * library imports the other, and there is nothing else passed between them —
 * no clip, no event, no shared object. A shared clock is the only kind of
 * handshake that can say *together*, which is why the ragged boat looks
 * ragged rather than merely slow.
 */
const palette = PALETTES.meadow;
const params = new URLSearchParams(location.search);
const together = Number(params.get('together') ?? '1');

const scene = new Scene();
scene.background = new Color(0x9dbad2);
const camera = new PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 900);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
scene.add(new AmbientLight(0xffffff, 0.85));
const key = new DirectionalLight(0xffffff, 1.7);
key.position.set(-7, 13, 8);
scene.add(key);

const sea = createOcean({ amplitude: 0.2, wavelength: 26, size: 700, segments: 160 });
scene.add(sea.mesh);

const ship = createDeckedShip({ era: 'galley', seed: 6, palette });
ship.float((x, z) => sea.heightAt(x, z));
scene.add(ship.object);

const SEATS = 7;
const SEAT = 0.45;
const bank = createOarBank({
  kind: 'longship',
  seats: SEATS,
  beam: ship.beam * 1.05,
  // High enough that the thwart the bank derives from the handle lands on
  // her deck rather than through it.
  gunwale: 1.3,
  together,
  seed: 3,
  palette,
});
bank.setRate(22);
ship.object.add(bank.object);

interface Oarsman { rig: HumanoidRig; row: Rowing; seat: number; oar: number }
const crew: Oarsman[] = [];
bank.oars.forEach((oar, i) => {
  const rig = createHumanoid({ seed: 20 + i * 7, height: 1.72, palette: OUTFITS.villager });
  // A ROWER FACES AFT. He pulls toward the stern, so his own +z — the way
  // ANIMA builds a body — points back down the boat. Seat him facing the
  // bow and the whole crew rows the wrong way while every number agrees.
  rig.object.rotation.y = Math.PI;
  ship.object.add(rig.object);
  // SCENA's seat slot is the THWART — the surface he sits on. ANIMA builds
  // a body from the soles of its feet up, so the root goes a seat height
  // BELOW it. Drop the root straight onto the thwart instead and his hands
  // end up half a metre over the handle, with both libraries insisting they
  // agree.
  const thwart = oar.seatSlot.anchor;
  rig.object.position.set(thwart.position.x, thwart.position.y - SEAT, thwart.position.z);
  crew.push({
    rig,
    seat: oar.seat,
    oar: i,
    row: new Rowing(rig, {
      side: oar.side,
      style: 'fixed',
      drive: 0.4,
      seatHeight: SEAT,
      seed: i + 1,
    }),
  });
});

const clock = new Clock();
let elapsed = 0;
const step = (dt: number): void => {
  elapsed += dt;
  sea.update(dt);
  bank.update(dt);
  ship.update(dt, { speed: bank.way, turn: bank.yaw * 0.25 });
  for (const man of crew) {
    // THE HANDSHAKE. One scalar, and his whole body is a function of it.
    man.row.update(dt, bank.phaseAt(man.seat), bank.oars[man.oar].crabbing);
  }
  // Somebody catches a crab now and then, which is the most watchable thing
  // that happens in a boat.
  if (elapsed > 14 && Math.floor(elapsed) % 17 === 0 && bank.crabbing === 0) {
    bank.crab(2 + (Math.floor(elapsed / 17) % (SEATS - 2)));
  }
};

renderer.setAnimationLoop(() => {
  step(Math.min(0.05, clock.getDelta()));
  const at = ship.object.position;
  camera.position.set(at.x - 6.5, 3.9 + Math.sin(elapsed * 0.06) * 0.4, at.z + 9.5);
  camera.lookAt(at.x, 1.25, at.z - 0.5);
  renderer.render(scene, camera);
});

declare global {
  interface Window {
    rowStep: (dt: number) => void;
    rowLook: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => void;
    rowDebug: () => Record<string, unknown>;
    rowCrab: (seat: number) => void;
  }
}
window.rowStep = (dt: number) => step(dt);
window.rowCrab = (seat: number) => bank.crab(seat);
window.rowLook = (x, y, z, tx, ty, tz) => {
  renderer.setAnimationLoop(null);
  camera.position.set(x, y, z);
  camera.lookAt(tx, ty, tz);
  renderer.render(scene, camera);
};
window.rowDebug = () => {
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  ship.object.updateMatrixWorld(true);
  return {
    glError: gl.getError(),
    together: bank.together,
    rate: bank.rate,
    way: Number(bank.way.toFixed(3)),
    thrust: Number(bank.thrust.toFixed(3)),
    crabbing: Number(bank.crabbing.toFixed(2)),
    crew: crew.slice(0, 4).map((m) => ({
      seat: m.seat,
      phase: Number(m.row.phase.toFixed(3)),
      driving: m.row.driving,
      fouled: m.row.fouled,
      // The one number that says the handshake landed: how far his hands
      // are from the handle of the oar he is supposed to be pulling.
      offHandle: Number(
        m.rig.bones.LeftHand.getWorldPosition(new Vector3())
          .distanceTo(bank.oars[m.oar].grip.getWorldPosition(new Vector3()))
          .toFixed(3)
      ),
      hand: m.rig.bones.LeftHand.getWorldPosition(new Vector3()).toArray().map((n) => +n.toFixed(2)),
      handle: bank.oars[m.oar].grip.getWorldPosition(new Vector3()).toArray().map((n) => +n.toFixed(2)),
      root: m.rig.object.position.toArray().map((n) => +n.toFixed(2)),
      seatY: +bank.oars[m.oar].seatSlot.anchor.position.y.toFixed(2),
    })),
  };
};
