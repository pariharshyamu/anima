import { Quaternion, Vector3 } from 'three';
import type { HumanoidRig } from './humanoid';

/**
 * Reactions — the body showing what the numbers just did.
 *
 * GAMA's `Health` decides that a hit landed, what it cost, and when the
 * lights go out; this is the character DISPLAYING it: a directional
 * flinch, a heavier stagger, the crumple-and-kneel knockout, the get-up,
 * and the two match-end postures. Kept in the trilogy's wholesome
 * register — a knockout is a fold to the knees and a slump, not a
 * ragdoll.
 *
 * Everything here is a POST-PROCESSOR, the same discipline as foot IK:
 * run the locomotion first, then let the reactions bend the result.
 * Nothing touches the mixer, so a flinch layers over a walk, a run or a
 * held pose without negotiating with any of them:
 *
 * ```ts
 * const reactions = new Reactions(rig);
 * health.onDamage = (e) => reactions.flinch(e.from);   // GAMA event in…
 * health.onDeath  = () => reactions.knockOut();
 * health.onRevive = () => reactions.getUp();
 *
 * // per frame — ORDER MATTERS:
 * loco.update(dt);
 * reactions.update(dt);
 * ```
 *
 * Directions are WORLD-space positions or vectors (the `from` of a
 * damage event); the flinch works out for itself which way to recoil
 * given where the character is facing.
 */

export interface ReactionsOptions {
  /** Flinch strength multiplier. Default 1. */
  intensity?: number;
  /** Seconds a knockout takes to fold. Default 0.55. */
  foldTime?: number;
  /** Seconds a get-up takes. Default 0.75. */
  riseTime?: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
/** A quick in-and-out for one-shot reactions. */
const bell = (w: number): number => smooth(clamp01(w / 0.25)) * smooth(clamp01((1 - w) / 0.5));

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** The crumple: which bone folds how far at full knockout weight. */
const CRUMPLE: Array<[string, Vector3, number]> = [
  ['LeftUpLeg', X, -1.85],
  ['RightUpLeg', X, -1.75],
  ['LeftLeg', X, 2.25],
  ['RightLeg', X, 2.2],
  ['LeftFoot', X, -0.5],
  ['RightFoot', X, -0.55],
  ['Spine', X, 0.42],
  ['Chest', X, 0.38],
  ['Neck', X, 0.3],
  ['Head', X, 0.22],
  ['LeftShoulder', X, 0.2],
  ['RightShoulder', X, 0.2],
  ['LeftArm', Z, -0.5],
  ['RightArm', Z, 0.5],
  ['LeftForeArm', X, 0.25],
  ['RightForeArm', X, 0.25],
];

export class Reactions {
  private readonly rig: HumanoidRig;
  private readonly intensity: number;
  private readonly foldTime: number;
  private readonly riseTime: number;
  private readonly restHips: number;

  // One-shot envelopes: time remaining / total, plus the local recoil axis.
  private flinchLeft = 0;
  private flinchTotal = 1;
  private flinchAmp = 0;
  private readonly recoilAxis = new Vector3(1, 0, 0);
  private celebrateLeft = 0;
  private celebrateTotal = 1;
  private dejectedLeft = 0;
  private dejectedTotal = 1;

  private koWeight = 0;
  private koTarget = 0;

  private readonly scratchQ = new Quaternion();
  private readonly scratchV = new Vector3();

  // Capture-and-restore bookkeeping. The mixer only rewrites bones its
  // ACTIVE clips track — an idle gait may never touch the knees — so a
  // naive post-multiply would accumulate on untracked bones forever. Each
  // frame we record what a bone held before and after our edits; next
  // frame, a bone still holding EXACTLY our post value was not rewritten
  // by the mixer, and we put the pre value back before working again.
  private readonly touched = new Map<
    string,
    { preQ: Quaternion; postQ: Quaternion; preP: Vector3 | null; postP: Vector3 | null }
  >();

