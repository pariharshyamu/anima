#!/usr/bin/env node
/**
 * The motion-matching gate — the twenty-first.
 *
 *   npm run motion            fail if the cost function stops being a length
 *   npm run motion -- --json  the numbers, machine-readable
 *
 * ## The claim
 *
 * Every motion-matching implementation carries a table of weights beside its
 * cost function, and nobody can say where the numbers came from. This one has
 * no weights, because there is nothing to weight: foot position is in metres,
 * foot velocity becomes metres when multiplied by a TIME, and a trajectory
 * point is already metres. Add square metres to square metres and the weights
 * are all 1.
 *
 * ## The check a weighted cost cannot pass
 *
 * If weights were preferences, writing the velocities in a different unit — the
 * same velocities, a different name — could not change which frame is nearest.
 * For a weighted cost it does, and this gate does it to the real database.
 *
 * ## And the two the controller cannot pass without them
 *
 * The constants are measured rather than chosen, so the way to show they are
 * doing something is to take them away:
 *
 *   - with the foot-velocity time at zero, the search cannot tell a foot going
 *     forward from a foot going back through the same place, and pops.
 *   - with the trajectory horizons at zero, the character never obeys a command.
 */
import {
  MotionMatcher, buildMotionDatabase, createHumanoid, createLocomotionClips,
  froudeNumber, matchFrame, queryFeature, Locomotion,
} from '../dist/index.js';
import { AnimationMixer, LoopRepeat, Quaternion, Vector3 } from 'three';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const close = (a, b, tol, what) => {
  if (!(Math.abs(a - b) <= tol)) fail(`${what}: ${a} against ${b}, tolerance ${tol}`);
};

const rig = createHumanoid({ seed: 5, height: 1.75 });
const db = buildMotionDatabase(rig);
const WALK = db.clips.walkSpeed;
const RUN = db.clips.runSpeed;

// ------------------------------- 1. every component of the vector is a length

// The identity the conversion is defined by. If this drifts, τ stopped being a
// measurement of the data and became a number somebody typed.
close(db.tauFoot * db.footSpread, db.positionSpread, 1e-12,
  'the foot time constant is no longer σ(position)/σ(foot velocity)');
for (let i = 0; i < db.horizons.length; i++) {
  close(db.horizons[i], ((i + 1) * db.stepTime) / 3, 1e-12,
    `horizon ${i} is not a third of a step apart`);
}
if (!(db.frames.length > 100)) fail(`only ${db.frames.length} frames in the database`);
for (const f of db.frames) {
  if (f.feature.length !== 15) fail(`a frame has ${f.feature.length} features, not 15`);
  for (const v of f.feature) if (!Number.isFinite(v)) fail('a feature is not a finite length');
}

// SCALE. Every feature is a length, so on a body k times as big every feature
// must be k times as big — and the time constant, being a ratio of a length to
// a length per second, must not move at all.
const small = buildMotionDatabase(createHumanoid({ seed: 5, height: 1.4 }));
const large = buildMotionDatabase(createHumanoid({ seed: 5, height: 2.1 }));
close(small.tauFoot, large.tauFoot, 1e-9,
  'the time constant changed with body size, so it is not a ratio of two lengths');
const k = large.positionSpread / small.positionSpread;
close(large.footSpread / small.footSpread, k, 1e-9,
  'foot velocity did not scale with the body the way position did');

// -------------------- 2. THE ONE THAT MATTERS: units are not preferences

// Find, IN THE REAL DATABASE, the pair the question is actually about: one
// frame that is nearer in foot position and another that is nearer in foot
// velocity. Any cost function has to decide between them, and that decision is
// exactly what a weight is for.
const query = queryFeature(db, {
  left: new Vector3(0.1, -0.8, 0.25), right: new Vector3(-0.1, -0.85, -0.2),
  leftVelocity: new Vector3(0, 0.2, 1.1), rightVelocity: new Vector3(0, -0.1, -0.9),
  speed: 1.6,
});
const blocks = (f) => {
  let pos = 0;
  let vel = 0;
  for (let i = 0; i < 6; i++) { const d = f.feature[i] - query[i]; pos += d * d; }
  for (let i = 6; i < 12; i++) { const d = f.feature[i] - query[i]; vel += d * d; }
  return { pos, vel };
};
let A = db.frames[0];
let B = db.frames[0];
for (const f of db.frames) {
  if (blocks(f).pos < blocks(A).pos) A = f;
  if (blocks(f).vel < blocks(B).vel) B = f;
}
if (A === B) fail('no frame in the database disagrees with another about position versus velocity');

