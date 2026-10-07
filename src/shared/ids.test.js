import assert from 'node:assert/strict'
import test from 'node:test'
import { createSessionId, normalizeSessionId } from './ids.js'

test('session ids are 6 unambiguous characters', () => {
  const id = createSessionId()
  assert.match(id, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
})

test('normalize accepts codes and share links', () => {
  assert.equal(normalizeSessionId('k7mq2p'), 'K7MQ2P')
  assert.equal(normalizeSessionId('https://example.test/s/k7mq2p'), 'K7MQ2P')
  assert.equal(normalizeSessionId('  ab-c12 3 '), 'ABC123')
  assert.equal(normalizeSessionId('abc'), null)
  assert.equal(normalizeSessionId(''), null)
})
