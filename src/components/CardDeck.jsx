export default function CardDeck({ state, send }) {
  const you = state.you
  const canVote = you && you.role !== 'observer' && !state.revealed
  const votedLabel = you?.voteLabel

  return (
    <section className="felt stack" aria-labelledby="deck-heading">
      <div>
        <h2 id="deck-heading">Schätzen</h2>
        <p className="muted">
          {you?.role === 'observer'
            ? 'Du beobachtest. Deine Stimme zählt in dieser Runde nicht.'
            : 'Die Schätzung bleibt verdeckt. Du kannst sie ändern, bis aufgedeckt wird.'}
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {you?.role === 'observer'
          ? 'Beobachter geben keine Schätzung ab.'
          : votedLabel
            ? `Deine Schätzung ist ${votedLabel} und noch verdeckt.`
            : 'Du hast noch nicht geschätzt.'}
      </p>
      <div className={`deck-grid ${state.deck.id === 'tshirt' ? 'tshirt' : ''}`}>
        {state.deck.cards.map((card) => {
          const selected = you?.vote === card.value
          const label =
            card.value === 'coffee' ? 'Kaffeepause' : card.hint ? `${card.label}, ${card.hint}` : `Karte ${card.label}`
          return (
            <button
              key={card.value}
              type="button"
              className={selected ? 'poker-card is-selected' : 'poker-card'}
              aria-pressed={selected}
              aria-label={label}
              disabled={!canVote}
              data-testid={`card-${card.value}`}
              onClick={() => send('vote:cast', { value: card.value })}
            >
              <span className="corner tl" aria-hidden="true">
                {card.label}
              </span>
              <span className="face" aria-hidden="true">
                {card.label}
              </span>
              {card.hint ? <span className="hint">{card.value === 'coffee' ? 'Kaffeepause' : card.hint}</span> : null}
              <span className="corner br" aria-hidden="true">
                {card.label}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
