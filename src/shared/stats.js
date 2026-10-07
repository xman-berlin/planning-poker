import { findCard, getDeck } from './decks.js'

function round2(value) {
  return Math.round(value * 100) / 100
}

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return round2((sorted[mid - 1] + sorted[mid]) / 2)
}

/**
 * Summarize revealed votes.
 * Numeric decks: average and median ignore ? and coffee.
 * T-shirt: no average/median; low/high follow S < M < L < XL.
 * Consensus when at least two comparable votes exist and they all match.
 */
export function summarize(deckId, voteValues) {
  const deck = getDeck(deckId)
  const cards = voteValues.map((value) => findCard(deckId, value)).filter(Boolean)
  const empty = {
    numeric: deck.numeric,
    average: null,
    median: null,
    low: null,
    high: null,
    consensus: false,
    comparableCount: 0,
    abstained: cards.length,
  }

  if (deck.numeric) {
    const comparable = cards.filter((card) => typeof card.numeric === 'number')
    const values = comparable.map((card) => card.numeric)
    if (!values.length) return empty
    const low = Math.min(...values)
    const high = Math.max(...values)
    return {
      numeric: true,
      average: round2(values.reduce((sum, value) => sum + value, 0) / values.length),
      median: medianOf(values),
      low: cardValueForNumeric(deck, low),
      high: cardValueForNumeric(deck, high),
      consensus: values.length >= 2 && low === high,
      comparableCount: values.length,
      abstained: cards.length - comparable.length,
    }
  }

  const comparable = cards.filter((card) => typeof card.order === 'number')
  if (!comparable.length) return empty
  const lowOrder = Math.min(...comparable.map((card) => card.order))
  const highOrder = Math.max(...comparable.map((card) => card.order))
  const lowCard = comparable.find((card) => card.order === lowOrder)
  const highCard = comparable.find((card) => card.order === highOrder)
  return {
    numeric: false,
    average: null,
    median: null,
    low: lowCard.value,
    high: highCard.value,
    consensus: comparable.length >= 2 && lowOrder === highOrder,
    comparableCount: comparable.length,
    abstained: cards.length - comparable.length,
  }
}

function cardValueForNumeric(deck, numeric) {
  const card = deck.cards.find((entry) => entry.numeric === numeric)
  return card ? card.value : String(numeric)
}

export function highlightFor(vote, stats) {
  if (!stats || !vote || stats.low == null || stats.high == null) return null
  if (stats.low === stats.high) return null
  if (vote === stats.low) return 'low'
  if (vote === stats.high) return 'high'
  return null
}
