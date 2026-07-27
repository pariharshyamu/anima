import { Quaternion, Vector3 } from 'three';
import { BONE_NAMES, type BoneName, type HumanoidRig } from './humanoid';

/**
 * Yoga — the first motion in this library whose content is the HOLD.
 *
 * Everything in `Dance` is a function of count: the clock is a tempo, energy
 * arrives off the bass, and the interest lives *between* the beats. An asana
 * inverts all three. The clock is **breath** — ten times slower than any
 * dance, and a sine rather than a tick: breath has no beat edge, it has a
 * turning point. The content is the pose itself, held; the transitions are
 * connective tissue. And the energy is inward — nothing arrives from outside
 * at all.
 *
 * ```ts
 * const asana = new Asana(rig, { seed: 7 });
 * asana.strike('downwardDog');
 * game.onUpdate((t) => asana.update(t.delta));
 * ```
 *
 * ## A pose is one frame, held alive
 *
 * A held pose with literally zero motion reads as a mannequin glitch. Real
 * holding has three small signals, and they are the whole craft here:
 *
 * - **the settle** — the body finds the last five percent of a pose slowly.
 *   The chase toward a struck pose is exponential, so the first second does
 *   most of the work and the tail takes its time, the way weight actually
 *   arrives in a shape;
 * - **the breath** — the chest lifts and the shoulders rise on a slow sine,
 *   and the whole body bobs a few millimetres with it. Poses breathe into
 *   different places: cobra into the chest, child's pose into the back,
 *   savasana into the belly;
 * - **the sway** — balance is a verb. Seeded, slow, sum-of-sines corrections
 *   run through the hips, small on two feet, three times larger on one
 *   (tree pose visibly *works*), and absent entirely lying down — a body on
 *   the floor has nothing to balance.
 *
 * ## The root is part of the pose
 *
 * Standing poses never leave the feet, but most of a sun salutation lives on
 * the floor: folds, lunges, planks, prone backbends, the inverted V. So an
 * `AsanaSpec` owns the **root** as well as the bones — a hip height (as a
 * fraction of standing) and a whole-body pitch — and every pose declares its
 * `support` (feet, hands-and-feet, kneeling, seated, prone, supine). This is
 * the library's first floor-support machinery, and everything later that
 * touches the ground — flows, floorwork, breaking's downrock — stands on it.
 *
 * ## `strikePose` — the single-frame API
 *
 * Not every posed body needs a clock. `strikePose(rig, 'treePose')` applies
 * an asana instantly — for screenshots, thumbnails, and statues: pose a rig,
 * park it on a pedestal, and a garden has a stone Natarajasana without SCENA
 * and ANIMA ever importing each other.
 */

export type AsanaName =
  /** Tadasana — standing tall, arms at the sides. Where practice starts. */
  | 'mountain'
  /** Pranamasana — standing, palms together at the sternum. */
  | 'prayer'
  /** Hasta Uttanasana — arms overhead, a slight reach back. */
  | 'upwardSalute'
  /** Uttanasana — folded at the hips, torso hanging, hands toward the floor. */
  | 'forwardFold'
  /** Ashwa Sanchalanasana — left foot forward and bent, right leg back. */
  | 'lowLunge'
  /** Phalakasana — one straight line from head to heels, on hands and toes. */
  | 'plank'
  /** Ashtanga Namaskara — knees, chest and chin down; hips riding high. */
  | 'eightLimbed'
  /** Bhujangasana — prone, chest peeled up, gaze forward. */
  | 'cobra'
  /** Adho Mukha Svanasana — the inverted V; hips are the apex. */
  | 'downwardDog'
  /** Vrikshasana — one leg, foot to inner thigh, arms overhead. Balance. */
  | 'tree'
  /** Virabhadrasana II — wide stance, front knee bent, arms out flat. */
  | 'warrior2'
  /** Trikonasana — wide stance, torso hinged sideways, one arm to the sky. */
  | 'triangle'
  /** Balasana — kneeling, folded over the thighs, arms long. Rest. */
  | 'child'
  /** Padmasana — seated, legs folded in, spine tall, hands on knees. */
  | 'lotus'
  /** Savasana — flat on the back, everything surrendered. */
  | 'corpse';

