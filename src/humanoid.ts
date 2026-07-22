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

/** Modular gear merged into the body mesh (still one draw call). */
export type Accessory = 'cap' | 'hat' | 'backpack' | 'pouch' | 'shoulderPads';

export type HairStyle =
  | 'bald'
  | 'cap'
  | 'side-part'
  | 'bob'
  | 'ponytail'
  | 'bun'
  | 'long'
  | 'spiky';

/** Facial features. Every field is seeded when omitted — override any. */
export interface FaceOptions {
  eyes?: { size?: number; spacing?: number; color?: number };
  /** Brow angle in radians: positive reads kind, negative stern. */
  brows?: { angle?: number; thickness?: number };
  nose?: { width?: number; length?: number };
  /** `smile` −1 (frown) … 1 (smile) — the resting expression. */
  mouth?: { width?: number; smile?: number };
  ears?: { size?: number };
  facialHair?: 'none' | 'mustache' | 'beard' | 'full';
}

/** Figure multipliers (1 = neutral). */
export interface BodyTypeParams {
  shoulders: number;
  waist: number;
  hips: number;
  /** Bust prominence 0–1. */
  chest: number;
}

export type BodyType = 'feminine' | 'masculine' | 'neutral' | BodyTypeParams;

const BODY_PRESETS: Record<'feminine' | 'masculine' | 'neutral', BodyTypeParams> = {
  feminine: { shoulders: 0.88, waist: 0.85, hips: 1.08, chest: 0.85 },
  masculine: { shoulders: 1.09, waist: 1.0, hips: 0.94, chest: 0 },
  neutral: { shoulders: 1.0, waist: 0.94, hips: 1.0, chest: 0 },
};

export type TopGarment = 'shirt' | 'tunic' | 'dress' | 'jacket' | 'apron';
export type BottomGarment = 'pants' | 'shorts' | 'skirt';

/** Garment layers. Seeded when omitted; `dress` ignores `bottom`. */
export interface WardrobeOptions {
  top?: TopGarment;
  bottom?: BottomGarment;
  sleeves?: 'long' | 'short';
  collar?: boolean;
  belt?: boolean;
}

/** Explicit color overrides (each defaults to a seeded palette pick). */
export interface ColorOptions {
  skin?: number;
  hair?: number;
  top?: number;
  bottom?: number;
  boots?: number;
}

export interface HumanoidOptions {
  seed?: number;
  /** Standing height in world units. Default seeded 1.6–1.85. */
  height?: number;
  /** Body width multiplier: ~0.85 slim … 1.2 broad. Default seeded. */
  build?: number;
  palette?: OutfitPalette;
  /** Figure: a preset name or explicit multipliers. Default seeded. */
  bodyType?: BodyType;
  /** Garment layers. Default seeded. */
  outfit?: WardrobeOptions;
  /** Explicit colors. Default seeded palette picks. */
  colors?: ColorOptions;
  /**
   * Gear: an explicit list, `'auto'` for a seeded pick (default), or
   * `'none'`. Accessories ride their bones through every animation.
   */
  accessories?: Accessory[] | 'auto' | 'none';
  /** Facial features — seeded when omitted, any field overridable. */
  face?: FaceOptions;
  /** Hair style/color — seeded when omitted. */
  hair?: { style?: HairStyle; color?: number };
}

/**
 * Every decision `createHumanoid` would make for these options, fully
 * resolved — the character-creator surface. Feed it back (tweaked or
 * not) and the resulting mesh is byte-identical to building from the
 * original options: `createHumanoid(describeHumanoid(o)) ≡ createHumanoid(o)`.
 */
export interface ResolvedHumanoid extends HumanoidOptions {
  seed: number;
  height: number;
  build: number;
  bodyType: BodyTypeParams;
  outfit: Required<WardrobeOptions>;
  colors: Required<ColorOptions>;
  accessories: Accessory[];
  face: Required<{
    eyes: Required<NonNullable<FaceOptions['eyes']>>;
    brows: Required<NonNullable<FaceOptions['brows']>>;
    nose: Required<NonNullable<FaceOptions['nose']>>;
    mouth: Required<NonNullable<FaceOptions['mouth']>>;
    ears: Required<NonNullable<FaceOptions['ears']>>;
    facialHair: NonNullable<FaceOptions['facialHair']>;
  }>;
  hair: { style: HairStyle; color: number };
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
  /** Every decision that built this character (creator-UI ready). */
  description: ResolvedHumanoid;
}

