import { AnimationClip, Object3D, Quaternion, Vector3 } from 'three';
import type { AnimationAction } from 'three';
import type { HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';
import { Pose, buildClip } from './clips';

/**
 * Cricket — the actions, not the game.
 *
 * A cricket body does three things nothing else in this library does,
 * and each of them is a whole-body SEQUENCE rather than a loop:
 *
 * - **the bowling action**, which is a run-up, a leap with the body
 *   side-on, a braced front leg, and an arm coming over vertically past
 *   the ear — the arm never bends, and that is the law as well as the
 *   look;
 * - **the shot**, which is a step, a backlift and a swing whose PLANE
 *   decides what the shot is: down the ground, across the line, or up
 *   and over;
 * - **the keeper's crouch**, which is a held pose that has to breathe,
 *   because a keeper waiting is not a statue.
 *
 * ```ts
 * const cricketer = new Cricketer(rig, loco);
 * cricketer.bowl();                       // fires onRelease at the moment
 * cricketer.play('drive');                // fires onContact at the middle
 * game.onUpdate((t) => cricketer.update(t.delta));
 * ```
 *
 * The controller is deliberately event-shaped: it does not know about
 * balls, runs or overs. It tells you the instant the ball leaves the
 * hand and the instant the bat is at the point of contact, and a game
 * (GAMA's `CricketMatch`, or your own) does the rest.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** The strokes. The swing PLANE is what separates them. */
export type Shot =
  /** Straight bat, down the ground, high elbow, high finish. */
  | 'drive'
  /** Vertical bat, wrists rolled, worked away off the pads. */
  | 'flick'
  /** Horizontal bat, back foot, late, square on the off side. */
  | 'cut'
  /** Horizontal bat, across the line, into the leg side. */
  | 'pull'
  /** Down on one knee, bat along the ground, round the corner. */
  | 'sweep'
  /** Bat angled down, soft hands, no follow-through. */
  | 'defend'
  /** Everything, upward: the swing that clears the rope or misses. */
  | 'loft';

/** Every stroke, in the order a coach would teach them. */
export const SHOTS: Shot[] = [
  'defend', 'drive', 'flick', 'cut', 'pull', 'sweep', 'loft',
];

export type CricketAction = 'bowl' | Shot | 'keep' | 'field' | 'stance';

export interface CricketerOptions {
  /** Seconds of run-up before the delivery stride. Default 1.1. */
  runUp?: number;
  /** Right-arm (1) or left-arm (-1) bowler. Default 1. */
  arm?: 1 | -1;
  /**
   * Right-handed (1) or left-handed (-1) BATTER. The top hand is the
   * left for a right-hander, and every swing path mirrors. Default 1.
   */
  bats?: 1 | -1;
  /** How far apart the two hands sit on the handle, metres. Default 0.11. */
  gripGap?: number;
}

/**
 * The bowling action: run-up, gather, delivery stride, and the arm over.
 *
 * The clip is ONE-SHOT and the release is at a fixed phase — 0.62, just
 * past the vertical — because everything downstream (the ball leaving,
 * the umpire's call, the batter's cue) has to agree about when the ball
 * is out of the hand, and a controller that guesses is a controller that
 * drifts.
 */
export const RELEASE_PHASE = 0.62;
/** Where in a shot the bat is at the point of contact. */
export const CONTACT_PHASE = 0.45;

export function createBowlClip(rig: HumanoidRig, arm: 1 | -1 = 1): AnimationClip {
  const front = -arm as 1 | -1;
  // hipsY is an ABSOLUTE height, not an offset — every clip builder in
  // this library captures the rest height first. Treating it as an offset
  // plants the body at ground level, which reads as an arm swinging
  // correctly on a corpse.
  const rest = rig.bones.Hips.position.y;
  return buildClip(rig, 'cricket-bowl', 1.5, 34, (p, pose: Pose) => {
    // 0 → 0.35 gather and leap, 0.35 → 0.62 the arm comes over, then the
    // follow-through carries the body across and down.
    const gather = Math.min(1, p / 0.35);
    const over = Math.max(0, Math.min(1, (p - 0.3) / (RELEASE_PHASE - 0.3)));
    const after = Math.max(0, (p - RELEASE_PHASE) / (1 - RELEASE_PHASE));

    // Side-on in the gather, then chest opens through the release.
    const openness = -0.9 * (1 - over) + 0.25 * over;
    pose.rotate('Hips', [Y, arm * openness * 0.7], [X, 0.1 * over - 0.25 * after]);
    pose.rotate('Spine', [Y, arm * openness * 0.35], [Z, arm * (0.25 * gather - 0.5 * over)]);
    pose.rotate('Chest', [Y, arm * openness * 0.4], [X, -0.3 * gather + 0.55 * over + 0.3 * after]);
    pose.rotate('Head', [Y, -arm * 0.5 * (1 - over)]);

    // THE BOWLING ARM. The arms bind along ±X, and for the right arm a
    // rotation of −π/2 about Z is straight UP. So the swing is measured
    // as an OFFSET from vertical: −π (down and back) in the gather, 0 at
    // the release, and positive after, carrying the arm down in front.
    // (Getting this backwards put the hand below the knees at the moment
    // of release, which the above-the-head test now catches.)
    const swing = -Math.PI * (1 - over) + after * 1.7;
    pose.rotate(arm > 0 ? 'RightArm' : 'LeftArm', [Z, -arm * (Math.PI / 2 + swing)]);
    pose.rotate(arm > 0 ? 'RightForeArm' : 'LeftForeArm', [Y, 0]);
    // The other arm starts high and is PULLED DOWN as the bowling arm
    // comes over — that counter-rotation is where the pace comes from.
    const pull = -over * 2.6;
    pose.rotate(arm > 0 ? 'LeftArm' : 'RightArm', [Z, arm * (Math.PI / 2 + pull)]);

    // The delivery stride: front leg braces and straightens, back leg
    // drags through.
    const brace = Math.max(0, Math.min(1, (p - 0.28) / 0.25));
    pose.rotate(front > 0 ? 'LeftUpLeg' : 'RightUpLeg', [X, -0.95 * brace + 0.5 * after]);
    pose.rotate(front > 0 ? 'LeftLeg' : 'RightLeg', [X, 0.6 * (1 - brace) + 0.15]);
    pose.rotate(front > 0 ? 'RightUpLeg' : 'LeftUpLeg', [X, 0.7 * gather - 1.1 * after]);
    pose.rotate(front > 0 ? 'RightLeg' : 'LeftLeg', [X, 0.4 + 0.9 * after]);
    // A leap in the gather, and low over the front leg at release.
    pose.hipsY = rest + 0.12 * Math.sin(gather * Math.PI) - 0.12 * over - 0.05 * after;
  });
}

/**
 * THE SWING PATH — where the hands and the bat actually are.
 *
 * The strokes used to be composed out of per-bone Euler angles, and it
 * showed: the top hand went where the formula sent it and the bottom hand
 * went somewhere else, so the batter held the bat one-handed like a
 * briefcase. A real cricketer holds it with BOTH hands, and both hands
 * are on the same 12 cm of handle in every frame of every stroke.
 *
 * So a stroke is authored the way it actually looks — as a path for the
 * GRIP and a direction for the BLADE, through three keys: the backlift,
 * the point of contact, and the finish. The clip animates the body; the
 * arms are then SOLVED onto the path, which makes the grip an invariant
 * rather than a coincidence, and makes the bat's position something a
 * game can collide a ball against.
 *
 * Everything is in the CHEST's space, not the body's — because that is
 * where a batter's hands actually live. The shoulders sit at a fixed
 * (±0.213, 0.169, 0) from the chest bone whatever the clip is doing, and
 * each arm reaches 0.498 m, so a grip authored here is reachable by
 * BOTH arms by construction. Author it in root space instead and the
 * torso turn slides the hands out of reach halfway through every stroke.
 *
 * +Z is out in front of the chest, +X the off side, −X the leg side.
 */
export interface SwingKey {
  /** Where the hands are. */
  grip: [number, number, number];
  /** Unit direction from the handle DOWN the blade toward the toe. */
  blade: [number, number, number];
}

export interface SwingSpec {
  back: SwingKey;
  contact: SwingKey;
  finish: SwingKey;
  /** Clip length, seconds. */
  dur: number;
  /** How far the front foot strides at the ball (negative = back foot). */
  step: number;
  /** How much the body drops into it; 1 is down on one knee. */
  kneel: number;
  /** Shoulder turn through the stroke. */
  turn: number;
  /**
   * Which side of the wicket it goes: +1 off, −1 leg. A game reads this
   * so the ball leaves the bat the way the bat sent it.
   */
  side: number;
}

/** The reference body these paths were authored on. */
const SWING_HEIGHT = 1.78;
/** Arm reach and shoulder spread, measured on it. */
export const ARM_REACH = 0.498;

export const SWINGS: Record<Shot, SwingSpec> = {
  // Bat straight up behind, straight down through the line, high finish.
  drive: {
    back: { grip: [0.10, 0.26, 0.13], blade: [0.12, -0.55, -0.83] },
    contact: { grip: [0.02, 0.03, 0.30], blade: [0.05, -0.97, 0.24] },
    finish: { grip: [-0.04, 0.28, 0.18], blade: [-0.10, 0.55, -0.83] },
    dur: 0.95, step: 0.5, kneel: 0.12, turn: 0.55, side: 0.35,
  },
  // The same vertical bat, but the wrists roll it away to leg.
  flick: {
    back: { grip: [0.10, 0.22, 0.15], blade: [0.12, -0.65, -0.75] },
    contact: { grip: [0.00, 0.00, 0.29], blade: [-0.30, -0.92, 0.25] },
    finish: { grip: [-0.13, 0.22, 0.18], blade: [-0.60, 0.42, -0.68] },
    dur: 0.9, step: 0.32, kneel: 0.14, turn: 0.6, side: -0.85,
  },
  // Back foot, late, and the bat comes DOWN across the ball to the off.
  cut: {
    back: { grip: [0.13, 0.28, 0.10], blade: [0.30, -0.60, -0.74] },
    contact: { grip: [0.02, 0.02, 0.28], blade: [0.92, -0.36, 0.16] },
    finish: { grip: [0.14, 0.10, 0.05], blade: [0.80, 0.24, -0.55] },
    dur: 0.85, step: -0.28, kneel: 0.2, turn: 0.7, side: 0.95,
  },
  // Front-on, horizontal, and it goes round the corner to leg.
  pull: {
    back: { grip: [0.15, 0.28, 0.08], blade: [0.30, -0.52, -0.80] },
    contact: { grip: [0.02, 0.12, 0.30], blade: [-0.95, -0.24, 0.18] },
    finish: { grip: [-0.19, 0.10, 0.02], blade: [-0.64, 0.10, -0.76] },
    dur: 0.9, step: -0.2, kneel: 0.16, turn: 0.95, side: -1,
  },
  // Down on the knee, bat along the turf, and it is fetched from outside
  // off all the way round to fine leg.
  sweep: {
    back: { grip: [0.12, 0.10, 0.22], blade: [0.20, -0.90, -0.38] },
    contact: { grip: [0.02, 0.06, 0.28], blade: [-0.90, -0.36, 0.24] },
    finish: { grip: [-0.16, 0.02, 0.16], blade: [-0.72, 0.30, -0.62] },
    dur: 1.0, step: 0.62, kneel: 1, turn: 0.7, side: -0.9,
  },
  // Soft hands, bat angled DOWN over the ball, and nowhere to go.
  defend: {
    back: { grip: [0.06, 0.02, 0.24], blade: [0.10, -0.94, -0.32] },
    contact: { grip: [0.03, 0.04, 0.29], blade: [0.02, -0.97, 0.24] },
    finish: { grip: [0.03, 0.01, 0.25], blade: [0.00, -0.97, 0.24] },
    dur: 0.85, step: 0.55, kneel: 0.18, turn: 0.2, side: 0.15,
  },
  // Everything, upward. The finish is over the shoulder and behind.
  loft: {
    back: { grip: [0.12, 0.28, 0.11], blade: [0.16, -0.52, -0.84] },
    contact: { grip: [0.02, 0.05, 0.31], blade: [0.04, -0.96, 0.28] },
    finish: { grip: [-0.05, 0.32, 0.14], blade: [-0.16, 0.76, -0.63] },
    dur: 1.0, step: 0.35, kneel: 0.1, turn: 0.75, side: 0.3,
  },
};

/** The batter waiting: bat tapped down beside the front pad. */
export const STANCE_KEY: SwingKey = {
  grip: [0.06, 0.02, 0.27],
  blade: [0.12, -0.96, 0.25],
};

const smooth = (t: number): number => t * t * (3 - 2 * t);
const KEY_A = new Vector3();
const KEY_B = new Vector3();

/**
 * Where the grip and the blade are, `phase` through `shot`, scaled to a
 * body of `height`. Exported because a game that wants to know where the
 * bat WILL be — to collide a ball against it, or to draw a trail — should
 * not have to guess.
 */
export function swingAt(
  shot: Shot,
  phase: number,
  height = SWING_HEIGHT,
  out: { grip: Vector3; blade: Vector3 } = { grip: new Vector3(), blade: new Vector3() }
): { grip: Vector3; blade: Vector3 } {
  const spec = SWINGS[shot];
  const p = phase < 0 ? 0 : phase > 1 ? 1 : phase;
  const from = p <= CONTACT_PHASE ? spec.back : spec.contact;
  const to = p <= CONTACT_PHASE ? spec.contact : spec.finish;
  const t = smooth(
    p <= CONTACT_PHASE
      ? p / CONTACT_PHASE
      : (p - CONTACT_PHASE) / (1 - CONTACT_PHASE)
  );
  const s = height / SWING_HEIGHT;
  out.grip
    .copy(KEY_A.fromArray(from.grip))
    .lerp(KEY_B.fromArray(to.grip), t)
    .multiplyScalar(s);
  out.blade
    .copy(KEY_A.fromArray(from.blade))
    .lerp(KEY_B.fromArray(to.blade), t)
    .normalize();
  return out;
}

/**
 * One stroke, as a BODY: the stride, the crouch, the shoulder turn and
 * the head. The arms are left roughly in the right place so the clip
 * stands alone, and `Cricketer.lateUpdate()` then solves them exactly
 * onto the swing path — which is what puts both hands on the handle.
 */
export function createShotClip(rig: HumanoidRig, shot: Shot): AnimationClip {
  const spec = SWINGS[shot];
  const rest = rig.bones.Hips.position.y;
  return buildClip(rig, `cricket-${shot}`, spec.dur, 34, (p, pose: Pose) => {
    const back = Math.min(1, p / CONTACT_PHASE);
    const thru = Math.max(0, (p - CONTACT_PHASE) / (1 - CONTACT_PHASE));

    // The front foot steps at the ball; a shot played from a standing
    // start is a swipe. A sweep goes down on the back knee instead.
    const step = spec.step * Math.min(1, p / 0.4);
    const kneel = spec.kneel * smooth(Math.min(1, p / 0.5));
    pose.rotate('LeftUpLeg', [X, -step - kneel * 0.5], [Z, 0.1]);
    pose.rotate('LeftLeg', [X, Math.abs(step) * 0.5 + kneel * 0.5]);
    pose.rotate('RightUpLeg', [X, step * 0.25 + kneel * 0.9]);
    pose.rotate('RightLeg', [X, 0.25 + kneel * 1.9]);
    pose.rotate('RightFoot', [X, -kneel * 0.7]);

    // Shoulders COIL through the backlift and are unwound again by the
    // moment of contact — a batter square at impact, not still turning
    // into it — then keep going through the follow-through. (Peaking the
    // coil at contact instead swings the whole stroke round the body and
    // the bat meets the ball a foot to leg.)
    const coil = Math.sin(back * Math.PI);
    const turn = -0.45 * coil + spec.turn * thru;
    pose.rotate('Hips', [Y, turn * 0.6], [X, kneel * 0.25]);
    pose.rotate('Spine', [Y, turn], [X, 0.14 + kneel * 0.3 - 0.12 * thru]);
    pose.rotate('Chest', [Y, turn * 0.7], [X, 0.1]);
    // The head stays down and still: it is the only part of a batter that
    // is not supposed to move.
    pose.rotate('Head', [X, 0.22 + kneel * 0.2], [Y, -turn * 0.55]);

    // A stand-in grip, replaced by the solver when one is running.
    const swing = -1.1 * (1 - back) + 1.6 * thru;
    pose.rotate('LeftArm', [X, -0.6 * thru], [Z, -Math.PI / 2 - 0.55 - swing * 0.55]);
    pose.rotate('LeftForeArm', [Y, -0.55 + swing * 0.25]);
    pose.rotate('RightArm', [X, -0.6 * thru], [Z, Math.PI / 2 + 0.4 + swing * 0.5]);
    pose.rotate('RightForeArm', [Y, 0.5 - swing * 0.2]);
    pose.hipsY = rest - 0.03 - 0.04 * back - kneel * 0.42;
  });
}

/**
 * The batter's stance — a held pose, waiting.
 *
 * This exists because a batter between balls is on screen for two seconds
 * out of every four, and a rig standing at rest holds the bat out
 * sideways like a briefcase. The stance is side-on, knees soft, weight
 * forward, head turned back down the pitch, and the hands in the SAME
 * grip the swing starts from — so the bat is already tapped down in front
 * of the pads and the stroke does not have to snatch it there.
 */
export function createStanceClip(rig: HumanoidRig): AnimationClip {
  const rest = rig.bones.Hips.position.y;
  return buildClip(rig, 'cricket-stance', 2.6, 24, (p, pose: Pose) => {
    const breath = Math.sin(p * Math.PI * 2);
    pose.rotate('Hips', [Y, -0.5], [X, 0.16]);
    pose.rotate('Spine', [Y, -0.28], [X, 0.2 + breath * 0.015]);
    pose.rotate('Chest', [Y, -0.22], [X, 0.14 + breath * 0.03]);
    // The eyes go back to the bowler whatever the shoulders are doing.
    pose.rotate('Head', [Y, 0.95], [X, 0.1]);
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      pose.rotate(`${side}UpLeg`, [X, -0.34], [Z, s * 0.12]);
      pose.rotate(`${side}Leg`, [X, 0.5]);
      pose.rotate(`${side}Foot`, [X, -0.18]);
    }
    pose.rotate('LeftArm', [X, 0.12], [Z, -Math.PI / 2 - 0.55]);
    pose.rotate('LeftForeArm', [Y, -0.55]);
    pose.rotate('RightArm', [X, 0.12], [Z, Math.PI / 2 + 0.4]);
    pose.rotate('RightForeArm', [Y, 0.5]);
    pose.hipsY = rest - 0.1 + breath * 0.006;
  });
}

