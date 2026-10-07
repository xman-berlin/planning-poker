const storageKey = (sessionId) => `pp-member:${sessionId}`

export function createParticipantId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function readMember(sessionId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(sessionId)) || 'null')
    if (!parsed?.participantId) return null
    return parsed
  } catch {
    return null
  }
}

export function writeMember(sessionId, member) {
  localStorage.setItem(storageKey(sessionId), JSON.stringify(member))
}

export function clearMember(sessionId) {
  localStorage.removeItem(storageKey(sessionId))
}

export function rememberedName() {
  return localStorage.getItem('pp-name') || ''
}

export function rememberName(name) {
  localStorage.setItem('pp-name', name)
}
