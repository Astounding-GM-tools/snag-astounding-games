/**
 * One month's duel between two seats. These functions mutate the round they are
 * given; the public game API (game.ts) clones state before calling them.
 */
import { fullDeck, isJoker, type Card, type JokerCard, type StdCard } from './cards';
import type { PlayStyle, RulesConfig } from './config';
import { bestHand, compareHands, type HandValue } from './evaluate';
import { anteFor, discardCost, streetFee } from './pot';
import type { Rng } from './rng';

export type SlotIndex = number;

export type Action =
  | { type: 'place'; cardId: string; slot: SlotIndex }
  | { type: 'discard'; cardId: string }
  | { type: 'pass' }
  /** Draw style: discard these cards and draw replacements (none = stand pat). */
  | { type: 'draw'; cardIds: string[] }
  /** Draw style, after the River: the hand cards and number of Jokers you play. */
  | { type: 'compose'; cardIds: string[]; jokers: number }
  /** Pot mode, Flop or Turn, before any swap this crossing: give up the pot. */
  | { type: 'fold' };

export interface Seat {
  playerId: string;
  hand: StdCard[];
  /** Owned Jokers not currently in a slot. They never take hand space. */
  jokers: JokerCard[];
  /** Slots style: the play slots. Draw style: empty until composed, then the cards played. */
  slots: (Card | null)[];
  /** Cards this seat discarded this round (face up). */
  discarded: StdCard[];
  /** Draw style: how many of `discarded` were thrown on the Flop (the rest on the Turn). */
  flopDiscards?: number;
}

export const STREETS = ['flop', 'turn', 'river'] as const;
export type StreetName = (typeof STREETS)[number];

export interface RoundResult {
  /** Seat index of the winner, or null for a true draw. */
  winner: 0 | 1 | null;
  hands: [HandValue, HandValue];
  /** What the winner gains: the pot in pot mode, otherwise the hand's payout. */
  gain: number;
  /** Pot mode: everything both players paid in. */
  pot: number;
  /** Seat that folded, if the round ended that way. */
  folded: 0 | 1 | null;
  /** Extra the loser pays the winner for the Jokers they risked and lost with. */
  forfeit: number;
  /** Jokers the winner dumped on the loser. */
  dumped: JokerCard[];
  /** Community Jokers the loser had to take. */
  communityTaken: JokerCard[];
  /** Jokers that went back to the unowned pool. */
  returnedToPool: JokerCard[];
}

export interface RoundState {
  month: number;
  playStyle: PlayStyle;
  seats: [Seat, Seat];
  deck: Card[];
  /** Revealed community cards (in shuffled mode one may be a dead Joker). */
  community: Card[];
  /** Slot mode: the Joker in the fourth community slot, if any. */
  communityJoker: JokerCard | null;
  /** 0..2 on the streets (draw style composes on the River); 3 once a slots-style showdown is done. */
  street: number;
  discards: StdCard[];
  history: { street: number; actions: [Action, Action] }[];
  /** Jokers drawn from the deck by a player this round (shuffled Joker mode). */
  fished: { seat: number; street: number; joker: JokerCard }[];
  /** Pot mode is on for this round. */
  potMode: boolean;
  /** Pot mode: what each seat has paid into the pot so far. */
  bets: [number, number];
  result: RoundResult | null;
}

export interface RoundPlayer {
  id: string;
  jokers: JokerCard[];
}

/**
 * Creates a round and deals the Flop. Takes any Jokers it needs from `pool`
 * (mutated). Returns the round, ready for the players' Flop actions.
 */
