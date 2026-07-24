import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { createHumanoid, Interaction, Locomotion, type InteractionSlot } from '../src';

/** A chair at (2, 0, 0) facing +x, with somewhere to stand beside it. */
function chair(): InteractionSlot {
  const anchor = new Object3D();
  anchor.position.set(2, 0, 0);
  anchor.rotation.y = Math.PI / 2;
  const approach = new Object3D();
  approach.position.set(2, 0, -0.75);
  approach.rotation.y = Math.PI / 2;
  return { kind: 'seat', anchor, pose: 'sit', approach };
}

function setup() {
  const rig = createHumanoid({ seed: 4 });
  const loco = new Locomotion(rig);
  const interaction = new Interaction(rig, loco);
  return { rig, loco, interaction };
}

const step = (interaction: Interaction, seconds: number, dt = 1 / 60) => {
  for (let i = 0; i < seconds / dt; i++) interaction.update(dt);
};

describe('staged sitting', () => {
  it('walks to the approach point BEFORE the pose starts', () => {
    const { rig, interaction } = setup();
    const slot = chair();
    interaction.use(slot);
    expect(interaction.phase).toBe('arriving');

    step(interaction, 0.42); // just before the arrival stage completes
    // Standing beside the chair, still on its feet.
    expect(interaction.phase).toBe('arriving');
    expect(rig.object.position.distanceTo(new Vector3(2, 0, -0.75))).toBeLessThan(0.05);
    expect(interaction.poseWeight).toBeLessThan(0.05);
  });

  it('then lowers onto the seat, and only then is the pose fully on', () => {
    const { rig, interaction } = setup();
    interaction.use(chair());
    step(interaction, 0.6);
    expect(interaction.phase).toBe('settling');
    step(interaction, 1.5);
    expect(interaction.phase).toBe('held');
    expect(rig.object.position.distanceTo(new Vector3(2, 0, 0))).toBeLessThan(0.02);
    expect(interaction.poseWeight).toBeCloseTo(1, 2);
  });

  it('the body is standing for the whole approach — no gliding into chairs', () => {
    const { rig, interaction } = setup();
    interaction.use(chair());
    // Sample the whole approach: while away from the seat, the pose is off.
    for (let i = 0; i < 0.45 / (1 / 60); i++) {
      interaction.update(1 / 60);
      if (rig.object.position.distanceTo(new Vector3(2, 0, 0)) > 0.4) {
        expect(interaction.poseWeight).toBeLessThan(0.06);
      }
    }
  });

  it('faces the seat direction while still standing beside it', () => {
    const { rig, interaction } = setup();
    interaction.use(chair());
    step(interaction, 0.5);
    const facing = new Vector3(0, 0, 1).applyQuaternion(rig.object.quaternion);
    expect(facing.x).toBeCloseTo(1, 1); // turned to face +x, as the seat does
  });

  it('standing up steps clear of the seat before locomotion resumes', () => {
    const { rig, loco, interaction } = setup();
    const slot = chair();
    interaction.use(slot);
    step(interaction, 2.5);
    expect(interaction.phase).toBe('held');

    interaction.release();
    expect(interaction.phase).toBe('leaving');
    step(interaction, 1.5);
    expect(interaction.phase).toBe('none');
    // Out of the chair, standing where they came in, gait back in charge.
    expect(rig.object.position.distanceTo(new Vector3(2, 0, -0.75))).toBeLessThan(0.05);
    expect(interaction.poseWeight).toBeLessThan(0.02);
    expect(loco.influence).toBeCloseTo(1, 2);
    expect(interaction.current).toBeNull();
  });

  it('slots with no approach behave exactly as before (drop straight in)', () => {
    const { rig, interaction } = setup();
    const anchor = new Object3D();
    anchor.position.set(0, 0.8, 3);
    interaction.use({ anchor, pose: 'drive' });
    expect(interaction.phase).toBe('settling');
    step(interaction, 1.0);
    expect(interaction.phase).toBe('held');
    expect(rig.object.position.distanceTo(new Vector3(0, 0.8, 3))).toBeLessThan(0.02);
    expect(interaction.poseWeight).toBeCloseTo(1, 2);
  });

  it('approach: false opts out of the staging', () => {
    const { interaction } = setup();
    interaction.use(chair(), { approach: false });
    expect(interaction.phase).toBe('settling');
    step(interaction, 1.0);
    expect(interaction.phase).toBe('held');
  });

  it('release({ approach: false }) lets go immediately', () => {
    const { interaction } = setup();
    interaction.use(chair());
    step(interaction, 2.5);
    interaction.release({ approach: false });
    expect(interaction.phase).toBe('none');
    expect(interaction.current).toBeNull();
  });

  it('a held seat still tracks a moving anchor (benches on boats)', () => {
    const { rig, interaction } = setup();
    const slot = chair();
    const deck = new Object3D();
    deck.add(slot.anchor);
    deck.add(slot.approach!);
    interaction.use(slot);
    step(interaction, 2.5);
    expect(interaction.phase).toBe('held');
    deck.position.set(0, 0, 5); // the boat moves
    step(interaction, 0.2);
    expect(rig.object.position.distanceTo(new Vector3(2, 0, 5))).toBeLessThan(0.02);
  });
});
