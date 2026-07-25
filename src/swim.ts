import { AnimationAction, AnimationClip, Quaternion, Vector3 } from 'three';
import { buildClip, Pose } from './clips';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

/**
 * Swimming.
 *
 * The thing that makes this a real mode rather than another arm overlay is
 * that **the body stops being upright**. Every other pose in the library
 * leaves the root alone and moves bones; a swimmer is rotated onto their
 * front, floated at a surface they did not choose, and driven forward by
 * their own stroke. So `Swimming` takes the root the way `Climb` does, and
 * the clips only have to do the limbs.
 *
 * The interesting decision is **wade or swim**, and it belongs here rather
 * than to the caller: it is made against the character's own height. The
 * same pool is a paddling pool for one body and out of their depth for
 * another, and the shallow end of a real pool exists precisely so that the
 * transition happens somewhere.
 *
 * ```ts
 * const swim = new Swimming(rig, loco);
 * swim.steer(heading, 1);
 * game.onUpdate((t) => swim.update(t.delta, pool));  // SCENA's createPool fits
 * ```
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const smooth = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Rig conventions, MEASURED rather than assumed, because three of the four
 * guesses were wrong:
 *
 * - The arm lies along the body's **x** axis at rest, so `Arm` **X does
 *   nothing at all** — it spins the arm about its own length. The first
 *   draft of the crawl animated that axis and produced a corpse.
 * - `Arm` **Z** is the stroke axis: for the right arm `-1.9` puts the hand
 *   straight overhead and `+1.6` puts it down past the hip. With the body
 *   rotated onto its front, overhead IS forward, so the whole catch-and-pull
 *   of a crawl is one sweep along Z.
 * - `Arm` **Y** swings the arm through the body's z. Upright that is
 *   forward and back; face-down it is **up out of the water and back into
 *   it**, which is what makes the recovery a recovery.
 * - `UpLeg` X kicks the foot through z, negative forward. Face-down that is
 *   the flutter kick with no change at all.
 */
const OVERHEAD = 1.9;
const PAST_HIP = -1.5;

/** Where the water is and how deep, in world space. SCENA's `Pool` fits. */
export interface WaterBody {
  readonly surfaceY: number;
  depthAt(x: number, z: number): number;
  disturb?(x: number, z: number, strength?: number): void;
}

export type Stroke =
  /** Front crawl: fastest, face down, alternating windmill, flutter kick. */
  | 'crawl'
  /** Breaststroke: symmetric sweep, frog kick, head up on every pull. */
  | 'breast'
  /** Backstroke: on the back, face out of the water. */
  | 'back'
  /** Treading water: upright, going nowhere, head out. */
  | 'tread';

export type SwimState =
  /** Out of the water entirely. */
  | 'dry'
  /** Feet on the bottom, pushing through it. */
  | 'wading'
  /** Off the bottom and horizontal. */
  | 'swimming'
  /** Off the bottom and upright. */
  | 'treading';

interface StrokeSpec {
  /** Metres per full cycle of the clip. */
  reach: number;
  /** Cruising speed in metres per second. */
  speed: number;
  /**
   * Cycles per second when the body is not going anywhere.
   *
   * Deriving stroke rate from speed is right and is what stops a swimmer
   * skating — but it freezes the one stroke whose speed is ZERO. The first
   * version of this left a treading swimmer stopped dead at frame one with
   * their arms out, which is a body floating face up in a pool, not someone
   * holding station in it. Holding station is work.
   */
  cadence: number;
  /** Body roll about its own long axis, radians. */
  roll: number;
  /** Face down (0) or face up (PI). */
  twist: number;
}

const STROKES: Record<Stroke, StrokeSpec> = {
  // A crawl rolls the body 35-45 degrees to each side, and it is not
  // decoration: a swimmer whose shoulders stay level looks like they are
  // being towed. It is the single most recognisable thing about the stroke.
  crawl: { reach: 1.9, speed: 1.35, cadence: 0.4, roll: 0.62, twist: 0 },
  breast: { reach: 1.6, speed: 0.95, cadence: 0.35, roll: 0, twist: 0 },
  back: { reach: 1.8, speed: 1.05, cadence: 0.4, roll: 0.5, twist: Math.PI },
  tread: { reach: 1, speed: 0, cadence: 0.45, roll: 0, twist: 0 },
};

