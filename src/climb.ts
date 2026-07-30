import { AnimationAction, AnimationClip, AnimationMixer, Object3D, Quaternion, Vector3 } from 'three';
import { buildClip, Pose } from './clips';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/**
 * Anything with a bottom, a top and rungs. Structurally what SCENA's
 * `createLadder` publishes, so it drops straight in with no cross-import.
 */
export interface Climbable {
  /** Floor-level anchor at the foot of the ladder; +z faces the rungs. */
  bottom: Object3D;
  /** Anchor at the top, where the climber steps off. */
  top: Object3D;
  /** Vertical spacing between rungs, in metres. */
  rungSpacing: number;
}

export type ClimbState = 'off' | 'mounting' | 'climbing' | 'topping' | 'done';

/** Two-link IK: put the end of a `l1`+`l2` chain at `to`, elbow toward `pole`. */
function solveChain(
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
 * The four beats, in order. Which limb moves when, and which rung it holds at
 * the top of the cycle. Hands (and feet) sit a rung apart and alternate
 * between level and one apart as each in turn steps past the other, exactly
 * as they do on a real ladder.
 *
 * Shared by the clip and by `measureClimbContact`, which needs to know when a
 * limb is SUPPOSED to be holding in order to judge whether it held.
 */
const BEATS = [
  { beat: 0, rung: 0, side: 'Left' as const, arm: true, bone: 'LeftHand' },
  { beat: 1, rung: 0, side: 'Right' as const, arm: false, bone: 'RightFoot' },
  { beat: 2, rung: 1, side: 'Right' as const, arm: true, bone: 'RightHand' },
  { beat: 3, rung: 1, side: 'Left' as const, arm: false, bone: 'LeftFoot' },
];
/** Fraction of its own quarter that a limb spends moving. */
const BEAT_DUTY = 0.62;

/** 0 before this limb's beat, 1 after — the rung it has advanced to. */
const advance = (p: number, beat: number): number =>
  smooth(clamp01((p - beat * 0.25) / (0.25 * BEAT_DUTY)));

export interface ClimbClipOptions {
  /** Seconds for one full four-beat cycle. Default 1.6. */
  duration?: number;
  /** Vertical rung spacing, metres. Default 0.3 — SCENA's ladder default. */
  rungSpacing?: number;
  /**
   * Distance from the body's centre line to the rung plane. Default 0.2.
   *
   * Not a cosmetic number: it trades directly against how high the hands can
   * grip. An arm has a fixed length, so every centimetre spent standing back
   * from the ladder comes off the vertical reach — at 0.24 m the grip lands
   * 0.04 m above the head bone, at 0.20 m it lands 0.15 m above it. Climbers
   * hold ladders close for the same reason.
   */
  standoff?: number;
  /** Half the ladder's width: how far apart the hands grip. Default 0.21. */
  spread?: number;
}

/**
 * The climbing loop: FOUR beats, one limb at a time, one rung per cycle.
 *
 * ## Three points of contact
 *
 * At every instant exactly one limb is moving and the other three are holding
 * on. That is the rule every ladder in the world has painted on it, and it is
 * what makes the sequence four beats rather than two:
 *
 * ```
 *   beat 0   left hand  up a rung
 *   beat 1   right foot up a rung
 *   beat 2   right hand up a rung
 *   beat 3   left foot  up a rung
 * ```
 *
 * The order is **contralateral** — a hand followed by the opposite foot. It is
 * the same cross-body pattern as walking, and it exists because it keeps the
 * climber's centre of mass over the supporting triangle. Move a hand and the
 * same-side foot together and the body has to swing out from the ladder at
 * every step; it reads as a cartoon, or as someone who has never climbed.
 *
 * ## Why the hands do not slide
 *
 * A limb's height is `(advance − p) × rungSpacing` from its rung, where
 * `advance` steps 0→1 during that limb's beat and `p` is the body's rise
 * through the cycle. Subtracting the body's rise is the whole trick: while a
 * limb is NOT on its beat the two terms cancel, so **its world position does
 * not change at all** — it is holding a rung, which is what holding a rung
 * means. The clip loops seamlessly for the same reason: one rung of advance
 * minus one rung of rise is zero.
 *
 * ## Why the limbs are solved, not posed
 *
 * Hands are placed on the rungs by two-link IK against the rig's own arm
 * lengths, and feet likewise. A seeded ANIMA body can be 1.5 m or 1.9 m tall
 * with its own proportions; angles that put one character's hands on the rungs
 * put another's through them. Solving costs a few lines and is exact for every
 * body — see `measureClimbContact`.
 */
export function createClimbClip(
  rig: HumanoidRig,
  options: ClimbClipOptions | number = {}
): AnimationClip {
  const opts = typeof options === 'number' ? { duration: options } : options;
  const duration = opts.duration ?? 1.6;
  const rung = opts.rungSpacing ?? 0.3;
  const standoff = opts.standoff ?? 0.2;
  const spread = opts.spread ?? 0.21;
  const { bones } = rig;

  const upperArm = bones.LeftForeArm.position.length();
  const foreArm = bones.LeftHand.position.length();
  const upperLeg = bones.LeftLeg.position.length();
  const lowerLeg = bones.LeftFoot.position.length();

  // Rest quaternions, restored when the clip is built: the sampler poses the
  // real rig in order to read where the shoulders and hips actually end up.
  const rest = new Map<BoneName, Quaternion>();
  for (const name of Object.keys(bones) as BoneName[]) rest.set(name, bones[name].quaternion.clone());
  const restHipsY = bones.Hips.position.y;


  // Where the rung ladder sits relative to the body.
  //
  // A limb rises one rung on its beat and then drifts a rung back down
  // relative to the body over the rest of the cycle, so each hand sweeps a
  // band about 2.3 rungs tall. That band has to sit INSIDE the arm's reach —
  // centred on it, not hung off the top of it, or the highest grip falls
  // outside the solve and the hand stops tracking the rung. (Measured before
  // this was centred: the upper hand slipped 0.068 m a cycle against the
  // lower hand's 0.010.)
  rig.object.updateWorldMatrix(true, true);
  const shoulderRest = rig.object.worldToLocal(bones.LeftArm.getWorldPosition(new Vector3()));
  const hipRest = rig.object.worldToLocal(bones.LeftUpLeg.getWorldPosition(new Vector3()));
  const armLen = upperArm + foreArm;
  const legLen = upperLeg + lowerLeg;
  // Sample the schedule for the band the PAIR sweeps between them. The two
  // hands are not interchangeable within one cycle — the one that moves early
  // spends most of the cycle high, the one that moves late spends it low — so
  // it is the union that has to fit inside the arm, not either band alone.
  const bandMid = (pair: Array<{ beat: number; rung: number }>): number => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const limb of pair) {
      for (let i = 0; i <= 200; i++) {
        const q = i / 200;
        const o = limb.rung + advance(q, limb.beat) - q;
        lo = Math.min(lo, o);
        hi = Math.max(hi, o);
      }
    }
    return (lo + hi) / 2;
  };
  const hands = BEATS.filter((l) => l.arm);
  const feet = BEATS.filter((l) => !l.arm);
  // Hands centred a little above the shoulder; feet under the hips at the
  // height a leg is comfortable rather than locked out.
  const rungRef = shoulderRest.y + 0.15 - rung * bandMid(hands);

  // Which rung the feet stand on has to be a WHOLE rung — feet go on rungs,
  // not between them — and rounding to the nearest can land half a rung out.
  // On a 1.67 m body that was the difference between a comfortable stance and
  // a leg locked straight (`stretch` 0.999: the solve had given up and was
  // quietly clamping). So try both neighbouring rungs and stand on whichever
  // leaves the most bend in the knee, which is what a person does without
  // thinking about it.
  const worstExtension = (candidate: number): number => {
    let worst = 0;
    for (const limb of feet) {
      for (let i = 0; i <= 60; i++) {
        const q = i / 60;
        const y = rungRef + rung * (limb.rung + advance(q, limb.beat) - q + candidate);
        const s = limb.side === 'Left' ? 1 : -1;
        const dx = s * spread * 0.72 - (limb.side === 'Left' ? hipRest.x : -hipRest.x);
        worst = Math.max(worst, Math.hypot(dx, y - hipRest.y, standoff) / legLen);
      }
    }
    return worst;
  };
  const ideal = (hipRest.y - legLen * 0.62 - rungRef) / rung - bandMid(feet);
  const lower = Math.floor(ideal);
  const footRung = worstExtension(lower) <= worstExtension(lower + 1) ? lower : lower + 1;

  void armLen;
  const armPole = new Vector3();
  const kneePole = new Vector3(0, -0.35, 1).normalize();
  const target = new Vector3();
  const parentQ = new Quaternion();
  const rigQ = new Quaternion();

  /**
   * A bone's quaternion is relative to its PARENT; the solve works in the
   * rig's own space. Skip this conversion and the limb inherits the torso's
   * rotation a second time — measured as the foot sliding 2.5 mm a frame
   * along the rung, in x and z, in step with the body's lean.
   */
  const toParentFrame = (bone: BoneName, rigSpace: Quaternion): Quaternion => {
    rig.object.getWorldQuaternion(rigQ).invert();
    const parent = bones[bone].parent;
    if (!parent) return rigSpace;
    parent.getWorldQuaternion(parentQ).premultiply(rigQ).invert();
    return parentQ.multiply(rigSpace);
  };

  const clip = buildClip(rig, 'climb', duration, 30, (p, pose: Pose) => {
    // 1. The torso, which every limb target is measured from.
    const lean = Math.sin(TAU * p) * 0.035;
    pose.rotate('Hips', [Z, lean], [X, -0.14]);
    pose.rotate('Spine', [X, 0.07], [Y, lean * 0.6]);
    pose.rotate('Chest', [X, 0.05], [Y, -lean * 0.5]);
    pose.rotate('Head', [X, -0.24]);
    // Two small rises per cycle — one per foot push. Zero mean, so it does not
    // fight the steady rise the controller applies.
    pose.hipsY = restHipsY + 0.010 * rig.height * Math.sin(TAU * 2 * p - Math.PI / 2);

    // 2. Apply it, so the shoulders and hips are where the solve thinks.
    for (const [name, q] of rest) bones[name].quaternion.copy(q);
    for (const [name, q] of pose.rotations) bones[name].quaternion.copy(q);
    bones.Hips.position.y = pose.hipsY;
    rig.object.updateWorldMatrix(true, true);

    // 3. Solve each limb onto its rung.
    for (const limb of BEATS) {
      const s = limb.side === 'Left' ? 1 : -1;
      const step = advance(p, limb.beat);
      const height = rungRef + rung * (limb.rung + step - p + (limb.arm ? 0 : footRung));
      // Off the rung and swinging: lift clear of it and drift forward, or the
      // limb drags up the face of the ladder through the rungs it passes.
      const swing = Math.sin(Math.PI * step);
      target.set(
        s * spread * (limb.arm ? 1 : 0.72),
        height + (limb.arm ? 0 : swing * rung * 0.16),
        standoff - swing * (limb.arm ? 0.10 : 0.16)
      );

      if (limb.arm) {
        const shoulder = rig.object.worldToLocal(
          bones[`${limb.side}Arm`].getWorldPosition(new Vector3())
        );
        // Elbows hang out and down, the way they do when you hold a rung
        // above your head; the alternative is chicken wings.
        armPole.set(s * 1, -0.9, -0.25).normalize();
        const { root, joint } = solveChain(shoulder, target, new Vector3(s, 0, 0), upperArm, foreArm, armPole);
        pose.set(`${limb.side}Arm`, toParentFrame(`${limb.side}Arm`, root));
        pose.set(`${limb.side}ForeArm`, joint);
      } else {
        const hip = rig.object.worldToLocal(
          bones[`${limb.side}UpLeg`].getWorldPosition(new Vector3())
        );
        const { root, joint } = solveChain(hip, target, new Vector3(0, -1, 0), upperLeg, lowerLeg, kneePole);
        pose.set(`${limb.side}UpLeg`, toParentFrame(`${limb.side}UpLeg`, root));
        pose.set(`${limb.side}Leg`, joint);
        // Ball of the foot on the rung, heel low — a climber does not point
        // their toes at a ladder.
        pose.rotate(`${limb.side}Foot`, [X, -0.18 - 0.22 * swing]);
      }
    }
  });

  for (const [name, q] of rest) bones[name].quaternion.copy(q);
  bones.Hips.position.y = restHipsY;
  rig.object.updateWorldMatrix(true, true);
  return clip;
}

