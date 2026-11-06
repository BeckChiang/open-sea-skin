// ============================================================================
//  OPEN SEA — optimized ocean engine (extension skin edition)
//  WebGPU · Three.js 0.178 · TSL node shaders
//
//  Same visual language as the standalone site, re-tuned for a persistent
//  background: 3x lighter geometry, adaptive resolution, 60 fps frame cap,
//  distance-gated fragment work, no MSAA, low-power adapter in skin mode.
//
//  Runs in two modes:
//    - full page showcase: panel, sliders, loader, error states
//    - skin mode (?skin=1): bare ocean behind the host UI, auto time-of-day
// ============================================================================

import * as THREE from './vendor/three.webgpu.js';
import {
  Fn, pass, uniform, uniformArray, texture, uv, float, vec2, vec3, vec4, If,
  sin, cos, dot, cross, normalize, mix, pow, max, clamp, fract, floor,
  attribute, smoothstep, length, reflect, passTexture,
  positionLocal, positionWorld, cameraPosition
} from './vendor/three.tsl.js';
import { OrbitControls } from './vendor/addons/controls/OrbitControls.js';
import { bloom } from './vendor/addons/tsl/display/BloomNode.js';
import { skyFromElevation, manualElevationDeg, manualAzimuthDeg } from './sky.js';
import { CONSTELLATION_LINES } from './stars-data.js';
import {
  constellationVertices, equatorialToHorizontal, localSiderealTime,
  starBrightnessFromDegree
} from './sky-astro.js';
import { sunTimes,
  sunPosition, moonPosition,
  cloudCoverOf, starLevelOf, starIntensityOf
} from './solar.js';

// skin mode: bare background, auto time-of-day, low-power, no UI chrome
const SKIN = new URL(import.meta.url).searchParams.get('skin') === '1';
// skin prefs come from the page query (set by the host content script) and
// live updates arrive via postMessage from the injected settings panel.
const SKIN_QUERY = new URLSearchParams(location.search);
const SKIN_SEA = SKIN_QUERY.has('sea') ? Number(SKIN_QUERY.get('sea')) : null;
const SKIN_TIME = SKIN_QUERY.has('t') ? Number(SKIN_QUERY.get('t')) : null;
const SKIN_PARENT_ORIGIN = SKIN_QUERY.get('parentOrigin');
let manualTimeOfDay = SKIN_QUERY.get('auto') === '0';
let currentDaylight = SKIN_TIME !== null ? SKIN_TIME : 55;

const REDUCED_MOTION = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;
const QUALITY = SKIN_QUERY.get('quality') || 'auto';
const LOW_END_DEVICE = QUALITY === 'low' || (QUALITY === 'auto' && (
  (navigator.hardwareConcurrency || 8) <= 4
  || ('deviceMemory' in navigator && Number(navigator.deviceMemory) <= 4)
));

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const NUMBER_QUERY = (key, min, max, fallback) => {
  if (!SKIN_QUERY.has(key)) return fallback;
  const value = Number(SKIN_QUERY.get(key));
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
};

// ----------------------------------------------------------------------------
// SECTION 0 · SKY / GLASS STATE (contract §2.2 and §2.3)
// Everything below is driven by uniforms only: switching any of it at runtime
// re-binds constants, it never recompiles a shader.
// ----------------------------------------------------------------------------

// sunMode: 'real' -> solar.js once per second, 'manual' -> the t from oss-sun
let sunMode = SKIN_QUERY.get('sunMode') === 'manual' ? 'manual' : 'real';
let sunLat = NUMBER_QUERY('lat', -90, 90, 31.23);
let sunLon = NUMBER_QUERY('lon', -180, 180, 121.47);
let moonEnabled = true;
let starsSetting = 'mid';
let constellationSetting = 'mid';
let meteorEnabled = true;
let cloudsSetting = 'mid';
// reported back through window.__ossState()
let sunElevationDeg = 0;
let sunAzimuthDeg = 0;
// where the disc is actually aimed after the dome is squeezed into the frame
let sunViewElevationDeg = 0;
let sunViewAzimuthDeg = 0;
let moonElevationDeg = 0;
let moonAzimuthDeg = 0;
let moonPhase01 = 0;
let moonBrightness = 0;
let starsIntensity = 0;
let cloudCover = cloudCoverOf(cloudsSetting);
let sunClock = 0;

const SKY_LEVELS = ['off', 'low', 'mid', 'high'];
const CONSTELLATION_GRADES = Object.freeze({ off: 0, low: 0.5, mid: 1, high: 1.7 });

const GLASS_MAX_RECTS = 3;

// ----------------------------------------------------------------------------
// SECTION 1 · SHARED UNIFORMS
// ----------------------------------------------------------------------------

const uTime = uniform(0);
const uSea = uniform(0.25 + (45 / 100) * 1.5);
// The parent posts a sea level a few times per second, so jumping `uSea` straight
// to it turns a slow swell into four visible steps. The surface chases a goal per
// frame instead, which keeps any message cadence looking continuous.
let seaGoal = uSea.value;
const SEA_FOLLOW_TAU = 0.3;
const uSunDir = uniform(new THREE.Vector3(0, 0.5, -0.87));
const uSunColor = uniform(new THREE.Vector3(1, 1, 1));
// ambient term that dims clouds, and anything else that must not glow at night
const uSkyLight = uniform(1);
// 1 at full night, 0 at/above the horizon: gates night-only water terms
const uNightF = uniform(0);
const uHorizonColor = uniform(new THREE.Vector3(1, 1, 1));
const uZenithColor = uniform(new THREE.Vector3(1, 1, 1));
const uDeepColor = uniform(new THREE.Vector3(1, 1, 1));
const uShallowColor = uniform(new THREE.Vector3(1, 1, 1));

// Sky extras (contract §2.2). The defaults reproduce the 1.2.7 frame exactly:
// no moon, no stars, and uCloudCover 0.55 maps to the old 0.62/0.95 threshold.
const CLOUD_COVER_BASELINE = 0.55;
const uMoonDir = uniform(new THREE.Vector3(0, 0.35, 0.94));
const uMoonRight = uniform(new THREE.Vector3(1, 0, 0));
const uMoonVisible = uniform(0);
const uMoonPhaseCos = uniform(1);
const uStars = uniform(0);
const uCloudCover = uniform(CLOUD_COVER_BASELINE);

// Frosted-glass columns (contract §2.3): 3 rects of (x0, y0, x1, y1) + level.
const uGlassRects = uniformArray([
  new THREE.Vector4(0, 0, 0, 0),
  new THREE.Vector4(0, 0, 0, 0),
  new THREE.Vector4(0, 0, 0, 0),
]);
const uGlassLevels = uniformArray([0, 0, 0]);
const uGlassActive = uniform(0);
const uGlassEdge = uniform(0.0035);
const uGlassSpread = uniform(2);

// ----------------------------------------------------------------------------
// SECTION 2 · GERSTNER SWELL (identical to the standalone site)
// ----------------------------------------------------------------------------

const GERSTNER_DEFS = [
  { dir: [1.0, 0.0],     wavelength: 60.0, steepness: 0.12 },
  { dir: [0.6, 0.8],     wavelength: 31.0, steepness: 0.12 },
  { dir: [-0.7, 0.7],    wavelength: 18.0, steepness: 0.09 },
  { dir: [0.3, -0.95],   wavelength: 9.5,  steepness: 0.07 },
  { dir: [-0.35, -0.94], wavelength: 5.0,  steepness: 0.05 },
].map((w) => {
  const len = Math.hypot(w.dir[0], w.dir[1]);
  const dx = w.dir[0] / len;
  const dy = w.dir[1] / len;
  const k = (Math.PI * 2) / w.wavelength;
  const c = Math.sqrt(9.8 * k);
  return { dx, dy, k, c, a0: w.steepness / k };
});

const wavePosition = Fn(([xz, time, sea]) => {
  let x = xz.x;
  let y = float(0);
  let z = xz.y;
  for (const w of GERSTNER_DEFS) {
    const dir = vec2(w.dx, w.dy);
    const f = float(w.k).mul(dir.dot(xz).sub(time.mul(float(w.c))));
    const a = float(w.a0).mul(sea);
    const cf = cos(f).toVar();
    x = x.add(a.mul(dir.x).mul(cf));
    y = y.add(a.mul(sin(f)));
    z = z.add(a.mul(dir.y).mul(cf));
  }
  return vec3(x, y, z);
});

// Reuse the swell phase for normal and crest (adapted from zdjmrq's PR #21).
// Keep the original time/phase formula and visual parameters unchanged.
const waveSurface = Fn(([xz, time, sea]) => {
  let tx = float(1), ty = float(0), tz = float(0);
  let bx = float(0), by = float(0), bz = float(1);
  let crest = float(0);
  for (const w of GERSTNER_DEFS) {
    const dir = vec2(w.dx, w.dy);
    const f = float(w.k).mul(dir.dot(xz).sub(time.mul(float(w.c))));
    const a = float(w.a0).mul(sea);
    const s = sin(f).toVar();
    const co = cos(f);
    const ak = a.mul(float(w.k));
    const aks = ak.mul(s);
    const akc = ak.mul(co);
    tx = tx.sub(aks.mul(dir.x).mul(dir.x));
    ty = ty.add(akc.mul(dir.x));
    tz = tz.sub(aks.mul(dir.x).mul(dir.y));
    bx = bx.sub(aks.mul(dir.x).mul(dir.y));
    by = by.add(akc.mul(dir.y));
    bz = bz.sub(aks.mul(dir.y).mul(dir.y));
    crest = crest.add(a.mul(s));
  }
  const normal = normalize(cross(vec3(bx, by, bz), vec3(tx, ty, tz)));
  return vec4(normal, crest);
});

// ----------------------------------------------------------------------------
// SECTION 3 · PROCEDURAL GRADIENT NOISE + FBM (identical to the standalone)
// ----------------------------------------------------------------------------

const hash2 = Fn(([p]) => {
  // Keep the sine input in a compact range. Large dot products lose enough
  // float precision for the far field to band on some integrated GPUs.
  const q = p.sub(floor(p.div(289)).mul(289));
  const a = sin(q.dot(vec2(127.1, 311.7))).mul(43758.5453);
  const b = sin(q.dot(vec2(269.5, 183.3))).mul(43758.5453);
  return vec2(fract(a).mul(2).sub(1), fract(b).mul(2).sub(1));
});

