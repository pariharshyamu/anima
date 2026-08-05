/**
 * The smile — two muscles, and only one of them can be faked.
 *
 * Guillaume Duchenne de Boulogne spent the 1850s applying electrodes to the
 * faces of his subjects and photographing what contracted. In *Mécanisme de la
 * physionomie humaine* (1862) he reported that a smile is not one muscle but
 * two, and that they are not equal:
 *
 * ```
 *   zygomaticus major (AU12)   pulls the lip corners up and out
 *   orbicularis oculi (AU6)    raises the cheek, narrows the eye
 * ```
 *
 * The first obeys the will. The second, he wrote, **"only obeys the sweet
 * emotions of the soul"** — it cannot be reliably contracted on purpose. That
 * is why a posed smile reaches the mouth and stops there, and why every viewer
 * on earth can tell, and why almost nobody can say what they noticed.
 *
 * ## Which is a fact about an API, not just about a face
 *
 * Every smile in every rig is one number. Turn it up, the mouth curves, done —
 * and it is *always* a posed smile, because one number cannot express the thing
 * Duchenne found. So this module does not have a `setSmile`. It has two verbs:
 *
 * ```ts
 *   face.pose(0.8);   // deliberate: AU12, and AU6 stays where it is
 *   face.feel(0.8);   // enjoyment:  both, together
 * ```
 *
 * **There is no way to command AU6 on its own, and that is deliberate.** If
 * there were, a caller could pose a Duchenne smile, and the marker would stop
 * marking anything. `npm run smile` builds an observer out of the published
 * criteria and shows that adding such a setter collapses its ability to tell
 * the two apart.
 *
 * ## The rest of the tells are timing
 *
 * Ekman and Friesen (1982) put the duration of a **felt** expression between
 * half a second and four seconds. Faster than that and it is not an emotion, it
 * is a signal; slower and it is a pose being held. This module does not choose
 * an onset for the deliberate smile — it takes one that puts the whole
 * expression under the published floor, because that is what being outside the
 * window means.
 *
 * Ekman, Hager and Friesen (1981) found deliberate expressions are more
 * **asymmetric** than spontaneous ones, and biased to the left side of the face.
 *
 * Schmidt, Ambadar, Cohn and Reed (2006) tracked lip-corner motion and found
 * spontaneous smile onsets are **smooth and single-peaked** in velocity, where
 * deliberate ones are steppier.
 *
 * Four published markers, four different laboratories, and the model is built
 * from exactly one of them.
 */

import { Group, Mesh, MeshStandardMaterial, BoxGeometry, Color } from 'three';
import type { HumanoidRig } from './humanoid';

/**
 * The shortest a felt expression lasts, seconds.
 *
 * Ekman & Friesen (1982). Under this and the face is signalling, not feeling.
 */
export const FELT_MIN = 0.5;

/**
 * ...and the longest. Over four seconds it is a pose being held.
 */
export const FELT_MAX = 4;

/**
 * How long a felt smile takes to reach its apex, seconds.
 *
 * The onset is the part Schmidt et al. measured, and a felt smile spends about
 * a third of its span getting there — which for the middle of the published
 * window is this. It is inside `FELT_MIN`..`FELT_MAX` by construction.
 */
export const FELT_ONSET = 0.6;

/**
 * How long a DELIBERATE smile takes to reach its apex, seconds.
 *
 * NOT A CHOSEN NUMBER: a posed smile's tell is that it is too fast to be felt,
 * so its onset is the published floor's own fraction — the whole expression
 * lands under `FELT_MIN` and therefore outside Ekman's window. Move the floor
 * and this moves with it.
 */
export const POSED_ONSET = FELT_MIN / 3;

/**
 * How much stronger a deliberate smile is on the left of the face.
 *
 * Ekman, Hager & Friesen (1981) found deliberate expressions are more
 * asymmetric than spontaneous ones and biased leftward. That it is leftward is
 * theirs; that it is a fifth is a judgement, and it is labelled as one.
 */
export const POSED_ASYMMETRY = 0.2;

/**
 * How far AU6 can narrow the palpebral aperture, as a fraction of it.
 *
 * Orbicularis oculi is a sphincter around the eye, so contracting it MUST close
 * the aperture somewhat — the cheek comes up and the lower lid with it. A third
 * is enough to read as a crinkle and nowhere near a blink, which is the whole
 * distinction: a Duchenne smile narrows an eye, it does not shut one.
 */