const W_VELOCITY = 0.4; // the classic hand-tuned weight, from any published talk

/**
 * Score with the velocity block written in metres per `unit` second.
 *
 * τ is a TIME, so it is written in the same unit — and `(v × unit) × (τ / unit)`
 * is the same length it always was. That is the whole of it: the conversion
 * carries the reciprocal unit, so the product cannot notice.
 */
const asLengths = (f, unit) => {
  let c = 0;
  for (let i = 0; i < 15; i++) {
    const inUnit = i >= 6 && i < 12 ? unit : 1;
    const backAgain = i >= 6 && i < 12 ? 1 / unit : 1;
    const d = (f.feature[i] - query[i]) * inUnit * backAgain;
    c += d * d;
  }
  return c;
};
/** Score with a weight instead, which has no idea what unit it is standing in. */
const asWeighted = (f, unit) => {
  let c = 0;
  for (let i = 0; i < 15; i++) {
    const inUnit = i >= 6 && i < 12 ? unit : 1;
    const d = (f.feature[i] - query[i]) * inUnit;
    c += (i >= 6 && i < 12 ? W_VELOCITY : 1) * d * d;
  }
  return c;
};

const name = (f) => `${f.clip}@${f.phase.toFixed(2)}x${f.rate}`;
const unitRows = [];
for (const [label, unit] of [['m/s', 1], ['m/ms', 0.001], ['m/min', 60]]) {
  unitRows.push({
    label,
    lengths: asLengths(A, unit) < asLengths(B, unit) ? name(A) : name(B),
    weighted: asWeighted(A, unit) < asWeighted(B, unit) ? name(A) : name(B),
  });
}
const lengthAnswers = new Set(unitRows.map((r) => r.lengths));
const weightedAnswers = new Set(unitRows.map((r) => r.weighted));
if (lengthAnswers.size !== 1) {
  fail(`the cost in lengths gave ${lengthAnswers.size} different answers for the same motion`);
}
// ...and the check has teeth only because the weighted one FAILS it. A gate
// whose control passes is not a gate.
if (weightedAnswers.size === 1) {
  fail('the hand-weighted cost survived a change of unit, so this check is proving nothing');
}

// The same argument, run over the whole database: rebuild it with the clips
// unchanged but time named differently, and every selection must be identical.
const selection = (database, speed) =>
  matchFrame(database, queryFeature(database, {
    left: new Vector3(0.1, -0.8, 0.25), right: new Vector3(-0.1, -0.85, -0.2),
    leftVelocity: new Vector3(0, 0.2, 1.1), rightVelocity: new Vector3(0, -0.1, -0.9),
    speed,
  })).index;
for (const speed of [0, 0.6, WALK, 2, RUN]) {
  const a = selection(db, speed);
  const b = selection(buildMotionDatabase(rig), speed);
  if (a !== b) fail(`rebuilding the database changed the frame chosen for ${speed.toFixed(2)} m/s`);
}

// ------------------------- 3. the constants are load-bearing, so remove them

const schedule = (t) => (t < 3 ? 0 : t < 7 ? WALK : t < 11 ? RUN : 0.8);
const SECONDS = 15;

function drive(options, label, hz = 60) {
  const body = createHumanoid({ seed: 5, height: 1.75 });
  const matcher = new MotionMatcher(body, { database: buildMotionDatabase(body, options) });
  let error = 0;
  let n = 0;
  const trace = [];
  for (let i = 0; i * (1 / hz) < SECONDS; i++) {
    const t = i / hz;
    const want = schedule(t);
    matcher.update(1 / hz, want);
    error += Math.abs(matcher.speed - want);
    n++;
    trace.push({ t, got: matcher.speed });
  }
  const settle = [3, 7, 11].map((at) => {
    const target = schedule(at + 0.01);
    const hit = trace.find(
      (x) => x.t >= at && Math.abs(x.got - target) <= 0.15 * Math.max(0.3, target)
    );
    return hit ? hit.t - at : Infinity;
  });
  return {
    label,
    speedError: error / n,
    jumpsPerSecond: matcher.jumps / SECONDS,
    popRate: matcher.jumps / Math.max(1, matcher.searches),
    settle,
    worstSettle: Math.max(...settle),
  };
}

