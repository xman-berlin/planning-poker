import { useEffect, useRef, useState } from 'react'
import { formatStamp } from '../shared/format.js'

export default function ChatPanel({ state, send }) {
  const [text, setText] = useState('')
  const logRef = useRef(null)
  const open = state.revealed

  useEffect(() => {
    const node = logRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [state.chat.length, open])

  function submit(event) {
    event.preventDefault()
    const value = text.trim()
    if (!value || !open) return
    setText('')
    send('chat:send', { text: value })
  }

  return (
    <section className="panel" aria-labelledby="chat-heading">
      <h2 id="chat-heading">Diskussion</h2>
      {open ? (
        <p className="muted">Kurze Notizen zur aufgedeckten Runde. Ohne Anmeldung, sichtbar für die Session.</p>
      ) : (
        <p className="muted">Die Notizen öffnen sich, sobald die Karten aufgedeckt sind.</p>
      )}
      <ul className="chat-log" ref={logRef} aria-live="polite">
        {state.chat.length === 0 ? <li className="muted">Noch keine Notizen.</li> : null}
        {state.chat.map((note) => (
          <li key={note.id} className="note">
            <header>
              <strong>{note.name}</strong>
              <time dateTime={note.at}>
                R{note.round} · {formatStamp(note.at)}
              </time>
            </header>
            <p>{note.text}</p>
          </li>
        ))}
      </ul>
      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-text">
          Notiz
        </label>
        <input
          id="chat-text"
          className="input"
          value={text}
          maxLength={500}
          disabled={!open}
          placeholder={open ? 'Warum liegen die Schätzungen auseinander?' : 'Nach dem Aufdecken'}
          data-testid="chat-input"
          onChange={(event) => setText(event.target.value)}
        />
        <button className="btn btn-secondary" type="submit" disabled={!open || !text.trim()}>
          Senden
        </button>
      </form>
    </section>
  )
}
