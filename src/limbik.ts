import { Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

/**
 * Two-link inverse kinematics, and the bone-aiming primitive under it.
 *
 * This lived inside `grappling.ts`, which is the second place it lived and one
 * short of the third. It is the same solve every time — put the end of a limb
 * on a point, decide which way the middle joint bends — and the interesting
 * part is a detail that is easy to get wrong and invisible when you do:
 *
 *   THE RIG'S LIMBS DO NOT SHARE AN AXIS. Arms run along ±X out of the
 *   shoulder and legs along −Y out of the hip, so the rest direction is READ
 *   OFF the bone offsets rather than assumed. Assuming it is how you get an
 *   arm that works and a leg that folds inside out.
 *
 * `before` is the hook a caller uses to remember a bone's original rotation
 * before this overwrites it. A module that takes a bone outright cannot hand
 * it back later without a copy, and "it will be re-posed next frame anyway" is
 * true right up until the frame the module is switched off.
 */

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => clamp(v, 0, 1);

const QA = new Quaternion();
const QB = new Quaternion();
const V1 = new Vector3();
const V2 = new Vector3();
const V3 = new Vector3();
const V4 = new Vector3();
const V5 = new Vector3();
const V6 = new Vector3();

/** Rotate one bone so its own rest axis points along a world direction. */
export function pointBone(
  rig: HumanoidRig,
  bone: BoneName,
  axis: Vector3,
  worldDir: Vector3,
  w: number,
  before?: (b: BoneName) => void
): void {
  const b = rig.bones[bone];
  before?.(bone);
  const parent = b.parent;
  QA.identity();
  if (parent) parent.getWorldQuaternion(QA);
  QA.invert();
  V5.copy(worldDir).applyQuaternion(QA).normalize();
  QB.setFromUnitVectors(axis, V5);
  b.quaternion.slerp(QB, clamp01(w));
}

/**
 * Put the tip of a limb on a point, with the middle joint bending toward
 * `pole`.
 */
export function solveLimb(
  rig: HumanoidRig,
  root: BoneName,
  mid: BoneName,
  tip: BoneName,
  target: Vector3,
  pole: Vector3,
  w: number,
  before?: (b: BoneName) => void
): void {
  const upper = rig.bones[mid].position.length();
  const lower = rig.bones[tip].position.length();
  const axis = V1.copy(rig.bones[mid].position).normalize();
  rig.bones[root].getWorldPosition(V2);
  const to = V3.subVectors(target, V2);
  const span = clamp(to.length(), Math.abs(upper - lower) + 1e-4, upper + lower - 1e-4);
  to.normalize();
  // Law of cosines for the angle between the upper segment and the straight
  // line to the target.
  const cosA = clamp((upper * upper + span * span - lower * lower) / (2 * upper * span), -1, 1);
  const a = Math.acos(cosA);
  const perp = V4.copy(pole).addScaledVector(to, -pole.dot(to));
  if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0).addScaledVector(to, -to.y * -1);
  perp.normalize();
  const upperDir = V6.copy(to).multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a));
  pointBone(rig, root, axis, upperDir, w, before);
  // The middle joint is computed rather than read: a bone's matrixWorld is a
  // frame stale until the whole hierarchy is updated, and aiming the forearm
  // from last frame's elbow is how a limb ends up chasing itself.
  V2.addScaledVector(upperDir, upper);
  const lowerDir = V5.subVectors(target, V2).normalize();
  pointBone(rig, mid, axis, lowerDir, w, before);
}

/** Rotate a bone about a WORLD axis, on top of whatever it is already doing. */
export function turnAbout(bone: { parent: unknown; quaternion: Quaternion }, worldAxis: Vector3, angle: number): void {
  const parent = bone.parent as { getWorldQuaternion(q: Quaternion): Quaternion } | null;
  QA.identity();
  if (parent && typeof parent.getWorldQuaternion === 'function') parent.getWorldQuaternion(QA);
  QA.invert();
  V5.copy(worldAxis).applyQuaternion(QA).normalize();
  QB.setFromAxisAngle(V5, angle);
  bone.quaternion.premultiply(QB);
}