/** What holds the body up. The floor-contact contract of each pose. */
export type AsanaSupport =
  | 'feet'
  | 'handsFeet'
  | 'kneeling'
  | 'seated'
  | 'prone'
  | 'supine';

type AxisName = 'X' | 'Y' | 'Z';

export interface AsanaSpec {
  /** The classical name. */
  sanskrit: string;
  /**
   * Per-bone rotations as ordered axis–angle pairs (radians), applied in
   * sequence like `Dance`'s shapes. Unlisted bones return to rest.
   */
  bones: Partial<Record<BoneName, Array<[AxisName, number]>>>;
  /**
   * The root: `height` is hip height as a fraction of the standing hip
   * height; `pitch` rotates the whole body about X (positive pitches the
   * face toward the floor — π/2 is prone-horizontal).
   */
  root: { height: number; pitch: number };
  support: AsanaSupport;
  /** One-legged (or otherwise precarious): the sway machinery works harder. */
  balance?: boolean;
  /** Where the breath visibly goes. Default `'chest'`. */
  breath?: 'chest' | 'belly' | 'back';
}

export const ASANAS: Record<AsanaName, AsanaSpec> = {
  mountain: {
    sanskrit: 'Tadasana',
    root: { height: 1.0, pitch: 0 },
    support: 'feet',
    bones: {
      LeftArm: [['Z', -1.38]],
      RightArm: [['Z', 1.38]],
      Chest: [['X', -0.04]],
      Head: [['X', -0.02]],
    },
  },
  prayer: {
    sanskrit: 'Pranamasana',
    root: { height: 1.0, pitch: 0 },
    support: 'feet',
    bones: {
      LeftArm: [['Z', -1.3], ['Y', -0.6]],
      LeftForeArm: [['Z', -2.0], ['Y', -0.48]],
      RightArm: [['Z', 1.3], ['Y', 0.6]],
      RightForeArm: [['Z', 2.0], ['Y', 0.48]],
      Head: [['X', 0.12]],
      Chest: [['X', -0.02]],
    },
  },
  upwardSalute: {
    sanskrit: 'Hasta Uttanasana',
    root: { height: 1.0, pitch: -0.06 },
    support: 'feet',
    bones: {
      LeftArm: [['Z', 1.42], ['Y', -0.12]],
      RightArm: [['Z', -1.42], ['Y', 0.12]],
      Spine: [['X', -0.1]],
      Chest: [['X', -0.16]],
      Head: [['X', -0.22]],
    },
  },
  forwardFold: {
    sanskrit: 'Uttanasana',
    root: { height: 0.95, pitch: 2.0 },
    support: 'feet',
    bones: {
      // Legs counter the whole-body pitch exactly, so they stay a plumb line
      // while the torso hangs — a fold is a hinge at the hips, nothing else.
      LeftUpLeg: [['X', -2.0]],
      RightUpLeg: [['X', -2.0]],
      LeftLeg: [['X', 0.12]],
      RightLeg: [['X', 0.12]],
      LeftFoot: [['X', -0.12]],
      RightFoot: [['X', -0.12]],
      Spine: [['X', 0.22]],
      Chest: [['X', 0.28]],
      Head: [['X', 0.1]],
      LeftArm: [['Y', -1.1], ['Z', 0.5]],
      RightArm: [['Y', 1.1], ['Z', -0.5]],
    },
  },
  lowLunge: {
    sanskrit: 'Ashwa Sanchalanasana',
    // The HIGH variant: torso proud, arms low — the hands stay off the
    // floor, so this is a feet pose despite living mid-salutation.
    root: { height: 0.64, pitch: 0.25 },
    support: 'feet',
    bones: {
      LeftUpLeg: [['X', -1.5]],
      LeftLeg: [['X', 1.15]],
      LeftFoot: [['X', -0.05]],
      RightUpLeg: [['X', 0.5]],
      RightLeg: [['X', 0.15]],
      RightFoot: [['X', 0.35]],
      Spine: [['X', -0.18]],
      Chest: [['X', -0.14]],
      Head: [['X', -0.12]],
      LeftArm: [['Z', -1.15], ['Y', -0.3]],
      RightArm: [['Z', 1.15], ['Y', 0.3]],
    },
  },
  plank: {
    sanskrit: 'Phalakasana',
    root: { height: 0.52, pitch: 1.42 },
    support: 'handsFeet',
    bones: {
      // The floor, in the body's pitched frame, is straight ahead — so the
      // arms point local-forward and arrive vertical under the shoulders.
      LeftArm: [['Y', -1.42], ['Z', -0.08]],
      RightArm: [['Y', 1.42], ['Z', 0.08]],
      LeftUpLeg: [['X', -0.28]],
      RightUpLeg: [['X', -0.28]],
      LeftFoot: [['X', -0.62]],
      RightFoot: [['X', -0.62]],
      Head: [['X', -0.5]],
    },
  },
  eightLimbed: {
    sanskrit: 'Ashtanga Namaskara',
    root: { height: 0.33, pitch: 1.3 },
    support: 'kneeling',
    bones: {
      // Knees ON the floor with the hips riding high — that is the name.
      LeftUpLeg: [['X', -0.35]],
      RightUpLeg: [['X', -0.35]],
      LeftLeg: [['X', 0.62]],
      RightLeg: [['X', 0.62]],
      LeftFoot: [['X', -0.2]],
      RightFoot: [['X', -0.2]],
      Spine: [['X', 0.2]],
      Chest: [['X', 0.15]],
      Head: [['X', -0.65]],
      LeftArm: [['Y', -1.1], ['Z', -0.1]],
      LeftForeArm: [['Z', 1.15]],
      RightArm: [['Y', 1.1], ['Z', 0.1]],
      RightForeArm: [['Z', -1.15]],
    },
  },
  cobra: {
    sanskrit: 'Bhujangasana',
    root: { height: 0.17, pitch: 1.42 },
    support: 'prone',
    breath: 'chest',
    bones: {
      LeftUpLeg: [['X', 0.14]],
      RightUpLeg: [['X', 0.14]],
      LeftFoot: [['X', 0.6]],
      RightFoot: [['X', 0.6]],
      Spine: [['X', -0.5]],
      Chest: [['X', -0.52]],
      Head: [['X', -0.3]],
      LeftArm: [['Y', -1.15], ['Z', -0.3]],
      RightArm: [['Y', 1.15], ['Z', 0.3]],
    },
  },
  downwardDog: {
    sanskrit: 'Adho Mukha Svanasana',
    root: { height: 0.78, pitch: 2.36 },
    support: 'handsFeet',
    bones: {
      // The deep hip fold: pitch says 135°, the thighs take most of it back,
      // and the difference IS the inverted V.
      LeftUpLeg: [['X', -1.6]],
      RightUpLeg: [['X', -1.6]],
      LeftLeg: [['X', 0.05]],
      RightLeg: [['X', 0.05]],
      LeftFoot: [['X', -0.7]],
      RightFoot: [['X', -0.7]],
      Spine: [['X', 0.04]],
      Head: [['X', 0.3]],
      LeftArm: [['Z', 1.32], ['Y', -0.12]],
      RightArm: [['Z', -1.32], ['Y', 0.12]],
    },
  },
  tree: {
    sanskrit: 'Vrikshasana',
    root: { height: 0.99, pitch: 0 },
    support: 'feet',
    balance: true,
    bones: {
      RightUpLeg: [['Z', -1.0], ['X', -0.15]],
      RightLeg: [['X', 2.15]],
      RightFoot: [['X', 0.3]],
      LeftArm: [['Z', 1.5], ['Y', -0.18]],
      LeftForeArm: [['Z', -0.28]],
      RightArm: [['Z', -1.5], ['Y', 0.18]],
      RightForeArm: [['Z', 0.28]],
      Chest: [['X', -0.05]],
    },
  },
  warrior2: {
    sanskrit: 'Virabhadrasana II',
    root: { height: 0.8, pitch: 0 },
    support: 'feet',
    bones: {
      LeftUpLeg: [['Z', 0.55]],
      RightUpLeg: [['Z', -0.55]],
      LeftLeg: [['X', 0.7]],
      LeftFoot: [['X', -0.7], ['Z', -0.55]],
      RightFoot: [['Z', 0.55]],
      // The arms are the rest pose: a T. Warrior II is the one asana the
      // bind pose was already doing.
      Head: [['Y', 0.6]],
      Chest: [['X', -0.03]],
    },
  },
  triangle: {
    sanskrit: 'Trikonasana',
    root: { height: 0.86, pitch: 0 },
    support: 'feet',
    bones: {
      LeftUpLeg: [['Z', 0.58]],
      RightUpLeg: [['Z', -0.58]],
      LeftFoot: [['Z', -0.5]],
      RightFoot: [['Z', 0.5]],
      Spine: [['Z', -0.42]],
      Chest: [['Z', -0.48]],
      LeftArm: [['Z', -1.3]],
      RightArm: [['Z', -1.5]],
      Head: [['Z', -0.25], ['Y', -0.3]],
    },
  },
  child: {
    sanskrit: 'Balasana',
    root: { height: 0.46, pitch: 0.95 },
    support: 'kneeling',
    breath: 'back',
    bones: {
      LeftUpLeg: [['X', -0.78]],
      RightUpLeg: [['X', -0.78]],
      LeftLeg: [['X', 2.2]],
      RightLeg: [['X', 2.2]],
      LeftFoot: [['X', -1.3]],
      RightFoot: [['X', -1.3]],
      Spine: [['X', 0.5]],
      Chest: [['X', 0.45]],
      Head: [['X', 0.2]],
      LeftArm: [['Y', -1.25], ['Z', 0.62]],
      RightArm: [['Y', 1.25], ['Z', -0.62]],
    },
  },
  lotus: {
    sanskrit: 'Padmasana',
    root: { height: 0.25, pitch: 0 },
    support: 'seated',
    breath: 'belly',
    bones: {
      LeftUpLeg: [['Z', 1.0], ['X', -1.45]],
      RightUpLeg: [['Z', -1.0], ['X', -1.45]],
      LeftLeg: [['X', 2.4]],
      RightLeg: [['X', 2.4]],
      LeftFoot: [['X', 0.4]],
      RightFoot: [['X', 0.4]],
      Chest: [['X', -0.06]],
      LeftArm: [['Z', -1.0], ['Y', -0.45]],
      LeftForeArm: [['Z', 0.3]],
      RightArm: [['Z', 1.0], ['Y', 0.45]],
      RightForeArm: [['Z', -0.3]],
    },
  },
  corpse: {
    sanskrit: 'Savasana',
    root: { height: 0.12, pitch: -1.52 },
    support: 'supine',
    breath: 'belly',
    bones: {
      LeftUpLeg: [['Z', 0.12]],
      RightUpLeg: [['Z', -0.12]],
      LeftFoot: [['X', 0.35]],
      RightFoot: [['X', 0.35]],
      LeftArm: [['Z', -1.25]],
      RightArm: [['Z', 1.25]],
      Head: [['X', 0.05]],
    },
  },
};