/** Build the limb animation for one stroke. The root is the controller's. */
export function createStrokeClip(rig: HumanoidRig, stroke: Stroke): AnimationClip {
  const rest = rig.bones.Hips.position.y;

  if (stroke === 'crawl') {
    return buildClip(rig, 'swim-crawl', 1.6, 34, (p, pose: Pose) => {
      for (const side of ['Left', 'Right'] as const) {
        const k = side === 'Left' ? 1 : -1;
        // The two arms are half a cycle apart, and the pull is the shorter
        // half: underwater for 45% of it, over the top for the rest.
        const q = (p + (side === 'Left' ? 0 : 0.5)) % 1;
        const pulling = q < 0.45;
        const u = pulling ? smooth(q / 0.45) : smooth((q - 0.45) / 0.55);
        const sweep = pulling ? mix(OVERHEAD, PAST_HIP, u) : mix(PAST_HIP, OVERHEAD, u);
        // Under water the hand presses DOWN and back; over the water the arm
        // lifts clear. Same axis, opposite sign — that is the recovery.
        const clear = pulling ? -0.18 : 0.5 * Math.sin(Math.PI * u);
        // A high elbow through the pull. A straight arm is a windmill.
        const elbow = pulling ? 0.55 + 0.75 * Math.sin(Math.PI * u) : 1.15 * Math.sin(Math.PI * u);
        pose.rotate(`${side}Arm` as BoneName, [Z, k * sweep], [Y, k * clear]);
        pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * elbow]);
        pose.rotate(`${side}Hand` as BoneName, [Z, k * 0.2]);
        flutter(pose, side, p);
      }
      // The head only leaves the water to breathe, once a cycle, on the side
      // whose arm is recovering. A swimmer with their head up throughout is
      // a swimmer who has never put their face in.
      const breath = Math.max(0, Math.sin(Math.PI * clamp01(((p + 0.5) % 1 - 0.35) / 0.35)));
      pose.rotate('Spine', [X, -0.05]);
      pose.rotate('Chest', [X, -0.07]);
      pose.rotate('Neck', [Y, -breath * 0.5], [X, -0.12]);
      pose.rotate('Head', [Y, -breath * 0.55], [X, -0.08]);
      pose.hipsY = rest;
    });
  }

  if (stroke === 'breast') {
    return buildClip(rig, 'swim-breast', 2.1, 34, (p, pose: Pose) => {
      // Pull, recover, GLIDE. The glide is over half the cycle and it is the
      // whole character of the stroke — cut it and this is just a slow crawl
      // with both arms tied together.
      const pull = smooth(clamp01(p / 0.22));
      const recover = smooth(clamp01((p - 0.22) / 0.22));
      for (const side of ['Left', 'Right'] as const) {
        const k = side === 'Left' ? 1 : -1;
        // Out to the shoulder line and no further — a breaststroke arm never
        // goes past the chest.
        const sweep = mix(OVERHEAD, 0.35, pull) * (1 - recover) + OVERHEAD * recover;
        const wide = Math.sin(Math.PI * pull) * (1 - recover);
        pose.rotate(`${side}Arm` as BoneName, [Z, k * sweep], [Y, -k * (0.15 + wide * 0.5)]);
        pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * (0.3 + pull * 0.9 - recover * 1.0)]);
        pose.rotate(`${side}Hand` as BoneName, [Z, k * 0.25]);
        // Frog kick, and it fires on the RECOVERY, not with the arms. Pulling
        // and kicking together is the beginner's mistake and it looks like
        // one: the two halves of the stroke have to alternate or the body
        // never glides.
        const draw = smooth(clamp01((p - 0.3) / 0.2));
        const snap = smooth(clamp01((p - 0.5) / 0.16));
        const knee = draw * (1 - snap);
        pose.rotate(`${side}UpLeg` as BoneName, [X, -knee * 0.75], [Y, -k * knee * 0.5]);
        pose.rotate(`${side}Leg` as BoneName, [X, knee * 1.7]);
        pose.rotate(`${side}Foot` as BoneName, [X, -0.3 + knee * 0.5]);
      }
      // The head comes up on the pull and goes back down for the glide.
      const up = Math.sin(Math.PI * clamp01(p / 0.4));
      pose.rotate('Spine', [X, -0.04 - up * 0.06]);
      pose.rotate('Chest', [X, -0.06 - up * 0.1]);
      pose.rotate('Neck', [X, -0.1 - up * 0.3]);
      pose.rotate('Head', [X, -0.06 - up * 0.28]);
      pose.hipsY = rest;
    });
  }

  if (stroke === 'back') {
    return buildClip(rig, 'swim-back', 1.7, 34, (p, pose: Pose) => {
      for (const side of ['Left', 'Right'] as const) {
        const k = side === 'Left' ? 1 : -1;
        const q = (p + (side === 'Left' ? 0 : 0.5)) % 1;
        const pulling = q < 0.5;
        const u = smooth(pulling ? q / 0.5 : (q - 0.5) / 0.5);
        const sweep = pulling ? mix(OVERHEAD, PAST_HIP, u) : mix(PAST_HIP, OVERHEAD, u);
        // On the back the recovery is a STRAIGHT arm swung over the face,
        // which is the opposite of the crawl's high elbow.
        const elbow = pulling ? 0.5 + 0.5 * Math.sin(Math.PI * u) : 0.12;
        const clear = pulling ? 0.16 : -0.42 * Math.sin(Math.PI * u);
        pose.rotate(`${side}Arm` as BoneName, [Z, k * sweep], [Y, k * clear]);
        pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * elbow]);
        flutter(pose, side, p);
      }
      // Chin tucked, face out of the water, and it never turns — the whole
      // point of being on your back is that you can breathe whenever.
      pose.rotate('Neck', [X, 0.16]);
      pose.rotate('Head', [X, 0.12]);
      pose.hipsY = rest;
    });
  }

  // tread — upright, going nowhere, and working at it.
  return buildClip(rig, 'swim-tread', 2.4, 30, (p, pose: Pose) => {
    const scull = Math.sin(TAU * p * 2);
    for (const side of ['Left', 'Right'] as const) {
      const k = side === 'Left' ? 1 : -1;
      // Hands out at chest height, sweeping side to side. Sculling is what
      // holds a body up; arms hanging still would sink it.
      // BELOW the shoulder line: k is the up direction on this axis, so the
      // obvious sign holds the arms out sideways like a scarecrow. Sculling
      // happens in front of you, at about chest height.
      pose.rotate(`${side}Arm` as BoneName, [Z, -k * 0.5], [Y, -k * (0.7 + scull * 0.3)]);
      pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * (1.0 + scull * 0.35)]);
      pose.rotate(`${side}Hand` as BoneName, [X, scull * 0.4]);
      // Eggbeater: the legs circle out of phase with each other, so one is
      // always pressing down.
      const c = TAU * p + (side === 'Left' ? 0 : Math.PI);
      pose.rotate(`${side}UpLeg` as BoneName, [X, -0.55 - Math.sin(c) * 0.3], [Y, -k * 0.45]);
      pose.rotate(`${side}Leg` as BoneName, [X, 1.0 + Math.cos(c) * 0.45]);
      pose.rotate(`${side}Foot` as BoneName, [X, -0.15]);
    }
    pose.rotate('Spine', [X, 0.05]);
    pose.rotate('Chest', [X, 0.04]);
    pose.hipsY = rest;
  });
}

