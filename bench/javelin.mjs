#!/usr/bin/env node
/**
 * The javelin gate — the seventeenth.
 *
 *   npm run javelin            fail if the 1986 rule stops mattering
 *   npm run javelin -- --json  the numbers, machine-readable
 *
 * ## The experiment
 *
 * On 1 April 1986 the IAAF moved the men's javelin's centre of mass four
 * centimetres forward. Uwe Hohn had thrown 104.80 m two years before — still
 * the only throw past a hundred metres — and the new specification was written
 * to bring the distances down about ten percent and make the things land
 * nose-first.
 *
 * `shiftBalance` runs that as a ONE-VARIABLE experiment, which the real change
 * was not: mass moves from one segment to another inside the same javelin, so
 * the weight, the external shape, the volume, the planform and every drag term
 * are bit-identical and the ONLY difference is where the mass sits.
 *
 * ## What comes out, and what does not
 *
 * The DIRECTION is derived and it is robust: across twenty-seven release
 * conditions the pre-1986 javelin flies further and holds a larger angle of
 * attack, without exception, and lands flatter at every release angle a
 * competitor actually uses. Nothing was told which way the rule went, or that
 * there was a rule.
 *
 * At 40° it lands flatter no longer, and that reversal is asserted too: up
 * there the surplus over a cannonball has gone negative and both javelins are
 * simply falling. Claiming "all twenty-seven" would have been claiming
 * something false.
 *
 * The MAGNITUDE is not. The model costs 1-2% where the world lost about 10%,
 * and the reason is legible in the same numbers: this flight gets 2-5% more
 * range than a cannonball, where real throws get 10-17%. The total lift is
 * about a quarter of the real thing, because Allen-Perkins crossflow
 * under-predicts a javelin's lift and the published aerodynamics uses
 * wind-tunnel coefficient tables this library does not have.
 *
 * That shortfall is asserted as a budget rather than buried, because the 1986
 * change is the check and fitting a lift coefficient to reproduce it would
 * delete the only externally falsifiable thing in the file.
 */
import {
  AIR_DENSITY,
  BLADES,
  CROSSFLOW_DRAG,
  SKIN_FRICTION,
  aeroOf,
  balancePoint,
  ballisticRange,
  bladeMass,
  flyJavelin,
  shiftBalance,
  staticMargin,
} from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const close = (a, b, tol, what) => {
  if (!(Math.abs(a - b) <= tol)) fail(`${what}: ${a} against ${b}, tolerance ${tol}`);
};
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const GRAVITY = 9.81;

// -------------------------------- 1. shiftBalance is a ONE-VARIABLE change

const modern = BLADES.javelin;
const older = shiftBalance(modern, -0.04);

// The whole value of the experiment rests on this: same mass, same shape.
close(bladeMass(older), bladeMass(modern), 1e-12, 'moving the balance changed the mass');
close(
  balancePoint(older),
  balancePoint(modern) - 0.04,
  1e-12,
  'the balance did not move by exactly what was asked'
);
const aNow = aeroOf(modern);
const aOld = aeroOf(older);
close(aOld.volume, aNow.volume, 1e-15, 'moving mass inside the tube changed its volume');
close(aOld.planform, aNow.planform, 1e-15, 'moving mass changed the side-on area');
close(aOld.wetted, aNow.wetted, 1e-15, 'moving mass changed the skin');
close(aOld.centreOfPressure, aNow.centreOfPressure, 1e-15, 'moving mass moved the centre of pressure');
close(aOld.length, aNow.length, 1e-15, 'moving mass changed the length');

// ...and it is linear, because a first moment is.
close(
  balancePoint(shiftBalance(modern, -0.08)) - balancePoint(modern),
  -0.08,
  1e-12,
  'twice the shift is not twice the shift'
);
if (shiftBalance(modern, 0) !== modern) fail('a zero shift returned a new object');
// A shift nobody has the mass for is refused rather than fudged.
if (shiftBalance(modern, -5) !== modern) fail('an impossible shift was carried out anyway');

// ------------------------------------------ 2. the aerodynamic geometry

