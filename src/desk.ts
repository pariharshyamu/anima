import { AnimationAction, AnimationClip, Vector3 } from 'three';
import { buildClip } from './clips';
import { maskClip } from './overlay';
import { Rng } from './core/random';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

/**
 * Working at a desk.
 *
 * Sitting is already solved, and so is holding a phone in two hands. Neither
 * covers a keyboard, which is a different shape entirely: the forearms come
 * *forward* onto a surface rather than up in front of the chest, the wrists
 * stay low, and the head is only slightly down because the screen is at eye
 * height and the hands are not what you are looking at.
 *
 * ```ts
 * const desk = new DeskWork(rig, loco);
 * desk.do('type');
 * game.onUpdate((t) => { loco.update(t.delta, 0); desk.update(t.delta); });
 * ```
 *
 * These are upper-body masks over whatever the legs are doing, so they
 * compose with a seated pose from `Interaction` exactly the way the phone
 * poses compose with a walk.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;

/**
 * Masked pose overlays run against the idle clip, and three blends by
 * NORMALISED weight — at weight 1 the result is a 50/50 average and every arm
 * reaches half way. These are replacement postures, so they have to dominate.
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

export type DeskTask =
  /** Both hands on the keyboard, wrists working. */
  | 'type'
  /** One hand on the mouse, the other resting. */
  | 'mouse'
  /** Hands off, sat back a little, reading the screen. */
  | 'read'
  /** Right back in the chair, hands down — the thinking pause. */
  | 'think';

export interface DeskWorkOptions {
  /** Which hand takes the mouse. Default 'Right'. */
  hand?: 'Left' | 'Right';
  /** Keystrokes per second while typing. Default 5.5. */
  rate?: number;
  seed?: number;
}

/**
 * Build a desk posture.
 *
 * The rig has no fingers, so typing is carried entirely by the wrists and a
 * little forearm — which is all that reads at any distance you would film a
 * desk from, and is the same constraint the phone poses work under.
 */
