// Unit tests for shared/solar.js — run with `node --test tests/`.
// All instants are given as explicit UTC offsets so the suite is timezone-proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sunTimes,
  sunPosition,
  moonPosition,
  daylightFromElevation,
  cloudCoverOf,
  starLevelOf,
  starIntensityOf,
} from '../shared/solar.js';

const SHANGHAI = { lat: 31.23, lon: 121.47 };
const at = (iso) => new Date(iso);

test('sun: 2026-11-05 12:00 Beijing time over Shanghai', () => {
  const sun = sunPosition(at('2026-11-05T12:00:00+08:00'), SHANGHAI.lat, SHANGHAI.lon);
  assert.ok(
    sun.elevationDeg >= 38 && sun.elevationDeg <= 44,
    `elevation ${sun.elevationDeg.toFixed(2)}° outside 38–44°`
  );
  assert.ok(
    sun.azimuthDeg >= 165 && sun.azimuthDeg <= 195,
    `azimuth ${sun.azimuthDeg.toFixed(2)}° outside 165–195°`
  );
});

test('sun: summer solstice high, winter solstice low (Shanghai noon)', () => {
  const june = sunPosition(at('2026-06-21T12:00:00+08:00'), SHANGHAI.lat, SHANGHAI.lon);
  const december = sunPosition(at('2026-12-21T12:00:00+08:00'), SHANGHAI.lat, SHANGHAI.lon);
  assert.ok(june.elevationDeg > 75, `June elevation ${june.elevationDeg.toFixed(2)}° should exceed 75°`);
  assert.ok(december.elevationDeg < 40, `December elevation ${december.elevationDeg.toFixed(2)}° should stay below 40°`);
});

test('sun: midnight is deep night and maps to zero daylight', () => {
  const midnight = sunPosition(at('2026-11-05T00:00:00+08:00'), SHANGHAI.lat, SHANGHAI.lon);
  assert.ok(midnight.elevationDeg < -40, `midnight elevation ${midnight.elevationDeg.toFixed(2)}° should be below -40°`);
  assert.equal(daylightFromElevation(midnight.elevationDeg), 0);
});

test('sun: an instant is timezone-independent', () => {
  const utc = sunPosition(at('2026-11-05T04:00:00Z'), SHANGHAI.lat, SHANGHAI.lon);
  const bjs = sunPosition(at('2026-11-05T12:00:00+08:00'), SHANGHAI.lat, SHANGHAI.lon);
  assert.equal(utc.elevationDeg, bjs.elevationDeg);
  assert.equal(utc.azimuthDeg, bjs.azimuthDeg);
});

test('sun: southern hemisphere noon sits opposite in azimuth', () => {
  // Sydney in late June: sun in the north, ~33° up.
  const sun = sunPosition(at('2026-06-21T02:00:00Z'), -33.87, 151.21);
  assert.ok(sun.elevationDeg > 20 && sun.elevationDeg < 40, `Sydney elevation ${sun.elevationDeg.toFixed(2)}°`);
  assert.ok(sun.azimuthDeg < 30 || sun.azimuthDeg > 330, `Sydney noon azimuth ${sun.azimuthDeg.toFixed(2)}° should be near north`);
});

test('moon: a real full-moon night is bright', () => {
  // 2026-10-26 and 2026-11-24 are full moons (verified with the same ephemeris:
  // phase01 ≈ 0.51 / 0.50, illuminated fraction ≈ 1.0).
  for (const iso of ['2026-10-26T22:00:00+08:00', '2026-11-24T22:00:00+08:00']) {
    const moon = moonPosition(at(iso), SHANGHAI.lat, SHANGHAI.lon);
    assert.ok(moon.brightness > 0.5, `${iso} brightness ${moon.brightness.toFixed(3)} should exceed 0.5`);
    assert.equal(moon.brightness, moon.illuminated, 'visibility should be 1 when the moon is high');
  }
});

