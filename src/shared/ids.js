const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createSessionId() {
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  let id = ''
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length]
  return id
}

export function normalizeSessionId(raw) {
  const text = String(raw || '').trim()
  const fromUrl = text.match(/\/s\/([A-Za-z0-9]{6,8})(?:[/?#]|$)/i)
  const source = fromUrl ? fromUrl[1] : text
  const id = source.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (id.length < 6 || id.length > 8) return null
  return id
}

export function isParticipantId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(value)
}
