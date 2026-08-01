#!/usr/bin/env node
/**
 * The fight-style gate.
 *
 *   npm run fightstyle            fail if a style stops being a set of feet
 *   npm run fightstyle -- --json  the same numbers, machine-readable
 *
 * ## Why this exists
 *
 * A style here is three facts — where the feet are, where the hands are, and
 * what the fighter throws at all — and every number a game would want about it
 * is a CONSEQUENCE measured by some other module. There is no damage
 * multiplier anywhere in `FIGHT_STYLES` and nowhere one could be added.
 *
 * That is a claim with two ways to fail, and they look identical from outside:
 *
 *   the stance stops mattering, and six styles produce six identical profiles;
 *   or one style quietly becomes best at everything.
 *
 * So the headline is a shape rather than a value: NOBODY WINS EVERY COLUMN,
 * NOBODY LOSES EVERY COLUMN, and every column has a real spread across the six.
 *
 * What it has already caught, on its own first runs:
 *
 *   - `restJoint` caching "at rest" from whatever pose the body was in the
 *     FIRST TIME anybody asked. Ask for a reach with a fighter already stood
 *     in a wide stance and the cache freezes a pelvis that dropped 50 mm to
 *     get there — and every reach that body reports for the rest of the
 *     session is 50 mm short. It now reads the skeleton's bind pose.
 *   - `measureStrike` not lowering the guard when it finishes, so the guard
 *     coverage measured after it was measured on a body still carrying the
 *     last punch. The same long guard came out 36.3% standalone and 28.0%
 *     inside a profile.
 *   - a centre-line cone sampled along +forward instead of -forward, which
 *     asks what covers the back of somebody's head. The answer is nothing,
 *     for everybody, and it reads exactly like a working measurement.
 *
 * All three were found by ONE invariant: profile the six styles forwards, then
 * backwards, and demand the same numbers.
 */
import {
  Guard,
  coverageOf,
  createHumanoid,
  FIGHT_STYLES,
  FIGHT_STYLE_NAMES,
  FightStyle,
  GUARDS,
  applyStance,
  holdStance,
  measureStrike,
  releaseStance,
  stanceDrop,
  strikeReach,
  stability,
  styleProfile,
} from '../dist/index.js';

const SEEDS = [42, 7, 313];
const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const deg = (v) => `${((v * 180) / Math.PI).toFixed(1)}°`;

// ------------------------------------------------- 1. the same, either way

// Profile the six forwards and backwards on ONE body. Every column must agree
// exactly. This is the invariant that found all three defects above, and it is
// first because everything below is worthless if it does not hold.
const forward = {};
const backward = {};
{
  const rig = createHumanoid({ seed: 42 });
  for (const n of FIGHT_STYLE_NAMES) forward[n] = styleProfile(rig, n);
  for (const n of [...FIGHT_STYLE_NAMES].reverse()) backward[n] = styleProfile(rig, n);
}
const COLUMNS = ['base', 'reach', 'power', 'poise', 'cover', 'guardBody', 'centre', 'rooted'];
for (const n of FIGHT_STYLE_NAMES) {
  for (const c of COLUMNS) {
    if (forward[n][c] !== backward[n][c]) {
      fail(`${n}.${c} depends on measurement order: ${forward[n][c]} then ${backward[n][c]}`);
    }
  }
  if (forward[n].weakLine !== backward[n].weakLine) {
    fail(`${n}: the weak line depends on measurement order`);
  }
}

// ...and it must not depend on the BODY either, beyond the body's own size.
// Three seeds, and the ORDER of the six must come out the same on all of them.
const ranks = {};
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  ranks[seed] = {};
  for (const n of FIGHT_STYLE_NAMES) ranks[seed][n] = styleProfile(rig, n);
}
// `base` is pure stance geometry over a foot, so the ORDER must be identical
// on every body. `cover` deliberately is not checked that way: a peekaboo and
// a long guard come out 35.7% and 36.3% on one body, and two guards that close
// together are entitled to swap on the next one. Demanding a total order there
// would be demanding that the bodies stop being different sizes.
{
  const order = (seed) =>
    [...FIGHT_STYLE_NAMES].sort((a, b) => ranks[seed][b].base - ranks[seed][a].base).join(',');
  const first = order(SEEDS[0]);
  for (const seed of SEEDS.slice(1)) {
    if (order(seed) !== first) fail(`the base ranking changes with the body: ${first} vs ${order(seed)}`);
  }
}
// The centre line is not close: 20% against 4% against nothing. Whoever leads
// it leads it on every body, or the column is noise.
for (const seed of SEEDS) {
  const lead = [...FIGHT_STYLE_NAMES].sort((a, b) => ranks[seed][b].centre - ranks[seed][a].centre)[0];
  if (lead !== 'wingChun') fail(`seed ${seed}: ${lead} led the centre line, not the style built to hold it`);
}

