import assert from 'node:assert/strict'
import test from 'node:test'
import { highlightFor, summarize } from './stats.js'

test('Fibonacci average, median, and high/low ignore specials', () => {
  const stats = summarize('fibonacci', ['1', '5', '13', '5', '?', 'coffee'])
  assert.equal(stats.average, 6)
  assert.equal(stats.median, 5)
  assert.equal(stats.low, '1')
  assert.equal(stats.high, '13')
  assert.equal(stats.consensus, false)
  assert.equal(stats.abstained, 2)
  assert.equal(highlightFor('1', stats), 'low')
  assert.equal(highlightFor('13', stats), 'high')
  assert.equal(highlightFor('5', stats), null)
  assert.equal(highlightFor('?', stats), null)
})

test('half points stay exact', () => {
  const stats = summarize('fibonacci', ['0.5', '1'])
  assert.equal(stats.average, 0.75)
  assert.equal(stats.median, 0.75)
})

test('even median averages the two middle values', () => {
  const stats = summarize('fibonacci', ['1', '2', '3', '8'])
  assert.equal(stats.median, 2.5)
  assert.equal(stats.average, 3.5)
})

test('consensus needs two identical comparable votes', () => {
  assert.equal(summarize('fibonacci', ['8']).consensus, false)
  const agreed = summarize('fibonacci', ['8', '8', 'coffee'])
  assert.equal(agreed.consensus, true)
  assert.equal(agreed.abstained, 1)
  assert.equal(highlightFor('8', agreed), null)
})

test('only abstentions produce empty numeric stats', () => {
  const stats = summarize('fibonacci', ['?', 'coffee'])
  assert.equal(stats.average, null)
  assert.equal(stats.median, null)
  assert.equal(stats.consensus, false)
})

test('T-shirt has order, no average, and consensus', () => {
  const spread = summarize('tshirt', ['S', 'XL', 'M'])
  assert.equal(spread.numeric, false)
  assert.equal(spread.average, null)
  assert.equal(spread.median, null)
  assert.equal(spread.low, 'S')
  assert.equal(spread.high, 'XL')
  assert.equal(spread.consensus, false)
  assert.equal(highlightFor('S', spread), 'low')
  assert.equal(highlightFor('XL', spread), 'high')
  assert.equal(highlightFor('M', spread), null)

  const agreed = summarize('tshirt', ['M', 'M', 'M'])
  assert.equal(agreed.consensus, true)
  assert.equal(highlightFor('M', agreed), null)
})
