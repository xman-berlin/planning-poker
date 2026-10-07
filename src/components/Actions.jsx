import { useEffect, useState } from 'react'

export default function Actions({ state, send, compact = false }) {
  const you = state.you
  const [armed, setArmed] = useState(false)
  const [pending, setPending] = useState(false)
  const moderator = state.participants.find((person) => person.role === 'moderator')
  const canClaim = you?.role === 'voter' && !state.participants.some((person) => person.role === 'moderator' && person.online)
  const hiddenVotes = !state.revealed && state.participants.some((person) => person.hasVoted)

  useEffect(() => {
    setArmed(false)
  }, [state.round, state.revealed])

  async function run(eventName) {
    if (pending) return
    setPending(true)
    await send(eventName)
    setPending(false)
  }

  const hint = moderator
    ? `${moderator.name} moderiert${moderator.online ? '' : ', ist aber gerade offline'}. Nur diese Person deckt auf, startet die nächste Runde, wechselt das Deck, stellt den Timer und bearbeitet die Story.`
    : 'Gerade hat niemand die Moderation.'
  const roundHint = state.revealed
    ? 'Eine neue Runde leert die Stimmen und die Story. Ungesicherte Ergebnisse wandern in den Verlauf.'
    : 'Aufdecken zeigt alle Karten gleichzeitig.'

  const claim = canClaim ? (
    <button type="button" className="btn btn-primary" onClick={() => send('moderator:claim')}>
      Moderation übernehmen
    </button>
  ) : null

  const controls =
    you?.role === 'moderator' ? (
      <div className="action-row">
        {!state.revealed ? (
          <button
            type="button"
            className="btn btn-primary"
            data-testid="reveal"
            disabled={pending || state.progress.voted === 0}
            onClick={() => run('round:reveal')}
          >
            Karten aufdecken
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="save-round"
            disabled={pending}
            onClick={() => run('round:save')}
          >
            {state.roundSaved ? 'Verlauf aktualisieren' : 'Ergebnis sichern'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="new-round"
          disabled={pending}
          onClick={() => {
            if (hiddenVotes && !armed) {
              setArmed(true)
              return
            }
            setArmed(false)
            run('round:next')
          }}
        >
          {armed ? 'Verdeckte Stimmen verwerfen' : 'Neue Runde'}
        </button>
      </div>
    ) : null

  if (compact) {
    return (
      <section className="mod-inline" aria-label="Moderation">
        {you?.role === 'moderator' ? controls : <p className="muted">{hint}</p>}
        {claim}
        {you?.role === 'moderator' ? (
          <details className="mod-details">
            <summary>Hinweis zur Moderation</summary>
            <p className="muted">{roundHint}</p>
          </details>
        ) : null}
      </section>
    )
  }

  if (you?.role !== 'moderator') {
    return (
      <section className="panel stack">
        <h2>Moderation</h2>
        <p className="muted">{hint}</p>
        {claim}
      </section>
    )
  }

  return (
    <section className="panel stack">
      <h2>Moderation</h2>
      {controls}
      <p className="muted">{roundHint}</p>
    </section>
  )
}
