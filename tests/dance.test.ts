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
