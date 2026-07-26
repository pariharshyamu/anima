import { Euler, Object3D, Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

/**
 * Rowing — a body driven by somebody else's clock.
 *
 * Every other controller in ANIMA owns its own timing: `Locomotion` picks a
 * stride from a speed, `Mannerisms` fires when it feels like it. A rower
 * does not get to choose. He is handed a **phase** — one scalar, shared by
 * the whole boat — and his entire body is a function of it:
 *
 * ```ts
 * const oarsman = new Rowing(rig, { side: -1 });
 * game.onUpdate((t) => oarsman.update(t.delta, bank.phaseAt(seat)));
 * ```
 *
 * SCENA's oar bank takes the same number and sweeps the loom with it.
 * Neither library imports the other; the handshake is a scalar, and it is
 * the only kind of handshake that can say *together*.
 *
 * ## The recovery is not the drive played backwards
 *
 * This is the whole of what makes it read as rowing rather than as a man
 * waving. Through the water it is **legs then back**: the legs go down
 * first and the swing follows them. Coming forward it is the other way
 * round — **body then slide**. The back comes up first and the knees are
 * the last thing to move.
 *
 * Reverse the drive and you get a body pulling its knees up while it is
 * still laid back, which is the thing every coach on earth shouts about and
 * is instantly wrong to anybody who has ever seen a boat. Two pairs of
 * windows, in opposite orders, and everything else follows from them.
 *
 * ## Where his hands are
 *
 * The oar and the pose meet because both were built to the same table —
 * SCENA's `OAR_GRIP` and this file's {@link ROW_GRIP} are the same three
 * numbers. The arms are then solved onto it with a two-bone chain, so the
 * contract is kept rather than approximated: ask for the handle at 0.58 m
 * in front of him and his hands are actually there, at every phase, to
 * within a centimetre.
 *
 * Which means the ELBOW is a consequence rather than a choice. The handle's
 * path belongs to the oar — a rigid lever — and the body's job is to be
 * somewhere its arms can reach it from; how bent they end up is whatever is
 * left over once the seat and the swing have done their part. That is the
 * honest shape of it, and it is why the sequencing above is stated about
 * the legs and the back, which this controller sets, and not about the
 * arms, which it solves.
 */

const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const clampCos = (t: number): number => (t < -1 ? -1 : t > 1 ? 1 : t);
const REST_DIR = new Vector3();
const wrap01 = (t: number): number => t - Math.floor(t);
/** Smooth 0→1 across [0,1] — the shape of a swing, not of a ramp. */
const ease = (t: number): number => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};
/** Smooth 0→1 across [a,b], flat outside it. */
const ramp = (t: number, a: number, b: number): number => {
  const u = clamp01((t - a) / Math.max(1e-6, b - a));
  return u * u * (3 - 2 * u);
};

/**
 * Where the handle of an oar goes, relative to the rower's own root.
 *
 * The same three numbers as SCENA's `OAR_GRIP`. A prop is built to the
 * body's expectations rather than the body reaching for the prop — the
 * `GRIPS` idea, applied to something that moves.
 */
export const ROW_GRIP = {
  /** Height of the handle above the thwart at the catch. */
  height: 0.4,
  /** How far in front of him the hands are at the catch. */
  reach: 0.58,
  /** …and how far past his body they come at the finish. */
  finish: -0.16,
} as const;

/** Where the handle should be at a given phase, in the rower's own frame. */
export function rowGripAt(phase: number, drive = 0.4, out = new Vector3()): Vector3 {
  const p = wrap01(phase);
  // EASED, not linear. An oar accelerates away from the catch and comes off
  // the pressure before the finish — it does not jump into full speed the
  // instant the blade touches. That matters far beyond the look of it: the
  // body's parts take turns providing the handle's travel, in windows, and
  // a handle that moves at full speed from the first instant leaves nothing
  // for the legs to do and forces the elbows to bend at the catch. The arms
  // end up filling in whatever the windows do not cover.
  const swing = p < drive ? ease(p / drive) : 1 - ease((p - drive) / (1 - drive));
  return out.set(
    0,
    ROW_GRIP.height + (1 - swing) * 0.08,
    ROW_GRIP.reach + (ROW_GRIP.finish - ROW_GRIP.reach) * swing
  );
}

