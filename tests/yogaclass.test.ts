import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  createHumanoid,
  YogaClass,
  BONE_NAMES,
  type AsanaName,
  type HumanoidRig,
} from '../src';

const v = new Vector3();

const makeClass = (students = 5, seed = 7, bpm = 30) => {
  const rigs = Array.from({ length: students + 1 }, (_, i) => createHumanoid({ seed: 100 + i }));
  const cls = new YogaClass(rigs, { seed, breathsPerMinute: bpm });
  cls.place(0, 0);
  return { rigs, cls };
};

const run = (cls: YogaClass, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) cls.update(1 / 60);
};

const minBoneY = (rig: HumanoidRig): number => {
  rig.object.updateWorldMatrix(true, true);
  let min = Infinity;
  for (const bone of BONE_NAMES) {
    min = Math.min(min, rig.bones[bone].getWorldPosition(v).y);
  }
  return min;
};

describe('the yoga class', () => {
  it('lays out the room: instructor at the front, facing the rows', () => {
    const { rigs } = makeClass(6);
    const inst = rigs[0].object;
    expect(inst.position.z).toBeCloseTo(0, 5);
    expect(Math.abs(inst.rotation.y)).toBeCloseTo(Math.PI, 5);
    for (const rig of rigs.slice(1)) {
      expect(rig.object.position.z).toBeLessThan(-1.5); // behind the front
      expect(rig.object.rotation.y).toBeCloseTo(0, 5); // facing the front
      expect(rig.object.position.y).toBe(0);
    }
    // Two rows of a six-student class (perRow 4): rows at different depths.
    const zs = [...new Set(rigs.slice(1).map((r) => Math.round(r.object.position.z * 100)))];
    expect(zs.length).toBe(2);
  });

  it('needs at least an instructor and a student', () => {
    expect(() => new YogaClass([createHumanoid({ seed: 1 })])).toThrow();
  });

  it('the breath is surrendered: students ride the front clock, lag late', () => {
    const { cls } = makeClass(4);
    cls.start();
    run(cls, 8);
    for (const student of cls.students) {
      const rel = (cls.instructor.breath - student.breath + 1) % 1;
      // A watching lag of 0.3–0.8 s at 30 bpm is 0.15–0.4 of a breath.
      expect(rel).toBeGreaterThan(0.1);
      expect(rel).toBeLessThan(0.45);
    }
    // And differently late per student — a room, not a metronome.
    const rels = cls.students.map((s) => (cls.instructor.breath - s.breath + 1) % 1);
    expect(Math.max(...rels) - Math.min(...rels)).toBeGreaterThan(0.02);
  });

  it('poses arrive at each mat through that lag, not instantly', () => {
    const { cls } = makeClass(4);
    cls.start();
    run(cls, 3);
    // Catch the front changing pose, then watch the room catch up. (The
    // front may strike AGAIN before the laggards arrive — 30 bpm is quick —
    // so the contract is "left the old pose through the lag", not "equals
    // whatever the front is doing this instant".)
    const before = cls.pose;
    let changedAt = -1;
    let target: typeof before = null;
    for (let i = 0; i < 12 * 60; i++) {
      cls.update(1 / 60);
      if (changedAt < 0 && cls.pose !== before) {
        changedAt = i;
        target = cls.pose;
        // The instant the front moves, nobody on the mats has moved yet.
        for (const s of cls.students) expect(s.pose).toBe(before);
      }
      if (changedAt >= 0 && i > changedAt + 60) break; // 1 s > max lag 0.8 s
    }
    expect(changedAt).toBeGreaterThanOrEqual(0);
    for (const s of cls.students) {
      expect(s.pose).not.toBe(before);
      // Nobody skipped the pose either: they went where the front went.
      if (s.pose !== target) expect(s.pose).not.toBe(null);
    }
  });

  it('depth: a stiff student folds less, and no two practices match', () => {
    const { rigs, cls } = makeClass(5);
    cls.start([{ asana: 'child', breath: 'exhale' }], { loop: false });
    run(cls, 9);
    // How far each spine actually committed, measured from rest.
    const commit = (rig: HumanoidRig) =>
      rig.bones.Spine.quaternion.w < 1
        ? 2 * Math.acos(Math.min(1, Math.abs(rig.bones.Spine.quaternion.w)))
        : 0;
    const front = commit(rigs[0]);
    const room = rigs.slice(1).map(commit);
    // Students under-commit relative to the front (depth ≤ 1)…
    for (const c of room) expect(c).toBeLessThanOrEqual(front + 1e-6);
    expect(Math.min(...room)).toBeLessThan(front * 0.85); // someone is stiff
    // …and no two students match: a room, not an array of clones.
    const sorted = [...room].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThan(1e-4);
    }
  });

  it('stops clean: the whole room comes home', () => {
    const { rigs, cls } = makeClass(4);
    const homes = rigs.map((rig) => rig.bones.Chest.quaternion.clone());
    cls.start();
    run(cls, 6);
    cls.stop();
    run(cls, 5);
    expect(cls.holding).toBe(false);
    rigs.forEach((rig, i) => {
      expect(rig.bones.Chest.quaternion.angleTo(homes[i]), `rig ${i}`).toBeLessThan(0.02);
    });
  });

  it('shallow practices never break the floor: depth is expression only', () => {
    const { rigs, cls } = makeClass(5);
    cls.start([{ asana: 'downwardDog', breath: 'exhale' }], { loop: false });
    run(cls, 9);
    rigs.slice(1).forEach((rig, i) => {
      expect(minBoneY(rig), `student ${i}`).toBeGreaterThan(-0.06);
    });
  });

  it('runs the full salutation as a room: everyone visits the poses', () => {
    const { cls } = makeClass(3, 5, 40);
    cls.start();
    const seen = new Set<AsanaName>();
    const offs = cls.students.map((s) => s.onPose((p) => seen.add(p)));
    run(cls, 20);
    expect(seen.size).toBeGreaterThanOrEqual(8);
    for (const off of offs) off();
  });

  it('is deterministic: the same seeds practice the same practice', () => {
    const practice = () => {
      const { rigs, cls } = makeClass(4, 9);
      cls.start();
      run(cls, 9.4);
      return rigs;
    };
    const a = practice();
    const b = practice();
    a.forEach((rig, i) => {
      for (const bone of BONE_NAMES) {
        expect(rig.bones[bone].quaternion.angleTo(b[i].bones[bone].quaternion)).toBeLessThan(1e-6);
      }
    });
  });
});
