import { Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';
import { Guard, coverageOf, intercepts, zonePoint, type GuardName } from './guard';
import { KUZUSHI_DIRECTIONS, breakEffort, type KuzushiDirection } from './grappling';
import { STRIKES, measureStrike, stability, strikeReach, type StrikeName } from './striking';
import {
  applyStance,
  holdStance,
  releaseStance,
  type StanceHold,
  type StanceShape,
} from './stance';

/**
 * FightStyle — a style is WHERE THE FEET ARE, WHERE THE HANDS ARE, and WHAT
 * THE FIGHTER KNOWS HOW TO THROW.
 *
 * There is no damage multiplier here, no speed bonus, and no accuracy roll.
 * A style is three facts about a body, and everything a game would want to
 * know about it is a CONSEQUENCE that some other module in this library was
 * already measuring for its own reasons:
 *
 *   the stance      two footprints. `stability()` reads the polygon they make,
 *                   so the stance decides what every strike costs in balance;
 *                   `strikeReach` measures from a shoulder the stance has
 *                   moved; and `breakEffort` is a statement about the same
 *                   polygon, so the stance also decides which way this fighter
 *                   gets thrown
 *   the guard       a `GuardName`. `coverageOf` samples the directions a
 *                   strike could come from and asks whether an arm is on the
 *                   line
 *   the repertoire  which strikes this fighter throws at all. NOT a multiplier
 *                   on them — a style does not make an elbow hurt more, it
 *                   makes an elbow available
 *
 * So the six styles below are not balanced against each other by anybody. They
 * are six sets of footprints, and the numbers come out where they come out.
 * The gate's job is to check that nobody comes out best at everything, and it
 * has to be able to fail: a stance model that quietly stopped mattering would
 * produce six identical profiles and read exactly like one that worked.
 *
 * ## The knob that is deliberately NOT here
 *
 * `Striking` now exposes `follow` — how far the hips and thorax keep turning
 * through contact, which was a module-level constant. It was built for this
 * module: *kime* against swinging through is a real difference between karate
 * and muay thai, and it looked like the obvious way to express it.
 *
 * Measured, it buys a jab 58% more effective mass for 5% of its balance and
 * nothing at all in recovery, and it buys a cross 90% more for no measurable
 * cost whatsoever. That is a free damage multiplier with a physical-sounding
 * name on it, which is the exact thing this library refuses to ship.
 *
 * So `follow` stays available to anybody who wants it, every style uses the
 * same value, and the gate asserts that they do. If a real cost is found
 * later, the styles can start differing on it. Until then, no.
 */

export type FightStyleName = 'boxing' | 'karate' | 'muayThai' | 'wingChun' | 'taekwondo' | 'brawler';

export interface FightStyleSpec {
  label: string;
  /** Where the feet go. Fractions of the fighter's own height. */
  stance: StanceShape;
  /** Which guard the hands hold. */
  guard: GuardName;
  /**
   * What this fighter throws. Availability, not advantage — every strike in
   * here is exactly as heavy as `Striking` measures it to be for anybody.
   */
  repertoire: StrikeName[];
}

/**
 * Six styles, chosen because their FEET disagree.
 *
 * Every stance below is a real one, and the numbers in it are the two
 * measurements a stance actually is: how far apart the ankles are across the
 * line of engagement, and how far the lead one is in front. Everything a
 * fighter gains or gives up by standing that way is then computed.
 */
export const FIGHT_STYLES: Record<FightStyleName, FightStyleSpec> = {
  boxing: {
    label: 'Boxing',
    // Bladed, about shoulder width, a comfortable step of stagger. The
    // reference stance, and the one `Striking` has always held.
    stance: { spread: 0.105, stagger: 0.21, sink: 0.005, blade: 0.35 },
    guard: 'peekaboo',
    repertoire: ['jab', 'cross', 'hook', 'uppercut', 'overhand'],
  },
  karate: {
    label: 'Karate',
    // Zenkutsu-dachi: very long front to back and narrow across. Everything
    // about this stance is a bet on the line straight ahead.
    stance: { spread: 0.09, stagger: 0.4, sink: 0.02, blade: 0.22 },
    guard: 'philly',
    repertoire: ['jab', 'cross', 'backfist', 'frontKick', 'sideKick', 'roundhouse'],
  },
  muayThai: {
    label: 'Muay Thai',
    // Square and upright, because the lead leg has to be free to check a kick
    // and the hands have to be able to catch a neck.
    stance: { spread: 0.135, stagger: 0.09, sink: 0, blade: 0.1 },
    // Hands high, elbows in, forearms vertical in front of the face. The
    // classic Thai guard is a cover, not a fence.
    guard: 'highCover',
    repertoire: ['jab', 'cross', 'elbow', 'knee', 'teep', 'roundhouse'],
  },
  wingChun: {
    label: 'Wing Chun',
    // Yee jee kim yeung ma: narrow, square, knees in, feet almost level. Built
    // to hold a centre line rather than to travel.
    stance: { spread: 0.105, stagger: 0.03, sink: 0.05, blade: 0.02 },
    // Man sau and wu sau: one arm out along the centre line and one behind it.
    // That IS a long guard, and it is the only guard in the library that puts
    // anything on the line a straight punch comes down.
    guard: 'longGuard',
    repertoire: ['jab', 'cross', 'palmStrike', 'backfist', 'frontKick'],
  },
  taekwondo: {
    label: 'Taekwondo',
    // Side-on and long, hands low, weight back over the rear foot: a stance
    // that exists so a leg can leave the floor quickly.
    stance: { spread: 0.075, stagger: 0.29, sink: 0, blade: 0.75 },
    guard: 'lowGuard',
    repertoire: ['jab', 'backfist', 'frontKick', 'sideKick', 'roundhouse'],
  },
  brawler: {
    label: 'Brawler',
    // Wide, square, planted, hands by the hips. Nobody taught this and it
    // shows — but it is genuinely hard to knock over, and the gate says so.
    stance: { spread: 0.2, stagger: 0.06, sink: 0.01, blade: 0.08 },
    guard: 'open',
    repertoire: ['overhand', 'hammerfist', 'hook', 'uppercut', 'cross'],
  },
};

export const FIGHT_STYLE_NAMES = Object.keys(FIGHT_STYLES) as FightStyleName[];

// ------------------------------------------------------------- the profile

export interface StyleProfile {
  style: FightStyleName;
  /** How close this stance stands to falling over, in foot lengths. */
  base: number;
  /** The longest strike in the repertoire, metres from the body's own origin. */
  reach: number;
  /** Mean effective mass across the repertoire, kg. */
  power: number;
  /** The worst balance any strike in the repertoire spends, in foot lengths. */
  poise: number;
  /** What the guard covers of the head, 0..1. */
  cover: number;
  /** What the guard covers of the body, 0..1. */
  guardBody: number;
  /**
   * What the guard covers of the head FROM STRAIGHT AHEAD, 0..1.
   *
   * A separate column from `cover` because it is a separate question, and
   * because a guard can be excellent at one and poor at the other. `cover`
   * averages every angle a strike could come from; this samples a narrow cone
   * down the line of engagement — the centre line, which some styles exist
   * almost entirely to hold.
   */
  centre: number;
  /** The cheapest way to throw this fighter — radians of tip. Bigger is safer. */
  rooted: number;
  /** ...and which direction that is. */
  weakLine: KuzushiDirection;
  /** How many of the fourteen strikes this style has at all. */
  breadth: number;
}

/** Every bone a profile might disturb — which is all of them. */
const BONES: BoneName[] = [
  'Hips',
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
];

function restore(
  rig: HumanoidRig,
  snapshot: import('three').Quaternion[],
  hips: import('three').Vector3
): void {
  BONES.forEach((b, i) => rig.bones[b].quaternion.copy(snapshot[i]));
  rig.bones.Hips.position.copy(hips);
  rig.object.updateMatrixWorld(true);
}

const HOLDS = new WeakMap<HumanoidRig, StanceHold>();

/** One hold per body, because the first one is the only honest one. */
function holdOf(rig: HumanoidRig): StanceHold {
  let hold = HOLDS.get(rig);
  if (!hold) {
    hold = holdStance(rig);
    HOLDS.set(rig, hold);
  }
  return hold;
}

/**
 * Everything this style does to this body, measured.
 *
 * Not one of these columns is stored anywhere. The stance is applied to a real
 * rig and then four modules are asked their own questions of it: `stability`,
 * `strikeReach`, `measureStrike`, `coverageOf` and `breakEffort`. The body is
 * put back exactly as it was found.
 */
export function styleProfile(
  rig: HumanoidRig,
  style: FightStyleName,
  lead: 'Left' | 'Right' = 'Left'
): StyleProfile {
  const spec = FIGHT_STYLES[style];
  const hold = holdOf(rig);
  // The whole body, copied out and put back. A profile that depends on which
  // style was profiled BEFORE it is not a profile of anything, and this went
  // undetected until the same guard on two styles came out 28.6% and 24.2% —
  // `measureStrike` does not lower the guard when it finishes, so it leaves
  // the arms up, and `strikeReach` measures from a shoulder those arms moved.
  const snapshot = BONES.map((b) => rig.bones[b].quaternion.clone());
  const hipsHome = rig.bones.Hips.position.clone();
  applyStance(rig, hold, spec.stance, lead);

  const base = stability(rig);
  let reach = 0;
  for (const n of spec.repertoire) reach = Math.max(reach, strikeReach(rig, n));

  // The weak line, and how dear it is. Measured on the body STANDING IN THE
  // STANCE, which is the whole point: a long narrow stance and a wide square
  // one do not get thrown the same way.
  let rooted = Infinity;
  let weakLine: KuzushiDirection = 'back';
  for (const d of KUZUSHI_DIRECTIONS) {
    const e = breakEffort(rig, d);
    if (e.lean < rooted) {
      rooted = e.lean;
      weakLine = d;
    }
  }

  releaseStance(rig, hold);
  // The guard is measured from a CLEAN body, not from whatever the last
  // measurement left behind — so two styles that hold the same guard get the
  // same number, which is the invariant that caught this. `measureStrike` does
  // not lower the guard when it finishes, and running the guard afterwards
  // measured it on a body still carrying the last punch: the same long guard
  // came out 36.3% standalone and 28.0% here.
  restore(rig, snapshot, hipsHome);
  const guarded = guardCoverage(rig, spec.guard);
  restore(rig, snapshot, hipsHome);

  // The strikes, thrown from this stance. `measureStrike` builds its own
  // striker, so the footing is handed to it rather than posed underneath.
  let power = 0;
  let poise = Infinity;
  for (const n of spec.repertoire) {
    const r = measureStrike(rig, n, { skill: 0.8, footing: spec.stance });
    power += r.mass / spec.repertoire.length;
    poise = Math.min(poise, r.worstBalance);
  }

  restore(rig, snapshot, hipsHome);

  return {
    style,
    base,
    reach,
    power,
    poise,
    cover: guarded.head,
    guardBody: guarded.body,
    centre: guarded.centre,
    rooted,
    weakLine,
    breadth: spec.repertoire.length,
  };
}

/**
 * What this style's guard covers, on this body.
 *
 * It runs the real `Guard` controller for forty frames and then asks
 * `coverageOf` — rather than reimplementing where a peekaboo puts a hand. A
 * second copy of that would be a second thing to keep in step with the first,
 * and the whole argument of the guard module is that coverage is measured off
 * whatever pose the arms are actually in.
 */
function guardCoverage(
  rig: HumanoidRig,
  name: GuardName
): { head: number; body: number; centre: number } {
  // Copy the arms out before the controller touches them, and put them back
  // afterwards. `Guard.lower()` does hand them back, but only over however
  // many frames its fade takes, and a measurement that depends on having run
  // the restore for long enough is a measurement that depends on the style
  // measured BEFORE it. Two styles sharing a guard came out 28.0% and 0.0% on
  // the same column for no reason but their position in the loop.
  const arms: BoneName[] = [
    'LeftArm',
    'LeftForeArm',
    'LeftHand',
    'RightArm',
    'RightForeArm',
    'RightHand',
    'Chest',
    'Head',
  ];
  const was = arms.map((b) => rig.bones[b].quaternion.clone());
  const g = new Guard(rig, { style: name, fade: 0 });
  for (let i = 0; i < 40; i++) g.update(1 / 120);
  const head = coverageOf(rig, 'head');
  const body = coverageOf(rig, 'body');
  const centre = centreLine(rig);
  arms.forEach((b, i) => rig.bones[b].quaternion.copy(was[i]));
  rig.object.updateMatrixWorld(true);
  return { head, body, centre };
}

const CONE = Math.PI / 12;
const AT = new Vector3();
const DIR = new Vector3();
const FWD = new Vector3();
const SIDE = new Vector3();
const SPIN = new Quaternion();

/**
 * How much of a narrow cone straight down the middle is covered.
 *
 * A peekaboo's gloves sit either side of the centre line and a punch down the
 * middle splits them — a thing the geometry said without being asked when
 * `Guard` was built, and the reason this column exists. Averaging over every
 * approach angle hides it completely.
 */
function centreLine(rig: HumanoidRig): number {
  rig.object.updateMatrixWorld(true);
  zonePoint(rig, 'head', AT);
  rig.object.getWorldQuaternion(SPIN);
  FWD.set(0, 0, 1).applyQuaternion(SPIN);
  SIDE.set(1, 0, 0).applyQuaternion(SPIN);
  let hits = 0;
  let total = 0;
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const a = (i / 2) * CONE;
      const b = (j / 2) * CONE;
      // The strike TRAVELS toward the fighter, so it runs along −forward.
      // Sampling +forward asks what covers the back of somebody's head, which
      // is nothing, for everybody, and reads as a working measurement.
      DIR.copy(FWD).multiplyScalar(-1).addScaledVector(SIDE, Math.tan(a));
      DIR.y -= Math.tan(b);
      DIR.normalize();
      total++;
      if (intercepts(rig, AT, DIR).blocked) hits++;
    }
  }
  return hits / total;
}

