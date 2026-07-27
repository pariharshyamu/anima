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

describe('the two classicals', () => {
  const classical = (style: 'ballet' | 'bharatanatyam', warm = 2) => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle(style);
    d.start();
    groove(d, warm);
    return { rig, d };
  };

  it('both are on the list, and a ballet bar has three beats', () => {
    const { d } = classical('ballet');
    expect(d.meter).toBe(3);
    const { d: b } = classical('bharatanatyam');
    expect(b.meter).toBe(4);
  });

  it('araimandi is HELD: the hips never come up', () => {
    const rig = createHumanoid({ seed: 4 });
    const base = rig.bones.Hips.position.y;
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('bharatanatyam');
    d.start();
    groove(d, 2);
    let highest = -Infinity;
    for (let i = 0; i < 8 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      highest = Math.max(highest, rig.bones.Hips.position.y);
    }
    // The half-sit is a POSTURE, not a moment: even its highest point is
    // well below standing.
    expect(highest).toBeLessThan(base - 0.05);
  });

  it('the stamps land on the subdivisions and fire onStamp', () => {
    const { d } = classical('bharatanatyam', 0.5);
    const at: number[] = [];
    d.onStamp(() => at.push(((d.phase % 8) + 8) % 8));
    // Exactly one full cycle at 120 BPM: 8 counts = 4 seconds.
    for (let i = 0; i < 4 * 60; i++) d.update(1 / 60, pulseAt(0.7, false, 120));
    // The adavu has 11 strikes per cycle, and some are OFF the counts.
    expect(at.length).toBeGreaterThanOrEqual(10);
    expect(at.length).toBeLessThanOrEqual(12);
    const fractional = at.filter((t) => {
      const f = t % 1;
      return f > 0.2 && f < 0.8;
    });
    expect(fractional.length).toBeGreaterThanOrEqual(3);
  });

  it('a stamp moves the leg that stamps', () => {
    const { rig, d } = classical('bharatanatyam');
    let calm = Infinity;
    let strike = 0;
    let sinceStamp = 10;
    d.onStamp(() => { sinceStamp = 0; });
    let prev = rig.bones.LeftLeg.quaternion.clone();
    for (let i = 0; i < 6 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      sinceStamp += 1 / 60;
      const step = rig.bones.LeftLeg.quaternion.angleTo(prev);
      prev = rig.bones.LeftLeg.quaternion.clone();
      if (sinceStamp < 0.1) strike = Math.max(strike, step);
      if (sinceStamp > 0.3) calm = Math.min(calm, step);
    }
    expect(strike).toBeGreaterThan(0.01);
    expect(calm).toBeLessThan(strike);
  });

  it('onStamp unsubscribes, and club dancers never stamp', () => {
    const { d } = classical('bharatanatyam', 0.5);
    let n = 0;
    const off = d.onStamp(() => n++);
    groove(d, 2);
    const seen = n;
    expect(seen).toBeGreaterThan(0);
    off();
    groove(d, 2);
    expect(n).toBe(seen);

    const rig2 = createHumanoid({ seed: 5 });
    const club = new Dance(rig2, { seed: 3 });
    club.start();
    let clubStamps = 0;
    club.onStamp(() => clubStamps++);
    groove(club, 4);
    expect(clubStamps).toBe(0);
  });

  it('the pirouette turns the whole body through a revolution', () => {
    const { rig, d } = classical('ballet');
    let maxYaw = 0;
    for (let i = 0; i < 24 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const q = rig.bones.Hips.quaternion;
      // Yaw magnitude from the quaternion's y component (turnout is small).
      maxYaw = Math.max(maxYaw, 2 * Math.asin(Math.min(1, Math.abs(q.y))));
    }
    // Passes through the half-revolution mark (2π wraps back through 0).
    expect(maxYaw).toBeGreaterThan(2.6);
  });

  it('the head spots: one whip per revolution, faster than anything else ballet does', () => {
    const { rig, d } = classical('ballet');
    let inTurn = 0;
    let elsewhere = 0;
    let prev = rig.bones.Head.quaternion.clone();
    for (let i = 0; i < 24 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const c = ((d.phase % 12) + 12) % 12;
      const step = rig.bones.Head.quaternion.angleTo(prev);
      prev = rig.bones.Head.quaternion.clone();
      if (c > 9 && c < 11) inTurn = Math.max(inTurn, step);
      if (c > 1 && c < 8) elsewhere = Math.max(elsewhere, step);
    }
    expect(inTurn).toBeGreaterThan(elsewhere * 3);
  });

  it('ballet leads the count — anticipation, not correction', () => {
    // Drive two dancers identically; the ballet clock evaluates AHEAD, so at
    // the moment a count arrives ballet is already partway into that count's
    // shape. Cheapest observable: at raw phase just below an integer, the
    // ballet pirouette (which its own clock places at 9+) has already begun.
    const { rig, d } = classical('ballet');
    let turnedEarly = false;
    for (let i = 0; i < 24 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const c = ((d.phase % 12) + 12) % 12;
      const q = rig.bones.Hips.quaternion;
      const yaw = 2 * Math.asin(Math.min(1, Math.abs(q.y)));
      if (c > 8.75 && c < 9 && yaw > 0.15) turnedEarly = true;
    }
    expect(turnedEarly).toBe(true);
  });

  it('both classicals stop clean, out of the sit and the turn alike', () => {
    for (const style of ['ballet', 'bharatanatyam'] as const) {
      const rig = createHumanoid({ seed: 4 });
      const home = rig.bones.Hips.position.clone();
      const entry = rig.bones.Head.quaternion.clone();
      const d = new Dance(rig, { seed: 3, bpm: 120 });
      d.setStyle(style);
      d.start();
      groove(d, 5.2);
      d.stop();
      groove(d, 2);
      expect(Math.abs(rig.bones.Hips.position.y - home.y), style).toBeLessThan(0.005);
      expect(rig.bones.Head.quaternion.angleTo(entry), style).toBeLessThan(0.02);
    }
  });
});

