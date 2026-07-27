import type { HumanoidRig } from './humanoid';
import { Dance, type DancePulse, type DanceStyle } from './dance';

/**
 * The cypher — the floor becomes a social structure.
 *
 * Every dance so far has been one body (or two, under one constraint). A
 * cypher is a **formation**: the circle forms, one dancer takes the centre
 * and shows out, the ring holds the space and answers, and after a few bars
 * the centre is handed on. Nobody administers it; the turn-taking IS the
 * dance — `Conversation`'s floor-passing, re-keyed from speech to bars.
 *
 * ```ts
 * const cypher = new Cypher(rigs, { seed: 7, radius: 2.2, barsPerTurn: 2 });
 * cypher.place(x, z);
 * cypher.start();
 * game.onUpdate((t) => cypher.update(t.delta, woofer.pulse()));
 * ```
 *
 * ## The centre is louder than the ring
 *
 * One pulse arrives; the cypher deals it unevenly. The dancer in the middle
 * hears it BOOSTED — showing out is dancing past what the music strictly
 * asks — and the ring hears it damped, grooving small, holding the circle.
 * The same body moves twice the size in the centre as it does on the ring,
 * from the same music, and that contrast is what makes a cypher read as a
 * cypher rather than a crowd with a gap in it.
 *
 * ## The turn is handed, not seized
 *
 * Each turn lasts a counted number of bars. The swap is eased — the
 * outgoing dancer backs to their spot while the incoming one walks in, over
 * about a second, both still dancing — and the order is round-robin from a
 * seeded start, so everybody gets the floor and nobody teleports. The
 * showcase style changes with the dancer: a seeded draw from the street and
 * classical repertoires, because a cypher where everyone does the same
 * thing is a rehearsal.
 */

export interface CypherOptions {
  seed?: number;
  /** Ring radius, metres. Default 2.2. */
  radius?: number;
  /** Bars each dancer holds the centre. Default 2. */
  barsPerTurn?: number;
  /** Free-run tempo before the music says otherwise. */
  bpm?: number;
  /** Styles the centre draws from. Default: a street-and-classical mix. */
  showcase?: DanceStyle[];
}

const SHOWCASE: DanceStyle[] = [
  'toprock', 'krump', 'popping', 'runningMan', 'tutting', 'bharatanatyam',
];

const smooth = (t: number): number => t * t * (3 - 2 * t);

export class Cypher {
  /** Index of the dancer who has the floor. */
  centre = 0;
  /** 'showing' while a turn runs, 'swapping' while the floor changes hands. */
  state: 'idle' | 'showing' | 'swapping' = 'idle';
  /** Completed turns since start. */
  turns = 0;

  readonly dancers: Dance[];

  private rigs: HumanoidRig[];
  private radius: number;
  private barsPerTurn: number;
  private showcase: DanceStyle[];
  private rand: () => number;
  private cx = 0;
  private cz = 0;
  private spots: Array<{ x: number; z: number; facing: number }> = [];
  private swapT = 0;
  private outgoing = -1;
  private barAtTurnStart = 0;
  /** Where each mover actually was when the swap began — no assumed spots. */
  private outFrom = { x: 0, z: 0 };
  private inFrom = { x: 0, z: 0 };

  constructor(rigs: HumanoidRig[], options: CypherOptions = {}) {
    if (rigs.length < 3) throw new Error('a cypher needs at least three dancers');
    this.rigs = rigs;
    this.radius = options.radius ?? 2.2;
    this.barsPerTurn = Math.max(1, options.barsPerTurn ?? 2);
    this.showcase = options.showcase ?? SHOWCASE;
    const seed = options.seed ?? 1;
    // mulberry32, privately — same reasons as Dance.
    let s = seed >>> 0 || 1;
    this.rand = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.dancers = rigs.map((rig, i) => new Dance(rig, { seed: seed + i * 17, bpm: options.bpm }));
    this.centre = Math.floor(this.rand() * rigs.length);
  }

