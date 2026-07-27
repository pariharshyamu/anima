import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { Group, Object3D } from 'three';
import {
  createHumanoid,
  Locomotion,
  Cricketer,
  createBowlClip,
  createShotClip,
  createStanceClip,
  swingAt,
  SHOTS,
  SWINGS,
  STANCE_KEY,
  RELEASE_PHASE,
  CONTACT_PHASE,
  type Shot,
} from '../src';

const make = (arm: 1 | -1 = 1) => {
  const rig = createHumanoid({ seed: 4, height: 1.8 });
  const loco = new Locomotion(rig);
  const cricketer = new Cricketer(rig, loco, { arm });
  return { rig, loco, cricketer };
};

const run = (c: Cricketer, loco: Locomotion, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) {
    c.update(1 / 60);
    loco.update(1 / 60, 0);
    c.lateUpdate();
  }
};

/** Wind a stroke to a given phase and stop there. */
const at = (c: Cricketer, loco: Locomotion, shot: Shot, phase: number) => {
  c.play(shot);
  run(c, loco, SWINGS[shot].dur * phase);
};

describe('the bowling action', () => {
  it('announces the release once, near the top of the arm', () => {
    const { cricketer, loco } = make();
    let releases = 0;
    let at = -1;
    cricketer.onRelease(() => {
      releases++;
      at = cricketer.progress;
    });
    cricketer.bowl();
    run(cricketer, loco, 2);
    expect(releases).toBe(1);
    expect(at).toBeGreaterThanOrEqual(RELEASE_PHASE);
    expect(at).toBeLessThan(RELEASE_PHASE + 0.05);
  });

  it('THE ARM COMES OVER: the hand passes above the head at release', () => {
    const { rig, cricketer, loco } = make();
    const head = rig.bones.Head.getWorldPosition(new Vector3()).y;
    let handAtRelease = 0;
    cricketer.onRelease(() => {
      handAtRelease = cricketer.releasePoint().y;
    });
    cricketer.bowl();
    run(cricketer, loco, 2);
    // The delivery arrives from ABOVE — that is the whole action.
    expect(handAtRelease).toBeGreaterThan(head);
  });

  it('the arm never bends: a straight elbow through the swing', () => {
    const { rig, cricketer, loco } = make();
    cricketer.bowl();
    let worst = 0;
    for (let i = 0; i < 90; i++) {
      cricketer.update(1 / 60);
      loco.update(1 / 60, 0);
      // The forearm carries no rotation of its own in the clip.
      const q = rig.bones.RightForeArm.quaternion;
      worst = Math.max(worst, 2 * Math.acos(Math.min(1, Math.abs(q.w))));
    }
    expect(worst).toBeLessThan(0.35);
  });

  it('bowls left-arm too, and mirrors the hand', () => {
    const right = make(1);
    const left = make(-1);
    let rp = new Vector3();
    let lp = new Vector3();
    right.cricketer.onRelease(() => { rp = right.cricketer.releasePoint().clone(); });
    left.cricketer.onRelease(() => { lp = left.cricketer.releasePoint().clone(); });
    right.cricketer.bowl();
    left.cricketer.bowl();
    run(right.cricketer, right.loco, 2);
    run(left.cricketer, left.loco, 2);
    expect(Math.sign(rp.x)).toBe(-Math.sign(lp.x));
    expect(rp.y).toBeCloseTo(lp.y, 1);
  });

  it('hands the body back when the action finishes', () => {
    const { cricketer, loco } = make();
    let done = '';
    cricketer.onDone((a) => { done = a; });
    cricketer.bowl();
    expect(cricketer.action).toBe('bowl');
    run(cricketer, loco, 2.5);
    expect(done).toBe('bowl');
    expect(cricketer.action).toBe(null);
    expect(loco.influence).toBe(1);
  });
});

