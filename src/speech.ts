import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { HumanoidRig } from './humanoid';

/**
 * Speech — visemes, and the observation that the table already exists.
 *
 * Every lipsync system starts by inventing a list of mouth shapes and a mapping
 * from sounds onto them. That list has been published since 1888, it is called
 * the IPA, and its two axes are exactly the two things a mouth visibly does:
 *
 *   VOWEL HEIGHT      close ... open        is how far the jaw is down
 *   ROUNDEDNESS       spread ... rounded    is what the lips are doing
 *
 * A vowel chart is a viseme chart. `/i/` is close and unrounded, so the jaw is
 * nearly shut and the lips are wide; `/ɑ/` is open and unrounded, so the jaw is
 * down and the lips are slack; `/u/` is close and rounded, so the jaw is nearly
 * shut and the lips are pursed. Nobody has to decide any of that, and this file
 * does not: `mouthOf` is two lookups into a chart phoneticians drew.
 *
 * ## Visemes are fewer than phonemes, and that is a fact about eyes
 *
 * `/p/`, `/b/` and `/m/` are three different sounds and ONE picture — the lips
 * are shut and you cannot see which. That many-to-one collapse is the whole
 * reason lipsync is tractable and the reason lip-reading is hard, and it is
 * classification rather than invention: they share a place of articulation.
 *
 * ## Coarticulation, and the thing it must never do
 *
 * Real mouths blend. The shape at any instant is a weighted sum of the
 * neighbouring targets, each with a dominance that rises and falls — Cohen and
 * Massaro's model, 1993 — and the visible articulation LEADS the sound by about
 * a tenth of a second, because the lips start moving toward a shape before the
 * sound that needs it begins.
 *
 * But blending has one thing it must not do, and it is the single most
 * recognisable broken lipsync there is:
 *
 *   **A BILABIAL MUST CLOSE THE LIPS.**
 *
 * If "mama" is blended until the seal is only 60% shut, it reads as a mouth
 * flapping vaguely, and every viewer knows something is wrong without being
 * able to say what. So closure is not blended like the other channels. It is
 * taken as a maximum over the neighbours, which is what a seal physically is:
 * the lips are shut or they are not, and averaging shut with open does not give
 * you half-shut, it gives you wrong.
 */

/** How a phoneme is made, and the two axes are the IPA's own. */
export interface PhonemeSpec {
  /** IPA symbol. */
  ipa: string;
  /** vowel | stop | nasal | fricative | approximant. */
  kind: 'vowel' | 'stop' | 'nasal' | 'fricative' | 'approximant';
  /**
   * Openness, 0 (close) to 1 (open) — the IPA vowel chart's vertical axis, and
   * physically how far the jaw is down.
   */
  height: number;
  /** Roundedness, 0 (spread) to 1 (rounded) — the chart's other distinction. */
  round: number;
  /**
   * How completely the lips seal, 0 to 1. Only the bilabials reach 1, and that
   * is the one channel coarticulation is not allowed to average away.
   */
  closure: number;
  /**
   * Seconds. Published mean durations for read speech: vowels run 100-200 ms,
   * stops 50-80, fricatives 80-120. Nothing here is a frame count.
   */
  duration: number;
  voiced: boolean;
}

/**
 * The inventory. Every `height` and `round` below is a position on the IPA
 * vowel chart, and every `duration` is a published mean.
 */