const gradNoise = Fn(([p]) => {
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(f.mul(f.mul(6).sub(15)).add(10));
  const g00 = hash2(i);
  const g10 = hash2(i.add(vec2(1, 0)));
  const g01 = hash2(i.add(vec2(0, 1)));
  const g11 = hash2(i.add(vec2(1, 1)));
  const n00 = g00.dot(f);
  const n10 = g10.dot(f.sub(vec2(1, 0)));
  const n01 = g01.dot(f.sub(vec2(0, 1)));
  const n11 = g11.dot(f.sub(vec2(1, 1)));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
});

const fbm = Fn(([p]) => {
  const o1 = gradNoise(p);
  const o2 = gradNoise(p.mul(2.04).add(vec2(17.3, 9.1))).mul(0.5);
  const o3 = gradNoise(p.mul(4.11).add(vec2(42.7, 28.6))).mul(0.25);
  return o1.add(o2).add(o3);
});

const detailHeight = Fn(([xz, time]) => {
  const driftA = vec2(time.mul(0.55), time.mul(0.32));
  const driftB = vec2(time.mul(-0.4), time.mul(0.5));
  return fbm(xz.mul(0.85).add(driftA)).add(fbm(xz.mul(2.1).add(driftB)).mul(0.45));
});

// ----------------------------------------------------------------------------
// SECTION 4 · SHARED ANALYTIC SKY
// cloudMask gates the cloud FBM: the dome always passes 1, the ocean only
// pays for cloud noise where the reflection is actually visible.
// astro (1 on the dome, 0 in the water reflection) keeps the hash star field
// off the ocean both for looks and for fill rate.
// ----------------------------------------------------------------------------

// scalar hash for the star cells (same sine-fold trick as hash2 above)
const hash31 = Fn(([p]) => fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453)));

const STAR_SCALE = 190;        // cells per radian: ~0.3° per cell
const STAR_SIZE = 0.19;        // cell-space radius of one star
const MOON_DISC_RADIUS = 0.018; // radians, ~1.0° (a little larger than the real 0.26°)
const MOON_DISC_IN = 0.99976;
const MOON_DISC_OUT = 0.99984;

const skyColor = Fn(([dir, cloudMask, astro]) => {
  const d = dir; // Both callers supply a normalized direction.
  const up = clamp(d.y, -0.15, 1);
  const col = mix(uHorizonColor, uZenithColor, pow(max(up, 0), 0.42)).toVar();

  col.assign(mix(col, uDeepColor.mul(1.4).add(uHorizonColor.mul(0.25)), smoothstep(0, -0.15, d.y)));

  const s = max(dot(d, uSunDir), 0);
  col.addAssign(uSunColor.mul(pow(s, 10)).mul(0.18));
  col.addAssign(uSunColor.mul(smoothstep(0.9994, 0.9998, s)).mul(30));

  // Sunset band: a warm wash that hugs the horizon on the sun's side. The dusk
  // palette alone tinted the whole sky evenly, which read as "grey" instead of
  // 晚霞; this is the part that makes the hour visible.
  const lowSun = float(1).sub(smoothstep(0.05, 0.36, uSunDir.y));
  const flatSun = normalize(vec3(uSunDir.x, 0, uSunDir.z).add(vec3(1e-4, 0, 1e-4)));
  const flatDir = normalize(vec3(d.x, 0, d.z).add(vec3(1e-4, 0, 1e-4)));
  const towardSun = max(dot(flatDir, flatSun), 0);
  const bandLow = smoothstep(0.42, 0.0, d.y);
  // and it only exists while the sun is up or in civil twilight — without this
  // gate the warm band would sit on the midnight horizon as a permanent fake dawn
  const duskGate = smoothstep(-0.16, 0.03, uSunDir.y);
  const warmBand = pow(towardSun, 5).mul(lowSun).mul(bandLow).mul(duskGate);
  col.addAssign(vec3(1.0, 0.40, 0.15).mul(warmBand).mul(0.9));

  // moon: phase-shaped disc + halo, gated by uMoonVisible (brightness, 0..1)
  If(uMoonVisible.greaterThan(0.002), () => {
    const md = dot(d, uMoonDir);
    const disc = smoothstep(MOON_DISC_IN, MOON_DISC_OUT, md);
    const halo = pow(max(md, 0), 260).mul(0.06)
      .add(smoothstep(0.999, 0.99976, md).mul(0.08));
    // local axis across the disc; computed on the CPU so a moon near the
    // zenith cannot produce a degenerate normalize()
    const mx = dot(d.sub(uMoonDir.mul(md)), uMoonRight).div(MOON_DISC_RADIUS).toVar();
    const lit = smoothstep(-0.22, 0.22, mx.add(uMoonPhaseCos));
    const moonColor = mix(vec3(0.10, 0.12, 0.16), vec3(1, 0.97, 0.9), lit);
    const moonGlow = pow(uMoonVisible, 0.5);
    col.addAssign(moonColor.mul(disc).mul(moonGlow).mul(2.9));
    col.addAssign(vec3(0.55, 0.62, 0.78).mul(halo).mul(moonGlow));
  });

  // stars: one hash point per direction cell, faded near the horizon
  If(uStars.mul(astro).greaterThan(0.001), () => {
    const p = d.mul(STAR_SCALE);
    const cell = floor(p);
    const local = fract(p).sub(0.5);
    const hx = hash31(cell);
    const hy = hash31(cell.add(vec3(19.3, 7.7, 41.1)));
    const hg = hash31(cell.add(vec3(53.1, 29.9, 11.7)));
    const dist = length(local.xy.sub(vec2(hx, hy).sub(0.5).mul(0.62)));
    const core = float(1).sub(smoothstep(0, STAR_SIZE, dist));
    const gate = smoothstep(0.972, 0.9985, hg);
    const twinkle = sin(uTime.mul(hg.mul(2.4).add(1.3)).add(hx.mul(29.7))).mul(0.22).add(0.78);
    const altitude = smoothstep(0.02, 0.32, d.y);
    col.addAssign(vec3(0.86, 0.92, 1).mul(core).mul(gate).mul(twinkle).mul(altitude).mul(uStars).mul(2.2));
  });

  // clouds only inside the low band: skips one FBM for most sky pixels
  const band = smoothstep(0.03, 0.16, d.y).mul(smoothstep(0.6, 0.22, d.y));
  If(band.mul(cloudMask).greaterThan(0.001), () => {
    const proj = d.xz.div(d.y.add(0.18)).mul(0.55);
    const cloudNoise = clamp(fbm(proj.add(vec2(uTime.mul(0.006), uTime.mul(0.003)))).mul(0.5).add(0.5), 0, 1);
    // uCloudCover 0.55 reproduces the 1.2.7 threshold (0.62 -> 0.95) and opacity
    const low = float(0.62).add(float(CLOUD_COVER_BASELINE).sub(uCloudCover).mul(0.55));
    const density = clamp(uCloudCover.div(CLOUD_COVER_BASELINE), 0, 1);
    const cover = band.mul(smoothstep(low, low.add(0.33), cloudNoise));
    // 1.2.7 used a fixed bright cloud tint and looked like daylight at night.
    // Daytime clouds now take the horizon hue (blue) instead of near-white, so a
    // cloudy noon no longer greys the whole sky out; at dusk uSunColor warms them.
    const cloudColor = uHorizonColor.mul(uSkyLight.mul(1.3)).add(vec3(0.05)).toVar();
    col.assign(mix(col, cloudColor, cover.mul(0.58).mul(density)));
  });

  return col;
});


// ----------------------------------------------------------------------------
// SECTION 5 · OCEAN MATERIAL
// ECO: the FBM detail normal, sparkle and foam (4 FBM = 12 gradient-noise
// evaluations per pixel) only run within 140 units of the camera — beyond
// that the horizon haze dissolves them anyway. Swell shading stays analytic.
// ----------------------------------------------------------------------------

const DETAIL_RADIUS = 140;

const oceanColor = Fn(() => {
  const P = positionWorld;
  const xz = P.xz;
  const time = uTime;
  const sea = uSea;
  const toCam = cameraPosition.sub(P).toVar();
  const dist = length(toCam);

  const surface = waveSurface(xz, time, sea).toVar();
  const N0 = surface.xyz;
  const N = N0.toVar();
  const crest = surface.w;
  const V = normalize(toCam);

  const spec = vec3(0).toVar();
  const foam = float(0).toVar();

  If(dist.lessThan(DETAIL_RADIUS), () => {
    // finite-difference FBM detail normal (capillary chop)
    const e = float(0.1);
    const h0 = detailHeight(xz, time);
    const hx = detailHeight(xz.add(vec2(e, 0)), time);
    const hz = detailHeight(xz.add(vec2(0, e)), time);
    const detailScale = float(1.5).mul(sea.mul(0.6).add(0.4));
    N.assign(normalize(N.add(vec3(h0.sub(hx), 0, h0.sub(hz)).mul(detailScale))));

    // sun specular: tight noise-modulated sparkle + broad gloss
    const H = normalize(uSunDir.add(V));
    const ndh = max(dot(N, H), 0);
    const sparkleNoise = clamp(fbm(xz.mul(0.3).add(vec2(time.mul(-0.07), time.mul(0.05)))).mul(0.5).add(0.5), 0, 1);
    spec.assign(uSunColor.mul(pow(ndh, 500).mul(mix(0.4, 3.4, sparkleNoise)).add(pow(ndh, 48).mul(0.12))));

    // crest foam
    const foamNoise = clamp(fbm(xz.mul(1.1).add(vec2(time.mul(0.22), time.mul(0.14)))).mul(0.5).add(0.5), 0, 1);
    foam.assign(smoothstep(0.5, 0.95, foamNoise).mul(smoothstep(1.0, 2.0, crest)).mul(0.85));
  });

  // base water color + backlit crest glow
  const col = mix(uDeepColor, uShallowColor, clamp(crest.mul(0.35).add(0.45), 0, 1)).toVar();
  const sss = pow(max(dot(V, uSunDir), 0), 3).mul(max(crest, 0)).mul(0.18);
  col.addAssign(uShallowColor.mul(uSunColor).mul(sss));

  // sky reflection (cloud FBM only where the reflection matters)
  const R = reflect(V.negate(), N).toVar();
  R.y.assign(max(R.y, 0.04));
  const fresnel = float(0.02).add(float(0.98).mul(pow(float(1).sub(max(dot(N, V), 0)), 5)));
  col.assign(mix(col, skyColor(R.normalize(), fresnel.greaterThan(0.25), float(0)), fresnel));

  // moon sheen: a cool glitter path plus a broad glow, so a clear night sea
  // reads as water instead of a black void (uMoonVisible is 0 when the moon is
  // down, which keeps the deep-night look untouched on moonless nights).
  const moonH = normalize(uMoonDir.add(V));
  const moonNdH = max(dot(N, moonH), 0);
  const moonSheen = vec3(0.62, 0.74, 1.0).mul(uMoonVisible)
    .mul(pow(moonNdH, 420).mul(1.7).add(pow(moonNdH, 36).mul(0.07)));
  // starlight haze: only at the grazing angle, where a real night sea picks up
  // the whole sky. A flat term here washed the swell out into a milky fog as
  // soon as the waves started moving.
  const ndv = max(dot(N, V), 0);
  const grazing = pow(float(1).sub(ndv), 2);
  col.addAssign(uShallowColor.mul(uNightF).mul(grazing).mul(0.9));
  col.addAssign(spec);
  col.addAssign(moonSheen);
  // foam picks up the sky, so a night sea shows dark foam instead of the
  // daytime white that read as fog once the swell started breaking everywhere
  col.assign(mix(col, vec3(0.82, 0.88, 0.90).mul(uSkyLight.mul(0.78).add(0.16)), foam));

  const horizonFade = smoothstep(150, 290, dist);
  col.assign(mix(col, uHorizonColor, horizonFade));

  return vec4(col, 1);
});

