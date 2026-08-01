import { Object3D, Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

/**
 * Striking — where the damage is a MEASUREMENT, not a table.
 *
 * A punch in most games is an animation plus a number somebody typed. Here it
 * is neither. The animation is choreography, and the number that comes out of
 * it is computed from the body that threw it:
 *
 *   effective mass = (sum of segment momentum along the strike line)
 *                    / (speed of the striking surface)
 *
 * Every term in that is either an anthropometric fact or read off the bone
 * transforms while the clip plays. The segment mass fractions are Dempster's,
 * which is the same table biomechanics has used since 1955 and the same table
 * the centre of mass below comes out of. The velocities are finite differences
 * on world positions, the way `measureFootSkate` reads a stride.
 *
 * So a jab is light because only an arm is moving; a cross is heavier because
 * the trunk — half the body — is turning behind it; a roundhouse is heavier
 * still because a leg weighs three times what an arm does; and a haymaker is
 * heaviest and also throws the thrower off balance. Four facts about fighting,
 * and this module chose none of them.
 *
 * ANIMA does not compute damage any more than it flies arrows. `Blow` carries
 * `impulse` in kg·m/s and something upstream decides what that costs.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => clamp(v, 0, 1);
/** Smooth 0..1 ramp — no corner at either end, so no velocity step. */
const ease = (t: number): number => {
  const s = clamp01(t);
  return s * s * (3 - 2 * s);
};

/**
 * A proximal link's rotation: eases to its nominal angle over the first `k` of
 * the wind-up, then KEEPS GOING at a slow rate.
 *
 * The tail is the whole point. Sequencing means the pelvis peaks before the
 * fist does, and an eased curve that saturates has zero slope at the end — so
 * with a plain ease the trunk had finished turning by the moment of contact,
 * contributed no momentum, and a cross came out at 1.4 kg of effective mass
 * against a jab's 3.6. Backwards, and backwards for a reason that reads as
 * physics: half the body had already stopped.
 *
 * A hip does not stop at contact. It turns over through the punch, which is
 * both what coaches say and what makes the number come out right.
 */
const ramp = (u: number, k: number): number => {
  const x = u / Math.max(1e-6, k);
  return x >= 1 ? 1 + TAIL * (x - 1) : ease(x);
};

/** How much a proximal link keeps turning past its nominal angle. */
const TAIL = 0.45;

// ---------------------------------------------------------------- the body

/**
 * A rigid segment of the body: the two bones that bracket it, how much of the
 * body's mass it is, and where along it that mass sits.
 *
 * Dempster's fractions (via Winter, *Biomechanics and Motor Control of Human
 * Movement*). They sum to exactly 1, which is the first thing worth asserting
 * about them and the first thing a test here does.
 *
 * `com` is the distance of the segment's own centre of mass from the PROXIMAL
 * joint, as a fraction of segment length — also Dempster's. It is not 0.5 for
 * a limb: a thigh is thicker at the hip, so its centre sits at 0.433.
 */
interface Segment {
  from: BoneName;
  to: BoneName;
  mass: number;
  com: number;
}

const SEGMENTS: Segment[] = [
  // Trunk, split at the chest so the rotation of the thorax is not credited to
  // the pelvis. Dempster gives the whole trunk 0.497; the thorax-and-abdomen
  // split is 0.216 above the split and 0.281 below it.
  { from: 'Hips', to: 'Chest', mass: 0.281, com: 0.5 },
  { from: 'Chest', to: 'Neck', mass: 0.216, com: 0.5 },
  { from: 'Neck', to: 'Head', mass: 0.081, com: 1.0 },
  { from: 'LeftArm', to: 'LeftForeArm', mass: 0.028, com: 0.436 },
  { from: 'LeftForeArm', to: 'LeftHand', mass: 0.016, com: 0.43 },
  { from: 'RightArm', to: 'RightForeArm', mass: 0.028, com: 0.436 },
  { from: 'RightForeArm', to: 'RightHand', mass: 0.016, com: 0.43 },
  { from: 'LeftUpLeg', to: 'LeftLeg', mass: 0.1, com: 0.433 },
  { from: 'LeftLeg', to: 'LeftFoot', mass: 0.0465, com: 0.433 },
  { from: 'RightUpLeg', to: 'RightLeg', mass: 0.1, com: 0.433 },
  { from: 'RightLeg', to: 'RightFoot', mass: 0.0465, com: 0.433 },
];

/**
 * The hand and the foot have no distal bone to bracket them, so they hang off
 * their parent along its own axis. Dempster: hand 0.006, foot 0.0145.
 */
const TIPS: Array<{ at: BoneName; mass: number }> = [
  { at: 'LeftHand', mass: 0.006 },
  { at: 'RightHand', mass: 0.006 },
  { at: 'LeftFoot', mass: 0.0145 },
  { at: 'RightFoot', mass: 0.0145 },
];

/** Everything in `SEGMENTS` and `TIPS` at once, for the momentum sum. */
const MASSES: Array<{ from: BoneName; to: BoneName; mass: number; com: number }> = [
  ...SEGMENTS,
  ...TIPS.map((t) => ({ from: t.at, to: t.at, mass: t.mass, com: 0 })),
];

/** What the fractions add up to. Asserted in the tests, not assumed here. */
export const SEGMENT_MASS_TOTAL = MASSES.reduce((a, s) => a + s.mass, 0);

/**
 * Body mass, in kilograms, from the only two things the rig knows about its
 * own size.
 *
 * `mass = bmi × height²` is the definition of BMI rearranged, so the whole
 * question is which BMI. The rig's `build` is a width multiplier around 1, and
 * a body's mass goes as its cross-section — width squared — so `bmi` goes with
 * `build²`. The anchor is 22.5, the midpoint of the WHO healthy range
 * 18.5–24.9, at `build = 1`. Across the range `createHumanoid` actually
 * generates (0.9 to 1.12) that spans 18.2 to 28.2: slim to stocky, and nothing
 * outside what a person is.
 *
 * A 1.77 m body at build 1.0 comes out at 70.6 kg.
 */
export function bodyMass(rig: HumanoidRig): number {
  const build = rig.description.build;
  return 22.5 * build * build * rig.height * rig.height;
}

const P = new Vector3();
const Q = new Vector3();

/** Where one segment's own centre of mass is, in world space. */
function segmentPoint(
  rig: HumanoidRig,
  s: { from: BoneName; to: BoneName; com: number },
  out: Vector3
): Vector3 {
  rig.bones[s.from].getWorldPosition(out);
  if (s.to !== s.from) {
    rig.bones[s.to].getWorldPosition(Q);
    out.lerp(Q, s.com);
  }
  return out;
}

/**
 * The whole body's centre of mass, in world space.
 *
 * Same table as `effectiveMass` below, which is the point: one set of segment
 * masses answers both "how hard did that land" and "is this body about to fall
 * over", and those two questions are the same question in a fight.
 */
export function centreOfMass(rig: HumanoidRig, out = new Vector3()): Vector3 {
  rig.object.updateMatrixWorld(true);
  out.set(0, 0, 0);
  let total = 0;
  for (const s of MASSES) {
    segmentPoint(rig, s, P);
    out.addScaledVector(P, s.mass);
    total += s.mass;
  }
  return out.divideScalar(Math.max(1e-6, total));
}

/**
 * How close this body is to falling over, as a fraction of a foot length.
 *
 * A body stands as long as its centre of mass projects inside the polygon its
 * feet make on the floor. This is the distance from that projection to the
 * nearest edge of the polygon, over the length of a foot — so 1 is dead
 * centred over a comfortable stance, 0 is exactly on the edge, and NEGATIVE
 * means the body is already going over and only has not noticed yet.
 *
 * It is the cost of every strike in one number. A jab spends almost none of
 * it. A committed overhand spends all of it, which is why a missed one is how
 * people end up on the floor, and why the gate below asserts that the two
 * differ rather than asserting a value.
 *
 * The base is approximated as the rectangle spanned by the two ankles, widened
 * by the foot's own length and width — the foot is a box on the end of the
 * ankle, and this reads that box's size rather than guessing it.
 */
export function stability(rig: HumanoidRig): number {
  rig.object.updateMatrixWorld(true);
  const com = centreOfMass(rig, new Vector3());
  const left = rig.bones.LeftFoot.getWorldPosition(new Vector3());
  const right = rig.bones.RightFoot.getWorldPosition(new Vector3());
  // Work in the rig's own frame so a yawed or walking fighter reads the same.
  const inv = rig.object;
  const c = inv.worldToLocal(com.clone());
  const l = inv.worldToLocal(left.clone());
  const r = inv.worldToLocal(right.clone());
  const foot = footBox(rig);
  const minX = Math.min(l.x, r.x) - foot.halfWidth;
  const maxX = Math.max(l.x, r.x) + foot.halfWidth;
  const minZ = Math.min(l.z, r.z) - foot.behind;
  const maxZ = Math.max(l.z, r.z) + foot.ahead;
  const margin = Math.min(c.x - minX, maxX - c.x, c.z - minZ, maxZ - c.z);
  return margin / foot.length;
}

/** The foot's own box, read off the layout the way `lifting` reads mid-foot. */
function footBox(rig: HumanoidRig): {
  length: number;
  halfWidth: number;
  ahead: number;
  behind: number;
} {
  // The foot geometry scales with the body; these are its proportions, and the
  // only measured input is the rig's height.
  const length = 0.152 * rig.height;
  return {
    length,
    halfWidth: 0.055 * rig.height,
    ahead: 0.72 * length, // toes forward of the ankle
    behind: 0.28 * length, // heel behind it
  };
}

// ------------------------------------------------------------- the strikes

/** What actually touches. The rig has no fingers, so a fist is the hand bone. */
export type StrikeSurface =
  | 'fist'
  | 'backfist'
  | 'hammer'
  | 'palm'
  | 'elbow'
  | 'knee'
  | 'ball'
  | 'instep'
  | 'shin'
  | 'heel';

export type StrikeName =
  | 'jab'
  | 'cross'
  | 'hook'
  | 'uppercut'
  | 'overhand'
  | 'backfist'
  | 'hammerfist'
  | 'palmStrike'
  | 'elbow'
  | 'knee'
  | 'teep'
  | 'frontKick'
  | 'roundhouse'
  | 'sideKick';

/**
 * The shape of a strike's path. Straight strikes travel down the line to the
 * target; the rest go round or up, and the arc is why a hook can be heavier
 * than a jab from the same arm.
 */
export type StrikePath = 'straight' | 'hook' | 'rising' | 'round' | 'thrust';

export interface StrikeSpec {
  label: string;
  /** Which limb, and therefore which segments are in the chain. */
  limb: 'arm' | 'leg';
  /** Lead side or rear side of the stance. The rear side gets the hips. */
  side: 'lead' | 'rear';
  surface: StrikeSurface;
  path: StrikePath;
  /**
   * How far the pelvis turns into it, radians. This is the base of the
   * kinetic chain — the reason a cross outweighs a jab — and it is the one
   * genuinely authored quantity per strike. Everything the gate measures is
   * downstream of it.
   */
  hip: number;
  /** How far the thorax turns on top of the pelvis. */
  trunk: number;
  /** Seconds from the guard to contact, at tempo 1. */
  windup: number;
  /** Seconds from contact back to guard. Slower for the committed strikes. */
  recover: number;
  /**
   * Height of the contact, as a fraction of the body's height. Head-hunting
   * strikes sit high; a teep goes to the belly; a low kick to the thigh.
   */
  target: number;
  /** How much of the strike is spent past the target. Zero is a snap. */
  through: number;
  /**
   * How far the pelvis drives toward the target, as a fraction of body
   * height. Weight transfer, and it is the term that actually puts a body
   * behind a punch.
   *
   * Turning the trunk does NOT: a trunk rotating about its own vertical axis
   * has its centre of mass ON that axis, so half the body's mass moves
   * essentially nowhere and contributes essentially nothing to the momentum
   * sum. Measured, a cross came out at 2.3 kg against a jab's 4.3 — backwards,
   * and backwards for a real reason rather than a coding one. What makes a
   * cross heavy is shoving off the back foot.
   */
  drive: number;
}

/**
 * Thirteen strikes and one shove, across the striking arts.
 *
 * `hip` and `trunk` are the choreography. `windup` and `recover` are the
 * choreography's timing. Nothing else here is a number: the mass, the speed,
 * the impulse, the reach and the balance cost are all measured off whatever
 * body ends up throwing it.
 */
export const STRIKES: Record<StrikeName, StrikeSpec> = {
  jab: {
    label: 'Jab',
    limb: 'arm',
    side: 'lead',
    surface: 'fist',
    path: 'straight',
    // Almost no hips. That is what a jab IS — a range-finder thrown off the
    // lead hand that costs nothing to throw and nothing to recover from.
    hip: 0.06,
    trunk: 0.12,
    windup: 0.13,
    recover: 0.11,
    target: 0.86,
    through: 0.05,
    drive: 0.012,
  },
  cross: {
    label: 'Cross',
    limb: 'arm',
    side: 'rear',
    surface: 'fist',
    path: 'straight',
    // The rear hand gets the pelvis. Half the body's mass turns behind it,
    // and the effective mass roughly doubles as a result — measured, not set.
    hip: 0.42,
    trunk: 0.55,
    windup: 0.18,
    recover: 0.17,
    target: 0.86,
    through: 0.12,
    drive: 0.055,
  },
  hook: {
    label: 'Hook',
    limb: 'arm',
    side: 'lead',
    surface: 'fist',
    path: 'hook',
    hip: 0.5,
    trunk: 0.62,
    windup: 0.19,
    recover: 0.2,
    target: 0.84,
    through: 0.16,
    drive: 0.03,
  },
  uppercut: {
    label: 'Uppercut',
    limb: 'arm',
    side: 'rear',
    surface: 'fist',
    path: 'rising',
    hip: 0.36,
    trunk: 0.34,
    windup: 0.17,
    recover: 0.16,
    target: 0.8,
    through: 0.1,
    drive: 0.035,
  },
  overhand: {
    label: 'Overhand',
    limb: 'arm',
    side: 'rear',
    surface: 'fist',
    path: 'round',
    // Everything goes into it, including the base. `stability` reads this
    // one lowest of the thirteen, and that is the point of having the number.
    hip: 0.66,
    trunk: 0.78,
    windup: 0.26,
    recover: 0.3,
    target: 0.88,
    through: 0.24,
    drive: 0.07,
  },
  backfist: {
    label: 'Spinning backfist',
    limb: 'arm',
    side: 'rear',
    surface: 'backfist',
    path: 'hook',
    hip: 0.9,
    trunk: 0.95,
    windup: 0.24,
    recover: 0.26,
    target: 0.87,
    through: 0.2,
    drive: 0.02,
  },
  hammerfist: {
    label: 'Hammer fist',
    limb: 'arm',
    side: 'rear',
    surface: 'hammer',
    path: 'round',
    hip: 0.3,
    trunk: 0.42,
    windup: 0.2,
    recover: 0.19,
    target: 0.7,
    through: 0.18,
    drive: 0.03,
  },
  palmStrike: {
    label: 'Palm strike',
    limb: 'arm',
    side: 'rear',
    surface: 'palm',
    path: 'straight',
    hip: 0.3,
    trunk: 0.4,
    windup: 0.16,
    recover: 0.15,
    target: 0.84,
    through: 0.12,
    drive: 0.04,
  },
  elbow: {
    label: 'Elbow',
    limb: 'arm',
    side: 'rear',
    surface: 'elbow',
    path: 'hook',
    // Short, so the arm's own extension contributes almost nothing and nearly
    // all the momentum is trunk. Heavy for its size, and it needs the range.
    hip: 0.55,
    trunk: 0.7,
    windup: 0.15,
    recover: 0.15,
    target: 0.85,
    through: 0.1,
    drive: 0.045,
  },
  knee: {
    label: 'Knee',
    limb: 'leg',
    side: 'rear',
    surface: 'knee',
    path: 'rising',
    hip: 0.28,
    trunk: -0.3, // the trunk goes AWAY, which is how the pelvis comes through
    windup: 0.2,
    recover: 0.2,
    target: 0.6,
    through: 0.12,
    drive: 0.04,
  },
  teep: {
    label: 'Teep',
    limb: 'leg',
    side: 'lead',
    surface: 'ball',
    path: 'thrust',
    hip: 0.1,
    trunk: -0.2,
    windup: 0.19,
    recover: 0.19,
    target: 0.62,
    through: 0.14,
    drive: 0.02,
  },
  frontKick: {
    label: 'Front kick',
    limb: 'leg',
    side: 'rear',
    surface: 'ball',
    path: 'rising',
    hip: 0.2,
    trunk: -0.14,
    windup: 0.21,
    recover: 0.2,
    target: 0.72,
    through: 0.1,
    drive: 0.025,
  },
  roundhouse: {
    label: 'Roundhouse',
    limb: 'leg',
    side: 'rear',
    surface: 'shin',
    path: 'round',
    hip: 0.72,
    trunk: 0.5,
    windup: 0.26,
    recover: 0.26,
    target: 0.8,
    through: 0.22,
    drive: 0.03,
  },
  sideKick: {
    label: 'Side kick',
    limb: 'leg',
    side: 'lead',
    surface: 'heel',
    path: 'thrust',
    hip: 0.45,
    trunk: 0.2,
    windup: 0.27,
    recover: 0.25,
    target: 0.66,
    through: 0.16,
    drive: 0.02,
  },
};

export const STRIKE_NAMES = Object.keys(STRIKES) as StrikeName[];

/**
 * How far this body can hit with this strike, from the centre of its stance,
 * in metres.
 *
 * Geometry, not a range band. The striking surface starts at the shoulder (or
 * the hip), travels out along the limb's own segments, and the trunk rotation
 * carries the shoulder forward on top of that. A tall fighter genuinely
 * out-ranges a short one and nothing had to be told so.
 */
export function strikeReach(rig: HumanoidRig, name: StrikeName): number {
  const spec = STRIKES[name];
  const g = limbGeometry(rig, spec);
  // Exact, not a proportion. The surface can be at most `limb` from the joint
  // it hangs off; the target sits on the body's own forward axis at the
  // strike's height. Solve for how far forward that target can be:
  //
  //   (R - rootZ)^2 = limb^2 - rootX^2 - (targetY - rootY)^2
  //
  // which is why a head kick reaches less than a body kick off the same leg —
  // the rise eats the budget — and why a cross reaches further than a jab:
  // turning the trunk swings the shoulder forward and squares it up, cutting
  // `rootX` and adding to `rootZ` at the same time.
  // An arm's root is carried forward by the THORAX turning; a leg's by the
  // pelvis. Asking the wrong one is how a roundhouse claims a jab's reach.
  const turn = Math.abs(spec.limb === 'arm' ? spec.trunk : spec.hip);
  const rootX = g.x * Math.cos(turn);
  const rootZ = g.z + g.x * Math.sin(turn);
  const rise = spec.target * rig.height - g.y;
  const limb = g.span * extensionOf(spec);
  const across = limb * limb - rootX * rootX - rise * rise;
  return across <= 0 ? rootZ : rootZ + Math.sqrt(across);
}

/**
 * How much of the limb is straightened at contact, by path.
 *
 * A straight punch lands near full extension; a hook lands with the elbow at
 * something close to a right angle, which is why it reaches so much less than
 * the same arm jabbing; an elbow strike reaches barely past the shoulder.
 */
function extensionOf(spec: StrikeSpec): number {
  // An elbow or a knee has nothing to straighten — the segment that strikes IS
  // the one that swings — so the fractions below, which describe how straight
  // a limb gets, do not apply. It is exactly 1: the joint sits on a sphere of
  // one segment's radius about its root and cannot be anywhere else, which is
  // also why these two have a single range rather than a reach they can throw
  // short into. At 0.95 the declared reach put the target 24 mm inside that
  // sphere, where the joint physically cannot go, and the knee missed by
  // exactly that.
  return spec.surface === 'elbow' || spec.surface === 'knee' ? 1 : EXTENSION[spec.path];
}

const EXTENSION: Record<StrikePath, number> = {
  straight: 0.94,
  thrust: 0.96,
  rising: 0.72,
  hook: 0.62,
  round: 0.78,
};

interface LimbGeometry {
  /** The limb's root joint, in the rig's own frame, at rest. */
  x: number;
  y: number;
  z: number;
  /** Root-to-surface length of the limb, fully extended. */
  span: number;
}

const REST = new WeakMap<HumanoidRig, Map<string, Vector3>>();

/** Where a joint sits in the rig's frame with the body standing at rest. */
function restJoint(rig: HumanoidRig, bone: BoneName, out: Vector3): Vector3 {
  let cache = REST.get(rig);
  if (!cache) REST.set(rig, (cache = new Map()));
  const had = cache.get(bone);
  if (had) return out.copy(had);
  rig.object.updateWorldMatrix(true, true);
  rig.bones[bone].getWorldPosition(out);
  rig.object.worldToLocal(out);
  cache.set(bone, out.clone());
  return out;
}

const V = new Vector3();

function limbGeometry(rig: HumanoidRig, spec: StrikeSpec): LimbGeometry {
  const side = spec.side === 'lead' ? 'Left' : 'Right';
  const bones =
    spec.limb === 'arm'
      ? ([`${side}Arm`, `${side}ForeArm`, `${side}Hand`] as BoneName[])
      : ([`${side}UpLeg`, `${side}Leg`, `${side}Foot`] as BoneName[]);
  let span = 0;
  for (let i = 1; i < bones.length; i++) span += rig.bones[bones[i]].position.length();
  // An elbow or a knee strikes with the middle joint, so the last segment is
  // not in the reach at all.
  if (spec.surface === 'elbow' || spec.surface === 'knee') {
    span -= rig.bones[bones[2]].position.length();
  }
  // ...and a fist or a foot extends past the last joint by its own size.
  else if (spec.limb === 'arm') span += 0.055 * rig.height;
  else span += 0.09 * rig.height;
  restJoint(rig, bones[0], V);
  return { x: Math.abs(V.x), y: V.y, z: V.z, span };
}

// ------------------------------------------------------------- what it says// ------------------------------------------------------------- what it says

/**
 * One landed strike, in the shape a damage system takes.
 *
 * `impulse` is the number. It is `mass × speed`, both measured, in kg·m/s.
 * ANIMA does not know what a hit point is; GAMA's `Health` and `GameFeel` do,
 * and an impulse is what they can convert. The same value drives how long a
 * hit-stop should last, which is a thing worth deriving rather than choosing.
 */
export interface Blow {
  strike: StrikeName;
  surface: StrikeSurface;
  /** World-space contact point — the striking surface at closest approach. */
  at: Vector3;
  /** Unit vector, world space: which way the momentum went. */
  direction: Vector3;
  /** Speed of the striking surface at contact, m/s. Measured. */
  speed: number;
  /** Effective mass behind it, kg. Measured. */
  mass: number;
  /** `mass × speed`, kg·m/s. */
  impulse: number;
  /** `½ × mass × speed²`, joules. */
  energy: number;
  /**
   * Whether the surface actually got to the target, or the strike came up
   * short. A strike thrown from outside its own reach still costs balance and
   * still leaves the guard open; it just does not arrive.
   */
  landed: boolean;
  /** How far the surface finished from the target, metres. 0 when it landed. */
  shortBy: number;
  /** The thrower's balance at contact — see `stability`. */
  balance: number;
}

export type StrikePhase = 'guard' | 'windup' | 'contact' | 'recover' | 'done';

export interface StrikingOptions {
  /** Who is being hit. Any `Object3D` — the handshake is a transform, not a type. */
  target?: Object3D | null;
  /** Playback rate. 1 is the timing in `STRIKES`. */
  tempo?: number;
  /**
   * 0..1. Not a damage multiplier — skill decides how much of the pelvis
   * arrives before the fist does, and therefore how much of the body's mass
   * is behind the strike when it lands. An unskilled fighter arm-punches, and
   * the effective mass falls out lower because it genuinely is.
   */
  skill?: number;
  /** Seconds to blend the upper body in and out. 0 snaps. */
  fade?: number;
  /** Which side leads. Orthodox leads with the left. */
  stance?: 'orthodox' | 'southpaw';
}

/**
 * A body that throws strikes at something, and reports what arrived.
 *
 * Owns the arms outright. Adds to the spine, chest and hips — a fighter is
 * standing in a stance somebody else may have put them in, and `Mood` may be
 * layered over the top, so this gives back last frame's contribution before
 * applying this one. It never touches the legs below the hip except for the
 * kicking leg, which it takes for the duration of a kick and hands straight
 * back.
 */
export class Striking {
  /** What the body is doing right now. */
  phase: StrikePhase = 'guard';
  /** The strike in flight, or null between them. */
  current: StrikeName | null = null;
  /** Balance right now — see `stability`. Published every frame. */
  balance = 1;
  /** Effective mass of the last blow, kg. */
  lastMass = 0;
  /** Speed of the striking surface at the last contact, m/s. */
  lastSpeed = 0;
  /** True once the sequence has finished and the body has been handed back. */
  done = false;

  private readonly rig: HumanoidRig;
  private readonly tempo: number;
  private readonly skill: number;
  private readonly fadeRate: number;
  /** Which side is forward. Read by `measureStrike`. */
  readonly leadSide: 'Left' | 'Right';

  private readonly mass: number;
  private target: Object3D | null;

  private weight = 0;
  private wanted = 0;
  private clock = 0;
  private queue: StrikeName[] = [];
  private restored = false;

  private readonly gave = new Map<BoneName, Quaternion>();
  private readonly blowCbs = new Set<(b: Blow) => void>();
  private readonly idleCbs = new Set<() => void>();

  // Contact is a CLOSEST-APPROACH question, the same lesson `climb` and
  // `dining` each had to learn one contact over. A punch does not stop at the
  // target, it accelerates through it, so the frame with the worst distance
  // is nowhere near the frame that landed.
  private best = Infinity;
  private readonly bestAt = new Vector3();
  private readonly bestDir = new Vector3();
  private bestSpeed = 0;
  private bestMass = 0;
  private bestBalance = 1;
  private struck = false;
  private readonly pathFrom = new Vector3();

  private readonly previous = new Map<string, Vector3>();
  private readonly surfaceWas = new Vector3();
  private readonly surfaceNow = new Vector3();
  private readonly scratch = new Vector3();
  private readonly scratchB = new Vector3();

  constructor(rig: HumanoidRig, options: StrikingOptions = {}) {
    this.rig = rig;
    this.tempo = Math.max(0.05, options.tempo ?? 1);
    this.skill = clamp01(options.skill ?? 0.75);
    const fade = options.fade ?? 0.12;
    this.fadeRate = fade > 0 ? 1 / fade : Infinity;
    this.leadSide = (options.stance ?? 'orthodox') === 'orthodox' ? 'Left' : 'Right';
    // A fighter stands in a guard. Dropping to whatever pose the body was in
    // between punches is the tell that this is a clip player.
    this.wanted = 1;
    this.target = options.target ?? null;
    this.mass = bodyMass(rig);
  }

  /** Body mass this instance is working from, kg. */
  get bodyMass(): number {
    return this.mass;
  }

  /** Queue a strike. They run in order; a combination is just several calls. */
  throwStrike(name: StrikeName): void {
    this.queue.push(name);
    this.done = false;
  }

  /**
   * Drop the guard and hand the body back. Until this is called the fighter
   * stays in their stance between strikes, which is what a fighter does.
   */
  lower(): void {
    this.wanted = 0;
  }

  /** Point at something else. */
  aimAt(target: Object3D | null): void {
    this.target = target;
  }

  onBlow(fn: (b: Blow) => void): () => void {
    this.blowCbs.add(fn);
    return () => this.blowCbs.delete(fn);
  }

  /** Fires when the queue empties and the body is back in its guard. */
  onIdle(fn: () => void): () => void {
    this.idleCbs.add(fn);
    return () => this.idleCbs.delete(fn);
  }

  /** How far this body can hit with a strike, metres. */
  reachOf(name: StrikeName): number {
    return strikeReach(this.rig, name);
  }

  /**
   * Step the fighter.
   *
   * Internally this runs at a FIXED rate whatever `dt` it is handed, and that
   * is not tidiness. The effective mass is a ratio of two finite differences,
   * so it is only as good as the step they are taken over: measured, a cross
   * came out at 11.44 kg on a 20 fps frame, 7.39 at 60 and 6.36 at 480. The
   * published impulse — the number a damage system consumes — would have
   * depended on the frame rate, which is a bug of the kind that makes a game
   * easier to win on a slow machine. It would also have made GAMA's replay
   * non-deterministic.
   */
  update(dt: number): void {
    const total = Math.max(0, dt) * this.tempo;
    // Cap the catch-up so a long frame (a tab coming back, a hitch) cannot
    // spiral: better to lose a little time than to spend a second simulating.
    const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(total / FIXED_STEP)));
    const step = total / steps;
    for (let i = 0; i < steps; i++) this.advance(step);
  }

  private advance(step: number): void {
    this.lastStep = step;
    this.rig.object.updateMatrixWorld(true);
    this.balance = stability(this.rig);

    if (!this.current) {
      const next = this.queue.shift();
      if (next) {
        this.current = next;
        this.clock = 0;
        this.phase = 'windup';
        this.struck = false;
        this.best = Infinity;
        // Where the surface starts, captured ONCE. Re-reading it every frame
        // makes the path's own origin chase the thing travelling along it:
        // the foot moved, so the path moved, so the foot moved further. Kicks
        // came out at 100 m/s.
        this.surface(STRIKES[next], this.pathFrom);
        this.wanted = 1;
      }
    }

    // Blend toward whatever the body should be doing, and give the bones back
    // the moment the weight reaches zero rather than one frame later.
    const target = this.wanted;
    if (this.weight !== target) {
      const d = Math.sign(target - this.weight) * this.fadeRate * step;
      this.weight =
        Math.abs(target - this.weight) <= Math.abs(d) ? target : this.weight + d;
    }

    if (this.current) {
      const spec = STRIKES[this.current];
      const total = spec.windup + spec.recover;
      this.clock += step;
      const t = this.clock / total;
      this.phase = this.clock < spec.windup ? 'windup' : this.clock < total ? 'recover' : 'done';
      this.pose(spec, clamp01(t));
      this.sample(spec);
      // Publish the blow when it LANDS — at the end of the wind-up — not when
      // the whole strike finishes. They are not the same moment: a roundhouse
      // lands at 260 ms and finishes at 520, and anything downstream that has
      // to answer it in real time (a guard deciding whether to slip, a hit
      // reaction, a hit-stop) was being told a quarter of a second late. It is
      // the difference between a defence system and a post-mortem.
      if (!this.struck && this.clock >= spec.windup) this.land(spec);
      if (this.clock >= total) {
        this.finish(spec);
      }
    } else if (this.weight > 0) {
      this.holdGuard();
    } else if (!this.restored) {
      this.restore();
      this.restored = true;
      this.done = true;
      for (const fn of this.idleCbs) fn();
    }
  }

  /**
   * Standing in the guard, between strikes.
   *
   * Both hands up and both feet in the stance — NOT the striking pose at zero
   * progress, which is what this used to be. At zero progress the path has not
   * been captured yet, so the lead arm was being IK'd at the world origin and
   * the fighter idled with one hand hanging down by their knee.
   */
  private holdGuard(): void {
    const w = this.weight;
    if (w <= 0) return;
    this.rig.object.updateMatrixWorld(true);
    this.stance(STRIKES.jab, 0, w);
    this.guardArm('Left', w, 0);
    this.guardArm('Right', w, 0);
  }

  // -------------------------------------------------------------- the pose

  /**
   * Pose the body for `spec` at progress `t` over the whole strike.
   *
   * The kinetic chain is the whole of this. A strike is not an arm moving —
   * it is the pelvis turning, the thorax following it, and the limb arriving
   * last, each peaking after the one before. Get that order wrong and you have
   * an arm punch, which is both the commonest failure in fight animation and,
   * because `effectiveMass` is measured rather than declared, genuinely weaker
   * here. Nothing enforces the weakness; it falls out.
   */
  private pose(spec: StrikeSpec, t: number): void {
    const w = this.weight;
    if (w <= 0) return;

    const windupShare = spec.windup / (spec.windup + spec.recover);
    const u = t <= windupShare ? t / Math.max(1e-6, windupShare) : 1;
    const v = t <= windupShare ? 0 : (t - windupShare) / Math.max(1e-6, 1 - windupShare);

    // How far ahead of the fist the pelvis runs. Skill IS this number: an
    // unskilled fighter fires everything at once and the momentum sum comes
    // out smaller because half the body has already stopped moving by contact.
    const lag = MAX_LAG * this.skill;
    const hipDrive = ramp(u, 1 - 2 * lag);
    const trunkDrive = ramp(u, 1 - lag);
    // NOT eased. `ease` has zero slope at both ends, so a limb driven by it is
    // stationary at full extension — and since that is exactly where contact
    // happens, every strike measured zero speed and therefore zero impulse.
    // A strike accelerates INTO its target and is stopped by it. Squaring
    // gives peak speed at contact, which is the whole point of throwing one.
    const limbDrive = u * u;

    // Extension along the path: out to contact, a little past it, then back.
    const extend =
      v <= 0
        ? limbDrive
        : (1 - ease(v)) + spec.through * Math.sin(Math.PI * clamp01(v / 0.4)) * (1 - ease(v));

    const back = v > 0 ? 1 - ease(v) : 1;
    this.shift(spec, hipDrive * back, w);
    this.driveBase(spec, hipDrive * back, trunkDrive * back, w);
    this.driveLimbs(spec, clamp01(extend), w);
  }

  /**
   * Weight transfer: the pelvis moves toward the target.
   *
   * Additive on `Hips.position`, because the ride height belongs to whatever
   * is driving the legs — `createLocomotionClips` plants the lower foot by
   * writing exactly that field — so this touches only the horizontal and
   * hands back last frame's contribution first.
   */
  private shift(spec: StrikeSpec, amount: number, w: number): void {
    const hips = this.rig.bones.Hips;
    if (!this.hipHeld) {
      this.hipHome.copy(hips.position);
      this.hipHeld = true;
    }
    const want = spec.drive * this.rig.height * amount * w;
    const step = want - this.hipGave;
    hips.position.z += step;
    this.hipGave = want;
  }

  /** Pelvis and thorax — the base of the chain, added rather than imposed. */
  private driveBase(spec: StrikeSpec, hip: number, trunk: number, w: number): void {
    // Which way the body turns depends on which SIDE is striking, not on which
    // side leads. The striking shoulder has to come forward; getting this
    // backwards rotated it away from the target instead, which cost a cross
    // 157 mm of reach it geometrically had.
    const strikeSide = spec.side === 'lead' ? this.leadSide : other(this.leadSide);
    const sign = strikeSide === 'Right' ? -1 : 1;
    this.additive('Hips', Y, -sign * spec.hip * hip * w);
    this.additive('Spine', Y, -sign * spec.trunk * 0.35 * trunk * w);
    this.additive('Chest', Y, -sign * spec.trunk * 0.65 * trunk * w);
    // The head stays on the target rather than being dragged round by the
    // shoulders. A fighter who looks away mid-punch is a fighter who gets
    // countered, and it is the first thing that reads as wrong.
    this.additive('Head', Y, sign * spec.trunk * 0.3 * trunk * w);
  }

  /** Both arms and, for a kick, the kicking leg. */
  private driveLimbs(spec: StrikeSpec, extend: number, w: number): void {
    const rig = this.rig;
    rig.object.updateMatrixWorld(true);
    const strikeSide = spec.side === 'lead' ? this.leadSide : other(this.leadSide);
    const guardSide = other(strikeSide);

    this.stance(spec, extend, w);

    // The guard hand stays up. Always. It is the single most measurable
    // difference between a boxer and a brawler and the gate holds it.
    if (spec.limb === 'arm') {
      this.guardArm(guardSide, w, 0);
      this.strikeArm(spec, strikeSide, extend, w);
    } else {
      this.guardArm(this.leadSide, w, 0.25 * extend);
      this.guardArm(other(this.leadSide), w, 0.25 * extend);
      this.strikeLeg(spec, strikeSide, extend, w);
    }
  }

  private readonly aimPoint = new Vector3();
  private readonly pole = new Vector3();
  private readonly forward = new Vector3();
  private readonly guardHome = new Vector3();
  private readonly extentPoint = new Vector3();
  private readonly velocity = new Vector3();
  private readonly arcA = new Vector3();
  private readonly arcB = new Vector3();

  /** Where this strike is going, in world space. */
  private contactPoint(spec: StrikeSpec, out: Vector3): Vector3 {
    const rig = this.rig;
    const origin = rig.object.getWorldPosition(this.scratch).clone();
    rig.object.getWorldDirection(this.forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-8) this.forward.set(0, 0, 1);
    this.forward.normalize();
    const height = origin.y + spec.target * rig.height;
    if (this.target) {
      this.target.getWorldPosition(out);
      out.y = height;
      return out;
    }
    out.copy(origin).addScaledVector(this.forward, strikeReach(rig, nameOf(spec)));
    out.y = height;
    return out;
  }

  /**
   * Where the path ends: on the target, or at the limit of the reach if the
   * target is further away than the body can hit.
   *
   * It ends ON the target rather than short of it because the limb is driven
   * by `u²`, whose speed is HIGHEST at the end — so the surface arrives at
   * full pace and the follow-through carries it past. An earlier version eased
   * the limb instead, which is stationary at full extension, so every strike
   * measured zero speed at exactly the moment it landed; running the path out
   * to maximum reach was the workaround for that, and it cost the swings their
   * contact: a hook only reaches the centre line at full radius, so a target
   * standing anywhere inside its range was swept past rather than hit.
   */
  private extentFor(spec: StrikeSpec, out: Vector3): Vector3 {
    const rig = this.rig;
    const origin = rig.object.getWorldPosition(this.scratchB).clone();
    const limit = strikeReach(rig, nameOf(spec));
    let range = limit;
    if (this.target) {
      this.target.getWorldPosition(out);
      const away = out.sub(origin);
      away.y = 0;
      range = Math.min(limit, away.length());
    }
    out.copy(origin).addScaledVector(this.forward, range);
    out.y = origin.y + spec.target * rig.height;
    return out;
  }

  /** The stance: lead foot forward, weight between them, knees soft. */
  private stance(spec: StrikeSpec, extend: number, w: number): void {
    const sign = this.leadSide === 'Left' ? 1 : -1;
    const kick = spec.limb === 'leg' ? (spec.side === 'lead' ? this.leadSide : other(this.leadSide)) : null;
    for (const side of ['Left', 'Right'] as const) {
      if (side === kick) continue; // the kicking leg is driven separately
      const isLead = side === this.leadSide;
      // A fighting stance is not a walking pose: the feet are staggered, both
      // knees carry a bend, and the rear heel is up ready to turn over.
      const hip = isLead ? -0.24 : 0.2;
      const knee = isLead ? 0.3 : 0.36;
      this.own(`${side}UpLeg`, X, hip, w);
      this.own(`${side}Leg`, X, knee, w);
      this.own(`${side}Foot`, X, -0.7 * (hip + knee) + (isLead ? 0 : -0.18), w);
      this.additive(`${side}UpLeg`, Y, -sign * 0.12, 0);
    }
  }

  /**
   * A hand held by the face — the guard, and the thing the gate watches most
   * closely after the strike itself. It is stated as a POSITION rather than a
   * pile of joint angles, because "the fist is beside the cheekbone" is what a
   * guard actually is and it has to hold on every body the library can build.
   */
  private guardSpot(side: 'Left' | 'Right', out: Vector3): Vector3 {
    const h = this.rig.height;
    const s = side === 'Left' ? 1 : -1;
    // Staggered, because a guard is. The lead hand is out in front measuring
    // the range; the rear hand is back on the chin, which is where the extra
    // 130 mm of a cross's travel comes from.
    const rear = side !== this.leadSide;
    out.set(s * (rear ? 0.095 : 0.075) * h, 0.805 * h, (rear ? 0.055 : 0.175) * h);
    return this.rig.object.localToWorld(out);
  }

  private guardArm(side: 'Left' | 'Right', w: number, drop: number): void {
    const s = side === 'Left' ? 1 : -1;
    this.guardSpot(side, this.guardHome);
    this.guardHome.y -= drop * 0.09 * this.rig.height;
    this.pole.set(0, -1, 0).addScaledVector(X, s * 0.25);
    this.pole.normalize();
    this.reachChain(`${side}Arm`, `${side}ForeArm`, `${side}Hand`, this.guardHome, this.pole, w);
  }

  /**
   * The striking arm, IK'd to a point on its own path.
   *
   * The path is what separates the strikes that share an arm. A jab runs down
   * the line; a hook leaves it sideways and comes back; an uppercut drops and
   * rises. The arc is not decoration — it is why the same arm carries more
   * momentum through a hook than a jab, because the shoulder is turning
   * through more of it.
   */
  private strikeArm(spec: StrikeSpec, side: 'Left' | 'Right', extend: number, w: number): void {
    const rig = this.rig;
    rig.object.updateMatrixWorld(true);
    this.contactPoint(spec, this.aimPoint);
    this.extentFor(spec, this.extentPoint);
    this.pathPoint(spec, side, this.pathFrom, this.extentPoint, extend, this.scratch);
    const s = side === 'Left' ? 1 : -1;
    // The elbow hangs below and behind the line for a straight punch, and
    // swings out for a hook — the pole vector IS the difference between them.
    this.pole.set(0, -1, 0).addScaledVector(this.forward, -0.4);
    if (spec.path === 'hook' || spec.path === 'round') this.pole.addScaledVector(X, s * 0.9);
    if (spec.path === 'rising') this.pole.set(0, -1, 0).addScaledVector(this.forward, 0.5);
    this.pole.normalize();
    if (spec.surface === 'elbow') {
      this.reachJoint(`${side}Arm`, `${side}ForeArm`, this.scratch, w);
      this.own(`${side}ForeArm`, Y, -s * 2.5, w);
    } else {
      this.reachChain(`${side}Arm`, `${side}ForeArm`, `${side}Hand`, this.scratch, this.pole, w);
    }
  }

  /** The kicking leg. Same machinery; a longer, heavier limb. */
  private strikeLeg(spec: StrikeSpec, side: 'Left' | 'Right', extend: number, w: number): void {
    const rig = this.rig;
    rig.object.updateMatrixWorld(true);
    this.contactPoint(spec, this.aimPoint);
    this.extentFor(spec, this.extentPoint);
    this.pathPoint(spec, side, this.pathFrom, this.extentPoint, extend, this.scratch);
    const s = side === 'Left' ? 1 : -1;
    this.pole.copy(this.forward).multiplyScalar(1).addScaledVector(Y, -0.15);
    if (spec.path === 'round') this.pole.addScaledVector(X, s * 0.8);
    this.pole.normalize();
    if (spec.surface === 'knee') {
      this.reachJoint(`${side}UpLeg`, `${side}Leg`, this.scratch, w);
      this.own(`${side}Leg`, X, 2.2, w);
    } else {
      // A shin strikes three quarters of the way down the shank, not with the
      // ankle — so the FOOT has to go further than the point being aimed at,
      // or the shin lands a quarter of a shank short. Measured: 11 mm past the
      // contact tolerance on a roundhouse that looked like it had connected.
      if (spec.surface === 'shin') {
        rig.bones[`${side}Leg`].getWorldPosition(this.vc);
        const over = this.va.subVectors(this.scratch, this.vc);
        if (over.lengthSq() > 1e-8) {
          over.setLength(0.25 * rig.bones[`${side}Foot`].position.length());
          this.scratch.add(over);
        }
      }
      this.reachChain(`${side}UpLeg`, `${side}Leg`, `${side}Foot`, this.scratch, this.pole, w);
    }
  }

  /**
   * Where the striking surface should be at `extend` along its path.
   *
   * `extend` is 0 at the guard and 1 at contact; past 1 is the follow-through.
   * The arc terms are perpendicular to the line and vanish at both ends, so
   * every path starts and finishes exactly where a straight one would.
   */
  private pathPoint(
    spec: StrikeSpec,
    side: 'Left' | 'Right',
    from: Vector3,
    to: Vector3,
    extend: number,
    out: Vector3
  ): Vector3 {
    const rig = this.rig;
    const e = clamp01(extend);
    if (spec.path === 'hook' || spec.path === 'round') {
      // A hook is a SWING, and a swing is not a straight line with a bulge on
      // it. Interpolating in cylindrical coordinates about the body's own
      // vertical axis is what a hook is: the fist keeps its radius and sweeps
      // its bearing round to the target, so at contact it is travelling
      // ACROSS rather than along — which is the whole difference between a
      // hook and a jab, and the thing a lerp cannot express.
      //
      // Doing it as a lerp plus a `sin` bulge put the arc's steepest slope at
      // the moment of contact, and the fist arrived with a metre per second of
      // sideways velocity that had nothing to do with the punch.
      const a = rig.object.worldToLocal(this.arcA.copy(from));
      const b = rig.object.worldToLocal(this.arcB.copy(to));
      const s = side === 'Left' ? 1 : -1;
      const ra = Math.hypot(a.x, a.z);
      const rb = Math.hypot(b.x, b.z);
      // The chamber: a hook starts wide, so the swing begins further round
      // than the guard sits. Authored, and the only authored thing here.
      const ta = Math.atan2(a.x, a.z) + s * CHAMBER;
      const tb = Math.atan2(b.x, b.z);
      const r = ra + (rb - ra) * e;
      const th = ta + (tb - ta) * e;
      out.set(r * Math.sin(th), a.y + (b.y - a.y) * e, r * Math.cos(th));
      if (spec.path === 'round') out.y += 0.18 * Math.sin(Math.PI * e) * Math.abs(b.y - a.y);
      return rig.object.localToWorld(out);
    }
    out.copy(from).lerp(to, e);
    // An elbow or a knee is pinned to a sphere of one segment's radius about
    // its root, so a path point off that sphere changes only the DIRECTION the
    // joint is aimed along — and a chamber that dips below the hip swings that
    // direction through a huge angle for nothing. Measured, it whipped a knee
    // joint across 140 mm in a single frame at 240 fps: 33 m/s, on a joint
    // that travels 600 mm in total.
    if (spec.surface === 'elbow' || spec.surface === 'knee') return out;
    // A chamber or a dip, and both have to VANISH at contact: `sin` does not —
    // its slope is steepest at the ends — and a front kick arrived carrying
    // 12 m/s of pure detour. `sin²` is flat at both ends, so the surface is
    // back on its own line, travelling along it, by the time it lands.
    const bulge = Math.sin(Math.PI * e) ** 2 * from.distanceTo(to);
    if (spec.path === 'rising') {
      // Which way a rising strike leaves the line depends on WHICH LIMB. An
      // uppercut drops the fist and comes up under; a front kick chambers the
      // knee UP and the foot back before it goes out. Sharing the arm's sign
      // sent the kicking foot half a metre below its own chord and back, and
      // the foot crossed 122 mm in a single frame at 240 fps doing it.
      const dip = spec.limb === 'arm' ? -0.36 : 0.2;
      out.addScaledVector(Y, dip * bulge).addScaledVector(this.forward, -0.16 * bulge);
    } else if (spec.path === 'thrust') {
      out.addScaledVector(Y, 0.3 * bulge).addScaledVector(this.forward, -0.26 * bulge);
    }
    return out;
  }

  // ---------------------------------------------------------------- the IK

  private readonly qa = new Quaternion();
  private readonly qb = new Quaternion();
  private readonly va = new Vector3();
  private readonly vb = new Vector3();
  private readonly vc = new Vector3();

  /**
   * Two-link IK: put the tip of a limb on a point, with the middle joint
   * bending toward `pole`.
   *
   * The rig's limbs do not share an axis — arms run along ±X out of the
   * shoulder and legs along −Y out of the hip — so the rest direction is read
   * off the bone offsets rather than assumed. Assuming it is how you get an
   * arm that works and a leg that folds inside out.
   */
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
    // Law of cosines for the angle between the limb's upper segment and the
    // straight line to the target.
    const cosA = clamp((upper * upper + span * span - lower * lower) / (2 * upper * span), -1, 1);
    const a = Math.acos(cosA);
    // Component of the pole perpendicular to the line — the plane to bend in.
    const perp = P.copy(pole).addScaledVector(to, -pole.dot(to));
    if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0).addScaledVector(to, -to.y * -1);
    perp.normalize();
    const upperDir = Q.copy(to).multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a));
    this.point(root, axis, upperDir, w);
    // Where the middle joint ends up, computed rather than read: the bone's
    // matrixWorld is a frame stale until the whole hierarchy is updated, and
    // aiming the forearm at a target from last frame's elbow is how a limb
    // ends up chasing itself.
    this.vb.addScaledVector(upperDir, upper);
    const lowerDir = Q.subVectors(target, this.vb).normalize();
    this.point(mid, axis, lowerDir, w);
  }

  /** One link: put the MIDDLE joint on a point. Elbows and knees strike with it. */
  private reachJoint(root: BoneName, mid: BoneName, target: Vector3, w: number): void {
    const rig = this.rig;
    const axis = this.va.copy(rig.bones[mid].position).normalize();
    rig.bones[root].getWorldPosition(this.vb);
    const dir = this.vc.subVectors(target, this.vb).normalize();
    this.point(root, axis, dir, w);
  }

  /** Rotate one bone so its own rest axis points along a world direction. */
  private point(bone: BoneName, axis: Vector3, worldDir: Vector3, w: number): void {
    const b = this.rig.bones[bone];
    this.remember(bone);
    const parent = b.parent;
    this.qa.identity();
    if (parent) parent.getWorldQuaternion(this.qa);
    this.qa.invert();
    const local = P.copy(worldDir).applyQuaternion(this.qa).normalize();
    this.qb.setFromUnitVectors(axis, local);
    b.quaternion.slerp(this.qb, clamp01(w));
  }

  // ------------------------------------------------------- owning the bones

  private readonly entry = new Map<BoneName, Quaternion>();

  /**
   * What a bone looked like before this module first touched it.
   *
   * The additive bones hand back their own contribution, which is enough for
   * them. A bone taken OUTRIGHT cannot: it has been overwritten, so the only
   * way to give it back is to have kept a copy. Without this the arms simply
   * stayed where the last punch left them, for ever, and `lower()` was a lie.
   */
  private remember(bone: BoneName): void {
    if (!this.entry.has(bone)) this.entry.set(bone, this.rig.bones[bone].quaternion.clone());
  }
  private readonly hipHome = new Vector3();
  private hipHeld = false;
  private hipGave = 0;

  /**
   * A bone this module takes outright. The arms during a punch, and the
   * kicking leg during a kick — nothing else has anything useful to say about
   * where a fist goes.
   */
  private own(
    bone: BoneName,
    axis: Vector3,
    angle: number,
    w: number,
    axis2?: Vector3,
    angle2 = 0
  ): void {
    const b = this.rig.bones[bone];
    this.remember(bone);
    this.qb.setFromAxisAngle(axis, angle);
    if (axis2) this.qb.multiply(this.qa.setFromAxisAngle(axis2, angle2));
    b.quaternion.slerp(this.qb, clamp01(w));
  }

  /**
   * A bone this module only ADDS to. The pelvis, spine, chest and head belong
   * to whatever put the body in its stance — `Locomotion`, `Interaction`'s
   * sit, a `Mood` layer — so last frame's contribution is handed back before
   * this frame's goes on. Take them outright and a frightened fighter stops
   * being frightened the moment they throw a punch.
   */
  private additive(bone: BoneName, axis: Vector3, angle: number, w = 1): void {
    const b = this.rig.bones[bone];
    const had = this.gave.get(bone);
    if (had) b.quaternion.multiply(had.invert());
    this.qb.setFromAxisAngle(axis, angle * w);
    b.quaternion.multiply(this.qb);
    this.gave.set(bone, this.qb.clone());
  }

  /** Hand every bone back exactly as it was found. */
  private restore(): void {
    for (const [name, q] of this.gave) {
      this.rig.bones[name].quaternion.multiply(q.invert());
    }
    this.gave.clear();
    for (const [name, q] of this.entry) this.rig.bones[name].quaternion.copy(q);
    this.entry.clear();
    if (this.hipHeld) {
      this.rig.bones.Hips.position.z -= this.hipGave;
      this.hipGave = 0;
    }
  }

  // ------------------------------------------------------- the measurement

  /** Where the striking surface is, in world space, right now. */
  private surface(spec: StrikeSpec, out: Vector3): Vector3 {
    const rig = this.rig;
    const side = spec.side === 'lead' ? this.leadSide : other(this.leadSide);
    switch (spec.surface) {
      case 'elbow':
        return rig.bones[`${side}ForeArm`].getWorldPosition(out);
      case 'knee':
        return rig.bones[`${side}Leg`].getWorldPosition(out);
      case 'shin': {
        rig.bones[`${side}Leg`].getWorldPosition(out);
        rig.bones[`${side}Foot`].getWorldPosition(P);
        return out.lerp(P, 0.75);
      }
      case 'ball':
      case 'heel':
      case 'instep':
        return rig.bones[`${side}Foot`].getWorldPosition(out);
      default:
        return rig.bones[`${side}Hand`].getWorldPosition(out);
    }
  }

  /**
   * Read the frame: how fast the surface is going, how much of the body is
   * going with it, and how close it got.
   *
   * Contact is a CLOSEST-APPROACH question. A strike does not stop at the
   * target — it accelerates through it — so the worst frame is on the far
   * side and the frame with the largest gap is the follow-through. `climb`
   * learned this on a rung and `dining` re-learned it on a plate; a punch is
   * the same lesson pointing the other way.
   */
  private sample(spec: StrikeSpec): void {
    const dt = this.lastStep;
    if (dt <= 0) return;
    const rig = this.rig;
    rig.object.updateMatrixWorld(true);

    this.surfaceWas.copy(this.surfaceNow);
    this.surface(spec, this.surfaceNow);
    const first = !this.previous.has('#surface');
    if (first) {
      this.previous.set('#surface', this.surfaceNow.clone());
      for (let i = 0; i < MASSES.length; i++) {
        this.previous.set(String(i), segmentPoint(rig, MASSES[i], new Vector3()).clone());
      }
      return;
    }

    const was = this.previous.get('#surface')!;
    const vel = this.velocity.subVectors(this.surfaceNow, was).divideScalar(dt);
    const speed = vel.length();
    was.copy(this.surfaceNow);

    this.contactPoint(spec, this.aimPoint);
    const gap = this.surfaceNow.distanceTo(this.aimPoint);

    // Effective mass: the momentum of the whole body along the strike line,
    // over the speed of the thing doing the striking. Nothing here is chosen.
    const dir = this.scratchB.copy(vel);
    let mass = 0;
    if (speed > 1e-4) {
      dir.divideScalar(speed);
      let momentum = 0;
      for (let i = 0; i < MASSES.length; i++) {
        const prev = this.previous.get(String(i))!;
        segmentPoint(rig, MASSES[i], P);
        const along = P.clone().sub(prev).divideScalar(dt).dot(dir);
        // Only what is travelling INTO the target counts. Half a body always
        // moves the other way in a strike — the hikite pulling back, the head
        // slipping off the centre line, the hips squaring after a side kick —
        // and that momentum is balanced by the floor, not delivered to
        // anybody. Summing it signed made a side kick weigh nothing at all.
        if (along > 0) momentum += MASSES[i].mass * this.mass * along;
        prev.copy(P);
      }
      mass = momentum / speed;
    } else {
      for (let i = 0; i < MASSES.length; i++) {
        segmentPoint(rig, MASSES[i], P);
        this.previous.get(String(i))!.copy(P);
      }
    }

    // Only on the way OUT. A fist that is being pulled back cannot hit
    // anybody, and because a strike passes THROUGH its target the return trip
    // crosses the same distance again — more slowly, and with the body
    // already stopping. Taking the closest approach over the whole strike
    // found that second crossing about as often as the first, and every time
    // it did, the impulse came out near zero on a punch that had visibly
    // landed. Stop at the first turn-around.
    if (this.phase === 'windup') {
      if (gap < this.best) {
        this.best = gap;
        this.bestAt.copy(this.surfaceNow);
        this.bestDir.copy(dir);
        this.bestSpeed = speed;
        this.bestMass = mass;
        this.bestBalance = this.balance;
      }
    }
  }

  private lastStep = 0;

  /** Contact. Everything the blow needs was measured on the way out. */
  private land(spec: StrikeSpec): void {
    if (!this.struck) {
      this.struck = true;
      const tolerance = CONTACT * this.rig.height;
      const blow: Blow = {
        strike: nameOf(spec),
        surface: spec.surface,
        at: this.bestAt.clone(),
        direction: this.bestDir.clone(),
        speed: this.bestSpeed,
        mass: this.bestMass,
        impulse: this.bestMass * this.bestSpeed,
        energy: 0.5 * this.bestMass * this.bestSpeed * this.bestSpeed,
        landed: this.best <= tolerance,
        shortBy: Math.max(0, this.best - tolerance),
        balance: this.bestBalance,
      };
      this.lastMass = blow.mass;
      this.lastSpeed = blow.speed;
      for (const fn of this.blowCbs) fn(blow);
    }
  }

  /** The strike is over: clear the slate for the next one. */
  private finish(spec: StrikeSpec): void {
    this.land(spec);
    this.current = null;
    this.phase = this.queue.length ? 'windup' : 'guard';
    this.previous.clear();
  }
}

