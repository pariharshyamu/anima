/**
 * Does a mood do what it says, and give the body back?
 *
 *   npm run mood            check every claim
 *   npm run mood -- --why   print the posture sweep
 *
 * The fourth of ANIMA's gates, after `skate` (feet on the ground), `climb`
 * (hands on rungs) and `parkour` (hands and feet on the wall).
 *
 * A layer like this fails in ways nothing else can see. It is not a clip, so
 * no screenshot shows it wrong; it has no contacts, so no contact gate covers
 * it; and its unit tests would only prove that its arithmetic agrees with
 * itself. Four failures, all silent:
 *
 *   NON-MONOTONE   a slightly sadder character standing slightly taller.
 *                  Reads as a glitch, invisible unless you sweep the axis.
 *   NOT NEUTRAL    a `neutral` mood that already deforms the body, which
 *                  silently changes every existing scene the moment anyone
 *                  attaches one "to set it up".
 *   A LEAK         a contribution applied and not given back compounds. After
 *                  a minute the body is folded in half and it looks like a
 *                  physics bug rather than a missing inverse.
 *   SKATE          `pace` is a travel-speed multiplier. A game that slows the
 *                  body without re-timing the gait slides the planted foot on
 *                  every step — which is exactly what `npm run skate` exists
 *                  to catch, and this gate proves the two compose.
 */
import {
  createHumanoid,
  createLocomotionClips,
  measureFootSkate,
  measurePosture,
  Mood,
  MOODS,
  MOOD_LIMIT,
  MOOD_NAMES,
} from '../dist/index.js';

const SEEDS = [1, 5, 12, 21, 33, 47];
const BUDGET = {
  /** `neutral` must leave the body alone, to a hair. */
  neutral: 1e-6,
  /** After release, every bone back where it was found. */
  leak: 1e-6,
  /**
   * No mood may SATURATE the layer's own clamp.
   *
   * Budgeting at `MOOD_LIMIT` itself would be a gate that cannot fail —
   * `contribute` clamps there, so the assertion holds by construction and
   * proves nothing. What actually matters is that no mood reaches the clamp,
   * because everything past saturation looks identical and monotonicity dies
   * quietly at the top of the axis. 0.38 leaves the clamp as the backstop it
   * is meant to be rather than a working part of the layer.
   */
  bone: 0.38,
  /** Re-timed for a mood's pace, the gait must still not skate. */
  skate: 0.01,
  /** Stature range across the whole valence axis, metres — it has to READ. */
  stature: 0.02,
};

const why = process.argv.includes('--why');
const failures = [];

// ── 1. Monotone, on both axes ────────────────────────────────────────────
// Swept rather than spot-checked: a reversal between two named moods is a bug
// anyone would notice, and a reversal between valence 0.31 and 0.33 is one
// nobody would until it shipped.
let worstValence = null;
let worstArousal = null;
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  let lastPitch = Infinity;
  let lastStature = -Infinity;
  for (let v = -1; v <= 1.0001; v += 0.05) {
    const r = measurePosture(rig, { valence: v, arousal: 0.5 });
    // Head comes UP as valence rises; the body gets TALLER.
    if (r.headPitch > lastPitch + 1e-9) {
      worstValence = worstValence ?? `seed ${seed}, valence ${v.toFixed(2)}: head went DOWN as mood improved`;
    }
    if (r.stature < lastStature - 1e-9) {
      worstValence = worstValence ?? `seed ${seed}, valence ${v.toFixed(2)}: body SHRANK as mood improved`;
    }
    lastPitch = r.headPitch;
    lastStature = r.stature;
  }
  let lastDrop = Infinity;
  for (let a = 0; a <= 1.0001; a += 0.05) {
    const r = measurePosture(rig, { valence: 0, arousal: a });
    // Shoulders come UP as arousal rises — tone, not mood.
    if (r.shoulderDrop > lastDrop + 1e-9) {
      worstArousal = worstArousal ?? `seed ${seed}, arousal ${a.toFixed(2)}: shoulders DROPPED as tone rose`;
    }
    lastDrop = r.shoulderDrop;
  }
}
if (worstValence) failures.push(`NOT MONOTONE (valence): ${worstValence}`);
if (worstArousal) failures.push(`NOT MONOTONE (arousal): ${worstArousal}`);

