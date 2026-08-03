/**
 * Javelin — the object whose rules were changed to make it fly worse, and by
 * how much.
 *
 * On 1 April 1986 the IAAF moved the men's javelin's centre of mass **four
 * centimetres forward**. Uwe Hohn had thrown 104.80 m in 1984 — the only throw
 * past a hundred metres there has ever been — and javelins were landing flat,
 * sliding, and becoming impossible to judge and dangerous to stand near. The
 * new specification was written to make them come down nose-first, and the
 * stated expectation was about **ten percent** off the distances.
 *
 * That is the check this file exists for. It is not a range a museum happens to
 * fall in and it is not a coefficient somebody measured in a tunnel. It is a
 * committee stating an intention, an object being rebuilt to a new number, and
 * forty years of results since. If four centimetres of centre-of-mass does not
 * cost about ten percent of the distance here, the model is wrong about the
 * world in a way that can be looked up.
 *
 * ## What a javelin is, aerodynamically
 *
 * NOT a projectile. A cannonball at 30 m/s and 36° goes 87 metres and nothing
 * it does in the air changes that. A javelin goes further, and the surplus is
 * lift — which means the thing that governs the throw is not the launch, it is
 * the ATTITUDE the shaft holds relative to the air it is moving through.
 *
 * So this is a three-degree-of-freedom flight: two of position and one of
 * pitch. The pitch is the whole story.
 *
 *   α = θ − atan2(vy, vx)        attitude minus flight path: angle of attack
 *
 * ## Where the numbers come from
 *
 * Every geometric input is `Blade`'s. The mass, the centre of mass, the moment
 * of inertia about it and the volume are all sums over the same segment table
 * that says a javelin weighs 808 g, and none of them is typed in here.
 *
 * The aerodynamics is slender-body theory, which is the standard method for
 * exactly this shape:
 *
 *   MUNK MOMENT       potential flow round a slender body produces no net force
 *                     and a pure couple, `q·V·sin(2α)`, which is DESTABILISING —
 *                     it wants to turn the body broadside. Munk, 1924, for
 *                     airship hulls
 *   CROSSFLOW         viscous flow adds a normal force `q·C_dc·A_plan·α|α|`
 *                     acting at the planform centroid. Allen & Perkins, 1951
 *   SKIN FRICTION     a slender body's drag is mostly wetted area, not frontal
 *
 * Three published coefficients: the density of air, the crossflow drag of a
 * circular cylinder, and a turbulent flat-plate friction coefficient. Nothing
 * else is chosen, and in particular NOTHING IS FITTED TO THE 1986 RESULT — the
 * rule change is the check, so tuning to it would delete the only thing here
 * worth having.
 *
 * ## What it does not model
 *
 * Wind, which is why javelin records care so much about it. Spin, which
 * stabilises real throws. The thrower's release variability. And the flexing of
 * the shaft, which is real and which the 1986 change also affected. This is a
 * rigid body in still air, and the places that matters are listed in the docs
 * rather than papered over.
 */
import { balancePoint, bladeLength, bladeMass, inertia, type BladeSpec } from './blade';

/** Sea level, 15 °C, ISA. kg/m³. */
export const AIR_DENSITY = 1.225;

/**
 * Crossflow drag coefficient of a circular cylinder, Allen & Perkins.
 *
 * A slender body at angle of attack behaves, in the plane across it, like a
 * cylinder in a stream. The published value for a circular cylinder at the
 * relevant Reynolds number is about 1.2, and it is the same number that makes a
 * chimney sway.
 */
export const CROSSFLOW_DRAG = 1.2;

/**
 * Turbulent flat-plate skin friction at Re ≈ 3 × 10⁶.
 *
 * A javelin is 26 mm across and 2.6 m long. Its drag is not the hole it punches
 * in the air, it is the air dragging along its sides, so the reference area is
 * WETTED rather than frontal — which is 250 times bigger and is why the
 * coefficient is 0.004 rather than 0.5.
 */
