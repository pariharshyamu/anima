#!/usr/bin/env node
/**
 * The blade gate — the fourteenth, and the one with a stopwatch in it.
 *
 *   npm run blade            fail if the mass distribution stops being physics
 *   npm run blade -- --json  the numbers, machine-readable
 *
 * ## Why this exists
 *
 * `src/blade.ts` contains no masses. It contains lengths, widths, thicknesses
 * and materials, and every quantity a game would want — weight, balance point,
 * how fast the thing swings — is a sum over that table. Which means the whole
 * module can be checked two ways, and both of them are outside its own opinion:
 *
 *   1. HAND IT AN OBJECT WHOSE ANSWERS ARE KNOWN IN CLOSED FORM.
 *      A uniform steel bar has I = mL²/3 about its end, mL²/12 about its
 *      centre, a centre of percussion at exactly 2L/3, and a period of
 *      2π√(2L/3g). Not approximately. A segment sum that gets a tapered sword
 *      subtly wrong gets a uniform rod EXACTLY wrong, and there is nowhere for
 *      it to hide in the fourth decimal place.
 *
 *   2. HAND IT A REAL OBJECT AND SEE WHERE THE MASS LANDS.
 *      Surviving arming swords weigh 1.0-1.4 kg. A men's competition javelin
 *      has a RULE BOOK: at least 800 g, 2.60-2.70 m, and — since 1986 — a
 *      centre of mass between 0.90 and 1.06 m from the tip. Those are the
 *      numbers the module has to produce from a wall thickness and a ruler.
 *
 * The period is the interesting one, because it is the only quantity here a
 * person with a real sword, a piece of string and a stopwatch can walk up and
 * falsify. Arms researchers measure exactly this to get inertias they cannot
 * weigh. A number nobody could check is a number nobody has checked.
 *
 * ## What it found
 *
 * Four of the nine entries described the wrong object on the first pass — a
 * rapier at 2.6 kg, a javelin at 2.4 kg against a regulation 800 g — and every
 * one of those was a cross-section that had been described too generously,
 * caught by comparing against what museums weigh rather than by anything
 * internal.
 *
 * And the javelin, once it was right, broke the sweet spot. Its rules put the
 * binding ON the centre of mass, `percussion` and `pendulumPeriod` both divide
 * by the distance from the hand to the balance, and both diverged. That is not
 * a numerical guard to add: an object held at its own centre of mass HAS no
 * restoring torque, no period and no centre of percussion. It does not swing.
 * It is thrown, and the arithmetic says so before any of us do.
 */
import {
  BLADES,
  BLADE_NAMES,
  measureBlade,
  bladeMass,
  bladeLength,
  balancePoint,
  inertia,
  percussion,
  pendulumPeriod,
  vibrationNodes,
  withPommel,
  tubeFill,
  NODE_FRACTION,
  SOLID_ROUND,
  BALANCE_TOLERANCE,
} from '../dist/index.js';

const GRAVITY = 9.81;
const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const close = (a, b, tol, what) => {
  if (!(Math.abs(a - b) <= tol)) fail(`${what}: ${a} against ${b}, tolerance ${tol}`);
};

// ------------------------------------------- 1. the closed forms, exactly

// A uniform bar is the one shape whose every answer is on a textbook page, and
// it is in the shipped table rather than in this file so that what is checked
// is what is exported.
const rod = BLADES.rod;
const L = bladeLength(rod);
const m = bladeMass(rod);

// 1 m of 20 mm square steel at 7850 kg/m³. Volume times density, no rounding.
close(m, 1 * 0.02 * 0.02 * 7850, 1e-12, 'the rod’s mass is not volume times density');
close(balancePoint(rod), L / 2, 1e-12, 'a uniform bar does not balance at its middle');

// The two that catch a parallel-axis mistake, and they catch DIFFERENT ones:
// drop the m·d² term and the end value breaks while the centre value survives.
close(inertia(rod, 0), (m * L * L) / 3, 1e-12, 'I about the end is not mL²/3');
close(inertia(rod, L / 2), (m * L * L) / 12, 1e-12, 'I about the centre is not mL²/12');

