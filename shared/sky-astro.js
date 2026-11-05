// ============================================================================
//  OPEN SEA — star / constellation maths for the night sky
//  Pure functions, no three.js dependency: unit-tested with `node --test tests/`.
//
//  Algorithms: IAU-1982 GMST simplification (Meeus, ch. 12, ~1 s accuracy over
//  two centuries around J2000) and the usual spherical horizon transform.
//  Precision is far beyond what a shader-drawn star field can show.
//
//  All angles are degrees unless the name says otherwise. Time comes from the
//  Date's UTC instant; nothing here depends on the host's local timezone.
// ============================================================================

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DAY_MS = 86400000;

const mod = (value, span) => ((value % span) + span) % span;

// Sidereal day is ~3 min 56 s shorter than a solar day, hence the 360.9856
// deg/day rate; the polynomial terms keep the result within a second.
export function localSiderealTime(date, lonDeg = 0) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  const d = (ms - J2000_MS) / DAY_MS;
  const t = d / 36525;
  const gmst = 280.46061837 + 360.98564736629 * d
    + 0.000387933 * t * t - (t * t * t) / 38710000;
  return mod(gmst + lonDeg, 360);
}

// Azimuth uses the atan2 form so that lat=+-90 deg stays finite instead of
// dividing by cos(lat); at the poles the azimuth is geometrically undefined but
// callers still get a usable number rather than NaN.
export function equatorialToHorizontal(raDeg, decDeg, latDeg, lstDeg) {
  const dec = decDeg * DEG;
  const lat = latDeg * DEG;
  const hourAngle = (lstDeg - raDeg) * DEG;
  const sinAlt = Math.sin(dec) * Math.sin(lat)
    + Math.cos(dec) * Math.cos(lat) * Math.cos(hourAngle);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(
    -Math.cos(dec) * Math.sin(hourAngle),
    Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(hourAngle)
  );
  return { altDeg: alt * RAD, azDeg: mod(az * RAD, 360) };
}

// Two decimals of a degree is already below the line width of a stick figure,
// so vertices closer than this are the same star drawn twice by two polylines.
const VERTEX_EPS = 0.05;

const unitVector = (raDeg, decDeg) => {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
};

// Dedupe on angular separation, not per-axis, so vertices do not survive just
// because they straddle a rounding boundary of either coordinate.
export function constellationVertices(lines) {
  const vertices = [];
  const vectors = [];
  const cosEps = Math.cos(VERTEX_EPS * DEG);
  const index = new Map();

  const findOrAdd = (raDeg, decDeg) => {
    const v = unitVector(raDeg, decDeg);
    for (let i = 0; i < vertices.length; i += 1) {
      const u = vectors[i];
      if (u[0] * v[0] + u[1] * v[1] + u[2] * v[2] >= cosEps) return i;
    }
    vertices.push({ raDeg, decDeg, degree: 0 });
    vectors.push(v);
    return vertices.length - 1;
  };

  for (const line of lines) {
    const points = line.points || line;
    const ids = points.map(([ra, dec]) => {
      const key = `${Math.round(ra * 100)}|${Math.round(dec * 100)}`;
      const cached = index.get(key);
      if (cached !== undefined) return cached;
      const id = findOrAdd(ra, dec);
      index.set(key, id);
      return id;
    });
    // Degree counts segments touching a vertex: a mid-chain star is brighter
    // than a loose end, which is what the eye reads in a stick figure.
    for (let i = 1; i < ids.length; i += 1) {
      const a = ids[i - 1];
      const b = ids[i];
      if (a === b) continue;
      vertices[a].degree += 1;
      vertices[b].degree += 1;
    }
  }

  return vertices;
}

// Piecewise linear through (1, 0.35), (3, 0.7), (5, 1.0): sparse chain ends
// stay visible while junctions saturate, so the dimmest stars never vanish.
export function starBrightnessFromDegree(degree) {
  if (!(degree > 1)) return 0.35;
  if (degree >= 5) return 1;
  if (degree <= 3) return 0.35 + (degree - 1) * 0.175;
  return 0.7 + (degree - 3) * 0.15;
}