for (const [name, b] of [['modern', aNow], ['older', aOld]]) {
  if (!(b.mass > 0.79 && b.mass < 0.83)) fail(`${name}: ${b.mass} kg is not a javelin`);
  if (!(b.volume > 5e-4 && b.volume < 2e-3)) fail(`${name}: ${b.volume} m³ is not the volume of a javelin`);
  if (!(b.planform > 0.03 && b.planform < 0.1)) fail(`${name}: ${b.planform} m² is not a side-on area`);
  // The skin is π times the planform for a round body, exactly.
  close(b.wetted / b.planform, Math.PI, 1e-9, `${name}: the wetted area is not π times the planform`);
  if (!(b.inertia > 0.2 && b.inertia < 0.6)) fail(`${name}: ${b.inertia} kg·m² is not a javelin's inertia`);
}

// THE SIGN CONVENTION, which is what a stable body means. A javelin flies
// point-first, so the mass has to be AHEAD of the pressure.
if (!(staticMargin(aNow) > 0)) fail('the modern javelin is statically unstable');
if (!(staticMargin(aNow) > staticMargin(aOld))) {
  fail('moving the centre of mass forward did not make the javelin more stable');
}
close(
  staticMargin(aNow) - staticMargin(aOld),
  0.04 / aNow.length,
  1e-12,
  'the margin did not move by the shift over the length'
);
// ...and a body with its mass BEHIND the pressure has to come out unstable, or
// the sign convention is decoration.
//
// This cannot be reached with `shiftBalance` on a real javelin: the margin is
// 226 mm and the heaviest movable segment can only shift it 224 mm, so the
// function correctly refuses and hands the spec back. `AeroBody` is structural
// precisely so an object that does not exist can still be asked the question.
if (!(staticMargin({ ...aNow, balance: aNow.centreOfPressure - 0.1 }) < 0)) {
  fail('a body with its mass behind the pressure is not reported as unstable');
}
close(
  staticMargin({ ...aNow, balance: aNow.centreOfPressure }),
  0,
  1e-15,
  'mass exactly on the centre of pressure is not neutrally stable'
);

// ------------------------------------------ 3. the cannonball, in closed form

// v²sin(2θ)/g from the ground, exactly. This is the number a javelin has to
// beat, and everything above it is lift.
close(
  ballisticRange(30, rad(45), 0),
  (30 * 30 * Math.sin(rad(90))) / GRAVITY,
  1e-9,
  'the vacuum range is not v²sin2θ/g'
);
close(ballisticRange(30, rad(30), 0), (900 * Math.sin(rad(60))) / GRAVITY, 1e-9, 'the vacuum range is wrong at 30°');
if (!(ballisticRange(30, rad(34), 1.8) > ballisticRange(30, rad(34), 0))) {
  fail('releasing from higher up did not go further');
}

// ------------------------------- 4. it flies, and it does not tumble

// The guard on the bug that made this file: an inverted pitching moment is
// divergent, and it looks like a flight right up until you read the angle of
// attack. It tumbled through 180° and landed at 44 m — half a cannonball.
const standard = { speed: 30, angle: rad(34), attack: rad(5) };
const flight = flyJavelin(aNow, standard);
if (!(deg(flight.peakAttack) < 45)) {
  fail(`the javelin reached ${deg(flight.peakAttack).toFixed(0)}° of angle of attack — it is tumbling, not flying`);
}
if (!(flight.range > ballisticRange(30, rad(34), 1.8))) {
  fail(`a javelin went ${flight.range.toFixed(1)} m where a cannonball goes ` +
    `${ballisticRange(30, rad(34), 1.8).toFixed(1)} m — there is no lift in this`);
}
if (!flight.pointFirst) fail('the modern javelin did not arrive point-first, which is what the rule demanded');
if (!(flight.duration > 3 && flight.duration < 6)) fail(`${flight.duration.toFixed(2)} s is not a javelin flight`);
if (!(flight.apex > 10 && flight.apex < 30)) fail(`an apex of ${flight.apex.toFixed(1)} m is not a javelin flight`);

