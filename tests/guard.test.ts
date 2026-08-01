import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { BONE_NAMES, createHumanoid } from '../src/humanoid';
import { Striking, STRIKES } from '../src/striking';
import {
  CHOICE_REACTION,
  GUARDS,
  GUARD_NAMES,
  GUARD_ZONES,
  Guard,
  SIMPLE_REACTION,
  canReactTo,
  coverageOf,
  intercepts,
  reactionTime,
  zoneOf,
  zonePoint,
} from '../src/guard';

const SEEDS = [1, 5, 42];

function held(rig: ReturnType<typeof createHumanoid>, style: (typeof GUARD_NAMES)[number]) {
  const g = new Guard(rig, { style, fade: 0 });
  for (let i = 0; i < 40; i++) g.update(1 / 120);
  return g;
}

/** A striker and a defender facing each other, one strike, one answer. */
function exchange(style: (typeof GUARD_NAMES)[number], strike: keyof typeof STRIKES, skill = 0.8) {
  const atk = createHumanoid({ seed: 5 });
  const def = createHumanoid({ seed: 5 });
  def.object.position.set(0, 0, 0.62);
  def.object.rotation.y = Math.PI;
  def.object.updateMatrixWorld(true);
  atk.object.updateMatrixWorld(true);
  const guard = held(def, style);
  const striker = new Striking(atk, { target: def.bones.Head, fade: 0, skill });
  let answer: ReturnType<Guard['defend']> | null = null;
  let blow: { impulse: number } | null = null;
  striker.onBlow((b) => {
    blow = b;
    answer = guard.defend(b);
  });
  striker.throwStrike(strike);
  for (let i = 0; i < 400 && !answer; i++) {
    striker.update(1 / 120);
    guard.update(1 / 120);
  }
  return { answer: answer!, blow: blow!, guard };
}

describe('reaction', () => {
  it('is bounded by what a person can do', () => {
    expect(reactionTime(1)).toBeCloseTo(SIMPLE_REACTION, 9);
    expect(reactionTime(0)).toBeCloseTo(CHOICE_REACTION, 9);
    expect(reactionTime(0.5)).toBeGreaterThan(SIMPLE_REACTION);
    expect(reactionTime(0.5)).toBeLessThan(CHOICE_REACTION);
  });

  it('clamps rather than extrapolating into fantasy', () => {
    expect(reactionTime(5)).toBeCloseTo(SIMPLE_REACTION, 9);
    expect(reactionTime(-3)).toBeCloseTo(CHOICE_REACTION, 9);
  });

  it('leaves nobody able to react to a jab', () => {
    // 130 ms of wind-up against 180 ms of simple reaction. This is not a rule
    // anybody wrote down here; it is why the jab is thrown more than anything
    // else in boxing.
    expect(STRIKES.jab.windup).toBeLessThan(SIMPLE_REACTION);
    for (const skill of [0, 0.5, 1]) expect(canReactTo('jab', skill), `skill ${skill}`).toBe(false);
  });

  it('lets an expert answer the committed shots and a novice answer none', () => {
    for (const slow of ['roundhouse', 'overhand', 'sideKick'] as const) {
      expect(canReactTo(slow, 1), slow).toBe(true);
      expect(canReactTo(slow, 0), slow).toBe(false);
    }
  });

  it('divides the strikes into two non-empty halves', () => {
    const names = Object.keys(STRIKES) as Array<keyof typeof STRIKES>;
    const yes = names.filter((n) => canReactTo(n, 1));
    expect(yes.length).toBeGreaterThan(0);
    expect(yes.length).toBeLessThan(names.length);
  });
});

