import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatClock } from '../shared/format.js'

const PRESETS = [
  { seconds: 30, label: '0:30' },
  { seconds: 60, label: '1:00' },
  { seconds: 120, label: '2:00' },
  { seconds: 180, label: '3:00' },
  { seconds: 300, label: '5:00' },
]

function useCountdown(timer) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!timer?.running) return undefined
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [timer?.running, timer?.endsAt])

  if (!timer) return 0
  if (timer.running && timer.endsAt) {
    const offset = (timer.serverNow || now) - now
    return Math.max(0, (timer.endsAt - (Date.now() + offset)) / 1000)
  }
  return timer.remainingSec || 0
}

export default function TimerCard({ state, send }) {
  const timer = state.timer
  const remaining = useCountdown(timer)
  const isModerator = state.you?.role === 'moderator'
  const expired = timer.expired || remaining <= 0

  return (
    <section className="panel" aria-labelledby="timer-heading">
      <p className="kicker" id="timer-heading">
        Timer
      </p>
      <p className={expired && timer.durationSec > 0 && !timer.running ? 'clock expired' : 'clock'} aria-live="polite">
        {formatClock(remaining)}
      </p>
      {expired && !timer.running ? <p>Zeit ist um. Die Karten bleiben verdeckt.</p> : <p className="muted">Nur ein Hinweis, kein automatisches Aufdecken.</p>}
      {isModerator ? (
        <div className="stack" style={{ marginTop: '0.8rem' }}>
          <div className="segment" role="group" aria-label="Dauer wählen">
            {PRESETS.map((preset) => (
              <button
                key={preset.seconds}
                type="button"
                className="btn btn-sm"
                aria-pressed={timer.durationSec === preset.seconds}
                onClick={() => send('timer:configure', { durationSec: preset.seconds })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="cluster">
            {timer.running ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => send('timer:pause')}>
                <Pause size={16} aria-hidden="true" /> Pause
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                data-testid="timer-start"
                onClick={() => send('timer:start')}
              >
                <Play size={16} aria-hidden="true" /> Start
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => send('timer:reset')}>
              <RotateCcw size={16} aria-hidden="true" /> Zurücksetzen
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
