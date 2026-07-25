import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopRepeat,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import { LEGS, isFront, legSide, type LegName, type QuadrupedBone, type QuadrupedRig } from './quadruped';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;

const smooth = (t: number): number => t * t * (3 - 2 * t);
const wrap01 = (t: number): number => t - Math.floor(t);

export type GaitName = 'idle' | 'walk' | 'trot' | 'canter' | 'gallop';

/**
 * A gait, described the way a horseman would describe it: how many beats,
 * which foot lands when, and how much of each stride a foot spends on the
 * ground.
 *
 * The `contact` phases ARE the gait. Get them wrong and no amount of
 * secondary motion will save it — a horse whose diagonals are out of sync
 * reads as broken to anyone who has watched one move, and oddly wrong to
 * everyone else.
 */
export interface GaitSpec {
  name: GaitName;
  /** Audible beats per stride — 4, 2, 3, 4. */
  beats: number;
  /** Stride duration in seconds at the reference speed. */
  duration: number;
  /**
   * Phase (0..1 of the stride) at which each foot lands, in LEGS order
   * [LF, RF, LH, RH].
   */
  contact: Record<LegName, number>;
  /** Fraction of the stride each foot spends on the ground. */
  duty: number;
  /**
   * How far the limbs swing, in radians — half the total protraction /
   * retraction arc.
   *
   * This, and NOT a hand-picked stride length, is what sets the gait's
   * ground speed: see `gaitSpeed`. A declared stride that the legs cannot
   * actually deliver is precisely how a horse ends up skating.
   */
  reach: number;
  /** Vertical travel of the body, as a fraction of withers height. */
  bob: number;
  /**
   * How much the head nods per stride, and at what rate. Horses nod at
   * walk and canter and DON'T at trot — the trot's diagonal pairs keep
   * the body level, which is exactly why a rider can post to it. Getting
   * this backwards is the most visible mistake in an animated horse.
   */
  nod: number;
  nodRate: number;
}

/**
 * The four natural gaits, with the footfall order horse people recite.
 *
 * - **walk** — 4 beats, *lateral* sequence: LH, LF, RH, RF. Two or three
 *   feet are down at all times; there is no moment of suspension.
 * - **trot** — 2 beats, *diagonal* pairs: LF+RH, then RF+LH, with a beat
 *   of suspension between. The level one.
 * - **canter** — 3 beats. On the right lead: left hind, then the diagonal
 *   pair (right hind + left fore), then the leading right fore, then
 *   suspension. The rocking-horse gait, and it is asymmetric by nature.
 * - **gallop** — 4 beats, the canter's diagonal pair split apart: LH, RH,
 *   LF, RF, then a long suspension with all four feet off the ground.
 */
export const GAITS: Record<Exclude<GaitName, 'idle'>, GaitSpec> = {
  walk: {
    name: 'walk',
    beats: 4,
    duration: 1.15,
    contact: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 },
    duty: 0.62,
    reach: 0.45,
    bob: 0.012,
    nod: 0.13,
    nodRate: 1,
  },
  trot: {
    name: 'trot',
    beats: 2,
    duration: 0.72,
    contact: { LF: 0, RH: 0, RF: 0.5, LH: 0.5 },
    duty: 0.42,
    reach: 0.46,
    bob: 0.032,
    nod: 0.015, // level: this is the gait you can post to
    nodRate: 2,
  },
  canter: {
    name: 'canter',
    beats: 3,
    // Right lead: LH alone → RH+LF diagonal → RF (leading) → suspension.
    contact: { LH: 0, RH: 0.28, LF: 0.28, RF: 0.56 },
    duration: 0.62,
    duty: 0.35,
    reach: 0.55,
    bob: 0.055,
    nod: 0.12,
    nodRate: 1,
  },
  gallop: {
    name: 'gallop',
    beats: 4,
    // The canter's diagonal comes apart; suspension after the lead fore.
    contact: { LH: 0, RH: 0.13, LF: 0.37, RF: 0.5 },
    duration: 0.52,
    duty: 0.27,
    reach: 0.72,
    bob: 0.062,
    nod: 0.2,
    nodRate: 1,
  },
};

