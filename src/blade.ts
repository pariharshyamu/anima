/**
 * Blade — a weapon is a MASS DISTRIBUTION HELD IN A HAND.
 *
 * Not a stat block. There is no `damage` in this file, no `speed`, no tier and
 * no rarity, and there is nowhere any of them could go. A weapon here is a
 * list of shapes and what they are made of, and everything a game would want
 * to know about it is a consequence:
 *
 *   its MASS              volume times density. Nobody types a weight in
 *   its BALANCE POINT     the first moment of that mass. The number every arms
 *                         catalogue quotes, and the one a smith moves a pommel
 *                         to shift
 *   its INERTIA           the second moment, about whichever point the hand is
 *                         holding. This is what "fast" and "slow" actually are
 *   its CENTRE OF         `I / (m·d)`, classical, and the reason hitting near
 *   PERCUSSION            the guard stings your hand and hitting the sweet
 *                         spot does not
 *   its PERIOD            `2π√(I/mgd)`, which is a thing you can TIME on a real
 *                         sword with a stopwatch, and therefore a thing this
 *                         file can be wrong about in public
 *   its NODES             the first free-free bending mode sits at 22.4% of the
 *                         length from each end. That number is the root of a
 *                         transcendental equation, not a choice
 *
 * ## The check that matters
 *
 * `ROD` below is a plain uniform steel bar, and it is exported so the checking
 * is public. Every one of its answers is known in closed form:
 *
 *   I about the end        m·L²/3
 *   I about the centre     m·L²/12
 *   centre of percussion   two thirds of the way along, exactly
 *   period about the end   2π√(2L/3g)
 *
 * A segment sum that gets a sword subtly wrong gets a uniform rod EXACTLY
 * wrong, and against a closed form there is nowhere for it to hide.
 *
 * ## And the trade nobody has to encode
 *
 * A pommel is a counterweight. Add mass at the butt and the balance point
 * slides back toward the hand — the sword FEELS lighter, which is what every
 * smith is doing when they fit a heavier one. It also raises the moment of
 * inertia, so the sword is slower to start and slower to stop.
 *
 * Both of those are the same mass moving in the same direction, and they point
 * opposite ways. That is the whole design space of a sword, and it comes out
 * of two sums over the same table.
 */

const GRAVITY = 9.81;

/** Densities, kg/m³. Ordinary published values, not fitted to anything. */
export const DENSITIES = {
  /** Medium-carbon steel. */
  steel: 7850,
  /** Ash, the standard haft timber, at 12% moisture. */
  ash: 690,
  /** Oak — heavier, and used where a haft has to take a beating. */
  oak: 755,
  /** Leather grip wrap over a wooden core. */
  grip: 900,
  /** Brass, for pommels and furniture where it is not steel. */
  brass: 8500,
  /** 6061-T6 aluminium — what a competition javelin's shaft is drawn from. */
  alloy: 2700,
} as const;

export type Material = keyof typeof DENSITIES;

/**
 * The fraction of a square bounding box a SOLID round bar fills: π/4.
 *
 * A shaft is round and the box around it is square, and that is a quarter of
 * the volume gone before any material is chosen. Not a fudge factor — the
 * ratio of a circle to its square.
 */
export const SOLID_ROUND = Math.PI / 4;

/**
 * ...and the fraction a round TUBE fills, from its diameter and wall.
 *
 * `(π/4)·(D² − (D−2w)²) / D²`. A spear shaft is solid wood; a javelin is a
 * drawn aluminium tube with a 1.5 mm wall, and the difference between those two
 * is most of what makes one weigh 800 g and the other 1.5 kg. Deriving `fill`
 * from a wall thickness means the wall is the number in the table, which is the
 * number a manufacturer actually has.
 */
export function tubeFill(diameter: number, wall: number): number {
  const bore = Math.max(0, diameter - 2 * wall);
  if (diameter <= 0) return 0;
  return (SOLID_ROUND * (diameter * diameter - bore * bore)) / (diameter * diameter);
}