export function createRound(
  month: number,
  players: [RoundPlayer, RoundPlayer],
  pool: JokerCard[],
  config: RulesConfig,
  rng: Rng,
): RoundState {
  const seat = (p: RoundPlayer): Seat => ({
    playerId: p.id,
    hand: [],
    jokers: p.jokers.slice(),
    slots: config.playStyle === 'slots' ? Array.from({ length: config.slotCount }, () => null) : [],
    discarded: [],
  });
  const round: RoundState = {
    month,
    playStyle: config.playStyle,
    seats: [seat(players[0]), seat(players[1])],
    deck: rng.shuffle(fullDeck()),
    community: [],
    communityJoker: null,
    street: 0,
    discards: [],
    history: [],
    fished: [],
    potMode: config.playStyle === 'draw' && config.pot,
    bets: [0, 0],
    result: null,
  };
  if (round.potMode) {
    round.bets = [anteFor(config, month, players[0].jokers.length), anteFor(config, month, players[1].jokers.length)];
  }

  if (config.jokerMode === 'slot' && month > 1 && pool.length > 0 && rng.next() < config.communityJokerChance) {
    round.communityJoker = takeFromPool(pool, rng);
  }

  dealStreet(round, config);

  if (config.jokerMode === 'shuffled') {
    const count = Math.min(pool.length, Math.floor((month - 1) / config.shuffledJokerEveryMonths));
    const jokers: Card[] = [];
    for (let i = 0; i < count; i++) jokers.push(takeFromPool(pool, rng));
    round.deck = rng.shuffle([...round.deck, ...jokers]);
  }
  return round;
}

function takeFromPool(pool: JokerCard[], rng: Rng): JokerCard {
  return pool.splice(rng.int(pool.length), 1)[0];
}

function draw(round: RoundState): Card {
  const card = round.deck.pop();
  if (!card) throw new Error('Deck is empty');
  return card;
}

/**
 * Draws one card for a seat. A Joker fished out of the deck becomes the seat's
 * Joker; in the draw style the seat then draws again, so the hand never
 * shrinks (catching the Joker is penalty enough).
 */
function drawToSeat(round: RoundState, seat: Seat) {
  while (round.deck.length) {
    const card = draw(round);
    if (!isJoker(card)) {
      seat.hand.push(card);
      return;
    }
    seat.jokers.push(card);
    round.fished.push({ seat: round.seats.indexOf(seat), street: round.street, joker: card });
    if (round.playStyle !== 'draw') return;
  }
}

function dealStreet(round: RoundState, config: RulesConfig) {
  for (let i = 0; i < config.communitySchedule[round.street]; i++) round.community.push(draw(round));
  const n = config.dealSchedule[round.street];
  for (let i = 0; i < n; i++) for (const seat of round.seats) drawToSeat(round, seat);
}

export function legalActions(round: RoundState, seatIndex: number): Action[] {
  const seat = round.seats[seatIndex];
  if (round.playStyle === 'draw') {
    const ids = seat.hand.map((c) => c.id);
    if (isComposing(round)) {
      return subsets(ids).flatMap((cardIds) =>
        Array.from({ length: Math.min(seat.jokers.length, 5 - cardIds.length) + 1 }, (_, jokers): Action => ({ type: 'compose', cardIds, jokers })),
      );
    }
    const draws = subsets(ids)
      .filter((cardIds) => cardIds.length <= round.deck.length)
      .map((cardIds): Action => ({ type: 'draw', cardIds }));
    return canFold(round, seatIndex) ? [...draws, { type: 'fold' }] : draws;
  }
  return legalSeatActions(seat, round.deck.length);
}

/** All subsets of a small list, smallest first. */
export function subsets<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let mask = 0; mask < 1 << items.length; mask++) out.push(items.filter((_, i) => mask & (1 << i)));
  return out.sort((a, b) => a.length - b.length);
}

/**
 * Pot mode: you may fold on the Flop or the Turn, whatever you've swapped. Never
 * on the River: by then folding would only be a way to dodge snags, so you face
 * the showdown and take what comes.
 */
export function canFold(round: RoundState, seatIndex: number): boolean {
  void seatIndex;
  return round.potMode && !round.result && round.street < 2;
}

/** Pot mode: what an action costs the seat (street fee plus discard fees). */
export function actionCost(round: RoundState, seatIndex: number, action: Action, config: RulesConfig): number {
  if (!round.potMode || action.type !== 'draw') return 0;
  return streetFee(config, round.month, round.street + 1) + discardCost(round.seats[seatIndex].discarded.length, action.cardIds.length);
}