export const PHONEMES: Record<string, PhonemeSpec> = {
  // Vowels: the chart, read off.
  i: { ipa: 'i', kind: 'vowel', height: 0.05, round: 0.0, closure: 0, duration: 0.12, voiced: true },
  y: { ipa: 'y', kind: 'vowel', height: 0.05, round: 0.9, closure: 0, duration: 0.12, voiced: true },
  e: { ipa: 'e', kind: 'vowel', height: 0.35, round: 0.0, closure: 0, duration: 0.13, voiced: true },
  E: { ipa: 'ɛ', kind: 'vowel', height: 0.6, round: 0.0, closure: 0, duration: 0.14, voiced: true },
  a: { ipa: 'a', kind: 'vowel', height: 0.95, round: 0.0, closure: 0, duration: 0.18, voiced: true },
  A: { ipa: 'ɑ', kind: 'vowel', height: 1.0, round: 0.05, closure: 0, duration: 0.19, voiced: true },
  O: { ipa: 'ɔ', kind: 'vowel', height: 0.7, round: 0.75, closure: 0, duration: 0.16, voiced: true },
  o: { ipa: 'o', kind: 'vowel', height: 0.35, round: 0.85, closure: 0, duration: 0.14, voiced: true },
  u: { ipa: 'u', kind: 'vowel', height: 0.05, round: 1.0, closure: 0, duration: 0.13, voiced: true },
  M: { ipa: 'ɯ', kind: 'vowel', height: 0.05, round: 0.0, closure: 0, duration: 0.13, voiced: true },
  '@': { ipa: 'ə', kind: 'vowel', height: 0.5, round: 0.1, closure: 0, duration: 0.08, voiced: true },

  // Bilabials — the three sounds with one picture.
  p: { ipa: 'p', kind: 'stop', height: 0, round: 0.1, closure: 1, duration: 0.06, voiced: false },
  b: { ipa: 'b', kind: 'stop', height: 0, round: 0.1, closure: 1, duration: 0.07, voiced: true },
  m: { ipa: 'm', kind: 'nasal', height: 0, round: 0.1, closure: 1, duration: 0.08, voiced: true },

  // Labiodentals: lower lip to upper teeth, so a partial seal and no rounding.
  f: { ipa: 'f', kind: 'fricative', height: 0.1, round: 0.0, closure: 0.55, duration: 0.11, voiced: false },
  v: { ipa: 'v', kind: 'fricative', height: 0.1, round: 0.0, closure: 0.55, duration: 0.09, voiced: true },

  // The rest are made behind the lips, so the mouth barely changes and the
  // viseme collapse is severe. That is not a shortcut: it is why lip-reading
  // cannot distinguish them either.
  t: { ipa: 't', kind: 'stop', height: 0.15, round: 0.0, closure: 0.1, duration: 0.06, voiced: false },
  d: { ipa: 'd', kind: 'stop', height: 0.15, round: 0.0, closure: 0.1, duration: 0.06, voiced: true },
  n: { ipa: 'n', kind: 'nasal', height: 0.15, round: 0.0, closure: 0.1, duration: 0.07, voiced: true },
  k: { ipa: 'k', kind: 'stop', height: 0.25, round: 0.0, closure: 0.05, duration: 0.07, voiced: false },
  g: { ipa: 'g', kind: 'stop', height: 0.25, round: 0.0, closure: 0.05, duration: 0.07, voiced: true },
  s: { ipa: 's', kind: 'fricative', height: 0.12, round: 0.0, closure: 0.15, duration: 0.12, voiced: false },
  z: { ipa: 'z', kind: 'fricative', height: 0.12, round: 0.0, closure: 0.15, duration: 0.1, voiced: true },
  S: { ipa: 'ʃ', kind: 'fricative', height: 0.15, round: 0.6, closure: 0.1, duration: 0.12, voiced: false },
  T: { ipa: 'θ', kind: 'fricative', height: 0.12, round: 0.0, closure: 0.2, duration: 0.11, voiced: false },
  l: { ipa: 'l', kind: 'approximant', height: 0.2, round: 0.0, closure: 0.05, duration: 0.08, voiced: true },
  r: { ipa: 'r', kind: 'approximant', height: 0.25, round: 0.35, closure: 0.05, duration: 0.08, voiced: true },
  w: { ipa: 'w', kind: 'approximant', height: 0.1, round: 1.0, closure: 0.05, duration: 0.07, voiced: true },
  j: { ipa: 'j', kind: 'approximant', height: 0.1, round: 0.0, closure: 0.05, duration: 0.06, voiced: true },
  h: { ipa: 'h', kind: 'fricative', height: 0.4, round: 0.0, closure: 0, duration: 0.07, voiced: false },
  /** Silence. */
  '.': { ipa: '', kind: 'approximant', height: 0.05, round: 0.1, closure: 0, duration: 0.12, voiced: false },
};

export const PHONEME_KEYS = Object.keys(PHONEMES);

