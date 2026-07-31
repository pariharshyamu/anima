import { Object3D, Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

const Z = new Vector3(0, 0, 1);

/** Two-link IK: put the end of a `l1`+`l2` chain at `to`, elbow toward `pole`. */
export function solveChain(
  from: Vector3,
  to: Vector3,
  restDir: Vector3,
  l1: number,
  l2: number,
  pole: Vector3
): { root: Quaternion; joint: Quaternion } {
  const delta = to.clone().sub(from);
  const reach = Math.min(
    (l1 + l2) * 0.999,
    Math.max(Math.abs(l1 - l2) * 1.001, delta.length())
  );
  const dir = delta.clone().normalize();
  // Normal of the plane the chain bends in. `pole` decides which way the
  // elbow or knee points; without it the solve is a cone of valid answers
  // and the joint wanders.
  const n = dir.clone().cross(pole);
  if (n.lengthSq() < 1e-8) n.copy(Z);
  n.normalize();

  const cosGamma = (l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach);
  const cosBend = (l1 * l1 + l2 * l2 - reach * reach) / (2 * l1 * l2);
  const gamma = Math.acos(Math.min(1, Math.max(-1, cosGamma)));
  const bend = Math.PI - Math.acos(Math.min(1, Math.max(-1, cosBend)));

  const upper = dir.clone().applyAxisAngle(n, gamma);
  const root = new Quaternion().setFromUnitVectors(restDir, upper);
  const localN = n.clone().applyQuaternion(root.clone().invert());
  const joint = new Quaternion().setFromAxisAngle(localN, -bend);
  return { root, joint };
}


/**
 * A bone's quaternion is relative to its PARENT; a solve works in the rig's
 * own space. Skip this conversion and the limb inherits its parents' rotation
 * a second time — measured, when the climb was missing it, as a foot sliding
 * 2.5 mm a frame ALONG the rung it was supposed to be standing on.
 */
export function toParentFrame(rig: HumanoidRig, bone: BoneName, rigSpace: Quaternion): Quaternion {
  const parent: Object3D | null = rig.bones[bone].parent;
  if (!parent) return rigSpace;
  const rigQ = rig.object.getWorldQuaternion(new Quaternion()).invert();
  const parentQ = parent.getWorldQuaternion(new Quaternion()).premultiply(rigQ).invert();
  return parentQ.multiply(rigSpace);
}

/** Rest direction of a limb chain in the rig's T-pose: arms out, legs down. */
export function restDirection(side: 'Left' | 'Right', arm: boolean): Vector3 {
  return arm ? new Vector3(side === 'Left' ? 1 : -1, 0, 0) : new Vector3(0, -1, 0);
}

/** Segment lengths of a limb chain, from the rig's own bone offsets. */
export function chainLengths(
  rig: HumanoidRig,
  side: 'Left' | 'Right',
  arm: boolean
): [number, number] {
  return arm
    ? [rig.bones[`${side}ForeArm`].position.length(), rig.bones[`${side}Hand`].position.length()]
    : [rig.bones[`${side}Leg`].position.length(), rig.bones[`${side}Foot`].position.length()];
}