/** The keeper's crouch — a held pose that breathes, and rises with the ball. */
export function createKeepClip(rig: HumanoidRig): AnimationClip {
  const rest = rig.bones.Hips.position.y;
  return buildClip(rig, 'cricket-keep', 2.4, 26, (p, pose: Pose) => {
    const breath = Math.sin(p * Math.PI * 2);
    pose.rotate('Hips', [X, 0.62 + breath * 0.02]);
    pose.rotate('Spine', [X, 0.3]);
    pose.rotate('Chest', [X, 0.22 + breath * 0.03]);
    pose.rotate('Head', [X, -0.62]);
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      pose.rotate(`${side}UpLeg`, [X, -1.5], [Z, s * 0.35]);
      pose.rotate(`${side}Leg`, [X, 1.75]);
      pose.rotate(`${side}Foot`, [X, -0.35]);
      pose.rotate(`${side}Arm`, [Z, -s * (Math.PI / 2 - 0.5)], [X, -0.55]);
      pose.rotate(`${side}ForeArm`, [Y, -s * 1.15]);
    }
    pose.hipsY = rest - 0.42;
  });
}

/** Pick up and throw — the fielder's one job that reads at distance. */
export function createThrowClip(rig: HumanoidRig): AnimationClip {
  const rest = rig.bones.Hips.position.y;
  return buildClip(rig, 'cricket-throw', 1.0, 30, (p, pose: Pose) => {
    const wind = Math.min(1, p / 0.45);
    const rel = Math.max(0, (p - 0.45) / 0.55);
    pose.rotate('Hips', [Y, -0.5 * wind + 0.7 * rel]);
    pose.rotate('Spine', [Y, -0.6 * wind + 0.9 * rel], [X, 0.15]);
    pose.rotate('Chest', [Y, -0.4 * wind + 0.7 * rel]);
    pose.rotate('RightArm', [Z, Math.PI / 2 + 1.5 * wind - 2.6 * rel]);
    pose.rotate('RightForeArm', [Y, 1.2 * wind - 1.1 * rel]);
    pose.rotate('LeftArm', [Z, -Math.PI / 2 - 0.9 + 0.8 * rel]);
    pose.rotate('LeftUpLeg', [X, -0.6 * rel]);
    pose.rotate('RightUpLeg', [X, 0.4 * rel]);
    pose.hipsY = rest - 0.04;
  });
}

