import { Check, Copy, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Actions from '../components/Actions.jsx'
import Brand from '../components/Brand.jsx'
import CardDeck from '../components/CardDeck.jsx'
import ChatPanel from '../components/ChatPanel.jsx'
import HistoryPanel from '../components/HistoryPanel.jsx'
import Participants from '../components/Participants.jsx'
import Results from '../components/Results.jsx'
import StoryPanel from '../components/StoryPanel.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import TimerCard from '../components/TimerCard.jsx'
import { copyText } from '../lib/clipboard.js'
import {
  clearMember,
  createParticipantId,
  readMember,
  rememberName,
  rememberedName,
  writeMember,
} from '../lib/member.js'
import { request, socket } from '../lib/socket.js'
import { formatSessionCode } from '../shared/format.js'
import { normalizeSessionId } from '../shared/ids.js'

export default function Room() {
  const params = useParams()
  const navigate = useNavigate()
  const rawId = params.sessionId || ''
  const sessionId = normalizeSessionId(rawId)
  const [status, setStatus] = useState(sessionId ? 'loading' : 'missing')
  const [state, setState] = useState(null)
  const [connected, setConnected] = useState(socket.connected)
  const [error, setError] = useState('')
  const [peek, setPeek] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (sessionId && rawId !== sessionId) navigate(`/s/${sessionId}`, { replace: true })
  }, [rawId, sessionId, navigate])

  useEffect(() => {
    if (!sessionId) return undefined
    let cancel = false

    const onState = (next) => {
      if (cancel || next?.id !== sessionId) return
      setState(next)
      setStatus((current) => (current === 'elsewhere' || current === 'join' ? current : 'room'))
    }
    const onElsewhere = () => {
      if (!cancel) setStatus('elsewhere')
    }
    const onDisconnect = () => setConnected(false)
    const onConnect = () => {
      setConnected(true)
      const member = readMember(sessionId)
      if (!member) return
      request('session:resume', { sessionId, participantId: member.participantId }).then((response) => {
        if (cancel || !response.ok) return
        setState(response.state)
        setStatus((current) => (current === 'elsewhere' ? current : 'room'))
      })
    }

    socket.on('state', onState)
    socket.on('session:elsewhere', onElsewhere)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    async function boot() {
      const member = readMember(sessionId)
      if (member) {
        const resumed = await request('session:resume', { sessionId, participantId: member.participantId })
        if (cancel) return
        if (resumed.ok) {
          setState(resumed.state)
          setStatus('room')
          return
        }
        clearMember(sessionId)
      }
      const info = await request('session:peek', { sessionId })
      if (cancel) return
      if (!info.ok) {
        setStatus('missing')
        return
      }
      setPeek(info)
      setStatus('join')
    }

    if (socket.connected) boot()
    else socket.once('connect', boot)

    return () => {
      cancel = true
      socket.off('state', onState)
      socket.off('session:elsewhere', onElsewhere)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect', boot)
    }
  }, [sessionId])

  useEffect(() => {
    const title = state?.story?.title?.trim()
    document.title = title ? `${title} · Planungspoker` : sessionId ? `Session ${sessionId} · Planungspoker` : 'Planungspoker'
    return () => {
      document.title = 'Planungspoker'
    }
  }, [sessionId, state])

  async function send(eventName, payload = {}) {
    const member = readMember(sessionId)
    const response = await request(eventName, {
      sessionId,
      participantId: member?.participantId,
      ...payload,
    })
    if (!response.ok && response.error && response.error !== 'Die Runde hat gerade gewechselt.') {
      setError(response.error)
    } else if (response.ok) {
      setError('')
    }
    if (response.state) setState(response.state)
    return response
  }

  async function copyLink() {
    const url = `${window.location.origin}/s/${sessionId}`
    const ok = await copyText(url)
    setCopied(ok)
    if (!ok) setError(`Link: ${url}`)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function leave() {
    const member = readMember(sessionId)
    if (member) await request('session:leave', { sessionId, participantId: member.participantId })
    clearMember(sessionId)
    navigate('/')
  }

  if (!sessionId || status === 'missing') {
    return (
      <main id="inhalt" className="wrap" style={{ padding: '2.5rem 0' }}>
        <section className="panel stack">
          <p className="kicker">Session</p>
          <h1 className="display" style={{ fontSize: '2.3rem' }}>
            Diese Session gibt es nicht.
          </h1>
          <p className="lede">
            Der Code ist unbekannt. Gespeicherte Sessions bleiben nach einem Neustart unter demselben Link erreichbar.
          </p>
          <button className="btn btn-primary" type="button" onClick={() => navigate('/')}>
            Zur Startseite
          </button>
        </section>
      </main>
    )
  }

  return (
    <>
      <header className="wrap topbar">
        <Brand />
        <div className="code">
          <b>{formatSessionCode(sessionId)}</b>
          <button type="button" className="btn btn-sm btn-primary" data-testid="copy-link" onClick={copyLink}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? 'Kopiert' : 'Link kopieren'}
          </button>
        </div>
        <div className="cluster">
          <span className="cluster">
            <span className={connected ? 'live-dot' : 'live-dot off'} aria-hidden="true" />
            <span>{connected ? 'Live' : 'Getrennt'}</span>
          </span>
          <ThemeToggle />
          {status === 'room' ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={leave}>
              <LogOut size={16} aria-hidden="true" /> Verlassen
            </button>
          ) : null}
        </div>
      </header>
      <main id="inhalt" className="wrap">
        {error ? (
          <p className="banner" role="alert" style={{ marginBottom: '1rem' }}>
            {error}
          </p>
        ) : null}
        {status === 'loading' ? <p className="panel">Session wird verbunden …</p> : null}
        {status === 'elsewhere' ? (
          <section className="panel stack">
            <h1>In einem anderen Fenster aktiv</h1>
            <p className="muted">Diese Session läuft gerade in einem anderen Tab. Du kannst sie hier übernehmen.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                const response = await send('session:resume')
                if (response.ok) setStatus('room')
              }}
            >
              Hier weiter machen
            </button>
          </section>
        ) : null}
        {status === 'join' ? (
          <JoinForm
            sessionId={sessionId}
            peek={peek}
            onJoined={(next) => {
              setState(next)
              setStatus('room')
              setError('')
            }}
          />
        ) : null}
        {status === 'room' && state ? <RoomBoard state={state} send={send} connected={connected} /> : null}
      </main>
    </>
  )
}

