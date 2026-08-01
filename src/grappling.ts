import { Object3D, Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';
import { bodyMass, centreOfMass, stability } from './striking';

/**
 * Grappling — where a throw is a CONSEQUENCE of the balance, not a cutscene.
 *
 * Judo names the three things a throw is made of, and the first one is the
 * whole argument for building this the way it is built:
 *
 *   KUZUSHI   break the balance
 *   TSUKURI   fit in underneath it
 *   KAKE      finish
 *
 * And *kuzushi* has an exact definition that this library was already
 * measuring for another reason: put their centre of mass outside their base of
 * support. `stability()` in `striking.ts` is the margin from one to the other,
 * in foot lengths, computed from Dempster's segment masses. Positive is
 * standing. Negative is going over and has not noticed yet.
 *
 * So a throw here is not an animation that plays when a button is pressed.
 * It is an attempt that COMPLETES only if the uke's stability actually went
 * negative first — and if the tori could not reach the grips, or pulled in a
 * direction the uke's stance is wide in, it does not, and the tori is left
 * committed and out of position. That is what happens to people who try to
 * throw somebody who is not off balance, and nothing here had to encode it.
 *
 * The landing is derived too. A body whose centre of mass falls `h` arrives at
 * `sqrt(2gh)`, and its momentum is that times a mass this library already
 * knows how to compute. A breakfall does not make the fall smaller; it spreads
 * the arrival over an arm and a longer time, which is a different number and a
 * measurable one.
 */

const Y = new Vector3(0, 1, 0);
const GRAVITY = 9.81;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => clamp(v, 0, 1);
const ease = (t: number): number => {
  const s = clamp01(t);
  return s * s * (3 - 2 * s);
};

// ------------------------------------------------------- the eight corners

/**
 * *Happo no kuzushi* — the eight directions a balance can be broken in.
 *
 * Not a design decision. It is the compass, and judo has taught it as eight
 * points since Kano: four square and four corners.
 *
 * Which of the eight is CHEAPEST is deliberately not stated here, because it
 * is not a property of the compass — it is a property of the feet, and it is
 * measured. `breakEffort` tips a body in a direction until `stability()`
 * crosses zero and reports the angle it took. Move the feet and the answer
 * moves with them.
 */
export type KuzushiDirection =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'frontLeft'
  | 'frontRight'
  | 'backLeft'
  | 'backRight';

const R2 = Math.SQRT1_2;

/** Each direction as a unit vector in the UKE's own frame. */
export const KUZUSHI: Record<KuzushiDirection, [number, number]> = {
  front: [0, 1],
  back: [0, -1],
  left: [1, 0],
  right: [-1, 0],
  frontLeft: [R2, R2],
  frontRight: [-R2, R2],
  backLeft: [R2, -R2],
  backRight: [-R2, -R2],
};

export const KUZUSHI_DIRECTIONS = Object.keys(KUZUSHI) as KuzushiDirection[];

// ------------------------------------------------------------- the throws

export type ThrowName =
  | 'osotoGari'
  | 'oGoshi'
  | 'seoiNage'
  | 'uchiMata'
  | 'haraiGoshi'
  | 'taiOtoshi'
  | 'footSweep'
  | 'doubleLeg';

/** What the uke rotates about on the way down. */
export type Fulcrum = 'hip' | 'shoulder' | 'leg' | 'ground';

export interface ThrowSpec {
  label: string;
  /** Which way the balance has to go before this throw is available. */
  breaks: KuzushiDirection;
  /** What the uke turns over. A hip throw is a lever; a sweep is not. */
  fulcrum: Fulcrum;
  /** Seconds, at tempo 1. The three phases, named the way judo names them. */
  kuzushi: number;
  tsukuri: number;
  kake: number;
  /** How far the uke is turned over by the end, radians. */
  rotation: number;
  /**
   * How high the uke's centre of mass is lifted before it comes down, as a
   * fraction of their height. A hip throw picks somebody up; a foot sweep
   * takes their leg and lets the floor do the rest, which is why it costs
   * almost nothing and lands them almost as hard.
   */
  lift: number;
  /** Whether the tori has to get their own hips below the uke's. */
  loads: boolean;
}

/**
 * Eight throws, across the four families a body can be taken down by.
 *
 * `breaks` is the only tactical number and it is the one thing that is really
 * true of each: an *osoto gari* needs them going backwards over the reaped
 * leg, a *seoi nage* needs them coming forward onto their toes. Everything
 * else here is timing and geometry, and whether the throw lands is decided by
 * `stability()` rather than by any of it.
 */
export const THROWS: Record<ThrowName, ThrowSpec> = {
  osotoGari: {
    label: 'Osoto gari',
    // Major outer reap: they go back over the leg you have taken away.
    breaks: 'backRight',
    fulcrum: 'leg',
    kuzushi: 0.34,
    tsukuri: 0.22,
    kake: 0.36,
    rotation: 1.9,
    lift: 0.04,
    loads: false,
  },
  oGoshi: {
    label: 'O goshi',
    // Major hip throw: they come forward, you turn in, your hip is the lever.
    breaks: 'front',
    fulcrum: 'hip',
    kuzushi: 0.32,
    tsukuri: 0.3,
    kake: 0.34,
    rotation: 2.5,
    lift: 0.14,
    loads: true,
  },
  seoiNage: {
    label: 'Seoi nage',
    // Shoulder throw: lower than a hip throw and further under them.
    breaks: 'frontRight',
    fulcrum: 'shoulder',
    kuzushi: 0.3,
    tsukuri: 0.3,
    kake: 0.32,
    rotation: 2.7,
    lift: 0.17,
    loads: true,
  },
  uchiMata: {
    label: 'Uchi mata',
    // Inner thigh reap. The lift comes from a leg rather than the hips.
    breaks: 'frontLeft',
    fulcrum: 'hip',
    kuzushi: 0.34,
    tsukuri: 0.28,
    kake: 0.38,
    rotation: 2.6,
    lift: 0.15,
    loads: true,
  },
  haraiGoshi: {
    label: 'Harai goshi',
    breaks: 'frontRight',
    fulcrum: 'hip',
    kuzushi: 0.32,
    tsukuri: 0.28,
    kake: 0.36,
    rotation: 2.4,
    lift: 0.13,
    loads: true,
  },
  taiOtoshi: {
    label: 'Tai otoshi',
    // Body drop. No lift at all — a blocked leg and their own momentum.
    breaks: 'frontRight',
    fulcrum: 'leg',
    kuzushi: 0.3,
    tsukuri: 0.26,
    kake: 0.3,
    rotation: 2.1,
    lift: 0.03,
    loads: false,
  },
  footSweep: {
    label: 'De ashi barai',
    // The cheapest throw there is: take the loaded foot at the moment it
    // takes weight. The floor does the rest.
    breaks: 'left',
    fulcrum: 'ground',
    kuzushi: 0.22,
    tsukuri: 0.12,
    kake: 0.26,
    rotation: 1.6,
    lift: 0.01,
    loads: false,
  },
  doubleLeg: {
    label: 'Double leg',
    // Wrestling rather than judo: take the base away rather than the balance.
    breaks: 'back',
    fulcrum: 'ground',
    kuzushi: 0.26,
    tsukuri: 0.24,
    kake: 0.34,
    rotation: 1.7,
    lift: 0.06,
    loads: false,
  },
};

export const THROW_NAMES = Object.keys(THROWS) as ThrowName[];

// ---------------------------------------------------------------- the grip

/**
 * Where a jacket is held: the sleeve at the elbow and the lapel at the collar.
 *
 * Read off the rig, so it lands on the cloth of whatever body it is handed
 * rather than on a coordinate that was right for one of them. Contact here is
 * gated the same way `climb` gates a hand on a rung — because it is the same
 * question, and a throw executed from grips that are 200 mm off the jacket is
 * two people miming at each other.
 */
export interface GripPair {
  sleeve: Vector3;
  lapel: Vector3;
}

export function gripPoints(
  rig: HumanoidRig,
  sleeve: 'Left' | 'Right',
  lapel: 'Left' | 'Right',
  out: GripPair = { sleeve: new Vector3(), lapel: new Vector3() }
): GripPair {
  rig.object.updateMatrixWorld(true);
  // The sleeve is held a third of the way from the elbow to the hand, which is
  // where the cloth is loose enough to hold and still steer the arm.
  rig.bones[`${sleeve}ForeArm`].getWorldPosition(out.sleeve);
  rig.bones[`${sleeve}Hand`].getWorldPosition(G1);
  out.sleeve.lerp(G1, 0.35);
  rig.bones.Chest.getWorldPosition(out.lapel);
  rig.bones.Neck.getWorldPosition(G1);
  out.lapel.lerp(G1, 0.6);
  // The lapel is on one side of the collar, not in the middle of the throat.
  G2.set(lapel === 'Left' ? 1 : -1, 0, 0).applyQuaternion(rig.object.getWorldQuaternion(SPIN));
  out.lapel.addScaledVector(G2, 0.055 * rig.height);
  return out;
}

const SPIN = new Quaternion();
const G1 = new Vector3();
const G2 = new Vector3();

/**
 * How close a hand has to be to the cloth for the grip to count, metres.
 *
 * The same question `climb` asks of a hand on a rung, and it is asked here for
 * the same reason: a throw executed from grips 200 mm off the jacket is two
 * people miming at each other, and it is invisible from inside the animation.
 */
export const GRIP_TOLERANCE = 0.06;

// ------------------------------------------------------------ the landing

export interface Landing {
  throwName: ThrowName;
  /** How far the uke's centre of mass fell, metres. */
  height: number;
  /** `sqrt(2gh)` — what it was doing when it arrived, m/s. */
  speed: number;
  /** `mass x speed`, kg·m/s. The number a damage system takes. */
  impulse: number;
  /** A trained arm, placed early. `ukemi` AND `armFirst`, and only then. */
  breakfall: boolean;
  /** ...and whether it got there BEFORE the body did, which is the whole point. */
  armFirst: boolean;
  /**
   * What actually went into the torso. A breakfall does not make the fall
   * smaller — nothing does — it spreads the arrival over an arm and a longer
   * contact, and this is what is left.
   */
  toTorso: number;
}

/**
 * What a fall arrives with.
 *
 * Nothing here is chosen. A centre of mass that falls `h` is doing `sqrt(2gh)`
 * when it lands, and its momentum is that times a mass `bodyMass` already
 * derives from the body's own height and build. A hip throw lifts somebody
 * before dropping them and therefore lands them harder than a foot sweep,
 * which is true, and neither number was typed in.
 */
export function landingImpulse(rig: HumanoidRig, height: number): number {
  return bodyMass(rig) * Math.sqrt(2 * GRAVITY * Math.max(0, height));
}

/**
 * How much of a landing an arm takes away.
 *
 * A breakfall works two ways and both are real: the arm and the flat of the
 * back arrive first and over a larger area, and the slap extends the contact
 * so the same momentum arrives over more time. Together they take most of it
 * off the part that matters, which is why judo teaches it before it teaches a
 * single throw.
 */
export const UKEMI_RELIEF = 0.62;

// -------------------------------------------------------------- the phases

export type GrapplePhase = 'apart' | 'grip' | 'kuzushi' | 'tsukuri' | 'kake' | 'ukemi' | 'done';

export interface ThrowEvent {
  throwName: ThrowName;
  /** Did it actually go over? */
  completed: boolean;
  /** The uke's stability when the kuzushi phase ended. Negative is broken. */
  balance: number;
  /** Why it failed, when it did. */
  failed: 'none' | 'noGrip' | 'notBroken';
  /** Worst grip separation during the attempt, metres. */
  gripGap: number;
}

export interface GrapplingOptions {
  /** Playback rate. */
  tempo?: number;
  /** Seconds to blend in and out. */
  fade?: number;
  /**
   * 0..1. How hard the tori pulls in the break direction, and therefore how
   * far the uke's centre of mass actually goes. It is not a success chance:
   * the pull moves a real centre of mass and `stability()` decides.
   */
  skill?: number;
  /** Whether the uke knows how to fall. Decides `armFirst`, not the impulse. */
  ukemi?: boolean;
}


// ------------------------------------------------------------ the plumbing

const FIXED_STEP = 1 / 120;
const MAX_SUBSTEPS = 8;

const PQ = new Quaternion();
const PB = new Quaternion();
const QA = new Quaternion();
const QB = new Quaternion();
const S1 = new Vector3();
const S2 = new Vector3();
const S3 = new Vector3();
const S4 = new Vector3();
const S5 = new Vector3();
const LEAN_AXIS = new Vector3();
const COM = new Vector3();

/** Rotate a bone about a WORLD axis, on top of whatever it is already doing. */
function turnAbout(bone: Object3D, worldAxis: Vector3, angle: number): void {
  const parent = bone.parent;
  PQ.identity();
  if (parent) parent.getWorldQuaternion(PQ);
  PQ.invert();
  S5.copy(worldAxis).applyQuaternion(PQ).normalize();
  PB.setFromAxisAngle(S5, angle);
  bone.quaternion.premultiply(PB);
}

/**
 * The axis a body tips about when its top goes toward `dir`.
 *
 * `Y × dir`, and the order matters: the other way round the body leans AWAY
 * from the break, which reads as a plausible animation and makes every throw
 * in the module land the wrong way round.
 */
function tipAxis(dir: Vector3, out: Vector3): Vector3 {
  return out.crossVectors(Y, dir).normalize();
}

/** Rotate one bone so its own rest axis points along a world direction. */
function point(
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
  S5.copy(worldDir).applyQuaternion(QA).normalize();
  QB.setFromUnitVectors(axis, S5);
  b.quaternion.slerp(QB, clamp01(w));
}

/**
 * Two-link IK: put the tip of a limb on a point, with the middle joint bending
 * toward `pole`. The same solve `Striking` uses, over whichever rig is handed
 * in — there are two of them here and neither owns it.
 */
function solveLimb(
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
  const axis = S1.copy(rig.bones[mid].position).normalize();
  rig.bones[root].getWorldPosition(S2);
  const to = S3.subVectors(target, S2);
  const span = clamp(to.length(), Math.abs(upper - lower) + 1e-4, upper + lower - 1e-4);
  to.normalize();
  const cosA = clamp((upper * upper + span * span - lower * lower) / (2 * upper * span), -1, 1);
  const a = Math.acos(cosA);
  const perp = S4.copy(pole).addScaledVector(to, -pole.dot(to));
  if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0).addScaledVector(to, -to.y * -1);
  perp.normalize();
  const upperDir = PQ2.copy(to).multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a));
  point(rig, root, axis, upperDir, w, before);
  // The middle joint is computed rather than read: a bone's matrixWorld is a
  // frame stale until the whole hierarchy is updated, and aiming the forearm
  // from last frame's elbow is how a limb ends up chasing itself.
  S2.addScaledVector(upperDir, upper);
  const lowerDir = PQ3.subVectors(target, S2).normalize();
  point(rig, mid, axis, lowerDir, w, before);
}

