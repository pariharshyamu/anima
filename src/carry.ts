import { AnimationAction, AnimationClip, Object3D, Vector3 } from 'three';
import { buildClip } from './clips';
import { maskClip } from './overlay';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const HANG = Math.PI / 2 - 0.14;

const ARMS_L: BoneName[] = ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'];
const ARMS_R: BoneName[] = ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];

/** How a character holds a thing — sets the carry pose and where it rides. */
export type CarryStyle = 'crate' | 'tray' | 'shoulder' | 'side';

/**
 * Something a character can pick up and carry — structurally what SCENA's
 * carryable props publish (`{ object, carry, grip? }`), so ANIMA carries a
 * SCENA crate or your own mesh with no imports either way. Build the object
 * so its ORIGIN is the hold point (or nudge it with `grip`); the pose brings
 * the hands to it, GRIPS-style — no runtime IK.
 */
export interface Holdable {
  /** The thing to carry. */
  object: Object3D;
  /** How to hold it. Default 'crate'. */
  carry?: CarryStyle;
  /** Fine-tune the hold point relative to the object's origin. */
  grip?: { x?: number; y?: number; z?: number };
}

/**
 * Where a carried thing rides, per style: a bone and a height-scaled offset.
 * The object is parented here (steady relative to the body — it does NOT
 * swing with hand keyframes, except `side`, which hangs from the hand and
 * should), and the carry pose puts the hands onto it.
 */
const CARRY_GRIPS: Record<CarryStyle, { bone: BoneName; pos: [number, number, number] }> = {
  crate: { bone: 'Chest', pos: [0, 0.02, 0.17] }, // both hands, at the chest
  tray: { bone: 'Chest', pos: [0, -0.05, 0.2] }, // both hands, out at the belly
  shoulder: { bone: 'Chest', pos: [0.14, 0.17, 0.0] }, // hoisted onto the shoulder
  side: { bone: 'RightHand', pos: [0, -0.06, 0] }, // hangs from the hand
};

/**
 * Build the carry pose for a style — an arms (and, for weight, chest) posture
 * masked over the gait, so the character carries WHILE walking. Same masked-
 * overlay trick as the interaction loops.
 */
