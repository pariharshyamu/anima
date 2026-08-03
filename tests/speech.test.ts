import { describe, expect, it } from 'vitest';
import {
  ANTICIPATION, DOMINANCE, JAW_SPEED, JAW_TRAVEL, LIP_BRIDGE, PHONEMES, PHONEME_KEYS, REST,
  REST_WEIGHT, Speech, VISEMES, VISEME_NAMES, createMouth, mouthAt, mouthOf,
  syllableRate, utterance, utteranceLength, visemeOf,
} from '../src/speech';
import { createHumanoid } from '../src/humanoid';

const VOWELS = ['i', 'y', 'e', 'E', 'a', 'A', 'O', 'o', 'u', 'M', '@'];

const peak = (keys: string, channel: keyof ReturnType<typeof mouthOf>): number => {
  const t = utterance(keys);
  let m = 0;
  for (let x = 0; x <= utteranceLength(t); x += 0.004) m = Math.max(m, mouthAt(t, x)[channel]);
  return m;
};

describe('the chart is the table', () => {
  it('reads openness straight off the IPA’s vowel height', () => {
    for (const k of VOWELS) expect(mouthOf(k).open).toBeCloseTo(PHONEMES[k].height, 12);
  });

  it('reads rounding straight off the IPA’s roundedness', () => {
    for (const k of VOWELS) expect(mouthOf(k).round).toBeCloseTo(PHONEMES[k].round, 12);
  });

  it('is monotone in height across the whole inventory', () => {
    const byHeight = [...VOWELS].sort((a, b) => PHONEMES[a].height - PHONEMES[b].height);
    for (let i = 1; i < byHeight.length; i++) {
      expect(mouthOf(byHeight[i]).open).toBeGreaterThanOrEqual(mouthOf(byHeight[i - 1]).open - 1e-12);
    }
  });

  it('keeps the two axes apart: /i/ and /y/ differ only in rounding', () => {
    expect(mouthOf('i').open).toBeCloseTo(mouthOf('y').open, 12);
    expect(mouthOf('y').round).toBeGreaterThan(mouthOf('i').round + 0.5);
  });

  it('and so do /u/ and /ɯ/', () => {
    expect(mouthOf('u').open).toBeCloseTo(mouthOf('M').open, 12);
    expect(mouthOf('u').round).toBeGreaterThan(mouthOf('M').round + 0.5);
  });

  it('makes an open unrounded vowel the widest thing in the inventory', () => {
    for (const k of PHONEME_KEYS) {
      if (k !== 'a' && k !== 'A') expect(mouthOf('a').spread).toBeGreaterThanOrEqual(mouthOf(k).spread - 1e-12);
    }
  });

  it('falls back to silence for a symbol it has never heard of', () => {
    expect(mouthOf('øø')).toEqual(mouthOf('.'));
    expect(visemeOf('øø')).toBe('silence');
  });
});

describe('the viseme collapse is a classification, not a design', () => {
  it('puts every phoneme in exactly one viseme', () => {
    const seen = new Set<string>();
    for (const keys of Object.values(VISEMES)) {
      for (const k of keys) {
        expect(PHONEMES[k], `'${k}' is listed as a viseme member and is not a phoneme`).toBeDefined();
        expect(seen.has(k), `'${k}' is in more than one viseme`).toBe(false);
        seen.add(k);
      }
    }
    expect([...seen].sort()).toEqual([...PHONEME_KEYS].sort());
  });

  it('collapses many phonemes onto few pictures', () => {
    expect(PHONEME_KEYS.length / VISEME_NAMES.length).toBeGreaterThan(2.5);
  });

  it('makes /p/, /b/ and /m/ three sounds and one picture', () => {
    for (const k of ['p', 'b', 'm']) {
      expect(visemeOf(k)).toBe('bilabial');
      expect(mouthOf(k).close).toBeCloseTo(1, 12);
    }
    expect(mouthOf('p')).toEqual(mouthOf('b'));
  });
});

