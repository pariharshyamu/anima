/**
 * Does the food get to the mouth, and does the spoon still have any on it?
 *
 *   npm run dining            check every claim
 *   npm run dining -- --why   print the whole table
 *
 * The sixth of ANIMA's gates, after `skate`, `climb`, `parkour`, `mood` and
 * `lifting`.
 *
 * Eating fails in ways nothing else here can see. A still frame of a diner is a
 * person holding cutlery; it says nothing about whether the fork ever reached
 * their face, whether the spoon still had soup on it when it got there, or
 * whether the plate is the same plate it was ten mouthfuls ago. Eight failures,
 * all silent:
 *
 *   NEVER ARRIVES  a utensil that stops short of the mouth. The single most
 *                  recognisable broken eating animation there is, and visible
 *                  in a still frame only if you take it at the exact instant.
 *   NEVER TOUCHES  a hand that never actually reaches the plate — which is what
 *                  happens the moment the plate is further away than an arm,
 *                  unless something leans.
 *   DOESN'T LEAN   …and a body that does not lean for a far plate has not
 *                  noticed. The fold is closed-loop; if it is constant across
 *                  distances it is not a loop, it is a constant.
 *   SPILLS         a spoon whose bearing surface rotates on the way up. This is
 *                  the bar-over-mid-foot of dining: not a preference, just what
 *                  happens to soup.
 *   FLAT DRINK     a glass tipped the same amount full and nearly empty. The
 *                  angle is geometry — `pourAngle` — and if the last sip does
 *                  not go further over than the first, it is not being asked.
 *   NEVER RESTS    a hand in continuous motion. Nobody conveys food to their
 *                  face without stopping; the pause IS the chewing.
 *   ONE STYLE      every utensil moving the head the same amount, which means
 *                  `meet` reaches nothing and chopsticks are a fork with a
 *                  different mesh.
 *   A POP          the utensil teleporting at a phase boundary. Measured at
 *                  310 mm once, from a knife-and-fork that cut at the plate and
 *                  then "reached" for it from a resting pose.
 */
import {
  createHumanoid,
  measureBite,
  pourAngle,
  servings,
  UTENSILS,
  UTENSIL_NAMES,
} from '../dist/index.js';
import { Object3D, Vector3 } from 'three';

const SEEDS = [1, 5, 12, 21, 33, 47];
const BUDGET = {
  /**
   * Metres the business end may sit off the mouth at its closest approach
   * during a mouthful.
   *
   * Contact, so a minimum over the window and a maximum over the meal. A fork
   * two centimetres from a face is a fork that missed.
   */
  mouth: 0.02,
  /** Metres the hand may sit off the plate at its closest approach. */
  plate: 0.03,
  /**
   * Radians a loose load may rotate away from horizontal on the way up.
   *
   * A spoon is level or it is empty. Eight degrees is about where a shallow
   * spoon starts losing soup, and it is the whole reason the wrist correction
   * exists — swept over plate positions that make the correction WORK, because
   * a constraint measured only where it is slack is not measured.
   */
  spill: 0.14,
  /** …and how much a fork is allowed, which is much more: nothing is loose. */
  spillFree: 0.9,
  /** Metres the utensil may move in one 1/120 s frame. */
  pop: 0.025,
  /** Fraction of the meal the carrying hand must NOT be travelling. */
  idle: 0.2,
  /** Radians the fold must grow by between a near plate and a far one. */
  lean: 0.12,
  /** Radians the last sip must go over further than the first. */
  tilt: 0.15,
  /** Metres of head travel between the most and least head-led utensil. */
  style: 0.03,
};

const why = process.argv.includes('--why');
const failures = [];
const rows = [];

/** A place setting, in the diner's own frame: below the shoulder and forward. */
function setting(rig, down = 0.19, fwd = 0.16) {
  const plate = new Object3D();
  rig.object.add(plate);
  rig.object.updateWorldMatrix(true, true);
  const shoulder = rig.bones.RightArm.getWorldPosition(new Vector3());
  const hips = rig.object.worldToLocal(new Vector3(0, shoulder.y, 0));
  plate.position.set(0, hips.y - down * rig.height, fwd * rig.height);
  return plate;
}

// ── 1. A meal, of every utensil, on every body ───────────────────────────
const worst = {
  mouth: [0, ''],
  plate: [0, ''],
  pop: [0, ''],
  idle: [Infinity, ''],
  spill: [0, ''],
};
const keep = (key, v, cmp, at) => {
  if (cmp(v, worst[key][0])) worst[key] = [v, at];
};
const gt = (a, b) => a > b;
const lt = (a, b) => a < b;

