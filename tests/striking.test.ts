import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { BONE_NAMES, createHumanoid } from '../src/humanoid';
import {
  SEGMENT_MASS_TOTAL,
  STRIKES,
  STRIKE_NAMES,
  Striking,
  bodyMass,
  centreOfMass,
  measureStrike,
  stability,
  strikeReach,
} from '../src/striking';

const SEEDS = [1, 5, 42];

function dummy(rig: ReturnType<typeof createHumanoid>, name: (typeof STRIKE_NAMES)[number]) {
  const o = new Object3D();
  o.position.set(0, STRIKES[name].target * rig.height, strikeReach(rig, name) * 0.9);
  o.updateMatrixWorld(true);
  return o;
}

describe('the body it is all derived from', () => {
  it('has segment masses that add up to a body', () => {
    // Dempster's fractions. If these stop summing to one, every effective mass
    // and the centre of mass are both silently scaled.
    expect(SEGMENT_MASS_TOTAL).toBeCloseTo(1, 9);
  });

  it('weighs what a body that size weighs', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const bmi = bodyMass(rig) / (rig.height * rig.height);
      expect(bmi, `seed ${seed}`).toBeGreaterThan(17);
      expect(bmi, `seed ${seed}`).toBeLessThan(31);
    }
  });

  it('scales with the square of the body, because mass does', () => {
    const small = createHumanoid({ seed: 3, height: 1.5, build: 1 });
    const tall = createHumanoid({ seed: 3, height: 1.8, build: 1 });
    expect(bodyMass(tall) / bodyMass(small)).toBeCloseTo((1.8 / 1.5) ** 2, 4);
  });

  it('puts the centre of mass a little above the navel', () => {
    // 55-57% of stature is one of the most reproducible numbers there is.
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      rig.object.updateMatrixWorld(true);
      const com = centreOfMass(rig);
      expect(com.y / rig.height, `seed ${seed}`).toBeGreaterThan(0.5);
      expect(com.y / rig.height, `seed ${seed}`).toBeLessThan(0.62);
    }
  });

  it('reads the centre of mass in world space, wherever the body stands', () => {
    const rig = createHumanoid({ seed: 5 });
    rig.object.position.set(4, 0, -7);
    rig.object.updateMatrixWorld(true);
    const com = centreOfMass(rig, new Vector3());
    expect(com.x).toBeCloseTo(4, 2);
    expect(com.z).toBeCloseTo(-7, 2);
  });

  it('calls a body standing still stable, and a fighting stance more so', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      // Feet together is a SMALL base — a rest pose has only a few
      // centimetres of margin on a 270 mm foot, which is why standing to
      // attention is tiring and why nobody fights from it.
      const rest = stability(rig);
      expect(rest, `seed ${seed} at rest`).toBeGreaterThan(0.1);
      const striker = new Striking(rig, { fade: 0 });
      for (let i = 0; i < 120; i++) striker.update(1 / 240);
      expect(striker.balance, `seed ${seed} in stance`).toBeGreaterThan(rest);
    }
  });
});

describe('reach', () => {
  it('is geometry, so a taller body hits from further away', () => {
    const short = createHumanoid({ seed: 5, height: 1.6 });
    const tall = createHumanoid({ seed: 5, height: 1.9 });
    for (const name of STRIKE_NAMES) {
      expect(strikeReach(tall, name), name).toBeGreaterThan(strikeReach(short, name));
    }
  });

  it('puts a leg further out than an arm and an elbow nearest of all', () => {
    const rig = createHumanoid({ seed: 5 });
    expect(strikeReach(rig, 'teep')).toBeGreaterThan(strikeReach(rig, 'jab'));
    expect(strikeReach(rig, 'sideKick')).toBeGreaterThan(strikeReach(rig, 'cross'));
    expect(strikeReach(rig, 'elbow')).toBeLessThan(strikeReach(rig, 'jab'));
  });

  it('gives the rear hand more of it than the lead, because the trunk turns', () => {
    const rig = createHumanoid({ seed: 5 });
    expect(strikeReach(rig, 'cross')).toBeGreaterThan(strikeReach(rig, 'jab'));
  });

  it('costs a head-high kick the reach a body kick keeps', () => {
    // The rise eats the limb's budget: it is one length, spent on either
    // getting up there or getting out there.
    const rig = createHumanoid({ seed: 5 });
    const high = strikeReach(rig, 'roundhouse');
    const low = strikeReach(rig, 'teep');
    expect(STRIKES.roundhouse.target).toBeGreaterThan(STRIKES.teep.target);
    expect(high).toBeLessThan(low);
  });
});

