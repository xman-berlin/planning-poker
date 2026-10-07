import { formatPoints, formatStamp, plainVoteLabel } from './format.js'

function csvNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return ''
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(Number(value))
}

function csvCell(value) {
  const raw = String(value ?? '')
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${guarded.replace(/"/g, '""')}"`
}

function voteList(entry, plain) {
  return (entry.votes || [])
    .map((vote) => {
      const label = plain ? plainVoteLabel(vote.value, vote.label) : vote.label || vote.value
      return `${vote.name}: ${label}`
    })
    .join(plain ? ' | ' : ', ')
}

function statsLines(entry) {
  const stats = entry.stats
  if (!stats) return []
  if (!stats.numeric) {
    return [
      'Durchschnitt: —',
      'Median: —',
      `Niedrigste: ${stats.low || '—'}`,
      `Höchste: ${stats.high || '—'}`,
      `Konsens: ${stats.consensus ? 'ja' : 'nein'}`,
    ]
  }
  return [
    `Durchschnitt: ${formatPoints(stats.average)}`,
    `Median: ${formatPoints(stats.median)}`,
    `Niedrigste: ${formatPoints(cardNumber(entry.deck, stats.low))}`,
    `Höchste: ${formatPoints(cardNumber(entry.deck, stats.high))}`,
    `Konsens: ${stats.consensus ? 'ja' : 'nein'}`,
  ]
}

function cardNumber(deckId, value) {
  if (value == null) return null
  if (value === '0.5') return 0.5
  const number = Number(value)
  return Number.isNaN(number) ? null : number
}

export function historyToText(sessionId, history) {
  const blocks = (history || []).map((entry) => {
    const title = entry.story?.title?.trim() || 'Ohne Titel'
    const lines = [
      `Runde ${entry.round} · ${formatStamp(entry.savedAt)}`,
      `Story: ${title}`,
    ]
    if (entry.story?.description?.trim()) lines.push(`Beschreibung: ${entry.story.description.trim()}`)
    if (entry.story?.ticketUrl?.trim()) lines.push(`Ticket: ${entry.story.ticketUrl.trim()}`)
    lines.push(`Deck: ${entry.deckLabel || entry.deck}`)
    lines.push(`Stimmen: ${voteList(entry) || '—'}`)
    lines.push(...statsLines(entry))
    return lines.join('\n')
  })
  return [`Planungspoker ${sessionId}`, '', blocks.join('\n\n') || 'Noch keine gespeicherten Runden.'].join('\n')
}

export function roundToText(sessionId, view) {
  const votes = (view.participants || [])
    .filter((person) => person.role !== 'observer' && person.vote)
    .map((person) => ({ name: person.name, value: person.vote, label: person.voteLabel || person.vote }))
  return historyToText(sessionId, [
    {
      round: view.round,
      savedAt: new Date().toISOString(),
      story: view.story,
      deck: view.deck?.id,
      deckLabel: view.deck?.label,
      votes,
      stats: view.stats,
    },
  ])
}

export function historyToCsv(history) {
  const header = [
    'Runde',
    'Zeit',
    'Story',
    'Beschreibung',
    'Ticket',
    'Deck',
    'Stimmen',
    'Durchschnitt',
    'Median',
    'Niedrigste',
    'Höchste',
    'Konsens',
  ]
  const rows = (history || []).map((entry) => {
    const stats = entry.stats || {}
    return [
      entry.round,
      formatStamp(entry.savedAt),
      entry.story?.title?.trim() || 'Ohne Titel',
      entry.story?.description?.trim() || '',
      entry.story?.ticketUrl?.trim() || '',
      entry.deckLabel || entry.deck || '',
      voteList(entry, true),
      stats.numeric ? csvNumber(stats.average) : '',
      stats.numeric ? csvNumber(stats.median) : '',
      stats.low ? plainVoteLabel(stats.low, stats.low === '0.5' ? '½' : stats.low) : '',
      stats.high ? plainVoteLabel(stats.high, stats.high === '0.5' ? '½' : stats.high) : '',
      stats.consensus ? 'ja' : 'nein',
    ]
  })
  const body = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n')
  return `\uFEFF${body}\n`
}
