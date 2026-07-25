import { AnimationAction, AnimationClip, Object3D, Quaternion, Vector3 } from 'three';
import { buildClip, Pose } from './clips';
import type { HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';
import type { QuadrupedRig } from './quadruped';
import type { GaitName } from './gaits';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const TAU = Math.PI * 2;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/**
 * How a rider is sitting. Riders do not simply "sit on" a moving horse —
 * each gait is ridden *differently*, and using the wrong seat for the gait
 * is instantly readable to anyone who has ridden:
 *
 * - **`seat`** — sitting deep, legs long, hips following the movement.
 *   Right for walk and canter.
 * - **`posting`** — the rising trot: the rider stands and sits on
 *   alternate diagonals, once per stride. You post to a trot precisely
 *   *because* a trot is level and two-beat, and you cannot post to a
 *   canter. It is the most recognisable thing a rider does.
 * - **`twoPoint`** — out of the saddle, weight in the stirrups, folded
 *   forward over the withers. The gallop and jumping seat.
 */
export type RideSeat = 'seat' | 'posting' | 'twoPoint';

/** Which stage of getting on (or off) the rider is at. */
export type MountPhase = 'off' | 'reaching' | 'stirrup' | 'swinging' | 'seated' | 'dismounting';

export interface RideClipOptions {
  /**
   * How wide the thighs splay around the barrel, radians. It has to be
   * enough to clear a horse's ribs — too little and the rider's legs sink
   * into the animal, which is the first thing anyone notices. Default 0.58.
   */
  straddle?: number;
}

/**
 * The seated riding pose for a given seat.
 *
 * The details that make it read: the thigh lies along the horse rather
 * than gripping upward, the **heel is lower than the toe** (the single
 * most-drilled thing in riding), and the hands are carried forward and
 * close together where the reins actually are — not resting in the
 * rider's lap.
 */
export function createRideClip(
  rig: HumanoidRig,
  seat: RideSeat = 'seat',
  options: RideClipOptions = {}
): AnimationClip {
  const straddle = options.straddle ?? 0.58;
  const duration = seat === 'posting' ? 0.72 : 3.0;
  return buildClip(rig, `ride-${seat}`, duration, 30, (p, pose: Pose) => {
    // Posting rises once per stride; the others breathe slowly.
    const beat = seat === 'posting' ? smooth(clamp01(Math.sin(TAU * p) * 0.5 + 0.5)) : 0;
    const breath = Math.sin(TAU * p) * 0.5;
    const up = seat === 'twoPoint' ? 1 : beat;

    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      // Thigh forward and out around the barrel; knee bent; heel DOWN.
      const thigh = 0.72 - 0.26 * up;
      const knee = 0.95 + 0.5 * up;
      pose.rotate(`${side}UpLeg`, [X, -thigh], [Z, -s * straddle]);
      pose.rotate(`${side}Leg`, [X, knee]);
      pose.rotate(`${side}Foot`, [X, -0.34 - 0.1 * up]); // toe up, heel down
      // Hands forward, low and together — where a rein actually goes.
      const reach = 0.95 + 0.18 * up;
      pose.rotate(`${side}Arm`, [X, -reach], [Z, -s * (1.2 - 0.12 * up)]);
      pose.rotate(`${side}ForeArm`, [Y, -s * (0.55 + 0.15 * up)], [X, -0.25]);
    }

    // Rising out of the saddle: hips lift and the body folds forward over
    // the horse's centre of gravity.
    const fold = seat === 'twoPoint' ? 0.42 : 0.1 + 0.24 * beat;
    pose.hipsY = rig.bones.Hips.position.y + up * 0.055 * rig.height;
    pose.rotate('Hips', [X, -0.05 + 0.04 * breath]);
    pose.rotate('Spine', [X, fold * 0.5]);
    pose.rotate('Chest', [X, fold * 0.5]);
    pose.rotate('Head', [X, -fold * 0.75]); // eyes up, between the ears
  });
}

export interface MountOptions {
  /** Seconds for each stage of getting on. Default 0.55. */
  stage?: number;
  /**
   * Which side to mount from. Riders mount from the horse's **left**
   * ("near") side, near-universally — a convention old enough to come
   * from wearing a sword on the left hip. Default 'near'.
   */
  side?: 'near' | 'off';
}

type MountListener = (phase: MountPhase) => void;

