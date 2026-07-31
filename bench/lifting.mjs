/**
 * Does a set of lifting look like a set, and does it stay balanced?
 *
 *   npm run lifting            check every claim
 *   npm run lifting -- --why   print the whole table
 *
 * The fifth of ANIMA's gates, after `skate` (feet on the ground), `climb`
 * (hands on rungs), `parkour` (hands and feet on the wall) and `mood` (a layer
 * given back).
 *
 * Lifting fails in ways nothing else here can see. A screenshot of a squat is a
 * person crouching; it says nothing about whether the bar was over their feet,
 * whether the rep took as long coming down as going up, or whether rep eight
 * differed from rep one at all — and those three are the entire difference
 * between a lift and a crouch on a loop. Nine failures, all silent:
 *
 *   OFF THE PLUMB   a bar drifting forward of mid-foot. The first thing a coach
 *                   corrects, and physically the difference between lifting a
 *                   weight and falling over.
 *   NEVER UGLIER    a bar path identical on rep eight and rep one, which means
 *                   the fatigue model reaches nothing anyone can see.
 *   SYMMETRIC       a rep that takes as long to lower as to lift. This is what
 *                   a sine gives you free, and it is the instant tell.
 *   NO DECAY        a set of eight identical reps — a loop wearing a counter.
 *   SLIDING FEET    the same defect `npm run skate` exists for, in a movement
 *                   where the feet are supposed to be nailed down all set.
 *   OFF THE BAR     hands that are not on the thing they are lifting. The
 *                   climb gate's failure, one movement over.
 *   A POP           the load teleporting at a rep boundary. Measured at 441 mm
 *                   once, from a set that reset to lockout when it ended.
 *   INVISIBLE       a rep whose load barely moves.
 *   CLIP DISAGREES  `createLiftClip` and `Lifting` are two routes to the same
 *                   rep one. If they part company, one of them is lying, and
 *                   the clip is the one twenty background lifters will use.
 */
import {
  createHumanoid,
  createLiftClip,
  LIFTS,
  LIFT_NAMES,
  Lifting,
  measureBarPath,
  repsInReserve,
} from '../dist/index.js';
import { AnimationMixer, Vector3 } from 'three';

const SEEDS = [1, 5, 12, 21, 33, 47];
const BUDGET = {
  /**
   * Metres the load may sit off the plumb line, worst frame of the whole set.
   *
   * NOT a tolerance someone picked: a bar more than about five centimetres
   * forward of mid-foot is the fault every coaching cue in the sport exists to
   * fix, because it is where the lifter starts falling over. The solve puts
   * rep one at zero by construction; what this bounds is how far the fatigue
   * drift is allowed to take it by rep eight.
   */
  plumb: 0.05,
  /**
   * …and metres it MUST be off it by the last rep.
   *
   * Two-sided on purpose. The upper bound says the form stays inside coaching
   * tolerance; the lower says the fatigue model reached the bar at all. With
   * the form drift deleted the tremor alone still moves the load 2–4 mm and a
   * one-sided "worse than rep one" check passed happily — which is how a gate
   * ends up proving that a number is not exactly zero.
   */
  drift: 0.01,
  /** Metres a planted foot may move. A lift is not a walk. */
  slip: 0.005,
  /** Metres a hand may sit off the bar it is holding. */
  grip: 0.015,
  /**
   * Metres the load may move in one 1/120 s frame.
   *
   * A ceiling on discontinuity rather than on speed: 30 mm a frame is 3.6 m/s,
   * far above anything a barbell does and far below a rep boundary teleporting.
   */
  pop: 0.03,
  /** Metres SOMETHING must travel on a rep — the load, or the lifter. */
  range: 0.15,
  /** Eccentric ÷ concentric, from the motion. Anything near 1 is a sine. */
  tempo: 1.35,
  /** …and the other way for a movement that is thrown rather than lowered. */
  ballistic: 0.85,
  /** Last rep's depth ÷ first rep's: it must fall, and must not collapse. */
  depth: [0.75, 0.97],
  /** Last rep's duration ÷ first rep's: it must measurably slow. */
  slower: 1.05,
  /** Metres `createLiftClip` may differ from `Lifting` over rep one. */
  clip: 0.008,
};

const why = process.argv.includes('--why');
const failures = [];
const rows = [];

// ── 1..7. Drive a real set of every lift on every body ────────────────────
const worst = {
  plumb: [0, ''],
  slip: [0, ''],
  grip: [0, ''],
  pop: [0, ''],
  range: [Infinity, ''],
  tempo: [Infinity, ''],
  ballistic: [0, ''],
  depth: [0, ''],
  slower: [Infinity, ''],
};
const keep = (key, value, cmp, at) => {
  if (cmp(value, worst[key][0])) worst[key] = [value, at];
};
const gt = (a, b) => a > b;
const lt = (a, b) => a < b;

