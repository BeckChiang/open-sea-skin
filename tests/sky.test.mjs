import test from 'node:test'
import assert from 'node:assert/strict'
import {
  skyFromElevation, manualElevationDeg, manualAzimuthDeg,
  NIGHT, DUSK, DAY, NIGHT_FULL_DEG,
} from '../shared/sky.js'

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const closeRGB = (got, want, eps = 1e-9) =>
  got.every((v, i) => close(v, want[i], eps))

test('deep night is NIGHT, not dusk (regression: 21:00 looked like sunset)', () => {
  const sky = skyFromElevation(-57.7)
  assert.equal(sky.horizonF, 0)
  assert.equal(sky.dayF, 0)
  closeRGB(sky.zenith, NIGHT.zenith)
  closeRGB(sky.horizon, NIGHT.horizon)
  closeRGB(sky.deep, NIGHT.deep)
  closeRGB(sky.shallow, NIGHT.shallow)
  assert.equal(sky.sunIntensity, 0)
  assert.deepEqual(sky.sun, [0, 0, 0])
})

test('night palette is much darker than the dusk palette', () => {
  const night = skyFromElevation(-40)
  const dusk = skyFromElevation(0)
  const luma = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
  assert.ok(luma(night.horizon) < luma(dusk.horizon) / 10, 'horizon must be >10x darker at night')
  assert.ok(luma(night.zenith) < luma(dusk.zenith) / 3, 'zenith must be at least 3x darker at night')
})

test('the horizon is exactly DUSK (1.2.7 sunset look is preserved)', () => {
  const sky = skyFromElevation(0)
  assert.equal(sky.horizonF, 1)
  assert.equal(sky.dayF, 0)
  closeRGB(sky.zenith, DUSK.zenith)
  closeRGB(sky.horizon, DUSK.horizon)
  closeRGB(sky.deep, DUSK.deep)
  closeRGB(sky.shallow, DUSK.shallow)
  assert.equal(sky.sunIntensity, DUSK.sunIntensity)
})

test('high sun is exactly DAY', () => {
  const sky = skyFromElevation(45)
  assert.equal(sky.horizonF, 1)
  assert.equal(sky.dayF, 1)
  closeRGB(sky.zenith, DAY.zenith)
  closeRGB(sky.horizon, DAY.horizon)
  closeRGB(sky.sun, DAY.sun.map((v) => v * DAY.sunIntensity))
})

test('brightness rises monotonically with sun elevation', () => {
  const luma = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
  let prev = -1
  for (let elev = NIGHT_FULL_DEG; elev <= 30; elev += 1) {
    const value = luma(skyFromElevation(elev).horizon)
    assert.ok(value >= prev - 1e-9, `horizon luma dropped at ${elev}°`)
    prev = value
  }
})

test('sun light fades out below the horizon and is gone at full night', () => {
  // intensity is highest at the horizon (dusk 2.6) and eases to the midday
  // value (1.6): the palette gets warmer and dimmer as the sun climbs.
  assert.ok(skyFromElevation(2).sunIntensity > skyFromElevation(10).sunIntensity)
  assert.ok(skyFromElevation(10).sunIntensity > 0)
  // civil twilight just under the horizon still glows (glow, cloud tint and
  // water specular all read uSunColor); the sun disc itself is below the water.
  assert.ok(skyFromElevation(-1).sunIntensity > 0)
  // intensity peaks right at the horizon and only leaves dusk's value below it
  assert.ok(skyFromElevation(-1).sunIntensity <= DUSK.sunIntensity + 1e-9)
  assert.ok(skyFromElevation(-10).sunIntensity < DUSK.sunIntensity)
  // nothing left once the sky is fully night
  assert.equal(skyFromElevation(NIGHT_FULL_DEG).sunIntensity, 0)
  assert.equal(skyFromElevation(-57.7).sunIntensity, 0)
})

test('manual slider spans night -> sunset -> day', () => {
  assert.equal(manualElevationDeg(0), NIGHT_FULL_DEG)
  assert.equal(manualElevationDeg(1), 60)
  // sunset (0°) lands near the low third of the slider, as the panel hint says
  const tAtSunset = (0 - NIGHT_FULL_DEG) / (60 - NIGHT_FULL_DEG)
  assert.ok(tAtSunset > 0.2 && tAtSunset < 0.35)
  const sky = skyFromElevation(manualElevationDeg(0))
  closeRGB(sky.zenith, NIGHT.zenith)
  assert.ok(manualAzimuthDeg(0) < 0 && manualAzimuthDeg(1) > 0)
})

test('colours stay in a sane 0..~1 range', () => {
  for (let elev = -90; elev <= 90; elev += 5) {
    const sky = skyFromElevation(elev)
    for (const key of ['zenith', 'horizon', 'deep', 'shallow', 'sun']) {
      for (const v of sky[key]) {
        assert.ok(Number.isFinite(v), `${key} not finite at ${elev}°`)
        assert.ok(v >= 0 && v <= 5, `${key} out of range at ${elev}°: ${v}`)
      }
    }
  }
})