describe('coverage', () => {
  it('is a fraction, on every guard, zone and body', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      for (const style of GUARD_NAMES) {
        const g = held(rig, style);
        for (const zone of GUARD_ZONES) {
          const c = coverageOf(rig, zone);
          expect(c, `${style}/${zone}`).toBeGreaterThanOrEqual(0);
          expect(c, `${style}/${zone}`).toBeLessThanOrEqual(1);
        }
        g.lower();
        for (let i = 0; i < 40; i++) g.update(1 / 120);
      }
    }
  });

  it('gives a body with its hands down essentially nothing at the head', () => {
    const rig = createHumanoid({ seed: 5 });
    held(rig, 'open');
    expect(coverageOf(rig, 'head')).toBeLessThan(0.08);
  });

  it('is a TRADE — the head and the body are bought with the same arms', () => {
    const a = createHumanoid({ seed: 5 });
    held(a, 'crossArm');
    const crossHead = coverageOf(a, 'head');
    const crossBody = coverageOf(a, 'body');
    const b = createHumanoid({ seed: 5 });
    held(b, 'lowGuard');
    const lowHead = coverageOf(b, 'head');
    const lowBody = coverageOf(b, 'body');
    expect(crossHead).toBeGreaterThan(lowHead * 3);
    expect(lowBody).toBeGreaterThan(crossBody);
  });

  it('answers for the pose the body is in, not for the guard it was asked for', () => {
    // The same rig, measured twice. Coverage is not a property of the name.
    const rig = createHumanoid({ seed: 5 });
    const g = held(rig, 'peekaboo');
    const up = coverageOf(rig, 'head');
    g.hold('open');
    for (let i = 0; i < 40; i++) g.update(1 / 120);
    expect(coverageOf(rig, 'head')).toBeLessThan(up * 0.5);
  });

  it('does not credit a limb with shielding itself', () => {
    // The leg zone sits ON a thigh. If a limb could shield itself every guard
    // would read 100% there, which is exactly what happened.
    const rig = createHumanoid({ seed: 5 });
    held(rig, 'peekaboo');
    expect(coverageOf(rig, 'legs')).toBeLessThan(0.5);
  });

  it('puts every zone somewhere on the body', () => {
    const rig = createHumanoid({ seed: 5 });
    rig.object.position.set(2, 0, -5);
    rig.object.updateMatrixWorld(true);
    for (const zone of GUARD_ZONES) {
      const p = zonePoint(rig, zone, new Vector3());
      expect(p.distanceTo(rig.object.position), zone).toBeLessThan(2);
      expect(p.y, zone).toBeGreaterThan(0.2);
    }
  });
});

describe('the guards', () => {
  it('declares a sane spec for every one', () => {
    for (const name of GUARD_NAMES) {
      const s = GUARDS[name];
      expect(s.label.length, name).toBeGreaterThan(3);
      expect(s.lead[1], name).toBeGreaterThan(0.3);
      expect(s.rear[1], name).toBeGreaterThan(0.3);
      expect(s.elbow, name).toBeGreaterThanOrEqual(0);
      expect(s.tuck, name).toBeGreaterThanOrEqual(0);
    }
  });

  it('routes a strike to the zone its height implies', () => {
    expect(zoneOf({ strike: 'jab' })).toBe('head');
    expect(zoneOf({ strike: 'teep' })).toBe('body');
    expect(zoneOf({ strike: 'knee' })).toBe('body');
  });
});

describe('the exchange', () => {
  it('stops a cross behind a peekaboo and does not behind a low guard', () => {
    expect(exchange('peekaboo', 'cross').answer.stopped).toBe(true);
    expect(exchange('lowGuard', 'cross').answer.stopped).toBe(false);
  });

  it('accounts for every kg·m/s that was thrown', () => {
    for (const style of GUARD_NAMES) {
      for (const strike of ['cross', 'roundhouse'] as const) {
        const { answer, blow } = exchange(style, strike);
        expect(answer.through + answer.absorbed, `${style}/${strike}`).toBeCloseTo(
          blow.impulse,
          6
        );
      }
    }
  });

  it('puts what it stopped into a limb, and names the limb', () => {
    const { answer } = exchange('peekaboo', 'cross');
    expect(answer.stopped).toBe(true);
    expect(answer.absorbed).toBeGreaterThan(0);
    expect(answer.limb.length).toBeGreaterThan(0);
  });

  it('lets everything through when nothing is in the way', () => {
    const { answer, blow } = exchange('open', 'cross');
    expect(answer.stopped).toBe(false);
    expect(answer.absorbed).toBe(0);
    expect(answer.through).toBeCloseTo(blow.impulse, 6);
  });

  it('reports the coverage it answered with', () => {
    const { answer } = exchange('crossArm', 'cross');
    expect(answer.coverage).toBeGreaterThan(0.2);
  });
});

