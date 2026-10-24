/**
 * Opponent AIs. Each AI only sees a SeatView: its own cards, the board and what
 * the other player has revealed — never the other player's hand.
 */
import { fullDeck, isJoker, isStd, type Card, type JokerCard, type StdCard } from './cards';
import type { AiId } from './characters';
import type { RulesConfig } from './config';
import { bestScore, CATEGORIES, categoryOf, type Category, type OwnCardRule } from './evaluate';
import { canFold, isComposing, legalSeatActions, subsets, type Action, type RoundState } from './round';
import { discardCost, streetFee } from './pot';
import type { Rng } from './rng';

export interface SeatView {
  playStyle: RoundState['playStyle'];
  /** Draw style: hands are being composed. */
  composing: boolean;
  street: number;
  hand: StdCard[];
  jokers: JokerCard[];
  slots: (Card | null)[];
  community: Card[];
  communityJoker: JokerCard | null;
  opponentSlots: (Card | null)[];
  opponentHandSize: number;
  opponentJokerCount: number;
  discards: StdCard[];
  /** What the other player has discarded this round (face up). */
  opponentDiscarded: StdCard[];
  /** How many cards this seat has thrown away this crossing (discard fees rise with it). */
  discardedCount: number;
  month: number;
  /** Pot mode: the pot so far, and whether this seat may still fold. */
  potMode: boolean;
  pot: number;
  canFold: boolean;
  /** Snags shuffled into the deck this crossing (public knowledge). */
  deckSnags: number;
  deckSize: number;
}

export function viewFor(round: RoundState, seatIndex: number): SeatView {
  const me = round.seats[seatIndex];
  const them = round.seats[1 - seatIndex];
  return {
    playStyle: round.playStyle,
    composing: isComposing(round),
    street: round.street,
    hand: me.hand,
    jokers: me.jokers,
    slots: me.slots,
    community: round.community,
    communityJoker: round.communityJoker,
    opponentSlots: them.slots,
    opponentHandSize: them.hand.length,
    opponentJokerCount: them.jokers.length + them.slots.filter(isJoker).length,
    discards: round.discards,
    opponentDiscarded: them.discarded,
    discardedCount: me.discarded.length,
    month: round.month,
    potMode: round.potMode ?? false,
    pot: (round.bets ?? [0, 0])[0] + (round.bets ?? [0, 0])[1],
    canFold: canFold(round, seatIndex),
    deckSnags: round.deck.filter(isJoker).length,
    deckSize: round.deck.length,
  };
}

export function chooseAction(ai: AiId, view: SeatView, config: RulesConfig, rng: Rng): Action {
  if (view.playStyle === 'draw') return view.composing ? composeAction(ai, view, config, rng) : drawAction(ai, view, config, rng);
  // Slots-style presets: each style falls back to one of the original behaviours.
  switch (ai) {
    case 'bully':
    case 'stubborn':
      return bullyAction(view);
    case 'clueless':
      return randomAction(view, rng, 3);
    case 'prankster':
    case 'anarchist':
      return randomAction(view, rng, 1);
    case 'dreamer':
    case 'loose':
      return rng.next() < 0.65 ? randomAction(view, rng, 1) : smartAction(view, config, rng, { samples: 25, jokerBold: 1, noise: 1 });
    case 'careful':
      return smartAction(view, config, rng, { samples: 30, jokerBold: 0.3, noise: 2 });
    case 'shark':
      return smartAction(view, config, rng, { samples: 40, jokerBold: 1.6, noise: 0.5 });
    case 'gambler':
    case 'predator':
      return smartAction(view, config, rng, { samples: 60, jokerBold: 1, noise: 0 });
    case 'griefer':
    case 'swashbuckler':
      return randomAction(view, rng, 2);
    case 'defeatist':
      return smartAction(view, config, rng, { samples: 25, jokerBold: 0.2, noise: 1 });
  }
}

