#!/usr/bin/env node
/**
 * The conversational-gaze gate.
 *
 *   npm run floor            fail if gaze stops being a protocol
 *   npm run floor -- --json  the numbers, machine-readable
 *
 * Kendon (1967) filmed two people talking and counted two rates where every rig
 * ships one. Sections 1 and 4 are MODEL CHECKS — the model was handed those
 * numbers and had better still be producing them once the utterance structure
 * is layered on top, which is a real thing to break but is not evidence.
 *
 * Section 2 is the one that is a prediction, and section 3 is the one that says
 * out loud what section 2 cannot tell you. READ THEM TOGETHER OR NEITHER.
 */
import {
  Dialogue, Floor, GAZE_LISTENING, GAZE_SPEAKING, LOOK_SECONDS,
  PLANNING_AVERSION, TERMINAL_GAZE, awayFor, createEyes, createHumanoid, irisOffset,
} from '../dist/index.js';

const json = process.argv.includes('--json');
const failures = [];
const fail = (l) => failures.push(l);
const DT = 1 / 60;
const RUN = 4000;

const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

// ------------------------------------------- 1. TWO RATES, AND NEITHER IS 0.7

/**
 * A participant left in one role for long enough to average out.
 *
 * The speaker is driven with a REAL UTTERANCE STRUCTURE — a plan, a middle and
 * an end — because that structure is the thing most likely to quietly break the
 * published rate, and a solo speaker with `untilEnd` left undefined would never
 * exercise it.
 */
function solo(role, { structured }) {
  const f = new Floor({ role, seed: 11 });
  let since = 0;
  let length = 5;
  let state = 999;
  const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let t = 0; t < RUN; t += DT) {
    since += DT;
    if (since >= length) {
      since = 0;
      length = 2 + rand() * 8;
    }
    f.update(DT, structured ? { role, untilEnd: length - since, since } : { role });
  }
  return f.proportion;
}

const rates = {
  listening: solo('listening', { structured: false }),
  speaking: solo('speaking', { structured: true }),
  speakingFlat: solo('speaking', { structured: false }),
};
rates.ratio = rates.listening / Math.max(1e-9, rates.speaking);

for (const [role, published] of [['listening', GAZE_LISTENING], ['speaking', GAZE_SPEAKING]]) {
  if (Math.abs(rates[role] - published) > 0.03) {
    fail(`a ${role} participant looked at the other one ${pct(rates[role])} of the time against Kendon's ${pct(published)}`);
  }
}

/**
 * AND THE UTTERANCE STRUCTURE DOES NOT GET TO MOVE THE RATE.
 *
 * This is the assertion the boundary code exists to satisfy and the one that
 * catches the obvious wrong implementation: hold the middle at 40% and bolt a
 * second of terminal gaze onto the end of every utterance, and a speaker with
 * 5-second turns looks at the listener 52% of the time. That is not Kendon's
 * finding any more, it is a different one, and it would read as correct in
 * every review because both halves look right on their own.
 */
if (Math.abs(rates.speaking - rates.speakingFlat) > 0.03) {
  fail(`the utterance structure moved the speaker's rate from ${pct(rates.speakingFlat)} to ${pct(rates.speaking)} — the ends of utterances are eating the published proportion`);
}

/**
 * AND IT HAS TO HOLD AT EVERY TURN LENGTH, NOT ON AVERAGE OVER A MIXTURE.
 *
 * A run of assorted utterances hides what short ones do, and short ones are
 * where the budget breaks: a two-second turn cannot contain a second of
 * planning aversion AND a second of terminal gaze AND still average 40%,
 * because the ends alone are already half of it. Taking the terminal gaze at
 * face value instead of capping it at what the utterance can afford overspends
 * on exactly those turns and on no others — which is why a mixed run passes
 * with it broken, and how this check came to exist.
 */
