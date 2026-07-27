import type { HumanoidRig } from './humanoid';
import { Asana, SURYA_NAMASKAR, type AsanaName, type FlowStep } from './asana';

/**
 * The yoga class — one practice, many bodies, none of them clones.
 *
 * `Couple` re-keyed from music to breath: the instructor keeps the clock
 * and the sequence; the students keep **the instructor's** clock, a
 * watching-lag late, because that lag is physically what following a class
 * *is* — you see the teacher move, then you move. Each student's own breath
 * detector is ignored entirely; the front of the room outranks the lungs.
 *
 * ```ts
 * const cls = new YogaClass(rigs, { seed: 7 });   // rigs[0] teaches
 * cls.place(0, 0);
 * cls.start();                                     // Surya Namaskar, looped
 * game.onUpdate((t) => cls.update(t.delta));
 * ```
 *
 * ## Imperfection is the realism budget
 *
 * A room of identical perfect folds screams CGI instantly, so every student
 * draws a seeded practice of their own:
 *
 * - a **watching lag** (~a third to four-fifths of a second) — poses and
 *   breath both arrive that late, and differently late per student;
 * - a **depth** — how much of each pose's upper body they can actually
 *   reach. A stiff student's fold simply does not go as deep. Depth never
 *   touches the legs or the root, so the floor contract survives every
 *   shallow practice;
 * - their own sway personality, inherited from `Asana`'s seed.
 *
 * The instructor is the only body running the flow; students receive each
 * pose as it is struck at the front, through their own lag. Stop the class
 * and everyone comes home — on their own time, latest lag last.
 */

export interface YogaClassOptions {
  seed?: number;
  /** The class tempo. Default 6 breaths a minute. */
  breathsPerMinute?: number;
  /** Metres between mats in a row. Default 1.7. */
  spacing?: number;
  /** Mats per row. Default 4. */
  perRow?: number;
}

export class YogaClass {
  /** The front of the room: the only body running the sequence. */
  readonly instructor: Asana;
  readonly students: Asana[];

  private rigs: HumanoidRig[];
  private rate: number;
  private spacing: number;
  private perRow: number;
  private lags: number[];
  private time = 0;
  private lastPose: AsanaName | null = null;
  /** Strikes in flight: seen at the front, not yet arrived at each mat. */
  private queue: Array<{ student: number; pose: AsanaName; at: number }> = [];

  constructor(rigs: HumanoidRig[], options: YogaClassOptions = {}) {
    if (rigs.length < 2) throw new Error('a class needs an instructor and at least one student');
    this.rigs = rigs;
    this.rate = options.breathsPerMinute ?? 6;
    this.spacing = options.spacing ?? 1.7;
    this.perRow = Math.max(1, options.perRow ?? 4);
    const seed = options.seed ?? 1;
    // mulberry32, privately — same reasons as Dance and Cypher.
    let s = seed >>> 0 || 1;
    const rand = (): number => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.instructor = new Asana(rigs[0], { seed, breathsPerMinute: this.rate });
    this.students = rigs.slice(1).map(
      (rig, i) =>
        new Asana(rig, {
          seed: seed + 31 * i + 7,
          breathsPerMinute: this.rate,
          depth: 0.55 + rand() * 0.45,
        })
    );
    this.lags = this.students.map(() => 0.3 + rand() * 0.5);
  }

  /**
   * Lay out the room: the instructor's mat at (x, z) facing the class, the
   * students in rows behind their own mats, all facing the front. `facing`
   * is the direction the CLASS faces — point it at the sunrise.
   */
  place(x: number, z: number, facing = 0): void {
    const dx = Math.sin(facing);
    const dz = Math.cos(facing);
    // Perpendicular, for spreading a row.
    const px = dz;
    const pz = -dx;
    const inst = this.rigs[0].object;
    inst.position.set(x, 0, z);
    inst.rotation.y = facing + Math.PI;
    this.rigs.slice(1).forEach((rig, i) => {
      const row = Math.floor(i / this.perRow);
      const inRow = Math.min(this.perRow, this.students.length - row * this.perRow);
      const lat = (i % this.perRow) - (inRow - 1) / 2;
      const back = 2.0 + row * this.spacing * 1.35;
      rig.object.position.set(
        x - dx * back + px * lat * this.spacing,
        0,
        z - dz * back + pz * lat * this.spacing
      );
      rig.object.rotation.y = facing;
    });
  }

  /** What the front of the room is doing. */
  get pose(): AsanaName | null {
    return this.instructor.pose;
  }

  get holding(): boolean {
    return this.instructor.holding;
  }

  /** Begin the practice. Default: the sun salutation, looped. */
  start(steps: FlowStep[] = SURYA_NAMASKAR, opts: { loop?: boolean } = {}): void {
    this.instructor.flow(steps, { loop: opts.loop ?? true });
  }

  /** End the practice: everyone comes home, latest lag last. */
  stop(): void {
    this.queue = [];
    this.lastPose = null;
    this.instructor.release();
    for (const student of this.students) student.release();
  }

  /** One tick of the room. */
  update(dt: number): void {
    this.time += dt;
    this.instructor.update(dt);

    // A new pose at the front: every mat sees it, each on their own delay.
    const front = this.instructor.pose;
    if (front && front !== this.lastPose && this.instructor.holding) {
      this.lastPose = front;
      this.students.forEach((_, i) => {
        this.queue.push({ student: i, pose: front, at: this.time + this.lags[i] });
      });
    }

    // Strikes arriving now.
    if (this.queue.length) {
      const due = this.queue.filter((q) => q.at <= this.time);
      if (due.length) {
        for (const q of due) this.students[q.student].strike(q.pose);
        this.queue = this.queue.filter((q) => q.at > this.time);
      }
    }

    // The breath follows the front too — surrendered, not kept: each
    // student rides the instructor's clock, their watching-lag behind.
    for (let i = 0; i < this.students.length; i++) {
      const student = this.students[i];
      if (student.holding) {
        student.slaveTo(this.instructor.breath - (this.lags[i] * this.rate) / 60);
      }
      student.update(dt);
    }
  }
}
