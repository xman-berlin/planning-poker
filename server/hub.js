import { findCard, getDeck, publicDeck } from '../src/shared/decks.js'
import { formatStamp } from '../src/shared/format.js'
import { createSessionId, isParticipantId, normalizeSessionId } from '../src/shared/ids.js'
import { highlightFor, summarize } from '../src/shared/stats.js'
import { hydrateSession, serializeSession } from './persist.js'

const MAX_SESSIONS = 200
const MAX_PARTICIPANTS = 30
const MAX_CHAT = 200
const MAX_HISTORY = 100
const TIMER_PRESETS = new Set([30, 60, 120, 180, 300])

function cleanName(name) {
  const value = String(name || '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!value) return { error: 'Bitte einen Namen eingeben.' }
  if (value.length > 40) return { error: 'Der Name darf höchstens 40 Zeichen haben.' }
  return { value }
}

function cleanText(value, max) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max)
}

function cleanTicket(value) {
  const text = cleanText(value, 500)
  if (!text) return ''
  if (!/^https?:\/\//i.test(text)) return text
  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString().slice(0, 500)
  } catch {
    return ''
  }
}

function voteLabel(deckId, value) {
  const card = findCard(deckId, value)
  return card?.label || value
}

export async function createHub(io, options = {}) {
  const store = options.store || null
  const sessions = new Map()
  const socketIndex = new Map()
  let writeChain = Promise.resolve()

  function persist() {
    if (!store) return
    let snapshot
    try {
      snapshot = JSON.parse(JSON.stringify([...sessions.values()].map(serializeSession)))
    } catch (error) {
      console.error('Session konnte nicht gespeichert werden:', error)
      return
    }
    writeChain = writeChain.then(() => store.write(snapshot)).catch((error) => {
      console.error('Session konnte nicht gespeichert werden:', error)
    })
  }

  function flush() {
    return writeChain
  }

  function destroySession(session) {
    clearTimeout(session.timerHandle)
    sessions.delete(session.id)
    persist()
  }

  function scheduleTimer(session) {
    clearTimeout(session.timerHandle)
    if (!session.timer.running || !session.timer.endsAt) return
    const wait = Math.max(0, session.timer.endsAt - Date.now())
    session.timerHandle = setTimeout(() => {
      session.timer.running = false
      session.timer.endsAt = null
      session.timer.remainingSec = 0
      session.timer.expired = true
      broadcast(session)
    }, wait)
    session.timerHandle.unref?.()
  }

  function timerView(session) {
    const timer = session.timer
    let remainingSec = timer.remainingSec
    if (timer.running && timer.endsAt) {
      remainingSec = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000))
    }
    return {
      durationSec: timer.durationSec,
      running: Boolean(timer.running && remainingSec > 0),
      endsAt: timer.running ? timer.endsAt : null,
      remainingSec,
      expired: Boolean(timer.expired),
      serverNow: Date.now(),
    }
  }

  function buildHistoryEntry(session) {
    const voters = [...session.participants.values()].filter(
      (person) => person.role !== 'observer' && person.vote != null,
    )
    const values = voters.map((person) => person.vote)
    return {
      id: globalThis.crypto.randomUUID(),
      round: session.round,
      savedAt: new Date().toISOString(),
      story: { ...session.story },
      deck: session.deck,
      deckLabel: getDeck(session.deck).label,
      votes: voters.map((person) => ({
        name: person.name,
        value: person.vote,
        label: voteLabel(session.deck, person.vote),
      })),
      stats: summarize(session.deck, values),
    }
  }

  function saveRound(session, { replace = false } = {}) {
    const entry = buildHistoryEntry(session)
    if (!entry.votes.length) return { error: 'Noch keine Schätzungen zum Sichern.' }
    const existingIndex = session.history.findIndex((item) => item.round === session.round)
    if (existingIndex >= 0 && replace) {
      entry.id = session.history[existingIndex].id
      session.history[existingIndex] = entry
    } else if (existingIndex === -1) {
      session.history.push(entry)
      if (session.history.length > MAX_HISTORY) session.history.shift()
    }
    session.roundSaved = true
    return { entry }
  }

  function viewFor(session, participantId) {
    const you = session.participants.get(participantId) || null
    const revealed = session.revealed
    const voteValues = []
    const participants = []

    for (const person of session.participants.values()) {
      if (person.role !== 'observer' && person.vote != null) voteValues.push(person.vote)
      const vote = revealed && person.role !== 'observer' ? person.vote : null
      participants.push({
        id: person.id,
        name: person.name,
        role: person.role,
        online: person.online,
        hasVoted: person.role !== 'observer' && person.vote != null,
        vote,
        voteLabel: vote ? voteLabel(session.deck, vote) : null,
        highlight: null,
      })
    }

    const stats = revealed ? summarize(session.deck, voteValues) : null
    if (stats) {
      for (const person of participants) {
        person.highlight = highlightFor(person.vote, stats)
      }
    }

    const eligible = [...session.participants.values()].filter(
      (person) => person.role !== 'observer' && (person.online || person.vote != null),
    )

    return {
      id: session.id,
      createdAt: session.createdAt,
      deck: publicDeck(session.deck),
      revealed,
      round: session.round,
      roundSaved: session.roundSaved,
      story: { ...session.story },
      timer: timerView(session),
      you: you
        ? {
            id: you.id,
            name: you.name,
            role: you.role,
            vote: you.role === 'observer' ? null : you.vote,
            voteLabel: you.vote ? voteLabel(session.deck, you.vote) : null,
          }
        : null,
      participants,
      stats,
      history: session.history,
      chat: session.chat,
      progress: {
        voted: eligible.filter((person) => person.vote != null).length,
        eligible: eligible.length,
      },
      serverTime: formatStamp(new Date().toISOString()),
    }
  }

  function broadcast(session) {
    persist()
    for (const person of session.participants.values()) {
      if (!person.socketId) continue
      io.to(person.socketId).emit('state', viewFor(session, person.id))
    }
  }

  function namesMatch(left, right) {
    return left.localeCompare(right, 'de', { sensitivity: 'accent' }) === 0
  }

  function findOfflineByName(session, name) {
    const matches = [...session.participants.values()].filter(
      (person) => !person.online && namesMatch(person.name, name),
    )
    return matches.length === 1 ? matches[0] : null
  }

  function bindSocket(socket, session, person) {
    const previous = person.socketId
    if (previous && previous !== socket.id) {
      socketIndex.delete(previous)
      io.to(previous).emit('session:elsewhere')
    }
    person.socketId = socket.id
    person.online = true
    person.offlineAt = null
    socketIndex.set(socket.id, { sessionId: session.id, participantId: person.id })
  }

  function createBlankSession() {
    let id = createSessionId()
    while (sessions.has(id)) id = createSessionId()
    const session = {
      id,
      createdAt: new Date().toISOString(),
      deck: 'fibonacci',
      revealed: false,
      round: 1,
      roundSaved: false,
      story: { title: '', description: '', ticketUrl: '' },
      timer: {
        durationSec: 120,
        remainingSec: 120,
        running: false,
        endsAt: null,
        expired: false,
      },
      timerHandle: null,
      participants: new Map(),
      history: [],
      chat: [],
    }
    sessions.set(id, session)
    return session
  }

  function addParticipant(session, { participantId, name, role }) {
    const person = {
      id: participantId,
      name,
      role,
      vote: null,
      online: true,
      socketId: null,
      offlineAt: null,
    }
    session.participants.set(participantId, person)
    return person
  }

  function actor(session, participantId, socket) {
    const person = session.participants.get(participantId)
    if (!person || person.socketId !== socket.id) {
      return { error: 'Du bist nicht in dieser Session.' }
    }
    return { person }
  }

  function requireModerator(person) {
    if (person.role !== 'moderator') return 'Das darf nur die Moderation.'
    return null
  }

  function resetTimer(session) {
    clearTimeout(session.timerHandle)
    session.timer.running = false
    session.timer.endsAt = null
    session.timer.expired = false
    session.timer.remainingSec = session.timer.durationSec
  }

  function hasVotes(session) {
    return [...session.participants.values()].some((person) => person.vote != null)
  }

  function moderatorOnline(session) {
    return [...session.participants.values()].some((person) => person.role === 'moderator' && person.online)
  }

  function onConnection(socket) {
    const wrap = (handler) => (payload = {}, ack) => {
      try {
        handler(payload, typeof ack === 'function' ? ack : () => {})
      } catch (error) {
        console.error(error)
        if (typeof ack === 'function') ack({ ok: false, error: 'Unerwarteter Fehler.' })
      }
    }

    socket.on(
      'session:peek',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const online = [...session.participants.values()].filter((person) => person.online).length
        ack({ ok: true, id: session.id, online, round: session.round })
      }),
    )

    socket.on(
      'session:create',
      wrap((payload, ack) => {
        if (sessions.size >= MAX_SESSIONS) {
          ack({ ok: false, error: 'Zu viele Sessions. Bitte später erneut versuchen.' })
          return
        }
        const name = cleanName(payload.name)
        if (name.error) {
          ack({ ok: false, error: name.error })
          return
        }
        if (!isParticipantId(payload.participantId)) {
          ack({ ok: false, error: 'Ungültige Teilnahme.' })
          return
        }
        const session = createBlankSession()
        const person = addParticipant(session, {
          participantId: payload.participantId,
          name: name.value,
          role: 'moderator',
        })
        bindSocket(socket, session, person)
        broadcast(session)
        ack({ ok: true, sessionId: session.id, participantId: person.id, state: viewFor(session, person.id) })
      }),
    )

    socket.on(
      'session:join',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        if (!isParticipantId(payload.participantId)) {
          ack({ ok: false, error: 'Ungültige Teilnahme.' })
          return
        }
        const existing = session.participants.get(payload.participantId)
        if (existing) {
          bindSocket(socket, session, existing)
          broadcast(session)
          ack({ ok: true, sessionId: session.id, participantId: existing.id, state: viewFor(session, existing.id) })
          return
        }
        const name = cleanName(payload.name)
        if (name.error) {
          ack({ ok: false, error: name.error })
          return
        }
        const reclaimed = findOfflineByName(session, name.value)
        if (reclaimed) {
          bindSocket(socket, session, reclaimed)
          broadcast(session)
          ack({
            ok: true,
            sessionId: session.id,
            participantId: reclaimed.id,
            reclaimed: true,
            state: viewFor(session, reclaimed.id),
          })
          return
        }
        if (session.participants.size >= MAX_PARTICIPANTS) {
          ack({ ok: false, error: 'Die Session ist voll.' })
          return
        }
        const role = payload.role === 'observer' ? 'observer' : 'voter'
        const person = addParticipant(session, {
          participantId: payload.participantId,
          name: name.value,
          role,
        })
        bindSocket(socket, session, person)
        broadcast(session)
        ack({ ok: true, sessionId: session.id, participantId: person.id, state: viewFor(session, person.id) })
      }),
    )

    socket.on(
      'session:resume',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const person = session.participants.get(payload.participantId)
        if (!person) {
          ack({ ok: false, error: 'Bitte tritt der Session erneut bei.' })
          return
        }
        bindSocket(socket, session, person)
        broadcast(session)
        ack({ ok: true, sessionId: session.id, participantId: person.id, state: viewFor(session, person.id) })
      }),
    )

    socket.on(
      'session:leave',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: true })
          return
        }
        const person = session.participants.get(payload.participantId)
        if (!person || person.socketId !== socket.id) {
          ack({ ok: true })
          return
        }
        // Keep the session on disk even if everyone leaves, so the join link stays valid.
        person.online = false
        person.socketId = null
        person.offlineAt = Date.now()
        socketIndex.delete(socket.id)
        const wasModerator = person.role === 'moderator'
        if (wasModerator) {
          const next =
            [...session.participants.values()].find(
              (entry) => entry.id !== person.id && entry.online && entry.role === 'voter',
            ) ||
            [...session.participants.values()].find((entry) => entry.id !== person.id && entry.online)
          if (next) {
            person.role = 'voter'
            next.role = 'moderator'
          }
        }
        broadcast(session)
        ack({ ok: true })
      }),
    )

    socket.on(
      'vote:cast',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        if (found.person.role === 'observer') {
          ack({ ok: false, error: 'Beobachter geben keine Schätzung ab.' })
          return
        }
        if (session.revealed) {
          ack({ ok: false, error: 'Die Karten sind schon aufgedeckt.' })
          return
        }
        const card = findCard(session.deck, payload.value)
        if (!card) {
          ack({ ok: false, error: 'Diese Karte gibt es im aktuellen Deck nicht.' })
          return
        }
        found.person.vote = card.value
        broadcast(session)
        ack({ ok: true, state: viewFor(session, found.person.id) })
      }),
    )

    socket.on(
      'round:reveal',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        if (!hasVotes(session)) {
          ack({ ok: false, error: 'Noch keine Schätzungen.' })
          return
        }
        session.revealed = true
        broadcast(session)
        ack({ ok: true, state: viewFor(session, found.person.id) })
      }),
    )

    socket.on(
      'round:save',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        if (!session.revealed) {
          ack({ ok: false, error: 'Bitte zuerst die Karten aufdecken.' })
          return
        }
        const saved = saveRound(session, { replace: true })
        if (saved.error) {
          ack({ ok: false, error: saved.error })
          return
        }
        broadcast(session)
        ack({ ok: true, state: viewFor(session, found.person.id) })
      }),
    )

    socket.on(
      'round:next',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        if (session.revealed && !session.roundSaved && hasVotes(session)) saveRound(session)
        session.round += 1
        session.revealed = false
        session.roundSaved = false
        session.story = { title: '', description: '', ticketUrl: '' }
        for (const person of session.participants.values()) person.vote = null
        resetTimer(session)
        broadcast(session)
        ack({ ok: true, state: viewFor(session, found.person.id) })
      }),
    )

    socket.on(
      'deck:set',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        if (!getDeck(payload.deck) || (payload.deck !== 'fibonacci' && payload.deck !== 'tshirt')) {
          ack({ ok: false, error: 'Unbekanntes Deck.' })
          return
        }
        if (session.revealed || hasVotes(session)) {
          ack({ ok: false, error: 'Das Deck kann nur zu Beginn einer Runde gewechselt werden.' })
          return
        }
        session.deck = payload.deck
        broadcast(session)
        ack({ ok: true, state: viewFor(session, found.person.id) })
      }),
    )

    socket.on(
      'story:update',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        if (payload.round != null && Number(payload.round) !== session.round) {
          ack({ ok: false, error: 'Die Runde hat gerade gewechselt.' })
          return
        }
        session.story = {
          title: cleanText(payload.title, 140),
          description: cleanText(payload.description, 2000),
          ticketUrl: cleanTicket(payload.ticketUrl),
        }
        broadcast(session)
        ack({ ok: true })
      }),
    )

    socket.on(
      'timer:configure',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        const durationSec = Number(payload.durationSec)
        if (!TIMER_PRESETS.has(durationSec)) {
          ack({ ok: false, error: 'Diese Zeitspanne gibt es nicht.' })
          return
        }
        clearTimeout(session.timerHandle)
        session.timer.durationSec = durationSec
        session.timer.remainingSec = durationSec
        session.timer.running = false
        session.timer.endsAt = null
        session.timer.expired = false
        broadcast(session)
        ack({ ok: true })
      }),
    )

    socket.on(
      'timer:start',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        if (session.timer.remainingSec <= 0) session.timer.remainingSec = session.timer.durationSec
        session.timer.running = true
        session.timer.expired = false
        session.timer.endsAt = Date.now() + session.timer.remainingSec * 1000
        scheduleTimer(session)
        broadcast(session)
        ack({ ok: true })
      }),
    )

    socket.on(
      'timer:pause',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        if (session.timer.running && session.timer.endsAt) {
          session.timer.remainingSec = Math.max(0, Math.ceil((session.timer.endsAt - Date.now()) / 1000))
        }
        session.timer.running = false
        session.timer.endsAt = null
        clearTimeout(session.timerHandle)
        broadcast(session)
        ack({ ok: true })
      }),
    )

    socket.on(
      'timer:reset',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        resetTimer(session)
        broadcast(session)
        ack({ ok: true })
      }),
    )

    socket.on(
      'chat:send',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        if (!session.revealed) {
          ack({ ok: false, error: 'Die Diskussion startet nach dem Aufdecken.' })
          return
        }
        const text = cleanText(payload.text, 500)
        if (!text) {
          ack({ ok: false, error: 'Bitte eine kurze Notiz eingeben.' })
          return
        }
        session.chat.push({
          id: globalThis.crypto.randomUUID(),
          name: found.person.name,
          participantId: found.person.id,
          text,
          at: new Date().toISOString(),
          round: session.round,
        })
        if (session.chat.length > MAX_CHAT) session.chat.shift()
        broadcast(session)
        ack({ ok: true })
      }),
    )

    socket.on(
      'moderator:transfer',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        const denied = requireModerator(found.person)
        if (denied) {
          ack({ ok: false, error: denied })
          return
        }
        const target = session.participants.get(payload.targetId)
        if (!target || target.id === found.person.id) {
          ack({ ok: false, error: 'Die Person ist nicht in der Session.' })
          return
        }
        if (!target.online) {
          ack({ ok: false, error: 'Die Person ist gerade offline.' })
          return
        }
        if (target.role === 'observer') {
          ack({ ok: false, error: 'Beobachter können die Moderation nicht übernehmen.' })
          return
        }
        found.person.role = 'voter'
        target.role = 'moderator'
        broadcast(session)
        ack({ ok: true, state: viewFor(session, found.person.id) })
      }),
    )

    socket.on(
      'moderator:claim',
      wrap((payload, ack) => {
        const sessionId = normalizeSessionId(payload.sessionId)
        const session = sessionId ? sessions.get(sessionId) : null
        if (!session) {
          ack({ ok: false, error: 'Diese Session gibt es nicht.' })
          return
        }
        const found = actor(session, payload.participantId, socket)
        if (found.error) {
          ack({ ok: false, error: found.error })
          return
        }
        if (found.person.role !== 'voter') {
          ack({ ok: false, error: 'Nur Teilnehmende können die Moderation übernehmen.' })
          return
        }
        if (moderatorOnline(session)) {
          ack({ ok: false, error: 'Die Moderation ist noch anwesend.' })
          return
        }
        const current = [...session.participants.values()].find((person) => person.role === 'moderator')
        if (current) current.role = 'voter'
        found.person.role = 'moderator'
        broadcast(session)
        ack({ ok: true, state: viewFor(session, found.person.id) })
      }),
    )

    socket.on('disconnect', () => {
      const location = socketIndex.get(socket.id)
      socketIndex.delete(socket.id)
      if (!location) return
      const session = sessions.get(location.sessionId)
      if (!session) return
      const person = session.participants.get(location.participantId)
      if (!person || person.socketId !== socket.id) return
      person.online = false
      person.socketId = null
      person.offlineAt = Date.now()
      broadcast(session)
    })
  }

  if (store) {
    let dirty = false
    const stored = await store.read()
    for (const raw of stored) {
      if (!raw?.id || typeof raw.id !== 'string') continue
      const session = hydrateSession(raw)
      if (session.timer.running) {
        if (!session.timer.endsAt || session.timer.endsAt <= Date.now()) {
          session.timer.running = false
          session.timer.endsAt = null
          session.timer.remainingSec = 0
          session.timer.expired = true
          dirty = true
        } else {
          scheduleTimer(session)
        }
      }
      sessions.set(session.id, session)
    }
    if (dirty) {
      persist()
      await flush()
    }
  }

  io.on('connection', onConnection)

  return {
    sessions,
    storeKind: store?.kind || 'none',
    flush,
    close() {
      for (const session of sessions.values()) clearTimeout(session.timerHandle)
    },
  }
}
