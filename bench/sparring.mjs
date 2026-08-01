#!/usr/bin/env node
/**
 * The sparring gate — the twelfth, and the one the whole fighting track was
 * built to make possible.
 *
 *   npm run sparring            fail if the tactics stop falling out
 *   npm run sparring -- --json  the same numbers, machine-readable
 *
 * ## Why this exists
 *
 * The decision function in `sparring.ts` reads four numbers and every one of
 * them is a measurement off a real body: how far this limb gets, what the
 * strike costs in balance, whether they can see it coming, and where they are
 * currently open. It does not read height, weight, style, or who should win.
 *
 * The claim is that this is ENOUGH — that a longer fighter beats a shorter one
 * without anybody encoding a reach advantage, because a longer arm measures
 * further and the fighter simply throws what reaches.
 *
 * That is falsifiable, and this is where it gets falsified: run every pair of
 * ten seeded bodies and check whether the reach gap predicts the result. If
 * `strikeReach` stopped depending on limb length, or the choice quietly
 * started reading something it should not, the correlation collapses and this
 * fails — while every unit test in the library still passes.
 *
 * What it has already caught, on its own first runs:
 *
 *   - the DEFENDER'S GUARD being overwritten by the defender's own `Striking`
 *     every frame. `Striking` drives both arms; whoever updates last owns the
 *     hands. Running the guard first meant every fighter defended with their
 *     hands wherever their own last punch left them, and the guard stopped 0
 *     of 83 crosses in a module whose own gate says a peekaboo stops a cross.
 *   - a parry triggered when the strike was DECLARED rather than when it would
 *     have been seen — the exact defect `Guard`'s gate caught in 0.50.0,
 *     reintroduced one release later by a consumer.
 *   - a fighter standing at the edge of their LONGEST reach, so that exactly
 *     one strike in the repertoire was ever available and the bout was 83
 *     identical crosses. A metronome, not a fighter.
 */
import {
  Bout,
  Fighter,
  ANAEROBIC_RESERVE,
  FIGHT_STYLES,
  chooseStrike,
  createHumanoid,
  measureBout,
  bodyMass,
} from '../dist/index.js';

const SEEDS = [1, 5, 7, 12, 42, 99, 313, 777, 1234, 2026];
const json = process.argv.includes('--json');
const failures = [];
let stoppedWorth = 0;
const fail = (l) => failures.push(l);
const mm = (v) => `${(v * 1000).toFixed(0)} mm`;

const make = (seed, style = 'boxing', skill = 0.8) =>
  new Fighter(createHumanoid({ seed }), { style, skill });

// ------------------------------------------- 1. nobody reads anybody's height

// Two fighters whose CARDS are identical and whose heights are not. If the
// choice changes, something is reading a body rather than a measurement.
{
  const tall = make(42);
  const short = make(7);
  const gap = 0.45;
  const pick = chooseStrike(tall, short, gap);
  // Swap the card across, leaving the bodies alone. Same numbers in, same
  // answer out — whatever the two bodies happen to look like.
  const twin = make(7);
  twin.card.length = 0;
  twin.card.push(...tall.card.map((c) => ({ ...c })));
  const same = chooseStrike(twin, short, gap);
  if (!pick || !same || pick.strike !== same.strike || pick.zone !== same.zone) {
    fail(`the choice changed with the body: ${pick?.strike}/${pick?.zone} vs ${same?.strike}/${same?.zone}`);
  }
}

// ---------------------------------------------- 2. nobody throws at thin air

const probe = measureBout(make(42), make(7), { rounds: 3, roundSeconds: 25 });
for (const e of probe.exchanges) {
  if (e.reach < e.gap - 1e-9) {
    fail(`a ${e.strike} was thrown at ${mm(e.gap)} by an arm that reaches ${mm(e.reach)}`);
  }
}
for (const [i, side] of probe.score.entries()) {
  const known = FIGHT_STYLES[side.style].repertoire;
  const thrown = new Set(probe.exchanges.filter((e) => e.by === i).map((e) => e.strike));
  for (const s of thrown) if (!known.includes(s)) fail(`a ${side.style} threw a ${s}, which it does not know`);
}
if (!probe.exchanges.length) fail('nobody threw anything at all');

// ------------------------------------- 3. THE REACH ADVANTAGE FALLS OUT

