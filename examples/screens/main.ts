import { AmbientLight, PointLight, Vector3 } from 'three';
import {
  createLaptop,
  createMonitor,
  createRoom,
  createScreenLight,
  createSeat,
  createSmartDisplay,
  createTable,
  createTelevision,
  PALETTES,
  type ScreenMode,
} from 'scena3d';
import {
  createHumanoid,
  Interaction,
  LookAt,
  Locomotion,
  Mannerisms,
  OUTFITS,
  Watching,
} from 'anima3d';
import { Device, Game, TouchControls } from 'gama3d';

// A flat, after dark. The only things in here that emit light are screens —
// which is the whole point: until now a SCENA interior at night was simply
// black, because every light source in the kit was a fire.
const palette = PALETTES.urban;
const game = new Game();
const scene = game.world.scene;

// Note the unit override. The kit's default cell is 2 m, which builds a
// perfectly good great hall and a ludicrous flat — at that scale the sofa
// ends up six metres from the television and no domestic light source can
// cross the gap. A living room is about 7 x 6.
const room = createRoom(
  [
    '########',
    '#......#',
    '#......#',
    '#......#',
    '#..S...#',
    '#......#',
    '########',
  ],
  {
    palette,
    unit: 1.2,
    wallHeight: 2.7,
    floor: 'plank',
    ceiling: true,
    hearthLight: false,
    seed: 5,
  }
);
scene.add(room.group);

// A whisper of ambient so the room is not a void when everything is off.
// Deliberately far below what you would light an interior with.
const ambient = new AmbientLight(0x2a3550, 0.075);
scene.add(ambient);
// The ceiling light, off to begin with — the room is lit by television.
const ceiling = new PointLight(0xffe6bd, 0, 9, 1.6);
ceiling.position.set(0, 2.5, 0);
scene.add(ceiling);

// ---- the television ----------------------------------------------------

const media = createTable({ palette, seed: 12 });
media.object.position.set(0, 0, -2.75);
media.object.scale.set(1.15, 0.62, 0.75);
scene.add(media.object);

const tv = createTelevision({
  diagonal: 1.25,
  mount: 'stand',
  mode: 'off',
  seed: 21,
  palette,
});
tv.object.position.set(0, 0.47, -2.7);
scene.add(tv.object);
const tvGlow = createScreenLight(tv.screen, { gain: 1.15, distance: 0.5 });

// GAMA owns whether it is ON; SCENA owns what that looks like. The only
// thing crossing between them is `setMode(string)`.
const set = new Device({ boot: 2.4, idle: 0, modes: { booting: 'standby' } });
set.attach(tv.screen);
set.show('video');

// ---- a desk in the corner ----------------------------------------------

const desk = createTable({ palette, seed: 3 });
desk.object.position.set(-2.9, 0, -1.0);
desk.object.rotation.y = Math.PI / 2;
scene.add(desk.object);

const monitor = createMonitor({ diagonal: 0.58, mode: 'chart', seed: 31, palette });
monitor.object.position.set(-3.05, 0.74, -1.0);
monitor.object.rotation.y = Math.PI / 2;
scene.add(monitor.object);
// A monitor left alone dims and then sleeps. A television does not.
const workstation = new Device({ boot: 1.2, idle: 22, dimShare: 0.3 });
workstation.attach(monitor.screen);
workstation.turnOn(true);
workstation.show('chart');

const laptop = createLaptop({ diagonal: 0.33, open: 1, mode: 'feed', scrollRate: 1.4, seed: 41 });
laptop.object.position.set(-2.85, 0.74, -1.6);
laptop.object.rotation.y = Math.PI / 2 + 0.35;
scene.add(laptop.object);

const hub = createSmartDisplay({ mode: 'map', seed: 51, palette });
hub.object.position.set(2.95, 0.95, -2.3);
hub.object.rotation.y = -0.6;
scene.add(hub.object);

const screens = [tv.screen, monitor.screen, laptop.screen, hub.screen];

// ---- somebody watching -------------------------------------------------

const sofa = createSeat({ style: 'bench', palette, seed: 8 });
sofa.object.position.set(0, 0, 1.05);
// Turned to face the television. A SCENA seat slot faces its own +z, so a
// bench dropped in unrotated seats you with your back to the only light in
// the room — which every numeric check happily passes.
sofa.object.rotation.y = Math.PI;
scene.add(sofa.object);

const rig = createHumanoid({ seed: 17, palette: OUTFITS.villager });
scene.add(rig.object);
const loco = new Locomotion(rig);
const gaze = new LookAt(rig);
const sitting = new Interaction(rig, loco);
const watch = new Watching(rig, gaze, { engagement: 0.82, seed: 6 });
// Idle fidgets keep the body alive while the head does the watching.
const idle = new Mannerisms(rig, loco, { context: 'seated', seed: 23 });

