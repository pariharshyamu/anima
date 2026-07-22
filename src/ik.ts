import { Quaternion, Vector3 } from 'three';
import type { HumanoidRig } from './humanoid';

const X = new Vector3(1, 0, 0);

export interface FootIKOptions {
  /**
   * Ground height lookup in WORLD space — SCENA's `terrain.heightAt`
   * drops straight in. A number means flat ground at that height.
   */
  ground: number | ((x: number, z: number) => number);
  /**
   * How much the pelvis sinks toward the lower foot's ground on slopes
   * (0 = rigid, 1 = full adaptation). Default 0.6.
   */
  hipsAdapt?: number;
  /** Blend weight: 0 disables, 1 fully plants. Default 1. */
  weight?: number;
  /**
   * Terrain deltas smaller than this are ignored (meters). Near-straight
   * legs need large knee bends to absorb even tiny height changes — a
   * 2 cm ripple would read as crouching. Default 0.025.
   */
  deadzone?: number;
}

/**
 * Terrain-planted feet: after the animation is sampled, each leg is
 * re-solved with closed-form two-bone IK so the foot lands on the actual
 * ground under it, preserving the clip's swing lift. On slopes the two
 * feet find different heights and the pelvis eases toward the lower one —
 * the difference between "walking on terrain" and "gliding over it".
 *
 * Call AFTER `Locomotion.update` each frame:
 * ```ts
 * const ik = new FootIK(rig, { ground: terrain.heightAt });
 * game.onUpdate((t) => { loco.update(t.delta, agent.velocity); ik.update(); });
 * ```
 */
export class FootIK {
  weight: number;
  private readonly rig: HumanoidRig;
  private readonly groundAt: (x: number, z: number) => number;
  private readonly hipsAdapt: number;
  private readonly upLegLen: number;
  private readonly loLegLen: number;
  private readonly deadzone: number;

  // Scratch (allocation-free updates).
  private readonly world = new Vector3();
  private readonly local = new Vector3();
  private readonly q = new Quaternion();

  constructor(rig: HumanoidRig, options: FootIKOptions) {
    this.rig = rig;
    const ground = options.ground;
    this.groundAt = typeof ground === 'number' ? () => ground : ground;
    this.hipsAdapt = options.hipsAdapt ?? 0.6;
    this.weight = options.weight ?? 1;
    this.upLegLen = Math.abs(rig.bones.LeftLeg.position.y);
    this.loLegLen = Math.abs(rig.bones.LeftFoot.position.y);
    this.deadzone = options.deadzone ?? 0.025;
  }

  update(): void {
    if (this.weight <= 0) return;
    const { object, bones } = this.rig;
    object.updateMatrixWorld(true);

    // Ground level under the character's origin — the plane the clips
    // were authored against. Terrain deltas are measured relative to it.
    const rootGround = this.groundAt(
      object.getWorldPosition(this.world).x,
      this.world.z
    );

    let lowestDelta = 0;
    const deltas: Array<{ side: 'Left' | 'Right'; delta: number }> = [];
    for (const side of ['Left', 'Right'] as const) {
      bones[`${side}Foot`].getWorldPosition(this.world);
      const raw = this.groundAt(this.world.x, this.world.z) - rootGround;
      // Deadzone: ignore ripples a straight leg would over-bend to absorb.
      const delta = Math.sign(raw) * Math.max(0, Math.abs(raw) - this.deadzone);
      deltas.push({ side, delta });
      lowestDelta = Math.min(lowestDelta, delta);
    }

    // Pelvis eases toward the lower foot so the downhill leg can reach.
    const hips = bones.Hips;
    hips.position.y += lowestDelta * this.hipsAdapt * this.weight;
    hips.updateMatrixWorld(true);

    for (const { side, delta } of deltas) {
      this.solveLeg(side, delta * this.weight);
    }
  }

  /**
   * Re-aim one leg so the ankle lands `delta` higher/lower than the clip
   * placed it, in the sagittal plane (the gait's own plane of motion).
   */
  private solveLeg(side: 'Left' | 'Right', delta: number): void {
    const { object, bones } = this.rig;
    const upLeg = bones[`${side}UpLeg`];
    const foot = bones[`${side}Foot`];

    // Current ankle position in character space.
    foot.getWorldPosition(this.world);
    this.local.copy(this.world);
    object.worldToLocal(this.local);
    const hipWorld = upLeg.getWorldPosition(this.world);
    const hip = object.worldToLocal(hipWorld.clone());

    // Target: same sagittal position, terrain-adjusted height.
    const ty = this.local.y + delta;
    const tz = this.local.z - hip.z;
    const l1 = this.upLegLen;
    const l2 = this.loLegLen;
    const dy = ty - hip.y;
    let d = Math.hypot(dy, tz);
    d = Math.min(d, (l1 + l2) * 0.9999);
    d = Math.max(d, Math.abs(l1 - l2) * 1.0001);

    // Closed-form two-link solve in the plane; hinge is local X.
    const pitch = Math.atan2(tz, -dy);
    const gamma = Math.acos(
      Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    );
    const knee =
      Math.PI -
      Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));

    // Preserve the clip's non-sagittal components by only replacing the
    // X-rotation part: our gait legs are pure-X, so overwrite is exact.
    upLeg.quaternion.copy(this.q.setFromAxisAngle(X, -(pitch + gamma)));
    bones[`${side}Leg`].quaternion.copy(this.q.setFromAxisAngle(X, knee));
    // Keep the sole tracking the slope-adjusted chain, like the clips do.
    bones[`${side}Foot`].quaternion.copy(
      this.q.setFromAxisAngle(X, 0.7 * (pitch + gamma - knee))
    );
    upLeg.updateMatrixWorld(true);
  }
}