/**
 * The many-to-one collapse: which phonemes are the SAME PICTURE.
 *
 * This is a classification of places of articulation, not a design. `/p/`,
 * `/b/` and `/m/` differ in voicing and nasality, neither of which is visible,
 * so they are one viseme — and the fact that a viewer cannot tell them apart is
 * the thing that makes lipsync possible at all.
 */
export const VISEMES: Record<string, string[]> = {
  /** Lips shut. */
  bilabial: ['p', 'b', 'm'],
  /** Lower lip on upper teeth. */
  labiodental: ['f', 'v'],
  /** Tongue behind the teeth — nothing visible. */
  alveolar: ['t', 'd', 'n', 's', 'z', 'l', 'T'],
  /** Further back, and even less visible. */
  velar: ['k', 'g', 'h'],
  /** Rounded consonants. */
  rounded: ['w', 'S', 'r'],
  /** Close vowels. */
  close: ['i', 'y', 'u', 'M', 'j'],
  /** Mid. */
  mid: ['e', 'o', '@', 'O'],
  /** Open. */
  open: ['a', 'A', 'E'],
  silence: ['.'],
};

export const VISEME_NAMES = Object.keys(VISEMES);

const OF: Record<string, string> = {};
for (const [viseme, keys] of Object.entries(VISEMES)) for (const k of keys) OF[k] = viseme;

/** Which viseme a phoneme looks like. Many phonemes, one picture. */
export function visemeOf(key: string): string {
  return OF[key] ?? 'silence';
}

/** What a mouth is doing, as four numbers a renderer can use. */
export interface MouthShape {
  /** Jaw down, 0..1 — the IPA's vowel height. */
  open: number;
  /** Lips pursed, 0..1 — the IPA's roundedness. */
  round: number;
  /** Lips sealed, 0..1. Never averaged away. */
  close: number;
  /** Corners pulled wide, 0..1 — the complement of rounding on an open mouth. */
  spread: number;
}

/**
 * The mouth for one phoneme, straight off the chart.
 *
 * Two lookups and a subtraction. There is no viseme table here because the IPA
 * is one.
 */
export function mouthOf(key: string): MouthShape {
  const p = PHONEMES[key] ?? PHONEMES['.'];
  return {
    open: p.height * (1 - p.closure),
    round: p.round,
    close: p.closure,
    // A wide mouth is an unrounded open one. Spread and round are the same axis
    // seen from the two ends, so this is `1 - round` gated by how open it is.
    spread: (1 - p.round) * p.height,
  };
}

/**
 * How long the visible shape LEADS the sound, seconds.
 *
 * Anticipatory coarticulation: the lips start toward a shape before the sound
 * that needs it begins, and the measured lead is around a tenth of a second.
 * It is why a lipsync locked exactly to the audio looks a beat late.
 */
export const ANTICIPATION = 0.1;

/**
 * Width of a phoneme's dominance in time, as a multiple of its own duration.
 *
 * Cohen and Massaro's dominance functions overlap; this is how far each
 * phoneme's influence reaches past its own segment.
 */
export const DOMINANCE = 1.4;

/** Where a mouth sits when nothing is being said: barely open, barely rounded. */
export const REST: MouthShape = { open: 0.04, round: 0.1, close: 0, spread: 0.02 };

/**
 * The standing weight of the rest posture in the blend.
 *
 * Small enough that a vowel dominates it and large enough that the shape EASES
 * back to rest instead of falling off a cliff when the last segment's dominance
 * runs out.
 */
export const REST_WEIGHT = 0.25;

/**
 * Peak jaw speed in speech, metres per second.
 *
 * A published kinematic measurement, and the reason the blend alone is not
 * enough: phonemes run 60 to 190 ms and the raw dominance blend swings the jaw
 * at over a metre a second, which is five times what a jaw does. Lips are light
 * and shut fast; a jaw is a bone with muscle on it.
 */
export const JAW_SPEED = 0.2;

/** How far the jaw travels from shut to fully open, metres, on a 1.75 m body. */
export const JAW_TRAVEL = 0.0525;

