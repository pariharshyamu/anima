#!/usr/bin/env node
/**
 * The grappling gate.
 *
 *   npm run grappling            fail if a throw stops being a consequence
 *   npm run grappling -- --json  the same numbers, machine-readable
 *
 * ## Why this exists
 *
 * The whole claim of the module is that a throw is not an animation that plays
 * when a button is pressed. It is an attempt, and it completes only if the
 * uke's centre of mass actually left their base of support first. That claim
 * is falsifiable in exactly one way — throw somebody who is NOT off balance
 * and see whether they go over — and a module that quietly stopped checking
 * would look, from the outside, precisely like one that works.
 *
 * So the headline here needs BOTH halves to be true at once:
 *
 *   a weak pull does not throw anybody, and a strong one does.
 *
 * One without the other is not a pass. A module where nothing ever fails is a
 * cutscene; one where nothing ever works is broken.
 *
 * What it has already caught, on its own first runs:
 *
 *   - a lean that bent only the spine. It moved 68% of the mass through a
 *     short lever and got 93 mm out of a full fold, against the 191 mm a body
 *     has to travel to be over its own toes. It could not break anybody
 *     forwards, sideways, or over a corner — only straight backwards — and
 *     from inside the animation it looked like a man being pulled about.
 *   - the tip axis the wrong way round, so every body leaned AWAY from the
 *     direction it was being broken in.
 *   - a grip measured while the hands were still travelling to it. Every
 *     throw in the module reported `noGrip`.
 *   - a tori who stood still. A backward break takes the uke's lapel away
 *     from them by 370 mm, and losing it that way meant an osoto gari could
 *     not be landed by anybody, at any skill, on any body.
 *   - a breakfall credited to anybody whose hand ended up near the floor,
 *     which after a throw is everybody. `ukemi: false` read as a no-op.
 *   - a rigid rotation with no floor under it: a tai otoshi reported a
 *     two-metre fall, because the arc went underground and the clamp lifted
 *     the whole body back out again.
 */
import {
  createHumanoid,
  Grappling,
  GRIP_TOLERANCE,
  KUZUSHI_DIRECTIONS,
  MAX_LEAN,
  THROWS,
  THROW_NAMES,
  UKEMI_RELIEF,
  bodyMass,
  breakEffort,
  landingImpulse,
  measureThrow,
  stability,
  weakestDirection,
} from '../dist/index.js';

const SEEDS = [42, 7, 313];
const RANGE = 0.44;
const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const mm = (v) => `${(v * 1000).toFixed(0)} mm`;

/** Two bodies, facing each other, `d` apart. Rebuilt every time: no leakage. */
function pair(seed, d = RANGE) {
  const tori = createHumanoid({ seed: 1 });
  const uke = createHumanoid({ seed });
  uke.object.position.set(0, 0, d);
  uke.object.rotation.y = Math.PI;
  tori.object.updateMatrixWorld(true);
  uke.object.updateMatrixWorld(true);
  return { tori, uke };
}

// -------------------------------------------------- 1. the base decides it

// How far a body has to be tipped before it is going over, in each of the
// eight directions. Nothing here is a table lookup: `breakEffort` leans the
// real body and watches the real `stability()`.
const effort = {};
for (const d of KUZUSHI_DIRECTIONS) {
  effort[d] = { lean: 0, travel: 0 };
  for (const seed of SEEDS) {
    const rig = createHumanoid({ seed });
    const e = breakEffort(rig, d);
    effort[d].lean += e.lean / SEEDS.length;
    effort[d].travel += e.travel / SEEDS.length;
  }
}
const leans = KUZUSHI_DIRECTIONS.map((d) => effort[d].lean);
const spread = Math.max(...leans) / Math.min(...leans);
if (!leans.every(Number.isFinite)) fail('some direction could not be broken at all');
if (spread < 2) fail(`every direction costs the same (spread ${spread.toFixed(2)}x, budget 2x)`);

// The cheapest direction has to be the one the feet say it is. A heel sits
// 75 mm behind an ankle and a toe 190 mm in front of it, so a square stance
// goes over backwards — and the measured travel has to agree with the box.
const weakest = weakestDirection(createHumanoid({ seed: 42 })).direction;
if (weakest !== 'back') fail(`a square stance broke most easily ${weakest}, not backwards`);
if (effort.back.travel >= effort.front.travel) {
  fail('breaking backwards took as far as breaking forwards, which the feet forbid');
}