/**
 * One piece of a weapon, as a linearly tapered bar.
 *
 * Positions are metres FROM THE BUTT — the very end of the pommel — because
 * that is the one landmark every weapon has and the one that does not move
 * when the hilt changes.
 *
 * `fill` is what fraction of the bounding box is actually metal: a blade with
 * a diamond cross-section and a fuller down it is nothing like a solid bar,
 * and a spear shaft is round inside a square box. It is the one place a
 * judgement is made, and it is a geometric judgement rather than a mass one —
 * the mass still comes out of the volume.
 */
export interface BladeSegment {
  label: string;
  material: Material;
  /** Metres from the butt. */
  from: number;
  to: number;
  /** Width at each end, metres. Tapers linearly between them. */
  width: [number, number];
  /** Thickness at each end, metres. */
  thick: [number, number];
  /** Fraction of the bounding box that is material. 1 is a solid bar. */
  fill: number;
}

export interface BladeSpec {
  label: string;
  /**
   * Where the hand sits, metres from the butt. Everything rotational is about
   * this point unless something says otherwise, because it is the point the
   * weapon is actually held at.
   */
  grip: number;
  /** Where the guard sits, metres from the butt. Catalogues quote the balance
   * point from here, so it has to be a number rather than an idea. */
  cross: number;
  /**
   * Radius of curvature of the edge, metres. `Infinity` for a straight blade.
   *
   * A ruler measurement like every other number here, and it is here rather
   * than in whatever consumes it because a sabre's curve is a fact about the
   * sabre. It carries no mass consequence — the segments are still summed
   * along the axis, and a 0.9 m curve over a 0.8 m blade moves the centroid by
   * under a millimetre off-axis, which is a rotation this file does not model
   * and does not claim to.
   */
  curve?: number;
  segments: BladeSegment[];
}

/**
 * The cross-section at a point along the weapon, metres.
 *
 * Which segment is there, and how wide and thick it is at exactly that
 * distance from the butt, interpolated along the taper. A blade is 48 mm at
 * the cross and 22 mm at the tip, and anything asking "how wide is the wound"
 * or "how much edge is there" needs the width WHERE IT TOUCHED rather than an
 * average of the whole thing.
 *
 * Returns zeroes past the tip or before the butt: there is no material there.
 */
export function sectionAt(spec: BladeSpec, x: number): { width: number; thick: number } {
  let best: BladeSegment | null = null;
  for (const s of spec.segments) {
    if (x < s.from || x > s.to) continue;
    // Overlapping segments happen — a javelin's cord wraps its own shaft — and
    // the outermost one is the one a target meets.
    const f = (x - s.from) / Math.max(1e-9, s.to - s.from);
    const w = s.width[0] + (s.width[1] - s.width[0]) * f;
    if (!best || w > lerpWidth(best, x)) best = s;
  }
  if (!best) return { width: 0, thick: 0 };
  const f = (x - best.from) / Math.max(1e-9, best.to - best.from);
  return {
    width: best.width[0] + (best.width[1] - best.width[0]) * f,
    thick: best.thick[0] + (best.thick[1] - best.thick[0]) * f,
  };
}

function lerpWidth(s: BladeSegment, x: number): number {
  const f = (x - s.from) / Math.max(1e-9, s.to - s.from);
  return s.width[0] + (s.width[1] - s.width[0]) * f;
}

/** Volume of one tapered segment, cubic metres. */
function volumeOf(s: BladeSegment): number {
  const len = Math.max(0, s.to - s.from);
  // The mean of a linearly tapered rectangular section. Exact for a linear
  // taper in one dimension and within a percent for two, which is well inside
  // what `fill` is already admitting to.
  const w = (s.width[0] + s.width[1]) / 2;
  const t = (s.thick[0] + s.thick[1]) / 2;
  return len * w * t * s.fill;
}

/** Mass of one segment, kilograms. */
export function segmentMass(s: BladeSegment): number {
  return volumeOf(s) * DENSITIES[s.material];
}

/** What the whole thing weighs, kilograms. Derived, never declared. */
export function bladeMass(spec: BladeSpec): number {
  let m = 0;
  for (const s of spec.segments) m += segmentMass(s);
  return m;
}

