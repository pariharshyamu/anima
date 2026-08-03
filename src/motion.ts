import { AnimationMixer, LoopRepeat, Quaternion, Vector3 } from 'three';
import type { AnimationAction } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';
import { createLocomotionClips } from './clips';
import type { LocomotionClips } from './clips';

/**
 * Motion matching — and the weights are units, not opinions.
 *
 * Motion matching replaces a blend tree with a search. You hold a database of
 * poses, each described by a FEATURE VECTOR; every frame you build a query out
 * of what the character is doing and what it has been asked to do, and you play
 * whichever frame is nearest. There is no state machine and no blend graph: the
 * data is the controller.
 *
 * The part every implementation has in common is a cost function that looks
 * like this, with a table of weights beside it:
 *
 *   cost = Σ wᵢ (aᵢ − bᵢ)²        w_footPosition = 1.0
 *                                 w_footVelocity = 0.4     ← why 0.4?
 *                                 w_trajectory   = 1.5     ← why 1.5?
 *                                 w_facing       = 0.8     ← why 0.8?
 *
 * Nobody can say why. They are tuned by eye, they are re-tuned per character,
 * and they are the reason motion matching has a reputation for being fiddly.
 *
 * ## They are not tuning parameters. They are unit conversions.
 *
 * Look at what is being added. Foot position is in METRES. Foot velocity is in
 * METRES PER SECOND. Facing is in RADIANS. Those are three different units, and
 * **a sum of them is not a quantity at all** — it is a type error that happens
 * to compile.
 *
 * The weights are what makes the sum finite, which means each weight is
 * silently carrying whatever conversion factor its term needed. And a
 * conversion factor is not free: it is fixed by dimensional analysis, up to one
 * scalar per unit you have to eliminate.
 *
 * Here there is exactly one:
 *
 *   a velocity becomes a length when you multiply it by a TIME
 *   an angle becomes a length when you multiply it by a RADIUS
 *
 * So the whole table collapses to one time constant and one lever arm, every
 * term of the cost is in square metres, and every weight is 1.
 *
 * ## The test a weighted cost cannot pass
 *
 * If the weights really were preferences, then writing the velocities in a
 * different unit — the same velocities, a different name for them — could not
 * change which frame is nearest. It does:
 *
 *   velocity written in    weighted cost picks    cost in lengths picks
 *   m/s                    B                      B
 *   m/ms                   A                      B
 *   m/min                  B                      B
 *
 * A hand-weighted cost has an answer that depends on what unit somebody typed
 * the database in. That is the whole argument, and `npm run motion` runs it on
 * the real database rather than on a toy.
 *
 * ## Where the time constant comes from
 *
 * They are real numbers and they have to come from somewhere, so they come from
 * the DATA: `τ = σ(position) / σ(that quantity)` over the database, which is
 * the time that makes the two spans of numbers the same size. Measured, not
 * chosen; it changes when the database changes; nothing to re-tune per
 * character.
 *
 * There is one per quantity being converted, and that is not a detail. Foot
 * velocity and travel speed are both velocities and they are NOT the same
 * velocity: the feet swing at 2.2 m/s of spread and the gaits differ by 1.1,
 * so their conversions differ by two. Sharing one constant between them is the
 * tidy-looking mistake, and with the foot figure used for both, the travel term
 * is too quiet to overcome pose continuity — the character stands in idle
 * through every command it is given, at a mean speed error of 1.27 m/s. That is
 * not a hypothetical; it is what this file did first.
 *
 * What a τ MEANS is the exchange rate between "stay in the pose I am in" and
 * "do what I was asked". The honest statement is that it cannot be zero and it
 * cannot be shared, not that some optimum was discovered.
 */

const GRAVITY = 9.81;

/** The one lever arm: an angle becomes a length across the hips. */
export const FACING_RADIUS = 0.5;

export type MotionClipName = 'idle' | 'walk' | 'run';

