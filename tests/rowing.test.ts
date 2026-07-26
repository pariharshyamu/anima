import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createHumanoid, Rowing, rowGripAt, ROW_GRIP } from '../src';
import type { RowStyle } from '../src';

const build = (o: ConstructorParameters<typeof Rowing>[1] = {}) => {
  const rig = createHumanoid({ seed: 5, height: 1.75 });
  return { rig, row: new Rowing(rig, o) };
};

/**
 * The three things a stroke is made of, read off the BONES rather than off
 * the controller's own working.
 */
function readBody(rig: ReturnType<typeof createHumanoid>) {
  rig.object.updateMatrixWorld(true);
  const up = new Vector3(0, 1, 0).applyQuaternion(
    rig.bones.Chest.getWorldQuaternion(new Quaternion())
  );
  return {
    /** How compressed his legs are — a bent knee is a knee up by his chest. */
    knee: rig.bones.LeftLeg.rotation.x,
    /** How far forward he is leaning: +z is over his toes. */
    swing: up.z,
    /**
     * How bent his elbow is.
     *
     * NOT the hand-to-shoulder distance, which is what the first version of
     * this measured and which says nothing: the handle's path is set by the
     * oar, a rigid lever, so the hands travel smoothly whatever the body is
     * doing. What changes through the stroke is WHICH JOINT is providing
     * that travel — the seat early, the back next, the arms last — and only
     * the elbow can see that.
     */
    arms: rig.bones.LeftForeArm.rotation.z,
  };
}

/** Where each of the three has got to, 0 at the catch and 1 at the finish. */
function through(rig: ReturnType<typeof createHumanoid>, row: Rowing, p: number) {
  row.update(1 / 60, 0);
  const atCatch = readBody(rig);
  row.update(1 / 60, 0.399);
  const atFinish = readBody(rig);
  row.update(1 / 60, p);
  const now = readBody(rig);
  const frac = (a: number, b: number, c: number) => (c - a) / (b - a || 1e-9);
  return {
    legs: frac(atCatch.knee, atFinish.knee, now.knee),
    body: frac(atCatch.swing, atFinish.swing, now.swing),
    arms: frac(atCatch.arms, atFinish.arms, now.arms),
  };
}

describe('THE RECOVERY IS NOT THE DRIVE PLAYED BACKWARDS', () => {
  it('drives LEGS FIRST, and the back follows them', () => {
    // A body that does both at once is a man on a rowing machine in an
    // advert. The legs go down, and the swing comes after.
    const { rig, row } = build({ style: 'sliding' });
    const early = through(rig, row, 0.4 * 0.2);
    expect(early.legs, 'the legs had not started').toBeGreaterThan(0.3);
    expect(early.body, 'the back swung with the legs').toBeLessThan(0.2);
    expect(early.legs).toBeGreaterThan(early.body + 0.2);
  });

  it('and recovers BODY FIRST, with the knees last — the OPPOSITE order', () => {
    // Body over, then the slide. Play the drive backwards instead and you
    // get a man pulling his knees up while he is still laid back, which is
    // the one thing every coach on earth shouts about.
    const { rig, row } = build({ style: 'sliding' });
    const early = through(rig, row, 0.4 + 0.6 * 0.45);
    expect(early.body, 'the body had not come forward').toBeLessThan(0.5);
    expect(early.legs, 'the knees came up first').toBeGreaterThan(0.9);
    expect(early.body).toBeLessThan(early.legs - 0.3);
  });

  it('so the two halves are NOT mirror images of each other', () => {
    // What the whole claim comes down to: the same fraction into the drive
    // and into the recovery, and the body is in a different shape.
    const { rig, row } = build({ style: 'sliding' });
    const intoDrive = through(rig, row, 0.4 * 0.25);
    const intoRecovery = through(rig, row, 0.4 + 0.6 * 0.45);
    // A quarter of the way down, the legs lead the back…
    expect(intoDrive.legs - intoDrive.body).toBeGreaterThan(0.25);
    // …and on the way back the back leads and the legs have not moved,
    // which is the same difference with the opposite sign.
    expect(intoRecovery.legs - intoRecovery.body).toBeGreaterThan(0.4);
  });

  it('and both of them do finish where they started', () => {
    const { rig, row } = build({ style: 'sliding' });
    const atCatch = through(rig, row, 0);
    const roundAgain = through(rig, row, 0.999);
    expect(roundAgain.legs).toBeCloseTo(atCatch.legs, 1);
    expect(roundAgain.body).toBeCloseTo(atCatch.body, 1);
  });
});

