/**
 * The conversational floor — and gaze is how it changes hands.
 *
 * `Conversation` in this library gives everyone in a group one gaze rate and a
 * `wander` parameter that defaults to 0.3, so a listener looks at the speaker
 * 70% of the time. It is a reasonable number and it is wrong for everybody,
 * because there is no such thing as one rate.
 *
 * Adam Kendon sat two people down, filmed them, and counted (*Some functions of
 * gaze-direction in social interaction*, 1967):
 *
 * ```
 *   while LISTENING   75% of the time on the other person
 *   while SPEAKING    40%
 * ```
 *
 * Nearly twice as much. Talking is expensive — you are planning a sentence —
 * and looking at a face is expensive too, so speakers buy one with the other.
 * A rig that splits the difference at 0.7 is not modelling either half.
 *
 * ## And the ends of utterances are not like the middles
 *
 * Kendon's second finding is the one that makes gaze a PROTOCOL rather than a
 * decoration. A speaker looks AWAY as they begin — the planning load is highest
 * there — and looks BACK at the listener as they finish. That terminal gaze is
 * a turn-yielding signal: when it is absent, the transition to the next speaker
 * is measurably delayed, because the listener has not been told the floor is
 * free.
 *
 * That structure is modelled here, and it is a MODEL of Kendon's finding rather
 * than a rediscovery of it — the gate says so.
 *
 * ## The part that is a prediction
 *
 * Kendon's two numbers are about individuals. Put two people together, each
 * following their own rule, and MUTUAL gaze — both looking at once — falls out
 * as a third number nobody set:
 *
 * ```
 *   0.75 × 0.40 = 0.30
 * ```
 *
 * Argyle and Ingham (1972), a different laboratory measuring a different thing,
 * put mutual gaze in a two-person conversation at about 30% of the time. That
 * agreement is the closest this module gets to evidence, and `npm run floor`
 * measures it off two agents who have never been told what it should be.
 */

/**
 * How much of the time a LISTENER looks at the speaker.
 *
 * Kendon (1967). DATA, labelled as data.
 */
export const GAZE_LISTENING = 0.75;

/** ...and how much of the time a SPEAKER looks at the listener. */
export const GAZE_SPEAKING = 0.40;

/**
 * How long one look lasts, seconds.
 *
 * A single gaze in conversation runs a few seconds. The AWAY time is not a
 * second parameter — it is whatever makes the published proportion come out,
 * which is `look × (1 − p) / p`: one second away for a listener, four and a
 * half for a speaker. Pick both by hand and the proportions stop being
 * Kendon's.
 */
export const LOOK_SECONDS = 3;

/**
 * How long a speaker holds the listener's eye at the end of an utterance.
 *
 * The turn-yielding signal. Kendon found long utterances end with a sustained
 * gaze and that transitions are delayed without it; that it is one second is a
 * judgement, and it is labelled as one.
 */
export const TERMINAL_GAZE = 1;

/**
 * ...and how long they look away at the start, while planning.
 *
 * Also a judgement, for the same reason and with the same honesty.
 */
export const PLANNING_AVERSION = 1;

/** What a participant is doing. */
export type Role = 'speaking' | 'listening';

/**
 * The away-time that makes a published proportion come out, seconds.
 *
 * Derived, not chosen: if a look lasts `LOOK_SECONDS` and the eye is to be on
 * the other person a fraction `p` of the time, the gap between looks has to be
 * `LOOK_SECONDS × (1 − p) / p`, and there is nothing left to pick.
 */
export function awayFor(proportion: number, look: number = LOOK_SECONDS): number {
  // `Math.max` passes NaN straight through, so the clamp has to reject it
  // first — otherwise a NaN proportion becomes a NaN gap, becomes a timer that
  // never fires, and the eye stops moving for the rest of the scene.
  const p = Number.isFinite(proportion) ? Math.min(0.999, Math.max(0.001, proportion)) : 0.001;
  const l = Number.isFinite(look) ? Math.max(0.05, look) : LOOK_SECONDS;
  return (l * (1 - p)) / p;
}

export interface FloorOptions {
  /** Deterministic, because a replay that looks elsewhere is not a replay. */
  seed?: number;
  /** Where it starts. Default listening. */
  role?: Role;
}

