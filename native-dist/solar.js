// ============================================================================
//  OPEN SEA — sun & moon maths
//  Pure functions, no three.js dependency: unit-tested with `node --test tests/`.
//
//  Algorithms: low-precision NOAA solar position (mean longitude + equation of
//  centre + GMST) and mean lunar elements (Meeus, Astronomical Algorithms,
//  ch. 25/47, truncated). Sun error ~0.02°, moon error a few tenths of a degree
//  — plenty for a sky background, far below the shader's angular resolution.
//
//  All angles are degrees unless the name says otherwise. Time comes from the
//  Date's UTC instant; nothing here depends on the host's local timezone.
// ============================================================================

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000 = 2451545.0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mod = (value, span) => ((value % span) + span) % span;

function julianDay(date) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  return ms / 86400000 + 2440587.5;
}

// Sun ecliptic longitude (radians) and obliquity for `n` days past J2000.
function sunEcliptic(n) {
  const meanLongitude = mod(280.460 + 0.9856474 * n, 360);
  const meanAnomaly = mod(357.528 + 0.9856003 * n, 360) * DEG;
  const lambda = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.020 * Math.sin(2 * meanAnomaly)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  return { lambda, eps };
}

// Ecliptic (lambda, beta) -> equatorial (ra, dec), both in radians.
function toEquatorial(lambda, beta, eps) {
  const x = Math.cos(beta) * Math.cos(lambda);
  const y = Math.cos(beta) * Math.sin(lambda);
  const z = Math.sin(beta);
  return {
    ra: Math.atan2(y * Math.cos(eps) - z * Math.sin(eps), x),
    dec: Math.asin(y * Math.sin(eps) + z * Math.cos(eps)),
  };
}

// Topocentric horizontal coordinates. Azimuth is 0° = north, 90° = east.
function horizontal(ra, dec, n, latDeg, lonDeg) {
  const gmst = mod(18.697374558 + 24.06570982441908 * n, 24); // hours
  const lst = gmst * 15 + lonDeg; // degrees
  const hourAngle = (mod(lst - ra * RAD + 180, 360) - 180) * DEG;
  const lat = latDeg * DEG;
  const sinElevation = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  const elevationDeg = Math.asin(clamp(sinElevation, -1, 1)) * RAD;
  const azimuthDeg = mod(
    Math.atan2(-Math.sin(hourAngle), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(hourAngle)) * RAD,
    360
  );
  return { elevationDeg, azimuthDeg };
}

/**
 * Apparent sun position for an instant and a place.
 * @param {Date|number} date
 * @param {number} [latDeg] degrees, north positive
 * @param {number} [lonDeg] degrees, east positive
 * @returns {{ elevationDeg: number, azimuthDeg: number }}
 */
export function sunPosition(date, latDeg = 31.23, lonDeg = 121.47) {
  const n = julianDay(date) - J2000;
  const { lambda, eps } = sunEcliptic(n);
  const { ra, dec } = toEquatorial(lambda, 0, eps);
  return horizontal(ra, dec, n, latDeg, lonDeg);
}

/**
 * Low-precision moon position, phase and brightness.
 * phase01: 0 = new moon, 0.5 = full moon, 1 = new moon again.
 * brightness: illuminated fraction of the disc x how far the moon is above the
 * horizon (0 when it is below it), matching contract §2.2.
 * @param {Date|number} date
 * @param {number} [latDeg]
 * @param {number} [lonDeg]
 * @returns {{ elevationDeg: number, azimuthDeg: number, phase01: number, brightness: number,
 *            illuminated: number, elongationDeg: number }}
 */
export function moonPosition(date, latDeg = 31.23, lonDeg = 121.47) {
  const n = julianDay(date) - J2000;
  const { lambda: sunLambda, eps } = sunEcliptic(n);
  const meanLongitude = mod(218.316 + 13.176396 * n, 360);
  const meanAnomaly = mod(134.963 + 13.064993 * n, 360) * DEG;
  const argumentOfLatitude = mod(93.272 + 13.229350 * n, 360) * DEG;
  const lambda = (meanLongitude + 6.289 * Math.sin(meanAnomaly)) * DEG;
  const beta = 5.128 * Math.sin(argumentOfLatitude) * DEG;
  const { ra, dec } = toEquatorial(lambda, beta, eps);
  const { elevationDeg, azimuthDeg } = horizontal(ra, dec, n, latDeg, lonDeg);

  const elongationDeg = mod(lambda * RAD - sunLambda * RAD, 360);
  const illuminated = (1 - Math.cos(elongationDeg * DEG)) / 2;
  const visibility = clamp((elevationDeg + 2) / 10, 0, 1);
  return {
    elevationDeg,
    azimuthDeg,
    phase01: elongationDeg / 360,
    brightness: illuminated * visibility,
    illuminated,
    elongationDeg,
  };
}

