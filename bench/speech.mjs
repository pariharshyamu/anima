#!/usr/bin/env node
/**
 * The speech gate — the twentieth.
 *
 *   npm run speech            fail if the mouth stops being a mouth
 *   npm run speech -- --json  the numbers, machine-readable
 *
 * ## The claim
 *
 * Every lipsync system starts by inventing a list of mouth shapes. That list
 * has been published since 1888 and is called the IPA, whose two axes are
 * exactly the two things a mouth visibly does: vowel HEIGHT is how far the jaw
 * is down, and ROUNDEDNESS is what the lips are doing.
 *
 * So this gate checks that the module is a reading of that chart rather than a
 * table somebody made up — the openness must be monotone in height, the
 * rounding must be independent of it, and two vowels that differ only in
 * rounding must come out differing only in rounding.
 *
 * ## And the one that matters more than all of it
 *
 *   A BILABIAL MUST CLOSE THE LIPS.
 *
 * `/p/`, `/b/` and `/m/` are made by sealing the lips. If "mama" is blended
 * until the seal is 60% shut, it reads as a mouth flapping vaguely and every
 * viewer knows something is wrong without being able to say what. It is the
 * single most recognisable broken lipsync there is, and it is what happens when
 * closure is averaged like the other channels instead of taken as a maximum.
 */
import {
  ANTICIPATION, DOMINANCE, JAW_SPEED, JAW_TRAVEL, PHONEMES, PHONEME_KEYS, Speech,
  VISEMES, VISEME_NAMES,
  createHumanoid, createMouth, mouthAt, mouthOf, syllableRate, utterance,
  utteranceLength, visemeOf,
} from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const close = (a, b, tol, what) => {
  if (!(Math.abs(a - b) <= tol)) fail(`${what}: ${a} against ${b}, tolerance ${tol}`);
};
const peak = (keys, channel) => {
  const t = utterance(keys);
  let m = 0;
  for (let x = 0; x <= utteranceLength(t); x += 0.004) m = Math.max(m, mouthAt(t, x)[channel]);
  return m;
};
const trough = (keys, channel) => {
  const t = utterance(keys);
  let m = 1;
  for (let x = 0; x <= utteranceLength(t); x += 0.004) m = Math.min(m, mouthAt(t, x)[channel]);
  return m;
};

// -------------------------------- 1. the chart, read off rather than invented

const VOWELS = ['i', 'y', 'e', 'E', 'a', 'A', 'O', 'o', 'u', 'M', '@'];
for (const k of VOWELS) {
  const p = PHONEMES[k];
  const m = mouthOf(k);
  close(m.open, p.height, 1e-12, `/${p.ipa}/: openness is not the IPA's vowel height`);
  close(m.round, p.round, 1e-12, `/${p.ipa}/: rounding is not the IPA's roundedness`);
}
// Openness is MONOTONE in height across the whole inventory, which it can only
// be if it is the same number.
const byHeight = [...VOWELS].sort((a, b) => PHONEMES[a].height - PHONEMES[b].height);
for (let i = 1; i < byHeight.length; i++) {
  if (mouthOf(byHeight[i]).open < mouthOf(byHeight[i - 1]).open - 1e-12) {
    fail(`/${PHONEMES[byHeight[i]].ipa}/ is higher on the chart and opens less`);
  }
}
// TWO AXES, NOT ONE. /i/ and /y/ are the same height and differ only in
// rounding; /u/ and /ɯ/ likewise. If rounding leaked into openness these would
// not come out equal.
close(mouthOf('i').open, mouthOf('y').open, 1e-12, '/i/ and /y/ differ in openness, and they only differ in rounding');
close(mouthOf('u').open, mouthOf('M').open, 1e-12, '/u/ and /ɯ/ differ in openness, and they only differ in rounding');
if (!(mouthOf('y').round > mouthOf('i').round + 0.5)) fail('/y/ is not much rounder than /i/');
if (!(mouthOf('u').round > mouthOf('M').round + 0.5)) fail('/u/ is not much rounder than /ɯ/');
// Spread is rounding seen from the other end, gated by how open the mouth is.
if (!(mouthOf('a').spread > mouthOf('u').spread + 0.5)) fail('an open unrounded vowel is not the widest thing here');

// ------------------------- 2. the viseme collapse is a classification

// Every phoneme lands in exactly one viseme, and the bilabials land together.
const seen = new Set();
for (const [name, keys] of Object.entries(VISEMES)) {
  for (const k of keys) {
    if (!PHONEMES[k]) fail(`viseme '${name}' lists '${k}', which is not a phoneme`);
    if (seen.has(k)) fail(`'${k}' is in more than one viseme`);
    seen.add(k);
  }
}
for (const k of PHONEME_KEYS) if (!seen.has(k)) fail(`'${k}' is in no viseme at all`);
if (!(VISEME_NAMES.length < PHONEME_KEYS.length)) {
  fail('there are as many visemes as phonemes, which is not what eyes do');
}
for (const k of ['p', 'b', 'm']) {
  if (visemeOf(k) !== 'bilabial') fail(`/${k}/ is not classed as a bilabial`);
  close(mouthOf(k).close, 1, 1e-12, `/${k}/ does not fully seal the lips`);
}
// ...and the collapse has to be severe, or lip-reading would be easy.
if (!(PHONEME_KEYS.length / VISEME_NAMES.length > 2.5)) {
  fail('fewer than two and a half phonemes per viseme — the collapse has stopped happening');
}

