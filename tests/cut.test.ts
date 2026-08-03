import { describe, expect, it } from 'vitest';
import { BLADES, sectionAt } from '../src/blade';
import {
  EDGES,
  EDGE_NAMES,
  TARGETS,
  TARGET_NAMES,
  bluntestThatBites,
  cutDepth,
  edgeArea,
  engagedLength,
  griffith,
  initiationForce,
  measureCut,
  measureThrust,
  pressure,
  propagationForce,
  tipArea,
} from '../src/cut';

describe('an edge is a line and a point is an area', () => {
  it('gives an edge apex 2rL', () => {
    expect(edgeArea(1e-6, 0.1)).toBeCloseTo(2e-7, 18);
  });

  it('gives a point πr²', () => {
    expect(tipArea(1e-5)).toBeCloseTo(Math.PI * 1e-10, 22);
  });

  it('gives neither of them area at zero or negative radius', () => {
    expect(edgeArea(0, 0.1)).toBe(0);
    expect(edgeArea(-1, 0.1)).toBe(0);
    expect(tipArea(0)).toBe(0);
    expect(tipArea(-1)).toBe(0);
  });

  it('concentrates a thrust far harder than a cut at the same force', () => {
    const thrust = pressure(150, tipArea(1e-5));
    const cut = pressure(150, edgeArea(EDGES.sharp, 0.03));
    expect(thrust / cut).toBeGreaterThan(20);
  });

  it('makes zero area infinite pressure rather than a number', () => {
    expect(pressure(1, 0)).toBe(Infinity);
  });
});

describe('a curved edge meets a flat target on a chord', () => {
  it('is 2√(2Rδ)', () => {
    expect(engagedLength(0.9, 0.001, 10)).toBeCloseTo(2 * Math.sqrt(2 * 0.9 * 0.001), 12);
  });

  it('grows as the square root of the bite, not linearly', () => {
    const a = engagedLength(0.9, 0.001, 10);
    const b = engagedLength(0.9, 0.004, 10);
    expect(b / a).toBeCloseTo(2, 12);
  });

  it('leaves a straight blade lying along everything it is given', () => {
    expect(engagedLength(Infinity, 0.001, 0.2)).toBe(0.2);
    expect(engagedLength(undefined, 0.001, 0.2)).toBe(0.2);
    expect(engagedLength(0, 0.001, 0.2)).toBe(0.2);
  });

  it('never engages more edge than the blade was laid across', () => {
    expect(engagedLength(0.9, 0.05, 0.02)).toBe(0.02);
  });

  it('makes the axe the shortest contact in the table', () => {
    const bite = 0.001;
    const offered = 0.2;
    const axe = engagedLength(BLADES.axe.curve, bite, offered);
    const sabre = engagedLength(BLADES.sabre.curve, bite, offered);
    const straight = engagedLength(BLADES.arming.curve, bite, offered);
    expect(axe).toBeLessThan(sabre);
    expect(sabre).toBeLessThan(straight);
  });
});

describe('the materials are published, and derived where they can be', () => {
  it('computes toughness as K²/E', () => {
    expect(griffith(50e6, 200e9)).toBeCloseTo(12500, 9);
    expect(griffith(1e6, 0)).toBe(0);
  });

  it('gives every target a strength, a toughness and a density in SI', () => {
    for (const name of TARGET_NAMES) {
      const t = TARGETS[name];
      expect(t.strength).toBeGreaterThan(1e5);
      expect(t.strength).toBeLessThan(1e10);
      expect(t.toughness).toBeGreaterThan(10);
      expect(t.toughness).toBeLessThan(1e6);
      expect(t.density).toBeGreaterThan(100);
    }
  });

  it('keeps strength and toughness independent', () => {
    // Mail is far stronger than leather and barely tougher. If those ever move
    // together the table has become one number wearing two names.
    expect(TARGETS.mail.strength).toBeGreaterThan(TARGETS.leather.strength * 10);
    expect(TARGETS.mail.toughness).toBeLessThan(TARGETS.leather.toughness * 2);
  });

  it('makes pine an order of magnitude cheaper along the grain', () => {
    expect(TARGETS.pine.toughness).toBeGreaterThan(TARGETS.pineSplit.toughness * 5);
  });
});

describe('the two criteria, and how far apart they are', () => {
  const skin = TARGETS.skin;

  it('starts a cut in skin with a sharp point at milli-newtons', () => {
    const f = initiationForce(skin, tipArea(1e-5));
    expect(f).toBeLessThan(0.05);
    expect(f).toBeGreaterThan(0);
  });

  it('continues one at tens of newtons — the band knives are measured in', () => {
    expect(propagationForce(skin, 0.004)).toBeGreaterThan(5);
    expect(propagationForce(skin, 0.004)).toBeLessThan(25);
    expect(propagationForce(skin, 0.02)).toBeGreaterThan(25);
    expect(propagationForce(skin, 0.02)).toBeLessThan(90);
  });

  it('reports the disagreement rather than burying it', () => {
    const r = measureThrust({ energy: 60, force: 150, radius: 1e-5, width: 0.02 }, skin);
    expect(r.disagreement).toBeGreaterThan(1000);
    expect(r.toContinue / r.toStart).toBeCloseTo(r.disagreement, 6);
  });

  it('keeps skin the barrier that muscle is not', () => {
    expect(propagationForce(skin, 0.02)).toBeGreaterThan(propagationForce(TARGETS.muscle, 0.02) * 2);
  });
});