  constructor(rig: HumanoidRig, options: ReactionsOptions = {}) {
    this.rig = rig;
    this.intensity = options.intensity ?? 1;
    this.foldTime = Math.max(options.foldTime ?? 0.55, 0.05);
    this.riseTime = Math.max(options.riseTime ?? 0.75, 0.05);
    this.restHips = rig.bones.Hips.position.y;
  }

  /** Knocked out (or on the way down / up)? */
  get down(): boolean {
    return this.koTarget > 0 || this.koWeight > 0.02;
  }

  /**
   * A quick recoil away from the blow. `from` is where the hit came from
   * (world position or direction); omitted, the body flinches backward.
   * `power` scales it — feed it the damage amount.
   */
  flinch(from?: { x: number; y?: number; z: number }, power = 1): void {
    this.impulse(from, 0.32, Math.min(Math.max(power, 0.2), 2) * 0.45);
  }

  /** The heavier hit: a longer, larger recoil with a hip sway. */
  stagger(from?: { x: number; y?: number; z: number }, power = 1): void {
    this.impulse(from, 0.7, Math.min(Math.max(power, 0.2), 2) * 0.9);
  }

  /** Fold to the knees and stay there. */
  knockOut(): void {
    this.koTarget = 1;
  }

  /** Rise from the knockout. */
  getUp(): void {
    this.koTarget = 0;
  }

  /** Arms up, a little hop — the boundary-four, the finish line. */
  celebrate(duration = 1.4): void {
    if (this.down) return; // nobody celebrates from the floor
    this.celebrateTotal = Math.max(duration, 0.4);
    this.celebrateLeft = this.celebrateTotal;
  }

  /** Shoulders forward, head down — the other kind of result. */
  dejected(duration = 2): void {
    if (this.down) return;
    this.dejectedTotal = Math.max(duration, 0.5);
    this.dejectedLeft = this.dejectedTotal;
  }

  private impulse(
    from: { x: number; y?: number; z: number } | undefined,
    duration: number,
    amplitude: number
  ): void {
    if (this.down) return; // the floor has already won
    // Recoil axis: lean AWAY from the blow. The world direction of the
    // hit, brought into the character's local frame, then turned 90° —
    // rotating about that axis tips the spine away.
    const dir = this.scratchV;
    if (from) {
      dir.set(this.rig.object.position.x - from.x, 0, this.rig.object.position.z - from.z);
      if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
      dir.normalize();
      // World → local: undo the character's yaw.
      dir.applyQuaternion(this.scratchQ.copy(this.rig.object.quaternion).invert());
    } else {
      dir.set(0, 0, -1); // backward
    }
    // Axis perpendicular to the recoil direction, in the ground plane.
    this.recoilAxis.set(dir.z, 0, -dir.x).normalize();
    this.flinchTotal = duration;
    this.flinchLeft = duration;
    this.flinchAmp = amplitude * this.intensity;
  }

  /** Rotate a bone, capturing its pre-edit state once per frame. */
  private rotate(bone: string, axis: Vector3, angle: number): void {
    const b = this.rig.bones[bone as import('./humanoid').BoneName];
    this.capture(bone, false);
    b.quaternion.multiply(this.scratchQ.setFromAxisAngle(axis, angle));
  }

  /** Offset a bone's position, capturing pre-edit state once per frame. */
  private shift(bone: string, x: number, y: number, z: number): void {
    const b = this.rig.bones[bone as import('./humanoid').BoneName];
    this.capture(bone, true);
    b.position.x += x;
    b.position.y += y;
    b.position.z += z;
  }

  private capture(bone: string, withPosition: boolean): void {
    const b = this.rig.bones[bone as import('./humanoid').BoneName];
    let entry = this.touched.get(bone);
    if (!entry) {
      entry = { preQ: b.quaternion.clone(), postQ: new Quaternion(), preP: null, postP: null };
      this.touched.set(bone, entry);
    }
    if (withPosition && !entry.preP) entry.preP = b.position.clone();
  }