// ------------------- 3. THE ONE THAT MATTERS: "mama" closes the lips

for (const word of ['mama', 'papa', 'baba', 'mama.mama']) {
  const shut = peak(word, 'close');
  if (!(shut > 0.95)) {
    fail(`"${word}" only reaches ${(shut * 100).toFixed(0)}% lip closure — the single most recognisable broken lipsync`);
  }
}
// ...and it does NOT close when there is nothing to close for.
for (const word of ['halo', 'sisi', 'tata']) {
  const shut = peak(word, 'close');
  if (!(shut < 0.35)) fail(`"${word}" has no bilabial and still sealed to ${(shut * 100).toFixed(0)}%`);
}
// A sealed mouth is not WIDELY open — but it is allowed to be a bit open, and
// the difference matters. Lips can bridge a small gap; that is what humming is,
// and a nasal is voiced through a closed mouth with the jaw wherever it likes.
//
// This budget was 15% and it was wrong: it encoded the assumption that the jaw
// follows the lips, which is what made the jaw slam shut at thirty times the
// speed a jaw can move. The lips are light and the jaw is a bone, and the two
// are not the same channel.
const mama = utterance('mama');
for (let x = 0; x <= utteranceLength(mama); x += 0.004) {
  const m = mouthAt(mama, x);
  if (m.close > 0.9 && m.open > 0.45) {
    fail(`at ${x.toFixed(2)}s the lips are ${(m.close * 100).toFixed(0)}% sealed across a ${(m.open * 100).toFixed(0)}% open jaw`);
  }
}
// And the vowel between the two /m/s has to actually open, or "mama" is a hum.
if (!(peak('mama', 'open') > 0.6)) fail(`"mama" never opens past ${(peak('mama', 'open') * 100).toFixed(0)}%`);

// ------------------------------ 4. timing is published, not a frame count

for (const k of PHONEME_KEYS) {
  const d = PHONEMES[k].duration;
  if (!(d > 0.04 && d < 0.25)) fail(`/${PHONEMES[k].ipa}/ lasts ${d}s, which is not a phoneme`);
}
// A stop is shorter than an open vowel, because it is.
if (!(PHONEMES.p.duration < PHONEMES.a.duration * 0.6)) fail('a stop is no longer much shorter than an open vowel');
// The track is laid out by those durations and nothing is evenly spaced.
const track = utterance('mama');
close(track[0].duration, PHONEMES.m.duration, 1e-12, 'a segment does not last its own published duration');
close(track[1].at, PHONEMES.m.duration, 1e-12, 'segments do not abut');
if (Math.abs(track[0].duration - track[1].duration) < 1e-6) fail('an /m/ and an /a/ came out the same length');
// Speech rate lands where read speech lands.
for (const phrase of ['mama', 'halo', 'papa.mama']) {
  const r = syllableRate(utterance(phrase));
  if (!(r > 3 && r < 8)) fail(`"${phrase}" runs at ${r.toFixed(1)} syllables/s, and speech is 3-8`);
}
// Rate scales it and does not reorder it.
const fast = utterance('mama', 2);
close(utteranceLength(fast), utteranceLength(track) / 2, 1e-12, 'doubling the rate did not halve the utterance');

// --------------------------- 5. coarticulation leads, and blends the rest

close(ANTICIPATION, 0.1, 1e-12, 'the anticipatory lead has moved off the measured tenth of a second');
if (!(DOMINANCE > 1)) fail('dominance no longer reaches past a phoneme’s own segment');
// THE LEAD: the mouth is already moving toward the first sound before it starts.
const lead = mouthAt(utterance('.a'), 0.02);
const noLead = mouthOf('.');
if (!(lead.open > noLead.open + 0.05)) {
  fail('the mouth is not already opening toward a vowel that has not started — there is no anticipation');
}
// AND THE JAW MOVES AT A SPEED A JAW MANAGES.
//
// The raw dominance blend is the TARGET, and it swings at over a metre a second
// because phonemes are 60-190 ms long. A jaw peaks around 200 mm/s. So the
// controller rate-limits it, and the difference between what the blend asks for
// and what the face reaches is UNDERSHOOT — which Lindblom measured in 1963 and
// which is here a consequence of one published speed rather than a rule.
const talker = new Speech('halo.mama.sisi', { loop: false });
let worst = 0;
let prev = talker.shape.open;
while (!talker.done) {
  const m = talker.update(1 / 120);
  worst = Math.max(worst, Math.abs(m.open - prev));
  prev = m.open;
}
const mmPerSecond = worst * JAW_TRAVEL * 120 * 1000;
if (!(mmPerSecond <= JAW_SPEED * 1000 * 1.02)) {
  fail(`the jaw moved at ${mmPerSecond.toFixed(0)} mm/s, and a jaw peaks at ${JAW_SPEED * 1000}`);
}

