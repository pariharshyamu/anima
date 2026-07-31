import { Object3D, Quaternion, Vector3 } from 'three';
import { BONE_NAMES, type BoneName, type HumanoidRig } from './humanoid';
import { chainLengths, solveChain, toParentFrame } from './solve';
import { getSocket } from './sockets';

/**
 * Dining — where the utensil is the mechanism, not the prop.
 *
 * It is tempting to treat eating as one animation with a different object in
 * the hand. It is not. Swap a spoon for chopsticks and *the bowl comes to your
 * face*; swap it for a glass and *the wrist tilts further as it empties*; swap
 * it for a knife and fork and there is a whole rhythmic sub-action before every
 * few bites. None of that is a re-skin. Each one changes what the arm has to
 * do, and this module is those differences.
 *
 * ```ts
 * const meal = new Dining(rig, {
 *   utensil: 'spoon',
 *   plate: bowl.object,          // any Object3D — a SCENA prop's `.object`
 *   food: bowl,                  // anything Countable-shaped; the plate empties
 * });
 * meal.onBite(() => sfx.play('bite'));
 * game.onUpdate((t) => meal.update(t.delta));
 * ```
 *
 * ## Three things that are physics rather than taste
 *
 * **A spoon has to stay level.** Not approximately — a spoonful of soup does
 * not survive a wrist that rotates on the way up, and that constraint is the
 * whole reason a person carrying soup raises their elbow. So the wrist is
 * corrected toward level every frame, **and the correction is clamped to a
 * wrist's actual range**. When the clamp binds, the spoon tips, and that is a
 * real failure with a real fix (a different elbow). `measureBite` reports the
 * worst tilt in radians.
 *
 * **A glass tilts further as it empties.** By exactly how much is geometry, not
 * feel: liquid `f` deep in a vessel of height `h` and radius `r` reaches the
 * lip when the cup is tipped by `atan(h(1 − f) / r)`. A full glass needs
 * nothing; an empty one needs seventy degrees. `pourAngle` is that formula and
 * it is the only place the tilt comes from.
 *
 * **The plate empties.** Food is `Countable` — the same shape SCENA's
 * ammunition publishes — so bites come out of a real number and the meal ENDS.
 * A diner who eats forever off a full plate is the tell that this is a loop.
 *
 * ## What it owns, and what it leaves alone
 *
 * A diner is usually SITTING, and the sit came from somewhere else. So `Dining`
 * takes the arms outright — an idle sit pose has nothing to say about where a
 * fork goes — and only ADDS to the chest, neck and head, giving last frame's
 * contribution back before applying this one. The hips, spine and legs are
 * never touched. That is what lets `Interaction`'s `sit` and this run on the
 * same body at the same time.
 *
 * ## The jaw this rig does not have
 *
 * `BONE_NAMES` has no jaw, and inventing one would reshape every character in
 * the library for one feature. So chewing is conveyed by the pause and by a
 * small head motion, and the phase itself is **published** rather than applied:
 * `chewPhase` is a 0..1 you can drive a jaw bone or a blend shape with if your
 * rig has one. `canSpeak` is published for the same reason — hand it to
 * `Conversation` and nobody talks with their mouth full.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => clamp(v, 0, 1);
const TAU = Math.PI * 2;

/**
 * How far a vessel must be tipped for the liquid to reach its lip.
 *
 * Geometry, not feel. Liquid filling fraction `fill` of a vessel `height` tall
 * and `radius` wide has `height × (1 − fill)` of dry wall above it; tipping the
 * vessel drops the far rim and raises the near one, and the surface touches the
 * lip when that drop equals the dry wall across the diameter. Hence
 * `atan(h(1 − f) / r)` — zero for a full glass, and about seventy degrees for
 * an empty one, which is exactly the difference you can see across a table.
 */
export function pourAngle(fill: number, height: number, radius: number): number {
  return Math.atan((height * (1 - clamp01(fill))) / Math.max(1e-4, radius));
}

export type Utensil =
  /** One hand, food speared. The wrist is free — a forkful does not spill. */
  | 'fork'
  /** One hand, and it must stay LEVEL. The constraint that shapes the arm. */
  | 'spoon'
  /** Two hands, and a sawing sub-action before every few bites. */
  | 'knifeAndFork'
  /** One hand at the sticks, the other lifting the bowl toward the face. */
  | 'chopsticks'
  /** Two hands, and the mouth comes most of the way to meet the food. */
  | 'hands'
  /** A glass. The wrist tilts, and the tilt grows as it empties. */
  | 'cup'
  /** Both hands, drunk from — the same tilt, much larger, whole body back. */
  | 'bowl'
  /** The head goes to the drink; the drink does not move at all. */
  | 'straw';

/** Where in a mouthful a diner is. */
export type DiningPhase = 'reach' | 'gather' | 'carry' | 'bite' | 'chew' | 'cut' | 'done';

/**
 * Anything that runs out.
 *
 * Structurally what SCENA's counted props publish, so a plate of food, a
 * magazine of rounds and a box you wrote yourself are the same thing here and
 * neither library imports the other.
 */
export interface Countable {
  readonly count: number;
  readonly capacity: number;
  /** Show `n`. Returns the count actually set. */
  setCount(n: number): number;
}