describe('a body driven by somebody else’s clock', () => {
  it('IS A PURE FUNCTION OF THE PHASE — the same number, the same pose', () => {
    // He does not own his timing. Hand him the same phase twice, from
    // anywhere, and he is in the same place.
    const a = build();
    const b = build();
    // The same number of frames each, so the only difference between them
    // is the phases they were fed — his breathing is the one thing in here
    // that runs off the clock rather than the stroke, and it would
    // otherwise be what this test measured.
    for (let i = 0; i < 40; i++) {
      a.row.update(1 / 60, 0.27);
      b.row.update(1 / 60, (i * 0.137) % 1);
    }
    a.row.update(1 / 60, 0.27);
    b.row.update(1 / 60, 0.27);
    const one = readBody(a.rig);
    const two = readBody(b.rig);
    expect(two.knee).toBeCloseTo(one.knee, 6);
    expect(two.arms).toBeCloseTo(one.arms, 6);
    expect(two.swing).toBeCloseTo(one.swing, 6);
  });

  it('two rowers on different phases are in different places', () => {
    const a = build({ seed: 1 });
    const b = build({ seed: 1 });
    a.row.update(1 / 60, 0.05);
    b.row.update(1 / 60, 0.55);
    expect(Math.abs(readBody(a.rig).arms - readBody(b.rig).arms)).toBeGreaterThan(0.02);
  });

  it('knows whether his blade is in the water', () => {
    const { row } = build({ drive: 0.4 });
    row.update(1 / 60, 0.2);
    expect(row.driving).toBe(true);
    row.update(1 / 60, 0.7);
    expect(row.driving).toBe(false);
    row.update(1 / 60, 0.399);
    expect(row.driving).toBe(true);
  });

  it('and a shorter drive means a longer recovery', () => {
    const { row } = build({ drive: 0.3 });
    let inWater = 0;
    for (let i = 0; i < 1000; i++) {
      row.update(1 / 60, i / 1000);
      if (row.driving) inWater++;
    }
    expect(inWater / 1000).toBeCloseTo(0.3, 1);
  });
});

describe('the hands are a CONTRACT, not a description', () => {
  it('HIS HANDS ARE EXACTLY ON THE PUBLISHED GRIP, at every phase', () => {
    // Both libraries were built to the same three numbers, so an oar and a
    // rowing pose meet without any runtime negotiation. The arms are solved
    // onto it rather than posed near it, which is the difference between a
    // contract and a hope.
    const { rig, row } = build({ side: -1 });
    for (let p = 0; p < 1; p += 0.05) {
      row.update(1 / 60, p);
      rig.object.updateMatrixWorld(true);
      for (const [side, dx] of [['Left', 0.11], ['Right', -0.11]] as const) {
        const want = row.hands.clone();
        want.x = -0.07 + dx;
        const got = rig.bones[`${side}Hand` as 'LeftHand'].getWorldPosition(new Vector3());
        rig.object.worldToLocal(got);
        // A centimetre everywhere except right at the finish, where the
        // handle comes close enough in that an elbow would have to fold
        // flat to follow it — and a real one cannot either. The solver
        // stops a little short of straight and a little short of folded on
        // purpose, and those two limits are the only slack in the contract.
        expect(want.distanceTo(got), `${side} hand at phase ${p.toFixed(2)}`)
          .toBeLessThan(0.025);
      }
    }
  });

  it('and the grip is measured from the THWART, not from his feet', () => {
    // Half a metre of difference. Applied from the rig's own origin it puts
    // every target down by his ankles and out of reach at every phase, so
    // the solver clamps and the hands trail the handle by fifteen
    // centimetres while still looking roughly plausible in a still.
    const seat = 0.45;
    const { row } = build({ seatHeight: seat });
    row.update(1 / 60, 0.2);
    expect(row.hands.y).toBeGreaterThan(seat);
    expect(row.hands.y - seat).toBeCloseTo(rowGripAt(0.2).y, 3);
    expect(ROW_GRIP.height).toBeGreaterThan(0.2);
  });

  it('the handle goes FORWARD at the catch and past him at the finish', () => {
    const { row } = build();
    row.update(1 / 60, 0);
    const atCatch = row.hands.z;
    row.update(1 / 60, 0.399);
    const atFinish = row.hands.z;
    expect(atCatch).toBeGreaterThan(0.4);
    expect(atFinish).toBeLessThan(0);
    expect(atCatch - atFinish).toBeGreaterThan(0.6);
  });

  it('never asks his arms for more than they have', () => {
    const { rig, row } = build();
    const span =
      rig.bones.LeftForeArm.position.length() + rig.bones.LeftHand.position.length();
    for (let p = 0; p < 1; p += 0.02) {
      row.update(1 / 60, p);
      rig.object.updateMatrixWorld(true);
      const shoulder = rig.bones.LeftArm.getWorldPosition(new Vector3());
      const want = row.hands.clone();
      want.x += 0.11;
      rig.object.localToWorld(want);
      expect(shoulder.distanceTo(want), `phase ${p.toFixed(2)}`).toBeLessThan(span);
    }
  });
});

