import type { HumanoidRig } from './humanoid';
import { FIGHT_STYLES, FightStyle, type FightStyleName } from './fightstyle';
import { GUARD_NAMES, Guard, canReactTo, coverageOf, type GuardName, type GuardZone } from './guard';
import {
  STRIKES,
  Striking,
  bodyMass,
  measureStrike,
  stability,
  strikeReach,
  type Blow,
  type StrikeName,
} from './striking';

/**
 * Sparring — the payoff, and the point of the whole fighting track.
 *
 * Two fighters, two styles, and a decision function that reads FOUR numbers,
 * every one of which some module here measures off a real body:
 *
 *   strikeReach(rig, s)   can this limb get there from here
 *   stability(rig)         can I afford to throw it
 *   canReactTo(s, skill)   will they see it coming
 *   impulse                what it arrives with, if it lands
 *
 * It does not read height. It does not read weight, or style, or who is
 * supposed to win. There is no matchup table, no rock-paper-scissors between
 * the six styles, and no hidden roll.
 *
 * And yet, put a tall fighter in with a short one and THE TALL ONE WINS MORE —
 * because `strikeReach` comes out larger on a longer arm, so there is a band of
 * distance in which one of them can reach and the other cannot, and the fighter
 * who cannot reach has to walk through it. Nobody encoded that. It is the same
 * argument the whole library is built on, run to its end: measure the world
 * honestly and the tactics are already in it.
 *
 * ## The fatigue is a work budget, not a timer
 *
 * `Striking` already reports the kinetic energy of every strike in Joules.
 * Muscle converts chemical energy to mechanical work at about 20% efficiency,
 * and a body's anaerobic reserve is roughly 300 J per kilogram before power
 * falls away. Both are published figures rather than tuning knobs, and between
 * them they say how many strikes a given body has in it — so the fatigue curve
 * is a fraction of a real budget, exactly the way `Lifting` derives its rep
 * budget from Epley rather than choosing one.
 *
 * A tired fighter here does not have a debuff applied. They have spent the
 * energy, and what decays is what spending it costs: the guard comes down and
 * the chain fires later, both of which are measured consequences elsewhere.
 */

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => clamp(v, 0, 1);

/** Mechanical efficiency of muscle. About a fifth; the rest is heat. */
export const MUSCLE_EFFICIENCY = 0.2;
/** Anaerobic reserve, joules per kilogram of body, before power falls away. */
export const ANAEROBIC_RESERVE = 300;

/** How much of a body's reserve one strike costs, in joules of fuel. */
export function strikeCost(energy: number): number {
  return energy / MUSCLE_EFFICIENCY;
}

// ------------------------------------------------------------- the card

/**
 * What a fighter knows about their own body.
 *
 * Measured once, per strike, on this rig standing in this style's stance —
 * because it IS knowable: a fighter who has thrown ten thousand crosses knows
 * how far theirs goes and what it costs them. Nothing here is a rating.
 */
export interface StrikeCard {
  strike: StrikeName;
  /** How far the surface can get, metres from the body's own origin. */
  reach: number;
  /** How much balance margin throwing it eats, in foot lengths. */
  cost: number;
  /** What it arrives with on a clean hit, kg·m/s. */
  impulse: number;
  /** ...and what it costs to throw, in joules of fuel. */
  fuel: number;
}

export interface FighterOptions {
  style: FightStyleName;
  /** 0..1. Decides the kinetic chain, the reaction time and nothing else. */
  skill?: number;
  lead?: 'Left' | 'Right';
  /** Playback rate for this fighter's strikes. */
  tempo?: number;
}

/**
 * One side of a bout: a body, a style, and a card of what it can do.
 *
 * Owns a `FightStyle`, a `Guard` and a `Striking` and drives them in the order
 * they have to be driven in — the stance first, because `Striking` composes
 * its weight shift and hip turn on top of one.
 */
export class Fighter {
  readonly rig: HumanoidRig;
  readonly style: FightStyle;
  readonly guard: Guard;
  readonly striking: Striking;
  readonly card: StrikeCard[];
  /** Body mass, kg — and therefore the size of the tank. */
  readonly mass: number;
  /** Joules of fuel this body has before power falls away. */
  readonly budget: number;

