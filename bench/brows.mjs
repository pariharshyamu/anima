#!/usr/bin/env node
/**
 * The brow gate — a brow raise is punctuation, and punctuation has a shape.
 *
 *   npm run brows            fail if the brows stop marking the accents
 *   npm run brows -- --json  the numbers, machine-readable
 *
 * BE HONEST ABOUT WHICH CLAIM IS LOAD-BEARING, because one of the three below
 * is nearly a tautology and the other two are not.
 *
 * 1. THE BROW FOLLOWS THE ACCENTS. It has to, and the control is a contour
 *    SHUFFLED BY SYLLABLE — the same values, the same range, the same number of
 *    excursions, in the wrong order. Not a shifted copy: the last time a gate in
 *    this repo used one of those, the shift cancelled a lead the model already
 *    had and the control BEAT its subject.
 *
 *    This one is close to a round trip. The brow is a rate-limited, baselined
 *    function of the pitch, so of course it correlates with the pitch. What it
 *    actually shows is that the rate limit and the baseline did not destroy the
 *    signal on the way through.
 *
 * 2. DECLINATION MUST NOT LOWER THE BROWS, AND THIS IS THE REAL ONE. English
 *    pitch drifts down through a phrase — 't Hart, Collier & Cohen (1990) put it
 *    near half a semitone a second — so across a four-second sentence the whole
 *    contour sinks while the accents keep landing. A brow wired straight to
 *    pitch sinks with it and the speaker looks like they are falling asleep by
 *    the full stop. The last accent must raise the brow as far as the first.
 *
 *    The control here is the SAME MODEL WITH THE BASELINE REMOVED, which is a
 *    thing that could plausibly have been written and which fails visibly.
 *
 * 3. AND IT GOES THROUGH THE MUSCLE. A supplied contour does not get to move a
 *    brow faster than a brow moves. The speed limit is derived from
 *    Eibl-Eibesfeldt's sixth-of-a-second flash rather than chosen next to it.
 *
 * NOTHING HERE IMPORTS GAMA. The contour below is generated in this file from
 * published prosody — a declining baseline with accents on stressed syllables —
 * because a gate that fetched the other package would be testing the import.
 */
import { ACCENT_SEMITONES, BASELINE_TAU, BROW_FLASH, BROW_SPEED, BROW_TRAVEL, Brows, createBrows, createHumanoid } from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const RATE = 1 / 120;
const RIG_HEIGHT = 1.75;
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

/**
 * A pitch contour with the two things English contours have.
 *
 * DECLINATION at 0.55 semitones a second ('t Hart, Collier & Cohen 1990), and
 * an ACCENT on each stressed syllable, five semitones up (the same source).
 * Syllables run at 5.3 a second, which is the conversational rate, and every
 * third one is stressed — near enough to English's alternating-with-lapses
 * rhythm for a signal to be measured against.
 *
 * Generated here rather than fetched, so this file tests the brow and not a
 * dependency.
 */
const SYLLABLE = 1 / 5.3;
const DECLINATION = 0.55;
const SECONDS = 6;
const SYLLABLES = Math.floor(SECONDS / SYLLABLE);
const accents = [];
for (let i = 0; i < SYLLABLES; i++) if (i % 3 === 0) accents.push(i * SYLLABLE);

// Where the line SITS matters as much as its shape. A statement starts a little
// above the speaker's own f0 and declines through it, which is what `pronounce`
// produces: over a long sentence its cues run from about +2 semitones down to
// about −1. The first version of this contour started at +4 and never came
// down through zero, and every accent in it pinned a naive `pitch / accent`
// model at the clamp — so DELETING THE BASELINE ENTIRELY scored 100% held and
// passed the gate. A test signal that saturates the thing it is testing is not
// a hard case, it is a blindfold.
const START = 1.5;

const contourAt = (t) => {
  if (t < 0 || t > SECONDS) return 0;
  let hz = START - DECLINATION * t;
  for (const a of accents) {
    // A raised cosine over the syllable it lands on: an accent is a movement,
    // not a step, and it is the width of the syllable that carries it.
    const d = Math.abs(t - (a + SYLLABLE / 2));
    if (d < SYLLABLE / 2) hz += ACCENT_SEMITONES * 0.5 * (1 + Math.cos((Math.PI * d) / (SYLLABLE / 2)));
  }
  return hz;
};

