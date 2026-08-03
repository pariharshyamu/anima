import { describe, expect, it } from 'vitest';
import { BLADES, balancePoint, bladeMass, shiftBalance } from '../src/blade';
import {
  AIR_DENSITY,
  CROSSFLOW_DRAG,
  SKIN_FRICTION,
  aeroOf,
  ballisticRange,
  flyJavelin,
  staticMargin,
} from '../src/javelin';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const modern = BLADES.javelin;
const older = shiftBalance(modern, -0.04);

describe('shiftBalance moves mass without changing anything else', () => {
  it('preserves the total mass exactly', () => {
    expect(bladeMass(older)).toBeCloseTo(bladeMass(modern), 12);
  });

  it('moves the balance by exactly what was asked, and linearly', () => {
    expect(balancePoint(older)).toBeCloseTo(balancePoint(modern) - 0.04, 12);
    expect(balancePoint(shiftBalance(modern, -0.08))).toBeCloseTo(balancePoint(modern) - 0.08, 12);
    expect(balancePoint(shiftBalance(modern, 0.02))).toBeCloseTo(balancePoint(modern) + 0.02, 12);
  });

  it('leaves the external shape untouched', () => {
    const a = aeroOf(modern);
    const b = aeroOf(older);
    expect(b.volume).toBeCloseTo(a.volume, 15);
    expect(b.planform).toBeCloseTo(a.planform, 15);
    expect(b.wetted).toBeCloseTo(a.wetted, 15);
    expect(b.centreOfPressure).toBeCloseTo(a.centreOfPressure, 15);
    expect(b.length).toBe(a.length);
  });

  it('returns the same object for a zero shift', () => {
    expect(shiftBalance(modern, 0)).toBe(modern);
  });

  it('refuses a shift there is not enough mass for', () => {
    expect(shiftBalance(modern, -5)).toBe(modern);
    expect(shiftBalance(modern, 5)).toBe(modern);
  });
});

describe('the aerodynamic body comes off the segment table', () => {
  const b = aeroOf(modern);

  it('is a javelin in every SI quantity', () => {
    expect(b.mass).toBeGreaterThan(0.79);
    expect(b.mass).toBeLessThan(0.83);
    expect(b.volume).toBeGreaterThan(5e-4);
    expect(b.volume).toBeLessThan(2e-3);
    expect(b.inertia).toBeGreaterThan(0.2);
    expect(b.inertia).toBeLessThan(0.6);
  });

  it('makes the skin exactly π times the planform, for a round body', () => {
    expect(b.wetted / b.planform).toBeCloseTo(Math.PI, 9);
  });

  it('puts the centre of pressure behind the balance', () => {
    expect(b.centreOfPressure).toBeLessThan(b.balance);
  });
});

describe('the static margin has a sign convention and it means something', () => {
  it('calls the modern javelin stable', () => {
    expect(staticMargin(aeroOf(modern))).toBeGreaterThan(0);
  });

  it('makes a forward balance more stable, by the shift over the length', () => {
    const a = aeroOf(modern);
    const o = aeroOf(older);
    expect(staticMargin(a)).toBeGreaterThan(staticMargin(o));
    expect(staticMargin(a) - staticMargin(o)).toBeCloseTo(0.04 / a.length, 12);
  });

  it('calls a body with its mass behind the pressure unstable', () => {
    const a = aeroOf(modern);
    expect(staticMargin({ ...a, balance: a.centreOfPressure - 0.1 })).toBeLessThan(0);
    expect(staticMargin({ ...a, balance: a.centreOfPressure })).toBeCloseTo(0, 15);
  });

  it('is zero for a body with no length rather than dividing by it', () => {
    expect(staticMargin({ ...aeroOf(modern), length: 0 })).toBe(0);
  });
});

describe('the cannonball it has to beat', () => {
  it('is v²sin(2θ)/g from the ground', () => {
    expect(ballisticRange(30, rad(45), 0)).toBeCloseTo(900 / 9.81, 9);
    expect(ballisticRange(30, rad(30), 0)).toBeCloseTo((900 * Math.sin(rad(60))) / 9.81, 9);
  });

  it('goes further from higher up', () => {
    expect(ballisticRange(30, rad(34), 1.8)).toBeGreaterThan(ballisticRange(30, rad(34), 0));
  });
});