/** Draw style: true on the River, where hands are composed (no discarding there). */
export function isComposing(round: RoundState): boolean {
  return round.playStyle === 'draw' && round.street === 2 && !round.result;
}

/** Every action except passing; passing is only allowed when nothing else is. */
export function legalSeatActions(seat: Pick<Seat, 'hand' | 'jokers' | 'slots'>, deckSize: number): Action[] {
  const actions: Action[] = [];
  const placeable: Card[] = [...seat.hand];
  // All Jokers are interchangeable for play, so one representative is enough.
  if (seat.jokers.length) placeable.push(seat.jokers[0]);
  for (const card of placeable) {
    for (let slot = 0; slot < seat.slots.length; slot++) {
      // Swapping a Joker for a Joker changes nothing.
      if (isJoker(card) && isJoker(seat.slots[slot])) continue;
      actions.push({ type: 'place', cardId: card.id, slot });
    }
  }
  if (deckSize > 0) for (const card of seat.hand) actions.push({ type: 'discard', cardId: card.id });
  return actions.length ? actions : [{ type: 'pass' }];
}

export function isLegal(round: RoundState, seatIndex: number, action: Action): boolean {
  const seat = round.seats[seatIndex];
  if (round.playStyle === 'draw') {
    if (action.type === 'fold') return canFold(round, seatIndex);
    if (action.type !== (isComposing(round) ? 'compose' : 'draw')) return false;
    const ids = action.cardIds;
    if (new Set(ids).size !== ids.length || !ids.every((id) => seat.hand.some((c) => c.id === id))) return false;
    if (action.type === 'draw') return ids.length <= round.deck.length;
    return Number.isInteger(action.jokers) && action.jokers >= 0 && action.jokers <= seat.jokers.length && ids.length + action.jokers <= 5;
  }
  if (action.type === 'draw' || action.type === 'compose' || action.type === 'fold') return false;
  if (action.type === 'pass') return legalActions(round, seatIndex)[0].type === 'pass';
  if (action.type === 'place' && !(action.slot >= 0 && action.slot < seat.slots.length)) return false;
  if (action.type === 'discard') return round.deck.length > 0 && seat.hand.some((c) => c.id === action.cardId);
  return seat.hand.some((c) => c.id === action.cardId) || seat.jokers.some((c) => c.id === action.cardId);
}

function discardCard(round: RoundState, seat: Seat, cardId: string) {
  const [card] = seat.hand.splice(seat.hand.findIndex((c) => c.id === cardId), 1);
  round.discards.push(card);
  seat.discarded.push(card);
}

function applyAction(round: RoundState, seat: Seat, action: Action) {
  if (action.type === 'pass' || action.type === 'fold') return;
  if (action.type === 'discard') {
    discardCard(round, seat, action.cardId);
    drawToSeat(round, seat);
    return;
  }
  if (action.type === 'draw') {
    if (round.street === 0) seat.flopDiscards = action.cardIds.length;
    for (const id of action.cardIds) discardCard(round, seat, id);
    for (let i = 0; i < action.cardIds.length; i++) drawToSeat(round, seat);
    return;
  }
  if (action.type === 'compose') {
    seat.slots = [
      ...action.cardIds.map((id) => seat.hand.find((c) => c.id === id)!),
      ...seat.jokers.splice(0, action.jokers),
    ];
    seat.hand = seat.hand.filter((c) => !action.cardIds.includes(c.id));
    return;
  }
  let card: Card;
  const hi = seat.hand.findIndex((c) => c.id === action.cardId);
  if (hi >= 0) card = seat.hand.splice(hi, 1)[0];
  else card = seat.jokers.splice(seat.jokers.findIndex((c) => c.id === action.cardId), 1)[0];
  returnToHand(seat, seat.slots[action.slot]);
  seat.slots[action.slot] = card;
}

function returnToHand(seat: Seat, card: Card | null) {
  if (!card) return;
  if (isJoker(card)) seat.jokers.push(card);
  else seat.hand.push(card);
}

