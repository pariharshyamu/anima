import { AnimationMixer, Vector3, type AnimationClip, type Object3D } from 'three';

/**
 * Foot skate — the metric, not just the animation.
 *
 * A locomotion clip is in-place; the movement comes from whatever drives the
 * object, and the clip is played at a rate that is supposed to make the feet
 * agree with the ground. When the rate is wrong the planted foot slides, and
 * "sliding feet" is the single most recognisable tell of a procedural
 * character. It is also invisible to every other kind of check: the clip
 * compiles, the pose is valid, the screenshot looks like a person mid-stride.
 *
 * So measure it. `stride` is how far a foot actually travels, taken from the
 * clip's own bone transforms rather than from the formula that generated them.
 * `impliedSpeed` is the travel speed at which that stride does not slip.
 * `mismatch` is how far the speed you asked about is from that, and it is the
 * number to gate on:
 *
 * ```ts
 * const clips = createLocomotionClips(rig);
 * const report = measureFootSkate(rig, clips.run, { speed: clips.runSpeed });
 * report.mismatch      // 0.0005 — half a per mille, invisible
 * report.slipPerStep   // metres of slide per step, if you prefer concrete
 * ```
 *
 * ## Why it samples the rig instead of doing the arithmetic
 *
 * The clip's authoring formula already predicts a stride. Predicting it a
 * second time here and comparing the two would prove only that two copies of
 * one formula agree. So this drives a real `AnimationMixer` over the real
 * bones and reads world positions: the numbers come from the transform
 * hierarchy that ships, including every secondary rotation, body-yaw and
 * ride-height term the closed form leaves out. That independence is the whole
 * value, and it is why the declared speeds must NOT be derived from this
 * function — the moment they are, the gate is measuring itself.
 *
 * ## Why `mismatch` and not the instantaneous slide
 *
 * A sinusoidal gait CANNOT hold a foot still. The hip swings through a sine,
 * so the foot's backward speed peaks mid-stride and falls to zero at the
 * extremes — measured on these clips it deviates from the travel speed by
 * ~140% (walk) and ~158% (run) at some point in every step, no matter how
 * well the clip is tuned. That is intrinsic to the shape, not a defect, and
 * gating on it would be gating on the choice of curve.
 *
 * What IS a defect is the stride being systematically wrong, because then the
 * foot slides the same way every step and the eye reads it immediately.
 * `peakDeviation` is reported for information; `mismatch` is the gate.
 */

/**
 * Any rig with named bones under one root — `HumanoidRig`, `QuadrupedRig`, or
 * something you built yourself. Structural, not nominal, for the same reason
 * the rest of the trilogy is: the metric needs a transform hierarchy, not a
 * membership card.
 */
export interface SkateRig {
  object: Object3D;
  bones: Record<string, Object3D>;
}

export interface FootSkateOptions {
  /** The travel speed to judge the clip against, m/s. */
  speed: number;
  /** Samples per cycle. Default 240 — cheap, and well past aliasing. */
  samples?: number;
  /** Feet to average. Default the two ankles of a humanoid. */
  feet?: string[];
  /**
   * Steps in one cycle. Two for a biped: the clip covers left and right, and
   * each foot carries the body for half the cycle. Ignored when `contact` is
   * given.
   */
  stepsPerCycle?: number;
  /**
   * When each foot lands, as a phase 0..1 of the clip, keyed by bone name —
   * and `duty`, the fraction of the clip it stays down. The horse gaits
   * declare exactly this.
   *
   * Give them and the stride is measured **across the contact window** rather
   * than peak to peak, which matters for any gait whose swing reaches: a
   * horse's hoof travels furthest forward in late swing, past where it will
   * actually touch down, so peak-to-peak overstates the ground it covers —
   * measured on the canter, by 10%. A sine-driven biped touches down at its
   * own extreme and the two agree, which is why `contact` is optional.
   */
  contact?: Record<string, number>;
  /** Fraction of the clip a foot is planted. Required with `contact`. */
  duty?: number;
}