// -------------------------------------------------------------- the layer

export interface FightStyleOptions {
  /** Which foot is forward. Orthodox leads with the left. */
  lead?: 'Left' | 'Right';
  /** Seconds to blend the stance in and out. 0 snaps. */
  fade?: number;
}

/**
 * A body standing in a style.
 *
 * Holds the stance and hands it back. It owns the pelvis height, the pelvis
 * yaw and both legs — and nothing else, because nothing else is a stance.
 *
 * Run it BEFORE `Striking` in a frame. `Striking` composes its weight shift
 * and hip turn on top as deltas, and takes the kicking leg outright while a
 * kick is in the air; both of those are correct on top of a stance and wrong
 * underneath one.
 */
export class FightStyle {
  /** The style being held. */
  name: FightStyleName;
  /** 0..1, how much of the stance is currently applied. */
  weight = 0;

  private readonly rig: HumanoidRig;
  private readonly lead: 'Left' | 'Right';
  private readonly fadeRate: number;
  private readonly hold: StanceHold;
  private wanted = 1;

  constructor(rig: HumanoidRig, name: FightStyleName, options: FightStyleOptions = {}) {
    this.rig = rig;
    this.name = name;
    this.lead = options.lead ?? 'Left';
    const fade = options.fade ?? 0.2;
    this.fadeRate = fade > 0 ? 1 / fade : Infinity;
    this.hold = holdOf(rig);
  }

