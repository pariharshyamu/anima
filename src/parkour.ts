import { AnimationAction, AnimationClip, AnimationMixer, Quaternion, Vector3 } from 'three';
import { buildClip, Pose } from './clips';
import type { Object3D } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';
import { chainLengths, restDirection, solveChain, toParentFrame } from './solve';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
/** Rise and fall, 0 at both ends, 1 in the middle. */
const arch = (t: number): number => Math.sin(Math.PI * clamp01(t));
/** Ease a value across a window, flat outside it. */
const ramp = (p: number, from: number, to: number): number =>
  smooth(clamp01((p - from) / Math.max(1e-6, to - from)));

/**
 * What a body can do, in metres, derived from the body.
 *
 * Every parkour system in every engine warps authored mocap toward the
 * obstacle. ANIMA has no mocap — its clips are functions of the rig — and
 * `createHumanoid` makes bodies with genuinely different proportions. So the
 * move set is derived from **reach** instead, and a 1.55 m character and a
 * 1.9 m one make different choices at the same wall for free.
 *
 * The ratios are anthropometric: knee at 0.285 of stature, hip 0.53, shoulder
 * 0.82, fingertips overhead 1.20. They are averages, and they are applied to
 * the rig's own height and leg length rather than to a constant.
 */
export interface Reach {
  /** Step up without hands — knee height. */
  step: number;
  /** Plant a hand and swing the legs over — hip height. */
  vault: number;
  /** Chest to the top and press up — shoulder height. */
  mantle: number;
  /** Jump, catch the lip, hang, top out — standing reach. */
  catch: number;
  /** Running jump, flat. Scales with approach speed at `gapAt`. */
  gap: number;
}

export function reachOf(rig: HumanoidRig): Reach {
  const h = rig.height;
  // Leg length is published and varies independently of height, so the two
  // low bands come from the legs and the two high ones from stature.
  const knee = rig.legLength * 0.52;
  return {
    step: knee,
    vault: h * 0.53,
    mantle: h * 0.82,
    catch: h * 1.2,
    gap: h * 0.9,
  };
}

/** How far this body can clear at a given approach speed, in metres. */
export function gapAt(reach: Reach, speed: number): number {
  // Arcade, and deliberately: a standing jump is about nine tenths of your
  // height and a running one roughly doubles it. Anything past that is
  // ballistics nobody can aim.
  return reach.gap * (0.55 + 0.22 * Math.max(0, speed));
}

/**
 * Something to get over or onto.
 *
 * A shape, not a package — SCENA's railings, crates, walls and parapets all
 * satisfy it, and so does an object literal. **ANIMA does not raycast**:
 * finding the obstacle is the game's job, exactly as terrain height is.
 */
export interface Obstacle {
  /**
   * World anchor on the near edge of the top surface, +z facing the way the
   * runner approaches. Everything else is measured from here.
   */
  edge: Object3D;
  /** Top surface above the ground the runner is standing on. */
  height: number;
  /** Front-to-back: a rail is thin, a wall is deep. Decides vault vs mantle. */
  depth: number;
  /** Drop on the far side, if it differs from `height`. */
  landing?: number;
}

export type MoveName = 'step' | 'safety-vault' | 'speed-vault' | 'mantle';

export interface ChooseOptions {
  /** Approach speed, m/s. Default 0 — standing at the obstacle. */
  speed?: number;
  /**
   * Deepest obstacle a vault will attempt, in metres. Default 0.75.
   *
   * You cannot swing your legs over something you cannot span; past this the
   * answer is a mantle onto it, not a vault across it.
   */
  vaultDepth?: number;
}

/**
 * Which move fits this obstacle for this body — or `null`.
 *
 * The `null` matters as much as the moves. A system that always finds
 * something will put a character through a wall, and the honest answer to a
 * two-metre wall is that this person is not getting over it.
 */