/**
 * Closed-form two-bone IK for an arm, in the arm's own parent space.
 *
 * A batter's hands are not a pose, they are a CONSTRAINT: both of them
 * are on the same handle in every frame of every stroke, and no amount of
 * per-bone tuning across seven strokes will keep them there. So the swing
 * path says where the hands go and this puts them there.
 *
 * `target` is in world space. The elbow bends about the forearm's own
 * hinge (local Y on this rig), and the upper arm is then aimed so the
 * wrist lands exactly on the target.
 */
function solveArmTo(
  rig: HumanoidRig,
  side: 'Left' | 'Right',
  target: Vector3,
  bend: number
): void {
  const upper = rig.bones[`${side}Arm`];
  const fore = rig.bones[`${side}ForeArm`];
  const hand = rig.bones[`${side}Hand`];
  const parent = upper.parent;
  if (!parent) return;
  parent.updateWorldMatrix(true, false);

  const l1 = fore.position.length();
  const l2 = hand.position.length();
  const t = SCRATCH_A.copy(target);
  parent.worldToLocal(t).sub(upper.position);
  let d = t.length();
  const max = (l1 + l2) * 0.999;
  const min = Math.abs(l1 - l2) * 1.001 + 1e-4;
  d = d > max ? max : d < min ? min : d;

  // The elbow angle is fixed by the distance alone — the triangle closes.
  const cos = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
  const interior = Math.acos(cos < -1 ? -1 : cos > 1 ? 1 : cos);
  fore.quaternion.setFromAxisAngle(HINGE, bend * (Math.PI - interior));

  // With that elbow, where does the wrist sit if the shoulder does
  // nothing? Rotate THAT onto the target and the wrist is on the mark.
  const wrist = SCRATCH_B.copy(hand.position)
    .applyQuaternion(fore.quaternion)
    .add(fore.position);
  SCRATCH_C.copy(wrist).normalize();
  SCRATCH_D.copy(t).normalize();
  upper.quaternion.setFromUnitVectors(SCRATCH_C, SCRATCH_D);
  upper.updateWorldMatrix(false, true);
}