/**
 * The flutter kick: small, fast, from the hip, with the toes pointed.
 *
 * Six beats to a full arm cycle is the standard rhythm, and the toes matter
 * more than the amplitude — a swimmer with flexed feet is a swimmer
 * standing up in the water.
 */
function flutter(pose: Pose, side: 'Left' | 'Right', p: number): void {
  const beat = Math.sin(TAU * p * 3 + (side === 'Left' ? 0 : Math.PI));
  pose.rotate(`${side}UpLeg` as BoneName, [X, beat * 0.3]);
  pose.rotate(`${side}Leg` as BoneName, [X, Math.max(0, -beat) * 0.55]);
  pose.rotate(`${side}Foot` as BoneName, [X, -0.42]);
}

/** Pushing through water on your feet — not walking, and not swimming. */
export function createWadeClip(rig: HumanoidRig): AnimationClip {
  const rest = rig.bones.Hips.position.y;
  return buildClip(rig, 'swim-wade', 1.9, 30, (p, pose: Pose) => {
    for (const side of ['Left', 'Right'] as const) {
      const k = side === 'Left' ? 1 : -1;
      const q = (p + (side === 'Left' ? 0 : 0.5)) % 1;
      // The knee comes UP and forward, high, because the leg has to be
      // lifted clear rather than swung through. That high step is the whole
      // read: a normal walk cycle in waist-deep water is a walk on a floor.
      const lift = Math.max(0, Math.sin(Math.PI * clamp01(q / 0.5)));
      pose.rotate(`${side}UpLeg` as BoneName, [X, -lift * 0.95 + 0.15]);
      pose.rotate(`${side}Leg` as BoneName, [X, lift * 1.25]);
      pose.rotate(`${side}Foot` as BoneName, [X, -lift * 0.3]);
      // Arms out to the sides, above the water, held for balance.
      pose.rotate(`${side}Arm` as BoneName, [Z, k * 0.75], [Y, -k * 0.5]);
      pose.rotate(`${side}ForeArm` as BoneName, [Y, -k * 0.55]);
      pose.rotate(`${side}Hand` as BoneName, [Z, k * 0.3]);
    }
    // Leaning into it, because the water pushes back.
    pose.rotate('Hips', [X, 0.06]);
    pose.rotate('Spine', [X, 0.1]);
    pose.rotate('Chest', [X, 0.08]);
    pose.rotate('Head', [X, -0.1]);
    pose.hipsY = rest - 0.01 * rig.height;
  });
}

