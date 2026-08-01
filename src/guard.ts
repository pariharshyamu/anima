import { Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Blow, StrikeName } from './striking';
import { STRIKES } from './striking';

/**
 * Guard — where defence is geometry and a stopwatch, not a dice roll.
 *
 * Two things decide whether a strike arrives, and this module measures both
 * rather than rolling for either.
 *
 * WHAT THE ARMS ACTUALLY COVER. A guard occludes some of the directions a
 * strike can come from and not others, and which ones is a question about
 * where the limbs are — so it is answered by sampling directions onto the
 * target and asking whether the line passes through an arm. A peekaboo covers
 * the head and leaves the body open; a low guard does the reverse; a shell is
 * asymmetric because the fighter is. Those differences fall out of the poses.
 * Nothing declares them.
 *
 * WHETHER THERE WAS TIME. A strike takes as long as its wind-up, which
 * `Striking` measures; a person takes as long as their reaction, which
 * psychophysics measures. If the strike is shorter, no defence that requires
 * seeing it can happen at all — and a jab's 130 ms is shorter than ANYBODY's
 * reaction. That is not a rule invented here. It is why the jab is the most
 * thrown punch in boxing, and it comes out of two numbers that were both
 * already being measured for other reasons.
 *
 * So a guard defends in two ways with completely different characters: the
 * STATIC cover, which needs no reaction and is on all the time, and the ACTIVE
 * defences — parry, slip, roll — which need to be triggered and therefore need
 * the time to be there.
 */

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => clamp(v, 0, 1);

// -------------------------------------------------------------- reaction

/**
 * Simple visual reaction time — a known signal, a known response. About 180 ms
 * for a healthy adult, and it has been about 180 ms since Donders measured it
 * in 1868.
 */
export const SIMPLE_REACTION = 0.18;

/**
 * Choice reaction time — several possible signals, and you have to work out
 * which one arrived before you can answer. Roughly twice simple, and it is the
 * difference between a fighter who has seen the shot before and one who has
 * not.
 */
export const CHOICE_REACTION = 0.35;

/**
 * How long this defender takes to answer a strike, in seconds.
 *
 * `skill` interpolates between the two: a novice pays the full choice-reaction
 * penalty because every incoming shot is a question, and an expert approaches
 * simple reaction because they have already narrowed it to a handful of
 * answers. That is what "reading" somebody is, and it is worth 170 ms.
 */
export function reactionTime(skill: number): number {
  const s = clamp01(skill);
  return CHOICE_REACTION + (SIMPLE_REACTION - CHOICE_REACTION) * s;
}

/**
 * Can this defender react to that strike at all?
 *
 * The wind-up is how long the strike takes to arrive from the moment it starts
 * — which is the moment it becomes visible. If that is shorter than the
 * reaction, the answer is no, and no amount of defensive skill changes it:
 *
 *   a jab       130 ms   nobody reacts to it. Not an expert, not anyone.
 *   a cross     180 ms   an expert, exactly on the line
 *   an overhand 260 ms   an expert comfortably; a novice never
 *   a roundhouse 260 ms  the same, which is why body kicks get checked and
 *                        jabs get eaten
 */
export function canReactTo(strike: StrikeName, skill: number, tempo = 1): boolean {
  return STRIKES[strike].windup / Math.max(0.05, tempo) > reactionTime(skill);
}

// ----------------------------------------------------------------- zones

/** What a strike is aimed at. Three, because a body has three heights. */
export type GuardZone = 'head' | 'body' | 'legs';

export const GUARD_ZONES: GuardZone[] = ['head', 'body', 'legs'];