/** The same contour with its SYLLABLES SHUFFLED — same values, wrong order. */
const shuffled = (() => {
  const order = [];
  for (let i = 0; i < SYLLABLES; i++) order.push(i);
  let s = 20260804 >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return (t) => {
    if (t < 0 || t > SECONDS) return 0;
    const i = Math.min(SYLLABLES - 1, Math.floor(t / SYLLABLE));
    return contourAt(order[i] * SYLLABLE + (t % SYLLABLE));
  };
})();

/** The contour's own range, for the naive control to normalise over. */
const SPAN = (() => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let t = 0; t <= SECONDS; t += RATE) { const v = contourAt(t); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return { lo, hi };
})();

const correlate = (xs, ys) => {
  const mx = mean(xs);
  const my = mean(ys);
  let n = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) { n += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  return n / Math.sqrt(dx * dy + 1e-12);
};

/** Run a contour past a pair of brows and report what the RIG showed. */
function run(source, { baseline = true } = {}) {
  const rig = createHumanoid({ height: RIG_HEIGHT, seed: 9 });
  const prop = createBrows(rig);
  const brows = new Brows();
  let clock = 0;
  if (baseline) brows.attach(source, { clock: () => clock });
  else {
    // THE CONTROL FOR CLAIM 2: pitch straight to raise, no running baseline,
    // normalised over the contour's OWN RANGE. Written the way somebody writes
    // it who has not thought about declination.
    //
    // The range matters. The first version divided by ACCENT_SEMITONES and sat
    // CLAMPED AT 1.0 from end to end, which reported 100% held and made the
    // control look better than the subject — a control that is saturated is not
    // measuring anything. Normalising over the span is what the naive version
    // would actually do and what actually sinks.
    brows.attach(source, { clock: () => clock });
    brows.update = function (dt) {
      this.elapsed += Math.max(0, dt);
      const want = Math.max(0, Math.min(1, (source(clock) - SPAN.lo) / (SPAN.hi - SPAN.lo)));
      const limit = (BROW_SPEED / BROW_TRAVEL) * Math.max(0, dt);
      const d = want - this.shape.raise;
      this.shape = { raise: this.shape.raise + Math.max(-limit, Math.min(limit, d)) };
      return this.shape;
    };
  }
  const samples = [];
  let worstSpeed = 0;
  let lastY = 0;
  while (clock <= SECONDS) {
    const shape = brows.update(RATE);
    prop.apply(shape);
    // The lift the RIG actually shows, in metres — not the number the
    // controller reports, because a controller that returns a beautiful shape
    // and a prop that ignores it look identical from the controller.
    const y = prop.group.children[0].position.y;
    worstSpeed = Math.max(worstSpeed, Math.abs(y - lastY) / RATE);
    lastY = y;
    samples.push({ t: clock, pitch: source(clock), raise: shape.raise, y });
    clock += RATE;
  }
  return { samples, worstSpeed };
}

const subject = run(contourAt);
const control = run(shuffled);

// -------------------------------------------- 1. THE BROW FOLLOWS THE ACCENTS

// BOTH AGAINST THE TRUE CONTOUR. The first version correlated each run against
// its OWN input, so the shuffled control scored 0.897 against the subject's
// 0.869 — it was faithfully following the wrong contour and being praised for
// it. The question is whether the face marks the accents that are actually
// there, so the reference is the same for both.
const truth = subject.samples.map((s) => s.pitch);
const rSubject = correlate(truth, subject.samples.map((s) => s.y));
const rControl = correlate(truth, control.samples.map((s) => s.y));
if (!(rSubject > 0.6)) {
  fail(`the brow follows the contour at r = ${rSubject.toFixed(3)} — the baseline or the speed limit has eaten the accents`);
}
if (!(rControl < rSubject * 0.6)) {
  fail(`a contour with its syllables SHUFFLED still drives the brow at r = ${rControl.toFixed(3)} against ${rSubject.toFixed(3)} — the correlation is not about the accents landing where they land`);
}

// ------------------------- 2. AND DECLINATION MUST NOT LOWER THEM. THE REAL ONE.

/** Peak brow lift on the accent nearest a time. */
const peakNear = (samples, at) => {
  let best = 0;
  for (const s of samples) if (Math.abs(s.t - at) < SYLLABLE) best = Math.max(best, s.raise);
  return best;
};
const firstAccent = accents[1] + SYLLABLE / 2;
const lastAccent = accents[accents.length - 1] + SYLLABLE / 2;
const drift = {
  first: peakNear(subject.samples, firstAccent),
  last: peakNear(subject.samples, lastAccent),
  seconds: lastAccent - firstAccent,
  semitones: DECLINATION * (lastAccent - firstAccent),
};
drift.ratio = drift.last / Math.max(1e-9, drift.first);