/**
 * How close the surface has to get to count as landed, as a fraction of body
 * height. A fist is about this wide, and a hit that misses by less than the
 * width of the thing that threw it is a hit.
 */
const CONTACT = 0.06;

/**
 * The most the pelvis can lead the fist by, as a fraction of the wind-up.
 *
 * Proximal-to-distal sequencing: in a measured strike the hip peaks, then the
 * thorax, then the shoulder, then the fist, each a few tens of milliseconds
 * after the last. `skill` scales this from nothing — everything at once, which
 * is what an untrained arm punch looks like AND what it measures — to the full
 * separation.
 */
const MAX_LAG = 0.22;

/**
 * The internal step, seconds. A strike is about 150 ms long and its numbers
 * converge by around here — 120 Hz lands within 4% of what 480 Hz says, and
 * 60 Hz does not.
 */
const FIXED_STEP = 1 / 120;

/** Ceiling on catch-up per call, so one long frame cannot stall a scene. */
const MAX_SUBSTEPS = 8;

/**
 * How far round from the guard a swinging strike chambers before it comes
 * back, radians. A hook that starts where the guard sits sweeps 30 degrees;
 * a real one sweeps closer to 90.
 */
const CHAMBER = 0.95;

const other = (s: 'Left' | 'Right'): 'Left' | 'Right' => (s === 'Left' ? 'Right' : 'Left');

