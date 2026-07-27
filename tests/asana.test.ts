import { describe, it, expect } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  createHumanoid,
  strikePose,
  Asana,
  ASANAS,
  ASANA_NAMES,
  BONE_NAMES,
  type AsanaName,
  type HumanoidRig,
} from '../src';

const v = new Vector3();

const worldY = (rig: HumanoidRig, bone: (typeof BONE_NAMES)[number]): number => {
  rig.object.updateWorldMatrix(true, true);
  return rig.bones[bone].getWorldPosition(v).y;
};

const minBoneY = (rig: HumanoidRig): number => {
  rig.object.updateWorldMatrix(true, true);
  let min = Infinity;
  for (const bone of BONE_NAMES) {
    min = Math.min(min, rig.bones[bone].getWorldPosition(v).y);
  }
  return min;
};

const run = (asana: Asana, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) asana.update(1 / 60);
};

describe('strikePose — the single-frame API', () => {
  it('applies a pose instantly, no clock required', () => {
    const rig = createHumanoid({ seed: 4, height: 1.7 });
    strikePose(rig, 'downwardDog');
    // The inverted V, in one call: hips are the apex, hands press the floor.
    expect(worldY(rig, 'Hips')).toBeGreaterThan(worldY(rig, 'Head') + 0.2);
    expect(worldY(rig, 'LeftHand')).toBeLessThan(0.12);
  });

  it('is deterministic and idempotent', () => {
    const a = createHumanoid({ seed: 4 });
    const b = createHumanoid({ seed: 4 });
    strikePose(a, 'tree');
    strikePose(b, 'tree');
    strikePose(b, 'tree');
    for (const bone of BONE_NAMES) {
      expect(a.bones[bone].quaternion.angleTo(b.bones[bone].quaternion)).toBeLessThan(1e-6);
    }
  });

  it('accepts a custom spec object, not just a name', () => {
    const rig = createHumanoid({ seed: 4 });
    strikePose(rig, {
      sanskrit: 'test',
      root: { height: 0.5, pitch: 0 },
      support: 'seated',
      bones: { Head: [['X', 0.5]] },
    });
    expect(rig.bones.Hips.position.y).toBeCloseTo((rig.legLength + 0.065 * rig.height) * 0.5, 5);
    expect(rig.bones.Head.quaternion.angleTo(new Quaternion())).toBeCloseTo(0.5, 3);
  });

  it('EVERY asana keeps the body out of the floor and on its declared support', () => {
    const rig = createHumanoid({ seed: 4, height: 1.7 });
    for (const name of ASANA_NAMES) {
      strikePose(rig, name);
      expect(minBoneY(rig), name).toBeGreaterThan(-0.035);
      const spec = ASANAS[name];
      const near = (bone: (typeof BONE_NAMES)[number], limit: number) =>
        expect(worldY(rig, bone), `${name}:${bone}`).toBeLessThan(limit);
      // The support tag is a floor-contact CONTRACT, not a label.
      if (spec.support === 'feet') near(spec.balance ? 'LeftFoot' : 'RightFoot', 0.12);
      if (spec.support === 'handsFeet') {
        near('LeftHand', 0.12);
        near('RightHand', 0.12);
      }
      if (spec.support === 'kneeling') near('LeftLeg', 0.1);
      if (spec.support === 'seated') near('Hips', 0.3);
      if (spec.support === 'prone' || spec.support === 'supine') near('Hips', 0.2);
    }
  });

  it('the poses are THEMSELVES: geometric identity checks', () => {
    const rig = createHumanoid({ seed: 4, height: 1.7 });
    strikePose(rig, 'upwardSalute');
    expect(worldY(rig, 'LeftHand')).toBeGreaterThan(worldY(rig, 'Head'));
    strikePose(rig, 'forwardFold');
    expect(worldY(rig, 'Head')).toBeLessThan(worldY(rig, 'Hips') - 0.2);
    strikePose(rig, 'plank');
    // One straight line: head to heels, near-horizontal, wrists under shoulders.
    expect(Math.abs(worldY(rig, 'Head') - worldY(rig, 'LeftFoot'))).toBeLessThan(0.45);
    expect(worldY(rig, 'LeftHand')).toBeLessThan(0.12);
    strikePose(rig, 'cobra');
    expect(worldY(rig, 'Head')).toBeGreaterThan(worldY(rig, 'Chest'));
    expect(worldY(rig, 'Chest')).toBeGreaterThan(worldY(rig, 'Hips'));
    strikePose(rig, 'tree');
    expect(worldY(rig, 'RightFoot')).toBeGreaterThan(0.5);
    expect(worldY(rig, 'LeftFoot')).toBeLessThan(0.12);
    expect(ASANAS.tree.balance).toBe(true);
    strikePose(rig, 'triangle');
    expect(worldY(rig, 'RightHand') - worldY(rig, 'LeftHand')).toBeGreaterThan(0.7);
    strikePose(rig, 'corpse');
    for (const bone of BONE_NAMES) expect(worldY(rig, bone), `corpse:${bone}`).toBeLessThan(0.3);
    strikePose(rig, 'prayer');
    rig.bones.LeftHand.getWorldPosition(v);
    const lh = v.clone();
    rig.bones.RightHand.getWorldPosition(v);
    expect(lh.distanceTo(v)).toBeLessThan(0.3);
    expect(lh.y).toBeGreaterThan(1.0);
    expect(lh.y).toBeLessThan(1.4);
  });
});