export function chooseMove(
  obstacle: Pick<Obstacle, 'height' | 'depth'>,
  reach: Reach,
  options: ChooseOptions = {}
): MoveName | null {
  const speed = options.speed ?? 0;
  const vaultDepth = options.vaultDepth ?? 0.75;
  const { height, depth } = obstacle;
  if (height <= 0) return null;
  // Low enough to walk onto: no hands, whatever the depth.
  if (height <= reach.step) return 'step';
  // Hip-high and narrow enough to span, and actually moving: vault it. A
  // vault from a standstill is a gymnastic move, not a parkour one.
  if (height <= reach.vault && depth <= vaultDepth && speed >= 1.2) {
    return speed >= 3 ? 'speed-vault' : 'safety-vault';
  }
  // Anything up to shoulder height can be climbed onto from a stand.
  if (height <= reach.mantle) return 'mantle';
  return null;
}

/** A limb pinned to a point on the obstacle for part of the move. */
interface Contact {
  bone: BoneName;
  side: 'Left' | 'Right';
  arm: boolean;
  /** Where it holds, in the edge frame: +z past the edge, y up from the top. */
  at: Vector3;
  /** Phase window it is planted for. */
  from: number;
  to: number;
}

interface MoveSpec {
  duration: number;
  /** Body root position in the edge frame, as a function of phase. */
  travel: (p: number, h: number, d: number, land: number, rig: HumanoidRig) => Vector3;
  /** Body yaw, radians. */
  turn: (p: number) => number;
  contacts: (h: number, d: number, land: number, rig: HumanoidRig) => Contact[];
  /** Everything that is not a contact: the swinging limbs and the torso. */
  pose: (p: number, pose: Pose, rig: HumanoidRig) => void;
}

