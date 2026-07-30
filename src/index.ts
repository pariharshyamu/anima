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
// Foot skate as a NUMBER. Sliding feet are the loudest tell of a procedural
// character and the one thing no screenshot or unit test can see.
export {
  measureFootSkate,
  type FootSkateOptions,
  type FootSkateReport,
  type SkateRig,
} from './skate';
export {
  Locomotion,
  type LocomotionOptions,
  type OverlayOptions,
  type FootstepListener,
} from './locomotion';
export { FootIK, type FootIKOptions } from './ik';
export { LookAt, type LookAtOptions } from './lookAt';
export { maskClip, createWaveClip, createReachClip, UPPER_BODY } from './overlay';
export {
  Carry,
  createCarryClip,
  type CarryStyle,
  type Holdable,
  type CarryOptions,
  type PutDownOptions,
} from './carry';
export {
  Interaction,
  Gesture,
  createPoseClip,
  createLoopClip,
  GRIPS,
  type InteractionSlot,
  type PoseName,
  type LoopName,
  type UseOptions,
  type GestureOptions,
  type InteractionPhase,
} from './interact';
export {
  Mannerisms,
  type MannerismName,
  type MannerismContext,
  type MannerismsOptions,
} from './mannerisms';
export { Reactions, type ReactionsOptions } from './reactions';
export {
  Dance,
  DANCE_MOVES,
  DANCE_STYLES,
  type DanceMove,
  type DanceStyle,
  type RoutineStep,
  type DanceOptions,
  type DancePulse,
} from './dance';
export {
  Cricketer,
  createBowlClip,
  createShotClip,
  createKeepClip,
  createStanceClip,
  createThrowClip,
  swingAt,
  SHOTS,
  SWINGS,
  STANCE_KEY,
  RELEASE_PHASE,
  CONTACT_PHASE,
  type Shot,
  type SwingKey,
  type SwingSpec,
  type CricketAction,
  type CricketerOptions,
} from './cricket';
export { Couple, type CoupleOptions } from './couple';
export { Cypher, type CypherOptions } from './cypher';
export {
  Asana,
  ASANAS,
  ASANA_NAMES,
  SURYA_NAMASKAR,
  strikePose,
  type AsanaName,
  type AsanaSpec,
  type AsanaSupport,
  type AsanaOptions,
  type FlowStep,
} from './asana';
export { YogaClass, type YogaClassOptions } from './yogaclass';
export {
  Conversation,
  type Talker,
  type ConversationOptions,
} from './conversation';
export {
  createQuadruped,
  LEGS,
  COATS,
  QUADRUPED_BONES,
  isFront,
  legSide,
  type LegName,
  type QuadrupedBone,
  type QuadrupedRig,
  type QuadrupedOptions,
  type QuadrupedSpecies,
  type CoatName,
  type FaceMarking,
} from './quadruped';
export {
  createGaitClips,
  gaitSpeed,
  QuadrupedLocomotion,
  GAITS,
  type GaitName,
  type GaitSpec,
  type QuadrupedClips,
  type GaitOptions as QuadrupedGaitOptions,
  type QuadrupedLocomotionOptions,
} from './gaits';
export {
  Mount,
  createRideClip,
  type RideSeat,
  type MountPhase,
  type MountOptions,
  type RideClipOptions,
} from './riding';
export {
  Climb,
  createClimbClip,
  createTopOutClip,
  type Climbable,
  type ClimbState,
  type ClimbOptions,
} from './climb';
export { Watching, type Viewable, type WatchingOptions } from './watching';
export {
  PhoneUse,
  createPhoneClip,
  createGlanceClip,
  type PhonePose,
  type PhoneUseOptions,
  type Handheld,
} from './phone';
export {
  DeskWork,
  createDeskClip,
  type DeskTask,
  type DeskWorkOptions,
} from './desk';
export {
  Washing,
  createWashClip,
  type WashTask,
  type WashingOptions,
} from './wash';
export {
  Swimming,
  createStrokeClip,
  createWadeClip,
  type Stroke,
  type SwimState,
  type SwimOptions,
  type WaterBody,
} from './swim';
export {
  Prepping,
  createPrepClip,
  type PrepTask,
  type PreppingOptions,
} from './prep';
export { SeaLegs, type SeaLegsOptions, type Deck } from './sealegs';
export { Cockpit, type CockpitOptions, type Airframe } from './cockpit';
export {
  Rowing,
  rowGripAt,
  ROW_GRIP,
  type RowingOptions,
  type RowStyle,
} from './rowing';
