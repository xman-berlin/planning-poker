import { Download } from 'lucide-react'
import { useState } from 'react'
import { copyText, downloadText } from '../lib/clipboard.js'
import { historyToCsv, historyToText, roundToText } from '../shared/export.js'
import { formatPoints, formatStamp, plainVoteLabel } from '../shared/format.js'

export default function HistoryPanel({ state }) {
  const [notice, setNotice] = useState('')
  const history = state.history || []

  async function copy(text) {
    const ok = await copyText(text)
    setNotice(ok ? 'In die Zwischenablage kopiert.' : 'Kopieren hat nicht geklappt.')
  }

  return (
    <section className="panel" aria-labelledby="history-heading" data-testid="history">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <h2 id="history-heading">Verlauf</h2>
        <div className="cluster">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!state.revealed}
            onClick={() => copy(roundToText(state.id, state))}
          >
            Runde kopieren
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!history.length}
            onClick={() => copy(historyToText(state.id, history))}
          >
            Verlauf kopieren
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid="export-csv"
            disabled={!history.length}
            onClick={() => downloadText(`planungspoker-${state.id}.csv`, historyToCsv(history), 'text/csv;charset=utf-8')}
          >
            <Download size={16} aria-hidden="true" /> CSV
          </button>
        </div>
      </div>
      {notice ? <p role="status">{notice}</p> : null}
      {history.length === 0 ? (
        <p className="muted">Noch keine gesicherte Runde. Nach dem Aufdecken kann der Moderator das Ergebnis sichern.</p>
      ) : (
        <ul className="history-list">
          {history.map((entry) => {
            const title = entry.story?.title?.trim() || 'Ohne Titel'
            const stats = entry.stats
            return (
              <li key={entry.id} className="history-item">
                <header>
                  <h3>
                    Runde {entry.round}: {title}
                  </h3>
                  <time dateTime={entry.savedAt}>{formatStamp(entry.savedAt)}</time>
                </header>
                <p className="muted">
                  {entry.deckLabel} ·{' '}
                  {stats?.numeric
                    ? `Durchschnitt ${formatPoints(stats.average)} · Median ${formatPoints(stats.median)}`
                    : 'ohne Durchschnitt'}
                  {stats?.consensus ? ' · Konsens' : ''}
                </p>
                {entry.story?.description ? <p>{entry.story.description}</p> : null}
                {entry.story?.ticketUrl ? <p className="ticket">{entry.story.ticketUrl}</p> : null}
                <p className="votes-line">
                  {entry.votes.map((vote) => `${vote.name} ${plainVoteLabel(vote.value, vote.label)}`).join(' · ') || 'Keine Stimmen'}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
