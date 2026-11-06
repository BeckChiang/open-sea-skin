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
    'BOAT_MAX', 'BOAT_BASE', 'BOAT_MIN_SEP', 'boatTarget', 'boatShown',
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

test('boats enter and leave across the frame edge, by the nearer side', () => {
  // Entrances used to start at a fixed 26 units, which is inside the frame on a
  // wide window, so hulls appeared mid-screen; the offset now comes from the
  // camera frustum at the boat's own depth.
  assert.ok(source.includes('boatApproachOffset(ahead)'), 'the off-stage offset must be derived from the view')
  assert.equal(source.includes('BOAT_APPROACH'), false, 'no fixed approach distance left behind')
  assert.ok(source.includes('lane.away = (lane.exitFrom || lane.side) * offStage'), 'a hull is parked past the edge before it is drawn')
  assert.ok(
    source.includes('lane.exitSide = Math.sign(laneAcross + lane.away) || lane.side'),
    'a departure must pick the edge the hull is actually nearer to',
  )
  assert.ok(source.includes('lane.shown = false'), 'the hull is dropped only once it is outside the frame')
})

test('the sun is aimed where the fixed camera can see it', () => {
  // A true compass sun is behind the camera all afternoon and above the frame at
  // noon, so the wallpaper showed no sun at all; the dome is squeezed into view.
  assert.ok(source.includes('viewElevation(sun.elevationDeg)'), 'the disc elevation must be mapped into the frame')
  assert.ok(source.includes('viewAzimuth(sun.azimuthDeg)'), 'the disc azimuth must be mapped into the frame')
  assert.ok(source.includes('skyFromElevation(elevationDeg)'), 'the palette still comes from the real elevation')
  assert.ok(source.includes('VIEW_AZ_HALF'), 'the squeeze needs a named span')
})

test('altitude stays real until it would leave the frame', () => {
  // Folding the whole 0..90° arc into 1.5..24.5° made every noon look like the
  // same afternoon. Only the part that does not fit is squeezed now, and the
  // camera gives up a slice of sea so the upper band is actually visible.
  assert.ok(source.includes('if (elDeg <= VIEW_EL_REAL_MAX) return elDeg'), 'the real altitude must pass through')
  assert.ok(source.includes('const VIEW_PITCH_DEG = 8'), 'the horizon must leave a third of the frame for the sea')
  assert.ok(source.includes('VIEW_EL_TOP - VIEW_EL_REAL_MAX'), 'only the overflow is compressed')
  assert.ok(
    source.includes('controls.target.set(0, camera.position.y + Math.tan(VIEW_PITCH_DEG * DEG) * 17, 0)'),
    'the tilt must live in controls.target: camera.rotation is overwritten by update()',
  )
  assert.ok(!source.includes('camera.rotation.x = 8 * DEG'), 'a rotation set here is silently discarded')
  assert.ok(source.includes('controls.autoRotate = !REDUCED_MOTION && !SKIN'), 'skin mode must not drift the sky')
  assert.ok(source.includes('controls.maxPolarAngle = Math.PI * 0.62'), 'looking up must not be clamped away')
})

test('hulls keep their distance', () => {
  assert.ok(source.includes('const BOAT_MIN_SEP = 7;'), 'separation must scale with the hull')
})

test('the constellations and the meteors are real settings', () => {
  // The sky used to be procedural only; it now draws the actual 88 constellations,
  // so how strongly they read has to be a dial instead of a compile-time constant.
  assert.ok(source.includes("constellationSetting = d.constellation"), 'the constellation grade must come from settings')
  assert.ok(source.includes('uConstellation'), 'the line material needs the dial uniform')
  assert.ok(source.includes('uMoonPhaseCos'), 'the moon disc must be shaped by the real phase')
  assert.ok(source.includes('&& meteorEnabled'), 'meteors must be switchable off')
  assert.ok(source.includes('moonPhase01,'), 'the panel needs the phase read back from the sky')
})

// --- 2026-11-06 evening round ------------------------------------------------
// Three separate regressions, each with a shape that is easy to reintroduce.

const clientSource = readFileSync(join(here, '..', 'plugin', 'client.js'), 'utf8')

test('lane berths sit under the horizon, not on the bottom edge', () => {
  // With the 8 degree pitch the sea only fills the lower third of the frame, so
  // the old 15..25 unit berths put the hulls at 84-97% of the height: "the boats
  // are too close to the bottom". Berths moved out and the hull grew to match.
  assert.ok(source.includes('const base = 19.5 + (index % 3) * 1.6'), 'berths must stay inside the open water below the chat column')
  assert.ok(source.includes('boatDummy.scale.setScalar(2.7)'), 'the hull must stay big enough to read through the glass')
})

