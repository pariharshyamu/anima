/**
 * Brows — and a brow raise is PUNCTUATION before it is emotion.
 *
 * Every rig that animates eyebrows animates them from a mood: raise them for
 * surprise, lower them for anger, and leave them still the rest of the time. A
 * face built that way is motionless through an entire sentence, which is the
 * thing that reads as dead and which nobody can name when they see it.
 *
 * Ekman's *About Brows* (1979) is about exactly this. The brow raise is a
 * **conversational signal**: it marks the word being emphasised, it goes up on
 * a question, and it fires on greeting whether or not anyone is pleased about
 * anything. Cavé, Guaïtella, Bertrand, Santi, Harlay & Espesser (1996) measured
 * the correlation directly and found roughly **seven in ten brow raises coincide
 * with a rise in F0**.
 *
 * So the brow does not need a mood. It needs a pitch contour.
 *
 * ## The seam
 *
 * `PitchSource` is `(seconds) => number`, in SEMITONES relative to whoever is
 * speaking. GAMA's `SpokenLine.pitchAt` has that signature. It imports nothing
 * from here, this imports nothing from there, and what makes them agree is not
 * a type — it is that a pitch accent and a brow raise are one gesture, made by
 * two muscles a hundred millimetres apart, at the same instant, for the same
 * reason.
 *
 * Semitones and not hertz, because a face does not care how big a larynx is.
 *
 * ## The part that is not a copy of the pitch
 *
 * A brow tracks the ACCENT, not the pitch. English declines: 't Hart, Collier
 * and Cohen (1990) put the drift at about half a semitone a second, so across a
 * four-second sentence the whole contour sinks a couple of semitones while the
 * accents keep landing. A brow wired straight to pitch sinks with it and the
 * speaker looks like they are falling asleep by the full stop.
 *
 * So what drives the brow is pitch ABOVE A RUNNING BASELINE, and the gate's
 * load-bearing claim is that the last accent of a long statement raises the brow
 * as far as the first one does.
 */

import { Group, Mesh, MeshStandardMaterial, BoxGeometry } from 'three';
import type { HumanoidRig } from './humanoid';

/**
 * Maximal brow elevation, metres, on a 1.75 m body.
 *
 * The frontalis lifts the brow about ten millimetres at full voluntary
 * contraction. Scaled off body height like every other length here, so a child
 * and an adult raise their brows in the same proportion to their own face.
 */
export const BROW_TRAVEL = 0.010;

/**
 * The eyebrow FLASH: a full raise and return, seconds.
 *
 * Eibl-Eibesfeldt (1972) filmed greetings across cultures and found the same
 * gesture everywhere at about a sixth of a second — one of the few facial
 * movements with a serious claim to being universal. It is a duration, and it
 * is the only published timing this file needs, because the SPEED LIMIT below
 * comes out of it rather than being chosen alongside it.
 */
export const BROW_FLASH = 1 / 6;

/**
 * Peak brow speed, metres per second — derived, not picked.
 *
 * A flash covers the full travel up and back down in `BROW_FLASH`, so the way
 * up takes half of it. That is `BROW_TRAVEL / (BROW_FLASH / 2)`, and it is the
 * fastest a brow is observed to move. Change either published number and this
 * moves with it.
 *
 * It matters because a pitch contour has steps in it — a syllable boundary is a
 * discontinuity — and a brow that teleported between them would look like a
 * switch rather than a muscle.
 */
export const BROW_SPEED = BROW_TRAVEL / (BROW_FLASH / 2);

/**
 * The pitch excursion, in semitones, that earns a full brow raise.
 *
 * 't Hart, Collier and Cohen (1990) measured accent-lending pitch movements in
 * conversational speech at about five semitones. This file cites them directly
 * rather than importing anything: the number is in the literature, not in the
 * other package.
 */
export const ACCENT_SEMITONES = 5;

/**
 * Time constant of the declination line, seconds — derived, and it only FALLS.
 *
 * It has to be SLOWER than a syllable, or it tracks the accent it is supposed to
 * be measuring against and the brow never moves. It has to be FASTER than a
 * phrase, or it cannot follow the drift at all. A syllable is about 0.19 s at
 * conversational rate and a phrase about three seconds, so the constant is the
 * geometric mean — the one value equally far from both failures.
 *
 * AND IT DOES NOT RISE INSIDE A PHRASE. Declination is a downtrend: 't Hart,
 * Collier and Cohen draw the line through the VALLEYS, the accents ride on top
 * of it, and within a phrase it goes one way. A baseline that could also rise is
 * pulled up by the accent train itself, so each accent is measured against a
 * floor its own predecessors raised — and the later ones in a line come out
 * smaller for no reason but the filter. The gate caught that as the last accent
 * of a six-second line holding 92% of the first, and it was not the muscle: the
 * TARGET held 92% before the speed limit ever saw it.
 *
 * A new phrase starts a new line, which is what `attach` is for. That is also
 * what a pitch reset is in the prosody it is following.
 */
export const BASELINE_TAU = Math.sqrt(0.19 * 3);

/** What a brow is doing, 0..1. */
export interface BrowShape {
  /** Elevation, 0 at rest to 1 at full frontalis contraction. AU1 + AU2. */
  raise: number;
}

/** A pitch contour from somewhere else, asked for at a time. Semitones. */
export type PitchSource = (seconds: number) => number;