for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  for (const name of LIFT_NAMES) {
    const spec = LIFTS[name];
    const r = measureBarPath(rig, name);
    const at = `seed ${seed}, ${name}`;
    if (seed === SEEDS[1]) rows.push([name, r]);

    if (spec.plumb !== 'free') keep('plumb', r.plumbDeviation, gt, at);
    keep('slip', r.slip, gt, at);
    keep('grip', r.gripGap, gt, at);
    keep('pop', r.pop, gt, at);
    keep('range', Math.max(r.range, r.bodyRange), lt, at);
    if (spec.ballistic) keep('ballistic', r.tempo, gt, at);
    else keep('tempo', r.tempo, lt, at);
    keep('depth', r.depthDecay, gt, at);
    keep('slower', r.timeDecay, lt, at);

    // The set has to get UGLIER, by a centimetre and not by a rounding error.
    // A fatigue model nobody can see is a number in a struct; this is the only
    // check that says it reached the bar.
    if (spec.plumb === 'midfoot' && r.plumbDeviation < BUDGET.drift) {
      failures.push(
        `NEVER UGLIER: ${at} — rep 8's bar path is only ` +
          `${(r.plumbDeviation * 1000).toFixed(1)} mm off, from ` +
          `${(r.plumbEarly * 1000).toFixed(1)} mm on rep 1; the set never degrades`
      );
    }
    if (r.depthDecay < BUDGET.depth[0]) {
      failures.push(`COLLAPSED: ${at} — last rep reached only ${(r.depthDecay * 100).toFixed(0)}% of the first`);
    }
  }
}

if (worst.plumb[0] > BUDGET.plumb) {
  failures.push(`OFF THE PLUMB: the load sat ${(worst.plumb[0] * 1000).toFixed(1)} mm off the line (${worst.plumb[1]})`);
}
if (worst.slip[0] > BUDGET.slip) {
  failures.push(`SLIDING FEET: a planted foot moved ${(worst.slip[0] * 1000).toFixed(1)} mm (${worst.slip[1]})`);
}
if (worst.grip[0] > BUDGET.grip) {
  failures.push(`OFF THE BAR: a hand sat ${(worst.grip[0] * 1000).toFixed(1)} mm off the load (${worst.grip[1]})`);
}
if (worst.pop[0] > BUDGET.pop) {
  failures.push(`A POP: the load jumped ${(worst.pop[0] * 1000).toFixed(1)} mm in one frame (${worst.pop[1]})`);
}
if (worst.range[0] < BUDGET.range) {
  failures.push(`INVISIBLE: nothing travelled more than ${(worst.range[0] * 1000).toFixed(0)} mm on a rep (${worst.range[1]})`);
}
if (worst.tempo[0] < BUDGET.tempo) {
  failures.push(`SYMMETRIC: eccentric only ${worst.tempo[0].toFixed(2)}x the concentric (${worst.tempo[1]})`);
}
if (worst.ballistic[0] > BUDGET.ballistic) {
  failures.push(`NOT BALLISTIC: a thrown movement lowered ${worst.ballistic[0].toFixed(2)}x slower than it lifted (${worst.ballistic[1]})`);
}
if (worst.depth[0] > BUDGET.depth[1]) {
  failures.push(`NO DECAY: last rep still reached ${(worst.depth[0] * 100).toFixed(1)}% of the first (${worst.depth[1]})`);
}
if (worst.slower[0] < BUDGET.slower) {
  failures.push(`NO GRIND: last rep took only ${worst.slower[0].toFixed(3)}x as long as the first (${worst.slower[1]})`);
}

// ── 8. The clip and the controller are two routes to the same rep one ─────
// Independent by construction: one is 30 fps of sampled keyframes played by a
// three.js mixer, the other is the live solve at whatever step it is given. If
// they agree, both are right about rep one; if they do not, the background
// crowd is doing something the foreground lifter is not.
let clipGap = 0;
let clipAt = '';
for (const seed of [5, 21]) {
  for (const name of LIFT_NAMES) {
    const a = createHumanoid({ seed });
    const b = createHumanoid({ seed });
    const clip = createLiftClip(a, name);
    const mixer = new AnimationMixer(a.object);
    mixer.clipAction(clip).play();
    const set = new Lifting(b, name, { fade: 0, reps: 1 });
    const frames = 48;
    const step = clip.duration / frames;
    for (let i = 1; i <= frames; i++) {
      mixer.setTime(i * step);
      a.object.updateWorldMatrix(true, true);
      set.update(step);
      const gap = a.bones.LeftHand
        .getWorldPosition(new Vector3())
        .distanceTo(b.bones.LeftHand.getWorldPosition(new Vector3()));
      if (gap > clipGap) {
        clipGap = gap;
        clipAt = `seed ${seed}, ${name}`;
      }
    }
  }
}
if (clipGap > BUDGET.clip) {
  failures.push(`CLIP DISAGREES: ${(clipGap * 1000).toFixed(1)} mm between clip and controller (${clipAt})`);
}

