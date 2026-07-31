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
  /** Hip swing amplitude at walk / run. Defaults 0.55 / 0.85. */
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
  loop = true
): AnimationClip {
  const frames = Math.max(8, Math.round(duration * fps));
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
const halfUp = (v: number): number => Math.max(0, v);

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
  const hang = Math.PI / 2 - 0.14; // arms hang with a slight outward splay

  /** Shared limb math for a full gait cycle at phase p. */
  const gait = (
    pose: Pose,
    p: number,
    hipSwing: number,
    kneeFlex: number,
    armSwing: number,
    elbowBend: number,
    stanceFlex: number,
    lean: number,
    twist: number
  ): void => {
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      const phase = TAU * p + (s === 1 ? 0 : Math.PI);
      const leg = hipSwing * Math.sin(phase);
      // Swing-leg flexion clears the foot. STANCE-leg flexion — the ~25° a
      // runner's knee bends absorbing the rise over a vertical leg — is a
      // separate thing, and it is why the hips still travel 214 mm a stride
      // at the run. The hook is here and set to zero, because a bent stance
      // knee pulls the ankle BACK: it changes the measured stride, and
      // `STRIDE_FACTOR` below is calibrated against that stride. Turning it on
      // without re-deriving the declared speeds put the run 17.1%% out and
      // `npm run skate` said so. That derivation is its own piece of work.
      const flex =
        kneeFlex * halfUp(Math.sin(phase + 0.35)) + stanceFlex * halfUp(-Math.cos(phase));
      pose.rotate(`${side}UpLeg`, [X, -leg]);
      pose.rotate(`${side}Leg`, [X, flex]);
      pose.rotate(`${side}Foot`, [X, 0.7 * (leg - flex)]);

      // Arms counter-swing their own side's leg.
      const arm = armSwing * Math.sin(TAU * p + (s === 1 ? Math.PI : 0));
      pose.rotate(`${side}Arm`, [X, -arm], [Z, -s * hang]);
      pose.rotate(`${side}ForeArm`, [Y, -s * (elbowBend + 0.25 * halfUp(arm))]);
    }
    // No authored bob. The vertical motion of a gait is a CONSEQUENCE of the
    // leg geometry, and `planter` derives it; an independent sine on top was
    // a second opinion fighting the real one.
    pose.hipsY = restHipsY - 0.012 * rig.height;
    pose.rotate('Hips', [Y, twist * Math.sin(TAU * p)], [Z, 0.03 * Math.sin(TAU * p)]);
    pose.rotate('Spine', [X, lean * 0.45]);
    pose.rotate('Chest', [X, lean * 0.55], [Y, -twist * 1.4 * Math.sin(TAU * p)]);
    pose.rotate('Head', [X, -lean * 0.5]); // eyes stay level when leaning
  };

  const walkDuration = options.walkDuration ?? 1.0;
  const walkHipSwing = options.walkHipSwing ?? 0.55;
  const walk = buildClip(rig, 'walk', walkDuration, fps, (p, pose) => {
    gait(pose, p, walkHipSwing, 0.95, 0.45, 0.3, 0, 0.04, 0.07);
    plant(pose);
  });

  const runDuration = options.runDuration ?? 0.62;
  const runHipSwing = options.runHipSwing ?? 0.85;
  const run = buildClip(rig, 'run', runDuration, fps, (p, pose) => {
    gait(pose, p, runHipSwing, 1.55, 0.85, 1.05, 0, 0.24, 0.1);
    plant(pose);
  });

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

  // Stride-matched reference speeds: 2 steps per cycle, step length from leg
  // geometry and swing amplitude.
  //
  // ONE factor, shared, because both gaits are the same geometry: how far the
  // ankle travels for a given hip swing does not depend on whether you call
  // the motion a walk or a run. The run used to use 1.6 while the walk used
  // 1.35, and `measureFootSkate` showed what that cost — the run's declared
  // speed overstated its real stride by 18.4%, on every seed, which made
  // `Locomotion` play the clip 18% too slowly for the ground covered and slid
  // the planted foot about 15 cm every step. Solving for the factor that makes
  // the measured stride agree gives 1.3507, 1.3512, 1.3525, 1.3507 across four
  // seeds — the walk's number. It was never a run-specific constant; it was an
  // unmeasured guess.
  //
  // `npm run skate` is the gate that keeps them honest.
  const STRIDE_FACTOR = 1.35;
  const walkSpeed = (2 * STRIDE_FACTOR * rig.legLength * Math.sin(walkHipSwing)) / walkDuration;
  const runSpeed = (2 * STRIDE_FACTOR * rig.legLength * Math.sin(runHipSwing)) / runDuration;

  return { idle, walk, run, walkSpeed, runSpeed };
}