  /** 0..1 through the budget. Everything that decays reads this. */
  fatigue = 0;
  /** Joules spent so far. */
  spent = 0;
  /** Strikes declared, strikes that reached, and what got through. */
  thrown = 0;
  landed = 0;
  through = 0;
  stopped = 0;
  taken = 0;
  /** What has got through, split by where it landed. */
  readonly takenAt: Record<Aim, number> = { head: 0, body: 0 };
  /** Every guard this body could hold, and what each covers. Measured once. */
  readonly guardCard: Array<{ guard: GuardName; head: number; body: number }> = [];

  private readonly base: number;
  private beat = 0;
  private cool = 0;

  constructor(rig: HumanoidRig, options: FighterOptions) {
    this.rig = rig;
    const name = options.style;
    const spec = FIGHT_STYLES[name];
    const skill = clamp01(options.skill ?? 0.75);
    this.rested = skill;
    this.style = new FightStyle(rig, name, { lead: options.lead, fade: 0.25 });
    this.guard = new Guard(rig, { style: spec.guard, skill, fade: 0.18 });
    this.striking = new Striking(rig, {
      skill,
      tempo: options.tempo ?? 1,
      fade: 0.12,
      footing: spec.stance,
      stance: options.lead === 'Right' ? 'southpaw' : 'orthodox',
    });
    this.mass = bodyMass(rig);
    this.budget = ANAEROBIC_RESERVE * this.mass;

    // What every guard in the library is worth ON THIS BODY. Measured, not
    // tabulated, because a guard is a pose of the arms and arms differ.
    for (const g of GUARD_NAMES) {
      const probe = new Guard(rig, { style: g, fade: 0 });
      for (let i = 0; i < 40; i++) probe.update(1 / 120);
      this.guardCard.push({
        guard: g,
        head: coverageOf(rig, 'head'),
        body: coverageOf(rig, 'body'),
      });
      probe.lower();
      for (let i = 0; i < 40; i++) probe.update(1 / 120);
    }

    // The card. Measured on a clean copy of the pose, once.
    rig.object.updateMatrixWorld(true);
    this.base = stability(rig);
    this.card = spec.repertoire.map((s) => {
      const r = measureStrike(rig, s, { skill, footing: spec.stance });
      return {
        strike: s,
        reach: strikeReach(rig, s),
        cost: Math.max(0, this.base - r.worstBalance),
        impulse: r.impulse,
        fuel: strikeCost(r.energy),
      };
    });
  }

  /** Skill before any of it was spent. */
  readonly rested: number;

  /**
   * Skill right now.
   *
   * A tired fighter's chain fires later and their reaction is slower, which is
   * what `skill` means in `Striking` and `Guard` — so fatigue does not need a
   * separate mechanism, it needs to move the number those two already read.
   */
  get skill(): number {
    return this.rested * (1 - 0.45 * this.fatigue);
  }

  /** The furthest this fighter can currently hurt anybody, metres. */
  get range(): number {
    let far = 0;
    for (const c of this.card) far = Math.max(far, c.reach);
    return far;
  }

  /** Spend fuel, and let the fatigue follow it. */
  spend(joules: number): void {
    this.spent += joules;
    this.fatigue = clamp01(this.spent / this.budget);
  }

  /** Whether this fighter is ready to throw again. */
  get ready(): boolean {
    return this.cool <= 0 && this.striking.phase === 'guard';
  }

  /** Walk the repertoire, for anything that wants a rotation rather than a choice. */
  next(): StrikeName {
    return this.style.at(this.beat++);
  }

  tick(dt: number): void {
    this.cool = Math.max(0, this.cool - dt);
  }

  rest(seconds: number): void {
    this.cool = Math.max(this.cool, seconds);
  }

  /**
   * Between rounds, cover where you have been hit.
   *
   * The one piece of memory in the whole bout, and it is the piece that stops
   * both fighters being metronomes: an attacker who can see an opening walks
   * into it every time, so the answer is not to give them the same opening in
   * round two. Which guard to switch to is MEASURED — the best cover of the
   * zone that has been hurting, off this body's own `guardCard` — rather than
   * chosen from a table of counters.
   */
  adapt(): GuardName {
    const hurting: Aim = this.takenAt.body > this.takenAt.head ? 'body' : 'head';
    let best = this.guardCard[0];
    for (const g of this.guardCard) if (g[hurting] > best[hurting]) best = g;
    this.guard.hold(best.guard);
    return best.guard;
  }

