import { AnimationAction, AnimationClip, Object3D, Quaternion, Vector3 } from 'three';
import { buildClip, Pose } from './clips';
import type { HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/**
 * Anything with a bottom, a top and rungs. Structurally what SCENA's
 * `createLadder` publishes, so it drops straight in with no cross-import.
 */
export interface Climbable {
  /** Floor-level anchor at the foot of the ladder; +z faces the rungs. */
  bottom: Object3D;
  /** Anchor at the top, where the climber steps off. */
  top: Object3D;
  /** Vertical spacing between rungs, in metres. */
  rungSpacing: number;
}

export type ClimbState = 'off' | 'mounting' | 'climbing' | 'topping' | 'done';

/**
 * The climbing loop: one full cycle moves the body up by two rungs.
 *
 * Real climbing is **contralateral** — left hand goes up with the *right*
 * foot, then right hand with left foot. It is the same cross-body pattern
 * as walking, and it exists because it keeps the climber's centre of mass
 * over the supporting diagonal. Move the same-side hand and foot together
 * instead ("bear crawl") and the body has to sway out from the ladder at
 * every step; it reads as a cartoon, or as someone who has never climbed
 * anything.
 *
 * The other rule this encodes is **three points of contact**: at any
 * instant exactly one limb is moving and the other three are holding on.
 */
export function createClimbClip(rig: HumanoidRig, duration = 1.6): AnimationClip {
  return buildClip(rig, 'climb', duration, 30, (p, pose: Pose) => {
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      // The two half-cycles. Left hand leads with the RIGHT foot.
      const handPhase = side === 'Left' ? p : (p + 0.5) % 1;
      const footPhase = side === 'Left' ? (p + 0.5) % 1 : p;
      // Each limb reaches during the first 40% of its half and holds after.
      const reach = (q: number): number => {
        const u = clamp01(((q % 0.5) / 0.5 - 0.05) / 0.45);
        return smooth(u);
      };
      const hand = reach(handPhase);
      const foot = reach(footPhase);

      // Arms: overhead, alternately reaching for the next rung. The pull
      // comes from the arm that is NOT moving, so its elbow stays bent.
      pose.rotate(`${side}Arm`, [X, -0.35], [Z, -s * (0.35 - 0.42 * hand)]);
      pose.rotate(`${side}ForeArm`, [Y, -s * (1.0 - 0.72 * hand)], [X, -0.2]);
      // Legs: knee comes up high to place the foot on the next rung.
      pose.rotate(`${side}UpLeg`, [X, -(0.25 + 0.85 * foot)], [Z, -s * 0.16]);
      pose.rotate(`${side}Leg`, [X, 0.45 + 1.05 * foot]);
      pose.rotate(`${side}Foot`, [X, -0.25 - 0.25 * foot]);
    }
    // The torso stays close to the ladder and rocks a little side to side
    // as the weight shifts from one supporting diagonal to the other.
    const sway = Math.sin(TAU * p);
    pose.hipsY = rig.bones.Hips.position.y - 0.02 * rig.height;
    pose.rotate('Hips', [Z, sway * 0.05], [X, -0.12]);
    pose.rotate('Spine', [X, 0.1], [Y, sway * 0.06]);
    pose.rotate('Chest', [X, 0.08], [Y, -sway * 0.05]);
    pose.rotate('Head', [X, -0.15]); // looking up at the next rung
  });
}

/**
 * Topping out — the parkour bit, and the part everyone skips.
 *
 * Getting *onto* a ladder is easy; getting *off* the top is the hard move,
 * because the climber has to transfer from hanging under their hands to
 * standing over their feet. The body folds forward over the edge, one knee
 * comes up onto the top, and the climber presses up and stands. Cut this
 * and the character slides up the last metre like a lift.
 */
