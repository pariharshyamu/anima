#!/usr/bin/env node
/**
 * The blink gate — the rate is not a constant, and the shape is not symmetric.
 *
 *   npm run blink            fail if the eyes stop being eyes
 *   npm run blink -- --json  the numbers, machine-readable
 *
 * 1. THE RATE IS THE TASK. Bentivoglio et al. (1997) counted spontaneous blinks
 *    in ninety adults: 17 a minute at rest, 4.5 reading, 26 in conversation.
 *    Reading suppresses it to a quarter and talking nearly doubles it, and that
 *    SPREAD is the claim — a rig that blinks on a timer has a spread of one.
 *
 * 2. A BLINK IS NOT SYMMETRIC. The lid falls with orbicularis behind it and is
 *    lifted back by levator against gravity, so the down phase is about twice as
 *    fast as the up. The control is a symmetric blink, which is what everybody
 *    writes and which reads as a twitch.
 *
 * 3. AND THE LID RIDES THE EYE. Levator palpebrae and superior rectus share an
 *    origin: look down and the lid follows. A rig whose lids stay put while the
 *    eyes travel looks reptilian.
 *
 * EVERYTHING IS MEASURED OFF THE RIG'S OWN APERTURE, in metres — not off the
 * number the controller reports, because a controller that returns a beautiful
 * shape and a prop that ignores it look identical from the controller.
 */
import {
  APERTURE, BLINK_CLOSE, BLINK_OPEN, BLINK_RATE, BLINK_SECONDS, Blinking,
  GAZE_LID, LID_SPEED, createEyes, createHumanoid,
} from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const RATE = 1 / 120;
const RIG_HEIGHT = 1.75;
const TASKS = ['rest', 'reading', 'conversing'];
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

const rigEyes = () => createEyes(createHumanoid({ height: RIG_HEIGHT, seed: 6 }));

// ------------------------------------------------- 1. THE RATE IS THE TASK

/**
 * OVER MANY SEEDS, because one run of a Poisson process says very little.
 *
 * The rate estimated from N blinks has a standard error of `rate / sqrt(N)`. A
 * single hour at rest is about a thousand blinks, so one seed is worth ±3% —
 * and the first two seeds tried here happened to land at 16.3 and 16.4 against
 * a published 17, which looks exactly like a 4% bias and is not one. A dozen
 * half-hours is about 3000 blinks and worth ±1.8%, which is a number a budget
 * can be built on.
 *
 * AND THIS SECTION STEPS AT A COARSER CLOCK than the kinematics one below. What
 * it measures is how OFTEN a blink starts, which is a property of the interval
 * distribution and not of the frame rate; sampling it at 120 Hz costs eight
 * times the work for nothing. The first version ran 31 million updates and had
 * to be killed after ten minutes — a gate nobody can afford to run is a gate
 * nobody runs.
 *
 * The cost is a bias: a cycle overshoots by about one and a half steps, which at
 * 60 Hz is 0.7% of a resting cycle. That is well inside the budget below and it
 * is stated rather than hidden.
 */
const SEEDS = 12;
const MINUTES = 30;
const COARSE = 1 / 60;
const measured = {};
for (const task of TASKS) {
  const rates = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const b = new Blinking({ task, seed });
    for (let i = 0; i < MINUTES * 60 * 60; i++) b.update(COARSE);
    rates.push(b.count / MINUTES);
  }
  const m = mean(rates);
  const sd = Math.sqrt(mean(rates.map((r) => (r - m) ** 2)));
  measured[task] = { rate: m, sd, seeds: SEEDS, blinks: Math.round(m * MINUTES * SEEDS) };
}

// THE BUDGET IS THE STANDARD ERROR, times four. The error on the pooled mean is
// `sd / sqrt(SEEDS)`, and four of those is a hundred-to-one event under the null
// — comfortably outside sampling noise and comfortably inside anything a wrong
// rate would do.
for (const task of TASKS) {
  const m = measured[task];
  const se = m.sd / Math.sqrt(SEEDS);
  const err = Math.abs(m.rate - BLINK_RATE[task]);
  m.se = se;
  m.error = err;
  if (!(err < 4 * se + 0.05)) {
    fail(`${task} blinks ${m.rate.toFixed(2)} a minute against Bentivoglio's ${BLINK_RATE[task]} — ${(err / se).toFixed(1)} standard errors out over ${m.blinks} blinks, which is not sampling`);
  }
}