const SPECS: Record<MoveName, MoveSpec> = {
  step: {
    duration: 0.95,
    travel: (p, h, _d, _land, rig) => {
      // Ends ABOVE the planted foot: you rise over the step, you do not walk
      // past it. Carrying the body 0.4 m beyond left the leg reaching down and
      // BACKWARDS at 106% of its length — measured as 72 mm of contact error.
      const forward = -0.44 + ramp(p, 0.1, 0.95) * 0.62;
      const up = -h + ramp(p, 0.36, 0.9) * h;
      // Riding up over the planted foot: the hips lift a touch past the step.
      return new Vector3(0, up + arch(ramp(p, 0.4, 1)) * 0.03 * rig.height, forward);
    },
    turn: () => 0,
    contacts: (h, _d, _land, rig) => [
      // The leading foot arrives on the top and does not move again.
      {
        bone: 'RightFoot',
        side: 'Right',
        arm: false,
        at: new Vector3(0.09 * rig.height, 0, 0.15),
        from: 0.3,
        to: 0.93,
      },
    ],
    pose: (p, pose, rig) => {
      const rise = ramp(p, 0.4, 0.95);
      pose.rotate('Hips', [X, 0.16 - 0.12 * rise]);
      pose.rotate('Spine', [X, 0.1 - 0.08 * rise]);
      pose.rotate('Chest', [X, 0.06]);
      pose.rotate('Head', [X, -0.1 + 0.08 * rise]);
      // Arms counterswing; a step up is not a hands-on move.
      const swing = arch(p);
      pose.rotate('LeftArm', [Z, 1.25 - 0.5 * swing], [Y, -0.35 * swing]);
      pose.rotate('LeftForeArm', [Z, 0.35 + 0.5 * swing]);
      pose.rotate('RightArm', [Z, -1.25 + 0.35 * swing], [Y, 0.25 * swing]);
      pose.rotate('RightForeArm', [Z, -0.3 - 0.35 * swing]);
      void rig;
    },
  },

  'safety-vault': {
    duration: 0.85,
    travel: (p, h, d, land, rig) => {
      const forward = -0.72 + ramp(p, 0, 1) * (d + 1.2);
      const over = arch(ramp(p, 0.05, 0.95));
      // Clear the top by a hip's worth, then drop to the far side.
      const up = -h + over * (h - 0.24 * rig.height) - ramp(p, 0.62, 1) * land;
      return new Vector3(0, up, forward);
    },
    turn: (p) => -0.5 * arch(ramp(p, 0.1, 0.9)),
    contacts: (h, _d, _land, rig) => [
      // One hand takes the weight; one foot brushes the top going over. That
      // is what makes it the SAFE vault rather than the showy one.
      {
        bone: 'LeftHand',
        side: 'Left',
        arm: true,
        at: new Vector3(-0.13 * rig.height, 0, 0.05),
        from: 0.2,
        to: 0.66,
      },
      {
        bone: 'RightFoot',
        side: 'Right',
        arm: false,
        at: new Vector3(0.1 * rig.height, 0, 0.16),
        from: 0.4,
        to: 0.58,
      },
    ],
    pose: (p, pose, rig) => {
      const over = arch(ramp(p, 0.05, 0.95));
      const land = ramp(p, 0.7, 1);
      // Folded hard over the planted hand. Standing upright, a 1.77 m body's
      // shoulder is 0.6 m above an 0.85 m wall and the arm is 0.50 m long —
      // the hand simply cannot reach the top until the torso comes down.
      pose.rotate('Hips', [X, 0.95 * over + 0.25 * land]);
      pose.rotate('Spine', [X, 0.45 * over]);
      pose.rotate('Chest', [X, 0.28 * over], [Y, 0.2 * over]);
      pose.rotate('Head', [X, -0.16 - 0.1 * over]);
      // The free arm swings across the body as the hips pass over.
      pose.rotate('RightArm', [Z, -0.9 + 0.6 * over], [Y, 0.7 * over]);
      pose.rotate('RightForeArm', [Z, -0.5 - 0.3 * over]);
      void rig;
    },
  },

  'speed-vault': {
    duration: 0.66,
    travel: (p, h, d, land, rig) => {
      const forward = -0.9 + ramp(p, 0, 1) * (d + 1.9);
      const over = arch(ramp(p, 0.05, 0.95));
      const up = -h + over * (h - 0.22 * rig.height) - ramp(p, 0.6, 1) * land;
      return new Vector3(0, up, forward);
    },
    // Side-on: both legs go through together past the planted hand.
    turn: (p) => -1.0 * arch(ramp(p, 0.05, 0.95)),
    contacts: (h, _d, _land, rig) => [
      {
        bone: 'LeftHand',
        side: 'Left',
        arm: true,
        at: new Vector3(-0.12 * rig.height, 0, 0.04),
        from: 0.16,
        to: 0.6,
      },
    ],
    pose: (p, pose, rig) => {
      const over = arch(ramp(p, 0.05, 0.95));
      const land = ramp(p, 0.68, 1);
      pose.rotate('Hips', [X, 1.0 * over + 0.3 * land], [Y, -0.25 * over]);
      pose.rotate('Spine', [X, 0.5 * over]);
      pose.rotate('Chest', [X, 0.3 * over], [Y, 0.28 * over]);
      pose.rotate('Head', [X, -0.2]);
      pose.rotate('RightArm', [Z, -1.0 + 0.75 * over], [Y, 0.9 * over]);
      pose.rotate('RightForeArm', [Z, -0.4 - 0.4 * over]);
      // Both legs tuck through together — the tell of a speed vault.
      const tuck = arch(ramp(p, 0.15, 0.85));
      for (const side of ['Left', 'Right'] as const) {
        pose.rotate(`${side}UpLeg`, [X, -1.15 * tuck], [Z, (side === 'Left' ? 1 : -1) * 0.12]);
        pose.rotate(`${side}Leg`, [X, 1.5 * tuck]);
        pose.rotate(`${side}Foot`, [X, -0.25 * tuck]);
      }
      void rig;
    },
  },

  mantle: {
    duration: 1.35,
    travel: (p, h, _d, _land, rig) => {
      // The hands can only hold through about an arm's worth of rise; the
      // rest comes from the leg that gets onto the top. Pressing down and
      // hopping IS the move on anything below shoulder height.
      const forward = -0.34 + ramp(p, 0.05, 0.5) * 0.3 + ramp(p, 0.55, 1) * 0.42;
      const up = -h + ramp(p, 0.12, 0.5) * (h * 0.35) + ramp(p, 0.45, 0.95) * (h * 0.65);
      void rig;
      return new Vector3(0, up, forward);
    },
    turn: () => 0,
    contacts: (h, _d, _land, rig) => [
      // Both hands on the lip, the body hauled up between them, then a knee
      // over and the hands released. Skip the release and the arms end up
      // behind the character like a marionette's strings.
      {
        bone: 'LeftHand',
        side: 'Left',
        arm: true,
        at: new Vector3(-0.13 * rig.height, 0.01, 0.04),
        from: 0.08,
        to: 0.5,
      },
      {
        bone: 'RightHand',
        side: 'Right',
        arm: true,
        at: new Vector3(0.13 * rig.height, 0.01, 0.04),
        from: 0.08,
        to: 0.44,
      },
      {
        bone: 'RightFoot',
        side: 'Right',
        arm: false,
        at: new Vector3(0.1 * rig.height, 0, 0.22),
        from: 0.4,
        to: 0.95,
      },
    ],
    pose: (p, pose, rig) => {
      const pull = ramp(p, 0.08, 0.5);
      const stand = ramp(p, 0.5, 1);
      pose.rotate('Hips', [X, 0.85 * pull - 0.9 * stand]);
      pose.rotate('Spine', [X, 0.4 * pull - 0.42 * stand]);
      pose.rotate('Chest', [X, 0.25 * pull - 0.26 * stand]);
      pose.rotate('Head', [X, -0.28 + 0.2 * stand]);
      void rig;
    },
  },
};

