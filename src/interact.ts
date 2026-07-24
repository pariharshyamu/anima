import { AnimationAction, AnimationClip, Object3D, Quaternion, Vector3 } from 'three';
import { buildClip, Pose } from './clips';
import type { HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';
import { maskClip } from './overlay';
import type { BoneName } from './humanoid';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const HANG = Math.PI / 2 - 0.14;

/**
 * Standardized grip geometry, in metres relative to a slot's anchor (anchor
 * at floor level, +z the direction the character faces). Props are built TO
 * these offsets — the prop conforms to the pose, so hands land on wheels and
 * handlebars with no runtime IK. The KIT_UNIT idea, applied to bodies.
 */
export const GRIPS = {
  /** Chair/bench seat surface height the sit pose expects. */
  seatHeight: 0.45,
  /** Saddle height the straddle/cycle poses expect. */
  saddleHeight: 0.8,
  /** Steering wheel centre for the drive pose (z is forward of the anchor). */
  wheel: { x: 0, y: 0.75, z: 0.45, radius: 0.19 },
  /** Handlebar centre for the cycle pose. */
  handlebar: { x: 0, y: 1.0, z: 0.38, width: 0.5 },
  /** Where a strummed guitar body sits (attach via the 'chest' area). */
  guitar: { x: 0.05, y: 0.95, z: 0.18 },
} as const;

export type PoseName = 'sit' | 'sitLow' | 'straddle' | 'sleep' | 'drive' | 'cycle' | 'operate';
export type LoopName = 'strum' | 'hammer' | 'knead' | 'chop' | 'mine' | 'saw' | 'stir';

/** Arm bones only — the mask used by interaction loop overlays. */
const ARMS: BoneName[] = [
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
];

/** Seated leg math shared by sit/drive/cycle. */
function seatedLegs(pose: Pose, thigh: number, knee: number, splay: number): void {
  for (const side of ['Left', 'Right'] as const) {
    const s = side === 'Left' ? 1 : -1;
    pose.rotate(`${side}UpLeg`, [X, -thigh], [Z, -s * splay]);
    pose.rotate(`${side}Leg`, [X, knee]);
    pose.rotate(`${side}Foot`, [X, -(knee - thigh) * 0.55]);
  }
}

/**
 * Build a named pose clip — a slow, breathing loop that holds a body
 * position: seated, lying asleep, at a wheel, pedaling. All procedural,
 * loop-seamless, deterministic.
 */
export function createPoseClip(rig: HumanoidRig, name: PoseName): AnimationClip {
  const restHipsY = rig.bones.Hips.position.y;
  const seatDrop = (fraction: number): number => restHipsY - rig.legLength * fraction;

  if (name === 'sit' || name === 'sitLow') {
    const low = name === 'sitLow';
    return buildClip(rig, name, 4.2, 30, (p, pose) => {
      const breath = Math.sin(TAU * p);
      seatedLegs(pose, low ? 1.75 : 1.52, low ? 1.9 : 1.62, 0.1);
      for (const side of ['Left', 'Right'] as const) {
        const s = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}Arm`, [X, -0.38], [Z, -s * (HANG - 0.12 - 0.02 * breath)]);
        pose.rotate(`${side}ForeArm`, [Y, -s * 0.95]);
      }
      pose.hipsY = seatDrop(low ? 0.58 : 0.48);
      pose.rotate('Spine', [X, low ? 0.16 : 0.06 + 0.012 * breath]);
      pose.rotate('Chest', [X, 0.05 + 0.02 * breath]);
      pose.rotate('Head', [Y, 0.06 * Math.sin(TAU * p + 2)], [X, -0.03]);
    });
  }

  if (name === 'straddle') {
    return buildClip(rig, name, 4.2, 30, (p, pose) => {
      const breath = Math.sin(TAU * p);
      seatedLegs(pose, 1.05, 1.15, 0.3);
      for (const side of ['Left', 'Right'] as const) {
        const s = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}Arm`, [X, -0.72], [Z, -s * (HANG - 0.4)]);
        pose.rotate(`${side}ForeArm`, [Y, -s * 0.3]);
      }
      pose.hipsY = seatDrop(0.3);
      pose.rotate('Spine', [X, 0.22 + 0.012 * breath]);
      pose.rotate('Chest', [X, 0.14 + 0.015 * breath]);
      pose.rotate('Head', [X, -0.2]);
    });
  }

  if (name === 'sleep') {
    // Lying flat: the SLOT's anchor supplies the horizontal orientation (a
    // bed pitches its anchor −90° about X); the pose just relaxes the body
    // and breathes slowly. Body extends along the anchor's local up.
    return buildClip(rig, 'sleep', 5.6, 30, (p, pose) => {
      const breath = Math.sin(TAU * p);
      for (const side of ['Left', 'Right'] as const) {
        const s = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}UpLeg`, [X, -0.12], [Z, -s * 0.05]);
        pose.rotate(`${side}Leg`, [X, 0.22]);
        pose.rotate(`${side}Arm`, [X, 0.06], [Z, -s * (HANG - 0.25)]);
        pose.rotate(`${side}ForeArm`, [Y, -s * 0.35]);
      }
      pose.hipsY = restHipsY;
      pose.rotate('Spine', [X, 0.02 * breath]);
      pose.rotate('Chest', [X, 0.05 * breath]); // the slow breath
      pose.rotate('Head', [Y, 0.12], [X, 0.08]);
    });
  }

  if (name === 'drive') {
    return buildClip(rig, 'drive', 4.6, 30, (p, pose) => {
      const sway = Math.sin(TAU * p);
      seatedLegs(pose, 1.35, 1.25, 0.08);
      for (const side of ['Left', 'Right'] as const) {
        const s = side === 'Left' ? 1 : -1;
        // Both hands forward to the standard wheel grip, gently steering.
        pose.rotate(`${side}Arm`, [X, -1.0 + s * 0.05 * sway], [Z, -s * (HANG - 0.62)]);
        pose.rotate(`${side}ForeArm`, [Y, -s * 0.38], [X, -0.15]);
      }
      pose.hipsY = seatDrop(0.46);
      pose.rotate('Spine', [X, 0.1]);
      pose.rotate('Chest', [X, 0.06], [Y, 0.03 * sway]);
      pose.rotate('Head', [X, -0.08]);
    });
  }

  if (name === 'operate') {
    // Standing at a control (a lever, a valve, a drawer): weight settled, a
    // slight forward lean of attention, forearms raised ready in front. The
    // held "attending the machine" pose; the reach gesture layers the actual
    // actuation on top.
    return buildClip(rig, 'operate', 4.0, 30, (p, pose) => {
      const breath = Math.sin(TAU * p);
      pose.rotate('Spine', [X, 0.09 + 0.01 * breath]);
      pose.rotate('Chest', [X, 0.05]);
      pose.rotate('Head', [X, -0.05], [Y, 0.05 * Math.sin(TAU * p + 1)]);
      for (const side of ['Left', 'Right'] as const) {
        const s = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}Arm`, [X, -0.5 - 0.02 * breath], [Z, -s * (HANG - 0.5)]);
        pose.rotate(`${side}ForeArm`, [Y, -s * 0.5], [X, -0.32]);
      }
    });
  }

  // cycle: one crank revolution per loop — Interaction.setRate scales cadence.
  return buildClip(rig, 'cycle', 1.0, 30, (p, pose) => {
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      const crank = TAU * p + (s === 1 ? 0 : Math.PI);
      pose.rotate(`${side}UpLeg`, [X, -1.0 - 0.42 * Math.sin(crank)], [Z, -s * 0.22]);
      pose.rotate(`${side}Leg`, [X, 0.95 + 0.5 * Math.cos(crank)]);
      pose.rotate(`${side}Foot`, [X, 0.25 * Math.sin(crank)]);
      pose.rotate(`${side}Arm`, [X, -0.85], [Z, -s * (HANG - 0.45)]);
      pose.rotate(`${side}ForeArm`, [Y, -s * 0.25]);
    }
    pose.hipsY = restHipsY - rig.legLength * 0.24 + 0.008 * Math.sin(TAU * 2 * p);
    pose.rotate('Spine', [X, 0.32]);
    pose.rotate('Chest', [X, 0.2]);
    pose.rotate('Head', [X, -0.32]);
  });
}

