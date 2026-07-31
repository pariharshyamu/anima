import { Object3D, Quaternion, Vector3 } from 'three';
import { buildClip, Pose } from './clips';
import { BONE_NAMES, type BoneName, type HumanoidRig } from './humanoid';
import { chainLengths, solveChain, toParentFrame } from './solve';
import type { Holdable } from './carry';

/**
 * Lifting — gym work, and the first motion in this library that gets WORSE as
 * it goes on.
 *
 * Everything rhythmic that shipped before this is a loop: `createLoopClip`
 * hands back a cycle, the mixer plays it forever, and rep forty is bit-for-bit
 * rep one. That is exactly wrong for lifting, and it is the reason a gym scene
 * built out of looped clips reads as a screensaver rather than a set. Two
 * properties are doing all the work, and neither survives being baked:
 *
 * - **The rep is asymmetric.** You lower a bar in about two seconds and drive
 *   it up in about one. A symmetric rep is the instant tell of a fake gym
 *   animation, and it is what you get for free from a sine.
 * - **The rep decays.** Rep eight is slower, shallower and shakier than rep
 *   one, the sticking point deepens, and eventually there are no more reps
 *   left in the weight. A clip cannot express that, because the clip is the same
 *   every time it plays.
 *
 * So `Lifting` drives the rig directly, the way `Asana` does:
 *
 * ```ts
 * const lift = new Lifting(rig, 'squat', { load: 100, reps: 8 });
 * lift.hold(barbell);                       // any SCENA `Holdable`
 * lift.onRep((r) => hud.count(r.index));
 * game.onUpdate((t) => lift.update(t.delta));
 * ```
 *
 * ## Where the decay comes from
 *
 * Not from a curve someone liked. `repsLeft` is Epley's formula rearranged —
 * `30 × (1RM / load − 1)` — the same arithmetic every strength coach uses to
 * turn a working weight into a rep target. At 75% of a maximum it predicts ten
 * reps; at 85%, five. Fatigue is simply how far through that budget the set
 * has got, and everything that decays is a function of it. Load a bar light
 * and the set never visibly tires; load it near a maximum and the third rep
 * already grinds. That falls out rather than being authored.
 *
 * ## The bar path, and why the torso angle is solved
 *
 * A loaded bar has to stay over the middle of the foot. It is not a style
 * preference — a system whose centre of mass leaves its base of support falls
 * over — and it is the first thing any coach corrects. So the torso angle is
 * **not authored**: given where the hips have travelled and where the load
 * rides, `Lifting` solves the pitch that puts the load over mid-foot.
 *
 * That single decision is why a front squat comes out upright and a back squat
 * comes out leaning, from *the same legs*: the load moved 9 cm forward, so the
 * torso had to come up to meet it. It is also why a long-femured character
 * leans further than a short-femured one — their hips travel further back, so
 * the torso must close more to bring the bar home. Nobody authored either.
 *
 * `measureBarPath` then checks the result through the actual skinned rig,
 * including the parts the solve does not model: the pitch is distributed
 * across three spine joints rather than applied at the root, the tremor is on
 * top, and form degrades as the set goes. See `bench/lifting.mjs`.
 *
 * ## What is not here
 *
 * Anything that needs a bench, a rack or a machine to exist is a SCENA
 * problem, not an ANIMA one, and half a movement is worse than none. The bench
 * press is here because it needs nothing but a height; the leg press is not.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => clamp(v, 0, 1);

/**
 * Where the centre of the foot is, ahead of the ankle joint, as a fraction of
 * the rig's height.
 *
 * Taken from the humanoid layout rather than guessed: the foot box is
 * `0.115 × height` long and sits `0.026 × height` forward of the ankle, so its
 * centroid — the middle of the base of support, which is what "over mid-foot"
 * means — is exactly that far ahead.
 */
const MIDFOOT = 0.026;

export type LiftName =
  /** Barbell on the traps, hips back and down. The reference lift. */
  | 'squat'
  /** Barbell in a front rack. Same legs; the load forces an upright torso. */
  | 'frontSquat'
  /** Bar off the floor, hips and knees both driving. */
  | 'deadlift'
  /** A hip hinge with soft knees — the hamstrings, not the quads. */
  | 'romanianDeadlift'
  /** Standing barbell press, bar from the shoulders to overhead. */
  | 'overheadPress'
  /** Supine, bar from the chest to lockout. The bar path is a shallow J. */
  | 'benchPress'
  /** Bent-over barbell row: the bar comes to the ribs, the torso stays. */
  | 'row'
  /** Barbell curl. The path is an arc; that is the movement, not an error. */
  | 'curl'
  /** Dumbbells out to the sides, elbows soft. */
  | 'lateralRaise'
  /** Split stance, both feet planted, the back knee toward the floor. */
  | 'lunge'
  /** Ballistic hip hinge — the bell is thrown, not lifted. */
  | 'kettlebellSwing'
  /** Hanging from a fixed bar. The hands must not move; the body does. */
  | 'pullUp';

/**
 * What a lift's bar path is measured against.
 *
 * `'free'` is not an exemption — it is a statement that the path is an arc by
 * construction. A curl's hand travels forward because the forearm rotates
 * about the elbow, and holding it to a plumb line would be gating the
 * definition of the movement rather than the quality of the animation. Those
 * lifts are still held to every other check.
 */
export type LiftPlumb =
  /** The load tracks over the middle of the base of support. */
  | 'midfoot'
  /** The contact must not move at all — the hands are on a fixed bar. */
  | 'fixed'
  /** An arc by construction. */
  | 'free';

/** The moment of the rep a `Lifting` is in. */
export type LiftPhase = 'eccentric' | 'bottom' | 'concentric' | 'top' | 'done';

/** One frame's worth of body shape, before the solve and before the tremor. */
interface LiftFrame {
  /** How far the hips have descended from standing, metres. */
  drop: number;
  /** How far the hips have travelled backward, metres. */
  back: number;
  /** Torso pitch in radians, or `null` to solve it from the balance constraint. */
  pitch: number | null;
  /**
   * Ankle placements in rig space: `[left, right]` forward, and half-width.
   *
   * `heel` lifts a heel off the floor — negative dorsiflexes. A lunge's back
   * foot is on its ball, and forcing that sole flat is the difference between
   * a lunge and a very odd stretch.
   */
  feet: { z: [number, number]; width: number; heel?: [number, number] };
  /** Where the load rides, in the Chest bone's own frame. */
  hold: [number, number, number];
  /** How far the load hangs straight down from the hold — a deadlift's arms. */
  sag: number;
  /** Solve the arms onto the load. False authors them instead (a curl). */
  reach: boolean;
  /**
   * Authored arm angles, when `reach` is false.
   *
   * `hang` is how far the arm is brought down from the T-pose; `arc` swings it
   * fore and aft IN THE WORLD (positive is backward) after the torso's own
   * pitch has been taken back out; `elbow` is flexion.
   */
  arm?: { hang: number; arc: number; elbow: number };
  /** Chest extension: negative opens the chest, positive rounds it. */
  arch: number;
  /** Head pitch: positive looks down. */
  head: number;
  /** `base: 'bar'` only — bar-to-shoulder distance, metres. */
  hang?: number;
  /** `base: 'bar'` only — knee flexion of the free-hanging legs. */
  tuck?: number;
}