export function createTopOutClip(rig: HumanoidRig, duration = 1.3): AnimationClip {
  return buildClip(rig, 'topout', duration, 30, (p, pose: Pose) => {
    const u = smooth(clamp01(p));
    // Three beats: reach over (0–0.35), knee up and press (0.35–0.75),
    // stand up (0.75–1).
    const over = smooth(clamp01(p / 0.35));
    const press = smooth(clamp01((p - 0.3) / 0.45));
    const stand = smooth(clamp01((p - 0.7) / 0.3));

    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      // Hands plant on the top and push down as the body rises.
      pose.rotate(
        `${side}Arm`,
        [X, -0.6 * over + 1.0 * press - 0.55 * stand],
        [Z, -s * (0.5 - 0.28 * over + 0.3 * stand)]
      );
      pose.rotate(`${side}ForeArm`, [Y, -s * (0.9 - 0.75 * press)], [X, -0.3 + 0.2 * press]);
    }
    // The leading (right) knee comes up onto the ledge first — a climber
    // does not haul both legs up together.
    pose.rotate('RightUpLeg', [X, -(1.5 * press) + 1.4 * stand], [Z, -0.3 * press]);
    pose.rotate('RightLeg', [X, 1.7 * press - 1.6 * stand]);
    pose.rotate('RightFoot', [X, -0.3 * press + 0.2 * stand]);
    pose.rotate('LeftUpLeg', [X, -(0.3 + 0.5 * press) + 0.7 * stand], [Z, 0.12]);
    pose.rotate('LeftLeg', [X, 0.7 + 0.9 * press - 1.3 * stand]);
    pose.rotate('LeftFoot', [X, -0.2]);

    // Fold over the edge, then unfold to standing.
    pose.hipsY = rig.bones.Hips.position.y - 0.06 * rig.height * (1 - stand);
    pose.rotate('Hips', [X, 0.5 * over + 0.15 * press - 0.6 * stand]);
    pose.rotate('Spine', [X, 0.35 * over - 0.4 * stand]);
    pose.rotate('Chest', [X, 0.25 * over - 0.3 * stand]);
    pose.rotate('Head', [X, -0.2 * over + 0.25 * stand]);
    void u;
  });
}

export interface ClimbOptions {
  /** Rungs climbed per second. Default 1.6. */
  speed?: number;
  /** How far the body stands off the rungs, in metres. Default 0.3. */
  standoff?: number;
}

type ClimbListener = (state: ClimbState) => void;

/**
 * Climbing a ladder, with the transitions at both ends.
 *
 * The controller's job is to keep the *clip* and the *translation* locked
 * together: the body rises exactly two rungs per cycle of the climb loop,
 * so hands arrive where rungs actually are. Decouple them and the hands
 * slide through the ladder — the climbing equivalent of foot-skating, and
 * just as obvious.
 *
 * ```ts
 * const climb = new Climb(rig, loco);
 * climb.start(ladder);                       // SCENA's createLadder fits
 * game.onUpdate((t) => climb.update(t.delta));
 * climb.onState((s) => { if (s === 'done') walkOn(); });
 * ```
 */
export class Climb {
  /** Rungs per second. Live-editable. */
  speed: number;

  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private readonly standoff: number;
  private readonly listeners = new Set<ClimbListener>();
  private ladder: Climbable | null = null;
  private loopClip: AnimationClip | null = null;
  private topClip: AnimationClip | null = null;
  private action: AnimationAction | null = null;
  private state: ClimbState = 'off';
  private rungs = 0; // rungs climbed so far
  private total = 0;
  private stageT = 0;
  private from = new Vector3();
  private fromQ = new Quaternion();
  private weight = 0;

  constructor(rig: HumanoidRig, loco: Locomotion, options: ClimbOptions = {}) {
    this.rig = rig;
    this.loco = loco;
    this.speed = options.speed ?? 1.6;
    this.standoff = options.standoff ?? 0.3;
  }

  get climbing(): boolean {
    return this.state !== 'off' && this.state !== 'done';
  }

  /** 0 at the foot of the ladder, 1 at the top. */
  get progress(): number {
    return this.total > 0 ? clamp01(this.rungs / this.total) : 0;
  }

