import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, NumberKeyframeTrack, Object3D, VectorKeyframeTrack } from 'three';
import {
  createGaitClips,
  createHumanoid,
  createLocomotionClips,
  createQuadruped,
  GAITS,
  measureFootSkate,
  type SkateRig,
} from '../src';

/**
 * Foot skate is the one animation defect that no unit test could see before
 * this: the clip compiles, the pose is valid, the numbers are all finite, and
 * the character slides along the ground like it is on ice. These tests check
 * the metric itself against motion whose answer is known by construction, and
 * then check the shipped clips against it.
 *
 * `bench/skate.mjs` is the gate with the budgets. This file is what makes the
 * gate's absence non-fatal: `npm test` alone still catches a stride constant
 * being edited without re-deriving the speed.
 */

const HOOVES = ['LFHoof', 'RFHoof', 'LHHoof', 'RHHoof'];

/** Bone-name-keyed contact schedule, from the leg-keyed gait spec. */
const contactOf = (gait: 'walk' | 'trot' | 'canter' | 'gallop'): Record<string, number> =>
  Object.fromEntries(
    Object.entries(GAITS[gait].contact).map(([leg, phase]) => [`${leg}Hoof`, phase])
  );

/**
 * A rig whose foot does exactly one thing: travel `distance` backward over
 * `step` seconds, then return over another `step`. Two steps per cycle, a
 * constant backward speed of `distance / step`, and no curvature — so every
 * number the metric reports is arithmetic, and any disagreement is the
 * metric's fault rather than a judgement call about a sine.
 *
 * A triangle rather than a sawtooth on purpose: a foot that teleports back to
 * the front at the loop point loses one sample at the discontinuity, which
 * would put a 1/`samples` error into the fixture and make it look like the
 * metric's. Real gaits are continuous.
 */
function pacer(distance: number, step = 1): { rig: SkateRig; clip: AnimationClip } {
  const root = new Object3D();
  const foot = new Bone();
  foot.name = 'Foot';
  root.add(foot);
  const half = distance / 2;
  const clip = new AnimationClip('pace', 2 * step, [
    new VectorKeyframeTrack(
      'Foot.position',
      [0, step, 2 * step],
      [0, 0, half, 0, 0, -half, 0, 0, half]
    ),
  ]);
  return { rig: { object: root, bones: { Foot: foot } }, clip };
}

