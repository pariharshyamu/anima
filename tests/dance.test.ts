import { describe, it, expect } from 'vitest';
import { createHumanoid, Dance, DANCE_MOVES, type DancePulse } from '../src';

const still: DancePulse = { bass: 0, mid: 0, treble: 0, beat: false, bpm: 0 };
const pulseAt = (bass: number, beat = false, bpm = 120): DancePulse => ({
  bass,
  mid: 0.4,
  treble: 0.3,
  beat,
  bpm,
});

/** Drive at 60 fps with a metronome pulse at `bpm`. */
const groove = (d: Dance, seconds: number, bpm = 120): void => {
  const spb = 60 / bpm;
  let sinceBeat = 0;
  for (let i = 0; i < seconds * 60; i++) {
    sinceBeat += 1 / 60;
    const beat = sinceBeat >= spb;
    if (beat) sinceBeat -= spb;
    d.update(1 / 60, pulseAt(beat ? 1 : 0.3, beat, bpm));
  }
};

const boneAngle = (rig: ReturnType<typeof createHumanoid>, bone: 'Chest' | 'LeftArm'): number => {
  const q = rig.bones[bone].quaternion;
  return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
};

describe('starting and stopping', () => {
  it('does nothing until started', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig);
    expect(d.dancing).toBe(false);
    const before = rig.bones.LeftArm.quaternion.clone();
    d.update(1 / 60, pulseAt(1, true));
    expect(rig.bones.LeftArm.quaternion.equals(before)).toBe(true);
  });

  it('started, the body actually moves', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig);
    d.start('bounce');
    groove(d, 2);
    // The arms hang and swing rather than standing in a T.
    expect(boneAngle(rig, 'LeftArm')).toBeGreaterThan(0.5);
    expect(d.dancing).toBe(true);
  });

  it('the hips bob — dancing happens in the knees', () => {
    const rig = createHumanoid({ seed: 4 });
    const base = rig.bones.Hips.position.y;
    const d = new Dance(rig);
    d.start('bounce');
    const heights: number[] = [];
    const spb = 60 / 120;
    let since = 0;
    for (let i = 0; i < 240; i++) {
      since += 1 / 60;
      const beat = since >= spb;
      if (beat) since -= spb;
      d.update(1 / 60, pulseAt(beat ? 1 : 0.3, beat));
      heights.push(rig.bones.Hips.position.y);
    }
    expect(Math.min(...heights)).toBeLessThan(base - 0.01);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.015);
  });

  it('stop() eases the body back to the pose it started from', () => {
    const rig = createHumanoid({ seed: 4 });
    const entryArm = rig.bones.LeftArm.quaternion.clone();
    const entryHips = rig.bones.Hips.position.y;
    const d = new Dance(rig);
    d.start('raiseTheRoof');
    groove(d, 2);
    d.stop();
    groove(d, 2);
    expect(rig.bones.LeftArm.quaternion.angleTo(entryArm)).toBeLessThan(0.02);
    expect(Math.abs(rig.bones.Hips.position.y - entryHips)).toBeLessThan(0.005);
    expect(d.dancing).toBe(false);
  });

  it('ease-in is gradual, not a teleport', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig);
    d.start('raiseTheRoof');
    d.update(1 / 60, pulseAt(1, true));
    const early = boneAngle(rig, 'LeftArm');
    groove(d, 1.5);
    expect(early).toBeLessThan(boneAngle(rig, 'LeftArm') * 0.6);
  });
});