export interface SwimOptions {
  stroke?: Stroke;
  /**
   * Depth, as a fraction of the swimmer's height, at which their feet leave
   * the bottom. Default 0.75 — water up around the shoulders.
   *
   * Measured against the swimmer, which is the entire point: at 0.62 a
   * two-metre adult was floating in 1.3 m of water, which is chest deep on
   * them and somewhere they would obviously still be standing.
   */
  liftOff?: number;
  /** Speed multiplier on every stroke. Default 1. */
  pace?: number;
}

type SwimListener = (state: SwimState) => void;

export class Swimming {
  /** Speed multiplier. Live-editable. */
  pace: number;

  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private readonly liftOff: number;
  private readonly clips = new Map<string, AnimationClip>();
  private readonly listeners = new Set<SwimListener>();
  private action: AnimationAction | null = null;
  private playing: Stroke | 'wade' | null = null;
  private current: SwimState = 'dry';
  private heading = 0;
  private throttle = 1;
  private phase = 0;
  private lastCycle = 0;
  /** How far onto the front, 0 upright to 1 flat. Eased, never switched. */
  private prone = 0;
  private strokeKind: Stroke;
  private readonly q = new Quaternion();
  private readonly tmp = new Quaternion();

  constructor(rig: HumanoidRig, loco: Locomotion, options: SwimOptions = {}) {
    this.rig = rig;
    this.loco = loco;
    this.strokeKind = options.stroke ?? 'crawl';
    this.liftOff = options.liftOff ?? 0.75;
    this.pace = options.pace ?? 1;
  }

  get state(): SwimState {
    return this.current;
  }

  get stroke(): Stroke {
    return this.strokeKind;
  }

  /** How far through the current stroke cycle, 0–1. */
  get cyclePhase(): number {
    return this.phase;
  }

  setStroke(stroke: Stroke): void {
    this.strokeKind = stroke;
  }

  /** Point them somewhere. `throttle` 0–1 scales the stroke rate too. */
  steer(heading: number, throttle = 1): void {
    this.heading = heading;
    this.throttle = clamp01(throttle);
  }

