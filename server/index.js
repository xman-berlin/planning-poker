import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { createHub } from './hub.js'
import { resolveSessionStore } from './persist.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultDistDir = path.join(__dirname, '..', 'dist')
const defaultDataFile = path.join(__dirname, '..', 'data', 'sessions.json')

export async function createApp(options = {}) {
  const distDir = options.distDir || defaultDistDir
  const storeOptions = { defaultDataFile }
  if (Object.prototype.hasOwnProperty.call(options, 'store')) storeOptions.store = options.store
  if (Object.prototype.hasOwnProperty.call(options, 'dataFile')) storeOptions.dataFile = options.dataFile
  if (Object.prototype.hasOwnProperty.call(options, 'redisUrl')) storeOptions.redisUrl = options.redisUrl
  const store = await resolveSessionStore(storeOptions)

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  const httpServer = createServer(app)
  const io = new Server(httpServer, {
    cors: { origin: false },
    transports: ['websocket', 'polling'],
  })
  const hub = await createHub(io, { store })

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

  return { app, httpServer, io, hub, store }
}

function describeStore(store) {
  if (!store) return 'ohne Persistenz'
  if (store.kind === 'redis') return 'Redis (REDIS_URL)'
  if (store.kind === 'file') return `Datei ${store.filePath}`
  return store.kind || 'Store'
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isDirectRun) {
  const port = Number(process.env.PORT) || 3000
  try {
    const { httpServer, hub, store } = await createApp()
    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`Planungspoker läuft auf http://localhost:${port}`)
      console.log(`Sessions: ${describeStore(store)}`)
    })

    let stopping = false
    const shutdown = (signal) => {
      if (stopping) return
      stopping = true
      console.log(`${signal}: speichere Sessions und beende.`)
      const kill = setTimeout(() => process.exit(1), 8000)
      kill.unref()
      hub
        .flush()
        .catch((error) => console.error('Speichern beim Beenden fehlgeschlagen:', error))
        .then(
          () =>
            new Promise((resolve) => {
              httpServer.close(resolve)
            }),
        )
        .then(() => store?.close?.())
        .catch((error) => console.error('Speicherverbindung beim Beenden:', error))
        .finally(() => {
          clearTimeout(kill)
          process.exit(0)
        })
    }
    process.once('SIGTERM', () => shutdown('SIGTERM'))
    process.once('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    console.error('Planungspoker konnte nicht starten:', error)
    process.exit(1)
  }
}