export interface UtensilSpec {
  /** What a menu would call it. */
  label: string;
  /** One hand carries, or two. */
  hands: 'one' | 'both';
  /**
   * How hard the load has to stay flat, 0..1.
   *
   * 1 is soup: any rotation of the bearing surface loses it. 0 is a sandwich,
   * which does not care. This is the number that makes a spoon look like a
   * spoon rather than a fork with a different mesh on it.
   */
  level: number;
  /**
   * The business end, in the carrying hand's own frame, as fractions of the
   * character's height — where the food actually IS, which is not where the
   * hand is. A fork's tines are 90 mm past the fingers.
   */
  tip: [number, number, number];
  /**
   * Where the HAND meets the object, if that is not the business end.
   *
   * A fork's tines and the point you hold it by are almost the same place. A
   * glass's are not: you grip the side and drink from the rim 80 mm above it,
   * and asking whether the rim reached the table is asking the wrong question
   * about picking a glass up. Defaults to `tip`.
   */
  grasp?: [number, number, number];
  /** Seconds: hand out to the plate. */
  reach: number;
  /** Seconds: scooping, spearing, gripping, or filling a glass. */
  gather: number;
  /** Seconds: plate to mouth. The constrained one. */
  carry: number;
  /** Seconds at the mouth. A sip is long; a forkful is not. */
  bite: number;
  /** Seconds chewing, hand down. */
  chew: number;
  /**
   * How far the head comes to meet the food, 0..1.
   *
   * The quiet difference between eating styles. Formal cutlery brings the food
   * to a still head; a bowl of noodles brings the head to the bowl. Nobody
   * animates this and everybody notices when it is wrong.
   */
  meet: number;
  /** The free hand lifts the vessel toward the face (chopsticks, bowl). */
  liftsVessel?: boolean;
  /** Cut this many bites' worth at a time before eating them. */
  cutsEvery?: number;
  /**
   * Drinking: the vessel's height and radius in metres, which is all
   * `pourAngle` needs to decide how far the wrist goes over.
   */
  vessel?: { height: number; radius: number };
  /** The head travels to the drink instead of the drink travelling to it. */
  headLeads?: boolean;
  /**
   * Drunk THROUGH rather than out of, so the vessel never tips.
   *
   * The one mechanical difference between a straw and a short glass, and it
   * is the whole of it: `pourAngle` is never asked.
   */
  sipsThrough?: boolean;
}

export const UTENSILS: Record<Utensil, UtensilSpec> = {
  fork: {
    label: 'Fork',
    hands: 'one',
    // Speared, so a rotating wrist loses nothing. This is the control case:
    // everything a spoon does differently, it does because of `level`.
    level: 0.15,
    tip: [0.052, -0.012, 0],
    reach: 0.75,
    gather: 0.55,
    carry: 0.85,
    bite: 0.4,
    chew: 2.4,
    meet: 0.18,
  },
  spoon: {
    label: 'Spoon',
    hands: 'one',
    level: 1,
    tip: [0.05, -0.014, 0],
    reach: 0.8,
    gather: 0.7,
    // Slower than a fork, and that is the constraint showing: you cannot
    // hurry a level carry.
    carry: 1.15,
    bite: 0.45,
    chew: 2.0,
    meet: 0.3,
  },
  knifeAndFork: {
    label: 'Knife and fork',
    hands: 'both',
    level: 0.2,
    tip: [0.052, -0.012, 0],
    reach: 0.7,
    gather: 0.45,
    carry: 0.9,
    bite: 0.4,
    chew: 2.8,
    meet: 0.1,
    // The sub-action nothing else here has: a rhythmic saw, then three bites
    // off what it cut.
    cutsEvery: 3,
  },
  chopsticks: {
    label: 'Chopsticks',
    hands: 'one',
    level: 0.35,
    tip: [0.062, -0.01, 0],
    reach: 0.6,
    gather: 0.75,
    carry: 0.55,
    bite: 0.35,
    chew: 1.7,
    // The bowl comes up under the chin and the head comes down to it. Between
    // them the food travels barely twenty centimetres, which is why this reads
    // completely differently from a fork at the same tempo.
    meet: 0.75,
    liftsVessel: true,
  },
  hands: {
    label: 'Hands',
    hands: 'both',
    level: 0.1,
    tip: [0.03, -0.02, 0.02],
    reach: 0.6,
    gather: 0.5,
    carry: 0.7,
    bite: 0.55,
    chew: 3.0,
    meet: 0.55,
  },
  cup: {
    label: 'Cup',
    hands: 'one',
    level: 0.9,
    tip: [0.035, 0.03, 0],
    reach: 0.7,
    gather: 0.3,
    carry: 0.8,
    // A sip is long, and it is long because the tilt has to develop.
    bite: 1.3,
    chew: 1.4,
    meet: 0.2,
    grasp: [0.028, -0.022, 0],
    vessel: { height: 0.11, radius: 0.035 },
  },
  bowl: {
    label: 'Bowl',
    hands: 'both',
    level: 0.9,
    tip: [0.045, 0.035, 0],
    reach: 0.75,
    gather: 0.35,
    carry: 0.85,
    bite: 1.6,
    chew: 1.5,
    meet: 0.45,
    grasp: [0.03, -0.028, 0],
    vessel: { height: 0.075, radius: 0.07 },
    liftsVessel: true,
  },
  straw: {
    label: 'Straw',
    hands: 'one',
    level: 1,
    tip: [0.02, 0.11, 0],
    reach: 0.6,
    gather: 0.3,
    carry: 0.55,
    bite: 2.0,
    chew: 0.9,
    meet: 0.22,
    // The whole point, and the reason this is not just a short cup: a straw
    // reaches the liquid, so the glass NEVER GOES OVER. Same vessel, same
    // lift, and `pourAngle` is simply not asked. The first version had the
    // head travelling down to a glass left on the table, which needed 47 cm
    // of neck the rig does not have — measured, at 469 mm of mouth gap.
    sipsThrough: true,
    grasp: [0.026, -0.03, 0],
    vessel: { height: 0.13, radius: 0.033 },
  },
};

export const UTENSIL_NAMES = Object.keys(UTENSILS) as Utensil[];

