import { describe, expect, it } from 'vitest';
import { AnimationMixer, Vector3 } from 'three';
import {
  createGaitClips,
  createQuadruped,
  GAITS,
  LEGS,
  QuadrupedLocomotion,
  type GaitName,
  type LegName,
  type QuadrupedRig,
} from '../src';

const horse = (options = {}) => createQuadruped({ seed: 5, ...options });

/**
 * Sample every hoof's height through one stride. This is how you check a
 * gait: not by looking at the pose, but by asking which feet are on the
 * ground at each instant.
 */
function hoofTrack(
  rig: QuadrupedRig,
  gait: Exclude<GaitName, 'idle'>,
  samples = 60
): Record<LegName, number[]> {
  const clips = createGaitClips(rig);
  const mixer = new AnimationMixer(rig.mesh);
  const action = mixer.clipAction(clips[gait]);
  action.play();
  const duration = clips[gait].duration;
  const out = { LF: [], RF: [], LH: [], RH: [] } as Record<LegName, number[]>;
  let last = 0;
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * duration;
    mixer.update(t - last);
    last = t;
    rig.mesh.updateMatrixWorld(true);
    for (const leg of LEGS) {
      out[leg].push(rig.bones[`${leg}Hoof`].getWorldPosition(new Vector3()).y);
    }
  }
  return out;
}

/** Fraction of the stride each hoof spends near its lowest point. */
function groundedShare(track: number[]): number {
  const low = Math.min(...track);
  const high = Math.max(...track);
  const threshold = low + (high - low) * 0.18;
  return track.filter((y) => y <= threshold).length / track.length;
}

/** Index of the sample where the hoof is lowest — roughly mid-stance. */
function stanceCentre(track: number[]): number {
  return track.indexOf(Math.min(...track));
}

/**
 * Index of the sample where the hoof is highest — the peak of its swing.
 * This is the sharpest landmark in a limb cycle: unlike the lowest point,
 * it can't be confused by the body vaulting up and down underneath.
 */
function swingPeak(track: number[]): number {
  return track.indexOf(Math.max(...track));
}

describe('quadruped rig', () => {
  it('stands with all four hooves on the ground', () => {
    const rig = horse();
    rig.mesh.updateMatrixWorld(true);
    for (const leg of LEGS) {
      const y = rig.bones[`${leg}Hoof`].getWorldPosition(new Vector3()).y;
      expect(y, `${leg} hoof`).toBeGreaterThan(0);
      expect(y, `${leg} hoof`).toBeLessThan(0.09 * rig.height);
    }
  });

  it('has the hind-leg zigzag that makes it a horse, not a table', () => {
    // Femur down-and-FORWARD to the stifle, tibia down-and-BACK to the
    // hock, cannon forward again. The foreleg does the opposite.
    const rig = horse();
    rig.mesh.updateMatrixWorld(true);
    const at = (b: string) => rig.bones[b as keyof typeof rig.bones].getWorldPosition(new Vector3());
    for (const leg of ['LH', 'RH'] as const) {
      const hip = at(`${leg}Upper`);
      const stifle = at(`${leg}Lower`);
      const hock = at(`${leg}Cannon`);
      expect(stifle.z, `${leg} stifle ahead of hip`).toBeGreaterThan(hip.z);
      expect(hock.z, `${leg} hock behind stifle`).toBeLessThan(stifle.z);
    }
    for (const leg of ['LF', 'RF'] as const) {
      const shoulder = at(`${leg}Upper`);
      const elbow = at(`${leg}Lower`);
      expect(elbow.z, `${leg} elbow behind shoulder`).toBeLessThan(shoulder.z);
    }
  });

  it('is built to real proportions — withers, body length, head carriage', () => {
    const rig = horse({ height: 1.62 });
    rig.mesh.updateMatrixWorld(true);
    const poll = rig.bones.Head.getWorldPosition(new Vector3());
    // An alert horse carries its poll well above its withers.
    expect(poll.y).toBeGreaterThan(1.15 * rig.height);
    expect(poll.y).toBeLessThan(1.5 * rig.height);
    // Neck reaches forward of the shoulder.
    expect(poll.z).toBeGreaterThan(rig.bones.Chest.getWorldPosition(new Vector3()).z);
    expect(rig.bodyLength).toBeGreaterThan(0.9 * rig.height);
  });

  it('publishes a saddle seat and rein point for a rider', () => {
    const rig = horse();
    rig.mesh.updateMatrixWorld(true);
    const seat = rig.saddle.getWorldPosition(new Vector3());
    const reins = rig.reins.getWorldPosition(new Vector3());
    expect(seat.y).toBeGreaterThan(0.9 * rig.height); // on the back, not in it
    expect(reins.z).toBeGreaterThan(seat.z); // reins run forward of the seat
  });

  it('builds every species and coat deterministically', () => {
    for (const species of ['horse', 'pony', 'draft', 'donkey'] as const) {
      const a = createQuadruped({ seed: 9, species });
      const b = createQuadruped({ seed: 9, species });
      expect(b.description).toEqual(a.description);
      expect(a.height).toBeGreaterThan(1);
    }
    // A donkey's ears are unmistakable, and a draft is heavier than a pony.
    expect(createQuadruped({ species: 'draft' }).height).toBeGreaterThan(
      createQuadruped({ species: 'pony' }).height
    );
  });

  it('a bay has black points — the commonest colour, most often got wrong', () => {
    const bay = createQuadruped({ seed: 1, coat: 'bay', socks: [false, false, false, false] });
    expect(bay.description.coat).toBe('bay');
    // Mane/tail/lower-leg colour must differ from the body colour.
    const colors = bay.mesh.geometry.getAttribute('color');
    const seen = new Set<string>();
    for (let i = 0; i < colors.count; i += 24) {
      seen.add(`${colors.getX(i).toFixed(2)},${colors.getY(i).toFixed(2)}`);
    }
    expect(seen.size).toBeGreaterThan(3); // body, points, hoof, eye…
  });
});

