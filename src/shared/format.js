export function formatPoints(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const number = Number(value)
  if (number === 0.5) return '½'
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(number)
}

export function formatStamp(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.ceil(Number(totalSeconds) || 0))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatSessionCode(id) {
  return String(id || '')
    .replace(/(.{3})(?=.)/g, '$1\u2009')
    .trim()
}

export function plainVoteLabel(value, label) {
  if (value === 'coffee') return 'Kaffee'
  if (value === '0.5') return '0,5'
  if (value == null) return '—'
  return label || String(value)
}

export function displayVoteLabel(value, label) {
  if (value == null) return '—'
  return label || String(value)
}
