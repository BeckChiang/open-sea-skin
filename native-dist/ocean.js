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
  sin, cos, tan, atan, acos, dot, cross, normalize, mix, pow, max, clamp, fract, floor,
  abs, min, attribute, smoothstep, length, reflect, passTexture,
  positionLocal, positionWorld, cameraPosition
} from './vendor/three.tsl.js';
import { OrbitControls } from './vendor/addons/controls/OrbitControls.js';
import { skyFromElevation, manualElevationDeg, manualAzimuthDeg } from './sky.js';
import { CONSTELLATION_LINES } from './stars-data.js';
import { STAR_CATALOG } from './stars-catalog.js';
import {
  constellationVertices, equatorialToHorizontal, localSiderealTime,
  starBrightnessFromDegree
} from './sky-astro.js';
import { sunTimes, twilightTimes,
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
// 1.5.33: manual light is a *clock*, not a brightness ramp. Minutes after local
// midnight pick a real instant, and the sun, the moon and the star field are all
// solved for that instant — which is the only way the arc looks like a real day
// and the moon actually travels across the sky.
let manualMinutes = null;

function skyInstant(nowMs) {
  if (manualMinutes === null) return new Date(nowMs);
  const midnight = new Date(nowMs);
  midnight.setHours(0, 0, 0, 0);
  return new Date(midnight.getTime() + manualMinutes * 60000);
}
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
let crossSetting = 'mid';
// effective percentages for the two constellation dials (100 = old 'mid')
let constellationDial = 100;
let crossDial = 100;
// 1.5.23 meteor dials: how often, and how hot
let meteorRate = 1;
let meteorBright = 1;
let meteorEnabled = true;
let cloudsSetting = 'mid';
// reported back through window.__ossState()
let sunElevationDeg = 0;
// altitude of the galactic centre: the one number that decides whether the band
// is the bright core or the faint outer arm
let galacticCentreAlt = -90;
let sunAzimuthDeg = 0;
// true while the sun is climbing: picks the morning paint for the twilight band
let sunRising = true;
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
// 1.5.23: percentages, where 100 is the old 'mid' look and the dial may climb
// past it. A letter from an older profile still maps through these tables.
const STAR_GRADES = Object.freeze({ off: 0, low: 60, mid: 100, high: 150 });
const CONSTELLATION_GRADES = Object.freeze({ off: 0, low: 50, mid: 100, high: 170 });
// the cross on every constellation vertex: how bright and how long the arms are
const CROSS_GRADES = Object.freeze({ off: 0, low: 55, mid: 100, high: 175 });

// panel value -> percentage. Numbers pass through; letters look up the table.
function dialOf(value, fallback, table) {
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, Math.min(200, n));
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(table, value)) return table[value];
  return fallback;
}

const GLASS_MAX_RECTS = 3;

// Night tints the panel offers: measured dark, a colder blue, a warmer city glow.
const SKY_TONES = Object.freeze({
  real: new THREE.Vector3(1, 1, 1),
  blue: new THREE.Vector3(0.80, 1.02, 1.35),
  warm: new THREE.Vector3(1.22, 0.98, 0.82),
});

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
// 1.5.23 sky dials: twilight axes (see sky.js), airglow, and the moon's lift of
// the whole night sky.
const uTwilightWarm = uniform(0);
const uTwilightColor = uniform(new THREE.Vector3(1.0, 0.40, 0.15));
const uTwilightBand = uniform(6);
const uBeltOfVenus = uniform(0);
const uEarthShadow = uniform(0);
const uAirglow = uniform(1);
// cloud motion and presence, both continuous dials (1 = the 1.2.7 look)
const uCloudSpeed = uniform(1);
const uCloudOpacity = uniform(1);

// Star art dials (1.5.23): every one is continuous, so the panel never snaps.
const uStarSize = uniform(12);
const uStarBase = uniform(0.82);
const uStarHaze = uniform(1);
const uHaloStrength = uniform(0.28);
const uLineWidth = uniform(1);
const uLineFadeDeg = uniform(14);
const uTwinkleSpeed = uniform(1);
const uTwinkleAmp = uniform(0.3);
// Real magnitudes (1.5.25): the size floor, how fast size falls off with
// magnitude, the colour saturation, and the magnitude below which a star gets
// diffraction spikes instead of a plain point.
const uStarMin = uniform(4.2);
const uStarFalloff = uniform(0.16);
const uStarColor = uniform(1.5);
// billboard basis for the star quads: world units per screen pixel at the star
// shell, plus the camera's own right/up axes (refreshed every frame)
const uStarPxWorld = uniform(1.0);
const uStarRight = uniform(new THREE.Vector3(1, 0, 0));
const uStarUp = uniform(new THREE.Vector3(0, 1, 0));
const uStarSpikes = uniform(2.2);
const uStarFade = uniform(1);
const uStarDaylight = uniform(0);
const uStarBias = uniform(0);
const uStarMode = uniform(0);
const uStarCut = uniform(5.5);
const uLineTwinkle = uniform(0.8);
// How fast the figures breathe. 0.55 rad/s was the fixed rate; exposing it lets
// a calm sky slow down and a lively one speed up without touching the strength.
const uLineSpeed = uniform(0.55);
const uMilkyVisible = uniform(0);
const uOverflow = uniform(0);
// The dial is a budget verdict, and a verdict can flip in one tick: a session
// crosses the ceiling, or a cost window resets. Routing the value straight into
// the surface made the white caps pop in and out, so the shader reads a smoothed
// copy and every writer below only moves the target.
let overflowTarget = 0;
// Milky Way band: normal of the galactic plane in world space, plus its dial.
const uGalNormal = uniform(new THREE.Vector3(0, 1, 0));
const uMilky = uniform(0.35);
// Night tint: (1,1,1) keeps the measured palette; the panel's presets scale it.
const uSkyTone = uniform(new THREE.Vector3(1, 1, 1));
// The star dome folds the sky toward the view axis; the procedural haze reads
// these two to unfold itself back onto the same directions.
const uSkyAxisDir = uniform(new THREE.Vector3(0, 0, -1));
const uSkyFold = uniform(1);

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
// 0 gaussian, 1 box, 2 double, 3 radial, 4 frost, 5 tile: one dial, six looks
const uGlassStyle = uniform(0);
// 1.5.26: the soft glow that replaced the mip-chain bloom
const uGlowThreshold = uniform(0.62);
const uGlowStrength = uniform(0.28);

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
  // 1.5.26 perf: sin-based hashing was ~120 sin() per ocean pixel; a polynomial
  // hash costs two fract/mul pairs and still gives an even gradient field. The
  // fold keeps the argument small so far-field pixels do not band on iGPUs.
  const q = p.sub(floor(p.div(289)).mul(289));
  const a = fract(q.dot(vec2(0.1031, 0.1030)).mul(43758.5453));
  const b = fract(q.dot(vec2(0.2695, 0.1833)).mul(24634.6345));
  return vec2(a.mul(2).sub(1), b.mul(2).sub(1));
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
  // 1.5.26 perf: two octaves, not three. The third one moved no cloud boundary
  // that survives the 0.58 opacity mix, and it was a third of the dome shader.
  const o1 = gradNoise(p);
  const o2 = gradNoise(p.mul(2.04).add(vec2(17.3, 9.1))).mul(0.5);
  return o1.add(o2);
});

const detailHeight = Fn(([xz, time]) => {
  const driftA = vec2(time.mul(0.55), time.mul(0.32));
  const driftB = vec2(time.mul(-0.4), time.mul(0.5));
  // 1.5.26 perf: two octaves instead of two full FBM fields. The ocean evaluates
  // this three times for the finite-difference normal, so six gradient-noise
  // samples per octave pair turned into a third of the frame on an iGPU.
  return gradNoise(xz.mul(0.85).add(driftA)).add(gradNoise(xz.mul(2.1).add(driftB)).mul(0.45));
});

// ----------------------------------------------------------------------------
// SECTION 4 · SHARED ANALYTIC SKY
// cloudMask gates the cloud FBM: the dome always passes 1, the ocean only
// pays for cloud noise where the reflection is actually visible.
// astro (1 on the dome, 0 in the water reflection) keeps the hash star field
// off the ocean both for looks and for fill rate.
// ----------------------------------------------------------------------------

// scalar hash for the star cells (same sine-fold trick as hash2 above)
const hash31 = Fn(([p]) => fract(dot(p, vec3(0.1031, 0.1030, 0.0973)).mul(43758.5453)));

const STAR_SCALE = 190;        // cells per radian: ~0.3° per cell
const STAR_SIZE = 0.19;        // cell-space radius of one star
const MOON_DISC_RADIUS = 0.018; // radians, ~1.0° (a little larger than the real 0.26°)
const MOON_DISC_IN = 0.99976;
const MOON_DISC_OUT = 0.99984;