export const ASANA_NAMES = Object.keys(ASANAS) as AsanaName[];

const AXES: Record<AxisName, Vector3> = {
  X: new Vector3(1, 0, 0),
  Y: new Vector3(0, 1, 0),
  Z: new Vector3(0, 0, 1),
};

/** The rig's rest hip height — the layout's constant, not the current pose. */
const restHipsY = (rig: HumanoidRig): number => rig.legLength + 0.065 * rig.height;

/** The bones a shallow `depth` is allowed to under-commit (never the legs). */
const EXPRESSION = new Set<BoneName>([
  'Spine', 'Chest', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
]);

/** Compose one bone's spec rotations into a quaternion. */
function composeBone(
  out: Quaternion,
  spec: AsanaSpec,
  bone: BoneName,
  step: Quaternion
): Quaternion {
  out.identity();
  if (bone === 'Hips' && spec.root.pitch !== 0) {
    out.multiply(step.setFromAxisAngle(AXES.X, spec.root.pitch));
  }
  for (const [axis, angle] of spec.bones[bone] ?? []) {
    out.multiply(step.setFromAxisAngle(AXES[axis], angle));
  }
  return out;
}

/**
 * Apply an asana INSTANTLY — the single-frame API. No clock, no breath, no
 * easing: the rig simply *is* the pose when the call returns. For
 * screenshots, statues, character selects, and anywhere a posed body is a
 * noun rather than a verb.
 */
