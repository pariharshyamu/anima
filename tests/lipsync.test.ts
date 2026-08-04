import { describe, expect, it } from 'vitest';
import {
  JAW_TRAVEL, LIP_BRIDGE, Speech, createMouth, mouthAt, shapedUtterance,
} from '../src/speech';
import { createHumanoid } from '../src/humanoid';

const SHAPE = (open: number, close = 0) => ({ open, round: 0.1, close, spread: 0.1 });

describe('a face driven from outside', () => {
  it('lays out supplied shapes with the durations it was given', () => {
    const track = shapedUtterance([
      { shape: SHAPE(1), seconds: 0.2 },
      { shape: SHAPE(0), seconds: 0.1 },
    ]);
    expect(track).toHaveLength(2);
    expect(track[0].at).toBe(0);
    expect(track[0].duration).toBeCloseTo(0.2, 9);
    expect(track[1].at).toBeCloseTo(0.2, 9);
    expect(track[0].shape).toEqual(SHAPE(1));
  });

  it('uses the supplied shape instead of the phoneme table', () => {
    // The key is a placeholder that is not in PHONEMES; if the lookup were
    // still happening this would come back as the rest posture.
    const track = shapedUtterance([{ shape: SHAPE(1), seconds: 0.4 }]);
    expect(mouthAt(track, 0.2).open).toBeGreaterThan(0.7);
    const shut = shapedUtterance([{ shape: SHAPE(0), seconds: 0.4 }]);
    expect(mouthAt(shut, 0.2).open).toBeLessThan(0.2);
  });

  it('rewinds and replaces rather than appending', () => {
    const speech = new Speech('aba', {});
    const own = speech.track.length;
    expect(own).toBeGreaterThan(0);
    speech.update(0.05);
    speech.follow([{ shape: SHAPE(1), seconds: 0.2 }]);
    expect(speech.track).toHaveLength(1);
    expect(speech.elapsed).toBe(0);
    // ...and a phoneme utterance afterwards carries no supplied shapes.
    speech.say('aba');
    expect(speech.track.some((s) => s.shape)).toBe(false);
  });

  it('holds a supplied shape to the same jaw speed as its own phonemes', () => {
    const speech = new Speech('', {});
    speech.follow([{ shape: SHAPE(0), seconds: 0.05 }, { shape: SHAPE(1), seconds: 0.4 }]);
    let last = speech.shape.open * JAW_TRAVEL;
    let worst = 0;
    for (let i = 0; i < 60; i++) {
      const shape = speech.update(1 / 120);
      const jaw = shape.open * JAW_TRAVEL;
      worst = Math.max(worst, Math.abs(jaw - last) * 120);
      last = jaw;
    }
    // A supplied shape must not be a way around the limiter.
    expect(worst).toBeLessThanOrEqual(0.2 + 1e-9);
  });

  it('shuts the mouth for a supplied seal', () => {
    const rig = createHumanoid({ height: 1.75, seed: 3 });
    const mouth = createMouth(rig);
    const speech = new Speech('', {});
    speech.follow([{ shape: SHAPE(0.1, 1), seconds: 0.3 }]);
    let tightest = Infinity;
    for (let i = 0; i < 36; i++) {
      mouth.apply(speech.update(1 / 120));
      const upper = mouth.group.children[1] as { position: { y: number } };
      const lower = mouth.group.children[2] as { position: { y: number } };
      tightest = Math.min(tightest, Math.max(0, upper.position.y - lower.position.y - 0.0075 * 1.75));
    }
    expect(tightest).toBeLessThan(LIP_BRIDGE * 0.35);
  });

  it('survives an empty track and nonsense shapes', () => {
    const speech = new Speech('', {});
    for (const track of [
      [],
      [{ shape: SHAPE(1), seconds: 0 }],
      [{ shape: SHAPE(0.5), seconds: -1 }],
      [{ shape: { open: 5, round: -3, close: 9, spread: 0 }, seconds: 0.1 }],
    ]) {
      speech.follow(track);
      for (let i = 0; i < 20; i++) {
        const shape = speech.update(1 / 120);
        for (const k of ['open', 'round', 'close', 'spread'] as const) {
          expect(Number.isFinite(shape[k])).toBe(true);
        }
      }
    }
  });
});
