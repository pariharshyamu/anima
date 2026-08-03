#!/usr/bin/env node
/**
 * The fencing gate — the nineteenth, and the armed bout.
 *
 *   npm run fencing            fail if the bout stops being a fight
 *   npm run fencing -- --json  the numbers, machine-readable
 *
 * ## What this is for
 *
 * `Sparring` measured two fighters at a fixed gap. That is a measurement rig,
 * and an armed bout cannot be one, because the interesting half of a fight with
 * weapons in it is the FOOTWORK — a sword changes what distance means.
 *
 * So the first thing this gate checks is that they MOVED. A bout where nobody
 * travelled is the thing this release exists to stop shipping.
 *
 * ## And the number that makes an armed bout different
 *
 *   t = √(2θ·I / τ)
 *
 * How long a cut takes, from the blade's own second moment and the couple two
 * hands can make on its hilt. `Blade` publishes the inertia, `Bind` publishes
 * the couple, and neither was written with the other in mind. Nothing in the
 * weapon table says "speed".
 */
import {
  BLADES,
  Fence,
  Fencer,
  bladeTorque,
  createHumanoid,
  cutTime,
  fencerCard,
  footSpeed,
  inertia,
  measureOf,
  poseSwordArm,
  stepLength,
  stepTime,
} from '../dist/index.js';
import { Vector3 } from 'three';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const close = (a, b, tol, what) => {
  if (!(Math.abs(a - b) <= tol)) fail(`${what}: ${a} against ${b}, tolerance ${tol}`);
};

const rig = createHumanoid({ seed: 42 });

// ------------------------------------------ 1. tempo, in closed form

// t = √(2θI/τ), which is θ = ½αt² inverted. Every part of it is published by a
// module that was not written for this one.
const arming = BLADES.arming;
const tau = bladeTorque(arming, 1);
const theta = (120 * Math.PI) / 180;
close(cutTime(arming, theta, tau), Math.sqrt((2 * theta * inertia(arming)) / tau), 1e-12,
  'the cut time is not √(2θI/τ)');
close(cutTime(arming, theta * 4, tau) / cutTime(arming, theta, tau), 2, 1e-12,
  'four times the angle is not twice the time');
close(cutTime(arming, theta, tau * 4) / cutTime(arming, theta, tau), 0.5, 1e-12,
  'four times the torque is not half the time');
if (Number.isFinite(cutTime(arming, theta, 0))) fail('a blade with no torque on it still swings');

// A HEAVIER BLADE IS SLOWER, at the same couple, and by exactly √(I ratio).
close(
  cutTime(BLADES.longsword, theta, tau) / cutTime(arming, theta, tau),
  Math.sqrt(inertia(BLADES.longsword) / inertia(arming)),
  1e-12,
  'the tempo ratio is not the square root of the inertia ratio'
);

// ...but a long grip is a bigger couple, and that is the trade. A longsword is
// heavier AND has two hands on it, so the two effects nearly cancel — which is
// a number rather than an opinion, and it is why the weapon exists.
const oneHanded = fencerCard(rig, { blade: 'arming', hands: 1 });
const twoHanded = fencerCard(rig, { blade: 'longsword', hands: 2 });
if (!(twoHanded.inertia > oneHanded.inertia * 1.5)) fail('a longsword is no longer much harder to turn');
if (!(twoHanded.torque > oneHanded.torque * 1.5)) fail('two hands no longer make a much bigger couple');
if (Math.abs(twoHanded.tempo / oneHanded.tempo - 1) > 0.25) {
  fail(
    `a longsword cuts in ${(twoHanded.tempo / oneHanded.tempo).toFixed(2)}x an arming sword's time — ` +
      `the two effects are supposed to nearly cancel`
  );
}

// -------------------------------------- 2. measure, and footwork

