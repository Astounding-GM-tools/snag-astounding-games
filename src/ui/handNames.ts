/**
 * Spoken descriptions of hands for the showdown intertitles:
 * "Four of a Kind, sevens" — and a nickname when the hand has one.
 */
import type { HandValue } from '../engine';
import { SUIT_GLYPH } from './format';
import { t } from '../i18n';

function groups(hand: HandValue): number[][] {
  const counts = new Map<number, number>();
  for (const c of hand.cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (rank: number) => cap(t(`rank.plural.${rank}`));
const single = (rank: number) => cap(t(`rank.name.${rank}`));

/** e.g. "a Pair of Aces", "Two Pair, Aces and Eights", "a Flush, King high". */
export function describeHand(hand: HandValue): string {
  const g = groups(hand);
  if (!hand.cards.length) return t('hand.nothing');
  const high = hand.cards[0].rank;
  switch (hand.category) {
    case 'highCard':
      return t('describe.highCard', { rank: single(high) });
    case 'pair':
      return t('describe.pair', { rank: plural(g[0][0]) });
    case 'threeOfAKind':
      return t('describe.trips', { rank: plural(g[0][0]) });
    case 'fourOfAKind':
      return t('describe.quads', { rank: plural(g[0][0]) });
    case 'twoPair':
      return t('describe.twoPair', { a: plural(g[0][0]), b: plural(g[1][0]) });
    case 'fullHouse':
      return t('describe.full', { a: plural(g[0][0]), b: plural(g[1][0]) });
    case 'straight':
    case 'flush':
    case 'straightFlush': {
      const top = hand.category !== 'flush' && high === 14 && hand.cards[1].rank === 5 ? 5 : high;
      return t('describe.high', { hand: t(`hand.${hand.category}`), rank: single(top) });
    }
  }
}

/**
 * How a hand is called at the table, in two parts. `call` is plain words a
 * newcomer can follow, category first, that every hand has ("Two pair, Queens
 * and Jacks", "Full house, Aces and Sixes"). `lingo` is the players' table
 * talk, when the hand has some, with the extra precision ("Bullets full of
 * Kicks", "Ladies over Hooks", "Trip Hooks", "Broadway"): flavour that teaches
 * the slang. It gets an exclamation mark only when asked (the winning hand),
 * since they grow tiresome fast. Shared by the River preview and the showdown.
 */
export interface HandLabel {
  call: string;
  lingo: string | null;
}

/** A rank's table nickname ("Hooks" for jacks), if it has one. */
function rankLingo(rank: number): string | null {
  const key = `lingo.rank.${rank}`;
  const nick = t(key);
  return nick === key ? null : nick;
}

export function handLabel(hand: HandValue, { exclaim = false } = {}): HandLabel {
  const { call, lingo } = label(hand);
  return { call, lingo: lingo && exclaim ? `${lingo}!` : lingo };
}

function label(hand: HandValue): HandLabel {
  if (!hand.cards.length) return { call: cap(t('hand.nothing')), lingo: null };
  const g = groups(hand);
  const r = hand.cards.map((c) => c.rank);
  const a = g[0][0];
  const b = g[1]?.[0] ?? 0;
  // Nickname where there is one, plain name where there isn't: "Cowboys over Nines".
  const lingoOr = (rank: number) => rankLingo(rank) ?? plural(rank);
  const either = rankLingo(a) || rankLingo(b);
  const wheel = r[0] === 14 && r[1] === 5;
  const top = wheel ? 5 : r[0];
  const suit = cap(t(`suit.${hand.cards[0].suit}`));
  switch (hand.category) {
    case 'highCard':
      return { call: t('call.high', { rank: single(a) }), lingo: null };
    case 'pair':
      return { call: t('call.pair', { rank: plural(a) }), lingo: a === 6 ? t('lingo.route66') : rankLingo(a) };
    case 'twoPair':
      return {
        call: t('call.twoPair', { a: plural(a), b: plural(b) }),
        lingo: a === 14 && b === 8 ? t('lingo.deadMan') : either ? t('lingo.over', { a: lingoOr(a), b: lingoOr(b) }) : null,
      };
    case 'threeOfAKind':
      return { call: t('call.trips', { rank: plural(a) }), lingo: rankLingo(a) && t('lingo.trips', { rank: rankLingo(a)! }) };
    case 'straight':
      return { call: t('call.straight', { rank: single(top) }), lingo: wheel ? t('lingo.wheel') : r[0] === 14 ? t('lingo.broadway') : null };
    case 'flush':
      return { call: t('call.flush', { suit, rank: single(a) }), lingo: null };
    case 'fullHouse': {
      const ranks = new Set([a, b]);
      const named = ranks.has(3) && ranks.has(11) ? t('lingo.waiter') : ranks.has(3) && ranks.has(13) ? t('lingo.butler') : null;
      return {
        call: t('call.full', { a: plural(a), b: plural(b) }),
        lingo: named ?? (either ? t('lingo.full', { a: lingoOr(a), b: lingoOr(b) }) : t('lingo.fullBoat')),
      };
    }
    case 'fourOfAKind':
      return { call: t('call.quads', { rank: plural(a) }), lingo: rankLingo(a) && t('lingo.quads', { rank: rankLingo(a)! }) };
    case 'straightFlush':
      return r[0] === 14 && r[1] === 13
        ? { call: t('call.royal', { suit }), lingo: t('lingo.royal') }
        : { call: t('call.straightFlush', { suit, rank: single(top) }), lingo: null };
  }
}

/** A traditional (or house) nickname, if the hand has one. */
export function nickname(hand: HandValue): string | null {
  const g = groups(hand);
  const r = hand.cards.map((c) => c.rank);
  switch (hand.category) {
    case 'straightFlush':
      return r[0] === 14 && r[1] === 13 ? t('nick.royal') : null;
    case 'fullHouse': {
      // Threes are "trays": a Jack carrying a tray is the Waiter; a King, the Butler.
      const ranks = new Set([g[0][0], g[1][0]]);
      if (ranks.has(3) && ranks.has(11)) return t('nick.waiter');
      if (ranks.has(3) && ranks.has(13)) return t('nick.butler');
      return t('nick.fullBoat');
    }
    case 'twoPair':
      return g[0][0] === 14 && g[1][0] === 8 ? t('nick.deadMan') : null;
    case 'straight':
      if (r[0] === 14 && r[1] === 5) return t('nick.wheel');
      if (r[0] === 14) return t('nick.broadway');
      return null;
    case 'pair':
    case 'threeOfAKind':
    case 'fourOfAKind': {
      const key = `nick.rank.${g[0][0]}`;
      const nick = t(key);
      return nick === key ? null : nick;
    }
    default:
      return null;
  }
}


export interface Tiebreak {
  kind: 'kicker' | 'next' | 'suit';
  /** What the winner had at the deciding spot, e.g. "Eight" or "♠". */
  winner: string;
  loser: string;
  /** The loser had no card at the deciding spot: a dead card (a Joker) sat there. */
  loserDead?: boolean;
}

/** Ranks in the order poker compares them: groups by size, then by rank. */
function rankOrder(hand: HandValue): number[] {
  if (hand.category === 'straight' || hand.category === 'straightFlush') {
    const r = hand.cards.map((c) => c.rank);
    return [r[0] === 14 && r[1] === 5 ? 5 : r[0]];
  }
  return groups(hand).map(([rank]) => rank);
}

/**
 * When two hands share a name ("Two Pair, Aces and Kings"), says what decided
 * it: a kicker, the next highest card, or in the last resort a suit.
 */
export function tiebreak(win: HandValue, lose: HandValue): Tiebreak | null {
  if (win.category !== lose.category || describeHand(win) !== describeHand(lose)) return null;
  const a = rankOrder(win);
  const b = rankOrder(lose);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      const grouped = ['pair', 'twoPair', 'threeOfAKind', 'fourOfAKind'].includes(win.category);
      return { kind: grouped ? 'kicker' : 'next', winner: single(a[i]), loser: b[i] ? single(b[i]) : t('show.deadCard'), loserDead: !b[i] };
    }
  }
  for (let i = 0; i < Math.min(win.cards.length, lose.cards.length); i++) {
    if (win.cards[i].suit !== lose.cards[i].suit) {
      return { kind: 'suit', winner: SUIT_GLYPH[win.cards[i].suit], loser: SUIT_GLYPH[lose.cards[i].suit] };
    }
  }
  return null;
}
