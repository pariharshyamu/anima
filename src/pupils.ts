/**
 * Pupils — and the pupil is not an emotion dial, it is a light meter.
 *
 * Every rig that animates pupils dilates them for interest and shrinks them for
 * fear. That is not wrong, exactly — Hess & Polt (1964) did find the pupil
 * dilates with mental effort, and Kahneman & Beatty (1966) measured it against
 * memory load. It is just **an order of magnitude smaller than the thing the
 * pupil is actually doing**, which is metering the light.
 *
 * ```
 *   the light reflex, over eight decades of luminance   5.5 mm
 *   the task-evoked response, at full effort            0.5 mm
 * ```
 *
 * So a character whose pupils widen with drama and ignore the scene's lighting
 * has the physics upside down by a factor of eleven. And the consequence runs
 * the other way too, which is the interesting half: **you cannot read a mood off
 * a pupil unless you hold the light constant.** That is not a stylistic claim,
 * it is why every pupillometry protocol ever published fixes the luminance
 * first, and `npm run pupils` demonstrates it on this model.
 *
 * ## The static law
 *
 * Moon and Spencer (1944), diameter in millimetres against field luminance in
 * candela per square metre:
 *
 * ```
 *   D = 4.9 − 3 tanh(0.4 log₁₀ L)
 * ```
 *
 * An independent fit by De Groot and Gebhard (1952) disagrees with it by **up
 * to 1.4 mm** — a quarter of the whole range. That disagreement is the honest
 * error bar on any of this, and the gate uses it as the budget rather than a
 * tolerance somebody picked.
 *
 * **BUT THAT CHECK IS WEAKER THAN IT LOOKS, AND THE GATE SAYS SO.** Unlike the
 * saccade case — where the model was given Bahill's duration law and then held
 * to his peak-velocity law, which it had never seen — this model IS Moon and
 * Spencer. Comparing it to De Groot is a consistency band, not a prediction. It
 * catches a units error, a wrong branch, dynamics that fail to settle and a rig
 * that does not draw the millimetres. It cannot tell you the curve is right.
 *
 * What can be falsified independently is in the gate's third section.
 *
 * ## And constriction is faster than dilation
 *
 * Sphincter pupillae is parasympathetic and fast; dilator pupillae is
 * sympathetic and slow. A pupil snaps shut against a light and opens back up
 * over seconds — the same shape of asymmetry the eyelid has, for the same kind
 * of reason, and it is why walking into a dark room takes a moment.
 */

/**
 * The narrowest and widest an adult pupil gets, millimetres.
 *
 * ANATOMY, not a curve fit — which is what makes it the one bound in this file
 * that neither published formula can move. Both of them saturate inside it.
 */
export const PUPIL_MIN = 2;
/** ...and the widest, in the dark. */
export const PUPIL_MAX = 8;

/**
 * The diameter of the iris, millimetres.
 *
 * Near enough constant across adults, and it is here because it is what turns a
 * pupil DIAMETER into the fraction of an iris a viewer sees. A stylised face
 * draws the iris however large it likes; the ratio is what has to be right.
 */
export const IRIS_MM = 12;

/**
 * How long the pupil takes to notice, seconds.
 *
 * The latency of the light reflex — the delay between the light changing and
 * the iris starting to move. It is why a pupil in a flickering scene lags
 * rather than strobing.
 */
export const PUPIL_LATENCY = 0.22;

/** How fast it shuts. Sphincter pupillae, parasympathetic, quick. */
export const CONSTRICT_TAU = 0.4;

/**
 * ...and how slowly it opens. Dilator pupillae, sympathetic, four times slower.
 *
 * The RATIO is the published observation — redilation takes several times as
 * long as constriction. The absolute figures are the middle of the reported
 * ranges rather than one measurement, and are labelled as such.
 */
export const DILATE_TAU = 1.6;

