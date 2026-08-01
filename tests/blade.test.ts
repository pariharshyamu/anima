import { describe, expect, it } from 'vitest';
import {
  BALANCE_TOLERANCE,
  BLADES,
  BLADE_NAMES,
  DENSITIES,
  NODE_FRACTION,
  SOLID_ROUND,
  balanceFromCross,
  balancePoint,
  bladeExtension,
  bladeLength,
  bladeMass,
  inertia,
  measureBlade,
  pendulumPeriod,
  percussion,
  segmentMass,
  tubeFill,
  vibrationNodes,
  withPommel,
} from '../src/blade';

const GRAVITY = 9.81;
const rod = BLADES.rod;

describe('a uniform bar, where every answer is on a textbook page', () => {
  it('weighs its volume times its density and nothing else', () => {
    expect(bladeMass(rod)).toBeCloseTo(1 * 0.02 * 0.02 * DENSITIES.steel, 12);
  });

  it('balances at its middle', () => {
    expect(balancePoint(rod)).toBeCloseTo(0.5, 12);
  });

  it('has I = mL²/3 about its end', () => {
    const m = bladeMass(rod);
    expect(inertia(rod, 0)).toBeCloseTo((m * 1 * 1) / 3, 12);
  });

  it('has I = mL²/12 about its centre', () => {
    const m = bladeMass(rod);
    expect(inertia(rod, 0.5)).toBeCloseTo((m * 1 * 1) / 12, 12);
  });

  it('puts its centre of percussion at exactly two thirds', () => {
    expect(percussion(rod, 0)).toBeCloseTo(2 / 3, 12);
  });

  it('swings from its end with a period of 2π√(2L/3g)', () => {
    expect(pendulumPeriod(rod, 0)).toBeCloseTo(2 * Math.PI * Math.sqrt(2 / (3 * GRAVITY)), 12);
  });

  it('puts its bending nodes symmetrically about its middle', () => {
    const [a, b] = vibrationNodes(rod);
    expect(a + b).toBeCloseTo(1, 12);
    expect(a).toBeCloseTo(NODE_FRACTION, 12);
  });

  it('has a node fraction that is a root of cos(βL)·cosh(βL) = 1', () => {
    const beta = 4.73004074;
    expect(Math.cos(beta) * Math.cosh(beta)).toBeCloseTo(1, 6);
    expect(NODE_FRACTION).toBeCloseTo(0.2242, 4);
  });
});

describe('fill is a cross-section, not a fudge', () => {
  it('makes a solid round bar π/4 of its square box', () => {
    expect(SOLID_ROUND).toBeCloseTo(Math.PI / 4, 12);
  });

  it('turns a wall that meets in the middle back into a solid bar', () => {
    expect(tubeFill(0.03, 0.015)).toBeCloseTo(SOLID_ROUND, 12);
    expect(tubeFill(0.03, 0.02)).toBeCloseTo(SOLID_ROUND, 12);
  });

  it('gives a wall-less tube no material at all', () => {
    expect(tubeFill(0.03, 0)).toBe(0);
  });

  it('makes the same wall a smaller fraction of a fatter tube', () => {
    expect(tubeFill(0.03, 0.0012)).toBeLessThan(tubeFill(0.02, 0.0012));
  });
});

describe('a tapered segment does not balance at its midpoint', () => {
  const taper = {
    label: 'blade',
    material: 'steel' as const,
    from: 0,
    to: 1,
    width: [0.05, 0.01] as [number, number],
    thick: [0.01, 0.01] as [number, number],
    fill: 1,
  };

  it('puts the centre of a thick-to-thin bar behind its middle', () => {
    const spec = { label: 't', grip: 0, cross: 0, segments: [taper] };
    // 50 mm down to 10 mm: the centroid lands at (a + 2b)/(3(a + b)) = 0.389.
    expect(balancePoint(spec)).toBeCloseTo((0.05 + 2 * 0.01) / (3 * (0.05 + 0.01)), 12);
    expect(balancePoint(spec)).toBeLessThan(0.5);
  });

  it('reduces to the midpoint when the taper is removed', () => {
    const even = { ...taper, width: [0.03, 0.03] as [number, number] };
    const spec = { label: 't', grip: 0, cross: 0, segments: [even] };
    expect(balancePoint(spec)).toBeCloseTo(0.5, 12);
  });

  it('weighs the mean section times the length times the density', () => {
    expect(segmentMass(taper)).toBeCloseTo(1 * 0.03 * 0.01 * DENSITIES.steel, 12);
  });
});

