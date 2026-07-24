import { describe, expect, it } from 'vitest';
import { QuaternionKeyframeTrack } from 'three';
import { createHumanoid, Locomotion, Mannerisms, type MannerismName } from '../src';

const make = (options = {}) => {
  const rig = createHumanoid({ seed: 8 });
  const loco = new Locomotion(rig);
  return { rig, loco, habits: new Mannerisms(rig, loco, { seed: 3, ...options }) };
};

/** Run the layer for `seconds`, collecting what it fired. */
function idle(habits: Mannerisms, seconds: number, dt = 1 / 30): MannerismName[] {
  const fired: MannerismName[] = [];
  habits.onPlay((name) => fired.push(name));
  for (let i = 0; i < seconds / dt; i++) habits.update(dt);
  return fired;
}

describe('Mannerisms', () => {
  it('fires idle motion on its own, without being asked', () => {
    const { habits } = make();
    const fired = idle(habits, 90);
    expect(fired.length).toBeGreaterThan(3);
  });

  it('draws from the right repertoire for the context', () => {
    const standing = make();
    expect(new Set(idle(standing.habits, 200))).not.toContain('leanBack');

    const seated = make({ context: 'seated' });
    const fired = new Set(idle(seated.habits, 300));
    expect(fired.has('weightShift'), 'seated people do not shift their weight').toBe(false);
  });

  it('overlays are ADDITIVE arm/torso deltas — the legs are never touched', () => {
    const { habits, loco } = make();
    const clips: string[] = [];
    const original = loco.overlay.bind(loco);
    (loco as unknown as { overlay: typeof loco.overlay }).overlay = (clip, options) => {
      clips.push(clip.name);
      const bones = new Set(clip.tracks.map((t) => t.name.split('.')[0]));
      expect(bones.has('LeftUpLeg')).toBe(false);
      expect(bones.has('RightLeg')).toBe(false);
      // Additive: frame 0 is the identity delta.
      for (const track of clip.tracks) {
        if (!(track instanceof QuaternionKeyframeTrack)) continue;
        expect(track.values[3]).toBeCloseTo(1, 4); // w = 1 → no rotation
      }
      return original(clip, options);
    };
    for (const name of Object.keys({
      weightShift: 0, shoulderRoll: 0, headTurn: 0, scratch: 0,
      stretch: 0, leanBack: 0, leanIn: 0, fidget: 0,
    }) as MannerismName[]) {
      habits.play(name);
    }
    expect(clips).toHaveLength(8);
  });

  it('holds still while walking — the gait is motion enough', () => {
    const { habits, loco } = make();
    const fired: MannerismName[] = [];
    habits.onPlay((n) => fired.push(n));
    // Drive the locomotion fast for a good while.
    for (let i = 0; i < 60 * 30; i++) {
      loco.update(1 / 30, 3.2);
      habits.update(1 / 30);
    }
    expect(loco.speed).toBeGreaterThan(1);
    expect(fired).toHaveLength(0);
    // Stop, and the habits come back.
    for (let i = 0; i < 60 * 30; i++) {
      loco.update(1 / 30, 0);
      habits.update(1 / 30);
    }
    expect(fired.length).toBeGreaterThan(0);
  });

  it('the gaps are uneven — a metronome would give the puppetry away', () => {
    const { habits } = make({ interval: 3, restlessness: 1 });
    const at: number[] = [];
    let clock = 0;
    habits.onPlay(() => at.push(clock));
    for (let i = 0; i < 400 * 30; i++) {
      habits.update(1 / 30);
      clock += 1 / 30;
    }
    expect(at.length).toBeGreaterThan(8);
    const gaps: number[] = [];
    for (let i = 1; i < at.length; i++) gaps.push(at[i] - at[i - 1]);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(1.5);
  });

  it('each character gets its own restlessness and tastes from its seed', () => {
    const counts = [1, 2, 3, 4].map((seed) => {
      const rig = createHumanoid({ seed });
      const loco = new Locomotion(rig);
      const habits = new Mannerisms(rig, loco, { seed });
      return idle(habits, 240).length;
    });
    // Not all the same person.
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('restlessness 0 (and `enabled = false`) hold the body perfectly still', () => {
    const still = make({ restlessness: 0 });
    expect(idle(still.habits, 120)).toHaveLength(0);

    const off = make();
    off.habits.enabled = false;
    expect(idle(off.habits, 120)).toHaveLength(0);
  });

  it('never starts one on top of another', () => {
    // Driven as restless as the API allows, so firings come back to back —
    // but each must wait for the last to finish, or the body double-moves.
    const { habits } = make({ restlessness: 2, interval: 0.5 });
    let clock = 0;
    let endsAt = 0;
    let overlaps = 0;
    let fires = 0;
    habits.onPlay(() => {
      fires++;
      if (clock < endsAt - 1e-6) overlaps++;
      endsAt = clock + habits.remainingTime;
    });
    for (let i = 0; i < 200 * 30; i++) {
      habits.update(1 / 30);
      clock += 1 / 30;
    }
    expect(fires).toBeGreaterThan(20);
    expect(overlaps).toBe(0);
  });

  it('play() forces one immediately and reports what it chose', () => {
    const { habits } = make();
    expect(habits.play('scratch')).toBe('scratch');
    expect(habits.busy).toBe(true);
    habits.interrupt();
    expect(habits.busy).toBe(false);
  });

  it('is deterministic under a seed', () => {
    const run = () => {
      const rig = createHumanoid({ seed: 8 });
      const loco = new Locomotion(rig);
      return idle(new Mannerisms(rig, loco, { seed: 42 }), 200);
    };
    expect(run()).toEqual(run());
  });
});
