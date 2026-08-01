#!/usr/bin/env node
/**
 * The guard gate.
 *
 *   npm run guard            fail if defence stops being geometry
 *   npm run guard -- --json  the same numbers, machine-readable
 *
 * ## Why this exists
 *
 * There is no block chance in this module and there is nowhere one could be
 * added. Whether a strike arrives is decided by two measurements: whether a
 * limb was on the line it came in on, and whether the strike was slower than
 * the defender's reaction. Both are quantities, so both can drift quietly, and
 * a defence system that quietly stops working looks exactly like one that
 * works.
 *
 * What it has already caught, on its own first runs:
 *
 *   - limb capsules nearly four times too thick. Every guard in the table
 *     covered 100% of everything, including one with its hands by its sides,
 *     and the module read as if it were working.
 *   - the leg zone taken as the midpoint BETWEEN the knees — a point inside
 *     the body, which both legs occlude every line to. 100% leg coverage for
 *     everybody, for the same reason.
 *   - directions sampled over the whole forward hemisphere, including straight
 *     down onto the crown and straight up off the floor. Nothing strikes from
 *     there, and averaging them in diluted every guard toward the same number.
 */
import {
  createHumanoid,
  Guard,
  GUARDS,
  GUARD_NAMES,
  GUARD_ZONES,
  Striking,
  SIMPLE_REACTION,
  CHOICE_REACTION,
  STRIKE_NAMES,
  STRIKES,
  canReactTo,
  coverageOf,
  reactionTime,
} from '../dist/index.js';

const SEEDS = [1, 5, 42];
const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

// ------------------------------------------------------------------ cover

const cover = {};
for (const name of GUARD_NAMES) {
  cover[name] = { head: 0, body: 0, legs: 0 };
  for (const seed of SEEDS) {
    const rig = createHumanoid({ seed });
    const g = new Guard(rig, { style: name, fade: 0 });
    for (let i = 0; i < 40; i++) g.update(1 / 120);
    for (const z of GUARD_ZONES) cover[name][z] += coverageOf(rig, z) / SEEDS.length;
    g.lower();
    for (let i = 0; i < 40; i++) g.update(1 / 120);
  }
}

// 1. Nothing is outside 0..1, and a guard with its hands down covers the head
//    with essentially nothing. A coverage model that flatters `open` is
//    measuring the body rather than the guard.
for (const name of GUARD_NAMES) {
  for (const z of GUARD_ZONES) {
    const v = cover[name][z];
    if (v < 0 || v > 1) fail(`${name}/${z}: coverage ${v} outside 0..1`);
  }
}
if (cover.open.head > 0.08) {
  fail(`hands down still covers ${pct(cover.open.head)} of the head, over 8%`);
}

// 2. THE claim: guards are different SHAPES and the difference is measured.
//    A cross-arm buries the head; a low guard gives it away and takes the body
//    instead. Equal numbers would mean `style` is a field nobody reads.
if (cover.crossArm.head < cover.lowGuard.head * 3) {
  fail(
    `a cross-arm covers ${pct(cover.crossArm.head)} of the head against a low ` +
      `guard's ${pct(cover.lowGuard.head)} — under 3x`
  );
}
if (cover.lowGuard.body <= cover.peekaboo.body) {
  fail(
    `a low guard covers ${pct(cover.lowGuard.body)} of the body, no more than ` +
      `a peekaboo's ${pct(cover.peekaboo.body)} — the trade has stopped existing`
  );
}

// 3. No posture covers the legs. That is not a hole in the model: a low kick
//    is answered by an ACTION — lifting the shin into it — and no boxing guard
//    has ever had a leg in it. Gated so that if some future guard starts
//    claiming leg cover, somebody has to justify it.
const legSpread =
  Math.max(...GUARD_NAMES.map((n) => cover[n].legs)) -
  Math.min(...GUARD_NAMES.map((n) => cover[n].legs));
if (legSpread > 0.02) {
  fail(`guards differ by ${pct(legSpread)} on leg cover — a posture is claiming to check`);
}

// ---------------------------------------------------------------- reaction

// 4. Reaction is a race, and the jab wins it against everybody. This is the
//    whole reason the jab exists and it comes out of two numbers measured for
//    other reasons: the strike's wind-up and human reaction time.
if (canReactTo('jab', 1)) fail('an expert reacts to a jab — the wind-up is 130 ms');
if (!canReactTo('roundhouse', 1)) fail('an expert cannot react to a 260 ms roundhouse');
if (canReactTo('roundhouse', 0)) fail('a novice reacts to a roundhouse');
if (reactionTime(0) <= reactionTime(1)) fail('skill does not buy reaction time');
if (Math.abs(reactionTime(1) - SIMPLE_REACTION) > 1e-9) {
  fail('an expert does not converge on simple reaction time');
}
if (Math.abs(reactionTime(0) - CHOICE_REACTION) > 1e-9) {
  fail('a novice does not pay full choice reaction time');
}
const unreactable = STRIKE_NAMES.filter((n) => !canReactTo(n, 1));
const reactable = STRIKE_NAMES.filter((n) => canReactTo(n, 1));
if (!unreactable.length || !reactable.length) {
  fail('reaction divides the strikes into one bucket — it is deciding nothing');
}

// ------------------------------------------------------------- the defence

