#!/usr/bin/env node
/**
 * The foot-skate gate.
 *
 *   npm run skate            fail if any clip's feet disagree with its speed
 *   npm run skate -- --json  the same numbers, machine-readable
 *
 * ## Why this exists as a gate and not a test
 *
 * ANIMA's locomotion clips are in-place. Something else moves the character;
 * the clip is played at a rate that is meant to make the feet agree with the
 * ground it covers. Nothing in the type system, the unit tests or a
 * screenshot can tell you whether that rate is right — the clip compiles, the
 * pose is valid, the still frame looks like a person mid-stride — and yet a
 * wrong rate is the single most recognisable failure a procedural character
 * has. Sliding feet.
 *
 * So this measures it. `measureFootSkate` drives a real `AnimationMixer` over
 * the real rig and reads world bone positions; the clips' declared speeds come
 * from closed-form geometry in `clips.ts` and `gaits.ts`. Two independent
 * routes to the same number, compared. That independence is the point, and it
 * is why neither formula may ever be rewritten to call the measurement.
 *
 * All three defects it was written to catch were real, and all three were
 * shipped:
 *
 *   - `createLocomotionClips` used an unmeasured factor of 1.6 for the run's
 *     stride against 1.35 for the walk. The run's declared speed overstated
 *     its real stride by 18.4% on every seed, so `Locomotion` played the clip
 *     18% too slowly for the ground covered — about 15 cm of slide per step.
 *   - `gaitSpeed` predicted the horse's hoof sweep as `2·R·sin(reach)` while
 *     `poseLeg` swung the hind limb through `0.95·reach`. Up to 8.5% of the
 *     horse's declared ground speed was never delivered by its legs.
 *   - `createGaitClips` baked keyframes at a fixed output fps, so `tempo`
 *     bought fewer of them: a 1.4× canter got 13 keyframes where a 1× canter
 *     got 19, the coarse bake rounded off the hoof's arc, and skate doubled to
 *     7.5%. Found only because this sweeps tempo — a gate that had measured
 *     the default would have called it clean.
 *
 * ## Budgets, not baselines
 *
 * A recorded baseline would pin these to five decimal places and fail on any
 * three.js interpolation change, so the numbers are ceilings with headroom
 * over the measured worst case, and the run prints how much of each budget is
 * spent. A budget that could never be hit is decoration: the `used` column and
 * `--json` exist so the headroom can be audited rather than assumed.
 *
 * The mismatches are deterministic — identical across every species, tempo and
 * seed swept below, which is itself the geometry's prediction — so the ceilings
 * sit close, around 1.4× the measured worst.
 *
 * They are not all small. The trotting foreleg is out by 6.5%, because
 * `limbState` widens the shorter foreleg's arc to match the hind's NOMINAL
 * sweep rather than the slightly smaller one it actually drives. Narrowing it
 * to match is the tidier claim and makes both formulas agree exactly — and
 * measurement says it costs more than it buys, moving the cantering forefoot
 * from 3.0% to 8.2%, because a rigid pendulum is a poor model of a foreleg on
 * a horse whose spine flexes through the stride. So it is left alone, reported,
 * and held at a ceiling. Tuning a constant until this table looks better is
 * fitting the code to the measurement, and the measurement stops meaning
 * anything the moment that happens.
 */
import {
  createGaitClips,
  createHumanoid,
  createLocomotionClips,
  createQuadruped,
  GAITS,
  measureFootSkate,
} from '../dist/index.js';

/** Seeds, because a defect that only appears on one body is still a defect. */
const SEEDS = [1, 2, 3, 7, 11, 21, 42, 99, 123, 777, 4096, 31337];

const HOOVES = ['LFHoof', 'RFHoof', 'LHHoof', 'RHHoof'];
const FORE = ['LFHoof', 'RFHoof'];
const HIND = ['LHHoof', 'RHHoof'];

/**
 * Ceilings on |mismatch|, and on `spread` where the feet are supposed to agree
 * with each other. Measured worst cases are in the comments — keep them
 * current, they are what makes the headroom auditable.
 *
 * `spread: null` means the feet are not claimed to agree and so are not gated.
 * A canter has a LEAD: its two hind limbs do different jobs, and the leading
 * one sweeps 40% further than the trailing one. Gating symmetry there would be
 * demanding the gait be wrong. Horses also carry a real fore-versus-hind split
 * (see the note above), so their `spread` is reported and the fore and hind
 * rows hold each end to its own ceiling instead — which is the coverage that
 * gating symmetry would have bought, without the false claim.
 */