/**
 * How much jaw gap the LIPS can close on their own, metres, on a 1.75 m body.
 *
 * A seal is not the jaw shutting. The lips are soft tissue — about ten
 * millimetres of vermilion each, plus a few of protrusion — and they stretch to
 * meet across a gap the jaw has left open. That is exactly what a nasal is: you
 * can hum with your mouth open, and the /m/ in "mama" happens while the jaw is
 * still on its way down from the vowel.
 *
 * It is also a BOUND, and the useful half of the number. Past their own span
 * the lips cannot reach, so a jaw further down than this has no seal available
 * to it and a bilabial there would be a lie. `LIP_BRIDGE / JAW_TRAVEL` is
 * therefore the widest jaw a sealed mouth may be drawn with — 46% — and it is
 * the budget the gate holds the blend to, rather than a number anybody picked.
 */
export const LIP_BRIDGE = 0.024;

export interface Segment {
  key: string;
  /** Seconds from the start of the utterance. */
  at: number;
  duration: number;
  /**
   * A mouth shape supplied from OUTSIDE, overriding `PHONEMES[key]`.
   *
   * This is the seam, and it is the reason the trilogy has three packages. A
   * synthesizer that knows about vocal tracts knows what shape a mouth is in
   * — it has to, because F1 IS mouth opening — but its phoneme alphabet is not
   * this one and never will be. It has consonants this file has no viseme for
   * and this file has visemes it has no sound for.
   *
   * So nothing is shared except the SHAPE. Hand this class `{ open, round,
   * close, spread }` per segment and it drives a jaw with it, through the same
   * dominance blend, the same speed limit and the same lip bridge as its own
   * phonemes get. It does not ask where the numbers came from and it cannot
   * import whatever produced them.
   */
  shape?: MouthShape;
}

/**
 * Lay a string of phoneme keys out in time.
 *
 * Each segment gets its own published duration, scaled by a rate. Nothing here
 * is a frame count and nothing is evenly spaced: a stop is half the length of
 * an open vowel because that is what it is.
 */
export function utterance(keys: string[] | string, rate = 1): Segment[] {
  const list = Array.isArray(keys) ? keys : [...keys];
  const out: Segment[] = [];
  let t = 0;
  for (const key of list) {
    const spec = PHONEMES[key];
    if (!spec) continue;
    const duration = spec.duration / Math.max(0.1, rate);
    out.push({ key, at: t, duration });
    t += duration;
  }
  return out;
}

/**
 * Lay out a track of mouth shapes supplied from outside.
 *
 * The durations are given rather than looked up, because whatever produced the
 * shapes also knows how long each one lasts — a speech synthesizer has already
 * decided that, and deciding it twice is how a face and a voice drift apart.
 */
export function shapedUtterance(
  shapes: ReadonlyArray<{ shape: MouthShape; seconds: number }>,
  rate = 1
): Segment[] {
  const out: Segment[] = [];
  let t = 0;
  for (let i = 0; i < shapes.length; i++) {
    const duration = Math.max(0, shapes[i].seconds) / Math.max(0.1, rate);
    out.push({ key: `#${i}`, at: t, duration, shape: shapes[i].shape });
    t += duration;
  }
  return out;
}

/** Seconds an utterance lasts. */
export function utteranceLength(track: Segment[]): number {
  const last = track[track.length - 1];
  return last ? last.at + last.duration : 0;
}

/**
 * The mouth at a moment, with everything blended except the seal.
 *
 * Each segment's dominance is a raised cosine over `DOMINANCE × duration`
 * centred on it, and `open`, `round` and `spread` are the weighted average.
 *
 * `close` is a MAXIMUM. A seal is a contact: the lips are shut or they are not,
 * and averaging a shut mouth with an open one does not produce a half-shut
 * mouth, it produces a wrong one. Blending it like the rest is exactly how
 * "mama" ends up never closing, which is the most recognisable broken lipsync
 * there is.
 */