describe('the table describes objects a museum would recognise', () => {
  it('derives every mass rather than declaring one', () => {
    for (const name of BLADE_NAMES) {
      for (const s of BLADES[name].segments) {
        expect(Object.keys(s)).not.toContain('mass');
      }
    }
  });

  it('weighs an arming sword between 0.9 and 1.4 kg', () => {
    const r = measureBlade('arming');
    expect(r.mass).toBeGreaterThan(0.9);
    expect(r.mass).toBeLessThan(1.4);
  });

  it('quotes the balance from the cross, as a catalogue does', () => {
    expect(balanceFromCross(BLADES.arming)).toBeCloseTo(
      balancePoint(BLADES.arming) - BLADES.arming.cross,
      12
    );
    expect(balanceFromCross(BLADES.arming)).toBeGreaterThan(0.08);
    expect(balanceFromCross(BLADES.arming)).toBeLessThan(0.18);
  });

  it('puts an axe’s mass at the far end and a rapier’s in the hilt', () => {
    expect(measureBlade('axe').balance / measureBlade('axe').length).toBeGreaterThan(0.8);
    expect(measureBlade('rapier').balance / measureBlade('rapier').length).toBeLessThan(0.25);
  });

  it('makes an axe harder to turn than a longer, heavier spear is to carry', () => {
    expect(measureBlade('axe').inertia).toBeGreaterThan(measureBlade('arming').inertia * 3);
  });

  it('reaches further with a spear than with a sword', () => {
    expect(bladeExtension(BLADES.spear)).toBeGreaterThan(bladeExtension(BLADES.arming) * 1.5);
  });
});

describe('the javelin has a rule book, and it is not in the table', () => {
  const r = measureBlade('javelin');

  it('weighs at least the regulation 800 g', () => {
    expect(r.mass).toBeGreaterThanOrEqual(0.8);
    expect(r.mass).toBeLessThan(0.83);
  });

  it('is between 2.60 and 2.70 m long', () => {
    expect(r.length).toBeGreaterThanOrEqual(2.6);
    expect(r.length).toBeLessThanOrEqual(2.7);
  });

  it('balances 0.90 to 1.06 m from the tip — the 1986 rule', () => {
    const fromTip = r.length - r.balance;
    expect(fromTip).toBeGreaterThanOrEqual(0.9);
    expect(fromTip).toBeLessThanOrEqual(1.06);
  });

  it('has a 150-160 mm cord centred on the derived centre of mass', () => {
    const cord = BLADES.javelin.segments.find((s) => s.label === 'cord')!;
    const width = cord.to - cord.from;
    expect(width).toBeGreaterThanOrEqual(0.1499);
    expect(width).toBeLessThanOrEqual(0.1601);
    expect((cord.from + cord.to) / 2).toBeCloseTo(r.balance, 2);
  });
});