export interface ClimbContactReport {
  /**
   * How far a hand wanders from the rung it is gripping, in metres — the
   * PEAK deviation from where it settled, not the summed path length.
   *
   * The distinction matters and is the same one the foot-skate gate had to
   * learn. Interpolating between keyframes leaves a limb jittering a
   * fraction of a millimetre either side of its rung; sum that over 200
   * frames and it reads as 19 mm of "slip" for a hand that never goes
   * anywhere. Peak deviation tells a wobble from a slide.
   */
  handSlip: number;
  /** The same for the feet on their rungs. */
  footSlip: number;
  /** The worse of the two — the number to gate on. */
  worstSlip: number;
  /**
   * Fraction of the cycle with more than one limb in motion.
   *
   * Three points of contact means this is 0. It is the check that would have
   * caught the loop this replaced, where a modulo cancelled the contralateral
   * offset and all four limbs moved in pairs.
   */
  overlap: number;
  /** How far the highest grip reaches above the head bone, in metres. */
  overhead: number;
  /**
   * Worst limb extension over the cycle, as a fraction of the limb's length.
   *
   * 1.0 means a chain went straight — which is how `solveChain` reports "I
   * could not reach that", silently, by clamping. A limb at full stretch is
   * not on its rung, and it does not slip either: it just hangs a little
   * short of where it claims to be. Nothing else in this report can see it.
   */
  stretch: number;
  samples: number;
}