/** A pose being authored: bone rotations plus the body's vertical travel. */
class QuadPose {
  rotations = new Map<QuadrupedBone, Quaternion>();
  hipsY = 0;
  hipsZ = 0;

  rotate(bone: QuadrupedBone, ...steps: Array<[Vector3, number]>): void {
    const q = new Quaternion();
    const step = new Quaternion();
    for (const [axis, angle] of steps) q.multiply(step.setFromAxisAngle(axis, angle));
    this.rotations.set(bone, q);
  }
}

/** Sample a pose function into a loop-seamless clip. */
function buildQuadClip(
  rig: QuadrupedRig,
  name: string,
  duration: number,
  fps: number,
  sample: (phase: number, pose: QuadPose) => void
): AnimationClip {
  const frames = Math.max(8, Math.round(duration * fps));
  const times = new Float32Array(frames + 1);
  const probe = new QuadPose();
  sample(0, probe);
  const boneNames = [...probe.rotations.keys()];
  const values = new Map(boneNames.map((b) => [b, new Float32Array((frames + 1) * 4)]));
  const hips = new Float32Array((frames + 1) * 3);
  const rest = rig.bones.Hips.position;

  for (let i = 0; i <= frames; i++) {
    times[i] = (i * duration) / frames;
    const pose = new QuadPose();
    sample(i === frames ? 0 : i / frames, pose); // last frame = first: seamless
    for (const b of boneNames) {
      const q = pose.rotations.get(b) ?? new Quaternion();
      values.get(b)!.set([q.x, q.y, q.z, q.w], i * 4);
    }
    hips.set([rest.x, pose.hipsY, rest.z + pose.hipsZ], i * 3);
  }

  const tracks: QuaternionKeyframeTrack[] = boneNames.map(
    (b) =>
      new QuaternionKeyframeTrack(
        `${b}.quaternion`,
        times as unknown as number[],
        values.get(b)! as unknown as number[]
      )
  );
  const clip = new AnimationClip(name, duration, tracks);
  clip.tracks.push(
    new VectorKeyframeTrack('Hips.position', times as unknown as number[], hips as unknown as number[])
  );
  return clip;
}

/**
 * One leg's contribution at stride phase `p`.
 *
 * A limb cycle is two different motions stitched together. In **stance**
 * the hoof is planted and the body travels over it, so the limb sweeps
 * backward at a steady rate — anything else makes the foot skate. In
 * **swing** the limb folds, carries forward, and unfolds to land: the
 * fold is what gives a horse its knee action, and its absence is why bad
 * horse animation looks like a rocking toy.
 */
interface LimbState {
  swing: number; // + forward, − back
  fold: number; // 0..1 how far the limb is folded up
  stance: boolean; // is the hoof on the ground?
  /** Attach-point-to-hoof length, as a fraction of withers height. */
  reach: number;
}

/** Attach-point-to-hoof length, as a fraction of withers height. */
const FRONT_REACH = 0.62;
const HIND_REACH = 0.68;

/** Where a limb is in its own cycle at stride phase `p`. */
function limbState(leg: LegName, p: number, spec: GaitSpec): LimbState {
  const front = isFront(leg);
  const t = wrap01(p - spec.contact[leg]); // time since this foot landed
  const D = spec.duty;
  // Fore and hind sweep the SAME distance along the ground. A horse
  // "tracks up" — the hind foot lands in the print the forefoot just left —
  // and geometrically it has to: one body cannot travel at two speeds. The
  // foreleg is shorter, so it swings through a wider angle to cover the
  // same ground.
  const A = front ? Math.asin(Math.min(1, (HIND_REACH / FRONT_REACH) * Math.sin(spec.reach))) : spec.reach;
  const reach = front ? FRONT_REACH : HIND_REACH; // shoulder→hoof / hip→hoof
  if (t < D) {
    // Stance: planted. Linear sweep — the hoof must not slide.
    const u = t / D;
    return { swing: A * (1 - 2 * u), fold: 0, stance: true, reach };
  }
  // Swing: fold, carry through, unfold to land reaching forward.
  const u = (t - D) / (1 - D);
  return { swing: -A + 2 * A * smooth(u), fold: Math.sin(Math.PI * u) ** 0.8, stance: false, reach };
}