/** The bully: always wants the highest card on the table, never touches a snag. */
function bullyAction(view: SeatView): Action {
  const best = [...view.hand].sort((a, b) => b.rank - a.rank)[0];
  const worst = [...view.hand].sort((a, b) => a.rank - b.rank)[0];
  if (!best) return legalSeatActions(view, view.deckSize)[0];
  const empty = view.slots.findIndex((s) => s === null);
  if (empty >= 0) return { type: 'place', cardId: best.id, slot: empty };
  const worth = (c: Card | null) => (isStd(c) ? c.rank : 0);
  let weakest = 0;
  view.slots.forEach((c, i) => {
    if (worth(c) < worth(view.slots[weakest])) weakest = i;
  });
  if (best.rank > worth(view.slots[weakest])) return { type: 'place', cardId: best.id, slot: weakest };
  // Nothing worth playing: throw away the smallest card.
  return view.deckSize > 0 ? { type: 'discard', cardId: worst.id } : legalSeatActions(view, view.deckSize)[0];
}

/**
 * Random legal action; Joker placements weighted by `jokerWeight`. Even a
 * chaotic player usually fills an empty slot rather than wasting the street.
 */
function randomAction(view: SeatView, rng: Rng, jokerWeight: number): Action {
  let actions = legalSeatActions(view, view.deckSize);
  const fills = actions.filter((a) => a.type === 'place' && view.slots[a.slot] === null);
  if (fills.length && rng.next() < 0.75) actions = fills;
  const weighted: Action[] = [];
  for (const a of actions) {
    const isJokerPlay = a.type === 'place' && view.jokers.some((j) => j.id === a.cardId);
    for (let i = 0; i < (isJokerPlay ? jokerWeight : 1); i++) weighted.push(a);
  }
  return rng.pick(weighted);
}

interface SmartOptions {
  samples: number;
  /** How much the AI values shedding a Joker (1 = rationally). */
  jokerBold: number;
  /** Random noise added to each action's utility. */
  noise: number;
}

/**
 * Monte Carlo: for each legal action, sample the unknown cards many times,
 * assume we greedily improve on later streets, and score the expected
 * Money outcome including Joker stakes.
 */
function smartAction(view: SeatView, config: RulesConfig, rng: Rng, opts: SmartOptions): Action {
  const actions = legalSeatActions(view, view.deckSize);
  const known = new Set<string>(
    [...view.hand, ...view.slots, ...view.community, ...view.opponentSlots, ...view.discards]
      .filter(isStd)
      .map((c) => c.id),
  );
  const unknown = fullDeck().filter((c) => !known.has(c.id));
  // A Joker's drain lasts until it is shed, so it is worth several rounds of drain.
  const jokerValue = config.drainPerJoker * 3;
  const stakes =
    (view.communityJoker ? 1 : 0) + view.community.filter(isJoker).length + view.opponentSlots.filter(isJoker).length;
  const futureStreets = 2 - view.street;
  const futureDeals = config.dealSchedule.slice(view.street + 1).reduce((a, b) => a + b, 0);
  const boardSize = config.communitySchedule.reduce((a, b) => a + b, 0);
  const rule = config.ownCards;

  let bestAction = actions[0];
  let topScore = -Infinity;
  for (const action of actions) {
    let total = 0;
    for (let s = 0; s < opts.samples; s++) {
      const pile = rng.shuffle(unknown);
      let hand = view.hand.slice();
      const slots = view.slots.slice() as (Card | null)[];
      if (action.type === 'discard') {
        hand = hand.filter((c) => c.id !== action.cardId);
        hand.push(pile.pop()!);
      } else if (action.type === 'place') {
        const card = hand.find((c) => c.id === action.cardId) ?? view.jokers.find((c) => c.id === action.cardId)!;
        hand = hand.filter((c) => c.id !== action.cardId);
        const old = slots[action.slot];
        if (isStd(old)) hand.push(old);
        slots[action.slot] = card;
      }
      const community = view.community.slice();
      while (community.length < boardSize) community.push(pile.pop()!);
      for (let i = 0; i < futureDeals; i++) hand.push(pile.pop()!);
      for (let i = 0; i < futureStreets; i++) greedyImprove(hand, slots, community, rule);

      const oppSlots = view.opponentSlots.map((c) => c ?? pile.pop()!);
      const mine = bestScore(slots, community, rule);
      const cmp = mine - bestScore(oppSlots, community, rule);
      const myJokers = slots.filter(isJoker).length;
      if (cmp > 0) total += config.winGain[categoryOf(mine)] + myJokers * jokerValue * opts.jokerBold;
      else if (cmp < 0) total -= stakes * jokerValue + myJokers * (config.jokerForfeit ?? 0);
    }
    const score = total / opts.samples + (opts.noise ? (rng.next() - 0.5) * opts.noise : 0);
    if (score > topScore) {
      topScore = score;
      bestAction = action;
    }
  }
  return bestAction;
}

