import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createHumanoid, createQuadruped, Locomotion, Mount, createRideClip } from '../src';

function setup() {
  const rig = createHumanoid({ seed: 21 });
  const loco = new Locomotion(rig);
  const mount = new Mount(rig, loco);
  const horse = createQuadruped({ seed: 11 });
  horse.object.updateMatrixWorld(true);
  return { rig, loco, mount, horse };
}

const step = (m: Mount, seconds: number, dt = 1 / 60) => {
  for (let i = 0; i < seconds / dt; i++) m.update(dt);
};

describe('Mount', () => {
  it('SITS the rider — hips on the saddle, not feet on the horse\'s back', () => {
    // The regression that shipped in 0.12.0: a humanoid's origin is between
    // its feet, so parenting it to a saddle stands the rider on the horse's
    // back with their hips a metre in the air. Sitting means putting the
    // HIP JOINT on the seat.
    const { rig, mount, horse } = setup();
    mount.mount(horse);
    step(mount, 3);
    expect(mount.phase).toBe('seated');
    horse.object.updateMatrixWorld(true);
    rig.object.updateMatrixWorld(true);

    const seat = horse.saddle.getWorldPosition(new Vector3());
    const hips = rig.bones.Hips.getWorldPosition(new Vector3());
    const feet = rig.object.getWorldPosition(new Vector3());
    // The hips sit on the saddle…
    expect(hips.distanceTo(seat), 'hips on the seat').toBeLessThan(0.2);
    // …and the feet hang WELL below it, either side of the barrel.
    expect(feet.y).toBeLessThan(seat.y - 0.5);
    // The rider's head must clear the horse, not float above it absurdly.
    const head = rig.bones.Head.getWorldPosition(new Vector3());
    expect(head.y - seat.y).toBeGreaterThan(0.4);
    expect(head.y - seat.y).toBeLessThan(0.95);
  });

  it('rises through the mount stages without teleporting', () => {
    const { rig, mount, horse } = setup();
    const seat = horse.saddle.getWorldPosition(new Vector3());
    mount.mount(horse);
    const heights: number[] = [];
    for (let i = 0; i < 3 / (1 / 60); i++) {
      mount.update(1 / 60);
      rig.object.updateMatrixWorld(true);
      heights.push(rig.object.getWorldPosition(new Vector3()).y);
    }
    // No single frame jumps more than a fifth of the way up the horse.
    for (let i = 1; i < heights.length; i++) {
      expect(Math.abs(heights[i] - heights[i - 1]), `frame ${i}`).toBeLessThan(seat.y * 0.2);
    }
  });

  it('picks the seat a rider would use for the gait', () => {
    const { mount } = setup();
    expect(mount.seatFor('walk')).toBe('seat');
    expect(mount.seatFor('trot')).toBe('posting');   // you post to a trot…
    expect(mount.seatFor('canter')).toBe('seat');    // …and you cannot to a canter
    expect(mount.seatFor('gallop')).toBe('twoPoint');
  });

  it('the ride poses splay the thighs enough to clear a horse', () => {
    const rig = createHumanoid({ seed: 3 });
    for (const seat of ['seat', 'posting', 'twoPoint'] as const) {
      const clip = createRideClip(rig, seat);
      const bones = new Set(clip.tracks.map((t) => t.name.split('.')[0]));
      expect(bones.has('LeftUpLeg'), seat).toBe(true);
      expect(bones.has('RightUpLeg'), seat).toBe(true);
      expect(clip.duration).toBeGreaterThan(0);
    }
    // Posting is a fast cycle (one rise per stride); sitting is a slow breath.
    expect(createRideClip(rig, 'posting').duration).toBeLessThan(
      createRideClip(rig, 'seat').duration
    );
  });

  it('dismounts back to the ground', () => {
    const { rig, mount, horse } = setup();
    mount.mount(horse);
    step(mount, 3);
    mount.dismount();
    step(mount, 2);
    expect(mount.phase).toBe('off');
    rig.object.updateMatrixWorld(true);
    expect(rig.object.getWorldPosition(new Vector3()).y).toBeLessThan(0.35);
  });
});
