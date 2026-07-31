/**
 * Do the hands and feet land on the obstacle?
 *
 * The third of ANIMA's contact gates, after `npm run skate` (feet on ground)
 * and `npm run climb` (hands on rungs). Swept over seeded bodies and over the
 * whole band each move is chosen for, because a move that works at one wall
 * height and not another is a move nobody can rely on.
 *
 * Three sweeps, because there are three questions and they are not the same
 * one. Going OVER something is a choice between techniques (`chooseMove`),
 * going DOWN off it is not a choice at all (`landingFor`), and going ACROSS a
 * hole is a question about speed (`canClear`). Each has its own coverage line
 * and its own way of being wrong.
 *
 * The coverage line is the part that is easy to leave out and matters most: a
 * selector that says "no" too readily is not caught by any contact number,
 * it just leaves characters standing at knee-high walls.
 */
import {
  createHumanoid,
  canClear,
  chooseMove,
  createMove,
  gapAt,
  landingFor,
  measureParkourContact,
  reachOf,
} from '../dist/index.js';

const SEEDS = [1, 5, 12, 21, 33, 47, 58, 74];
// Ceilings, not targets.
//
// `snap` is 2.5, not the 10 it shipped at. Ten was set against numbers that
// carried two harness bugs — a mixer that wrapped to frame 0 on the last
// sample, and a contact's two ease ramps spliced into one track — and with
// those gone the worst real case is 1.83x.
//
// 2.5 is not 1.83 plus a comfortable-looking margin. Over twelve bodies (four
// of them outside this sweep) `snap` runs p50 1.54, p90 1.83, p99 1.83, max
// 1.83: the whole distribution sits in a band a third of a unit wide, because
// the ratio is a property of the EASE CURVE and not of the body. A metric that
// does not vary with anatomy does not need anatomical headroom. Reinstating
// the pooled-ramp bug reads 2.95x and so fires this — a consequence of the
// number, not the reason for it.
const BUDGET = {
  slip: 0.02,
  penetration: 0.02,
  stretch: 0.99,
  coverage: 1.0,
  snap: 2.5,
  // Where a move ENDS, and how far past the far lip a jump gets. Neither is
  // visible in the contact numbers: a move can hold its feet perfectly on
  // holds that are in the wrong place, and every contact is long released by
  // the time a vault puts the body down.
  //
  // `footing` is why this is here at all. Both vaults used to end 410 mm BELOW
  // THE ROAD — the character finished with their feet in the tarmac on every
  // vault in the library — and nothing said so: the contact gate stops looking
  // when the hand lets go at 0.62, and the one test that checked a move's
  // final height covered the step and the mantle and skipped the vaults.
  footing: 0.12,
  clearance: 0,
};

/**
 * Where a move is supposed to leave the body, in the edge frame.
 *
 * Not a detail: the edge frame's origin is the TOP of the obstacle, so a move
 * that ends ON it ends at 0 and a move that ends BESIDE it ends a whole
 * obstacle-height down. `landing` deepens the far side, so it subtracts.
 */
const restsAt = (name, o) => {
  const fall = (o.landing ?? o.height) - o.height;
  if (name === 'step' || name === 'mantle' || name === 'gap-jump') return 0;
  return -o.height - fall;
};

const why = process.argv.includes('--why');
const rows = [];

let worstFooting = 0;
let worstFootingAt = '';
const footing = (rig, seed, name, o) => {
  const err = Math.abs(createMove(rig, name, o).end.y - restsAt(name, o));
  if (err > worstFooting) {
    worstFooting = err;
    worstFootingAt = `seed ${seed}, ${name}, ${o.height.toFixed(2)} m` +
      (o.landing === undefined ? '' : ` onto ${o.landing.toFixed(2)} m`);
  }
};

// ── 1. Over: every height from ankle to past what the body can mantle ──
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
      footing(rig, seed, name, { height, depth });
      rows.push({ seed, name, x: height, depth, ...r });
    }
  }
}

