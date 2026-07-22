import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  BoxGeometry,
  Color,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { Rng } from './core/random';
import { DEFAULT_OUTFIT, type OutfitPalette } from './palette';

/**
 * The canonical ANIMA skeleton. Every bone's rest orientation is identity
 * (local axes = world axes in the bind pose), which keeps procedural clip
 * math simple and makes retargeting corrections explicit later. The
 * character faces +Z; left is +X; feet rest on y = 0; arms bind in T-pose.
 */
export const BONE_NAMES = [
  'Hips',
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
] as const;

export type BoneName = (typeof BONE_NAMES)[number];

export interface HumanoidOptions {
  seed?: number;
  /** Standing height in world units. Default seeded 1.6–1.85. */
  height?: number;
  /** Body width multiplier: ~0.85 slim … 1.2 broad. Default seeded. */
  build?: number;
  palette?: OutfitPalette;
}

export interface HumanoidRig {
  /** Add this to your scene; position/rotate it like any Object3D. */
  object: Group;
  mesh: SkinnedMesh;
  skeleton: Skeleton;
  bones: Record<BoneName, Bone>;
  height: number;
  /** Hip-to-heel length — locomotion clips derive stride from this. */
  legLength: number;
  /** Steering footprint, SCENA/GAMA-compatible. */
  obstacleRadius: number;
}

interface PartSpec {
  bone: BoneName;
  size: [number, number, number];
  offset: [number, number, number];
  color: number;
}

/**
 * A seeded, rigged, skinned low-poly humanoid — a playable character
 * before any asset pipeline exists. The skeleton is animation-ready
 * (feed it to `createLocomotionClips` + `Locomotion`), the body is one
 * vertex-colored SkinnedMesh (a single draw call), and each body part is
 * rigidly skinned to its bone — robust and intentionally stylized.
 *
 * ```ts
 * const villager = createHumanoid({ seed: 7 });
 * scene.add(villager.object);
 * const loco = new Locomotion(villager);
 * game.onUpdate((t) => loco.update(t.delta, agent.velocity));
 * ```
 */
