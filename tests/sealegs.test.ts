import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createHumanoid, Locomotion, SeaLegs, type Deck } from '../src';

/**
 * A deck stand-in with exactly SCENA's `DeckField` shape — structural, so
 * if this drives the controller the real one does, and neither library
 * learns about the other.
 */
function fakeDeck(options: {
  /** How fast it travels along +z. */
  speed?: number;
  /** Steady roll, radians. */
  roll?: number;
  motion?: number;
  /** Half-width of the walkable area, in x and z, around its own centre. */
  half?: number;
} = {}): Deck & { advance(dt: number): void; z: number } {
  const speed = options.speed ?? 0;
  const roll = options.roll ?? 0;
  const half = options.half ?? 6;
  let z = 0;
  let moved = 0;
  const api = {
    z: 0,
    motion: options.motion ?? 0,
    advance(dt: number) {
      moved = speed * dt;
      z += moved;
      api.z = z;
    },
    deckAt(x: number, zz: number) {
      if (Math.abs(x) > half || Math.abs(zz - z) > half) return null;
      return 2;
    },
    normalAt() {
      return new Vector3(Math.sin(roll), Math.cos(roll), 0).normalize();
    },
    ride(p: Vector3) {
      p.z += moved;
      return p;
    },
  };
  return api;
}

const build = (o: ConstructorParameters<typeof SeaLegs>[2] = {}) => {
  const rig = createHumanoid({ seed: 5, height: 1.75 });
  const loco = new Locomotion(rig);
  return { rig, loco, legs: new SeaLegs(rig, loco, o) };
};

const run = (
  legs: SeaLegs,
  loco: Locomotion,
  deck: ReturnType<typeof fakeDeck> | null,
  seconds: number
): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    deck?.advance(1 / 60);
    loco.update(1 / 60, 0);
    legs.update(1 / 60, deck);
  }
};

describe('SeaLegs — 1. get carried', () => {
  it('A CHARACTER STANDING STILL TRAVELS WITH THE SHIP', () => {
    // The part that is not animation at all. Skip it and no amount of
    // leaning helps: he walks out through the stern.
    const { rig, loco, legs } = build();
    const deck = fakeDeck({ speed: 6 });
    rig.object.position.set(0, 0, 0);
    run(legs, loco, deck, 5);
    expect(rig.object.position.z).toBeGreaterThan(28);
    expect(rig.object.position.z).toBeLessThan(32);
    expect(legs.aboard).toBe(true);
  });

  it('and is planted ON the deck, not at world zero', () => {
    const { rig, loco, legs } = build();
    run(legs, loco, fakeDeck({ speed: 3 }), 2);
    expect(rig.object.position.y).toBeCloseTo(2, 3);
  });

  it('knows when it has walked off the edge', () => {
    const { rig, loco, legs } = build();
    const deck = fakeDeck({ half: 3 });
    run(legs, loco, deck, 1);
    expect(legs.aboard).toBe(true);
    rig.object.position.x = 12;
    run(legs, loco, deck, 0.5);
    expect(legs.aboard).toBe(false);
  });

  it('and copes with no deck at all', () => {
    const { rig, loco, legs } = build();
    rig.object.position.set(0, 0, 0);
    run(legs, loco, null, 2);
    expect(legs.aboard).toBe(false);
    expect(rig.object.position.z).toBe(0);
  });
});