export interface FootSkateReport {
  /** How far a foot travels while planted, in metres. Measured, not derived. */
  stride: number;
  /** Seconds the foot is planted — `duty × duration`, or `duration / steps`. */
  stepDuration: number;
  /** `stride / stepDuration`: the speed at which these feet do not slip. */
  impliedSpeed: number;
  /** The speed asked about. */
  speed: number;
  /**
   * `speed / impliedSpeed - 1`.
   *
   * Positive means the body outruns the feet — the classic forward slide.
   * Negative means the legs cycle faster than the ground needs, which reads
   * as running on the spot. Zero is stride-matched.
   */
  mismatch: number;
  /** Metres of slide per step at `speed`. The same fact, made concrete. */
  slipPerStep: number;
  /**
   * Spread between the individual feet — `max / min - 1` of their strides.
   *
   * Zero for a symmetric gait sampled symmetrically. Large means the feet
   * disagree about how far a step is, and no single playback rate can satisfy
   * both: one of them is going to slide. A quadruped whose forelegs and hind
   * legs sweep different distances cannot "track up", which is the first
   * thing a horse person looks at.
   */
  spread: number;
  /**
   * Worst |instantaneous backward foot speed − `speed`| ÷ `speed` while
   * planted. Large for any sinusoidal gait; see the note above.
   */
  peakDeviation: number;
  samples: number;
}

const wrap01 = (t: number): number => t - Math.floor(t);

/**
 * Sample a clip and measure what its feet actually do.
 *
 * Runs a real `AnimationMixer` over the real rig — no reimplementation of the
 * curve evaluation, because a metric computed from a second copy of the maths
 * only proves the two copies agree.
 */
export function measureFootSkate(
  rig: SkateRig,
  clip: AnimationClip,
  options: FootSkateOptions
): FootSkateReport {
  const samples = options.samples ?? 240;
  const stepsPerCycle = options.stepsPerCycle ?? 2;
  const feet = options.feet ?? ['LeftFoot', 'RightFoot'];
  const speed = options.speed;
  const { contact, duty } = options;
  if (contact && duty === undefined) {
    throw new Error('measureFootSkate: `contact` needs `duty` — how long the foot stays down');
  }
  for (const name of feet) {
    if (!rig.bones[name]) throw new Error(`measureFootSkate: no bone named "${name}"`);
    if (contact && contact[name] === undefined) {
      throw new Error(`measureFootSkate: \`contact\` has no phase for "${name}"`);
    }
  }

  const mixer = new AnimationMixer(rig.object);
  mixer.clipAction(clip).play();
  const probe = new Vector3();
  const footZ = (name: string, phase: number): number => {
    mixer.setTime(wrap01(phase) * clip.duration);
    rig.object.updateMatrixWorld(true);
    rig.bones[name].getWorldPosition(probe);
    return probe.z;
  };

  const stepDuration = contact ? duty! * clip.duration : clip.duration / stepsPerCycle;
  const strides: number[] = [];
  let peakDeviation = 0;

  for (const name of feet) {
    // The window the foot is carrying the body through. Without a declared
    // contact schedule that is the foot's whole backward excursion, walked
    // from its forward-most sample until it turns around — the honest
    // reading of "planted" for a curve that never actually plants.
    let from: number;
    let span: number;
    if (contact) {
      from = contact[name];
      span = duty!;
    } else {
      let max = -Infinity;
      let at = 0;
      for (let i = 0; i < samples; i++) {
        const z = footZ(name, i / samples);
        if (z > max) {
          max = z;
          at = i;
        }
      }
      let k = 1;
      for (; k < samples; k++) {
        if (footZ(name, (at + k) / samples) >= footZ(name, (at + k - 1) / samples)) break;
      }
      from = at / samples;
      span = (k - 1) / samples;
    }

    // Forward travel is along the rig's local ±Z depending on how the caller
    // drives it; a stride is a distance either way, so keep the sign out of
    // it and take the magnitude.
    const step = span / Math.max(1, samples);
    let previous = footZ(name, from);
    const start = previous;
    for (let i = 1; i <= samples; i++) {
      const z = footZ(name, from + i * step);
      const backward = Math.abs(previous - z) / (step * clip.duration);
      peakDeviation = Math.max(peakDeviation, Math.abs(backward - speed) / speed);
      previous = z;
    }
    strides.push(Math.abs(start - previous));
  }

  // Average the feet: a symmetric gait gives them the same excursion, and
  // averaging halves the sampling noise. A gait that is NOT symmetric shows
  // up in `spread`, which is the honest summary rather than a hidden one.
  const stride = strides.reduce((a, b) => a + b, 0) / strides.length;
  const impliedSpeed = stride / stepDuration;
  const mismatch = speed / impliedSpeed - 1;
  const low = Math.min(...strides);
  return {
    stride,
    stepDuration,
    impliedSpeed,
    speed,
    mismatch,
    slipPerStep: mismatch * stride,
    spread: low > 0 ? Math.max(...strides) / low - 1 : 0,
    peakDeviation,
    samples,
  };
}