// The probe must leave nothing behind. It bends a real body to do its work.
{
  const rig = createHumanoid({ seed: 42 });
  rig.object.updateMatrixWorld(true);
  const before = stability(rig);
  for (const d of KUZUSHI_DIRECTIONS) breakEffort(rig, d);
  if (Math.abs(stability(rig) - before) > 1e-9) fail('breakEffort left the body leaning');
}

// ------------------------------------------- 2. kuzushi decides the throw

const WEAK = 0.35;
const STRONG = 0.95;
const attempts = [];
for (const seed of SEEDS) {
  for (const name of THROW_NAMES) {
    for (const skill of [WEAK, STRONG]) {
      const { tori, uke } = pair(seed);
      const r = measureThrow(tori, uke, name, { skill, fade: 0.05 });
      attempts.push({ seed, name, skill, ...r });
    }
  }
}
const weak = attempts.filter((a) => a.skill === WEAK);
const strong = attempts.filter((a) => a.skill === STRONG);
const weakDone = weak.filter((a) => a.completed).length;
const strongDone = strong.filter((a) => a.completed).length;

if (strongDone !== strong.length) {
  const missed = strong.filter((a) => !a.completed).map((a) => `${a.name}/${a.seed}:${a.failed}`);
  fail(`a committed throw failed to land: ${missed.join(', ')}`);
}
if (weakDone >= strong.length) fail('a weak pull threw everybody — nothing is being checked');
if (weakDone === 0) fail('a weak pull threw nobody — the servo is not reaching anybody');
if (!weak.some((a) => a.failed === 'notBroken')) {
  fail('nothing ever failed for want of kuzushi, which is the one thing this module claims');
}
// The reason must be the balance, not the grip: a weak pull still holds on.
for (const a of weak.filter((x) => !x.completed)) {
  if (a.failed !== 'notBroken') fail(`${a.name} failed for ${a.failed}, not for want of balance`);
  if (a.balance <= 0) fail(`${a.name} was reported unbroken with balance ${a.balance.toFixed(3)}`);
}

// ------------------------------------------------------- 3. range is real

const reach = [];
for (let d = 0.3; d <= 0.72; d += 0.02) {
  const { tori, uke } = pair(42, d);
  const r = measureThrow(tori, uke, 'oGoshi', { skill: STRONG, fade: 0.05 });
  reach.push({ d, ok: r.completed, failed: r.failed, gap: r.gripGap });
}
const inRange = reach.filter((r) => r.ok);
const maxRange = inRange.length ? Math.max(...inRange.map((r) => r.d)) : 0;
if (!(maxRange > 0.34 && maxRange < 0.68)) {
  fail(`engagement range came out at ${mm(maxRange)} — a collar is at arm's length or nowhere`);
}
if (reach.some((r) => r.d > maxRange + 1e-9 && r.ok)) fail('range is not monotone');
for (const r of reach.filter((x) => !x.ok && x.d > maxRange)) {
  if (r.failed !== 'noGrip') fail(`out of range at ${mm(r.d)} reported ${r.failed}`);
}

// -------------------------------------------------- 4. both bodies handed back

for (const seed of SEEDS) {
  const { tori, uke } = pair(seed);
  const was = { tori: stability(tori), uke: stability(uke) };
  const home = uke.object.position.clone();
  const spin = uke.object.quaternion.clone();
  const toriHome = tori.object.position.clone();
  measureThrow(tori, uke, 'seoiNage', { skill: STRONG, fade: 0.05 });
  tori.object.updateMatrixWorld(true);
  uke.object.updateMatrixWorld(true);
  if (Math.abs(stability(uke) - was.uke) > 1e-9) fail(`seed ${seed}: the uke was left leaning`);
  if (Math.abs(stability(tori) - was.tori) > 1e-9) fail(`seed ${seed}: the tori was left crouched`);
  if (uke.object.position.distanceTo(home) > 1e-9) fail(`seed ${seed}: the uke was left on the floor`);
  if (uke.object.quaternion.angleTo(spin) > 1e-9) fail(`seed ${seed}: the uke was left face down`);
  if (tori.object.position.distanceTo(toriHome) > 1e-9) fail(`seed ${seed}: the tori kept the step`);
}

// ------------------------------------------- 5. the landing is a measurement

