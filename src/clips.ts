import {
  AnimationClip,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** Gait parameters. Angles in radians; distances scale with the rig. */
export interface GaitOptions {
  /** Walk cycle duration (two steps), seconds. Default 1.0. */
  walkDuration?: number;
  /** Run cycle duration, seconds. Default 0.62. */
  runDuration?: number;
  /**
   * Hip flexion/extension amplitude at walk / run, radians. Defaults 0.36 and
   * 0.53 — about 21 and 30 degrees, which is what a hip actually does. The
   * stance-knee flexion and both declared speeds are re-derived from whatever
   * you pass, so overriding these stays self-consistent.
   */
  walkHipSwing?: number;
  runHipSwing?: number;
  /** Keyframe sampling rate. Default 30. */
  fps?: number;
}

export interface LocomotionClips {
  idle: AnimationClip;
  walk: AnimationClip;
  run: AnimationClip;
  /** Ground speed the walk cycle is stride-matched to (m/s). */
  walkSpeed: number;
  /** Ground speed the run cycle is stride-matched to (m/s). */
  runSpeed: number;
}

/**
 * One frame of a sampled pose.
 * Exported for the interaction module's pose clips; not public API.
 */
export class Pose {
  rotations = new Map<BoneName, Quaternion>();
  hipsY = 0;

  /** Compose axis-angle rotations right-to-left (last arg applied first). */
  rotate(bone: BoneName, ...steps: Array<[Vector3, number]>): void {
    const q = new Quaternion();
    const step = new Quaternion();
    for (const [axis, angle] of steps) {
      q.multiply(step.setFromAxisAngle(axis, angle));
    }
    this.rotations.set(bone, q);
  }

  /**
   * Set a bone from a quaternion computed elsewhere — for poses that are
   * SOLVED rather than authored, where the answer is not a rotation anyone
   * wrote down as an axis and an angle. `climb` places hands on rungs by
   * two-link IK and lands here.
   */
  set(bone: BoneName, q: Quaternion): void {
    this.rotations.set(bone, q.clone());
  }
}

/** Sample a pose function into a loop-seamless clip. Internal export. */
export function buildClip(
  rig: HumanoidRig,
  name: string,
  duration: number,
  fps: number,
  sample: (phase: number, pose: Pose) => void,
  /**
   * Make the last frame a repeat of the first, so the clip loops seamlessly.
   * Default true — but a ONE-SHOT (a vault, a mantle) must end where it ends,
   * and a looping build snaps it back to its start pose on the final frame.
   */
  loop = true,
  /**
   * Round the frame count up to a multiple of this, so the cycle's landmarks
   * land ON keyframes instead of between them.
   *
   * A gait's stride ends at phase 0.25 and 0.75, where the hip reverses and
   * the knee's two curves meet — corners, not smooth turns. Bake a key either
   * side of a corner and the interpolation cuts it off, which shortens the
   * measured stride by however much the bake missed. It is not a small effect
   * and it is not monotone in `fps`: at 30 fps the walk came out 2.87% short
   * and the run 3.14%, at 45 the run was 0.03% and the walk 1.24%, at 60 the
   * walk was 0.03% and the run 1.47% — the good cases are exactly the ones
   * where `round(duration × fps)` happens to divide evenly. Eight, not four:
   * four puts keys on the two stride ends, and eight also puts them on
   * midstance and mid-swing, where the knee peaks. At four the run's 20-key
   * bake still rounded the crossover enough to lift the planted foot 29 mm
   * and read 4.2% airborne on a gait that has no flight phase. Asking for it
   * costs at most seven frames.
   */
  align = 1
): AnimationClip {
  const wanted = Math.max(8, Math.round(duration * fps));
  const frames = align > 1 ? Math.ceil(wanted / align) * align : wanted;
  const times = new Float32Array(frames + 1);
  const probe = new Pose();
  sample(0, probe);
  const boneNames = [...probe.rotations.keys()];
  const rotationValues = new Map(boneNames.map((b) => [b, new Float32Array((frames + 1) * 4)]));
  const hipsValues = new Float32Array((frames + 1) * 3);

  for (let i = 0; i <= frames; i++) {
    times[i] = (i * duration) / frames;
    const pose = new Pose();
    sample(i === frames && loop ? 0 : i / frames, pose);
    for (const bone of boneNames) {
      const q = pose.rotations.get(bone) ?? new Quaternion();
      const out = rotationValues.get(bone)!;
      out.set([q.x, q.y, q.z, q.w], i * 4);
    }
    hipsValues.set([rig.bones.Hips.position.x, pose.hipsY, rig.bones.Hips.position.z], i * 3);
  }

  const tracks = boneNames.map(
    (bone) => new QuaternionKeyframeTrack(`${bone}.quaternion`, times as never, rotationValues.get(bone)! as never)
  );
  tracks.push(new VectorKeyframeTrack('Hips.position', times as never, hipsValues as never) as never);
  return new AnimationClip(name, duration, tracks);
}

const TAU = Math.PI * 2;
const PI = Math.PI;
const halfUp = (v: number): number => Math.max(0, v);
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Where peak knee flexion sits inside the swing, and the skew that puts it
 * there — both read off the standard gait cycle rather than chosen.
 *
 * The landmarks are the textbook ones, as percentages of a stride measured
 * from heel strike: toe-off at 60%, peak swing knee flexion at 73%, next heel
 * strike at 100%. So the peak sits `(73 - 60) / (100 - 60)` of the way through
 * the swing — a third, not the half a symmetric bump would give. `sin(pi * s)`
 * peaks at s = 0.5; `sin(pi * s^SKEW)` peaks where `s^SKEW = 0.5`, so SKEW is
 * whatever puts that at `PEAK`.
 *
 * Getting this wrong is not cosmetic. A symmetric bump leaves the knee bent
 * through terminal swing, and a bent knee with the thigh reaching forward puts
 * the ankle BELOW the planted foot — so the body rides the swinging leg and
 * the gait plants the wrong foot.
 */
const PEAK = (73 - 60) / (100 - 60);
const SKEW = Math.log(0.5) / Math.log(PEAK);

/** The parameters one gait is made of. One object, read by poser and geometry alike. */
interface GaitShape {
  /** Hip flexion/extension amplitude, radians. The real excursion, not a proxy. */
  hipSwing: number;
  /** Peak knee flexion during swing, radians. */
  kneeFlex: number;
  /** Peak knee flexion at midstance, radians. Solved, not authored. */
  stanceFlex: number;
  armSwing: number;
  elbowBend: number;
  lean: number;
  twist: number;
  roll: number;
}

/** Segment lengths and hip-joint offsets, read off the rig rather than assumed. */
interface LegGeometry {
  thigh: number;
  shank: number;
  leg: number;
  offset: Record<'Left' | 'Right', Vector3>;
}

function legGeometry(rig: HumanoidRig): LegGeometry {
  const thigh = Math.abs(rig.bones.LeftLeg.position.y);
  const shank = Math.abs(rig.bones.LeftFoot.position.y);
  return {
    thigh,
    shank,
    leg: thigh + shank,
    offset: {
      Left: rig.bones.LeftUpLeg.position.clone(),
      Right: rig.bones.RightUpLeg.position.clone(),
    },
  };
}

/**
 * Where one ankle is, in the rig's own frame, at phase `p` — closed form.
 *
 * This is forward kinematics over the chain that actually ships: the hip
 * offset, both leg segments, and the pelvis's own yaw and roll. It exists so
 * the declared speeds can be DERIVED from the geometry instead of from a
 * fitted constant, and it stays independent of `measureFootSkate`, which
 * drives an `AnimationMixer` over the baked clip. What is left between them —
 * about three quarters of a per cent at the run — is the 30 fps bake cutting
 * corners off the arc, which is exactly the defect a stride gate is for.
 */
function ankleAt(
  g: LegGeometry,
  shape: GaitShape,
  p: number,
  side: 'Left' | 'Right',
  out: Vector3
): Vector3 {
  let ph = (TAU * p + (side === 'Left' ? 0 : PI)) % TAU;
  if (ph > PI) ph -= TAU;
  if (ph <= -PI) ph += TAU;
  const hip = shape.hipSwing * Math.sin(ph);
  const flex = kneeAngle(g, shape, ph);
  const o = g.offset[side];
  out.set(
    o.x,
    o.y - g.thigh * Math.cos(hip) - g.shank * Math.cos(hip - flex),
    g.thigh * Math.sin(hip) + g.shank * Math.sin(hip - flex)
  );
  return out.applyQuaternion(
    SPIN.setFromAxisAngle(Y, shape.twist * Math.sin(TAU * p)).multiply(
      TILT.setFromAxisAngle(Z, shape.roll * Math.sin(TAU * p))
    )
  );
}

const SPIN = new Quaternion();
const TILT = new Quaternion();

/**
 * The knee, over a whole cycle. Two halves, meeting at zero.
 *
 * `cos(ph) < 0` is stance — the leg is sweeping backward, carrying the body —
 * and there the knee takes a bump peaking at midstance: it is the only place a
 * bend can lower the pelvis without also dragging the foot back under the
 * hips, because there the thigh is vertical. At heel strike and toe-off the
 * bump is zero and the leg is straight, which is what keeps the stride equal
 * to the honest `2·leg·sin(hipSwing)` with no fudge factor anywhere.
 *
 * `cos(ph) > 0` is swing, and there the knee takes a FRONT-LOADED bump: up
 * fast after toe-off, back to straight by heel strike, peaking a third of the
 * way through rather than half.
 *
 * Both halves are zero at both boundaries, so the two meet without a step. An
 * earlier draft solved the swing knee from a clearance target instead, which
 * reads better and is wrong: the depth equation has two roots, they coincide
 * only where the leg is straight, and approaching heel strike the continuous
 * one is the branch that folds the shank back UNDER the hips. It jumped the
 * knee 41 degrees at every heel strike — 27 mm of foot float, 95% of the
 * cycle airborne, and the run 15% out on stride. A foot that has to reach
 * forward and touch down at the same height as the other one is not something
 * a knee can do alone; a real leg spends its heel on it.
 */
function kneeAngle(g: LegGeometry, shape: GaitShape, ph: number): number {
  if (Math.cos(ph) <= 0) return shape.stanceFlex * halfUp(-Math.cos(ph));
  const s = clamp((ph + PI / 2) / PI, 0, 1);
  return shape.kneeFlex * Math.sin(PI * Math.pow(s, SKEW));
}

/** How far the pelvis travels vertically over a cycle — it rides the lower ankle. */
function pelvisRise(g: LegGeometry, shape: GaitShape, samples: number): number {
  const a = new Vector3();
  const b = new Vector3();
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < samples; i++) {
    const y = -Math.min(
      ankleAt(g, shape, i / samples, 'Left', a).y,
      ankleAt(g, shape, i / samples, 'Right', b).y
    );
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return hi - lo;
}

/**
 * The stance flexion that leaves the pelvis flattest.
 *
 * There is a real optimum and it is not "as much as possible". Bending the
 * stance knee lowers the top of the arc, but past a point it starts lowering
 * the bottom too — the two legs are both short at the crossover — and the
 * excursion grows again. So this scans and refines rather than solving, and
 * what comes out is around 14 degrees, against the 18 the gait literature puts
 * on loading response. Two of the six determinants of gait are modelled here;
 * the missing ones are why it is not exactly 18.
 */
function solveStanceFlex(g: LegGeometry, shape: GaitShape): number {
  let lo = 0;
  let hi = 0.6;
  let best = 0;
  for (let pass = 0; pass < 3; pass++) {
    let bestRise = Infinity;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const f = lo + ((hi - lo) * i) / steps;
      const rise = pelvisRise(g, { ...shape, stanceFlex: f }, 180);
      if (rise < bestRise) {
        bestRise = rise;
        best = f;
      }
    }
    const span = (hi - lo) / steps;
    lo = Math.max(0, best - span);
    hi = best + span;
  }
  return best;
}

