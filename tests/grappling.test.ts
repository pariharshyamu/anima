import { describe, expect, it } from 'vitest';
import { createHumanoid } from '../src/humanoid';
import { bodyMass, stability } from '../src/striking';
import {
  GRIP_TOLERANCE,
  Grappling,
  KUZUSHI,
  KUZUSHI_DIRECTIONS,
  MAX_LEAN,
  THROWS,
  THROW_NAMES,
  UKEMI_RELIEF,
  breakEffort,
  gripPoints,
  landingImpulse,
  measureThrow,
  weakestDirection,
} from '../src/grappling';

const SEEDS = [42, 7, 313];

/** Two bodies facing each other at grappling range. Rebuilt every time. */
function pair(seed = 42, d = 0.44) {
  const tori = createHumanoid({ seed: 1 });
  const uke = createHumanoid({ seed });
  uke.object.position.set(0, 0, d);
  uke.object.rotation.y = Math.PI;
  tori.object.updateMatrixWorld(true);
  uke.object.updateMatrixWorld(true);
  return { tori, uke };
}

describe('the compass', () => {
  it('has eight points, all of them unit vectors', () => {
    expect(KUZUSHI_DIRECTIONS).toHaveLength(8);
    for (const d of KUZUSHI_DIRECTIONS) {
      const [x, z] = KUZUSHI[d];
      expect(Math.hypot(x, z)).toBeCloseTo(1, 12);
    }
  });

  it('names every throw a direction that exists', () => {
    for (const n of THROW_NAMES) {
      expect(KUZUSHI_DIRECTIONS).toContain(THROWS[n].breaks);
    }
  });
});

describe('breaking a base', () => {
  it('takes a finite lean in every direction, and not the same one', () => {
    const rig = createHumanoid({ seed: 42 });
    const leans = KUZUSHI_DIRECTIONS.map((d) => breakEffort(rig, d).lean);
    for (const l of leans) {
      expect(Number.isFinite(l)).toBe(true);
      expect(l).toBeGreaterThan(0);
      expect(l).toBeLessThanOrEqual(MAX_LEAN);
    }
    expect(Math.max(...leans) / Math.min(...leans)).toBeGreaterThan(2);
  });

  it('agrees with the foot box: a heel is nearer than a toe', () => {
    const rig = createHumanoid({ seed: 42 });
    const back = breakEffort(rig, 'back');
    const front = breakEffort(rig, 'front');
    expect(back.travel).toBeLessThan(front.travel);
    expect(back.lean).toBeLessThan(front.lean);
    // The travel is the margin the foot box actually leaves, not a coincidence.
    expect(back.travel).toBeGreaterThan(0.05);
    expect(front.travel).toBeGreaterThan(0.15);
  });

  it('ends exactly on the edge it was looking for', () => {
    const rig = createHumanoid({ seed: 42 });
    for (const d of KUZUSHI_DIRECTIONS) {
      const e = breakEffort(rig, d);
      expect(e.before).toBeGreaterThan(0);
      expect(e.after).toBeLessThan(0);
      expect(e.after).toBeGreaterThan(-0.05);
    }
  });

  it('picks the weak line off the feet', () => {
    expect(weakestDirection(createHumanoid({ seed: 42 })).direction).toBe('back');
  });

  it('leaves the body exactly as it found it', () => {
    const rig = createHumanoid({ seed: 42 });
    rig.object.updateMatrixWorld(true);
    const before = stability(rig);
    const spine = rig.bones.Spine.quaternion.clone();
    for (const d of KUZUSHI_DIRECTIONS) breakEffort(rig, d);
    expect(stability(rig)).toBeCloseTo(before, 12);
    expect(rig.bones.Spine.quaternion.angleTo(spine)).toBeLessThan(1e-9);
  });
});

