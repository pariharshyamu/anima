import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import type { BoneName } from '../src/humanoid';
import { createHumanoid } from '../src/humanoid';
import {
  Parkour,
  chooseMove,
  createMove,
  gapAt,
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
];

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

  it('a step and a mantle finish standing on top', () => {
    const rig = createHumanoid({ seed: 5 });
    for (const [name, height] of [['step', 0.35], ['mantle', 1.25]] as const) {
      const move = createMove(rig, name, { height, depth: 0.8 });
      // The root ends at the top surface, which is y = 0 in the edge frame.
      expect(Math.abs(move.end.y), name).toBeLessThan(0.12);
      expect(move.end.z, name).toBeGreaterThan(0);
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
});
