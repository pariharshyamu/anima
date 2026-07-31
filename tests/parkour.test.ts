import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import type { BoneName } from '../src/humanoid';
import { createHumanoid } from '../src/humanoid';
import {
  Parkour,
  canClear,
  chooseMove,
  createMove,
  gapAt,
  landingFor,
  measureParkourContact,
  reachOf,
  type MoveName,
} from '../src/parkour';

const SEEDS = [1, 5, 12, 21, 33];
const CASES: Array<[MoveName, number, number]> = [
  ['step', 0.35, 0.6],
  ['safety-vault', 0.85, 0.3],
  ['speed-vault', 0.85, 0.3],
  ['mantle', 1.25, 0.8],
  ['drop', 1.1, 0.5],
  ['gap-jump', 0, 1.4],
];
/** Hip-to-ankle, recovered from the published knee band. */
const legOf = (reach: { step: number }): number => reach.step / 0.52;

describe('reach', () => {
  it('comes from the body, not from a constant', () => {
    const short = createHumanoid({ seed: 12 });
    const tall = createHumanoid({ seed: 5 });
    expect(tall.height).toBeGreaterThan(short.height);
    expect(reachOf(tall).vault).toBeGreaterThan(reachOf(short).vault);
    expect(reachOf(tall).mantle).toBeGreaterThan(reachOf(short).mantle);
  });

  it('orders the bands the way a body does', () => {
    for (const seed of SEEDS) {
      const r = reachOf(createHumanoid({ seed }));
      expect(r.step).toBeLessThan(r.vault);
      expect(r.vault).toBeLessThan(r.mantle);
      expect(r.mantle).toBeLessThan(r.catch);
    }
  });

  it('a running jump clears more than a standing one', () => {
    const r = reachOf(createHumanoid({ seed: 5 }));
    expect(gapAt(r, 5)).toBeGreaterThan(gapAt(r, 0) * 1.5);
  });
});

describe('choosing a move', () => {
  const reach = reachOf(createHumanoid({ seed: 5 }));

  it('answers null rather than inventing something', () => {
    // The honest answer to a two-metre wall is that this person is not
    // getting over it. A system that always finds a move puts characters
    // through walls.
    expect(chooseMove({ height: 2.0, depth: 0.5 }, reach, { speed: 5 })).toBeNull();
    expect(chooseMove({ height: 0, depth: 0.5 }, reach)).toBeNull();
  });

  it('vaults only what it can span, and mantles the rest', () => {
    expect(chooseMove({ height: 0.85, depth: 0.3 }, reach, { speed: 4 })).toBe('speed-vault');
    // Same height, too deep to swing the legs across.
    expect(chooseMove({ height: 0.85, depth: 1.2 }, reach, { speed: 4 })).toBe('mantle');
  });

  it('needs to be moving to vault at all', () => {
    expect(chooseMove({ height: 0.85, depth: 0.3 }, reach, { speed: 0 })).toBe('mantle');
    expect(chooseMove({ height: 0.85, depth: 0.3 }, reach, { speed: 2 })).toBe('safety-vault');
  });

  it('steps over anything below the knee', () => {
    expect(chooseMove({ height: 0.3, depth: 2 }, reach)).toBe('step');
  });

  it('different bodies choose differently at the same wall', () => {
    // The whole point of deriving reach from the rig. A wall that one body
    // vaults is one the other has to mantle.
    const short = reachOf(createHumanoid({ seed: 12 }));
    const tall = reachOf(createHumanoid({ seed: 5 }));
    const wall = { height: (short.vault + tall.vault) / 2, depth: 0.3 };
    expect(chooseMove(wall, tall, { speed: 4 })).toBe('speed-vault');
    expect(chooseMove(wall, short, { speed: 4 })).toBe('mantle');
  });
});

describe('landing from a fall', () => {
  it('bands the fall by technique, in that order', () => {
    for (const seed of SEEDS) {
      const reach = reachOf(createHumanoid({ seed }));
      const leg = legOf(reach);
      expect(landingFor(leg * 0.4, reach)).toBe('absorb');
      expect(landingFor(leg * 2.0, reach)).toBe('roll');
      expect(landingFor(leg * 4.0, reach)).toBe('hurt');
    }
  });

  it('never reports a taller fall as an easier landing', () => {
    const reach = reachOf(createHumanoid({ seed: 5 }));
    const rank = { absorb: 0, roll: 1, hurt: 2 };
    let last = -1;
    for (let fall = 0.05; fall < 6; fall += 0.05) {
      const here = rank[landingFor(fall, reach)];
      expect(here).toBeGreaterThanOrEqual(last);
      last = here;
    }
  });

  it('a longer-legged body takes more of the drop standing', () => {
    // The thresholds are leg lengths, not constants: there is further to
    // travel absorbing the same fall.
    const short = reachOf(createHumanoid({ seed: 12 }));
    const tall = reachOf(createHumanoid({ seed: 5 }));
    expect(legOf(tall)).toBeGreaterThan(legOf(short));
    // A fall between the two bodies' absorb ceilings.
    const fall = (legOf(short) * 1.15 + legOf(tall) * 1.15) / 2;
    expect(landingFor(fall, short)).toBe('roll');
    expect(landingFor(fall, tall)).toBe('absorb');
  });

  it('says hurt rather than clamping it away', () => {
    // A character who walks off a roof falls whether or not there is a
    // technique for it, and what that costs is the game's business.
    const reach = reachOf(createHumanoid({ seed: 5 }));
    expect(landingFor(40, reach)).toBe('hurt');
  });
});

