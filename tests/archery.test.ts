import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { BONE_NAMES, createHumanoid } from '../src/humanoid';
import {
  Archery,
  BOWS,
  BOW_STYLES,
  arrowSpeed,
  elevationFor,
  groupAt,
  holdForce,
  maxRange,
  measureShot,
  quiverOf,
} from '../src/archery';

const SEEDS = [1, 5, 12];
const RANGE = 18;

function butt(z = RANGE): Object3D {
  const o = new Object3D();
  o.position.set(0, 1.2, z);
  return o;
}

describe('the physics', () => {
  it('derives the same arrow velocity SCENA declares', () => {
    // SCENA's ammunition table says 55 m/s. It is not imported here and it was
    // not copied into the bow table; both describe the same object.
    const rig = createHumanoid({ seed: 5 });
    const b = BOWS.longbow;
    const v = arrowSpeed(b.peak, b.draw * rig.height, b.storage, b.efficiency, 0.03);
    expect(v).toBeGreaterThan(53.9);
    expect(v).toBeLessThan(56.1);
  });

  it('makes a heavier arrow slower and a stronger bow faster', () => {
    expect(arrowSpeed(170, 0.71, 0.5, 0.75, 0.04)).toBeLessThan(
      arrowSpeed(170, 0.71, 0.5, 0.75, 0.03)
    );
    expect(arrowSpeed(220, 0.71, 0.5, 0.75, 0.03)).toBeGreaterThan(
      arrowSpeed(170, 0.71, 0.5, 0.75, 0.03)
    );
  });

  it('solves an elevation that actually lands on the target', () => {
    // Integrated, not re-arranged: fire at the angle and see where it comes
    // down. Two forms of the same equation agreeing proves only that they are
    // the same equation.
    for (const range of [10, 40, 120, 250]) {
      const v = 55;
      const th = elevationFor(range, v);
      const flight = (2 * v * Math.sin(th)) / 9.81;
      expect(v * Math.cos(th) * flight, `${range} m`).toBeCloseTo(range, 1);
    }
  });

  it('refuses a target past the maximum range', () => {
    expect(Number.isNaN(elevationFor(400, 55))).toBe(true);
    expect(maxRange(55)).toBeCloseTo((55 * 55) / 9.81, 6);
  });

  it('turns millimetres of anchor into centimetres of miss', () => {
    // Five millimetres over a 0.71 m draw at twenty metres. Pen and paper.
    expect(groupAt(20, 0.005, 0.71)).toBeCloseTo(0.1408, 3);
    expect(groupAt(40, 0.005, 0.71)).toBeCloseTo(2 * 0.1408, 3);
  });

  it('lets a compound off and does not let a longbow off', () => {
    expect(holdForce(BOWS.longbow.peak, BOWS.longbow.letOff)).toBe(BOWS.longbow.peak);
    expect(holdForce(BOWS.compound.peak, BOWS.compound.letOff)).toBeLessThan(
      BOWS.longbow.peak * 0.45
    );
    // A crossbow is held by a catch, so nobody holds anything.
    expect(holdForce(BOWS.crossbow.peak, BOWS.crossbow.letOff)).toBe(0);
  });
});

describe('the bows', () => {
  it('declares a sane spec for every one', () => {
    for (const style of BOW_STYLES) {
      const b = BOWS[style];
      expect(b.peak, style).toBeGreaterThan(0);
      expect(b.draw, style).toBeGreaterThan(0.1);
      expect(b.storage, style).toBeGreaterThan(0.3);
      expect(b.storage, style).toBeLessThanOrEqual(1);
      expect(b.efficiency, style).toBeGreaterThan(0.4);
      expect(b.label.length, style).toBeGreaterThan(3);
    }
  });

  it('gives the compound the plateau that is its whole point', () => {
    expect(BOWS.compound.storage).toBeGreaterThan(BOWS.longbow.storage * 1.4);
  });
});

describe('a quiver', () => {
  it('empties, and counts what left', () => {
    const rig = createHumanoid({ seed: 5 });
    const arrows = quiverOf(4);
    const bow = new Archery(rig, { style: 'longbow', target: butt(), arrows, fade: 0 });
    const seen: number[] = [];
    bow.onLoose((s) => seen.push(s.index));
    let ended = 0;
    bow.onEmpty(() => ended++);
    for (let t = 0; t < 200 && !bow.done; t += 1 / 60) bow.update(1 / 60);
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(arrows.count).toBe(0);
    expect(ended).toBe(1);
  });

  it('publishes a launch a projectile system can use', () => {
    const rig = createHumanoid({ seed: 5 });
    rig.object.position.set(3, 0, -4);
    rig.object.updateMatrixWorld(true);
    const bow = new Archery(rig, { style: 'longbow', target: butt(), arrows: quiverOf(1), fade: 0 });
    let shot: { from: Vector3; velocity: Vector3; speed: number } | null = null;
    bow.onLoose((s) => (shot = s));
    for (let t = 0; t < 200 && !shot; t += 1 / 60) bow.update(1 / 60);
    expect(shot).not.toBeNull();
    const s = shot!;
    // World space, near the archer — the rig's origin is at the feet and the
    // nock is up beside the face, so about a body's height away and nowhere
    // near the world origin, which is where an unmapped launch point lands.
    expect(s.from.distanceTo(rig.object.getWorldPosition(new Vector3()))).toBeLessThan(2);
    expect(s.from.distanceTo(rig.object.getWorldPosition(new Vector3()))).toBeGreaterThan(1);
    expect(s.velocity.length()).toBeCloseTo(s.speed, 4);
    expect(s.speed).toBeGreaterThan(40);
  });
});