const SCRATCH_A = new Vector3();
const SCRATCH_B = new Vector3();
const SCRATCH_C = new Vector3();
const SCRATCH_D = new Vector3();
const HINGE = new Vector3(0, 1, 0);
const UP = new Vector3(0, 1, 0);

export type CricketListener = (action: CricketAction) => void;

/**
 * A cricketer: one body that can bowl, bat, keep or field, and that
 * announces the two instants a game needs — the release and the contact.
 */
export class Cricketer {
  /** What they are doing, or null between actions. */
  action: CricketAction | null = null;

  private rig: HumanoidRig;
  private loco: Locomotion;
  private arm: 1 | -1;
  private bats: 1 | -1;
  private gripGap: number;
  private bat: Object3D | null = null;
  private batGrip = 0.7;
  private grip = new Vector3();
  private blade = new Vector3(0, -1, 0);
  private swing = { grip: new Vector3(), blade: new Vector3() };
  private world = new Vector3();
  private dir = new Vector3();
  private q = new Quaternion();
  private q2 = new Quaternion();
  private up = new Vector3();
  private clips = new Map<string, AnimationClip>();
  private current: AnimationAction | null = null;
  private phase = 0;
  private duration = 1;
  private fired = false;
  private holding = false;
  private releaseCbs = new Set<CricketListener>();
  private contactCbs = new Set<CricketListener>();
  private doneCbs = new Set<CricketListener>();

