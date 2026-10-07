import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { createParticipantId, rememberName, rememberedName, writeMember } from '../lib/member.js'
import { request } from '../lib/socket.js'
import { normalizeSessionId } from '../shared/ids.js'

export default function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState(rememberedName)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function createSession(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Bitte einen Namen eingeben.')
      return
    }
    setPending(true)
    setError('')
    const participantId = createParticipantId()
    const response = await request('session:create', { name: trimmed, participantId })
    setPending(false)
    if (!response.ok) {
      setError(response.error || 'Die Session konnte nicht erstellt werden.')
      return
    }
    rememberName(trimmed)
    writeMember(response.sessionId, { participantId, name: trimmed })
    navigate(`/s/${response.sessionId}`)
  }

  function openSession(event) {
    event.preventDefault()
    const sessionId = normalizeSessionId(code)
    if (!sessionId) {
      setError('Der Code hat 6 Zeichen. Du kannst auch den ganzen Link einfügen.')
      return
    }
    if (name.trim()) rememberName(name.trim())
    navigate(`/s/${sessionId}`)
  }

  return (
    <>
      <header className="wrap topbar">
        <Brand />
        <ThemeToggle />
      </header>
      <main id="inhalt" className="wrap home-grid">
        <section>
          <p className="kicker">SCRUM Poker</p>
          <h1 className="display">Schätzen, ohne sich gegenseitig festzulegen.</h1>
          <p className="lede">
            Eine Session, ein Link, verdeckte Karten. Wenn das Team soweit ist, deckt die Moderation alle
            Schätzungen auf einmal auf.
          </p>
          <ol className="steps">
            <li>
              <b>1</b>
              <span>Session erstellen. Du bist Moderator und teilst den Link.</span>
            </li>
            <li>
              <b>2</b>
              <span>Das Team tritt mit Namen bei. Beobachter schätzen nicht mit.</span>
            </li>
            <li>
              <b>3</b>
              <span>Aufdecken, Durchschnitt und Median lesen, Ergebnis sichern, nächste Story.</span>
            </li>
          </ol>
          <div className="mini-deck" aria-hidden="true">
            <span>1</span>
            <span>3</span>
            <span>5</span>
            <span>8</span>
            <span>13</span>
          </div>
        </section>
        <section className="stack">
          {error ? (
            <p className="banner" role="alert">
              {error}
            </p>
          ) : null}
          <form className="panel stack" onSubmit={createSession}>
            <div>
              <h2>Session erstellen</h2>
              <p className="muted">Du wirst Moderator. Der Link enthält die Session-ID.</p>
            </div>
            <label className="field">
              <span>Dein Name</span>
              <input
                className="input"
                name="name"
                value={name}
                maxLength={40}
                autoComplete="nickname"
                required
                data-testid="create-name"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button className="btn btn-primary btn-block" type="submit" disabled={pending} data-testid="create-session">
              {pending ? 'Session wird erstellt …' : 'Session erstellen'}
            </button>
          </form>
          <form className="panel stack" onSubmit={openSession}>
            <div>
              <h2>Session beitreten</h2>
              <p className="muted">Code oder den geteilten Link einfügen.</p>
            </div>
            <label className="field">
              <span>Session-Code</span>
              <input
                className="input"
                name="code"
                value={code}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
                placeholder="z. B. K7MQ2P"
                data-testid="join-code"
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <button className="btn btn-secondary btn-block" type="submit">
              Weiter zur Session
            </button>
          </form>
        </section>
      </main>
      <p className="wrap footer-note">
        Prototyp für BRZ-Teams. Keine Anmeldung. Sessions bleiben auf dem Server gespeichert und lassen sich nach
        einem Neustart über denselben Link weiterführen.
      </p>
    </>
  )
}
