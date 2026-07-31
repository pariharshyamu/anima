import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  Quaternion,
  Vector3,
} from 'three';
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

/**
 * A hole to cross, rather than a thing to get over.
 *
 * Deliberately NOT an `Obstacle`. A gap has no top surface, no depth to swing
 * your legs across and no height to compare against a band — describing one in
 * those terms would make `chooseMove` answer a question it was never asked.
 * The only number that matters is how far it is to the other side.
 */
export interface Gap {
  /** World anchor on the near lip, +z pointing across. */
  edge: Object3D;
  /** Distance to the far lip, metres. */
  width: number;
}

export type MoveName =
  | 'step'
  | 'safety-vault'
  | 'speed-vault'
  | 'mantle'
  | 'drop'
  | 'gap-jump';

/** What a fall of a given height costs on the way down. */
export type LandingKind = 'absorb' | 'roll' | 'hurt';

/**
 * How this body should meet the ground from `fall` metres.
 *
 * The thresholds are leg lengths, not constants: a long-legged body has
 * further to travel absorbing the same drop, so it takes more of it standing.
 * Past `roll` there is no technique left — which is a fact a game may want to
 * act on, so it is returned rather than clamped away.
 */
export function landingFor(fall: number, reach: Reach): LandingKind {
  const leg = reach.step / 0.52;
  if (fall <= leg * 1.15) return 'absorb';
  if (fall <= leg * 2.6) return 'roll';
  return 'hurt';
}

/**
 * Can this body clear `gap` metres of nothing at this speed?
 *
 * Separate from `chooseMove` on purpose: a gap is not an obstacle you go
 * over, it is an absence you go across, and asking about it in terms of
 * `height` and `depth` would be a lie about what is being measured.
 */
export function canClear(gap: number, reach: Reach, speed: number): boolean {
  return gap > 0 && gap <= gapAt(reach, speed);
}

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

/**
 * A limb pinned to a point on the obstacle for part of the move.
 *
 * `at.x` follows the RIG's convention, where **left is +x** — the same
 * convention `restDirection` encodes. Writing the two hands the other way
 * round is survivable for a one-handed move, because the body just shifts to
 * suit; on the two-handed mantle it put the left shoulder over the right
 * hand's mark and stranded the right arm 0.88 m from a target a 0.50 m arm
 * was supposed to reach.
 */
interface Contact {
  bone: BoneName;
  side: 'Left' | 'Right';
  arm: boolean;
  /** Where it holds, in the edge frame: +z past the edge, y up from the top. */
  at: Vector3;
  /** Phase window it is planted for. */
  from: number;
  to: number;
  /**
   * Phase spent reaching toward the contact before it plants, and leaving it
   * after. Without this the limb teleports onto the contact in a single
   * keyframe: measured as 0.19 m of hand error at exactly the frame the plant
   * begins, while the middle of the same window was exact to 0.03 m.
   */
  ease?: number;
}

/** Body measurements the specs are written in terms of. */
interface Build {
  /** Upper arm + forearm. */
  arm: number;
  /** Hip to ankle. */
  leg: number;
  /** Ankle height above whatever the foot stands on. */
  lift: number;
  height: number;
}

interface MoveSpec {
  duration: number;
  contacts: (h: number, d: number, land: number, b: Build) => Contact[];
  /**
   * Where a body LANDMARK should be at this phase, in the edge frame.
   *
   * This is the whole rewrite. The first version authored the root's path in
   * absolute metres and then asked whether the contacts were reachable from
   * it — backwards, because a vaulter's shoulder only gets down to an 0.85 m
   * wall by folding over the planted arm, so the reachable set depends on the
   * pose, which depends on the phase, which was the thing being solved for.
   * Standing upright, a 1.77 m body's shoulder is 0.60 m above that wall and
   * its arm is 0.50 m long: the hand could not touch the top at all.
   *
   * So the landmark is authored RELATIVE TO THE CONTACT, in units of limb
   * length, and the root falls out of it. A hand contact anchors the chest at
   * 0.7–0.85 of an arm away; a foot contact anchors the hips at 0.62–0.98 of
   * a leg. Those fractions ARE the reachability guarantee, and they hold for
   * any body because they are fractions of that body.
   */
  anchor: (p: number, h: number, d: number, land: number, b: Build, c: Contact[]) => AnchorSet;
  turn: (p: number) => number;
  pose: (p: number, pose: Pose, b: Build) => void;
}

interface Anchor {
  bone: BoneName;
  at: Vector3;
}

/**
 * One anchor, or two being handed over between.
 *
 * A mantle changes what is holding the body up halfway through — hands on the
 * lip, then a foot on the top — and the two are anchored to different
 * landmarks. Blending the TARGETS would mean converting one landmark's frame
 * into the other's, and that conversion is a guess: writing "the shoulder is
 * 0.72 of a leg above the hips" cost 462 mm, because the real offset depends
 * on how folded the torso is at that instant. Blending the resulting ROOTS
 * needs no conversion at all — each is measured from the posed body.
 */