const NAME_OF = new Map<StrikeSpec, StrikeName>(
  (Object.keys(STRIKES) as StrikeName[]).map((n) => [STRIKES[n], n])
);
const nameOf = (spec: StrikeSpec): StrikeName => NAME_OF.get(spec)!;

// ------------------------------------------------------------- the measure

export interface StrikeOptions extends StrikingOptions {
  /** How far in front the target stands, metres. Default: inside reach. */
  distance?: number;
  /** Frames per second to step at. Default 240 — a punch is 150 ms long. */
  fps?: number;
}

export interface StrikeReport {
  strike: StrikeName;
  /** Effective mass at contact, kg. */
  mass: number;
  /** ...and as a fraction of the thrower's body mass, which is the honest way
   * to compare a heavyweight's jab with a flyweight's. */
  massFraction: number;
  /** Surface speed at contact, m/s. */
  speed: number;
  /** kg·m/s. */
  impulse: number;
  /** Joules. */
  energy: number;
  /** Closest approach to the target, metres. */
  gap: number;
  landed: boolean;
  /** Lowest balance reached during the strike — the commitment cost. */
  worstBalance: number;
  /** Seconds from contact until the guard is back where it started. */
  recovery: number;
  /** Metres the guard hand drifted from where it should have stayed. */
  guardDrift: number;
  /**
   * When each link of the chain reached its own peak speed, in seconds from
   * the start of the strike: pelvis, thorax, shoulder, surface.
   *
   * The order is the whole test. Proximal to distal, or it is an arm punch.
   */
  chain: { hips: number; chest: number; shoulder: number; surface: number };
  /** The chain's peak speeds, m/s, in the same order. */
  chainSpeed: { hips: number; chest: number; shoulder: number; surface: number };
  /** Largest single-frame movement of the surface, metres. Pops show here. */
  worstStep: number;
}

