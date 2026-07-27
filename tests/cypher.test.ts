import { describe, it, expect } from 'vitest';
import { createHumanoid, Cypher, type DancePulse } from '../src';

const pulseAt = (bass: number, beat = false, bpm = 120): DancePulse => ({
  bass,
  mid: 0.4,
  treble: 0.3,
  beat,
  bpm,
});

const ring = (n = 5, seed = 7, barsPerTurn = 1) => {
  const rigs = Array.from({ length: n }, (_, i) => createHumanoid({ seed: 30 + i }));
  const cypher = new Cypher(rigs, { seed, radius: 2.0, barsPerTurn, bpm: 120 });
  cypher.place(0, 0);
  cypher.start();
  return { rigs, cypher };
};

const groove = (c: Cypher, seconds: number, bpm = 120): void => {
  const spb = 60 / bpm;
  let since = 0;
  for (let i = 0; i < seconds * 60; i++) {
    since += 1 / 60;
    const beat = since >= spb;
    if (beat) since -= spb;
    c.update(1 / 60, pulseAt(beat ? 1 : 0.4, beat, bpm));
  }
};

describe('the cypher', () => {
  it('needs at least three', () => {
    const rigs = [createHumanoid({ seed: 1 }), createHumanoid({ seed: 2 })];
    expect(() => new Cypher(rigs)).toThrow();
  });

  it('places the ring on the circle, everyone facing the middle', () => {
    const { rigs } = ring(6);
    for (const rig of rigs) {
      const r = Math.hypot(rig.object.position.x, rig.object.position.z);
      // The centred dancer has walked in by start(); the rest hold the ring.
      if (r > 0.5) {
        expect(r).toBeCloseTo(2.0, 1);
        // Facing the centre: walking forward would shrink their radius.
        const fx = Math.sin(rig.object.rotation.y);
        const fz = Math.cos(rig.object.rotation.y);
        const dot = fx * -rig.object.position.x + fz * -rig.object.position.z;
        expect(dot).toBeGreaterThan(1.8);
      }
    }
  });

  it('somebody takes the centre', () => {
    const { rigs, cypher } = ring(5, 7, 8);
    groove(cypher, 3);
    const c = rigs[cypher.centre].object.position;
    expect(Math.hypot(c.x, c.z)).toBeLessThan(0.3);
    expect(cypher.state).toBe('showing');
  });

  it('the turn is handed on, round robin, and everybody gets the floor', () => {
    const { cypher } = ring(4, 7, 1);
    const seen = new Set<number>([cypher.centre]);
    // 1 bar per turn at 120 = 2s + 1.1s swap; give it plenty.
    for (let s = 0; s < 40 && seen.size < 4; s++) {
      groove(cypher, 1);
      seen.add(cypher.centre);
    }
    expect(seen.size).toBe(4);
    expect(cypher.turns).toBeGreaterThanOrEqual(3);
  });

  it('the swap eases: nobody teleports', () => {
    const { rigs, cypher } = ring(4, 7, 1);
    groove(cypher, 2);
    let worst = 0;
    const prev = rigs.map((r) => r.object.position.clone());
    for (let i = 0; i < 12 * 60; i++) {
      cypher.update(1 / 60, pulseAt(0.6, i % 30 === 0, 120));
      rigs.forEach((r, j) => {
        worst = Math.max(worst, r.object.position.distanceTo(prev[j]));
        prev[j].copy(r.object.position);
      });
    }
    // Two metres in ~1.1s of swap is ~3.5 cm/frame at 60fps.
    expect(worst).toBeLessThan(0.08);
    expect(worst).toBeGreaterThan(0.005); // and people really are moving
  });

  it('the centre is louder than the ring, from the same music', () => {
    const { cypher } = ring(5, 7, 8); // long turns: nobody swaps mid-reading
    groove(cypher, 4);
    const centreEnergy = cypher.dancers[cypher.centre].energy;
    const ringIdx = (cypher.centre + 2) % 5;
    expect(centreEnergy).toBeGreaterThan(cypher.dancers[ringIdx].energy * 1.5);
  });

  it('the centre shows out in a showcase style; the ring grooves club', () => {
    const { cypher } = ring(5, 7, 8);
    groove(cypher, 2);
    expect(cypher.dancers[cypher.centre].style).not.toBe('club');
    cypher.dancers.forEach((d, i) => {
      if (i !== cypher.centre) expect(d.style).toBe('club');
    });
  });

  it('different turns, different showcases (seeded)', () => {
    const { cypher } = ring(6, 3, 1);
    const styles = new Set<string>([cypher.dancers[cypher.centre].style]);
    for (let s = 0; s < 40 && styles.size < 3; s++) {
      groove(cypher, 1);
      styles.add(cypher.dancers[cypher.centre].style);
    }
    expect(styles.size).toBeGreaterThanOrEqual(3);
  });

  it('stop() sends the centre home and the circle goes still', () => {
    const { rigs, cypher } = ring(5);
    groove(cypher, 3);
    cypher.stop();
    groove(cypher, 3);
    for (const rig of rigs) {
      const r = Math.hypot(rig.object.position.x, rig.object.position.z);
      expect(r).toBeCloseTo(2.0, 1);
    }
    expect(cypher.state).toBe('idle');
  });

  it('is deterministic', () => {
    const a = ring(5, 11, 1);
    const b = ring(5, 11, 1);
    groove(a.cypher, 8);
    groove(b.cypher, 8);
    expect(a.cypher.centre).toBe(b.cypher.centre);
    expect(a.cypher.turns).toBe(b.cypher.turns);
    expect(
      a.rigs[0].bones.Head.quaternion.angleTo(b.rigs[0].bones.Head.quaternion)
    ).toBeLessThan(1e-9);
  });
});
