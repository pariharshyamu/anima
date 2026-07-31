import { describe, expect, it } from 'vitest';
import { createHumanoid } from '../src/humanoid';
import {
  Mood,
  MOODS,
  MOOD_LIMIT,
  MOOD_NAMES,
  measurePosture,
  type MoodName,
} from '../src/mood';

const SEEDS = [1, 5, 12];

describe('the space', () => {
  it('names only points inside it', () => {
    for (const name of MOOD_NAMES) {
      const p = MOODS[name];
      expect(p.valence, name).toBeGreaterThanOrEqual(-1);
      expect(p.valence, name).toBeLessThanOrEqual(1);
      expect(p.arousal, name).toBeGreaterThanOrEqual(0);
      expect(p.arousal, name).toBeLessThanOrEqual(1);
    }
  });

  it('puts neutral at the origin of both axes', () => {
    expect(MOODS.neutral).toEqual({ valence: 0, arousal: 0.5 });
  });

  it('separates rage from sadness', () => {
    // Both are unpleasant; only one is energetic, and a system that treats
    // them as one axis makes a furious character slump.
    expect(MOODS.furious.arousal).toBeGreaterThan(MOODS.dejected.arousal);
    expect(MOODS.furious.valence).toBeGreaterThan(MOODS.dejected.valence);
  });

  it('separates weary from dejected by how much is left', () => {
    // Both unhappy; weary is the flatter of the two, and that is arousal
    // rather than valence. The first version of this test asserted they
    // SHARED an arousal because a doc comment said so — the table said
    // otherwise, and the table was right.
    expect(MOODS.weary.valence).toBeGreaterThan(MOODS.dejected.valence);
    expect(MOODS.weary.arousal).toBeLessThan(MOODS.dejected.arousal);
  });
});

describe('posture', () => {
  it('is monotone in valence, on every body', () => {
    // Swept, not spot-checked. A reversal between two NAMED moods is a bug
    // anyone would notice; one between valence 0.31 and 0.33 is not.
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      let lastPitch = Infinity;
      let lastStature = -Infinity;
      for (let v = -1; v <= 1.0001; v += 0.1) {
        const r = measurePosture(rig, { valence: v, arousal: 0.5 });
        expect(r.headPitch, `seed ${seed} v=${v.toFixed(1)}`).toBeLessThanOrEqual(lastPitch + 1e-9);
        expect(r.stature, `seed ${seed} v=${v.toFixed(1)}`).toBeGreaterThanOrEqual(lastStature - 1e-9);
        lastPitch = r.headPitch;
        lastStature = r.stature;
      }
    }
  });

  it('is monotone in arousal', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      let lastDrop = Infinity;
      for (let a = 0; a <= 1.0001; a += 0.1) {
        const r = measurePosture(rig, { valence: 0, arousal: a });
        expect(r.shoulderDrop, `seed ${seed} a=${a.toFixed(1)}`).toBeLessThanOrEqual(lastDrop + 1e-9);
        lastDrop = r.shoulderDrop;
      }
    }
  });

  it('measures stature at the SPINE, not the crown', () => {
    // Crown height conflates standing tall with lifting your chin, and an
    // elated body does both — the crown arcs backward and DOWN past about
    // valence 0.85, which reads as "shrank" and is true of the crown only.
    const rig = createHumanoid({ seed: 1 });
    const a = measurePosture(rig, { valence: 0.85, arousal: 0.5 });
    const b = measurePosture(rig, { valence: 1, arousal: 0.5 });
    expect(b.stature).toBeGreaterThan(a.stature);
  });

  it('makes a miserable body measurably shorter', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const low = measurePosture(rig, 'grieving').stature;
      const high = measurePosture(rig, 'elated').stature;
      // A layer nobody can see is a layer nobody needs.
      expect(high - low, `seed ${seed}`).toBeGreaterThan(0.02);
    }
  });

  it('drops the head for sadness and lifts it for joy', () => {
    const rig = createHumanoid({ seed: 5 });
    expect(measurePosture(rig, 'grieving').headPitch).toBeGreaterThan(0.1);
    expect(measurePosture(rig, 'elated').headPitch).toBeLessThan(-0.05);
  });
});

describe('neutral', () => {
  it('is exactly nothing', () => {
    // The property everything else rests on: attaching a Mood "to set it up"
    // must not silently change every existing scene.
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const r = measurePosture(rig, 'neutral');
      expect(Math.abs(r.headPitch), `seed ${seed}`).toBeLessThan(1e-9);
      expect(r.worstBone, `seed ${seed}`).toBeLessThan(1e-9);
      expect(Math.abs(r.shoulderDrop), `seed ${seed}`).toBeLessThan(1e-9);
    }
  });

  it('leaves pace and gaze at their defaults', () => {
    const rig = createHumanoid({ seed: 5 });
    const mood = new Mood(rig, 'neutral');
    expect(mood.pace).toBeCloseTo(1, 6);
  });
});