export interface MoveOptions {
  /** Keyframe rate. Default 30, as everywhere else in ANIMA. */
  fps?: number;
  /** Override the move's duration, seconds. */
  duration?: number;
}

/**
 * A parkour move, ready to play and ready to measure.
 *
 * `clip` poses the limbs and `travel`/`turn` move the root, and the two are
 * one thing: the clip was solved against that exact trajectory, so a caller
 * who plays the clip and drives the root differently gets hands that pass
 * through the wall. `Parkour` drives both from here; so does the gate.
 */
export interface ParkourMove {
  name: MoveName;
  clip: AnimationClip;
  duration: number;
  /** Root position at phase 0..1, in the obstacle's edge frame. */
  travel(p: number, out?: Vector3): Vector3;
  /** Root yaw at phase 0..1, radians. */
  turn(p: number): number;
  /** Where the body ends up, in the edge frame. */
  end: Vector3;
}

/**
 * Build a move for this body and this obstacle.
 *
 * Contacts are SOLVED, not posed. While a hand is on the wall its target in
 * the edge frame is fixed, so the arm is solved to `contact − travel(p)` every
 * frame and the hand does not move in the world at all — the same trick the
 * ladder climb uses on rungs, and the reason `measureParkourContact` reads
 * millimetres rather than centimetres.
 */
