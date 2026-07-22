import {
  AnimationClip,
  AnimationMixer,
  BufferAttribute,
  Color,
  DataTexture,
  DynamicDrawUsage,
  FloatType,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix3,
  Matrix4,
  MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  Vector3,
} from 'three';
import { Rng } from './core/random';
import { createHumanoid, type HumanoidRig } from './humanoid';
import { createLocomotionClips, type GaitOptions } from './clips';
import { DEFAULT_OUTFIT, type OutfitPalette } from './palette';

export interface VATData {
  /** Skinned vertex positions: width = vertexCount, height = frames. */
  positions: DataTexture;
  /** Skinned vertex normals, same layout. */
  normals: DataTexture;
  frames: number;
  duration: number;
  vertexCount: number;
}

/**
 * Bake a clip's skinned deformation into float textures — Vertex
 * Animation Textures. One texel = one vertex at one frame; the crowd
 * shader replays the bake on an InstancedMesh, so a hundred walkers cost
 * one skeleton-free draw call. The last row equals the first (seamless
 * loops), and normals are baked too so lighting stays honest.
 */
export function bakeVAT(rig: HumanoidRig, clip: AnimationClip, fps = 15): VATData {
  const geometry = rig.mesh.geometry;
  const vertexCount = geometry.getAttribute('position').count;
  const frames = Math.max(2, Math.round(clip.duration * fps));
  const positionData = new Float32Array(vertexCount * frames * 4);
  const normalData = new Float32Array(vertexCount * frames * 4);

  const mixer = new AnimationMixer(rig.mesh);
  mixer.clipAction(clip).play();

  const skinIndex = geometry.getAttribute('skinIndex');
  const restNormal = geometry.getAttribute('normal');
  const vertex = new Vector3();
  const normal = new Vector3();
  const skinMatrix = new Matrix4();
  const boneNormals: Matrix3[] = rig.skeleton.bones.map(() => new Matrix3());

  for (let frame = 0; frame < frames; frame++) {
    // Row N-1 duplicates time 0 → the shader can wrap linearly.
    const t = frame === frames - 1 ? 0 : (frame * clip.duration) / (frames - 1);
    mixer.setTime(t);
    rig.object.updateMatrixWorld(true);
    rig.skeleton.update();

    // Rigid skinning: one matrix per bone per frame covers every vertex.
    rig.skeleton.bones.forEach((bone, b) => {
      skinMatrix.multiplyMatrices(bone.matrixWorld, rig.skeleton.boneInverses[b]);
      boneNormals[b].getNormalMatrix(skinMatrix);
    });

    for (let v = 0; v < vertexCount; v++) {
      rig.mesh.getVertexPosition(v, vertex);
      const out = (frame * vertexCount + v) * 4;
      positionData[out] = vertex.x;
      positionData[out + 1] = vertex.y;
      positionData[out + 2] = vertex.z;
      positionData[out + 3] = 1;
      normal.fromBufferAttribute(restNormal as never, v);
      normal.applyMatrix3(boneNormals[skinIndex.getX(v)]).normalize();
      normalData[out] = normal.x;
      normalData[out + 1] = normal.y;
      normalData[out + 2] = normal.z;
      normalData[out + 3] = 0;
    }
  }
  mixer.stopAllAction();

  const makeTexture = (data: Float32Array): DataTexture => {
    const texture = new DataTexture(data as unknown as BufferSource, vertexCount, frames, RGBAFormat, FloatType);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.needsUpdate = true;
    return texture;
  };
  return {
    positions: makeTexture(positionData),
    normals: makeTexture(normalData),
    frames,
    duration: clip.duration,
    vertexCount,
  };
}

export interface CrowdOptions {
  /** Instance count. */
  count: number;
  /** Base seed for bodies, phases and tints. Default 1. */
  seed?: number;
  /** Distinct baked bodies (draw calls). Default 3. */
  variants?: number;
  /** Which synthesized clip to bake. Default 'walk'. */
  clip?: 'walk' | 'idle' | 'run';
  palette?: OutfitPalette;
  gait?: GaitOptions;
  /** Bake sampling rate. Default 15. */
  fps?: number;
}

