import { describe, expect, it, vi } from 'vitest';
import { Group, Object3D, Vector3 } from 'three';
import { Cockpit, createHumanoid, createPoseClip } from '../src';

const build = (o: ConstructorParameters<typeof Cockpit>[1] = {}) => {
  const rig = createHumanoid({ seed: 9, height: 1.78 });
  return { rig, pilot: new Cockpit(rig, o) };
};

/**
 * An airframe stand-in with exactly GAMA's `FlightController` shape — if
 * this drives the controller the real one does, and neither library ever
 * learns about the other.
 */
const frame = (pitch: number, bank: number, speed = 140) => ({ pitch, bank, speed });

const fly = (
  pilot: Cockpit,
  air: { pitch: number; bank: number; speed: number },
  seconds: number,
  each?: (t: number) => void
): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    each?.(i / 60);
    pilot.update(1 / 60, air);
  }
};

describe('Cockpit', () => {
  it('reads load off the wings: level is 1g, sixty degrees of bank is 2g', () => {
    const { pilot } = build();
    fly(pilot, frame(0, 0), 2);
    expect(pilot.load).toBeCloseTo(1, 1);

    const turning = frame(0, Math.PI / 3); // 60°, the textbook 2g turn
    fly(pilot, turning, 3);
    expect(pilot.load).toBeGreaterThan(1.9);
    expect(pilot.load).toBeLessThan(2.1);

    // 80° of bank is not a bit more than 60 — it is nearly 6g.
    const hard = frame(0, 1.396);
    fly(pilot, hard, 3);
    expect(pilot.load).toBeGreaterThan(5);
  });

  it('a pull adds g, a push takes it away — and the body lags the wings', () => {
    const { pilot } = build();
    const air = { pitch: 0, bank: 0, speed: 150 };
    fly(pilot, air, 1);
    const level = pilot.load;
    // Rotate the nose up at 0.35 rad/s at 150 m/s: V·q/g ≈ 5.3g on top of 1.
    fly(pilot, air, 1.5, () => (air.pitch += 0.35 / 60));
    expect(pilot.load).toBeGreaterThan(level + 3);

    // Unloading is not instant, but it gets there.
    air.pitch = 0;
    fly(pilot, air, 2);
    expect(pilot.load).toBeCloseTo(1, 1);

    // Push over the top: the body goes light.
    fly(pilot, air, 1, () => (air.pitch -= 0.3 / 60));
    expect(pilot.load).toBeLessThan(0);
  });

  it('the body wears it: head sags and the spine compresses under load', () => {
    const easy = build();
    const hard = build();
    const restHips = easy.rig.bones.Hips.position.y;

    fly(easy.pilot, frame(0, 0), 2);
    fly(hard.pilot, frame(0, 1.35), 2);

    // Chin down — and it is the whole neck-and-head chain that does it, not
    // one bone doing an impression of it.
    const chin = (c: typeof easy) =>
      c.rig.bones.Head.rotation.x + c.rig.bones.Neck.rotation.x;
    expect(chin(hard)).toBeGreaterThan(chin(easy) + 0.25);
    expect(hard.rig.bones.Chest.rotation.x).toBeGreaterThan(easy.rig.bones.Chest.rotation.x);
    expect(hard.rig.bones.Hips.position.y).toBeLessThan(restHips); // into the seat

    // And at zero g the body comes UP off the cushion, the other way.
    const light = build();
    const air = { pitch: 0, bank: 0, speed: 150 };
    fly(light.pilot, air, 1.5, () => (air.pitch -= 0.28 / 60));
    expect(light.rig.bones.Hips.position.y).toBeGreaterThan(restHips);
  });

  it('contributes a term and gives it back — no compounding with no clip playing', () => {
    // The failure this guards is silent while a mixer is rewriting the
    // bones every frame, and spectacular the moment one is not.
    const { rig, pilot } = build();
    const rest = rig.bones.Head.quaternion.clone();
    fly(pilot, frame(0, 1.2), 8);
    const wound = rig.bones.Head.quaternion.angleTo(rest);
    expect(wound).toBeLessThan(1);

    pilot.release();
    expect(rig.bones.Head.quaternion.angleTo(rest)).toBeCloseTo(0, 5);
    expect(rig.bones.Hips.position.y).toBeCloseTo(
      createHumanoid({ seed: 9, height: 1.78 }).bones.Hips.position.y,
      5
    );
  });

  it('the eyes lead the aeroplane, in the aircraft frame and not the world', () => {
    const { rig, pilot } = build();
    const jet = new Group();
    jet.add(new Object3D());
    pilot.seat(jet, { y: 1.4, z: 2 });
    expect(rig.object.parent).toBe(jet);

    // The bandit is out in the WORLD, not bolted to this jet — otherwise it
    // rolls when the jet rolls and the frame below never changes.
    const bandit = new Object3D();
    bandit.position.set(-60, 0, 40); // off the left side
    pilot.watch(bandit);
    fly(pilot, frame(0, 0), 2);
    expect(pilot.gaze.yaw).toBeLessThan(-0.4);

    // Roll the aircraft inverted. The pilot goes with it, so the same
    // bandit is now off the OTHER shoulder as far as the body is concerned
    // — which is the difference between a gaze in the aircraft's frame and
    // a gaze in the world's.
    jet.rotation.z = Math.PI;
    jet.updateMatrixWorld(true);
    fly(pilot, frame(0, 0), 2);
    expect(pilot.gaze.yaw).toBeGreaterThan(0.4);

    pilot.eject();
    expect(rig.object.parent).not.toBe(jet);
  });

  it('g takes the neck away: the same target, less head, and none at the limit', () => {
    const target = new Vector3(-40, 0, 30);
    const easy = build({ gLimit: 7 });
    const hard = build({ gLimit: 7 });
    easy.pilot.watch(target);
    hard.pilot.watch(target);
    fly(easy.pilot, frame(0, 0), 2);
    fly(hard.pilot, frame(0, 1.42), 2); // ~6.5g

    expect(Math.abs(easy.pilot.gaze.yaw)).toBeGreaterThan(0.5);
    expect(Math.abs(hard.pilot.gaze.yaw)).toBeLessThan(Math.abs(easy.pilot.gaze.yaw) * 0.5);
  });

  it('check six buys yaw past the normal limit, and cannot be held', () => {
    const { pilot } = build({ gazeYaw: 1.2 });
    fly(pilot, frame(0, 0), 0.5);
    pilot.checkSix(1.2, 'left');
    fly(pilot, frame(0, 0), 1);
    expect(pilot.cranked).toBe(true);
    expect(pilot.gaze.yaw).toBeGreaterThan(1.2); // past what a gaze allows

    fly(pilot, frame(0, 0), 2); // the moment passes
    expect(pilot.cranked).toBe(false);
    expect(Math.abs(pilot.gaze.yaw)).toBeLessThan(0.2);
  });

  it('sustained g greys the vision out, then G-LOC — and waking is slow', () => {
    const onGLOC = vi.fn();
    const onRecover = vi.fn();
    const { pilot } = build({ greyAt: 5, greyIn: 2, greyOut: 3, onGLOC, onRecover });

    fly(pilot, frame(0, 1.35), 1); // ~4.5g: uncomfortable, survivable
    expect(pilot.grey).toBeLessThan(0.35);
    expect(onGLOC).not.toHaveBeenCalled();

    fly(pilot, frame(0, 1.45), 9); // pulling and holding it
    expect(pilot.gloc).toBe(true);
    expect(onGLOC).toHaveBeenCalledTimes(1);

    // Wings level. Consciousness does NOT come back with the g.
    fly(pilot, frame(0, 0), 0.5);
    expect(pilot.gloc).toBe(true);
    expect(onRecover).not.toHaveBeenCalled();

    fly(pilot, frame(0, 0), 3);
    expect(pilot.gloc).toBe(false);
    expect(onRecover).toHaveBeenCalledTimes(1);
    expect(pilot.grey).toBeLessThan(0.35);
  });

  it('the pilot pose puts the hands in different places, and loops seamlessly', () => {
    const rig = createHumanoid({ seed: 3 });
    const clip = createPoseClip(rig, 'pilot');
    expect(clip.duration).toBeGreaterThan(0);

    // Put the pose on the body and look at where the hands actually ended
    // up — the only claim worth testing, and one no amount of staring at
    // quaternion components would settle.
    for (const t of clip.tracks) {
      const [bone, prop] = t.name.split('.');
      const target = rig.bones[bone as keyof typeof rig.bones];
      if (prop === 'quaternion') target.quaternion.fromArray(Array.from(t.values.slice(0, 4)));
      else if (prop === 'position') target.position.fromArray(Array.from(t.values.slice(0, 3)));
    }
    rig.object.updateMatrixWorld(true);
    const left = rig.bones.LeftHand.getWorldPosition(new Vector3());
    const right = rig.bones.RightHand.getWorldPosition(new Vector3());
    const hips = rig.bones.Hips.getWorldPosition(new Vector3());

    // Both hands are out in front — this is not a person sitting on a bench.
    expect(left.z).toBeGreaterThan(hips.z + 0.1);
    expect(right.z).toBeGreaterThan(hips.z + 0.1);
    // And they are NOT a mirrored pair: the stick hand is in on the
    // centreline, the throttle hand out on the quadrant.
    expect(Math.abs(right.x)).toBeLessThan(Math.abs(left.x) - 0.05);

    // Seamless: last keyframe equals the first, or the loop pops.
    for (const t of clip.tracks) {
      const n = t.getValueSize();
      const head = Array.from(t.values.slice(0, n));
      const tail = Array.from(t.values.slice(t.values.length - n));
      for (let i = 0; i < n; i++) expect(tail[i]).toBeCloseTo(head[i], 6);
    }
  });
});
