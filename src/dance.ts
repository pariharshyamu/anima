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
  private entryHipsY = 0;
  private baseHipsY = 0;
  private q = new Quaternion();
  private step = new Quaternion();

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
    this.entryHipsY = this.rig.bones.Hips.position.y;
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
      if (this.beats % 4 === 0) {
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
    const frame = MOVES[this.move](
      ((p % 1) + 1) % 1,
      ((p % 2) + 2) % 2,
      this.energy * this.amp,
      this.sign
    );

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
    hips.position.y = this.entryHipsY + (this.baseHipsY - frame.drop - this.entryHipsY) * w;
  }
}