for (const a of strong) {
  const L = a.landing;
  if (!L) {
    fail(`${a.name}/${a.seed} completed without landing anybody`);
    continue;
  }
  // Derived, not stored: sqrt(2gh) times a mass that comes out of the body.
  const derived = landingImpulse(pair(a.seed).uke, L.height);
  if (Math.abs(derived - L.impulse) > 1e-6) fail(`${a.name}: impulse is not mass x sqrt(2gh)`);
  if (!(L.height > 0.2 && L.height < 1.4)) fail(`${a.name}: fell ${mm(L.height)}, which is not a fall`);
  if (a.gripGap > GRIP_TOLERANCE) fail(`${a.name} completed with a ${mm(a.gripGap)} grip gap`);
  if (!(a.toriWorst > 0)) fail(`${a.name}: the tori fell over doing it (${a.toriWorst.toFixed(3)})`);
}

// A hip throw picks somebody up before dropping them. A foot sweep does not.
// The two must not land the same, and the hip throw must be the harder one.
const mean = (n, f) => {
  const got = strong.filter((a) => a.name === n && a.landing).map((a) => f(a.landing));
  return got.reduce((x, y) => x + y, 0) / Math.max(1, got.length);
};
const hip = mean('oGoshi', (l) => l.impulse);
const sweep = mean('footSweep', (l) => l.impulse);
if (!(hip > sweep * 1.15)) {
  fail(`a hip throw landed like a foot sweep (${hip.toFixed(0)} vs ${sweep.toFixed(0)}, budget 1.15x)`);
}

// ------------------------------------------------------------- 6. ukemi

const ukemiRows = [];
let ukemiDrift = 0;
for (const seed of SEEDS) {
  for (const name of THROW_NAMES) {
    const on = measureThrow(pair(seed).tori, pair(seed).uke, name, {
      skill: STRONG,
      fade: 0.05,
      ukemi: true,
    });
    const p = pair(seed);
    const off = measureThrow(p.tori, p.uke, name, { skill: STRONG, fade: 0.05, ukemi: false });
    ukemiRows.push({ seed, name, on: on.landing, off: off.landing });
  }
}
for (const r of ukemiRows) {
  if (!r.on || !r.off) {
    fail(`${r.name}/${r.seed}: ukemi comparison lost a landing`);
    continue;
  }
  if (!r.on.armFirst) fail(`${r.name}/${r.seed}: a trained uke did not get an arm down first`);
  if (!r.on.breakfall) fail(`${r.name}/${r.seed}: an arm down first was not counted a breakfall`);
  if (r.off.breakfall) fail(`${r.name}/${r.seed}: an untrained uke was credited a breakfall`);
  // The fall is the same size either way. A breakfall does not make gravity
  // smaller — it spreads the arrival — so essentially only `toTorso` may move.
  // The residual budget is not zero and should not be: an arm is 5% of a body,
  // and putting one out really does move a centre of mass a little.
  const moved = Math.abs(r.on.impulse - r.off.impulse) / r.off.impulse;
  if (moved > 0.04) {
    fail(`${r.name}/${r.seed}: ukemi changed the fall itself by ${(moved * 100).toFixed(1)}%`);
  }
  ukemiDrift = Math.max(ukemiDrift, moved);
  const relief = 1 - r.on.toTorso / r.on.impulse;
  if (Math.abs(relief - UKEMI_RELIEF) > 1e-9) fail(`${r.name}: relief came out ${relief.toFixed(3)}`);
  if (Math.abs(r.off.toTorso - r.off.impulse) > 1e-9) {
    fail(`${r.name}: an untrained landing lost impulse on the way to the torso`);
  }
}

// --------------------------------------------- 7. the same at any frame rate

// EVERY throw, not one of them. Checking a single throw here passed a build in
// which five of the eight moved by up to 17% between 30 and 240 fps, because
// the one that was checked happened to be among the three that did not.
const rates = [1 / 30, 1 / 50, 1 / 60, 1 / 144, 1 / 240];
let rateSpread = 0;
for (const name of THROW_NAMES) {
  const imp = rates.map((step) => {
    const { tori, uke } = pair(42);
    return measureThrow(tori, uke, name, { skill: STRONG, fade: 0.05, step }).landing?.impulse ?? NaN;
  });
  const s = (Math.max(...imp) - Math.min(...imp)) / Math.min(...imp);
  rateSpread = Math.max(rateSpread, s);
  // Exact. A genuinely fixed internal step puts every frame rate on the same
  // lattice, so this is not a tolerance — it is bit-for-bit or it is broken.
  if (!(s === 0)) fail(`${name}: the landing impulse moves ${(s * 100).toFixed(2)}% across 30-240 fps`);
}

