import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { createHub } from './hub.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

export function createApp(options = {}) {
  const dataFile = Object.prototype.hasOwnProperty.call(options, 'dataFile')
    ? options.dataFile
    : path.join(__dirname, '..', 'data', 'sessions.json')
  const app = express()
  app.disable('x-powered-by')
  const httpServer = createServer(app)
  const io = new Server(httpServer, {
    cors: { origin: false },
  })
  const hub = createHub(io, { dataFile })

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, sessions: hub.sessions.size })
  })

  app.use(express.static(distDir, { index: false, maxAge: '1h' }))

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next()
    res.sendFile(path.join(distDir, 'index.html'), (error) => {
      if (error) next()
    })
  })

  httpServer.on('close', () => hub.close())

  return { app, httpServer, io, hub }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isDirectRun) {
  const port = Number(process.env.PORT) || 3000
  const { httpServer } = createApp()
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Planungspoker läuft auf http://localhost:${port}`)
  })
}