// AND THE SPREAD IS THE POINT. A rig that blinks on a timer has a spread of one
// whatever number it picked; the published ratio is nearly six.
const spread = measured.conversing.rate / measured.reading.rate;
const published = BLINK_RATE.conversing / BLINK_RATE.reading;
if (!(Math.abs(spread / published - 1) < 0.1)) {
  fail(`conversing over reading is ${spread.toFixed(1)}x against a published ${published.toFixed(1)}x — the rate is not following the task`);
}

// ...and a face that changes task changes rate WITHIN one run, which is the
// thing a game actually does. Nothing here re-creates the controller.
let switching = {};
{
  const b = new Blinking({ task: 'reading', seed: 3 });
  const count = (task, minutes) => {
    const before = b.count;
    for (let i = 0; i < minutes * 60 * 60; i++) b.update(COARSE, { task });
    return (b.count - before) / minutes;
  };
  switching = { reading: count('reading', 30), conversing: count('conversing', 30) };
  if (!(switching.conversing > switching.reading * 3)) {
    fail(`one face reading then talking blinked ${switching.reading.toFixed(1)} then ${switching.conversing.toFixed(1)} a minute — the task change did not take`);
  }
}

// ------------------------------------------- 2. AND THE SHAPE IS ASYMMETRIC

/** One blink, measured off the rig's aperture in metres. */
function profile({ symmetric = false } = {}) {
  const eyes = rigEyes();
  const b = new Blinking({ task: 'rest', seed: 11 });
  b.blink();
  const samples = [];
  let t = 0;
  for (let i = 0; i < Math.ceil((BLINK_SECONDS + 0.2) * 120); i++) {
    // GAZE UP, so the lid starts from its full travel.
    //
    // The published number is a DURATION, not a speed: a blink takes the same
    // time whether the lid starts wide open or half down, so its speed varies
    // with where it started. At a level gaze the lid already sits a sixth of the
    // way down and the peak comes out at 0.093 m/s against a derived 0.111 —
    // which is the model being right and the check being wrong. LID_SPEED is
    // the wide-open case, so this measures the wide-open case.
    let shape = b.update(RATE, { gaze: 1 });
    if (symmetric) {
      // THE CONTROL: the same total duration, split evenly. This is what a rig
      // writes when it lerps a blink, and it is the thing that reads as a
      // twitch — same length, same closure, wrong shape.
      const half = BLINK_SECONDS / 2;
      const p = Math.min(t, BLINK_SECONDS);
      shape = { ...shape, lid: p < half ? p / half : Math.max(0, 1 - (p - half) / half) };
    }
    eyes.apply(shape);
    samples.push({ t, gap: eyes.aperture() });
    t += RATE;
  }
  const shut = samples.reduce((a, s) => (s.gap < a.gap ? s : a));
  // Time from wide open to shut, and from shut back to wide open.
  const open = samples[0].gap;
  const closing = shut.t;
  let reopened = samples[samples.length - 1].t;
  for (const s of samples) if (s.t > shut.t && s.gap >= open * 0.98) { reopened = s.t; break; }
  let fastest = 0;
  for (let i = 1; i < samples.length; i++) {
    fastest = Math.max(fastest, Math.abs(samples[i].gap - samples[i - 1].gap) / RATE);
  }
  return { open, closing, opening: reopened - shut.t, shut: shut.gap, fastest };
}

const asym = profile();
const flat = profile({ symmetric: true });
// THE LITERAL TWO, not `BLINK_OPEN / BLINK_CLOSE`.
//
// The source derives the opening phase FROM the closing one, so a gate that
// compares the measured ratio against that expression is comparing the model to
// itself: setting `BLINK_OPEN = BLINK_CLOSE` moves the measurement to 1.0 AND
// the expectation to 1.0, and the check sails through. It did — the symmetric
// mutation only failed on an unrelated line. The published claim is that
// reopening takes about twice as long, and two is what goes here.
const publishedRatio = 2;
asym.ratio = asym.opening / Math.max(1e-9, asym.closing);
flat.ratio = flat.opening / Math.max(1e-9, flat.closing);