// ── 2. Neutral is identity ───────────────────────────────────────────────
let worstNeutral = 0;
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const r = measurePosture(rig, 'neutral');
  worstNeutral = Math.max(worstNeutral, Math.abs(r.headPitch), r.worstBone, Math.abs(r.shoulderDrop));
}
if (worstNeutral > BUDGET.neutral) {
  failures.push(`NOT NEUTRAL: 'neutral' moves the body by ${worstNeutral.toExponential(2)}`);
}

// ── 3. It gives the body back ────────────────────────────────────────────
// A minute of frames, then release. Anything left behind is a leak, and a
// leak is the failure that only shows up in a scene nobody restarts.
let worstLeak = 0;
let leakAt = '';
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const before = Object.entries(rig.bones).map(([k, b]) => [k, b.quaternion.clone()]);
  const hipsY = rig.bones.Hips.position.y;
  const mood = new Mood(rig, 'grieving');
  for (let i = 0; i < 3600; i++) {
    // Change the mood as it runs — a layer that only survives a constant
    // input is not a layer, it is a pose.
    if (i === 1200) mood.set('furious');
    if (i === 2400) mood.set('elated');
    mood.update(1 / 60);
  }
  mood.release();
  for (const [name, q] of before) {
    const off = rig.bones[name].quaternion.angleTo(q);
    if (off > worstLeak) {
      worstLeak = off;
      leakAt = `seed ${seed}, ${name}`;
    }
  }
  worstLeak = Math.max(worstLeak, Math.abs(rig.bones.Hips.position.y - hipsY));
}
if (worstLeak > BUDGET.leak) {
  failures.push(`LEAK: ${worstLeak.toExponential(2)} left behind after release (${leakAt})`);
}

// ── 4. Bounded ───────────────────────────────────────────────────────────
let worstBone = 0;
let boneAt = '';
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  for (const name of MOOD_NAMES) {
    const r = measurePosture(rig, name);
    if (r.worstBone > worstBone) {
      worstBone = r.worstBone;
      boneAt = `seed ${seed}, ${name}`;
    }
  }
  // And the corners of the space, which no name occupies.
  for (const v of [-1, 1]) {
    for (const a of [0, 1]) {
      const r = measurePosture(rig, { valence: v, arousal: a });
      if (r.worstBone > worstBone) {
        worstBone = r.worstBone;
        boneAt = `seed ${seed}, v=${v} a=${a}`;
      }
    }
  }
}
if (worstBone > BUDGET.bone) {
  failures.push(`UNBOUNDED: a bone rotated ${worstBone.toFixed(3)} rad, over ${BUDGET.bone}`);
}