export interface LiftSpec {
  /** For a UI: the name a gym would use. */
  label: string;
  implement: 'barbell' | 'dumbbells' | 'kettlebell' | 'bodyweight';
  /** Seconds the lowering half takes at rep one. */
  eccentric: number;
  /** Seconds the lifting half takes at rep one. */
  concentric: number;
  /** Seconds spent at the stretched end. A deadlift resets on the floor. */
  bottomHold: number;
  /** Seconds spent at lockout. */
  topHold: number;
  /**
   * True when the rep BEGINS at the stretched end.
   *
   * A squat starts standing and goes down first; a deadlift starts on the
   * floor and goes up first. Same four segments, rotated — which is why this
   * is a flag and not a second timing model.
   */
  fromBottom: boolean;
  /**
   * The eccentric is the FAST half.
   *
   * A kettlebell swing is thrown and caught, not lowered under control, so its
   * asymmetry runs the other way. Flagging it inverts what the gate expects
   * rather than excusing it from the check.
   */
  ballistic?: boolean;
  /** A trained adult's rough one-rep max in kg — `load` is read against this. */
  oneRepMax: number;
  plumb: LiftPlumb;
  /** Half the distance between the hands, as a fraction of the rig's height. */
  grip: number;
  /** `'feet'` stands on the floor; `'bar'` hangs from a fixed bar overhead. */
  base: 'feet' | 'bar';
  /** The body shape at rep depth `d` — 0 is lockout, 1 is fully stretched. */
  shape: (d: number, rig: HumanoidRig) => LiftFrame;
}

/** Everything a shape needs from the rig, measured once. */
interface Body {
  h: number;
  leg: number;
  /**
   * Standing hip height — from the rig's LAYOUT, not from `Hips.position`.
   *
   * A shape is evaluated against a rig this module is in the middle of posing,
   * so reading the live hips back would feed last frame's answer into this
   * frame's question. Measured as a rep boundary popping 76 mm.
   */
  hips: number;
  /** Hips bone to Chest bone, at rest — the length the hold hangs off. */
  chest: number;
  /** Shoulder joint height above the CHEST bone, at rest. */
  shoulder: number;
  /** Shoulder joint to hand bone, arm straight. */
  armReach: number;
  /** Half the natural stance width. */
  stance: number;
}

const bodyOf = (rig: HumanoidRig): Body => {
  const [upper, fore] = chainLengths(rig, 'Left', true);
  return {
    h: rig.height,
    leg: rig.legLength,
    hips: rig.legLength + 0.065 * rig.height,
    chest: rig.bones.Spine.position.y + rig.bones.Chest.position.y,
    shoulder: rig.bones.LeftShoulder.position.y,
    armReach: upper + fore,
    stance: rig.bones.LeftUpLeg.position.x,
  };
};

/** A pair of straight legs, feet under the hips — the default for a shape. */
const planted = (b: Body, z: [number, number] = [0, 0]): LiftFrame['feet'] => ({
  z,
  width: b.stance,
});