const PQ2 = new Vector3();
const PQ3 = new Vector3();

// ---------------------------------------------------------- breaking a base

/**
 * The most a tori can tip somebody, in radians, at skill 1.
 *
 * The one authored number in the module, and it is authored because nothing in
 * the rig knows how strong anybody's arms are. Everything the pull DOES from
 * here is measured: the tip moves a real centre of mass over a real base, the
 * mass fractions are Dempster's, and whether it left the base is `stability()`.
 *
 * For scale — a body only has to come about 11° over its toes, or 4° over its
 * heels, before it is going down. This is not a large number and it should not
 * be. Kuzushi is small.
 */
export const MAX_LEAN = 0.4;

/** How much extra the spine folds on top of the tip. Look, not mechanism. */
const SPINE_FOLLOW = 0.55;
/** How that fold is divided between the two spine joints. A hip hinge leads. */
const SPINE_SHARE = 0.55;

const LEG_BONES: BoneName[] = ['LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];

/**
 * Everything a lean has to be able to put back.
 *
 * The lean is applied ABSOLUTELY from this, every frame, rather than
 * accumulated — so the servo can go up and down, and the restore is exact
 * rather than approximately exact after a few hundred frames of quaternion
 * multiplication.
 */
interface LeanState {
  hipQ: Quaternion;
  hipP: Vector3;
  spineQ: Quaternion;
  chestQ: Quaternion;
  legs: Quaternion[];
  footL: Vector3;
  footR: Vector3;
  pivot: Vector3;
  com: Vector3;
}

function captureLean(rig: HumanoidRig): LeanState {
  rig.object.updateMatrixWorld(true);
  const footL = rig.bones.LeftFoot.getWorldPosition(new Vector3());
  const footR = rig.bones.RightFoot.getWorldPosition(new Vector3());
  return {
    hipQ: rig.bones.Hips.quaternion.clone(),
    hipP: rig.bones.Hips.position.clone(),
    spineQ: rig.bones.Spine.quaternion.clone(),
    chestQ: rig.bones.Chest.quaternion.clone(),
    legs: LEG_BONES.map((b) => rig.bones[b].quaternion.clone()),
    footL,
    footR,
    // The ankle line is what a standing body tips about. Not the pelvis: pivot
    // there and the feet swing out from under the body, which is a different
    // thing entirely and does not move the centre of mass off the base at all.
    pivot: footL.clone().lerp(footR, 0.5),
    com: centreOfMass(rig, new Vector3()),
  };
}

function releaseLean(rig: HumanoidRig, s: LeanState): void {
  rig.bones.Hips.quaternion.copy(s.hipQ);
  rig.bones.Hips.position.copy(s.hipP);
  rig.bones.Spine.quaternion.copy(s.spineQ);
  rig.bones.Chest.quaternion.copy(s.chestQ);
  LEG_BONES.forEach((b, i) => rig.bones[b].quaternion.copy(s.legs[i]));
  rig.object.updateMatrixWorld(true);
}

/**
 * Tip a standing body toward `dir` by `angle`, WITH ITS FEET WHERE THEY ARE.
 *
 * This is the whole of kuzushi and it is three steps, none of which is
 * optional:
 *
 *   1. rotate the pelvis, which takes the whole body with it;
 *   2. translate the pelvis back so the ankle line has not moved — otherwise
 *      the base of support travels with the body and by definition nothing can
 *      ever be broken;
 *   3. put both feet back on the exact footprints they started on, which the
 *      legs pay for by bending.
 *
 * Bending only the spine — which is what this was first — moves 68% of the
 * mass through a short lever and gets 93 mm out of a full fold. A body has to
 * come 191 mm forward over its toes. It could not break anybody in any
 * direction except straight backwards, and it took the probe below to say so.
 */
function applyLean(rig: HumanoidRig, s: LeanState, axis: Vector3, angle: number): void {
  const b = rig.bones;
  releaseLean(rig, s);
  turnAbout(b.Hips, axis, angle);
  rig.object.updateMatrixWorld(true);

  b.LeftFoot.getWorldPosition(S1);
  b.RightFoot.getWorldPosition(S2);
  S1.lerp(S2, 0.5);
  const drift = S3.subVectors(s.pivot, S1);
  const parent = b.Hips.parent;
  PQ.identity();
  if (parent) parent.getWorldQuaternion(PQ);
  b.Hips.position.add(drift.applyQuaternion(PQ.invert()));
  rig.object.updateMatrixWorld(true);

  for (const side of ['Left', 'Right'] as const) {
    S4.set(0, 0, 1).applyQuaternion(rig.object.getWorldQuaternion(QA));
    solveLimb(
      rig,
      `${side}UpLeg`,
      `${side}Leg`,
      `${side}Foot`,
      side === 'Left' ? s.footL : s.footR,
      S4,
      1
    );
  }
  turnAbout(b.Spine, axis, angle * SPINE_FOLLOW * SPINE_SHARE);
  turnAbout(b.Chest, axis, angle * SPINE_FOLLOW * (1 - SPINE_SHARE));
  rig.object.updateMatrixWorld(true);
}

export interface BreakEffort {
  direction: KuzushiDirection;
  /** Tip in radians before the balance actually goes. `Infinity` if it never does. */
  lean: number;
  /** How far the centre of mass had to travel to get there, metres. */
  travel: number;
  /** The margin this body started with, in foot lengths. */
  before: number;
  /** The margin at the end of the probe. */
  after: number;
}

/**
 * How hard this body is to break in one direction — measured, not modelled.
 *
 * Tip the body a little further each step and watch `stability()` come down.
 * The answer is the tip at which it crosses zero, and how far the centre of
 * mass had travelled by then. It uses the SAME lean the throw uses and the
 * same stability the throw is decided by, so there is no second model here to
 * drift out of agreement with the first one.
 *
 * The bones are put back exactly as they were found.
 */
export function breakEffort(
  rig: HumanoidRig,
  direction: KuzushiDirection,
  maxLean = MAX_LEAN,
  steps = 120
): BreakEffort {
  rig.object.updateMatrixWorld(true);
  const before = stability(rig);
  const state = captureLean(rig);
  const [dx, dz] = KUZUSHI[direction];
  const dir = new Vector3(dx, 0, dz)
    .applyQuaternion(rig.object.getWorldQuaternion(new Quaternion()))
    .normalize();
  const axis = tipAxis(dir, new Vector3());

  let lean = Infinity;
  let travel = 0;
  let after = before;
  for (let i = 1; i <= steps; i++) {
    const angle = (maxLean * i) / steps;
    applyLean(rig, state, axis, angle);
    after = stability(rig);
    centreOfMass(rig, COM);
    travel = COM.clone().sub(state.com).dot(dir);
    if (after < 0) {
      lean = angle;
      break;
    }
  }
  releaseLean(rig, state);
  return { direction, lean, travel, before, after };
}

/**
 * Which way this stance is weakest — the answer judo gets by looking at the
 * feet, arrived at here by trying all eight and keeping the cheapest.
 *
 * It is stance-dependent and it should be. Stand square and the weak line runs
 * back over the heels, because a heel is 75 mm behind an ankle and a toe is
 * 190 mm in front of it. Widen the feet and the sideways cost goes up with
 * them. Nothing about that is written down; it is read off the feet.
 */
export function weakestDirection(rig: HumanoidRig): BreakEffort {
  let best: BreakEffort | null = null;
  for (const d of KUZUSHI_DIRECTIONS) {
    const e = breakEffort(rig, d);
    if (!best || e.lean < best.lean || (e.lean === best.lean && e.travel < best.travel)) best = e;
  }
  return best as BreakEffort;
}

// ------------------------------------------------------------- the machine

/** How long the uke spends arriving, in seconds. */
const UKEMI_TIME = 0.55;
/** Seconds spent taking the grips before anything else can happen. */
const GRIP_TIME = 0.16;
/** The arm has to be down by this fraction of the turn for it to be a breakfall. */
const SLAP_LEAD = 0.45;

/**
 * Two bodies, one throw.
 *
 * Ownership is the difficult part of anything with two rigs in it, and the
 * rule here is the same one `Mount` uses: whoever is being moved gives up the
 * bones that are being moved, and gets them back afterwards.
 *
 *   the TORI's arms          taken outright — they are holding a jacket
 *   the TORI's legs          taken while loading, so the hips can drop
 *                            without the feet going through the floor
 *   the TORI's spine/hips    added to, so a `Mood` layer survives the throw
 *   the UKE's pelvis + legs  taken outright from the moment the pull starts.
 *                            Somebody being tipped off their feet is not
 *                            choosing where their pelvis goes
 *   the UKE, from `kake` on  taken entirely, object transform included. Once
 *                            you are in the air you are not deciding anything,
 *                            and a `Locomotion` still trying to walk during a
 *                            throw is two systems arguing over one pelvis
 */
export class Grappling {
  phase: GrapplePhase = 'apart';
  /** The throw being attempted, or null. */
  current: ThrowName | null = null;
  /** Is the uke's balance broken? Measured every frame, not decided once. */
  broken = false;
  /** The uke's margin, in foot lengths. Negative is over. */
  ukeBalance = 1;
  /** The tori's own. You do not get to fall over throwing somebody. */
  toriBalance = 1;
  /** The worst the tori's own balance got during this attempt. */
  toriWorst = Infinity;
  /** Worst separation between a hand and the cloth it is holding, metres. */
  gripGap = 0;
  /** How far the uke's centre of mass has been dragged in the break direction. */
  travel = 0;
  /** How far the tori actually tipped them, radians. */
  lean = 0;
  /** The last landing this pair produced, if any. */
  lastLanding: Landing | null = null;
  done = false;

  private readonly tori: HumanoidRig;
  private readonly uke: HumanoidRig;
  private readonly tempo: number;
  private readonly fadeRate: number;
  private readonly skill: number;
  private readonly ukemi: boolean;

  private weight = 0;
  private wanted = 0;
  private clock = 0;
  private restored = true;
  private residue = 0;
  private completed = false;
  private published = false;
  private landed = false;

  private readonly toriGave = new Map<BoneName, Quaternion>();
  private readonly toriEntry = new Map<BoneName, Quaternion>();
  private readonly ukeEntry = new Map<BoneName, Quaternion>();
  private ukeLean: LeanState | null = null;
  private readonly ukeHome = new Vector3();
  private ukeHeld = false;
  private readonly ukeRot = new Quaternion();

  private readonly throwCbs = new Set<(e: ThrowEvent) => void>();
  private readonly landCbs = new Set<(l: Landing) => void>();

  private readonly breakDir = new Vector3();
  private readonly fulcrumAt = new Vector3();
  private groundY = 0;
  private lowestCom = Infinity;
  private highestCom = 0;
  private armDown = -1;
  private torsoDown = -1;

  private readonly grip: GripPair = { sleeve: new Vector3(), lapel: new Vector3() };
  private readonly footHome: Record<'Left' | 'Right', Vector3> = {
    Left: new Vector3(),
    Right: new Vector3(),
  };
  private feetHeld = false;
  private readonly hipHome = new Vector3();
  private hipHeld = false;
  private hipGave = 0;
  private readonly toriHome = new Vector3();
  private toriHeld = false;
  private readonly chestHome = new Vector3();
  private readonly step = new Vector3();
  private readonly held: GripPair = { sleeve: new Vector3(), lapel: new Vector3() };

  private readonly qa = new Quaternion();
  private readonly qb = new Quaternion();
  private readonly va = new Vector3();
  private readonly vb = new Vector3();
  private readonly vc = new Vector3();
  private readonly vd = new Vector3();
  private readonly pole = new Vector3();
  /**
   * Remember a bone before overwriting it, so it can be handed back exactly.
   * Lazy, because these run before the constructor body has assigned the rigs.
   */
  private readonly holdTori = (b: BoneName): void => {
    if (!this.toriEntry.has(b)) this.toriEntry.set(b, this.tori.bones[b].quaternion.clone());
  };
  private readonly holdUke = (b: BoneName): void => {
    if (!this.ukeEntry.has(b)) this.ukeEntry.set(b, this.uke.bones[b].quaternion.clone());
  };

  constructor(tori: HumanoidRig, uke: HumanoidRig, options: GrapplingOptions = {}) {
    this.tori = tori;
    this.uke = uke;
    this.tempo = Math.max(0.05, options.tempo ?? 1);
    const fade = options.fade ?? 0.1;
    this.fadeRate = fade > 0 ? 1 / fade : Infinity;
    this.skill = clamp01(options.skill ?? 0.8);
    this.ukemi = options.ukemi ?? true;
  }

  onThrow(fn: (e: ThrowEvent) => void): () => void {
    this.throwCbs.add(fn);
    return () => this.throwCbs.delete(fn);
  }

  onLand(fn: (l: Landing) => void): () => void {
    this.landCbs.add(fn);
    return () => this.landCbs.delete(fn);
  }

  /**
   * Try a throw.
   *
   * It is an ATTEMPT. Whether it completes is decided at the end of the
   * kuzushi phase by whether the uke's centre of mass actually left their base
   * of support, which depends on how hard the tori pulled, which way, and how
   * the uke happened to be standing.
   */
  attempt(name: ThrowName): void {
    this.current = name;
    this.clock = 0;
    this.phase = 'grip';
    this.wanted = 1;
    this.done = false;
    this.completed = false;
    this.published = false;
    this.landed = false;
    this.broken = false;
    this.gripGap = 0;
    this.travel = 0;
    this.lean = 0;
    this.lowestCom = Infinity;
    this.highestCom = 0;
    this.armDown = -1;
    this.torsoDown = -1;
    this.toriWorst = Infinity;
    this.step.set(0, 0, 0);
    this.restored = false;
    this.uke.object.updateMatrixWorld(true);
    this.uke.bones.LeftFoot.getWorldPosition(this.va);
    this.uke.bones.RightFoot.getWorldPosition(this.vb);
    // The floor is where this body's feet already are, not y = 0. A throw on a
    // terraced street is still a throw.
    this.groundY = Math.min(this.va.y, this.vb.y) - 0.04 * this.uke.height;
  }

  /** Let go and hand both bodies back. */
  release(): void {
    this.wanted = 0;
    this.current = null;
  }

  /**
   * A genuinely fixed internal step, and the word genuinely is doing work.
   *
   * The obvious version — `steps = ceil(dt / FIXED_STEP); step = dt / steps` —
   * CAPS the step but does not floor it, so at 240 fps it silently runs at
   * 1/240 and at 30 fps at 1/120. That is not a fixed step, it is a step that
   * happens to be small, and it cost five of the eight throws up to 17% of
   * their landing impulse between 30 and 240 fps. The leftover is carried, so
   * every body in every session integrates on exactly the same lattice.
   */
  update(dt: number): void {
    this.residue += Math.max(0, dt) * this.tempo;
    let n = 0;
    while (this.residue >= FIXED_STEP && n < MAX_SUBSTEPS) {
      this.advance(FIXED_STEP);
      this.residue -= FIXED_STEP;
      n++;
    }
  }

  private advance(step: number): void {
    this.tori.object.updateMatrixWorld(true);
    this.uke.object.updateMatrixWorld(true);
    this.toriBalance = stability(this.tori);
    this.ukeBalance = stability(this.uke);
    if (this.current && this.toriBalance < this.toriWorst) this.toriWorst = this.toriBalance;

    const target = this.wanted;
    if (this.weight !== target) {
      const d = Math.sign(target - this.weight) * this.fadeRate * step;
      this.weight = Math.abs(target - this.weight) <= Math.abs(d) ? target : this.weight + d;
    }

    if (!this.current) {
      if (this.weight <= 0 && !this.restored) {
        this.restore();
        this.restored = true;
        this.done = true;
        this.phase = 'apart';
      }
      return;
    }

    const spec = THROWS[this.current];
    this.clock += step;
    const t0 = GRIP_TIME;
    const t1 = t0 + spec.kuzushi;
    const t2 = t1 + spec.tsukuri;
    const t3 = t2 + spec.kake;
    const t4 = t3 + UKEMI_TIME;

    if (this.clock < t0) this.phase = 'grip';
    else if (this.clock < t1) this.phase = 'kuzushi';
    else if (this.clock < t2) this.phase = 'tsukuri';
    else if (this.clock < t3) this.phase = this.completed ? 'kake' : 'tsukuri';
    else if (this.clock < t4) this.phase = this.completed ? 'ukemi' : 'done';
    else this.phase = 'done';

    this.direction(spec);
    this.follow(spec);
    this.gripUp(spec, clamp01(this.clock / t0));

    if (this.phase === 'kuzushi') {
      // The PULL is a servo, not a solve. The tori tips the uke's mass in the
      // break direction and the loop watches `stability()` come down; nothing
      // computes in advance how far it has to go, because that depends on how
      // this particular body happens to be standing.
      const want = ease((this.clock - t0) / Math.max(1e-4, spec.kuzushi));
      this.pull(want * MAX_LEAN * this.skill);
    } else if (this.clock >= t1 && !this.published) {
      this.decide(spec);
    }

    if (this.clock >= t1 && this.clock < t3) {
      this.fit(spec, clamp01((this.clock - t1) / spec.tsukuri));
    }

    if (this.completed && this.clock >= t2) {
      const over = clamp01((this.clock - t2) / Math.max(1e-4, spec.kake));
      this.turn(spec, over);
      this.trackFall(over);
      if (over >= 1 && !this.landed) this.land();
    }
    if (this.clock >= t4) this.release();
  }

  // ------------------------------------------------------------ the pieces

  /** The break direction, in world space, from the uke's own frame. */
  private direction(spec: ThrowSpec): void {
    const [x, z] = KUZUSHI[spec.breaks];
    this.breakDir
      .set(x, 0, z)
      .applyQuaternion(this.uke.object.getWorldQuaternion(this.qa))
      .normalize();
  }

  /**
   * Both of the tori's hands onto the uke's jacket, and the gap measured.
   *
   * The grip points are re-read every frame off the uke's CURRENT pose, so the
   * hands follow them down through the throw rather than holding a coordinate
   * that was right when the attempt started. The gap is recorded only while the
   * grip is doing the work — through the break and the entry — because after
   * that the uke is on their way to the floor, and a tori who does not follow
   * them all the way down is a posture problem, not a grip problem.
   */
  private gripUp(spec: ThrowSpec, t: number): void {
    const w = this.weight * ease(t);
    if (w <= 0) return;
    this.offer(w);
    // Standard judo grip: left hand on their right sleeve, right hand on their
    // left lapel. Mirror it and the arms cross, which is a different throw.
    gripPoints(this.uke, 'Right', 'Left', this.grip);
    this.pole.set(0, -1, 0).addScaledVector(this.breakDir, -0.35).normalize();
    solveLimb(
      this.tori,
      'LeftArm',
      'LeftForeArm',
      'LeftHand',
      this.grip.sleeve,
      this.pole,
      w,
      this.holdTori
    );
    solveLimb(
      this.tori,
      'RightArm',
      'RightForeArm',
      'RightHand',
      this.grip.lapel,
      this.pole,
      w,
      this.holdTori
    );
    // Recorded only once the grip should be CLOSED. Before that the hands are
    // still travelling, and a hand halfway to a lapel is not a failed grip —
    // measuring it as one made every throw in the module report `noGrip`.
    if (this.clock < GRIP_TIME || this.clock > GRIP_TIME + spec.kuzushi + spec.tsukuri) return;
    this.tori.object.updateMatrixWorld(true);
    this.tori.bones.LeftHand.getWorldPosition(this.va);
    this.tori.bones.RightHand.getWorldPosition(this.vb);
    const gap = Math.max(this.va.distanceTo(this.grip.sleeve), this.vb.distanceTo(this.grip.lapel));
    if (gap > this.gripGap) this.gripGap = gap;
  }

  /**
   * The tori goes WITH them.
   *
   * A backward break tips the uke away from the tori, and a tori who stands
   * still loses the lapel by 370 mm doing it — which is why an *osoto gari*
   * reported `noGrip` on every body it was tried on, and was right to. Judo's
   * word for the entry is *tsukuri*, and it is a step, not a lean.
   *
   * So the tori's whole body tracks the uke's centre of mass along the break
   * direction. Their feet come with them, which is the point, and their own
   * `stability()` is unaffected because it is measured in their own frame.
   */
  private follow(spec: ThrowSpec): void {
    const obj = this.tori.object;
    if (!this.toriHeld) {
      this.toriHome.copy(obj.position);
      this.toriHeld = true;
    }
    // Where the grip was when it closed. Re-read until then, because the tori
    // has not taken hold yet and there is nothing to follow.
    // Follow the GRIP itself, not the centre of mass and not even the chest.
    // A collar is 400 mm above a centre of mass, so a body tipping backwards
    // takes its lapel 1.4 times as far — and a tori tracking the lighter
    // number lost it at exactly the pulls that were hard enough to work.
    gripPoints(this.uke, 'Right', 'Left', this.held);
    if (this.clock < GRIP_TIME) {
      this.chestHome.copy(this.held.lapel);
    } else if (this.clock <= GRIP_TIME + spec.kuzushi + spec.tsukuri) {
      // Horizontal only: the entry is a step, not a levitation.
      this.step.subVectors(this.held.lapel, this.chestHome);
      this.step.y = 0;
    }
    obj.position.copy(this.toriHome).addScaledVector(this.step, this.weight);
    obj.updateMatrixWorld(true);
  }

  /**
   * The uke's gripped arm comes to the grip too.
   *
   * A sleeve grip MOVES an arm; it does not wait for one to be offered. With
   * the rig's arms hanging at its sides the sleeve sits 380 mm out to the side
   * and 400 mm forward, which is 554 mm from a shoulder that can reach 492 —
   * so every throw in the module reported `noGrip` and every one of them was
   * right to.
   *
   * The LAPEL is left where it is, and that is deliberate: a collar is on
   * somebody's chest and cannot come to you. It is what makes range a real
   * constraint here rather than a decorative one.
   */
  private offer(w: number): void {
    const rig = this.uke;
    rig.object.updateMatrixWorld(true);
    rig.object.getWorldQuaternion(this.qa);
    rig.bones.Chest.getWorldPosition(this.va);
    this.vd.set(0, 0, 1).applyQuaternion(this.qa);
    this.va.addScaledVector(this.vd, 0.28 * rig.height);
    this.vc.set(-1, 0, 0).applyQuaternion(this.qa);
    this.va.addScaledVector(this.vc, 0.11 * rig.height);
    this.pole.copy(this.vc).addScaledVector(Y, -0.8).normalize();
    solveLimb(rig, 'RightArm', 'RightForeArm', 'RightHand', this.va, this.pole, w, this.holdUke);
    rig.object.updateMatrixWorld(true);
  }

  /** Tip the uke in the break direction and read what it did to their balance. */
  private pull(angle: number): void {
    const w = this.weight;
    if (w <= 0) return;
    if (!this.ukeLean) this.ukeLean = captureLean(this.uke);
    this.lean = angle * w;
    tipAxis(this.breakDir, LEAN_AXIS);
    applyLean(this.uke, this.ukeLean, LEAN_AXIS, this.lean);
    centreOfMass(this.uke, COM);
    this.travel = this.va.subVectors(COM, this.ukeLean.com).dot(this.breakDir);
    this.ukeBalance = stability(this.uke);
  }

  /**
   * Did it work?
   *
   * Two questions, both answered by measurements taken for other reasons: were
   * the hands on the cloth, and is the centre of mass outside the feet.
   * Nothing rolls anything.
   *
   * A failed attempt is not a no-op. The tori has spent the entry and is stood
   * there holding somebody still on their feet, which is why the phases keep
   * running afterwards and the arms stay committed to the end of them.
   */
  private decide(spec: ThrowSpec): void {
    this.published = true;
    const gripped = this.gripGap <= GRIP_TOLERANCE;
    this.broken = this.ukeBalance < 0;
    this.completed = gripped && this.broken;
    const e: ThrowEvent = {
      throwName: this.current as ThrowName,
      completed: this.completed,
      balance: this.ukeBalance,
      failed: !gripped ? 'noGrip' : !this.broken ? 'notBroken' : 'none',
      gripGap: this.gripGap,
    };
    void spec;
    for (const cb of this.throwCbs) cb(e);
  }

  /**
   * TSUKURI — the tori fits in underneath.
   *
   * A hip throw has to get the tori's hips below the uke's, and that is a
   * squat with the feet planted, not a shorter character. So the pelvis drops
   * and both legs are IK'd back to the footprints they started on. Dropping
   * `Hips.position` on its own drove both feet through the floor.
   */
  private fit(spec: ThrowSpec, t: number): void {
    const w = this.weight * ease(t);
    if (w <= 0) return;
    const rig = this.tori;
    if (!this.feetHeld) {
      rig.object.updateMatrixWorld(true);
      // In the tori's OWN frame. Held in world space they would stay behind
      // when `follow` steps the body in, and the legs would stretch after them.
      rig.object.worldToLocal(rig.bones.LeftFoot.getWorldPosition(this.footHome.Left));
      rig.object.worldToLocal(rig.bones.RightFoot.getWorldPosition(this.footHome.Right));
      this.feetHeld = true;
    }
    // Turn in. A loading throw turns much further, because the tori's back has
    // to end up against the uke's front.
    const turn = (spec.loads ? 0.95 : 0.3) * w;
    this.additive('Hips', Y, turn * 0.5);
    this.additive('Spine', Y, turn * 0.3);
    this.additive('Chest', Y, turn * 0.2);

    const drop = (spec.loads ? 0.1 : 0.025) * rig.height * w;
    const hips = rig.bones.Hips;
    if (!this.hipHeld) {
      this.hipHome.copy(hips.position);
      this.hipHeld = true;
    }
    hips.position.y += -drop - this.hipGave;
    this.hipGave = -drop;
    rig.object.updateMatrixWorld(true);
    for (const side of ['Left', 'Right'] as const) {
      this.pole.set(0, 0, 1).applyQuaternion(rig.object.getWorldQuaternion(this.qa));
      rig.object.localToWorld(this.vb.copy(this.footHome[side]));
      solveLimb(rig, `${side}UpLeg`, `${side}Leg`, `${side}Foot`, this.vb, this.pole, w, this.holdTori);
    }
  }

  /**
   * KAKE — the uke goes over.
   *
   * A rigid rotation of the whole body about the fulcrum the throw names, and
   * then the floor. `lift` raises the centre of mass over the arc, which is
   * the difference between a hip throw and a foot sweep and the reason the two
   * do not land the same.
   */
  private turn(spec: ThrowSpec, over: number): void {
    const uke = this.uke.object;
    if (!this.ukeHeld) {
      this.ukeHome.copy(uke.position);
      this.ukeRot.copy(uke.quaternion);
      this.ukeHeld = true;
    }
    this.fulcrum(spec, this.fulcrumAt);
    const angle = spec.rotation * ease(over);
    tipAxis(this.breakDir, LEAN_AXIS);
    this.qa.setFromAxisAngle(LEAN_AXIS, angle);
    uke.position.copy(this.ukeHome).sub(this.fulcrumAt).applyQuaternion(this.qa).add(this.fulcrumAt);
    uke.quaternion.copy(this.ukeRot).premultiply(this.qa);
    uke.position.y += spec.lift * this.uke.height * Math.sin(Math.PI * over);
    uke.updateMatrixWorld(true);

    // The settle. A rigid rotation about somebody's hip leaves the uke lying
    // horizontally at hip height with nothing underneath them; a rotation about
    // their own feet puts their head through the floor. Neither is a landing.
    // So the body is drawn onto the ground over the arc, and arrives on it.
    uke.position.y += (this.groundY - this.lowestBone(SETTLE_BONES)) * ease(over);
    uke.updateMatrixWorld(true);
    // And then the floor, which is the one thing in a throw that is not
    // negotiable. Without this the peak height is a measurement of how far the
    // arc went underground, and a tai otoshi reported a two-metre fall.
    const low = this.lowestBone(SETTLE_BONES);
    if (low < this.groundY) {
      uke.position.y += this.groundY - low;
      uke.updateMatrixWorld(true);
    }
  }

  /** The lowest thing the uke has that the floor could stop. */
  private lowestBone(bones: BoneName[]): number {
    let lowest = Infinity;
    for (const b of bones) {
      this.uke.bones[b].getWorldPosition(this.va);
      if (this.va.y < lowest) lowest = this.va.y;
    }
    return lowest;
  }

  /** Where the uke pivots. A hip throw is a lever; a sweep is not. */
  private fulcrum(spec: ThrowSpec, out: Vector3): Vector3 {
    switch (spec.fulcrum) {
      case 'hip':
        return this.tori.bones.Hips.getWorldPosition(out);
      case 'shoulder':
        return this.tori.bones.Chest.getWorldPosition(out);
      case 'leg':
        // The reaped leg — the uke's own, at the knee.
        this.uke.bones.LeftLeg.getWorldPosition(out);
        this.uke.bones.RightLeg.getWorldPosition(this.vd);
        return out.lerp(this.vd, 0.5);
      default: {
        // Nothing lifts them. They rotate about the floor between their feet.
        this.uke.bones.LeftFoot.getWorldPosition(out);
        this.uke.bones.RightFoot.getWorldPosition(this.vd);
        out.lerp(this.vd, 0.5);
        out.y = this.groundY;
        return out;
      }
    }
  }

  /**
   * Watch the fall.
   *
   * The height is not declared anywhere. It is the highest the uke's centre of
   * mass got, against where it ended up, sampled on the way past at a fixed
   * step so the number is the same at 30 fps and at 240.
   */
  private trackFall(over: number): void {
    if (this.ukemi) this.slap(over);
    this.uke.object.updateMatrixWorld(true);
    centreOfMass(this.uke, this.va);
    if (this.va.y > this.highestCom) this.highestCom = this.va.y;
    if (this.va.y < this.lowestCom) this.lowestCom = this.va.y;

    const h = this.uke.height;
    const near = this.groundY + 0.18 * h;
    // An arm is DOWN when it is low AND out. A hand that merely ends up near
    // the floor because its owner is lying on it is not a breakfall, and
    // testing height alone credited one to everybody who had `ukemi` switched
    // off — which made the whole option read as though it did nothing.
    this.uke.bones.Hips.getWorldPosition(this.vd);
    let out = false;
    for (const hand of ['LeftHand', 'RightHand'] as const) {
      this.uke.bones[hand].getWorldPosition(this.vb);
      if (this.vb.y > near) continue;
      if (Math.hypot(this.vb.x - this.vd.x, this.vb.z - this.vd.z) >= 0.24 * h) out = true;
    }
    this.uke.bones.Chest.getWorldPosition(this.vb);
    if (this.armDown < 0 && out) this.armDown = this.clock;
    if (this.torsoDown < 0 && this.vb.y <= near) this.torsoDown = this.clock;
  }

  /**
   * UKEMI — the arm gets there first, or it is not a breakfall.
   *
   * It leads the torso by design, and then the ordering is MEASURED rather
   * than assumed: `trackFall` records when each of them actually arrived, and
   * `armFirst` is a comparison of two timestamps. If the arm is late the
   * relief does not apply, which is exactly what happens to people.
   */
  private slap(over: number): void {
    const rig = this.uke;
    const w = this.weight * clamp01(over / SLAP_LEAD);
    if (w <= 0) return;
    rig.object.updateMatrixWorld(true);
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      rig.bones.Hips.getWorldPosition(this.va);
      this.vd.set(s, 0, 0).applyQuaternion(rig.object.getWorldQuaternion(this.qa));
      this.va.addScaledVector(this.vd, 0.4 * rig.height);
      this.va.y = this.groundY + 0.02 * rig.height;
      this.pole.copy(this.vd).addScaledVector(Y, -0.4).normalize();
      solveLimb(
        rig,
        `${side}Arm`,
        `${side}ForeArm`,
        `${side}Hand`,
        this.va,
        this.pole,
        w,
        this.holdUke
      );
    }
  }

  /** What the landing arrived with. */
  private land(): void {
    this.landed = true;
    this.uke.object.updateMatrixWorld(true);
    centreOfMass(this.uke, this.va);
    const height = Math.max(0, this.highestCom - this.va.y);
    const impulse = landingImpulse(this.uke, height);
    const armFirst = this.armDown >= 0 && (this.torsoDown < 0 || this.armDown < this.torsoDown);
    // The relief is for a BREAKFALL, which is a trained arm placed early — not
    // for an arm that happened to swing out and hit the mat first because its
    // owner was rotating. Untrained, that arm is how people break wrists, and
    // crediting it was worth 62% off four of the eight throws for nothing.
    const breakfall = this.ukemi && armFirst;
    const landing: Landing = {
      throwName: this.current as ThrowName,
      height,
      speed: Math.sqrt(2 * GRAVITY * height),
      impulse,
      breakfall,
      armFirst,
      toTorso: impulse * (breakfall ? 1 - UKEMI_RELIEF : 1),
    };
    this.lastLanding = landing;
    for (const cb of this.landCbs) cb(landing);
  }

  // -------------------------------------------------------------- the bones

  /**
   * A bone the tori only ADDS to — the pelvis, spine and chest belong to
   * whatever put them in their stance, so last frame's contribution is handed
   * back before this frame's goes on.
   */
  private additive(bone: BoneName, axis: Vector3, angle: number): void {
    const b = this.tori.bones[bone];
    const had = this.toriGave.get(bone);
    if (had) b.quaternion.multiply(had.invert());
    this.qb.setFromAxisAngle(axis, angle);
    b.quaternion.multiply(this.qb);
    this.toriGave.set(bone, this.qb.clone());
  }

  /** Hand both bodies back exactly as they were found. */
  private restore(): void {
    for (const [name, q] of this.toriGave) this.tori.bones[name].quaternion.multiply(q.invert());
    this.toriGave.clear();
    for (const [name, q] of this.toriEntry) this.tori.bones[name].quaternion.copy(q);
    this.toriEntry.clear();
    for (const [name, q] of this.ukeEntry) this.uke.bones[name].quaternion.copy(q);
    this.ukeEntry.clear();
    if (this.ukeLean) {
      releaseLean(this.uke, this.ukeLean);
      this.ukeLean = null;
    }
    if (this.hipHeld) {
      this.tori.bones.Hips.position.copy(this.hipHome);
      this.hipHeld = false;
      this.hipGave = 0;
    }
    if (this.toriHeld) {
      this.tori.object.position.copy(this.toriHome);
      this.toriHeld = false;
    }
    if (this.ukeHeld) {
      this.uke.object.position.copy(this.ukeHome);
      this.uke.object.quaternion.copy(this.ukeRot);
      this.ukeHeld = false;
    }
    this.feetHeld = false;
    this.tori.object.updateMatrixWorld(true);
    this.uke.object.updateMatrixWorld(true);
  }
}