export type RowStyle =
  /** A thwart that does not move: he braces his feet and swings his back. */
  | 'fixed'
  /** A sliding seat: the legs do most of the work and the slide is long. */
  | 'sliding';

export interface RowingOptions {
  /** Which side his blade is: −1 port, +1 starboard. Default −1. */
  side?: -1 | 1;
  style?: RowStyle;
  /** Fraction of the cycle the blade is in the water. Default 0.4. */
  drive?: number;
  /** How hard he is pulling, 0–1. Default 1. */
  effort?: number;
  /** Height of the thwart under him. Default 0.45. */
  seatHeight?: number;
  seed?: number;
}

/** Bones this controller writes. Everything else is left alone. */
const OWNED: BoneName[] = [
  'Hips', 'Spine', 'Chest', 'Head',
  'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot',
  'RightUpLeg', 'RightLeg', 'RightFoot',
];

export class Rowing {
  /** Where he is in the stroke, 0 at the catch. */
  phase = 0;
  /** True while his blade is in the water. */
  driving = false;
  /** How far through the drive, or the recovery, 0–1. */
  through = 0;
  /** True while he is recovering from a crab. */
  fouled = false;

  /** Where his hands actually are, in his own frame. Read after `update`. */
  readonly hands = new Vector3();

  private readonly side: -1 | 1;
  private readonly style: RowStyle;
  private readonly driveFraction: number;
  private effort: number;
  private readonly seatHeight: number;
  private readonly jitter: number;
  private readonly rest: Record<string, Quaternion> & { __dir?: Quaternion } = {};
  private readonly restHipsY: number;
  private readonly restHipsZ: number;
  private clock = 0;
  private crab = 0;

  private readonly upper: number;
  private readonly fore: number;
  private readonly shoulderAt = new Vector3();
  private readonly target = new Vector3();
  private readonly aim = new Vector3();
  private readonly spin = new Quaternion();
  private readonly bend = new Quaternion();
  private readonly euler = new Euler();

  constructor(
    private readonly rig: HumanoidRig,
    options: RowingOptions = {}
  ) {
    this.side = options.side ?? -1;
    this.style = options.style ?? 'fixed';
    this.driveFraction = Math.min(0.9, Math.max(0.1, options.drive ?? 0.4));
    this.effort = clamp01(options.effort ?? 1);
    this.seatHeight = options.seatHeight ?? 0.45;
    const seed = options.seed ?? 1;
    this.jitter = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
    for (const bone of OWNED) this.rest[bone] = rig.bones[bone].quaternion.clone();
    this.restHipsY = rig.bones.Hips.position.y;
    this.restHipsZ = rig.bones.Hips.position.z;
    // Segment lengths straight off the rig, so the reach is his reach.
    this.upper = rig.bones.LeftForeArm.position.length();
    this.fore = rig.bones.LeftHand.position.length();
  }

  /** How hard he pulls, 0–1. */
  setEffort(e: number): void {
    this.effort = clamp01(e);
  }

  /** He catches a crab: checked, thrown back, and out of the boat's time. */
  crabNow(): void {
    this.crab = 1;
    this.fouled = true;
  }

