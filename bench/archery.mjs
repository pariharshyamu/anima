/**
 * Does the arrow leave where the archer is pointing, and does the anchor
 * decide the group?
 *
 *   npm run archery            check every claim
 *   npm run archery -- --why   print the whole table
 *
 * The seventh of ANIMA's gates, after `skate`, `climb`, `parkour`, `mood`,
 * `lifting` and `dining`.
 *
 * Archery fails in ways nothing else here can see. A still frame of an archer
 * is a person at full draw; it says nothing about whether the hand ever
 * reached the anchor, whether the bow arm held, whether the arrow left along
 * the line the body was making, or whether any of it would have grouped. Ten
 * failures, all silent:
 *
 *   DISAGREES      ANIMA derives an arrow's speed from the bow's stored energy
 *                  and SCENA declares it in a table. Neither imports the other.
 *                  If they drift apart, one of them is wrong about arrows.
 *   NO ANCHOR      a drawing hand that never reaches the face. The whole
 *                  discipline, and it is a contact in millimetres.
 *   WANDERS        …or reaches a different part of it every time, which is the
 *                  same thing as not having an anchor point at all.
 *   BOW MOVES      the bow arm is a post. Anything it does at full draw is a
 *                  miss, and it is the one arm in this library that is
 *                  supposed to be locked.
 *   GROUP LIES     the arrows must group by exactly as much as the anchor
 *                  scattered. Two independent routes — the posed hand, and the
 *                  launch velocity — and they have to meet.
 *   SKILL IS FLAT  a novice and an Olympian shooting the same group means the
 *                  one number a game would actually turn is doing nothing.
 *   PLUCKED        a release where the hand travels FORWARD. That is a plucked
 *                  string, and it misses low and left for reasons no amount of
 *                  aiming fixes.
 *   NO LET-OFF     a compound that is as hard to hold as a longbow, which is
 *                  the entire reason compounds exist.
 *   NEVER ENDS     a quiver that does not empty.
 *   A POP          the drawing hand teleporting between arrows. Measured at
 *                  483 mm once, from a hand that reappeared beside the bow the
 *                  instant the follow-through ended.
 */
import {
  arrowSpeed,
  BOWS,
  BOW_STYLES,
  createHumanoid,
  elevationFor,
  groupAt,
  maxRange,
  measureShot,
  quiverOf,
} from '../dist/index.js';
import { Object3D } from 'three';

const SEEDS = [1, 5, 12, 21, 33, 47];
const RANGE = 18;
/** SCENA's ammunition table declares an arrow. It is not imported; it is a fact. */
const SCENA_ARROW = { mass: 0.03, muzzle: 55 };

const BUDGET = {
  /** Fractional disagreement allowed with SCENA's declared arrow velocity. */
  agree: 0.02,
  /** Metres the drawing hand may sit off its anchor at full draw. */
  anchor: 0.045,
  /** Metres the anchor may WANDER between arrows. */
  scatter: 0.025,
  /** Metres the bow hand may drift while at full draw. */
  bow: 0.01,
  /** Fractional gap allowed between the predicted group and the shot one. */
  group: 0.15,
  /** How much tighter a perfect archer must group than a poor one. */
  skill: 3,
  /** Fraction of a longbow's hold a compound may still ask for. */
  letOff: 0.45,
  /** Metres the drawing hand may move in one 1/120 s frame. */
  pop: 0.04,
};

const why = process.argv.includes('--why');
const failures = [];
const rows = [];

// ── 1. The two libraries still agree about an arrow ──────────────────────
// ANIMA works it out from peak × draw × storage × efficiency; SCENA writes it
// down. The only reason they match is that they are describing the same thing.
const rig0 = createHumanoid({ seed: 5 });
const derived = arrowSpeed(
  BOWS.longbow.peak,
  BOWS.longbow.draw * rig0.height,
  BOWS.longbow.storage,
  BOWS.longbow.efficiency,
  SCENA_ARROW.mass
);
const drift = Math.abs(derived - SCENA_ARROW.muzzle) / SCENA_ARROW.muzzle;
if (drift > BUDGET.agree) {
  failures.push(
    `DISAGREES: ANIMA derives ${derived.toFixed(1)} m/s from the draw; SCENA declares ` +
      `${SCENA_ARROW.muzzle}. ${(drift * 100).toFixed(1)}% apart, budget ${BUDGET.agree * 100}%`
  );
}