  constructor(rig: HumanoidRig, loco: Locomotion, options: CricketerOptions = {}) {
    this.rig = rig;
    this.loco = loco;
    this.arm = options.arm ?? 1;
    this.bats = options.bats ?? 1;
    this.gripGap = options.gripGap ?? 0.11;
  }

  /** How far through the current action, 0–1. */
  get progress(): number {
    return this.phase;
  }

  /** Fires the instant the ball leaves the hand. */
  onRelease(cb: CricketListener): () => void {
    this.releaseCbs.add(cb);
    return () => this.releaseCbs.delete(cb);
  }

  /** Fires at the point of contact of a stroke — whether or not it hits. */
  onContact(cb: CricketListener): () => void {
    this.contactCbs.add(cb);
    return () => this.contactCbs.delete(cb);
  }

  /** Fires when an action finishes and the body is free again. */
  onDone(cb: CricketListener): () => void {
    this.doneCbs.add(cb);
    return () => this.doneCbs.delete(cb);
  }

  private clipFor(action: CricketAction): AnimationClip {
    const key = action === 'bowl' ? `bowl${this.arm}` : action;
    let clip = this.clips.get(key);
    if (!clip) {
      clip =
        action === 'bowl'
          ? createBowlClip(this.rig, this.arm)
          : action === 'keep'
            ? createKeepClip(this.rig)
            : action === 'stance'
              ? createStanceClip(this.rig)
            : action === 'field'
              ? createThrowClip(this.rig)
              : createShotClip(this.rig, action);
      this.clips.set(key, clip);
    }
    return clip;
  }