export function createMove(
  rig: HumanoidRig,
  name: MoveName,
  obstacle: Pick<Obstacle, 'height' | 'depth' | 'landing'>,
  options: MoveOptions = {}
): ParkourMove {
  const spec = SPECS[name];
  const duration = options.duration ?? spec.duration;
  const h = obstacle.height;
  const d = obstacle.depth;
  const land = (obstacle.landing ?? obstacle.height) - obstacle.height;
  // The bone a foot contact drives is the ANKLE, which stands an ankle's
  // height above the surface. Aim at the surface itself and the solve tries to
  // push the foot through it, or gives up and clamps — measured as every move
  // reporting a stretch of exactly 1.000.
  const contacts = contactsFor(rig, name, { height: h, depth: d, landing: obstacle.landing });

  const travelAt = (p: number, out = new Vector3()): Vector3 =>
    out.copy(spec.travel(p, h, d, land, rig));
  const turnAt = (p: number): number => spec.turn(p);

  const rest = new Map<BoneName, Quaternion>();
  for (const key of Object.keys(rig.bones) as BoneName[]) {
    rest.set(key, rig.bones[key].quaternion.clone());
  }
  const restHipsY = rig.bones.Hips.position.y;
  const restPos = rig.object.position.clone();
  const restQuat = rig.object.quaternion.clone();

  const root = new Vector3();
  const target = new Vector3();
  const pole = new Vector3();

  const clip = buildClip(rig, `parkour-${name}`, duration, options.fps ?? 30, (p, pose: Pose) => {
    pose.hipsY = restHipsY;
    // Every limb gets a baseline pose FIRST, before the move styles it and
    // before contacts override it. `buildClip` discovers which bones the clip
    // animates from frame 0 alone, so a bone that is only posed once a contact
    // becomes active never gets a track — the solve is computed and thrown
    // away, which is exactly what happened here: 1.8 m of "slip" from a hand
    // that was never being driven at all.
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      pose.rotate(`${side}Arm`, [Z, s * 1.25], [Y, -s * 0.1]);
      pose.rotate(`${side}ForeArm`, [Z, s * 0.3]);
      pose.rotate(`${side}UpLeg`, [X, -0.08], [Z, s * 0.05]);
      pose.rotate(`${side}Leg`, [X, 0.16]);
      pose.rotate(`${side}Foot`, [X, -0.08]);
    }
    spec.pose(p, pose, rig);

    // Stand the rig exactly where the controller will, THEN solve. Contacts
    // are world points; without this the solve is against a body that is not
    // where the body is.
    travelAt(p, root);
    rig.object.position.copy(root);
    rig.object.quaternion.setFromAxisAngle(Y, turnAt(p));
    for (const [key, q] of rest) rig.bones[key].quaternion.copy(q);
    for (const [key, q] of pose.rotations) rig.bones[key].quaternion.copy(q);
    rig.bones.Hips.position.y = pose.hipsY;
    rig.object.updateWorldMatrix(true, true);

    for (const contact of contacts) {
      if (p < contact.from || p > contact.to) continue;
      const s = contact.side === 'Left' ? 1 : -1;
      const rootBone: BoneName = contact.arm ? `${contact.side}Arm` : `${contact.side}UpLeg`;
      const midBone: BoneName = contact.arm ? `${contact.side}ForeArm` : `${contact.side}Leg`;
      const from = rig.bones[rootBone].getWorldPosition(new Vector3());
      target.copy(contact.at);
      // Elbows out and down; knees forward. Without a pole the solve is a
      // cone of valid answers and the joint wanders between frames.
      if (contact.arm) pole.set(s, -0.9, -0.25).normalize();
      else pole.set(0, -0.35, 1).normalize();
      const [l1, l2] = chainLengths(rig, contact.side, contact.arm);
      const solved = solveChain(from, target, restDirection(contact.side, contact.arm), l1, l2, pole);
      pose.set(rootBone, toParentFrame(rig, rootBone, solved.root));
      pose.set(midBone, solved.joint);
      if (!contact.arm) pose.rotate(`${contact.side}Foot`, [X, -0.2]);
    }
  });

  for (const [key, q] of rest) rig.bones[key].quaternion.copy(q);
  rig.bones.Hips.position.y = restHipsY;
  rig.object.position.copy(restPos);
  rig.object.quaternion.copy(restQuat);
  rig.object.updateWorldMatrix(true, true);

  return {
    name,
    clip,
    duration,
    travel: travelAt,
    turn: turnAt,
    end: travelAt(1),
  };
}

