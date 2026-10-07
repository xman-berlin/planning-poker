const COLORS = ['#0f6e64', '#8a5a12', '#2c5f8a', '#8a3d32', '#3d6a38', '#6a4c7a']

export function initials(name) {
  const parts = String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
  const letters = parts.map((part) => part[0]?.toUpperCase() || '').join('')
  return letters || '?'
}

export function colorFor(name) {
  let hash = 0
  for (const char of String(name || '')) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]
}

export function roleLabel(role) {
  if (role === 'moderator') return 'Moderator'
  if (role === 'observer') return 'Beobachter'
  return 'Teilnehmer'
}