const skyReflect = Fn(([dir]) => {
  const up = max(dir.y, 0);
  const base = mix(uHorizonColor, uZenithColor, pow(up, 0.42));
  const glint = pow(max(dot(dir, uSunDir), 0), 18).mul(0.16);
  return base.add(uSunColor.mul(glint));
});

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
  // 1.5.23: its strength and its height now come from sky.js, so it rises
  // smoothly out of the day and sinks into the night instead of popping on.
  const lowSun = float(1).sub(smoothstep(0.05, 0.36, uSunDir.y));
  const flatSun = normalize(vec3(uSunDir.x, 0, uSunDir.z).add(vec3(1e-4, 0, 1e-4)));
  const flatDir = normalize(vec3(d.x, 0, d.z).add(vec3(1e-4, 0, 1e-4)));
  const towardSun = max(dot(flatDir, flatSun), 0);
  const awayFromSun = max(dot(flatDir, flatSun.mul(-1)), 0);
  const bandTop = float(0.05).add(uTwilightBand.mul(0.022));
  const bandLow = smoothstep(bandTop, 0.0, d.y);
  const warmBand = pow(towardSun, 5).mul(bandLow).mul(uTwilightWarm).mul(lowSun.mul(0.35).add(0.65));
  col.addAssign(uTwilightColor.mul(warmBand).mul(0.9));

  // Belt of Venus: the pink band opposite the sun, above the earth shadow.
  // Cold pink, and it must not reach the water line.
  const beltBand = smoothstep(0.30, 0.02, d.y).mul(smoothstep(-0.02, 0.09, d.y));
  col.addAssign(vec3(0.62, 0.30, 0.42).mul(pow(awayFromSun, 3)).mul(beltBand).mul(uBeltOfVenus).mul(0.6));

  // Earth shadow: the blue-grey wedge that rises from the horizon opposite the
  // sunset as the sun sinks; it is what makes dusk darker than dawn's glow.
  const shadowBand = smoothstep(0.16, 0.0, d.y).mul(smoothstep(-0.05, 0.03, d.y));
  col.assign(mix(col, col.mul(vec3(0.55, 0.62, 0.90)), shadowBand.mul(uEarthShadow).mul(0.75)));

  // moon: phase-shaped disc + halo, gated by uMoonVisible (brightness, 0..1)
  If(uMoonVisible.greaterThan(0.002), () => {
    const md = dot(d, uMoonDir);
    const disc = smoothstep(MOON_DISC_IN, MOON_DISC_OUT, md);
    const halo = pow(max(md, 0), 260).mul(0.06)
      .add(smoothstep(0.999, 0.99976, md).mul(0.08));
    // local axis across the disc; computed on the CPU so a moon near the
    // zenith cannot produce a degenerate normalize()
    const mx = dot(d.sub(uMoonDir.mul(md)), uMoonRight).div(MOON_DISC_RADIUS).toVar();
    // phase01 is 0 at new and 0.5 at full, so cos(2*pi*phase) is +1 at new.
    // The lit limb is therefore where mx is greater than that cosine: at new the
    // terminator sits outside the disc (nothing lit), at full it sits behind it
    // (all lit). Adding instead of subtracting turned every new moon into a
    // second sun next to the real one.
    const lit = smoothstep(-0.22, 0.22, mx.sub(uMoonPhaseCos));
    const moonColor = mix(vec3(0.10, 0.12, 0.16), vec3(1, 0.97, 0.9), lit);
    const moonGlow = pow(uMoonVisible, 0.5);
    col.addAssign(moonColor.mul(disc).mul(moonGlow).mul(2.9));
    col.addAssign(vec3(0.55, 0.62, 0.78).mul(halo).mul(moonGlow));
  });

  // stars: one hash point per direction cell, faded near the horizon.
  // 1.5.23: the dome folds sky directions toward the view axis, so the haze
  // unfolds the direction back before hashing — otherwise it would slide against
  // the constellations as the fold changes.
  If(uStars.mul(astro).greaterThan(0.001), () => {
    const axisDir = normalize(uSkyAxisDir);
    const cosT = clamp(dot(d, axisDir), -1, 1);
    const theta = acos(cosT);
    const thetaOrig = atan(tan(theta.mul(0.5)).mul(uSkyFold).clamp(-1e4, 1e4)).mul(2);
    const shift = theta.sub(thetaOrig);
    const spin = normalize(cross(axisDir, d));
    const unfolded = normalize(d.mul(cos(shift)).add(cross(spin, d).mul(sin(shift))));
    const p = unfolded.mul(STAR_SCALE);
    const cell = floor(p);
    const local = fract(p).sub(0.5);
    const hx = hash31(cell);
    const hy = hash31(cell.add(vec3(19.3, 7.7, 41.1)));
    const hg = hash31(cell.add(vec3(53.1, 29.9, 11.7)));
    const hs = hash31(cell.add(vec3(71.9, 3.3, 88.1)));
    const hb = hash31(cell.add(vec3(5.7, 61.3, 23.9)));
    // a second, coarser layer fills the gaps the grid leaves behind
    const p2 = unfolded.mul(STAR_SCALE * 0.61).add(vec3(0.37, 0.11, 0.73));
    const cell2 = floor(p2);
    const local2 = fract(p2).sub(0.5);
    const jx = hash31(cell2.add(vec3(11.1, 43.7, 5.9)));
    const jy = hash31(cell2.add(vec3(93.4, 7.7, 61.1)));
    const jg = hash31(cell2.add(vec3(29.2, 83.6, 17.4)));
    // TSL nodes do not overload JS arithmetic: every mix has to stay on the
    // node graph, or the constant folds to NaN and the shader fails to compile.
    const sizeJitter = hs.mul(0.86).add(0.42);
    const starOf = (loc, cx, cy) => {
      const radius = sizeJitter.mul(STAR_SIZE);
      const dist = length(loc.xy.sub(vec2(cx, cy).sub(0.5).mul(0.72)));
      return float(1).sub(smoothstep(0, radius, dist));
    };
    const core = starOf(local, hx, hy)
      .add(starOf(local2, jx, jy).mul(0.62));
    // stars pile up along the galactic plane: a plain uniform field reads as noise
    const bandNear = pow(float(1).sub(abs(dot(d, normalize(uGalNormal)))), 5);
    const bandDensity = bandNear.mul(1.4).add(1);
    const gate = smoothstep(0.965, 0.999, hg).mul(hb.mul(0.9).add(0.55)).mul(bandDensity);
    const twinkle = sin(uTime.mul(uTwinkleSpeed).mul(hg.mul(2.4).add(1.3)).add(hx.mul(29.7))).mul(0.22).add(0.78);
    const altitude = smoothstep(0.02, 0.32, d.y);
    col.addAssign(vec3(0.86, 0.92, 1).mul(core).mul(gate).mul(twinkle).mul(altitude).mul(uStars).mul(2.2).mul(uStarHaze));
  });

  // Milky Way: a soft band along the galactic plane, only at night.
  // it is the one night-sky term that is not a point light.
  const milkyOn = uMilky.mul(uMilkyVisible).mul(uNightF).mul(astro);
  If(milkyOn.greaterThan(0.001), () => {
    const gal = abs(dot(d, normalize(uGalNormal)));
    const near = float(1).sub(clamp(gal, 0, 1));
    // a wide disc and a much tighter core, minus the dust lane that splits the
    // band in two: that lane is what makes it read as the Milky Way and not as a
    // blurry gradient.
    const wide = pow(near, 2.6);
    const core = pow(near, 10).mul(1.0);
    const lane = smoothstep(float(0.19), float(0.03), gal).mul(pow(near, 2.4)).mul(0.55);
    const band = wide.add(core).sub(lane);
    col.addAssign(vec3(0.072, 0.067, 0.090).mul(band).mul(milkyOn));
  });

  // Airglow: a very faint green-blue wash that never leaves a dark sky, and the
  // moon's lift of the whole dome (scattered moonlight), both night-gated.
  col.addAssign(vec3(0.0034, 0.0048, 0.0074).mul(uAirglow).mul(smoothstep(0.55, 0, d.y)));
  col.addAssign(vec3(0.012, 0.014, 0.019).mul(uMoonVisible).mul(uNightF).mul(uAirglow));

  // clouds only inside the low band: skips one FBM for most sky pixels
  const band = smoothstep(0.02, 0.09, d.y).mul(smoothstep(0.92, 0.30, d.y));
  If(band.mul(cloudMask).greaterThan(0.001), () => {
    const proj = d.xz.div(d.y.add(0.18)).mul(0.55);
    // 1.5.23: they drift now, and the dial can stop them dead (0 = frozen) or
    // send them at a walking pace
    // 0.006/s moved the deck by a fraction of a noise cell per minute, which
    // read as a still image. 0.055/s is a slow but visible drift.
    const drift = vec2(uTime.mul(0.055), uTime.mul(0.022)).mul(uCloudSpeed);
    const cloudNoise = clamp(fbm(proj.add(drift)).mul(0.5).add(0.5), 0, 1);
    // uCloudCover 0.55 reproduces the 1.2.7 threshold (0.62 -> 0.95) and opacity
    const low = float(0.62).add(float(CLOUD_COVER_BASELINE).sub(uCloudCover).mul(0.55));
    const density = clamp(uCloudCover.div(CLOUD_COVER_BASELINE), 0, 1);
    const cover = band.mul(smoothstep(low, low.add(0.33), cloudNoise));
    // 1.2.7 used a fixed bright cloud tint and looked like daylight at night.
    // Daytime clouds now take the horizon hue (blue) instead of near-white, so a
    // cloudy noon no longer greys the whole sky out; at dusk uSunColor warms them.
    // Cloud keeps a mostly neutral body so it reads as cloud at any hour: the
  // horizon colour only tints it (warm at dusk, blue-grey at noon).
  const cloudTint = mix(uHorizonColor, vec3(0.86, 0.90, 0.96), float(0.42)).toVar();
  const cloudColor = cloudTint.mul(uSkyLight.mul(1.5)).add(vec3(0.075)).toVar();
    col.assign(mix(col, cloudColor, cover.mul(0.74).mul(density).mul(uCloudOpacity)));
  });

  // Night tint last, so it scales everything the dome drew above the horizon.
  col.mulAssign(mix(vec3(1), uSkyTone, uNightF));

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
    const sparkleNoise = clamp(gradNoise(xz.mul(0.3).add(vec2(time.mul(-0.07), time.mul(0.05)))).mul(0.5).add(0.5), 0, 1);
    spec.assign(uSunColor.mul(pow(ndh, 500).mul(mix(0.4, 3.4, sparkleNoise)).add(pow(ndh, 48).mul(0.12))));

    // crest foam
    const foamNoise = clamp(gradNoise(xz.mul(1.1).add(vec2(time.mul(0.22), time.mul(0.14)))).mul(0.5).add(0.5), 0, 1);
    // Past the wave ceiling the sea cannot rise any further, so it gets angrier
  // instead: thicker caps plus a spray of glints. Both are pure shader work.
    // 1.5.34: crest was compared against an absolute height of 1..2, which the
    // surface only reaches in the worst storm — so caps almost never appeared and
    // the overflow dial had nothing to thicken. Compare against the current sea
    // state instead, and let the overflow add crowns and blown spray on top.
    const crestRatio = clamp(crest.div(max(sea.mul(1.55), 0.25)), 0, 1.4);
    const capBand = smoothstep(0.72, 1.02, crestRatio);
    const foamBase = smoothstep(0.45, 0.9, foamNoise).mul(capBand);
    const angry = float(1).add(uOverflow.mul(1.4));
    const spray = pow(foamNoise, 5).mul(smoothstep(0.15, 0.7, uOverflow)).mul(0.95);
    const crowns = smoothstep(0.7, 1.02, crestRatio).mul(smoothstep(0.15, 0.85, uOverflow)).mul(0.6);
    foam.assign(foamBase.mul(angry).add(spray).add(crowns));
  });

  // base water color + backlit crest glow
  const col = mix(uDeepColor, uShallowColor, clamp(crest.mul(0.35).add(0.45), 0, 1)).toVar();
  const sss = pow(max(dot(V, uSunDir), 0), 3).mul(max(crest, 0)).mul(0.18);
  col.addAssign(uShallowColor.mul(uSunColor).mul(sss));

  // sky reflection. 1.5.26 perf: no cloud noise here. The mask was only a hint
  // that the reflection "matters", but a scaled FBM is evaluated for the whole
  // water surface either way — a full third of the ocean pixel cost for clouds
  // the wave normals smear out anyway. The dome still draws them.
  const R = reflect(V.negate(), N).toVar();
  R.y.assign(max(R.y, 0.04));
  const fresnel = float(0.02).add(float(0.98).mul(pow(float(1).sub(max(dot(N, V), 0)), 5)));
  col.assign(mix(col, skyReflect(R.normalize()), fresnel));

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

  // 1.5.23 twilight axes: the warm band, the twilight glow, the belt of Venus,
  // the earth shadow, and the airglow all come from the same elevation curve.
  // Every value is scrubbed: a stray undefined here silently kills the whole
  // sky material (three builds a uniform of type null and throws every frame),
  // which shows up as a grey canvas rather than as a visible error.
  const tw = sky.twilight || {};
  uTwilightWarm.value = finiteOr(tw.warm, 0);
  uTwilightBand.value = finiteOr(tw.bandHeight, 6);
  uBeltOfVenus.value = finiteOr(tw.belt, 0);
  uEarthShadow.value = finiteOr(tw.shadow, 0);
  uAirglow.value = finiteOr(sky.airglow, 0);
  // morning is a cool rose, evening a deep ember: the same band, different paint
  uTwilightColor.value.set(...(sunRising ? [1.0, 0.55, 0.45] : [1.0, 0.40, 0.15]));

  sunElevationDeg = elevationDeg;
  sunAzimuthDeg = azimuthDeg;
  sunViewElevationDeg = viewElDeg === undefined ? elevationDeg : viewElDeg;
  sunViewAzimuthDeg = viewAzDeg === undefined ? azimuthDeg : viewAzDeg;
}

// Manual slider / legacy 720 s cycle: t 0..1 spans deep night (0) through
// sunset (~0.28) to afternoon (1). 1.2.7 mapped 0..1 onto DUSK..daylight only.
function applyTimeOfDay(t) {
  currentDaylight = Math.min(100, Math.max(0, t * 100));
  sunRising = manualElevationDeg(t + 0.002) > manualElevationDeg(t);
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

  // terminator: phase01 runs 0 (new) -> 0.5 (full), so cos(2*pi*phase) is +1 at
  // new and -1 at full. Mirroring the sign flips which limb is lit, so the lit
  // side always faces the sun.
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
let twilightMinutes = null;

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
  twilightMinutes = twilightTimes(at, sunLat, sunLon);
}