export const LIFTS: Record<LiftName, LiftSpec> = {
  squat: {
    label: 'Back squat',
    implement: 'barbell',
    eccentric: 2.0,
    concentric: 1.1,
    bottomHold: 0.06,
    topHold: 0.45,
    fromBottom: false,
    oneRepMax: 150,
    plumb: 'midfoot',
    grip: 0.21,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        // The hips go BACK as they go down. Straight down is the squat every
        // beginner does and it tips them onto their toes.
        drop: 0.545 * b.leg * d,
        back: 0.29 * b.leg * d,
        pitch: null,
        feet: planted(b),
        // On the traps: a little above the chest bone and just behind the
        // spine, which is where a bar actually sits on a back.
        hold: [0, 0.107 * b.h, -0.017 * b.h],
        sag: 0,
        reach: true,
        arch: -0.1,
        head: -0.05 - 0.1 * d,
      };
    },
  },
  frontSquat: {
    label: 'Front squat',
    implement: 'barbell',
    eccentric: 1.9,
    concentric: 1.1,
    bottomHold: 0.05,
    topHold: 0.5,
    fromBottom: false,
    oneRepMax: 110,
    plumb: 'midfoot',
    grip: 0.115,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        // IDENTICAL legs to the back squat. Everything that differs below
        // comes out of the solve, not out of a second authoring.
        drop: 0.545 * b.leg * d,
        back: 0.29 * b.leg * d,
        pitch: null,
        feet: planted(b),
        // The front rack: shelved on the deltoids, well in front of the spine.
        hold: [0, 0.1 * b.h, 0.075 * b.h],
        sag: 0,
        reach: true,
        arch: -0.14,
        head: -0.08,
      };
    },
  },
  deadlift: {
    label: 'Deadlift',
    implement: 'barbell',
    eccentric: 2.0,
    concentric: 1.3,
    bottomHold: 0.5,
    topHold: 0.3,
    fromBottom: true,
    oneRepMax: 190,
    plumb: 'midfoot',
    grip: 0.12,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        drop: 0.6 * b.leg * d,
        back: 0.3 * b.leg * d,
        pitch: null,
        feet: planted(b),
        // The hold is the SHOULDER, not the bar. The arms hang straight — they
        // are cables — so putting the shoulders over mid-foot is what puts the
        // bar there, and it is the same solve as a squat's.
        hold: [0, b.shoulder, 0],
        sag: b.armReach,
        reach: true,
        arch: -0.06,
        head: -0.02 + 0.24 * d,
      };
    },
  },
  romanianDeadlift: {
    label: 'Romanian deadlift',
    implement: 'barbell',
    eccentric: 2.2,
    concentric: 1.2,
    bottomHold: 0.12,
    topHold: 0.35,
    fromBottom: false,
    oneRepMax: 140,
    plumb: 'midfoot',
    grip: 0.12,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        // A hinge, not a squat: the hips go a long way back and barely down.
        drop: 0.16 * b.leg * d,
        back: 0.34 * b.leg * d,
        pitch: null,
        feet: planted(b),
        hold: [0, b.shoulder, 0],
        sag: b.armReach,
        reach: true,
        arch: -0.12,
        head: -0.02 + 0.3 * d,
      };
    },
  },
  overheadPress: {
    label: 'Overhead press',
    implement: 'barbell',
    eccentric: 1.7,
    concentric: 1.2,
    bottomHold: 0.18,
    topHold: 0.3,
    fromBottom: true,
    oneRepMax: 70,
    plumb: 'midfoot',
    grip: 0.155,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        // The knees stay locked; a press that dips is a push press.
        drop: 0.012 * b.leg * d,
        back: 0,
        // Lean back a little under the bar at the shoulders, stand tall at
        // lockout. Small, and it is what stops the bar hitting the chin.
        pitch: null,
        feet: planted(b),
        // Bar from overhead (d = 0) down to the front rack (d = 1).
        hold: [0, 0.1 * b.h + b.armReach * (1 - d), 0.012 * b.h + 0.055 * b.h * d],
        sag: 0,
        reach: true,
        arch: -0.05 - 0.06 * d,
        head: 0.14 * d - 0.06 * (1 - d),
      };
    },
  },
  benchPress: {
    label: 'Bench press',
    implement: 'barbell',
    eccentric: 1.9,
    concentric: 1.0,
    bottomHold: 0.1,
    topHold: 0.4,
    fromBottom: false,
    oneRepMax: 110,
    // A bench press bar path is a shallow J on purpose — it touches the lower
    // chest and finishes over the shoulder joint. Measuring that against a
    // plumb line would flag the movement itself.
    plumb: 'free',
    grip: 0.175,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      const benchY = 0.26 * b.h;
      return {
        drop: b.hips - benchY,
        back: 0,
        // Flat on the back. Every other lift solves its pitch; this one has
        // a bench holding it, so the bench decides.
        pitch: -Math.PI / 2,
        // Feet planted on the floor well in front — where they go on a bench.
        feet: { z: [0.4 * b.leg, 0.4 * b.leg], width: b.stance * 1.5 },
        // In the Chest's frame, lying down, local +Z is world UP. The bar comes
        // down toward the sternum (local −Y is toward the feet) and finishes
        // over the shoulder.
        hold: [0, -0.05 * b.h + 0.08 * b.h * d, b.armReach * (0.94 - 0.58 * d)],
        sag: 0,
        reach: true,
        arch: -0.16,
        head: 0.1,
      };
    },
  },
  row: {
    label: 'Bent-over row',
    implement: 'barbell',
    eccentric: 1.6,
    concentric: 0.95,
    bottomHold: 0.1,
    topHold: 0.25,
    fromBottom: true,
    oneRepMax: 100,
    plumb: 'free',
    grip: 0.135,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        // The torso is the SET-UP, not the movement: it holds still while the
        // arms work. A row whose back rises with the bar is a bad row.
        drop: 0.1 * b.leg,
        back: 0.22 * b.leg,
        pitch: 1.15,
        feet: planted(b),
        hold: [0, b.shoulder, 0],
        sag: b.armReach,
        reach: false,
        arm: { hang: 1.42, arc: 0.38 * (1 - d), elbow: 0.14 + 1.85 * (1 - d) },
        arch: -0.14,
        head: 0.28,
      };
    },
  },
  curl: {
    label: 'Barbell curl',
    implement: 'barbell',
    eccentric: 2.1,
    concentric: 1.05,
    bottomHold: 0.12,
    topHold: 0.3,
    fromBottom: true,
    oneRepMax: 50,
    plumb: 'free',
    grip: 0.12,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        drop: 0,
        back: 0,
        pitch: 0.04,
        feet: planted(b),
        hold: [0, b.shoulder, 0],
        sag: b.armReach,
        reach: false,
        // The upper arm barely moves — that is the whole point of a curl, and
        // the tell of a bad one is the elbow swinging forward to help.
        arm: { hang: 1.42, arc: 0.06 * (1 - d), elbow: 0.18 + 2.2 * (1 - d) },
        arch: -0.05,
        head: -0.02,
      };
    },
  },
  lateralRaise: {
    label: 'Lateral raise',
    implement: 'dumbbells',
    eccentric: 2.0,
    concentric: 1.1,
    bottomHold: 0.15,
    topHold: 0.25,
    fromBottom: true,
    oneRepMax: 26,
    plumb: 'free',
    grip: 0.3,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        drop: 0,
        back: 0,
        pitch: 0.06,
        feet: planted(b),
        hold: [0, b.shoulder, 0],
        sag: b.armReach,
        reach: false,
        // Straight out to the sides: `hang` runs from arms-down to arms-level.
        arm: { hang: 1.4 * d + 0.08 * (1 - d), arc: -0.12, elbow: 0.24 },
        arch: -0.04,
        head: 0,
      };
    },
  },
  lunge: {
    label: 'Walking lunge',
    implement: 'dumbbells',
    eccentric: 1.6,
    concentric: 1.0,
    bottomHold: 0.08,
    topHold: 0.35,
    fromBottom: false,
    oneRepMax: 60,
    plumb: 'midfoot',
    grip: 0.14,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        drop: 0.12 * b.leg + 0.34 * b.leg * d,
        back: 0.02 * b.leg * d,
        pitch: null,
        // Split stance: both feet planted, and they stay planted all set.
        feet: { z: [0.32 * b.leg, -0.32 * b.leg], width: b.stance, heel: [0, -0.5] },
        hold: [0, b.shoulder, 0],
        sag: b.armReach,
        reach: true,
        arch: -0.08,
        head: -0.04,
      };
    },
  },
  kettlebellSwing: {
    label: 'Kettlebell swing',
    implement: 'kettlebell',
    // Thrown and caught. The numbers below are the honest ones for a swing,
    // and they are the wrong way round compared with every other lift here.
    eccentric: 0.55,
    concentric: 0.85,
    bottomHold: 0.05,
    topHold: 0.12,
    fromBottom: false,
    ballistic: true,
    oneRepMax: 48,
    plumb: 'free',
    grip: 0.055,
    base: 'feet',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        drop: 0.13 * b.leg * d,
        back: 0.3 * b.leg * d,
        pitch: 0.06 + 1.0 * d,
        feet: { z: [0, 0], width: b.stance * 1.25 },
        hold: [0, b.shoulder, 0],
        sag: b.armReach,
        reach: false,
        // Arms are a rope. At the top the bell floats to chest height; at the
        // bottom it is behind the hips and the arms are folded back into them.
        arm: { hang: 1.45, arc: 0.6 * d - 1.15 * (1 - d), elbow: 0.12 },
        arch: -0.1 + 0.08 * d,
        head: -0.06 + 0.42 * d,
      };
    },
  },
  pullUp: {
    label: 'Pull-up',
    implement: 'bodyweight',
    eccentric: 2.2,
    concentric: 1.25,
    bottomHold: 0.2,
    topHold: 0.22,
    fromBottom: true,
    // Bodyweight: `load` defaults to a plausible mass, and adding weight to it
    // is the same arithmetic everything else uses.
    oneRepMax: 105,
    plumb: 'fixed',
    grip: 0.165,
    base: 'bar',
    shape: (d, rig) => {
      const b = bodyOf(rig);
      return {
        drop: 0,
        back: 0,
        pitch: 0.06 - 0.16 * (1 - d),
        feet: planted(b),
        hold: [0, 0, 0],
        sag: 0,
        reach: true,
        arch: -0.06 - 0.1 * (1 - d),
        head: 0.04 - 0.2 * (1 - d),
        // Hanging: full arm at the bottom, chin at the bar at the top.
        hang: b.armReach * (0.28 + 0.72 * d),
        tuck: 1.0 + 0.35 * (1 - d),
      };
    },
  },
};

export const LIFT_NAMES = Object.keys(LIFTS) as LiftName[];

/* ────────────────────────────────────────────────────────────────────────
   Posing
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Live per-frame modulation, on top of the shape.
 *
 * Only the INSTANT matters here, not the set's accumulated fatigue: a fatigued
 * lifter at lockout is not shaking, and it is the moment under load that the
 * tremor and the form drift belong to. `effort` already carries the fatigue,
 * because it is fatigue times how hard this instant is.
 */
interface Grind {
  /** 0..1 — how hard THIS instant is. Drives the tremor and the form drift. */
  effort: number;
  /** Seeded clock, so two lifters do not shake in step. */
  clock: number;
  /** Seeded phase offset. */
  phase: number;
}

const NO_GRIND: Grind = { effort: 0, clock: 0, phase: 0 };

const scratchQ = new Quaternion();
const scratchStep = new Quaternion();
const scratchV = new Vector3();