/** Where a zone lives on a particular body, in world space. */
export function zonePoint(rig: HumanoidRig, zone: GuardZone, out = new Vector3()): Vector3 {
  rig.object.updateMatrixWorld(true);
  if (zone === 'head') return rig.bones.Head.getWorldPosition(out);
  if (zone === 'body') return rig.bones.Chest.getWorldPosition(out);
  // The LEAD thigh, not the midpoint between the knees. A point between the
  // legs is inside the body and both legs occlude every line to it, so every
  // guard came out covering the legs 100% — including one with its hands by
  // its sides. A low kick is aimed at a thigh.
  const hip = rig.bones.LeftUpLeg.getWorldPosition(out);
  const knee = rig.bones.LeftLeg.getWorldPosition(SPARE);
  return hip.lerp(knee, 0.55);
}

const SPARE = new Vector3();

// ---------------------------------------------------------------- guards

export type GuardName =
  | 'peekaboo'
  | 'philly'
  | 'longGuard'
  | 'highCover'
  | 'lowGuard'
  | 'crossArm'
  | 'open';

export interface GuardSpec {
  label: string;
  /**
   * Where each hand sits, in the rig's own frame, as fractions of body height:
   * lateral, vertical, forward. The lead hand and the rear hand separately,
   * because a guard that is the same on both sides is not a guard anybody
   * uses.
   */
  lead: [number, number, number];
  rear: [number, number, number];
  /** How high the elbows ride. Raises the forearm across the body. */
  elbow: number;
  /**
   * Whether this guard checks low kicks by lifting a shin. Thai boxing does;
   * boxing has never needed to.
   */
  checks: boolean;
  /** How far the chin tucks and the shoulders roll up, radians. */
  tuck: number;
}

/**
 * Seven guards, and they are different SHAPES rather than different numbers.
 *
 * The coverage each one buys is measured off the pose it produces, so the
 * table below decides where the hands go and geometry decides what that is
 * worth. Getting a guard wrong therefore shows up as a coverage number, not as
 * a value somebody has to remember to update.
 */
export const GUARDS: Record<GuardName, GuardSpec> = {
  peekaboo: {
    label: 'Peekaboo',
    // Both gloves on the cheekbones, elbows tight. Everything for the head and
    // nothing for the body — which is the trade, and the measurement says so.
    lead: [0.055, 0.845, 0.055],
    rear: [-0.055, 0.845, 0.045],
    elbow: 0.9,
    checks: false,
    tuck: 0.22,
  },
  philly: {
    label: 'Philly shell',
    // Lead arm across the ribs, rear hand on the cheek. Deliberately lopsided:
    // it covers the lead side and invites everything to the other one.
    lead: [0.075, 0.66, 0.06],
    rear: [-0.06, 0.85, 0.03],
    elbow: 0.35,
    checks: false,
    tuck: 0.16,
  },
  longGuard: {
    label: 'Long guard',
    // The lead arm out at the end of its range, which is a fence rather than a
    // shield: it does not cover much, it just gets there first.
    lead: [0.03, 0.83, 0.3],
    rear: [-0.075, 0.82, 0.04],
    elbow: 0.5,
    checks: true,
    tuck: 0.1,
  },
  highCover: {
    label: 'Thai high cover',
    // Forearms vertical in front of the temples and the shins ready. Built for
    // a sport where the head and the legs are both being kicked.
    lead: [0.052, 0.895, 0.095],
    rear: [-0.052, 0.895, 0.09],
    elbow: 0.75,
    checks: true,
    tuck: 0.14,
  },
  lowGuard: {
    label: 'Low guard',
    // Hands by the ribs. Sees more, covers the body, and gives the head away —
    // the exact inverse of the peekaboo, and the pair of them is the clearest
    // demonstration that these numbers are measured.
    lead: [0.09, 0.64, 0.08],
    rear: [-0.09, 0.64, 0.07],
    elbow: 0.2,
    checks: false,
    tuck: 0.04,
  },
  crossArm: {
    label: 'Cross-arm',
    // Both forearms stacked horizontally across the face. Enormous head cover,
    // no vision, no punching from it.
    lead: [-0.03, 0.855, 0.085],
    rear: [0.03, 0.83, 0.075],
    elbow: 1.05,
    checks: false,
    tuck: 0.3,
  },
  open: {
    label: 'Hands down',
    // Not a guard. It is in the table so the gate has something that MUST come
    // out near zero — a coverage model that flatters this one is measuring
    // nothing.
    lead: [0.11, 0.5, 0.05],
    rear: [-0.11, 0.5, 0.04],
    elbow: 0,
    checks: false,
    tuck: 0,
  },
};