/**
 * Does this climber actually hold the ladder?
 *
 * The hand-and-rung version of `measureFootSkate`, and it exists for the same
 * reason: a limb that slides while it is supposed to be gripping is invisible
 * in a still frame and unmistakable in motion. It drives a real
 * `AnimationMixer` and watches world positions, so it measures the clip that
 * ships rather than the arithmetic that produced it.
 *
 * ```ts
 * const report = measureClimbContact(rig, { rungSpacing: 0.3 });
 * report.worstSlip;   // metres per cycle — was 0.382 before this was fixed
 * report.overlap;     // 0, or the three-points-of-contact rule is a fiction
 * ```
 */
export function measureClimbContact(
  rig: HumanoidRig,
  options: ClimbClipOptions & { samples?: number } = {}
): ClimbContactReport {
  const rung = options.rungSpacing ?? 0.3;
  const samples = options.samples ?? 240;
  const clip = createClimbClip(rig, options);
  const mixer = new AnimationMixer(rig.object);
  mixer.clipAction(clip).play();

  const limbs = ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'] as const;
  const CHAINS: Array<[string, string, string]> = [
    ['LeftHand', 'LeftArm', 'LeftForeArm'],
    ['RightHand', 'RightArm', 'RightForeArm'],
    ['LeftFoot', 'LeftUpLeg', 'LeftLeg'],
    ['RightFoot', 'RightUpLeg', 'RightLeg'],
  ];
  const lengthOf = (root: string, mid: string, end: string): number =>
    rig.bones[mid as BoneName].position.length() + rig.bones[end as BoneName].position.length();
  const track = new Map<string, Vector3[]>(limbs.map((l) => [l, []]));
  let headY = 0;
  let gripY = -Infinity;
  let stretch = 0;
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    mixer.setTime(t * clip.duration);
    rig.object.updateWorldMatrix(true, true);
    // The controller raises the body exactly one rung per cycle; add it back
    // so a limb that is holding a rung reads as motionless, which it is.
    const rise = t * rung;
    for (const limb of limbs) {
      const w = bonePosition(rig, limb);
      w.y += rise;
      track.get(limb)!.push(w);
    }
    for (const [end, root, mid] of CHAINS) {
      const d = bonePosition(rig, root).distanceTo(bonePosition(rig, end));
      stretch = Math.max(stretch, d / lengthOf(root, mid, end));
    }
    headY = Math.max(headY, bonePosition(rig, 'Head').y + rise);
    const lh = track.get('LeftHand')!;
    const rh = track.get('RightHand')!;
    gripY = Math.max(gripY, lh[lh.length - 1].y, rh[rh.length - 1].y);
  }
  mixer.stopAllAction();

  const wrap = new Vector3();
  const steps = (limb: string): number[] => {
    const w = track.get(limb)!;
    const d: number[] = [];
    for (let i = 1; i < w.length; i++) d.push(w[i].distanceTo(w[i - 1]));
    // Closing the loop: the sample at p=1 is the sample at p=0 one rung
    // higher, because that is what "one rung per cycle" means. Comparing the
    // raw first and last frames instead reports a whole rung of slip that is
    // simply the rise nobody added.
    d.push(wrap.copy(w[0]).setY(w[0].y + rung).distanceTo(w[w.length - 1]));
    return d;
  };
  /**
   * Sum the motion over the frames where this limb is supposed to be HOLDING,
   * taken from the schedule rather than guessed from the numbers.
   *
   * An earlier version called the quietest 70% of frames "holding". That
   * flatters two opposite mistakes at once: it swallows the easing frames at
   * the end of a limb's own beat (reporting 5 mm of slip for a limb measured
   * stationary to 0.00 mm), and on a clip where everything slides gently it
   * would have found no holding frames at all and reported nothing wrong.
   */
  const slipOf = (bone: string): number => {
    const limb = BEATS.find((b) => b.bone === bone)!;
    const from = limb.beat * 0.25;
    const to = from + 0.25 * BEAT_DUTY;
    // A beat's edges only exist on the clip's keyframe grid — the clip is
    // sampled at 30 fps, so a beat that ends at p=0.405 finishes easing at the
    // next keyframe after it. Allow one keyframe either side, or that tail
    // gets counted as a limb sliding while it grips.
    const margin = Math.max(1.5 / samples, 1 / (30 * clip.duration));
    const w = track.get(bone)!;
    // The two runs of frames where this limb is holding: before its beat and
    // after it. They are DIFFERENT rungs, so each is judged against its own
    // resting place rather than one average of both.
    const runs: Vector3[][] = [[], []];
    for (let i = 0; i < samples; i++) {
      const p = (i + 0.5) / samples;
      if (p > from - margin && p < to + margin) continue;
      runs[p <= from ? 0 : 1].push(w[i]);
    }
    let worst = 0;
    for (const run of runs) {
      if (run.length < 2) continue;
      const mean = run.reduce((a, v) => a.add(v), new Vector3()).multiplyScalar(1 / run.length);
      for (const v of run) worst = Math.max(worst, v.distanceTo(mean));
    }
    return worst;
  };
  const moving = limbs.map((l) => steps(l));
  let overlapping = 0;
  for (let i = 0; i < samples; i++) {
    if (moving.filter((d) => d[i] > 0.002).length > 1) overlapping++;
  }

  const handSlip = Math.max(slipOf('LeftHand'), slipOf('RightHand'));
  const footSlip = Math.max(slipOf('LeftFoot'), slipOf('RightFoot'));
  return {
    handSlip,
    footSlip,
    worstSlip: Math.max(handSlip, footSlip),
    overlap: overlapping / samples,
    overhead: gripY - headY,
    stretch,
    samples,
  };
}