/** Compose axis–angle steps the same way `Pose.rotate` does. */
function compose(out: Quaternion, steps: Array<[Vector3, number]>): Quaternion {
  out.identity();
  for (const [axis, angle] of steps) out.multiply(scratchStep.setFromAxisAngle(axis, angle));
  return out;
}

/**
 * Pitch the torso so a load carried at `hold` sits over `plumbZ`.
 *
 * The balance constraint, as arithmetic — and modelled against the chain the
 * rig actually has rather than a single hinge at the root. The pitch is spread
 * over three joints, so the hold ends up at
 *
 *   hipsZ + L1·sin(½φ) + L2·sin(0.78φ) + r·sin(φ + arch + base)
 *
 * and there is no closed form for φ. Four Newton steps from the single-hinge
 * estimate converge to under a millimetre.
 *
 * The first version DID use the single hinge, and the gate caught it: a squat
 * whose bar sat 65 mm forward of mid-foot, because a chain that bends in three
 * places carries its top further forward than one that bends in one. That is a
 * modelling error rather than a tolerance to widen — the constraint is physics.
 */
function balancePitch(
  reach: number,
  base: number,
  hipsZ: number,
  plumbZ: number,
  spine: number,
  chest: number,
  arch: number
): number {
  const want = clamp((plumbZ - hipsZ) / Math.max(1e-4, reach), -0.985, 0.985);
  let phi = clamp(Math.asin(want) - base - arch, -0.35, 1.45);
  for (let i = 0; i < 4; i++) {
    const f =
      hipsZ +
      spine * Math.sin(0.5 * phi) +
      chest * Math.sin(0.78 * phi) +
      reach * Math.sin(phi + arch + base) -
      plumbZ;
    const d =
      0.5 * spine * Math.cos(0.5 * phi) +
      0.78 * chest * Math.cos(0.78 * phi) +
      reach * Math.cos(phi + arch + base);
    if (Math.abs(d) < 1e-6) break;
    phi = clamp(phi - f / d, -0.35, 1.45);
  }
  return phi;
}

/**
 * Put the whole body into one frame of a lift, and report where the load is.
 *
 * Mutates the rig — the arms are SOLVED onto the load, and a solve needs the
 * shoulders to already be where the torso put them. Same order `climb` uses,
 * for the same reason.
 */
function poseLift(
  rig: HumanoidRig,
  spec: LiftSpec,
  d: number,
  grind: Grind,
  out: Vector3
): void {
  const b = bodyOf(rig);
  const frame = spec.shape(clamp01(d), rig);
  const bones = rig.bones;
  for (const name of BONE_NAMES) bones[name].quaternion.identity();

  // The tremor. Small, fast, and only present when the effort is — it is what
  // separates the eighth rep from the first at a glance, and it belongs on the
  // parts that are actually straining rather than everywhere.
  const shake = grind.effort * 0.013;
  const tremor = shake * Math.sin(grind.clock * 17.4 + grind.phase);
  const tremorZ = shake * 0.6 * Math.sin(grind.clock * 12.1 + grind.phase * 2.3);

  // Form degrades under load: the torso closes a little further than it should
  // and the hips shoot before the chest does. Kept small — the point is that a
  // fatigued rep is measurably uglier, not that it collapses.
  const drift = grind.effort * 0.09;

  if (spec.base === 'bar') {
    // Hanging: the hands are fixed in the world and the body is what moves.
    // The chain runs downward from them, which is the whole model inverted.
    const barY = b.hips + b.chest + b.shoulder + b.armReach * 0.92;
    const pitch = (frame.pitch ?? 0) + drift * 0.3;
    bones.Hips.position.set(0, barY - (frame.hang ?? b.armReach) - b.chest - b.shoulder, 0);
    compose(bones.Hips.quaternion, [[X, pitch * 0.5]]);
    compose(bones.Spine.quaternion, [[X, pitch * 0.28 + tremor]]);
    compose(bones.Chest.quaternion, [[X, pitch * 0.22 + frame.arch]]);
    compose(bones.Head.quaternion, [[X, frame.head]]);
    // The legs hang; a pull-up's knees bend and the feet cross behind.
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      // Shins tucked UNDER, not trailing. Hanging the legs off 0.5 rad of hip
      // extension swung the feet half a metre behind the bar and read, from
      // the side, as a man flying rather than one doing a pull-up.
      compose(bones[`${side}UpLeg`].quaternion, [
        [X, 0.05 + (frame.tuck ?? 0.5) * 0.08],
        [Z, -s * 0.14],
      ]);
      compose(bones[`${side}Leg`].quaternion, [[X, frame.tuck ?? 0.5]]);
      compose(bones[`${side}Foot`].quaternion, [[X, -0.35]]);
    }
    rig.object.updateWorldMatrix(true, true);
    out.set(0, barY, 0);
    solveArms(rig, out, b.h * spec.grip, true);
    rig.object.updateWorldMatrix(true, true);
    return;
  }

  // ── Standing. The hips go where the shape says; the legs follow them. ──
  const hipsY = b.hips - frame.drop;
  const hipsZ = -frame.back;
  const plumbZ = (frame.feet.z[0] + frame.feet.z[1]) / 2 + MIDFOOT * b.h;

  // The last segment of the balance model: CHEST to the load. The two below it
  // (hips→spine, spine→chest) go in separately, because they carry different
  // fractions of the pitch. Folding them into one length here double-counted
  // them and put the bar 116 mm out — worse than the single hinge it replaced.
  const reach = Math.hypot(frame.hold[1], frame.hold[2]);
  const base = Math.atan2(frame.hold[2], frame.hold[1]);
  const pitch =
    frame.pitch !== null
      ? frame.pitch
      : balancePitch(
          reach,
          base,
          hipsZ,
          plumbZ,
          rig.bones.Spine.position.y,
          rig.bones.Chest.position.y,
          frame.arch
        ) + drift;

  bones.Hips.position.set(0, hipsY, hipsZ);
  compose(bones.Hips.quaternion, [[X, pitch * 0.5]]);
  compose(bones.Spine.quaternion, [[X, pitch * 0.28 + tremor]]);
  compose(bones.Chest.quaternion, [[X, pitch * 0.22 + frame.arch]]);
  compose(bones.Neck.quaternion, [[X, frame.head * 0.4]]);
  compose(bones.Head.quaternion, [[X, frame.head * 0.6 - pitch * 0.55]]);
  rig.object.updateWorldMatrix(true, true);

  // Feet first, and by IK onto FIXED targets. A lift is not a walk: the ankles
  // are nailed down for the whole set, so the knee and hip angles are whatever
  // the hips travelling demands rather than something anyone authored — and
  // "the feet did not move" is then true by construction rather than by luck.
  const ankleY = restAnkleY(rig, b.hips);
  const [upperLeg, lowerLeg] = chainLengths(rig, 'Left', false);
  const kneePole = scratchV.set(0, -0.35, 1).normalize().clone();
  for (const side of ['Left', 'Right'] as const) {
    const s = side === 'Left' ? 1 : -1;
    const hip = rig.object.worldToLocal(bones[`${side}UpLeg`].getWorldPosition(new Vector3()));
    const target = new Vector3(
      s * frame.feet.width,
      ankleY,
      frame.feet.z[side === 'Left' ? 0 : 1]
    );
    const { root, joint } = solveChain(hip, target, new Vector3(0, -1, 0), upperLeg, lowerLeg, kneePole);
    bones[`${side}UpLeg`].quaternion.copy(toParentFrame(rig, `${side}UpLeg`, root));
    bones[`${side}Leg`].quaternion.copy(joint);
  }
  rig.object.updateWorldMatrix(true, true);
  // Soles flat: take back whatever the shin ended up doing. A squat with
  // pointed toes is a calf raise.
  for (const side of ['Left', 'Right'] as const) {
    const shin = bones[`${side}Leg`].getWorldQuaternion(new Quaternion());
    const tilt = 2 * Math.asin(clamp(shin.x, -1, 1));
    const heel = frame.feet.heel?.[side === 'Left' ? 0 : 1] ?? 0;
    compose(bones[`${side}Foot`].quaternion, [[X, -tilt + heel]]);
  }
  rig.object.updateWorldMatrix(true, true);

  // The load, read off the posed rig rather than predicted.
  bones.Chest.localToWorld(out.set(frame.hold[0], frame.hold[1], frame.hold[2]));
  rig.object.worldToLocal(out);
  out.y -= frame.sag;

  if (frame.reach) {
    solveArms(rig, out, b.h * spec.grip, false);
  } else if (frame.arm) {
    const a = frame.arm;
    // Counter the chest's REAL world pitch, not the pitch that was asked for.
    // The two differ by the arch and by anything else riding on the spine, and
    // using the request instead put a bent-over row's bar 20 cm BEHIND the
    // lifter and made the bell rise on the backswing.
    const worn = 2 * Math.asin(clamp(bones.Chest.getWorldQuaternion(new Quaternion()).x, -1, 1));
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      compose(bones[`${side}Arm`].quaternion, [
        // "Hanging" has to mean hanging in the WORLD, not hanging relative to
        // a torso that is folded over its own knees — so undo the chest's own
        // pitch, then swing by however much the movement wants.
        [X, a.arc - worn + tremorZ],
        [Z, -s * a.hang],
        [Y, -s * 0.05],
      ]);
      compose(bones[`${side}ForeArm`].quaternion, [[Y, -s * a.elbow]]);
      compose(bones[`${side}Hand`].quaternion, [[Z, -s * 0.12]]);
    }
    rig.object.updateWorldMatrix(true, true);
    // With the arms authored, the load is wherever the hands ended up.
    const l = rig.object.worldToLocal(bones.LeftHand.getWorldPosition(new Vector3()));
    const r = rig.object.worldToLocal(bones.RightHand.getWorldPosition(new Vector3()));
    out.copy(l).add(r).multiplyScalar(0.5);
  }
  rig.object.updateWorldMatrix(true, true);
}

