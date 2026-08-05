import { describe, expect, it } from 'vitest';
import {
  EYE_RADIUS, MICROSACCADE_AMPLITUDE, ORBITAL_RANGE, PEAK_VELOCITY_MAX,
  SACCADE_INTERCEPT, SACCADE_SLOPE, SCAN, Saccades, VELOCITY_CONSTANT,
  irisOffset, saccadeDuration,
} from '../src/saccades';
import { createEyes } from '../src/blink';
import { createHumanoid } from '../src/humanoid';

const STEP = 1 / 2000;

/** Fly one saccade and watch the angle trace, never the formula. */
const fly = (yaw: number, pitch = 0) => {
  const s = new Saccades({ task: 'scene', seed: 5 });
  s.look(yaw, pitch);
  let last = s.angles.yaw;
  let peak = 0;
  let flight = 0;
  while (s.moving && flight < 1) {
    s.update(STEP);
    flight += STEP;
    peak = Math.max(peak, Math.abs(s.angles.yaw - last) / STEP);
    last = s.angles.yaw;
  }
  return { peak, flight, landed: s.angles };
};

describe('the duration law', () => {
  it('is 2.2 ms a degree plus 21', () => {
    expect(saccadeDuration(0)).toBeCloseTo(SACCADE_INTERCEPT, 12);
    expect(saccadeDuration(10)).toBeCloseTo(SACCADE_SLOPE * 10 + SACCADE_INTERCEPT, 12);
    // Direction is not amplitude.
    expect(saccadeDuration(-10)).toBeCloseTo(saccadeDuration(10), 12);
    expect(saccadeDuration(NaN)).toBeCloseTo(SACCADE_INTERCEPT, 12);
  });

  it('is what the movement actually takes', () => {
    for (const a of [2, 5, 10, 20]) {
      expect(fly(a).flight / saccadeDuration(a)).toBeCloseTo(1, 1);
    }
  });
});

describe('the peak velocity, which the model was never given', () => {
  const published = (a: number) => PEAK_VELOCITY_MAX * (1 - Math.exp(-a / VELOCITY_CONSTANT));

  it('lands on Bahill within 5% across the natural range', () => {
    for (const a of [2, 3, 5, 7, 10, 13, 16, 20]) {
      expect(Math.abs(fly(a).peak / published(a) - 1)).toBeLessThan(0.05);
    }
  });

  it('has the peak-to-mean of a half-sine, not of a smoothstep', () => {
    for (const a of [5, 10, 20]) {
      const f = fly(a);
      expect(f.peak / (a / f.flight)).toBeCloseTo(Math.PI / 2, 1);
    }
  });
});

describe('a saccade is one movement', () => {
  it('takes its amplitude from the diagonal, not from either axis', () => {
    const s = new Saccades({ task: 'scene', seed: 9 });
    s.look(10, 10);
    let t = 0;
    while (s.moving && t < 1) { s.update(STEP); t += STEP; }
    expect(t / saccadeDuration(Math.hypot(10, 10))).toBeCloseTo(1, 1);
    expect(t).toBeGreaterThan(saccadeDuration(10) * 1.15);
  });

  it('is ballistic — it cannot be redirected in flight', () => {
    const s = new Saccades({ task: 'scene', seed: 4 });
    s.look(15, 0);
    for (let i = 0; i < 5; i++) s.update(STEP);
    s.look(-15, 0);
    let t = 0;
    while (s.moving && t < 1) { s.update(STEP); t += STEP; }
    expect(s.angles.yaw).toBeCloseTo(15, 5);
  });

  it('arrives exactly where it was sent', () => {
    expect(fly(12, 0).landed.yaw).toBeCloseTo(12, 9);
  });
});

describe('the scanpath is the task', () => {
  const scan = (task: 'reading' | 'search' | 'scene', seconds = 300) => {
    const s = new Saccades({ task, seed: 3 });
    for (let i = 0; i < seconds / STEP; i++) s.update(STEP, { task });
    return s.count / seconds;
  };

  it('reads Rayner the right way round', () => {
    expect(SCAN.reading.fixation).toBeLessThan(SCAN.scene.fixation);
    expect(SCAN.reading.amplitude).toBeLessThan(SCAN.scene.amplitude);
  });

  it('makes more, smaller movements reading than looking at a scene', () => {
    expect(scan('reading')).toBeGreaterThan(scan('scene') * 1.2);
  });

  it('changes rate when the task changes, without being re-created', () => {
    const s = new Saccades({ task: 'scene', seed: 3 });
    const count = (task: 'reading' | 'scene', seconds: number): number => {
      const before = s.count;
      for (let i = 0; i < seconds / STEP; i++) s.update(STEP, { task });
      return (s.count - before) / seconds;
    };
    expect(count('reading', 200)).toBeGreaterThan(count('scene', 200) * 1.2);
  });

  it('is deterministic for a seed and different for another', () => {
    const run = (seed: number): string => {
      const s = new Saccades({ task: 'scene', seed });
      const out: string[] = [];
      for (let i = 0; i < 5000; i++) out.push(s.update(1 / 240).yaw.toFixed(6));
      return out.join(',');
    };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });
});

