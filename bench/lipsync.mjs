#!/usr/bin/env node
/**
 * The lip-sync gate — a face driven from OUTSIDE, and the far half of a
 * handshake whose near half lives in another package.
 *
 *   npm run lipsync            fail if the mouth stops following what it is told
 *   npm run lipsync -- --json  the numbers, machine-readable
 *
 * ## The seam
 *
 * `Speech` has its own phoneme table, its own durations and its own visemes.
 * Something else in the trilogy has a vocal tract: it knows what a mouth is
 * shaped like because **F1 IS mouth opening** — a jaw that drops raises the
 * first formant — but its phoneme alphabet is not this one and never will be.
 * It has consonants this file has no viseme for and this file has visemes it
 * has no sound for.
 *
 * So nothing is shared except the SHAPE. `Speech.follow()` takes
 * `{ open, round, close, spread }` per segment and drives a jaw with it through
 * the same dominance blend, the same speed limit and the same lip bridge its own
 * phonemes get. **Neither package imports the other, and this gate imports
 * nothing from the other side either** — the shapes below are written out here,
 * because a gate that fetched them would be testing the import.
 *
 * ## What each half proves, and what they prove together
 *
 * The other package measures the correlation between a vowel's `open` and the
 * FIRST FORMANT of the audio it renders: r = 0.832.
 * This one measures the correlation between the same `open` and the JAW GAP IN
 * METRES on a real rig, stepped at a real frame rate.
 *
 * Compose them and you have what a viewer actually checks — the mouth and the
 * sound are one event — without either library having heard of the other.
 */
import { ANTICIPATION, createHumanoid, createMouth, JAW_SPEED, JAW_TRAVEL, LIP_BRIDGE, Speech } from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

/**
 * A spoken line as SHAPES, written out here rather than imported.
 *
 * "the traveller stopped at the gate" — the same line the other package's gate
 * speaks, transcribed into mouth geometry. A bilabial shuts (`close: 1`); an
 * open vowel drops the jaw; a rounded one purses. Nothing here knows what a
 * formant is, and nothing on the other side knows what a bone is.
 */
const LINE = [
  { seconds: 0.068, shape: { open: 0.18, round: 0.10, close: 0, spread: 0 } },     // ð
  { seconds: 0.049, shape: { open: 0.50, round: 0.10, close: 0, spread: 0.20 } },  // ə
  { seconds: 0.088, shape: { open: 0.18, round: 0.10, close: 0, spread: 0.35 } },  // t
  { seconds: 0.070, shape: { open: 0.30, round: 0.10, close: 0, spread: 0 } },     // ɹ
  { seconds: 0.217, shape: { open: 0.85, round: 0.00, close: 0, spread: 0.30 } },  // æ
  { seconds: 0.100, shape: { open: 0.18, round: 0.10, close: 0.55, spread: 0 } },  // v
  { seconds: 0.065, shape: { open: 0.30, round: 0.10, close: 0, spread: 0 } },     // l
  { seconds: 0.049, shape: { open: 0.50, round: 0.10, close: 0, spread: 0.20 } },  // ə
  { seconds: 0.070, shape: { open: 0.30, round: 0.10, close: 0, spread: 0 } },     // ɹ
  { seconds: 0.110, shape: { open: 0.18, round: 0.10, close: 0, spread: 0.35 } },  // s
  { seconds: 0.088, shape: { open: 0.18, round: 0.10, close: 0, spread: 0.35 } },  // t
  { seconds: 0.227, shape: { open: 1.00, round: 0.05, close: 0, spread: 0 } },     // ɑ
  { seconds: 0.093, shape: { open: 0.00, round: 0.10, close: 1, spread: 0 } },     // p
  { seconds: 0.088, shape: { open: 0.18, round: 0.10, close: 0, spread: 0.35 } },  // t
  { seconds: 0.217, shape: { open: 0.85, round: 0.00, close: 0, spread: 0.30 } },  // æ
  { seconds: 0.088, shape: { open: 0.18, round: 0.10, close: 0, spread: 0.35 } },  // t
  { seconds: 0.068, shape: { open: 0.18, round: 0.10, close: 0, spread: 0 } },     // ð
  { seconds: 0.049, shape: { open: 0.50, round: 0.10, close: 0, spread: 0.20 } },  // ə
  { seconds: 0.078, shape: { open: 0.18, round: 0.10, close: 0, spread: 0 } },     // g
  { seconds: 0.281, shape: { open: 0.60, round: 0.00, close: 0, spread: 0.30 } },  // ɛ
  { seconds: 0.088, shape: { open: 0.18, round: 0.10, close: 0, spread: 0.35 } },  // t
];

const RIG_HEIGHT = 1.75;
const RATE = 1 / 120;

/**
 * Run the line and measure the JAW, in metres, off the rig.
 *
 * Not off the shape the class reports — off the geometry. A controller that
 * returns a beautiful `MouthShape` and a prop that ignores it look identical
 * from the controller's side, which is the same reason the other package reads
 * its pitch back out of the samples.
 */