interface PartSpec {
  bone: BoneName;
  size: [number, number, number];
  offset: [number, number, number];
  color: number;
  /** Euler XYZ rotation applied to the box before positioning. */
  rotation?: [number, number, number];
}

/**
 * Resolve every seeded decision for a character WITHOUT building it —
 * the character-creator API. Returns a plain, JSON-serializable object;
 * tweak any field and pass it to `createHumanoid`.
 *
 * ```ts
 * const spec = describeHumanoid({ seed: 7 });
 * spec.face.mouth.smile = 1;
 * spec.hair.style = 'ponytail';
 * spec.outfit.top = 'dress';
 * const rig = createHumanoid(spec);
 * ```
 */
export function describeHumanoid(options: HumanoidOptions = {}): ResolvedHumanoid {
  const seed = options.seed ?? 1;
  const rng = new Rng(seed);
  const palette = options.palette ?? DEFAULT_OUTFIT;
  const pick = (pool: number[]): number => rng.pick(pool);

  const height = options.height ?? rng.range(1.6, 1.85);
  const build = options.build ?? rng.range(0.9, 1.12);
  const skinRoll = pick(palette.skin);
  const hairRoll = pick(palette.hair);
  const topRoll = pick(palette.shirt);
  const bottomRoll = pick(palette.pants);
  const bootsRoll = pick(palette.boots);
  const colors: Required<ColorOptions> = {
    skin: options.colors?.skin ?? skinRoll,
    hair: options.colors?.hair ?? hairRoll,
    top: options.colors?.top ?? topRoll,
    bottom: options.colors?.bottom ?? bottomRoll,
    boots: options.colors?.boots ?? bootsRoll,
  };

  let accessories: Accessory[];
  if (options.accessories === 'none') accessories = [];
  else if (Array.isArray(options.accessories)) accessories = [...options.accessories];
  else {
    accessories = [];
    if (rng.next() < 0.35) accessories.push(rng.pick(['cap', 'hat'] as const));
    if (rng.next() < 0.3) accessories.push('backpack');
    if (rng.next() < 0.35) accessories.push('pouch');
    if (rng.next() < 0.15) accessories.push('shoulderPads');
  }

  const face = options.face ?? {};
  const resolvedFace: ResolvedHumanoid['face'] = {
    eyes: {
      size: face.eyes?.size ?? rng.range(0.85, 1.2),
      spacing: face.eyes?.spacing ?? rng.range(0.9, 1.15),
      color: face.eyes?.color ?? pick(palette.eyes),
    },
    brows: {
      angle: face.brows?.angle ?? rng.range(-0.3, 0.3),
      thickness: face.brows?.thickness ?? rng.range(0.8, 1.4),
    },
    nose: {
      width: face.nose?.width ?? rng.range(0.8, 1.3),
      length: face.nose?.length ?? rng.range(0.8, 1.35),
    },
    mouth: {
      width: face.mouth?.width ?? rng.range(0.8, 1.2),
      smile: face.mouth?.smile ?? rng.range(-0.5, 1),
    },
    ears: { size: face.ears?.size ?? rng.range(0.85, 1.25) },
    facialHair:
      face.facialHair ??
      (rng.next() < 0.18
        ? 'mustache'
        : rng.next() < 0.14
          ? 'beard'
          : rng.next() < 0.1
            ? 'full'
            : 'none'),
  };

  // Wardrobe + figure draw from an independent stream, so overriding any
  // earlier field never reshuffles someone's clothes (and vice versa).
  const wardrobeRng = new Rng((seed ^ 0x51ab7e2d) >>> 0);
  let bodyType: BodyTypeParams;
  if (typeof options.bodyType === 'object') {
    bodyType = { ...options.bodyType };
  } else {
    const roll = wardrobeRng.next();
    const name =
      options.bodyType ?? (roll < 0.42 ? 'masculine' : roll < 0.84 ? 'feminine' : 'neutral');
    const preset = BODY_PRESETS[name];
    bodyType = {
      shoulders: preset.shoulders * wardrobeRng.range(0.97, 1.03),
      waist: preset.waist * wardrobeRng.range(0.97, 1.03),
      hips: preset.hips * wardrobeRng.range(0.97, 1.03),
      chest: preset.chest === 0 ? 0 : Math.min(1, preset.chest * wardrobeRng.range(0.85, 1.15)),
    };
  }

  const feminineLean = bodyType.chest > 0.3;
  const topPick = wardrobeRng.next();
  const top: TopGarment =
    options.outfit?.top ??
    (feminineLean
      ? topPick < 0.34 ? 'shirt' : topPick < 0.5 ? 'tunic' : topPick < 0.78 ? 'dress' : topPick < 0.9 ? 'jacket' : 'apron'
      : topPick < 0.48 ? 'shirt' : topPick < 0.7 ? 'tunic' : topPick < 0.82 ? 'jacket' : topPick < 0.92 ? 'apron' : 'dress');
  const bottomPick = wardrobeRng.next();
  const bottom: BottomGarment =
    options.outfit?.bottom ??
    (bottomPick < 0.6 ? 'pants' : bottomPick < 0.78 ? 'shorts' : 'skirt');
  const sleeves = options.outfit?.sleeves ?? (wardrobeRng.next() < 0.5 ? 'long' : 'short');
  const collar = options.outfit?.collar ?? wardrobeRng.next() < 0.3;
  const belt = options.outfit?.belt ?? wardrobeRng.next() < 0.35;

  return {
    seed,
    palette,
    height,
    build,
    bodyType,
    outfit: { top, bottom, sleeves, collar, belt },
    colors,
    accessories,
    face: resolvedFace,
    hair: {
      style: options.hair?.style ?? seededHairStyle(rng, accessories),
      color: options.hair?.color ?? colors.hair,
    },
  };
}

