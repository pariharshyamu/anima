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
export type DanceStyle =
  | 'club'
  | 'salsa'
  | 'waltz'
  | 'bhangra'
  /** The hit: move BETWEEN the beats, snap rigid ON them. */
  | 'popping'
  /** Wind up, point — and LOCK: the pause is the content. */
  | 'locking'
  /** One rotation travelling hand to hand — the body as a transmission line. */
  | 'waving'
  /** Right angles on the half-count. Dancing the grid, strictly. */
  | 'tutting'
  /** Breaking's standing footwork: the cross-step, rocked. */
  | 'toprock'
  /** Phrase time: the dancer arrives EARLY and the music catches up. */
  | 'ballet'
  /** Subdivision time: araimandi held, stamps on the ta-ka-di-mi. */
  | 'bharatanatyam'
  /** The legs walk forward; the body glides back. Apparent weight is a lie. */
  | 'moonwalk'
  /** Flat out, going nowhere: the run without the travel. */
  | 'runningMan'
  /** Sideways on rails — no steps anybody can see. */
  | 'glide'
  /** The jack: the torso at double time over fast, light feet. */
  | 'house'
  /** Poses hit as if photographed: the catwalk, then the frame, held. */
  | 'vogue'
  /** The energy ceiling: chest pops and stomps, deliberately off the grid. */
  | 'krump';

export const DANCE_STYLES: DanceStyle[] = [
  'club', 'salsa', 'waltz', 'bhangra',
  'popping', 'locking', 'waving', 'tutting', 'toprock',
  'ballet', 'bharatanatyam',
  'moonwalk', 'runningMan', 'glide', 'house',
  'vogue', 'krump',
];

/**
 * One step of an authored routine: a skill or a style, held for a counted
 * time. A routine is choreography AS DATA — the same steps handed to twenty
 * dancers is a chorus line; handed to one, it is a set.
 */
export interface RoutineStep {
  /** A club move to hold… */
  move?: DanceMove;
  /** …or a style to switch to. Style steps may also name a move for 'club'. */
  style?: DanceStyle;
  /** How long this step lasts, in counts of whatever meter is then active. */
  counts: number;
}

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
  /**
   * A second, quieter commitment for the OTHER foot on the same count — the
   * planted foot that slides back while the free one steps forward, which is
   * the whole running man.
   */
  also?: { foot: 'L' | 'R'; dx?: number; dz?: number };
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
  /**
   * Counts of anticipation. Ballet arrives EARLY and settles into the beat —
   * the exact opposite of the club's drift-late-and-correct — so its clock
   * runs ahead of everyone else's by this much.
   */
  lead?: number;
  /**
   * When the feet STRIKE, in cycle time. Not necessarily on the counts —
   * Bharatanatyam stamps the subdivisions — and every strike fires the
   * `onStamp` listeners, because a stamp is an event the world can hear.
   */
  stamps?: number[];
  /**
   * Root motion the hips do NOT answer, in stride units — the glides. The
   * weight-lag machinery is deliberately bypassed: a body that slides as one
   * rigid piece is exactly what makes a moonwalk look wrong in the right
   * way. Must be periodic with zero net drift; dancers stay on their spot.
   */
  travel?: (c: number, e: number) => { x: number; z: number };
}

/** Signed distance from `c` back to the most recent stamp, or Infinity. */
function sinceStamp(c: number, stamps: number[], cycle: number): number {
  let best = Infinity;
  for (const t of stamps) {
    let d = c - t;
    if (d < 0) d += cycle;
    if (d < best) best = d;
  }
  return best;
}

/** Wrap an angle into (−π, π] — the whip in a spotted turn lives here. */
const wrapPi = (a: number): number => {
  let x = a % (Math.PI * 2);
  if (x > Math.PI) x -= Math.PI * 2;
  if (x <= -Math.PI) x += Math.PI * 2;
  return x;
};

/** Deterministic 0–1 from an integer — a pose die that always lands the same. */
const hash = (i: number, salt: number): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * THE HIT. Street time is not smooth time: the pose change happens in the
 * first tenth of the count and the rest is stillness — a dime stop. Feed the
 * fractional count in, get the interpolation weight out: 0→1 fast, then held.
 */
const snapAt = (c: number, width = 0.12): number => {
  const f = c - Math.floor(c);
  const t = clamp01(f / width);
  return t * t * (3 - 2 * t);
};