/**
 * Build a named interaction loop — an arms-only clip layered over a pose or
 * gait via the overlay system: strumming a guitar, hammering at an anvil,
 * kneading dough.
 */
export function createLoopClip(rig: HumanoidRig, name: LoopName): AnimationClip {
  if (name === 'strum') {
    const clip = buildClip(rig, 'strum', 1.6, 30, (p, pose) => {
      // Left hand up the neck (high, out to the left), right hand strumming
      // over the body at the standard guitar position.
      const strum = Math.sin(TAU * 4 * p) * Math.exp(-2 * ((p * 4) % 1));
      pose.rotate('LeftArm', [X, -0.5], [Z, -(HANG - 0.78)]);
      pose.rotate('LeftForeArm', [Y, -1.15], [X, -0.2]);
      pose.rotate('LeftHand', [Z, 0.3]);
      pose.rotate('RightArm', [X, -0.62], [Z, HANG - 0.55]);
      pose.rotate('RightForeArm', [Y, 0.7], [X, -0.25 - 0.14 * strum]);
      pose.rotate('RightHand', [X, -0.3 * strum]);
    });
    return maskClip(clip, ARMS);
  }
  if (name === 'hammer') {
    const clip = buildClip(rig, 'hammer', 1.15, 30, (p, pose) => {
      // Slow raise, fast strike: skew the phase so the downswing snaps.
      const skew = p < 0.62 ? p / 0.62 : 0;
      const lift = p < 0.62 ? Math.sin((Math.PI / 2) * skew) : 1 - (p - 0.62) / 0.16;
      const swing = Math.max(0, Math.min(1, lift));
      pose.rotate('RightArm', [X, -0.35 - 1.25 * swing], [Z, HANG - 0.5]);
      pose.rotate('RightForeArm', [Y, 0.35], [X, -0.4 * swing]);
      pose.rotate('LeftArm', [X, -0.55], [Z, -(HANG - 0.35)]);
      pose.rotate('LeftForeArm', [Y, -0.75]);
      pose.rotate('Chest', [X, 0.08 + 0.1 * (1 - swing)]);
    });
    return maskClip(clip, [...ARMS, 'Chest']);
  }
  if (name === 'chop') {
    // A right-handed overhead axe strike: the right hand rises ABOVE the head,
    // then drives the axe down onto the wood in front; the left hand grips the
    // haft just below it, the torso folding into the blow. Scaled up from the
    // hammer swing (which reads cleanly one-armed).
    const clip = buildClip(rig, 'chop', 1.15, 30, (p, pose) => {
      const skew = p < 0.6 ? p / 0.6 : 0;
      const lift = p < 0.6 ? Math.sin((Math.PI / 2) * skew) : 1 - (p - 0.6) / 0.2;
      const swing = Math.max(0, Math.min(1, lift)); // 1 = raised overhead, 0 = struck down
      // Raise the right arm in the FRONTAL plane (Z, like the wave): Z swings
      // from +down (at the wood) to strongly negative (straight overhead).
      pose.rotate('RightArm', [X, -0.25 - 0.15 * swing], [Z, 0.95 - 2.35 * swing]);
      pose.rotate('RightForeArm', [Y, 0.2], [X, -0.5 * swing]);
      // Left hand follows lower on the haft.
      pose.rotate('LeftArm', [X, -0.45], [Z, -(0.55 - 0.85 * swing)]);
      pose.rotate('LeftForeArm', [Y, -0.5], [X, -0.15]);
      // Fold the torso down into the strike; stand tall on the backswing.
      pose.rotate('Spine', [X, 0.42 * (1 - swing) - 0.12 * swing]);
      pose.rotate('Chest', [X, 0.24 * (1 - swing) - 0.06 * swing]);
      pose.rotate('Head', [X, 0.22 * (1 - swing) - 0.12 * swing]);
    });
    return maskClip(clip, [...ARMS, 'Spine', 'Chest', 'Head']);
  }
  if (name === 'mine') {
    // A two-handed pickaxe swing: raise in the frontal plane (Z, like the wave),
    // then drive down into the rock, the body bending with it.
    const clip = buildClip(rig, 'mine', 1.05, 30, (p, pose) => {
      const raise = p < 0.58 ? Math.sin((Math.PI / 2) * (p / 0.58)) : 1 - (p - 0.58) / 0.18;
      const swing = Math.max(0, Math.min(1, raise));
      for (const side of ['Left', 'Right'] as const) {
        const s = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}Arm`, [X, -0.35 - 0.2 * swing], [Z, -s * (0.85 - 1.5 * swing)]);
        pose.rotate(`${side}ForeArm`, [Y, -s * 0.55], [X, -0.25]);
      }
      pose.rotate('Spine', [X, 0.36 * (1 - swing) - 0.12 * swing]);
      pose.rotate('Chest', [X, 0.22 * (1 - swing) - 0.08 * swing]);
      pose.rotate('Head', [X, -0.1 + 0.16 * (1 - swing)]);
    });
    return maskClip(clip, [...ARMS, 'Spine', 'Chest', 'Head']);
  }
  if (name === 'saw') {
    // Right arm drives back and forth along the cut; the left hand steadies
    // the work, the torso rocks with the stroke.
    const clip = buildClip(rig, 'saw', 1.0, 30, (p, pose) => {
      const push = Math.sin(TAU * p);
      pose.rotate('RightArm', [X, -0.7 - 0.28 * push], [Z, HANG - 0.72]);
      pose.rotate('RightForeArm', [Y, 0.55 + 0.5 * push], [X, -0.2]);
      pose.rotate('LeftArm', [X, -0.95], [Z, -(HANG - 0.85)]);
      pose.rotate('LeftForeArm', [Y, -1.0], [X, -0.1]);
      pose.rotate('Spine', [X, 0.2 + 0.06 * push]);
      pose.rotate('Chest', [X, 0.12]);
    });
    return maskClip(clip, [...ARMS, 'Spine', 'Chest']);
  }
  if (name === 'stir') {
    // The body leans well forward over the pot and the right hand reaches DOWN
    // INTO it, circling — so the ladle dips into the pot, not hovers above it.
    const clip = buildClip(rig, 'stir', 1.3, 30, (p, pose) => {
      const c = Math.cos(TAU * p);
      const sN = Math.sin(TAU * p);
      pose.rotate('RightArm', [X, -1.35 + 0.14 * sN], [Z, HANG - 0.5 + 0.12 * c]);
      pose.rotate('RightForeArm', [Y, 1.05 + 0.3 * c], [X, -0.6 + 0.15 * sN]);
      pose.rotate('LeftArm', [X, -0.3], [Z, -(HANG - 0.25)]);
      pose.rotate('LeftForeArm', [Y, -0.5]);
      pose.rotate('Spine', [X, 0.42]); // lean over the pot
      pose.rotate('Chest', [X, 0.26]);
      pose.rotate('Head', [X, -0.55]); // look down into it
    });
    return maskClip(clip, [...ARMS, 'Spine', 'Chest', 'Head']);
  }
  const clip = buildClip(rig, 'knead', 1.4, 30, (p, pose) => {
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      const push = Math.sin(TAU * p + (s === 1 ? 0 : Math.PI));
      pose.rotate(`${side}Arm`, [X, -0.75 - 0.18 * push], [Z, -s * (HANG - 0.5)]);
      pose.rotate(`${side}ForeArm`, [Y, -s * 0.45], [X, -0.2 + 0.15 * push]);
    }
    pose.rotate('Chest', [X, 0.14 + 0.04 * Math.sin(TAU * 2 * p)]);
  });
  return maskClip(clip, [...ARMS, 'Chest']);
}

/**
 * An interaction slot — where and how a character uses a prop. SCENA props
 * publish these (structurally; no imports either way): the anchor sits at
 * floor level with +z the facing direction, pitched for lying poses.
 */
export interface InteractionSlot {
  /** Free label ('driver', 'bed', 'bench-left'…). */
  kind?: string;
  /** World-space transform target for the character's root. */
  anchor: Object3D;
  /** A PoseName — typed loosely so SCENA's string-typed slots drop in. */
  pose: PoseName | (string & {});
  /** Optional arms loop layered over the pose ('strum', 'hammer', 'knead'). */
  loop?: LoopName | (string & {});
  /**
   * Where to stand before taking the slot — SCENA's gatherings publish one
   * per seat. Its presence turns `use()` into a staged sit: arrive here,
   * turn, *then* lower. See `UseOptions.approach`.
   */
  approach?: Object3D;
}

export interface UseOptions {
  /** Blend/tween duration in seconds. Default 0.45. */
  fade?: number;
  /**
   * Stage the move through `slot.approach` instead of gliding straight
   * onto the anchor. Defaults to true whenever the slot has an approach —
   * because a body that translates into a chair without ever standing
   * beside it is the single most obvious tell in a scene full of NPCs.
   * Pass false for slots you drop into directly (a driver's seat).
   */
  approach?: boolean;
  /** Seconds spent lowering into (or rising out of) the slot. Default 0.6. */
  settle?: number;
}

/** What a staged interaction is doing right now. */
export type InteractionPhase = 'none' | 'arriving' | 'settling' | 'held' | 'leaving';

/**
 * The interaction controller: walks nothing — GAMA gets the character to
 * the prop; `use(slot)` then tweens the root onto the slot's anchor while
 * the pose crossfades over locomotion (via `Locomotion.influence`), and
 * `release()` hands the body back. One pose at a time.
 *
 * ```ts
 * const sit = { anchor: chairAnchor, pose: 'sit' } satisfies InteractionSlot;
 * interaction.use(sit);
 * game.onUpdate((t) => { loco.update(t.delta, agent.velocity); interaction.update(t.delta); });
 * ```
 */
export class Interaction {
  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private action: AnimationAction | null = null;
  private loopAction: AnimationAction | null = null;
  private slot: InteractionSlot | null = null;
  private weight = 0;
  private target = 0;
  private fade = 0.45;
  private fromPosition = new Vector3();
  private fromQuaternion = new Quaternion();
  private tween = 1; // 0..1 progress of the root tween
  private tweenRate = 1 / 0.45; // per-stage speed: arriving ≠ settling
  private stage: InteractionPhase = 'none';
  private moveTo: Object3D | null = null; // what the root is tweening toward
  private settle = 0.6;
  private readonly clipCache = new Map<string, AnimationClip>();

  constructor(rig: HumanoidRig, loco: Locomotion) {
    this.rig = rig;
    this.loco = loco;
  }

  /** Is a slot currently held (or blending in)? */
  get busy(): boolean {
    return this.slot !== null;
  }

  /** The slot in use, if any. */
  get current(): InteractionSlot | null {
    return this.slot;
  }

  /** Blend weight of the pose (0 = all gait, 1 = fully posed). */
  get poseWeight(): number {
    return this.weight;
  }

  /** Which stage of taking (or leaving) the slot the body is in. */
  get phase(): InteractionPhase {
    return this.stage;
  }

  /**
   * Adopt a slot. If it publishes an `approach`, this is staged the way a
   * person actually sits: walk to the spot beside the chair, turn to face
   * out, and only then lower — the pose fades in on that last beat, so the
   * body is standing right up until it starts going down.
   */
  use(slot: InteractionSlot, options: UseOptions = {}): void {
    this.releaseAction();
    this.slot = slot;
    this.fade = options.fade ?? 0.45;
    this.settle = options.settle ?? 0.6;
    this.fromPosition.copy(this.rig.object.position);
    this.fromQuaternion.copy(this.rig.object.quaternion);
    this.tween = 0;

    const staged = slot.approach && options.approach !== false;
    if (staged) {
      // Stand beside it first; the pose waits.
      this.stage = 'arriving';
      this.moveTo = slot.approach!;
      this.target = 0;
      this.tweenRate = 1 / Math.max(0.01, this.fade);
    } else {
      this.stage = 'settling';
      this.moveTo = slot.anchor;
      this.target = 1;
      this.tweenRate = 1 / Math.max(0.01, this.fade);
      this.startPose(slot);
    }
  }

  /** Scale the pose loop rate — pedaling cadence, strum tempo. Default 1. */
  setRate(rate: number): void {
    if (this.action) this.action.timeScale = rate;
  }

  /**
   * Let go. With an `approach` the body rises and steps clear of the seat
   * before locomotion takes over — standing up is a movement too, and
   * characters who dissolve out of chairs give the game away as surely as
   * ones who slide into them.
   */
  release(options: UseOptions = {}): void {
    this.fade = options.fade ?? 0.45;
    this.settle = options.settle ?? 0.6;
    this.target = 0;
    if (this.slot?.approach && options.approach !== false && this.stage !== 'none') {
      this.stage = 'leaving';
      this.moveTo = this.slot.approach;
      this.fromPosition.copy(this.rig.object.position);
      this.fromQuaternion.copy(this.rig.object.quaternion);
      this.tween = 0;
      this.tweenRate = 1 / Math.max(0.01, this.settle);
      this.releaseAction();
      return;
    }
    this.stage = 'none';
    this.slot = null;
    this.moveTo = null;
    this.releaseAction();
  }

  /** Advance blending. Call every frame AFTER `loco.update`. */
  update(dt: number): void {
    const step = dt / Math.max(0.01, this.fade);
    if (this.target > this.weight) this.weight = Math.min(this.target, this.weight + step);
    else this.weight = Math.max(this.target, this.weight - step);
    this.loco.influence = 1 - this.weight;

    // Track the anchor for as long as the slot is held — anchors MOVE
    // (a car's driver seat, a boat's helm), and the body must move with
    // them. The tween only shapes the approach; after it completes the
    // root stays glued to the anchor at t = 1.
    if (this.slot && this.moveTo) {
      this.tween = Math.min(1, this.tween + dt * this.tweenRate);
      const t = this.tween * this.tween * (3 - 2 * this.tween); // smoothstep
      const anchor = this.moveTo;
      anchor.updateWorldMatrix(true, false);
      const targetPosition = anchor.getWorldPosition(new Vector3());
      const targetQuaternion = anchor.getWorldQuaternion(new Quaternion());
      // The rig may be parented anywhere (a room group, a vehicle) — express
      // the anchor's world transform in the rig object's parent space.
      const parent = this.rig.object.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.worldToLocal(targetPosition);
        targetQuaternion.premultiply(parent.getWorldQuaternion(new Quaternion()).invert());
      }
      this.rig.object.position.lerpVectors(this.fromPosition, targetPosition, t);
      this.rig.object.quaternion.slerpQuaternions(this.fromQuaternion, targetQuaternion, t);
      if (this.tween >= 1) this.advance();
    }
  }

  /** Stage transitions: standing beside it → lowering → sat → stepping away. */
  private advance(): void {
    if (!this.slot) return;
    if (this.stage === 'arriving') {
      // On the spot and facing the right way. Now go down.
      this.stage = 'settling';
      this.moveTo = this.slot.anchor;
      this.target = 1;
      this.tween = 0;
      this.tweenRate = 1 / Math.max(0.01, this.settle);
      this.fromPosition.copy(this.rig.object.position);
      this.fromQuaternion.copy(this.rig.object.quaternion);
      this.startPose(this.slot);
    } else if (this.stage === 'settling') {
      this.stage = 'held';
    } else if (this.stage === 'leaving') {
      // Clear of the seat — locomotion has the body back.
      this.stage = 'none';
      this.slot = null;
      this.moveTo = null;
    }
  }

  /** Fade in the slot's pose (and its arms loop, if it has one). */
  private startPose(slot: InteractionSlot): void {
    const key = slot.pose;
    let clip = this.clipCache.get(key);
    if (!clip) {
      clip = createPoseClip(this.rig, slot.pose as PoseName);
      this.clipCache.set(key, clip);
    }
    this.action = this.loco.overlay(clip, { fadeIn: this.fade });
    if (slot.loop) {
      let loop = this.clipCache.get(`loop:${slot.loop}`);
      if (!loop) {
        loop = createLoopClip(this.rig, slot.loop as LoopName);
        this.clipCache.set(`loop:${slot.loop}`, loop);
      }
      this.loopAction = this.loco.overlay(loop, { fadeIn: this.fade + 0.2 });
    }
  }

  private releaseAction(): void {
    if (this.action) {
      this.loco.stopOverlay(this.action, this.fade);
      this.action = null;
    }
    if (this.loopAction) {
      this.loco.stopOverlay(this.loopAction, this.fade);
      this.loopAction = null;
    }
  }
}

export interface GestureOptions {
  /** Fraction of the clip at which `onApex` fires — the reach peak. Default 0.45. */
  apexAt?: number;
  /** Called once, at the apex — actuate the prop here (`() => lever.toggle()`). */
  onApex?: () => void;
  /** Overlay fade-in, seconds. Default 0.15. */
  fade?: number;
}

/**
 * A one-shot gesture — a reach, a knock, a press — layered over whatever the
 * character is doing (idle, walk, or an `operate` hold) and gone when it ends.
 * Unlike `Interaction` (which HOLDS a pose), a gesture plays once; its whole
 * point is the moment it fires `onApex`, where you actuate a manipulable so
 * the hand and the mechanism move together.
 *
 * ```ts
 * const reach = new Gesture(loco, createReachClip(rig), { onApex: () => lever.toggle() });
 * game.onUpdate((t) => { loco.update(t.delta, vel); if (!reach.done) reach.update(t.delta); });
 * ```
 */
export class Gesture {
  private readonly loco: Locomotion;
  private readonly action: AnimationAction;
  private readonly duration: number;
  private readonly apexAt: number;
  private readonly onApex?: () => void;
  private elapsed = 0;
  private fired = false;

  constructor(loco: Locomotion, clip: AnimationClip, options: GestureOptions = {}) {
    this.loco = loco;
    this.duration = clip.duration;
    this.apexAt = options.apexAt ?? 0.45;
    this.onApex = options.onApex;
    this.action = loco.overlay(clip, { loop: false, fadeIn: options.fade ?? 0.15 });
  }

  /** Advance; fires `onApex` at the peak. Returns false once finished. */
  update(dt: number): boolean {
    this.elapsed += dt;
    if (!this.fired && this.elapsed >= this.duration * this.apexAt) {
      this.fired = true;
      this.onApex?.();
    }
    if (this.elapsed >= this.duration && this.action.isRunning()) {
      this.loco.stopOverlay(this.action, 0.2);
    }
    return this.elapsed < this.duration;
  }

  /** True once the gesture has run its course. */
  get done(): boolean {
    return this.elapsed >= this.duration;
  }
}