// ----------------------------------------------------------------------------
// SECTION 6 · TIME OF DAY (CPU palettes)
// ----------------------------------------------------------------------------

const lerp = (a, b, t) => a + (b - a) * t;

// Single sky model: everything is driven by the real sun elevation (see
// shared/sky.js). horizonF = 0 deep night, 1 at/above the horizon; dayF = 0 at
// the horizon, 1 once the sun is 12 deg up. DUSK sits exactly at the horizon so
// the 1.2.7 sunset look is preserved, and a real NIGHT fills in below -18 deg.
// The wallpaper is one fixed camera pointing north over the water. With a slight
// upward tilt it covers roughly -20°..34° of sky, nothing above that and nothing
// behind itself. A true compass sky would therefore hide the sun all afternoon
// (behind the camera) and above the frame near noon. Only the bearing is folded
// (due east -> left edge, due west -> right edge); the ALTITUDE stays the real one
// as long as it fits the frame, and only what is left above that is squeezed into
// the top band. The palette always comes from the real elevation, so noon is still
// noon and the disc never pins to one edge for hours.
const VIEW_AZ_MIN = 90;   // due east
const VIEW_AZ_MAX = 270;  // due west
const VIEW_AZ_HALF = 40;  // degrees either side of the view axis
// The frame sees -20°..40°: fov 60 tilted 10° up, so the horizon sits about a
// third of the way up from the bottom. That is enough to pass the real altitude
// through almost the whole year in Wuhan (noon ≈ 43° in November, ≈ 83° in June).
const VIEW_EL_REAL_MAX = 28;  // up to here the altitude is passed through untouched
const VIEW_EL_TOP = 38;       // where 90° lands: just inside the top of the frame
// 8° keeps the horizon at ~37% of the frame (enough sea for the fleet to read)
// while lifting a 19° sun to two thirds of the height.
const VIEW_PITCH_DEG = 8;

function viewAzimuth(azDeg) {
  const rel = ((azDeg % 360) + 360) % 360;
  const t = Math.min(1, Math.max(0, (rel - VIEW_AZ_MIN) / (VIEW_AZ_MAX - VIEW_AZ_MIN)));
  return (t * 2 - 1) * VIEW_AZ_HALF;
}

function viewElevation(elDeg) {
  if (elDeg <= 0) return elDeg;
  if (elDeg <= VIEW_EL_REAL_MAX) return elDeg;
  const t = Math.min(1, (elDeg - VIEW_EL_REAL_MAX) / (90 - VIEW_EL_REAL_MAX));
  return VIEW_EL_REAL_MAX + t * (VIEW_EL_TOP - VIEW_EL_REAL_MAX);
}

// elevationDeg drives the palette and the stars; the view pair only aims the
// disc and its glitter path. Manual mode passes them equal, as 1.2.7 did.
function applyElevation(elevationDeg, azimuthDeg, viewElDeg, viewAzDeg) {
  const el = (viewElDeg === undefined ? elevationDeg : viewElDeg) * DEG;
  const az = (viewAzDeg === undefined ? azimuthDeg : viewAzDeg) * DEG;
  const ce = Math.cos(el);
  const se = Math.sin(el);
  uSunDir.value.set(ce * Math.sin(az), se, -ce * Math.cos(az));

  const sky = skyFromElevation(elevationDeg);
  uZenithColor.value.set(sky.zenith[0], sky.zenith[1], sky.zenith[2]);
  uHorizonColor.value.set(sky.horizon[0], sky.horizon[1], sky.horizon[2]);
  uDeepColor.value.set(sky.deep[0], sky.deep[1], sky.deep[2]);
  uShallowColor.value.set(sky.shallow[0], sky.shallow[1], sky.shallow[2]);
  uSunColor.value.set(sky.sun[0], sky.sun[1], sky.sun[2]);
  uSkyLight.value = sky.skyLight;
  uNightF.value = 1 - sky.horizonF;

  sunElevationDeg = elevationDeg;
  sunAzimuthDeg = azimuthDeg;
  sunViewElevationDeg = viewElDeg === undefined ? elevationDeg : viewElDeg;
  sunViewAzimuthDeg = viewAzDeg === undefined ? azimuthDeg : viewAzDeg;
}

// Manual slider / legacy 720 s cycle: t 0..1 spans deep night (0) through
// sunset (~0.28) to afternoon (1). 1.2.7 mapped 0..1 onto DUSK..daylight only.
function applyTimeOfDay(t) {
  currentDaylight = Math.min(100, Math.max(0, t * 100));
  applyElevation(manualElevationDeg(t), manualAzimuthDeg(t));
}

// ----------------------------------------------------------------------------
// SECTION 6B · REAL SUN / MOON / STARS (contract §2.2)
// Uniforms only: the sky shader is compiled once and never rebuilt at runtime.
// Azimuth basis matches applyTimeOfDay: 0° = north = -z, 90° = east = +x.
// ----------------------------------------------------------------------------

function syncMoon(now) {
  const moon = moonPosition(new Date(now), sunLat, sunLon);
  moonElevationDeg = moon.elevationDeg;
  moonAzimuthDeg = moon.azimuthDeg;
  moonPhase01 = moon.phase01;
  moonBrightness = moonEnabled ? moon.brightness : 0;
  uMoonVisible.value = moonBrightness;

  // same rule as the sun: real altitude while it fits the frame, bearing folded
  const el = viewElevation(moon.elevationDeg) * DEG;
  const az = viewAzimuth(moon.azimuthDeg) * DEG;
  const ce = Math.cos(el);
  uMoonDir.value.set(ce * Math.sin(az), Math.sin(el), -ce * Math.cos(az));

  // terminator: cos(phase) is +1 at full moon and -1 at new moon. Mirroring it
  // is the same as mirroring the disc, so the lit limb always faces the sun.
  const phaseCos = Math.cos(moon.phase01 * Math.PI * 2);
  let rightX = uMoonDir.value.z;
  let rightZ = -uMoonDir.value.x;
  const horizontal = Math.hypot(rightX, rightZ);
  if (horizontal < 1e-4) {
    // moon (almost) overhead: any horizontal axis will do
    rightX = 1;
    rightZ = 0;
  } else {
    rightX /= horizontal;
    rightZ /= horizontal;
  }
  uMoonRight.value.set(rightX, 0, rightZ);
  const sunOnRight = rightX * uSunDir.value.x + rightZ * uSunDir.value.z;
  uMoonPhaseCos.value = sunOnRight < 0 ? -phaseCos : phaseCos;
}

function syncStars() {
  starsIntensity = starIntensityOf(sunElevationDeg, starsSetting, moonBrightness);
  uStars.value = starsIntensity;
}

// once per second in real mode (contract: no 720 s sine cycle)
let sunTimesKey = '';
let sunriseMinutes = null;
let sunsetMinutes = null;

// Recomputed only when the calendar day or the coordinates change: the scan
// costs 1440 cheap evaluations, which is nothing once a day and wasteful per
// frame.
function refreshSunTimes(now) {
  const at = new Date(now);
  const key = at.getFullYear() + '-' + (at.getMonth() + 1) + '-' + at.getDate() + '@' + sunLat + ',' + sunLon;
  if (key === sunTimesKey) return;
  sunTimesKey = key;
  const times = sunTimes(at, sunLat, sunLon);
  sunriseMinutes = times.riseMinutes;
  sunsetMinutes = times.setMinutes;
}

function refreshSky(now) {
  refreshSunTimes(now);
  if (sunMode === 'real') {
    const sun = sunPosition(new Date(now), sunLat, sunLon);
    // palette from the true elevation, disc aimed into the visible band
    applyElevation(
      sun.elevationDeg,
      sun.azimuthDeg,
      viewElevation(sun.elevationDeg),
      viewAzimuth(sun.azimuthDeg),
    );
  }
  syncMoon(now);
  syncStars();
}

function applySunMessage(d) {
  if (d.mode === 'real' || d.mode === 'manual') sunMode = d.mode;
  const lat = Number(d.lat);
  const lon = Number(d.lon);
  if (Number.isFinite(lat) && lat >= -90 && lat <= 90) sunLat = lat;
  if (Number.isFinite(lon) && lon >= -180 && lon <= 180) sunLon = lon;
  if (typeof d.moon === 'boolean') moonEnabled = d.moon;
  if (SKY_LEVELS.indexOf(d.stars) >= 0) starsSetting = d.stars;
  if (SKY_LEVELS.indexOf(d.constellation) >= 0) constellationSetting = d.constellation;
  uConstellation.value = CONSTELLATION_GRADES[constellationSetting] ?? CONSTELLATION_GRADES.mid;
  if (typeof d.meteor === 'boolean') meteorEnabled = d.meteor;
  if (SKY_LEVELS.indexOf(d.clouds) >= 0) cloudsSetting = d.clouds;
  uCloudCover.value = cloudCoverOf(cloudsSetting);
  cloudCover = uCloudCover.value;
  if (sunMode === 'manual') {
    manualTimeOfDay = d.auto !== true;
    const t = Number(d.t);
    if (Number.isFinite(t) && t >= 0 && t <= 100) applyTimeOfDay(t / 100);
  }
  refreshSky(Date.now());
}


