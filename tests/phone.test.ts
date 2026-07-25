import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { createHumanoid, Locomotion, PhoneUse, type PhonePose } from '../src';

/** A stand-in for SCENA's phone: the handshake is one field. */
function handset(): { object: Object3D } {
  return { object: new Object3D() };
}

function setup(options: ConstructorParameters<typeof PhoneUse>[2] = {}) {
  const rig = createHumanoid({ seed: 5 });
  const loco = new Locomotion(rig);
  const phone = new PhoneUse(rig, loco, options);
  const item = handset();
  phone.hold(item);
  return { rig, loco, phone, item };
}

/**
 * Advance through the REAL path — Locomotion drives the mixer, PhoneUse only
 * asks for overlays. Driving a bare AnimationMixer here would test clips that
 * the controller might never actually be feeding any weight, which is exactly
 * how a whole animation system once shipped inert.
 */
function run(loco: Locomotion, phone: PhoneUse, seconds: number, velocity: Vector3 | number = 0): void {
  const dt = 1 / 60;
  for (let i = 0; i < seconds / dt; i++) {
    loco.update(dt, velocity as never);
    phone.update(dt);
  }
}

const world = (o: Object3D): Vector3 => o.getWorldPosition(new Vector3());
const forward = (o: Object3D): Vector3 => new Vector3(0, 0, 1).transformDirection(o.matrixWorld);

describe('holding a phone', () => {
  it('starts pocketed, near the hip', () => {
    const { rig, phone, item } = setup();
    rig.object.updateWorldMatrix(true, true);
    expect(phone.stowed).toBe(true);
    expect(phone.pose).toBeNull();
    const gap = world(item.object).distanceTo(world(rig.bones.Hips));
    expect(gap).toBeLessThan(0.3);
  });

  it('brings it to the hand when used, and back to the pocket after', () => {
    const { rig, loco, phone, item } = setup();
    phone.use('scroll');
    run(loco, phone, 0.6);
    rig.object.updateWorldMatrix(true, true);
    expect(world(item.object).distanceTo(world(rig.bones.RightHand))).toBeLessThan(0.2);

    phone.stow();
    rig.object.updateWorldMatrix(true, true);
    expect(phone.stowed).toBe(true);
    expect(world(item.object).distanceTo(world(rig.bones.Hips))).toBeLessThan(0.3);
  });

  it('honours a left-handed hold', () => {
    const rig = createHumanoid({ seed: 5 });
    const loco = new Locomotion(rig);
    const phone = new PhoneUse(rig, loco, { hand: 'Left' });
    const item = handset();
    phone.hold(item);
    phone.use('scroll');
    run(loco, phone, 0.6);
    rig.object.updateWorldMatrix(true, true);
    expect(world(item.object).distanceTo(world(rig.bones.LeftHand))).toBeLessThan(0.2);
    expect(world(item.object).distanceTo(world(rig.bones.RightHand))).toBeGreaterThan(0.25);
  });

  it('gives the handset back on release', () => {
    const { loco, phone, item } = setup();
    phone.use('scroll');
    run(loco, phone, 0.4);
    const returned = phone.release();
    expect(returned).toBe(item.object);
    expect(phone.stowed).toBe(true);
    expect(phone.release()).toBeNull();
  });
});

describe('the poses read', () => {
  // The failure this guards against: holding the phone perfectly correctly
  // somewhere the character is not looking. Everything else can be right and
  // the shot still shows someone staring past their own hand.
  it.each(['scroll', 'type', 'show'] as PhonePose[])(
    'puts the handset where the eyes are pointed (%s)',
    (pose) => {
      const { rig, loco, phone, item } = setup();
      phone.use(pose);
      run(loco, phone, 1.2);
      rig.object.updateWorldMatrix(true, true);
      const head = world(rig.bones.Head);
      const toPhone = world(item.object).sub(head).normalize();
      expect(forward(rig.bones.Head).angleTo(toPhone)).toBeLessThan(0.75);
    }
  );

  it('drops the head for the phone lean', () => {
    const { rig, loco, phone } = setup();
    rig.object.updateWorldMatrix(true, true);
    const level = forward(rig.bones.Head).y;
    phone.use('scroll');
    run(loco, phone, 1.2);
    rig.object.updateWorldMatrix(true, true);
    // Looking down: the head's forward vector tips below where it started.
    expect(forward(rig.bones.Head).y).toBeLessThan(level - 0.4);
  });

  it('holds a call at the ear, not at the chest', () => {
    const { rig, loco, phone, item } = setup();
    phone.use('call');
    run(loco, phone, 1.2);
    rig.object.updateWorldMatrix(true, true);
    const toHead = world(item.object).distanceTo(world(rig.bones.Head));
    // Measured from the Head BONE (top of the neck), not from the ear, and
    // the arm chain will not fold tighter than this.
    expect(toHead).toBeLessThan(0.34);

    phone.use('scroll');
    run(loco, phone, 1.2);
    rig.object.updateWorldMatrix(true, true);
    // ...and scrolling holds it a good deal further from the head than that.
    expect(world(item.object).distanceTo(world(rig.bones.Head))).toBeGreaterThan(toHead + 0.1);
  });

  it('extends the arms for a photo', () => {
    const { rig, loco, phone, item } = setup();
    phone.use('scroll');
    run(loco, phone, 1.2);
    rig.object.updateWorldMatrix(true, true);
    const close = world(item.object).distanceTo(world(rig.bones.Chest));

    phone.use('photo');
    run(loco, phone, 1.4);
    rig.object.updateWorldMatrix(true, true);
    expect(world(item.object).distanceTo(world(rig.bones.Chest))).toBeGreaterThan(close + 0.1);
  });

  it('turns the screen outward only when showing somebody', () => {
    const facing = (pose: PhonePose): number => {
      const { rig, loco, phone, item } = setup();
      phone.use(pose);
      run(loco, phone, 1.2);
      rig.object.updateWorldMatrix(true, true);
      const screen = new Vector3(0, 0, 1).transformDirection(item.object.matrixWorld);
      const toUser = world(rig.bones.Head).sub(world(item.object)).normalize();
      return screen.dot(toUser); // +1 = facing its owner, -1 = facing away
    };
    expect(facing('scroll')).toBeGreaterThan(0.3);
    expect(facing('show')).toBeLessThan(-0.2);
  });

  it('moves — a held pose is not a freeze frame', () => {
    const { rig, loco, phone } = setup();
    phone.use('scroll');
    run(loco, phone, 0.5);
    const samples: number[] = [];
    for (let i = 0; i < 90; i++) {
      run(loco, phone, 1 / 60);
      rig.object.updateWorldMatrix(true, true);
      samples.push(world(rig.bones.RightHand).x);
    }
    // The thumb flick has to reach the wrist, or the pose is a mannequin.
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.002);
  });
});