describe('a bilabial closes the lips', () => {
  it('seals on "mama", "papa" and "baba"', () => {
    for (const word of ['mama', 'papa', 'baba', 'mama.mama']) {
      expect(peak(word, 'close'), word).toBeGreaterThan(0.95);
    }
  });

  it('does not seal on a word with no bilabial in it', () => {
    for (const word of ['halo', 'sisi', 'tata']) {
      expect(peak(word, 'close'), word).toBeLessThan(0.35);
    }
  });

  it('takes closure as a maximum and never as an average', () => {
    // A lone /m/ surrounded by open vowels still gets all the way shut. Under an
    // average it would be dragged open by both neighbours, which is precisely
    // the failure that reads as a mouth flapping vaguely.
    expect(peak('ama', 'close')).toBeGreaterThan(0.95);
    expect(peak('aaamaaa', 'close')).toBeGreaterThan(0.95);
  });

  it('still lets "mama" open in the middle, or it is a hum', () => {
    expect(peak('mama', 'open')).toBeGreaterThan(0.6);
  });

  it('does not show a wide mouth through sealed lips', () => {
    const t = utterance('mama');
    for (let x = 0; x <= utteranceLength(t); x += 0.004) {
      const m = mouthAt(t, x);
      if (m.close > 0.9) expect(m.spread).toBeLessThan(0.1);
    }
  });
});

describe('the rest posture', () => {
  it('is where an empty utterance sits', () => {
    expect(mouthAt([], 0)).toEqual({ ...REST, close: 0, spread: REST.spread });
  });

  it('eases the mouth back rather than dropping it off a cliff', () => {
    // The bug this exists for: without a standing rest weight the accumulator
    // empties the instant no segment is in reach, and the jaw fell 49% of its
    // range in one 120 Hz frame at the end of every line.
    const t = utterance('mama');
    const len = utteranceLength(t);
    let worst = 0;
    let prev = mouthAt(t, 0).open;
    for (let x = 0; x <= len + 0.5; x += 1 / 120) {
      const now = mouthAt(t, x).open;
      worst = Math.max(worst, Math.abs(now - prev));
      prev = now;
    }
    expect(worst).toBeLessThan(0.2);
  });

  it('carries a weight small enough for a vowel to win', () => {
    expect(REST_WEIGHT).toBeGreaterThan(0);
    expect(REST_WEIGHT).toBeLessThan(1);
    expect(peak('.a.', 'open')).toBeGreaterThan(0.6);
  });
});

describe('timing is published, not counted in frames', () => {
  it('gives every phoneme a duration a phoneme could have', () => {
    for (const k of PHONEME_KEYS) {
      expect(PHONEMES[k].duration, k).toBeGreaterThan(0.04);
      expect(PHONEMES[k].duration, k).toBeLessThan(0.25);
    }
  });

  it('makes a stop much shorter than an open vowel', () => {
    expect(PHONEMES.p.duration).toBeLessThan(PHONEMES.a.duration * 0.6);
  });

  it('lays segments end to end at their own lengths', () => {
    const t = utterance('mama');
    expect(t[0].duration).toBeCloseTo(PHONEMES.m.duration, 12);
    expect(t[1].at).toBeCloseTo(PHONEMES.m.duration, 12);
    expect(t[0].duration).not.toBeCloseTo(t[1].duration, 6);
    expect(utteranceLength(t)).toBeCloseTo(2 * (PHONEMES.m.duration + PHONEMES.a.duration), 12);
  });

  it('skips symbols it does not know instead of laying down a gap', () => {
    expect(utterance('m!a').map((s) => s.key)).toEqual(['m', 'a']);
  });

  it('is empty for an empty utterance', () => {
    expect(utteranceLength([])).toBe(0);
    expect(syllableRate([])).toBe(0);
  });

  it('scales with rate and does not reorder', () => {
    const t = utterance('mama');
    const fast = utterance('mama', 2);
    expect(utteranceLength(fast)).toBeCloseTo(utteranceLength(t) / 2, 12);
    expect(fast.map((s) => s.key)).toEqual(t.map((s) => s.key));
  });

  it('runs at the speed people talk', () => {
    for (const phrase of ['mama', 'halo', 'papa.mama']) {
      const r = syllableRate(utterance(phrase));
      expect(r, phrase).toBeGreaterThan(3);
      expect(r, phrase).toBeLessThan(8);
    }
  });
});

