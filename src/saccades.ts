/**
 * Saccades — the eye does not glide, and how fast it goes is not a choice.
 *
 * Every rig that moves its eyes lerps them: pick a speed, ease toward the
 * target, done. Real eyes do not do that at any speed. A saccade is BALLISTIC —
 * launched, uncorrectable, and over in a few tens of milliseconds — and its
 * kinematics are pinned by one of the most reproduced results in oculomotor
 * physiology.
 *
 * ## The main sequence
 *
 * Bahill, Clark and Stark (1975) named it after the stellar diagram, because
 * saccades occupy a line rather than a cloud: amplitude alone predicts both how
 * long the movement takes and how fast it gets.
 *
 * ```
 *   duration        D = 2.2 A + 21          milliseconds, A in degrees
 *   peak velocity   V = Vmax (1 − e^(−A/C)) with Vmax ≈ 500 °/s, C ≈ 7°
 * ```
 *
 * TWO LAWS FOR ONE MOVEMENT IS ONE LAW MORE THAN IS NEEDED, and that is the
 * whole reason this file can be checked. The model here uses ONLY the duration
 * law. It never reads `PEAK_VELOCITY_MAX` or `VELOCITY_CONSTANT` — those exist
 * so `npm run saccades` can ask an independent question: given a movement built
 * to last as long as Bahill says, does it come out as FAST as Bahill says?
 *
 * ## Which fixes the shape, and it is not the obvious one
 *
 * A movement of amplitude A in duration D has mean velocity A/D. Divide the
 * published peak by that mean and a pure number falls out, and it is the shape
 * of the velocity profile:
 *
 * ```
 *    2°     1.58        a parabola would give        1.50
 *    5°     1.63        a half-sine                  1.571
 *   10°     1.63        a raised cosine              2.00
 *   20°     1.53        a triangle                   2.00
 * ```
 *
 * So the two published laws, between them, say the eye's velocity is very close
 * to a HALF-SINE — which makes the position a raised cosine, and which is not
 * what anybody reaches for. The smoothstep in every easing library is the
 * raised-cosine VELOCITY on that list, and it overshoots the published peak by a
 * quarter. Nothing here chose a half-sine; it is what is left when both laws
 * have to hold at once.
 *
 * Above about 20° the ratio starts to fall, because real large saccades are
 * skewed — a short acceleration and a long deceleration tail (Van Opstal & Van
 * Gisbergen 1987). No fixed profile can follow that, and this one does not try;
 * see the bottom of the docs.
 *
 * ## And where it looks is the task
 *
 * Yarbus (1967) showed the same painting to the same viewers under different
 * questions and got completely different scanpaths — the eyes went to clothing
 * when asked about wealth and to faces when asked about ages. The scanpath is
 * not a property of the picture. It is a property of the question.
 *
 * So, exactly as with blinking, this has no fixation-time parameter. It has a
 * task, and Rayner's (1998, 2009) reviews supply the numbers.
 */

/**
 * The duration law: milliseconds per degree, and the fixed cost of launching.
 *
 * Bahill, Clark & Stark (1975). In seconds here, because everything else in
 * this library is.
 */
export const SACCADE_SLOPE = 0.0022;
/** ...and the intercept — a saccade of no size still takes 21 ms. */
export const SACCADE_INTERCEPT = 0.021;

/**
 * The peak-velocity law. **THE MODEL DOES NOT USE THESE.**
 *
 * `V = PEAK_VELOCITY_MAX (1 − e^(−A / VELOCITY_CONSTANT))`, the second half of
 * the main sequence. It is exported so the gate can hold the model to a number
 * that never went into it — a formula checked against itself is not checked.
 * If you find either of these referenced anywhere below, the gate has stopped
 * being evidence.
 */
export const PEAK_VELOCITY_MAX = 500;
/** ...and the amplitude at which the peak velocity has reached 63% of its max. */
export const VELOCITY_CONSTANT = 7;

/**
 * How the eye is aimed, and how long it dwells, by what the viewer is doing.
 *
 * Rayner (1998) and (2009), reviewing several decades of eye-tracking. DATA,
 * labelled as data. Reading is the tightest — a couple of degrees at a time,
 * because that is about eight letters — and looking at a scene is the loosest.
 *
 * ```
 *                   fixation   saccade
 *   reading           225 ms      2°
 *   visual search     275 ms      3°
 *   scene viewing     330 ms      4°
 * ```
 */
export const SCAN = {
  reading: { fixation: 0.225, amplitude: 2 },
  search: { fixation: 0.275, amplitude: 3 },
  scene: { fixation: 0.330, amplitude: 4 },
} as const;

export type ScanTask = keyof typeof SCAN;

/**
 * The radius of the eyeball, metres — scaled off body height like every other
 * length here.
 *
 * About twelve millimetres on an adult, and near enough constant across adults,
 * which is why it is the one part of a face that does not vary with size. It is
 * here because it is what turns an ANGLE into the millimetres of iris travel a
 * viewer actually sees: `offset = R sin(theta)`, and nothing about that is a
 * tuning value.
 */