// ----------------------------------------------------------------------------
// SECTION 7 · DOM REFERENCES (absent in skin mode)
// ----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const loader = $('loader');
const loaderTitle = $('loader-title');
const loaderStatus = $('loader-status');
const loaderNote = $('loader-note');
const ui = $('ui');
const seaSlider = $('sea-state');
const seaValue = $('sea-state-value');
const timeSlider = $('time-of-day');
const timeLabel = $('time-label');
const driftButton = $('drift');
const fpsReadout = $('fps');

// ----------------------------------------------------------------------------
// SECTION 8 · LOADING / ERROR STATES
// ----------------------------------------------------------------------------

function showUnavailable() {
  if (!loader) {
    console.error('[OPEN SEA SKIN] WebGPU is not available in this browser.');
    return;
  }
  loader.classList.add('error');
  loaderTitle.textContent = 'WEBGPU UNAVAILABLE';
  loaderStatus.textContent = 'WEBGPU IS NOT AVAILABLE IN THIS BROWSER';
  loaderNote.hidden = false;
  loaderNote.textContent = 'Open Sea requires WebGPU. Please use a recent version of Chrome or Edge with hardware acceleration enabled, then reload the page.';
}

function showInitError(err) {
  console.error('[OPEN SEA SKIN] initialization failed:', err);
  if (!loader) return;
  loader.classList.add('error');
  loaderTitle.textContent = 'INITIALIZATION FAILED';
  loaderStatus.textContent = err && err.message ? err.message : String(err);
  loaderNote.hidden = false;
  loaderNote.textContent = 'Make sure hardware acceleration is enabled and try the latest Chrome or Edge. Details were logged to the console.';
}

function revealUI() {
  if (loader) loader.classList.add('done');
  if (ui) ui.classList.add('visible');
  document.body.classList.add('ready'); // skin mode: fades the ocean in
}

// ----------------------------------------------------------------------------
// SECTION 8B · RENDERER-SIDE FROSTED GLASS (contract §2.3 / §3)
// Structure follows upstream BloomNode: TempNode subclass + RenderTargets +
// a separable blur material + passTexture(), rendered from updateBefore().
// ----------------------------------------------------------------------------

const GLASS_KERNEL = 9;
const GLASS_WEIGHTS = (() => {
  // gaussian, 9 taps, normalised so the centre + both sides integrate to 1
  const sigma = GLASS_KERNEL / 3;
  const weights = [];
  let total = 0;
  for (let i = 0; i < GLASS_KERNEL; i++) {
    const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
    weights.push(weight);
    total += i === 0 ? weight : weight * 2;
  }
  return weights.map((weight) => weight / total);
})();

const glassQuad = new THREE.QuadMesh();
const glassDrawSize = new THREE.Vector2();
let glassSavedState;

class GlassBlurNode extends THREE.TempNode {
  constructor(inputNode) {
    super('vec4');
    this.inputNode = inputNode;
    this.invSize = uniform(new THREE.Vector2(1, 1));
    this.direction = uniform(new THREE.Vector2(1, 0));
    this.colorTexture = texture(null);
    this.targetH = new THREE.RenderTarget(1, 1, { depthBuffer: false, type: THREE.HalfFloatType });
    this.targetV = new THREE.RenderTarget(1, 1, { depthBuffer: false, type: THREE.HalfFloatType });
    this.targetH.texture.name = 'OpenSea.glassH';
    this.targetV.texture.name = 'OpenSea.glassV';
    this.targetH.texture.generateMipmaps = false;
    this.targetV.texture.generateMipmaps = false;
    this._textureOutput = passTexture(this, this.targetV.texture);
    this._materialH = null;
    this._materialV = null;
    this._width = 0;
    this._height = 0;
    this.active = false;
    this.updateBeforeType = THREE.NodeUpdateType.FRAME;
  }

  getTextureNode() {
    return this._textureOutput;
  }

  // half resolution, like the bloom chain: the blur is low frequency anyway
  setSize(width, height) {
    const w = Math.max(1, Math.round(width / 2));
    const h = Math.max(1, Math.round(height / 2));
    if (w === this._width && h === this._height) return;
    this._width = w;
    this._height = h;
    this.targetH.setSize(w, h);
    this.targetV.setSize(w, h);
    this.invSize.value.set(1 / w, 1 / h);
  }

  // mirrored 9-tap gaussian along this.direction
  _blurNode(sampleAt) {
    const step = this.invSize.mul(this.direction).mul(uGlassSpread);
    return Fn(() => {
      const coord = uv();
      const sum = sampleAt(coord).rgb.mul(GLASS_WEIGHTS[0]).toVar();
      for (let i = 1; i < GLASS_KERNEL; i++) {
        const offset = step.mul(float(i));
        sum.addAssign(sampleAt(coord.add(offset)).add(sampleAt(coord.sub(offset))).mul(GLASS_WEIGHTS[i]));
      }
      return vec4(sum, 1);
    });
  }

  setup(builder) {
    const context = builder.getSharedContext();
    if (!this._materialH) {
      // pass 1 samples the scene pass directly, which also gives the node the
      // graph edge that orders it after the scene render
      this._materialH = new THREE.NodeMaterial();
      this._materialH.name = 'OpenSea.glassBlurH';
      this._materialH.fragmentNode = this._blurNode((coord) => this.inputNode.sample(coord))().context(context);
      this._materialH.needsUpdate = true;
    }
    if (!this._materialV) {
      this._materialV = new THREE.NodeMaterial();
      this._materialV.name = 'OpenSea.glassBlurV';
      this._materialV.fragmentNode = this._blurNode((coord) => this.colorTexture.sample(coord))().context(context);
      this._materialV.needsUpdate = true;
    }
    return this._textureOutput;
  }

  updateBefore(frame) {
    // inactive: no render targets touched, no extra sampling at all
    if (!this.active || !this._materialH || !this._materialV) return;
    if (!this.inputNode || !this.inputNode.value) {
      // the scene pass has not produced a texture: stay on the clear image
      this.active = false;
      glassActive = false;
      uGlassActive.value = 0;
      warnGlass(new Error('scene texture unavailable'));
      return;
    }
    const { renderer } = frame;
    glassSavedState = THREE.RendererUtils.resetRendererState(renderer, glassSavedState);
    renderer.getDrawingBufferSize(glassDrawSize);
    this.setSize(glassDrawSize.width, glassDrawSize.height);

    this.direction.value.set(1, 0);
    glassQuad.material = this._materialH;
    renderer.setRenderTarget(this.targetH);
    glassQuad.render(renderer);

    this.colorTexture.value = this.targetH.texture;
    this.direction.value.set(0, 1);
    glassQuad.material = this._materialV;
    renderer.setRenderTarget(this.targetV);
    glassQuad.render(renderer);

    THREE.RendererUtils.restoreRendererState(renderer, glassSavedState);
  }
}

// weight = max over the three columns, smoothstepped at every edge, so a pixel
// outside every rect gets exactly 0 and therefore keeps the clear image
const glassWeight = Fn(() => {
  const coord = uv();
  const edge = uGlassEdge;
  const weight = float(0).toVar();
  for (let i = 0; i < GLASS_MAX_RECTS; i++) {
    const rect = uGlassRects.element(i);
    const level = uGlassLevels.element(i);
    const inside = smoothstep(float(0), edge, coord.x.sub(rect.x))
      .mul(smoothstep(float(0), edge, rect.z.sub(coord.x)))
      .mul(smoothstep(float(0), edge, coord.y.sub(rect.y)))
      .mul(smoothstep(float(0), edge, rect.w.sub(coord.y)));
    weight.assign(max(weight, inside.mul(level)));
  }
  return clamp(weight.mul(uGlassActive), 0, 1);
});

function buildComposite(sceneColor, sceneBloom, glassNode) {
  if (!glassNode) return sceneColor.add(sceneBloom);
  const blurred = glassNode.getTextureNode();
  const composite = Fn(() => {
    const rgb = sceneColor.add(sceneBloom).rgb.toVar();
    const weight = glassWeight();
    If(weight.greaterThan(0.001), () => {
      rgb.assign(mix(rgb, blurred.sample(uv()).rgb, weight));
    });
    return vec4(rgb, 1);
  });
  return composite();
}

const glassRectState = [
  { x0: 0, y0: 0, x1: 0, y1: 0, level: 0 },
  { x0: 0, y0: 0, x1: 0, y1: 0, level: 0 },
  { x0: 0, y0: 0, x1: 0, y1: 0, level: 0 },
];
let glassNode = null;
let glassActive = false;
let glassWarned = false;
let glassScaleCapped = false;

function warnGlass(err) {
  if (glassWarned) return;
  glassWarned = true;
  console.warn('[OPEN SEA SKIN] frosted glass disabled, keeping the clear image:', err);
}

const GLASS_LEVELS = { off: 0, weak: 0.35, medium: 0.7, strong: 1 };

function glassLevelOf(level) {
  if (typeof level === 'number' && Number.isFinite(level)) return Math.min(1, Math.max(0, level));
  return Object.prototype.hasOwnProperty.call(GLASS_LEVELS, level) ? GLASS_LEVELS[level] : 0;
}

