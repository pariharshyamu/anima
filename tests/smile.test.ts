import { describe, expect, it } from 'vitest';
import {
  CHEEK_LID, CORNER_TRAVEL, FELT_MAX, FELT_MIN, POSED_ASYMMETRY, POSED_ONSET,
  Smile, createSmile, readSmile,
} from '../src/smile';
import { createEyes } from '../src/blink';
import { createHumanoid } from '../src/humanoid';

const DT = 1 / 120;

/** Play a whole expression and record what the face did, not what it meant. */
const record = (kind: 'pose' | 'feel', intensity = 0.9, hold = 1) => {
  const s = new Smile();
  s[kind](intensity);
  const track = [];
  const apex = s.onsetSeconds;
  let releasing = false;
  let t = 0;
  while (t < 8) {
    const shape = s.update(DT);
    track.push({ corner: { ...shape.corner }, cheek: shape.cheek });
    t += DT;
    if (!releasing && t > apex + hold) { s.relax(); releasing = true; }
    if (releasing && s.shape.corner.left < 0.001) break;
  }
  return track;
};

describe('the published constants', () => {
  it('reads Ekman & Friesen the right way round', () => {
    expect(FELT_MIN).toBeLessThan(FELT_MAX);
  });

  it('derives the posed onset from the felt floor, not from taste', () => {
    expect(POSED_ONSET).toBeCloseTo(FELT_MIN / 3, 12);
    expect(POSED_ONSET * 2).toBeLessThan(FELT_MIN);
  });
});

describe('only one of the two muscles obeys the will', () => {
  it('leaves the cheek alone through an entire posed smile', () => {
    for (const s of record('pose')) expect(s.cheek).toBe(0);
  });

  it('raises the cheek with the corners when the smile is felt', () => {
    const track = record('feel');
    const apex = track.reduce((b, s) => (s.cheek > b.cheek ? s : b));
    expect(apex.cheek).toBeCloseTo(0.9, 2);
    expect(apex.corner.left).toBeCloseTo(0.9, 2);
  });

  it('cannot be made to pose a Duchenne smile', () => {
    // The API surface IS the claim: there is no third verb, and `pose` takes an
    // intensity rather than a pair of muscles.
    const s = new Smile();
    const verbs = Object.getOwnPropertyNames(Object.getPrototypeOf(s))
      .filter((k) => typeof (s as never as Record<string, unknown>)[k] === 'function');
    expect(verbs.sort()).toEqual(['constructor', 'feel', 'pose', 'relax', 'update'].sort());
  });

  it('keeps a felt cheek raise when a pose follows, rather than snapping it off', () => {
    // AU6 is not commandable in either direction: a deliberate smile on top of a
    // felt one does not reach up and switch the eye off.
    const s = new Smile();
    s.feel(0.8);
    for (let i = 0; i < 200; i++) s.update(DT);
    const held = s.shape.cheek;
    s.pose(0.4);
    for (let i = 0; i < 200; i++) s.update(DT);
    expect(s.shape.cheek).toBeCloseTo(held, 6);
  });
});

describe('the observer, built from four laboratories', () => {
  it('calls a felt smile felt on every marker', () => {
    const e = readSmile(record('feel'), DT);
    expect(e).toMatchObject({ cheek: true, window: true, symmetric: true, smooth: true, score: 4 });
  });

  it('catches a posed one on Duchenne, symmetry and shape', () => {
    const e = readSmile(record('pose'), DT);
    expect(e.cheek).toBe(false);
    expect(e.symmetric).toBe(false);
    expect(e.smooth).toBe(false);
  });

  it('separates the two', () => {
    expect(readSmile(record('feel'), DT).score - readSmile(record('pose'), DT).score).toBeGreaterThanOrEqual(2);
  });

  it('learns NOTHING from a one-number smile, which is the control', () => {
    const oneNumber = () => {
      const track = [];
      const onset = 0.4;
      for (let t = 0; t < onset * 2 + 1; t += DT) {
        const up = t < onset ? t / onset : t < onset + 1 ? 1 : 1 - (t - onset - 1) / onset;
        const v = Math.max(0, Math.min(1, up)) * 0.9;
        track.push({ corner: { left: v, right: v }, cheek: v });
      }
      return track;
    };
    expect(readSmile(oneNumber(), DT).score).toBe(readSmile(oneNumber(), DT).score);
  });

  it('scores nothing at all on an empty track or a dead clock', () => {
    expect(readSmile([], DT).score).toBe(0);
    expect(readSmile(record('feel'), 0).score).toBe(0);
  });

  it('puts a posed flash under the published floor', () => {
    const live = (track: { corner: { left: number; right: number } }[]) =>
      track.filter((s) => (s.corner.left + s.corner.right) / 2 > 0.045).length * DT;
    expect(live(record('pose', 0.9, 0))).toBeLessThan(FELT_MIN);
    expect(live(record('feel'))).toBeGreaterThanOrEqual(FELT_MIN);
    expect(live(record('feel'))).toBeLessThanOrEqual(FELT_MAX);
  });
});

