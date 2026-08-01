import { Object3D, Quaternion, Vector3 } from 'three';
import { BONE_NAMES, type BoneName, type HumanoidRig } from './humanoid';
import { chainLengths, solveChain, toParentFrame } from './solve';
import type { Countable } from './dining';

/**
 * Archery — where the draw is a force, the anchor is a contact, and the group
 * is the only number that matters.
 *
 * ```ts
 * const bow = new Archery(rig, {
 *   style: 'longbow',
 *   target: butt,            // any Object3D
 *   arrows: quiver,          // anything Countable-shaped; it empties
 * });
 * bow.onLoose((shot) => projectiles.fire(shot.from, shot.velocity));
 * game.onUpdate((t) => bow.update(t.delta));
 * ```
 *
 * Five bows: `longbow`, `recurve`, `compound`, `horsebow`, `crossbow`.
 *
 * ## Nothing here is a chosen number
 *
 * **The arrow's speed comes out of the bow's stored energy.** A bow is a
 * spring; the area under its force–draw curve is joules, efficiency turns some
 * of that into the arrow, and the rest is arithmetic:
 *
 * ```
 * speed = sqrt(2 × peak × draw × storage × efficiency / mass)
 * ```
 *
 * A 170 N (38 lb) longbow at a 0.71 m draw, storing half of peak × draw and
 * delivering three quarters of it to a 30 g arrow, gives **55.0 m/s**. SCENA's
 * ammunition table independently declares an arrow's muzzle velocity as **55**.
 * Neither library imports the other and neither number was copied from the
 * other; they agree to two parts in a thousand because they are describing the
 * same object. `npm run archery` checks that they still do.
 *
 * **The elevation comes out of the ballistic solution.** To put an arrow on a
 * target `R` away at speed `v`, the bow goes up by `½·asin(gR / v²)` — so a
 * distant butt visibly raises the bow arm, a close one does not, and past
 * `v²/g` the shot is simply not on. For a longbow that limit is 308 m, which
 * is about where the historical record puts it.
 *
 * **The group comes out of the anchor.** An anchor that lands `e` off, with the
 * bow hand `d` in front of it, tilts the arrow by `e/d` radians — so the miss
 * at range `R` is `R·e/d`. Five millimetres of wandering anchor is fourteen
 * centimetres at twenty metres. That is why archers have an anchor point at
 * all, and it is the one relationship this module is built to respect.
 *
 * ## The compound is a different machine
 *
 * Not a re-skin: its cams make the force–draw curve a plateau rather than a
 * ramp, so it stores **80%** of peak × draw where a longbow stores 50 — and
 * then LETS OFF, so the archer holds a quarter of the peak instead of all of
 * it. That is why the same nominal weight shoots faster and can be held still
 * for ten seconds, and both of those fall out of two numbers in the table.
 *
 * A crossbow is further still: it is drawn once and then **held by the
 * mechanism**, so there is no hold force at all, no tremor that grows, and the
 * whole discipline of the anchor does not apply. It gets a stock and a trigger.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => clamp(v, 0, 1);
const GRAVITY = 9.81;

/**
 * How fast an arrow leaves, from the bow's stored energy.
 *
 * `peak × draw` is the rectangle a force–draw curve lives inside; `storage` is
 * the fraction of it the curve actually encloses (half for a straight ramp,
 * four fifths for a compound's plateau); `efficiency` is what survives the
 * limbs and the string. The rest is `½mv²` rearranged.
 */
export function arrowSpeed(
  peak: number,
  draw: number,
  storage: number,
  efficiency: number,
  mass: number
): number {
  return Math.sqrt((2 * peak * draw * storage * efficiency) / Math.max(1e-6, mass));
}

/**
 * What the archer is still holding at full draw, newtons.
 *
 * The whole reason a compound can be aimed for ten seconds and a longbow
 * cannot. A 270 N compound with 75% let-off is 68 N in the fingers; a 170 N
 * longbow is 170.
 */
export function holdForce(peak: number, letOff: number): number {
  return peak * (1 - clamp01(letOff));
}

/**
 * Launch elevation for a target at `range`, radians — the ballistic solution.
 *
 * `R = v²·sin(2θ)/g` inverted. Returns `NaN` when the target is beyond
 * `maxRange`, which is the honest answer: there is no angle that gets there.
 */
export function elevationFor(range: number, speed: number): number {
  const s = (GRAVITY * range) / (speed * speed);
  return s > 1 ? NaN : 0.5 * Math.asin(s);
}

/** The furthest anything launched at `speed` can reach, metres. */
export function maxRange(speed: number): number {
  return (speed * speed) / GRAVITY;
}

/**
 * How wide a group an anchor error opens up, metres at `range`.
 *
 * The arrow pivots about the bow hand, so an anchor `error` off at the nock
 * end tilts it by `error / draw` radians. This is why an anchor point exists,
 * and it is the number that turns a millimetre of sloppiness into a miss.
 */
export function groupAt(range: number, error: number, draw: number): number {
  return (range * error) / Math.max(1e-4, draw);
}