// (mL²/3) / (m · L/2) = 2L/3. Exact, and the reason a bat has a sweet spot.
close(percussion(rod, 0), (2 * L) / 3, 1e-12, 'the rod’s centre of percussion is not at 2L/3');

// The stopwatch number: T = 2π√(I/mgd) = 2π√(2L/3g) for a bar swung from its end.
const rodPeriod = 2 * Math.PI * Math.sqrt((2 * L) / (3 * GRAVITY));
close(pendulumPeriod(rod, 0), rodPeriod, 1e-12, 'the rod’s period is not 2π√(2L/3g)');

// The nodes are the root of cos(βL)·cosh(βL) = 1, not a preference. Checked by
// putting the constant back through its own equation.
const beta = 4.73004074;
if (Math.abs(Math.cos(beta) * Math.cosh(beta) - 1) > 1e-6) {
  fail('βL = 4.7300 is not a root of cos(βL)·cosh(βL) = 1');
}
close(NODE_FRACTION, 0.2242, 5e-4, 'the node fraction has moved off the free-free first mode');
const nodes = vibrationNodes(rod);
close(nodes[0] + nodes[1], L, 1e-12, 'the two nodes of a uniform bar are not symmetric about its middle');

// π/4 is a circle in a square, and a tube is an annulus in one. Both derived.
close(SOLID_ROUND, Math.PI / 4, 1e-12, 'a solid round bar no longer fills π/4 of its box');
close(tubeFill(0.03, 0.015), SOLID_ROUND, 1e-12, 'a tube whose wall meets in the middle is not solid');
close(tubeFill(0.03, 0), 0, 1e-12, 'a tube with no wall has mass');
if (!(tubeFill(0.03, 0.0012) < tubeFill(0.02, 0.0012))) {
  fail('the same wall on a fatter tube is not a smaller fraction of it');
}

// --------------------------- 2. the masses land where the catalogues do

// Nothing here is fitted. These are the windows surviving examples fall in,
// and the check is whether a table of RULER MEASUREMENTS produces them.
const CATALOGUE = {
  arming: { mass: [0.9, 1.4], length: [0.9, 1.0], fromCross: [0.08, 0.18] },
  longsword: { mass: [1.2, 1.9], length: [1.1, 1.3], fromCross: [0.04, 0.12] },
  rapier: { mass: [1.0, 1.5], length: [1.15, 1.3], fromCross: [0.05, 0.12] },
  sabre: { mass: [0.8, 1.2], length: [0.9, 1.05], fromCross: [0.09, 0.2] },
  messer: { mass: [0.7, 1.1], length: [0.8, 0.95], fromCross: [0.15, 0.26] },
  spear: { mass: [1.0, 2.0], length: [2.1, 2.5] },
  axe: { mass: [1.2, 2.2], length: [0.75, 0.95] },
};
const reports = BLADE_NAMES.map((n) => measureBlade(n));
const byName = Object.fromEntries(reports.map((r) => [r.blade, r]));
for (const [name, want] of Object.entries(CATALOGUE)) {
  const r = byName[name];
  for (const [key, [lo, hi]] of Object.entries(want)) {
    if (!(r[key] >= lo && r[key] <= hi)) {
      fail(`${name}: ${key} is ${r[key].toFixed(3)}, and surviving examples are ${lo}-${hi}`);
    }
  }
}

// -------------------------- 3. THE RULE BOOK: World Athletics, men's javelin

// The strongest external check in the table, because it is not a range that
// museums happen to fall in — it is a rule an object is DISQUALIFIED for
// breaking, and the 1986 version of it shortened the world record by 10%
// overnight by moving the centre of mass forward.
const jav = byName.javelin;
const fromTip = jav.length - jav.balance;
if (!(jav.mass >= 0.8)) fail(`the javelin weighs ${(jav.mass * 1000).toFixed(0)} g and the rule is 800 g minimum`);
if (jav.mass > 0.83) fail(`the javelin weighs ${(jav.mass * 1000).toFixed(0)} g, which is a 25 g tolerance blown wide`);
if (!(jav.length >= 2.6 && jav.length <= 2.7)) fail(`the javelin is ${jav.length} m and the rule is 2.60-2.70 m`);
if (!(fromTip >= 0.9 && fromTip <= 1.06)) {
  fail(`the javelin balances ${fromTip.toFixed(3)} m from the tip and the rule is 0.90-1.06 m`);
}
const cord = BLADES.javelin.segments.find((s) => s.label === 'cord');
const cordWidth = cord.to - cord.from;
if (!(cordWidth >= 0.15 && cordWidth <= 0.16)) fail(`the cord is ${(cordWidth * 1000).toFixed(0)} mm and the rule is 150-160 mm`);
// ...and the rule that the binding is centred on the balance, which is what
// makes the next section true.
close((cord.from + cord.to) / 2, jav.balance, 0.005, 'the cord is not centred on the centre of mass');

