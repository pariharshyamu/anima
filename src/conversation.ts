import { Object3D, Vector3 } from 'three';

/**
 * A participant. Structurally minimal on purpose: anything with a gaze
 * controller (ANIMA's `LookAt`) and something to be looked *at* qualifies,
 * so you can drop in your own head-tracking without subclassing anything.
 */
export interface Talker {
  /** This character's gaze — `LookAt`, or any `{ target }` holder. */
  gaze: { target: Vector3 | Object3D | null };
  /** What the others aim at: this character's head bone or an Object3D near it. */
  head: Object3D;
}

export interface ConversationOptions {
  /** Mean seconds one person holds the floor. Default 4.5. */
  turn?: number;
  /**
   * Seconds before a listener's head follows a change of speaker. People
   * do not snap around in unison; each takes their own beat. Default 0.5.
   */
  reaction?: number;
  /**
   * How much of the time a listener's attention drifts off the speaker,
   * 0..1. Zero is a room of unblinking starers, which is far creepier
   * than it sounds. Default 0.3.
   */
  wander?: number;
  /**
   * The shared thing eyes fall to when they drift — the food, the fire,
   * the board. Without it, wandering gaze has nowhere sensible to go.
   */
  focus?: Object3D | Vector3 | null;
  /** Seed. Same seed, same conversation. Default 1. */
  seed?: number;
}

type TurnListener = (speaker: number, previous: number) => void;

interface Attention {
  /** What this member is looking at right now. */
  at: Vector3 | Object3D | null;
  /** Countdown until they reconsider. */
  hold: number;
  /** Countdown before they react to a new speaker. */
  delay: number;
}

/**
 * Turn-taking gaze for a group — the cheapest thing that turns several
 * seated bodies into a conversation.
 *
 * The behaviour it encodes is the real asymmetry of talking: **listeners
 * watch the speaker far more than the speaker watches any one listener.**
 * Someone holding the floor looks away to think, sweeps the group, checks
 * a face for a reaction; the people listening hold a steady gaze on them,
 * but not all of them, not perfectly, and never all snapping across at
 * the same instant. Every one of those hedges is doing work — a group
 * that turns in unison looks radio-controlled.
 *
 * ```ts
 * const chat = new Conversation(
 *   diners.map((d) => ({ gaze: d.gaze, head: d.rig.bones.Head })),
 *   { focus: table.focus }                       // SCENA's gathering focus
 * );
 * game.onUpdate((t) => {
 *   chat.update(t.delta);                        // sets everyone's gaze.target
 *   for (const d of diners) d.gaze.update(t.delta);
 * });
 * ```
 *
 * It only ever writes `gaze.target`; the actual head turning, clamping and
 * smoothing stays with `LookAt`.
 */
export class Conversation {
  /** Index of whoever currently holds the floor. */
  speaker = 0;
  /** Pause the turn-taking (everyone keeps their current gaze). */
  enabled = true;
  /** The shared thing eyes drift to. Live-editable. */
  focus: Object3D | Vector3 | null;

  private readonly members: Talker[];
  private readonly attention: Attention[];
  private readonly listeners = new Set<TurnListener>();
  private readonly turn: number;
  private readonly reaction: number;
  private readonly wander: number;
  private readonly random: () => number;
  private floor: number;

  constructor(members: Talker[], options: ConversationOptions = {}) {
    this.members = [...members];
    this.turn = options.turn ?? 4.5;
    this.reaction = options.reaction ?? 0.5;
    this.wander = options.wander ?? 0.3;
    this.focus = options.focus ?? null;
    let state = (options.seed ?? 1) >>> 0 || 1;
    this.random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.attention = this.members.map(() => ({ at: null, hold: 0, delay: 0 }));
    this.floor = this.turnLength();
    this.speaker = Math.floor(this.random() * Math.max(1, this.members.length));
    this.retarget();
  }

  /** How many people are in it. */
  get size(): number {
    return this.members.length;
  }

  /** Fires when the floor changes hands. Returns an unsubscribe. */
  onTurn(listener: TurnListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Hand the floor to a specific member (or the next one, at random). */
  handOver(to?: number): void {
    const previous = this.speaker;
    if (to !== undefined) {
      this.speaker = Math.max(0, Math.min(this.members.length - 1, to));
    } else if (this.members.length > 1) {
      // Whoever speaks next is usually — not always — someone else.
      let next = Math.floor(this.random() * this.members.length);
      if (next === previous && this.random() < 0.85) next = (next + 1) % this.members.length;
      this.speaker = next;
    }
    this.floor = this.turnLength();
    // Each listener notices in their own time.
    for (let i = 0; i < this.attention.length; i++) {
      this.attention[i].delay = i === this.speaker ? 0 : this.reaction * (0.4 + this.random() * 1.6);
      this.attention[i].hold = 0;
    }
    for (const listener of [...this.listeners]) listener(this.speaker, previous);
  }

  /** Advance the conversation and write everyone's `gaze.target`. */
  update(dt: number): void {
    if (!this.enabled || this.members.length === 0) return;
    this.floor -= dt;
    if (this.floor <= 0) this.handOver();

    for (let i = 0; i < this.members.length; i++) {
      const a = this.attention[i];
      if (a.delay > 0) {
        a.delay -= dt;
        if (a.delay > 0) continue; // still looking wherever they were
      }
      a.hold -= dt;
      if (a.hold <= 0) this.reconsider(i);
      this.members[i].gaze.target = a.at;
    }
  }

  /** Point everyone at the speaker immediately — for a cut or a re-seat. */
  retarget(): void {
    for (let i = 0; i < this.members.length; i++) {
      this.attention[i].delay = 0;
      this.attention[i].hold = 0;
      this.reconsider(i);
      this.members[i].gaze.target = this.attention[i].at;
    }
  }

  /** Where member `i` looks next, and for how long. */
  private reconsider(i: number): void {
    const a = this.attention[i];
    const speaking = i === this.speaker;
    if (speaking) {
      // Holding the floor: sweep the listeners, and look away to think.
      const others = this.members.filter((_, j) => j !== i);
      if (others.length === 0 || this.random() < 0.35) {
        a.at = this.focus ?? null;
        a.hold = 0.8 + this.random() * 1.4;
      } else {
        a.at = others[Math.floor(this.random() * others.length)].head;
        a.hold = 1.1 + this.random() * 1.6;
      }
      return;
    }
    // Listening: mostly at the speaker, sometimes not.
    if (this.random() < this.wander) {
      const strays = this.members.filter((_, j) => j !== i && j !== this.speaker);
      const stray = strays.length && this.random() < 0.5 ? strays[Math.floor(this.random() * strays.length)].head : null;
      a.at = stray ?? this.focus ?? null;
      a.hold = 0.7 + this.random() * 1.3;
    } else {
      a.at = this.members[this.speaker]?.head ?? null;
      a.hold = 1.6 + this.random() * 2.4;
    }
  }

  private turnLength(): number {
    // Turns are wildly uneven — a one-word answer, then a long story.
    return Math.max(1.2, this.turn * (0.35 + this.random() * 1.6));
  }
}