// ── 9. A set can be lost ─────────────────────────────────────────────────
// The Epley budget is the whole fatigue model, so it has to be watched doing
// something. Near a maximum, twelve reps is not on offer and the set must end
// short — and at a warm-up weight it must not.
const rig = createHumanoid({ seed: 5 });
const heavy = measureBarPath(rig, 'squat', { load: LIFTS.squat.oneRepMax * 0.93, reps: 12 });
const light = measureBarPath(rig, 'squat', { load: LIFTS.squat.oneRepMax * 0.4, reps: 12 });
if (!heavy.failed) {
  failures.push(`NEVER FAILS: twelve reps at 93% of a maximum went up (${heavy.reps} reps, Epley says ${repsInReserve(LIFTS.squat.oneRepMax * 0.93, LIFTS.squat.oneRepMax).toFixed(1)})`);
}
if (light.failed) {
  failures.push(`FAILS A WARM-UP: twelve reps at 40% of a maximum did not finish (${light.reps} reps)`);
}

// ── 10. The solve adapts, which is the reason it is a solve ──────────────
// Same legs, same body, load moved 9 cm forward. If the torso does not come up
// to meet it, the pitch is being authored somewhere and nobody noticed.
let upright = null;
for (const seed of SEEDS) {
  const r = createHumanoid({ seed });
  const back = measureBarPath(r, 'squat').bottomPitch;
  const front = measureBarPath(r, 'frontSquat').bottomPitch;
  if (!(front < back - 0.2)) {
    upright = `seed ${seed}: back ${back.toFixed(2)} rad, front ${front.toFixed(2)} rad`;
  }
}
if (upright) {
  failures.push(`SOLVE IS NOT SOLVING: a front squat leans as far as a back squat (${upright})`);
}

if (why) {
  console.log(
    '  lift              plumb₁  plumb₈   range    body  tempo   late   depth   time    slip   grip    pop'
  );
  console.log('  ' + '-'.repeat(96));
  const mm = (v) => (v * 1000).toFixed(1).padStart(6);
  for (const [name, r] of rows) {
    console.log(
      `  ${name.padEnd(17)}${mm(r.plumbEarly)}${mm(r.plumbDeviation)}${mm(r.range)}${mm(r.bodyRange)}` +
        `${r.tempo.toFixed(2).padStart(7)}${r.tempoLate.toFixed(2).padStart(7)}` +
        `${r.depthDecay.toFixed(3).padStart(8)}${r.timeDecay.toFixed(3).padStart(7)}` +
        `${mm(r.slip)}${mm(r.gripGap)}${mm(r.pop)}`
    );
  }
  console.log();
}

console.log(`lifting: ${LIFT_NAMES.length} movements, a full set of each on ${SEEDS.length} bodies`);
console.log(`  bar path          ${(worst.plumb[0] * 1000).toFixed(1)} mm off the plumb line   (${worst.plumb[1]})   budget ${BUDGET.drift * 1000}–${BUDGET.plumb * 1000} mm`);
console.log(`  rep asymmetry     ${worst.tempo[0].toFixed(2)}x eccentric   (${worst.tempo[1]})   budget ${BUDGET.tempo}x`);
console.log(`  ballistic         ${worst.ballistic[0].toFixed(2)}x   (${worst.ballistic[1]})   budget under ${BUDGET.ballistic}x`);
console.log(`  rep decay         depth to ${(worst.depth[0] * 100).toFixed(1)}%, duration to ${worst.slower[0].toFixed(3)}x   budget under ${BUDGET.depth[1] * 100}% and over ${BUDGET.slower}x`);
console.log(`  feet planted      ${(worst.slip[0] * 1000).toFixed(2)} mm   budget ${BUDGET.slip * 1000} mm`);
console.log(`  hands on the bar  ${(worst.grip[0] * 1000).toFixed(1)} mm   (${worst.grip[1]})   budget ${BUDGET.grip * 1000} mm`);
console.log(`  no pops           ${(worst.pop[0] * 1000).toFixed(1)} mm per frame   (${worst.pop[1]})   budget ${BUDGET.pop * 1000} mm`);
console.log(`  it reads          ${(worst.range[0] * 1000).toFixed(0)} mm of travel   (${worst.range[1]})   budget ${BUDGET.range * 1000} mm`);
console.log(`  clip vs live      ${(clipGap * 1000).toFixed(1)} mm over rep one   (${clipAt})   budget ${BUDGET.clip * 1000} mm`);
console.log(`  a set can be lost 93% of a max ended at rep ${heavy.reps} of 12; 40% finished all ${light.reps}`);

if (failures.length) {
  console.log('\nLIFTING OVER BUDGET');
  for (const f of failures) console.log('  ' + f);
  console.log(
    '\nA screenshot of a squat is a person crouching. It says nothing about\n' +
      'where the bar was, how long the rep took, or whether rep eight differed\n' +
      'from rep one — which is the whole of what this module claims.'
  );
  process.exit(1);
}
console.log('\nlifting: eight reps, and the eighth is not the first ✓');
