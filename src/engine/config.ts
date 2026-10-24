import type { Category } from './evaluate';

export type JokerMode = 'slot' | 'shuffled';
/**
 * 'slots': place one card per street into slots.
 * 'draw': discard any cards on the Flop and Turn, then compose your hand on the River.
 */
export type PlayStyle = 'slots' | 'draw';
export type Schedule = [number, number, number];

export interface RulesConfig {
  /** Display name of the preset this config came from (informational). */
  preset: string;
  playStyle: PlayStyle;
  /** Community cards revealed on Flop, Turn, River. */
  communitySchedule: Schedule;
  /** Cards dealt to each player on Flop, Turn, River. */
  dealSchedule: Schedule;
  /** Number of play slots per player (slots style only). */
  slotCount: number;
  /**
   * How many of your own slot cards the 5-card hand must use (Jokers and empty
   * slots count, as dead cards). The rest comes from the community cards.
   * Texas: 0–slots, Omaha: exactly 2. Draw style ignores this: you use exactly
   * the cards you choose to play.
   */
  ownCards: { min: number; max: number };
  /** 'slot': a separate fourth community slot holds the prize Joker; 'shuffled': Jokers are shuffled into the deck. */
  jokerMode: JokerMode;
  totalJokers: number;
  /** Slot mode: chance per round (from month 2) of a community Joker. */
  communityJokerChance: number;
  /** Shuffled mode: one more unowned Joker goes into the deck every N months. */
  shuffledJokerEveryMonths: number;
  /** Money lost per owned Joker at the end of every round. */
  drainPerJoker: number;
  /**
   * Share of the winner's gain that the loser loses: 0 = losing costs nothing,
   * 1 = zero-sum (the winner's gain comes out of the loser's purse).
   */
  loserPays: number;
  /** Dollars the loser pays the winner for every Joker they put in their losing hand. */
  jokerForfeit: number;
  /**
   * Draw style: play for a pot (antes, street fees, discard fees) instead of
   * fixed payouts. Joker upkeep is then paid into the ante.
   */
  pot: boolean;
  /** Pot mode: the ante is ceil(crossing / anteEvery). */
  anteEvery: number;
  /** Pot mode: the Turn and River fees are floor(ante / divisor). */
  streetFeeDivisors: [number, number];
  startMoney: number;
  winGain: Record<Category, number>;
}

const BASE_GAIN: Record<Category, number> = {
  highCard: 1,
  pair: 3,
  twoPair: 5,
  threeOfAKind: 7,
  straight: 9,
  flush: 11,
  fullHouse: 13,
  fourOfAKind: 16,
  straightFlush: 20,
};

/** Omaha slots (formerly "Kansas"): full Hold'em board, three slots, Omaha's use-exactly-two rule. */
const KANSAS: RulesConfig = {
  preset: 'kansas',
  playStyle: 'slots',
  communitySchedule: [3, 1, 1],
  dealSchedule: [3, 1, 1],
  slotCount: 3,
  ownCards: { min: 2, max: 2 },
  jokerMode: 'shuffled',
  totalJokers: 10,
  communityJokerChance: 0.5,
  shuffledJokerEveryMonths: 2,
  drainPerJoker: 4,
  loserPays: 1,
  jokerForfeit: 5,
  pot: false,
  anteEvery: 3,
  streetFeeDivisors: [3, 2],
  startMoney: 50,
  winGain: BASE_GAIN,
};

/** Named rule sets for play-testing and simulation. */
export const PRESETS: Record<string, RulesConfig> = {
  /**
   * Snag Poker, the game: three cards, discard any on the Flop and Turn,
   * compose your hand on the River, play for the pot. Free snags (jokers in
   * the code) are shuffled into the deck after the Flop.
   */
  draw: { ...KANSAS, preset: 'draw', playStyle: 'draw', dealSchedule: [3, 0, 0], pot: true },
  /** Kansas Draw: the same game with a plain deck, no snags at all. */
  kansasDraw: { ...KANSAS, preset: 'kansasDraw', playStyle: 'draw', dealSchedule: [3, 0, 0], pot: true, totalJokers: 0 },
  kansas: KANSAS,
  texas: { ...KANSAS, preset: 'texas', ownCards: { min: 0, max: 3 } },
  middle: { ...KANSAS, preset: 'middle', ownCards: { min: 1, max: 2 } },
  threePlusThree: {
    ...KANSAS,
    preset: 'threePlusThree',
    communitySchedule: [1, 1, 1],
    ownCards: { min: 2, max: 3 },
  },
  classic: {
    ...KANSAS,
    preset: 'classic',
    communitySchedule: [1, 1, 1],
    slotCount: 2,
    ownCards: { min: 2, max: 2 },
    jokerMode: 'slot',
  },
};

export const DEFAULT_CONFIG: RulesConfig = PRESETS.draw;