/** Makes the single best standard-card placement, if it improves the hand. */
function greedyImprove(hand: StdCard[], slots: (Card | null)[], community: Card[], rule: OwnCardRule) {
  let best = bestScore(slots, community, rule);
  // Fill empty slots first; only consider swaps once every slot is used.
  const empties = slots.flatMap((c, i) => (c === null ? [i] : []));
  const targets = empties.length ? empties : slots.map((_, i) => i);
  let move: { i: number; slot: number } | null = null;
  hand.forEach((card, i) => {
    for (const slot of targets) {
      if (isJoker(slots[slot])) continue; // keep a Joker we chose to play
      const trial = slots.slice();
      trial[slot] = card;
      const v = bestScore(trial, community, rule);
      if (v > best) {
        best = v;
        move = { i, slot };
      }
    }
  });
  if (move) {
    const { i, slot } = move;
    const old = slots[slot];
    slots[slot] = hand.splice(i, 1)[0];
    if (isStd(old)) hand.push(old);
  }
}

// ---------------------------------------------------------------------------
// Draw style
// ---------------------------------------------------------------------------

const ANY_OWN = (n: number): OwnCardRule => ({ min: 0, max: n });

/** Standard cards the viewer cannot see: candidates for the deck and the opponent's hand. */
function unseen(view: SeatView): StdCard[] {
  const known = new Set<string>(
    [...view.hand, ...view.slots, ...view.community, ...view.opponentSlots, ...view.discards].filter(isStd).map((c) => c.id),
  );
  return fullDeck().filter((c) => !known.has(c.id));
}

function boardSize(config: RulesConfig) {
  return config.communitySchedule.reduce((a, b) => a + b, 0);
}

/** Expected Joker stakes against us if we lose: community Jokers plus a guess at what the opponent dares. */
function expectedStakes(view: SeatView) {
  return (view.communityJoker ? 1 : 0) + view.community.filter(isJoker).length + 0.3 * Math.min(view.opponentJokerCount, 2);
}

/** How readily each style folds in pot mode: fold when continuing is worth less than this share of the pot. */
const FOLD_BAR: Partial<Record<AiId, number>> = {
  careful: 0.1,
  gambler: 0,
  shark: -0.1,
  dreamer: 0,
  loose: -0.3,
  defeatist: 0.35, // Lenny folds at the first sign of trouble
  predator: 0.15, // Eliza only stays in with a reason
};

function drawAction(ai: AiId, view: SeatView, config: RulesConfig, rng: Rng): Action {
  const options = subsets(view.hand.map((c) => c.id)).filter((ids) => ids.length <= view.deckSize);
  const discard = (cards: Card[]): Action => ({ type: 'draw', cardIds: cards.map((c) => c.id).slice(0, view.deckSize) });
  switch (ai) {
    case 'bully':
      // Keeps his big cards, throws away anything below a ten.
      return discard(view.hand.filter((c) => isStd(c) && c.rank < 10));
    case 'stubborn':
      // Stands pat on anything that isn't truly hopeless.
      return discard(view.hand.filter((c) => isStd(c) && c.rank <= 4));
    case 'anarchist': {
      // Throw-happy: always chucks a card or two, usually the small ones.
      const low = [...view.hand].sort((x, y) => x.rank - y.rank);
      return discard(low.slice(0, rng.next() < 0.5 ? 1 : 2));
    }
    case 'clueless':
      return { type: 'draw', cardIds: rng.pick(options) };
    case 'prankster':
      return rng.next() < 0.7 ? { type: 'draw', cardIds: rng.pick(options) } : smartDraw(ai, view, config, rng, options, 15);
    case 'dreamer':
      return rng.next() < 0.5 ? { type: 'draw', cardIds: rng.pick(options) } : smartDraw(ai, view, config, rng, options, 40);
    case 'loose':
      return smartDraw(ai, view, config, rng, options, 15);
    case 'careful':
      return smartDraw(ai, view, config, rng, options, 40);
    case 'shark':
      return smartDraw(ai, view, config, rng, options, 30);
    case 'gambler':
      return smartDraw(ai, view, config, rng, options, 50);
    case 'predator':
      return smartDraw(ai, view, config, rng, options, 50);
    case 'defeatist':
      // Never chases: swaps one card at most.
      return smartDraw(ai, view, config, rng, options.filter((o) => o.length <= 1), 25);
    case 'swashbuckler':
      // Goes for the spectacular: big hands count for far more than small ones.
      return smartDraw(ai, view, config, rng, options, 30, 3);
    case 'griefer':
      // Never fishes while snags are in the deck: let someone else catch them.
      if (view.deckSnags > 0) return { type: 'draw', cardIds: [] };
      return smartDraw(ai, view, config, rng, options, 15);
    case 'clueless':
    case 'prankster':
      return { type: 'draw', cardIds: rng.pick(options) };
  }
}

