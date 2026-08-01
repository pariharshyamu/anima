#!/usr/bin/env node
/**
 * The tameshiwari gate — the thirteenth, and the only one that imports two
 * libraries.
 *
 *   npm run tameshiwari            fail if the two halves stop agreeing
 *   npm run tameshiwari -- --json  the numbers, machine-readable
 *
 * ## Why this exists
 *
 * ANIMA derives what a strike arrives with from Dempster's segment masses and
 * a measured surface velocity. SCENA derives what a board takes to break from
 * the Wood Handbook, ASTM D245 and three-point beam bending.
 *
 * NEITHER LIBRARY IMPORTS THE OTHER. `anima3d` has no idea what a board is;
 * `scena3d` has never heard of a fist. Both were built for their own reasons,
 * months apart, and both happen to produce numbers in SI units.
 *
 * So they can be put side by side, and that is the whole point of this file.
 * Either the two agree about the world or one of them is wrong about PHYSICS
 * rather than about an API — and a disagreement between two independent
 * derivations is worth a great deal more than either one being self-consistent.
 *
 * ## What it found on the first run
 *
 * It settled which quantity governs, and the answer was not the one this gate
 * was written to check.
 *
 * A pine board takes 1.9 J to break. ANIMA puts a hammerfist at 113 J. Every
 * strike in the library carries between ten and four hundred times the ENERGY a
 * pine board needs — so an energy criterion says everything breaks everything,
 * which is not what happens in a dojo.
 *
 * WHAT A PERSON RUNS OUT OF IS FORCE, in the first millimetre, and that is what
 * SCENA states the threshold in. The energy comparison is kept below because
 * being out by a factor of sixty is the finding, not a failure.
 */
import {
  createHumanoid,
  measureStrike,
  STRIKE_NAMES,
  STRIKES,
  bodyMass,
} from '../dist/index.js';
import { TIMBERS, TIMBER_NAMES, boardStrength, stackStrength, createBoard } from 'scena3d';

const SEEDS = [5, 42, 313];
const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);

// ---------------------------------------------- 1. both sides are in SI

// A gate comparing two libraries has to start by checking they are talking
// about the same units at all. Joules and newtons, on both sides, or the
// comparison below is arithmetic on nonsense.
const pine = boardStrength();
if (!(pine.force > 500 && pine.force < 50000)) fail(`a pine board takes ${pine.force} N, which is not newtons`);
if (!(pine.energy > 0.1 && pine.energy < 100)) fail(`a pine board takes ${pine.energy} J, which is not joules`);
if (!(pine.deflection > 1e-4 && pine.deflection < 0.05)) fail('the deflection is not metres');

const punch = measureStrike(createHumanoid({ seed: 42 }), 'hammerfist', { skill: 0.9 });
// ANIMA's own internal consistency, checked from outside: E = ½mv².
if (Math.abs(punch.energy - 0.5 * punch.mass * punch.speed ** 2) > 1e-6) {
  fail('ANIMA’s energy is not half m v squared');
}
if (Math.abs(punch.impulse - punch.mass * punch.speed) > 1e-6) {
  fail('ANIMA’s impulse is not m v');
}

// ------------------------------- 2. THE FINDING: energy is not the constraint

const strikes = STRIKE_NAMES.map((name) => {
  const r = measureStrike(createHumanoid({ seed: 42 }), name, { skill: 0.9 });
  return { name, mass: r.mass, speed: r.speed, energy: r.energy, impulse: r.impulse };
});
const lightest = strikes.reduce((a, b) => (a.energy < b.energy ? a : b));
const heaviest = strikes.reduce((a, b) => (a.energy > b.energy ? a : b));

// Every strike ANIMA can measure clears every board SCENA can describe, on
// energy, by a wide margin. If that ever stops being true one of the two has
// moved by an order of magnitude and somebody should know.
const dearest = TIMBER_NAMES.map((t) => boardStrength({ timber: t })).reduce((a, b) =>
  a.energy > b.energy ? a : b
);
const margin = lightest.energy / dearest.energy;
if (!(margin > 1)) {
  fail(
    `the lightest strike (${lightest.name}, ${lightest.energy.toFixed(1)} J) no longer clears the ` +
      `dearest board (${dearest.timber}, ${dearest.energy.toFixed(1)} J) — one library has moved`
  );
}
if (margin < 1.2) fail(`the energy margin is down to ${margin.toFixed(2)}x, which is no longer a factor`);

// ------------------------------------- 3. the two orderings have to agree

// SCENA says oak is dearer than pine because its modulus of rupture is higher.
// ANIMA says a hammerfist is heavier than a jab because more of the body is
// behind it. Neither ordering can be an accident of the other, so both are
// checked against their own source rather than against each other.
const byTimber = TIMBER_NAMES.map((t) => ({ t, ...boardStrength({ timber: t }) }));
for (const a of byTimber) {
  for (const b of byTimber) {
    if (TIMBERS[a.t].rupture <= TIMBERS[b.t].rupture) continue;
    if (!(a.force > b.force)) fail(`${a.t} has a higher modulus than ${b.t} and takes less force`);
  }
}
const jab = strikes.find((s) => s.name === 'jab');
const hammer = strikes.find((s) => s.name === 'hammerfist');
if (!(hammer.energy > jab.energy * 3)) {
  fail(`a hammerfist carries ${(hammer.energy / jab.energy).toFixed(1)}x a jab, budget 3x`);
}