if (!(Math.abs(asym.ratio / publishedRatio - 1) < 0.25)) {
  fail(`the lid reopens ${asym.ratio.toFixed(2)}x slower than it shuts against a published ${publishedRatio.toFixed(1)}x — the blink is the wrong shape`);
}
if (!(Math.abs(flat.ratio - 1) < 0.25)) {
  fail(`the symmetric control came out at ${flat.ratio.toFixed(2)}x, so it is not symmetric and is not a control`);
}
// AND THE EYE ACTUALLY SHUTS. A blink that only gets four fifths of the way
// down is a squint, and it is what happens when a lid is lerped toward a target
// it never has time to reach.
if (!(asym.shut < asym.open * 0.02)) {
  fail(`the narrowest the eye got is ${(asym.shut * 1000).toFixed(2)} mm of a ${(asym.open * 1000).toFixed(1)} mm aperture — that is a squint, not a blink`);
}
// ...and the lid moves at the speed the two published numbers imply.
const limit = LID_SPEED * (RIG_HEIGHT / 1.75);
if (!(Math.abs(asym.fastest / limit - 1) < 0.15)) {
  fail(`the lid's fastest is ${asym.fastest.toFixed(3)} m/s against a derived ${limit.toFixed(3)} — ${(APERTURE * 1000).toFixed(0)} mm in ${BLINK_CLOSE}s is not what it is doing`);
}

// ------------------------------------------------- 3. AND THE LID RIDES THE EYE

let gazed = {};
{
  const eyes = rigEyes();
  const b = new Blinking({ task: 'rest', seed: 21 });
  // THE WIDEST THE EYE GETS at this gaze, over four seconds — which is the
  // RESTING aperture, because a blink can only make it narrower.
  //
  // The first version tried to wait out blinks by looping until the lid read
  // below a threshold, and hung for ever: at a downward gaze the resting lid IS
  // 0.11, which is above any threshold that would have excluded a blink. The
  // quantity wanted was the maximum all along.
  const at = (gaze) => {
    let widest = 0;
    for (let i = 0; i < 4 * 120; i++) {
      eyes.apply(b.update(RATE, { gaze }));
      widest = Math.max(widest, eyes.aperture());
    }
    return widest;
  };
  const up = at(1);
  const level = at(0);
  const down = at(-1);
  gazed = { up, level, down };
  if (!(down < level && level < up)) {
    fail(`the aperture is ${(down * 1000).toFixed(1)} / ${(level * 1000).toFixed(1)} / ${(up * 1000).toFixed(1)} mm looking down / level / up — the lid is not following the eye`);
  }
  // AND BY WHAT ITS OWN CONSTANT SAYS. This one is a round trip — `GAZE_LID` is
  // put in and read back out — and it is here anyway because it is exactly the
  // class of bug it caught: the first version multiplied by GAZE_LID twice and
  // the lid moved a NINTH of its share, 11% of the aperture across the entire
  // gaze range. The ORDERING above is the anatomy; this is the arithmetic.
  const range = (up - down) / up;
  gazed.range = range;
  if (!(Math.abs(range / GAZE_LID - 1) < 0.1)) {
    fail(`the lid moves ${(range * 100).toFixed(0)}% of the aperture across the gaze range where GAZE_LID says ${(GAZE_LID * 100).toFixed(0)}% — the coupling is not what its own constant claims`);
  }
}

// ------------------------------------------- 4. the things it must not do