// accepts both the contract shape ({ mode, perf }) and the host's older
// { active } shorthand; rects arrive normalised 0..1 but CSS px are tolerated
function applyGlassMessage(d) {
  const requested = d.mode === 'css' ? false
    : d.mode === 'render' ? true
      : d.active === true;
  const wanted = requested && d.perf !== true;
  const rects = [];
  if (wanted && Array.isArray(d.rects)) {
    for (const rect of d.rects) {
      if (!rect || rects.length >= GLASS_MAX_RECTS) break;
      const x0 = Math.min(rect.x0, rect.x1);
      const x1 = Math.max(rect.x0, rect.x1);
      const y0 = Math.min(rect.y0, rect.y1);
      const y1 = Math.max(rect.y0, rect.y1);
      const level = glassLevelOf(rect.level);
      if (![x0, y0, x1, y1].every((v) => Number.isFinite(v)) || level <= 0) continue;
      const px = x1 > 1.5 || y1 > 1.5;
      const w = px ? window.innerWidth || 1 : 1;
      const h = px ? window.innerHeight || 1 : 1;
      // uv() is bottom-up, the host measures columns top-down: flip y here
      const ya = clamp01(1 - y1 / h);
      const yb = clamp01(1 - y0 / h);
      rects.push({
        x0: clamp01(x0 / w), y0: ya, x1: clamp01(x1 / w), y1: yb, level,
      });
    }
  }
  applyGlass(wanted && rects.length > 0, rects);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function applyGlass(active, rects) {
  const effective = active === true && glassNode !== null;
  if (active === true && glassNode === null) warnGlass(new Error('blur node unavailable'));

  for (let i = 0; i < GLASS_MAX_RECTS; i++) {
    const src = effective ? rects[i] : null;
    const dst = glassRectState[i];
    dst.x0 = src ? src.x0 : 0;
    dst.y0 = src ? src.y0 : 0;
    dst.x1 = src ? src.x1 : 0;
    dst.y1 = src ? src.y1 : 0;
    dst.level = src ? src.level : 0;
    uGlassRects.array[i].set(dst.x0, dst.y0, dst.x1, dst.y1);
    uGlassLevels.array[i] = dst.level;
  }
  glassActive = effective;
  uGlassActive.value = effective ? 1 : 0;
  if (glassNode) glassNode.active = effective;

  // contract §3.4: cap (not floor) the adaptive resolution while blur runs
  SCALE_CAP = effective ? 0.7 : 1;
  if (effective && renderer && renderScale > SCALE_CAP) {
    renderScale = SCALE_CAP;
    glassScaleCapped = true;
    applyResolutionScale(renderScale);
  } else if (!effective && glassScaleCapped) {
    // blur off again: hand the full ratio back to the adaptive controller
    glassScaleCapped = false;
    if (renderer && renderScale < 1) {
      renderScale = 1;
      applyResolutionScale(renderScale);
    }
  }
}

// skin controls: the host page sends 波浪大小/日光 adjustments here
if (SKIN) {
  window.addEventListener('message', (ev) => {
    if (ev.source !== window.parent) return;
    if (SKIN_PARENT_ORIGIN && ev.origin !== SKIN_PARENT_ORIGIN) return;
    const d = ev.data;
    if (d && d.type === 'oss-set') {
      manualTimeOfDay = d.auto !== true;
      const sea = Number(d.sea);
      const t = Number(d.t);
      // Clamp instead of reject: a host that computes a cost curve can overshoot
      // 100, and dropping the message left the surface frozen at its initial level.
      if (Number.isFinite(sea)) {
        seaGoal = 0.25 + (Math.max(0, Math.min(100, sea)) / 100) * 1.5;
      }
      // In `real` mode the sky is driven by solar.js; a host that keeps
      // posting t (sea updates arrive at 4 Hz) must not overwrite it.
      if (Number.isFinite(t) && t >= 0 && t <= 100 && sunMode === 'manual') {
        applyTimeOfDay(t / 100);
      }
    }
    if (d && d.type === 'oss-sun') applySunMessage(d);
    if (d && d.type === 'oss-glass') applyGlassMessage(d);
    if (d && d.type === 'oss-fleet') {
      const count = Number(d.count);
      // `off` is the panel switch: without it "0 subagents" and "boats turned off"
      // look identical, and the base hull would keep showing on a disabled skin.
      if (d.off === true) boatTarget = 0;
      else if (Number.isFinite(count)) {
        boatTarget = Math.max(BOAT_BASE, Math.min(BOAT_MAX, Math.round(count)));
      }
    }
  });
  // tiny debug hook for automated checks (contract §3.6)
  window.__ossState = () => ({
    sea: uSea.value,
    seaGoal,
    daylight: currentDaylight,
    sunElevationDeg,
    sunAzimuthDeg,
    sunViewElevationDeg,
    sunViewAzimuthDeg,
    sunriseMinutes,
    sunsetMinutes,
    moonElevationDeg,
    moonAzimuthDeg,
    moonPhase01,
    moonIllum: moonBrightness,
    moonBrightness,
    constellation: constellationSetting,
    meteorEnabled,
    starsIntensity,
    cloudCover,
    blurRects: glassRectState.map((rect) => ({
      x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, level: rect.level,
    })),
    blurActive: glassActive,
    sunMode,
    moonEnabled,
    stars: starsSetting,
    clouds: cloudsSetting,
    renderScale,
    reducedMotion: REDUCED_MOTION,
    lowEndDevice: LOW_END_DEVICE,
    starOpacity: starLayer ? starLayer.starsOpacity : 0,
    meteor: starLayer ? starLayer.meteor.active : false,
    boats: boatShown,
    boatTarget,
    elapsed: uTime.value,
    manualTimeOfDay,
  });
}

// ----------------------------------------------------------------------------
// SECTION 9 · BOOTSTRAP — renderer, scene, post-processing, controls, loop
// ECO tuning: lighter mesh, no MSAA (inert under PostProcessing anyway),
// capped pixel ratio with adaptive scale, 60 fps frame cap, low-power
// adapter in skin mode, and everything still pauses when the tab hides.
// ----------------------------------------------------------------------------

let renderer = null;
let postProcessing = null;
let controls = null;
let lastFrameTime = performance.now();
let lastRenderAt = 0;
let fpsFrames = 0;
let fpsWindow = 0;
let adaptWindow = 0;
let fpsNow = 0;
let fpsStamp = performance.now();
let adaptStamp = performance.now();
let skinTimeWindow = 0;
let firstFrameShown = false;
let loopStarted = false;

let PIXEL_RATIO_CAP = REDUCED_MOTION ? 0.9 : LOW_END_DEVICE ? 1.0 : 1.5;
let BASE_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP);
let FRAME_RATE_CAP = REDUCED_MOTION ? 20 : LOW_END_DEVICE ? 30 : 60;
let FRAME_MS = 1000 / FRAME_RATE_CAP;
let TARGET_FPS = REDUCED_MOTION ? 18 : LOW_END_DEVICE ? 28 : SKIN ? 40 : 55;
const MIN_SCALE = REDUCED_MOTION ? 0.5 : SKIN ? 0.5 : 0.55;
let adaptHold = 0;
let renderScale = 1;
// contract §3.4: the frosted glass caps the adaptive scale, it never raises it
let SCALE_CAP = 1;

