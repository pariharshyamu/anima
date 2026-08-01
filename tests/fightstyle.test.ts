import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createHumanoid } from '../src/humanoid';
import { Guard, coverageOf } from '../src/guard';
import { STRIKES, measureStrike, stability, strikeReach } from '../src/striking';
import {
  FIGHT_STYLES,
  FIGHT_STYLE_NAMES,
  FightStyle,
  STYLED_STRIKES,
  styleProfile,
} from '../src/fightstyle';
import {
  FIGHTING_STANCE,
  applyStance,
  holdStance,
  releaseStance,
  stanceDrop,
} from '../src/stance';

const SEEDS = [42, 7, 313];

describe('the table', () => {
  it('names a guard and strikes that exist', () => {
    for (const n of FIGHT_STYLE_NAMES) {
      const spec = FIGHT_STYLES[n];
      expect(spec.repertoire.length).toBeGreaterThan(3);
      for (const s of spec.repertoire) expect(STRIKES[s]).toBeDefined();
      expect(new Set(spec.repertoire).size).toBe(spec.repertoire.length);
    }
    expect(STYLED_STRIKES.length).toBeGreaterThan(8);
  });

  it('has no multiplier in it anywhere', () => {
    for (const n of FIGHT_STYLE_NAMES) {
      const spec = FIGHT_STYLES[n] as unknown as Record<string, unknown>;
      // A style is a stance, a guard and a repertoire. If a fourth number ever
      // appears here it is a balance knob, and this is where it gets caught.
      expect(Object.keys(spec).sort()).toEqual(['guard', 'label', 'repertoire', 'stance']);
    }
  });

  it('states every stance as fractions of height, in a plausible range', () => {
    for (const n of FIGHT_STYLE_NAMES) {
      const s = FIGHT_STYLES[n].stance;
      expect(s.spread).toBeGreaterThan(0.05);
      expect(s.spread).toBeLessThan(0.3);
      expect(s.stagger).toBeGreaterThanOrEqual(0);
      expect(s.stagger).toBeLessThan(0.5);
      expect(s.sink).toBeGreaterThanOrEqual(0);
      expect(Math.abs(s.blade)).toBeLessThan(Math.PI / 2);
    }
  });
});

describe('a stance is where the feet are', () => {
  it('puts them there, on any body', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      const hold = holdStance(rig);
      for (const n of FIGHT_STYLE_NAMES) {
        const shape = FIGHT_STYLES[n].stance;
        applyStance(rig, hold, shape);
        rig.object.updateMatrixWorld(true);
        const l = rig.object.worldToLocal(rig.bones.LeftFoot.getWorldPosition(new Vector3()));
        const r = rig.object.worldToLocal(rig.bones.RightFoot.getWorldPosition(new Vector3()));
        expect(Math.abs(l.x - r.x) / rig.height).toBeCloseTo(shape.spread, 2);
        expect(Math.abs(l.z - r.z) / rig.height).toBeCloseTo(shape.stagger, 2);
      }
      releaseStance(rig, hold);
    }
  });

  it('forces the crouch the footprints need — and length costs more than width', () => {
    const rig = createHumanoid({ seed: 42 });
    const hold = holdStance(rig);
    const flat = (n: (typeof FIGHT_STYLE_NAMES)[number]) =>
      stanceDrop(rig, hold, { ...FIGHT_STYLES[n].stance, sink: 0 });
    // A pelvis is already 90 mm wide, so spreading the feet across costs a leg
    // almost nothing. Standing one 350 mm in front costs it the whole 350.
    expect(flat('karate')).toBeGreaterThan(flat('brawler') * 1.5);
    expect(flat('brawler')).toBeLessThan(flat('boxing'));
  });

  it('hands the body back exactly', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      rig.object.updateMatrixWorld(true);
      const was = stability(rig);
      const hips = rig.bones.Hips.position.clone();
      const hold = holdStance(rig);
      for (const n of FIGHT_STYLE_NAMES) applyStance(rig, hold, FIGHT_STYLES[n].stance);
      releaseStance(rig, hold);
      expect(stability(rig)).toBeCloseTo(was, 9);
      expect(rig.bones.Hips.position.distanceTo(hips)).toBeLessThan(1e-9);
    }
  });

  it('reproduces the stance `Striking` has always held', () => {
    const rig = createHumanoid({ seed: 42 });
    const hold = holdStance(rig);
    applyStance(rig, hold, FIGHTING_STANCE);
    // 0.699 is the angle-driven pose this replaced; footprints land on it.
    expect(stability(rig)).toBeGreaterThan(0.68);
    expect(stability(rig)).toBeLessThan(0.72);
    releaseStance(rig, hold);
  });
});