describe('crossing a gap', () => {
  const reach = reachOf(createHumanoid({ seed: 5 }));

  it('is a question about speed, not about height', () => {
    const wide = gapAt(reach, 0) + 0.4;
    expect(canClear(wide, reach, 0)).toBe(false);
    expect(canClear(wide, reach, 5)).toBe(true);
  });

  it('refuses nothing and refuses too far', () => {
    expect(canClear(0, reach, 5)).toBe(false);
    expect(canClear(-1, reach, 5)).toBe(false);
    expect(canClear(gapAt(reach, 5) + 0.01, reach, 5)).toBe(false);
    expect(canClear(gapAt(reach, 5), reach, 5)).toBe(true);
  });

  it('a bigger body clears more at the same speed', () => {
    const short = reachOf(createHumanoid({ seed: 12 }));
    expect(gapAt(reach, 3)).toBeGreaterThan(gapAt(short, 3));
  });
});

describe('contacts', () => {
  it('hands and feet land where the move says, on every body', () => {
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      for (const [name, height, depth] of CASES) {
        const r = measureParkourContact(rig, name, { height, depth });
        expect(r.contactSlip, `${name} seed ${seed}`).toBeLessThan(0.02);
      }
    }
  });

  it('never reaches through the obstacle', () => {
    // A hand inside the wall is the tell that kills the illusion, and it is
    // invisible from every camera angle that does not graze the surface.
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      for (const [name, height, depth] of CASES) {
        const r = measureParkourContact(rig, name, { height, depth });
        expect(r.penetration, `${name} seed ${seed}`).toBeLessThan(0.02);
      }
    }
  });

  it('never locks a limb straight to reach a contact', () => {
    // A chain at full extension is the solver reporting "I could not reach
    // that" by clamping — silently, and without slipping.
    for (const seed of SEEDS) {
      const rig = createHumanoid({ seed });
      for (const [name, height, depth] of CASES) {
        const r = measureParkourContact(rig, name, { height, depth });
        expect(r.stretch, `${name} seed ${seed}`).toBeLessThan(0.99);
      }
    }
  });

  it('plants every contact the move declares', () => {
    const rig = createHumanoid({ seed: 5 });
    expect(measureParkourContact(rig, 'step', { height: 0.35, depth: 0.6 }).planted).toBe(1);
    expect(measureParkourContact(rig, 'mantle', { height: 1.25, depth: 0.8 }).planted).toBe(3);
  });

  it('holds across the whole band a move is chosen for', () => {
    const rig = createHumanoid({ seed: 5 });
    const reach = reachOf(rig);
    for (const height of [0.5, 0.7, 0.9]) {
      const r = measureParkourContact(rig, 'safety-vault', { height, depth: 0.3 });
      expect(r.contactSlip, `${height} m`).toBeLessThan(0.02);
      expect(r.stretch, `${height} m`).toBeLessThan(0.99);
    }
    void reach;
  });
});