export const GUARD_NAMES = Object.keys(GUARDS) as GuardName[];

// -------------------------------------------------------------- coverage

/** How far off level a strike can arrive from. Uppercuts rise; nothing falls. */
const ARC = Math.PI / 4;

/**
 * The directions a strike can come from, sampled once.
 *
 * A Fibonacci sphere restricted to the front hemisphere, so the sampling is
 * even, deterministic and identical on every body — a coverage number that
 * moved because the sample set moved would be worthless for comparing guards.
 */
const APPROACHES: Vector3[] = (() => {
  const out: Vector3[] = [];
  const n = 512;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    const v = new Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    // Forward, and roughly level. A guard is not responsible for what is
    // behind it, and nothing strikes straight down the crown of the head or
    // straight up from the floor — averaging those in dilutes every number
    // here with directions no fighter has ever had to cover.
    if (v.z > 0 && Math.abs(v.y) < Math.sin(ARC)) out.push(v.normalize());
  }
  return out;
})();

/** How far out a strike is coming from when the guard has to stop it. */
const APPROACH_RANGE = 0.32;


interface Shield {
  a: Vector3;
  b: Vector3;
  radius: number;
}

/**
 * The limbs that can be in the way, and how thick they are as fractions of
 * body height.
 *
 * A forearm is about 5 cm in radius on a 1.77 m person, which is 0.029 of
 * stature — measure your own. Getting these wrong is not subtle: at 19 cm,
 * which is what an extra factor bought, every guard in the table covered
 * everything and the whole module read 100%.
 */
const SHIELD_BONES: Array<[BoneName, BoneName, number]> = [
  ['LeftArm', 'LeftForeArm', 0.032],
  ['LeftForeArm', 'LeftHand', 0.029],
  ['RightArm', 'RightForeArm', 0.032],
  ['RightForeArm', 'RightHand', 0.029],
  ['LeftUpLeg', 'LeftLeg', 0.042],
  ['LeftLeg', 'LeftFoot', 0.033],
  ['RightUpLeg', 'RightLeg', 0.042],
  ['RightLeg', 'RightFoot', 0.033],
];

/** The limbs, as capsules, wherever they currently are. */
function shieldsOf(rig: HumanoidRig, out: Shield[]): Shield[] {
  rig.object.updateMatrixWorld(true);
  out.length = 0;
  for (const [from, to, r] of SHIELD_BONES) {
    const a = rig.bones[from].getWorldPosition(new Vector3());
    const b = rig.bones[to].getWorldPosition(new Vector3());
    out.push({ a, b, radius: r * rig.height });
  }
  return out;
}

const P1 = new Vector3();
const P2 = new Vector3();
const D1 = new Vector3();
const D2 = new Vector3();
const R = new Vector3();

/** Closest distance between two line segments. Ericson, *Real-Time Collision Detection*. */
function segmentDistance(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3): number {
  D1.subVectors(q1, p1);
  D2.subVectors(q2, p2);
  R.subVectors(p1, p2);
  const a = D1.dot(D1);
  const e = D2.dot(D2);
  const f = D2.dot(R);
  let s: number;
  let t: number;
  if (a <= 1e-9 && e <= 1e-9) return R.length();
  if (a <= 1e-9) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = D1.dot(R);
    if (e <= 1e-9) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = D1.dot(D2);
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  P1.copy(p1).addScaledVector(D1, s);
  P2.copy(p2).addScaledVector(D2, t);
  return P1.distanceTo(P2);
}