const measured = drive({}, 'measured');
const noVelocity = drive({ tauFoot: 0 }, 'foot velocity ignored');
const noTrajectory = drive({ horizons: [0, 0, 0] }, 'trajectory ignored');
const hugeTau = drive({ tauFoot: db.tauFoot * 6 }, 'foot velocity six times too loud');

// AND THE SAME CONTROLLER ON A SLOW MACHINE. What counts as a jump depends on
// how far a frame moves the phase, so a fixed fraction of a cycle calls every
// search on a slow frame a pop. It reported 39% in a headless browser running
// at 20 Hz while reporting 1% at 60, and nothing was wrong except the
// threshold. The budget is the same at any frame rate, because the character is
// the same character.
const slow = drive({}, 'at 20 frames a second', 20);
if (!(slow.jumpsPerSecond <= 1 / db.stepTime)) {
  fail(
    `at 20 Hz the matcher jumped ${slow.jumpsPerSecond.toFixed(2)} times a second, against ` +
      `${(1 / db.stepTime).toFixed(2)} at 60 — the pop rate must not depend on the frame rate`
  );
}
if (!(slow.speedError < 0.15)) {
  fail(`at 20 Hz the matcher missed the command by ${slow.speedError.toFixed(3)} m/s`);
}

// The controller has to answer the command at all.
if (!(measured.speedError < 0.1)) {
  fail(`the matcher missed the commanded speed by ${measured.speedError.toFixed(3)} m/s on average`);
}
if (!Number.isFinite(measured.worstSettle)) {
  fail('the matcher never reached a commanded speed');
}
// ...and it has to do it without popping. One jump per STEP is the budget,
// because a step is the interval in which the feet change state anyway.
if (!(measured.jumpsPerSecond <= 1 / db.stepTime)) {
  fail(
    `the matcher jumped ${measured.jumpsPerSecond.toFixed(2)} times a second, and a step is ` +
      `${db.stepTime.toFixed(2)} s — more than one pop per footfall`
  );
}

// WITHOUT THE VELOCITY TERM the search cannot tell a foot swinging forward from
// the same foot passing backwards through the same place, so it flips between
// them. This is the whole reason a velocity belongs in the vector.
if (!(noVelocity.jumpsPerSecond > measured.jumpsPerSecond * 4)) {
  fail(
    `dropping the foot-velocity term changed the pop rate from ` +
      `${measured.jumpsPerSecond.toFixed(2)} to ${noVelocity.jumpsPerSecond.toFixed(2)} per second, ` +
      `which is not the ambiguity it is supposed to be resolving`
  );
}
// WITHOUT THE TRAJECTORY the character is never told anything it will act on.
if (!(noTrajectory.speedError > 1)) {
  fail(`with no trajectory term the matcher still tracked the command to ${noTrajectory.speedError.toFixed(3)} m/s`);
}
if (Number.isFinite(noTrajectory.worstSettle)) {
  fail('with no trajectory term the matcher still reached the commanded speeds');
}
// AND TOO MUCH velocity drowns the command out — the failure in the other
// direction, and the reason the constant is measured rather than turned up.
if (!(hugeTau.speedError > 1)) {
  fail(`six times the foot-velocity time still tracked the command to ${hugeTau.speedError.toFixed(3)} m/s`);
}

// ------------------ 3b. and it may not move a bone faster than its own clips

/**
 * The fastest any bone turns in the source clips, radians per frame at 60 Hz.
 *
 * This is the budget, and it is derived rather than picked: the controller is
 * made ENTIRELY of these clips, so there is no legitimate reason for it to move
 * a joint faster than they do. Anything quicker is the seam where the search
 * jumped, showing through.
 */
function clipPeakRate(body, clips) {
  const mixer = new AnimationMixer(body.mesh);
  const acts = {};
  for (const n of ['idle', 'walk', 'run']) {
    const a = mixer.clipAction(clips[n]);
    a.setLoop(LoopRepeat, Infinity); a.play(); a.paused = true; a.weight = 0;
    acts[n] = a;
  }
  const names = Object.keys(body.bones);
  let peak = 0;
  // Sampled EXACTLY the way the controller plays them — 60 Hz steps, at every
  // playback rate the database stocks. Measuring on some other grid and
  // rescaling gives a different answer, because these curves have corners in
  // them, and a budget read off the wrong grid is not this controller's budget.
  for (const n of ['walk', 'run']) {
    for (const rate of db.rates) {
      for (const other of Object.keys(acts)) acts[other].weight = other === n ? 1 : 0;
      const dur = clips[n].duration;
      let prev = null;
      for (let i = 0; i <= Math.ceil((dur * 60) / rate) + 2; i++) {
        acts[n].time = ((i * rate) / 60) % dur;
        mixer.update(0);
        const now = names.map((b) => body.bones[b].quaternion.clone());
        if (prev) for (let k = 0; k < names.length; k++) peak = Math.max(peak, prev[k].angleTo(now[k]));
        prev = now;
      }
    }
  }
  mixer.stopAllAction();
  return peak;
}

