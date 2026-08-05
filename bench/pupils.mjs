#!/usr/bin/env node
/**
 * The pupil gate — and the interesting claim is a negative one.
 *
 *   npm run pupils            fail if the pupil stops being a light meter
 *   npm run pupils -- --json  the numbers, machine-readable
 *
 * Every rig animates pupils for mood. The published fact is that mood is worth
 * half a millimetre and the light is worth five and a half, so the honest
 * consequence is METHODOLOGICAL: you cannot read an emotion off a pupil unless
 * you hold the luminance constant. Every pupillometry protocol ever published
 * fixes the light first for exactly this reason.
 *
 * That is a claim this model can be held to, and it is section 3. Sections 1
 * and 2 are the static law and the muscle asymmetry, and section 1's
 * cross-check against a second published fit is DELIBERATELY LABELLED as the
 * weak one — see the note there.
 */
import {
  CONSTRICT_TAU, DILATE_TAU, EFFORT_DILATION, IRIS_MM, PUPIL_LATENCY,
  PUPIL_MAX, PUPIL_MIN, Pupils, createEyes, createHumanoid, pupilFor,
} from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const DT = 1 / 120;

/** De Groot & Gebhard (1952). An independent fit, and the model never sees it. */
const deGroot = (L) => Math.pow(10, 0.8558 - 4.01e-4 * Math.pow(Math.log10(L) + 8.6, 3));

