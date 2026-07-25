import { AnimationAction, AnimationClip, Object3D, Vector3 } from 'three';
import { buildClip } from './clips';
import { maskClip } from './overlay';
import { Rng } from './core/random';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

/**
 * Using a phone.
 *
 * The prop is a few pixels across at any camera distance you would actually
 * film from, so the **pose does all the work**. You do not read "she is on
 * her phone" off the handset; you read it off the head angle, the rounded
 * shoulders and the one forearm held up at the chest — and you read it from
 * across a street.
 *
 * ```ts
 * const phone = new PhoneUse(rig, loco);
 * phone.hold(createPhone());     // anything with { object }
 * phone.use('scroll');
 * game.onUpdate((t) => {
 *   loco.update(t.delta, velocity.multiplyScalar(phone.walkScale));
 *   phone.update(t.delta);
 * });
 * ```
 *
 * Every pose here is an upper-body mask overlaid on whatever the legs are
 * doing, so walking-while-texting is the same code as standing-while-texting
 * with a different velocity. That is also why the head angle is baked into
 * the clips rather than driven by `LookAt`: a gaze target held in the
 * character's own hand is inside `LookAt`'s minimum distance, and looking at
 * your own phone is a fixed posture anyway, not a tracking behaviour.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;
/** The arm's frontal-plane angle when hanging at the side. */
const HANG = Math.PI / 2 - 0.14;

const _eyes = new Vector3();
const _at = new Vector3();
const _look = new Vector3();

/** See `use()` — a masked pose has to out-weigh the idle clip it blends with. */
const POSE_WEIGHT = 6;

const UPPER: BoneName[] = [
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
];

/** What someone is doing with it. */
export type PhonePose =
  /** One hand, at the chest, thumb working. The default posture. */
  | 'scroll'
  /** Both hands up, thumbs going. */
  | 'type'
  /** To the ear. */
  | 'call'
  /** Both arms out, framing a shot. */
  | 'photo'
  /** One arm out, turned back on themselves. */
  | 'selfie'
  /** Turned outward to show somebody else. */
  | 'show';

export interface PhoneUseOptions {
  /** Which hand holds it. Default 'Right'. */
  hand?: 'Left' | 'Right';
  /**
   * How much a walker slows while using it. Default 0.82 — people really do
   * walk about a fifth slower while texting, with a shorter stride.
   */
  walkScale?: number;
  /** Mean seconds between glances up while walking. Default 4.5. */
  glanceEvery?: number;
  seed?: number;
}

/** Something to hold. Structurally SCENA's phone (and ANIMA's `Holdable`). */
export interface Handheld {
  object: Object3D;
}

/**
 * Where the handset rides for each pose, in the holding hand's local space,
 * scaled by body height — plus how the set is turned. `show` is the only one
 * that faces the screen away from the user, because it is the only one where
 * somebody else is meant to see it.
 */
const GRIPS: Record<PhonePose, { pos: [number, number, number]; face: 'self' | 'away' }> = {
  scroll: { pos: [-0.02, -0.03, 0.02], face: 'self' },
  type: { pos: [-0.02, -0.03, 0.03], face: 'self' },
  call: { pos: [-0.01, 0.0, 0.01], face: 'self' },
  photo: { pos: [-0.02, -0.02, 0.02], face: 'away' },
  selfie: { pos: [-0.02, -0.02, 0.02], face: 'self' },
  show: { pos: [-0.02, -0.03, 0.03], face: 'away' },
};

/**
 * Build the posture for a pose. `s` is +1 for a left-handed hold, -1 for
 * right, which flips every frontal-plane angle.
 *
 * The rig has no fingers — the hand is one bone — so a thumb scroll has to
 * be read off the wrist and forearm. That is what it reads as at any
 * distance anyway; nobody watches the thumb.
 */