function bonePosition(rig: HumanoidRig, bone: string): Vector3 {
  return rig.bones[bone as BoneName].getWorldPosition(new Vector3());
}

/**
 * Topping out — the parkour bit, and the part everyone skips.
 *
 * Getting *onto* a ladder is easy; getting *off* the top is the hard move,
 * because the climber has to transfer from hanging under their hands to
 * standing over their feet. The body folds forward over the edge, one knee
 * comes up onto the top, and the climber presses up and stands. Cut this
 * and the character slides up the last metre like a lift.
 */
export function createTopOutClip(rig: HumanoidRig, duration = 1.3): AnimationClip {
  return buildClip(rig, 'topout', duration, 30, (p, pose: Pose) => {
    const u = smooth(clamp01(p));
    // Three beats: reach over (0–0.35), knee up and press (0.35–0.75),
    // stand up (0.75–1).
    const over = smooth(clamp01(p / 0.35));
    const press = smooth(clamp01((p - 0.3) / 0.45));
    const stand = smooth(clamp01((p - 0.7) / 0.3));

    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      // Hands plant on the top and push down as the body rises.
      pose.rotate(
        `${side}Arm`,
        [X, -0.6 * over + 1.0 * press - 0.55 * stand],
        [Z, -s * (0.5 - 0.28 * over + 0.3 * stand)]
      );
      pose.rotate(`${side}ForeArm`, [Y, -s * (0.9 - 0.75 * press)], [X, -0.3 + 0.2 * press]);
    }
    // The leading (right) knee comes up onto the ledge first — a climber
    // does not haul both legs up together.
    pose.rotate('RightUpLeg', [X, -(1.5 * press) + 1.4 * stand], [Z, -0.3 * press]);
    pose.rotate('RightLeg', [X, 1.7 * press - 1.6 * stand]);
    pose.rotate('RightFoot', [X, -0.3 * press + 0.2 * stand]);
    pose.rotate('LeftUpLeg', [X, -(0.3 + 0.5 * press) + 0.7 * stand], [Z, 0.12]);
    pose.rotate('LeftLeg', [X, 0.7 + 0.9 * press - 1.3 * stand]);
    pose.rotate('LeftFoot', [X, -0.2]);

    // Fold over the edge, then unfold to standing.
    pose.hipsY = rig.bones.Hips.position.y - 0.06 * rig.height * (1 - stand);
    pose.rotate('Hips', [X, 0.5 * over + 0.15 * press - 0.6 * stand]);
    pose.rotate('Spine', [X, 0.35 * over - 0.4 * stand]);
    pose.rotate('Chest', [X, 0.25 * over - 0.3 * stand]);
    pose.rotate('Head', [X, -0.2 * over + 0.25 * stand]);
    void u;
  });
}