  /** Which guard is being held now. */
  get guarding(): GuardName {
    return this.guard.style;
  }
}

// ------------------------------------------------------------ the choice

/**
 * What to throw from here, or nothing.
 *
 * The whole decision, and every term in it is a measurement:
 *
 *   1. it has to REACH. `strikeReach` on this body against the actual gap
 *   2. it has to be AFFORDABLE. The cost is how much balance margin the strike
 *      ate when it was measured, and the margin available is `stability()` on
 *      the body right now — so a fighter who is already off balance stops
 *      throwing the committed things, which is what people do
 *   3. of what is left, prefer what they cannot SEE. `canReactTo` races the
 *      wind-up against their reaction time
 *   4. and among those, the heaviest.
 *
 * There is no term for who is taller, and no term for style. Both of those
 * arrive through (1), because a longer arm reaches further and a stance with
 * kicks in it has strikes that reach further still.
 */
export function chooseStrike(me: Fighter, them: Fighter, gap: number): Choice | null {
  me.rig.object.updateMatrixWorld(true);
  them.rig.object.updateMatrixWorld(true);
  const headroom = stability(me.rig);
  // Where they are OPEN, right now. `coverageOf` is a measurement of the pose
  // the opponent is standing in, which is a thing you can see — so reading it
  // is not cheating in the way reading their height would be.
  const open: Record<Aim, number> = {
    head: 1 - coverageOf(them.rig, 'head' as GuardZone),
    body: 1 - coverageOf(them.rig, 'body' as GuardZone),
  };
  let best: Choice | null = null;
  let bestScore = -Infinity;
  for (const c of me.card) {
    if (c.reach < gap) continue;
    if (headroom - c.cost <= 0) continue;
    // You cannot throw what you cannot pay for. The budget is real joules and
    // `strikeCost` spends them, so an exhausted fighter is left with the cheap
    // strikes — which is why the last round is jabs, and nobody wrote that.
    if (me.spent + c.fuel > me.budget) continue;
    // Value for what it costs. Fuel is the finite thing in a bout, so the
    // objective is impulse per joule rather than impulse — which needs no
    // coefficient to justify it.
    const unseen = canReactTo(c.strike, them.skill) ? 1 : 1.6;
    const value = (c.impulse * unseen) / Math.max(1, c.fuel);
    for (const zone of AIMS) {
      const score = value * open[zone];
      if (score > bestScore) {
        bestScore = score;
        best = { strike: c.strike, zone };
      }
    }
  }
  return best;
}

/** Where a strike is aimed. The two zones a guard trades between. */
export type Aim = 'head' | 'body';
const AIMS: Aim[] = ['head', 'body'];

export interface Choice {
  strike: StrikeName;
  zone: Aim;
}

/**
 * The gap this fighter wants to be at.
 *
 * Just inside the longest thing they can still afford to throw. A fighter with
 * a longer reach wants a longer gap, and that is the entire mechanism behind
 * everything the bout does.
 */
export function preferredGap(me: Fighter): number {
  me.rig.object.updateMatrixWorld(true);
  const headroom = stability(me.rig);
  let far = 0;
  let bestValue = -Infinity;
  for (const c of me.card) {
    if (headroom - c.cost <= 0) continue;
    if (me.spent + c.fuel > me.budget) continue;
    const value = c.impulse / Math.max(1, c.fuel);
    // Where the best VALUE strike works, not where the longest one does.
    // Standing at the edge of your longest reach means only one thing in the
    // repertoire is ever available, and a fighter who throws the same shot 83
    // times in a row is not sparring, they are a metronome.
    if (value > bestValue) {
      bestValue = value;
      far = c.reach;
    }
  }
  return far * INSIDE;
}

/** How far inside their own maximum a fighter stands. Nobody fights at full stretch. */
const INSIDE = 0.94;
/** Metres per second the gap closes when somebody wants it closed. */
const CLOSE = 0.9;
/** ...and opens. Backing off is slower than walking in, which is why pressure works. */
const OPEN = 0.42;

// -------------------------------------------------------------- the bout

