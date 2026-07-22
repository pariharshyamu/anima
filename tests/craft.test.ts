import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
  createHumanoid,
  createWaveClip,
  maskClip,
  FootIK,
  LookAt,
  Locomotion,
  UPPER_BODY,
} from '../src/index';

function footWorldY(rig: ReturnType<typeof createHumanoid>, side: 'Left' | 'Right'): number {
  rig.object.updateMatrixWorld(true);
  return rig.bones[`${side}Foot`].getWorldPosition(new Vector3()).y;
}

describe('FootIK', () => {
  it('is a near no-op on flat ground', () => {
    const rig = createHumanoid({ seed: 7, height: 1.7 });
    const loco = new Locomotion(rig, { smoothing: 1e6 });
    loco.update(0.35, loco.clips.walkSpeed);
    const before = { l: footWorldY(rig, 'Left'), r: footWorldY(rig, 'Right') };
    new FootIK(rig, { ground: 0 }).update();
    expect(footWorldY(rig, 'Left')).toBeCloseTo(before.l, 2);
    expect(footWorldY(rig, 'Right')).toBeCloseTo(before.r, 2);
  });

  it('plants each foot on sloped terrain and sinks the pelvis', () => {
    const rig = createHumanoid({ seed: 7, height: 1.7 });
    const loco = new Locomotion(rig, { smoothing: 1e6 });
    loco.update(0.01, 0); // idle standing pose
    const slope = (x: number, _z: number): number => x * 0.5; // steep sideways slope
    const restHipsY = rig.bones.Hips.position.y;
    const ik = new FootIK(rig, { ground: slope, hipsAdapt: 1 });
    ik.update();
    rig.object.updateMatrixWorld(true);
    for (const side of ['Left', 'Right'] as const) {
      const foot = rig.bones[`${side}Foot`].getWorldPosition(new Vector3());
      const ground = slope(foot.x, foot.z);
      // Ankle sits at ankle height above ITS OWN ground, not the root's.
      expect(foot.y - ground).toBeGreaterThan(0);
      expect(foot.y - ground).toBeLessThan(0.16);
    }
    expect(rig.bones.Hips.position.y).toBeLessThan(restHipsY); // pelvis eased down
  });

  it('respects weight = 0', () => {
    const rig = createHumanoid({ seed: 7 });
    const loco = new Locomotion(rig, { smoothing: 1e6 });
    loco.update(0.01, 0);
    const before = footWorldY(rig, 'Left');
    const ik = new FootIK(rig, { ground: (x) => x * 0.4 });
    ik.weight = 0;
    ik.update();
    expect(footWorldY(rig, 'Left')).toBeCloseTo(before, 6);
  });
});

describe('LookAt', () => {
  it('turns the head chain toward a side target, clamped and smoothed', () => {
    const rig = createHumanoid({ seed: 5, height: 1.7 });
    const gaze = new LookAt(rig, { smoothing: 1e6 });
    gaze.target = new Vector3(2, 1.4, 2); // ahead and to the character's left
    gaze.update(0.1);
    rig.object.updateMatrixWorld(true);
    // Head forward direction gains a +X component.
    const forward = new Vector3(0, 0, 1).applyQuaternion(
      rig.bones.Head.getWorldQuaternion(new Quaternion())
    );
    expect(forward.x).toBeGreaterThan(0.3);
  });

  it('ignores targets behind the back', () => {
    const rig = createHumanoid({ seed: 5 });
    const gaze = new LookAt(rig, { smoothing: 1e6 });
    gaze.target = new Vector3(0, 1.4, -6); // directly behind
    gaze.update(0.1);
    const q = rig.bones.Head.quaternion;
    expect(Math.abs(q.y)).toBeLessThan(0.02); // no owl turn
  });

  it('holds steady for a target held right at the head (no owl-spin)', () => {
    // Reproduces the basketball bug: the gaze target is the ball, which
    // sits in the character's own hand while carried — centimetres from
    // the head. Its jittering horizontal direction must not whip the neck.
    const rig = createHumanoid({ seed: 5, height: 1.7 });
    rig.object.updateMatrixWorld(true);
    const head = rig.bones.Head.getWorldPosition(new Vector3());
    const gaze = new LookAt(rig, { smoothing: 7, maxYaw: 0.9 });
    let maxYawSeen = 0;
    for (let i = 0; i < 90; i++) {
      rig.bones.Head.quaternion.identity();
      rig.bones.Neck.quaternion.identity();
      rig.bones.Chest.quaternion.identity();
      // A ball ~15 cm from the head, bobbing/orbiting each frame — the sign
      // of its X/Z offset flips constantly, which used to swing the yaw.
      const a = i * 1.7;
      gaze.target = new Vector3(
        head.x + 0.15 * Math.sin(a),
        head.y - 0.1,
        head.z + 0.15 * Math.cos(a)
      );
      gaze.update(1 / 60);
      maxYawSeen = Math.max(maxYawSeen, Math.abs(rig.bones.Head.quaternion.y));
    }
    // Without the min-distance guard this exceeds 0.3 and flips sign wildly.
    expect(maxYawSeen).toBeLessThan(0.05);
  });

  it('eases back to neutral when the target clears', () => {
    const rig = createHumanoid({ seed: 5 });
    const gaze = new LookAt(rig, { smoothing: 20 });
    gaze.target = new Vector3(4, 1.4, 1);
    for (let i = 0; i < 30; i++) gaze.update(1 / 60);
    gaze.target = null;
    for (let i = 0; i < 120; i++) {
      rig.bones.Head.quaternion.identity(); // simulate the mixer restoring pose
      rig.bones.Neck.quaternion.identity();
      rig.bones.Chest.quaternion.identity();
      gaze.update(1 / 60);
    }
    expect(Math.abs(rig.bones.Head.quaternion.y)).toBeLessThan(0.01);
  });
});