// ── 2. The ballistic solution says what it says ──────────────────────────
if (Math.abs(elevationFor(0, 55)) > 1e-9) failures.push('PHYSICS: a target underfoot needs elevation');
if (!Number.isNaN(elevationFor(400, 55))) {
  failures.push('PHYSICS: a target past the maximum range got an angle anyway');
}
if (Math.abs(maxRange(55) - (55 * 55) / 9.81) > 1e-6) failures.push('PHYSICS: maxRange is not v²/g');
// Fired at the solved angle, the arrow lands where it was aimed. Checked by
// integrating rather than by re-arranging the same formula.
{
  const v = 55;
  const th = elevationFor(120, v);
  const flight = (2 * v * Math.sin(th)) / 9.81;
  const landed = v * Math.cos(th) * flight;
  if (Math.abs(landed - 120) > 0.5) {
    failures.push(`PHYSICS: the solved angle lands at ${landed.toFixed(1)} m, not 120`);
  }
}

// ── 3. A quiver of every bow on every body ───────────────────────────────
const worst = {
  anchor: [0, ''],
  scatter: [0, ''],
  bow: [0, ''],
  group: [0, ''],
  pop: [0, ''],
};
const keep = (k, v, at) => {
  if (v > worst[k][0]) worst[k] = [v, at];
};

let arrows = 0;
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const butt = new Object3D();
  butt.position.set(0, 1.2, RANGE);
  for (const style of BOW_STYLES) {
    const r = measureShot(rig, style, { target: butt, arrows: quiverOf(6), seed: 4, skill: 0.7 });
    const at = `seed ${seed}, ${style}`;
    if (seed === SEEDS[1]) rows.push([style, r]);
    arrows += r.shots;

    keep('anchor', r.anchorGap, at);
    keep('scatter', r.anchorScatter, at);
    keep('bow', r.bowDrift, at);
    keep('pop', r.pop, at);
    if (r.predicted > 1e-4) {
      keep('group', Math.abs(r.grouped / r.predicted - 1), at);
    }

    if (!r.emptied || r.shots !== 6) {
      failures.push(`NEVER ENDS: ${at} — ${r.shots} of 6 arrows, emptied ${r.emptied}`);
    }
    // A loose is a relaxation. Forward at the release is a plucked string.
    if (!r.followsThrough) {
      failures.push(`PLUCKED: ${at} — the drawing hand went FORWARD at the release`);
    }
  }
}

// ── 4. Skill is the number a game would turn ─────────────────────────────
// If it does not move the group, nothing else in here matters.
const rig = createHumanoid({ seed: 5 });
const butt = new Object3D();
butt.position.set(0, 1.2, RANGE);
const sweep = [0.3, 0.5, 0.7, 0.9, 1].map((skill) => ({
  skill,
  ...measureShot(rig, 'longbow', { target: butt, arrows: quiverOf(8), seed: 11, skill }),
}));
let reversal = null;
for (let i = 1; i < sweep.length; i++) {
  if (sweep[i].grouped > sweep[i - 1].grouped + 1e-6) {
    reversal = `skill ${sweep[i].skill} grouped wider than ${sweep[i - 1].skill}`;
  }
}
const spread = sweep[0].grouped / Math.max(1e-6, sweep[sweep.length - 1].grouped);
if (reversal) failures.push(`SKILL IS FLAT: ${reversal}`);
if (spread < BUDGET.skill) {
  failures.push(
    `SKILL IS FLAT: a novice groups only ${spread.toFixed(1)}x wider than an Olympian, budget ${BUDGET.skill}x`
  );
}

// ── 5. The let-off is the whole reason a compound exists ─────────────────
const holdRatio = BOWS.compound.peak * (1 - BOWS.compound.letOff) / BOWS.longbow.peak;
if (holdRatio > BUDGET.letOff) {
  failures.push(
    `NO LET-OFF: a compound asks ${(holdRatio * 100).toFixed(0)}% of a longbow's hold, budget ${BUDGET.letOff * 100}%`
  );
}
// …and it has to SHOW: same archer, same skill, tighter group.
const lb = measureShot(rig, 'longbow', { target: butt, arrows: quiverOf(8), seed: 3, skill: 0.7 });
const cp = measureShot(rig, 'compound', { target: butt, arrows: quiverOf(8), seed: 3, skill: 0.7 });
if (!(cp.grouped < lb.grouped * 0.85)) {
  failures.push(
    `NO LET-OFF: the same archer groups ${(cp.grouped * 100).toFixed(1)} cm with a compound and ` +
      `${(lb.grouped * 100).toFixed(1)} cm with a longbow — the let-off reaches nothing`
  );
}

// ── 6. …and `groupAt` is not just agreeing with itself ───────────────────
// Five millimetres of anchor over a 0.71 m draw at twenty metres is fourteen
// centimetres. Arithmetic anybody can check on paper.
if (Math.abs(groupAt(20, 0.005, 0.71) - 0.1408) > 0.001) {
  failures.push('GROUP LIES: groupAt does not agree with pen and paper');
}