const noBaseline = run(contourAt, { baseline: false });
const flat = {
  first: peakNear(noBaseline.samples, firstAccent),
  last: peakNear(noBaseline.samples, lastAccent),
};
flat.ratio = flat.last / Math.max(1e-9, flat.first);

// THE BUDGET IS DERIVED FROM THE TRACKER, not rounded off.
//
// A first-order filter following a RAMP lags it by `rate × tau` for ever — that
// is what a first-order filter does — so a declination line falling at
// DECLINATION semitones a second sits `DECLINATION × BASELINE_TAU` above the
// true floor once it has settled. Against an accent of ACCENT_SEMITONES that is
// the fraction of the raise the model must be allowed to lose, and it is 8%.
//
// Anything more than that is not the filter's arithmetic, it is a bug. Anything
// less would mean the tracker is doing something this file has not accounted
// for. The first version of this asserted a round 0.95 and failed at 0.94,
// which says nothing about whether 0.94 was right.
const LAG = (DECLINATION * BASELINE_TAU) / ACCENT_SEMITONES;
if (!(drift.ratio > 1 - LAG)) {
  fail(`the last accent of a ${SECONDS}s line raises the brow to ${(drift.ratio * 100).toFixed(0)}% of the first, past the ${(LAG * 100).toFixed(0)}% a first-order tracker must lose to a ${DECLINATION}-semitone-a-second ramp — ${drift.semitones.toFixed(1)} semitones of declination is dragging the face down with it`);
}
if (!(flat.ratio < drift.ratio * 0.9)) {
  fail(`the same model WITHOUT a running baseline holds ${(flat.ratio * 100).toFixed(0)}% against ${(drift.ratio * 100).toFixed(0)}% — declination is not steep enough here to tell the two apart, so this section proves nothing`);
}

// ------------------------------- 3. AND IT GOES THROUGH THE MUSCLE

const speedLimit = BROW_SPEED * (RIG_HEIGHT / 1.75);
if (!(subject.worstSpeed <= speedLimit + 1e-9)) {
  fail(`the brow moved at ${subject.worstSpeed.toFixed(3)} m/s against a published ${speedLimit.toFixed(3)} — a supplied contour is going around the speed limit`);
}
// ...and the line has to DEMAND it, or the limit is untested.
if (!(subject.worstSpeed > speedLimit * 0.5)) {
  fail(`the brow never exceeded ${subject.worstSpeed.toFixed(3)} m/s of a ${speedLimit.toFixed(3)} limit — the contour is not asking the muscle for anything`);
}

// ------------------------------------------- 4. the things it must not do

let flash = { peak: 0, seconds: 0 };
{
  const brows = new Brows();
  const rig = createHumanoid({ height: RIG_HEIGHT, seed: 3 });
  const prop = createBrows(rig);
  brows.flash();
  let t = 0;
  let peak = 0;
  let downAt = -1;
  while (t < 1) {
    const shape = brows.update(RATE);
    prop.apply(shape);
    peak = Math.max(peak, shape.raise);
    if (peak > 0.9 && downAt < 0 && shape.raise < 0.1) downAt = t;
    t += RATE;
  }
  flash = { peak, seconds: downAt };
  // A greeting flash reaches the top. If the speed limit made that impossible
  // the published duration and the published travel disagree, which is worth
  // knowing rather than quietly clipping.
  if (!(peak > 0.95)) fail(`the greeting flash only reached ${(peak * 100).toFixed(0)}% — a sixth of a second is not enough travel at ${BROW_SPEED.toFixed(3)} m/s`);
  if (!(downAt > 0 && downAt < BROW_FLASH * 3)) {
    fail(`the flash took ${downAt < 0 ? 'forever' : downAt.toFixed(2) + 's'} to come back down against a published ${BROW_FLASH.toFixed(2)}s for the whole gesture`);
  }

  // Nonsense sources, and a face is the last place to find out.
  for (const bad of [() => NaN, () => Infinity, () => -1e9, () => undefined]) {
    brows.attach(bad);
    for (let i = 0; i < 60; i++) {
      const shape = brows.update(RATE);
      prop.apply(shape);
      if (!Number.isFinite(shape.raise) || shape.raise < 0 || shape.raise > 1) {
        fail(`a nonsense contour produced raise = ${shape.raise}`);
        break;
      }
      if (!Number.isFinite(prop.group.children[0].position.y)) {
        fail('the prop moved to a non-finite position');
        break;
      }
    }
  }
  // Attaching replaces; detaching stops.
  brows.attach(() => 10);
  if (!brows.live) fail('attach() did not take');
  brows.detach();
  if (brows.live) fail('detach() did not detach');
  for (let i = 0; i < 200; i++) brows.update(RATE);
  if (!(brows.shape.raise < 0.01)) fail(`a detached brow settled at ${brows.shape.raise.toFixed(2)} instead of coming back to rest`);
}

