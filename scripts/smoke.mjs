import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { io as createClient } from 'socket.io-client'
import { createApp } from '../server/index.js'

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

function waitFor(socket, predicate, ms = 2500) {
  return new Promise((resolve, reject) => {
    function onState(state) {
      if (!predicate(state)) return
      clearTimeout(timer)
      socket.off('state', onState)
      resolve(state)
    }
    const timer = setTimeout(() => {
      socket.off('state', onState)
      reject(new Error('state timeout'))
    }, ms)
    socket.on('state', onState)
  })
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-smoke-'))
const { httpServer, io } = createApp({ dataFile: path.join(dataDir, 'sessions.json') })
await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
const port = httpServer.address().port
const annaId = 'anna-participant-id'
const benId = 'ben-participant-id-01'
const chrisId = 'chris-observer-id-01'

try {
  const anna = await connect(port)
  const ben = await connect(port)
  const chris = await connect(port)

  const created = await emit(anna, 'session:create', { name: 'Anna', participantId: annaId })
  assert(created.ok, created.error || 'create failed')
  const sessionId = created.sessionId
  assert(created.state.you.role === 'moderator', 'creator is moderator')
  assert(/^[A-Z0-9]{6}$/.test(sessionId), 'short session id')

  const joined = await emit(ben, 'session:join', {
    sessionId,
    name: 'Ben',
    participantId: benId,
    role: 'voter',
  })
  assert(joined.ok, joined.error || 'join failed')
  assert(joined.state.participants.some((person) => person.name === 'Anna'), 'ben sees anna')

  const peeked = await emit(chris, 'session:peek', { sessionId })
  assert(peeked.ok && peeked.online >= 2, 'peek counts people')

  const observed = await emit(chris, 'session:join', {
    sessionId,
    name: 'Chris',
    participantId: chrisId,
    role: 'observer',
  })
  assert(observed.ok, observed.error || 'observer join failed')
  assert(observed.state.you.role === 'observer', 'observer role')

  const annaAfterJoin = await emit(anna, 'session:resume', { sessionId, participantId: annaId })
  assert(
    annaAfterJoin.state.participants.some((person) => person.name === 'Chris' && person.role === 'observer'),
    'observer appears live',
  )

  const rejectedObserverVote = await emit(chris, 'vote:cast', { sessionId, participantId: chrisId, value: '5' })
  assert(!rejectedObserverVote.ok, 'observer must not vote')

  const chatTooEarly = await emit(anna, 'chat:send', { sessionId, participantId: annaId, text: 'zu früh' })
  assert(!chatTooEarly.ok, 'chat closed before reveal')

  const benHearsVote = waitFor(ben, (state) => state.participants.some((person) => person.name === 'Anna' && person.hasVoted))
  const annaVote = await emit(anna, 'vote:cast', { sessionId, participantId: annaId, value: '5' })
  assert(annaVote.ok && annaVote.state.you.vote === '5', 'anna voted 5')
  let benView = await benHearsVote
  let annaRow = benView.participants.find((person) => person.name === 'Anna')
  assert(annaRow.hasVoted && annaRow.vote == null, 'vote stays hidden')
  assert(benView.progress.eligible === 2 && benView.progress.voted === 1, 'observer excluded from progress')

  const changed = await emit(anna, 'vote:cast', { sessionId, participantId: annaId, value: '13' })
  assert(changed.state.you.vote === '13', 'vote can change')

  await emit(ben, 'vote:cast', { sessionId, participantId: benId, value: '1' })

  const benCannotReveal = await emit(ben, 'round:reveal', { sessionId, participantId: benId })
  assert(!benCannotReveal.ok, 'only moderator reveals')

  const benCannotDeck = await emit(ben, 'deck:set', { sessionId, participantId: benId, deck: 'tshirt' })
  assert(!benCannotDeck.ok, 'voter cannot change deck')

  const deckBlocked = await emit(anna, 'deck:set', { sessionId, participantId: annaId, deck: 'tshirt' })
  assert(!deckBlocked.ok, 'deck locked after votes')

  const revealedPromise = waitFor(
    ben,
    (state) => state.revealed && state.participants.some((person) => person.name === 'Anna' && person.vote === '13'),
  )
  const revealed = await emit(anna, 'round:reveal', { sessionId, participantId: annaId })
  assert(revealed.ok, revealed.error || 'reveal failed')
  benView = await revealedPromise
  annaRow = benView.participants.find((person) => person.name === 'Anna')
  const benRow = benView.participants.find((person) => person.name === 'Ben')
  assert(annaRow.vote === '13' && benRow.vote === '1', 'votes visible together')
  assert(benView.stats.average === 7 && benView.stats.median === 7, 'average and median')
  assert(annaRow.highlight === 'high' && benRow.highlight === 'low', 'high and low highlighted')
  assert(benView.participants.find((person) => person.name === 'Chris').vote == null, 'observer has no vote')

  const noted = await emit(ben, 'chat:send', { sessionId, participantId: benId, text: '13 ist zu hoch' })
  assert(noted.ok, noted.error || 'chat failed')

  const saved = await emit(anna, 'round:save', { sessionId, participantId: annaId })
  assert(saved.ok && saved.state.history.length === 1, 'history saved')
  assert(saved.state.history[0].story.title === '', 'empty title allowed')
  await emit(anna, 'story:update', {
    sessionId,
    participantId: annaId,
    round: saved.state.round,
    title: 'Login',
    description: 'Maske',
    ticketUrl: 'https://example.test/T-1',
  })
  const updated = await emit(anna, 'round:save', { sessionId, participantId: annaId })
  assert(updated.state.history.length === 1, 'save replaces same round')
  assert(updated.state.history[0].story.title === 'Login', 'story stored')
  assert(updated.state.history[0].stats.average === 7, 'stats stored')

  const next = await emit(anna, 'round:next', { sessionId, participantId: annaId })
  assert(next.ok, next.error || 'next failed')
  assert(next.state.revealed === false, 'new round hides votes')
  assert(next.state.you.vote == null, 'votes cleared')
  assert(next.state.participants.every((person) => person.vote == null && !person.hasVoted), 'nobody still voted')
  assert(next.state.participants.some((person) => person.name === 'Ben'), 'participants stay')
  assert(next.state.history.length === 1, 'history kept')
  assert(next.state.story.title === '', 'story cleared')
  assert(next.state.round === 2, 'round incremented')

  const switched = await emit(anna, 'deck:set', { sessionId, participantId: annaId, deck: 'tshirt' })
  assert(switched.ok && switched.state.deck.id === 'tshirt', 'tshirt deck')
  await emit(anna, 'vote:cast', { sessionId, participantId: annaId, value: 'M' })
  await emit(ben, 'vote:cast', { sessionId, participantId: benId, value: 'M' })
  const shirt = await emit(anna, 'round:reveal', { sessionId, participantId: annaId })
  assert(shirt.state.stats.consensus === true, 'tshirt consensus')
  assert(shirt.state.stats.average == null && shirt.state.stats.median == null, 'no numeric stats')
  assert(shirt.state.stats.low === 'M' && shirt.state.stats.high === 'M', 'order ends meet')

  const autoSaved = await emit(anna, 'round:next', { sessionId, participantId: annaId })
  assert(autoSaved.ok && autoSaved.state.history.length === 2, 'unsaved reveal is stored on the next round')
  assert(autoSaved.state.revealed === false && autoSaved.state.you.vote == null, 'next round clears votes')

  const timed = await emit(anna, 'timer:configure', { sessionId, participantId: annaId, durationSec: 30 })
  assert(timed.ok, 'timer configure')
  await emit(anna, 'timer:start', { sessionId, participantId: annaId })
  const running = await emit(anna, 'session:resume', { sessionId, participantId: annaId })
  assert(running.state.timer.running === true, 'timer running for everyone via state')
  assert(running.state.timer.endsAt > Date.now(), 'ends in the future')
  await emit(anna, 'timer:pause', { sessionId, participantId: annaId })

  const handed = await emit(anna, 'moderator:transfer', {
    sessionId,
    participantId: annaId,
    targetId: benId,
  })
  assert(handed.ok && handed.state.you.role === 'voter', 'moderation transferred')
  const benNow = await emit(ben, 'session:resume', { sessionId, participantId: benId })
  assert(benNow.state.you.role === 'moderator', 'ben is moderator')

  const offlinePromise = waitFor(anna, (state) => state.participants.some((person) => person.name === 'Ben' && person.online === false))
  ben.disconnect()
  const offline = await offlinePromise
  const benOffline = offline.participants.find((person) => person.name === 'Ben')
  assert(benOffline && benOffline.online === false, 'disconnect marks offline')

  const claim = await emit(anna, 'moderator:claim', { sessionId, participantId: annaId })
  assert(claim.ok && claim.state.you.role === 'moderator', 'claim while moderator offline')

  anna.disconnect()
  chris.disconnect()
  console.log('smoke ok', sessionId)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  io.disconnectSockets(true)
  await new Promise((resolve) => {
    httpServer.close(() => resolve())
    setTimeout(resolve, 500)
  })
}
