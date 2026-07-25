import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { createHumanoid, DeskWork, Locomotion, Washing, type WashTask } from '../src';

function setup(options: ConstructorParameters<typeof Washing>[2] = {}) {
  const rig = createHumanoid({ seed: 6 });
  const loco = new Locomotion(rig);
  return { rig, loco, wash: new Washing(rig, loco, options) };
}

/** Through the real path: Locomotion drives the mixer, Washing only asks. */
function run(loco: Locomotion, wash: Washing, seconds: number): void {
  for (let i = 0; i < seconds * 60; i++) {
    loco.update(1 / 60, 0);
    wash.update(1 / 60);
  }
}
const world = (o: Object3D): Vector3 => o.getWorldPosition(new Vector3());

const TASKS: WashTask[] = ['scrub', 'rinse', 'tap', 'dry'];

describe('Washing', () => {
  it('does nothing until asked', () => {
    expect(setup().wash.task).toBeNull();
  });

  it.each(TASKS)('%s puts the hands below the elbows', (task) => {
    // The defining difference from a desk: a bowl is BELOW the elbows, so
    // the hands drop under them. At a desk they are level with them.
    const { rig, loco, wash } = setup();
    wash.do(task);
    run(loco, wash, 1.2);
    rig.object.updateWorldMatrix(true, true);
    for (const side of ['Left', 'Right'] as const) {
      const hand = world(rig.bones[`${side}Hand`]);
      const elbow = world(rig.bones[`${side}ForeArm`]);
      expect(hand.y).toBeLessThan(elbow.y);
    }
  });

  it('brings the hands TOGETHER, unlike a desk', () => {
    // At a keyboard the forearms are parallel and the hands are a shoulder
    // width apart. Over a bowl they converge.
    const rig = createHumanoid({ seed: 6 });
    const loco = new Locomotion(rig);
    const wash = new Washing(rig, loco);
    wash.do('scrub');
    run(loco, wash, 1.2);
    rig.object.updateWorldMatrix(true, true);
    const washGap = Math.abs(
      world(rig.bones.LeftHand).x - world(rig.bones.RightHand).x
    );

    const rig2 = createHumanoid({ seed: 6 });
    const loco2 = new Locomotion(rig2);
    const desk = new DeskWork(rig2, loco2);
    desk.do('type');
    for (let i = 0; i < 72; i++) {
      loco2.update(1 / 60, 0);
      desk.update(1 / 60);
    }
    rig2.object.updateWorldMatrix(true, true);
    const deskGap = Math.abs(
      world(rig2.bones.LeftHand).x - world(rig2.bones.RightHand).x
    );
    expect(washGap).toBeLessThan(deskGap);
  });

  it('drops the head — you are looking at your hands', () => {
    // The one thing the desk pose is careful NOT to do, because there the
    // screen is at eye height.
    const rig = createHumanoid({ seed: 6 });
    const loco = new Locomotion(rig);
    const wash = new Washing(rig, loco);
    rig.object.updateWorldMatrix(true, true);
    const rest = world(rig.bones.Head).y;
    wash.do('scrub');
    run(loco, wash, 1.2);
    rig.object.updateWorldMatrix(true, true);
    const washHead = world(rig.bones.Head).y;
    expect(washHead).toBeLessThan(rest - 0.01);

    const rig2 = createHumanoid({ seed: 6 });
    const loco2 = new Locomotion(rig2);
    const desk = new DeskWork(rig2, loco2);
    desk.do('type');
    for (let i = 0; i < 72; i++) {
      loco2.update(1 / 60, 0);
      desk.update(1 / 60);
    }
    rig2.object.updateWorldMatrix(true, true);
    expect(washHead).toBeLessThan(world(rig2.bones.Head).y);
  });

  it('scrubbing actually moves the hands, and not in lockstep', () => {
    // Correlate frame-to-frame CHANGE, not position: raw positions share the
    // idle clip's slow breathing and report hands moving together whatever
    // the overlay is doing.
    const { rig, loco, wash } = setup();
    wash.do('scrub');
    run(loco, wash, 0.6);
    const left: number[] = [];
    const right: number[] = [];
    let prevL = world(rig.bones.LeftHand).clone();
    let prevR = world(rig.bones.RightHand).clone();
    for (let i = 0; i < 90; i++) {
      loco.update(1 / 60, 0);
      rig.object.updateWorldMatrix(true, true);
      const l = world(rig.bones.LeftHand);
      const r = world(rig.bones.RightHand);
      left.push(l.y - prevL.y);
      right.push(r.y - prevR.y);
      prevL = l.clone();
      prevR = r.clone();
    }
    const travel = left.reduce((a, d) => a + Math.abs(d), 0);
    expect(travel).toBeGreaterThan(0.02);

    const mean = (v: number[]): number => v.reduce((a, x) => a + x, 0) / v.length;
    const ml = mean(left);
    const mr = mean(right);
    const cov = mean(left.map((d, i) => (d - ml) * (right[i] - mr)));
    const sd = (v: number[], m: number): number =>
      Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
    const r = cov / (sd(left, ml) * sd(right, mr) || 1);
    // Hands circle around each other in antiphase, not up and down together.
    expect(r).toBeLessThan(0.6);
  });

  it('reaching for the tap extends one arm and leaves the other in the bowl', () => {
    const { rig, loco, wash } = setup({ hand: 'Right' });
    wash.do('tap');
    // Sample across the reach cycle and take the furthest extension.
    let bestReach = -Infinity;
    let otherAt = 0;
    for (let i = 0; i < 240; i++) {
      loco.update(1 / 60, 0);
      rig.object.updateWorldMatrix(true, true);
      const right = world(rig.bones.RightHand);
      const shoulder = world(rig.bones.RightArm);
      const extension = right.distanceTo(shoulder);
      if (extension > bestReach) {
        bestReach = extension;
        otherAt = world(rig.bones.LeftHand).y;
      }
    }
    const rest = world(rig.bones.LeftForeArm).y;
    expect(bestReach).toBeGreaterThan(0.3);
    // The other hand stays down in the water while it happens.
    expect(otherAt).toBeLessThan(rest);
  });

  it('works through washing in ORDER, not at random', () => {
    // Unlike desk work, washing has a sequence: you do not rinse before you
    // scrub.
    const { loco, wash } = setup({ seed: 3 });
    wash.do('tap');
    const seen: WashTask[] = ['tap'];
    for (let i = 0; i < 60 * 40; i++) {
      loco.update(1 / 60, 0);
      wash.update(1 / 60);
      if (wash.task && wash.task !== seen[seen.length - 1]) seen.push(wash.task);
      if (seen.length >= 5) break;
    }
    expect(seen.slice(0, 4)).toEqual(['tap', 'scrub', 'rinse', 'dry']);
  });

  it('stops cleanly and lets the arms go', () => {
    const { rig, loco, wash } = setup();
    wash.do('scrub');
    run(loco, wash, 1);
    rig.object.updateWorldMatrix(true, true);
    const washing = world(rig.bones.RightHand).clone();
    wash.stop();
    run(loco, wash, 1.5);
    rig.object.updateWorldMatrix(true, true);
    expect(wash.task).toBeNull();
    expect(world(rig.bones.RightHand).distanceTo(washing)).toBeGreaterThan(0.05);
  });

  it('the overlay out-weighs the idle clip', () => {
    // At weight 1 a masked overlay is a 50/50 average with idle and every arm
    // reaches half way — a wash pose ends up hovering above the bowl.
    const { rig, loco, wash } = setup();
    rig.object.updateWorldMatrix(true, true);
    const rest = world(rig.bones.RightHand);
    wash.do('scrub');
    run(loco, wash, 1.5);
    rig.object.updateWorldMatrix(true, true);
    const at = world(rig.bones.RightHand);
    // A real move inward and downward, not a token one.
    expect(Math.abs(at.x)).toBeLessThan(Math.abs(rest.x) * 0.75);
  });
});