describe('the strokes', () => {
  it('every shot reports contact once, at the contact phase', () => {
    for (const shot of SHOTS) {
      const { cricketer, loco } = make();
      let hits = 0;
      let at = -1;
      cricketer.onContact(() => { hits++; at = cricketer.progress; });
      cricketer.play(shot);
      run(cricketer, loco, 2);
      expect(hits, shot).toBe(1);
      expect(at, shot).toBeGreaterThanOrEqual(CONTACT_PHASE);
      expect(at, shot).toBeLessThan(CONTACT_PHASE + 0.06);
    }
  });

  it('BOTH HANDS ARE ON THE BAT, in every frame of every stroke', () => {
    // This is the whole reason the strokes are solved onto a path rather
    // than composed out of per-bone angles: a batter holds the bat with
    // two hands, and a formula that poses each arm on its own does not.
    for (const shot of SHOTS) {
      const { rig, cricketer, loco } = make();
      cricketer.play(shot);
      let worst = 0;
      let worstGrip = 0;
      for (let i = 0; i < SWINGS[shot].dur * 60; i++) {
        cricketer.update(1 / 60);
        loco.update(1 / 60, 0);
        cricketer.lateUpdate();
        if (!cricketer.action) break;      // the stroke is over; body handed back
        rig.object.updateWorldMatrix(true, true);
        const l = rig.bones.LeftHand.getWorldPosition(new Vector3());
        const r = rig.bones.RightHand.getWorldPosition(new Vector3());
        worst = Math.max(worst, l.distanceTo(r));
        worstGrip = Math.max(worstGrip, l.distanceTo(cricketer.gripPoint()));
      }
      // A hand's width apart on the handle, never a bat's length.
      expect(worst, shot).toBeLessThan(0.2);
      // And the top hand is ON the grip, not near it.
      expect(worstGrip, shot).toBeLessThan(0.02);
    }
  });

  it('the stance holds the same grip, so no stroke has to snatch the bat', () => {
    const { rig, cricketer, loco } = make();
    cricketer.stance();
    run(cricketer, loco, 1);
    rig.object.updateWorldMatrix(true, true);
    const l = rig.bones.LeftHand.getWorldPosition(new Vector3());
    const r = rig.bones.RightHand.getWorldPosition(new Vector3());
    expect(l.distanceTo(r)).toBeLessThan(0.2);
    expect(l.distanceTo(cricketer.gripPoint())).toBeLessThan(0.02);
  });

  it('THE SWING PLANE IS THE SHOT: each stroke meets the ball somewhere else', () => {
    const contact = (shot: Shot) => {
      const { cricketer, loco } = make();
      at(cricketer, loco, shot, CONTACT_PHASE);
      return cricketer.batPoint();
    };
    const height = (shot: Shot) => contact(shot).y;
    // A sweep is played off the deck; a pull is played off the chest.
    expect(height('sweep')).toBeLessThan(height('drive'));
    expect(height('pull')).toBeGreaterThan(height('drive'));
    expect(height('cut')).toBeGreaterThan(height('drive'));
    // And the horizontal-bat strokes send it square, not straight.
    expect(contact('cut').x).toBeGreaterThan(contact('drive').x + 0.2);
    expect(contact('pull').x).toBeLessThan(contact('drive').x - 0.2);
    expect(contact('sweep').x).toBeLessThan(contact('drive').x - 0.2);
  });

  it('the FINISH separates them too: loft high, defend nowhere', () => {
    const arc = (shot: Shot) => {
      const { cricketer, loco } = make();
      cricketer.play(shot);
      let lo = Infinity;
      let hi = -Infinity;
      let atContact = 0;
      cricketer.onContact(() => { atContact = cricketer.batPoint().y; });
      for (let i = 0; i < SWINGS[shot].dur * 60 - 1; i++) {
        cricketer.update(1 / 60);
        loco.update(1 / 60, 0);
        cricketer.lateUpdate();
        const y = cricketer.batPoint().y;
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      return { rise: hi - atContact, span: hi - lo };
    };
    const drive = arc('drive');
    const loft = arc('loft');
    const defend = arc('defend');
    expect(loft.rise).toBeGreaterThan(drive.rise);
    expect(defend.span).toBeLessThan(drive.span * 0.5);
  });

  it('every stroke stays inside the arms it has to be played with', () => {
    // The shoulders are a fixed distance from the chest and the arms are
    // 0.5 m long; a key outside that is a key the solver has to clamp,
    // and a clamped key is a hand off the bat.
    const L = new Vector3(0.213, 0.169, 0);
    const R = new Vector3(-0.213, 0.169, 0);
    const reach = 0.498;
    const keys: Array<[string, readonly number[], readonly number[]]> = [
      ['stance', STANCE_KEY.grip, STANCE_KEY.blade],
    ];
    for (const shot of SHOTS) {
      for (const k of ['back', 'contact', 'finish'] as const) {
        keys.push([`${shot}.${k}`, SWINGS[shot][k].grip, SWINGS[shot][k].blade]);
      }
    }
    for (const [name, g, b] of keys) {
      const grip = new Vector3().fromArray([...g]);
      const bottom = grip.clone().addScaledVector(new Vector3().fromArray([...b]).normalize(), 0.11);
      for (const [top, bot] of [[L, R], [R, L]] as const) {
        expect(grip.distanceTo(top), name).toBeLessThan(reach);
        expect(bottom.distanceTo(bot), name).toBeLessThan(reach);
      }
    }
  });

  it('swingAt walks the path and scales to the body', () => {
    const back = swingAt('drive', 0);
    const middle = swingAt('drive', CONTACT_PHASE);
    const end = swingAt('drive', 1);
    expect(back.grip.toArray()).toEqual(SWINGS.drive.back.grip);
    expect(middle.grip.y).toBeCloseTo(SWINGS.drive.contact.grip[1], 5);
    expect(end.grip.y).toBeCloseTo(SWINGS.drive.finish.grip[1], 5);
    expect(back.blade.length()).toBeCloseTo(1, 6);
    // A taller batter's hands are further from their own chest.
    expect(swingAt('drive', 0.3, 2.0).grip.length()).toBeGreaterThan(
      swingAt('drive', 0.3, 1.6).grip.length()
    );
  });

  it('a left-hander is the same stroke through the mirror', () => {
    const right = make();
    const left = { rig: createHumanoid({ seed: 4, height: 1.8 }) } as never as ReturnType<typeof make>;
    const rig = createHumanoid({ seed: 4, height: 1.8 });
    const loco = new Locomotion(rig);
    const lefty = new Cricketer(rig, loco, { bats: -1 });
    void left;
    at(right.cricketer, right.loco, 'pull', CONTACT_PHASE);
    at(lefty, loco, 'pull', CONTACT_PHASE);
    expect(Math.sign(right.cricketer.batPoint().x)).toBe(-Math.sign(lefty.batPoint().x));
  });

  it('the bat is DRIVEN by the grip: it never leaves the hands', () => {
    const { rig, cricketer, loco } = make();
    const bat = new Group();
    const toe = new Object3D();
    const handle = new Object3D();
    handle.position.y = 0.7;
    bat.add(toe, handle);
    cricketer.holdBat(bat, { grip: 0.7 });
    expect(bat.parent).toBe(rig.object);
    for (const shot of SHOTS) {
      cricketer.play(shot);
      let worst = 0;
      for (let i = 0; i < SWINGS[shot].dur * 60; i++) {
        cricketer.update(1 / 60);
        loco.update(1 / 60, 0);
        cricketer.lateUpdate();
        if (!cricketer.action) break;
        rig.object.updateWorldMatrix(true, true);
        worst = Math.max(worst, handle.getWorldPosition(new Vector3())
          .distanceTo(cricketer.gripPoint()));
      }
      // The handle is in the hands, to the millimetre, all the way through.
      expect(worst, shot).toBeLessThan(0.005);
    }
    cricketer.holdBat(null);
  });

  it('a shot is one-shot: the body is free again afterwards', () => {
    const { cricketer, loco } = make();
    cricketer.play('drive');
    run(cricketer, loco, 2);
    expect(cricketer.action).toBe(null);
  });
});

describe('the stance', () => {
  it('HOLDS, and breathes, and gets out of the way of a shot', () => {
    const { rig, cricketer, loco } = make();
    cricketer.stance();
    run(cricketer, loco, 1);
    const chest = rig.bones.Chest.quaternion.clone();
    run(cricketer, loco, 2);
    expect(cricketer.action).toBe('stance');
    expect(rig.bones.Chest.quaternion.angleTo(chest)).toBeGreaterThan(0.001);
    // A stroke takes the body straight off it, and gives it back.
    cricketer.play('drive');
    expect(cricketer.action).toBe('drive');
    run(cricketer, loco, 2);
    expect(cricketer.action).toBe(null);
  });

  it('a batter waiting is lower than a batter standing about', () => {
    const { rig, loco } = make();
    const standing = rig.bones.Hips.position.y;
    const c = new Cricketer(rig, loco);
    c.stance();
    run(c, loco, 1.5);
    expect(rig.bones.Hips.position.y).toBeLessThan(standing - 0.05);
    // …but nothing like a keeper's crouch.
    expect(rig.bones.Hips.position.y).toBeGreaterThan(standing - 0.25);
  });
});

describe('keeping and fielding', () => {
  it('the crouch HOLDS, and it breathes', () => {
    const { rig, cricketer, loco } = make();
    cricketer.keep();
    run(cricketer, loco, 1);
    const low = rig.bones.Hips.position.y;
    const chest = rig.bones.Chest.quaternion.clone();
    run(cricketer, loco, 3);
    expect(cricketer.action).toBe('keep');          // still there
    expect(rig.bones.Hips.position.y).toBeLessThan(low + 0.05);
    // Breathing: the chest is not frozen where it was.
    expect(rig.bones.Chest.quaternion.angleTo(chest)).toBeGreaterThan(0.001);
    cricketer.stand();
    expect(cricketer.action).toBe(null);
  });

  it('a keeper crouches: hips well below standing', () => {
    const { rig, loco } = make();
    const standing = rig.bones.Hips.position.y;
    const c = new Cricketer(rig, loco);
    c.keep();
    run(c, loco, 1.5);
    expect(rig.bones.Hips.position.y).toBeLessThan(standing - 0.25);
  });

  it('the throw runs through and finishes', () => {
    const { cricketer, loco } = make();
    let done = false;
    cricketer.onDone(() => { done = true; });
    cricketer.field();
    run(cricketer, loco, 1.6);
    expect(done).toBe(true);
  });
});

describe('the clips themselves', () => {
  it('build at sensible lengths and name themselves', () => {
    const rig = createHumanoid({ seed: 4 });
    const bowl = createBowlClip(rig);
    expect(bowl.name).toBe('cricket-bowl');
    expect(bowl.duration).toBeCloseTo(1.5, 2);
    for (const shot of SHOTS) {
      const clip = createShotClip(rig, shot);
      expect(clip.name, shot).toBe(`cricket-${shot}`);
      expect(clip.duration, shot).toBeGreaterThan(0.5);
      expect(clip.tracks.length, shot).toBeGreaterThan(8);
    }
    const stance = createStanceClip(rig);
    expect(stance.name).toBe('cricket-stance');
    expect(stance.duration).toBeCloseTo(2.6, 2);
  });
});
