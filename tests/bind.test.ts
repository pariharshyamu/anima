import { describe, expect, it } from 'vitest';
import { BLADES } from '../src/blade';
import {
  HAND_FORCE,
  PALM_SPAN,
  STEEL_FRICTION,
  TWO_HAND_SPAN,
  bindForce,
  bindSensitivity,
  bindsOrSlips,
  crossing,
  frictionAngle,
  gripSpan,
  handCouple,
  leverage,
  measureBind,
  wind,
} from '../src/bind';

const rad = (d: number) => (d * Math.PI) / 180;

describe('a bind is where two lines cross', () => {
  const east = { hand: { x: 0, y: 0 }, angle: rad(45), length: 2 };
  const west = { hand: { x: 1, y: 0 }, angle: rad(135), length: 2 };

  it('meets two 45° blades at the point geometry says', () => {
    const x = crossing(east, west)!;
    expect(x.point.x).toBeCloseTo(0.5, 12);
    expect(x.point.y).toBeCloseTo(0.5, 12);
    expect(x.alongA).toBeCloseTo(Math.SQRT1_2, 12);
    expect(x.alongB).toBeCloseTo(Math.SQRT1_2, 12);
    expect(x.angle).toBeCloseTo(Math.PI / 2, 12);
    expect(x.onBoth).toBe(true);
  });

  it('knows when the crossing is off the end of a blade', () => {
    expect(crossing({ ...east, length: 0.2 }, west)!.onBoth).toBe(false);
  });

  it('gives parallel blades no crossing at all', () => {
    expect(crossing(east, { hand: { x: 0, y: 1 }, angle: rad(45), length: 2 })).toBeNull();
    expect(crossing(east, { hand: { x: 0, y: 1 }, angle: rad(225), length: 2 })).toBeNull();
  });

  it('folds an obtuse crossing to its acute angle', () => {
    const a = { hand: { x: 0, y: 0 }, angle: rad(5), length: 2 };
    const b = { hand: { x: 1, y: 0.2 }, angle: rad(175), length: 2 };
    expect(crossing(a, b)!.angle).toBeCloseTo(rad(10), 12);
  });
});

describe('the lever at the contact', () => {
  it('turns a couple into a force as τ/r', () => {
    expect(bindForce(20, 0.5)).toBeCloseTo(40, 12);
    expect(bindForce(20, 0.25)).toBeCloseTo(80, 12);
  });

  it('makes a contact at the hand infinite rather than a large number', () => {
    expect(bindForce(20, 0)).toBe(Infinity);
  });

  it('reports the forte fraction as along/length', () => {
    expect(leverage(0.3, 1.2)).toBeCloseTo(0.25, 12);
    expect(leverage(0.3, 0)).toBe(0);
  });
});

describe('the couple comes off the hilt', () => {
  it('is a span times a force', () => {
    expect(handCouple(0.17, 200)).toBeCloseTo(34, 12);
    expect(handCouple(-1, 200)).toBe(0);
  });

  it('gives one hand a palm, capped by the hilt', () => {
    expect(gripSpan(0.13, 1)).toBeCloseTo(PALM_SPAN, 12);
    expect(gripSpan(0.05, 1)).toBeCloseTo(0.05, 12);
  });

  it('insets two hands by a palm rather than spanning the whole hilt', () => {
    expect(gripSpan(0.25, 2)).toBeCloseTo(0.25 - PALM_SPAN, 12);
  });

  it('caps two hands on a spear shaft at an arm span', () => {
    expect(gripSpan(1.95, 2)).toBeCloseTo(TWO_HAND_SPAN, 12);
  });

  it('makes the case for a long grip out of the real hilts', () => {
    const one = handCouple(gripSpan(BLADES.arming.cross, 1));
    const two = handCouple(gripSpan(BLADES.longsword.cross, 2));
    expect(two / one).toBeGreaterThan(1.8);
  });
});

describe('friction decides whether a crossing grips', () => {
  it('is atan(µ), and 11.31° for steel on steel', () => {
    expect(frictionAngle(STEEL_FRICTION)).toBeCloseTo(Math.atan(0.2), 12);
    expect((frictionAngle(0.2) * 180) / Math.PI).toBeCloseTo(11.3099, 4);
    expect(frictionAngle(0)).toBe(0);
  });

  it('grips further as µ rises', () => {
    expect(frictionAngle(0.25)).toBeGreaterThan(frictionAngle(0.2));
    expect(frictionAngle(0.2)).toBeGreaterThan(frictionAngle(0.15));
  });

  it('flips exactly at the arctangent', () => {
    const limit = frictionAngle(STEEL_FRICTION);
    expect(bindsOrSlips(limit * 0.999)).toBe(true);
    expect(bindsOrSlips(limit * 1.001)).toBe(false);
  });

  it('grips two parallel blades and slips a perpendicular one', () => {
    expect(bindsOrSlips(0)).toBe(true);
    expect(bindsOrSlips(Math.PI / 2)).toBe(false);
  });
});

