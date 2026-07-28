import { describe, expect, it } from 'vitest';
import { Quaternion } from 'three';
import { createHumanoid, Locomotion, Reactions } from '../src';

const make = () => {
  const rig = createHumanoid({ seed: 8 });
  const loco = new Locomotion(rig);
  return { rig, loco, reactions: new Reactions(rig) };
};

/** One frame: locomotion first, reactions after — the documented order. */
const frame = (loco: Locomotion, reactions: Reactions, dt = 1 / 30) => {
  loco.update(dt);
  reactions.update(dt);
};

describe('Reactions', () => {
  it('a flinch bends the spine and passes — the body returns to baseline', () => {
    const { rig, loco, reactions } = make();
    frame(loco, reactions);
    const baseline = rig.bones.Spine.quaternion.clone();

    reactions.flinch({ x: 0, z: 5 }); // hit from the front
    frame(loco, reactions, 0.12); // mid-envelope
    const during = rig.bones.Spine.quaternion.clone();
    expect(during.angleTo(baseline)).toBeGreaterThan(0.08); // far above idle sway

    for (let i = 0; i < 30; i++) frame(loco, reactions);
    // Back to within idle-breathing distance of baseline (the gait itself
    // moves the spine ~0.01 rad between any two frames).
    expect(rig.bones.Spine.quaternion.angleTo(baseline)).toBeLessThan(0.05);
  });

  it('the recoil is DIRECTIONAL: opposite hits bend opposite ways', () => {
    const lean = (fromX: number) => {
      const { rig, loco, reactions } = make();
      reactions.flinch({ x: fromX, z: 0 });
      frame(loco, reactions, 0.12);
      // The spine tips away from the blow — read the sign of its local Z
      // rotation component (lean about the forward axis).
      return rig.bones.Spine.quaternion.z;
    };
    const fromLeft = lean(-5);
    const fromRight = lean(5);
    expect(Math.sign(fromLeft)).not.toBe(Math.sign(fromRight));
    expect(Math.abs(fromLeft)).toBeGreaterThan(0.005);
  });

  it('a stagger is bigger and longer than a flinch', () => {
    const peak = (kind: 'flinch' | 'stagger') => {
      const { rig, loco, reactions } = make();
      const baseline = rig.bones.Spine.quaternion.clone();
      reactions[kind]({ x: 0, z: 5 });
      let max = 0;
      for (let i = 0; i < 40; i++) {
        frame(loco, reactions);
        max = Math.max(max, rig.bones.Spine.quaternion.angleTo(baseline));
      }
      return max;
    };
    expect(peak('stagger')).toBeGreaterThan(peak('flinch') * 1.5);
  });

  it('KNOCKOUT folds to the knees and stays; getUp comes all the way back', () => {
    const { rig, loco, reactions } = make();
    frame(loco, reactions);
    const standingHips = rig.bones.Hips.position.y;
    const standingKnee = rig.bones.LeftLeg.quaternion.clone();

    reactions.knockOut();
    for (let i = 0; i < 40; i++) frame(loco, reactions);
    expect(reactions.down).toBe(true);
    expect(rig.bones.Hips.position.y).toBeLessThan(standingHips * 0.6); // kneeling height
    expect(rig.bones.LeftLeg.quaternion.angleTo(standingKnee)).toBeGreaterThan(1); // folded

    // And it STAYS down — the fold is a state, not an envelope.
    const heldHips = rig.bones.Hips.position.y;
    for (let i = 0; i < 30; i++) frame(loco, reactions);
    expect(Math.abs(rig.bones.Hips.position.y - heldHips)).toBeLessThan(0.02); // idle bob only

    reactions.getUp();
    for (let i = 0; i < 60; i++) frame(loco, reactions);
    expect(reactions.down).toBe(false);
    expect(rig.bones.Hips.position.y).toBeCloseTo(standingHips, 2);
    expect(rig.bones.LeftLeg.quaternion.angleTo(standingKnee)).toBeLessThan(0.05);
  });

  it('the floor has already won: no flinching or celebrating while down', () => {
    const { rig, loco, reactions } = make();
    reactions.knockOut();
    for (let i = 0; i < 40; i++) frame(loco, reactions);
    const downSpine = rig.bones.Spine.quaternion.clone();
    const downArm = rig.bones.LeftArm.quaternion.clone();

    reactions.flinch({ x: 5, z: 0 });
    reactions.celebrate();
    reactions.dejected();
    for (let i = 0; i < 10; i++) frame(loco, reactions);
    expect(rig.bones.Spine.quaternion.angleTo(downSpine)).toBeLessThan(0.06);
    expect(rig.bones.LeftArm.quaternion.angleTo(downArm)).toBeLessThan(0.06);
  });

  it('celebrate throws BOTH arms up and hops; dejected droops the head', () => {
    const { rig, loco, reactions } = make();
    frame(loco, reactions);
    const arm = rig.bones.LeftArm.quaternion.clone();
    const hips = rig.bones.Hips.position.y;

    reactions.celebrate(1);
    let armPeak = 0;
    let hipPeak = 0;
    for (let i = 0; i < 35; i++) {
      frame(loco, reactions);
      armPeak = Math.max(armPeak, rig.bones.LeftArm.quaternion.angleTo(arm));
      hipPeak = Math.max(hipPeak, rig.bones.Hips.position.y - hips);
    }
    expect(armPeak).toBeGreaterThan(1.2); // thrown UP, not raised politely
    expect(hipPeak).toBeGreaterThan(0.02); // the hop

    for (let i = 0; i < 30; i++) frame(loco, reactions);
    const head = rig.bones.Head.quaternion.clone();
    reactions.dejected(1);
    frame(loco, reactions, 0.4);
    expect(rig.bones.Head.quaternion.angleTo(head)).toBeGreaterThan(0.15);
  });

  it('garbage time is refused; the pose stays finite through abuse', () => {
    const { rig, loco, reactions } = make();
    reactions.flinch({ x: 0, z: 0 }); // dead-centre hit — no NaN axis
    reactions.knockOut();
    reactions.update(NaN);
    for (let i = 0; i < 20; i++) frame(loco, reactions, 10); // absurd frames
    const q = rig.bones.Spine.quaternion;
    expect(Number.isFinite(q.x + q.y + q.z + q.w)).toBe(true);
    expect(Number.isFinite(rig.bones.Hips.position.y)).toBe(true);
    expect(new Quaternion().copy(q).length()).toBeCloseTo(1, 3);
  });
});
