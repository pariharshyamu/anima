import { AnimationAction, AnimationClip, Quaternion, Vector3 } from 'three';
import { buildClip } from './clips';
import { maskClip } from './overlay';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

/**
 * Preparing food: the first **asymmetric two-handed** work in the library.
 *
 * Every existing loop is one-handed or symmetric — an axe, a pick, a saw, a
 * spoon, a guitar. Chopping an onion is neither. One hand works and the
 * other **holds the thing still and gets out of the way**, and that
 * asymmetry is the whole read: a cook using two identical hands is a cook
 * hammering an onion.
 *
 * Three things make it read, and only the first lives in the clip:
 *
 * 1. The two hands are doing **different motions**, not the same motion
 *    offset in time.
 * 2. The guide hand is **still** where it is bracing something (a mortar,
 *    a quern bed) and **moving** where it is feeding something (a board).
 * 3. The feed **retreats across cycles** — the left hand walks backwards
 *    along the vegetable a few millimetres per cut, then resets to a new
 *    piece. That spans many cycles, so it cannot live in a one-second loop;
 *    the controller owns it, exactly as the swimmer's body roll does.
 *
 * ```ts
 * const prep = new Prepping(rig, loco);
 * prep.do('chopBoard');
 * game.onUpdate((t) => { loco.update(t.delta, 0); prep.update(t.delta); });
 * ```
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/**
 * Masked overlays blend against idle by NORMALISED weight, so at weight 1
 * every arm only reaches half way. Same value as the wash poses, for the
 * same reason.
 */
const POSE_WEIGHT = 6;

const UPPER: BoneName[] = [
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
];

export type PrepTask =
  /** Knife on a board: lift and fall, and the other hand feeds. */
  | 'chopBoard'
  /** Mortar and pestle: one hand circles, the other BRACES and is still. */
  | 'grind'
  /** A quern crank: one hand sweeps a wide circle, the other steadies. */
  | 'crank'
  /** Dough: both hands push, half a cycle apart. */
  | 'knead'
  /** A whisk: one hand circles fast, the other tips the bowl. */
  | 'whisk';

interface TaskSpec {
  /** Seconds per cycle. */
  cycle: number;
  /**
   * How far the guide hand walks back per cycle, in radians of arm swing.
   * Zero for anything the guide hand is bracing rather than feeding.
   */
  feed: number;
  /** Cycles before the feed resets — a new piece on the board. */
  feedFor: number;
}

const TASKS: Record<PrepTask, TaskSpec> = {
  chopBoard: { cycle: 0.55, feed: 0.035, feedFor: 7 },
  grind: { cycle: 1.1, feed: 0, feedFor: 1 },
  crank: { cycle: 1.6, feed: 0, feedFor: 1 },
  knead: { cycle: 1.5, feed: 0, feedFor: 1 },
  whisk: { cycle: 0.8, feed: 0, feedFor: 1 },
};

/**
 * Measured baseline for working at a bench.
 *
 * Probed, not guessed. Arm Z is the counter-intuitive one the wash pose
 * turned on: **raising it brings the hands TOGETHER**, it does not lift
 * them. At 1.42 the hands sit half a metre apart — a cook with one hand at
 * each end of the board, which is what the first render showed. At 1.88 the
 * gap is 27 cm and both hands are over the work, still at 1.09 m and 0.35 m
 * in front, which is a worktop.
 */
const REACH_Z = 1.88;
const REACH_Y = 0.5;
const ELBOW = 1.08;