/**
 * What fraction of the ways into a zone this body is currently blocking.
 *
 * Sample a direction, put a strike out at the end of it, and ask whether the
 * line from there to the target passes through a limb. Do that for every
 * direction a strike could come from and count.
 *
 * It is a MEASUREMENT of the pose the rig is in right now, which means it
 * answers for a guard, for a guard mid-parry, for a guard that has just thrown
 * a punch and not got the hand back yet, and for somebody standing there with
 * their hands down. There is no table of "block chance" anywhere in this
 * module and there is nowhere one could be added.
 */
export function coverageOf(rig: HumanoidRig, zone: GuardZone): number {
  const all = shieldsOf(rig, SHIELDS);
  const target = zonePoint(rig, zone, TARGET);
  // A limb cannot shield itself. The leg zone sits ON the lead thigh, so that
  // thigh's own capsule contains it and blocks every line to it — every guard
  // in the table covered the legs 100%, including one with its hands down.
  const shields = all.filter((s) => segmentDistance(target, target, s.a, s.b) > s.radius);
  // Work in the rig's own frame so a fighter who has turned is not suddenly
  // covering a different set of directions.
  const from = FROM;
  let blocked = 0;
  for (const dir of APPROACHES) {
    from.copy(dir).applyQuaternion(rig.object.getWorldQuaternion(SPIN));
    from.multiplyScalar(APPROACH_RANGE * rig.height).add(target);
    let hit = false;
    for (const s of shields) {
      if (segmentDistance(from, target, s.a, s.b) < s.radius) {
        hit = true;
        break;
      }
    }
    if (hit) blocked++;
  }
  return blocked / APPROACHES.length;
}

const SHIELDS: Shield[] = [];
const TARGET = new Vector3();
const FROM = new Vector3();
const SPIN = new Quaternion();

/**
 * Is THIS strike's line blocked — the same question, asked once instead of
 * five hundred times.
 *
 * `Striking` publishes where a blow arrived and which way it was going, so the
 * line it came in on is known exactly. This walks back along it and asks
 * whether it passed through a limb on the way, and hands back which one.
 */
export function intercepts(
  rig: HumanoidRig,
  at: Vector3,
  direction: Vector3
): { blocked: boolean; limb: string; depth: number } {
  const shields = shieldsOf(rig, SHIELDS);
  const back = FROM.copy(at).addScaledVector(direction, -APPROACH_RANGE * rig.height);
  let best = Infinity;
  let which = '';
  for (let i = 0; i < shields.length; i++) {
    const s = shields[i];
    const d = segmentDistance(back, at, s.a, s.b);
    if (d < s.radius && d < best) {
      best = d;
      which = SHIELD_BONES[i][0];
    }
  }
  return { blocked: which !== '', limb: which, depth: which ? best : Infinity };
}

// ------------------------------------------------------------ the defence

/** What happened to one incoming strike. */
export interface Defence {
  strike: StrikeName;
  zone: GuardZone;
  /** Did anything stop it at all? */
  stopped: boolean;
  /** How it was stopped, if it was. */
  by: 'cover' | 'parry' | 'slip' | 'check' | 'none';
  /** Which limb took it, when something did. */
  limb: string;
  /** kg·m/s that reached the target. Zero when it was fully stopped. */
  through: number;
  /** kg·m/s that went into the defending limb instead. */
  absorbed: number;
  /**
   * Whether there was TIME to do anything deliberate. False means the strike
   * arrived inside this defender's reaction and only the static cover was ever
   * going to be involved — which is most of what a jab is for.
   */
  reacted: boolean;
  /** Coverage of the aimed-at zone at the moment of contact. */
  coverage: number;
}

export type ActiveDefence = 'parry' | 'slip' | 'roll' | 'check' | 'none';

export interface GuardOptions {
  /** Which guard to hold. Default `peekaboo`. */
  style?: GuardName;
  /** 0..1. Buys reaction time, and nothing else. */
  skill?: number;
  /** Which side leads. Default orthodox. */
  stance?: 'orthodox' | 'southpaw';
  /** Seconds to blend in and out. */
  fade?: number;
  /** Playback rate for the active defences. */
  tempo?: number;
}

