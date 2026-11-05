/**
 * Installable DeepSeek Harness Host plugin for Open Sea.
 * Serves the self-contained renderer under /open-sea-skin without patching
 * the Harness checkout.
 */
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'open-sea-skin'
export const inject = ['webServer']

const ROUTE = '/open-sea-skin'
// Live subagent roster for the boat layer: GET /open-sea-skin/fleet?session=<id>
const FLEET_ROUTE = `${ROUTE}/fleet`
const ASSET_ROOT = resolve(fileURLToPath(new URL('../native-dist/', import.meta.url)))
const MIME = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
})

function finish(res, status, headers = {}) {
  res.writeHead(status, {
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
    ...headers,
  })
  res.end()
}

// Services are looked up lazily: the skin must keep working in profiles that
// compose neither subagents nor teams (the fleet simply reports zero boats).
function readService(ctx, key) {
  try {
    if (typeof ctx.get === 'function') return ctx.get(key)
    if (ctx.reflect && typeof ctx.reflect.get === 'function') return ctx.reflect.get(key)
  } catch {}
  return undefined
}

const STATUS_RUNNING = 'running'
// The skin polls the roster every 4 s; one observation per child per window
// keeps a long-lived child from being folded over and over.
const RUNNING_TTL_MS = 2500
const OBSERVE_LIMIT = 24
const runningCache = new Map()

function disposeObservation(observation) {
  if (!observation) return
  try {
    const asyncDispose = observation[Symbol.asyncDispose]
    if (typeof asyncDispose === 'function') {
      Promise.resolve(asyncDispose.call(observation)).catch(() => {})
      return
    }
    const dispose = observation[Symbol.dispose]
    if (typeof dispose === 'function') dispose.call(observation)
    else if (typeof observation.dispose === 'function') observation.dispose()
  } catch {}
}

// A child session is "running" while it has an open turn, and subagentTiming
// is exactly that: `active` is present until the child reaches turn/end. The
// catalog entry carries no running flag, and the parent's own team membership
// is not a child, so neither can be counted directly.
async function childRunning(ctx, childId, signal) {
  const now = Date.now()
  const cached = runningCache.get(childId)
  if (cached !== undefined && now - cached.at < RUNNING_TTL_MS) return cached.running
  const query = readService(ctx, 'sessionQuery')
  if (!query || typeof query.observeSession !== 'function') return false
  let observation
  try {
    observation = await query.observeSession(childId, { signal, projectionMode: 'all' })
    const timing = observation?.projections?.values?.subagentTiming
    const running = timing !== undefined && timing !== null && timing.active !== undefined
    runningCache.set(childId, { running, at: now })
    return running
  } catch {
    return false
  } finally {
    disposeObservation(observation)
  }
}

function describeShip(entry, fallbackId) {
  const id = entry?.sessionId ?? entry?.id ?? entry?.childId ?? fallbackId ?? null
  const raw = entry?.status ?? entry?.state ?? entry?.activity ?? ''
  return {
    id: id === null ? null : String(id),
    title: String(entry?.title ?? entry?.name ?? entry?.label ?? ''),
    status: String(raw).toLowerCase(),
  }
}

async function serveFleet(ctx, req, res) {
  const url = new URL(req.url ?? FLEET_ROUTE, 'http://dsh.local')
  const sessionId = url.searchParams.get('session') ?? ''
  const payload = {
    ok: false,
    sessionId,
    services: {},
    running: 0,
    ships: [],
    children: [],
    childStates: [],
    members: [],
  }
  try {
    const subagents = readService(ctx, 'subagents')
    const agents = readService(ctx, 'agents')
    const teams = readService(ctx, 'agentTeams')
    const query = readService(ctx, 'sessionQuery')
    payload.services = {
      subagents: Boolean(subagents),
      sessionQuery: Boolean(query),
      agents: Boolean(agents),
      agentTeams: Boolean(teams),
    }

    if (sessionId && subagents && typeof subagents.listChildren === 'function') {
      const signal = AbortSignal.timeout(2500)
      const listed = await subagents.listChildren(sessionId, signal)
      const entries = Array.isArray(listed) ? listed.slice(0, 40) : []
      payload.children = entries.map((entry, index) => describeShip(entry, `child-${index}`))
      payload.childStates = await Promise.all(
        payload.children.slice(0, OBSERVE_LIMIT).map(async (child) => ({
          id: child.id,
          title: child.title,
          running: child.id ? await childRunning(ctx, child.id, signal) : false,
        })),
      )
      payload.ships = payload.childStates
        .filter((state) => state.running && state.id)
        .map((state) => ({ id: state.id, title: state.title, status: STATUS_RUNNING }))
    }

    // Members stay in the payload for diagnosis only: the list contains the
    // parent agent itself, which would count as one phantom boat forever.
    if (sessionId && teams && agents && typeof agents.get === 'function'
      && typeof teams.listMembers === 'function') {
      const agent = agents.get(sessionId)
      if (agent) {
        const listed = await teams.listMembers(agent)
        const list = await listed
        payload.members = Array.isArray(list)
          ? list.slice(0, 40).map((entry, index) => describeShip(entry, `member-${index}`))
          : []
      }
    }

    payload.running = payload.ships.length
    payload.ok = true
  } catch (error) {
    payload.error = error instanceof Error ? error.message : String(error)
  }

  const body = Buffer.from(JSON.stringify(payload))
  res.writeHead(200, {
    'cache-control': 'no-store',
    'content-length': String(body.byteLength),
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  })
  res.end(req.method === 'HEAD' ? undefined : body)
}

async function serveAsset(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    finish(res, 405, { allow: 'GET, HEAD' })
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url ?? ROUTE, 'http://dsh.local').pathname)
  } catch {
    finish(res, 400)
    return
  }

  const suffix = pathname === ROUTE || pathname === `${ROUTE}/`
    ? 'skin.html'
    : pathname.slice(`${ROUTE}/`.length)
  const target = resolve(ASSET_ROOT, suffix)
  if (target !== ASSET_ROOT && !target.startsWith(`${ASSET_ROOT}${sep}`)) {
    finish(res, 403)
    return
  }

  try {
    const body = await readFile(target)
    res.writeHead(200, {
      'cache-control': 'no-cache',
      'content-length': String(body.byteLength),
      'content-type': MIME[extname(target)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    })
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch (error) {
    if (error instanceof Error && 'code' in error
      && (error.code === 'ENOENT' || error.code === 'EISDIR')) {
      finish(res, 404)
      return
    }
    throw error
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    // The fleet endpoint lives under the same prefix so the skin stays a single
    // registration; everything else is a static file.
    handler: (req, res) => {
      try {
        const pathname = new URL(req.url ?? ROUTE, 'http://dsh.local').pathname
        if (pathname === FLEET_ROUTE) {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            finish(res, 405, { allow: 'GET, HEAD' })
            return
          }
          return serveFleet(ctx, req, res)
        }
      } catch {}
      return serveAsset(req, res)
    },
  }), 'open-sea-skin: static renderer route')
}
