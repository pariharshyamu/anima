# Locomotion & gaits

ANIMA ships no animation files. `createLocomotionClips(rig)` **synthesizes** idle, walk and run `AnimationClip`s from gait parameters — hip swing, a knee curve with a solved stance half and a front-loaded swing half, ankle leveling, arm counter-swing with elbow bend, pelvis/chest counter-twist, forward lean at a run. There is no authored bob and no stride factor: the pelvis height is whatever planting the lower foot makes it, and the reference ground speeds are the ankle's own travel over the leg's forward kinematics. Clips are loop-seamless (last frame = first), in-place, and deterministic.

```js
const clips = createLocomotionClips(rig, { walkDuration: 1.0, runHipSwing: 0.9 });
clips.walkSpeed; // the ground speed the walk cycle is stride-matched to
```

Those reference speeds are the whole game: `Locomotion` divides by them to get
its playback rate, so a speed that overstates its clip's real stride slides the
foot by exactly that much, every step. One of them did — the run's, by 18.4% —
and nothing short of measuring the bones could see it. [`measureFootSkate` and
the `npm run skate` gate](skate.md) is that measurement, and it is now what
stands between these constants and a character on ice.

## The Locomotion controller

```js
const loco = new Locomotion(rig);
game.onUpdate((t) => loco.update(t.delta, agent.velocity)); // Vector3 or number
```

What "professional" means here, concretely:

- **1D speed blend** idle ↔ walk ↔ run with weights that always sum to 1
- **Phase synchronization**: while walk and run are both audible in the blend, run follows walk's normalized cycle phase — left and right footfalls agree
- **Stride matching**: playback rate scales so the blended reference speed equals the actual speed — feet grip instead of sliding
- **Smoothed input**: steering jitter never pops the animation; vertical velocity is ignored (falling is not running)

`loco.weights` and `loco.speed` are exposed for debugging and tests.

## Footstep events

```js
const off = loco.onFootstep((foot) => playStepSound(foot)); // 'Left' | 'Right'
```

Fired at each heel strike, derived from gait phase — silent when idle, strictly alternating at a walk. Hook footstep audio, dust puffs, or noise-based stealth. The returned function unsubscribes.