function applyResolutionScale(scale) {
  renderer.setPixelRatio(BASE_PIXEL_RATIO * scale);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(now) {
  // high-resolution timestamp -> delta, clamped so hitches never cause jumps
  const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  uTime.value += dt * (REDUCED_MOTION ? 0.12 : 1);
  // frame-rate independent follow of the requested sea level (see seaGoal)
  uSea.value += (seaGoal - uSea.value) * (1 - Math.exp(-dt / SEA_FOLLOW_TAU));
  controls.update();
  // a throw here would kill the animation loop and leave an unpresented (white)
  // canvas, so each optional layer degrades on its own instead
  if (SKIN && boats) {
    try {
      updateBoats(dt);
    } catch (err) {
      boats = null;
      console.warn('[open-sea-skin] boats disabled', err);
    }
  }
  if (SKIN && starLayer) {
    try {
      updateStarDome(now, dt);
    } catch (err) {
      starLayer = null;
      console.warn('[open-sea-skin] star dome disabled', err);
    }
  }

  // frame cap: skip work when the display fires faster than 60 Hz
  if (now - lastRenderAt < FRAME_MS - 0.5) return;
  lastRenderAt = now;

  postProcessing.render();

  // rolling FPS + adaptive resolution (rechecked every 2 s)
  // wall-clock windows: skipped frames must not shrink the meter's time base
  fpsFrames += 1;
  fpsWindow += (now - fpsStamp) / 1000;
  fpsStamp = now;
  adaptWindow += (now - adaptStamp) / 1000;
  adaptStamp = now;
  if (fpsWindow >= 0.5) {
    fpsNow = fpsFrames / fpsWindow;
    fpsFrames = 0;
    fpsWindow = 0;
    if (fpsReadout) fpsReadout.textContent = String(Math.round(fpsNow)).padStart(2, '0') + ' FPS';
  }
  if (adaptWindow >= 2) {
    adaptWindow = 0;
    // After a change, wait two more windows before touching the scale again.
    // Without the hold the loop pumps 0.92/1.06 every 2 s around the target,
    // and that periodic sharpness pulse reads as stutter on the water.
    if (adaptHold > 0) adaptHold -= 1;
    if (fpsNow > 0 && adaptHold === 0) {
      if (fpsNow < TARGET_FPS - 8 && renderScale > MIN_SCALE) {
        renderScale = Math.max(MIN_SCALE, +(renderScale * 0.96).toFixed(3));
        applyResolutionScale(renderScale);
        adaptHold = 2;
      } else if (fpsNow > TARGET_FPS + 8 && renderScale < SCALE_CAP) {
        renderScale = Math.min(SCALE_CAP, +(renderScale * 1.02).toFixed(3));
        applyResolutionScale(renderScale);
        adaptHold = 2;
      }
    }
  }

  // skin mode: real sun follows the clock (contract §2.2 forbids the 720 s
  // sine cycle); a manual 日光 pin falls through to the slow legacy cycle
  if (SKIN && sunMode === 'real') {
    sunClock += dt;
    if (sunClock >= 1) {
      sunClock = 0;
      refreshSky(Date.now());
    }
  } else if (SKIN && !manualTimeOfDay) {
    skinTimeWindow += dt;
    if (skinTimeWindow >= 0.25) {
      skinTimeWindow = 0;
      // 12-minute day/night cycle
      applyTimeOfDay(0.5 + 0.5 * Math.sin((uTime.value / 720) * Math.PI * 2));
    }
  }

  // the loader disappears only after the first successfully rendered frame
  if (!firstFrameShown) {
    firstFrameShown = true;
    revealUI();
  }
}

const OCEAN_BUILD = 'lab-1.5.2/98bbfd2';

async function boot() {
  console.info('[open-sea-skin] ocean', OCEAN_BUILD);
  // 不再预检 navigator.gpu：无 WebGPU API（低配/无显卡环境）时 three 自动
  // 回退 WebGL2 backend（2026-08-23 冒烟测试：预检导致黑底白字异常画面，
  // 实际 WebGL2 渲染完全可用）；两个 backend 都失败由 init() 抛出走
  // showInitError（准确错误信息，而不是笼统的「WEBGPU UNAVAILABLE」）。

  try {
    // --- renderer (no MSAA; low-power adapter in skin mode) ---------------
    renderer = new THREE.WebGPURenderer({
      antialias: false, // MSAA is inert under the post pipeline — pure savings
      powerPreference: SKIN ? 'low-power' : 'high-performance',
    });
    renderer.setPixelRatio(BASE_PIXEL_RATIO);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);

    // --- scene & camera ----------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070a);

    // 60° vertical fov: the skin is a sky as much as a sea now, and the real
    // solar altitude has to fit. The tilt lives in controls.target below, because
    // OrbitControls derives the orientation from position -> target and would
    // overwrite camera.rotation on every update().
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 8000);
    camera.position.set(0, 5.5, 17);

    // The boat lanes measure their off-stage point from this camera's frustum.
    boatCamera = camera;

    // --- ocean --------------------------------------------------------------
    // 256x256 segments instead of 440x440: 66k verts vs 194k (~8 MB less
    // VRAM) with no visible difference — fine detail lives in the FBM normals.
    const oceanSegments = LOW_END_DEVICE || REDUCED_MOTION ? 160 : 256;
    const oceanGeometry = new THREE.PlaneGeometry(420, 420, oceanSegments, oceanSegments);
    oceanGeometry.rotateX(-Math.PI / 2);

    const oceanMaterial = new THREE.MeshBasicNodeMaterial();
    oceanMaterial.positionNode = wavePosition(positionLocal.xz, uTime, uSea);
    oceanMaterial.colorNode = oceanColor();

    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.frustumCulled = false;
    scene.add(ocean);

    // --- sky dome ------------------------------------------------------------
    const skyMaterial = new THREE.MeshBasicNodeMaterial();
    skyMaterial.colorNode = skyColor(normalize(positionWorld), float(1), float(1));
    skyMaterial.side = THREE.BackSide;
    skyMaterial.depthWrite = false;

    const sky = new THREE.Mesh(new THREE.SphereGeometry(
      4000, LOW_END_DEVICE ? 32 : 48, LOW_END_DEVICE ? 16 : 24,
    ), skyMaterial);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);

    // boats live only in skin mode: they represent the running subagents
    if (SKIN) boats = createBoats(scene, camera);

    // real constellation dome on top of the shader's faint star haze
    if (SKIN) {
      try {
        starLayer = createStarLayer(scene);
      } catch (error) {
        console.warn('[open-sea-skin] star dome disabled', error);
        starLayer = null;
      }
    }

    // --- post-processing: scene pass + TSL bloom + optional frosted glass ---
  

  postProcessing = new THREE.PostProcessing(renderer);
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode('output');
    const bloomStrength = SKIN ? (LOW_END_DEVICE ? 0.18 : 0.28) : 0.4;
    const sceneBloom = bloom(sceneColor, bloomStrength, 0.3, 0.9);
    if (SKIN) {
      // contract §3.5: any failure here must keep the clear image on screen
      try {
        glassNode = new GlassBlurNode(sceneColor);
      } catch (err) {
        glassNode = null;
        warnGlass(err);
      }
    }
    postProcessing.outputNode = buildComposite(sceneColor, sceneBloom, glassNode);

    // --- orbit controls -----------------------------------------------------
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4;
    controls.maxDistance = 120;
    controls.minPolarAngle = 0.15;
    // must allow looking up: the pitch used to be clamped back to ~0°
    controls.maxPolarAngle = Math.PI * 0.62;
    // The tilt lives here, not in camera.rotation: update() rebuilds the
    // orientation from position -> target. Looking up 10° puts the horizon a
    // third of the way up the frame and lifts the sun and the moon off the water.
    controls.target.set(0, camera.position.y + Math.tan(VIEW_PITCH_DEG * DEG) * 17, 0);
    // In skin mode the frame must stay still: an auto-rotating camera made the
    // sun and the constellations drift across the sky on their own.
    controls.autoRotate = !REDUCED_MOTION && !SKIN;
    controls.autoRotateSpeed = 0.25;
    controls.update();

    // --- UI bindings (full-page mode only) ----------------------------------
    if (!SKIN) {
      if (REDUCED_MOTION) {
        driftButton.classList.remove('active');
        driftButton.setAttribute('aria-pressed', 'false');
      }
      const onSeaInput = () => {
        const v = Number(seaSlider.value);
        seaValue.textContent = String(v).padStart(2, '0');
        seaGoal = 0.25 + (v / 100) * 1.5;
      };
      const onTimeInput = () => {
        applyTimeOfDay(Number(timeSlider.value) / 100);
        timeLabel.textContent = timeOfDayLabel(Number(timeSlider.value) / 100);
      };
      seaSlider.addEventListener('input', onSeaInput);
      timeSlider.addEventListener('input', onTimeInput);
      driftButton.addEventListener('click', () => {
        controls.autoRotate = !controls.autoRotate;
        driftButton.classList.toggle('active', controls.autoRotate);
        driftButton.setAttribute('aria-pressed', controls.autoRotate ? 'true' : 'false');
      });
      onSeaInput();
      onTimeInput(); // t = 0.55 -> AFTERNOON
    } else {
      // skin mode: saved 波浪大小/日光 from the host content script
      if (SKIN_SEA !== null) {
        seaGoal = 0.25 + (SKIN_SEA / 100) * 1.5;
        uSea.value = seaGoal;
      }
      applyTimeOfDay(SKIN_TIME !== null ? SKIN_TIME / 100 : 0.55);
      if (SKIN_TIME !== null) {
        // a pinned 日光 from the url means "manual", the live sky must not fight it
        sunMode = 'manual';
        manualTimeOfDay = true;
      }
      // sun/moon/stars/clouds come from the real clock until the host says otherwise
      refreshSky(Date.now());
    }

    // --- lifecycle: resize ---------------------------------------------------
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      applyResolutionScale(renderScale);
    });

    // --- lifecycle: pause when the tab is hidden -------------------------------
    document.addEventListener('visibilitychange', () => {
      if (!loopStarted) return;
      if (document.hidden) {
        renderer.setAnimationLoop(null);
      } else {
        lastFrameTime = performance.now();
        lastRenderAt = 0;
        renderer.setAnimationLoop(animate);
      }
    });

    // --- initialize the GPU and start rendering --------------------------------
    await renderer.init();

    if (renderer.backend.isWebGPUBackend !== true) {
      // WebGPU 不可用时 three 自动回退 WebGL2 backend：两种 backend 都允许渲染
      // （2026-08-23 webgui 冒烟测试：用户浏览器无 WebGPU → 纯 WebGPU 检查导致初始化失败）。
      PIXEL_RATIO_CAP = 1.0;
      BASE_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP);
      FRAME_RATE_CAP = 30;
      FRAME_MS = 1000 / FRAME_RATE_CAP;
      TARGET_FPS = 28;
      renderScale = 0.6;
      applyResolutionScale(renderScale);
    }

    loopStarted = true;
    renderer.setAnimationLoop(animate);
  } catch (err) {
    showInitError(err);
  }
}

// ---------------------------------------------------------------------------
// SECTION 10 · FLEET · one boat per subagent in this session (host roster -> message)
// ---------------------------------------------------------------------------

const BOAT_MAX = 12;
// One hull always stays on the water: with no subagent in the session an empty
// sea reads as "the fleet feature is broken", not as "no work in progress".
const BOAT_BASE = 1;
// Boats close enough to overlap get pushed apart by this much, in world units.
const BOAT_MIN_SEP = 7;
// How far outside the frame a boat sits while it arrives or leaves: measured
// from the camera's own frustum at the boat's depth, so an entrance really starts
// at the left or right edge instead of somewhere mid-screen on a wide window.
// A hull's width of margin keeps the first visible moment at the edge itself.
const BOAT_MARGIN = 6;
// Sideways travel rates (per second, exponential): arrivals sail in at a walking
// pace and departures are a touch slower, so a boat is seen to leave the frame
// rather than blink out of it.
const BOAT_ENTER_RATE = 0.95;
const BOAT_EXIT_RATE = 0.72;
// Distance used to read the wave slope under a boat, in world units. Long enough
// to see a swell face, short enough that a hull smaller than the wavelength.
const BOAT_PROBE = 2.4;
let boatTarget = BOAT_BASE;
let boatShown = 0;
// camera the fleet is anchored to; set when the boats are created
let boatCamera = null;

// Half the visible width at a given depth, plus a margin: a boat placed there is
// just outside the frame, which is where every entrance and exit happens.
function boatApproachOffset(ahead) {
  const fov = ((boatCamera && boatCamera.fov) || 45) * (Math.PI / 180);
  const aspect = (boatCamera && boatCamera.aspect)
    || (window.innerWidth / Math.max(1, window.innerHeight))
    || 1.6;
  return Math.abs(ahead) * Math.tan(fov / 2) * aspect + BOAT_MARGIN;
}
// A boat cruises inside the belt of sea the camera is actually looking at:
// an absolute berth slides out of frame as the camera orbits and reads as
// "the boat sailed off for good". Each boat keeps its own ellipse in front of the
// camera and points along the tangent, so it never turns around on the spot.
const boatCruise = Array.from({ length: BOAT_MAX }, (_, index) => {
  const spread = index / (BOAT_MAX - 1);
  // 36–52 units ahead keeps the hulls in the upper band of the sea, just under
  // the horizon. The camera now pitches 8 degrees up, so the water only fills the
  // lower third of the frame and anything nearer than ~30 units sits on the very
  // bottom edge. 3–7 units of lateral swing still leaves room for the approach
  // offset to stay off screen instead of parking a hull at the edge.
  const base = 26 + (index % 4) * 9 + Math.floor(index / 4) * 3;
  const phase = spread * Math.PI * 2 + index * 0.7;
  return {
    // Each boat sails its own ellipse in front of the camera. A lane that only
    // ran left and right turned around on the spot, which read as a toy sliding
    // back and forth; an ellipse keeps the heading rotating all the way round.
    phase,
    // the orbit angle is integrated frame by frame (not derived from the clock),
    // because the swell has to be able to speed a boat up and slow it down
    angle: phase,
    // multiplier from the local wave slope: 1 = level water, >1 sliding down a
    // face, <1 climbing the next one. Set from the previous frame's sample.
    surge: 1,
    base,
    // alternate sides so a burst of arrivals crosses the frame from both edges
    side: index % 2 === 0 ? 1 : -1,
    radiusRight: 6 + ((index * 3.7) % 14),
    radiusBack: 2 + ((index * 2.3) % 6),
    // 0.10–0.19 rad/s: one lap takes 33–63 s in a flat calm
    speed: 0.1 + ((index * 0.037) % 0.09),
    // separation pushes accumulate here and decay, so boats ease apart instead
    // of snapping every frame
    pushX: 0,
    pushZ: 0,
    // sideways offset from the lane: 0 while cruising, `±offStage` while the hull
    // is outside the frame. This one number carries every arrival and departure.
    away: 0,
    lastAway: 0,
    // which edge the boat left by; 0 = not leaving, pick the nearer side
    exitSide: 0,
    // false = the hull is outside the frame and is not being drawn at all
    shown: false,
  };
});

