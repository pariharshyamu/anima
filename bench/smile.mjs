#!/usr/bin/env node
/**
 * The Duchenne gate — can an observer tell, and can it tell about the control?
 *
 *   npm run smile            fail if a posed smile stops being detectable
 *   npm run smile -- --json  the numbers, machine-readable
 *
 * Duchenne (1862) found that a smile is two muscles and that only one of them
 * obeys the will. Three later laboratories added timing, symmetry and shape
 * tells. `readSmile` is an OBSERVER built out of all four, and it never asks the
 * controller what it intended — it only reads what the face did.
 *
 * THE CLAIM IS NOT "the model produces a Duchenne smile". Any model can do that
 * by setting two numbers. The claim is that the DIFFERENCE between a felt smile
 * and a posed one survives being looked at — and the control is the one-number
 * smile every rig in the world ships, which cannot express a difference at all
 * and must therefore score identically whatever it is asked for.
 *
 * Everything below the observer is measured off the RIG in millimetres.
 */
import { readFileSync } from 'node:fs';
import {
  CHEEK_LID, CORNER_TRAVEL, FELT_MAX, FELT_MIN, POSED_ONSET, Smile,
  createEyes, createHumanoid, createSmile, readSmile,
} from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const DT = 1 / 120;
const HOLD = 1.0;

// ------------------------------------------- 0. AU6 IS NOT ADDRESSABLE
//
// The entire argument is that a caller CANNOT pose a Duchenne smile, and that
// is a fact about the API's surface, so it is checked as one. A setter for the
// cheek would make every number below meaningless while breaking no test.
{
  const src = readFileSync(new URL('../src/smile.ts', import.meta.url), 'utf8');
  const cls = src.slice(src.indexOf('export class Smile'), src.indexOf('/** How long this expression'));
  // AND IT IS CHECKED AT RUN TIME, not in the source text.
  //
  // `private` in TypeScript is a compile-time courtesy: the method is still on
  // the prototype, and the first version of this module had a `private begin`
  // that JavaScript could call as `smile.begin(0.9, true)` for a perfect posed
  // Duchenne smile. The source read as if the claim held. The prototype said
  // otherwise, and the unit test that enumerated it is what found that out.
  const verbs = Object.getOwnPropertyNames(Object.getPrototypeOf(new Smile()))
    .filter((k) => typeof new Smile()[k] === 'function');
  const allowed = ['pose', 'feel', 'relax', 'update', 'constructor'];
  for (const m of verbs) {
    if (!allowed.includes(m)) {
      fail(`Smile exposes '${m}' on its prototype — if a caller can reach AU6 the marker stops marking anything, and TypeScript's 'private' does not stop them`);
    }
  }
  if (!src.includes('#begin(')) {
    fail('the cheek is no longer written behind a hash-private — a compile-time private is not a run-time one');
  }
}

// ------------------------------------------------- 1. THE OBSERVER, ON US

/** Play one whole expression — onset, hold, release — and record what it did. */
function record(kind, intensity = 0.9, hold = HOLD) {
  const s = new Smile();
  const track = [];
  s[kind](intensity);
  const apex = s.onsetSeconds;
  let releasing = false;
  let t = 0;
  while (t < 8) {
    track.push(structuredClone(s.update(DT)));
    t += DT;
    if (!releasing && t > apex + hold) { s.relax(); releasing = true; }
    if (releasing && s.shape.corner.left < 0.001) break;
  }
  return track;
}

const feltTrack = record('feel');
const posedTrack = record('pose');
const felt = readSmile(feltTrack, DT);
const posed = readSmile(posedTrack, DT);

// A felt smile has to pass all four, or the model is not making one.
for (const [name, ok] of Object.entries(felt)) {
  if (name !== 'score' && !ok) fail(`a FELT smile failed the '${name}' marker — the model is not producing an enjoyment smile`);
}
// ...and the posed one has to fail on the marker that IS Duchenne's.
if (posed.cheek) {
  fail('a POSED smile raised the cheek — AU6 is reachable from a deliberate expression and the marker is worthless');
}
// EACH TELL IS A SEPARATE PUBLISHED FINDING, so each is asserted separately.
// Scoring only the total lets a model drop one marker and still pass on the
// other three, which is how a gate quietly stops testing what it says it tests.
for (const [marker, who] of [['symmetric', 'Ekman, Hager & Friesen (1981)'], ['smooth', 'Hess & Kleck (1990)']]) {
  if (posed[marker]) {
    fail(`a POSED smile passed the '${marker}' marker — ${who}'s tell is not implemented`);
  }
}
const separation = felt.score - posed.score;
if (!(separation >= 2)) {
  fail(`the observer scored felt ${felt.score}/4 and posed ${posed.score}/4 — it cannot tell them apart`);
}

