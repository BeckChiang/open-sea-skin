// Guards against the failure mode that turned the whole skin into a white
// canvas on 2026-11-05: module-level sections had been spliced into the middle
// of boot(), so their `const`s were still in the temporal dead zone when boot()
// ran, and the animation loop died before it ever presented a frame.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'shared', 'ocean.js'), 'utf8')
const lines = source.split('\n')

const indexOf = (needle) => lines.findIndex((line) => line.includes(needle))

// the last non-blank, non-comment line above a section banner: at module scope
// it must be the closing brace of the previous top-level function, never an
// indented statement belonging to boot()
const previousCodeLine = (bannerIndex) => {
  for (let i = bannerIndex - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (line.trim() === '' || line.trim().startsWith('//')) continue
    return line
  }
  return ''
}

for (const banner of ['SECTION 10 · FLEET', 'SECTION 11 · STAR DOME']) {
  test(`${banner} starts at module scope, not inside boot()`, () => {
    const at = indexOf(banner)
    assert.ok(at > 0, `${banner} banner must exist`)
    assert.equal(lines[at - 1].trim().startsWith('//'), true, 'banner must sit inside its own rule')
    assert.equal(previousCodeLine(at - 1), '}', `${banner} must follow a top-level closing brace`)
  })
}

test('boat and star state is declared at module scope', () => {
  const names = [
    'BOAT_MAX', 'BOAT_BASE', 'BOAT_MIN_SEP', 'boatTarget', 'boatShown', 'boatFade',
    'boatCamera', 'boatCruise', 'boatPlaced', 'boatAxes',
    'starLayer', 'STAR_RADIUS', 'uStarGlow', 'uMeteorGlow',
    'createBoats', 'updateBoats', 'createStarLayer', 'updateStarDome',
  ]
  const isTopLevel = (name) => lines.some((line) => (
    line.startsWith(`const ${name} `)
    || line.startsWith(`const ${name}=`)
    || line.startsWith(`let ${name} `)
    || line.startsWith(`let ${name}=`)
    || line.startsWith(`function ${name}(`)
  ))
  for (const name of names) {
    assert.ok(isTopLevel(name), `${name} must be declared at the top level of shared/ocean.js`)
  }
})

test('star layer hides the meteor line behind a distinct key', () => {
  // `meteor` was declared twice in the same object literal, so the state machine
  // shadowed the Line and updateStarDome() threw on the very first frame
  assert.ok(source.includes('meteorLine: meteor,'), 'the meteor Line needs its own key')
  assert.ok(source.includes('layer.meteorLine.geometry'), 'updateStarDome must read meteorLine')
})

test('per-frame layer updates cannot kill the render loop', () => {
  assert.ok(source.includes("console.warn('[open-sea-skin] boats disabled'"))
  assert.ok(source.includes("console.warn('[open-sea-skin] star dome disabled'"))
})

test('boat speed is driven by the swell, not by the clock', () => {
  // A boat that orbits at a fixed angular speed reads as a toy on rails: the
  // pace has to come from the sea state and from the slope it is sailing on.
  assert.ok(source.includes('lane.speed * cruise * lane.surge'), 'the orbit angle must integrate the swell factors')
  assert.equal(source.includes('lane.phase + time * lane.speed'), false, 'no constant-clock orbit left behind')
  assert.ok(source.includes('BOAT_PROBE'), 'the slope probe distance must exist')
  assert.ok(source.includes('surge: 1'), 'each lane needs its own surge state')
})

test('the sea level is followed over time, not snapped on every message', () => {
  // The parent posts the level a few times a second; assigning uSea straight from
  // the message turns a slow swell into a staircase, so the surface chases a goal.
  assert.ok(source.includes('uSea.value += (seaGoal - uSea.value) * (1 - Math.exp(-dt / SEA_FOLLOW_TAU))'))
  assert.equal(source.includes('uSea.value = 0.25 + (sea / 100) * 1.5'), false, 'the message handler must set the goal only')
  assert.ok(source.includes('let seaGoal = uSea.value;'), 'the goal needs module-level state')
})