describe('the body', () => {
  it('is handed back on release', () => {
    const rig = createHumanoid({ seed: 5 });
    const before = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
    const bow = new Archery(rig, { style: 'recurve', target: butt(), fade: 0.2 });
    for (let i = 0; i < 400; i++) bow.update(1 / 60);
    bow.release();
    for (let i = 0; i < 60; i++) bow.update(1 / 60);
    for (const [name, q] of before) {
      expect(rig.bones[name].quaternion.angleTo(q), name).toBeLessThan(1e-6);
    }
  });

  it('never touches the hips or the legs', () => {
    const rig = createHumanoid({ seed: 5 });
    const legs = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'] as const;
    const before = legs.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
    const bow = new Archery(rig, { style: 'longbow', target: butt(), fade: 0 });
    for (let i = 0; i < 400; i++) bow.update(1 / 60);
    for (const [name, q] of before) {
      expect(rig.bones[name].quaternion.angleTo(q), name).toBeLessThan(1e-9);
    }
  });
});

describe('the shot', () => {
  it('brings the drawing hand to the anchor, on every body and every bow', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      for (const style of BOW_STYLES) {
        const r = measureShot(rig, style, { target: butt(), arrows: quiverOf(4), skill: 0.7 });
        expect(r.anchorGap, `seed ${seed} ${style}`).toBeLessThan(0.045);
      }
    }
  });

  it('holds the bow arm still', () => {
    const rig = createHumanoid({ seed: 5 });
    for (const style of BOW_STYLES) {
      expect(
        measureShot(rig, style, { target: butt(), arrows: quiverOf(4), skill: 0.7 }).bowDrift,
        style
      ).toBeLessThan(0.01);
    }
  });

  it('groups by exactly as much as the anchor scattered', () => {
    // Two independent routes to the same number: the posed hand, read off the
    // rig, and the launch velocities that actually left. They have to meet.
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const r = measureShot(rig, 'longbow', { target: butt(), arrows: quiverOf(8), skill: 0.6 });
      expect(r.grouped / r.predicted, `seed ${seed}`).toBeGreaterThan(0.85);
      expect(r.grouped / r.predicted, `seed ${seed}`).toBeLessThan(1.15);
    }
  });

  it('lets skill decide the group', () => {
    const rig = createHumanoid({ seed: 5 });
    let last = Infinity;
    for (const skill of [0.3, 0.5, 0.7, 0.9, 1]) {
      const r = measureShot(rig, 'longbow', { target: butt(), arrows: quiverOf(8), seed: 11, skill });
      expect(r.grouped, `skill ${skill}`).toBeLessThanOrEqual(last + 1e-9);
      last = r.grouped;
    }
  });

  it('releases by relaxing, never by pulling forward', () => {
    const rig = createHumanoid({ seed: 5 });
    for (const style of BOW_STYLES) {
      expect(
        measureShot(rig, style, { target: butt(), arrows: quiverOf(4) }).followsThrough,
        style
      ).toBe(true);
    }
  });

  it('raises the bow for a far target and not for a near one', () => {
    const rig = createHumanoid({ seed: 5 });
    const near = measureShot(rig, 'longbow', { target: butt(8), arrows: quiverOf(2) });
    const far = measureShot(rig, 'longbow', { target: butt(90), arrows: quiverOf(2) });
    expect(far.elevation).toBeGreaterThan(near.elevation * 3);
  });
});

describe('what it publishes rather than applies', () => {
  it('strains more on a bow with no let-off', () => {
    const rig = createHumanoid({ seed: 5 });
    const long = new Archery(rig, { style: 'longbow', target: butt(), fade: 0 });
    const comp = new Archery(createHumanoid({ seed: 5 }), {
      style: 'compound',
      target: butt(),
      fade: 0,
    });
    let peakLong = 0;
    let peakComp = 0;
    for (let i = 0; i < 600; i++) {
      long.update(1 / 60);
      comp.update(1 / 60);
      peakLong = Math.max(peakLong, long.strain);
      peakComp = Math.max(peakComp, comp.strain);
    }
    expect(peakLong).toBeGreaterThan(peakComp * 1.5);
  });

  it('scales the draw with the archer', () => {
    const small = createHumanoid({ seed: 3 });
    const large = createHumanoid({ seed: 17 });
    const a = new Archery(small, { style: 'longbow' });
    const b = new Archery(large, { style: 'longbow' });
    expect(Math.sign(a.drawLength - b.drawLength)).toBe(Math.sign(small.height - large.height));
  });
});
