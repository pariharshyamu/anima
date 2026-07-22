// ANIMA — professional humanoid characters & animation for three.js.
// GAMA makes it a game. SCENA gives it a world. ANIMA gives it people.

export { Rng } from './core/random';
export { OUTFITS, DEFAULT_OUTFIT, type OutfitPalette } from './palette';
export {
  createHumanoid,
  describeHumanoid,
  BONE_NAMES,
  type Accessory,
  type BodyType,
  type BodyTypeParams,
  type BoneName,
  type BottomGarment,
  type ColorOptions,
  type FaceOptions,
  type HairStyle,
  type HumanoidOptions,
  type HumanoidRig,
  type ResolvedHumanoid,
  type TopGarment,
  type WardrobeOptions,
} from './humanoid';
export { retargetClip, MIXAMO_MAP, type RetargetOptions } from './retarget';
export { getSocket, attach, type SocketName } from './sockets';
export { bakeVAT, Crowd, type VATData, type CrowdOptions, type RouteOptions } from './vat';
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