/**
 * Getting on a horse, the way it is actually done.
 *
 * Mounting is not a teleport, and it is not one motion either — it is a
 * short sequence with a specific shape, and every part of it is legible:
 *
 * 1. **reaching** — stand at the horse's near shoulder, facing its tail,
 *    and take hold of the saddle. (Facing the tail, not the head: it means
 *    that if the horse walks off, you swing *with* it rather than being
 *    dragged.)
 * 2. **stirrup** — left foot into the stirrup, and push up off the right
 *    leg until standing tall alongside.
 * 3. **swinging** — the right leg swings over the croup, clear of the
 *    horse's back.
 * 4. **seated** — sink into the saddle and find the other stirrup.
 *
 * ```ts
 * const mount = new Mount(rig, loco);
 * mount.mount(horse);                       // plays the whole sequence
 * game.onUpdate((t) => mount.update(t.delta));
 * mount.seat = 'posting';                   // rise to the trot
 * mount.dismount();
 * ```
 *
 * Once seated the rider is parented to the horse's `saddle`, so they ride
 * whatever the horse does with no further bookkeeping.
 */
export class Mount {
  /** How the rider is sitting. Set from the horse's gait, or by hand. */
  seat: RideSeat = 'seat';

  private readonly rig: HumanoidRig;
  private readonly loco: Locomotion;
  private readonly stage: number;
  private readonly side: number; // +1 near (horse's left), −1 off
  private readonly listeners = new Set<MountListener>();
  private readonly clips = new Map<string, AnimationClip>();
  private horse: QuadrupedRig | null = null;
  private action: AnimationAction | null = null;
  private state: MountPhase = 'off';
  private t = 0;
  private from = new Vector3();
  private fromQ = new Quaternion();
  private worldRoot: Object3D | null = null;
  private weight = 0;
  /**
   * How far to drop the rider's root so their SEAT lands on the saddle.
   *
   * A humanoid rig's origin is between its feet, so parenting it straight
   * to a saddle stands the rider on the horse's back with their hips a
   * metre in the air — which is exactly what it looks like. Sitting means
   * putting the *hip joint* on the seat, so the root goes down by the
   * rig's own hip height (less a little, since the seat is under the
   * pelvis rather than through it).
   */
  private readonly seatDrop: number;

  constructor(rig: HumanoidRig, loco: Locomotion, options: MountOptions = {}) {
    this.rig = rig;
    this.loco = loco;
    this.stage = options.stage ?? 0.55;
    this.side = (options.side ?? 'near') === 'near' ? 1 : -1;
    this.seatDrop = rig.bones.Hips.position.y - 0.06 * rig.height;
  }

  get phase(): MountPhase {
    return this.state;
  }

  /** Is the rider in the saddle (or on the way out of it)? */
  get mounted(): boolean {
    return this.state === 'seated' || this.state === 'swinging';
  }

  /** The horse being ridden, if any. */
  get steed(): QuadrupedRig | null {
    return this.horse;
  }