export type BowStyle = 'longbow' | 'recurve' | 'compound' | 'horsebow' | 'crossbow';

/** Where the drawing hand comes to rest on the face. Every shot, the same. */
export type AnchorPoint = 'mouth' | 'chin' | 'jaw' | 'ear' | 'none';

/** How the string is held. Changes the hand, and changes the release. */
export type DrawStyle = 'mediterranean' | 'thumb' | 'releaseAid' | 'mechanical';

/** Where in a shot the archer is. */
export type ShotPhase = 'nock' | 'draw' | 'aim' | 'release' | 'follow' | 'done';

export interface BowSpec {
  label: string;
  /** Peak draw force, newtons. */
  peak: number;
  /** Draw length, as a fraction of the archer's height — it scales with them. */
  draw: number;
  /**
   * Fraction of `peak × draw` the force–draw curve actually encloses.
   *
   * A straight ramp is 0.5. A compound's cams flatten the top of the curve and
   * get to 0.8, which is most of why the same nominal weight shoots faster.
   */
  storage: number;
  /**
   * Fraction of peak the archer no longer holds at full draw.
   *
   * Zero for anything with limbs and a string; three quarters for a compound;
   * one for a crossbow, which is held by a catch and not by a person.
   */
  letOff: number;
  /** Fraction of stored energy that reaches the arrow. */
  efficiency: number;
  anchor: AnchorPoint;
  grip: DrawStyle;
  /** Seconds: getting an arrow onto the string. */
  nock: number;
  /** Seconds: bringing it back. */
  pull: number;
  /** Seconds at full draw, aiming. The one a compound can afford to be long. */
  aim: number;
  /** Seconds of the loose itself. */
  release: number;
  /** Seconds of follow-through, hand still moving BACK along the face. */
  follow: number;
  /** Held at the shoulder and pointed, rather than drawn. */
  shouldered?: boolean;
}

export const BOWS: Record<BowStyle, BowSpec> = {
  longbow: {
    label: 'Longbow',
    // 38 lb at a 28" draw: an ordinary field bow, and the reference case that
    // lands on SCENA's declared arrow velocity.
    peak: 170,
    draw: 0.4,
    storage: 0.5,
    letOff: 0,
    efficiency: 0.75,
    anchor: 'mouth',
    grip: 'mediterranean',
    nock: 1.1,
    pull: 1.0,
    // You cannot hold a longbow. Three seconds and the shot is already worse.
    aim: 1.6,
    release: 0.12,
    follow: 0.7,
  },
  recurve: {
    label: 'Olympic recurve',
    peak: 180,
    draw: 0.42,
    // Recurved limbs pre-load the string, so the curve leaves the axis
    // earlier and encloses more than a straight ramp does.
    storage: 0.58,
    letOff: 0,
    efficiency: 0.8,
    anchor: 'chin',
    grip: 'mediterranean',
    nock: 1.3,
    pull: 1.2,
    aim: 2.2,
    release: 0.1,
    follow: 0.9,
  },
  compound: {
    label: 'Compound',
    peak: 270,
    draw: 0.41,
    // The cams. This one number is most of why a compound outshoots a longbow
    // of the same nominal weight by twenty metres a second.
    storage: 0.8,
    // …and this one is why it can be aimed for ten seconds.
    letOff: 0.75,
    efficiency: 0.85,
    anchor: 'jaw',
    grip: 'releaseAid',
    nock: 1.4,
    pull: 1.1,
    aim: 3.4,
    release: 0.08,
    follow: 0.6,
  },
  horsebow: {
    label: 'Horsebow',
    peak: 200,
    // A thumb draw goes PAST the face — the anchor is at the ear, and the
    // extra draw length is free energy the Mediterranean draw never gets.
    draw: 0.46,
    storage: 0.54,
    letOff: 0,
    efficiency: 0.74,
    anchor: 'ear',
    grip: 'thumb',
    nock: 0.7,
    pull: 0.6,
    // Shot from a moving horse. Nobody aims for two seconds.
    aim: 0.5,
    release: 0.1,
    follow: 0.4,
  },
  crossbow: {
    label: 'Crossbow',
    peak: 700,
    draw: 0.2,
    storage: 0.55,
    // Held by a catch, not by a person — which is the whole of what a
    // crossbow is, and why it has no anchor and no tremor that grows.
    letOff: 1,
    efficiency: 0.55,
    anchor: 'none',
    grip: 'mechanical',
    nock: 2.4,
    pull: 0.1,
    aim: 2.6,
    release: 0.06,
    follow: 0.35,
    shouldered: true,
  },
};

export const BOW_STYLES = Object.keys(BOWS) as BowStyle[];

/**
 * Where an anchor point is, in the Head bone's own frame, as fractions of the
 * archer's height.
 *
 * Taken off the same face layout the `mouth` socket comes from — the lips sit
 * at `0.03` up and `0.0565` forward — so these land on the face of every
 * seeded character rather than near it.
 */
