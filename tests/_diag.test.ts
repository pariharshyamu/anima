import { it } from 'vitest';
import { AnimationMixer, Vector3 } from 'three';
import { createGaitClips, createQuadruped, LEGS } from '../src';

it('diag', () => {
  const rig = createQuadruped({ seed: 5 });
  for (const gait of ['trot', 'gallop'] as const) {
    const clips = createGaitClips(rig);
    const mixer = new AnimationMixer(rig.mesh);
    mixer.clipAction(clips[gait]).play();
    const N = 24;
    const rows: string[] = [];
    let last = 0;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * clips[gait].duration;
      mixer.update(t - last); last = t;
      rig.mesh.updateMatrixWorld(true);
      const ys = LEGS.map((l) => rig.bones[`${l}Hoof`].getWorldPosition(new Vector3()).y);
      rows.push(`${(i/N).toFixed(2)} ` + ys.map((y) => y.toFixed(3).padStart(7)).join(' '));
    }
    console.log(`\n=== ${gait} ===  phase  ` + LEGS.map((l)=>l.padStart(7)).join(' '));
    console.log(rows.join('\n'));
  }
});
