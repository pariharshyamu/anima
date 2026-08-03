#!/usr/bin/env node
/**
 * The armour gate — the eighteenth, and the second that imports two libraries.
 *
 *   npm run armour            fail if the two halves stop agreeing
 *   npm run armour -- --json  the numbers, machine-readable
 *
 * ## The handshake that finishes — one half of it
 *
 * `npm run tameshiwari` could not finish. It put ANIMA's strikes beside SCENA's
 * boards and found that every strike in the library carries ten to four hundred
 * times the energy a board needs, so an energy criterion says everything breaks
 * everything. To settle it properly needed one number neither library had: HOW
 * COMPLIANT A FIST IS. That was never invented, and the gate says so.
 *
 * This one finishes, and the reason is worth stating precisely.
 *
 * A plate does not fail by bending to a stress. It fails when a hole has been
 * opened all the way through it, and the work that takes is the metal's
 * indentation pressure over the POINT'S OWN FRONTAL AREA, through the
 * thickness. So what the comparison needs is not a compliance — it is a
 * CONTACT DIAMETER, and a contact diameter is a ruler measurement. ANIMA has
 * had one since `Cut`: `tipArea` is πr², and a bodkin is 9 mm.
 *
 * ## ...for the plate. The mail half still does not.
 *
 * A riveted ring bursts at three joules and cutting a slit through a gambeson
 * costs two more. Williams measured mail over padding at a hundred and twenty.
 * The first draft of this gate asserted that the padding is what stops the
 * arrow — the standard explanation — and the derivation said 2.2 J and the
 * assertion failed. It was the assertion that was wrong: what stops an arrow in
 * a gambeson is not the textile being CUT, it is the textile stretching and
 * dragging and spreading the load, and none of those is a fracture toughness.
 *
 * So this gate finishes one half and names the missing number in the other, and
 * the missing number is not the one tameshiwari lacked.
 *
 * ## What the finished half settles
 *
 * The energy required goes as the SQUARE of the contact diameter. So:
 *
 *   a compound bow      75 J behind a 9 mm bodkin      needs 76 J   — a hair short
 *   a roundhouse kick  800 J behind a 100 mm foot    needs 9425 J   — not close
 *
 * The kick carries ELEVEN TIMES the arrow's energy and is a hundred times
 * further from getting through. Comparing joules to joules would have said the
 * opposite, and that is exactly the mistake the tameshiwari gate was left
 * unable to rule out.
 */
import {
  BOWS,
  BOW_STYLES,
  STRIKE_NAMES,
  arrowSpeed,
  createHumanoid,
  measureStrike,
  tipArea,
  TARGETS,
  propagationForce,
} from '../dist/index.js';
import { ALLOYS, ALLOY_NAMES, TABOR, mailStrength, plateStrength, createArmour } from 'scena3d';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const close = (a, b, tol, what) => {
  if (!(Math.abs(a - b) <= tol)) fail(`${what}: ${a} against ${b}, tolerance ${tol}`);
};

const ARROW = 0.03; // kg — SCENA's arrow, which is ANIMA's default
const BODKIN = 0.009; // metres across at the widest

// ------------------------------------------- 1. both sides are in SI

const plate = plateStrength();
if (!(plate.force > 1e3 && plate.force < 1e6)) fail(`a plate takes ${plate.force} N, which is not newtons`);
if (!(plate.energy > 5 && plate.energy < 5000)) fail(`a plate takes ${plate.energy} J, which is not joules`);
if (!(plate.mass > 0.1 && plate.mass < 50)) fail(`a plate weighs ${plate.mass} kg, which is not a panel`);

// SCENA's own claim, checked from outside: p = 3σ_y, F = p·πd²/4, E = F·t.
close(plate.pressure, TABOR * ALLOYS.wroughtIron.yield, 1e-6, 'SCENA’s indentation pressure is not 3σ_y');
close(plate.force, plate.pressure * tipArea(BODKIN / 2), 1e-6, 'SCENA’s force is not pressure times ANIMA’s tip area');
close(plate.energy, plate.force * 0.002, 1e-9, 'SCENA’s energy is not force through the thickness');