/**
 * What the floor stops, and what the body settles onto: the torso and the
 * feet, and deliberately NOT the hands.
 *
 * An arm does not hold up a falling body. Including the hands meant that
 * whichever arm happened to be lowest propped the whole uke up — an
 * outstretched breakfall arm on one side, a limp hanging one on the other —
 * and `ukemi` came out changing the SIZE of the fall by up to 46%, which is
 * the one thing this module says a breakfall cannot do. It spreads an arrival;
 * it does not argue with gravity.
 */
const SETTLE_BONES: BoneName[] = ['Head', 'Chest', 'Hips', 'LeftFoot', 'RightFoot'];

// ------------------------------------------------------------- the measure

export interface ThrowReport {
  throwName: ThrowName;
  completed: boolean;
  failed: 'none' | 'noGrip' | 'notBroken';
  /** The uke's stability when the decision was taken, in foot lengths. */
  balance: number;
  /** Their stability before anybody touched them. */
  balanceBefore: number;
  /** Worst hand-to-cloth separation while the grip was doing the work, metres. */
  gripGap: number;
  /** How far the uke's centre of mass was actually dragged, metres. */
  travel: number;
  /** How far they were tipped, radians. */
  lean: number;
  landing: Landing | null;
  /** The worst the TORI's own balance got. You do not fall over throwing somebody. */
  toriWorst: number;
  /** How long the whole attempt took, seconds. */
  seconds: number;
}