export function createHumanoid(options: HumanoidOptions = {}): HumanoidRig {
  const rng = new Rng(options.seed ?? 1);
  const palette = options.palette ?? DEFAULT_OUTFIT;
  const H = options.height ?? rng.range(1.6, 1.85);
  const build = options.build ?? rng.range(0.9, 1.12);
  const w = build;

  const upLegLen = 0.24 * H;
  const loLegLen = 0.22 * H;
  const ankleH = 0.045 * H;
  // Legs attach 0.02H below the hip bone — include that drop so soles rest at y = 0.
  const hipsY = upLegLen + loLegLen + ankleH + 0.02 * H;
  const legLength = upLegLen + loLegLen;
  const armLen = 0.15 * H;
  const foreLen = 0.13 * H;

  // --- Skeleton: [name, parent, local offset]. Identity rest rotations.
  const layout: Array<[BoneName, BoneName | null, [number, number, number]]> = [
    ['Hips', null, [0, hipsY, 0]],
    ['Spine', 'Hips', [0, 0.055 * H, 0]],
    ['Chest', 'Spine', [0, 0.07 * H, 0]],
    ['Neck', 'Chest', [0, 0.115 * H, 0]],
    ['Head', 'Neck', [0, 0.035 * H, 0]],
    ['LeftShoulder', 'Chest', [0.075 * H * w, 0.095 * H, 0]],
    ['LeftArm', 'LeftShoulder', [0.04 * H, 0, 0]],
    ['LeftForeArm', 'LeftArm', [armLen, 0, 0]],
    ['LeftHand', 'LeftForeArm', [foreLen, 0, 0]],
    ['RightShoulder', 'Chest', [-0.075 * H * w, 0.095 * H, 0]],
    ['RightArm', 'RightShoulder', [-0.04 * H, 0, 0]],
    ['RightForeArm', 'RightArm', [-armLen, 0, 0]],
    ['RightHand', 'RightForeArm', [-foreLen, 0, 0]],
    ['LeftUpLeg', 'Hips', [0.055 * H * w, -0.02 * H, 0]],
    ['LeftLeg', 'LeftUpLeg', [0, -upLegLen, 0]],
    ['LeftFoot', 'LeftLeg', [0, -loLegLen, 0]],
    ['RightUpLeg', 'Hips', [-0.055 * H * w, -0.02 * H, 0]],
    ['RightLeg', 'RightUpLeg', [0, -upLegLen, 0]],
    ['RightFoot', 'RightLeg', [0, -loLegLen, 0]],
  ];

  const bones = {} as Record<BoneName, Bone>;
  const restWorld = {} as Record<BoneName, Vector3>;
  const ordered: Bone[] = [];
  for (const [name, parent, offset] of layout) {
    const bone = new Bone();
    bone.name = name;
    bone.position.set(...offset);
    bones[name] = bone;
    ordered.push(bone);
    if (parent) {
      bones[parent].add(bone);
      restWorld[name] = restWorld[parent].clone().add(new Vector3(...offset));
    } else {
      restWorld[name] = new Vector3(...offset);
    }
  }

  // --- Body parts: bone-local boxes, rigidly skinned. Seeded colors.
  const pick = (pool: number[]): number => rng.pick(pool);
  const skin = pick(palette.skin);
  const hair = pick(palette.hair);
  const shirt = pick(palette.shirt);
  const pants = pick(palette.pants);
  const boots = pick(palette.boots);

  const arm = (side: 'Left' | 'Right'): PartSpec[] => {
    const s = side === 'Left' ? 1 : -1;
    return [
      { bone: `${side}Shoulder`, size: [0.055 * H, 0.055 * H, 0.06 * H], offset: [s * 0.012 * H, 0.004 * H, 0], color: shirt },
      { bone: `${side}Arm`, size: [armLen, 0.048 * H * w, 0.052 * H * w], offset: [s * armLen * 0.5, 0, 0], color: shirt },
      { bone: `${side}ForeArm`, size: [foreLen, 0.04 * H, 0.044 * H], offset: [s * foreLen * 0.5, 0, 0], color: skin },
      { bone: `${side}Hand`, size: [0.055 * H, 0.036 * H, 0.05 * H], offset: [s * 0.027 * H, 0, 0], color: skin },
    ] as PartSpec[];
  };
  const leg = (side: 'Left' | 'Right'): PartSpec[] =>
    [
      { bone: `${side}UpLeg`, size: [0.062 * H * w, upLegLen, 0.068 * H * w], offset: [0, -upLegLen * 0.5, 0], color: pants },
      { bone: `${side}Leg`, size: [0.052 * H * w, loLegLen, 0.058 * H * w], offset: [0, -loLegLen * 0.5, 0], color: pants },
      { bone: `${side}Foot`, size: [0.058 * H, ankleH, 0.115 * H], offset: [0, -ankleH * 0.5, 0.026 * H], color: boots },
    ] as PartSpec[];

  const parts: PartSpec[] = [
    { bone: 'Hips', size: [0.16 * H * w, 0.075 * H, 0.095 * H * w], offset: [0, 0.012 * H, 0], color: pants },
    { bone: 'Spine', size: [0.15 * H * w, 0.085 * H, 0.088 * H * w], offset: [0, 0.035 * H, 0], color: shirt },
    { bone: 'Chest', size: [0.17 * H * w, 0.125 * H, 0.098 * H * w], offset: [0, 0.055 * H, 0], color: shirt },
    { bone: 'Neck', size: [0.042 * H, 0.05 * H, 0.042 * H], offset: [0, 0.014 * H, 0], color: skin },
    { bone: 'Head', size: [0.11 * H, 0.115 * H, 0.115 * H], offset: [0, 0.065 * H, 0], color: skin },
    { bone: 'Head', size: [0.116 * H, 0.038 * H, 0.121 * H], offset: [0, 0.128 * H, -0.004 * H], color: hair },
    ...arm('Left'),
    ...arm('Right'),
    ...leg('Left'),
    ...leg('Right'),
  ];

  // --- Merge every part into one indexed, vertex-colored geometry.
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];
  const color = new Color();
  const boneIndex = new Map(ordered.map((bone, i) => [bone.name, i]));

  for (const part of parts) {
    const box = new BoxGeometry(...part.size);
    box.translate(
      part.offset[0] + restWorld[part.bone].x,
      part.offset[1] + restWorld[part.bone].y,
      part.offset[2] + restWorld[part.bone].z
    );
    const base = positions.length / 3;
    const pos = box.getAttribute('position');
    const nor = box.getAttribute('normal');
    color.setHex(part.color).offsetHSL(0, 0, rng.range(-0.015, 0.015));
    const index = boneIndex.get(part.bone)!;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(color.r, color.g, color.b);
      skinIndices.push(index, 0, 0, 0);
      skinWeights.push(1, 0, 0, 0);
    }
    const idx = box.getIndex()!;
    for (let i = 0; i < idx.count; i++) indices.push(base + idx.getX(i));
    box.dispose();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array(skinWeights), 4));
  geometry.setIndex(indices);

  const mesh = new SkinnedMesh(
    geometry,
    new MeshStandardMaterial({ vertexColors: true, flatShading: true })
  );
  mesh.name = 'humanoid';
  // Skinned bounds don't track animation; never let culling pop the body.
  mesh.frustumCulled = false;
  mesh.add(bones.Hips);
  mesh.updateMatrixWorld(true);
  mesh.bind(new Skeleton(ordered));

  const object = new Group();
  object.name = 'humanoid-rig';
  object.add(mesh);

  return {
    object,
    mesh,
    skeleton: mesh.skeleton,
    bones,
    height: H,
    legLength,
    obstacleRadius: 0.34 * (H / 1.7) * w,
  };
}