export const SKIN_FRICTION = 0.004;

const GRAVITY = 9.81;

/**
 * The aerodynamic shape of a body, as flight needs it.
 *
 * Derived from a `BladeSpec` by `aeroOf` — but structural, so anything that
 * knows its own mass, inertia, volume and areas can be thrown.
 */
export interface AeroBody {
  /** kg. */
  mass: number;
  /** kg·m² about the centre of mass. */
  inertia: number;
  /** Metres, butt to tip. */
  length: number;
  /** Metres from the butt. */
  balance: number;
  /** m³ — the ENCLOSED volume, which is what the air sees. */
  volume: number;
  /** m², the side-on area: length times mean diameter. */
  planform: number;
  /** m², the skin. */
  wetted: number;
  /**
   * Metres from the butt, where the crossflow normal force acts.
   *
   * The centroid of the planform area. For a body that tapers to a point at one
   * end and a smaller one at the other, that is not the middle, and where it
   * sits relative to the balance point is the entire question.
   */
  centreOfPressure: number;
}

/**
 * Read a weapon's aerodynamics off its own segment table.
 *
 * Every number here is already in `Blade` — the mass, the balance, the inertia
 * about it — or is a sum over the same segments. The enclosed volume is the
 * bounding solid rather than the material: a hollow aluminium tube pushes as
 * much air as a solid rod of the same shape.
 */
export function aeroOf(spec: BladeSpec): AeroBody {
  const length = bladeLength(spec);
  const balance = balancePoint(spec);

  // Sum the ENCLOSED shape, ignoring `fill` — the air does not know the tube is
  // hollow. Round sections, so πd²/4 and πd per unit length.
  let volume = 0;
  let side = 0;
  let wetted = 0;
  let sideMoment = 0;
  for (const s of spec.segments) {
    const len = Math.max(0, s.to - s.from);
    if (len <= 0) continue;
    const d0 = (s.width[0] + s.thick[0]) / 2;
    const d1 = (s.width[1] + s.thick[1]) / 2;
    const d = (d0 + d1) / 2;
    volume += (Math.PI / 4) * d * d * len;
    const area = d * len;
    side += area;
    wetted += Math.PI * d * len;
    // A tapered segment's side-on centroid, same first moment as anywhere else.
    const f = d0 + d1 > 0 ? (d0 + 2 * d1) / (3 * (d0 + d1)) : 0.5;
    sideMoment += area * (s.from + f * len);
  }

  return {
    mass: bladeMass(spec),
    inertia: inertia(spec, balance),
    length,
    balance,
    volume,
    planform: side,
    wetted,
    centreOfPressure: side > 0 ? sideMoment / side : length / 2,
  };
}

/**
 * How stable the body is in pitch, as a fraction of its own length.
 *
 *   (x_cm − x_cp) / L
 *
 * Positive means the centre of mass is AHEAD of the aerodynamic force — nearer
 * the point — so a disturbance produces a righting moment and the body
 * weathercocks into the airflow — nose-down as the flight path descends, which is what the 1986 rule
 * was written to produce.
 *
 * Negative means the force acts ahead of the mass, the moment is divergent, and
 * the body wants to go broadside. Every arrow ever fletched is a device for
 * making this number positive.
 */
export function staticMargin(body: AeroBody): number {
  if (!(body.length > 0)) return 0;
  // Measured from the centre of PRESSURE toward the tip, because a javelin
  // flies point-first: the mass has to be ahead of the pressure, the same way
  // an arrow's is ahead of its fletching.
  return (body.balance - body.centreOfPressure) / body.length;
}

export interface ThrowState {
  /** Metres. */
  x: number;
  y: number;
  /** m/s. */
  vx: number;
  vy: number;
  /** Radians: which way the shaft points. */
  pitch: number;
  /** rad/s. */
  pitchRate: number;
  /** Seconds since release. */
  t: number;
}