/** Overall length, metres, from the butt to the furthest tip. */
export function bladeLength(spec: BladeSpec): number {
  let far = 0;
  for (const s of spec.segments) far = Math.max(far, s.to);
  return far;
}

/**
 * Where the mass is, metres from the butt.
 *
 * The first moment. A tapered segment's own centre of mass is not its midpoint
 * — it sits toward the thick end — and for a blade that tapers from 45 mm to
 * 20 mm that is 15 mm of error per segment, all of it in the same direction.
 */
export function balancePoint(spec: BladeSpec): number {
  let moment = 0;
  let total = 0;
  for (const s of spec.segments) {
    const m = segmentMass(s);
    moment += m * segmentCentre(s);
    total += m;
  }
  return total > 0 ? moment / total : 0;
}

/** A tapered segment's own centre of mass, metres from the butt. */
function segmentCentre(s: BladeSegment): number {
  const len = Math.max(1e-9, s.to - s.from);
  const a = s.width[0] * s.thick[0];
  const b = s.width[1] * s.thick[1];
  // For a section area varying linearly from a to b, the centroid sits at
  // (a + 2b) / (3(a + b)) along. Reduces to the midpoint when a === b.
  const f = a + b > 0 ? (a + 2 * b) / (3 * (a + b)) : 0.5;
  return s.from + f * len;
}

/** The balance point as a catalogue would quote it: metres FROM THE CROSS. */
export function balanceFromCross(spec: BladeSpec): number {
  return balancePoint(spec) - spec.cross;
}

/**
 * Moment of inertia about a point on the weapon's axis, kg·m².
 *
 * Each segment as a uniform bar about its own centre, plus the parallel axis
 * theorem. `m·L²/12 + m·d²`, summed — which is exact for uniform segments and
 * is why the uniform rod below comes out at exactly `m·L²/3` about its end.
 */
export function inertia(spec: BladeSpec, pivot?: number): number {
  const p = pivot ?? spec.grip;
  let total = 0;
  for (const s of spec.segments) {
    const m = segmentMass(s);
    const len = s.to - s.from;
    const d = segmentCentre(s) - p;
    total += (m * len * len) / 12 + m * d * d;
  }
  return total;
}

/**
 * The centre of percussion, metres from the butt.
 *
 * Hit something HERE and the blow produces no reaction at the pivot: the
 * weapon rotates about the hand instead of jarring it. Hit nearer the guard
 * and the hilt kicks back into the palm, which is the thing everybody who has
 * ever swung a bat and caught it wrong already knows.
 *
 *   L_cop = I_pivot / (m · d_com)
 *
 * Classical, textbook, and the same relation that puts a uniform rod's sweet
 * spot at two thirds of its length. It is also, under another name, the
 * "pivot point" that arms researchers measure: the pair of points that stay
 * still when the weapon is rotated about the other.
 */
export function percussion(spec: BladeSpec, pivot?: number): number {
  const p = pivot ?? spec.grip;
  const m = bladeMass(spec);
  const d = balancePoint(spec) - p;
  if (m <= 0 || Math.abs(d) < BALANCE_TOLERANCE) return Infinity;
  return p + inertia(spec, p) / (m * d);
}

/**
 * How close to the balance point counts as ON it, metres.
 *
 * Both `percussion` and `pendulumPeriod` divide by the distance from the pivot
 * to the centre of mass, and both DIVERGE as that distance goes to zero. That
 * is not a numerical problem to be guarded against — it is the physics, and it
 * is the whole difference between the two halves of this table:
 *
 *   hold a weapon AWAY from its balance point   gravity gives it a restoring
 *                                               torque, it swings, it has a
 *                                               period and a sweet spot
 *   hold it AT the balance point                no restoring torque, no
 *                                               period, no centre of
 *                                               percussion. It does not swing.
 *                                               It is THROWN
 *
 * A javelin's rules put its binding on its centre of mass on purpose, so it
 * lands on the second line and both numbers come back `Infinity` — which is
 * the limit, not an error code.
 *
 * A millimetre because that is a MEASUREMENT tolerance, not a physical
 * constant: nobody balances a real 2.6 m javelin on a knife edge to better
 * than that, and past it the reported period is a statement about arithmetic
 * rather than about an object.
 */