// --------------------------------- 4. the prop takes what SCENA declares

for (const seed of SEEDS) {
  const boards = createBoard({ seed, count: 3 });
  const need = boards.strength.force;
  if (boards.strike(need * 0.999) !== 0) fail(`seed ${seed}: a board broke below its own threshold`);
  if (boards.strike(need * 1.001) !== 1) fail(`seed ${seed}: a board did not break above it`);
  boards.reset();
  if (boards.standing !== 3) fail(`seed ${seed}: reset did not put the boards back`);
}

// ------------------------------- 5. the spacer argument is about force

const six = stackStrength(6);
if (Math.abs(six.spaced - six.solid) > 1e-6) {
  fail('spaced and glued stacks stopped taking the same energy — the algebra says they must');
}
if (!(six.solidForce > six.spacedForce * 30)) {
  fail(`a glued stack needs only ${(six.solidForce / six.spacedForce).toFixed(1)}x the force, budget 30x`);
}

// -------------------------- 6. the published measurement is still matched

// Feld, McNair & Wilk, Scientific American 1979: about 3.1 kN for a
// 30 x 15 x 2.5 cm pine board. This is SCENA's claim, checked from a second
// repository, because a number that only its own tests believe is a number
// nobody has checked.
const feld = boardStrength({ width: 0.15, thickness: 0.025, span: 0.25 });
const error = Math.abs(feld.force - 3100) / 3100;
if (error > 0.35) {
  fail(`the derived force is ${(error * 100).toFixed(0)}% from the measured 3.1 kN, budget 35%`);
}

// ---------------------------------------------------------------- report

if (json) {
  console.log(JSON.stringify({ strikes, byTimber, feld, six, margin, failures }, null, 2));
} else {
  console.log('tameshiwari — two libraries, one physics, neither importing the other\n');
  console.log('  ANIMA says a strike arrives with          SCENA says a board takes');
  console.log('  ' + '-'.repeat(64));
  const boards = byTimber.slice(0, 5);
  for (let i = 0; i < Math.max(strikes.length, boards.length); i++) {
    const s = strikes[i];
    const b = boards[i];
    const left = s
      ? `${s.name.padEnd(11)} ${s.energy.toFixed(1).padStart(6)} J  ${s.impulse.toFixed(1).padStart(5)} kg·m/s`
      : ''.padEnd(34);
    const right = b
      ? `${b.t.padEnd(9)} ${(b.force / 1000).toFixed(2).padStart(6)} kN  ${b.energy.toFixed(1).padStart(5)} J`
      : '';
    console.log(`  ${left}   ${right}`);
  }

  console.log('\n  the claims, measured');
  console.log(
    `    both sides are in SI          E = ½mv² and J = mv on one side, ` +
      `F = 2σbd²/3L on the other`
  );
  console.log(
    `    the derivation matches 1979   ${(feld.force / 1000).toFixed(2)} kN against a measured 3.1 kN ` +
      `— ${(error * 100).toFixed(0)}% out, nothing fitted`
  );
  console.log(
    `    ENERGY IS NOT THE CONSTRAINT  the LIGHTEST strike (${lightest.name}, ` +
      `${lightest.energy.toFixed(1)} J) clears the DEAREST board (${dearest.timber}, ` +
      `${dearest.energy.toFixed(1)} J) ${margin.toFixed(1)}x over`
  );
  console.log(
    `    ...and the heaviest by        ${(heaviest.energy / pine.energy).toFixed(0)}x a pine board ` +
      `(${heaviest.name}, ${heaviest.energy.toFixed(0)} J against ${pine.energy.toFixed(1)} J)`
  );
  console.log('                                  so the threshold is stated in NEWTONS, and that is why');
  console.log(
    `    spacers are a force argument  ${(six.solidForce / six.spacedForce).toFixed(0)}x the force glued, ` +
      `and exactly the same energy`
  );
  console.log(
    `    the orderings hold            ${byTimber.length} timbers ordered by modulus, ` +
      `${strikes.length} strikes ordered by what is behind them`
  );
  console.log(
    `\n  a ${bodyMass(createHumanoid({ seed: 42 })).toFixed(1)} kg body against a ` +
      `${(pine.mass * 1000).toFixed(0)} g board, and neither package has ever imported the other`
  );
}

if (failures.length) {
  console.error('\nTAMESHIWARI OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nTwo independent derivations disagreeing is a physics bug, not an API one.\n' +
      'Find which of the two moved before touching either budget.'
  );
  process.exit(1);
}
if (!json) console.log('\ntameshiwari: two derivations, one world ✓');