export interface ThrowOptions {
  /** m/s at release. Elite men are around 30. */
  speed?: number;
  /** Radians above horizontal that the javelin is THROWN. */
  angle?: number;
  /**
   * Radians the shaft sits above the velocity vector at release.
   *
   * The angle of attack the thrower hands it, and a real coaching variable —
   * throwing with the point too high is the classic fault.
   */
  attack?: number;
  /** Metres. Release is from above the shoulder, moving. */
  height?: number;
  /** Fixed step, seconds. */
  step?: number;
}

export interface ThrowReport {
  /** Metres, flat ground. */
  range: number;
  /** Seconds. */
  duration: number;
  /** Metres. */
  apex: number;
  /** Radians: the shaft's attitude when it arrives. Negative is nose-down. */
  landingPitch: number;
  /** Radians between the shaft and the ground at landing — what a judge sees. */
  landingAttitude: number;
  /** Radians the flight path makes with the ground at landing. */
  landingPath: number;
  /** The largest angle of attack reached, radians. */
  peakAttack: number;
  /**
   * Newtons of axial drag at the instant of release, and as a fraction of the
   * body's own weight.
   *
   * Reported because a drag term computed on the WRONG AREA does not announce
   * itself: swap wetted-area skin friction for frontal-area bluff-body drag and
   * the flight still looks like a flight, the orderings all survive, and the
   * range moves by a couple of metres. The only way to notice is to look at the
   * force. For a slender body it should be a few percent of weight.
   */
  releaseDrag: number;
  releaseDragFraction: number;
  /** Whether it arrived point-first, which is what the rule demanded. */
  pointFirst: boolean;
  /** Every step, for drawing. */
  path: ThrowState[];
}

/**
 * Throw it, and integrate what the air does to it.
 *
 * Fixed step, because a variable one makes the answer a fact about the frame
 * rate — the same lesson `Striking` and `Grappling` both had to learn the hard
 * way, and it is not being relearned here.
 */
