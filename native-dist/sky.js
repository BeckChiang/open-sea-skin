// Sky palettes as a pure function of the sun elevation (degrees).
//
// Why this exists: open-sea-skin 1.2.7 only had DAY and DUSK palettes and drove
// them from a 720 s sine loop, so the darkest state it could render was DUSK —
// at 21:00 you still saw a sunset. Here the palette is a function of the real
// solar elevation with a third NIGHT palette, and DUSK sits exactly at the
// horizon so the original sunset look is preserved.
//
// 1.5.23 · continuity. The old curve froze twice a day: DAY saturated at +12°
// (08:00–16:00 identical) and NIGHT at −18° (all night identical), so the sky
// changed only during ~9 hours of the 24. Two extra ramps fix that: DEEP_NIGHT
// keeps the night breathing with the sun's depth, DAY_HIGH adds a slow noon
// shift on top of the day ramp, and the twilight is its own axis (warm band,
// belt of Venus, earth shadow, airglow) instead of one gated term.
//
// No three.js dependency: imported by the renderer and unit tested directly.

// Starlit night. The sea keeps enough lift to stay legible as water (the moon
// sheen in ocean.js is what makes it read as a surface); the horizon carries a
// faint airglow. Both stay >10x darker than DUSK — see tests/sky.test.mjs.
export const NIGHT = {
  zenith: [0.006, 0.012, 0.032],
  horizon: [0.016, 0.042, 0.1],
  sun: [0.0, 0.0, 0.0],
  sunIntensity: 0,
  deep: [0.01, 0.024, 0.045],
  shallow: [0.024, 0.055, 0.085],
};

// Below astronomical twilight the sun is far enough down that even the last
// scattered light is gone; only airglow and the Milky Way keep the sky from
// being a flat black plate.
export const DEEP_NIGHT = {
  zenith: [0.0035, 0.0055, 0.011],
  horizon: [0.008, 0.015, 0.028],
  sun: [0.0, 0.0, 0.0],
  sunIntensity: 0,
  deep: [0.006, 0.012, 0.02],
  shallow: [0.012, 0.024, 0.038],
};

// Sunset: orange on the horizon under a violet-blue zenith. The warm band that
// the sky shader adds toward the sun is what turns this into 晚霞; the palette
// only supplies the room it sits in.
export const DUSK = {
  zenith: [0.05, 0.055, 0.22],
  horizon: [0.9, 0.34, 0.13],
  sun: [1.0, 0.40, 0.12],
  sunIntensity: 2.6,
  deep: [0.02, 0.045, 0.075],
  shallow: [0.09, 0.15, 0.2],
};

// Daytime: a saturated blue instead of the old grey-blue. The horizon was
// [0.52, 0.68, 0.82] — nearly desaturated — which is why a cloudy noon looked
// like fog rather than sky.
export const DAY = {
  zenith: [0.045, 0.20, 0.58],
  horizon: [0.36, 0.60, 0.90],
  sun: [1.0, 0.93, 0.8],
  sunIntensity: 1.6,
  deep: [0.012, 0.085, 0.12],
  shallow: [0.05, 0.34, 0.42],
};

// Noon: the sun is high, the Rayleigh path through the atmosphere is shortest,
// so the zenith deepens and the horizon loses its wash. Only a slow hue shift —
// brightness is already at its ceiling by +12°.
export const DAY_HIGH = {
  zenith: [0.032, 0.165, 0.55],
  horizon: [0.40, 0.63, 0.91],
  sun: [1.0, 0.96, 0.88],
  sunIntensity: 1.85,
  deep: [0.010, 0.075, 0.115],
  shallow: [0.045, 0.31, 0.40],
};

// Elevation at which the sky is fully night / fully day, and the extra ramps.
export const NIGHT_FULL_DEG = -18;
export const DAY_FULL_DEG = 12;
// The night and the noon ramps run over these spans (degrees of sun elevation).
export const DEEP_NIGHT_SPAN_DEG = [-90, NIGHT_FULL_DEG];
export const DAY_HIGH_SPAN_DEG = [0, 90];
export const TWILIGHT_DEG = { civil: -6, nautical: -12, astronomical: NIGHT_FULL_DEG };

const lerp = (a, b, t) => a + (b - a) * t;