// ---------------------------------------------------------- 2. THE CONTROL
//
// ONE NUMBER, which is what every rig ships: a smile amount, lerped, driving
// whatever the face has. It cannot express the difference Duchenne found, so
// asking it for a felt smile and asking it for a posed one must produce the
// same thing — and an observer looking at it learns nothing.
function oneNumber(_kind, intensity = 0.9, hold = HOLD) {
  const track = [];
  const onset = 0.4;
  let t = 0;
  while (t < onset * 2 + hold) {
    const up = t < onset ? t / onset : t < onset + hold ? 1 : 1 - (t - onset - hold) / onset;
    const v = Math.max(0, Math.min(1, up)) * intensity;
    // Both muscles off the same number, which is the mistake being controlled
    // for: it CAN look like a Duchenne smile, it just cannot look like anything
    // else, so it says the same thing whatever the character is feeling.
    track.push({ corner: { left: v, right: v }, cheek: v });
    t += DT;
  }
  return track;
}
const controlFelt = readSmile(oneNumber('feel'), DT);
const controlPosed = readSmile(oneNumber('pose'), DT);
const controlSeparation = controlFelt.score - controlPosed.score;
if (controlSeparation !== 0) {
  fail(`the one-number control separated by ${controlSeparation} — it has no felt/posed distinction to find, so the observer is reading something else`);
}
if (!(separation > controlSeparation)) {
  fail(`the shipped model separated by ${separation} and the control by ${controlSeparation} — the two verbs are not doing any work`);
}

// ----------------------------------------- 3. AND IT REACHES THE RIG, IN MM
let rigged = {};
{
  const rig = createHumanoid({ height: 1.75, seed: 6 });
  const face = rig.description.face;
  const eyes = createEyes(rig);
  const mouth = createSmile(rig);
  const at = (shape) => {
    eyes.apply({ lid: 0, gaze: 0, cheek: shape.cheek });
    mouth.apply(shape);
    return { aperture: eyes.aperture(), corners: mouth.corners() };
  };
  const open = at({ corner: { left: 0, right: 0 }, cheek: 0 }).aperture;
  const feltApex = at(feltTrack.reduce((b, s) => (s.cheek > b.cheek ? s : b)));
  const posedApex = at(posedTrack.reduce((b, s) => (s.corner.left > b.corner.left ? s : b)));
  rigged = {
    open,
    feltAperture: feltApex.aperture,
    posedAperture: posedApex.aperture,
    feltCorner: feltApex.corners.left,
    posedLeft: posedApex.corners.left,
    posedRight: posedApex.corners.right,
  };

  // AU6 NARROWS THE EYE — that is what a sphincter does — and the amount is
  // CHEEK_LID of the aperture, not a number this file chose.
  const narrowed = 1 - feltApex.aperture / open;
  const want = CHEEK_LID * feltTrack.reduce((b, s) => Math.max(b, s.cheek), 0);
  if (Math.abs(narrowed - want) > 0.02) {
    fail(`a felt smile narrowed the eye by ${(narrowed * 100).toFixed(1)}% against CHEEK_LID's ${(want * 100).toFixed(1)}%`);
  }
  // ...AND IT DOES NOT SHUT IT. A Duchenne smile that closed an eye is a wince.
  if (!(feltApex.aperture > open * 0.5)) {
    fail(`a felt smile left ${(feltApex.aperture * 1000).toFixed(2)} mm of a ${(open * 1000).toFixed(2)} mm aperture — that is a squint, not a crinkle`);
  }
  // A posed smile does not touch the eye at all.
  if (Math.abs(posedApex.aperture - open) > 1e-9) {
    fail(`a posed smile changed the aperture by ${((open - posedApex.aperture) * 1000).toFixed(3)} mm — AU6 is leaking into a deliberate expression`);
  }
  // THE CORNER TRAVEL, AGAINST THE FACE AND NOT AGAINST ITSELF.
  //
  // The first version of this check asserted the measured rise against
  // `CORNER_TRAVEL * intensity` — which is the number that PRODUCED it, so it
  // held for any value whatsoever. Setting the constant to 16 mm sailed
  // straight through, and it was the only mutation of seven that did.
  //
  // The face supplies a real bound instead: zygomaticus major raises the lip
  // corner toward the cheekbone, and a corner that reaches the nostril is not a
  // smile, it is a snarl. `createHumanoid` puts the nose at 0.057 H with a
  // height of 0.032 H, so its base is where the corner has to stop.
  const noseBase = (0.057 - 0.016 * face.nose.length) * 1.75;
  mouth.apply({ corner: { left: 1, right: 1 }, cheek: 0 });
  const reached = mouth.group.children[0].position.y;
  rigged.noseBase = noseBase;
  rigged.reached = reached;
  // The bracket this leaves is WIDE — it excludes travel over about 19 mm and
  // under about 5, and 10 sits in the middle of it rather than on a
  // measurement. That is stated in the docs rather than dressed up: this is the
  // one constant in the module the gate cannot really pin.
  if (!(reached < noseBase)) {
    fail(`at a full smile the lip corner reached ${(reached * 1000).toFixed(1)} mm, at or above the nose base at ${(noseBase * 1000).toFixed(1)} — that is a snarl`);
  }
  // ...and it has to be worth drawing: less than a third of the corner's own
  // height and nobody sees the smile at all.
  if (!(mouth.corners().left > 0.0085 * 1.75 / 3)) {
    fail(`a full smile moved the corner ${(mouth.corners().left * 1000).toFixed(2)} mm, less than a third of its own height — invisible`);
  }
  // ...and a deliberate one is measurably lopsided where a felt one is not.
  const lop = Math.abs(rigged.posedLeft - rigged.posedRight) / Math.max(1e-9, rigged.posedLeft);
  if (!(lop > 0.1)) {
    fail(`a posed smile was ${(lop * 100).toFixed(1)}% lopsided — Ekman, Hager & Friesen found deliberate expressions asymmetric`);
  }
}