/**
 * How high the body must ride so that every planted hoof stays planted.
 *
 * A limb swinging as a rigid pendulum sweeps its foot along an *arc*. Hold
 * the body at a fixed height and the hoof rises at both ends of the stance
 * — the horse pogos along on stiff legs. But the foot is the thing that is
 * actually fixed: the body is what moves, vaulting up and over the
 * supporting limb and dropping again as the stride opens out. So the
 * body's height is not a free parameter to tune by eye — it *falls out of*
 * the legs, and deriving it here is what keeps hooves from skating.
 */
function bodyRide(p: number, spec: GaitSpec): number {
  // The body must clear the TALLEST demand among the planted limbs: a leg
  // straight under the body (swing ≈ 0) props it highest, and one reaching
  // out at the end of its stance props it least. Take the max and every
  // hoof stays at or above the ground.
  let need = -Infinity;
  let airborne = -Infinity;
  for (const leg of LEGS) {
    const st = limbState(leg, p, spec);
    // How much this limb LOWERS the body relative to standing square. It
    // has to be the change, not the absolute length: fore and hind limbs
    // are different lengths, and comparing those directly would let the
    // longer pair win every time and leave the other pair's hooves
    // hanging in the air.
    const drop = st.reach * (Math.cos(st.swing) - 1);
    airborne = Math.max(airborne, drop);
    if (st.stance) need = Math.max(need, drop);
  }
  // Suspension: no limb is holding the horse up, so nothing pulls it down
  // either — it coasts at full height until the next hoof lands. (Following
  // the airborne limbs here instead would duck the body at exactly the
  // moment a trotter is supposed to be floating.)
  void airborne;
  return need === -Infinity ? 0 : need;
}

function poseLeg(pose: QuadPose, leg: LegName, p: number, spec: GaitSpec): void {
  const front = isFront(leg);
  const { swing, fold } = limbState(leg, p, spec);

  const upper = `${leg}Upper` as QuadrupedBone;
  const lower = `${leg}Lower` as QuadrupedBone;
  const cannon = `${leg}Cannon` as QuadrupedBone;
  const hoof = `${leg}Hoof` as QuadrupedBone;
  const s = legSide(leg);

  if (front) {
    // Foreleg folds at the carpus, which hinges BACKWARD — the forearm
    // stays put and the cannon comes up under it.
    pose.rotate(upper, [X, -swing], [Z, s * 0.012]);
    pose.rotate(lower, [X, fold * (0.35 + 0.12 * Math.max(0, swing))]);
    pose.rotate(cannon, [X, 1.5 * fold]);
    pose.rotate(hoof, [X, -0.75 * fold + 0.35 * swing * fold]);
  } else {
    // Hind leg folds at hock and stifle together, and drives from the
    // hip — the propulsion comes from behind.
    pose.rotate(upper, [X, -swing * 0.95], [Z, s * 0.01]);
    pose.rotate(lower, [X, fold * (0.55 - 0.18 * Math.max(0, swing))]);
    pose.rotate(cannon, [X, -1.15 * fold]);
    pose.rotate(hoof, [X, 0.6 * fold + 0.3 * swing * fold]);
  }
}

/**
 * The body's ride height across a whole stride, smoothed and centred.
 *
 * Sampled straight from `bodyRide` the curve has a corner at every
 * touchdown and a step where the last hoof leaves the ground. A body has
 * mass and cannot turn corners like that; unsmoothed, the horse twitches
 * once per footfall. A circular box blur over ~8% of the stride is enough
 * to make it behave like something being carried by legs rather than
 * teleported between them.
 */