describe('coarticulation', () => {
  it('leads the sound by the measured tenth of a second', () => {
    expect(ANTICIPATION).toBeCloseTo(0.1, 12);
    expect(DOMINANCE).toBeGreaterThan(1);
  });

  it('is already opening toward a vowel that has not started', () => {
    expect(mouthAt(utterance('.a'), 0.02).open).toBeGreaterThan(mouthOf('.').open + 0.05);
  });

  it('reaches past a phoneme’s own segment', () => {
    // Dominance wider than the segment means a neighbour still has pull at the
    // boundary; at exactly 1 the blend would be a step function.
    const t = utterance('am');
    const boundary = t[1].at - ANTICIPATION;
    expect(mouthAt(t, boundary).open).toBeGreaterThan(0.1);
    expect(mouthAt(t, boundary).close).toBeGreaterThan(0);
  });
});

describe('the jaw moves at a speed a jaw manages', () => {
  it('never exceeds the published peak', () => {
    const talker = new Speech('halo.mama.sisi');
    let worst = 0;
    let prev = talker.shape.open;
    while (!talker.done) {
      const m = talker.update(1 / 120);
      worst = Math.max(worst, Math.abs(m.open - prev));
      prev = m.open;
    }
    expect(worst * JAW_TRAVEL * 120).toBeLessThanOrEqual(JAW_SPEED * 1.02);
  });

  it('produces undershoot without anybody writing one down', () => {
    // Lindblom 1963: a short vowel between consonants does not reach its own
    // target because the jaw cannot get there and back. Nothing here encodes
    // that — it falls out of one published speed against one published duration.
    const reach = (keys: string): number => {
      const s = new Speech(keys);
      let m = 0;
      while (!s.done) m = Math.max(m, s.update(1 / 120).open);
      return m;
    };
    expect(reach('.a.a.a.')).toBeGreaterThan(reach('mam') + 0.1);
  });

  it('does not limit the lips, which are light', () => {
    // A bilabial that had to wait for the jaw would stop being a bilabial.
    const s = new Speech('mama');
    let sealed = 0;
    while (!s.done) if (s.update(1 / 120).close > 0.9) sealed++;
    expect(sealed).toBeGreaterThan(0);
  });

  it('does not make the jaw follow the lips', () => {
    // The jaw was gated by the seal, and every /m/ slammed a blended opening to
    // zero over 50 ms — 1099 mm/s against a jaw's 200. A nasal is voiced through
    // closed lips with the jaw wherever it likes: you can hum with your mouth
    // open.
    const t = utterance('mama');
    let both = 0;
    for (let x = 0; x <= utteranceLength(t); x += 0.004) {
      const m = mouthAt(t, x);
      if (m.close > 0.5 && m.open > 0.15) both++;
    }
    expect(both).toBeGreaterThan(0);
  });
});

describe('the lips bridge what the jaw left open', () => {
  it('never claims more gap than the lips have length', () => {
    // close × open × JAW_TRAVEL is the millimetres of gap the seal says it has
    // closed, and LIP_BRIDGE is how many the lips are. The lips are not rate-
    // limited and the jaw is, so without a cap the seal switches on across
    // twenty-five millimetres with twenty-four to work with.
    for (const line of ['mama.papa.mama.', 'mam', 'halo.mama.sisi', 'ampa']) {
      const s = new Speech(line);
      while (!s.done) {
        const m = s.update(1 / 120);
        expect(m.close * m.open * JAW_TRAVEL, line).toBeLessThanOrEqual(LIP_BRIDGE + 1e-9);
      }
    }
  });

  it('delays the seal rather than cancelling it', () => {
    const s = new Speech('mama');
    let best = 0;
    while (!s.done) best = Math.max(best, s.update(1 / 120).close);
    expect(best).toBeGreaterThan(0.999);
  });

  it('draws sealed lips actually touching', () => {
    const rig = createHumanoid({ seed: 42 });
    const mouth = createMouth(rig);
    const gap = (): number => mouth.group.children[1].position.y - mouth.group.children[2].position.y;
    mouth.apply({ open: LIP_BRIDGE / JAW_TRAVEL, round: 0, close: 1, spread: 0 });
    expect(gap()).toBeLessThan(0.0005);
  });

  it('and does not close a jaw wider than the lips can span', () => {
    // The honest half: a bridge is a length, not a rule. Beyond it the lips
    // cannot reach and the prop must show that rather than cheat it shut.
    const rig = createHumanoid({ seed: 42 });
    const mouth = createMouth(rig);
    const gap = (): number => mouth.group.children[1].position.y - mouth.group.children[2].position.y;
    mouth.apply({ open: 1, round: 0, close: 1, spread: 0 });
    expect(gap()).toBeCloseTo((JAW_TRAVEL - LIP_BRIDGE) * (rig.height / 1.75), 9);
  });

  it('scales both lengths off the body', () => {
    const tall = createHumanoid({ seed: 7, height: 2.0 });
    const mouth = createMouth(tall);
    const gap = (): number => mouth.group.children[1].position.y - mouth.group.children[2].position.y;
    mouth.apply({ open: 1, round: 0, close: 1, spread: 0 });
    expect(gap()).toBeCloseTo((JAW_TRAVEL - LIP_BRIDGE) * (2.0 / 1.75), 9);
  });
});