describe('the beat clock', () => {
  it('advances at the pulse tempo', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { bpm: 120 });
    d.start();
    groove(d, 10, 120);
    // Ten seconds at 120 BPM is twenty beats = five bars.
    expect(d.bar).toBeGreaterThanOrEqual(4);
    expect(d.bar).toBeLessThanOrEqual(6);
  });

  it('free-runs when the music stops — the floor keeps dancing', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { bpm: 120 });
    d.start('bounce');
    groove(d, 2);
    const barBefore = d.bar;
    // The stream is gone: no pulse at all for eight seconds.
    for (let i = 0; i < 8 * 60; i++) d.update(1 / 60);
    expect(d.bar).toBeGreaterThan(barBefore + 2);
    expect(boneAngle(rig, 'LeftArm')).toBeGreaterThan(0.3);
  });

  it('a beat nudges the phase rather than snapping it', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { bpm: 120 });
    d.start();
    d.update(1 / 60, still);
    // Force the clock badly out of phase, then land one beat.
    d.phase = 0.4;
    d.update(1 / 60, pulseAt(1, true));
    // Pulled toward the kick, but nowhere near all the way.
    expect(d.phase).toBeLessThan(0.35);
    expect(d.phase).toBeGreaterThan(0.15);
  });

  it('repeated beats converge the phase onto the kick', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { bpm: 120 });
    d.start();
    d.phase = 0.45;
    // A metronome at exactly the free-run tempo: only the nudges move phase.
    for (let beat = 0; beat < 12; beat++) {
      d.update(1 / 60, pulseAt(1, true, 120));
      for (let i = 0; i < 29; i++) d.update(1 / 60, pulseAt(0.3, false, 120));
    }
    const err = d.phase % 1;
    expect(Math.min(err, 1 - err)).toBeLessThan(0.1);
  });

  it('an absurd bpm reading is ignored', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { bpm: 120 });
    d.start();
    d.update(1 / 60, pulseAt(0.5, false, 1900));
    const barsBefore = d.bar;
    for (let i = 0; i < 4 * 60; i++) d.update(1 / 60);
    // Four seconds at 120 (not 1900) is two bars.
    expect(d.bar - barsBefore).toBeLessThanOrEqual(3);
  });
});

describe('energy', () => {
  it('follows the bass', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig);
    d.start();
    for (let i = 0; i < 120; i++) d.update(1 / 60, pulseAt(1));
    const loud = d.energy;
    for (let i = 0; i < 240; i++) d.update(1 / 60, pulseAt(0.02));
    expect(loud).toBeGreaterThan(0.7);
    expect(d.energy).toBeLessThan(0.45);
  });

  it('a quiet bar is the same move at a smaller size', () => {
    const loudRig = createHumanoid({ seed: 4 });
    const quietRig = createHumanoid({ seed: 4 });
    const loud = new Dance(loudRig, { seed: 2 });
    const quiet = new Dance(quietRig, { seed: 2 });
    loud.start('headBang');
    quiet.start('headBang');
    loud.use('headBang');
    quiet.use('headBang');
    for (let i = 0; i < 240; i++) {
      loud.update(1 / 60, pulseAt(i % 30 === 0 ? 1 : 0.9, i % 30 === 0));
      quiet.update(1 / 60, pulseAt(i % 30 === 0 ? 0.15 : 0.1, i % 30 === 0));
    }
    const bend = (rig: typeof loudRig) => {
      const q = rig.bones.Chest.quaternion;
      return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    };
    expect(bend(loudRig)).toBeGreaterThan(bend(quietRig) * 1.5);
  });
});