// ------------------- 4. held at the balance, a weapon stops being a weapon

// The finding, and it came out of getting the javelin right rather than out of
// looking for it. Both `percussion` and `pendulumPeriod` divide by the distance
// from the hand to the centre of mass. Put the hand ON the centre of mass and
// there is no restoring torque, no period, and no sweet spot — which is the
// difference between an object you swing and an object you throw, stated by the
// arithmetic rather than by a flag in a struct.
if (Number.isFinite(jav.period)) {
  fail(`a javelin held at its own balance point has a period of ${jav.period}, and it should not swing at all`);
}
if (Number.isFinite(jav.sweetSpot)) {
  fail('a javelin held at its own balance point has a centre of percussion, which is not a thing');
}
// ...and every weapon that IS held off the balance has both.
//
// The band check that was here first — "the sweet spot is between 0 and 1.2" —
// was VACUOUS: it passed just as happily when the fraction was measured from
// the cross, which is the bug this section exists because of. What has to be
// asserted is the physical claim rather than a range the number happens to sit
// in: the centre of percussion is a POINT ON THE WEAPON, past the hand, out on
// the part that hits things, and the reported fraction is that point expressed
// between those two landmarks.
for (const r of reports) {
  if (r.blade === 'javelin') continue;
  if (!Number.isFinite(r.period) || r.period <= 0) fail(`${r.blade} has no pendulum period`);
  const spec = BLADES[r.blade];
  const cop = percussion(spec);
  if (!(cop > spec.grip && cop <= bladeLength(spec))) {
    fail(`${r.blade}: the centre of percussion is at ${cop.toFixed(3)} m, which is not between the hand and the tip`);
  }
  // ...and it is out on the business end, not back in the hilt.
  if (!(cop > spec.cross)) fail(`${r.blade}: the sweet spot is behind the cross, i.e. in the hand`);
  // The reported fraction IS that point between those two landmarks, and if it
  // is ever measured from anything else this identity is what notices.
  close(
    r.sweetSpot,
    (cop - spec.grip) / (bladeLength(spec) - spec.grip),
    1e-12,
    `${r.blade}: the sweet spot fraction is not the centre of percussion measured from the hand`
  );
}
// The divergence is continuous, not a special case: walk the pivot in toward
// the balance and the period has to grow without bound the whole way.
const sw = BLADES.arming;
const bal = balancePoint(sw);
let last = 0;
for (const gap of [0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002]) {
  const t = pendulumPeriod(sw, bal - gap);
  if (!(t > last)) fail(`the period stopped growing as the pivot closed on the balance (gap ${gap} m)`);
  last = t;
}
if (Number.isFinite(pendulumPeriod(sw, bal - BALANCE_TOLERANCE / 2))) {
  fail('inside the balance tolerance the period is still finite');
}

// ------------------------------ 5. the pommel trade, from one added mass

