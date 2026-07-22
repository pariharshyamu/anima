// ANIMA — professional humanoid characters & animation for three.js.
// GAMA makes it a game. SCENA gives it a world. ANIMA gives it people.

export { Rng } from './core/random';
export { OUTFITS, DEFAULT_OUTFIT, type OutfitPalette } from './palette';
export {
  createHumanoid,
  BONE_NAMES,
  type BoneName,
  type HumanoidOptions,
  type HumanoidRig,
} from './humanoid';
export {
  createLocomotionClips,
  type GaitOptions,
  type LocomotionClips,
} from './clips';
export { Locomotion, type LocomotionOptions } from './locomotion';
