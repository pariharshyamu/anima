#!/usr/bin/env node
/**
 * The bind gate — the sixteenth.
 *
 *   npm run bind            fail if a crossing stops being a crossing
 *   npm run bind -- --json  the numbers, machine-readable
 *
 * ## The trade this exists to check
 *
 * Two blades in contact. Whether the crossing GRIPS is a friction question:
 * press across another blade and the force splits normal and tangential in the
 * ratio tan θ, so below atan(µ) it holds. Steel on steel: 11.3°.
 *
 * Whether the crossing STAYS PUT is a geometry question, and an entirely
 * unrelated one: rotate your blade by dα and the contact runs along theirs by
 * a·dα/sin θ, which is the conditioning of a line intersection and diverges as
 * the lines approach parallel.
 *
 * Those two mechanisms point opposite ways and were not consulted about each
 * other. A shallow bind grips and will not stay put. A steep bind stays put and
 * will not grip. There is no angle that does both, and this gate says by how
 * much you cannot have it.
 *
 * ## And the one chosen number, checked to be irrelevant
 *
 * `HAND_FORCE` is the only value in `src/bind.ts` that somebody picked. The
 * gate runs every comparison at that force and again at ten times it. The
 * geometry — crossing angle, forte fraction, conditioning — has to come back
 * BIT-IDENTICAL, because no force enters it at all. The force ratio has to come
 * back within four ulps, because demanding that 34/0.577 and 340/0.577 round
 * the same way is a claim about IEEE 754 rather than about binds.
 *
 * A constant that changes nothing is a constant nobody has to defend.
 */
import {
  BLADES,
  HAND_FORCE,
  PALM_SPAN,
  STEEL_FRICTION,
  bindForce,
  bindSensitivity,
  bindsOrSlips,
  crossing,
  frictionAngle,
  gripSpan,
  handCouple,
  leverage,
  measureBind,
  wind,
} from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const close = (a, b, tol, what) => {
  if (!(Math.abs(a - b) <= tol)) fail(`${what}: ${a} against ${b}, tolerance ${tol}`);
};
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// ---------------------------------------------- 1. the crossing, exactly

// Two blades from (0,0) and (1,0), each at 45° inward. They must meet at
// (0.5, 0.5), each 0.5√2 out, at a right angle. Every number is known before
// the function runs.
const east = { hand: { x: 0, y: 0 }, angle: rad(45), length: 2 };
const west = { hand: { x: 1, y: 0 }, angle: rad(135), length: 2 };
const x = crossing(east, west);
close(x.point.x, 0.5, 1e-12, 'the crossing is not where two 45° lines meet');
close(x.point.y, 0.5, 1e-12, 'the crossing is not where two 45° lines meet');
close(x.alongA, Math.SQRT1_2, 1e-12, 'A’s lever arm is not 1/√2');
close(x.alongB, Math.SQRT1_2, 1e-12, 'B’s lever arm is not 1/√2');
close(x.angle, Math.PI / 2, 1e-12, 'two blades at 45° and 135° do not cross at a right angle');
if (!x.onBoth) fail('a crossing 0.7 m along two 2 m blades is not on both of them');

// Off the end of a blade is not a bind, and the report has to know.
const stubby = crossing({ ...east, length: 0.2 }, west);
if (stubby.onBoth) fail('a crossing past the point of a 0.2 m blade counts as on it');

// Parallel blades never meet, and that is null rather than a very large number.
if (crossing(east, { hand: { x: 0, y: 1 }, angle: rad(45), length: 2 }) !== null) {
  fail('two parallel blades were given a crossing point');
}
// ...including anti-parallel, which is the same line the other way round.
if (crossing(east, { hand: { x: 0, y: 1 }, angle: rad(225), length: 2 }) !== null) {
  fail('two anti-parallel blades were given a crossing point');
}

// A blade crossing at 170° is crossing at 10°. Every consequence below depends
// on the acute angle, so the normalisation is load-bearing.
const shallowA = { hand: { x: 0, y: 0 }, angle: rad(5), length: 2 };
const shallowB = { hand: { x: 1, y: 0.2 }, angle: rad(175), length: 2 };
close(crossing(shallowA, shallowB).angle, rad(10), 1e-12, 'a 170° crossing is not a 10° crossing');

// --------------------------------------------- 2. the levers, in closed form

close(bindForce(20, 0.5), 40, 1e-12, 'force at the contact is not τ/r');
close(bindForce(20, 0.25), 80, 1e-12, 'halving the lever did not double the force');
if (Number.isFinite(bindForce(20, 0))) fail('a contact at the hand is not infinite force');
close(leverage(0.3, 1.2), 0.25, 1e-12, 'the forte fraction is not along/length');
close(leverage(0.3, 0), 0, 0, 'a zero-length blade has a leverage fraction');

