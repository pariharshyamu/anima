import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { createHumanoid, describeHumanoid } from '../src/index';

type Rig = ReturnType<typeof createHumanoid>;
const vertexCount = (rig: Rig): number => rig.mesh.geometry.getAttribute('position').count;

function verticesNear(rig: Rig, hex: number, tolerance = 0.05): number {
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

/** Max |x| among vertices in a world-height band (silhouette width). */
function widthAt(rig: Rig, yMin: number, yMax: number): number {
  const pos = rig.mesh.geometry.getAttribute('position');
  let max = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y >= yMin && y <= yMax) max = Math.max(max, Math.abs(pos.getX(i)));
  }
  return max;
}

const BASE = { seed: 5, height: 1.7, build: 1, accessories: 'none' as const, face: {}, hair: { style: 'cap' as const } };

describe('body types', () => {
  it('feminine and masculine silhouettes differ where they should', () => {
    const fem = createHumanoid({ ...BASE, bodyType: 'feminine', outfit: { top: 'shirt', bottom: 'pants', sleeves: 'short', collar: false, belt: false } });
    const masc = createHumanoid({ ...BASE, bodyType: 'masculine', outfit: { top: 'shirt', bottom: 'pants', sleeves: 'short', collar: false, belt: false } });
    // Box vertices live at corners: chest-box bottom corners fall in
    // 1.05–1.12 (below the arms) and hips/leg-top corners in 0.84–0.99.
    expect(widthAt(masc, 1.05, 1.12)).toBeGreaterThan(widthAt(fem, 1.05, 1.12) * 1.05);
    expect(widthAt(fem, 0.84, 0.99)).toBeGreaterThan(widthAt(masc, 0.84, 0.99) * 1.02);
    // Bust box exists only on the feminine build.
    expect(vertexCount(fem)).toBe(vertexCount(masc) + 24);
  });

  it('explicit BodyTypeParams are honored exactly', () => {
    const rig = createHumanoid({
      ...BASE,
      bodyType: { shoulders: 1.3, waist: 0.7, hips: 1.2, chest: 0 },
      outfit: { top: 'shirt', bottom: 'pants', sleeves: 'short', collar: false, belt: false },
    });
    expect(rig.description.bodyType.shoulders).toBe(1.3);
    // Shoulder bones actually move outward with the multiplier.
    expect(rig.bones.LeftShoulder.position.x).toBeCloseTo(0.075 * 1.7 * 1.3, 5);
  });
});

describe('garments', () => {
  const outfitted = (outfit: Parameters<typeof createHumanoid>[0] extends infer _ ? object : never): Rig =>
    createHumanoid({ ...BASE, bodyType: 'neutral', outfit: outfit as never });

  const plain = { top: 'shirt', bottom: 'pants', sleeves: 'short', collar: false, belt: false };

  it('dress adds a two-tier skirt and bares the lower legs', () => {
    const shirt = outfitted(plain);
    const dress = outfitted({ ...plain, top: 'dress' });
    expect(vertexCount(dress)).toBe(vertexCount(shirt) + 48);
    // Lower legs become skin-colored under a dress.
    const skin = dress.description.colors.skin;
    expect(verticesNear(dress, skin)).toBeGreaterThan(verticesNear(shirt, skin));
  });

  it('shorts bare the calves; skirt bares the whole leg', () => {
    const pants = outfitted(plain);
    const shorts = outfitted({ ...plain, bottom: 'shorts' });
    const skirt = outfitted({ ...plain, bottom: 'skirt' });
    const skin = pants.description.colors.skin;
    expect(verticesNear(shorts, skin)).toBeGreaterThan(verticesNear(pants, skin));
    expect(verticesNear(skirt, skin)).toBeGreaterThan(verticesNear(shorts, skin));
    expect(vertexCount(skirt)).toBe(vertexCount(pants) + 24); // the skirt box
  });

  it('long sleeves clothe the forearms in the top color', () => {
    const short = outfitted(plain);
    const long = outfitted({ ...plain, sleeves: 'long' });
    const top = long.description.colors.top;
    expect(verticesNear(long, top)).toBeGreaterThan(verticesNear(short, top) + 30);
  });

  it('collar and belt add their trim boxes', () => {
    const bare = outfitted(plain);
    const trimmed = outfitted({ ...plain, collar: true, belt: true });
    expect(vertexCount(trimmed)).toBe(vertexCount(bare) + 24 * 3); // collar + belt + buckle
  });

  it('jacket and apron layer front panels', () => {
    const shirt = outfitted(plain);
    expect(vertexCount(outfitted({ ...plain, top: 'jacket' }))).toBe(vertexCount(shirt) + 24 * 2); // strip + forced collar
    expect(vertexCount(outfitted({ ...plain, top: 'apron' }))).toBe(vertexCount(shirt) + 24 * 2);
  });

  it('wardrobe is seeded-deterministic and independent of face overrides', () => {
    const a = createHumanoid({ seed: 11 });
    const b = createHumanoid({ seed: 11, face: { facialHair: 'full', mouth: { smile: 1 } } });
    // Different face, identical wardrobe (separate seeded stream).
    expect(a.description.outfit).toEqual(b.description.outfit);
    expect(a.description.bodyType).toEqual(b.description.bodyType);
  });
});