// ...and the consequence: a SHORT vowel undershoots its own target and a long
// one reaches it. Nothing encoded that; the rate limit did.
const shortA = new Speech('mam', {});
let reachedShort = 0;
while (!shortA.done) reachedShort = Math.max(reachedShort, shortA.update(1 / 120).open);
const longA = new Speech('.a.a.a.', {});
let reachedLong = 0;
while (!longA.done) reachedLong = Math.max(reachedLong, longA.update(1 / 120).open);
if (!(reachedLong > reachedShort + 0.1)) {
  fail(
    `an /a/ hemmed in by bilabials reached ${reachedShort.toFixed(2)} and a free one ` +
      `${reachedLong.toFixed(2)} — there is no undershoot, so the jaw is not being limited`
  );
}

// ---------------------------------------- 6. the controller and the prop

const s = new Speech('mama', { rate: 1 });
let sealed = 0;
while (!s.done) {
  const m = s.update(1 / 60);
  if (m.close > 0.9) sealed++;
}
if (!(sealed > 0)) fail('driving the controller at 60 Hz never once sealed the lips');
close(s.length, utteranceLength(utterance('mama')), 1e-12, 'the controller’s length is not the utterance’s');
const looped = new Speech('mama', { loop: true });
for (let i = 0; i < 500; i++) looped.update(1 / 60);
if (looped.done) fail('a looping utterance finished');

const rig = createHumanoid({ seed: 42 });
const mouth = createMouth(rig);
if (!mouth.group.parent) fail('the mouth prop did not attach to the head');
mouth.apply({ open: 1, round: 0, close: 0, spread: 1 });
const wide = mouth.group.children[2].position.y;
mouth.apply({ open: 0, round: 0, close: 1, spread: 0 });
const shut = mouth.group.children[2].position.y;
if (!(shut > wide)) fail('the lower lip does not drop when the mouth opens');

// ---------------------------------------------------------------- report

if (json) {
  console.log(JSON.stringify({ failures }, null, 2));
} else {
  console.log('speech — the IPA is already a viseme table\n');
  console.log('  vowel     height   round  ->   open   round  spread');
  console.log('  ' + '-'.repeat(52));
  for (const k of ['i', 'y', 'u', 'e', 'o', 'E', 'a', 'A', 'O']) {
    const p = PHONEMES[k];
    const m = mouthOf(k);
    console.log(
      `  /${p.ipa}/       ${p.height.toFixed(2)}    ${p.round.toFixed(2)}      ` +
        `${m.open.toFixed(2)}   ${m.round.toFixed(2)}    ${m.spread.toFixed(2)}`
    );
  }
  console.log('\n  Two lookups and a subtraction. There is no viseme table in this file');
  console.log('  because the IPA is one, and it has been published since 1888.\n');

  console.log(`  ${PHONEME_KEYS.length} phonemes collapse to ${VISEME_NAMES.length} visemes ` +
    `(${(PHONEME_KEYS.length / VISEME_NAMES.length).toFixed(1)} to one)`);
  console.log('    /p/ /b/ /m/ are three sounds and ONE picture — which is why lip-reading is hard');

  console.log('\n  AND THE ONE THAT MATTERS');
  for (const w of ['mama', 'papa', 'baba', 'halo', 'sisi']) {
    const shut = peak(w, 'close');
    const open = peak(w, 'open');
    console.log(
      `    "${w.padEnd(5)}"  lips ${(shut * 100).toFixed(0).padStart(3)}% sealed, ` +
        `jaw ${(open * 100).toFixed(0).padStart(3)}% open   ${shut > 0.95 ? '← bilabial closes' : ''}`
    );
  }
  console.log('    Closure is a MAXIMUM over the neighbours, not an average. Averaging a shut');
  console.log('    mouth with an open one does not give half-shut, it gives wrong — and that is');
  console.log('    exactly how "mama" ends up never closing.');

  console.log(
    `\n  the visible shape leads the sound by ${(ANTICIPATION * 1000).toFixed(0)} ms, ` +
      `and "mama" runs at ${syllableRate(utterance('mama')).toFixed(1)} syllables/s`
  );
}

if (failures.length) {
  console.error('\nSPEECH OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error('\nThe chart is published. If the mouth has stopped agreeing with it, the mouth moved.');
  process.exit(1);
}
if (!json) console.log('\nspeech: the chart is the table, and a bilabial closes the lips ✓');