/**
 * A body holding a guard, and reacting to what it can.
 *
 * Owns the arms outright, like `Striking` — the two are alternatives for the
 * same limbs and a fighter is doing one or the other. Adds to the spine, chest
 * and head so a `Mood` layer survives, and never touches the legs except to
 * check a kick.
 */
export class Guard {
  /** The guard being held. */
  style: GuardName;
  /** What the body is doing beyond simply covering. */
  doing: ActiveDefence = 'none';
  /** This defender's reaction time, seconds. Published, because it is a fact
   * about them that an AI upstream may want to reason with. */
  readonly reaction: number;

  private readonly rig: HumanoidRig;
  private readonly leadSide: 'Left' | 'Right';
  private readonly fadeRate: number;
  private readonly tempo: number;
  private weight = 0;
  private wanted = 1;
  private restored = false;
  private active = 0;
  private activeFor = 0;
  private readonly gave = new Map<BoneName, Quaternion>();
  private readonly entry = new Map<BoneName, Quaternion>();
  private readonly hand = new Vector3();
  private readonly pole = new Vector3();
  private readonly qa = new Quaternion();
  private readonly qb = new Quaternion();
  private readonly va = new Vector3();
  private readonly vb = new Vector3();
  private readonly vc = new Vector3();

  constructor(rig: HumanoidRig, options: GuardOptions = {}) {
    this.rig = rig;
    this.style = options.style ?? 'peekaboo';
    this.leadSide = (options.stance ?? 'orthodox') === 'orthodox' ? 'Left' : 'Right';
    const fade = options.fade ?? 0.1;
    this.fadeRate = fade > 0 ? 1 / fade : Infinity;
    this.tempo = Math.max(0.05, options.tempo ?? 1);
    this.reaction = reactionTime(options.skill ?? 0.5);
  }

  /** Change guard. The coverage changes with it, because it is measured. */
  hold(style: GuardName): void {
    this.style = style;
  }

  /** Drop the hands and hand the body back. */
  lower(): void {
    this.wanted = 0;
  }

  /** How much of a zone is covered right now — the live measurement. */
  covers(zone: GuardZone): number {
    return coverageOf(this.rig, zone);
  }

  /**
   * Start an active defence. Only possible if there was time for it, which is
   * why `canReactTo` is part of this module rather than advice in the docs.
   */
  react(to: StrikeName, kind: ActiveDefence): boolean {
    if (kind === 'none') return false;
    if (STRIKES[to].windup / this.tempo <= this.reaction) return false;
    this.doing = kind;
    this.active = 0;
    this.activeFor = ACTIVE_TIME[kind];
    return true;
  }

  /**
   * Answer an incoming blow.
   *
   * The geometry decides. `Striking` published where the surface arrived and
   * which way it was travelling; this walks back down that line and asks
   * whether it went through an arm. What is stopped goes into the arm and what
   * is not goes through, and the two add up to what was thrown.
   */
  defend(blow: Blow, zone: GuardZone = zoneOf(blow)): Defence {
    const hit = intercepts(this.rig, blow.at, blow.direction);
    const coverage = coverageOf(this.rig, zone);
    const reacted = this.doing !== 'none';
    // A slip is not a block: it moves the target, so nothing is absorbed and
    // nothing arrives. Everything else that works puts the impulse into a limb.
    if (reacted && this.doing === 'slip') {
      return {
        strike: blow.strike,
        zone,
        stopped: true,
        by: 'slip',
        limb: '',
        through: 0,
        absorbed: 0,
        reacted,
        coverage,
      };
    }
    if (!hit.blocked) {
      return {
        strike: blow.strike,
        zone,
        stopped: false,
        by: 'none',
        limb: '',
        through: blow.impulse,
        absorbed: 0,
        reacted,
        coverage,
      };
    }
    // A limb in the way absorbs, but a forearm is not a wall: the deeper into
    // it the line passes, the more of the strike it takes. Grazing the edge of
    // a glove is not a block and the number should not pretend it is.
    const shields = shieldsOf(this.rig, SHIELDS);
    const radius = shields.reduce((r, s) => Math.max(r, s.radius), 1);
    const solidity = clamp01(1 - hit.depth / radius);
    const absorbed = blow.impulse * solidity;
    return {
      strike: blow.strike,
      zone,
      stopped: solidity > 0.5,
      // 'cover' when the guard was simply there — which is most of the time,
      // because most strikes arrive faster than anybody reacts — and 'parry'
      // only when there was time to do something deliberate about it.
      by: reacted ? (this.doing === 'check' ? 'check' : 'parry') : 'cover',
      limb: hit.limb,
      through: blow.impulse - absorbed,
      absorbed,
      reacted,
      coverage,
    };
  }

