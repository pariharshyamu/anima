import { describe, expect, it } from 'vitest';
import {
  APERTURE, BLINK_CLOSE, BLINK_OPEN, BLINK_RATE, BLINK_SECONDS, Blinking,
  GAZE_LID, LID_SPEED, createEyes,
} from '../src/blink';
import { createHumanoid } from '../src/humanoid';

const RATE = 1 / 120;

describe('the constants are derived from published ones', () => {
  it('gets the lid speed out of the aperture and the closing time', () => {
    expect(LID_SPEED).toBeCloseTo(APERTURE / BLINK_CLOSE, 12);
  });

  it('reopens in twice the time it shuts', () => {
    expect(BLINK_OPEN / BLINK_CLOSE).toBeCloseTo(2, 12);
    expect(BLINK_SECONDS).toBeCloseTo(BLINK_CLOSE + BLINK_OPEN, 12);
  });

  it('reads Bentivoglio the right way round', () => {
    // Reading suppresses, conversing excites. If this ever inverts, every
    // number downstream is still self-consistent and the faces are wrong.
    expect(BLINK_RATE.reading).toBeLessThan(BLINK_RATE.rest);
    expect(BLINK_RATE.rest).toBeLessThan(BLINK_RATE.conversing);
  });
});

describe('the rate is the task', () => {
  const rateOf = (task: 'rest' | 'reading' | 'conversing', seed: number, minutes = 20): number => {
    const b = new Blinking({ task, seed });
    for (let i = 0; i < minutes * 60 * 60; i++) b.update(1 / 60);
    return b.count / minutes;
  };

  it('lands near the published rate for each task', () => {
    // Averaged over seeds: one run of a Poisson process is worth about 3%.
    for (const task of ['rest', 'reading', 'conversing'] as const) {
      const runs = [1, 2, 3, 4, 5, 6].map((s) => rateOf(task, s));
      const m = runs.reduce((a, b) => a + b, 0) / runs.length;
      expect(Math.abs(m / BLINK_RATE[task] - 1)).toBeLessThan(0.12);
    }
  });

  it('changes rate when the task changes, without being re-created', () => {
    const b = new Blinking({ task: 'reading', seed: 3 });
    const count = (task: 'reading' | 'conversing', minutes: number): number => {
      const before = b.count;
      for (let i = 0; i < minutes * 60 * 60; i++) b.update(1 / 60, { task });
      return (b.count - before) / minutes;
    };
    expect(count('conversing', 20)).toBeGreaterThan(count('reading', 20) * 3);
  });

  it('is deterministic for a seed and different for another', () => {
    const run = (seed: number): string => {
      const b = new Blinking({ task: 'rest', seed });
      const out: number[] = [];
      for (let i = 0; i < 4000; i++) out.push(Number(b.update(RATE).lid.toFixed(6)));
      return out.join(',');
    };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });
});

describe('a blink is a shape, not a toggle', () => {
  const oneBlink = () => {
    const b = new Blinking({ task: 'rest', seed: 11 });
    b.blink();
    const lids: number[] = [];
    for (let i = 0; i < Math.ceil((BLINK_SECONDS + 0.1) * 120); i++) {
      lids.push(b.update(RATE, { gaze: 1 }).lid);
    }
    return lids;
  };

  it('shuts the eye completely', () => {
    expect(Math.max(...oneBlink())).toBeGreaterThan(0.99);
  });

  it('falls in half the time it rises', () => {
    const lids = oneBlink();
    const shut = lids.indexOf(Math.max(...lids));
    let reopened = lids.length - 1;
    for (let i = shut; i < lids.length; i++) if (lids[i] < 0.01) { reopened = i; break; }
    expect((reopened - shut) / shut).toBeGreaterThan(1.6);
  });

  it('never moves faster than a lid moves', () => {
    const lids = oneBlink();
    let worst = 0;
    for (let i = 1; i < lids.length; i++) worst = Math.max(worst, Math.abs(lids[i] - lids[i - 1]) * APERTURE * 120);
    expect(worst).toBeLessThanOrEqual(LID_SPEED * 1.01);
  });
});

describe('the lid rides the eye', () => {
  it('is lower looking down and higher looking up', () => {
    const b = new Blinking({ task: 'reading', seed: 8 });
    // The widest over a window is the resting lid; a blink can only narrow it.
    const restingAt = (gaze: number): number => {
      let widest = 1;
      for (let i = 0; i < 240; i++) widest = Math.min(widest, b.update(RATE, { gaze }).lid);
      return widest;
    };
    const up = restingAt(1);
    const level = restingAt(0);
    const down = restingAt(-1);
    expect(up).toBeLessThan(level);
    expect(level).toBeLessThan(down);
    expect(down - up).toBeCloseTo(GAZE_LID, 2);
  });
});

describe('the things it must not do', () => {
  it('survives nonsense gaze, nonsense dt and an unknown task', () => {
    const rig = createHumanoid({ height: 1.75, seed: 6 });
    const eyes = createEyes(rig);
    const b = new Blinking({ task: 'rest', seed: 4 });
    for (const gaze of [NaN, Infinity, -1e9, 1e9]) {
      for (const dt of [0, RATE, -1, 5, NaN]) {
        const shape = b.update(dt, { gaze, task: 'sleeping' as 'rest' });
        eyes.apply(shape);
        expect(Number.isFinite(shape.lid)).toBe(true);
        expect(shape.lid).toBeGreaterThanOrEqual(0);
        expect(shape.lid).toBeLessThanOrEqual(1);
        expect(Number.isFinite(eyes.aperture())).toBe(true);
      }
    }
  });

  it('moves the RIG, and the aperture goes to zero when shut', () => {
    const eyes = createEyes(createHumanoid({ height: 1.75, seed: 6 }));
    eyes.apply({ lid: 0, gaze: 0 });
    const open = eyes.aperture();
    eyes.apply({ lid: 1, gaze: 0 });
    expect(eyes.aperture()).toBeLessThan(open * 0.01);
    expect(open).toBeCloseTo(APERTURE, 4);
  });

  it('scales the aperture off the body', () => {
    const small = createEyes(createHumanoid({ height: 1.2, seed: 2 }));
    const tall = createEyes(createHumanoid({ height: 1.95, seed: 2 }));
    small.apply({ lid: 0, gaze: 0 });
    tall.apply({ lid: 0, gaze: 0 });
    expect(tall.aperture() / small.aperture()).toBeCloseTo(1.95 / 1.2, 6);
  });
});