describe('sharpness decides whether a cut starts', () => {
  const skin = TARGETS.skin;

  it('makes pressure inversely proportional to the apex radius', () => {
    const at = (r: number) =>
      measureCut({ energy: 60, force: 300, radius: r, width: 0.02, contact: 0.15 }, skin).pressure;
    expect(at(1e-6) / at(2e-6)).toBeCloseTo(2, 9);
    expect(at(1e-6) / at(1e-5)).toBeCloseTo(10, 9);
  });

  it('cuts skin with a razor and does not with a bar', () => {
    const swing = { energy: 60, force: 300, width: 0.02, contact: 0.15 };
    expect(measureCut({ ...swing, radius: EDGES.razor }, skin).bites).toBe(true);
    expect(measureCut({ ...swing, radius: EDGES.dull }, skin).bites).toBe(false);
  });

  it('orders the edge presets from keen to blunt', () => {
    for (let i = 1; i < EDGE_NAMES.length; i++) {
      expect(EDGES[EDGE_NAMES[i]]).toBeGreaterThan(EDGES[EDGE_NAMES[i - 1]]);
    }
  });
});

describe('bluntestThatBites is checked against its own inverse', () => {
  it('lands the pressure exactly on the strength, for every target', () => {
    for (const name of TARGET_NAMES) {
      const t = TARGETS[name];
      const r = bluntestThatBites(t, 250, 0.15);
      const got = measureCut({ energy: 50, force: 250, radius: r, width: 0.02, contact: 0.15 }, t);
      expect(got.pressure / t.strength).toBeCloseTo(1, 9);
    }
  });

  it('bites a hair keener and does not a hair blunter', () => {
    const t = TARGETS.leather;
    const r = bluntestThatBites(t, 250, 0.15);
    const at = (radius: number) =>
      measureCut({ energy: 50, force: 250, radius, width: 0.02, contact: 0.15 }, t).bites;
    expect(at(r * 0.999)).toBe(true);
    expect(at(r * 1.001)).toBe(false);
  });

  it('lets a blunter edge bite if you push harder', () => {
    const t = TARGETS.skin;
    expect(bluntestThatBites(t, 500, 0.15)).toBeGreaterThan(bluntestThatBites(t, 250, 0.15));
  });
});

describe('the depth is a bound, and behaves like one', () => {
  const pine = TARGETS.pine;

  it('is exactly E/(R·w)', () => {
    expect(cutDepth(100, pine, 0.02)).toBeCloseTo(100 / (pine.toughness * 0.02), 12);
  });

  it('scales with energy and against width', () => {
    expect(cutDepth(200, pine, 0.02)).toBeCloseTo(2 * cutDepth(100, pine, 0.02), 12);
    expect(cutDepth(100, pine, 0.04)).toBeCloseTo(cutDepth(100, pine, 0.02) / 2, 12);
  });

  it('gives negative energy nothing', () => {
    expect(cutDepth(-5, pine, 0.02)).toBe(0);
  });

  it('is enormous, which is the honest state of it', () => {
    // A 113 J swing bounds at metres into pine. It is named a bound because it
    // is one: no friction, no wedging, no pushing the target.
    expect(cutDepth(113, pine, 0.03)).toBeGreaterThan(0.5);
  });

  it('goes nowhere when the cut never bit, however much energy is behind it', () => {
    const r = measureCut(
      { energy: 5000, force: 20, radius: EDGES.dull, width: 0.02, contact: 0.2 },
      TARGETS.mail
    );
    expect(r.bites).toBe(false);
    expect(r.depthBound).toBe(0);
    expect(r.work).toBe(0);
  });
});

describe('curvature is a pressure multiplier', () => {
  const leather = TARGETS.leather;
  const swing = { energy: 60, force: 200, radius: EDGES.sharp, width: 0.02, contact: 0.2 };

  it('more than doubles a sabre’s pressure over a straight blade', () => {
    const flat = measureCut(swing, leather);
    const curved = measureCut({ ...swing, curve: BLADES.sabre.curve }, leather);
    expect(curved.pressure).toBeGreaterThan(flat.pressure * 2);
  });

  it('does not make a blunt axe out-pressure a sharp sword', () => {
    const axe = measureCut({ ...swing, radius: EDGES.blunt, curve: BLADES.axe.curve }, leather);
    const sword = measureCut({ ...swing, curve: BLADES.arming.curve }, leather);
    expect(axe.pressure).toBeLessThan(sword.pressure);
    expect(axe.engaged).toBeLessThan(sword.engaged / 4);
  });
});

describe('sectionAt reads the blade where it touched', () => {
  it('interpolates along the taper', () => {
    const blade = BLADES.arming.segments[3];
    const mid = (blade.from + blade.to) / 2;
    expect(sectionAt(BLADES.arming, mid).width).toBeCloseTo((blade.width[0] + blade.width[1]) / 2, 12);
  });

  it('returns the ends exactly', () => {
    const blade = BLADES.arming.segments[3];
    expect(sectionAt(BLADES.arming, blade.to).width).toBeCloseTo(blade.width[1], 12);
  });

  it('has nothing past the tip or behind the butt', () => {
    expect(sectionAt(BLADES.arming, 5).width).toBe(0);
    expect(sectionAt(BLADES.arming, -1).width).toBe(0);
  });

  it('narrows toward the point on every bladed weapon', () => {
    for (const name of ['arming', 'longsword', 'rapier', 'sabre'] as const) {
      const spec = BLADES[name];
      const tip = spec.segments[spec.segments.length - 1].to;
      const near = sectionAt(spec, spec.cross + (tip - spec.cross) * 0.2).width;
      const far = sectionAt(spec, spec.cross + (tip - spec.cross) * 0.9).width;
      expect(far).toBeLessThan(near);
    }
  });
});