export interface RouteOptions {
  /** Ground height lookup. Default 0. */
  surface?: number | ((x: number, z: number) => number);
  /** Close the route into a loop. Default true. */
  loop?: boolean;
  /** Meters of route left between instances at start. Spread evenly by default. */
}

interface RouteState {
  points: Vector3[];
  lengths: number[];
  total: number;
  loop: boolean;
  distance: number[];
  speed: number[];
}

/**
 * A background crowd: N characters rendered as a handful of VAT
 * InstancedMeshes — no skeletons, no mixers, no per-character CPU cost.
 * Bodies, outfits, gear, phases and tints are all seeded. Place
 * instances by hand with `set`, or send the whole crowd walking a SCENA
 * road with `followRoute(road.route)`.
 *
 * ```ts
 * const crowd = new Crowd({ count: 80, seed: 9 });
 * scene.add(crowd.group);
 * crowd.followRoute(road.route, { surface: terrain.heightAt });
 * game.onUpdate((t) => crowd.update(t.delta));
 * ```
 *
 * Heroes stay heroes: keep full `createHumanoid` rigs for the few
 * characters near the camera and let the crowd fill the distance.
 */
export class Crowd {
  readonly group: Group;
  readonly count: number;
  /** The clip's stride-matched ground speed — route walkers move at this. */
  readonly walkSpeed: number;

  private readonly meshes: InstancedMesh[] = [];
  private readonly variantOf: number[] = [];
  private readonly indexInVariant: number[] = [];
  private readonly uniforms: Array<{ uTime: { value: number } }> = [];
  private readonly matrix = new Matrix4();
  private readonly heading = new Vector3();
  private route: RouteState | null = null;