export const CHEEK_LID = 1 / 3;

/** What the smiling muscles are doing. */
export interface SmileShape {
  /** AU12, zygomaticus major — the lip corners. 0..1, per side. */
  corner: { left: number; right: number };
  /** AU6, orbicularis oculi — the cheek raise. 0..1, and never posed. */
  cheek: number;
}

export interface SmileOptions {
  /** Seconds to the apex of a felt smile. Defaults to the published-window one. */
  onset?: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);

/** Smooth, single-peaked in velocity — a raised cosine in position. */
const smooth = (t: number): number => 0.5 * (1 - Math.cos(Math.PI * clamp(t, 0, 1)));

/**
 * ...and the irregular one a deliberate smile arrives on.
 *
 * Hess & Kleck (1990) found deliberate expressions have steppier onsets than
 * spontaneous ones — they come in two goes, with a hitch between. That shows up
 * as extra sign changes in the acceleration, which is exactly what Schmidt et
 * al.'s single-peaked criterion is looking for the absence of.
 */
const stepped = (t: number): number => {
  const u = clamp(t, 0, 1);
  if (u < 0.45) return smooth(u / 0.45) * 0.55;
  if (u < 0.6) return 0.55;
  return 0.55 + smooth((u - 0.6) / 0.4) * 0.45;
};

/**
 * Drives a smile, and refuses to fake one.
 *
 * `pose()` is a deliberate smile and reaches AU12 only. `feel()` is enjoyment
 * and reaches both. There is no third method.
 */
export class Smile {
  shape: SmileShape = { corner: { left: 0, right: 0 }, cheek: 0 };
  /** True while the current expression is a felt one. */
  felt = false;
  elapsed = 0;

  private readonly feltOnset: number;
  private from: SmileShape = { corner: { left: 0, right: 0 }, cheek: 0 };
  private target = 0;
  private onset = 0;
  private running = false;

  constructor(options: SmileOptions = {}) {
    this.feltOnset = Math.max(1e-3, options.onset ?? FELT_ONSET);
  }

  /**
   * A DELIBERATE smile. Zygomaticus major, and nothing above the cheekbone.
   *
   * Duchenne's subjects could produce this at will and it is what a photograph
   * of somebody being told to smile contains. It is asymmetric and it arrives
   * too fast to be felt, and both of those are published tells rather than
   * decorations.
   */
  pose(intensity: number): void {
    this.#begin(intensity, false);
  }

  /**
   * ENJOYMENT. Both muscles, together, on the felt timing.
   *
   * There is no argument here for AU6 alone, and there will not be one: the
   * moment a caller can raise the cheek without meaning it, the marker stops
   * marking anything, and the gate measures exactly that.
   */
  feel(intensity: number): void {
    this.#begin(intensity, true);
  }

  /**
   * THE ONLY PLACE AU6 IS WRITTEN, AND IT IS A HASH-PRIVATE ON PURPOSE.
   *
   * `private` in TypeScript is a compile-time courtesy — the method is still on
   * the prototype at run time, and `smile.begin(0.9, true)` from JavaScript
   * would have posed a perfect Duchenne smile. The claim this module makes is
   * about what a caller CAN do, so it has to hold in the language the package
   * actually ships as. A `#` is the only thing that makes it true.
   */
  #begin(intensity: number, felt: boolean): void {
    this.from = { corner: { ...this.shape.corner }, cheek: this.shape.cheek };
    this.target = clamp(intensity, 0, 1);
    this.felt = felt;
    this.onset = felt ? this.feltOnset : POSED_ONSET;
    this.elapsed = 0;
    this.running = true;
  }

  /** Let it go, on the same timing it arrived with. */
  relax(): void {
    this.#begin(0, this.felt);
  }

  update(dt: number): SmileShape {
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    if (!this.running) return this.shape;
    this.elapsed += step;
    const t = clamp(this.elapsed / this.onset, 0, 1);
    const s = this.felt ? smooth(t) : stepped(t);

    // AU12 goes to where it was asked. Both sides — but a deliberate smile is
    // measurably lopsided, and stronger on the left.
    const lean = this.felt ? 0 : POSED_ASYMMETRY;
    const to = this.target;
    this.shape = {
      corner: {
        left: this.from.corner.left + (to - this.from.corner.left) * s,
        right: this.from.corner.right + (to * (1 - lean) - this.from.corner.right) * s,
      },
      // AND AU6 ONLY MOVES WHEN THE SMILE IS FELT. Not scaled down for a pose,
      // not delayed — absent. Duchenne's whole point is that it is a different
      // KIND of thing, and the model says so by leaving it where it was.
      cheek: this.felt ? this.from.cheek + (to - this.from.cheek) * s : this.from.cheek,
    };
    if (t >= 1) this.running = false;
    return this.shape;
  }

  /** How long this expression will have lasted, onset and offset, seconds. */
  get duration(): number {
    return this.onset * 2;
  }

  /** Seconds to the apex of whatever is running — felt or posed. */
  get onsetSeconds(): number {
    return this.onset;
  }
}