function run(shapes, shift = 0) {
  const rig = createHumanoid({ height: RIG_HEIGHT, seed: 4 });
  const mouth = createMouth(rig);
  const speech = new Speech('', {});
  speech.follow(shapes);
  const total = shapes.reduce((a, s) => a + s.seconds, 0);
  const samples = [];
  let t = 0;
  // Seeded from the controller's own starting posture, not from zero. Starting
  // at zero makes frame one look like the jaw travelled the whole rest gap in
  // a single step and reported 0.452 m/s against a limit of 0.200 — an
  // artefact of the measurement, and the limiter was never violated.
  let lastGap = speech.shape.open * JAW_TRAVEL * (RIG_HEIGHT / 1.75);
  let worstSpeed = 0;
  while (t < total) {
    const shape = speech.update(RATE);
    mouth.apply(shape);
    // The gap the geometry actually shows: the two lips, in metres.
    const upper = mouth.group.children[1];
    const lower = mouth.group.children[2];
    const gap = Math.max(0, upper.position.y - lower.position.y - 0.0075 * RIG_HEIGHT);
    // What was ASKED for, at the instant the FACE is meant to be showing it.
    //
    // `mouthAt` deliberately leads the sound by ANTICIPATION — a mouth reaches
    // its shape before the sound arrives, which is what a real one does. Line
    // the two up naively and the correlation looks bad; the first version of
    // this gate then compared against a track shifted by exactly 100 ms, which
    // CANCELLED the anticipation, and the control scored 0.834 against the
    // aligned case's 0.353. A control that beats the thing it is controlling
    // for is not a weak control, it is a sign the alignment is wrong.
    let want = null;
    let acc = 0;
    const at = t + ANTICIPATION + shift;
    for (const s of shapes) {
      if (at >= acc && at < acc + s.seconds) { want = s.shape; break; }
      acc += s.seconds;
    }
    if (want) samples.push({ t, gap, want, shown: shape });
    // The JAW's own travel, not the visible aperture. The lips are light and
    // deliberately NOT speed-limited — a bilabial that had to wait for the jaw
    // would stop being one — so measuring the gap between them measures the
    // lips and reports 1.19 m/s against a jaw limit of 0.20.
    const jaw = shape.open * JAW_TRAVEL * (RIG_HEIGHT / 1.75);
    worstSpeed = Math.max(worstSpeed, Math.abs(jaw - lastGap) / RATE);
    lastGap = jaw;
    t += RATE;
  }
  return { samples, worstSpeed, total };
}

const correlate = (xs, ys) => {
  const mx = mean(xs);
  const my = mean(ys);
  let n = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) { n += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  return n / Math.sqrt(dx * dy + 1e-12);
};

const aligned = run(LINE, 0);
// A further tenth of a second BEYOND the anticipation the model already has —
// about one syllable, and where a dubbed film starts to look wrong.
const shifted = run(LINE, 0.1);

const rAligned = correlate(aligned.samples.map((s) => s.want.open), aligned.samples.map((s) => s.gap));
const rShifted = correlate(shifted.samples.map((s) => s.want.open), shifted.samples.map((s) => s.gap));

// ---------------------------------------- 1. THE FACE FOLLOWS WHAT IT IS TOLD

if (!(rAligned > 0.75)) {
  fail(`the jaw follows a supplied shape track at r = ${rAligned.toFixed(3)} — a face driven from outside is not being driven`);
}
if (!(rShifted < rAligned * 0.75)) {
  fail(`a track shifted 100 ms out of step still correlates at r = ${rShifted.toFixed(3)} against ${rAligned.toFixed(3)} — the correlation is not about alignment, so it says nothing about lip-sync`);
}

// -------------------------------- 2. AND THROUGH THE SAME PHYSICS, NOT AROUND IT

{
  // The speed limit is not bypassed by supplying shapes. A jaw that could jump
  // would follow the track perfectly and look like a puppet.
  const limit = JAW_SPEED * (RIG_HEIGHT / 1.75);
  if (!(aligned.worstSpeed <= limit * 1.35)) {
    fail(`the jaw moved at ${aligned.worstSpeed.toFixed(3)} m/s against a published ${limit.toFixed(3)} — a supplied shape is going around the speed limit`);
  }
  // ...and it has to be USING it. A jaw that never approaches its limit is not
  // being asked for anything, and the undershoot below would be free.
  if (!(aligned.worstSpeed > limit * 0.4)) {
    fail(`the jaw never exceeded ${aligned.worstSpeed.toFixed(3)} m/s — the line is not demanding anything of it`);
  }

  // UNDERSHOOT. A short segment between two closed ones does not reach its own
  // opening, because the jaw cannot get there and back. Lindblom measured that
  // in 1963 and here it is a consequence of one speed rather than a rule — and
  // it has to survive the shapes coming from somewhere else.
  const reach = (openWanted) => {
    const hits = aligned.samples.filter((s) => Math.abs(s.want.open - openWanted) < 1e-6);
    return hits.length ? Math.max(...hits.map((s) => s.gap)) / (JAW_TRAVEL * (RIG_HEIGHT / 1.75)) : NaN;
  };
  const long = reach(1.0);    // /ɑ/, 227 ms
  const short = reach(0.5);   // /ə/, 49 ms
  if (!(short < long * 0.8)) {
    fail(`a 49 ms /ə/ reaches ${(short * 100).toFixed(0)}% of its opening and a 227 ms /ɑ/ reaches ${(long * 100).toFixed(0)}% — there is no undershoot, so the jaw has no mass`);
  }

  // THE SEAL. A bilabial has to actually shut the mouth, whoever supplied it.
  // This is the one viseme a viewer reads off a silent face.
  const closed = aligned.samples.filter((s) => s.want.close > 0.9);
  const gapAtClose = Math.min(...closed.map((s) => s.gap));
  if (!(closed.length > 3)) fail('the line never asks for a seal, so the seal is untested');
  if (!(gapAtClose <= LIP_BRIDGE * (RIG_HEIGHT / 1.75) * 0.35)) {
    fail(`the lips are ${(gapAtClose * 1000).toFixed(1)} mm apart at the closest point of a /p/ — that is not a closed mouth`);
  }
  var physics = { worstSpeed: aligned.worstSpeed, limit, long, short, gapAtClose };
}