export function createPhoneClip(
  rig: HumanoidRig,
  pose: PhonePose,
  hand: 'Left' | 'Right' = 'Right'
): AnimationClip {
  const s = hand === 'Left' ? 1 : -1;
  const other = hand === 'Left' ? 'Right' : 'Left';
  const o = other === 'Left' ? 1 : -1;

  /** The free arm, hanging and slightly relaxed. */
  const rest = (p: { rotate: (b: BoneName, ...ops: [Vector3, number][]) => void }): void => {
    p.rotate(`${other}Arm` as BoneName, [X, -0.06], [Z, -o * (HANG - 0.06)]);
    p.rotate(`${other}ForeArm` as BoneName, [Y, -o * 0.28]);
  };

  if (pose === 'scroll') {
    // The phone lean: head well down, shoulders rounded forward, one forearm
    // up across the chest. This is the silhouette the whole feature is for.
    const clip = buildClip(rig, `phone-scroll-${hand}`, 2.4, 30, (p, pose2) => {
      // A thumb flick is not a sine wave: a quick swipe, then a pause while
      // the eye reads. Two flicks per cycle, each about a fifth of it.
      const beat = (p * 2) % 1;
      const flick = beat < 0.22 ? Math.sin((beat / 0.22) * Math.PI) : 0;
      const breath = Math.sin(TAU * p) * 0.012;

      // Solved against the rig, not assumed: +Z hangs the arm, +Y swings it
      // forward, and forearm +Y is the elbow. (For the right arm s = -1, so
      // every -s here reads as +.)
      pose2.rotate(`${hand}Arm` as BoneName, [Z, -s * 1.2], [Y, -s * 0.35]);
      pose2.rotate(`${hand}ForeArm` as BoneName, [Y, -s * (1.8 + flick * 0.06)]);
      // The wrist carries the flick — with no thumb, this IS the swipe.
      pose2.rotate(`${hand}Hand` as BoneName, [Z, -s * (0.12 + flick * 0.22)]);
      rest(pose2);

      pose2.rotate('Chest', [X, 0.14 + breath]);
      // Head down AND turned a little toward the hand. Purely pitching the
      // head down leaves the handset 40 degrees off the line of sight —
      // holding it perfectly while looking past it.
      pose2.rotate('Neck', [X, 0.4], [Y, s * 0.1]);
      pose2.rotate('Head', [X, 0.5], [Y, s * 0.25]);
    });
    return maskClip(clip, UPPER);
  }

  if (pose === 'type') {
    const clip = buildClip(rig, `phone-type-${hand}`, 1.6, 30, (p, pose2) => {
      // Thumbs alternate; the wrists rock a few degrees out of phase.
      const l = Math.sin(TAU * p);
      const r = Math.sin(TAU * p + Math.PI);
      for (const side of ['Left', 'Right'] as const) {
        const k = side === 'Left' ? 1 : -1;
        const beat = side === 'Left' ? l : r;
        pose2.rotate(`${side}Arm` as BoneName, [Z, -k * 1.12], [Y, -k * 0.5]);
        pose2.rotate(`${side}ForeArm` as BoneName, [Y, -k * (1.72 + beat * 0.05)]);
        pose2.rotate(`${side}Hand` as BoneName, [Z, -k * (0.1 + beat * 0.09)]);
      }
      pose2.rotate('Chest', [X, 0.17]);
      // Two hands means the phone is on the centreline, so no head turn.
      pose2.rotate('Neck', [X, 0.42]);
      pose2.rotate('Head', [X, 0.52]);
    });
    return maskClip(clip, UPPER);
  }

  if (pose === 'call') {
    const clip = buildClip(rig, `phone-call-${hand}`, 5.2, 30, (p, pose2) => {
      const sway = Math.sin(TAU * p) * 0.02;
      // Elbow up and out, hand at the ear.
      pose2.rotate(`${hand}Arm` as BoneName, [Z, -s * 0.1], [Y, -s * 0.5]);
      pose2.rotate(`${hand}ForeArm` as BoneName, [Y, -s * 3.0]);
      rest(pose2);
      // The head tips slightly TOWARD the hand — you meet the phone halfway,
      // you do not hold it out at arm's reach from a level head.
      pose2.rotate('Chest', [X, 0.02 + sway]);
      pose2.rotate('Neck', [Z, -s * 0.1]);
      pose2.rotate('Head', [X, 0.05], [Z, -s * 0.13]);
    });
    return maskClip(clip, UPPER);
  }

  if (pose === 'photo') {
    const clip = buildClip(rig, `phone-photo-${hand}`, 4.0, 30, (p, pose2) => {
      // Held breath: almost nothing moves while framing a shot.
      const hold = Math.sin(TAU * p) * 0.006;
      for (const side of ['Left', 'Right'] as const) {
        const k = side === 'Left' ? 1 : -1;
        pose2.rotate(`${side}Arm` as BoneName, [Z, -k * 0.75], [Y, -k * 1.35]);
        pose2.rotate(`${side}ForeArm` as BoneName, [Y, -k * 0.45]);
      }
      // Elbows out, chin level, weight settled back a touch.
      pose2.rotate('Chest', [X, -0.06 + hold]);
      pose2.rotate('Neck', [X, 0.06]);
      pose2.rotate('Head', [X, 0.08]);
    });
    return maskClip(clip, UPPER);
  }

  if (pose === 'selfie') {
    const clip = buildClip(rig, `phone-selfie-${hand}`, 3.2, 30, (p, pose2) => {
      const settle = Math.sin(TAU * p) * 0.01;
      pose2.rotate(`${hand}Arm` as BoneName, [Z, -s * 0.55], [Y, -s * 1.5]);
      pose2.rotate(`${hand}ForeArm` as BoneName, [Y, -s * 0.35]);
      rest(pose2);
      // Chin up and head cocked — the pose everybody strikes and nobody
      // admits to.
      pose2.rotate('Chest', [X, -0.05]);
      pose2.rotate('Neck', [Z, s * 0.09]);
      pose2.rotate('Head', [X, -0.1 + settle], [Z, s * 0.12]);
    });
    return maskClip(clip, UPPER);
  }

  // show — turned outward, leaning in toward whoever is looking.
  const clip = buildClip(rig, `phone-show-${hand}`, 3.6, 30, (p, pose2) => {
    const breath = Math.sin(TAU * p) * 0.01;
    pose2.rotate(`${hand}Arm` as BoneName, [Z, -s * 0.85], [Y, -s * 1.15]);
    pose2.rotate(`${hand}ForeArm` as BoneName, [Y, -s * 0.9]);
    rest(pose2);
    pose2.rotate('Chest', [X, 0.1 + breath]);
    pose2.rotate('Neck', [X, 0.2], [Y, s * 0.1]);
    pose2.rotate('Head', [X, 0.26], [Y, s * 0.2]);
  });
  return maskClip(clip, UPPER);
}