// CPU mirror of waveSurface(): boats ride the exact swell the shader draws.
function seaStateAt(x, z, time, sea) {
  let y = 0;
  let tx = 1, ty = 0, tz = 0;
  let bx = 0, by = 0, bz = 1;
  for (const w of GERSTNER_DEFS) {
    const f = w.k * (w.dx * x + w.dy * z - time * w.c);
    const a = w.a0 * sea;
    const s = Math.sin(f);
    const co = Math.cos(f);
    const ak = a * w.k;
    const aks = ak * s;
    const akc = ak * co;
    y += a * s;
    tx -= aks * w.dx * w.dx; ty += akc * w.dx; tz -= aks * w.dx * w.dy;
    bx -= aks * w.dx * w.dy; by += akc * w.dy; bz -= aks * w.dy * w.dy;
  }
  const nx = by * tz - bz * ty;
  const ny = bz * tx - bx * tz;
  const nz = bx * ty - by * tx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { y, nx: nx / len, ny: ny / len, nz: nz / len };
}

let boats = null;

function createBoats(scene, cam) {
  boatCamera = cam;
  const hullGeometry = new THREE.BoxGeometry(1.5, 0.32, 0.46);
  hullGeometry.translate(0, 0.1, 0);
  const mastGeometry = new THREE.BoxGeometry(0.05, 1.25, 0.05);
  mastGeometry.translate(0.02, 0.75, 0);
  const sailGeometry = new THREE.BufferGeometry();
  sailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.3, 0, 0,
    0.55, 0, 0,
    0.02, 1.15, 0,
  ]), 3));
  sailGeometry.computeVertexNormals();
  sailGeometry.translate(0, 0.36, 0);
  const lanternGeometry = new THREE.SphereGeometry(0.09, 8, 6);
  lanternGeometry.translate(-0.45, 0.42, 0);

  const make = (geometry, colorNode, side = THREE.FrontSide) => {
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = colorNode;
    material.side = side;
    const mesh = new THREE.InstancedMesh(geometry, material, BOAT_MAX);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return mesh;
  };

  // Boats follow the water's brightness but never drop to it: at midnight the
  // sail keeps a moonlight edge, which is what makes the silhouette readable.
  const lit = uSkyLight.mul(0.8).add(0.05).add(uNightF.mul(0.3));
  const hullLit = uSkyLight.mul(0.8).add(0.04).add(uNightF.mul(0.12));
  return {
    hull: make(hullGeometry, vec3(0.17, 0.2, 0.25).mul(hullLit)),
    mast: make(mastGeometry, vec3(0.26, 0.22, 0.19).mul(lit)),
    sail: make(sailGeometry, vec3(0.95, 0.94, 0.9).mul(lit), THREE.DoubleSide),
    lantern: make(lanternGeometry, vec3(1.0, 0.72, 0.34).mul(uNightF.mul(1.7).add(0.12))),
  };
}

const boatDummy = new THREE.Object3D();
const BOAT_UP = new THREE.Vector3(0, 1, 0);
const boatNormal = new THREE.Vector3();
const boatTilt = new THREE.Quaternion();
const boatYaw = new THREE.Quaternion();
const boatForward = new THREE.Vector3();
const boatRight = new THREE.Vector3();
const boatPlaced = Array.from({ length: BOAT_MAX }, () => ({ x: 0, z: 0, fade: 0, lane: 0, heading: 0, dirX: 0, dirZ: -1 }));

// Flat forward/right pair: the fleet rides the horizontal plane, so pitch is
// handled by the swell normal instead of the camera's downward tilt.
function boatAxes() {
  if (boatCamera) boatCamera.getWorldDirection(boatForward);
  else boatForward.set(0, 0, -1);
  boatForward.y = 0;
  if (boatForward.lengthSq() < 1e-6) boatForward.set(0, 0, -1);
  boatForward.normalize();
  boatRight.crossVectors(boatForward, BOAT_UP).normalize();
}

function updateBoats(dt) {
  if (!boats) return;
  boatAxes();
  const originX = boatCamera ? boatCamera.position.x : 0;
  const originZ = boatCamera ? boatCamera.position.z : 17;
  const time = uTime.value;
  // Swell sets the pace: a glassy sea lets the fleet drift, a heavy sea has the
  // hulls running. uSea runs 0.25 (calm) .. 1.75 (rough) by the parent mapping.
  const seaLevel = Math.max(0, Math.min(1, (uSea.value - 0.25) / 1.5));
  const cruise = 0.65 + 0.95 * seaLevel;
  let placedCount = 0;

  for (let index = 0; index < BOAT_MAX; index += 1) {
    const want = index < boatTarget ? 1 : 0;
    const lane = boatCruise[index];
    // A hull that is already outside the frame and no longer wanted is not drawn.
    if (!want && !lane.shown) {
      lane.pushX = 0;
      lane.pushZ = 0;
      continue;
    }
    // The swell, not a stopwatch, drives the orbit: `cruise` scales with the sea
    // state and `surge` with the slope of the face the boat is on.
    lane.angle += dt * lane.speed * cruise * lane.surge;
    const angle = lane.angle;
    lane.pushX *= 0.92;
    lane.pushZ *= 0.92;

    const ahead = lane.base + Math.cos(angle) * lane.radiusBack;
    const laneAcross = Math.sin(angle) * lane.radiusRight;
    // Sideways distance that puts the hull just past the frame edge at this depth.
    const offStage = boatApproachOffset(ahead);
    // Every lane moves at its own pace, so three subagents added at once still
    // arrive one after another instead of as a fleet snapping into place.
    const laneEnter = BOAT_ENTER_RATE * (0.85 + (index % 4) * 0.1);
    const laneExit = BOAT_EXIT_RATE * (0.8 + (index % 3) * 0.1);

    if (want) {
      if (!lane.shown) {
        // First appearance: park the hull beyond an edge while it is still not
        // drawn, then let it sail in. Nothing ever pops into the middle.
        lane.shown = true;
        lane.away = lane.side * offStage;
        lane.lastAway = lane.away;
      }
      lane.exitSide = 0;
      lane.away += (0 - lane.away) * Math.min(1, dt * laneEnter);
    } else {
      if (lane.exitSide === 0) {
        // Leave by the nearer edge, judged from where the hull is right now.
        lane.exitSide = Math.sign(laneAcross + lane.away) || lane.side;
      }
      lane.away += (lane.exitSide * offStage - lane.away) * Math.min(1, dt * laneExit);
      if (Math.abs(lane.away) >= offStage - 1) {
        // Fully outside the frame: dropping the hull here cannot be seen.
        lane.shown = false;
        lane.exitSide = 0;
        lane.away = 0;
        lane.lastAway = 0;
        lane.pushX = 0;
        lane.pushZ = 0;
        continue;
      }
    }
    // how fast the hull is drifting sideways this frame; the course needs it
    const awaySpeed = (lane.away - lane.lastAway) / Math.max(dt, 1e-3);
    lane.lastAway = lane.away;

    const across = laneAcross + lane.away;
    // Tangent of the ellipse in the camera's flat frame: the boat has to point
    // where it is actually going, otherwise it sails sideways or stern first.
    // The sideways travel is part of the course too, so an arriving boat comes
    // bow-on instead of crabbing in.
    const vx = boatRight.x * Math.cos(angle) * lane.radiusRight
      - boatForward.x * Math.sin(angle) * lane.radiusBack
      + boatRight.x * awaySpeed;
    const vz = boatRight.z * Math.cos(angle) * lane.radiusRight
      - boatForward.z * Math.sin(angle) * lane.radiusBack
      + boatRight.z * awaySpeed;
    const placed = boatPlaced[placedCount];
    placed.x = originX + boatForward.x * ahead + boatRight.x * across + lane.pushX;
    placed.z = originZ + boatForward.z * ahead + boatRight.z * across + lane.pushZ;
    // the hull's bow is local +X, so yaw has to land +X on the tangent
    placed.heading = Math.atan2(-vz, vx);
    // travel direction, kept unit length so the next frame can probe the water
    // one boat-length ahead instead of at a random distance
    const dirLen = Math.hypot(vx, vz) || 1;
    placed.dirX = vx / dirLen;
    placed.dirZ = vz / dirLen;
    placed.fade = 1;
    // the placement slot is not the lane slot: keep the boat's own lane so the
    // separation pushes and the heading go back to the boat that owns them
    placed.lane = index;
    placedCount += 1;
  }

  // Two relaxation passes are enough for 12 hulls and keep the cost at O(n²)
  // with n = 12; pushes go back into the lane state so the fleet eases apart.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < placedCount; i += 1) {
      for (let j = i + 1; j < placedCount; j += 1) {
        const a = boatPlaced[i];
        const b = boatPlaced[j];
        let dx = a.x - b.x;
        let dz = a.z - b.z;
        let distance = Math.hypot(dx, dz);
        if (distance >= BOAT_MIN_SEP) continue;
        if (distance < 1e-3) {
          dx = Math.cos(i * 2.1);
          dz = Math.sin(i * 2.1);
          distance = 1;
        }
        const push = (BOAT_MIN_SEP - distance) / 2;
        const ux = (dx / distance) * push;
        const uz = (dz / distance) * push;
        const laneA = boatCruise[a.lane];
        const laneB = boatCruise[b.lane];
        laneA.pushX += ux;
        laneA.pushZ += uz;
        laneB.pushX -= ux;
        laneB.pushZ -= uz;
        a.x += ux;
        a.z += uz;
        b.x -= ux;
        b.z -= uz;
      }
    }
  }

  let active = 0;
  for (let index = 0; index < placedCount; index += 1) {
    const placed = boatPlaced[index];
    const surface = seaStateAt(placed.x, placed.z, time, uSea.value);
    // Read the water a boat length ahead: if it is lower, the hull is sliding
    // down a face and gets to run; if it is higher, it has to climb and slows.
    // Smoothing keeps the short chop from jittering the speed.
    const probe = seaStateAt(
      placed.x + placed.dirX * BOAT_PROBE,
      placed.z + placed.dirZ * BOAT_PROBE,
      time,
      uSea.value,
    );
    const slope = (probe.y - surface.y) / BOAT_PROBE;
    const lane = boatCruise[placed.lane];
    const wantSurge = Math.max(0.7, Math.min(1.5, 1 - 1.9 * slope));
    lane.surge += (wantSurge - lane.surge) * Math.min(1, dt * 3);
    boatNormal.set(surface.nx, surface.ny, surface.nz).normalize();
    boatTilt.setFromUnitVectors(BOAT_UP, boatNormal);
    // heading follows the lane direction, so a boat reads as sailing somewhere
    boatYaw.setFromAxisAngle(BOAT_UP, placed.heading);
    boatDummy.quaternion.copy(boatTilt).multiply(boatYaw);
    boatDummy.position.set(placed.x, surface.y - 0.08, placed.z);
    // Perspective already shrinks a boat out on the approach, and a hull is only
    // ever removed once it is past the frame edge, so the scale stays constant.
    // 3.2 (not 2.2) because the lanes moved out to 36–52 units: the same angular
    // size as before, at a berth that reads as further out to sea instead of
    // hugging the bottom edge.
    boatDummy.scale.setScalar(2.8);
    boatDummy.updateMatrix();

    boats.hull.setMatrixAt(active, boatDummy.matrix);
    boats.mast.setMatrixAt(active, boatDummy.matrix);
    boats.sail.setMatrixAt(active, boatDummy.matrix);
    boats.lantern.setMatrixAt(active, boatDummy.matrix);
    active += 1;
  }

  boatShown = active;
  for (const part of [boats.hull, boats.mast, boats.sail, boats.lantern]) {
    part.count = active;
    part.instanceMatrix.needsUpdate = true;
  }
}