/**
 * How far the ankle travels while the foot is down — the stride, per step.
 *
 * Stance is exactly half the cycle by construction, and the knee is straight
 * at both ends of it, so this comes out at `2·leg·sin(hipSwing)` to within the
 * pelvis's own yaw. That is the whole point of the rework: the stride is the
 * geometry, and `STRIDE_FACTOR` — a constant fitted to make a mistimed knee's
 * measured stride agree with a formula that ignored it — is gone.
 */
function strideOf(g: LegGeometry, shape: GaitShape, samples = 512): number {
  const v = new Vector3();
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const z = ankleAt(g, shape, 0.25 + (0.5 * i) / samples, 'Left', v).z;
    if (z < lo) lo = z;
    if (z > hi) hi = z;
  }
  return hi - lo;
}

/**
 * Put the lower foot on the ground.
 *
 * A sine-driven leg is a pendulum, and a pendulum's foot traces an ARC: with a
 * straight knee and the hip swung by θ, the ankle rides `leg × (1 − cos θ)`
 * above the floor. At the run's 0.85 rad that is 277 mm. So the raw gait had no
 * foot on the ground for **43% of the walk cycle and 63% of the run**, peaking
 * 79 mm and 222 mm up. A character walking is airborne half the time.
 *
 * Nothing saw it for thirty-odd releases. `npm run skate` measures foot
 * SKATE — how far a planted foot slides horizontally — and says nothing about
 * whether a foot is planted at all; every other check is a screenshot, and a
 * still frame of a floating character looks exactly like a still frame of a
 * walking one.
 *
 * The correction is a pure vertical one: measure where the lower ankle
 * actually is on the posed body and lower the hips onto it. Because it only
 * moves `Hips.position.y`, every descendant translates straight down and no
 * foot's Z changes — the stride, and therefore the whole skate gate, is
 * untouched by construction.
 *
 * What comes out is not a fudge but the compass gait: the pelvis rides highest
 * at midstance and drops as the legs spread, because that is what legs of a
 * fixed length do. It is why the authored `bob` term is gone from the walk and
 * the run — the vertical motion of a gait is a CONSEQUENCE of the leg
 * geometry, not a free parameter, and having both meant the free one was
 * fighting the real one.
 */