export function strikePose(rig: HumanoidRig, asana: AsanaName | AsanaSpec): void {
  const spec = typeof asana === 'string' ? ASANAS[asana] : asana;
  const step = new Quaternion();
  for (const bone of BONE_NAMES) {
    composeBone(rig.bones[bone].quaternion, spec, bone, step);
  }
  rig.bones.Hips.position.y = restHipsY(rig) * spec.root.height;
  rig.object.updateWorldMatrix(true, true);
}

/**
 * One position of a flow: an asana, and the half-breath it rides.
 *
 * A vinyasa is not a list of poses — it is a list of **breaths that happen
 * to have poses attached**, which is why the step names the breath and not
 * a duration. `'inhale'` and `'exhale'` strike at the breath's turning
 * points; `'retain'` is kumbhaka — the held breath — and strikes MID
 * half-breath, riding inside the previous step's air. (In the classical
 * salutation, plank is position five precisely because the breath is held
 * there: you inhaled into the lunge and you have not let it go yet.)
 */
export interface FlowStep {
  asana: AsanaName;
  breath: 'inhale' | 'exhale' | 'retain';
  /** Extra FULL breaths to stay in this pose before the flow may move on. */
  holdBreaths?: number;
}

/**
 * Surya Namaskar A — the sun salutation, twelve positions on the classical
 * (Sivananda) breath map: exhale into prayer, inhale to salute the sun,
 * exhale to fold, inhale to the lunge, RETAIN into plank, exhale down
 * through eight limbs, inhale the cobra up, exhale back into the dog, and
 * the same road home. Hand it to `flow()` and the body breathes it.
 */
