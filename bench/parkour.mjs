/**
 * Do the hands and feet land on the obstacle?
 *
 * The third of ANIMA's contact gates, after `npm run skate` (feet on ground)
 * and `npm run climb` (hands on rungs). Swept over seeded bodies and over the
 * whole height band each move is chosen for, because a move that works at one
 * wall height and not another is a move nobody can rely on.
 *
 * The coverage line is the part that is easy to leave out and matters most: a
 * selector that says "no" too readily is not caught by any contact number,
 * it just leaves characters standing at knee-high walls.
 */
import { createHumanoid, chooseMove, measureParkourContact, reachOf } from '../dist/index.js';

const SEEDS = [1, 5, 12, 21, 33, 47, 58, 74];
// Ceilings, not targets.
const BUDGET = { slip: 0.02, penetration: 0.02, stretch: 0.99, coverage: 1.0 };

const why = process.argv.includes('--why');
const rows = [];
// Coverage is only meaningful BELOW what a body can do. The sweep runs past
// that on purpose, and a refusal up there is the right answer rather than a
// gap — counting the two together just buries both.
let reachable = 0;
let covered = 0;
let refusedHigh = 0;
let acceptedHigh = 0;

for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const reach = reachOf(rig);
  // Every height from ankle to a little past what this body can mantle, at
  // both a walk and a run, thin and thick.
  for (let height = 0.12; height <= reach.mantle + 0.25; height += 0.08) {
    for (const [depth, speed] of [[0.3, 4], [0.3, 1.6], [0.3, 0], [1.1, 4], [1.1, 0]]) {
      const possible = height <= reach.mantle;
      const name = chooseMove({ height, depth }, reach, { speed });
      if (possible) {
        reachable++;
        if (name) covered++;
      } else if (name) acceptedHigh++;
      else refusedHigh++;
      if (!name) continue;
      const r = measureParkourContact(rig, name, { height, depth });
      rows.push({ seed, height, depth, speed, name, ...r });
    }
  }
}

const fails = rows.filter(
  (r) => r.contactSlip > BUDGET.slip || r.penetration > BUDGET.penetration || r.stretch > BUDGET.stretch
);
const worstBy = (key) => [...rows].sort((a, b) => b[key] - a[key])[0];

if (why) {
  const byMove = new Map();
  for (const r of rows) {
    const cur = byMove.get(r.name) ?? { n: 0, slip: 0, pen: 0, stretch: 0 };
    cur.n++;
    cur.slip = Math.max(cur.slip, r.contactSlip);
    cur.pen = Math.max(cur.pen, r.penetration);
    cur.stretch = Math.max(cur.stretch, r.stretch);
    byMove.set(r.name, cur);
  }
  console.log('move           cases   worst slip   worst pen   worst stretch');
  for (const [name, c] of byMove) {
    console.log(
      `${name.padEnd(14)} ${String(c.n).padStart(5)}   ${(c.slip * 1000).toFixed(2).padStart(8)}mm  ` +
        `${(c.pen * 1000).toFixed(2).padStart(8)}mm   ${c.stretch.toFixed(3)}`
    );
  }
  console.log();
}

const slip = worstBy('contactSlip');
const pen = worstBy('penetration');
const str = worstBy('stretch');
const coverage = covered / reachable;
console.log(`parkour: ${rows.length} moves measured across ${SEEDS.length} bodies`);
console.log(`  worst contact slip  ${(slip.contactSlip * 1000).toFixed(2)} mm   (${slip.name}, ${slip.height.toFixed(2)} m wall)   budget ${BUDGET.slip * 1000} mm`);
console.log(`  worst penetration   ${(pen.penetration * 1000).toFixed(2)} mm   (${pen.name})   budget ${BUDGET.penetration * 1000} mm`);
console.log(`  worst extension     ${str.stretch.toFixed(3)}    (${str.name}, ${str.height.toFixed(2)} m wall)   budget ${BUDGET.stretch}`);
console.log(`  coverage            ${(coverage * 100).toFixed(1)}% of reachable obstacles got a move   budget ${BUDGET.coverage * 100}%`);
console.log(`  refusals            ${refusedHigh} above what the body can do, ${acceptedHigh} wrongly accepted`);

if (fails.length || coverage < BUDGET.coverage || acceptedHigh > 0) {
  if (fails.length) {
    console.log(`\nOVER BUDGET: ${fails.length} case(s)`);
    for (const r of fails.slice(0, 8)) {
      console.log(`  seed ${r.seed} ${r.name} h=${r.height.toFixed(2)} d=${r.depth}: slip ${(r.contactSlip*1000).toFixed(1)}mm pen ${(r.penetration*1000).toFixed(1)}mm stretch ${r.stretch.toFixed(3)}`);
    }
  }
  if (coverage < BUDGET.coverage) console.log(`\nGAPS: only ${(coverage * 100).toFixed(1)}% of reachable obstacles got a move`);
  if (acceptedHigh > 0) console.log(`\nOVERREACH: ${acceptedHigh} obstacle(s) past this body's limit were accepted anyway`);
  process.exit(1);
}
console.log('\nparkour: every body reaches every hold ✓');