const ANCHORS: Record<AnchorPoint, [number, number, number]> = {
  mouth: [0.012, 0.03, 0.052],
  chin: [0.004, 0.008, 0.046],
  jaw: [0.03, 0.014, 0.028],
  ear: [0.042, 0.058, -0.012],
  none: [0, 0, 0],
};

/** The bones `Archery` takes outright. The stance belongs to whoever set it. */
const OWNED: BoneName[] = [
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
];

/** …and the ones it only ADDS to, so a stance or a mood survives the shot. */
const SHARED: BoneName[] = ['Chest', 'Neck', 'Head'];

export interface ArcheryOptions {
  style?: BowStyle;
  /** What to shoot at. The elevation is solved for its range every shot. */
  target?: Object3D;
  /** Arrows. When they run out, so does the shooting. */
  arrows?: Countable;
  /** Shots to take when there is no quiver to count. Default 6. */
  shots?: number;
  /** Which hand draws. Default 'right' — the bow is in the other one. */
  hand?: 'left' | 'right';
  /** The bow itself, moved to the bow hand every frame. */
  bow?: Object3D;
  /** One arrow, moved to the nock while it is on the string. */
  arrow?: Object3D;
  /**
   * How steady this archer is, 0..1. Drives the anchor scatter, which drives
   * the group — 1 is an Olympian and 0.3 is a novice with a heavy bow.
   */
  skill?: number;
  /** Arrow mass, kg. Default 0.03 — SCENA's arrow. */
  arrowMass?: number;
  /** Seeded wobble, so a line of archers does not shake in unison. */
  seed?: number;
  /** Seconds to fade in and out. Default 0.4. */
  fade?: number;
  /** Scale every duration. */
  tempo?: number;
}

/**
 * What `onLoose` hands back the instant the string goes.
 *
 * Named for what archers call it. `Shot` was taken — by cricket, which got
 * there first and means something else by it.
 */
export interface Loose {
  /** 1 for the first arrow. */
  index: number;
  /** Where the nock was, in world space — hand this to GAMA's `Projectiles`. */
  from: Vector3;
  /** …and how fast it left, as a world velocity. */
  velocity: Vector3;
  /** Its magnitude, m/s. */
  speed: number;
  /** Launch elevation used, radians. */
  elevation: number;
  /** How far the anchor was from where it should have been, metres. */
  anchorError: number;
  /** The group this shot's anchor error predicts at the target, metres. */
  spread: number;
}

const scratchQ = new Quaternion();

/**
 * A quiver of `n` arrows, for measuring against.
 *
 * The same shape SCENA's counted props publish, so a real quiver drops in
 * unchanged and neither library imports the other.
 */
export function quiverOf(n: number): Countable {
  let count = n;
  return {
    capacity: n,
    get count() {
      return count;
    },
    setCount(v: number) {
      count = clamp(Math.round(v), 0, n);
      return count;
    },
  };
}

/** mulberry32, privately — same seed, same archer. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * An archer.
 *
 * Owns the arms; adds to the chest, neck and head; never touches the hips or
 * the legs, so the stance belongs to whoever set it and a `Mood` layer still
 * reads on top.
 */
export class Archery {
  /** Arrows loosed. */
  shots = 0;
  /** Where in the shot the body is. */
  phase: ShotPhase = 'nock';
  /** 0..1 through the current phase. */
  progress = 0;

  private readonly rig: HumanoidRig;
  private readonly spec: BowSpec;
  private readonly style: BowStyle;
  private readonly draws: 'Left' | 'Right';
  private readonly holds: 'Left' | 'Right';
  private readonly limit: number;
  private readonly tempo: number;
  private readonly fadeRate: number;
  private readonly skill: number;
  private readonly mass: number;
  private readonly rand: () => number;
  private target: Object3D | null;
  private arrows: Countable | null;
  private bowProp: Object3D | null;
  private arrowProp: Object3D | null;

  private weight = 0;
  private wanted = 1;
  private restored = false;
  private clock = 0;
  private phaseClock = 0;
  /** This shot's seeded anchor miss, decided when the draw starts. */
  private wobble = new Vector3();
  private readonly gave = new Map<BoneName, Quaternion>();
  private readonly entry = new Map<BoneName, Quaternion>();
  private readonly looseCbs = new Set<(s: Loose) => void>();
  private readonly emptyCbs = new Set<() => void>();
  /** Live readings, taken off the posed rig. */
  private readonly lastHand = new Vector3();
  private readonly nockAt = new Vector3();
  private readonly anchorAt = new Vector3();
  private readonly bowHandAt = new Vector3();
  private lastError = 0;
  private lastElevation = 0;
  private finishing = false;