/** Build the limb loop for one task. `hand` is the working hand. */
export function createPrepClip(
  rig: HumanoidRig,
  task: PrepTask,
  hand: 'Left' | 'Right' = 'Right'
): AnimationClip {
  const spec = TASKS[task];
  const other = hand === 'Left' ? 'Right' : 'Left';
  const w = hand === 'Left' ? 1 : -1;
  const g = other === 'Left' ? 1 : -1;

  const clip = buildClip(rig, `prep-${task}-${hand}`, spec.cycle, 34, (p, pose) => {
    // ---- the working hand -------------------------------------------
    if (task === 'chopBoard') {
      // Slow lift, fast fall. A knife that floats down is a knife in a lift,
      // and the asymmetry of the beat is most of what says "chopping".
      const lift = p < 0.62 ? Math.sin((Math.PI / 2) * (p / 0.62)) : Math.max(0, 1 - (p - 0.62) / 0.16);
      pose.rotate(`${hand}Arm` as BoneName, [Z, -w * (REACH_Z - lift * 0.16)], [Y, -w * (REACH_Y + 0.05)]);
      pose.rotate(`${hand}ForeArm` as BoneName, [Y, -w * (ELBOW + lift * 0.42)]);
      pose.rotate(`${hand}Hand` as BoneName, [X, -0.1 - lift * 0.3]);
    } else if (task === 'grind' || task === 'whisk') {
      const fast = task === 'whisk' ? 2 : 1;
      const a = TAU * p * fast;
      pose.rotate(
        `${hand}Arm` as BoneName,
        [Z, -w * (REACH_Z + Math.sin(a) * 0.07)],
        [Y, -w * (REACH_Y + Math.cos(a) * 0.1)]
      );
      pose.rotate(`${hand}ForeArm` as BoneName, [Y, -w * (ELBOW + Math.sin(a) * 0.16)]);
      pose.rotate(`${hand}Hand` as BoneName, [X, -0.15], [Z, w * Math.cos(a) * 0.25]);
    } else if (task === 'crank') {
      // A wide sweep, because a quern handle is a long way from the centre.
      const a = TAU * p;
      pose.rotate(
        `${hand}Arm` as BoneName,
        [Z, -w * (REACH_Z + Math.sin(a) * 0.2)],
        [Y, -w * (REACH_Y + Math.cos(a) * 0.34)]
      );
      pose.rotate(`${hand}ForeArm` as BoneName, [Y, -w * (ELBOW + Math.sin(a) * 0.3)]);
      pose.rotate(`${hand}Hand` as BoneName, [X, -0.2]);
    } else {
      // knead: push away and draw back, leaning through the heel of the hand.
      const push = Math.sin(TAU * p);
      pose.rotate(`${hand}Arm` as BoneName, [Z, -w * REACH_Z], [Y, -w * (REACH_Y + push * 0.26)]);
      pose.rotate(`${hand}ForeArm` as BoneName, [Y, -w * (ELBOW - push * 0.3)]);
      pose.rotate(`${hand}Hand` as BoneName, [X, 0.2 + push * 0.2]);
    }

    // ---- the guide hand ---------------------------------------------
    if (task === 'grind' || task === 'crank') {
      // BRACED, and therefore still. A mortar nobody is holding down slides
      // across the bench, and a guide hand that drifts is not holding it.
      pose.rotate(`${other}Arm` as BoneName, [Z, -g * (REACH_Z - 0.12)], [Y, -g * (REACH_Y - 0.16)]);
      pose.rotate(`${other}ForeArm` as BoneName, [Y, -g * (ELBOW - 0.1)]);
      pose.rotate(`${other}Hand` as BoneName, [X, 0.1]);
    } else if (task === 'knead') {
      // Half a cycle out of phase: at any instant one hand is pushing and
      // the other is drawing back. Both hands doing the same thing at the
      // same time is a press, not kneading.
      const push = Math.sin(TAU * p + Math.PI);
      pose.rotate(`${other}Arm` as BoneName, [Z, -g * REACH_Z], [Y, -g * (REACH_Y + push * 0.26)]);
      pose.rotate(`${other}ForeArm` as BoneName, [Y, -g * (ELBOW - push * 0.3)]);
      pose.rotate(`${other}Hand` as BoneName, [X, 0.2 + push * 0.2]);
    } else if (task === 'whisk') {
      // Tipping the bowl toward you and holding it there.
      // Raising Z brings the hands TOGETHER rather than up, so holding the
      // bowl low pushed this hand out past a shoulder width.
      pose.rotate(`${other}Arm` as BoneName, [Z, -g * (REACH_Z - 0.04)], [Y, -g * (REACH_Y - 0.06)]);
      pose.rotate(`${other}ForeArm` as BoneName, [Y, -g * (ELBOW - 0.14)]);
      pose.rotate(`${other}Hand` as BoneName, [X, 0.42], [Z, -g * 0.3]);
    } else {
      // Feeding the board: fingers tucked back, and a small flinch away from
      // the blade on each fall. The walk backwards is the controller's.
      const flinch = p > 0.62 ? Math.max(0, 1 - (p - 0.62) / 0.2) : 0;
      pose.rotate(
        `${other}Arm` as BoneName,
        [Z, -g * (REACH_Z - 0.06)],
        [Y, -g * (REACH_Y - 0.02 - flinch * 0.04)]
      );
      pose.rotate(`${other}ForeArm` as BoneName, [Y, -g * (ELBOW - 0.06)]);
      pose.rotate(`${other}Hand` as BoneName, [X, 0.34]);
    }

    // Over the work, looking at their hands.
    pose.rotate('Spine', [X, 0.08]);
    pose.rotate('Chest', [X, 0.16]);
    pose.rotate('Neck', [X, 0.26]);
    pose.rotate('Head', [X, 0.22]);
  });
  return maskClip(clip, UPPER);
}