const BUDGETS = {
  // `airborne` is 0 for the bipeds and deliberately so: a walk is DEFINED by
  // always having a foot down, and ANIMA's run has no suspension phase (see
  // the stance-flexion note in `clips.ts`). If a real flight phase is ever
  // authored, this is the number that has to be raised on purpose.
  'humanoid walk': { mismatch: 0.01, spread: 0.02, airborne: 0 }, // measured 0.57%, 0.00%, 0%
  'humanoid run': { mismatch: 0.01, spread: 0.02, airborne: 0 }, // measured 0.30%, 0.97%, 0%
  'horse walk': { mismatch: 0.015, spread: null }, // measured 0.82%
  'horse walk fore': { mismatch: 0.015, spread: null }, // measured 0.72%
  'horse walk hind': { mismatch: 0.035, spread: null }, // measured 2.40%
  'horse trot': { mismatch: 0.03, spread: null }, // measured 2.17%
  'horse trot fore': { mismatch: 0.08, spread: null }, // measured 6.52% — the known worst
  'horse trot hind': { mismatch: 0.035, spread: null }, // measured 2.61%
  'horse canter': { mismatch: 0.05, spread: null }, // measured 3.60%
  'horse canter fore': { mismatch: 0.045, spread: null }, // measured 3.04%
  'horse canter hind': { mismatch: 0.06, spread: null }, // measured 4.17%
  'horse gallop': { mismatch: 0.025, spread: null }, // measured 1.77%
  'horse gallop fore': { mismatch: 0.03, spread: null }, // measured 2.02%
  'horse gallop hind': { mismatch: 0.025, spread: null }, // measured 1.52%
};

/** Tracks the worst |value| seen for a label, with the case that set it. */
class Worst {
  constructor() {
    this.rows = new Map();
  }

  add(label, field, value, where) {
    const key = `${label}|${field}`;
    const previous = this.rows.get(key);
    if (!previous || Math.abs(value) > Math.abs(previous.value)) {
      this.rows.set(key, { label, field, value, where });
    }
  }

  get(label, field) {
    return this.rows.get(`${label}|${field}`) ?? { value: 0, where: '—' };
  }
}

const worst = new Worst();
/** Every measurement, for `--json` and for the per-case detail lines. */
const samples = [];

function record(label, where, report) {
  worst.add(label, 'mismatch', report.mismatch, where);
  worst.add(label, 'spread', report.spread, where);
  worst.add(label, 'airborne', report.airborne, where);
  samples.push({
    label,
    where,
    mismatch: report.mismatch,
    spread: report.spread,
    airborne: report.airborne,
    float: report.float,
    stride: report.stride,
    impliedSpeed: report.impliedSpeed,
    speed: report.speed,
    slipPerStep: report.slipPerStep,
    peakDeviation: report.peakDeviation,
  });
  return report;
}

// ---------------------------------------------------------------- humanoids

for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const clips = createLocomotionClips(rig);
  record(
    'humanoid walk',
    `seed ${seed}`,
    measureFootSkate(rig, clips.walk, { speed: clips.walkSpeed })
  );
  record(
    'humanoid run',
    `seed ${seed}`,
    measureFootSkate(rig, clips.run, { speed: clips.runSpeed })
  );
}

// ------------------------------------------------------------------- horses
//
// The hoof reaches further forward in late swing than the point it will
// actually land on, so peak-to-peak overstates the ground a horse covers —
// by 10% on the canter. The gait spec declares exactly when each foot lands
// and for how long, so pass that and measure the contact window instead.

// Seeds are the wrong axis here: `createQuadruped` seeds the coat, markings
// and socks, and NONE of those move a hoof. What varies the geometry is the
// species — 1.15 m at the donkey to 1.75 m at the draught horse — and `tempo`,
// which scales every clip's duration and so its declared speed too. Those are
// what get swept.
const HORSES = [
  ['horse', 1],
  ['pony', 1],
  ['draft', 1],
  ['donkey', 1],
  ['horse', 0.75],
  ['horse', 1.4],
];

for (const [species, tempo] of HORSES) {
  const rig = createQuadruped({ species });
  const clips = createGaitClips(rig, { tempo });
  const where = `${species}${tempo === 1 ? '' : ` @${tempo}×`}`;
  for (const gait of ['walk', 'trot', 'canter', 'gallop']) {
    const spec = GAITS[gait];
    // `contact` is keyed by bone, the gait spec by leg — `LFHoof` vs `LF`.
    const contact = Object.fromEntries(
      Object.entries(spec.contact).map(([leg, phase]) => [`${leg}Hoof`, phase])
    );
    const common = { speed: clips.speeds[gait], contact, duty: spec.duty };
    const shape = (feet) => ({ ...common, feet });
    record(`horse ${gait}`, where, measureFootSkate(rig, clips[gait], shape(HOOVES)));
    // Fore and hind separately: a mean of four hooves can be perfect while the
    // front pair skates forward and the back pair skates back by as much.
    // These name which end is wrong, and each carries its own budget.
    record(`horse ${gait} fore`, where, measureFootSkate(rig, clips[gait], shape(FORE)));
    record(`horse ${gait} hind`, where, measureFootSkate(rig, clips[gait], shape(HIND)));
  }
}

