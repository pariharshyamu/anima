import{Vector3 as uo}from"three";import{Color as Ee,MeshStandardMaterial as ho,Vector2 as po,Vector3 as Vn}from"three";import{BufferAttribute as bo,BufferGeometry as xo}from"three";import{BoxGeometry as So,Color as Yt,ConeGeometry as Le,CylinderGeometry as ie,Group as Nn,IcosahedronGeometry as ce,Mesh as N,MeshStandardMaterial as Co}from"three";import{Color as Qe,Group as Fo,Mesh as Wo,MeshBasicMaterial as _o,PlaneGeometry as Vo}from"three";import{Group as Eo,IcosahedronGeometry as Uo,Mesh as Yo}from"three";import{BoxGeometry as it,Group as $o,Mesh as ct}from"three";import{BoxGeometry as qo,CylinderGeometry as Zo,Group as Xo,Mesh as $t,MeshStandardMaterial as qt}from"three";import{BoxGeometry as Qo,CylinderGeometry as ea,Group as ta,Mesh as lt,MeshStandardMaterial as Zt,PointLight as na,SphereGeometry as oa}from"three";import{ConeGeometry as aa,Group as En,IcosahedronGeometry as sa,Mesh as Un,MeshStandardMaterial as Yn}from"three";import{BoxGeometry as de,BufferAttribute as ca,BufferGeometry as la,CylinderGeometry as be,Group as ot,Mesh as ee,MeshStandardMaterial as Kn}from"three";import{BoxGeometry as Ae,CylinderGeometry as Pe,Group as At,IcosahedronGeometry as ga,Mesh as le,MeshStandardMaterial as kt}from"three";import{BufferAttribute as zt,BufferGeometry as Sa,Color as Qt,ConeGeometry as Ca,CylinderGeometry as en,Group as Aa,Mesh as Be,SphereGeometry as ka}from"three";import{DoubleSide as za,MeshStandardMaterial as Ia}from"three";import{AdditiveBlending as nn,BufferAttribute as xe,BufferGeometry as Zn,Color as dt,CylinderGeometry as Xe,DoubleSide as Ba,Group as Dt,IcosahedronGeometry as It,Mesh as Me,MeshStandardMaterial as Pt,Points as Fa,PointLight as Xn,ShaderMaterial as on}from"three";import{BufferAttribute as Da,BufferGeometry as Na,CatmullRomCurve3 as ja,CylinderGeometry as Oa,Group as Ea,Mesh as mt,MeshStandardMaterial as Ua,TubeGeometry as Ya,Vector3 as Ka}from"three";import{AdditiveBlending as Za,BoxGeometry as Xa,BufferAttribute as Fe,BufferGeometry as Ja,Color as Qa,CylinderGeometry as Ue,Group as es,Mesh as We,MeshStandardMaterial as ts,Points as ns,ShaderMaterial as os}from"three";import{Mesh as as,MeshStandardMaterial as ss,PlaneGeometry as rs}from"three";import{BoxGeometry as pe,ConeGeometry as cs,CylinderGeometry as we,Group as Gt,Mesh as Q,SphereGeometry as Rt}from"three";import{BoxGeometry as Bt,CylinderGeometry as Te,Group as Nt,IcosahedronGeometry as ps,Mesh as me,TorusGeometry as sn}from"three";import{BufferAttribute as bs,BufferGeometry as xs,BoxGeometry as Ge,Color as Ms,CylinderGeometry as _e,Group as et,Mesh as ne,MeshStandardMaterial as Ne,SphereGeometry as eo,TorusGeometry as Ft}from"three";import{BufferAttribute as Is,Color as ze,Mesh as Ps,MeshStandardMaterial as Ts,PlaneGeometry as Gs}from"three";import{BackSide as Bs,Color as un,Mesh as Fs,ShaderMaterial as Ws,SphereGeometry as _s}from"three";import{AmbientLight as Ls,DirectionalLight as Hs,Fog as Ds,Group as Ns,HemisphereLight as js}from"three";import{Color as fn,PointLight as Ks}from"three";import{Mesh as ht,Vector2 as dn}from"three";import{BufferAttribute as pn,BufferGeometry as Js,Color as gn,LineSegments as Qs,Points as er,ShaderMaterial as tr,Sphere as nr,Vector2 as or,Vector3 as tt}from"three";import{BufferAttribute as Ye,BufferGeometry as fr,Color as pt,Mesh as dr,MeshStandardMaterial as mr,Vector2 as vn,Vector4 as hr}from"three";import{Color as nt,Fog as bn}from"three";import{Color as Cr,Mesh as yt}from"three";import{AdditiveBlending as Ir,BufferAttribute as Se,BufferGeometry as oo,Color as at,Mesh as He,Points as Pr,ShaderMaterial as ao,Sphere as so,Vector3 as ro}from"three";import{BufferAttribute as An,BufferGeometry as _r,InstancedBufferAttribute as Vr,InstancedMesh as Lr,Matrix4 as Hr,MeshStandardMaterial as Dr,Vector3 as ue}from"three";import{BufferAttribute as Ie,BufferGeometry as Er,InstancedBufferAttribute as zn,InstancedMesh as Ur,Matrix4 as Yr,MeshStandardMaterial as Kr,Vector3 as fe}from"three";import{BufferAttribute as Xr,BufferGeometry as Jr,CatmullRomCurve3 as Qr,Mesh as ei,MeshStandardMaterial as ti,Vector3 as $e}from"three";import{Group as oi}from"three";import{BoxGeometry as xt,CylinderGeometry as si,Group as co,InstancedMesh as Pn,Matrix4 as ri,Mesh as Wt,MeshStandardMaterial as De,PointLight as ii,SphereGeometry as ci,Vector3 as qe}from"three";import{CylinderGeometry as Tn,Group as Je,Mesh as Gn,MeshStandardMaterial as Rn}from"three";import{DynamicDrawUsage as fi,Group as Mt,InstancedMesh as di,Matrix4 as Bn,Mesh as mi,Quaternion as hi,Vector3 as St}from"three";import{Vector3 as yi}from"three";var Y=class Fn{constructor(t=1){this.state=t>>>0||1}next(){this.state=this.state+1831565813>>>0;let t=this.state;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,a){return t+this.next()*(a-t)}int(t,a){return t+Math.floor(this.next()*(a-t+1))}pick(t){return t[Math.floor(this.next()*t.length)]}jitter(t,a){return t+(this.next()*2-1)*a}fork(){return new Fn(Math.floor(this.next()*4294967295)||1)}};function Oe(e,t,a){let n=e*374761393+t*668265263+a*2246822519>>>0;return n=Math.imul(n^n>>>13,1274126177)>>>0,((n^n>>>16)>>>0)/4294967296}var Ut=e=>e*e*(3-2*e);function Wn(e,t,a){let n=Math.floor(e),o=Math.floor(t),i=Ut(e-n),s=Ut(t-o),c=Oe(n,o,a),l=Oe(n+1,o,a),r=Oe(n,o+1,a),u=Oe(n+1,o+1,a);return c+(l-c)*i+(r-c)*s+(c-l-r+u)*i*s}function lo(e,t,a,n=4,o=2,i=.5){let s=1,c=1,l=0,r=0;for(let u=0;u<n;u++)l+=Wn(e*c,t*c,a+u*101)*s,r+=s,s*=i,c*=o;return l/r}var _n={meadow:{foliage:[3120727,3650154,2789199,4569208],trunk:7031347,rock:[9080728,7765126,10133672],wood:9070146,woodDark:7031347,metal:4015185,lampGlow:16767113,grassLow:4169050,grassHigh:7319142,cliff:8223346,peak:15265007,skyTop:4026552,skyBottom:12573160,fog:12111837,water:4161454,sand:13220234,path:10125663,wall:14273712,roof:11032126},autumn:{foliage:[13202735,14257722,11754538,14722373],trunk:6111280,rock:[9274744,7827299,10261642],wood:8215098,woodDark:6111280,metal:4603706,lampGlow:16762225,grassLow:10324543,grassHigh:11901770,cliff:8549482,peak:14933716,skyTop:9333928,skyBottom:15255976,fog:14270888,water:4881042,sand:13348995,path:9270356,wall:13416596,roof:9062960},dusk:{foliage:[2055750,2385999,1724992,2978904],trunk:4272455,rock:[5658226,4737121,6579332],wood:6113891,woodDark:4272455,metal:2829117,lampGlow:16757596,grassLow:2976594,grassHigh:4029022,cliff:5394795,peak:12105945,skyTop:1909061,skyBottom:13199946,fog:6969978,water:2968168,sand:9075306,path:6969938,wall:9274009,roof:4535640},winter:{foliage:[3038280,3696986,5405288,8889750],trunk:4864563,rock:[10134701,8687256,11581632],wood:7823433,woodDark:5522746,metal:3752013,lampGlow:16767113,grassLow:13621726,grassHigh:15002606,cliff:7764349,peak:16054266,skyTop:5929894,skyBottom:14214380,fog:13424864,water:4878470,sand:12108486,path:9143160,wall:13814203,roof:7030328}},K=_n.meadow;function fo(e){let t=[];for(let a of e)a.obstacleRadius<=0||(a.object.updateWorldMatrix(!0,!1),t.push({center:a.object.getWorldPosition(new uo),radius:a.obstacleRadius*mo(a.object)}));return t}function mo(e){return Math.max(e.scale.x,e.scale.z)}var U=(e,t,a)=>new Vn(e,t,a),go={plaster:{baseColor:14273712,roughness:.92,metalness:0,scale:3.4,albedoVar:.14,tint:10260340,tintAmount:.12,ao:.18,bump:.15,roughVar:.1,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0},stone:{baseColor:9080728,roughness:.96,metalness:0,scale:2.6,albedoVar:.26,tint:6056772,tintAmount:.16,ao:.34,bump:.42,roughVar:.14,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0},wood:{baseColor:9070146,roughness:.82,metalness:0,scale:5.5,albedoVar:.12,tint:3811868,tintAmount:.14,ao:.16,bump:.12,roughVar:.12,grain:.55,grainScale:3.2,grainAxis:U(0,1,0),flat:!0},plank:{baseColor:10123858,roughness:.78,metalness:0,scale:6.5,albedoVar:.1,tint:4206623,tintAmount:.1,ao:.12,bump:.1,roughVar:.1,grain:.4,grainScale:5,grainAxis:U(1,0,0),flat:!0},thatch:{baseColor:11770460,roughness:.98,metalness:0,scale:9,albedoVar:.3,tint:6968100,tintAmount:.2,ao:.28,bump:.3,roughVar:.08,grain:.35,grainScale:8,grainAxis:U(0,0,1),flat:!0},tile:{baseColor:11032126,roughness:.7,metalness:0,scale:4,albedoVar:.14,tint:7221026,tintAmount:.16,ao:.24,bump:.34,roughVar:.1,grain:.6,grainScale:6,grainAxis:U(1,0,0),flat:!0},metal:{baseColor:4015185,roughness:.52,metalness:.85,scale:4.5,albedoVar:.16,tint:2760984,tintAmount:.18,ao:.22,bump:.16,roughVar:.2,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0},dirt:{baseColor:9075288,roughness:1,metalness:0,scale:2,albedoVar:.22,tint:4863268,tintAmount:.2,ao:.3,bump:.1,roughVar:.05,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!1},sand:{baseColor:13351306,roughness:1,metalness:0,scale:7,albedoVar:.16,tint:10256456,tintAmount:.14,ao:.14,bump:.14,roughVar:.06,grain:.18,grainScale:3,grainAxis:U(1,0,0),flat:!1},gravel:{baseColor:10130570,roughness:.95,metalness:0,scale:5.5,albedoVar:.3,tint:6314575,tintAmount:.18,ao:.32,bump:.5,roughVar:.16,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0},mud:{baseColor:4864038,roughness:.6,metalness:0,scale:2.4,albedoVar:.2,tint:2365192,tintAmount:.3,ao:.34,bump:.16,roughVar:.24,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!1},sandstone:{baseColor:13213802,roughness:.9,metalness:0,scale:3.4,albedoVar:.18,tint:9071164,tintAmount:.16,ao:.22,bump:.24,roughVar:.1,grain:.22,grainScale:2.4,grainAxis:U(0,1,0),flat:!0},granite:{baseColor:9341588,roughness:.58,metalness:0,scale:9,albedoVar:.34,tint:4538701,tintAmount:.14,ao:.14,bump:.12,roughVar:.2,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0},slate:{baseColor:5264990,roughness:.55,metalness:0,scale:3,albedoVar:.14,tint:2897216,tintAmount:.2,ao:.2,bump:.18,roughVar:.12,grain:.2,grainScale:3,grainAxis:U(1,0,0),flat:!0},bark:{baseColor:5915957,roughness:.92,metalness:0,scale:6,albedoVar:.2,tint:2759696,tintAmount:.2,ao:.26,bump:.45,roughVar:.12,grain:.7,grainScale:5.5,grainAxis:U(0,1,0),flat:!0},leather:{baseColor:6964784,roughness:.62,metalness:0,scale:5,albedoVar:.16,tint:3021327,tintAmount:.22,ao:.2,bump:.18,roughVar:.12,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!1},canvas:{baseColor:13286812,roughness:.95,metalness:0,scale:11,albedoVar:.14,tint:9075292,tintAmount:.12,ao:.14,bump:.12,roughVar:.06,grain:.3,grainScale:12,grainAxis:U(1,0,0),flat:!1},parchment:{baseColor:14734512,roughness:.9,metalness:0,scale:3,albedoVar:.12,tint:10126680,tintAmount:.18,ao:.16,bump:.08,roughVar:.06,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!1},terracotta:{baseColor:11887162,roughness:.72,metalness:0,scale:4,albedoVar:.12,tint:8010272,tintAmount:.16,ao:.16,bump:.14,roughVar:.08,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!1},bone:{baseColor:14471866,roughness:.55,metalness:0,scale:6,albedoVar:.14,tint:9076582,tintAmount:.2,ao:.22,bump:.12,roughVar:.1,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0},rust:{baseColor:9062956,roughness:.85,metalness:.25,scale:4,albedoVar:.28,tint:5909010,tintAmount:.3,ao:.26,bump:.28,roughVar:.3,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0},bronze:{baseColor:10119738,roughness:.44,metalness:.9,scale:4.5,albedoVar:.16,tint:3810320,tintAmount:.24,ao:.22,bump:.16,roughVar:.18,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0},brass:{baseColor:13214282,roughness:.34,metalness:.95,scale:5,albedoVar:.12,tint:6965778,tintAmount:.16,ao:.16,bump:.1,roughVar:.14,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0},brick:{baseColor:10373684,roughness:.86,metalness:0,scale:6,albedoVar:.14,tint:5907480,tintAmount:.16,ao:.2,bump:.1,roughVar:.12,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0,tile:1,tileW:.25,tileH:.085,mortar:.014,bond:1,round:0,tileJitter:.18,mortarColor:11774098,tileRelief:.06},cobblestone:{baseColor:9080728,roughness:.9,metalness:0,scale:5,albedoVar:.2,tint:4867126,tintAmount:.18,ao:.28,bump:.2,roughVar:.14,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0,tile:1,tileW:.17,tileH:.15,mortar:.03,bond:1,round:1,tileJitter:.24,mortarColor:3486251,tileRelief:.13},ashlar:{baseColor:12169892,roughness:.9,metalness:0,scale:3,albedoVar:.16,tint:8024671,tintAmount:.16,ao:.2,bump:.12,roughVar:.1,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0,tile:1,tileW:.55,tileH:.32,mortar:.02,bond:.5,round:0,tileJitter:.1,mortarColor:8748655,tileRelief:.05},floortile:{baseColor:6975090,roughness:.5,metalness:0,scale:4,albedoVar:.12,tint:3356218,tintAmount:.16,ao:.16,bump:.08,roughVar:.1,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0,tile:1,tileW:.4,tileH:.4,mortar:.014,bond:0,round:0,tileJitter:.12,mortarColor:2763308,tileRelief:.045},shingle:{baseColor:7031347,roughness:.85,metalness:0,scale:6,albedoVar:.16,tint:3022866,tintAmount:.18,ao:.24,bump:.12,roughVar:.12,grain:.32,grainScale:6,grainAxis:U(0,1,0),flat:!0,tile:1,tileW:.2,tileH:.13,mortar:.012,bond:1,round:0,tileJitter:.2,mortarColor:2365457,tileRelief:.09},snow:{baseColor:10133672,roughness:.9,metalness:0,scale:4,albedoVar:.14,tint:6976128,tintAmount:.14,ao:.2,bump:.24,roughVar:.1,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0,cap:.95,capColor:16054524,capUp:.12,capSharp:.32,capRough:.9},moss:{baseColor:9080712,roughness:.94,metalness:0,scale:3.5,albedoVar:.2,tint:4870720,tintAmount:.16,ao:.28,bump:.34,roughVar:.12,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0,cap:.74,capColor:4217130,capUp:.34,capSharp:.3,capRough:.96},lava:{baseColor:2758418,roughness:.88,metalness:0,scale:3.2,albedoVar:.18,tint:1181702,tintAmount:.26,ao:.34,bump:.5,roughVar:.14,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0,glow:2.6,glowColor:16734750,glowThreshold:.3},crystal:{baseColor:3824778,roughness:.22,metalness:0,scale:5,albedoVar:.14,tint:1716050,tintAmount:.2,ao:.16,bump:.3,roughVar:.1,grain:0,grainScale:1,grainAxis:U(0,1,0),flat:!0,glow:1.5,glowColor:7329535,glowThreshold:.72}},wo=`
// World-space coordinates get large (props far from the origin, plus the seed
// offset), and mobile GPUs default the fragment stage to mediump \u2014 where
// fract() of a big number loses precision and the noise/grain visibly swims.
// Force highp on the world varyings and the noise maths so it stays put.
varying highp vec3 vSurfWorldPos;
varying highp vec3 vSurfWorldNormal;
uniform highp vec3 uSurfSeed;
uniform float uSurfScale;
uniform float uSurfAlbedoVar;
uniform vec3  uSurfTint;
uniform float uSurfTintAmount;
uniform float uSurfAO;
uniform float uSurfBump;
uniform float uSurfRoughVar;
uniform float uSurfGrain;
uniform float uSurfGrainScale;
uniform vec3  uSurfGrainAxis;
uniform float uSurfTile;
uniform highp vec2 uSurfTileSize;
uniform float uSurfMortar;
uniform float uSurfTileBond;
uniform float uSurfTileRound;
uniform float uSurfTileJitter;
uniform vec3  uSurfMortarColor;
uniform float uSurfTileRelief;
uniform float uSurfCap;
uniform vec3  uSurfCapColor;
uniform float uSurfCapUp;
uniform float uSurfCapSharp;
uniform float uSurfCapRough;
uniform float uSurfGlow;
uniform vec3  uSurfGlowColor;
uniform float uSurfGlowThresh;

float scenaHash13(highp vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float scenaVNoise(highp vec3 x){
  highp vec3 i = floor(x); highp vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = scenaHash13(i + vec3(0.0,0.0,0.0));
  float n100 = scenaHash13(i + vec3(1.0,0.0,0.0));
  float n010 = scenaHash13(i + vec3(0.0,1.0,0.0));
  float n110 = scenaHash13(i + vec3(1.0,1.0,0.0));
  float n001 = scenaHash13(i + vec3(0.0,0.0,1.0));
  float n101 = scenaHash13(i + vec3(1.0,0.0,1.0));
  float n011 = scenaHash13(i + vec3(0.0,1.0,1.0));
  float n111 = scenaHash13(i + vec3(1.0,1.0,1.0));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
             mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
float scenaFbm(highp vec3 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++){ s += a * scenaVNoise(p); p *= 2.02; a *= 0.5; }
  return s;
}
// Triplanar fbm: blend three axis-projected samples by the world normal, so
// box faces need no UVs and adjacent boxes share one continuous field.
float scenaTri(highp vec3 wp, vec3 wn, float scale){
  highp vec3 p = wp * scale + uSurfSeed;
  vec3 w = abs(normalize(wn)); w = pow(w, vec3(4.0)); w /= (w.x + w.y + w.z + 1e-4);
  return scenaFbm(p.yzx) * w.x + scenaFbm(p.zxy) * w.y + scenaFbm(p.xyz) * w.z;
}
// Concentric grain rings around the grain axis, warped by noise.
float scenaGrain(highp vec3 wp){
  highp vec3 ax = normalize(uSurfGrainAxis);
  highp float along = dot(wp, ax);
  highp vec3 perp = wp - ax * along;
  highp float rings = length(perp) * uSurfGrainScale + scenaFbm(wp * uSurfGrainScale * 0.4) * 2.0;
  return abs(fract(rings) - 0.5) * 2.0; // triangle wave 0..1
}
// A masonry grid on the dominant-axis face (so box walls/floors/roofs get a
// clean 2D pattern and abutting boxes align). Running-bond rows, mortar bands
// and per-cell jitter. Returns: x = mortar mask (1 in the joint), y = per-cell
// hash (0..1), z = surface height (tile face high \u2192 joint low), w = the domed
// stone height for cobbles.
vec4 scenaTile(highp vec3 wp, vec3 wn){
  vec3 an = abs(normalize(wn));
  highp vec2 uv;
  if (an.x >= an.y && an.x >= an.z) uv = wp.zy;
  else if (an.y >= an.x && an.y >= an.z) uv = wp.xz;
  else uv = wp.xy;
  uv += uSurfSeed.xy;
  highp vec2 ts = max(uSurfTileSize, vec2(1e-3));
  highp float row = floor(uv.y / ts.y);
  highp float bond = mod(row, 2.0) * uSurfTileBond * 0.5;
  highp float cxf = uv.x / ts.x + bond;
  highp float col = floor(cxf);
  highp vec2 cell = vec2(col, row);
  highp float fx = fract(cxf);
  highp float fy = fract(uv.y / ts.y);
  // Distance to the nearest cell edge, in world units \u2192 mortar band.
  float ex = min(fx, 1.0 - fx) * ts.x;
  float ey = min(fy, 1.0 - fy) * ts.y;
  float edge = min(ex, ey);
  float m = max(uSurfMortar, 1e-4);
  float mortar = 1.0 - smoothstep(m, m * 1.7, edge);
  // Domed profile for cobbles: peaks at the cell centre, falls to the joint.
  float dome = clamp(1.0 - length(vec2(fx - 0.5, fy - 0.5)) * 2.0, 0.0, 1.0);
  float flatH = 1.0 - mortar;
  float height = mix(flatH, dome * (1.0 - mortar), uSurfTileRound);
  float h = scenaHash13(vec3(cell + vec2(3.1, 7.3), 5.0));
  return vec4(mortar, h, height, dome);
}
// Snow / moss cap: settles on up-facing surfaces, its edge broken up by the
// noise the shader already sampled (no extra noise cost). Returns 0..1.
float scenaCapMask(vec3 wn, float breakup){
  float up = normalize(wn).y * 0.5 + 0.5;      // 0 (down) .. 1 (up)
  float s = max(uSurfCapSharp, 1e-3);
  return clamp(smoothstep(uSurfCapUp - s, uSurfCapUp + s, up + (breakup - 0.5) * 0.6), 0.0, 1.0);
}
`;function yo(e){return e.replace("#include <common>",`#include <common>
varying highp vec3 vSurfWorldPos;
varying highp vec3 vSurfWorldNormal;`).replace("#include <begin_vertex>",`#include <begin_vertex>
      {
        vec4 scenaWP = modelMatrix * vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          scenaWP = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #endif
        vSurfWorldPos = scenaWP.xyz;
      }`).replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
      {
        vec3 scenaON = objectNormal;
        #ifdef USE_INSTANCING
          scenaON = mat3(instanceMatrix) * scenaON;
        #endif
        vSurfWorldNormal = normalize(mat3(modelMatrix) * scenaON);
      }`)}function vo(e){return e.replace("#include <common>",`#include <common>
`+wo).replace("#include <map_fragment>",`#include <map_fragment>
      float scenaN   = scenaTri(vSurfWorldPos, vSurfWorldNormal, uSurfScale);
      float scenaLow = scenaTri(vSurfWorldPos, vSurfWorldNormal, uSurfScale * 0.25);
      float scenaG   = scenaGrain(vSurfWorldPos);
      // masonry grid (no-op when uSurfTile == 0)
      vec4  scenaT   = scenaTile(vSurfWorldPos, vSurfWorldNormal);
      float scenaMortar = scenaT.x * uSurfTile;
      // fine mottle
      diffuseColor.rgb *= 1.0 + (scenaN - 0.5) * uSurfAlbedoVar;
      // per-cell brightness jitter, so no two bricks/stones read the same
      diffuseColor.rgb *= 1.0 + uSurfTileJitter * (scenaT.y - 0.5) * uSurfTile;
      // cavity ambient occlusion (dark where the low band is low)
      diffuseColor.rgb *= 1.0 - uSurfAO * (1.0 - scenaLow);
      // cavity tint
      diffuseColor.rgb = mix(diffuseColor.rgb, uSurfTint, uSurfTintAmount * (1.0 - scenaLow));
      // grain darkening (no-op when uSurfGrain == 0)
      diffuseColor.rgb *= 1.0 - uSurfGrain * scenaG * 0.5;
      // recessed mortar joint: to the mortar colour, shadowed in the groove
      diffuseColor.rgb = mix(diffuseColor.rgb, uSurfMortarColor, scenaMortar);
      diffuseColor.rgb *= 1.0 - 0.35 * scenaMortar;
      // snow / moss cap settling on the up-facing faces (over the mortar too)
      float scenaCapM = scenaCapMask(vSurfWorldNormal, scenaN) * uSurfCap;
      diffuseColor.rgb = mix(diffuseColor.rgb, uSurfCapColor, scenaCapM);`).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (scenaN - 0.5) * uSurfRoughVar + uSurfGrain * scenaG * 0.12
        + scenaMortar * 0.25 + (scenaT.y - 0.5) * uSurfTileJitter * 0.3 * uSurfTile, 0.04, 1.0);
      roughnessFactor = mix(roughnessFactor, uSurfCapRough, scenaCapM);`).replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
      {
        // three's perturbNormalArb, in view space, driven by the noise height
        // plus the tile relief (a step down into each mortar joint).
        float scenaH = scenaN + uSurfGrain * scenaG * 0.5 + scenaT.z * uSurfTile * uSurfTileRelief;
        vec3 sX = dFdx(-vViewPosition);
        vec3 sY = dFdy(-vViewPosition);
        vec3 sN = normal;
        vec3 R1 = cross(sY, sN);
        vec3 R2 = cross(sN, sX);
        float det = dot(sX, R1);
        vec3 grad = sign(det) * (dFdx(scenaH) * R1 + dFdy(scenaH) * R2);
        normal = normalize(abs(det) * sN - uSurfBump * grad);
      }`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
      {
        // Procedural glow (lava cracks, crystal): drawn straight into the
        // emissive radiance, NOT via material.emissive \u2014 so it burns constant
        // and the day/night cycle (which scales emissiveIntensity) can't dim
        // it. A no-op when uSurfGlow == 0. Glow fills the low-noise areas.
        float scenaGlow = smoothstep(uSurfGlowThresh + 0.16, uSurfGlowThresh - 0.16, scenaLow) * uSurfGlow;
        totalEmissiveRadiance += uSurfGlowColor * scenaGlow;
      }`)}function D(e,t={}){let a=go[e],n={...a,...t},o=t.seed??0,i=new ho({color:t.color??a.baseColor??10132122,roughness:n.roughness,metalness:n.metalness,flatShading:n.flat}),s={uSurfScale:{value:n.scale},uSurfAlbedoVar:{value:n.albedoVar},uSurfTint:{value:new Ee(n.tint)},uSurfTintAmount:{value:n.tintAmount},uSurfAO:{value:n.ao},uSurfBump:{value:n.bump},uSurfRoughVar:{value:n.roughVar},uSurfGrain:{value:n.grain},uSurfGrainScale:{value:n.grainScale},uSurfGrainAxis:{value:n.grainAxis.clone().normalize()},uSurfSeed:{value:new Vn(Math.sin(o*12.9898)*43.75,Math.cos(o*78.233)*51.13,Math.sin(o*37.719)*29.41)},uSurfTile:{value:n.tile??0},uSurfTileSize:{value:new po(n.tileW??.25,n.tileH??.1)},uSurfMortar:{value:n.mortar??.014},uSurfTileBond:{value:n.bond??1},uSurfTileRound:{value:n.round??0},uSurfTileJitter:{value:n.tileJitter??.12},uSurfMortarColor:{value:new Ee(n.mortarColor??3815994)},uSurfTileRelief:{value:n.tileRelief??.06},uSurfCap:{value:n.cap??0},uSurfCapColor:{value:new Ee(n.capColor??15922938)},uSurfCapUp:{value:n.capUp??.5},uSurfCapSharp:{value:n.capSharp??.28},uSurfCapRough:{value:n.capRough??.88},uSurfGlow:{value:n.glow??0},uSurfGlowColor:{value:new Ee(n.glowColor??16738858)},uSurfGlowThresh:{value:n.glowThreshold??.45}};return i.onBeforeCompile=c=>{Object.assign(c.uniforms,s),c.vertexShader=yo(c.vertexShader),c.fragmentShader=vo(c.fragmentShader),i.userData.scenaShader=c},i.customProgramCacheKey=()=>"scena-surface-v1",i.userData.scenaSurface=s,i}var Ln=7;function H(e,...t){return{advance:e,strokes:t.map(a=>a.flat())}}var Re=(e,t)=>[[e-.25,t],[e+.25,t],[e+.25,t+.5],[e-.25,t+.5],[e-.25,t]],Ct={" ":H(3),A:H(6,[[0,0],[2.75,7],[5.5,0]],[[1.15,2.6],[4.35,2.6]]),B:H(5.6,[[0,0],[0,7]],[[0,7],[3.5,7],[4.6,6.2],[4.6,4.7],[3.5,3.9],[0,3.9]],[[0,3.9],[3.9,3.9],[5,3],[5,.9],[3.9,0],[0,0]]),C:H(5.6,[[5.2,5.4],[4.1,6.7],[2.2,7],[.7,5.9],[0,4],[0,3],[.7,1.1],[2.2,0],[4.1,.3],[5.2,1.6]]),D:H(5.8,[[0,0],[0,7]],[[0,7],[2.8,7],[4.6,5.7],[5.2,3.5],[4.6,1.3],[2.8,0],[0,0]]),E:H(5.2,[[5,7],[0,7],[0,0],[5,0]],[[0,3.5],[3.6,3.5]]),F:H(5,[[5,7],[0,7],[0,0]],[[0,3.5],[3.4,3.5]]),G:H(6,[[5.2,5.4],[4.1,6.7],[2.2,7],[.7,5.9],[0,4],[0,3],[.7,1.1],[2.2,0],[4.2,.2],[5.2,1.4],[5.2,3],[3.2,3]]),H:H(5.6,[[0,0],[0,7]],[[5.4,0],[5.4,7]],[[0,3.6],[5.4,3.6]]),I:H(2,[[1,0],[1,7]]),J:H(4.6,[[4,7],[4,1.7],[3.2,.3],[1.9,0],[.7,.7],[0,2]]),K:H(5.4,[[0,0],[0,7]],[[5.2,7],[0,3.2]],[[1.7,4.3],[5.4,0]]),L:H(4.8,[[0,7],[0,0],[4.8,0]]),M:H(6.6,[[0,0],[0,7],[3.3,2.4],[6.6,7],[6.6,0]]),N:H(5.8,[[0,0],[0,7],[5.6,0],[5.6,7]]),O:H(6,[[2.3,7],[.8,6.1],[0,4],[0,3],[.8,.9],[2.3,0],[3.3,0],[4.8,.9],[5.6,3],[5.6,4],[4.8,6.1],[3.3,7],[2.3,7]]),P:H(5.4,[[0,0],[0,7]],[[0,7],[3.7,7],[4.8,6],[4.8,4.5],[3.7,3.6],[0,3.6]]),Q:H(6,[[2.3,7],[.8,6.1],[0,4],[0,3],[.8,.9],[2.3,0],[3.3,0],[4.8,.9],[5.6,3],[5.6,4],[4.8,6.1],[3.3,7],[2.3,7]],[[3.4,1.9],[5.8,-.5]]),R:H(5.6,[[0,0],[0,7]],[[0,7],[3.7,7],[4.8,6],[4.8,4.5],[3.7,3.6],[0,3.6]],[[2.7,3.6],[5.4,0]]),S:H(5.2,[[5,5.6],[3.9,6.8],[1.7,7],[.5,6],[.5,4.7],[1.5,3.9],[3.7,3.4],[4.7,2.6],[4.7,1],[3.5,0],[1.2,.2],[.2,1.4]]),T:H(5,[[0,7],[5,7]],[[2.5,7],[2.5,0]]),U:H(5.6,[[0,7],[0,2],[.8,.5],[2.6,0],[4.6,.5],[5.4,2],[5.4,7]]),V:H(5.6,[[0,7],[2.8,0],[5.6,7]]),W:H(7.4,[[0,7],[1.4,0],[3.7,5],[6,0],[7.4,7]]),X:H(5.4,[[0,0],[5.4,7]],[[0,7],[5.4,0]]),Y:H(5.4,[[0,7],[2.7,3.5],[5.4,7]],[[2.7,3.5],[2.7,0]]),Z:H(5.2,[[0,7],[5.2,7],[0,0],[5.2,0]]),0:H(5.4,[[2.1,7],[.7,6],[0,3.5],[.7,1],[2.1,0],[3.3,0],[4.7,1],[5.4,3.5],[4.7,6],[3.3,7],[2.1,7]],[[.9,1.3],[4.5,5.7]]),1:H(4,[[1,5.4],[2.6,7],[2.6,0]],[[.9,0],[4.2,0]]),2:H(5.2,[[.4,5.4],[1.1,6.5],[2.6,7],[4,6.7],[4.7,5.6],[4.6,4.3],[3.7,3.1],[.3,0],[5,0]]),3:H(5.2,[[.5,6.2],[2,7],[3.7,7],[4.7,6],[4.7,4.8],[3.6,3.8],[2.4,3.8]],[[3.6,3.8],[4.9,2.8],[4.9,1.1],[3.7,0],[1.8,0],[.3,1]]),4:H(5.2,[[3.7,0],[3.7,7],[0,2.4],[5,2.4]]),5:H(5.2,[[4.7,7],[.9,7],[.5,3.9],[1.6,4.5],[3.5,4.5],[4.7,3.5],[4.7,1.4],[3.5,.1],[1.6,.1],[.4,1.2]]),6:H(5.2,[[4.5,6],[3.1,7],[1.6,6.6],[.6,4.8],[.3,2.6],[.9,.8],[2.2,0],[3.6,.3],[4.6,1.5],[4.6,2.9],[3.6,4],[1.9,4.2],[.6,3.2]]),7:H(5.2,[[.4,7],[5,7],[2,0]]),8:H(5.4,[[2.6,3.8],[1.3,4.5],[1.3,5.9],[2.6,7],[3.9,7],[5.1,5.9],[5.1,4.5],[3.9,3.8],[2.6,3.8]],[[2.6,3.8],[1,3],[.5,1.6],[1.6,.2],[3.6,.2],[4.7,1.6],[4.2,3],[2.6,3.8]]),9:H(5.2,[[.7,1],[2.1,0],[3.6,.4],[4.6,2.2],[4.9,4.4],[4.3,6.2],[3,7],[1.6,6.7],[.6,5.5],[.6,4.1],[1.6,3],[3.3,2.8],[4.6,3.8]]),".":H(2,Re(.5,0)),",":H(2,[[.9,.6],[.9,0],[.2,-1]]),"'":H(2,[[.6,7],[.6,5.3]]),'"':H(3,[[.6,7],[.6,5.3]],[[1.9,7],[1.9,5.3]]),"!":H(2,[[.5,7],[.5,2]],Re(.5,0)),"?":H(4.8,[[.4,5.6],[1.1,6.6],[2.5,7],[3.7,6.6],[4.3,5.5],[4.1,4.3],[2.4,3.2],[2.4,2]],Re(2.4,0)),"-":H(4,[[.5,3.5],[3.5,3.5]]),"&":H(6,[[5.6,0],[2,3.6],[1,4.8],[1,5.9],[1.9,6.8],[3.1,6.6],[3.5,5.5],[3,4.4],[.6,1.6],[1.6,.1],[3.2,.1],[4.6,1.4],[5.2,2.9]]),":":H(2,Re(.5,3.9),Re(.5,.9)),"/":H(4,[[0,-.5],[3.6,7.2]]),"(":H(2.8,[[2.2,7.4],[.7,5],[.7,2],[2.2,-.4]]),")":H(2.8,[[.4,7.4],[1.9,5],[1.9,2],[.4,-.4]])},Mo=Ct[" "];function Hn(e){return Ct[e]??Ct[e.toUpperCase()]??Mo}function Dn(e,t){let a=0;for(let n=0;n<e.length;n++)a+=Hn(e[n]).advance+(n<e.length-1?t:0);return a}function _t(e,t={}){let a=t.size??.5,n=t.weight??.22,o=t.depth??a*.12,i=t.tracking??.6,s=t.align??"center",c=t.baseline??"center",l=a/Ln,r=n*a/2,f=Dn(e,i)*l,d=s==="center"?-f/2:s==="right"?-f:0,m=c==="center"?-a/2:0,h=[],p=[],g=0,v=(y,k)=>{let M=y.length/2;if(M<2)return;let x=new Float64Array(M),b=new Float64Array(M);for(let z=0;z<M;z++)x[z]=y[z*2]*l+k,b[z]=y[z*2+1]*l+m;let P=x[1]-x[0],I=b[1]-b[0],G=Math.hypot(P,I)||1e-6;x[0]-=P/G*r,b[0]-=I/G*r;let F=x[M-1]-x[M-2],V=b[M-1]-b[M-2],L=Math.hypot(F,V)||1e-6;x[M-1]+=F/L*r,b[M-1]+=V/L*r;let A=new Float64Array(M-1),T=new Float64Array(M-1);for(let z=0;z<M-1;z++){let R=x[z+1]-x[z],W=b[z+1]-b[z],_=Math.hypot(R,W)||1e-6;A[z]=R/_,T[z]=W/_}for(let z=0;z<M;z++){let R=z===0?0:z-1,W=z===M-1?M-2:z,_=-T[R]-T[W],j=A[R]+A[W],E=Math.hypot(_,j);E<1e-6&&(_=-T[W],j=A[W],E=1),_/=E,j/=E;let oe=r/Math.max(.35,_*-T[W]+j*A[W]),te=x[z]+_*oe,$=b[z]+j*oe,X=x[z]-_*oe,J=b[z]-j*oe;h.push(X,J,o,te,$,o,X,J,0,te,$,0)}let C=(z,R)=>g+z*4+R;for(let z=0;z<M-1;z++){let R=z+1;p.push(C(z,0),C(R,0),C(R,1),C(z,0),C(R,1),C(z,1)),p.push(C(z,2),C(R,3),C(R,2),C(z,2),C(z,3),C(R,3)),p.push(C(z,0),C(z,2),C(R,2),C(z,0),C(R,2),C(R,0)),p.push(C(z,1),C(R,3),C(z,3),C(z,1),C(R,1),C(R,3))}let B=M-1;p.push(C(0,0),C(0,1),C(0,3),C(0,0),C(0,3),C(0,2)),p.push(C(B,0),C(B,2),C(B,3),C(B,0),C(B,3),C(B,1)),g+=M*4},w=0;for(let y=0;y<e.length;y++){let k=Hn(e[y]),M=w*l+d;for(let x of k.strokes)v(x,M);w+=k.advance+i}let S=new xo;return S.setAttribute("position",new bo(new Float32Array(h),3)),S.setIndex(p),S.computeVertexNormals(),S.computeBoundingBox(),S.computeBoundingSphere(),{geometry:S,width:f,height:a}}function Vt(e,t={}){let a=t.size??.5,n=t.tracking??.6;return Dn(e,n)*(a/Ln)}var Si=["pine","oak","cypress","birch","cedar","maple","sakura","palm","willow","sequoia","banyan","baobab","acacia"];function q(e){return new Co({color:e,flatShading:!0})}function re(e,t,a){return new Yt(e).lerp(new Yt(t),a).getHex()}function Ao(e,t,a,n,o,i){let c=a/7,l=0;for(let r=0;r<7;r++){let u=r/7,f=n+(o-n)*u,d=n+(o-n)*((r+1)/7);l=i*u*u;let m=new N(new ie(d,f,c*1.04,6),t);m.position.set(l,c*(r+.5),0),m.rotation.z=-i*.12,e.add(m)}return{x:i,y:a}}function ko(e,t,a,n,o,i,s,c){let l=c*Math.PI/180;for(let r=0;r<i;r++){let u=r/i*Math.PI*2+a.range(-.12,.12),f=new Nn,d=s*.13,m=new N(new Le(d,s,4),t);m.rotation.z=-Math.PI/2,m.position.x=s*.5,m.scale.z=.28,f.add(m),f.position.set(n,o,0),f.rotation.y=u,f.rotation.z=-(l+a.range(-.14,.14)),e.add(f)}}function zo(e,t,a,n,o,i,s,c){for(let l=0;l<i;l++){let r=l/i*Math.PI*2+a.range(-.12,.12),u=o*a.range(.78,1.02),f=Math.min(a.range(s,c),n-.4);if(f<=.3)continue;let d=new N(new So(.12,f,.12),t);d.position.set(Math.cos(r)*u,n-f/2,Math.sin(r)*u),d.rotation.y=-r,d.rotation.z=a.range(-.08,.08),e.add(d)}}function Io(e,t,a,n,o,i){for(let s=0;s<o;s++){let c=s/o*Math.PI*2+a.range(-.25,.25),l=new N(new ie(.025,.055,i,5),t);l.position.set(Math.cos(c)*i*.28,n+i*.34,Math.sin(c)*i*.28),l.rotation.set(-Math.sin(c)*.7,0,Math.cos(c)*.7),e.add(l)}}function Po(e,t,a,n,o,i){let s=new N(new ie(i,o,n,9),t);s.position.y=n/2,e.add(s);let c=6;for(let l=0;l<c;l++){let r=l/c*Math.PI*2,u=new N(new Le(o*.5,n*.16,4),t);u.position.set(Math.cos(r)*o*.65,n*.05,Math.sin(r)*o*.65),u.rotation.set(-Math.sin(r)*.35,0,Math.cos(r)*.35),u.scale.z=.5,e.add(u)}}function To(e,t,a,n,o){let i=n*.68,s=new N(new ie(o*.62,o,i*.66,8),t);s.position.y=i*.33,e.add(s);let c=new N(new ie(o*.28,o*.62,i*.34,8),t);c.position.y=i*.66+i*.17,e.add(c);let l=a.int(3,5);for(let r=0;r<l;r++){let u=r/l*Math.PI*2+a.range(-.2,.2),f=new N(new ie(.05,.11,n*.22,5),t);f.position.set(Math.cos(u)*o*.3,i+n*.06,Math.sin(u)*o*.3),f.rotation.set(-Math.sin(u)*.9,0,Math.cos(u)*.9),e.add(f)}return i+n*.12}function Go(e,t,a,n,o,i){for(let s=0;s<i;s++){let c=s/i*Math.PI*2+a.range(-.2,.2),l=o*a.range(.45,1),r=n-.02,u=new N(new ie(a.range(.04,.08),a.range(.07,.13),r,5),t);u.position.set(Math.cos(c)*l,r/2,Math.sin(c)*l),u.rotation.z=a.range(-.06,.06),u.rotation.x=a.range(-.06,.06),e.add(u)}}var Ro={pine:{heightRange:[3.2,5.2],stiffness:2.4,anchorFrac:.22,obstacleRadius:.5,build(e,t,a,n){let o=q(a.trunk),i=q(t.pick(a.foliage)),s=n*.25,c=new N(new ie(.09,.14,s,6),o);c.position.y=s/2,e.add(c);let l=t.int(3,4),r=s,u=n*t.range(.24,.3),f=(n-s)/l+.15;for(let d=0;d<l;d++){let m=new N(new Le(u,f*1.35,7),i);m.position.y=r+f*.55,m.rotation.y=t.range(0,Math.PI),e.add(m),r+=f*.8,u*=.72}return i}},oak:{heightRange:[3.2,5.2],stiffness:2.4,anchorFrac:.22,obstacleRadius:.6,build(e,t,a,n){let o=q(a.trunk),i=q(t.pick(a.foliage)),s=n*.45,c=new N(new ie(.12,.2,s,6),o);c.position.y=s/2,c.rotation.z=t.range(-.08,.08),e.add(c);let l=t.int(2,4);for(let r=0;r<l;r++){let u=n*t.range(.18,.28),f=new N(new ce(u,0),i);f.position.set(t.jitter(0,n*.16),s+u*t.range(.5,.9)+r*u*.35,t.jitter(0,n*.16)),f.rotation.set(t.range(0,Math.PI),t.range(0,Math.PI),0),e.add(f)}return i}},cypress:{heightRange:[6,10],stiffness:3.4,anchorFrac:.32,obstacleRadius:.35,build(e,t,a,n){let o=q(a.trunk),i=q(re(t.pick(a.foliage),1194532,.5)),s=n*.14,c=new N(new ie(.07,.11,s,6),o);c.position.y=s/2,e.add(c);let l=n*.075,r=s*.6,u=n-r,f=Math.max(7,Math.round(u/(l*1.4))),d=u/f;for(let h=0;h<f;h++){let p=h/(f-1),g=Math.max(.05,l*(.55+.7*Math.pow(1-p,.8))*(.6+.4*Math.sin(p*Math.PI))),v=new N(new ce(g,0),i);v.position.set(t.jitter(0,l*.12),r+h*d+d*.5,t.jitter(0,l*.12)),v.scale.y=1.5,v.rotation.set(t.range(0,Math.PI),t.range(0,Math.PI),t.range(0,Math.PI)),e.add(v)}let m=new N(new Le(l*.7,u*.22,6),i);return m.position.y=r+u+u*.02,e.add(m),i}},birch:{heightRange:[4,7],stiffness:1.5,anchorFrac:.45,obstacleRadius:.32,build(e,t,a,n){let o=q(15131350),i=q(4867390),s=q(re(t.pick(a.foliage),13821594,.4)),c=n*.72,l=new N(new ie(.05,.08,c,6),o);l.position.y=c/2,l.rotation.z=t.range(-.04,.04),e.add(l);let r=t.int(2,4);for(let d=0;d<r;d++){let m=new N(new ie(.076,.076,.05,6),i);m.position.y=t.range(c*.15,c*.8),e.add(m)}let u=c*.85,f=t.int(3,5);for(let d=0;d<f;d++){let m=n*t.range(.12,.19),h=new N(new ce(m,0),s);h.position.set(t.jitter(0,n*.14),u+t.range(0,n*.22),t.jitter(0,n*.14)),h.rotation.set(t.range(0,Math.PI),t.range(0,Math.PI),0),e.add(h)}return s}},cedar:{heightRange:[4,6],stiffness:2.8,anchorFrac:.3,obstacleRadius:.75,build(e,t,a,n){let o=q(a.trunk),i=q(re(t.pick(a.foliage),3828568,.45)),s=n*.32,c=new N(new ie(.13,.22,s,6),o);c.position.y=s/2,e.add(c);let l=t.int(3,4),r=s*.8,u=n-r,f=n*t.range(.4,.5);for(let d=0;d<l;d++){let m=l>1?d/(l-1):0,h=f*(1-m*.45),p=new N(new ce(h,0),i);p.position.set(t.jitter(0,f*.1),r+m*u*.9,t.jitter(0,f*.1)),p.scale.y=.3,p.rotation.y=t.range(0,Math.PI),e.add(p)}return i}},maple:{heightRange:[3.5,5.5],stiffness:2.2,anchorFrac:.24,obstacleRadius:.65,build(e,t,a,n){let o=q(a.trunk),i=q(re(t.pick(a.foliage),8824890,.2)),s=n*.4,c=new N(new ie(.12,.19,s,6),o);c.position.y=s/2,c.rotation.z=t.range(-.05,.05),e.add(c);let l=s+n*.12,r=n*t.range(.28,.34),u=new N(new ce(r,1),i);u.position.y=l,u.rotation.set(t.range(0,Math.PI),t.range(0,Math.PI),0),e.add(u);let f=t.int(4,6);for(let d=0;d<f;d++){let m=d/f*Math.PI*2+t.range(-.2,.2),h=r*t.range(.55,.75),p=new N(new ce(h,0),i);p.position.set(Math.cos(m)*r*.75,l-r*.15+t.range(-.1,.2),Math.sin(m)*r*.75),p.rotation.set(t.range(0,Math.PI),t.range(0,Math.PI),0),e.add(p)}return i}},sakura:{heightRange:[3,4.6],stiffness:2,anchorFrac:.3,obstacleRadius:.7,build(e,t,a,n,o){let i=o??"spring",s=q(re(a.trunk,3023648,.4)),c=n*.4,l=new N(new ie(.1,.16,c,6),s);l.position.y=c/2,l.rotation.z=t.range(-.06,.06),e.add(l),Io(e,s,t,c,t.int(4,6),n*.5);let r=i==="summer"?re(t.pick(a.foliage),8368202,.2):i==="autumn"?re(t.pick(a.foliage),14715450,.7):re(15974870,16640753,t.range(0,.4)),u=q(r);if(i!=="winter"){let f=c+n*.16,d=n*t.range(.34,.4),m=new N(new ce(d,1),u);m.position.y=f,m.scale.y=.55,e.add(m);let h=t.int(5,7);for(let p=0;p<h;p++){let g=p/h*Math.PI*2+t.range(-.2,.2),v=d*t.range(.5,.72),w=new N(new ce(v,0),u);w.position.set(Math.cos(g)*d*.8,f-d*.1+t.range(-.05,.1),Math.sin(g)*d*.8),w.scale.y=.6,e.add(w)}}return u}},palm:{heightRange:[5,8],stiffness:1.2,anchorFrac:.7,obstacleRadius:.4,build(e,t,a,n){let o=q(re(10255182,a.trunk,.3)),i=Ao(e,o,n*.86,.16,.1,n*.12),s=q(re(t.pick(a.foliage),5148474,.3));ko(e,s,t,i.x,i.y,t.int(9,13),n*.42,24);let c=q(7031343),l=t.int(2,4);for(let r=0;r<l;r++){let u=r/l*Math.PI*2,f=new N(new ce(n*.045,0),c);f.position.set(i.x+Math.cos(u)*.12,i.y-.12,Math.sin(u)*.12),e.add(f)}return s}},willow:{heightRange:[4,6],stiffness:1.5,anchorFrac:.05,obstacleRadius:.7,build(e,t,a,n){let o=q(a.trunk),i=n*.42,s=new N(new ie(.12,.2,i,6),o);s.position.y=i/2,s.rotation.z=t.range(-.05,.05),e.add(s);let c=q(re(t.pick(a.foliage),11980654,.4)),l=i+n*.22,r=n*t.range(.32,.4),u=new N(new ce(r,1),c);return u.position.y=l,u.scale.y=.7,e.add(u),zo(e,c,t,l-r*.35,r*.95,t.int(30,38),n*.42,n*.72),c}},sequoia:{heightRange:[22,32],stiffness:4,anchorFrac:.5,obstacleRadius:e=>e*.06,build(e,t,a,n){let o=q(9063218),i=q(re(t.pick(a.foliage),2050612,.5)),s=n*.075;Po(e,o,t,n*.55,s,s*.4);let c=t.int(5,7),l=n*.42,r=n*t.range(.16,.2),u=(n-l)/c+.4;for(let f=0;f<c;f++){let d=new N(new Le(r,u*1.4,8),i);d.position.y=l+u*.55,d.rotation.y=t.range(0,Math.PI),e.add(d),l+=u*.82,r*=.74}return i}},banyan:{heightRange:[5,8],stiffness:3,anchorFrac:.3,obstacleRadius:e=>e*.3,build(e,t,a,n){let o=q(re(a.trunk,4862752,.3)),i=q(re(t.pick(a.foliage),1923642,.35)),s=n*.4,c=new N(new ie(n*.09,n*.15,s,8),o);c.position.y=s/2,e.add(c);let l=s+n*.2,r=n*t.range(.5,.62),u=new N(new ce(r,1),i);u.position.y=l,u.scale.y=.62,e.add(u);let f=t.int(6,9);for(let d=0;d<f;d++){let m=d/f*Math.PI*2+t.range(-.15,.15),h=r*t.range(.45,.65),p=new N(new ce(h,0),i);p.position.set(Math.cos(m)*r*.85,l-r*.12+t.range(-.1,.15),Math.sin(m)*r*.85),p.scale.y=.7,e.add(p)}return Go(e,o,t,l-r*.3,r*.7,t.int(7,11)),i}},baobab:{heightRange:[5,8],stiffness:3.5,anchorFrac:.55,obstacleRadius:e=>e*.16,build(e,t,a,n){let o=q(re(a.trunk,9405042,.5)),i=q(re(t.pick(a.foliage),7309882,.3)),s=To(e,o,t,n,n*.19),c=t.int(4,6);for(let l=0;l<c;l++){let r=l/c*Math.PI*2+t.range(-.3,.3),u=n*t.range(.12,.18),f=new N(new ce(u,0),i);f.position.set(Math.cos(r)*n*.22,s+t.range(0,n*.1),Math.sin(r)*n*.22),f.scale.y=.7,e.add(f)}return i}},acacia:{heightRange:[4,6],stiffness:2.5,anchorFrac:.4,obstacleRadius:.5,build(e,t,a,n){let o=q(re(a.trunk,6967344,.3)),i=q(re(t.pick(a.foliage),9412682,.35)),s=n*.62,c=new N(new ie(.06,.13,s,6),o);c.position.y=s/2,c.rotation.z=t.range(-.05,.05),e.add(c);let l=s+n*.08,r=n*t.range(.5,.6),u=t.int(3,4);for(let f=0;f<u;f++){let d=r*(1-f*.16),m=new N(new ce(d,0),i);m.position.set(t.jitter(0,r*.12),l+f*n*.05,t.jitter(0,r*.12)),m.scale.y=.22,m.rotation.y=t.range(0,Math.PI),e.add(m)}return i}}};function Lt(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.species??e.style??(t.next()<.6?"pine":"oak"),o=Ro[n],i=e.height??t.range(o.heightRange[0],o.heightRange[1]),s=new Nn;s.name=`tree-${n}`;let c=o.build(s,t,a,i,e.season);(c.userData??(c.userData={})).scenaFoliage=!0,e.wind&&(e.wind.bind(c,{height:i,stiffness:o.stiffness,anchor:i*o.anchorFrac}),e.wind.attach(s));let l=typeof o.obstacleRadius=="function"?o.obstacleRadius(i):o.obstacleRadius;return{object:s,obstacleRadius:l}}var Bo={temperate:[{species:"oak",weight:4},{species:"pine",weight:3},{species:"birch",weight:2},{species:"maple",weight:2}],boreal:[{species:"pine",weight:5},{species:"cedar",weight:2},{species:"birch",weight:2}],mediterranean:[{species:"cypress",weight:3},{species:"oak",weight:3},{species:"pine",weight:2}],tropical:[{species:"palm",weight:5},{species:"banyan",weight:1}],savanna:[{species:"acacia",weight:4},{species:"baobab",weight:1}],redwood:[{species:"sequoia",weight:1},{species:"pine",weight:4},{species:"cedar",weight:2}],grove:[{species:"sakura",weight:1}],wetland:[{species:"willow",weight:3},{species:"birch",weight:2}]};function Ci(e,t={}){return Bo[e].map(({species:a,weight:n})=>({create:o=>Lt({species:a,seed:o.int(1,1e9),palette:t.palette,season:t.season}),weight:n,variants:t.variants??4}))}var jn={sequoia:{profile:"conifer",canopyBase:.4,belly:0,taper:1.25,trunkHalf:.09,trunkTaper:.35,widthRatio:.34},banyan:{profile:"round",canopyBase:.26,belly:.55,taper:1.6,trunkHalf:.12,trunkTaper:.1,widthRatio:1.1},baobab:{profile:"bottle",canopyBase:.72,belly:.5,taper:1.4,trunkHalf:.22,trunkTaper:.55,widthRatio:.62},acacia:{profile:"umbrella",canopyBase:.58,belly:.9,taper:2.2,trunkHalf:.05,trunkTaper:.25,widthRatio:1},pine:{profile:"conifer",canopyBase:.22,belly:0,taper:1.4,trunkHalf:.06,trunkTaper:.3,widthRatio:.5},oak:{profile:"round",canopyBase:.42,belly:.5,taper:1.5,trunkHalf:.08,trunkTaper:.15,widthRatio:.62},cypress:{profile:"column",canopyBase:.12,belly:.35,taper:1.1,trunkHalf:.05,trunkTaper:.2,widthRatio:.22},maple:{profile:"round",canopyBase:.4,belly:.5,taper:1.5,trunkHalf:.08,trunkTaper:.15,widthRatio:.68}},Lo=jn.oak,Ho={sequoia:27,banyan:6.5,baobab:6.5,acacia:5,pine:4.2,oak:4.2,cypress:8,maple:4.5};function Do(e,t,a){let n=new Qe(a.pick(t.foliage)),o={sequoia:2050612,banyan:1923642,baobab:7309882,acacia:9412682,cypress:1194532,maple:8824890,pine:3104042,oak:4160815},i=e&&o[e]!==void 0?new Qe(o[e]):null;return i?n.lerp(i,.4).getHex():n.getHex()}var Kt=`
uniform float uImpWidth;
uniform float uImpHeight;
uniform vec3  uImpFoliage;
uniform vec3  uImpTrunk;
uniform float uImpCanopyBase;
uniform float uImpBelly;
uniform float uImpTaper;
uniform float uImpTrunkHalf;
uniform float uImpTrunkTaper;
uniform float uImpSeed;
varying vec2  vImpUv;
`,No=`
vec4 mvPosition = vec4( transformed, 1.0 );
{
  mat4 scenaInst = mat4(1.0);
  #ifdef USE_INSTANCING
    scenaInst = instanceMatrix;
  #endif
  mat4 scenaWM = modelMatrix * scenaInst;
  vec3 scenaAnchor = scenaWM[3].xyz;
  float scenaScl = length(scenaWM[0].xyz);
  vec3 scenaRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
  vec3 scenaUp = vec3(0.0, 1.0, 0.0);
  vec3 scenaWorld = scenaAnchor
    + scenaRight * (position.x * uImpWidth * scenaScl)
    + scenaUp    * (position.y * uImpHeight * scenaScl);
  mvPosition = viewMatrix * vec4(scenaWorld, 1.0);
}
gl_Position = projectionMatrix * mvPosition;
`,jo=`
{
  float ix = vImpUv.x - 0.5;      // -0.5 \u2026 0.5 across
  float iy = vImpUv.y;            // 0 base \u2026 1 top
  float inside = 0.0;
  vec3  impCol = uImpTrunk;

  // Canopy: width peaks at the belly and tapers away, with a little edge wobble.
  if (iy >= uImpCanopyBase) {
    float t = (iy - uImpCanopyBase) / max(1.0 - uImpCanopyBase, 1e-3);
    float above = t - uImpBelly;
    float span = above > 0.0 ? (1.0 - uImpBelly) : uImpBelly;
    float k = clamp(1.0 - abs(above) / max(span, 1e-3), 0.0, 1.0);
    float w = 0.5 * pow(k, uImpTaper);
    w += 0.03 * sin(iy * 34.0 + uImpSeed) * step(0.02, w); // ragged edge
    if (abs(ix) < w) {
      inside = 1.0;
      float shade = 1.0 - 0.4 * (abs(ix) / max(w, 1e-3)); // rounder toward the edge
      impCol = uImpFoliage * (0.82 + 0.32 * iy) * shade;
    }
  }
  // Trunk: a tapering bar up to (and a little into) the canopy.
  float trunkTop = uImpCanopyBase + 0.08;
  if (iy < trunkTop) {
    float th = uImpTrunkHalf * (1.0 - uImpTrunkTaper * iy);
    if (abs(ix) < th) {
      inside = 1.0;
      impCol = uImpTrunk * (0.7 + 0.4 * iy);
    }
  }
  if (inside < 0.5) discard;
  diffuseColor.rgb = impCol;
}
`;function Oo(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.species&&jn[e.species]||Lo,o=e.height??(e.species?Ho[e.species]??5:5),i=e.width??o*n.widthRatio,s=new Qe(e.foliage??Do(e.species,a,t)),c=new Qe(e.trunk??a.trunk),l={uImpWidth:{value:i},uImpHeight:{value:o},uImpFoliage:{value:s},uImpTrunk:{value:c},uImpCanopyBase:{value:n.canopyBase},uImpBelly:{value:n.belly},uImpTaper:{value:n.taper},uImpTrunkHalf:{value:n.trunkHalf},uImpTrunkTaper:{value:n.trunkTaper},uImpSeed:{value:t.range(0,100)}},r=new Vo(1,1).translate(0,.5,0),u=new _o({fog:!0});u.onBeforeCompile=h=>{Object.assign(h.uniforms,l),h.vertexShader=h.vertexShader.replace("#include <common>",`#include <common>
`+Kt).replace("#include <begin_vertex>",`#include <begin_vertex>
  vImpUv = vec2(position.x + 0.5, position.y);`).replace("#include <project_vertex>",No),h.fragmentShader=h.fragmentShader.replace("#include <common>",`#include <common>
`+Kt).replace("#include <color_fragment>",`#include <color_fragment>
`+jo)},u.customProgramCacheKey=()=>"scena-impostor-v1";let f=new Wo(r,u);f.frustumCulled=!1;let d=new Fo;d.name=`impostor-${e.species??n.profile}`,d.add(f);let m=e.species?e.species==="sequoia"?o*.06:e.species==="banyan"?o*.3:e.species==="baobab"?o*.16:i*.35:i*.35;return{object:d,obstacleRadius:m}}function ki(e,t={}){let{weight:a,variants:n,scale:o,...i}=t;return{create:s=>Lt({...i,species:e,seed:s.int(1,1e9)}),createFar:s=>Oo({species:e,palette:i.palette,seed:s.int(1,1e9)}),weight:a??1,variants:n??4,scale:o??[.85,1.2]}}function Ko(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.size??t.range(.4,1.1),o=new Uo(n,0),i=o.getAttribute("position"),s=new Map;for(let r=0;r<i.count;r++){let u=`${i.getX(r).toFixed(4)},${i.getY(r).toFixed(4)},${i.getZ(r).toFixed(4)}`,f=s.get(u);f||(f=[t.jitter(0,n*.22),t.jitter(0,n*.16),t.jitter(0,n*.22)],s.set(u,f)),i.setXYZ(r,i.getX(r)+f[0],Math.max(i.getY(r)+f[1],-n*.15),i.getZ(r)+f[2])}o.computeVertexNormals();let c=new Yo(o,D("stone",{color:t.pick(a.rock),seed:e.seed??1}));c.position.y=n*.15,c.scale.y=t.range(.6,.9);let l=new Eo;return l.name="rock",l.add(c),{object:l,obstacleRadius:n*1.05}}function Ht(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.size??1,o=e.weathering??.3,i=new $o;i.name="crate";let s=D("plank",{color:a.wood,seed:e.seed??1});s.color.offsetHSL(0,0,-t.range(0,o*.18));let c=D("wood",{color:a.woodDark,seed:(e.seed??1)+3}),l=new ct(new it(n*.92,n*.92,n*.92),s);l.position.y=n/2,i.add(l);let r=n*.12,u=n*1;for(let f of[r/2,n-r/2])for(let[d,m,h,p]of[[0,n/2-r/2,u,r],[0,-(n/2-r/2),u,r],[n/2-r/2,0,r,u],[-(n/2-r/2),0,r,u]]){let g=new ct(new it(h,r,p),c);g.position.set(d,f,m),i.add(g)}for(let f of[-1,1])for(let d of[-1,1]){let m=new ct(new it(r,n,r),c);m.position.set(f*(n/2-r/2),n/2,d*(n/2-r/2)),i.add(m)}return i.rotation.y=t.range(0,Math.PI/2),{object:i,obstacleRadius:n*.75}}function Jo(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.length??6,o=e.postSpacing??1.5,i=e.height??1.1,s=new Xo;s.name="fence";let c=new qt({color:a.woodDark,flatShading:!0}),l=new qt({color:a.wood,flatShading:!0}),r=Math.max(2,Math.round(n/o)+1),u=n/(r-1);for(let f=0;f<r;f++){let d=new $t(new Zo(.06,.075,i,5),c);d.position.set(-n/2+f*u,i/2,t.jitter(0,.03)),d.rotation.z=t.range(-.04,.04),s.add(d)}for(let f of[i*.55,i*.85]){let d=new $t(new qo(n,.07,.05),l);d.position.y=t.jitter(f,.02),d.rotation.x=t.range(-.02,.02),s.add(d)}return{object:s,obstacleRadius:n/2}}function On(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.height??t.range(2.6,3.1),o=new ta;o.name="lamp";let i=new Zt({color:a.metal,flatShading:!0}),s=new lt(new ea(.05,.08,n,6),i);s.position.y=n/2,o.add(s);let c=new lt(new Qo(.34,.26,.34),i);c.position.y=n+.1,o.add(c);let l=new lt(new oa(.11,8,6),new Zt({color:a.lampGlow,emissive:a.lampGlow,emissiveIntensity:1.6}));if(l.position.y=n-.03,o.add(l),e.light){let r=new na(a.lampGlow,e.lightIntensity??6,12,1.8);r.position.y=n-.05,o.add(r)}return{object:o,obstacleRadius:.25}}function ra(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.blades??t.int(4,6),o=new En;o.name="grass";let i=new Yn({color:t.next()<.5?a.grassHigh:t.pick(a.foliage),flatShading:!0});for(let s=0;s<n;s++){let c=t.range(.25,.5),l=new Un(new aa(.035,c,3),i);l.position.set(t.jitter(0,.12),c/2,t.jitter(0,.12)),l.rotation.set(t.range(-.25,.25),t.range(0,Math.PI),t.range(-.25,.25)),o.add(l)}return e.wind&&e.wind.sway(o,{height:.5,stiffness:1.2,anchor:.04}),{object:o,obstacleRadius:0}}function ia(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.size??t.range(.4,.7),o=new En;o.name="bush";let i=new Yn({color:t.pick(a.foliage),flatShading:!0}),s=t.int(2,3);for(let c=0;c<s;c++){let l=n*t.range(.55,.85),r=new Un(new sa(l,0),i);r.position.set(t.jitter(0,n*.4),l*.7,t.jitter(0,n*.4)),r.scale.y=t.range(.7,.85),r.rotation.y=t.range(0,Math.PI),o.add(r)}return e.wind&&e.wind.sway(o,{height:n,stiffness:2.2,anchor:n*.25}),{object:o,obstacleRadius:n*.6}}function $n(e,t,a){let n=e/2,o=a/2,i=new Float32Array([-n,0,o,n,0,o,0,t,o,n,0,-o,-n,0,-o,0,t,-o,-n,0,-o,-n,0,o,0,t,o,-n,0,-o,0,t,o,0,t,-o,n,0,o,n,0,-o,0,t,-o,n,0,o,0,t,-o,0,t,o,-n,0,-o,n,0,-o,n,0,o,-n,0,-o,n,0,o,-n,0,o]),s=new la;return s.setAttribute("position",new ca(i,3)),s.computeVertexNormals(),s}var ua=["plaster","plaster","plaster","brick","ashlar"],fa=["tile","tile","shingle","thatch"];function da(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.width??t.range(3.2,4.2),o=e.depth??n*t.range(.75,.9),i=e.wallHeight??t.range(2.1,2.4),s=new ot;s.name="house";let c=e.seed??1,l=e.wall??t.pick(ua),r=e.roof??t.pick(fa),u=l==="brick"?10373684:l==="ashlar"?a.rock[0]:a.wall,f=D(l,{color:u,seed:c});f.color.offsetHSL(0,0,t.range(-.03,.03));let d=r==="thatch"?11770460:r==="shingle"?a.woodDark:a.roof,m=D(r,{color:d,seed:c+7});m.color.offsetHSL(0,0,t.range(-.04,.04));let h=D("stone",{color:a.rock[0],seed:c+13}),p=D("plank",{color:a.woodDark,seed:c+21}),g=new ee(new de(n+.3,1.6,o+.3),h);g.position.y=-.55,s.add(g);let v=new ee(new de(n,i,o),f);v.position.y=i/2,s.add(v);let w=n*t.range(.32,.4),S=new ee($n(n+.5,w,o+.6),m);S.position.y=i-.02,s.add(S);let y=new ee(new de(.34,w+.8,.34),h);y.position.set(t.pick([-1,1])*n*.22,i+w*.45,o*.12),s.add(y);let k=new ee(new de(.85,1.5,.08),p);k.position.set(t.range(-.4,.4),.75,o/2+.02),s.add(k);let M=new Kn({color:a.lampGlow,emissive:a.lampGlow,emissiveIntensity:1}),x=new de(.6,.62,.08),b=new ee(x,M);b.position.set(k.position.x<0?n*.28:-n*.28,1.35,o/2+.02),s.add(b);for(let P of[-1,1]){if(t.next()<.35)continue;let I=new ee(x,M);I.position.set(P*(n/2+.02),1.35,t.range(-.3,.3)*o),I.rotation.y=Math.PI/2,s.add(I)}return{object:s,obstacleRadius:Math.hypot(n+.5,o+.5)/2}}function ma(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.height??t.range(4.2,5.2),o=new ot;o.name="tower";let i=e.seed??1,s=D("wood",{color:a.wood,seed:i}),c=D("wood",{color:a.woodDark,seed:i+9}),l=D("tile",{color:a.roof,seed:i+17}),r=1;for(let d of[-1,1])for(let m of[-1,1]){let h=new ee(new be(.09,.12,n,6),c);h.position.set(d*r*.75,n/2-.6,m*r*.75),h.rotation.z=-d*.1,h.rotation.x=m*.1,o.add(h)}for(let d of[.3,.62]){let m=new ee(new de(r*2.1,.09,.07),s);m.position.set(0,n*d,r*.82*(1-d*.35)),m.rotation.z=t.pick([-.5,.5]),o.add(m);let h=new ee(new de(.07,.09,r*2.1),s);h.position.set(r*.82*(1-d*.35),n*d,0),h.rotation.x=t.pick([-.5,.5]),o.add(h)}let u=new ee(new de(r*2.2,.14,r*2.2),s);u.position.y=n-.5,o.add(u);for(let d of[-1,1])for(let m of[-1,1]){let h=new ee(new de(.08,.9,.08),c);h.position.set(d*r*1,n-.05,m*r*1),o.add(h)}for(let[d,m,h,p]of[[0,1,r*2.1,.06],[0,-1,r*2.1,.06],[1,0,.06,r*2.1],[-1,0,.06,r*2.1]]){let g=new ee(new de(h,.07,p),s);g.position.set(d*r,n+.28,m*r),o.add(g)}let f=new ee(new be(0,r*1.55,1,4),l);return f.position.y=n+1.15,f.rotation.y=Math.PI/4,o.add(f),{object:o,obstacleRadius:r*1.35}}function ha(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=new ot;n.name="well";let o=e.seed??1,i=D("stone",{color:t.pick(a.rock),seed:o,cap:.4,capColor:4479534,capUp:.5}),s=D("wood",{color:a.woodDark,seed:o+5}),c=D("tile",{color:a.roof,seed:o+11}),l=new ee(new be(.85,.95,.75,10),i);l.position.y=.375,n.add(l);let r=new ee(new be(.62,.62,.05,10),new Kn({color:1450542}));r.position.y=.76,n.add(r);for(let h of[-1,1]){let p=new ee(new be(.06,.075,1.9,5),s);p.position.set(h*.72,.95,0),n.add(p)}let u=new ee(new be(.045,.045,1.5,5),s);u.rotation.z=Math.PI/2,u.position.y=1.72,n.add(u);let f=new ee($n(2,.55,.65),c);f.position.y=1.86,f.rotation.y=Math.PI/2,n.add(f);let d=new ee(new be(.012,.012,.6,4),s);d.position.y=1.42,n.add(d);let m=new ee(new be(.13,.1,.2,7),s);return m.position.y=1.05,n.add(m),{object:n,obstacleRadius:1}}function pa(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.size??t.range(3.5,5),o=n*t.range(.7,.9),i=new ot;i.name="ruin";let s=e.mossy??!0,c=D("stone",{color:t.pick(a.rock),seed:e.seed??1,...s?{cap:.6,capColor:4282922,capUp:.3,capSharp:.32}:{}});c.color.offsetHSL(0,0,t.range(-.04,.02));let l=.35,r=[[0,-o/2,n,!0],[-n/2,0,o,!1],[n/2,0,o,!1],[n*.3,o/2,n*.35,!0]];for(let[f,d,m,h]of r){let p=Math.max(2,Math.round(m/1.1)),g=m/p;for(let v=0;v<p;v++){if(t.next()<.22)continue;let w=t.range(.5,2.2),S=new ee(new de(h?g*.96:l,w,h?l:g*.96),c),y=-m/2+g*(v+.5);S.position.set(h?f+y:f,w/2,h?d:d+y),S.rotation.y=t.range(-.03,.03),i.add(S)}}let u=t.int(4,7);for(let f=0;f<u;f++){let d=t.range(.25,.55),m=new ee(new de(d,d*t.range(.6,1),d*t.range(.7,1.2)),c);m.position.set(t.range(-n*.6,n*.6),d*.3,t.range(-o*.6,o*.7)),m.rotation.set(t.range(-.3,.3),t.range(0,Math.PI),t.range(-.3,.3)),i.add(m)}return{object:i,obstacleRadius:Math.hypot(n,o)/2}}var ut=[11876143,3104680,4160074,13208111,8011626,3116938],wa=15260864,ya=[12597547,14713132,10138927,8011626,14729788,13654575],va=[13081179,11896138,14201975],ba=["produce","pottery","bakery","textiles"];function Fi(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.seed??1,o=e.goods??t.pick(ba),i=e.clothColor??t.pick(ut),s=new At;s.name="stall";let c=D("wood",{color:a.woodDark,seed:n}),l=D("plank",{color:a.wood,seed:n+3}),r=new kt({color:i,roughness:.95,flatShading:!0}),u=new kt({color:wa,roughness:.95,flatShading:!0}),f=2.6,d=1.7,m=2.5,h=2.05;for(let C of[-1,1])for(let B of[-1,1]){let z=B<0?m:h,R=new le(new Pe(.055,.07,z,6),c);R.position.set(C*(f/2-.1),z/2,B*(d/2-.1)),s.add(R)}let p=.32,g=-d/2+.05,v=d/2+p,w=v-g,S=h+.06-(m+.06),y=Math.hypot(w,S),k=Math.atan2(m-h,w),M=(g+v)/2,x=(m+h)/2+.06,b=11,P=(f+.5)/b;for(let C=0;C<b;C++){let B=new le(new Ae(P*.97,.04,y),C%2===0?r:u);B.position.set(-((f+.5)/2)+P*(C+.5),x,M),B.rotation.x=k,s.add(B);let z=new le(new Ae(P*.97,.2,.03),C%2===0?r:u);z.position.set(B.position.x,h-.04,v),s.add(z)}let I=new At,G=new le(new Ae(f-.1,.09,.62),l);G.position.set(0,.96,d/2-.42),I.add(G);let F=new le(new Ae(f-.1,.5,.05),l);F.position.set(0,.68,d/2-.12),I.add(F),s.add(I);let V=new le(new Ae(f-.3,.07,.28),l);V.position.set(0,1.45,-d/2+.22),s.add(V);let L=1.05,A=f-.7,T=C=>Array.from({length:C},(B,z)=>-A/2+A*(z+.5)/C+t.jitter(0,.05));if(o==="produce")for(let C of T(3))s.add(Xt(t,C,L,d/2-.42,a,n)),xa(t,C,L+.16,d/2-.42).forEach(B=>s.add(B));else if(o==="bakery")for(let C of T(3)){s.add(Xt(t,C,L,d/2-.42,a,n));for(let B=0;B<t.int(3,5);B++){let z=new le(Ma(),Ze(t.pick(va)));z.position.set(C+t.jitter(0,.09),L+.17,d/2-.42+t.jitter(0,.09)),z.rotation.y=t.range(0,Math.PI),s.add(z)}}else if(o==="pottery"){let C=D("tile",{color:11887167,seed:n+5});for(let B of T(4))s.add(Jt(t,B,L,d/2-.42,C));for(let B=0;B<t.int(2,3);B++){let z=t.range(1.6,2.3),R=Jt(t,t.pick([-1,1])*(f/2+t.range(.2,.5)),0,t.range(-.3,.5),C);R.scale.setScalar(z),s.add(R)}}else{for(let C of T(3)){let B=L;for(let z=0,R=t.int(2,4);z<R;z++){let W=new le(new Ae(.5,.12,.42),Ze(t.pick(ut)));W.position.set(C+t.jitter(0,.04),B+.06,d/2-.42),W.rotation.y=t.jitter(0,.08),s.add(W),B+=.13}}for(let C=0;C<2;C++){let B=new le(new Pe(.11,.11,.5,8),Ze(t.pick(ut)));B.rotation.z=Math.PI/2,B.position.set(t.range(-A/2,A/2),1.52,-d/2+.22),s.add(B)}}return{object:s,obstacleRadius:Math.hypot(f,d)/2}}function Ze(e){return new kt({color:e,roughness:.85,flatShading:!0})}function Xt(e,t,a,n,o,i){let s=new le(new Pe(.2,.16,.2,9),D("wood",{color:o.wood,seed:i+Math.floor(t*100)}));return s.position.set(t,a+.1,n+e.jitter(0,.03)),s}function xa(e,t,a,n){let o=e.pick(ya),i=Ze(o),s=[],c=e.int(5,8);for(let l=0;l<c;l++){let r=e.range(.05,.075),u=new le(new ga(r,0),i),f=l/c*Math.PI*2,d=l===0?0:e.range(.04,.13);u.position.set(t+Math.cos(f)*d,a+(l===0?.05:e.range(-.02,.02)),n+Math.sin(f)*d),s.push(u)}return s}function Ma(){return new Ae(.22,.12,.14,1,1,1)}function Jt(e,t,a,n,o){let i=new At,s=e.range(.22,.34),c=new le(new Pe(.1,.07,s,9),o);c.position.y=s/2,i.add(c);let l=new le(new Pe(.06,.11,s*.35,9),o);l.position.y=s+s*.15,i.add(l);let r=new le(new Pe(.055,.05,.06,8),o);return r.position.y=s+s*.35,i.add(r),i.position.set(t+e.jitter(0,.03),a,n+e.jitter(0,.03)),i.rotation.y=e.range(0,Math.PI),i}function qn(e){let t=new Ia({color:e.color??16777215,vertexColors:e.vertexColors??!1,flatShading:!0,side:za,roughness:e.roughness??.92,metalness:0}),a={uTime:{value:0},uAmp:{value:e.amp},uFreeLen:{value:e.freeLen},uCrossLen:{value:e.crossLen},uWaves:{value:e.waves},uSpeed:{value:e.speed},uSag:{value:e.sag}};e.perVertexPhase||(a.uPhase={value:e.phase??0});let n=e.perVertexPhase?"attribute float aPhase;":"",o=e.perVertexPhase?"uniform float uTime, uAmp, uFreeLen, uCrossLen, uWaves, uSpeed, uSag;":"uniform float uTime, uAmp, uFreeLen, uCrossLen, uWaves, uSpeed, uSag, uPhase;",i=e.perVertexPhase?"aPhase":"uPhase";return t.onBeforeCompile=s=>{Object.assign(s.uniforms,a),s.vertexShader=s.vertexShader.replace("#include <common>",`#include <common>
${n}
${o}`).replace("#include <begin_vertex>",`#include <begin_vertex>
        {
          float uf = clamp(position.x / uFreeLen, 0.0, 1.0);   // 0 fixed \u2192 1 fly
          float vc = position.y / uCrossLen + 0.5;              // 0..1 across
          float base = uf * uWaves - uTime * uSpeed + ${i};
          float a = uAmp * uf;                                  // pinned at the fixed edge
          float z = a * (sin(base + vc * 1.7) + 0.35 * sin(base * 2.3 + vc * 3.1 + 1.0));
          transformed.z += z;
          transformed.y -= uSag * uf * uf;                      // gravity droop
          transformed.x -= uAmp * 0.25 * uf * (1.0 - cos(base));// slack shortening
        }`)},t.customProgramCacheKey=()=>e.cacheKey,t.userData.waveUniforms=a,t}var tn=[11876143,3104680,14199100,15260864,3111498,2763310,6963066],Pa=["flag","banner","pennant"],Ta=["solid","bands","stripes","bicolor","cross","saltire","diamond"];function Vi(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.seed??1,o=e.style??t.pick(Pa),i=e.pattern??t.pick(Ta),s=e.wind??1,c=e.poleHeight??t.range(3.2,3.8),l=e.colors?.[0],r=e.colors?.[1];if(l===void 0||r===void 0){l=t.pick(tn);do r=t.pick(tn);while(r===l)}let u=new Aa;u.name="banner";let f=new Be(new en(.045,.06,c,8),D("wood",{color:a.woodDark,seed:n}));f.position.y=c/2,u.add(f);let d=D("metal",{color:14199100,tint:8018463,tintAmount:.3,seed:n+2}),m=new Be(new Ca(.075,.28,8),d);m.position.y=c+.14,u.add(m);let h=new Be(new ka(.06,8,6),d);h.position.y=c,u.add(h);let p,g,v;o==="pennant"?(p=t.range(2,2.6),g=t.range(.6,.8),v=ft(p,g,20,5,"taper")):o==="banner"?(p=t.range(1.9,2.4),g=t.range(1,1.3),v=ft(p,g,16,9,"swallow")):(p=t.range(1.5,1.9),g=t.range(.95,1.15),v=ft(p,g,16,9,"rect")),Ga(v,p,g,i,new Qt(l),new Qt(r));let w=Ra(p,g,s,o,n),S=new Be(v,w),y=w.userData.waveUniforms;if(S.onBeforeRender=()=>{y.uTime.value=performance.now()*.001},o==="banner"){let k=new Be(new en(.035,.035,g+.3,7),D("wood",{color:a.woodDark,seed:n+4}));k.rotation.z=Math.PI/2,k.position.y=c-.12,u.add(k),S.rotation.z=-Math.PI/2,S.position.set(0,c-.16,0)}else S.position.set(.05,c-.2-g/2,0);return u.add(S),{object:u,obstacleRadius:.4}}function ft(e,t,a,n,o){let i=new Sa,s=a+1,c=n+1,l=new Float32Array(s*c*3),r=new Float32Array(s*c*2);for(let f=0;f<s;f++){let d=f/a,m=t/2;o==="taper"&&(m=t/2*(1-d*.94));for(let h=0;h<c;h++){let p=h/n,g=f*c+h,v=d*e;if(o==="swallow"){let S=Math.abs(p-.5)*2,y=Math.max(0,(d-.7)/.3);v=d*e-y*y*(1-S)*t*.5}let w=(p-.5)*m*2;l[g*3]=v,l[g*3+1]=w,l[g*3+2]=0,r[g*2]=d,r[g*2+1]=p}}let u=[];for(let f=0;f<a;f++)for(let d=0;d<n;d++){let m=f*c+d,h=(f+1)*c+d,p=(f+1)*c+(d+1),g=f*c+(d+1);u.push(m,h,g,h,p,g)}return i.setAttribute("position",new zt(l,3)),i.setAttribute("uv",new zt(r,2)),i.setIndex(u),i.computeVertexNormals(),i}function Ga(e,t,a,n,o,i){let s=e.getAttribute("uv"),c=new Float32Array(s.count*3),l=(r,u)=>{switch(n){case"bicolor":return r<.5?o:i;case"bands":return Math.floor(u*3)%2===0?o:i;case"stripes":return Math.floor(r*5)%2===0?o:i;case"cross":return Math.abs(u-.5)<.16||Math.abs(r-.42)<.14?i:o;case"saltire":return Math.abs(r-u)<.17||Math.abs(r-(1-u))<.17?i:o;case"diamond":return Math.abs(r-.5)+Math.abs(u-.5)<.3?i:o;default:return o}};for(let r=0;r<s.count;r++){let u=l(s.getX(r),s.getY(r));c[r*3]=u.r,c[r*3+1]=u.g,c[r*3+2]=u.b}e.setAttribute("color",new zt(c,3))}function Ra(e,t,a,n,o){return qn({freeLen:e,crossLen:t,amp:(n==="pennant"?.16:.13)*a,waves:n==="pennant"?7:5,speed:3.4+o%7*.12,sag:n==="banner"?0:.14,phase:o%100*.183,cacheKey:"scena-banner-v1",vertexColors:!0})}function Wa(e,t=5){let a=[],n=[],o=[],i=[];for(let c of e){let l=a.length/3,r=[{y:0,rad:c.r},{y:c.h*.5,rad:c.r*.62}];for(let f of r)for(let d=0;d<t;d++){let m=d/t*Math.PI*2;a.push(c.cx+Math.cos(m)*f.rad,f.y,c.cz+Math.sin(m)*f.rad),n.push(f.y/c.h),o.push(c.phase)}let u=l+t*2;a.push(c.cx,c.h,c.cz),n.push(1),o.push(c.phase);for(let f=0;f<t;f++){let d=l+f,m=l+(f+1)%t,h=l+t+f,p=l+t+(f+1)%t;i.push(d,m,p,d,p,h),i.push(h,p,u)}}let s=new Zn;return s.setAttribute("position",new xe(new Float32Array(a),3)),s.setAttribute("aY",new xe(new Float32Array(n),1)),s.setAttribute("aPhase",new xe(new Float32Array(o),1)),s.setIndex(i),s}var _a=`
attribute float aY;
attribute float aPhase;
uniform float uTime;
varying float vY;
void main() {
  vY = aY;
  vec3 p = position;
  float w = aY * aY;                 // tips sway most, base is pinned
  p.x += sin(uTime * 7.0 + aPhase + aY * 4.0) * 0.09 * w;
  p.z += cos(uTime * 6.0 + aPhase * 1.3 + aY * 4.0) * 0.09 * w;
  p.y *= 0.82 + 0.18 * sin(uTime * 13.0 + aPhase * 2.0); // lick up and down
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,Va=`
uniform vec3 uHot;
uniform vec3 uCool;
varying float vY;
void main() {
  vec3 col = mix(uHot, uCool, vY);   // white-hot base \u2192 cool orange tip
  float alpha = 1.0 - vY;            // fade out toward the tip
  gl_FragColor = vec4(col * (1.2 - vY * 0.4), alpha);
}`,La=`
attribute float aPhase;
attribute float aSpeed;
attribute float aRad;
attribute float aAng;
uniform float uTime;
uniform float uRise;
uniform float uSize;
varying float vLife;
void main() {
  float life = fract(uTime * aSpeed + aPhase); // 0 born \u2192 1 dead
  vLife = life;
  float ang = aAng + life * 2.2;
  float rad = aRad * (1.0 - life * 0.35);
  vec3 p = vec3(cos(ang) * rad, life * uRise, sin(ang) * rad);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (1.0 - life) * (260.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`,Ha=`
uniform vec3 uColor;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, (1.0 - vLife) * (1.0 - d * 2.0));
}`;function Jn(e,t,a,n,o){let i=[];for(let w=0;w<a;w++){let S=w/a*Math.PI*2+e.range(0,1),y=w===0?0:e.range(.3,1)*n;i.push({cx:Math.cos(S)*y,cz:Math.sin(S)*y,r:e.range(.1,.16)*t,h:o*e.range(.7,1.15)*t,phase:e.range(0,Math.PI*2)})}let s=new on({uniforms:{uTime:{value:0},uHot:{value:new dt(16771226)},uCool:{value:new dt(14696460)}},vertexShader:_a,fragmentShader:Va,transparent:!0,depthWrite:!1,blending:nn,side:Ba}),c=new Me(Wa(i),s),l=Math.round(10+a*2),r=new Float32Array(l*3),u=new Float32Array(l),f=new Float32Array(l),d=new Float32Array(l),m=new Float32Array(l);for(let w=0;w<l;w++)u[w]=e.next(),f[w]=e.range(.25,.5),d[w]=e.range(.02,n*.9),m[w]=e.range(0,Math.PI*2);let h=new Zn;h.setAttribute("position",new xe(r,3)),h.setAttribute("aPhase",new xe(u,1)),h.setAttribute("aSpeed",new xe(f,1)),h.setAttribute("aRad",new xe(d,1)),h.setAttribute("aAng",new xe(m,1));let p=new on({uniforms:{uTime:{value:0},uRise:{value:o*1.9*t},uSize:{value:3.2*t},uColor:{value:new dt(16747068)}},vertexShader:La,fragmentShader:Ha,transparent:!0,depthWrite:!1,blending:nn}),g=new Fa(h,p);g.frustumCulled=!1;let v=new Dt;return v.add(c,g),{group:v,flameU:s.uniforms,emberU:p.uniforms}}function Qn(e,t,a,n,o,i,s){e.onBeforeRender=()=>{let c=performance.now()*.001;t.uTime.value=c,a.uTime.value=c;let l=.74+.15*Math.sin(c*11)+.1*Math.sin(c*23.3+1.7)+.06*Math.sin(c*41+.5);n.emissiveIntensity=o*(.8+.3*(l-.74)*3),i&&(i.intensity=s*Math.max(.4,l))}}function Hi(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.seed??1,o=e.scale??1,i=e.light??!0,s=new Dt;s.name="brazier";let c=D("metal",{color:a.metal,seed:n}),l=.9;for(let h=0;h<3;h++){let p=h/3*Math.PI*2+.5,g=new Me(new Xe(.03,.04,l,5),c);g.position.set(Math.cos(p)*.22,l/2,Math.sin(p)*.22),g.rotation.z=Math.cos(p)*.18,g.rotation.x=-Math.sin(p)*.18,s.add(g)}let r=new Me(new Xe(.42,.24,.32,12,1,!0),c);r.position.y=l+.02,s.add(r);let u=new Me(new Xe(.24,.24,.05,12),c);u.position.y=l-.13,s.add(u);let f=new Pt({color:1708297,emissive:16734750,emissiveIntensity:1.4,flatShading:!0});for(let h=0;h<5;h++){let p=new Me(new It(t.range(.07,.12),0),f);p.position.set(t.jitter(0,.16),l+.06+t.range(0,.04),t.jitter(0,.16)),s.add(p)}let d=Jn(t,o,5,.2,.5);d.group.position.y=l+.1,s.add(d.group);let m=null;return i&&(m=new Xn(16747066,7,9,2),m.position.set(0,l+.4,0),s.add(m)),Qn(d.group.children[0],d.flameU,d.emberU,f,1.4,m,7),{object:s,obstacleRadius:.45}}function Di(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.seed??1,o=e.scale??1,i=e.light??!0,s=new Dt;s.name="campfire";let c=D("stone",{color:a.rock[0],seed:n}),l=.7,r=t.int(7,9);for(let g=0;g<r;g++){let v=g/r*Math.PI*2,w=t.range(.16,.24),S=new Me(new It(w,0),c);S.position.set(Math.cos(v)*l,w*.5,Math.sin(v)*l),S.rotation.set(t.range(0,3),t.range(0,3),t.range(0,3)),S.scale.y=.75,s.add(S)}let u=D("wood",{color:a.woodDark,seed:n+3}),f=new Pt({color:1840143,flatShading:!0}),d=t.int(3,4);for(let g=0;g<d;g++){let v=g/d*Math.PI*2+t.range(0,.4),w=new Me(new Xe(.07,.08,.95,6),g%2?f:u);w.position.set(Math.cos(v)*.18,.28,Math.sin(v)*.18),w.rotation.set(Math.PI/2-.55,v,0),s.add(w)}let m=new Pt({color:1708040,emissive:16733464,emissiveIntensity:1.6,flatShading:!0});for(let g=0;g<6;g++){let v=new Me(new It(t.range(.08,.14),0),m);v.position.set(t.jitter(0,.24),.08+t.range(0,.05),t.jitter(0,.24)),s.add(v)}let h=Jn(t,o,7,.42,.85);h.group.position.y=.14,s.add(h.group);let p=null;return i&&(p=new Xn(16746038,9,12,2),p.position.set(0,.9,0),s.add(p)),Qn(h.group.children[0],h.flameU,h.emberU,m,1.6,p,9),{object:s,obstacleRadius:.9}}var $a=[13777714,15260864,3108784,14726458,4164178,16777215];function ji(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.seed??1,o=e.span??t.range(4.5,6),i=e.poleHeight??t.range(2.6,3.2),s=e.flags??Math.max(5,Math.round(o*1.6)),c=e.colors??$a,l=new Ea;l.name="bunting";let r=D("wood",{color:a.woodDark,seed:n});for(let y of[-1,1]){let k=new mt(new Oa(.05,.06,i,7),r);k.position.set(y*(o/2),i/2,0),l.add(k)}let u=i-.1,f=o*t.range(.12,.18),d=24,m=[];for(let y=0;y<=d;y++){let k=y/d,M=-o/2+k*o,x=u-4*f*k*(1-k);m.push(new Ka(M,x,0))}let h=new ja(m),p=new mt(new Ya(h,d,.016,5,!1),new Ua({color:a.woodDark,roughness:.9,flatShading:!0}));l.add(p);let g=.42,v=.34,w=[],S;for(let y=0;y<s;y++){let k=(y+1)/(s+1),M=h.getPoint(k),x=qn({freeLen:g,crossLen:v,amp:.05,waves:2.4,speed:2.6+n%5*.1,sag:0,phase:y*.7+n%10*.3,cacheKey:"scena-bunting-v1",color:c[y%c.length],roughness:.9}),b=new mt(qa(g,v),x);b.rotation.z=-Math.PI/2,b.position.set(M.x,M.y-.01,M.z),l.add(b),w.push(x.userData.waveUniforms),S||(S=b)}return S&&(S.onBeforeRender=()=>{let y=performance.now()*.001;for(let k of w)k.uTime.value=y}),{object:l,obstacleRadius:0}}function qa(e,t,a=4,n=2){let o=a+1,i=n+1,s=[];for(let r=0;r<o;r++){let u=r/a,f=t/2*(1-u*.92);for(let d=0;d<i;d++){let m=d/n;s.push(u*e,(m-.5)*f*2,0)}}let c=[];for(let r=0;r<a;r++)for(let u=0;u<n;u++){let f=r*i+u,d=(r+1)*i+u,m=(r+1)*i+(u+1),h=r*i+(u+1);c.push(f,d,h,d,m,h)}let l=new Na;return l.setAttribute("position",new Da(new Float32Array(s),3)),l.setIndex(c),l.computeVertexNormals(),l}function Tt(e={}){let t=e.level??.8,a=e.size??200,n=e.resolution??40,o=e.amplitude??.06,i=e.speed??1,s=e.palette??K,c=new rs(a,a,n,n);c.rotateX(-Math.PI/2);let l=c.getAttribute("position"),r=new as(c,new ss({color:s.water,transparent:!0,opacity:.85,flatShading:!0,metalness:.35,roughness:.4}));r.name="water",r.position.y=t;let u=0,f=d=>{u+=d*i;for(let m=0;m<l.count;m++){let h=l.getX(m),p=l.getZ(m);l.setY(m,Math.sin(h*.35+u)*Math.cos(p*.3+u*.8)*o)}l.needsUpdate=!0,c.computeVertexNormals()};return f(0),{mesh:r,level:t,update:f,isUnderwater:d=>d<t}}function is(e,t,a=.25){return(n,o)=>e.heightAt(n,o)>t.level+a}var ls=["obelisk","figure","orb","bust","beast"];function us(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.seed??1,o=e.figure??t.pick(ls),i=e.material??(t.next()<.72?"stone":"bronze"),s=e.height??t.range(3.1,3.7),c=new Gt;c.name="statue";let l=D("stone",{color:t.pick(a.rock),seed:n}),r=i==="bronze"?D("metal",{color:10124102,tint:4153155,tintAmount:.34,seed:n+4}):D("stone",{color:t.pick(a.rock),seed:n+7}),u=s*t.range(.32,.4),f=s*.34,d=3,m=0;for(let y=0;y<d;y++){let k=y/(d-1),M=f*(1-k*.34),x=u*.42/d+(y===0?.06:0),b=new Q(new pe(M,x,M),l);b.position.y=m+x/2,c.add(b),m+=x}let h=f*.5,p=u-m,g=new Q(new pe(h,p,h),l);g.position.y=m+p/2,c.add(g);let v=u,w=s-u,S=new Gt;if(S.position.y=v,c.add(S),o==="obelisk"){let y=w*.86,k=new Q(new we(h*.24,h*.34,y,4),r);k.position.y=y/2,k.rotation.y=Math.PI/4,S.add(k);let M=new Q(new cs(h*.24*1.35,w*.16,4),r);M.position.y=y+w*.08,M.rotation.y=Math.PI/4,S.add(M)}else if(o==="orb"){let y=w*.62,k=new Q(new we(h*.2,h*.26,y,10),r);k.position.y=y/2,S.add(k);let M=new Q(new Rt(w*.22,16,12),r);M.position.y=y+w*.22,S.add(M);let x=new Q(new we(w*.28,w*.28,.04,20,1,!0),r);x.position.copy(M.position),x.rotation.set(Math.PI/2.4,0,.2),S.add(x)}else if(o==="bust"){let y=w*.52,k=new Q(new we(h*.22,h*.3,y,8),r);k.position.y=y/2,S.add(k);let M=new Q(new we(w*.2,w*.26,w*.2,7),r);M.position.y=y+w*.1,S.add(M),S.add(an(r,w*.13,y+w*.32,t))}else if(o==="beast"){let y=w*.5,k=new Q(new pe(y*.78,y*.62,y*.9),r);k.position.set(0,y*.42,-y*.42),S.add(k);let M=new Q(new pe(y*.62,y*.95,y*.5),r);M.position.set(0,y*.62,y*.32),S.add(M);let x=new Q(new pe(y*.32,y*.78,y*.34),r);x.position.set(0,y*.3,y*.44),S.add(x);for(let G of[-1,1]){let F=new Q(new pe(y*.26,y*.5,y*.7),r);F.position.set(G*y*.32,y*.34,-y*.34),S.add(F);let V=new Q(new pe(y*.2,y*.62,y*.22),r);V.position.set(G*y*.2,y*.31,y*.5),S.add(V);let L=new Q(new pe(y*.24,y*.14,y*.36),r);L.position.set(G*y*.2,y*.07,y*.62),S.add(L)}let b=new Q(new Rt(y*.36,10,8),r);b.position.set(0,y*1.16,y*.36),b.scale.set(1,1,.9),S.add(b);let P=new Q(new pe(y*.22,y*.2,y*.28),r);P.position.set(0,y*1.08,y*.64),S.add(P);for(let G of[-1,1]){let F=new Q(new pe(y*.09,y*.11,y*.05),r);F.position.set(G*y*.17,y*1.4,y*.32),S.add(F)}let I=new Q(new we(y*.045,y*.07,y*.9,6),r);I.position.set(y*.34,y*.42,-y*.62),I.rotation.set(.6,0,-.5),S.add(I)}else{let y=w*.62,k=new Q(new we(w*.14,w*.24,y,9),r);k.position.y=y/2,S.add(k);let M=new Q(new we(w*.13,w*.15,w*.18,8),r);M.position.y=y+w*.06,S.add(M);let x=t.next()<.5;for(let b of[-1,1]){let P=new Q(new we(w*.045,w*.05,w*.34,6),r);x&&b===1?(P.position.set(b*w*.16,y+w*.12,w*.02),P.rotation.z=-.9):(P.position.set(b*w*.15,y-w*.04,0),P.rotation.z=b*.12),S.add(P)}S.add(an(r,w*.1,y+w*.24,t))}return{object:c,obstacleRadius:f*.72}}function an(e,t,a,n){let o=new Gt,i=new Q(new Rt(t,12,10),e);return i.scale.set(.92,1.08,.95),o.add(i),o.position.y=a,o.rotation.y=n.jitter(0,.15),o}var fs=["orb","figure","obelisk","bust"];function Yi(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.seed??1,o=e.size??t.range(3,3.6),i=e.figure??t.pick(fs),s=new es;s.name="fountain";let c=D("stone",{color:a.rock[0],seed:n}),l=D("stone",{color:a.rock[1]??a.rock[0],seed:n+5}),r=.55,u=.22,f=o/2,d=new We(new Ue(f*.98,f*.98,.12,4),l);d.rotation.y=Math.PI/4,d.position.y=.06,s.add(d);let m=[[0,f-u/2,o,u],[0,-(f-u/2),o,u],[f-u/2,0,u,o],[-(f-u/2),0,u,o]];for(let[I,G,F,V]of m){let L=new We(new Xa(F,r,V),c);L.position.set(I,r/2,G),s.add(L)}let h=r-.12,p=Tt({level:h,size:o-u*1.4,resolution:12,amplitude:.02,speed:1.4,palette:a});s.add(p.mesh);let g=o*.16,v=r+o*.24,w=new We(new Ue(g*.8,g,v,10),c);w.position.y=v/2,s.add(w);let S=v,y=new We(new Ue(o*.3,o*.14,.16,12),c);y.position.y=S,s.add(y);let k=Tt({level:S+.09,size:o*.34,resolution:6,amplitude:.012,speed:1.9,palette:a});s.add(k.mesh);let M=us({seed:n+3,figure:i,material:e.centrepiece??"stone",height:o*.62,palette:a});M.object.position.y=S+.08,M.object.scale.setScalar(.9),s.add(M.object);let x=new ts({color:a.water,transparent:!0,opacity:.4,roughness:.3,metalness:.4,flatShading:!0});for(let I=0;I<8;I++){let G=I/8*Math.PI*2,F=new We(new Ue(.02,.03,S-h-.05,4),x);F.position.set(Math.cos(G)*o*.28,(S+h)/2,Math.sin(G)*o*.28),s.add(F)}let b=hs(t,o*.14,S+o*.2);b.mesh.position.y=S+.12,s.add(b.mesh);let P=performance.now()*.001;return p.mesh.onBeforeRender=()=>{let I=performance.now()*.001,G=Math.min(.05,Math.max(0,I-P));P=I,p.update(G),k.update(G),b.uniforms.uTime.value=I},{object:s,obstacleRadius:f+.1}}var ds=`
attribute float aPhase;
attribute float aSpeed;
attribute float aRad;
attribute float aAng;
uniform float uTime;
uniform float uRise;
uniform float uSize;
varying float vLife;
void main() {
  float life = fract(uTime * aSpeed + aPhase);
  vLife = life;
  // Ballistic arc: up then down.
  float h = 4.0 * life * (1.0 - life);
  float rad = aRad * life;
  vec3 p = vec3(cos(aAng) * rad, h * uRise, sin(aAng) * rad);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (240.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`,ms=`
uniform vec3 uColor;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  // Fade in at birth, out at death; soft round dot; kept dim so many
  // droplets read as a fine spray rather than a blown-out bloom.
  float fade = max(0.0, 0.5 - abs(vLife - 0.5));
  gl_FragColor = vec4(uColor, (1.0 - d * 2.0) * fade * 0.8);
}`;function hs(e,t,a){let o=new Float32Array(66),i=new Float32Array(22),s=new Float32Array(22),c=new Float32Array(22),l=new Float32Array(22);for(let d=0;d<22;d++)i[d]=e.next(),s[d]=e.range(.35,.6),c[d]=e.range(.25,1)*t,l[d]=e.range(0,Math.PI*2);let r=new Ja;r.setAttribute("position",new Fe(o,3)),r.setAttribute("aPhase",new Fe(i,1)),r.setAttribute("aSpeed",new Fe(s,1)),r.setAttribute("aRad",new Fe(c,1)),r.setAttribute("aAng",new Fe(l,1));let u=new os({uniforms:{uTime:{value:0},uRise:{value:a*.42},uSize:{value:.28},uColor:{value:new Qa(12574958)}},vertexShader:ds,fragmentShader:ms,transparent:!0,depthWrite:!1,blending:Za}),f=new ns(r,u);return f.frustumCulled=!1,{mesh:f,uniforms:u.uniforms}}var gs=["cart","wagon"],ws=["empty","crates","barrels","sacks","hay"];function $i(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.seed??1,o=e.style??t.pick(gs),i=e.cargo??t.pick(ws),s=new Nt;s.name="cart";let c=D("plank",{color:a.wood,seed:n}),l=D("wood",{color:a.woodDark,seed:n+2}),r=D("metal",{color:a.metal,seed:n+4}),u=o==="wagon"?2.6:2,f=1.3,d=o==="wagon"?.5:.56,m=1.11,h=d*m+.18,p=new me(new Bt(u,.12,f),c);p.position.y=h,s.add(p);let g=[[0,f/2-.04,u,.08],[0,-(f/2-.04),u,.08],[u/2-.04,0,.08,f],[-(u/2-.04),0,.08,f]];for(let[y,k,M,x]of g){let b=new me(new Bt(M,.32,x),c);b.position.set(y,h+.22,k),s.add(b)}let v=f/2+.09,w=o==="wagon"?[u*.32,-u*.32]:[-u*.05];for(let y of w){let k=o==="wagon"&&y>0?d*.82:d;for(let x of[1,-1]){let b=ys(k,l,r,t);b.position.set(y,k*m,x*v),s.add(b)}let M=new me(new Te(.05,.05,v*2,6),l);M.rotation.x=Math.PI/2,M.position.set(y,k*m,0),s.add(M)}if(o==="cart")for(let y of[1,-1]){let k=new me(new Te(.045,.055,1.5,6),l);k.position.set(u/2+.55,h-.35,y*(f/2-.2)),k.rotation.z=Math.PI/2-.32,s.add(k)}vs(s,i,t,n,a,u,f,h+.06,l);let S=Math.hypot(u,f)/2+.15;return{object:s,obstacleRadius:S}}function ys(e,t,a,n){let o=new Nt,i=new me(new sn(e,e*.11,6,16),a);o.add(i);let s=new me(new sn(e*.84,e*.08,5,14),t);o.add(s);let c=new me(new Te(e*.16,e*.16,e*.3,8),t);c.rotation.x=Math.PI/2,o.add(c);let l=n.int(6,8);for(let r=0;r<l;r++){let u=r/l*Math.PI*2,f=new me(new Te(e*.03,e*.04,e*.72,5),t);f.position.set(Math.cos(u)*e*.44,Math.sin(u)*e*.44,0),f.rotation.z=u-Math.PI/2,o.add(f)}return o}function vs(e,t,a,n,o,i,s,c,l){if(t==="empty")return;let r=()=>[a.jitter(0,i*.3),a.jitter(0,s*.28)];if(t==="crates"){let u=a.int(2,4);for(let f=0;f<u;f++){let d=Ht({seed:n+f*7,size:a.range(.55,.7),palette:o}),[m,h]=r();d.object.position.set(m,c,h),e.add(d.object)}}else if(t==="barrels"){let u=D("wood",{color:o.wood,seed:n+9}),f=a.int(3,5);for(let d=0;d<f;d++){let m=new Nt,h=new me(new Te(.24,.24,.62,10),u);h.scale.x=1.08,h.position.y=.31,m.add(h);for(let v of[.12,.5]){let w=new me(new Te(.255,.255,.05,10),D("metal",{color:o.metal,seed:n+3}));w.position.y=v,m.add(w)}let[p,g]=r();m.position.set(p,c,g),e.add(m)}}else if(t==="sacks"){let u=D("plaster",{color:12560504,seed:n+5}),f=a.int(4,6);for(let d=0;d<f;d++){let m=new me(new ps(.22,1),u),[h,p]=r();m.position.set(h,c+.16,p),m.rotation.y=a.range(0,Math.PI),m.scale.set(a.range(.9,1.1),a.range(1,1.3),a.range(.9,1.1)),e.add(m)}}else{let u=D("thatch",{color:13216074,seed:n+6});for(let f=0;f<3;f++){let d=new me(new Bt(i*.7,.34,s*.7),u);d.position.set(a.jitter(0,.1),c+.17+f*.3,a.jitter(0,.05)),d.rotation.y=a.jitter(0,.1),d.scale.setScalar(1-f*.16),e.add(d)}}}var rn=["HAVENBROOK","MILLFORD","OAKVALE","GREYMOOR","ASHFORD","WESTWATCH","THORNWICK"],cn=["MARKET","HARBOUR","THE MILL","CASTLE","FORGE","CHAPEL","FERRY","THE INN"],Ss=[15983272,16182473,15255146,15785134],Cs=[2242862,1978441,4857634,2374176,2761501];function Zi(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.seed??1,o=e.kind??"post",i=e.inkColor??t.pick(Ss),s=e.panelColor??t.pick(Cs),c=new et;c.name="sign";let l=()=>D("plank",{color:e.boardColor??a.wood,seed:n}),r=D("wood",{color:a.woodDark,seed:n+3}),u=D("metal",{color:3093307,tint:1316378,tintAmount:.35,seed:n+5}),f=()=>new Ne({color:i,roughness:.55,metalness:0,emissive:new Ms(i).multiplyScalar(.5),emissiveIntensity:.32});if(o==="milestone")return ks(c,e.text??t.pick(rn),a,n),{object:c,obstacleRadius:.42};if(o==="fingerpost"){let M=e.directions??zs(t,e.text?[e.text,...cn]:cn),x=e.height??3.4,b=new ne(new _e(.08,.1,x,10),r);b.position.y=x/2,c.add(b);let P=new ne(new eo(.13,12,8),u);P.position.y=x+.03,c.add(P);let I=M.length;return M.forEach((G,F)=>{let V=G.angle??F/I*Math.PI*2+t.range(-.2,.2),L=G.height??x-.55-F*.66,A=As(G.text,l(),f(),s,u);A.position.y=L,A.rotation.y=V,c.add(A)}),{object:c,obstacleRadius:.4}}let d=e.text??t.pick(rn),m=.72,h=m*.5,g=Math.max(1.5,Vt(d,{size:h})+.34*2),v=.1;if(o==="hanging"){let M=e.height??3,x=new ne(new _e(.075,.09,M,10),r);x.position.y=M/2,c.add(x);let b=g*.5+.4,P=new ne(new Ge(b,.1,.1),u);P.position.set(b/2,M-.18,0),c.add(P);let I=new ne(new Ft(.11,.022,7,12,Math.PI*1.4),u);I.position.set(b-.1,M-.32,0),I.rotation.z=-.4,c.add(I);let G=new ne(new _e(.032,.032,.6,6),u);G.position.set(b*.4,M-.52,0),G.rotation.z=Math.PI/4,c.add(G);let F=b-.14,V=new et;V.name="signPivot",V.position.set(F,M-.24,0),c.add(V);for(let T of[-g*.34,g*.34]){let C=new ne(new Ft(.055,.018,7,12),u);C.position.set(T,-.15,0),C.rotation.x=Math.PI/2,V.add(C);let B=new ne(new _e(.014,.014,.28,6),u);B.position.set(T,-.16,0),V.add(B)}let L=ln(d,g,m,v,l(),f(),s,u,h,!0);L.position.y=-.5,V.add(L);let A=n%100*.21;return L.children[0].onBeforeRender=()=>{let T=(typeof performance<"u"?performance.now():0)*.001;V.rotation.z=Math.sin(T*1.6+A)*.05,V.updateMatrixWorld(!0)},{object:c,obstacleRadius:.3}}let w=e.height??2.15,S=w-m/2-.06;for(let M of[-g*.33,g*.33]){let x=new ne(new _e(.06,.075,w,9),r);x.position.set(M,w/2,0),c.add(x)}let y=ln(d,g,m,v,l(),f(),s,u,h,!0);y.position.y=S,c.add(y);let k=new ne(new Ge(g+.14,.09,v+.14),r);return k.position.y=S+m/2+.07,c.add(k),{object:c,obstacleRadius:.3}}function ln(e,t,a,n,o,i,s,c,l,r){let u=new et,f=new ne(new Ge(t,a,n),o);u.add(f);let d=new Ne({color:s,roughness:.62,metalness:0}),m=r?[1,-1]:[1];for(let g of m){let v=new ne(new Ge(t-.18,a-.18,.03),d);v.position.z=g*(n/2+.012),u.add(v);let w=new ne(_t(e,{size:l,align:"center"}).geometry,i);w.position.z=g*(n/2+.035),g<0&&(w.rotation.y=Math.PI),u.add(w)}let h=t/2-.11,p=a/2-.11;for(let g of[-h,h])for(let v of[-p,p]){let w=new ne(new eo(.035,8,6),c);w.position.set(g,v,n/2+.01),u.add(w)}return u}function As(e,t,a,n,o){let i=new et,s=.46,c=.08,l=s*.52,r=Vt(e,{size:l}),u=Math.max(1.6,r+.8),f=to([[0,-s/2],[u-s*.85,-s/2],[u,0],[u-s*.85,s/2],[0,s/2]],c),d=new ne(f,t);i.add(d);let m=new Ne({color:n,roughness:.62}),h=new ne(new Ge(u-.16,s-.14,.03),m);h.position.set((u-.16)/2-.02,0,c/2+.012),i.add(h);let p=new ne(_t(e,{size:l,align:"left"}).geometry,a);p.position.set(.24,0,c/2+.035),i.add(p);let g=new ne(new Ft(.06,.02,6,10),o);return g.position.set(.03,0,0),g.rotation.y=Math.PI/2,i.add(g),i}function ks(e,t,a,n){let o=D("stone",{color:a.rock[0],seed:n}),i=1,s=new ne(to([[-.44,0],[.44,0],[.44,i*.68],[.26,i],[-.26,i],[-.44,i*.68]],.28),o);e.add(s);let c=.74,l=.19,r=Vt(t,{size:l});r>c-.1&&(l*=(c-.1)/r,r=c-.1);let u=new ne(new Ge(Math.min(c,r+.14),l+.18,.02),new Ne({color:3158060,roughness:.8}));u.position.set(0,i*.56,.145),e.add(u);let f=new Ne({color:15262678,roughness:.6,emissive:2762788,emissiveIntensity:.15}),d=new ne(_t(t,{size:l,align:"center",depth:.02}).geometry,f);d.position.set(0,i*.56,.16),e.add(d)}function to(e,t){let a=e.length,n=t/2,o=[],i=[];for(let[c,l]of e)o.push(c,l,n);for(let[c,l]of e)o.push(c,l,-n);for(let c=1;c<a-1;c++)i.push(0,c,c+1),i.push(a,a+c+1,a+c);for(let c=0;c<a;c++){let l=(c+1)%a;i.push(c,a+c,l,l,a+c,a+l)}let s=new xs;return s.setAttribute("position",new bs(new Float32Array(o),3)),s.setIndex(i),s.computeVertexNormals(),s.computeBoundingBox(),s.computeBoundingSphere(),s}function zs(e,t){let a=[...t],n=[];for(let o=0;o<3&&a.length;o++){let i=Math.floor(e.next()*a.length);n.push({text:a.splice(i,1)[0]})}return n}function Rs(e={}){let t=e.seed??1,a=e.size??80,n=e.resolution??96,o=e.amplitude??6,i=e.noiseScale??28,s=e.octaves??4,c=e.valleyFlatness??.55,l=e.palette??K,r=(M,x)=>{let b=lo(M/i,x/i,t,s);return Math.pow(b,1+c*2)*o},u=new Gs(a,a,n-1,n-1);u.rotateX(-Math.PI/2);let f=u.getAttribute("position");for(let M=0;M<f.count;M++)f.setY(M,r(f.getX(M),f.getZ(M)));u.computeVertexNormals();let d=u.getAttribute("normal"),m=new Float32Array(f.count*3),h=new ze(l.grassLow),p=new ze(l.grassHigh),g=new ze(l.cliff),v=new ze(l.peak),w=new ze(l.sand),S=e.waterLevel,y=new ze;for(let M=0;M<f.count;M++){let x=f.getY(M),b=x/o,P=1-d.getY(M);y.copy(h).lerp(p,Math.min(1,b*1.6)),b>.75&&y.lerp(v,(b-.75)*4),P>.15&&y.lerp(g,Math.min(1,(P-.15)*4)),S!==void 0&&x<S+.5&&y.lerp(w,Math.min(1,(S+.5-x)*1.6)),m[M*3]=y.r,m[M*3+1]=y.g,m[M*3+2]=y.b}u.setAttribute("color",new Is(m,3));let k=new Ps(u,new Ts({vertexColors:!0,flatShading:!0}));return k.name="terrain",{mesh:k,heightAt:r,size:a,seed:t}}function Vs(e={}){let t=e.palette??K,a=new Ws({side:Bs,depthWrite:!1,uniforms:{topColor:{value:new un(e.topColor??t.skyTop)},bottomColor:{value:new un(e.bottomColor??t.skyBottom)}},vertexShader:`
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,fragmentShader:`
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorld;
      void main() {
        float t = clamp(normalize(vWorld).y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, pow(t, 0.8)), 1.0);
      }`}),n=new Fs(new _s(e.radius??400,16,12),a);return n.name="sky",{mesh:n,setColors(o,i){a.uniforms.topColor.value.setHex(o),a.uniforms.bottomColor.value.setHex(i)}}}var Os={day:{sun:16774368,sunIntensity:1.6,sunPos:[30,45,20],ambient:14674687,ambientIntensity:.35,skyTint:12376319,groundTint:6978918},"golden-hour":{sun:16758881,sunIntensity:1.7,sunPos:[40,14,-12],ambient:16768192,ambientIntensity:.3,skyTint:16764830,groundTint:8022616},overcast:{sun:14212840,sunIntensity:.7,sunPos:[12,40,8],ambient:13620960,ambientIntensity:.65,skyTint:13160668,groundTint:7371384},night:{sun:9348824,sunIntensity:.35,sunPos:[-20,30,-25],ambient:3818600,ambientIntensity:.35,skyTint:2897248,groundTint:1975344}};function Es(e="day"){let t=Os[e],a=new Ns;a.name=`lighting-${e}`;let n=new Hs(t.sun,t.sunIntensity);n.position.set(...t.sunPos);let o=new Ls(t.ambient,t.ambientIntensity),i=new js(t.skyTint,t.groundTint,.5);return a.add(n,o,i),{group:a,sun:n,ambient:o,hemisphere:i}}var Us={haze:{near:45,far:160},thick:{near:12,far:70},eerie:{near:6,far:42}};function Ys(e,t,a=K){if(t==="clear"){e.fog=null;return}let{near:n,far:o}=Us[t];e.fog=new Ds(a.fog,n,o)}function $s(e={}){let t=e.palette??K,a=e.dayLength??60,n=[{t:0,skyTop:725030,skyBottom:1712960,sun:9348824,sunIntensity:.03,ambientIntensity:.06,fog:1317422},{t:.23,skyTop:2569052,skyBottom:6968432,sun:13605490,sunIntensity:.3,ambientIntensity:.12,fog:4866648},{t:.3,skyTop:4877216,skyBottom:15247738,sun:16758881,sunIntensity:1,ambientIntensity:.26,fog:11569778},{t:.5,skyTop:t.skyTop,skyBottom:t.skyBottom,sun:16774368,sunIntensity:1.9,ambientIntensity:.45,fog:t.fog},{t:.7,skyTop:4872852,skyBottom:14718302,sun:16752720,sunIntensity:1,ambientIntensity:.26,fog:10517096},{t:.78,skyTop:2304594,skyBottom:9065824,sun:14191194,sunIntensity:.25,ambientIntensity:.11,fog:4603476},{t:1,skyTop:725030,skyBottom:1712960,sun:9348824,sunIntensity:.03,ambientIntensity:.06,fog:1317422}],o=[],i=[];for(let d of e.lamps??[])(d.isObject3D?d:d.object).traverse(h=>{h instanceof Ks&&o.push({light:h,base:h.intensity||6});let p=h.material;p?.emissive&&p.emissiveIntensity>.5&&i.push({material:p,base:p.emissiveIntensity})});let s=new fn,c=new fn,l=e.timeOfDay??.5,r=0,u=d=>{let m=n[0],h=n[n.length-1];for(let v=0;v<n.length-1;v++)if(d>=n[v].t&&d<=n[v+1].t){m=n[v],h=n[v+1];break}let p=h.t===m.t?0:(d-m.t)/(h.t-m.t),g=(v,w)=>s.setHex(v).lerp(c.setHex(w),p).getHex();return{t:d,skyTop:g(m.skyTop,h.skyTop),skyBottom:g(m.skyBottom,h.skyBottom),sun:g(m.sun,h.sun),sunIntensity:m.sunIntensity+(h.sunIntensity-m.sunIntensity)*p,ambientIntensity:m.ambientIntensity+(h.ambientIntensity-m.ambientIntensity)*p,fog:g(m.fog,h.fog)}},f=()=>{let d=l,m=u(d),h=(d-.25)*Math.PI*2;if(r=Math.sin(h),e.sky?.setColors(m.skyTop,m.skyBottom),e.rig){let{sun:g,ambient:v,hemisphere:w}=e.rig;g.color.setHex(m.sun),g.intensity=m.sunIntensity,g.position.set(Math.cos(h)*40,Math.max(r,-.2)*45+6,16),v.intensity=m.ambientIntensity,w.intensity=m.ambientIntensity*1.4}e.scene?.fog&&"color"in e.scene.fog&&e.scene.fog.color.setHex(m.fog);let p=Math.min(1,Math.max(0,(.06-r)/.16));for(let{light:g,base:v}of o)g.intensity=v*p;for(let{material:g,base:v}of i)g.emissiveIntensity=.15*v+.85*v*p};return f(),{get timeOfDay(){return l},set timeOfDay(d){l=(d%1+1)%1,f()},get sunElevation(){return r},get isNight(){return r<0},update(d){l=(l+d/a)%1,f()},set(d){l=(d%1+1)%1,f()}}}var qs=`
uniform vec2  uWindDir;
uniform float uWindStrength;
uniform float uWindGust;
uniform float uWindWaveK;
uniform float uWindWaveSpeed;
uniform float uWindTime;
uniform float uWindHeight;
uniform float uWindStiff;
uniform float uWindAnchor;
`,Zs=`
{
  mat4 scenaWM = modelMatrix;
  #ifdef USE_INSTANCING
    scenaWM = modelMatrix * instanceMatrix;
  #endif
  vec3 scenaBase = scenaWM[3].xyz;
  float scenaLH = max(position.y - uWindAnchor, 0.0);
  float scenaSway = pow(clamp(scenaLH / max(uWindHeight, 1e-3), 0.0, 1.0), uWindStiff);
  if (uWindStrength > 0.0 && scenaSway > 0.0) {
    float scenaPhase = dot(scenaBase.xz, uWindDir) * uWindWaveK - uWindTime * uWindWaveSpeed;
    float scenaGust = mix(1.0, 0.5 + 0.5 * sin(scenaPhase), uWindGust);
    float scenaLean = uWindStrength * scenaGust * scenaSway;
    float scenaFlutter = 0.3 * uWindStrength * sin(scenaPhase * 1.7 + scenaBase.x) * scenaSway;
    vec2 scenaPerp = vec2(-uWindDir.y, uWindDir.x);
    vec3 scenaDisp = vec3(
      uWindDir.x * scenaLean + scenaPerp.x * scenaFlutter,
      -0.12 * abs(scenaLean),
      uWindDir.y * scenaLean + scenaPerp.y * scenaFlutter
    );
    mat3 scenaLin = mat3(scenaWM);
    float scenaInv = 1.0 / max(dot(scenaLin[0], scenaLin[0]), 1e-5);
    // transpose(M) * v via column dots \u2192 world displacement back into local space.
    transformed += vec3(dot(scenaLin[0], scenaDisp), dot(scenaLin[1], scenaDisp), dot(scenaLin[2], scenaDisp)) * scenaInv;
  }
}
`;function mn(e,t){if(Array.isArray(e))t.set(e[0],e[1]);else{let a=e*Math.PI/180;t.set(Math.cos(a),Math.sin(a))}return t.lengthSq()<1e-9&&t.set(1,0),t.normalize()}function hn(){return typeof performance<"u"?performance.now()*.001:0}function no(e={}){let t=mn(e.direction??35,new dn),a=e.strength??.3,n=Math.max(0,Math.min(1,e.gust??.5)),o=e.waveLength??6,i=e.waveSpeed??2.2,s={uWindDir:{value:t},uWindStrength:{value:a},uWindGust:{value:n},uWindWaveK:{value:Math.PI*2/Math.max(o,.01)},uWindWaveSpeed:{value:i},uWindTime:{value:0}},c=[],l=!1,r={uniforms:s,direction:t,get strength(){return a},set strength(u){a=u,s.uWindStrength.value=u},materials:c,setDirection(u){return mn(u,t),r},setStrength(u){return r.strength=u,r},sample(u,f,d){let m=d??(l?s.uWindTime.value:hn()),h=(u*t.x+f*t.y)*s.uWindWaveK.value-m*i,p=1-n+n*(.5+.5*Math.sin(h)),g=a*p;return new dn(t.x*g,t.y*g)},bind(u,f={}){let d=u.userData??(u.userData={});if(d.__scenaWind)return r;d.__scenaWind=!0;let m={uWindHeight:{value:f.height??1},uWindStiff:{value:f.stiffness??1.6},uWindAnchor:{value:f.anchor??0}},h=u.onBeforeCompile,p=u.customProgramCacheKey?u.customProgramCacheKey():"";return u.onBeforeCompile=function(g,v){h&&h.call(this,g,v),Object.assign(g.uniforms,s,m),g.vertexShader=g.vertexShader.replace("#include <common>",`#include <common>
`+qs).replace("#include <begin_vertex>",`#include <begin_vertex>
`+Zs)},u.customProgramCacheKey=()=>p+"|scena-wind-v1",u.needsUpdate=!0,c.push(u),r},attach(u){let f=u instanceof ht?u:null;if(f||u.traverse(d=>{!f&&d instanceof ht&&(f=d)}),f){let d=f,m=d.onBeforeRender;d.onBeforeRender=function(...h){m&&m.apply(this,h),l||(s.uWindTime.value=hn())}}return r},sway(u,f){let d=new Set;return u.traverse(m=>{if(!(m instanceof ht))return;let h=Array.isArray(m.material)?m.material:[m.material];for(let p of h)p&&!d.has(p)&&(d.add(p),r.bind(p,f))}),r.attach(u),r},update(u){l=!0,s.uWindTime.value+=u}};return r}function Xs(e,t={}){let a=t.field??no(t);return a.sway(e,{height:t.height??2.5,stiffness:t.stiffness,anchor:t.anchor??t.anchorHeight??0}),a}var ar=`
uniform float uTime;
uniform vec3  uArea;
uniform vec2  uWind;
uniform float uFall;
uniform float uStreak;
uniform float uIntensity;
attribute float aEnd;
varying float vKeep;
void main() {
  vec3 home = position * uArea;
  vKeep = step(fract(position.x * 91.7 + position.z * 47.3), uIntensity);
  vec3 vel = vec3(uWind.x, -uFall, uWind.y);
  vec3 p = home + vel * uTime;
  vec3 halfA = uArea * 0.5;
  vec3 world = mod(p - (cameraPosition - halfA), uArea) + (cameraPosition - halfA);
  world -= normalize(vel) * (uStreak * aEnd);      // tail trails up the velocity
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  if (vKeep < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`,sr=`
uniform float uTime;
uniform vec3  uArea;
uniform vec2  uWind;
uniform float uFall;
uniform float uSize;
uniform float uIntensity;
varying float vKeep;
void main() {
  vec3 home = position * uArea;
  vKeep = step(fract(position.x * 91.7 + position.z * 47.3), uIntensity);
  vec3 p = home;
  p.y -= uFall * uTime;
  p.x += uWind.x * uTime + sin(uTime * 1.3 + home.y * 3.1) * 0.6;   // lateral wobble
  p.z += uWind.y * uTime + cos(uTime * 1.1 + home.x * 3.7) * 0.6;
  vec3 halfA = uArea * 0.5;
  vec3 world = mod(p - (cameraPosition - halfA), uArea) + (cameraPosition - halfA);
  vec4 mv = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  // Clamp so flakes near the camera don't balloon into a white veil.
  gl_PointSize = vKeep * min(uSize * (320.0 / max(-mv.z, 1.0)), 16.0);
  if (vKeep < 0.5) gl_Position = vec4(2.0);
}
`,rr=`
uniform vec3 uColor;
uniform float uOpacity;
varying float vKeep;
void main() {
  if (vKeep < 0.5) discard;
  gl_FragColor = vec4(uColor, uOpacity);
}
`,ir=`
uniform vec3 uColor;
uniform float uOpacity;
varying float vKeep;
void main() {
  if (vKeep < 0.5) discard;
  vec2 c = gl_PointCoord - 0.5;
  float d = 1.0 - smoothstep(0.15, 0.5, length(c));   // soft round flake
  if (d <= 0.0) discard;
  gl_FragColor = vec4(uColor, uOpacity * d);
}
`,cr=`
uniform float uTime;
uniform vec3  uArea;
uniform vec2  uWind;
uniform float uFall;
uniform float uSize;
uniform float uIntensity;
varying float vKeep;
varying float vSpin;
void main() {
  vec3 home = position * uArea;
  vKeep = step(fract(position.x * 91.7 + position.z * 47.3), uIntensity);
  float seed = fract(position.y * 57.3 + position.x * 13.1) * 6.2831;
  vec3 p = home;
  p.y -= uFall * uTime;
  // Wide, lazy flutter \u2014 petals swing far more than a snowflake wobbles.
  p.x += uWind.x * uTime + sin(uTime * 1.6 + home.y * 3.1 + seed) * 1.4;
  p.z += uWind.y * uTime + cos(uTime * 1.3 + home.x * 3.7 + seed) * 1.4;
  vec3 halfA = uArea * 0.5;
  vec3 world = mod(p - (cameraPosition - halfA), uArea) + (cameraPosition - halfA);
  vec4 mv = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vKeep * min(uSize * (320.0 / max(-mv.z, 1.0)), 18.0);
  vSpin = uTime * 2.0 + seed;
  if (vKeep < 0.5) gl_Position = vec4(2.0);
}
`,lr=`
uniform vec3 uColor;
uniform float uOpacity;
varying float vKeep;
varying float vSpin;
void main() {
  if (vKeep < 0.5) discard;
  vec2 c = gl_PointCoord - 0.5;
  float cs = cos(vSpin), sn = sin(vSpin);
  c = mat2(cs, -sn, sn, cs) * c;   // spin the petal
  c.x *= 1.7;                       // squash to an oval petal
  float a = (1.0 - smoothstep(0.28, 0.5, length(c))) * uOpacity;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(uColor, a);
}
`;function ur(e,t){return e===void 0?t:typeof e=="number"?new tt(e,e,e):new tt(e[0],e[1],e[2])}function wn(){return typeof performance<"u"?performance.now()*.001:0}function yn(e={}){let t=e.type??"rain",a=t==="rain",n=t==="petal",o=e.count??(a?6e3:n?1400:3500),i=ur(e.area,new tt(55,34,55)),s=e.speed??(a?14:n?1.4:2.2),c=e.size??(a?.5:n?11:9),l=e.windInfluence??(a?9:n?5:4),r=new Y(e.seed??1),u=e.wind,f=new Js,d=a?o*2:o,m=new Float32Array(d*3),h=a?new Float32Array(d):null;for(let M=0;M<o;M++){let x=r.next(),b=r.next(),P=r.next();if(a)for(let I=0;I<2;I++){let G=M*2+I;m[G*3]=x,m[G*3+1]=b,m[G*3+2]=P,h[G]=I}else m[M*3]=x,m[M*3+1]=b,m[M*3+2]=P}f.setAttribute("position",new pn(m,3)),h&&f.setAttribute("aEnd",new pn(h,1)),f.boundingSphere=new nr(new tt,1e6);let p=new tr({vertexShader:a?ar:n?cr:sr,fragmentShader:a?rr:n?lr:ir,transparent:!0,depthWrite:!1,uniforms:{uTime:{value:0},uArea:{value:i},uWind:{value:new or(0,0)},uFall:{value:s},uIntensity:{value:e.intensity??1},uColor:{value:new gn(e.color??(a?11519192:n?15974870:16054524))},uOpacity:{value:e.opacity??(a?.5:n?.9:.85)},...a?{uStreak:{value:c}}:{uSize:{value:c}}}}),g=a?new Qs(f,p):new er(f,p);g.frustumCulled=!1,g.name=`precipitation-${t}`;let v=null,w=!1,S=wn(),y=M=>{if(u){let x=u.uniforms.uWindDir.value,b=u.uniforms.uWindStrength.value*l;p.uniforms.uWind.value.set(x.x*b,x.y*b)}if(v){let x=v.max*p.uniforms.uIntensity.value;for(let b of v.entries){let P=b.material.userData,I=P.scenaShader?.uniforms,G=P.scenaSurface,F=Math.min(x,(G?.uSurfCap.value??0)+v.rate*M);for(let V of[G,I])V&&(b.configured||(V.uSurfCapColor.value.copy(v.color),V.uSurfCapUp.value=v.capUp,V.uSurfCapSharp.value=.3,V.uSurfCapRough.value=.9),V.uSurfCap.value=F);I&&(b.configured=!0)}}};g.onBeforeRender=()=>{let M=wn(),x=Math.min(.1,Math.max(0,M-S));S=M,w||(p.uniforms.uTime.value=M%1e3,y(x))};let k={object:g,material:p,setIntensity(M){p.uniforms.uIntensity.value=Math.max(0,Math.min(1,M))},accumulate(M,x={}){if(t!=="snow")return k;let b=[];return M.traverse(P=>{let I=P.material??[];for(let G of Array.isArray(I)?I:[I]){let F=G.userData?.scenaSurface;F&&F.uSurfCap&&F.uSurfCap.value===0&&b.push({material:G,configured:!1})}}),v={entries:b,color:new gn(x.color??16054524),capUp:x.capUp??.25,max:x.max??.85,rate:x.rate??.08},k},update(M){w=!0,p.uniforms.uTime.value+=M,y(M)}};return k}var he=4,pr=9.8,gr=[0,.34,-.52,.82],wr=[1,.55,.32,.19],yr=[1,.52,.3,.17],vr=`
uniform float uTime;
uniform float uStorm;
uniform vec2  uWaveDir[${he}];
uniform vec4  uWaveParams[${he}];  // (wavenumber, amplitude, steepness Q, phase speed)
`,br=`
vec3 scenaDisp = vec3(0.0);
float scNx = 0.0, scNy = 0.0, scNz = 0.0, scCrest = 0.0;
for (int i = 0; i < ${he}; i++) {
  vec2 D = uWaveDir[i];
  float w = uWaveParams[i].x, A = uWaveParams[i].y, Q = uWaveParams[i].z, spd = uWaveParams[i].w;
  float ph = dot(D, position.xz) * w + uTime * spd;
  float c = cos(ph), s = sin(ph);
  scenaDisp.x += Q * A * D.x * c;
  scenaDisp.z += Q * A * D.y * c;
  scenaDisp.y += A * s;
  float wa = w * A;
  scNx += D.x * wa * c;
  scNz += D.y * wa * c;
  scNy += Q * wa * s;
  scCrest += Q * wa * s;
}
objectNormal = normalize(vec3(-scNx, 1.0 - scNy, -scNz));
// Whitecaps where the sum folds \u2014 a storm broadens them across the crests.
vOceanFoam = smoothstep(mix(0.5, 0.18, uStorm), 1.0, scCrest);
`,xr=`
transformed += scenaDisp;
vOceanShore = aOceanShore;
`;function Mr(){return typeof performance<"u"?performance.now()*.001:0}function a0(e={}){let t=e.level??0,a=e.size??240,n=e.segments??180,o=e.amplitude??.5,i=Math.max(0,Math.min(1,e.choppiness??.75)),s=e.wavelength??26,c=e.speed??1,l=e.wind,r=e.shore,u=e.surge??1.2,f=typeof e.storm=="function"?e.storm:e.storm!==void 0?()=>e.storm:null,d=new fr,m=n+1,h=new Float32Array(m*m*3),p=new Float32Array(m*m*3),g=new Float32Array(m*m*2),v=new Float32Array(m*m);for(let A=0;A<m;A++)for(let T=0;T<m;T++){let C=A*m+T,B=(T/n-.5)*a,z=(A/n-.5)*a;h[C*3]=B,h[C*3+1]=0,h[C*3+2]=z,p[C*3+1]=1,g[C*2]=T/n,g[C*2+1]=A/n,v[C]=r?t-r(B,z):999}let w=[];for(let A=0;A<n;A++)for(let T=0;T<n;T++){let C=A*m+T,B=C+1,z=C+m,R=z+1;w.push(C,z,B,B,z,R)}d.setAttribute("position",new Ye(h,3)),d.setAttribute("normal",new Ye(p,3)),d.setAttribute("uv",new Ye(g,2)),d.setAttribute("aOceanShore",new Ye(v,1)),d.setIndex(w),d.computeBoundingSphere();let S=[];for(let A=0;A<he;A++){let T=Math.PI*2/(s*wr[A]);S.push({w:T,amp:o*yr[A],speed:Math.sqrt(pr*T)*c})}let y=Array.from({length:he},()=>new vn(1,0)),k=Array.from({length:he},()=>new hr(0,0,0,0)),M=Array.from({length:he},()=>new vn(1,0)),x=new Float32Array(he),b={uTime:{value:0},uWaveDir:{value:y},uWaveParams:{value:k},uDeepColor:{value:new pt(e.deepColor??1591907)},uShallowColor:{value:new pt(e.shallowColor??4165542)},uSkyColor:{value:new pt(e.skyColor??12375270)},uShoalDepth:{value:3},uFoamBand:{value:.6},uStorm:{value:0},uSurge:{value:0}},P=t,I=()=>{let A=(e.direction??30)*Math.PI/180,T=1;if(l){let R=l.uniforms.uWindDir.value;A=Math.atan2(R.y,R.x),T=Math.max(.55,Math.min(1.7,.55+l.uniforms.uWindStrength.value*2.4))}let C=f?Math.max(0,Math.min(1,f())):0,B=1+C*2.2,z=Math.min(1,i+C*(1-i));b.uStorm.value=C,b.uSurge.value=u*C,P=t+u*C;for(let R=0;R<he;R++){let W=A+gr[R];M[R].set(Math.cos(W),Math.sin(W)),y[R].copy(M[R]);let _=S[R].amp*T*B;x[R]=_;let j=Math.min(z/(S[R].w*_*he||1),.98/(S[R].w*_||1)),E=b.uWaveParams.value[R];E.x=S[R].w,E.y=_,E.z=j,E.w=S[R].speed}};I();let G=new mr({color:2780034,metalness:0,roughness:.18});G.onBeforeCompile=A=>{Object.assign(A.uniforms,b),A.vertexShader=A.vertexShader.replace("#include <common>",`#include <common>
${vr}
attribute float aOceanShore;
varying float vOceanFoam;
varying float vOceanShore;`).replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
${br}`).replace("#include <begin_vertex>",`#include <begin_vertex>
${xr}`),A.fragmentShader=A.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSkyColor;
uniform float uShoalDepth;
uniform float uFoamBand;
uniform float uStorm;
uniform float uSurge;
varying float vOceanFoam;
varying float vOceanShore;`).replace("#include <map_fragment>",`#include <map_fragment>
        // The surge lifts the waterline, so a storm floods higher up the beach.
        float shoreD = vOceanShore + uSurge;
        if (shoreD < -0.06) discard;             // terrain stands above the sea here
        float shoal = clamp(shoreD / uShoalDepth, 0.0, 1.0);
        diffuseColor.rgb = mix(uShallowColor, uDeepColor, shoal);
        float shoreFoam = (1.0 - smoothstep(0.0, uFoamBand, shoreD)) * step(0.0, shoreD);
        float oceanFoam = clamp(max(vOceanFoam, shoreFoam), 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.96, 0.97), oceanFoam);
        // A storm darkens and greys the water between the whitecaps.
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.18, 0.2), uStorm * 0.45 * (1.0 - oceanFoam));`).replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
        {
          // View-space fresnel: tint toward the sky at grazing angles.
          float fres = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 5.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSkyColor, fres * 0.5 * (1.0 - oceanFoam));
        }`).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.85, oceanFoam);`)},G.customProgramCacheKey=()=>"scena-ocean-v1";let F=new dr(d,G);F.name="ocean",F.position.y=t,F.frustumCulled=!1;let V=!1;return F.onBeforeRender=()=>{V||(b.uTime.value=Mr(),I(),F.position.y=P)},{mesh:F,level:t,heightAt:(A,T,C)=>{let B=C??b.uTime.value,z=0;for(let R=0;R<he;R++)z+=x[R]*Math.sin((M[R].x*A+M[R].y*T)*S[R].w+B*S[R].speed);return P+z},update(A){V=!0,b.uTime.value+=A,I(),F.position.y=P}}}var gt={clear:{wind:.15,gust:.4,rain:0,snow:0,fogColor:12375270,fogNear:30,fogFar:200,sky:12375270,light:1,sea:.05},overcast:{wind:.3,gust:.5,rain:0,snow:0,fogColor:10135472,fogNear:24,fogFar:140,sky:10135472,light:.7,sea:.22},fog:{wind:.1,gust:.3,rain:0,snow:0,fogColor:12765388,fogNear:3,fogFar:30,sky:12765388,light:.85,sea:.08},rain:{wind:.4,gust:.6,rain:.7,snow:0,fogColor:7635082,fogNear:16,fogFar:90,sky:7635082,light:.55,sea:.5},storm:{wind:.9,gust:.9,rain:1,snow:0,fogColor:5660520,fogNear:10,fogFar:62,sky:5660520,light:.4,sea:1,lightning:!0},snow:{wind:.25,gust:.4,rain:0,snow:.7,fogColor:13489885,fogNear:16,fogFar:90,sky:13489885,light:.8,sea:.15},blizzard:{wind:.8,gust:.9,rain:0,snow:1,fogColor:14542572,fogNear:6,fogFar:40,sky:14542572,light:.62,sea:.7,lightning:!1}};function xn(e){return{wind:e.wind,gust:e.gust,rain:e.rain,snow:e.snow,fogColor:new nt(e.fogColor),fogNear:e.fogNear,fogFar:e.fogFar,sky:new nt(e.sky),light:e.light,sea:e.sea??0,lightning:!!e.lightning}}function wt(e){return{...e,fogColor:e.fogColor.clone(),sky:e.sky.clone()}}var ye=(e,t,a)=>e+(t-e)*a,Sr=e=>e*e*(3-2*e);function Mn(){return typeof performance<"u"?performance.now()*.001:0}function r0(e,t={}){let a=t.fog??!0,n=t.background??!0,o=new Y(t.seed??1),i={};for(let[A,T]of Object.entries(gt))i[A]={...T};if(t.states)for(let[A,T]of Object.entries(t.states))i[A]={...i[A]??gt.clear,...T};let s=A=>i[A]??gt.clear,c=t.wind??no({direction:35,strength:.15,gust:.4}),l=yn({type:"rain",wind:c,count:t.rainCount??6e3,intensity:0}),r=yn({type:"snow",wind:c,count:t.snowCount??3500,intensity:0});t.accumulateOn&&r.accumulate(t.accumulateOn),e.add(l.object,r.object);let u=null;a&&(e.fog instanceof bn?u=e.fog:(u=new bn(12375270,30,200),e.fog=u));let f=n&&e.background instanceof nt?e.background:null,d=t.sun??null,m=t.ambient??null,h=d?d.intensity:0,p=m?m.intensity:0,g=t.initial??"clear",v=xn(s(g)),w=wt(v),S=wt(v),y=1,k=1,M=g,x=o.range(3,9),b=0,P=()=>{c.setStrength(v.wind),c.uniforms.uWindGust.value=v.gust,l.setIntensity(v.rain),r.setIntensity(v.snow),u&&(u.color.copy(v.fogColor),u.near=v.fogNear,u.far=v.fogFar);let A=Math.min(1,v.light+b*.9);f&&(f.copy(v.sky),b>0&&f.lerp(new nt(16777215),b*.7)),d&&(d.intensity=h*A+h*b*1.4),m&&(m.intensity=p*A+p*b*1.4)};P();let I=A=>{if(A=Math.min(.1,Math.max(0,A)),y<1){y=Math.min(1,y+A/k);let T=Sr(y);v.wind=ye(w.wind,S.wind,T),v.gust=ye(w.gust,S.gust,T),v.rain=ye(w.rain,S.rain,T),v.snow=ye(w.snow,S.snow,T),v.fogNear=ye(w.fogNear,S.fogNear,T),v.fogFar=ye(w.fogFar,S.fogFar,T),v.light=ye(w.light,S.light,T),v.sea=ye(w.sea,S.sea,T),v.fogColor.lerpColors(w.fogColor,S.fogColor,T),v.sky.lerpColors(w.sky,S.sky,T),v.lightning=T>.5?S.lightning:w.lightning}v.lightning&&(x-=A,x<=0&&(b=1,x=o.range(4,11))),b=Math.max(0,b-A*5.5),P()},G=!1,F=Mn(),V=l.object.onBeforeRender;l.object.onBeforeRender=function(...A){if(V&&V.apply(this,A),!G){let T=Mn();I(T-F),F=T}};let L={wind:c,rain:l,snow:r,objects:[l.object,r.object],get state(){return M},get storminess(){return v.sea},set(A,T={}){return w=wt(v),S=xn(s(A)),y=0,k=Math.max(.001,T.fade??4),M=A,L},update(A){G=!0,I(A)}};return L}var Ke={spring:{tint:12574832,tintAmount:.32,saturation:1.12,brightness:1.08},summer:{tint:4160815,tintAmount:0,saturation:1,brightness:1},autumn:{tint:13597220,tintAmount:.62,saturation:1.2,brightness:.95},winter:{tint:7299920,tintAmount:.58,saturation:.35,brightness:.72}},Ar=`
uniform vec3  uSeasonTint;
uniform float uSeasonTintAmt;
uniform float uSeasonSat;
uniform float uSeasonBright;
`,kr=`
{
  vec3 scenaSeason = diffuseColor.rgb;
  float scenaLum = dot(scenaSeason, vec3(0.299, 0.587, 0.114));
  scenaSeason = mix(vec3(scenaLum), scenaSeason, uSeasonSat);
  scenaSeason = mix(scenaSeason, uSeasonTint, uSeasonTintAmt);
  diffuseColor.rgb = max(scenaSeason * uSeasonBright, vec3(0.0));
}
`,vt=(e,t,a)=>e+(t-e)*a,zr=e=>e*e*(3-2*e);function bt(){return typeof performance<"u"?performance.now()*.001:0}function Ve(e){return{tint:new Cr(e.tint),tintAmount:e.tintAmount,saturation:e.saturation,brightness:e.brightness}}function c0(e={}){let t={spring:{...Ke.spring},summer:{...Ke.summer},autumn:{...Ke.autumn},winter:{...Ke.winter}};if(e.grades)for(let g of Object.keys(e.grades))t[g]={...t[g],...e.grades[g]};let a=e.initial??"summer",n=Ve(t[a]),o={uSeasonTint:{value:n.tint},uSeasonTintAmt:{value:n.tintAmount},uSeasonSat:{value:n.saturation},uSeasonBright:{value:n.brightness}},i=[],s=Ve(t[a]),c=Ve(t[a]),l=1,r=1,u=a,f=()=>{o.uSeasonTint.value=n.tint,o.uSeasonTintAmt.value=n.tintAmount,o.uSeasonSat.value=n.saturation,o.uSeasonBright.value=n.brightness},d=g=>{if(l>=1)return;g=Math.min(.1,Math.max(0,g)),l=Math.min(1,l+g/r);let v=zr(l);n.tint.lerpColors(s.tint,c.tint,v),n.tintAmount=vt(s.tintAmount,c.tintAmount,v),n.saturation=vt(s.saturation,c.saturation,v),n.brightness=vt(s.brightness,c.brightness,v),f()},m=!1,h=bt(),p={uniforms:o,get season(){return u},materials:i,bind(g){let v=g.userData??(g.userData={});if(v.__scenaSeason)return p;v.__scenaSeason=!0;let w=g.onBeforeCompile,S=g.customProgramCacheKey?g.customProgramCacheKey():"";return g.onBeforeCompile=function(y,k){w&&w.call(this,y,k),Object.assign(y.uniforms,o),y.fragmentShader=y.fragmentShader.replace("#include <common>",`#include <common>
`+Ar).replace("#include <color_fragment>",`#include <color_fragment>
`+kr)},g.customProgramCacheKey=()=>S+"|scena-season-v1",g.needsUpdate=!0,i.push(g),p},attach(g){let v=g instanceof yt?g:null;if(v||g.traverse(w=>{!v&&w instanceof yt&&(v=w)}),v){let w=v,S=w.onBeforeRender;w.onBeforeRender=function(...y){if(S&&S.apply(this,y),!m){let k=bt();d(k-h),h=k}}}return p},apply(g){let v=new Set;return g.traverse(w=>{if(!(w instanceof yt))return;let S=Array.isArray(w.material)?w.material:[w.material];for(let y of S)y&&y.userData?.scenaFoliage&&!v.has(y)&&(v.add(y),p.bind(y))}),p.attach(g),p},set(g,v={}){return s=Ve({tint:n.tint.getHex(),tintAmount:n.tintAmount,saturation:n.saturation,brightness:n.brightness}),c=Ve(t[g]??t.summer),l=0,r=Math.max(.001,v.fade??6),u=g,h=bt(),p},update(g){m=!0,d(g)}};return f(),p}var Tr=`
uniform float uTime;
uniform float uSway;
attribute float aRayV;
attribute float aRayU;
attribute float aPhase;
varying float vV;
varying float vU;
varying float vPhase;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.5 + aPhase) * uSway * aRayV;
  p.z += cos(uTime * 0.4 + aPhase * 1.3) * uSway * 0.6 * aRayV;
  vV = aRayV; vU = aRayU; vPhase = aPhase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`,Gr=`
uniform vec3  uColor;
uniform float uOpacity;
uniform float uTime;
varying float vV;
varying float vU;
varying float vPhase;
void main() {
  float vert = 1.0 - vV;          // brightest near the surface
  vert *= vert;
  float horiz = 1.0 - abs(vU);    // soft feathered sides
  horiz *= horiz;
  float flick = 0.7 + 0.3 * sin(uTime * 1.3 + vPhase * 4.0);
  float a = vert * horiz * uOpacity * flick;
  gl_FragColor = vec4(uColor * a, a);
}
`;function jt(){return typeof performance<"u"?performance.now()*.001:0}function u0(e={}){let t=e.count??18,a=e.height??20,n=e.width??1.4,o=e.spread??14,i=(e.tilt??18)*Math.PI/180,s=(e.azimuth??0)*Math.PI/180,c=new Y(e.seed??1),l=n*.5,r=Math.tan(i)*a,u=Math.cos(s)*r,f=Math.sin(s)*r,d=8,m=4,h=new Float32Array(t*d*3),p=new Float32Array(t*d),g=new Float32Array(t*d),v=new Float32Array(t*d),w=[];for(let x=0;x<t;x++){let b=Math.sqrt(c.next())*o,P=c.next()*Math.PI*2,I=Math.cos(P)*b,G=Math.sin(P)*b,F=c.range(0,Math.PI*2),V=I+u,L=G+f,A=x*d,T=[[I-l,G,I+l,G,V-l,L],[I,G-l,I,G+l,V,L-l]];for(let C=0;C<2;C++){let[B,z,R,W,_,j]=T[C],E=C===0?V+l:V,oe=C===0?L:L+l,te=[[B,0,z,0,-1],[R,0,W,0,1],[_,-a,j,1,-1],[E,-a,oe,1,1]],$=A+C*4;for(let X=0;X<4;X++){let J=$+X;h[J*3]=te[X][0],h[J*3+1]=te[X][1],h[J*3+2]=te[X][2],p[J]=te[X][3],g[J]=te[X][4],v[J]=F}w.push($,$+2,$+1,$+1,$+2,$+3)}}let S=new oo;S.setAttribute("position",new Se(h,3)),S.setAttribute("aRayV",new Se(p,1)),S.setAttribute("aRayU",new Se(g,1)),S.setAttribute("aPhase",new Se(v,1)),S.setIndex(w),S.boundingSphere=new so(new ro(0,-a*.5,0),o+a);let y=new ao({vertexShader:Tr,fragmentShader:Gr,transparent:!0,depthWrite:!1,blending:Ir,side:2,uniforms:{uTime:{value:0},uSway:{value:e.sway??.5},uColor:{value:new at(e.color??12576496)},uOpacity:{value:e.opacity??.14}}}),k=new He(S,y);k.name="god-rays",k.frustumCulled=!1;let M=!1;return k.onBeforeRender=()=>{M||(y.uniforms.uTime.value=jt())},{object:k,material:y,setOpacity(x){y.uniforms.uOpacity.value=Math.max(0,x)},update(x){M=!0,y.uniforms.uTime.value+=x}}}var Sn=`
varying highp vec3 vCausticWorld;
`,Rr=`
uniform vec3  uCausticColor;
uniform highp float uCausticScale;
uniform highp float uCausticTime;
uniform float uCausticSpeed;
uniform float uCausticIntensity;
float scenaCausticCell(highp vec2 p) {
  highp float s = sin(p.x) * sin(p.y);
  return pow(max(s, 0.0), 8.0);
}
float scenaCaustics(highp vec2 uv, highp float t) {
  mat2 R = mat2(0.8, -0.6, 0.6, 0.8);
  float a = scenaCausticCell(uv + vec2(t, t * 0.7));
  float b = scenaCausticCell(R * uv * 1.3 + vec2(-t * 0.8, t * 0.5));
  float c = scenaCausticCell(R * R * uv * 0.7 + vec2(t * 0.5, -t * 0.6));
  return clamp(a + b + c, 0.0, 1.0);
}
`;function f0(e={}){let t={uCausticColor:{value:new at(e.color??10475750)},uCausticScale:{value:e.scale??.5},uCausticTime:{value:0},uCausticSpeed:{value:e.speed??.6},uCausticIntensity:{value:e.intensity??.5}},a=[],n=!1,o={uniforms:t,materials:a,setIntensity(i){return t.uCausticIntensity.value=Math.max(0,i),o},bind(i){let s=i.userData??(i.userData={});if(s.__scenaCaustics)return o;s.__scenaCaustics=!0;let c=i.onBeforeCompile,l=i.customProgramCacheKey?i.customProgramCacheKey():"";return i.onBeforeCompile=function(r,u){c&&c.call(this,r,u),Object.assign(r.uniforms,t),r.vertexShader=r.vertexShader.replace("#include <common>",`#include <common>
`+Sn).replace("#include <begin_vertex>",`#include <begin_vertex>
             {
               mat4 scenaCWM = modelMatrix;
               #ifdef USE_INSTANCING
                 scenaCWM = modelMatrix * instanceMatrix;
               #endif
               vCausticWorld = (scenaCWM * vec4(transformed, 1.0)).xyz;
             }`),r.fragmentShader=r.fragmentShader.replace("#include <common>",`#include <common>
`+Sn+Rr).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
             {
               float caust = scenaCaustics(vCausticWorld.xz * uCausticScale, uCausticTime * uCausticSpeed);
               totalEmissiveRadiance += uCausticColor * caust * uCausticIntensity;
             }`)},i.customProgramCacheKey=()=>l+"|scena-caustics-v1",i.needsUpdate=!0,a.push(i),o},attach(i){let s=i instanceof He?i:null;if(s||i.traverse(c=>{!s&&c instanceof He&&(s=c)}),s){let c=s,l=c.onBeforeRender;c.onBeforeRender=function(...r){l&&l.apply(this,r),n||(t.uCausticTime.value=jt())}}return o},apply(i){let s=new Set;return i.traverse(c=>{if(!(c instanceof He))return;let l=Array.isArray(c.material)?c.material:[c.material];for(let r of l)r&&!s.has(r)&&(s.add(r),o.bind(r))}),o.attach(i),o},update(i){n=!0,t.uCausticTime.value+=i}};return o}var Br=`
uniform float uTime;
uniform float uSpeed;
uniform float uRise;
uniform float uFloor;
uniform float uSize;
uniform float uWobble;
uniform float uOpacity;
attribute float aPhase;
attribute float aWobble;
attribute float aScale;
varying float vAlpha;
void main() {
  float prog = fract(aPhase + uTime * uSpeed / uRise);
  float y = uFloor + prog * uRise;
  float w = uWobble * prog;                       // wander grows as it rises
  float x = position.x + sin(uTime * 1.5 + aWobble) * w;
  float z = position.z + cos(uTime * 1.2 + aWobble * 1.7) * w;
  vec4 mv = viewMatrix * modelMatrix * vec4(x, y, z, 1.0);
  gl_Position = projectionMatrix * mv;
  float grow = (0.55 + prog * 0.7) * aScale;       // bubbles swell as pressure drops
  gl_PointSize = clamp(uSize * grow * (300.0 / max(-mv.z, 1.0)), 1.0, 22.0);
  // Fade in off the vent, pop near the top.
  vAlpha = uOpacity * smoothstep(0.0, 0.06, prog) * (1.0 - smoothstep(0.82, 1.0, prog));
}
`,Fr=`
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // A hollow bubble: bright rim, faint fill.
  float body = 1.0 - smoothstep(0.34, 0.5, d);
  float rim = smoothstep(0.3, 0.44, d) * (1.0 - smoothstep(0.44, 0.5, d));
  float a = (body * 0.22 + rim * 0.95) * vAlpha;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(uColor, a);
}
`;function Wr(e){return e===void 0?[16,16]:typeof e=="number"?[e,e]:e}function d0(e={}){let t=e.count??240,a=e.columns??6,n=new Y(e.seed??1),[o,i]=Wr(e.area),s=e.sources??Array.from({length:a},()=>{let p=Math.sqrt(n.next()),g=n.next()*Math.PI*2;return[Math.cos(g)*p*o,Math.sin(g)*p*i]}),c=new Float32Array(t*3),l=new Float32Array(t),r=new Float32Array(t),u=new Float32Array(t);for(let p=0;p<t;p++){let g=s[p%s.length];c[p*3]=g[0]+n.range(-.3,.3),c[p*3+1]=0,c[p*3+2]=g[1]+n.range(-.3,.3),l[p]=n.next(),r[p]=n.range(0,Math.PI*2),u[p]=n.range(.6,1.4)}let f=new oo;f.setAttribute("position",new Se(c,3)),f.setAttribute("aPhase",new Se(l,1)),f.setAttribute("aWobble",new Se(r,1)),f.setAttribute("aScale",new Se(u,1)),f.boundingSphere=new so(new ro(0,(e.rise??8)*.5,0),Math.max(o,i)+(e.rise??8));let d=new ao({vertexShader:Br,fragmentShader:Fr,transparent:!0,depthWrite:!1,uniforms:{uTime:{value:0},uSpeed:{value:e.speed??1.2},uRise:{value:e.rise??8},uFloor:{value:e.floor??0},uSize:{value:e.size??8},uWobble:{value:e.wobble??.35},uOpacity:{value:e.opacity??.4},uColor:{value:new at(e.color??13626096)}}}),m=new Pr(f,d);m.name="bubbles",m.frustumCulled=!1;let h=!1;return m.onBeforeRender=()=>{h||(d.uniforms.uTime.value=jt())},{object:m,material:d,update(p){h=!0,d.uniforms.uTime.value+=p}}}var Cn=`
varying highp vec3 vWaterWorld;
`;function m0(e={}){let t={uWaterSurface:{value:e.surface??0},uWaterColor:{value:new at(e.color??932425)},uWaterDensity:{value:e.density??.022},uWaterDepth:{value:e.depthDensity??.03},uWaterRedShift:{value:e.redShift??.6}},a=[],n={uniforms:t,materials:a,setDensity(o){return t.uWaterDensity.value=Math.max(0,o),n},bind(o){let i=o.userData??(o.userData={});if(i.__scenaWaterGrade)return n;i.__scenaWaterGrade=!0;let s=o.onBeforeCompile,c=o.customProgramCacheKey?o.customProgramCacheKey():"";return o.onBeforeCompile=function(l,r){s&&s.call(this,l,r),Object.assign(l.uniforms,t),l.vertexShader=l.vertexShader.replace("#include <common>",`#include <common>
`+Cn).replace("#include <begin_vertex>",`#include <begin_vertex>
             {
               mat4 scenaGWM = modelMatrix;
               #ifdef USE_INSTANCING
                 scenaGWM = modelMatrix * instanceMatrix;
               #endif
               vWaterWorld = (scenaGWM * vec4(transformed, 1.0)).xyz;
             }`),l.fragmentShader=l.fragmentShader.replace("#include <common>",`#include <common>
${Cn}
             uniform highp float uWaterSurface;
             uniform vec3 uWaterColor;
             uniform float uWaterDensity;
             uniform float uWaterDepth;
             uniform float uWaterRedShift;`).replace("#include <fog_fragment>",`{
               // Beer\u2013Lambert extinction: warm light dies first, so distance and
               // depth pull everything toward the deep-water colour.
               highp float dist = length(vViewPosition);
               highp float depth = max(uWaterSurface - vWaterWorld.y, 0.0);
               highp float d = dist * uWaterDensity + depth * uWaterDepth;
               vec3 sigma = vec3(1.0 + uWaterRedShift, 1.0 + uWaterRedShift * 0.4, 1.0);
               vec3 trans = exp(-sigma * d);
               gl_FragColor.rgb = mix(uWaterColor, gl_FragColor.rgb, clamp(trans, 0.0, 1.0));
             }
             #include <fog_fragment>`)},o.customProgramCacheKey=()=>c+"|scena-watergrade-v1",o.needsUpdate=!0,a.push(o),n},apply(o){let i=new Set;return o.traverse(s=>{if(!(s instanceof He))return;let c=Array.isArray(s.material)?s.material:[s.material];for(let l of c)l&&!i.has(l)&&(i.add(l),n.bind(l))}),n}};return n}function Nr(e){let t=e,a=[[0,0,.55*t,0],[0,.09*t,-.2*t,0],[.05*t,0,-.15*t,0],[0,0,.55*t,0],[-.05*t,0,-.15*t,0],[0,.09*t,-.2*t,0],[0,0,.55*t,0],[.05*t,0,-.15*t,0],[0,-.05*t,-.18*t,0],[0,0,.55*t,0],[0,-.05*t,-.18*t,0],[-.05*t,0,-.15*t,0],[0,0,-.5*t,0],[0,.09*t,-.2*t,0],[0,-.05*t,-.18*t,0],[.04*t,0,.08*t,.3],[.95*t,.02*t,-.1*t,1],[.04*t,0,-.28*t,.3],[-.04*t,0,.08*t,-.3],[-.04*t,0,-.28*t,-.3],[-.95*t,.02*t,-.1*t,-1]];return io(a)}function jr(e){let t=e,a=[[0,0,.7*t,0],[.13*t,0,0,0],[0,.16*t,0,0],[0,0,.7*t,0],[0,.16*t,0,0],[-.13*t,0,0,0],[0,0,.7*t,0],[0,-.14*t,0,0],[.13*t,0,0,0],[0,0,.7*t,0],[-.13*t,0,0,0],[0,-.14*t,0,0],[0,0,-.5*t,.55],[0,.16*t,0,0],[.13*t,0,0,0],[0,0,-.5*t,.55],[-.13*t,0,0,0],[0,.16*t,0,0],[0,0,-.5*t,.55],[.13*t,0,0,0],[0,-.14*t,0,0],[0,0,-.5*t,.55],[0,-.14*t,0,0],[-.13*t,0,0,0],[0,0,-.5*t,.7],[0,.24*t,-.85*t,1],[0,-.22*t,-.85*t,1]];return io(a)}function io(e){let t=e.length,a=new Float32Array(t*3),n=new Float32Array(t);for(let i=0;i<t;i++)a[i*3]=e[i][0],a[i*3+1]=e[i][1],a[i*3+2]=e[i][2],n[i]=e[i][3];let o=new _r;return o.setAttribute("position",new An(a,3)),o.setAttribute("aFlap",new An(n,1)),o.computeVertexNormals(),o}function Or(e,t,a){let n={uTime:{value:0},uFlapSpeed:{value:t},uFlapAmp:{value:a?.6:.9},uFishMode:{value:a?1:0}},o=new Dr({color:e,roughness:.7,metalness:0,flatShading:!0});return o.onBeforeCompile=i=>{Object.assign(i.uniforms,n),i.vertexShader=i.vertexShader.replace("#include <common>",`#include <common>
         attribute float aFlap;
         attribute float aPhase;
         uniform float uTime, uFlapSpeed, uFlapAmp, uFishMode;`).replace("#include <begin_vertex>",`#include <begin_vertex>
         {
           float wave = sin(uTime * uFlapSpeed + aPhase) * uFlapAmp;
           float ang = wave * aFlap;
           float c = cos(ang), s = sin(ang);
           if (uFishMode > 0.5) transformed.xz = mat2(c, -s, s, c) * transformed.xz;
           else                 transformed.xy = mat2(c, -s, s, c) * transformed.xy;
         }`)},o.customProgramCacheKey=()=>"scena-flock-v1",{material:o,uniforms:n}}function kn(){return typeof performance<"u"?performance.now()*.001:0}function p0(e={}){let t=e.type??"birds",a=t==="fish",n=e.count??(a?80:60),o=new ue(...e.center??(a?[0,2,0]:[0,12,0])),i=e.bounds??[26,6,26],s=new ue(...typeof i=="number"?[i,i,i]:i),c=e.speed??(a?3:7),l=e.size??(a?.4:.5),r=e.beat??(a?5:9),u=e.separation??1.5,f=e.alignment??1,d=e.cohesion??.9,m=e.circle??0,h=new Y(e.seed??1),p=a?jr(l):Nr(l),{material:g,uniforms:v}=Or(e.color??(a?6981280:2829104),r,a),w=new Float32Array(n);for(let W=0;W<n;W++)w[W]=h.range(0,Math.PI*2);p.setAttribute("aPhase",new Vr(w,1));let S=new Lr(p,g,n);S.name=`flock-${t}`,S.frustumCulled=!1;let y=[],k=[];for(let W=0;W<n;W++){y.push(new ue(o.x+h.range(-s.x,s.x),o.y+h.range(-s.y,s.y),o.z+h.range(-s.z,s.z)));let _=new ue(h.range(-1,1),h.range(-.3,.3),h.range(-1,1));_.lengthSq()<1e-4&&_.set(1,0,0),k.push(_.setLength(c))}let M=new Hr,x=new ue,b=new ue,P=new ue,I=new ue,G=new ue,F=new ue,V=new ue,L=new ue(0,1,0),A=4.5,T=a?1.2:2,C=()=>{for(let W=0;W<n;W++){let _=y[W],j=k[W],E=G.copy(j).normalize();F.copy(L).cross(E),F.lengthSq()<1e-5&&F.set(1,0,0),F.normalize(),V.copy(E).cross(F).normalize(),M.makeBasis(F,V,E),M.setPosition(_.x,_.y,_.z),S.setMatrixAt(W,M)}S.instanceMatrix.needsUpdate=!0};C();let B=!1,z=kn(),R=W=>{W=Math.min(.05,Math.max(0,W));for(let _=0;_<n;_++){let j=y[_],E=k[_];x.set(0,0,0),b.set(0,0,0),P.set(0,0,0);let oe=0;for(let $=0;$<n;$++){if($===_)continue;let X=y[$],J=j.distanceTo(X);J<A&&(b.add(k[$]),P.add(X),oe++,J<T&&J>1e-4&&(G.copy(j).sub(X).multiplyScalar(1/(J*J)),x.add(G)))}if(I.set(0,0,0),oe>0&&(b.multiplyScalar(1/oe).setLength(c).sub(E).multiplyScalar(f),P.multiplyScalar(1/oe).sub(j).multiplyScalar(d*.5),I.add(b).add(P)),x.lengthSq()>0&&I.add(x.setLength(c).multiplyScalar(u)),G.copy(o).sub(j),G.x=Math.abs(j.x-o.x)>s.x*.85?G.x:0,G.y=Math.abs(j.y-o.y)>s.y*.85?G.y:0,G.z=Math.abs(j.z-o.z)>s.z*.85?G.z:0,I.add(G.multiplyScalar(2.2)),m>0){let $=j.x-o.x,X=j.z-o.z,J=Math.hypot($,X)||.001;I.x+=-X/J*c*1.2+$/J*(m-J)*.4,I.z+=$/J*c*1.2+X/J*(m-J)*.4,I.y+=(o.y-j.y)*.6}I.x+=h.range(-1,1)*c*.4,I.y+=h.range(-1,1)*c*(a?.15:.2),I.z+=h.range(-1,1)*c*.4,E.addScaledVector(I,W);let te=E.length();te>c*1.5?E.setLength(c*1.5):te<c*.6&&E.setLength(c*.6),j.addScaledVector(E,W)}C()};return S.onBeforeRender=()=>{if(!B){let W=kn();v.uTime.value=W%1e3,R(W-z),z=W}},{object:S,count:n,positions:y,setCenter(W,_,j){o.set(W,_,j)},update(W){B=!0,v.uTime.value+=W,R(W)}}}function $r(){return{pos:[],hipY:[],hipZ:[],legPhase:[],head:[],col:[]}}function ve(e,t,a,n){let[o,i,s]=t,[c,l,r]=a,u=[[o,i,s],[c,i,s],[c,l,s],[o,l,s],[o,i,r],[c,i,r],[c,l,r],[o,l,r]],f=[[0,1,2],[0,2,3],[5,4,7],[5,7,6],[4,0,3],[4,3,7],[1,5,6],[1,6,2],[3,2,6],[3,6,7],[4,5,1],[4,1,0]];for(let d of f)for(let m of d){let h=u[m];e.pos.push(h[0],h[1],h[2]),n.hip?(e.hipY.push(n.hip[0]),e.hipZ.push(n.hip[1])):(e.hipY.push(h[1]),e.hipZ.push(h[2])),e.legPhase.push(n.legPhase??0),e.head.push(n.head??0),e.col.push(n.color[0],n.color[1],n.color[2])}}function qr(e,t){let a=t,n=$r(),o=e==="deer",i=[1,1,1],s=o?[.55,.5,.45]:[.32,.3,.32],c=(o?.62:.42)*a,l=(o?.05:.06)*a,r=c,u=(o?.34:.42)*a,f=(o?.16:.2)*a,d=(o?.5:.42)*a,m=c;ve(n,[-f,r,-d],[f,r+u,d],{color:i});let h=f-l,p=d-l*1.4,g=[[-h,p,0],[h,p,Math.PI],[-h,-p,Math.PI],[h,-p,0]];for(let[b,P,I]of g)ve(n,[b-l,0,P-l],[b+l,r+.02*a,P+l],{hip:[r,P],legPhase:I,color:s});let v=d,w=r+u+(o?.32:.14)*a;ve(n,[-f*.6,r+u*.4,v-.02*a],[f*.6,w,v+(o?.12:.16)*a],{head:.6,color:i});let S=v+(o?.06:.1)*a,y=S+(o?.26:.24)*a,k=w-.16*a,M=w+(o?.1:.06)*a;if(ve(n,[-f*.55,k,S],[f*.55,M,y],{head:1,color:s}),o){let b=f*.4,P=M,I=y-.06*a;for(let G of[-1,1])ve(n,[G*b-.02*a,P,I-.02*a],[G*b+.02*a,P+.3*a,I+.02*a],{head:1,color:s}),ve(n,[G*b-.02*a,P+.24*a,I-.18*a],[G*b+.02*a,P+.28*a,I+.02*a],{head:1,color:s})}else ve(n,[-f*1.05,r+u*.7,-d*.7],[f*1.05,r+u+.12*a,d*.55],{color:i});ve(n,[-.04*a,r+u*.5,-d-(o?.12:.08)*a],[.04*a,r+u*.85,-d],{color:o?i:s});let x=new Er;return x.setAttribute("position",new Ie(new Float32Array(n.pos),3)),x.setAttribute("aHipY",new Ie(new Float32Array(n.hipY),1)),x.setAttribute("aHipZ",new Ie(new Float32Array(n.hipZ),1)),x.setAttribute("aLegPhase",new Ie(new Float32Array(n.legPhase),1)),x.setAttribute("aHead",new Ie(new Float32Array(n.head),1)),x.setAttribute("color",new Ie(new Float32Array(n.col),3)),x.computeVertexNormals(),{geo:x,stand:m}}function Zr(e,t){let a={uTime:{value:0},uGaitSpeed:{value:t},uSwingAmp:{value:.7},uBobAmp:{value:.03},uGrazeDip:{value:.28}},n=new Kr({color:e,roughness:.85,metalness:0,flatShading:!0,vertexColors:!0});return n.onBeforeCompile=o=>{Object.assign(o.uniforms,a),o.vertexShader=o.vertexShader.replace("#include <common>",`#include <common>
         attribute float aHipY;
         attribute float aHipZ;
         attribute float aLegPhase;
         attribute float aHead;
         attribute float aPhase;
         attribute float aMove;
         uniform float uTime, uGaitSpeed, uSwingAmp, uBobAmp, uGrazeDip;`).replace("#include <begin_vertex>",`#include <begin_vertex>
         {
           float t = uTime * uGaitSpeed + aPhase;
           // Legs swing about the hip (rotate y/z about the pivot), scaled by
           // how fast the animal is actually moving.
           float swing = sin(t + aLegPhase) * uSwingAmp * aMove;
           float ly = transformed.y - aHipY;
           float lz = transformed.z - aHipZ;
           float c = cos(swing), sn = sin(swing);
           transformed.y = aHipY + (c * ly - sn * lz);
           transformed.z = aHipZ + (sn * ly + c * lz);
           // Body bob at twice stride, only while walking.
           transformed.y += sin(t * 2.0) * uBobAmp * aMove;
           // Head dips to graze when standing still.
           float graze = (1.0 - aMove) * (0.5 + 0.5 * sin(uTime * 1.3 + aPhase));
           transformed.y -= aHead * graze * uGrazeDip;
           transformed.z += aHead * graze * uGrazeDip * 0.6;
         }`)},n.customProgramCacheKey=()=>"scena-herd-v1",{material:n,uniforms:a}}function In(){return typeof performance<"u"?performance.now()*.001:0}function w0(e={}){let t=e.type??"deer",a=t==="sheep",n=e.count??(a?16:12),o=e.center??[0,0],i={x:o[0],z:o[1]},s=e.radius??18,c=typeof s=="number"?{x:s,z:s}:{x:s[0],z:s[1]},l=e.ground??(()=>0),r=e.speed??(a?1.4:2.2),u=e.size??(a?.85:1),f=e.grazing??(a?.75:.6),d=e.slopeAlign??.6,m=e.separation??1.6,h=e.alignment??.7,p=e.cohesion??(a?1.6:1.1),g=new Y(e.seed??1),{geo:v,stand:w}=qr(t,u),{material:S,uniforms:y}=Zr(e.color??(a?15196886:11109722),a?5:6),k=new Float32Array(n),M=new Float32Array(n);for(let O=0;O<n;O++)k[O]=g.range(0,Math.PI*2);v.setAttribute("aPhase",new zn(k,1));let x=new zn(M,1);x.setUsage(35048),v.setAttribute("aMove",x);let b=new Ur(v,S,n);b.name=`herd-${t}`,b.castShadow=!0,b.frustumCulled=!1;let P=[],I=[],G=[];for(let O=0;O<n;O++){let Z=i.x+g.range(-c.x,c.x),ae=i.z+g.range(-c.z,c.z);P.push(new fe(Z,l(Z,ae)+w,ae));let se=g.range(0,Math.PI*2);I.push(new fe(Math.cos(se),0,Math.sin(se)).multiplyScalar(r)),G.push(g.range(0,4))}let F=new Yr,V=new fe,L=new fe,A=new fe,T=new fe,C=new fe,B=new fe,z=new fe,R=new fe,W=new fe(0,1,0),_=new fe,j=a?5:7,E=a?1.1:1.6,oe=(O,Z)=>{let se=l(O-.6,Z),je=l(O+.6,Z),ke=l(O,Z-.6),st=l(O,Z+.6);return _.set(se-je,2*.6,ke-st).normalize()},te=()=>{for(let O=0;O<n;O++){let Z=P[O],ae=I[O];B.set(ae.x,0,ae.z),B.lengthSq()<1e-6&&B.set(0,0,1),B.normalize(),z.copy(W).lerp(oe(Z.x,Z.z),d).normalize(),R.copy(z).cross(B),R.lengthSq()<1e-6&&R.set(1,0,0),R.normalize(),z.copy(B).cross(R).normalize(),F.makeBasis(R,z,B),F.setPosition(Z.x,Z.y,Z.z),b.setMatrixAt(O,F)}b.instanceMatrix.needsUpdate=!0};te();let $=!1,X=In(),J=O=>{O=Math.min(.05,Math.max(0,O));for(let Z=0;Z<n;Z++){let ae=P[Z],se=I[Z];G[Z]-=O;let je=G[Z]>0;G[Z]<-.01&&(G[Z]=g.next()<f?g.range(2.5,6):-g.range(2,4.5)),V.set(0,0,0),L.set(0,0,0),A.set(0,0,0);let ke=0;for(let ge=0;ge<n;ge++){if(ge===Z)continue;let rt=P[ge],Ot=ae.x-rt.x,Et=ae.z-rt.z,Ce=Math.hypot(Ot,Et);Ce<j&&(L.add(I[ge]),A.add(rt),ke++,Ce<E&&Ce>1e-4&&(V.x+=Ot/(Ce*Ce),V.z+=Et/(Ce*Ce)))}if(T.set(0,0,0),je||(ke>0&&(L.multiplyScalar(1/ke),L.y=0,L.lengthSq()>1e-6&&L.setLength(r).sub(se).multiplyScalar(h),T.add(L),A.multiplyScalar(1/ke),C.set(A.x-ae.x,0,A.z-ae.z).multiplyScalar(p*.4),T.add(C)),V.lengthSq()>0&&(V.y=0,T.add(V.setLength(r).multiplyScalar(m))),C.set(i.x-ae.x,0,i.z-ae.z),C.x=Math.abs(ae.x-i.x)>c.x*.85?C.x:0,C.z=Math.abs(ae.z-i.z)>c.z*.85?C.z:0,T.add(C.multiplyScalar(1.6)),T.x+=g.range(-1,1)*r*.5,T.z+=g.range(-1,1)*r*.5),se.addScaledVector(T,O),se.y=0,je)se.multiplyScalar(Math.max(0,1-O*6));else{let ge=Math.hypot(se.x,se.z);ge>r*1.4?se.setLength(r*1.4):ge<r*.5&&(ge<1e-4&&se.set(g.range(-1,1),0,g.range(-1,1)),se.setLength(r*.5))}ae.x+=se.x*O,ae.z+=se.z*O,ae.y=l(ae.x,ae.z)+w;let st=Math.min(1,Math.hypot(se.x,se.z)/(r*.9));M[Z]+=(st-M[Z])*Math.min(1,O*5)}x.needsUpdate=!0,te()};return b.onBeforeRender=()=>{if(!$){let O=In();y.uTime.value=O%1e3,J(O-X),X=O}},{object:b,count:n,positions:P,setCenter(O,Z){i.x=O,i.z=Z},update(O){$=!0,y.uTime.value+=O,J(O)}}}function ni(e,t={}){let a=t.width??1.8,n=t.surface??0,o=typeof n=="number"?()=>n:(x,b)=>n(x,b),i=t.loop??!1,s=t.palette??K,c=e.map(x=>new $e(x.x,0,"z"in x?x.z:0)),l=new Qr(c,i,"centripetal"),r=l.getLength(),u=Math.max(8,Math.ceil(r*(t.samplesPerUnit??1))),f=[];for(let x=0;x<=u&&!(i&&x===u);x++){let b=l.getPoint(x/u);f.push(new $e(b.x,o(b.x,b.z),b.z))}let d=i?f.length+1:f.length,m=new Float32Array(d*2*3),h=new $e,p=new $e;for(let x=0;x<d;x++){let b=f[x%f.length],P=f[(x-1+f.length)%f.length],I=f[(x+1)%f.length];!i&&x===0?h.subVectors(I,b):!i&&x===d-1?h.subVectors(b,P):h.subVectors(I,P),p.set(-h.z,0,h.x).normalize().multiplyScalar(a/2);let G=x*6;m[G]=b.x-p.x,m[G+1]=o(b.x-p.x,b.z-p.z)+.05,m[G+2]=b.z-p.z,m[G+3]=b.x+p.x,m[G+4]=o(b.x+p.x,b.z+p.z)+.05,m[G+5]=b.z+p.z}let g=[];for(let x=0;x<d-1;x++){let b=x*2;g.push(b,b+1,b+2,b+1,b+3,b+2)}let v=new Jr;v.setAttribute("position",new Xr(m,3)),v.setIndex(g),v.computeVertexNormals();let w=new ei(v,new ti({color:s.path,flatShading:!0,polygonOffset:!0,polygonOffsetFactor:-1}));w.name="path";let S=t.keepOutMargin??.6,y=f.filter((x,b)=>b%2===0||b===f.length-1).map(x=>({center:{x:x.x,z:x.z},radius:a/2+S})),k=a/2;return{mesh:w,route:f,keepOut:y,contains:(x,b)=>{let P=i?f.length:f.length-1;for(let I=0;I<P;I++){let G=f[I],F=f[(I+1)%f.length],V=F.x-G.x,L=F.z-G.z,A=V*V+L*L||1e-9,T=Math.max(0,Math.min(1,((x-G.x)*V+(b-G.z)*L)/A)),C=x-(G.x+V*T),B=b-(G.z+L*T);if(C*C+B*B<=k*k)return!0}return!1},loop:i}}function ai(e={}){let t=new Y(e.seed??1),a=e.palette??K,n=e.center??{x:0,z:0},o=e.radius??12,i=e.houses??5,s=e.surface??0,c=typeof s=="number"?()=>s:(p,g)=>s(p,g),l=new oi;l.name="village";let r=[],u=[],f=(p,g,v,w)=>(p.object.position.set(g,c(g,v),v),p.object.rotation.y=w,l.add(p.object),r.push(p),p),d=(p,g,v)=>{let w=n.x,S=n.z;for(let y=0;y<10;y++){let k=p+t.range(-.25,.25)*(y>0?1:.3),M=g*t.range(y>0?.8:.95,1.1);w=n.x+Math.cos(k)*M,S=n.z+Math.sin(k)*M;let x=c(w,S);if(e.mask&&!e.mask(w,S,x))continue;let b=x,P=x;for(let[I,G]of[[v,0],[-v,0],[0,v],[0,-v]]){let F=c(w+I,S+G);b=Math.min(b,F),P=Math.max(P,F)}if(P-b<=Math.max(.9,v*.35))break}return{x:w,z:S}},m=ha({seed:t.int(1,1e9),palette:a});f(m,n.x,n.z,t.range(0,Math.PI*2));let h=e.lampLights??3;for(let p=0;p<i;p++){let g=p/i*Math.PI*2+t.range(-.15,.15),v=da({seed:t.int(1,1e9),palette:a}),w=d(g,o*t.range(.7,.95),v.obstacleRadius),S=Math.atan2(n.x-w.x,n.z-w.z);if(f(v,w.x,w.z,S),u.push(v),t.next()<.7){let y=g+t.range(-.5,.5),k=Math.hypot(w.x-n.x,w.z-n.z)-v.obstacleRadius-.7;f(Ht({seed:t.int(1,1e9),size:t.range(.7,1),palette:a}),n.x+Math.cos(y)*k,n.z+Math.sin(y)*k,t.range(0,Math.PI))}if(p%2===0){let y=Math.hypot(w.x-n.x,w.z-n.z)*.55,k=On({seed:t.int(1,1e9),light:h>0,palette:a});h--,f(k,n.x+Math.cos(g)*y,n.z+Math.sin(g)*y,0),u.push(k)}}if(e.tower??!0){let p=t.range(0,Math.PI*2),g=ma({seed:t.int(1,1e9),palette:a}),v=d(p,o*1.05,g.obstacleRadius);f(g,v.x,v.z,t.range(0,Math.PI*2))}if(e.ruin??!0){let p=t.range(0,Math.PI*2),g=pa({seed:t.int(1,1e9),palette:a}),v=d(p,o*1.35,g.obstacleRadius);f(g,v.x,v.z,t.range(0,Math.PI*2))}return{group:l,props:r,obstacles:fo(r),lamps:u,keepOut:[{center:{...n},radius:o*1.5}],center:n}}var li=2;function x0(e,t={}){let a=new Y(t.seed??1),n=t.palette??K,o=t.unit??li,i=t.wallHeight??2.6,s=t.torchLights??4,c=e.length,l=Math.max(...e.map(M=>M.length),0),r=(-l/2+.5)*o,u=(-c/2+.5)*o,f=(M,x)=>({x:r+M*o,z:u+x*o}),d=new co;d.name="kit";let m=[],h=[],p=[],g=new Set,v=[],w=[];for(let M=0;M<c;M++)for(let x=0;x<(e[M]??"").length;x++){let b=e[M][x];if(b===" "||b===void 0)continue;let{x:P,z:I}=f(x,M);if(b==="#"){v.push({x:P,z:I}),m.push({center:new qe(P,i/2,I),radius:o*.71});continue}if(w.push({x:P,z:I}),g.add(`${x},${M}`),b==="D"){let G=e[M][x-1]==="#"||e[M][x+1]==="#",F=new Wt(new xt(G?o:o*.4,i*.25,G?o*.4:o),new De({color:n.woodDark,flatShading:!0}));F.position.set(P,i*.875,I),d.add(F)}else b==="T"?(d.add(ui(P,I,n,a,s>0)),s--,p.push(new qe(P,0,I)),m.push({center:new qe(P,0,I),radius:.3})):b==="S"&&h.push(new qe(P,0,I))}let S=new De({color:a.pick(n.rock),flatShading:!0}),y=new De({color:n.cliff,flatShading:!0}),k=new ri;if(v.length>0){let M=new Pn(new xt(o,i,o),S,v.length);v.forEach((x,b)=>{M.setMatrixAt(b,k.makeTranslation(x.x,i/2,x.z))}),M.instanceMatrix.needsUpdate=!0,d.add(M)}if(w.length>0){let M=new Pn(new xt(o,.2,o),y,w.length);w.forEach((x,b)=>{M.setMatrixAt(b,k.makeTranslation(x.x,-.1,x.z))}),M.instanceMatrix.needsUpdate=!0,d.add(M)}return{group:d,obstacles:m,spawns:h,torches:p,floorAt(M,x){let b=Math.round((M-r)/o),P=Math.round((x-u)/o);return g.has(`${b},${P}`)},size:{width:l*o,depth:c*o}}}function ui(e,t,a,n,o){let i=new co;i.name="torch";let s=new Wt(new si(.04,.06,1.5,5),new De({color:a.woodDark,flatShading:!0}));s.position.y=.75,i.add(s);let c=new Wt(new ci(.1,6,5),new De({color:a.lampGlow,emissive:a.lampGlow,emissiveIntensity:1.8}));if(c.position.y=1.58,c.scale.y=n.range(1.2,1.5),i.add(c),o){let l=new ii(a.lampGlow,5,9,1.9);l.position.y=1.6,i.add(l)}return i.position.set(e,0,t),i}function pi(e){let t=e.seed??1,a=new Y(t),{area:n}=e,o=n.max.x-n.min.x,i=n.max.z-n.min.z,s=e.surface??0,c=typeof s=="number"?()=>s:(A,T)=>s(A,T),l=e.minSpacing??1.2,r=e.clumpScale??18,u=e.count??Math.round(o*i*(e.density??.03)),f=(e.keepOut??[]).map(A=>({x:A.center.x,z:("z"in A.center,A.center.z),radius:A.radius})),d=e.items.map(A=>A.weight??1),m=d.reduce((A,T)=>A+T,0),h=()=>{let A=a.next()*m;for(let T=0;T<d.length;T++)if(A-=d[T],A<=0)return T;return d.length-1},p=Math.max(l,.001),g=new Map,v=(A,T)=>{let C=Math.floor(A/p),B=Math.floor(T/p);for(let z=-1;z<=1;z++)for(let R=-1;R<=1;R++){let W=g.get(`${C+z},${B+R}`);if(W){for(let _ of W)if((_.x-A)**2+(_.z-T)**2<l*l)return!0}}return!1},w=[];for(let A=0;A<u;A++){let T=a.range(n.min.x,n.max.x),C=a.range(n.min.z,n.max.z);if(Wn(T/r,C/r,t+77)<a.range(.15,.55)||f.some(E=>(E.x-T)**2+(E.z-C)**2<E.radius*E.radius)||v(T,C))continue;let B=c(T,C);if(e.mask&&!e.mask(T,C,B))continue;let z=h(),[R,W]=e.items[z].scale??[.8,1.25];w.push({position:new St(T,B,C),rotationY:a.range(0,Math.PI*2),scale:a.range(R,W),itemIndex:z});let _=`${Math.floor(T/p)},${Math.floor(C/p)}`,j=g.get(_);j||g.set(_,j=[]),j.push({x:T,z:C})}let S=new Mt;S.name="scatter";let y=[],k=new Bn,M=new Bn,x=new hi,b=new St(0,1,0),P=new St,I=(A,T,C)=>{A.object.updateMatrixWorld(!0),A.object.traverse(B=>{if(!(B instanceof mi))return;let z=new di(B.geometry,B.material,T.length);z.instanceMatrix.setUsage(fi),T.forEach((R,W)=>{x.setFromAxisAngle(b,R.rotationY),P.setScalar(R.scale),k.compose(R.position,x,P),M.multiplyMatrices(k,B.matrixWorld),z.setMatrixAt(W,M)}),z.instanceMatrix.needsUpdate=!0,C.add(z)})},G=e.lod?.tileSize??16,F=new Map,V=(A,T)=>{let C=Math.floor(A/G),B=Math.floor(T/G),z=`${C},${B}`,R=F.get(z);return R||(R={center:{x:(C+.5)*G,z:(B+.5)*G},near:new Mt,far:new Mt},R.far.visible=!1,S.add(R.near,R.far),F.set(z,R)),R};e.items.forEach((A,T)=>{let C=A.variants??4,B=[];for(let _=0;_<C;_++)B.push(A.create(a.fork()));let z=e.lod!==void 0&&A.createFar!==void 0,R=[];if(z)for(let _=0;_<C;_++)R.push(A.createFar(a.fork()));let W=B.map(()=>[]);for(let _ of w){if(_.itemIndex!==T)continue;let j=Math.abs(Math.floor(_.position.x*31+_.position.z*17))%C;W[j].push(_)}B.forEach((_,j)=>{let E=W[j];if(E.length!==0){if(z){let oe=new Map;for(let te of E){let $=V(te.position.x,te.position.z),X=oe.get($);X||oe.set($,X=[]),X.push(te)}for(let[te,$]of oe)I(_,$,te.near),I(R[j],$,te.far)}else I(_,E,S);if(_.obstacleRadius>0)for(let oe of E)y.push({center:oe.position.clone(),radius:_.obstacleRadius*oe.scale})}})});let L={group:S,placements:w,obstacles:y,count:w.length};if(e.lod){let A=[...F.values()],T=e.lod.distance*1.1,C=e.lod.distance*.9;L.tiles=A,L.update=B=>{for(let z of A){let R=B.position.x-z.center.x,W=B.position.z-z.center.z,_=Math.hypot(R,W);z.near.visible&&_>T?(z.near.visible=!1,z.far.visible=!0):!z.near.visible&&_<C&&(z.near.visible=!0,z.far.visible=!1)}}}return L}var gi={tree:(e,t)=>Lt({seed:e,palette:t}),rock:(e,t)=>Ko({seed:e,palette:t}),bush:(e,t)=>ia({seed:e,palette:t}),grass:(e,t)=>ra({seed:e,palette:t}),crate:(e,t)=>Ht({seed:e,palette:t}),fence:(e,t)=>Jo({seed:e,palette:t}),lamp:(e,t)=>On({seed:e,palette:t})},wi={tree:(e,t)=>{let a=new Y(e),n=new Je,o=new Gn(new Tn(0,a.range(1,1.4),a.range(2.6,3.8),5),new Rn({color:a.pick(t.foliage),flatShading:!0}));return o.position.y=o.geometry.parameters.height/2+.3,n.add(o),{object:n,obstacleRadius:0}},bush:(e,t)=>{let a=new Y(e),n=new Je,o=new Gn(new Tn(.1,a.range(.5,.7),a.range(.5,.8),5),new Rn({color:a.pick(t.foliage),flatShading:!0}));return o.position.y=.3,n.add(o),{object:n,obstacleRadius:0}},grass:()=>({object:new Je,obstacleRadius:0})};function C0(e,t){let a=e.seed??1,n=e.palette?_n[e.palette]:K,o=new Je;o.name="scena-scene";let i=[],s;e.terrain&&(s=Rs({...e.terrain,seed:a,waterLevel:e.water?.level,palette:n}),o.add(s.mesh));let c=s?s.heightAt:()=>0,l;e.water&&(l=Tt({level:e.water.level,size:e.water.size??(s?s.size*1.4:200),palette:n}),o.add(l.mesh),i.push(w=>l.update(w)));let r=s&&l?is(s,l,.3):()=>!0,u;(e.sky??!0)&&(u=Vs({palette:n}),o.add(u.mesh));let f=Es(e.lighting??"day");o.add(f.group),t&&e.fog!==!1&&Ys(t,e.fog??"haze",n);let d=(e.paths??[]).map(w=>{let S=ni(w.points,{surface:c,width:w.width,loop:w.loop,palette:n});return o.add(S.mesh),S}),m=(w,S)=>d.some(y=>y.contains(w,S)),h;e.village&&(h=ai({...e.village,seed:a+1,surface:c,mask:(w,S)=>r(w,S)&&!m(w,S),palette:n}),o.add(h.group));let p=e.wind??!0,g=(e.scatters??[]).map((w,S)=>{let y=s?s.size*.45:40,k=w.avoidWater??!0,M=w.avoidPaths??!0,x=pi({seed:a+10+S,area:w.area??{min:{x:-y,z:-y},max:{x:y,z:y}},surface:c,density:w.density,count:w.count,minSpacing:w.minSpacing,clumpScale:w.clumpScale,lod:w.lod,items:w.items.map(b=>{let P=w.lod?wi[b.type]:void 0;return{create:I=>gi[b.type](I.int(1,1e9),n),createFar:P&&(I=>P(I.int(1,1e9),n)),weight:b.weight,variants:b.variants,scale:b.scale}}),mask:(b,P,I)=>(w.maxHeight===void 0||I<w.maxHeight)&&(!k||r(b,P))&&(!M||!m(b,P)),keepOut:[...M?d.flatMap(b=>b.keepOut):[],...h?h.keepOut:[]]});if(o.add(x.group),p!==!1){let b=Xs(x.group,{strength:typeof p=="object"?p.strength??.05:.05});i.push(P=>b.update(P))}return x}),v;return e.dayCycle&&(v=$s({sky:u,rig:f,scene:t,lamps:h?.lamps,palette:n,dayLength:e.dayCycle.dayLength,timeOfDay:e.dayCycle.timeOfDay}),i.push(w=>v.update(w))),t?.add(o),{group:o,palette:n,terrain:s,water:l,sky:u,rig:f,cycle:v,paths:d,village:h,scatters:g,obstacles:[...h?h.obstacles:[],...g.flatMap(w=>w.obstacles)],heightAt:c,update(w){for(let S of i)S(w)}}}function k0(e){e.updateWorldMatrix(!0,!0);let t={},a={},n=[],o=[];e.traverse(s=>{let c=s.name.replace(/\.\d+$/,""),l=/^(spawn|route|obstacle|keepout)_(.+)$/.exec(c);if(!l)return;let[,r,u]=l,f=s.getWorldPosition(new yi),d=Math.max(s.scale.x,s.scale.z);if(r==="spawn")t[u]=f;else if(r==="route"){let m=/^(.*)_(\d+)$/.exec(u),h=m?m[1]:u,p=m?parseInt(m[2],10):0;(a[h]??(a[h]=[])).push({index:p,position:f})}else r==="obstacle"?n.push({center:f,radius:d}):o.push({center:{x:f.x,z:f.z},radius:d})});let i={};for(let[s,c]of Object.entries(a))i[s]=c.sort((l,r)=>l.index-r.index).map(l=>l.position);return{spawns:t,routes:i,obstacles:n,keepOut:o}}export{K as DEFAULT_PALETTE,li as KIT_UNIT,_n as PALETTES,Y as Rng,go as SURFACE_PRESETS,Bo as TREE_BIOMES,Si as TREE_SPECIES,is as aboveWater,Ys as applyFog,Xs as applyWind,x0 as assembleKit,C0 as buildScene,_t as buildTextGeometry,fo as collectObstacles,Vi as createBanner,Hi as createBrazier,d0 as createBubbles,ji as createBunting,ia as createBush,Di as createCampfire,$i as createCart,f0 as createCaustics,Ht as createCrate,$s as createDayCycle,Jo as createFence,p0 as createFlock,Yi as createFountain,u0 as createGodRays,ra as createGrassTuft,w0 as createHerd,da as createHouse,Oo as createImpostor,On as createLamp,Es as createLightingRig,a0 as createOcean,ni as createPath,yn as createPrecipitation,Ko as createRock,pa as createRuin,c0 as createSeasons,Zi as createSign,Vs as createSky,Fi as createStall,us as createStatue,D as createSurface,Rs as createTerrain,ma as createTower,Lt as createTree,ai as createVillage,Tt as createWater,m0 as createWaterGrade,r0 as createWeather,ha as createWell,no as createWindField,k0 as extractMarkers,lo as fractalNoise2,Oe as hash2,Vt as measureText,pi as scatter,Ci as treeBiome,ki as treeLOD,Wn as valueNoise2};