function rideTable(spec: GaitSpec, resolution = 240): (p: number) => number {
  const raw = new Float64Array(resolution);
  for (let i = 0; i < resolution; i++) raw[i] = bodyRide(i / resolution, spec);
  const window = Math.max(2, Math.round(resolution * 0.075));
  const smoothed = new Float64Array(resolution);
  let mean = 0;
  for (let i = 0; i < resolution; i++) {
    let sum = 0;
    for (let k = -window; k <= window; k++) sum += raw[(i + k + resolution * 2) % resolution];
    smoothed[i] = sum / (window * 2 + 1);
    mean += smoothed[i];
  }
  mean /= resolution;
  return (p: number) => {
    const x = wrap01(p) * resolution;
    const i = Math.floor(x);
    const f = x - i;
    const a = smoothed[i % resolution];
    const b = smoothed[(i + 1) % resolution];
    return a + (b - a) * f - mean;
  };
}

export interface QuadrupedClips {
  idle: AnimationClip;
  walk: AnimationClip;
  trot: AnimationClip;
  canter: AnimationClip;
  gallop: AnimationClip;
  /** Ground speed each clip is authored for, m/s — for stride matching. */
  speeds: Record<Exclude<GaitName, 'idle'>, number>;
}

export interface GaitOptions {
  fps?: number;
  /** Overall tempo multiplier. */
  tempo?: number;
}

/**
 * The ground speed a gait actually carries the body at.
 *
 * This is not a style choice, it is arithmetic. While a hoof is planted it
 * sweeps a fixed arc under the body — `2·R·sin(reach)` for a limb of
 * length R — and the body must cover exactly that distance in exactly the
 * time the hoof is down (`duty × duration`). Move faster and the hoof
 * skates; slower and the horse moonwalks.
 *
 * Declaring a stride length by hand instead is the classic way to get this
 * wrong: the number looks plausible, the legs cannot deliver it, and the
 * animal slides along the ground with its legs cycling uselessly.
 */
export function gaitSpeed(rig: QuadrupedRig, spec: GaitSpec): number {
  // Fore and hind are matched to sweep the same distance (see `limbState`),
  // so either one gives the answer.
  const sweep = 2 * HIND_REACH * Math.sin(spec.reach) * rig.height;
  return sweep / (spec.duty * spec.duration);
}

/**
 * Synthesize the four gaits plus a standing idle for a quadruped rig —
 * no animation files, deterministic, loop-seamless, and in place.
 */
