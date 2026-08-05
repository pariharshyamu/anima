# GAMA & SCENA: the trio

three.js renders. [GAMA](https://github.com/pariharshyamu/gama) makes it a game (steering agents, navmesh, behavior trees, input, cameras). [SCENA](https://github.com/pariharshyamu/scena) gives it a world (terrain, sky, day-night, villages, scattering). ANIMA gives it people. **None of the three imports another** — they cooperate through structural typing.

## The structural handshake

| From | To ANIMA |
|---|---|
| GAMA `agent.velocity` | `loco.update(dt, agent.velocity)` — the legs |
| SCENA `terrain.heightAt` | `new FootIK(rig, { ground: terrain.heightAt })` — the feet |
| SCENA `road.route` | `crowd.followRoute(road.route)` — the background populace |
| SCENA props (`.object`) | `attach(rig, 'handRight', lamp.object)` — carried things |

| From ANIMA | To them |
|---|---|
| `rig.obstacleRadius` | GAMA `ObstacleAvoidance`, SCENA `scatter` keep-outs |
| `rig.object` (an `Object3D`) | GAMA `GameObject.add`, any three.js scene |

The canonical loop — a villager strolling a SCENA road on GAMA steering with ANIMA legs:

```js
const rig = createHumanoid({ seed: 7 });
const walker = game.world.spawn('walker');
walker.add(rig.object);
const agent = walker.addComponent(new MotionAgent({ maxSpeed: 1.5, planar: true }));
agent.addBehavior(new FollowPath(new Path(road.route, true), 1.5));
agent.addBehavior(new ObstacleAvoidance(() => forest.obstacles), 2.5);

game.onUpdate((t) => {
  walker.position.y = terrain.heightAt(walker.position.x, walker.position.z);
  loco.update(t.delta, agent.velocity);
});
```

## Proof by basketball

The repo ships **Meadow Hoops** (`npm run dev:hoops`): a complete single-file basketball game — you vs a GAMA-steered CPU on a SCENA forest court, ANIMA athletes in team kits carrying the ball in a hand socket, a procedural jump-shot overlay, and 26 VAT spectators. ~550 lines of pure consumer code; none of the three libraries needed changing. That was the point.
