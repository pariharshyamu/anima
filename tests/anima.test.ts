import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  createHumanoid,
  createLocomotionClips,
  Locomotion,
  BONE_NAMES,
  OUTFITS,
} from '../src/index';

describe('createHumanoid', () => {
  it('builds the full canonical skeleton with unique bone names', () => {
    const rig = createHumanoid({ seed: 7 });
    const names = rig.skeleton.bones.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of BONE_NAMES) expect(names).toContain(name);
    // Hierarchy spot checks.
    expect(rig.bones.LeftForeArm.parent).toBe(rig.bones.LeftArm);
    expect(rig.bones.RightFoot.parent).toBe(rig.bones.RightLeg);
    expect(rig.bones.Head.parent).toBe(rig.bones.Neck);
  });

  it('is deterministic per seed and varies across seeds', () => {
    const a = createHumanoid({ seed: 42 });
    const b = createHumanoid({ seed: 42 });
    const c = createHumanoid({ seed: 43 });
    expect(a.height).toBe(b.height);
    expect(a.height).not.toBe(c.height);
    const pos = (rig: typeof a): number =>
      (rig.mesh.geometry.getAttribute('position') as { getY(i: number): number }).getY(100);
    expect(pos(a)).toBe(pos(b));
  });

  it('rest pose is grounded, symmetric, T-posed and identity-rotated', () => {
    const rig = createHumanoid({ seed: 3, height: 1.7 });
    rig.object.updateMatrixWorld(true);
    const world = (name: (typeof BONE_NAMES)[number]): Vector3 =>
      rig.bones[name].getWorldPosition(new Vector3());
    expect(world('LeftFoot').y).toBeCloseTo(0.045 * 1.7, 3);
    expect(world('Head').y).toBeGreaterThan(1.2);
    expect(world('LeftHand').x).toBeCloseTo(-world('RightHand').x, 5);
    // T-pose: hands out at shoulder height, far from the body.
    expect(Math.abs(world('LeftHand').x)).toBeGreaterThan(0.3);
    for (const name of BONE_NAMES) {
      const q = rig.bones[name].quaternion;
      expect(Math.abs(1 - q.w)).toBeLessThan(1e-9); // identity rest rotations
    }
  });

  it('skinning is valid: every vertex bound fully to one existing bone', () => {
    const rig = createHumanoid({ seed: 5 });
    const skinIndex = rig.mesh.geometry.getAttribute('skinIndex');
    const skinWeight = rig.mesh.geometry.getAttribute('skinWeight');
    const boneCount = rig.skeleton.bones.length;
    expect(skinIndex.count).toBe(rig.mesh.geometry.getAttribute('position').count);
    for (let i = 0; i < skinIndex.count; i += 37) {
      expect(skinIndex.getX(i)).toBeLessThan(boneCount);
      expect(skinWeight.getX(i)).toBe(1);
    }
    expect(rig.mesh.skeleton.boneInverses.length).toBe(boneCount);
  });

  it('respects explicit height/build and outfit palettes', () => {
    const rig = createHumanoid({ seed: 9, height: 2.0, build: 1.2, palette: OUTFITS.guard });
    expect(rig.height).toBe(2.0);
    expect(rig.legLength).toBeCloseTo(0.46 * 2.0, 5);
    expect(rig.obstacleRadius).toBeGreaterThan(createHumanoid({ seed: 9, height: 2.0, build: 0.85 }).obstacleRadius);
  });
});

describe('createLocomotionClips', () => {
  const rig = createHumanoid({ seed: 7, height: 1.7 });
  const clips = createLocomotionClips(rig);

  it('produces looping clips with tracks for the limbs and hips', () => {
    for (const clip of [clips.idle, clips.walk, clips.run]) {
      expect(clip.duration).toBeGreaterThan(0.3);
      const names = clip.tracks.map((t) => t.name);
      expect(names).toContain('LeftUpLeg.quaternion');
      expect(names).toContain('RightArm.quaternion');
      expect(names).toContain('Hips.position');
      for (const track of clip.tracks) {
        const v = track.values;
        const stride = track.getValueSize();
        for (let c = 0; c < stride; c++) {
          expect(v[c]).toBeCloseTo(v[v.length - stride + c], 5); // seamless loop
        }
      }
    }
  });

  it('legs move in antiphase during walk', () => {
    const left = clips.walk.tracks.find((t) => t.name === 'LeftUpLeg.quaternion')!;
    const right = clips.walk.tracks.find((t) => t.name === 'RightUpLeg.quaternion')!;
    // Quarter cycle in: one leg swung forward (negative X rotation), the
    // other back — X components have opposite signs.
    const frames = left.times.length;
    const q = Math.round(frames / 4) * 4;
    expect(left.values[q] * right.values[q]).toBeLessThan(0);
    expect(Math.abs(left.values[q])).toBeGreaterThan(0.1);
  });

  it('reports faster reference speed for run than walk', () => {
    expect(clips.runSpeed).toBeGreaterThan(clips.walkSpeed * 1.5);
    expect(clips.walkSpeed).toBeGreaterThan(0.5);
    expect(clips.walkSpeed).toBeLessThan(3);
  });

  it('scales stride speeds with body size', () => {
    const tall = createLocomotionClips(createHumanoid({ seed: 7, height: 2.2 }));
    expect(tall.walkSpeed).toBeGreaterThan(clips.walkSpeed);
  });
});