/**
 * How far a wrist will actually pronate to keep a load flat, in radians.
 *
 * The correction is a real joint, not a free variable, so it gets a real
 * limit — and when the limit binds the spoon tips, which is the honest
 * outcome and the thing the gate is watching for. Raising the elbow is what a
 * person does about it, and `Dining` does the same.
 */
const WRIST_RANGE = 1.15;

/** The bones `Dining` takes outright: an idle sit pose has no opinion on these. */
const OWNED: BoneName[] = [
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
];

/** …and the ones it only ADDS to, so whatever posed the torso keeps it. */
const SHARED: BoneName[] = ['Spine', 'Chest', 'Neck', 'Head'];

/**
 * How far a diner will fold toward a far plate before giving up on it.
 *
 * Past this the plate is simply out of reach, and `measureBite` says so in
 * millimetres rather than the arm quietly stretching to cover it.
 */
const LEAN_LIMIT = 0.62;

/**
 * Radians of fold per metre of shortfall — the gain of the reach servo.
 *
 * The fold is CLOSED-LOOP rather than solved, and that is deliberate. The
 * first version predicted the angle analytically by rotating the shoulder
 * about the hips, which is what the body would do if it bent in one place. It
 * does not: the fold is spread over the spine and the chest, and it is ADDED
 * on top of whatever pose put the diner in their chair — a pose this module
 * does not own and cannot see. Measured, the closed form over-predicted the
 * benefit by enough to leave the fork 94 mm short of the plate while reporting
 * that it had converged. Feeding back the distance actually left is the only
 * number that is true of the body rather than of a model of it.
 */
const REACH_GAIN = 4.2;

export interface DiningOptions {
  utensil?: Utensil;
  /**
   * Where the food is. Its ORIGIN is where the utensil dips — a SCENA plate,
   * a bowl, a board, or an empty Object3D you placed yourself.
   */
  plate?: Object3D;
  /** Something that runs out. When it hits zero the meal is over. */
  food?: Countable;
  /** Mouthfuls to take when there is no `food` to count. Default 10. */
  bites?: number;
  /** The utensil itself, moved to the hand every frame. */
  held?: Object3D;
  /** The vessel a `liftsVessel` utensil raises with the free hand. */
  vessel?: Object3D;
  /** Which hand carries. Default 'right'. */
  hand?: 'left' | 'right';
  /** Seconds to fade in and out. Default 0.4. */
  fade?: number;
  /** Seeded fidget, so a full table does not eat in lockstep. */
  seed?: number;
  /** Scale every duration. A hungry diner is 0.7; a polite one is 1.3. */
  tempo?: number;
}

/** What `onBite` hands back the moment a mouthful lands. */
export interface BiteEvent {
  /** 1 for the first mouthful. */
  index: number;
  /** How much is left on the plate, 0..1. */
  left: number;
  /** Distance from the utensil's business end to the mouth, metres. */
  gap: number;
  /** For a drink: how far the wrist went over, radians. */
  tilt: number;
}

const scratchQ = new Quaternion();
const scratchV = new Vector3();
const scratchV2 = new Vector3();

/** Signed angle between two unit vectors about a reference axis. */
function tiltFrom(up: Vector3, want: Vector3): number {
  return Math.acos(clamp(up.dot(want), -1, 1));
}


/**
 * A meal.
 *
 * Owns the arms; adds to the chest, neck and head; never touches the hips or
 * the legs. `release()` gives all of it back over `fade` seconds.
 */
export class Dining {
  /** Mouthfuls taken. */
  bites = 0;
  /** Where in the mouthful the body is. */
  phase: DiningPhase = 'chew';
  /** 0..1 through the current phase. */
  progress = 0;

  private readonly rig: HumanoidRig;
  private readonly spec: UtensilSpec;
  private readonly name: Utensil;
  private readonly side: 'Left' | 'Right';
  private readonly free: 'Left' | 'Right';
  private readonly target: number;
  private readonly tempo: number;
  private readonly fadeRate: number;
  private readonly seed: number;
  private plate: Object3D | null;
  private food: Countable | null;
  private held: Object3D | null;
  private vessel: Object3D | null;

  private weight = 0;
  private wanted = 1;
  private restored = false;
  private clock = 0;
  private phaseClock = 0;
  private cutsLeft = 0;
  /** What was added to the shared bones last frame, to be given back. */
  private readonly gave = new Map<BoneName, Quaternion>();
  private readonly entry = new Map<BoneName, Quaternion>();
  private readonly biteCbs = new Set<(e: BiteEvent) => void>();
  private readonly doneCbs = new Set<() => void>();
  /** Live measurements, read by `measureBite` and anything with a HUD. */
  private readonly lastTip = new Vector3();
  private finishing = false;
  private fold = 0;
  private leaned = 0;
  private lastDt = 1 / 60;
  private tipAt = new Vector3();
  private mouthAt = new Vector3();
  private lastTilt = 0;
  private lastSpill = 0;

  constructor(rig: HumanoidRig, options: DiningOptions = {}) {
    this.rig = rig;
    this.name = options.utensil ?? 'fork';
    this.spec = UTENSILS[this.name];
    this.side = (options.hand ?? 'right') === 'left' ? 'Left' : 'Right';
    this.free = this.side === 'Left' ? 'Right' : 'Left';
    this.plate = options.plate ?? null;
    this.food = options.food ?? null;
    this.held = options.held ?? null;
    this.vessel = options.vessel ?? null;
    this.target = Math.max(1, Math.round(options.bites ?? 10));
    this.tempo = Math.max(0.2, options.tempo ?? 1);
    const fade = Math.max(0, options.fade ?? 0.4);
    this.fadeRate = fade > 0 ? 1 / fade : Infinity;
    this.seed = options.seed ?? 1;
    for (const name of [...OWNED, ...SHARED]) {
      this.entry.set(name, rig.bones[name].quaternion.clone());
      this.gave.set(name, new Quaternion());
    }
    this.cutsLeft = this.spec.cutsEvery ?? 0;
  }