describe('overlays & events', () => {
  it('maskClip keeps only tracks for the given bones', () => {
    const rig = createHumanoid({ seed: 7 });
    const loco = new Locomotion(rig);
    const masked = maskClip(loco.clips.walk, UPPER_BODY);
    const names = masked.tracks.map((t) => t.name.split('.')[0]);
    expect(names).toContain('LeftArm');
    expect(names).not.toContain('LeftUpLeg');
    expect(names).not.toContain('Hips');
  });

  it('wave overlay raises the right arm while walking; legs keep striding', () => {
    const rig = createHumanoid({ seed: 7, height: 1.7 });
    const loco = new Locomotion(rig, { smoothing: 1e6 });
    // Baseline: swing envelope of the arm without the wave.
    let baselineMin = Infinity;
    for (let i = 0; i < 60; i++) {
      loco.update(1 / 60, loco.clips.walkSpeed);
      rig.object.updateMatrixWorld(true);
      baselineMin = Math.min(
        baselineMin,
        rig.bones.RightHand.getWorldPosition(new Vector3()).y
      );
    }
    loco.overlay(createWaveClip(rig), { fadeIn: 0.05 });
    let handMax = -Infinity;
    let kneeDelta = 0;
    const kneeRest = rig.bones.LeftLeg.quaternion.x;
    for (let i = 0; i < 90; i++) {
      loco.update(1 / 60, loco.clips.walkSpeed);
      rig.object.updateMatrixWorld(true);
      handMax = Math.max(handMax, rig.bones.RightHand.getWorldPosition(new Vector3()).y);
      kneeDelta = Math.max(kneeDelta, Math.abs(rig.bones.LeftLeg.quaternion.x - kneeRest));
    }
    expect(handMax).toBeGreaterThan(1.0); // hand raised above shoulder-ish
    expect(handMax).toBeGreaterThan(baselineMin + 0.5);
    expect(kneeDelta).toBeGreaterThan(0.05); // gait untouched by the mask
  });

  it('fires alternating footsteps at a walk, none when idle', () => {
    const rig = createHumanoid({ seed: 7 });
    const loco = new Locomotion(rig, { smoothing: 1e6 });
    const steps: string[] = [];
    loco.onFootstep((foot) => steps.push(foot));
    for (let i = 0; i < 30; i++) loco.update(1 / 60, 0);
    expect(steps).toHaveLength(0);
    // ~2.5 walk cycles → ~5 steps, strictly alternating.
    const frames = Math.round(2.5 * loco.clips.walk.duration * 60);
    for (let i = 0; i < frames; i++) loco.update(1 / 60, loco.clips.walkSpeed);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.length).toBeLessThanOrEqual(6);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).not.toBe(steps[i - 1]);
  });

  it('unsubscribing stops footstep delivery', () => {
    const rig = createHumanoid({ seed: 7 });
    const loco = new Locomotion(rig, { smoothing: 1e6 });
    const steps: string[] = [];
    const off = loco.onFootstep((foot) => steps.push(foot));
    off();
    for (let i = 0; i < 120; i++) loco.update(1 / 60, loco.clips.walkSpeed);
    expect(steps).toHaveLength(0);
  });
});