/**
 * The glance up — the thing that separates a walking texter from a bollard
 * with a phone. Head comes level for the best part of a second, then back
 * down. Masked to head and neck only so the hands keep doing their thing.
 */
export function createGlanceClip(rig: HumanoidRig): AnimationClip {
  const clip = buildClip(rig, 'phone-glance', 1.1, 30, (p, pose) => {
    // Up fast, hold, down slower — you check where you are going, you do not
    // sweep the horizon.
    const up = p < 0.28 ? p / 0.28 : p < 0.62 ? 1 : Math.max(0, 1 - (p - 0.62) / 0.38);
    const eased = up * up * (3 - 2 * up);
    pose.rotate('Neck', [X, -0.3 * eased]);
    pose.rotate('Head', [X, -0.36 * eased]);
  });
  return maskClip(clip, ['Neck', 'Head']);
}

export class PhoneUse {
  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private readonly hand: 'Left' | 'Right';
  private readonly baseWalkScale: number;
  private readonly glanceEvery: number;
  private readonly rng: Rng;

  private item: Handheld | null = null;
  private anchor: Object3D | null = null;
  private stowAnchor: Object3D | null = null;
  private action: AnimationAction | null = null;
  private glanceAction: AnimationAction | null = null;
  private current: PhonePose | null = null;
  private glanceTimer = 0;
  private glanceLeft = 0;
  private readonly clips = new Map<string, AnimationClip>();

  constructor(rig: HumanoidRig, loco: Locomotion, options: PhoneUseOptions = {}) {
    this.rig = rig;
    this.loco = loco;
    this.hand = options.hand ?? 'Right';
    this.baseWalkScale = options.walkScale ?? 0.82;
    this.glanceEvery = options.glanceEvery ?? 4.5;
    this.rng = new Rng(options.seed ?? 1);
    this.glanceTimer = this.nextGlance();
  }

  /** The pose in use, or null when the phone is away. */
  get pose(): PhonePose | null {
    return this.current;
  }

  /** True while the handset is pocketed. */
  get stowed(): boolean {
    return this.current === null;
  }

  /** True during a glance up. */
  get glancing(): boolean {
    return this.glanceLeft > 0;
  }

  /**
   * Multiply a walk velocity by this. 1 when the phone is away; slower while
   * it is out, and slower again for two-handed typing, which is the one
   * people genuinely stop walking properly for.
   */
  get walkScale(): number {
    if (this.current === null) return 1;
    if (this.current === 'type') return this.baseWalkScale * 0.86;
    if (this.current === 'photo' || this.current === 'selfie') return 0; // you stop
    return this.baseWalkScale;
  }

  /** Give the character a handset. It goes straight into a pocket. */
  hold(item: Handheld): void {
    this.item = item;
    this.stow();
  }

  /** Take it out (if needed) and adopt a pose. */
  use(pose: PhonePose, fade = 0.28): void {
    if (!this.item) return;
    if (this.current === pose) return;
    this.current = pose;
    this.mount(pose);
    const clip = this.clipFor(pose);
    if (this.action) this.loco.stopOverlay(this.action, fade);
    // Weight well above 1 on purpose. three blends actions by NORMALISED
    // weight, so an overlay at weight 1 running against the idle clip at
    // weight 1 comes out as a 50/50 average — every arm reaches exactly half
    // way, and a phone call ends up held at chest height with the elbow
    // barely bent. These are replacement postures for the upper body, not
    // seasoning on top of it, so they need to dominate the mix.
    this.action = this.loco.overlay(clip, { fadeIn: fade, weight: POSE_WEIGHT });
  }