{
  const eyes = rigEyes();
  const b = new Blinking({ task: 'rest', seed: 4 });
  for (const state of [
    { gaze: NaN }, { gaze: Infinity }, { gaze: -1e9 }, { gaze: 1e9 },
    { task: 'sleeping' }, {}, { task: 'conversing', gaze: 0.5 },
  ]) {
    for (const dt of [0, RATE, -1, 5, NaN]) {
      const shape = b.update(dt, state);
      eyes.apply(shape);
      if (!Number.isFinite(shape.lid) || shape.lid < 0 || shape.lid > 1) {
        fail(`${JSON.stringify(state)} at dt=${dt} produced lid = ${shape.lid}`);
      }
      const gap = eyes.aperture();
      if (!Number.isFinite(gap) || gap < 0 || gap > APERTURE * 1.01) {
        fail(`${JSON.stringify(state)} at dt=${dt} produced an aperture of ${gap}`);
      }
    }
  }
  // Deterministic, because a replay that blinks differently is not a replay.
  const run = (seed) => {
    const x = new Blinking({ task: 'rest', seed });
    const out = [];
    for (let i = 0; i < 6000; i++) out.push(Number(x.update(RATE).lid.toFixed(6)));
    return out.join(',');
  };
  if (run(5) !== run(5)) fail('the same seed blinked differently twice');
  if (run(5) === run(6)) fail('two seeds blinked identically');
}

// ------------------------------------------------------------------- report

if (json) {
  console.log(JSON.stringify({ failures, measured, spread, published, switching, asym, flat, gazed, limit }, null, 2));
} else {
  console.log('blink — the rate is the task, and the shape is not symmetric\n');
  console.log('  1. THE RATE IS THE TASK');
  console.log(`  Bentivoglio et al. (1997), ninety adults. ${SEEDS} seeds x ${MINUTES} minutes each,`);
  console.log('  because one run of a Poisson process is worth about three per cent and the');
  console.log('  first two tried here landed at 16.3 and 16.4 — which looks exactly like a');
  console.log('  four per cent bias and is not one.\n');
  console.log('    task          measured   Bentivoglio   error');
  for (const task of TASKS) {
    const m = measured[task];
    console.log(
      `    ${task.padEnd(12)} ${m.rate.toFixed(2).padStart(6)}/min    ${String(BLINK_RATE[task]).padStart(5)}      ${(m.error / m.se).toFixed(1)} se`
    );
  }
  console.log(`\n    Reading against conversing is ${spread.toFixed(1)}x, published ${published.toFixed(1)}x. THAT is the claim:`);
  console.log('    a rig that blinks on a timer has a spread of one whatever number it');
  console.log(`    picked. One face switching task mid-run went ${switching.reading.toFixed(1)} → ${switching.conversing.toFixed(1)} a minute.\n`);

  console.log('  2. AND THE SHAPE IS NOT SYMMETRIC');
  console.log('  The lid falls with orbicularis behind it and is lifted back by levator');
  console.log('  against gravity. Measured off the rig\'s APERTURE IN METRES.\n');
  console.log(`    down in ${(asym.closing * 1000).toFixed(0)} ms, back up in ${(asym.opening * 1000).toFixed(0)} — ${asym.ratio.toFixed(2)}x, published ${publishedRatio.toFixed(1)}x`);
  console.log(`    an even split:                       ${flat.ratio.toFixed(2)}x   ← the control`);
  console.log(`    narrowest aperture reached:          ${(asym.shut * 1000).toFixed(2)} mm of ${(asym.open * 1000).toFixed(1)}`);
  console.log(`    fastest the lid moved:               ${asym.fastest.toFixed(3)} m/s against a derived ${limit.toFixed(3)}`);
  console.log(`\n    The speed is DERIVED: ${(APERTURE * 1000).toFixed(0)} mm of aperture closed in the published`);
  console.log(`    ${BLINK_CLOSE}s. Nobody chose it, and it moves if either number does.\n`);

  console.log('  3. AND THE LID RIDES THE EYE');
  console.log('  Levator palpebrae and superior rectus share an origin, so a lid that');
  console.log('  stayed put while the eyes travelled would look reptilian.\n');
  console.log(`    looking up    ${(gazed.up * 1000).toFixed(1)} mm`);
  console.log(`    level         ${(gazed.level * 1000).toFixed(1)} mm`);
  console.log(`    looking down  ${(gazed.down * 1000).toFixed(1)} mm      ${(gazed.range * 100).toFixed(0)}% of the aperture, GAZE_LID says ${(GAZE_LID * 100).toFixed(0)}%`);
}

if (failures.length) {
  console.error('\nBLINK OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error('\nA face that blinks on a timer blinks at the wrong rate for everything it does.');
  process.exit(1);
}
if (!json) console.log('\nblink: the rate came from the task and the lid fell faster than it rose ✓');