function JoinForm({ sessionId, peek, onJoined }) {
  const [name, setName] = useState(rememberedName)
  const [role, setRole] = useState('voter')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Bitte einen Namen eingeben.')
      return
    }
    setPending(true)
    setError('')
    const participantId = createParticipantId()
    const response = await request('session:join', {
      sessionId,
      name: trimmed,
      participantId,
      role,
    })
    setPending(false)
    if (!response.ok) {
      setError(response.error || 'Beitreten hat nicht geklappt.')
      return
    }
    rememberName(trimmed)
    writeMember(sessionId, {
      participantId: response.participantId || participantId,
      name: response.state?.you?.name || trimmed,
    })
    onJoined(response.state)
  }

  return (
    <form className="panel stack" style={{ maxWidth: 560 }} onSubmit={submit}>
      <div>
        <p className="kicker">Session {formatSessionCode(sessionId)}</p>
        <h1>Beitreten</h1>
        <p className="muted">
          {peek?.online
            ? `${peek.online} ${peek.online === 1 ? 'Person ist' : 'Personen sind'} gerade online. `
            : 'Name ist erforderlich. '}
          Derselbe Browser holt deinen Platz automatisch zurück. In einem neuen Browser reicht dein bisheriger Name, wenn er gerade offline und eindeutig ist.
        </p>
      </div>
      {error ? (
        <p className="banner" role="alert">
          {error}
        </p>
      ) : null}
      <label className="field">
        <span>Dein Name</span>
        <input
          className="input"
          value={name}
          maxLength={40}
          autoComplete="nickname"
          required
          data-testid="join-name"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <fieldset className="choices">
        <legend className="legend">Rolle</legend>
        <label className="choice">
          <input type="radio" name="role" value="voter" checked={role === 'voter'} onChange={() => setRole('voter')} />
          <span>
            <strong>Teilnehmer</strong>
            <small>Du schätzt mit. Deine Karte bleibt bis zum Aufdecken verdeckt.</small>
          </span>
        </label>
        <label className="choice">
          <input
            type="radio"
            name="role"
            value="observer"
            checked={role === 'observer'}
            onChange={() => setRole('observer')}
          />
          <span>
            <strong>Beobachter</strong>
            <small>Du erscheinst in der Liste, gibst keine Schätzung ab und zählst nicht mit.</small>
          </span>
        </label>
      </fieldset>
      <button className="btn btn-primary" type="submit" disabled={pending} data-testid="join-submit">
        {pending ? 'Tritt bei …' : 'Session beitreten'}
      </button>
    </form>
  )
}

function useWideScreen() {
  const query = '(min-width: 901px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setWide(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return wide
}

function RoomBoard({ state, send, connected }) {
  const wide = useWideScreen()
  const wasRevealed = useRef(state.revealed)
  const { voted, eligible } = state.progress
  const width = eligible ? Math.round((voted / eligible) * 100) : 0
  const verb = voted === 1 ? 'hat' : 'haben'

  useEffect(() => {
    if (state.revealed && !wasRevealed.current) {
      document.getElementById('result-heading')?.focus()
    }
    wasRevealed.current = state.revealed
  }, [state.revealed, state.round])

  return (
    <div className="room">
      {!connected ? <p className="banner quiet" style={{ gridColumn: '1 / -1' }}>Verbindung unterbrochen. Wir versuchen es erneut.</p> : null}
      <div className="main-col">
        <StoryPanel state={state} send={send} />
        <div className="split">
          <TimerCard state={state} send={send} />
          <section className="panel" aria-labelledby="progress-heading">
            <p className="kicker" id="progress-heading">
              Schätzungen
            </p>
            <p aria-live="polite">
              {eligible === 0 ? (
                'Niemand schätzt gerade mit.'
              ) : (
                <>
                  <strong>
                    {voted} von {eligible}
                  </strong>{' '}
                  {verb} abgestimmt
                </>
              )}
            </p>
            <div
              className="meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={eligible}
              aria-valuenow={voted}
              aria-label="Abgegebene Schätzungen"
            >
              <span style={{ width: `${width}%` }} />
            </div>
            <p className="muted">Beobachter zählen nicht mit.</p>
          </section>
        </div>
        {state.revealed ? <Results state={state} /> : <CardDeck state={state} send={send} />}
        {wide ? null : <Actions compact state={state} send={send} />}
      </div>
      <div className="side-col">
        {wide ? <Actions state={state} send={send} /> : null}
        <Participants state={state} send={send} />
        <ChatPanel state={state} send={send} />
      </div>
      <div className="history-slot">
        <HistoryPanel state={state} />
      </div>
    </div>
  )
}