  /** Which utensil this is. */
  get utensil(): Utensil {
    return this.name;
  }

  /** Its spec, for a UI that wants the label. */
  get about(): UtensilSpec {
    return this.spec;
  }

  /** How much is left, 0..1. Reads the `Countable` if there is one. */
  get left(): number {
    if (this.food) return this.food.capacity > 0 ? this.food.count / this.food.capacity : 0;
    return clamp01(1 - this.bites / this.target);
  }

  /** The meal is over — plate empty, or the bite count reached. */
  get done(): boolean {
    return this.phase === 'done';
  }

  /**
   * 0..1 through one chew, wrapping.
   *
   * PUBLISHED, not applied: this rig has no jaw bone, and inventing one would
   * reshape every character in the library for one feature. Drive a jaw or a
   * blend shape with it if your rig has one; ignore it if it does not, and the
   * pause still reads as chewing.
   */
  get chewPhase(): number {
    if (this.phase !== 'chew') return 0;
    return (this.clock * 1.9 * this.seedPhase()) % 1;
  }

  /**
   * False while there is food in the mouth.
   *
   * Hand it to `Conversation` and nobody talks with their mouth full — which is
   * a rule of the room rather than of the body, and so belongs out here rather
   * than in a pose.
   */
  get canSpeak(): boolean {
    return this.phase !== 'bite' && this.phase !== 'chew';
  }

  /** Distance from the utensil's business end to the mouth, metres, live. */
  get mouthGap(): number {
    return this.tipAt.distanceTo(this.mouthAt);
  }

  /** How far off level the load is right now, radians. 0 for a fork. */
  get spill(): number {
    return this.lastSpill;
  }

  /** How far the wrist has taken a vessel over, radians. */
  get tilt(): number {
    return this.lastTilt;
  }

  /**
   * How far the body is folded toward the plate, radians.
   *
   * Closed-loop, not authored: it is whatever it took to bring the plate
   * inside the arm this frame. A small character at a wide table leans
   * further than a tall one at the same table, and nobody wrote either number.
   */
  get lean(): number {
    return this.fold;
  }

  /** The deepest fold of the meal so far, radians. */
  get deepestLean(): number {
    return this.leaned;
  }

  /** Hear each mouthful land. Returns the unsubscribe. */
  onBite(cb: (e: BiteEvent) => void): () => void {
    this.biteCbs.add(cb);
    return () => this.biteCbs.delete(cb);
  }

  /** Hear the plate come up empty. Returns the unsubscribe. */
  onFinish(cb: () => void): () => void {
    this.doneCbs.add(cb);
    return () => this.doneCbs.delete(cb);
  }

  /** Move the plate, mid-meal. */
  setPlate(plate: Object3D | null): void {
    this.plate = plate;
  }

  /** Put the cutlery down and hand the arms back. */
  release(): void {
    this.wanted = 0;
  }

  private seedPhase(): number {
    return 0.9 + ((this.seed * 2654435761) % 1000) / 5000;
  }

  /** The phase table, in order, with this diner's tempo applied. */
  private phases(): Array<[DiningPhase, number]> {
    const s = this.spec;
    const t = this.tempo;
    const list: Array<[DiningPhase, number]> = [];
    // A knife and fork cuts before the bites it cut for, and not before the
    // ones it already has. That is why this is a table built per mouthful
    // rather than a fixed cycle.
    if (s.cutsEvery && this.cutsLeft >= s.cutsEvery) list.push(['cut', 1.6 * t]);
    list.push(['reach', s.reach * t]);
    list.push(['gather', s.gather * t]);
    list.push(['carry', s.carry * t]);
    list.push(['bite', s.bite * t]);
    list.push(['chew', s.chew * t]);
    return list;
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
    this.lastDt = dt;
    this.clock += dt;
    if (this.phase !== 'done') this.advance(dt);
    this.pose();
  }

  /** Walk the phase clock, firing the mouthful when the bite lands. */
  private advance(dt: number): void {
    this.phaseClock += dt;
    const list = this.phases();
    let t = this.phaseClock;
    for (const [phase, span] of list) {
      if (t > span && span > 0) {
        t -= span;
        continue;
      }
      const was = this.phase;
      this.phase = phase;
      this.progress = span > 0 ? clamp01(t / span) : 0;
      // The mouthful lands on ENTERING the bite, not on leaving it: the food
      // is gone the moment it arrives, and a plate that empties on the way
      // back down is a plate that emptied after the fact.
      if (phase === 'bite' && was !== 'bite') this.swallow();
      if (phase === 'cut' && was !== 'cut') this.cutsLeft = 0;
      return;
    }
    // The mouthful is over.
    this.phaseClock = 0;
    if (this.spec.cutsEvery) this.cutsLeft++;
    this.progress = 0;
    if (this.finishing) {
      this.phase = 'done';
      for (const cb of this.doneCbs) cb();
      return;
    }
    this.phase = 'reach';
  }

  private swallow(): void {
    this.bites++;
    if (this.food) this.food.setCount(Math.max(0, this.food.count - 1));
    for (const cb of this.biteCbs) {
      cb({ index: this.bites, left: this.left, gap: this.mouthGap, tilt: this.lastTilt });
    }
    // The last mouthful gets EATEN. Ending the meal the instant the plate hit
    // zero cut the hand off mid-bite and teleported the utensil 272 mm to a
    // resting pose it had not travelled to — and it is also just wrong: you
    // finish what is already on the fork.
    if (this.food ? this.food.count <= 0 : this.bites >= this.target) this.finishing = true;
  }