export const BALANCE_TOLERANCE = 0.001;

/**
 * How long one swing of it takes, hanging from the pivot, in seconds.
 *
 * `T = 2π√(I / m·g·d)` — the compound pendulum. This is the number a person
 * with a real sword and a stopwatch can check, which is the entire reason it
 * is here: arms researchers measure exactly this to get the inertia they
 * cannot weigh directly.
 *
 * It is NOT how fast the weapon can be swung by a person. It is what the
 * weapon does under gravity alone, which is a property of the object rather
 * than of whoever is holding it, and therefore something two people can
 * disagree about with a stopwatch between them.
 */
export function pendulumPeriod(spec: BladeSpec, pivot?: number): number {
  const p = pivot ?? spec.grip;
  const m = bladeMass(spec);
  const d = Math.abs(balancePoint(spec) - p);
  if (m <= 0 || d < BALANCE_TOLERANCE) return Infinity;
  return 2 * Math.PI * Math.sqrt(inertia(spec, p) / (m * GRAVITY * d));
}

/**
 * Where the blade does not vibrate, metres from the butt.
 *
 * A free-free bar's first bending mode has two nodes, and their positions are
 * the root of `cos(βL)·cosh(βL) = 1`. The first root is `βL = 4.7300`, and the
 * nodes land at 0.2242 and 0.7758 of the length.
 *
 * NOBODY CHOSE 22.4%. It is a property of the equation, it is the same for
 * every uniform bar in the universe, and it is where a sword's grip and its
 * sweet spot both want to be — which is why a blade struck on the node feels
 * dead in the hand and one struck between them buzzes.
 *
 * Reported for a uniform bar. A tapered blade's nodes shift, and this does not
 * pretend to know where to: getting that right needs a beam eigensolve on the
 * real section, which is a different piece of work and is not being guessed at
 * here.
 */
export const NODE_FRACTION = 0.2242;

export function vibrationNodes(spec: BladeSpec): [number, number] {
  const L = bladeLength(spec);
  return [NODE_FRACTION * L, (1 - NODE_FRACTION) * L];
}

/**
 * How much further this weapon puts the striking surface than a bare hand.
 *
 * The distance from the hand to the tip, which is what a limb's reach has to
 * be extended by. It is a subtraction, and it is the whole reason a spear
 * beats a sword at range.
 */
export function bladeExtension(spec: BladeSpec): number {
  return bladeLength(spec) - spec.grip;
}

// ------------------------------------------------------------- the table

export type BladeName =
  | 'rod'
  | 'arming'
  | 'longsword'
  | 'rapier'
  | 'sabre'
  | 'messer'
  | 'spear'
  | 'javelin'
  | 'axe';

/**
 * Nine objects, described with a ruler.
 *
 * Every number below is a length, a width, a thickness or a material. There is
 * not one mass in the table: the masses are computed, and the fact that they
 * come out where surviving weapons come out is the check rather than the
 * input.
 */