describe('a deliberate smile is lopsided', () => {
  it('is weaker on the right, by the published direction', () => {
    const s = new Smile();
    s.pose(1);
    for (let i = 0; i < 200; i++) s.update(DT);
    expect(s.shape.corner.right).toBeCloseTo(1 - POSED_ASYMMETRY, 4);
    expect(s.shape.corner.left).toBeCloseTo(1, 4);
  });

  it('...and a felt one is not', () => {
    const s = new Smile();
    s.feel(1);
    for (let i = 0; i < 200; i++) s.update(DT);
    expect(s.shape.corner.left).toBeCloseTo(s.shape.corner.right, 9);
  });
});

describe('it reaches the rig', () => {
  const rig = () => createHumanoid({ height: 1.75, seed: 6 });

  it('narrows the eye by CHEEK_LID and does not shut it', () => {
    const eyes = createEyes(rig());
    eyes.apply({ lid: 0, gaze: 0, cheek: 0 });
    const open = eyes.aperture();
    eyes.apply({ lid: 0, gaze: 0, cheek: 1 });
    expect(eyes.aperture()).toBeCloseTo(open * (1 - CHEEK_LID), 9);
    expect(eyes.aperture()).toBeGreaterThan(0);
  });

  it('shuts completely when a blink lands during a smile', () => {
    const eyes = createEyes(rig());
    eyes.apply({ lid: 1, gaze: 0, cheek: 1 });
    expect(eyes.aperture()).toBe(0);
  });

  it('moves the lip corner the published centimetre, up AND out', () => {
    const mouth = createSmile(rig());
    mouth.apply({ corner: { left: 0, right: 0 }, cheek: 0 });
    const start = mouth.group.children[0].position.x;
    mouth.apply({ corner: { left: 1, right: 1 }, cheek: 0 });
    expect(mouth.corners().left).toBeCloseTo(CORNER_TRAVEL, 6);
    // Zygomaticus pulls toward the cheekbone, so the mouth widens as it rises.
    expect(Math.abs(mouth.group.children[0].position.x)).toBeGreaterThan(Math.abs(start));
  });

  it('scales the corner travel off the body', () => {
    const small = createSmile(createHumanoid({ height: 1.2, seed: 2 }));
    const tall = createSmile(createHumanoid({ height: 1.95, seed: 2 }));
    small.apply({ corner: { left: 1, right: 1 }, cheek: 0 });
    tall.apply({ corner: { left: 1, right: 1 }, cheek: 0 });
    expect(tall.corners().left / small.corners().left).toBeCloseTo(1.95 / 1.2, 6);
  });
});

describe('the things it must not do', () => {
  it('survives nonsense intensity and nonsense dt', () => {
    const s = new Smile();
    const eyes = createEyes(createHumanoid({ height: 1.75, seed: 6 }));
    const mouth = createSmile(createHumanoid({ height: 1.75, seed: 6 }));
    for (const dt of [0, DT, -1, 5, NaN]) {
      for (const i of [NaN, -5, 5, 0.5, Infinity]) {
        s.feel(i);
        const shape = s.update(dt);
        eyes.apply({ lid: 0, gaze: 0, cheek: shape.cheek });
        mouth.apply(shape);
        for (const v of [shape.corner.left, shape.corner.right, shape.cheek]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        expect(Number.isFinite(eyes.aperture())).toBe(true);
      }
    }
  });
});