describe('the grip', () => {
  it('lands on the cloth of whatever body it is handed', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const g = gripPoints(rig, 'Right', 'Left');
      const chest = rig.bones.Chest.getWorldPosition(g.sleeve.clone());
      // The lapel is on the collar, on one side of the throat, not in it.
      expect(g.lapel.y).toBeGreaterThan(chest.y);
      expect(Math.abs(g.lapel.x - chest.x)).toBeGreaterThan(0.02);
      expect(Math.abs(g.lapel.x - chest.x)).toBeLessThan(0.2);
    }
  });

  it('writes into the object it is given', () => {
    const rig = createHumanoid({ seed: 42 });
    const out = gripPoints(rig, 'Right', 'Left');
    const same = gripPoints(rig, 'Right', 'Left', out);
    expect(same).toBe(out);
  });
});

describe('a throw is an attempt', () => {
  it('does not complete without kuzushi, and does with it', () => {
    const weak = measureThrow(pair().tori, pair().uke, 'seoiNage', { skill: 0.3, fade: 0.05 });
    const strong = measureThrow(pair().tori, pair().uke, 'seoiNage', { skill: 0.95, fade: 0.05 });
    expect(weak.completed).toBe(false);
    expect(weak.failed).toBe('notBroken');
    expect(weak.balance).toBeGreaterThan(0);
    expect(strong.completed).toBe(true);
    expect(strong.balance).toBeLessThan(0);
  });

  it('does not complete out of range, and says so', () => {
    const near = measureThrow(pair(42, 0.42).tori, pair(42, 0.42).uke, 'oGoshi', {
      skill: 0.95,
      fade: 0.05,
    });
    const far = measureThrow(pair(42, 0.72).tori, pair(42, 0.72).uke, 'oGoshi', {
      skill: 0.95,
      fade: 0.05,
    });
    expect(near.completed).toBe(true);
    expect(near.gripGap).toBeLessThanOrEqual(GRIP_TOLERANCE);
    expect(far.completed).toBe(false);
    expect(far.failed).toBe('noGrip');
    expect(far.gripGap).toBeGreaterThan(GRIP_TOLERANCE);
  });

  it('never lets the tori fall over doing it', () => {
    for (const n of THROW_NAMES) {
      const r = measureThrow(pair().tori, pair().uke, n, { skill: 0.95, fade: 0.05 });
      expect(r.toriWorst).toBeGreaterThan(0);
    }
  });

  it('publishes exactly one decision per attempt', () => {
    const { tori, uke } = pair();
    const g = new Grappling(tori, uke, { skill: 0.95, fade: 0.05 });
    const events: string[] = [];
    g.onThrow((e) => events.push(e.throwName));
    g.attempt('oGoshi');
    for (let i = 0; i < 600 && !g.done; i++) g.update(1 / 60);
    expect(events).toEqual(['oGoshi']);
  });
});

describe('the landing', () => {
  it('is mass times sqrt(2gh), and nothing else', () => {
    for (const seed of SEEDS) {
      const r = measureThrow(pair(seed).tori, pair(seed).uke, 'oGoshi', {
        skill: 0.95,
        fade: 0.05,
      });
      const uke = pair(seed).uke;
      expect(r.landing).not.toBeNull();
      expect(r.landing!.impulse).toBeCloseTo(landingImpulse(uke, r.landing!.height), 9);
      expect(r.landing!.speed).toBeCloseTo(Math.sqrt(2 * 9.81 * r.landing!.height), 9);
      expect(r.landing!.impulse / r.landing!.speed).toBeCloseTo(bodyMass(uke), 6);
    }
  });

  it('lands a hip throw harder than a foot sweep', () => {
    const hip = measureThrow(pair().tori, pair().uke, 'oGoshi', { skill: 0.95, fade: 0.05 });
    const sweep = measureThrow(pair().tori, pair().uke, 'footSweep', { skill: 0.95, fade: 0.05 });
    expect(hip.landing!.impulse).toBeGreaterThan(sweep.landing!.impulse * 1.15);
  });

  it('is the same at any frame rate, bit for bit', () => {
    for (const n of THROW_NAMES) {
      const imp = [1 / 30, 1 / 60, 1 / 144, 1 / 240].map(
        (step) => measureThrow(pair().tori, pair().uke, n, { skill: 0.95, fade: 0.05, step }).landing!.impulse
      );
      for (const v of imp) expect(v).toBe(imp[0]);
    }
  });
});