describe('measureFootSkate', () => {
  it('measures a known stride exactly', () => {
    const { rig, clip } = pacer(1.5, 2);
    // The foot travels 1.5 m in 2 s, so 0.75 m/s is the speed at which it
    // does not slip.
    const report = measureFootSkate(rig, clip, { speed: 0.75, feet: ['Foot'] });
    expect(report.stride).toBeCloseTo(1.5, 3);
    expect(report.stepDuration).toBeCloseTo(2, 6);
    expect(report.impliedSpeed).toBeCloseTo(0.75, 3);
    expect(report.mismatch).toBeCloseTo(0, 3);
    expect(report.slipPerStep).toBeCloseTo(0, 3);
    // The pacer moves at one speed throughout, so there is no instantaneous
    // deviation either. Only curved gaits have that.
    expect(report.peakDeviation).toBeLessThan(0.01);
  });

  it('reports the sign of the error: too fast slides forward, too slow moonwalks', () => {
    const { rig, clip } = pacer(1.5, 2);
    const at = (speed: number) => measureFootSkate(rig, clip, { speed, feet: ['Foot'] });
    expect(at(1.5).mismatch).toBeCloseTo(1, 3); // twice as fast as the feet
    expect(at(0.375).mismatch).toBeCloseTo(-0.5, 3); // half as fast
    // `slipPerStep` is the same fact in metres: at double speed the body
    // covers a whole extra stride per step.
    expect(at(1.5).slipPerStep).toBeCloseTo(1.5, 3);
  });

  it('divides by the step, not the cycle', () => {
    const { rig, clip } = pacer(1, 1); // 2 s of clip, two 1 s steps
    const one = measureFootSkate(rig, clip, { speed: 1, feet: ['Foot'], stepsPerCycle: 1 });
    const two = measureFootSkate(rig, clip, { speed: 1, feet: ['Foot'], stepsPerCycle: 2 });
    expect(one.stepDuration).toBeCloseTo(2, 6);
    expect(two.stepDuration).toBeCloseTo(1, 6);
    expect(two.impliedSpeed).toBeCloseTo(one.impliedSpeed * 2, 6);
    // Two steps per cycle is the biped's bookkeeping and the right one here:
    // the foot really does carry the body 1 m in 1 s.
    expect(two.impliedSpeed).toBeCloseTo(1, 3);
  });

  it('is blind to which way the rig faces', () => {
    // Forward is −Z for some rigs and +Z for others. A stride is a distance.
    const forward = pacer(1.2, 1);
    const backward = pacer(-1.2, 1);
    const opts = { speed: 1.2, feet: ['Foot'] };
    expect(measureFootSkate(forward.rig, forward.clip, opts).stride).toBeCloseTo(1.2, 3);
    expect(measureFootSkate(backward.rig, backward.clip, opts).stride).toBeCloseTo(1.2, 3);
  });

  it('accepts any rig with named bones — no ANIMA type required', () => {
    // The handshake the whole trilogy uses: structure, not nominal types.
    const { rig, clip } = pacer(1, 1);
    const structural: { object: Object3D; bones: Record<string, Object3D> } = rig;
    expect(() => measureFootSkate(structural, clip, { speed: 1, feet: ['Foot'] })).not.toThrow();
  });

  it('names the bone it cannot find instead of returning NaN', () => {
    const { rig, clip } = pacer(1, 1);
    expect(() => measureFootSkate(rig, clip, { speed: 1, feet: ['Ankle'] })).toThrow(/"Ankle"/);
  });

  it('refuses a contact schedule it cannot use', () => {
    const { rig, clip } = pacer(1, 1);
    expect(() =>
      measureFootSkate(rig, clip, { speed: 1, feet: ['Foot'], contact: { Foot: 0 } })
    ).toThrow(/duty/);
    expect(() =>
      measureFootSkate(rig, clip, { speed: 1, feet: ['Foot'], contact: {}, duty: 0.5 })
    ).toThrow(/no phase for "Foot"/);
  });

  it('windows on contact when told to, and measures the window', () => {
    // The foot travels 2 m backward over 4 s (the clip is 8 s, two steps).
    // The middle half of that window is 1 m in 2 s — the same speed.
    const { rig, clip } = pacer(2, 4);
    const whole = measureFootSkate(rig, clip, { speed: 0.5, feet: ['Foot'] });
    const half = measureFootSkate(rig, clip, {
      speed: 0.5,
      feet: ['Foot'],
      contact: { Foot: 0.125 },
      duty: 0.25,
    });
    expect(whole.stride).toBeCloseTo(2, 3);
    expect(whole.stepDuration).toBeCloseTo(4, 6);
    expect(half.stride).toBeCloseTo(1, 3);
    expect(half.stepDuration).toBeCloseTo(2, 6);
    // Same underlying motion, so the same implied speed either way.
    expect(half.impliedSpeed).toBeCloseTo(whole.impliedSpeed, 3);
  });

  it('reports spread when the feet disagree about how long a step is', () => {
    const root = new Object3D();
    const bones: Record<string, Object3D> = {};
    for (const name of ['Short', 'Long']) {
      const bone = new Bone();
      bone.name = name;
      root.add(bone);
      bones[name] = bone;
    }
    const clip = new AnimationClip('mismatched', 2, [
      new VectorKeyframeTrack('Short.position', [0, 1, 2], [0, 0, 0.5, 0, 0, -0.5, 0, 0, 0.5]),
      new VectorKeyframeTrack('Long.position', [0, 1, 2], [0, 0, 0.75, 0, 0, -0.75, 0, 0, 0.75]),
    ]);
    const report = measureFootSkate({ object: root, bones }, clip, {
      speed: 1.25,
      feet: ['Short', 'Long'],
    });
    expect(report.stride).toBeCloseTo(1.25, 3); // the mean of 1.0 and 1.5
    expect(report.spread).toBeCloseTo(0.5, 3); // 1.5 / 1.0 - 1
    // And the mean can be perfectly matched while both feet are wrong, which
    // is exactly why `spread` is reported separately.
    expect(Math.abs(report.mismatch)).toBeLessThan(0.01);
  });

  it('survives a clip that never moves the foot', () => {
    const root = new Object3D();
    const foot = new Bone();
    foot.name = 'Foot';
    root.add(foot);
    const clip = new AnimationClip('still', 1, [
      new NumberKeyframeTrack('Foot.position[y]', [0, 1], [0, 0]),
    ]);
    const report = measureFootSkate({ object: root, bones: { Foot: foot } }, clip, {
      speed: 1,
      feet: ['Foot'],
    });
    // A foot that does not travel implies zero speed: any travel is pure
    // slide. Infinite mismatch is the honest answer, not a crash.
    expect(report.stride).toBe(0);
    expect(report.impliedSpeed).toBe(0);
    expect(report.mismatch).toBe(Infinity);
    expect(report.spread).toBe(0);
  });
});