/**
 * Is this a felt smile, by the published criteria?
 *
 * THE OBSERVER, and it is built entirely out of other people's findings — the
 * marker, the window, the symmetry and the shape. It is what `npm run smile`
 * uses to score the model, and what it uses to show that a one-number smile
 * cannot be scored at all.
 */
export interface SmileEvidence {
  /** Duchenne (1862): did the eye join in? */
  cheek: boolean;
  /** Ekman & Friesen (1982): did it last between half a second and four? */
  window: boolean;
  /** Ekman, Hager & Friesen (1981): were the two sides the same? */
  symmetric: boolean;
  /** Schmidt et al. (2006): was the onset smooth and single-peaked? */
  smooth: boolean;
  /** How many of the four say felt. */
  score: number;
}

/**
 * Score a recorded expression against the four published markers.
 *
 * `track` is what the face DID — one sample per frame, evenly spaced by `dt`.
 * Nothing here consults the controller's own opinion of whether it was felt,
 * because that is the thing being tested.
 */
export function readSmile(track: SmileShape[], dt: number): SmileEvidence {
  if (!track.length || !(dt > 0)) {
    return { cheek: false, window: false, symmetric: false, smooth: false, score: 0 };
  }
  const strength = (s: SmileShape): number => (s.corner.left + s.corner.right) / 2;
  const peak = track.reduce((b, s) => Math.max(b, strength(s)), 0);
  const apex = track.findIndex((s) => strength(s) >= peak - 1e-9);

  // How long the expression was above a tenth of its own peak — the span an
  // observer would call "the smile", and the quantity Ekman's window is about.
  const live = track.filter((s) => strength(s) > peak * 0.1).length * dt;

  // Duchenne: did the eye join in at the apex?
  const cheek = peak > 0.05 && track[apex].cheek > peak * 0.5;

  // Ekman & Friesen: half a second to four.
  const window = live >= FELT_MIN && live <= FELT_MAX;

  // Ekman, Hager & Friesen: the two sides within a twentieth of each other.
  let lop = 0;
  for (const s of track) lop = Math.max(lop, Math.abs(s.corner.left - s.corner.right));
  const symmetric = lop <= Math.max(0.05, peak * 0.05);

  // Schmidt et al.: ONE velocity peak on the way up, not several. Counted as
  // sign changes in the acceleration over the onset, which is what "stepped"
  // means when you only have the position track.
  let turns = 0;
  let previous = 0;
  for (let i = 2; i <= apex; i++) {
    const a = strength(track[i]) - 2 * strength(track[i - 1]) + strength(track[i - 2]);
    if (Math.abs(a) < 1e-6) continue;
    const sign = Math.sign(a);
    if (previous !== 0 && sign !== previous) turns++;
    previous = sign;
  }
  const smoothOnset = turns <= 1;

  const score = Number(cheek) + Number(window) + Number(symmetric) + Number(smoothOnset);
  return { cheek, window, symmetric, smooth: smoothOnset, score };
}

export interface SmileProp {
  group: Group;
  apply(shape: SmileShape): void;
  /** How far each lip corner has risen, metres. What the MESH is showing. */
  corners(): { left: number; right: number };
}

