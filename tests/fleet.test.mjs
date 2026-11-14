// The boat count must equal the "running subagents" number the sidebar shows.
// The catalog entry carries no status, so the roster is derived from each
// child's subagentTiming projection; these tests pin that contract.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../plugin/index.js'

function harness({ children = [], timings = {}, members = [], legacy = false } = {}) {
  let spec
  const ctx = {
    effect: (fn) => fn(),
    webServer: { register: (next) => { spec = next; return () => {} } },
    get: (key) => {
      // Current hosts keep the roster in the parent's `subagentCatalog`
      // projection; `subagents.listChildren` was removed from the service.
      if (key === 'subagents') return legacy ? { listChildren: async () => children } : {}
      if (key === 'sessionQuery') {
        return {
          observeSession: async (id) => ({
            projections: { values: { subagentTiming: timings[id], subagentCatalog: children } },
            [Symbol.dispose]() {},
          }),
        }
      }
      if (key === 'agents') return { get: () => ({ id: 'parent' }) }
      if (key === 'agentTeams') return { listMembers: async () => members }
      return undefined
    },
  }
  apply(ctx)
  return spec
}

async function readFleet(spec, sessionId) {
  const chunks = []
  const res = {
    status: 0,
    headers: {},
    writeHead(status, headers = {}) { this.status = status; this.headers = headers },
    end(body) { if (body !== undefined) chunks.push(body) },
  }
  await spec.handler({ url: `/open-sea-skin/fleet?session=${encodeURIComponent(sessionId)}`, method: 'GET' }, res)
  return { status: res.status, payload: JSON.parse(Buffer.concat(chunks).toString('utf8')) }
}

test('a child with an open turn counts as one boat', async () => {
  const spec = harness({
    children: [{ id: 'child-open' }, { id: 'child-idle' }],
    timings: {
      'child-open': { settledMs: 1200, active: { since: 10, through: 20 } },
      'child-idle': { settledMs: 900, lastTurnCompleted: true },
    },
  })
  const { status, payload } = await readFleet(spec, 'session-parent-a')
  assert.equal(status, 200)
  assert.equal(payload.running, 1)
  assert.deepEqual(payload.ships.map((ship) => ship.id), ['child-open'])
  assert.deepEqual(
    payload.childStates.map((state) => state.running),
    [true, false],
  )
})

test('the parent agent in the member list never becomes a boat', async () => {
  const spec = harness({
    children: [{ id: 'child-quiet' }],
    timings: { 'child-quiet': { settledMs: 400, lastTurnCompleted: true } },
    members: [{ id: 'parent', title: 'lead', status: 'running' }],
  })
  const { payload } = await readFleet(spec, 'session-parent-b')
  assert.equal(payload.running, 0)
  assert.deepEqual(payload.ships, [])
  // the member list stays available for diagnosis only
  assert.equal(payload.members.length, 1)
})

test('a finished one-shot child frees its boat', async () => {
  const spec = harness({
    children: [{ id: 'child-once' }],
    timings: { 'child-once': { settledMs: 5000, lastTurnCompleted: true } },
  })
  const first = await readFleet(spec, 'session-parent-c')
  assert.equal(first.payload.running, 0)
  assert.equal(first.payload.ok, true)
})

test('an unobservable child is reported, not thrown', async () => {
  const spec = harness({ children: [{ id: 'child-gone' }] })
  const ctxless = spec
  const { status, payload } = await readFleet(ctxless, 'session-parent-d')
  assert.equal(status, 200)
  assert.equal(payload.running, 0)
  assert.deepEqual(payload.childStates, [{ id: 'child-gone', title: '', running: false }])
})

test('the roster reports which services the profile mounts', async () => {
  const spec = harness({ children: [] })
  const { payload } = await readFleet(spec, 'session-parent-e')
  assert.deepEqual(Object.keys(payload.services).sort(), ['agentTeams', 'agents', 'sessionQuery', 'subagents'])
  assert.equal(payload.services.sessionQuery, true)
  assert.equal(payload.running, 0)
})

test('the catalog projection is the roster on a host that dropped listChildren', async () => {
  // v0.2.1-rc.2 removed `subagents.listChildren`; a child that is still open
  // must keep its boat, otherwise the count silently sticks at zero.
  const spec = harness({
    children: [{ id: 'child-live', name: 'worker', mode: 'continuable' }, { id: 'child-done' }],
    timings: {
      'child-live': { settledMs: 800, active: { since: 1, through: 2 } },
      'child-done': { settledMs: 700, lastTurnCompleted: true },
    },
  })
  const { payload } = await readFleet(spec, 'session-parent-f')
  assert.equal(payload.services.subagents, true)
  assert.deepEqual(payload.children.map((child) => child.id), ['child-live', 'child-done'])
  assert.equal(payload.running, 1)
  assert.deepEqual(payload.ships.map((ship) => ship.id), ['child-live'])
})

test('a host that still exports listChildren keeps working', async () => {
  const spec = harness({
    legacy: true,
    children: [{ id: 'child-legacy' }],
    timings: { 'child-legacy': { settledMs: 300, active: { since: 5, through: 9 } } },
  })
  const { payload } = await readFleet(spec, 'session-parent-g')
  assert.equal(payload.running, 1)
  assert.deepEqual(payload.ships.map((ship) => ship.id), ['child-legacy'])
})