describe('SeaLegs — 2. stand up, not square', () => {
  /** How far the body is tilted off world vertical, radians. */
  const tilt = (rig: ReturnType<typeof createHumanoid>): number => {
    rig.object.updateWorldMatrix(true, true);
    const up = new Vector3(0, 1, 0).applyQuaternion(rig.object.quaternion);
    return up.angleTo(new Vector3(0, 1, 0));
  };

  it('LEANS WITH THE DECK, BUT NOWHERE NEAR ALL THE WAY', () => {
    // A body welded square to the deck is cargo. A body ignoring it has its
    // feet through the planking. A person is neither.
    const heel = 0.35;
    const { rig, loco, legs } = build({ lean: 0.25 });
    run(legs, loco, fakeDeck({ roll: heel }), 2);
    const angle = tilt(rig);
    expect(angle, 'bolt upright on a heeling deck').toBeGreaterThan(heel * 0.08);
    expect(angle, 'tipped over like cargo').toBeLessThan(heel * 0.65);
  });

  it('and `lean` actually controls how much', () => {
    const heel = 0.4;
    const stiff = build({ lean: 0.05 });
    const floppy = build({ lean: 0.9 });
    run(stiff.legs, stiff.loco, fakeDeck({ roll: heel }), 2);
    run(floppy.legs, floppy.loco, fakeDeck({ roll: heel }), 2);
    expect(tilt(floppy.rig)).toBeGreaterThan(tilt(stiff.rig) * 2);
  });

  it('stands up straight again on a level deck', () => {
    const { rig, loco, legs } = build();
    run(legs, loco, fakeDeck({ roll: 0.4 }), 2);
    const heeled = tilt(rig);
    const level = build();
    run(level.legs, level.loco, fakeDeck({ roll: 0 }), 2);
    expect(tilt(level.rig)).toBeLessThan(heeled);
    expect(tilt(level.rig)).toBeLessThan(0.05);
  });

  it('never stands perfectly still, even on a calm deck', () => {
    // Nobody does, and the absence of it is the tell.
    const { rig, loco, legs } = build();
    const deck = fakeDeck({ roll: 0 });
    const seen: number[] = [];
    for (let i = 0; i < 240; i++) {
      deck.advance(1 / 60);
      loco.update(1 / 60, 0);
      legs.update(1 / 60, deck);
      seen.push(tilt(rig));
    }
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(0.001);
  });
});

describe('SeaLegs — 3. lose it sometimes', () => {
  it('staggers in a seaway and does not in a calm', () => {
    const rough = build({ footing: 0.3 });
    let staggered = 0;
    const deck = fakeDeck({ motion: 0.9, roll: 0.1 });
    for (let i = 0; i < 60 * 30; i++) {
      deck.advance(1 / 60);
      rough.loco.update(1 / 60, 0);
      rough.legs.update(1 / 60, deck);
      if (rough.legs.staggering) staggered += 1;
    }
    expect(staggered, 'nobody ever lost their footing in a gale').toBeGreaterThan(30);

    const calm = build({ footing: 0.3 });
    let calmStagger = 0;
    const flat = fakeDeck({ motion: 0 });
    for (let i = 0; i < 60 * 30; i++) {
      flat.advance(1 / 60);
      calm.loco.update(1 / 60, 0);
      calm.legs.update(1 / 60, flat);
      if (calm.legs.staggering) calmStagger += 1;
    }
    expect(calmStagger, 'staggered about on a mill pond').toBe(0);
  });

  it('a lurch decays rather than sticking', () => {
    const { legs, loco } = build();
    const deck = fakeDeck({ motion: 0 });
    legs.lurchNow(1);
    run(legs, loco, deck, 0.2);
    expect(legs.staggering).toBe(true);
    run(legs, loco, deck, 3);
    expect(legs.staggering).toBe(false);
  });

  it('`effort` tracks the vessel, and eases rather than snapping', () => {
    const { legs, loco } = build();
    expect(legs.effort).toBe(0);
    const lively = fakeDeck({ motion: 0.8 });
    run(legs, loco, lively, 0.1);
    const early = legs.effort;
    expect(early).toBeGreaterThan(0);
    expect(early, 'it snapped straight to the target').toBeLessThan(0.6);
    run(legs, loco, lively, 4);
    expect(legs.effort).toBeGreaterThan(0.7);
  });

  it('two sailors do not lurch in unison', () => {
    // Same deck, different seeds — a crew that staggers as one is a chorus
    // line.
    const a = build({ footing: 0.2, seed: 1 });
    const b = build({ footing: 0.2, seed: 9 });
    const deck = fakeDeck({ motion: 0.95 });
    const log: string[] = [];
    for (let i = 0; i < 60 * 20; i++) {
      deck.advance(1 / 60);
      for (const s of [a, b]) {
        s.loco.update(1 / 60, 0);
        s.legs.update(1 / 60, deck);
      }
      log.push(`${a.legs.staggering ? 1 : 0}${b.legs.staggering ? 1 : 0}`);
    }
    expect(log).toContain('10');
    expect(log).toContain('01');
  });

  it('hands the body back on release', () => {
    const { rig, legs, loco } = build();
    legs.lurchNow(1);
    run(legs, loco, fakeDeck({ motion: 0 }), 0.1);
    legs.release();
    expect(legs.staggering).toBe(false);
    expect(rig.bones.Chest.quaternion.lengthSq()).toBeCloseTo(1, 4);
  });
});