/** One entry: a pose, and the thirteen lengths that describe it. */
export interface MotionFrame {
  clip: MotionClipName;
  /** Seconds into the clip. */
  time: number;
  /** 0..1 through the cycle. */
  phase: number;
  /** Playback rate this entry stands for. */
  rate: number;
  /** Ground speed it implies, m/s — the clip's stride-matched speed times rate. */
  speed: number;
  /**
   * Fifteen numbers, and every one of them is a length in metres: both feet
   * (6), both foot velocities × τ (6), and how far the character will have
   * travelled by each of three horizons (3).
   */
  feature: number[];
}

export interface MotionDatabase {
  frames: MotionFrame[];
  clips: LocomotionClips;
  /**
   * Seconds — the time that turns a FOOT VELOCITY into a length.
   * `σ(position) / σ(footVelocity)` over the database's own samples.
   */
  tauFoot: number;
  /**
   * The three horizons the trajectory is sampled at, seconds: a third, two
   * thirds and all of one step.
   *
   * These are not a conversion and they are not a weight. `speed × horizon` is
   * ALREADY a length — it is how far the character will have gone — so the
   * trajectory terms need nothing done to them to be added to foot positions.
   *
   * One step, because that is the interval over which a walker can do anything
   * about an instruction: you can only redirect at a footfall.
   */
  horizons: number[];
  /** Metres. The spread both conversions are measured against. */
  positionSpread: number;
  /** Metres per second — how much the feet move. */
  footSpread: number;
  /** Metres per second — how much the database's gait speeds differ. */
  travelSpread: number;
  rates: number[];
  samples: number;
  /** Seconds — one step, half a walk cycle. What a jump is hidden over. */
  stepTime: number;
}

export interface MotionDatabaseOptions {
  clips?: LocomotionClips;
  /** Playback rates to stock the database with. Default 0.7 … 1.3 in five. */
  rates?: number[];
  /** Samples per cycle. Default 48. */
  samples?: number;
  /**
   * Override the two conversion times, seconds. They exist so the gate can
   * drive them to the wrong values and watch the controller break — not
   * because there is anything here to tune.
   */
  tauFoot?: number;
  /** Override the trajectory horizons, seconds. Same reason. */
  horizons?: number[];
}

const CLIPS: MotionClipName[] = ['walk', 'run', 'idle'];

interface RawSample {
  clip: MotionClipName;
  index: number;
  time: number;
  phase: number;
  duration: number;
  speed: number;
  left: Vector3;
  right: Vector3;
  leftVelocity: Vector3;
  rightVelocity: Vector3;
}

/** Standard deviation about the mean, over every component handed in. */
function spreadOf(values: number[]): number {
  if (!values.length) return 0;
  let mean = 0;
  for (const v of values) mean += v;
  mean /= values.length;
  let sum = 0;
  for (const v of values) sum += (v - mean) * (v - mean);
  return Math.sqrt(sum / values.length);
}

/**
 * Sample the clips the same way `measureFootSkate` does — through a real
 * `AnimationMixer` on the real rig.
 *
 * Not a reimplementation of the curve evaluation, for the reason the skate gate
 * gives: a feature vector computed from a second copy of the maths only proves
 * the two copies agree.
 */
function sampleClips(rig: HumanoidRig, clips: LocomotionClips, samples: number): RawSample[] {
  const mixer = new AnimationMixer(rig.mesh);
  const actions: Record<string, AnimationAction> = {};
  for (const name of CLIPS) {
    const action = mixer.clipAction(clips[name]);
    action.setLoop(LoopRepeat, Infinity);
    action.play();
    action.paused = true;
    action.weight = 0;
    actions[name] = action;
  }
  const pose = (name: MotionClipName, time: number): void => {
    for (const other of CLIPS) actions[other].weight = other === name ? 1 : 0;
    const d = clips[name].duration;
    actions[name].time = ((time % d) + d) % d;
    mixer.update(0);
    rig.object.updateMatrixWorld(true);
  };
  const foot = (side: 'Left' | 'Right'): Vector3 =>
    rig.bones[`${side}Foot`]
      .getWorldPosition(new Vector3())
      .sub(rig.bones.Hips.getWorldPosition(new Vector3()));

  const speeds: Record<MotionClipName, number> = {
    walk: clips.walkSpeed,
    run: clips.runSpeed,
    idle: 0,
  };

  const out: RawSample[] = [];
  for (const clip of CLIPS) {
    const duration = clips[clip].duration;
    const h = duration / 4000;
    for (let i = 0; i < samples; i++) {
      const time = (i / samples) * duration;
      pose(clip, time);
      const left = foot('Left');
      const right = foot('Right');
      pose(clip, time + h);
      const leftVelocity = foot('Left').sub(left).divideScalar(h);
      const rightVelocity = foot('Right').sub(right).divideScalar(h);
      out.push({
        clip, index: i, time, phase: i / samples, duration,
        speed: speeds[clip], left, right, leftVelocity, rightVelocity,
      });
    }
  }
  mixer.stopAllAction();
  return out;
}