  /** Put it away: back to the pocket, arms released. */
  stow(fade = 0.3): void {
    if (!this.item) return;
    this.current = null;
    if (this.action) {
      this.loco.stopOverlay(this.action, fade);
      this.action = null;
    }
    // Hip socket — a phone lives in a pocket, not in mid-air.
    const socket = this.stowAnchor ?? this.makeStowAnchor();
    socket.add(this.item.object);
    this.item.object.position.set(0, 0, 0);
    this.item.object.rotation.set(0, 0, -0.12);
    this.anchor?.removeFromParent();
    this.anchor = null;
  }

  /** Give up the handset entirely (hand-off, or setting it down). */
  release(): Object3D | null {
    if (!this.item) return null;
    const object = this.item.object;
    this.stow(0.25);
    let root: Object3D = this.rig.object;
    while (root.parent) root = root.parent;
    root.attach(object);
    this.item = null;
    return object;
  }

  /** Fire a glance up now, whatever the schedule says. */
  glance(): void {
    if (this.current === null || this.glanceLeft > 0) return;
    this.glanceLeft = 1.1;
    this.glanceAction = this.loco.overlay(this.clipFor('glance'), {
      loop: false,
      fadeIn: 0.12,
    });
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.aim();

    if (this.glanceLeft > 0) {
      this.glanceLeft -= dt;
      if (this.glanceLeft <= 0 && this.glanceAction) {
        this.loco.stopOverlay(this.glanceAction, 0.18);
        this.glanceAction = null;
      }
    }

    // Only a walker glances up. Standing still there is nothing to check.
    const walking = this.loco.speed > 0.35;
    if (this.current !== null && walking && this.glanceLeft <= 0) {
      this.glanceTimer -= dt;
      if (this.glanceTimer <= 0) {
        this.glance();
        this.glanceTimer = this.nextGlance();
      }
    }
  }

  /**
   * Turn the handset so its screen faces the eyes — every frame, because the
   * hand is being animated underneath it.
   *
   * This started as a fixed rotation per pose and was wrong in every pose: a
   * hand-local angle that reads correctly for one arm posture is edge-on in
   * the next, and a phone seen edge-on is a grey sliver. Solving it live is
   * both simpler and what people actually do — you tilt the thing until you
   * can see it. `show` inverts the target, because that is the one pose where
   * somebody else is meant to be reading it.
   */
  private aim(): void {
    if (!this.item || !this.anchor || this.current === null) return;
    this.rig.object.updateMatrixWorld(true);
    const eyes = this.rig.bones.Head.getWorldPosition(_eyes);
    const at = this.item.object.getWorldPosition(_at);
    if (GRIPS[this.current].face === 'away') {
      // Point the screen the other way: aim at the mirror of the eyes.
      this.item.object.lookAt(_look.copy(at).multiplyScalar(2).sub(eyes));
    } else {
      this.item.object.lookAt(eyes);
    }
  }

  private nextGlance(): number {
    // Exponential, so glances are not on a metronome.
    return this.glanceEvery * (0.4 + -Math.log(1 - this.rng.next() * 0.95) * 0.7);
  }

  private clipFor(key: PhonePose | 'glance'): AnimationClip {
    const id = `${key}-${this.hand}`;
    let clip = this.clips.get(id);
    if (!clip) {
      clip = key === 'glance' ? createGlanceClip(this.rig) : createPhoneClip(this.rig, key, this.hand);
      this.clips.set(id, clip);
    }
    return clip;
  }

  private makeStowAnchor(): Object3D {
    const anchor = new Object3D();
    anchor.name = 'phone-pocket';
    const h = this.rig.height;
    const side = this.hand === 'Left' ? 1 : -1;
    anchor.position.set(side * 0.1 * h, -0.03 * h, 0.035 * h);
    this.rig.bones.Hips.add(anchor);
    this.stowAnchor = anchor;
    return anchor;
  }

  /** Parent the handset into the holding hand at this pose's grip. */
  private mount(pose: PhonePose): void {
    if (!this.item) return;
    this.anchor?.removeFromParent();
    const grip = GRIPS[pose];
    const h = this.rig.height;
    const side = this.hand === 'Left' ? 1 : -1;
    const anchor = new Object3D();
    anchor.name = 'phone-grip';
    anchor.position.set(side * grip.pos[0] * h, grip.pos[1] * h, grip.pos[2] * h);
    this.rig.bones[`${this.hand}Hand` as BoneName].add(anchor);
    anchor.add(this.item.object);
    this.item.object.position.set(0, 0, 0);
    this.item.object.quaternion.identity();
    this.anchor = anchor;
  }
}