  /**
   * One frame of the meal.
   *
   * Order matters and is the same one `climb` and `lifting` use: place the
   * torso and head first, update the matrices, THEN solve the arms — a solve
   * needs the shoulders and the mouth to already be where it thinks they are.
   */
  private pose(): void {
    const rig = this.rig;
    const bones = rig.bones;
    const spec = this.spec;
    const h = rig.height;
    const w = this.weight * this.weight * (3 - 2 * this.weight);

    // 1. Give back last frame's contribution to the SHARED bones, so a meal
    //    never compounds onto whatever is holding the body in its chair.
    for (const name of SHARED) {
      bones[name].quaternion.multiply(this.gave.get(name)!.invert());
      this.gave.get(name)!.identity();
    }

    // 2. Where the food is, and where the mouth is, before anybody moves.
    const plateAt = scratchV;
    if (this.plate) {
      this.plate.getWorldPosition(plateAt);
      rig.object.worldToLocal(plateAt);
    } else {
      // No plate: a sensible one, in front of the chest at table height.
      plateAt.set(0, 0.42 * h, 0.26 * h);
    }
    const mouth = getSocket(rig, 'mouth');
    rig.object.updateWorldMatrix(true, true);
    const mouthRest = rig.object.worldToLocal(mouth.getWorldPosition(new Vector3()));

    // 3. The head comes to meet the food, by `meet`, over the part of the
    //    mouthful where that is what a person does — and the whole body folds
    //    by however much last frame's measurement said was still missing.
    const closing = this.closing();
    const meet = spec.meet * closing * w;
    void meet;
    const toward = new Vector3().subVectors(plateAt, mouthRest);
    const dip = clamp(toward.y * spec.meet * closing * w * 0.55, -0.28, 0);
    const lean = clamp(toward.z * spec.meet * closing * w * 0.5, 0, 0.32);
    // The meet rides the same fold the reach does. Routed through the head
    // alone it was worth 12 mm of mouth travel — true of the neck and useless
    // as a difference between eating styles. A bowl of noodles bends the whole
    // spine, which is exactly why it looks like a bowl of noodles.
    const f = (this.fold + spec.meet * closing * 0.42) * w;
    const [upperArm, foreArm] = chainLengths(rig, this.side, true);
    this.add('Spine', f * 0.55, 0);
    this.add('Chest', f * 0.45 - dip * 0.5 + lean * 0.55, 0);
    // The head stays level through the fold: you look at your plate, not at
    // your own knees, so the neck takes the lean back out.
    this.add('Neck', -f * 0.45 - dip * 0.7 + lean * 0.3, 0);
    this.add('Head', -f * 0.35 - dip * 0.9 + lean * 0.25, 0);
    rig.object.updateWorldMatrix(true, true);
    const mouthNow = rig.object.worldToLocal(mouth.getWorldPosition(new Vector3()));
    this.mouthAt.copy(mouthNow).applyMatrix4(rig.object.matrixWorld);

    // 4. Where the business end has to be this frame.
    const tipWant = this.tipTarget(plateAt, mouthNow, h);
    if (this.phase !== 'reach') this.lastTip.copy(tipWant);

    // 5. The hand's ORIENTATION first, then the wrist follows from it. The
    //    other way round is circular: the tip's offset is expressed in the
    //    hand's frame, so you cannot know where the wrist goes until you know
    //    which way the hand is facing.
    const grip = this.gripOrientation(tipWant, mouthNow, h);
    // Which point on the object is being aimed. At the plate it is where the
    // HAND meets it — asking whether a glass's rim reached the table is asking
    // the wrong question about picking a glass up — and at the face it is the
    // business end. Blended over the carry, because switching references
    // mid-mouthful would jump the hand by the length of the object.
    const g = spec.grasp ?? spec.tip;
    const mix = this.closing();
    const ref = new Vector3(
      (g[0] + (spec.tip[0] - g[0]) * mix) * h,
      (g[1] + (spec.tip[1] - g[1]) * mix) * h,
      (g[2] + (spec.tip[2] - g[2]) * mix) * h
    ).applyQuaternion(grip);
    const wrist = new Vector3().subVectors(tipWant, ref);

    this.solveArm(this.side, wrist, grip, h);
    if (spec.hands === 'both' || spec.liftsVessel) this.supportArm(plateAt, mouthNow, h, closing);
    else this.restArm(this.free, h);
    rig.object.updateWorldMatrix(true, true);

    // 6a. Close the reach loop. The shoulder is now where the fold actually
    //     put it, so the shortfall left is a fact about this body rather than
    //     a prediction about it.
    const shoulderAt = rig.object.worldToLocal(
      bones[`${this.side}Arm`].getWorldPosition(new Vector3())
    );
    const short = shoulderAt.distanceTo(plateAt) - (upperArm + foreArm) * 0.93;
    const want = this.reaching() ? clamp(this.fold + short * REACH_GAIN, 0, LEAN_LIMIT) : 0;
    this.fold += (want - this.fold) * clamp01(this.lastDt * 7);
    this.leaned = Math.max(this.leaned, this.fold);

    // 6b. Read back what actually happened — the same numbers `measureBite`
    //     takes, off the same transforms, rather than the ones we asked for.
    const hand = bones[`${this.side}Hand`];
    this.tipAt.set(spec.tip[0] * h, spec.tip[1] * h, spec.tip[2] * h);
    hand.localToWorld(this.tipAt);
    const up = scratchV2.set(0, 1, 0).applyQuaternion(hand.getWorldQuaternion(new Quaternion()));
    // ALWAYS measured, for every utensil.
    //
    // Reporting it only for the ones that correct made the number zero by
    // construction and the correction unfalsifiable: a fork came out as level
    // as a spoon because nobody had asked the fork. Measuring both is what
    // makes `level` a mechanism rather than a field — the spoon holds flat and
    // the fork does not, and the difference between them is the feature.
    // A vessel is exempt, because a tipping glass is the movement.
    this.lastSpill = spec.vessel ? 0 : tiltFrom(up, Y);

    // 7. Blend the whole thing toward the pose the body already had.
    if (w < 0.9999) {
      for (const name of OWNED) {
        scratchQ.copy(bones[name].quaternion);
        bones[name].quaternion.copy(this.entry.get(name)!).slerp(scratchQ, w);
      }
      rig.object.updateWorldMatrix(true, true);
    }

    if (this.held) this.carryProp(this.held, hand, spec.tip, h);
    if (this.vessel && spec.liftsVessel) {
      this.carryProp(this.vessel, bones[`${this.free}Hand`], [0.02, -0.04, 0], h);
    }
  }