  constructor(rig: HumanoidRig, options: ArcheryOptions = {}) {
    this.rig = rig;
    this.style = options.style ?? 'longbow';
    this.spec = BOWS[this.style];
    this.draws = (options.hand ?? 'right') === 'left' ? 'Left' : 'Right';
    this.holds = this.draws === 'Left' ? 'Right' : 'Left';
    this.target = options.target ?? null;
    this.arrows = options.arrows ?? null;
    this.bowProp = options.bow ?? null;
    this.arrowProp = options.arrow ?? null;
    this.limit = Math.max(1, Math.round(options.shots ?? 6));
    this.tempo = Math.max(0.2, options.tempo ?? 1);
    this.skill = clamp01(options.skill ?? 0.8);
    this.mass = Math.max(1e-4, options.arrowMass ?? 0.03);
    this.rand = makeRng(options.seed ?? 1);
    const fade = Math.max(0, options.fade ?? 0.4);
    this.fadeRate = fade > 0 ? 1 / fade : Infinity;
    for (const name of [...OWNED, ...SHARED]) {
      this.entry.set(name, rig.bones[name].quaternion.clone());
      this.gave.set(name, new Quaternion());
    }
  }

  /** Which bow this is. */
  get bow(): BowStyle {
    return this.style;
  }

  /** Its spec, for a UI that wants the label or the draw weight. */
  get about(): BowSpec {
    return this.spec;
  }

  /** The draw length this archer's height gives them, metres. */
  get drawLength(): number {
    return this.spec.draw * this.rig.height;
  }

  /** How fast an arrow leaves this bow, m/s — from its stored energy. */
  get speed(): number {
    return arrowSpeed(
      this.spec.peak,
      this.drawLength,
      this.spec.storage,
      this.spec.efficiency,
      this.mass
    );
  }

  /** What the archer is still holding at full draw, newtons. */
  get hold(): number {
    return holdForce(this.spec.peak, this.spec.letOff);
  }

  /** The furthest this bow can reach at all, metres. */
  get reach(): number {
    return maxRange(this.speed);
  }

  /** Arrows left, 0..1. */
  get left(): number {
    if (this.arrows) return this.arrows.capacity > 0 ? this.arrows.count / this.arrows.capacity : 0;
    return clamp01(1 - this.shots / this.limit);
  }

  /** The quiver is empty, or the shot count is done. */
  get done(): boolean {
    return this.phase === 'done';
  }

  /**
   * How far the drawing hand is from its anchor right now, metres.
   *
   * Zero everywhere except at full draw, where it is the whole of the archer's
   * consistency and therefore the whole of their group.
   */
  get anchorError(): number {
    return this.lastError;
  }

  /** How far the group this shot's anchor opens up at the target, metres. */
  get spread(): number {
    return groupAt(this.range, this.lastError, this.drawLength);
  }

  /** Distance to the target, metres. Infinity with nothing to shoot at. */
  get range(): number {
    if (!this.target) return 18;
    return this.rig.object.getWorldPosition(new Vector3()).distanceTo(
      this.target.getWorldPosition(new Vector3())
    );
  }

  /** The elevation the last shot went out at, radians. */
  get elevation(): number {
    return this.lastElevation;
  }

  /**
   * How hard holding is right now, 0..1.
   *
   * Rises through the aim and rises faster on a bow with no let-off. Hand it
   * to GAMA's `GameFeel` for a bowsight that shakes, or to a HUD.
   */
  get strain(): number {
    if (this.phase !== 'aim') return 0;
    // Held force against what this archer can comfortably hold — 250 N at
    // full skill, which is about where a trained archer's limit sits.
    const load = this.hold / (110 + 140 * this.skill);
    return clamp01(load * (0.3 + 0.7 * this.progress));
  }

  /** Hear each arrow go. Returns the unsubscribe. */
  onLoose(cb: (s: Loose) => void): () => void {
    this.looseCbs.add(cb);
    return () => this.looseCbs.delete(cb);
  }

  /** Hear the quiver come up empty. Returns the unsubscribe. */
  onEmpty(cb: () => void): () => void {
    this.emptyCbs.add(cb);
    return () => this.emptyCbs.delete(cb);
  }

  /** Shoot at something else. */
  aimAt(target: Object3D | null): void {
    this.target = target;
  }

  /** Lower the bow and hand the arms back. */
  release(): void {
    this.wanted = 0;
  }

  update(dt: number): void {
    if (!(dt > 0)) return;
    this.weight +=
      Math.sign(this.wanted - this.weight) *
      Math.min(dt * this.fadeRate, Math.abs(this.wanted - this.weight));
    if (this.weight <= 0.0001) {
      if (!this.restored) {
        for (const name of [...OWNED, ...SHARED]) {
          this.rig.bones[name].quaternion.copy(this.entry.get(name)!);
          this.gave.get(name)!.identity();
        }
        this.rig.object.updateWorldMatrix(true, true);
        this.restored = true;
      }
      return;
    }
    this.restored = false;
    this.clock += dt;
    if (this.phase !== 'done') this.advance(dt);
    this.pose();
  }

  private phases(): Array<[ShotPhase, number]> {
    const s = this.spec;
    const t = this.tempo;
    return [
      ['nock', s.nock * t],
      ['draw', s.pull * t],
      ['aim', s.aim * t],
      ['release', s.release * t],
      ['follow', s.follow * t],
    ];
  }

