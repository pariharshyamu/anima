import { describe, expect, it } from 'vitest';
import { Object3D, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import {
  createHumanoid,
  createLoopClip,
  createPoseClip,
  GRIPS,
  Interaction,
  Locomotion,
  type InteractionSlot,
  type PoseName,
} from '../src';

const rig = () => createHumanoid({ seed: 5 });

describe('pose clips', () => {
  it('builds every pose, loop-seamless', () => {
    const r = rig();
    for (const name of ['sit', 'sitLow', 'straddle', 'sleep', 'drive', 'cycle'] as PoseName[]) {
      const clip = createPoseClip(r, name);
      expect(clip.duration).toBeGreaterThan(0.5);
      for (const track of clip.tracks) {
        if (!(track instanceof QuaternionKeyframeTrack)) continue;
        const values = track.values;
        for (let c = 0; c < 4; c++) {
          expect(values[c]).toBeCloseTo(values[values.length - 4 + c], 5);
        }
      }
    }
  });

  it('seated poses drop the hips; sleep keeps the spine long', () => {
    const r = rig();
    const restY = r.bones.Hips.position.y;
    const hipsTrack = (name: PoseName): number => {
      const clip = createPoseClip(r, name);
      const track = clip.tracks.find((t) => t.name === 'Hips.position') as VectorKeyframeTrack;
      return track.values[1]; // first frame y
    };
    expect(hipsTrack('sit')).toBeLessThan(restY * 0.8);
    expect(hipsTrack('drive')).toBeLessThan(restY * 0.8);
    expect(hipsTrack('sleep')).toBeCloseTo(restY, 4);
    // Cycle pedals from a saddle: hips between standing and chair height.
    expect(hipsTrack('cycle')).toBeGreaterThan(hipsTrack('sit'));
    expect(hipsTrack('cycle')).toBeLessThan(restY);
  });

  it('loop clips are arm-masked overlays', () => {
    const r = rig();
    for (const name of ['strum', 'hammer', 'knead'] as const) {
      const clip = createLoopClip(r, name);
      const bones = new Set(clip.tracks.map((t) => t.name.split('.')[0]));
      expect(bones.has('LeftUpLeg')).toBe(false);
      expect(bones.has('Hips')).toBe(false);
      expect(bones.has('RightArm')).toBe(true);
    }
  });

  it('publishes the grip constants props are built to', () => {
    expect(GRIPS.seatHeight).toBeCloseTo(0.45);
    expect(GRIPS.wheel.y).toBeGreaterThan(0.5);
    expect(GRIPS.handlebar.width).toBeGreaterThan(0);
  });
});

describe('Interaction', () => {
  const setup = () => {
    const r = rig();
    const loco = new Locomotion(r);
    const interaction = new Interaction(r, loco);
    const anchor = new Object3D();
    anchor.position.set(3, 0, -2);
    anchor.rotation.y = Math.PI / 3;
    anchor.updateMatrixWorld(true);
    const slot: InteractionSlot = { anchor, pose: 'sit' };
    return { r, loco, interaction, anchor, slot };
  };

  it('tweens the root onto the anchor and takes over the gait', () => {
    const { r, loco, interaction, slot } = setup();
    interaction.use(slot, { fade: 0.3 });
    expect(interaction.busy).toBe(true);
    for (let i = 0; i < 40; i++) {
      loco.update(1 / 60, 0);
      interaction.update(1 / 60);
    }
    expect(r.object.position.x).toBeCloseTo(3, 2);
    expect(r.object.position.z).toBeCloseTo(-2, 2);
    expect(Math.abs(r.object.rotation.y - Math.PI / 3)).toBeLessThan(0.02);
    expect(interaction.poseWeight).toBeCloseTo(1, 2);
    expect(loco.influence).toBeCloseTo(0, 2);
  });

  it('release hands the body back to locomotion', () => {
    const { loco, interaction, slot } = setup();
    interaction.use(slot, { fade: 0.2 });
    for (let i = 0; i < 30; i++) {
      loco.update(1 / 60, 0);
      interaction.update(1 / 60);
    }
    interaction.release({ fade: 0.2 });
    expect(interaction.busy).toBe(false);
    for (let i = 0; i < 30; i++) {
      loco.update(1 / 60, 1.2);
      interaction.update(1 / 60);
    }
    expect(interaction.poseWeight).toBeCloseTo(0, 2);
    expect(loco.influence).toBeCloseTo(1, 2);
    expect(loco.weights.walk).toBeGreaterThan(0.1); // walking again
  });

  it('works with the rig parented inside a moved group (a room, a vehicle)', () => {
    const r = rig();
    const room = new Object3D();
    room.position.set(0, 0, -300);
    room.add(r.object);
    const anchor = new Object3D();
    anchor.position.set(2, 0, -1);
    anchor.rotation.y = 1;
    room.add(anchor);
    room.updateMatrixWorld(true);
    const loco = new Locomotion(r);
    const interaction = new Interaction(r, loco);
    interaction.use({ anchor, pose: 'sit' }, { fade: 0.1 });
    for (let i = 0; i < 30; i++) {
      loco.update(1 / 60, 0);
      interaction.update(1 / 60);
    }
    expect(interaction.poseWeight).toBeCloseTo(1, 2);
    // The rig lands on the anchor in the ROOM's space, not at world -300.
    expect(r.object.position.x).toBeCloseTo(2, 2);
    expect(r.object.position.z).toBeCloseTo(-1, 2);
    expect(Math.abs(r.object.rotation.y - 1)).toBeLessThan(0.02);
  });

  it('stays glued to a MOVING anchor (driving a car)', () => {
    const { r, loco, interaction, anchor, slot } = setup();
    interaction.use(slot, { fade: 0.1 });
    for (let i = 0; i < 20; i++) {
      loco.update(1 / 60, 0);
      interaction.update(1 / 60);
    }
    // The "car" drives off: the anchor moves after the tween completed.
    anchor.position.set(20, 0, 11);
    anchor.updateMatrixWorld(true);
    loco.update(1 / 60, 0);
    interaction.update(1 / 60);
    expect(r.object.position.x).toBeCloseTo(20, 1);
    expect(r.object.position.z).toBeCloseTo(11, 1);
  });

  it('slots can carry an arms loop (guitar on a bench)', () => {
    const { loco, interaction, slot } = setup();
    interaction.use({ ...slot, loop: 'strum' }, { fade: 0.2 });
    for (let i = 0; i < 30; i++) {
      loco.update(1 / 60, 0);
      interaction.update(1 / 60);
    }
    expect(interaction.poseWeight).toBeCloseTo(1, 2);
    interaction.setRate(1.4); // strum tempo — must not throw
  });
});