  private begin(action: CricketAction, hold: boolean): void {
    if (this.current) this.loco.stopOverlay(this.current, 0.12);
    const clip = this.clipFor(action);
    this.current = this.loco.overlay(clip, { fadeIn: 0.12, weight: 8 });
    this.loco.influence = 0;
    this.action = action;
    this.duration = clip.duration;
    this.phase = 0;
    this.fired = false;
    this.holding = hold;
  }

  /** Run in and bowl. `onRelease` fires as the ball leaves the hand. */
  bowl(): void {
    this.begin('bowl', false);
  }

  /** Play a stroke. `onContact` fires at the point of contact. */
  play(shot: Shot): void {
    this.begin(shot, false);
  }

  /** Take up the keeper's crouch, and stay in it. */
  keep(): void {
    this.begin('keep', true);
  }

  /** Take guard and wait for the ball. Held, like the crouch. */
  stance(): void {
    this.begin('stance', true);
  }

  /** Gather and throw. */
  field(): void {
    this.begin('field', false);
  }

  /** Give the body back to `Locomotion`. */
  stand(): void {
    if (this.current) this.loco.stopOverlay(this.current, 0.2);
    this.current = null;
    this.loco.influence = 1;
    this.action = null;
    this.holding = false;
  }

  update(dt: number): void {
    if (!this.current || !this.action) return;
    this.phase += dt / this.duration;
    if (this.holding) {
      // A crouch loops; everything else is a one-shot.
      this.current.time = (this.phase % 1) * this.duration;
      return;
    }
    const cut = this.action === 'bowl' ? RELEASE_PHASE : CONTACT_PHASE;
    if (!this.fired && this.phase >= cut) {
      this.fired = true;
      const cbs = this.action === 'bowl' ? this.releaseCbs : this.contactCbs;
      for (const cb of cbs) cb(this.action);
    }
    if (this.phase >= 1) {
      const done = this.action;
      this.current.time = this.duration;
      this.stand();
      for (const cb of this.doneCbs) cb(done);
      return;
    }
    this.current.time = this.phase * this.duration;
  }

