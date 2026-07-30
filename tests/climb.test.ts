import { describe, expect, it } from 'vitest';
import { AnimationMixer, Vector3 } from 'three';
import type { BoneName } from '../src/humanoid';
import { createHumanoid } from '../src/humanoid';
import { createClimbClip, createTopOutClip, measureClimbContact } from '../src/climb';

const SEEDS = [1, 5, 12, 21, 33];

describe('the climb loop', () => {
  describe('three points of contact', () => {
    it('moves exactly one limb at a time, on every body', () => {
      // The rule painted on every ladder in the world, and the one the loop
      // this replaced claimed in its own doc comment while breaking it: a
      // modulo cancelled the contralateral offset, so all four limbs moved in
      // pairs. Measured at 0.604 of the cycle with two limbs in motion.
      for (const seed of SEEDS) {
        const report = measureClimbContact(createHumanoid({ seed }), { rungSpacing: 0.3 });
        expect(report.overlap, `seed ${seed}`).toBe(0);
      }
    });

    it('alternates the sides rather than moving them together', () => {
      const rig = createHumanoid({ seed: 5 });
      const clip = createClimbClip(rig, { rungSpacing: 0.3 });
      const mixer = new AnimationMixer(rig.object);
      mixer.clipAction(clip).play();
      const heights = (): Record<string, number> => {
        rig.object.updateWorldMatrix(true, true);
        const out: Record<string, number> = {};
        for (const b of ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot']) {
          out[b] = rig.bones[b as BoneName].getWorldPosition(new Vector3()).y;
        }
        return out;
      };
      let apart = 0;
      const N = 120;
      for (let i = 0; i < N; i++) {
        mixer.setTime((i / N) * clip.duration);
        const h = heights();
        // The two hands are on different rungs for most of the cycle; a rig
        // whose arms move in unison holds them level throughout.
        if (Math.abs(h.LeftHand - h.RightHand) > 0.1) apart++;
      }
      expect(apart / N).toBeGreaterThan(0.5);
    });
  });

  describe('holding the rungs', () => {
    it('a gripping hand does not move in the world', () => {
      // The climbing form of foot skate, which this module's doc warned about
      // and then did: 0.367 m of hand travel per cycle while gripping.
      for (const seed of SEEDS) {
        const report = measureClimbContact(createHumanoid({ seed }), { rungSpacing: 0.3 });
        expect(report.handSlip, `seed ${seed}`).toBeLessThan(0.005);
        expect(report.footSlip, `seed ${seed}`).toBeLessThan(0.005);
      }
    });

    it('holds the rungs at any rung spacing', () => {
      const rig = createHumanoid({ seed: 5 });
      for (const rungSpacing of [0.22, 0.3, 0.36]) {
        const report = measureClimbContact(rig, { rungSpacing });
        expect(report.worstSlip, `${rungSpacing} m rungs`).toBeLessThan(0.01);
      }
    });

    it('never locks a limb straight to reach a rung', () => {
      // A chain at full extension is `solveChain` reporting "I could not reach
      // that" by clamping — silently, without slipping. Nothing else in the
      // report can see it, and on a 1.67 m body it was at 0.999.
      for (const seed of SEEDS) {
        const report = measureClimbContact(createHumanoid({ seed }), { rungSpacing: 0.3 });
        expect(report.stretch, `seed ${seed}`).toBeLessThan(0.99);
      }
    });
  });

  describe('the posture', () => {
    it('reaches above the head, as a climber does', () => {
      // The old loop held the arms out sideways between 20 degrees below and
      // 4 above horizontal — the hands peaked BELOW the head.
      for (const seed of SEEDS) {
        const report = measureClimbContact(createHumanoid({ seed }), { rungSpacing: 0.3 });
        expect(report.overhead, `seed ${seed}`).toBeGreaterThan(0.03);
      }
    });

    it('scales the reach to the body it is given', () => {
      // Angles that put a tall character's hands on the rungs put a short
      // one's through them. The limbs are solved, so both fit.
      const short = createHumanoid({ seed: 12 });
      const tall = createHumanoid({ seed: 5 });
      expect(tall.height).toBeGreaterThan(short.height);
      for (const rig of [short, tall]) {
        const report = measureClimbContact(rig, { rungSpacing: 0.3 });
        expect(report.stretch).toBeLessThan(0.99);
        expect(report.worstSlip).toBeLessThan(0.005);
      }
    });
  });

  describe('the clip', () => {
    it('loops seamlessly — one rung of advance is one rung of rise', () => {
      const rig = createHumanoid({ seed: 5 });
      const clip = createClimbClip(rig, { rungSpacing: 0.3 });
      const mixer = new AnimationMixer(rig.object);
      mixer.clipAction(clip).play();
      const sample = (t: number): Vector3[] => {
        mixer.setTime(t);
        rig.object.updateWorldMatrix(true, true);
        return ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'].map((b) =>
          rig.bones[b as BoneName].getWorldPosition(new Vector3())
        );
      };
      const first = sample(0);
      const last = sample(clip.duration);
      for (let i = 0; i < first.length; i++) {
        expect(last[i].distanceTo(first[i])).toBeLessThan(0.002);
      }
    });

    it('leaves the rig in its rest pose after building', () => {
      // The sampler poses the real rig to read where the shoulders land.
      // Anything it does not put back is a character stuck mid-climb.
      const rig = createHumanoid({ seed: 5 });
      const before = Object.entries(rig.bones).map(([k, b]) => [k, b.quaternion.clone()] as const);
      const hipsY = rig.bones.Hips.position.y;
      createClimbClip(rig, { rungSpacing: 0.3 });
      for (const [name, q] of before) {
        expect(rig.bones[name as BoneName].quaternion.angleTo(q), name).toBeLessThan(1e-6);
      }
      expect(rig.bones.Hips.position.y).toBe(hipsY);
    });

    it('still takes a bare duration, as it always did', () => {
      const rig = createHumanoid({ seed: 5 });
      expect(createClimbClip(rig, 2.4).duration).toBeCloseTo(2.4, 6);
      expect(createClimbClip(rig, { duration: 2.4 }).duration).toBeCloseTo(2.4, 6);
    });

    it('builds a top-out clip', () => {
      const rig = createHumanoid({ seed: 5 });
      const clip = createTopOutClip(rig);
      expect(clip.duration).toBeGreaterThan(0);
      expect(clip.tracks.length).toBeGreaterThan(4);
    });
  });
});