const sweep = [1.5, 2, 2.5, 3, 4, 6, 9, 14].map((T) => {
  const f = new Floor({ role: 'speaking', seed: 8 });
  let since = 0;
  for (let t = 0; t < 3000; t += DT) {
    since += DT;
    if (since >= T) since = 0;
    f.update(DT, { role: 'speaking', untilEnd: T - since, since });
  }
  return { T, rate: f.proportion };
});
for (const s of sweep) {
  if (Math.abs(s.rate - GAZE_SPEAKING) > 0.03) {
    fail(`in ${s.T}s turns the speaker looked at the listener ${pct(s.rate)} of the time against Kendon's ${pct(GAZE_SPEAKING)}`);
  }
}

// The away-time is derived, so it had better still be: one second for a
// listener, four and a half for a speaker, and no room to pick either.
const derived = { listening: awayFor(GAZE_LISTENING), speaking: awayFor(GAZE_SPEAKING) };
for (const [role, away] of Object.entries(derived)) {
  const implied = LOOK_SECONDS / (LOOK_SECONDS + away);
  const published = role === 'listening' ? GAZE_LISTENING : GAZE_SPEAKING;
  if (Math.abs(implied - published) > 1e-9) {
    fail(`a ${LOOK_SECONDS}s look with a ${away.toFixed(2)}s gap gives ${pct(implied)}, not ${pct(published)}`);
  }
}

// -------------------------------- 2. AND MUTUAL GAZE IS NOBODY'S PARAMETER

/**
 * Two agents, each following only its own rule, and a third number falls out.
 *
 * At any moment one of them is speaking and looks up 40% of the time and the
 * other is listening and looks up 75%, so both at once is 0.75 × 0.40 = 30%.
 * ARGYLE AND INGHAM (1972) PUT MUTUAL GAZE IN A TWO-PERSON CONVERSATION AT
 * ABOUT 30%, and that is a different laboratory measuring a different quantity
 * five years later. The number 0.30 appears nowhere in `src/floor.ts`.
 */
function converse(options) {
  const d = new Dialogue({ seed: 5, ...options });
  let mutualHeld = 0;
  let held = 0;
  let mutualAll = 0;
  let all = 0;
  const byRole = { speaking: [0, 0], listening: [0, 0] };
  for (let t = 0; t < RUN; t += DT) {
    d.update(DT);
    const speaking = d.a.role === 'speaking' || d.b.role === 'speaking';
    all += DT;
    if (d.mutual) mutualAll += DT;
    if (speaking) {
      held += DT;
      if (d.mutual) mutualHeld += DT;
      for (const f of [d.a, d.b]) {
        byRole[f.role][1] += DT;
        if (f.atPartner) byRole[f.role][0] += DT;
      }
    }
  }
  return {
    mutual: mutualHeld / Math.max(1e-9, held),
    mutualAll: mutualAll / Math.max(1e-9, all),
    listening: byRole.listening[0] / Math.max(1e-9, byRole.listening[1]),
    speaking: byRole.speaking[0] / Math.max(1e-9, byRole.speaking[1]),
    handovers: d.handovers,
  };
}

/**
 * Every unbroken run of looking, so the gate can measure how LONG a look is.
 *
 * The overall and MUTUAL figures have to come from the two-agent dialogue,
 * because a shared look does not exist anywhere else. The per-role figures
 * cannot: a role change lands in the middle of a glance and cuts it in half, so
 * a listener whose turn arrives mid-look shows up as having glanced for a
 * second. Those are measured off participants held in one role instead, which
 * is the quantity the sentence about them actually claims.
 */
function glances(options = {}) {
  const d = new Dialogue({ seed: 5, ...options });
  const runs = { all: [], mutual: [] };
  const open = { a: 0, b: 0, mutual: 0 };
  for (let t = 0; t < RUN; t += DT) {
    d.update(DT);
    for (const key of ['a', 'b']) {
      if (d[key].atPartner) open[key] += DT;
      else if (open[key] > 0) {
        runs.all.push(open[key]);
        open[key] = 0;
      }
    }
    if (d.mutual) open.mutual += DT;
    else if (open.mutual > 0) {
      runs.mutual.push(open.mutual);
      open.mutual = 0;
    }
  }
  return runs;
}