/**
 * How far the pupil dilates at full mental effort, millimetres.
 *
 * Kahneman & Beatty (1966), and Beatty's (1982) review of two decades after it.
 * Half a millimetre is a large task-evoked response. Set beside the 5.5 mm the
 * light reflex covers, it is the whole point of this module.
 */
export const EFFORT_DILATION = 0.5;

/** How long the task-evoked response takes to build, seconds. Beatty (1982). */
export const EFFORT_TAU = 1.2;

/**
 * The pupil diameter a steady luminance settles at, millimetres.
 *
 * Moon & Spencer (1944). `luminance` is in cd/m²: a lit interior is around 50,
 * an overcast day a few thousand, moonlight a hundredth.
 */
export function pupilFor(luminance: number): number {
  const L = Number.isFinite(luminance) ? Math.max(1e-8, luminance) : 1;
  const d = 4.9 - 3 * Math.tanh(0.4 * Math.log10(L));
  return Math.max(PUPIL_MIN, Math.min(PUPIL_MAX, d));
}

export interface PupilState {
  /** Field luminance, cd/m². What the eye is actually looking at. */
  luminance?: number;
  /** Mental effort, 0..1. Worth half a millimetre at the very most. */
  effort?: number;
}

export interface PupilOptions {
  /** Where it starts, cd/m². Defaults to a lit interior. */
  luminance?: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);

/**
 * Drives a pupil.
 *
 * The size comes from the light, the lag comes from which muscle is doing the
 * work, and the mood is worth half a millimetre on top.
 */
export class Pupils {
  /** Diameter, millimetres. */
  diameter: number;
  /** How much of the current diameter is the task and not the light, mm. */
  fromEffort = 0;

  #light: number;
  // THE REFLEX'S OWN STATE, kept apart from the reported diameter.
  //
  // The first version added the effort term into `diameter` and then let the
  // next frame's reflex chase from there, so the task response was folded back
  // into the light response and compounded every frame — a face thinking hard
  // in a fixed light drifted open without limit until the clamp caught it.
  #reflex: number;
  #effort = 0;
  #queue: Array<{ at: number; luminance: number }> = [];
  #clock = 0;

  constructor(options: PupilOptions = {}) {
    this.#light = Math.max(1e-8, options.luminance ?? 50);
    this.#reflex = pupilFor(this.#light);
    this.diameter = this.#reflex;
  }

  update(dt: number, state: PupilState = {}): number {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.#clock += step;

    // THE REFLEX HAS A LATENCY, so what the iris is chasing is what the eye saw
    // a fifth of a second ago. Without it a pupil in a flickering scene strobes,
    // which no pupil does.
    if (state.luminance !== undefined && Number.isFinite(state.luminance)) {
      this.#queue.push({ at: this.#clock + PUPIL_LATENCY, luminance: Math.max(1e-8, state.luminance) });
    }
    while (this.#queue.length && this.#queue[0].at <= this.#clock) {
      this.#light = this.#queue.shift()!.luminance;
    }

    const target = pupilFor(this.#light);
    // ...AND WHICH WAY IT IS GOING DECIDES HOW FAST. Two muscles, and the one
    // that opens the pupil is four times slower than the one that shuts it.
    const tau = target < this.#reflex ? CONSTRICT_TAU : DILATE_TAU;
    const k = 1 - Math.exp(-step / Math.max(1e-6, tau));
    this.#reflex += (target - this.#reflex) * k;

    // The task-evoked response, on its own slower clock, ADDED to the reflex —
    // it is a different pathway, not a different setting of the same one.
    const want = clamp(state.effort ?? 0, 0, 1) * EFFORT_DILATION;
    this.#effort += (want - this.#effort) * (1 - Math.exp(-step / EFFORT_TAU));
    this.fromEffort = this.#effort;

    return (this.diameter = clamp(this.#reflex + this.#effort, PUPIL_MIN, PUPIL_MAX));
  }

  /** What the light alone would settle at, millimetres. */
  get fromLight(): number {
    return pupilFor(this.#light);
  }
}