/** Linear blend of two turn angles. */
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

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

  // THE HIT. Each count draws a fresh pose from a seeded table; the body
  // crosses to it in the first tenth of the count and then DOES NOT MOVE.
  // Everything the style is lives in that stillness — smooth it out and it
  // is just somebody swaying.
  popping: {
    beatsPerBar: 4,
    counts: 4,
    reach: 0,
    hipAnswer: 0,
    chart: [{}, {}, {}, {}],
    posture: (e) => ({
      LeftUpLeg: [[X, -0.06 * e]],
      RightUpLeg: [[X, -0.06 * e]],
      LeftLeg: [[X, 0.12 * e]],
      RightLeg: [[X, 0.12 * e]],
    }),
    upper: (c, e, s) => {
      const i = Math.floor(c);
      const t = snapAt(c);
      // The pose for count i, drawn from the die — and for i−1, to leave.
      // WRAPPED within the cycle, or the wrap from count 3 back to 0 leaves
      // from a pose nobody was ever in and the arm teleports half a radian.
      const wrap = (k: number) => ((k % 4) + 4) % 4;
      const pose = (k: number) => ({
        la: -(0.25 + 1.0 * hash(k, 1)) * e,
        lf: -(0.2 + 1.2 * hash(k, 2)) * e,
        lx: (hash(k, 3) - 0.5) * 1.2 * e,
        ra: (0.25 + 1.0 * hash(k, 4)) * e,
        rf: (0.2 + 1.2 * hash(k, 5)) * e,
        rx: (hash(k, 6) - 0.5) * 1.2 * e,
        hy: (hash(k, 7) - 0.5) * 0.7 * e * s,
        cy: (hash(k, 8) - 0.5) * 0.5 * e,
      });
      const a = pose(wrap(i - 1));
      const b = pose(wrap(i));
      return {
        LeftArm: [[Z, mix(a.la, b.la, t)]],
        LeftForeArm: [[Z, mix(a.lf, b.lf, t)], [X, mix(a.lx, b.lx, t)]],
        RightArm: [[Z, mix(a.ra, b.ra, t)]],
        RightForeArm: [[Z, mix(a.rf, b.rf, t)], [X, mix(a.rx, b.rx, t)]],
        Head: [[Y, mix(a.hy, b.hy, t)]],
        Chest: [[Y, mix(a.cy, b.cy, t)], [X, 0.03 * (1 - t)]],
      };
    },
    lift: () => 0,
  },

  // Wind up, POINT, LOCK. Counts 0–1 are fluid wrist circles, count 1 throws
  // the point, and counts 2–3.5 are a FREEZE — the pose function evaluated
  // at the instant the lock lands and then simply not asked again. The pause
  // is the content; everything else is how you arrive at it.
  locking: {
    beatsPerBar: 4,
    counts: 4,
    reach: 0,
    hipAnswer: 0,
    chart: [{}, {}, { accent: true }, {}],
    posture: (e) => ({
      LeftUpLeg: [[X, -0.08 * e]],
      RightUpLeg: [[X, -0.08 * e]],
      LeftLeg: [[X, 0.16 * e]],
      RightLeg: [[X, 0.16 * e]],
      Chest: [[X, 0.04 * e]],
    }),
    upper: (c, e, s) => {
      // THE FREEZE: from 2.0 to 3.5 the effective clock is pinned at 2.0.
      const cEff = c >= 2 && c < 3.5 ? 2 : c;
      if (cEff < 1) {
        // Wrist circles, twice round per count — the wind-up.
        const th = cEff * Math.PI * 4;
        return {
          LeftArm: [[Z, -HANG + 0.45 * e]],
          RightArm: [[Z, HANG - 0.45 * e]],
          LeftForeArm: [[Z, -0.8 * e], [X, Math.sin(th) * 0.5 * e]],
          RightForeArm: [[Z, 0.8 * e], [X, Math.cos(th) * 0.5 * e]],
          LeftHand: [[X, Math.cos(th) * 0.6 * e]],
          RightHand: [[X, Math.sin(th) * 0.6 * e]],
        };
      }
      if (cEff < 2) {
        // The point: one arm thrown straight out and across, head with it.
        const t = snapAt(cEff, 0.2);
        return {
          RightArm: [[Z, mix(HANG, 0.15, t)], [Y, -0.5 * t * s]],
          RightForeArm: [[Z, 0.1 * t]],
          LeftArm: [[Z, -HANG + 0.3 * e]],
          Head: [[Y, -0.4 * t * s]],
          Chest: [[Y, -0.15 * t * s]],
        };
      }
      if (cEff <= 2) {
        // THE LOCK: fists up, elbows down, chin tucked — held, not damped.
        return {
          LeftArm: [[Z, -0.9], [Y, 0.3]],
          RightArm: [[Z, 0.9], [Y, -0.3]],
          LeftForeArm: [[Z, -2.0]],
          RightForeArm: [[Z, 2.0]],
          LeftHand: [[X, 0.5]],
          RightHand: [[X, 0.5]],
          Chest: [[X, 0.08]],
          Head: [[X, 0.1]],
        };
      }
      // Recover to standing through the last half count.
      const t = 1 - clamp01((c - 3.5) / 0.5);
      return {
        LeftArm: [[Z, mix(-HANG, -0.9, t)]],
        RightArm: [[Z, mix(HANG, 0.9, t)]],
        LeftForeArm: [[Z, -2.0 * t]],
        RightForeArm: [[Z, 2.0 * t]],
        Chest: [[X, 0.08 * t]],
      };
    },
    lift: () => 0,
  },

  // The body as a transmission line: one rotation enters at the left hand
  // and leaves at the right, each joint a fixed delay behind the last — the
  // ragged oar crew's ripple, danced. Nothing here is a pose; it is a WAVE,
  // and the joints are just where it happens to be passing through.
  waving: {
    beatsPerBar: 4,
    counts: 4,
    reach: 0,
    hipAnswer: 0,
    chart: [{}, {}, {}, {}],
    posture: () => ({
      // Arms carried out, a little below shoulder — the wire the wave rides.
      LeftArm: [[Z, -0.22]],
      RightArm: [[Z, 0.22]],
    }),
    upper: (c, e, s) => {
      const th = (c / 2) * Math.PI * 2 * s;
      const at = (delay: number) => Math.sin(th - delay) * 0.42 * e;
      return {
        LeftHand: [[X, at(0)]],
        LeftForeArm: [[X, at(0.55)]],
        LeftArm: [[X, at(1.1)]],
        Chest: [[X, at(1.6) * 0.25], [Z, at(1.6) * 0.15]],
        RightArm: [[X, at(2.1)]],
        RightForeArm: [[X, at(2.65)]],
        RightHand: [[X, at(3.2)]],
        Head: [[Z, at(1.6) * 0.2]],
      };
    },
    lift: () => 0,
  },

  // Right angles on the half-count, snapped harder than popping and held
  // dead flat between — the grid danced as strictly as it can be.
  tutting: {
    beatsPerBar: 4,
    counts: 8,
    reach: 0,
    hipAnswer: 0,
    chart: [{}, {}, {}, {}, {}, {}, {}, {}],
    posture: (e) => ({
      LeftLeg: [[X, 0.1 * e]],
      RightLeg: [[X, 0.1 * e]],
      LeftUpLeg: [[X, -0.05 * e]],
      RightUpLeg: [[X, -0.05 * e]],
    }),
    upper: (c, e, s) => {
      const H = Math.PI / 2;
      // Eight frames of boxes: [LArm z, LFore z, LFore x, RArm z, RFore z, RFore x]
      const FRAMES = [
        [-H, -H, 0, H, H, 0],
        [-H, -H, H, H, H, -H],
        [-H, 0, H, H, 0, -H],
        [-H / 2, -H, 0, H / 2, H, 0],
        [-H, -H, -H, H, H, H],
        [-H, 0, 0, H, H, -H],
        [-H / 2, -H, H, H, 0, 0],
        [-H, -H, 0, H / 2, H, H],
      ];
      const step = Math.floor(c * 2);
      const t = snapAt(c * 2, 0.13);
      const a = FRAMES[((step - 1) % 8 + 8) % 8];
      const b = FRAMES[step % 8];
      const g = (k: number) => mix(a[k], b[k], t) * (0.6 + 0.4 * e);
      return {
        LeftArm: [[Z, g(0)]],
        LeftForeArm: [[Z, g(1)], [X, g(2)]],
        RightArm: [[Z, g(3)]],
        RightForeArm: [[Z, g(4)], [X, g(5)]],
        Head: [[Y, (step % 2 === 0 ? 0.12 : -0.12) * s * t]],
      };
    },
    lift: () => 0,
  },

  // Toprock: the cross-step, on the 0.24 step engine — kick across, back,
  // other side — with the arms rocking open and closed against the feet.
  toprock: {
    beatsPerBar: 4,
    counts: 4,
    reach: 0.6,
    hipAnswer: 0.3,
    chart: [
      { foot: 'L', dz: 1, dx: -0.5, accent: true },
      { foot: 'L' },
      { foot: 'R', dz: 1, dx: 0.5, accent: true },
      { foot: 'R' },
    ],
    posture: (e) => ({
      Chest: [[X, -0.05 * e]],
      Head: [[X, 0.04 * e]],
    }),
    upper: (c, e, s) => {
      // Arms cross the chest on the kick and swing open on the return.
      const open = Math.sin(c * Math.PI) * e;
      const bounce = Math.exp(-(c % 1) * 5) * e;
      return {
        LeftArm: [[Z, -HANG + (0.5 + 0.45 * open) * e], [Y, 0.5 * (1 - open)]],
        RightArm: [[Z, HANG - (0.5 + 0.45 * open) * e], [Y, -0.5 * (1 - open)]],
        LeftForeArm: [[Z, -0.7 - 0.3 * (1 - open)]],
        RightForeArm: [[Z, 0.7 + 0.3 * (1 - open)]],
        Chest: [[Y, 0.12 * open * s], [X, 0.05 * bounce]],
        Head: [[Y, -0.07 * open * s]],
      };
    },
    lift: (barPhase, e) => Math.abs(Math.sin(barPhase * Math.PI * 2)) * 0.015 * e,
  },

  // PHRASE TIME. Nothing here lands ON a beat: the phrase is twelve counts
  // of 3/4 — plié and port de bras out, the arabesque line, the arms
  // gathering to fifth, and a PIROUETTE — and the whole thing runs a fifth
  // of a count EARLY, because a dancer arrives and settles where everyone
  // else drifts and corrects. The head does the one sharp thing ballet
  // allows: it SPOTS — holds the audience as long as the neck can bear,
  // then whips round ahead of the body to find them again.
  ballet: {
    beatsPerBar: 3,
    counts: 12,
    reach: 0,
    hipAnswer: 0,
    lead: 0.2,
    chart: new Array(12).fill({}),
    posture: (e) => ({
      // Turnout from the hips, a lifted chest, and arms rounded low —
      // held under the whole phrase, never dropped.
      LeftUpLeg: [[Y, 0.35]],
      RightUpLeg: [[Y, -0.35]],
      Chest: [[X, -0.07 * (0.5 + 0.5 * e)]],
      Neck: [[X, -0.03]],
      LeftArm: [[Z, -HANG + 0.35]],
      RightArm: [[Z, HANG - 0.35]],
      LeftForeArm: [[Z, -0.5], [Y, 0.25]],
      RightForeArm: [[Z, 0.5], [Y, -0.25]],
    }),
    upper: (c, e, s) => {
      const amp = 0.55 + 0.45 * e;
      if (c < 3) {
        // Bar 1: plié as the arms open from low first toward second.
        const t = (c / 3) * (c / 3) * (3 - 2 * (c / 3));
        return {
          LeftArm: [[Z, mix(0, -0.55, t) * amp]],
          RightArm: [[Z, mix(0, 0.55, t) * amp]],
          LeftForeArm: [[Z, mix(0, 0.3, t)]],
          RightForeArm: [[Z, mix(0, -0.3, t)]],
          Head: [[Y, 0.12 * t * s]],
        };
      }
      if (c < 6) {
        // Bar 2: the line — one leg unfolds behind, arms allongé.
        const t = Math.sin(((c - 3) / 3) * Math.PI);
        const back = s > 0 ? 'Left' : 'Right';
        return {
          [`${back}UpLeg`]: [[X, 0.85 * t * amp]],
          [`${back}Leg`]: [[X, -0.1 * t]],
          Chest: [[X, 0.22 * t * amp]],
          Head: [[X, -0.18 * t]],
          LeftArm: [[Z, -0.75 * t * amp]],
          RightArm: [[Z, 0.75 * t * amp]],
          LeftForeArm: [[Z, 0.25 * t]],
          RightForeArm: [[Z, -0.25 * t]],
        } as Shape;
      }
      if (c < 9) {
        // Bar 3: gather — the arms rise through first to FIFTH, overhead.
        const t = (c - 6) / 3;
        const sm = t * t * (3 - 2 * t);
        return {
          LeftArm: [[Z, mix(-0.55, -2.3, sm) * amp]],
          RightArm: [[Z, mix(0.55, 2.3, sm) * amp]],
          LeftForeArm: [[Z, mix(0.3, -0.45, sm)], [Y, 0.3 * sm]],
          RightForeArm: [[Z, mix(-0.3, 0.45, sm)], [Y, -0.3 * sm]],
          Head: [[X, -0.08 * sm]],
        };
      }
      // Bar 4: THE PIROUETTE. The body turns a full 2π across a count and a
      // half, on relevé, arms held in first; then lands and settles. The
      // head SPOTS: it cancels the body's turn as far as the neck allows,
      // and when the wrapped angle flips sign it whips through — one fast
      // move per revolution, which is exactly what spotting is.
      const t = clamp01((c - 9) / 1.5);
      const settle = clamp01((c - 10.5) / 1.5);
      const yaw = t * t * (3 - 2 * t) * Math.PI * 2 * s;
      const spot = Math.max(-1.15, Math.min(1.15, -wrapPi(yaw)));
      return {
        Hips: [[Y, yaw]],
        Head: [[Y, spot * (1 - settle)]],
        LeftArm: [[Z, (-0.45 - 0.3 * (1 - settle)) * amp]],
        RightArm: [[Z, (0.45 + 0.3 * (1 - settle)) * amp]],
        LeftForeArm: [[Z, -0.55], [Y, 0.5 * (1 - settle)]],
        RightForeArm: [[Z, 0.55], [Y, -0.5 * (1 - settle)]],
      };
    },
    // Plié into bar 1, relevé (risen) through the pirouette.
    lift: () => 0,
  },

  // SUBDIVISION TIME. Araimandi — the half-sit — is HELD for the whole
  // dance; the stamps land on the ta-ka-di-mi, twice as fine as the count;
  // the arms hold geometric lines that change like flags, not like limbs.
  // Every stamp fires `onStamp`: a stamp is a fact the floor can hear.
  bharatanatyam: {
    beatsPerBar: 4,
    counts: 8,
    reach: 0,
    hipAnswer: 0,
    // The adavu: singles on 0–3, then ta-ka-di-mi doubles across 4–6, land 7.
    stamps: [0, 1, 2, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7],
    chart: new Array(8).fill({}),
    posture: (e) => ({
      // Araimandi: knees out over turned-out feet, half sat, back tall.
      LeftUpLeg: [[Y, 0.55], [X, -0.5]],
      RightUpLeg: [[Y, -0.55], [X, -0.5]],
      LeftLeg: [[X, 1.0]],
      RightLeg: [[X, 1.0]],
      LeftFoot: [[X, -0.5]],
      RightFoot: [[X, -0.5]],
      Chest: [[X, -0.04 * e]],
    }),
    upper: (c, e, s) => {
      const spec = STYLES.bharatanatyam;
      const since = sinceStamp(c, spec.stamps!, 8);
      const strike = Math.exp(-since * 9);
      // Which foot stamps alternates with the count of stamps passed.
      let idx = 0;
      for (const t of spec.stamps!) if (t <= c) idx++;
      const side = idx % 2 === 0 ? 'Left' : 'Right';
      const legShape: Shape = {
        [`${side}UpLeg`]: [[X, -0.45 * strike]],
        [`${side}Leg`]: [[X, 0.55 * strike]],
        [`${side}Foot`]: [[X, 0.3 * strike]],
      } as Shape;
      // The arms: flat geometric lines — straight out (pataka) for half the
      // cycle, one bent to the chest for the other half — snapped like
      // tutting but held DEAD level; the head slides against the line.
      const half = Math.floor(c / 2) % 2 === 0;
      const t = snapAt(c / 2, 0.1);
      const arms: Shape = half
        ? {
            LeftArm: [[Z, mix(-0.6, -0.05, t)]],
            RightArm: [[Z, mix(0.6, 0.05, t)]],
            LeftHand: [[Z, -0.5]],
            RightHand: [[Z, 0.5]],
          }
        : {
            LeftArm: [[Z, mix(-0.05, -0.6, t)], [Y, 0.8 * t]],
            RightArm: [[Z, mix(0.05, 0.6, t)]],
            LeftForeArm: [[Z, -1.5 * t]],
            RightHand: [[Z, 0.5]],
          };
      return mergeShapes(legShape, arms, {
        Neck: [[Z, 0.14 * Math.sin(c * Math.PI) * s]],
        Head: [[Z, -0.2 * Math.sin(c * Math.PI) * s]],
      });
    },
    lift: () => 0,
  },

  // THE ILLUSION, stated as data: the chart says the feet WALK FORWARD, the
  // travel says the body GLIDES BACK, and the contradiction is the dance.
  // Four counts of moonwalk, then four of honest forward walking to come
  // home — the lie and the truth, juxtaposed every cycle.
  moonwalk: {
    beatsPerBar: 4,
    counts: 8,
    reach: 0.45,
    hipAnswer: 0,
    chart: [
      { foot: 'L', dz: 0.8 },
      { foot: 'R', dz: 0.8 },
      { foot: 'L', dz: 0.8 },
      { foot: 'R', dz: 0.8 },
      { foot: 'L', dz: 0.4 },
      { foot: 'R', dz: 0.4 },
      { foot: 'L', dz: 0 },
      { foot: 'R', dz: 0 },
    ],
    // Back a full stride over counts 0–4, forward again over 4–8. Zero mean.
    travel: (c) => ({ x: 0, z: c < 4 ? -(c / 4) * 2.2 : -((8 - c) / 4) * 2.2 }),
    posture: (e) => ({
      Chest: [[X, 0.1 * e]],
      Head: [[X, -0.08 * e]],
    }),
    upper: (c, e, s) => {
      // The gliding half keeps the arms eerily still; the walking half swings
      // them honestly — the same contrast the feet are making.
      const gliding = c < 4;
      const sw = Math.sin(c * Math.PI) * e * (gliding ? 0.15 : 0.6);
      return {
        LeftArm: [[Z, -HANG + 0.1 * e], [X, sw]],
        RightArm: [[Z, HANG - 0.1 * e], [X, -sw]],
        LeftForeArm: [[Z, -0.15 - (gliding ? 0 : 0.2 * e)]],
        RightForeArm: [[Z, 0.15 + (gliding ? 0 : 0.2 * e)]],
        // The trailing heel pops UP on the glide — the push the eye misses.
        [c % 2 === 0 ? 'RightFoot' : 'LeftFoot']: [[X, gliding ? 0.55 : 0]],
      } as Shape;
    },
    lift: () => 0,
  },

  // Flat out, going nowhere. Every count one foot drives forward with the
  // knee high while the OTHER — the `also` — slides back under the body, so
  // the legs scissor at full stride and the hips never leave the spot.
  runningMan: {
    beatsPerBar: 4,
    counts: 4,
    reach: 0.7,
    hipAnswer: 0,
    chart: [
      { foot: 'L', dz: 1, accent: true, also: { foot: 'R', dz: -0.7 } },
      { foot: 'R', dz: 1, accent: true, also: { foot: 'L', dz: -0.7 } },
      { foot: 'L', dz: 1, accent: true, also: { foot: 'R', dz: -0.7 } },
      { foot: 'R', dz: 1, accent: true, also: { foot: 'L', dz: -0.7 } },
    ],
    posture: (e) => ({
      Chest: [[X, 0.12 * e]],
    }),
    upper: (c, e, s) => {
      const pump = Math.sin(c * Math.PI * 2) * e * s;
      const bounce = Math.exp(-(c % 1) * 5) * e;
      return {
        LeftArm: [[Z, -HANG + 0.3 * e], [X, pump]],
        RightArm: [[Z, HANG - 0.3 * e], [X, -pump]],
        LeftForeArm: [[Z, -0.85 * e]],
        RightForeArm: [[Z, 0.85 * e]],
        Head: [[X, 0.06 * bounce]],
        Chest: [[X, 0.05 * bounce]],
      };
    },
    lift: (barPhase, e) => Math.abs(Math.sin(barPhase * Math.PI * 4)) * 0.035 * e,
  },

  // Sideways on rails. The knees barely bend, the feet never visibly step,
  // and the body crosses a metre of floor anyway — left for four counts,
  // right for four, home every cycle by construction.
  glide: {
    beatsPerBar: 4,
    counts: 8,
    reach: 0.3,
    hipAnswer: 0,
    chart: new Array(8).fill({}),
    travel: (c) => ({
      x: c < 4 ? Math.sin((c / 4) * Math.PI) * 2.4 : -Math.sin(((c - 4) / 4) * Math.PI) * 2.4,
      z: 0,
    }),
    posture: (e) => ({
      LeftLeg: [[X, 0.06 * e]],
      RightLeg: [[X, 0.06 * e]],
    }),
    upper: (c, e, s) => {
      // Arms out like a wire-walker, tilting INTO the travel; the trailing
      // heel lifts, which is the entire visible mechanism.
      const dir = c < 4 ? 1 : -1;
      const t = Math.sin(((c % 4) / 4) * Math.PI);
      return {
        LeftArm: [[Z, -0.35 - 0.15 * dir * t * e]],
        RightArm: [[Z, 0.35 - 0.15 * dir * t * e]],
        LeftForeArm: [[X, 0.2 * Math.sin(c * Math.PI) * e * s]],
        RightForeArm: [[X, -0.2 * Math.sin(c * Math.PI) * e * s]],
        Chest: [[Z, 0.08 * dir * t * e]],
        Head: [[Z, -0.06 * dir * t * e]],
        [dir > 0 ? 'RightFoot' : 'LeftFoot']: [[X, 0.45 * t]],
      } as Shape;
    },
    lift: () => 0,
  },

  // House: THE JACK — the torso waves at DOUBLE the count, rippling spine to
  // head a fraction late, over fast light skating feet. Two clocks in one
  // body, and the ratio between them is the style.
  house: {
    beatsPerBar: 4,
    counts: 8,
    reach: 0.35,
    hipAnswer: 0.3,
    chart: [
      { foot: 'L', dx: 0.8, dz: 0.3 },
      { foot: 'R', dx: -0.4 },
      { foot: 'R', dx: -0.8, dz: 0.3 },
      { foot: 'L', dx: 0.4 },
      { foot: 'L', dx: 0.8, dz: -0.3 },
      { foot: 'R', dx: -0.4 },
      { foot: 'R', dx: -0.8, dz: -0.3 },
      { foot: 'L', dx: 0.4 },
    ],
    posture: (e) => ({
      LeftUpLeg: [[X, -0.08 * e]],
      RightUpLeg: [[X, -0.08 * e]],
      LeftLeg: [[X, 0.16 * e]],
      RightLeg: [[X, 0.16 * e]],
    }),
    upper: (c, e, s) => {
      // The jack: 2x the count, and each segment a phase step behind the one
      // below — the wave machinery, turned vertical and doubled.
      const th = c * Math.PI * 2 * 2;
      const jack = (delay: number) => Math.sin(th - delay) * 0.16 * e;
      return {
        Spine: [[X, jack(0)]],
        Chest: [[X, jack(0.7)]],
        Neck: [[X, jack(1.3)]],
        Head: [[X, jack(1.9)]],
        LeftArm: [[Z, -HANG + 0.35 * e], [X, jack(1.0) * s]],
        RightArm: [[Z, HANG - 0.35 * e], [X, -jack(1.0) * s]],
        LeftForeArm: [[Z, -0.5 * e]],
        RightForeArm: [[Z, 0.5 * e]],
      };
    },
    lift: (barPhase, e) => Math.abs(Math.sin(barPhase * Math.PI * 4)) * 0.02 * e,
  },

  // Dancing for a camera that is not there. Four counts of catwalk — the
  // crossing strut, hips fully answered — then two POSES, hit like
  // photographs and HELD: the freeze machinery again, framed. The pose die
  // draws arms around the face, the head finds the lens, and the picture
  // stays up long enough to be taken.
  vogue: {
    beatsPerBar: 4,
    counts: 8,
    reach: 0.5,
    hipAnswer: 1.2,
    chart: [
      { foot: 'L', dz: 1, dx: -0.6, accent: true },
      { foot: 'R', dz: 1, dx: 0.6, accent: true },
      { foot: 'L', dz: 0.4, dx: -0.6 },
      { foot: 'R', dz: 0, dx: 0 },
      {}, {}, {}, {},
    ],
    posture: (e) => ({
      Chest: [[X, -0.06 * e]],
      Head: [[X, -0.04 * e]],
    }),
    upper: (c, e, s) => {
      if (c < 4) {
        // The catwalk: shoulders back, wrists trailing, chin up.
        const sw = Math.sin(c * Math.PI) * e * s;
        return {
          LeftArm: [[Z, -HANG + 0.25 * e], [X, 0.3 * sw]],
          RightArm: [[Z, HANG - 0.25 * e], [X, -0.3 * sw]],
          LeftHand: [[Z, -0.5]],
          RightHand: [[Z, 0.5]],
          Chest: [[Y, 0.1 * sw]],
          Head: [[Y, -0.06 * sw], [X, -0.06 * e]],
        };
      }
      // Two held frames: the pose lands at 4 and at 6 and DOES NOT MOVE.
      const which = c < 6 ? 0 : 1;
      const cEff = which === 0 ? Math.min(c, 4.35) : Math.min(c, 6.35);
      const t = snapAt((cEff - 4) / 2 * 2, 0.18);
      const bar = Math.floor(c / 8);
      const die = (k: number) => hash(bar * 2 + which, k);
      const side = die(9) < 0.5 ? 1 : -1;
      // One arm frames the face, the other presents; alternate by the die.
      const frame = {
        arm: -2.15 - 0.25 * die(1),
        fore: -2.3 + 0.4 * die(2),
        other: 0.6 + 0.6 * die(3),
        head: (0.25 + 0.2 * die(4)) * side * s,
      };
      const L = side > 0;
      return {
        [L ? 'LeftArm' : 'RightArm']: [[Z, (L ? 1 : -1) * frame.arm * t]],
        [L ? 'LeftForeArm' : 'RightForeArm']: [[Z, (L ? 1 : -1) * frame.fore * t]],
        [L ? 'RightArm' : 'LeftArm']: [[Z, (L ? -1 : 1) * frame.other * t], [Y, (L ? -1 : 1) * 0.4 * t]],
        [L ? 'RightForeArm' : 'LeftForeArm']: [[Z, (L ? -1 : 1) * 0.3 * t]],
        Head: [[Z, frame.head * t], [Y, 0.15 * side * t]],
        Chest: [[Y, -0.12 * side * t], [Z, 0.05 * side * t]],
      } as Shape;
    },
    lift: () => 0,
  },

  // THE ENERGY CEILING. Krump is what proves the energy model: amplitudes
  // half again over anything else, chest pops driven off the stomps, and the
  // stomps land OFF the grid — a syncopated schedule no other style would
  // tolerate. The stomps fire onStamp: a krump floor answers back.
  krump: {
    beatsPerBar: 4,
    counts: 4,
    reach: 0.45,
    hipAnswer: 0.5,
    stamps: [0, 0.75, 2, 2.5, 3.25],
    chart: [
      { foot: 'L', dz: 0.5, dx: 0.4, accent: true },
      { foot: 'R', dz: -0.3, dx: -0.5 },
      { foot: 'R', dz: 0.5, dx: -0.4, accent: true },
      { foot: 'L', dz: -0.3, dx: 0.5 },
    ],
    posture: (e) => ({
      LeftUpLeg: [[X, -0.1 * e]],
      RightUpLeg: [[X, -0.1 * e]],
      LeftLeg: [[X, 0.2 * e]],
      RightLeg: [[X, 0.2 * e]],
      Chest: [[X, 0.1 * e]],
    }),
    upper: (c, e0, s) => {
      // The ceiling: half again over anything else in the building.
      const e = Math.min(1.3, e0 * 1.5);
      const spec = STYLES.krump;
      const since = sinceStamp(c, spec.stamps!, 4);
      const pop = Math.exp(-since * 7);
      const i = Math.floor(c * 2);
      const throwArm = (k: number) => (hash(i, k) - 0.3) * 1.6 * e;
      const t = snapAt(c * 2, 0.25);
      return {
        Chest: [[X, 0.28 * pop], [Y, (hash(i, 6) - 0.5) * 0.5 * e * t]],
        Spine: [[X, 0.14 * pop]],
        Head: [[X, -0.15 * pop], [Y, (hash(i, 7) - 0.5) * 0.5 * s * t]],
        LeftArm: [[Z, -HANG + Math.max(0, throwArm(1)) * t], [X, throwArm(2) * t]],
        RightArm: [[Z, HANG - Math.max(0, throwArm(3)) * t], [X, throwArm(4) * t]],
        LeftForeArm: [[Z, -0.5 - 0.7 * hash(i, 5) * e * t]],
        RightForeArm: [[Z, 0.5 + 0.7 * hash(i, 8) * e * t]],
      };
    },
    lift: () => 0,
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
  private lastCycleTime = -1;
  private stampCbs = new Set<() => void>();
  /** This frame's glide offset (metres), applied to the root, never the hips' answer. */
  private travelNow = { x: 0, z: 0 };
  private routineSteps: RoutineStep[] | null = null;
  private routineIdx = 0;
  private routineLeft = 0;
  private routineLoop = false;
  private routineStrict = false;
  /** Flair stashed while a strict routine runs a chorus line. */
  private flair: { lag: number; amp: number; sign: number } | null = null;

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
    this.lastCycleTime = -1;
    this.travelNow = { x: 0, z: 0 };
  }

  /**
   * Hand the dancer a set: choreography as data. Each step is a skill or a
   * style held for a counted time; `loop` repeats it until told otherwise,
   * and `strict` zeroes this dancer's flair for the duration — the same
   * strict routine on twenty dancers is a CHORUS LINE, to the quaternion.
   * A finished (non-looping) routine hands back to `auto` improvisation.
   */
  routine(steps: RoutineStep[], opts: { loop?: boolean; strict?: boolean } = {}): void {
    if (!steps.length) return;
    this.routineSteps = steps;
    this.routineIdx = -1;
    this.routineLeft = 0;
    this.routineLoop = opts.loop ?? false;
    this.routineStrict = opts.strict ?? false;
    if (this.routineStrict && !this.flair) {
      this.flair = { lag: this.lag, amp: this.amp, sign: this.sign };
      this.lag = 0;
      this.amp = 1;
      this.sign = 1;
    }
    this.advanceRoutine();
  }

  /** Tear up the set list; flair comes back with it. */
  clearRoutine(): void {
    this.routineSteps = null;
    if (this.flair) {
      this.lag = this.flair.lag;
      this.amp = this.flair.amp;
      this.sign = this.flair.sign;
      this.flair = null;
    }
  }

  /** Which step of the routine is playing, or -1. */
  get routineStep(): number {
    return this.routineSteps ? this.routineIdx : -1;
  }

  private advanceRoutine(): void {
    if (!this.routineSteps) return;
    this.routineIdx++;
    if (this.routineIdx >= this.routineSteps.length) {
      if (this.routineLoop) this.routineIdx = 0;
      else {
        // The set is over: keep the last shape on, hand back to improv.
        this.clearRoutine();
        this.auto = true;
        return;
      }
    }
    const step = this.routineSteps[this.routineIdx];
    this.routineLeft = Math.max(1, step.counts);
    if (step.style && step.style !== this.styleName) this.setStyle(step.style);
    if (step.move) {
      this.move = step.move;
      this.auto = false;
    }
  }

  /**
   * Hear the feet. Bharatanatyam's stamps land here — on the subdivisions,
   * not the counts — and anything can listen: a floor tile, a sound, a
   * drummer answering back. Returns the unsubscribe.
   */
  onStamp(cb: () => void): () => void {
    this.stampCbs.add(cb);
    return () => this.stampCbs.delete(cb);
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
      if (this.routineSteps) {
        this.routineLeft--;
        if (this.routineLeft <= 0) this.advanceRoutine();
      }
      if (this.beats % this.meter === 0) {
        this.bar++;
        // A new skill every N bars — always a DIFFERENT one, or the change
        // is invisible and the repertoire may as well be one move.
        if (this.auto && !this.routineSteps && this.bar > 0 && this.bar % this.barsPerMove === 0) {
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
    hips.position.x = this.entryHips.x + (this.carry.x + this.travelNow.x) * w;
    hips.position.z = this.entryHips.z + (this.carry.z + this.travelNow.z) * w;
  }

  /**
   * The step engine. Counts pick chart entries; feet chase their targets;
   * the weight eases onto the support foot; the hips answer HALF A COUNT
   * LATE — that lag is Cuban motion, and turning it down is a waltz frame.
   */
  private styledFrame(p: number, e: number, dt: number): MoveFrame {
    const spec = STYLES[this.styleName as Exclude<DanceStyle, 'club'>];
    // Anticipation: a style with a lead evaluates AHEAD of the shared clock.
    const led = p + (spec.lead ?? 0);
    const c = ((led % spec.counts) + spec.counts) % spec.counts;
    // Stamps: fire every strike the clock has crossed since last frame.
    if (spec.stamps && this.lastCycleTime >= 0) {
      for (const t of spec.stamps) {
        const crossed =
          this.lastCycleTime < c
            ? t > this.lastCycleTime && t <= c
            : t > this.lastCycleTime || t <= c; // the cycle wrapped
        if (crossed) for (const cb of this.stampCbs) cb();
      }
    }
    this.lastCycleTime = c;
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
      if (entry.also) {
        // The quiet half of the illusion: the planted foot re-marks WITHOUT
        // a lift — it slides, it does not step, and nobody is meant to see.
        const f = this.feet[entry.also.foot];
        f.tx = (entry.also.dx ?? 0) * stride * 0.6;
        f.tz = (entry.also.dz ?? 0) * stride;
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

    // The glides: root motion ON TOP of the weight, which the hip-answer
    // machinery never sees — a body that slides as one rigid piece is what
    // makes a moonwalk read as a moonwalk.
    const tv = spec.travel ? spec.travel(c, e) : { x: 0, z: 0 };
    this.travelNow.x = tv.x * stride * 0.6;
    this.travelNow.z = tv.z * stride;
    const rootX = this.carry.x + this.travelNow.x;
    const rootZ = this.carry.z + this.travelNow.z;

    // Pose the legs to REACH the feet: thighs from the offsets, knees from
    // the lift, ankles keeping the soles honest.
    const legs: Shape = {};
    for (const side of ['L', 'R'] as const) {
      const f = this.feet[side];
      const pre = side === 'L' ? 'Left' : 'Right';
      const relX = f.x - rootX;
      const relZ = f.z - rootZ;
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
    // Some postures ARE a height: araimandi sits a tenth of the leg down and
    // stays there; a pirouette rises onto relevé for exactly its count and a
    // half. Held sits belong to the style, not to the moment.
    let sit = 0.02 * e;
    if (this.styleName === 'bharatanatyam') sit = this.legLen * 0.16;
    if (this.styleName === 'ballet') {
      const t = ((c % 12) + 12) % 12;
      if (t < 3) sit = 0.03 + 0.05 * Math.sin((t / 3) * Math.PI);
      else if (t >= 9 && t < 10.5) sit = -0.035;
      else sit = 0.03;
    }
    return { shape, drop: sit - spec.lift(barPhase, e) };
  }
}
