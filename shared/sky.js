// Sky palettes as a pure function of the sun elevation (degrees).
//
// Why this exists: open-sea-skin 1.2.7 only had DAY and DUSK palettes and drove
// them from a 720 s sine loop, so the darkest state it could render was DUSK —
// at 21:00 you still saw a sunset. Here the palette is a function of the real
// solar elevation with a third NIGHT palette, and DUSK sits exactly at the
// horizon so the original sunset look is preserved.
//
// No three.js dependency: imported by the renderer and unit tested directly.

export const NIGHT = {
  zenith: [0.004, 0.008, 0.026],
  horizon: [0.012, 0.03, 0.075],
  sun: [0.0, 0.0, 0.0],
  sunIntensity: 0,
  deep: [0.002, 0.008, 0.018],
  shallow: [0.006, 0.022, 0.04],
};

export const DUSK = {
  zenith: [0.03, 0.05, 0.16],
  horizon: [0.85, 0.36, 0.16],
  sun: [1.0, 0.42, 0.14],
  sunIntensity: 2.6,
  deep: [0.02, 0.045, 0.075],
  shallow: [0.09, 0.15, 0.2],
};

export const DAY = {
  zenith: [0.07, 0.2, 0.42],
  horizon: [0.52, 0.68, 0.82],
  sun: [1.0, 0.93, 0.8],
  sunIntensity: 1.6,
  deep: [0.015, 0.09, 0.11],
  shallow: [0.06, 0.32, 0.36],
};

// Elevation at which the sky is fully night / fully day.
export const NIGHT_FULL_DEG = -18;
export const DAY_FULL_DEG = 12;

const lerp = (a, b, t) => a + (b - a) * t;

export function smoothstep01(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const mix3 = (night, dusk, day, horizonF, dayF) => [
  lerp(lerp(night[0], dusk[0], horizonF), day[0], dayF),
  lerp(lerp(night[1], dusk[1], horizonF), day[1], dayF),
  lerp(lerp(night[2], dusk[2], horizonF), day[2], dayF),
];

/**
 * @param {number} elevationDeg sun elevation above the horizon, degrees
 * @returns {{horizonF:number, dayF:number, zenith:number[], horizon:number[],
 *   deep:number[], shallow:number[], sun:number[], sunIntensity:number,
 *   skyLight:number}}
 */
export function skyFromElevation(elevationDeg) {
  const horizonF = smoothstep01(NIGHT_FULL_DEG, 0, elevationDeg);
  const dayF = smoothstep01(0, DAY_FULL_DEG, elevationDeg);
  const sunIntensity = lerp(lerp(NIGHT.sunIntensity, DUSK.sunIntensity, horizonF), DAY.sunIntensity, dayF);
  // how much ambient light reaches clouds / foam: 0.04 at deep night, 0.55 at
  // the horizon, 1 in full daylight
  const skyLight = lerp(0.04, lerp(0.55, 1, dayF), horizonF);
  const sunRGB = mix3(NIGHT.sun, DUSK.sun, DAY.sun, horizonF, dayF);
  return {
    horizonF,
    dayF,
    sunIntensity,
    skyLight,
    zenith: mix3(NIGHT.zenith, DUSK.zenith, DAY.zenith, horizonF, dayF),
    horizon: mix3(NIGHT.horizon, DUSK.horizon, DAY.horizon, horizonF, dayF),
    deep: mix3(NIGHT.deep, DUSK.deep, DAY.deep, horizonF, dayF),
    shallow: mix3(NIGHT.shallow, DUSK.shallow, DAY.shallow, horizonF, dayF),
    sun: [sunRGB[0] * sunIntensity, sunRGB[1] * sunIntensity, sunRGB[2] * sunIntensity],
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