export function flyJavelin(body: AeroBody, options: ThrowOptions = {}): ThrowReport {
  const speed = options.speed ?? 30;
  const angle = options.angle ?? (34 * Math.PI) / 180;
  const attack = options.attack ?? (5 * Math.PI) / 180;
  const step = options.step ?? 0.001;

  const s: ThrowState = {
    x: 0,
    y: options.height ?? 1.8,
    vx: speed * Math.cos(angle),
    vy: speed * Math.sin(angle),
    pitch: angle + attack,
    pitchRate: 0,
    t: 0,
  };

  // The crossflow force acts this far from the centre of mass, and the sign of
  // it is the whole of the 1986 rule change.
  const arm = body.centreOfPressure - body.balance;
  const path: ThrowState[] = [{ ...s }];

  // ONE definition of the axial drag, used by the integrator and by the report.
  // Writing it twice — once in the loop and once for the report — means the
  // report describes a formula rather than the flight, and a wrong drag term in
  // the loop goes unreported. That is the second time in two releases that a
  // recomputation has hidden a mutant, so it is a closure.
  const axialDrag = (q: number): number => q * SKIN_FRICTION * body.wetted;
  const releaseDrag = axialDrag(0.5 * AIR_DENSITY * (s.vx * s.vx + s.vy * s.vy));
  let apex = s.y;
  let peakAttack = 0;
  let last = { ...s };

  for (let n = 0; n < 200000 && s.y > 0; n++) {
    const v2 = s.vx * s.vx + s.vy * s.vy;
    const q = 0.5 * AIR_DENSITY * v2;

    // Angle of attack: where it points, minus where it is going.
    const pathAngle = Math.atan2(s.vy, s.vx);
    let alpha = s.pitch - pathAngle;
    // Fold to (-π, π] so a tumbling javelin does not accumulate nonsense.
    alpha = Math.atan2(Math.sin(alpha), Math.cos(alpha));
    if (Math.abs(alpha) > peakAttack) peakAttack = Math.abs(alpha);

    // Allen & Perkins: viscous crossflow, quadratic in α and signed by it.
    const normal = q * CROSSFLOW_DRAG * body.planform * alpha * Math.abs(alpha);
    // Skin friction, along the shaft.
    const axial = axialDrag(q);
    // Munk: a pure couple from potential flow, and it is destabilising.
    const munk = q * body.volume * Math.sin(2 * alpha);

    // Resolve into the flight frame: normal force is perpendicular to the
    // SHAFT, axial drag along it.
    const cp = Math.cos(s.pitch);
    const sp = Math.sin(s.pitch);
    const fx = -normal * sp - axial * cp * Math.sign(s.vx || 1);
    const fy = normal * cp - axial * sp * Math.sign(s.vx || 1);

    // The normal force acts at the centre of pressure, so its moment about the
    // centre of mass is N·arm, with `arm` measured from the mass toward the
    // TIP. A javelin flies point-first, so a centre of pressure behind the mass
    // is a negative arm, and a nose-up disturbance then produces a nose-down
    // moment. Restoring.
    //
    // Getting this sign backwards is not a subtle error. It made the javelin
    // tumble through 180° of angle of attack and land at 44 m — half what a
    // cannonball manages — which is what a divergent pitching moment looks
    // like, and it is worth writing down because it still looked like a flight.
    const moment = normal * arm + munk;

    last = { ...s };
    s.vx += (fx / body.mass) * step;
    s.vy += (fy / body.mass - GRAVITY) * step;
    s.pitchRate += (moment / body.inertia) * step;
    s.pitch += s.pitchRate * step;
    s.x += s.vx * step;
    s.y += s.vy * step;
    s.t += step;
    if (s.y > apex) apex = s.y;
    if (n % 20 === 0) path.push({ ...s });
  }

  // Land it exactly on the ground rather than one step under it.
  const drop = last.y - s.y;
  const f = drop > 1e-12 ? last.y / drop : 0;
  const range = last.x + (s.x - last.x) * f;
  const pitch = last.pitch + (s.pitch - last.pitch) * f;
  const pathAngle = Math.atan2(s.vy, s.vx);
  path.push({ ...s, x: range, y: 0 });
  // Fold the attitude into (-π, π]. Pitch is integrated, so a flight that goes
  // badly winds it past a full turn, and 464° is not an attitude anybody reads.
  const folded = Math.atan2(Math.sin(pitch), Math.cos(pitch));

  // What a judge sees: the angle between the shaft and the ground. The rule was
  // written so this would be steep enough to mark a point in the turf.
  const attitude = Math.atan2(Math.abs(Math.sin(folded)), Math.abs(Math.cos(folded)));

  return {
    range,
    duration: s.t,
    apex,
    landingPitch: folded,
    landingAttitude: attitude,
    landingPath: pathAngle,
    peakAttack,
    releaseDrag,
    releaseDragFraction: body.mass > 0 ? releaseDrag / (body.mass * GRAVITY) : 0,
    // Point-first means the shaft is inclined downward at least as steeply as
    // it is travelling — the tip gets there first and bites.
    pointFirst: folded < 0 && folded <= pathAngle + 1e-9,
    path,
  };
}

/**
 * The range a cannonball would get from the same release, metres.
 *
 * `(v cosθ / g)·(v sinθ + √(v²sin²θ + 2gh))` — the vacuum trajectory, exact,
 * with no air in it at all. It is here because it is the number a javelin has
 * to BEAT: everything above it is lift, and a flight model that comes out below
 * it has not got any.
 */
export function ballisticRange(
  speed: number,
  angle: number,
  height: number = 1.8
): number {
  const vx = speed * Math.cos(angle);
  const vy = speed * Math.sin(angle);
  return (vx * (vy + Math.sqrt(vy * vy + 2 * GRAVITY * Math.max(0, height)))) / GRAVITY;
}
