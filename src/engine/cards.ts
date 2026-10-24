/** Suits in tie-break order: clubs < diamonds < hearts < spades. */
export const SUITS = ['c', 'd', 'h', 's'] as const;
export type Suit = (typeof SUITS)[number];

/** 2..14, where 11=J, 12=Q, 13=K, 14=A. */
export type Rank = number;

export interface StdCard {
  kind: 'std';
  id: string;
  rank: Rank;
  suit: Suit;
}

export interface JokerCard {
  kind: 'joker';
  id: string;
  /** 0-based index into the game's Joker set; used for naming/flavour. */
  index: number;
}

export type Card = StdCard | JokerCard;

const RANK_LABELS: Record<number, string> = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank] ?? String(rank);
}

export function suitValue(suit: Suit): number {
  return SUITS.indexOf(suit);
}

export function stdCard(rank: Rank, suit: Suit): StdCard {
  return { kind: 'std', id: rankLabel(rank) + suit, rank, suit };
}

export function jokerCard(index: number): JokerCard {
  return { kind: 'joker', id: `X${index}`, index };
}

/** Parses "As", "Td", "9c" — handy in tests. */
export function parseCard(code: string): StdCard {
  const r = code[0].toUpperCase();
  const s = code[1].toLowerCase() as Suit;
  const byLabel: Record<string, number> = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
  const rank = byLabel[r] ?? Number(r);
  if (!SUITS.includes(s) || !(rank >= 2 && rank <= 14)) throw new Error(`Bad card: ${code}`);
  return stdCard(rank, s);
}

export function fullDeck(): StdCard[] {
  const deck: StdCard[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) deck.push(stdCard(rank, suit));
  return deck;
}

export function isJoker(card: Card | null | undefined): card is JokerCard {
  return card?.kind === 'joker';
}

export function isStd(card: Card | null | undefined): card is StdCard {
  return card?.kind === 'std';
}