const seat = sofa.slots?.[0];
if (seat) sitting.use(seat, { approach: false });
watch.watch(tv.screen);

// ---- control -----------------------------------------------------------

const CONTENT: ScreenMode[] = ['video', 'feed', 'map', 'chart', 'call'];
let lightsOn = false;
let closeUp = false;

new TouchControls(game.input, {
  buttons: [
    { label: 'Power', code: 'Space', css: 'right:26px;bottom:40px' },
    { label: 'Lights', code: 'KeyL', css: 'right:120px;bottom:40px' },
    { label: 'Cam', code: 'KeyC', css: 'right:214px;bottom:40px' },
  ],
});

const hud = document.getElementById('hud')!;

game.onUpdate((t) => {
  const dt = t.delta;

  if (game.input.wasPressed('Space')) set.press();
  if (game.input.wasPressed('KeyL')) lightsOn = !lightsOn;
  if (game.input.wasPressed('KeyC')) closeUp = !closeUp;
  for (let i = 0; i < CONTENT.length; i++) {
    if (game.input.wasPressed(`Digit${i + 1}`)) set.show(CONTENT[i]);
  }
  // Any keypress counts as somebody being at the desk, so the monitor stops
  // dozing while you are clearly using the machine.
  if (game.input.wasPressed('KeyW') || game.input.wasPressed('Digit1')) workstation.nudge();

  set.update(dt);
  workstation.update(dt);
  for (const screen of screens) screen.update(dt);
  tvGlow.update();

  ceiling.intensity += ((lightsOn ? 5.5 : 0) - ceiling.intensity) * Math.min(1, dt * 4);

  // A stand-in for bounce. The screen light is a forward cone, which is
  // right — but with no global illumination the side walls then get nothing
  // at all and the room reads as a spotlit stage. Tinting the ambient with
  // whatever the television is showing, very faintly, puts the colour of the
  // picture back into the corners for the cost of one colour copy.
  // Tint, do not replace: copying the glow outright turns the ambient black
  // the moment the set goes off, and a dark room is not a void.
  ambient.color.set(0x2a3550).lerp(tv.screen.glow.color, 0.55);
  ambient.intensity = 0.055 + Math.min(0.9, tv.screen.glow.intensity) * 0.10;

  loco.update(dt, 0);
  sitting.update(dt);
  idle.update(dt);
  watch.update(dt);
  gaze.update(dt);

  // Camera: the wide, or in on her face — which is where the whole feature
  // either works or does not.
  const head = rig.bones.Head.getWorldPosition(new Vector3());
  if (closeUp) {
    game.camera.position.set(head.x - 0.55, head.y + 0.12, head.z - 1.15);
    game.camera.lookAt(head.x, head.y + 0.02, head.z);
  } else {
    // Three-quarter from her side: she reads as a lit silhouette with the
    // television in the same frame. Straight down the room she is a dark
    // shape against a bright panel and might as well not be there.
    game.camera.position.set(2.5, 1.5, 1.55);
    game.camera.lookAt(-0.15, 1.0, -1.4);
  }

  hud.innerHTML =
    `<b>${set.state}</b>${set.state === 'booting' ? ` ${(set.progress * 100) | 0}%` : ''}<br>` +
    `${tv.screen.mode} · glow ${tv.screen.glow.intensity.toFixed(2)}<br>` +
    `monitor: ${workstation.state}` +
    (watch.away ? '<br><span style="opacity:.6">looked away</span>' : '');
});

game.camera.position.set(2.5, 1.5, 1.55);
game.start();

// ---- headless verification hooks ---------------------------------------

declare global {
  interface Window {
    screensDebug: () => Record<string, unknown>;
    screensDo: (what: string) => void;
    screensSample: () => Record<string, number>;
    screensPixels: (what: 'face' | 'panel' | 'floor' | 'behind') => Record<string, number>;
  }
}

// Read the actual rendered image. Every lesson from this project says the
// numbers can be right while the picture is wrong — a screen whose content
// is uniform white passes a brightness check and looks like a sheet of
// paper — so sample real pixels: the panel (does it have STRUCTURE?), her
// face (is it LIT?), and the wall behind her (is the room dark?).
const sampler = document.createElement('canvas');
const sctx = sampler.getContext('2d', { willReadFrequently: true })!;

