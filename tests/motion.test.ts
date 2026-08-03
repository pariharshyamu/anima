import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  MotionMatcher, buildMotionDatabase, froudeNumber, matchFrame, queryFeature,
} from '../src/motion';
import { createHumanoid } from '../src/humanoid';
import { Locomotion } from '../src/locomotion';

const rig = createHumanoid({ seed: 5, height: 1.75 });
const db = buildMotionDatabase(rig);
const WALK = db.clips.walkSpeed;
const RUN = db.clips.runSpeed;
const schedule = (t: number): number => (t < 3 ? 0 : t < 7 ? WALK : t < 11 ? RUN : 0.8);

interface Drive {
  speedError: number;
  jumpsPerSecond: number;
  popRate: number;
  worstSettle: number;
}

function drive(options: Parameters<typeof buildMotionDatabase>[1] = {}): Drive {
  const body = createHumanoid({ seed: 5, height: 1.75 });
  const matcher = new MotionMatcher(body, { database: buildMotionDatabase(body, options) });
  let error = 0;
  let n = 0;
  const trace: { t: number; got: number }[] = [];
  for (let i = 0; i * (1 / 60) < 15; i++) {
    const t = i / 60;
    const want = schedule(t);
    matcher.update(1 / 60, want);
    error += Math.abs(matcher.speed - want);
    n++;
    trace.push({ t, got: matcher.speed });
  }
  const settle = [3, 7, 11].map((at) => {
    const target = schedule(at + 0.01);
    const hit = trace.find(
      (x) => x.t >= at && Math.abs(x.got - target) <= 0.15 * Math.max(0.3, target)
    );
    return hit ? hit.t - at : Infinity;
  });
  return {
    speedError: error / n,
    jumpsPerSecond: matcher.jumps / 15,
    popRate: matcher.jumps / Math.max(1, matcher.searches),
    worstSettle: Math.max(...settle),
  };
}