export function createDeskClip(
  rig: HumanoidRig,
  task: DeskTask,
  hand: 'Left' | 'Right' = 'Right',
  rate = 5.5
): AnimationClip {
  if (task === 'type') {
    // A cycle long enough to hold several strokes, so the hands do not fall
    // into an obvious two-frame flutter.
    const duration = 8 / rate;
    // 60 fps, not 30. Eight strokes in this cycle means one lands every ~5
    // frames at 30, and a strike lasting a third of that is captured in two
    // keyframes and smoothed away by interpolation — the hands came out
    // moving together because neither one's stroke actually survived
    // sampling.
    const clip = buildClip(rig, 'desk-type', duration, 60, (p, pose) => {
      for (const side of ['Left', 'Right'] as const) {
        const k = side === 'Left' ? 1 : -1;
        // Strokes alternate hands and are not evenly spaced: a burst, then a
        // pause. Even keystrokes read as a machine, which is what typing
        // animated on a sine wave always looks like.
        const beat = (p * 8 + (side === 'Left' ? 0 : 0.5)) % 1;
        const strike = beat < 0.34 ? Math.sin((beat / 0.34) * Math.PI) : 0;
        // Forearms forward and low, elbows in near the ribs.
        pose.rotate(`${side}Arm` as BoneName, [Z, -k * 1.28], [Y, -k * 0.52]);
        // The strike has to reach the FOREARM. A wrist rotation alone cannot
        // move the hand at all — a bone's own rotation does not shift its
        // origin — so a keystroke carried purely by the wrist is invisible
        // however hard it is animated.
        pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * (1.42 + strike * 0.09)]);
        pose.rotate(`${side}Hand` as BoneName, [X, 0.12 + strike * 0.3], [Z, -k * 0.08]);
      }
      // Barely down. A keyboard is not a phone — the eyes are on the screen,
      // which is at eye height, so the head-down of the phone lean is wrong.
      pose.rotate('Chest', [X, 0.09]);
      pose.rotate('Neck', [X, 0.1]);
      pose.rotate('Head', [X, 0.12]);
    });
    return maskClip(clip, UPPER);
  }

  if (task === 'mouse') {
    const s = hand === 'Left' ? 1 : -1;
    const other = hand === 'Left' ? 'Right' : 'Left';
    const o = other === 'Left' ? 1 : -1;
    const clip = buildClip(rig, `desk-mouse-${hand}`, 5.5, 30, (p, pose) => {
      // Small drifting movements with pauses — a hand on a mouse is mostly
      // still, then travels.
      const drift = Math.sin(TAU * p) * Math.max(0, Math.sin(TAU * p * 0.5));
      // Out to the SIDE, not further forward: a mouse sits beside the
      // keyboard. Swinging the arm forward (which is what this did first)
      // leaves the hand hovering over the keys it just left.
      pose.rotate(`${hand}Arm` as BoneName, [Z, -s * 1.06], [Y, -s * (0.6 + drift * 0.07)]);
      pose.rotate(`${hand}ForeArm` as BoneName, [Y, -s * 1.12], [Z, s * 0.42]);
      pose.rotate(`${hand}Hand` as BoneName, [X, 0.16]);
      // The other hand stays on the keyboard, because it always does.
      pose.rotate(`${other}Arm` as BoneName, [Z, -o * 1.28], [Y, -o * 0.5]);
      pose.rotate(`${other}ForeArm` as BoneName, [Y, -o * 1.4]);
      pose.rotate(`${other}Hand` as BoneName, [X, 0.12]);
      pose.rotate('Chest', [X, 0.08]);
      pose.rotate('Neck', [X, 0.09]);
      pose.rotate('Head', [X, 0.11]);
    });
    return maskClip(clip, UPPER);
  }

  if (task === 'read') {
    const clip = buildClip(rig, 'desk-read', 6.5, 30, (p, pose) => {
      const breath = Math.sin(TAU * p) * 0.014;
      // Hands come off and rest low; the body settles back a touch.
      for (const side of ['Left', 'Right'] as const) {
        const k = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}Arm` as BoneName, [Z, -k * 1.36], [Y, -k * 0.3]);
        pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * 1.1]);
      }
      pose.rotate('Chest', [X, -0.03 + breath]);
      pose.rotate('Neck', [X, 0.06]);
      pose.rotate('Head', [X, 0.04]);
    });
    return maskClip(clip, UPPER);
  }

  // think — back in the chair, chin up, hands out of it entirely.
  const clip = buildClip(rig, 'desk-think', 7.5, 30, (p, pose) => {
    const breath = Math.sin(TAU * p) * 0.02;
    for (const side of ['Left', 'Right'] as const) {
      const k = side === 'Left' ? 1 : -1;
      pose.rotate(`${side}Arm` as BoneName, [Z, -k * 1.44], [Y, -k * 0.12]);
      pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * 0.55]);
    }
    pose.rotate('Chest', [X, -0.14 + breath]);
    pose.rotate('Neck', [X, -0.06]);
    pose.rotate('Head', [X, -0.1]);
  });
  return maskClip(clip, UPPER);
}

export class DeskWork {
  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private readonly hand: 'Left' | 'Right';
  private readonly rate: number;
  private readonly rng: Rng;
  private readonly clips = new Map<string, AnimationClip>();
  private action: AnimationAction | null = null;
  private current: DeskTask | null = null;
  /** Seconds until the next unprompted change of task. */
  private drift = 0;

  constructor(rig: HumanoidRig, loco: Locomotion, options: DeskWorkOptions = {}) {
    this.rig = rig;
    this.loco = loco;
    this.hand = options.hand ?? 'Right';
    this.rate = options.rate ?? 5.5;
    this.rng = new Rng(options.seed ?? 1);
    this.drift = this.nextDrift();
  }

  /** What they are doing, or null. */
  get task(): DeskTask | null {
    return this.current;
  }

  /** Adopt a task. */
  do(task: DeskTask, fade = 0.32): void {
    if (this.current === task) return;
    this.current = task;
    const id = `${task}-${this.hand}`;
    let clip = this.clips.get(id);
    if (!clip) {
      clip = createDeskClip(this.rig, task, this.hand, this.rate);
      this.clips.set(id, clip);
    }
    if (this.action) this.loco.stopOverlay(this.action, fade);
    this.action = this.loco.overlay(clip, { fadeIn: fade, weight: POSE_WEIGHT });
    this.drift = this.nextDrift();
  }

  /** Stop working; the arms go back to whatever the base pose has them doing. */
  stop(fade = 0.35): void {
    this.current = null;
    if (this.action) {
      this.loco.stopOverlay(this.action, fade);
      this.action = null;
    }
  }

  /**
   * Let them wander between tasks on their own — type for a while, reach for
   * the mouse, sit back and read. Nobody types continuously for ten minutes,
   * and a character who does is the clearest possible tell.
   */
  update(dt: number): void {
    if (dt <= 0 || this.current === null) return;
    this.drift -= dt;
    if (this.drift <= 0) this.do(this.pick());
  }

  private pick(): DeskTask {
    // Weighted toward typing, but never twice the same in a row.
    const pool: DeskTask[] = ['type', 'type', 'type', 'mouse', 'mouse', 'read', 'think'];
    const options = pool.filter((t) => t !== this.current);
    return options[Math.min(options.length - 1, Math.floor(this.rng.next() * options.length))];
  }

  private nextDrift(): number {
    // Long-tailed: mostly short stints, occasionally a proper stretch of work.
    return 3 + -Math.log(1 - this.rng.next() * 0.95) * 5;
  }
}
