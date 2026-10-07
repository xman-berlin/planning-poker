import fs from 'node:fs'
import path from 'node:path'
import { createClient } from 'redis'

export const REDIS_SESSIONS_KEY = 'planungspoker:sessions'

export function selectSessionBackend(options = {}, env = process.env) {
  const fileProvided = Object.prototype.hasOwnProperty.call(options, 'dataFile')
  const redisProvided = Object.prototype.hasOwnProperty.call(options, 'redisUrl')
  const redisUrl = String((redisProvided ? options.redisUrl : fileProvided ? '' : env.REDIS_URL) || '').trim()
  if (redisUrl) return { kind: 'redis', redisUrl }
  const dataFile = fileProvided ? options.dataFile : options.defaultDataFile
  if (!dataFile) return { kind: 'none' }
  return { kind: 'file', dataFile }
}

export async function resolveSessionStore(options = {}, env = process.env) {
  if (Object.prototype.hasOwnProperty.call(options, 'store')) return options.store
  const choice = selectSessionBackend(options, env)
  if (choice.kind === 'redis') return openRedisStore(choice.redisUrl)
  if (choice.kind === 'file') return openSessionStore(choice.dataFile)
  return null
}

export function encodeSessions(sessions) {
  return JSON.stringify({ version: 1, sessions }, null, 2)
}

export function decodeSessions(raw) {
  const parsed = JSON.parse(raw)
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
    throw new Error('unerwartetes Format')
  }
  return parsed.sessions
}

export function openSessionStore(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  function read() {
    if (!fs.existsSync(filePath)) return []
    let raw = ''
    try {
      raw = fs.readFileSync(filePath, 'utf8')
      if (!raw.trim()) return []
      return decodeSessions(raw)
    } catch (error) {
      console.error(`sessions.json unlesbar (${error.message}). Starte ohne diese Datei.`)
      try {
        if (raw) fs.writeFileSync(`${filePath}.broken`, raw)
      } catch (copyError) {
        console.error('Konnte die defekte Datei nicht beiseite legen:', copyError.message)
      }
      return []
    }
  }

  function write(sessions) {
    const payload = encodeSessions(sessions)
    const tmp = `${filePath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, payload)
    fs.renameSync(tmp, filePath)
  }

  return {
    kind: 'file',
    filePath,
    read: async () => read(),
    write: async (sessions) => write(sessions),
    async close() {},
  }
}

export function createRedisSessionStore(client, { key = REDIS_SESSIONS_KEY } = {}) {
  let closed = false

  return {
    kind: 'redis',
    key,
    async read() {
      const raw = await client.get(key)
      if (raw == null || !String(raw).trim()) return []
      try {
        return decodeSessions(raw)
      } catch (error) {
        console.error(`Redis-Sessions unlesbar (${error.message}). Starte ohne diesen Stand.`)
        try {
          await client.set(`${key}:broken`, raw)
        } catch (copyError) {
          console.error('Konnte den defekten Stand nicht beiseite legen:', copyError.message)
        }
        return []
      }
    },
    async write(sessions) {
      await client.set(key, encodeSessions(sessions))
    },
    async close() {
      if (closed) return
      closed = true
      if (typeof client.quit !== 'function' || client.isOpen === false) return
      await client.quit()
    },
  }
}

export async function openRedisStore(redisUrl, options = {}) {
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 10_000,
      reconnectStrategy(retries) {
        return Math.min(200 * 2 ** Math.min(retries, 5), 5_000)
      },
    },
  })
  client.on('error', (error) => {
    console.error('Redis:', error.message)
  })
  await client.connect()
  return createRedisSessionStore(client, options)
}

export function serializeSession(session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    deck: session.deck,
    revealed: session.revealed,
    round: session.round,
    roundSaved: session.roundSaved,
    story: { ...session.story },
    timer: {
      durationSec: session.timer.durationSec,
      remainingSec: session.timer.remainingSec,
      running: Boolean(session.timer.running),
      endsAt: session.timer.endsAt,
      expired: Boolean(session.timer.expired),
    },
    participants: [...session.participants.values()].map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      vote: person.vote ?? null,
    })),
    history: session.history,
    chat: session.chat,
  }
}

export function hydrateSession(data) {
  const participants = new Map()
  for (const person of data.participants || []) {
    if (!person?.id || !person.name) continue
    participants.set(person.id, {
      id: person.id,
      name: person.name,
      role: person.role === 'moderator' || person.role === 'observer' ? person.role : 'voter',
      vote: person.vote ?? null,
      online: false,
      socketId: null,
      offlineAt: Date.now(),
    })
  }

  const deck = data.deck === 'tshirt' ? 'tshirt' : 'fibonacci'
  const timer = data.timer || {}
  return {
    id: data.id,
    createdAt: data.createdAt || new Date().toISOString(),
    deck,
    revealed: Boolean(data.revealed),
    round: Number(data.round) || 1,
    roundSaved: Boolean(data.roundSaved),
    story: {
      title: data.story?.title || '',
      description: data.story?.description || '',
      ticketUrl: data.story?.ticketUrl || '',
    },
    timer: {
      durationSec: Number(timer.durationSec) || 120,
      remainingSec: Number(timer.remainingSec) || 0,
      running: Boolean(timer.running),
      endsAt: timer.endsAt || null,
      expired: Boolean(timer.expired),
    },
    timerHandle: null,
    participants,
    history: Array.isArray(data.history) ? data.history : [],
    chat: Array.isArray(data.chat) ? data.chat : [],
  }
}