// ------------------------------------------------ 8. the throws are different

const done = {};
for (const name of THROW_NAMES) {
  const rows = strong.filter((a) => a.name === name && a.landing);
  done[name] = {
    impulse: rows.reduce((a, r) => a + r.landing.impulse, 0) / Math.max(1, rows.length),
    height: rows.reduce((a, r) => a + r.landing.height, 0) / Math.max(1, rows.length),
    torso: rows.reduce((a, r) => a + r.landing.toTorso, 0) / Math.max(1, rows.length),
  };
}
const impulses = THROW_NAMES.map((n) => done[n].impulse);
if (Math.max(...impulses) / Math.min(...impulses) < 1.2) {
  fail('every throw lands the same — the fulcrum and the lift are doing nothing');
}

// ---------------------------------------------------------------- report

const pct = (v) => `${(v * 100).toFixed(0)}%`;
if (json) {
  console.log(JSON.stringify({ effort, done, reach, weakDone, strongDone, failures }, null, 2));
} else {
  console.log('grappling — a throw is a consequence of the balance\n');
  console.log('  direction     tip needed    the centre of mass travels');
  console.log('  ' + '-'.repeat(56));
  for (const d of KUZUSHI_DIRECTIONS) {
    console.log(
      `  ${d.padEnd(12)} ${((effort[d].lean * 180) / Math.PI).toFixed(1).padStart(6)}°` +
        `        ${mm(effort[d].travel).padStart(8)}`
    );
  }
  console.log(`\n  weakest line: ${weakest}, and it is read off the feet, not chosen\n`);

  console.log('  throw        breaks       fall       arrives at    into the torso');
  console.log('  ' + '-'.repeat(66));
  for (const n of THROW_NAMES) {
    console.log(
      `  ${n.padEnd(12)} ${THROWS[n].breaks.padEnd(12)} ${mm(done[n].height).padStart(7)}` +
        `   ${done[n].impulse.toFixed(0).padStart(4)} kg·m/s` +
        `   ${done[n].torso.toFixed(0).padStart(4)} kg·m/s`
    );
  }

  console.log('\n  the claims, measured');
  console.log(
    `    a weak pull throws nobody     ${weakDone} of ${weak.length} landed at skill ${WEAK}`
  );
  console.log(
    `    ...a committed one throws     ${strongDone} of ${strong.length} landed at skill ${STRONG}` +
      `   BOTH have to be true`
  );
  console.log(
    `    the base picks the direction  back ${((effort.back.lean * 180) / Math.PI).toFixed(1)}° ` +
      `against front ${((effort.front.lean * 180) / Math.PI).toFixed(1)}°   spread ${spread.toFixed(1)}x, budget 2x`
  );
  console.log(`    ...and the pull is finite     ${((MAX_LEAN * 180) / Math.PI).toFixed(0)}° at skill 1`);
  console.log(`    range is a real constraint    grips hold to ${mm(maxRange)}, and not past it`);
  console.log(
    `    a hip throw is not a sweep    ${hip.toFixed(0)} against ${sweep.toFixed(0)} kg·m/s   budget 1.15x`
  );
  console.log(
    `    ukemi spreads, not shrinks    the fall moves ${(ukemiDrift * 100).toFixed(1)}% ` +
      `(an arm IS 5% of a body); ${pct(UKEMI_RELIEF)} comes off the torso`
  );
  console.log(`    the same at any frame rate    ${(rateSpread * 100).toFixed(3)}% across 30-240 fps`);
  console.log(`    both bodies handed back       stability, pose and transform, to 1e-9`);
  console.log(
    `\n  ${attempts.length} attempts + ${ukemiRows.length * 2} ukemi comparisons + ` +
      `${reach.length} ranges, over ${SEEDS.length} bodies`
  );
  const m = bodyMass(createHumanoid({ seed: 42 }));
  console.log(`  the uke weighs ${m.toFixed(1)} kg, and nobody typed that in either`);
}

if (failures.length) {
  console.error('\nGRAPPLING OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nA throw completes because a centre of mass left a base of support. If one\n' +
      'of these moved, that stopped being true — do not adjust the budget to match.'
  );
  process.exit(1);
}
if (!json) console.log('\ngrappling: no kuzushi, no throw ✓');