describe('the move', () => {
  it('travels from before the obstacle to past it', () => {
    const rig = createHumanoid({ seed: 5 });
    const vault = createMove(rig, 'safety-vault', { height: 0.85, depth: 0.3 });
    expect(vault.travel(0).z).toBeLessThan(0);
    expect(vault.end.z).toBeGreaterThan(0.3);
  });

  it('every move finishes standing on the surface it is meant to', () => {
    // This test used to cover the step and the mantle and skip the vaults —
    // which is precisely where the bug was. Both vaults ended 410 mm BELOW
    // THE ROAD, because the exit kept the shoulder anchored near the wall
    // top and a standing body's shoulder is a metre and a half up. Nothing
    // else saw it: the contact gate stops looking when the hand lets go.
    const rig = createHumanoid({ seed: 5 });
    // The edge frame's origin is the TOP, so a move that ends ON the
    // obstacle ends at 0 and one that ends BESIDE it ends a height down.
    const cases: Array<[MoveName, number, number, number]> = [
      ['step', 0.35, 0.8, 0],
      ['mantle', 1.25, 0.8, 0],
      ['safety-vault', 0.85, 0.3, -0.85],
      ['speed-vault', 0.85, 0.3, -0.85],
      ['drop', 1.2, 0.5, -1.2],
      ['gap-jump', 0, 1.4, 0],
    ];
    for (const [name, height, depth, rests] of cases) {
      const move = createMove(rig, name, { height, depth });
      expect(Math.abs(move.end.y - rests), name).toBeLessThan(0.12);
      expect(move.end.z, name).toBeGreaterThan(0);
    }
  });

  it('a deeper far side is a longer way down, not a shorter one', () => {
    // `landing` deepens the drop, so it subtracts. Getting that sign wrong
    // puts a vault 1.77 m out and shows up nowhere else.
    const rig = createHumanoid({ seed: 5 });
    for (const name of ['speed-vault', 'safety-vault', 'drop'] as const) {
      const move = createMove(rig, name, { height: 0.9, depth: 0.3, landing: 1.8 });
      expect(Math.abs(move.end.y + 1.8), name).toBeLessThan(0.12);
    }
  });

  it('does not end on its own first frame', () => {
    // A one-shot built as a loop snaps back to its start pose on the final
    // keyframe, which is a vault that rewinds itself in the last 1/30 s.
    const rig = createHumanoid({ seed: 5 });
    const move = createMove(rig, 'speed-vault', { height: 0.85, depth: 0.3 });
    expect(move.travel(1).distanceTo(move.travel(0))).toBeGreaterThan(0.5);
  });

  it('leaves the rig in its rest pose after building', () => {
    const rig = createHumanoid({ seed: 5 });
    const before = Object.entries(rig.bones).map(([k, b]) => [k, b.quaternion.clone()] as const);
    const pos = rig.object.position.clone();
    createMove(rig, 'mantle', { height: 1.25, depth: 0.8 });
    for (const [name, q] of before) {
      expect(rig.bones[name as BoneName].quaternion.angleTo(q), name).toBeLessThan(1e-6);
    }
    expect(rig.object.position.distanceTo(pos)).toBeLessThan(1e-9);
  });

  it('a drop ends on the ground it fell to', () => {
    // The contact numbers cannot see this: a move can hold its feet perfectly
    // on holds that are in the wrong place.
    const rig = createHumanoid({ seed: 5 });
    for (const fall of [0.4, 1.2, 2.4, 3.4]) {
      const move = createMove(rig, 'drop', { height: fall, depth: 0.5 });
      expect(move.end.y + fall, `${fall} m`).toBeLessThan(0.15);
      expect(move.end.y + fall, `${fall} m`).toBeGreaterThan(-0.15);
    }
  });

  it('a drop falls to the LANDING, not to the height', () => {
    // `Obstacle.landing` exists so a wall can be taller on the far side, and
    // the drop is the only move for which that difference is the whole story.
    const rig = createHumanoid({ seed: 5 });
    const even = createMove(rig, 'drop', { height: 1.3, depth: 0.5 });
    const uneven = createMove(rig, 'drop', { height: 1.3, depth: 0.5, landing: 2.6 });
    expect(uneven.end.y).toBeLessThan(even.end.y - 1.1);
    expect(Math.abs(uneven.end.y + 2.6)).toBeLessThan(0.15);
  });

  it('a gap jump ends past the far lip', () => {
    // Landing short is the character in the hole, and nothing else measures it.
    const rig = createHumanoid({ seed: 5 });
    for (const width of [0.4, 1.0, 2.0]) {
      const move = createMove(rig, 'gap-jump', { height: 0, depth: width });
      expect(move.end.z, `${width} m`).toBeGreaterThan(width);
    }
  });

  it('holds its limbs on smoothly rather than snapping them into place', () => {
    // The ease, measured. Nothing else in the report can see it: slip and
    // penetration only look at frames where a limb is already PLANTED, and a
    // limb that teleports onto a hold arrives correct.
    const rig = createHumanoid({ seed: 5 });
    for (const [name, height, depth] of CASES) {
      const r = measureParkourContact(rig, name, { height, depth });
      expect(r.snap, name).toBeLessThan(2.5);
    }
  });

  it('scales to the body it is given', () => {
    const short = createHumanoid({ seed: 12 });
    const tall = createHumanoid({ seed: 5 });
    const a = createMove(short, 'mantle', { height: 1.2, depth: 0.8 });
    const b = createMove(tall, 'mantle', { height: 1.2, depth: 0.8 });
    // Different bodies stand off the wall by different amounts.
    expect(Math.abs(a.travel(0).z - b.travel(0).z)).toBeGreaterThan(0.001);
  });
});