// ANIMA's own claim, checked from outside: ½mv² is what the bow stored and kept.
for (const style of BOW_STYLES) {
  const b = BOWS[style];
  const v = arrowSpeed(b.peak, b.draw, b.storage, b.efficiency, ARROW);
  close(
    0.5 * ARROW * v * v,
    b.peak * b.draw * b.storage * b.efficiency,
    1e-9,
    `${style}: ANIMA’s arrow energy is not peak × draw × storage × efficiency`
  );
}

// -------------- 2. THE FINDING: the comparison is not joules against joules

const arrows = BOW_STYLES.map((style) => {
  const b = BOWS[style];
  const v = arrowSpeed(b.peak, b.draw, b.storage, b.efficiency, ARROW);
  return { style, speed: v, energy: 0.5 * ARROW * v * v };
});
const bestArrow = arrows.reduce((a, b) => (a.energy > b.energy ? a : b));

const strikes = STRIKE_NAMES.map((name) => {
  const r = measureStrike(createHumanoid({ seed: 42 }), name, { skill: 0.9 });
  return { name, energy: r.energy };
});
const bestStrike = strikes.reduce((a, b) => (a.energy > b.energy ? a : b));

// The contact diameters. Every one of these is a measurement of an object, and
// that is the whole reason this gate can finish where tameshiwari could not.
const CONTACTS = [
  { what: 'bodkin', d: 0.009 },
  { what: 'spear point', d: 0.02 },
  { what: 'sword tip', d: 0.03 },
  { what: 'fist', d: 0.06 },
  { what: 'foot', d: 0.1 },
];
const needs = CONTACTS.map((c) => ({ ...c, energy: plateStrength({ hole: c.d }).energy }));
const byWhat = Object.fromEntries(needs.map((n) => [n.what, n.energy]));

// It goes as the square of the diameter, because the point pushes metal aside
// over its own frontal area. Checked, not asserted.
close(
  byWhat['foot'] / byWhat['bodkin'],
  (0.1 / 0.009) ** 2,
  1e-6,
  'the energy required is not quadratic in the contact diameter'
);

// AND THE POINT OF THE WHOLE FILE. The heaviest strike in the library carries
// many times the best arrow's energy and is far further from getting through.
if (!(bestStrike.energy > bestArrow.energy * 3)) {
  fail(
    `the heaviest strike (${bestStrike.energy.toFixed(0)} J) no longer dwarfs the best arrow ` +
      `(${bestArrow.energy.toFixed(0)} J), and the finding rests on it doing so`
  );
}
const arrowMargin = bestArrow.energy / byWhat['bodkin'];
const kickMargin = bestStrike.energy / byWhat['foot'];
if (!(arrowMargin > kickMargin * 5)) {
  fail(
    `the arrow is only ${(arrowMargin / kickMargin).toFixed(1)}x closer to holing the plate than the kick, ` +
      `budget 5x — if this has closed, the contact area has stopped mattering`
  );
}
if (kickMargin > 0.5) {
  fail(`a kick gets ${(kickMargin * 100).toFixed(0)}% of the way through armour plate, which it does not`);
}

// ----------------------------- 3. what the bows in the library actually do

// Every bow ANIMA ships against every plate SCENA describes. This is the whole
// cross-product, and it has to come out ordered.
const table = [];
for (const a of arrows) {
  for (const alloy of ALLOY_NAMES) {
    for (const t of [0.001, 0.002]) {
      const p = plateStrength({ alloy, thickness: t, hole: BODKIN });
      table.push({ bow: a.style, alloy, thickness: t, arrow: a.energy, need: p.energy, through: a.energy >= p.energy });
    }
  }
}
// Thicker is harder, always, and stronger metal is harder, always.
for (const a of arrows) {
  for (const alloy of ALLOY_NAMES) {
    const thin = table.find((r) => r.bow === a.style && r.alloy === alloy && r.thickness === 0.001);
    const thick = table.find((r) => r.bow === a.style && r.alloy === alloy && r.thickness === 0.002);
    if (thin.through === false && thick.through === true) {
      fail(`${a.style} failed against 1 mm of ${alloy} and got through 2 mm`);
    }
  }
}
// NOTHING in the library gets through 2 mm of anything but the softest metal.
const throughThick = table.filter((r) => r.thickness === 0.002 && r.through);
if (throughThick.some((r) => r.alloy !== 'wroughtIron' && r.alloy !== 'bronze')) {
  fail('a bow in this library defeated 2 mm of steel plate, which is not what the measurements say');
}

