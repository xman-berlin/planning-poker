import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createApp } from './index.js'

test('health stays JSON and session links serve the SPA', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-http-'))
  const distDir = path.join(dir, 'dist')
  fs.mkdirSync(distDir)
  fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>Planungspoker</title>')
  const { httpServer } = await createApp({
    dataFile: path.join(dir, 'sessions.json'),
    distDir,
  })
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  const port = httpServer.address().port
  try {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`)
    assert.equal(health.status, 200)
    const body = await health.json()
    assert.equal(body.ok, true)
    assert.equal(body.sessions, 0)

    const room = await fetch(`http://127.0.0.1:${port}/s/AB2345`)
    assert.equal(room.status, 200)
    assert.match(room.headers.get('content-type') || '', /html/)
    assert.match(await room.text(), /Planungspoker/)

    const home = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(home.status, 200)
    assert.match(await home.text(), /Planungspoker/)
  } finally {
    await new Promise((resolve) => httpServer.close(resolve))
  }
})
