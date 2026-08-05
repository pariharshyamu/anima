/**
 * Blinking — and the rate is not a constant, it is what the agent is doing.
 *
 * Every rig that blinks blinks on a timer. Pick a number, add some jitter, call
 * it done. The number is almost always wrong and it is always the SAME number,
 * which is the part that reads as mechanical: a real face's blink rate moves by
 * a factor of six depending on nothing but the task.
 *
 * Bentivoglio, Bressman, Cassetta, Carretta, Tonali and Albanese (1997) counted
 * spontaneous blinks in ninety adults across three conditions:
 *
 * ```
 *   at rest        17 blinks a minute
 *   reading         4.5
 *   in conversation 26
 * ```
 *
 * Reading suppresses it to a QUARTER of rest and talking nearly doubles it. So
 * an NPC reading a sign and an NPC in a conversation do not need a blink
 * parameter between them — they need to say what they are doing, and the rate
 * falls out of a table nobody here chose.
 *
 * ## And a blink is not symmetric
 *
 * The lid falls under gravity with orbicularis oculi behind it and is dragged
 * back up by levator palpebrae against that gravity, so the down phase is about
 * TWICE as fast as the up phase. A symmetric blink reads as a twitch, and it is
 * one of those things every viewer notices and nobody can name.
 *
 * That asymmetry is also where the lid's speed comes from: an adult palpebral
 * aperture is about ten millimetres, and closing it takes the published closing
 * time. Nothing else in this file is a chosen number.
 *
 * ## And the lid rides the eye
 *
 * Look down and the upper lid follows; look up and it retracts. They are
 * mechanically coupled — the levator and the superior rectus share an origin —
 * and a rig whose lids stay put while the eyes travel looks reptilian. That is
 * the third thing here, and it costs one multiply.
 */

import { Group, Mesh, MeshStandardMaterial, BoxGeometry } from 'three';
import type { HumanoidRig } from './humanoid';
import { irisOffset } from './saccades';
import { CHEEK_LID } from './smile';
import { IRIS_MM, PUPIL_MAX as PUPIL_MAX_MM, PUPIL_MIN as PUPIL_MIN_MM, pupilFor } from './pupils';

/**
 * Spontaneous blink rate, blinks per minute, by what the face is doing.
 *
 * Bentivoglio et al. (1997), ninety adults. DATA, labelled as data — the same
 * way `PHONEMES` is. What this file models is what to do with it.
 */
export const BLINK_RATE = {
  rest: 17,
  reading: 4.5,
  conversing: 26,
} as const;

export type BlinkTask = keyof typeof BLINK_RATE;

/**
 * The palpebral aperture — how far the upper lid travels to shut, metres.
 *
 * About ten millimetres on an adult, and scaled off body height like every
 * other length here.
 */
export const APERTURE = 0.010;

/** How long the lid takes to come DOWN, seconds. */
export const BLINK_CLOSE = 0.09;

/**
 * ...and how long to go back UP. Twice the down phase.
 *
 * The lid falls with orbicularis behind it and is lifted back by levator against
 * gravity, so the two phases are not the same length. A blink that reopened as
 * fast as it shut would read as a twitch — and the gate's control is exactly
 * that, because it is a thing somebody would write.
 */
export const BLINK_OPEN = 2 * BLINK_CLOSE;

/**
 * Peak lid speed, metres per second — derived, not picked.
 *
 * The aperture, closed in the published closing time. Change either number and
 * this moves with it, the same way `BROW_SPEED` comes out of the greeting flash.
 */
export const LID_SPEED = APERTURE / BLINK_CLOSE;

/**
 * How much of the lid's travel a full downward gaze accounts for.
 *
 * The lid follows the eye, but not one for one — an eye rotating down through
 * its range takes the lid through part of its own. A third is the fraction that
 * leaves a downward-looking eye visibly hooded and an upward-looking one wide,
 * without either reaching the closure a blink is.
 *
 * This is the one number here that is a judgement rather than a measurement,
 * and it is labelled as one.
 */
