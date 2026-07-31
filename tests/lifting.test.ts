import { describe, expect, it } from 'vitest';
import { AnimationMixer, Object3D, Vector3 } from 'three';
import { createHumanoid } from '../src/humanoid';
import { BONE_NAMES } from '../src/humanoid';
import {
  LIFTS,
  LIFT_NAMES,
  Lifting,
  createLiftClip,
  measureBarPath,
  repsInReserve,
  type LiftName,
} from '../src/lifting';

const SEEDS = [1, 5, 12];

describe('the movements', () => {
  it('declares a sane spec for every one', () => {
    for (const name of LIFT_NAMES) {
      const s = LIFTS[name];
      expect(s.eccentric, name).toBeGreaterThan(0);
      expect(s.concentric, name).toBeGreaterThan(0);
      expect(s.oneRepMax, name).toBeGreaterThan(0);
      expect(s.grip, name).toBeGreaterThan(0);
      expect(s.label.length, name).toBeGreaterThan(2);
    }
  });

  it('lowers slower than it lifts, except where the movement is thrown', () => {
    // The whole premise. A kettlebell swing is the one movement here that is
    // caught rather than lowered, and it declares that rather than being
    // quietly exempted.
    for (const name of LIFT_NAMES) {
      const s = LIFTS[name];
      if (s.ballistic) expect(s.eccentric, name).toBeLessThan(s.concentric);
      else expect(s.eccentric, name).toBeGreaterThan(s.concentric * 1.2);
    }
  });
});

describe('the rep budget', () => {
  it('is Epley, and agrees with the table every coach uses', () => {
    // 75% of a maximum is worth ten reps; 85% is worth five.
    expect(repsInReserve(75, 100)).toBeCloseTo(10, 5);
    expect(repsInReserve(85, 100)).toBeCloseTo(5.29, 1);
    expect(repsInReserve(100, 100)).toBeCloseTo(0.6, 5); // clamped: one, and it hurt
  });

  it('gives a heavier bar fewer reps', () => {
    expect(repsInReserve(60, 100)).toBeGreaterThan(repsInReserve(80, 100));
  });
});

describe('a set', () => {
  it('counts its reps and finishes', () => {
    const rig = createHumanoid({ seed: 5 });
    const set = new Lifting(rig, 'squat', { reps: 5, load: 60, fade: 0 });
    const seen: number[] = [];
    set.onRep((r) => seen.push(r.index));
    for (let t = 0; t < 120 && !set.done; t += 1 / 60) set.update(1 / 60);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    expect(set.done).toBe(true);
    expect(set.failed).toBe(false);
  });

  it('can be lost', () => {
    // The difference between an animation and a set: near a maximum, twelve
    // reps is not on offer and the bar stops moving.
    const rig = createHumanoid({ seed: 5 });
    const set = new Lifting(rig, 'squat', {
      reps: 12,
      load: LIFTS.squat.oneRepMax * 0.93,
      fade: 0,
    });
    let failedAt = -1;
    set.onFailure((n) => (failedAt = n));
    for (let t = 0; t < 200 && !set.done; t += 1 / 60) set.update(1 / 60);
    expect(set.failed).toBe(true);
    expect(set.reps).toBeLessThan(12);
    expect(failedAt).toBe(set.reps);
  });

  it('does not fail at a warm-up weight', () => {
    const rig = createHumanoid({ seed: 5 });
    const set = new Lifting(rig, 'squat', { reps: 12, load: 40, fade: 0 });
    for (let t = 0; t < 300 && !set.done; t += 1 / 60) set.update(1 / 60);
    expect(set.failed).toBe(false);
    expect(set.reps).toBe(12);
  });

  it('gets shorter and slower as it goes', () => {
    const rig = createHumanoid({ seed: 5 });
    const set = new Lifting(rig, 'squat', { reps: 8, fade: 0 });
    const reps: Array<{ depth: number; duration: number }> = [];
    set.onRep((r) => reps.push({ depth: r.depth, duration: r.duration }));
    for (let t = 0; t < 200 && !set.done; t += 1 / 60) set.update(1 / 60);
    expect(reps[7].depth).toBeLessThan(reps[0].depth);
    expect(reps[7].duration).toBeGreaterThan(reps[0].duration);
  });

  it('reports reps left, falling to zero', () => {
    const rig = createHumanoid({ seed: 5 });
    const set = new Lifting(rig, 'squat', { reps: 20, load: LIFTS.squat.oneRepMax * 0.85, fade: 0 });
    const start = set.repsLeft;
    expect(start).toBeGreaterThan(4);
    for (let t = 0; t < 300 && !set.done; t += 1 / 60) set.update(1 / 60);
    expect(set.repsLeft).toBeLessThan(start);
    expect(set.repsLeft).toBeLessThanOrEqual(1);
  });
});