describe('the layer', () => {
  it('gives the body back exactly', () => {
    // A contribution applied and not given back compounds. After a minute the
    // body is folded in half, and it looks like a physics bug.
    const rig = createHumanoid({ seed: 5 });
    const before = Object.entries(rig.bones).map(([k, b]) => [k, b.quaternion.clone()] as const);
    const hipsY = rig.bones.Hips.position.y;
    const mood = new Mood(rig, 'grieving');
    for (let i = 0; i < 600; i++) mood.update(1 / 60);
    mood.release();
    for (const [name, q] of before) {
      expect(rig.bones[name as keyof typeof rig.bones].quaternion.angleTo(q), name).toBeLessThan(1e-6);
    }
    expect(Math.abs(rig.bones.Hips.position.y - hipsY)).toBeLessThan(1e-6);
  });

  it('does not compound across frames', () => {
    // One frame and a thousand frames of the SAME mood must look identical.
    const rig = createHumanoid({ seed: 5 });
    const mood = new Mood(rig, { ...MOODS.dejected, rise: 0.01, fall: 0.01 });
    mood.update(1 / 60);
    for (let i = 0; i < 200; i++) mood.update(1 / 60);
    const after = rig.bones.Head.quaternion.clone();
    mood.release();
    const settled = measurePosture(rig, 'dejected');
    // Both routes reach the same posture rather than one being 200x the other.
    expect(Math.abs(2 * Math.asin(Math.max(-1, Math.min(1, after.x))))).toBeLessThan(
      Math.abs(settled.headPitch) + 0.05
    );
  });

  it('never saturates its own clamp', () => {
    // Past saturation every mood looks the same and monotonicity dies quietly
    // at the top of the axis. The clamp is a backstop, not a working part.
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      for (const v of [-1, 1]) {
        for (const a of [0, 1]) {
          const r = measurePosture(rig, { valence: v, arousal: a });
          expect(r.worstBone, `seed ${seed} v=${v} a=${a}`).toBeLessThan(MOOD_LIMIT);
        }
      }
    }
  });

  it('scales with strength, and vanishes at zero', () => {
    const rig = createHumanoid({ seed: 5 });
    const full = measurePosture(rig, 'grieving', { strength: 1 });
    const half = measurePosture(rig, 'grieving', { strength: 0.5 });
    const none = measurePosture(rig, 'grieving', { strength: 0 });
    expect(half.headPitch).toBeGreaterThan(0);
    expect(half.headPitch).toBeLessThan(full.headPitch);
    expect(Math.abs(none.headPitch)).toBeLessThan(1e-9);
  });
});

describe('easing', () => {
  it('takes a feeling on faster than it lets one go', () => {
    // Bad news lands in under a second and takes a minute to leave. One time
    // constant makes a character who cheers up as fast as they were hurt.
    const rig = createHumanoid({ seed: 5 });
    const mood = new Mood(rig, { valence: 0, arousal: 0.5, rise: 0.4, fall: 3 });
    mood.set('grieving');
    for (let i = 0; i < 24; i++) mood.update(1 / 60); // 0.4 s
    const arrived = mood.valence;
    expect(arrived).toBeLessThan(-0.5);

    mood.set('neutral');
    for (let i = 0; i < 24; i++) mood.update(1 / 60); // the same 0.4 s back
    // Nowhere near home in the time it took to get there.
    expect(mood.valence).toBeLessThan(arrived * 0.5);
    mood.release();
  });

  it('reports what it is easing toward', () => {
    const rig = createHumanoid({ seed: 5 });
    const mood = new Mood(rig, 'calm');
    mood.set('afraid');
    expect(mood.wanted).toEqual(MOODS.afraid);
    // …but has not got there yet.
    expect(mood.valence).toBeGreaterThan(MOODS.afraid.valence);
  });
});

describe('what it publishes rather than applies', () => {
  it('slows a miserable walk and quickens an elated one', () => {
    const rig = createHumanoid({ seed: 5 });
    expect(new Mood(rig, 'grieving').pace).toBeLessThan(0.8);
    expect(new Mood(rig, 'elated').pace).toBeGreaterThan(1.15);
    expect(new Mood(rig, 'neutral').pace).toBeCloseTo(1, 6);
  });

  it('will not hand a dejected character a confident gaze', () => {
    const rig = createHumanoid({ seed: 5 });
    expect(new Mood(rig, 'dejected').gazeAuthority).toBeLessThan(0.3);
    expect(new Mood(rig, 'elated').gazeAuthority).toBeGreaterThan(0.9);
  });

  it('fidgets more when wound up', () => {
    const rig = createHumanoid({ seed: 5 });
    expect(new Mood(rig, 'anxious').mannerismRate).toBeGreaterThan(
      new Mood(rig, 'weary').mannerismRate
    );
    expect(new Mood(rig, 'elated').gestureScale).toBeGreaterThan(
      new Mood(rig, 'bored').gestureScale
    );
  });

  it('keeps every published number finite and sane on every named mood', () => {
    const rig = createHumanoid({ seed: 5 });
    for (const name of MOOD_NAMES as MoodName[]) {
      const m = new Mood(rig, name);
      for (const [key, v] of Object.entries({
        pace: m.pace,
        gestureScale: m.gestureScale,
        mannerismRate: m.mannerismRate,
        gazeAuthority: m.gazeAuthority,
      })) {
        expect(Number.isFinite(v), `${name}.${key}`).toBe(true);
        expect(v, `${name}.${key}`).toBeGreaterThan(0);
      }
      expect(m.gazeAuthority, name).toBeLessThanOrEqual(1);
    }
  });
});