let bites = 0;
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const plate = setting(rig);
  for (const name of UTENSIL_NAMES) {
    const r = measureBite(rig, name, { plate, food: servings(5), seed: 3 });
    const at = `seed ${seed}, ${name}`;
    if (seed === SEEDS[1]) rows.push([name, r]);
    bites += r.bites;

    keep('mouth', r.mouthGap, gt, at);
    keep('plate', r.plateGap, gt, at);
    keep('pop', r.pop, gt, at);
    keep('idle', r.handIdle, lt, at);

    // The plate has to actually empty, and the mouthfuls have to match what
    // was on it. A diner who eats forever is the tell that this is a loop.
    if (!r.emptied || r.bites !== 5) {
      failures.push(`NEVER ENDS: ${at} — ${r.bites} of 5 mouthfuls, emptied ${r.emptied}`);
    }
  }
}

// ── 2. The spill constraint, measured WHERE IT BINDS ─────────────────────
// A wrist correction that is never asked for anything is not a constraint. So
// the plate is moved to the places that make a level carry hard: out to the
// side, low, and across the body — and the spoon has to keep its load flat in
// all of them while the fork is under no such obligation.
const AWKWARD = [
  { down: 0.30, fwd: 0.12, label: 'low' },
  { down: 0.14, fwd: 0.22, label: 'far' },
  { down: 0.24, fwd: 0.20, label: 'low and far' },
];
let forkSpill = 0;
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  for (const place of AWKWARD) {
    const plate = setting(rig, place.down, place.fwd);
    for (const name of ['spoon', 'fork']) {
      const r = measureBite(rig, name, { plate, food: servings(3), seed: 7 });
      if (name === 'spoon') keep('spill', r.spill, gt, `seed ${seed}, ${place.label}`);
      else forkSpill = Math.max(forkSpill, r.spill);
    }
  }
}

// ── 3. The reach is a LOOP, not a constant ───────────────────────────────
// Sweep the plate out and watch the fold answer. If the lean is the same at
// arm's length as it is under the chin, nothing is measuring anything.
let leanNear = 0;
let leanFar = 0;
let reachLimit = 0;
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const near = measureBite(rig, 'fork', { plate: setting(rig, 0.16, 0.08), food: servings(2) });
  const far = measureBite(rig, 'fork', { plate: setting(rig, 0.20, 0.21), food: servings(2) });
  leanNear = Math.max(leanNear, near.lean);
  leanFar = Math.max(leanFar, far.lean);
  // How far a plate can be before this body simply cannot eat off it.
  for (let f = 0.08; f < 0.40; f += 0.01) {
    const r = measureBite(rig, 'fork', { plate: setting(rig, 0.19, f), food: servings(1) });
    if (r.plateGap > BUDGET.plate) break;
    reachLimit = Math.max(reachLimit, f * rig.height);
  }
}
if (!(leanFar > leanNear + BUDGET.lean)) {
  failures.push(
    `DOESN'T LEAN: a plate at arm's length folds the body ${leanFar.toFixed(2)} rad, ` +
      `and one under the chin folds it ${leanNear.toFixed(2)} — the reach is not a loop`
  );
}

// ── 4. The drink tilts further as it empties ─────────────────────────────
// `pourAngle` is geometry; this checks the wrist is actually being asked.
let tiltGrowth = Infinity;
let tiltAt = '';
let strawTilt = 0;
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const plate = setting(rig);
  for (const name of ['cup', 'bowl']) {
    const r = measureBite(rig, name, { plate, food: servings(6), seed: 3 });
    if (r.tiltLast - r.tiltFirst < tiltGrowth) {
      tiltGrowth = r.tiltLast - r.tiltFirst;
      tiltAt = `seed ${seed}, ${name}`;
    }
  }
  // …and a straw never tips at all, which is the whole of what a straw is.
  strawTilt = Math.max(
    strawTilt,
    measureBite(rig, 'straw', { plate, food: servings(4), seed: 3 }).tiltLast
  );
}
if (tiltGrowth < BUDGET.tilt) {
  failures.push(
    `FLAT DRINK: the last sip went over only ${tiltGrowth.toFixed(2)} rad further than the first (${tiltAt})`
  );
}
if (strawTilt > 1e-6) {
  failures.push(`STRAW TIPS: a glass drunk through a straw went over ${strawTilt.toFixed(2)} rad`);
}

// ── 5. The utensils are actually different ───────────────────────────────
// The claim the module is named for. If `meet` reaches nothing, chopsticks are
// a fork with a different mesh on it.
let headMost = 0;
let headLeast = Infinity;
for (const [, r] of rows) {
  headMost = Math.max(headMost, r.headTravel);
  headLeast = Math.min(headLeast, r.headTravel);
}
if (headMost - headLeast < BUDGET.style) {
  failures.push(
    `ONE STYLE: every utensil moved the head within ${((headMost - headLeast) * 1000).toFixed(1)} mm of every other`
  );
}

// ── 6. `pourAngle` says what it says ─────────────────────────────────────
// The formula, checked against the two ends it is obviously right about: a
// full glass needs nothing, and an empty one needs to go right over.
if (Math.abs(pourAngle(1, 0.11, 0.035)) > 1e-9) failures.push('POUR: a full glass needs a tilt');
if (pourAngle(0, 0.11, 0.035) < 1.2) failures.push('POUR: an empty glass barely tips');