  /**
   * Hand a bat to the batter. It is driven from the two-hand grip every
   * `lateUpdate`, so nothing has to animate it and it can never drift out
   * of the hands.
   *
   * `grip` is how far along the object's own +Y the handle is — for a bat
   * modelled with its toe at the origin and the blade running up +Y (as
   * SCENA's `createBat` is), that is a little over the blade length.
   * The object is re-parented to the rig so it travels with the body.
   */
  holdBat(object: Object3D | null, options: { grip?: number } = {}): void {
    this.bat = object;
    this.batGrip = options.grip ?? 0.7;
    if (object) this.rig.object.add(object);
  }

  /**
   * Put the arms on the swing path and the bat in the hands.
   *
   * Call AFTER `Locomotion.update`, like `FootIK` — the clip has to have
   * been sampled before anything can be solved on top of it.
   */
  lateUpdate(): void {
    const shot = this.batting();
    if (!shot) return;
    const { object, bones } = this.rig;
    object.updateMatrixWorld(true);

    if (shot === 'stance') {
      this.grip.fromArray(STANCE_KEY.grip);
      this.blade.fromArray(STANCE_KEY.blade).normalize();
    } else {
      swingAt(shot, this.phase, this.rig.height, this.swing);
      this.grip.copy(this.swing.grip);
      this.blade.copy(this.swing.blade);
    }
    // A left-hander is the same stroke through the mirror.
    if (this.bats < 0) {
      this.grip.x = -this.grip.x;
      this.blade.x = -this.blade.x;
    }
    // Authored against the chest; solved in the world.
    const chest = bones.Chest;
    chest.updateWorldMatrix(true, false);
    chest.localToWorld(this.world.copy(this.grip));
    const top = this.bats > 0 ? 'Left' : 'Right';
    const bottom = this.bats > 0 ? 'Right' : 'Left';
    solveArmTo(this.rig, top, this.world, this.bats > 0 ? -1 : 1);
    // The bottom hand is a hand's width further down the same handle —
    // which is the whole point: both of them are ON the bat.
    chest.localToWorld(
      this.world.copy(this.grip).addScaledVector(this.blade, this.gripGap)
    );
    solveArmTo(this.rig, bottom, this.world, this.bats > 0 ? 1 : -1);

    if (this.bat) {
      // The bat is parented to the rig, but the grip was measured against
      // the chest — so both the point and the direction come back through
      // the chest's world transform and down into the rig's.
      chest.localToWorld(this.world.copy(this.grip));
      object.worldToLocal(this.world);
      object.getWorldQuaternion(this.q2).invert();
      this.dir
        .copy(this.blade)
        .applyQuaternion(chest.getWorldQuaternion(this.q))
        .applyQuaternion(this.q2)
        .normalize();
      // The bat's +Y runs toe→handle, so it points back UP the blade, and
      // its origin sits a grip-length down from the hands.
      this.bat.quaternion.setFromUnitVectors(UP, this.up.copy(this.dir).negate());
      this.bat.position.copy(this.world).addScaledVector(this.dir, this.batGrip);
    }
  }

  /** The stroke driving the arms, or null when something else is. */
  private batting(): Shot | 'stance' | null {
    const a = this.action;
    if (a === 'stance') return 'stance';
    return a && a !== 'bowl' && a !== 'keep' && a !== 'field' ? a : null;
  }

  /** Where the hands are on the handle, in world space. */
  gripPoint(out = new Vector3()): Vector3 {
    this.rig.object.updateWorldMatrix(true, true);
    return this.rig.bones.Chest.localToWorld(out.copy(this.grip));
  }

  /**
   * Where the middle of the bat is right now, in world space — the point
   * a game collides the ball against.
   */
  batPoint(out = new Vector3()): Vector3 {
    this.rig.object.updateWorldMatrix(true, true);
    return this.rig.bones.Chest.localToWorld(
      out.copy(this.grip).addScaledVector(this.blade, this.batGrip * 0.62)
    );
  }

  /** Where the bowling hand is right now — the ball's release point. */
  releasePoint(out = new Vector3()): Vector3 {
    this.rig.object.updateWorldMatrix(true, true);
    const hand = this.arm > 0 ? this.rig.bones.RightHand : this.rig.bones.LeftHand;
    return hand.getWorldPosition(out);
  }
}
