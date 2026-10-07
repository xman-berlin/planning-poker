import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { io as createClient } from 'socket.io-client'
import { createApp } from './index.js'

const modId = 'moderator-persist-01'
const otherId = 'other-voter-persist-01'

function connect(port) {
  return new Promise((resolve, reject) => {
    const socket = createClient(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true })
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

async function listen(dataFile) {
  const { httpServer, io, hub } = await createApp({ dataFile })
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  return { httpServer, io, hub, port: httpServer.address().port }
}

async function shutdown({ httpServer, io, hub }) {
  io.disconnectSockets(true)
  if (hub) await hub.flush()
  await new Promise((resolve) => httpServer.close(resolve))
}

test('session state survives a process restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-persist-'))
  const dataFile = path.join(dir, 'sessions.json')
  const first = await listen(dataFile)
  const socket = await connect(first.port)

  try {
    const created = await emit(socket, 'session:create', { name: 'Mara', participantId: modId })
    assert.equal(created.ok, true, created.error)
    const sessionId = created.sessionId

    const story = await emit(socket, 'story:update', {
      sessionId,
      participantId: modId,
      title: 'Login',
      description: 'Kurz',
      ticketUrl: 'https://example.test/login',
      round: 1,
    })
    assert.equal(story.ok, true, story.error)

    const vote = await emit(socket, 'vote:cast', { sessionId, participantId: modId, value: '8' })
    assert.equal(vote.ok, true, vote.error)
    const revealed = await emit(socket, 'round:reveal', { sessionId, participantId: modId })
    assert.equal(revealed.ok, true, revealed.error)
    const note = await emit(socket, 'chat:send', { sessionId, participantId: modId, text: 'Passt so.' })
    assert.equal(note.ok, true, note.error)
    const saved = await emit(socket, 'round:save', { sessionId, participantId: modId })
    assert.equal(saved.ok, true, saved.error)
    const next = await emit(socket, 'round:next', { sessionId, participantId: modId })
    assert.equal(next.ok, true, next.error)
    const mid = await emit(socket, 'vote:cast', { sessionId, participantId: modId, value: '5' })
    assert.equal(mid.ok, true, mid.error)
    const timer = await emit(socket, 'timer:start', { sessionId, participantId: modId })
    assert.equal(timer.ok, true, timer.error)
  } finally {
    socket.disconnect()
    await shutdown(first)
  }

  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  assert.equal(raw.version, 1)
  assert.equal(raw.sessions.length, 1)
  const stored = raw.sessions[0]
  assert.equal(stored.history.length, 1)
  assert.equal(stored.history[0].story.title, 'Login')
  assert.equal(stored.chat[0].text, 'Passt so.')
  assert.equal(stored.revealed, false)
  assert.equal(stored.round, 2)
  assert.equal(stored.timer.running, true)
  const mara = stored.participants.find((person) => person.id === modId)
  assert.equal(mara.role, 'moderator')
  assert.equal(mara.vote, '5')
  assert.equal(stored.participants[0].socketId, undefined)
  const sessionId = stored.id

  const second = await listen(dataFile)
  const again = await connect(second.port)
  const other = await connect(second.port)
  try {
    const resumed = await emit(again, 'session:resume', { sessionId, participantId: modId })
    assert.equal(resumed.ok, true, resumed.error)
    assert.equal(resumed.state.you.role, 'moderator')
    assert.equal(resumed.state.you.vote, '5')
    assert.equal(resumed.state.revealed, false)
    assert.equal(resumed.state.history[0].story.title, 'Login')
    assert.equal(resumed.state.chat[0].text, 'Passt so.')
    assert.equal(resumed.state.timer.running, true)
    assert.ok(resumed.state.timer.remainingSec > 0)

    const joined = await emit(other, 'session:join', {
      sessionId,
      name: 'Nico',
      participantId: otherId,
      role: 'voter',
    })
    assert.equal(joined.ok, true, joined.error)
    const visible = joined.state.participants.find((person) => person.name === 'Mara')
    assert.equal(visible.role, 'moderator')
    assert.equal(visible.hasVoted, true)
    assert.equal(visible.vote, null)
  } finally {
    again.disconnect()
    other.disconnect()
    await shutdown(second)
  }

  const third = await listen(dataFile)
  const fresh = await connect(third.port)
  const kimA = await connect(third.port)
  const kimB = await connect(third.port)
  try {
    const rejoin = await emit(fresh, 'session:join', {
      sessionId,
      name: 'mara',
      participantId: 'brand-new-participant-id',
      role: 'observer',
    })
    assert.equal(rejoin.ok, true, rejoin.error)
    assert.equal(rejoin.reclaimed, true)
    assert.equal(rejoin.participantId, modId)
    assert.equal(rejoin.state.you.role, 'moderator')
    assert.equal(rejoin.state.you.vote, '5')

    const firstKim = await emit(kimA, 'session:join', {
      sessionId,
      name: 'Kim',
      participantId: 'kim-seat-persist-0001',
      role: 'voter',
    })
    assert.equal(firstKim.ok, true, firstKim.error)
    const secondKim = await emit(kimB, 'session:join', {
      sessionId,
      name: 'Kim',
      participantId: 'kim-seat-persist-0002',
      role: 'voter',
    })
    assert.equal(secondKim.participantId, 'kim-seat-persist-0002')
  } finally {
    fresh.disconnect()
    kimA.disconnect()
    kimB.disconnect()
    await shutdown(third)
  }

  const fourth = await listen(dataFile)
  const late = await connect(fourth.port)
  try {
    const ambiguous = await emit(late, 'session:join', {
      sessionId,
      name: 'Kim',
      participantId: 'kim-seat-persist-0003',
      role: 'observer',
    })
    assert.equal(ambiguous.ok, true, ambiguous.error)
    assert.equal(ambiguous.participantId, 'kim-seat-persist-0003')
    assert.equal(ambiguous.state.you.role, 'observer')
    assert.equal(ambiguous.state.participants.filter((person) => person.name === 'Kim').length, 3)
  } finally {
    late.disconnect()
    await shutdown(fourth)
  }
})