describe('held at the balance point, a weapon stops being a weapon', () => {
  it('gives a javelin no pendulum period at all', () => {
    expect(pendulumPeriod(BLADES.javelin)).toBe(Infinity);
  });

  it('gives it no centre of percussion either', () => {
    expect(percussion(BLADES.javelin)).toBe(Infinity);
    expect(measureBlade('javelin').sweetSpot).toBe(Infinity);
  });

  it('grows the period without bound as the pivot closes on the balance', () => {
    const sword = BLADES.arming;
    const bal = balancePoint(sword);
    const periods = [0.2, 0.1, 0.05, 0.02, 0.01].map((gap) => pendulumPeriod(sword, bal - gap));
    for (let i = 1; i < periods.length; i++) expect(periods[i]).toBeGreaterThan(periods[i - 1]);
  });

  it('reports the limit rather than a large number inside the tolerance', () => {
    const sword = BLADES.arming;
    const bal = balancePoint(sword);
    expect(pendulumPeriod(sword, bal - BALANCE_TOLERANCE / 2)).toBe(Infinity);
    expect(Number.isFinite(pendulumPeriod(sword, bal - BALANCE_TOLERANCE * 2))).toBe(true);
  });

  it('gives every weapon held OFF its balance both numbers', () => {
    for (const name of BLADE_NAMES) {
      if (name === 'javelin') continue;
      const r = measureBlade(name);
      expect(Number.isFinite(r.period)).toBe(true);
      expect(r.period).toBeGreaterThan(0);
      const cop = percussion(BLADES[name]);
      expect(cop).toBeGreaterThan(BLADES[name].grip);
      expect(cop).toBeLessThanOrEqual(bladeLength(BLADES[name]));
    }
  });
});

describe('the sweet spot is measured from the hand', () => {
  it('is the centre of percussion between the hand and the tip', () => {
    for (const name of BLADE_NAMES) {
      if (name === 'javelin') continue;
      const spec = BLADES[name];
      const r = measureBlade(name);
      expect(r.sweetSpot).toBeCloseTo(
        (percussion(spec) - spec.grip) / (bladeLength(spec) - spec.grip),
        12
      );
    }
  });

  it('lands past the cross on every weapon, pole arms included', () => {
    for (const name of BLADE_NAMES) {
      if (name === 'javelin') continue;
      expect(percussion(BLADES[name])).toBeGreaterThan(BLADES[name].cross);
    }
  });
});

describe('a pommel is one added mass and three disagreeing sums', () => {
  const before = BLADES.longsword;
  const after = withPommel(before, 200);

  it('adds exactly the mass it was given', () => {
    expect(bladeMass(after) - bladeMass(before)).toBeCloseTo(0.2, 9);
  });

  it('pulls the balance point back toward the hand', () => {
    expect(balancePoint(after)).toBeLessThan(balancePoint(before) - 0.01);
  });

  it('costs almost nothing about the hand, because it sits on the pivot', () => {
    const cost = (inertia(after) - inertia(before)) / inertia(before);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.02);
  });

  it('is paid for in free rotation, which is what "slower" means', () => {
    const free = (inertia(after, balancePoint(after)) - inertia(before, balancePoint(before))) /
      inertia(before, balancePoint(before));
    expect(free).toBeGreaterThan(0.05);
  });

  it('lengthens the swing period rather than shortening it', () => {
    expect(pendulumPeriod(after)).toBeGreaterThan(pendulumPeriod(before));
  });

  it('leaves the original spec untouched', () => {
    expect(bladeMass(BLADES.longsword)).toBeCloseTo(bladeMass(before), 12);
    expect(before.segments[0].fill).not.toBe(after.segments[0].fill);
  });

  it('does nothing for a negative pommel', () => {
    expect(bladeMass(withPommel(before, -50))).toBeCloseTo(bladeMass(before), 12);
  });
});

describe('measureBlade agrees with the primitives it is made of', () => {
  it('reports what each function reports, for every weapon', () => {
    for (const name of BLADE_NAMES) {
      const spec = BLADES[name];
      const r = measureBlade(name);
      expect(r.mass).toBeCloseTo(bladeMass(spec), 12);
      expect(r.length).toBeCloseTo(bladeLength(spec), 12);
      expect(r.balance).toBeCloseTo(balancePoint(spec), 12);
      expect(r.fromCross).toBeCloseTo(balanceFromCross(spec), 12);
      expect(r.inertia).toBeCloseTo(inertia(spec), 12);
      expect(r.extension).toBeCloseTo(bladeExtension(spec), 12);
    }
  });

  it('never returns a negative or zero mass', () => {
    for (const name of BLADE_NAMES) expect(measureBlade(name).mass).toBeGreaterThan(0);
  });
});