  /** Apply this frame's reactions. Call AFTER `loco.update(dt)`. */
  update(dt: number): void {
    const step = Number.isFinite(dt) ? Math.max(dt, 0) : 0;
    const bones = this.rig.bones;

    // Undo last frame's edits on bones the mixer did NOT rewrite.
    for (const [name, entry] of this.touched) {
      const b = bones[name as import('./humanoid').BoneName];
      if (entry.postQ && b.quaternion.equals(entry.postQ)) b.quaternion.copy(entry.preQ);
      if (entry.preP && entry.postP && b.position.equals(entry.postP)) b.position.copy(entry.preP);
    }
    this.touched.clear();

    // -- Knockout weight eases toward its target ---------------------------
    const rate = this.koTarget > this.koWeight ? step / this.foldTime : step / this.riseTime;
    this.koWeight =
      this.koTarget > this.koWeight
        ? Math.min(this.koWeight + rate, this.koTarget)
        : Math.max(this.koWeight - rate, this.koTarget);
    if (this.koWeight > 0) {
      const w = smooth(this.koWeight);
      for (const [bone, axis, angle] of CRUMPLE) this.rotate(bone, axis, angle * w);
      // The body comes down to kneeling height — the fold, not a faint.
      this.shift('Hips', 0, -(this.restHips - this.restHips * 0.42) * w, 0);
    }

    // -- The flinch / stagger impulse --------------------------------------
    if (this.flinchLeft > 0) {
      this.flinchLeft = Math.max(this.flinchLeft - step, 0);
      const w = 1 - this.flinchLeft / this.flinchTotal;
      const amp = bell(w) * this.flinchAmp;
      if (amp > 1e-4) {
        this.rotate('Spine', this.recoilAxis, amp * 0.5);
        this.rotate('Chest', this.recoilAxis, amp * 0.35);
        // The head whips a little FURTHER than the torso — that lag is
        // what makes a recoil read as involuntary.
        this.rotate('Head', this.recoilAxis, amp * 0.45);
        // Big impulses sway the hips off axis — the stagger.
        if (this.flinchAmp > 0.5) {
          this.shift('Hips', this.recoilAxis.z * amp * 0.12, 0, -this.recoilAxis.x * amp * 0.12);
        }
      }
    }

    // -- Celebrate ---------------------------------------------------------
    if (this.celebrateLeft > 0) {
      this.celebrateLeft = Math.max(this.celebrateLeft - step, 0);
      const w = 1 - this.celebrateLeft / this.celebrateTotal;
      const amp = bell(w);
      // Both arms thrown up; hanging is ±Z in this rig, so unwind past it.
      this.rotate('LeftArm', Z, amp * 2.4);
      this.rotate('RightArm', Z, -amp * 2.4);
      this.rotate('LeftForeArm', Y, -amp * 0.3);
      this.rotate('RightForeArm', Y, amp * 0.3);
      this.rotate('Head', X, -amp * 0.25);
      // The hop: up on the first half, landing on the second.
      this.shift('Hips', 0, Math.sin(Math.min(w * 2, 1) * Math.PI) * 0.05 * amp, 0);
    }

    // -- Dejected ----------------------------------------------------------
    if (this.dejectedLeft > 0) {
      this.dejectedLeft = Math.max(this.dejectedLeft - step, 0);
      const w = 1 - this.dejectedLeft / this.dejectedTotal;
      // Long hold: droop in, stay, release late.
      const amp = smooth(clamp01(w / 0.2)) * smooth(clamp01((1 - w) / 0.25));
      this.rotate('Spine', X, amp * 0.22);
      this.rotate('Chest', X, amp * 0.18);
      this.rotate('Head', X, amp * 0.38);
      this.rotate('LeftShoulder', Y, amp * 0.18);
      this.rotate('RightShoulder', Y, -amp * 0.18);
      this.shift('Hips', 0, -amp * 0.02, 0);
    }

    // Remember what we left behind, so next frame can tell whether the
    // mixer rewrote a bone or the value is still ours to take back.
    for (const [name, entry] of this.touched) {
      const b = bones[name as import('./humanoid').BoneName];
      entry.postQ.copy(b.quaternion);
      if (entry.preP) entry.postP = (entry.postP ?? new Vector3()).copy(b.position);
    }
  }
}