function refreshSky(now) {
  const when = skyInstant(now);
  refreshSunTimes(when.getTime());
  {
    // real and manual share one solver: manual only changes which instant is fed in
    const sun = sunPosition(when, sunLat, sunLon);
    // ten minutes ahead decides whether the band is warming up or cooling down,
    // which is what picks the morning rose over the evening ember
    sunRising = sunPosition(new Date(when.getTime() + 600000), sunLat, sunLon).elevationDeg > sun.elevationDeg;
    // palette from the true elevation, disc aimed into the visible band
    applyElevation(
      sun.elevationDeg,
      sun.azimuthDeg,
      viewElevation(sun.elevationDeg),
      viewAzimuth(sun.azimuthDeg),
    );
  }
  syncMoon(when.getTime());
  syncStars();
}

function applySunMessage(d) {
  if (d.mode === 'real' || d.mode === 'manual') sunMode = d.mode;
  const lat = Number(d.lat);
  const lon = Number(d.lon);
  if (Number.isFinite(lat) && lat >= -90 && lat <= 90) sunLat = lat;
  if (Number.isFinite(lon) && lon >= -180 && lon <= 180) sunLon = lon;
  if (typeof d.moon === 'boolean') moonEnabled = d.moon;
  // 1.5.23: percentages. A letter from an older profile is mapped by its table.
  if (d.stars !== undefined) starsSetting = dialOf(d.stars, 100, STAR_GRADES);
  if (d.constellation !== undefined) {
    constellationSetting = d.constellation;
    constellationDial = dialOf(d.constellation, 100, CONSTELLATION_GRADES);
    uConstellation.value = constellationDial / 100;
  }
  if (d.cross !== undefined) {
    crossSetting = d.cross;
    crossDial = dialOf(d.cross, 100, CROSS_GRADES);
    uCrossGlow.value = crossDial / 100;
  }
  if (typeof d.meteor === 'boolean') meteorEnabled = d.meteor;
  if (d.clouds !== undefined) cloudsSetting = d.clouds;
  uCloudCover.value = cloudCoverOf(cloudsSetting);
  cloudCover = uCloudCover.value;
  if (Number.isFinite(Number(d.cloudSpeed))) uCloudSpeed.value = Math.max(0, Math.min(4, Number(d.cloudSpeed)));
  if (Number.isFinite(Number(d.cloudOpacity))) uCloudOpacity.value = Math.max(0, Math.min(1.5, Number(d.cloudOpacity)));
  // star art, all continuous
  if (Number.isFinite(Number(d.starSize))) uStarSize.value = Math.max(1, Math.min(14, Number(d.starSize)));
  if (Number.isFinite(Number(d.starBase))) uStarBase.value = Math.max(0, Math.min(2, Number(d.starBase)));
  if (Number.isFinite(Number(d.starHalo))) uHaloStrength.value = Math.max(0, Math.min(2, Number(d.starHalo)));
  if (Number.isFinite(Number(d.lineWidth))) uLineWidth.value = Math.max(0.2, Math.min(4, Number(d.lineWidth)));
  if (Number.isFinite(Number(d.lineFadeDeg))) uLineFadeDeg.value = Math.max(3, Math.min(45, Number(d.lineFadeDeg)));
  if (Number.isFinite(Number(d.starCount))) uStarHaze.value = Math.max(0, Math.min(2, Number(d.starCount)));
  if (Number.isFinite(Number(d.twinkleSpeed))) uTwinkleSpeed.value = Math.max(0.1, Math.min(4, Number(d.twinkleSpeed)));
  if (Number.isFinite(Number(d.twinkleAmp))) uTwinkleAmp.value = Math.max(0, Math.min(0.9, Number(d.twinkleAmp)));
  if (Number.isFinite(Number(d.milky))) uMilky.value = Math.max(0, Math.min(2, Number(d.milky)));
  // 1.5.25 real magnitudes: the floor, the falloff, the colour and the spike gate
  if (Number.isFinite(Number(d.starMin))) uStarMin.value = Math.max(0.5, Math.min(4, Number(d.starMin)));
  if (Number.isFinite(Number(d.starFalloff))) uStarFalloff.value = Math.max(0.04, Math.min(0.5, Number(d.starFalloff)));
  if (Number.isFinite(Number(d.starColor))) uStarColor.value = Math.max(0, Math.min(2.2, Number(d.starColor)));
  if (Number.isFinite(Number(d.starSpikes))) uStarSpikes.value = Math.max(0, Math.min(6, Number(d.starSpikes)));
  // The panel has always sent `starsDaylight`; this side read `starDaylight`,
  // so the switch only ever worked in the standalone demo.
  if (d.starDaylight !== undefined || d.starsDaylight !== undefined) {
    uStarDaylight.value = (d.starDaylight !== undefined ? d.starDaylight : d.starsDaylight) ? 1 : 0;
  }
  if (Number.isFinite(Number(d.lineTwinkle))) uLineTwinkle.value = Math.max(0, Math.min(1.5, Number(d.lineTwinkle)));
  if (Number.isFinite(Number(d.lineSpeed))) uLineSpeed.value = Math.max(0.1, Math.min(3, Number(d.lineSpeed)));
  if (Number.isFinite(Number(d.overflow))) overflowTarget = Math.max(0, Math.min(1, Number(d.overflow)));
  let repaint = false;
  if (Number.isFinite(Number(d.starBias))) { uStarBias.value = Math.max(-0.3, Math.min(0.3, Number(d.starBias))); repaint = true; }
  if (d.starMode !== undefined) { uStarMode.value = Math.max(0, Math.min(2, Number(d.starMode) || 0)); repaint = true; }
  if (Number.isFinite(Number(d.starCut))) { uStarCut.value = Math.max(1.5, Math.min(6, Number(d.starCut))); repaint = true; }
  if (repaint && starLayer) refreshStarArt(starLayer);
  if (typeof d.skyTone === 'string' && SKY_TONES[d.skyTone]) uSkyTone.value.copy(SKY_TONES[d.skyTone]);
  applyStarDials();
  const skyDist = Number(d.skyDist);
  if (Number.isFinite(skyDist)) skyZoom = Math.max(0.6, Math.min(3, skyDist));
  const dome = Number(d.domeAmount);
  if (Number.isFinite(dome)) skyDome = Math.max(0, Math.min(1, dome));
  if (Number.isFinite(Number(d.meteorRate))) meteorRate = Math.max(0.1, Math.min(6, Number(d.meteorRate)));
  if (Number.isFinite(Number(d.meteorBright))) meteorBright = Math.max(0.2, Math.min(3, Number(d.meteorBright)));
  // 1.5.26 perf knobs. The frame is fill bound (halving the pixel count halves
  // the cost), so the useful dials are the resolution budget and the glow cost.
  if (Number.isFinite(Number(d.glow))) {
    uGlowStrength.value = Math.max(0, Math.min(100, Number(d.glow))) / 100 * 0.5;
    if (glowNodeRef) glowNodeRef.active = uGlowStrength.value > 0.01;
  }
  if (typeof d.quality === 'string') applyQuality(d.quality);
  // 1.5.27: frame rate is a budget dial of its own, on top of the resolution one
  if (Number.isFinite(Number(d.fps))) applyFpsCap(Number(d.fps));
  // 2.0.7 performance switches (panel: "性能" group + advanced rows)
  if (d.perfScheduler !== undefined) perfScheduler = d.perfScheduler !== false;
  if (d.webgl2Adaptive !== undefined) webgl2Adaptive = d.webgl2Adaptive !== false;
  if (d.resizeDebounce !== undefined) resizeDebounce = d.resizeDebounce !== false;
  if (typeof d.pauseWhenObscured === 'string' && PAUSE_MODES.includes(d.pauseWhenObscured)) {
    const modeChanged = pauseMode !== d.pauseWhenObscured;
    pauseMode = d.pauseWhenObscured;
    // the switch may flip while the window is already in the background, so the
    // loop state has to be re-evaluated now, not on the next occlude event
    if (modeChanged && loopStarted && renderer) applyObscuredLoop();
  }
  const t = Number(d.t);
  if (sunMode === 'manual') {
    manualTimeOfDay = d.auto !== true;
    if (Number.isFinite(t)) {
      const before = manualMinutes;
      manualMinutes = ((t % 1440) + 1440) % 1440;
      // the dome holds a 20 s refresh and a cached list: a scrub has to rebuild
      if (before !== manualMinutes && starLayer) starLayer.lastSky = -1e9;
    }
  } else {
    manualMinutes = null;
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

// ----------------------------------------------------------------------------
// 1.5.26 · SOFT GLOW (replaces the mip-chain bloom)
// The TSL bloom built a five-level mip chain and ran ~10 blur passes over the
// whole frame; measured here it was 42 ms of a 126 ms frame — a third of the
// budget for an effect whose output is low frequency. One thresholded 9-tap
// blur at a quarter of the resolution reads the same at this scale: the halo
// around the sun and the brightest stars survives, the soft wash behind it too.
// ----------------------------------------------------------------------------

const GLOW_DOWNSCALE = 4;
const GLOW_SPREAD = 7; // taps to shift per blur pass, in quarter-res pixels
const glowQuad = new THREE.QuadMesh();
const glowDrawSize = new THREE.Vector2();
let glowSavedState;

class SoftGlowNode extends THREE.TempNode {
  constructor(inputNode) {
    super('vec4');
    this.inputNode = inputNode;
    this.invSize = uniform(new THREE.Vector2(1, 1));
    this.direction = uniform(new THREE.Vector2(1, 0));
    this.colorTexture = texture(null);
    this.targetH = new THREE.RenderTarget(1, 1, { depthBuffer: false, type: THREE.HalfFloatType });
    this.targetV = new THREE.RenderTarget(1, 1, { depthBuffer: false, type: THREE.HalfFloatType });
    this.targetH.texture.name = 'OpenSea.glowH';
    this.targetV.texture.name = 'OpenSea.glowV';
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

  setSize(width, height) {
    const w = Math.max(1, Math.round(width / GLOW_DOWNSCALE));
    const h = Math.max(1, Math.round(height / GLOW_DOWNSCALE));
    if (w === this._width && h === this._height) return;
    this._width = w;
    this._height = h;
    this.targetH.setSize(w, h);
    this.targetV.setSize(w, h);
    this.invSize.value.set(1 / w, 1 / h);
  }

  // mirrored gaussian along this.direction; the first pass keeps only what is
  // bright enough to glow, so the sea does not turn into a grey haze
  _blurNode(sampleAt, brightPass) {
    const step = this.invSize.mul(this.direction).mul(float(GLOW_SPREAD));
    return Fn(() => {
      const coord = uv();
      const fetch = (at) => {
        const rgba = sampleAt(at).rgb;
        return brightPass ? max(rgba.sub(uGlowThreshold), vec3(0)) : rgba;
      };
      const sum = fetch(coord).mul(float(GLASS_WEIGHTS[0])).toVar();
      for (let i = 1; i < GLASS_KERNEL; i++) {
        const offset = step.mul(float(i));
        sum.addAssign(fetch(coord.add(offset)).add(fetch(coord.sub(offset))).mul(float(GLASS_WEIGHTS[i])));
      }
      return vec4(sum, 1);
    });
  }

  setup(builder) {
    const context = builder.getSharedContext();
    if (!this._materialH) {
      this._materialH = new THREE.NodeMaterial();
      this._materialH.name = 'OpenSea.glowH';
      this._materialH.fragmentNode = this._blurNode((coord) => this.inputNode.sample(coord), true)().context(context);
      this._materialH.needsUpdate = true;
    }
    if (!this._materialV) {
      this._materialV = new THREE.NodeMaterial();
      this._materialV.name = 'OpenSea.glowV';
      this._materialV.fragmentNode = this._blurNode((coord) => this.colorTexture.sample(coord), false)().context(context);
      this._materialV.needsUpdate = true;
    }
    return this._textureOutput;
  }

  updateBefore(frame) {
    if (!this.active || !this._materialH || !this._materialV) return;
    if (!this.inputNode || !this.inputNode.value) return;
    const { renderer } = frame;
    glowSavedState = THREE.RendererUtils.resetRendererState(renderer, glowSavedState);
    renderer.getDrawingBufferSize(glowDrawSize);
    this.setSize(glowDrawSize.width, glowDrawSize.height);

    this.direction.value.set(1, 0);
    glowQuad.material = this._materialH;
    renderer.setRenderTarget(this.targetH);
    glowQuad.render(renderer);

    this.colorTexture.value = this.targetH.texture;
    this.direction.value.set(0, 1);
    glowQuad.material = this._materialV;
    renderer.setRenderTarget(this.targetV);
    glowQuad.render(renderer);

    THREE.RendererUtils.restoreRendererState(renderer, glowSavedState);
  }
}

function buildComposite(sceneColor, sceneGlow, glassNode) {
  if (!glassNode) return sceneColor.add(sceneGlow);
  const blurred = glassNode.getTextureNode();
  const composite = Fn(() => {
    const rgb = sceneColor.add(sceneGlow).rgb.toVar();
    const weight = glassWeight().toVar();
    If(weight.greaterThan(0.001), () => {
      const coord = uv().toVar();
      const style = uGlassStyle;
      // Each branch writes through assign(); a JS-level reassignment would be
      // folded at build time and apply every branch at once.
      const frosted = blurred.sample(coord).rgb.toVar();
      // frost: jitter the lookup so the pane reads as ground glass, not a lens
      If(style.greaterThan(3.5), () => {
        If(style.lessThan(4.5), () => {
          const grain = fract(sin(dot(coord.mul(913.0), vec2(12.9898, 78.233))).mul(43758.5453));
          const jitter = vec2(grain.sub(0.5), fract(grain.mul(13.7)).sub(0.5)).mul(0.012);
          frosted.assign(blurred.sample(coord.add(jitter)).rgb);
        });
      });
      // tile: quantise the lookup into panes, the closest thing to glass bricks
      If(style.greaterThan(4.5), () => {
        const cell = coord.div(vec2(0.045, 0.075)).floor().add(0.5).mul(vec2(0.045, 0.075));
        frosted.assign(blurred.sample(cell).rgb);
      });
      // double: two offset refractions averaged, a harder, doubled pane
      If(style.greaterThan(1.5), () => {
        If(style.lessThan(2.5), () => {
          frosted.assign(blurred.sample(coord.add(vec2(0.0035, 0.0))).rgb
            .add(blurred.sample(coord.sub(vec2(0.0035, 0.0))).rgb).mul(0.5));
        });
      });
      const localWeight = weight.toVar();
      // radial: harder toward the pane edges, like a lens pressed flat
      If(style.greaterThan(2.5), () => {
        If(style.lessThan(3.5), () => {
          const edge = clamp(length(coord.sub(vec2(0.5, 0.5))).mul(1.6), 0, 1);
          localWeight.assign(weight.mul(float(0.45).add(edge.mul(0.85))));
        });
      });
      // box: the same taps, flatter — a cheaper, more even smear
      If(style.greaterThan(0.5), () => {
        If(style.lessThan(1.5), () => {
          localWeight.assign(weight.mul(1.12));
        });
      });
      rgb.assign(mix(rgb, frosted, clamp(localWeight, 0, 1)));
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
// 1.5.26: the soft glow node, so the dial can switch its passes off entirely
let glowNodeRef = null;
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
  // An explicit false wins over the mode: the master switch has to be able to
  // stop the pass even when the mode says "in renderer".
  const requested = d.active === false ? false
    : d.mode === 'css' ? false
      : d.mode === 'render' ? true
        : d.active === true;
  const wanted = requested && d.perf !== true;
  // 1.5.23: one blur radius for the whole frame, in CSS pixels. The render path
  // maps it onto the spread of the blur taps; the CSS path uses it directly.
  const radius = Number(d.radius);
  if (Number.isFinite(radius)) uGlassSpread.value = Math.max(0, Math.min(24, radius)) / 24 * 9;
  if (typeof d.style === 'string') {
    const index = ['gaussian', 'box', 'double', 'radial', 'frost', 'tile'].indexOf(d.style);
    if (index >= 0) uGlassStyle.value = index;
  }
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

// Deterministic per-name phase: the same constellation keeps the same rhythm
// across reloads, so the sky does not reshuffle on every refresh.
function hashName(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000;
}

// Smooth 0..1 ramp that also accepts a reversed range (edge0 > edge1), which is
// how the star fade is written: fully out above +6 deg, fully in below -2 deg.
function smoothstepRange(edge0, edge1, x) {
  const span = edge1 - edge0;
  const t = span === 0 ? (x >= edge0 ? 1 : 0) : (x - edge0) / span;
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// A uniform whose value is undefined makes three build a node of type null and
// throw while compiling the shader; the frame is never submitted and the skin
// reads as a grey page. Scrub every external value before it reaches a uniform.
function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
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
      if (Number.isFinite(Number(d.overflow))) {
        overflowTarget = Math.max(0, Math.min(1, Number(d.overflow)));
      }
      // In `real` mode the sky is driven by solar.js; a host that keeps
      // posting t (sea updates arrive at 4 Hz) must not overwrite it.
      // daylight is carried by oss-sun now; a sea tick must never move the sun
    }
    if (d && d.type === 'oss-sun') applySunMessage(d);
    if (d && d.type === 'oss-active') {
      // The panel watches its own window: a covered browser window never tells
      // the iframe (it is not a tab) and never takes focus, so this is the only
      // signal that the skin went to the background.
      obscured = d.active === false;
      applyObscuredLoop();
    }
    if (d && d.type === 'oss-glass') applyGlassMessage(d);
    if (d && d.type === 'oss-boats') applyBoatsMessage(d);
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
    twilightMinutes,
    moonElevationDeg,
    moonAzimuthDeg,
    moonPhase01,
    moonIllum: moonBrightness,
    moonBrightness,
    constellation: constellationSetting,
    cross: crossSetting,
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
    // measured render rate and the cap it is held to: the panel prints these
    // instead of timing its own requestAnimationFrame, which is the parent
    // document's 60 Hz clock and says nothing about the frame's budget
    fps: Math.round(fpsNow * 10) / 10,
    fpsCap: FRAME_RATE_CAP,
    reducedMotion: REDUCED_MOTION,
    lowEndDevice: LOW_END_DEVICE,
    starOpacity: starLayer ? starLayer.starsOpacity : 0,
    starFade: starLayer ? starLayer.starFade : 0,
    milkyVisible: uMilkyVisible.value,
    galacticCentreAlt,
    overflow: uOverflow.value,
    meteor: starLayer ? starLayer.meteor.active : false,
    boats: boatShown,
    boatSpread,
    boatPace,
    boatScale,
    skyDist: skyZoom,
    boatSpots: boatSpotList(),
    boatTarget,
    boatError,
    elapsed: uTime.value,
    manualTimeOfDay,
    manualMinutes,
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
let MIN_SCALE = REDUCED_MOTION ? 0.5 : SKIN ? 0.6 : 0.55;
let adaptHold = 0;
let renderScale = 1;
// contract §3.4: the frosted glass caps the adaptive scale, it never raises it
let SCALE_CAP = 1;

// 2.0.7 performance switches. Every one of them defaults to the shape the user
// already knows, so a profile written by 2.0.6 keeps the 2.0.6 frame.
let perfScheduler = true;
let pauseMode = 'pause'; // pause | throttle | off
let webgl2Adaptive = true;
let resizeDebounce = true;
let webglFallback = false;
let webglLatchUntil = 0;
let obscured = false;
let nextDue = 0;
let currentQuality = 'balanced';

function applyResolutionScale(scale) {
  renderer.setPixelRatio(BASE_PIXEL_RATIO * scale);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// 1.5.26: one dial for the whole frame budget. 'high' keeps the old caps,
// 'balanced' is the desktop default, 'low' suits a laptop on battery.
const QUALITY_PRESETS = {
  high: { pixelRatio: 1.5, targetFps: 60, scaleCap: 1, minScale: 0.7 },
  balanced: { pixelRatio: 1, targetFps: 40, scaleCap: 1, minScale: 0.5 },
  low: { pixelRatio: 0.85, targetFps: 30, scaleCap: 0.8, minScale: 0.42 },
};

// 1.5.27: the frame budget is a first-class dial. A wallpaper does not need
// 60 fps, and every frame is a full-screen fill: halving the rate halves the
// GPU time. SKIN defaults to 30; the standalone demo keeps its old cap.
const FPS_OPTIONS = [30, 60, 90, 120];
const PAUSE_MODES = ['pause', 'throttle', 'off'];
let fpsCap = SKIN ? 30 : 60;

function applyFpsCap(cap) {
  // A profile saved by 2.0.2 or earlier can carry 24 or 45: snap it to the
  // nearest offered rate rather than jumping to whatever the fallback was, and
  // never round up past what the display can hold.
  const next = FPS_OPTIONS.reduce(
    (best, option) => (Math.abs(option - cap) < Math.abs(best - cap) ? option : best),
    FPS_OPTIONS[0],
  );
  fpsCap = next;
  FRAME_RATE_CAP = REDUCED_MOTION ? Math.min(next, 20) : next;
  FRAME_MS = 1000 / FRAME_RATE_CAP;
  // the governor must not chase a target above the cap: it would keep scaling
  // the resolution up until the frame budget blew past the cap again
  TARGET_FPS = Math.min(TARGET_FPS, Math.max(12, FRAME_RATE_CAP - 2));
}

function applyQuality(level) {
  const preset = QUALITY_PRESETS[level];
  if (!preset || !renderer) return;
  currentQuality = level;
  PIXEL_RATIO_CAP = REDUCED_MOTION ? Math.min(preset.pixelRatio, 0.9) : preset.pixelRatio;
  BASE_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP);
  TARGET_FPS = REDUCED_MOTION ? 18 : preset.targetFps;
  SCALE_CAP = preset.scaleCap;
  MIN_SCALE = REDUCED_MOTION ? Math.min(preset.minScale, 0.5) : preset.minScale;
  renderScale = Math.min(Math.max(renderScale, preset.minScale), SCALE_CAP);
  applyResolutionScale(renderScale);
  applyFpsCap(fpsCap);
}

// 2.0.7: one place that decides whether the loop should be running. `throttle`
// keeps the loop alive and lets the gate in animate() stretch the step to 10 fps,
// so the sky keeps advancing and coming back does not jump; `pause` stops it
// outright, which is what actually drops the GPU to idle when DSH is covered.
function applyObscuredLoop() {
  if (!loopStarted || !renderer) return;
  // Never pause before the first frame is on screen: the loader is only taken
  // down by a rendered frame, so a pause here would read as a broken skin.
  if (!firstFrameShown) return;
  if (obscured && pauseMode === 'pause') {
    renderer.setAnimationLoop(null);
    return;
  }
  if (document.hidden) return;
  lastFrameTime = performance.now();
  lastRenderAt = 0;
  nextDue = 0;
  renderer.setAnimationLoop(animate);
}

function animate(now) {
  // 2.0.7: the whole tick is gated, not just the draw. On a 144 Hz panel the
  // star billboards, the orbit controls and the fleet used to run 144 times a
  // second so that 30 frames could be presented. The due time is advanced in
  // whole frame steps (nextDue += step) instead of being snapped to `now`, and
  // that matters: a 30 Hz budget sampled on a 144 Hz vsync grid lands on 6.9
  // ticks, and resetting the anchor to `now` turned that into an alternating
  // 2/1 cadence. A long stall resyncs instead of trying to catch up in a burst.
  if (perfScheduler) {
    const step = obscured && pauseMode === 'throttle' ? Math.max(FRAME_MS, 100) : FRAME_MS;
    if (now + 0.5 < nextDue) return;
    if (now - nextDue > step * 4) nextDue = now;
    nextDue += step;
  }
  // high-resolution timestamp -> delta, clamped so hitches never cause jumps
  const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  uTime.value += dt * (REDUCED_MOTION ? 0.12 : 1);
  // the star quads are billboarded in the shader, so their basis has to follow
  // the camera every frame, not only when the sky is rebuilt
  updateStarBillboards();
  // frame-rate independent follow of the requested sea level (see seaGoal)
  uSea.value += (seaGoal - uSea.value) * (1 - Math.exp(-dt / SEA_FOLLOW_TAU));
  controls.update();
  // a throw here would kill the animation loop and leave an unpresented (white)
  // canvas, so each optional layer degrades on its own instead
  if (SKIN && boats) {
    try {
      updateBoats(dt);
      boatError = '';
    } catch (err) {
      // keep the message: the panel prints it, so a failure here is readable
      // without opening DevTools and reading a swallowed warning
      boatError = String((err && err.message) || err);
      boats = null;
      console.warn('[open-sea-skin] boats disabled:', boatError);
    }
  }
  if (SKIN && starLayer) {
    try {
      updateStarDome(now, dt);
      skySeconds += dt;
      updateMeteors(starLayer, skySeconds, dt);
    } catch (err) {
      starLayer = null;
      console.warn('[open-sea-skin] star dome disabled', err);
    }
  }

  // frame cap: with the smart scheduler the work above is already gated, so
  // only the legacy path still needs the mid-tick early return
  if (!perfScheduler) {
    if (now - lastRenderAt < FRAME_MS - 0.5) return;
  }
  lastRenderAt = now;

  postProcessing.render();

  // The panel lives on another origin and cannot read this window, so push what
  // it needs to describe the sky: the real altitude it computed, where that
  // altitude landed in the frame, and the sunrise/sunset it used.
  if (SKIN && now - lastStatePostAt >= STATE_POST_MS && window.parent && window.parent !== window) {
    lastStatePostAt = now;
    try {
      window.parent.postMessage({ type: 'oss-state', state: window.__ossState() }, SKIN_PARENT_ORIGIN || '*');
    } catch (error) {
      // posting is best effort: a blocked parent must not stop the sea
    }
  }

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
    // After a change, wait four more windows (8 s) before touching the scale
    // again. A short hold let the loop pump the scale every couple of seconds and
    // that periodic sharpness pulse reads as stutter on the water; the dead band
    // is narrow now because the floor sits at 0.7 in skin mode, so a drop is
    // cheap and rare instead of frequent and deep.
    if (adaptHold > 0) adaptHold -= 1;
    if (fpsNow > 0 && adaptHold === 0) {
      if (fpsNow < TARGET_FPS - 6 && renderScale > MIN_SCALE) {
        renderScale = Math.max(MIN_SCALE, +(renderScale * 0.97).toFixed(3));
        applyResolutionScale(renderScale);
        adaptHold = 4;
        // 2.0.7: a WebGL2 post chain is dearer than the WebGPU one, so once the
        // governor has walked down there it is not allowed to walk straight
        // back up and oscillate. The latch only gates the climb, never the drop.
        if (webglFallback) webglLatchUntil = now + 30000;
      } else if (
        fpsNow > TARGET_FPS + 6
        && renderScale < SCALE_CAP
        && (!webglFallback || now > webglLatchUntil)
      ) {
        renderScale = Math.min(SCALE_CAP, +(renderScale * 1.015).toFixed(3));
        applyResolutionScale(renderScale);
        adaptHold = 4;
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

const OCEAN_BUILD = 'lab-2.0.4';

// How often the frame reports its own state to the host page.
const STATE_POST_MS = 400;
let lastStatePostAt = 0;

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
    // 1.5.26: the resolution budget is a setting now; start from the preset the
    // page asked for (the panel can move it afterwards)
    applyQuality(SKIN ? QUALITY === 'low' ? 'low' : 'balanced' : 'high');
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

      // A probe seam for headless checks: only present when the page asks for it.
      if (typeof location !== 'undefined' && /[?&]ossdebug=1/.test(location.search)) {
        window.__ossDebug = {
          scene, camera, sky, renderer,
          get post() { return postProcessing; },
          uniforms: {
            zenith: uZenithColor, horizon: uHorizonColor, deep: uDeepColor, shallow: uShallowColor,
            skyLight: uSkyLight, nightF: uNightF, tone: uSkyTone, stars: uStars, airglow: uAirglow,
            warm: uTwilightWarm, belt: uBeltOfVenus, shadow: uEarthShadow, cloudOpacity: uCloudOpacity,
            fold: uSkyFold, milky: uMilky, moonVisible: uMoonVisible,
            constellation: uConstellation, cross: uCrossGlow, starSize: uStarSize,
          },
        };
      }
    }

    // --- post-processing: scene pass + TSL bloom + optional frosted glass ---
  

  postProcessing = new THREE.PostProcessing(renderer);
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode('output');
    const bloomStrength = SKIN ? (LOW_END_DEVICE ? 0.18 : 0.28) : 0.4;
    // 1.5.26: the quarter-res glow replaces three's mip-chain bloom (see
    // SoftGlowNode). uGlowStrength is the dial; the passes are skipped at 0.
    uGlowStrength.value = bloomStrength;
    let glowNode = null;
    try {
      glowNode = new SoftGlowNode(sceneColor);
      glowNode.active = bloomStrength > 0.01;
    } catch (err) {
      glowNode = null;
      console.warn('[OPEN SEA SKIN] soft glow disabled:', err);
    }
    glowNodeRef = glowNode;
    const sceneGlow = glowNode ? glowNode.getTextureNode().sample(uv()).rgb.mul(uGlowStrength) : vec3(0);
    if (SKIN) {
      // contract §3.5: any failure here must keep the clear image on screen
      try {
        glassNode = new GlassBlurNode(sceneColor);
      } catch (err) {
        glassNode = null;
        warnGlass(err);
      }
    }
    postProcessing.outputNode = buildComposite(sceneColor, sceneGlow, glassNode);

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
    const rebuildForResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      applyResolutionScale(renderScale);
    };
    // 2.0.7: dragging a window edge fires resize every pixel, and every one of
    // them reallocated the render targets. The old canvas is stretched over the
    // viewport while the drag is in flight (no gap, no black band) and the
    // targets are rebuilt once, 150 ms after the drag settles.
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      if (!resizeDebounce) {
        rebuildForResize();
        return;
      }
      if (!resizeTimer && renderer && renderer.domElement && renderer.domElement.style) {
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
      }
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = 0;
        rebuildForResize();
      }, 150);
    });

    // --- lifecycle: pause when the tab is hidden -------------------------------
    document.addEventListener('visibilitychange', () => {
      if (!loopStarted) return;
      if (document.hidden) {
        renderer.setAnimationLoop(null);
        return;
      }
      // a minimized window is hidden first and covered second; coming back
      // re-runs the same decision the panel's activity signal uses
      applyObscuredLoop();
    });

    // --- initialize the GPU and start rendering --------------------------------
    await renderer.init();

    if (renderer.backend.isWebGPUBackend !== true) {
      // WebGPU 不可用时 three 自动回退 WebGL2 backend：两种 backend 都允许渲染
      // （2026-08-23 webgui 冒烟测试：用户浏览器无 WebGPU → 纯 WebGPU 检查导致初始化失败）。
      webglFallback = true;
      if (webgl2Adaptive) {
        // 2.0.7: no hardcoded 30 fps / 0.6 any more. The panel's tier is applied
        // as-is and the governor walks it down if WebGL2 cannot hold it; the
        // 30 s latch in the governor stops it from climbing back immediately.
        webglLatchUntil = performance.now() + 30000;
        if (QUALITY_PRESETS[currentQuality]) applyQuality(currentQuality);
        else applyQuality('balanced');
      } else {
        PIXEL_RATIO_CAP = 1.0;
        BASE_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP);
        FRAME_RATE_CAP = 30;
        FRAME_MS = 1000 / FRAME_RATE_CAP;
        TARGET_FPS = 28;
        renderScale = 0.6;
        applyResolutionScale(renderScale);
      }
    }

    loopStarted = true;
    renderer.setAnimationLoop(animate);
    // The panel's first oss-sun can land while init() is still awaiting the
    // adapter; applyQuality() bails until a renderer exists, so the frame ran on
    // the default 60 fps cap while the panel said 24. Ask for the settings again
    // now that they can be applied.
    try {
      if (SKIN && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'oss-ready' }, SKIN_PARENT_ORIGIN || '*');
      }
    } catch { /* posting is best effort */ }
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
// Screen positions of the hulls that are actually drawn, for the panel readout.
const boatSpotVec = new THREE.Vector3();
let boatError = '';
let boatTarget = BOAT_BASE;
let boatShown = 0;
let boatDrawn = 0;
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
    // Every berth is in the draw from the first frame. The instance buffer is
    // bound once, at whatever count the first draw happens to have, and a mesh
    // that starts at 0 keeps drawing its first hull forever (see boatHidden).
    for (let i = 0; i < BOAT_MAX; i += 1) mesh.setMatrixAt(i, boatHidden.matrix);
    mesh.count = BOAT_MAX;
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
// An idle berth is parked four kilometres below the sea with a 1 mm scale. It
// keeps its slot inside the draw, which is what makes the drawn count stable:
// shrinking `count` and growing it again leaves empty instance matrices bound,
// and that is how three boats became one visible hull under three.js WebGPU.
const boatHidden = new THREE.Object3D();
boatHidden.position.set(0, -4000, 0);
boatHidden.scale.setScalar(0.001);
boatHidden.updateMatrix();
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

// Only the 400 ms state post reads these, so the projection is done on demand
// rather than once per rendered frame.
function boatSpotList() {
  const out = [];
  if (!boatCamera) return out;
  for (let i = 0; i < boatDrawn && i < 6; i += 1) {
    const placed = boatPlaced[i];
    if (!placed) continue;
    boatSpotVec.set(placed.x, placed.y || 0, placed.z).project(boatCamera);
    out.push([
      Math.round((boatSpotVec.x * 0.5 + 0.5) * 100) / 100,
      Math.round((0.5 - boatSpotVec.y * 0.5) * 100) / 100,
    ]);
  }
  return out;
}

// The panel drives these three: how wide a lap is, how fast it runs and how big
// the hulls read. The user tuned the defaults: twice the 1.5.3 sweep, 2.5x hull.
let boatSpread = 2;
let boatPace = 1;
let boatScale = 2.5;

function applyBoatsMessage(data) {
  const spread = Number(data.spread);
  const pace = Number(data.pace);
  const scale = Number(data.scale);
  if (Number.isFinite(spread)) boatSpread = Math.max(0.2, Math.min(3, spread));
  if (Number.isFinite(pace)) boatPace = Math.max(0.3, Math.min(2.5, pace));
  if (Number.isFinite(scale)) boatScale = Math.max(1.4, Math.min(4.6, scale));
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
    lane.angle += dt * lane.speed * cruise * lane.surge * boatPace;
    const angle = lane.angle;
    lane.pushX *= 0.92;
    lane.pushZ *= 0.92;

    const ahead = lane.base + Math.cos(angle) * lane.radiusBack;
    // Sideways distance that puts the hull just past the frame edge at this depth.
    const offStage = boatApproachOffset(ahead);
    // 1.5.3's fixed amplitude, scaled by the "range" setting (1 = untouched).
    // Twice the 1.5.3 amplitude overflows the frame at the near berths, so the
    // sweep is capped to 92% of the half-width that depth can show.
    const reach = Math.max(1, (offStage - BOAT_MARGIN) * 0.92);
    const laneAcross = Math.max(-reach, Math.min(reach, Math.sin(angle) * lane.radiusRight * boatSpread));
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
        // Freeze the distance here. `offStage` depends on the depth the hull is
        // at, and a hull still on its way out can swing to a shallower berth
        // where that edge is much nearer: recomputing it every frame made a
        // boat disappear while still inside the frame.
        lane.exitReach = offStage + 4;
      }
      lane.away += (lane.exitSide * lane.exitReach - lane.away) * Math.min(1, dt * laneExit);
      if (Math.abs(lane.away) >= lane.exitReach - 0.5) {
        // Fully outside the frame: dropping the hull here cannot be seen.
        lane.shown = false;
        lane.exitReach = 0;
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
    placed.y = surface.y - 0.08;
    boatDummy.position.set(placed.x, placed.y, placed.z);
    // Perspective already shrinks a boat out on the approach, and a hull is only
    // ever removed once it is past the frame edge, so the scale stays constant.
    // 3.2 (not 2.2) because the lanes moved out to 36–52 units: the same angular
    // size as before, at a berth that reads as further out to sea instead of
    // hugging the bottom edge.
    boatDummy.scale.setScalar(boatScale);
    boatDummy.updateMatrix();

    boats.hull.setMatrixAt(active, boatDummy.matrix);
    boats.mast.setMatrixAt(active, boatDummy.matrix);
    boats.sail.setMatrixAt(active, boatDummy.matrix);
    boats.lantern.setMatrixAt(active, boatDummy.matrix);
    active += 1;
  }

  boatShown = active;
  boatDrawn = active;
  // The draw count stays at capacity: three.js WebGPU binds the instance buffer
  // at the count of the first draw and never grows it afterwards, so a fleet
  // that grows from 1 to 3 kept painting one hull while the panel read 3/3.
  // Idle berths go to boatHidden instead of being dropped from the draw.
  for (const part of [boats.hull, boats.mast, boats.sail, boats.lantern]) {
    for (let i = active; i < BOAT_MAX; i += 1) part.setMatrixAt(i, boatHidden.matrix);
    part.count = BOAT_MAX;
    part.instanceMatrix.needsUpdate = true;
  }
}


// ---------------------------------------------------------------------------
// SECTION 11 · STAR DOME · real constellations, twinkling, and meteors
// ---------------------------------------------------------------------------

const STAR_RADIUS = 3200;
const DEG_TO_RAD = Math.PI / 180;

let starLayer = null;
// glow uniforms are module-scope so the layer can be skipped without leaving
// dangling material state behind
const uStarGlow = uniform(0);
const uMeteorGlow = uniform(0);
// how strongly the real constellations are drawn: a settings dial, not a compile flag
const uConstellation = uniform(CONSTELLATION_GRADES.mid / 100);
const uCrossGlow = uniform(CROSS_GRADES.mid / 100);

// A star is now a catalogue entry, not a stick-figure junction: 2851 naked-eye
// stars with a real magnitude and colour index, so the sky can show a first
// magnitude beacon next to a barely-there fifth magnitude smudge.
const BV_RAMP = [
  [-0.3, 0.52, 0.68, 1.00],
  [0.0, 0.84, 0.91, 1.00],
  [0.4, 1.00, 0.97, 0.90],
  [0.8, 1.00, 0.86, 0.64],
  [1.4, 1.00, 0.64, 0.32],
  [2.0, 1.00, 0.50, 0.20],
];

function writeStarColor(bv, saturation, out, at) {
  let i = 0;
  while (i + 2 < BV_RAMP.length && bv > BV_RAMP[i + 1][0]) i += 1;
  const a = BV_RAMP[i];
  const b = BV_RAMP[Math.min(BV_RAMP.length - 1, i + 1)];
  const span = b[0] - a[0] || 1;
  const t = Math.max(0, Math.min(1, (bv - a[0]) / span));
  for (let c = 0; c < 3; c += 1) {
    const tint = a[c + 1] + (b[c + 1] - a[c + 1]) * t;
    // 0 is a monochrome sky, 1 the catalogue colour, above 1 an exaggeration
    out[at + c] = Math.max(0, Math.min(1.3, 0.94 + (tint - 0.94) * saturation));
  }
}

// Pixel size falls off with magnitude: a 0 mag star gets the full dial, a 5 mag
// one is a hairline. The floor keeps the faintest stars from disappearing.
function starPixelsFor(mag) {
  const size = uStarSize.value * Math.pow(10, -uStarFalloff.value * Math.max(0, mag));
  return Math.max(uStarMin.value, Math.min(uStarSize.value, size));
}

// Brightness is compressed on purpose: a linear magnitude ratio would make
// everything past 2 mag invisible next to Vega.
function starGlowFor(mag) {
  return Math.max(0.16, Math.min(1, Math.pow(10, -0.5 * Math.max(0, mag))));
}

function createStarLayer(scene) {
  const starCount = STAR_CATALOG.length;
  const starRA = new Float32Array(starCount);
  const starDec = new Float32Array(starCount);
  const starMag = new Float32Array(starCount);
  const starBV = new Float32Array(starCount);
  for (let i = 0; i < starCount; i += 1) {
    const row = STAR_CATALOG[i];
    starRA[i] = row[0];
    starDec[i] = row[1];
    starMag[i] = row[2];
    starBV[i] = row[3];
  }

  // One segment per polyline edge; raw points are fine here because the extra
  // vertices cost nothing next to a line width.
  const segments = [];
  const segmentNames = [];
  // Which legs sit at the ends of a polyline: only those taper into the star,
  // otherwise every joint would dim and the figure would look beaded.
  const capStart = [];
  const capEnd = [];
  for (const line of CONSTELLATION_LINES) {
    const points = line.points || line;
    for (let i = 1; i < points.length; i += 1) {
      segments.push(points[i - 1], points[i]);
      segmentNames.push(line.name || '');
      capStart.push(i === 1 ? 1 : 0);
      capEnd.push(i === points.length - 1 ? 1 : 0);
    }
  }
  const segmentCount = segments.length;

  // One camera-facing quad per star now carries the dot, its halo and its
  // diffraction spikes in a single additive draw. A GPU point sprite is always a
  // square and PointsNodeMaterial has no texture slot on the node path, so the
  // round star has to be geometry.
  const quadCount = starCount * 6;
  const quadPositions = new Float32Array(quadCount * 3);
  const quadCorner = new Float32Array(quadCount * 2);
  const quadExtent = new Float32Array(quadCount);
  const quadSize = new Float32Array(quadCount);
  const quadSpike = new Float32Array(quadCount);
  const quadGlow = new Float32Array(quadCount);
  const quadPhase = new Float32Array(quadCount);
  const quadColor = new Float32Array(quadCount * 3);
  const starPhaseAttr = new Float32Array(starCount);
  const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < starCount; i += 1) {
    starPhaseAttr[i] = Math.random() * Math.PI * 2;
    for (let v = 0; v < 6; v += 1) {
      const at = i * 6 + v;
      quadPhase[at] = starPhaseAttr[i];
      quadCorner[at * 2 + 0] = CORNERS[v][0];
      quadCorner[at * 2 + 1] = CORNERS[v][1];
    }
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(quadPositions, 3));
  starGeometry.setAttribute('aCorner', new THREE.BufferAttribute(quadCorner, 2));
  starGeometry.setAttribute('aExtent', new THREE.BufferAttribute(quadExtent, 1));
  starGeometry.setAttribute('aSize', new THREE.BufferAttribute(quadSize, 1));
  starGeometry.setAttribute('aSpike', new THREE.BufferAttribute(quadSpike, 1));
  starGeometry.setAttribute('aGlow', new THREE.BufferAttribute(quadGlow, 1));
  starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(quadPhase, 1));
  starGeometry.setAttribute('aColor', new THREE.BufferAttribute(quadColor, 3));

  const corner = attribute('aCorner', 'vec2');
  const extent = attribute('aExtent', 'float');
  const aSize = attribute('aSize', 'float');
  const aSpike = attribute('aSpike', 'float');
  const aGlow = attribute('aGlow', 'float');
  const aPhase = attribute('aPhase', 'float');
  const aColor = attribute('aColor', 'vec3');
  // 1.5 rad/s reads as scintillation; anything faster looks like blinking.
  // 1.5.23: both the rate and the depth are dials now.
  const twinkle = sin(uTime.mul(uTwinkleSpeed).mul(1.5).add(aPhase))
    .mul(uTwinkleAmp).add(float(1).sub(uTwinkleAmp));

  const starMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  // billboard: push each corner along the camera's own right/up axes, so the
  // quad always faces the viewer without any per-frame JS rebuilding.
  const edgeOffset = uStarRight.mul(corner.x).add(uStarUp.mul(corner.y));
  starMaterial.positionNode = positionLocal.add(edgeOffset.mul(extent).mul(uStarPxWorld));

  const pxDist = length(corner).mul(extent);
  // pxDist and aSize are both in pixels: aSize is the disc diameter, so the
  // bright core fades out over one pixel at the rim instead of stretching into
  // a soft blob.
  const radius = aSize.mul(0.62);
  const core = smoothstep(radius, radius.mul(0.45), pxDist);
  const halo = smoothstep(aSize.mul(1.15), aSize.mul(0.62), pxDist).mul(uHaloStrength).mul(0.4);
  // four rays along the quad axes; the length is per star, so only the bright
  // ones get spikes and the faint ones stay clean dots
  const spikeOn = smoothstep(float(2.0), float(6.0), aSpike);
  const axisGap = min(abs(corner.x), abs(corner.y)).mul(extent);
  const rayCore = smoothstep(float(1.4), float(0.0), axisGap);
  const reach = smoothstep(aSpike, aSpike.mul(0.12).max(1.0), pxDist);
  const spikeGlow = rayCore.mul(reach).mul(spikeOn).mul(1.55).mul(uCrossGlow);
  const shape = core.add(halo).add(spikeGlow).min(1.0);
  starMaterial.colorNode = aColor.mul(aGlow).mul(twinkle).mul(uStarGlow).mul(uStarBase).mul(shape);

  const stars = new THREE.Mesh(starGeometry, starMaterial);
  stars.frustumCulled = false;
  stars.renderOrder = 2;
  scene.add(stars);

  // One-pixel GPU lines alias badly on a 1x display: a diagonal leg staircases
  // across the sky. Each leg is therefore drawn as two thin quads that fade from
  // the centreline out to nothing, which the rasteriser blends into a smooth
  // stroke at any angle. 8 vertices per leg is cheap next to the draw itself.
  const edgeCount = Math.floor(segmentCount / 2);
  const lineGlowAttr = new Float32Array(edgeCount * 8);
  const lineSideAttr = new Float32Array(edgeCount * 8);
  const linePhaseAttr = new Float32Array(edgeCount * 8);
  const lineAlongAttr = new Float32Array(edgeCount * 8);
  const lineCapStartAttr = new Float32Array(edgeCount * 8);
  const lineCapEndAttr = new Float32Array(edgeCount * 8);
  const namePhase = new Map();
  for (let i = 0; i < edgeCount; i += 1) {
    const owner = segmentNames[i] || '';
    if (!namePhase.has(owner)) namePhase.set(owner, (hashName(owner) % 628) / 100);
    // 2.4 rad steps decorrelate neighbouring legs while staying deterministic
    // One phase per constellation. The extra per-polyline offset made each leg
    // breathe on its own clock, so a figure looked like it was tearing apart
    // instead of inhaling; neighbouring figures still differ by name.
    const phase = namePhase.get(owner) * 2.399963;
    for (let v = 0; v < 8; v += 1) linePhaseAttr[i * 8 + v] = phase;
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeCount * 8 * 3), 3));
  lineGeometry.setAttribute('aLineGlow', new THREE.BufferAttribute(lineGlowAttr, 1));
  lineGeometry.setAttribute('aSide', new THREE.BufferAttribute(lineSideAttr, 1));
  lineGeometry.setAttribute('aLinePhase', new THREE.BufferAttribute(linePhaseAttr, 1));
  lineGeometry.setAttribute('aAlong', new THREE.BufferAttribute(lineAlongAttr, 1));
  lineGeometry.setAttribute('aCapStart', new THREE.BufferAttribute(lineCapStartAttr, 1));
  lineGeometry.setAttribute('aCapEnd', new THREE.BufferAttribute(lineCapEndAttr, 1));
  const lineIndex = new Uint32Array(edgeCount * 12);
  for (let i = 0; i < edgeCount; i += 1) {
    const at = i * 8;
    const side = i * 8;
    // left quad, then right quad
    lineSideAttr[side + 0] = -1; lineSideAttr[side + 1] = 0;
    lineSideAttr[side + 2] = 0; lineSideAttr[side + 3] = -1;
    lineSideAttr[side + 4] = 0; lineSideAttr[side + 5] = 1;
    lineSideAttr[side + 6] = 1; lineSideAttr[side + 7] = 0;
    // a-end is along 0, b-end is along 1; caps only exist at polyline ends
    for (let v = 0; v < 8; v += 1) {
      lineAlongAttr[side + v] = v === 2 || v === 3 || v === 6 || v === 7 ? 1 : 0;
      lineCapStartAttr[side + v] = capStart[i] || 0;
      lineCapEndAttr[side + v] = capEnd[i] || 0;
    }
    const o = i * 12;
    lineIndex[o + 0] = at + 0; lineIndex[o + 1] = at + 1; lineIndex[o + 2] = at + 2;
    lineIndex[o + 3] = at + 0; lineIndex[o + 4] = at + 2; lineIndex[o + 5] = at + 3;
    lineIndex[o + 6] = at + 4; lineIndex[o + 7] = at + 5; lineIndex[o + 8] = at + 6;
    lineIndex[o + 9] = at + 4; lineIndex[o + 10] = at + 6; lineIndex[o + 11] = at + 7;
  }
  lineGeometry.setIndex(new THREE.BufferAttribute(lineIndex, 1));
  const lineMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  // Additive blending ignores alpha, so the soft edge lives in the colour: the
  // centreline is full strength, the outer rim is nothing.
  const lineEdge = float(1).sub(abs(attribute('aSide', 'float')));
  const linePhase = attribute('aLinePhase', 'float');
  // Two incommensurate rates make each constellation breathe on its own clock,
  // and the per-edge phase keeps neighbouring legs from pulsing together. The
  // result never flashes as one sky; it drifts.
  // 0.55 rad/s is an 11 s breath; 2.1 rad/s rides on top as a shimmer.
  // 0.72 + 0.28: the slow beat dominates, the fast one only roughens it. A
  // symmetric 50/50 mix cancelled itself out and read as flicker, not breath.
  const lineWobble = sin(uTime.mul(uLineSpeed).add(linePhase)).mul(0.72)
    .add(sin(uTime.mul(uLineSpeed).mul(3.82).add(linePhase.mul(1.73))).mul(0.28));
  // 0.21 rad/s is a ~30 s swell shared by every line: the constellation phase
  // stops the picture from flashing in unison, this envelope stops it from
  // looking dead when the phases cancel out.
  const lineBreath = sin(uTime.mul(0.21)).mul(0.5).add(0.5).mul(0.8).add(0.6);
  // A stroke that stops at a hard square leaves a saw-tooth spur beside the star
  // that is meant to sit there. The outermost legs fade into their dot instead.
  const lineAlong = attribute('aAlong', 'float');
  const lineTaper = mix(float(1), smoothstep(0.0, 0.24, lineAlong), attribute('aCapStart', 'float'))
    .mul(mix(float(1), smoothstep(1.0, 0.76, lineAlong), attribute('aCapEnd', 'float')));
  lineMaterial.colorNode = vec3(0.55, 0.70, 1.0)
    .mul(lineEdge.mul(lineEdge))
    .mul(attribute('aLineGlow', 'float')).mul(uStarGlow).mul(uConstellation).mul(1.5)
    .mul(float(1).add(lineWobble.mul(uLineTwinkle)))
    .mul(lineBreath)
    .mul(lineTaper);
  const lines = new THREE.Mesh(lineGeometry, lineMaterial);
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

  // A head on the streak: a 1 px line alone reads as a scratch, and the bright
  // leading point is what makes a meteor look like a meteor.
  const meteorHeadGeometry = new THREE.BufferGeometry();
  meteorHeadGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const meteorHeadMaterial = new THREE.PointsNodeMaterial({
    size: 4.6,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  meteorHeadMaterial.colorNode = vec3(1, 0.96, 0.86).mul(uMeteorGlow).mul(2.2);
  const meteorHead = new THREE.Points(meteorHeadGeometry, meteorHeadMaterial);
  meteorHead.frustumCulled = false;
  meteorHead.renderOrder = 3;
  scene.add(meteorHead);

  const layer = {
    // NOTE: `meteor` is the state machine below, so the Line needs its own key
    stars, lines, meteorLine: meteor, meteorHead,
    starRA, starDec, starMag, starBV,
    segmentRA: Float32Array.from(segments, (p) => p[0]),
    segmentDec: Float32Array.from(segments, (p) => p[1]),
    segmentX: new Float32Array(segmentCount),
    segmentY: new Float32Array(segmentCount),
    segmentZ: new Float32Array(segmentCount),
    segmentGlow: new Float32Array(segmentCount),
    lineGlow: lineGlowAttr,
    segmentCount,
    starCount,
    starsOpacity: 0,
    starFade: 1,
    lastSky: -1e9,
    meteor: {
      active: false, elapsed: 0, duration: 1, next: 5,
      from: new THREE.Vector3(), to: new THREE.Vector3(),
      // 1.5.23: a shorter tail for a quick streak, a longer one for a fireball
      tail: 0.18, power: 1,
    },
  };
  refreshStarArt(layer);
  return layer;
}

// Size, brightness and colour are catalogue facts, so they are recomputed
// whenever a dial moves; the geometry itself only moves once every 20 s.
function refreshStarArt(layer) {
  const glow = layer.stars.geometry.getAttribute('aGlow');
  const size = layer.stars.geometry.getAttribute('aSize');
  const color = layer.stars.geometry.getAttribute('aColor');
  const spike = layer.stars.geometry.getAttribute('aSpike');
  const extent = layer.stars.geometry.getAttribute('aExtent');
  const saturation = Math.max(0, Math.min(2.2, uStarColor.value));
  const spikeLimit = uStarSpikes.value;
  const tint = [0, 0, 0];
  for (let i = 0; i < layer.starCount; i += 1) {
    const mag = layer.starMag[i];
    // magnitude cut: stars past the limit keep their slot but cost nothing
    const cut = mag > uStarCut.value;
    // A thick leg that ends in a 1 px dot reads as a broken line, so the dots
    // grow with the stroke instead of ignoring it.
    // `clamp` is the node helper: handing it plain numbers returns a node, and
    // arithmetic on that is NaN. JavaScript clamp for a JavaScript number.
    const lineBoost = 0.6 + 0.4 * Math.min(4, Math.max(0.2, uLineWidth.value));
    const px = cut ? 0 : starPixelsFor(mag) * lineBoost;
    // spikes reach a couple of dot diameters past the disc; a faint star keeps
    // the same quad but with zero spike length, so it renders as a clean dot
    const ray = !cut && mag <= spikeLimit ? Math.max(14, px * 3.4) : 0;
    // the quad has to cover the halo (1.15 diameters) and the rays; any tighter
    // and the disc gets clipped into a square.
    const half = Math.max(px * 1.05, ray * 0.85 + 2.5);
    const value = cut ? 0 : starGlowFor(mag);
    // colour modes: 0 = catalogue B-V, 1 = one warm white, 2 = exaggerated split
    const mode = uStarMode.value;
    const bv = mode > 0.5 && mode < 1.5 ? 0.35 : layer.starBV[i] + uStarBias.value;
    writeStarColor(bv, mode >= 1.5 ? saturation * 1.5 : mode > 0.5 && mode < 1.5 ? 0 : saturation, tint, 0);
    for (let v = 0; v < 6; v += 1) {
      const at = i * 6 + v;
      glow.setX(at, value);
      size.setX(at, px);
      spike.setX(at, ray);
      extent.setX(at, half);
      color.array[at * 3 + 0] = tint[0];
      color.array[at * 3 + 1] = tint[1];
      color.array[at * 3 + 2] = tint[2];
    }
  }
  glow.needsUpdate = true;
  size.needsUpdate = true;
  color.needsUpdate = true;
  spike.needsUpdate = true;
  extent.needsUpdate = true;
}

let lastAltDeg = 0;

// "Sky distance": 2 is the default now — at 1.0 the 60 degree window barely
// covers the Big Dipper. The dome folds sky angles toward the view axis by this
// factor, using a stereographic fold so the constellations keep their shape
// (every angle is scaled by the same local factor, so figures are not sheared).
// Animation clock: seconds since boot, advanced by dt so a slow frame does not
// teleport a meteor along its path.
let skySeconds = 0;
let skyZoom = 2;
// How much of that fold applies to the dome. 0 keeps the plain perspective sky
// (the old look), 1 is the full fold; in between mixes the two angles.
let skyDome = 0.55;
const skyAxis = new THREE.Vector3(0, 0, -1);
const skyUnit = new THREE.Vector3();
const skyCross = new THREE.Vector3();

// Fold one direction toward the view axis: theta -> 2*atan(tan(theta/2)/fold).
// Written as a rotation about the axis perpendicular to (axis, dir), which is
// the same thing on the great circle through both and avoids any pole issue.
function compressSky(dir) {
  const fold = Math.max(0.35, 1 + (skyZoom - 1) * skyDome);
  uSkyFold.value = fold;
  if (Math.abs(fold - 1) < 0.001) return dir;
  if (boatCamera) {
    boatCamera.getWorldDirection(skyAxis);
    // anchor the fold on the horizon under the view direction, not on the view
    // axis itself: folding toward the axis lifts everything off the sea line
    skyAxis.y = 0;
    if (skyAxis.lengthSq() < 1e-6) skyAxis.set(0, 0, -1);
    skyAxis.normalize();
  } else {
    skyAxis.set(0, 0, -1);
  }
  uSkyAxisDir.value.copy(skyAxis);
  const length = dir.length();
  if (length < 1e-6) return dir;
  skyUnit.copy(dir).divideScalar(length);
  const cosT = Math.max(-1, Math.min(1, skyAxis.dot(skyUnit)));
  const theta = Math.acos(cosT);
  if (theta < 1e-5) return dir;
  const thetaFolded = 2 * Math.atan(Math.tan(theta * 0.5) / fold);
  skyCross.crossVectors(skyAxis, skyUnit);
  if (skyCross.lengthSq() < 1e-12) return dir;
  skyCross.normalize();
  const shift = theta - thetaFolded;
  // rotate skyUnit about skyCross by -shift, i.e. toward the axis
  const q = new THREE.Quaternion().setFromAxisAngle(skyCross, -shift);
  skyUnit.applyQuaternion(q);
  return dir.copy(skyUnit).multiplyScalar(length);
}

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
  const dir = out.set(ce * Math.sin(az), Math.sin(alt), -ce * Math.cos(az));
  compressSky(dir);
  return dir.multiplyScalar(STAR_RADIUS);
}

