import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { BLADES, inertia } from '../src/blade';
import { createHumanoid } from '../src/humanoid';
import {
  Fence, Fencer, bladeTorque, cutTime, fencerCard, footSpeed,
  measureOf, poseSwordArm, stepLength, stepTime,
} from '../src/fencing';

const rig = createHumanoid({ seed: 42 });
const theta = (120 * Math.PI) / 180;

describe('the blade sets the tempo', () => {
  const tau = bladeTorque(BLADES.arming, 1);

  it('is √(2θI/τ)', () => {
    expect(cutTime(BLADES.arming, theta, tau)).toBeCloseTo(
      Math.sqrt((2 * theta * inertia(BLADES.arming)) / tau), 12);
  });

  it('scales as the square root of angle and inversely of torque', () => {
    expect(cutTime(BLADES.arming, theta * 4, tau) / cutTime(BLADES.arming, theta, tau)).toBeCloseTo(2, 12);
    expect(cutTime(BLADES.arming, theta, tau * 4) / cutTime(BLADES.arming, theta, tau)).toBeCloseTo(0.5, 12);
  });

  it('never swings with no torque on it', () => {
    expect(cutTime(BLADES.arming, theta, 0)).toBe(Infinity);
  });

  it('makes a heavier blade slower by exactly the root of the inertia ratio', () => {
    expect(cutTime(BLADES.longsword, theta, tau) / cutTime(BLADES.arming, theta, tau)).toBeCloseTo(
      Math.sqrt(inertia(BLADES.longsword) / inertia(BLADES.arming)), 12);
  });

  it('nearly cancels the longsword’s inertia against its two-handed couple', () => {
    const one = fencerCard(rig, { blade: 'arming', hands: 1 });
    const two = fencerCard(rig, { blade: 'longsword', hands: 2 });
    expect(two.inertia).toBeGreaterThan(one.inertia * 1.5);
    expect(two.torque).toBeGreaterThan(one.torque * 1.5);
    expect(Math.abs(two.tempo / one.tempo - 1)).toBeLessThan(0.25);
  });
});

describe('measure and footwork are measurements', () => {
  it('gives a spear a much longer measure than a sword', () => {
    expect(measureOf(rig, BLADES.spear)).toBeGreaterThan(measureOf(rig, BLADES.arming) * 1.3);
  });

  it('makes a step a leg pendulum, π√(L/g)', () => {
    expect(stepTime(rig)).toBeCloseTo(Math.PI * Math.sqrt(rig.legLength / 9.81), 12);
  });

  it('makes foot speed step over step time', () => {
    expect(footSpeed(rig, 'boxing')).toBeCloseTo(stepLength(rig, 'boxing') / stepTime(rig), 12);
  });

  it('steps further in a longer stance', () => {
    expect(stepLength(rig, 'karate')).toBeGreaterThan(stepLength(rig, 'boxing'));
  });
});

function bout(aBlade: 'arming' | 'longsword' | 'spear', seconds = 30) {
  const a = new Fencer(createHumanoid({ seed: 42 }), {
    blade: aBlade, hands: aBlade === 'arming' ? 1 : 2, at: new Vector3(-1.8, 0, 0),
  });
  const b = new Fencer(createHumanoid({ seed: 7 }), { blade: 'arming', at: new Vector3(1.8, 0, 0) });
  const f = new Fence(a, b, { roundSeconds: seconds });
  let lo = Infinity, hi = 0;
  const phases = new Set<string>();
  while (!f.done) {
    f.update(1 / 60);
    poseSwordArm(a);
    poseSwordArm(b);
    lo = Math.min(lo, f.gap); hi = Math.max(hi, f.gap);
    phases.add(a.phase);
  }
  return { a, b, f, lo, hi, phases };
}

describe('the bout does not stand still', () => {
  const r = bout('arming');

  it('walks both fencers metres across the floor', () => {
    expect(r.a.travelled).toBeGreaterThan(3);
    expect(r.b.travelled).toBeGreaterThan(3);
  });

  it('opens and closes the distance rather than holding one gap', () => {
    expect(r.hi - r.lo).toBeGreaterThan(1);
  });

  it('enters every phase', () => {
    for (const p of ['measure', 'windup', 'cut', 'recover']) expect(r.phases.has(p)).toBe(true);
  });

  it('is neither a standoff nor a metronome', () => {
    const n = r.a.attacks + r.b.attacks;
    expect(n).toBeGreaterThan(6);
    expect(n).toBeLessThan(60);
  });

  it('lets Bind decide some of the arrivals', () => {
    expect(r.f.touches.filter((t) => t.parried).length).toBeGreaterThan(0);
  });

  it('never lets the two bodies occupy the same place', () => {
    expect(r.lo).toBeGreaterThan(r.a.rig.obstacleRadius);
  });
});

describe('the reach band is a subtraction', () => {
  const r = bout('spear');

  it('lets the spear out-measure the sword', () => {
    expect(r.a.measure).toBeGreaterThan(r.b.measure * 1.3);
  });

  it('gives it the exchange', () => {
    expect(r.a.touches).toBeGreaterThan(r.b.touches * 2);
  });

  it('attacks from inside its own measure and outside the other’s', () => {
    expect(r.a.inBand).toBeGreaterThan(0);
  });
});

describe('the bout is not a frame rate', () => {
  it('runs the same at 60 and 240', () => {
    const coarse = bout('arming', 20);
    const a = new Fencer(createHumanoid({ seed: 42 }), { blade: 'arming', at: new Vector3(-1.8, 0, 0) });
    const b = new Fencer(createHumanoid({ seed: 7 }), { blade: 'arming', at: new Vector3(1.8, 0, 0) });
    const f = new Fence(a, b, { roundSeconds: 20 });
    while (!f.done) { f.update(1 / 240); poseSwordArm(a); poseSwordArm(b); }
    expect(Math.abs(f.elapsed - coarse.f.elapsed)).toBeLessThan(0.05);
    expect(Math.abs(a.travelled - coarse.a.travelled) / coarse.a.travelled).toBeLessThan(0.15);
  });
});