/**
 * Run one attempt to its end and report what happened.
 *
 * Headless, deterministic, and the thing the gate is built out of. It drives
 * the real controller over two real rigs — there is no separate analytic model
 * here that could quietly disagree with the one the game runs.
 */
export function measureThrow(
  tori: HumanoidRig,
  uke: HumanoidRig,
  name: ThrowName,
  options: GrapplingOptions & { step?: number } = {}
): ThrowReport {
  const step = options.step ?? 1 / 60;
  uke.object.updateMatrixWorld(true);
  const balanceBefore = stability(uke);
  const g = new Grappling(tori, uke, options);
  let event: ThrowEvent | null = null;
  let landing: Landing | null = null;
  g.onThrow((e) => {
    event = e;
  });
  g.onLand((l) => {
    landing = l;
  });
  g.attempt(name);
  let t = 0;
  while (!g.done && t < 12) {
    g.update(step);
    t += step;
  }
  const e = event as ThrowEvent | null;
  return {
    throwName: name,
    completed: e ? e.completed : false,
    failed: e ? e.failed : 'noGrip',
    balance: e ? e.balance : NaN,
    balanceBefore,
    gripGap: g.gripGap,
    travel: g.travel,
    lean: g.lean,
    landing,
    toriWorst: Number.isFinite(g.toriWorst) ? g.toriWorst : stability(tori),
    seconds: t,
  };
}