test('moon: 2026-11-05 is a waning crescent, not mid-month (brief assumption corrected)', () => {
  // The task brief calls 2026-11-05 "农历月中附近"; the ephemeris says otherwise:
  // new moon falls on 2026-11-09 (phase01 ≈ 0.012), so 2026-11-05 is ~4 days
  // before new moon. Documented here so the deviation is visible, not silent.
  const moon = moonPosition(at('2026-11-05T12:00:00+08:00'), SHANGHAI.lat, SHANGHAI.lon);
  assert.ok(moon.phase01 > 0.75, `phase01 ${moon.phase01.toFixed(3)} should be late in the cycle`);
  assert.ok(moon.brightness < 0.25, `brightness ${moon.brightness.toFixed(3)} should be low for a crescent`);

  const newMoon = moonPosition(at('2026-11-09T22:00:00+08:00'), SHANGHAI.lat, SHANGHAI.lon);
  assert.ok(newMoon.illuminated < 0.05, `2026-11-09 illuminated ${newMoon.illuminated.toFixed(3)} should be near zero`);
});

test('moon: phase advances monotonically through one synodic month', () => {
  // 2026-10-10 is a new moon: walk the following 29 days at constant local time.
  let previous = -1;
  for (let day = 0; day <= 29; day += 1) {
    const when = new Date(Date.UTC(2026, 9, 10, 14, 0, 0) + day * 86400000);
    const { phase01 } = moonPosition(when, SHANGHAI.lat, SHANGHAI.lon);
    assert.ok(phase01 > previous, `phase01 went backwards on day ${day} (${phase01} after ${previous})`);
    previous = phase01;
  }
});

test('moon: below the horizon means no brightness', () => {
  const moon = moonPosition(at('2026-12-21T12:00:00+08:00'), SHANGHAI.lat, SHANGHAI.lon);
  assert.ok(moon.elevationDeg < 0, 'sanity: the moon is down at this instant');
  assert.equal(moon.brightness, 0);
});

test('daylightFromElevation follows the contract curve', () => {
  assert.equal(daylightFromElevation(-4), 0);
  assert.equal(daylightFromElevation(40), 100);
  assert.equal(daylightFromElevation(-30), 0);
  assert.equal(daylightFromElevation(90), 100);
  assert.ok(Math.abs(daylightFromElevation(18) - 50) < 1e-9, 'half-way elevation should be 50');
  assert.ok(daylightFromElevation(0) > daylightFromElevation(-3), 'curve must be monotonic');
});

test('cloud and star level maps match the contract', () => {
  assert.deepEqual(
    ['off', 'low', 'mid', 'high'].map(cloudCoverOf),
    [0.15, 0.35, 0.55, 0.8]
  );
  assert.deepEqual(
    ['off', 'low', 'mid', 'high'].map(starLevelOf),
    [0, 0.33, 0.66, 1]
  );
  assert.equal(cloudCoverOf(undefined), 0.55, 'unknown levels fall back to mid');
  assert.equal(starLevelOf('nope'), 0.66, 'unknown levels fall back to mid');
});

test('starIntensityOf matches the contract formula', () => {
  // clamp(-elev / 8, 0, 1) * starLevel * (1 - 0.65 * moonBrightness)
  assert.equal(starIntensityOf(10, 'high', 0), 0);
  assert.ok(Math.abs(starIntensityOf(-8, 'high', 0) - 1) < 1e-9);
  assert.ok(Math.abs(starIntensityOf(-20, 'mid', 0) - 0.66) < 1e-9);
  assert.ok(Math.abs(starIntensityOf(-8, 'high', 1) - 0.35) < 1e-9);
  assert.equal(starIntensityOf(-8, 'off', 1), 0);
});

test('sunrise and sunset follow the coordinates', () => {
  const day = new Date('2026-11-06T16:00:00+08:00')
  const wuhan = sunTimes(day, 30.59, 114.31)
  const harbin = sunTimes(day, 45.75, 126.63)
  assert.ok(wuhan.riseMinutes !== null && wuhan.setMinutes !== null)
  // 06:46 / 17:28 in Wuhan on 2026-11-06
  assert.ok(Math.abs(wuhan.riseMinutes - 406) <= 2, 'wuhan sunrise near 06:46, got ' + wuhan.riseMinutes)
  assert.ok(Math.abs(wuhan.setMinutes - 1048) <= 2, 'wuhan sunset near 17:28, got ' + wuhan.setMinutes)
  // A northern city rises later in absolute minutes and sets earlier.
  assert.ok(harbin.setMinutes < wuhan.setMinutes, 'harbin must set before wuhan')
})