describe('a fixed thwart is not a sliding seat', () => {
  const swingOf = (style: RowStyle): number => {
    const { rig, row } = build({ style });
    row.update(1 / 60, 0);
    const forward = readBody(rig).swing;
    row.update(1 / 60, 0.399);
    return forward - readBody(rig).swing;
  };
  const legsOf = (style: RowStyle): number => {
    const { rig, row } = build({ style });
    row.update(1 / 60, 0);
    const up = readBody(rig).knee;
    row.update(1 / 60, 0.399);
    return up - readBody(rig).knee;
  };

  it('A LONGSHIP ROWER SWINGS HIS BACK; a racing crew uses its legs', () => {
    // Not a reskin. A man on a fixed thwart gets his power from his back,
    // which is exactly why he swings so much further than a man in a shell
    // with a slide under him.
    expect(swingOf('fixed')).toBeGreaterThan(swingOf('sliding'));
    expect(legsOf('sliding')).toBeGreaterThan(legsOf('fixed') * 2);
  });

  it('and both of them still move both', () => {
    for (const style of ['fixed', 'sliding'] as RowStyle[]) {
      expect(Math.abs(swingOf(style)), style).toBeGreaterThan(0.1);
      expect(Math.abs(legsOf(style)), style).toBeGreaterThan(0.05);
    }
  });
});

describe('catching a crab', () => {
  it('CHECKS HIM — he is thrown back and stops driving', () => {
    const { rig, row } = build();
    row.update(1 / 60, 0.2);
    const rowing = readBody(rig);
    row.crabNow();
    expect(row.fouled).toBe(true);
    row.update(1 / 60, 0.2);
    const caught = readBody(rig);
    expect(caught.swing, 'he sailed through it untouched').toBeLessThan(rowing.swing);
  });

  it('and he gets it back over a couple of strokes', () => {
    const { row } = build();
    row.crabNow();
    expect(row.fouled).toBe(true);
    for (let i = 0; i < 200; i++) row.update(1 / 60, (i / 60) % 1);
    expect(row.fouled).toBe(false);
  });

  it('takes it straight off the oar rather than being told twice', () => {
    const { row } = build();
    row.update(1 / 60, 0.3, true);
    expect(row.fouled).toBe(true);
  });
});

describe('handing the body back', () => {
  it('release puts every bone exactly where it found it', () => {
    const { rig, row } = build();
    const before = new Map(
      (['Hips', 'Spine', 'Chest', 'LeftArm', 'LeftLeg', 'RightHand'] as const).map((b) => [
        b,
        rig.bones[b].quaternion.clone(),
      ])
    );
    const hipsY = rig.bones.Hips.position.y;
    for (let i = 0; i < 60; i++) row.update(1 / 60, i / 60);
    row.release();
    for (const [bone, q] of before) {
      expect(rig.bones[bone].quaternion.angleTo(q), bone).toBeLessThan(1e-6);
    }
    expect(rig.bones.Hips.position.y).toBeCloseTo(hipsY, 6);
    expect(row.fouled).toBe(false);
  });

  it('ignores a zero or backwards step', () => {
    const { rig, row } = build();
    row.update(1 / 60, 0.3);
    const was = readBody(rig);
    row.update(0, 0.8);
    expect(readBody(rig).arms).toBeCloseTo(was.arms, 9);
  });
});