describe('the shipped clips are stride-matched', () => {
  // These are the assertions that would have caught the two constants that
  // shipped wrong. Keep them tight: the whole failure mode is a tolerance
  // wide enough to wave the defect through.

  it('every humanoid seed walks and runs at the speed it declares', () => {
    for (const seed of [1, 2, 3, 7, 11, 21, 42, 99]) {
      const rig = createHumanoid({ seed });
      const clips = createLocomotionClips(rig);
      const walk = measureFootSkate(rig, clips.walk, { speed: clips.walkSpeed });
      const run = measureFootSkate(rig, clips.run, { speed: clips.runSpeed });
      expect(Math.abs(walk.mismatch), `seed ${seed} walk`).toBeLessThan(0.01);
      expect(Math.abs(run.mismatch), `seed ${seed} run`).toBeLessThan(0.01);
    }
  });

  it('the run used a stride factor nobody had measured', () => {
    // `createLocomotionClips` used 1.6 for the run against 1.35 for the walk.
    // Both gaits are the same geometry, so one factor serves both, and the
    // proof is that the two gaits' measured stride-per-radian agree.
    const rig = createHumanoid({ seed: 7 });
    const clips = createLocomotionClips(rig);
    const walk = measureFootSkate(rig, clips.walk, { speed: clips.walkSpeed });
    const run = measureFootSkate(rig, clips.run, { speed: clips.runSpeed });
    // 1.6 / 1.35 = 1.185, so the old bug showed up here as an 18% gap.
    expect(run.mismatch - walk.mismatch).toBeLessThan(0.02);
  });

  it('every horse gait carries the body as far as its hooves sweep', () => {
    // This replaces a 15% tolerance, which is how `gaitSpeed` shipped
    // predicting a sweep of `2·R·sin(reach)` while `poseLeg` swung the hind
    // limb through `0.95·reach` — 8.5% of skate, comfortably inside 15%.
    const rig = createQuadruped();
    const clips = createGaitClips(rig);
    for (const gait of ['walk', 'trot', 'canter', 'gallop'] as const) {
      const report = measureFootSkate(rig, clips[gait], {
        speed: clips.speeds[gait],
        feet: HOOVES,
        contact: contactOf(gait),
        duty: GAITS[gait].duty,
      });
      expect(Math.abs(report.mismatch), `${gait} skate`).toBeLessThan(0.05);
    }
  });

  it('tempo does not change how much a horse skates', () => {
    // Keyframe density used to follow the PLAYBACK duration, so a 1.4× canter
    // was baked at 13 keyframes instead of 19 and its skate doubled. Stride
    // matching is pure geometry: it cannot depend on the playback rate.
    const rig = createQuadruped();
    const reference = createGaitClips(rig);
    for (const tempo of [0.75, 1.4]) {
      const clips = createGaitClips(rig, { tempo });
      for (const gait of ['walk', 'trot', 'canter', 'gallop'] as const) {
        const common = { feet: HOOVES, contact: contactOf(gait), duty: GAITS[gait].duty };
        const at = measureFootSkate(rig, clips[gait], {
          ...common,
          speed: clips.speeds[gait],
        });
        const base = measureFootSkate(rig, reference[gait], {
          ...common,
          speed: reference.speeds[gait],
        });
        expect(at.mismatch, `${gait} @${tempo}×`).toBeCloseTo(base.mismatch, 3);
      }
    }
  });

  it('every species skates the same, because skate is scale-free', () => {
    // A donkey is 1.15 m and a draught horse 1.75 m. Stride, stance time and
    // declared speed all scale with height, so the RATIO must not move.
    const reference = createQuadruped({ species: 'horse' });
    const base = measureFootSkate(reference, createGaitClips(reference).trot, {
      speed: createGaitClips(reference).speeds.trot,
      feet: HOOVES,
      contact: contactOf('trot'),
      duty: GAITS.trot.duty,
    });
    for (const species of ['pony', 'draft', 'donkey'] as const) {
      const rig = createQuadruped({ species });
      const clips = createGaitClips(rig);
      const report = measureFootSkate(rig, clips.trot, {
        speed: clips.speeds.trot,
        feet: HOOVES,
        contact: contactOf('trot'),
        duty: GAITS.trot.duty,
      });
      expect(report.mismatch, species).toBeCloseTo(base.mismatch, 3);
    }
  });
});