/** Contract §2.2: sun elevation -> the legacy 0–100 daylight value. */
// Sunrise and sunset in local minutes of the day, found by walking the same
// sunPosition() the sky is drawn from: no separate ephemeris, so the moment the
// palette turns cannot disagree with the moment the panel prints.
// Returns nulls during polar day or polar night.
export function sunTimes(date, latDeg = 30.59, lonDeg = 114.31) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  let riseMinutes = null;
  let setMinutes = null;
  let prev = sunPosition(day, latDeg, lonDeg).elevationDeg;
  for (let minutes = 1; minutes <= 1440; minutes += 1) {
    const at = new Date(day.getTime() + minutes * 60000);
    const elevation = sunPosition(at, latDeg, lonDeg).elevationDeg;
    if (riseMinutes === null && prev < 0 && elevation >= 0) riseMinutes = minutes;
    if (setMinutes === null && prev >= 0 && elevation < 0) setMinutes = minutes;
    prev = elevation;
    if (riseMinutes !== null && setMinutes !== null) break;
  }
  return { riseMinutes, setMinutes };
}

// Twilight boundaries, found the same way as sunTimes(): walk one day once and
// record where the sun crosses each of the three standard depths. One pass for
// all six numbers, and the panel prints exactly the instants the palette uses.
export const TWILIGHT_LEVELS = Object.freeze({ civil: -6, nautical: -12, astronomical: -18 });

export function twilightTimes(date, latDeg = 30.59, lonDeg = 114.31) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const depths = Object.entries(TWILIGHT_LEVELS);
  const result = {};
  for (const [name] of depths) result[name] = { dawnMinutes: null, duskMinutes: null };
  let pending = depths.length * 2;
  let prev = sunPosition(day, latDeg, lonDeg).elevationDeg;
  for (let minutes = 1; minutes <= 1440 && pending > 0; minutes += 1) {
    const elevation = sunPosition(new Date(day.getTime() + minutes * 60000), latDeg, lonDeg).elevationDeg;
    for (const [name, depth] of depths) {
      const slot = result[name];
      if (slot.dawnMinutes === null && prev < depth && elevation >= depth) {
        slot.dawnMinutes = minutes;
        pending -= 1;
      }
      if (slot.duskMinutes === null && prev >= depth && elevation < depth) {
        slot.duskMinutes = minutes;
        pending -= 1;
      }
    }
    prev = elevation;
  }
  return result;
}

export function daylightFromElevation(elevationDeg) {
  return clamp((elevationDeg + 4) / 44, 0, 1) * 100;
}

const CLOUD_COVER = { off: 0.15, low: 0.35, mid: 0.55, high: 0.8 };
const STAR_LEVEL = { off: 0, low: 0.33, mid: 0.66, high: 1 };

/**
 * Contract §2.2 cloud档位 -> uCloudCover.
 * 1.5.23: a number is a percentage (0..100), so the panel can slide it. The
 * legacy letters keep working for a profile saved by an older build.
 */
export function cloudCoverOf(level) {
  if (isDial(level, CLOUD_COVER)) return clamp(Number(level) / 100, 0.02, 0.95);
  return Object.prototype.hasOwnProperty.call(CLOUD_COVER, level) ? CLOUD_COVER[level] : CLOUD_COVER.mid;
}

/** Contract §2.2 星空档位 -> starLevel multiplier. */
export function starLevelOf(level) {
  if (isDial(level, STAR_LEVEL)) {
    // 100% is the old 'mid' look, so an upgraded profile looks unchanged.
    return clamp(Number(level) / 100, 0, 2) * STAR_LEVEL.mid;
  }
  return Object.prototype.hasOwnProperty.call(STAR_LEVEL, level) ? STAR_LEVEL[level] : STAR_LEVEL.mid;
}

// 1.5.23: the panel sends percentages; a letter from an older profile is still a
// letter, and anything else must fall through to the 'mid' default.
function isDial(level, table) {
  if (typeof level === 'number') return Number.isFinite(level);
  return typeof level === 'string' && !(level in table) && Number.isFinite(Number(level));
}

/**
 * Contract §2.2 star intensity:
 * clamp(-elevationDeg / 8, 0, 1) * starLevel * (1 - 0.65 * moonBrightness).
 */
export function starIntensityOf(elevationDeg, level, moonBrightness) {
  const night = clamp(-elevationDeg / 8, 0, 1);
  const moonFade = 1 - 0.65 * clamp(moonBrightness, 0, 1);
  return night * starLevelOf(level) * moonFade;
}