interface AnchorSet {
  a: Anchor;
  b?: Anchor;
  /** 0 = all `a`, 1 = all `b`. */
  t?: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * A landmark swinging around a contact at a FIXED radius.
 *
 * The offset is authored as an angle on a circle of `radius`, never as
 * independent components. Author the vertical and the forward separately and
 * each looks reasonable while their combination does not: measured, a
 * shoulder asked to be 0.72 of an arm above the hand and 0.40 m past it ends
 * up 0.536 m away from a 0.496 m arm, and the solve quietly clamps. A radius
 * cannot do that.
 *
 * `angle` is measured from straight up, positive forwards.
 */
function orbit(contact: Vector3, radius: number, angle: number, x = contact.x): Vector3 {
  return new Vector3(x, contact.y + radius * Math.cos(angle), contact.z + radius * Math.sin(angle));
}

/**
 * A vault: in from the run-up, over the planted hand, **down onto the far
 * ground**.
 *
 * That last clause is the whole reason this is a function. Both vaults used to
 * anchor the shoulder to the hand for the entire move, drifting it down a bit
 * on the way out — which leaves the shoulder at roughly the height of the wall
 * top at the final frame. A standing body's shoulder is 1.45 m up and a rail is
 * 0.91 m, so "shoulder at wall height" means the body is still folded over the
 * rail when the clip ends, and the root that falls out of it is **0.41 m below
 * the road**. The character finished every vault with their feet in the tarmac.
 *
 * Nothing caught it. The contact gate only looks at frames where a limb is
 * PLANTED, and the vault's hand lets go at 0.62; the one test that checked
 * where a move ends vertically covered the step and the mantle and skipped the
 * vaults. So the exit re-anchors to the hips over the far ground — the same
 * root-blend handover the mantle uses, for the same reason: nothing has to be
 * converted between the two landmarks' frames.
 */
function vaultAnchor(
  p: number,
  h: number,
  d: number,
  land: number,
  b: Build,
  c: Contact[],
  spec: { radius: number; swing: number; runIn: number; runOut: number }
): AnchorSet {
  const hand = c[0].at;
  const from = c[0].from;
  const to = c[0].to;
  const R = b.arm * spec.radius;
  const angle = (u: number): number => lerp(-spec.swing, spec.swing, u);
  const overHand = (): Anchor => {
    if (p < from) {
      // Running in: continue back along the approach from where the orbit
      // begins, so the body arrives already in the right place.
      const start = orbit(hand, R, angle(0));
      return { bone: 'LeftArm', at: start.setZ(start.z - (1 - p / from) * spec.runIn) };
    }
    return { bone: 'LeftArm', at: orbit(hand, R, angle(Math.min(1, (p - from) / (to - from)))) };
  };
  if (p <= to) return { a: overHand() };
  // The edge frame's origin is the TOP of the obstacle, so the ground on the
  // far side is `-h` below it — and further still by whatever extra drop
  // `landing` declares, which is why this is a minus and not a plus.
  const ground = -h - land;
  return {
    a: overHand(),
    b: { bone: 'Hips', at: new Vector3(0, ground + b.lift + b.leg, d + b.leg * spec.runOut) },
    t: ramp(p, to, 0.99),
  };
}


const SPECS: Record<MoveName, MoveSpec> = {
  step: {
    duration: 0.95,
    contacts: (_h, _d, _land, b) => [
      {
        bone: 'RightFoot',
        side: 'Right',
        arm: false,
        at: new Vector3(-0.09 * b.height, b.lift, 0.15),
        from: 0.26,
        to: 0.96,
      },
    ],
    // The hips ride up and over the planted foot: from behind and low, to
    // directly above it and nearly straight. 0.62 → 0.98 of a leg.
    anchor: (p, _h, _d, _land, b, c) => {
      const foot = c[0].at;
      const u = ramp(p, 0.08, 0.95);
      // The hips ride up and over the planted foot on a radius that grows from
      // a bent leg to a straight one — 0.74 to 0.97 of a leg.
      return {
        a: {
          bone: 'Hips',
          at: orbit(foot, b.leg * lerp(0.74, 0.97, u), lerp(-0.66, 0.0, u), foot.x * 0.38),
        },
      };
    },
    turn: () => 0,
    pose: (p, pose, b) => {
      const rise = ramp(p, 0.3, 0.95);
      pose.rotate('Hips', [X, 0.24 - 0.2 * rise]);
      pose.rotate('Spine', [X, 0.12 - 0.1 * rise]);
      pose.rotate('Chest', [X, 0.07 - 0.05 * rise]);
      pose.rotate('Head', [X, -0.12 + 0.1 * rise]);
      const swing = arch(p);
      pose.rotate('LeftArm', [Z, 1.2 - 0.55 * swing], [Y, -0.4 * swing]);
      pose.rotate('LeftForeArm', [Z, 0.4 + 0.5 * swing]);
      pose.rotate('RightArm', [Z, -1.2 + 0.4 * swing], [Y, 0.3 * swing]);
      pose.rotate('RightForeArm', [Z, -0.35 - 0.4 * swing]);
      // The trailing leg swings through and plants on top at the end.
      const trail = ramp(p, 0.55, 1);
      pose.rotate('LeftUpLeg', [X, -0.25 - 0.75 * arch(trail)], [Z, 0.08]);
      pose.rotate('LeftLeg', [X, 0.4 + 1.1 * arch(trail)]);
      pose.rotate('LeftFoot', [X, -0.15]);
      void b;
    },
  },

  'safety-vault': {
    duration: 0.85,
    contacts: (_h, _d, _land, b) => [
      {
        bone: 'LeftHand',
        side: 'Left',
        arm: true,
        at: new Vector3(0.12 * b.height, 0.015, 0.06),
        from: 0.22,
        to: 0.64,
      },
      {
        bone: 'RightFoot',
        side: 'Right',
        arm: false,
        at: new Vector3(-0.11 * b.height, b.lift, 0.17),
        from: 0.42,
        to: 0.56,
      },
    ],
    // The chest passes over the planted hand: in from behind, up across it,
    // out the far side, never further than 0.86 of an arm from it — then the
    // hips take over and put the body down on the far ground.
    anchor: (p, h, d, land, b, c) =>
      vaultAnchor(p, h, d, land, b, c, { radius: 0.78, swing: 1.0, runIn: 0.85, runOut: 1.15 }),
    turn: (p) => -0.5 * arch(ramp(p, 0.1, 0.9)),
    pose: (p, pose, b) => {
      const over = arch(ramp(p, 0.05, 0.95));
      const land = ramp(p, 0.7, 1);
      pose.rotate('Hips', [X, 0.75 * over + 0.3 * land]);
      pose.rotate('Spine', [X, 0.4 * over]);
      pose.rotate('Chest', [X, 0.24 * over], [Y, 0.2 * over]);
      pose.rotate('Head', [X, -0.3 - 0.12 * over]);
      pose.rotate('RightArm', [Z, -1.0 + 0.7 * over], [Y, 0.75 * over]);
      pose.rotate('RightForeArm', [Z, -0.5 - 0.35 * over]);
      // The trailing leg tucks up over the top after the lead foot leaves it.
      const tuck = arch(ramp(p, 0.3, 0.95));
      pose.rotate('LeftUpLeg', [X, -1.0 * tuck], [Z, 0.14]);
      pose.rotate('LeftLeg', [X, 1.35 * tuck]);
      pose.rotate('LeftFoot', [X, -0.2 * tuck]);
      void b;
    },
  },

  'speed-vault': {
    duration: 0.68,
    contacts: (_h, _d, _land, b) => [
      {
        bone: 'LeftHand',
        side: 'Left',
        arm: true,
        at: new Vector3(0.11 * b.height, 0.015, 0.05),
        from: 0.18,
        to: 0.62,
      },
    ],
    anchor: (p, h, d, land, b, c) =>
      vaultAnchor(p, h, d, land, b, c, { radius: 0.8, swing: 1.15, runIn: 1.15, runOut: 1.7 }),
    // Side-on: both legs go through together past the planted hand.
    turn: (p) => -1.05 * arch(ramp(p, 0.05, 0.95)),
    pose: (p, pose, b) => {
      const over = arch(ramp(p, 0.05, 0.95));
      const land = ramp(p, 0.68, 1);
      pose.rotate('Hips', [X, 0.8 * over + 0.35 * land], [Y, -0.3 * over]);
      pose.rotate('Spine', [X, 0.42 * over]);
      pose.rotate('Chest', [X, 0.25 * over], [Y, 0.3 * over]);
      pose.rotate('Head', [X, -0.3]);
      pose.rotate('RightArm', [Z, -1.05 + 0.8 * over], [Y, 0.95 * over]);
      pose.rotate('RightForeArm', [Z, -0.45 - 0.45 * over]);
      const tuck = arch(ramp(p, 0.12, 0.9));
      for (const side of ['Left', 'Right'] as const) {
        pose.rotate(`${side}UpLeg`, [X, -1.25 * tuck], [Z, (side === 'Left' ? 1 : -1) * 0.12]);
        pose.rotate(`${side}Leg`, [X, 1.6 * tuck]);
        pose.rotate(`${side}Foot`, [X, -0.28 * tuck]);
      }
      void b;
    },
  },

  mantle: {
    duration: 1.4,
    contacts: (_h, _d, _land, b) => [
      {
        bone: 'LeftHand',
        side: 'Left',
        arm: true,
        at: new Vector3(0.12 * b.height, 0.015, 0.05),
        from: 0.1,
        to: 0.4,
      },
      {
        bone: 'RightHand',
        side: 'Right',
        arm: true,
        at: new Vector3(-0.12 * b.height, 0.015, 0.05),
        from: 0.1,
        to: 0.36,
      },
      {
        bone: 'RightFoot',
        side: 'Right',
        arm: false,
        at: new Vector3(-0.1 * b.height, b.lift, 0.24),
        from: 0.46,
        to: 0.96,
      },
    ],
    /**
     * Two anchors, handed over in the middle.
     *
     * The hands can only hold through about an arm's worth of rise — press
     * down and the elbows straighten and that is all you get. Everything above
     * that comes from the leg that gets onto the top, so the chest is anchored
     * to the hands first and the hips to the foot after, blended across the
     * handover so the body does not jump.
     */
    anchor: (p, _h, _d, _land, b, c) => {
      const hand = c[0].at;
      const foot = c[2].at;
      // The hands only buy about an arm's worth of rise: press down, the
      // elbows straighten, and that is all there is. The shoulder swings from
      // below-and-behind the lip to above it, and no further.
      const pull = ramp(p, 0.04, 0.42);
      const byHands = orbit(hand, b.arm * 0.8, lerp(-1.25, -0.12, pull));
      const stand = ramp(p, 0.46, 0.96);
      const byFoot = orbit(foot, b.leg * lerp(0.78, 0.98, stand), lerp(-0.62, 0.0, stand), foot.x * 0.4);
      // The chest sits a fixed way above the hips; converting between the two
      // anchors through that offset is what makes the handover seamless.
      return {
        a: { bone: 'LeftArm', at: byHands },
        b: { bone: 'Hips', at: byFoot },
        t: ramp(p, 0.4, 0.68),
      };
    },
    turn: () => 0,
    pose: (p, pose, b) => {
      const pull = ramp(p, 0.06, 0.52);
      const stand = ramp(p, 0.5, 1);
      pose.rotate('Hips', [X, 0.9 * pull - 0.95 * stand]);
      pose.rotate('Spine', [X, 0.42 * pull - 0.45 * stand]);
      pose.rotate('Chest', [X, 0.26 * pull - 0.28 * stand]);
      pose.rotate('Head', [X, -0.32 + 0.24 * stand]);
      // The trailing leg hangs, then swings up beside the planted one.
      const trail = ramp(p, 0.6, 1);
      pose.rotate('LeftUpLeg', [X, -0.1 - 0.9 * arch(trail)], [Z, 0.1]);
      pose.rotate('LeftLeg', [X, 0.2 + 1.2 * arch(trail)]);
      pose.rotate('LeftFoot', [X, -0.12]);
      void b;
    },
  },

  drop: {
    duration: 1.05,
    contacts: (h, _d, land, b) => {
      // The FALL, not the height. `Obstacle.landing` exists so a wall can be
      // taller on the far side than the near one, and a drop is the one move
      // where that difference is the whole story: step off a 1.2 m parapet
      // onto ground 0.8 m lower and you have fallen 2 m, not 1.2.
      const fall = h + land;
      // Both feet arrive, staggered a little — nobody lands on two feet at
      // exactly the same instant — and stay put while the legs absorb.
      return [
        {
          bone: 'LeftFoot',
          side: 'Left',
          arm: false,
          at: new Vector3(0.09 * b.height, -fall + b.lift, 0.34),
          from: 0.44,
          to: 1,
          ease: 0.06,
        },
        {
          bone: 'RightFoot',
          side: 'Right',
          arm: false,
          at: new Vector3(-0.09 * b.height, -fall + b.lift, 0.46),
          from: 0.48,
          to: 1,
          ease: 0.06,
        },
      ];
    },
    /**
     * Fall, then absorb, then stand.
     *
     * The absorb depth is what makes a drop read as a drop: land from a kerb
     * and you barely bend, land from a wall and you fold to a crouch. It
     * scales with the fall as a fraction of leg length, and it is capped,
     * because past a point the answer stops being knees and starts being a
     * roll — see `landingFor`.
     */
    anchor: (p, h, _d, land, b, c) => {
      const foot = c[0].at;
      const fall = h + land;
      const deep = Math.min(0.42, 0.16 + 0.3 * (fall / b.leg));
      const drop = ramp(p, 0.02, 0.5);
      const stand = ramp(p, 0.52, 1);
      // Above and behind the touchdown while airborne, then compressed over
      // it, then upright on it.
      const up = lerp(fall / b.leg + 0.95, 0.95 - deep, drop);
      return {
        a: {
          bone: 'Hips',
          at: new Vector3(
            foot.x * 0.4,
            foot.y + b.leg * lerp(up, 0.96, stand),
            foot.z + b.leg * lerp(lerp(-0.5, -0.14, drop), 0.02, stand)
          ),
        },
      };
    },
    turn: () => 0,
    pose: (p, pose, b) => {
      const fall = ramp(p, 0.02, 0.5);
      const stand = ramp(p, 0.52, 1);
      // Arms come up and out on the way down and settle on landing — the
      // reach for balance everybody does and nobody notices.
      const air = 1 - stand;
      for (const side of ['Left', 'Right'] as const) {
        const s = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}Arm`, [Z, s * (1.2 - 0.75 * air)], [Y, -s * 0.3 * air]);
        pose.rotate(`${side}ForeArm`, [Z, s * (0.3 + 0.35 * air)]);
      }
      pose.rotate('Hips', [X, 0.1 + 0.42 * fall - 0.48 * stand]);
      pose.rotate('Spine', [X, 0.06 + 0.2 * fall - 0.24 * stand]);
      pose.rotate('Chest', [X, 0.04 + 0.12 * fall - 0.14 * stand]);
      pose.rotate('Head', [X, -0.2 + 0.16 * stand]);
      void b;
    },
  },

  'gap-jump': {
    duration: 0.9,
    contacts: (_h, d, _land, b) => [
      // Off one foot, onto the other. A two-footed gap jump is a standing
      // long jump, which is a different move and a much shorter one.
      {
        bone: 'RightFoot',
        side: 'Right',
        arm: false,
        at: new Vector3(-0.08 * b.height, b.lift, -0.06),
        from: 0.06,
        to: 0.24,
        ease: 0.06,
      },
      {
        bone: 'LeftFoot',
        side: 'Left',
        arm: false,
        at: new Vector3(0.08 * b.height, b.lift, d + 0.22),
        from: 0.74,
        to: 1,
        ease: 0.07,
      },
    ],
    // Anchored to the take-off foot on the way up and the landing foot on the
    // way down, blended through the flight — the same handover the mantle
    // uses, and for the same reason: nothing has to be converted.
    anchor: (p, _h, d, _land, b, c) => {
      const off = c[0].at;
      const on = c[1].at;
      const rise = ramp(p, 0.04, 0.5);
      const fall = ramp(p, 0.5, 0.92);
      // Absorb AND recover. Without the second half the deepest point of the
      // crouch is the last frame, and since the root is what the anchor moves,
      // "hips low" reads as "body 250 mm under the ground" to anything that
      // asks the move where it ended. A landing that never stands up is not a
      // landing.
      const settle = ramp(p, 0.86, 1);
      return {
        a: {
          bone: 'Hips',
          at: new Vector3(
            off.x * 0.35,
            off.y + b.leg * lerp(0.72, 0.99, rise),
            off.z + lerp(-b.leg * 0.34, d * 0.55, rise)
          ),
        },
        b: {
          bone: 'Hips',
          at: new Vector3(
            on.x * 0.35,
            on.y + b.leg * lerp(lerp(0.99, 0.76, fall), 1.02, settle),
            on.z + lerp(-d * 0.45, 0.02, fall)
          ),
        },
        t: ramp(p, 0.34, 0.66),
      };
    },
    turn: () => 0,
    pose: (p, pose, b) => {
      const flight = arch(ramp(p, 0.05, 0.95));
      const land = ramp(p, 0.72, 1);
      pose.rotate('Hips', [X, 0.22 + 0.2 * flight + 0.3 * land]);
      pose.rotate('Spine', [X, 0.14 * flight]);
      pose.rotate('Chest', [X, 0.1 * flight]);
      pose.rotate('Head', [X, -0.22]);
      // Arms drive up on take-off and swing forward for the landing — the
      // counterweight is most of what a long jump actually is.
      for (const side of ['Left', 'Right'] as const) {
        const s = side === 'Left' ? 1 : -1;
        pose.rotate(`${side}Arm`, [Z, s * (1.15 - 0.9 * flight)], [Y, -s * (0.5 * flight)]);
        pose.rotate(`${side}ForeArm`, [Z, s * (0.3 + 0.5 * flight)]);
      }
      void b;
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
 * through the wall. The trajectory is BAKED at build time for that reason —
 * it is a consequence of the poses, so recomputing it at runtime would be
 * both wasteful and a chance to disagree.
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

function buildOf(rig: HumanoidRig): Build {
  rig.object.updateWorldMatrix(true, true);
  const ankle = rig.bones.LeftFoot.getWorldPosition(new Vector3());
  return {
    arm: rig.bones.LeftForeArm.position.length() + rig.bones.LeftHand.position.length(),
    leg: rig.bones.LeftLeg.position.length() + rig.bones.LeftFoot.position.length(),
    // Where the ANKLE sits above the surface the foot stands on. Aim a foot
    // contact at the surface itself and the solve tries to push the ankle
    // through it, or gives up and clamps.
    lift: ankle.y,
    height: rig.height,
  };
}

function contactsFor(
  rig: HumanoidRig,
  name: MoveName,
  obstacle: Pick<Obstacle, 'height' | 'depth' | 'landing'>
): Contact[] {
  const b = buildOf(rig);
  return SPECS[name].contacts(
    obstacle.height,
    obstacle.depth,
    (obstacle.landing ?? obstacle.height) - obstacle.height,
    b
  );
}

/**
 * Build a move for this body and this obstacle.
 *
 * Contacts are SOLVED, not posed. While a hand is on the wall its target in
 * the edge frame is fixed, so the arm is solved to it every frame and the hand
 * does not move in the world at all — the same trick the ladder climb uses on
 * rungs. What makes the solve possible in the first place is that the body was
 * placed from the contact rather than the other way round.
 */
export function createMove(
  rig: HumanoidRig,
  name: MoveName,
  obstacle: Pick<Obstacle, 'height' | 'depth' | 'landing'>,
  options: MoveOptions = {}
): ParkourMove {
  const spec = SPECS[name];
  const duration = options.duration ?? spec.duration;
  const fps = options.fps ?? 30;
  const h = obstacle.height;
  const d = obstacle.depth;
  const land = (obstacle.landing ?? obstacle.height) - obstacle.height;
  const b = buildOf(rig);
  const contacts = spec.contacts(h, d, land, b);

  const rest = new Map<BoneName, Quaternion>();
  for (const key of Object.keys(rig.bones) as BoneName[]) {
    rest.set(key, rig.bones[key].quaternion.clone());
  }
  const restHipsY = rig.bones.Hips.position.y;
  const restPos = rig.object.position.clone();
  const restQuat = rig.object.quaternion.clone();

  const frames = Math.max(8, Math.round(duration * fps));
  const baked: Vector3[] = [];
  const scratch = new Vector3();
  const target = new Vector3();
  const pole = new Vector3();

  const clip = buildClip(
    rig,
    `parkour-${name}`,
    duration,
    fps,
    (p, pose: Pose) => {
    pose.hipsY = restHipsY;
    // Every limb gets a baseline pose FIRST. `buildClip` discovers which bones
    // the clip animates from frame 0 alone, so a bone only posed once its
    // contact goes live never gets a track — the solve is computed and thrown
    // away, which cost 1.8 m of apparent "slip" from a hand nothing drove.
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      pose.rotate(`${side}Arm`, [Z, s * 1.2], [Y, -s * 0.12]);
      pose.rotate(`${side}ForeArm`, [Z, s * 0.35]);
      pose.rotate(`${side}UpLeg`, [X, -0.1], [Z, s * 0.05]);
      pose.rotate(`${side}Leg`, [X, 0.2]);
      pose.rotate(`${side}Foot`, [X, -0.1]);
    }
    spec.pose(p, pose, b);

    // 1. Pose the body at the origin and MEASURE where the landmark lands.
    //    The torso fold is what brings a shoulder down to a wall, so the
    //    offset has to be read from the posed body, not assumed.
    rig.object.position.set(0, 0, 0);
    rig.object.quaternion.setFromAxisAngle(Y, spec.turn(p));
    for (const [key, q] of rest) rig.bones[key].quaternion.copy(q);
    for (const [key, q] of pose.rotations) rig.bones[key].quaternion.copy(q);
    rig.bones.Hips.position.y = pose.hipsY;
    rig.object.updateWorldMatrix(true, true);

    const set = spec.anchor(p, h, d, land, b, contacts);
    const rootFor = (anchor: Anchor): Vector3 =>
      anchor.at.clone().sub(rig.bones[anchor.bone].getWorldPosition(scratch));
    const root = rootFor(set.a);
    if (set.b && set.t !== undefined) root.lerp(rootFor(set.b), set.t);
    baked.push(root);

    // 2. Stand the body there and solve the contacts against it.
    rig.object.position.copy(root);
    rig.object.updateWorldMatrix(true, true);

    for (const contact of contacts) {
      const ease = contact.ease ?? 0.08;
      if (p < contact.from - ease || p > contact.to + ease) continue;
      // 1 while planted, easing to 0 either side.
      const weight =
        p < contact.from
          ? smooth((p - (contact.from - ease)) / ease)
          : p > contact.to
            ? 1 - smooth((p - contact.to) / ease)
            : 1;
      const s = contact.side === 'Left' ? 1 : -1;
      const rootBone: BoneName = contact.arm ? `${contact.side}Arm` : `${contact.side}UpLeg`;
      const midBone: BoneName = contact.arm ? `${contact.side}ForeArm` : `${contact.side}Leg`;
      // Solve in the RIG'S OWN SPACE, not the world. `toParentFrame` divides
      // out the rig object's rotation, so it expects a rig-space rotation
      // back; hand it a world one and the whole limb is off by the body's
      // yaw. Invisible in `climb`, where a ladder-climbing rig is never
      // turned — and worth 350 mm on a vault, which turns by a radian.
      const from = rig.object.worldToLocal(rig.bones[rootBone].getWorldPosition(new Vector3()));
      target.copy(rig.object.worldToLocal(contact.at.clone()));
      // Elbows out and down; knees forward. Without a pole the solve is a cone
      // of valid answers and the joint wanders between frames.
      if (contact.arm) pole.set(s, -0.9, -0.25).normalize();
      else pole.set(0, -0.35, 1).normalize();
      const [l1, l2] = chainLengths(rig, contact.side, contact.arm);
      const solved = solveChain(from, target, restDirection(contact.side, contact.arm), l1, l2, pole);
      const rootQ = toParentFrame(rig, rootBone, solved.root);
      const baseRoot = pose.rotations.get(rootBone) ?? new Quaternion();
      const baseMid = pose.rotations.get(midBone) ?? new Quaternion();
      pose.set(rootBone, baseRoot.clone().slerp(rootQ, weight));
      pose.set(midBone, baseMid.clone().slerp(solved.joint, weight));
      if (!contact.arm && weight > 0.5) pose.rotate(`${contact.side}Foot`, [X, -0.2]);
      }
    },
    false
  );

  for (const [key, q] of rest) rig.bones[key].quaternion.copy(q);
  rig.bones.Hips.position.y = restHipsY;
  rig.object.position.copy(restPos);
  rig.object.quaternion.copy(restQuat);
  rig.object.updateWorldMatrix(true, true);

  // `buildClip` probes frame 0 once to discover which bones the clip animates,
  // THEN samples frames+1 times. The probe is the first entry in `baked` and
  // is not part of the path; dropping it is the difference between the
  // trajectory the clip was solved against and one shifted a frame off it.
  const path = baked.slice(1);
  void frames;
  const travel = (t: number, out = new Vector3()): Vector3 => {
    const x = clamp01(t) * (path.length - 1);
    const i = Math.min(path.length - 2, Math.floor(x));
    return out.copy(path[i]).lerp(path[i + 1], x - i);
  };

  return {
    name,
    clip,
    duration,
    travel,
    turn: (p: number) => spec.turn(p),
    end: travel(1),
  };
}

export interface ParkourContactReport {
  /** Peak wander of a planted limb from its contact point, in metres. */
  contactSlip: number;
  /**
   * Deepest any planted limb sinks below the surface IT IS HOLDING, in metres.
   *
   * A hand inside the wall is the tell that kills the whole illusion, and it
   * is invisible from every camera angle that does not happen to graze the
   * surface.
   */
  penetration: number;
  /** Worst limb extension. 1.0 is the solve clamping rather than reaching. */
  stretch: number;
  /**
   * How much the biggest single-frame move of a contact limb stands out from
   * its typical one, across the limb's whole approach — the ease, measured.
   *
   * A RATIO, not a distance, because a limb swinging onto a hold legitimately
   * moves fast: the raw peak reads 186 mm a frame for a step-up that is
   * perfectly smooth. What a teleport looks like is a DISCONTINUITY — one
   * frame far out of line with its neighbours — and that is what a ratio
   * against the median sees.
   *
   * Limbs blend on and off their holds so they do not teleport onto the wall.
   * Nothing else in this report can see whether they do: the slip and
   * penetration numbers only look at frames where a limb is already PLANTED,
   * and a limb that snaps into place arrives correct. Removing the ease
   * entirely used to leave every other number unchanged.
   *
   * Each ramp is its own track. Pooling a contact's ease-IN and ease-OUT
   * samples into one list makes the step from the last frame of one to the
   * first frame of the other look consecutive when it spans the entire plant
   * between them — for a foot held to the end of a gap jump that is a quarter
   * of the move, and it reported 282 mm as a single frame's motion on a move
   * whose real worst frame was 32 mm.
   */
  snap: number;
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
  // ONE-SHOT, because that is what the move is and what `Parkour` plays.
  // `clipAction` defaults to `LoopRepeat`, and a repeating action asked for
  // the time at exactly the clip's duration wraps to zero — so the very last
  // sample of every measurement was the move's FIRST frame. It read as a
  // 185 mm jump in a foot's final frame on a step-up whose real worst frame
  // was 7 mm, and it was in the harness, not the animation.
  const action = mixer.clipAction(move.clip);
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  const restPos = rig.object.position.clone();
  const restQuat = rig.object.quaternion.clone();
  const seen = new Map<Contact, Vector3[]>();
  // Keyed per RAMP, not per contact — see `snap`.
  const approach = new Map<string, Vector3[]>();
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
      const edge = 1 / (30 * move.duration);
      // Only the two ease RAMPS, not the plant between them. Include the
      // planted stretch and the median step is zero — the limb is holding
      // still, which is the point — and every ratio against it explodes.
      const ease = contact.ease ?? 0.08;
      const ramp =
        p >= contact.from - ease && p <= contact.from
          ? 'in'
          : p >= contact.to && p <= contact.to + ease
            ? 'out'
            : null;
      if (ramp) {
        const key = `${contact.bone}|${contact.from}|${ramp}`;
        if (!approach.has(key)) approach.set(key, []);
        approach.get(key)!.push(rig.bones[contact.bone].getWorldPosition(new Vector3()));
      }
      if (p >= contact.from + edge && p <= contact.to - edge) {
        stretch = Math.max(stretch, d / (l1 + l2));
        const w = rig.bones[contact.bone].getWorldPosition(new Vector3());
        if (!seen.has(contact)) seen.set(contact, []);
        seen.get(contact)!.push(w);
        // Measured against the CONTACT'S OWN surface, not against y = 0.
        // A drop lands BELOW the ledge it left by definition, so judging it
        // against the top read the whole fall height as penetration — 3.3 m
        // of "hand inside the wall" for a move that never touches the wall.
        penetration = Math.max(penetration, contact.at.y - w.y);
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
  let snap = 0;
  for (const track of approach.values()) {
    const steps: number[] = [];
    for (let i = 1; i < track.length; i++) steps.push(track[i].distanceTo(track[i - 1]));
    if (steps.length < 4) continue;
    const sorted = [...steps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median < 1e-6) continue;
    snap = Math.max(snap, Math.max(...steps) / median);
  }
  return { contactSlip, penetration, stretch, snap, planted: seen.size, samples };
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
  /**
   * The frame the move is playing in — an obstacle's top edge, or a gap's near
   * lip. Only the `Object3D` is kept, not the description it came from: once
   * the move is built, everything the obstacle had to say is baked into it.
   */
  private anchor: Object3D | null = null;
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
    this.start(name, obstacle.edge, obstacle);
    return name;
  }

  /**
   * How this body would meet the ground stepping off here — without doing it.
   *
   * The fall is the far side: `landing` if the obstacle declares one, its
   * `height` otherwise. `hurt` is returned rather than refused, because a
   * character walking off a roof falls whether or not there is a technique
   * for it, and how much that costs is the game's business, not ANIMA's.
   */
  landing(obstacle: Pick<Obstacle, 'height' | 'landing'>): LandingKind {
    return landingFor(obstacle.landing ?? obstacle.height, this.reach);
  }

  /**
   * Step off and land. Returns how the landing went, or `null` if there is
   * nothing to fall — the same honest-`null` contract `attempt` has.
   *
   * Separate from `attempt` on purpose. Going UP an obstacle is a choice
   * between techniques a body may or may not have; going DOWN one is not a
   * choice at all, and routing it through `chooseMove` would mean asking
   * "which move gets me over this?" about a wall already underfoot.
   */
  descend(obstacle: Obstacle): LandingKind | null {
    if (this.busy) return null;
    const fall = obstacle.landing ?? obstacle.height;
    if (fall <= 0) return null;
    this.start('drop', obstacle.edge, obstacle);
    return landingFor(fall, this.reach);
  }

  /**
   * Jump a gap. Returns `'gap-jump'`, or `null` if this body cannot clear it
   * at this speed — and it is the refusal that is worth having. A run-up is
   * most of a long jump, so the same ditch is crossable at a sprint and not
   * from a standstill, for the same character.
   */
  leap(gap: Gap, speed = 0): MoveName | null {
    if (this.busy) return null;
    if (!canClear(gap.width, this.reach, speed)) return null;
    this.start('gap-jump', gap.edge, { height: 0, depth: gap.width });
    return 'gap-jump';
  }

  private start(
    name: MoveName,
    anchor: Object3D,
    obstacle: Pick<Obstacle, 'height' | 'depth' | 'landing'>
  ): void {
    this.anchor = anchor;
    this.move = createMove(this.rig, name, obstacle);
    this.t = 0;
    this.phase = 'moving';
    this.action = this.loco.overlay(this.move.clip, { loop: false, fadeIn: 0.12 });
    this.loco.influence = 0;
    for (const listener of [...this.starts]) listener(name);
  }

  update(dt: number): void {
    if (!this.move || !this.anchor || this.phase !== 'moving') return;
    this.t = Math.min(this.move.duration, this.t + dt);
    const p = this.t / this.move.duration;

    // Place the body by the move's own trajectory, expressed in the
    // obstacle's frame — the same frame the contacts were solved in.
    const edge = this.anchor;
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
    this.anchor = null;
    this.loco.influence = 1;
  }
}