const pairs = [];
for (let i = 0; i < SEEDS.length; i++) {
  for (let j = i + 1; j < SEEDS.length; j++) {
    const r = measureBout(make(SEEDS[i]), make(SEEDS[j]), { rounds: 3, roundSeconds: 25 });
    const t = r.taller;
    const s = r.score;
    pairs.push({
      seeds: [SEEDS[i], SEEDS[j]],
      reachGap: s[t].range - s[1 - t].range,
      heightGap: s[t].height - s[1 - t].height,
      ratio: s[t].through / Math.max(1e-6, s[1 - t].through),
      tallerAhead: r.tallerAhead,
      longerAhead:
        s[t].range === s[1 - t].range
          ? null
          : s[t].range > s[1 - t].range
            ? r.tallerAhead
            : !r.tallerAhead,
    });
  }
}
const tallerWins = pairs.filter((p) => p.tallerAhead).length;
const tallerRate = tallerWins / pairs.length;
if (tallerRate < 0.8) {
  fail(`the taller fighter won only ${(tallerRate * 100).toFixed(0)}% of ${pairs.length} pairs, budget 80%`);
}

// The correlation is the real assertion: the BIGGER the reach gap, the more
// lopsided the bout. A win rate alone could come from anywhere.
const xs = pairs.map((p) => p.reachGap);
const ys = pairs.map((p) => Math.log(Math.max(1e-6, p.ratio)));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const mx = mean(xs);
const my = mean(ys);
const cov = xs.map((x, i) => (x - mx) * (ys[i] - my)).reduce((a, b) => a + b, 0);
const sx = Math.sqrt(xs.map((x) => (x - mx) ** 2).reduce((a, b) => a + b, 0));
const sy = Math.sqrt(ys.map((y) => (y - my) ** 2).reduce((a, b) => a + b, 0));
const pearson = cov / Math.max(1e-9, sx * sy);
if (pearson < 0.4) fail(`reach gap barely predicts the result: r = ${pearson.toFixed(3)}, budget 0.4`);

// REACH IS NOT HEIGHT. Where the two disagree, the result has to follow reach.
const disagree = pairs.filter((p) => p.reachGap < 0);
for (const p of disagree) {
  if (p.tallerAhead) {
    fail(`seeds ${p.seeds}: the taller fighter won with ${mm(p.reachGap)} LESS reach`);
  }
}

// -------------------------------------------- 4. the guard earns its keep

const long = measureBout(make(12), make(313), { rounds: 4, roundSeconds: 25 });
const perRound = [1, 2, 3, 4].map((r) => {
  const es = long.exchanges.filter((e) => e.round === r);
  return {
    round: r,
    thrown: es.length,
    through: es.reduce((a, e) => a + e.through, 0),
    stopped: es.filter((e) => e.stopped).length,
  };
});
if (perRound[0].stopped !== 0) {
  fail('round one blocked something — both fighters open in a guard that covers where they are hit');
}
if (!(perRound[1].stopped > perRound[0].stopped)) {
  fail('covering where you were hit stopped nothing — the corner is doing nothing');
}
if (!(perRound[1].through < perRound[0].through * 0.8)) {
  fail(
    `round two took ${perRound[1].through.toFixed(0)} against round one's ` +
      `${perRound[0].through.toFixed(0)} — the guard change is not worth 20%`
  );
}
if (!long.guards.length) fail('nobody changed guard between rounds');

// ------------------------------------------- 5. the fatigue is a real budget

for (const f of [make(42), make(7), make(313)]) {
  if (Math.abs(f.budget - ANAEROBIC_RESERVE * bodyMass(f.rig)) > 1e-6) {
    fail('the work budget is not 300 J per kilogram of this body');
  }
  if (!(f.budget > 8000 && f.budget < 40000)) fail(`a body has ${f.budget.toFixed(0)} J in it, which is not a body`);
}
const tired = measureBout(make(42), make(7), { rounds: 8, roundSeconds: 30 });
if (!(tired.score[0].fatigue > 0.2)) {
  fail(`eight rounds spent only ${(tired.score[0].fatigue * 100).toFixed(0)}% of the tank`);
}
if (tired.score.some((s) => s.fatigue > 1 || s.fatigue < 0)) fail('fatigue left 0..1');

// ------------------------------------------------------- 6. deterministic

{
  const a = measureBout(make(42), make(7), { rounds: 2, roundSeconds: 20 });
  const b = measureBout(make(42), make(7), { rounds: 2, roundSeconds: 20 });
  if (JSON.stringify(a.exchanges) !== JSON.stringify(b.exchanges)) {
    fail('the same two bodies fought a different fight — there is a random number in here');
  }
  const half = measureBout(make(42), make(7), { rounds: 2, roundSeconds: 20, step: 1 / 120 });
  if (half.exchanges.length === 0) fail('the bout does not run at 120 fps');
}

// ------------------------------------- 7. impulse does not evaporate

