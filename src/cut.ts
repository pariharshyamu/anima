/**
 * Cut — a hit is a PRESSURE, and a pressure is a force over an area.
 *
 * `Striking` measures what a blow arrives with: an effective mass, a speed, an
 * impulse in kg·m/s. `Blade` measures what the object is: a mass distribution,
 * a width at every point along it, a curve. Neither of them knows what
 * happens when the two meet, because that question needs a third thing —
 * **how small an area the force lands on** — and that is what this file is.
 *
 * ## Two criteria, and they disagree by four orders of magnitude
 *
 * Everybody's intuition about cutting is a STRESS criterion: the edge presses,
 * the pressure reaches the material's strength, the material parts.
 *
 *   F_start = σ · A_contact
 *
 * That is correct, and it is also almost irrelevant, and finding out why was
 * the whole point of writing this. A sharp point has a contact area of about
 * 3 × 10⁻¹⁰ m². Skin's ultimate tensile strength is about 20 MPa. Multiply:
 *
 *   **six milli-newtons.** The weight of a paperclip.
 *
 * The forensic literature — instrumented knives, measured — puts the force to
 * push a sharp blade through human skin in the region of ten to fifty
 * newtons. Four orders of magnitude apart, and the stress criterion is the one
 * that is wrong about the world.
 *
 * What actually costs is making new SURFACE. A cut is a crack, a crack has two
 * faces, and every square metre of face costs the material's work of fracture:
 *
 *   E = R · w · d          w the width of the wound, d how deep it went
 *   F_keep = dE/dd = R · w
 *
 * For skin at 3 kJ/m² and a 20 mm blade that is **60 N**, which is the
 * measured band. Sharpness decides whether a cut STARTS. Toughness decides
 * what it COSTS, and they are not the same question.
 *
 * ## What that settles about weapons
 *
 * - **A thrust concentrates about two hundred times harder than a cut**, at
 *   the same force, because a point is an area and an edge is a line.
 * - **Curvature is a pressure multiplier.** A curved edge meets a flat target
 *   on a chord — `L = 2√(2Rδ)` — so a strongly curved sabre engages half the
 *   edge a straight sword does and doubles its pressure for free. Nobody has
 *   to be told sabres are curved; the chord of a circle says it.
 * - **An axe has no business cutting anything.** Its edge is thirty times
 *   blunter than a sword's. It cuts because its bit is curved to 120 mm, and
 *   because there is an enormous amount of energy behind it — which is the
 *   same mass-at-the-far-end that made it slow to swing.
 *
 * ## What is NOT here
 *
 * Damage. There is no hit point in this file and nowhere one could go. What
 * comes out is a pressure in pascals, a force in newtons and a depth in
 * metres, and what a game does with those is the game's business.
 */

/**
 * Edge apex radii, metres.
 *
 * The single most consequential number about a blade and the only one nobody
 * can see: a sharp edge and a dull one differ by two orders of magnitude in a
 * dimension smaller than a red blood cell. These are the ordinary published
 * bands for steel edges under a scanning electron microscope.
 */
export const EDGES = {
  /** A fresh razor or a stropped straight razor. */
  razor: 1e-7,
  /** A properly sharpened knife or sword. */
  sharp: 5e-7,
  /** A working edge: used, wiped, not resharpened today. */
  service: 3e-6,
  /** Blunted by use or never taken past a coarse stone. An axe lives here. */
  blunt: 3e-5,
  /** A bar with a bevel on it. Will bruise and break, not cut. */
  dull: 2e-4,
} as const;

export type EdgeName = keyof typeof EDGES;
export const EDGE_NAMES = Object.keys(EDGES) as EdgeName[];

/**
 * What a target is made of.
 *
 * `strength` decides whether a cut can start; `toughness` decides what
 * continuing it costs, per square metre of new surface. They are independent —
 * skin is strong and tough, muscle is neither, mild steel is far stronger than
 * leather and not much tougher.
 */
export interface TargetSpec {
  label: string;
  /** Ultimate tensile strength, Pa. */
  strength: number;
  /**
   * Work of fracture, J/m² — the energy to create one square metre of new
   * crack face.
   *
   * For the elastic solids this is DERIVED, `R = K²/E` (Griffith/Irwin), from
   * a published fracture toughness and modulus. For skin and muscle it is
   * measured directly, because linear elastic fracture mechanics does not
   * describe them: they are non-linear, anisotropic, and dissipate most of the
   * energy in a process zone far larger than any crack tip. Using `K²/E` there
   * would be arithmetic on an assumption that does not hold.
   */
  toughness: number;
  /** kg/m³, so a depth can be turned back into a mass of material moved. */
  density: number;
}

/**
 * Griffith's relation: the energy to open a crack, from the stress intensity
 * it takes and the stiffness of what is being opened.
 *
 *   R = K² / E
 *
 * Exported because it is where four of the six numbers below come from, and a
 * derivation nobody can see is a derivation nobody has checked.
 */
