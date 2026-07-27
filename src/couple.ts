import { Quaternion, Vector3 } from 'three';
import type { HumanoidRig } from './humanoid';
import { Dance, type DancePulse, type DanceStyle } from './dance';

/**
 * The couple — one dance, two bodies.
 *
 * Every dancer so far has been alone with the music. A partner dance is a
 * different object: **two skeletons under one constraint**, and the whole
 * craft is in what passes between them. `Conversation` couples gazes; this
 * couples bodies, and it is the first kinematic constraint between two
 * ANIMA characters in the trilogy.
 *
 * ```ts
 * const couple = new Couple(leaderRig, followerRig, { style: 'waltz' });
 * couple.place(0, 0, 0);
 * couple.start();
 * game.onUpdate((t) => couple.update(t.delta, woofer.pulse()));
 * ```
 *
 * ## Following is a clock you surrender
 *
 * The follower does not keep time — they keep **the leader's** time, a
 * connection-lag late (~a tenth of a second), because that lag is physically
 * what following *is*: the lead arrives through the frame, and the answer
 * takes as long as an answer takes. The follower's own beat detector is
 * ignored entirely; the connection outranks the music. If the leader drifts,
 * the couple drifts **together** — which is correct, and is the difference
 * between a couple and two soloists who happen to agree.
 *
 * ## The natural opposite is a phase, not a mirror
 *
 * When the leader breaks forward, the follower breaks back — and in salsa
 * and waltz alike, the follower's figure is the leader's figure **half a
 * cycle out of phase**. No mirrored charts, no second repertoire: the same
 * data, offset. Facing each other, her back-break and his forward-break move
 * the same direction across the floor, which is how a couple travels.
 *
 * ## The connection is held, not aimed
 *
 * The joined hands are the one place the styles do not own the body: after
 * both dancers pose, the couple takes the two connection arms and points
 * them at a shared point — computed each frame at equal reach from both
 * shoulders, so the hands actually MEET, through every figure, however far
 * the hips have wandered. The verification is the gangway's: track the gap
 * between the two hand bones through eight seconds of dancing and it stays
 * within a hand's breadth.
 */

export interface CoupleOptions {
  /** A partner style. Default `'waltz'`. */
  style?: Extract<DanceStyle, 'salsa' | 'waltz'>;
  seed?: number;
  /** Free-run tempo before the music says otherwise. */
  bpm?: number;
  /** Connection latency, seconds. The follow arrives this much late. */
  lag?: number;
  /** Distance between the partners' spots, metres. */
  embrace?: number;
}

const X = new Vector3(1, 0, 0);
const NEG_X = new Vector3(-1, 0, 0);

export class Couple {
  readonly leader: Dance;
  readonly follower: Dance;

  private leaderRig: HumanoidRig;
  private followerRig: HumanoidRig;
  private styleName: Extract<DanceStyle, 'salsa' | 'waltz'>;
  private lag: number;
  private embrace: number;
  private reachL: number;
  private reachF: number;
  private tmpA = new Vector3();
  private tmpB = new Vector3();
  private tmpP = new Vector3();
  private q = new Quaternion();

  constructor(leader: HumanoidRig, follower: HumanoidRig, options: CoupleOptions = {}) {
    this.leaderRig = leader;
    this.followerRig = follower;
    this.styleName = options.style ?? 'waltz';
    this.lag = options.lag ?? 0.1;
    this.embrace = options.embrace ?? 0.85;
    const seed = options.seed ?? 1;
    this.leader = new Dance(leader, { seed, bpm: options.bpm });
    this.follower = new Dance(follower, { seed: seed + 101, bpm: options.bpm });
    this.leader.setStyle(this.styleName);
    this.follower.setStyle(this.styleName);

    // The connection arm is the leader's LEFT and the follower's RIGHT —
    // closed position.
    this.reachL = this.reach(leader, 'Left');
    this.reachF = this.reach(follower, 'Right');
  }

  private reach(rig: HumanoidRig, side: 'Left' | 'Right'): number {
    return (
      Math.abs(rig.bones[`${side}ForeArm`].position.x) +
      Math.abs(rig.bones[`${side}Hand`].position.x)
    );
  }

  /** Stand the pair on a spot, face to face, in closed position. */
  place(x: number, z: number, facing = 0): void {
    const l = this.leaderRig.object;
    const f = this.followerRig.object;
    const dx = Math.sin(facing);
    const dz = Math.cos(facing);
    l.position.set(x - dx * (this.embrace / 2), 0, z - dz * (this.embrace / 2));
    l.rotation.y = facing;
    f.position.set(x + dx * (this.embrace / 2), 0, z + dz * (this.embrace / 2));
    f.rotation.y = facing + Math.PI;
    l.updateWorldMatrix(true, true);
    f.updateWorldMatrix(true, true);
  }

