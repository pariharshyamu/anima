/**
 * Bind — two blades in contact stop being two objects.
 *
 * They become one linkage with a hand at each end and a sliding joint in the
 * middle, and everything a fencing manual spends a chapter on is a consequence
 * of where that joint is.
 *
 * ## The joint is where two lines cross, and that is all it is
 *
 * Each blade is a line through a hand. Two lines cross at one point. The
 * distance from your hand to that point is your lever arm, `a`; the distance
 * from theirs is `b`. Neither of you chooses those numbers — they are what the
 * geometry does — and between them they decide the whole exchange:
 *
 *   F_you = τ_you / a          τ from the couple your hands can make
 *   F_them = τ_them / b
 *
 * Contact near your own hilt gives you a short lever and an enormous force.
 * Contact out near your point gives you a long lever and almost none. That is
 * the *strong* and the *weak* of the blade, the oldest idea in the art, and it
 * is `τ = F·r` rearranged.
 *
 * ## Two mechanisms, pointing opposite ways
 *
 * This is what the module is for, because neither half is obvious and the two
 * halves come from completely unrelated physics.
 *
 * **Friction says a shallow crossing STICKS.** Press across another blade and
 * the force splits into a component normal to it and a component along it, in
 * the ratio `tan θ`. Below `atan(µ)` the tangential part cannot overcome
 * friction and the blades hold. Steel on steel puts that angle at about
 * **11 degrees**, and it is a published coefficient rather than a feel.
 *
 * **Geometry says a shallow crossing is UNSTABLE.** Rotate your blade by `dα`
 * and the crossing point slides along theirs by
 *
 *   ds = a · dα / sin θ
 *
 * which is the conditioning of a line intersection, and it diverges as the
 * lines approach parallel. At 10° a single degree of rotation moves the
 * contact **six times** as far as it does at 90°.
 *
 * So a shallow bind grips and will not stay put; a steep bind stays put and
 * will not grip. Nobody encoded that trade. One half is Coulomb and the other
 * half is `1/sin θ`, and they were not consulted about each other.
 *
 * ## The constant that cancels
 *
 * There is exactly one chosen number in this file — how hard a hand pushes —
 * and it is arranged so that nothing important depends on it. Every claim the
 * gate makes is a RATIO or an ANGLE: who wins the bind, by how much, at what
 * crossing, how fast the contact runs. `HAND_FORCE` divides out of all of them.
 * It is here so the reports have newtons in them, not because anything rests
 * on it.
 */

/** A point in the crossing plane. Metres. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Dry steel on steel.
 *
 * The published band is 0.15–0.25 for clean mild steel, unlubricated. It moves
 * with oil, rust and surface finish, which is why `bindsOrSlips` takes it as an
 * argument rather than baking it in.
 */
export const STEEL_FRICTION = 0.2;

/**
 * How hard one hand pushes at the grip, newtons.
 *
 * THE ONLY CHOSEN NUMBER IN THIS FILE, and it cancels out of every comparison.
 * Two fencers of the same build both have it, so it divides out of the ratio;
 * the crossing angle does not involve it at all. It exists so `bindForce` can
 * answer in newtons.
 */
export const HAND_FORCE = 200;

/**
 * The widest two hands sit apart on a shaft, metres.
 *
 * A spear's grip is its whole shaft, so "the length of the grip segment" would
 * say a pair of hands can be two metres apart. They cannot. This is a body
 * measurement standing in for one, and it is a cap rather than a value: any
 * hilt shorter than this uses its own length.
 */
export const TWO_HAND_SPAN = 0.4;

/** One hand's own span, heel to fingers, metres. A one-handed couple is this wide. */
export const PALM_SPAN = 0.08;

// ------------------------------------------------------------- the linkage

/**
 * A blade in the crossing plane: a hand, a direction and a length.
 *
 * Structural on purpose. Anything with a hand position, an angle and a length
 * is a blade as far as this file is concerned, which is how a spear, a staff
 * and a walking stick all work without being mentioned.
 */
export interface BladeLine {
  /** Where the hand is, metres. */
  hand: Point;
  /** Which way the blade points from the hand, radians. */
  angle: number;
  /** Hand to point, metres. */
  length: number;
  /** How far apart the hands are on the grip, metres. Sets the couple. */
  span?: number;
}