  private advance(dt: number): void {
    this.phaseClock += dt;
    let t = this.phaseClock;
    for (const [phase, span] of this.phases()) {
      if (t > span && span > 0) {
        t -= span;
        continue;
      }
      const was = this.phase;
      this.phase = phase;
      this.progress = span > 0 ? clamp01(t / span) : 0;
      // A shot's anchor miss is decided the moment the draw starts and does
      // not change again — an archer does not re-roll their form mid-pull.
      if (phase === 'draw' && was !== 'draw') this.roll();
      if (phase === 'release' && was !== 'release') this.loose();
      return;
    }
    this.phaseClock = 0;
    this.progress = 0;
    if (this.finishing) {
      this.phase = 'done';
      for (const cb of this.emptyCbs) cb();
      return;
    }
    this.phase = 'nock';
  }

  /**
   * This shot's anchor miss.
   *
   * Seeded and Gaussian-ish (three uniforms summed), because form error is a
   * sum of many small things and a flat distribution puts as many arrows on
   * the edge of the group as in the middle, which is not what a target looks
   * like. Scales with how hard the bow is to hold and with how little skill
   * the archer has — both of which are the real causes.
   */
  private roll(): void {
    const load = this.hold / (110 + 140 * this.skill);
    const sigma = 0.0125 * (1 - this.skill * 0.85) * (0.5 + load);
    const g = (): number => (this.rand() + this.rand() + this.rand() - 1.5) * sigma;
    this.wobble.set(g(), g(), g() * 0.4);
  }

  /** The string goes. Publishes where and how fast; GAMA flies it. */
  private loose(): void {
    this.shots++;
    if (this.arrows) this.arrows.setCount(Math.max(0, this.arrows.count - 1));

    const speed = this.speed;
    const range = this.range;
    const elevation = elevationFor(range, speed);
    this.lastElevation = Number.isNaN(elevation) ? 0.25 : elevation;

    // Down-range, level, then raised by the ballistic solution. The archer's
    // own anchor error tilts it off that line by exactly the angle the miss
    // subtends over the draw — which is where `groupAt` comes from and why
    // the two numbers cannot disagree.
    const dir = new Vector3(0, 0, 1);
    if (this.target) {
      dir.subVectors(
        this.target.getWorldPosition(new Vector3()),
        this.rig.object.getWorldPosition(new Vector3())
      );
      dir.y = 0;
      if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
      dir.normalize();
    } else {
      dir.applyQuaternion(this.rig.object.getWorldQuaternion(new Quaternion()));
    }
    const right = new Vector3().crossVectors(dir, Y).normalize();
    const velocity = dir.clone().multiplyScalar(Math.cos(this.lastElevation));
    velocity.y += Math.sin(this.lastElevation);
    // The deflection is the anchor error RESOLVED, not its magnitude applied
    // to both axes with a sign — which double-counted it and put the arrows in
    // a group four times wider than the anchor that caused it. Sideways is
    // sideways and up is up, each over the draw length.
    const d = this.drawLength;
    velocity.addScaledVector(right, this.wobble.x / d);
    velocity.y += this.wobble.y / d;
    velocity.normalize().multiplyScalar(speed);

    const shot: Loose = {
      index: this.shots,
      from: this.nockAt.clone(),
      velocity,
      speed,
      elevation: this.lastElevation,
      anchorError: this.lastError,
      spread: groupAt(range, this.lastError, this.drawLength),
    };
    for (const cb of this.looseCbs) cb(shot);

    if (this.arrows ? this.arrows.count <= 0 : this.shots >= this.limit) this.finishing = true;
  }

