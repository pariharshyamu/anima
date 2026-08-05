import { describe, expect, it } from 'vitest';
import {
  ACCENT_SEMITONES, BASELINE_TAU, BROW_FLASH, BROW_SPEED, BROW_TRAVEL, Brows, createBrows,
} from '../src/brows';
import { createHumanoid } from '../src/humanoid';

const RATE = 1 / 120;
const settle = (b: Brows, seconds = 1) => {
  for (let i = 0; i < seconds * 120; i++) b.update(RATE);
  return b.shape.raise;
};

describe('the constants are derived, not chosen', () => {
  it('gets the speed limit out of the flash, so it moves when either does', () => {
    // Eibl-Eibesfeldt filmed the greeting flash at a sixth of a second. Up is
    // half of it, and the travel is the frontalis's ten millimetres.
    expect(BROW_SPEED).toBeCloseTo(BROW_TRAVEL / (BROW_FLASH / 2), 12);
  });

  it('puts the baseline between a syllable and a phrase', () => {
    // Slower than a syllable or it tracks the accent; faster than a phrase or
    // it cannot follow the drift.
    expect(BASELINE_TAU).toBeGreaterThan(0.19);
    expect(BASELINE_TAU).toBeLessThan(3);
  });
});

describe('the brow follows a contour', () => {
  it('rises on pitch above its baseline and falls back to it', () => {
    // A CONSTANT pitch is not an accent — it IS the baseline, and asks for
    // nothing. The floor has to be established before an excursion means
    // anything, which is why this starts at one semitone and steps to six.
    const b = new Brows();
    let pitch = 1;
    b.attach(() => pitch);
    settle(b, 1);
    expect(b.shape.raise).toBeLessThan(0.05);
    pitch = 1 + ACCENT_SEMITONES;
    expect(settle(b, 0.5)).toBeGreaterThan(0.9);
    pitch = 1;
    expect(settle(b, 0.5)).toBeLessThan(0.05);
  });

  it('asks for nothing at all from a monotone, because a monotone has no accents', () => {
    for (const level of [-4, 0.5, 6]) {
      const b = new Brows();
      b.attach(() => level);
      expect(settle(b, 3)).toBeLessThan(0.02);
    }
  });

  it('measures the accent against a FLOOR, so declination does not lower it', () => {
    // Two accents of the same height on a contour that has drifted down two
    // semitones between them must raise the brow the same amount.
    const b = new Brows();
    let t = 0;
    const contour = (s: number) => {
      const floor = 2 - 0.55 * s;
      const accent = s % 1 < 0.2 ? ACCENT_SEMITONES : 0;
      return floor + accent;
    };
    b.attach(() => contour(t), { clock: () => t });
    const peaks: number[] = [];
    for (let i = 0; i < 6 * 120; i++) {
      t += RATE;
      b.update(RATE);
      if (Math.abs((t % 1) - 0.15) < RATE / 2) peaks.push(b.shape.raise);
    }
    const first = peaks[1];
    const last = peaks[peaks.length - 1];
    // The residual is the lag of a first-order filter on a ramp: rate x tau.
    const lag = (0.55 * BASELINE_TAU) / ACCENT_SEMITONES;
    expect(last / first).toBeGreaterThan(1 - lag);
  });

  it('never lets the baseline rise inside a phrase', () => {
    // The brow comes back down only because the PITCH does, never because the
    // floor climbed underneath it. A held accent is held: this is a question's
    // terminal rise, and it should stay up until the line ends.
    const b = new Brows();
    let pitch = 1;
    b.attach(() => pitch);
    settle(b, 1);
    pitch = 1 + ACCENT_SEMITONES;
    settle(b, 0.5);
    expect(b.shape.raise).toBeGreaterThan(0.9);
    // Five seconds later — many baseline time constants — it is still up.
    expect(settle(b, 5)).toBeGreaterThan(0.9);
  });

  it('holds its line through a pause, so the next phrase does not shout', () => {
    const b = new Brows();
    let pitch = 3;
    b.attach(() => pitch);
    settle(b, 1);
    pitch = 0;                // exactly zero is silence, not a low note
    settle(b, 1);
    expect(b.shape.raise).toBeLessThan(0.05);
    pitch = 3;                // the same pitch as before the pause
    expect(settle(b, 0.5)).toBeLessThan(0.3);
  });
});

describe('it goes through the muscle', () => {
  it('cannot move faster than a brow moves', () => {
    const b = new Brows();
    let pitch = 0;
    b.attach(() => pitch);
    settle(b, 1);
    pitch = 99;
    let worst = 0;
    let last = b.shape.raise;
    for (let i = 0; i < 120; i++) {
      const s = b.update(RATE);
      worst = Math.max(worst, Math.abs(s.raise - last) * BROW_TRAVEL * 120);
      last = s.raise;
    }
    expect(worst).toBeLessThanOrEqual(BROW_SPEED + 1e-9);
  });

  it('reaches the top on a greeting flash and comes back down', () => {
    const b = new Brows();
    b.flash();
    let peak = 0;
    for (let i = 0; i < 120; i++) peak = Math.max(peak, b.update(RATE).raise);
    expect(peak).toBeGreaterThan(0.95);
    expect(settle(b, 1)).toBeLessThan(0.05);
  });
});

describe('the things it must not do', () => {
  it('clamps whatever the source returns', () => {
    const b = new Brows();
    for (const bad of [() => NaN, () => Infinity, () => -1e9, () => undefined as unknown as number]) {
      b.attach(bad);
      for (let i = 0; i < 60; i++) {
        const s = b.update(RATE);
        expect(Number.isFinite(s.raise)).toBe(true);
        expect(s.raise).toBeGreaterThanOrEqual(0);
        expect(s.raise).toBeLessThanOrEqual(1);
      }
    }
  });

  it('comes back to rest when detached', () => {
    const b = new Brows();
    b.attach(() => 20);
    settle(b, 1);
    expect(b.live).toBe(true);
    b.detach();
    expect(b.live).toBe(false);
    expect(settle(b, 2)).toBeLessThan(0.01);
  });

  it('moves the RIG, not just the controller', () => {
    const rig = createHumanoid({ height: 1.75, seed: 5 });
    const prop = createBrows(rig);
    const rest = prop.group.children[0].position.y;
    prop.apply({ raise: 1 });
    const lifted = prop.group.children[0].position.y;
    expect(lifted - rest).toBeCloseTo(BROW_TRAVEL, 6);
    // Both brows, and only by what a brow travels.
    expect(prop.group.children[1].position.y).toBeCloseTo(lifted, 12);
    prop.apply({ raise: NaN });
    expect(Number.isFinite(prop.group.children[0].position.y)).toBe(true);
  });

  it('scales the lift off the body, like every other length here', () => {
    const small = createBrows(createHumanoid({ height: 1.2, seed: 1 }));
    const tall = createBrows(createHumanoid({ height: 1.95, seed: 1 }));
    small.apply({ raise: 1 });
    tall.apply({ raise: 1 });
    const ratio = tall.group.children[0].position.y / small.group.children[0].position.y;
    expect(ratio).toBeCloseTo(1.95 / 1.2, 6);
  });
});