// ------------------------------------------- 3. the things it must not do

{
  // An empty track, a zero-length segment, a shape full of nonsense.
  const rig = createHumanoid({ height: 1.75, seed: 2 });
  const mouth = createMouth(rig);
  const speech = new Speech('', {});
  for (const track of [
    [],
    [{ seconds: 0, shape: { open: 1, round: 0, close: 0, spread: 0 } }],
    [{ seconds: -1, shape: { open: 0.5, round: 0.5, close: 0.5, spread: 0.5 } }],
    [{ seconds: 0.1, shape: { open: 5, round: -3, close: 9, spread: 0 } }],
  ]) {
    speech.follow(track);
    for (let i = 0; i < 40; i++) {
      const shape = speech.update(RATE);
      mouth.apply(shape);
      for (const k of ['open', 'round', 'close', 'spread']) {
        if (!Number.isFinite(shape[k])) { fail(`a ${JSON.stringify(track)} track produced ${shape[k]} for ${k}`); break; }
      }
      if (!Number.isFinite(mouth.group.children[1].position.y)) {
        fail('the prop moved to a non-finite position');
        break;
      }
    }
  }
  // Following replaces, it does not append.
  speech.say('aba');
  const own = speech.track.length;
  speech.follow(LINE);
  if (speech.track.length !== LINE.length) fail(`follow() left ${speech.track.length} segments from a ${LINE.length}-segment track (had ${own})`);
  if (speech.elapsed !== 0) fail('follow() did not rewind the clock');
  // A supplied shape must not leak into the phoneme table.
  speech.say('aba');
  if (speech.track.some((s) => s.shape)) fail('a phoneme utterance came back carrying supplied shapes');
}

// ------------------------------------------------------------------- report

if (json) {
  console.log(JSON.stringify({ failures, rAligned, rShifted, physics, frames: aligned.samples.length }, null, 2));
} else {
  console.log('lipsync — a face driven from outside, and the far half of a handshake\n');
  console.log('  THE FACE FOLLOWS WHAT IT IS TOLD');
  console.log('  A track of mouth shapes, decided somewhere this package cannot import,');
  console.log('  against the JAW GAP IN METRES measured off the rig — not off the shape');
  console.log('  the controller reports, because a controller that returns a beautiful');
  console.log('  shape and a prop that ignores it look identical from the controller.\n');
  console.log(`    aligned:                 r = ${rAligned.toFixed(3)}   over ${aligned.samples.length} frames at 120 Hz`);
  console.log(`    the track 100 ms early:  r = ${rShifted.toFixed(3)}   ← the control\n`);

  console.log('  AND THROUGH THE SAME PHYSICS, NOT AROUND IT');
  console.log(`    fastest the jaw moved:   ${physics.worstSpeed.toFixed(3)} m/s   against a published ${physics.limit.toFixed(3)}`);
  console.log(`    a 227 ms opening reaches ${(physics.long * 100).toFixed(0)}% of itself`);
  console.log(`    a  49 ms opening reaches ${(physics.short * 100).toFixed(0)}%  ← undershoot, and nobody wrote a rule for it`);
  console.log(`    lips at the tightest /p/: ${(physics.gapAtClose * 1000).toFixed(1)} mm`);
  console.log('\n    Lindblom measured that undershoot in 1963. Here it falls out of one');
  console.log('    published jaw speed, and it survives the shapes arriving from outside.\n');

  console.log('  THE OTHER HALF');
  console.log('  GAMA measures r = 0.832 between the same `open` and the FIRST FORMANT of');
  console.log('  the audio it renders. This measures it against the jaw. Compose them and');
  console.log('  the mouth and the sound are one event — and neither package has heard of');
  console.log('  the other. What they share is not a type. It is that F1 is mouth opening.');
}

if (failures.length) {
  console.error('\nLIPSYNC OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error('\nA face that does not follow is worse than no face. Nothing is shared but the shape.');
  process.exit(1);
}
if (!json) console.log('\nlipsync: the shape came from outside and the jaw went where it said ✓');
