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

/** One frame of a sampled pose. */
class Pose {
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
}

function buildClip(
  rig: HumanoidRig,
  name: string,
  duration: number,
  fps: number,
  sample: (phase: number, pose: Pose) => void
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
    sample(i === frames ? 0 : i / frames, pose); // last frame = first: seamless loop
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
  const hang = Math.PI / 2 - 0.14; // arms hang with a slight outward splay

  /** Shared limb math for a full gait cycle at phase p. */
  const gait = (
    pose: Pose,
    p: number,
    hipSwing: number,
    kneeFlex: number,
    armSwing: number,
    elbowBend: number,
    bob: number,
    lean: number,
    twist: number
  ): void => {
    for (const side of ['Left', 'Right'] as const) {
      const s = side === 'Left' ? 1 : -1;
      const leg = hipSwing * Math.sin(TAU * p + (s === 1 ? 0 : Math.PI));
      const flex = kneeFlex * halfUp(Math.sin(TAU * p + 0.35 + (s === 1 ? 0 : Math.PI)));
      pose.rotate(`${side}UpLeg`, [X, -leg]);
      pose.rotate(`${side}Leg`, [X, flex]);
      pose.rotate(`${side}Foot`, [X, 0.7 * (leg - flex)]);

      // Arms counter-swing their own side's leg.
      const arm = armSwing * Math.sin(TAU * p + (s === 1 ? Math.PI : 0));
      pose.rotate(`${side}Arm`, [X, -arm], [Z, -s * hang]);
      pose.rotate(`${side}ForeArm`, [Y, -s * (elbowBend + 0.25 * halfUp(arm))]);
    }
    pose.hipsY = restHipsY - 0.012 * rig.height + bob * Math.sin(TAU * 2 * p + 0.4);
    pose.rotate('Hips', [Y, twist * Math.sin(TAU * p)], [Z, 0.03 * Math.sin(TAU * p)]);
    pose.rotate('Spine', [X, lean * 0.45]);
    pose.rotate('Chest', [X, lean * 0.55], [Y, -twist * 1.4 * Math.sin(TAU * p)]);
    pose.rotate('Head', [X, -lean * 0.5]); // eyes stay level when leaning
  };

  const walkDuration = options.walkDuration ?? 1.0;
  const walkHipSwing = options.walkHipSwing ?? 0.55;
  const walk = buildClip(rig, 'walk', walkDuration, fps, (p, pose) => {
    gait(pose, p, walkHipSwing, 0.95, 0.45, 0.3, 0.014 * rig.height, 0.04, 0.07);
  });

  const runDuration = options.runDuration ?? 0.62;
  const runHipSwing = options.runHipSwing ?? 0.85;
  const run = buildClip(rig, 'run', runDuration, fps, (p, pose) => {
    gait(pose, p, runHipSwing, 1.55, 0.85, 1.05, 0.028 * rig.height, 0.24, 0.1);
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
  });

  // Stride-matched reference speeds: 2 steps per cycle, step length from
  // leg geometry and swing amplitude (empirical ground-contact factor).
  const walkSpeed = (2 * 1.35 * rig.legLength * Math.sin(walkHipSwing)) / walkDuration;
  const runSpeed = (2 * 1.6 * rig.legLength * Math.sin(runHipSwing)) / runDuration;

  return { idle, walk, run, walkSpeed, runSpeed };
}