// The couple is a span times a force, and the span comes off a real hilt.
close(handCouple(0.17, 200), 34, 1e-12, 'a couple is not span times force');
close(gripSpan(0.13, 1), PALM_SPAN, 1e-12, 'one hand on a 130 mm hilt does not get a palm');
close(gripSpan(0.05, 1), 0.05, 1e-12, 'one hand on a 50 mm hilt got more than the hilt');
close(gripSpan(0.25, 2), 0.25 - PALM_SPAN, 1e-12, 'two hands sit the whole hilt apart');
close(gripSpan(1.95, 2), 0.4, 1e-12, 'two hands on a spear shaft sit two metres apart');

// THE CASE FOR A LONG GRIP, from the hilts in the blade table and nothing else.
const armingHilt = BLADES.arming.cross;
const longHilt = BLADES.longsword.cross;
const oneHand = handCouple(gripSpan(armingHilt, 1));
const twoHands = handCouple(gripSpan(longHilt, 2));
if (!(twoHands > oneHand * 1.8)) {
  fail(
    `a longsword's two hands make only ${(twoHands / oneHand).toFixed(2)}x an arming sword's one, ` +
      `budget 1.8x — and that ratio is the entire mechanical case for a long grip`
  );
}

// -------------------------------- 3. friction: when does a crossing grip

close(frictionAngle(STEEL_FRICTION), Math.atan(0.2), 1e-12, 'the friction angle is not atan(µ)');
close(deg(frictionAngle(0.2)), 11.309932474020213, 1e-9, 'steel on steel is not 11.31°');
close(frictionAngle(0), 0, 0, 'a frictionless crossing grips at some angle');
// Monotone in µ, because it is an arctangent.
for (const [a, b] of [[0.1, 0.15], [0.15, 0.2], [0.2, 0.25]]) {
  if (!(frictionAngle(b) > frictionAngle(a))) fail(`µ ${b} does not grip further than µ ${a}`);
}
// ...and the threshold is exactly where the arctangent puts it.
const limit = frictionAngle(STEEL_FRICTION);
if (!bindsOrSlips(limit * 0.999)) fail('a crossing just inside the friction angle slips');
if (bindsOrSlips(limit * 1.001)) fail('a crossing just outside the friction angle grips');
if (!bindsOrSlips(0)) fail('two parallel blades pressed together do not grip');
if (bindsOrSlips(Math.PI / 2)) fail('a perpendicular crossing grips');

// ------------------------- 4. conditioning: when does a crossing stay put

close(bindSensitivity(0.5, Math.PI / 2), 0.5, 1e-12, 'sensitivity at a right angle is not the lever arm');
close(bindSensitivity(0.5, rad(30)), 1, 1e-12, 'sensitivity at 30° is not a/sin30 = 2a');
if (Number.isFinite(bindSensitivity(0.5, 0))) fail('parallel lines have a well-conditioned crossing');
// Proportional to the lever arm as well: a contact out at the point is unstable
// twice over, which is the position every manual says not to be in.
close(
  bindSensitivity(1, rad(20)) / bindSensitivity(0.5, rad(20)),
  2,
  1e-12,
  'twice as far out is not twice as twitchy'
);
// Monotone as the crossing steepens, all the way.
let last = Infinity;
for (const d of [2, 5, 10, 20, 45, 90]) {
  const s = bindSensitivity(0.5, rad(d));
  if (!(s < last)) fail(`the crossing at ${d}° is not better conditioned than the one before it`);
  last = s;
}

// ------------------ 5. THE FINDING: you cannot have grip and stability

// At the steepest crossing that still grips, how much twitchier is the contact
// than at a perpendicular one? That number IS the trade, and it is 1/sin(atan µ).
const cost = bindSensitivity(1, limit) / bindSensitivity(1, Math.PI / 2);
close(cost, 1 / Math.sin(limit), 1e-12, 'the trade is not 1/sin of the friction angle');
if (!(cost > 4)) {
  fail(
    `the best-conditioned crossing that still grips is only ${cost.toFixed(2)}x as twitchy as a ` +
      `perpendicular one, budget 4x — the trade has stopped being a trade`
  );
}
// ...and there is no angle anywhere that does both well.
for (let d = 1; d <= 89; d++) {
  const a = rad(d);
  const grips = bindsOrSlips(a);
  const steady = bindSensitivity(1, a) < 2; // within 2x of the best possible
  if (grips && steady) fail(`a crossing at ${d}° both grips and holds still, which is two mechanisms agreeing`);
}