describe('skills', () => {
  it('there are various, and use() picks one and holds it', () => {
    expect(DANCE_MOVES.length).toBeGreaterThanOrEqual(6);
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig);
    d.start();
    d.use('robot');
    expect(d.move).toBe('robot');
    expect(d.auto).toBe(false);
    groove(d, 40);
    expect(d.move).toBe('robot');
  });

  it('auto works the repertoire: a new skill every N bars, never the same one', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 7, barsPerMove: 2 });
    d.start();
    const seen = new Set<string>([d.move]);
    let lastMove = d.move;
    let changes = 0;
    for (let s = 0; s < 60; s++) {
      groove(d, 1);
      if (d.move !== lastMove) {
        changes++;
        lastMove = d.move;
      }
      seen.add(d.move);
    }
    // 60 s at 120 BPM = 30 bars = ~15 changes at 2 bars per move.
    expect(changes).toBeGreaterThan(8);
    expect(seen.size).toBeGreaterThan(3);
  });

  it('every skill moves the body and leaves it recoverable', () => {
    for (const move of DANCE_MOVES) {
      const rig = createHumanoid({ seed: 4 });
      const entry = rig.bones.RightForeArm.quaternion.clone();
      const d = new Dance(rig, { seed: 3 });
      d.start(move);
      groove(d, 2);
      let moved = 0;
      const spb = 0.5;
      let since = 0;
      for (let i = 0; i < 120; i++) {
        since += 1 / 60;
        const beat = since >= spb;
        if (beat) since -= spb;
        d.update(1 / 60, pulseAt(beat ? 1 : 0.4, beat));
        moved = Math.max(moved, rig.bones.RightForeArm.quaternion.angleTo(entry));
      }
      expect(moved, move).toBeGreaterThan(0.2);
      d.stop();
      groove(d, 2);
      expect(rig.bones.RightForeArm.quaternion.angleTo(entry), move).toBeLessThan(0.02);
    }
  });

  it('start(move) is use(move) plus start', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig);
    d.start('clap');
    expect(d.move).toBe('clap');
    expect(d.dancing).toBe(true);
  });
});

describe('a crowd, not a chorus line', () => {
  it('same seed, same dance', () => {
    const a = createHumanoid({ seed: 4 });
    const b = createHumanoid({ seed: 4 });
    const da = new Dance(a, { seed: 5 });
    const db = new Dance(b, { seed: 5 });
    da.start();
    db.start();
    groove(da, 5);
    groove(db, 5);
    expect(a.bones.Head.quaternion.angleTo(b.bones.Head.quaternion)).toBeLessThan(1e-6);
    expect(da.move).toBe(db.move);
  });

  it('different seeds: together, but not in lockstep', () => {
    const a = createHumanoid({ seed: 4 });
    const b = createHumanoid({ seed: 4 });
    const da = new Dance(a, { seed: 5 });
    const db = new Dance(b, { seed: 91 });
    da.start('bounce');
    db.start('bounce');
    da.use('bounce');
    db.use('bounce');
    let apart = 0;
    const spb = 0.5;
    let since = 0;
    for (let i = 0; i < 300; i++) {
      since += 1 / 60;
      const beat = since >= spb;
      if (beat) since -= spb;
      const p = pulseAt(beat ? 1 : 0.3, beat);
      da.update(1 / 60, p);
      db.update(1 / 60, p);
      apart = Math.max(apart, Math.abs(a.bones.Hips.position.y - b.bones.Hips.position.y));
    }
    // Same move, same music — and their knees are never quite together.
    expect(apart).toBeGreaterThan(0.002);
  });
});