export const BLADES: Record<BladeName, BladeSpec> = {
  // A plain uniform steel bar, one metre long, 20 mm square. Exported because
  // every one of its answers is known in closed form and the checking should
  // be public: I = mL²/3 about the end, percussion at exactly 2L/3.
  rod: {
    label: 'Uniform steel bar',
    grip: 0,
    cross: 0,
    segments: [
      {
        label: 'bar',
        material: 'steel',
        from: 0,
        to: 1,
        width: [0.02, 0.02],
        thick: [0.02, 0.02],
        fill: 1,
      },
    ],
  },

  // Oakeshott type XII: the ordinary single-handed sword of the 13th century.
  arming: {
    label: 'Arming sword',
    grip: 0.06,
    cross: 0.13,
    segments: [
      { label: 'pommel', material: 'steel', from: 0, to: 0.045, width: [0.05, 0.05], thick: [0.03, 0.03], fill: 0.75 },
      { label: 'grip', material: 'grip', from: 0.045, to: 0.115, width: [0.03, 0.026], thick: [0.02, 0.018], fill: 0.9 },
      { label: 'cross', material: 'steel', from: 0.115, to: 0.135, width: [0.19, 0.19], thick: [0.012, 0.012], fill: 0.35 },
      { label: 'blade', material: 'steel', from: 0.135, to: 0.95, width: [0.048, 0.022], thick: [0.006, 0.0035], fill: 0.55 },
    ],
  },

  // Oakeshott XVa: a hand-and-a-half, and the reason the grip is twice as long.
  longsword: {
    label: 'Longsword',
    grip: 0.1,
    cross: 0.25,
    segments: [
      { label: 'pommel', material: 'steel', from: 0, to: 0.055, width: [0.055, 0.055], thick: [0.035, 0.035], fill: 0.75 },
      { label: 'grip', material: 'grip', from: 0.055, to: 0.23, width: [0.032, 0.026], thick: [0.022, 0.018], fill: 0.9 },
      { label: 'cross', material: 'steel', from: 0.23, to: 0.255, width: [0.22, 0.22], thick: [0.014, 0.014], fill: 0.35 },
      { label: 'blade', material: 'steel', from: 0.255, to: 1.21, width: [0.047, 0.018], thick: [0.007, 0.0035], fill: 0.55 },
    ],
  },

  // A 17th-century thrusting sword: a long narrow blade and a heavy hilt to
  // hold it up. The most hilt-biased thing in the table, and deliberately so.
  rapier: {
    label: 'Rapier',
    grip: 0.09,
    cross: 0.16,
    segments: [
      { label: 'pommel', material: 'steel', from: 0, to: 0.05, width: [0.045, 0.045], thick: [0.045, 0.045], fill: 0.8 },
      { label: 'grip', material: 'grip', from: 0.05, to: 0.14, width: [0.028, 0.024], thick: [0.02, 0.018], fill: 0.9 },
      { label: 'guard', material: 'steel', from: 0.14, to: 0.2, width: [0.16, 0.16], thick: [0.14, 0.14], fill: 0.028 },
      { label: 'blade', material: 'steel', from: 0.2, to: 1.24, width: [0.024, 0.008], thick: [0.009, 0.005], fill: 0.5 },
    ],
  },

  // Curved, and the curve is the point: a curved edge meets a flat target on
  // a CHORD rather than along its whole length, so the same push lands on a
  // shorter contact. `sectionAt` and the curve are what a cut is computed from.
  sabre: {
    label: 'Sabre',
    grip: 0.07,
    cross: 0.15,
    curve: 0.9,
    segments: [
      { label: 'pommel', material: 'brass', from: 0, to: 0.04, width: [0.035, 0.035], thick: [0.03, 0.03], fill: 0.8 },
      { label: 'grip', material: 'grip', from: 0.04, to: 0.13, width: [0.032, 0.028], thick: [0.024, 0.02], fill: 0.9 },
      { label: 'guard', material: 'steel', from: 0.13, to: 0.17, width: [0.11, 0.11], thick: [0.09, 0.09], fill: 0.045 },
      { label: 'blade', material: 'steel', from: 0.17, to: 0.96, width: [0.032, 0.02], thick: [0.008, 0.004], fill: 0.55 },
    ],
  },

  messer: {
    label: 'Messer',
    grip: 0.06,
    cross: 0.14,
    curve: 2.4,
    segments: [
      { label: 'tang cap', material: 'steel', from: 0, to: 0.02, width: [0.03, 0.03], thick: [0.02, 0.02], fill: 0.8 },
      { label: 'grip', material: 'oak', from: 0.02, to: 0.13, width: [0.034, 0.03], thick: [0.024, 0.022], fill: 1 },
      { label: 'cross', material: 'steel', from: 0.13, to: 0.15, width: [0.15, 0.15], thick: [0.012, 0.012], fill: 0.35 },
      { label: 'blade', material: 'steel', from: 0.15, to: 0.86, width: [0.042, 0.03], thick: [0.006, 0.004], fill: 0.6 },
    ],
  },

  // Ash shaft, steel head. Held a third of the way up, not in the middle.
  spear: {
    label: 'Spear',
    grip: 0.75,
    cross: 1.95,
    segments: [
      { label: 'shaft', material: 'ash', from: 0, to: 1.95, width: [0.034, 0.03], thick: [0.034, 0.03], fill: SOLID_ROUND },
      { label: 'socket', material: 'steel', from: 1.95, to: 2.05, width: [0.03, 0.026], thick: [0.03, 0.026], fill: 0.35 },
      { label: 'head', material: 'steel', from: 2.05, to: 2.3, width: [0.045, 0.006], thick: [0.008, 0.003], fill: 0.7 },
    ],
  },

  // The men's competition javelin, and the only object in the table that has a
  // RULE BOOK to be wrong against. World Athletics says: at least 800 g,
  // 2.60-2.70 m long, a 150-160 mm cord binding, and — since the 1986 rule
  // change that shortened the world record by 10% overnight — the centre of
  // mass between 0.90 and 1.06 m FROM THE TIP.
  //
  // None of those four numbers is typed in below. What is typed in is an
  // aluminium tube with a 1.5 mm wall, a steel head with a 2.5 mm one, and a
  // ruler; the mass and the balance come out at 809 g and 1.003 m from the tip,
  // which is inside the rule on both counts. The two wall thicknesses are the
  // only free numbers here, and they are the same two a manufacturer has.
  //
  // The cord sits centred on the derived centre of mass because the rule says
  // it must — the thrower's hand IS the balance point, which is why this is the
  // one entry whose grip is not near the butt.
  javelin: {
    label: 'Javelin',
    grip: 1.597,
    cross: 1.597,
    segments: [
      { label: 'tail', material: 'alloy', from: 0, to: 1.62, width: [0.012, 0.028], thick: [0.012, 0.028], fill: tubeFill(0.02, 0.0015) },
      { label: 'fore shaft', material: 'alloy', from: 1.62, to: 2.3, width: [0.028, 0.02], thick: [0.028, 0.02], fill: tubeFill(0.024, 0.0015) },
      { label: 'cord', material: 'grip', from: 1.5195, to: 1.6745, width: [0.032, 0.032], thick: [0.032, 0.032], fill: tubeFill(0.03, 0.002) },
      { label: 'head', material: 'steel', from: 2.3, to: 2.52, width: [0.02, 0.012], thick: [0.02, 0.012], fill: tubeFill(0.016, 0.0025) },
      { label: 'point', material: 'steel', from: 2.52, to: 2.6, width: [0.012, 0.001], thick: [0.012, 0.001], fill: SOLID_ROUND },
    ],
  },

  // The contrast case, and the reason the table has one: everything is at the
  // far end. A sword is a lever you steer; an axe is a mass you throw.
  axe: {
    label: 'Axe',
    grip: 0.15,
    cross: 0.78,
    // The most curved edge in the table by a factor of seven, and the reason
    // an axe cuts at all with an edge nobody would call sharp.
    curve: 0.12,
    segments: [
      { label: 'haft', material: 'ash', from: 0, to: 0.8, width: [0.03, 0.034], thick: [0.022, 0.026], fill: SOLID_ROUND },
      { label: 'head', material: 'steel', from: 0.78, to: 0.86, width: [0.045, 0.045], thick: [0.06, 0.06], fill: 0.55 },
      { label: 'bit', material: 'steel', from: 0.8, to: 0.84, width: [0.11, 0.11], thick: [0.03, 0.008], fill: 0.8 },
    ],
  },
};