if (worst.anchor[0] > BUDGET.anchor) {
  failures.push(`NO ANCHOR: the drawing hand sat ${(worst.anchor[0] * 1000).toFixed(1)} mm off the anchor (${worst.anchor[1]})`);
}
if (worst.scatter[0] > BUDGET.scatter) {
  failures.push(`WANDERS: the anchor moved ${(worst.scatter[0] * 1000).toFixed(1)} mm between arrows (${worst.scatter[1]})`);
}
if (worst.bow[0] > BUDGET.bow) {
  failures.push(`BOW MOVES: the bow hand drifted ${(worst.bow[0] * 1000).toFixed(1)} mm at full draw (${worst.bow[1]})`);
}
if (worst.group[0] > BUDGET.group) {
  failures.push(
    `GROUP LIES: the arrows grouped ${(worst.group[0] * 100).toFixed(1)}% away from what the anchor predicted (${worst.group[1]})`
  );
}
if (worst.pop[0] > BUDGET.pop) {
  failures.push(`A POP: the drawing hand jumped ${(worst.pop[0] * 1000).toFixed(1)} mm in one frame (${worst.pop[1]})`);
}

if (why) {
  console.log('  bow         speed  holdN  anchor  scatter  bowDrift  predicted   group  elev');
  console.log('  ' + '-'.repeat(80));
  const mm = (v) => (v * 1000).toFixed(1).padStart(7);
  for (const [name, r] of rows) {
    console.log(
      `  ${name.padEnd(11)}${r.speed.toFixed(1).padStart(5)}${r.hold.toFixed(0).padStart(7)}` +
        `${mm(r.anchorGap)}${mm(r.anchorScatter)}${mm(r.bowDrift)}${mm(r.predicted)}${mm(r.grouped)}` +
        `${r.elevation.toFixed(3).padStart(7)}`
    );
  }
  console.log('\n  skill   anchor scatter   group at ' + RANGE + ' m');
  for (const s of sweep) {
    console.log(
      `  ${s.skill.toFixed(1)}     ${(s.anchorScatter * 1000).toFixed(1).padStart(6)} mm       ` +
        `${(s.grouped * 100).toFixed(1).padStart(5)} cm`
    );
  }
  console.log();
}

console.log(`archery: ${BOW_STYLES.length} bows, a quiver of each on ${SEEDS.length} bodies — ${arrows} arrows`);
console.log(`  SCENA agrees      ANIMA derives ${derived.toFixed(1)} m/s from the draw; SCENA declares ${SCENA_ARROW.muzzle}   ${(drift * 100).toFixed(2)}% apart, budget ${BUDGET.agree * 100}%`);
console.log(`  the anchor        ${(worst.anchor[0] * 1000).toFixed(1)} mm off at full draw   (${worst.anchor[1]})   budget ${BUDGET.anchor * 1000} mm`);
console.log(`  …and it holds     ${(worst.scatter[0] * 1000).toFixed(1)} mm of wander between arrows   (${worst.scatter[1]})   budget ${BUDGET.scatter * 1000} mm`);
console.log(`  the bow arm       ${(worst.bow[0] * 1000).toFixed(1)} mm of drift at full draw   (${worst.bow[1]})   budget ${BUDGET.bow * 1000} mm`);
console.log(`  the group obeys   ${(worst.group[0] * 100).toFixed(1)}% between what the anchor predicted and what left the bow   budget ${BUDGET.group * 100}%`);
console.log(`  skill decides it  ${(sweep[0].grouped * 100).toFixed(1)} cm at skill 0.3 → ${(sweep[4].grouped * 100).toFixed(1)} cm at 1.0   (${spread.toFixed(1)}x)   budget ${BUDGET.skill}x`);
console.log(`  the let-off       a compound asks ${(holdRatio * 100).toFixed(0)}% of a longbow's hold and groups ${(cp.grouped * 100).toFixed(1)} cm against ${(lb.grouped * 100).toFixed(1)}`);
console.log(`  follow-through    every bow, the hand goes BACK at the release`);
console.log(`  no pops           ${(worst.pop[0] * 1000).toFixed(1)} mm per frame   (${worst.pop[1]})   budget ${BUDGET.pop * 1000} mm`);

if (failures.length) {
  console.log('\nARCHERY OVER BUDGET');
  for (const f of failures) console.log('  ' + f);
  console.log(
    '\nA still frame of an archer is a person at full draw. It says nothing\n' +
      'about whether the hand reached the anchor, whether the bow arm held, or\n' +
      'whether any of it would have grouped — which is the whole of the sport.'
  );
  process.exit(1);
}
console.log('\narchery: the anchor holds, and the group obeys it ✓');