describe('the strikes', () => {
  it('declares a sane spec for every one', () => {
    for (const name of STRIKE_NAMES) {
      const s = STRIKES[name];
      expect(s.windup, name).toBeGreaterThan(0.05);
      expect(s.recover, name).toBeGreaterThan(0.05);
      expect(s.target, name).toBeGreaterThan(0.4);
      expect(s.target, name).toBeLessThan(1);
      expect(s.drive, name).toBeGreaterThan(0);
      expect(s.label.length, name).toBeGreaterThan(2);
    }
  });

  it('lands every one, on every body', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      for (const name of STRIKE_NAMES) {
        const r = measureStrike(rig, name, { skill: 0.8 });
        expect(r.landed, `seed ${seed} ${name} short by ${(r.gap * 1000).toFixed(0)} mm`).toBe(
          true
        );
      }
    }
  });

  it('never delivers more momentum than the body contains', () => {
    const rig = createHumanoid({ seed: 5 });
    for (const name of STRIKE_NAMES) {
      const r = measureStrike(rig, name, { skill: 0.8 });
      expect(r.massFraction, name).toBeGreaterThan(0.01);
      expect(r.massFraction, name).toBeLessThan(0.2);
    }
  });

  it('makes a cross heavier than a jab, which is the whole point', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const jab = measureStrike(rig, 'jab', { skill: 0.8 });
      const cross = measureStrike(rig, 'cross', { skill: 0.8 });
      expect(cross.mass, `seed ${seed}`).toBeGreaterThan(jab.mass * 1.2);
    }
  });

  it('makes a kick heavier than a punch, because a leg weighs more', () => {
    const rig = createHumanoid({ seed: 5 });
    const punch = measureStrike(rig, 'jab', { skill: 0.8 }).massFraction;
    for (const name of ['roundhouse', 'frontKick', 'teep'] as const) {
      expect(measureStrike(rig, name, { skill: 0.8 }).massFraction, name).toBeGreaterThan(punch);
    }
  });

  it('spends balance on the committed strikes and none on a jab', () => {
    const rig = createHumanoid({ seed: 5 });
    const jab = measureStrike(rig, 'jab', { skill: 0.8 });
    const round = measureStrike(rig, 'roundhouse', { skill: 0.8 });
    expect(jab.worstBalance).toBeGreaterThan(0.4);
    expect(jab.worstBalance - round.worstBalance).toBeGreaterThan(0.3);
  });

  it('fires the chain from the base outward', () => {
    const rig = createHumanoid({ seed: 5 });
    for (const name of STRIKE_NAMES) {
      const r = measureStrike(rig, name, { skill: 0.8 });
      expect(r.chain.surface, name).toBeGreaterThan(r.chain.hips);
    }
  });
});

describe('skill', () => {
  it('is the chain, and the chain is worth real mass', () => {
    const rig = createHumanoid({ seed: 5 });
    const clumsy = measureStrike(rig, 'cross', { skill: 0 });
    const skilled = measureStrike(rig, 'cross', { skill: 1 });
    expect(skilled.mass).toBeGreaterThan(clumsy.mass * 2);
  });

  it('at zero, throws an arm punch — the fist arrives before the hip does', () => {
    const rig = createHumanoid({ seed: 5 });
    const clumsy = measureStrike(rig, 'cross', { skill: 0 });
    expect(clumsy.chain.surface - clumsy.chain.hips).toBeLessThan(0);
  });
});