export interface ClimbOptions {
  /** Rungs climbed per second. Default 1.6. */
  speed?: number;
  /**
   * How far the body stands off the rungs, in metres. Default 0.2.
   *
   * Passed straight into the loop clip, because the hands are solved onto
   * rungs at this distance: the two numbers are one number, and if they
   * disagree the grip misses by their difference.
   */
  standoff?: number;
}

type ClimbListener = (state: ClimbState) => void;

/**
 * Climbing a ladder, with the transitions at both ends.
 *
 * The controller's job is to keep the *clip* and the *translation* locked
 * together: the body rises exactly two rungs per cycle of the climb loop,
 * so hands arrive where rungs actually are. Decouple them and the hands
 * slide through the ladder — the climbing equivalent of foot-skating, and
 * just as obvious.
 *
 * ```ts
 * const climb = new Climb(rig, loco);
 * climb.start(ladder);                       // SCENA's createLadder fits
 * game.onUpdate((t) => climb.update(t.delta));
 * climb.onState((s) => { if (s === 'done') walkOn(); });
 * ```
 */
export class Climb {
  /** Rungs per second. Live-editable. */
  speed: number;

  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private readonly standoff: number;
  private readonly listeners = new Set<ClimbListener>();
  private ladder: Climbable | null = null;
  private loopClip: AnimationClip | null = null;
  private loopRungs = 0;
  private topClip: AnimationClip | null = null;
  private action: AnimationAction | null = null;
  private state: ClimbState = 'off';
  private rungs = 0; // rungs climbed so far
  private total = 0;
  private stageT = 0;
  private from = new Vector3();
  private fromQ = new Quaternion();
  private weight = 0;