export interface Exchange {
  /** Seconds into the bout. */
  at: number;
  round: number;
  /** 0 for the first fighter, 1 for the second. */
  by: 0 | 1;
  strike: StrikeName;
  /** Where it was aimed. */
  zone: Aim;
  /** The gap when it was declared, metres. */
  gap: number;
  /** ...and what this body could reach at that moment. */
  reach: number;
  landed: boolean;
  stopped: boolean;
  through: number;
}

export interface BoutReport {
  rounds: number;
  seconds: number;
  exchanges: Exchange[];
  /** Per fighter: thrown, landed, impulse through, impulse taken, fatigue. */
  score: Array<{
    style: FightStyleName;
    height: number;
    range: number;
    thrown: number;
    landed: number;
    through: number;
    taken: number;
    fatigue: number;
  }>;
  /** Which fighter is taller, and whether they came out ahead. */
  taller: 0 | 1;
  tallerAhead: boolean;
  /** What each fighter switched to at each break between rounds. */
  guards: Array<[GuardName, GuardName]>;
}

export interface BoutOptions {
  rounds?: number;
  /** Seconds per round, in the bout's own clock. */
  roundSeconds?: number;
  /** Seconds between one fighter's strikes. */
  recovery?: number;
  /** Where the two start, metres apart. */
  gap?: number;
}

/**
 * Two fighters, a gap between them, and nothing else.
 *
 * The bout is deterministic: no random numbers anywhere. The same two bodies
 * fight the same fight every time, which is what makes the result below a
 * measurement rather than an anecdote — and what lets GAMA replay it.
 */
export class Bout {
  readonly a: Fighter;
  readonly b: Fighter;
  /** Distance between the two bodies, metres. */
  gap: number;
  round = 1;
  clock = 0;
  done = false;
  readonly exchanges: Exchange[] = [];
  /** What each fighter switched to at each break. */
  readonly guards: Array<[GuardName, GuardName]> = [];

  private readonly rounds: number;
  private readonly roundSeconds: number;
  private readonly recovery: number;
  private roundClock = 0;
  private readonly pending: Array<{ at: number; strike: StrikeName; on: 0 | 1 }> = [];

  constructor(a: Fighter, b: Fighter, options: BoutOptions = {}) {
    this.a = a;
    this.b = b;
    this.rounds = Math.max(1, options.rounds ?? 3);
    this.roundSeconds = Math.max(1, options.roundSeconds ?? 40);
    this.recovery = Math.max(0.05, options.recovery ?? 0.55);
    this.gap = options.gap ?? Math.max(a.range, b.range) * 1.15;
    this.place();
    a.striking.aimAt(b.rig.bones.Head);
    b.striking.aimAt(a.rig.bones.Head);
    a.striking.onBlow((blow) => this.arrive(0, blow));
    b.striking.onBlow((blow) => this.arrive(1, blow));
  }

  /** Stand them the gap apart, facing each other, on the same line. */
  private place(): void {
    this.a.rig.object.position.set(0, 0, -this.gap / 2);
    this.a.rig.object.rotation.y = 0;
    this.b.rig.object.position.set(0, 0, this.gap / 2);
    this.b.rig.object.rotation.y = Math.PI;
    this.a.rig.object.updateMatrixWorld(true);
    this.b.rig.object.updateMatrixWorld(true);
  }

  private arrive(by: 0 | 1, blow: Blow): void {
    const me = by === 0 ? this.a : this.b;
    const them = by === 0 ? this.b : this.a;
    const answer = them.guard.defend(blow);
    me.landed++;
    me.through += answer.through;
    if (answer.stopped) me.stopped++;
    them.taken += answer.through;
    const where: Aim = answer.zone === 'body' ? 'body' : 'head';
    them.takenAt[where] += answer.through;
    const last = this.exchanges[this.exchanges.length - 1];
    if (last && last.by === by && !last.landed) {
      last.landed = true;
      last.stopped = answer.stopped;
      last.through = answer.through;
    }
  }