describe('the illusions and the house', () => {
  const styled = (style: 'moonwalk' | 'runningMan' | 'glide' | 'house', warm = 2) => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle(style);
    d.start();
    groove(d, warm);
    return { rig, d };
  };

  it('the four are on the list', async () => {
    const { DANCE_STYLES } = await import('../src');
    for (const s of ['moonwalk', 'runningMan', 'glide', 'house']) {
      expect(DANCE_STYLES).toContain(s);
    }
  });

  it('the moonwalk: the body travels backward while the chart walks forward', () => {
    const { rig, d } = styled('moonwalk');
    const zs: number[] = [];
    for (let i = 0; i < 8 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      zs.push(rig.bones.Hips.position.z);
    }
    // Well back of home at the glide's deepest…
    expect(Math.min(...zs)).toBeLessThan(-0.15);
    // …and never meaningfully in FRONT of it: the walk only recovers.
    expect(Math.max(...zs)).toBeLessThan(0.08);
    // Home again by cycle's end (mean stays near the spot).
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    expect(mean).toBeGreaterThan(Math.min(...zs));
  });

  it('the running man goes flat out and goes nowhere', () => {
    const { rig, d } = styled('runningMan');
    let minThigh = Infinity;
    let maxThigh = -Infinity;
    const zs: number[] = [];
    for (let i = 0; i < 6 * 60; i++) {
      d.update(1 / 60, pulseAt(0.8, i % 30 === 0, 120));
      const q = rig.bones.LeftUpLeg.quaternion;
      const pitch = 2 * Math.asin(Math.max(-1, Math.min(1, q.x)));
      minThigh = Math.min(minThigh, pitch);
      maxThigh = Math.max(maxThigh, pitch);
      zs.push(rig.bones.Hips.position.z);
    }
    // The legs scissor through a big arc…
    expect(maxThigh - minThigh).toBeGreaterThan(0.5);
    // …and the body stays on its spot.
    expect(Math.max(...zs.map(Math.abs))).toBeLessThan(0.09);
  });

  it('the glide crosses the floor and comes home, with the knees barely bent', () => {
    const { rig, d } = styled('glide');
    const xs: number[] = [];
    let maxKnee = 0;
    for (let i = 0; i < 8 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      xs.push(rig.bones.Hips.position.x);
      const q = rig.bones.LeftLeg.quaternion;
      maxKnee = Math.max(maxKnee, 2 * Math.asin(Math.min(1, Math.abs(q.x))));
    }
    // Both directions, a real distance…
    expect(Math.max(...xs)).toBeGreaterThan(0.1);
    expect(Math.min(...xs)).toBeLessThan(-0.1);
    // …with less knee than a single club bounce uses.
    expect(maxKnee).toBeLessThan(0.55);
  });

  it('the glide is rigid: the hips do not answer the travel', () => {
    // hipAnswer machinery reacts to WEIGHT; travel bypasses it. A gliding
    // body slides as one piece — measure hip roll while crossing.
    const { rig, d } = styled('glide');
    let maxRoll = 0;
    for (let i = 0; i < 8 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const q = rig.bones.Hips.quaternion;
      maxRoll = Math.max(maxRoll, Math.abs(2 * Math.asin(Math.max(-1, Math.min(1, q.z)))));
    }
    const salsaRig = createHumanoid({ seed: 4 });
    const salsa = new Dance(salsaRig, { seed: 3, bpm: 120 });
    salsa.setStyle('salsa');
    salsa.start();
    groove(salsa, 2);
    let salsaRoll = 0;
    for (let i = 0; i < 8 * 60; i++) {
      salsa.update(1 / 60, pulseAt(0.7, false, 120));
      const q = salsaRig.bones.Hips.quaternion;
      salsaRoll = Math.max(salsaRoll, Math.abs(2 * Math.asin(Math.max(-1, Math.min(1, q.z)))));
    }
    expect(salsaRoll).toBeGreaterThan(maxRoll * 2);
  });

  it('the jack runs at double the count', () => {
    // Count chest pitch direction changes per count: the jack turns twice
    // per count (4 sign flips); the waltz sways once per CYCLE.
    const flipsPerCount = (style: 'house' | 'waltz') => {
      const rig = createHumanoid({ seed: 4 });
      const d = new Dance(rig, { seed: 3, bpm: 120 });
      d.setStyle(style);
      d.start();
      groove(d, 2);
      let flips = 0;
      let counts = 0;
      let lastSign = 0;
      let lastCount = -1;
      let prevPitch = 0;
      for (let i = 0; i < 8 * 60; i++) {
        d.update(1 / 60, pulseAt(0.7, false, 120));
        const pitch = rig.bones.Chest.quaternion.x;
        const v = pitch - prevPitch;
        prevPitch = pitch;
        const sign = v > 1e-6 ? 1 : v < -1e-6 ? -1 : lastSign;
        if (lastSign !== 0 && sign !== lastSign) flips++;
        lastSign = sign;
        if (d.count !== lastCount) {
          lastCount = d.count;
          counts++;
        }
      }
      return flips / Math.max(1, counts);
    };
    expect(flipsPerCount('house')).toBeGreaterThan(flipsPerCount('waltz') * 2.5);
  });

  it('all four stop clean and come home', () => {
    for (const style of ['moonwalk', 'runningMan', 'glide', 'house'] as const) {
      const rig = createHumanoid({ seed: 4 });
      const home = rig.bones.Hips.position.clone();
      const entry = rig.bones.LeftUpLeg.quaternion.clone();
      const d = new Dance(rig, { seed: 3, bpm: 120 });
      d.setStyle(style);
      d.start();
      groove(d, 3.4); // deliberately mid-glide
      d.stop();
      groove(d, 2);
      expect(Math.abs(rig.bones.Hips.position.x - home.x), style).toBeLessThan(0.01);
      expect(Math.abs(rig.bones.Hips.position.z - home.z), style).toBeLessThan(0.01);
      expect(rig.bones.LeftUpLeg.quaternion.angleTo(entry), style).toBeLessThan(0.02);
    }
  });
});