describe('every feature is a length', () => {
  it('gives each frame fifteen finite numbers', () => {
    expect(db.frames.length).toBeGreaterThan(100);
    for (const f of db.frames) {
      expect(f.feature).toHaveLength(15);
      for (const v of f.feature) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('takes the foot time constant from the data and nowhere else', () => {
    expect(db.tauFoot * db.footSpread).toBeCloseTo(db.positionSpread, 12);
    expect(db.tauFoot).toBeGreaterThan(0);
  });

  it('puts the horizons a third of a step apart', () => {
    expect(db.horizons).toHaveLength(3);
    db.horizons.forEach((h, i) => expect(h).toBeCloseTo(((i + 1) * db.stepTime) / 3, 12));
  });

  it('leaves the time constant alone when the body changes size', () => {
    // It is a length over a length per second. A bigger body has bigger feet
    // moving faster, and the ratio cannot notice.
    const small = buildMotionDatabase(createHumanoid({ seed: 5, height: 1.4 }));
    const large = buildMotionDatabase(createHumanoid({ seed: 5, height: 2.1 }));
    expect(small.tauFoot).toBeCloseTo(large.tauFoot, 9);
    const k = large.positionSpread / small.positionSpread;
    expect(large.footSpread / small.footSpread).toBeCloseTo(k, 9);
  });

  it('scales the whole vector with the body', () => {
    const small = buildMotionDatabase(createHumanoid({ seed: 5, height: 1.4 }));
    const large = buildMotionDatabase(createHumanoid({ seed: 5, height: 2.8 }));
    const k = 2.8 / 1.4;
    const i = Math.floor(small.frames.length / 3);
    for (let c = 0; c < 15; c++) {
      if (Math.abs(small.frames[i].feature[c]) < 1e-6) continue;
      expect(large.frames[i].feature[c] / small.frames[i].feature[c]).toBeCloseTo(k, 6);
    }
  });
});

describe('the search', () => {
  const query = queryFeature(db, {
    left: new Vector3(0.1, -0.8, 0.25), right: new Vector3(-0.1, -0.85, -0.2),
    leftVelocity: new Vector3(0, 0.2, 1.1), rightVelocity: new Vector3(0, -0.1, -0.9),
    speed: 1.6,
  });

  it('returns a real frame and a cost in square metres', () => {
    const m = matchFrame(db, query);
    expect(db.frames[m.index]).toBe(m.frame);
    expect(m.cost).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(m.cost)).toBe(true);
  });

  it('is the actual minimum, not merely a good one', () => {
    const m = matchFrame(db, query);
    for (const f of db.frames) {
      let c = 0;
      for (let i = 0; i < 15; i++) { const d = f.feature[i] - query[i]; c += d * d; }
      expect(c).toBeGreaterThanOrEqual(m.cost - 1e-12);
    }
  });

  it('is deterministic — same database, same answer', () => {
    expect(matchFrame(buildMotionDatabase(rig), query).index).toBe(matchFrame(db, query).index);
  });

  it('picks a standing frame when asked to stand and a moving one when not', () => {
    const still = (speed: number): number =>
      matchFrame(db, queryFeature(db, {
        left: new Vector3(), right: new Vector3(),
        leftVelocity: new Vector3(), rightVelocity: new Vector3(), speed,
      })).frame.speed;
    expect(still(0)).toBe(0);
    expect(still(RUN)).toBeGreaterThan(WALK);
  });
});

describe('the controller answers the command', () => {
  const measured = drive();

  it('tracks the speed it is given', () => {
    expect(measured.speedError).toBeLessThan(0.1);
    expect(Number.isFinite(measured.worstSettle)).toBe(true);
  });

  it('does not pop more than once per step', () => {
    expect(measured.jumpsPerSecond).toBeLessThanOrEqual(1 / db.stepTime);
  });

  it('answers sooner than the blend tree it replaces', () => {
    const body = createHumanoid({ seed: 5, height: 1.75 });
    const loco = new Locomotion(body);
    const trace: { t: number; got: number }[] = [];
    for (let i = 0; i * (1 / 60) < 15; i++) {
      const t = i / 60;
      loco.update(1 / 60, schedule(t));
      trace.push({ t, got: loco.speed });
    }
    const blend = Math.max(...[3, 7, 11].map((at) => {
      const target = schedule(at + 0.01);
      const hit = trace.find(
        (x) => x.t >= at && Math.abs(x.got - target) <= 0.15 * Math.max(0.3, target)
      );
      return hit ? hit.t - at : Infinity;
    }));
    expect(measured.worstSettle).toBeLessThan(blend);
  });

  it('survives a zero step and a negative one', () => {
    const body = createHumanoid({ seed: 5, height: 1.75 });
    const matcher = new MotionMatcher(body);
    matcher.update(0, 1);
    matcher.update(-1, 1);
    expect(matcher.elapsed).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(matcher.speed)).toBe(true);
  });

  it('takes a Vector3 velocity as readily as a number', () => {
    const body = createHumanoid({ seed: 5, height: 1.75 });
    const matcher = new MotionMatcher(body);
    for (let i = 0; i < 300; i++) matcher.update(1 / 60, new Vector3(WALK, 0, 0));
    expect(matcher.speed).toBeGreaterThan(0.5 * WALK);
  });
});

describe('the constants are load-bearing', () => {
  it('needs the velocity term, or a foot going forward looks like one going back', () => {
    // Without it the search cannot tell mid-swing from mid-stance through the
    // same place, and flips between them.
    expect(drive({ tauFoot: 0 }).jumpsPerSecond).toBeGreaterThan(drive().jumpsPerSecond * 4);
  });

  it('needs the trajectory, or the command is never heard', () => {
    const none = drive({ horizons: [0, 0, 0] });
    expect(none.speedError).toBeGreaterThan(1);
    expect(Number.isFinite(none.worstSettle)).toBe(false);
  });

  it('drowns the command out when the velocity term is turned up', () => {
    expect(drive({ tauFoot: db.tauFoot * 6 }).speedError).toBeGreaterThan(1);
  });
});

describe('froudeNumber', () => {
  it('is v² over gL, and dimensionless', () => {
    expect(froudeNumber(3, 0.9)).toBeCloseTo(9 / (9.81 * 0.9), 12);
    expect(froudeNumber(0, 0.9)).toBe(0);
  });

  it('does not divide by a leg of no length', () => {
    expect(Number.isFinite(froudeNumber(1, 0))).toBe(true);
  });

  it('says ANIMA’s walkers are not yet dynamically similar', () => {
    // Alexander (1976): geometrically similar walkers move alike at equal
    // Froude number. The cadence here is a flat 0.5 s at every size, so they
    // do not — reported by `npm run motion`, and the subject of a later
    // release. The test states the defect rather than pretending it is absent.
    const of = (height: number): number => {
      const body = createHumanoid({ seed: 5, height });
      return froudeNumber(buildMotionDatabase(body).clips.walkSpeed, body.legLength);
    };
    expect(of(2.05) / of(1.4)).toBeGreaterThan(1.3);
  });
});
