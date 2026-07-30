/**
 * Does the climber hold the ladder?
 *
 * The hand-and-rung sibling of `npm run skate`. A limb that slides while it
 * is supposed to be gripping is invisible in a still frame and unmistakable
 * in motion — and the loop this gate was written for had 0.367 m of it per
 * cycle while its own doc comment claimed three points of contact.
 *
 * Swept over seeded bodies (proportions vary, so reach varies) and over rung
 * spacings, because a ladder is a fixed grid and a climber is not.
 */
import { createHumanoid, measureClimbContact } from '../dist/index.js';

const SEEDS = [1, 5, 12, 21, 33, 47, 58, 61, 74, 89];
const SPACINGS = [0.22, 0.26, 0.3, 0.34];

// Ceilings, not targets. Measured worst across the sweep is far below each.
const BUDGET = { slip: 0.006, overlap: 0.0, stretch: 0.99, overhead: 0.02 };

const why = process.argv.includes('--why');
const rows = [];
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  for (const rungSpacing of SPACINGS) {
    const r = measureClimbContact(rig, { rungSpacing });
    rows.push({ seed, rungSpacing, height: rig.height, ...r });
  }
}

const worst = (key, cmp = (a, b) => b - a) => [...rows].sort((a, b) => cmp(a[key], b[key]))[0];
const fails = rows.filter(
  (r) =>
    r.worstSlip > BUDGET.slip ||
    r.overlap > BUDGET.overlap ||
    r.stretch > BUDGET.stretch ||
    r.overhead < BUDGET.overhead
);

if (why) {
  console.log('seed  rung   height   hand      foot      overlap  stretch  overhead');
  for (const r of rows) {
    console.log(
      `${String(r.seed).padStart(4)}  ${r.rungSpacing.toFixed(2)}   ${r.height.toFixed(2)}   ` +
        `${(r.handSlip * 1000).toFixed(2).padStart(6)}mm  ${(r.footSlip * 1000).toFixed(2).padStart(6)}mm  ` +
        `${r.overlap.toFixed(3)}    ${r.stretch.toFixed(3)}    ${r.overhead.toFixed(3)}m`
    );
  }
  console.log();
}

const ws = worst('worstSlip');
const st = worst('stretch');
const oh = worst('overhead', (a, b) => a - b);
console.log(`climb: ${rows.length} cases (${SEEDS.length} bodies x ${SPACINGS.length} rung spacings)`);
console.log(`  worst grip slip    ${(ws.worstSlip * 1000).toFixed(2)} mm   (seed ${ws.seed}, ${ws.rungSpacing} m rungs)   budget ${BUDGET.slip * 1000} mm`);
console.log(`  worst overlap      ${Math.max(...rows.map((r) => r.overlap)).toFixed(3)}         budget ${BUDGET.overlap} — three points of contact`);
console.log(`  worst extension    ${st.stretch.toFixed(3)}      (seed ${st.seed}, ${st.rungSpacing} m rungs)   budget ${BUDGET.stretch}`);
console.log(`  least overhead     ${oh.overhead.toFixed(3)} m    (seed ${oh.seed}, ${oh.rungSpacing} m rungs)   budget ${BUDGET.overhead} m`);

if (fails.length) {
  console.log(`\nOVER BUDGET: ${fails.length} case(s)`);
  for (const r of fails.slice(0, 8)) {
    console.log(`  seed ${r.seed} @ ${r.rungSpacing} m: slip ${(r.worstSlip * 1000).toFixed(2)}mm overlap ${r.overlap.toFixed(3)} stretch ${r.stretch.toFixed(3)} overhead ${r.overhead.toFixed(3)}`);
  }
  process.exit(1);
}
console.log('\nclimb: every body holds every ladder ✓');