export function mouthAt(track: Segment[], time: number): MouthShape {
  // The visible shape leads the sound.
  const t = time + ANTICIPATION;
  // Seed the blend with the REST POSTURE, at a small standing weight.
  //
  // Without it the accumulator empties the moment no segment is in reach — at
  // the end of every utterance, because the anticipatory lead pushes `t` past
  // the last window — and the shape snaps from a 95%-open jaw to a closed one
  // between two frames. The gate measured 49% of the jaw's range in one 120 Hz
  // step, which is not a movement a jaw can make and is exactly the twitch at
  // the end of a line that reads as a glitch.
  //
  // A mouth returns to rest; it does not fall to it.
  let w = REST_WEIGHT;
  let open = REST.open * REST_WEIGHT;
  let round = REST.round * REST_WEIGHT;
  let spread = REST.spread * REST_WEIGHT;
  let close = 0;

  for (const seg of track) {
    const centre = seg.at + seg.duration / 2;
    const half = (seg.duration * DOMINANCE) / 2;
    const d = Math.abs(t - centre);
    if (d >= half) continue;
    // Raised cosine: 1 at the centre, 0 at the edges, smooth at both.
    const weight = 0.5 * (1 + Math.cos((Math.PI * d) / half));
    // A supplied shape wins. Everything downstream — the blend, the seal
    // maximum, the jaw speed limit, the lip bridge — treats it identically to
    // one this file looked up, because it is the same kind of thing.
    const m = seg.shape ?? mouthOf(seg.key);
    w += weight;
    open += m.open * weight;
    round += m.round * weight;
    spread += m.spread * weight;
    // NOT averaged. The strongest seal in reach is the seal.
    close = Math.max(close, m.close * (weight > 0.35 ? 1 : weight / 0.35));
  }

  if (!(w > 0)) return { ...REST };
  const seal = Math.min(1, close);
  // The jaw is NOT gated by the seal.
  //
  // It was, and it made the jaw follow the lips: every /m/ slammed the blended
  // opening to zero over the fifty milliseconds the seal took, which is 27% of
  // the jaw's range per 120 Hz frame and about thirty times faster than a jaw
  // can move. A jaw is a bone with muscle on it; lips are light and shut fast.
  // You can hum with your mouth open, which is the whole point of a nasal.
  //
  // Each bilabial already contributes `height × (1 − closure)` = 0 through
  // `mouthOf`, so the average comes down on its own, at the blend's own rate.
  return {
    open: open / w,
    round: round / w,
    close: seal,
    // Spread IS gated: you cannot show a wide mouth through sealed lips.
    spread: (spread / w) * (1 - seal),
  };
}

/**
 * A mouth from somewhere else, asked for at a time.
 *
 * The SECOND half of the handshake, and the half that a baked track cannot do.
 * `follow()` takes a timeline decided once; this takes a FUNCTION, and asks it
 * again every frame. That matters the moment the source's own timing can move
 * underneath it — which is exactly what a platform speech synthesizer does,
 * because it reports word boundaries as it reaches them and the track between
 * them is re-anchored each time one arrives.
 *
 * GAMA's `SpokenLine.mouthAt(seconds)` has this signature. It imports nothing
 * from here, this imports nothing from there, and the two agree because **F1 is
 * mouth opening** — a jaw that drops raises the first formant, in the geometry
 * and in the air. Nothing in this file knows what a formant is.
 *
 * Returning `null` means "nothing to say", and the face goes to rest.
 */
export type MouthSource = (seconds: number) => MouthShape | null;

/** What a live source needs to say about itself besides its shape. */
export interface LiveOptions {
  /**
   * The AUTHORITATIVE clock, seconds. Omit to use this `Speech`'s own.
   *
   * A platform voice runs on its own clock and starts when it feels like it, so
   * a face that counted its own frames would drift away from the audio over a
   * sentence and there would be no way to notice from inside.
   */
  clock?: () => number;
  /** Whether the source has finished. Omit and the face speaks until detached. */
  done?: () => boolean;
}

export interface SpeechOptions {
  /** Speed multiplier on every published duration. */
  rate?: number;
  /** Loop the utterance. */
  loop?: boolean;
}

/**
 * How wide a live source's dominance window is, seconds.
 *
 * A baked track knows each segment's duration and `mouthAt` weights it over
 * `duration × DOMINANCE`. A source sampled at a point does not offer that, so
 * the width comes from this file's own table: the MEDIAN published phoneme
 * duration, times the same `DOMINANCE`. Not a number anyone chose — change a
 * duration in `PHONEMES` and this moves with it.
 */
