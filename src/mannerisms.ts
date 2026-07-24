import {
  AnimationClip,
  AnimationUtils,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
} from 'three';
import type { AnimationAction } from 'three';
import type { HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** One bone's contribution to a mannerism: axis-angle steps, as in `Pose`. */
type Turn = [Vector3, number];
type Shape = Record<string, Turn[]>;

export type MannerismName =
  | 'weightShift'
  | 'shoulderRoll'
  | 'headTurn'
  | 'scratch'
  | 'stretch'
  | 'leanBack'
  | 'leanIn'
  | 'fidget';

/** Which repertoire to draw from — people fidget differently sitting down. */
export type MannerismContext = 'standing' | 'seated';

const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/** A quick in-and-out — a glance, a scratch. */
const bell = (w: number): number => smooth(clamp01(w / 0.3)) * smooth(clamp01((1 - w) / 0.35));
/** In, stay a while, out — a weight shift, a lean. These *persist*. */
const hold = (w: number): number => smooth(clamp01(w / 0.18)) * smooth(clamp01((1 - w) / 0.22));

/**
 * Sample a shape into an ADDITIVE one-shot clip: deltas from the neutral
 * first frame, so it layers over a walk, an idle or a held sit without
 * fighting whatever those are already doing to the same bones.
 */
function buildAdditive(
  name: string,
  duration: number,
  envelope: (w: number) => number,
  sample: (amp: number, w: number) => Shape
): AnimationClip {
  const fps = 24;
  const frames = Math.max(6, Math.round(duration * fps));
  const times = new Float32Array(frames + 1);
  const bones = Object.keys(sample(0, 0));
  const values = new Map(bones.map((b) => [b, new Float32Array((frames + 1) * 4)]));
  const q = new Quaternion();
  const step = new Quaternion();

  for (let i = 0; i <= frames; i++) {
    const w = i / frames;
    times[i] = (i * duration) / frames;
    const shape = sample(envelope(w), w);
    for (const bone of bones) {
      q.identity();
      for (const [axis, angle] of shape[bone] ?? []) q.multiply(step.setFromAxisAngle(axis, angle));
      values.get(bone)!.set([q.x, q.y, q.z, q.w], i * 4);
    }
  }

  const clip = new AnimationClip(
    name,
    duration,
    bones.map(
      (bone) =>
        new QuaternionKeyframeTrack(
          `${bone}.quaternion`,
          times as unknown as number[],
          values.get(bone)! as unknown as number[]
        )
    )
  );
  return AnimationUtils.makeClipAdditive(clip);
}

interface Recipe {
  duration: [number, number];
  envelope: (w: number) => number;
  /** `s` is +1 or −1: which side this one happens on. */
  shape: (amp: number, w: number, s: number) => Shape;
}

/**
 * The repertoire. Each is small — a few centimetres of bone rotation —
 * because that is the scale real idle motion happens at. Anything you can
 * clearly *see* as a gesture is already too big to repeat every few seconds.
 */
const RECIPES: Record<MannerismName, Recipe> = {
  // Standing on two legs is tiring; people unload one hip, then the other.
  weightShift: {
    duration: [3.2, 5.5],
    envelope: hold,
    shape: (a, _w, s) => ({
      Hips: [[Z, a * s * 0.07], [Y, a * s * 0.05]],
      Spine: [[Z, -a * s * 0.05]],
      Chest: [[Z, -a * s * 0.03]],
      Head: [[Z, a * s * 0.02]],
    }),
  },
  shoulderRoll: {
    duration: [1.4, 2.1],
    envelope: bell,
    shape: (a, w) => {
      const roll = a * Math.sin(w * Math.PI * 2) * 0.5 + a * 0.5;
      return {
        LeftShoulder: [[Z, -roll * 0.16], [X, -roll * 0.1]],
        RightShoulder: [[Z, roll * 0.16], [X, -roll * 0.1]],
        Chest: [[X, -a * 0.05]],
      };
    },
  },
  // The eyes go first and the head follows — a glance at nothing in particular.
  headTurn: {
    duration: [1.6, 2.8],
    envelope: bell,
    shape: (a, _w, s) => ({
      Head: [[Y, a * s * 0.42], [X, a * 0.05]],
      Neck: [[Y, a * s * 0.18]],
    }),
  },
  scratch: {
    duration: [1.9, 2.6],
    envelope: bell,
    shape: (a, w, s) => {
      const side = s > 0 ? 'Right' : 'Left';
      const rub = Math.sin(w * Math.PI * 6) * a * 0.09;
      return {
        [`${side}Arm`]: [[Z, -s * a * 1.15]],
        [`${side}ForeArm`]: [[Y, s * (a * 1.05 + rub)], [X, -a * 0.35]],
        Head: [[Z, -s * a * 0.06], [X, a * 0.07]],
      };
    },
  },
  stretch: {
    duration: [2.2, 3.0],
    envelope: bell,
    shape: (a, _w, s) => ({
      Head: [[Z, a * s * 0.2], [X, -a * 0.12]],
      Neck: [[Z, a * s * 0.1]],
      Chest: [[X, -a * 0.07]],
    }),
  },
  // Seated: settling back into the chair, and coming forward onto the table.
  leanBack: {
    duration: [3.5, 6.0],
    envelope: hold,
    shape: (a) => ({
      Spine: [[X, -a * 0.15]],
      Chest: [[X, -a * 0.09]],
      Head: [[X, a * 0.06]],
    }),
  },
  leanIn: {
    duration: [3.0, 5.2],
    envelope: hold,
    shape: (a, _w, s) => ({
      Spine: [[X, a * 0.17], [Y, a * s * 0.05]],
      Chest: [[X, a * 0.1]],
      Neck: [[X, -a * 0.09]],
    }),
  },
  fidget: {
    duration: [1.8, 2.6],
    envelope: bell,
    shape: (a, w) => {
      const wag = Math.sin(w * Math.PI * 4) * a * 0.12;
      return {
        LeftForeArm: [[X, -a * 0.2], [Y, -wag]],
        RightForeArm: [[X, -a * 0.2], [Y, wag]],
        Chest: [[Y, wag * 0.2]],
      };
    },
  },
};

/** How likely each mannerism is, per context. Zero means "not from here". */
const REPERTOIRE: Record<MannerismContext, Partial<Record<MannerismName, number>>> = {
  standing: { weightShift: 3, headTurn: 2.5, shoulderRoll: 1.5, fidget: 1.2, scratch: 1, stretch: 0.8 },
  seated: { leanBack: 2, headTurn: 2.5, leanIn: 1.6, fidget: 1.4, shoulderRoll: 1.2, scratch: 1, stretch: 0.8 },
};

export interface MannerismsOptions {
  /**
   * Seeds this character's habits — how restless they are, which
   * mannerisms they favour, which side they lead with. Two rigs built
   * from the same humanoid seed should get the same one here, and then
   * they will *behave* like themselves as well as look like themselves.
   */
  seed?: number;
  /** 0 = statue, 1 = an ordinary person, 2 = restless. Default 1. */
  restlessness?: number;
  /** Which repertoire to draw on. Default 'standing'. */
  context?: MannerismContext;
  /** Mean seconds between mannerisms at restlessness 1. Default 6. */
  interval?: number;
  /** Above this speed (m/s) the body is busy walking. Default 0.35. */
  stillness?: number;
}

type MannerismListener = (name: MannerismName) => void;

/**
 * Idle motion — the thing that separates a character from a mannequin.
 *
 * A standing person is never still: they unload one hip and then the
 * other, roll a shoulder, glance at nothing, scratch their neck. None of
 * it means anything, all of it is constant, and its **absence** is what
 * makes an idle character read as switched off. This fires those
 * movements as small additive one-shots on an uneven schedule, so a row
 * of characters never twitches in unison.
 *
 * Each rig gets its own seed, so restlessness, favourite mannerisms and
 * leading side become part of that character — one villager fidgets
 * constantly, another barely moves, and they stay that way.
 *
 * ```ts
 * const habits = new Mannerisms(rig, loco, { seed: villager.seed });
 * habits.context = 'seated';                 // when they sit down
 * game.onUpdate((t) => { loco.update(t.delta, v); habits.update(t.delta); });
 * ```
 *
 * Mannerisms suppress themselves while the character is walking (the gait
 * is already doing the moving) and resume when they stop.
 */
export class Mannerisms {
  /** Which repertoire to draw from — set to 'seated' on sitting down. */
  context: MannerismContext;
  /** 0 = statue, 1 = ordinary, 2 = restless. Live-editable. */
  restlessness: number;
  /** Turn the whole layer off without losing the schedule. */
  enabled = true;

  private readonly loco: Locomotion;
  private readonly interval: number;
  private readonly stillness: number;
  private readonly random: () => number;
  private readonly clips = new Map<string, AnimationClip>();
  private readonly listeners = new Set<MannerismListener>();
  /** Per-character taste: a bias multiplier on each mannerism's weight. */
  private readonly taste = new Map<MannerismName, number>();
  private timer: number;
  private playing: AnimationAction | null = null;
  private remaining = 0;

  constructor(rig: HumanoidRig, loco: Locomotion, options: MannerismsOptions = {}) {
    void rig; // additive rotations are height-independent; taken for symmetry
    this.loco = loco;
    this.context = options.context ?? 'standing';
    this.interval = options.interval ?? 6;
    this.stillness = options.stillness ?? 0.35;
    let state = (options.seed ?? 1) >>> 0 || 1;
    this.random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Personality, drawn once: how restless, and what they favour doing.
    this.restlessness = options.restlessness ?? 0.55 + this.random() * 0.95;
    for (const name of Object.keys(RECIPES) as MannerismName[]) {
      this.taste.set(name, 0.35 + this.random() * 1.5);
    }
    this.timer = this.nextDelay() * this.random(); // don't all start together
  }

  /** Fires whenever a mannerism starts. Returns an unsubscribe. */
  onPlay(listener: MannerismListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Is a mannerism running right now? */
  get busy(): boolean {
    return this.remaining > 0;
  }

  /** Seconds left on the running mannerism (0 when idle). */
  get remainingTime(): number {
    return this.remaining;
  }

  /** Advance the schedule. Call every frame, after `Locomotion.update`. */
  update(dt: number): void {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
    if (!this.enabled || this.restlessness <= 0) return;
    // Walking is motion enough; idle habits belong to the pauses.
    if (this.loco.speed > this.stillness) {
      this.timer = Math.max(this.timer, 0.6);
      return;
    }
    this.timer -= dt;
    if (this.timer > 0 || this.remaining > 0) return;
    this.play();
    this.timer = this.nextDelay();
  }

  /**
   * Play one now — named, or drawn from the current repertoire. Handy for
   * punctuating dialogue, or reacting to something.
   */
  play(name?: MannerismName): MannerismName | null {
    const chosen = name ?? this.pick();
    if (!chosen) return null;
    const recipe = RECIPES[chosen];
    const side = this.random() < 0.5 ? 1 : -1;
    const key = `${chosen}:${side}`;
    let clip = this.clips.get(key);
    if (!clip) {
      const [lo, hi] = recipe.duration;
      const duration = lo + (hi - lo) * 0.5;
      clip = buildAdditive(key, duration, recipe.envelope, (amp, w) => recipe.shape(amp, w, side));
      this.clips.set(key, clip);
    }
    // Never twice the same: vary the tempo and how much of it shows.
    const [lo, hi] = recipe.duration;
    const rate = ((lo + hi) * 0.5) / (lo + (hi - lo) * this.random());
    const action = this.loco.overlay(clip, {
      loop: false,
      fadeIn: 0.3,
      weight: 0.55 + this.random() * 0.5,
    });
    action.timeScale = rate;
    this.playing = action;
    this.remaining = clip.duration / rate;
    for (const listener of [...this.listeners]) listener(chosen);
    return chosen;
  }

  /** Stop the current mannerism early — they were interrupted. */
  interrupt(fade = 0.2): void {
    if (this.playing) this.loco.stopOverlay(this.playing, fade);
    this.playing = null;
    this.remaining = 0;
  }

  private pick(): MannerismName | null {
    const table = REPERTOIRE[this.context];
    const entries = (Object.keys(table) as MannerismName[]).map(
      (name) => [name, (table[name] ?? 0) * (this.taste.get(name) ?? 1)] as const
    );
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (total <= 0) return null;
    let roll = this.random() * total;
    for (const [name, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return name;
    }
    return entries[entries.length - 1][0];
  }

  /**
   * Exponential-ish gaps. A fixed period reads as a machine; real idle
   * motion clumps — two fidgets close together, then a long stillness.
   */
  private nextDelay(): number {
    const mean = this.interval / Math.max(0.05, this.restlessness);
    const u = Math.max(1e-4, this.random());
    return Math.min(mean * 3, Math.max(1.1, -Math.log(u) * mean));
  }
}
