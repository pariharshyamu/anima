import { MathUtils, Object3D, Quaternion, Vector3 } from 'three';
import type { HumanoidRig } from './humanoid';

export interface LookAtOptions {
  /** Yaw limit per full chain, radians. Default 1.15 (~66°). */
  maxYaw?: number;
  /** Pitch limit per full chain, radians. Default 0.55. */
  maxPitch?: number;
  /** Smoothing rate (1/s). Default 7. */
  smoothing?: number;
  /** Share of the turn taken by chest / neck / head. Default 0.15/0.25/0.6. */
  distribution?: [number, number, number];
  /**
   * Below this head-to-target distance (metres) the direction is too
   * noisy to trust — a target held in the character's own hand would make
   * the head snap around — so the gaze holds its current pose instead.
   * Default 0.5.
   */
  minDistance?: number;
}

/**
 * A clamped, smoothed look-at chain: the gaze target's direction is
 * distributed across Chest → Neck → Head on top of whatever the
 * animation is doing, so characters glance at things while walking.
 * Targets beyond the yaw limit are ignored (people don't owl-turn).
 *
 * Call AFTER `Locomotion.update` (and after `FootIK.update`):
 * ```ts
 * const gaze = new LookAt(rig);
 * gaze.target = player.position;                 // Vector3 or Object3D
 * game.onUpdate((t) => { loco.update(...); gaze.update(t.delta); });
 * ```
 */
export class LookAt {
  /** What to look at; null eases back to the animation's own pose. */
  target: Vector3 | Object3D | null = null;
  /** Blend weight 0..1. */
  weight = 1;

  private readonly rig: HumanoidRig;
  private readonly maxYaw: number;
  private readonly maxPitch: number;
  private readonly smoothing: number;
  private readonly distribution: [number, number, number];
  private readonly minDistance: number;
  private yaw = 0;
  private pitch = 0;

  private readonly targetWorld = new Vector3();
  private readonly headWorld = new Vector3();
  private readonly localDir = new Vector3();
  private readonly q = new Quaternion();
  private readonly qYaw = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly right = new Vector3(1, 0, 0);

  constructor(rig: HumanoidRig, options: LookAtOptions = {}) {
    this.rig = rig;
    this.maxYaw = options.maxYaw ?? 1.15;
    this.maxPitch = options.maxPitch ?? 0.55;
    this.smoothing = options.smoothing ?? 7;
    this.distribution = options.distribution ?? [0.15, 0.25, 0.6];
    this.minDistance = options.minDistance ?? 0.5;
  }

  update(dt: number): void {
    const { bones, object } = this.rig;
    let desiredYaw = 0;
    let desiredPitch = 0;

    if (this.target && this.weight > 0) {
      if ((this.target as Object3D).isObject3D) {
        (this.target as Object3D).getWorldPosition(this.targetWorld);
      } else {
        this.targetWorld.copy(this.target as Vector3);
      }
      object.updateMatrixWorld(true);
      bones.Head.getWorldPosition(this.headWorld);
      // Direction to target in the character's local frame (+Z forward).
      this.localDir.copy(this.targetWorld).sub(this.headWorld);
      object.worldToLocal(this.localDir.add(object.getWorldPosition(this.headWorld)));
      const dist = this.localDir.length();
      if (dist < this.minDistance) {
        // Target is right on top of the head (e.g. a ball held in this
        // character's own hand): the direction is dominated by noise and
        // would whip the head around. Hold the current gaze instead.
        desiredYaw = this.yaw;
        desiredPitch = this.pitch;
      } else {
        const yaw = Math.atan2(this.localDir.x, this.localDir.z);
        const flat = Math.hypot(this.localDir.x, this.localDir.z);
        const pitch = Math.atan2(this.localDir.y, flat);
        // Soft behind-the-back gate: the gaze fades out over the last ~17°
        // of range rather than snapping off, so a target crossing behind
        // the shoulder eases away instead of popping between extremes.
        const fade = MathUtils.clamp((this.maxYaw * 1.3 - Math.abs(yaw)) / (this.maxYaw * 0.3), 0, 1);
        desiredYaw = MathUtils.clamp(yaw, -this.maxYaw, this.maxYaw) * this.weight * fade;
        desiredPitch = MathUtils.clamp(pitch, -this.maxPitch, this.maxPitch) * this.weight * fade;
      }
    }

    const k = 1 - Math.exp(-this.smoothing * dt);
    this.yaw += (desiredYaw - this.yaw) * k;
    this.pitch += (desiredPitch - this.pitch) * k;

    const chain = [bones.Chest, bones.Neck, bones.Head];
    chain.forEach((bone, i) => {
      const share = this.distribution[i];
      // Yaw about +Y; pitch about +X (positive target height looks up →
      // negative X rotation). Composed onto the animated pose.
      this.qYaw.setFromAxisAngle(this.up, this.yaw * share);
      this.q.setFromAxisAngle(this.right, -this.pitch * share);
      bone.quaternion.multiply(this.qYaw).multiply(this.q);
    });
  }
}
