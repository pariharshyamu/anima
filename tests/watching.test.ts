import { describe, expect, it } from 'vitest';
import { Mesh, Object3D, PlaneGeometry, Vector3 } from 'three';
import { createHumanoid, LookAt, Watching, type Viewable } from '../src';

/** A stand-in for SCENA's ScreenPanel — the handshake is three fields. */
function panel(at: Vector3, width = 1.2, height = 0.68): Viewable {
  const surface = new Mesh(new PlaneGeometry(width, height));
  surface.position.copy(at);
  const root = new Object3D();
  root.add(surface);
  root.updateWorldMatrix(true, true);
  return { surface, width, height };
}

function setup(seed = 1) {
  const rig = createHumanoid({ seed: 4 });
  rig.object.updateWorldMatrix(true, true);
  const look = new LookAt(rig);
  const view = panel(new Vector3(0, 1.4, 2.5));
  const watch = new Watching(rig, look, { seed });
  return { rig, look, view, watch };
}

/** Sample the gaze point over N seconds. */
function trace(watch: Watching, look: LookAt, seconds: number, dt = 1 / 60): Vector3[] {
  const out: Vector3[] = [];
  for (let i = 0; i < seconds / dt; i++) {
    watch.update(dt);
    out.push((look.target as Vector3).clone());
  }
  return out;
}

describe('Watching', () => {
  it('does nothing until given something to watch', () => {
    const { look, watch } = setup();
    expect(watch.watching).toBe(false);
    watch.update(1);
    expect(look.target).toBeNull();
  });

  it('puts the gaze on the panel', () => {
    const { look, view, watch } = setup();
    watch.watch(view);
    const at = look.target as Vector3;
    expect(at).toBeInstanceOf(Vector3);
    // Inside the panel's rectangle, in front of the character.
    expect(Math.abs(at.x)).toBeLessThan(view.width / 2);
    expect(Math.abs(at.y - 1.4)).toBeLessThan(view.height / 2);
    expect(at.z).toBeCloseTo(2.5, 5);
  });

  it('does not stare: the gaze moves around the picture', () => {
    const { look, view, watch } = setup();
    watch.watch(view);
    const points = trace(watch, look, 20).filter((p) => Math.abs(p.z - 2.5) < 1e-6);
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    // It visits a spread of places, not one.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.05);
  });

  it('jumps between fixations rather than sliding', () => {
    // Saccades: the gaze is still for a while, then moves in one frame.
    const { look, view, watch } = setup();
    watch.watch(view);
    const points = trace(watch, look, 25);
    const steps = points.slice(1).map((p, i) => p.distanceTo(points[i]));
    const moving = steps.filter((s) => s > 1e-6).length;
    expect(moving).toBeGreaterThan(4); // it does move
    expect(moving).toBeLessThan(points.length * 0.2); // but mostly holds still
  });

  it('stays inside the panel while watching it', () => {
    const { look, view, watch } = setup();
    watch.watch(view);
    for (const p of trace(watch, look, 30)) {
      if (Math.abs(p.z - 2.5) > 1e-6) continue; // a look-away, checked below
      expect(Math.abs(p.x)).toBeLessThanOrEqual(view.width / 2);
      expect(Math.abs(p.y - 1.4)).toBeLessThanOrEqual(view.height / 2);
    }
  });

  it('glances away sometimes — and less often when engaged', () => {
    const count = (engagement: number): number => {
      const rig = createHumanoid({ seed: 4 });
      rig.object.updateWorldMatrix(true, true);
      const look = new LookAt(rig);
      const watch = new Watching(rig, look, { seed: 9, engagement });
      watch.watch(panel(new Vector3(0, 1.4, 2.5)));
      let away = 0;
      let was = false;
      for (let i = 0; i < 60 * 90; i++) {
        watch.update(1 / 60);
        if (watch.away && !was) away++;
        was = watch.away;
      }
      return away;
    };
    const distracted = count(0.1);
    const rapt = count(0.97);
    expect(distracted).toBeGreaterThan(2);
    expect(rapt).toBeLessThan(distracted);
  });

  it('comes back to about where it left off', () => {
    const { look, view, watch } = setup(11);
    watch.watch(view);
    let before: Vector3 | null = null;
    let after: Vector3 | null = null;
    let was = false;
    for (let i = 0; i < 60 * 60; i++) {
      const prev = (look.target as Vector3).clone();
      watch.update(1 / 60);
      const now = watch.away;
      if (now && !was) before = prev;
      if (!now && was && before && !after) after = (look.target as Vector3).clone();
      was = now;
    }
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    // Resumed attention, not a fresh thought: back within a small patch.
    expect(after!.distanceTo(before!)).toBeLessThan(0.25);
  });

  it('follows the screen when the screen moves', () => {
    const { look, watch } = setup();
    const surface = new Mesh(new PlaneGeometry(1.2, 0.68));
    const root = new Object3D();
    root.add(surface);
    const view: Viewable = { surface, width: 1.2, height: 0.68 };
    watch.watch(view);
    watch.update(0.1);
    const first = (look.target as Vector3).clone();

    root.position.set(5, 0, 0);
    root.updateWorldMatrix(true, true);
    watch.update(0.1);
    const second = (look.target as Vector3).clone();
    expect(second.x - first.x).toBeCloseTo(5, 1);
  });

  it('releases the gaze when told to stop', () => {
    const { look, view, watch } = setup();
    watch.watch(view);
    expect(look.target).not.toBeNull();
    watch.watch(null);
    expect(look.target).toBeNull();
    expect(watch.watching).toBe(false);
  });

  it('is deterministic in its seed', () => {
    const sample = (seed: number): string => {
      const rig = createHumanoid({ seed: 4 });
      rig.object.updateWorldMatrix(true, true);
      const look = new LookAt(rig);
      const watch = new Watching(rig, look, { seed });
      watch.watch(panel(new Vector3(0, 1.4, 2.5)));
      return trace(watch, look, 12)
        .map((p) => p.x.toFixed(4))
        .join(',');
    };
    expect(sample(3)).toBe(sample(3));
    expect(sample(3)).not.toBe(sample(4));
  });
});
