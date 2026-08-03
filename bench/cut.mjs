#!/usr/bin/env node
/**
 * The cut gate — the fifteenth.
 *
 *   npm run cut            fail if a hit stops being a pressure
 *   npm run cut -- --json  the numbers, machine-readable
 *
 * ## What this is checking, and what it is deliberately not
 *
 * Everybody's intuition about cutting is a STRESS criterion: press until the
 * pressure reaches the material's strength. That is correct and it is nearly
 * useless, and the gap is the finding.
 *
 *   a 10 µm point in skin      σ·πr²  =  6.3 MILLI-newtons
 *   the same wound, continued  R·w    =  60 newtons
 *
 * Four orders of magnitude, and the second one is the one that matches
 * instrumented measurements of knives going through skin. Sharpness decides
 * whether a cut STARTS. Toughness decides what it COSTS.
 *
 * So this gate checks three different kinds of thing, and keeps them apart:
 *
 *   GEOMETRY      areas and chords. Closed form, exact, no opinions in it
 *   MATERIALS     six things to hit, with toughness derived as K²/E wherever
 *                 linear elastic fracture mechanics applies and measured where
 *                 it does not
 *   THE BOUND     `d ≤ E/(R·w)`, which is an upper bound and is checked AS a
 *                 bound. It says a 113 J swing goes 1.5 m into pine. It does
 *                 not, and the gate asserts the overshoot rather than hiding
 *                 it, because a number that had been fitted until it looked
 *                 right would be a number about the fit.
 */
import {
  BLADES,
  EDGES,
  EDGE_NAMES,
  TARGETS,
  TARGET_NAMES,
  bluntestThatBites,
  createHumanoid,
  cutDepth,
  edgeArea,
  engagedLength,
  griffith,
  initiationForce,
  measureCut,
  measureStrike,
  measureThrust,
  pressure,
  propagationForce,
  sectionAt,
  tipArea,
} from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const close = (a, b, tol, what) => {
  if (!(Math.abs(a - b) <= tol)) fail(`${what}: ${a} against ${b}, tolerance ${tol}`);
};

// ------------------------------------------------ 1. geometry, in closed form

// An edge is a line and a point is an area, and every conclusion below is
// downstream of that one sentence being arithmetic rather than a metaphor.
close(edgeArea(1e-6, 0.1), 2e-7, 1e-18, 'an edge apex is not 2rL');
close(tipArea(1e-5), Math.PI * 1e-10, 1e-22, 'a point is not πr²');
close(edgeArea(0, 0.1), 0, 0, 'an infinitely sharp edge has area');
close(tipArea(-1), 0, 0, 'a negative radius has area');

// The chord of a circle: L = 2√(2Rδ). A straight blade has no chord and lies
// along everything it is given.
close(engagedLength(0.9, 0.001, 10), 2 * Math.sqrt(2 * 0.9 * 0.001), 1e-12, 'the chord is not 2√(2Rδ)');
close(engagedLength(Infinity, 0.001, 0.2), 0.2, 1e-12, 'a straight edge did not engage what it was offered');
close(engagedLength(undefined, 0.001, 0.2), 0.2, 1e-12, 'an unspecified curve is not straight');
if (!(engagedLength(0.9, 0.001, 0.02) === 0.02)) {
  fail('a curve engaged more edge than the blade was laid across');
}
// Deeper bite, more edge — and as the square root, not linearly.
const shallow = engagedLength(0.9, 0.001, 10);
const deep = engagedLength(0.9, 0.004, 10);
close(deep / shallow, 2, 1e-12, 'four times the bite is not twice the chord');

// π/4... no. Pressure is force over area, and that is the whole file.
close(pressure(100, 2e-7), 5e8, 1, 'pressure is not force over area');
if (Number.isFinite(pressure(1, 0))) fail('zero area is not infinite pressure');

// ------------------------------------------- 2. the closed-form inversion