describe('styles: the count is not the beat', () => {
  const styled = (style: 'salsa' | 'waltz' | 'bhangra', seconds = 4, bpm = 120) => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm });
    d.setStyle(style);
    d.start();
    groove(d, seconds, bpm);
    return { rig, d };
  };

  it('club is the default and the styles are listed', async () => {
    const { DANCE_STYLES } = await import('../src');
    const rig = createHumanoid({ seed: 4 });
    expect(new Dance(rig).style).toBe('club');
    expect(DANCE_STYLES.slice(0, 4)).toEqual(['club', 'salsa', 'waltz', 'bhangra']);
  });

  it('a waltz has three beats to the bar and there is no arguing with it', () => {
    const { d } = styled('waltz', 10);
    // Ten seconds at 120 = 20 beats = 6.67 three-beat bars (4/4 would say 5).
    expect(d.meter).toBe(3);
    expect(d.bar).toBeGreaterThanOrEqual(6);
    expect(d.bar).toBeLessThanOrEqual(7);
  });

  it('salsa counts to eight and wraps', () => {
    const { d } = styled('salsa', 3.9);
    expect(d.meter).toBe(4);
    const seen = new Set<number>();
    const rig2 = createHumanoid({ seed: 4 });
    const d2 = new Dance(rig2, { seed: 3, bpm: 120 });
    d2.setStyle('salsa');
    d2.start();
    for (let i = 0; i < 8 * 60; i++) {
      d2.update(1 / 60, pulseAt(0.6, false, 120));
      seen.add(d2.count);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    void d;
  });

  it('salsa steps travel and come home — the feet, not just the knees', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('salsa');
    d.start();
    groove(d, 2);
    const zs: number[] = [];
    const spb = 0.5;
    let since = 0;
    for (let i = 0; i < 8 * 60; i++) {
      since += 1 / 60;
      const beat = since >= spb;
      if (beat) since -= spb;
      d.update(1 / 60, pulseAt(beat ? 1 : 0.4, beat, 120));
      zs.push(rig.bones.Hips.position.z);
    }
    // The body genuinely travels forward AND back across the cycle…
    expect(Math.max(...zs)).toBeGreaterThan(0.02);
    expect(Math.min(...zs)).toBeLessThan(-0.02);
    // …and the average stays at home: travel-and-return, not drift.
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    expect(Math.abs(mean)).toBeLessThan(0.03);
  });

  it('the hold is a hold: nothing new is stepped on the 4 and the 8', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('salsa');
    d.start();
    // Advance to just after a hold count begins and freeze the chart state,
    // then compare the feet across the whole held count: no new commitment.
    groove(d, 4);
    let holdDrift = 0;
    let stepDrift = 0;
    let prevL = rig.bones.LeftUpLeg.quaternion.clone();
    for (let i = 0; i < 4 * 60; i++) {
      d.update(1 / 60, pulseAt(0.5, false, 120));
      const drift = rig.bones.LeftUpLeg.quaternion.angleTo(prevL);
      prevL = rig.bones.LeftUpLeg.quaternion.clone();
      if (d.count === 3 || d.count === 7) holdDrift = Math.max(holdDrift, drift);
      if (d.count === 0 || d.count === 4) stepDrift = Math.max(stepDrift, drift);
    }
    // The legs keep settling through a hold, but the big commitments happen
    // on the breaks.
    expect(stepDrift).toBeGreaterThan(holdDrift * 1.5);
  });

  it('Cuban motion: the hips answer the weight late, and only in salsa', () => {
    const roll = (style: 'salsa' | 'waltz') => {
      const rig = createHumanoid({ seed: 4 });
      const d = new Dance(rig, { seed: 3, bpm: 120 });
      d.setStyle(style);
      d.start();
      groove(d, 2);
      let peak = 0;
      const spb = 0.5;
      let since = 0;
      for (let i = 0; i < 6 * 60; i++) {
        since += 1 / 60;
        const beat = since >= spb;
        if (beat) since -= spb;
        d.update(1 / 60, pulseAt(beat ? 1 : 0.4, beat, 120));
        const q = rig.bones.Hips.quaternion;
        // z-roll magnitude, roughly.
        peak = Math.max(peak, Math.abs(2 * Math.asin(Math.max(-1, Math.min(1, q.z)))));
      }
      return peak;
    };
    expect(roll('salsa')).toBeGreaterThan(roll('waltz') * 1.8);
  });

  it('the waltz rises and falls inside every bar', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('waltz');
    d.start();
    groove(d, 4);
    const byCount: number[][] = [[], [], []];
    for (let i = 0; i < 6 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      byCount[d.count % 3].push(rig.bones.Hips.position.y);
    }
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    // Down into the one, up through the two and three.
    expect(avg(byCount[0])).toBeLessThan(avg(byCount[2]));
  });

  it('the waltz frame holds: arms carried, not hanging', () => {
    const { rig } = styled('waltz', 3);
    const angle = (b: 'LeftArm' | 'RightArm') => {
      const q = rig.bones[b].quaternion;
      return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    };
    // Carried well away from vertical hang (~1.43 rad) AND away from T (0).
    expect(angle('LeftArm')).toBeGreaterThan(0.3);
    expect(angle('LeftArm')).toBeLessThan(1.2);
  });

  it('bhangra spends the back half of the cycle with both arms up', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('bhangra');
    d.start();
    groove(d, 2);
    let upBoth = 0;
    let samples = 0;
    for (let i = 0; i < 8 * 60; i++) {
      d.update(1 / 60, pulseAt(0.8, i % 30 === 0, 120));
      if (d.count >= 4) {
        samples++;
        const l = rig.bones.LeftArm.quaternion;
        const r = rig.bones.RightArm.quaternion;
        const la = 2 * Math.acos(Math.min(1, Math.abs(l.w)));
        const ra = 2 * Math.acos(Math.min(1, Math.abs(r.w)));
        if (la > 1.8 && ra > 1.8) upBoth++;
      }
    }
    expect(upBoth / Math.max(1, samples)).toBeGreaterThan(0.7);
  });

  it('setStyle mid-dance resets the figure cleanly', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('salsa');
    d.start();
    groove(d, 3);
    d.setStyle('waltz');
    expect(d.style).toBe('waltz');
    expect(d.meter).toBe(3);
    groove(d, 3);
    // Still recoverable after the switch.
    d.stop();
    groove(d, 2);
    expect(Math.abs(rig.bones.Hips.position.x)).toBeLessThan(0.01);
    expect(Math.abs(rig.bones.Hips.position.z)).toBeLessThan(0.01);
  });

  it('stop() brings a travelled dancer all the way home', () => {
    const rig = createHumanoid({ seed: 4 });
    const home = rig.bones.Hips.position.clone();
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('salsa');
    d.start();
    groove(d, 3.3); // mid-figure, deliberately away from home
    d.stop();
    groove(d, 2);
    expect(Math.abs(rig.bones.Hips.position.x - home.x)).toBeLessThan(0.005);
    expect(Math.abs(rig.bones.Hips.position.z - home.z)).toBeLessThan(0.005);
    expect(Math.abs(rig.bones.Hips.position.y - home.y)).toBeLessThan(0.005);
  });

  it('styles are deterministic too: same seed, same figure', () => {
    const a = createHumanoid({ seed: 4 });
    const b = createHumanoid({ seed: 4 });
    const da = new Dance(a, { seed: 6 });
    const db = new Dance(b, { seed: 6 });
    da.setStyle('salsa');
    db.setStyle('salsa');
    da.start();
    db.start();
    groove(da, 5);
    groove(db, 5);
    expect(a.bones.Hips.position.distanceTo(b.bones.Hips.position)).toBeLessThan(1e-9);
    expect(a.bones.LeftUpLeg.quaternion.angleTo(b.bones.LeftUpLeg.quaternion)).toBeLessThan(1e-9);
  });
});

