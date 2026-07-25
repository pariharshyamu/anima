import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { createHumanoid, Locomotion, Swimming, type Stroke, type SwimState, type WaterBody } from '../src';

/** A rectangular pool 12 m long, 0.6 m at one end and 2.6 m at the other. */
function pool(overrides: Partial<WaterBody> = {}): WaterBody & { splashes: number } {
  const body = {
    surfaceY: 0,
    splashes: 0,
    depthAt(x: number, z: number) {
      if (Math.abs(x) > 6 || Math.abs(z) > 3) return 0;
      return 0.6 + (2.0 * (x + 6)) / 12;
    },
    disturb() {
      body.splashes += 1;
    },
    ...overrides,
  };
  return body;
}

/**
 * A big uniform pool, for anything that measures the stroke itself.
 *
 * The sloped pool above is 12 m long and a crawl covers 1.35 m/s, so a
 * mechanics test that runs for five seconds swims straight out of it, hits
 * `dry`, and measures a body that has stopped moving. Six assertions failed
 * that way and not one of them was about the thing it was testing.
 */
function open_(): WaterBody & { splashes: number } {
  const body = {
    surfaceY: 0,
    splashes: 0,
    depthAt: () => 2.5,
    disturb() {
      body.splashes += 1;
    },
  };
  return body;
}

function setup(options: ConstructorParameters<typeof Swimming>[2] = {}, height = 1.75) {
  const rig = createHumanoid({ seed: 6, height });
  const loco = new Locomotion(rig);
  return { rig, loco, swim: new Swimming(rig, loco, options) };
}

function run(loco: Locomotion, swim: Swimming, water: WaterBody, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    loco.update(1 / 60, 0);
    swim.update(1 / 60, water);
  }
}

const world = (o: Object3D): Vector3 => {
  o.updateWorldMatrix(true, false);
  return o.getWorldPosition(new Vector3());
};

const STROKES: Stroke[] = ['crawl', 'breast', 'back', 'tread'];

