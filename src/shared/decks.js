/** Card catalogs. Values are stable ids; labels are what people see. */
export const DECKS = {
  fibonacci: {
    id: 'fibonacci',
    label: 'Fibonacci',
    numeric: true,
    cards: [
      { value: '0', label: '0', numeric: 0 },
      { value: '0.5', label: '½', numeric: 0.5 },
      { value: '1', label: '1', numeric: 1 },
      { value: '2', label: '2', numeric: 2 },
      { value: '3', label: '3', numeric: 3 },
      { value: '5', label: '5', numeric: 5 },
      { value: '8', label: '8', numeric: 8 },
      { value: '13', label: '13', numeric: 13 },
      { value: '20', label: '20', numeric: 20 },
      { value: '40', label: '40', numeric: 40 },
      { value: '100', label: '100', numeric: 100 },
      { value: '?', label: '?', numeric: null, hint: 'Unsicher' },
      { value: 'coffee', label: '☕', numeric: null, hint: 'Kaffeepause' },
    ],
  },
  tshirt: {
    id: 'tshirt',
    label: 'T-Shirt',
    numeric: false,
    cards: [
      { value: 'S', label: 'S', order: 1 },
      { value: 'M', label: 'M', order: 2 },
      { value: 'L', label: 'L', order: 3 },
      { value: 'XL', label: 'XL', order: 4 },
    ],
  },
}

export function getDeck(deckId) {
  return DECKS[deckId] || DECKS.fibonacci
}

export function findCard(deckId, value) {
  return getDeck(deckId).cards.find((card) => card.value === value) || null
}

export function publicDeck(deckId) {
  const deck = getDeck(deckId)
  return {
    id: deck.id,
    label: deck.label,
    numeric: deck.numeric,
    cards: deck.cards.map((card) => ({
      value: card.value,
      label: card.label,
      hint: card.hint || null,
    })),
  }
}