export interface PreppingOptions {
  /** Which hand does the work. Default 'Right'. */
  hand?: 'Left' | 'Right';
  /** Speed multiplier. Default 1. */
  pace?: number;
}

export class Prepping {
  /** Speed multiplier. Live-editable. */
  pace: number;

  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private readonly hand: 'Left' | 'Right';
  private readonly clips = new Map<string, AnimationClip>();
  private action: AnimationAction | null = null;
  private current: PrepTask | null = null;
  /** How far the guide hand has walked back, 0–1 across a batch. */
  private fed = 0;
  private cycles = 0;
  private phase = 0;
  private readonly tweak = new Quaternion();

  constructor(rig: HumanoidRig, loco: Locomotion, options: PreppingOptions = {}) {
    this.rig = rig;
    this.loco = loco;
    this.hand = options.hand ?? 'Right';
    this.pace = options.pace ?? 1;
  }

  get task(): PrepTask | null {
    return this.current;
  }

  /** How far through the current piece the feed hand has walked, 0–1. */
  get feed(): number {
    return this.fed;
  }

  /** Completed work cycles — one chop, one turn of the quern, one push. */
  get count(): number {
    return this.cycles;
  }

  do(task: PrepTask, fade = 0.25): void {
    if (this.current === task) return;
    this.current = task;
    this.fed = 0;
    this.phase = 0;
    const id = `${task}-${this.hand}`;
    let clip = this.clips.get(id);
    if (!clip) {
      clip = createPrepClip(this.rig, task, this.hand);
      this.clips.set(id, clip);
    }
    if (this.action) this.loco.stopOverlay(this.action, fade);
    this.action = this.loco.overlay(clip, { fadeIn: fade, weight: POSE_WEIGHT });
  }

  stop(fade = 0.3): void {
    this.current = null;
    if (this.action) {
      this.loco.stopOverlay(this.action, fade);
      this.action = null;
    }
  }

  /**
   * Call AFTER `loco.update`, because the feed is applied on top of the
   * mixer's result. A retreat that spans seven cuts cannot live inside a
   * half-second loop, so the controller owns it — the same division the
   * swimmer's body roll uses.
   */
  update(dt: number): void {
    if (dt <= 0 || this.current === null) return;
    const spec = TASKS[this.current];
    if (this.action) this.action.timeScale = this.pace;
    const was = this.phase;
    this.phase = (this.phase + (dt * this.pace) / spec.cycle) % 1;
    if (this.phase < was) {
      this.cycles += 1;
      if (spec.feed > 0) {
        // A new piece: the hand goes back to the start of it.
        this.fed = this.cycles % spec.feedFor === 0 ? 0 : clamp01(this.fed + 1 / spec.feedFor);
      }
    }
    if (spec.feed <= 0) return;

    // Walk the guide hand backwards along the work. Applied to the bone the
    // mixer has already posed, so it reads as a small steady retreat on top
    // of the loop rather than a fight with it.
    const guide = this.hand === 'Left' ? 'RightArm' : 'LeftArm';
    const g = guide.startsWith('Left') ? 1 : -1;
    const bone = this.rig.bones[guide as BoneName];
    this.tweak.setFromAxisAngle(Y, g * spec.feed * this.fed * spec.feedFor);
    // PRE-multiply. Post-multiplying applies the rotation about the bone's
    // OWN rotated axis, and a posed arm lies roughly along its own y, so the
    // whole retreat came out as the arm spinning about its length: 1.4 cm of
    // hand travel where there should have been ten. Same family as `Arm` X
    // doing nothing at all in the swim rig.
    bone.quaternion.premultiply(this.tweak);
  }
}
