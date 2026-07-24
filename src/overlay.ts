import {
  AnimationClip,
  AnimationUtils,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
} from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** Bone-mask presets for overlays. */
export const UPPER_BODY: BoneName[] = [
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
];

/**
 * Restrict a clip to a set of bones — the bone-mask primitive. Returns a
 * new clip containing only tracks that target the given bones.
 */
export function maskClip(clip: AnimationClip, bones: readonly BoneName[]): AnimationClip {
  const allowed = new Set<string>(bones);
  const tracks = clip.tracks.filter((track) => allowed.has(track.name.split('.')[0]));
  return new AnimationClip(`${clip.name}#masked`, clip.duration, tracks);
}

/**
 * A procedural greeting: the right arm rises and waves, authored as an
 * ADDITIVE clip (deltas from its own neutral first frame), so it layers
 * cleanly on top of idle or walk — wave while walking, like a person.
 *
 * ```ts
 * const action = loco.overlay(createWaveClip(rig), { loop: false });
 * ```
 */
export function createWaveClip(rig: HumanoidRig, duration = 1.8): AnimationClip {
  void rig;
  const fps = 30;
  const frames = Math.round(duration * fps);
  const times = new Float32Array(frames + 1);
  const armValues = new Float32Array((frames + 1) * 4);
  const foreValues = new Float32Array((frames + 1) * 4);
  const hang = Math.PI / 2 - 0.14;
  const q = new Quaternion();
  const step = new Quaternion();

  const smooth = (t: number): number => t * t * (3 - 2 * t);
  for (let i = 0; i <= frames; i++) {
    times[i] = (i * duration) / frames;
    const w = i / frames;
    // Rise quickly, wave in the middle, settle at the end (loop-safe).
    const amp = smooth(Math.min(1, w / 0.18)) * smooth(Math.min(1, (1 - w) / 0.18));
    // Right arm: from hanging (Rz +hang) up and out (Rz small).
    const armAngle = hang - amp * (hang + 0.25);
    q.setFromAxisAngle(Z, armAngle);
    armValues.set([q.x, q.y, q.z, q.w], i * 4);
    // Forearm: bent up, oscillating side to side — the actual wave.
    const wag = amp * (0.85 + 0.45 * Math.sin(w * Math.PI * 8));
    q.setFromAxisAngle(Y, wag).multiply(step.setFromAxisAngle(Z, amp * 0.35));
    foreValues.set([q.x, q.y, q.z, q.w], i * 4);
  }

  const clip = new AnimationClip('wave', duration, [
    new QuaternionKeyframeTrack('RightArm.quaternion', times as unknown as number[], armValues as unknown as number[]),
    new QuaternionKeyframeTrack('RightForeArm.quaternion', times as unknown as number[], foreValues as unknown as number[]),
  ]);
  // Deltas relative to frame 0 (the hanging pose) → layers onto any gait.
  return AnimationUtils.makeClipAdditive(clip);
}

const X = new Vector3(1, 0, 0);

/**
 * A one-shot reach — the near arm extends forward to a control and returns,
 * peaking near the middle. Authored ADDITIVE so it layers over idle, a walk,
 * or the `operate` hold, and pairs with `Gesture` to actuate a manipulable at
 * the reach apex (so the hand and the mechanism move together).
 *
 * ```ts
 * const reach = new Gesture(loco, createReachClip(rig), { onApex: () => lever.toggle() });
 * ```
 */
export function createReachClip(rig: HumanoidRig, duration = 1.1): AnimationClip {
  void rig;
  const fps = 30;
  const frames = Math.round(duration * fps);
  const times = new Float32Array(frames + 1);
  const armValues = new Float32Array((frames + 1) * 4);
  const foreValues = new Float32Array((frames + 1) * 4);
  const chestValues = new Float32Array((frames + 1) * 4);
  const q = new Quaternion();
  const smooth = (t: number): number => t * t * (3 - 2 * t);

  for (let i = 0; i <= frames; i++) {
    times[i] = (i * duration) / frames;
    const w = i / frames;
    // Bell curve peaking ~45%: reach out, hold a beat, draw back.
    const amp = smooth(Math.min(1, w / 0.35)) * smooth(Math.min(1, (1 - w) / 0.42));
    // Right arm swings forward (about X); forearm straightens; chest leans in.
    q.setFromAxisAngle(X, -amp * 0.95);
    armValues.set([q.x, q.y, q.z, q.w], i * 4);
    q.setFromAxisAngle(X, -amp * 0.7);
    foreValues.set([q.x, q.y, q.z, q.w], i * 4);
    q.setFromAxisAngle(X, amp * 0.14);
    chestValues.set([q.x, q.y, q.z, q.w], i * 4);
  }

  const clip = new AnimationClip('reach', duration, [
    new QuaternionKeyframeTrack('RightArm.quaternion', times as unknown as number[], armValues as unknown as number[]),
    new QuaternionKeyframeTrack('RightForeArm.quaternion', times as unknown as number[], foreValues as unknown as number[]),
    new QuaternionKeyframeTrack('Chest.quaternion', times as unknown as number[], chestValues as unknown as number[]),
  ]);
  return AnimationUtils.makeClipAdditive(clip);
}
