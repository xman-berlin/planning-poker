import assert from 'node:assert/strict'
import test from 'node:test'
import { io as createClient } from 'socket.io-client'
import { createApp } from './index.js'
import {
  REDIS_SESSIONS_KEY,
  createRedisSessionStore,
  decodeSessions,
  selectSessionBackend,
} from './persist.js'

const modId = 'redis-moderator-01'

function fakeRedis() {
  const data = new Map()
  return {
    data,
    async get(key) {
      return data.has(key) ? data.get(key) : null
    },
    async set(key, value) {
      data.set(key, value)
      return 'OK'
    },
  }
}

function connect(port, transports = ['websocket']) {
  return new Promise((resolve, reject) => {
    const socket = createClient(`http://127.0.0.1:${port}`, { transports, forceNew: true })
    const timer = setTimeout(() => reject(new Error('connect timeout')), 4000)
    socket.on('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.on('connect_error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

function emit(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve))
}

async function listen(store) {
  const { httpServer, io, hub } = await createApp({ store })
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  return { httpServer, io, hub, port: httpServer.address().port }
}

async function shutdown({ httpServer, io, hub }) {
  io.disconnectSockets(true)
  await hub.flush()
  await new Promise((resolve) => httpServer.close(resolve))
}

test('selectSessionBackend uses Redis only when a URL is configured', () => {
  const env = { REDIS_URL: 'redis://example.test:6379' }
  assert.deepEqual(selectSessionBackend({}, env), {
    kind: 'redis',
    redisUrl: 'redis://example.test:6379',
  })
  assert.deepEqual(selectSessionBackend({ dataFile: '/tmp/sessions.json' }, env), {
    kind: 'file',
    dataFile: '/tmp/sessions.json',
  })
  assert.deepEqual(
    selectSessionBackend({ dataFile: '/tmp/sessions.json', redisUrl: 'redis://override.test:6379' }, {}),
    { kind: 'redis', redisUrl: 'redis://override.test:6379' },
  )
  assert.deepEqual(selectSessionBackend({ redisUrl: '  ' }, { REDIS_URL: 'redis://ignored.test:6379' }), {
    kind: 'none',
  })
  assert.deepEqual(selectSessionBackend({ defaultDataFile: '/var/sessions.json' }, {}), {
    kind: 'file',
    dataFile: '/var/sessions.json',
  })
  assert.deepEqual(selectSessionBackend({ dataFile: '' }, env), { kind: 'none' })
})

test('redis store round-trips the same document as the file store', async () => {
  const client = fakeRedis()
  const store = createRedisSessionStore(client)
  await store.write([
    {
      id: 'AB2345',
      participants: [{ id: modId, name: 'Mara', role: 'moderator', vote: '8' }],
    },
  ])
  const sessions = await store.read()
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].participants[0].vote, '8')
  const stored = decodeSessions(client.data.get(REDIS_SESSIONS_KEY))
  assert.equal(stored[0].id, 'AB2345')
  await store.close()
})

test('a broken redis payload does not crash the store', async () => {
  const client = fakeRedis()
  client.data.set(REDIS_SESSIONS_KEY, '{ this is not json')
  const store = createRedisSessionStore(client)
  const sessions = await store.read()
  assert.deepEqual(sessions, [])
  assert.equal(client.data.get(`${REDIS_SESSIONS_KEY}:broken`), '{ this is not json')
  await store.write([])
  assert.equal(decodeSessions(client.data.get(REDIS_SESSIONS_KEY)).length, 0)
})

test('session state survives a new process when the store is Redis', async () => {
  const client = fakeRedis()
  const first = await listen(createRedisSessionStore(client))
  const socket = await connect(first.port)
  let sessionId = ''
  try {
    const created = await emit(socket, 'session:create', { name: 'Mara', participantId: modId })
    assert.equal(created.ok, true, created.error)
    sessionId = created.sessionId
    const story = await emit(socket, 'story:update', {
      sessionId,
      participantId: modId,
      title: 'Login',
      description: 'Kurz',
      ticketUrl: '',
      round: 1,
    })
    assert.equal(story.ok, true, story.error)
    const vote = await emit(socket, 'vote:cast', { sessionId, participantId: modId, value: '8' })
    assert.equal(vote.ok, true, vote.error)
  } finally {
    socket.disconnect()
    await shutdown(first)
  }

  const stored = decodeSessions(client.data.get(REDIS_SESSIONS_KEY))
  assert.equal(stored.length, 1)
  assert.equal(stored[0].id, sessionId)
  assert.equal(stored[0].story.title, 'Login')
  assert.equal(stored[0].participants[0].vote, '8')

  const second = await listen(createRedisSessionStore(client))
  const again = await connect(second.port, ['polling'])
  try {
    assert.equal(again.io.engine.transport.name, 'polling')
    const resumed = await emit(again, 'session:resume', { sessionId, participantId: modId })
    assert.equal(resumed.ok, true, resumed.error)
    assert.equal(resumed.state.you.role, 'moderator')
    assert.equal(resumed.state.you.vote, '8')
    assert.equal(resumed.state.story.title, 'Login')
  } finally {
    again.disconnect()
    await shutdown(second)
  }
})