// ------------------- 4. mail is not what stops it, and SCENA says so

const mail = mailStrength();
if (!(mail.energy < 10)) fail(`a mail ring takes ${mail.energy.toFixed(1)} J, which is no longer trivial`);
for (const a of arrows) {
  if (!(a.energy > mail.energy * 5)) {
    fail(`${a.style} at ${a.energy.toFixed(0)} J does not comfortably burst a ${mail.energy.toFixed(1)} J ring`);
  }
}
// ...and the half SCENA deliberately does not know: the padding. ANIMA has the
// fracture toughness of linen, because it is a module about cutting people, and
// SCENA has no business with it. Neither package imports the other.
//
// THIS IS WHERE THE HANDSHAKE STOPS FINISHING, and the gate says so rather than
// asserting a direction the numbers do not support. The first draft of this
// section claimed the padding is what stops the arrow — it is the standard
// explanation and it is what mail's three joules seem to demand — and the
// derivation came back at 2.2 J, LESS than the rings. The assertion failed, and
// it was the assertion that was wrong.
//
// Cutting a 9 mm slit through 40 mm of linen costs `R·w·d` and that really is
// about two joules. What stops an arrow in a gambeson is not the textile being
// CUT. It is the textile stretching, dragging on the shaft and spreading the
// load over a hand's breadth, and none of those is a fracture toughness.
const GAMBESON_LAYERS = 20;
const gambeson = propagationForce(TARGETS.linen, BODKIN) * GAMBESON_LAYERS * 0.002;
const WILLIAMS_MAIL = 120; // J, measured, mail over padding
const derivable = mail.energy + gambeson;
if (!(derivable > 1)) fail(`mail and padding together come to ${derivable.toFixed(2)} J, which is not a number`);
if (!(derivable < WILLIAMS_MAIL * 0.2)) {
  fail(
    `mail and padding now derive to ${derivable.toFixed(0)} J against a measured ${WILLIAMS_MAIL} J. ` +
      `Neither package models the mechanism that closes that gap, so if it has closed, check what was fitted`
  );
}

// ------------------------------------ 5. the prop takes what SCENA declares

for (const seed of [5, 42, 313]) {
  const panel = createArmour({ seed, alloy: 'mildSteel', thickness: 0.002 });
  const need = panel.strength.energy;
  if (panel.strike(need * 0.999) !== false) fail(`seed ${seed}: a plate holed below its own threshold`);
  if (panel.strike(need * 1.001) !== true) fail(`seed ${seed}: a plate did not hole above it`);
  panel.reset();
  if (panel.holes !== 0) fail(`seed ${seed}: reset did not close the holes`);
}

// ------------------ 6. the units the two props take, and why they differ

// A board fails at a stress and takes NEWTONS. A plate fails when a hole is
// open and takes JOULES. If those ever converge, one of them has stopped
// modelling its own failure mechanism.
close(
  plateStrength({ thickness: 0.004 }).energy / plateStrength({ thickness: 0.002 }).energy,
  2,
  1e-9,
  'plate energy is not linear in thickness'
);
close(
  plateStrength({ thickness: 0.004 }).force / plateStrength({ thickness: 0.002 }).force,
  1,
  1e-9,
  'plate FORCE depends on thickness, which would mean it is not indentation'
);

// ---------------------------------------------------------------- report

