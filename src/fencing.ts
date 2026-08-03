import { Object3D, Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';
import { solveLimb } from './limbik';
import { getSocket } from './sockets';
import {
  BLADES,
  bladeExtension,
  bladeMass,
  inertia,
  type BladeName,
  type BladeSpec,
} from './blade';
import { crossing, gripSpan, handCouple, measureBind, type BladeLine } from './bind';
import { EDGES, TARGETS, measureCut, type TargetSpec } from './cut';
import { FIGHT_STYLES, type FightStyleName } from './fightstyle';
import { stability, strikeReach } from './striking';

/**
 * Fencing — the armed bout, and it does not stand still.
 *
 * `Sparring` put two fighters at a fixed gap and let them trade. That is a
 * measurement rig, not a fight, and it shows: the interesting half of any bout
 * with weapons in it is the FOOTWORK, because a sword changes what distance
 * means. Two unarmed fighters are in range or they are not. Two armed ones
 * spend the whole exchange arguing about where the line is.
 *
 * So everything here moves, and every number that governs the moving is
 * derived from something already in the library.
 *
 * ## Measure — the distance a point arrives at
 *
 *   measure = strikeReach(rig, thrust) + bladeExtension(spec)
 *
 * The arm's own reach, which `Striking` solves from the bone lengths, plus the
 * blade past the hand, which `Blade` gets by subtraction. Two fencers with
 * different weapons have DIFFERENT measures, and the gap between those two
 * numbers is a band where one of them can hit and the other cannot — the same
 * shape of finding `Sparring` got for arm length, now with a metre of steel
 * making it enormous.
 *
 * ## Tempo — how long a cut takes, from the blade's own inertia
 *
 * This is the number that makes an armed bout different, and nobody chose it:
 *
 *   τ = F · span            the couple two hands can make (from `Bind`)
 *   α = τ / I               the blade's angular acceleration (I from `Blade`)
 *   t = √(2θ / α)           the time to sweep θ, accelerating the whole way
 *
 * A longsword's inertia about the grip is 0.2551 kg·m² and an arming sword's is
 * 0.1290. Same body, same couple, and the arming sword completes a cut in 70%
 * of the time. A messer is quicker still. NOTHING in the table says "speed"; it
 * says how thick the blade is, and the rest is `τ = Iα`.
 *
 * ## Footwork — a leg is a pendulum
 *
 *   t_step = π · √(L / g)
 *
 * The classic derivation of walking cadence: a swinging leg is a pendulum and
 * its half-period is how long a step takes. `rig.legLength` is measured off the
 * bones, so a tall fencer steps more slowly and covers more ground per step,
 * and neither of those was typed in.
 *
 * ## What happens when the blades meet
 *
 * `Bind` decides it. Two blades in contact are one linkage with a sliding
 * joint, the crossing is where two lines meet, and whoever has the shorter
 * lever arm wins. A parry that lands with your forte on their foible throws the
 * attack aside; one that lands foible-on-forte does not.
 *
 * And if a cut arrives, `Cut` decides whether it does anything: pressure
 * against the target's strength, with the edge's apex radius and the contact
 * length that a curved blade shortens. A sharp sword on cloth is a wound. The
 * same sword on plate is a noise.
 */

const GRAVITY = 9.81;
const UP = new Vector3(0, 1, 0);
const V = new Vector3();
const V2 = new Vector3();
const V3 = new Vector3();
const Q = new Quaternion();

/**
 * How long a blade takes to sweep an angle, seconds.
 *
 *   t = √(2θ·I / τ)
 *
 * Constant torque from a standing start, which is what `θ = ½αt²` inverts to.
 * It is the honest first approximation and it is entirely made of numbers two
 * other modules already publish: the couple a pair of hands can make, and the
 * second moment of the object they are making it on.
 */
export function cutTime(spec: BladeSpec, angle: number, torque: number): number {
  const I = inertia(spec);
  if (!(torque > 0) || !(I > 0)) return Infinity;
  return Math.sqrt((2 * Math.abs(angle) * I) / torque);
}

/**
 * The couple this fencer can put on this hilt, newton-metres.
 *
 * Straight from `Bind`: how far apart the hands sit on the wood, times how hard
 * a hand pushes. A long grip is a bigger couple and therefore a faster blade,
 * which partly offsets a longsword's greater inertia — and "partly" is a number
 * rather than an opinion.
 */
export function bladeTorque(spec: BladeSpec, hands: 1 | 2 = 2): number {
  return handCouple(gripSpan(spec.cross, hands));
}

/**
 * How far this fencer's point reaches, metres.
 *
 * Arm plus steel. The one number the whole bout is about.
 */
export function measureOf(rig: HumanoidRig, spec: BladeSpec): number {
  return strikeReach(rig, 'jab') + bladeExtension(spec);
}

/**
 * How long one step takes, seconds — a leg swinging as a pendulum.
 *
 * `π√(L/g)` is the half-period, which is one step. The classic derivation of
 * why tall people walk with a slower cadence, and here it means a tall fencer's
 * footwork is slower per step and longer per step, both from `rig.legLength`.
 */
export function stepTime(rig: HumanoidRig): number {
  return Math.PI * Math.sqrt(Math.max(0.1, rig.legLength) / GRAVITY);
}

/**
 * How far one step covers, metres — the stance's own fore-aft stagger.
 *
 * A style that stands long steps long. `stagger` is a fraction of height, so a
 * tall karateka covers more ground per step than a short brawler, and both
 * numbers were already in `FightStyle` for an entirely different reason.
 */
export function stepLength(rig: HumanoidRig, style: FightStyleName): number {
  return FIGHT_STYLES[style].stance.stagger * rig.height;
}

/** ...so the footwork speed is a division, not a setting. */
export function footSpeed(rig: HumanoidRig, style: FightStyleName): number {
  return stepLength(rig, style) / Math.max(1e-3, stepTime(rig));
}

export type FencePhase = 'measure' | 'windup' | 'cut' | 'recover' | 'parry';

export interface FencerOptions {
  blade?: BladeName;
  style?: FightStyleName;
  /** Hands on the hilt. A longsword gets two; a sabre one. */
  hands?: 1 | 2;
  /** How sharp the edge is, metres of apex radius. */
  edge?: number;
  /** What they are wearing, for `Cut` to decide against. */
  wearing?: TargetSpec;
  /** 0..1. Drives how close to their own measure they will commit. */
  skill?: number;
  /** An Object3D to hang in the sword hand — the blade, drawn by the caller. */
  prop?: Object3D;
  /** Where they start, metres. */
  at?: Vector3;
}

export interface Touch {
  /** Seconds into the bout. */
  at: number;
  /** 0 or 1. */
  by: number;
  /** Gap when the point arrived, metres. */
  gap: number;
  /** Pascals at the edge. */
  pressure: number;
  /** Whether it bit what they were wearing. */
  bit: boolean;
  /** Whether the defender's blade was on it. */
  parried: boolean;
}

/**
 * One armed fighter: a body, a blade, a position on the floor, and a phase.
 *
 * The position is the point. `Sparring`'s fighters had one and never used it.
 */
export class Fencer {
  readonly rig: HumanoidRig;
  readonly spec: BladeSpec;
  readonly blade: BladeName;
  readonly style: FightStyleName;
  readonly hands: 1 | 2;
  readonly edge: number;
  readonly wearing: TargetSpec;
  readonly skill: number;
  readonly prop?: Object3D;

  /** Metres. Moved by the footwork, every frame. */
  readonly at = new Vector3();
  /** Radians, the way they are facing. */
  facing = 0;

  phase: FencePhase = 'measure';
  /** 0..1 through the current phase. */
  progress = 0;
  /** Their own reach, arm plus steel. */
  readonly measure: number;
  /** Seconds a full cut takes, from the blade's inertia. */
  readonly tempo: number;
  /** Newton-metres their hands can make on this hilt. */
  readonly torque: number;
  /** Metres per second of footwork. */
  readonly speed: number;

  touches = 0;
  taken = 0;
  attacks = 0;
  parries = 0;
  /** Seconds of breath owed before the next action. */
  rest = 0;
  /** Which way they are circling, ±1. Turns over after every action. */
  circle = 1;
  /** Seconds of standing off left before they force the action anyway. */
  patience = 0;
  /** Attacks launched from inside their own measure and outside the foe's. */
  inBand = 0;
  /**
   * Which way the blade points in the ground plane, radians.
   *
   * Along the line of engagement while attacking; across it while parrying.
   * That is the whole of what a parry IS geometrically — putting your steel
   * where theirs is going — and it is what gives `Bind` a crossing to have an
   * opinion about.
   */
  bladeAngle = 0;
  /** Metres the hand goes forward to meet an incoming blade. */
  readonly reachOut: number;
  /** Metres advanced and retreated, so a bout that stood still is visible. */
  travelled = 0;

  private readonly hand: Object3D;

  constructor(rig: HumanoidRig, options: FencerOptions = {}) {
    this.rig = rig;
    this.blade = options.blade ?? 'arming';
    this.spec = BLADES[this.blade];
    this.style = options.style ?? 'boxing';
    this.hands = options.hands ?? (this.blade === 'longsword' ? 2 : 1);
    this.edge = options.edge ?? EDGES.sharp;
    this.wearing = options.wearing ?? TARGETS.linen;
    this.skill = options.skill ?? 0.8;
    this.prop = options.prop;
    if (options.at) this.at.copy(options.at);

    this.measure = measureOf(rig, this.spec);
    this.torque = bladeTorque(this.spec, this.hands);
    // A cut sweeps about 120°, from a high guard through the target.
    this.tempo = cutTime(this.spec, (120 * Math.PI) / 180, this.torque);
    this.speed = footSpeed(rig, this.style);
    this.patience = this.tempo * (4 + this.skill * 8);
    // Half the arm, which is how far a hand travels from a guard to an
    // extended parry. Measured off the body rather than picked.
    this.reachOut = strikeReach(rig, 'jab') * 0.5;

    this.hand = getSocket(rig, 'handRight');
    if (this.prop) this.hand.add(this.prop);
  }

  /** Kilograms of steel in the hand — for whoever wants to report it. */
  get weight(): number {
    return bladeMass(this.spec);
  }

  /**
   * Where the point is, in world space.
   *
   * Read off the hand socket and the blade's own extension, so it is wherever
   * the arm actually put it rather than wherever the state machine thinks.
   */
  point(out = new Vector3()): Vector3 {
    this.hand.getWorldPosition(out);
    this.hand.getWorldQuaternion(Q);
    // The blade runs out of the hand along the socket's local +Y.
    V.set(0, 1, 0).applyQuaternion(Q).multiplyScalar(bladeExtension(this.spec));
    return out.add(V);
  }

  /**
   * The blade as a line in the crossing plane, for `Bind`.
   *
   * The HAND is read off the rig — wherever `poseSwordArm` actually put it. The
   * DIRECTION is the fencer's own `bladeAngle`, which the phase machine sets:
   * along the line of engagement when attacking, across it when parrying.
   *
   * The first version read the direction off the hand socket's local +Y, which
   * is an axis of the bone hierarchy and points nowhere in particular. Every
   * crossing it produced was arbitrary, so no parry ever registered in a
   * thirty-second bout, and the number that should have proved `Bind` was
   * connected read zero.
   */
  line(out?: Partial<BladeLine>): BladeLine {
    this.hand.getWorldPosition(V3);
    let x = V3.x;
    let z = V3.z;
    // A PARRY IS MADE FORWARD. The defender extends into the line rather than
    // waiting with the hand on the hip, and the difference is not cosmetic:
    // with the hand left where it stands, the crossing of the two blade lines
    // falls a few centimetres PAST the attacker's point, `onBoth` comes back
    // false, and `Bind` is never consulted at all. The bout showed seven
    // parries attempted and zero resolved, which is what a disconnected
    // module looks like from the outside.
    if (this.phase === 'parry') {
      x += Math.sin(this.facing) * this.reachOut;
      z += Math.cos(this.facing) * this.reachOut;
    }
    return {
      hand: { x, y: z },
      angle: this.bladeAngle,
      length: bladeExtension(this.spec),
      ...out,
    };
  }
}

export interface FenceOptions {
  /** Seconds. */
  rounds?: number;
  roundSeconds?: number;
  /** Fixed step, seconds. Capped-not-floored is how a bout becomes a frame rate. */
  step?: number;
}

const FIXED_STEP = 1 / 120;
const MAX_SUBSTEPS = 8;

/**
 * Two fencers, moving.
 *
 * The whole loop is: read the gap, decide whether to close it or open it, and
 * if it is right, commit. Nothing here knows who should win.
 */
export class Fence {
  readonly a: Fencer;
  readonly b: Fencer;
  readonly touches: Touch[] = [];
  elapsed = 0;
  /** Metres between them, right now. */
  gap = 0;
  /** How much of the bout has been spent inside the shorter measure. */
  contested = 0;
  done = false;

  private residue = 0;
  private readonly limit: number;

  constructor(a: Fencer, b: Fencer, options: FenceOptions = {}) {
    this.a = a;
    this.b = b;
    this.limit = (options.rounds ?? 1) * (options.roundSeconds ?? 30);
    this.refresh();
  }

  private refresh(): void {
    this.gap = Math.hypot(this.b.at.x - this.a.at.x, this.b.at.z - this.a.at.z);
  }

  update(dt: number): void {
    // Genuinely fixed, with a carried residue. Capping without flooring makes
    // the answer a fact about the frame rate, which two modules in this library
    // have already had to learn.
    this.residue += Math.max(0, dt);
    let n = 0;
    while (this.residue >= FIXED_STEP && n < MAX_SUBSTEPS && !this.done) {
      this.advance(FIXED_STEP);
      this.residue -= FIXED_STEP;
      n++;
    }
  }

  private advance(dt: number): void {
    this.elapsed += dt;
    if (this.elapsed >= this.limit) this.done = true;
    this.refresh();
    if (this.gap < Math.min(this.a.measure, this.b.measure)) this.contested += dt;

    this.step(this.a, this.b, dt);
    this.step(this.b, this.a, dt);
    this.separate();
    this.face(this.a, this.b);
    this.face(this.b, this.a);
  }

  /**
   * Two bodies cannot be in the same place.
   *
   * A lunge closes distance and nothing was stopping it at zero, so a long bout
   * ended with the two fencers standing inside each other — which renders as one
   * person with four arms and is the sort of thing only a screenshot catches.
   * The floor is the two bodies' own steering radii, which `createHumanoid`
   * already measures.
   */
  private separate(): void {
    const floor = this.a.rig.obstacleRadius + this.b.rig.obstacleRadius;
    if (!(this.gap < floor)) return;
    const dx = this.b.at.x - this.a.at.x;
    const dz = this.b.at.z - this.a.at.z;
    const d = Math.hypot(dx, dz);
    const push = (floor - Math.max(1e-4, d)) / 2;
    const ux = d > 1e-6 ? dx / d : 1;
    const uz = d > 1e-6 ? dz / d : 0;
    this.a.at.x -= ux * push;
    this.a.at.z -= uz * push;
    this.b.at.x += ux * push;
    this.b.at.z += uz * push;
    this.refresh();
  }

  private face(me: Fencer, foe: Fencer): void {
    me.facing = Math.atan2(foe.at.x - me.at.x, foe.at.z - me.at.z);
    // In the crossing plane the line of engagement runs hand-to-hand; a parry
    // lays the blade across it.
    const along = Math.atan2(foe.at.z - me.at.z, foe.at.x - me.at.x);
    me.bladeAngle = me.phase === 'parry' ? along + Math.PI / 2 : along;
    me.rig.object.position.set(me.at.x, 0, me.at.z);
    me.rig.object.rotation.y = me.facing;
  }

  /** Move along the line to the foe. Positive closes, negative breaks. */
  private walk(me: Fencer, foe: Fencer, signed: number): void {
    const d = V.set(foe.at.x - me.at.x, 0, foe.at.z - me.at.z);
    if (d.lengthSq() < 1e-9) return;
    d.normalize().multiplyScalar(signed);
    me.at.add(d);
    me.travelled += Math.abs(signed);
  }

  private step(me: Fencer, foe: Fencer, dt: number): void {
    // How committed this fencer is willing to be. A better fencer will stand
    // closer to the edge of their own measure before stepping in.
    const commit = 0.75 + me.skill * 0.2;
    const attacking = foe.phase === 'windup' || foe.phase === 'cut';

    if (me.phase === 'measure') {
      me.rest -= dt;

      // DEFENCE FIRST. If their point is coming and it can reach, the blade
      // goes across — and `Bind` is what decides whether that was any use.
      if (attacking && this.gap <= foe.measure && me.rest <= 0) {
        me.phase = 'parry';
        me.progress = 0;
        me.parries++;
        return;
      }

      // FOOTWORK. Three choices, all about one number.
      const want = me.measure * commit;
      const danger = foe.measure * (attacking ? 1.05 : 0.9);
      let move = 0;
      if (this.gap > want) move = 1;
      else if (this.gap < danger * 0.85) move = -1;
      if (move !== 0) {
        this.walk(me, foe, move * me.speed * dt);
        return;
      }

      // In measure and neither closing nor breaking, so circle — the third
      // thing feet do, and the one a static bout never shows.
      const d = V.set(foe.at.x - me.at.x, 0, foe.at.z - me.at.z);
      if (d.lengthSq() > 1e-9) {
        V2.crossVectors(UP, d.normalize()).multiplyScalar(me.circle * me.speed * 0.5 * dt);
        me.at.add(V2);
        me.travelled += V2.length();
      }

      // ...and commit on an OPENING. Attacking into a live point is how both
      // fencers die, and a bout where that happens seventy times is a
      // metronome rather than a fight.
      //
      // Three openings, and the second one is the whole reason a long weapon
      // is worth carrying:
      //
      //   they are busy          recovering from their own attack, or parrying
      //   THE REACH BAND         the gap is inside my measure and outside
      //                          theirs. Nobody encoded that; it is the
      //                          subtraction of two numbers that came from a
      //                          bone length and a blade length
      //   patience ran out       a fencer who never commits never wins, and a
      //                          bout of two who never commit is a standoff —
      //                          which is what the first draft of this produced,
      //                          one attack in thirty seconds
      const busy = foe.phase === 'recover' || foe.phase === 'parry';
      const band = this.gap > foe.measure;
      me.patience -= dt;
      if (this.gap <= me.measure && me.rest <= 0 && (busy || band || me.patience <= 0)) {
        me.phase = 'windup';
        me.progress = 0;
        me.attacks++;
        if (band) me.inBand++;
        me.patience = me.tempo * (4 + me.skill * 8);
      }
      return;
    }

    // The attack, timed by the BLADE rather than by a clip length. `tempo` is
    // √(2θI/τ) and nothing about it was chosen.
    const phaseTime =
      me.phase === 'windup'
        ? me.tempo * 0.6
        : me.phase === 'cut'
          ? me.tempo
          : me.phase === 'parry'
            ? me.tempo * 1.2
            : me.tempo * 0.8;
    me.progress += dt / Math.max(1e-4, phaseTime);

    // A cut is a LUNGE. The feet go with it, which is both what fencers do and
    // the reason an attack can reach further than a standing measure says.
    //
    // ...but it STOPS once the point is well inside measure. Without that the
    // lunge kept closing all the way to the body-radius floor, and a bout that
    // ended with two swordsmen chest to chest is a wrestling match — visible in
    // a screenshot as two concentric measure rings and nowhere in any number.
    if (me.phase === 'cut' && this.gap > me.measure * 0.72) {
      this.walk(me, foe, me.speed * 1.6 * dt);
    }
    // ...and the recovery goes back out, which is what re-opens the distance.
    else if (me.phase === 'recover') this.walk(me, foe, -me.speed * 1.1 * dt);

    if (me.progress < 1) return;
    me.progress = 0;
    if (me.phase === 'windup') {
      me.phase = 'cut';
    } else if (me.phase === 'cut') {
      this.resolve(me, foe);
      me.phase = 'recover';
    } else {
      me.phase = 'measure';
      // A breath between actions, and it turns over which way they circle —
      // so a bout wanders rather than orbiting one way for thirty seconds.
      me.rest = me.tempo * 1.5;
      me.circle = -me.circle;
    }
  }

  /**
   * The point arrives. Two other modules decide what that means.
   */
  private resolve(me: Fencer, foe: Fencer): void {
    const reached = this.gap <= me.measure;
    if (!reached) return;

    // Was their blade on it? `Bind` says who owns the crossing, and a defender
    // whose forte meets your foible throws it aside.
    let parried = false;
    const mine = me.line();
    const theirs = foe.line();
    const x = crossing(mine, theirs);
    if (x && x.onBoth) {
      const bind = measureBind(mine, theirs, {
        hands: [me.hands, foe.hands],
        hilts: [me.spec.cross, foe.spec.cross],
      });
      parried = bind.winner === 1;
    }

    // ...and if it got past, `Cut` says whether it did anything. The contact
    // length is the part of the edge laid across them; a curved blade shortens
    // it to a chord and multiplies the pressure.
    const report = measureCut(
      {
        energy: 0.5 * bladeMass(me.spec) * 6 * 6,
        force: me.torque / Math.max(0.05, bladeExtension(me.spec) * 0.6),
        radius: me.edge,
        width: 0.03,
        contact: 0.2,
        curve: me.spec.curve,
      },
      foe.wearing
    );

    const bit = !parried && report.bites;
    if (bit) {
      me.touches++;
      foe.taken++;
    }
    this.touches.push({
      at: this.elapsed,
      by: me === this.a ? 0 : 1,
      gap: this.gap,
      pressure: report.pressure,
      bit,
      parried,
    });
  }
}

// ------------------------------------------------------- the arm, posed

const GUARD = new Vector3();
const AIM = new Vector3();

/**
 * Put the sword arm where the phase says, and let the blade follow the hand.
 *
 * This is the half `Sparring` never had. The hand travels a real arc — high and
 * outside at the top of the wind-up, down and across through the target, back
 * to guard — and `solveLimb` solves the elbow for it, so the blade in the hand
 * sweeps because the ARM swept rather than because a clip was played.
 *
 * The arc is in the fencer's own frame, so it turns with them.
 */
export function poseSwordArm(f: Fencer, weight = 1): void {
  const rig = f.rig;
  const h = rig.height;
  const s = Math.sin(f.facing);
  const c = Math.cos(f.facing);
  // Forward and right in the fencer's own frame.
  const fx = s;
  const fz = c;
  const rx = c;
  const rz = -s;

  // Where the hand goes, as a fraction of height, per phase.
  let up = 0.62;
  let out = 0.22;
  let fwd = 0.18;
  if (f.phase === 'windup') {
    const t = f.progress;
    up = 0.62 + 0.28 * t;
    out = 0.22 + 0.2 * t;
    fwd = 0.18 - 0.24 * t;
  } else if (f.phase === 'cut') {
    const t = f.progress;
    up = 0.9 - 0.42 * t;
    out = 0.42 - 0.62 * t;
    fwd = -0.06 + 0.5 * t;
  } else if (f.phase === 'recover') {
    const t = 1 - f.progress;
    up = 0.48 + 0.14 * (1 - t);
    out = -0.2 + 0.42 * (1 - t);
    fwd = 0.44 - 0.26 * (1 - t);
  }

  rig.bones.Hips.getWorldPosition(GUARD);
  AIM.set(
    GUARD.x + rx * out * h + fx * fwd * h,
    up * h,
    GUARD.z + rz * out * h + fz * fwd * h
  );
  // Elbow away from the body, which is what stops the solve flipping it inside
  // the ribs on the down-stroke.
  V3.set(rx, -0.3, rz).normalize();
  solveLimb(rig, 'RightArm', 'RightForeArm', 'RightHand', AIM, V3, weight);
}

/**
 * Everything derivable about one fencer, in one call.
 */
export interface FencerCard {
  blade: BladeName;
  /** kg of steel. */
  weight: number;
  /** kg·m² about the grip — what "slow" actually is. */
  inertia: number;
  /** N·m the hands can make on this hilt. */
  torque: number;
  /** Seconds for a 120° cut, from the two above. */
  tempo: number;
  /** Metres the point reaches. */
  measure: number;
  /** Metres per second of footwork. */
  speed: number;
  /** Seconds per step. */
  step: number;
}

export function fencerCard(rig: HumanoidRig, options: FencerOptions = {}): FencerCard {
  const blade = options.blade ?? 'arming';
  const spec = BLADES[blade];
  const hands = options.hands ?? (blade === 'longsword' ? 2 : 1);
  const style = options.style ?? 'boxing';
  const torque = bladeTorque(spec, hands);
  return {
    blade,
    weight: bladeMass(spec),
    inertia: inertia(spec),
    torque,
    tempo: cutTime(spec, (120 * Math.PI) / 180, torque),
    measure: measureOf(rig, spec),
    speed: footSpeed(rig, style),
    step: stepTime(rig),
  };
}

/** Balance cost of standing in a fighting stance with a blade out. */
export function fencerBalance(rig: HumanoidRig): number {
  return stability(rig);
}

export type { BoneName };