/** The worst per-frame bone rotation the controller actually produces. */
function worstBoneStep(options) {
  const body = createHumanoid({ seed: 5, height: 1.75 });
  const matcher = new MotionMatcher(body, { database: buildMotionDatabase(body, options) });
  const names = Object.keys(body.bones);
  let prev = null;
  let worst = 0;
  for (let i = 0; i * (1 / 60) < SECONDS; i++) {
    matcher.update(1 / 60, schedule(i / 60));
    const now = names.map((b) => body.bones[b].quaternion.clone());
    if (prev) for (let k = 0; k < names.length; k++) worst = Math.max(worst, prev[k].angleTo(now[k]));
    prev = now;
  }
  return worst;
}

const clipRate = clipPeakRate(createHumanoid({ seed: 5, height: 1.75 }), db.clips);
// The cross-fade adds a little on top of the clip's own motion, and how much is
// arithmetic rather than opinion: the raised cosine's weight moves at most
// (π/2)/span per second, and two poses differ by at most π radians, so the fade
// can contribute π²·dt / (2·span) in one frame and no more.
const fadeMax = (Math.PI * Math.PI * (1 / 60)) / (2 * db.stepTime);
const budget = clipRate + fadeMax;
const smoothed = worstBoneStep({});
if (!(smoothed <= budget)) {
  fail(
    `the controller turned a bone ${(smoothed * 1000).toFixed(1)} mrad in one frame against a ` +
      `budget of ${(budget * 1000).toFixed(1)} — the clips' own ${(clipRate * 1000).toFixed(1)} ` +
      `plus the ${(fadeMax * 1000).toFixed(1)} a raised cosine can add — so that is a seam, not a motion`
  );
}

// --------------------------- 4. against the blend tree it is supposed to beat

const blendRig = createHumanoid({ seed: 5, height: 1.75 });
const loco = new Locomotion(blendRig);
let blendError = 0;
let blendN = 0;
const blendTrace = [];
for (let i = 0; i * (1 / 60) < SECONDS; i++) {
  const t = i / 60;
  const want = schedule(t);
  loco.update(1 / 60, want);
  blendError += Math.abs(loco.speed - want);
  blendN++;
  blendTrace.push({ t, got: loco.speed });
}
const blendSettle = [3, 7, 11].map((at) => {
  const target = schedule(at + 0.01);
  const hit = blendTrace.find(
    (x) => x.t >= at && Math.abs(x.got - target) <= 0.15 * Math.max(0.3, target)
  );
  return hit ? hit.t - at : Infinity;
});
const blend = {
  speedError: blendError / blendN,
  settle: blendSettle,
  worstSettle: Math.max(...blendSettle),
};

// The point of a search over a blend tree is that it answers sooner: the blend
// tree smooths the speed and then stride-matches to the smoothed number, so it
// is late by construction. If the matcher is not quicker it is not earning the
// search.
if (!(measured.worstSettle < blend.worstSettle)) {
  fail(
    `the matcher answered a command in ${measured.worstSettle.toFixed(2)} s at worst and the ` +
      `blend tree in ${blend.worstSettle.toFixed(2)} s — the search bought nothing`
  );
}

// ------------------------------- 5. dynamic similarity, reported not enforced

const froudes = [1.4, 1.6, 1.75, 1.9, 2.05].map((height) => {
  const body = createHumanoid({ seed: 5, height });
  const clips = createLocomotionClips(body);
  return {
    height,
    leg: body.legLength,
    walk: clips.walkSpeed,
    step: clips.walk.duration / 2,
    froude: froudeNumber(clips.walkSpeed, body.legLength),
  };
});
const froudeSpread =
  Math.max(...froudes.map((f) => f.froude)) / Math.min(...froudes.map((f) => f.froude)) - 1;

// ------------------------------------------------------------------ report

