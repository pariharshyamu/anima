import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  QuaternionKeyframeTrack,
  Scene,
  Vector3,
} from 'three';
import { createHumanoid, Carry, createCarryClip, Locomotion, type CarryStyle } from '../src';

const rig = () => createHumanoid({ seed: 8 });

describe('carry clips', () => {
  it('builds every style as a loop-seamless arm overlay (legs keep walking)', () => {
    const r = rig();
    for (const style of ['crate', 'tray', 'shoulder', 'side'] as CarryStyle[]) {
      const clip = createCarryClip(r, style);
      const bones = new Set(clip.tracks.map((t) => t.name.split('.')[0]));
      expect(bones.has('Hips')).toBe(false); // legs/hips untouched — the gait carries them
      expect(bones.has('LeftUpLeg')).toBe(false);
      expect(bones.has('RightArm')).toBe(true);
      for (const track of clip.tracks) {
        if (!(track instanceof QuaternionKeyframeTrack)) continue;
        const v = track.values;
        for (let c = 0; c < 4; c++) expect(v[c]).toBeCloseTo(v[v.length - 4 + c], 5);
      }
    }
  });

  it('side carry frees the left arm to swing; two-handed styles lock both', () => {
    const r = rig();
    const armsOf = (style: CarryStyle) =>
      new Set(createCarryClip(r, style).tracks.map((t) => t.name.split('.')[0]));
    expect(armsOf('side').has('LeftArm')).toBe(false); // left arm still gaits
    expect(armsOf('side').has('RightArm')).toBe(true);
    expect(armsOf('crate').has('LeftArm')).toBe(true); // both hands on the box
    expect(armsOf('crate').has('RightArm')).toBe(true);
  });
});

describe('Carry', () => {
  const setup = () => {
    const r = rig();
    const scene = new Scene();
    scene.add(r.object);
    const loco = new Locomotion(r);
    return { r, scene, loco, carry: new Carry(r, loco) };
  };

  it('picks up an object into the hands and reports holding', () => {
    const { r, carry } = setup();
    const box = new Object3D();
    const crate = { object: box, carry: 'crate' as const };
    expect(carry.holding).toBeNull();
    carry.pickUp(crate);
    expect(carry.holding).toBe(crate);
    // The object now rides a carry-anchor parented under a rig bone (the Chest).
    let node: Object3D | null = box.parent;
    const chain: string[] = [];
    while (node) {
      chain.push(node.name);
      node = node.parent;
    }
    expect(box.parent?.name).toBe('carry-anchor');
    expect(chain).toContain(r.bones.Chest.name); // anchored on the chest
  });

  it('carries the object with the body — it moves when the rig moves', () => {
    const { r, scene, carry } = setup();
    const box = new Object3D();
    carry.pickUp({ object: box, carry: 'crate' });
    r.object.position.set(5, 0, -3);
    scene.updateMatrixWorld(true);
    const held = box.getWorldPosition(new Vector3());
    expect(held.x).toBeGreaterThan(3); // rode along with the character
    expect(held.y).toBeGreaterThan(0.5); // up at chest height, not on the floor
  });

  it('puts the object down into the world, optionally at a spot', () => {
    const { scene, carry } = setup();
    const box = new Object3D();
    carry.pickUp({ object: box });
    const dropped = carry.putDown({ at: new Vector3(2, 0, 7) });
    expect(dropped).toBe(box);
    expect(carry.holding).toBeNull();
    scene.updateMatrixWorld(true);
    const at = box.getWorldPosition(new Vector3());
    expect(at.x).toBeCloseTo(2, 3);
    expect(at.z).toBeCloseTo(7, 3);
    expect(box.parent).toBe(scene); // back in the world, off the body
  });

  it('hands off to another character', () => {
    const a = setup();
    const b = setup();
    const box = new Object3D();
    a.carry.pickUp({ object: box, carry: 'crate' });
    a.carry.handTo(b.carry);
    expect(a.carry.holding).toBeNull();
    expect(b.carry.holding?.object).toBe(box);
    // Now parented under B's rig, not A's.
    let node: Object3D | null = box.parent;
    let underB = false;
    while (node) {
      if (node === b.r.object) underB = true;
      node = node.parent;
    }
    expect(underB).toBe(true);
  });
});