if (json) {
  console.log(JSON.stringify({ arrows, strikes, needs, table, mail, gambeson, failures }, null, 2));
} else {
  console.log('armour — the handshake that finishes, and why this one could\n');
  console.log('  ANIMA says a shot arrives with        SCENA says a plate takes');
  console.log('  ' + '-'.repeat(64));
  const plates = [];
  for (const t of [0.001, 0.002]) for (const a of ['wroughtIron', 'mediumCarbon', 'hardened'])
    plates.push({ label: `${t * 1000}mm ${a}`, energy: plateStrength({ alloy: a, thickness: t }).energy });
  for (let i = 0; i < Math.max(arrows.length, plates.length); i++) {
    const left = arrows[i] ? `${arrows[i].style.padEnd(10)} ${arrows[i].energy.toFixed(1).padStart(6)} J` : ''.padEnd(19);
    const right = plates[i] ? `${plates[i].label.padEnd(20)} ${plates[i].energy.toFixed(1).padStart(6)} J` : '';
    console.log(`  ${left}                   ${right}`);
  }
  console.log(`  ${''.padEnd(19)}                   ${'mail, one ring'.padEnd(20)} ${mail.energy.toFixed(2).padStart(6)} J`);

  console.log('\n  WHY THIS ONE COULD FINISH');
  console.log('    tameshiwari needed the COMPLIANCE of a fist, which nobody measured and nobody invented.');
  console.log('    A plate needs the CONTACT DIAMETER, which is a ruler measurement — and ANIMA has had');
  console.log('    one since `Cut`, because tipArea is πr² and a bodkin is 9 mm.\n');
  console.log('    contact        needed to hole 2 mm of wrought iron');
  for (const n of needs) {
    console.log(`      ${n.what.padEnd(12)} ${(n.d * 1000).toFixed(0).padStart(3)} mm   ${n.energy.toFixed(0).padStart(6)} J`);
  }
  console.log('    ...and it goes as the SQUARE of that diameter, because the point pushes metal aside');
  console.log('    over its own frontal area.');

  console.log('\n  SO THE COMPARISON IS NOT JOULES AGAINST JOULES');
  console.log(
    `    ${bestArrow.style} arrow      ${bestArrow.energy.toFixed(0).padStart(4)} J behind 9 mm    ` +
      `${(arrowMargin * 100).toFixed(0)}% of what it needs`
  );
  console.log(
    `    ${bestStrike.name} kick   ${bestStrike.energy.toFixed(0).padStart(4)} J behind 100 mm  ` +
      `${(kickMargin * 100).toFixed(0)}% of what it needs`
  );
  console.log(
    `    The kick carries ${(bestStrike.energy / bestArrow.energy).toFixed(0)}x the energy and is ` +
      `${(arrowMargin / kickMargin).toFixed(0)}x further from getting through.`
  );

  console.log('\n  AND THE HALF NEITHER LIBRARY OWNS ALONE');
  console.log(
    `    one riveted ring    ${mail.energy.toFixed(2)} J   — every bow here bursts it ` +
      `${(arrows[0].energy / mail.energy).toFixed(0)}-${(bestArrow.energy / mail.energy).toFixed(0)}x over`
  );
  console.log(
    `    ${GAMBESON_LAYERS} layers of linen   ${gambeson.toFixed(1)} J   — from ANIMA's fracture toughness, ` +
      `which SCENA has no business knowing`
  );
  console.log(
    `    together            ${derivable.toFixed(1)} J   against a measured ${WILLIAMS_MAIL} J ` +
      `(Williams, mail over padding)`
  );
  console.log('    So the PLATE handshake finishes and the MAIL one does not, and this gate can now say');
  console.log('    exactly which number is missing: not a compliance, and not a contact diameter, but the');
  console.log('    energy textile absorbs by STRETCHING rather than parting. That is not a fracture');
  console.log('    toughness, it is not in either package, and it has not been invented for the occasion.');
}

if (failures.length) {
  console.error('\nARMOUR OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nTwo independent derivations disagreeing is a physics bug, not an API one.\n' +
      'Find which of the two moved before touching either budget.'
  );
  process.exit(1);
}
if (!json) console.log('\narmour: the plate half finishes, and the mail half now knows what it is missing ✓');
