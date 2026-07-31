import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { BONE_NAMES, createHumanoid } from '../src/humanoid';
import { getSocket } from '../src/sockets';
import {
  Dining,
  UTENSILS,
  UTENSIL_NAMES,
  measureBite,
  pourAngle,
  servings,
  type Utensil,
} from '../src/dining';

const SEEDS = [1, 5, 12];

/** A place setting in the diner's own frame — below the shoulder, in front. */
function setting(rig: ReturnType<typeof createHumanoid>, down = 0.19, fwd = 0.16): Object3D {
  const plate = new Object3D();
  rig.object.add(plate);
  rig.object.updateWorldMatrix(true, true);
  const shoulder = rig.bones.RightArm.getWorldPosition(new Vector3());
  plate.position.set(0, shoulder.y - down * rig.height, fwd * rig.height);
  return plate;
}

describe('pourAngle', () => {
  it('is zero for a full glass and severe for an empty one', () => {
    expect(pourAngle(1, 0.11, 0.035)).toBeCloseTo(0, 9);
    // atan(0.11 / 0.035) — a bit over seventy degrees, which is what it takes.
    expect(pourAngle(0, 0.11, 0.035)).toBeCloseTo(Math.atan(0.11 / 0.035), 6);
  });

  it('grows monotonically as the vessel empties', () => {
    let last = -1;
    for (let f = 1; f >= 0; f -= 0.05) {
      const a = pourAngle(f, 0.11, 0.035);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
  });

  it('tips a wide vessel less than a narrow one holding the same', () => {
    // A soup bowl goes over far less than a highball, and that is width.
    expect(pourAngle(0.3, 0.075, 0.07)).toBeLessThan(pourAngle(0.3, 0.13, 0.033));
  });
});

describe('the utensils', () => {
  it('declares a sane spec for every one', () => {
    for (const name of UTENSIL_NAMES) {
      const s = UTENSILS[name];
      expect(s.label.length, name).toBeGreaterThan(2);
      expect(s.level, name).toBeGreaterThanOrEqual(0);
      expect(s.level, name).toBeLessThanOrEqual(1);
      expect(s.meet, name).toBeGreaterThanOrEqual(0);
      expect(s.carry, name).toBeGreaterThan(0);
      expect(s.chew, name).toBeGreaterThan(0);
    }
  });

  it('gives a drink a vessel and everything else none', () => {
    for (const name of UTENSIL_NAMES) {
      const drinks = name === 'cup' || name === 'bowl' || name === 'straw';
      expect(Boolean(UTENSILS[name].vessel), name).toBe(drinks);
    }
  });
});

describe('a meal', () => {
  it('counts mouthfuls and empties the plate', () => {
    const rig = createHumanoid({ seed: 5 });
    const plate = setting(rig);
    const food = servings(4);
    const meal = new Dining(rig, { utensil: 'fork', plate, food, fade: 0 });
    const seen: number[] = [];
    meal.onBite((e) => seen.push(e.index));
    let ended = 0;
    meal.onFinish(() => ended++);
    for (let t = 0; t < 120 && !meal.done; t += 1 / 60) meal.update(1 / 60);
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(food.count).toBe(0);
    expect(meal.done).toBe(true);
    expect(ended).toBe(1);
  });

  it('finishes the last mouthful before it stops', () => {
    // Ending the instant the plate hit zero cut the hand off mid-bite and
    // teleported the utensil to a resting pose it had not travelled to.
    const rig = createHumanoid({ seed: 5 });
    const plate = setting(rig);
    const r = measureBite(rig, 'fork', { plate, food: servings(3) });
    expect(r.pop).toBeLessThan(0.025);
  });

  it('reports how much is left', () => {
    const rig = createHumanoid({ seed: 5 });
    const meal = new Dining(rig, { utensil: 'fork', plate: setting(rig), food: servings(4), fade: 0 });
    expect(meal.left).toBe(1);
    for (let t = 0; t < 60 && meal.bites < 2; t += 1 / 60) meal.update(1 / 60);
    expect(meal.left).toBeLessThan(1);
    expect(meal.left).toBeGreaterThan(0);
  });
});

describe('the body', () => {
  it('is handed back on release', () => {
    const rig = createHumanoid({ seed: 5 });
    const before = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
    const meal = new Dining(rig, { utensil: 'spoon', plate: setting(rig), fade: 0.2 });
    for (let i = 0; i < 400; i++) meal.update(1 / 60);
    meal.release();
    for (let i = 0; i < 60; i++) meal.update(1 / 60);
    for (const [name, q] of before) {
      expect(rig.bones[name].quaternion.angleTo(q), name).toBeLessThan(1e-6);
    }
  });

  it('never touches the hips or the legs', () => {
    // The whole reason a sit pose and a meal can share one body.
    const rig = createHumanoid({ seed: 5 });
    const legs = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'] as const;
    const before = legs.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
    const hips = rig.bones.Hips.position.clone();
    const meal = new Dining(rig, { utensil: 'fork', plate: setting(rig), fade: 0 });
    for (let i = 0; i < 300; i++) meal.update(1 / 60);
    for (const [name, q] of before) {
      expect(rig.bones[name].quaternion.angleTo(q), name).toBeLessThan(1e-9);
    }
    expect(rig.bones.Hips.position.distanceTo(hips)).toBeLessThan(1e-9);
  });

  it('does not compound onto the pose it was handed', () => {
    // The shared bones are ADDED to, so a hundred frames of the same phase
    // must not fold the chest a hundred times.
    const rig = createHumanoid({ seed: 5 });
    const meal = new Dining(rig, { utensil: 'fork', plate: setting(rig), fade: 0 });
    for (let i = 0; i < 30; i++) meal.update(1 / 60);
    const early = rig.bones.Chest.quaternion.clone();
    for (let i = 0; i < 600; i++) meal.update(1 / 60);
    meal.release();
    for (let i = 0; i < 5; i++) meal.update(1 / 60);
    // Back to rest, not to thirty times anything.
    expect(rig.bones.Chest.quaternion.angleTo(early)).toBeLessThan(1);
    expect(Math.abs(rig.bones.Chest.quaternion.x)).toBeLessThan(0.1);
  });
});

describe('contact', () => {
  it('gets the business end to the mouth, on every body', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const plate = setting(rig);
      for (const name of UTENSIL_NAMES) {
        const r = measureBite(rig, name, { plate, food: servings(3) });
        expect(r.mouthGap, `seed ${seed} ${name}`).toBeLessThan(0.02);
      }
    }
  });

  it('gets the hand to the plate', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const plate = setting(rig);
      for (const name of UTENSIL_NAMES) {
        expect(
          measureBite(rig, name, { plate, food: servings(3) }).plateGap,
          `seed ${seed} ${name}`
        ).toBeLessThan(0.03);
      }
    }
  });

  it('aims at the mouth the face actually has', () => {
    // The socket comes off the face layout rather than a guess, so it moves
    // with the head and sits between the lips on every seeded character.
    const rig = createHumanoid({ seed: 12 });
    const mouth = getSocket(rig, 'mouth');
    rig.object.updateWorldMatrix(true, true);
    const at = mouth.getWorldPosition(new Vector3());
    const head = rig.bones.Head.getWorldPosition(new Vector3());
    expect(at.z - head.z).toBeCloseTo(0.0565 * rig.height, 5);
    expect(at.y).toBeGreaterThan(head.y);
  });
});