function featureOf(
  s: RawSample, rate: number, tauFoot: number, horizons: number[]
): number[] {
  const f = rate * tauFoot;
  const out = [
    s.left.x, s.left.y, s.left.z,
    s.right.x, s.right.y, s.right.z,
    s.leftVelocity.x * f, s.leftVelocity.y * f, s.leftVelocity.z * f,
    s.rightVelocity.x * f, s.rightVelocity.y * f, s.rightVelocity.z * f,
  ];
  // ...and how far it will have travelled by each horizon, which is a length.
  for (const h of horizons) out.push(s.speed * rate * h);
  return out;
}

/**
 * Build the searchable database from the rig's own procedural clips.
 *
 * The clips are in-place and stride-matched, so playing one at rate `r` is a
 * real gait at `r ×` its declared speed — which is why a continuum of speeds
 * comes out of three clips without capturing anything.
 */
export function buildMotionDatabase(
  rig: HumanoidRig,
  options: MotionDatabaseOptions = {}
): MotionDatabase {
  const clips = options.clips ?? createLocomotionClips(rig);
  const rates = options.rates ?? [0.7, 0.85, 1, 1.15, 1.3];
  const samples = options.samples ?? 48;
  const raw = sampleClips(rig, clips, samples);

  // The conversions, measured. Idle is left out of the foot figures: a foot
  // that never moves has no velocity spread and would drag the ratio to
  // infinity.
  const positions: number[] = [];
  const footVelocities: number[] = [];
  const travels: number[] = [];
  for (const s of raw) {
    if (s.clip !== 'idle') {
      positions.push(s.left.x, s.left.y, s.left.z, s.right.x, s.right.y, s.right.z);
      footVelocities.push(
        s.leftVelocity.x, s.leftVelocity.y, s.leftVelocity.z,
        s.rightVelocity.x, s.rightVelocity.y, s.rightVelocity.z
      );
    }
    for (const rate of s.clip === 'idle' ? [1] : rates) travels.push(s.speed * rate);
  }
  const positionSpread = spreadOf(positions);
  const footSpread = spreadOf(footVelocities);
  const travelSpread = spreadOf(travels);
  const tauFoot = options.tauFoot ?? (footSpread > 0 ? positionSpread / footSpread : 0);
  const stepTime = clips.walk.duration / 2;
  const horizons = options.horizons ?? [stepTime / 3, (2 * stepTime) / 3, stepTime];

  const frames: MotionFrame[] = [];
  for (const s of raw) {
    for (const rate of s.clip === 'idle' ? [1] : rates) {
      frames.push({
        clip: s.clip, time: s.time, phase: s.phase, rate,
        speed: s.speed * rate,
        feature: featureOf(s, rate, tauFoot, horizons),
      });
    }
  }

  return {
    frames, clips, tauFoot, horizons, positionSpread, footSpread, travelSpread,
    rates, samples, stepTime,
  };
}

export interface MotionQuery {
  /** Where the left foot is now, relative to the hips, metres. */
  left: Vector3;
  right: Vector3;
  /** How it is moving, m/s. */
  leftVelocity: Vector3;
  rightVelocity: Vector3;
  /** The speed being asked for, m/s. */
  speed: number;
}