describe('Locomotion', () => {
  function makeLoco() {
    const rig = createHumanoid({ seed: 7, height: 1.7 });
    return { rig, loco: new Locomotion(rig, { smoothing: 1e6 }) }; // no smoothing lag in tests
  }

  it('stands idle at zero velocity and fully runs beyond runSpeed', () => {
    const { loco } = makeLoco();
    loco.update(0.1, 0);
    expect(loco.weights.idle).toBe(1);
    loco.update(0.1, new Vector3(10, 0, 0));
    expect(loco.weights.run).toBe(1);
    expect(loco.weights.idle).toBe(0);
  });

  it('blends walk↔run at intermediate speed with weights summing to 1', () => {
    const { loco } = makeLoco();
    const mid = (loco.clips.walkSpeed + loco.clips.runSpeed) / 2;
    loco.update(0.1, mid);
    expect(loco.weights.walk).toBeGreaterThan(0.3);
    expect(loco.weights.run).toBeGreaterThan(0.3);
    expect(loco.weights.idle + loco.weights.walk + loco.weights.run).toBeCloseTo(1, 5);
  });

  it('ignores vertical velocity (falling is not running)', () => {
    const { loco } = makeLoco();
    loco.update(0.1, new Vector3(0, 20, 0));
    expect(loco.weights.idle).toBe(1);
  });

  it('actually deforms the skeleton: knees bend while walking', () => {
    const { rig, loco } = makeLoco();
    const rest = rig.bones.LeftLeg.quaternion.clone();
    let maxDelta = 0;
    for (let i = 0; i < 60; i++) {
      loco.update(1 / 60, loco.clips.walkSpeed);
      maxDelta = Math.max(maxDelta, Math.abs(rig.bones.LeftLeg.quaternion.x - rest.x));
    }
    expect(maxDelta).toBeGreaterThan(0.05);
  });

  it('smooths speed changes instead of popping', () => {
    const rig = createHumanoid({ seed: 8 });
    const loco = new Locomotion(rig, { smoothing: 5 });
    loco.update(0.016, 5);
    expect(loco.speed).toBeLessThan(1); // still ramping up after one frame
    for (let i = 0; i < 120; i++) loco.update(0.016, 5);
    expect(loco.speed).toBeGreaterThan(4.5);
  });

  it('keeps walk and run phase-synchronized while blending', () => {
    const { loco } = makeLoco();
    const mid = (loco.clips.walkSpeed + loco.clips.runSpeed) / 2;
    for (let i = 0; i < 30; i++) loco.update(1 / 60, mid);
    const walkPhase =
      ((loco as never as { walkAction: { time: number } }).walkAction.time % loco.clips.walk.duration) /
      loco.clips.walk.duration;
    const runPhase =
      ((loco as never as { runAction: { time: number } }).runAction.time % loco.clips.run.duration) /
      loco.clips.run.duration;
    expect(Math.abs(walkPhase - runPhase)).toBeLessThan(0.05);
  });
});

describe('rest-pose sanity under animation', () => {
  it('feet return near ground level over a walk cycle', () => {
    const rig = createHumanoid({ seed: 7, height: 1.7 });
    const loco = new Locomotion(rig, { smoothing: 1e6 });
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 120; i++) {
      loco.update(1 / 60, loco.clips.walkSpeed);
      rig.object.updateMatrixWorld(true);
      const y = rig.bones.LeftFoot.getWorldPosition(new Vector3()).y;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    // The ankle stays in a plausible band: never underground, never knee-high.
    expect(minY).toBeGreaterThan(-0.02);
    expect(maxY).toBeLessThan(0.45);
    expect(maxY - minY).toBeGreaterThan(0.03); // it does actually step
  });
});