export const GAZE_LID = 1 / 3;

/**
 * The shortest gap between two blinks, seconds.
 *
 * A blink occupies `BLINK_CLOSE + BLINK_OPEN` and the lid cannot start falling
 * again until it has finished rising, so this is not a rule — it is the
 * duration of the thing itself, and it caps the rate at what the mechanism
 * allows however excited the task table gets.
 */
export const BLINK_SECONDS = BLINK_CLOSE + BLINK_OPEN;

/** What the eyes are doing. */
export interface EyeShape {
  /** Lid closure, 0 wide open to 1 fully shut. */
  lid: number;
  /** Where the eye is looking, −1 (down) to 1 (up). Drives the lid too. */
  gaze: number;
  /**
   * Where the eye is looking left–right, −1 to 1. Moves the iris.
   *
   * Vertical gaze is already visible: `gaze` rides the whole eye up and down in
   * its socket, lid included. Horizontal has nothing to ride, so this is the
   * axis the iris itself travels on — and `Saccades.shape` hands over exactly
   * this pair.
   */
  yaw?: number;
  /**
   * AU6, the cheek raise, 0..1. Narrows the eye FROM BELOW.
   *
   * A blink comes down from above; orbicularis oculi is a sphincter and comes
   * up from underneath, which is why a Duchenne smile crinkles an eye without
   * ever looking like a half-blink. Two different muscles, two different edges.
   */
  cheek?: number;
  /**
   * Pupil diameter in MILLIMETRES — not a 0..1 like the rest of this shape.
   *
   * Because millimetres is what a pupil has. It is drawn as `pupil / IRIS_MM`
   * of the iris, so a stylised face with a huge iris still shows the right
   * FRACTION of it black. Defaults to the diameter a lit interior settles at.
   */
  pupil?: number;
}

export interface BlinkOptions {
  /** What the face is doing. Sets the rate off Bentivoglio's table. */
  task?: BlinkTask;
  /** Deterministic, because a replay that blinks differently is not a replay. */
  seed?: number;
}

export interface BlinkState {
  /** What the face is doing this frame. */
  task?: BlinkTask;
  /** Vertical gaze, −1 down to 1 up. */
  gaze?: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);

/**
 * Drives a pair of eyelids.
 *
 * The rate comes from the task, the shape comes from the two published
 * durations, and the resting position comes from where the eye is looking.
 */
export class Blinking {
  /** 0 wide open to 1 shut, plus where the eye is pointing. */
  shape: EyeShape = { lid: 0, gaze: 0 };
  task: BlinkTask;
  elapsed = 0;
  /** Blinks since this controller started. */
  count = 0;

  private phase = -1;
  private next = 0;
  private state = 0;

  constructor(options: BlinkOptions = {}) {
    this.task = options.task ?? 'rest';
    this.state = (options.seed ?? 1) >>> 0 || 1;
    this.next = this.interval();
  }