function planter(rig: HumanoidRig): (pose: Pose) => void {
  const rest = new Map<BoneName, Quaternion>();
  for (const key of Object.keys(rig.bones) as BoneName[]) {
    rest.set(key, rig.bones[key].quaternion.clone());
  }
  const restHipsY = rig.bones.Hips.position.y;
  const probe = new Vector3();
  // Where the ankle sits, in the rig's own frame, when the body simply stands.
  // Measured, not assumed: it is the foot BONE, not the sole of the shoe.
  rig.object.updateWorldMatrix(true, true);
  const ground = Math.min(
    rig.object.worldToLocal(rig.bones.LeftFoot.getWorldPosition(probe)).y,
    rig.object.worldToLocal(rig.bones.RightFoot.getWorldPosition(probe)).y
  );
  return (pose: Pose): void => {
    for (const [key, q] of rest) rig.bones[key].quaternion.copy(q);
    for (const [key, q] of pose.rotations) rig.bones[key].quaternion.copy(q);
    rig.bones.Hips.position.y = pose.hipsY;
    rig.object.updateWorldMatrix(true, true);
    const lowest = Math.min(
      rig.object.worldToLocal(rig.bones.LeftFoot.getWorldPosition(probe)).y,
      rig.object.worldToLocal(rig.bones.RightFoot.getWorldPosition(probe)).y
    );
    pose.hipsY -= lowest - ground;
    for (const [key, q] of rest) rig.bones[key].quaternion.copy(q);
    rig.bones.Hips.position.y = restHipsY;
  };
}