// THE DRAG IS ON THE SKIN, not on the hole it punches. A slender body's drag is
// a few percent of its weight; a bluff-body coefficient on the frontal area
// gives a quarter of that, and it changes the range by two metres and nothing
// else — the flight still looks like a flight and every ordering survives. The
// only way to catch it is to look at the force, so the force is reported.
if (!(flight.releaseDragFraction > 0.035 && flight.releaseDragFraction < 0.07)) {
  fail(
    `drag at release is ${(flight.releaseDragFraction * 100).toFixed(1)}% of weight — ` +
      `for a slender body on wetted area it is 4-6%`
  );
}
close(
  flight.releaseDrag,
  0.5 * AIR_DENSITY * 30 * 30 * SKIN_FRICTION * aNow.wetted,
  1e-12,
  'the reported release drag is not ½ρv²·Cf·A_wet'
);

// The integration is not the thing being measured: halve the step, same answer.
const finer = flyJavelin(aNow, { ...standard, step: 0.0005 });
const drift = Math.abs(finer.range - flight.range) / flight.range;
if (!(drift < 0.005)) fail(`halving the timestep moved the range by ${(drift * 100).toFixed(2)}%, budget 0.5%`);

// ------------------------- 5. THE 1986 RULE, across the whole release space

// Twenty-seven throws with each javelin. Nothing here has been told which way
// the rule went, and it has to come out the same way every single time.
const grid = [];
for (const speed of [28, 30, 32]) {
  for (const angle of [32, 36, 40]) {
    for (const attack of [0, 6, 12]) {
      const opts = { speed, angle: rad(angle), attack: rad(attack) };
      const now = flyJavelin(aNow, opts);
      const old = flyJavelin(aOld, opts);
      const vacuum = ballisticRange(speed, rad(angle), 1.8);
      grid.push({
        speed,
        angle,
        attack,
        now: now.range,
        old: old.range,
        cost: (old.range - now.range) / old.range,
        vacuum,
        surplusNow: now.range / vacuum - 1,
        surplusOld: old.range / vacuum - 1,
        attitudeNow: deg(now.landingAttitude),
        attitudeOld: deg(old.landingAttitude),
        peakNow: deg(now.peakAttack),
        peakOld: deg(old.peakAttack),
      });
    }
  }
}
const wrongWay = grid.filter((g) => g.old <= g.now);
if (wrongWay.length) {
  fail(
    `${wrongWay.length} of ${grid.length} releases had the FORWARD-balanced javelin going further — ` +
      `the 1986 rule went the other way`
  );
}
// The landing attitude is the rule's OTHER purpose — javelins were sliding
// flat and becoming unjudgeable — and it holds over the release angles
// competitors actually use. It does NOT hold at 40°, where the throw is nearly
// ballistic (the surplus over a cannonball has gone negative by then) and both
// javelins simply fall out of the sky along the same steep path. That
// reversal is real, it is reported below, and asserting "all 27" would have
// been asserting something false.
const competitive = grid.filter((g) => g.angle <= 36);
const flatter = competitive.filter((g) => g.attitudeOld >= g.attitudeNow);
if (flatter.length) {
  fail(
    `${flatter.length} of ${competitive.length} competitive releases had the old javelin landing ` +
      `STEEPER, and the rule was written to make them land steeper`
  );
}
const reversed = grid.filter((g) => g.angle > 36 && g.attitudeOld >= g.attitudeNow);
if (!reversed.length) {
  fail('the steep-release reversal has vanished, which means the flight has stopped going ballistic up there');
}
const holdsLess = grid.filter((g) => g.peakOld <= g.peakNow);
if (holdsLess.length) {
  fail(`${holdsLess.length} of ${grid.length} releases had the less stable javelin holding LESS angle of attack`);
}

// ------------------- 6. THE SHORTFALL, asserted rather than buried

const costs = grid.map((g) => g.cost);
const meanCost = costs.reduce((a, b) => a + b, 0) / costs.length;
const surplus = grid.map((g) => g.surplusOld);
const meanSurplus = surplus.reduce((a, b) => a + b, 0) / surplus.length;

// The cost is real and positive and NOT ten percent, and both halves of that
// sentence are budgets. If it ever reaches ten, either the aerodynamics got a
// measured lift curve or somebody fitted one.
if (!(meanCost > 0.003)) {
  fail(`four centimetres of balance costs only ${(meanCost * 100).toFixed(2)}% — the rule has stopped biting at all`);
}
if (meanCost > 0.04) {
  fail(
    `four centimetres now costs ${(meanCost * 100).toFixed(1)}%, which is the published figure. ` +
      `Slender-body crossflow does not produce that, so check what has been fitted`
  );
}
// ...and the reason, in the same numbers: the lift is about a quarter of real.
if (!(meanSurplus > -0.01 && meanSurplus < 0.08)) {
  fail(`the surplus over a cannonball is ${(meanSurplus * 100).toFixed(1)}%, and this model's is 1-5%`);
}