/**
 * How far a lip corner travels at a full smile, metres.
 *
 * Zygomaticus major runs from the cheekbone to the corner of the mouth and
 * takes it up and out; a centimetre on an adult is the right order. **THIS IS
 * THE LEAST-CONSTRAINED NUMBER IN THIS FILE AND IT IS LABELLED AS ONE.**
 *
 * Everything else here is either published (`FELT_MIN`, `FELT_MAX`), derived
 * from something published (`POSED_ONSET`), or anatomically forced (`CHEEK_LID`
 * — a sphincter must close what it surrounds). This one is a judgement, and the
 * gate can only bracket it: below about 5 mm the smile is invisible, and above
 * about 19 mm the corner reaches the nose base and it stops being a smile. Ten
 * sits in the middle of a wide bracket rather than on a measurement.
 *
 * The gate found that out the hard way. Its first version asserted the measured
 * travel against `CORNER_TRAVEL` itself, which held for every value it was
 * given — the only one of seven mutations that survived.
 */
export const CORNER_TRAVEL = 0.010;

/**
 * The lip corners and the cheeks, over the baked face.
 *
 * An overlay, for the same reason the lids and the brows are: `createHumanoid`
 * bakes the mouth into the skinned mesh, so there is no zygomatic bone to pull.
 * The cheek pads are what AU6 does below the eye — the part a posed smile never
 * has, and the part that makes the eye look crinkled rather than half-shut.
 */
export function createSmile(rig: HumanoidRig): SmileProp {
  const H = rig.height;
  const face = rig.description.face;
  const group = new Group();
  const skin = rig.description.colors.skin;
  const lip = new Color(skin).offsetHSL(0.005, 0.1, -0.13).getHex();
  // Where `createHumanoid` puts the baked corners, so the overlay covers them.
  const cx = 0.022 * H * face.mouth.width;
  const seeded = 0.03 * H + face.mouth.smile * 0.008 * H;

  const corner = (): Mesh =>
    new Mesh(
      new BoxGeometry(0.0095 * H, 0.0085 * H, 0.001 * H),
      new MeshStandardMaterial({ color: lip, roughness: 0.75 })
    );
  // A cheek is skin, slightly lit — it reads as a raised mass, not a mark.
  const pad = (): Mesh =>
    new Mesh(
      new BoxGeometry(0.024 * H, 0.010 * H, 0.001 * H),
      new MeshStandardMaterial({ color: new Color(skin).offsetHSL(0, 0.02, 0.028).getHex(), roughness: 0.8 })
    );

  const leftCorner = corner();
  const rightCorner = corner();
  leftCorner.position.set(-cx, seeded, 0.0595 * H);
  rightCorner.position.set(cx, seeded, 0.0595 * H);
  const leftPad = pad();
  const rightPad = pad();
  const padY = 0.062 * H;
  leftPad.position.set(-0.027 * H * face.eyes.spacing, padY, 0.0585 * H);
  rightPad.position.set(0.027 * H * face.eyes.spacing, padY, 0.0585 * H);
  group.add(leftCorner, rightCorner, leftPad, rightPad);
  rig.bones.Head.add(group);

  let shown = { left: 0, right: 0 };
  return {
    group,
    apply(shape: SmileShape): void {
      const scale = H / 1.75;
      const l = clamp(shape.corner.left, 0, 1);
      const r = clamp(shape.corner.right, 0, 1);
      shown = { left: l * CORNER_TRAVEL * scale, right: r * CORNER_TRAVEL * scale };
      // Up AND OUT: zygomaticus major pulls toward the cheekbone, not straight
      // up, so the mouth widens as it rises.
      leftCorner.position.set(-cx - shown.left * 0.4, seeded + shown.left, 0.0595 * H);
      rightCorner.position.set(cx + shown.right * 0.4, seeded + shown.right, 0.0595 * H);

      // The cheeks are AU6 and ONLY AU6. They do not move for a posed smile,
      // because that is the whole of Duchenne's finding.
      const up = clamp(shape.cheek, 0, 1);
      const lift = up * CORNER_TRAVEL * 0.55 * scale;
      leftPad.position.y = padY - 0.006 * H + lift;
      rightPad.position.y = leftPad.position.y;
      leftPad.visible = rightPad.visible = up > 1e-3;
      leftPad.scale.y = Math.max(1e-3, 0.4 + up * 0.6);
      rightPad.scale.y = leftPad.scale.y;
    },
    corners(): { left: number; right: number } {
      return shown;
    },
  };
}