  onPhase(listener: MountListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Begin the mounting sequence. The rider should already be alongside. */
  mount(horse: QuadrupedRig): void {
    if (this.state !== 'off') return;
    this.horse = horse;
    this.worldRoot = this.rig.object.parent;
    this.capture();
    this.go('reaching');
  }

  /** Step down. Reverses the swing and puts the rider back on the ground. */
  dismount(): void {
    if (!this.mounted) return;
    // Come out of the saddle's space first: the step-down waypoints are
    // world-space, and computing them while still parented to a moving
    // horse would swing the rider round with it.
    this.detach();
    this.capture();
    this.go('dismounting');
  }

  /**
   * Pick the seat a rider would use for this gait: post to the trot, sit
   * to the walk and canter, and get up off the horse's back to gallop.
   */
  seatFor(gait: GaitName): RideSeat {
    if (gait === 'trot') return 'posting';
    if (gait === 'gallop') return 'twoPoint';
    return 'seat';
  }

  /** Follow the horse: adopt the right seat, at the right tempo. */
  followGait(gait: GaitName, strideRate = 1): void {
    const want = this.seatFor(gait);
    if (want !== this.seat) {
      this.seat = want;
      if (this.state === 'seated') this.playSeat();
    }
    // Posting is locked to the trot's rhythm — one rise per stride.
    if (this.action && this.seat === 'posting') this.action.timeScale = strideRate;
  }

  update(dt: number): void {
    if (this.state === 'off' || !this.horse) return;
    const target = this.state === 'seated' || this.state === 'swinging' ? 1 : 0.35;
    this.weight += (target - this.weight) * Math.min(1, dt * 6);
    this.loco.influence = 1 - this.weight;

    if (this.state === 'seated') return; // parented to the saddle; nothing to do
    this.t += dt / this.stage;
    const k = smooth(clamp01(this.t));
    const to = this.waypoint(this.state);
    this.rig.object.position.lerpVectors(this.from, to.position, k);
    this.rig.object.quaternion.slerpQuaternions(this.fromQ, to.quaternion, k);

    if (this.t < 1) return;
    if (this.state === 'reaching') this.go('stirrup');
    else if (this.state === 'stirrup') this.go('swinging');
    else if (this.state === 'swinging') this.sit();
    else if (this.state === 'dismounting') this.land();
  }

  // --- internals ---------------------------------------------------------

  private go(phase: MountPhase): void {
    this.state = phase;
    this.t = 0;
    this.capture();
    for (const listener of [...this.listeners]) listener(phase);
  }

  private capture(): void {
    this.from.copy(this.rig.object.position);
    this.fromQ.copy(this.rig.object.quaternion);
  }

  /**
   * Where the rider's root belongs at the END of each stage, expressed in
   * whatever space the rider is currently parented to.
   */
  private waypoint(phase: MountPhase): { position: Vector3; quaternion: Quaternion } {
    const horse = this.horse!;
    horse.saddle.updateWorldMatrix(true, false);
    const seat = horse.saddle.getWorldPosition(new Vector3());
    const facing = horse.saddle.getWorldQuaternion(new Quaternion());
    // The horse's left, in world space.
    const left = new Vector3(1, 0, 0).applyQuaternion(facing).multiplyScalar(this.side);
    const back = new Vector3(0, -1, 0).applyQuaternion(facing).setY(0).normalize();
    const ground = seat.y - horse.height * 0.86;

    const position = new Vector3();
    const quaternion = new Quaternion();
    if (phase === 'reaching' || phase === 'dismounting') {
      // Standing at the near shoulder, facing across the horse (toward its
      // tail) — the stance you take hold of the saddle from.
      position.copy(seat).addScaledVector(left, horse.height * 0.42).setY(ground);
      quaternion.setFromUnitVectors(new Vector3(0, 0, 1), left.clone().negate());
    } else if (phase === 'stirrup') {
      // Risen in the stirrup: standing tall alongside, feet at stirrup
      // height — roughly half a metre under the seat, not level with it.
      position.copy(seat).addScaledVector(left, horse.height * 0.3).setY(seat.y - 0.52);
      quaternion.setFromUnitVectors(new Vector3(0, 0, 1), left.clone().negate());
    } else {
      // Leg over: swinging across, already most of the way down to the
      // seated height so the last beat is a settle, not a drop.
      position
        .copy(seat)
        .addScaledVector(left, horse.height * 0.05)
        .setY(seat.y - this.seatDrop + 0.22);
      quaternion.copy(facing);
    }
    void back;

    const parent = this.rig.object.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(position);
      quaternion.premultiply(parent.getWorldQuaternion(new Quaternion()).invert());
    }
    return { position, quaternion };
  }

  /** Settle into the saddle and hand the body over to the horse. */
  private sit(): void {
    const horse = this.horse!;
    horse.saddle.add(this.rig.object);
    // Sit the rider's HIPS on the saddle, not their feet.
    this.rig.object.position.set(0, -this.seatDrop, 0);
    this.rig.object.quaternion.identity();
    this.state = 'seated';
    this.playSeat();
    for (const listener of [...this.listeners]) listener('seated');
  }

  /** Back on the ground: hand the body back to locomotion. */
  private land(): void {
    if (this.action) {
      this.loco.stopOverlay(this.action, 0.3);
      this.action = null;
    }
    this.state = 'off';
    this.horse = null;
    this.weight = 0;
    this.loco.influence = 1;
    for (const listener of [...this.listeners]) listener('off');
  }

  private playSeat(): void {
    if (this.action) this.loco.stopOverlay(this.action, 0.3);
    let clip = this.clips.get(this.seat);
    if (!clip) {
      clip = createRideClip(this.rig, this.seat);
      this.clips.set(this.seat, clip);
    }
    this.action = this.loco.overlay(clip, { fadeIn: 0.35 });
  }

  /**
   * Take the rider off the horse and back into the world, preserving their
   * world transform — call before `dismount` if the rider was parented.
   */
  detach(): void {
    if (!this.worldRoot || this.rig.object.parent === this.worldRoot) return;
    const position = this.rig.object.getWorldPosition(new Vector3());
    const quaternion = this.rig.object.getWorldQuaternion(new Quaternion());
    this.worldRoot.add(this.rig.object);
    this.worldRoot.updateWorldMatrix(true, false);
    this.rig.object.position.copy(this.worldRoot.worldToLocal(position));
    this.rig.object.quaternion.copy(
      quaternion.premultiply(this.worldRoot.getWorldQuaternion(new Quaternion()).invert())
    );
  }
}