// --------------------------------------- 7. the constants are published ones

close(AIR_DENSITY, 1.225, 1e-12, 'the density of air has moved');
close(CROSSFLOW_DRAG, 1.2, 1e-12, 'a cylinder in crossflow is not 1.2');
close(SKIN_FRICTION, 0.004, 1e-12, 'the skin friction coefficient has moved');

// ---------------------------------------------------------------- report

if (json) {
  console.log(JSON.stringify({ grid, meanCost, meanSurplus, flight, aNow, aOld, failures }, null, 2));
} else {
  console.log('javelin — a rule change, and how much of it comes out of the geometry\n');
  console.log(`  the object            ${aNow.mass.toFixed(3)} kg, ${aNow.length.toFixed(2)} m, ` +
    `${(aNow.volume * 1e6).toFixed(0)} cm³ of air pushed`);
  console.log(
    `  1986 rules            balance ${(aNow.length - aNow.balance).toFixed(3)} m from the tip, ` +
      `static margin ${(staticMargin(aNow) * 100).toFixed(2)}%`
  );
  console.log(
    `  pre-1986              balance ${(aOld.length - aOld.balance).toFixed(3)} m from the tip, ` +
      `static margin ${(staticMargin(aOld) * 100).toFixed(2)}%`
  );
  console.log('  ...and NOTHING else differs: same mass, same shape, same volume, same drag\n');

  console.log('  speed  angle  attack |    new      old    cost | vacuum   surplus  |  landing attitude');
  console.log('  ' + '-'.repeat(84));
  for (const g of grid.filter((_, i) => i % 3 === 0)) {
    console.log(
      `  ${g.speed} m/s  ${String(g.angle).padStart(3)}°   ${String(g.attack).padStart(3)}°  | ` +
        `${g.now.toFixed(1).padStart(6)}  ${g.old.toFixed(1).padStart(6)}  ${(g.cost * 100).toFixed(1).padStart(4)}% | ` +
        `${g.vacuum.toFixed(1).padStart(5)}   ${(g.surplusOld * 100).toFixed(1).padStart(5)}%  |  ` +
        `${g.attitudeNow.toFixed(1)}° against ${g.attitudeOld.toFixed(1)}°`
    );
  }

  console.log('\n  WHAT COMES OUT OF THE GEOMETRY');
  console.log(`    all ${grid.length} releases          the pre-1986 javelin flies further`);
  console.log(`    all ${grid.length} releases          it holds a larger angle of attack`);
  console.log(
    `    all ${competitive.length} at 32-36°         it lands FLATTER, which is what the rule was written to stop`
  );
  console.log('    and nothing was told which way the rule went, or that there was a rule');
  console.log(
    `\n    ...but at 40° that reverses in ${reversed.length} of ${grid.length - competitive.length} releases: up there the`
  );
  console.log('    surplus over a cannonball has gone NEGATIVE and both javelins are just falling.');

  console.log('\n  WHAT DOES NOT');
  console.log(
    `    the cost comes out at ${(meanCost * 100).toFixed(1)}%, and the change was worth about 10%`
  );
  console.log(
    `    the reason is in the same table: this flight beats a cannonball by ${(meanSurplus * 100).toFixed(1)}%,`
  );
  console.log('    and real throws beat one by 10-17%. The lift is about a quarter of the real thing.');
  console.log('    Allen-Perkins crossflow under-predicts a javelin, and the published aerodynamics');
  console.log('    uses wind-tunnel tables this library does not have and has not invented.');
}

if (failures.length) {
  console.error('\nJAVELIN OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nThe 1986 rule change is the check. Nothing here may be fitted to it,\n' +
      'and a cost that suddenly reaches ten percent is a reason to look for the fit.'
  );
  process.exit(1);
}
if (!json) console.log('\njavelin: the direction is geometry; the size is a wind tunnel nobody here has ✓');
