// Run directly with `node tests/sky-astro.test.mjs` — this machine cannot spawn
// the per-file workers that `node --test tests/` needs (EPERM).

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  localSiderealTime,
  equatorialToHorizontal,
  constellationVertices,
  starBrightnessFromDegree
} from '../shared/sky-astro.js'
import { CONSTELLATION_LINES } from '../shared/stars-data.js'

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps

// Independent restatement of the GMST polynomial, so the module is checked
// against a second implementation rather than against itself.
function gmstDeg(date) {
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000
  const t = d / 36525
  const raw = 280.46061837 + 360.98564736629 * d
    + 0.000387933 * t * t - (t * t * t) / 38710000
  return ((raw % 360) + 360) % 360
}

const WUHAN = { lat: 30.59, lon: 114.31 }

test('localSiderealTime matches GMST + longitude', () => {
  const when = new Date('2026-11-05T13:45:00Z')
  const expected = ((gmstDeg(when) + WUHAN.lon) % 360 + 360) % 360
  const actual = localSiderealTime(when, WUHAN.lon)
  assert.ok(close(actual, expected, 0.05), `${actual} vs ${expected}`)
})

test('localSiderealTime wraps into 0..360 for any longitude', () => {
  const when = new Date('2026-11-05T13:45:00Z')
  for (const lon of [-179.9, -60, 0, 114.31, 179.9, 300, 360]) {
    const lst = localSiderealTime(when, lon)
    assert.ok(lst >= 0 && lst < 360, `lon ${lon} -> ${lst}`)
  }
  assert.ok(close(
    localSiderealTime(when, 114.31),
    localSiderealTime(when, 114.31 - 360),
    1e-9
  ))
})

test('localSiderealTime advances ~360.99 deg per solar day', () => {
  const a = localSiderealTime(new Date('2026-11-05T13:45:00Z'), 0)
  const b = localSiderealTime(new Date('2026-11-06T13:45:00Z'), 0)
  assert.ok(close(((b - a) % 360 + 360) % 360, 0.98564736629, 0.01))
})

test('equatorialToHorizontal: at the pole altitude equals declination', () => {
  for (const dec of [-60, -17, 0, 7.4, 45, 89.26]) {
    const { altDeg } = equatorialToHorizontal(123.4, dec, 90, 27.7)
    assert.ok(close(altDeg, dec, 1e-9), `dec ${dec} -> ${altDeg}`)
  }
})

test('equatorialToHorizontal: LST = RA at the equator puts a dec=0 star overhead', () => {
  const { altDeg, azDeg } = equatorialToHorizontal(200, 0, 0, 200)
  assert.ok(close(altDeg, 90, 1e-9), `alt ${altDeg}`)
  assert.ok(Number.isFinite(azDeg), 'azimuth must stay finite at the zenith')
})

test('equatorialToHorizontal: azimuth is 0=N, 90=E, 180=S, 270=W', () => {
  const lat = 45
  // Due south: on the meridian from a mid-northern latitude, dec below zenith.
  assert.ok(close(equatorialToHorizontal(100, 0, lat, 100).azDeg, 180, 1e-6))
  // Due north: on the meridian but circumpolar.
  assert.ok(close(equatorialToHorizontal(100, 70, lat, 100).azDeg, 0, 1e-6))
  // Due east: setting/rising on the celestial equator, 6 sidereal hours off.
  assert.ok(close(equatorialToHorizontal(100, 0, lat, 10).azDeg, 90, 1e-6))
  assert.ok(close(equatorialToHorizontal(100, 0, lat, 190).azDeg, 270, 1e-6))
})

test('equatorialToHorizontal: altitude is the polar distance from the zenith', () => {
  // At lat 30.59 a star on the meridian at dec -16.72 culminates at 90-|lat-dec|.
  const { altDeg } = equatorialToHorizontal(101.29, -16.72, WUHAN.lat, 101.29)
  assert.ok(close(altDeg, 90 - Math.abs(WUHAN.lat - -16.72), 1e-6), `alt ${altDeg}`)
})

test('Sirius over Wuhan on 2026-11-05 21:45 CST is still below the horizon', () => {
  // 21:45 CST = 13:45 UTC. The task brief expected alt 10..30 here, but the
  // geometry says otherwise: Sirius transits around 04:07 CST at alt 42.7 and
  // rises near 22:49 CST, so at 21:45 it sits ~13 deg under the eastern horizon.
  const when = new Date('2026-11-05T13:45:00Z')
  const lst = localSiderealTime(when, WUHAN.lon)
  const { altDeg, azDeg } = equatorialToHorizontal(101.29, -16.72, WUHAN.lat, lst)
  assert.ok(close(altDeg, -13.39, 0.5), `alt ${altDeg}`)
  assert.ok(close(azDeg, 101.7, 0.5), `az ${azDeg}`)
})

test('Sirius is up in the south-east a couple of hours later', () => {
  // 00:15 CST on the 6th, i.e. 16:15 UTC on the 5th — the window the brief
  // described actually starts about two hours after the stated instant.
  const when = new Date('2026-11-05T16:15:00Z')
  const lst = localSiderealTime(when, WUHAN.lon)
  const { altDeg, azDeg } = equatorialToHorizontal(101.29, -16.72, WUHAN.lat, lst)
  assert.ok(altDeg > 10 && altDeg < 30, `alt ${altDeg}`)
  assert.ok(azDeg > 100 && azDeg < 140, `az ${azDeg}`)
})

test('constellationVertices dedupes to a plausible star count', () => {
  const vertices = constellationVertices(CONSTELLATION_LINES)
  assert.ok(vertices.length > 600 && vertices.length < 1200, `got ${vertices.length}`)
  for (const v of vertices) {
    assert.ok(v.raDeg >= 0 && v.raDeg < 360, `ra ${v.raDeg}`)
    assert.ok(v.decDeg >= -90 && v.decDeg <= 90, `dec ${v.decDeg}`)
    assert.ok(Number.isInteger(v.degree) && v.degree >= 1, `degree ${v.degree}`)
  }
  // Every unique vertex touched at least one segment, so degrees sum to 2*segments.
  const segments = CONSTELLATION_LINES.reduce((n, l) => n + l.points.length - 1, 0)
  const total = vertices.reduce((n, v) => n + v.degree, 0)
  assert.equal(total, 2 * segments)
})

test('constellationVertices merges a duplicated vertex across polylines', () => {
  const lines = [
    { name: 'A', points: [[10, 20], [11, 20], [12, 20]] },
    { name: 'B', points: [[12.01, 20], [13, 21]] }
  ]
  const vertices = constellationVertices(lines)
  assert.equal(vertices.length, 4)
  const joint = vertices.find(v => close(v.raDeg, 12, 0.05))
  assert.equal(joint.degree, 2) // one segment from each polyline meets here
})

test('starBrightnessFromDegree rises from 0.35 to 1.0', () => {
  assert.ok(close(starBrightnessFromDegree(1), 0.35, 1e-9))
  assert.ok(close(starBrightnessFromDegree(3), 0.7, 1e-9))
  assert.ok(close(starBrightnessFromDegree(5), 1, 1e-9))
  assert.equal(starBrightnessFromDegree(9), 1)
  let previous = -1
  for (let d = 1; d <= 8; d += 0.25) {
    const b = starBrightnessFromDegree(d)
    assert.ok(b >= previous, `not monotonic at ${d}`)
    assert.ok(b >= 0 && b <= 1, `out of range at ${d}`)
    previous = b
  }
})