describe('routines: dance as data', () => {
  const setup = () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.start();
    return { rig, d };
  };

  it('executes steps for their counted time, in order', () => {
    const { d } = setup();
    d.routine([
      { move: 'bounce', counts: 4 },
      { move: 'robot', counts: 4 },
      { move: 'clap', counts: 4 },
    ]);
    expect(d.move).toBe('bounce');
    expect(d.routineStep).toBe(0);
    groove(d, 2.2); // ~4.4 counts
    expect(d.move).toBe('robot');
    expect(d.routineStep).toBe(1);
    groove(d, 2);
    expect(d.move).toBe('clap');
  });

  it('a routine can change styles mid-set', () => {
    const { d } = setup();
    d.routine([
      { style: 'salsa', counts: 8 },
      { style: 'club', move: 'raiseTheRoof', counts: 4 },
    ]);
    expect(d.style).toBe('salsa');
    groove(d, 4.2);
    expect(d.style).toBe('club');
    expect(d.move).toBe('raiseTheRoof');
  });

  it('loops when asked, ends and hands back to improv when not', () => {
    const { d } = setup();
    d.routine([{ move: 'bounce', counts: 2 }, { move: 'twist', counts: 2 }], { loop: true });
    groove(d, 6);
    expect(d.routineStep).toBeGreaterThanOrEqual(0); // still running
    d.clearRoutine();
    expect(d.routineStep).toBe(-1);

    const { d: d2 } = setup();
    d2.routine([{ move: 'headBang', counts: 2 }]);
    groove(d2, 2);
    expect(d2.routineStep).toBe(-1);   // set over
    expect(d2.auto).toBe(true);        // improv resumed
    expect(d2.move).toBe('headBang');  // holding the last shape until it does
  });

  it('a STRICT routine is a chorus line: different seeds, identical bodies', () => {
    const a = createHumanoid({ seed: 4 });
    const b = createHumanoid({ seed: 4 });
    const da = new Dance(a, { seed: 5, bpm: 120 });
    const db = new Dance(b, { seed: 91, bpm: 120 });
    const steps = [
      { move: 'bounce' as const, counts: 4 },
      { move: 'raiseTheRoof' as const, counts: 4 },
    ];
    da.start();
    db.start();
    da.routine(steps, { loop: true, strict: true });
    db.routine(steps, { loop: true, strict: true });
    groove(da, 5);
    groove(db, 5);
    expect(a.bones.Head.quaternion.angleTo(b.bones.Head.quaternion)).toBeLessThan(1e-6);
    expect(Math.abs(a.bones.Hips.position.y - b.bones.Hips.position.y)).toBeLessThan(1e-9);
    // …and WITHOUT strict, the same two seeds diverge (the crowd default).
    da.clearRoutine();
    db.clearRoutine();
    da.use('bounce');
    db.use('bounce');
    groove(da, 3);
    groove(db, 3);
    const apart = Math.abs(a.bones.Hips.position.y - b.bones.Hips.position.y);
    expect(apart).toBeGreaterThan(1e-6);
  });

  it('clearRoutine gives the flair back', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 91, bpm: 120 });
    d.start();
    d.routine([{ move: 'bounce', counts: 4 }], { loop: true, strict: true });
    groove(d, 2);
    d.clearRoutine();
    // Flair restored: this dancer drifts from a strict twin again.
    const twinRig = createHumanoid({ seed: 4 });
    const twin = new Dance(twinRig, { seed: 5, bpm: 120 });
    twin.start();
    twin.use('bounce');
    d.use('bounce');
    groove(d, 3);
    groove(twin, 3);
    expect(
      Math.abs(rig.bones.Hips.position.y - twinRig.bones.Hips.position.y)
    ).toBeGreaterThan(1e-6);
  });
});