describe('the controller', () => {
  const loco = (): never =>
    ({
      influence: 1,
      overlay: () => ({}),
      stopOverlay: () => undefined,
    }) as never;

  it('refuses what it cannot do, and says so', () => {
    const rig = createHumanoid({ seed: 5 });
    const pk = new Parkour(rig, loco());
    const edge = new Object3D();
    expect(pk.attempt({ edge, height: 2.2, depth: 0.4 }, 5)).toBeNull();
    expect(pk.busy).toBe(false);
  });

  it('owns the body for the length of the move and hands it back', () => {
    const rig = createHumanoid({ seed: 5 });
    const l = loco() as unknown as { influence: number };
    const pk = new Parkour(rig, l as never);
    const edge = new Object3D();
    const started: string[] = [];
    const finished: string[] = [];
    pk.onStart((m: string) => started.push(m));
    pk.onFinish((m: string) => finished.push(m));
    expect(pk.attempt({ edge, height: 0.35, depth: 0.6 }, 1)).toBe('step');
    expect(pk.busy).toBe(true);
    expect(l.influence).toBe(0);
    for (let t = 0; t < 2; t += 1 / 60) pk.update(1 / 60);
    expect(pk.state).toBe('done');
    expect(l.influence).toBe(1);
    expect(started).toEqual(['step']);
    expect(finished).toEqual(['step']);
  });

  it('will not start a second move on top of the first', () => {
    const rig = createHumanoid({ seed: 5 });
    const pk = new Parkour(rig, loco());
    const edge = new Object3D();
    pk.attempt({ edge, height: 0.35, depth: 0.6 }, 1);
    expect(pk.attempt({ edge, height: 0.35, depth: 0.6 }, 1)).toBeNull();
  });

  it('drops off a wall it would never get over', () => {
    // Going up is a choice between techniques; going down is not a choice at
    // all. A wall this body cannot mantle is still one it can step off.
    const rig = createHumanoid({ seed: 5 });
    const pk = new Parkour(rig, loco());
    const edge = new Object3D();
    // Above the mantle band (1.45 m) and inside the roll band (2.12 m).
    const wall = { edge, height: 1.9, depth: 0.5 };
    expect(pk.attempt(wall, 5)).toBeNull();
    expect(pk.descend(wall)).toBe('roll');
    expect(pk.busy).toBe(true);
  });

  it('reports the landing without taking it', () => {
    const rig = createHumanoid({ seed: 5 });
    const pk = new Parkour(rig, loco());
    const leg = legOf(reachOf(rig));
    expect(pk.landing({ height: leg * 0.5 })).toBe('absorb');
    expect(pk.landing({ height: leg * 2 })).toBe('roll');
    expect(pk.landing({ height: leg * 4 })).toBe('hurt');
    // The FAR side, when the two differ.
    expect(pk.landing({ height: 0.3, landing: leg * 2 })).toBe('roll');
    expect(pk.busy).toBe(false);
  });

  it('has nothing to descend when there is no drop', () => {
    const rig = createHumanoid({ seed: 5 });
    const pk = new Parkour(rig, loco());
    expect(pk.descend({ edge: new Object3D(), height: 0, depth: 0.5 })).toBeNull();
    expect(pk.busy).toBe(false);
  });

  it('leaps a gap it can reach and refuses one it cannot', () => {
    const rig = createHumanoid({ seed: 5 });
    const reach = reachOf(rig);
    const pk = new Parkour(rig, loco());
    const edge = new Object3D();
    const wide = gapAt(reach, 0) + 0.5;
    // The same ditch, the same body: crossable at a sprint, not from a stand.
    expect(pk.leap({ edge, width: wide }, 0)).toBeNull();
    expect(pk.busy).toBe(false);
    expect(pk.leap({ edge, width: wide }, 5)).toBe('gap-jump');
    expect(pk.busy).toBe(true);
  });

  it('hands the body back after a drop, like any other move', () => {
    const rig = createHumanoid({ seed: 5 });
    const l = loco() as unknown as { influence: number };
    const pk = new Parkour(rig, l as never);
    const finished: string[] = [];
    pk.onFinish((m: string) => finished.push(m));
    pk.descend({ edge: new Object3D(), height: 1.1, depth: 0.5 });
    expect(l.influence).toBe(0);
    for (let t = 0; t < 2; t += 1 / 60) pk.update(1 / 60);
    expect(pk.state).toBe('done');
    expect(l.influence).toBe(1);
    expect(finished).toEqual(['drop']);
  });
});