const starDirA = new THREE.Vector3();
const cameraRight = new THREE.Vector3(1, 0, 0);
const cameraUp = new THREE.Vector3(0, 1, 0);

// The star quads are billboards: the shader needs the camera's own right/up
// axes and the world size of one screen pixel at the star shell. Stars all sit
// on the same radius, so one scalar covers every one of them.
function updateStarBillboards() {
  if (!boatCamera) return;
  cameraRight.setFromMatrixColumn(boatCamera.matrixWorld, 0).normalize();
  cameraUp.setFromMatrixColumn(boatCamera.matrixWorld, 1).normalize();
  uStarRight.value.copy(cameraRight);
  uStarUp.value.copy(cameraUp);
  // Sizes are authored in render-target pixels: the dome is a distant object and
  // the dots have to stay readable after the adaptive resolution scale kicks in,
  // which is exactly what the buffer height gives us.
  const bufferHeight = renderer && renderer.domElement ? renderer.domElement.height : 0;
  const pixels = bufferHeight > 0 ? bufferHeight : Math.max(240, window.innerHeight || 720);
  const halfFov = (boatCamera.fov * Math.PI) / 360;
  uStarPxWorld.value = (2 * STAR_RADIUS * Math.tan(halfFov)) / pixels;
}

// azimuth 0 faces -z (the camera's forward), altitude is degrees above the horizon
function skyPoint(azDeg, altDeg, out) {
  const az = azDeg * DEG_TO_RAD;
  const alt = altDeg * DEG_TO_RAD;
  const ce = Math.cos(alt);
  const dir = out.set(ce * Math.sin(az), Math.sin(alt), -ce * Math.cos(az));
  compressSky(dir);
  return dir.multiplyScalar(STAR_RADIUS);
}