  /** The spec being held, for anything that wants the repertoire or the guard. */
  get spec(): FightStyleSpec {
    return FIGHT_STYLES[this.name];
  }

  /** Change style. The feet move; everything downstream moves with them. */
  switchTo(name: FightStyleName): void {
    this.name = name;
    this.wanted = 1;
  }

  /** Stand down. The body goes back to whatever pose it was found in. */
  stand(): void {
    this.wanted = 0;
  }

  /** Take the stance again. */
  settle(): void {
    this.wanted = 1;
  }

  update(dt: number): void {
    const step = Math.max(0, dt) * this.fadeRate;
    if (this.weight !== this.wanted) {
      const d = Math.sign(this.wanted - this.weight) * step;
      this.weight =
        Math.abs(this.wanted - this.weight) <= Math.abs(d) ? this.wanted : this.weight + d;
    }
    if (this.weight <= 0) {
      releaseStance(this.rig, this.hold);
      return;
    }
    applyStance(this.rig, this.hold, this.spec.stance, this.lead, this.weight);
  }

  /** Hand the body back and forget the stance. */
  release(): void {
    this.weight = 0;
    this.wanted = 0;
    releaseStance(this.rig, this.hold);
  }

  /** Whether this style throws that strike at all. */
  knows(strike: StrikeName): boolean {
    return this.spec.repertoire.includes(strike);
  }

  /**
   * The next strike, walking the repertoire in order.
   *
   * Deliberately not random: a style's repertoire is what it HAS, and picking
   * from it is a decision for whatever is driving the fighter — GAMA's utility
   * AI, a player, or a demo that wants every strike shown once.
   */
  at(index: number): StrikeName {
    const list = this.spec.repertoire;
    return list[((index % list.length) + list.length) % list.length];
  }
}

/** Every strike the six styles between them know. */
export const STYLED_STRIKES: StrikeName[] = Array.from(
  new Set(FIGHT_STYLE_NAMES.flatMap((n) => FIGHT_STYLES[n].repertoire))
).filter((n) => n in STRIKES);