  update(dt: number): void {
    const step = Math.max(0, dt) * this.tempo;
    this.rig.object.updateMatrixWorld(true);
    const target = this.wanted;
    if (this.weight !== target) {
      const d = Math.sign(target - this.weight) * this.fadeRate * step;
      this.weight = Math.abs(target - this.weight) <= Math.abs(d) ? target : this.weight + d;
    }
    if (this.doing !== 'none') {
      this.active += step;
      if (this.active >= this.activeFor) {
        this.doing = 'none';
        this.active = 0;
      }
    }
    if (this.weight > 0) {
      this.pose();
      this.restored = false;
    } else if (!this.restored) {
      this.restore();
      this.restored = true;
    }
  }

  // ---------------------------------------------------------------- pose

  private pose(): void {
    const spec = GUARDS[this.style];
    const w = this.weight;
    const rig = this.rig;
    rig.object.updateMatrixWorld(true);

    // The chin tucks and the shoulders come up. It is most of what a guard is
    // and it costs nothing, which is why every guard in the table has some.
    this.additive('Chest', 0.35 * spec.tuck, w);
    this.additive('Neck', 0.4 * spec.tuck, w);
    this.additive('Head', 0.55 * spec.tuck, w);

    const lead = this.leadSide;
    const rear = lead === 'Left' ? 'Right' : 'Left';
    this.armTo(lead, spec.lead, spec, w);
    this.armTo(rear, spec.rear, spec, w);

    // Checking a low kick: the shin comes up across the thigh. Only the guards
    // whose sport has low kicks in it, and only while it is being done.
    if (spec.checks && this.doing === 'check') {
      const lift = Math.sin(Math.PI * clamp01(this.active / Math.max(1e-4, this.activeFor)));
      this.own(`${lead}UpLeg`, -1.05 * lift, w);
      this.own(`${lead}Leg`, 1.5 * lift, w);
    }
  }

  /**
   * Put one hand where the guard says, and let the elbow follow.
   *
   * The hand is stated as a POSITION in the body's own frame, because "the
   * glove is on the cheekbone" is what a guard is and it has to mean the same
   * thing on a 1.6 m body and a 1.9 m one. `elbow` decides where the joint
   * hangs, which is the difference between a peekaboo and a cross-arm holding
   * their hands in nearly the same place.
   */
  private armTo(
    side: 'Left' | 'Right',
    at: [number, number, number],
    spec: GuardSpec,
    w: number
  ): void {
    const rig = this.rig;
    const h = rig.height;
    const s = side === 'Left' ? 1 : -1;
    this.hand.set(at[0] * h, at[1] * h, at[2] * h);
    // An active defence moves the hand rather than swapping the pose: a parry
    // pushes across the centre line, a roll drops the shoulder into it.
    if (this.doing !== 'none' && this.doing !== 'check') {
      const phase = Math.sin(Math.PI * clamp01(this.active / Math.max(1e-4, this.activeFor)));
      if (this.doing === 'parry') this.hand.x -= s * 0.09 * h * phase;
      if (this.doing === 'roll') this.hand.y -= 0.05 * h * phase;
    }
    rig.object.localToWorld(this.hand);
    // Elbow down and slightly in. Raising it swings the forearm up across the
    // face, which is exactly what a high cover is.
    this.pole.set(s * 0.35, -1 + spec.elbow * 0.85, 0.15 * spec.elbow).normalize();
    this.pole.applyQuaternion(rig.object.getWorldQuaternion(this.qa));
    this.reachChain(`${side}Arm`, `${side}ForeArm`, `${side}Hand`, this.hand, this.pole, w);
  }