// Star dials moved: sizes are uniforms now, so only the level change needs a
// rebuild (it re-grades which vertices are bright). Forcing lastSky makes the
// next updateStarDome pass redo the dome even if 20 s have not gone by.
function applyStarDials() {
  if (!starLayer) return;
  // size, brightness and colour are per-star attributes, so repaint them now
  // instead of waiting for the next georeference pass
  refreshStarArt(starLayer);
  starLayer.lastSky = -1e9;
}

function updateStarDome(nowRaw, dt) {
  const now = skyInstant(nowRaw).getTime();
  // ~0.75 s to cover 63% of the gap: fast enough to feel like weather, slow
  // enough that a threshold crossing reads as the sea getting angry.
  uOverflow.value += (overflowTarget - uOverflow.value) * Math.min(1, dt * 1.3);
  if (!starLayer) return;
  const layer = starLayer;
  const grade = starLevelOf(starsSetting);
  // Stars follow the sun instead of a switch: they begin to go at +6 deg and are
  // gone by -2 deg, so dusk never pops. "Keep stars in daylight" pins the fade
  // at 1 for people who want to read the chart at noon (and pay the fill for it).
  const daylight = uStarDaylight.value > 0.5;
  const targetFade = daylight ? 1 : smoothstepRange(6, -2, sunElevationDeg);
  layer.starFade += (targetFade - layer.starFade) * Math.min(1, Math.max(0.02, dt * 1.6));
  // a bright moon still washes the faint end out, as it does in life
  // in daylight mode the sun is not allowed to veto the layer, or the switch
  // would do nothing at noon, when it is the whole point
  const skyVeto = daylight ? 1 : Math.max(0, Math.min(1, uNightF.value * 1.15 - moonBrightness * 0.35));
  const visible = grade * layer.starFade * skyVeto;
  layer.starsOpacity += (visible - layer.starsOpacity) * 0.08;
  uStarGlow.value = layer.starsOpacity * 0.9;
  uStarFade.value = layer.starFade;
  // a fully faded dome must not cost a single vertex: drop it from the draw list
  const shown = layer.starsOpacity > 0.004;
  layer.stars.visible = shown;
  layer.lines.visible = shown;
  layer.meteorLine.visible = shown;
  layer.meteorHead.visible = shown;
  // the band is weakest when the galactic centre is under the horizon, and the
  // bright core only exists when the centre itself is up
  uMilkyVisible.value = shown ? 0.55 + 0.45 * smoothstepRange(-10, 14, galacticCentreAlt) : 0;

  // 15 deg/hour: a 5 s refresh is a 0.02 deg step, i.e. invisible
  // A hidden sky costs nothing: skip the rebuild while the layer is faded out.
  if (layer.starsOpacity < 0.01) return;
  if (now - layer.lastSky > 20000) {
    layer.lastSky = now;
    const date = new Date();
    const lst = localSiderealTime(date, sunLon);
    const lat = sunLat;
    // the galactic pole rides the same sky, so the Milky Way band turns with it
    const gal = equatorialToHorizontal(192.85948, 27.12825, lat, lst);
    galacticCentreAlt = equatorialToHorizontal(266.405, -28.936, lat, lst).altDeg;
    const galAlt = gal.altDeg * DEG_TO_RAD;
    const galAz = gal.azDeg * DEG_TO_RAD;
    uGalNormal.value.set(
      Math.cos(galAlt) * Math.sin(galAz),
      Math.sin(galAlt),
      -Math.cos(galAlt) * Math.cos(galAz),
    );
    const starPositions = layer.stars.geometry.getAttribute('position');
    refreshStarArt(layer);
    for (let i = 0; i < layer.starCount; i += 1) {
      starDirection(layer.starRA[i], layer.starDec[i], lat, lst, starDirA);
      for (let v = 0; v < 6; v += 1) {
        starPositions.setXYZ(i * 6 + v, starDirA.x, starDirA.y, starDirA.z);
      }
    }
    starPositions.needsUpdate = true;



    // Ribbon legs: one soft quad pair per constellation edge. The point list is
    // a polyline, so edge i joins point i to point i + 1 and each point is shared
    // by the two edges around it.
    const linePositions = layer.lines.geometry.getAttribute('position');
    const lineGlow = layer.lines.geometry.getAttribute('aLineGlow');
    const px = layer.segmentX;
    const py = layer.segmentY;
    const pz = layer.segmentZ;
    const pg = layer.segmentGlow;
    for (let i = 0; i < layer.segmentCount; i += 1) {
      starDirection(layer.segmentRA[i], layer.segmentDec[i], lat, lst, starDirA);
      px[i] = starDirA.x;
      py[i] = starDirA.y;
      pz[i] = starDirA.z;
      // fade the connections in over the first 14 degrees of altitude, so they
      // dissolve into the horizon haze instead of stopping mid-air
      pg[i] = Math.max(0, Math.min(1, lastAltDeg / uLineFadeDeg.value));
    }
    // World units per pixel at the star shell. A 3.8-unit ribbon is less than a
    // pixel tall on a short window, and a sub-pixel quad rasterises as a dashed
    // line; the floor keeps the figures continuous at any window height.
    const fovDeg = boatCamera ? boatCamera.fov : 60;
    // The floor has to be measured in drawing-buffer pixels, not CSS pixels:
    // with an adaptive render scale the buffer can be much shorter, and a floor
    // computed from innerHeight then still rasterises as a dashed line.
    const bufferPx = renderer && renderer.domElement ? renderer.domElement.height : 0;
    const viewPx = bufferPx > 0 ? bufferPx : typeof innerHeight === 'number' ? Math.max(240, innerHeight) : 800;
    const pxWorld = (2 * STAR_RADIUS * Math.tan(fovDeg * DEG_TO_RAD * 0.5)) / viewPx;
    const half = Math.max(STAR_RADIUS * 0.0012, pxWorld * 0.9) * uLineWidth.value;
    for (let e = 0; e + 1 < layer.segmentCount; e += 2) {
      const ax = px[e], ay = py[e], az = pz[e];
      const bx = px[e + 1], by = py[e + 1], bz = pz[e + 1];
      const glow = Math.min(pg[e], pg[e + 1]);
      // normal of the ribbon: perpendicular to the leg and to the line of sight
      let nx = (by - ay) * az - (bz - az) * ay;
      let ny = (bz - az) * ax - (bx - ax) * az;
      let nz = (bx - ax) * ay - (by - ay) * ax;
      const nlen = Math.hypot(nx, ny, nz) || 1;
      nx = (nx / nlen) * half;
      ny = (ny / nlen) * half;
      nz = (nz / nlen) * half;
      const base = (e >> 1) * 8;
      const push = (slot, x, y, z) => {
        linePositions.setXYZ(base + slot, x, y, z);
        lineGlow.setX(base + slot, glow);
      };
      push(0, ax - nx, ay - ny, az - nz);
      push(1, ax, ay, az);
      push(2, bx, by, bz);
      push(3, bx - nx, by - ny, bz - nz);
      push(4, ax, ay, az);
      push(5, ax + nx, ay + ny, az + nz);
      push(6, bx + nx, by + ny, bz + nz);
      push(7, bx, by, bz);
    }
    linePositions.needsUpdate = true;
    lineGlow.needsUpdate = true;
  }

}