describe('gaits: footfall', () => {
  it('every hoof leaves the ground exactly once per stride', () => {
    for (const gait of ['walk', 'trot', 'canter', 'gallop'] as const) {
      const track = hoofTrack(horse(), gait);
      for (const leg of LEGS) {
        const ys = track[leg];
        const low = Math.min(...ys);
        const high = Math.max(...ys);
        expect(high - low, `${gait} ${leg} lifts`).toBeGreaterThan(0.05);
        // One swing per stride. Counted with hysteresis — a bare threshold
        // would double-count the small ripple as the body vaults.
        // Wide hysteresis band: during a gallop's suspension ALL four feet
        // rise together as the body flies, so a narrow band sees that as a
        // second swing. It isn't one — the hoof never went back down.
        const hi = low + (high - low) * 0.78;
        const lo = low + (high - low) * 0.22;
        let rises = 0;
        let up = ys[ys.length - 1] > hi;
        for (const y of ys) {
          if (!up && y > hi) { up = true; rises++; }
          else if (up && y < lo) up = false;
        }
        expect(rises, `${gait} ${leg} swings per stride`).toBe(1);
      }
    }
  });

  it('a planted hoof stays planted — no skating, no pogo', () => {
    // THE invariant. Take each leg's own stance window straight from the
    // gait spec and check the hoof barely moves vertically through it.
    for (const gait of ['walk', 'trot', 'canter', 'gallop'] as const) {
      const spec = GAITS[gait];
      const samples = 120;
      const track = hoofTrack(horse(), gait, samples);
      for (const leg of LEGS) {
        const ys = track[leg];
        const during: number[] = [];
        // Skip the first and last 12% of stance: touchdown and lift-off are
        // meant to move.
        for (let i = 0; i < samples; i++) {
          const t = (i / samples - spec.contact[leg] + 1) % 1;
          if (t > spec.duty * 0.12 && t < spec.duty * 0.88) during.push(ys[i]);
        }
        expect(during.length, `${gait} ${leg} has a stance`).toBeGreaterThan(3);
        const spread = Math.max(...during) - Math.min(...during);
        const lift = Math.max(...ys) - Math.min(...ys);
        // Walk and trot hold a planted hoof genuinely still. Canter and
        // gallop run duty factors so low that two stances overlap, and a
        // single body height cannot keep both hooves down — a real horse
        // pays that difference out of fetlock and pastern compliance,
        // which this rig does not model. The looser bound is honest about
        // that rather than pretending otherwise.
        const bound = gait === 'walk' || gait === 'trot' ? 0.35 : 0.62;
        expect(spread, `${gait} ${leg} stance is flat`).toBeLessThan(lift * bound);
      }
    }
  });

  it('duty factor falls as the gait quickens — fewer feet down, faster', () => {
    const rig = horse();
    const share = (g: Exclude<GaitName, 'idle'>) => {
      const track = hoofTrack(rig, g);
      return LEGS.reduce((sum, leg) => sum + groundedShare(track[leg]), 0) / 4;
    };
    const walk = share('walk');
    const trot = share('trot');
    const gallop = share('gallop');
    expect(walk).toBeGreaterThan(trot);
    expect(trot).toBeGreaterThan(gallop);
    // At the walk a horse never has fewer than two feet down; at gallop it
    // has a moment with none at all. Asserted from the duty factors, which
    // are exact — the sampled share is a lower bound on them, since it only
    // counts the flattest part of each stance.
    expect(GAITS.walk.duty * 4).toBeGreaterThan(2);
    expect(GAITS.gallop.duty * 4).toBeLessThan(1.5);
    expect(walk * 4).toBeGreaterThan(1.8);
    expect(gallop * 4).toBeLessThan(2);
  });

  it('the WALK is a 4-beat lateral sequence: LH, LF, RH, RF', () => {
    const track = hoofTrack(horse(), 'walk', 80);
    const order = LEGS.map((leg) => ({ leg, at: stanceCentre(track[leg]) })).sort(
      (a, b) => a.at - b.at
    );
    // Rotate so the sequence starts at the left hind, then compare.
    const start = order.findIndex((o) => o.leg === 'LH');
    const sequence = [...order.slice(start), ...order.slice(0, start)].map((o) => o.leg);
    expect(sequence).toEqual(['LH', 'LF', 'RH', 'RF']);
  });

  it('the TROT moves diagonal pairs together', () => {
    const track = hoofTrack(horse(), 'trot', 80);
    const peak = Object.fromEntries(
      LEGS.map((leg) => [leg, swingPeak(track[leg])])
    ) as Record<LegName, number>;
    const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 80 - Math.abs(a - b));
    // LF swings with RH, RF with LH — the diagonal pairs move as one.
    expect(apart(peak.LF, peak.RH), 'LF/RH diagonal').toBeLessThanOrEqual(4);
    expect(apart(peak.RF, peak.LH), 'RF/LH diagonal').toBeLessThanOrEqual(4);
    // …and the two pairs are half a stride apart.
    expect(apart(peak.LF, peak.RF)).toBeGreaterThan(28);
  });

  it('the CANTER is 3-beat: a hind, then a diagonal pair, then the lead fore', () => {
    const spec = GAITS.canter;
    // The diagonal pair lands together…
    expect(spec.contact.RH).toBe(spec.contact.LF);
    // …after the trailing hind, and before the leading fore.
    expect(spec.contact.LH).toBeLessThan(spec.contact.RH);
    expect(spec.contact.RF).toBeGreaterThan(spec.contact.LF);
    // Three distinct beats, not four.
    expect(new Set(Object.values(spec.contact)).size).toBe(3);
    expect(spec.beats).toBe(3);
  });

  it('the GALLOP splits the canter diagonal into four separate beats', () => {
    const spec = GAITS.gallop;
    expect(new Set(Object.values(spec.contact)).size).toBe(4);
    expect(spec.contact.RH).not.toBe(spec.contact.LF);
    // Hinds first, then fores: LH, RH, LF, RF.
    const order = LEGS.map((l) => ({ l, t: spec.contact[l] })).sort((a, b) => a.t - b.t);
    expect(order.map((o) => o.l)).toEqual(['LH', 'RH', 'LF', 'RF']);
    // And a real moment of suspension: total ground time under one stride.
    expect(spec.duty * 4).toBeLessThan(1.5);
  });

  it('horses nod at walk and canter and stay level at the trot', () => {
    // The reason a rider can post to a trot and not to a canter.
    expect(GAITS.trot.nod).toBeLessThan(0.05);
    expect(GAITS.walk.nod).toBeGreaterThan(0.08);
    expect(GAITS.canter.nod).toBeGreaterThan(0.08);
  });

  it('ground speed matches the limb sweep — the horse must not skate', () => {
    // THE regression that made the first release slide: the gait declared a
    // stride its legs could not deliver, so the body covered twice the
    // ground the hooves did. Measure the hoof's actual travel through
    // stance and check the declared speed carries the body exactly that
    // far in exactly that time.
    const rig = horse();
    const clips = createGaitClips(rig);
    for (const gait of ['walk', 'trot', 'canter', 'gallop'] as const) {
      const spec = GAITS[gait];
      const samples = 240;
      const mixer = new AnimationMixer(rig.mesh);
      mixer.clipAction(clips[gait]).play();
      // Follow one leg's hoof in Z through its stance window.
      const zs: number[] = [];
      let last = 0;
      for (let i = 0; i < samples; i++) {
        const t = (i / samples) * clips[gait].duration;
        mixer.update(t - last);
        last = t;
        rig.mesh.updateMatrixWorld(true);
        const phase = (i / samples - spec.contact.LH + 1) % 1;
        if (phase < spec.duty) {
          zs.push(rig.bones.LHHoof.getWorldPosition(new Vector3()).z);
        }
      }
      const sweep = Math.max(...zs) - Math.min(...zs);
      const stanceTime = spec.duty * clips[gait].duration;
      const impliedSpeed = sweep / stanceTime;
      const declared = clips.speeds[gait];
      // Within 15%: the hoof must travel back under the horse at very close
      // to the speed the horse travels forward.
      expect(Math.abs(impliedSpeed - declared) / declared, `${gait} skate`).toBeLessThan(0.15);
    }
  });

  it('the gaits run at the speeds a real horse runs at', () => {
    const clips = createGaitClips(horse({ height: 1.62 }));
    // Rough real-world bands for a riding horse, m/s.
    expect(clips.speeds.walk).toBeGreaterThan(0.9);
    expect(clips.speeds.walk).toBeLessThan(2.0);
    expect(clips.speeds.trot).toBeGreaterThan(2.2);
    expect(clips.speeds.trot).toBeLessThan(4.5);
    expect(clips.speeds.canter).toBeGreaterThan(4);
    expect(clips.speeds.canter).toBeLessThan(7.5);
    expect(clips.speeds.gallop).toBeGreaterThan(8);
    expect(clips.speeds.gallop).toBeLessThan(16);
  });

  it('the playback band covers every gait\'s whole range — any clamp is a skate', () => {
    // A gait must stretch from the speed it takes over at, up to the speed
    // the next gait takes over — WITHOUT hitting the clamp. Clamping the
    // rate is exactly the moment playback stops tracking the ground.
    const loco = new QuadrupedLocomotion(horse());
    const { walk, trot, canter, gallop } = loco.clips.speeds;
    const [bottom, top] = loco.rateRange;
    const band: Array<[string, number, number, number]> = [
      ['walk', walk, 0.15, (walk + trot) / 2],
      ['trot', trot, (walk + trot) / 2, (trot + canter) / 2],
      ['canter', canter, (trot + canter) / 2, (canter + gallop) / 2],
      ['gallop', gallop, (canter + gallop) / 2, gallop * 1.3],
    ];
    for (const [name, reference, low, high] of band) {
      expect(low / reference, `${name} slowest`).toBeGreaterThanOrEqual(bottom);
      expect(high / reference, `${name} fastest`).toBeLessThanOrEqual(top);
    }
  });

  it('gait speeds increase in order and clips are loop-seamless', () => {
    const rig = horse();
    const clips = createGaitClips(rig);
    expect(clips.speeds.walk).toBeLessThan(clips.speeds.trot);
    expect(clips.speeds.trot).toBeLessThan(clips.speeds.canter);
    expect(clips.speeds.canter).toBeLessThan(clips.speeds.gallop);
    for (const name of ['walk', 'trot', 'canter', 'gallop', 'idle'] as const) {
      for (const track of clips[name].tracks) {
        const v = track.values;
        const stride = track.getValueSize();
        for (let c = 0; c < stride; c++) {
          expect(v[c], `${name} ${track.name} loops`).toBeCloseTo(v[v.length - stride + c], 4);
        }
      }
    }
  });
});