test('a timer that already ended is restored as expired', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-expired-'))
  const dataFile = path.join(dir, 'sessions.json')
  fs.writeFileSync(
    dataFile,
    JSON.stringify({
      version: 1,
      sessions: [
        {
          id: 'AB2345',
          createdAt: '2026-10-05T12:00:00.000Z',
          deck: 'fibonacci',
          revealed: false,
          round: 1,
          roundSaved: false,
          story: { title: 'Alt', description: '', ticketUrl: '' },
          timer: { durationSec: 30, remainingSec: 30, running: true, endsAt: Date.now() - 5000, expired: false },
          participants: [{ id: 'expired-moderator-01', name: 'Lea', role: 'moderator', vote: null }],
          history: [],
          chat: [],
        },
      ],
    }),
  )

  const server = await listen(dataFile)
  const socket = await connect(server.port)
  try {
    const resumed = await emit(socket, 'session:resume', {
      sessionId: 'AB2345',
      participantId: 'expired-moderator-01',
    })
    assert.equal(resumed.ok, true, resumed.error)
    assert.equal(resumed.state.you.role, 'moderator')
    assert.equal(resumed.state.story.title, 'Alt')
    assert.equal(resumed.state.timer.running, false)
    assert.equal(resumed.state.timer.expired, true)
  } finally {
    socket.disconnect()
    await shutdown(server)
  }

  const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  assert.equal(saved.sessions[0].timer.expired, true)
  assert.equal(saved.sessions[0].timer.running, false)
})

test('a broken sessions file does not crash startup', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-broken-'))
  const dataFile = path.join(dir, 'sessions.json')
  fs.writeFileSync(dataFile, '{ this is not json')
  const server = await listen(dataFile)
  try {
    assert.equal(server.hub.sessions.size, 0)
    assert.equal(fs.existsSync(`${dataFile}.broken`), true)
    assert.equal(fs.readFileSync(dataFile, 'utf8'), '{ this is not json')
  } finally {
    await shutdown(server)
  }
})