export function smoothstep01(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// A smooth bump that is 0 outside [a, b] and 1 at `peak`: one rise, one fall,
// both with zero slope at the ends, so a shader term driven by it never pops.
export function bump(x, a, peak, b) {
  if (x <= a || x >= b) return 0;
  return x <= peak ? smoothstep01(a, peak, x) : 1 - smoothstep01(peak, b, x);
}

// deep night -> night -> dusk -> day -> noon, each stop with its own ramp.
const stops = (deep, night, dusk, day, noon, nightF, horizonF, dayF, dayHue) => [0, 1, 2].map((k) => {
  const nightMix = lerp(deep[k], night[k], nightF);
  const duskMix = lerp(nightMix, dusk[k], horizonF);
  const dayMix = lerp(duskMix, day[k], dayF);
  return lerp(dayMix, noon[k], dayHue * dayF);
});

/**
 * @param {number} elevationDeg sun elevation above the horizon, degrees
 * @returns {{
 *   horizonF:number, dayF:number, dayHue:number, nightF:number, skyLight:number,
 *   zenith:number[], horizon:number[], deep:number[], shallow:number[],
 *   sun:number[], sunIntensity:number,
 *   twilight:{warm:number, bandHeight:number, belt:number, shadow:number},
 *   airglow:number
 * }}
 */
export function skyFromElevation(elevationDeg) {
  const el = elevationDeg;
  // 0 at deep night, 1 from astronomical twilight up: the old night ramp.
  const horizonF = smoothstep01(NIGHT_FULL_DEG, 0, el);
  // 0 at the horizon, 1 in daylight: brightness ramp, unchanged in meaning.
  const dayF = smoothstep01(0, DAY_FULL_DEG, el);
  // 0 at the horizon, 1 with the sun overhead: the slow noon hue shift.
  const dayHue = smoothstep01(DAY_HIGH_SPAN_DEG[0], DAY_HIGH_SPAN_DEG[1], el);
  // 0 at deep night, 1 just below astronomical twilight: the night ramp.
  const nightF = smoothstep01(DEEP_NIGHT_SPAN_DEG[0], DEEP_NIGHT_SPAN_DEG[1], el);

  const sunIntensity = lerp(
    lerp(NIGHT.sunIntensity, DUSK.sunIntensity, horizonF),
    lerp(DAY.sunIntensity, DAY_HIGH.sunIntensity, dayHue),
    dayF,
  );
  // How much ambient light reaches clouds, foam and the sea surface. One smooth
  // curve instead of a nested lerp: the old form dropped 0.5 -> 0.14 in the last
  // 20 minutes before sunset, which read as a hard switch.
  const skyLight = lerp(0.04, 1, smoothstep01(NIGHT_FULL_DEG, DAY_FULL_DEG, el));

  const zenith = stops(DEEP_NIGHT.zenith, NIGHT.zenith, DUSK.zenith, DAY.zenith, DAY_HIGH.zenith, nightF, horizonF, dayF, dayHue);
  const horizon = stops(DEEP_NIGHT.horizon, NIGHT.horizon, DUSK.horizon, DAY.horizon, DAY_HIGH.horizon, nightF, horizonF, dayF, dayHue);
  const deep = stops(DEEP_NIGHT.deep, NIGHT.deep, DUSK.deep, DAY.deep, DAY_HIGH.deep, nightF, horizonF, dayF, dayHue);
  const shallow = stops(DEEP_NIGHT.shallow, NIGHT.shallow, DUSK.shallow, DAY.shallow, DAY_HIGH.shallow, nightF, horizonF, dayF, dayHue);

  const sunRGB = [0, 1, 2].map((k) =>
    lerp(lerp(lerp(NIGHT.sun[k], DUSK.sun[k], horizonF), DAY.sun[k], dayF), DAY_HIGH.sun[k], dayHue * dayF));

  // Twilight is its own axis. Each term is a bump in sun elevation, so it fades
  // in and out smoothly and can never sit on the horizon at midnight.
  const twilight = {
    // 晚霞: the warm wash on the sun's side, peaking at the moment of sunset.
    warm: bump(el, -14, -0.5, 7),
    // Where the band sits, in degrees of altitude: low and wide at dusk.
    bandHeight: lerp(3.2, 7.5, smoothstep01(-14, -0.5, el)),
    // Belt of Venus: the pink band opposite the sun just after sunset.
    belt: bump(el, -16, -3, 2.5),
    // Earth shadow: the blue-grey wedge that rises opposite the sun.
    shadow: bump(el, -9, -1.5, 3.5),
  };
  // Airglow: the faint glow that keeps a moonless sky from being flat black.
  const airglow = 1 - smoothstep01(-16, -4, el);

  return {
    horizonF,
    dayF,
    dayHue,
    nightF,
    skyLight,
    sunIntensity,
    zenith,
    horizon,
    deep,
    shallow,
    sun: [sunRGB[0] * sunIntensity, sunRGB[1] * sunIntensity, sunRGB[2] * sunIntensity],
    twilight,
    airglow,
  };
}

// Manual slider / legacy cycle: t 0..1 spans deep night -> sunset -> midday.
export const MANUAL_MIN_ELEVATION_DEG = NIGHT_FULL_DEG;
export const MANUAL_MAX_ELEVATION_DEG = 60;
export const MANUAL_MIN_AZIMUTH_DEG = -52;
export const MANUAL_MAX_AZIMUTH_DEG = 52;

export function manualElevationDeg(t) {
  return lerp(MANUAL_MIN_ELEVATION_DEG, MANUAL_MAX_ELEVATION_DEG, t);
}

export function manualAzimuthDeg(t) {
  return lerp(MANUAL_MIN_AZIMUTH_DEG, MANUAL_MAX_AZIMUTH_DEG, t);
}