describe('what it publishes rather than applies', () => {
  it('hands out an impulse, not a damage number', () => {
    const rig = createHumanoid({ seed: 5 });
    const target = dummy(rig, 'cross');
    const striker = new Striking(rig, { target, fade: 0, skill: 0.8 });
    const blows: Array<{ impulse: number; mass: number; speed: number; energy: number }> = [];
    striker.onBlow((b) => blows.push(b));
    striker.throwStrike('cross');
    for (let i = 0; i < 400 && !blows.length; i++) striker.update(1 / 240);
    expect(blows).toHaveLength(1);
    const b = blows[0];
    expect(b.impulse).toBeCloseTo(b.mass * b.speed, 6);
    expect(b.energy).toBeCloseTo(0.5 * b.mass * b.speed * b.speed, 6);
  });

  it('publishes a contact point out in front of the body, not at its feet', () => {
    const rig = createHumanoid({ seed: 5 });
    rig.object.position.set(-3, 0, 6);
    rig.object.updateMatrixWorld(true);
    const target = dummy(rig, 'jab');
    target.position.add(new Vector3(-3, 0, 6));
    target.updateMatrixWorld(true);
    const striker = new Striking(rig, { target, fade: 0, skill: 0.8 });
    let at: Vector3 | null = null;
    striker.onBlow((b) => (at = b.at));
    striker.throwStrike('jab');
    for (let i = 0; i < 400 && !at; i++) striker.update(1 / 240);
    expect(at).not.toBeNull();
    const p = at!;
    // Up by the head, out in front, and nowhere near the world origin — which
    // is where an unmapped contact point lands.
    expect(p.y).toBeGreaterThan(1.2);
    expect(p.distanceTo(rig.object.position)).toBeLessThan(2.2);
    expect(p.distanceTo(new Vector3())).toBeGreaterThan(3);
  });

  it('runs a combination in the order it was given', () => {
    const rig = createHumanoid({ seed: 5 });
    const striker = new Striking(rig, { target: dummy(rig, 'jab'), fade: 0 });
    const seen: string[] = [];
    striker.onBlow((b) => seen.push(b.strike));
    for (const n of ['jab', 'cross', 'hook'] as const) striker.throwStrike(n);
    for (let i = 0; i < 2000 && seen.length < 3; i++) striker.update(1 / 240);
    expect(seen).toEqual(['jab', 'cross', 'hook']);
  });
});

describe('the body', () => {
  it('is handed back when the guard comes down', () => {
    const rig = createHumanoid({ seed: 5 });
    const before = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
    const hips = rig.bones.Hips.position.clone();
    const striker = new Striking(rig, { target: dummy(rig, 'hook'), fade: 0.1 });
    striker.throwStrike('hook');
    for (let i = 0; i < 400; i++) striker.update(1 / 240);
    striker.lower();
    for (let i = 0; i < 200; i++) striker.update(1 / 240);
    for (const [name, q] of before) {
      expect(rig.bones[name].quaternion.angleTo(q), name).toBeLessThan(1e-6);
    }
    expect(rig.bones.Hips.position.distanceTo(hips)).toBeLessThan(1e-6);
  });

  it('stands in its guard between strikes rather than dropping the hands', () => {
    const rig = createHumanoid({ seed: 5 });
    const striker = new Striking(rig, { target: dummy(rig, 'jab'), fade: 0 });
    for (let i = 0; i < 240; i++) striker.update(1 / 240);
    rig.object.updateMatrixWorld(true);
    const hand = rig.bones.LeftHand.getWorldPosition(new Vector3());
    const head = rig.bones.Head.getWorldPosition(new Vector3());
    // The lead hand lives beside the face, not by the hip.
    expect(hand.y).toBeGreaterThan(head.y - 0.45);
    expect(hand.z).toBeGreaterThan(0.1);
  });
});