  /** A seeded uniform, so a replay blinks the same way twice. */
  private random(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /**
   * How long until the next blink, seconds.
   *
   * Exponential about the task's published mean, which makes blinks a Poisson
   * process. THAT IS NOT WHAT REAL ONES ARE — see the note at the bottom of the
   * docs — but it is the honest simple thing, and the mean is the number that
   * was measured.
   *
   * AND THE BLINK'S OWN DURATION COMES OUT OF THE GAP, not on top of it.
   * Bentivoglio counted complete blinks per minute, so a cycle is the blink plus
   * the wait and it is the CYCLE that has to average 60/rate. Adding the
   * duration to an exponential of the full mean instead put every rate 15 to 20
   * per cent low — 20.7 a minute against a published 26 — which looks like
   * noise in a random process and is arithmetic.
   */
  private interval(): number {
    const cycle = 60 / BLINK_RATE[this.task];
    const u = Math.max(1e-9, this.random());
    return Math.max(0, -Math.log(u) * Math.max(1e-6, cycle - BLINK_SECONDS));
  }

  /** Blink now, whatever the clock says. */
  blink(): void {
    if (this.phase < 0) this.phase = 0;
  }

  update(dt: number, state: BlinkState = {}): EyeShape {
    const step = Math.max(0, dt);
    this.elapsed += step;
    if (state.task && state.task !== this.task) {
      // A CHANGE OF TASK RE-DRAWS THE WAIT. Without it a face that stops
      // reading and starts talking keeps the four-a-minute interval it was
      // already counting down, and the rate only catches up a blink later.
      this.task = state.task;
      this.next = this.interval();
    }
    const gaze = clamp(state.gaze ?? this.shape.gaze, -1, 1);

    if (this.phase >= 0) {
      this.phase += step;
      if (this.phase >= BLINK_SECONDS) {
        this.phase = -1;
        this.count++;
        this.next = this.interval();
      }
    } else {
      this.next -= step;
      if (this.next <= 0) this.phase = 0;
    }

    // THE LID'S RESTING PLACE IS WHERE THE EYE IS LOOKING. Levator palpebrae
    // and superior rectus share an origin, so the two move together; a rig whose
    // lids stay put while the eyes travel looks reptilian.
    // Gaze runs −1 down to +1 up, so (1 − gaze)/2 runs 1 down to 0 up, and
    // GAZE_LID is the whole of the lid's share of it. The first version
    // multiplied by GAZE_LID twice and the lid moved a NINTH of what the
    // constant says — 11% of the aperture across the entire gaze range, which
    // the gate caught by asserting the model does what its own number says.
    const resting = GAZE_LID * ((1 - gaze) / 2);

    let blink = 0;
    if (this.phase >= 0) {
      blink = this.phase < BLINK_CLOSE
        ? this.phase / BLINK_CLOSE
        : Math.max(0, 1 - (this.phase - BLINK_CLOSE) / BLINK_OPEN);
    }
    // The blink takes the lid the rest of the way down from wherever it was
    // resting, so a downward-looking eye shuts sooner. It does not add.
    this.shape = { lid: clamp(resting + (1 - resting) * blink, 0, 1), gaze };
    return this.shape;
  }
}

export interface EyeProp {
  group: Group;
  apply(shape: EyeShape): void;
  /** The visible aperture of one eye, metres. Zero when shut. */
  aperture(): number;
  /** The pupil diameter the mesh is drawing, millimetres. */
  pupilMm(): number;
  /**
   * How far the iris sits off centre, metres. Negative is the character's left.
   *
   * The measurable a saccade gate needs: it is what the MESH is showing, not
   * what the controller reported, and those are different claims.
   */
  pupil(): number;
}

/**
 * A pair of lids over the baked eyes.
 *
 * An overlay, for the same reason the mouth and the brows are: `createHumanoid`
 * bakes the face into the skinned mesh, so there is no lid bone to drive. These
 * are two panels that come down over the whites the face already has.
 */
export function createEyes(rig: HumanoidRig): EyeProp {
  const H = rig.height;
  const face = rig.description.face;
  const ex = 0.027 * H * face.eyes.spacing;
  const w = 0.026 * H * face.eyes.size;
  const h = 0.02 * H * face.eyes.size;
  const group = new Group();
  // The skin the lid is made of, so a shut eye reads as a face and not a hole.
  const skin = rig.description.colors.skin;

  // THE MOVING IRIS — which means REDRAWING the eye, not just the iris.
  //
  // `createHumanoid` bakes both the white and the iris into the skinned mesh, so
  // the baked iris cannot move and cannot be erased. The overlay therefore lays
  // down a fresh white over the whole eye and puts its own iris on that, at the
  // baked iris's own size.
  //
  // The first version tried to do it in ONE layer, by making the moving iris
  // large enough to cover the baked one across its whole travel. Two conditions
  // — hide the baked iris everywhere it goes, never leave the white — have
  // exactly one solution, `half = (baked + white) / 2`, and it is a real
  // solution: it fits, it never clips, and the arithmetic is pretty. It also
  // makes the iris 73% of the width of the eye, and every character in the
  // library ends up with a black-eyed thousand-yard stare. A screenshot took
  // four seconds to disprove what the algebra had made look inevitable.
  const patchHalf = 0.01325 * H * face.eyes.size;
  const irisHalf = 0.006 * H * face.eyes.size;
  // Room to spare now: the globe only needs 2.9 mm and there is 7.3 mm of it.
  const travel = patchHalf - irisHalf;
  const white = (): Mesh =>
    new Mesh(
      new BoxGeometry(patchHalf * 2, 0.0205 * H * face.eyes.size, 0.0006 * H),
      new MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.75 })
    );
  const iris = (): Mesh =>
    new Mesh(
      new BoxGeometry(irisHalf * 2, 0.013 * H * face.eyes.size, 0.0006 * H),
      new MeshStandardMaterial({ color: face.eyes.color, roughness: 0.55 })
    );
  const lid = (): Mesh =>
    new Mesh(
      new BoxGeometry(w * 1.06, h, 0.0006 * H),
      new MeshStandardMaterial({ color: skin, roughness: 0.9 })
    );
  // THE PUPIL — a hole, so it is the darkest thing on the face and it is drawn
  // in FRONT of the iris rather than punched out of it.
  const pupil = (): Mesh =>
    new Mesh(
      new BoxGeometry(irisHalf * 2, 0.013 * H * face.eyes.size, 0.0006 * H),
      new MeshStandardMaterial({ color: 0x120d10, roughness: 0.35 })
    );
  const leftPupil = pupil();
  const rightPupil = pupil();
  // FIVE THIN LAYERS, half a millimetre apart, rather than three thick ones.
  // Stacked at the lid's old 6 mm depth the assembly stood 8 mm proud of the
  // nose tip and the character had eyes on stalks; at 1 mm each the whole thing
  // clears the baked iris and still sits behind the nose.
  // AU6'S OWN EDGE. Orbicularis oculi is a sphincter, so it closes the eye from
  // UNDERNEATH — the cheek comes up and takes the lower lid with it. A blink
  // comes down from above. Drawing both off one panel would make a Duchenne
  // smile read as a half-blink, which is the thing it is most often mistaken
  // for and the reason a squint and a crinkle look nothing alike.
  const cheekLid = (): Mesh =>
    new Mesh(
      new BoxGeometry(w * 1.06, h, 0.0006 * H),
      new MeshStandardMaterial({ color: skin, roughness: 0.9 })
    );
  const leftCheek = cheekLid();
  const rightCheek = cheekLid();
  leftCheek.position.set(-ex, 0, 0.0027 * H);
  rightCheek.position.set(ex, 0, 0.0027 * H);
  const leftWhite = white();
  const rightWhite = white();
  leftWhite.position.set(-ex, 0, 0);
  rightWhite.position.set(ex, 0, 0);
  const leftIris = iris();
  const rightIris = iris();
  leftIris.position.set(-ex, 0, 0.0009 * H);
  rightIris.position.set(ex, 0, 0.0009 * H);
  leftPupil.position.set(-ex, 0, 0.0018 * H);
  rightPupil.position.set(ex, 0, 0.0018 * H);
  const left = lid();
  const right = lid();
  left.position.set(-ex, 0, 0.0036 * H);
  right.position.set(ex, 0, 0.0036 * H);
  // White, then iris, then lid — the only order in which a blink hides a pupil.
  group.add(leftWhite, rightWhite, leftIris, rightIris, leftPupil, rightPupil, leftCheek, rightCheek, left, right);
  // IN FRONT OF THE PUPIL, not in front of the white.
  //
  // `createHumanoid` puts the whites at 0.0565 H and then the irises 0.004 H
  // PROUDER than that, so a lid flush with the white is still 0.6 mm behind the
  // thing a viewer actually looks at. The first version sat at 0.0575 H and
  // rendered perfectly — behind both — and the eye stayed wide open through a
  // blink the readout said had closed to 0.954. Nothing but a screenshot finds
  // that: every number in the probe was right.
  group.position.set(0, 0.078 * H, 0.0648 * H);
  rig.bones.Head.add(group);

  let shown = 0;
  let looking = 0;
  let raised = 0;
  let wide = pupilFor(50);
  return {
    group,
    apply(shape: EyeShape): void {
      const closed = clamp(shape.lid, 0, 1);
      shown = closed;
      // The lid comes DOWN over the eye: its lower edge travels from the top of
      // the white to the bottom of it, so the panel both drops and grows.
      const cover = closed * h;
      left.scale.y = Math.max(1e-3, cover / h);
      right.scale.y = left.scale.y;
      const y = h / 2 - cover / 2;
      left.position.y = y;
      right.position.y = y;
      // The eye also rides up and down in its socket with the gaze, lid and all
      // — which is why the iris below only has to deal with left and right.
      const look = clamp(shape.gaze, -1, 1) * h * 0.15;
      group.position.y = 0.078 * H + look;
      // AND THE IRIS TRAVELS BY R sin θ, because it is a spot on a ball.
      //
      // Not by "a fraction of the eye's width" — the globe is twelve
      // millimetres in everybody, so a character drawn with big eyes does not
      // get a bigger swing, they get the same swing across a wider white. The
      // clamp is the drawing's limit, not the anatomy's, and on the default
      // face it does not bind: 2.9 mm of travel into 3.5 mm of room.
      const x = clamp(irisOffset(clamp(shape.yaw ?? 0, -1, 1), H), -travel, travel);
      looking = x;
      leftIris.position.x = -ex + x;
      rightIris.position.x = ex + x;
      // THE PUPIL IS A FRACTION OF THE IRIS, and the fraction is the only part
      // that is real: an adult iris is twelve millimetres and the pupil runs 2
      // to 8 of them, so a face drawn with an enormous iris shows the same
      // PROPORTION black rather than the same millimetres. It rides the iris,
      // because it is a hole in it.
      const mm = clamp(shape.pupil ?? pupilFor(50), PUPIL_MIN_MM, PUPIL_MAX_MM);
      wide = mm;
      const s = mm / IRIS_MM;
      leftPupil.scale.set(s, s, 1);
      rightPupil.scale.set(s, s, 1);
      leftPupil.position.x = -ex + x;
      rightPupil.position.x = ex + x;
      leftPupil.visible = rightPupil.visible = closed < 0.999;
      // A shut eye has no visible iris or white, and a lid drawn over ones that
      // are still there leaves a rim at some resolutions.
      leftIris.visible = rightIris.visible = closed < 0.999;
      leftWhite.visible = rightWhite.visible = closed < 0.999;
      // The cheek raise comes up from the bottom of the white by its own share
      // of the aperture, and it stops well short of a closure.
      raised = clamp(shape.cheek ?? 0, 0, 1);
      const lifted = raised * CHEEK_LID * h;
      leftCheek.scale.y = Math.max(1e-3, lifted / h);
      rightCheek.scale.y = leftCheek.scale.y;
      leftCheek.position.y = -h / 2 + lifted / 2;
      rightCheek.position.y = leftCheek.position.y;
      leftCheek.visible = rightCheek.visible = raised > 1e-3 && closed < 0.999;
      // Nothing to draw when the eye is fully open; a zero-height panel still
      // rasterises a seam across the top of the white at some resolutions.
      left.visible = right.visible = closed > 1e-3;
    },
    aperture(): number {
      // TWO LIDS, TWO EDGES, ONE GAP. The blink eats it from the top and the
      // cheek raise from the bottom, so what is left is the product — and a
      // Duchenne smile therefore narrows the eye without ever shutting it.
      return Math.max(0, (1 - shown) * (1 - raised * CHEEK_LID) * APERTURE * (H / 1.75));
    },
    pupil(): number {
      return looking;
    },
    pupilMm(): number {
      return wide;
    },
  };
}
