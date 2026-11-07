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
  test('the sky section is closed by default and folds against the horizon', () => {
  assert.ok(!clientSource.includes('data-copy="sunNote"></p>`, true)'), 'no section opens itself')
  assert.ok(source.includes('skyAxis.y = 0;'), 'the fold axis sits on the horizon, not on the view axis')
})

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
  assert.ok(source.includes("console.warn('[open-sea-skin] boats disabled:'"))
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
  assert.ok(source.includes('lane.away = lane.side * offStage'), 'a hull is parked past the edge before it is drawn')
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
  assert.ok(source.includes('const base = 26 + (index % 4) * 9 + Math.floor(index / 4) * 3'), 'berths must step 9 units apart so hulls do not stack')
  assert.ok(source.includes('let boatScale = 2.5;'), 'the hull defaults to the size the user picked')
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


test('no constant is used before it is declared', () => {
  // 2026-11-06: a rewrite of SECTION 10 kept `BOAT_ENTER_RATE`, `BOAT_EXIT_RATE`
  // and `BOAT_PROBE` in the body but dropped their declarations. The animate()
  // catch swallowed the ReferenceError and set boats = null, so the sea showed
  // zero hulls with nothing in the console. Static check: every screaming-case
  // name in the code must be declared, imported, or a known global.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/'[^'\n]*'/g, "''")
    .replace(/`[^`]*`/g, '``')
    .replace(/\.[A-Za-z_$][\w$]*/g, '')
  const used = new Set(code.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [])
  const declared = new Set(
    (code.match(/(?:const|let|var|function|class)\s+([A-Z][A-Z0-9_]{2,})\b/g) || [])
      .map((hit) => hit.split(/\s+/)[1]),
  )
  const imported = new Set(
    (source.match(/import\s*\{([^}]+)\}/g) || [])
      .flatMap((clause) => clause.replace(/import\s*\{|\}/g, '').split(','))
      .map((part) => part.trim().split(/\s+as\s+/).pop()),
  )
  const globals = new Set(['THREE', 'URL', 'NaN', 'Infinity', 'PI'])
  const missing = [...used].filter((name) => !declared.has(name) && !imported.has(name) && !globals.has(name))
  assert.deepEqual(missing, [], `used but never declared: ${missing.join(', ')}`)
})

test('module-scope collections are mutated, never reassigned', () => {
  // 2026-11-06: `const boatSpots = []` was later reset with `boatSpots = []`,
  // which throws "Assignment to constant variable" inside the animate() try and
  // takes the whole fleet down. Reset with .length = 0 instead.
  const collections = [...source.matchAll(/^const ([A-Za-z_$][\w$]*) = (?:\[|\{)/gm)].map((hit) => hit[1])
  const offenders = collections.filter((name) => {
    const hits = [...source.matchAll(new RegExp(`(^|[^\\w$.])${name}\\s*=(?!=)`, 'g'))]
    return hits.some((hit) => !source.slice(Math.max(0, hit.index - 6), hit.index + 1).includes('const'))
  })
  assert.deepEqual(offenders, [], `reassigned const collections: ${offenders.join(', ')}`)
  assert.ok(source.includes('boatSpots: boatSpotList(),'), 'the panel reads the hull positions back')
  assert.ok(source.includes('function boatSpotList() {'), 'the projection runs on demand, not per frame')
  assert.ok(!source.includes('boatSpots.push('), 'no per-frame projection buffer is needed anymore')
  assert.ok(source.includes('boatError = String((err && err.message) || err);'), 'a fleet failure must be kept for the panel')
})

test('constellation legs are soft quads instead of hairlines', () => {
  // A 1 px GPU line staircases across a 1x display. Each leg is now two quads
  // that fade from the centreline outwards, which the rasteriser blends.
  assert.ok(source.includes("const lineEdge = float(1).sub(abs(attribute('aSide', 'float')))"), 'the soft edge must be a per-vertex attribute')
  assert.ok(source.includes('lineEdge.mul(lineEdge)'), 'the falloff must be squared so the rim disappears')
  assert.ok(source.includes('lineSideAttr[side + 0] = -1;'), 'each leg needs the two half quads')
  assert.ok(!source.includes('const lines = new THREE.LineSegments('), 'the line layer must not go back to hairlines')
})

test('the sky rebuild is skipped while it cannot be seen', () => {
  // 15 deg/hour means a 20 s step is 0.08 deg, and a faded-out sky needs none.
  assert.ok(source.includes('if (layer.starsOpacity < 0.01) return;'), 'a hidden sky must not be rebuilt')
  assert.ok(source.includes('if (now - layer.lastSky > 20000) {'), 'the dome may only be rebuilt every 20 s')
})

test('the adaptive scale steps rarely and keeps a sharp floor', () => {
  // The old loop pulsed the pixel ratio every 2 s and dropped to half
  // resolution; both read as stutter on the water.
  // 1.5.26: the floor is a table now — one quality preset per level — but skin
  // mode still starts above the half-resolution cliff.
  assert.ok(source.includes('let MIN_SCALE = REDUCED_MOTION ? 0.5 : SKIN ? 0.6 : 0.55;'), 'skin mode must keep a sharp floor')
  assert.ok(source.includes('MIN_SCALE = REDUCED_MOTION ? Math.min(preset.minScale, 0.5) : preset.minScale;'), 'the preset owns the floor')
  assert.ok(source.includes('adaptHold = 4;'), 'a scale change must hold for 8 s')
  assert.ok(source.includes('renderScale * 0.97'), 'the step must be gentle')
})

test('the ribbon draws the legs the data actually has', () => {
  // The point list stores each leg twice ([A,B][B,C][C,D]...). Walking every
  // consecutive entry silently joined the end of one polyline to the start of
  // the next, which drew 149 links that are not in the catalogue at all.
  assert.ok(source.includes('for (let e = 0; e + 1 < layer.segmentCount; e += 2) {'), 'the ribbon must step two entries at a time')
  assert.ok(source.includes('const base = (e >> 1) * 8;'), 'one quad block per real leg')
  assert.ok(source.includes('const edgeCount = Math.floor(segmentCount / 2);'), 'half as many legs as entries')
})

test('the geometry is sized like last time, not larger', () => {
  // The ribbons are the same picture as the hairlines, only softened: if the
  // stroke gets much fatter the sky turns into a mesh.
  // 1.5.25: the stroke keeps its weight, but never falls below one pixel at the
  // star shell — a sub-pixel quad rasterises as a dashed constellation.
  assert.ok(source.includes('Math.max(STAR_RADIUS * 0.0012, pxWorld * 0.9) * uLineWidth.value'), 'keep the stroke close to its former weight, as a dial')
})

test('the hulls keep the 1.5.3 lanes, widened only by the panel setting', () => {
  // 1.5.20 scaled the sweep to the frame half-width and every hull vanished, so
  // 1.5.21 went back to the fixed 6..20 unit amplitude and made it adjustable
  // instead. Nothing may reintroduce the frame-relative `across` field.
  assert.ok(source.includes('radiusRight: 6 + ((index * 3.7) % 14),'), 'the lanes must keep the fixed amplitude')
  assert.ok(source.includes('const laneAcross = Math.max(-reach, Math.min(reach, Math.sin(angle) * lane.radiusRight * boatSpread));'), 'the amplitude must be scaled by the setting')
  assert.ok(!source.includes('lane.across'), 'the frame-relative sweep must stay gone')
})

test('boat range, pace and scale are panel settings', () => {
  // The hulls went missing twice this week; every knob that changes where they
  // are drawn has to be adjustable from the panel instead of hard-coded.
  assert.ok(source.includes('const laneAcross = Math.max(-reach, Math.min(reach, Math.sin(angle) * lane.radiusRight * boatSpread));'), 'the sweep must come from the setting')
  assert.ok(source.includes('lane.angle += dt * lane.speed * cruise * lane.surge * boatPace;'), 'the pace must come from the setting')
  assert.ok(source.includes('boatDummy.scale.setScalar(boatScale);'), 'the size must come from the setting')
  assert.ok(source.includes("if (d && d.type === 'oss-boats') applyBoatsMessage(d);"), 'the surface must accept the settings')
  assert.ok(clientSource.includes("type: 'oss-boats',"), 'the panel must send the settings')
  assert.ok(clientSource.includes("rangeRow(pid('boat-spread'), 'boatSpread', 0.2, 3, 0.1)"), 'the range slider must exist')
})

test('the panel is one searchable set of collapsible groups', () => {
  // 1.5.23 went from five flat blocks to eleven groups plus a search box; the
  // old grade buttons are sliders now, so the pinned markup has to follow.
  for (const key of ['secSky', 'secStars', 'secConst', 'secMeteor', 'secClouds', 'secAdvanced']) {
    assert.ok(clientSource.includes(`group('${key}'`), `${key} must be its own collapsible group`)
  }
  assert.ok(clientSource.includes("<details class=\"oss-sec\""), 'groups must be <details> elements')
  assert.ok(clientSource.includes("const RANGE_ROWS = ["), 'one table must drive the sliders')
  for (const row of ["['star-size', 'starSize'", "['glass-radius', 'glassRadius'", "['tz-offset', 'tzOffset'"]) {
    assert.ok(clientSource.includes(row), `${row} must be a panel dial`)
  }
  // The dome share folded into the zoom dial and the faint-star floor now follows
  // the bright-star size, so neither is a second slider for the same thing.
  assert.ok(!clientSource.includes("pid('dome-amount')"), 'the dome share is not a second zoom dial')
  assert.ok(!clientSource.includes("pid('star-min')"), 'the faint floor is not a second size dial')
  assert.ok(!clientSource.includes("pid('col-left-level')"), 'the four-step column button must be gone')
  assert.ok(clientSource.includes("setRowVisible(el('tz-offset'), state.tzMode === 'manual')"), 'the offset slider follows the clock mode')
  assert.ok(clientSource.includes('const titleHit'), 'searching a group title must keep that group open')
  assert.ok(clientSource.includes('data-open0'), 'clearing the search must restore the groups as they were built')
})

test('the surface takes every new dial instead of a fixed look', () => {
  assert.ok(source.includes('if (Number.isFinite(radius)) uGlassSpread.value = Math.max(0, Math.min(24, radius)) / 24 * 9;'), 'one global blur radius drives the renderer')
  assert.ok(source.includes('const thetaFolded = 2 * Math.atan(Math.tan(theta * 0.5) / fold);'), 'the dome must be a conformal stereographic fold')
  assert.ok(source.includes('meteorHead'), 'meteors need a head, not a bare hairline')
  assert.ok(source.includes('twilightTimes(at, sunLat, sunLon)'), 'twilight boundaries come from the same ephemeris')
  // 1.5.23 shipped with these two seeded from the percentage tables, so the sky
  // rendered 100x its glow and the crosses were 574 units long: a grey wall.
  assert.ok(source.includes('uniform(CONSTELLATION_GRADES.mid / 100)'), 'constellation glow is a 0..1 multiplier, not a percentage')
  assert.ok(source.includes('uniform(CROSS_GRADES.mid / 100)'), 'cross glow is a 0..1 multiplier, not a percentage')
})

test('the frame rate is a budget dial, not a fixed 60', () => {
  // a wallpaper does not need 60 fps, and every frame is a full-screen fill
  assert.ok(source.includes('const FPS_OPTIONS = [24, 30, 45, 60];'), 'the cap has a fixed option list')
  assert.ok(source.includes('let fpsCap = SKIN ? 30 : 60;'), 'the skin starts at half rate')
  assert.ok(source.includes('if (Number.isFinite(Number(d.fps))) applyFpsCap(Number(d.fps));'), 'the host can retune the cap live')
  assert.ok(clientSource.includes("const FPS_LEVELS = [24, 30, 45, 60];"), 'the panel offers the same four rates')
  assert.ok(clientSource.includes("case pid('fps'): return { fps: Number(value) };"), 'picking a rate posts the number, not a string')
})

test('the stars are billboards with a real disc, not square point sprites', () => {
  // PointsNodeMaterial has no texture slot in the node path, so a round star has
  // to be a camera-facing quad. These lines are the contract that keeps it that
  // way; the stale `crossColorAttr` field (a leftover from the deleted cross
  // layer) used to throw inside createStarLayer and blank the whole dome.
  assert.ok(source.includes('starMaterial.positionNode = positionLocal.add(edgeOffset.mul(extent).mul(uStarPxWorld));'), 'the quad is billboarded in the shader')
  assert.ok(source.includes('const spikeOn = smoothstep(float(2.0), float(6.0), aSpike);'), 'faint stars must not grow rays')
  assert.ok(source.includes('const radius = aSize.mul(0.62);'), 'the bright core is a disc, sized in pixels')
  assert.ok(!source.includes('crossColorAttr'), 'no leftover attribute references in the star layer')
})

test('the sky follows the sun instead of a switch', () => {
  // Dusk used to pop: the layer went from full to nothing on one frame. The fade
  // is now a function of solar altitude, and a fully faded dome is dropped from
  // the draw list so the courtesy costs nothing.
  assert.ok(source.includes('const targetFade = daylight ? 1 : smoothstepRange(6, -2, sunElevationDeg);'), 'the fade is a smoothstep of the sun height')
  assert.ok(source.includes('layer.stars.visible = shown;'), 'a faded dome is skipped, not drawn at zero alpha')
  assert.ok(source.includes('const skyVeto = daylight ? 1 :'), 'daylight mode is not vetoed by the night factor')
  assert.ok(source.includes('uMilkyVisible.value = shown ? 0.35 + 0.65 * smoothstepRange(-10, 10, galacticCentreAlt) : 0;'), 'the band follows the galactic centre')
})

test('the constellation lines breathe one constellation at a time', () => {
  // A global pulse reads as a flicker; per-edge phases read as air moving.
  assert.ok(source.includes("lineGeometry.setAttribute('aLinePhase', new THREE.BufferAttribute(linePhaseAttr, 1));"), 'each edge carries its own phase')
  assert.ok(source.includes('const lineWobble = sin(uTime.mul(uLineSpeed).add(linePhase)).mul(0.72)'), 'two incommensurate rates')
  assert.ok(source.includes('function hashName(text) {'), 'the phase is deterministic per constellation name')
})

test('the glass pane has six looks and one dial', () => {
  assert.ok(source.includes("const uGlassStyle = uniform(0);"), 'the style is a uniform, not a rebuild')
  assert.ok(source.includes("const index = ['gaussian', 'box', 'double', 'radial', 'frost', 'tile'].indexOf(d.style);"), 'the six names are the contract')
  assert.ok(clientSource.includes("const GLASS_STYLES = ['gaussian', 'box', 'double', 'radial', 'frost', 'tile'];"), 'the panel offers the same six')
  assert.ok(clientSource.includes('style: state.glassStyle,'), 'the chosen look is posted with the rects')
})

test('the moon wears the phase it reports', () => {
  // phase01 is 0 at new, so cos(2*pi*phase) is +1 there and the lit limb is
  // where mx sits above it. Adding instead of subtracting mirrored the
  // terminator and turned a 4% crescent into a second sun next to the real one.
  assert.ok(source.includes('const lit = smoothstep(-0.22, 0.22, mx.sub(uMoonPhaseCos));'), 'the terminator subtracts the phase cosine')
  assert.ok(!source.includes('mx.add(uMoonPhaseCos)'), 'the mirrored terminator is gone')
})

test('manual daylight is a clock, not a brightness ramp', () => {
  // A 0..1 ramp made the sun crawl up a synthetic arc and left the moon parked.
  // Manual mode now feeds a real instant into the same solver as the live clock.
  assert.ok(source.includes('function skyInstant(nowMs) {'), 'one instant helper for both modes')
  assert.ok(source.includes('const when = skyInstant(now);'), 'the sky is solved for that instant')
  assert.ok(source.includes('syncMoon(when.getTime());'), 'the moon travels with the clock')
  assert.ok(source.includes('manualMinutes = ((t % 1440) + 1440) % 1440;'), 'the host sends minutes after midnight')
  assert.ok(!source.includes("if (Number.isFinite(t) && t >= 0 && t <= 100 && sunMode === 'manual') {"), 'the old ramp is gone')
  assert.ok(clientSource.includes('max="1439"'), 'the slider spans the whole day')
  assert.ok(clientSource.includes('function clockLabel(minutes) {'), 'the value reads as HH:MM')
})

test('the sea follows the session with no panel mounted', () => {
  // The tick used to live inside the panel, so closing it froze the waves.
  assert.ok(clientSource.includes('// the sea follows the session even when no panel is mounted'), 'started from the controller')
  assert.ok(clientSource.includes('} catch { /* no panel mounted */ }'), 'panel readouts are optional')
})

test('the overflow dial is visible at the crest', () => {
  // The caps used to gate on crest 1..2 — an absolute height the surface only
  // reaches in a storm — so the dial had nothing to thicken. They gate on the
  // crest relative to the current sea now, and the dial adds crowns and spray.
  assert.ok(source.includes('const crestRatio = clamp(crest.div(max(sea.mul(1.55), 0.25)), 0, 1.4);'), 'caps compare against the sea state')
  assert.ok(source.includes('const crowns = smoothstep(0.7, 1.02, crestRatio).mul(smoothstep(0.15, 0.85, uOverflow)).mul(0.6);'), 'the dial adds crowned tips')
  assert.ok(source.includes('const spray = pow(foamNoise, 5).mul(smoothstep(0.15, 0.7, uOverflow)).mul(0.95);'), 'and blown spray')
  // and the host walks the dial up while the session is merely busy, not at 4x
  assert.ok(clientSource.includes('const curve = (value, ceiling) => Math.max(0, (value / ceiling - 0.6) / 1.6);'), 'linear from 60% of the ceiling')
})

test('over budget counts even while idle', () => {
  // The caps followed the throughput curve only, so an idle session that had
  // long passed its cost ceiling showed a calm sea with no caps at all.
  assert.ok(clientSource.includes('const byBudget = curve(spent, budgetCeiling);'), 'the spend curve always applies')
  assert.ok(clientSource.includes('overflowValue = Math.min(1, Math.max(byBudget, byRate) * state.overflowGain);'), 'busy rate can only raise it')
  assert.ok(!clientSource.includes('if (state.waveMode === \'manual\') {\n        overflowValue = 0;'), 'manual mode no longer hides the budget')
})

test('the overflow dial fades instead of switching', () => {
  // A budget verdict can flip in one tick; feeding it straight to the surface
  // made the white caps appear and vanish between frames.
  assert.ok(source.includes('let overflowTarget = 0;'), 'writers move a target')
  assert.ok(source.includes('uOverflow.value += (overflowTarget - uOverflow.value) * Math.min(1, dt * 1.3);'), 'the frame loop eases toward it')
  assert.ok(source.includes('smoothstep(0.15, 0.85, uOverflow)'), 'the caps bloom in over a band')
  assert.ok(source.includes('smoothstep(0.15, 0.7, uOverflow)'), 'the spray does too')
})

test('the breath is slow enough to read', () => {
  // The first beat is an 11 s period at the default 0.55 rad/s; the shimmer rides on
  // top. A 0.9 rad/s-only mix was too even to notice at 1 px.
  assert.ok(source.includes('sin(uTime.mul(uLineSpeed).add(linePhase)).mul(0.72)'), 'slow beat')
  assert.ok(source.includes('sin(uTime.mul(uLineSpeed).mul(3.82).add(linePhase.mul(1.73))).mul(0.28)'), 'fast shimmer')
  assert.ok(source.includes('const uLineTwinkle = uniform(0.8);'), 'default is a visible swing')
  assert.ok(!source.includes('Math.min(0.6, Number(d.lineTwinkle))'), 'the dial can reach 1')
})

test('the whole sky inhales together', () => {
  // Staggered phases alone average out across 80 constellations, so the picture
  // looked static even though every line was moving. One slow shared envelope
  // gives the sky a breath of its own.
  assert.ok(source.includes('.mul(0.8).add(0.6)'), 'a shared 0.725..1.275 envelope')
  assert.ok(source.includes('.mul(lineBreath)'), 'applied to the ribbon colour')
  assert.ok(source.includes('sin(uTime.mul(0.21))'), 'about a 30 s period')
})

test('a constellation blinks as one figure', () => {
  // The polyline index used to be part of the phase, so UMa's seven polylines
  // each breathed on their own and the figure looked like it was tearing.
  assert.ok(source.includes('const phase = namePhase.get(owner) * 2.399963;'), 'phase comes from the name only')
  assert.ok(!source.includes('namePhase.get(owner) + ((i * 2.399963) % 6.283)'), 'no per-polyline offset')
})

test('the breath speed is a dial', () => {
  assert.ok(source.includes('const uLineSpeed = uniform(0.55);'), 'speed has a default')
  assert.ok(source.includes('sin(uTime.mul(uLineSpeed).add(linePhase)).mul(0.72)'), 'the beat follows the dial')
})

test('star dots grow with the stroke', () => {
  assert.ok(source.includes('const lineBoost = 0.6 + 0.4 * Math.min(4, Math.max(0.2, uLineWidth.value));'), 'dots ride the stroke width')
  // Handing plain numbers to the node clamp yields a node, and arithmetic on that
  // is NaN: every dot silently lost its size in 1.5.39 because of it.
  assert.ok(!source.includes('clamp(uLineWidth.value'), 'the stroke boost must stay plain JavaScript')
})

test('the panel explains itself and opens folded', () => {
  // Every control carries a one-line explanation, so "falloff" or "dome share"
  // does not have to be reverse-engineered from its effect.
  assert.ok(clientSource.includes('const hint = (key) =>'), 'row builders must add a hint line')
  assert.ok(clientSource.includes('class="oss-hint"'), 'the hint has its own class')
  assert.equal((clientSource.match(/hints: \{/g) || []).length, 2, 'both dictionaries carry the hints')
  assert.ok(clientSource.includes("lineTwinkle: '整个星座一起呼吸的幅度"), 'zh hint text')
  // A panel element survives being closed, so opening it must fold everything again.
  assert.ok(clientSource.includes("panel.querySelectorAll('.oss-sec').forEach((section) => {"), 'every open folds the groups')
  assert.ok(clientSource.includes('section.open = false;'), 'the fold really sets open to false')
})

test('a leaving hull never vanishes inside the frame', () => {
  // offStage depends on the depth the hull is at, and a hull still on its way out
  // can swing to a shallower berth where the edge is nearer; the reach is frozen
  // at departure instead of being recomputed every frame.
  assert.ok(source.includes('lane.exitReach = offStage + 4;'), 'the reach is fixed when the hull leaves')
  assert.ok(source.includes('lane.exitSide * lane.exitReach - lane.away'), 'the exit steers to that fixed reach')
  assert.ok(source.includes('Math.abs(lane.away) >= lane.exitReach - 0.5'), 'the hull is dropped only past it')
})

test('a meteor lives on the animation clock, not the sky rebuild', () => {
  // The streak used to sit inside the 20 s rebuild: it advanced twice in its whole
  // 0.6 s life, so nothing was ever visible. It also read Date/1000 as its clock.
  assert.ok(source.includes('function updateMeteors(layer, seconds, dt) {'), 'meteors own their update')
  assert.ok(source.includes('updateMeteors(starLayer, skySeconds, dt);'), 'called every frame')
  assert.ok(!source.includes('if (elapsed > meteor.next && layer.starsOpacity > 0.25'), 'the old gated spawn is gone')
})

test('cloud is a deck, and the paper is not frosted at blur zero', () => {
  // A band that only covered the first ten degrees read as haze.
  assert.ok(source.includes('smoothstep(0.02, 0.09, d.y)'), 'the cloud band reaches up the sky')
  assert.ok(source.includes('const cloudTint = mix(uHorizonColor'), 'cloud keeps a neutral body')
  // The panel chrome was hard-wired to 22 px, so blur 0 still left it frosted.
  assert.ok(clientSource.includes('function paneBlur(state) {'), 'one dial drives the chrome too')
  assert.ok(clientSource.includes('backdrop-filter:blur(${panePx}px) saturate(140%);'), 'panel blur follows it')
})

test('the panel CSS builds its own fill alpha', () => {
  // paneAlpha lived in glassCss() while the panel CSS is written by uiCss():
  // the ReferenceError killed mountUi() and the settings entry never appeared.
  const uiStart = clientSource.indexOf('function uiCss(state) {');
  const uiEnd = clientSource.indexOf('function paneBlur(state)');
  const glassStart = clientSource.indexOf('function glassCss(glass, state) {');
  assert.ok(uiStart >= 0 && glassStart >= 0, 'both builders exist')
  assert.ok(clientSource.slice(uiStart, uiStart + 400).includes('const paneAlpha'), 'uiCss declares it')
  assert.ok(!clientSource.slice(glassStart, glassStart + 400).includes('const paneAlpha'), 'glassCss does not')
})

test('the settings panel keeps a readable floor of blur', () => {
  // Turning every frosted surface off left the panel with no backdrop filter at
  // all, so a 300px text card sat directly on moving water.
  assert.ok(clientSource.includes('const PANEL_BLUR_FLOOR = 9;'), 'the floor exists')
  assert.ok(clientSource.includes('return state.frost ? Math.max(PANEL_BLUR_FLOOR, wanted) : PANEL_BLUR_FLOOR;'), 'the switch cannot drop it')
  assert.ok(!clientSource.includes('if (!state.frost || state.perf) return 0;'), 'the old early return is gone')
})