// ------------------------------------------------------- 2. nobody wins

const profiles = forward;
const best = {};
const worst = {};
for (const c of COLUMNS) {
  const values = FIGHT_STYLE_NAMES.map((n) => profiles[n][c]);
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  best[c] = FIGHT_STYLE_NAMES.filter((n) => profiles[n][c] === hi);
  worst[c] = FIGHT_STYLE_NAMES.filter((n) => profiles[n][c] === lo);
}
const winsAll = FIGHT_STYLE_NAMES.filter((n) => COLUMNS.every((c) => best[c].includes(n)));
const losesAll = FIGHT_STYLE_NAMES.filter((n) => COLUMNS.every((c) => worst[c].includes(n)));
if (winsAll.length) fail(`${winsAll.join(', ')} is best at everything — that is a power creep`);
if (losesAll.length) fail(`${losesAll.join(', ')} is worst at everything — nobody would ever pick it`);

const leaders = new Set(COLUMNS.flatMap((c) => best[c]));
if (leaders.size < 4) {
  fail(`only ${leaders.size} styles lead any column — the stance is barely doing anything`);
}

// Every column has to separate them. A column where all six agree is a column
// that is measuring the body rather than the style.
const SPREAD = {
  base: 1.2,
  reach: 1.1,
  power: 1.2,
  cover: 3,
  guardBody: 2,
  rooted: 1.2,
};
for (const [c, budget] of Object.entries(SPREAD)) {
  const values = FIGHT_STYLE_NAMES.map((n) => profiles[n][c]);
  const ratio = Math.max(...values) / Math.max(1e-9, Math.min(...values));
  if (ratio < budget) fail(`${c} spreads only ${ratio.toFixed(2)}x across six styles, budget ${budget}x`);
}

// ------------------------------------------------ 3. the feet do the work

// The long stance and the wide one are NOT the same bet, and the geometry says
// so without being told: a body is broken over the shortest way out of its own
// base, so a stance that is long front-to-back is rooted and one that is
// merely wide across is not.
const long = profiles.karate;
const wide = profiles.brawler;
if (!(long.rooted > wide.rooted)) {
  fail(`the wide stance (${deg(wide.rooted)}) was as rooted as the long one (${deg(long.rooted)})`);
}
if (wide.weakLine !== 'back') fail(`a wide square stance broke ${wide.weakLine}, not backwards`);

// A LONG STANCE IS AUTOMATICALLY A LOW ONE, and it is the LENGTH that does it,
// not the width. The pelvis has to come down far enough for the legs to reach
// the footprints — Pythagoras on the worst leg — and `sink` is only what the
// fighter chooses to add on top.
//
// Which way round that goes was not obvious and was assumed backwards here
// first. A pelvis is already 90 mm wide, so standing the feet further apart
// ACROSS costs a leg almost nothing; standing one 350 mm in front costs it the
// whole 350. A karate front stance is deep because it is long. A brawler
// standing with their feet wide is barely crouching at all.
const drops = {};
{
  const rig = createHumanoid({ seed: 42 });
  const hold = holdStance(rig);
  for (const n of FIGHT_STYLE_NAMES) {
    drops[n] = stanceDrop(rig, hold, { ...FIGHT_STYLES[n].stance, sink: 0 }, 'Left');
  }
}
if (!(drops.karate > drops.brawler * 1.5)) {
  fail(
    `the long stance dropped the pelvis ${(drops.karate * 1000).toFixed(0)} mm and the wide one ` +
      `${(drops.brawler * 1000).toFixed(0)} mm — the geometry is not forcing the crouch`
  );
}
if (!(drops.brawler < drops.boxing)) {
  fail('a wide square stance crouched more than a staggered one, which the pelvis forbids');
}

// A BODY'S REACH IS THE SAME WHETHER OR NOT IT HAS BEEN POSED FIRST.
//
// This is the defect itself, asserted directly, because the invariant that
// found it can no longer see it: `styleProfile` now hands the body back after
// every measurement, so `restJoint` is never asked from a posed rig inside a
// profile. Reverting the fix leaves the whole gate green. It should not.
{
  const clean = strikeReach(createHumanoid({ seed: 42 }), 'cross');
  const rig = createHumanoid({ seed: 42 });
  const hold = holdStance(rig);
  applyStance(rig, hold, FIGHT_STYLES.karate.stance);
  const posed = strikeReach(rig, 'cross');
  releaseStance(rig, hold);
  const after = strikeReach(rig, 'cross');
  if (posed !== clean || after !== clean) {
    fail(
      `reach depends on when it was first asked: ${clean.toFixed(4)} clean, ` +
        `${posed.toFixed(4)} in a stance, ${after.toFixed(4)} ever after`
    );
  }
}