describe('the controller', () => {
  it('takes its length from the utterance', () => {
    const s = new Speech('mama');
    expect(s.length).toBeCloseTo(utteranceLength(utterance('mama')), 12);
  });

  it('finishes, and a looping one does not', () => {
    const s = new Speech('mama');
    for (let i = 0; i < 200; i++) s.update(1 / 60);
    expect(s.done).toBe(true);
    const looped = new Speech('mama', { loop: true });
    for (let i = 0; i < 500; i++) looped.update(1 / 60);
    expect(looped.done).toBe(false);
    expect(looped.elapsed).toBeLessThan(looped.length);
  });

  it('restarts the clock when it is given a new line', () => {
    const s = new Speech('mama');
    for (let i = 0; i < 20; i++) s.update(1 / 60);
    s.say('halo');
    expect(s.elapsed).toBe(0);
    expect(s.length).toBeCloseTo(utteranceLength(utterance('halo')), 12);
  });

  it('scales the whole line by rate', () => {
    expect(new Speech('mama', { rate: 2 }).length).toBeCloseTo(new Speech('mama').length / 2, 12);
  });

  it('survives a zero and a negative step', () => {
    const s = new Speech('mama');
    const before = s.update(0);
    expect(Number.isFinite(before.open)).toBe(true);
    s.update(-1);
    expect(s.elapsed).toBeGreaterThanOrEqual(0);
  });

  it('says nothing when it has been given nothing', () => {
    const s = new Speech('');
    expect(s.length).toBe(0);
    expect(s.done).toBe(true);
    expect(Number.isFinite(s.update(1 / 60).open)).toBe(true);
  });
});

describe('the mouth prop', () => {
  const rig = createHumanoid({ seed: 42 });

  it('parents itself to the head', () => {
    const mouth = createMouth(rig);
    expect(mouth.group.parent).toBe(rig.bones.Head);
  });

  it('drops the lower lip when the jaw opens', () => {
    const mouth = createMouth(rig);
    const lower = mouth.group.children[2];
    mouth.apply({ open: 1, round: 0, close: 0, spread: 1 });
    const wide = lower.position.y;
    mouth.apply({ open: 0, round: 0, close: 1, spread: 0 });
    expect(lower.position.y).toBeGreaterThan(wide);
  });

  it('narrows for a rounded mouth and widens for a spread one', () => {
    const mouth = createMouth(rig);
    const upper = mouth.group.children[1];
    mouth.apply({ open: 0.5, round: 1, close: 0, spread: 0 });
    const rounded = upper.scale.x;
    mouth.apply({ open: 0.5, round: 0, close: 0, spread: 1 });
    expect(upper.scale.x).toBeGreaterThan(rounded);
  });

  it('scales off the body rather than off a constant', () => {
    const small = createMouth(createHumanoid({ seed: 7, height: 1.4 }));
    const large = createMouth(createHumanoid({ seed: 7, height: 2.0 }));
    expect(large.group.position.z).toBeGreaterThan(small.group.position.z);
  });
});
