// ANIMA — professional humanoid characters & animation for three.js.
// GAMA makes it a game. SCENA gives it a world. ANIMA gives it people.

export { Rng } from './core/random';
export { OUTFITS, DEFAULT_OUTFIT, type OutfitPalette } from './palette';
export {
  createHumanoid,
  BONE_NAMES,
  type Accessory,
  type BoneName,
  type HumanoidOptions,
  type HumanoidRig,
} from './humanoid';
export { retargetClip, MIXAMO_MAP, type RetargetOptions } from './retarget';
export { getSocket, attach, type SocketName } from './sockets';
export {
  createLocomotionClips,
  type GaitOptions,
  type LocomotionClips,
} from './clips';
export {
  Locomotion,
  type LocomotionOptions,
  type OverlayOptions,
  type FootstepListener,
} from './locomotion';
export { FootIK, type FootIKOptions } from './ik';
export { LookAt, type LookAtOptions } from './lookAt';
export { maskClip, createWaveClip, UPPER_BODY } from './overlay';