  constructor(rig: HumanoidRig, loco: Locomotion, options: ClimbOptions = {}) {
    this.rig = rig;
    this.loco = loco;
    this.speed = options.speed ?? 1.6;
    this.standoff = options.standoff ?? 0.2;
  }

  get climbing(): boolean {
    return this.state !== 'off' && this.state !== 'done';
  }

  /** 0 at the foot of the ladder, 1 at the top. */
  get progress(): number {
    return this.total > 0 ? clamp01(this.rungs / this.total) : 0;
  }

  onState(listener: ClimbListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Step onto the ladder and start going up. */
  start(ladder: Climbable): void {
    if (this.climbing) return;
    this.ladder = ladder;
    ladder.bottom.updateWorldMatrix(true, false);
    ladder.top.updateWorldMatrix(true, false);
    const foot = ladder.bottom.getWorldPosition(new Vector3());
    const head = ladder.top.getWorldPosition(new Vector3());
    this.total = Math.max(1, Math.round((head.y - foot.y) / ladder.rungSpacing));
    this.rungs = 0;
    this.stageT = 0;
    this.from.copy(this.rig.object.position);
    this.fromQ.copy(this.rig.object.quaternion);
    this.go('mounting');
  }

  /** Let go and drop back to the foot of the ladder. */
  stop(): void {
    if (!this.climbing) return;
    if (this.action) this.loco.stopOverlay(this.action, 0.25);
    this.action = null;
    this.state = 'off';
    this.loco.influence = 1;
    this.weight = 0;
    for (const listener of [...this.listeners]) listener('off');
  }

  update(dt: number): void {
    if (!this.ladder || this.state === 'off' || this.state === 'done') return;
    const target = this.state === 'climbing' || this.state === 'mounting' ? 1 : 1;
    this.weight += (target - this.weight) * Math.min(1, dt * 8);
    this.loco.influence = 1 - this.weight;

    const ladder = this.ladder;
    ladder.bottom.updateWorldMatrix(true, false);
    const foot = ladder.bottom.getWorldPosition(new Vector3());
    const facing = ladder.bottom.getWorldQuaternion(new Quaternion());
    // Stand off the rungs by a body's depth, facing the ladder.
    const into = new Vector3(0, 0, 1).applyQuaternion(facing);
    const base = foot.clone().addScaledVector(into, -this.standoff);

    if (this.state === 'mounting') {
      this.stageT += dt / 0.5;
      const k = smooth(clamp01(this.stageT));
      const to = this.local(base.clone().addScaledVector(Y, ladder.rungSpacing * 0.6), facing);
      this.rig.object.position.lerpVectors(this.from, to.position, k);
      this.rig.object.quaternion.slerpQuaternions(this.fromQ, to.quaternion, k);
      if (this.stageT >= 1) {
        this.playLoop();
        this.go('climbing');
      }
      return;
    }

    if (this.state === 'climbing') {
      this.rungs += this.speed * dt;
      // Body height is driven by rungs climbed and the loop's playback by the
      // same number — ONE rung per cycle — so the hands and the rungs stay in
      // step however fast the climb is set to run.
      //
      // The duration factor is not optional. `speed / 2` looks like a rate and
      // is not one: a timeScale is a multiple of the clip's own duration, so
      // at the 1.6 s default it delivered 1.0 rungs/s while the body rose at
      // the 1.6 rungs/s it had been asked for.
      if (this.action && this.loopClip) {
        this.action.timeScale = this.speed * this.loopClip.duration;
      }
      const y = ladder.rungSpacing * (0.6 + this.rungs);
      const to = this.local(base.clone().addScaledVector(Y, y), facing);
      this.rig.object.position.copy(to.position);
      this.rig.object.quaternion.copy(to.quaternion);
      if (this.rungs >= this.total - 1) {
        if (this.action) this.loco.stopOverlay(this.action, 0.2);
        this.topClip ??= createTopOutClip(this.rig);
        this.action = this.loco.overlay(this.topClip, { loop: false, fadeIn: 0.2 });
        this.from.copy(this.rig.object.position);
        this.fromQ.copy(this.rig.object.quaternion);
        this.stageT = 0;
        this.go('topping');
      }
      return;
    }

    // Topping out: rise the last rung AND step forward onto the platform.
    this.stageT += dt / 1.3;
    const k = smooth(clamp01(this.stageT));
    ladder.top.updateWorldMatrix(true, false);
    const over = ladder.top.getWorldPosition(new Vector3()).addScaledVector(into, 0.42);
    const to = this.local(over, facing);
    this.rig.object.position.lerpVectors(this.from, to.position, k);
    this.rig.object.quaternion.slerpQuaternions(this.fromQ, to.quaternion, k);
    if (this.stageT >= 1) {
      if (this.action) this.loco.stopOverlay(this.action, 0.3);
      this.action = null;
      this.state = 'done';
      this.loco.influence = 1;
      this.weight = 0;
      for (const listener of [...this.listeners]) listener('done');
    }
  }

  private playLoop(): void {
    // Built against THIS ladder: the clip solves hands onto rungs at a given
    // spacing and standoff, so a cached clip from another ladder would grip
    // thin air.
    const rungSpacing = this.ladder?.rungSpacing ?? 0.3;
    if (!this.loopClip || this.loopRungs !== rungSpacing) {
      this.loopClip = createClimbClip(this.rig, { rungSpacing, standoff: this.standoff });
      this.loopRungs = rungSpacing;
    }
    this.action = this.loco.overlay(this.loopClip, { fadeIn: 0.25 });
  }

  private go(state: ClimbState): void {
    this.state = state;
    for (const listener of [...this.listeners]) listener(state);
  }

  /** Express a world transform in the rig's parent space. */
  private local(position: Vector3, quaternion: Quaternion): { position: Vector3; quaternion: Quaternion } {
    const p = position.clone();
    const q = quaternion.clone();
    const parent = this.rig.object.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(p);
      q.premultiply(parent.getWorldQuaternion(new Quaternion()).invert());
    }
    return { position: p, quaternion: q };
  }
}