export interface Crossing {
  /** Where the two lines meet. */
  point: Point;
  /** Metres from A's hand to the contact — A's lever arm. */
  alongA: number;
  /** ...and B's. */
  alongB: number;
  /** The angle between the blades, radians, in [0, π/2]. */
  angle: number;
  /** Whether the crossing falls on both blades rather than off the ends. */
  onBoth: boolean;
}

/**
 * Where two blades cross.
 *
 * Plain line intersection. Returns `null` only when the blades are exactly
 * parallel and therefore never meet — which is not a bind, it is two people
 * standing near each other.
 */
export function crossing(a: BladeLine, b: BladeLine): Crossing | null {
  const ax = Math.cos(a.angle);
  const ay = Math.sin(a.angle);
  const bx = Math.cos(b.angle);
  const by = Math.sin(b.angle);
  const det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-12) return null;

  const dx = b.hand.x - a.hand.x;
  const dy = b.hand.y - a.hand.y;
  const alongA = (dx * by - dy * bx) / det;
  const alongB = (dx * ay - dy * ax) / det;

  // The angle between two lines is in [0, π/2]: a blade crossing at 170° is
  // crossing at 10°, and every consequence below depends on the acute one.
  let angle = Math.abs(a.angle - b.angle) % Math.PI;
  if (angle > Math.PI / 2) angle = Math.PI - angle;

  return {
    point: { x: a.hand.x + alongA * ax, y: a.hand.y + alongA * ay },
    alongA,
    alongB,
    angle,
    onBoth: alongA >= 0 && alongA <= a.length && alongB >= 0 && alongB <= b.length,
  };
}

// -------------------------------------------------------------- the levers

/**
 * The couple a pair of hands can make on a hilt, newton-metres.
 *
 * A hand does not push a sword, it TURNS one: the heel drives one way and the
 * fingers the other, and the torque is that force times how far apart they are.
 * One hand gets a palm's span. Two hands get the hilt.
 *
 * This is the whole mechanical case for a long grip, and it is a subtraction:
 * a longsword's hands sit twice as far apart as an arming sword's, so the same
 * body makes twice the couple with the same effort.
 */
export function handCouple(span: number, force: number = HAND_FORCE): number {
  return Math.max(0, span) * force;
}

/**
 * How far apart the hands sit on a given hilt, metres.
 *
 * One hand gets its own span, capped by the hilt it is holding. Two hands get
 * the hilt, capped by how far apart a pair of arms will comfortably work.
 */
export function gripSpan(hiltLength: number, hands: 1 | 2 = 1): number {
  const hilt = Math.max(0, hiltLength);
  // Two hands on a hilt do not sit a hilt apart. Each occupies half a palm at
  // its own end, so the CENTRES are a palm closer together than the wood is
  // long — which for a longsword is 170 mm rather than 250, and that
  // subtraction is the difference between a plausible couple and a flattering
  // one.
  if (hands === 2) return Math.min(TWO_HAND_SPAN, Math.max(0, hilt - PALM_SPAN));
  return Math.min(PALM_SPAN, hilt);
}

/**
 * The force a blade can put on the contact, newtons.
 *
 * `τ / a`. A contact 100 mm from the hand and one 700 mm from it differ by
 * seven times, from the same arms, in the same instant, and the fencer has
 * done nothing but let the crossing be where it is.
 */
export function bindForce(torque: number, along: number): number {
  if (!(Math.abs(along) > 1e-9)) return Infinity;
  return torque / Math.abs(along);
}

/**
 * Where the contact sits along a blade: 0 at the hand, 1 at the point.
 *
 * The forte/foible fraction, which is the only thing about a bind that a
 * fencing manual states as a number. Under a half is the strong.
 */
export function leverage(along: number, length: number): number {
  if (!(length > 0)) return 0;
  return along / length;
}

// ------------------------------------------------ the two mechanisms

/**
 * The angle at which blades stop gripping and start sliding, radians.
 *
 * `atan(µ)`. Below it the tangential component of a press cannot overcome
 * friction; above it, it can. Steel on steel puts it at 11.3°, and that number
 * is a published coefficient run through an arctangent — not a feel, and not a
 * threshold anybody picked.
 */
export function frictionAngle(mu: number = STEEL_FRICTION): number {
  return Math.atan(Math.max(0, mu));
}

/**
 * Does this crossing hold, or does one blade skate along the other?
 *
 * Press across another blade and the force splits normal and tangential in the
 * ratio `tan θ`, where θ is the angle between them. Shallow crossings are
 * nearly all normal force and they hold. Steep ones are nearly all tangential
 * and they slide.
 */