describe('walking while texting', () => {
  it('slows the walk, and stops it dead for a photo', () => {
    const { phone } = setup();
    expect(phone.walkScale).toBe(1);
    phone.use('scroll');
    expect(phone.walkScale).toBeLessThan(0.9);
    phone.use('type');
    expect(phone.walkScale).toBeLessThan(0.75);
    phone.use('photo');
    expect(phone.walkScale).toBe(0); // nobody walks and frames a shot
    phone.stow();
    expect(phone.walkScale).toBe(1);
  });

  it('keeps the legs walking underneath', () => {
    // The pose is an UPPER-BODY mask. If it were a full-body clip the
    // character would glide along in a texting statue — which is precisely
    // the class of bug that shipped once before, passing every test that
    // never looked at the legs.
    const { rig, loco, phone } = setup();
    phone.use('scroll');
    const velocity = new Vector3(0, 0, 1.6);
    run(loco, phone, 0.5, velocity);
    const feet: number[] = [];
    for (let i = 0; i < 120; i++) {
      run(loco, phone, 1 / 60, velocity);
      rig.object.updateWorldMatrix(true, true);
      feet.push(world(rig.bones.LeftFoot).z - world(rig.bones.RightFoot).z);
    }
    // The feet must trade places — a real stride, not a slide.
    expect(Math.max(...feet)).toBeGreaterThan(0.15);
    expect(Math.min(...feet)).toBeLessThan(-0.15);
  });

  it('glances up while walking, and not while standing', () => {
    const count = (velocity: Vector3 | number): number => {
      const rig = createHumanoid({ seed: 5 });
      const loco = new Locomotion(rig);
      const phone = new PhoneUse(rig, loco, { seed: 3, glanceEvery: 2 });
      phone.hold(handset());
      phone.use('scroll');
      let seen = 0;
      let was = false;
      for (let i = 0; i < 60 * 40; i++) {
        loco.update(1 / 60, velocity as never);
        phone.update(1 / 60);
        if (phone.glancing && !was) seen++;
        was = phone.glancing;
      }
      return seen;
    };
    expect(count(new Vector3(0, 0, 1.6))).toBeGreaterThan(3);
    expect(count(0)).toBe(0);
  });

  it('lifts the head during a glance and puts it back', () => {
    const { rig, loco, phone } = setup();
    phone.use('scroll');
    run(loco, phone, 1.2);
    rig.object.updateWorldMatrix(true, true);
    const down = forward(rig.bones.Head).y;

    phone.glance();
    run(loco, phone, 0.5);
    rig.object.updateWorldMatrix(true, true);
    const up = forward(rig.bones.Head).y;
    expect(up).toBeGreaterThan(down + 0.1);

    run(loco, phone, 1.6);
    rig.object.updateWorldMatrix(true, true);
    expect(forward(rig.bones.Head).y).toBeLessThan(up - 0.05);
  });

  it('is deterministic in its seed', () => {
    const trace = (seed: number): string => {
      const rig = createHumanoid({ seed: 5 });
      const loco = new Locomotion(rig);
      const phone = new PhoneUse(rig, loco, { seed, glanceEvery: 2 });
      phone.hold(handset());
      phone.use('scroll');
      const out: string[] = [];
      for (let i = 0; i < 60 * 30; i++) {
        loco.update(1 / 60, new Vector3(0, 0, 1.6) as never);
        phone.update(1 / 60);
        out.push(phone.glancing ? '1' : '0');
      }
      return out.join('');
    };
    expect(trace(7)).toBe(trace(7));
    expect(trace(7)).not.toBe(trace(8));
  });
});