export const LIVE_WINDOW = (() => {
  const ds = PHONEME_KEYS.map((k) => PHONEMES[k].duration).sort((a, b) => a - b);
  return ds[ds.length >> 1] * DOMINANCE;
})();

/** How many points across that window a live source is asked for. Odd, so one lands on the lead. */
const LIVE_TAPS = 7;

/**
 * The same blend `mouthAt` does, over a source instead of a track.
 *
 * WITHOUT THIS A LIVE SOURCE IS A SQUARE WAVE. `mouthAt` overlaps each
 * segment's raised-cosine dominance (Cohen & Massaro) so the target the jaw
 * chases is already smooth; `attach()` handed the jaw a step function instead
 * and the rate limiter — which is a jaw with mass, not a filter — could not
 * follow it. The gate scored the live path at 0.55 against the baked path's
 * 0.83 on a source it was tracking perfectly, and the difference was entirely
 * this.
 *
 * Sampling the source across the window with the same kernel is the same
 * operation: for a source that is piecewise-constant over a segment, convolving
 * with the dominance kernel and summing the segments' dominances agree.
 *
 * `close` is a MAXIMUM, not an average, and `spread` is gated by the seal —
 * both exactly as in `mouthAt`, because a seal that is averaged away is not a
 * bilabial and you cannot show a wide mouth through shut lips.
 */
function blendLive(source: MouthSource, t: number): MouthShape {
  const half = LIVE_WINDOW / 2;
  let w = REST_WEIGHT;
  let open = REST.open * REST_WEIGHT;
  let round = REST.round * REST_WEIGHT;
  let spread = REST.spread * REST_WEIGHT;
  let close = 0;
  for (let i = 0; i < LIVE_TAPS; i++) {
    const d = -half + (2 * half * i) / (LIVE_TAPS - 1);
    const weight = 0.5 * (1 + Math.cos((Math.PI * d) / half));
    if (!(weight > 0)) continue;
    const m = source(t + d);
    if (!m) continue;
    const s = sane(m);
    w += weight;
    open += s.open * weight;
    round += s.round * weight;
    spread += s.spread * weight;
    close = Math.max(close, s.close * (weight > 0.35 ? 1 : weight / 0.35));
  }
  const seal = Math.min(1, close);
  return {
    open: open / w,
    round: round / w,
    close: seal,
    spread: (spread / w) * (1 - seal),
  };
}

/**
 * A shape from outside, made safe to draw.
 *
 * Every channel here is a FRACTION — nought to one — and a face is the last
 * place to find out that something upstream disagreed. A baked track is checked
 * once when it is handed over; a live source is a function someone else wrote,
 * called sixty times a second, and a single NaN from it propagates into the rig
 * and stays there, because a bone position that is NaN never comes back.
 */
function sane(shape: MouthShape): MouthShape {
  const one = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
  return { open: one(shape.open), round: one(shape.round), close: one(shape.close), spread: one(shape.spread) };
}

/** Drives an utterance in time and reports the mouth. */
export class Speech {
  track: Segment[] = [];
  elapsed = 0;
  readonly rate: number;
  readonly loop: boolean;
  shape: MouthShape = { open: 0.04, round: 0.1, close: 0, spread: 0 };

  constructor(keys: string[] | string = '', options: SpeechOptions = {}) {
    this.rate = options.rate ?? 1;
    this.loop = options.loop ?? false;
    this.say(keys);
  }

  /** A live source, when one is attached. See `attach`. */
  private source: MouthSource | null = null;
  private clock: (() => number) | null = null;
  private sourceDone: (() => boolean) | null = null;

  say(keys: string[] | string): void {
    this.detach();
    this.track = utterance(keys, this.rate);
    this.elapsed = 0;
  }

  /**
   * Speak a track of shapes decided somewhere else.
   *
   * The face does not need to know the alphabet, only the geometry. GAMA's
   * `visemeTrack` produces exactly this and imports nothing from here; this
   * imports nothing from there; the two agree because **F1 is mouth opening**
   * and a jaw that drops raises the first formant, in the geometry and in the
   * air.
   */
  follow(shapes: ReadonlyArray<{ shape: MouthShape; seconds: number }>): void {
    this.detach();
    this.track = shapedUtterance(shapes, this.rate);
    this.elapsed = 0;
  }