close(measureOf(rig, arming), measureOf(rig, arming), 0, 'measure is not deterministic');
if (!(measureOf(rig, BLADES.spear) > measureOf(rig, arming) * 1.3)) {
  fail('a spear no longer out-measures a sword by much');
}
// A leg is a pendulum: π√(L/g). Nothing in this is a setting.
close(stepTime(rig), Math.PI * Math.sqrt(rig.legLength / 9.81), 1e-12, 'a step is not π√(L/g)');
close(footSpeed(rig, 'boxing'), stepLength(rig, 'boxing') / stepTime(rig), 1e-12,
  'foot speed is not step over step time');
// A long stance steps long.
if (!(stepLength(rig, 'karate') > stepLength(rig, 'boxing'))) {
  fail('a karate stance no longer steps further than a boxing one');
}
// A taller body has a longer, slower step — both, from one bone length.
const tall = createHumanoid({ seed: 42 });
const short = createHumanoid({ seed: 7 });
if (tall.legLength > short.legLength) {
  if (!(stepTime(tall) > stepTime(short))) fail('the taller body does not step more slowly');
  if (!(stepLength(tall, 'boxing') > stepLength(short, 'boxing'))) fail('the taller body does not step further');
}

// --------------------------------------- 3. THEY MOVE. That is the release.

function bout(aBlade, bBlade, seconds = 30) {
  const a = new Fencer(createHumanoid({ seed: 42 }), {
    blade: aBlade, hands: aBlade === 'longsword' || aBlade === 'spear' ? 2 : 1,
    at: new Vector3(-1.8, 0, 0),
  });
  const b = new Fencer(createHumanoid({ seed: 7 }), { blade: bBlade, hands: 1, at: new Vector3(1.8, 0, 0) });
  const f = new Fence(a, b, { roundSeconds: seconds });
  let minGap = Infinity;
  let maxGap = 0;
  const seen = new Set();
  while (!f.done) {
    f.update(1 / 60);
    poseSwordArm(a);
    poseSwordArm(b);
    minGap = Math.min(minGap, f.gap);
    maxGap = Math.max(maxGap, f.gap);
    seen.add(a.phase);
  }
  return { a, b, f, minGap, maxGap, seen: [...seen] };
}

const even = bout('arming', 'arming');
// THE HEADLINE. A bout where nobody walked is the thing this release exists to
// stop shipping, and it is checked before anything about who won.
if (!(even.a.travelled > 3)) fail(`fencer A travelled ${even.a.travelled.toFixed(1)} m in 30 s — nobody moved`);
if (!(even.b.travelled > 3)) fail(`fencer B travelled ${even.b.travelled.toFixed(1)} m in 30 s — nobody moved`);
// ...and the gap has to actually open and close, not sit at one value.
if (!(even.maxGap - even.minGap > 1)) {
  fail(`the gap only ranged over ${(even.maxGap - even.minGap).toFixed(2)} m — this is a standoff, not a bout`);
}
// Every phase has to happen. A bout stuck in `measure` is two people circling.
for (const phase of ['measure', 'windup', 'cut', 'recover']) {
  if (!even.seen.includes(phase)) fail(`the bout never entered '${phase}'`);
}
// A sensible number of actions: not one, and not seventy.
const actions = even.a.attacks + even.b.attacks;
if (!(actions > 6)) fail(`${actions} attacks in 30 s is a standoff`);
if (actions > 60) fail(`${actions} attacks in 30 s is a metronome`);
// The blades met, and `Bind` had an opinion about it.
if (!(even.f.touches.filter((t) => t.parried).length > 0)) {
  fail('not one attack in the bout was parried, so Bind is not connected to anything');
}

// ---------------------------------- 4. the reach band, from a subtraction

const long = bout('spear', 'arming');
if (!(long.a.measure > long.b.measure * 1.3)) fail('the spear does not out-measure the sword in the bout');
if (!(long.a.touches > long.b.touches * 2)) {
  fail(
    `a spear beat an arming sword only ${long.a.touches}-${long.b.touches} — the reach band has stopped mattering`
  );
}
// ...and the attacks it launched from inside its own measure and outside the
// foe's are the mechanism, not a story told afterwards.
if (!(long.a.inBand > 0)) fail('the spear never once attacked from the band where only it can reach');

