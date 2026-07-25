import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createHumanoid, LookAt } from '../src';

function setup() {
  const rig = createHumanoid({ seed: 8 });
  rig.object.updateWorldMatrix(true, true);
  return { rig, gaze: new LookAt(rig) };
}

const facing = (rig: ReturnType<typeof createHumanoid>): Vector3 => {
  rig.object.updateWorldMatrix(true, true);
  return new Vector3(0, 0, 1).transformDirection(rig.bones.Head.matrixWorld);
};

function step(gaze: LookAt, seconds: number): void {
  for (let i = 0; i < seconds * 60; i++) gaze.update(1 / 60);
}

describe('LookAt.glance', () => {
  it('turns the head and gives it back', () => {
    const { rig, gaze } = setup();
    step(gaze, 0.5);
    const straight = facing(rig).x;

    // Something goes off to the side. Not BEHIND the side: LookAt fades out
    // over the last stretch of its yaw range, and rightly — nobody swivels
    // their head 85 degrees without also turning their body.
    gaze.glance(new Vector3(2.2, 1.5, 2.2), 1.0);
    expect(gaze.glancing).toBe(true);
    step(gaze, 0.6);
    const turned = facing(rig).x;
    expect(turned).toBeGreaterThan(straight + 0.3);

    step(gaze, 2.0);
    expect(gaze.glancing).toBe(false);
    expect(facing(rig).x).toBeLessThan(turned - 0.2);
  });

  it('outranks the standing target while it runs, then restores it', () => {
    const { rig, gaze } = setup();
    gaze.target = new Vector3(-2.2, 1.5, 2.2); // watching something on the left
    step(gaze, 1.2);
    const left = facing(rig).x;
    expect(left).toBeLessThan(-0.2);

    gaze.glance(new Vector3(2.2, 1.5, 2.2), 1.0);
    step(gaze, 0.7);
    expect(facing(rig).x).toBeGreaterThan(left + 0.3);

    // Back to what it was watching before — no bookkeeping by the caller.
    step(gaze, 2.0);
    expect(facing(rig).x).toBeLessThan(-0.2);
  });

  it('replaces an in-flight glance — you look at the newer thing', () => {
    const { rig, gaze } = setup();
    gaze.glance(new Vector3(-2.2, 1.5, 2.2), 3.0);
    step(gaze, 0.5);
    expect(facing(rig).x).toBeLessThan(-0.15);
    gaze.glance(new Vector3(2.2, 1.5, 2.2), 1.5);
    step(gaze, 0.8);
    expect(facing(rig).x).toBeGreaterThan(0.15);
  });

  it('can be cut short', () => {
    const { gaze } = setup();
    gaze.glance(new Vector3(2.2, 1.5, 2.2), 10);
    expect(gaze.glancing).toBe(true);
    gaze.endGlance();
    expect(gaze.glancing).toBe(false);
  });

  it('eases rather than snapping', () => {
    const { rig, gaze } = setup();
    step(gaze, 0.5);
    gaze.glance(new Vector3(2.2, 1.5, 2.2), 2.0);
    const path: number[] = [];
    for (let i = 0; i < 30; i++) {
      gaze.update(1 / 60);
      path.push(facing(rig).x);
    }
    const jumps = path.slice(1).map((v, i) => Math.abs(v - path[i]));
    // No single frame carries a large share of the turn.
    expect(Math.max(...jumps)).toBeLessThan(0.12);
    expect(path[path.length - 1]).toBeGreaterThan(path[0] + 0.2);
  });
});
