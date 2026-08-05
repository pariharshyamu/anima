#!/usr/bin/env node
/**
 * The saccade gate — two published laws for one movement, and only one of them
 * was allowed into the model.
 *
 *   npm run saccades            fail if the eyes stop obeying the main sequence
 *   npm run saccades -- --json  the numbers, machine-readable
 *
 * Bahill, Clark & Stark (1975) give BOTH the duration and the peak velocity of a
 * saccade as functions of its amplitude. `src/saccades.ts` uses the duration one
 * and nothing else — it does not read `PEAK_VELOCITY_MAX` or
 * `VELOCITY_CONSTANT`, and `npm run saccades -- --audit` greps the source to
 * prove it. So the peak velocity is a PREDICTION, and this is where it gets
 * checked against a law that never went in.
 *
 * EVERY VELOCITY HERE IS DIFFERENCED OFF THE ANGLE TRACE the controller
 * actually produces, frame by frame. None of it re-evaluates the formula: a
 * closed form checked against itself is not checked, and it would sail through
 * a controller that returned the right numbers to nobody.
 */
import { readFileSync } from 'node:fs';
import {
  MICROSACCADE_AMPLITUDE, MICROSACCADE_RATE, ORBITAL_RANGE, PEAK_VELOCITY_MAX,
  SACCADE_INTERCEPT, SACCADE_SLOPE, SCAN, Saccades, VELOCITY_CONSTANT,
  createEyes, createHumanoid, irisOffset, saccadeDuration,
} from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const STEP = 1 / 2000;          // 0.5 ms — a 25 ms saccade is 50 samples
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

/** The published peak velocity. Used ONLY here, never by the model. */
const publishedPeak = (a) => PEAK_VELOCITY_MAX * (1 - Math.exp(-a / VELOCITY_CONSTANT));

// The amplitudes this is claimed over. Nearly every natural saccade is in here:
// free viewing peaks around 4-5 degrees and reading is about 2.
const AMPLITUDES = [2, 3, 5, 7, 10, 13, 16, 20];

