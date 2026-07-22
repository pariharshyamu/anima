import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { createHumanoid, type HairStyle } from '../src/index';

function vertexCount(rig: ReturnType<typeof createHumanoid>): number {
  return rig.mesh.geometry.getAttribute('position').count;
}

/** Count vertices painted exactly this color (within jitter tolerance). */
function verticesNear(rig: ReturnType<typeof createHumanoid>, hex: number, tolerance = 0.06): number {
  const colors = rig.mesh.geometry.getAttribute('color');
  const target = new Color(hex);
  let count = 0;
  for (let i = 0; i < colors.count; i++) {
    if (
      Math.abs(colors.getX(i) - target.r) < tolerance &&
      Math.abs(colors.getY(i) - target.g) < tolerance &&
      Math.abs(colors.getZ(i) - target.b) < tolerance
    ) {
      count++;
    }
  }
  return count;
}

describe('faces', () => {
  it('every character has eyes: white sclera vertices exist', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const rig = createHumanoid({ seed, accessories: 'none' });
      expect(verticesNear(rig, 0xf4f2ec)).toBeGreaterThanOrEqual(48); // 2 boxes × 24
    }
  });

  it('face features are seeded-deterministic and overridable', () => {
    const a = createHumanoid({ seed: 42 });
    const b = createHumanoid({ seed: 42 });
    expect(vertexCount(a)).toBe(vertexCount(b));

    const custom = createHumanoid({
      seed: 42,
      face: { eyes: { color: 0x2e4a6b }, mouth: { smile: 1 }, facialHair: 'none' },
    });
    expect(verticesNear(custom, 0x2e4a6b, 0.02)).toBeGreaterThanOrEqual(24);
  });

  it('facial hair options add geometry', () => {
    const clean = createHumanoid({ seed: 9, accessories: 'none', face: { facialHair: 'none' } });
    const mustache = createHumanoid({ seed: 9, accessories: 'none', face: { facialHair: 'mustache' } });
    const full = createHumanoid({ seed: 9, accessories: 'none', face: { facialHair: 'full' } });
    expect(vertexCount(mustache)).toBe(vertexCount(clean) + 24);
    expect(vertexCount(full)).toBe(vertexCount(clean) + 24 * 3);
  });

  it('brow angle rotates brow boxes (stern vs kind differ)', () => {
    const stern = createHumanoid({ seed: 4, accessories: 'none', face: { brows: { angle: -0.4 } } });
    const kind = createHumanoid({ seed: 4, accessories: 'none', face: { brows: { angle: 0.4 } } });
    // Same topology, different vertex positions.
    expect(vertexCount(stern)).toBe(vertexCount(kind));
    const a = stern.mesh.geometry.getAttribute('position');
    const b = kind.mesh.geometry.getAttribute('position');
    let maxDelta = 0;
    for (let i = 0; i < a.count; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(a.getY(i) - b.getY(i)));
    }
    expect(maxDelta).toBeGreaterThan(0.001);
  });
});

describe('hair styles', () => {
  const styles: HairStyle[] = ['bald', 'cap', 'side-part', 'bob', 'ponytail', 'bun', 'long', 'spiky'];

  it('each style has distinct geometry; bald has the least', () => {
    const signatures = new Map<HairStyle, string>();
    const counts = new Map<HairStyle, number>();
    for (const style of styles) {
      const rig = createHumanoid({ seed: 3, accessories: 'none', hair: { style }, face: { facialHair: 'none' } });
      counts.set(style, vertexCount(rig));
      const positions = rig.mesh.geometry.getAttribute('position');
      let sum = 0;
      for (let i = 0; i < positions.count; i++) {
        sum += Math.abs(positions.getX(i)) + positions.getY(i) * 3 + Math.abs(positions.getZ(i)) * 7;
      }
      signatures.set(style, `${positions.count}:${sum.toFixed(4)}`);
    }
    const bald = counts.get('bald')!;
    for (const style of styles) {
      if (style !== 'bald') expect(counts.get(style)!).toBeGreaterThan(bald);
    }
    // Shapes are pairwise distinct even where box counts coincide.
    expect(new Set([...signatures.values()]).size).toBe(styles.length);
  });

  it('hair color override paints the hair', () => {
    const rig = createHumanoid({
      seed: 3,
      accessories: 'none',
      hair: { style: 'long', color: 0xcc44aa },
      face: { facialHair: 'none' },
    });
    expect(verticesNear(rig, 0xcc44aa, 0.03)).toBeGreaterThanOrEqual(24 * 3);
  });

  it('a hat forces short hair unless the style is explicit', () => {
    // Seeded style under a hat never produces tall/back styles.
    for (let seed = 1; seed <= 20; seed++) {
      const rig = createHumanoid({ seed, accessories: ['hat'], face: { facialHair: 'none' } });
      const explicit = createHumanoid({
        seed,
        accessories: ['hat'],
        hair: { style: 'cap' },
        face: { facialHair: 'none' },
      });
      // Hat + seeded hair is never bigger than hat + explicit cap + spiky margin.
      expect(vertexCount(rig)).toBeLessThanOrEqual(vertexCount(explicit) + 24);
    }
  });

  it('faces bake into crowds for free (vertex ids cover face boxes)', async () => {
    const { Crowd } = await import('../src/index');
    const crowd = new Crowd({ count: 4, seed: 5, variants: 1 });
    const mesh = crowd.group.children[0] as unknown as {
      geometry: { getAttribute(name: string): { count: number } };
    };
    // The crowd geometry includes eye/face vertices (well above bare-body count).
    expect(mesh.geometry.getAttribute('aVertexId').count).toBeGreaterThan(700);
  });
});