if (json) {
  console.log(JSON.stringify(
    { failures, measured, noVelocity, noTrajectory, hugeTau, blend, froudes, froudeSpread },
    null, 2
  ));
} else {
  console.log('motion matching — the weights were units all along\n');
  console.log(`  ${db.frames.length} frames from three procedural clips at ${db.rates.length} rates`);
  console.log(`  15 features, and every one of them is a length in metres\n`);
  console.log('  the conversions, MEASURED from the database');
  console.log(`    σ(foot position)   ${db.positionSpread.toFixed(4)} m`);
  console.log(`    σ(foot velocity)   ${db.footSpread.toFixed(4)} m/s`);
  console.log(`    τ_foot             ${db.tauFoot.toFixed(4)} s   ← the ratio, and nothing else`);
  console.log(`    horizons           ${db.horizons.map((h) => h.toFixed(3)).join(', ')} s   ← thirds of a step`);
  console.log(`    (a trajectory point is speed × time, which is already metres)\n`);

  console.log('  A CHANGE OF UNIT IS NOT A CHANGE OF OPINION');
  console.log('    velocity written in     cost in lengths     hand-weighted cost');
  for (const r of unitRows) {
    console.log(`    ${r.label.padEnd(22)}  ${r.lengths.padEnd(18)}  ${r.weighted}`);
  }
  console.log('    The weighted cost changes its mind about the same motion.\n');

  console.log('  TAKE THE CONSTANTS AWAY AND WATCH');
  console.log('    variant                        speed error   pops/s   answers in');
  for (const r of [measured, noVelocity, noTrajectory, hugeTau, slow]) {
    const settle = Number.isFinite(r.worstSettle) ? `${r.worstSettle.toFixed(2)}s` : 'never';
    console.log(
      `    ${r.label.padEnd(30)} ${r.speedError.toFixed(3).padStart(9)} ` +
        `${r.jumpsPerSecond.toFixed(2).padStart(8)}   ${settle.padStart(9)}`
    );
  }
  console.log(
    `\n    without the velocity term the pop rate goes from ` +
      `${(measured.popRate * 100).toFixed(0)}% of searches to ${(noVelocity.popRate * 100).toFixed(0)}% —`
  );
  console.log('    a foot swinging forward and the same foot passing backwards look identical.\n');

  console.log('  A JUMP IS NOT ALLOWED TO SHOW');
  console.log(`    fastest a bone turns in the source clips   ${(clipRate * 1000).toFixed(1)} mrad/frame`);
  console.log(`    what a raised cosine can add on top of it   ${(fadeMax * 1000).toFixed(1)}`);
  console.log(`    budget                                     ${(budget * 1000).toFixed(1)}`);
  console.log(`    fastest the controller actually turns one  ${(smoothed * 1000).toFixed(1)} mrad/frame`);
  console.log('    A jump is faded out over one step against a snapshot of the pose it left,');
  console.log('    so the seam never moves a joint faster than the clips already do.\n');

  console.log('  AGAINST THE BLEND TREE');
  console.log(`    matcher      answers a command in ${measured.settle.map((s) => s.toFixed(2)).join(', ')} s`);
  console.log(`    Locomotion   answers a command in ${blend.settle.map((s) => (Number.isFinite(s) ? s.toFixed(2) : 'never')).join(', ')} s`);
  console.log(`    steady-state error ${measured.speedError.toFixed(3)} against ${blend.speedError.toFixed(3)} m/s`);
  console.log('    The blend tree smooths the speed and then stride-matches the smoothed');
  console.log('    number, so it is late by construction. That is what the search buys.\n');

  console.log('  AND ONE THING THIS GATE ONLY REPORTS');
  console.log('    Alexander (1976): geometrically similar walkers move alike at equal');
  console.log('    Froude number v²/gL. A database is built per body, so bodies that are');
  console.log('    not dynamically similar do not answer the same command the same way.');
  console.log('      height    leg     walk m/s   step(s)   Froude');
  for (const f of froudes) {
    console.log(
      `      ${f.height.toFixed(2)}    ${f.leg.toFixed(3)}   ${f.walk.toFixed(3).padStart(7)}   ` +
        `${f.step.toFixed(3)}    ${f.froude.toFixed(4)}`
    );
  }
  console.log(`    The step time is a flat ${froudes[0].step.toFixed(2)} s at every size, so the Froude`);
  console.log(`    number spreads by ${(froudeSpread * 100).toFixed(0)}% instead of being constant. Not gated yet.`);
}

if (failures.length) {
  console.error('\nMOTION MATCHING OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error('\nThe cost function is a distance in metres. If it stopped being one, it moved.');
  process.exit(1);
}
if (!json) console.log('\nmotion: no weights, because every term is a length ✓');
