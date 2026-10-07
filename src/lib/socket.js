import { io } from 'socket.io-client'

export const socket = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
})

export function request(event, payload, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false
    const finish = (value) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(value || { ok: false, error: 'Keine Antwort vom Server.' })
    }
    const timer = setTimeout(() => finish({ ok: false, error: 'Keine Antwort vom Server.' }), timeoutMs)
    socket.emit(event, payload, finish)
  })
}