/** ...and the same, for someone who stays in one role the whole time. */
function soloGlances(role, { structured }) {
  const f = new Floor({ role, seed: 11 });
  const out = [];
  let open = 0;
  let since = 0;
  let length = 5;
  let state = 999;
  const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let t = 0; t < RUN; t += DT) {
    since += DT;
    if (since >= length) {
      since = 0;
      length = 2 + rand() * 8;
    }
    f.update(DT, structured ? { role, untilEnd: length - since, since } : { role });
    if (f.atPartner) open += DT;
    else if (open > 0) {
      out.push(open);
      open = 0;
    }
  }
  return out;
}

const talk = converse({});
const PREDICTED = GAZE_LISTENING * GAZE_SPEAKING;
/**
 * ARGYLE & INGHAM'S FIGURE IS A LITERAL, NOT `PREDICTED`.
 *
 * Writing the band around the product would have been the same circular
 * assertion that survived mutation in 0.66.0, 0.68.0 and twice in 0.69.0:
 * change both published rates and the target moves with them and it still
 * passes. Their measurement is about 30% of conversation time and does not care
 * what this file believes.
 */
const ARGYLE_INGHAM = 0.30;
if (Math.abs(talk.mutual - ARGYLE_INGHAM) > 0.06) {
  fail(`two agents following Kendon's individual rates spent ${pct(talk.mutual)} in mutual gaze, and Argyle & Ingham measured about ${pct(ARGYLE_INGHAM)}`);
}
// ...and it has to be the PRODUCT that gets it there, not a coincidence: the
// two agents must be independent enough for the joint rate to multiply out.
if (Math.abs(talk.mutual - PREDICTED) > 0.04) {
  fail(`mutual gaze came out at ${pct(talk.mutual)} where the two rates predict ${pct(PREDICTED)} — the agents are not independent`);
}

// ------------------- 3. AND THAT CHECK ON ITS OWN DOES NOT DISCRIMINATE

/**
 * THE CONTROL PASSES SECTION 2. SAYING SO IS THE POINT OF SECTION 3.
 *
 * `Conversation` in this library gives everyone one rate. Set that rate to the
 * mean of Kendon's two and mutual gaze comes out at 0.575² = 33%, which is
 * inside anybody's reading of "about 30%". So the mutual-gaze agreement is
 * real and it is EVIDENCE OF ALMOST NOTHING BY ITSELF — a one-rate rig is not
 * refuted by it.
 *
 * What refutes it is the asymmetry, which is Kendon's actual finding and the
 * thing a single rate cannot produce at any setting: listeners look nearly
 * twice as much as speakers. The control sits at 1.0 by construction.
 */
function control(rate) {
  let state = 4242;
  const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  const agents = [0, 1].map(() => ({ at: false, next: 0, look: 0, live: 0 }));
  let mutual = 0;
  let total = 0;
  const byRole = { speaking: [0, 0], listening: [0, 0] };
  let speaker = 0;
  let since = 0;
  for (let t = 0; t < RUN; t += DT) {
    since += DT;
    if (since > 5) {
      since = 0;
      speaker = speaker === 0 ? 1 : 0;
    }
    for (const a of agents) {
      a.next -= DT;
      if (a.next <= 0) {
        // Same alternating machinery as the model, so the ONLY difference
        // between control and model is the one thing under test: one rate
        // instead of two.
        a.at = !a.at;
        a.next = -Math.log(Math.max(1e-9, rand())) * (a.at ? LOOK_SECONDS : awayFor(rate));
      }
    }
    total += DT;
    if (agents[0].at && agents[1].at) mutual += DT;
    agents.forEach((a, i) => {
      const role = i === speaker ? 'speaking' : 'listening';
      byRole[role][1] += DT;
      if (a.at) byRole[role][0] += DT;
    });
  }
  const listening = byRole.listening[0] / byRole.listening[1];
  const speaking = byRole.speaking[0] / byRole.speaking[1];
  return { mutual: mutual / total, listening, speaking, ratio: listening / speaking };
}

const oneRate = control((GAZE_LISTENING + GAZE_SPEAKING) / 2);
talk.ratio = talk.listening / Math.max(1e-9, talk.speaking);
const PUBLISHED_RATIO = GAZE_LISTENING / GAZE_SPEAKING;