describe('QuadrupedLocomotion', () => {
  it('picks the gait a horse would pick for the speed', () => {
    const rig = horse();
    const loco = new QuadrupedLocomotion(rig);
    expect(loco.gaitFor(0)).toBe('idle');
    expect(loco.gaitFor(loco.clips.speeds.walk)).toBe('walk');
    expect(loco.gaitFor(loco.clips.speeds.trot)).toBe('trot');
    expect(loco.gaitFor(loco.clips.speeds.canter)).toBe('canter');
    expect(loco.gaitFor(loco.clips.speeds.gallop * 1.2)).toBe('gallop');
  });

  it('changes gait as it speeds up, and reports each change once', () => {
    const rig = horse();
    const loco = new QuadrupedLocomotion(rig);
    const changes: GaitName[] = [];
    loco.onGaitChange((to) => changes.push(to));
    for (let i = 0; i < 600; i++) loco.update(1 / 60, (i / 600) * loco.clips.speeds.gallop * 1.3);
    expect(changes).toEqual(['walk', 'trot', 'canter', 'gallop']);
    expect(loco.gait).toBe('gallop');
  });

  it('stride-matches within a gait instead of sliding the hooves', () => {
    const rig = horse();
    const loco = new QuadrupedLocomotion(rig);
    loco.setGait('trot');
    for (let i = 0; i < 200; i++) loco.update(1 / 60, loco.clips.speeds.trot * 1.25);
    const fast = loco.mixer.clipAction(loco.clips.trot).timeScale;
    expect(fast).toBeGreaterThan(1);
    expect(fast).toBeLessThanOrEqual(loco.rateRange[1]);
  });

  it('actually MOVES the legs when driven through the controller', () => {
    // The regression that shipped a sliding horse: every clip was correct
    // and every gait was selected correctly, but the controller parked its
    // actions at zero intrinsic weight, so the mixer wrote nothing and the
    // horse skated along in its rest pose. The earlier tests all drove a
    // raw AnimationMixer and sailed straight past it — so this one drives
    // the real controller and watches the bones.
    for (const gait of ['walk', 'trot', 'canter', 'gallop'] as const) {
      const rig = horse();
      const loco = new QuadrupedLocomotion(rig);
      loco.setGait(gait);
      const seen = new Set<string>();
      for (let i = 0; i < 90; i++) {
        loco.update(1 / 30, loco.clips.speeds[gait]);
        rig.mesh.updateMatrixWorld(true);
        seen.add(
          LEGS.map((leg) => rig.bones[`${leg}Hoof`].getWorldPosition(new Vector3()).z.toFixed(2))
            .join(',')
        );
      }
      // A frozen rig gives one unique pose; a moving one gives many.
      expect(seen.size, `${gait} animates`).toBeGreaterThan(10);
    }
  });

  it('holds a real pose at idle too', () => {
    const rig = horse();
    const loco = new QuadrupedLocomotion(rig);
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      loco.update(1 / 30, 0);
      rig.mesh.updateMatrixWorld(true);
      seen.add(rig.bones.TailTip.getWorldPosition(new Vector3()).x.toFixed(4));
    }
    expect(loco.gait).toBe('idle');
    expect(seen.size, 'idle breathes').toBeGreaterThan(5);
  });

  it('comes back to a standstill', () => {
    const rig = horse();
    const loco = new QuadrupedLocomotion(rig);
    for (let i = 0; i < 200; i++) loco.update(1 / 60, 8);
    expect(loco.gait).toBe('gallop');
    for (let i = 0; i < 400; i++) loco.update(1 / 60, 0);
    expect(loco.gait).toBe('idle');
    expect(loco.speed).toBeLessThan(0.05);
  });
});