export const SURYA_NAMASKAR: FlowStep[] = [
  { asana: 'prayer', breath: 'exhale' },
  { asana: 'upwardSalute', breath: 'inhale' },
  { asana: 'forwardFold', breath: 'exhale' },
  { asana: 'lowLunge', breath: 'inhale' },
  { asana: 'plank', breath: 'retain' },
  { asana: 'eightLimbed', breath: 'exhale' },
  { asana: 'cobra', breath: 'inhale' },
  { asana: 'downwardDog', breath: 'exhale' },
  { asana: 'lowLunge', breath: 'inhale' },
  { asana: 'forwardFold', breath: 'exhale' },
  { asana: 'upwardSalute', breath: 'inhale' },
  { asana: 'prayer', breath: 'exhale' },
];

export interface AsanaOptions {
  seed?: number;
  /** Breaths per minute. Default 6 — a calm practice. */
  breathsPerMinute?: number;
  /** Seconds the fast part of a settle takes (the tail takes longer). */
  settle?: number;
  /**
   * How much of each pose's upper body this practitioner can actually
   * reach, 0..1. A stiff student's fold simply does not go as deep — the
   * spine, arms and head take `depth` of the pose while the legs and the
   * root take all of it, so the floor contract is never broken by a
   * shallow practice. Default 1.
   */
  depth?: number;
}