function duel(guardName, strike, skill, active) {
  const atk = createHumanoid({ seed: 5 });
  const def = createHumanoid({ seed: 5 });
  def.object.position.set(0, 0, 0.62);
  def.object.rotation.y = Math.PI;
  def.object.updateMatrixWorld(true);
  atk.object.updateMatrixWorld(true);
  const guard = new Guard(def, { style: guardName, fade: 0, skill });
  for (let i = 0; i < 40; i++) guard.update(1 / 120);
  const striker = new Striking(atk, { target: def.bones.Head, fade: 0, skill: 0.8 });
  let out = null;
  let thrown = null;
  striker.onBlow((b) => {
    thrown = b;
    out = guard.defend(b);
  });
  // The defender reacts when they SEE it, not when it is declared. Triggering
  // the slip at the moment the punch started had it finished and put away
  // before the punch landed, which is both what the gate said and what would
  // happen to somebody who slipped 260 ms early.
  striker.throwStrike(strike);
  let t = 0;
  let fired = false;
  for (let i = 0; i < 400 && !out; i++) {
    striker.update(1 / 120);
    guard.update(1 / 120);
    t += 1 / 120;
    if (active && !fired && t >= guard.reaction) {
      fired = true;
      guard.react(strike, active);
    }
  }
  return { defence: out, blow: thrown };
}

const duels = [];
for (const name of GUARD_NAMES) {
  for (const strike of ['jab', 'cross', 'hook', 'roundhouse']) {
    const r = duel(name, strike, 0.8, null);
    if (!r.defence) {
      fail(`${name} vs ${strike}: no blow was ever thrown`);
      continue;
    }
    duels.push({ guard: name, strike, ...r.defence, impulse: r.blow.impulse });
  }
}

// 5. Both things must happen. A defence system where everything lands is not
//    a defence system, and one where nothing does is worse.
const stopped = duels.filter((d) => d.stopped).length;
if (stopped === 0) fail('nothing was ever stopped');
if (stopped === duels.length) fail('everything was stopped');

// 6. What is stopped goes into the ARM and what is not goes through, and the
//    two add up to what was thrown. Impulse does not evaporate.
for (const d of duels) {
  const sum = d.through + d.absorbed;
  if (Math.abs(sum - d.impulse) > 1e-6) {
    fail(`${d.guard} vs ${d.strike}: ${sum.toFixed(2)} accounted for of ${d.impulse.toFixed(2)}`);
  }
  if (d.stopped && d.through > d.impulse * 0.25) {
    fail(`${d.guard} vs ${d.strike}: "stopped" but ${pct(d.through / d.impulse)} got through`);
  }
  if (!d.stopped && d.absorbed > 0) {
    fail(`${d.guard} vs ${d.strike}: not stopped but ${d.absorbed.toFixed(1)} absorbed`);
  }
}

// 7. The guard that covers the head stops the head shot and the one that does
//    not, does not. Named, because a defence that is right on average and
//    wrong on the specific case is a coincidence.
const at = (g, s) => duels.find((d) => d.guard === g && d.strike === s);
if (!at('peekaboo', 'cross').stopped) fail('a peekaboo did not stop a cross to the head');
if (at('lowGuard', 'cross').stopped) fail('a low guard stopped a cross to the head');
if (!at('crossArm', 'hook').stopped) fail('a cross-arm did not stop a hook');

// 8. A slip is not a block: it moves, so nothing is absorbed AND nothing
//    arrives. Only available when there was time.
const slipped = duel('peekaboo', 'roundhouse', 1, 'slip');
if (!slipped.defence.stopped || slipped.defence.absorbed !== 0) {
  fail('a slip did not avoid a roundhouse cleanly');
}
const cannot = duel('peekaboo', 'jab', 1, 'slip');
if (cannot.defence.reacted) fail('a jab was slipped, which nobody has ever done');

// ------------------------------------------------------------------ report

if (json) {
  console.log(JSON.stringify({ cover, duels, failures }, null, 2));
} else {
  console.log('guard — coverage measured off the pose, reaction raced against the wind-up\n');
  console.log('  guard          head     body     legs    label');
  console.log('  ' + '-'.repeat(62));
  for (const n of GUARD_NAMES) {
    console.log(
      `  ${n.padEnd(12)} ${pct(cover[n].head).padStart(6)}  ${pct(cover[n].body).padStart(6)}  ` +
        `${pct(cover[n].legs).padStart(6)}   ${GUARDS[n].label}`
    );
  }
  console.log('\n  the claims, measured');
  console.log(
    `    the guards are different      cross-arm ${pct(cover.crossArm.head)} of the head ` +
      `against a low guard's ${pct(cover.lowGuard.head)}   budget 3x`
  );
  console.log(
    `    ...and it is a TRADE          a low guard takes ${pct(cover.lowGuard.body)} of the body ` +
      `where a peekaboo takes ${pct(cover.peekaboo.body)}`
  );
  console.log(
    `    hands down covers nothing     ${pct(cover.open.head)} of the head   budget 8%`
  );
  console.log(
    `    no posture covers the legs    ${pct(legSpread)} apart — a check is an ACTION, not a stance`
  );
  console.log(
    `    reaction is a race            novice ${(reactionTime(0) * 1000).toFixed(0)} ms, ` +
      `expert ${(reactionTime(1) * 1000).toFixed(0)} ms`
  );
  console.log(`    ...nobody reacts to           ${unreactable.join(', ')}`);
  console.log(`    ...an expert reacts to        ${reactable.join(', ')}`);
  console.log(
    `    strikes stopped               ${stopped} of ${duels.length}  ` +
      `(both numbers have to be non-zero)`
  );
  console.log(`\n  ${duels.length} exchanges — ${GUARD_NAMES.length} guards x 4 strikes`);
}

if (failures.length) {
  console.error('\nGUARD OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nCoverage is a measurement of a pose. If one of these moved, the pose\n' +
      'moved — do not adjust the budget to match it.'
  );
  process.exit(1);
}
if (!json) console.log('\nguard: what it covers is where the arms are ✓');