/** The rig's ankle height at rest — where the soles live. */
function restAnkleY(rig: HumanoidRig, restHipsY: number): number {
  return (
    restHipsY +
    rig.bones.LeftUpLeg.position.y +
    rig.bones.LeftLeg.position.y +
    rig.bones.LeftFoot.position.y
  );
}

/** Put both hands on the load, `half` metres either side of it. */
function solveArms(rig: HumanoidRig, load: Vector3, half: number, overhead: boolean): void {
  const [upperArm, foreArm] = chainLengths(rig, 'Left', true);
  for (const side of ['Left', 'Right'] as const) {
    const s = side === 'Left' ? 1 : -1;
    const shoulder = rig.object.worldToLocal(
      rig.bones[`${side}Arm`].getWorldPosition(new Vector3())
    );
    const target = new Vector3(load.x + s * half, load.y, load.z);
    // Elbows down and slightly out under a bar; up and out when hanging from
    // one. Without a pole the solve is a cone of valid answers and the elbow
    // wanders between frames.
    const pole = new Vector3(s, overhead ? 0.7 : -0.85, overhead ? -0.5 : -0.3).normalize();
    const { root, joint } = solveChain(shoulder, target, new Vector3(s, 0, 0), upperArm, foreArm, pole);
    rig.bones[`${side}Arm`].quaternion.copy(toParentFrame(rig, `${side}Arm`, root));
    rig.bones[`${side}ForeArm`].quaternion.copy(joint);
  }
  rig.object.updateWorldMatrix(true, true);
}

/* ────────────────────────────────────────────────────────────────────────
   The rep
   ──────────────────────────────────────────────────────────────────────── */

/**
 * How many reps are left in a working weight — Epley's formula, rearranged.
 *
 * `1RM = w · (1 + r/30)` is the standard conversion between a weight and the
 * reps it is good for; solved for `r` it says that 75% of a maximum is worth
 * ten reps and 85% is worth five, which is what a set actually looks like.
 * Everything that decays in this module is a function of how far through this
 * budget the set has got, so nothing about the fatigue curve is invented.
 */
export function repsInReserve(load: number, oneRepMax: number): number {
  const ratio = clamp(load / Math.max(1, oneRepMax), 0.05, 1);
  return clamp(30 * (1 / ratio - 1), 0.6, 45);
}

/**
 * Depth over the lifting half.
 *
 * Not a smoothstep. A concentric is fast off the bottom, stalls through the
 * sticking point — the joint angle where the leverage is worst, about a third
 * of the way up — and then accelerates to lockout. That stall is the thing you
 * recognise as effort, and it deepens as the set goes on until it does not
 * clear at all.
 *
 * Built by integrating a velocity profile rather than by picking an easing
 * curve, so `stick = 0` really is constant speed and there is one parameter
 * with a meaning instead of four with none.
 */
function concentricCurve(stick: number, samples = 32): Float32Array {
  const out = new Float32Array(samples + 1);
  let sum = 0;
  for (let i = 1; i <= samples; i++) {
    const t = (i - 0.5) / samples;
    const g = Math.exp(-(((t - 0.34) / 0.19) ** 2));
    sum += 1 - stick * g;
    out[i] = sum;
  }
  const total = out[samples] || 1;
  for (let i = 0; i <= samples; i++) out[i] /= total;
  return out;
}

function sampleCurve(curve: Float32Array, t: number): number {
  const n = curve.length - 1;
  const x = clamp01(t) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return curve[i] + (curve[i + 1] - curve[i]) * (x - i);
}

export interface LiftingOptions {
  /** Working weight in kg. Defaults to 72% of the movement's one-rep max. */
  load?: number;
  /** Reps to attempt. The set can end short — see `failed`. Default 8. */
  reps?: number;
  /** Seconds to fade into and out of the lift. Default 0.45. */
  fade?: number;
  /** Seeded tremor, so a gym full of lifters does not shake in unison. */
  seed?: number;
  /**
   * Scale every duration. 0.5 is a metronome twice as fast; the ASYMMETRY is
   * untouched, because it is a property of the movement and not of the tempo.
   */
  tempo?: number;
}

/** What `onRep` hands back the moment a rep finishes. */
export interface RepReport {
  /** 1 for the first rep. */
  index: number;
  /** Seconds it took, start of the rep to end. */
  duration: number;
  /** How deep it actually went, 0..1 — rep eight is not rep one. */
  depth: number;
  /** 0..1 through the set's rep budget when it finished. */
  fatigue: number;
}

/**
 * A working set.
 *
 * Owns the whole body while it runs — like `Asana` and unlike `Mood`, because
 * you cannot squat and walk at the same time and pretending otherwise produces
 * a character doing neither. `release()` hands the body back to whatever it was
 * doing before, over `fade` seconds.
 */