  private reachChain(
    root: BoneName,
    mid: BoneName,
    tip: BoneName,
    target: Vector3,
    pole: Vector3,
    w: number
  ): void {
    const rig = this.rig;
    const upper = rig.bones[mid].position.length();
    const lower = rig.bones[tip].position.length();
    const axis = this.va.copy(rig.bones[mid].position).normalize();
    rig.bones[root].getWorldPosition(this.vb);
    const to = this.vc.subVectors(target, this.vb);
    const span = clamp(to.length(), Math.abs(upper - lower) + 1e-4, upper + lower - 1e-4);
    to.normalize();
    const cosA = clamp((upper * upper + span * span - lower * lower) / (2 * upper * span), -1, 1);
    const a = Math.acos(cosA);
    const perp = P1.copy(pole).addScaledVector(to, -pole.dot(to));
    if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0);
    perp.normalize();
    const upperDir = P2.copy(to).multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a));
    this.point(root, axis, upperDir, w);
    // Where the elbow lands, computed rather than read: the bone's matrixWorld
    // is a frame stale until the hierarchy updates, and aiming the forearm from
    // last frame's elbow is how a limb ends up chasing itself.
    this.vb.addScaledVector(upperDir, upper);
    const lowerDir = P2.subVectors(target, this.vb).normalize();
    this.point(mid, axis, lowerDir, w);
  }

  private point(bone: BoneName, axis: Vector3, worldDir: Vector3, w: number): void {
    const b = this.rig.bones[bone];
    this.remember(bone);
    this.qa.identity();
    if (b.parent) b.parent.getWorldQuaternion(this.qa);
    this.qa.invert();
    const local = P1.copy(worldDir).applyQuaternion(this.qa).normalize();
    this.qb.setFromUnitVectors(axis, local);
    b.quaternion.slerp(this.qb, clamp01(w));
  }

  private own(bone: BoneName, angle: number, w: number): void {
    this.remember(bone);
    this.qb.setFromAxisAngle(XAXIS, angle);
    this.rig.bones[bone].quaternion.slerp(this.qb, clamp01(w));
  }

  private additive(bone: BoneName, angle: number, w: number): void {
    const b = this.rig.bones[bone];
    const had = this.gave.get(bone);
    if (had) b.quaternion.multiply(had.invert());
    this.qb.setFromAxisAngle(XAXIS, angle * w);
    b.quaternion.multiply(this.qb);
    this.gave.set(bone, this.qb.clone());
  }

  private remember(bone: BoneName): void {
    if (!this.entry.has(bone)) this.entry.set(bone, this.rig.bones[bone].quaternion.clone());
  }

  private restore(): void {
    for (const [name, q] of this.gave) this.rig.bones[name].quaternion.multiply(q.invert());
    this.gave.clear();
    for (const [name, q] of this.entry) this.rig.bones[name].quaternion.copy(q);
    this.entry.clear();
  }
}

const XAXIS = new Vector3(1, 0, 0);

/** How long each active defence takes, seconds. */
const ACTIVE_TIME: Record<ActiveDefence, number> = {
  parry: 0.18,
  slip: 0.24,
  roll: 0.26,
  check: 0.22,
  none: 0,
};

/** Which zone a strike is aimed at, from the height it is aimed at. */
export function zoneOf(blow: { strike: StrikeName }): GuardZone {
  const t = STRIKES[blow.strike].target;
  return t >= 0.78 ? 'head' : t >= 0.55 ? 'body' : 'legs';
}
