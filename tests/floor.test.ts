import { describe, expect, it } from 'vitest';
import {
  Dialogue, Floor, GAZE_LISTENING, GAZE_SPEAKING, LOOK_SECONDS,
  PLANNING_AVERSION, TERMINAL_GAZE, awayFor,
} from '../src/floor';

const DT = 1 / 60;

/** One participant held in one role, with or without an utterance structure. */
function hold(role: 'speaking' | 'listening', options: { turn?: number; seconds?: number } = {}): Floor {
  const f = new Floor({ role, seed: 11 });
  const turn = options.turn ?? 0;
  let since = 0;
  for (let t = 0; t < (options.seconds ?? 2000); t += DT) {
    if (turn > 0) {
      since += DT;
      if (since >= turn) since = 0;
      f.update(DT, { role, untilEnd: turn - since, since });
    } else {
      f.update(DT, { role });
    }
  }
  return f;
}

describe('the two rates', () => {
  it('are Kendon\'s, and there are two of them', () => {
    expect(GAZE_LISTENING).toBe(0.75);
    expect(GAZE_SPEAKING).toBe(0.4);
    expect(GAZE_LISTENING / GAZE_SPEAKING).toBeGreaterThan(1.8);
  });

  it('come out of a listener who has never been told the answer', () => {
    expect(hold('listening').proportion).toBeCloseTo(GAZE_LISTENING, 1);
  });

  it('come out of a speaker too, structure and all', () => {
    expect(hold('speaking', { turn: 5 }).proportion).toBeCloseTo(GAZE_SPEAKING, 1);
  });

  it('hold at every turn length, not on average over a mixture', () => {
    // Short turns are where a budget breaks, because the ends of a two-second
    // utterance are already most of it.
    for (const turn of [1.5, 2, 3, 5, 9, 14]) {
      expect(Math.abs(hold('speaking', { turn }).proportion - GAZE_SPEAKING)).toBeLessThan(0.03);
    }
  });

  it('are not the one rate `Conversation` gives everybody', () => {
    const listening = hold('listening').proportion;
    const speaking = hold('speaking', { turn: 5 }).proportion;
    expect(listening).toBeGreaterThan(0.7);
    expect(speaking).toBeLessThan(0.5);
  });
});

describe('the away time', () => {
  it('is derived from the look and the proportion, not picked', () => {
    for (const p of [0.2, 0.4, 0.5, 0.75, 0.9]) {
      const away = awayFor(p);
      expect(LOOK_SECONDS / (LOOK_SECONDS + away)).toBeCloseTo(p, 10);
    }
  });

  it('is one second for a listener and four and a half for a speaker', () => {
    expect(awayFor(GAZE_LISTENING)).toBeCloseTo(1, 6);
    expect(awayFor(GAZE_SPEAKING)).toBeCloseTo(4.5, 6);
  });

  it('scales with the look it is paired with', () => {
    expect(awayFor(0.5, 2)).toBeCloseTo(2, 6);
    expect(awayFor(0.5, 6)).toBeCloseTo(6, 6);
  });

  it('survives proportions nobody should pass it', () => {
    for (const p of [0, 1, -5, 12, NaN]) {
      expect(Number.isFinite(awayFor(p))).toBe(true);
    }
  });
});

describe('the ends of an utterance', () => {
  it('end on the listener\'s eye, every time', () => {
    const f = new Floor({ role: 'speaking', seed: 3 });
    let ended = 0;
    let onGaze = 0;
    let since = 0;
    const turn = 6;
    for (let t = 0; t < 1200; t += DT) {
      since += DT;
      if (since >= turn) {
        ended++;
        if (f.atPartner) onGaze++;
        since = 0;
      }
      f.update(DT, { role: 'speaking', untilEnd: turn - since, since });
    }
    expect(ended).toBeGreaterThan(100);
    expect(onGaze).toBe(ended);
  });

  it('begin looking away, where the planning load is', () => {
    const f = new Floor({ role: 'speaking', seed: 3 });
    for (let t = 0; t < 0.8; t += DT) {
      f.update(DT, { role: 'speaking', untilEnd: 9 - t, since: t });
      expect(f.atPartner).toBe(false);
    }
  });

  it('need the speaker to know the end is coming', () => {
    // With no `untilEnd` there is no terminal gaze to give — a turn-yielding
    // signal is a fact about the speaker's plan, which is why an observer
    // cannot fake one.
    const blind = new Floor({ role: 'speaking', seed: 3 });
    let held = 0;
    for (let t = 0; t < 600; t += DT) {
      blind.update(DT, { role: 'speaking' });
      if (blind.atPartner) held += DT;
    }
    expect(held / 600).toBeCloseTo(GAZE_SPEAKING, 1);
  });

  it('do not overspend the budget on a turn too short to afford them', () => {
    // PLANNING_AVERSION + TERMINAL_GAZE is two seconds; 40% of a two-second
    // utterance is 0.8, so the ends cannot both be paid for at full price.
    expect(PLANNING_AVERSION + TERMINAL_GAZE).toBeGreaterThan(GAZE_SPEAKING * 2);
    expect(hold('speaking', { turn: 2 }).proportion).toBeCloseTo(GAZE_SPEAKING, 1);
  });
});

