import {
  Bone,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  MeshStandardMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { Rng } from './core/random';

/**
 * Four-legged characters — the first non-humanoid body in ANIMA.
 *
 * The skeleton is laid out to real horse proportions, measured the way
 * horse people measure: everything is a fraction of **withers height**
 * (`height`), the shoulder being the one landmark that doesn't move when
 * the head goes up and down.
 *
 * The detail that decides whether a quadruped reads as an animal or as a
 * table with legs is the **hind leg zigzag**. A horse's femur points down
 * and *forward* to the stifle, the tibia runs down and *backward* to the
 * hock, and the cannon drops forward again to the fetlock. The foreleg
 * does the opposite — humerus back, radius forward. Straighten those and
 * you get a pantomime horse, no matter how good the animation on top is.
 */

/** The four legs, in the order gait footfalls are usually written. */
export const LEGS = ['LF', 'RF', 'LH', 'RH'] as const;
export type LegName = (typeof LEGS)[number];

export const QUADRUPED_BONES = [
  'Hips',
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'Tail',
  'TailTip',
  'LFUpper', 'LFLower', 'LFCannon', 'LFHoof',
  'RFUpper', 'RFLower', 'RFCannon', 'RFHoof',
  'LHUpper', 'LHLower', 'LHCannon', 'LHHoof',
  'RHUpper', 'RHLower', 'RHCannon', 'RHHoof',
] as const;

export type QuadrupedBone = (typeof QUADRUPED_BONES)[number];

/** Is this leg a foreleg? Forelegs and hind legs bend opposite ways. */
export const isFront = (leg: LegName): boolean => leg[1] === 'F';
/** Which side of the body — +1 left, −1 right. */
export const legSide = (leg: LegName): number => (leg[0] === 'L' ? 1 : -1);

/**
 * Coat colours, with the genetics that matter visually. A **bay** is not
 * "brown" — it is a brown body with *black points*: mane, tail and lower
 * legs. Miss that and the most common horse colour in the world looks
 * wrong. Duns carry the same black points plus a dorsal stripe; chestnuts
 * are self-coloured with a often-lighter mane; greys lighten with age.
 */
export const COATS = {
  bay: { body: 0x6d4726, points: 0x1b1512, mane: 0x1b1512, dorsal: false },
  darkBay: { body: 0x4a2f1c, points: 0x171310, mane: 0x171310, dorsal: false },
  chestnut: { body: 0x9c5a2b, points: 0x8d5228, mane: 0xc98f57, dorsal: false },
  black: { body: 0x2b2521, points: 0x1c1815, mane: 0x151110, dorsal: false },
  grey: { body: 0xb9b5af, points: 0x9c978f, mane: 0xdad6d0, dorsal: false },
  palomino: { body: 0xc9a25c, points: 0xbb9453, mane: 0xefe7d4, dorsal: false },
  dun: { body: 0xbb9d64, points: 0x4b3d29, mane: 0x4b3d29, dorsal: true },
  buckskin: { body: 0xc2a066, points: 0x241d18, mane: 0x241d18, dorsal: false },
} as const;

export type CoatName = keyof typeof COATS;

/** Face markings, smallest to largest — the horse's name badge. */
export type FaceMarking = 'none' | 'star' | 'stripe' | 'blaze';

export type QuadrupedSpecies = 'horse' | 'pony' | 'draft' | 'donkey';

export interface QuadrupedOptions {
  seed?: number;
  /** Build: a riding 'horse', a stocky 'pony', a heavy 'draft', a 'donkey'. */
  species?: QuadrupedSpecies;
  /** Withers height in metres. Defaults to the species' own. */
  height?: number;
  coat?: CoatName;
  marking?: FaceMarking;
  /** White lower legs, one flag per leg in LEGS order. Seeded by default. */
  socks?: boolean[];
}

export interface QuadrupedRig {
  /** Add this to your scene; position/rotate it like any Object3D. */
  object: Group;
  mesh: SkinnedMesh;
  skeleton: Skeleton;
  bones: Record<QuadrupedBone, Bone>;
  /** Withers height in metres — the measurement horse people use. */
  height: number;
  /** Nose to tail, for spacing and stabling. */
  bodyLength: number;
  /** Shoulder-to-ground; gait clips derive stride length from it. */
  legLength: number;
  /**
   * Where a rider sits: an Object3D in the rig, at the saddle's seat, and
   * an offset for the stirrup. ANIMA's `Mount` and SCENA's tack both build
   * to these, so a rider lands in the saddle without runtime IK.
   */
  saddle: Object3D;
  /** Where the reins are held, in front of the saddle. */
  reins: Object3D;
  obstacleRadius: number;
  description: {
    seed: number;
    species: QuadrupedSpecies;
    height: number;
    coat: CoatName;
    marking: FaceMarking;
    socks: boolean[];
  };
}

interface Part {
  bone: QuadrupedBone;
  size: [number, number, number];
  offset: [number, number, number];
  color: number;
  rotation?: [number, number, number];
}

/** Species proportions, relative to withers height. */
const SPECIES: Record<
  QuadrupedSpecies,
  { height: number; girth: number; bone: number; neck: number; headLen: number; ear: number }
> = {
  // girth = barrel depth, bone = limb thickness, neck = neck length,
  // ear = ear length. A draft is deep and heavy-boned with a short thick
  // neck; a donkey is slight with a big head and unmistakable ears.
  horse: { height: 1.62, girth: 0.46, bone: 1.0, neck: 1.0, headLen: 0.36, ear: 0.055 },
  pony: { height: 1.24, girth: 0.48, bone: 1.12, neck: 0.88, headLen: 0.34, ear: 0.05 },
  draft: { height: 1.75, girth: 0.53, bone: 1.35, neck: 0.86, headLen: 0.38, ear: 0.05 },
  donkey: { height: 1.15, girth: 0.44, bone: 0.92, neck: 0.8, headLen: 0.4, ear: 0.115 },
};

/**
 * Build a four-legged character — a horse, by default, at 16 hands.
 *
 * ```ts
 * const horse = createQuadruped({ seed: 3, coat: 'bay' });
 * scene.add(horse.object);
 * const gaits = new QuadrupedLocomotion(horse);   // walk/trot/canter/gallop
 * ```
 */
export function createQuadruped(options: QuadrupedOptions = {}): QuadrupedRig {
  const seed = options.seed ?? 1;
  const rng = new Rng(seed);
  const jitter = new Rng((seed ^ 0x51ed270b) >>> 0);
  const species = options.species ?? 'horse';
  const proportions = SPECIES[species];
  const H = options.height ?? proportions.height;
  const bone = proportions.bone;
  const coatName =
    options.coat ??
    (species === 'donkey'
      ? 'grey'
      : (['bay', 'darkBay', 'chestnut', 'black', 'grey', 'palomino', 'dun', 'buckskin'] as const)[
          rng.int(0, 7)
        ]);
  const coat = COATS[coatName];
  const marking = options.marking ?? (['none', 'star', 'stripe', 'blaze'] as const)[rng.int(0, 3)];
  const socks = options.socks ?? LEGS.map(() => rng.next() < 0.28);

  // --- Skeleton -----------------------------------------------------------
  // Every offset is the real limb direction, so the REST pose is already a
  // horse standing square; clips only ever rotate away from it.
  const layout: Array<[QuadrupedBone, QuadrupedBone | null, [number, number, number]]> = [
    ['Hips', null, [0, 0.85 * H, -0.32 * H]],
    ['Spine', 'Hips', [0, 0.005 * H, 0.24 * H]],
    ['Chest', 'Spine', [0, 0.02 * H, 0.26 * H]],
    // The neck runs up and forward at about 45° and is nearly half the
    // withers height long — a short neck is the fastest way to turn a
    // horse into a dog.
    ['Neck', 'Chest', [0, 0.13 * H, 0.1 * H]],
    ['Head', 'Neck', [0, 0.3 * H * proportions.neck, 0.26 * H * proportions.neck]],
    ['Tail', 'Hips', [0, 0.06 * H, -0.13 * H]],
    ['TailTip', 'Tail', [0, -0.16 * H, -0.1 * H]],
  ];

  for (const leg of LEGS) {
    const s = legSide(leg);
    if (isFront(leg)) {
      // Foreleg: humerus down-and-BACK to the elbow, radius down-and-forward
      // to the carpus, cannon straight down to the fetlock.
      layout.push([`${leg}Upper` as QuadrupedBone, 'Chest', [s * 0.09 * H, -0.22 * H, 0.02 * H]]);
      layout.push([`${leg}Lower` as QuadrupedBone, `${leg}Upper` as QuadrupedBone, [0, -0.17 * H, -0.05 * H]]);
      layout.push([`${leg}Cannon` as QuadrupedBone, `${leg}Lower` as QuadrupedBone, [0, -0.26 * H, 0.03 * H]]);
      layout.push([`${leg}Hoof` as QuadrupedBone, `${leg}Cannon` as QuadrupedBone, [0, -0.19 * H, 0]]);
    } else {
      // Hind leg: femur down-and-FORWARD to the stifle, tibia down-and-back
      // to the hock, metatarsus forward again. This zigzag is the horse.
      layout.push([`${leg}Upper` as QuadrupedBone, 'Hips', [s * 0.085 * H, -0.14 * H, -0.02 * H]]);
      layout.push([`${leg}Lower` as QuadrupedBone, `${leg}Upper` as QuadrupedBone, [0, -0.2 * H, 0.09 * H]]);
      layout.push([`${leg}Cannon` as QuadrupedBone, `${leg}Lower` as QuadrupedBone, [0, -0.24 * H, -0.1 * H]]);
      layout.push([`${leg}Hoof` as QuadrupedBone, `${leg}Cannon` as QuadrupedBone, [0, -0.24 * H, 0.02 * H]]);
    }
  }

  const bones = {} as Record<QuadrupedBone, Bone>;
  const restWorld = {} as Record<QuadrupedBone, Vector3>;
  const ordered: Bone[] = [];
  for (const [name, parent, offset] of layout) {
    const b = new Bone();
    b.name = name;
    b.position.set(...offset);
    bones[name] = b;
    ordered.push(b);
    if (parent) {
      bones[parent].add(b);
      restWorld[name] = restWorld[parent].clone().add(new Vector3(...offset));
    } else {
      restWorld[name] = new Vector3(...offset);
    }
  }

  // --- Body ---------------------------------------------------------------
  const girth = proportions.girth * H;
  const width = 0.3 * H;
  const parts: Part[] = [];
  const body = coat.body;
  const points = coat.points;

  // Barrel: deepest at the girth (just behind the elbow), tucked at the
  // flank. The belly line sits a little above half the withers height —
  // hang it lower and the horse turns into a dachshund.
  parts.push({ bone: 'Spine', size: [width, girth, 0.44 * H], offset: [0, -0.075 * H, 0.02 * H], color: body });
  // Chest / shoulder mass, and the croup over the hindquarters.
  parts.push({ bone: 'Chest', size: [width * 0.97, girth * 0.9, 0.26 * H], offset: [0, -0.085 * H, 0.02 * H], color: body });
  parts.push({ bone: 'Hips', size: [width * 1.02, 0.36 * H, 0.3 * H], offset: [0, -0.04 * H, -0.02 * H], color: body });
  // The rounded croup, sloping down to the tail.
  parts.push({ bone: 'Hips', size: [width * 0.9, 0.14 * H, 0.22 * H], offset: [0, 0.1 * H, -0.06 * H], color: body, rotation: [0.22, 0, 0] });
  // The withers: the bump at the base of the neck that gives a horse its
  // outline, and the landmark its height is measured to.
  parts.push({ bone: 'Chest', size: [0.15 * H, 0.11 * H, 0.22 * H], offset: [0, 0.05 * H, 0.03 * H], color: body });

  // Neck: blocks stepped along the neck's own axis — up and FORWARD at
  // ~41° from vertical. (A positive X rotation tips a box's up-axis toward
  // +z; getting that sign backwards lays the neck along the horse's spine,
  // which is exactly as bad as it sounds.)
  const neckLen = proportions.neck;
  const neckTilt = 0.71;
  const nY = Math.cos(neckTilt);
  const nZ = Math.sin(neckTilt);
  const alongNeck = (t: number): [number, number, number] => [0, t * nY * H * neckLen, t * nZ * H * neckLen];
  parts.push({ bone: 'Neck', size: [0.17 * H, 0.24 * H, 0.21 * H], offset: alongNeck(0.06), color: body, rotation: [neckTilt, 0, 0] });
  parts.push({ bone: 'Neck', size: [0.15 * H, 0.22 * H, 0.185 * H], offset: alongNeck(0.24), color: body, rotation: [neckTilt, 0, 0] });
  parts.push({ bone: 'Neck', size: [0.13 * H, 0.2 * H, 0.16 * H], offset: alongNeck(0.4), color: body, rotation: [neckTilt, 0, 0] });

  // Head: long, narrow, and carried nose-down-and-forward — laid out along
  // its own axis rather than stacked, so the muzzle stays on the face.
  const headLen = proportions.headLen * H;
  const headTilt = 0.52; // nose below poll
  const hY = -Math.sin(headTilt);
  const hZ = Math.cos(headTilt);
  const alongHead = (t: number): [number, number, number] => [0, t * hY * H, t * hZ * H];
  parts.push({ bone: 'Head', size: [0.115 * H, 0.14 * H, headLen * 0.55], offset: alongHead(0.06), color: body, rotation: [headTilt, 0, 0] });
  parts.push({ bone: 'Head', size: [0.135 * H, 0.13 * H, 0.12 * H], offset: [0, -0.02 * H, 0.0], color: body }); // cheek
  parts.push({ bone: 'Head', size: [0.088 * H, 0.095 * H, headLen * 0.55], offset: alongHead(0.24), color: body, rotation: [headTilt, 0, 0] });
  // Muzzle: nose and lips are near-black on almost every coat.
  parts.push({ bone: 'Head', size: [0.082 * H, 0.075 * H, 0.06 * H], offset: alongHead(0.36), color: 0x241c18, rotation: [headTilt, 0, 0] });
  // Eyes, set on the SIDE of the head — prey animals look sideways.
  for (const s of [1, -1]) {
    parts.push({ bone: 'Head', size: [0.02 * H, 0.032 * H, 0.034 * H], offset: [s * 0.06 * H, -0.035 * H, 0.055 * H], color: 0x14100e });
  }
  // Ears: the donkey's are the point of the donkey.
  for (const s of [1, -1]) {
    parts.push({
      bone: 'Head',
      size: [0.028 * H, proportions.ear * H, 0.035 * H],
      offset: [s * 0.042 * H, 0.075 * H, -0.03 * H],
      color: points,
      rotation: [-0.15, 0, s * 0.18],
    });
  }
  // Face marking: a star, a stripe, or a full blaze down the front.
  if (marking !== 'none') {
    const long = marking === 'blaze' ? 0.24 : marking === 'stripe' ? 0.18 : 0.05;
    const wide = marking === 'blaze' ? 0.055 : 0.03;
    const at = alongHead(marking === 'star' ? 0.06 : 0.2);
    parts.push({
      bone: 'Head',
      size: [wide * H, 0.03 * H, long * H],
      offset: [0, at[1] + 0.035 * H, at[2] + 0.03 * H],
      color: 0xefe9df,
      rotation: [headTilt, 0, 0],
    });
  }

  // Mane: a run of slabs standing along the crest, plus a forelock.
  const maneCount = species === 'donkey' ? 5 : 9;
  for (let i = 0; i < maneCount; i++) {
    const t = 0.02 + (i / (maneCount - 1)) * 0.44;
    const at = alongNeck(t);
    parts.push({
      bone: 'Neck',
      size: [0.038 * H, 0.11 * H, 0.06 * H],
      offset: [0, at[1] + 0.085 * H, at[2] - 0.055 * H],
      color: coat.mane,
      rotation: [neckTilt, 0, jitter.range(-0.12, 0.12)],
    });
  }
  parts.push({ bone: 'Head', size: [0.055 * H, 0.06 * H, 0.06 * H], offset: [0, 0.05 * H, -0.03 * H], color: coat.mane });

  // Tail: a dock and a fall of hair. Donkeys get a tufted tail instead.
  parts.push({ bone: 'Tail', size: [0.07 * H, 0.1 * H, 0.08 * H], offset: [0, -0.03 * H, -0.02 * H], color: body });
  if (species === 'donkey') {
    parts.push({ bone: 'TailTip', size: [0.05 * H, 0.09 * H, 0.05 * H], offset: [0, 0.02 * H, 0], color: coat.mane });
  } else {
    parts.push({ bone: 'TailTip', size: [0.09 * H, 0.3 * H, 0.09 * H], offset: [0, 0.06 * H, -0.01 * H], color: coat.mane, rotation: [-0.3, 0, 0] });
  }
  // Dun and buckskin carry a dorsal stripe down the spine.
  if (coat.dorsal) {
    parts.push({ bone: 'Spine', size: [0.05 * H, 0.03 * H, 0.46 * H], offset: [0, 0.14 * H, 0.02 * H], color: coat.points });
  }

  // --- Legs ---------------------------------------------------------------
  // Thick at the top, fine at the cannon — a horse's leg is mostly tendon
  // below the knee, which is why the silhouette narrows so sharply.
  LEGS.forEach((leg, i) => {
    const front = isFront(leg);
    const s = legSide(leg);
    const thick = bone * H;
    const sock = socks[i] ?? false;
    const lower = sock ? 0xe7e1d6 : points;
    const upperColor = body;

    if (front) {
      // Shoulder blade over the top of the humerus, angled back.
      parts.push({ bone: `${leg}Upper` as QuadrupedBone, size: [0.075 * thick, 0.24 * H, 0.14 * H], offset: [s * 0.005 * H, 0.06 * H, 0.0], color: upperColor, rotation: [0.35, 0, 0] });
      parts.push({ bone: `${leg}Upper` as QuadrupedBone, size: [0.08 * thick, 0.19 * H, 0.11 * H], offset: [0, -0.09 * H, -0.025 * H], color: upperColor, rotation: [-0.28, 0, 0] });
      parts.push({ bone: `${leg}Lower` as QuadrupedBone, size: [0.068 * thick, 0.27 * H, 0.085 * H], offset: [0, -0.13 * H, 0.015 * H], color: upperColor, rotation: [0.11, 0, 0] });
      parts.push({ bone: `${leg}Cannon` as QuadrupedBone, size: [0.046 * thick, 0.19 * H, 0.052 * H], offset: [0, -0.095 * H, 0], color: lower });
    } else {
      // Gaskin and thigh: the heaviest muscle on the animal.
      parts.push({ bone: `${leg}Upper` as QuadrupedBone, size: [0.1 * thick, 0.24 * H, 0.17 * H], offset: [s * 0.005 * H, -0.09 * H, 0.04 * H], color: upperColor, rotation: [-0.42, 0, 0] });
      parts.push({ bone: `${leg}Lower` as QuadrupedBone, size: [0.085 * thick, 0.25 * H, 0.12 * H], offset: [0, -0.11 * H, -0.05 * H], color: upperColor, rotation: [0.4, 0, 0] });
      parts.push({ bone: `${leg}Cannon` as QuadrupedBone, size: [0.046 * thick, 0.24 * H, 0.052 * H], offset: [0, -0.12 * H, 0.01 * H], color: lower, rotation: [-0.08, 0, 0] });
    }
    // Fetlock, pastern and a hard hoof — always darker than the leg.
    parts.push({ bone: `${leg}Hoof` as QuadrupedBone, size: [0.055 * thick, 0.035 * H, 0.055 * H], offset: [0, 0.005 * H, 0], color: lower });
    // A white sock usually means a pale hoof under it — horn takes its
    // colour from the skin above.
    parts.push({ bone: `${leg}Hoof` as QuadrupedBone, size: [0.062 * thick, 0.035 * H, 0.07 * H], offset: [0, -0.018 * H, 0.008 * H], color: sock ? 0x9c9186 : 0x2e2622 });
  });

  // --- Merge into one skinned, vertex-coloured mesh ------------------------
  const positions: number[] = [];
  const normals: number[] = [];
  const vertexColors: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];
  const color = new Color();
  const boneIndex = new Map(ordered.map((b, i) => [b.name, i]));

  for (const part of parts) {
    const box = new BoxGeometry(...part.size);
    if (part.rotation) {
      box.rotateX(part.rotation[0]);
      box.rotateY(part.rotation[1]);
      box.rotateZ(part.rotation[2]);
    }
    const at = restWorld[part.bone];
    box.translate(part.offset[0] + at.x, part.offset[1] + at.y, part.offset[2] + at.z);
    const base = positions.length / 3;
    const pos = box.getAttribute('position');
    const nor = box.getAttribute('normal');
    color.setHex(part.color).offsetHSL(0, 0, jitter.range(-0.012, 0.012));
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
  mesh.name = `quadruped-${species}`;
  mesh.frustumCulled = false;
  mesh.add(bones.Hips);
  mesh.updateMatrixWorld(true);
  mesh.bind(new Skeleton(ordered));

  const object = new Group();
  object.name = `${species}-rig`;
  object.add(mesh);

  // Rider fixtures. The seat sits in the dip of the back behind the withers
  // — where a saddle actually goes — and the reins run to the mouth.
  const saddle = new Object3D();
  saddle.name = 'saddle';
  saddle.position.set(0, 0.13 * H, 0.06 * H);
  bones.Spine.add(saddle);
  const reins = new Object3D();
  reins.name = 'reins';
  reins.position.set(0, 0.06 * H, 0.3 * H);
  bones.Chest.add(reins);

  return {
    object,
    mesh,
    skeleton: mesh.skeleton,
    bones,
    height: H,
    bodyLength: 1.05 * H,
    legLength: 0.85 * H,
    saddle,
    reins,
    obstacleRadius: 0.42 * H,
    description: { seed, species, height: H, coat: coatName, marking, socks },
  };
}
