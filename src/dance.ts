import { Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

/**
 * Dancing — the first motion in this library that is **not the character's
 * idea**.
 *
 * Everything else here starts inside the body: a walk is where the legs want
 * to go, a mannerism is a private itch, a conversation gesture belongs to the
 * speaker. A dancer is driven by something outside — a beat that arrives,
 * from a woofer, a band, a busker — and the whole craft of the controller is
 * staying ON that beat while it wanders, drops out and comes back.
 *
 * SCENA's woofer publishes the music as a pulse:
 *
 * ```ts
 * { bass, mid, treble, beat, bpm }
 * ```
 *
 * and `Dance` consumes anything of that shape (structural, as ever — neither
 * library imports the other):
 *
 * ```ts
 * const dance = new Dance(rig, { seed: 7 });
 * dance.start('bounce');
 * game.onUpdate((t) => {
 *   rig.update?.(t.delta);
 *   dance.update(t.delta, woofer.pulse());   // the whole coupling
 * });
 * ```
 *
 * ## The beat clock free-runs
 *
 * The phase advances at the reported tempo and is only *nudged* by arriving
 * beats — never snapped. A dancer who teleports to the beat every kick looks
 * like a glitch; a dancer who drifts and corrects looks like a person. And
 * when the pulse stops entirely (the stream died; nobody called with music at
 * all) the clock keeps the last tempo and the body keeps dancing — which is
 * exactly what people on a floor do for the seconds it takes the DJ to fix
 * the skip.
 *
 * ## The moves are skills, not clips
 *
 * Each move is a pure function of beat phase and energy, sampled fresh every
 * frame, so it locks to whatever the tempo happens to be — a clip baked at
 * 120 BPM is wrong at every other tempo, and wrong *cumulatively*. Energy
 * comes off the music (mostly the bass), so the same move danced to a quiet
 * bar and a loud one is the same shape at a different size — which is how
 * dancing actually scales.
 *
 * Every dancer gets a seeded **flair**: a fixed timing offset and amplitude
 * of their own. Feed one pulse to twenty dancers and they dance *together
 * but not in lockstep* — a crowd, not a chorus line.
 */

/** What the music says this frame. Structurally SCENA's `AudioPulse`. */
export interface DancePulse {
  bass: number;
  mid: number;
  treble: number;
  beat: boolean;
  bpm: number;
}

export type DanceMove =
  /** Knees pump on the beat, everything else hangs loose. The default skill. */
  | 'bounce'
  /** Weight side to side over two beats, arms swinging across. */
  | 'stepTouch'
  /** Hips one way, chest the other, on the eighth notes. */
  | 'twist'
  /** Both hands push the ceiling on every beat. */
  | 'raiseTheRoof'
  /** Chest and head dive with the bass. */
  | 'headBang'
  /** Hands meet overhead on the two and the four. */
  | 'clap'
  /** Poses quantised to the eighth note — motion BETWEEN beats, held ON them. */
  | 'robot';

export const DANCE_MOVES: DanceMove[] = [
  'bounce',
  'stepTouch',
  'twist',
  'raiseTheRoof',
  'headBang',
  'clap',
  'robot',
];

/**
 * A style is not a bigger move — it is a different relationship to time.
 *
 * The club moves treat every beat the same. A style has a **meter** (a waltz
 * has three beats to the bar and there is no arguing with it) and a **count
 * cycle** in which some beats step, some hold, and the holds are the point:
 * salsa's whole character is that counts 4 and 8 are deliberately empty.
 * Quick-quick-slow is a rhythm you can write down, so here it is data.
 *
 * Styles also STEP — real weight transfer, travel and return — where the
 * club moves pump in place. The step engine underneath is deliberately
 * simple: feet chase charted targets, the body's weight eases onto the
 * support foot, and the hips answer the weight a half-count late. That lag
 * IS Cuban motion; remove it and salsa becomes someone walking sideways.
 */
export type DanceStyle = 'club' | 'salsa' | 'waltz' | 'bhangra';

export const DANCE_STYLES: DanceStyle[] = ['club', 'salsa', 'waltz', 'bhangra'];

export interface DanceOptions {
  seed?: number;
  /** Tempo the clock free-runs at before any pulse says otherwise. */
  bpm?: number;
  /** Bars between automatic move changes. Default 8. */
  barsPerMove?: number;
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
/** Arms hang at just short of vertical — the wave clip's convention. */
const HANG = Math.PI / 2 - 0.14;

type Turn = [Vector3, number];
type Shape = Partial<Record<BoneName, Turn[]>>;

/** What a move computes: rotations, plus how far the hips drop. */
interface MoveFrame {
  shape: Shape;
  /** Metres down from the standing hip height. */
  drop: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Overlay shapes: later contributions compose after earlier ones. */
function mergeShapes(...parts: Shape[]): Shape {
  const out: Shape = {};
  for (const part of parts) {
    for (const bone of Object.keys(part) as BoneName[]) {
      out[bone] = [...(out[bone] ?? []), ...part[bone]!];
    }
  }
  return out;
}
/** A pump that lands ON the beat: sharp at phase 0, spent by the off-beat. */
const kick = (p: number): number => Math.exp(-(p % 1) * 5);
/** Smooth two-beat pendulum, −1..1, crossing zero on the off-beats. */
const swing2 = (p: number): number => Math.sin(p * Math.PI);

/**
 * The repertoire. `p` is the beat phase (0 at each kick), `p2` the two-beat
 * phase in [0,2), `e` the energy, `s` this dancer's flair sign.
 */
const MOVES: Record<DanceMove, (p: number, p2: number, e: number, s: number) => MoveFrame> = {
  bounce: (p, p2, e, s) => {
    const dip = kick(p) * e;
    return {
      drop: 0.05 * dip + 0.015 * e,
      shape: {
        LeftUpLeg: [[X, -0.3 * dip - 0.08]],
        RightUpLeg: [[X, -0.3 * dip - 0.08]],
        LeftLeg: [[X, 0.55 * dip + 0.14]],
        RightLeg: [[X, 0.55 * dip + 0.14]],
        LeftFoot: [[X, -0.25 * dip - 0.06]],
        RightFoot: [[X, -0.25 * dip - 0.06]],
        Spine: [[X, 0.06 * dip]],
        Chest: [[X, 0.05 * dip], [Y, s * 0.04 * swing2(p2 / 2)]],
        Head: [[X, -0.06 * dip]],
        LeftArm: [[Z, -HANG + 0.12 * dip]],
        RightArm: [[Z, HANG - 0.12 * dip]],
        LeftForeArm: [[Z, -0.25 - 0.3 * dip]],
        RightForeArm: [[Z, 0.25 + 0.3 * dip]],
      },
    };
  },

  stepTouch: (p, p2, e, s) => {
    const sway = swing2(p2 / 2) * s; // one full side-to-side per two beats
    const dip = kick(p) * e * 0.6;
    return {
      drop: 0.03 * dip + 0.01 * e,
      shape: {
        Hips: [[Z, 0.1 * sway * e], [Y, 0.06 * sway * e]],
        Spine: [[Z, -0.07 * sway * e]],
        Chest: [[Z, -0.05 * sway * e]],
        Head: [[Z, 0.04 * sway * e]],
        LeftUpLeg: [[Z, 0.12 * Math.max(0, sway) * e], [X, -0.1 * dip]],
        RightUpLeg: [[Z, -0.12 * Math.max(0, -sway) * e], [X, -0.1 * dip]],
        LeftLeg: [[X, 0.2 * dip]],
        RightLeg: [[X, 0.2 * dip]],
        LeftArm: [[Z, -HANG + (0.35 + 0.3 * sway) * e]],
        RightArm: [[Z, HANG - (0.35 - 0.3 * sway) * e]],
        LeftForeArm: [[Z, (-0.4 - 0.25 * sway) * e]],
        RightForeArm: [[Z, (0.4 - 0.25 * sway) * e]],
      },
    };
  },

  twist: (p, _p2, e, s) => {
    // The eighth note: two full twists per beat, hips and chest opposed.
    const tw = Math.sin(p * Math.PI * 2) * e * s;
    const dip = kick(p) * e * 0.5;
    return {
      drop: 0.04 * e + 0.02 * dip,
      shape: {
        Hips: [[Y, 0.35 * tw]],
        Spine: [[Y, -0.2 * tw]],
        Chest: [[Y, -0.25 * tw]],
        Head: [[Y, 0.12 * tw]],
        LeftUpLeg: [[X, -0.12 - 0.1 * dip]],
        RightUpLeg: [[X, -0.12 - 0.1 * dip]],
        LeftLeg: [[X, 0.24 + 0.18 * dip]],
        RightLeg: [[X, 0.24 + 0.18 * dip]],
        LeftArm: [[Z, -HANG + 0.5 * e]],
        RightArm: [[Z, HANG - 0.5 * e]],
        LeftForeArm: [[Z, -0.9 * e], [Y, 0.3 * tw]],
        RightForeArm: [[Z, 0.9 * e], [Y, 0.3 * tw]],
      },
    };
  },

  raiseTheRoof: (p, _p2, e, s) => {
    const push = kick(p) * e;
    return {
      drop: 0.03 * push,
      shape: {
        Chest: [[X, -0.08 * push]],
        Head: [[X, 0.1 * push]],
        LeftArm: [[Z, -0.5 - 0.25 * push], [Y, s * 0.1]],
        RightArm: [[Z, 0.5 + 0.25 * push], [Y, -s * 0.1]],
        LeftForeArm: [[Z, -1.35 + 0.55 * push]],
        RightForeArm: [[Z, 1.35 - 0.55 * push]],
        LeftHand: [[Z, -0.3]],
        RightHand: [[Z, 0.3]],
        LeftUpLeg: [[X, -0.06 * push]],
        RightUpLeg: [[X, -0.06 * push]],
        LeftLeg: [[X, 0.12 * push]],
        RightLeg: [[X, 0.12 * push]],
      },
    };
  },

  headBang: (p, _p2, e, s) => {
    const dive = kick(p) * e;
    return {
      drop: 0.04 * dive,
      shape: {
        Spine: [[X, 0.16 * dive]],
        Chest: [[X, 0.22 * dive]],
        Neck: [[X, 0.3 * dive]],
        Head: [[X, 0.4 * dive], [Z, s * 0.05 * dive]],
        LeftArm: [[Z, -HANG + 0.7 * e]],
        RightArm: [[Z, HANG - 0.7 * e]],
        LeftForeArm: [[Z, -1.1 * e]],
        RightForeArm: [[Z, 1.1 * e]],
        LeftUpLeg: [[X, -0.1 * dive]],
        RightUpLeg: [[X, -0.1 * dive]],
        LeftLeg: [[X, 0.2 * dive]],
        RightLeg: [[X, 0.2 * dive]],
      },
    };
  },

  clap: (p, p2, e, s) => {
    // The hands travel through beat one and MEET on beat two — the snap is
    // the arrival, so the contact lands exactly on the two and the four.
    const travel = clamp01(p2 / 2) * 2;
    const together = travel < 1 ? travel : 2 - travel;
    const dip = kick(p) * e * 0.5;
    return {
      drop: 0.025 * dip,
      shape: {
        LeftArm: [[Z, -HANG + (0.55 + 0.5 * together) * e], [Y, 0.35 * together * e]],
        RightArm: [[Z, HANG - (0.55 + 0.5 * together) * e], [Y, -0.35 * together * e]],
        LeftForeArm: [[Z, (-0.7 + 0.25 * together) * e]],
        RightForeArm: [[Z, (0.7 - 0.25 * together) * e]],
        Chest: [[X, 0.04 * together * e], [Y, s * 0.03 * swing2(p2 / 2)]],
        Head: [[X, -0.05 * together * e]],
        LeftLeg: [[X, 0.15 * dip]],
        RightLeg: [[X, 0.15 * dip]],
        LeftUpLeg: [[X, -0.08 * dip]],
        RightUpLeg: [[X, -0.08 * dip]],
      },
    };
  },

  robot: (p, p2, e, s) => {
    // Quantised: the eighth note picks a pose, and the body SNAPS between
    // poses and holds — dancing the grid rather than the groove.
    const step = Math.floor((p2 * 4) % 8);
    const a = [1, -1, 1, -1, -1, 1, -1, 1][step] * s;
    const b = [1, 1, -1, -1, 1, -1, 1, -1][step];
    return {
      drop: 0.02 * e,
      shape: {
        Head: [[Y, 0.3 * a * e]],
        Chest: [[Y, -0.15 * a * e], [Z, 0.05 * b * e]],
        LeftArm: [[Z, -0.6 * e], [Y, 0.4 * b * e]],
        RightArm: [[Z, 0.6 * e], [Y, -0.4 * a * e]],
        LeftForeArm: [[Z, -1.2 * e], [X, 0.5 * a * e]],
        RightForeArm: [[Z, 1.2 * e], [X, -0.5 * b * e]],
        LeftHand: [[X, 0.4 * b * e]],
        RightHand: [[X, 0.4 * a * e]],
        LeftUpLeg: [[X, -0.05 * e]],
        RightUpLeg: [[X, -0.05 * e]],
        LeftLeg: [[X, 0.1 * e]],
        RightLeg: [[X, 0.1 * e]],
      },
    };
  },
};

/** One charted count: which foot goes where (metres, dancer-local). */
interface CountStep {
  foot?: 'L' | 'R';
  /** +x is the dancer's left, +z is forward. Omitted = home. */
  dx?: number;
  dz?: number;
  /** An accented count (the ONE, a stamp) — the upper body leans into it. */
  accent?: boolean;
}

interface StyleSpec {
  beatsPerBar: number;
  /** Counts in one full cycle of the figure. */
  counts: number;
  /** How far a basic step reaches, as a fraction of leg length. */
  reach: number;
  /** The frame held under everything, scaled by energy. */
  posture: (e: number, s: number) => Shape;
  /** Arms, chest and head over the cycle. `c` is the fractional count. */
  upper: (c: number, e: number, s: number) => Shape;
  /** Vertical shape over the BAR, metres. Waltz falls on 1 and rises after. */
  lift: (barPhase: number, e: number) => number;
  /** The figure, one entry per count. */
  chart: CountStep[];
  /** How much the hips answer the weight — Cuban motion's volume knob. */
  hipAnswer: number;
}

const STYLES: Record<Exclude<DanceStyle, 'club'>, StyleSpec> = {
  // On-1 salsa: forward break, replace, home, HOLD; back break, replace,
  // home, HOLD. The holds on 4 and 8 are what make it salsa.
  salsa: {
    beatsPerBar: 4,
    counts: 8,
    reach: 0.5,
    hipAnswer: 1,
    chart: [
      // The break carries a little LATERAL weight too — that sideways
      // component is what the hips answer late, and it is the salsa.
      { foot: 'L', dz: 1, dx: 0.45, accent: true },
      { foot: 'R', dz: 0.15, dx: -0.3 },
      { foot: 'L' },
      {},
      { foot: 'R', dz: -1, dx: -0.45, accent: true },
      { foot: 'L', dz: -0.15, dx: 0.3 },
      { foot: 'R' },
      {},
    ],
    posture: (e, s) => ({
      Chest: [[X, 0.05 * e]],
      LeftArm: [[Z, -HANG + 0.55 * e]],
      RightArm: [[Z, HANG - 0.55 * e]],
      LeftForeArm: [[Z, -0.95 * e], [Y, 0.15 * s]],
      RightForeArm: [[Z, 0.95 * e], [Y, -0.15 * s]],
    }),
    upper: (c, e, s) => {
      // The arms trade places with the feet: as the left breaks forward the
      // right arm comes across, and everything swings through the hold.
      const swing = Math.sin((c / 8) * Math.PI * 2) * e;
      return {
        Chest: [[Y, 0.14 * swing * s]],
        Head: [[Y, -0.08 * swing * s]],
        LeftForeArm: [[Y, 0.35 * swing]],
        RightForeArm: [[Y, 0.35 * swing]],
      };
    },
    lift: () => 0,
  },

  // The box, over two bars of THREE: forward-side-close, back-side-close.
  // Down on the one, rising through two and three — the rise-and-fall is
  // the waltz, the way the lag is the salsa.
  waltz: {
    beatsPerBar: 3,
    counts: 6,
    reach: 0.55,
    hipAnswer: 0.25,
    chart: [
      { foot: 'L', dz: 1, accent: true },
      { foot: 'R', dz: 1, dx: -1 },
      { foot: 'L', dz: 1, dx: -1 },
      { foot: 'R', dz: 0, accent: true },
      { foot: 'L', dz: 0, dx: 0 },
      { foot: 'R', dz: 0, dx: 0 },
    ],
    posture: (e) => ({
      // The frame: arms carried wide and high, and it does not slump.
      Chest: [[X, -0.06 * e]],
      Head: [[X, -0.03 * e], [Y, 0.18 * e]],
      LeftArm: [[Z, -0.55 - 0.15 * e]],
      RightArm: [[Z, 0.55 + 0.15 * e]],
      LeftForeArm: [[Z, -0.75], [Y, 0.4]],
      RightForeArm: [[Z, 0.75], [Y, -0.4]],
    }),
    upper: (c, e, s) => {
      const sway = Math.sin((c / 6) * Math.PI * 2) * e * s;
      return { Chest: [[Z, 0.05 * sway]], Hips: [[Y, 0.04 * sway]] };
    },
    // Sink into the one, rise through two, stand tall on three.
    lift: (barPhase, e) => (Math.sin((barPhase - 0.25) * Math.PI * 2) * 0.5 + 0.5) * 0.05 * e - 0.035 * e,
  },

  // Bhangra: the bounce IS the posture, shoulders answer the kick, and the
  // arms spend the whole cycle above the head — first one, then both.
  bhangra: {
    beatsPerBar: 4,
    counts: 8,
    reach: 0.35,
    hipAnswer: 0.4,
    chart: [
      { foot: 'L', dx: 1, accent: true },
      { foot: 'L' },
      { foot: 'R', dx: -1, accent: true },
      { foot: 'R' },
      { foot: 'L', dx: 1, accent: true },
      { foot: 'L' },
      { foot: 'R', dx: -1, accent: true },
      { foot: 'R' },
    ],
    posture: (e) => ({
      Chest: [[X, 0.06 * e]],
      LeftLeg: [[X, 0.12 * e]],
      RightLeg: [[X, 0.12 * e]],
      LeftUpLeg: [[X, -0.06 * e]],
      RightUpLeg: [[X, -0.06 * e]],
    }),
    upper: (c, e, s) => {
      // One arm up for the first half of the cycle, both up for the second,
      // wrists circling — and the shoulders bounce on every count.
      const half = c < 4;
      const bounce = Math.exp(-(c % 1) * 5) * e;
      const circle = c * Math.PI;
      return {
        LeftShoulder: [[Z, -0.12 * bounce]],
        RightShoulder: [[Z, 0.12 * bounce]],
        LeftArm: half
          ? [[Z, -HANG + 0.5 * e]]
          : [[Z, -2.35 - 0.12 * bounce]],
        RightArm: [[Z, 2.35 + 0.12 * bounce], [Y, -0.1 * s]],
        LeftForeArm: half ? [[Z, -0.9 * e]] : [[Z, -0.35], [X, 0.35 * Math.sin(circle)]],
        RightForeArm: [[Z, 0.35], [X, 0.35 * Math.cos(circle)]],
        Head: [[Z, 0.05 * Math.sin(circle) * s * e]],
      };
    },
    lift: (barPhase, e) => Math.abs(Math.sin(barPhase * Math.PI * 4)) * 0.02 * e,
  },
};

/** Every bone any move touches — captured for entry/exit blending. */
const DANCE_BONES: BoneName[] = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot',
  'RightUpLeg', 'RightLeg', 'RightFoot',
];

/** mulberry32, privately — Dance must not depend on anything else's rng. */
const makeRng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export class Dance {
  /** The current skill. */
  move: DanceMove = 'bounce';
  /** Change moves on our own every `barsPerMove` bars. `use()` turns it off. */
  auto = true;
  /** Beat phase, 0 at each kick. */
  phase = 0;
  /** Bars danced since `start()`. */
  bar = 0;
  /** Eased musical energy, 0–1 — mostly the bass. */
  energy = 0.5;

  private rig: HumanoidRig;
  private rand: () => number;
  private baseBpm: number;
  private tempo: number;
  private barsPerMove: number;
  /** This dancer's own timing offset (seconds) and amplitude — the flair. */
  private lag: number;
  private amp: number;
  private sign: number;
  private weight = 0;
  private target = 0;
  private beats = 0;
  private entry = new Map<BoneName, Quaternion>();
  private entryHips = { x: 0, y: 0, z: 0 };
  private baseHipsY = 0;
  private legLen: number;
  private q = new Quaternion();
  private step = new Quaternion();
  private styleName: DanceStyle = 'club';
  /** Where each foot is versus home (dancer-local metres), eased to marks. */
  private feet = {
    L: { x: 0, z: 0, tx: 0, tz: 0, lift: 0 },
    R: { x: 0, z: 0, tx: 0, tz: 0, lift: 0 },
  };
  /** Where the weight is, eased — and where the hips think it is, later. */
  private carry = { x: 0, z: 0 };
  private hipEcho = { x: 0, z: 0 };
  private support: 'L' | 'R' = 'R';
  private lastCount = -1;

  constructor(rig: HumanoidRig, options: DanceOptions = {}) {
    this.rig = rig;
    this.rand = makeRng(options.seed ?? 1);
    this.baseBpm = options.bpm ?? 120;
    this.tempo = this.baseBpm;
    this.barsPerMove = Math.max(1, options.barsPerMove ?? 8);
    this.lag = (this.rand() - 0.5) * 0.09;
    this.amp = 0.85 + this.rand() * 0.3;
    this.sign = this.rand() < 0.5 ? -1 : 1;
    this.move = DANCE_MOVES[Math.floor(this.rand() * DANCE_MOVES.length)];
    this.baseHipsY = rig.bones.Hips.position.y;
    const { LeftUpLeg, LeftLeg, LeftFoot } = rig.bones;
    this.legLen = -LeftLeg.position.y - LeftFoot.position.y;
    void LeftUpLeg;
  }

  /** The current style. `'club'` is the freestyle repertoire. */
  get style(): DanceStyle {
    return this.styleName;
  }

  /** Change idiom. A style brings its own meter, counts, frame and steps. */
  setStyle(style: DanceStyle): void {
    this.styleName = style;
    this.lastCount = -1;
    this.feet.L = { x: 0, z: 0, tx: 0, tz: 0, lift: 0 };
    this.feet.R = { x: 0, z: 0, tx: 0, tz: 0, lift: 0 };
    this.carry = { x: 0, z: 0 };
    this.hipEcho = { x: 0, z: 0 };
  }

  /** Beats to the bar — 3 in a waltz, 4 everywhere else. */
  get meter(): number {
    return this.styleName === 'club' ? 4 : STYLES[this.styleName].beatsPerBar;
  }

  /** The count within the style's cycle (integer part), 0-based. */
  get count(): number {
    if (this.styleName !== 'club' && this.lastCount >= 0) return this.lastCount;
    const counts = this.styleName === 'club' ? 8 : STYLES[this.styleName].counts;
    return Math.floor(((this.phase % counts) + counts) % counts);
  }

  get dancing(): boolean {
    return this.target > 0;
  }

  /** Step onto the floor. Eases in from whatever the body was doing. */
  start(move?: DanceMove): void {
    if (move) this.use(move);
    if (this.target > 0) return;
    this.target = 1;
    this.bar = 0;
    this.beats = 0;
    for (const bone of DANCE_BONES) this.entry.set(bone, this.rig.bones[bone].quaternion.clone());
    const hp = this.rig.bones.Hips.position;
    this.entryHips = { x: hp.x, y: hp.y, z: hp.z };
  }

  /** Step off. Eases back toward the pose the dance began from. */
  stop(): void {
    this.target = 0;
  }

  /** Pick a skill and keep it — turns `auto` off. */
  use(move: DanceMove): void {
    this.move = move;
    this.auto = false;
  }

  /**
   * Drive the body. `pulse` is optional — with none the clock free-runs at
   * the last known tempo, which is what a floor does when the music skips.
   */
  update(dt: number, pulse?: DancePulse): void {
    // Ease on/off the floor.
    const rate = this.target > this.weight ? 2.6 : 3.4;
    this.weight += Math.sign(this.target - this.weight) * Math.min(dt * rate, Math.abs(this.target - this.weight));
    if (this.weight <= 0.0001) return;

    if (pulse) {
      if (pulse.bpm > 40 && pulse.bpm < 220) this.tempo = pulse.bpm;
      // NUDGED, never snapped: a beat pulls the phase a third of the way to
      // the nearest kick. Drift-and-correct is what a person looks like.
      if (pulse.beat) {
        const err = this.phase % 1;
        this.phase -= (err < 0.5 ? err : err - 1) * 0.35;
      }
      const want = clamp01(0.2 + pulse.bass * 0.75 + pulse.treble * 0.15);
      this.energy += (want - this.energy) * Math.min(1, dt * 3);
    }

    const before = this.phase;
    this.phase += (dt * this.tempo) / 60;
    if (Math.floor(before) !== Math.floor(this.phase)) {
      this.beats++;
      if (this.beats % this.meter === 0) {
        this.bar++;
        // A new skill every N bars — always a DIFFERENT one, or the change
        // is invisible and the repertoire may as well be one move.
        if (this.auto && this.bar > 0 && this.bar % this.barsPerMove === 0) {
          const others = DANCE_MOVES.filter((m) => m !== this.move);
          this.move = others[Math.floor(this.rand() * others.length)];
        }
      }
    }

    // This dancer's own clock: shared beat, private flair.
    const p = this.phase + (this.lag * this.tempo) / 60;
    const e = this.energy * this.amp;
    const frame =
      this.styleName === 'club'
        ? MOVES[this.move](((p % 1) + 1) % 1, ((p % 2) + 2) % 2, e, this.sign)
        : this.styledFrame(p, e, dt);

    const w = this.weight * this.weight * (3 - 2 * this.weight);
    for (const bone of DANCE_BONES) {
      this.q.identity();
      for (const [axis, angle] of frame.shape[bone] ?? []) {
        this.q.multiply(this.step.setFromAxisAngle(axis, angle));
      }
      const joint = this.rig.bones[bone];
      // From the ENTRY pose to the move, by weight — every frame is composed
      // fresh from rest, so nothing compounds and stop() can find its way back.
      joint.quaternion.copy(this.entry.get(bone)!).slerp(this.q, w);
    }
    const hips = this.rig.bones.Hips;
    hips.position.y = this.entryHips.y + (this.baseHipsY - frame.drop - this.entryHips.y) * w;
    hips.position.x = this.entryHips.x + this.carry.x * w;
    hips.position.z = this.entryHips.z + this.carry.z * w;
  }

  /**
   * The step engine. Counts pick chart entries; feet chase their targets;
   * the weight eases onto the support foot; the hips answer HALF A COUNT
   * LATE — that lag is Cuban motion, and turning it down is a waltz frame.
   */
  private styledFrame(p: number, e: number, dt: number): MoveFrame {
    const spec = STYLES[this.styleName as Exclude<DanceStyle, 'club'>];
    const c = ((p % spec.counts) + spec.counts) % spec.counts;
    const count = Math.floor(c);
    const stride = this.legLen * spec.reach * (0.5 + 0.5 * e);

    // A NEW count: commit the chart's step for it.
    if (count !== this.lastCount) {
      this.lastCount = count;
      const entry = spec.chart[count % spec.chart.length];
      if (entry.foot) {
        const f = this.feet[entry.foot];
        // The MARK, not the foot: the foot spends the count getting there.
        f.tx = (entry.dx ?? 0) * stride * 0.6;
        f.tz = (entry.dz ?? 0) * stride;
        f.lift = 1;
        this.support = entry.foot === 'L' ? 'R' : 'L';
      }
    }

    // Feet chase their marks inside the count; the lift arcs and lands.
    const chase = Math.min(1, dt * (this.tempo / 60) * 7);
    for (const side of ['L', 'R'] as const) {
      const f = this.feet[side];
      f.x += (f.tx - f.x) * chase;
      f.z += (f.tz - f.z) * chase;
      f.lift = Math.max(0, f.lift - dt * (this.tempo / 60) * 2.4);
    }
    // Weight eases to the support foot (mostly), and the hips echo it late.
    const sup = this.feet[this.support];
    const off = this.feet[this.support === 'L' ? 'R' : 'L'];
    const wx = sup.x * 0.65 + off.x * 0.35;
    const wz = sup.z * 0.65 + off.z * 0.35;
    this.carry.x += (wx - this.carry.x) * chase;
    this.carry.z += (wz - this.carry.z) * chase;
    const echo = Math.min(1, dt * (this.tempo / 60) * 2.2);
    this.hipEcho.x += (this.carry.x - this.hipEcho.x) * echo;
    this.hipEcho.z += (this.carry.z - this.hipEcho.z) * echo;

    // Pose the legs to REACH the feet: thighs from the offsets, knees from
    // the lift, ankles keeping the soles honest.
    const legs: Shape = {};
    for (const side of ['L', 'R'] as const) {
      const f = this.feet[side];
      const pre = side === 'L' ? 'Left' : 'Right';
      const relX = f.x - this.carry.x;
      const relZ = f.z - this.carry.z;
      const fwd = -Math.asin(Math.max(-0.9, Math.min(0.9, relZ / this.legLen)));
      const out = Math.asin(Math.max(-0.9, Math.min(0.9, relX / this.legLen))) * (side === 'L' ? 1 : 1);
      const knee = f.lift * 0.9 + Math.abs(fwd) * 0.25;
      legs[`${pre}UpLeg` as BoneName] = [[X, fwd - f.lift * 0.35], [Z, out * 0.8]];
      legs[`${pre}Leg` as BoneName] = [[X, knee]];
      legs[`${pre}Foot` as BoneName] = [[X, -(fwd - f.lift * 0.35) - knee * 0.8]];
    }

    // Cuban motion: the roll is the DIFFERENCE between where the weight is
    // and where the hips have got to — zero when they agree, biggest
    // mid-transfer, and always a little behind the feet. Lateral transfer
    // rolls the pelvis (Z); fore-and-aft transfer tips and turns it.
    const ax = (this.carry.x - this.hipEcho.x) * spec.hipAnswer;
    const az = (this.carry.z - this.hipEcho.z) * spec.hipAnswer;
    const hipShape: Shape = {
      Hips: [[Z, -ax * 3.2], [X, az * 1.6], [Y, az * 2.4 * this.sign]],
      Spine: [[Z, ax * 2.2], [X, -az * 1.1]],
    };

    const barPhase = (c % spec.beatsPerBar) / spec.beatsPerBar;
    const accent = spec.chart[count % spec.chart.length].accent ? Math.exp(-(c % 1) * 5) : 0;
    const accentShape: Shape = { Chest: [[X, 0.05 * accent * e]] };

    const shape = mergeShapes(
      spec.posture(e, this.sign),
      spec.upper(c, e, this.sign),
      legs,
      hipShape,
      accentShape
    );
    return { shape, drop: 0.02 * e - spec.lift(barPhase, e) };
  }
}