// ── 2. Down: every fall from a kerb to past what any technique survives ──
// A drop is not refused — a character who walks off a roof falls whether or
// not there is a technique for it — so what is checked here is that the feet
// arrive at the ground they fell TO, at every height, including the ones
// `landingFor` calls hurt.
const kinds = { absorb: 0, roll: 0, hurt: 0 };
let unordered = 0;

for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const reach = reachOf(rig);
  const leg = reach.step / 0.52;
  let last = 'absorb';
  const order = { absorb: 0, roll: 1, hurt: 2 };
  for (let fall = 0.2; fall <= leg * 3.4; fall += 0.12) {
    const kind = landingFor(fall, reach);
    kinds[kind]++;
    // Monotone by construction, and worth asserting: a taller fall that
    // reported an EASIER landing would be a threshold written backwards.
    if (order[kind] < order[last]) unordered++;
    last = kind;
    const obstacle = { height: fall, depth: 0.5 };
    const r = measureParkourContact(rig, 'drop', obstacle);
    footing(rig, seed, 'drop', obstacle);
    rows.push({ seed, name: 'drop', x: fall, depth: 0.5, ...r });
  }
  // Asymmetric: a parapet with a longer way down on the far side than the
  // near one. Reading `landing` as the height instead of the FALL — or with
  // the sign the wrong way round, which is exactly what the vault exit did
  // when it was first written — shows up here and nowhere else.
  for (const [height, landing] of [[0.9, 1.8], [1.3, 2.6], [0.4, 0.9]]) {
    const obstacle = { height, depth: 0.3, landing };
    const r = measureParkourContact(rig, 'drop', obstacle);
    footing(rig, seed, 'drop', obstacle);
    rows.push({ seed, name: 'drop', x: landing, depth: 0.3, ...r });
    // The same asymmetry under a vault, where the far ground is lower than
    // the near one and the body still has to land standing on it.
    if (height <= reach.vault) {
      footing(rig, seed, 'speed-vault', obstacle);
      footing(rig, seed, 'safety-vault', obstacle);
      rows.push({ seed, name: 'speed-vault', x: height, depth: 0.3,
        ...measureParkourContact(rig, 'speed-vault', obstacle) });
    }
  }
}

// ── 3. Across: every gap the body accepts, at every approach speed ──
let worstClear = Infinity;
let worstClearAt = '';
let jumps = 0;
let refusedGaps = 0;

for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const reach = reachOf(rig);
  for (const speed of [0, 1.5, 3.2, 5]) {
    const limit = gapAt(reach, speed);
    for (let width = 0.3; width <= limit + 0.6; width += 0.15) {
      if (!canClear(width, reach, speed)) {
        refusedGaps++;
        continue;
      }
      jumps++;
      const gap = { height: 0, depth: width };
      const r = measureParkourContact(rig, 'gap-jump', gap);
      footing(rig, seed, 'gap-jump', gap);
      // The landing foot is authored past the far lip. Whether the BODY gets
      // there is a different question, and the one that decides whether the
      // character ends the jump in the hole.
      const clear = createMove(rig, 'gap-jump', gap).end.z - width;
      if (clear < worstClear) {
        worstClear = clear;
        worstClearAt = `seed ${seed}, ${width.toFixed(2)} m at ${speed} m/s`;
      }
      rows.push({ seed, name: 'gap-jump', x: width, depth: width, ...r });
    }
  }
}

const fails = rows.filter(
  (r) =>
    r.contactSlip > BUDGET.slip ||
    r.penetration > BUDGET.penetration ||
    r.stretch > BUDGET.stretch ||
    r.snap > BUDGET.snap
);
const worstBy = (key) => [...rows].sort((a, b) => b[key] - a[key])[0];

if (why) {
  const byMove = new Map();
  for (const r of rows) {
    const cur = byMove.get(r.name) ?? { n: 0, slip: 0, pen: 0, stretch: 0, snap: 0 };
    cur.n++;
    cur.slip = Math.max(cur.slip, r.contactSlip);
    cur.pen = Math.max(cur.pen, r.penetration);
    cur.stretch = Math.max(cur.stretch, r.stretch);
    cur.snap = Math.max(cur.snap, r.snap);
    byMove.set(r.name, cur);
  }
  console.log('move           cases   worst slip   worst pen   worst stretch   worst snap');
  for (const [name, c] of byMove) {
    console.log(
      `${name.padEnd(14)} ${String(c.n).padStart(5)}   ${(c.slip * 1000).toFixed(2).padStart(8)}mm  ` +
        `${(c.pen * 1000).toFixed(2).padStart(8)}mm   ${c.stretch.toFixed(3).padStart(13)}   ` +
        `${c.snap.toFixed(2).padStart(9)}x`
    );
  }
  console.log();
}