describe('vogue and krump', () => {
  it('vogue holds the pose: the frame does not move while it is being taken', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('vogue');
    d.start();
    groove(d, 2);
    let poseDrift = 0;
    let walkDrift = 0;
    let prev = rig.bones.Head.quaternion.clone();
    for (let i = 0; i < 8 * 60; i++) {
      d.update(1 / 60, pulseAt(0.7, false, 120));
      const c = ((d.phase % 8) + 8) % 8;
      const step = rig.bones.Head.quaternion.angleTo(prev);
      prev = rig.bones.Head.quaternion.clone();
      if ((c > 4.7 && c < 5.8) || (c > 6.7 && c < 7.8)) poseDrift = Math.max(poseDrift, step);
      if (c > 0.3 && c < 3.5) walkDrift = Math.max(walkDrift, step);
    }
    expect(poseDrift).toBeLessThan(0.004);
    expect(walkDrift).toBeGreaterThan(poseDrift * 3);
  });

  it('krump stomps off the grid, and the floor can hear it', () => {
    const rig = createHumanoid({ seed: 4 });
    const d = new Dance(rig, { seed: 3, bpm: 120 });
    d.setStyle('krump');
    d.start();
    const at: number[] = [];
    d.onStamp(() => at.push(((d.phase % 4) + 4) % 4));
    for (let i = 0; i < 4 * 60; i++) d.update(1 / 60, pulseAt(0.8, false, 120));
    // Five stomps per 4-count cycle, several of them OFF the counts.
    expect(at.length).toBeGreaterThanOrEqual(4);
    const off = at.filter((t) => {
      const f = t % 1;
      return f > 0.2 && f < 0.8;
    });
    expect(off.length).toBeGreaterThanOrEqual(2);
  });

  it('krump is the loudest thing in the building', () => {
    const swing = (style: 'krump' | 'bhangra') => {
      const rig = createHumanoid({ seed: 4 });
      const d = new Dance(rig, { seed: 3, bpm: 120 });
      d.setStyle(style);
      d.start();
      groove(d, 2);
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < 6 * 60; i++) {
        d.update(1 / 60, pulseAt(0.7, false, 120));
        const q = rig.bones.Chest.quaternion;
        const pitch = 2 * Math.asin(Math.max(-1, Math.min(1, q.x)));
        lo = Math.min(lo, pitch);
        hi = Math.max(hi, pitch);
      }
      return hi - lo;
    };
    expect(swing('krump')).toBeGreaterThan(swing('bhangra') * 1.5);
  });

  it('both stop clean', () => {
    for (const style of ['vogue', 'krump'] as const) {
      const rig = createHumanoid({ seed: 4 });
      const home = rig.bones.Hips.position.clone();
      const entry = rig.bones.RightArm.quaternion.clone();
      const d = new Dance(rig, { seed: 3, bpm: 120 });
      d.setStyle(style);
      d.start();
      groove(d, 3.1);
      d.stop();
      groove(d, 2);
      expect(rig.bones.RightArm.quaternion.angleTo(entry), style).toBeLessThan(0.02);
      expect(Math.abs(rig.bones.Hips.position.z - home.z), style).toBeLessThan(0.01);
    }
  });
});