/**
 * Monte Carlo over which cards to throw away, judged by the chance of winning
 * at showdown. In pot mode it weighs that chance against what the swap costs,
 * and folds when no option is worth paying for.
 */
function smartDraw(ai: AiId, view: SeatView, config: RulesConfig, rng: Rng, options: string[][], samples: number, ambition = 0): Action {
  const pool = unseen(view);
  const size = boardSize(config);
  const oppHandSize = view.opponentHandSize;
  const fee = view.potMode ? streetFee(config, view.month, view.street + 1) : 0;
  const laterFees = view.potMode && view.street === 0 ? streetFee(config, view.month, 2) : 0;
  let best = options[0];
  let bestValue = -Infinity;
  for (const ids of options) {
    let wins = 0;
    let winValue = 0;
    for (let s = 0; s < samples; s++) {
      const pile = rng.shuffle(pool);
      const hand: Card[] = view.hand.filter((c) => !ids.includes(c.id));
      for (let i = 0; i < ids.length; i++) hand.push(pile.pop()!);
      const board = view.community.slice();
      while (board.length < size) board.push(pile.pop()!);
      const opp = pile.slice(-oppHandSize);
      const mine = bestScore(hand, board, ANY_OWN(hand.length));
      const theirs = bestScore(opp, board, ANY_OWN(opp.length));
      if (mine > theirs) {
        // Ambition: how much more a big hand is worth to this captain than a small one.
        const glory = 1 + (ambition * CATEGORIES.indexOf(categoryOf(mine))) / 8;
        wins += glory;
        winValue += glory * (1 + config.winGain[categoryOf(mine)] / 20);
      }
    }
    let value: number;
    if (view.potMode) {
      // Expected pot at showdown: what's in it, plus both sides' fees from here on.
      const cost = fee + laterFees + discardCost(view.discardedCount, ids.length);
      const finalPot = view.pot + cost + fee + laterFees + 1;
      value = (wins / samples) * finalPot - cost;
    } else value = winValue;
    if (value > bestValue) {
      bestValue = value;
      best = ids;
    }
  }
  const bar = FOLD_BAR[ai];
  if (view.potMode && view.canFold && bar !== undefined && bestValue < bar * view.pot) return { type: 'fold' };
  return { type: 'draw', cardIds: best };
}

interface Composition {
  cardIds: string[];
  jokers: number;
  score: number;
}

function compositions(view: SeatView): Composition[] {
  const out: Composition[] = [];
  for (const ids of subsets(view.hand.map((c) => c.id))) {
    const cards = view.hand.filter((c) => ids.includes(c.id));
    for (let j = 0; j <= Math.min(view.jokers.length, 5 - ids.length); j++) {
      const own: Card[] = [...cards, ...view.jokers.slice(0, j)];
      out.push({ cardIds: ids, jokers: j, score: bestScore(own, view.community, { min: own.length, max: own.length }) });
    }
  }
  return out;
}

const asAction = (c: Composition): Action => ({ type: 'compose', cardIds: c.cardIds, jokers: c.jokers });

