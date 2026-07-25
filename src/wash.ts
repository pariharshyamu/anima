import { AnimationAction, AnimationClip, Vector3 } from 'three';
import { buildClip } from './clips';
import { maskClip } from './overlay';
import { Rng } from './core/random';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

/**
 * Washing at a basin.
 *
 * `DeskWork` looks close and is not: at a desk the forearms come *forward*
 * onto a surface at elbow height with the head near level, because the
 * screen is at eye height. At a basin the hands go **down and together**
 * into a bowl below the elbows, the shoulders round forward over it, and the
 * head genuinely drops — you are looking at your hands, which is the one
 * thing a desk pose is careful not to do.
 *
 * ```ts
 * const wash = new Washing(rig, loco);
 * wash.do('scrub');
 * game.onUpdate((t) => { loco.update(t.delta, 0); wash.update(t.delta); });
 * ```
 *
 * Upper-body masks, so they compose over a stand or a lean exactly the way
 * the phone and desk poses do.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;

/**
 * Masked overlays run against the idle clip and three blends by NORMALISED
 * weight, so at weight 1 the result is a 50/50 average and every arm only
 * reaches half way. These are replacement postures and have to dominate.
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

export type WashTask =
  /** Both hands in the water, rubbing together. */
  | 'scrub'
  /** Cupping water up toward the face. */
  | 'rinse'
  /** One hand out to the tap, the other still in the bowl. */
  | 'tap'
  /** Hands out, shaking off, head still down. */
  | 'dry';

export interface WashingOptions {
  /** Which hand reaches for the tap. Default 'Right'. */
  hand?: 'Left' | 'Right';
  /** Scrubs per second. Default 2.2. */
  rate?: number;
  seed?: number;
}

/**
 * Build a washing posture.
 *
 * The rig has no fingers, so everything is carried by where the forearms
 * point and how the wrists turn — the same constraint the desk and phone
 * poses work under, and at the size a basin is filmed from it is all that
 * survives anyway.
 */
