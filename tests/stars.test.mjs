// Run directly with `node tests/stars.test.mjs` — this machine cannot spawn the
// per-file workers that `node --test tests/` needs (EPERM).

import test from 'node:test'
import assert from 'node:assert/strict'
import { CONSTELLATION_LINES } from '../shared/stars-data.js'
import { STAR_CATALOG } from '../shared/stars-catalog.js'
import { constellationVertices } from '../shared/sky-astro.js'

const DEG = Math.PI / 180

// Great-circle separation in degrees; per-axis differences would overstate the
// error near the pole, which is exactly where Polaris lives.
function separation(raA, decA, raB, decB) {
  const d = Math.sin(decA * DEG) * Math.sin(decB * DEG)
    + Math.cos(decA * DEG) * Math.cos(decB * DEG) * Math.cos((raA - raB) * DEG)
  return Math.acos(Math.min(1, Math.max(-1, d))) / DEG
}

test('every constellation entry is well formed', () => {
  assert.ok(CONSTELLATION_LINES.length >= 88, `polylines ${CONSTELLATION_LINES.length}`)
  for (const line of CONSTELLATION_LINES) {
    assert.equal(typeof line.name, 'string')
    assert.ok(line.name.length > 0)
    assert.ok(Array.isArray(line.points) && line.points.length >= 2, `${line.name} too short`)
    for (const [ra, dec] of line.points) {
      assert.ok(Number.isFinite(ra) && ra >= 0 && ra < 360, `${line.name} ra ${ra}`)
      assert.ok(Number.isFinite(dec) && dec >= -90 && dec <= 90, `${line.name} dec ${dec}`)
    }
  }
})

test('all 88 constellations are present exactly once by name', () => {
  const names = [...new Set(CONSTELLATION_LINES.map(l => l.name))]
  assert.equal(names.length, 88, names.join(','))
  // Spot-check the abbreviations were expanded to full IAU names.
  for (const expected of ['Ursa Major', 'Ursa Minor', 'Orion', 'Canis Major',
    'Andromeda', 'Cygnus', 'Lyra', 'Scorpius', 'Crux', 'Triangulum Australe']) {
    assert.ok(names.includes(expected), `missing ${expected}`)
  }
  // 'Ara' and 'Leo' are simultaneously full names and IAU abbreviations, so a
  // bare blacklist cannot work; the positive list above carries the check.
})

test('coordinates are rounded to 2 decimals', () => {
  for (const line of CONSTELLATION_LINES) {
    for (const [ra, dec] of line.points) {
      assert.ok(Math.abs(ra * 100 - Math.round(ra * 100)) < 1e-9, `${line.name} ra ${ra}`)
      assert.ok(Math.abs(dec * 100 - Math.round(dec * 100)) < 1e-9, `${line.name} dec ${dec}`)
    }
  }
})

test('known stars sit on a vertex of their line figure within 0.2 deg', () => {
  const vertices = constellationVertices(CONSTELLATION_LINES)
  const stars = [
    ['Polaris', 37.95, 89.26],
    ['Sirius', 101.29, -16.72],
    ['Betelgeuse', 88.79, 7.41],
    ['Vega', 279.23, 38.78]
  ]
  for (const [name, ra, dec] of stars) {
    let best = Infinity
    for (const v of vertices) {
      const sep = separation(ra, dec, v.raDeg, v.decDeg)
      if (sep < best) best = sep
    }
    assert.ok(best < 0.2, `${name} nearest vertex is ${best.toFixed(3)} deg away`)
  }
})

test('line figures cover both hemispheres and the whole RA range', () => {
  const points = CONSTELLATION_LINES.flatMap(l => l.points)
  const ras = points.map(p => p[0])
  const decs = points.map(p => p[1])
  assert.ok(Math.min(...ras) < 10 && Math.max(...ras) > 350)
  assert.ok(Math.min(...decs) < -70 && Math.max(...decs) > 85)
})

test('the catalogue carries real magnitudes and a usable colour index', () => {
  assert.ok(STAR_CATALOG.length > 2500, `catalogue ${STAR_CATALOG.length}`)
  let prev = -Infinity
  let cool = 0
  let warm = 0
  for (const row of STAR_CATALOG) {
    assert.equal(row.length, 4, `row ${row}`)
    const [ra, dec, mag, bv] = row
    assert.ok(ra >= 0 && ra < 360, `ra ${ra}`)
    assert.ok(dec >= -90 && dec <= 90, `dec ${dec}`)
    assert.ok(mag >= -1.5 && mag <= 5.5, `mag ${mag}`)
    assert.ok(bv >= -0.4 && bv <= 2.4, `bv ${bv}`)
    assert.ok(mag >= prev - 1e-9, 'the catalogue is sorted brightest first')
    prev = mag
    if (bv < 0.2) cool += 1
    if (bv > 1.2) warm += 1
  }
  // a real sky has both ends of the spectral range, not one grey colour
  assert.ok(cool > 200, `blue stars ${cool}`)
  assert.ok(warm > 100, `orange stars ${warm}`)
  // Sirius is the brightest entry, Vega is in there, and both sit where the
  // ephemeris expects them
  const sirius = STAR_CATALOG[0]
  assert.ok(sirius[2] < -1.3, `brightest ${sirius[2]}`)
  assert.ok(separation(sirius[0], sirius[1], 101.29, -16.72) < 0.1)
  const vega = STAR_CATALOG.find((r) => separation(r[0], r[1], 279.23, 38.78) < 0.1)
  assert.ok(vega && vega[2] < 0.2, `Vega ${vega && vega[2]}`)
})