// ------------------------------------------------------------------- report

if (json) {
  console.log(JSON.stringify({ failures, rSubject, rControl, drift, flat, worstSpeed: subject.worstSpeed, speedLimit, flash }, null, 2));
} else {
  console.log('brows — a raise is punctuation before it is emotion\n');
  console.log('  THE BROW FOLLOWS THE ACCENTS');
  console.log('  A declining contour with an accent on every third syllable, against the');
  console.log('  LIFT IN METRES measured off the rig — not the number the controller');
  console.log('  reports, because a controller that returns a beautiful shape and a prop');
  console.log('  that ignores it look identical from the controller.\n');
  console.log(`    the contour:                r = ${rSubject.toFixed(3)}`);
  console.log(`    its syllables shuffled:     r = ${rControl.toFixed(3)}   ← the control\n`);
  console.log('    Shuffled and not shifted. Same values, same range, same number of');
  console.log('    excursions, wrong order — a shifted copy once cancelled a lead this');
  console.log('    repo already had and BEAT the thing it was controlling for.\n');

  console.log('  AND DECLINATION MUST NOT LOWER THEM — THE ONE THAT IS NOT A ROUND TRIP');
  console.log(`  English pitch drifts down ${DECLINATION} semitones a second, so ${drift.seconds.toFixed(1)}s apart these`);
  console.log(`  two accents sit ${drift.semitones.toFixed(1)} semitones lower — most of an accent's own height.\n`);
  console.log(`    first accent → ${(drift.first * 100).toFixed(0)}% of full raise,  last → ${(drift.last * 100).toFixed(0)}%   (${(drift.ratio * 100).toFixed(0)}% held)`);
  console.log(`    with the running baseline REMOVED:  ${(flat.ratio * 100).toFixed(0)}% held   ← the control`);
  console.log(`    the budget:                         ${((1 - LAG) * 100).toFixed(0)}% held\n`);
  console.log(`    And the budget is DERIVED. A first-order filter following a ramp lags it`);
  console.log(`    by rate × tau for ever, so a line falling ${DECLINATION} semitones a second sits`);
  console.log(`    ${(DECLINATION * BASELINE_TAU).toFixed(2)} semitones high once settled — ${(LAG * 100).toFixed(0)}% of a ${ACCENT_SEMITONES}-semitone accent. More than`);
  console.log('    that is a bug; less would mean the tracker is doing something this file');
  console.log('    has not accounted for.\n');
  console.log('    That control is not a straw man. It is what you write if you have not');
  console.log('    thought about declination, and the face falls asleep by the full stop.\n');

  console.log('  AND IT GOES THROUGH THE MUSCLE');
  console.log(`    fastest the brow moved:  ${subject.worstSpeed.toFixed(3)} m/s   against ${speedLimit.toFixed(3)}`);
  console.log(`    the greeting flash:      ${(flash.peak * 100).toFixed(0)}% of full travel, back down in ${flash.seconds.toFixed(2)}s`);
  console.log(`\n    The limit is DERIVED. Eibl-Eibesfeldt (1972) filmed the greeting flash`);
  console.log(`    at ${BROW_FLASH.toFixed(3)}s across cultures; a flash is up and back, so the way up is`);
  console.log(`    half of it, and ${(BROW_TRAVEL * 1000).toFixed(0)} mm in ${(BROW_FLASH / 2).toFixed(3)}s is ${BROW_SPEED.toFixed(3)} m/s. Nobody chose it,`);
  console.log('    and it moves if either published number does.');
}

if (failures.length) {
  console.error('\nBROWS OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error('\nA face that does not punctuate is a face nobody can read. The pitch is the punctuation.');
  process.exit(1);
}
if (!json) console.log('\nbrows: the accents landed on the face ✓');