// ---------------------------------------------------------------------------
// SECTION 11 · STAR DOME · real constellations, twinkling, and meteors
// ---------------------------------------------------------------------------

const STAR_RADIUS = 3200;
const STAR_GRADES = { off: 0, low: 0.4, mid: 0.7, high: 1 };
const DEG_TO_RAD = Math.PI / 180;

let starLayer = null;
// glow uniforms are module-scope so the layer can be skipped without leaving
// dangling material state behind
const uStarGlow = uniform(0);
const uMeteorGlow = uniform(0);
// how strongly the real constellations are drawn: a settings dial, not a compile flag
const uConstellation = uniform(CONSTELLATION_GRADES.mid);

function createStarLayer(scene) {
  const vertices = constellationVertices(CONSTELLATION_LINES);
  const starCount = vertices.length;
  const starRA = new Float32Array(starCount);
  const starDec = new Float32Array(starCount);
  for (let i = 0; i < starCount; i += 1) {
    starRA[i] = vertices[i].raDeg;
    starDec[i] = vertices[i].decDeg;
  }

  // One segment per polyline edge; raw points are fine here because the extra
  // vertices cost nothing next to a line width.
  const segments = [];
  for (const line of CONSTELLATION_LINES) {
    const points = line.points || line;
    for (let i = 1; i < points.length; i += 1) {
      segments.push(points[i - 1], points[i]);
    }
  }
  const segmentCount = segments.length;

  // Per-star attributes carry what the eye reads as a real sky: brightness that
  // follows the stick-figure junctions, a slow twinkle per star, and a colour
  // that drifts between warm white and blue-white.
  const starGlowAttr = new Float32Array(starCount);
  const starPhaseAttr = new Float32Array(starCount);
  const starHueAttr = new Float32Array(starCount);
  for (let i = 0; i < starCount; i += 1) {
    const degree = Number(vertices[i].degree) || 1;
    starGlowAttr[i] = Math.min(1, 0.3 + 0.85 * starBrightnessFromDegree(degree));
    starPhaseAttr[i] = Math.random() * Math.PI * 2;
    starHueAttr[i] = Math.random();
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starCount * 3), 3));
  starGeometry.setAttribute('aGlow', new THREE.BufferAttribute(starGlowAttr, 1));
  starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhaseAttr, 1));
  starGeometry.setAttribute('aHue', new THREE.BufferAttribute(starHueAttr, 1));

  const aGlow = attribute('aGlow', 'float');
  const aPhase = attribute('aPhase', 'float');
  const aHue = attribute('aHue', 'float');
  // 1.5 rad/s reads as scintillation; anything faster looks like blinking
  const twinkle = sin(uTime.mul(1.5).add(aPhase)).mul(0.3).add(0.7);
  const starMaterial = new THREE.PointsNodeMaterial({
    size: 3.6,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  starMaterial.colorNode = mix(vec3(1.0, 0.93, 0.84), vec3(0.72, 0.83, 1.0), aHue)
    .mul(aGlow).mul(twinkle).mul(uStarGlow);
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.frustumCulled = false;
  stars.renderOrder = 2;
  scene.add(stars);

  const lineGlowAttr = new Float32Array(segmentCount);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segmentCount * 3), 3));
  lineGeometry.setAttribute('aLineGlow', new THREE.BufferAttribute(lineGlowAttr, 1));
  const lineMaterial = new THREE.LineBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  // Connections must not turn the sky into a wireframe, but they are the only
  // way to read a constellation, so they carry the setting dial (`uConstellation`)
  // and still fade out near the horizon where they would fight the sea glow.
  lineMaterial.colorNode = vec3(0.44, 0.58, 0.86)
    .mul(attribute('aLineGlow', 'float')).mul(uStarGlow).mul(uConstellation).mul(0.55);
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.frustumCulled = false;
  lines.renderOrder = 2;
  scene.add(lines);

  // a single reusable streak: a meteor is a short bright segment
  const meteorGeometry = new THREE.BufferGeometry();
  meteorGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const meteorMaterial = new THREE.LineBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  meteorMaterial.colorNode = vec3(1.0, 0.95, 0.82).mul(uMeteorGlow);
  const meteor = new THREE.Line(meteorGeometry, meteorMaterial);
  meteor.frustumCulled = false;
  meteor.renderOrder = 3;
  scene.add(meteor);

  return {
    // NOTE: `meteor` is the state machine below, so the Line needs its own key
    stars, lines, meteorLine: meteor,
    starRA, starDec,
    segmentRA: Float32Array.from(segments, (p) => p[0]),
    segmentDec: Float32Array.from(segments, (p) => p[1]),
    lineGlow: lineGlowAttr,
    segmentCount,
    starCount,
    starsOpacity: 0,
    lastSky: -1e9,
    meteor: { active: false, elapsed: 0, duration: 1, next: 5, from: new THREE.Vector3(), to: new THREE.Vector3() },
  };
}

let lastAltDeg = 0;

function starDirection(raDeg, decDeg, latDeg, lstDeg, out) {
  const horiz = equatorialToHorizontal(raDeg, decDeg, latDeg, lstDeg);
  lastAltDeg = horiz.altDeg;
  if (horiz.altDeg <= 0) {
    out.set(0, -6000, 0);
    return out;
  }
  const alt = horiz.altDeg * DEG_TO_RAD;
  const az = horiz.azDeg * DEG_TO_RAD;
  const ce = Math.cos(alt);
  return out.set(ce * Math.sin(az), Math.sin(alt), -ce * Math.cos(az)).multiplyScalar(STAR_RADIUS);
}

const starDirA = new THREE.Vector3();

function updateStarDome(now, dt) {
  if (!starLayer) return;
  const layer = starLayer;
  const grade = STAR_GRADES[starsSetting] ?? 0.7;
  // stars fade with daylight and are washed out by a bright moon
  const visible = grade * Math.max(0, Math.min(1, uNightF.value * 1.15 - moonBrightness * 0.35));
  const targetOpacity = visible;
  layer.starsOpacity += (targetOpacity - layer.starsOpacity) * 0.08;
  uStarGlow.value = layer.starsOpacity * 0.9;

  // 15 deg/hour: a 5 s refresh is a 0.02 deg step, i.e. invisible
  if (now - layer.lastSky > 5000) {
    layer.lastSky = now;
    const date = new Date();
    const lst = localSiderealTime(date, sunLon);
    const lat = sunLat;
    const starPositions = layer.stars.geometry.getAttribute('position');
    for (let i = 0; i < layer.starCount; i += 1) {
      starDirection(layer.starRA[i], layer.starDec[i], lat, lst, starDirA);
      starPositions.setXYZ(i, starDirA.x, starDirA.y, starDirA.z);
    }
    starPositions.needsUpdate = true;

    const linePositions = layer.lines.geometry.getAttribute('position');
    for (let i = 0; i < layer.segmentCount; i += 1) {
      starDirection(layer.segmentRA[i], layer.segmentDec[i], lat, lst, starDirA);
      linePositions.setXYZ(i, starDirA.x, starDirA.y, starDirA.z);
      // fade the connecting lines in over the first 14 degrees of altitude,
      // so they disappear into the horizon haze instead of stopping abruptly
      layer.lineGlow[i] = Math.max(0, Math.min(1, lastAltDeg / 14));
    }
    linePositions.needsUpdate = true;
    layer.lines.geometry.getAttribute('aLineGlow').needsUpdate = true;
  }

  // meteors: random streaks that only exist at night
  const meteor = layer.meteor;
  const meteorPositions = layer.meteorLine.geometry.getAttribute('position');
  const elapsed = now / 1000;
  if (meteor.active) {
    meteor.elapsed += dt;
    const progress = Math.min(1, meteor.elapsed / meteor.duration);
    // head runs along the path, tail trails it
    const head = meteor.from.clone().lerp(meteor.to, progress);
    const tail = meteor.from.clone().lerp(meteor.to, Math.max(0, progress - 0.35));
    meteorPositions.setXYZ(0, tail.x, tail.y, tail.z);
    meteorPositions.setXYZ(1, head.x, head.y, head.z);
    meteorPositions.needsUpdate = true;
    uMeteorGlow.value = layer.starsOpacity * Math.sin(progress * Math.PI) * 1.4;
    if (progress >= 1) {
      meteor.active = false;
      meteor.next = elapsed + 4 + Math.random() * 9;
    }
  } else {
    uMeteorGlow.value = 0;
    if (elapsed > meteor.next && layer.starsOpacity > 0.25 && meteorEnabled) {
      const startAz = Math.random() * Math.PI * 2;
      const startAlt = (25 + Math.random() * 40) * DEG_TO_RAD;
      const travel = (10 + Math.random() * 16) * DEG_TO_RAD;
      const dirAz = startAz + Math.PI * (0.5 + Math.random() * 0.5);
      meteor.from.set(
        Math.cos(startAlt) * Math.sin(startAz), Math.sin(startAlt), -Math.cos(startAlt) * Math.cos(startAz),
      ).multiplyScalar(STAR_RADIUS);
      const endAlt = Math.max(4 * DEG_TO_RAD, startAlt - travel * 0.55);
      meteor.to.set(
        Math.cos(endAlt) * Math.sin(dirAz), Math.sin(endAlt), -Math.cos(endAlt) * Math.cos(dirAz),
      ).multiplyScalar(STAR_RADIUS);
      meteor.active = true;
      meteor.elapsed = 0;
      meteor.duration = 0.55 + Math.random() * 0.6;
    }
  }
}

boot();
