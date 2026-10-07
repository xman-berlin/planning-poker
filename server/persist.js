import fs from 'node:fs'
import path from 'node:path'

export function openSessionStore(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  function read() {
    if (!fs.existsSync(filePath)) return []
    let raw = ''
    try {
      raw = fs.readFileSync(filePath, 'utf8')
      if (!raw.trim()) return []
      const parsed = JSON.parse(raw)
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
        throw new Error('unerwartetes Format')
      }
      return parsed.sessions
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
    const payload = JSON.stringify({ version: 1, sessions }, null, 2)
    const tmp = `${filePath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, payload)
    fs.renameSync(tmp, filePath)
  }

  return { read, write, filePath }
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
