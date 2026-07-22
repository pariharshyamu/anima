import { AnimationAction, AnimationMixer, LoopRepeat, Vector3 } from 'three';
import { createLocomotionClips, type LocomotionClips } from './clips';
import type { HumanoidRig } from './humanoid';

export interface LocomotionOptions {
  clips?: LocomotionClips;
  /** Speed below which the character is considered idle. Default 0.12. */
  idleThreshold?: number;
  /** Exponential smoothing rate for speed changes (1/s). Default 10. */
  smoothing?: number;
}

/**
 * The 1D locomotion blend: velocity in, correct animation out.
 *
 * - idle ↔ walk ↔ run cross-blended by planar speed
 * - walk and run stay phase-synchronized while blending (feet agree)
 * - playback rate is stride-matched to actual speed, so feet grip the
 *   ground instead of sliding
 * - speed is smoothed, so steering jitter never pops the animation
 *
 * ```ts
 * const rig = createHumanoid({ seed: 7 });
 * const loco = new Locomotion(rig);
 * game.onUpdate((t) => loco.update(t.delta, agent.velocity)); // GAMA handshake
 * ```
 */
export class Locomotion {
  readonly mixer: AnimationMixer;
  readonly clips: LocomotionClips;
  private readonly idleAction: AnimationAction;
  private readonly walkAction: AnimationAction;
  private readonly runAction: AnimationAction;
  private readonly idleThreshold: number;
  private readonly smoothing: number;
  private smoothedSpeed = 0;

  /** Current blend weights, exposed for debugging and tests. */
  readonly weights = { idle: 1, walk: 0, run: 0 };

  constructor(rig: HumanoidRig, options: LocomotionOptions = {}) {
    this.clips = options.clips ?? createLocomotionClips(rig);
    this.idleThreshold = options.idleThreshold ?? 0.12;
    this.smoothing = options.smoothing ?? 10;
    this.mixer = new AnimationMixer(rig.mesh);
    const start = (clip: LocomotionClips['idle']): AnimationAction => {
      const action = this.mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      action.play();
      return action;
    };
    this.idleAction = start(this.clips.idle);
    this.walkAction = start(this.clips.walk);
    this.runAction = start(this.clips.run);
    this.apply(0);
  }

  /** Planar speed the controller is currently animating. */
  get speed(): number {
    return this.smoothedSpeed;
  }

  /**
   * Advance the animation. Pass the character's velocity (a Vector3 —
   * GAMA's `agent.velocity` drops straight in) or a plain speed number.
   */
  update(dt: number, velocity: Vector3 | number = 0): void {
    const target =
      typeof velocity === 'number' ? Math.abs(velocity) : Math.hypot(velocity.x, velocity.z);
    const k = 1 - Math.exp(-this.smoothing * dt);
    this.smoothedSpeed += (target - this.smoothedSpeed) * k;
    this.apply(this.smoothedSpeed);
    this.mixer.update(dt);
  }

  private apply(speed: number): void {
    const { walkSpeed, runSpeed } = this.clips;
    let idle = 0;
    let walk = 0;
    let run = 0;
    if (speed <= this.idleThreshold) {
      idle = 1;
    } else if (speed < walkSpeed) {
      walk = (speed - this.idleThreshold) / (walkSpeed - this.idleThreshold);
      idle = 1 - walk;
    } else if (speed < runSpeed) {
      run = (speed - walkSpeed) / (runSpeed - walkSpeed);
      walk = 1 - run;
    } else {
      run = 1;
    }
    this.weights.idle = idle;
    this.weights.walk = walk;
    this.weights.run = run;
    this.idleAction.weight = idle;
    this.walkAction.weight = walk;
    this.runAction.weight = run;

    // Stride matching: play the gait at the rate that makes the blended
    // reference speed equal the actual speed (clamped to stay natural).
    const reference = walk + run > 0 ? (walk * walkSpeed + run * runSpeed) / (walk + run) : walkSpeed;
    const rate = Math.min(1.7, Math.max(0.4, speed / reference));
    this.walkAction.timeScale = rate;
    this.runAction.timeScale = rate;

    // Phase sync: while both gaits are audible in the blend, run follows
    // walk's normalized cycle phase so left/right footfalls agree.
    if (walk > 0 && run > 0) {
      const phase = (this.walkAction.time % this.clips.walk.duration) / this.clips.walk.duration;
      this.runAction.time = phase * this.clips.run.duration;
    }
  }
}