// ----------------------------------- 6. THE CHOSEN CONSTANT IS IRRELEVANT

// Every comparison, run at the picked force and at ten times it. Identical, or
// something in here depends on a number nobody can defend.
const A = { hand: { x: -0.5, y: 0 }, angle: rad(30), length: 1.11 };
const B = { hand: { x: 0.5, y: 0 }, angle: rad(150), length: 0.89 };
const opts = { hands: [2, 1], hilts: [longHilt, armingHilt] };
const normal = measureBind(A, B, opts);
const tenfold = measureBind(A, B, { ...opts, force: HAND_FORCE * 10 });
// To within floating-point rounding, which is the strongest statement that can
// be made about a quantity computed by division. Demanding bit-identity here
// would be demanding that 34/0.577 and 340/0.577 round the same way, which is
// a claim about IEEE 754 and not about binds.
const ulps = (a, b, n, what) => {
  if (!(Math.abs(a - b) <= Number.EPSILON * Math.abs(b) * n)) {
    fail(`${what}: ${a} against ${b}, ${n} ulps`);
  }
};
ulps(tenfold.ratio, normal.ratio, 4, 'ten times the hand force changed who wins the bind');
if (tenfold.winner !== normal.winner) fail('ten times the hand force changed the winner');
close(tenfold.crossing.angle, normal.crossing.angle, 0, 'the hand force moved the crossing angle');
// The geometry ones ARE bit-identical — no force enters them at all.
close(tenfold.leverage[0], normal.leverage[0], 0, 'the hand force moved the forte fraction');
close(tenfold.sensitivity[0], normal.sensitivity[0], 0, 'the hand force changed the conditioning');
if (tenfold.binds !== normal.binds) fail('the hand force decided whether the blades grip');
// ...and it DOES scale the thing it should.
close(tenfold.force[0], normal.force[0] * 10, 1e-9, 'ten times the hand force did not scale the contact force');

// ------------------------------------ 7. forte beats foible, unprompted

// Same weapon, same hands, same everything — except that the crossing lands at
// 20% of one blade and 80% of the other. This is the oldest instruction in the
// art and nothing here has been told it.
// Built backwards from where the contact has to be. A lies along +x from the
// origin and the crossing is put at 0.2 along it; B is then placed so that the
// same point is 0.8 along B. The first draft of this test had B's hand sitting
// exactly ON the crossing, which reported a 335867x win and was a division by
// nearly zero rather than a fencing result.
const CONTACT = { x: 0.2, y: 0 };
const bDir = rad(135);
const strong = { hand: { x: 0, y: 0 }, angle: 0, length: 1 };
const weak = {
  hand: { x: CONTACT.x - 0.8 * Math.cos(bDir), y: CONTACT.y - 0.8 * Math.sin(bDir) },
  angle: bDir,
  length: 1,
};
const lopsided = measureBind(strong, weak, { hilts: [armingHilt, armingHilt] });
if (!(lopsided.leverage[0] < 0.4 && lopsided.leverage[1] > 0.6)) {
  fail(
    `the test crossing is not lopsided: ${(lopsided.leverage[0] * 100).toFixed(0)}% vs ` +
      `${(lopsided.leverage[1] * 100).toFixed(0)}%`
  );
}
if (lopsided.winner !== 0) fail('the blade meeting with its strong did not win the bind');
if (!(lopsided.ratio > 2)) {
  fail(`strong against weak only wins by ${lopsided.ratio.toFixed(2)}x, budget 2x`);
}

// ------------------------------- 8. winding is what an intersection does

