import { describe, expect, it } from 'vitest';
import { Object3D, Vector3, QuaternionKeyframeTrack, Scene } from 'three';
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