function composeAction(ai: AiId, view: SeatView, config: RulesConfig, rng: Rng): Action {
  const options = compositions(view);
  const strongest = (list: Composition[]) => list.reduce((a, b) => (b.score > a.score ? b : a));
  const noJokers = options.filter((o) => o.jokers === 0);
  switch (ai) {
    case 'bully':
      return asAction(strongest(noJokers));
    case 'clueless': {
      // Believes snags make a hand stronger, so in they all go.
      const ids = rng.pick(subsets(view.hand.map((c) => c.id)));
      return { type: 'compose', cardIds: ids, jokers: Math.min(view.jokers.length, 5 - ids.length) };
    }
    case 'anarchist': {
      // Plays his best hand — and now and then hurls every Joker he has at you.
      const best = strongest(noJokers);
      if (view.jokers.length && rng.next() < 0.35) {
        return { type: 'compose', cardIds: best.cardIds, jokers: Math.min(view.jokers.length, 5 - best.cardIds.length) };
      }
      return asAction(best);
    }
    case 'prankster':
      return asAction(rng.pick(options));
    case 'dreamer':
      return rng.next() < 0.5 ? asAction(rng.pick(options)) : smartCompose(view, config, rng, options, 150, 1);
    case 'stubborn':
      return smartCompose(view, config, rng, options, 80, 0.5);
    case 'loose':
      return smartCompose(view, config, rng, options, 60, 1.3);
    case 'careful':
      return smartCompose(view, config, rng, options, 200, 0.3);
    case 'shark':
      return smartCompose(view, config, rng, options, 150, 1.6);
    case 'gambler':
      return smartCompose(view, config, rng, options, 300, 1);
    case 'predator':
      // Patient all round, then merciless: loves to bury a beaten rival in snags.
      return smartCompose(view, config, rng, options, 300, 2);
    case 'defeatist':
      return smartCompose(view, config, rng, options, 120, 0.2);
    case 'swashbuckler':
      return smartCompose(view, config, rng, options, 100, 1.8);
    case 'griefer':
      // Gleefully puts snags in play, whatever the cost.
      return smartCompose(view, config, rng, options, 100, 2.5);
  }
}

/** Weighs each composition's chance of winning against the Jokers it could shed. */
function smartCompose(view: SeatView, config: RulesConfig, rng: Rng, options: Composition[], samples: number, jokerBold: number): Action {
  const pool = unseen(view);
  const theirs: number[] = [];
  for (let s = 0; s < samples; s++) {
    const opp = rng.shuffle(pool).slice(0, view.opponentHandSize);
    theirs.push(bestScore(opp, view.community, ANY_OWN(opp.length)));
  }
  const jokerValue = config.drainPerJoker * 3;
  const stakes = expectedStakes(view);
  let best = options[0];
  let bestValue = -Infinity;
  for (const o of options) {
    const pWin = theirs.filter((t) => o.score > t).length / samples;
    const forfeit = o.jokers * (config.jokerForfeit ?? 0);
    const prize = view.potMode ? view.pot : config.winGain[categoryOf(o.score)];
    const value = pWin * (prize + o.jokers * jokerValue * jokerBold) - (1 - pWin) * (stakes * jokerValue + forfeit);
    if (value > bestValue) {
      bestValue = value;
      best = o;
    }
  }
  return asAction(best);
}

export interface OpponentOdds {
  /** Chance the opponent's best possible hand (without Jokers) is each category. */
  categories: Record<Category, number>;
  /** Chance their best possible hand beats your best possible hand (both without Jokers). */
  beatsYou: number;
}

/**
 * The hint: what could the other player be holding? Uses only what the viewer
 * can see — the board, all discards and the opponent's hand size.
 */
export function opponentOdds(view: SeatView, config: RulesConfig, rng: Rng, samples = 400): OpponentOdds {
  const pool = unseen(view);
  const size = boardSize(config);
  const categories = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  let beats = 0;
  for (let s = 0; s < samples; s++) {
    const pile = rng.shuffle(pool);
    const opp = pile.splice(0, view.opponentHandSize);
    const board = view.community.slice();
    while (board.length < size) board.push(pile.pop()!);
    const theirs = bestScore(opp, board, ANY_OWN(opp.length));
    categories[categoryOf(theirs)] += 1 / samples;
    if (theirs > bestScore(view.hand, board, ANY_OWN(view.hand.length))) beats++;
  }
  return { categories, beatsYou: beats / samples };
}