describe('the level constraint', () => {
  it('holds a spoon flat and leaves a fork alone', () => {
    // The difference IS the feature. Equal numbers here would mean `level` is
    // a field nobody reads.
    const rig = createHumanoid({ seed: 5 });
    const plate = setting(rig, 0.24, 0.2);
    const spoon = measureBite(rig, 'spoon', { plate, food: servings(3) });
    const fork = measureBite(rig, 'fork', { plate, food: servings(3) });
    expect(spoon.spill).toBeLessThan(0.14);
    expect(fork.spill).toBeGreaterThan(spoon.spill + 0.15);
  });
});

describe('the drink', () => {
  it('tips further as the glass empties', () => {
    const rig = createHumanoid({ seed: 5 });
    const plate = setting(rig);
    for (const name of ['cup', 'bowl'] as Utensil[]) {
      const r = measureBite(rig, name, { plate, food: servings(6) });
      expect(r.tiltLast, name).toBeGreaterThan(r.tiltFirst + 0.15);
    }
  });

  it('never tips a glass drunk through a straw', () => {
    const rig = createHumanoid({ seed: 5 });
    const r = measureBite(rig, 'straw', { plate: setting(rig), food: servings(4) });
    expect(r.tiltLast).toBe(0);
    expect(r.tiltFirst).toBe(0);
  });
});