export class Lifting {
  /** Reps completed. */
  reps = 0;
  /** Where in the rep the body is. */
  phase: LiftPhase = 'top';
  /** Current rep depth, 0 at lockout and 1 fully stretched. */
  depth = 0;
  /** 0..1 through the set's rep budget. Everything that decays reads this. */
  fatigue = 0;
  /**
   * True once the set ended SHORT of the reps it was told to do.
   *
   * The set stops at a rep boundary rather than grinding to a halt mid-rep —
   * the last rep completed is the last one there was. A stalled rep that
   * visibly fails to clear is a different animation and is not here yet.
   */
  failed = false;

  private readonly rig: HumanoidRig;
  private readonly spec: LiftSpec;
  private readonly name: LiftName;
  private readonly load: number;
  private readonly target: number;
  private readonly tempo: number;
  private readonly fadeRate: number;
  private readonly budget: number;
  private readonly seed: number;

  private weight = 0;
  private restored = false;
  private wanted = 1;
  private clock = 0;
  private repClock = 0;
  private repDeepest = 0;
  private curve: Float32Array;
  private effort = 0;
  private held: Holdable | null = null;
  private readonly loadPos = new Vector3();
  private readonly entry = new Map<BoneName, Quaternion>();
  private entryHips = new Vector3();
  private readonly repCbs = new Set<(r: RepReport) => void>();
  private readonly failCbs = new Set<(reps: number) => void>();

  constructor(rig: HumanoidRig, lift: LiftName, options: LiftingOptions = {}) {
    this.rig = rig;
    this.name = lift;
    this.spec = LIFTS[lift];
    this.load = options.load ?? this.spec.oneRepMax * 0.72;
    this.target = Math.max(1, Math.round(options.reps ?? 8));
    this.tempo = Math.max(0.15, options.tempo ?? 1);
    // A zero fade snaps. Wanted by `measureBarPath` (a fade-in frame is a
    // T-pose blended with a lift, and measuring it says nothing about either)
    // and by any scene that opens on someone already mid-set.
    const fade = Math.max(0, options.fade ?? 0.45);
    this.fadeRate = fade > 0 ? 1 / fade : Infinity;
    this.budget = repsInReserve(this.load, this.spec.oneRepMax);
    this.seed = options.seed ?? 1;
    this.curve = concentricCurve(0.25);
    for (const name of BONE_NAMES) this.entry.set(name, rig.bones[name].quaternion.clone());
    this.entryHips.copy(rig.bones.Hips.position);
    this.depth = this.spec.fromBottom ? 1 : 0;
    this.phase = this.spec.fromBottom ? 'bottom' : 'top';
  }

  /** Which movement this is. */
  get lift(): LiftName {
    return this.name;
  }

  /** The set's spec, for a UI that wants the label or the implement. */
  get about(): LiftSpec {
    return this.spec;
  }

  /** Reps this weight is still good for, by Epley. Falls as the set goes. */
  get repsLeft(): number {
    return Math.max(0, this.budget - this.reps);
  }

  /**
   * How hard this instant is, 0..1.
   *
   * Peaks at the sticking point of a late rep and sits near zero at lockout.
   * Hand it to GAMA's `GameFeel` for a camera that strains with the lifter, or
   * to an audio bridge for the breath.
   */
  get grind(): number {
    return this.effort;
  }

  /** The set is over — finished, or failed. */
  get done(): boolean {
    return this.phase === 'done';
  }

  /** Hear each rep land. Returns the unsubscribe. */
  onRep(cb: (r: RepReport) => void): () => void {
    this.repCbs.add(cb);
    return () => this.repCbs.delete(cb);
  }

  /** Hear the set end short of its target. Returns the unsubscribe. */
  onFailure(cb: (reps: number) => void): () => void {
    this.failCbs.add(cb);
    return () => this.failCbs.delete(cb);
  }

  /**
   * Put a bar, a pair of dumbbells or a bell in the hands.
   *
   * Structural, like everything else in the trilogy: anything shaped like a
   * `Holdable` will do, so a SCENA barbell and a box you built yourself are
   * the same thing here. The object is moved to the load point every frame —
   * build it with its ORIGIN at the middle of the bar and its length along X.
   */
  hold(holdable: Holdable | null): void {
    this.held = holdable;
  }

  /** Where the load is, in world space. */
  loadPoint(target = new Vector3()): Vector3 {
    return target.copy(this.loadPos).applyMatrix4(this.rig.object.matrixWorld);
  }

  /** Rack it and hand the body back. */
  release(): void {
    this.wanted = 0;
  }

  update(dt: number): void {
    if (!(dt > 0)) return;
    this.weight += Math.sign(this.wanted - this.weight) * Math.min(dt * this.fadeRate, Math.abs(this.wanted - this.weight));
    if (this.weight <= 0.0001) {
      // Faded out — and "nearly the entry pose" is not the entry pose. Bailing
      // out one frame early left the last blend on the body, which measured as
      // 0.011 rad of hip rotation that nothing would ever take back off again.
      if (!this.restored) {
        for (const name of BONE_NAMES) this.rig.bones[name].quaternion.copy(this.entry.get(name)!);
        this.rig.bones.Hips.position.copy(this.entryHips);
        this.rig.object.updateWorldMatrix(true, true);
        this.restored = true;
      }
      return;
    }
    this.restored = false;
    this.clock += dt;
    if (this.phase !== 'done') this.advance(dt);

    const grind: Grind = {
      effort: this.effort,
      clock: this.clock,
      phase: this.seed * 2.399963,
    };
    poseLift(this.rig, this.spec, this.depth, grind, this.loadPos);

    // Blend toward whatever the body was doing before. Smoothstepped, because
    // a linear fade into a loaded pose reads as a snap at both ends.
    const w = this.weight * this.weight * (3 - 2 * this.weight);
    if (w < 0.9999) {
      for (const name of BONE_NAMES) {
        const bone = this.rig.bones[name];
        scratchQ.copy(bone.quaternion);
        bone.quaternion.copy(this.entry.get(name)!).slerp(scratchQ, w);
      }
      this.rig.bones.Hips.position.lerpVectors(this.entryHips, this.rig.bones.Hips.position, w);
      this.rig.object.updateWorldMatrix(true, true);
    }

    if (this.held) this.place(this.held);
  }