describe('the active defences', () => {
  it('refuses a strike there was no time to see', () => {
    const rig = createHumanoid({ seed: 5 });
    const g = held(rig, 'peekaboo');
    expect(g.react('jab', 'slip')).toBe(false);
    expect(g.doing).toBe('none');
  });

  it('allows one there was', () => {
    const rig = createHumanoid({ seed: 5 });
    const g = new Guard(rig, { style: 'peekaboo', fade: 0, skill: 1 });
    for (let i = 0; i < 40; i++) g.update(1 / 120);
    expect(g.react('roundhouse', 'slip')).toBe(true);
    expect(g.doing).toBe('slip');
  });

  it('makes a slip absorb nothing, because it is not a block', () => {
    const rig = createHumanoid({ seed: 5 });
    const g = new Guard(rig, { style: 'peekaboo', fade: 0, skill: 1 });
    for (let i = 0; i < 40; i++) g.update(1 / 120);
    g.react('roundhouse', 'slip');
    const answer = g.defend({
      strike: 'roundhouse',
      surface: 'shin',
      at: new Vector3(0, 1.5, 0.2),
      direction: new Vector3(0, 0, 1),
      speed: 16,
      mass: 7,
      impulse: 112,
      energy: 900,
      landed: true,
      shortBy: 0,
      balance: 0,
    });
    expect(answer.stopped).toBe(true);
    expect(answer.by).toBe('slip');
    expect(answer.absorbed).toBe(0);
    expect(answer.through).toBe(0);
  });

  it('expires, so a defence held early is no defence at all', () => {
    const rig = createHumanoid({ seed: 5 });
    const g = new Guard(rig, { style: 'peekaboo', fade: 0, skill: 1 });
    for (let i = 0; i < 40; i++) g.update(1 / 120);
    g.react('roundhouse', 'slip');
    for (let i = 0; i < 120; i++) g.update(1 / 120);
    expect(g.doing).toBe('none');
  });
});

describe('the body', () => {
  it('is handed back when the guard comes down', () => {
    const rig = createHumanoid({ seed: 5 });
    const before = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
    const g = new Guard(rig, { style: 'crossArm', fade: 0.08 });
    for (let i = 0; i < 200; i++) g.update(1 / 120);
    g.lower();
    for (let i = 0; i < 200; i++) g.update(1 / 120);
    for (const [name, q] of before) {
      expect(rig.bones[name].quaternion.angleTo(q), name).toBeLessThan(1e-6);
    }
  });

  it('never touches the hips or the legs while simply covering', () => {
    const rig = createHumanoid({ seed: 5 });
    const legs = ['Hips', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'] as const;
    const before = legs.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
    const g = new Guard(rig, { style: 'highCover', fade: 0 });
    for (let i = 0; i < 200; i++) g.update(1 / 120);
    for (const [name, q] of before) {
      expect(rig.bones[name].quaternion.angleTo(q), name).toBeLessThan(1e-9);
    }
  });

  it('puts the hands where the guard says, on every body', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      held(rig, 'peekaboo');
      rig.object.updateMatrixWorld(true);
      const hand = rig.bones.LeftHand.getWorldPosition(new Vector3());
      const head = rig.bones.Head.getWorldPosition(new Vector3());
      expect(hand.distanceTo(head), `seed ${seed}`).toBeLessThan(0.42);
    }
  });
});

describe('the line a strike came in on', () => {
  it('finds an arm that is on it and misses one that is not', () => {
    // Worth knowing: a line straight down the centre into the face is NOT
    // blocked by a peekaboo. The gloves sit either side of it and a punch down
    // the middle splits them, which is exactly why fighters are told to keep
    // them together. The geometry says so without being asked to.
    const rig = createHumanoid({ seed: 5 });
    held(rig, 'peekaboo');
    rig.object.updateMatrixWorld(true);
    const head = rig.bones.Head.getWorldPosition(new Vector3());
    // A line that passes through a glove on its way to the head. `direction`
    // is where the momentum WENT, not where it came from.
    const glove = rig.bones.LeftHand.getWorldPosition(new Vector3());
    const through = head.clone().sub(glove).normalize();
    expect(intercepts(rig, head, through).blocked).toBe(true);
    // From directly overhead there is no arm in the way of anything.
    const above = head.clone().add(new Vector3(0, 0.3, 0));
    expect(intercepts(rig, above, new Vector3(0, -1, 0)).blocked).toBe(false);
  });
});
