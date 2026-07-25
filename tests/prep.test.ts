import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createHumanoid, Locomotion, Prepping, type PrepTask } from '../src';

const TASKS: PrepTask[] = ['chopBoard', 'grind', 'crank', 'knead', 'whisk'];

function setup(options: ConstructorParameters<typeof Prepping>[2] = {}) {
  const rig = createHumanoid({ seed: 6, height: 1.75 });
  const loco = new Locomotion(rig);
  return { rig, loco, prep: new Prepping(rig, loco, options) };
}

/** Through the real path: Locomotion drives the mixer, Prepping tweaks after. */
function run(loco: Locomotion, prep: Prepping, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    loco.update(1 / 60, 0);
    prep.update(1 / 60);
  }
}

/** Sample both hands in the BODY's frame over `seconds`. */
function trace(
  rig: ReturnType<typeof createHumanoid>,
  loco: Locomotion,
  prep: Prepping,
  seconds: number
): { work: Vector3[]; guide: Vector3[] } {
  const work: Vector3[] = [];
  const guide: Vector3[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    loco.update(1 / 60, 0);
    prep.update(1 / 60);
    rig.object.updateWorldMatrix(true, true);
    const root = rig.object.getWorldPosition(new Vector3());
    work.push(rig.bones.RightHand.getWorldPosition(new Vector3()).sub(root));
    guide.push(rig.bones.LeftHand.getWorldPosition(new Vector3()).sub(root));
  }
  return { work, guide };
}

const travel = (v: Vector3[]): number =>
  v.slice(1).reduce((a, p, i) => a + p.distanceTo(v[i]), 0);