  /**
   * Drive the face from a source that is still making up its mind.
   *
   * `follow()` bakes a timeline at the moment it is called, which is right when
   * the timeline is known and wrong when it is not. A platform speech
   * synthesizer reports word boundaries as it reaches them, and every one of
   * them re-anchors the track behind it — so a face that baked at the start is
   * animating a plan the audio has already left. This asks the source again
   * every frame instead.
   *
   * **The ANTICIPATION lead is applied here, to the source's own clock.** A
   * mouth reaches its shape before the sound arrives; that is this library's
   * fact about faces and it does not belong on the other side of the seam. The
   * source is asked what the mouth should be a tenth of a second from now.
   *
   * Everything downstream is unchanged: the jaw is still held to `JAW_SPEED`,
   * so a live source gets Lindblom's undershoot for free, and a seal the lips
   * cannot span is still capped by `LIP_BRIDGE`. A supplied shape does not get
   * to go around the physics, whether it was supplied once or every frame.
   */
  attach(source: MouthSource, options: LiveOptions = {}): void {
    this.source = source;
    this.clock = options.clock ?? null;
    this.sourceDone = options.done ?? null;
    this.track = [];
    this.elapsed = 0;
  }

  /** Stop reading a live source. The face falls back to its own track. */
  detach(): void {
    this.source = null;
    this.clock = null;
    this.sourceDone = null;
  }

  /** Whether a live source is driving this face. */
  get live(): boolean {
    return this.source !== null;
  }

  get length(): number {
    return utteranceLength(this.track);
  }

  get done(): boolean {
    if (this.source) return this.sourceDone ? this.sourceDone() : false;
    return !this.loop && this.elapsed >= this.length;
  }

  /**
   * Step the utterance, with the jaw held to a speed a jaw can manage.
   *
   * `mouthAt` is the target. This is what the face can actually get to, and the
   * difference between them has a name: UNDERSHOOT. A short vowel between two
   * consonants does not reach its own opening because the jaw cannot get there
   * and back in eighty milliseconds — Lindblom measured exactly that in 1963,
   * and here it is a consequence of one published speed rather than a rule.
   *
   * The lips are not limited. They are light, they shut in fifty milliseconds,
   * and a bilabial that had to wait for the jaw would stop being a bilabial.
   */
  update(dt: number): MouthShape {
    const step = Math.max(0, dt);
    this.elapsed += step;
    const len = this.length;
    if (this.loop && len > 0) this.elapsed %= len;
    // A live source is asked at the AUTHORITATIVE clock plus the lead. With no
    // clock of its own it gets this one, which is the case where a caller wants
    // re-sampling but has nothing better to keep time by.
    //
    // `mouthAt` adds ANTICIPATION itself, so the two paths lead by the same
    // amount and neither is a special case downstream.
    const want = this.source
      ? blendLive(this.source, (this.clock ? this.clock() : this.elapsed) + ANTICIPATION)
      : sane(mouthAt(this.track, this.elapsed));
    const limit = (JAW_SPEED / this.jawTravel) * step;
    const d = want.open - this.shape.open;
    const open = this.shape.open + Math.max(-limit, Math.min(limit, d));

    // A SEAL THE LIPS CANNOT REACH IS NOT A SEAL.
    //
    // The lips are not rate-limited and the jaw is, so the blend switches the
    // seal on while the jaw is still on its way up from the vowel. In "mam"
    // that is twenty-five millimetres of gap at the instant /m/ starts, and the
    // lips have twenty-four to span. The gate caught it as a 52%-open jaw under
    // sealed lips, and it would have drawn as a bilabial whose lips never met.
    //
    // So the seal is capped by the geometry: the lips can close `lipBridge` of
    // gap, and the gap is `open × jawTravel`, and a mouth wider than that gets
    // the fraction it can have. Nothing is scheduled and nothing is faked — the
    // seal simply COMPLETES WHEN THE JAW ARRIVES, twenty milliseconds later.
    //
    // It also predicts something nobody put in: at speech rates fast enough
    // that the jaw never gets back up, bilabial closure degrades. That is the
    // lips' half of Lindblom's undershoot, and it falls out of the same two
    // lengths.
    const gap = open * this.jawTravel;
    const reachable = gap > 0 ? Math.min(1, this.lipBridge / gap) : 1;

    this.shape = {
      open,
      round: want.round,
      close: Math.min(want.close, reachable),
      spread: want.spread,
    };
    return this.shape;
  }

