import { Crown, Eye } from 'lucide-react'
import { useState } from 'react'
import { colorFor, initials } from '../lib/people.js'

export default function Participants({ state, send }) {
  const you = state.you
  const [confirmId, setConfirmId] = useState(null)
  const online = state.participants.filter((person) => person.online).length

  return (
    <section className="panel" aria-labelledby="people-heading">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <h2 id="people-heading">Teilnehmende</h2>
        <span className="muted">
          {online} online
        </span>
      </div>
      {state.participants.length < 2 ? (
        <p className="muted">Teile den Link, damit das Team beitreten kann. Neue Personen erscheinen sofort.</p>
      ) : null}
      <ul className="people" data-testid="participant-list">
        {state.participants.map((person) => {
          const mine = person.id === you?.id
          return (
            <li key={person.id} className={`person ${mine ? 'is-you' : ''} ${person.online ? '' : 'is-off'}`}>
              <span className="avatar" style={{ background: colorFor(person.name) }} aria-hidden="true">
                {initials(person.name)}
              </span>
              <div>
                <div className="name">
                  {person.name}
                  {mine ? ' (du)' : ''}
                </div>
                <div className="badges">
                  {person.role === 'moderator' ? (
                    <span className="badge mod">
                      <Crown size={12} aria-hidden="true" /> Moderator
                    </span>
                  ) : null}
                  {person.role === 'observer' ? (
                    <span className="badge eye">
                      <Eye size={12} aria-hidden="true" /> Beobachter
                    </span>
                  ) : null}
                  {!person.online ? <span className="badge">offline</span> : null}
                  {state.revealed && person.highlight === 'low' ? <span className="badge low">niedrigste</span> : null}
                  {state.revealed && person.highlight === 'high' ? <span className="badge high">höchste</span> : null}
                </div>
                {you?.role === 'moderator' && person.role === 'voter' && person.online && !mine ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (confirmId === person.id) {
                        setConfirmId(null)
                        send('moderator:transfer', { targetId: person.id })
                      } else {
                        setConfirmId(person.id)
                      }
                    }}
                  >
                    {confirmId === person.id ? `An ${person.name} übergeben` : 'Moderation übergeben'}
                  </button>
                ) : null}
              </div>
              <div className="status-pill">
                {person.role === 'observer' ? (
                  'beobachtet'
                ) : state.revealed && person.voteLabel ? (
                  person.voteLabel
                ) : person.hasVoted ? (
                  <span data-testid={`voted-${person.name}`}>hat abgestimmt</span>
                ) : (
                  'wartet'
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