  /**
   * Row one frame at somebody else's phase.
   *
   * `phase` is the bank's `phaseAt(seat)` — his own place in a stroke he
   * does not set. Pass `crabbing` straight from the oar and he is checked
   * by it rather than being told about it separately.
   */
  update(dt: number, phase: number, crabbing = false): void {
    if (dt <= 0) return;
    this.clock += dt;
    if (crabbing) this.crab = 1;
    if (this.crab > 0) this.crab = Math.max(0, this.crab - dt * 0.6);
    this.fouled = this.crab > 0.02;

    const p = wrap01(phase);
    this.phase = p;
    const d = this.driveFraction;
    this.driving = p < d;
    this.through = this.driving ? p / d : (p - d) / (1 - d);

    // ---- THE SEQUENCE ------------------------------------------------
    // Three parts of the body, each with its own window, and the windows
    // are in the OPPOSITE ORDER on the way back. Everything below is a
    // consequence of these six numbers.
    let legs: number;
    let body: number;
    let arms: number;
    if (this.driving) {
      const u = this.through;
      legs = ramp(u, 0.0, 0.55); // legs go down first…
      body = ramp(u, 0.25, 0.85); // …the back swings after them…
      arms = ramp(u, 0.6, 1.0); // …and the arms come in last.
    } else {
      const r = this.through;
      arms = 1 - ramp(r, 0.0, 0.3); // hands away first…
      body = 1 - ramp(r, 0.2, 0.6); // …then the body follows…
      legs = 1 - ramp(r, 0.45, 1.0); // …and only then do the knees come up.
    }

    const pull = 0.45 + this.effort * 0.55;
    const breath = Math.sin(TAU * (this.clock * 0.24 + this.jitter)) * 0.012;

    // A crab checks him hard: he is thrown back and stops driving.
    const check = this.crab * this.crab;
    if (check > 0.02) {
      body = Math.min(1, body + check * 0.9);
      arms = Math.max(0, arms - check * 0.7);
    }

    // ---- legs ---------------------------------------------------------
    // A fixed thwart barely moves; a sliding seat is most of the stroke.
    // A longship's rower gets his power from his back, which is exactly why
    // he swings so much further than a man in a racing shell.
    const slide = this.style === 'sliding' ? 1 : 0.28;
    const compress = 1 - legs;
    for (const s of ['Left', 'Right'] as const) {
      const sign = s === 'Left' ? 1 : -1;
      this.set(`${s}UpLeg`, -(0.55 + compress * 1.15 * slide), 0, -sign * 0.14);
      this.set(`${s}Leg`, 0.5 + compress * 1.5 * slide, 0, 0);
      this.set(`${s}Foot`, -(0.25 + compress * 0.35 * slide), 0, 0);
    }
    // THE SEAT SLIDES, and this is what carries the handle early in the
    // drive with the arms still straight. Without it the shoulders stay put
    // while the handle travels, so the elbows have to bend from the very
    // first instant — and the sequence never reaches the hands at all,
    // however carefully the legs and the back are windowed.
    this.rig.bones.Hips.position.y =
      this.restHipsY - this.rig.legLength * (this.style === 'sliding' ? 0.42 : 0.5);
    this.rig.bones.Hips.position.z = compress * (this.style === 'sliding' ? 0.15 : 0.0);

    // ---- the swing ----------------------------------------------------
    // Forward over the toes at the catch, laid back at the finish. This is
    // the reading that separates a rower from somebody doing arm curls.
    const swingRange = this.style === 'fixed' ? 1.02 : 0.7;
    const lean = (0.52 - body * swingRange) * pull;
    this.set('Hips', lean * 0.45 + breath, 0, 0);
    this.set('Spine', lean * 0.36, this.side * 0.06 * body, 0);
    this.set('Chest', lean * 0.24 + breath, this.side * 0.1 * body, 0);
    this.set('Head', -lean * 0.3, 0, 0);

    // ---- and the hands ------------------------------------------------
    // Solved ONTO the published grip path rather than posed near it, so
    // `ROW_GRIP` is a contract instead of a description.
    //
    // `ROW_GRIP` is measured from the THWART, the way SCENA's slot anchors
    // are; this rig's origin is the soles of his feet. Half a metre of
    // difference, and it put every target down by his ankles and out of
    // reach at every phase of the stroke — so the solver clamped, and the
    // hands trailed the handle by up to fifteen centimetres while looking
    // roughly plausible in a still.
    rowGripAt(p, d, this.hands);
    this.hands.y += this.seatHeight;
    // Two hands on one loom, a shoulder-width apart along it, shifted
    // toward the side his blade is.
    for (const s of ['Left', 'Right'] as const) {
      this.target.copy(this.hands);
      this.target.x = this.side * 0.07 + (s === 'Left' ? 0.11 : -0.11);
      this.reach(s, this.target);
    }
    this.hands.x = this.side * 0.07;
  }

