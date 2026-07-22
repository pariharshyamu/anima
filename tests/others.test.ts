import { describe, expect, it } from 'vitest';
import {
  AnimationClip,
  AnimationMixer,
  Euler,
  Group,
  Mesh,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import {
  attach,
  createHumanoid,
  getSocket,
  Locomotion,
  retargetClip,
  type BoneName,
} from '../src/index';

/**
 * A synthetic "Mixamo-like" source: centimeter units under a 0.01-scaled
 * root, prefixed names, an extra Spine1 bone ANIMA doesn't have, and
 * DELIBERATELY non-identity rest rotations — everything a real download
 * throws at a retargeter.
 */
function makeSource() {
  const root = new Group();
  root.scale.setScalar(0.01);
  const make = (name: string, parent: Object3D, position: [number, number, number], rest: Euler): Object3D => {
    const node = new Object3D();
    node.name = name;
    node.position.set(...position);
    node.quaternion.setFromEuler(rest);
    parent.add(node);
    return node;
  };
  const hips = make('mixamorigHips', root, [0, 90, 0], new Euler(0.1, 0.4, -0.05));
  const spine = make('mixamorigSpine', hips, [0, 10, 1], new Euler(-0.2, 0.1, 0.3));
  const spine1 = make('mixamorigSpine1', spine, [0, 10, 0], new Euler(0.05, -0.3, 0.1));
  const spine2 = make('mixamorigSpine2', spine1, [0, 10, -1], new Euler(0.3, 0.2, -0.2));
  const neck = make('mixamorigNeck', spine2, [0, 9, 0], new Euler(-0.1, 0.15, 0.05));
  make('mixamorigHead', neck, [0, 7, 1], new Euler(0.2, -0.1, 0.1));
  const lsh = make('mixamorigLeftShoulder', spine2, [6, 7, 0], new Euler(0.4, 0.2, 1.2));
  const larm = make('mixamorigLeftArm', lsh, [11, 0, 0], new Euler(-0.3, 0.5, 0.2));
  make('mixamorigLeftForeArm', larm, [26, 0, 0], new Euler(0.1, -0.2, 0.4));
  root.updateWorldMatrix(true, true);
  return { root, hips, larm };
}

function worldQuaternion(node: Object3D): Quaternion {
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  node.updateWorldMatrix(true, false);
  node.matrixWorld.decompose(p, q, s);
  return q;
}

describe('retargetClip', () => {
  it('reproduces the source world-rotation deltas on the ANIMA rig', () => {
    const { root, hips, larm } = makeSource();
    // Rest world rotations, captured before animating.
    const restInv = {
      LeftArm: worldQuaternion(larm).invert(),
      Hips: worldQuaternion(hips).invert(),
    };

    // A clip that swings the source LeftArm and tilts the hips.
    const armRest = larm.quaternion.clone();
    const armMoved = armRest.clone().multiply(new Quaternion().setFromEuler(new Euler(0.9, 0.3, -0.2)));
    const hipsRest = hips.quaternion.clone();
    const hipsMoved = hipsRest.clone().multiply(new Quaternion().setFromEuler(new Euler(0, 0.5, 0.1)));
    const clip = new AnimationClip('swing', 1, [
      new QuaternionKeyframeTrack('mixamorigLeftArm.quaternion', [0, 1], [
        armRest.x, armRest.y, armRest.z, armRest.w,
        armMoved.x, armMoved.y, armMoved.z, armMoved.w,
      ]),
      new QuaternionKeyframeTrack('mixamorigHips.quaternion', [0, 1], [
        hipsRest.x, hipsRest.y, hipsRest.z, hipsRest.w,
        hipsMoved.x, hipsMoved.y, hipsMoved.z, hipsMoved.w,
      ]),
    ]);

    const rig = createHumanoid({ seed: 7, height: 1.7 });
    const retargeted = retargetClip(rig, root, clip, { fps: 30 });

    // Play both at t = 0.5 (an exact sample frame) and compare world deltas.
    const sourceMixer = new AnimationMixer(root);
    sourceMixer.clipAction(clip).play();
    sourceMixer.setTime(0.5);
    root.updateWorldMatrix(true, true);
    const expectArm = worldQuaternion(larm).multiply(restInv.LeftArm);

    // Guard against a vacuous pass: the source really did move.
    expect(expectArm.angleTo(new Quaternion())).toBeGreaterThan(0.3);

    const targetMixer = new AnimationMixer(rig.mesh);
    targetMixer.clipAction(retargeted).play();
    targetMixer.setTime(0.5);
    const gotArm = worldQuaternion(rig.bones.LeftArm);

    expect(Math.abs(gotArm.angleTo(expectArm))).toBeLessThan(1e-3);
  });

  it('lands at rest for a rest-pose clip, with hips height preserved', () => {
    const { root, hips } = makeSource();
    const hipsRest = hips.quaternion;
    const clip = new AnimationClip('rest', 0.5, [
      new QuaternionKeyframeTrack('mixamorigHips.quaternion', [0, 0.5], [
        hipsRest.x, hipsRest.y, hipsRest.z, hipsRest.w,
        hipsRest.x, hipsRest.y, hipsRest.z, hipsRest.w,
      ]),
      new VectorKeyframeTrack('mixamorigHips.position', [0, 0.5], [0, 90, 0, 0, 90, 0]),
    ]);
    const rig = createHumanoid({ seed: 7, height: 1.7 });
    const retargeted = retargetClip(rig, root, clip);

    const mixer = new AnimationMixer(rig.mesh);
    mixer.clipAction(retargeted).play();
    mixer.setTime(0.25);
    for (const name of ['Hips', 'Spine', 'Chest', 'LeftArm'] as BoneName[]) {
      const q = rig.bones[name].quaternion;
      expect(Math.abs(1 - Math.abs(q.w))).toBeLessThan(1e-3); // ≈ identity
    }
    // Source hips at 90cm under a 0.01 root → 0.9m world → rescaled to rig.
    expect(rig.bones.Hips.position.y).toBeCloseTo(createHumanoid({ seed: 7, height: 1.7 }).bones.Hips.position.y, 2);
  });

  it('throws a clear error when no hips can be mapped', () => {
    const rig = createHumanoid({ seed: 1 });
    const empty = new Group();
    expect(() => retargetClip(rig, empty, new AnimationClip('x', 1, []))).toThrow(/Hips/);
  });
});

describe('sockets', () => {
  it('creates cached, height-scaled sockets on the right bones', () => {
    const short = createHumanoid({ seed: 3, height: 1.5, accessories: 'none' });
    const tall = createHumanoid({ seed: 3, height: 2.0, accessories: 'none' });
    const a = getSocket(short, 'head');
    expect(getSocket(short, 'head')).toBe(a); // cached
    expect(a.parent).toBe(short.bones.Head);
    expect(getSocket(tall, 'head').position.y / a.position.y).toBeCloseTo(2.0 / 1.5, 5);
  });

  it('attached props ride the hand through a walk', () => {
    const rig = createHumanoid({ seed: 7, height: 1.7 });
    const torch = new Mesh();
    attach(rig, 'handRight', torch);
    const loco = new Locomotion(rig, { smoothing: 1e6 });
    const positions: Vector3[] = [];
    for (let i = 0; i < 40; i++) {
      loco.update(1 / 30, loco.clips.walkSpeed);
      rig.object.updateMatrixWorld(true);
      positions.push(torch.getWorldPosition(new Vector3()));
      const hand = rig.bones.RightHand.getWorldPosition(new Vector3());
      expect(positions[positions.length - 1].distanceTo(hand)).toBeLessThan(0.12);
    }
    // The prop actually moves as the arm swings.
    expect(positions[0].distanceTo(positions[20])).toBeGreaterThan(0.05);
  });
});

describe('accessories', () => {
  const vertexCount = (rig: ReturnType<typeof createHumanoid>): number =>
    rig.mesh.geometry.getAttribute('position').count;

  it('explicit accessories add geometry; none is the lean baseline', () => {
    const none = createHumanoid({ seed: 5, accessories: 'none' });
    const geared = createHumanoid({
      seed: 5,
      accessories: ['hat', 'backpack', 'pouch', 'shoulderPads'],
    });
    expect(vertexCount(geared)).toBeGreaterThan(vertexCount(none));
  });

  it("'auto' is deterministic per seed and varies across seeds", () => {
    const counts = new Set<number>();
    for (let seed = 30; seed < 40; seed++) {
      const a = createHumanoid({ seed });
      const b = createHumanoid({ seed });
      expect(vertexCount(a)).toBe(vertexCount(b));
      counts.add(vertexCount(a));
    }
    expect(counts.size).toBeGreaterThan(2); // gear actually varies
  });

  it('accessories do not change base body proportions for a seed', () => {
    const none = createHumanoid({ seed: 11, accessories: 'none' });
    const geared = createHumanoid({ seed: 11, accessories: ['backpack'] });
    expect(geared.height).toBe(none.height);
    expect(geared.legLength).toBe(none.legLength);
  });
});