describe('geometry decides whether a crossing stays put', () => {
  it('is a/sin θ', () => {
    expect(bindSensitivity(0.5, Math.PI / 2)).toBeCloseTo(0.5, 12);
    expect(bindSensitivity(0.5, rad(30))).toBeCloseTo(1, 12);
  });

  it('diverges as the blades approach parallel', () => {
    expect(bindSensitivity(0.5, 0)).toBe(Infinity);
    expect(bindSensitivity(0.5, rad(2))).toBeGreaterThan(bindSensitivity(0.5, rad(20)));
  });

  it('is proportional to how far out the contact is', () => {
    expect(bindSensitivity(1, rad(20)) / bindSensitivity(0.5, rad(20))).toBeCloseTo(2, 12);
  });

  it('improves monotonically as the crossing steepens', () => {
    const at = [2, 5, 10, 20, 45, 90].map((d) => bindSensitivity(0.5, rad(d)));
    for (let i = 1; i < at.length; i++) expect(at[i]).toBeLessThan(at[i - 1]);
  });
});

describe('grip and stability cannot both be had', () => {
  it('makes the steepest gripping crossing five times the twitchiest', () => {
    const limit = frictionAngle(STEEL_FRICTION);
    const cost = bindSensitivity(1, limit) / bindSensitivity(1, Math.PI / 2);
    expect(cost).toBeCloseTo(1 / Math.sin(limit), 12);
    expect(cost).toBeGreaterThan(4);
  });

  it('has no angle anywhere that does both well', () => {
    for (let d = 1; d <= 89; d++) {
      const a = rad(d);
      const both = bindsOrSlips(a) && bindSensitivity(1, a) < 2;
      expect(both).toBe(false);
    }
  });
});

describe('the one chosen constant changes nothing that matters', () => {
  const A = { hand: { x: -0.5, y: 0 }, angle: rad(30), length: 1.11 };
  const B = { hand: { x: 0.5, y: 0 }, angle: rad(150), length: 0.89 };
  const opts = { hands: [2, 1] as [2, 1], hilts: [0.25, 0.13] as [number, number] };
  const normal = measureBind(A, B, opts);
  const tenfold = measureBind(A, B, { ...opts, force: HAND_FORCE * 10 });

  it('leaves the geometry bit-identical', () => {
    expect(tenfold.crossing!.angle).toBe(normal.crossing!.angle);
    expect(tenfold.leverage[0]).toBe(normal.leverage[0]);
    expect(tenfold.sensitivity[0]).toBe(normal.sensitivity[0]);
    expect(tenfold.binds).toBe(normal.binds);
  });

  it('leaves the winner and the margin alone', () => {
    expect(tenfold.winner).toBe(normal.winner);
    expect(tenfold.ratio).toBeCloseTo(normal.ratio, 12);
  });

  it('scales the one thing it should', () => {
    expect(tenfold.force[0]).toBeCloseTo(normal.force[0] * 10, 9);
  });
});

describe('forte beats foible without being told to', () => {
  const contact = { x: 0.2, y: 0 };
  const dir = rad(135);
  const strong = { hand: { x: 0, y: 0 }, angle: 0, length: 1 };
  const weak = {
    hand: { x: contact.x - 0.8 * Math.cos(dir), y: contact.y - 0.8 * Math.sin(dir) },
    angle: dir,
    length: 1,
  };
  const r = measureBind(strong, weak, { hilts: [0.13, 0.13] });

  it('puts the crossing at 20% of one blade and 80% of the other', () => {
    expect(r.leverage[0]).toBeCloseTo(0.2, 9);
    expect(r.leverage[1]).toBeCloseTo(0.8, 9);
  });

  it('gives the win to the blade meeting with its strong, by the lever ratio', () => {
    expect(r.winner).toBe(0);
    expect(r.ratio).toBeCloseTo(4, 6);
  });
});

describe('winding is what an intersection does when you move a line', () => {
  const A = { hand: { x: -0.5, y: 0 }, angle: rad(30), length: 1.11 };
  const B = { hand: { x: 0.5, y: 0 }, angle: rad(150), length: 0.89 };
  const opts = { hands: [2, 1] as [2, 1], hilts: [0.25, 0.13] as [number, number] };
  const sweep = [-8, -4, 0, 4, 8].map((d) => wind(A, B, rad(d), opts));

  it('improves the ratio monotonically in one direction', () => {
    for (let i = 1; i < sweep.length; i++) expect(sweep[i].ratio).toBeGreaterThan(sweep[i - 1].ratio);
  });

  it('walks the contact back toward one hilt and out along the other', () => {
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i].crossing!.alongA).toBeLessThan(sweep[i - 1].crossing!.alongA);
      expect(sweep[i].crossing!.alongB).toBeGreaterThan(sweep[i - 1].crossing!.alongB);
    }
  });

  it('moves the contact at the rate the report’s own sensitivity predicts', () => {
    const step = rad(0.05);
    const before = measureBind(A, B, opts);
    const after = wind(A, B, step, opts);
    const moved = Math.abs(after.crossing!.alongB - before.crossing!.alongB);
    expect(moved / (before.sensitivity[0] * step)).toBeCloseTo(1, 2);
  });
});

describe('measureBind survives blades that never meet', () => {
  it('reports no crossing and no winner rather than throwing', () => {
    const a = { hand: { x: 0, y: 0 }, angle: 0, length: 1 };
    const b = { hand: { x: 0, y: 1 }, angle: 0, length: 1 };
    const r = measureBind(a, b);
    expect(r.crossing).toBeNull();
    expect(r.winner).toBe(-1);
    expect(r.binds).toBe(false);
    expect(r.torque[0]).toBeGreaterThan(0);
  });
});