describe('the body', () => {
  it('is handed back on release', () => {
    const rig = createHumanoid({ seed: 5 });
    const before = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
    const hips = rig.bones.Hips.position.clone();
    const set = new Lifting(rig, 'deadlift', { fade: 0.2 });
    for (let i = 0; i < 200; i++) set.update(1 / 60);
    set.release();
    for (let i = 0; i < 60; i++) set.update(1 / 60);
    for (const [name, q] of before) {
      expect(rig.bones[name].quaternion.angleTo(q), name).toBeLessThan(1e-6);
    }
    expect(rig.bones.Hips.position.distanceTo(hips)).toBeLessThan(1e-6);
  });

  it('keeps both feet on the floor for every standing lift', () => {
    // The lifting equivalent of `npm run skate`: a lift is not a walk, and the
    // ankles are nailed down for the whole set.
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      for (const name of LIFT_NAMES) {
        if (LIFTS[name].base !== 'feet') continue;
        expect(measureBarPath(rig, name).slip, `seed ${seed} ${name}`).toBeLessThan(0.005);
      }
    }
  });

  it('keeps the hands on the bar', () => {
    const rig = createHumanoid({ seed: 5 });
    for (const name of LIFT_NAMES) {
      expect(measureBarPath(rig, name).gripGap, name).toBeLessThan(0.015);
    }
  });
});

describe('the bar path', () => {
  it('starts over mid-foot and drifts as the set goes', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      for (const name of LIFT_NAMES) {
        if (LIFTS[name].plumb !== 'midfoot') continue;
        const r = measureBarPath(rig, name);
        const at = `seed ${seed} ${name}`;
        expect(r.plumbEarly, at).toBeLessThan(0.002);
        expect(r.plumbDeviation, at).toBeGreaterThan(0.01);
        expect(r.plumbDeviation, at).toBeLessThan(0.05);
      }
    }
  });

  it('leans a back squat further than a front squat, from the same legs', () => {
    // The reason the torso angle is solved and not authored. Both squats hand
    // the legs identical numbers; only the load moved, and the body answered.
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const back = measureBarPath(rig, 'squat').bottomPitch;
      const front = measureBarPath(rig, 'frontSquat').bottomPitch;
      expect(front, `seed ${seed}`).toBeLessThan(back - 0.2);
    }
  });

  it('does not move a pull-up bar', () => {
    const rig = createHumanoid({ seed: 5 });
    const r = measureBarPath(rig, 'pullUp');
    expect(r.plumbDeviation).toBeLessThan(0.008);
    // …and the lifter does all the travelling.
    expect(r.bodyRange).toBeGreaterThan(0.25);
  });
});