if (Math.abs(talk.ratio - PUBLISHED_RATIO) > 0.25) {
  fail(`listeners looked ${talk.ratio.toFixed(2)}x as much as speakers, and Kendon's two rates are ${PUBLISHED_RATIO.toFixed(2)}x apart`);
}
// The control has to actually be a control: it must PASS the mutual check and
// FAIL the asymmetry one. If it ever stops doing both, section 3 is a lie.
if (Math.abs(oneRate.mutual - ARGYLE_INGHAM) > 0.06) {
  fail(`the one-rate control came out at ${pct(oneRate.mutual)} mutual — it is supposed to pass section 2, and section 3's whole claim is that passing it is cheap`);
}
if (Math.abs(oneRate.ratio - 1) > 0.15) {
  fail(`the one-rate control produced a ${oneRate.ratio.toFixed(2)}x listener/speaker asymmetry, and a single rate cannot produce one`);
}

// ------------------------- 4. AND THE END OF AN UTTERANCE IS A SIGNAL

/**
 * A MODEL OF KENDON'S SECOND FINDING, NOT A REDISCOVERY OF IT — AND THE GATE
 * SAYS SO BECAUSE THE ARITHMETIC IS TOO EASY TO MISREAD AS EVIDENCE.
 *
 * Kendon found that turn transitions are delayed when the speaker does not end
 * with a sustained gaze. That the delay exists here is built in. What is NOT
 * built in is its size: the invited handover waits for the two of them to be
 * looking at each other, which is a joint event governed by the listening rate
 * and by nothing chosen for this section.
 */
const noSignal = converse({ yieldOnGaze: false });
const handover = {
  with: mean(talk.handovers),
  without: mean(noSignal.handovers),
};
handover.delay = handover.without - handover.with;

if (!(talk.handovers.length > 100 && noSignal.handovers.length > 100)) {
  fail(`only ${talk.handovers.length}/${noSignal.handovers.length} turn transitions in ${RUN}s — the floor is not changing hands`);
}
if (!(handover.delay > 0.3)) {
  fail(`removing the terminal gaze changed the transition by ${handover.delay.toFixed(2)}s, and Kendon found transitions are measurably delayed without it`);
}
/**
 * ...AND IT MUST NOT BE INSTANT, WHICH IS THE HALF THAT WAS MISSING.
 *
 * The gate originally bounded the invited handover from above only, and a
 * mutation walked straight through it: drop the requirement that the LISTENER
 * be looking when the signal is sent and handovers complete in about a frame,
 * because the terminal gaze guarantees the sender's half. Faster passed. But a
 * signal nobody had to perceive is not a signal, and an instantaneous
 * transition is as wrong as a slow one — Stivers et al. (2009) put the gap
 * between turns across ten languages within a couple of hundred milliseconds of
 * zero, not at zero. So the bound is two-sided, and neither end is derived from
 * anything in `src/floor.ts`.
 */
if (!(handover.with < 0.75)) {
  fail(`even with the signal the floor took ${handover.with.toFixed(2)}s to change hands`);
}
if (!(handover.with > 0.1)) {
  fail(`the floor changed hands in ${handover.with.toFixed(2)}s — nobody had to perceive anything, and a real turn transition takes about 0.2s`);
}

/**
 * AND EVERY UTTERANCE HAS TO END ON A GAZE — WHICH IS THE CHECK THAT IS NOT
 * ABOUT ANY CONSTANT AT ALL.
 *
 * The first version of this section walked the last `TERMINAL_GAZE` seconds of
 * an utterance and counted. Setting `TERMINAL_GAZE` to zero collapsed the loop
 * to nothing, `held` stayed at 0, and `0 < 0 − 2·dt` is false, so the gate
 * reported a pass on a model with no turn-yielding signal in it. Identical for
 * `PLANNING_AVERSION`. That is the fourth release running in which the gate
 * computed its own expectation from the constant it was testing — BLINK_OPEN in
 * 0.66.0, CORNER_TRAVEL in 0.68.0, PUPIL_LATENCY and IRIS_MM in 0.69.0 — and it
 * is the fourth time nothing but a mutation run found it.
 *
 * The structural question has no constant in it: does the speaker's eye land on
 * the listener at the moment they stop talking? Every time, or it is not a
 * signal. The durations are then checked over a LITERAL 0.8 s window.
 */