  /** Advance the rep clock and work out this frame's depth. */
  private advance(dt: number): void {
    const spec = this.spec;
    this.fatigue = clamp01(this.reps / this.budget);
    const f = this.fatigue;
    // Slower to push, and — the part nobody animates — FASTER to lower, because
    // control is the first thing to go.
    const up = spec.concentric * (1 + 0.7 * f) * this.tempo;
    const down = spec.eccentric * (1 - 0.18 * f) * this.tempo;
    const bottom = spec.bottomHold * this.tempo;
    const top = spec.topHold * (1 + 0.55 * f) * this.tempo;

    this.repClock += dt;
    const order: Array<[LiftPhase, number]> = spec.fromBottom
      ? [['concentric', up], ['top', top], ['eccentric', down], ['bottom', bottom]]
      : [['eccentric', down], ['bottom', bottom], ['concentric', up], ['top', top]];
    const total = order.reduce((a, [, s]) => a + s, 0);

    if (this.repClock >= total) {
      this.repClock -= total;
      this.finishRep(total);
      if (this.phase === 'done') return;
    }

    // Shallower as it goes: the last rep of a hard set does not reach the
    // depth of the first, and pretending it does is the tell.
    const range = 1 - 0.2 * f;

    let t = this.repClock;
    for (const [phase, span] of order) {
      if (t > span) {
        t -= span;
        continue;
      }
      this.phase = phase;
      const u = span > 0 ? clamp01(t / span) : 0;
      if (phase === 'eccentric') {
        // Fast at first, controlled into the bottom.
        this.depth = range * (1 - (1 - u) ** 1.35);
        this.effort = 0.35 * f * u;
      } else if (phase === 'concentric') {
        this.depth = range * (1 - sampleCurve(this.curve, u));
        // The sticking point, as a number: worst a third of the way up, and
        // only worth anything once there is fatigue to feel.
        this.effort = clamp01(f * Math.exp(-(((u - 0.34) / 0.24) ** 2)) * 1.15);
      } else if (phase === 'bottom') {
        this.depth = range;
        this.effort = 0.5 * f;
      } else {
        this.depth = 0;
        this.effort = 0.15 * f;
      }
      this.repDeepest = Math.max(this.repDeepest, this.depth);
      return;
    }
  }

  private finishRep(duration: number): void {
    this.reps++;
    const report: RepReport = {
      index: this.reps,
      duration,
      depth: this.repDeepest,
      fatigue: clamp01(this.reps / this.budget),
    };
    this.repDeepest = 0;
    for (const cb of this.repCbs) cb(report);
    this.fatigue = report.fatigue;
    // The sticking point deepens with the set. Rebuilt here rather than every
    // frame, because it only changes when a rep lands.
    this.curve = concentricCurve(clamp01(0.25 + 0.55 * this.fatigue));
    if (this.reps >= this.target) {
      // NOT reset to lockout. A set of deadlifts ends with the bar on the
      // floor and a set of squats ends standing, and forcing either onto the
      // other teleports the load the whole length of the rep on one frame.
      this.phase = 'done';
      this.effort = 0;
      return;
    }
    // Out of reps before out of intent: whatever the caller asked for, Epley
    // was not offering it, and the set ends here. A set that always hits its
    // number is a set nobody had to earn.
    if (this.fatigue >= 1) {
      this.failed = true;
      this.phase = 'done';
      this.effort = 0;
      for (const cb of this.failCbs) cb(this.reps);
    }
  }

  /** Move the held object onto the load point. */
  private place(h: Holdable): void {
    const obj: Object3D = h.object;
    if (obj.parent !== this.rig.object) this.rig.object.add(obj);
    obj.position.copy(this.loadPos);
    if (h.grip) obj.position.add(scratchV.set(h.grip.x ?? 0, h.grip.y ?? 0, h.grip.z ?? 0));
    obj.quaternion.identity();
    obj.updateMatrixWorld(true);
  }
}

/**
 * One clean rep, as a loopable clip.
 *
 * For the twenty people in the background of a gym scene, where the point is
 * that the room is busy and nobody is going to count anyone's reps. It is
 * explicitly NOT the feature: a clip is the same every time it plays, so this
 * is rep one forever — no sticking point deepening, no shortening range, no
 * failure. Use `Lifting` for anyone the camera cares about.
 */
export function createLiftClip(rig: HumanoidRig, lift: LiftName, fps = 30) {
  const spec = LIFTS[lift];
  const rest = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
  const restPos = rig.bones.Hips.position.clone();
  const curve = concentricCurve(0.25);
  const segments: Array<[LiftPhase, number]> = spec.fromBottom
    ? [['concentric', spec.concentric], ['top', spec.topHold], ['eccentric', spec.eccentric], ['bottom', spec.bottomHold]]
    : [['eccentric', spec.eccentric], ['bottom', spec.bottomHold], ['concentric', spec.concentric], ['top', spec.topHold]];
  const duration = segments.reduce((a, [, s]) => a + s, 0);
  const load = new Vector3();

  const clip = buildClip(rig, `lift-${lift}`, duration, fps, (p, pose: Pose) => {
    let t = p * duration;
    let depth = 0;
    for (const [phase, span] of segments) {
      if (t > span && span > 0) {
        t -= span;
        continue;
      }
      const u = span > 0 ? clamp01(t / span) : 0;
      depth =
        phase === 'eccentric'
          ? 1 - (1 - u) ** 1.35
          : phase === 'concentric'
            ? 1 - sampleCurve(curve, u)
            : phase === 'bottom'
              ? 1
              : 0;
      break;
    }
    poseLift(rig, spec, depth, NO_GRIND, load);
    for (const name of BONE_NAMES) pose.set(name, rig.bones[name].quaternion);
    pose.hipsY = rig.bones.Hips.position.y;
  });

  for (const [name, q] of rest) rig.bones[name].quaternion.copy(q);
  rig.bones.Hips.position.copy(restPos);
  rig.object.updateWorldMatrix(true, true);
  return clip;
}

/* ────────────────────────────────────────────────────────────────────────
   The gate
   ──────────────────────────────────────────────────────────────────────── */

/**
 * What a set of a lift actually did, in numbers.
 *
 * Read off a driven `Lifting` — a real set, at a real frame rate, through the
 * skinned rig — rather than out of the arithmetic that produced it. That
 * independence is the whole value, and it is the same rule `measureFootSkate`
 * works to: the moment a number here is derived from the same expression the
 * animation uses, it stops being evidence of anything.
 */
export interface BarPathReport {
  /** Reps the set actually completed. */
  reps: number;
  /** True if the set ended short of its target. */
  failed: boolean;
  /**
   * Worst horizontal distance from the load to the lift's plumb line, metres.
   *
   * The coaching metric, and the reason this gate exists. A squat's bar has to
   * stay over the middle of the foot; a hand on a fixed pull-up bar has to stay
   * on it. Both are this number, measured the same way.
   */
  plumbDeviation: number;
  /**
   * The same, on the FIRST rep alone.
   *
   * The pair is the point. Fresh, the bar path is whatever the balance solve
   * produced; by the last rep the form drift has moved it, and the difference
   * between these two numbers is the set getting uglier — which is the whole
   * reason this is a controller and not a clip.
   */
  plumbEarly: number;
  /** Worst horizontal excursion of the load about its own mean, metres. */
  wander: number;
  /** Vertical travel of the load on the first rep, metres. */
  range: number;
  /**
   * Vertical travel of the LIFTER on the first rep, metres.
   *
   * For a pull-up the bar does not move and the body does, so "the rep moved
   * something" has to be asked of both. Reported separately rather than folded
   * together, because for a squat they are two different facts.
   */
  bodyRange: number;
  /**
   * Eccentric seconds ÷ concentric seconds on the FIRST rep, taken from the
   * load's own vertical velocity rather than from the spec.
   *
   * The number the whole module exists to make non-trivial: 1.0 is a sine, and
   * a sine is what a fake gym animation looks like.
   */
  tempo: number;
  /**
   * The same ratio on the LAST rep.
   *
   * It narrows, and that is a real thing rather than a rounding artefact: a
   * tiring lifter grinds the push out slower and drops the bar back faster,
   * so the two halves converge as control goes.
   */
  tempoLate: number;
  /** Last rep's depth ÷ first rep's. Below 1 means the set decayed. */
  depthDecay: number;
  /** Last rep's duration ÷ first rep's. Above 1 means it slowed. */
  timeDecay: number;
  /** Worst horizontal drift of a planted foot across the whole set, metres. */
  slip: number;
  /** Worst gap between a hand and the load, metres. */
  gripGap: number;
  /** Largest single-frame jump of the load, metres — a rep boundary popping. */
  pop: number;
  /** Load height at the deepest point of the first rep, metres. */
  bottomHeight: number;
  /** The pitch the balance solve chose at the bottom, radians. */
  bottomPitch: number;
}