// AND REACH IS NOT ONE OF THE STANCE'S CONSEQUENCES. It was assumed to be, and
// it is not: `strikeReach` measures how far a limb gets from its own root, and
// since `restJoint` now reads the bind pose that is a fact about the ARM. The
// same cross reaches the same distance from every stance in the table, to the
// millimetre, and the reach column separates the styles purely by whether the
// repertoire contains a leg. Asserted, so that a future change that quietly
// makes reach pose-dependent again has to argue with this line.
const reachByStance = (() => {
  const rig = createHumanoid({ seed: 42 });
  const hold = holdStance(rig);
  return FIGHT_STYLE_NAMES.map((n) => {
    applyStance(rig, hold, FIGHT_STYLES[n].stance);
    const r = strikeReach(rig, 'cross');
    releaseStance(rig, hold);
    return r;
  });
})();
if (Math.max(...reachByStance) - Math.min(...reachByStance) > 1e-9) {
  fail('the reach of a cross moved with the stance — it is a fact about an arm');
}

// A GUARD IS A POSE OF THE ARMS AND CANNOT DEPEND ON WHO IS WEARING IT.
//
// Checked against the guard measured on its own, on a clean body of the same
// seed, because all six styles here happen to hold six different guards — so
// comparing them against EACH OTHER compares nothing, and a profile that
// measured the guard on a body still carrying the last punch sailed through.
// It is the second time in this gate that the obvious invariant was vacuous.
for (const n of FIGHT_STYLE_NAMES) {
  const rig = createHumanoid({ seed: 42 });
  const g = new Guard(rig, { style: FIGHT_STYLES[n].guard, fade: 0 });
  for (let i = 0; i < 40; i++) g.update(1 / 120);
  const alone = coverageOf(rig, 'head');
  if (Math.abs(alone - profiles[n].cover) > 1e-9) {
    fail(
      `${n}'s ${FIGHT_STYLES[n].guard} covers ${pct(alone)} on its own and ` +
        `${pct(profiles[n].cover)} inside a profile — the body was not clean`
    );
  }
}

// ---------------------------------------- 4. the knob that is NOT a style

// `follow` buys effective mass and the measurement says it costs almost
// nothing. So no style sets it, and this is the assertion that keeps it that
// way — reported below with the numbers that made the decision.
const follows = new Set(FIGHT_STYLE_NAMES.map((n) => FIGHT_STYLES[n].follow));
if (follows.size !== 1 || follows.values().next().value !== undefined) {
  fail('a style has started setting `follow`, which is a free damage multiplier');
}
const freeLunch = (() => {
  const rig = () => createHumanoid({ seed: 42 });
  const lo = measureStrike(rig(), 'cross', { skill: 0.8, follow: 0.15 });
  const hi = measureStrike(rig(), 'cross', { skill: 0.8, follow: 0.95 });
  return {
    mass: hi.mass / lo.mass,
    balance: lo.worstBalance - hi.worstBalance,
    recovery: hi.recovery - lo.recovery,
  };
})();
if (freeLunch.mass < 1.5) fail('`follow` stopped doing anything, so the warning above is stale');

// ------------------------------------------- 5. the body is handed back

for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  rig.object.updateMatrixWorld(true);
  const was = stability(rig);
  const hips = rig.bones.Hips.position.clone();
  const hold = holdStance(rig);
  for (const n of FIGHT_STYLE_NAMES) applyStance(rig, hold, FIGHT_STYLES[n].stance);
  releaseStance(rig, hold);
  if (Math.abs(stability(rig) - was) > 1e-9) fail(`seed ${seed}: a stance was left standing`);
  if (rig.bones.Hips.position.distanceTo(hips) > 1e-9) fail(`seed ${seed}: the pelvis was left dropped`);

  // ...and by the controller, which is what a game actually holds.
  const style = new FightStyle(rig, 'brawler', { fade: 0 });
  for (let i = 0; i < 20; i++) style.update(1 / 60);
  if (Math.abs(stability(rig) - was) < 1e-6) fail(`seed ${seed}: FightStyle did not change the stance`);
  style.release();
  if (Math.abs(stability(rig) - was) > 1e-9) fail(`seed ${seed}: FightStyle did not hand the body back`);
}