  /** True while the hand is out at the plate rather than up at the face. */
  private reaching(): boolean {
    return this.phase === 'reach' || this.phase === 'gather' || this.phase === 'cut';
  }

  /** 0..1 — how close the food is to the face, for the head to answer to. */
  private closing(): number {
    const p = this.progress;
    switch (this.phase) {
      case 'carry':
        return p * p * (3 - 2 * p);
      case 'bite':
        return 1;
      case 'chew':
        return Math.max(0, 1 - p * 2.2);
      default:
        return 0;
    }
  }

  /** Where the business end should be, in rig space, this frame. */
  private tipTarget(plate: Vector3, mouth: Vector3, h: number): Vector3 {
    const spec = this.spec;
    const out = new Vector3();
    const rest = new Vector3(
      (this.side === 'Left' ? 1 : -1) * 0.16 * h,
      plate.y - 0.02 * h,
      plate.z * 0.55
    );
    // A straw never travels: the glass stays put and the face comes to it.
    const still = spec.headLeads ? plate : null;
    const p = this.progress;
    switch (this.phase) {
      case 'cut': {
        // Sawing, at the plate: a small fore-and-aft stroke, twice a second —
        // eased in from wherever the hand was, because a hand that appears at
        // the plate from a resting pose teleports 310 mm on one frame.
        out.copy(plate);
        out.z += Math.sin(p * TAU * 3) * 0.035 * h;
        out.y += 0.012 * h;
        const enter = clamp01(p * 4);
        if (this.lastTip.lengthSq() > 0) out.lerpVectors(this.lastTip, out, enter);
        return out;
      }
      case 'reach': {
        // FROM WHERE THE HAND ACTUALLY IS, not from the lap. A knife and fork
        // cuts at the plate and then "reaches" for it, and starting that from
        // a resting pose teleported the tines 310 mm on one frame.
        const from = this.lastTip.lengthSq() > 0 ? this.lastTip : rest;
        return out.lerpVectors(from, plate, p * p * (3 - 2 * p));
      }
      case 'gather':
        out.copy(plate);
        // Scooping, spearing, gripping — a small dip and a small circle,
        // because a hand that arrives at a plate and stops has not picked
        // anything up.
        out.y -= 0.02 * h * Math.sin(p * Math.PI);
        out.x += 0.02 * h * Math.sin(p * TAU) * (1 - spec.level);
        return out;
      case 'carry': {
        if (still) return out.copy(still);
        // The path ARCS: up first, in second. A straight line from a plate to
        // a face passes through the chin and reads as a machine.
        const rise = clamp01(p * 1.5);
        const across = p * p * (3 - 2 * p);
        out.copy(plate);
        out.y += (mouth.y - plate.y) * (rise * rise * (3 - 2 * rise));
        out.z += (mouth.z - plate.z) * across;
        out.x += (mouth.x - plate.x) * across;
        return out;
      }
      case 'bite':
        return out.copy(still ?? mouth);
      case 'chew':
        if (still) return out.copy(still);
        return out.lerpVectors(mouth, rest, clamp01(p * 1.6));
      case 'done':
      default:
        // Where the chew left it. Anything else is a jump on the frame the
        // meal ends, which is the one frame nobody thinks to look at.
        return out.copy(still ?? rest);
    }
  }

