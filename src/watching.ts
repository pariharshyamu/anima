import { Object3D, Vector3 } from 'three';
import { Rng } from './core/random';
import type { HumanoidRig } from './humanoid';
import type { LookAt } from './lookAt';

/**
 * Watching a screen.
 *
 * `LookAt` will happily point a character's head at a television and hold it
 * there, and the result is unmistakably a mannequin. Nobody watches anything
 * that way. Real attention on a screen is a sequence of small jumps around
 * the picture with occasional trips away from it entirely — a glance at
 * whoever just spoke, a look down at a mug — and then back to roughly where
 * it left off, not to a fresh random spot.
 *
 * This drives `LookAt.target` and nothing else, so it composes with
 * locomotion, mannerisms and sitting exactly the way a bare gaze target does.
 *
 * ```ts
 * const gaze = new LookAt(rig);
 * const watch = new Watching(rig, gaze);
 * watch.watch(tv.screen);                 // anything with surface/width/height
 * game.onUpdate((t) => { loco.update(…); watch.update(t.delta); gaze.update(t.delta); });
 * ```
 */

/**
 * Something with a face worth looking at. Structurally identical to SCENA's
 * `ScreenPanel`, so a television drops straight in with no cross-import.
 */
export interface Viewable {
  /** The face itself; its local +z is the direction it is seen from. */
  surface: Object3D;
  width: number;
  height: number;
}

export interface WatchingOptions {
  /**
   * How locked-on, 0..1. High engagement keeps the eyes on the picture; low
   * sends them wandering off it every few seconds. Default 0.75.
   */
  engagement?: number;
  /**
   * How much of the panel the gaze roams over, as a fraction of its size.
   * Default 0.55 — attention stays well inside the frame, it does not
   * scan the bezel.
   */
  roam?: number;
  /** Mean seconds a gaze point is held before the next jump. Default 0.85. */
  dwell?: number;
  seed?: number;
}

export class Watching {
  /** The live world-space gaze point, handed to `LookAt`. */
  readonly point = new Vector3();

  private readonly rig: HumanoidRig;
  private readonly look: LookAt;
  private readonly rng: Rng;
  private readonly engagement: number;
  private readonly roam: number;
  private readonly dwell: number;

  private view: Viewable | null = null;
  /** Where on the panel we are looking, in panel-local units (-0.5..0.5). */
  private readonly spot = new Vector3();
  /** Where we were looking before glancing away, so we can come back. */
  private readonly parked = new Vector3();
  private timer = 0;
  private awayTimer = 0;
  private readonly awayPoint = new Vector3();

  constructor(rig: HumanoidRig, look: LookAt, options: WatchingOptions = {}) {
    this.rig = rig;
    this.look = look;
    this.rng = new Rng(options.seed ?? 1);
    this.engagement = Math.min(1, Math.max(0, options.engagement ?? 0.75));
    this.roam = options.roam ?? 0.55;
    this.dwell = options.dwell ?? 0.85;
  }

  /** True while the eyes are off the screen. */
  get away(): boolean {
    return this.awayTimer > 0;
  }

  /** True if there is anything being watched at all. */
  get watching(): boolean {
    return this.view !== null;
  }

  /** Start (or stop, with null) watching a screen. */
  watch(view: Viewable | null): void {
    this.view = view;
    this.awayTimer = 0;
    this.timer = 0;
    if (!view) {
      this.look.target = null;
      return;
    }
    this.pick();
    this.look.target = this.point;
  }

  update(dt: number): void {
    if (!this.view || dt <= 0) return;

    if (this.awayTimer > 0) {
      this.awayTimer -= dt;
      if (this.awayTimer <= 0) {
        // Back to roughly where we left off — attention resumes, it does not
        // restart. A jump to a brand-new spot reads as a different thought.
        this.spot.copy(this.parked);
        this.spot.x += this.rng.range(-0.06, 0.06);
        this.spot.y += this.rng.range(-0.06, 0.06);
        this.timer = this.nextDwell();
      } else {
        this.point.copy(this.awayPoint);
        this.look.target = this.point;
        return;
      }
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      // Chance of looking away scales with how uninterested this character
      // is: fully engaged, they almost never break off.
      const distract = (1 - this.engagement) * 0.55;
      if (this.rng.next() < distract) this.glanceAway();
      else this.pick();
    }
    this.project();
    this.look.target = this.point;
  }

  /** Choose a new spot on the panel and how long to hold it. */
  private pick(): void {
    // Biased toward the middle: the sum of two uniforms is a triangular
    // distribution, which puts most fixations near the centre of the picture
    // and few at the edges — which is where they actually land.
    const tri = (): number => (this.rng.next() + this.rng.next() - 1) * 0.5;
    this.spot.set(tri() * this.roam, tri() * this.roam, 0);
    this.timer = this.nextDwell();
    this.project();
  }

  private nextDwell(): number {
    // Exponential-ish: many short holds, a few long ones. A fixed interval
    // reads as a metronome the moment there is more than one watcher.
    return this.dwell * (0.35 + -Math.log(1 - this.rng.next() * 0.95) * 0.8);
  }

  private glanceAway(): void {
    this.parked.copy(this.spot);
    this.awayTimer = this.rng.range(0.45, 1.7);
    // Off to one side and usually a little down — the direction of a glance
    // at a phone, a mug, or whoever just walked in.
    const side = this.rng.next() < 0.5 ? -1 : 1;
    const head = this.rig.bones.Head.getWorldPosition(new Vector3());
    const forward = new Vector3(0, 0, 1).applyQuaternion(this.rig.object.quaternion);
    const right = new Vector3(forward.z, 0, -forward.x);
    this.awayPoint
      .copy(head)
      .addScaledVector(forward, this.rng.range(0.8, 1.6))
      .addScaledVector(right, side * this.rng.range(0.4, 1.1))
      .addScaledVector(new Vector3(0, 1, 0), this.rng.range(-0.55, 0.1));
    this.point.copy(this.awayPoint);
  }

  /** Panel-local spot → world point. */
  private project(): void {
    const view = this.view;
    if (!view) return;
    view.surface.updateWorldMatrix(true, false);
    this.point
      .set(this.spot.x * view.width, this.spot.y * view.height, 0)
      .applyMatrix4(view.surface.matrixWorld);
  }
}