let ends = {};
{
  const WINDOW = 0.8;
  let onGaze = 0;
  let utterances = 0;
  let held = 0;
  let away = 0;
  const f = new Floor({ role: 'speaking', seed: 3 });
  let since = 0;
  let length = 6;
  let state = 77;
  const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let t = 0; t < 4000; t += DT) {
    since += DT;
    if (since >= length) {
      // The frame BEFORE the reset is the last frame of the utterance.
      utterances++;
      if (f.atPartner) onGaze++;
      since = 0;
      length = 4 + rand() * 6;
    }
    const untilEnd = length - since;
    f.update(DT, { role: 'speaking', untilEnd, since });
    if (untilEnd <= WINDOW && f.atPartner) held += DT;
    if (since <= WINDOW && !f.atPartner) away += DT;
  }
  ends = {
    onGaze: onGaze / Math.max(1, utterances),
    held: held / Math.max(1, utterances),
    away: away / Math.max(1, utterances),
    WINDOW,
  };
  if (!(ends.onGaze > 0.98)) {
    fail(`only ${pct(ends.onGaze)} of utterances ended with the speaker looking at the listener — a turn-yielding signal that fires sometimes is not one`);
  }
  if (ends.held < WINDOW - 3 * DT) {
    fail(`the speaker held the listener's eye for ${ends.held.toFixed(2)}s of the last ${WINDOW}s of each utterance`);
  }
  if (ends.away < WINDOW - 3 * DT) {
    fail(`the speaker looked away for only ${ends.away.toFixed(2)}s of the first ${WINDOW}s of each utterance, and that is where the planning load is`);
  }
}

// ------------------------------- 4b. AND A GLANCE HAS A LENGTH, NOT JUST A RATE

/**
 * A rate says nothing about grain. 40% of the time is 40% whether it arrives as
 * one long stare or forty flickers, and only one of those is a face.
 *
 * Argyle & Ingham put the mean glance in conversation near three seconds and
 * the mean MUTUAL glance near one — and the second of those is a PREDICTION
 * here, because nothing in the model knows how long a shared look lasts. Two
 * independent looks overlap for as long as it takes whichever ends first to
 * end, so the shared look is shorter than either of the looks making it up:
 *
 * ```
 *   mutual = La·Lb / (La + Lb)     — about half a glance, for equal glances
 * ```
 *
 * Argyle & Ingham's own pair, 2.95 and 1.18 s, gives a ratio of 2.5.
 */
const runs = glances();
const glance = {
  all: mean(runs.all),
  speaking: mean(soloGlances('speaking', { structured: true })),
  listening: mean(soloGlances('listening', { structured: false })),
  mutual: mean(runs.mutual),
};
glance.ratio = glance.all / Math.max(1e-9, glance.mutual);

// A LITERAL FLOOR, not `LOOK_SECONDS`. Half of anybody's published mean glance
// is not a glance any more, it is a flicker, and a rig doing that reads as a
// twitch rather than a conversation.
if (!(glance.all > 1.4)) {
  fail(`the mean glance lasted ${glance.all.toFixed(2)}s, and a conversational one runs a few seconds`);
}
// ...and the speaker's are SHORTER, which is forced by the budget rather than
// chosen: the free window of a short turn cannot hold a full-length look.
if (!(glance.listening > glance.speaking * 1.3)) {
  fail(`listeners' glances ran ${glance.listening.toFixed(2)}s against speakers' ${glance.speaking.toFixed(2)} — a speaker with a gaze budget to spend in a three-second window cannot afford full-length looks`);
}
// AND THE SHARED LOOK IS SHORTER THAN EITHER LOOK IN IT. The 2.5 is Argyle &
// Ingham's own two numbers divided, and the model has never seen either.
const PUBLISHED_MUTUAL_RATIO = 2.95 / 1.18;
if (!(glance.ratio > 1.8 && glance.ratio < 4.2)) {
  fail(`a shared look ran ${glance.ratio.toFixed(2)}x shorter than a look, and Argyle & Ingham's pair of means gives ${PUBLISHED_MUTUAL_RATIO.toFixed(2)}x`);
}