  /** Give the body back, exactly as it was found. */
  release(): void {
    for (const bone of OWNED) this.rig.bones[bone].quaternion.copy(this.rest[bone]);
    this.rig.bones.Hips.position.y = this.restHipsY;
    this.rig.bones.Hips.position.z = this.restHipsZ;
    this.crab = 0;
    this.fouled = false;
  }

  /** Set a bone from Euler XYZ, composed onto its rest pose. */
  private set(bone: BoneName, x: number, y: number, z: number): void {
    this.rig.bones[bone].quaternion
      .copy(this.rest[bone])
      .multiply(this.spin.setFromEuler(this.euler.set(x, y, z, 'XYZ')));
  }

  /**
   * Two-bone arm solve: put this hand exactly on `target`.
   *
   * Analytic rather than iterative — an arm is two segments and a triangle
   * closes in one step. The elbow angle is the law of cosines; the shoulder
   * aims at the target and is then tipped by the other interior angle so
   * the chain lands on it.
   *
   * The rig binds in a T-pose, so a bone's own direction is its local +x on
   * the left and −x on the right, and both of those are in the PARENT's
   * frame — which for an arm is the chest, and the chest is swinging. Solve
   * in the rig's space and the hands drift further off the harder he pulls.
   */
  private reach(side: 'Left' | 'Right', targetLocal: Vector3): void {
    const sign = side === 'Left' ? 1 : -1;
    const arm = this.rig.bones[`${side}Arm` as BoneName];
    const foreArm = this.rig.bones[`${side}ForeArm` as BoneName];
    const parent = arm.parent;
    if (!parent) return;
    parent.updateWorldMatrix(true, false);

    // Both ends into the arm's parent frame.
    this.shoulderAt.copy(arm.position);
    this.target.copy(targetLocal);
    this.rig.object.localToWorld(this.target);
    parent.worldToLocal(this.target);
    this.aim.subVectors(this.target, this.shoulderAt);

    const span = this.aim.length();
    if (span < 1e-5) return;
    const a = this.upper;
    const b = this.fore;
    // Never quite straight and never folded flat — a locked elbow is a
    // broken elbow, and a fully folded one puts the hand inside the chest.
    const reach = Math.min(a + b - 0.015, Math.max(Math.abs(a - b) + 0.03, span));
    this.aim.divideScalar(span);

    const elbow = Math.PI - Math.acos(clampCos((a * a + b * b - reach * reach) / (2 * a * b)));
    const off = Math.acos(clampCos((a * a + reach * reach - b * b) / (2 * a * reach)));

    // Aim the bone down the line to the target…
    this.rest.__dir = this.rest.__dir ?? new Quaternion();
    REST_DIR.set(sign, 0, 0);
    this.spin.setFromUnitVectors(REST_DIR, this.aim);
    // …then break the elbow. Both rotations are about the same axis and in
    // opposite senses, which is what closes the triangle; the axis choice
    // only decides which way the elbow points, and a rower's breaks down
    // and back.
    arm.quaternion.copy(this.spin).multiply(this.bend.setFromAxisAngle(Z, -sign * off));
    foreArm.quaternion.setFromAxisAngle(Z, sign * elbow);
    this.rig.bones[`${side}Hand` as BoneName].quaternion
      .copy(this.rest[`${side}Hand`])
      .multiply(this.bend.setFromAxisAngle(X, sign * 0.2));
  }

  /** Somewhere to put a coxswain's eyes. */
  get seat(): Object3D {
    return this.rig.object;
  }

  /** Height of the thwart this rower was built for. */
  get thwart(): number {
    return this.seatHeight;
  }
}
