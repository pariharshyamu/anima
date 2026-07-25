import { Euler, Object3D, Quaternion, Vector3 } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';
import type { Locomotion } from './locomotion';

/**
 * Sea legs — standing up on something that will not stand still.
 *
 * SCENA's decked ships publish a deck as a **frame** rather than a height:
 *
 * ```ts
 * deckAt(x, z, near?): number | null
 * ride(position): Vector3
 * normalAt(x, z): Vector3
 * ```
 *
 * Structural, as ever — anything with those three works, and neither
 * library imports the other. What this controller adds is the body's answer
 * to them, and there are exactly three parts to it:
 *
 * 1. **Get carried.** `ride` the root every frame, before anything else. A
 *    character standing still on a deck making six knots is travelling at
 *    six knots, and if nobody applies that they walk out through the stern.
 *    This is not animation; skip it and no amount of leaning helps.
 *
 * 2. **Stand up, not square.** The deck leans; a person does not lean with
 *    it. They keep their head over their feet and take the angle up in the
 *    legs and the spine — which is why a sailor on a heeling ship looks
 *    upright and a crate on the same deck looks tipped over. The rig is
 *    rotated INTO the deck's frame and then given back some of the world's
 *    vertical, and how much is the whole of `balance`.
 *
 * 3. **Lose it sometimes.** Past a threshold on the vessel's own `motion`
 *    the compensation stops working and the body staggers — a lurch that
 *    decays, thrown by the deck rather than chosen.
 *
 * ```ts
 * const legs = new SeaLegs(rig, loco);
 * game.onUpdate((t) => {
 *   ship.update(t.delta, { speed: 5 });
 *   loco.update(t.delta, walkVelocity);
 *   legs.update(t.delta, ship);      // ride, plant, lean, stagger
 * });
 * ```
 */

const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const kick = new Quaternion();
const kickEuler = new Euler();
const spin = new Quaternion();
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * What a deck has to be. Structurally SCENA's `DeckField` plus the one
 * reading that says how lively it is.
 */
export interface Deck {
  deckAt(x: number, z: number, near?: number): number | null;
  normalAt(x: number, z: number): Vector3;
  ride(position: Vector3): Vector3;
  /** 0 (alongside) to 1 (hang on). Optional — a jetty has no motion. */
  readonly motion?: number;
}

export interface SeaLegsOptions {
  /**
   * How much of the deck's lean the body keeps, 0–1. Default 0.25.
   *
   * **Not** 1 and not 0. At 1 the character is welded square to the deck
   * and rolls with it like cargo; at 0 they stay bolt upright and their
   * feet slide off the planking. A person takes most of it up in the ankles
   * and knees and keeps their head over their feet, so a quarter of it
   * reaches the torso — and that residue is what reads as "standing on a
   * ship" rather than "standing near one".
   */
  lean?: number;
  /** `motion` above which somebody starts to stagger. Default 0.45. */
  footing?: number;
  /** How hard a stagger throws the body, radians. Default 0.3. */
  stagger?: number;
  /** Seconds a stagger takes to die away. Default 1.1. */
  recover?: number;
  seed?: number;
}

/** A cheap deterministic wobble, so two sailors do not lurch in unison. */
function noise(seed: number): (t: number) => number {
  const a = 12.9898 + seed * 0.137;
  const b = 78.233 + seed * 0.911;
  return (t: number) => {
    const s = Math.sin(t * a) * 43758.5453 + Math.sin(t * b) * 2311.77;
    return (s - Math.floor(s)) * 2 - 1;
  };
}

export class SeaLegs {
  /** Whether the character is currently on a deck at all. */
  aboard = false;
  /** How hard they are working to stay up, 0–1 — the vessel's motion, eased. */
  effort = 0;
  /** True while a stagger is playing out. */
  staggering = false;

  private readonly lean: number;
  private readonly footing: number;
  private readonly throwBy: number;
  private readonly recover: number;
  private readonly wobbleA: (t: number) => number;
  private readonly wobbleB: (t: number) => number;

  private clock = 0;
  private lurch = 0;
  private lurchRoll = 0;
  private lurchPitch = 0;
  private readonly deckUp = new Vector3(0, 1, 0);
  private readonly want = new Quaternion();
  private readonly upright = new Quaternion();
  /**
   * What this controller added to the root LAST frame.
   *
   * It has to be undone before the next one goes on. Premultiplying a fresh
   * correction onto an already-corrected quaternion every frame compounds
   * without bound — the first version had a sailor at five radians off
   * vertical after two seconds, spinning like a top. The heading still
   * belongs to whatever is steering the body; this only ever contributes
   * its own term and takes it back again.
   */
  private readonly applied = new Quaternion();
  private readonly undo = new Quaternion();
  private readonly base: Record<string, Quaternion> = {};

  constructor(
    private readonly rig: HumanoidRig,
    private readonly loco: Locomotion,
    options: SeaLegsOptions = {}
  ) {
    this.lean = clamp01(options.lean ?? 0.25);
    this.footing = options.footing ?? 0.45;
    this.throwBy = options.stagger ?? 0.3;
    this.recover = Math.max(0.2, options.recover ?? 1.1);
    const seed = options.seed ?? 1;
    this.wobbleA = noise(seed);
    this.wobbleB = noise(seed + 17);
    for (const bone of ['Hips', 'Spine', 'Chest'] as BoneName[]) {
      this.base[bone] = this.rig.bones[bone].quaternion.clone();
    }
  }