function seededHairStyle(rng: Rng, accessories: Accessory[]): HairStyle {
  const roll = rng.next();
  let style: HairStyle =
    roll < 0.1 ? 'bald'
    : roll < 0.35 ? 'cap'
    : roll < 0.5 ? 'side-part'
    : roll < 0.62 ? 'bob'
    : roll < 0.74 ? 'ponytail'
    : roll < 0.82 ? 'bun'
    : roll < 0.92 ? 'long'
    : 'spiky';
  if ((accessories.includes('hat') || accessories.includes('cap')) && style !== 'bald') {
    style = 'cap';
  }
  return style;
}

/**
 * A seeded, rigged, skinned low-poly humanoid — a playable character
 * before any asset pipeline exists: body type, outfit, face, hair and
 * gear all resolved from the seed (see `describeHumanoid` to inspect and
 * override any of it). One vertex-colored SkinnedMesh, one draw call.
 */
export function createHumanoid(options: HumanoidOptions = {}): HumanoidRig {
  const spec = describeHumanoid(options);
  const { height: H, build: w, bodyType, outfit, colors, accessories } = spec;
  const S = bodyType.shoulders;
  const W = bodyType.waist;
  const P = bodyType.hips;
  // Geometry details + color jitter come from seed-only streams, so a
  // described spec rebuilds byte-identically however it was produced.
  const detailRng = new Rng((spec.seed ^ 0x2f6e1b45) >>> 0);
  const jitterRng = new Rng((spec.seed ^ 0x7c93a501) >>> 0);

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
    ['LeftShoulder', 'Chest', [0.075 * H * w * S, 0.095 * H, 0]],
    ['LeftArm', 'LeftShoulder', [0.04 * H, 0, 0]],
    ['LeftForeArm', 'LeftArm', [armLen, 0, 0]],
    ['LeftHand', 'LeftForeArm', [foreLen, 0, 0]],
    ['RightShoulder', 'Chest', [-0.075 * H * w * S, 0.095 * H, 0]],
    ['RightArm', 'RightShoulder', [-0.04 * H, 0, 0]],
    ['RightForeArm', 'RightArm', [-armLen, 0, 0]],
    ['RightHand', 'RightForeArm', [-foreLen, 0, 0]],
    ['LeftUpLeg', 'Hips', [0.055 * H * w * P, -0.02 * H, 0]],
    ['LeftLeg', 'LeftUpLeg', [0, -upLegLen, 0]],
    ['LeftFoot', 'LeftLeg', [0, -loLegLen, 0]],
    ['RightUpLeg', 'Hips', [-0.055 * H * w * P, -0.02 * H, 0]],
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

  // --- Wardrobe-aware coloring of body segments.
  const { skin, boots } = colors;
  const hair = spec.hair.color;
  const topColor = colors.top;
  const bottomColor = colors.bottom;
  const dress = outfit.top === 'dress';
  const hipsColor = dress || outfit.top === 'tunic' ? topColor
    : outfit.bottom === 'skirt' ? bottomColor
    : bottomColor;
  const upLegColor = dress || outfit.bottom === 'skirt' ? skin
    : bottomColor;
  const loLegColor = dress || outfit.bottom === 'skirt' || outfit.bottom === 'shorts' ? skin : bottomColor;
  const foreArmColor = outfit.sleeves === 'long' ? topColor : skin;

  const arm = (side: 'Left' | 'Right'): PartSpec[] => {
    const s = side === 'Left' ? 1 : -1;
    return [
      { bone: `${side}Shoulder`, size: [0.055 * H, 0.055 * H, 0.06 * H], offset: [s * 0.012 * H, 0.004 * H, 0], color: topColor },
      { bone: `${side}Arm`, size: [armLen, 0.048 * H * w, 0.052 * H * w], offset: [s * armLen * 0.5, 0, 0], color: topColor },
      { bone: `${side}ForeArm`, size: [foreLen, 0.04 * H, 0.044 * H], offset: [s * foreLen * 0.5, 0, 0], color: foreArmColor },
      { bone: `${side}Hand`, size: [0.055 * H, 0.036 * H, 0.05 * H], offset: [s * 0.027 * H, 0, 0], color: skin },
    ] as PartSpec[];
  };
  const leg = (side: 'Left' | 'Right'): PartSpec[] =>
    [
      { bone: `${side}UpLeg`, size: [0.062 * H * w, upLegLen, 0.068 * H * w], offset: [0, -upLegLen * 0.5, 0], color: upLegColor },
      { bone: `${side}Leg`, size: [0.052 * H * w, loLegLen, 0.058 * H * w], offset: [0, -loLegLen * 0.5, 0], color: loLegColor },
      { bone: `${side}Foot`, size: [0.058 * H, ankleH, 0.115 * H], offset: [0, -ankleH * 0.5, 0.026 * H], color: boots },
    ] as PartSpec[];

  const parts: PartSpec[] = [
    { bone: 'Hips', size: [0.16 * H * w * P, 0.075 * H, 0.095 * H * w * P], offset: [0, 0.012 * H, 0], color: hipsColor },
    { bone: 'Spine', size: [0.15 * H * w * W, 0.085 * H, 0.088 * H * w * W], offset: [0, 0.035 * H, 0], color: topColor },
    { bone: 'Chest', size: [0.17 * H * w * S, 0.125 * H, 0.098 * H * w], offset: [0, 0.055 * H, 0], color: topColor },
    { bone: 'Neck', size: [0.042 * H, 0.05 * H, 0.042 * H], offset: [0, 0.014 * H, 0], color: skin },
    { bone: 'Head', size: [0.11 * H, 0.115 * H, 0.115 * H], offset: [0, 0.065 * H, 0], color: skin },
    ...arm('Left'),
    ...arm('Right'),
    ...leg('Left'),
    ...leg('Right'),
  ];

  // --- Figure: bust box for feminine builds (clothed in the top color).
  if (bodyType.chest > 0.05) {
    parts.push({
      bone: 'Chest',
      size: [0.125 * H * w, 0.052 * H, 0.05 * H * bodyType.chest],
      offset: [0, 0.045 * H, 0.049 * H * w],
      color: topColor,
    });
  }

  // --- Garment layers.
  if (outfit.top === 'tunic') {
    parts.push({ bone: 'Hips', size: [0.15 * H * w * P, 0.06 * H, 0.1 * H * w], offset: [0, -0.048 * H, 0], color: topColor });
  } else if (dress) {
    parts.push(
      { bone: 'Hips', size: [0.17 * H * w * P, 0.1 * H, 0.115 * H * w], offset: [0, -0.075 * H, 0], color: topColor },
      { bone: 'Hips', size: [0.2 * H * w * P, 0.1 * H, 0.14 * H * w], offset: [0, -0.165 * H, 0], color: topColor }
    );
  } else if (outfit.top === 'jacket') {
    parts.push({ bone: 'Chest', size: [0.05 * H, 0.115 * H, 0.01 * H], offset: [0, 0.05 * H, 0.05 * H * w], color: colors.bottom });
  } else if (outfit.top === 'apron') {
    parts.push(
      { bone: 'Chest', size: [0.09 * H, 0.1 * H, 0.01 * H], offset: [0, 0.045 * H, 0.051 * H * w], color: 0xd8d2c2 },
      { bone: 'Hips', size: [0.13 * H, 0.095 * H, 0.01 * H], offset: [0, -0.04 * H, 0.05 * H * w], color: 0xd8d2c2 }
    );
  }
  if (!dress && outfit.bottom === 'skirt') {
    parts.push({ bone: 'Hips', size: [0.18 * H * w * P, 0.095 * H, 0.125 * H * w], offset: [0, -0.072 * H, 0], color: bottomColor });
  }
  if (outfit.collar || outfit.top === 'jacket') {
    const collarColor = new Color(topColor).offsetHSL(0, 0, -0.09).getHex();
    parts.push({ bone: 'Neck', size: [0.058 * H, 0.02 * H, 0.052 * H], offset: [0, 0.006 * H, 0.004 * H], color: collarColor });
  }
  if (outfit.belt) {
    parts.push(
      { bone: 'Hips', size: [0.164 * H * w * P, 0.024 * H, 0.099 * H * w * P], offset: [0, 0.05 * H, 0], color: boots },
      { bone: 'Hips', size: [0.024 * H, 0.02 * H, 0.012 * H], offset: [0, 0.05 * H, 0.05 * H * w * P], color: 0xc9b060 }
    );
  }

  // --- Accessories.
  const leather = boots;
  const cloth = topColor;
  for (const accessory of accessories) {
    if (accessory === 'cap') {
      parts.push(
        { bone: 'Head', size: [0.122 * H, 0.032 * H, 0.126 * H], offset: [0, 0.132 * H, -0.002 * H], color: cloth },
        { bone: 'Head', size: [0.08 * H, 0.012 * H, 0.05 * H], offset: [0, 0.122 * H, 0.075 * H], color: cloth }
      );
    } else if (accessory === 'hat') {
      parts.push(
        { bone: 'Head', size: [0.19 * H, 0.014 * H, 0.19 * H], offset: [0, 0.126 * H, 0], color: leather },
        { bone: 'Head', size: [0.1 * H, 0.06 * H, 0.1 * H], offset: [0, 0.16 * H, 0], color: leather }
      );
    } else if (accessory === 'backpack') {
      parts.push(
        { bone: 'Chest', size: [0.14 * H, 0.155 * H, 0.07 * H], offset: [0, 0.045 * H, -0.085 * H], color: leather },
        { bone: 'Chest', size: [0.1 * H, 0.04 * H, 0.05 * H], offset: [0, 0.135 * H, -0.08 * H], color: cloth }
      );
    } else if (accessory === 'pouch') {
      parts.push({
        bone: 'Hips',
        size: [0.055 * H, 0.06 * H, 0.045 * H],
        offset: [detailRng.pick([-1, 1]) * 0.095 * H, -0.005 * H, 0.02 * H],
        color: leather,
      });
    } else {
      for (const side of [-1, 1]) {
        parts.push({
          bone: side === 1 ? 'LeftShoulder' : 'RightShoulder',
          size: [0.07 * H, 0.03 * H, 0.075 * H],
          offset: [side * 0.015 * H, 0.035 * H, 0],
          color: leather,
        });
      }
    }
  }

  // --- The face.
  const face = spec.face;
  const lip = new Color(skin).offsetHSL(0.005, 0.1, -0.13).getHex();
  const faceZ = 0.0565 * H;
  for (const s of [1, -1]) {
    const ex = s * 0.027 * H * face.eyes.spacing;
    parts.push(
      { bone: 'Head', size: [0.026 * H * face.eyes.size, 0.02 * H * face.eyes.size, 0.008 * H], offset: [ex, 0.078 * H, faceZ], color: 0xf4f2ec },
      { bone: 'Head', size: [0.012 * H * face.eyes.size, 0.013 * H * face.eyes.size, 0.007 * H], offset: [ex, 0.076 * H, faceZ + 0.004 * H], color: face.eyes.color },
      { bone: 'Head', size: [0.033 * H, 0.008 * H * face.brows.thickness, 0.008 * H], offset: [ex * 1.05, 0.098 * H, faceZ + 0.001 * H], color: hair, rotation: [0, 0, s * face.brows.angle] },
      { bone: 'Head', size: [0.012 * H, 0.03 * H * face.ears.size, 0.024 * H], offset: [s * 0.0605 * H, 0.062 * H, -0.004 * H], color: skin }
    );
  }
  parts.push(
    { bone: 'Head', size: [0.015 * H * face.nose.width, 0.032 * H * face.nose.length, 0.016 * H], offset: [0, 0.057 * H, 0.059 * H], color: skin },
    { bone: 'Head', size: [0.038 * H * face.mouth.width, 0.008 * H, 0.006 * H], offset: [0, 0.03 * H, faceZ + 0.001 * H], color: lip }
  );
  for (const s of [1, -1]) {
    parts.push({
      bone: 'Head',
      size: [0.009 * H, 0.008 * H, 0.006 * H],
      offset: [s * 0.022 * H * face.mouth.width, 0.03 * H + face.mouth.smile * 0.008 * H, faceZ + 0.001 * H],
      color: lip,
    });
  }
  if (face.facialHair === 'mustache' || face.facialHair === 'full') {
    parts.push({ bone: 'Head', size: [0.044 * H, 0.013 * H, 0.012 * H], offset: [0, 0.044 * H, faceZ + 0.002 * H], color: hair });
  }
  if (face.facialHair === 'beard' || face.facialHair === 'full') {
    parts.push(
      { bone: 'Head', size: [0.098 * H, 0.042 * H, 0.02 * H], offset: [0, 0.008 * H, 0.05 * H], color: hair },
      { bone: 'Head', size: [0.06 * H, 0.032 * H, 0.032 * H], offset: [0, -0.004 * H, 0.042 * H], color: hair }
    );
  }

  // --- Hair.
  const hairStyle = spec.hair.style;
  const hairColor = spec.hair.color;
  if (hairStyle !== 'bald') {
    parts.push({ bone: 'Head', size: [0.116 * H, 0.038 * H, 0.121 * H], offset: [0, 0.128 * H, -0.004 * H], color: hairColor });
  }
  if (hairStyle === 'side-part') {
    parts.push({ bone: 'Head', size: [0.062 * H, 0.02 * H, 0.016 * H], offset: [0.024 * H, 0.114 * H, 0.054 * H], color: hairColor });
  } else if (hairStyle === 'bob' || hairStyle === 'long') {
    for (const s of [1, -1]) {
      parts.push({ bone: 'Head', size: [0.015 * H, 0.072 * H, 0.11 * H], offset: [s * 0.063 * H, 0.078 * H, -0.01 * H], color: hairColor });
    }
    parts.push(
      hairStyle === 'bob'
        ? { bone: 'Head', size: [0.11 * H, 0.085 * H, 0.018 * H], offset: [0, 0.072 * H, -0.062 * H], color: hairColor }
        : { bone: 'Head', size: [0.112 * H, 0.155 * H, 0.022 * H], offset: [0, 0.026 * H, -0.064 * H], color: hairColor }
    );
  } else if (hairStyle === 'ponytail') {
    parts.push({ bone: 'Head', size: [0.03 * H, 0.098 * H, 0.03 * H], offset: [0, 0.072 * H, -0.077 * H], color: hairColor, rotation: [0.22, 0, 0] });
  } else if (hairStyle === 'bun') {
    parts.push({ bone: 'Head', size: [0.042 * H, 0.042 * H, 0.042 * H], offset: [0, 0.136 * H, -0.056 * H], color: hairColor });
  } else if (hairStyle === 'spiky') {
    for (let i = 0; i < 5; i++) {
      parts.push({
        bone: 'Head',
        size: [0.022 * H, 0.038 * H, 0.022 * H],
        offset: [detailRng.range(-0.04, 0.04) * H, 0.152 * H, detailRng.range(-0.045, 0.035) * H],
        color: hairColor,
        rotation: [detailRng.range(-0.35, 0.35), 0, detailRng.range(-0.35, 0.35)],
      });
    }
  }

  // --- Merge every part into one indexed, vertex-colored geometry.
  const positions: number[] = [];
  const normals: number[] = [];
  const vertexColors: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];
  const color = new Color();
  const boneIndex = new Map(ordered.map((bone, i) => [bone.name, i]));

  for (const part of parts) {
    const box = new BoxGeometry(...part.size);
    if (part.rotation) {
      box.rotateX(part.rotation[0]);
      box.rotateY(part.rotation[1]);
      box.rotateZ(part.rotation[2]);
    }
    box.translate(
      part.offset[0] + restWorld[part.bone].x,
      part.offset[1] + restWorld[part.bone].y,
      part.offset[2] + restWorld[part.bone].z
    );
    const base = positions.length / 3;
    const pos = box.getAttribute('position');
    const nor = box.getAttribute('normal');
    color.setHex(part.color).offsetHSL(0, 0, jitterRng.range(-0.015, 0.015));
    const index = boneIndex.get(part.bone)!;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      vertexColors.push(color.r, color.g, color.b);
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
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(vertexColors), 3));
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
    description: spec,
  };
}