  get dancing(): boolean {
    return this.leader.dancing;
  }

  start(): void {
    this.leader.start();
    this.follower.start();
  }

  stop(): void {
    this.leader.stop();
    this.follower.stop();
  }

  /**
   * One tick of the couple: the leader hears the music, the follower hears
   * the leader, and the connection is re-held after both have danced.
   */
  update(dt: number, pulse?: DancePulse): void {
    this.leader.update(dt, pulse);
    // The follower's clock IS the leader's, half a cycle out (the natural
    // opposite) and a connection-lag late. Their pulse carries the energy —
    // a follower still dances louder when the music is louder — but no beat
    // and no tempo: the connection outranks the music.
    const counts = this.styleName === 'waltz' ? 6 : 8;
    const muted = pulse ? { ...pulse, beat: false, bpm: 0 } : undefined;
    this.follower.slaveTo(this.leader.phase - counts / 2 - this.lag * (this.leaderTempo() / 60));
    this.follower.update(dt, muted);
    this.holdConnection();
  }

  /** The tempo the couple is actually dancing at, from the leader's clock. */
  private leaderTempo(): number {
    const p = this.leader.pulseTempo;
    return p > 0 ? p : 120;
  }

  /** Metres between the two joined hand bones, right now. */
  handGap(): number {
    this.leaderRig.object.updateWorldMatrix(true, true);
    this.followerRig.object.updateWorldMatrix(true, true);
    this.leaderRig.bones.LeftHand.getWorldPosition(this.tmpA);
    this.followerRig.bones.RightHand.getWorldPosition(this.tmpB);
    return this.tmpA.distanceTo(this.tmpB);
  }

  /**
   * Point both connection arms at one shared, mutually reachable point.
   * Computed fresh every frame from wherever the figures have put the hips,
   * so the hold survives the box, the breaks and the travel.
   */
  private holdConnection(): void {
    const lRig = this.leaderRig;
    const fRig = this.followerRig;
    // The REAL posed shoulder positions, chest bend and all — an estimate
    // from the rest chain drifts two hand-widths once a waltz frame leans.
    lRig.object.updateWorldMatrix(true, true);
    fRig.object.updateWorldMatrix(true, true);
    const a = lRig.bones.LeftArm.getWorldPosition(this.tmpA);
    const b = fRig.bones.RightArm.getWorldPosition(this.tmpB);

    // The shared point: on the plane between the shoulders, pushed out to
    // the couple's open side far enough that both arms just reach it.
    const mid = this.tmpP.copy(a).add(b).multiplyScalar(0.5);
    const half = a.distanceTo(b) / 2;
    const r = Math.min(this.reachL, this.reachF) * 0.96;
    const out = Math.sqrt(Math.max(0.01, r * r - half * half));
    // "Out" is the leader's left: perpendicular to the line between them.
    const alongX = b.x - a.x;
    const alongZ = b.z - a.z;
    const len = Math.max(1e-6, Math.hypot(alongX, alongZ));
    const sideX = alongZ / len;
    const sideZ = -alongX / len;
    mid.x += sideX * out;
    mid.z += sideZ * out;
    mid.y = (a.y + b.y) / 2 - 0.05;

    this.aimArm(lRig, 'Left', a, mid);
    this.aimArm(fRig, 'Right', b, mid);
  }

  /** Rotate one arm straight at a world point; the hand lands on it. */
  private aimArm(rig: HumanoidRig, side: 'Left' | 'Right', base: Vector3, target: Vector3): void {
    const dir = new Vector3().copy(target).sub(base);
    // World direction → the ARM'S PARENT frame, exactly — the shoulder and
    // every spine bend above it are in the parent's world quaternion.
    const parent = rig.bones[`${side}Arm`].parent!;
    parent.getWorldQuaternion(this.q);
    dir.applyQuaternion(this.q.invert()).normalize();
    rig.bones[`${side}Arm`].quaternion.setFromUnitVectors(side === 'Left' ? X : NEG_X, dir);
    // A held arm is never a ramrod: the elbow gives a few degrees.
    rig.bones[`${side}ForeArm`].quaternion.setFromAxisAngle(
      new Vector3(0, 1, 0),
      side === 'Left' ? -0.08 : 0.08
    );
    rig.bones[`${side}Hand`].quaternion.identity();
  }
}