describe('the Asana hold', () => {
  it('finds a struck pose and reports settled', () => {
    const rig = createHumanoid({ seed: 4 });
    const asana = new Asana(rig, { seed: 3 });
    asana.strike('mountain');
    expect(asana.settled).toBe(false);
    run(asana, 5);
    expect(asana.settled).toBe(true);
    expect(asana.pose).toBe('mountain');
  });

  it('holds ALIVE, not frozen: whisper-level motion, never zero', () => {
    const rig = createHumanoid({ seed: 4 });
    const asana = new Asana(rig, { seed: 3, breathsPerMinute: 8 });
    asana.strike('mountain');
    run(asana, 6);
    let maxStep = 0;
    let total = 0;
    const last = rig.bones.Chest.quaternion.clone();
    for (let i = 0; i < 6 * 60; i++) {
      asana.update(1 / 60);
      const step = last.angleTo(rig.bones.Chest.quaternion);
      maxStep = Math.max(maxStep, step);
      total += step;
      last.copy(rig.bones.Chest.quaternion);
    }
    expect(maxStep).toBeLessThan(0.012); // a whisper…
    expect(total).toBeGreaterThan(0.01); // …but never a statue
  });

  it('breathes at the asked rate, and the turns fire in order', () => {
    const rig = createHumanoid({ seed: 4 });
    const asana = new Asana(rig, { seed: 3, breathsPerMinute: 30 });
    asana.strike('lotus');
    const events: string[] = [];
    const off = asana.onBreath((side) => events.push(side));
    run(asana, 10.2); // 2 s per breath → ~5 cycles
    expect(events.length).toBeGreaterThanOrEqual(9);
    expect(events.length).toBeLessThanOrEqual(11);
    for (let i = 1; i < events.length; i++) expect(events[i]).not.toBe(events[i - 1]);
    off();
    const n = events.length;
    run(asana, 2);
    expect(events.length).toBe(n);
  });

  it('sway knows what it is balancing: tree > mountain > corpse (which is zero)', () => {
    const spread = (name: AsanaName): number => {
      const rig = createHumanoid({ seed: 4 });
      const asana = new Asana(rig, { seed: 9 });
      asana.strike(name);
      // A LONG settle first: the exponential tail must be spent, or its
      // residue reads as sway on poses that have none.
      run(asana, 14);
      const first = rig.bones.Hips.quaternion.clone();
      let max = 0;
      for (let i = 0; i < 10 * 60; i++) {
        asana.update(1 / 60);
        max = Math.max(max, first.angleTo(rig.bones.Hips.quaternion));
      }
      return max;
    };
    const tree = spread('tree');
    const mountain = spread('mountain');
    const corpse = spread('corpse');
    expect(tree).toBeGreaterThan(mountain * 1.8);
    expect(mountain).toBeGreaterThan(0.003);
    expect(corpse).toBeLessThan(1e-4);
  });

  it('release() comes home to the entry pose', () => {
    const rig = createHumanoid({ seed: 4 });
    const home = new Map(BONE_NAMES.map((b) => [b, rig.bones[b].quaternion.clone()]));
    const homeY = rig.bones.Hips.position.y;
    const asana = new Asana(rig, { seed: 3 });
    asana.strike('child');
    run(asana, 5);
    asana.release();
    run(asana, 4);
    expect(asana.holding).toBe(false);
    for (const bone of BONE_NAMES) {
      expect(rig.bones[bone].quaternion.angleTo(home.get(bone)!), bone).toBeLessThan(0.02);
    }
    expect(Math.abs(rig.bones.Hips.position.y - homeY)).toBeLessThan(0.01);
  });

  it('flows pose to pose without snapping, and without diving through the floor', () => {
    const rig = createHumanoid({ seed: 4, height: 1.7 });
    const asana = new Asana(rig, { seed: 3 });
    asana.strike('plank');
    run(asana, 4);
    asana.strike('downwardDog');
    let min = Infinity;
    let maxStep = 0;
    const last = rig.bones.LeftArm.quaternion.clone();
    for (let i = 0; i < 5 * 60; i++) {
      asana.update(1 / 60);
      min = Math.min(min, minBoneY(rig));
      maxStep = Math.max(maxStep, last.angleTo(rig.bones.LeftArm.quaternion));
      last.copy(rig.bones.LeftArm.quaternion);
    }
    expect(asana.pose).toBe('downwardDog');
    expect(asana.settled).toBe(true);
    expect(min).toBeGreaterThan(-0.2); // transient grace…
    expect(minBoneY(rig)).toBeGreaterThan(-0.05); // …but the pose is honest
    expect(maxStep).toBeLessThan(0.09); // eased, never snapped
  });

  it('is deterministic: same seed, same practice', () => {
    const make = () => {
      const rig = createHumanoid({ seed: 4 });
      const asana = new Asana(rig, { seed: 21 });
      asana.strike('tree');
      run(asana, 7.3);
      return rig;
    };
    const a = make();
    const b = make();
    for (const bone of BONE_NAMES) {
      expect(a.bones[bone].quaternion.angleTo(b.bones[bone].quaternion)).toBeLessThan(1e-6);
    }
  });

  it('the full repertoire settles clean — all fifteen, floor-honest', () => {
    for (const name of ASANA_NAMES) {
      const rig = createHumanoid({ seed: 4, height: 1.7 });
      const asana = new Asana(rig, { seed: 5 });
      asana.strike(name);
      run(asana, 6);
      expect(asana.settled, name).toBe(true);
      expect(minBoneY(rig), name).toBeGreaterThan(-0.05);
    }
  });
});