/** The contact set a move actually solves against, ankle offset included. */
function contactsFor(
  rig: HumanoidRig,
  name: MoveName,
  obstacle: Pick<Obstacle, 'height' | 'depth' | 'landing'>
): Contact[] {
  rig.object.updateWorldMatrix(true, true);
  const ankle =
    rig.bones.LeftUpLeg.getWorldPosition(new Vector3()).y -
    rig.bones.LeftFoot.getWorldPosition(new Vector3()).y;
  const ankleLift = rig.bones.LeftUpLeg.position.y + rig.bones.Hips.position.y - ankle;
  return SPECS[name]
    .contacts(
      obstacle.height,
      obstacle.depth,
      (obstacle.landing ?? obstacle.height) - obstacle.height,
      rig
    )
    .map((c) => (c.arm ? c : { ...c, at: c.at.clone().setY(c.at.y + ankleLift) }));
}

export interface ParkourContactReport {
  /** Peak wander of a planted limb from its contact point, in metres. */
  contactSlip: number;
  /**
   * Deepest any planted limb sinks BELOW the top surface, in metres.
   *
   * A hand inside the wall is the tell that kills the whole illusion, and it
   * is invisible from every camera angle that does not happen to graze the
   * surface.
   */
  penetration: number;
  /** Worst limb extension. 1.0 is the solve clamping rather than reaching. */
  stretch: number;
  /** Contacts that were actually planted at some point in the move. */
  planted: number;
  samples: number;
}

/**
 * Do the hands and feet land where the move says they do?
 *
 * The parkour form of `measureFootSkate` and `measureClimbContact`: drive the
 * clip through a real `AnimationMixer` on a rig placed by the move's own
 * trajectory, and watch the world positions of the limbs that are supposed to
 * be planted.
 */
export function measureParkourContact(
  rig: HumanoidRig,
  name: MoveName,
  obstacle: Pick<Obstacle, 'height' | 'depth' | 'landing'>,
  options: MoveOptions & { samples?: number } = {}
): ParkourContactReport {
  const samples = options.samples ?? 180;
  const move = createMove(rig, name, obstacle, options);
  const contacts = contactsFor(rig, name, obstacle);
  const mixer = new AnimationMixer(rig.object);
  mixer.clipAction(move.clip).play();

  const restPos = rig.object.position.clone();
  const restQuat = rig.object.quaternion.clone();
  const seen = new Map<Contact, Vector3[]>();
  let stretch = 0;
  let penetration = 0;
  const here = new Vector3();

  for (let i = 0; i <= samples; i++) {
    const p = i / samples;
    mixer.setTime(p * move.duration);
    rig.object.position.copy(move.travel(p));
    rig.object.quaternion.setFromAxisAngle(Y, move.turn(p));
    rig.object.updateWorldMatrix(true, true);

    for (const contact of contacts) {
      const rootBone: BoneName = contact.arm ? `${contact.side}Arm` : `${contact.side}UpLeg`;
      const [l1, l2] = chainLengths(rig, contact.side, contact.arm);
      const d = rig.bones[rootBone]
        .getWorldPosition(new Vector3())
        .distanceTo(rig.bones[contact.bone].getWorldPosition(here));
      if (p >= contact.from && p <= contact.to) {
        stretch = Math.max(stretch, d / (l1 + l2));
        const w = rig.bones[contact.bone].getWorldPosition(new Vector3());
        if (!seen.has(contact)) seen.set(contact, []);
        seen.get(contact)!.push(w);
        // Below the top surface AND within the obstacle's footprint is inside
        // it; below the top out in front of the edge is just the ground.
        if (w.z > -0.02 && w.z < obstacle.depth + 0.02) {
          penetration = Math.max(penetration, -w.y);
        }
      }
    }
  }
  mixer.stopAllAction();
  rig.object.position.copy(restPos);
  rig.object.quaternion.copy(restQuat);
  rig.object.updateWorldMatrix(true, true);

  let contactSlip = 0;
  for (const [contact, track] of seen) {
    for (const w of track) contactSlip = Math.max(contactSlip, w.distanceTo(contact.at));
  }
  return { contactSlip, penetration, stretch, planted: seen.size, samples };
}