export const EYE_RADIUS = 0.012;

/**
 * How far the eye turns in its socket before the head takes over, degrees.
 *
 * The customary oculomotor range. The eye CAN reach about 45°, but in natural
 * gaze shifts it hands over to the head well before that (Guitton & Volle,
 * 1987), and an NPC whose eyeballs swivel to their mechanical limit while the
 * head stays put is the single most reliable way to make a face look possessed.
 *
 * Past this the residual is `headDemand`, for a neck to deal with.
 */
export const ORBITAL_RANGE = 25;

/**
 * Microsaccades: how many a second, and how big.
 *
 * Martinez-Conde, Macknik & Hubel (2004). THE EYE IS NEVER STILL — during
 * fixation it makes one to two tiny flicks a second, a third of a degree or so,
 * and without them vision fades. A rig that parks its eyes between saccades
 * looks embalmed for the 300 ms that a fixation lasts, which is most of the
 * time.
 */
export const MICROSACCADE_RATE = 1.5;
/** ...and their amplitude, degrees. Under half a degree. */
export const MICROSACCADE_AMPLITUDE = 0.3;

/** Where the eyes are pointing, degrees in the head's frame. */
export interface GazeAngles {
  /** Left–right, negative left. */
  yaw: number;
  /** Up–down, positive up. */
  pitch: number;
}

export interface SaccadeOptions {
  /** What the viewer is doing. Sets the fixation time and the amplitude. */
  task?: ScanTask;
  /** Deterministic, because a replay that looks elsewhere is not a replay. */
  seed?: number;
}

export interface SaccadeState {
  /** What the viewer is doing this frame. */
  task?: ScanTask;
  /**
   * Aim here instead of wandering, degrees. The eyes still get there by
   * saccade — this sets where the next one lands, not where the eye is.
   */
  target?: Partial<GazeAngles> | null;
}

const clamp = (v: number, lo: number, hi: number): number =>
  (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);

/**
 * How long a saccade of this size takes, seconds. The published law, and the
 * only part of the main sequence this file is allowed to use.
 */
export function saccadeDuration(amplitudeDegrees: number): number {
  const a = Math.abs(Number.isFinite(amplitudeDegrees) ? amplitudeDegrees : 0);
  return SACCADE_SLOPE * a + SACCADE_INTERCEPT;
}

/**
 * Drives a pair of eyes.
 *
 * The rate and the size of the movements come from the task, the kinematics of
 * each one come from Bahill, and what is left over past the orbital range is
 * the head's problem.
 */
export class Saccades {
  /** Where the eyes point, degrees. */
  angles: GazeAngles = { yaw: 0, pitch: 0 };
  task: ScanTask;
  /** Saccades made since this controller started. Microsaccades do not count. */
  count = 0;
  /**
   * True while a saccade is in flight — which is also when vision is
   * suppressed, so it is the window in which an agent cannot have seen anything.
   */
  moving = false;
  /**
   * What is left over past the orbital range, degrees. A neck's job: hand it to
   * `LookAt` and the head finishes the turn the eyes could not.
   */
  headDemand: GazeAngles = { yaw: 0, pitch: 0 };

  private from: GazeAngles = { yaw: 0, pitch: 0 };
  private to: GazeAngles = { yaw: 0, pitch: 0 };
  private elapsed = 0;
  private duration = 0;
  private dwell = 0;
  private micro = 0;
  private state = 0;
  private isMicro = false;

  constructor(options: SaccadeOptions = {}) {
    this.task = options.task ?? 'scene';
    this.state = (options.seed ?? 1) >>> 0 || 1;
    this.dwell = SCAN[this.task].fixation;
    this.micro = this.microWait();
  }