export interface FloorState {
  /** What this participant is doing this frame. */
  role?: Role;
  /**
   * Seconds left in this participant's utterance, if they are speaking.
   *
   * The terminal gaze needs to know the end is coming, which is a fact about
   * the SPEAKER's plan and not something an observer could have. It is why a
   * turn-yielding signal is possible at all.
   */
  untilEnd?: number;
  /** Seconds since this utterance began. Drives the planning aversion. */
  since?: number;
}

/**
 * One participant's gaze in a conversation.
 *
 * The rate comes from what they are doing, and the ends of their utterances are
 * not like the middles.
 */
export class Floor {
  /** True when this participant is looking at the other one. */
  atPartner = false;
  role: Role;
  /** Seconds spent looking at the partner, and in total. For measuring. */
  looking = 0;
  elapsed = 0;

  #state = 0;
  #next = 0;
  #awayYaw = 0.5;
  #awayPitch = -0.2;
  #glances: { from: number; to: number }[] = [];
  #planned = Number.NaN;
  #lastSince = Infinity;

  constructor(options: FloorOptions = {}) {
    this.role = options.role ?? 'listening';
    this.#state = (options.seed ?? 1) >>> 0 || 1;
    this.#next = 0;
    this.#avert();
  }

  /**
   * Pick somewhere that is not the other person's face.
   *
   * WHICH WAY someone looks when they look away is a JUDGEMENT and is labelled
   * as one. What is not a judgement is that it has to be FAR ENOUGH: gaze
   * direction is discriminated to within a couple of degrees at conversational
   * distance, so an aversion of half a degree is not an aversion, it is a face
   * still looking at you. These offsets are well outside that.
   *
   * The downward bias is the only part with any warrant — aversion in
   * conversation skews down and to the side rather than up.
   */
  #avert(): void {
    const side = this.#random() < 0.5 ? -1 : 1;
    this.#awayYaw = side * (0.3 + this.#random() * 0.5);
    this.#awayPitch = -(0.1 + this.#random() * 0.35);
  }

  #random(): number {
    this.#state = (this.#state * 1664525 + 1013904223) >>> 0;
    return this.#state / 4294967296;
  }

  /**
   * How an utterance of a given length spends the speaker's gaze budget.
   *
   * THE BOUNDARY STRUCTURE IS A RE-ALLOCATION OF KENDON'S 40%, NOT AN ADDITION
   * TO IT. This is the single easiest thing to get wrong here and it does not
   * look wrong: hold the middle at 40%, bolt a second of planning aversion onto
   * the front and a second of terminal gaze onto the back, and both halves are
   * defensible on their own while the speaker ends up looking at the listener
   * 55% of the time. That is not Kendon's finding any more. It is a new one,
   * invented by accident, and it would survive review.
   *
   * So the middle supplies whatever the ends did not:
   *
   * ```
   *   looking = terminal + chance × free   must equal   0.40 × total
   * ```
   *
   * AND THE SPEAKER'S GLANCES COME OUT SHORTER THAN THE LISTENER'S, which is
   * not a decision either. A five-second turn has three free seconds that must
   * contain one second of gaze; a three-second look does not fit in it. The
   * look length is what is left over once the budget and the window are both
   * fixed, and it lands near a second for a short turn and grows to the full
   * `LOOK_SECONDS` for a long one.
   *
   * A turn too short to afford a whole terminal gaze gets a shorter one rather
   * than an overspent budget — a two-second utterance does not have a second of
   * planning and a second of yielding in it.
   */
  #budget(total: number): { plan: number; term: number; free: number; spend: number } {
    const spend = GAZE_SPEAKING * total;
    // The terminal gaze is capped at what the utterance can AFFORD. A turn too
    // short to spend a whole second on yielding gets a shorter one rather than
    // an overspent budget, and that cap is the only part of this line doing any
    // work — a matching cap on the planning aversion looked equally prudent and
    // turned out to be unreachable, because `free` is floored at zero anyway and
    // the terminal branch is tested first.
    const term = Math.min(TERMINAL_GAZE, spend);
    const plan = PLANNING_AVERSION;
    return { plan, term, free: Math.max(0, total - term - plan), spend };
  }

  /**
   * Where in this utterance the speaker will glance up, decided once, in front.
   *
   * THE FREE PART IS A BUDGET TO SPEND, NOT A PROCESS TO SAMPLE. The obvious
   * implementation runs the same alternating look/aversion process the listener
   * uses, at whatever rate makes the arithmetic work. It does not work, and the
   * reason is worth writing down because it is invisible: the free window is a
   * couple of seconds long and one look-plus-aversion cycle is about the same,
   * so the window never reaches the long-run rate the cycle is tuned to. Which
   * state it OPENS in decides the answer. Open in a look — the natural choice,
   * since the speaker has just finished planning and glances up — and the
   * measured rate is 53% against the 37% asked for. Open in an aversion and it
   * undershoots instead. There is no unbiased place to start.
   *
   * So the glances are placed rather than sampled: `spend − terminal` seconds of
   * gaze, cut into looks no longer than a published one, scattered through the
   * free window with the slack shared out between them. Every utterance then
   * spends exactly Kendon's 40% instead of 40% on average over a run long
   * enough to hide it.
   *
   * It is also the better model of the finding. Kendon's speakers are not
   * running a background gaze habit that speech happens on top of — the gaze is
   * organised AROUND the utterance, which is the whole reason it can signal
   * anything about the utterance.
   */
  #schedule(total: number): void {
    const b = this.#budget(total);
    this.#glances = [];
    const spare = Math.max(0, b.spend - b.term);
    if (b.free <= 1e-6 || spare <= 1e-6) return;
    const n = Math.max(1, Math.round(spare / LOOK_SECONDS));
    // `spare` is 0.4·total − terminal and `free` is total − terminal − planning,
    // so spare < free for any utterance longer than 1.67 s and the glances
    // always fit. A clamp here read as prudence and was unreachable — a mutation
    // run flipped it and nothing anywhere changed, which is how it was found.
    const each = spare / n;
    const slack = b.free - each * n;
    // n sorted uniforms share the slack out as the gaps in front of each
    // glance, which keeps them inside the window and in order.
    const cuts = Array.from({ length: n }, () => this.#random()).sort((x, y) => x - y);
    let at = b.plan;
    let prev = 0;
    for (let i = 0; i < n; i++) {
      at += (cuts[i] - prev) * slack;
      prev = cuts[i];
      this.#glances.push({ from: at, to: at + each });
      at += each;
    }
  }

  update(dt: number, state: FloorState = {}): boolean {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.elapsed += step;
    if (state.role) this.role = state.role;

    const speaking = this.role === 'speaking';
    const untilEnd = Number.isFinite(state.untilEnd) ? (state.untilEnd as number) : Infinity;
    const since = Number.isFinite(state.since) ? (state.since as number) : Infinity;
    const known = speaking && Number.isFinite(untilEnd) && Number.isFinite(since);

    if (known) {
      const total = untilEnd + since;
      // A new utterance, or a different one: `since` running backwards is the
      // only signal an observer of this interface gets.
      if (since < this.#lastSince - 1e-9 || !(Math.abs(total - this.#planned) < 1e-6)) {
        this.#schedule(total);
        this.#planned = total;
      }
      this.#lastSince = since;
      const b = this.#budget(total);
      let at: boolean;
      if (untilEnd <= b.term) {
        // THE TURN-YIELDING SIGNAL. Not a random draw — the speaker knows the
        // end is coming and holds the listener's eye through it.
        at = true;
      } else if (since < b.plan) {
        // ...and the start of an utterance is where the planning load is.
        at = false;
      } else {
        at = this.#glances.some((g) => since >= g.from && since < g.to);
      }
      if (at !== this.atPartner && !at) this.#avert();
      this.atPartner = at;
      // The renewal timer is HELD OFF rather than zeroed while speech drives the
      // eye. Zeroing it meant that the frame after the utterance ended, the
      // process fired and toggled the eye away — the ex-speaker broke off at
      // exactly the moment the turn-yielding signal was supposed to be landing,
      // and the floor took over a second to change hands because of it.
      this.#next = LOOK_SECONDS;
    } else {
      this.#lastSince = Infinity;
      this.#next -= step;
      if (this.#next <= 0) {
        const chance = speaking ? GAZE_SPEAKING : GAZE_LISTENING;
        // LOOKS AND AVERSIONS ALTERNATE. THEY ARE NOT REDRAWN.
        //
        // The first version flipped a `random() < chance` coin at every
        // interval, which is the obvious thing and is wrong by a mile: two
        // heads in a row merge into one long look, so the time spent looking
        // comes out at p·L / (p·L + (1−p)·a) rather than at p. For a listener
        // that is 90% instead of 75% — a rate nobody published, arrived at from
        // two numbers that were both right. `awayFor` derives the gap on the
        // assumption that looks and gaps take turns, so they have to.
        this.atPartner = !this.atPartner;
        if (!this.atPartner) this.#avert();
        const mean = this.atPartner ? LOOK_SECONDS : awayFor(chance);
        this.#next = -Math.log(Math.max(1e-9, this.#random())) * Math.max(0.05, mean);
      }
    }

    if (this.atPartner) this.looking += step;
    return this.atPartner;
  }

  /** The fraction of its life this participant has spent on the other one. */
  get proportion(): number {
    return this.elapsed > 0 ? this.looking / this.elapsed : 0;
  }

  /**
   * Where to look, in the −1..1 pair `Saccades.look()` takes.
   *
   * THIS MODULE DECIDES WHERE, AND SACCADES DECIDES HOW THE EYE GETS THERE.
   * That split is the whole handshake: a conversational rule has no business
   * knowing about Bahill's duration law, and a ballistic eye movement has no
   * business knowing whose turn it is to speak. Hand this to `look()` every
   * time it changes and the eye arrives on the main sequence for free.
   */
  get target(): { yaw: number; pitch: number } {
    return this.atPartner
      ? { yaw: 0, pitch: 0 }
      : { yaw: this.#awayYaw, pitch: this.#awayPitch };
  }
}