  /** Stand the ring around a spot, everyone facing the middle. */
  place(x: number, z: number): void {
    this.cx = x;
    this.cz = z;
    this.spots = this.rigs.map((rig, i) => {
      const a = (i / this.rigs.length) * Math.PI * 2;
      const sx = x + Math.sin(a) * this.radius;
      const sz = z + Math.cos(a) * this.radius;
      // Face the centre: the ring watches, that is what a ring is for.
      const facing = Math.atan2(x - sx, z - sz);
      rig.object.position.set(sx, 0, sz);
      rig.object.rotation.y = facing;
      return { x: sx, z: sz, facing };
    });
  }

  start(): void {
    for (const d of this.dancers) d.start();
    this.enterCentre(this.centre);
    // The first dancer WALKS in like every later one — the cypher has no
    // teleports, including at the beginning.
    const rig = this.rigs[this.centre].object;
    this.inFrom = { x: rig.position.x, z: rig.position.z };
    this.outgoing = -1;
    this.swapT = 0;
    this.state = 'swapping';
  }

  stop(): void {
    for (const d of this.dancers) d.stop();
    // Whoever holds the floor walks home as they wind down.
    const rig = this.rigs[this.centre].object;
    this.outFrom = { x: rig.position.x, z: rig.position.z };
    this.state = 'swapping';
    this.outgoing = this.centre;
    this.swapT = 0;
  }

  private enterCentre(i: number): void {
    const d = this.dancers[i];
    // The showcase: a seeded draw, never the ring's groove. A cypher where
    // everyone does the same thing is a rehearsal.
    d.setStyle(this.showcase[Math.floor(this.rand() * this.showcase.length)]);
    // The ring holds the space small.
    this.dancers.forEach((rd, j) => {
      if (j !== i && rd.style !== 'club') rd.setStyle('club');
    });
  }

  /**
   * One tick of the circle. The pulse is dealt UNEVENLY: boosted to the
   * centre, damped to the ring — one music, two sizes of dancing.
   */
  update(dt: number, pulse?: DancePulse): void {
    const boosted = pulse
      ? { ...pulse, bass: Math.min(1, pulse.bass * 1.4 + 0.15), treble: Math.min(1, pulse.treble * 1.3) }
      : undefined;
    const damped = pulse
      ? { ...pulse, bass: pulse.bass * 0.45, mid: pulse.mid * 0.6, treble: pulse.treble * 0.5 }
      : undefined;

    this.dancers.forEach((d, i) => {
      d.update(dt, i === this.centre ? boosted : damped);
    });

    if (this.state === 'showing') {
      // The centre slowly turns, showing out to the whole ring.
      this.rigs[this.centre].object.rotation.y += dt * 0.7;
      const bars = this.dancers[this.centre].bar - this.barAtTurnStart;
      if (bars >= this.barsPerTurn) {
        this.outgoing = this.centre;
        const out = this.rigs[this.outgoing].object;
        this.outFrom = { x: out.position.x, z: out.position.z };
        this.centre = (this.centre + 1) % this.rigs.length;
        const inc = this.rigs[this.centre].object;
        this.inFrom = { x: inc.position.x, z: inc.position.z };
        this.enterCentre(this.centre);
        this.state = 'swapping';
        this.swapT = 0;
      }
    }

    if (this.state === 'swapping') {
      this.swapT += dt;
      const t = smooth(Math.min(1, this.swapT / 1.1));
      const dancing = this.dancers.some((d) => d.dancing);
      // The outgoing dancer backs to their spot…
      if (this.outgoing >= 0) {
        const spot = this.spots[this.outgoing];
        const rig = this.rigs[this.outgoing].object;
        rig.position.x = this.outFrom.x + (spot.x - this.outFrom.x) * t;
        rig.position.z = this.outFrom.z + (spot.z - this.outFrom.z) * t;
        rig.rotation.y = spot.facing;
      }
      // …while the incoming one walks in, both still dancing.
      if (dancing) {
        const rig = this.rigs[this.centre].object;
        rig.position.x = this.inFrom.x + (this.cx - this.inFrom.x) * t;
        rig.position.z = this.inFrom.z + (this.cz - this.inFrom.z) * t;
      }
      if (this.swapT >= 1.1) {
        this.outgoing = -1;
        if (dancing) {
          this.state = 'showing';
          this.turns++;
          this.barAtTurnStart = this.dancers[this.centre].bar;
        } else {
          this.state = 'idle';
        }
      }
    }
  }
}