describe('Swimming', () => {
  it('does nothing on dry land', () => {
    const { rig, loco, swim } = setup();
    rig.object.position.set(40, 0, 0); // well outside it
    run(loco, swim, pool(), 1);
    expect(swim.state).toBe('dry');
  });

  it('wades in the shallow end and swims in the deep end', () => {
    // The whole point of the depth handshake. Same pool, same body, and the
    // decision changes because the floor slopes.
    const { rig, loco, swim } = setup();
    const water = pool();

    rig.object.position.set(-5.5, 0, 0); // ~0.68 m
    swim.steer(0, 0);
    run(loco, swim, water, 0.5);
    expect(swim.state).toBe('wading');

    rig.object.position.set(5.5, 0, 0); // ~2.5 m
    run(loco, swim, water, 0.5);
    expect(swim.state).toBe('swimming');
  });

  it('the same water is out of one body\'s depth and not another\'s', () => {
    // Height is not decoration here: it is the input to the decision.
    const water = pool();
    const spot = -1.5; // 1.35 m of water
    const tall = setup({}, 2.1);
    tall.rig.object.position.set(spot, 0, 0);
    run(tall.loco, tall.swim, water, 0.4);
    expect(tall.swim.state).toBe('wading');

    const small = setup({}, 1.5);
    small.rig.object.position.set(spot, 0, 0);
    run(small.loco, small.swim, water, 0.4);
    expect(small.swim.state).toBe('swimming');
  });

  it('a wader stands ON THE BOTTOM, so they get lower as it deepens', () => {
    const { rig, loco, swim } = setup();
    const water = pool();
    rig.object.position.set(-5.8, 0, 0);
    swim.steer(0, 0);
    run(loco, swim, water, 0.5);
    const shallow = rig.object.position.y;
    expect(shallow).toBeCloseTo(-water.depthAt(-5.8, 0), 2);

    rig.object.position.set(-4, 0, 0);
    run(loco, swim, water, 0.5);
    expect(rig.object.position.y).toBeLessThan(shallow);
  });

  it('a swimmer floats at the surface whatever is underneath them', () => {
    const { rig, loco, swim } = setup();
    const water = pool();
    rig.object.position.set(2, 0, 0);
    run(loco, swim, water, 1.5);
    expect(rig.object.position.y).toBeGreaterThan(-0.3);
    expect(rig.object.position.y).toBeLessThan(0.05);

    // And still at the surface over much deeper water.
    rig.object.position.set(5.8, 0, 0);
    run(loco, swim, water, 1);
    expect(rig.object.position.y).toBeGreaterThan(-0.3);
  });

  it('goes HORIZONTAL to swim and stays upright to wade or tread', () => {
    // The one thing that makes this a mode rather than an arm overlay.
    const up = new Vector3(0, 1, 0);
    const bodyUp = (rig: ReturnType<typeof createHumanoid>): Vector3 => {
      rig.object.updateWorldMatrix(true, false);
      return new Vector3(0, 1, 0).applyQuaternion(rig.object.quaternion);
    };

    const a = setup({ stroke: 'crawl' });
    a.rig.object.position.set(4, 0, 0);
    run(a.loco, a.swim, pool(), 2);
    expect(Math.abs(bodyUp(a.rig).dot(up))).toBeLessThan(0.25); // lying flat

    const b = setup({ stroke: 'tread' });
    b.rig.object.position.set(4, 0, 0);
    run(b.loco, b.swim, pool(), 2);
    expect(bodyUp(b.rig).dot(up)).toBeGreaterThan(0.9); // still upright

    const c = setup({ stroke: 'crawl' });
    c.rig.object.position.set(-5.8, 0, 0);
    c.swim.steer(0, 0);
    run(c.loco, c.swim, pool(), 2);
    expect(bodyUp(c.rig).dot(up)).toBeGreaterThan(0.9);
  });

  it('going flat is EASED, not switched', () => {
    // A body that snaps from vertical to horizontal in one frame reads as a
    // glitch however good the stroke is.
    const { rig, loco, swim } = setup({ stroke: 'crawl' });
    const water = pool();
    rig.object.position.set(4, 0, 0);
    const pitches: number[] = [];
    for (let i = 0; i < 30; i++) {
      loco.update(1 / 60, 0);
      swim.update(1 / 60, water);
      rig.object.updateWorldMatrix(true, false);
      pitches.push(new Vector3(0, 1, 0).applyQuaternion(rig.object.quaternion).y);
    }
    // No single frame does more than a fraction of the whole rotation.
    const biggest = Math.max(...pitches.slice(1).map((p, i) => Math.abs(p - pitches[i])));
    expect(biggest).toBeLessThan(0.2);
    // And it does get there.
    expect(pitches[pitches.length - 1]).toBeLessThan(0.5);
  });

  it('a front crawler is FACE DOWN and a backstroker is face up', () => {
    const facing = (rig: ReturnType<typeof createHumanoid>): number => {
      rig.object.updateWorldMatrix(true, false);
      return new Vector3(0, 0, 1).applyQuaternion(rig.object.quaternion).y;
    };
    const front = setup({ stroke: 'crawl' });
    front.rig.object.position.set(4, 0, 0);
    run(front.loco, front.swim, pool(), 2);
    expect(facing(front.rig)).toBeLessThan(-0.5);

    const back = setup({ stroke: 'back' });
    back.rig.object.position.set(4, 0, 0);
    run(back.loco, back.swim, pool(), 2);
    expect(facing(back.rig)).toBeGreaterThan(0.5);
  });

  it('the body ROLLS through a crawl, and does not through a breaststroke', () => {
    // A swimmer whose shoulders stay level looks like they are being towed.
    const rollRange = (stroke: Stroke): number => {
      const { rig, loco, swim } = setup({ stroke });
      const water = open_();
      run(loco, swim, water, 2); // settle
      const seen: number[] = [];
      for (let i = 0; i < 180; i++) {
        loco.update(1 / 60, 0);
        swim.update(1 / 60, water);
        rig.object.updateWorldMatrix(true, false);
        // Sideways lean of the body's own left-right axis.
        seen.push(new Vector3(1, 0, 0).applyQuaternion(rig.object.quaternion).y);
      }
      return Math.max(...seen) - Math.min(...seen);
    };
    expect(rollRange('crawl')).toBeGreaterThan(0.7);
    expect(rollRange('breast')).toBeLessThan(0.15);
  });

  it('the recovering hand comes OUT of the water and the pulling one goes deep', () => {
    // The single most checkable fact about a front crawl, and the one that
    // caught the real bug here: the body roll was inverted, so it drove the
    // recovering shoulder DOWN. At 0.62 rad that is 28 cm of shoulder travel
    // — it swamped the arm's own lift, and the hand that should have been
    // swinging over the water was 43 cm below it, deeper than during its own
    // pull. Every numeric test in this file passed while that was true.
    const { rig, loco, swim } = setup({ stroke: 'crawl' });
    const water = open_();
    swim.steer(Math.PI / 2, 1);
    run(loco, swim, water, 4);
    const ys: Record<'Left' | 'Right', number[]> = { Left: [], Right: [] };
    for (let i = 0; i < 120; i++) {
      loco.update(1 / 60, 0);
      swim.update(1 / 60, water);
      rig.object.updateWorldMatrix(true, true);
      for (const side of ['Left', 'Right'] as const) {
        ys[side].push(rig.bones[`${side}Hand`].getWorldPosition(new Vector3()).y);
      }
    }
    for (const side of ['Left', 'Right'] as const) {
      expect(Math.max(...ys[side]), `${side} never clears the water`)
        .toBeGreaterThan(water.surfaceY);
      expect(Math.min(...ys[side]), `${side} never pulls under`)
        .toBeLessThan(water.surfaceY - 0.25);
    }
    // And the two arms are not out of the water at the same time.
    const overL = ys.Left.map((y) => (y > water.surfaceY ? 1 : 0));
    const overR = ys.Right.map((y) => (y > water.surfaceY ? 1 : 0));
    expect(overL.filter((v, i) => v === 1 && overR[i] === 1).length).toBeLessThan(
      overL.filter((v) => v === 1).length * 0.35
    );
  });

  it('a swimmer keeps their head at the surface', () => {
    // Not underneath it, and not held up out of it like a nervous dog.
    for (const stroke of ['crawl', 'breast', 'back'] as Stroke[]) {
      const { rig, loco, swim } = setup({ stroke });
      const water = open_();
      run(loco, swim, water, 4);
      const ys: number[] = [];
      for (let i = 0; i < 120; i++) {
        loco.update(1 / 60, 0);
        swim.update(1 / 60, water);
        rig.object.updateWorldMatrix(true, true);
        ys.push(rig.bones.Head.getWorldPosition(new Vector3()).y);
      }
      const mean = ys.reduce((a, x) => a + x, 0) / ys.length;
      expect(mean, `${stroke} head`).toBeGreaterThan(water.surfaceY - 0.3);
      expect(mean, `${stroke} head`).toBeLessThan(water.surfaceY + 0.25);
    }
  });

  it('stroke rate is derived from speed — no skating', () => {
    // Decouple them and the arms turn over at a rate that has nothing to do
    // with how fast the body is going.
    // Long enough that counting whole cycles is not the dominant error.
    const perCycle = (throttle: number): number => {
      const { rig, loco, swim } = setup({ stroke: 'crawl' });
      const water = open_();
      swim.steer(0, throttle);
      run(loco, swim, water, 1);
      const from = rig.object.position.clone();
      const before = swim.cycles;
      run(loco, swim, water, 40);
      return rig.object.position.distanceTo(from) / (swim.cycles - before);
    };
    const full = perCycle(1);
    // A crawl covers about 1.9 m per cycle whatever the pace.
    expect(full).toBeGreaterThan(1.7);
    expect(full).toBeLessThan(2.1);
    // Half throttle: half the ground AND half the strokes, so the distance
    // per cycle is unchanged. That invariance IS the no-skating property.
    const half = perCycle(0.5);
    expect(half).toBeGreaterThan(1.7);
    expect(half).toBeLessThan(2.1);
  });

  it('treading water goes NOWHERE, which is the point of it', () => {
    const { rig, loco, swim } = setup({ stroke: 'tread' });
    const water = open_();
    swim.steer(1.2, 1);
    run(loco, swim, water, 0.5);
    const from = rig.object.position.clone();
    run(loco, swim, water, 4);
    expect(rig.object.position.distanceTo(from)).toBeLessThan(0.02);
    expect(swim.state).toBe('treading');
  });

  it('swims in the direction it is steered', () => {
    for (const heading of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const { rig, loco, swim } = setup();
      const water = pool();
      rig.object.position.set(0, 0, 0);
      swim.steer(heading, 1);
      run(loco, swim, water, 1);
      const from = rig.object.position.clone();
      run(loco, swim, water, 1);
      const moved = rig.object.position.clone().sub(from).setY(0).normalize();
      const want = new Vector3(Math.sin(heading), 0, Math.cos(heading));
      expect(moved.dot(want)).toBeGreaterThan(0.99);
    }
  });

  it('splashes once per stroke, not once per frame', () => {
    const { loco, swim } = setup();
    const water = open_();
    swim.steer(0, 1);
    run(loco, swim, water, 6);
    expect(water.splashes).toBeGreaterThan(1);
    expect(water.splashes).toBeLessThan(12);
    expect(water.splashes).toBe(swim.cycles);
  });

  it('a WaterBody with no disturb still works', () => {
    // The ripple hook is optional; a plain depth field is a legal pool.
    const bare: WaterBody = { surfaceY: 0, depthAt: () => 2 };
    const { rig, loco, swim } = setup();
    rig.object.position.set(0, 0, 0);
    expect(() => run(loco, swim, bare, 2)).not.toThrow();
    expect(swim.state).toBe('swimming');
  });

  it.each(STROKES)('%s moves the limbs, and the two sides are not in lockstep', (stroke) => {
    const { rig, loco, swim } = setup({ stroke });
    const water = open_();
    run(loco, swim, water, 2);
    const leftV: Vector3[] = [];
    const rightV: Vector3[] = [];
    for (let i = 0; i < 150; i++) {
      loco.update(1 / 60, 0);
      swim.update(1 / 60, water);
      rig.object.updateWorldMatrix(true, true);
      // In the BODY's own frame, so the root's travel and roll do not leak
      // into the measurement.
      const inv = rig.object.quaternion.clone().invert();
      leftV.push(rig.bones.LeftHand.getWorldPosition(new Vector3())
        .sub(world(rig.object)).applyQuaternion(inv));
      rightV.push(rig.bones.RightHand.getWorldPosition(new Vector3())
        .sub(world(rig.object)).applyQuaternion(inv));
    }
    // The busiest axis, not a chosen one: a sculling tread moves the hands
    // sideways and hardly at all along the body, so measuring y alone reports
    // a treading swimmer as motionless.
    const axes = ['x', 'y', 'z'] as const;
    const range = (v: number[]): number => Math.max(...v) - Math.min(...v);
    const busiest = axes
      .map((a) => ({ a, r: range(leftV.map((v) => v[a])) }))
      .sort((p, q) => q.r - p.r)[0].a;
    expect(range(leftV.map((v) => v[busiest]))).toBeGreaterThan(0.15);
    // Correlate ALONG THE BODY, not on the busiest axis. A symmetric stroke
    // sweeps the hands outward in mirror image, so on a lateral axis the two
    // sides read as perfectly ANTI-correlated — which looks exactly like an
    // alternating stroke to a correlation and is the opposite of the truth.
    const left = leftV.map((v) => v.y);
    const right = rightV.map((v) => v.y);

    const mean = (v: number[]): number => v.reduce((a, x) => a + x, 0) / v.length;
    const ml = mean(left);
    const mr = mean(right);
    const cov = mean(left.map((d, i) => (d - ml) * (right[i] - mr)));
    const sd = (v: number[], m: number): number => Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
    const r = cov / (sd(left, ml) * sd(right, mr) || 1);
    // Breaststroke IS symmetric; the alternating strokes must not be.
    if (stroke === 'breast') expect(r).toBeGreaterThan(0.9);
    else if (stroke !== 'tread') expect(r).toBeLessThan(0.3);
  });

  it('reports each state change once, and gives the body back on stop', () => {
    const { rig, loco, swim } = setup();
    const water = pool();
    const seen: SwimState[] = [];
    swim.onState((s) => seen.push(s));
    rig.object.position.set(-5.8, 0, 0);
    swim.steer(0, 0);
    run(loco, swim, water, 0.5);
    rig.object.position.set(5, 0, 0);
    run(loco, swim, water, 0.5);
    expect(seen).toEqual(['wading', 'swimming']);

    swim.stop();
    expect(swim.state).toBe('dry');
    expect(loco.influence).toBe(1);
  });

  it('leaving the water hands the body back on its own', () => {
    const { rig, loco, swim } = setup();
    const water = pool();
    rig.object.position.set(3, 0, 0);
    run(loco, swim, water, 1);
    expect(loco.influence).toBe(0);
    // Out over the side.
    rig.object.position.set(30, 0, 0);
    run(loco, swim, water, 0.5);
    expect(swim.state).toBe('dry');
    expect(loco.influence).toBe(1);
  });
});