describe('a javelin flies rather than tumbling', () => {
  const body = aeroOf(modern);
  const flight = flyJavelin(body, { speed: 30, angle: rad(34), attack: rad(5) });

  it('keeps the angle of attack inside anything recognisable', () => {
    expect(deg(flight.peakAttack)).toBeLessThan(45);
  });

  it('beats a cannonball from the same release', () => {
    expect(flight.range).toBeGreaterThan(ballisticRange(30, rad(34), 1.8));
  });

  it('arrives point-first, which is what the rule demanded', () => {
    expect(flight.pointFirst).toBe(true);
    expect(flight.landingPitch).toBeLessThan(0);
  });

  it('takes a javelin’s time and reaches a javelin’s height', () => {
    expect(flight.duration).toBeGreaterThan(3);
    expect(flight.duration).toBeLessThan(6);
    expect(flight.apex).toBeGreaterThan(10);
    expect(flight.apex).toBeLessThan(30);
  });

  it('reports the drag the integrator actually used', () => {
    expect(flight.releaseDrag).toBeCloseTo(
      0.5 * AIR_DENSITY * 900 * SKIN_FRICTION * body.wetted,
      12
    );
    expect(flight.releaseDragFraction).toBeGreaterThan(0.035);
    expect(flight.releaseDragFraction).toBeLessThan(0.07);
  });

  it('does not depend on the timestep', () => {
    const finer = flyJavelin(body, { speed: 30, angle: rad(34), attack: rad(5), step: 0.0005 });
    expect(Math.abs(finer.range - flight.range) / flight.range).toBeLessThan(0.005);
  });

  it('folds the landing attitude into something readable', () => {
    expect(Math.abs(flight.landingPitch)).toBeLessThanOrEqual(Math.PI);
    expect(flight.landingAttitude).toBeGreaterThanOrEqual(0);
    expect(flight.landingAttitude).toBeLessThanOrEqual(Math.PI / 2);
  });
});

describe('the 1986 rule change, as a one-variable experiment', () => {
  const now = aeroOf(modern);
  const old = aeroOf(older);
  const grid: { cost: number; flatter: boolean; holdsMore: boolean; angle: number }[] = [];
  for (const speed of [28, 30, 32]) {
    for (const angle of [32, 36, 40]) {
      for (const attack of [0, 6, 12]) {
        const o = { speed, angle: rad(angle), attack: rad(attack) };
        const a = flyJavelin(now, o);
        const b = flyJavelin(old, o);
        grid.push({
          cost: (b.range - a.range) / b.range,
          flatter: b.landingAttitude < a.landingAttitude,
          holdsMore: b.peakAttack > a.peakAttack,
          angle,
        });
      }
    }
  }

  it('costs range at every one of 27 releases', () => {
    expect(grid.filter((g) => g.cost <= 0)).toHaveLength(0);
  });

  it('makes the old javelin hold more angle of attack, every time', () => {
    expect(grid.filter((g) => !g.holdsMore)).toHaveLength(0);
  });

  it('lands the old one flatter at every competitive release angle', () => {
    expect(grid.filter((g) => g.angle <= 36 && !g.flatter)).toHaveLength(0);
  });

  it('reverses that at 40°, where the throw has gone ballistic', () => {
    expect(grid.filter((g) => g.angle > 36 && !g.flatter).length).toBeGreaterThan(0);
  });

  it('costs 1-2%, not the 10% the rule delivered, and does not pretend otherwise', () => {
    const mean = grid.reduce((a, g) => a + g.cost, 0) / grid.length;
    expect(mean).toBeGreaterThan(0.003);
    expect(mean).toBeLessThan(0.04);
  });
});

describe('the constants are published ones', () => {
  it('has not moved them', () => {
    expect(AIR_DENSITY).toBe(1.225);
    expect(CROSSFLOW_DRAG).toBe(1.2);
    expect(SKIN_FRICTION).toBe(0.004);
  });
});