// -------------------------------------- 5. the bout is not a frame rate

// Genuinely fixed step with a carried residue: two modules in this library have
// already had to learn that capping without flooring makes the answer a fact
// about the frame rate.
const coarse = bout('arming', 'arming', 20);
const a2 = new Fencer(createHumanoid({ seed: 42 }), { blade: 'arming', at: new Vector3(-1.8, 0, 0) });
const b2 = new Fencer(createHumanoid({ seed: 7 }), { blade: 'arming', at: new Vector3(1.8, 0, 0) });
const f2 = new Fence(a2, b2, { roundSeconds: 20 });
while (!f2.done) {
  f2.update(1 / 240);
  poseSwordArm(a2);
  poseSwordArm(b2);
}
const drift = Math.abs(f2.elapsed - coarse.f.elapsed);
if (!(drift < 0.05)) fail(`four times the frame rate ran the bout ${drift.toFixed(2)} s differently`);
const travelDrift = Math.abs(a2.travelled - coarse.a.travelled) / Math.max(1e-6, coarse.a.travelled);
if (!(travelDrift < 0.15)) {
  fail(`four times the frame rate moved fencer A ${(travelDrift * 100).toFixed(0)}% differently`);
}

// ---------------------------------------------------------------- report

const cards = ['messer', 'arming', 'sabre', 'longsword', 'spear'].map((b) =>
  fencerCard(rig, { blade: b, hands: b === 'longsword' || b === 'spear' ? 2 : 1 })
);

if (json) {
  console.log(JSON.stringify({ cards, even: { ...even.f.touches }, failures }, null, 2));
} else {
  console.log('fencing — the armed bout, and it does not stand still\n');
  console.log('  blade        mass    I(grip)   couple    TEMPO    measure   foot');
  console.log('  ' + '-'.repeat(64));
  for (const c of cards) {
    console.log(
      `  ${c.blade.padEnd(11)} ${c.weight.toFixed(2)}kg  ${c.inertia.toFixed(4)}  ` +
        `${c.torque.toFixed(1).padStart(5)} N·m  ${c.tempo.toFixed(3)}s  ` +
        `${c.measure.toFixed(2)} m  ${c.speed.toFixed(2)} m/s`
    );
  }
  console.log('\n  Nothing in the weapon table says "speed". It says how thick the blade is,');
  console.log('  and t = √(2θI/τ) says the rest. A longsword is 2.0x an arming sword to turn');
  console.log('  and has 2.1x the couple on it, so the two nearly cancel — which is the whole');
  console.log('  reason a hand-and-a-half grip is worth the extra steel.\n');

  console.log('  THIRTY SECONDS, arming against arming');
  console.log(`    travelled        ${even.a.travelled.toFixed(1)} m and ${even.b.travelled.toFixed(1)} m`);
  console.log(`    gap ranged       ${even.minGap.toFixed(2)} to ${even.maxGap.toFixed(2)} m`);
  console.log(
    `    actions          ${even.a.attacks} and ${even.b.attacks} attacks, ` +
      `${even.a.parries} and ${even.b.parries} parries`
  );
  console.log(
    `    of ${String(even.f.touches.length).padStart(2)} arrivals    ` +
      `${even.f.touches.filter((t) => t.parried).length} were parried, and Bind decided every one`
  );

  console.log('\n  AND THE REACH BAND, which is a subtraction');
  console.log(
    `    spear ${long.a.measure.toFixed(2)} m against sword ${long.b.measure.toFixed(2)} m  ->  ` +
      `${long.a.touches}-${long.b.touches}, with ${long.a.inBand} attacks launched from`
  );
  console.log('    inside its own measure and outside the other fencer\'s.');
}

if (failures.length) {
  console.error('\nFENCING OVER BUDGET');
  for (const l of failures) console.error(`  ${l}`);
  console.error('\nA bout where nobody moved is the thing this release exists to stop shipping.');
  process.exit(1);
}
if (!json) console.log('\nfencing: they move, the blade sets the tempo, and the longer weapon owns a band ✓');