// Turn A a few degrees each way. One direction walks the contact BACK toward
// A's hilt and OUT along B's; the other does the reverse. Nobody encoded a
// technique — this is a line moving.
const sweep = [-8, -6, -4, -2, 0, 2, 4, 6, 8].map((d) => ({
  turn: d,
  ...wind(A, B, rad(d), opts),
}));
for (let i = 1; i < sweep.length; i++) {
  if (!(sweep[i].ratio > sweep[i - 1].ratio)) {
    fail(`winding is not monotone: ${sweep[i - 1].turn}° gave ${sweep[i - 1].ratio.toFixed(3)}, ` +
      `${sweep[i].turn}° gave ${sweep[i].ratio.toFixed(3)}`);
  }
  if (!(sweep[i].crossing.alongA < sweep[i - 1].crossing.alongA)) {
    fail(`winding did not walk the contact back toward A's hilt at ${sweep[i].turn}°`);
  }
  if (!(sweep[i].crossing.alongB > sweep[i - 1].crossing.alongB)) {
    fail(`winding did not walk the contact out along B at ${sweep[i].turn}°`);
  }
}
const gained = sweep[sweep.length - 1].ratio / sweep[0].ratio;
if (!(gained > 1.3)) {
  fail(`sixteen degrees of winding only bought ${gained.toFixed(2)}x, budget 1.3x`);
}
// And the rate it moves at is the conditioning, checked against the derivative
// rather than asserted: ds ≈ a·dα/sin θ over a small turn.
const step = rad(0.05);
const before = measureBind(A, B, opts);
const after = wind(A, B, step, opts);
const moved = Math.abs(after.crossing.alongB - before.crossing.alongB);
// Read the REPORT's own sensitivity, not a fresh call to `bindSensitivity`.
// Recomputing it here checked the formula against itself and let a report that
// dropped the crossing angle entirely walk straight through the gate.
const predicted = before.sensitivity[0] * step;
if (Math.abs(moved - predicted) / predicted > 0.02) {
  fail(
    `the contact moved ${(moved * 1000).toFixed(2)} mm where a/sinθ predicts ` +
      `${(predicted * 1000).toFixed(2)} mm — the conditioning is not the thing that governs`
  );
}

// ---------------------------------------------------------------- report

const angles = [2, 5, 11.31, 15, 30, 60, 90].map((d) => ({
  degrees: d,
  grips: bindsOrSlips(rad(d)),
  perDegree: bindSensitivity(0.5, rad(d)) * rad(1),
}));

if (json) {
  console.log(JSON.stringify({ angles, normal, lopsided, sweep, cost, failures }, null, 2));
} else {
  console.log('bind — two blades in contact stop being two objects\n');
  console.log('  crossing   grips?        contact runs, per degree of turn (0.5 m lever)');
  console.log('  ' + '-'.repeat(66));
  for (const a of angles) {
    console.log(
      `  ${a.degrees.toFixed(2).padStart(6)}°   ${(a.grips ? 'grips' : 'slips').padEnd(7)}   ` +
        `${(a.perDegree * 1000).toFixed(1).padStart(6)} mm`
    );
  }

  console.log('\n  TWO MECHANISMS, POINTING OPPOSITE WAYS');
  console.log(
    `    friction says grip below   ${deg(limit).toFixed(2)}°   atan(µ), µ = ${STEEL_FRICTION} steel on steel`
  );
  console.log(
    `    geometry says the crossing at that angle runs ${cost.toFixed(2)}x as far per degree`);
  console.log('    as a perpendicular one, because a line intersection is 1/sinθ conditioned.');
  console.log('    Neither of those was derived from the other, and there is no angle that does both.');

  console.log('\n  THE LEVERS, off the hilts in the blade table');
  console.log(
    `    arming sword, one hand     ${(gripSpan(armingHilt, 1) * 1000).toFixed(0)} mm apart   ` +
      `${oneHand.toFixed(1)} N·m`
  );
  console.log(
    `    longsword, two hands       ${(gripSpan(longHilt, 2) * 1000).toFixed(0)} mm apart   ` +
      `${twoHands.toFixed(1)} N·m   ${(twoHands / oneHand).toFixed(2)}x, from a subtraction`
  );
  console.log(
    `    strong against weak        ${(lopsided.leverage[0] * 100).toFixed(0)}% vs ` +
      `${(lopsided.leverage[1] * 100).toFixed(0)}% along the blades → ` +
      `${lopsided.ratio.toFixed(2)}x, same weapon both sides`
  );

  console.log('\n  WINDING — turning A, and watching where the crossing goes');
  console.log('    turn      A’s lever    B’s lever    ratio');
  for (const s of sweep) {
    if (s.turn % 4) continue;
    console.log(
      `    ${String(s.turn).padStart(3)}°     ` +
        `${(s.crossing.alongA * 1000).toFixed(0).padStart(6)} mm    ` +
        `${(s.crossing.alongB * 1000).toFixed(0).padStart(6)} mm    ${s.ratio.toFixed(2)}`
    );
  }
  console.log('    Nobody encoded a technique. That is a line being moved, and an intersection moving.');

  console.log(
    `\n  and ten times the hand force changes the contact force ten times over ` +
      `and NOTHING else`
  );
}

if (failures.length) {
  console.error('\nBIND OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error(
    '\nThe crossing is line intersection and the grip is Coulomb.\n' +
      'If those two have started agreeing, one of them has been made up.'
  );
  process.exit(1);
}
if (!json) console.log('\nbind: shallow grips and will not hold still; steep holds still and will not grip ✓');