describe('the tempo', () => {
  it('is asymmetric in the motion, not just in the spec', () => {
    const rig = createHumanoid({ seed: 5 });
    for (const name of LIFT_NAMES) {
      const r = measureBarPath(rig, name);
      if (LIFTS[name].ballistic) expect(r.tempo, name).toBeLessThan(0.85);
      else expect(r.tempo, name).toBeGreaterThan(1.35);
    }
  });

  it('narrows as control goes', () => {
    // A tiring lifter grinds the push out and drops the bar back, so the two
    // halves converge. Ballistic movements do the same thing mirrored.
    const rig = createHumanoid({ seed: 5 });
    const r = measureBarPath(rig, 'squat');
    expect(r.tempoLate).toBeLessThan(r.tempo);
  });

  it('scales with `tempo` without touching the asymmetry', () => {
    const rig = createHumanoid({ seed: 5 });
    const normal = measureBarPath(rig, 'squat', { reps: 3 });
    const fast = measureBarPath(rig, 'squat', { reps: 3, tempo: 0.5 });
    expect(fast.tempo).toBeCloseTo(normal.tempo, 1);
  });
});

describe('createLiftClip', () => {
  it('builds a loopable clip for every movement', () => {
    const rig = createHumanoid({ seed: 5 });
    for (const name of LIFT_NAMES) {
      const clip = createLiftClip(rig, name);
      expect(clip.duration, name).toBeGreaterThan(0.5);
      expect(clip.tracks.length, name).toBeGreaterThan(10);
    }
  });

  it('leaves the rig where it found it', () => {
    const rig = createHumanoid({ seed: 5 });
    const before = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
    createLiftClip(rig, 'squat');
    for (const [name, q] of before) {
      expect(rig.bones[name].quaternion.angleTo(q), name).toBeLessThan(1e-9);
    }
  });

  it('agrees with the controller about rep one', () => {
    // Two independent routes to the same pose: 30 fps of sampled keyframes
    // through a three.js mixer, and the live solve. If they part company one
    // of them is wrong, and it is the clip that ends up in the crowd.
    for (const name of ['squat', 'curl', 'pullUp'] as LiftName[]) {
      const a = createHumanoid({ seed: 5 });
      const b = createHumanoid({ seed: 5 });
      const clip = createLiftClip(a, name);
      const mixer = new AnimationMixer(a.object);
      mixer.clipAction(clip).play();
      const set = new Lifting(b, name, { fade: 0, reps: 1 });
      const step = clip.duration / 32;
      let worst = 0;
      for (let i = 1; i <= 32; i++) {
        mixer.setTime(i * step);
        a.object.updateWorldMatrix(true, true);
        set.update(step);
        worst = Math.max(
          worst,
          a.bones.LeftHand.getWorldPosition(new Vector3()).distanceTo(
            b.bones.LeftHand.getWorldPosition(new Vector3())
          )
        );
      }
      expect(worst, name).toBeLessThan(0.008);
    }
  });
});

describe('the handshake', () => {
  it('moves anything Holdable-shaped onto the load, every frame', () => {
    // Structural, like the rest of the trilogy: this is a bare Object3D, and a
    // SCENA barbell would be the same thing with a mesh on it.
    const rig = createHumanoid({ seed: 5 });
    const bar = new Object3D();
    const set = new Lifting(rig, 'squat', { fade: 0 });
    set.hold({ object: bar });
    for (let i = 0; i < 40; i++) set.update(1 / 60);
    const where = bar.getWorldPosition(new Vector3());
    expect(where.distanceTo(set.loadPoint(new Vector3()))).toBeLessThan(1e-6);
    // …and it is on the traps rather than at the origin.
    expect(where.y).toBeGreaterThan(0.6);
  });

  it('honours a grip nudge', () => {
    const rig = createHumanoid({ seed: 5 });
    const bar = new Object3D();
    const set = new Lifting(rig, 'squat', { fade: 0 });
    set.hold({ object: bar, grip: { y: 0.05 } });
    set.update(1 / 60);
    expect(bar.getWorldPosition(new Vector3()).y - set.loadPoint(new Vector3()).y).toBeCloseTo(
      0.05,
      6
    );
  });
});