test('boats off is the switch, not a zero count', () => {
  // count 0 used to be posted as `off`, so a session without subagents lost even
  // the one hull the copy promises.
  assert.ok(
    clientSource.includes('const shown = enabled ? Math.max(1, count) : 0;'),
    'a zero count must still keep the base boat',
  )
  assert.ok(clientSource.includes('off: !enabled'), 'only the switch may turn the fleet off')
})

test('the translucent tokens stay inside #root so body portals stay opaque', () => {
  // Hover cards, tooltips and dialogs are body-level portals. While the tokens sat
  // on body they inherited the glass fill and the "changed files" preview became
  // unreadable glass.
  assert.ok(clientSource.includes('body #root,'), 'the glass tokens must be scoped to #root')
  assert.ok(
    !/body \{\s*background: transparent !important;\s*--dsw-alias-bg-base/s.test(clientSource),
    'the tokens must not be declared on body again',
  )
  assert.ok(!clientSource.includes('data-hovercard-bridge'), 'no per-portal patch: the scope fix covers all of them')
})

test('a spend above the full-wave threshold still moves the sea', () => {
  // log1p(yuan)/log1p(amountFull) exceeds 1 once the session spends more than the
  // threshold. The panel used to post e.g. 105, the frame rejected anything over
  // 100, and a ¥12 session stayed flat forever.
  assert.ok(
    clientSource.includes('target = Math.max(0, Math.min(100, target));'),
    'the host must clamp the wave target before posting it',
  )
  assert.ok(
    source.includes('Math.max(0, Math.min(100, sea))'),
    'the frame must clamp the sea level instead of dropping the message',
  )
  assert.ok(!source.includes('sea >= 0 && sea <= 100'), 'a hard range check must not reject the update')
})

test('a missing metrics bridge is reported instead of silently flat', () => {
  // A dead bridge and a session that never spent look identical from the water:
  // both leave the wave engine reading nothing. The panel must be able to say so.
  assert.ok(clientSource.includes('waveBridgeNone'), 'the panel needs a bridge-not-mounted label')
  assert.ok(clientSource.includes('this.count += 1'), 'the store must count pushes so the panel can report them')
  assert.ok(clientSource.includes('__openSeaSkinBridgeState'), 'the mount result must be readable by the panel')
  assert.ok(clientSource.includes('describeSlots'), 'the reason a bridge is missing must be named')
  assert.ok(!clientSource.includes("require('react')"), 'the bridge must not depend on the loader resolving react')
})

test('the panel readouts can see the id helper', () => {
  // 2026-11-06: pid() lived inside mountUi, so every readout thrown from the
  // wave tick died with "pid is not defined" and the panel silently stayed
  // blank - the wave never moved either, because the throw aborted the tick.
  const at = clientSource.indexOf('const pid = (suffix)')
  assert.ok(at > 0, 'the id helper must exist')
  assert.equal(clientSource.indexOf('const pid = (suffix)', at + 1), -1, 'declare it exactly once')
  const controller = clientSource.indexOf('function createController')
  assert.ok(controller > 0 && at < controller, 'the helper must sit outside createController')
  const mount = clientSource.indexOf('const mountUi')
  assert.ok(mount > at, 'the helper must be declared before the panel builder uses it')
})

test('the surface reports its state back to the panel', () => {
  // 2026-11-06: readOceanState() used a frame snapshot captured before the iframe
  // existed, so every readout stayed blank. The frame now posts its state, and the
  // panel re-queries the element and accepts the posted copy.
  assert.ok(clientSource.includes("event.data") || clientSource.includes("data.type !== 'oss-state'"), 'the panel must listen for the posted state')
  assert.ok(clientSource.includes("document.getElementById(IDS.frame)"), 'the panel must re-query the frame, not a stale snapshot')
  assert.ok(clientSource.includes('return lastOceanState'), 'the posted copy must be the fallback')
  assert.ok(source.includes("type: 'oss-state'"), 'the frame must post its state')
  assert.ok(source.includes('STATE_POST_MS'), 'the report must be throttled')
})

test('a session switch settles before it reshapes the fleet', () => {
  // 2026-11-06: flipping through the sidebar posted every intermediate roster,
  // so hulls were recalled and dropped mid-stride. A switch only counts once the
  // user rests on it, and a recalled hull re-enters by the edge it left.
  assert.ok(clientSource.includes('FLEET_SETTLE_MS'), 'the settle window must be named')
  assert.ok(clientSource.includes('now >= fleetSettleAt'), 'the poll must wait for the switch to settle')
  assert.ok(!clientSource.includes('fleetAt = 0;\n        void pollFleet();'), 'a switch must not poll immediately')
  assert.ok(source.includes('lane.exitFrom || lane.side'), 'a recalled hull must re-enter by the edge it left')
  assert.ok(source.includes('lane.exitFrom = lane.exitSide'), 'the leaving edge must be remembered')
})

test('hulls roam the whole frame and report where they land', () => {
  // 2026-11-06: steering hulls into the strips the page left uncovered put two of
  // them off the visible edges. The sea spans the whole frame now, and each hull
  // publishes its own screen position so "drawn but not seen" can be read, not
  // guessed at.
  assert.ok(!clientSource.includes('measureBands'), 'the page must not probe the layout for hulls')
  assert.ok(!source.includes('applyBandsMessage'), 'no layout message may reach the lanes')
  assert.ok(source.includes('const laneAcross = berth * halfWidth;'), 'each hull keeps its own berth across the open water')
  assert.ok(source.includes('boatSpots.push(['), 'each hull must report its screen position')
  assert.ok(source.includes('boatSpots: boatSpots.slice(0, 6),'), 'the report must reach the state')
  assert.ok(source.includes('span: 0.62 + (index % 3) * 0.05'), 'each hull must sweep the visible width')
  assert.ok(source.includes('const berth = Math.max(-0.78, Math.min(0.78,'), 'the sweep must stop at the frame edge')
  assert.ok(clientSource.includes('.map((spot) =>'), 'the panel must print the positions')
})

test('the cross on every constellation vertex is a real setting', () => {
  // 2026-11-06: the constellation lines looked like a bare grid because the
  // endpoints were one-pixel dots. Each vertex now carries a twinkling cross,
  // and the panel decides how loud it is.
  assert.ok(clientSource.includes("cross: 'mid',"), 'the setting must have a default')
  assert.ok(clientSource.includes("segRow(pid('cross'), 'crossStars', gradeOptions)"), 'the panel must offer the grades')
  assert.ok(clientSource.includes("case pid('cross'): return { cross: value };"), 'the grade must reach the state')
  assert.ok(clientSource.includes('cross: state.cross,'), 'the grade must travel to the sky')
  assert.ok(source.includes('const CROSS_GRADES = Object.freeze({ off: 0, low: 0.55, mid: 1, high: 1.75 });'), 'the sky must hold four grades')
  assert.ok(source.includes("if (SKY_LEVELS.indexOf(d.cross) >= 0) crossSetting = d.cross;"), 'the message must set the grade')
  assert.ok(source.includes('.mul(uStarGlow).mul(uCrossGlow)'), 'the cross must obey the grade')
  assert.ok(source.includes('const armLength = STAR_RADIUS * 0.0042'), 'the grade must also grow the arms')
  assert.ok(source.includes('cross: crossSetting,'), 'the grade must be readable from the state')
})

test('a saved grade survives normalize, and nothing spawns outside the frame', () => {
  // 2026-11-06 evening: three separate "I set it and nothing happened" reports.
  // 1) the cross grade was in DEFAULTS but not in normalize(), so each save threw
  //    it away again; 2) hulls could dip below the bottom edge (y > 1.0 in the
  //    reported spots); 3) meteors spawned over the whole sky, most of them
  //    behind the camera.
  assert.ok(clientSource.includes('cross: GRADE_LEVELS.includes(source.cross) ? source.cross : DEFAULTS.cross,'), 'the cross grade must survive a save')
  assert.ok(source.includes('const ahead = Math.max(17.5, Math.min(24, lane.base + Math.cos(angle) * lane.radiusBack));'), 'every hull must stay inside the visible water band')
  assert.ok(source.includes('const startAzDeg = (Math.random() * 2 - 1) * 30;'), 'meteors must spawn in the visible azimuth slice')
  assert.ok(source.includes('const startAltDeg = 13 + Math.random() * 20;'), 'meteors must spawn below the top of the frame')
  assert.ok(source.includes('skyPoint(startAzDeg, startAltDeg, meteor.from);'), 'the streak must use the shared sky helper')
  assert.ok(source.includes('Math.sin(progress * Math.PI) * 2.6'), 'the streak must be bright enough to notice')
})