// `bluntestThatBites` solves σ = F/(2rL) for r. Hand its answer back to
// `measureCut` and the pressure has to land exactly on the strength — a
// function checked against its own inverse rather than against a budget.
for (const name of TARGET_NAMES) {
  const t = TARGETS[name];
  const r = bluntestThatBites(t, 250, 0.15);
  const got = measureCut(
    { energy: 50, force: 250, radius: r, width: 0.02, contact: 0.15 },
    t
  );
  close(got.pressure, t.strength, t.strength * 1e-9, `${name}: the inversion does not invert`);
  // A threshold is a threshold: a hair either side of it, and only a hair.
  // Asserting `bites` AT the returned radius would be asserting which way a
  // float rounded, which is a fact about IEEE 754 and not about cutting.
  const keener = measureCut({ energy: 50, force: 250, radius: r * 0.999, width: 0.02, contact: 0.15 }, t);
  const blunter = measureCut({ energy: 50, force: 250, radius: r * 1.001, width: 0.02, contact: 0.15 }, t);
  if (!keener.bites) fail(`${name}: an edge keener than the threshold does not bite`);
  if (blunter.bites) fail(`${name}: an edge blunter than the threshold still bites`);
}

// ------------------------------------------------- 3. the materials table

// Griffith, checked against itself: R = K²/E.
close(griffith(50e6, 200e9), 12500, 1e-9, 'K²/E is not K²/E');
close(griffith(1e6, 0), 0, 0, 'a material with no stiffness has toughness');

for (const name of TARGET_NAMES) {
  const t = TARGETS[name];
  if (!(t.strength > 1e5 && t.strength < 1e10)) fail(`${name}: ${t.strength} Pa is not a strength`);
  if (!(t.toughness > 10 && t.toughness < 1e6)) fail(`${name}: ${t.toughness} J/m² is not a work of fracture`);
  if (!(t.density > 100 && t.density < 20000)) fail(`${name}: ${t.density} kg/m³ is not a density`);
}

// STRENGTH AND TOUGHNESS ARE INDEPENDENT, and the table has to keep showing it
// or it has collapsed into one number wearing two names. Mail is 16x leather's
// strength and 1.25x its toughness; skin is 67x muscle's strength and 3x its
// toughness.
const { skin, muscle, leather, mail, pine, pineSplit } = TARGETS;
if (!(mail.strength > leather.strength * 10)) fail('mail is no longer far stronger than leather');
if (!(mail.toughness < leather.toughness * 2)) {
  fail('mail is now much tougher than leather too, and the two axes have merged');
}
if (!(skin.strength > muscle.strength * 20)) fail('skin is no longer much stronger than muscle');
if (!(skin.toughness < muscle.toughness * 6)) fail('skin has become enormously tougher than muscle');

// The grain, which is the whole argument for a splitting maul: the SAME timber
// is an order of magnitude cheaper to open one way than the other.
if (!(pine.toughness > pineSplit.toughness * 5)) {
  fail(
    `pine is only ${(pine.toughness / pineSplit.toughness).toFixed(1)}x dearer across the grain ` +
      `than along it, budget 5x`
  );
}

// ---------------------------------- 4. THE FINDING: two criteria, far apart

// This is what the file exists to say, and it is stated as a budget so that
// somebody has to argue with it if it ever changes.
const point = 1e-5; // a sharp but real point: 10 µm
const stab = measureThrust({ energy: 60, force: 150, radius: point, width: 0.02 }, skin);
close(stab.toStart, skin.strength * Math.PI * point * point, 1e-12, 'the stress criterion is not σ·A');
close(stab.toContinue, skin.toughness * 0.02, 1e-12, 'the energy criterion is not R·w');
if (!(stab.disagreement > 1000)) {
  fail(
    `the two criteria are only ${stab.disagreement.toFixed(0)}x apart, budget 1000x — ` +
      `if this has closed, one of them has been fitted to the other`
  );
}
if (!(stab.toStart < 0.05)) fail(`a stress criterion puts skin entry at ${stab.toStart} N, which is no longer tiny`);

// ...and the one that governs has to land in the band instrumented knives
// measure. Forensic work puts sharp-blade skin penetration in the region of
// ten to fifty newtons; a wound is narrow at entry and widens as the blade
// goes in, so both ends of that band should be reachable by changing nothing
// but the width already engaged.
const atEntry = propagationForce(skin, 0.004);
const atFull = propagationForce(skin, 0.02);
if (!(atEntry > 5 && atEntry < 25)) fail(`entering skin takes ${atEntry.toFixed(0)} N, measured band 10-50`);
if (!(atFull > 25 && atFull < 90)) fail(`a full-width wound takes ${atFull.toFixed(0)} N, measured band 10-50 at the top`);
// Knight 1975: the skin is the resistance, and what is under it is not.
if (!(propagationForce(skin, 0.02) > propagationForce(muscle, 0.02) * 2)) {
  fail('skin is no longer the barrier that muscle is not');
}

// -------------------------------- 5. a thrust concentrates, a cut does not

