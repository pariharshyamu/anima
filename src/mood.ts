import { Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => clamp(v, 0, 1);

/**
 * Mood — how a body carries whatever it is already doing.
 *
 * **An emotion is not a pose.** Sadness has no keyframe: it is eight degrees
 * of head pitch, a chest that has stopped opening, shoulders forward, three
 * centimetres off your height and a walk a quarter slower — applied to
 * standing, sitting, eating, climbing and fighting alike. Author it as a clip
 * and you need a sad version of every clip in the library; author it as a
 * LAYER and every clip in the library gets one for free.
 *
 * So this is the same machinery `Cockpit` uses for g-load, with a different
 * input: an additive contribution to a handful of bones, given back at the top
 * of every frame before the next one is computed. It rides on top of the pose
 * that is playing and never replaces it.
 *
 * ```ts
 * const mood = new Mood(rig, MOODS.dejected);
 * game.onUpdate((t) => {
 *   loco.update(t.delta, velocity.multiplyScalar(mood.pace));
 *   mood.update(t.delta);
 * });
 * ```
 *
 * ## Two axes, not a list of feelings
 *
 * `valence` (−1 miserable … +1 elated) and `arousal` (0 torpid … 1 keyed up).
 * A list of named emotions forces you to author their overlaps — `sad`,
 * `tired`, `defeated` and `bored` are one posture wearing four different
 * faces, and four separate authorings of it drift apart within a release.
 * Fear is not a third axis either: it is low valence with high arousal, and
 * what falls out — head down, body narrow, movements fast — is fear.
 *
 * `MOODS` names the useful corners so nobody has to think in coordinates.
 *
 * ## What it does NOT do
 *
 * It publishes `pace`, `gestureScale`, `mannerismRate` and `gazeAuthority`
 * and reaches into none of them. A mood that quietly slowed `Locomotion`
 * would desynchronise the stride from the declared speed and slide the feet
 * on every step — the exact defect `npm run skate` exists to catch. Mood
 * describes; the game applies. The one thing a caller MUST do is scale the
 * travel speed and the clip together, which is what `pace` is for.
 */

/** A point in mood space. */
export interface MoodPoint {
  /** −1 miserable … +1 elated. */
  valence: number;
  /** 0 torpid … 1 keyed up. */
  arousal: number;
}

export type MoodName =
  | 'neutral'
  | 'content'
  | 'elated'
  | 'proud'
  | 'calm'
  | 'bored'
  | 'weary'
  | 'dejected'
  | 'grieving'
  | 'alert'
  | 'anxious'
  | 'afraid'
  | 'furious';

/**
 * The useful corners of the space, named.
 *
 * Note what the coordinates say that the names do not. `weary` and `dejected`
 * are both unhappy and differ mostly in how much is LEFT — weary is flatter,
 * dejected still has some charge in it. `anxious` and `afraid` sit at similar
 * unhappiness and differ in how wound up they are. And `furious` is high
 * arousal with valence only slightly negative: rage is not sadness, it is
 * energy pointed at something, and a system that treats them as one axis makes
 * an angry character slump. Anyone who disagrees can pass their own numbers.
 */
export const MOODS: Record<MoodName, MoodPoint> = {
  neutral: { valence: 0, arousal: 0.5 },
  content: { valence: 0.45, arousal: 0.4 },
  elated: { valence: 0.9, arousal: 0.85 },
  proud: { valence: 0.6, arousal: 0.55 },
  calm: { valence: 0.25, arousal: 0.15 },
  bored: { valence: -0.2, arousal: 0.12 },
  weary: { valence: -0.35, arousal: 0.1 },
  dejected: { valence: -0.75, arousal: 0.25 },
  grieving: { valence: -0.95, arousal: 0.3 },
  alert: { valence: 0.1, arousal: 0.85 },
  anxious: { valence: -0.45, arousal: 0.75 },
  afraid: { valence: -0.8, arousal: 0.95 },
  furious: { valence: -0.25, arousal: 0.95 },
};

export const MOOD_NAMES = Object.keys(MOODS) as MoodName[];

export interface MoodOptions extends Partial<MoodPoint> {
  /**
   * Seconds to take on a stronger feeling. Default 0.6.
   *
   * Rise and fall are separate because they are not symmetric: bad news lands
   * in under a second and takes a minute to leave. One time constant makes a
   * character who cheers up as fast as they were hurt, which reads as a switch.
   */
  rise?: number;
  /** Seconds to let one go. Default 3.5. */
  fall?: number;
  /** Overall strength, 0..1. Default 1 — turn it down for background crowds. */
  strength?: number;
  seed?: number;
}

/** Bones the layer contributes to, on top of whatever pose is playing. */
const DRIVEN: BoneName[] = [
  'Spine', 'Chest', 'Neck', 'Head',
  'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm',
];

/**
 * Nothing this layer applies to one bone may exceed this, in radians.
 *
 * The guard against a mood that fights its base pose. A layer free to rotate a
 * shoulder by a radian does not colour a climb, it breaks one — and it breaks
 * it silently, on top of a clip that was solved to put a hand on a rung.
 */
export const MOOD_LIMIT = 0.42;

export class Mood {
  /** Current valence, smoothed toward the target. */
  valence = 0;
  /** Current arousal, smoothed toward the target. */
  arousal = 0.5;

  private readonly rig: HumanoidRig;
  private readonly riseTime: number;
  private readonly fallTime: number;
  private readonly strength: number;
  private target: MoodPoint;
  private readonly applied = new Map<BoneName, Quaternion>();
  private appliedHipsY = 0;
  private clock: number;
  private readonly q = new Quaternion();
  private readonly delta = new Quaternion();

  constructor(rig: HumanoidRig, options: MoodOptions | MoodName = {}) {
    this.rig = rig;
    const o: MoodOptions = typeof options === 'string' ? { ...MOODS[options] } : options;
    this.riseTime = Math.max(0.05, o.rise ?? 0.6);
    this.fallTime = Math.max(0.05, o.fall ?? 3.5);
    this.strength = clamp01(o.strength ?? 1);
    this.target = {
      valence: clamp(o.valence ?? 0, -1, 1),
      arousal: clamp01(o.arousal ?? 0.5),
    };
    this.valence = this.target.valence;
    this.arousal = this.target.arousal;
    this.clock = (o.seed ?? 1) * 0.37;
    for (const bone of DRIVEN) this.applied.set(bone, new Quaternion());
  }

  /** Feel something else. Eases there; see `rise` and `fall`. */
  set(mood: MoodName | Partial<MoodPoint>): void {
    const p = typeof mood === 'string' ? MOODS[mood] : mood;
    this.target = {
      valence: clamp(p.valence ?? this.target.valence, -1, 1),
      arousal: clamp01(p.arousal ?? this.target.arousal),
    };
  }

  /** The mood being eased toward. */
  get wanted(): MoodPoint {
    return { ...this.target };
  }

  /**
   * Travel-speed multiplier — and the one number a caller MUST use.
   *
   * A dejected walk is slower. If the game slows the body without telling
   * `Locomotion`, the clip keeps playing at its declared speed and the planted
   * foot slides every step; `Locomotion` stride-matches from the speed it is
   * given, so passing it `velocity * mood.pace` keeps them together. That is
   * why this is published rather than applied: the layer cannot reach into
   * locomotion without breaking the one invariant locomotion has.
   */
  get pace(): number {
    const s = this.strength;
    const down = Math.max(0, -this.valence) * s;
    const up = Math.max(0, this.valence) * s;
    const tone = (this.arousal - 0.5) * s;
    return clamp(1 + up * 0.16 - down * 0.3 + tone * 0.26, 0.42, 1.65);
  }

  /** Amplitude for gestures and mannerisms. Flat when low, big when elated. */
  get gestureScale(): number {
    const s = this.strength;
    return clamp(0.55 + this.arousal * 0.7 * s + Math.max(0, this.valence) * 0.22 * s, 0.3, 1.7);
  }

  /** Multiplier on how often idle mannerisms fire. Anxiety fidgets. */
  get mannerismRate(): number {
    return clamp(0.35 + this.arousal * 1.7 * this.strength, 0.2, 2.2);
  }

  /**
   * How much of a `LookAt` the body is willing to spend, 0..1.
   *
   * A dejected person does not hold your eye, and a frightened one cannot stop
   * scanning. Multiply `LookAt`'s weight by this and the gaze carries the mood
   * without a single extra bone.
   */
  get gazeAuthority(): number {
    return clamp01(0.55 + this.valence * 0.38 + (this.arousal - 0.5) * 0.24);
  }

  update(dt: number): void {
    if (!(dt > 0)) return;
    this.clock += dt;

    // Give back last frame's contribution before computing this one. Without
    // this the layer compounds: a mood applied every frame for a minute is a
    // body folded in half, and it looks like a physics bug rather than a
    // missing inverse.
    for (const bone of DRIVEN) {
      const had = this.applied.get(bone)!;
      this.rig.bones[bone].quaternion.multiply(this.q.copy(had).invert());
      had.identity();
    }
    this.rig.bones.Hips.position.y -= this.appliedHipsY;
    this.appliedHipsY = 0;

    // Rise fast, fade slow — separately per axis, because calming down and
    // cheering up are different clocks.
    this.valence = ease(this.valence, this.target.valence, dt, this.riseTime, this.fallTime);
    this.arousal = ease(this.arousal, this.target.arousal, dt, this.riseTime, this.fallTime, 0.5);

    const s = this.strength;
    const down = Math.max(0, -this.valence) * s;
    const up = Math.max(0, this.valence) * s;
    // Tone is signed about the middle: 0.5 arousal is nobody in particular.
    const tone = (this.arousal - 0.5) * s;

    // A wound-up body has a tremor. Small, fast, and only present when the
    // arousal is — it is what separates `alert` from `calm` when both are
    // standing still and neither is doing anything.
    const jitter = Math.max(0, tone) * 0.008 * Math.sin(this.clock * 11.3);

    // THE SHAPE. Low valence folds the body forward and down; high valence
    // opens the chest and lifts the head. Tone is a separate axis on top:
    // shoulders back and spine long when keyed up, everything slack when not.
    this.contribute('Spine', down * 0.1 - up * 0.06 - tone * 0.03, 0, 0);
    this.contribute('Chest', down * 0.15 - up * 0.13 - tone * 0.05 + jitter, 0, 0);
    this.contribute('Neck', down * 0.2 - up * 0.05, 0, 0);
    this.contribute('Head', down * 0.3 - up * 0.11 - tone * 0.06 + jitter, 0, 0);

    // Shoulders round forward and drop when low; square and lift when tense.
    // A clavicle's droop is a ROLL, not a pitch — pitching a shoulder swings
    // the whole arm forward and reads as a reach rather than a slump.
    const droop = down * 0.16 - tone * 0.1;
    this.contribute('LeftShoulder', down * 0.06, 0, -droop);
    this.contribute('RightShoulder', down * 0.06, 0, droop);

    // Arms hang heavier and closer to the body when low; a little away from
    // it when keyed up, which is where the elbows go when you are ready.
    const heavy = down * 0.14 - up * 0.05;
    const outward = tone * 0.07;
    this.contribute('LeftArm', heavy, 0, -outward);
    this.contribute('RightArm', heavy, 0, outward);

    // STATURE. A dejected body is measurably shorter, and this is the part
    // people read without knowing they are reading it.
    this.appliedHipsY = (up * 0.012 - down * 0.032 + tone * 0.006) * this.rig.legLength;
    this.rig.bones.Hips.position.y += this.appliedHipsY;
  }

  /** Hand the body back exactly as it was found. */
  release(): void {
    for (const bone of DRIVEN) {
      const had = this.applied.get(bone)!;
      this.rig.bones[bone].quaternion.multiply(this.q.copy(had).invert());
      had.identity();
    }
    this.rig.bones.Hips.position.y -= this.appliedHipsY;
    this.appliedHipsY = 0;
  }

  private contribute(bone: BoneName, pitch: number, yaw: number, roll: number): void {
    const p = clamp(pitch, -MOOD_LIMIT, MOOD_LIMIT);
    const y = clamp(yaw, -MOOD_LIMIT, MOOD_LIMIT);
    const r = clamp(roll, -MOOD_LIMIT, MOOD_LIMIT);
    if (p === 0 && y === 0 && r === 0) return;
    // Scratch quaternions — eight bones at sixty frames a second is not a
    // place to allocate.
    this.delta
      .setFromAxisAngle(Y, y)
      .multiply(this.q.setFromAxisAngle(Z, r))
      .multiply(this.q.setFromAxisAngle(X, p));
    this.rig.bones[bone].quaternion.multiply(this.delta);
    this.applied.get(bone)!.copy(this.delta);
  }
}

/** Ease toward a target, faster on the way out than on the way back. */
function ease(
  current: number,
  target: number,
  dt: number,
  rise: number,
  fall: number,
  middle = 0
): number {
  // "Rising" is moving AWAY from neutral — taking a feeling on. Coming back
  // toward the middle is the slow one.
  const away = Math.abs(target - middle) > Math.abs(current - middle);
  const k = Math.min(1, dt / (away ? rise : fall));
  return current + (target - current) * k;
}

/**
 * What a mood does to a body, in numbers.
 *
 * The gate. A layer like this fails in two ways that no screenshot and no unit
 * test on its internals can see: it can be **non-monotone** — a slightly
 * sadder character standing slightly taller, which reads as a glitch and is
 * invisible unless you sweep the axis — and it can **leak**, leaving a little
 * of itself behind every frame until the body is folded in half after a
 * minute. Both are measured here, from the posed rig rather than from the
 * arithmetic that posed it.
 */
export interface PostureReport {
  /** Head pitch relative to the rig's rest, radians. Positive is down. */
  headPitch: number;
  /**
   * Height of the TOP OF THE SPINE above the root, metres — how erect the
   * body is standing.
   *
   * Measured at the neck and not at the crown, which took a gate failure to
   * work out. Crown height conflates two different facts: an elated body both
   * stands taller AND lifts its chin, and lifting the chin arcs the top of the
   * head backward and DOWN. Swept, the crown turns over at valence 0.85 and
   * the gate reported a body that shrank as its mood improved — which was
   * true of the crown and false of the body. Head pitch is reported
   * separately; two facts, two numbers, neither pretending to be the other.
   */
  stature: number;
  /** How far the shoulders have dropped from rest, metres. */
  shoulderDrop: number;
  /** Worst single-bone rotation this mood applies, radians. */
  worstBone: number;
  /** Chest world Z relative to the root — forward is a closed chest. */
  chestLean: number;
}

/**
 * Settle a mood onto a rig and measure the posture it produces.
 *
 * Runs the layer to steady state rather than reading its targets, so what
 * comes back is what a viewer would see — including the smoothing, the limit
 * clamp and anything else between the numbers and the bones.
 */
export function measurePosture(
  rig: HumanoidRig,
  mood: MoodName | MoodPoint,
  options: { strength?: number; settle?: number } = {}
): PostureReport {
  const point = typeof mood === 'string' ? MOODS[mood] : mood;
  rig.object.updateWorldMatrix(true, true);
  const restShoulder = rig.bones.LeftShoulder.getWorldPosition(new Vector3());
  const restChest = rig.bones.Chest.getWorldPosition(new Vector3());
  const restQ = rig.bones.Head.quaternion.clone();
  const root = rig.object.position.clone();

  const layer = new Mood(rig, { ...point, strength: options.strength ?? 1, rise: 0.01, fall: 0.01 });
  const settle = options.settle ?? 40;
  for (let i = 0; i < settle; i++) layer.update(1 / 60);
  rig.object.updateWorldMatrix(true, true);

  const neck = rig.bones.Neck.getWorldPosition(new Vector3());
  const shoulder = rig.bones.LeftShoulder.getWorldPosition(new Vector3());
  const chest = rig.bones.Chest.getWorldPosition(new Vector3());
  // Signed pitch about X, taken from the delta between rest and now.
  const delta = restQ.clone().invert().multiply(rig.bones.Head.quaternion);
  const headPitch = 2 * Math.asin(clamp(delta.x, -1, 1));
  let worst = 0;
  for (const bone of DRIVEN) {
    worst = Math.max(worst, Math.abs(2 * Math.acos(clamp(Math.abs(rig.bones[bone].quaternion.w), 0, 1))));
  }

  const report: PostureReport = {
    headPitch,
    stature: neck.y - root.y,
    shoulderDrop: restShoulder.y - shoulder.y,
    worstBone: worst,
    chestLean: chest.z - restChest.z,
  };
  layer.release();
  rig.object.updateWorldMatrix(true, true);
  return report;
}