describe('describeHumanoid (the creator API)', () => {
  it('returns a fully-resolved, JSON-serializable spec', () => {
    const spec = describeHumanoid({ seed: 7 });
    expect(spec.height).toBeGreaterThan(1.5);
    expect(spec.outfit.top).toBeTruthy();
    expect(spec.face.mouth.smile).toBeTypeOf('number');
    expect(spec.hair.style).toBeTruthy();
    expect(spec.bodyType.shoulders).toBeGreaterThan(0.5);
    const clone = JSON.parse(JSON.stringify({ ...spec, palette: undefined }));
    expect(clone.colors.skin).toBe(spec.colors.skin);
  });

  it('is idempotent: describing a description changes nothing', () => {
    const spec = describeHumanoid({ seed: 7 });
    const again = describeHumanoid(spec);
    expect(again).toEqual(spec);
  });

  it('round-trips byte-identically: create(describe(o)) === create(o)', () => {
    const direct = createHumanoid({ seed: 7 });
    const via = createHumanoid(describeHumanoid({ seed: 7 }));
    const a = direct.mesh.geometry.getAttribute('position');
    const b = via.mesh.geometry.getAttribute('position');
    expect(b.count).toBe(a.count);
    for (let i = 0; i < a.count; i += 13) {
      expect(b.getX(i)).toBe(a.getX(i));
      expect(b.getY(i)).toBe(a.getY(i));
    }
    const ca = direct.mesh.geometry.getAttribute('color');
    const cb = via.mesh.geometry.getAttribute('color');
    for (let i = 0; i < ca.count; i += 13) expect(cb.getX(i)).toBe(ca.getX(i));
  });

  it('tweaking a described spec changes exactly what was tweaked', () => {
    const spec = describeHumanoid({ seed: 7 });
    spec.outfit.top = 'dress';
    spec.hair.style = 'long';
    spec.face.mouth.smile = 1;
    const rig = createHumanoid(spec);
    expect(rig.description.outfit.top).toBe('dress');
    expect(rig.description.hair.style).toBe('long');
    expect(rig.description.face.mouth.smile).toBe(1);
    // Untouched decisions survive the round trip.
    expect(rig.description.colors.skin).toBe(spec.colors.skin);
    expect(rig.description.face.nose).toEqual(spec.face.nose);
  });

  it('rigs carry their own description', () => {
    const rig = createHumanoid({ seed: 9 });
    expect(rig.description.seed).toBe(9);
    expect(createHumanoid(rig.description).description).toEqual(rig.description);
  });
});
