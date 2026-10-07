import { formatPoints } from '../shared/format.js'

export default function Results({ state }) {
  const stats = state.stats
  const votes = state.participants.filter((person) => person.role !== 'observer' && person.vote)
  const showScale = stats && stats.low && stats.high && stats.low !== stats.high
  const note = !stats?.numeric
    ? 'Für T-Shirt-Größen gibt es keinen Durchschnitt und keinen Median. Reihenfolge: S, M, L, XL.'
    : stats?.comparableCount
      ? '? und Kaffeepause zählen nicht in Durchschnitt und Median.'
      : 'Keine numerische Schätzung. ? und Kaffeepause zählen nicht in Durchschnitt und Median.'

  return (
    <section className="felt stack" aria-labelledby="result-heading" tabIndex={-1}>
      <div>
        <p className="kicker">Aufgedeckt</p>
        <h2 id="result-heading" tabIndex={-1}>
          Alle Schätzungen
        </h2>
      </div>
      {stats?.consensus ? (
        <div className="consensus" role="status" data-testid="consensus">
          <strong>Konsens</strong>
          <p>
            Alle vergleichbaren Schätzungen sind gleich.
            {stats.abstained > 0 ? ' ? und Kaffeepause zählen nicht mit.' : ''}
          </p>
        </div>
      ) : null}
      <div className="stats">
        <div className="stat">
          <span>Durchschnitt</span>
          <strong data-testid="average">{stats?.numeric ? formatPoints(stats.average) : '—'}</strong>
        </div>
        <div className="stat">
          <span>Median</span>
          <strong data-testid="median">{stats?.numeric ? formatPoints(stats.median) : '—'}</strong>
        </div>
      </div>
      <p className="muted">{note}</p>
      <div className="vote-grid">
        {votes.map((person) => (
          <article key={person.id} className={`vote-card ${person.highlight ? `is-${person.highlight}` : ''}`}>
            <p className="face">{person.voteLabel}</p>
            <p className="who">{person.name}</p>
            {person.highlight === 'low' ? <em className="tag">niedrigste</em> : null}
            {person.highlight === 'high' ? <em className="tag">höchste</em> : null}
          </article>
        ))}
      </div>
      {showScale ? (
        <ul className="legend">
          <li>
            <i className="low" aria-hidden="true" /> niedrigste Schätzung
          </li>
          <li>
            <i className="high" aria-hidden="true" /> höchste Schätzung
          </li>
        </ul>
      ) : null}
    </section>
  )
}