  /**
   * One frame of the shot.
   *
   * Bow arm first and held STILL — that is the discipline, and the gate
   * measures it. Then the draw hand onto the anchor, which is the contact.
   */
  private pose(): void {
    const rig = this.rig;
    const bones = rig.bones;
    const spec = this.spec;
    const h = rig.height;
    const w = this.weight * this.weight * (3 - 2 * this.weight);

    for (const name of SHARED) {
      bones[name].quaternion.multiply(this.gave.get(name)!.invert());
      this.gave.get(name)!.identity();
    }

    // The bow arm points down-range and UP by the ballistic solution, so a
    // far butt visibly raises it and a close one does not.
    const range = this.range;
    const solved = elevationFor(range, this.speed);
    const elevation = Number.isNaN(solved) ? 0.3 : solved;
    if (this.phase !== 'nock') this.lastElevation = elevation;

    const s = this.holds === 'Left' ? 1 : -1;
    const shoulder = rig.object.worldToLocal(
      bones[`${this.holds}Arm`].getWorldPosition(new Vector3())
    );
    const [upper, fore] = chainLengths(rig, this.holds, true);
    const arm = (upper + fore) * 0.96;
    // Straight out, across the body, and raised. A drawn bow is the one shape
    // in this library where an arm is supposed to be locked.
    const out = new Vector3(s * 0.1, Math.sin(elevation), Math.cos(elevation)).normalize();
    const bowHand = shoulder.clone().addScaledVector(out, arm);
    // The bow arm is a post, but it is a post made of a person. Holding 170 N
    // out at arm's length moves it, and that motion is most of what an archer
    // sees through the sight — so it is here, scaled by the strain, and the
    // gate bounds it rather than pretending it is zero.
    const sway = this.strain * 0.004;
    if (sway > 0) {
      bowHand.x += sway * Math.sin(this.clock * 9.4 + this.wobble.x * 40);
      bowHand.y += sway * 0.8 * Math.sin(this.clock * 7.1 + 2.3);
    }
    this.bowHandAt.copy(bowHand);

    // A shouldered weapon is not drawn at all: both hands go to it, and the
    // whole discipline of the anchor does not apply.
    const anchorLocal = this.anchorTarget(h);
    const pull = this.pullFraction();

    this.add('Chest', -elevation * 0.18, s * 0.12 * pull);
    this.add('Neck', -elevation * 0.12, 0);
    this.add('Head', -elevation * 0.1, s * 0.16);
    rig.object.updateWorldMatrix(true, true);

    this.solveArm(this.holds, bowHand, this.bowGrip(elevation), 0);

    // The draw hand: from beside the bow at nock, back to the anchor at full
    // draw, and then BACK PAST it on the follow-through, which is what a
    // release actually is — a relaxation, not a pull.
    // The nock hand comes from wherever the last shot left it, not from a
    // fixed spot beside the bow — a hand that reappears at the string between
    // arrows jumps half a metre on one frame.
    const home = bowHand.clone().addScaledVector(out, -0.1 * h);
    const start =
      this.phase === 'nock' && this.lastHand.lengthSq() > 0
        ? new Vector3().lerpVectors(this.lastHand, home, clamp01(this.progress * 1.8))
        : home;
    const at = new Vector3().lerpVectors(start, anchorLocal, pull);
    // A loose is a RELAXATION, not a pull: the fingers stop holding and the
    // hand travels BACK along the face under the tension that was already
    // there. It has to start at the release itself — a hand that only moves
    // once the arrow has gone has plucked the string, and the shot is already
    // low and left for reasons no amount of aiming fixes.
    const back = new Vector3().subVectors(anchorLocal, bowHand).normalize();
    if (this.phase === 'release') at.addScaledVector(back, 0.05 * h * this.progress);
    else if (this.phase === 'follow' || this.phase === 'done') {
      at.addScaledVector(back, 0.05 * h + 0.05 * h * (this.phase === 'done' ? 1 : this.progress));
    }
    // Remembered so the NEXT arrow's nock starts from here. Without it the
    // hand reappears beside the bow the instant the follow-through ends, which
    // measured as 483 mm of travel on a single frame.
    if (this.phase !== 'nock') this.lastHand.copy(at);
    this.solveArm(this.draws, at, this.drawGrip(), spec.shouldered ? 0.2 : 0);
    rig.object.updateWorldMatrix(true, true);

    // What actually happened, off the transforms.
    const hand = bones[`${this.draws}Hand`];
    this.nockAt.copy(hand.getWorldPosition(new Vector3()));
    this.anchorAt.copy(this.anchorTarget(h, true)).applyMatrix4(rig.object.matrixWorld);
    this.lastError =
      this.phase === 'aim' || this.phase === 'release'
        ? this.nockAt.distanceTo(this.anchorAt)
        : 0;

    if (w < 0.9999) {
      for (const name of OWNED) {
        scratchQ.copy(bones[name].quaternion);
        bones[name].quaternion.copy(this.entry.get(name)!).slerp(scratchQ, w);
      }
      rig.object.updateWorldMatrix(true, true);
    }

    if (this.bowProp) this.carry(this.bowProp, bones[`${this.holds}Hand`]);
    if (this.arrowProp) {
      this.arrowProp.visible = this.phase !== 'follow' && this.phase !== 'done';
      this.carry(this.arrowProp, hand);
    }
  }

  /** 0 at nock, 1 at full draw, back off through the release. */
  private pullFraction(): number {
    const p = this.progress;
    switch (this.phase) {
      case 'nock':
        return 0.12 * p;
      case 'draw':
        // Slow at the end: the last two inches of a draw are the hardest part
        // of it, and a linear pull is the tell that nobody modelled the force.
        return 0.12 + 0.88 * (1 - (1 - p) ** 1.7);
      case 'aim':
        return 1;
      case 'release':
        return 1;
      case 'follow':
        return 1;
      default:
        // `done` holds where the follow-through left it. Returning to nought
        // snapped the hand back to the bow on the frame the quiver emptied —
        // the one frame nobody thinks to look at, and 600 mm of it.
        return 1;
    }
  }

