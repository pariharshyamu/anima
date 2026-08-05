import { describe, expect, it } from 'vitest';
import {
  CONSTRICT_TAU, DILATE_TAU, EFFORT_DILATION, IRIS_MM, PUPIL_LATENCY,
  PUPIL_MAX, PUPIL_MIN, Pupils, pupilFor,
} from '../src/pupils';
import { createEyes } from '../src/blink';
import { createHumanoid } from '../src/humanoid';

const DT = 1 / 120;

/** Hold a luminance until the pupil stops moving. */
const settle = (L: number, seconds = 40): Pupils => {
  const p = new Pupils({ luminance: L });
  for (let i = 0; i < seconds / DT; i++) p.update(DT, { luminance: L });
  return p;
};

describe('the static law', () => {
  it('is Moon & Spencer, and settles on it', () => {
    for (const L of [0.01, 1, 100, 1e4]) {
      expect(settle(L).diameter).toBeCloseTo(pupilFor(L), 2);
    }
  });

  it('stays inside the anatomical range however absurd the light', () => {
    for (const L of [1e-12, 0, 1, 1e12, Infinity, NaN]) {
      const d = pupilFor(L);
      expect(d).toBeGreaterThanOrEqual(PUPIL_MIN);
      expect(d).toBeLessThanOrEqual(PUPIL_MAX);
    }
  });

  it('shrinks as the light rises, never the other way', () => {
    let last = Infinity;
    for (let e = -3; e <= 4; e += 0.25) {
      const d = pupilFor(10 ** e);
      expect(d).toBeLessThanOrEqual(last + 1e-12);
      last = d;
    }
  });

  it('is logarithmic — a decade at dusk beats the same units at noon', () => {
    const perDecade = pupilFor(1) - pupilFor(10);
    const perSameStep = pupilFor(1000) - pupilFor(1009);
    expect(perDecade / perSameStep).toBeGreaterThan(100);
  });

  it('covers most of the range across eight decades', () => {
    expect(pupilFor(1e-3) - pupilFor(1e4)).toBeGreaterThan(4);
  });
});

describe('the two muscles are not the same muscle', () => {
  it('opens several times slower than it shuts', () => {
    expect(DILATE_TAU / CONSTRICT_TAU).toBeGreaterThan(2);
  });

  it('...and the trace shows it', () => {
    const p = settle(0.1, 30);
    const wide = p.diameter;
    let shutIn = 0;
    for (let t = 0; t < 12; t += DT) {
      p.update(DT, { luminance: 1000 });
      if (!shutIn && p.diameter <= wide - (wide - pupilFor(1000)) * 0.632) shutIn = t;
    }
    const narrow = p.diameter;
    let openIn = 0;
    for (let t = 0; t < 30; t += DT) {
      p.update(DT, { luminance: 0.1 });
      if (!openIn && p.diameter >= narrow + (pupilFor(0.1) - narrow) * 0.632) openIn = t;
    }
    expect((openIn - PUPIL_LATENCY) / (shutIn - PUPIL_LATENCY)).toBeGreaterThan(2);
  });

  it('does not move inside the reflex latency', () => {
    const p = settle(1, 20);
    const before = p.diameter;
    for (let t = 0; t < PUPIL_LATENCY * 0.9; t += DT) p.update(DT, { luminance: 5000 });
    expect(p.diameter).toBeCloseTo(before, 9);
  });
});

describe('the mood is worth half a millimetre', () => {
  it('is an order of magnitude under the light response', () => {
    expect((pupilFor(1e-3) - pupilFor(1e4)) / EFFORT_DILATION).toBeGreaterThan(8);
  });

  it('adds to the reflex without compounding into it', () => {
    const p = new Pupils({ luminance: 50 });
    for (let i = 0; i < 300 / DT; i++) p.update(DT, { luminance: 50, effort: 1 });
    expect(p.diameter).toBeCloseTo(pupilFor(50) + EFFORT_DILATION, 1);
  });

  it('reports how much of itself is the task', () => {
    const p = new Pupils({ luminance: 50 });
    for (let i = 0; i < 20 / DT; i++) p.update(DT, { luminance: 50, effort: 1 });
    expect(p.fromEffort).toBeCloseTo(EFFORT_DILATION, 2);
    expect(p.fromLight).toBeCloseTo(pupilFor(50), 6);
  });

  it('is swamped by a change of light, which is why pupillometry fixes it', () => {
    // A single decade of luminance moves the pupil further than the whole
    // task-evoked response ever does.
    expect(pupilFor(1) - pupilFor(10)).toBeGreaterThan(EFFORT_DILATION * 2);
  });
});

describe('it reaches the rig', () => {
  const eyesOf = (size = 1) =>
    createEyes(createHumanoid({ height: 1.75, seed: 6, face: { eyes: { size } } }));

  it('draws the pupil as D of a twelve-millimetre iris', () => {
    const eyes = eyesOf();
    const irisWidth = (eyes.group.children[2] as never as { geometry: { parameters: { width: number } } })
      .geometry.parameters.width;
    for (const mm of [PUPIL_MIN, 4.9, PUPIL_MAX]) {
      eyes.apply({ lid: 0, gaze: 0, pupil: mm });
      const drawn = (eyes.group.children[4] as never as { scale: { x: number } }).scale.x * irisWidth;
      expect(drawn / irisWidth).toBeCloseTo(mm / IRIS_MM, 6);
      expect(eyes.pupilMm()).toBeCloseTo(mm, 9);
    }
  });

  it('gives a big-eyed character the same fraction, not the same millimetres', () => {
    const shown = (size: number) => {
      const eyes = eyesOf(size);
      eyes.apply({ lid: 0, gaze: 0, pupil: PUPIL_MAX });
      return (eyes.group.children[4] as never as { scale: { x: number } }).scale.x;
    };
    expect(shown(1.2)).toBeCloseTo(shown(1), 9);
  });

  it('clamps a nonsense diameter into the anatomical range', () => {
    const eyes = eyesOf();
    for (const mm of [NaN, -4, 900, Infinity]) {
      eyes.apply({ lid: 0, gaze: 0, pupil: mm });
      expect(eyes.pupilMm()).toBeGreaterThanOrEqual(PUPIL_MIN);
      expect(eyes.pupilMm()).toBeLessThanOrEqual(PUPIL_MAX);
    }
  });

  it('defaults to a lit interior when nothing is passed', () => {
    const eyes = eyesOf();
    eyes.apply({ lid: 0, gaze: 0 });
    expect(eyes.pupilMm()).toBeCloseTo(pupilFor(50), 6);
  });
});

describe('the things it must not do', () => {
  it('survives nonsense luminance, effort and dt', () => {
    const p = new Pupils({ luminance: NaN });
    for (const dt of [0, DT, -1, 5, NaN]) {
      for (const luminance of [NaN, -5, 0, 1e12, Infinity]) {
        for (const effort of [NaN, -3, 4, 0.5]) {
          const d = p.update(dt, { luminance, effort });
          expect(Number.isFinite(d)).toBe(true);
          expect(d).toBeGreaterThanOrEqual(PUPIL_MIN);
          expect(d).toBeLessThanOrEqual(PUPIL_MAX);
        }
      }
    }
  });

  it('runs with no state at all', () => {
    const p = new Pupils();
    for (let i = 0; i < 100; i++) p.update(DT);
    expect(p.diameter).toBeCloseTo(pupilFor(50), 6);
  });
});