/**
 * Throw one strike at a dummy and report everything measurable about it.
 *
 * Drives the real controller over a real rig — no second copy of the maths.
 * The strike gate is built on this, and so is every claim in the docs.
 */
export function measureStrike(
  rig: HumanoidRig,
  name: StrikeName,
  options: StrikeOptions = {}
): StrikeReport {
  const spec = STRIKES[name];
  const fps = options.fps ?? 240;
  const dt = 1 / fps;
  const dummy = new Object3D();
  // An elbow and a knee have ONE range — the striking joint sits on a sphere
  // of one segment's radius about its root and cannot be nearer — so a test
  // that stands them inside it is asking for something anatomy forbids.
  // Everything else is thrown from just inside its reach, which is where a
  // fighter throws from.
  const fixed = spec.surface === 'elbow' || spec.surface === 'knee';
  const distance = options.distance ?? strikeReach(rig, name) * (fixed ? 1 : 0.92);
  rig.object.updateMatrixWorld(true);
  const origin = rig.object.getWorldPosition(new Vector3());
  const ahead = rig.object.getWorldDirection(new Vector3());
  ahead.y = 0;
  if (ahead.lengthSq() < 1e-8) ahead.set(0, 0, 1);
  ahead.normalize();
  dummy.position.copy(origin).addScaledVector(ahead, distance);
  dummy.position.y = origin.y + spec.target * rig.height;
  dummy.updateMatrixWorld(true);

  const guardSide = spec.limb === 'arm' ? (spec.side === 'lead' ? 'Right' : 'Left') : 'Left';
  const striker = new Striking(rig, { ...options, target: dummy, fade: options.fade ?? 0 });

  const landed: Blow[] = [];
  let contactAt = -1;
  striker.onBlow((b) => landed.push(b));

  // Four points along the chain that all TRANSLATE, measured the same way.
  //
  // Two earlier attempts measured the wrong thing. `Hips` is the root bone and
  // never moves at all, so its "peak" landed on frame one every time; and the
  // striking arm's angular rate is whatever the IK is doing, which spikes
  // early while the limb is still settling out of the guard. Joint POSITIONS
  // along the chain are unambiguous: the hip is carried by the weight
  // transfer, the shoulder by the trunk turning, the elbow by the shoulder,
  // and the fist last. Proximal to distal, or it is an arm punch.
  const strikeSide = spec.side === 'lead' ? striker.leadSide : other(striker.leadSide);
  const probes = (
    spec.limb === 'arm'
      ? [`${strikeSide}UpLeg`, `${strikeSide}Arm`, `${strikeSide}ForeArm`]
      : [`${strikeSide}UpLeg`, `${strikeSide}Leg`, `${strikeSide}Foot`]
  ) as BoneName[];
  const last = new Map<string, Vector3>();
  const peak = new Map<string, { speed: number; at: number }>();
  const here = new Vector3();
  let worstBalance = Infinity;
  let worstStep = 0;
  let guardDrift = 0;
  let guardHome: Vector3 | null = null;
  let recovery = 0;
  const surfaceLast = new Vector3();
  let surfaceHas = false;

  // Settle into the guard first. With `fade: 0` the body snaps from its rest
  // pose into a stance on frame one, and that single step is faster than
  // anything in the strike — it landed on top of every chain reading as a
  // 4 ms "peak" for the pelvis and the thorax, which is the fade-in, not the
  // punch.
  for (let i = 0; i < Math.round(0.25 * fps); i++) striker.update(dt);
  striker.throwStrike(name);
  const total = (spec.windup + spec.recover) / (options.tempo ?? 1);
  for (let t = 0; t <= total + 0.4; t += dt) {
    striker.update(dt);
    rig.object.updateMatrixWorld(true);
    worstBalance = Math.min(worstBalance, striker.balance);

    // The chain, link by link, measured as LINEAR speed of each joint — not
    // the angle curves the poser drives. Two different things, and the order
    // between them is what a gate can hold.
    for (const bone of probes) {
      rig.bones[bone].getWorldPosition(here);
      const prev = last.get(bone);
      if (prev) {
        const v = here.distanceTo(prev) / dt;
        const best = peak.get(bone);
        if (!best || v > best.speed) peak.set(bone, { speed: v, at: t });
        prev.copy(here);
      } else last.set(bone, here.clone());
    }
    const surf = surfaceOf(rig, spec, striker);
    if (surfaceHas) {
      const step = surf.distanceTo(surfaceLast);
      worstStep = Math.max(worstStep, step);
      const v = step / dt;
      const best = peak.get('#surface');
      if (!best || v > best.speed) peak.set('#surface', { speed: v, at: t });
    }
    surfaceLast.copy(surf);
    surfaceHas = true;

    // The guard hand: where it was at rest, and how far it wandered.
    rig.bones[`${guardSide}Hand`].getWorldPosition(here);
    if (!guardHome) guardHome = here.clone();
    else guardDrift = Math.max(guardDrift, here.distanceTo(guardHome));

    if (landed.length && contactAt < 0) contactAt = t;
    if (contactAt >= 0 && striker.phase === 'guard') {
      recovery = t - contactAt;
      break;
    }
  }

  const b: Blow | undefined = landed[0];
  const mass = b ? b.mass : 0;
  const speed = b ? b.speed : 0;
  return {
    strike: name,
    mass,
    massFraction: mass / bodyMass(rig),
    speed,
    impulse: b ? b.impulse : 0,
    energy: b ? b.energy : 0,
    gap: b ? b.shortBy : Infinity,
    landed: b ? b.landed : false,
    worstBalance,
    recovery,
    guardDrift,
    chain: {
      hips: peak.get(probes[0])?.at ?? 0,
      chest: peak.get(probes[1])?.at ?? 0,
      shoulder: peak.get(probes[2])?.at ?? 0,
      surface: peak.get('#surface')?.at ?? 0,
    },
    chainSpeed: {
      hips: peak.get(probes[0])?.speed ?? 0,
      chest: peak.get(probes[1])?.speed ?? 0,
      shoulder: peak.get(probes[2])?.speed ?? 0,
      surface: peak.get('#surface')?.speed ?? 0,
    },
    worstStep,
  };
}

const SURF = new Vector3();
function surfaceOf(rig: HumanoidRig, spec: StrikeSpec, striker: Striking): Vector3 {
  const side = spec.side === 'lead' ? striker.leadSide : other(striker.leadSide);
  switch (spec.surface) {
    case 'elbow':
      return rig.bones[`${side}ForeArm`].getWorldPosition(SURF);
    case 'knee':
      return rig.bones[`${side}Leg`].getWorldPosition(SURF);
    case 'shin': {
      rig.bones[`${side}Leg`].getWorldPosition(SURF);
      const foot = rig.bones[`${side}Foot`].getWorldPosition(new Vector3());
      return SURF.lerp(foot, 0.75);
    }
    case 'ball':
    case 'heel':
    case 'instep':
      return rig.bones[`${side}Foot`].getWorldPosition(SURF);
    default:
      return rig.bones[`${side}Hand`].getWorldPosition(SURF);
  }
}