describe('the reach', () => {
  it('leans for a far plate and not for a near one', () => {
    const rig = createHumanoid({ seed: 5 });
    const near = measureBite(rig, 'fork', { plate: setting(rig, 0.16, 0.08), food: servings(2) });
    const far = measureBite(rig, 'fork', { plate: setting(rig, 0.2, 0.21), food: servings(2) });
    expect(near.lean).toBeLessThan(0.05);
    expect(far.lean).toBeGreaterThan(near.lean + 0.12);
  });
});

describe('what it publishes rather than applies', () => {
  it('will not let anybody talk with their mouth full', () => {
    const rig = createHumanoid({ seed: 5 });
    const meal = new Dining(rig, { utensil: 'fork', plate: setting(rig), fade: 0 });
    const seen = new Set<boolean>();
    for (let i = 0; i < 400; i++) {
      meal.update(1 / 60);
      if (meal.phase === 'chew' || meal.phase === 'bite') expect(meal.canSpeak).toBe(false);
      seen.add(meal.canSpeak);
    }
    // …and it is not simply always false, which would be a diner who never
    // gets a word in.
    expect(seen.has(true)).toBe(true);
    expect(seen.has(false)).toBe(true);
  });

  it('publishes a chew phase for a jaw this rig does not have', () => {
    const rig = createHumanoid({ seed: 5 });
    const meal = new Dining(rig, { utensil: 'fork', plate: setting(rig), fade: 0 });
    const values = new Set<number>();
    for (let i = 0; i < 400; i++) {
      meal.update(1 / 60);
      expect(meal.chewPhase).toBeGreaterThanOrEqual(0);
      expect(meal.chewPhase).toBeLessThanOrEqual(1);
      if (meal.phase === 'chew') values.add(Math.round(meal.chewPhase * 10));
      else expect(meal.chewPhase).toBe(0);
    }
    expect(values.size).toBeGreaterThan(3);
  });
});

describe('the handshake', () => {
  it('carries anything Object3D-shaped in the hand', () => {
    const rig = createHumanoid({ seed: 5 });
    const cutlery = new Object3D();
    const meal = new Dining(rig, {
      utensil: 'fork',
      plate: setting(rig),
      held: cutlery,
      fade: 0,
    });
    for (let i = 0; i < 90; i++) meal.update(1 / 60);
    const at = cutlery.getWorldPosition(new Vector3());
    const hand = rig.bones.RightHand.getWorldPosition(new Vector3());
    expect(at.distanceTo(hand)).toBeLessThan(0.12);
    expect(at.y).toBeGreaterThan(0.3);
  });

  it('takes a Countable of any shape', () => {
    // Not SCENA's class — SCENA's SHAPE. Anything with a count and a setter.
    let left = 3;
    const rig = createHumanoid({ seed: 5 });
    const meal = new Dining(rig, {
      utensil: 'hands',
      plate: setting(rig),
      fade: 0,
      food: {
        capacity: 3,
        get count() {
          return left;
        },
        setCount(n: number) {
          left = n;
          return n;
        },
      },
    });
    for (let t = 0; t < 120 && !meal.done; t += 1 / 60) meal.update(1 / 60);
    expect(left).toBe(0);
    expect(meal.bites).toBe(3);
  });
});