function pixelStats(cx: number, cy: number, half: number): Record<string, number> {
  const canvas = game.renderer.domElement;
  // Render and copy in the same task: with preserveDrawingBuffer off, the
  // drawing buffer is only readable before it is presented.
  game.renderer.render(scene, game.camera);
  sampler.width = canvas.width;
  sampler.height = canvas.height;
  sctx.drawImage(canvas, 0, 0);
  const x = Math.max(0, Math.round(cx * canvas.width - half));
  const y = Math.max(0, Math.round(cy * canvas.height - half));
  const w = Math.min(canvas.width - x, half * 2);
  const h = Math.min(canvas.height - y, half * 2);
  if (w <= 0 || h <= 0) return { mean: 0, variance: 0, max: 0, n: 0 };
  const data = sctx.getImageData(x, y, w, h).data;
  let sum = 0;
  let sumSq = 0;
  let max = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += l;
    sumSq += l * l;
    if (l > max) max = l;
  }
  const mean = sum / n;
  return {
    mean: +mean.toFixed(2),
    variance: +(sumSq / n - mean * mean).toFixed(1),
    max: +max.toFixed(1),
    n,
  };
}

function toScreen(at: Vector3): [number, number] {
  const p = at.clone().project(game.camera);
  return [(p.x + 1) / 2, (-p.y + 1) / 2];
}

window.screensPixels = (what) => {
  if (what === 'panel') {
    const [x, y] = toScreen(tv.screen.surface.getWorldPosition(new Vector3()));
    return pixelStats(x, y, 26);
  }
  if (what === 'floor') {
    // Floor between the set and the sofa — squarely in front of the screen,
    // so this is where "the television lights the room" is either true or not.
    const [x, y] = toScreen(new Vector3(0.3, 0.02, -0.9));
    return pixelStats(x, y, 20);
  }
  if (what === 'behind') {
    // The wall the television is STANDING AGAINST. A screen throws its light
    // forward, so this should stay dark. With an omnidirectional lamp it was
    // the brightest thing in the room — a halo behind the set, and the person
    // watching it left in shadow, because the wall is 1.4 m away and she is
    // 3.2 m away. Backwards, and only visible by looking.
    const [x, y] = toScreen(new Vector3(1.35, 1.75, -3.5));
    return pixelStats(x, y, 16);
  }
  const [x, y] = toScreen(rig.bones.Head.getWorldPosition(new Vector3()));
  return pixelStats(x, y, 11);
};

window.screensDo = (what) => {
  if (what === 'power') set.press();
  else if (what === 'on') set.turnOn(true);
  else if (what === 'off') set.turnOff();
  else if (what === 'lights') lightsOn = !lightsOn;
  else if (what === 'closeup') closeUp = true;
  else if (what === 'wide') closeUp = false;
  else if (CONTENT.includes(what as ScreenMode)) set.show(what as ScreenMode);
};

// Face brightness is the metric that matters. A screen that is emissive but
// throws nothing into the room passes every numeric check and still leaves
// the character sitting in the dark, so measure the light ARRIVING at her:
// the TV's contribution at the head, by inverse-square from its own lamp.
window.screensSample = () => {
  const head = rig.bones.Head.getWorldPosition(new Vector3());
  const lamp = tvGlow.light.getWorldPosition(new Vector3());
  const d = Math.max(0.2, head.distanceTo(lamp));
  return {
    glow: +tv.screen.glow.intensity.toFixed(4),
    lampIntensity: +tvGlow.light.intensity.toFixed(4),
    atFace: +(tvGlow.light.intensity / (d * d)).toFixed(4),
    distance: +d.toFixed(2),
  };
};

window.screensDebug = () => {
  const gl = game.renderer.getContext();
  const head = rig.bones.Head.getWorldPosition(new Vector3());
  const panel = tv.screen.surface.getWorldPosition(new Vector3());
  const target = gaze.target as Vector3 | null;
  return {
    glError: gl.getError(),
    // A screen's light must be a forward cone, not a point — a point lights
    // the wall the set stands against harder than the person watching it.
    lightType: tvGlow.light.type,
    lightAngle: +tvGlow.light.angle.toFixed(2),
    drawCalls: game.renderer.info.render.calls,
    programs: game.renderer.info.programs?.length ?? 0,
    deviceState: set.state,
    tvMode: tv.screen.mode,
    monitorState: workstation.state,
    glow: +tv.screen.glow.intensity.toFixed(3),
    lampIntensity: +tvGlow.light.intensity.toFixed(3),
    // Is she actually looking at the television, or past it? The angle
    // between where her head points and where the panel is.
    gazeOnScreen: target
      ? +new Vector3()
          .subVectors(target, head)
          .normalize()
          .angleTo(new Vector3().subVectors(panel, head).normalize())
          .toFixed(3)
      : null,
    lookedAway: watch.away,
    seated: rig.bones.Hips.getWorldPosition(new Vector3()).y < 0.75,
    headY: +head.y.toFixed(2),
  };
};