  constructor(options: CrowdOptions) {
    const rng = new Rng(options.seed ?? 1);
    const count = options.count;
    const variantCount = Math.max(1, Math.min(options.variants ?? 3, count));
    const clipName = options.clip ?? 'walk';
    this.count = count;
    this.group = new Group();
    this.group.name = 'crowd';

    // Instances round-robin across variants.
    const perVariant: number[] = new Array(variantCount).fill(0);
    for (let i = 0; i < count; i++) {
      const v = i % variantCount;
      this.variantOf.push(v);
      this.indexInVariant.push(perVariant[v]++);
    }

    let walkSpeed = 0;
    for (let v = 0; v < variantCount; v++) {
      const rig = createHumanoid({
        seed: rng.int(1, 1e9),
        palette: options.palette ?? DEFAULT_OUTFIT,
      });
      const clips = createLocomotionClips(rig, options.gait);
      walkSpeed += clips.walkSpeed / variantCount;
      const vat = bakeVAT(rig, clips[clipName], options.fps ?? 15);

      const geometry = rig.mesh.geometry.clone();
      const ids = new Float32Array(vat.vertexCount);
      for (let i = 0; i < vat.vertexCount; i++) ids[i] = i;
      geometry.setAttribute('aVertexId', new BufferAttribute(ids, 1));
      const phases = new Float32Array(perVariant[v]);
      for (let i = 0; i < phases.length; i++) phases[i] = rng.next();
      geometry.setAttribute('aPhase', new InstancedBufferAttribute(phases, 1));

      const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true });
      const uniforms = { uTime: { value: 0 } };
      this.uniforms.push(uniforms);
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uVatPositions = { value: vat.positions };
        shader.uniforms.uVatNormals = { value: vat.normals };
        shader.uniforms.uFrames = { value: vat.frames };
        shader.uniforms.uDuration = { value: vat.duration };
        shader.uniforms.uVertexCount = { value: vat.vertexCount };
        shader.vertexShader =
          `attribute float aVertexId;
attribute float aPhase;
uniform sampler2D uVatPositions;
uniform sampler2D uVatNormals;
uniform float uTime;
uniform float uFrames;
uniform float uDuration;
uniform float uVertexCount;
` +
          shader.vertexShader
            .replace(
              '#include <beginnormal_vertex>',
              `float vatPhase = mod(uTime / uDuration + aPhase, 1.0);
float vatFrame = vatPhase * (uFrames - 1.0);
float vatF0 = floor(vatFrame);
float vatMix = vatFrame - vatF0;
float vatU = (aVertexId + 0.5) / uVertexCount;
vec2 vatUv0 = vec2(vatU, (vatF0 + 0.5) / uFrames);
vec2 vatUv1 = vec2(vatU, (min(vatF0 + 1.0, uFrames - 1.0) + 0.5) / uFrames);
vec3 objectNormal = normalize(mix(
  texture2D(uVatNormals, vatUv0).xyz, texture2D(uVatNormals, vatUv1).xyz, vatMix));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif`
            )
            .replace(
              '#include <begin_vertex>',
              `vec3 transformed = mix(
  texture2D(uVatPositions, vatUv0).xyz, texture2D(uVatPositions, vatUv1).xyz, vatMix);`
            );
      };

      const mesh = new InstancedMesh(geometry, material, perVariant[v]);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      // Subtle per-instance tint so shared bodies read as individuals.
      const tint = new Color();
      for (let i = 0; i < perVariant[v]; i++) {
        tint.setHSL(0, 0, 0.5).offsetHSL(0, 0, rng.range(-0.09, 0.09)).multiplyScalar(2);
        mesh.setColorAt(i, tint);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    this.walkSpeed = walkSpeed;

    // Park everyone at the origin until placed.
    for (let i = 0; i < count; i++) this.set(i, 0, 0, 0);
  }

  /** Place one instance (y from `followRoute`'s surface stays untouched). */
  set(index: number, x: number, z: number, rotationY = 0, y = 0): void {
    const mesh = this.meshes[this.variantOf[index]];
    this.matrix.makeRotationY(rotationY).setPosition(x, y, z);
    mesh.setMatrixAt(this.indexInVariant[index], this.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Send the whole crowd walking along a route (SCENA's `road.route`
   * drops straight in). Instances spread evenly, walk at the bake's
   * stride-matched speed, and face their direction of travel.
   */
  followRoute(
    points: Array<Vector3 | { x: number; y?: number; z: number }>,
    options: RouteOptions = {}
  ): void {
    const surface = options.surface ?? 0;
    const heightAt =
      typeof surface === 'number' ? () => surface : (x: number, z: number) => surface(x, z);
    const route = points.map(
      (p) => new Vector3(p.x, heightAt(p.x, 'z' in p ? p.z : 0), (p as { z: number }).z)
    );
    const loop = options.loop ?? true;
    const lengths: number[] = [];
    let total = 0;
    const segments = loop ? route.length : route.length - 1;
    for (let i = 0; i < segments; i++) {
      const length = route[i].distanceTo(route[(i + 1) % route.length]);
      lengths.push(length);
      total += length;
    }
    const rng = new Rng(97);
    this.route = {
      points: route,
      lengths,
      total,
      loop,
      distance: Array.from({ length: this.count }, (_, i) =>
        ((i + rng.range(0.1, 0.9)) / this.count) * total
      ),
      speed: Array.from({ length: this.count }, () => this.walkSpeed * rng.range(0.92, 1.08)),
    };
    this.moveAlongRoute(0);
  }

  /** Advance the animation (and any route walkers). */
  update(dt: number): void {
    for (const uniforms of this.uniforms) uniforms.uTime.value += dt;
    if (this.route) this.moveAlongRoute(dt);
  }

  private moveAlongRoute(dt: number): void {
    const route = this.route!;
    for (let i = 0; i < this.count; i++) {
      route.distance[i] = (route.distance[i] + route.speed[i] * dt) % route.total;
      let d = route.distance[i];
      let segment = 0;
      while (d > route.lengths[segment]) {
        d -= route.lengths[segment];
        segment = (segment + 1) % route.lengths.length;
      }
      const a = route.points[segment];
      const b = route.points[(segment + 1) % route.points.length];
      const f = route.lengths[segment] > 0 ? d / route.lengths[segment] : 0;
      this.heading.copy(b).sub(a);
      const rotationY = Math.atan2(this.heading.x, this.heading.z);
      this.set(
        i,
        a.x + this.heading.x * f,
        a.z + this.heading.z * f,
        rotationY,
        a.y + (b.y - a.y) * f
      );
    }
  }
}