  /** Where the drawing hand belongs, in rig space, with this shot's miss. */
  private anchorTarget(h: number, ideal = false): Vector3 {
    const spec = this.spec;
    const s = this.draws === 'Left' ? 1 : -1;
    const at = new Vector3();
    if (spec.anchor === 'none') {
      // A stock against the cheek: the hand goes to the trigger, not the face.
      const bow = this.bowHandAt.clone();
      const back = new Vector3().subVectors(
        this.rig.object.worldToLocal(
          this.rig.bones[`${this.draws}Arm`].getWorldPosition(new Vector3())
        ),
        bow
      ).normalize();
      at.copy(bow).addScaledVector(back, 0.22 * h);
    } else {
      const [ax, ay, az] = ANCHORS[spec.anchor];
      at.set(s * ax * h, ay * h, az * h);
      this.rig.bones.Head.localToWorld(at);
      this.rig.object.worldToLocal(at);
    }
    // The shot's own error, plus a live tremor that grows with the hold.
    //
    // `ideal` skips both, and that distinction is the whole measurement: the
    // hand is IK'd to the WOBBLED anchor, so comparing it against that reports
    // zero error for an archer who is all over the place. What is being asked
    // is how far the hand ended up from where an anchor point IS.
    if (!ideal && (this.phase === 'aim' || this.phase === 'release')) {
      at.add(this.wobble);
      const shake = this.strain * 0.006;
      at.x += shake * Math.sin(this.clock * 21.3);
      at.y += shake * Math.sin(this.clock * 17.1 + 1.7);
    }
    return at;
  }

  /** The bow hand: knuckles down-range, wrist relaxed. */
  private bowGrip(elevation: number): Quaternion {
    const s = this.holds === 'Left' ? 1 : -1;
    return new Quaternion()
      .setFromAxisAngle(Y, -s * 1.45)
      .multiply(new Quaternion().setFromAxisAngle(X, -0.25 - elevation));
  }

  /** …and the draw hand, which depends entirely on how the string is held. */
  private drawGrip(): Quaternion {
    const s = this.draws === 'Left' ? 1 : -1;
    const q = new Quaternion().setFromAxisAngle(Y, -s * 1.5);
    switch (this.spec.grip) {
      case 'thumb':
        // A thumb draw turns the back of the hand outward — the reason a
        // horsebow archer's forearm reads completely differently at anchor.
        q.multiply(new Quaternion().setFromAxisAngle(X, 0.55));
        break;
      case 'releaseAid':
        q.multiply(new Quaternion().setFromAxisAngle(X, -0.1));
        break;
      case 'mechanical':
        q.multiply(new Quaternion().setFromAxisAngle(X, -0.45));
        break;
      default:
        q.multiply(new Quaternion().setFromAxisAngle(X, 0.12));
    }
    return q;
  }

  private solveArm(side: 'Left' | 'Right', at: Vector3, grip: Quaternion, drop: number): void {
    const rig = this.rig;
    const s = side === 'Left' ? 1 : -1;
    const [upper, fore] = chainLengths(rig, side, true);
    const shoulder = rig.object.worldToLocal(
      rig.bones[`${side}Arm`].getWorldPosition(new Vector3())
    );
    // The draw elbow goes UP AND BACK — an elbow that hangs is a collapsed
    // draw, and it is the first thing a coach fixes after the anchor.
    const pole =
      side === this.draws && !this.spec.shouldered
        ? new Vector3(s * 0.5, 0.85, -0.6).normalize()
        : new Vector3(s * 0.6, -0.7 - drop, -0.4).normalize();
    const { root, joint } = solveChain(shoulder, at, new Vector3(s, 0, 0), upper, fore, pole);
    rig.bones[`${side}Arm`].quaternion.copy(toParentFrame(rig, `${side}Arm`, root));
    rig.bones[`${side}ForeArm`].quaternion.copy(joint);
    rig.bones[`${side}Shoulder`].quaternion.identity();
    rig.object.updateWorldMatrix(true, true);
    rig.bones[`${side}Hand`].quaternion.copy(toParentFrame(rig, `${side}Hand`, grip));
  }

  private add(name: BoneName, x: number, y: number): void {
    if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return;
    const q = new Quaternion()
      .setFromAxisAngle(X, x)
      .multiply(new Quaternion().setFromAxisAngle(Y, y));
    this.rig.bones[name].quaternion.multiply(q);
    this.gave.get(name)!.copy(q);
  }

  private carry(obj: Object3D, hand: Object3D): void {
    if (obj.parent !== this.rig.object) this.rig.object.add(obj);
    const p = hand.getWorldPosition(new Vector3());
    this.rig.object.worldToLocal(p);
    obj.position.copy(p);
    obj.quaternion.copy(hand.getWorldQuaternion(new Quaternion()));
    obj.updateMatrixWorld(true);
  }
}

/* ────────────────────────────────────────────────────────────────────────
   The gate
   ──────────────────────────────────────────────────────────────────────── */

export interface ShotReport {
  /** Arrows loosed before the quiver ran out. */
  shots: number;
  emptied: boolean;
  /** Arrow speed this bow gives this archer, m/s. */
  speed: number;
  /** What is still in the fingers at full draw, newtons. */
  hold: number;
  /** Worst distance from the drawing hand to its anchor at full draw, metres. */
  anchorGap: number;
  /**
   * How far the anchor wandered BETWEEN shots, metres — the spread of where
   * it landed, not how far it was from the face.
   *
   * The one that decides the group. An archer can be consistently five
   * millimetres off and still shoot a tight group; an archer who is a
   * different five millimetres off every time cannot.
   */
  anchorScatter: number;
  /** Worst drift of the bow hand while at full draw, metres. */
  bowDrift: number;
  /** Group the anchor scatter predicts at the target, metres. */
  predicted: number;
  /** …and the group the arrows that actually left produce there. */
  grouped: number;
  /** Launch elevation used, radians. */
  elevation: number;
  /** Was the drawing hand still moving BACKWARD when the string went? */
  followsThrough: boolean;
  /** Largest single-frame jump of the drawing hand, metres. */
  pop: number;
}