/**
 * AND A LONG TURN IS NOT ONE LONG STARE, WHICH SHORT TURNS CANNOT TELL YOU.
 *
 * A twenty-second turn has eight seconds of gaze to spend. Spending it in one
 * unbroken look is within budget, keeps every rate in section 1 correct, and is
 * a person standing there gazing at you for eight seconds. Nothing in a run of
 * five-second turns can distinguish that from the right answer, because at five
 * seconds there is only ever one glance to place — which is why a mutation
 * pinning the glance count at one survived everything above.
 *
 * THE CEILING IS A LITERAL 4.5 s. Argyle & Ingham's mean glance is about three,
 * and half again on top of a published mean is the outside of a glance.
 */
let longTurn = {};
{
  const T = 20;
  const f = new Floor({ role: 'speaking', seed: 8 });
  const lengths = [];
  const halves = [0, 0];
  let open = 0;
  let since = 0;
  for (let t = 0; t < 6000; t += DT) {
    since += DT;
    if (since >= T) since = 0;
    f.update(DT, { role: 'speaking', untilEnd: T - since, since });
    if (f.atPartner) open += DT;
    else if (open > 0) {
      lengths.push(open);
      open = 0;
    }
    // ...and WHERE in the free window the gaze falls. Bunching every glance
    // against one edge is also within budget, and leaves a speaker who looks
    // away for the entire back half of every sentence.
    const free = [PLANNING_AVERSION, T - TERMINAL_GAZE];
    if (f.atPartner && since > free[0] && since < free[1]) {
      halves[since < (free[0] + free[1]) / 2 ? 0 : 1] += DT;
    }
  }
  const longest = Math.max(...lengths);
  const lean = halves[0] / Math.max(1e-9, halves[1]);
  longTurn = { T, longest, glances: lengths.length, lean };
  if (!(longest < 4.5)) {
    fail(`in a ${T}s turn the speaker held one unbroken look for ${longest.toFixed(2)}s — that is a stare, not a glance`);
  }
  if (!(lean > 0.5 && lean < 2)) {
    fail(`the speaker spent ${lean.toFixed(2)}x as much gaze in the first half of the utterance as the second — the glances are bunched against one edge`);
  }
}

// ------------------------------------------------ 5. AND IT REACHES THE RIG

/**
 * An aversion has to be VISIBLE AS ONE, and that is not a matter of taste.
 *
 * People discriminate where someone is looking to within a couple of degrees at
 * conversational distance, which is why a rig that averts gaze by a third of a
 * degree reads as a face still staring at you. The bound below is 5° — several
 * times any published threshold, so it is a floor rather than a fit.
 */
let rig = {};
{
  const human = createHumanoid({ seed: 4 });
  const eyes = createEyes(human);
  const f = new Floor({ role: 'listening', seed: 21 });
  let widest = 0;
  for (let t = 0; t < 400; t += DT) {
    f.update(DT, { role: 'listening' });
    widest = Math.max(widest, Math.abs(f.target.yaw));
  }
  // ORBITAL_RANGE is 25° of eye-in-socket travel at yaw = 1.
  const degrees = widest * 25;
  const travel = Math.abs(irisOffset(widest, human.height) - irisOffset(0, human.height)) * 1000;
  // ...and what the RIG actually moved, read off the scene graph rather than
  // off the model that asked for it.
  const xs = () => eyes.group.children.map((c) => c.position.x);
  eyes.apply({ lid: 0, gaze: 0, yaw: 0 });
  const home = xs();
  eyes.apply({ lid: 0, gaze: 0, yaw: widest });
  const drawn = Math.max(...xs().map((x, i) => Math.abs(x - home[i]))) * 1000;
  rig = { degrees, travel, drawn };
  if (!(degrees > 5)) {
    fail(`the widest gaze aversion was ${degrees.toFixed(1)}°, and people read a couple of degrees`);
  }
  if (Math.abs(drawn - travel) > 0.05) {
    fail(`the model averted ${travel.toFixed(2)} mm of iris travel and the rig drew ${drawn.toFixed(2)}`);
  }
  // Looking AT the other person is looking at them, not near them.
  f.atPartner = true;
  if (Math.abs(f.target.yaw) + Math.abs(f.target.pitch) > 1e-9) {
    fail(`the at-partner target was not the partner`);
  }
}

