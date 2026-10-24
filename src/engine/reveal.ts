/**
 * Showdown drama: the order in which the opponent's played cards are turned
 * over, and what each reveal means for the viewer. Teasers first, then Jokers,
 * and the card that decides the duel last.
 */
import { fullDeck, isJoker, isStd, type Card, type StdCard } from './cards';
import { bestHand, bestScore, CATEGORIES, categoryOf, type Category, type HandValue } from './evaluate';
import type { RoundState } from './round';
import type { Rng } from './rng';

export type Standing = 'ahead' | 'behind' | 'level';

export interface RevealStep {
  card: Card;
  /** The opponent's best hand from the cards revealed so far plus the board. */
  hand: HandValue;
  /** Board cards that hand uses. */
  boardUsed: string[];
  /** How the viewer stands against that hand. */
  standing: Standing;
  /** Better categories the hidden cards could still make, best first (empty on the last step). */
  possible: Category[];
  /** Chance the remaining hidden cards turn the duel against the viewer. */
  threat: number;
  last: boolean;
}

const exact = (n: number) => ({ min: n, max: n });

function partial(cards: Card[], board: Card[]): HandValue {
  return bestHand(cards, board, exact(cards.length));
}

function standing(viewer: number, theirs: number): Standing {
  return viewer > theirs ? 'ahead' : viewer < theirs ? 'behind' : 'level';
}

/**
 * Plans the reveal of `revealSeat`'s played cards as seen by the other seat,
 * whose final hand score is `viewerScore`.
 */
export function planReveal(round: RoundState, revealSeat: number, rng: Rng, samples = 150): RevealStep[] {
  const board = round.community;
  const played = round.seats[revealSeat].slots.filter((c): c is Card => c !== null);
  const viewerSeat = round.seats[1 - revealSeat];
  const viewerScore = bestScore(viewerSeat.slots, board, exact(viewerSeat.slots.length));
  const real = played.filter(isStd);
  const jokers = played.filter(isJoker);
  const finalScore = bestScore(played, board, exact(played.length));
  const outcome = Math.sign(viewerScore - finalScore);

  // The pivot: the real card whose absence would flip the duel (or change the hand most).
  let pivot: StdCard | null = null;
  let pivotWeight = -Infinity;
  for (const c of real) {
    const without = bestScore(played.filter((x) => x !== c), board, exact(played.length - 1));
    const flips = Math.sign(viewerScore - without) !== outcome;
    const weight = (flips ? 1e12 : 0) + Math.abs(finalScore - without);
    if (weight > pivotWeight) {
      pivotWeight = weight;
      pivot = c;
    }
  }

  // Teasers, greedily: each next card is the one that makes the revealed hand look best.
  const order: Card[] = [];
  const rest = real.filter((c) => c !== pivot);
  while (rest.length) {
    let bi = 0;
    let bs = -1;
    rest.forEach((c, i) => {
      const s = bestScore([...order, c], board, exact(order.length + 1));
      if (s > bs) (bs = s), (bi = i);
    });
    order.push(rest.splice(bi, 1)[0]);
  }
  order.push(...jokers);
  if (pivot) order.push(pivot);

  // Cards the viewer cannot see, for "what could still come" sampling.
  const seen = new Set<string>([...viewerSeat.slots, ...viewerSeat.hand, ...board, ...round.discards].filter(isStd).map((c) => c.id));

  return order.map((card, i): RevealStep => {
    const shown = order.slice(0, i + 1);
    const hand = partial(shown, board);
    const hidden = order.length - shown.length;
    const used = new Set(hand.cards.map((c) => c.id));
    const boardUsed = board.filter((c) => used.has(c.id)).map((c) => c.id);
    let possible: Category[] = [];
    let threat = 0;
    if (hidden > 0) {
      const pool = fullDeck().filter((c) => !seen.has(c.id) && !shown.some((s) => s.id === c.id));
      const reach = new Set<number>();
      let worse = 0;
      for (let s = 0; s < samples; s++) {
        const extra = rng.shuffle(pool).slice(0, hidden);
        const score = bestScore([...shown, ...extra], board, exact(shown.length + hidden));
        reach.add(CATEGORIES.indexOf(categoryOf(score)));
        if (score > viewerScore) worse++;
      }
      const current = CATEGORIES.indexOf(hand.category);
      possible = [...reach].filter((c) => c > current).sort((a, b) => b - a).map((c) => CATEGORIES[c]);
      threat = worse / samples;
    }
    return { card, hand, boardUsed, standing: standing(viewerScore, hand.score), possible, threat, last: hidden === 0 };
  });
}