export function createCarryClip(rig: HumanoidRig, style: CarryStyle): AnimationClip {
  if (style === 'tray') {
    const clip = buildClip(rig, 'carry-tray', 3.6, 30, (p, pose) => {
      const breath = Math.sin(TAU * p);
      for (const side of ['Left', 'Right'] as const) {
        const s = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}Arm`, [X, -0.5 - 0.015 * breath], [Z, -s * (HANG - 0.5)]);
        pose.rotate(`${side}ForeArm`, [Y, -s * 1.25], [X, -0.05]);
      }
      pose.rotate('Chest', [X, 0.02]);
    });
    return maskClip(clip, [...ARMS_L, ...ARMS_R, 'Chest']);
  }

  if (style === 'shoulder') {
    const clip = buildClip(rig, 'carry-shoulder', 4.0, 30, (p, pose) => {
      const breath = Math.sin(TAU * p);
      // Right hand up steadying the load; left arm swings a little, relaxed.
      pose.rotate('RightArm', [X, -1.45 - 0.02 * breath], [Z, HANG - 0.95]);
      pose.rotate('RightForeArm', [Y, 1.25], [X, -0.1]);
      pose.rotate('LeftArm', [X, -0.12], [Z, -(HANG - 0.06)]);
      pose.rotate('LeftForeArm', [Y, -0.28]);
      pose.rotate('Chest', [X, 0.03], [Y, -0.05]);
    });
    return maskClip(clip, [...ARMS_L, ...ARMS_R, 'Chest']);
  }

  if (style === 'side') {
    // One-handed: the right arm hangs holding it; the left arm keeps its gait
    // swing (mask the right arm only).
    const clip = buildClip(rig, 'carry-side', 3.4, 30, (p, pose) => {
      const breath = Math.sin(TAU * p);
      pose.rotate('RightArm', [X, 0.12 + 0.01 * breath], [Z, HANG - 0.03]);
      pose.rotate('RightForeArm', [Y, 0.16], [X, -0.06]);
    });
    return maskClip(clip, ARMS_R);
  }

  // crate (default): both arms wrapped around a box at the chest, a small
  // lean back under the weight.
  const clip = buildClip(rig, 'carry-crate', 3.6, 30, (p, pose) => {
    const breath = Math.sin(TAU * p);
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      pose.rotate(`${side}Arm`, [X, -0.95 - 0.02 * breath], [Z, -s * (HANG - 0.72)]);
      pose.rotate(`${side}ForeArm`, [Y, -s * 1.05], [X, -0.12]);
    }
    pose.rotate('Chest', [X, -0.05]);
  });
  return maskClip(clip, [...ARMS_L, ...ARMS_R, 'Chest']);
}

export interface CarryOptions {
  /** Blend duration for the carry pose, seconds. Default 0.3. */
  fade?: number;
}

export interface PutDownOptions extends CarryOptions {
  /** World position to place the object at after release. Default: leave where held. */
  at?: Vector3;
}

/**
 * The carry mechanic: pick a thing up and it rides the body (hands land on it
 * by construction), carried WHILE walking; put it down, hand it off, or let
 * GAMA throw it. Pairs with `Locomotion` — the carry pose masks over the gait.
 *
 * ```ts
 * const carry = new Carry(rig, loco);
 * carry.pickUp(crate);                 // crate rides the chest, both hands on it
 * game.onUpdate((t) => loco.update(t.delta, agent.velocity)); // walk, still holding
 * const dropped = carry.putDown({ at: table });   // set it on the table
 * carry.handTo(otherCharactersCarry);  // or pass it to a mate
 * ```
 */
export class Carry {
  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private item: Holdable | null = null;
  private action: AnimationAction | null = null;
  private anchor: Object3D | null = null;

  constructor(rig: HumanoidRig, loco: Locomotion) {
    this.rig = rig;
    this.loco = loco;
  }

  /** The thing currently held, or null. */
  get holding(): Holdable | null {
    return this.item;
  }

  /** Take the object into the hands: parent it to the carry point, pose the arms. */
  pickUp(item: Holdable, options: CarryOptions = {}): void {
    if (this.item) this.putDown();
    const style = item.carry ?? 'crate';
    const grip = CARRY_GRIPS[style];
    const h = this.rig.height;

    const anchor = new Object3D();
    anchor.name = 'carry-anchor';
    anchor.position.set(grip.pos[0] * h, grip.pos[1] * h, grip.pos[2] * h);
    this.rig.bones[grip.bone].add(anchor);
    anchor.add(item.object);
    item.object.position.set(item.grip?.x ?? 0, item.grip?.y ?? 0, item.grip?.z ?? 0);
    item.object.quaternion.identity();
    this.anchor = anchor;

    this.action = this.loco.overlay(createCarryClip(this.rig, style), { fadeIn: options.fade ?? 0.3 });
    this.item = item;
  }

  /**
   * Release the object back into the world (preserving its world transform),
   * optionally placing it `at` a spot. Returns the object — hand it to GAMA's
   * `throwObject`, or drop it on a table.
   */
  putDown(options: PutDownOptions = {}): Object3D | null {
    if (!this.item) return null;
    const object = this.item.object;
    this.worldRoot().attach(object); // reparent, keeping world pose
    if (options.at) object.position.copy(options.at);

    if (this.action) {
      this.loco.stopOverlay(this.action, options.fade ?? 0.3);
      this.action = null;
    }
    this.anchor?.removeFromParent();
    this.anchor = null;
    this.item = null;
    return object;
  }

  /** Pass the held object straight into another character's hands. */
  handTo(other: Carry, options: CarryOptions = {}): void {
    if (!this.item) return;
    const item = this.item;
    this.putDown({ fade: options.fade });
    other.pickUp(item, options);
  }

  private worldRoot(): Object3D {
    let node: Object3D = this.rig.object;
    while (node.parent) node = node.parent;
    return node;
  }
}
