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
    members: [],
  }
  try {
    const subagents = readService(ctx, 'subagents')
    const agents = readService(ctx, 'agents')
    const teams = readService(ctx, 'agentTeams')
    payload.services = {
      subagents: Boolean(subagents),
      agents: Boolean(agents),
      agentTeams: Boolean(teams),
    }

    if (sessionId && subagents && typeof subagents.listChildren === 'function') {
      const listed = await subagents.listChildren(sessionId, AbortSignal.timeout(2500))
      const list = await listed
      payload.children = Array.isArray(list)
        ? list.slice(0, 40).map((entry, index) => describeShip(entry, `child-${index}`))
        : []
    }

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

    // one boat per distinct running worker: a teammate can show up in both
    // lists, so dedupe by id before counting
    const seen = new Set()
    for (const ship of [...payload.children, ...payload.members]) {
      if (ship.status !== STATUS_RUNNING) continue
      const key = ship.id ?? ship.title
      if (!key || seen.has(key)) continue
      seen.add(key)
      payload.ships.push(ship)
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