describe('the eye is never still', () => {
  it('flicks during a fixation without counting it as one', () => {
    const s = new Saccades({ task: 'scene', seed: 12 });
    let flicks = 0;
    let biggest = 0;
    let wasMoving = false;
    let before = { ...s.angles };
    for (let i = 0; i < 60 / STEP; i++) {
      s.update(STEP);
      if (s.moving && !wasMoving) before = { ...s.angles };
      if (!s.moving && wasMoving) {
        const size = Math.hypot(s.angles.yaw - before.yaw, s.angles.pitch - before.pitch);
        if (size < MICROSACCADE_AMPLITUDE * 2) { flicks++; biggest = Math.max(biggest, size); }
      }
      wasMoving = s.moving;
    }
    expect(flicks).toBeGreaterThan(20);
    expect(biggest).toBeLessThan(1);
  });
});

describe('the eye hands over to the head', () => {
  it('never leaves the socket, and passes on what it could not reach', () => {
    const s = new Saccades({ task: 'scene', seed: 7 });
    let reached = 0;
    let handed = 0;
    for (let i = 0; i < 30 / STEP; i++) {
      s.update(STEP, { target: { yaw: 60, pitch: 0 } });
      reached = Math.max(reached, Math.abs(s.angles.yaw));
      handed = Math.max(handed, Math.abs(s.headDemand.yaw));
    }
    expect(reached).toBeLessThanOrEqual(ORBITAL_RANGE + 1e-9);
    expect(handed).toBeGreaterThan(60 - ORBITAL_RANGE - 5);
  });

  it('normalises onto the pair createEyes wants', () => {
    const s = new Saccades({ task: 'scene', seed: 2 });
    s.look(ORBITAL_RANGE, -ORBITAL_RANGE);
    while (s.moving) s.update(STEP);
    expect(s.shape.yaw).toBeCloseTo(1, 9);
    expect(s.shape.gaze).toBeCloseTo(-1, 9);
  });
});

describe('the iris is a spot on a ball', () => {
  it('travels R sin θ, and zero is zero', () => {
    expect(irisOffset(0)).toBe(0);
    expect(irisOffset(1)).toBeCloseTo(EYE_RADIUS * Math.sin(ORBITAL_RANGE * (Math.PI / 180)), 12);
    expect(irisOffset(-1)).toBeCloseTo(-irisOffset(1), 12);
    // Beyond the socket is still the socket.
    expect(irisOffset(5)).toBeCloseTo(irisOffset(1), 12);
  });

  it('scales with the body, because a taller person has a bigger head', () => {
    expect(irisOffset(1, 3.5) / irisOffset(1, 1.75)).toBeCloseTo(2, 9);
  });

  it('moves the rig, and NOT by more when the eyes are drawn bigger', () => {
    const swing = (size: number): number => {
      const eyes = createEyes(createHumanoid({ height: 1.75, seed: 6, face: { eyes: { size } } }));
      eyes.apply({ lid: 0, gaze: 0, yaw: 0 });
      const centre = eyes.pupil();
      eyes.apply({ lid: 0, gaze: 0, yaw: 1 });
      return eyes.pupil() - centre;
    };
    expect(swing(1)).toBeCloseTo(irisOffset(1, 1.75), 6);
    expect(swing(1.2)).toBeCloseTo(swing(1), 6);
  });

  it('leaves the eye alone when nothing is passed', () => {
    const eyes = createEyes(createHumanoid({ height: 1.75, seed: 6 }));
    eyes.apply({ lid: 0, gaze: 0 });
    const a = eyes.pupil();
    eyes.apply({ lid: 0, gaze: 0, yaw: 0 });
    expect(eyes.pupil()).toBeCloseTo(a, 12);
  });
});

describe('the things it must not do', () => {
  it('survives nonsense dt, nonsense targets and an unknown task', () => {
    const s = new Saccades({ task: 'scene', seed: 2 });
    const eyes = createEyes(createHumanoid({ height: 1.75, seed: 6 }));
    for (const dt of [0, STEP, -1, 5, NaN]) {
      for (const target of [null, { yaw: NaN, pitch: 0 }, { yaw: 1e9, pitch: -1e9 }, {}]) {
        const a = s.update(dt, { target, task: 'sleeping' as 'scene' });
        eyes.apply({ lid: 0, ...s.shape });
        expect(Number.isFinite(a.yaw)).toBe(true);
        expect(Number.isFinite(a.pitch)).toBe(true);
        expect(Math.abs(a.yaw)).toBeLessThanOrEqual(ORBITAL_RANGE + 1e-9);
        expect(Math.abs(a.pitch)).toBeLessThanOrEqual(ORBITAL_RANGE + 1e-9);
      }
    }
  });
});