export interface BarPathOptions extends LiftingOptions {
  /** Simulation step. Default 1/120 — the pop check wants a fine one. */
  step?: number;
  /** Give up after this many seconds of simulated set. Default 180. */
  limit?: number;
}

/**
 * Drive a whole set and measure it.
 *
 * Runs the real controller, not a model of it, and reads world positions out of
 * the transform hierarchy that ships — including the tremor, the form drift and
 * the fact that the solved pitch is distributed across three joints rather than
 * applied at one.
 */
export function measureBarPath(
  rig: HumanoidRig,
  lift: LiftName,
  options: BarPathOptions = {}
): BarPathReport {
  const spec = LIFTS[lift];
  const step = options.step ?? 1 / 120;
  const limit = options.limit ?? 180;
  const before = BONE_NAMES.map((n) => [n, rig.bones[n].quaternion.clone()] as const);
  const beforeHips = rig.bones.Hips.position.clone();
  const midfootZ = MIDFOOT * rig.height;

  const set = new Lifting(rig, lift, { ...options, fade: 0 });
  const reps: Array<{ duration: number; depth: number; down: number; up: number }> = [];
  // Whether the ARMS are solved onto the load. When they are not, the load IS
  // the hands, so a hand-to-load distance is a tautology and is not measured.
  const solved = spec.shape(0, rig).reach;

  const load = new Vector3();
  const prev = new Vector3();
  const spot = new Vector3();
  const anchor = new Map<string, Vector3>();
  let plumbDeviation = 0;
  let plumbEarly = 0;
  let slip = 0;
  let gripGap = 0;
  let pop = 0;
  let wanderMin = Infinity;
  let wanderMax = -Infinity;
  let loadLow = Infinity;
  let loadHigh = -Infinity;
  let bodyLow = Infinity;
  let bodyHigh = -Infinity;
  let bottomHeight = 0;
  let bottomPitch = 0;
  let deepest = -Infinity;
  let downTime = 0;
  let upTime = 0;
  let t = 0;
  let frames = 0;
  let counted = 0;

  set.onRep((r) => {
    reps.push({ duration: r.duration, depth: r.depth, down: downTime, up: upTime });
    downTime = 0;
    upTime = 0;
  });

  while (!set.done && t < limit) {
    set.update(step);
    t += step;
    frames++;
    set.loadPoint(load);

    // 1. The plumb line. For a standing lift it is the middle of the base of
    //    support. For a hanging one it is where each HAND started — the bar is
    //    bolted to the wall, so it is the grip that can drift, and measuring
    //    the bar instead would be reading back a constant.
    if (spec.plumb === 'midfoot') {
      let base = 0;
      for (const side of ['Left', 'Right'] as const) {
        rig.bones[`${side}Foot`].getWorldPosition(spot);
        base += spot.z / 2;
      }
      const off = Math.abs(load.z - (base + midfootZ));
      plumbDeviation = Math.max(plumbDeviation, off);
      if (counted === 0) plumbEarly = Math.max(plumbEarly, off);
    }
    wanderMin = Math.min(wanderMin, load.z);
    wanderMax = Math.max(wanderMax, load.z);

    // 2. Contact. Planted feet must stay planted; hands must stay on the bar.
    for (const side of ['Left', 'Right'] as const) {
      const key = `${side}Foot` as const;
      rig.bones[key].getWorldPosition(spot);
      const seen = anchor.get(key);
      if (!seen) anchor.set(key, spot.clone());
      else if (spec.base === 'feet') {
        slip = Math.max(slip, Math.hypot(spot.x - seen.x, spot.z - seen.z));
      }
      const hand = `${side}Hand` as const;
      rig.bones[hand].getWorldPosition(spot);
      if (spec.plumb === 'fixed') {
        const held = anchor.get(hand);
        if (!held) anchor.set(hand, spot.clone());
        else {
          plumbDeviation = Math.max(plumbDeviation, spot.distanceTo(held));
          if (counted === 0) plumbEarly = Math.max(plumbEarly, spot.distanceTo(held));
        }
      }
      if (solved) {
        gripGap = Math.max(gripGap, Math.abs(spot.distanceTo(load) - rig.height * spec.grip));
      }
    }

    // 3. Continuity, and the tempo — from the vertical velocity of whatever is
    //    actually moving. On a pull-up that is the lifter: the bar is bolted to
    //    the wall, and timing a stationary object reports a set that never
    //    happened.
    const work = spec.base === 'bar' ? rig.bones.Hips.getWorldPosition(new Vector3()) : load;
    if (frames > 1) {
      pop = Math.max(pop, work.distanceTo(prev));
      const dy = work.y - prev.y;
      if (Math.abs(dy) > step * 0.02) {
        if (dy < 0) downTime += step;
        else upTime += step;
      }
    }
    prev.copy(work);

    // 4. The first rep's travel — of the load AND of the lifter, because a
    //    pull-up moves the second and not the first.
    if (counted === 0) {
      loadLow = Math.min(loadLow, load.y);
      loadHigh = Math.max(loadHigh, load.y);
      const hips = rig.bones.Hips.getWorldPosition(spot).y;
      bodyLow = Math.min(bodyLow, hips);
      bodyHigh = Math.max(bodyHigh, hips);
      if (set.depth > deepest) {
        deepest = set.depth;
        bottomHeight = load.y;
        // The Hips bone carries half the torso pitch, and a quaternion about X
        // stores sin(θ/2) in x — hence the factor of four.
        bottomPitch =
          4 * Math.asin(clamp(rig.bones.Hips.getWorldQuaternion(new Quaternion()).x, -1, 1));
      }
    }
    counted = reps.length;
  }
  set.release();
  for (const [name, q] of before) rig.bones[name].quaternion.copy(q);
  rig.bones.Hips.position.copy(beforeHips);
  rig.object.updateWorldMatrix(true, true);

  const first = reps[0];
  const last = reps[reps.length - 1];
  const ratio = (r?: { down: number; up: number }): number =>
    r && r.up > 0 ? r.down / r.up : 0;
  return {
    reps: set.reps,
    failed: set.failed,
    plumbDeviation,
    plumbEarly,
    wander: wanderMax - wanderMin,
    range: Number.isFinite(loadHigh - loadLow) ? loadHigh - loadLow : 0,
    bodyRange: Number.isFinite(bodyHigh - bodyLow) ? bodyHigh - bodyLow : 0,
    tempo: ratio(first),
    tempoLate: ratio(last),
    depthDecay: first && last && first.depth > 0 ? last.depth / first.depth : 1,
    timeDecay: first && last && first.duration > 0 ? last.duration / first.duration : 1,
    slip,
    gripGap,
    pop,
    bottomHeight,
    bottomPitch,
  };
}