export const BLADE_NAMES = Object.keys(BLADES) as BladeName[];

// -------------------------------------------------------------- the report

export interface BladeReport {
  blade: BladeName;
  /** Kilograms, computed from volume and density. */
  mass: number;
  /** Metres, butt to tip. */
  length: number;
  /** Metres from the butt. */
  balance: number;
  /** ...and from the cross, which is how a catalogue quotes it. */
  fromCross: number;
  /** kg·m² about the grip. */
  inertia: number;
  /** Metres from the butt — the sweet spot. */
  percussion: number;
  /**
   * ...as a fraction of the way from the HAND to the tip.
   *
   * Measured from the grip rather than from the cross, which is the correction
   * a spear forced: a spear is held a third of the way up its own shaft and its
   * cross sits 1.2 m PAST the balance point, so "fraction of the way along the
   * blade" came out at −70 cm of it and the javelin read 517%. The hand and the
   * tip are the two landmarks every weapon in the table has, and between them
   * the number means the same thing for a rapier and for a pole arm.
   */
  sweetSpot: number;
  /** Seconds, hanging from the grip. Checkable with a stopwatch. */
  period: number;
  /** Metres past the hand. */
  extension: number;
}

/** Everything derivable about one weapon, in one call. */
export function measureBlade(name: BladeName): BladeReport {
  const spec = BLADES[name];
  const length = bladeLength(spec);
  const cop = percussion(spec);
  const reach = Math.max(1e-9, length - spec.grip);
  return {
    blade: name,
    mass: bladeMass(spec),
    length,
    balance: balancePoint(spec),
    fromCross: balanceFromCross(spec),
    inertia: inertia(spec),
    percussion: cop,
    sweetSpot: (cop - spec.grip) / reach,
    period: pendulumPeriod(spec),
    extension: bladeExtension(spec),
  };
}

