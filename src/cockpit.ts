import { Object3D, Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

/**
 * Cockpit — the body of somebody strapped to an aeroplane.
 *
 * This is `SeaLegs` in a mirror, and the difference is the whole idea. A
 * sailor is *carried* by a deck and spends the day standing up out of its
 * frame: the deck heels, they stay vertical, and the tilt gets absorbed by
 * ankles and knees. A pilot is *bolted into* the frame by a five-point
 * harness. They do not get to stand up out of anything. Roll the aircraft
 * inverted and the pilot goes with it, because that is what a harness is
 * for — so this controller applies exactly none of SeaLegs' uprighting, and
 * the parenting (`seat`) does the work that `ride` did there.
 *
 * What is left, once the body has lost the argument about which way is up,
 * is the four things a pilot still owns:
 *
 * 1. **Weight.** The wings pull g and the body wears it. In a level turn the
 *    load is `1 / cos(bank)` — 2g at sixty degrees, and it runs away to
 *    infinity as the wings come vertical — plus whatever the pull adds,
 *    `V·q / g`. Under load the head sags, the chin drops, the spine
 *    compresses into the seat and the arms get heavy; push to zero and the
 *    body floats up off the cushion against the straps. One scalar,
 *    `load`, animates all of it.
 *
 * 2. **Gaze.** In a fight the eyes lead the aeroplane — the pilot is looking
 *    at the bandit long before the nose is. `watch` tracks anything with a
 *    world position, clamped to what a helmet and a seat actually allow, and
 *    `checkSix` buys a moment past that limit to look over the shoulder.
 *
 * 3. **The cost of the first two together.** Gaze authority falls as load
 *    rises: at 6g the head weighs six times what it does on the ground and
 *    cranking it around stops being free. Pull hard enough and the pilot
 *    stops being able to look at all — which is a mechanic, not a detail.
 *
 * 4. **Losing it.** Sustained g drains the blood from the head: `grey` rises,
 *    vision narrows, and past the limit comes G-LOC — the body goes slack
 *    and stays slack for a while after the g comes off, because you do not
 *    wake up the instant the wings unload.
 *
 * ```ts
 * const pilot = new Cockpit(rig, { greyAt: 5 });
 * pilot.seat(jet.object, { x: 0, y: 1.45, z: 2.4 });   // SCENA's canopy
 * game.onUpdate((t) => {
 *   flight.update(t.delta, controls);                   // GAMA flies it
 *   jet.update(t.delta, flight.aircraftInput);          // SCENA moves it
 *   pilot.watch(bandit.object);                         // eyes on the bandit
 *   pilot.update(t.delta, flight);                      // the body pays
 * });
 * ```
 *
 * The airframe argument is structural, as ever: `{ pitch, bank, speed? }` is
 * exactly the surface GAMA's `FlightController` already publishes, and
 * `HoverController` fits it too. Neither library imports the other.
 */

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Standard gravity. The units that make `load` read in g. */
const G = 9.81;

/**
 * What an aircraft has to be for a body to be strapped into it.
 * Structurally GAMA's `FlightController` (and `HoverController`, whose
 * pitch and bank come off the cyclic).
 */
export interface Airframe {
  /** Nose-up positive, radians. */
  readonly pitch: number;
  /** Right-wing-down positive, radians. */
  readonly bank: number;
  /** Metres per second. Default 60 when absent — a pull needs a speed. */
  readonly speed?: number;
  /** 0–1. Only used for the hand on the throttle. */
  readonly throttle?: number;
}

export interface CockpitOptions {
  /**
   * The load, in g, the body is fully braced against — where the sag,
   * compression and heavy arms reach their limit. Default 7.
   */
  gLimit?: number;
  /** Load above which vision starts to go. Default 5. */
  greyAt?: number;
  /** Seconds at (greyAt + 4) from clear vision to blackout. Default 4. */
  greyIn?: number;
  /** Seconds to recover from a full greyout once the g is off. Default 3.5. */
  greyOut?: number;
  /** Head yaw limit, radians. Default 1.35 (~77°). */
  gazeYaw?: number;
  /** Head pitch limit, radians. Default 0.6. */
  gazePitch?: number;
  /** Fires on entering G-LOC. */
  onGLOC?: () => void;
  /** Fires when the pilot comes back. */
  onRecover?: () => void;
  seed?: number;
}

/** Bones this controller contributes to, on top of whatever pose is playing. */
const DRIVEN: BoneName[] = ['Spine', 'Chest', 'Neck', 'Head', 'LeftArm', 'RightArm'];

export class Cockpit {
  /**
   * Current load in g, smoothed. 1 sitting on the ramp, 2 in a sixty-degree
   * turn, negative over the top of a push.
   */
  load = 1;
  /** How far gone the vision is, 0 (clear) to 1 (blackout). */
  grey = 0;
  /** True while unconscious. Set by `grey` reaching 1; clears with hysteresis. */
  gloc = false;
  /** True while `checkSix` is buying extra yaw. */
  cranked = false;

  private readonly gLimit: number;
  private readonly greyAt: number;
  private readonly greyIn: number;
  private readonly greyOut: number;
  private readonly gazeYaw: number;
  private readonly gazePitch: number;
  private readonly onGLOC?: () => void;
  private readonly onRecover?: () => void;

  private clock = 0;
  private lastPitch = 0;
  private started = false;
  private six = 0;
  private sixSide = 1;
  private target: Object3D | Vector3 | null = null;
  private yaw = 0;
  private headPitch = 0;
  private readonly wobble: (t: number) => number;

  /**
   * What this controller added to each bone last frame, so it can be taken
   * back before the next contribution goes on.
   *
   * A pose clip is normally playing underneath and the mixer rewrites these
   * bones every frame, which would hide the mistake — right up until
   * somebody drives a `Cockpit` with no clip running and the pilot winds
   * himself into a spiral. The same lesson SeaLegs learned at the root, one
   * layer down: only ever contribute a term, and always be able to give it
   * back.
   */
  private readonly applied = new Map<BoneName, Quaternion>();
  private appliedHipsY = 0;
  private readonly q = new Quaternion();
  private readonly delta = new Quaternion();
  private readonly local = new Vector3();
  private readonly world = new Vector3();
  private parent: Object3D | null = null;

  constructor(
    private readonly rig: HumanoidRig,
    options: CockpitOptions = {}
  ) {
    this.gLimit = Math.max(2, options.gLimit ?? 7);
    this.greyAt = options.greyAt ?? 5;
    this.greyIn = Math.max(0.5, options.greyIn ?? 4);
    this.greyOut = Math.max(0.5, options.greyOut ?? 3.5);
    this.gazeYaw = options.gazeYaw ?? 1.35;
    this.gazePitch = options.gazePitch ?? 0.6;
    this.onGLOC = options.onGLOC;
    this.onRecover = options.onRecover;
    const seed = options.seed ?? 1;
    this.wobble = (t: number) => {
      const s = Math.sin(t * (12.9898 + seed * 0.137)) * 43758.5453;
      return (s - Math.floor(s)) * 2 - 1;
    };
    for (const bone of DRIVEN) this.applied.set(bone, new Quaternion());
  }

  /**
   * Strap in: parent the body to the airframe and put it in the seat.
   *
   * After this the pilot has no world transform of their own — every
   * position and attitude the aircraft has is theirs too, which is the
   * entire physical claim this module makes. `offset` is in the aircraft's
   * local space (SCENA's fighter puts its canopy near `y 1.45, z 2.4`).
   */
  seat(anchor: Object3D, offset: { x?: number; y?: number; z?: number } = {}): void {
    this.parent = this.rig.object.parent;
    anchor.add(this.rig.object);
    this.rig.object.position.set(offset.x ?? 0, offset.y ?? 0, offset.z ?? 0);
    this.rig.object.quaternion.identity();
  }

  /** Unstrap: hand the body back to whatever held it before. */
  eject(): void {
    this.release();
    if (this.parent) this.parent.add(this.rig.object);
    else this.rig.object.removeFromParent();
    this.parent = null;
  }

  /** Look at something — anything with a world position. Null to face front. */
  watch(target: Object3D | Vector3 | null): void {
    this.target = target;
  }

  /**
   * Check six: crank the head past its normal limit for a moment.
   *
   * A pilot can get further round than a comfortable gaze allows, briefly,
   * by fighting the harness — and cannot hold it, which is why this takes a
   * duration rather than a flag.
   */
  checkSix(seconds = 1.4, side: 'left' | 'right' = 'left'): void {
    this.six = Math.max(this.six, seconds);
    this.sixSide = side === 'left' ? 1 : -1;
  }

  /**
   * Wear one frame of flight.
   *
   * Call it **after** the animation mixer has written the seated pose — this
   * layers onto that pose rather than replacing it.
   */
  update(dt: number, airframe: Airframe | null): void {
    if (dt <= 0) return;
    this.clock += dt;

    // Give back last frame's contribution before computing this one.
    for (const bone of DRIVEN) {
      const had = this.applied.get(bone)!;
      this.rig.bones[bone].quaternion.multiply(this.q.copy(had).invert());
      had.identity();
    }
    this.rig.bones.Hips.position.y -= this.appliedHipsY;
    this.appliedHipsY = 0;

    if (!airframe) {
      this.load += (1 - this.load) * Math.min(1, dt * 4);
      this.decayGrey(dt);
      return;
    }

    // 1. WEIGHT. Turn load is 1/cos(bank) — the geometry of holding altitude
    //    with a tilted lift vector, and the reason a 60° turn costs 2g and an
    //    80° turn costs six. The pull adds V·q/g on top. Bank is clamped
    //    short of vertical because the true value is a division by zero and
    //    a body cannot wear infinity.
    const bank = clamp(Math.abs(airframe.bank), 0, 1.45);
    const speed = airframe.speed ?? 60;
    const pitchRate = this.started ? (airframe.pitch - this.lastPitch) / dt : 0;
    this.lastPitch = airframe.pitch;
    this.started = true;
    const turn = 1 / Math.max(0.12, Math.cos(bank));
    const target = clamp(turn + (pitchRate * speed) / G, -3, 12);
    // The body lags the wings — flesh takes a moment to find out.
    this.load += (target - this.load) * Math.min(1, dt * 5);

    const heavy = clamp01((this.load - 1) / (this.gLimit - 1));
    const float = clamp01((1 - this.load) / 2);
    // A brace under load, plus the airframe's own buzz through the seat.
    const buzz = this.wobble(this.clock * 7) * 0.006 * (1 + heavy * 2);

    // 2. GAZE — worked out before the sag, because the sag limits it.
    this.aim(dt, heavy);

    // 3. THE BODY. Under g the head goes down and the spine shortens into
    //    the seat; at zero g everything comes up off the cushion.
    const slack = this.gloc ? 1 : 0;
    const sag = heavy * 0.5 + slack * 0.55 - float * 0.3;
    this.contribute('Spine', heavy * 0.12 - float * 0.06 + buzz, 0);
    this.contribute('Chest', heavy * 0.1 - float * 0.05 + buzz, 0);
    this.contribute('Neck', sag * 0.55, 0);
    this.contribute(
      'Head',
      sag * 0.75 + this.headPitch * (1 - slack),
      this.yaw * (1 - slack)
    );
    // Arms weigh what the body weighs. Under G-LOC they simply drop.
    const armDrop = heavy * 0.22 + slack * 0.7 - float * 0.12;
    this.contribute('LeftArm', armDrop, 0);
    this.contribute('RightArm', armDrop, 0);

    this.appliedHipsY = -(heavy * 0.035 - float * 0.02) * this.rig.legLength;
    this.rig.bones.Hips.position.y += this.appliedHipsY;

    // 4. LOSING IT.
    if (this.load > this.greyAt) {
      this.grey = clamp01(this.grey + ((this.load - this.greyAt) / 4 / this.greyIn) * dt);
    } else {
      this.decayGrey(dt);
    }
    if (!this.gloc && this.grey >= 1) {
      this.gloc = true;
      this.onGLOC?.();
    } else if (this.gloc && this.grey < 0.35) {
      // Hysteresis: consciousness comes back well after the g does not.
      this.gloc = false;
      this.onRecover?.();
    }
  }

  /** Where the pilot is looking, in the cockpit's frame: yaw, pitch. */
  get gaze(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.headPitch };
  }

  /** Take every contribution back and leave the pose as it was. */
  release(): void {
    for (const bone of DRIVEN) {
      const had = this.applied.get(bone)!;
      this.rig.bones[bone].quaternion.multiply(this.q.copy(had).invert());
      had.identity();
    }
    this.rig.bones.Hips.position.y -= this.appliedHipsY;
    this.appliedHipsY = 0;
    this.yaw = 0;
    this.headPitch = 0;
    this.six = 0;
    this.cranked = false;
  }

  /** Head toward the watched target, within what the neck and g allow. */
  private aim(dt: number, heavy: number): void {
    this.six = Math.max(0, this.six - dt);
    this.cranked = this.six > 0;

    let wantYaw = 0;
    let wantPitch = 0;
    if (this.target) {
      // The target's world position, brought into the seated body's frame —
      // the aircraft is upside down half the time, and a gaze computed in
      // world space would have the pilot looking at his own feet.
      if (this.target instanceof Object3D) this.target.getWorldPosition(this.world);
      else this.world.copy(this.target);
      this.local.copy(this.world);
      // Refresh the body's own world matrix first. Strapped in, its matrix
      // is the aircraft's, and the aircraft moved this frame — reading the
      // stale one aims the head at where the fight was last frame.
      this.rig.object.updateWorldMatrix(true, false);
      this.rig.object.worldToLocal(this.local);
      const flat = Math.hypot(this.local.x, this.local.z);
      wantYaw = Math.atan2(this.local.x, this.local.z);
      wantPitch = -Math.atan2(this.local.y - this.rig.height * 0.9, Math.max(0.2, flat));
    } else if (this.cranked) {
      wantYaw = this.sixSide * this.gazeYaw * 1.7;
    }

    // The limit: a helmet in a seat, less whatever the g is taking. At the
    // gLimit the neck has nothing left and the head faces where it is put.
    const authority = clamp01(1 - heavy * 0.75);
    const yawLimit = (this.cranked ? this.gazeYaw * 1.75 : this.gazeYaw) * authority;
    wantYaw = clamp(wantYaw, -yawLimit, yawLimit);
    wantPitch = clamp(wantPitch, -this.gazePitch * authority, this.gazePitch * authority);

    // Eyes snap, heads do not: a first-order chase, faster to acquire than
    // to give up. Under G-LOC nothing is chasing anything.
    const rate = this.gloc ? 3 : 7 * (0.35 + authority * 0.65);
    const k = Math.min(1, dt * rate);
    this.yaw += ((this.gloc ? 0 : wantYaw) - this.yaw) * k;
    this.headPitch += ((this.gloc ? 0.35 : wantPitch) - this.headPitch) * k;
  }

  private decayGrey(dt: number): void {
    this.grey = clamp01(this.grey - dt / this.greyOut);
    if (this.gloc && this.grey < 0.35) {
      this.gloc = false;
      this.onRecover?.();
    }
  }

  /** Add this frame's term to a bone and remember it for the undo. */
  private contribute(bone: BoneName, pitch: number, yaw: number): void {
    if (pitch === 0 && yaw === 0) return;
    // Yaw about the parent's up, then pitch: the head turns, then drops.
    // Scratch quaternions rather than fresh ones — six bones a frame at
    // sixty frames a second is not a place to allocate.
    this.delta.setFromAxisAngle(Y, yaw).multiply(this.q.setFromAxisAngle(X, pitch));
    this.rig.bones[bone].quaternion.multiply(this.delta);
    this.applied.get(bone)!.copy(this.delta);
  }
}