  /**
   * Which way the hand faces — and the whole of the level constraint.
   *
   * A base grip points the utensil forward out of the fist. On top of that,
   * anything with `level` gets rotated back toward flat, and anything drinking
   * gets tilted by `pourAngle`. The level correction is CLAMPED to a wrist's
   * range, so when it binds the load tips instead of the arm doing something
   * a shoulder cannot.
   */
  private gripOrientation(tip: Vector3, mouth: Vector3, h: number): Quaternion {
    const s = this.side === 'Left' ? 1 : -1;
    const q = new Quaternion();
    const step = new Quaternion();
    // Rest: forearm across the body, utensil pointing inward and forward.
    q.multiply(step.setFromAxisAngle(Y, -s * 1.25));
    q.multiply(step.setFromAxisAngle(X, -0.35));

    // Aim the utensil at the mouth as it arrives — the tines turn toward the
    // face rather than staying square to the plate.
    const aim = this.closing();
    q.multiply(step.setFromAxisAngle(Y, -s * 0.35 * aim));

    const spec = this.spec;
    if (spec.vessel && !spec.sipsThrough && (this.phase === 'bite' || this.phase === 'carry')) {
      // The drink. `pourAngle` decides, `progress` gets it there, and the
      // tilt is about the hand's own lateral axis so the rim goes to the lip.
      const want = pourAngle(this.left, spec.vessel.height, spec.vessel.radius);
      const into = this.phase === 'bite' ? Math.sin(this.progress * Math.PI) : 0;
      this.lastTilt = want * into;
      q.multiply(step.setFromAxisAngle(X, -this.lastTilt));
    } else {
      this.lastTilt = 0;
    }

    if (spec.level > 0.5 && !spec.vessel) {
      // Level, or as level as a wrist gets. Measure what the base grip did to
      // the bearing surface and take it back — up to the joint's limit.
      const up = scratchV2.set(0, 1, 0).applyQuaternion(q);
      const off = tiltFrom(up, Y);
      const axis = new Vector3().crossVectors(up, Y);
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        const fix = Math.min(off * spec.level, WRIST_RANGE);
        q.premultiply(step.setFromAxisAngle(axis, fix));
      }
    }
    void tip;
    void mouth;
    void h;
    return q;
  }

  /** Put the carrying hand's wrist at `wrist` and face it `grip`. */
  private solveArm(side: 'Left' | 'Right', wrist: Vector3, grip: Quaternion, h: number): void {
    const rig = this.rig;
    const s = side === 'Left' ? 1 : -1;
    const [upper, fore] = chainLengths(rig, side, true);
    const shoulder = rig.object.worldToLocal(
      rig.bones[`${side}Arm`].getWorldPosition(new Vector3())
    );
    // Elbow down and OUT. Out is the part that matters: an elbow tucked to the
    // ribs cannot keep a spoon level, which is why people lift it, and which
    // is why the pole is not simply straight down.
    const pole = new Vector3(s * 0.85, -0.9, -0.35).normalize();
    const { root, joint } = solveChain(
      shoulder,
      wrist,
      new Vector3(s, 0, 0),
      upper,
      fore,
      pole
    );
    rig.bones[`${side}Arm`].quaternion.copy(toParentFrame(rig, `${side}Arm`, root));
    rig.bones[`${side}ForeArm`].quaternion.copy(joint);
    rig.bones[`${side}Shoulder`].quaternion.identity();
    rig.object.updateWorldMatrix(true, true);
    rig.bones[`${side}Hand`].quaternion.copy(toParentFrame(rig, `${side}Hand`, grip));
    void h;
  }

  /** The free hand: steadying the plate, or lifting the bowl to the chin. */
  private supportArm(plate: Vector3, mouth: Vector3, h: number, closing: number): void {
    const s = this.free === 'Left' ? 1 : -1;
    const at = new Vector3();
    if (this.spec.liftsVessel) {
      // The bowl travels most of the way to the face, and the face comes down
      // to it. This is the whole difference between chopsticks and a fork.
      at.lerpVectors(plate, mouth, 0.62 * closing);
      at.y -= 0.05 * h;
      at.x += s * 0.05 * h;
    } else {
      at.copy(plate);
      at.x += s * 0.14 * h;
      at.y += 0.01 * h;
      at.z -= 0.03 * h;
    }
    const grip = new Quaternion()
      .setFromAxisAngle(Y, -s * 1.15)
      .multiply(new Quaternion().setFromAxisAngle(X, -0.5));
    const tip = new Vector3(0.02 * h, -0.03 * h, 0).applyQuaternion(grip);
    this.solveArm(this.free, at.sub(tip), grip, h);
  }

  /** …or it stays in the diner's lap, which is where a spare hand goes. */
  private restArm(side: 'Left' | 'Right', h: number): void {
    const s = side === 'Left' ? 1 : -1;
    const at = new Vector3(s * 0.13 * h, 0.4 * h, 0.11 * h);
    const grip = new Quaternion().setFromAxisAngle(Y, -s * 0.9);
    this.solveArm(side, at, grip, h);
  }

  /** Add to a shared bone, remembering it so next frame can take it back. */
  private add(name: BoneName, x: number, y: number): void {
    if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return;
    const q = new Quaternion()
      .setFromAxisAngle(X, x)
      .multiply(new Quaternion().setFromAxisAngle(Y, y));
    this.rig.bones[name].quaternion.multiply(q);
    this.gave.get(name)!.copy(q);
  }

  /** Move a prop onto a hand, at the utensil's own offset. */
  private carryProp(obj: Object3D, hand: Object3D, at: [number, number, number], h: number): void {
    if (obj.parent !== this.rig.object) this.rig.object.add(obj);
    const p = new Vector3(at[0] * h * 0.35, at[1] * h * 0.35, at[2] * h * 0.35);
    hand.localToWorld(p);
    this.rig.object.worldToLocal(p);
    obj.position.copy(p);
    obj.quaternion.copy(hand.getWorldQuaternion(new Quaternion()));
    obj.updateMatrixWorld(true);
  }
}

/* ────────────────────────────────────────────────────────────────────────
   The gate
   ──────────────────────────────────────────────────────────────────────── */

/**
 * What a meal actually did, in numbers.
 *
 * Read off a driven `Dining` through the skinned rig, not out of the
 * expressions that produced it — the same independence rule `measureFootSkate`
 * works to.
 */
export interface BiteReport {
  /** Mouthfuls taken before the plate came up empty. */
  bites: number;
  /** True if the meal ended because the food ran out. */
  emptied: boolean;
  /**
   * Worst distance from the utensil's business end to the mouth, at the
   * moment of a mouthful, metres.
   *
   * THE number. A fork that stops four centimetres short of the face is the
   * most recognisable broken eating animation there is, and it is invisible in
   * every still frame that is not taken at exactly the right instant.
   */
  mouthGap: number;
  /**
   * Worst tilt of the bearing surface away from horizontal on the way up,
   * radians — for the utensils that carry something loose.
   *
   * A spoon's whole shape comes from this constraint. It is the bar-over-
   * mid-foot of dining: not a preference, just what happens to soup.
   */
  spill: number;
  /** Worst distance from the business end to the plate while gathering. */
  plateGap: number;
  /** Fraction of the meal the carrying hand was NOT travelling. */
  handIdle: number;
  /** How far the head travelled — folding to the plate and meeting the food. */
  headTravel: number;
  /** The deepest the body folded toward the plate, radians. */
  lean: number;
  /** Wrist tilt on the first mouthful and the last, radians — drinks only. */
  tiltFirst: number;
  tiltLast: number;
  /** Largest single-frame jump of the business end, metres. */
  pop: number;
}