export function createWashClip(
  rig: HumanoidRig,
  task: WashTask,
  hand: 'Left' | 'Right' = 'Right',
  rate = 2.2
): AnimationClip {
  if (task === 'scrub') {
    const duration = 4 / rate;
    const clip = buildClip(rig, 'wash-scrub', duration, 40, (p, pose) => {
      // Hands circle around each other rather than pistoning: rubbing is a
      // rotary motion, and a linear one reads as kneading dough.
      const a = TAU * p * 2;
      for (const side of ['Left', 'Right'] as const) {
        const k = side === 'Left' ? 1 : -1;
        const swirl = Math.sin(a + (side === 'Left' ? 0 : Math.PI));
        const lift = Math.cos(a + (side === 'Left' ? 0 : Math.PI));
        // Measured on the rig, not assumed, because both axes read the
        // opposite of the intuition: arm Z controls how far the hands are
        // APART (1.05 gives a 69 cm gap, 1.45 gives 42 cm), and it is LESS
        // forearm bend that drops the hand below the elbow, not more. The
        // first version used the widest, highest combination of both.
        pose.rotate(`${side}Arm` as BoneName, [Z, -k * 1.45], [Y, -k * (0.44 + swirl * 0.05)]);
        pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * (0.9 + lift * 0.08)]);
        pose.rotate(`${side}Hand` as BoneName, [X, 0.34 + swirl * 0.16], [Z, -k * 0.2]);
      }
      // Shoulders round forward over the bowl and the head really does drop —
      // you are looking at your hands, which is exactly what the desk pose is
      // careful NOT to do.
      pose.rotate('Spine', [X, 0.1]);
      pose.rotate('Chest', [X, 0.24]);
      pose.rotate('Neck', [X, 0.3]);
      pose.rotate('Head', [X, 0.26]);
    });
    return maskClip(clip, UPPER);
  }

  if (task === 'rinse') {
    const clip = buildClip(rig, 'wash-rinse', 3.4, 40, (p, pose) => {
      // A slow cycle: cup down into the water, lift to the face, back down.
      const cycle = Math.sin(TAU * p);
      const up = Math.max(0, cycle);
      for (const side of ['Left', 'Right'] as const) {
        const k = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}Arm` as BoneName, [Z, -k * (1.46 - up * 0.05)], [Y, -k * (0.42 + up * 0.12)]);
        // More bend lifts the hand toward the face, which is the cupping.
        pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * (0.88 + up * 0.5)]);
        // Palms turn UP to hold water on the way to the face, and tip back
        // over on the way down. Cupped hands that never turn are just hands.
        pose.rotate(`${side}Hand` as BoneName, [X, 0.5 - up * 0.24], [Z, -k * (0.24 + up * 0.2)]);
      }
      pose.rotate('Spine', [X, 0.12 - up * 0.05]);
      pose.rotate('Chest', [X, 0.26 - up * 0.08]);
      pose.rotate('Neck', [X, 0.32 - up * 0.14]);
      pose.rotate('Head', [X, 0.3 - up * 0.2]);
    });
    return maskClip(clip, UPPER);
  }

  if (task === 'tap') {
    const s = hand === 'Left' ? 1 : -1;
    const other = hand === 'Left' ? 'Right' : 'Left';
    const o = other === 'Left' ? 1 : -1;
    const clip = buildClip(rig, `wash-tap-${hand}`, 3.6, 30, (p, pose) => {
      // Reach out and up to the tap, turn, come back. The reach is a real
      // extension — a hand that stays over the bowl is not operating a tap.
      const reach = Math.max(0, Math.sin(TAU * p));
      const turn = Math.sin(TAU * p * 3) * reach;
      // Reaching straightens the arm: less forearm bend is a longer reach.
      pose.rotate(`${hand}Arm` as BoneName, [Z, -s * (1.44 - reach * 0.16)], [Y, -s * (0.44 + reach * 0.4)]);
      pose.rotate(`${hand}ForeArm` as BoneName, [Y, -s * (0.9 - reach * 0.55)]);
      pose.rotate(`${hand}Hand` as BoneName, [X, 0.3 - reach * 0.34], [Y, turn * 0.34]);
      // The other hand stays in the water, because it does.
      pose.rotate(`${other}Arm` as BoneName, [Z, -o * 1.45], [Y, -o * 0.44]);
      pose.rotate(`${other}ForeArm` as BoneName, [Y, -o * 0.9]);
      pose.rotate(`${other}Hand` as BoneName, [X, 0.34], [Z, -o * 0.2]);
      pose.rotate('Spine', [X, 0.1]);
      pose.rotate('Chest', [X, 0.22 - reach * 0.06]);
      pose.rotate('Neck', [X, 0.28 - reach * 0.1]);
      pose.rotate('Head', [X, 0.24 - reach * 0.12]);
    });
    return maskClip(clip, UPPER);
  }

  // dry — hands out of the water, shaken off, head still down.
  const clip = buildClip(rig, 'wash-dry', 2.6, 40, (p, pose) => {
    const shake = Math.sin(TAU * p * 4) * Math.max(0, Math.sin(TAU * p));
    for (const side of ['Left', 'Right'] as const) {
      const k = side === 'Left' ? 1 : -1;
      pose.rotate(`${side}Arm` as BoneName, [Z, -k * 1.42], [Y, -k * 0.5]);
      pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * (1.02 + shake * 0.12)]);
      // The shake has to reach the FOREARM. A bone's own rotation does not
      // move its own origin, so a flick animated purely on the wrist moves
      // the hand not at all.
      pose.rotate(`${side}Hand` as BoneName, [X, 0.16 + shake * 0.34], [Z, -k * 0.12]);
    }
    pose.rotate('Spine', [X, 0.08]);
    pose.rotate('Chest', [X, 0.18]);
    pose.rotate('Neck', [X, 0.24]);
    pose.rotate('Head', [X, 0.2]);
  });
  return maskClip(clip, UPPER);
}

export class Washing {
  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private readonly hand: 'Left' | 'Right';
  private readonly rate: number;
  private readonly rng: Rng;
  private readonly clips = new Map<string, AnimationClip>();
  private action: AnimationAction | null = null;
  private current: WashTask | null = null;
  /** Seconds until the next unprompted change of task. */
  private drift = 0;

  constructor(rig: HumanoidRig, loco: Locomotion, options: WashingOptions = {}) {
    this.rig = rig;
    this.loco = loco;
    this.hand = options.hand ?? 'Right';
    this.rate = options.rate ?? 2.2;
    this.rng = new Rng(options.seed ?? 1);
    this.drift = this.nextDrift();
  }

  get task(): WashTask | null {
    return this.current;
  }

  /** Adopt a task. */
  do(task: WashTask, fade = 0.3): void {
    if (this.current === task) return;
    this.current = task;
    const id = `${task}-${this.hand}`;
    let clip = this.clips.get(id);
    if (!clip) {
      clip = createWashClip(this.rig, task, this.hand, this.rate);
      this.clips.set(id, clip);
    }
    if (this.action) this.loco.stopOverlay(this.action, fade);
    this.action = this.loco.overlay(clip, { fadeIn: fade, weight: POSE_WEIGHT });
    this.drift = this.nextDrift();
  }

  /** Stop; the arms go back to whatever the base pose has them doing. */
  stop(fade = 0.32): void {
    this.current = null;
    if (this.action) {
      this.loco.stopOverlay(this.action, fade);
      this.action = null;
    }
  }

  /**
   * Let them work through it on their own: reach for the tap, scrub, rinse,
   * shake off. Washing has an *order* to it, unlike desk work — you do not
   * rinse before you scrub — so this walks a sequence rather than picking at
   * random.
   */
  update(dt: number): void {
    if (dt <= 0 || this.current === null) return;
    this.drift -= dt;
    if (this.drift <= 0) this.do(this.next());
  }

  private next(): WashTask {
    // No repeats in the order. A duplicated entry lets `next` return the
    // task already running, `do` early-returns without resetting the drift,
    // and the sequence stalls there forever retrying every frame.
    const order: WashTask[] = ['tap', 'scrub', 'rinse', 'dry'];
    const at = order.indexOf(this.current ?? 'tap');
    return order[(at + 1) % order.length];
  }

  /** Scrubbing takes longer than the rest of it, because it does. */
  private nextDrift(): number {
    const base = this.current === 'scrub' ? 4.5 : 2.2;
    return base + this.rng.next() * 2.2;
  }
}
