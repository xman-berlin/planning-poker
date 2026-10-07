import assert from 'node:assert/strict'
import test from 'node:test'
import { historyToCsv, historyToText } from './export.js'

const history = [
  {
    round: 1,
    savedAt: '2026-10-05T12:30:00.000Z',
    story: { title: '=HYPERLINK()', description: 'Zeile "zwei"', ticketUrl: 'https://example.test/T-1' },
    deck: 'fibonacci',
    deckLabel: 'Fibonacci',
    votes: [
      { name: 'Anna', value: '0.5', label: '½' },
      { name: 'Ben', value: 'coffee', label: '☕' },
    ],
    stats: {
      numeric: true,
      average: 0.5,
      median: 0.5,
      low: '0.5',
      high: '0.5',
      consensus: false,
    },
  },
]

test('text export names the session and special votes', () => {
  const text = historyToText('K7MQ2P', history)
  assert.match(text, /Planungspoker K7MQ2P/)
  assert.match(text, /Anna: ½/)
  assert.match(text, /Ben: ☕/)
  assert.match(text, /Durchschnitt: ½/)
})

test('csv is semicolon separated, quoted, and guards formulas', () => {
  const csv = historyToCsv(history)
  assert.ok(csv.charCodeAt(0) === 0xfeff)
  assert.match(csv, /"Runde";"Zeit";"Story"/)
  assert.match(csv, /"'=HYPERLINK\(\)"/)
  assert.match(csv, /Zeile ""zwei""/)
  assert.match(csv, /Anna: 0,5 \| Ben: Kaffee/)
})