  private random(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /** A gaussian-ish draw, for amplitudes that scatter about the published mean. */
  private spread(): number {
    return (this.random() + this.random() + this.random()) / 1.5;
  }

  private microWait(): number {
    const u = Math.max(1e-9, this.random());
    return -Math.log(u) / MICROSACCADE_RATE;
  }

  /**
   * Launch a saccade to these angles. Ballistic: once it is going it cannot be
   * redirected, which is why a call during flight is ignored rather than queued.
   */
  look(yaw: number, pitch: number): void {
    if (this.moving) return;
    this.from = { ...this.angles };
    this.to = {
      yaw: clamp(yaw, -ORBITAL_RANGE, ORBITAL_RANGE),
      pitch: clamp(pitch, -ORBITAL_RANGE, ORBITAL_RANGE),
    };
    const dy = this.to.yaw - this.from.yaw;
    const dp = this.to.pitch - this.from.pitch;
    // THE AMPLITUDE IS THE ANGLE THROUGH WHICH THE EYE TURNS, which for a
    // movement with both components is the diagonal and not either part of it.
    // Feeding the law one axis at a time makes a diagonal saccade take as long
    // as its horizontal component and travel further, which is faster than the
    // eye can go — and the gate reads it as a main-sequence violation.
    const amplitude = Math.hypot(dy, dp);
    this.duration = saccadeDuration(amplitude);
    this.elapsed = 0;
    this.moving = true;
  }

  /** Where the next saccade should land, given the task and the raw target. */
  private choose(target?: Partial<GazeAngles> | null): GazeAngles {
    const { amplitude } = SCAN[this.task];
    if (target) {
      // Aim, but not perfectly: the eye lands near what it was sent to and
      // then makes a smaller corrective movement, which is why a fixation is
      // often two saccades. The scatter is a tenth of the task's own amplitude.
      const miss = amplitude * 0.1;
      return {
        yaw: (target.yaw ?? this.angles.yaw) + (this.random() - 0.5) * miss,
        pitch: (target.pitch ?? this.angles.pitch) + (this.random() - 0.5) * miss,
      };
    }
    // Free viewing: a step of about the task's amplitude, in some direction,
    // pulled gently back toward straight ahead so the eyes do not random-walk
    // into the corner of the socket and sit there.
    const step = amplitude * this.spread();
    const angle = this.random() * Math.PI * 2;
    const pull = 0.25;
    return {
      yaw: this.angles.yaw * (1 - pull) + Math.cos(angle) * step,
      pitch: this.angles.pitch * (1 - pull) + Math.sin(angle) * step * 0.6,
    };
  }

  update(dt: number, state: SaccadeState = {}): GazeAngles {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    if (state.task && state.task !== this.task && SCAN[state.task]) {
      this.task = state.task;
      // A change of task re-draws the dwell, for the same reason a change of
      // task re-draws the blink interval: otherwise a reader who starts
      // searching finishes the reader's fixation first.
      this.dwell = SCAN[this.task].fixation;
    }

    if (this.moving) {
      this.elapsed += step;
      const t = clamp(this.elapsed / Math.max(1e-6, this.duration), 0, 1);
      // A RAISED COSINE IN POSITION, whose derivative is a HALF-SINE in
      // velocity — the shape the two published laws imply between them. The
      // smoothstep everybody reaches for is a raised cosine in VELOCITY and
      // peaks a quarter too high.
      const s = 0.5 * (1 - Math.cos(Math.PI * t));
      this.angles = {
        yaw: this.from.yaw + (this.to.yaw - this.from.yaw) * s,
        pitch: this.from.pitch + (this.to.pitch - this.from.pitch) * s,
      };
      if (this.elapsed >= this.duration) {
        this.angles = { ...this.to };
        this.moving = false;
        // A MICROSACCADE IS NOT A FIXATION. It happens DURING one, so it must
        // not restart the dwell and it must not be counted — otherwise a face
        // fixates for 330 ms as published, twitches at 200 ms, and starts a
        // fresh 330 ms, which turns Rayner's table into something else.
        if (this.isMicro) {
          this.isMicro = false;
        } else {
          this.count++;
          this.dwell = SCAN[this.task].fixation;
        }
        this.micro = this.microWait();
      }
    } else {
      this.dwell -= step;
      this.micro -= step;
      if (this.dwell <= 0) {
        const want = this.choose(state.target);
        // THE HEAD TAKES WHAT THE EYE CANNOT. Clamping silently would leave an
        // agent that has been told to look at something staring past it.
        this.headDemand = {
          yaw: want.yaw - clamp(want.yaw, -ORBITAL_RANGE, ORBITAL_RANGE),
          pitch: want.pitch - clamp(want.pitch, -ORBITAL_RANGE, ORBITAL_RANGE),
        };
        this.look(want.yaw, want.pitch);
      } else if (this.micro <= 0) {
        // A MICROSACCADE, which is a saccade and obeys the same law — it is
        // just small enough that its duration is essentially the intercept.
        // It does not reset the dwell and it does not count as a fixation.
        const angle = this.random() * Math.PI * 2;
        const a = MICROSACCADE_AMPLITUDE * this.spread();
        this.look(this.angles.yaw + Math.cos(angle) * a, this.angles.pitch + Math.sin(angle) * a);
        this.isMicro = this.moving;
        this.micro = this.microWait();
      }
    }
    return this.angles;
  }

  /**
   * The normalised pair `createEyes` wants, −1..1 on each axis.
   *
   * `pitch` becomes `gaze`, which is the same number the lid already rides on,
   * so an eye that looks down is hooded by the blink model without either
   * module knowing about the other.
   */
  get shape(): { gaze: number; yaw: number } {
    return {
      gaze: clamp(this.angles.pitch / ORBITAL_RANGE, -1, 1),
      yaw: clamp(this.angles.yaw / ORBITAL_RANGE, -1, 1),
    };
  }
}

/**
 * Where the iris sits for a given normalised gaze, metres off centre.
 *
 * The eye is a ball of radius `EYE_RADIUS` and the iris is on its surface, so
 * turning it by θ moves the pupil by `R sin θ`. That is the whole calculation,
 * and it is why the travel does not scale with how big the eye is DRAWN — it
 * scales with the globe, which is the same size in everyone.
 */
export function irisOffset(normalised: number, height = 1.75): number {
  const theta = clamp(normalised, -1, 1) * ORBITAL_RANGE * (Math.PI / 180);
  return EYE_RADIUS * Math.sin(theta) * (height / 1.75);
}
