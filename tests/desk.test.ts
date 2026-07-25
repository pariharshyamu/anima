import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { createHumanoid, DeskWork, Locomotion, type DeskTask } from '../src';

function setup(options: ConstructorParameters<typeof DeskWork>[2] = {}) {
  const rig = createHumanoid({ seed: 6 });
  const loco = new Locomotion(rig);
  return { rig, loco, desk: new DeskWork(rig, loco, options) };
}

/** Through the real path: Locomotion drives the mixer, DeskWork only asks. */
function run(loco: Locomotion, desk: DeskWork, seconds: number): void {
  for (let i = 0; i < seconds * 60; i++) {
    loco.update(1 / 60, 0);
    desk.update(1 / 60);
  }
}
const world = (o: Object3D): Vector3 => o.getWorldPosition(new Vector3());
const forward = (o: Object3D): Vector3 => new Vector3(0, 0, 1).transformDirection(o.matrixWorld);

describe('DeskWork', () => {
  it('does nothing until asked', () => {
    const { desk } = setup();
    expect(desk.task).toBeNull();
  });

  it('brings both hands forward onto the keyboard to type', () => {
    const { rig, loco, desk } = setup();
    rig.object.updateWorldMatrix(true, true);
    const restZ = world(rig.bones.RightHand).z;
    desk.do('type');
    run(loco, desk, 1.2);
    rig.object.updateWorldMatrix(true, true);
    for (const h of [rig.bones.LeftHand, rig.bones.RightHand]) {
      const at = world(h);
      expect(at.z).toBeGreaterThan(restZ + 0.15); // out in front
      expect(at.y).toBeGreaterThan(0.85); // ...and up at desk height
      expect(at.y).toBeLessThan(1.35);
    }
    // Hands roughly level with each other on the home row.
    expect(Math.abs(world(rig.bones.LeftHand).y - world(rig.bones.RightHand).y)).toBeLessThan(0.1);
  });

  it('keeps the head near level — a keyboard is not a phone', () => {
    // The phone lean drops the head ~0.8 because the screen IS the thing in
    // your hand. At a desk the screen is at eye height and the hands are not
    // what you are looking at, so borrowing the phone posture reads as
    // somebody staring at their own keyboard.
    const { rig, loco, desk } = setup();
    desk.do('type');
    run(loco, desk, 1.2);
    rig.object.updateWorldMatrix(true, true);
    expect(forward(rig.bones.Head).y).toBeGreaterThan(-0.45);
    expect(forward(rig.bones.Head).y).toBeLessThan(0.05);
  });

  it('moves the wrists while typing', () => {
    const { rig, loco, desk } = setup();
    desk.do('type');
    run(loco, desk, 0.6);
    const samples: number[] = [];
    for (let i = 0; i < 120; i++) {
      loco.update(1 / 60, 0);
      rig.object.updateWorldMatrix(true, true);
      samples.push(world(rig.bones.RightHand).y);
    }
    // With no fingers, the wrist IS the keystroke. If this is flat, the
    // character is resting their hands on a keyboard, not using it.
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.004);
  });

  it('does not strike both hands together', () => {
    const { rig, loco, desk } = setup();
    desk.do('type');
    run(loco, desk, 0.6);
    const l: number[] = [];
    const r: number[] = [];
    for (let i = 0; i < 150; i++) {
      loco.update(1 / 60, 0);
      rig.object.updateWorldMatrix(true, true);
      l.push(world(rig.bones.LeftHand).y);
      r.push(world(rig.bones.RightHand).y);
    }
    // Correlate the frame-to-frame CHANGE, not the position. Both hands share
    // the idle clip's breathing underneath the pose, which is slow and moves
    // them together; a keystroke is fast and alternates. Correlating raw
    // positions measures the breathing and reports two hands typing in
    // lockstep when they are not.
    const diff = (a: number[]): number[] => a.slice(1).map((v, i) => v - a[i]);
    const dl2 = diff(l);
    const dr2 = diff(r);
    const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
    const ml = mean(dl2);
    const mr = mean(dr2);
    let num = 0;
    let dl = 0;
    let dr = 0;
    for (let i = 0; i < dl2.length; i++) {
      num += (dl2[i] - ml) * (dr2[i] - mr);
      dl += (dl2[i] - ml) ** 2;
      dr += (dr2[i] - mr) ** 2;
    }
    // Hands in lockstep would correlate near +1. Alternating is what we want.
    expect(num / Math.sqrt(dl * dr || 1)).toBeLessThan(0.5);
  });

  it('reaches one hand out to the mouse, and keeps the other on the keys', () => {
    const { rig, loco, desk } = setup({ hand: 'Right' });
    desk.do('type');
    run(loco, desk, 1.2);
    rig.object.updateWorldMatrix(true, true);
    const typingX = world(rig.bones.RightHand).x;

    desk.do('mouse');
    run(loco, desk, 1.4);
    rig.object.updateWorldMatrix(true, true);
    // Out to the side (the right hand is at -x on this rig).
    expect(world(rig.bones.RightHand).x).toBeLessThan(typingX - 0.02);
    // The left hand has not gone anywhere.
    expect(world(rig.bones.LeftHand).z).toBeGreaterThan(0.1);
  });

  it('sits back to think, and comes forward to type', () => {
    const { rig, loco, desk } = setup();
    desk.do('type');
    run(loco, desk, 1.2);
    rig.object.updateWorldMatrix(true, true);
    const typingChest = forward(rig.bones.Chest).y;

    desk.do('think');
    run(loco, desk, 1.6);
    rig.object.updateWorldMatrix(true, true);
    // Chest opens up: leaning back, not hunched forward.
    expect(forward(rig.bones.Chest).y).toBeGreaterThan(typingChest + 0.05);
    // ...and the hands come off the desk.
    expect(world(rig.bones.RightHand).z).toBeLessThan(0.25);
  });

  it('wanders between tasks on its own', () => {
    // Nobody types continuously for ten minutes, and a character who does is
    // the clearest possible tell.
    const { loco, desk } = setup({ seed: 4 });
    desk.do('type');
    const seen = new Set<DeskTask>();
    for (let i = 0; i < 60 * 200; i++) {
      loco.update(1 / 60, 0);
      desk.update(1 / 60);
      if (desk.task) seen.add(desk.task);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it('never repeats the same task twice running', () => {
    const { loco, desk } = setup({ seed: 11 });
    desk.do('type');
    const order: DeskTask[] = ['type'];
    for (let i = 0; i < 60 * 300; i++) {
      loco.update(1 / 60, 0);
      desk.update(1 / 60);
      if (desk.task && desk.task !== order[order.length - 1]) order.push(desk.task);
    }
    expect(order.length).toBeGreaterThan(4);
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
  });

  it('stops cleanly', () => {
    const { loco, desk } = setup();
    desk.do('type');
    run(loco, desk, 0.5);
    desk.stop();
    expect(desk.task).toBeNull();
    run(loco, desk, 1); // must not throw or resume
    expect(desk.task).toBeNull();
  });

  it('is deterministic in its seed', () => {
    const trace = (seed: number): string => {
      const { loco, desk } = setup({ seed });
      desk.do('type');
      const out: string[] = [];
      for (let i = 0; i < 60 * 120; i++) {
        loco.update(1 / 60, 0);
        desk.update(1 / 60);
        out.push(desk.task ?? '-');
      }
      return out.join('');
    };
    expect(trace(5)).toBe(trace(5));
    expect(trace(5)).not.toBe(trace(6));
  });
});
