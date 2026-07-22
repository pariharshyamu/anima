import {
  AnimationClip,
  AnimationMixer,
  Matrix4,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import { BONE_NAMES, type BoneName, type HumanoidRig } from './humanoid';

/**
 * Source-bone → ANIMA-bone mapping. Keys are source names AFTER prefix
 * stripping. The default covers Mixamo's skeleton (Spine1 is skipped;
 * Spine2 maps to Chest — the world-space solve absorbs the difference).
 */
export const MIXAMO_MAP: Record<string, BoneName> = {
  Hips: 'Hips',
  Spine: 'Spine',
  Spine2: 'Chest',
  Neck: 'Neck',
  Head: 'Head',
  LeftShoulder: 'LeftShoulder',
  LeftArm: 'LeftArm',
  LeftForeArm: 'LeftForeArm',
  LeftHand: 'LeftHand',
  RightShoulder: 'RightShoulder',
  RightArm: 'RightArm',
  RightForeArm: 'RightForeArm',
  RightHand: 'RightHand',
  LeftUpLeg: 'LeftUpLeg',
  LeftLeg: 'LeftLeg',
  LeftFoot: 'LeftFoot',
  RightUpLeg: 'RightUpLeg',
  RightLeg: 'RightLeg',
  RightFoot: 'RightFoot',
};

export interface RetargetOptions {
  /** Source-name → ANIMA-name map (after prefix strip). Default MIXAMO_MAP. */
  boneMap?: Record<string, BoneName>;
  /** Prefixes stripped from source node names. Default Mixamo variants. */
  stripPrefixes?: string[];
  /** Remove ground-plane root motion so the clip plays in place. Default true. */
  inPlace?: boolean;
  /** Output sampling rate. Default 30. */
  fps?: number;
}

/**
 * Retarget a humanoid AnimationClip from any source skeleton (Mixamo,
 * VRM-ish, custom) onto an ANIMA rig.
 *
 * The source must be in its rest/bind pose when passed in (a freshly
 * loaded glTF is). The solve is exact, not name-by-name approximate: the
 * source is played frame by frame, and each mapped ANIMA bone receives
 * the world-space rotation DELTA of its source bone applied on top of the
 * ANIMA rest pose, composed down the actual hierarchy — so differing rest
 * orientations, differing bone counts (Mixamo's Spine1) and unit scales
 * are all absorbed. Hips translation is rescaled by relative hip height.
 *
 * ```ts
 * const gltf = await new GLTFLoader().loadAsync('mixamo-dance.glb');
 * const dance = retargetClip(rig, gltf.scene, gltf.animations[0]);
 * loco.overlay(dance);                    // or play it on its own mixer
 * ```
 */
export function retargetClip(
  rig: HumanoidRig,
  sourceRoot: Object3D,
  clip: AnimationClip,
  options: RetargetOptions = {}
): AnimationClip {
  const boneMap = options.boneMap ?? MIXAMO_MAP;
  const strip = options.stripPrefixes ?? ['mixamorig:', 'mixamorig'];
  const inPlace = options.inPlace ?? true;
  const fps = options.fps ?? 30;

  // --- Locate source bones and capture their REST world rotations.
  const canonical = (name: string): string => {
    for (const prefix of strip) {
      if (name.startsWith(prefix)) return name.slice(prefix.length);
    }
    return name;
  };
  const sources = new Map<BoneName, Object3D>();
  sourceRoot.updateWorldMatrix(true, true);
  sourceRoot.traverse((node) => {
    const target = boneMap[canonical(node.name)];
    if (target && !sources.has(target)) sources.set(target, node);
  });
  const sourceHips = sources.get('Hips');
  if (!sourceHips) {
    throw new Error('anima3d.retargetClip: no source Hips bone found (check boneMap/prefixes)');
  }

  const restWorldInv = new Map<BoneName, Quaternion>();
  const q = new Quaternion();
  const scratchPos = new Vector3();
  const scratchScale = new Vector3();
  for (const [name, node] of sources) {
    node.matrixWorld.decompose(scratchPos, q, scratchScale);
    restWorldInv.set(name, q.clone().invert());
  }
  const hipsRestWorld = sourceHips.getWorldPosition(new Vector3());
  const scale = rig.bones.Hips.position.y / Math.max(1e-6, hipsRestWorld.y);

  // --- Target hierarchy info: parent chain among MAPPED bones.
  const parentOf = new Map<BoneName, BoneName | null>();
  for (const name of BONE_NAMES) {
    if (!sources.has(name)) continue;
    let ancestor = rig.bones[name].parent;
    let parent: BoneName | null = null;
    while (ancestor) {
      if (sources.has(ancestor.name as BoneName)) {
        parent = ancestor.name as BoneName;
        break;
      }
      ancestor = ancestor.parent;
    }
    parentOf.set(name, parent);
  }
  const order = BONE_NAMES.filter((n) => sources.has(n));

  // --- Sample the source clip and solve target locals per frame.
  const mixer = new AnimationMixer(sourceRoot);
  mixer.clipAction(clip).play();

  const frames = Math.max(1, Math.round(clip.duration * fps));
  const times = new Float32Array(frames + 1);
  const values = new Map(order.map((n) => [n, new Float32Array((frames + 1) * 4)]));
  const hipsValues = new Float32Array((frames + 1) * 3);

  const worldTgt = new Map<BoneName, Quaternion>(order.map((n) => [n, new Quaternion()]));
  const parentWorld = new Quaternion();
  const local = new Quaternion();
  const srcWorld = new Quaternion();
  const firstHips = new Vector3();
  const matrix = new Matrix4();

  for (let i = 0; i <= frames; i++) {
    const t = Math.min(clip.duration - 1e-6, (i * clip.duration) / frames);
    times[i] = (i * clip.duration) / frames;
    mixer.setTime(t);
    sourceRoot.updateWorldMatrix(true, true);

    for (const name of order) {
      const node = sources.get(name)!;
      matrix.copy(node.matrixWorld).decompose(scratchPos, srcWorld, scratchScale);
      // Target world = source world delta from rest (ANIMA rest world = identity).
      const desired = worldTgt.get(name)!;
      desired.copy(srcWorld).multiply(restWorldInv.get(name)!);
      const parent = parentOf.get(name);
      if (parent) {
        parentWorld.copy(worldTgt.get(parent)!).invert();
        local.copy(parentWorld).multiply(desired);
      } else {
        local.copy(desired);
      }
      values.get(name)!.set([local.x, local.y, local.z, local.w], i * 4);
    }

    sourceHips.getWorldPosition(scratchPos).multiplyScalar(scale);
    if (i === 0) firstHips.copy(scratchPos);
    hipsValues.set(
      [
        inPlace ? rig.bones.Hips.position.x : scratchPos.x - firstHips.x + rig.bones.Hips.position.x,
        scratchPos.y,
        inPlace ? rig.bones.Hips.position.z : scratchPos.z - firstHips.z + rig.bones.Hips.position.z,
      ],
      i * 3
    );
  }
  mixer.stopAllAction();

  const tracks = order.map(
    (name) =>
      new QuaternionKeyframeTrack(
        `${name}.quaternion`,
        times as unknown as number[],
        values.get(name)! as unknown as number[]
      )
  );
  tracks.push(
    new VectorKeyframeTrack(
      'Hips.position',
      times as unknown as number[],
      hipsValues as unknown as number[]
    ) as never
  );
  return new AnimationClip(`${clip.name}#anima`, clip.duration, tracks);
}