// ------------------------------------------------------------------ verdict

const pct = (v) => `${(v * 100).toFixed(2)}%`;
const failures = [];

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ budgets: BUDGETS, samples }, null, 2));
} else {
  console.log('foot skate — measured from bone transforms, vs each clip\'s declared speed\n');
  console.log('  case                 mismatch   budget   used  spread   budget   worst case');
  console.log('  ' + '-'.repeat(76));
}

for (const [label, budget] of Object.entries(BUDGETS)) {
  const m = worst.get(label, 'mismatch');
  const s = worst.get(label, 'spread');
  const used = Math.abs(m.value) / budget.mismatch;
  if (!process.argv.includes('--json')) {
    console.log(
      `  ${label.padEnd(20)} ${pct(m.value).padStart(8)} ${pct(budget.mismatch).padStart(8)} ` +
        `${(used * 100).toFixed(0).padStart(5)}% ${pct(s.value).padStart(7)} ` +
        `${(budget.spread === null ? 'n/a' : pct(budget.spread)).padStart(8)}   ${m.where}`
    );
  }
  if (Math.abs(m.value) > budget.mismatch) {
    failures.push(
      `${label}: mismatch ${pct(m.value)} exceeds ${pct(budget.mismatch)} (${m.where})`
    );
  }
  if (budget.spread !== null && Math.abs(s.value) > budget.spread) {
    failures.push(`${label}: spread ${pct(s.value)} exceeds ${pct(budget.spread)} (${s.where})`);
  }
  // Is a foot ever DOWN? Skate is a horizontal measurement and cannot see
  // this: ANIMA's own walk had no foot on the ground for 43% of its cycle
  // while this gate passed, every release, for thirty-odd releases.
  const a = worst.get(label, 'airborne');
  if (budget.airborne !== undefined && a.value > budget.airborne) {
    failures.push(
      `${label}: airborne ${pct(a.value)} of the cycle, over ${pct(budget.airborne)} (${a.where})`
    );
  }
}

if (!process.argv.includes('--json')) {
  // Fore vs hind, reported and deliberately not gated: the split is a
  // property of the gait's shape, and the pair budgets above already stop
  // either end from drifting on its own.
  console.log('\n  fore / hind, reported only');
  for (const gait of ['walk', 'trot', 'canter', 'gallop']) {
    const f = worst.get(`horse ${gait} fore`, 'mismatch');
    const h = worst.get(`horse ${gait} hind`, 'mismatch');
    console.log(
      `  horse ${gait.padEnd(14)} fore ${pct(f.value).padStart(8)}   hind ${pct(h.value).padStart(8)}`
    );
  }

  // Intrinsic to a sinusoidal gait — a foot's backward speed peaks mid-step
  // and falls to zero at the extremes, so this is enormous however well the
  // stride is matched. Printed so nobody mistakes its absence for a claim.
  const peak = Math.max(...samples.map((s) => s.peakDeviation));
  const slip = Math.max(...samples.map((s) => Math.abs(s.slipPerStep)));
  console.log(
    `\n  worst instantaneous deviation ${pct(peak)} (intrinsic to a sine gait, not gated)`
  );
  console.log(`  worst slide per step          ${(slip * 1000).toFixed(1)} mm`);
  const air = Math.max(...samples.map((s) => s.airborne));
  const flt = Math.max(...samples.map((s) => s.float));
  const worstAir = samples.find((s) => s.airborne === air);
  console.log(
    `  worst airborne fraction       ${pct(air)} of the cycle  (${worstAir.label}, ${worstAir.where})`
  );
  console.log(`  worst lower-foot float        ${(flt * 1000).toFixed(1)} mm`);
  console.log(
    `\n  ${samples.length} measurements — ${SEEDS.length} humanoid seeds, ` +
      `${HORSES.length} horse builds (species × tempo)`
  );
}

if (failures.length) {
  console.error('\nFOOT SKATE OVER BUDGET');
  for (const line of failures) console.error(`  ${line}`);
  console.error(
    '\nA clip and its declared speed have drifted apart. Either the clip changed\n' +
      'shape, or a stride constant was edited without re-deriving the speed.\n' +
      'Do not raise the budget to make this pass.'
  );
  process.exit(1);
}

if (!process.argv.includes('--json')) console.log('\nfeet agree with the ground ✓');