// A pommel is a counterweight, and the folk version of what it does — "lighter
// in the hand, slower in the air" — turns out to be two DIFFERENT inertias,
// which this gate only noticed by printing both.
//
//   about the HAND      barely moves. The pommel sits almost ON the pivot, and
//                       m·d² with d ≈ 7 cm is nearly nothing
//   about the BALANCE   rises hard. That is the inertia that resists a change
//                       of direction in free rotation, and it is what the
//                       "slower" in the folk version is actually about
//
// So a pommel is an unusually good bargain: it buys 32 mm of balance for a 0.4%
// penalty at the pivot, and pays for it somewhere else. Both sums come off the
// same table and they have to keep pointing the ways they point.
const bladeBefore = BLADES.longsword;
const bladeAfter = withPommel(bladeBefore, 200);
const before = {
  mass: bladeMass(bladeBefore),
  balance: balancePoint(bladeBefore),
  hand: inertia(bladeBefore),
  free: inertia(bladeBefore, balancePoint(bladeBefore)),
  period: pendulumPeriod(bladeBefore),
};
const after = {
  mass: bladeMass(bladeAfter),
  balance: balancePoint(bladeAfter),
  hand: inertia(bladeAfter),
  free: inertia(bladeAfter, balancePoint(bladeAfter)),
  period: pendulumPeriod(bladeAfter),
};
close(after.mass - before.mass, 0.2, 1e-9, 'a 200 g pommel did not add 200 g');
if (!(after.balance < before.balance)) {
  fail('a heavier pommel did not pull the balance point back toward the hand');
}
// Legible, or the "pommel" is not doing the job a smith fits one for.
const moved = before.balance - after.balance;
if (!(moved > 0.01)) fail(`200 g of pommel moved the balance ${(moved * 1000).toFixed(1)} mm, budget 10 mm`);

// It still costs SOMETHING at the pivot — parallel axis has no free lunch —
// but the cost is small, and a pommel that started costing a lot at the pivot
// would be a pommel that had wandered away from the hand.
if (!(after.hand > before.hand)) fail('adding mass lowered the inertia about the hand, which cannot happen');
const atHand = (after.hand - before.hand) / before.hand;
if (!(atHand < 0.02)) {
  fail(`200 g of pommel cost ${(atHand * 100).toFixed(1)}% of the hand inertia — it is no longer near the pivot`);
}
// ...and it is paid for in free rotation, which is the half the folk version
// is describing.
const atBalance = (after.free - before.free) / before.free;
if (!(atBalance > 0.05)) {
  fail(`200 g of pommel raised the free-rotation inertia only ${(atBalance * 100).toFixed(1)}%, budget 5%`);
}
if (!(atBalance > atHand * 5)) {
  fail('the two inertias have stopped disagreeing, and the whole point of a counterweight is that they do');
}
// The pendulum gets SLOWER, not faster: d shrinks faster than I grows.
if (!(after.period > before.period)) fail('a heavier pommel did not lengthen the swing period');

// ----------------------------------------- 6. the orderings, against reason

// Each of these is a statement about the objects rather than about the code,
// and each is falsifiable by picking up the two weapons involved.
const spear = byName.spear;
const arming = byName.arming;
const axe = byName.axe;
if (!(spear.extension > arming.extension * 1.5)) {
  fail(`a spear reaches ${(spear.extension / arming.extension).toFixed(2)}x an arming sword, budget 1.5x`);
}
// An axe is a mass at the far end; a sword is a lever you steer. The inertia
// about the hand is what "unwieldy" actually means, and it is the axe's despite
// the axe being the shorter object.
if (!(axe.inertia > arming.inertia * 3)) {
  fail(`an axe is only ${(axe.inertia / arming.inertia).toFixed(1)}x an arming sword to turn, budget 3x`);
}
if (!(axe.balance / axe.length > 0.8)) fail('the axe’s mass is no longer at the far end');
if (!(byName.rapier.balance - BLADES.rapier.cross < byName.messer.balance - BLADES.messer.cross)) {
  fail('the rapier is no longer the more hilt-biased of the rapier and the messer');
}
// Inertia is the second moment, so it must grow faster than mass with length.
// A spear is 1.3x a longsword's mass and far more than 1.3x its inertia.
const ls = byName.longsword;
if (!(spear.inertia / ls.inertia > (spear.mass / ls.mass) * 2)) {
  fail('inertia is not growing faster than mass with length — a second moment has become a first one');
}

// ---------------------------------------------------------------- report