  update(dt: number): void {
    if (this.done) return;
    const step = Math.max(0, dt);
    this.clock += step;
    this.roundClock += step;

    // FOOTWORK. Each fighter wants their own range; the gap moves toward both
    // wants at once. Closing is quicker than backing off, which is the whole
    // reason a pressure fighter ever gets inside a longer one.
    const wantA = preferredGap(this.a);
    const wantB = preferredGap(this.b);
    let drift = 0;
    for (const want of [wantA, wantB]) {
      const d = want - this.gap;
      drift += d < 0 ? d * CLOSE : d * OPEN;
    }
    this.gap = Math.max(0.28, this.gap + drift * step);
    this.place();

    // Anything that has now been seen.
    for (let k = this.pending.length - 1; k >= 0; k--) {
      const p = this.pending[k];
      if (this.clock < p.at) continue;
      (p.on === 0 ? this.a : this.b).guard.react(p.strike, 'parry');
      this.pending.splice(k, 1);
    }

    for (const [i, me, them] of [
      [0, this.a, this.b],
      [1, this.b, this.a],
    ] as Array<[0 | 1, Fighter, Fighter]>) {
      me.tick(step);
      if (me.ready) {
        const pick = chooseStrike(me, them, this.gap);
        if (pick) {
          me.striking.aimAt(pick.zone === 'head' ? them.rig.bones.Head : them.rig.bones.Chest);
          me.striking.throwStrike(pick.strike);
          me.thrown++;
          me.spend(me.card.find((c) => c.strike === pick.strike)?.fuel ?? 0);
          me.rest(this.recovery + STRIKES[pick.strike].windup + STRIKES[pick.strike].recover);
          this.exchanges.push({
            at: this.clock,
            round: this.round,
            by: i,
            strike: pick.strike,
            zone: pick.zone,
            gap: this.gap,
            reach: me.card.find((c) => c.strike === pick.strike)?.reach ?? 0,
            landed: false,
            stopped: false,
            through: 0,
          });
          // The defender answers what they can SEE, WHEN they would have seen
          // it. Triggering on declaration is the defect `Guard`'s own gate
          // caught in 0.50.0 — a defence 260 ms early is not a defence.
          if (canReactTo(pick.strike, them.skill)) {
            this.pending.push({
              at: this.clock + them.guard.reaction,
              strike: pick.strike,
              on: (1 - i) as 0 | 1,
            });
          }
        }
      }
      // ORDER, and it is not arbitrary. The stance first, because `Striking`
      // composes its weight shift on top of one. Then the strike. Then the
      // guard — which owns the hands EXCEPT while a strike is in the air,
      // because `Striking` drives both arms during one and whoever runs last
      // wins. Running the guard first meant the defender's hands were wherever
      // their own last punch left them, and the guard stopped NOTHING: 0 of 83
      // crosses, in a module whose own gate says a peekaboo stops a cross.
      me.style.update(step);
      me.striking.update(step);
      if (me.striking.phase === 'guard') me.guard.update(step);
    }

    if (this.roundClock >= this.roundSeconds) {
      this.roundClock = 0;
      if (this.round >= this.rounds) this.done = true;
      else {
        this.round++;
        // The corner. Both fighters cover where they have been hit.
        this.guards.push([this.a.adapt(), this.b.adapt()]);
      }
    }
  }

  report(): BoutReport {
    const side = (f: Fighter): BoutReport['score'][number] => ({
      style: f.style.name,
      height: f.rig.height,
      range: f.range,
      thrown: f.thrown,
      landed: f.landed,
      through: f.through,
      taken: f.taken,
      fatigue: f.fatigue,
    });
    const taller: 0 | 1 = this.a.rig.height >= this.b.rig.height ? 0 : 1;
    const score = [side(this.a), side(this.b)];
    return {
      rounds: this.rounds,
      seconds: this.clock,
      exchanges: this.exchanges,
      score,
      taller,
      tallerAhead: score[taller].through > score[1 - taller].through,
      guards: this.guards,
    };
  }
}

/**
 * Run a bout to its end and report it.
 *
 * Fixed step, no randomness, deterministic — so the same two seeds produce the
 * same bout every time and the statistics below are a measurement.
 */
export function measureBout(a: Fighter, b: Fighter, options: BoutOptions & { step?: number } = {}) {
  const step = options.step ?? 1 / 60;
  const bout = new Bout(a, b, options);
  let guard = 0;
  while (!bout.done && guard++ < 200000) bout.update(step);
  return bout.report();
}
