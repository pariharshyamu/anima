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
  measureClimbContact,
  type ClimbClipOptions,
  type ClimbContactReport,
} from './climb';
export {
  Parkour,
  canClear,
  chooseMove,
  createMove,
  gapAt,
  landingFor,
  measureParkourContact,
  reachOf,
  type ChooseOptions,
  type Gap,
  type LandingKind,
  type MoveName,
  type MoveOptions,
  type Obstacle,
  type ParkourContactReport,
  type ParkourListener,
  type ParkourMove,
  type ParkourOptions,
  type ParkourPhase,
  type Reach,
} from './parkour';
export {
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

// Guard — coverage is geometry, and reaction is a race against the wind-up.
export {
  Guard,
  GUARDS,
  GUARD_NAMES,
  GUARD_ZONES,
  SIMPLE_REACTION,
  CHOICE_REACTION,
  canReactTo,
  coverageOf,
  intercepts,
  reactionTime,
  zoneOf,
  zonePoint,
  type ActiveDefence,
  type Defence,
  type GuardName,
  type GuardOptions,
  type GuardSpec,
  type GuardZone,
} from './guard';

// Striking — the damage is a measurement, not a table.
export {
  Striking,
  STRIKES,
  STRIKE_NAMES,
  SEGMENT_MASS_TOTAL,
  bodyMass,
  centreOfMass,
  measureStrike,
  stability,
  strikeReach,
  type Blow,
  type StrikeName,
  type StrikeOptions,
  type StrikePath,
  type StrikePhase,
  type StrikeReport,
  type StrikeSpec,
  type StrikeSurface,
  type StrikingOptions,
} from './striking';

// Archery — the draw is a force, the anchor is a contact, the group is the metric.
export {
  Archery,
  BOWS,
  BOW_STYLES,
  arrowSpeed,
  elevationFor,
  groupAt,
  holdForce,
  maxRange,
  measureShot,
  quiverOf,
  type AnchorPoint,
  type ArcheryOptions,
  type BowSpec,
  type BowStyle,
  type DrawStyle,
  type Loose,
  type ShotOptions,
  type ShotPhase,
  type ShotReport,
} from './archery';

// Dining — the utensil is the mechanism, not the prop.
export {
  Dining,
  UTENSILS,
  UTENSIL_NAMES,
  measureBite,
  pourAngle,
  servings,
  type BiteEvent,
  type BiteOptions,
  type BiteReport,
  type Countable,
  type DiningOptions,
  type DiningPhase,
  type Utensil,
  type UtensilSpec,
} from './dining';

// Lifting — gym work. The first motion here that gets WORSE as it goes on.
export {
  Lifting,
  LIFTS,
  LIFT_NAMES,
  createLiftClip,
  measureBarPath,
  repsInReserve,
  type BarPathOptions,
  type BarPathReport,
  type LiftName,
  type LiftPhase,
  type LiftPlumb,
  type LiftSpec,
  type LiftingOptions,
  type RepReport,
} from './lifting';

// Mood — how a body carries whatever it is already doing. A layer, not a pose.
export {
  Mood,
  MOODS,
  MOOD_NAMES,
  MOOD_LIMIT,
  measurePosture,
  type MoodName,
  type MoodOptions,
  type MoodPoint,
  type PostureReport,
} from './mood';

// Grappling — a throw is a consequence of the balance, not a cutscene.
export {
  Grappling,
  KUZUSHI,
  KUZUSHI_DIRECTIONS,
  THROWS,
  THROW_NAMES,
  GRIP_TOLERANCE,
  MAX_LEAN,
  UKEMI_RELIEF,
  breakEffort,
  gripPoints,
  landingImpulse,
  measureThrow,
  weakestDirection,
  type BreakEffort,
  type Fulcrum,
  type GrapplePhase,
  type GrapplingOptions,
  type GripPair,
  type KuzushiDirection,
  type Landing,
  type ThrowEvent,
  type ThrowName,
  type ThrowReport,
  type ThrowSpec,
} from './grappling';

// Stance — a stance is where the feet are, not a pile of joint angles.
export {
  FIGHTING_STANCE,
  applyStance,
  holdStance,
  releaseStance,
  stanceDrop,
  stanceFeet,
  type StanceHold,
  type StanceShape,
} from './stance';
export { pointBone, solveLimb } from './limbik';

// FightStyle — a style is where the feet are, not a damage multiplier.
export {
  FightStyle,
  FIGHT_STYLES,
  FIGHT_STYLE_NAMES,
  STYLED_STRIKES,
  styleProfile,
  type FightStyleName,
  type FightStyleOptions,
  type FightStyleSpec,
  type StyleProfile,
} from './fightstyle';

// Sparring — the payoff: reach advantage emerges, nobody encodes it.
export {
  Bout,
  Fighter,
  ANAEROBIC_RESERVE,
  MUSCLE_EFFICIENCY,
  chooseStrike,
  measureBout,
  preferredGap,
  strikeCost,
  type BoutOptions,
  type BoutReport,
  type Exchange,
  type FighterOptions,
  type StrikeCard,
} from './sparring';

// Blade — a weapon is a mass distribution, and everything else is derived.
export {
  BALANCE_TOLERANCE,
  BLADES,
  BLADE_NAMES,
  DENSITIES,
  NODE_FRACTION,
  SOLID_ROUND,
  balanceFromCross,
  balancePoint,
  bladeExtension,
  bladeLength,
  bladeMass,
  inertia,
  measureBlade,
  pendulumPeriod,
  percussion,
  sectionAt,
  segmentMass,
  shiftBalance,
  tubeFill,
  vibrationNodes,
  withPommel,
  type BladeName,
  type BladeReport,
  type BladeSegment,
  type BladeSpec,
  type Material,
} from './blade';

// Cut — a hit is a pressure, and a pressure is a force over an area.
export {
  EDGES,
  EDGE_NAMES,
  TARGETS,
  TARGET_NAMES,
  bluntestThatBites,
  cutDepth,
  edgeArea,
  engagedLength,
  griffith,
  initiationForce,
  measureCut,
  measureThrust,
  pressure,
  propagationForce,
  tipArea,
  type CutInput,
  type CutReport,
  type EdgeName,
  type TargetName,
  type TargetSpec,
  type ThrustInput,
  type ThrustReport,
} from './cut';

// Bind — two blades in contact stop being two objects.
export {
  HAND_FORCE,
  PALM_SPAN,
  STEEL_FRICTION,
  TWO_HAND_SPAN,
  bindForce,
  bindSensitivity,
  bindsOrSlips,
  crossing,
  frictionAngle,
  gripSpan,
  handCouple,
  leverage,
  measureBind,
  wind,
  type BindOptions,
  type BindReport,
  type BladeLine,
  type Crossing,
  type Point as BindPoint,
} from './bind';

// Javelin — the object whose rules were changed to make it fly worse.
export {
  AIR_DENSITY,
  CROSSFLOW_DRAG,
  SKIN_FRICTION,
  aeroOf,
  ballisticRange,
  flyJavelin,
  staticMargin,
  type AeroBody,
  type ThrowOptions as JavelinThrowOptions,
  type ThrowReport as JavelinThrowReport,
  type ThrowState,
} from './javelin';

// Fencing — the armed bout, and it does not stand still.
export {
  Fence,
  Fencer,
  bladeTorque,
  cutTime,
  fencerBalance,
  fencerCard,
  footSpeed,
  measureOf,
  poseSwordArm,
  stepLength,
  stepTime,
  type FenceOptions,
  type FencePhase,
  type FencerCard,
  type FencerOptions,
  type Touch,
} from './fencing';

// Motion matching — and the weights turn out to be unit conversions.
export {
  FACING_RADIUS,
  MotionMatcher,
  buildMotionDatabase,
  froudeNumber,
  matchFrame,
  queryFeature,
} from './motion';
export type {
  MotionClipName,
  MotionDatabase,
  MotionDatabaseOptions,
  MotionFrame,
  MotionMatch,
  MotionMatcherOptions,
  MotionQuery,
} from './motion';

// Speech — visemes, and the observation that the IPA already is a viseme table.
export {
  ANTICIPATION,
  DOMINANCE,
  JAW_SPEED,
  JAW_TRAVEL,
  LIP_BRIDGE,
  PHONEMES,
  PHONEME_KEYS,
  REST,
  REST_WEIGHT,
  Speech,
  VISEMES,
  VISEME_NAMES,
  createMouth,
  mouthAt,
  mouthOf,
  syllableRate,
  utterance,
  LIVE_WINDOW,
  shapedUtterance,

  utteranceLength,
  visemeOf,
  type MouthProp,
  type MouthShape,
  type PhonemeSpec,
  type Segment,
  type LiveOptions,
  type MouthSource,
  type SpeechOptions,
} from './speech';

// Brows — a brow raise is PUNCTUATION before it is emotion (Ekman 1979), and
// about seven in ten of them land on a rise in F0 (Cavé et al. 1996). So the
// brow does not need a mood, it needs a pitch contour — and GAMA's
// `SpokenLine.pitchAt` has exactly the signature `PitchSource` asks for.
export {
  ACCENT_SEMITONES,
  BASELINE_TAU,
  BROW_FLASH,
  BROW_SPEED,
  BROW_TRAVEL,
  Brows,
  createBrows,
  type BrowOptions,
  type BrowProp,
  type BrowShape,
  type PitchSource,
} from './brows';

// Blinking — the rate is not a constant, it is what the agent is doing.
// Bentivoglio et al. (1997) counted 17 blinks a minute at rest, 4.5 reading and
// 26 in conversation: reading suppresses it to a quarter and talking nearly
// doubles it. And a blink is not symmetric — the lid falls in half the time it
// takes to come back up — and it rides the eye, because levator palpebrae and
// superior rectus share an origin.
export {
  APERTURE,
  BLINK_CLOSE,
  BLINK_OPEN,
  BLINK_RATE,
  BLINK_SECONDS,
  Blinking,
  GAZE_LID,
  LID_SPEED,
  createEyes,
  type BlinkOptions,
  type BlinkState,
  type BlinkTask,
  type EyeProp,
  type EyeShape,
} from './blink';



// Saccades — the eye is ballistic, and how fast it goes is not a choice.
// Bahill, Clark & Stark (1975) named the main sequence: amplitude alone
// predicts both the duration AND the peak velocity of a saccade. That is one
// law more than is needed to build one, which is what makes it checkable — the
// model uses the duration and the gate holds it to the velocity.
// Where it looks is Yarbus (1967): the scanpath is the question, not the
// picture, so the fixation times come out of Rayner's task table.
export {
  EYE_RADIUS,
  MICROSACCADE_AMPLITUDE,
  MICROSACCADE_RATE,
  ORBITAL_RANGE,
  PEAK_VELOCITY_MAX,
  SACCADE_INTERCEPT,
  SACCADE_SLOPE,
  SCAN,
  Saccades,
  VELOCITY_CONSTANT,
  irisOffset,
  saccadeDuration,
  type GazeAngles,
  type SaccadeOptions,
  type SaccadeState,
  type ScanTask,
} from './saccades';