/**
 * What fitting a different pommel does.
 *
 * The whole design space of a sword in one function, and the reason it is
 * worth having: the SAME added mass moves the balance point back toward the
 * hand and raises the moment of inertia. Lighter in the hand, slower in the
 * air. Nobody has to be told that trade exists; it is two sums over one table
 * pointing in opposite directions.
 */
/**
 * Move the balance point by an exact distance, without changing the mass.
 *
 * `withPommel` adds metal; this MOVES it. Mass comes off the heaviest segment
 * on one side of the balance and goes onto the heaviest on the other, so the
 * total, the external shape, the drag and the volume are all untouched and the
 * only thing that differs is where the mass sits.
 *
 * That distinction is the whole point. Comparing two objects that differ in
 * balance AND weight AND shape tells you nothing about balance. This is the
 * one-variable version, and it is what the 1986 javelin rule change was:
 *
 *   δ = shift · m / (c_to − c_from)
 *
 * closed form, because the balance point is a first moment and a first moment
 * is linear in the mass you move.
 *
 * Returns the spec unchanged if there is not enough mass to move.
 */
export function shiftBalance(spec: BladeSpec, metres: number): BladeSpec {
  const total = bladeMass(spec);
  const at = balancePoint(spec);
  if (!(total > 0) || Math.abs(metres) < 1e-12) return spec;

  // The heaviest thing behind the balance, and the heaviest thing in front.
  let back = -1;
  let front = -1;
  for (let i = 0; i < spec.segments.length; i++) {
    const m = segmentMass(spec.segments[i]);
    const c = segmentCentre(spec.segments[i]);
    if (c < at && (back < 0 || m > segmentMass(spec.segments[back]))) back = i;
    if (c > at && (front < 0 || m > segmentMass(spec.segments[front]))) front = i;
  }
  if (back < 0 || front < 0) return spec;

  const from = metres > 0 ? back : front;
  const to = metres > 0 ? front : back;
  const lever = segmentCentre(spec.segments[to]) - segmentCentre(spec.segments[from]);
  if (Math.abs(lever) < 1e-9) return spec;

  const move = (metres * total) / lever;
  const available = segmentMass(spec.segments[from]);
  if (move <= 0 || move >= available) return spec;

  return {
    ...spec,
    segments: spec.segments.map((s, i) => {
      if (i === from) return { ...s, fill: s.fill * ((available - move) / available) };
      if (i === to) {
        const had = segmentMass(s);
        return had > 0 ? { ...s, fill: s.fill * ((had + move) / had) } : s;
      }
      return s;
    }),
  };
}

export function withPommel(spec: BladeSpec, grams: number): BladeSpec {
  const pommel = spec.segments[0];
  const add = Math.max(0, grams) / 1000;
  const was = segmentMass(pommel);
  const scale = was > 0 ? (was + add) / was : 1;
  return {
    ...spec,
    segments: spec.segments.map((s, i) => (i === 0 ? { ...s, fill: s.fill * scale } : s)),
  };
}