  onState(listener: SwimListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Give the body back to `Locomotion`. */
  stop(): void {
    if (this.action) this.loco.stopOverlay(this.action, 0.3);
    this.action = null;
    this.playing = null;
    this.loco.influence = 1;
    this.prone = 0;
    this.go('dry');
  }

  update(dt: number, water: WaterBody): void {
    if (dt <= 0) return;
    const root = this.rig.object;
    const depth = water.depthAt(root.position.x, root.position.z);
    const lift = this.rig.height * this.liftOff;

    if (depth <= 0.05) {
      if (this.current !== 'dry') this.stop();
      return;
    }

    const afloat = depth >= lift;
    const next: SwimState = !afloat
      ? 'wading'
      : this.strokeKind === 'tread'
        ? 'treading'
        : 'swimming';
    const want = afloat ? this.strokeKind : 'wade';

    // The gait underneath has to go. A walk cycle blended into a body lying
    // face down in the water is legs pedalling through the swimmer's chest.
    this.loco.influence = 0;

    if (want !== this.playing) {
      const clip =
        this.clips.get(want) ??
        (want === 'wade' ? createWadeClip(this.rig) : createStrokeClip(this.rig, want));
      this.clips.set(want, clip);
      if (this.action) this.loco.stopOverlay(this.action, 0.25);
      this.action = this.loco.overlay(clip, { fadeIn: 0.25, weight: 8 });
      this.playing = want;
    }
    if (next !== this.current) this.go(next);

    const spec = STROKES[this.strokeKind];
    const speed = (afloat ? spec.speed : 0.62) * this.pace * this.throttle;
    const reach = afloat ? spec.reach : 1.25;

    // Stroke rate is DERIVED from speed, never set beside it. Decouple them
    // and the swimmer skates: arms turning over at a rate that has nothing
    // to do with how fast the body is going, which is foot-skating with the
    // limbs swapped.
    const wasPhase = this.phase;
    const rate = speed > 0.01 ? speed / reach : afloat ? spec.cadence : 0;
    this.phase = (this.phase + rate * dt) % 1;
    if (this.action) this.action.time = this.phase * this.action.getClip().duration;

    // Forward.
    const dir = new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    root.position.addScaledVector(dir, speed * dt);

    // Going flat is EASED, not switched. The clips crossfade over a quarter
    // of a second but the root does not, and a body that snaps from vertical
    // to horizontal in one frame reads as a glitch however good the stroke
    // is. Easing it also gives the entry for free: the body pivots about its
    // own feet, so it launches forward into the stroke.
    const wantProne = next === 'swimming' ? 1 : 0;
    this.prone += (wantProne - this.prone) * Math.min(1, dt * 4);

    // Height. Wading stands on the bottom; afloat sits at the surface.
    const surface = water.surfaceY;
    const standing = afloat ? surface - this.rig.height * 0.78 : surface - depth;
    const floating = surface - 0.1 + Math.sin(this.phase * TAU) * 0.015;
    root.position.y = mix(standing, floating, this.prone);

    // Orientation.
    this.q.setFromAxisAngle(Y, this.heading);
    if (this.prone > 0.001) {
      // Onto the front: local +y (up the body) becomes the heading, and local
      // +z (the face) becomes straight down.
      this.tmp.setFromAxisAngle(X, (Math.PI / 2) * this.prone);
      this.q.multiply(this.tmp);
      // Roll about the body's own long axis, which after the pitch IS local
      // y — so the same slot carries both the crawl's roll and the half turn
      // that puts a backstroker face up.
      // NEGATIVE, and it is not a detail. A crawl rolls TOWARD the pulling
      // arm, so the recovering shoulder comes UP. Rolled the other way the
      // recovering arm is driven under, and at 0.62 rad that is 28 cm of
      // shoulder travel — it swamps the arm's own lift completely, so the
      // hand that is supposed to be swinging over the water was measured
      // 43 cm BELOW it, deeper than during the pull.
      const roll = spec.twist - Math.sin(this.phase * TAU) * spec.roll;
      this.tmp.setFromAxisAngle(Y, roll * this.prone);
      this.q.multiply(this.tmp);
    }
    root.quaternion.copy(this.q);

    // One ripple per cycle, from where the body actually is.
    if (this.phase < wasPhase) {
      water.disturb?.(root.position.x, root.position.z, afloat ? 0.9 : 0.5);
      this.lastCycle += 1;
    }
  }

  /** Completed stroke cycles since the swimmer got in. */
  get cycles(): number {
    return this.lastCycle;
  }

  private go(state: SwimState): void {
    this.current = state;
    for (const listener of [...this.listeners]) listener(state);
  }
}