/** mulberry32, privately — same seeds, same practice. */
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
 * The hold engine: strike a pose and the body finds it, breathes in it, and
 * balances in it until released. See the module docs for what "held alive"
 * means; the API is deliberately small:
 *
 * ```ts
 * const asana = new Asana(rig, { seed: 3, breathsPerMinute: 6 });
 * asana.strike('tree');
 * asana.onBreath((side) => chime.play(side));
 * game.onUpdate((t) => asana.update(t.delta));
 * // …later
 * asana.release();   // eases home to whatever the body was doing before
 * ```
 */
export class Asana {
  /** The pose being held (or found), or null before the first strike. */
  pose: AsanaName | null = null;
  /** Breath phase 0..1 — inhale over the first half, exhale the second. */
  breath = 0;

  private rig: HumanoidRig;
  private rate: number;
  private k: number;
  private weight = 0;
  private target = 0;
  private time = 0;
  private baseHipsY: number;
  private entry = new Map<BoneName, Quaternion>();
  private entryHips = { x: 0, y: 0, z: 0 };
  /** The chased pose — where the body has GOT to, distinct from the goal. */
  private now = new Map<BoneName, Quaternion>();
  private goal = new Map<BoneName, Quaternion>();
  private heightNow = 1;
  private heightGoal = 1;
  private spec: AsanaSpec | null = null;
  private maxErr = Math.PI;
  private depth: number;
  private breathCbs = new Set<(side: 'inhale' | 'exhale') => void>();
  private poseCbs = new Set<(pose: AsanaName) => void>();
  /** A breath clock handed down from outside (an instructor). */
  private pendingBreath: number | null = null;
  private flowSteps: FlowStep[] | null = null;
  private flowIdx = 0;
  private flowLoop = false;
  /** Breath turns this step still owns before the flow may move on. */
  private flowWait = 0;
  /** Seeded sway personality: phases and a size of one's own. */
  private swayPhase: [number, number, number, number];
  private swaySize: number;
  private q = new Quaternion();
  private step = new Quaternion();
  private off = new Quaternion();

  constructor(rig: HumanoidRig, options: AsanaOptions = {}) {
    this.rig = rig;
    this.rate = options.breathsPerMinute ?? 6;
    this.depth = Math.min(1, Math.max(0.2, options.depth ?? 1));
    this.k = 3 / Math.max(0.2, options.settle ?? 2.2);
    this.baseHipsY = restHipsY(rig);
    const rand = makeRng(options.seed ?? 1);
    this.swayPhase = [
      rand() * Math.PI * 2,
      rand() * Math.PI * 2,
      rand() * Math.PI * 2,
      rand() * Math.PI * 2,
    ];
    this.swaySize = 0.8 + rand() * 0.5;
    this.breath = rand() * 0.3;
  }

  get holding(): boolean {
    return this.target > 0;
  }

  /** True once the body has found the struck pose (to a whisper). */
  get settled(): boolean {
    return this.target > 0 && this.weight > 0.995 && this.maxErr < 0.03;
  }

  /**
   * Hear the breath turn. Fires `'inhale'` at the bottom of the cycle and
   * `'exhale'` at the top — the two moments a flow steps on. Returns the
   * unsubscribe.
   */
  onBreath(cb: (side: 'inhale' | 'exhale') => void): () => void {
    this.breathCbs.add(cb);
    return () => this.breathCbs.delete(cb);
  }

  /** Hear every strike — manual or flow-driven. Returns the unsubscribe. */
  onPose(cb: (pose: AsanaName) => void): () => void {
    this.poseCbs.add(cb);
    return () => this.poseCbs.delete(cb);
  }

  /**
   * Hand the body a vinyasa: poses attached to breaths. The first step is
   * struck immediately; every later one strikes at its named half-breath —
   * `'inhale'` and `'exhale'` at the turns, `'retain'` mid-breath — after
   * the previous step's `holdBreaths` are spent. A finished (non-looping)
   * flow simply stays in its last pose, still holding, still breathing.
   */
  flow(steps: FlowStep[], opts: { loop?: boolean } = {}): void {
    if (!steps.length) return;
    this.flowSteps = steps;
    this.flowIdx = 0;
    this.flowLoop = opts.loop ?? false;
    this.strike(steps[0].asana);
    this.flowWait = (steps[0].holdBreaths ?? 0) * 2;
  }

