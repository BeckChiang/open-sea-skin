import test from 'node:test'
import assert from 'node:assert/strict'
import {
  skyFromElevation, manualElevationDeg, manualAzimuthDeg,
  NIGHT, DEEP_NIGHT, DUSK, DAY, NIGHT_FULL_DEG, DAY_FULL_DEG, TWILIGHT_DEG,
} from '../shared/sky.js'

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const closeRGB = (got, want, eps = 1e-9) =>
  got.every((v, i) => close(v, want[i], eps))

// Every palette component the shader reads, as one distance.
const paletteDistance = (a, b) => {
  let total = 0
  for (const key of ['zenith', 'horizon', 'deep', 'shallow']) {
    for (let i = 0; i < 3; i += 1) total += Math.abs(a[key][i] - b[key][i])
  }
  return total
}

test('night stays neutral black, not blue', () => {
  for (const el of [-90, -60, -30]) {
    const sky = skyFromElevation(el);
    for (const key of ['zenith', 'horizon']) {
      const c = sky[key];
      const ratio = Math.max(...c) / Math.max(1e-6, Math.min(...c));
      assert.ok(ratio < 1.9, `${key} at ${el}° should be near neutral, ratio ${ratio.toFixed(2)}`);
    }
  }
})

test('deep night is NIGHT, not dusk (regression: 21:00 looked like sunset)', () => {
  const sky = skyFromElevation(-57.7)
  assert.equal(sky.horizonF, 0)
  assert.equal(sky.dayF, 0)
  // Below astronomical twilight the sun keeps sinking, so the palette keeps
  // easing towards DEEP_NIGHT instead of freezing on NIGHT.
  assert.ok(sky.nightF < 0.5, 'midnight must sit deeper than the twilight night')
  for (const key of ['zenith', 'horizon', 'deep', 'shallow']) {
    sky[key].forEach((v, i) => {
      const lo = Math.min(DEEP_NIGHT[key][i], NIGHT[key][i])
      const hi = Math.max(DEEP_NIGHT[key][i], NIGHT[key][i])
      assert.ok(v >= lo - 1e-12 && v <= hi + 1e-12, `${key}[${i}] must sit between deep night and night`)
    })
  }
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

test('high sun is daylight', () => {
  const sky = skyFromElevation(45)
  assert.equal(sky.horizonF, 1)
  assert.equal(sky.dayF, 1)
  // 45° is past noon in most latitudes: the palette sits between DAY and the
  // noon shift, never further than a hair from either.
  closeRGB(sky.zenith, DAY.zenith, 0.06)
  closeRGB(sky.horizon, DAY.horizon, 0.06)
  closeRGB(sky.sun, DAY.sun.map((v) => v * DAY.sunIntensity), 0.06)
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

test('ambient light dims clouds at night but not in daylight', () => {
  assert.equal(skyFromElevation(-57.7).skyLight, 0.04)
  assert.ok(skyFromElevation(0).skyLight > 0.4 && skyFromElevation(0).skyLight < 0.7)
  assert.equal(skyFromElevation(45).skyLight, 1)
  let prev = -1
  for (let elev = -18; elev <= 12; elev += 1) {
    const value = skyFromElevation(elev).skyLight
    assert.ok(value >= prev - 1e-9, `skyLight dropped at ${elev}°`)
    prev = value
  }
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

// 1.5.23 · the sky used to be static for ~15 hours a day: DAY saturated at +12°
// and NIGHT at −18°, so only the 9-hour sunset window ever moved. These tests
// pin the two ends shut.
const channelStep = (a, b) => {
  let max = 0
  for (const key of ['zenith', 'horizon', 'deep', 'shallow']) {
    for (let i = 0; i < 3; i += 1) max = Math.max(max, Math.abs(a[key][i] - b[key][i]))
  }
  return max
}

test('no palette pop: the fastest minute of the day moves one channel by < 0.03', () => {
  // The sun moves at most ~0.25° of elevation per minute; that is the sampling
  // step. A larger step than this is the hard switch the panel used to show.
  let prev = skyFromElevation(-90)
  for (let elev = -89.75; elev <= 90; elev += 0.25) {
    const sky = skyFromElevation(elev)
    const step = channelStep(prev, sky)
    assert.ok(step < 0.03, `palette jumped ${step.toFixed(4)} at ${elev.toFixed(2)}°`)
    prev = sky
  }
})

test('the afternoon is no longer frozen on DAY', () => {
  // 20° -> 35° of sun is about one hour at Shanghai's latitude.
  assert.ok(channelStep(skyFromElevation(20), skyFromElevation(35)) > 0.004,
    'the midday palette must keep drifting')
})

test('the night is no longer frozen on NIGHT', () => {
  // Two hours past astronomical twilight the sky keeps easing towards the deep
  // night palette instead of snapping to one colour for the whole night.
  assert.ok(channelStep(skyFromElevation(-25), skyFromElevation(-60)) > 0.004,
    'the night palette must still respond to the sun sink')
})

test('twilight is its own axis: warm band, belt of Venus, earth shadow, airglow', () => {
  const sunset = skyFromElevation(-0.5)
  const civil = skyFromElevation(TWILIGHT_DEG.civil)
  const night = skyFromElevation(-25)
  const day = skyFromElevation(20)
  // 晚霞 peaks at sunset, is gone by the end of nautical twilight, and never
  // rides on the midnight horizon.
  assert.equal(sunset.twilight.warm, 1)
  assert.equal(night.twilight.warm, 0)
  assert.equal(day.twilight.warm, 0)
  // The band sits lower and wider as the sun goes down.
  assert.ok(sunset.twilight.bandHeight > civil.twilight.bandHeight)
  // Belt of Venus peaks shortly after sunset, on the anti-solar side.
  assert.ok(skyFromElevation(-3).twilight.belt > sunset.twilight.belt)
  // Earth shadow is a wedge that rises through civil twilight.
  assert.ok(sunset.twilight.shadow > civil.twilight.shadow)
  // Airglow only lights the deep night.
  assert.equal(sunset.airglow, 0)
  assert.equal(day.airglow, 0)
  assert.equal(night.airglow, 1)
  // Nothing above the boundary may be negative (a shader term would invert).
  for (let elev = -30; elev <= 30; elev += 0.5) {
    const { warm, belt, shadow } = skyFromElevation(elev).twilight
    for (const v of [warm, belt, shadow]) assert.ok(v >= 0 && v <= 1, `twilight term out of range at ${elev}°`)
  }
})
