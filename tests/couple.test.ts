import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { createHumanoid, Couple, type DancePulse } from '../src';

const pulseAt = (bass: number, beat = false, bpm = 120): DancePulse => ({
  bass,
  mid: 0.4,
  treble: 0.3,
  beat,
  bpm,
});

const makeCouple = (style: 'salsa' | 'waltz' = 'waltz', seed = 5) => {
  const leader = createHumanoid({ seed: 4 });
  const follower = createHumanoid({ seed: 9 });
  const couple = new Couple(leader, follower, { style, seed, bpm: 120 });
  couple.place(0, 0, 0);
  couple.start();
  return { leader, follower, couple };
};

const groove = (c: Couple, seconds: number, bpm = 120): void => {
  const spb = 60 / bpm;
  let since = 0;
  for (let i = 0; i < seconds * 60; i++) {
    since += 1 / 60;
    const beat = since >= spb;
    if (beat) since -= spb;
    c.update(1 / 60, pulseAt(beat ? 1 : 0.3, beat, bpm));
  }
};

describe('the couple', () => {
  it('places the pair face to face across the embrace', () => {
    const { leader, follower } = makeCouple();
    const gap = leader.object.position.distanceTo(follower.object.position);
    expect(gap).toBeCloseTo(0.85, 1);
    expect(Math.abs(follower.object.rotation.y - leader.object.rotation.y)).toBeCloseTo(Math.PI, 3);
  });

  it('the follower keeps the LEADER\'S time, half a cycle out and a lag late', () => {
    const { couple } = makeCouple('waltz');
    groove(couple, 4);
    const rel = couple.leader.phase - couple.follower.phase;
    // Half of six counts, plus a tenth of a second at 120 BPM (0.2 counts).
    expect(rel).toBeCloseTo(3 + 0.2, 1);
    const salsa = makeCouple('salsa');
    groove(salsa.couple, 4);
    expect(salsa.couple.leader.phase - salsa.couple.follower.phase).toBeCloseTo(4 + 0.2, 1);
  });

  it('the connection outranks the music: beats never desynchronise the pair', () => {
    const { couple } = makeCouple('waltz');
    // Hammer the couple with off-grid beats; the leader nudges, and the
    // follower must track the LEADER, not the beats.
    for (let i = 0; i < 6 * 60; i++) {
      couple.update(1 / 60, pulseAt(0.8, i % 17 === 0, 120));
    }
    const rel = couple.leader.phase - couple.follower.phase;
    expect(rel).toBeCloseTo(3.2, 1);
  });

  it('THE HANDS MEET, and stay met through the figures', () => {
    for (const style of ['waltz', 'salsa'] as const) {
      const { couple } = makeCouple(style);
      groove(couple, 2); // ease in
      let worst = 0;
      const spb = 0.5;
      let since = 0;
      for (let i = 0; i < 8 * 60; i++) {
        since += 1 / 60;
        const beat = since >= spb;
        if (beat) since -= spb;
        couple.update(1 / 60, pulseAt(beat ? 1 : 0.4, beat, 120));
        worst = Math.max(worst, couple.handGap());
      }
      // A hand's breadth, through eight seconds of breaks and boxes.
      expect(worst, style).toBeLessThan(0.16);
    }
  });

  it('the natural opposite: the couple travels the same world direction', () => {
    const { leader, follower, couple } = makeCouple('salsa');
    groove(couple, 2);
    let agree = 0;
    let total = 0;
    const lp = new Vector3();
    const fp = new Vector3();
    let lastL = null as number | null;
    let lastF = null as number | null;
    for (let i = 0; i < 8 * 60; i++) {
      couple.update(1 / 60, pulseAt(0.7, false, 120));
      leader.object.updateWorldMatrix(true, true);
      follower.object.updateWorldMatrix(true, true);
      leader.bones.Hips.getWorldPosition(lp);
      follower.bones.Hips.getWorldPosition(fp);
      if (lastL !== null && lastF !== null) {
        const dl = lp.z - lastL;
        const df = fp.z - lastF;
        if (Math.abs(dl) > 1e-5 && Math.abs(df) > 1e-5) {
          total++;
          if (Math.sign(dl) === Math.sign(df)) agree++;
        }
      }
      lastL = lp.z;
      lastF = fp.z;
    }
    // Facing each other, his forward break and her back break are the same
    // direction across the floor. Most of the time, they move together.
    expect(agree / Math.max(1, total)).toBeGreaterThan(0.6);
  });

  it('stops clean: both partners come home', () => {
    const { leader, follower, couple } = makeCouple('waltz');
    const lHome = leader.bones.Hips.position.clone();
    const fHome = follower.bones.Hips.position.clone();
    groove(couple, 3.3);
    couple.stop();
    groove(couple, 2);
    expect(Math.abs(leader.bones.Hips.position.z - lHome.z)).toBeLessThan(0.01);
    expect(Math.abs(follower.bones.Hips.position.z - fHome.z)).toBeLessThan(0.01);
    expect(couple.dancing).toBe(false);
  });

  it('free-runs without music, together', () => {
    const { couple } = makeCouple('waltz');
    groove(couple, 2);
    for (let i = 0; i < 4 * 60; i++) couple.update(1 / 60);
    const rel = couple.leader.phase - couple.follower.phase;
    expect(rel).toBeCloseTo(3.2, 1);
    expect(couple.handGap()).toBeLessThan(0.16);
  });

  it('is deterministic: the same seeds dance the same dance', () => {
    const a = makeCouple('waltz', 7);
    const b = makeCouple('waltz', 7);
    groove(a.couple, 5);
    groove(b.couple, 5);
    expect(
      a.leader.bones.Hips.position.distanceTo(b.leader.bones.Hips.position)
    ).toBeLessThan(1e-9);
    expect(a.couple.handGap()).toBeCloseTo(b.couple.handGap(), 6);
  });
});