export interface DialogueOptions {
  /** Mean seconds one person holds the floor. Default 5. */
  turn?: number;
  /** Deterministic. */
  seed?: number;
  /**
   * Whether the speaker yields with a terminal gaze. Default true.
   *
   * Turning it OFF is the point: Kendon found transitions are delayed without
   * it, and the gate measures that delay rather than asserting it.
   */
  yieldOnGaze?: boolean;
}

/** Which of the two is talking, and how the floor changes hands. */
export class Dialogue {
  readonly a: Floor;
  readonly b: Floor;
  /** 0 or 1 — whose turn it is. */
  speaker = 0;
  /** Seconds the last handover took, from the end of speech to the next start. */
  lastHandover = 0;
  /** Every handover this dialogue has measured, seconds. */
  handovers: number[] = [];

  #turn: number;
  #yieldOnGaze: boolean;
  #since = 0;
  #length: number;
  #gap = -1;
  #state = 0;

  constructor(options: DialogueOptions = {}) {
    this.#turn = Math.max(0.5, options.turn ?? 5);
    this.#yieldOnGaze = options.yieldOnGaze !== false;
    this.#state = (options.seed ?? 7) >>> 0 || 7;
    this.a = new Floor({ seed: (options.seed ?? 7) * 2 + 1, role: 'speaking' });
    this.b = new Floor({ seed: (options.seed ?? 7) * 3 + 1, role: 'listening' });
    this.#length = this.#draw();
  }