/** The query as thirteen lengths, in the same order and the same units. */
export function queryFeature(db: MotionDatabase, q: MotionQuery): number[] {
  const t = db.tauFoot;
  const out = [
    q.left.x, q.left.y, q.left.z,
    q.right.x, q.right.y, q.right.z,
    q.leftVelocity.x * t, q.leftVelocity.y * t, q.leftVelocity.z * t,
    q.rightVelocity.x * t, q.rightVelocity.y * t, q.rightVelocity.z * t,
  ];
  for (const h of db.horizons) out.push(q.speed * h);
  return out;
}

export interface MotionMatch {
  frame: MotionFrame;
  /** Square metres. Every term of it. */
  cost: number;
  index: number;
}

/**
 * The search: nearest frame, plain sum of squares, no weights.
 *
 * There is nothing to weight. Every component of both vectors is a length in
 * metres, so this is an ordinary squared distance in a thirteen-dimensional
 * space whose axes all mean the same thing.
 */
export function matchFrame(db: MotionDatabase, feature: number[]): MotionMatch {
  let best = 0;
  let bestCost = Infinity;
  for (let i = 0; i < db.frames.length; i++) {
    const f = db.frames[i].feature;
    let cost = 0;
    for (let k = 0; k < feature.length; k++) {
      const d = f[k] - feature[k];
      cost += d * d;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  }
  return { frame: db.frames[best], cost: bestCost, index: best };
}

export interface MotionMatcherOptions extends MotionDatabaseOptions {
  database?: MotionDatabase;
  /**
   * How often to search, seconds. Default one tenth of a step — often enough
   * that a command is answered inside a footfall, rare enough that the search
   * is not the frame budget.
   */
  searchInterval?: number;
}

/**
 * A locomotion controller that is a search rather than a blend tree.
 *
 * ```ts
 * const matcher = new MotionMatcher(rig);
 * game.onUpdate(({ delta }) => matcher.update(delta, agent.velocity));
 * ```
 *
 * It plays the chosen frame forward and searches every `searchInterval`. When
 * the search lands somewhere else the pose would step, so the difference is
 * carried as a per-bone offset and released over ONE STEP — the interval in
 * which every foot changes state anyway, and therefore the longest a stale
 * offset can survive without moving a planted foot.
 */
export class MotionMatcher {
  readonly database: MotionDatabase;
  readonly mixer: AnimationMixer;
  private readonly actions: Record<string, AnimationAction> = {};
  private readonly rig: HumanoidRig;
  private readonly searchInterval: number;

  /** The frame currently playing. */
  frame: MotionFrame;
  /** Seconds into it. */
  time: number;
  /** How many times the search has moved somewhere discontinuous. */
  jumps = 0;
  /** How many searches have run. `jumps / searches` is the pop rate. */
  searches = 0;
  /** Signed phase error of the last search, in cycles. Diagnostic. */
  lastPhaseShift = 0;
  /**
   * Searches whose best answer was somewhere discontinuous.
   *
   * The same count as `jumps` here, and kept separate because it measures a
   * different thing: how often the search DISAGREES with just carrying on,
   * which is the ambiguity the foot-velocity term exists to settle.
   */
  contested = 0;
  /** Seconds the controller has run. */
  elapsed = 0;
  /** Ground speed the playing frame implies, m/s. */
  get speed(): number {
    return this.frame.speed;
  }

  private sinceSearch = 0;
  private fadeFrom: Float32Array | null = null;
  private fadeHipsY = 0;
  private fadeAge = Infinity;
  private readonly left = new Vector3();
  private readonly right = new Vector3();
  private readonly leftVelocity = new Vector3();
  private readonly rightVelocity = new Vector3();
  private readonly scratch = new Vector3();
  private readonly scratchQ = new Quaternion();

  constructor(rig: HumanoidRig, options: MotionMatcherOptions = {}) {
    this.rig = rig;
    this.database = options.database ?? buildMotionDatabase(rig, options);
    this.searchInterval = options.searchInterval ?? this.database.stepTime / 10;
    this.mixer = new AnimationMixer(rig.mesh);
    for (const name of CLIPS) {
      const action = this.mixer.clipAction(this.database.clips[name]);
      action.setLoop(LoopRepeat, Infinity);
      action.play();
      action.paused = true;
      action.weight = 0;
      this.actions[name] = action;
    }
    this.frame = this.database.frames.find((f) => f.clip === 'idle') ?? this.database.frames[0];
    this.time = this.frame.time;
    this.pose(this.frame.clip, this.time);
    this.readFeet(0);
  }

  private pose(clip: MotionClipName, time: number): void {
    for (const other of CLIPS) this.actions[other].weight = other === clip ? 1 : 0;
    const d = this.database.clips[clip].duration;
    this.actions[clip].time = ((time % d) + d) % d;
    this.mixer.update(0);
    this.rig.object.updateMatrixWorld(true);
  }

  /** Where the feet are and how they are moving, straight off the hierarchy. */
  private readFeet(dt: number): void {
    const hips = this.rig.bones.Hips.getWorldPosition(this.scratch);
    for (const side of ['Left', 'Right'] as const) {
      const at = this.rig.bones[`${side}Foot`].getWorldPosition(new Vector3()).sub(hips);
      const was = side === 'Left' ? this.left : this.right;
      const vel = side === 'Left' ? this.leftVelocity : this.rightVelocity;
      if (dt > 0) vel.copy(at).sub(was).divideScalar(dt);
      was.copy(at);
    }
  }

  /**
   * Advance, and answer the speed being asked for.
   *
   * `velocity` takes GAMA's `agent.velocity` directly, or a plain speed.
   */
  update(dt: number, velocity: Vector3 | number = 0): void {
    const step = Math.max(0, dt);
    this.elapsed += step;
    this.sinceSearch += step;
    this.fadeAge += step;

    const want =
      typeof velocity === 'number' ? Math.abs(velocity) : Math.hypot(velocity.x, velocity.z);

    // POSE FIRST, THEN DECIDE. The order matters and it was the other way
    // round: the query was built from the pose left over at the end of the
    // previous frame while the clock had already moved on, so every search
    // described where the character HAD BEEN one frame earlier and duly
    // retrieved a frame that far behind. 85 of 85 threshold-crossing searches
    // came back BACKWARDS, by a median of 0.018 of a cycle — which is 1/60 s
    // at a one-second cycle, the frame it was stale by. It read as a 29% pop
    // rate that no amount of blending was ever going to fix, because nothing
    // was actually wrong with the choice; it was answering a stale question.
    this.time += step * this.frame.rate;
    this.pose(this.frame.clip, this.time);
    // READ THE QUERY OFF THE CLIP, NOT OFF THE SCREEN.
    //
    // The fade is cosmetic — it is how a jump is hidden, not where the motion
    // is. Taking the query from the faded pose instead put the controller in a
    // loop with its own smoothing: the render lags, so the query says the feet
    // are behind where the clip has them, so the search disagrees and jumps,
    // which starts another fade. It ran at 15 pops a second, 76% of every
    // search, and never once answered a command.
    //
    // The database's features are raw clip poses, so a raw clip pose is also
    // the only thing the query can honestly be compared against.
    this.readFeet(step);
    this.renderFade();

    if (this.sinceSearch >= this.searchInterval) {
      this.sinceSearch = 0;
      this.searches++;
      const match = matchFrame(
        this.database,
        queryFeature(this.database, {
          left: this.left,
          right: this.right,
          leftVelocity: this.leftVelocity,
          rightVelocity: this.rightVelocity,
          speed: want,
        })
      );
      const next = match.frame;
      const sameClip = next.clip === this.frame.clip;
      const duration = this.database.clips[next.clip].duration;
      let shift = (next.time - (this.time % duration)) / duration;
      if (shift < -0.5) shift += 1;
      else if (shift > 0.5) shift -= 1;
      this.lastPhaseShift = sameClip ? shift : 0;
      // A jump is a change of clip, or a phase that is not where we already
      // were. Changing RATE is not a jump: the same pose keeps playing, faster.
      // WHAT COUNTS AS A JUMP DEPENDS ON THE FRAME TIME.
      //
      // A fixed fraction of a cycle looks right and is not: one frame advances
      // the phase by `dt × rate / duration`, so on a slow frame the search
      // legitimately comes back further along than a fast one, and calling that
      // a jump means calling every search a jump. At 60 Hz the pop rate was 1%;
      // the same controller in a headless browser running at 20 reported 39%,
      // and nothing was wrong with it except this line.
      //
      // So the tolerance is a frame of travel plus half the gap between stored
      // samples, which is the most a correct answer can be away from us.
      const advance = (step * this.frame.rate) / duration;
      // A frame of travel, plus one whole sample: the query's true phase falls
      // between two stored samples and either of them is a correct answer.
      const tolerance = Math.max(1.5 / this.database.samples, advance + 1 / this.database.samples);
      const jumped = !sameClip || Math.abs(shift) > tolerance;
      if (jumped) this.contested++;
      if (jumped) {
        this.startFade();
        this.jumps++;
        this.frame = next;
        this.time = next.time;
        this.pose(next.clip, this.time);
        // age 0, so this renders the pose we were leaving, exactly.
        this.renderFade();
      } else {
        this.frame = next;
      }
    }
  }

  /**
   * Snapshot what is on screen, so the jump can be faded away from it.
   *
   * A SNAPSHOT, frozen, and not the outgoing clip played on in parallel. Two
   * live poses is the nicer technique and it has a hole in it: a second jump
   * landing mid-fade has no frame to name as its source, because what is on
   * screen at that instant is a blend of two and neither of them is it.
   * Starting the new fade from the incoming frame instead was worth 1.48
   * radians of forearm in a single frame.
   *
   * Refusing the second jump until the first finished closed the hole and cost
   * the thing the search was bought for — the answer time went from 0.13 s to
   * 0.33 and lost to the blend tree outright. So: freeze the pixels instead.
   * A frozen source for a fraction of a step is a smaller lie than either, and
   * the joint-speed budget is what says so.
   */
  private startFade(): void {
    const names = Object.keys(this.rig.bones) as BoneName[];
    const snap = new Float32Array(names.length * 4);
    for (let i = 0; i < names.length; i++) {
      const q = this.rig.bones[names[i]].quaternion;
      snap[i * 4] = q.x; snap[i * 4 + 1] = q.y; snap[i * 4 + 2] = q.z; snap[i * 4 + 3] = q.w;
    }
    this.fadeFrom = snap;
    this.fadeHipsY = this.rig.bones.Hips.position.y;
    this.fadeAge = 0;
  }

  /** Render: the incoming pose, pulled back toward the snapshot. */
  private renderFade(): void {
    const span = this.database.stepTime;
    const snap = this.fadeFrom;
    if (!snap || this.fadeAge >= span) return;
    // Raised cosine: 1 at the moment of the jump, exactly 0 one step later.
    const w = 0.5 * (1 + Math.cos((Math.PI * this.fadeAge) / span));
    const names = Object.keys(this.rig.bones) as BoneName[];
    for (let i = 0; i < names.length; i++) {
      const q = this.rig.bones[names[i]].quaternion;
      this.scratchQ.set(snap[i * 4], snap[i * 4 + 1], snap[i * 4 + 2], snap[i * 4 + 3]);
      q.slerp(this.scratchQ, w);
    }
    const hips = this.rig.bones.Hips;
    hips.position.y = hips.position.y * (1 - w) + this.fadeHipsY * w;
    this.rig.object.updateMatrixWorld(true);
  }
}

/**
 * The Froude number of a gait — `v² / gL`, dimensionless.
 *
 * Alexander's (1976) result: geometrically similar legged animals move in a
 * dynamically similar way at equal Froude number, which is how a dinosaur's
 * speed gets read off its trackway. Humans self-select a walk around 0.25 and
 * change to a run near 0.5.
 *
 * It is here because motion matching is where it stops being an ornament: the
 * database is built per body, so if two bodies of different size are not
 * dynamically similar then their databases are not either, and the same command
 * gets two different gaits. `npm run motion` reports the spread across body
 * sizes, and it is not currently flat.
 */
export function froudeNumber(speed: number, legLength: number): number {
  return (speed * speed) / (GRAVITY * Math.max(1e-6, legLength));
}