/**
 * Synthesize idle/walk/run `AnimationClip`s for a humanoid rig from gait
 * parameters — no animation files, deterministic, loop-seamless, and
 * in-place (movement comes from whatever drives the object; `Locomotion`
 * stride-matches playback so feet don't slide).
 */
export function createLocomotionClips(
  rig: HumanoidRig,
  options: GaitOptions = {}
): LocomotionClips {
  const fps = options.fps ?? 30;
  const restHipsY = rig.bones.Hips.position.y;
  const plant = planter(rig);
  const geometry = legGeometry(rig);
  const hang = Math.PI / 2 - 0.14; // arms hang with a slight outward splay

  /** Shared limb math for a full gait cycle at phase p. */
  const gait = (pose: Pose, p: number, shape: GaitShape): void => {
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      let ph = (TAU * p + (s === 1 ? 0 : PI)) % TAU;
      if (ph > PI) ph -= TAU;
      if (ph <= -PI) ph += TAU;
      const leg = shape.hipSwing * Math.sin(ph);
      // The same knee `ankleAt` uses — one function, so the speed the clip
      // declares and the pose the clip holds cannot drift apart.
      const flex = kneeAngle(geometry, shape, ph);
      pose.rotate(`${side}UpLeg`, [X, -leg]);
      pose.rotate(`${side}Leg`, [X, flex]);
      pose.rotate(`${side}Foot`, [X, 0.7 * (leg - flex)]);

      // Arms counter-swing their own side's leg.
      const arm = shape.armSwing * Math.sin(TAU * p + (s === 1 ? PI : 0));
      pose.rotate(`${side}Arm`, [X, -arm], [Z, -s * hang]);
      pose.rotate(`${side}ForeArm`, [Y, -s * (shape.elbowBend + 0.25 * halfUp(arm))]);
    }
    // No authored bob. The vertical motion of a gait is a CONSEQUENCE of the
    // leg geometry, and `planter` derives it; an independent sine on top was
    // a second opinion fighting the real one.
    pose.hipsY = restHipsY - 0.012 * rig.height;
    pose.rotate(
      'Hips',
      [Y, shape.twist * Math.sin(TAU * p)],
      [Z, shape.roll * Math.sin(TAU * p)]
    );
    pose.rotate('Spine', [X, shape.lean * 0.45]);
    pose.rotate('Chest', [X, shape.lean * 0.55], [Y, -shape.twist * 1.4 * Math.sin(TAU * p)]);
    pose.rotate('Head', [X, -shape.lean * 0.5]); // eyes stay level when leaning
  };

  /** Finish a gait: the stance knee is solved, never authored. */
  const settle = (shape: Omit<GaitShape, 'stanceFlex'>): GaitShape => {
    const draft = { ...shape, stanceFlex: 0 };
    return { ...draft, stanceFlex: solveStanceFlex(geometry, draft) };
  };

  const walkDuration = options.walkDuration ?? 1.0;
  // Human hip excursion at a walk is about 21 degrees of flexion and as much
  // extension; at a run, 30. The old 0.55 / 0.85 were half again as large,
  // and the stride factor that went with them was fitted to a knee that bent
  // at the wrong moment — two errors that cancelled in the declared speed and
  // showed up as a pelvis bouncing 95 mm at a walk and 234 at a run.
  const walkShape = settle({
    hipSwing: options.walkHipSwing ?? 0.3606,
    kneeFlex: 1.05, // 60 degrees: peak swing knee flexion, walking
    armSwing: 0.45,
    elbowBend: 0.3,
    lean: 0.04,
    twist: 0.07,
    roll: 0.03,
  });
  const walk = buildClip(
    rig,
    'walk',
    walkDuration,
    fps,
    (p, pose) => {
      gait(pose, p, walkShape);
      plant(pose);
    },
    true,
    8
  );

  const runDuration = options.runDuration ?? 0.62;
  const runShape = settle({
    hipSwing: options.runHipSwing ?? 0.5318,
    kneeFlex: 1.6, // 92 degrees: peak swing knee flexion, running
    armSwing: 0.85,
    elbowBend: 1.05,
    lean: 0.24,
    twist: 0.1,
    roll: 0.03,
  });
  const run = buildClip(
    rig,
    'run',
    runDuration,
    fps,
    (p, pose) => {
      gait(pose, p, runShape);
      plant(pose);
    },
    true,
    8
  );

  const idle = buildClip(rig, 'idle', 3.4, fps, (p, pose) => {
    const breath = Math.sin(TAU * p);
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      pose.rotate(`${side}Arm`, [X, 0.02 * breath], [Z, -s * (hang - 0.03 * breath)]);
      pose.rotate(`${side}ForeArm`, [Y, -s * 0.16]);
      pose.rotate(`${side}UpLeg`, [X, 0]);
      pose.rotate(`${side}Leg`, [X, 0.03]);
      pose.rotate(`${side}Foot`, [X, 0]);
    }
    pose.hipsY = restHipsY - 0.004 * rig.height * (1 + 0.4 * breath);
    pose.rotate('Hips', [Z, 0.012 * Math.sin(TAU * p + 1)]);
    pose.rotate('Spine', [X, 0.015 * breath]);
    pose.rotate('Chest', [X, 0.025 * breath]);
    pose.rotate('Head', [Y, 0.05 * Math.sin(TAU * p + 2)], [X, -0.01 * breath]);
    plant(pose);
  });

  // Stride-matched reference speeds: two steps per cycle, and the step length
  // is the ankle's own travel while the foot is down, taken from the leg's
  // forward kinematics.
  //
  // There is no stride factor any more. There used to be — 1.35, and 1.6 for
  // the run until `measureFootSkate` showed the run's declared speed
  // overstating its real stride by 18.4% on every seed, about 15 cm of slide
  // per step. Solving for the factor that made the measurement agree gave
  // 1.3507, 1.3512, 1.3525, 1.3507 across four seeds, so 1.35 it became.
  //
  // But a constant fitted to a measurement is not a derivation, and this one
  // was covering for a mistimed knee: the swing bump fired at maximum hip
  // flexion instead of in swing, which shortened the real stride by about a
  // third, and 1.35 put a third back. Two errors, cancelling. With the knee
  // timed properly the stride is `2·leg·sin(hipSwing)` and nothing else.
  //
  // `npm run skate` is still the gate, and it now has something left to
  // catch: the ~0.7% the 30 fps bake shaves off the arc, which the fitted
  // constant used to absorb along with everything else.
  const walkSpeed = (2 * strideOf(geometry, walkShape)) / walkDuration;
  const runSpeed = (2 * strideOf(geometry, runShape)) / runDuration;

  return { idle, walk, run, walkSpeed, runSpeed };
}