const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
function correlate(a, b) {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

const DECADES = [1e-3, 1e-2, 0.1, 1, 10, 100, 1e3, 1e4];

// ------------------------------------------------------ 1. THE STATIC LAW

const settled = DECADES.map((L) => {
  const p = new Pupils({ luminance: L });
  for (let i = 0; i < 40 / DT; i++) p.update(DT, { luminance: L });
  return { L, measured: p.diameter, published: pupilFor(L), deGroot: deGroot(L) };
});

// It has to actually SETTLE on the law it claims — this catches dynamics that
// never converge, a latency queue that leaks and a sign error in the tau pick.
for (const s of settled) {
  if (Math.abs(s.measured - s.published) > 0.01) {
    fail(`at ${s.L} cd/m² the pupil settled at ${s.measured.toFixed(2)} mm against its own law's ${s.published.toFixed(2)}`);
  }
}

/**
 * AND AGAINST A SECOND PUBLISHED FIT — WHICH IS THE WEAK CHECK HERE, AND SAYING
 * SO IS THE POINT.
 *
 * In the saccade gate the model was given Bahill's duration law and then held to
 * his peak-velocity law, which it had never seen; the agreement was a
 * prediction. Nothing of the sort is happening here. This model IS Moon &
 * Spencer, so comparing it to De Groot & Gebhard measures the disagreement
 * between two 1940s curve fits and not the quality of anything I wrote.
 *
 * It is kept because it still catches a units error, a wrong branch, a rig that
 * does not draw millimetres, and an effort term large enough to drag the
 * settled value out of the band. It is not evidence that the curve is right.
 */
const spread = Math.max(...DECADES.map((L) => Math.abs(pupilFor(L) - deGroot(L))));
for (const s of settled) {
  if (Math.abs(s.measured - s.deGroot) > spread + 0.01) {
    fail(`at ${s.L} cd/m² the pupil is ${s.measured.toFixed(2)} mm against De Groot's ${s.deGroot.toFixed(2)} — outside the ${spread.toFixed(2)} mm the two published fits disagree by`);
  }
}

// THE ANATOMICAL RANGE, which is the one bound neither curve fit can move.
const widest = Math.max(...settled.map((s) => s.measured));
const narrowest = Math.min(...settled.map((s) => s.measured));
if (narrowest < PUPIL_MIN - 1e-9 || widest > PUPIL_MAX + 1e-9) {
  fail(`the pupil ran ${narrowest.toFixed(2)}–${widest.toFixed(2)} mm, outside the anatomical ${PUPIL_MIN}–${PUPIL_MAX}`);
}
if (!(widest - narrowest > 4)) {
  fail(`across eight decades the pupil only moved ${(widest - narrowest).toFixed(2)} mm — a real one covers most of ${PUPIL_MAX - PUPIL_MIN}`);
}

// ...AND IT IS LOGARITHMIC, WHICH IS THE SHAPE A NAIVE ONE GETS WRONG.
//
// A decade of light near the middle of the range moves the pupil a millimetre.
// The same ABSOLUTE increment of luminance up at daylight moves it almost
// nothing. A pupil linear in luminance does the opposite, and this is the
// assertion that separates them without appealing to either fit's coefficients.
const perDecade = pupilFor(1) - pupilFor(10);
const perSameStep = pupilFor(1000) - pupilFor(1009);
const logness = perDecade / Math.max(1e-9, perSameStep);
// THE BOUND IS BRACKETED BY THE TWO CANDIDATE SHAPES, not chosen between them.
// For a pure log law D = a − b log L the ratio is 1 / log10(1009/1000) = 257;
// for a linear-in-luminance one it is 9/9 = 1. The tanh's saturation pushes the
// real figure above 257. Anything over a hundred is unambiguously the log
// family and two orders off the linear one.
const LINEAR_WOULD_GIVE = 1;
const LOG_WOULD_GIVE = 1 / Math.log10(1009 / 1000);
if (!(logness > 100)) {
  fail(`nine units of luminance moved the pupil ${perSameStep.toFixed(4)} mm at daylight and a decade moved it ${perDecade.toFixed(2)} at dusk — only ${logness.toFixed(0)}x, so the response is not logarithmic`);
}

// ------------------------------------------- 2. AND THE TWO MUSCLES DIFFER

let muscles = {};
{
  // Settle in the dark, throw the lights on, then off again, and watch.
  const p = new Pupils({ luminance: 0.1 });
  for (let i = 0; i < 30 / DT; i++) p.update(DT, { luminance: 0.1 });
  const wide = p.diameter;

  let shutIn = 0;
  for (let t = 0; t < 12; t += DT) {
    p.update(DT, { luminance: 1000 });
    // The 63% point of a first-order response is one time constant.
    if (!shutIn && p.diameter <= wide - (wide - pupilFor(1000)) * 0.632) shutIn = t;
  }
  const narrow = p.diameter;

  let openIn = 0;
  for (let t = 0; t < 30; t += DT) {
    p.update(DT, { luminance: 0.1 });
    if (!openIn && p.diameter >= narrow + (pupilFor(0.1) - narrow) * 0.632) openIn = t;
  }
  // Both measurements include the reflex latency, so it comes off both.
  muscles = { shutIn: shutIn - PUPIL_LATENCY, openIn: openIn - PUPIL_LATENCY, wide, narrow };
  muscles.ratio = muscles.openIn / Math.max(1e-9, muscles.shutIn);

  if (Math.abs(muscles.shutIn / CONSTRICT_TAU - 1) > 0.15) {
    fail(`constriction took ${muscles.shutIn.toFixed(2)}s to 63% against a published ${CONSTRICT_TAU}`);
  }
  if (Math.abs(muscles.openIn / DILATE_TAU - 1) > 0.15) {
    fail(`redilation took ${muscles.openIn.toFixed(2)}s to 63% against a published ${DILATE_TAU}`);
  }
  if (!(muscles.ratio > 2)) {
    fail(`the pupil opened only ${muscles.ratio.toFixed(1)}x slower than it shut — sphincter and dilator are not the same muscle`);
  }

  // AND IT DOES NOT MOVE AT ALL FOR THE FIRST FIFTH OF A SECOND.
  //
  // THE WINDOW IS A LITERAL 0.15 s, NOT `PUPIL_LATENCY * 0.9`. Deriving the
  // window from the constant under test is the same mistake the blink gate made
  // with BLINK_OPEN/BLINK_CLOSE and the smile gate made with CORNER_TRAVEL:
  // setting the latency to zero shrank the loop to nothing and it passed. The
  // published light-reflex latency is 200–250 ms, so 150 ms is inside anybody's
  // measurement of it and is a fact about eyes rather than about this file.
  const BLIND_FOR = 0.15;
  const q = new Pupils({ luminance: 1 });
  for (let i = 0; i < 20 / DT; i++) q.update(DT, { luminance: 1 });
  const before = q.diameter;
  let moved = 0;
  for (let t = 0; t < BLIND_FOR; t += DT) {
    q.update(DT, { luminance: 5000 });
    moved = Math.max(moved, Math.abs(q.diameter - before));
  }
  if (moved > 1e-6) {
    fail(`the pupil moved ${moved.toFixed(4)} mm inside ${BLIND_FOR}s, and the published reflex latency is 200-250 — it reacted before it saw`);
  }
}

// ---------------------- 3. AND YOU CANNOT READ A MOOD OFF IT IN CHANGING LIGHT

/**
 * A session: the light wanders across decades, the effort wanders
 * independently, and an observer tries to recover the effort from the pupil.
 *
 * `hold` keeps each level for long enough that the response has time to follow
 * it — correlating a lagged signal against its own command otherwise measures
 * the lag rather than the coupling.
 */
function session(model, { varyingLight }) {
  let state = 12345;
  const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  const diameters = [];
  const efforts = [];
  const logL = [];
  let luminance = 50;
  let effort = 0;
  const HOLD = 4;
  for (let t = 0; t < 600; t += DT) {
    if (t % HOLD < DT) {
      if (varyingLight) luminance = Math.pow(10, rand() * 6 - 2);
      effort = rand();
    }
    const d = model(DT, luminance, effort);
    // Skip the settling transient at the head of each hold.
    if (t % HOLD > HOLD * 0.6) {
      diameters.push(d);
      efforts.push(effort);
      logL.push(Math.log10(luminance));
    }
  }
  return {
    withEffort: Math.abs(correlate(diameters, efforts)),
    withLight: Math.abs(correlate(diameters, logL)),
  };
}

const shipped = () => {
  const p = new Pupils({ luminance: 50 });
  return (dt, luminance, effort) => p.update(dt, { luminance, effort });
};
/**
 * THE CONTROL: a mood dial. What every rig ships — a pupil that answers to the
 * character's state and has never heard of the scene's lighting.
 */
const moodDial = () => {
  let d = 4;
  return (dt, _luminance, effort) => {
    const want = 3.5 + effort * 2.5;
    d += (want - d) * (1 - Math.exp(-dt / 0.8));
    return d;
  };
};

const read = {
  shippedVarying: session(shipped(), { varyingLight: true }),
  shippedFixed: session(shipped(), { varyingLight: false }),
  dialVarying: session(moodDial(), { varyingLight: true }),
  dialFixed: session(moodDial(), { varyingLight: false }),
};
read.shippedRatio = read.shippedFixed.withEffort / Math.max(1e-9, read.shippedVarying.withEffort);
read.dialRatio = read.dialFixed.withEffort / Math.max(1e-9, read.dialVarying.withEffort);

// The published methodological fact, on this model.
if (!(read.shippedRatio > 3)) {
  fail(`effort was only ${read.shippedRatio.toFixed(1)}x more readable in fixed light than in changing light — the light reflex is not dominating as published`);
}
if (!(read.shippedVarying.withLight > 0.8)) {
  fail(`in changing light the pupil tracked the luminance at r=${read.shippedVarying.withLight.toFixed(2)} — it is not metering the light`);
}
// ...and the mood dial gets it exactly backwards: mood is equally readable
// whatever the lighting does, which is the claim that is false about faces.
if (!(read.dialRatio < 1.5)) {
  fail(`the mood-dial control was ${read.dialRatio.toFixed(1)}x better in fixed light — it has no light response, so it cannot have one`);
}
if (read.dialVarying.withLight > 0.2) {
  fail(`the mood-dial control tracked luminance at r=${read.dialVarying.withLight.toFixed(2)} — it is not the control it claims to be`);
}
if (!(read.shippedRatio > read.dialRatio * 2)) {
  fail(`the shipped model separated the two conditions by ${read.shippedRatio.toFixed(1)}x and the dial by ${read.dialRatio.toFixed(1)}x — the light reflex is not doing any work`);
}

// ------------------------------------------- 4. AND IT REACHES THE RIG
let rigged = {};
{
  const rig = createHumanoid({ height: 1.75, seed: 6 });
  const eyes = createEyes(rig);
  const irisWidth = eyes.group.children[2].geometry.parameters.width;
  const at = (mm) => {
    eyes.apply({ lid: 0, gaze: 0, pupil: mm });
    return { mm: eyes.pupilMm(), drawn: eyes.group.children[4].scale.x * irisWidth };
  };
  const dark = at(PUPIL_MAX);
  const bright = at(PUPIL_MIN);
  rigged = { irisWidth, dark, bright, ratio: dark.drawn / bright.drawn };

  // THE TWELVE IS A LITERAL, NOT `IRIS_MM`.
  //
  // Asserting the drawn fraction against `want / IRIS_MM` uses the constant
  // being tested on both sides, so it held for any value — setting IRIS_MM to 6
  // sailed straight through. The adult iris is about twelve millimetres across
  // and that is a fact about eyes, so the gate says twelve.
  const IRIS_ANATOMY_MM = 12;
  if (IRIS_MM !== IRIS_ANATOMY_MM) {
    fail(`IRIS_MM is ${IRIS_MM} and an adult iris is ${IRIS_ANATOMY_MM} mm across`);
  }
  for (const [want, got] of [[PUPIL_MAX, dark], [PUPIL_MIN, bright]]) {
    if (Math.abs(got.drawn / irisWidth - want / IRIS_ANATOMY_MM) > 0.005) {
      fail(`at ${want} mm the pupil covers ${(got.drawn / irisWidth).toFixed(3)} of the iris against the ${(want / IRIS_ANATOMY_MM).toFixed(3)} anatomy asks for`);
    }
  }
  if (Math.abs(rigged.ratio - PUPIL_MAX / PUPIL_MIN) > 0.02) {
    fail(`the drawn pupil changed by ${rigged.ratio.toFixed(2)}x between dark and bright against the ${(PUPIL_MAX / PUPIL_MIN).toFixed(2)} the diameters ask for`);
  }
  // ...and a big-eyed character gets the same FRACTION, not the same millimetres.
  const big = createEyes(createHumanoid({ height: 1.75, seed: 6, face: { eyes: { size: 1.2 } } }));
  const bigIris = big.group.children[2].geometry.parameters.width;
  big.apply({ lid: 0, gaze: 0, pupil: PUPIL_MAX });
  const bigFraction = (big.group.children[4].scale.x * bigIris) / bigIris;
  if (Math.abs(bigFraction - dark.drawn / irisWidth) > 1e-9) {
    fail('a character with bigger eyes drew a different fraction of iris as pupil');
  }
}

// --------------------------------------------------------------- 5. NONSENSE
{
  const p = new Pupils({ luminance: NaN });
  const eyes = createEyes(createHumanoid({ height: 1.75, seed: 6 }));
  for (const dt of [0, DT, -1, 5, NaN]) {
    for (const luminance of [NaN, -5, 0, 1e12, Infinity]) {
      for (const effort of [NaN, -3, 4, 0.5]) {
        const d = p.update(dt, { luminance, effort });
        eyes.apply({ lid: 0, gaze: 0, pupil: d });
        if (!Number.isFinite(d) || d < PUPIL_MIN - 1e-9 || d > PUPIL_MAX + 1e-9) {
          fail(`the pupil went to ${d} on dt=${dt} L=${luminance} effort=${effort}`);
        }
        if (!Number.isFinite(eyes.pupilMm())) fail('the rig drew a non-finite pupil');
      }
    }
  }
  // ...and effort alone, held for ever, must not walk the pupil open: the task
  // response is ADDED to the reflex, not fed back into it.
  const q = new Pupils({ luminance: 50 });
  for (let i = 0; i < 300 / DT; i++) q.update(DT, { luminance: 50, effort: 1 });
  if (Math.abs(q.diameter - (pupilFor(50) + EFFORT_DILATION)) > 0.02) {
    fail(`five minutes of full effort left the pupil at ${q.diameter.toFixed(2)} mm against the ${(pupilFor(50) + EFFORT_DILATION).toFixed(2)} it should sit at — the task response is compounding`);
  }
}

// ------------------------------------------------------------------- REPORT

if (json) {
  console.log(JSON.stringify({ settled, muscles, read, rigged, spread, failures }, null, 2));
} else {
  console.log('\n  1. THE PUPIL IS A LIGHT METER\n');
  console.log('    luminance    measured   Moon&Spencer   DeGroot 1952');
  for (const s of settled) {
    console.log(`    ${String(s.L).padStart(9)}   ${s.measured.toFixed(2).padStart(7)} mm  ${s.published.toFixed(2).padStart(9)}     ${s.deGroot.toFixed(2).padStart(9)}`);
  }
  console.log(`\n    range ${narrowest.toFixed(2)}–${widest.toFixed(2)} mm of an anatomical ${PUPIL_MIN}–${PUPIL_MAX}`);
  console.log(`    the two published fits disagree by up to ${spread.toFixed(2)} mm, which is the budget`);
  console.log(`    a decade at dusk moves it ${logness.toFixed(0)}x what the same units move it at noon\n`);

  console.log('  2. AND THE TWO MUSCLES ARE NOT THE SAME MUSCLE\n');
  console.log(`    shut in  ${muscles.shutIn.toFixed(2)}s   against a published ${CONSTRICT_TAU}`);
  console.log(`    opened in ${muscles.openIn.toFixed(2)}s   against a published ${DILATE_TAU}`);
  console.log(`    ${muscles.ratio.toFixed(1)}x slower to open than to shut, and blind for the first ${PUPIL_LATENCY}s\n`);

  console.log('  3. SO YOU CANNOT READ A MOOD OFF IT UNLESS YOU FIX THE LIGHT\n');
  console.log('                        effort readable   tracks the light');
  console.log(`    changing light           r=${read.shippedVarying.withEffort.toFixed(2)}            r=${read.shippedVarying.withLight.toFixed(2)}`);
  console.log(`    fixed light              r=${read.shippedFixed.withEffort.toFixed(2)}            r=${read.shippedFixed.withLight.toFixed(2)}`);
  console.log(`\n    ${read.shippedRatio.toFixed(1)}x more readable with the light held still.`);
  console.log(`    the mood-dial control: ${read.dialRatio.toFixed(1)}x — it says the same thing in any light,`);
  console.log(`    and tracks the luminance at r=${read.dialVarying.withLight.toFixed(2)}, which is to say not at all.\n`);

  console.log('  4. AND IT REACHES THE RIG\n');
  console.log(`    at ${PUPIL_MAX} mm the pupil is ${(rigged.dark.drawn / rigged.irisWidth * 100).toFixed(0)}% of the iris`);
  console.log(`    at ${PUPIL_MIN} mm  ${(rigged.bright.drawn / rigged.irisWidth * 100).toFixed(0)}%  — a ${rigged.ratio.toFixed(2)}x change, drawn\n`);
}

if (failures.length) {
  console.error('\npupils FAILED:');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('pupils: the light won ✓');