  /** Abandon the sequence; the current pose keeps being held. */
  clearFlow(): void {
    this.flowSteps = null;
  }

  /** Which step of the flow is being held, or −1 outside a flow. */
  get flowStep(): number {
    return this.flowSteps ? this.flowIdx : -1;
  }

  /**
   * Surrender the breath clock. A student does not keep time — they keep
   * THE INSTRUCTOR'S time, a watching-lag late; this hands them exactly
   * that: the phase to be on at the end of this frame's update.
   */
  slaveTo(breath: number): void {
    this.pendingBreath = ((breath % 1) + 1) % 1;
  }

  /** The flow's pointer: move on IF the next step rides this event. */
  private advanceFlow(kind: 'inhale' | 'exhale' | 'retain'): void {
    if (!this.flowSteps) return;
    if (this.flowWait > 0) {
      // Holds are spent by the turns; a kumbhaka window never jumps one.
      if (kind !== 'retain') this.flowWait--;
      return;
    }
    const next = this.flowIdx + 1;
    if (next >= this.flowSteps.length && !this.flowLoop) {
      // The sequence is over: stay in the last pose, drop the pointer.
      if (kind !== 'retain') this.flowSteps = null;
      return;
    }
    const step = this.flowSteps[next % this.flowSteps.length];
    if (step.breath !== kind) return;
    this.flowIdx = next % this.flowSteps.length;
    this.strike(step.asana);
    this.flowWait = (step.holdBreaths ?? 0) * 2;
  }

  /**
   * Take a pose. The first strike captures the entry pose — home, for
   * `release()` — and successive strikes flow from wherever the body is now:
   * the chase is exponential, so nothing snaps.
   */
  strike(name: AsanaName): void {
    const spec = ASANAS[name];
    this.pose = name;
    this.spec = spec;
    if (this.target <= 0) {
      // Stepping onto the mat: remember home, and start the chase from the
      // body's actual pose so the first frame is continuous.
      for (const bone of BONE_NAMES) {
        const q = this.rig.bones[bone].quaternion;
        this.entry.set(bone, q.clone());
        this.now.set(bone, q.clone());
      }
      const hp = this.rig.bones.Hips.position;
      this.entryHips = { x: hp.x, y: hp.y, z: hp.z };
      this.heightNow = hp.y / this.baseHipsY;
    }
    this.target = 1;
    for (const bone of BONE_NAMES) {
      const g = this.goal.get(bone) ?? new Quaternion();
      composeBone(g, spec, bone, this.step);
      this.goal.set(bone, g);
    }
    this.heightGoal = spec.root.height;
    this.maxErr = Math.PI;
    for (const cb of this.poseCbs) cb(name);
  }

  /** Ease home to the pose the practice began from. Tears up any flow. */
  release(): void {
    this.target = 0;
    this.flowSteps = null;
  }

