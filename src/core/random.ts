/**
 * Seeded RNG (mulberry32) — the same determinism contract as SCENA:
 * same seed, same character. `Math.random` appears nowhere in ANIMA.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  /** Next float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  jitter(value: number, amount: number): number {
    return value + this.range(-amount, amount);
  }

  /** An independent child stream (advances this one once). */
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 4294967296));
  }
}