  #random(): number {
    this.#state = (this.#state * 1664525 + 1013904223) >>> 0;
    return this.#state / 4294967296;
  }

  #draw(): number {
    return this.#turn * (0.6 + this.#random() * 0.8);
  }

  update(dt: number): void {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    const speaking = this.speaker === 0 ? this.a : this.b;
    const listening = this.speaker === 0 ? this.b : this.a;

    if (this.#gap < 0) {
      this.#since += step;
      const untilEnd = this.#length - this.#since;
      speaking.update(step, { role: 'speaking', untilEnd, since: this.#since });
      listening.update(step, { role: 'listening' });
      if (untilEnd <= 0) this.#gap = 0;
    } else {
      // BETWEEN TURNS. The listener takes the floor once the speaker has
      // stopped AND looked at them — AND THEY WERE LOOKING BACK, because a
      // signal nobody is watching is not a signal. So how fast an invited
      // handover goes is not a number chosen here: it falls out of how much of
      // the time the two of them happen to be looking at each other, which is
      // Kendon's listening rate. Without the signal they wait for a fallback,
      // and that wait is what a delayed transition IS.
      this.#gap += step;
      speaking.update(step, { role: 'listening' });
      listening.update(step, { role: 'listening' });
      const invited = this.#yieldOnGaze
        ? speaking.atPartner && listening.atPartner
        : this.#gap >= 1.2;
      if (invited || this.#gap >= 2.5) {
        this.lastHandover = this.#gap;
        this.handovers.push(this.#gap);
        this.speaker = this.speaker === 0 ? 1 : 0;
        this.#since = 0;
        this.#length = this.#draw();
        this.#gap = -1;
      }
    }
  }

  /** Both looking at once, this frame. */
  get mutual(): boolean {
    return this.a.atPartner && this.b.atPartner;
  }
}