// Same force, same steel, same person. The only difference is that one lands
// on an area and the other on a line.
const asThrust = measureThrust({ energy: 60, force: 150, radius: point, width: 0.02 }, skin);
const asCut = measureCut(
  { energy: 60, force: 150, radius: EDGES.sharp, width: 0.02, contact: 0.03 },
  skin
);
const concentration = asThrust.pressure / asCut.pressure;
if (!(concentration > 20)) {
  fail(`a thrust only concentrates ${concentration.toFixed(0)}x a cut, budget 20x`);
}

// ------------------------------------- 6. sharpness is the whole argument

// Every edge in the library, one target, one hard swing. The pressure has to
// fall exactly as 1/r — it is a division — and somewhere along that list a
// blade has to stop cutting, or `EDGES` is a list of synonyms.
const swing = 300; // N
const byEdge = EDGE_NAMES.map((n) => ({
  edge: n,
  radius: EDGES[n],
  ...measureCut({ energy: 60, force: swing, radius: EDGES[n], width: 0.02, contact: 0.15 }, skin),
}));
for (let i = 1; i < byEdge.length; i++) {
  const a = byEdge[i - 1];
  const b = byEdge[i];
  close(
    a.pressure / b.pressure,
    b.radius / a.radius,
    1e-6,
    `${a.edge} vs ${b.edge}: pressure is not inversely proportional to the apex radius`
  );
}
if (!byEdge[0].bites) fail('a razor does not cut skin under 300 N');
if (byEdge[byEdge.length - 1].bites) {
  fail('the dullest edge in the library still cuts skin, so sharpness has stopped mattering');
}

// ---------------------------- 7. curvature, and why a sabre is not straight

// Same edge, same push, same target. The difference is the chord.
const flat = measureCut({ energy: 60, force: 200, radius: EDGES.sharp, width: 0.02, contact: 0.2 }, leather);
const curved = measureCut(
  { energy: 60, force: 200, radius: EDGES.sharp, width: 0.02, contact: 0.2, curve: BLADES.sabre.curve },
  leather
);
if (!(curved.pressure > flat.pressure * 2)) {
  fail(`a sabre's curve only buys ${(curved.pressure / flat.pressure).toFixed(1)}x the pressure, budget 2x`);
}
// The axe is the case that matters: 60x the apex radius of a sword, and it
// cuts anyway. Not because of its edge — because of its curve, and because of
// what is behind it.
const axeCut = measureCut(
  { energy: 60, force: 200, radius: EDGES.blunt, width: 0.02, contact: 0.2, curve: BLADES.axe.curve },
  leather
);
const swordCut = measureCut(
  { energy: 60, force: 200, radius: EDGES.sharp, width: 0.02, contact: 0.2, curve: BLADES.arming.curve },
  leather
);
if (!(axeCut.engaged < swordCut.engaged / 4)) {
  fail('an axe bit no longer engages a fraction of what a straight sword does');
}
// ...and it STILL loses on pressure, by a lot, which is the honest version of
// the story. An axe is not a sharp thing. It is a heavy thing.
if (!(axeCut.pressure < swordCut.pressure)) {
  fail('a blunt axe now out-pressures a sharp sword, which would make sharpening pointless');
}

// ------------------------------- 8. THE BOUND IS A BOUND, and says so

// `cutDepth` is `E/(R·w)` with nothing lost to friction, to wedging the halves
// apart around a blade that has its own thickness, or to moving the target.
// Checked here AS a bound: it has to be enormous, and the gate says by how
// much rather than pretending otherwise.
const blow = measureStrike(createHumanoid({ seed: 42 }), 'hammerfist', { skill: 0.9 });
const section = sectionAt(BLADES.arming, 0.7);
const bound = cutDepth(blow.energy, pine, section.width);
if (!(bound > 0.5)) {
  fail(`the bound came out at ${(bound * 1000).toFixed(0)} mm, which means something has been fitted into it`);
}
// It scales exactly as 1/(R·w), because that is all it is.
close(cutDepth(100, pine, 0.02), 100 / (pine.toughness * 0.02), 1e-12, 'the bound is not E/(R·w)');
close(cutDepth(200, pine, 0.02), 2 * cutDepth(100, pine, 0.02), 1e-12, 'twice the energy is not twice the bound');
close(cutDepth(100, pine, 0.04), cutDepth(100, pine, 0.02) / 2, 1e-12, 'twice the width is not half the bound');
if (cutDepth(-5, pine, 0.02) !== 0) fail('negative energy cuts');
// A cut that never bit goes nowhere, however much energy is behind it.
const bounced = measureCut(
  { energy: 5000, force: 20, radius: EDGES.dull, width: 0.02, contact: 0.2 },
  mail
);
if (bounced.bites) fail('a dull edge at 20 N bit mail');
if (bounced.depthBound !== 0) fail('a cut that never started still went somewhere');