// Meteors are a per-frame animation, so they cannot live inside the 20 s sky
// rebuild: a streak that lasts 0.6 s would advance twice and die unseen. The
// clock is also the animation clock, not the wall clock: Date/1000 is about 1.7e9,
// which reads as "spawned long ago" and makes every frame a first frame.
function updateMeteors(layer, seconds, dt) {
  if (!layer || !layer.meteor) return;
  const meteor = layer.meteor;
  const meteorPositions = layer.meteorLine.geometry.getAttribute('position');
  const meteorHeadPositions = layer.meteorHead.geometry.getAttribute('position');
  const elapsed = seconds;
  if (meteor.active) {
    meteor.elapsed += dt;
    const progress = Math.min(1, meteor.elapsed / meteor.duration);
    // head runs along the path, tail trails it by a fraction of the whole run
    const head = meteor.from.clone().lerp(meteor.to, progress);
    const tail = meteor.from.clone().lerp(meteor.to, Math.max(0, progress - meteor.tail));
    meteorPositions.setXYZ(0, tail.x, tail.y, tail.z);
    meteorPositions.setXYZ(1, head.x, head.y, head.z);
    meteorPositions.needsUpdate = true;
    meteorHeadPositions.setXYZ(0, head.x, head.y, head.z);
    meteorHeadPositions.needsUpdate = true;
    // a fade in and out, scaled by how hot this particular streak is
    uMeteorGlow.value = layer.starsOpacity * Math.sin(progress * Math.PI) * 2.9 * meteor.power * meteorBright;
    if (progress >= 1) {
      meteor.active = false;
      meteor.next = elapsed + (2.2 + Math.random() * 4.5) / meteorRate;
      uMeteorGlow.value = 0;
    }
  } else {
    uMeteorGlow.value = 0;
    if (elapsed > meteor.next && layer.starsOpacity > 0.2 && meteorEnabled) {
      // Spawn inside the slice of sky the camera actually shows. Picking the
      // azimuth uniformly put four out of five streaks behind the viewer, which
      // read as "meteors never render".
      const startAzDeg = (Math.random() * 2 - 1) * 30;
      const startAltDeg = 13 + Math.random() * 20;
      // one in eight is a fireball: longer, brighter, slower to burn out
      const fireball = Math.random() < 0.12;
      const travelDeg = fireball ? 16 : 10 + Math.random() * 12;
      const driftDeg = (Math.random() * 2 - 1) * 12;
      skyPoint(startAzDeg, startAltDeg, meteor.from);
      skyPoint(startAzDeg + driftDeg, Math.max(4, startAltDeg - travelDeg), meteor.to);
      meteor.active = true;
      meteor.elapsed = 0;
      meteor.duration = 0.55 + Math.random() * 0.6;
      meteor.tail = fireball ? 0.34 : 0.18;
      meteor.power = fireball ? 2.1 : 1;
      meteorHeadPositions.setXYZ(0, meteor.from.x, meteor.from.y, meteor.from.z);
      meteorHeadPositions.needsUpdate = true;
    }
  }
}

boot();