/**
 * Applies both players' secret actions simultaneously, then deals the next
 * street or resolves the showdown.
 */
export function resolveStreet(round: RoundState, actions: [Action, Action], config: RulesConfig) {
  if (round.result) throw new Error('Round is over');
  actions.forEach((a, i) => {
    if (!isLegal(round, i, a)) throw new Error(`Illegal action for seat ${i}: ${JSON.stringify(a)}`);
  });
  const folds = actions.map((a) => a.type === 'fold');
  if (folds[0] || folds[1]) {
    round.history.push({ street: round.street, actions });
    // Both folding is a stand-off: the pot is split.
    return foldEnd(round, folds[0] && folds[1] ? null : folds[0] ? 0 : 1);
  }
  actions.forEach((a, i) => (round.bets[i] += actionCost(round, i, a, config)));
  actions.forEach((a, i) => applyAction(round, round.seats[i], a));
  round.history.push({ street: round.street, actions });
  if (round.playStyle === 'draw' && round.street === 2) return showdown(round, config); // hands composed
  round.street++;
  if (round.street <= 2) dealStreet(round, config);
  else showdown(round, config);
}

/** The own-card rule for a seat: draw style uses exactly the cards played. */
export function ownCardRule(round: RoundState, seatIndex: number, config: RulesConfig) {
  if (round.playStyle === 'slots') return config.ownCards;
  const n = round.seats[seatIndex].slots.length;
  return { min: n, max: n };
}

export function handInPlay(round: RoundState, seatIndex: number, config: RulesConfig): HandValue {
  return bestHand(round.seats[seatIndex].slots, round.community, ownCardRule(round, seatIndex, config));
}

function showdown(round: RoundState, config: RulesConfig) {
  const hands: [HandValue, HandValue] = [handInPlay(round, 0, config), handInPlay(round, 1, config)];
  const cmp = compareHands(hands[0], hands[1]);
  const winner: 0 | 1 | null = cmp > 0 ? 0 : cmp < 0 ? 1 : null;

  const communityJokers = round.community.filter(isJoker);
  if (round.communityJoker) communityJokers.push(round.communityJoker);
  const placed = round.seats.map((s) => s.slots.filter(isJoker));
  const returnedToPool = round.deck.filter(isJoker);

  let dumped: JokerCard[] = [];
  let communityTaken: JokerCard[] = [];
  if (winner === null) {
    round.seats.forEach((s, i) => s.jokers.push(...placed[i]));
    returnedToPool.push(...communityJokers);
  } else {
    const loser = round.seats[1 - winner];
    dumped = placed[winner];
    communityTaken = communityJokers;
    loser.jokers.push(...dumped, ...placed[1 - winner], ...communityTaken);
  }

  const pot = round.bets[0] + round.bets[1];
  round.result = {
    winner,
    hands,
    gain: winner === null ? 0 : round.potMode ? pot : config.winGain[hands[winner].category],
    pot,
    folded: null,
    forfeit: winner === null ? 0 : placed[1 - winner].length * (config.jokerForfeit ?? 0),
    dumped,
    communityTaken,
    returnedToPool,
  };
}

/**
 * A fold ends the round at once: the other seat takes the pot. Nobody's hand is
 * shown, no Jokers change hands, and community Jokers go back into the deal.
 */
function foldEnd(round: RoundState, folder: 0 | 1 | null) {
  const winner: 0 | 1 | null = folder === null ? null : folder === 0 ? 1 : 0;
  const returnedToPool = [...round.deck.filter(isJoker), ...round.community.filter(isJoker)];
  if (round.communityJoker) returnedToPool.push(round.communityJoker);
  const any = (seat: Seat) => bestHand(seat.hand, round.community, { min: 0, max: seat.hand.length });
  const pot = round.bets[0] + round.bets[1];
  round.result = {
    winner,
    hands: [any(round.seats[0]), any(round.seats[1])],
    gain: winner === null ? 0 : pot,
    pot,
    folded: folder ?? 0,
    forfeit: 0,
    dumped: [],
    communityTaken: [],
    returnedToPool,
  };
}