// ------------------------------------------------ 0. THE MODEL DID NOT CHEAT
//
// The whole argument rests on the model not having seen the peak-velocity law,
// and that is a fact about the source text, so it is checked as one.
{
  const src = readFileSync(new URL('../src/saccades.ts', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('export function saccadeDuration'));
  for (const forbidden of ['PEAK_VELOCITY_MAX', 'VELOCITY_CONSTANT']) {
    if (body.includes(forbidden)) {
      fail(`${forbidden} is referenced in the model's own code — the peak-velocity check is no longer independent`);
    }
  }
}

// ------------------------------- 1. THE MAIN SEQUENCE, MEASURED OFF THE TRACE

/** Fly one saccade of this amplitude and watch it, in degrees and seconds. */
function fly(amplitude) {
  const s = new Saccades({ task: 'scene', seed: 5 });
  s.look(amplitude, 0);
  let last = s.angles.yaw;
  let peak = 0;
  let t = 0;
  let flight = 0;
  const trace = [];
  while (s.moving && t < 1) {
    s.update(STEP);
    t += STEP;
    const v = Math.abs(s.angles.yaw - last) / STEP;
    peak = Math.max(peak, v);
    trace.push({ t, yaw: s.angles.yaw, v });
    last = s.angles.yaw;
    flight = t;
  }
  return { amplitude, peak, flight, travelled: Math.abs(s.angles.yaw), trace };
}

const flights = AMPLITUDES.map(fly);

// The duration law is the one the model USES, so this catches an implementation
// slip and not a modelling one. Labelled as the self-check it is.
for (const f of flights) {
  const want = saccadeDuration(f.amplitude);
  if (Math.abs(f.flight / want - 1) > 0.06) {
    fail(`a ${f.amplitude}° saccade took ${(f.flight * 1000).toFixed(1)} ms against its own law's ${(want * 1000).toFixed(1)} ms`);
  }
  if (Math.abs(f.travelled / f.amplitude - 1) > 0.001) {
    fail(`a ${f.amplitude}° saccade landed ${f.travelled.toFixed(3)}° away — it does not arrive where it was sent`);
  }
}

// ...AND NOW THE INDEPENDENT ONE.
const peaks = flights.map((f) => ({
  amplitude: f.amplitude,
  measured: f.peak,
  published: publishedPeak(f.amplitude),
  error: f.peak / publishedPeak(f.amplitude) - 1,
}));
const worst = Math.max(...peaks.map((p) => Math.abs(p.error)));

/**
 * THE BUDGET IS THE BEST ANY FIXED SHAPE COULD DO, and it is computed from the
 * two published laws ALONE — nothing of the model goes into it.
 *
 * Divide the published peak by the mean velocity the published duration
 * implies, and what is left is a pure number: the shape of the velocity
 * profile. It is not quite constant — it drifts from about 1.63 at 5° to 1.53
 * at 20°, because real large saccades are skewed — so no single fixed profile
 * can sit on the published curve everywhere. The best one could possibly do is
 * to sit at the middle of that drift, and THAT residual is the floor.
 *
 * A budget of "5%" would have been a number somebody picked. This one says the
 * only thing worth saying: the shipped shape is as close to the published curve
 * as a fixed shape is permitted to get.
 */
const ratios = AMPLITUDES.map((a) => (publishedPeak(a) * saccadeDuration(a)) / a);
const bestRatio = mean(ratios);
const floor = Math.max(...ratios.map((r) => Math.abs(bestRatio / r - 1)));

if (!(worst <= floor * 1.05)) {
  fail(`the peak velocity misses Bahill by ${(worst * 100).toFixed(1)}% against a floor of ${(floor * 100).toFixed(1)}% — the velocity profile is the wrong shape`);
}

// ------------------------------------------------------------- THE CONTROLS
//
// The shapes somebody would actually write. Each is scored the same way: the
// ratio of peak to mean velocity is a property of the profile alone, so the
// error against the published curve follows from it directly.
const SHAPES = [
  { name: 'a half-sine (shipped)', ratio: Math.PI / 2 },
  { name: 'a parabola', ratio: 1.5 },
  { name: 'smoothstep', ratio: 2 },
  { name: 'a constant speed', ratio: 1 },
];
for (const s of SHAPES) s.error = Math.max(...ratios.map((r) => Math.abs(s.ratio / r - 1)));
const shipped = SHAPES[0];
const smooth = SHAPES.find((s) => s.name === 'smoothstep');

// The shipped profile has to be the best of them...
for (const s of SHAPES.slice(1)) {
  if (!(shipped.error < s.error)) {
    fail(`${s.name} matches the published peak velocity better than the shipped half-sine (${(s.error * 100).toFixed(1)}% against ${(shipped.error * 100).toFixed(1)}%)`);
  }
}
// ...and the one everybody reaches for has to lose by a lot, or this whole
// file is an argument about nothing.
if (!(smooth.error > shipped.error * 4)) {
  fail(`smoothstep is only ${(smooth.error / shipped.error).toFixed(1)}x worse than the shipped shape — the choice of profile is not doing any work`);
}
// AND THE MEASURED TRACE HAS TO AGREE WITH THE SHAPE IT CLAIMS TO BE, or the
// table above is arithmetic about a model that is not running.
const measuredRatio = mean(flights.map((f) => f.peak / (f.amplitude / f.flight)));
if (Math.abs(measuredRatio / (Math.PI / 2) - 1) > 0.03) {
  fail(`the trace's peak-to-mean is ${measuredRatio.toFixed(3)} against the half-sine's ${(Math.PI / 2).toFixed(3)} — the controller is not doing what the table says`);
}

// ------------------------------------------------- 2. A DIAGONAL IS ONE MOVE
//
// Both eyes' components move together and finish together, so the amplitude is
// the hypotenuse. Driving each axis by its own component makes a 45° saccade
// travel 1.41x as far in the time its horizontal part was allotted.
let diagonal = {};
{
  const s = new Saccades({ task: 'scene', seed: 9 });
  s.look(10, 10);
  let t = 0;
  while (s.moving && t < 1) { s.update(STEP); t += STEP; }
  const want = saccadeDuration(Math.hypot(10, 10));
  diagonal = { flight: t, want, amplitude: Math.hypot(10, 10) };
  if (Math.abs(t / want - 1) > 0.06) {
    fail(`a 10°-by-10° saccade took ${(t * 1000).toFixed(1)} ms; its amplitude is the 14.1° diagonal, which the law puts at ${(want * 1000).toFixed(1)} ms`);
  }
}

// ------------------------------------------------------- 3. AND IT IS BALLISTIC
{
  const s = new Saccades({ task: 'scene', seed: 4 });
  s.look(15, 0);
  for (let i = 0; i < 5; i++) s.update(STEP);
  s.look(-15, 0);                       // ...ignored: no mid-flight steering.
  let t = 0;
  while (s.moving && t < 1) { s.update(STEP); t += STEP; }
  if (Math.abs(s.angles.yaw - 15) > 0.01) {
    fail(`a saccade redirected in flight ended at ${s.angles.yaw.toFixed(2)}° — saccades are ballistic and cannot be steered`);
  }
}

// ------------------------------------------ 4. THE SCANPATH IS THE TASK (YARBUS)

const SECONDS = 600;
const scanned = {};
for (const task of Object.keys(SCAN)) {
  const s = new Saccades({ task, seed: 3 });
  const sizes = [];
  let before = { ...s.angles };
  let wasMoving = false;
  for (let i = 0; i < SECONDS / STEP; i++) {
    s.update(STEP, { task });
    if (s.moving && !wasMoving) before = { ...s.angles };
    if (!s.moving && wasMoving) sizes.push(Math.hypot(s.angles.yaw - before.yaw, s.angles.pitch - before.pitch));
    wasMoving = s.moving;
  }
  // Fixations per second is the reciprocal of the fixation time plus the
  // saccade's own flight, the same way a blink cycle includes the blink.
  scanned[task] = { rate: s.count / SECONDS, amplitude: mean(sizes.filter((x) => x > MICROSACCADE_AMPLITUDE * 2)) };
  const cycle = SCAN[task].fixation + saccadeDuration(SCAN[task].amplitude);
  const want = 1 / cycle;
  if (Math.abs(scanned[task].rate / want - 1) > 0.08) {
    fail(`${task} produced ${scanned[task].rate.toFixed(2)} saccades a second against Rayner's ${want.toFixed(2)}`);
  }
  if (Math.abs(scanned[task].amplitude / SCAN[task].amplitude - 1) > 0.35) {
    fail(`${task} moved ${scanned[task].amplitude.toFixed(1)}° at a time against Rayner's ${SCAN[task].amplitude}°`);
  }
}
// The SPREAD is the claim, the same way it was for blinking: reading is tight,
// scene viewing is loose, and a rig with one scanpath has a spread of one.
const spread = scanned.scene.amplitude / scanned.reading.amplitude;
const published = SCAN.scene.amplitude / SCAN.reading.amplitude;
if (!(spread > 1.4)) {
  fail(`scene viewing moves ${spread.toFixed(2)}x as far as reading against a published ${published.toFixed(1)}x — the task is not reaching the eyes`);
}

// -------------------------------------------------- 5. THE EYE IS NEVER STILL
let micro = {};
{
  const s = new Saccades({ task: 'scene', seed: 12 });
  let flicks = 0;
  let biggest = 0;
  let wasMoving = false;
  let before = { ...s.angles };
  const held = s.count;
  for (let i = 0; i < SECONDS / STEP; i++) {
    s.update(STEP);
    if (s.moving && !wasMoving) before = { ...s.angles };
    if (!s.moving && wasMoving) {
      const size = Math.hypot(s.angles.yaw - before.yaw, s.angles.pitch - before.pitch);
      if (size < MICROSACCADE_AMPLITUDE * 2) { flicks++; biggest = Math.max(biggest, size); }
    }
    wasMoving = s.moving;
  }
  // ...but they happen DURING a fixation, so they are only possible in the gaps.
  const dwelling = SECONDS * (SCAN.scene.fixation / (SCAN.scene.fixation + saccadeDuration(SCAN.scene.amplitude)));
  micro = { rate: flicks / dwelling, biggest, counted: s.count - held };
  if (Math.abs(micro.rate / MICROSACCADE_RATE - 1) > 0.25) {
    fail(`microsaccades came at ${micro.rate.toFixed(2)}/s of fixation against Martinez-Conde's ${MICROSACCADE_RATE}`);
  }
  if (!(biggest < 1)) {
    fail(`the biggest microsaccade was ${biggest.toFixed(2)}° — over a degree it is a saccade`);
  }
  // AND THEY MUST NOT BE COUNTED AS FIXATIONS, or Rayner's rate above is being
  // met by a different movement than the one he measured.
  const wantFixations = SECONDS / (SCAN.scene.fixation + saccadeDuration(SCAN.scene.amplitude));
  if (Math.abs(micro.counted / wantFixations - 1) > 0.08) {
    fail(`${micro.counted} movements were counted where Rayner expects ${wantFixations.toFixed(0)} — microsaccades are being counted as fixations`);
  }
}

// ------------------------------------- 6. THE EYE HANDS OVER TO THE HEAD
let orbit = {};
{
  const s = new Saccades({ task: 'scene', seed: 7 });
  let reached = 0;
  let handed = 0;
  for (let i = 0; i < 120 / STEP; i++) {
    s.update(STEP, { target: { yaw: 60, pitch: 0 } });
    reached = Math.max(reached, Math.abs(s.angles.yaw));
    handed = Math.max(handed, Math.abs(s.headDemand.yaw));
  }
  orbit = { reached, handed };
  if (reached > ORBITAL_RANGE + 1e-6) {
    fail(`the eye reached ${reached.toFixed(1)}° in the socket against a customary range of ${ORBITAL_RANGE}°`);
  }
  if (!(handed > 60 - ORBITAL_RANGE - 5)) {
    fail(`asked for 60° the eye stopped at ${reached.toFixed(1)}° and passed only ${handed.toFixed(1)}° to the head — the rest went nowhere and the agent is staring past what it was told to look at`);
  }
}

// ------------------------------ 7. AND IT MOVES THE RIG, IN MILLIMETRES
let seen = {};
{
  const rig = createHumanoid({ height: 1.75, seed: 6 });
  const eyes = createEyes(rig);
  const irisOf = () => eyes.pupil();
  eyes.apply({ lid: 0, gaze: 0, yaw: 0 });
  const centre = irisOf();
  eyes.apply({ lid: 0, gaze: 0, yaw: 1 });
  const right = irisOf() - centre;
  eyes.apply({ lid: 0, gaze: 0, yaw: -1 });
  const left = irisOf() - centre;
  // R sin θ, and nothing else. The eyeball is twelve millimetres in everybody.
  const want = irisOffset(1, 1.75);
  seen = { right, left, want };
  if (Math.abs(right / want - 1) > 0.02) {
    fail(`the iris travelled ${(right * 1000).toFixed(2)} mm at full gaze against the globe's ${(want * 1000).toFixed(2)} mm`);
  }
  if (Math.abs(right + left) > 1e-9) {
    fail(`the iris moved ${(right * 1000).toFixed(2)} mm right and ${(left * 1000).toFixed(2)} mm left — it is not symmetric`);
  }
  // ...and a big-eyed character does NOT get a bigger swing, because the globe
  // is the same size. This is the one that catches "travel = a fraction of the
  // eye's width", which is what everybody writes and which is wrong.
  const big = createEyes(createHumanoid({ height: 1.75, seed: 6, face: { eyes: { size: 1.2 } } }));
  big.apply({ lid: 0, gaze: 0, yaw: 0 });
  const bc = big.pupil();
  big.apply({ lid: 0, gaze: 0, yaw: 1 });
  seen.big = big.pupil() - bc;
  if (Math.abs(seen.big / right - 1) > 0.02) {
    fail(`a character with 20% bigger eyes swung ${(seen.big * 1000).toFixed(2)} mm against ${(right * 1000).toFixed(2)} — the travel is coming from the drawing, not the globe`);
  }
}

// --------------------------------------------------------------- 8. NONSENSE
{
  const s = new Saccades({ task: 'scene', seed: 2 });
  for (const dt of [0, STEP, -1, 5, NaN]) {
    for (const target of [null, { yaw: NaN, pitch: 0 }, { yaw: 1e9, pitch: -1e9 }, {}]) {
      s.update(dt, { target, task: 'sleeping' });
      if (!Number.isFinite(s.angles.yaw) || !Number.isFinite(s.angles.pitch)) {
        fail(`gaze went non-finite on dt=${dt} target=${JSON.stringify(target)}`);
      }
      if (Math.abs(s.angles.yaw) > ORBITAL_RANGE + 1e-6) fail(`gaze left the socket: ${s.angles.yaw}`);
    }
  }
  const run = (seed) => {
    const a = new Saccades({ task: 'scene', seed });
    const out = [];
    for (let i = 0; i < 20000; i++) out.push(a.update(1 / 240).yaw.toFixed(6));
    return out.join(',');
  };
  if (run(5) !== run(5)) fail('the same seed produced two different scanpaths');
  if (run(5) === run(6)) fail('two seeds produced the same scanpath');
}

// ------------------------------------------------------------------- REPORT

if (json) {
  console.log(JSON.stringify({ peaks, shapes: SHAPES, floor, scanned, micro, orbit, seen, diagonal, failures }, null, 2));
} else {
  console.log('\n  1. THE MAIN SEQUENCE');
  console.log('  Bahill, Clark & Stark (1975) give the duration AND the peak velocity.');
  console.log('  The model was given the duration. The peak velocity is a prediction.\n');
  console.log('    amplitude   measured    Bahill    error');
  for (const p of peaks) {
    console.log(`    ${String(p.amplitude).padStart(6)}°   ${p.measured.toFixed(0).padStart(6)}°/s  ${p.published.toFixed(0).padStart(6)}°/s   ${(p.error * 100).toFixed(1).padStart(5)}%`);
  }
  console.log(`\n    worst ${(worst * 100).toFixed(1)}% against a floor of ${(floor * 100).toFixed(1)}% — the best ANY fixed`);
  console.log('    profile could do, computed from the two published laws alone.\n');
  console.log('  The shape was not chosen. It is what is left when both laws hold:\n');
  for (const s of SHAPES) {
    console.log(`    ${s.name.padEnd(24)} peak/mean ${s.ratio.toFixed(3)}   ${(s.error * 100).toFixed(1).padStart(5)}% off`);
  }
  console.log(`\n    the trace's own peak/mean: ${measuredRatio.toFixed(3)}`);
  console.log(`    a ${diagonal.amplitude.toFixed(1)}° diagonal flew in ${(diagonal.flight * 1000).toFixed(1)} ms, its law says ${(diagonal.want * 1000).toFixed(1)}\n`);

  console.log('  2. AND WHERE IT LOOKS IS THE TASK (Yarbus 1967, via Rayner)\n');
  console.log('    task        saccades/s   Rayner     size   Rayner');
  for (const task of Object.keys(SCAN)) {
    const want = 1 / (SCAN[task].fixation + saccadeDuration(SCAN[task].amplitude));
    console.log(`    ${task.padEnd(10)}   ${scanned[task].rate.toFixed(2).padStart(6)}   ${want.toFixed(2).padStart(6)}   ${scanned[task].amplitude.toFixed(1).padStart(6)}°  ${String(SCAN[task].amplitude).padStart(4)}°`);
  }
  console.log(`\n    scene against reading is ${spread.toFixed(1)}x, published ${published.toFixed(1)}x`);
  console.log(`    microsaccades ${micro.rate.toFixed(2)}/s of fixation, biggest ${micro.biggest.toFixed(2)}°\n`);

  console.log('  3. AND THE EYE HANDS OVER TO THE HEAD\n');
  console.log(`    asked for 60°: the eye took ${orbit.reached.toFixed(1)}°, the head got ${orbit.handed.toFixed(1)}°`);
  console.log(`    iris travel at full gaze: ${(seen.right * 1000).toFixed(2)} mm, R sin θ says ${(seen.want * 1000).toFixed(2)}`);
  console.log(`    with 20% bigger eyes drawn: ${(seen.big * 1000).toFixed(2)} mm — the globe does not care\n`);
}

if (failures.length) {
  console.error('\nsaccades FAILED:');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('saccades: the eye obeyed a law it was never given ✓');