describe('Prepping', () => {
  it('does nothing until asked', () => {
    expect(setup().prep.task).toBeNull();
  });

  it.each(TASKS)('%s puts both hands out in front at bench height', (task) => {
    const { rig, loco, prep } = setup();
    prep.do(task);
    run(loco, prep, 1.5);
    rig.object.updateWorldMatrix(true, true);
    const root = rig.object.getWorldPosition(new Vector3());
    for (const side of ['Left', 'Right'] as const) {
      const at = rig.bones[`${side}Hand`].getWorldPosition(new Vector3()).sub(root);
      expect(at.y, `${task} ${side} height`).toBeGreaterThan(0.75);
      expect(at.y, `${task} ${side} height`).toBeLessThan(1.35);
      expect(at.z, `${task} ${side} reach`).toBeGreaterThan(0.15);
    }
  });

  it.each(TASKS)('%s brings the hands closer than a shoulder width apart', (task) => {
    // Prep work happens in front of you, not out at the sides.
    const { rig, loco, prep } = setup();
    prep.do(task);
    run(loco, prep, 1.5);
    rig.object.updateWorldMatrix(true, true);
    const gap = Math.abs(
      rig.bones.LeftHand.getWorldPosition(new Vector3()).x -
        rig.bones.RightHand.getWorldPosition(new Vector3()).x
    );
    expect(gap, `${task}`).toBeLessThan(0.4);
  });

  it('THE HANDS DO DIFFERENT THINGS — this is the whole track', () => {
    // Every other loop in the library is one-handed or symmetric. If the
    // guide hand travels as far as the working one, this is a two-handed
    // hammer with a knife in it.
    const { rig, loco, prep } = setup();
    prep.do('chopBoard');
    run(loco, prep, 2);
    const t = trace(rig, loco, prep, 2);
    expect(travel(t.work)).toBeGreaterThan(travel(t.guide) * 2);
  });

  it('a BRACING hand is still, and a working one is not', () => {
    // A mortar nobody is holding down slides across the bench.
    for (const task of ['grind', 'crank'] as PrepTask[]) {
      const { rig, loco, prep } = setup();
      prep.do(task);
      run(loco, prep, 2);
      const t = trace(rig, loco, prep, 2);
      // Relative, because a pestle circle is genuinely small — about 8 cm
      // across — and an absolute floor tuned for a crank fails it for being
      // the right size.
      expect(travel(t.guide), `${task} guide moved`).toBeLessThan(0.12);
      expect(travel(t.work), `${task} work did not`).toBeGreaterThan(0.25);
      expect(travel(t.work), `${task} hands too alike`).toBeGreaterThan(travel(t.guide) * 3);
    }
  });

  it('kneading is ANTI-PHASE, not two hands doing the same thing', () => {
    // Both hands pushing together is a press.
    const { rig, loco, prep } = setup();
    prep.do('knead');
    run(loco, prep, 2);
    const t = trace(rig, loco, prep, 3);
    const mean = (v: number[]): number => v.reduce((a, x) => a + x, 0) / v.length;
    const wz = t.work.map((p) => p.z);
    const gz = t.guide.map((p) => p.z);
    const mw = mean(wz);
    const mg = mean(gz);
    const cov = mean(wz.map((v, i) => (v - mw) * (gz[i] - mg)));
    const sd = (v: number[], m: number): number => Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
    const r = cov / (sd(wz, mw) * sd(gz, mg) || 1);
    expect(r).toBeLessThan(-0.5);
    // And both hands are genuinely working.
    expect(travel(t.work)).toBeGreaterThan(0.3);
    expect(travel(t.guide)).toBeGreaterThan(0.3);
  });

  it('a crank sweeps a WIDE circle and a pestle a small one', () => {
    const span = (task: PrepTask): number => {
      const { rig, loco, prep } = setup();
      prep.do(task);
      run(loco, prep, 2);
      const t = trace(rig, loco, prep, 3);
      const xs = t.work.map((p) => p.x);
      const zs = t.work.map((p) => p.z);
      return Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...zs) - Math.min(...zs)
      );
    };
    expect(span('crank')).toBeGreaterThan(span('grind') * 1.5);
  });

  it('the knife falls FASTER than it rises', () => {
    const { rig, loco, prep } = setup();
    prep.do('chopBoard');
    run(loco, prep, 1.5);
    const t = trace(rig, loco, prep, 2);
    const dy = t.work.slice(1).map((p, i) => p.y - t.work[i].y);
    const fastestFall = Math.abs(Math.min(...dy));
    const fastestRise = Math.max(...dy);
    expect(fastestFall).toBeGreaterThan(fastestRise * 1.2);
  });

  it('THE FEED HAND WALKS BACK across cuts, then starts a new piece', () => {
    // The part that cannot live in the clip: a retreat that spans seven cuts
    // is not something a half-second loop can express, so the controller
    // applies it on top of the mixer — the same division the swimmer's body
    // roll uses.
    const { rig, loco, prep } = setup();
    prep.do('chopBoard');
    const xs: number[] = [];
    const feeds: number[] = [];
    for (let i = 0; i < 60 * 5; i++) {
      loco.update(1 / 60, 0);
      prep.update(1 / 60);
      rig.object.updateWorldMatrix(true, true);
      xs.push(rig.bones.LeftHand.getWorldPosition(new Vector3()).x);
      feeds.push(prep.feed);
    }
    // The feed really advances...
    expect(Math.max(...feeds)).toBeGreaterThan(0.5);
    // ...and it resets, rather than walking off the end of the bench.
    expect(Math.min(...feeds.slice(60))).toBeLessThan(0.2);
    // And the hand actually moved with it.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.03);
  });

  it('nothing but the board task has a feed at all', () => {
    for (const task of ['grind', 'crank', 'knead', 'whisk'] as PrepTask[]) {
      const { loco, prep } = setup();
      prep.do(task);
      run(loco, prep, 5);
      expect(prep.feed, `${task}`).toBe(0);
    }
  });

  it('counts cycles, and pace changes how fast they come', () => {
    const { loco, prep } = setup();
    prep.do('chopBoard');
    run(loco, prep, 3);
    const normal = prep.count;
    expect(normal).toBeGreaterThan(3);

    const fast = setup();
    fast.prep.pace = 2;
    fast.prep.do('chopBoard');
    run(fast.loco, fast.prep, 3);
    expect(fast.prep.count).toBeGreaterThan(normal * 1.6);
  });

  it('the working hand follows the handedness it was given', () => {
    const right = setup({ hand: 'Right' });
    right.prep.do('chopBoard');
    run(right.loco, right.prep, 2);
    const rt = trace(right.rig, right.loco, right.prep, 2);
    expect(travel(rt.work)).toBeGreaterThan(travel(rt.guide));

    const left = setup({ hand: 'Left' });
    left.prep.do('chopBoard');
    run(left.loco, left.prep, 2);
    const lt = trace(left.rig, left.loco, left.prep, 2);
    // Mirrored: now the LEFT hand is the busy one.
    expect(travel(lt.guide)).toBeGreaterThan(travel(lt.work));
  });

  it('stops cleanly and gives the arms back', () => {
    const { rig, loco, prep } = setup();
    prep.do('grind');
    run(loco, prep, 1.5);
    rig.object.updateWorldMatrix(true, true);
    const working = rig.bones.RightHand.getWorldPosition(new Vector3()).clone();
    prep.stop();
    run(loco, prep, 1.5);
    rig.object.updateWorldMatrix(true, true);
    expect(prep.task).toBeNull();
    expect(rig.bones.RightHand.getWorldPosition(new Vector3()).distanceTo(working))
      .toBeGreaterThan(0.05);
  });
});