// A LIMB IS NOT A WALL. `Guard` says so explicitly — the deeper into it the
// line passes the more it takes, so grazing the edge of a glove is not a block
// and a stopped strike still gets something through. Asserting `stopped`
// implies zero was asserting something the guard module never claimed.
// What has to be true is that being stopped is WORTH something.
{
  const bucket = { on: [], off: [] };
  for (const e of long.exchanges) {
    if (e.through < 0) fail(`a ${e.strike} delivered a negative impulse`);
    bucket[e.stopped ? 'on' : 'off'].push(e.through);
  }
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  if (!bucket.on.length) fail('nothing was ever stopped, so the guard is inert');
  if (!(avg(bucket.on) < avg(bucket.off) * 0.5)) {
    fail(
      `a stopped strike delivered ${avg(bucket.on).toFixed(2)} against an unstopped ` +
        `${avg(bucket.off).toFixed(2)} — being blocked is not worth half`
    );
  }
  stoppedWorth = 1 - avg(bucket.on) / Math.max(1e-9, avg(bucket.off));
}

// ---------------------------------------------------------------- report

const styles = ['boxing', 'karate', 'muayThai', 'wingChun', 'taekwondo', 'brawler'];
const styleTable = styles.map((s) => {
  const r = measureBout(make(42, s), make(42, 'boxing'), { rounds: 3, roundSeconds: 25 });
  return { style: s, through: r.score[0].through, taken: r.score[0].taken, thrown: r.score[0].thrown };
});

if (json) {
  console.log(JSON.stringify({ pairs, perRound, styleTable, pearson, tallerRate, failures }, null, 2));
} else {
  console.log('sparring — the reach advantage is not encoded anywhere\n');
  console.log('  reach gap   height gap   impulse ratio (longer / shorter)');
  console.log('  ' + '-'.repeat(56));
  for (const p of [...pairs].sort((a, b) => a.reachGap - b.reachGap).filter((_, i) => i % 6 === 0)) {
    console.log(
      `  ${mm(p.reachGap).padStart(8)}   ${mm(p.heightGap).padStart(9)}   ${p.ratio.toFixed(2).padStart(8)}x`
    );
  }

  console.log('\n  round   thrown   through   stopped');
  console.log('  ' + '-'.repeat(36));
  for (const r of perRound) {
    console.log(
      `  ${String(r.round).padStart(5)}   ${String(r.thrown).padStart(6)}   ` +
        `${r.through.toFixed(0).padStart(7)}   ${String(r.stopped).padStart(7)}`
    );
  }

  console.log('\n  the claims, measured');
  console.log(
    `    the longer fighter wins       ${tallerWins} of ${pairs.length} pairs   budget 80%`
  );
  console.log(
    `    ...and the gap predicts it    r = ${pearson.toFixed(3)} between reach gap and log ratio   budget 0.40`
  );
  console.log(
    `    reach is NOT height           ${disagree.length} pair(s) taller with less reach, and ` +
      `${disagree.filter((p) => !p.tallerAhead).length} of them lost`
  );
  console.log(
    `    covering where you were hit   round 1 stopped ${perRound[0].stopped}, round 2 stopped ` +
      `${perRound[1].stopped} — and took ${(100 * (1 - perRound[1].through / perRound[0].through)).toFixed(0)}% less`
  );
  console.log(
    `    ...and a block is worth       ${(stoppedWorth * 100).toFixed(0)}% off the strike, not all of it — ` +
      `a limb is not a wall`
  );
  console.log(
    `    the tank is 300 J per kilo    ${(ANAEROBIC_RESERVE * bodyMass(createHumanoid({ seed: 42 })) / 1000).toFixed(1)} kJ ` +
      `in a 68.7 kg body; eight rounds spends ${(tired.score[0].fatigue * 100).toFixed(0)}% of it`
  );
  console.log(`    nothing is thrown at thin air ${probe.exchanges.length} strikes, every one inside its own reach`);
  console.log('    the same fight every time     no random numbers anywhere; GAMA can replay it');

  console.log('\n  the same body in each of the six styles, against the same boxer');
  console.log('  ' + '-'.repeat(50));
  for (const s of styleTable) {
    console.log(
      `  ${s.style.padEnd(11)} threw ${String(s.thrown).padStart(3)}   ` +
        `landed ${s.through.toFixed(0).padStart(4)}   took ${s.taken.toFixed(0).padStart(4)}`
    );
  }
  console.log(`\n  ${pairs.length} bouts over ${SEEDS.length} bodies, three rounds each`);
}

if (failures.length) {
  console.error('\nSPARRING OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nNothing in the decision function knows what height is. If the reach\n' +
      'advantage stopped falling out, a measurement stopped being one.'
  );
  process.exit(1);
}
if (!json) console.log('\nsparring: nobody encoded the reach advantage ✓');