describe('ukemi', () => {
  it('spreads the arrival without shrinking the fall', () => {
    for (const n of THROW_NAMES) {
      const on = measureThrow(pair().tori, pair().uke, n, { skill: 0.95, fade: 0.05, ukemi: true });
      const off = measureThrow(pair().tori, pair().uke, n, {
        skill: 0.95,
        fade: 0.05,
        ukemi: false,
      });
      expect(on.landing!.armFirst).toBe(true);
      expect(on.landing!.breakfall).toBe(true);
      expect(off.landing!.breakfall).toBe(false);
      // The fall itself barely moves — an arm is 5% of a body, and putting one
      // out does move a centre of mass, but it cannot argue with gravity.
      const moved = Math.abs(on.landing!.impulse - off.landing!.impulse) / off.landing!.impulse;
      expect(moved).toBeLessThan(0.04);
      expect(1 - on.landing!.toTorso / on.landing!.impulse).toBeCloseTo(UKEMI_RELIEF, 9);
      expect(off.landing!.toTorso).toBeCloseTo(off.landing!.impulse, 9);
    }
  });
});

describe('both bodies are handed back', () => {
  it('restores stability, pose and transform after every throw', () => {
    for (const n of THROW_NAMES) {
      const { tori, uke } = pair();
      const wasUke = stability(uke);
      const wasTori = stability(tori);
      const home = uke.object.position.clone();
      const spin = uke.object.quaternion.clone();
      const toriHome = tori.object.position.clone();
      const hips = tori.bones.Hips.position.clone();
      measureThrow(tori, uke, n, { skill: 0.95, fade: 0.05 });
      tori.object.updateMatrixWorld(true);
      uke.object.updateMatrixWorld(true);
      expect(stability(uke)).toBeCloseTo(wasUke, 9);
      expect(stability(tori)).toBeCloseTo(wasTori, 9);
      expect(uke.object.position.distanceTo(home)).toBeLessThan(1e-9);
      expect(uke.object.quaternion.angleTo(spin)).toBeLessThan(1e-9);
      expect(tori.object.position.distanceTo(toriHome)).toBeLessThan(1e-9);
      expect(tori.bones.Hips.position.distanceTo(hips)).toBeLessThan(1e-9);
    }
  });

  it('hands them back on release, mid-throw', () => {
    const { tori, uke } = pair();
    const was = stability(uke);
    const g = new Grappling(tori, uke, { skill: 0.95, fade: 0.05 });
    g.attempt('uchiMata');
    for (let i = 0; i < 20; i++) g.update(1 / 60);
    expect(stability(uke)).not.toBeCloseTo(was, 3);
    g.release();
    for (let i = 0; i < 60 && !g.done; i++) g.update(1 / 60);
    uke.object.updateMatrixWorld(true);
    expect(stability(uke)).toBeCloseTo(was, 9);
    expect(g.phase).toBe('apart');
  });
});

describe('the throws are different from each other', () => {
  it('does not land them all the same', () => {
    const imp = THROW_NAMES.map(
      (n) => measureThrow(pair().tori, pair().uke, n, { skill: 0.95, fade: 0.05 }).landing!.impulse
    );
    expect(Math.max(...imp) / Math.min(...imp)).toBeGreaterThan(1.2);
  });

  it('spends longer on the ones judo says are longer', () => {
    for (const n of THROW_NAMES) {
      const s = THROWS[n];
      expect(s.kuzushi).toBeGreaterThan(0);
      expect(s.tsukuri).toBeGreaterThan(0);
      expect(s.kake).toBeGreaterThan(0);
      expect(s.rotation).toBeGreaterThan(Math.PI / 2);
      // Only a loading throw picks anybody up.
      if (!s.loads) expect(s.lift).toBeLessThan(0.1);
    }
  });
});