/** What a live pitch source needs to say about itself besides its pitch. */
export interface BrowOptions {
  /** The authoritative clock, seconds. Omit to use this controller's own. */
  clock?: () => number;
  /** Whether the source has finished. Omit and the brows follow until detached. */
  done?: () => boolean;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/**
 * Drives a pair of brows from a pitch contour.
 *
 * The mirror of `Speech`: `attach` a source, `update` every frame, and the
 * result is rate-limited by a published speed rather than snapping.
 */
export class Brows {
  /** The current elevation, 0..1. */
  shape: BrowShape = { raise: 0 };
  /** How far this face's brows travel, metres. Scaled off the body. */
  travel = BROW_TRAVEL;
  elapsed = 0;

  private source: PitchSource | null = null;
  private clock: (() => number) | null = null;
  private sourceDone: (() => boolean) | null = null;
  private baseline = 0;
  private seeded = false;
  private flashUntil = -1;

  /** Follow a pitch contour. */
  attach(source: PitchSource, options: BrowOptions = {}): void {
    this.source = source;
    this.clock = options.clock ?? null;
    this.sourceDone = options.done ?? null;
    this.elapsed = 0;
    this.baseline = 0;
    this.seeded = false;
  }

  detach(): void {
    this.source = null;
    this.clock = null;
    this.sourceDone = null;
  }

  get live(): boolean {
    return this.source !== null;
  }

  get done(): boolean {
    return this.sourceDone ? this.sourceDone() : false;
  }

  /**
   * The greeting flash — Eibl-Eibesfeldt's sixth of a second.
   *
   * It is not an emotion and it does not need one. It fires on recognition, it
   * is the same shape in every culture it has been filmed in, and it overrides
   * whatever the pitch is asking for while it lasts.
   */
  flash(): void {
    this.flashUntil = this.elapsed + BROW_FLASH;
  }

  /**
   * Step the brows.
   *
   * The target is pitch above a running baseline; what comes out is what a
   * frontalis can actually reach in the time available, which is the same
   * arrangement the jaw has and produces the same undershoot on a fast contour.
   */
  update(dt: number): BrowShape {
    const step = Math.max(0, dt);
    this.elapsed += step;

    let want = 0;
    if (this.source) {
      const t = (this.clock ? this.clock() : this.elapsed);
      const pitch = finite(this.source(t));
      // Exactly zero is what a source returns when there is nothing to say.
      // Holding the line through it means a pause does not drag the declination
      // down to the speaker's own f0 and turn the next phrase's first syllable
      // into a shout.
      if (pitch !== 0) {
        // THE BASELINE IS SEEDED, NOT STARTED AT ZERO. A speaker whose first
        // syllable is four semitones up would otherwise get a full raise on it
        // purely because the baseline had not caught up yet, and every line
        // would open with a jolt that is an artefact of initialisation.
        if (!this.seeded) {
          this.baseline = pitch;
          this.seeded = true;
        } else if (step > 0 && pitch < this.baseline) {
          this.baseline += (pitch - this.baseline) * (1 - Math.exp(-step / BASELINE_TAU));
        }
        want = Math.max(0, Math.min(1, (pitch - this.baseline) / ACCENT_SEMITONES));
      }
    }
    if (this.elapsed < this.flashUntil) want = 1;

    // The frontalis is a muscle, so it has a speed. Expressed in the shape's own
    // units by dividing the published speed by the published travel.
    const limit = (BROW_SPEED / BROW_TRAVEL) * step;
    const d = want - this.shape.raise;
    this.shape = { raise: this.shape.raise + Math.max(-limit, Math.min(limit, d)) };
    return this.shape;
  }
}

export interface BrowProp {
  group: Group;
  apply(shape: BrowShape): void;
}

/**
 * A pair of brows parented to the Head.
 *
 * An overlay, for the same reason the mouth is one: `createHumanoid` bakes the
 * face into the skinned mesh, so there is no brow bone and no morph target to
 * drive. These sit a hair in front of the baked pair and move.
 */
export function createBrows(rig: HumanoidRig): BrowProp {
  const H = rig.height;
  const group = new Group();
  // Where `createHumanoid` puts the baked brows: 0.098 H up, and the eyes are
  // 0.021 H either side of centre.
  const ex = 0.021 * H;
  // The face's own brows are seeded — `createHumanoid` gives each one an angle
  // and a thickness — so the overlay takes BOTH from the rig it is parented to.
  // Without that the two disagree: the baked pair is rotated by up to a sixth
  // of a radian and its ends poke out from behind a horizontal overlay, which
  // draws as one thick crooked brow and reads as a permanent frown.
  const seeded = rig.description.face.brows;
  const colour = 0x3a2a22;
  const bar = (): Mesh =>
    new Mesh(
      // A hair larger than the baked pair, so it covers rather than coincides.
      new BoxGeometry(0.035 * H, 0.009 * H * seeded.thickness, 0.009 * H),
      new MeshStandardMaterial({ color: colour, roughness: 0.85 })
    );
  const left = bar();
  const right = bar();
  left.position.x = -ex * 1.05;
  right.position.x = ex * 1.05;
  // The seeded angle is the face's, and the raise arches on top of it.
  left.rotation.z = -seeded.angle;
  right.rotation.z = seeded.angle;
  group.add(left, right);
  group.position.set(0, 0.098 * H, 0.0575 * H);
  rig.bones.Head.add(group);

  return {
    group,
    apply(shape: BrowShape): void {
      const scale = H / 1.75;
      const lift = Math.max(0, Math.min(1, finite(shape.raise))) * BROW_TRAVEL * scale;
      left.position.y = lift;
      right.position.y = lift;
      // A raised brow also arches: the inner end lifts less than the outer, so
      // the pair rotates slightly outward on top of whatever angle this face was
      // seeded with. AU1 and AU2 are separate muscles and AU2 wins at the tail;
      // this is the cheap picture of that.
      left.rotation.z = -seeded.angle - lift * 6;
      right.rotation.z = seeded.angle + lift * 6;
    },
  };
}
