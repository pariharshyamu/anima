import { Object3D } from 'three';
import type { BoneName, HumanoidRig } from './humanoid';

/** Named attachment points that survive animation (they live on bones). */
export type SocketName = 'handLeft' | 'handRight' | 'back' | 'hipLeft' | 'hipRight' | 'head';

const SOCKETS: Record<
  SocketName,
  { bone: BoneName; offset: [number, number, number]; rotationY?: number }
> = {
  // Grip points sit at the palm, slightly beyond the hand-bone origin.
  handLeft: { bone: 'LeftHand', offset: [0.04, -0.008, 0] },
  handRight: { bone: 'RightHand', offset: [-0.04, -0.008, 0] },
  back: { bone: 'Chest', offset: [0, 0.045, -0.07], rotationY: Math.PI },
  hipLeft: { bone: 'Hips', offset: [0.095, 0, 0.01] },
  hipRight: { bone: 'Hips', offset: [-0.095, 0, 0.01] },
  head: { bone: 'Head', offset: [0, 0.135, 0] },
};

/**
 * Get (and lazily create) a named socket — an empty Object3D parented to
 * the right bone at a body-proportional offset. Offsets scale with the
 * character's height, so a lantern hangs correctly from every villager.
 */
export function getSocket(rig: HumanoidRig, name: SocketName): Object3D {
  const def = SOCKETS[name];
  const bone = rig.bones[def.bone];
  const existing = bone.children.find((c) => c.name === `socket:${name}`);
  if (existing) return existing;
  const socket = new Object3D();
  socket.name = `socket:${name}`;
  const h = rig.height;
  socket.position.set(def.offset[0] * h, def.offset[1] * h, def.offset[2] * h);
  if (def.rotationY) socket.rotation.y = def.rotationY;
  bone.add(socket);
  return socket;
}

/**
 * Attach a prop to a socket: `attach(rig, 'handRight', torch)`. The prop
 * follows the bone through every animation. Returns the socket so you can
 * fine-tune. Pass any Object3D — a SCENA prop's `.object` works directly.
 */
export function attach(rig: HumanoidRig, name: SocketName, object: Object3D): Object3D {
  const socket = getSocket(rig, name);
  socket.add(object);
  return socket;
}