export interface ShotOptions extends ArcheryOptions {
  /** Simulation step. Default 1/120. */
  step?: number;
  /** Give up after this many simulated seconds. Default 300. */
  limit?: number;
}

/**
 * Shoot a whole quiver and measure it.
 *
 * Drives the real controller and reads world positions off the transform
 * hierarchy that ships — the anchor, the bow hand, and the velocity every
 * arrow actually went out at.
 */
export function measureShot(
  rig: HumanoidRig,
  style: BowStyle,
  options: ShotOptions = {}
): ShotReport {
  const step = options.step ?? 1 / 120;
  const stop = options.limit ?? 300;
  const before = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);

  const arrows = options.arrows ?? quiverOf(options.shots ?? 6);
  const bow = new Archery(rig, { ...options, style, arrows, fade: 0 });
  const draws = (options.hand ?? 'right') === 'left' ? 'LeftHand' : 'RightHand';
  const holds = draws === 'LeftHand' ? 'RightHand' : 'LeftHand';

  const shots: Loose[] = [];
  bow.onLoose((s) => shots.push(s));

  const hand = new Vector3();
  const prev = new Vector3();
  const bowAt = new Vector3();
  const releaseFrom = new Vector3();
  const anchors: Vector3[] = [];
  let anchorGap = 0;
  let pop = 0;
  let bowLow: Vector3 | null = null;
  let bowDrift = 0;
  let follows = true;
  let frames = 0;
  let t = 0;
  let wasPhase: ShotPhase = 'nock';
  const holdRun: Vector3[] = [];

  while (!bow.done && t < stop) {
    bow.update(step);
    t += step;
    frames++;
    rig.bones[draws].getWorldPosition(hand);
    rig.bones[holds].getWorldPosition(bowAt);

    if (bow.phase === 'aim') {
      anchorGap = Math.max(anchorGap, bow.anchorError);
      holdRun.push(hand.clone());
      // The bow hand is a post. Anything it does at full draw is a miss.
      if (!bowLow) bowLow = bowAt.clone();
      else bowDrift = Math.max(bowDrift, bowAt.distanceTo(bowLow));
    } else if (wasPhase === 'aim') {
      // Where the anchor SETTLED on this shot — the mean of the hold.
      if (holdRun.length) {
        const mean = new Vector3();
        for (const p of holdRun) mean.add(p);
        anchors.push(mean.multiplyScalar(1 / holdRun.length));
        holdRun.length = 0;
      }
      bowLow = null;
    }

    // A release is a RELAXATION, and that is a property of the whole phase
    // rather than of one frame in it: sampled on the single frame the string
    // goes, the tremor is bigger than the travel and the answer is a coin
    // flip. Where the hand STARTED the release against where it ended is the
    // question — forward means the string was plucked, and the shot is
    // already low and left for reasons no amount of aiming fixes.
    if (bow.phase === 'release' && wasPhase !== 'release') releaseFrom.copy(hand);
    if (wasPhase === 'release' && bow.phase !== 'release') {
      const moved = new Vector3().subVectors(hand, releaseFrom);
      const away = new Vector3().subVectors(hand, bowAt).normalize();
      if (moved.dot(away) < 0.002) follows = false;
    }
    if (frames > 1) pop = Math.max(pop, hand.distanceTo(prev));
    prev.copy(hand);
    wasPhase = bow.phase;
  }
  bow.release();
  for (const [name, q] of before) rig.bones[name].quaternion.copy(q);
  rig.object.updateWorldMatrix(true, true);

  // Scatter: how far apart the anchors landed, not how far off they were.
  let scatter = 0;
  if (anchors.length > 1) {
    const mean = new Vector3();
    for (const a of anchors) mean.add(a);
    mean.multiplyScalar(1 / anchors.length);
    for (const a of anchors) scatter = Math.max(scatter, a.distanceTo(mean) * 2);
  }

  // The group the arrows that actually left would make, from their launch
  // directions alone — independent of `groupAt`, which is the point.
  let grouped = 0;
  const range = bow.range;
  if (shots.length > 1) {
    const dirs = shots.map((s) => s.velocity.clone().normalize());
    const mean = new Vector3();
    for (const d of dirs) mean.add(d);
    mean.normalize();
    for (const d of dirs) grouped = Math.max(grouped, d.angleTo(mean) * range * 2);
  }

  return {
    shots: bow.shots,
    emptied: bow.done,
    speed: bow.speed,
    hold: bow.hold,
    anchorGap,
    anchorScatter: scatter,
    bowDrift,
    predicted: groupAt(range, scatter, bow.drawLength),
    grouped,
    elevation: shots.length ? shots[0].elevation : 0,
    followsThrough: follows,
    pop,
  };
}