  onState(listener: ClimbListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Step onto the ladder and start going up. */
  start(ladder: Climbable): void {
    if (this.climbing) return;
    this.ladder = ladder;
    ladder.bottom.updateWorldMatrix(true, false);
    ladder.top.updateWorldMatrix(true, false);
    const foot = ladder.bottom.getWorldPosition(new Vector3());
    const head = ladder.top.getWorldPosition(new Vector3());
    this.total = Math.max(1, Math.round((head.y - foot.y) / ladder.rungSpacing));
    this.rungs = 0;
    this.stageT = 0;
    this.from.copy(this.rig.object.position);
    this.fromQ.copy(this.rig.object.quaternion);
    this.go('mounting');
  }

  /** Let go and drop back to the foot of the ladder. */
  stop(): void {
    if (!this.climbing) return;
    if (this.action) this.loco.stopOverlay(this.action, 0.25);
    this.action = null;
    this.state = 'off';
    this.loco.influence = 1;
    this.weight = 0;
    for (const listener of [...this.listeners]) listener('off');
  }

  update(dt: number): void {
    if (!this.ladder || this.state === 'off' || this.state === 'done') return;
    const target = this.state === 'climbing' || this.state === 'mounting' ? 1 : 1;
    this.weight += (target - this.weight) * Math.min(1, dt * 8);
    this.loco.influence = 1 - this.weight;

    const ladder = this.ladder;
    ladder.bottom.updateWorldMatrix(true, false);
    const foot = ladder.bottom.getWorldPosition(new Vector3());
    const facing = ladder.bottom.getWorldQuaternion(new Quaternion());
    // Stand off the rungs by a body's depth, facing the ladder.
    const into = new Vector3(0, 0, 1).applyQuaternion(facing);
    const base = foot.clone().addScaledVector(into, -this.standoff);

    if (this.state === 'mounting') {
      this.stageT += dt / 0.5;
      const k = smooth(clamp01(this.stageT));
      const to = this.local(base.clone().addScaledVector(Y, ladder.rungSpacing * 0.6), facing);
      this.rig.object.position.lerpVectors(this.from, to.position, k);
      this.rig.object.quaternion.slerpQuaternions(this.fromQ, to.quaternion, k);
      if (this.stageT >= 1) {
        this.playLoop();
        this.go('climbing');
      }
      return;
    }

    if (this.state === 'climbing') {
      this.rungs += this.speed * dt;
      // Body height is driven by rungs climbed, and the loop's playback is
      // driven by the same number — two rungs per cycle — so the hands and
      // the rungs stay in step however fast the climb is set to run.
      if (this.action) this.action.timeScale = this.speed / 2;
      const y = ladder.rungSpacing * (0.6 + this.rungs);
      const to = this.local(base.clone().addScaledVector(Y, y), facing);
      this.rig.object.position.copy(to.position);
      this.rig.object.quaternion.copy(to.quaternion);
      if (this.rungs >= this.total - 1) {
        if (this.action) this.loco.stopOverlay(this.action, 0.2);
        this.topClip ??= createTopOutClip(this.rig);
        this.action = this.loco.overlay(this.topClip, { loop: false, fadeIn: 0.2 });
        this.from.copy(this.rig.object.position);
        this.fromQ.copy(this.rig.object.quaternion);
        this.stageT = 0;
        this.go('topping');
      }
      return;
    }

    // Topping out: rise the last rung AND step forward onto the platform.
    this.stageT += dt / 1.3;
    const k = smooth(clamp01(this.stageT));
    ladder.top.updateWorldMatrix(true, false);
    const over = ladder.top.getWorldPosition(new Vector3()).addScaledVector(into, 0.42);
    const to = this.local(over, facing);
    this.rig.object.position.lerpVectors(this.from, to.position, k);
    this.rig.object.quaternion.slerpQuaternions(this.fromQ, to.quaternion, k);
    if (this.stageT >= 1) {
      if (this.action) this.loco.stopOverlay(this.action, 0.3);
      this.action = null;
      this.state = 'done';
      this.loco.influence = 1;
      this.weight = 0;
      for (const listener of [...this.listeners]) listener('done');
    }
  }

  private playLoop(): void {
    this.loopClip ??= createClimbClip(this.rig);
    this.action = this.loco.overlay(this.loopClip, { fadeIn: 0.25 });
  }

  private go(state: ClimbState): void {
    this.state = state;
    for (const listener of [...this.listeners]) listener(state);
  }

  /** Express a world transform in the rig's parent space. */
  private local(position: Vector3, quaternion: Quaternion): { position: Vector3; quaternion: Quaternion } {
    const p = position.clone();
    const q = quaternion.clone();
    const parent = this.rig.object.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(p);
      q.premultiply(parent.getWorldQuaternion(new Quaternion()).invert());
    }
    return { position: p, quaternion: q };
  }
}
