import { useEffect, useRef, useState } from 'react'

function sameStory(left, right) {
  return left.title === right.title && left.description === right.description && left.ticketUrl === right.ticketUrl
}

function httpUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
  } catch {
    /* plain text ticket names stay text */
  }
  return null
}

export default function StoryPanel({ state, send }) {
  const isModerator = state.you?.role === 'moderator'
  const [draft, setDraft] = useState(state.story)
  const focused = useRef(false)
  const timer = useRef(null)
  const draftRef = useRef(draft)
  const roundRef = useRef(state.round)
  const serverStory = useRef(state.story)
  draftRef.current = draft
  serverStory.current = state.story

  useEffect(() => {
    if (state.round !== roundRef.current) {
      clearTimeout(timer.current)
      roundRef.current = state.round
      focused.current = false
    }
    if (!focused.current) {
      setDraft(state.story)
      draftRef.current = state.story
    }
  }, [state.round, state.story])

  useEffect(() => () => clearTimeout(timer.current), [])

  function commit(next = draftRef.current) {
    clearTimeout(timer.current)
    if (!isModerator || sameStory(next, serverStory.current)) return
    send('story:update', { ...next, round: roundRef.current })
  }

  function update(partial) {
    const next = { ...draftRef.current, ...partial }
    draftRef.current = next
    setDraft(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(next), 280)
  }

  const deckLocked = state.revealed || state.participants.some((person) => person.hasVoted)
  const link = httpUrl(state.story.ticketUrl)

  return (
    <section className="panel stack" aria-labelledby="story-heading">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <div>
          <p className="kicker">Runde {state.round}</p>
          <h2 id="story-heading">Story</h2>
        </div>
        <div className="segment" role="group" aria-label="Kartendeck">
          {[
            ['fibonacci', 'Fibonacci'],
            ['tshirt', 'T-Shirt'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="btn btn-sm"
              aria-pressed={state.deck.id === id}
              disabled={!isModerator || deckLocked}
              data-testid={`deck-${id}`}
              onClick={() => send('deck:set', { deck: id })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {isModerator && deckLocked ? (
        <p className="muted">Das Deck kann nur zu Beginn einer Runde gewechselt werden, bevor jemand schätzt.</p>
      ) : null}
      {!isModerator ? (
        <p className="muted">Deck, Story, Timer und Aufdecken steuert der Moderator.</p>
      ) : null}

      {isModerator ? (
        <div className="stack">
          <label className="field">
            <span>Titel</span>
            <input
              className="input"
              value={draft.title}
              maxLength={140}
              placeholder="Worum geht es in dieser Runde?"
              data-testid="story-title"
              onFocus={() => {
                focused.current = true
              }}
              onBlur={() => {
                focused.current = false
                commit()
              }}
              onChange={(event) => update({ title: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Beschreibung</span>
            <textarea
              className="textarea"
              value={draft.description}
              maxLength={2000}
              placeholder="Optional: Umfang, Akzeptanz, offene Fragen."
              onFocus={() => {
                focused.current = true
              }}
              onBlur={() => {
                focused.current = false
                commit()
              }}
              onChange={(event) => update({ description: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Ticket-Link</span>
            <input
              className="input"
              value={draft.ticketUrl}
              maxLength={500}
              inputMode="url"
              placeholder="https://…"
              onFocus={() => {
                focused.current = true
              }}
              onBlur={() => {
                focused.current = false
                commit()
              }}
              onChange={(event) => update({ ticketUrl: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="story-read stack">
          <p className="story-title">{state.story.title.trim() || 'Noch kein Story-Titel'}</p>
          {state.story.description ? <p>{state.story.description}</p> : <p className="muted">Keine Beschreibung.</p>}
          {state.story.ticketUrl ? (
            link ? (
              <a className="ticket" href={link} target="_blank" rel="noreferrer">
                {state.story.ticketUrl}
              </a>
            ) : (
              <p className="ticket">{state.story.ticketUrl}</p>
            )
          ) : null}
        </div>
      )}
    </section>
  )
}
