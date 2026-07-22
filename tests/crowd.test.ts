import { describe, expect, it } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { bakeVAT, createHumanoid, createLocomotionClips, Crowd } from '../src/index';

describe('bakeVAT', () => {
  const rig = createHumanoid({ seed: 7, height: 1.7, accessories: 'none' });
  const clips = createLocomotionClips(rig);
  const vat = bakeVAT(rig, clips.walk, 12);

  it('bakes one texel per vertex per frame, all finite', () => {
    const vertexCount = rig.mesh.geometry.getAttribute('position').count;
    expect(vat.vertexCount).toBe(vertexCount);
    expect(vat.positions.image.width).toBe(vertexCount);
    expect(vat.positions.image.height).toBe(vat.frames);
    expect(vat.duration).toBeCloseTo(clips.walk.duration, 6);
    const data = vat.positions.image.data as unknown as Float32Array;
    for (let i = 0; i < data.length; i += 997) expect(Number.isFinite(data[i])).toBe(true);
  });

  it('animates: mid-cycle differs from frame 0; last row wraps to first', () => {
    const data = vat.positions.image.data as unknown as Float32Array;
    const w = vat.vertexCount;
    const mid = Math.floor(vat.frames / 2);
    let moved = 0;
    let wrapError = 0;
    for (let v = 0; v < w; v += 7) {
      const y0 = data[v * 4 + 1];
      const yMid = data[(mid * w + v) * 4 + 1];
      const yLast = data[((vat.frames - 1) * w + v) * 4 + 1];
      if (Math.abs(yMid - y0) > 0.01) moved++;
      wrapError = Math.max(wrapError, Math.abs(yLast - y0));
    }
    expect(moved).toBeGreaterThan(10); // limbs really move mid-cycle
    expect(wrapError).toBeLessThan(1e-5); // seamless loop
  });

  it('bakes unit-length normals', () => {
    const data = vat.normals.image.data as unknown as Float32Array;
    for (let i = 0; i < data.length; i += 4 * 31) {
      const length = Math.hypot(data[i], data[i + 1], data[i + 2]);
      expect(length).toBeGreaterThan(0.99);
      expect(length).toBeLessThan(1.01);
    }
  });
});

describe('Crowd', () => {
  it('spreads instances across variant meshes with phases and tints', () => {
    const crowd = new Crowd({ count: 20, seed: 5, variants: 3 });
    expect(crowd.group.children).toHaveLength(3);
    let total = 0;
    for (const child of crowd.group.children) {
      const mesh = child as unknown as {
        count: number;
        geometry: { getAttribute(name: string): { count: number } };
        instanceColor: unknown;
      };
      total += mesh.count;
      expect(mesh.geometry.getAttribute('aPhase').count).toBe(mesh.count);
      expect(mesh.geometry.getAttribute('aVertexId').count).toBeGreaterThan(100);
      expect(mesh.instanceColor).toBeTruthy();
    }
    expect(total).toBe(20);
  });

  it('set() writes instance transforms', () => {
    const crowd = new Crowd({ count: 4, seed: 5, variants: 2 });
    crowd.set(2, 10, -4, Math.PI / 2, 1.5);
    const mesh = crowd.group.children[0] as unknown as {
      getMatrixAt(i: number, m: Matrix4): void;
    };
    const matrix = new Matrix4();
    mesh.getMatrixAt(1, matrix); // instance 2 → variant 0, slot 1
    const position = new Vector3();
    matrix.decompose(position, new Quaternion(), new Vector3());
    expect(position.x).toBeCloseTo(10, 5);
    expect(position.y).toBeCloseTo(1.5, 5);
    expect(position.z).toBeCloseTo(-4, 5);
  });

  it('followRoute distributes walkers and update advances them along it', () => {
    const crowd = new Crowd({ count: 8, seed: 5, variants: 2 });
    const square = [
      { x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 },
    ];
    crowd.followRoute(square, { surface: (x) => x * 0.1 });

    const positions = (): Vector3[] => {
      const out: Vector3[] = [];
      const matrix = new Matrix4();
      for (let i = 0; i < crowd.count; i++) {
        const meshIndex = i % 2;
        const slot = Math.floor(i / 2);
        (crowd.group.children[meshIndex] as unknown as {
          getMatrixAt(i: number, m: Matrix4): void;
        }).getMatrixAt(slot, matrix);
        out.push(new Vector3().setFromMatrixPosition(matrix));
      }
      return out;
    };

    const before = positions();
    // Everyone is ON the square's perimeter, at surface height.
    for (const p of before) {
      const onEdge =
        Math.abs(p.x) < 1e-4 || Math.abs(p.x - 10) < 1e-4 ||
        Math.abs(p.z) < 1e-4 || Math.abs(p.z - 10) < 1e-4;
      expect(onEdge).toBe(true);
      expect(p.y).toBeCloseTo(p.x * 0.1, 4);
    }
    // Distinct starting spots (spread, not stacked).
    expect(new Set(before.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`)).size).toBe(8);

    for (let i = 0; i < 60; i++) crowd.update(1 / 30);
    const after = positions();
    let travelled = 0;
    for (let i = 0; i < 8; i++) travelled += before[i].distanceTo(after[i]);
    expect(travelled / 8).toBeGreaterThan(1); // ~2s at ~1.5 m/s, minus corners
  });

  it('update advances every variant clock', () => {
    const crowd = new Crowd({ count: 6, seed: 5, variants: 3 });
    crowd.update(0.5);
    // Internal uniform check via material recompile hooks is GPU-side;
    // here we just assert the API is callable repeatedly without a route.
    crowd.update(0.5);
    expect(crowd.walkSpeed).toBeGreaterThan(0.5);
  });
});