export type ParkourPhase = 'idle' | 'moving' | 'done';
export type ParkourListener = (move: MoveName) => void;

export interface ParkourOptions {
  /** Deepest obstacle a vault will attempt. Default 0.75 m. */
  vaultDepth?: number;
}

/**
 * The one-shot driver: pick a move, play it, put the body down on the far side.
 *
 * It owns the root for the duration and nothing else does — `busy` is the
 * handshake, and a game that keeps steering through a vault will fight it.
 * That is the same contract `Climb` uses, for the same reason.
 */
export class Parkour {
  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private readonly reach: Reach;
  private readonly vaultDepth: number;
  private readonly starts = new Set<ParkourListener>();
  private readonly ends = new Set<ParkourListener>();
  private move: ParkourMove | null = null;
  private obstacle: Obstacle | null = null;
  private action: AnimationAction | null = null;
  private t = 0;
  private phase: ParkourPhase = 'idle';
  private readonly world = new Vector3();
  private readonly quat = new Quaternion();

  constructor(
    rig: HumanoidRig,
    loco: Locomotion,
    options: ParkourOptions = {}
  ) {
    this.rig = rig;
    this.loco = loco;
    this.reach = reachOf(rig);
    this.vaultDepth = options.vaultDepth ?? 0.75;
  }

  get busy(): boolean {
    return this.phase === 'moving';
  }

  get state(): ParkourPhase {
    return this.phase;
  }

  /** What this body would do here, without doing it. */
  choose(obstacle: Obstacle, speed = 0): MoveName | null {
    return chooseMove(obstacle, this.reach, { speed, vaultDepth: this.vaultDepth });
  }

  onStart(listener: ParkourListener): () => void {
    this.starts.add(listener);
    return () => this.starts.delete(listener);
  }

  onFinish(listener: ParkourListener): () => void {
    this.ends.add(listener);
    return () => this.ends.delete(listener);
  }

  /** Attempt the obstacle. Returns the move chosen, or `null` if it cannot. */
  attempt(obstacle: Obstacle, speed = 0): MoveName | null {
    if (this.busy) return null;
    const name = this.choose(obstacle, speed);
    if (!name) return null;
    this.obstacle = obstacle;
    this.move = createMove(this.rig, name, obstacle);
    this.t = 0;
    this.phase = 'moving';
    this.action = this.loco.overlay(this.move.clip, { loop: false, fadeIn: 0.12 });
    this.loco.influence = 0;
    for (const listener of [...this.starts]) listener(name);
    return name;
  }

  update(dt: number): void {
    if (!this.move || !this.obstacle || this.phase !== 'moving') return;
    this.t = Math.min(this.move.duration, this.t + dt);
    const p = this.t / this.move.duration;

    // Place the body by the move's own trajectory, expressed in the
    // obstacle's frame — the same frame the contacts were solved in.
    const edge = this.obstacle.edge;
    edge.updateWorldMatrix(true, false);
    this.move.travel(p, this.world);
    edge.localToWorld(this.world);
    this.rig.object.position.copy(this.world);
    edge.getWorldQuaternion(this.quat);
    this.rig.object.quaternion.copy(this.quat).multiply(
      new Quaternion().setFromAxisAngle(Y, this.move.turn(p))
    );

    if (p >= 1) {
      const name = this.move.name;
      if (this.action) this.loco.stopOverlay(this.action, 0.18);
      this.action = null;
      this.phase = 'done';
      this.loco.influence = 1;
      for (const listener of [...this.ends]) listener(name);
    }
  }

  /** Ready for the next obstacle. */
  reset(): void {
    this.phase = 'idle';
    this.move = null;
    this.obstacle = null;
    this.loco.influence = 1;
  }
}