describe('a glance has a length', () => {
  const lengths = (f: Floor, drive: () => void, seconds: number): number[] => {
    const out: number[] = [];
    let open = 0;
    for (let t = 0; t < seconds; t += DT) {
      drive();
      if (f.atPartner) open += DT;
      else if (open > 0) {
        out.push(open);
        open = 0;
      }
    }
    return out;
  };

  it('and a listener\'s runs about as long as the published one', () => {
    const f = new Floor({ role: 'listening', seed: 11 });
    const runs = lengths(f, () => f.update(DT, { role: 'listening' }), 3000);
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    expect(mean).toBeGreaterThan(2);
    expect(mean).toBeLessThan(4);
  });

  it('and a speaker\'s is shorter, because the budget cannot afford it', () => {
    const f = new Floor({ role: 'speaking', seed: 11 });
    let since = 0;
    const runs = lengths(
      f,
      () => {
        since += DT;
        if (since >= 5) since = 0;
        f.update(DT, { role: 'speaking', untilEnd: 5 - since, since });
      },
      3000,
    );
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    expect(mean).toBeLessThan(2);
  });

  it('and a long turn is not one long stare', () => {
    const f = new Floor({ role: 'speaking', seed: 8 });
    let since = 0;
    const runs = lengths(
      f,
      () => {
        since += DT;
        if (since >= 20) since = 0;
        f.update(DT, { role: 'speaking', untilEnd: 20 - since, since });
      },
      4000,
    );
    expect(Math.max(...runs)).toBeLessThan(4.5);
  });
});

describe('where the eye goes', () => {
  it('is the partner when looking at them, and not when not', () => {
    const f = new Floor({ role: 'listening', seed: 21 });
    let sawAway = false;
    for (let t = 0; t < 400; t += DT) {
      f.update(DT, { role: 'listening' });
      if (f.atPartner) {
        expect(f.target.yaw).toBe(0);
        expect(f.target.pitch).toBe(0);
      } else {
        sawAway = true;
        // Far enough to read as an aversion rather than a stare with a wobble.
        expect(Math.abs(f.target.yaw)).toBeGreaterThan(0.2);
      }
    }
    expect(sawAway).toBe(true);
  });

  it('averts downward rather than up', () => {
    const f = new Floor({ role: 'listening', seed: 21 });
    for (let t = 0; t < 400; t += DT) {
      f.update(DT, { role: 'listening' });
      if (!f.atPartner) expect(f.target.pitch).toBeLessThan(0);
    }
  });

  it('is a `look()` pair, so saccades can move the eye there', () => {
    const f = new Floor({ seed: 2 });
    f.update(DT, { role: 'listening' });
    for (const v of [f.target.yaw, f.target.pitch]) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('two of them in a conversation', () => {
  const converse = (options = {}) => {
    const d = new Dialogue({ seed: 5, ...options });
    let mutual = 0;
    let held = 0;
    for (let t = 0; t < 3000; t += DT) {
      d.update(DT);
      if (d.a.role === 'speaking' || d.b.role === 'speaking') {
        held += DT;
        if (d.mutual) mutual += DT;
      }
    }
    return { d, mutual: mutual / held };
  };

  it('produce a mutual gaze rate nobody set', () => {
    // 0.75 x 0.40 = 0.30, and Argyle & Ingham measured about 30%. The literal
    // is theirs; deriving it from the two constants would test nothing.
    expect(converse().mutual).toBeGreaterThan(0.24);
    expect(converse().mutual).toBeLessThan(0.36);
  });

  it('hand the floor over, repeatedly', () => {
    const { d } = converse();
    expect(d.handovers.length).toBeGreaterThan(100);
    expect(d.speaker === 0 || d.speaker === 1).toBe(true);
  });

  it('take longer over it when the speaker does not yield with a gaze', () => {
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const withSignal = mean(converse().d.handovers);
    const without = mean(converse({ yieldOnGaze: false }).d.handovers);
    expect(without).toBeGreaterThan(withSignal + 0.3);
    // ...but not instantly WITH it either: the listener has to have been
    // looking, and a transition nobody perceived is not a transition.
    expect(withSignal).toBeGreaterThan(0.1);
  });

  it('are deterministic for a seed', () => {
    const run = () => {
      const d = new Dialogue({ seed: 99 });
      for (let t = 0; t < 200; t += DT) d.update(DT);
      return `${d.speaker}:${d.a.proportion.toFixed(9)}:${d.b.proportion.toFixed(9)}`;
    };
    expect(run()).toBe(run());
  });
});

describe('the awkward inputs', () => {
  it('survive a zero, negative or absent timestep', () => {
    const f = new Floor({ seed: 4 });
    for (const dt of [0, -1, NaN, Infinity]) f.update(dt as number, { role: 'listening' });
    expect(f.elapsed).toBe(0);
    expect(f.proportion).toBe(0);
  });

  it('survive an utterance that is over before it began', () => {
    const f = new Floor({ role: 'speaking', seed: 4 });
    for (let t = 0; t < 10; t += DT) f.update(DT, { role: 'speaking', untilEnd: -3, since: 40 });
    expect(f.atPartner).toBe(true);
    expect(Number.isFinite(f.proportion)).toBe(true);
  });

  it('survive a seed of zero', () => {
    const f = new Floor({ seed: 0 });
    for (let t = 0; t < 100; t += DT) f.update(DT, { role: 'listening' });
    expect(f.proportion).toBeGreaterThan(0);
  });

  it('keep `looking` and `elapsed` consistent', () => {
    const f = hold('listening', { seconds: 500 });
    expect(f.looking).toBeLessThanOrEqual(f.elapsed + 1e-9);
    expect(f.proportion).toBeCloseTo(f.looking / f.elapsed, 12);
  });
});