  /** Throw the body now — a wave, a collision, a rope parting. */
  lurchNow(strength = 1): void {
    this.lurch = Math.max(this.lurch, clamp01(strength));
    this.lurchRoll = this.wobbleA(this.clock) * this.throwBy * strength;
    this.lurchPitch = this.wobbleB(this.clock) * this.throwBy * 0.6 * strength;
  }

  /**
   * Ride the deck, plant on it, and take the angle.
   *
   * Call it **after** `Locomotion.update` — the gait writes the body's own
   * motion and this rewrites where that motion happened.
   */
  update(dt: number, deck: Deck | null): void {
    if (dt <= 0) return;
    this.clock += dt;
    const root = this.rig.object;

    // Take back last frame's contribution before doing anything else.
    root.quaternion.premultiply(this.undo.copy(this.applied).invert());
    this.applied.identity();

    if (!deck) {
      this.aboard = false;
      this.effort += (0 - this.effort) * Math.min(1, dt * 2);
      this.relax(dt);
      return;
    }

    // 1. GET CARRIED. First, and before anything reads the position — the
    //    part that is not animation at all, and the part that no amount of
    //    leaning substitutes for.
    deck.ride(root.position);

    const height = deck.deckAt(root.position.x, root.position.z, root.position.y);
    this.aboard = height !== null;
    if (height === null) {
      this.effort += (0 - this.effort) * Math.min(1, dt * 2);
      this.relax(dt);
      return;
    }
    root.position.y = height;

    const motion = clamp01(deck.motion ?? 0);
    this.effort += (motion - this.effort) * Math.min(1, dt * 2.5);

    // 2. STAND UP, NOT SQUARE. Rotate into the deck's frame, then give most
    //    of the world's vertical back. A body welded square to the deck is
    //    cargo; a body ignoring it entirely has its feet through the planks.
    this.deckUp.copy(deck.normalAt(root.position.x, root.position.z)).normalize();
    this.want.setFromUnitVectors(Y, this.deckUp);
    this.upright.identity();
    // `lean` of the deck's tilt reaches the body. The rest is absorbed by
    // legs the rig does not have joints fine enough to show, which is
    // exactly why this is a blend and not an IK chain.
    this.want.slerp(this.upright, 1 - this.lean);

    // 3. LOSE IT SOMETIMES.
    if (motion > this.footing && this.lurch <= 0.02) {
      // Chance rises with how far past the threshold it is, so a lively sea
      // throws you often and a moderate one occasionally.
      const over = (motion - this.footing) / Math.max(0.05, 1 - this.footing);
      if (this.wobbleA(this.clock * 3.1) > 1 - over * dt * 6) this.lurchNow(over);
    }
    if (this.lurch > 0) {
      this.lurch = Math.max(0, this.lurch - dt / this.recover);
      const f = this.lurch * this.lurch;
      const roll = this.lurchRoll * f;
      const pitch = this.lurchPitch * f;
      this.want.multiply(kick.setFromEuler(kickEuler.set(pitch, 0, roll, 'XYZ')));
      // …and it reaches the spine, not only the hips, or it reads as the
      // whole body being tilted by a puppeteer.
      this.bend('Spine', pitch * 0.5, roll * 0.5);
      this.bend('Chest', pitch * 0.3, roll * 0.35);
    } else {
      this.relax(dt);
    }
    this.staggering = this.lurch > 0.02;

    // A constant small sway even when the footing is fine — nobody stands
    // perfectly still on a deck, and the absence of it is the tell.
    const sway = this.effort * 0.05 + 0.008;
    this.want.multiply(spin.setFromAxisAngle(Z, this.wobbleB(this.clock * 0.9) * sway));

    root.quaternion.premultiply(this.want);
    this.applied.copy(this.want);
    void this.loco;
  }

  /** Ease a spine bone back toward where it started. */
  private relax(dt: number): void {
    const k = Math.min(1, dt * 4);
    for (const bone of ['Spine', 'Chest'] as BoneName[]) {
      this.rig.bones[bone].quaternion.slerp(this.base[bone], k);
    }
  }

  private bend(bone: BoneName, pitch: number, roll: number): void {
    this.rig.bones[bone].quaternion
      .copy(this.base[bone])
      .multiply(kick.setFromEuler(kickEuler.set(pitch, 0, roll, 'XYZ')));
  }

  /** Where the character is standing, if anywhere. */
  get footingAt(): Object3D {
    return this.rig.object;
  }

  /** Stop compensating and hand the body back. */
  release(): void {
    this.rig.object.quaternion.premultiply(this.undo.copy(this.applied).invert());
    this.applied.identity();
    this.lurch = 0;
    this.staggering = false;
    for (const bone of ['Spine', 'Chest'] as BoneName[]) {
      this.rig.bones[bone].quaternion.copy(this.base[bone]);
    }
  }
}