export function griffith(K: number, E: number): number {
  if (!(E > 0)) return 0;
  return (K * K) / E;
}

/**
 * Six things to hit.
 *
 * Two soft tissues with measured work of fracture (Purslow's band for skin is
 * 2.5–20 kJ/m² depending on thickness and species; human dermis sits low in
 * it), and four elastic solids whose toughness is computed from `K²/E`.
 */
export const TARGETS: Record<string, TargetSpec> = {
  /** Human dermis. The barrier — once it is through, almost nothing resists. */
  skin: { label: 'Skin', strength: 20e6, toughness: 3000, density: 1100 },
  /** Skeletal muscle. Weak, and cheap to open. */
  muscle: { label: 'Muscle', strength: 0.3e6, toughness: 1000, density: 1060 },
  /** Woven linen — a gambeson layer, and much stronger than it looks. */
  linen: { label: 'Linen', strength: 50e6, toughness: 6000, density: 1400 },
  /** Boiled leather. Not very strong and remarkably expensive to tear. */
  leather: { label: 'Leather', strength: 25e6, toughness: 10000, density: 950 },
  /** Pine ACROSS the grain — cutting fibres, which is the dear direction. */
  pine: { label: 'Pine (across grain)', strength: 41.4e6, toughness: griffith(5e6, 10e9), density: 500 },
  /** ...and pine ALONG it, which is splitting, and is the whole reason a wedge
   * beats an edge on firewood. */
  pineSplit: { label: 'Pine (along grain)', strength: 3e6, toughness: griffith(0.4e6, 0.7e9), density: 500 },
  /** Riveted mail: wrought iron, and tougher per square metre than any of it. */
  mail: { label: 'Mail', strength: 400e6, toughness: griffith(50e6, 200e9), density: 7850 },
};

export type TargetName = keyof typeof TARGETS;
export const TARGET_NAMES = Object.keys(TARGETS) as TargetName[];

// ------------------------------------------------------------------- areas

/**
 * The contact area of an EDGE, m².
 *
 * An edge apex is a cylinder of radius `r` lying along the contact. Pressed
 * into a flat surface it touches over a strip about `2r` wide and `L` long, so
 * `A = 2·r·L` — the standard first-order contact for a rounded wedge, and the
 * reason the apex radius matters far more than the bevel angle.
 */
export function edgeArea(radius: number, contact: number): number {
  return 2 * Math.max(0, radius) * Math.max(0, contact);
}

/**
 * The contact area of a POINT, m².
 *
 * `π·r²`. A tip is a hemisphere, not a cylinder, and that one difference — an
 * area instead of a line — is the whole of why a thrust goes in and a cut does
 * not.
 */
export function tipArea(radius: number): number {
  return Math.PI * Math.max(0, radius) ** 2;
}

/**
 * How much edge a curved blade actually engages against a flat target, metres.
 *
 * The chord of a circle at depth δ: `L = 2√(2Rδ)`, exact for δ ≪ R. A straight
 * blade has no chord — it lies along the whole contact it is given — so
 * `Infinity` curvature returns the offered length unchanged.
 *
 * This is the entire case for a curved sword. At 1 mm of bite, a 0.9 m sabre
 * engages 85 mm and a 0.12 m axe bit engages 31 mm, while a straight blade
 * pressed flat engages everything it is laid across. Same push, a third of the
 * contact, three times the pressure — and nobody had to choose that.
 */
export function engagedLength(curve: number | undefined, bite: number, offered: number): number {
  const r = curve ?? Infinity;
  if (!Number.isFinite(r) || r <= 0) return offered;
  const chord = 2 * Math.sqrt(2 * r * Math.max(0, bite));
  return Math.min(offered, chord);
}

// -------------------------------------------------------------- the criteria

/** Force over area. Pascals. The whole file in one line. */
export function pressure(force: number, area: number): number {
  if (!(area > 0)) return Infinity;
  return force / area;
}

/**
 * The bluntest edge that still bites, metres.
 *
 * Invert the stress criterion: `σ = F / (2·r·L)` solved for `r`, so
 *
 *   r_max = F / (2·L·σ)
 *
 * Closed form, so it can be checked against `measureCut` rather than believed
 * — hand it back the radius it returns and the pressure lands exactly on the
 * material's strength. This is the number that says how far an edge can be let
 * go before a hard swing stops cutting and starts bruising.
 */
export function bluntestThatBites(target: TargetSpec, force: number, contact: number): number {
  const d = 2 * Math.max(1e-12, contact) * target.strength;
  return force / d;
}

/**
 * The force at which a cut STARTS, newtons.
 *
 * `σ · A`. Stress criterion, and it is tiny — a sharp point starts a cut in
 * skin at milli-newtons. This is the number that says a blade is sharp enough
 * to bite at all, and it says almost nothing about what happens next.
 */
export function initiationForce(target: TargetSpec, area: number): number {
  return target.strength * area;
}