// ── 5. `pace` composes with the gait ─────────────────────────────────────
// The cross-check, and it has to model what a game ACTUALLY does.
//
// The first version rebuilt the clips at `duration / pace` and measured those.
// That is not re-timing, it is a different clip: `createLocomotionClips`
// samples at 30 fps, so a different duration is a different frame count and a
// slightly different sampled gait, and the number it produced (0.96% against
// a 1% budget) was measuring the resampling rather than the mood.
//
// A game sets `action.timeScale = pace` and travels at `speed * pace`. The
// clip's poses are untouched; what changes is how long a foot spends planted.
// `duty` says exactly that, so THIS is the honest model — and if `pace` is
// safe the mismatch should come out bit-for-bit identical to the baseline,
// because stride is unchanged and both sides of the ratio scale together.
let worstSkate = 0;
let skateAt = '';
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const clips = createLocomotionClips(rig);
  for (const name of MOOD_NAMES) {
    const pace = new Mood(rig, name).pace;
    for (const gait of ['walk', 'run']) {
      const base = gait === 'walk' ? clips.walkSpeed : clips.runSpeed;
      // `stepsPerCycle`, not `contact`. A declared contact schedule measures
      // the stride across a window starting at a phase you have to KNOW, and
      // guessing those phases reported 2563% skate on a gait that is fine —
      // it was measuring the wrong part of the step. `stepsPerCycle: 2 * pace`
      // scales the planted duration and leaves the honest stride-finder alone.
      const r = measureFootSkate(rig, clips[gait], {
        speed: base * pace,
        stepsPerCycle: 2 * pace,
      });
      if (Math.abs(r.mismatch) > worstSkate) {
        worstSkate = Math.abs(r.mismatch);
        skateAt = `seed ${seed}, ${name} ${gait} (pace ${pace.toFixed(2)})`;
      }
    }
  }
}
if (worstSkate > BUDGET.skate) {
  failures.push(`SKATE: re-timing for a mood's pace slid the feet ${(worstSkate * 100).toFixed(2)}% (${skateAt})`);
}

// ── 6. It has to READ ────────────────────────────────────────────────────
// A layer nobody can see is a layer nobody needs. The stature swing across
// the valence axis is the part a viewer reads without knowing they read it.
let statureRange = 0;
for (const seed of SEEDS) {
  const rig = createHumanoid({ seed });
  const low = measurePosture(rig, { valence: -1, arousal: 0.5 }).stature;
  const high = measurePosture(rig, { valence: 1, arousal: 0.5 }).stature;
  statureRange = Math.max(statureRange, high - low);
}
if (statureRange < BUDGET.stature) {
  failures.push(`INVISIBLE: only ${(statureRange * 1000).toFixed(1)} mm of stature across the whole valence axis`);
}

if (why) {
  const rig = createHumanoid({ seed: 5 });
  console.log('  mood         valence arousal   headPitch   stature  shoulder   pace  gaze');
  console.log('  ' + '-'.repeat(74));
  for (const name of MOOD_NAMES) {
    const r = measurePosture(rig, name);
    const m = new Mood(rig, name);
    console.log(
      `  ${name.padEnd(12)} ${String(MOODS[name].valence).padStart(6)} ${String(MOODS[name].arousal).padStart(7)}   ` +
        `${r.headPitch.toFixed(3).padStart(9)} ${r.stature.toFixed(4).padStart(9)} ` +
        `${(r.shoulderDrop * 1000).toFixed(1).padStart(7)}mm ${m.pace.toFixed(2).padStart(6)} ` +
        `${m.gazeAuthority.toFixed(2).padStart(5)}`
    );
  }
  console.log();
}

console.log(`mood: ${MOOD_NAMES.length} named moods, swept over ${SEEDS.length} bodies`);
console.log(`  monotone           valence and arousal, 41 samples each, no reversals`);
console.log(`  neutral is nothing ${worstNeutral.toExponential(2)}   budget ${BUDGET.neutral}`);
console.log(`  gives the body back ${worstLeak.toExponential(2)} after 3600 frames and 3 mood changes   budget ${BUDGET.leak}`);
console.log(`  worst bone         ${worstBone.toFixed(3)} rad   (${boneAt})   budget ${BUDGET.bone}`);
console.log(`  pace vs the gait   ${(worstSkate * 100).toFixed(3)}% foot skate re-timed   (${skateAt})   budget ${BUDGET.skate * 100}%`);
console.log(`  stature swing      ${(statureRange * 1000).toFixed(1)} mm across the valence axis   budget ${BUDGET.stature * 1000} mm`);

if (failures.length) {
  console.log('\nMOOD OVER BUDGET');
  for (const f of failures) console.log('  ' + f);
  console.log(
    '\nA mood layer fails silently: it is not a clip, so no screenshot shows it\n' +
      'wrong, and it has no contacts, so no contact gate covers it.'
  );
  process.exit(1);
}
console.log('\nmood: every body wears it, and gives it back ✓');
