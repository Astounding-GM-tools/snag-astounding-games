import { isJoker, rankLabel, type Card, type JokerCard } from '../engine';
import { t } from '../i18n';

/** Black-and-white film: red suits are drawn as outlines. */
export const SUIT_GLYPH = { c: '♣', d: '♢', h: '♡', s: '♠' } as const;

/** How many Joker names the language file has; more Jokers than that reuse names. */
const JOKER_NAMES = 12;

export function jokerName(index: number): string {
  return t(`joker.${index % JOKER_NAMES}`);
}

/** A snag's name as printed on the card, without the "the" that sentences need: "Mail Run". */
export function snagTitle(index: number): string {
  return jokerName(index).replace(/^the /, '');
}

export function cardLabel(card: Card): string {
  if (isJoker(card)) return jokerName(card.index);
  const rank = card.rank === 10 ? '10' : rankLabel(card.rank);
  return rank + SUIT_GLYPH[card.suit];
}

/** Money on the river: "$53". */
export function dollars(n: number): string {
  return `$${n}`;
}

export function name(id: string): string {
  return t(`character.${id}.name`);
}

/** A captain's nickname ("Whiteknuckle"), or null if they go by their name. */
export function nickname(id: string): string | null {
  const key = `character.${id}.nick`;
  const nick = t(key);
  return nick === key ? null : nick;
}

/** What the river calls a captain where space is short: the nickname if there is one. */
export function shortName(id: string): string {
  return nickname(id) ?? name(id);
}

/** "the Egg Crisis", "the Egg Crisis and the Sandbar", "A, B and C". */
export function jokerList(jokers: JokerCard[]): string {
  const names = jokers.map((j) => jokerName(j.index));
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')}${t('list.and')}${names.at(-1)}`;
}

/** "the Ace of Spades" — for spoken intertitles. */
export function longCardName(card: Card): string {
  if (isJoker(card)) return jokerName(card.index);
  return t('card.long', { rank: t(`rank.title.${card.rank}`), suit: t(`suit.${card.suit}`) });
}