const slip = worstBy('contactSlip');
const pen = worstBy('penetration');
const str = worstBy('stretch');
const snp = worstBy('snap');
const coverage = covered / reachable;
console.log(`parkour: ${rows.length} moves measured across ${SEEDS.length} bodies`);
console.log(`  worst contact slip  ${(slip.contactSlip * 1000).toFixed(2)} mm   (${slip.name}, ${slip.x.toFixed(2)} m)   budget ${BUDGET.slip * 1000} mm`);
console.log(`  worst penetration   ${(pen.penetration * 1000).toFixed(2)} mm   (${pen.name})   budget ${BUDGET.penetration * 1000} mm`);
console.log(`  worst extension     ${str.stretch.toFixed(3)}    (${str.name}, ${str.x.toFixed(2)} m)   budget ${BUDGET.stretch}`);
console.log(`  worst limb snap     ${snp.snap.toFixed(2)}x its own median step   (${snp.name})   budget ${BUDGET.snap}x`);
console.log(`  coverage            ${(coverage * 100).toFixed(1)}% of reachable obstacles got a move   budget ${BUDGET.coverage * 100}%`);
console.log(`  refusals            ${refusedHigh} above what the body can do, ${acceptedHigh} wrongly accepted`);
console.log(`  footing             ${(worstFooting * 1000).toFixed(1)} mm off the surface the move ends on   (${worstFootingAt})   budget ${BUDGET.footing * 1000} mm`);
console.log(`  drop technique      ${kinds.absorb} absorbed, ${kinds.roll} rolled, ${kinds.hurt} past technique; ${unordered} out of order`);
console.log(`  gap clearance       ${(worstClear * 1000).toFixed(1)} mm past the far lip, worst case   (${worstClearAt})   budget ${BUDGET.clearance} mm`);
console.log(`  gap refusals        ${jumps} accepted, ${refusedGaps} too far for the speed`);

const broken =
  fails.length ||
  coverage < BUDGET.coverage ||
  acceptedHigh > 0 ||
  worstFooting > BUDGET.footing ||
  worstClear < BUDGET.clearance ||
  unordered > 0;

if (broken) {
  if (fails.length) {
    console.log(`\nOVER BUDGET: ${fails.length} case(s)`);
    for (const r of fails.slice(0, 8)) {
      console.log(
        `  seed ${r.seed} ${r.name} x=${r.x.toFixed(2)}: slip ${(r.contactSlip * 1000).toFixed(1)}mm ` +
          `pen ${(r.penetration * 1000).toFixed(1)}mm stretch ${r.stretch.toFixed(3)} snap ${r.snap.toFixed(2)}x`
      );
    }
  }
  if (coverage < BUDGET.coverage) console.log(`\nGAPS: only ${(coverage * 100).toFixed(1)}% of reachable obstacles got a move`);
  if (acceptedHigh > 0) console.log(`\nOVERREACH: ${acceptedHigh} obstacle(s) past this body's limit were accepted anyway`);
  if (worstFooting > BUDGET.footing) console.log(`\nBAD FOOTING: a move ended ${(worstFooting * 1000).toFixed(0)} mm off the surface it is supposed to finish on (${worstFootingAt})`);
  if (worstClear < BUDGET.clearance) console.log(`\nIN THE HOLE: a jump this body accepted ended ${(-worstClear * 1000).toFixed(0)} mm SHORT of the far lip (${worstClearAt})`);
  if (unordered > 0) console.log(`\nBACKWARDS: ${unordered} fall(s) reported an easier landing than a shorter one`);
  process.exit(1);
}
console.log('\nparkour: every body reaches every hold ✓');