  /** One tick of the practice. */
  update(dt: number): void {
    // On and off the mat — slower than a dance floor; yoga is deliberate.
    const rate = this.target > this.weight ? 1.5 : 1.1;
    this.weight += Math.sign(this.target - this.weight) * Math.min(dt * rate, Math.abs(this.target - this.weight));
    if (this.weight <= 0.0001 || !this.spec) return;
    this.time += dt;

    // The breath clock — and its two turning points. A pending sync (an
    // instructor's clock) overrides the advance; the wrap test tolerates
    // the tiny backward jitter syncing can cause, so a jitter is never
    // mistaken for a whole new breath.
    const before = this.breath;
    this.breath = (this.breath + (dt * this.rate) / 60) % 1;
    if (this.pendingBreath !== null) {
      this.breath = this.pendingBreath;
      this.pendingBreath = null;
    }
    if (this.breath < before) {
      if (before - this.breath > 0.5) {
        this.advanceFlow('inhale');
        for (const cb of this.breathCbs) cb('inhale');
      }
    } else if (before < 0.5 && this.breath >= 0.5) {
      this.advanceFlow('exhale');
      for (const cb of this.breathCbs) cb('exhale');
    }
    // Kumbhaka windows: mid-half-breath, where 'retain' steps strike.
    for (const mid of [0.25, 0.75]) {
      if (before < mid && this.breath >= mid) this.advanceFlow('retain');
    }
    // Breath displacement: smooth, full at mid-inhale, spent at the turns.
    const s = Math.sin(this.breath * Math.PI * 2);

    // The sway: two incommensurate sines per axis — never periodic to the
    // eye, never still. One-legged poses visibly WORK; lying down, nothing
    // needs balancing at all.
    const lying = this.spec.support === 'prone' || this.spec.support === 'supine';
    const swayAmp = lying ? 0 : (this.spec.balance ? 0.028 : 0.009) * this.swaySize;
    const [p1, p2, p3, p4] = this.swayPhase;
    const sx = Math.sin(this.time * 0.53 + p1) + 0.6 * Math.sin(this.time * 1.31 + p2);
    const sz = Math.sin(this.time * 0.61 + p3) + 0.6 * Math.sin(this.time * 1.17 + p4);

    // The settle: exponential chase — most of the way fast, the last five
    // percent at its own pace.
    const chase = 1 - Math.exp(-dt * this.k);
    this.maxErr = 0;
    for (const bone of BONE_NAMES) {
      const n = this.now.get(bone)!;
      const g = this.goal.get(bone)!;
      this.maxErr = Math.max(this.maxErr, n.angleTo(g));
      n.slerp(g, chase);
    }
    this.heightNow += (this.heightGoal - this.heightNow) * chase;

    const breathAt = this.spec.breath ?? 'chest';
    const w = this.weight * this.weight * (3 - 2 * this.weight);
    for (const bone of BONE_NAMES) {
      this.q.copy(this.now.get(bone)!);
      // Small live offsets ride ON TOP of the chased pose.
      if (bone === 'Hips' && swayAmp > 0) {
        this.q
          .multiply(this.off.setFromAxisAngle(AXES.Z, sx * swayAmp))
          .multiply(this.off.setFromAxisAngle(AXES.X, sz * swayAmp * 0.7));
      }
      if (bone === 'Chest') {
        const lift = breathAt === 'chest' ? 0.05 : breathAt === 'back' ? 0.028 : 0.018;
        this.q.multiply(this.off.setFromAxisAngle(AXES.X, -s * lift));
        if (swayAmp > 0) this.q.multiply(this.off.setFromAxisAngle(AXES.Z, -sx * swayAmp * 0.5));
      }
      if (bone === 'Spine' && breathAt !== 'chest') {
        this.q.multiply(this.off.setFromAxisAngle(AXES.X, (breathAt === 'back' ? -0.03 : -0.035) * s));
      }
      if (bone === 'LeftShoulder' || bone === 'RightShoulder') {
        if (breathAt === 'chest') this.q.multiply(this.off.setFromAxisAngle(AXES.Z, (bone === 'LeftShoulder' ? 1 : -1) * s * 0.02));
      }
      const joint = this.rig.bones[bone];
      // Depth is expression, not support: a shallow practice folds less
      // through the spine and arms, but the legs and root always commit —
      // a stiff student still stands where the pose stands.
      joint.quaternion
        .copy(this.entry.get(bone)!)
        .slerp(this.q, EXPRESSION.has(bone) ? w * this.depth : w);
    }
    const hips = this.rig.bones.Hips;
    const bob = s * 0.004 * this.baseHipsY;
    hips.position.y = this.entryHips.y + (this.baseHipsY * this.heightNow + bob - this.entryHips.y) * w;
    hips.position.x = this.entryHips.x;
    hips.position.z = this.entryHips.z;
  }
}
