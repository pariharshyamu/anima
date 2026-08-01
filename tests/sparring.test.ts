import { describe, expect, it } from 'vitest';
import { createHumanoid } from '../src/humanoid';
import { FIGHT_STYLES } from '../src/fightstyle';
import { bodyMass } from '../src/striking';
import {
  ANAEROBIC_RESERVE,
  Bout,
  Fighter,
  MUSCLE_EFFICIENCY,
  chooseStrike,
  measureBout,
  preferredGap,
  strikeCost,
} from '../src/sparring';

const make = (seed: number, style: 'boxing' | 'muayThai' | 'karate' = 'boxing', skill = 0.8) =>
  new Fighter(createHumanoid({ seed }), { style, skill });

describe('the card is a measurement', () => {
  it('covers exactly the style repertoire', () => {
    const f = make(42, 'muayThai');
    expect(f.card.map((c) => c.strike)).toEqual(FIGHT_STYLES.muayThai.repertoire);
    for (const c of f.card) {
      expect(c.reach).toBeGreaterThan(0.2);
      expect(c.impulse).toBeGreaterThan(0);
      expect(c.fuel).toBeGreaterThan(0);
      expect(c.cost).toBeGreaterThanOrEqual(0);
    }
  });

  it('scales the tank with the body, not with the style', () => {
    for (const seed of [42, 7, 313]) {
      const a = make(seed, 'boxing');
      const b = make(seed, 'karate');
      expect(a.budget).toBeCloseTo(ANAEROBIC_RESERVE * bodyMass(a.rig), 6);
      expect(a.budget).toBeCloseTo(b.budget, 6);
    }
  });

  it('spends fuel at the efficiency of muscle', () => {
    expect(strikeCost(100)).toBeCloseTo(100 / MUSCLE_EFFICIENCY, 9);
    const f = make(42);
    f.spend(f.budget / 2);
    expect(f.fatigue).toBeCloseTo(0.5, 9);
    f.spend(f.budget);
    expect(f.fatigue).toBe(1);
  });

  it('lets fatigue move the number Striking and Guard already read', () => {
    const f = make(42);
    const fresh = f.skill;
    f.spend(f.budget);
    expect(f.skill).toBeLessThan(fresh);
    expect(f.skill).toBeGreaterThan(0);
  });
});

describe('the choice reads measurements, not bodies', () => {
  it('never picks something that cannot reach', () => {
    const me = make(42);
    const them = make(7);
    for (const gap of [0.3, 0.4, 0.5, 0.6, 0.8]) {
      const pick = chooseStrike(me, them, gap);
      if (!pick) continue;
      const card = me.card.find((c) => c.strike === pick.strike)!;
      expect(card.reach).toBeGreaterThanOrEqual(gap);
    }
  });

  it('gives up entirely when nothing reaches', () => {
    expect(chooseStrike(make(42), make(7), 5)).toBeNull();
  });

  it('answers the same for the same card on a different body', () => {
    const tall = make(42);
    const twin = make(7);
    twin.card.length = 0;
    twin.card.push(...tall.card.map((c) => ({ ...c })));
    const a = chooseStrike(tall, make(7), 0.45);
    const b = chooseStrike(twin, make(7), 0.45);
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
  });

  it('stops throwing what it cannot pay for', () => {
    const me = make(42);
    const them = make(7);
    const fresh = chooseStrike(me, them, 0.35);
    me.spend(me.budget * 0.999);
    const spent = chooseStrike(me, them, 0.35);
    if (spent) {
      const cheap = me.card.find((c) => c.strike === spent.strike)!;
      const first = me.card.find((c) => c.strike === fresh!.strike)!;
      expect(cheap.fuel).toBeLessThanOrEqual(first.fuel);
    }
  });

  it('stands where its best-value strike works, not at full stretch', () => {
    const me = make(42);
    const want = preferredGap(me);
    expect(want).toBeGreaterThan(0.2);
    expect(want).toBeLessThan(me.range);
  });
});

describe('a bout', () => {
  const report = measureBout(make(42), make(7), { rounds: 3, roundSeconds: 20 });

  it('throws only strikes the style knows, and only in range', () => {
    for (const e of report.exchanges) {
      expect(FIGHT_STYLES[report.score[e.by].style].repertoire).toContain(e.strike);
      expect(e.reach).toBeGreaterThanOrEqual(e.gap - 1e-9);
      expect(e.through).toBeGreaterThanOrEqual(0);
    }
    expect(report.exchanges.length).toBeGreaterThan(20);
  });

  it('is the same fight every time', () => {
    const again = measureBout(make(42), make(7), { rounds: 3, roundSeconds: 20 });
    expect(again.exchanges).toEqual(report.exchanges);
    expect(again.score).toEqual(report.score);
  });

  it('gives the longer fighter the better of it', () => {
    const t = report.taller;
    expect(report.score[t].range).toBeGreaterThan(report.score[1 - t].range);
    expect(report.tallerAhead).toBe(true);
  });

  it('changes guard between rounds and takes less for it', () => {
    const long = measureBout(make(12), make(313), { rounds: 4, roundSeconds: 20 });
    expect(long.guards.length).toBe(3);
    const round = (r: number) =>
      long.exchanges.filter((e) => e.round === r).reduce((a, e) => a + e.through, 0);
    expect(round(2)).toBeLessThan(round(1) * 0.85);
    const stopped = (r: number) => long.exchanges.filter((e) => e.round === r && e.stopped).length;
    expect(stopped(1)).toBe(0);
    expect(stopped(2)).toBeGreaterThan(0);
  });

  it('spends a real fraction of a real tank', () => {
    const tired = measureBout(make(42), make(7), { rounds: 8, roundSeconds: 30 });
    for (const s of tired.score) {
      expect(s.fatigue).toBeGreaterThan(0.15);
      expect(s.fatigue).toBeLessThanOrEqual(1);
    }
  });
});

describe('the reach advantage is not written down', () => {
  it('follows reach rather than height where the two disagree', () => {
    const seeds = [1, 5, 7, 12, 42, 99, 313, 777];
    let disagreed = 0;
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        const r = measureBout(make(seeds[i]), make(seeds[j]), { rounds: 2, roundSeconds: 20 });
        const t = r.taller;
        if (r.score[t].range >= r.score[1 - t].range) continue;
        // Taller, but with LESS reach. The result has to follow the reach.
        disagreed++;
        expect(r.tallerAhead).toBe(false);
      }
    }
    expect(disagreed).toBeGreaterThan(0);
  });
});

describe('the bout hands the bodies back', () => {
  it('leaves both fighters standing where they were put', () => {
    const a = make(42);
    const b = make(7);
    const bout = new Bout(a, b, { rounds: 1, roundSeconds: 5 });
    const gap = bout.gap;
    for (let i = 0; i < 60; i++) bout.update(1 / 60);
    // The two stay on the same line, facing each other, whatever the footwork.
    expect(a.rig.object.position.x).toBeCloseTo(0, 9);
    expect(b.rig.object.position.x).toBeCloseTo(0, 9);
    expect(b.rig.object.position.z - a.rig.object.position.z).toBeCloseTo(bout.gap, 6);
    expect(bout.gap).not.toBeCloseTo(gap, 3);
  });
});