if (json) {
  console.log(JSON.stringify({ reports, javelin: { fromTip, cordWidth }, pommel: { before, after }, failures }, null, 2));
} else {
  const f = (v, d = 2, u = '') => (Number.isFinite(v) ? v.toFixed(d) + u : '—');
  console.log('blade — nine objects described with a ruler, and nothing weighed\n');
  console.log('  weapon         mass   length  balance  I(hand)   sweet   period');
  console.log('  ' + '-'.repeat(62));
  for (const r of reports) {
    console.log(
      `  ${r.blade.padEnd(11)} ${f(r.mass, 3, ' kg').padStart(8)} ${f(r.length, 2, ' m').padStart(7)} ` +
        `${f(r.balance * 100, 1, ' cm').padStart(9)} ${f(r.inertia, 4).padStart(7)} ` +
        `${(Number.isFinite(r.sweetSpot) ? (r.sweetSpot * 100).toFixed(0) + '%' : '—').padStart(6)} ` +
        `${f(r.period, 3, ' s').padStart(8)}`
    );
  }

  console.log('\n  the closed forms, to the last bit');
  console.log(`    I about the end       ${inertia(rod, 0).toFixed(8)}  =  mL²/3   ${((m * L * L) / 3).toFixed(8)}`);
  console.log(`    I about the centre    ${inertia(rod, L / 2).toFixed(8)}  =  mL²/12  ${((m * L * L) / 12).toFixed(8)}`);
  console.log(`    centre of percussion  ${percussion(rod, 0).toFixed(8)}  =  2L/3    ${((2 * L) / 3).toFixed(8)}`);
  console.log(`    period from the end   ${pendulumPeriod(rod, 0).toFixed(8)}  =  2π√(2L/3g)  ${rodPeriod.toFixed(8)}`);

  console.log('\n  the rule book — World Athletics, men’s javelin');
  console.log(
    `    mass        ${(jav.mass * 1000).toFixed(1)} g against a minimum of 800 g` +
      `        derived from a 1.5 mm aluminium wall`
  );
  console.log(
    `    balance     ${fromTip.toFixed(3)} m from the tip, rule 0.90-1.06 m` +
      `   the 1986 change, and nothing typed in`
  );
  console.log(`    length      ${jav.length.toFixed(2)} m, rule 2.60-2.70 m`);
  console.log(`    cord        ${(cordWidth * 1000).toFixed(0)} mm, rule 150-160 mm, centred on the balance`);

  console.log('\n  what that costs it');
  console.log(
    `    a javelin is held AT its own centre of mass, so its period is ${f(jav.period)} and its sweet spot is ` +
      `${Number.isFinite(jav.sweetSpot) ? jav.sweetSpot : '—'}`
  );
  console.log('    no restoring torque, no swing, no centre of percussion. It is thrown, and the arithmetic says so');

  console.log('\n  the pommel trade — one added mass, three sums, and they do not agree');
  console.log(
    `    +200 g at the butt    balance  ${(before.balance * 100).toFixed(1)} → ${(after.balance * 100).toFixed(1)} cm` +
      `      ${(moved * 1000).toFixed(0)} mm BACK toward the hand: it FEELS lighter`
  );
  console.log(
    `                          I(hand)  ${before.hand.toFixed(4)} → ${after.hand.toFixed(4)}  ` +
      `+${(atHand * 100).toFixed(1)}%  the pommel is ON the pivot, so this is nearly free`
  );
  console.log(
    `                          I(free)  ${before.free.toFixed(4)} → ${after.free.toFixed(4)}  ` +
      `+${(atBalance * 100).toFixed(1)}%  and THIS is what "slower" means`
  );
  console.log(
    `                          period   ${before.period.toFixed(3)} → ${after.period.toFixed(3)} s` +
      `      longer: d shrinks faster than I grows`
  );

  console.log(
    `\n  ${reports.length} objects, ${BLADE_NAMES.reduce((n, k) => n + BLADES[k].segments.length, 0)} segments, ` +
      `and not one mass in the table`
  );
}

if (failures.length) {
  console.error('\nBLADE OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nThe closed forms are not tunable and neither is the rule book.\n' +
      'If the rod has moved, a sum is wrong. If a catalogue window has been missed,\n' +
      'a cross-section describes the wrong object — fix the ruler, not the budget.'
  );
  process.exit(1);
}
if (!json) console.log('\nblade: a mass distribution, held in a hand ✓');