/**
 * The force it takes to KEEP cutting, newtons.
 *
 * `R · w` — the work of fracture times the width of the wound, which is
 * `dE/dd` for a crack of constant width. Independent of how sharp the blade
 * is, which is the part that surprises people: sharpness gets you in, and
 * after that you are paying for surface.
 */
export function propagationForce(target: TargetSpec, width: number): number {
  return target.toughness * Math.max(0, width);
}

/**
 * An UPPER BOUND on how deep a given energy gets, metres.
 *
 *   d ≤ E / (R·w)
 *
 * It is named a bound rather than a depth because that is what it is, and the
 * gap is large. Every joule goes into new crack surface here — nothing to
 * friction on the blade faces, nothing to wedging the two halves apart around
 * a blade that has its own thickness, nothing to pushing the whole target.
 * For a thin, weak target that is nearly the truth. For a plank it is out by
 * more than an order of magnitude: a 113 J hammerfist through an arming sword
 * comes out at 1.5 metres into pine, which is not a thing that happens.
 *
 * The honest response to that is to keep the bound and say so, not to fit a
 * coefficient until the number looks plausible. Atkins gives the missing terms
 * — a plasticity term and a friction term — and both need a measurement of how
 * the blade's flanks load the material, which is not in this library and has
 * not been invented for it. What IS believable here is the FORCE, `R·w`, which
 * has a measured band to sit in.
 */
export function cutDepth(energy: number, target: TargetSpec, width: number): number {
  const per = propagationForce(target, width);
  if (!(per > 0)) return Infinity;
  return Math.max(0, energy) / per;
}

// ------------------------------------------------------------------ reports

export interface CutInput {
  /** Joules behind it. `Blow.energy` drops straight in. */
  energy: number;
  /** Newtons pressing the edge in. */
  force: number;
  /** Edge apex radius, metres. */
  radius: number;
  /** Width of the wound the blade opens, metres — `sectionAt().width`. */
  width: number;
  /** Length of edge laid across the target, metres, before curvature. */
  contact: number;
  /** Radius of curvature of the edge, metres. Straight blades omit it. */
  curve?: number;
  /** How far in the edge is when the contact is measured, metres. */
  bite?: number;
}

export interface CutReport {
  /** Metres of edge actually touching, after the chord. */
  engaged: number;
  /** m². */
  area: number;
  /** Pa. */
  pressure: number;
  /** Whether the pressure reached the material's strength. */
  bites: boolean;
  /** N — what it took to start. */
  toStart: number;
  /** N — what it takes to keep going, per unit depth. */
  toContinue: number;
  /**
   * An UPPER BOUND on how deep it went, metres. Zero if it never bit.
   * See `cutDepth`: this is all the energy into new surface and nothing into
   * friction or wedging, and for a thick target it is out by more than 10x.
   */
  depthBound: number;
  /** Joules to open the wound that bound describes. */
  work: number;
}

/** One cut, measured. */
export function measureCut(input: CutInput, target: TargetSpec): CutReport {
  const bite = input.bite ?? 0.001;
  const engaged = engagedLength(input.curve, bite, input.contact);
  const area = edgeArea(input.radius, engaged);
  const p = pressure(input.force, area);
  const bites = p >= target.strength;
  const depth = bites ? cutDepth(input.energy, target, input.width) : 0;
  return {
    engaged,
    area,
    pressure: p,
    bites,
    toStart: initiationForce(target, area),
    toContinue: propagationForce(target, input.width),
    depthBound: depth,
    work: propagationForce(target, input.width) * depth,
  };
}

export interface ThrustInput {
  /** Joules behind it. */
  energy: number;
  /** Newtons. */
  force: number;
  /** Point radius, metres. */
  radius: number;
  /** Width of the blade at the depth reached, metres — the wound it opens. */
  width: number;
}

export interface ThrustReport {
  /** m² — `π·r²`, and it is minute. */
  area: number;
  /** Pa. */
  pressure: number;
  bites: boolean;
  /** N — the stress criterion, and it is the number that misleads. */
  toStart: number;
  /** N — the energy criterion, and it is the number that governs. */
  toContinue: number;
  /** An UPPER BOUND on the depth, metres. See `cutDepth`. */
  depthBound: number;
  /**
   * How far apart the two criteria are, as a ratio.
   *
   * This is the finding, kept as a reported quantity rather than a comment,
   * because when it stops being four orders of magnitude somebody should have
   * to explain why.
   */
  disagreement: number;
}

/** One thrust, measured. */
export function measureThrust(input: ThrustInput, target: TargetSpec): ThrustReport {
  const area = tipArea(input.radius);
  const p = pressure(input.force, area);
  const bites = p >= target.strength;
  const toStart = initiationForce(target, area);
  const toContinue = propagationForce(target, input.width);
  return {
    area,
    pressure: p,
    bites,
    toStart,
    toContinue,
    depthBound: bites ? cutDepth(input.energy, target, input.width) : 0,
    disagreement: toStart > 0 ? toContinue / toStart : Infinity,
  };
}