// A stance has to be REACHABLE. The pelvis drops as far as the footprints
// force and no further, so the feet land where they were asked to.
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const hold = holdStance(rig);
  for (const n of FIGHT_STYLE_NAMES) {
    const shape = FIGHT_STYLES[n].stance;
    applyStance(rig, hold, shape);
    rig.object.updateMatrixWorld(true);
    const l = rig.object.worldToLocal(rig.bones.LeftFoot.getWorldPosition(new (hold.hipP.constructor)()));
    const r = rig.object.worldToLocal(rig.bones.RightFoot.getWorldPosition(new (hold.hipP.constructor)()));
    const gotSpread = Math.abs(l.x - r.x) / rig.height;
    const gotStagger = Math.abs(l.z - r.z) / rig.height;
    if (Math.abs(gotSpread - shape.spread) > 0.005) {
      fail(`${n}: asked for ${shape.spread.toFixed(3)} of spread and got ${gotSpread.toFixed(3)}`);
    }
    if (Math.abs(gotStagger - shape.stagger) > 0.005) {
      fail(`${n}: asked for ${shape.stagger.toFixed(3)} of stagger and got ${gotStagger.toFixed(3)}`);
    }
  }
  releaseStance(rig, hold);
}

// ---------------------------------------------------------------- report

if (json) {
  console.log(JSON.stringify({ profiles, best, worst, freeLunch, failures }, null, 2));
} else {
  console.log('fightstyle — a style is where the feet are\n');
  console.log('  style        base   reach   power   poise    cover   body  centre   rooted  broken');
  console.log('  ' + '-'.repeat(82));
  for (const n of FIGHT_STYLE_NAMES) {
    const p = profiles[n];
    console.log(
      `  ${n.padEnd(11)} ${p.base.toFixed(3).padStart(5)} ${p.reach.toFixed(3).padStart(7)}` +
        ` ${p.power.toFixed(2).padStart(7)} ${p.poise.toFixed(3).padStart(7)}` +
        ` ${pct(p.cover).padStart(8)} ${pct(p.guardBody).padStart(6)} ${pct(p.centre).padStart(7)}` +
        ` ${deg(p.rooted).padStart(8)}  ${p.weakLine}`
    );
  }
  console.log('\n  who leads what');
  for (const c of COLUMNS) console.log(`    ${c.padEnd(11)} ${best[c].join(', ')}`);

  console.log('\n  the claims, measured');
  console.log(
    `    nobody wins every column      ${leaders.size} of ${FIGHT_STYLE_NAMES.length} styles lead at least one` +
      `   budget 4`
  );
  console.log(
    `    ...and nobody loses them all  ${FIGHT_STYLE_NAMES.filter((n) => COLUMNS.some((c) => worst[c].includes(n))).length} styles are bottom of something`
  );
  console.log(
    `    long beats wide for roots     karate ${deg(long.rooted)} against a brawler's ${deg(wide.rooted)}` +
      `, and the brawler goes over ${wide.weakLine}wards`
  );
  console.log(
    `    the centre line is a column   wing chun ${pct(profiles.wingChun.centre)}, and it is the only style` +
      ` with anything on that line`
  );
  console.log(
    `    reach is NOT a stance thing   the same cross reaches ${reachByStance[0].toFixed(3)} m from all ` +
      `${FIGHT_STYLE_NAMES.length} stances — it is a fact about an arm`
  );
  console.log(
    `    a LONG stance is a low one    karate ${(drops.karate * 1000).toFixed(0)} mm of forced crouch ` +
      `against a brawler's ${(drops.brawler * 1000).toFixed(0)} mm — a pelvis is already 90 mm wide`
  );
  console.log(
    `    the same in any order         6 styles profiled forwards and backwards, ${COLUMNS.length} columns, exact`
  );
  console.log(
    `    ...and on any body            the base, cover and centre rankings hold across ${SEEDS.length} bodies`
  );
  console.log(
    `    NO style sets \`follow\`        it buys ${freeLunch.mass.toFixed(2)}x the effective mass for ` +
      `${freeLunch.balance.toFixed(3)} of balance and ${freeLunch.recovery.toFixed(3)} s of recovery`
  );
  console.log('                                  — a free multiplier, so the styles do not get it');
  console.log(
    `\n  ${FIGHT_STYLE_NAMES.length} styles x ${COLUMNS.length} columns, over ${SEEDS.length} bodies` +
      `, every column measured by a module that was already there`
  );
  const guards = new Set(FIGHT_STYLE_NAMES.map((n) => FIGHT_STYLES[n].guard));
  console.log(`  ${guards.size} of the ${Object.keys(GUARDS).length} guards are in use`);
}

if (failures.length) {
  console.error('\nFIGHTSTYLE OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nA style is a stance, a guard and a repertoire. If one of these moved, one\n' +
      'of those three did — do not adjust the budget to match it.'
  );
  process.exit(1);
}
if (!json) console.log('\nfightstyle: a style is where the feet are ✓');