export function createGaitClips(rig: QuadrupedRig, options: GaitOptions = {}): QuadrupedClips {
  const fps = options.fps ?? 30;
  const tempo = options.tempo ?? 1;
  const H = rig.height;
  const restY = rig.bones.Hips.position.y;

  const build = (spec: GaitSpec): AnimationClip => {
    // The body's ride height comes from the legs — but sampled raw it has
    // a corner at every touchdown and lift-off, and a step where the last
    // hoof leaves the ground. A body has mass: it cannot turn corners. So
    // smooth the curve and centre it, which is both what the physics does
    // and what stops the horse twitching at each footfall.
    const ride = rideTable(spec);

    return buildQuadClip(rig, spec.name, spec.duration / tempo, fps, (p, pose) => {
      for (const leg of LEGS) poseLeg(pose, leg, p, spec);

      // Vault height from the stance legs (see `bodyRide`), plus a little
      // stylistic spring on top for the running gaits.
      const bobRate = spec.beats === 3 || spec.name === 'gallop' ? 1 : 2;
      pose.hipsY =
        restY +
        ride(p) * H +
        spec.bob * 0.35 * H * Math.sin(TAU * bobRate * p + 0.6);

      // Back and quarters. In canter and gallop the spine flexes and
      // extends through the stride — the horse gathers, then unfolds.
      const gather = spec.name === 'canter' || spec.name === 'gallop' ? 1 : 0;
      const flex = gather * 0.1 * Math.sin(TAU * p - 0.4);
      pose.rotate('Hips', [X, flex * 1.1], [Y, spec.name === 'walk' ? 0.035 * Math.sin(TAU * p) : 0]);
      pose.rotate('Spine', [X, -flex * 0.6]);
      pose.rotate('Chest', [X, -flex * 0.5]);

      // Head and neck. The nod is the horse's balancing pole: it swings
      // in time with the stride at walk and canter, and stays level at
      // trot. `nodRate` keeps the phase honest.
      const nod = spec.nod * Math.sin(TAU * spec.nodRate * p + 0.2);
      pose.rotate('Neck', [X, nod * 0.55 - gather * 0.06]);
      pose.rotate('Head', [X, -nod * 0.35]); // the eyes stay on the horizon

      // The tail lifts and streams as the pace picks up.
      const lift = 0.1 + spec.reach * 0.55;
      pose.rotate('Tail', [X, -lift + 0.05 * Math.sin(TAU * p)]);
      pose.rotate('TailTip', [X, -lift * 0.5 + 0.09 * Math.sin(TAU * p + 1)], [Z, 0.06 * Math.sin(TAU * p + 2)]);
    });
  };

  // Standing: weight shifts, a slow breath, an ear-flick's worth of head.
  const idle = buildQuadClip(rig, 'idle', 4.2 / tempo, fps, (p, pose) => {
    const breath = Math.sin(TAU * p);
    for (const leg of LEGS) {
      const front = isFront(leg);
      const s = legSide(leg);
      pose.rotate(`${leg}Upper` as QuadrupedBone, [X, 0.01 * breath], [Z, s * 0.012]);
      pose.rotate(`${leg}Lower` as QuadrupedBone, [X, front ? 0.02 : 0.03]);
      pose.rotate(`${leg}Cannon` as QuadrupedBone, [X, 0]);
      pose.rotate(`${leg}Hoof` as QuadrupedBone, [X, 0]);
    }
    pose.hipsY = restY + 0.0016 * H * breath;
    pose.rotate('Hips', [Z, 0.008 * Math.sin(TAU * p + 1)]);
    pose.rotate('Spine', [X, 0.004 * breath]);
    pose.rotate('Chest', [X, 0.006 * breath]);
    pose.rotate('Neck', [X, 0.03 + 0.02 * Math.sin(TAU * p + 0.5)]);
    pose.rotate('Head', [Y, 0.06 * Math.sin(TAU * p + 2)], [X, -0.02 * breath]);
    pose.rotate('Tail', [X, -0.12], [Z, 0.07 * Math.sin(TAU * p * 2)]);
    pose.rotate('TailTip', [X, -0.06], [Z, 0.12 * Math.sin(TAU * p * 2 + 0.8)]);
  });

  return {
    idle,
    walk: build(GAITS.walk),
    trot: build(GAITS.trot),
    canter: build(GAITS.canter),
    gallop: build(GAITS.gallop),
    speeds: {
      walk: gaitSpeed(rig, GAITS.walk) * tempo,
      trot: gaitSpeed(rig, GAITS.trot) * tempo,
      canter: gaitSpeed(rig, GAITS.canter) * tempo,
      gallop: gaitSpeed(rig, GAITS.gallop) * tempo,
    },
  };
}

export interface QuadrupedLocomotionOptions extends GaitOptions {
  /** Below this speed the animal is standing. Default 0.15 m/s. */
  idleThreshold?: number;
  /** Crossfade time between gaits, seconds. Default 0.28. */
  blend?: number;
}

type GaitListener = (to: GaitName, from: GaitName) => void;

/**
 * Drives a quadruped from a single number: how fast it is going.
 *
 * Unlike a biped — where walk and run blend continuously into each other —
 * horses **change gait**, and the change is a discrete event with a
 * transition, not a crossfade you can sit in the middle of. There is no
 * such thing as half a trot. So this picks the gait whose speed the
 * animal is nearest, crossfades to it, and then stride-matches *within*
 * the gait by scaling playback, which is what keeps hooves from skating.
 *
 * ```ts
 * const gaits = new QuadrupedLocomotion(horse);
 * game.onUpdate((t) => gaits.update(t.delta, agent.velocity));
 * gaits.gait;                       // 'walk' | 'trot' | 'canter' | 'gallop'
 * gaits.onGaitChange((to) => hud.set(to));
 * ```
 */
