import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';
import { createHumanoid, Locomotion } from 'anima3d';

const scene = new Scene();
scene.background = new Color(0x1a2230);
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// Frontal, flattering light — this is a portrait studio.
const key = new DirectionalLight(0xfff2e0, 1.6);
key.position.set(2, 6, 10);
const fill = new DirectionalLight(0xbcd8ff, 0.5);
fill.position.set(-6, 3, 4);
scene.add(key, fill, new AmbientLight(0xffffff, 0.45));
const ground = new Mesh(
  new PlaneGeometry(40, 40),
  new MeshStandardMaterial({ color: 0x2c3547 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// A row of seeded villagers, idling and breathing, facing the camera.
const baseSeed = parseInt(new URLSearchParams(location.search).get('seed') ?? '300', 10);
const characters: Locomotion[] = [];
for (let i = 0; i < 5; i++) {
  const rig = createHumanoid({ seed: baseSeed + i });
  rig.object.position.set((i - 2) * 0.75, 0, -i * 0.001);
  scene.add(rig.object);
  characters.push(new Locomotion(rig));
}

camera.position.set(0, 1.5, 3.1);
camera.lookAt(0, 1.35, 0);

let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const loco of characters) loco.update(dt, 0);
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