// ------------------------------- 4. AND IT COMPOSES WITH THE OTHER LID
//
// Two muscles closing the same gap from opposite edges. A blink during a
// Duchenne smile still shuts the eye completely, because the cheek raise takes
// a share of what is left and not a share of the whole.
{
  const eyes = createEyes(createHumanoid({ height: 1.75, seed: 6 }));
  eyes.apply({ lid: 1, gaze: 0, cheek: 1 });
  if (!(eyes.aperture() < 1e-9)) {
    fail(`a blink during a smile left ${(eyes.aperture() * 1000).toFixed(3)} mm open — the two lids are not sharing one gap`);
  }
  eyes.apply({ lid: 0, gaze: 0, cheek: 1 });
  const crinkled = eyes.aperture();
  eyes.apply({ lid: 1, gaze: 0, cheek: 0 });
  if (!(crinkled > eyes.aperture())) {
    fail('a full cheek raise closed the eye at least as far as a full blink — they are not different movements');
  }
}

// -------------------------------------------------- 5. THE WINDOW IS EKMAN'S
{
  const live = (track) => track.filter((s) => (s.corner.left + s.corner.right) / 2 > 0.045).length * DT;
  const f = live(feltTrack);
  if (!(f >= FELT_MIN && f <= FELT_MAX)) {
    fail(`a felt smile lasted ${f.toFixed(2)}s, outside Ekman & Friesen's ${FELT_MIN}–${FELT_MAX}s`);
  }
  // A posed FLASH — no hold — falls under the floor, which is what being
  // outside the window means. The onset is the floor's own third, so this
  // moves if the published floor does.
  const flash = live(record('pose', 0.9, 0));
  if (!(flash < FELT_MIN)) {
    fail(`a posed flash lasted ${flash.toFixed(2)}s, inside the felt window — POSED_ONSET is meant to be ${POSED_ONSET.toFixed(3)}s`);
  }
}

// --------------------------------------------------------------- 6. NONSENSE
{
  const s = new Smile();
  for (const dt of [0, DT, -1, 5, NaN]) {
    for (const i of [NaN, -5, 5, 0.5]) {
      s.pose(i);
      const shape = s.update(dt);
      for (const v of [shape.corner.left, shape.corner.right, shape.cheek]) {
        if (!Number.isFinite(v) || v < 0 || v > 1) fail(`a smile went to ${v} on dt=${dt} intensity=${i}`);
      }
    }
  }
  if (readSmile([], DT).score !== 0) fail('an empty track scored above zero');
  if (readSmile(feltTrack, 0).score !== 0) fail('a zero timestep scored above zero');
}

// ------------------------------------------------------------------- REPORT

if (json) {
  console.log(JSON.stringify({ felt, posed, controlFelt, controlPosed, rigged, failures }, null, 2));
} else {
  const mark = (b) => (b ? 'felt  ' : 'posed ');
  console.log('\n  1. THE OBSERVER — four markers, four laboratories, none of them ours\n');
  console.log('                      AU6      window   symmetric  smooth   score');
  console.log(`    a felt smile     ${mark(felt.cheek)}  ${mark(felt.window)}  ${mark(felt.symmetric)}    ${mark(felt.smooth)}   ${felt.score}/4`);
  console.log(`    a posed smile    ${mark(posed.cheek)}  ${mark(posed.window)}  ${mark(posed.symmetric)}    ${mark(posed.smooth)}   ${posed.score}/4`);
  console.log(`\n    separation ${separation}`);
  console.log(`    the one-number control: felt ${controlFelt.score}/4, posed ${controlPosed.score}/4, separation ${controlSeparation}`);
  console.log('    — it cannot say anything different, so nothing can be read off it.\n');
  console.log('  2. AND IT REACHES THE RIG\n');
  console.log(`    eye open              ${(rigged.open * 1000).toFixed(2)} mm`);
  console.log(`    ...during a felt smile ${(rigged.feltAperture * 1000).toFixed(2)} mm   — crinkled, not shut`);
  console.log(`    ...during a posed one  ${(rigged.posedAperture * 1000).toFixed(2)} mm   — untouched`);
  console.log(`    lip corner rose       ${(rigged.feltCorner * 1000).toFixed(2)} mm`);
  console.log(`    a posed smile: left ${(rigged.posedLeft * 1000).toFixed(2)} mm, right ${(rigged.posedRight * 1000).toFixed(2)} mm — lopsided\n`);
}

if (failures.length) {
  console.error('\nsmile FAILED:');
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('smile: the eye told on the mouth ✓');