if (worst.mouth[0] > BUDGET.mouth) {
  failures.push(`NEVER ARRIVES: the utensil stopped ${(worst.mouth[0] * 1000).toFixed(1)} mm short of the mouth (${worst.mouth[1]})`);
}
if (worst.plate[0] > BUDGET.plate) {
  failures.push(`NEVER TOUCHES: the hand stopped ${(worst.plate[0] * 1000).toFixed(1)} mm short of the plate (${worst.plate[1]})`);
}
// The contrast is the point. A spoon corrects and a fork does not, so if the
// two come out equally flat then `level` is a field nobody reads.
if (!(forkSpill > worst.spill[0] + 0.15)) {
  failures.push(
    `LEVEL DOES NOTHING: a spoon holds ${worst.spill[0].toFixed(3)} rad off level and a fork ` +
      `${forkSpill.toFixed(3)} — the correction is not correcting anything`
  );
}
if (worst.spill[0] > BUDGET.spill) {
  failures.push(`SPILLS: a spoon rotated ${worst.spill[0].toFixed(3)} rad off level (${worst.spill[1]})`);
}
if (worst.pop[0] > BUDGET.pop) {
  failures.push(`A POP: the utensil jumped ${(worst.pop[0] * 1000).toFixed(1)} mm in one frame (${worst.pop[1]})`);
}
if (worst.idle[0] < BUDGET.idle) {
  failures.push(`NEVER RESTS: the hand was still for only ${(worst.idle[0] * 100).toFixed(1)}% of the meal (${worst.idle[1]})`);
}

if (why) {
  console.log('  utensil        meet  mouth  plate  spill   lean  idle%   head    pop  tilt₁  tiltₙ');
  console.log('  ' + '-'.repeat(80));
  const mm = (v) => (v * 1000).toFixed(1).padStart(6);
  for (const [name, r] of rows) {
    console.log(
      `  ${name.padEnd(14)}${UTENSILS[name].meet.toFixed(2).padStart(5)}${mm(r.mouthGap)}${mm(r.plateGap)}` +
        `${r.spill.toFixed(3).padStart(7)}${r.lean.toFixed(2).padStart(7)}${(r.handIdle * 100).toFixed(1).padStart(7)}` +
        `${mm(r.headTravel)}${mm(r.pop)}${r.tiltFirst.toFixed(2).padStart(7)}${r.tiltLast.toFixed(2).padStart(7)}`
    );
  }
  console.log();
}

console.log(`dining: ${UTENSIL_NAMES.length} utensils, a whole plate of each on ${SEEDS.length} bodies — ${bites} mouthfuls`);
console.log(`  to the mouth      ${(worst.mouth[0] * 1000).toFixed(1)} mm at closest approach   (${worst.mouth[1]})   budget ${BUDGET.mouth * 1000} mm`);
console.log(`  to the plate      ${(worst.plate[0] * 1000).toFixed(1)} mm   (${worst.plate[1]})   budget ${BUDGET.plate * 1000} mm`);
console.log(`  spoon stays level ${worst.spill[0].toFixed(3)} rad where the wrist has to work   (${worst.spill[1]})   budget ${BUDGET.spill}`);
console.log(`  …and a fork need not: ${forkSpill.toFixed(3)} rad, allowed ${BUDGET.spillFree}`);
console.log(`  the body leans    ${leanNear.toFixed(2)} rad under the chin → ${leanFar.toFixed(2)} rad at arm's length`);
console.log(`  reach limit       a plate ${(reachLimit * 1000).toFixed(0)} mm forward is the furthest this body can eat from`);
console.log(`  the drink tips    +${tiltGrowth.toFixed(2)} rad from the first sip to the last   budget +${BUDGET.tilt}`);
console.log(`  …and a straw does not: ${strawTilt.toFixed(3)} rad`);
console.log(`  styles differ     ${((headMost - headLeast) * 1000).toFixed(1)} mm of head travel between them   budget ${BUDGET.style * 1000} mm`);
console.log(`  the hand rests    ${(worst.idle[0] * 100).toFixed(1)}% of the meal   (${worst.idle[1]})   budget ${BUDGET.idle * 100}%`);
console.log(`  no pops           ${(worst.pop[0] * 1000).toFixed(1)} mm per frame   (${worst.pop[1]})   budget ${BUDGET.pop * 1000} mm`);

if (failures.length) {
  console.log('\nDINING OVER BUDGET');
  for (const f of failures) console.log('  ' + f);
  console.log(
    '\nA still frame of a diner is a person holding cutlery. It says nothing\n' +
      'about whether the food ever reached their face, whether the spoon still\n' +
      'had anything on it, or whether the plate is the same plate it was ten\n' +
      'mouthfuls ago — which is the whole of what this module claims.'
  );
  process.exit(1);
}
console.log('\ndining: it reaches the mouth, and the plate comes up empty ✓');