export function bindsOrSlips(angle: number, mu: number = STEEL_FRICTION): boolean {
  return Math.abs(angle) <= frictionAngle(mu);
}

/**
 * How far the contact runs along the other blade per radian of your rotation.
 *
 *   ds/dα = a / sin θ
 *
 * The conditioning of a line intersection, and it is the reason a shallow bind
 * will not stay where it is put. Two nearly-parallel lines meet somewhere very
 * sensitive to both of them; nudge one and the meeting point bolts.
 *
 * It is proportional to `a` as well, so a contact already out near your point
 * is unstable twice over — which is exactly the position every manual tells you
 * not to be in.
 */
export function bindSensitivity(along: number, angle: number): number {
  const s = Math.abs(Math.sin(angle));
  if (s < 1e-12) return Infinity;
  return Math.abs(along) / s;
}

// ------------------------------------------------------------------ report

export interface BindOptions {
  /** Hands on each hilt. Defaults to one each. */
  hands?: [1 | 2, 1 | 2];
  /** Hilt lengths, metres. Defaults to a palm each. */
  hilts?: [number, number];
  /** Per-hand force, newtons. Cancels out of every ratio below. */
  force?: number;
  /** Friction coefficient at the contact. */
  mu?: number;
}

export interface BindReport {
  /** `null` when the blades are parallel and never meet. */
  crossing: Crossing | null;
  /** Newton-metres each fencer's hands can make. */
  torque: [number, number];
  /** Newtons each can put on the contact. */
  force: [number, number];
  /** Where the contact sits on each blade: 0 at the hand, 1 at the point. */
  leverage: [number, number];
  /** A's force over B's. Above 1 and A displaces B. */
  ratio: number;
  /** 0 for A, 1 for B, or -1 when it is level or there is no crossing. */
  winner: number;
  /** Whether the crossing holds rather than sliding. */
  binds: boolean;
  /** Metres the contact runs per radian, for each of them. */
  sensitivity: [number, number];
}

/**
 * One bind, measured.
 *
 * Nothing in here decides anything. The crossing is where two lines meet, the
 * torques are spans times a force, the forces are torques over lever arms, and
 * the winner is whichever number is larger.
 */
export function measureBind(a: BladeLine, b: BladeLine, options: BindOptions = {}): BindReport {
  const hands = options.hands ?? [1, 1];
  const hilts = options.hilts ?? [PALM_SPAN, PALM_SPAN];
  const force = options.force ?? HAND_FORCE;
  const mu = options.mu ?? STEEL_FRICTION;

  const spanA = a.span ?? gripSpan(hilts[0], hands[0]);
  const spanB = b.span ?? gripSpan(hilts[1], hands[1]);
  const torque: [number, number] = [handCouple(spanA, force), handCouple(spanB, force)];

  const x = crossing(a, b);
  if (!x) {
    return {
      crossing: null,
      torque,
      force: [0, 0],
      leverage: [0, 0],
      ratio: 1,
      winner: -1,
      binds: false,
      sensitivity: [Infinity, Infinity],
    };
  }

  const fA = bindForce(torque[0], x.alongA);
  const fB = bindForce(torque[1], x.alongB);
  const ratio = fB > 0 ? fA / fB : Infinity;
  return {
    crossing: x,
    torque,
    force: [fA, fB],
    leverage: [leverage(x.alongA, a.length), leverage(x.alongB, b.length)],
    ratio,
    winner: Math.abs(ratio - 1) < 1e-9 ? -1 : ratio > 1 ? 0 : 1,
    binds: bindsOrSlips(x.angle, mu),
    // Each fencer's own rotation moves the contact along the OTHER blade, at a
    // rate set by their own lever arm and the shared crossing angle.
    sensitivity: [bindSensitivity(x.alongA, x.angle), bindSensitivity(x.alongB, x.angle)],
  };
}

/**
 * Winding: rotate about the contact and see where the crossing goes.
 *
 * Returns the bind that results from turning A by `dAngle` radians. This is not
 * a technique the module knows — it is what happens to an intersection when you
 * move one of the lines, and the fact that one direction walks the contact back
 * toward your hilt and the other walks it out toward your point is a property of
 * the geometry rather than of the manual that names it.
 */
export function wind(
  a: BladeLine,
  b: BladeLine,
  dAngle: number,
  options: BindOptions = {}
): BindReport {
  return measureBind({ ...a, angle: a.angle + dAngle }, b, options);
}
