import { Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';
import { solveLimb } from './limbik';

/**
 * A stance, stated as WHERE THE FEET ARE.
 *
 * Every fighting module in this library ends up asking the same two questions
 * of a body — how far can it reach, and how close is it to falling over — and
 * both of them are answered by the polygon the feet make on the floor.
 * `stability()` reads that polygon directly. `strikeReach` measures from a
 * shoulder whose position depends on it. `breakEffort` is a statement about
 * its shape.
 *
 * So a stance is not a pile of joint angles here. It is two footprints and a
 * pelvis height, and the joint angles are whatever inverse kinematics needs
 * them to be to put the feet there on THIS body. Stated as angles, a stance
 * that is correct on a 1.6 m frame puts a 1.9 m one's feet somewhere else, and
 * every number downstream quietly moves with it.
 *
 * The `sink` is deliberately EXTRA crouch, on top of whatever the footprints
 * force. A body cannot stand at full height over feet that are half a metre
 * apart — the legs do not reach — so the drop needed to close the triangle is
 * computed rather than authored, and `sink` is what the fighter chooses to add
 * on top of it. That is why a wide stance is automatically a low one here
 * without anybody typing that in.
 */
export interface StanceShape {
  /** Ankle separation ACROSS the line of engagement, as a fraction of height. */
  spread: number;
  /** How far the lead ankle is ahead of the rear one, as a fraction of height. */
  stagger: number;
  /** Extra crouch beyond what the footprints already force, fraction of height. */
  sink: number;
  /** How far the hips are turned away from the opponent, radians. Blading. */
  blade: number;
}

/**
 * The stance `Striking` has always held, measured off the pose it was
 * producing from joint angles: ankles 102 mm/m of height apart across, 208
 * mm/m staggered.
 *
 * It is the default so that expressing the stance as footprints changes what
 * a stance IS without changing what the shipped one was.
 */
export const FIGHTING_STANCE: StanceShape = {
  spread: 0.1024,
  stagger: 0.2084,
  sink: 0,
  blade: 0.12,
};

/**
 * Everything a stance has to be able to put back.
 *
 * Captured once, and every application starts from it rather than from last
 * frame — so a stance can be blended, swapped mid-fight or switched off, and
 * the restore is exact rather than approximately exact after a few thousand
 * frames of quaternion multiplication.
 */
export interface StanceHold {
  hipQ: Quaternion;
  hipP: Vector3;
  legs: Quaternion[];
  /** How high the ankles sit off the floor in this body's own frame. */
  ankleY: number;
  /** The horizontal offset of each hip joint from the pelvis, own frame. */
  hipX: number;
  /** Hip-joint to ankle, straight — the chain the IK has to close. */
  legSpan: number;
}

const LEG_BONES: BoneName[] = ['LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];
const P = new Vector3();
const Q = new Vector3();
const POLE = new Vector3();
const TARGET = new Vector3();
const YAW = new Quaternion();
const UP = new Vector3(0, 1, 0);

export function holdStance(rig: HumanoidRig): StanceHold {
  rig.object.updateMatrixWorld(true);
  rig.object.worldToLocal(rig.bones.LeftFoot.getWorldPosition(P));
  rig.object.worldToLocal(rig.bones.LeftUpLeg.getWorldPosition(Q));
  return {
    hipQ: rig.bones.Hips.quaternion.clone(),
    hipP: rig.bones.Hips.position.clone(),
    legs: LEG_BONES.map((b) => rig.bones[b].quaternion.clone()),
    ankleY: P.y,
    hipX: Math.abs(Q.x),
    legSpan: rig.bones.LeftLeg.position.length() + rig.bones.LeftFoot.position.length(),
  };
}

export function releaseStance(rig: HumanoidRig, hold: StanceHold): void {
  rig.bones.Hips.quaternion.copy(hold.hipQ);
  rig.bones.Hips.position.copy(hold.hipP);
  LEG_BONES.forEach((b, i) => rig.bones[b].quaternion.copy(hold.legs[i]));
  rig.object.updateMatrixWorld(true);
}

/**
 * How far the pelvis has to come down to stand in this stance at all.
 *
 * Pythagoras on the worst leg. A body cannot stand at full height over feet
 * that are far apart, so the drop needed to close the triangle is COMPUTED,
 * and `sink` is only what the fighter chooses to add on top of it. That is why
 * a wide stance is automatically a low one here without anybody typing it in.
 */
export function stanceDrop(
  rig: HumanoidRig,
  hold: StanceHold,
  shape: StanceShape,
  lead: 'Left' | 'Right' = 'Left'
): number {
  const h = rig.height;
  const across = 0.5 * shape.spread * h;
  const along = 0.5 * shape.stagger * h;
  let worst = 0;
  for (const side of ['Left', 'Right'] as const) {
    const s = side === 'Left' ? 1 : -1;
    worst = Math.hypot(s * across - s * hold.hipX, side === lead ? along : -along) > worst
      ? Math.hypot(s * across - s * hold.hipX, side === lead ? along : -along)
      : worst;
  }
  const straight = hold.hipP.y - hold.ankleY;
  const reachable = Math.sqrt(Math.max(0, hold.legSpan * hold.legSpan - worst * worst));
  return Math.max(0, straight - reachable) + shape.sink * h;
}

/**
 * Put both feet on this stance's footprints.
 *
 * Absolute, from the pose `hold` captured, so it can be blended, swapped
 * mid-fight or switched off without accumulating. `skip` leaves one leg alone
 * — the one that is currently kicking somebody, which belongs to whoever is
 * throwing the kick.
 */
export function stanceFeet(
  rig: HumanoidRig,
  hold: StanceHold,
  shape: StanceShape,
  lead: 'Left' | 'Right' = 'Left',
  w = 1,
  skip: 'Left' | 'Right' | null = null,
  before?: (b: BoneName) => void
): void {
  if (w <= 0) return;
  const h = rig.height;
  const across = 0.5 * shape.spread * h;
  const along = 0.5 * shape.stagger * h;
  rig.object.updateMatrixWorld(true);
  for (const side of ['Left', 'Right'] as const) {
    if (side === skip) continue;
    const s = side === 'Left' ? 1 : -1;
    TARGET.set(s * across, hold.ankleY, side === lead ? along : -along);
    rig.object.localToWorld(TARGET);
    // Knees track forward over the toes, not sideways.
    POLE.set(0, 0, 1).applyQuaternion(rig.object.getWorldQuaternion(YAW));
    if (before) {
      before(`${side}UpLeg`);
      before(`${side}Leg`);
    }
    solveLimb(rig, `${side}UpLeg`, `${side}Leg`, `${side}Foot`, TARGET, POLE, w);
  }
  rig.object.updateMatrixWorld(true);
}

/**
 * The whole stance at once — pelvis, blade and both feet — for a body nobody
 * else is currently posing. `Striking` does not use this: it has its own
 * pelvis to compose with, so it takes the two halves separately.
 */
export function applyStance(
  rig: HumanoidRig,
  hold: StanceHold,
  shape: StanceShape,
  lead: 'Left' | 'Right' = 'Left',
  w = 1,
  before?: (b: BoneName) => void
): void {
  releaseStance(rig, hold);
  if (w <= 0) return;
  const leadSign = lead === 'Left' ? 1 : -1;
  const hips = rig.bones.Hips;
  hips.position.y = hold.hipP.y - stanceDrop(rig, hold, shape, lead) * w;
  // Blading is the pelvis turning away from the line of engagement. The feet
  // stay on their footprints regardless, which is the point: a bladed fighter
  // is narrower to hit without standing anywhere different.
  hips.quaternion.copy(hold.hipQ).multiply(YAW.setFromAxisAngle(UP, leadSign * shape.blade * w));
  rig.object.updateMatrixWorld(true);
  stanceFeet(rig, hold, shape, lead, w, null, before);
}
