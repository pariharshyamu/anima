import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  createHumanoid,
  Asana,
  SURYA_NAMASKAR,
  BONE_NAMES,
  type AsanaName,
  type HumanoidRig,
} from '../src';

const v = new Vector3();

const minBoneY = (rig: HumanoidRig): number => {
  rig.object.updateWorldMatrix(true, true);
  let min = Infinity;
  for (const bone of BONE_NAMES) {
    min = Math.min(min, rig.bones[bone].getWorldPosition(v).y);
  }
  return min;
};

const run = (asana: Asana, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) asana.update(1 / 60);
};

describe('Surya Namaskar — the shipped data', () => {
  it('is the classical twelve, breathed correctly', () => {
    expect(SURYA_NAMASKAR).toHaveLength(12);
    expect(SURYA_NAMASKAR[0]).toEqual({ asana: 'prayer', breath: 'exhale' });
    expect(SURYA_NAMASKAR[11]).toEqual({ asana: 'prayer', breath: 'exhale' });
    // The non-negotiables of the breath map: rise on the inhale, fold on
    // the exhale, cobra IS an inhale, and plank is the held breath.
    for (const step of SURYA_NAMASKAR) {
      if (step.asana === 'forwardFold' || step.asana === 'downwardDog') {
        expect(step.breath, step.asana).toBe('exhale');
      }
      if (step.asana === 'cobra' || step.asana === 'upwardSalute' || step.asana === 'lowLunge') {
        expect(step.breath, step.asana).toBe('inhale');
      }
      if (step.asana === 'plank') expect(step.breath).toBe('retain');
    }
    // Out and back: the road home mirrors the road out.
    const names = SURYA_NAMASKAR.map((s) => s.asana);
    expect(names.slice(8)).toEqual(['lowLunge', 'forwardFold', 'upwardSalute', 'prayer']);
  });
});

describe('the flow', () => {
  it('walks the sequence on the breath, one salutation ≈ 5.5 breaths', () => {
    const rig = createHumanoid({ seed: 4 });
    const asana = new Asana(rig, { seed: 3, breathsPerMinute: 30 }); // 2 s/breath
    const visited: AsanaName[] = [];
    asana.onPose((pose) => visited.push(pose));
    asana.flow(SURYA_NAMASKAR, { loop: true });
    // 11 turns + 1 kumbhaka per round at 2 s/breath = 11 s per round.
    run(asana, 14);
    expect(visited.length).toBeGreaterThanOrEqual(14);
    expect(visited.slice(0, 12)).toEqual(SURYA_NAMASKAR.map((s) => s.asana));
    // Looping: the wrap re-enters prayer as step 0, and round two rises.
    expect(visited[12]).toBe('prayer');
    expect(visited[13]).toBe('upwardSalute');
  });

  it('kumbhaka: plank strikes MID-breath, not at a turn', () => {
    const rig = createHumanoid({ seed: 4 });
    const asana = new Asana(rig, { seed: 3, breathsPerMinute: 30 });
    const strikes: Array<{ pose: AsanaName; phase: number }> = [];
    asana.onPose((pose) => strikes.push({ pose, phase: asana.breath }));
    asana.flow(SURYA_NAMASKAR);
    run(asana, 12);
    const plank = strikes.find((s) => s.pose === 'plank')!;
    expect(plank).toBeDefined();
    // At a mid-window (0.25 / 0.75), a hair past it at 60 fps.
    const offMid = Math.min(Math.abs(plank.phase - 0.25), Math.abs(plank.phase - 0.75));
    expect(offMid).toBeLessThan(0.03);
    // Every OTHER strike lands at a turn (0 or 0.5) — except the very
    // first, which flow() fires immediately, mid-whatever-breath.
    for (const s of strikes.slice(1)) {
      if (s.pose === 'plank') continue;
      const offTurn = Math.min(s.phase, Math.abs(s.phase - 0.5), 1 - s.phase);
      expect(offTurn, s.pose).toBeLessThan(0.03);
    }
  });

  it('holdBreaths: a step owns its extra breaths before the flow moves on', () => {
    const rig = createHumanoid({ seed: 4 });
    const asana = new Asana(rig, { seed: 3, breathsPerMinute: 30 });
    const times: Array<{ pose: AsanaName; t: number }> = [];
    let t = 0;
    asana.onPose((pose) => times.push({ pose, t }));
    asana.flow([
      { asana: 'mountain', breath: 'exhale' },
      { asana: 'tree', breath: 'inhale', holdBreaths: 2 },
      { asana: 'mountain', breath: 'exhale' },
    ]);
    for (let i = 0; i < 14 * 60; i++) {
      asana.update(1 / 60);
      t += 1 / 60;
    }
    const tree = times.find((s) => s.pose === 'tree')!;
    const after = times.find((s) => s.pose === 'mountain' && s.t > tree.t)!;
    // Tree owns its half-breath plus two full breaths: 0.5 + 2 = 2.5
    // breaths = 5 s at 2 s per breath.
    expect(after.t - tree.t).toBeGreaterThan(4.4);
    expect(after.t - tree.t).toBeLessThan(5.6);
  });

  it('a finished flow stays in its last pose, still holding', () => {
    const rig = createHumanoid({ seed: 4 });
    const asana = new Asana(rig, { seed: 3, breathsPerMinute: 30 });
    asana.flow([
      { asana: 'mountain', breath: 'exhale' },
      { asana: 'lotus', breath: 'exhale' },
    ]);
    run(asana, 10);
    expect(asana.pose).toBe('lotus');
    expect(asana.flowStep).toBe(-1);
    expect(asana.holding).toBe(true);
    expect(asana.settled).toBe(true);
  });

  it('clearFlow stops the pointer; the pose keeps being held', () => {
    const rig = createHumanoid({ seed: 4 });
    const asana = new Asana(rig, { seed: 3, breathsPerMinute: 30 });
    asana.flow(SURYA_NAMASKAR, { loop: true });
    run(asana, 3);
    const pose = asana.pose;
    asana.clearFlow();
    run(asana, 5);
    expect(asana.pose).toBe(pose);
    expect(asana.flowStep).toBe(-1);
    expect(asana.holding).toBe(true);
  });

  it('the WHOLE salutation is floor-honest, transitions included', () => {
    const rig = createHumanoid({ seed: 4, height: 1.7 });
    const asana = new Asana(rig, { seed: 3, breathsPerMinute: 20 });
    asana.flow(SURYA_NAMASKAR, { loop: true });
    let min = Infinity;
    for (let i = 0; i < 25 * 60; i++) {
      asana.update(1 / 60);
      min = Math.min(min, minBoneY(rig));
    }
    expect(min).toBeGreaterThan(-0.2);
  });

  it('is deterministic through a full round', () => {
    const round = () => {
      const rig = createHumanoid({ seed: 4 });
      const asana = new Asana(rig, { seed: 11, breathsPerMinute: 30 });
      asana.flow(SURYA_NAMASKAR, { loop: true });
      run(asana, 13.7);
      return rig;
    };
    const a = round();
    const b = round();
    for (const bone of BONE_NAMES) {
      expect(a.bones[bone].quaternion.angleTo(b.bones[bone].quaternion)).toBeLessThan(1e-6);
    }
  });
});