export class QuadrupedLocomotion {
  readonly mixer: AnimationMixer;
  readonly clips: QuadrupedClips;
  /**
   * Playback rate is clamped to this band. It has to be wide enough to
   * span each gait's whole operating range — from the idle threshold up to
   * the speed the next gait takes over — because **any clamping is
   * skating**: the moment playback stops tracking ground speed, the hooves
   * stop agreeing with the floor. The band exists only as a backstop
   * against absurd inputs, not as a stylistic limit.
   */
  readonly rateRange: [number, number] = [0.1, 1.9];

  private readonly actions: Record<GaitName, AnimationAction>;
  private readonly idleThreshold: number;
  private readonly blend: number;
  private readonly listeners = new Set<GaitListener>();
  private current: GaitName = 'idle';
  private smoothed = 0;

  constructor(rig: QuadrupedRig, options: QuadrupedLocomotionOptions = {}) {
    this.clips = createGaitClips(rig, options);
    this.idleThreshold = options.idleThreshold ?? 0.15;
    this.blend = options.blend ?? 0.28;
    this.mixer = new AnimationMixer(rig.mesh);
    this.actions = {
      idle: this.mixer.clipAction(this.clips.idle),
      walk: this.mixer.clipAction(this.clips.walk),
      trot: this.mixer.clipAction(this.clips.trot),
      canter: this.mixer.clipAction(this.clips.canter),
      gallop: this.mixer.clipAction(this.clips.gallop),
    };
    for (const action of Object.values(this.actions)) {
      action.setLoop(LoopRepeat, Infinity);
      action.play();
      action.setEffectiveWeight(0);
    }
    this.actions.idle.setEffectiveWeight(1);
  }

  /** The gait being ridden right now. */
  get gait(): GaitName {
    return this.current;
  }

  /** Smoothed ground speed, m/s. */
  get speed(): number {
    return this.smoothed;
  }

  /** Fires when the animal changes gait. Returns an unsubscribe. */
  onGaitChange(listener: GaitListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Which gait suits this speed — the same call the animal makes. */
  gaitFor(speed: number): GaitName {
    if (speed < this.idleThreshold) return 'idle';
    const { walk, trot, canter, gallop } = this.clips.speeds;
    // Change up at the point the current gait would have to over-stride,
    // which is roughly the midpoint between neighbouring gait speeds.
    if (speed < (walk + trot) / 2) return 'walk';
    if (speed < (trot + canter) / 2) return 'trot';
    if (speed < (canter + gallop) / 2) return 'canter';
    return 'gallop';
  }

  /** Force a gait (a rider asking for it), regardless of speed. */
  setGait(gait: GaitName): void {
    if (gait === this.current) return;
    const from = this.current;
    this.actions[from].fadeOut(this.blend);
    const next = this.actions[gait];
    next.reset();
    // `fadeIn` SCALES an action's intrinsic weight — it does not set it. An
    // action parked at `setEffectiveWeight(0)` therefore fades from zero to
    // zero and never animates a thing, however healthily the mixer ticks
    // over. Restore the intrinsic weight first, then fade.
    next.setEffectiveWeight(1);
    next.fadeIn(this.blend);
    next.play();
    this.current = gait;
    for (const listener of [...this.listeners]) listener(gait, from);
  }

  /** Advance. `velocity` is a Vector3 or a scalar speed. */
  update(dt: number, velocity: Vector3 | number = 0): void {
    const target = typeof velocity === 'number' ? Math.abs(velocity) : velocity.length();
    const k = 1 - Math.exp(-dt * 6);
    this.smoothed += (target - this.smoothed) * k;

    const want = this.gaitFor(this.smoothed);
    if (want !== this.current) this.setGait(want);

    // Stride-match inside the gait: play faster when moving faster than
    // the clip was authored for, so the hooves keep up with the ground.
    if (this.current !== 'idle') {
      const reference = this.clips.speeds[this.current as Exclude<GaitName, 'idle'>];
      const rate = Math.max(this.rateRange[0], Math.min(this.rateRange[1], this.smoothed / reference));
      this.actions[this.current].timeScale = rate;
    }
    this.mixer.update(dt);
  }
}