// ------------------------------------------------------------------- REPORT

if (json) {
  console.log(JSON.stringify({ rates, talk, oneRate, handover, rig, failures }, null, 2));
} else {
  console.log('\nTHE CONVERSATIONAL FLOOR — Kendon (1967)\n');
  console.log('  1. two rates, and neither of them is 0.7');
  console.log(`     listening            ${pct(rates.listening)}  against a published ${pct(GAZE_LISTENING)}`);
  console.log(`     speaking             ${pct(rates.speaking)}  against a published ${pct(GAZE_SPEAKING)}`);
  console.log(`     with the ends flat   ${pct(rates.speakingFlat)}  — the utterance structure must not move it`);
  console.log(`     away time            ${derived.listening.toFixed(2)}s / ${derived.speaking.toFixed(2)}s, derived from a ${LOOK_SECONDS}s look\n`);
  console.log('  2. and mutual gaze is nobody\'s parameter');
  console.log(`     measured             ${pct(talk.mutual)}   two agents, each following only its own rule`);
  console.log(`     0.75 x 0.40          ${pct(PREDICTED)}`);
  console.log(`     Argyle & Ingham 1972 ~${pct(ARGYLE_INGHAM)}   a different lab, a different measurement`);
  console.log(`     over the whole talk  ${pct(talk.mutualAll)}   including the gaps between turns\n`);
  console.log('  3. AND THAT AGREEMENT ON ITS OWN PROVES ALMOST NOTHING');
  console.log(`     one-rate control     ${pct(oneRate.mutual)} mutual — it passes check 2 as well as the model does.`);
  console.log('     What it cannot do is the asymmetry, which is the actual finding:');
  console.log(`       model              ${pct(talk.listening)} listening / ${pct(talk.speaking)} speaking = ${talk.ratio.toFixed(2)}x`);
  console.log(`       control            ${pct(oneRate.listening)} / ${pct(oneRate.speaking)} = ${oneRate.ratio.toFixed(2)}x`);
  console.log(`       published                                     ${PUBLISHED_RATIO.toFixed(2)}x\n`);
  console.log('  4. and the end of an utterance is a signal (a MODEL of Kendon, not evidence)');
  console.log(`     ended on a gaze      ${pct(ends.onGaze)} of utterances — the structural check, no constant in it`);
  console.log(`     with terminal gaze   ${handover.with.toFixed(2)}s to change hands, over ${talk.handovers.length} transitions`);
  console.log(`     without it           ${handover.without.toFixed(2)}s`);
  console.log(`     delayed by           ${handover.delay.toFixed(2)}s\n`);
  console.log('  4b. and a glance has a length, not just a rate');
  console.log(`     mean glance          ${glance.all.toFixed(2)}s   listening ${glance.listening.toFixed(2)} / speaking ${glance.speaking.toFixed(2)}`);
  console.log(`     mean MUTUAL glance   ${glance.mutual.toFixed(2)}s   — nothing in the model knows this number`);
  console.log(`     shorter by           ${glance.ratio.toFixed(2)}x   against Argyle & Ingham's 2.95/1.18 = ${PUBLISHED_MUTUAL_RATIO.toFixed(2)}x`);
  console.log(`     in a ${longTurn.T}s turn        longest look ${longTurn.longest.toFixed(2)}s, spread ${longTurn.lean.toFixed(2)}x front-to-back\n`);
  console.log('  5. and it reaches the rig');
  console.log(`     widest aversion      ${rig.degrees.toFixed(1)}°, ${rig.travel.toFixed(2)} mm of iris travel, drawn ${rig.drawn.toFixed(2)}\n`);
}

if (failures.length) {
  console.error(`FLOOR GATE FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`floor gate passed — ${talk.handovers.length} turns, mutual gaze ${pct(talk.mutual)} from two agents who were never told it\n`);