// ---------------------------------------------------------------- report

const wounds = TARGET_NAMES.map((n) => ({
  target: n,
  strength: TARGETS[n].strength,
  toughness: TARGETS[n].toughness,
  toStart: initiationForce(TARGETS[n], tipArea(point)),
  toContinue: propagationForce(TARGETS[n], 0.02),
}));

if (json) {
  console.log(JSON.stringify({ wounds, byEdge, stab, asCut, flat, curved, axeCut, bound, failures }, null, 2));
} else {
  console.log('cut — a hit is a pressure, and a pressure is a force over an area\n');
  console.log('  target        strength   toughness   START (10µm point)   KEEP (20mm wound)');
  console.log('  ' + '-'.repeat(72));
  for (const w of wounds) {
    console.log(
      `  ${w.target.padEnd(11)} ${(w.strength / 1e6).toFixed(1).padStart(7)} MPa ` +
        `${w.toughness.toFixed(0).padStart(8)} J/m²   ${w.toStart.toExponential(1).padStart(10)} N` +
        `        ${w.toContinue.toFixed(1).padStart(7)} N`
    );
  }

  console.log('\n  THE TWO CRITERIA DO NOT AGREE');
  console.log(
    `    a 10 µm point in skin        starts at ${(stab.toStart * 1000).toFixed(1)} mN — the weight of a paperclip`
  );
  console.log(
    `    the same wound, continued    costs ${stab.toContinue.toFixed(0)} N, and THAT is the band ` +
      `instrumented knives measure`
  );
  console.log(`    they disagree by             ${stab.disagreement.toExponential(1)}x`);
  console.log(`    entering vs full width       ${atEntry.toFixed(0)} N at 4 mm, ${atFull.toFixed(0)} N at 20 mm`);

  console.log('\n  SHARPNESS, one target, one 300 N swing');
  for (const e of byEdge) {
    console.log(
      `    ${e.edge.padEnd(9)} ${(e.radius * 1e6).toFixed(2).padStart(7)} µm   ` +
        `${(e.pressure / 1e6).toFixed(1).padStart(9)} MPa   ${e.bites ? 'cuts' : 'does NOT cut'}`
    );
  }

  console.log('\n  CURVATURE — same edge, same 200 N, same leather');
  console.log(
    `    straight blade   engages ${(flat.engaged * 1000).toFixed(0)} mm   ` +
      `${(flat.pressure / 1e6).toFixed(0)} MPa`
  );
  console.log(
    `    sabre, R=0.9 m   engages ${(curved.engaged * 1000).toFixed(0)} mm   ` +
      `${(curved.pressure / 1e6).toFixed(0)} MPa   ${(curved.pressure / flat.pressure).toFixed(1)}x, for free`
  );
  console.log(
    `    axe, R=0.12 m    engages ${(axeCut.engaged * 1000).toFixed(0)} mm   ` +
      `${(axeCut.pressure / 1e6).toFixed(0)} MPa   on a ${(EDGES.blunt * 1e6).toFixed(0)} µm edge — ` +
      `still ${(swordCut.pressure / axeCut.pressure).toFixed(0)}x worse than the sword`
  );

  console.log('\n  AND THE PART THIS DOES NOT KNOW');
  console.log(
    `    a ${blow.energy.toFixed(0)} J hammerfist through a ${(section.width * 1000).toFixed(0)} mm blade ` +
      `bounds at ${(bound * 1000).toFixed(0)} mm into pine`
  );
  console.log('    which is not a thing that happens. E/(R·w) counts new surface and nothing else —');
  console.log('    no friction, no wedging, no pushing the target. It is a BOUND, it is named one,');
  console.log('    and the missing terms need a measurement this library does not have.');
}

if (failures.length) {
  console.error('\nCUT OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nThe geometry is closed form and the materials are published.\n' +
      'If the two criteria have converged, somebody has fitted one to the other.'
  );
  process.exit(1);
}
if (!json) console.log('\ncut: sharpness starts it, toughness pays for it ✓');