export interface BiteOptions extends DiningOptions {
  /** Simulation step. Default 1/120. */
  step?: number;
  /** Give up after this many simulated seconds. Default 240. */
  limit?: number;
}

/** A plate of `n`, for measuring against. */
export function servings(n: number): Countable {
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

/**
 * Eat a whole plate and measure it.
 *
 * Runs the real controller and reads world positions out of the transform
 * hierarchy that ships, including the wrist clamp binding and the head coming
 * to meet the food.
 */
export function measureBite(
  rig: HumanoidRig,
  utensil: Utensil,
  options: BiteOptions = {}
): BiteReport {
  const spec = UTENSILS[utensil];
  const step = options.step ?? 1 / 120;
  const limit = options.limit ?? 240;
  const before = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);

  const food = options.food ?? servings(options.bites ?? 6);
  const meal = new Dining(rig, { ...options, utensil, food, fade: 0 });
  const mouth = getSocket(rig, 'mouth');

  // CLOSEST APPROACH, per mouthful — not the worst frame.
  //
  // The same lesson the climb gate had to learn one contact over. A gather is
  // a scoop: the utensil deliberately dips and circles, and a worst-frame
  // reading calls that 40 mm of miss on a plate the hand is holding. What is
  // being asked is whether the utensil ever actually reached the food and
  // whether it ever actually reached the face, and both of those are minima.
  let mouthGap = 0;
  let spill = 0;
  let plateGap = 0;
  let nearPlate = Infinity;
  let nearMouth = Infinity;
  let wasPhase: string = 'chew';
  let pop = 0;
  let idle = 0;
  let frames = 0;
  let headLow = Infinity;
  let headHigh = -Infinity;
  let tiltFirst = 0;
  let tiltLast = 0;
  let tiltPeak = 0;
  meal.onBite(() => {
    // The tilt is captured at the PEAK of the sip rather than at the moment
    // the mouthful is counted — a swallow fires on entering the bite, when
    // the wrist has not gone over yet, and reading it there reported 0.00 for
    // every drink in the library.
    if (tiltFirst === 0) tiltFirst = tiltPeak;
    tiltLast = tiltPeak;
    tiltPeak = 0;
  });

  const plateAt = new Vector3();
  const tip = new Vector3();
  const grasp = new Vector3();
  const prev = new Vector3();
  rig.object.updateWorldMatrix(true, true);

  let t = 0;
  while (!meal.done && t < limit) {
    meal.update(step);
    t += step;
    frames++;

    const hand = rig.bones[(options.hand ?? 'right') === 'left' ? 'LeftHand' : 'RightHand'];
    tip.set(spec.tip[0] * rig.height, spec.tip[1] * rig.height, spec.tip[2] * rig.height);
    hand.localToWorld(tip);
    const g = spec.grasp ?? spec.tip;
    grasp.set(g[0] * rig.height, g[1] * rig.height, g[2] * rig.height);
    hand.localToWorld(grasp);

    // Each window closes when the phase changes; the closest the utensil ever
    // got inside it is that mouthful's answer, and the worst of those answers
    // is the meal's.
    if (meal.phase !== wasPhase) {
      if (wasPhase === 'gather' && Number.isFinite(nearPlate)) {
        plateGap = Math.max(plateGap, nearPlate);
      }
      if (wasPhase === 'bite' && Number.isFinite(nearMouth)) {
        mouthGap = Math.max(mouthGap, nearMouth);
      }
      nearPlate = Infinity;
      nearMouth = Infinity;
      wasPhase = meal.phase;
    }
    if (meal.phase === 'gather' && options.plate) {
      options.plate.getWorldPosition(plateAt);
      nearPlate = Math.min(nearPlate, grasp.distanceTo(plateAt));
    }
    if (meal.phase === 'carry' || meal.phase === 'bite') {
      spill = Math.max(spill, meal.spill);
      tiltPeak = Math.max(tiltPeak, meal.tilt);
    }
    if (meal.phase === 'bite') nearMouth = Math.min(nearMouth, meal.mouthGap);
    // The RANGE, over the settled half of the meal. The fold toward the plate
    // is a constant once it arrives, so measuring displacement from the rest
    // pose reported the lean and hid the thing being asked about — every
    // utensil came out at 71 mm whatever its `meet` said.
    if (t > limit * 0 && meal.bites >= 1) {
      const at = mouth.getWorldPosition(new Vector3());
      headLow = Math.min(headLow, at.z);
      headHigh = Math.max(headHigh, at.z);
    }

    if (frames > 1) {
      const moved = tip.distanceTo(prev);
      pop = Math.max(pop, moved);
      // "Not travelling" is a real threshold, not zero: a hand at rest still
      // breathes, and counting that as motion would report a diner who never
      // stops moving, which is the exact defect this is here to catch.
      if (moved < step * 0.06) idle++;
    }
    prev.copy(tip);
  }
  meal.release();
  for (const [name, q] of before) rig.bones[name].quaternion.copy(q);
  rig.object.updateWorldMatrix(true, true);

  if (Number.isFinite(nearPlate)) plateGap = Math.max(plateGap, nearPlate);
  return {
    bites: meal.bites,
    emptied: meal.done,
    mouthGap: Math.max(mouthGap, Number.isFinite(nearMouth) ? nearMouth : 0),
    spill,
    plateGap,
    handIdle: frames > 1 ? idle / (frames - 1) : 0,
    headTravel: Number.isFinite(headHigh - headLow) ? headHigh - headLow : 0,
    lean: meal.deepestLean,
    tiltFirst,
    tiltLast,
    pop,
  };
}