describe('the carry pose actually holds the thing', () => {
  /**
   * The gap every other test in this file left open.
   *
   * They check the bones a clip touches, the parenting, and what `holding`
   * reports — the plumbing. None of them looked at where the HANDS ended up,
   * so for four releases the poses spread the arms out sideways and nothing
   * noticed. A carry test that never measures the distance from a hand to
   * the load is a test of the bookkeeping.
   */
  const held = (style: CarryStyle) => {
    const rig = createHumanoid({ seed: 4, height: 1.75 });
    const loco = new Locomotion(rig);
    const carry = new Carry(rig, loco);
    const object = new Group();
    object.add(new Mesh(new BoxGeometry(0.3, 0.25, 0.25), new MeshBasicMaterial()));
    carry.pickUp({ object, carry: style }, { fade: 0.01 });
    for (let i = 0; i < 180; i++) loco.update(1 / 60, 0);
    rig.object.updateWorldMatrix(true, true);
    const at = (o: Object3D): Vector3 => o.getWorldPosition(new Vector3());
    const load = at(object);
    return {
      l: at(rig.bones.LeftHand).distanceTo(load),
      r: at(rig.bones.RightHand).distanceTo(load),
      gap: Math.abs(at(rig.bones.LeftHand).x - at(rig.bones.RightHand).x),
    };
  };

  /** Where the hands hang with no carry pose at all. */
  const idleGap = (): number => {
    const rig = createHumanoid({ seed: 4, height: 1.75 });
    const loco = new Locomotion(rig);
    for (let i = 0; i < 180; i++) loco.update(1 / 60, 0);
    rig.object.updateWorldMatrix(true, true);
    const at = (o: Object3D): Vector3 => o.getWorldPosition(new Vector3());
    return Math.abs(at(rig.bones.LeftHand).x - at(rig.bones.RightHand).x);
  };

  it('BOTH HANDS REACH A TWO-HANDED LOAD', () => {
    for (const style of ['crate', 'tray'] as CarryStyle[]) {
      const m = held(style);
      // Hands on the sides of the thing, not out in space beside it. Before
      // the pose was re-measured these were 0.51 and 0.43.
      expect(m.l, `${style} left hand`).toBeLessThan(0.26);
      expect(m.r, `${style} right hand`).toBeLessThan(0.26);
      // …and symmetric, because two hands on a box are.
      expect(Math.abs(m.l - m.r)).toBeLessThan(0.02);
    }
  });

  it('THE ARMS TUCK IN, THEY DO NOT SPREAD OUT', () => {
    // The sign check. Every style subtracted from the idle hang angle, which
    // rotates the upper arm up and AWAY from the body — so the fully-realised
    // pose was a star jump with a crate floating at the chest. Carrying
    // anything tucks the upper arm in past the hang.
    const idle = idleGap();
    for (const style of ['crate', 'tray'] as CarryStyle[]) {
      expect(held(style).gap, `${style} arms spread wider than hanging`).toBeLessThan(idle);
    }
  });

  it('a one-handed side carry brings the right hand to the load', () => {
    expect(held('side').r).toBeLessThan(0.32);
  });

  it('shoulder is KNOWN BAD and pinned so it cannot quietly get worse', () => {
    // Not an endorsement. The shoulder pose puts the steadying hand about
    // 50 cm from the sack and I could not fix it in the pass that fixed the
    // other three — see the note on POSE_WEIGHTS. This test exists so that
    // the next person to touch it finds out immediately whether they made it
    // better or worse, instead of rediscovering the whole thing from
    // scratch.
    const m = held('shoulder');
    // 0.87 m. The sack is on one side of the character and the hand that is
    // supposed to be steadying it is on the other.
    expect(m.r).toBeGreaterThan(0.7);
    expect(m.r, 'shoulder improved — tighten this bound').toBeLessThan(0.95);
  });
});
