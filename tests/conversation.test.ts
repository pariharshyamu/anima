import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { Conversation, type Talker } from '../src';

/** A ring of stand-in talkers — only `gaze.target` and `head` are needed. */
function group(n: number): Talker[] {
  return Array.from({ length: n }, (_, i) => {
    const head = new Object3D();
    head.name = `head${i}`;
    head.position.set(Math.sin((i / n) * Math.PI * 2), 1.5, Math.cos((i / n) * Math.PI * 2));
    return { gaze: { target: null as Vector3 | Object3D | null }, head };
  });
}

/** Run a conversation, sampling who is looking at whom each frame. */
function talk(chat: Conversation, members: Talker[], seconds: number, dt = 1 / 30) {
  const atSpeaker = members.map(() => 0);
  const turns: number[] = [];
  let frames = 0;
  chat.onTurn((speaker) => turns.push(speaker));
  for (let i = 0; i < seconds / dt; i++) {
    chat.update(dt);
    frames++;
    for (let m = 0; m < members.length; m++) {
      if (m === chat.speaker) continue;
      if (members[m].gaze.target === members[chat.speaker].head) atSpeaker[m]++;
    }
  }
  return { atSpeaker, turns, frames };
}

describe('Conversation', () => {
  it('hands the floor around', () => {
    const members = group(4);
    const chat = new Conversation(members, { seed: 5 });
    const { turns } = talk(chat, members, 60);
    expect(turns.length).toBeGreaterThan(4);
    expect(new Set(turns).size).toBeGreaterThan(1); // not one person monologuing
  });

  it('listeners watch the speaker most of the time, but not all of it', () => {
    // The real asymmetry of talking. All-of-the-time is a room of starers;
    // none-of-the-time is a room of strangers.
    const members = group(4);
    const chat = new Conversation(members, { seed: 11, wander: 0.3 });
    const { atSpeaker, frames } = talk(chat, members, 300);
    const share = atSpeaker.reduce((a, b) => a + b, 0) / (frames * (members.length - 1));
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.95);
  });

  it('a change of speaker does not turn every head at once', () => {
    // THE tell for a puppet crowd. Two people happening to shift gaze in the
    // same 33 ms is life; four heads snapping together on the beat is not.
    const members = group(5);
    const chat = new Conversation(members, { seed: 7, reaction: 0.6, wander: 0 });
    // Settle the group on one speaker first, so the change is a real change.
    chat.handOver(3);
    for (let i = 0; i < 3 * 30; i++) chat.update(1 / 30);
    chat.handOver(0);
    const arrived = new Map<number, number>(); // listener → frame they looked over
    for (let frame = 0; frame < 6 * 30; frame++) {
      chat.update(1 / 30);
      for (let m = 1; m < members.length; m++) {
        if (!arrived.has(m) && members[m].gaze.target === members[0].head) arrived.set(m, frame);
      }
    }
    expect(arrived.size).toBe(4); // everyone got there eventually
    const frames = [...arrived.values()];
    expect(new Set(frames).size, 'each on their own beat').toBe(4);
    // …and spread over a believable stretch, not a stagger of one frame each.
    expect(Math.max(...frames) - Math.min(...frames)).toBeGreaterThan(4);
  });

  it('never turns the whole group on one frame', () => {
    // Two people coinciding inside one 33 ms tick is life; the whole table
    // moving together is choreography, and it always reads as such.
    const members = group(5);
    const chat = new Conversation(members, { seed: 7, reaction: 0.6 });
    let previous = members.map((m) => m.gaze.target);
    let busiestFrame = 0;
    for (let i = 0; i < 300 * 30; i++) {
      chat.update(1 / 30);
      const now = members.map((m) => m.gaze.target);
      busiestFrame = Math.max(busiestFrame, now.filter((t, j) => t !== previous[j]).length);
      previous = now;
    }
    expect(busiestFrame).toBeLessThan(members.length);
  });

  it('the speaker looks around the group, and away to think', () => {
    const members = group(4);
    const focus = new Object3D();
    const chat = new Conversation(members, { seed: 3, focus });
    const seen = new Set<unknown>();
    for (let i = 0; i < 200 * 30; i++) {
      chat.update(1 / 30);
      seen.add(members[chat.speaker].gaze.target);
    }
    expect(seen.has(focus), 'speaker looks away to think').toBe(true);
    // …and at more than one listener over the course of it.
    const heads = members.filter((m) => seen.has(m.head)).length;
    expect(heads).toBeGreaterThan(1);
  });

  it('a speaker never looks at their own head', () => {
    const members = group(3);
    const chat = new Conversation(members, { seed: 9, focus: new Object3D() });
    for (let i = 0; i < 200 * 30; i++) {
      chat.update(1 / 30);
      expect(members[chat.speaker].gaze.target).not.toBe(members[chat.speaker].head);
    }
  });

  it('turns are wildly uneven in length', () => {
    const members = group(4);
    const chat = new Conversation(members, { seed: 2, turn: 4 });
    const at: number[] = [];
    let clock = 0;
    chat.onTurn(() => at.push(clock));
    for (let i = 0; i < 600 * 30; i++) {
      chat.update(1 / 30);
      clock += 1 / 30;
    }
    const lengths: number[] = [];
    for (let i = 1; i < at.length; i++) lengths.push(at[i] - at[i - 1]);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(3);
  });

  it('handles the degenerate sizes without falling over', () => {
    const solo = group(1);
    const focus = new Object3D();
    const alone = new Conversation(solo, { focus });
    for (let i = 0; i < 300; i++) alone.update(1 / 30);
    expect(solo[0].gaze.target).toBe(focus); // nothing to do but look at the fire

    const none = new Conversation([], {});
    expect(() => none.update(1 / 30)).not.toThrow();
    expect(none.size).toBe(0);
  });

  it('handOver puts a named person on the floor and everyone reacts in time', () => {
    const members = group(3);
    const chat = new Conversation(members, { seed: 4, reaction: 0.5, wander: 0 });
    chat.handOver(2);
    expect(chat.speaker).toBe(2);
    for (let i = 0; i < 4 * 30; i++) chat.update(1 / 30);
    const watching = members.filter((m, i) => i !== 2 && m.gaze.target === members[2].head);
    expect(watching.length).toBe(2);
  });

  it('enabled = false freezes every gaze where it is', () => {
    const members = group(3);
    const chat = new Conversation(members, { seed: 6 });
    for (let i = 0; i < 60; i++) chat.update(1 / 30);
    chat.enabled = false;
    const frozen = members.map((m) => m.gaze.target);
    for (let i = 0; i < 600; i++) chat.update(1 / 30);
    expect(members.map((m) => m.gaze.target)).toEqual(frozen);
  });

  it('is deterministic under a seed', () => {
    const run = () => {
      const members = group(4);
      const chat = new Conversation(members, { seed: 77 });
      return talk(chat, members, 120).turns;
    };
    expect(run()).toEqual(run());
  });
});