describe('street: the hit and the freeze', () => {
  const drive = (style: 'popping' | 'locking' | 'waving' | 'tutting' | 'toprock', warm = 3) => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle(style);
    d.start();
    groove(d, warm);
    return { rig, d };
  };

  it('the street styles are on the list', async () => {
    const { DANCE_STYLES } = await import('../src');
    for (const s of ['popping', 'locking', 'waving', 'tutting', 'toprock']) {
      expect(DANCE_STYLES).toContain(s);
    }
  });

  it('popping: the pose changes in the first tenth of the count and then holds', () => {
    const { rig, d } = drive('popping');
    let nearCount = 0;
    let midCount = 0;
    let prev = rig.bones.RightForeArm.quaternion.clone();
    for (let i = 0; i < 6 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const f = d.phase % 1;
      // The dancer's own clock leads the raw phase by their flair lag, so
      // bucket by distance to the NEAREST count, not by the raw fraction.
      const toCount = Math.min(f, 1 - f);
      const step = rig.bones.RightForeArm.quaternion.angleTo(prev);
      prev = rig.bones.RightForeArm.quaternion.clone();
      if (toCount < 0.2) nearCount = Math.max(nearCount, step);
      else if (toCount > 0.35) midCount = Math.max(midCount, step);
    }
    // The dime stop: motion lives at the top of the count, stillness after.
    expect(nearCount).toBeGreaterThan(midCount * 4);
    expect(midCount).toBeLessThan(0.02);
  });

  it('popping draws a different pose every count', () => {
    const { rig, d } = drive('popping');
    const poses: number[] = [];
    let lastCount = -1;
    for (let i = 0; i < 8 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const f = d.phase % 1;
      const c = Math.floor(d.phase % 4);
      if (c !== lastCount && f > 0.5) {
        lastCount = c;
        const q = rig.bones.LeftForeArm.quaternion;
        poses.push(Math.round((2 * Math.acos(Math.min(1, Math.abs(q.w)))) * 100));
      }
    }
    expect(new Set(poses).size).toBeGreaterThan(Math.min(4, poses.length) - 1);
  });

  it('locking: the freeze is a freeze — a count and a half of zero motion', () => {
    const { rig, d } = drive('locking');
    let freezeDrift = 0;
    let windupDrift = 0;
    let prev = rig.bones.LeftForeArm.quaternion.clone();
    for (let i = 0; i < 8 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const c = ((d.phase % 4) + 4) % 4;
      const step = rig.bones.LeftForeArm.quaternion.angleTo(prev);
      prev = rig.bones.LeftForeArm.quaternion.clone();
      if (c > 2.2 && c < 3.4) freezeDrift = Math.max(freezeDrift, step);
      if (c > 0.1 && c < 0.9) windupDrift = Math.max(windupDrift, step);
    }
    expect(freezeDrift).toBeLessThan(1e-6);
    expect(windupDrift).toBeGreaterThan(0.01);
  });

  it('waving: the wave reaches the right hand after the left', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('waving');
    d.start();
    groove(d, 3);
    // Track when each forearm peaks within one full wave (2 counts).
    let lPeakAt = 0;
    let rPeakAt = 0;
    let lMax = -Infinity;
    let rMax = -Infinity;
    for (let i = 0; i < 2 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const t = i / 60;
      const lx = rig.bones.LeftForeArm.quaternion.x;
      const rx = rig.bones.RightForeArm.quaternion.x;
      if (lx > lMax) { lMax = lx; lPeakAt = t; }
      if (rx > rMax) { rMax = rx; rPeakAt = t; }
    }
    // A fixed propagation delay, hand to hand — not simultaneous, not a bar.
    const delay = ((rPeakAt - lPeakAt) % 1 + 1) % 1;
    expect(delay).toBeGreaterThan(0.1);
    expect(delay).toBeLessThan(0.95);
  });

  it('tutting snaps between held right-angle frames on the half-count', () => {
    const { rig, d } = drive('tutting');
    let still = 0;
    let total = 0;
    let prev = rig.bones.RightForeArm.quaternion.clone();
    for (let i = 0; i < 6 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const step = rig.bones.RightForeArm.quaternion.angleTo(prev);
      prev = rig.bones.RightForeArm.quaternion.clone();
      total++;
      if (step < 1e-4) still++;
    }
    // Most of tutting is the stillness between snaps.
    expect(still / total).toBeGreaterThan(0.5);
  });

  it('toprock travels on the step engine and comes home', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('toprock');
    d.start();
    groove(d, 2);
    const zs: number[] = [];
    for (let i = 0; i < 8 * 60; i++) {
      d.update(1 / 60, pulseAt(0.8, i % 30 === 0, 120));
      zs.push(rig.bones.Hips.position.z);
    }
    expect(Math.max(...zs)).toBeGreaterThan(0.02);
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    expect(Math.abs(mean)).toBeLessThan(Math.max(...zs));
  });

  it('every street style still stops clean', () => {
    for (const style of ['popping', 'locking', 'waving', 'tutting', 'toprock'] as const) {
      const rig = createHumanoid({ seed: 4 });
      const entry = rig.bones.RightForeArm.quaternion.clone();
      const d = new Dance(rig, { seed: 3, bpm: 120 });
      d.setStyle(style);
      d.start();
      groove(d, 2.7);
      d.stop();
      groove(d, 2);
      expect(rig.bones.RightForeArm.quaternion.angleTo(entry), style).toBeLessThan(0.02);
      expect(Math.abs(rig.bones.Hips.position.x), style).toBeLessThan(0.01);
    }
  });
});