describe('a profile is a measurement', () => {
  it('does not depend on the order the styles are measured in', () => {
    const rig = createHumanoid({ seed: 42 });
    const forward = FIGHT_STYLE_NAMES.map((n) => styleProfile(rig, n));
    const back = [...FIGHT_STYLE_NAMES].reverse().map((n) => styleProfile(rig, n));
    back.reverse();
    forward.forEach((p, i) => {
      expect(p.base).toBe(back[i].base);
      expect(p.reach).toBe(back[i].reach);
      expect(p.power).toBe(back[i].power);
      expect(p.cover).toBe(back[i].cover);
      expect(p.centre).toBe(back[i].centre);
      expect(p.rooted).toBe(back[i].rooted);
      expect(p.weakLine).toBe(back[i].weakLine);
    });
  });

  it('measures the guard as the guard, not as whatever came before it', () => {
    for (const n of FIGHT_STYLE_NAMES) {
      const alone = createHumanoid({ seed: 42 });
      const g = new Guard(alone, { style: FIGHT_STYLES[n].guard, fade: 0 });
      for (let i = 0; i < 40; i++) g.update(1 / 120);
      expect(styleProfile(createHumanoid({ seed: 42 }), n).cover).toBeCloseTo(
        coverageOf(alone, 'head'),
        9
      );
    }
  });

  it('leaves the body exactly as it found it', () => {
    const rig = createHumanoid({ seed: 42 });
    rig.object.updateMatrixWorld(true);
    const was = stability(rig);
    const hips = rig.bones.Hips.position.clone();
    for (const n of FIGHT_STYLE_NAMES) styleProfile(rig, n);
    expect(stability(rig)).toBeCloseTo(was, 9);
    expect(rig.bones.Hips.position.distanceTo(hips)).toBeLessThan(1e-9);
  });
});

describe('nobody wins every column', () => {
  const rig = createHumanoid({ seed: 42 });
  const profiles = Object.fromEntries(FIGHT_STYLE_NAMES.map((n) => [n, styleProfile(rig, n)]));
  const COLUMNS = ['base', 'reach', 'power', 'poise', 'cover', 'guardBody', 'centre', 'rooted'] as const;

  it('has no style top of everything and none bottom of everything', () => {
    const tops = (n: string) =>
      COLUMNS.every(
        (c) => profiles[n][c] === Math.max(...FIGHT_STYLE_NAMES.map((m) => profiles[m][c]))
      );
    const bottoms = (n: string) =>
      COLUMNS.every(
        (c) => profiles[n][c] === Math.min(...FIGHT_STYLE_NAMES.map((m) => profiles[m][c]))
      );
    expect(FIGHT_STYLE_NAMES.filter(tops)).toEqual([]);
    expect(FIGHT_STYLE_NAMES.filter(bottoms)).toEqual([]);
  });

  it('spreads every column', () => {
    for (const c of ['base', 'cover', 'rooted'] as const) {
      const v = FIGHT_STYLE_NAMES.map((n) => profiles[n][c]);
      expect(Math.max(...v) / Math.min(...v)).toBeGreaterThan(1.2);
    }
  });

  it('roots the long stance better than the wide one, and breaks the wide one backwards', () => {
    expect(profiles.karate.rooted).toBeGreaterThan(profiles.brawler.rooted);
    expect(profiles.brawler.weakLine).toBe('back');
  });

  it('gives the centre line to the style built to hold it', () => {
    for (const n of FIGHT_STYLE_NAMES) {
      if (n === 'wingChun') continue;
      expect(profiles.wingChun.centre).toBeGreaterThan(profiles[n].centre);
    }
  });
});

describe('reach belongs to the arm', () => {
  it('is the same whenever it is first asked', () => {
    const clean = strikeReach(createHumanoid({ seed: 42 }), 'cross');
    const rig = createHumanoid({ seed: 42 });
    const hold = holdStance(rig);
    applyStance(rig, hold, FIGHT_STYLES.karate.stance);
    expect(strikeReach(rig, 'cross')).toBe(clean);
    releaseStance(rig, hold);
    expect(strikeReach(rig, 'cross')).toBe(clean);
  });
});

describe('follow is available and deliberately unused', () => {
  it('buys effective mass', () => {
    const lo = measureStrike(createHumanoid({ seed: 42 }), 'cross', { skill: 0.8, follow: 0.15 });
    const hi = measureStrike(createHumanoid({ seed: 42 }), 'cross', { skill: 0.8, follow: 0.95 });
    expect(hi.mass / lo.mass).toBeGreaterThan(1.5);
  });

  it('...and no style sets it, because it costs almost nothing', () => {
    for (const n of FIGHT_STYLE_NAMES) {
      expect((FIGHT_STYLES[n] as unknown as Record<string, unknown>).follow).toBeUndefined();
    }
  });
});

describe('the controller', () => {
  it('takes the stance and hands it back', () => {
    const rig = createHumanoid({ seed: 42 });
    rig.object.updateMatrixWorld(true);
    const was = stability(rig);
    const style = new FightStyle(rig, 'brawler', { fade: 0 });
    for (let i = 0; i < 20; i++) style.update(1 / 60);
    expect(Math.abs(stability(rig) - was)).toBeGreaterThan(1e-3);
    style.release();
    expect(stability(rig)).toBeCloseTo(was, 9);
  });

  it('changes what the body is standing in when it switches', () => {
    const rig = createHumanoid({ seed: 42 });
    const style = new FightStyle(rig, 'boxing', { fade: 0 });
    for (let i = 0; i < 20; i++) style.update(1 / 60);
    const boxing = stability(rig);
    style.switchTo('wingChun');
    for (let i = 0; i < 20; i++) style.update(1 / 60);
    expect(stability(rig)).not.toBeCloseTo(boxing, 3);
    style.release();
  });

  it('knows its own repertoire and walks it in order', () => {
    const rig = createHumanoid({ seed: 42 });
    const style = new FightStyle(rig, 'muayThai');
    expect(style.knows('elbow')).toBe(true);
    expect(style.knows('overhand')).toBe(false);
    const list = FIGHT_STYLES.muayThai.repertoire;
    for (let i = 0; i < list.length * 2; i++) expect(style.at(i)).toBe(list[i % list.length]);
    expect(style.at(-1)).toBe(list[list.length - 1]);
  });
});