  /** How far this face's jaw travels, metres. Scaled off the body. */
  jawTravel = JAW_TRAVEL;

  /** How much gap this face's lips can close on their own, metres. */
  lipBridge = LIP_BRIDGE;
}

/**
 * Syllables per second, from the track itself.
 *
 * A syllable is a vowel with whatever hangs off it, so counting vowels counts
 * syllables. Read speech runs 4-7 syllables a second, and an utterance that
 * comes out at twenty is a lipsync running at animation speed rather than
 * talking speed.
 */
export function syllableRate(track: Segment[]): number {
  const len = utteranceLength(track);
  if (!(len > 0)) return 0;
  let n = 0;
  for (const s of track) if (PHONEMES[s.key]?.kind === 'vowel') n++;
  return n / len;
}

// ------------------------------------------------------- the mouth prop

export interface MouthProp {
  group: Group;
  apply(shape: MouthShape): void;
}

/**
 * A mouth that moves, parented to the head.
 *
 * The face `createHumanoid` builds is baked into the skinned mesh — there is no
 * jaw bone and no morph target — so a moving mouth is an overlay: an upper lip,
 * a lower lip that drops, and a dark interior that shows through when they part.
 * Sized off the head the same way the baked face is, so it lands on it.
 */
export function createMouth(rig: HumanoidRig): MouthProp {
  const H = rig.height;
  const group = new Group();
  const lipColour = 0x8a4a44;
  const bar = (w: number, h: number, d: number, colour: number) =>
    new Mesh(
      new BoxGeometry(w, h, d),
      new MeshStandardMaterial({ color: colour, roughness: 0.75 })
    );

  const cavity = bar(0.036 * H, 0.004 * H, 0.006 * H, 0x2a1418);
  const upper = bar(0.038 * H, 0.007 * H, 0.007 * H, lipColour);
  const lower = bar(0.038 * H, 0.008 * H, 0.007 * H, lipColour);
  group.add(cavity, upper, lower);
  // The face's own mouth sits at 0.03 H up and 0.0565 H forward on the Head.
  group.position.set(0, 0.03 * H, 0.0575 * H);
  rig.bones.Head.add(group);

  return {
    group,
    apply(shape: MouthShape): void {
      // The jaw drops. Everything else is the lips.
      const scale = H / 1.75;
      const gap = shape.open * JAW_TRAVEL * scale;
      const width = 1 + shape.spread * 0.35 - shape.round * 0.4;
      const seal = shape.close;

      // AND THE LIPS BRIDGE WHAT THE JAW LEFT OPEN.
      //
      // Without this the prop drew a "sealed" mouth twenty-three millimetres
      // apart, because `close` and `open` are separate channels and the jaw is
      // deliberately not gated by the seal. That is right about the jaw and
      // wrong about the picture: a /m/ whose lips do not meet is the exact
      // failure this module exists to prevent, and the screenshot showed it.
      //
      // So the lips travel toward each other by the seal, up to their own span
      // and no further — soft tissue stretching across a gap a bone left. Past
      // LIP_BRIDGE they cannot reach, and a mouth that open does not get a seal
      // drawn for it, which is the same bound the gate holds the blend to.
      const bridge = Math.min(gap, LIP_BRIDGE * scale) * seal;
      const shown = gap - bridge;

      upper.position.y = gap * 0.25 - bridge * 0.25;
      lower.position.y = -gap * 0.75 + bridge * 0.75;
      cavity.position.y = -shown * 0.25;
      cavity.scale.y = Math.max(0.05, (shown / (0.004 * H)) * 0.9);
      upper.scale.x = width;
      lower.scale.x = width;
      cavity.scale.x = width;
      // A seal also pushes the lips forward — the pucker of a /m/.
      group.position.z = 0.0575 * H + seal * 0.004 * H;
    },
  };
}
