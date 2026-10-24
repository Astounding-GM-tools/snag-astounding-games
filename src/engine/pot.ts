/**
 * Pot mode (draw style): there are no fixed payouts. Everyone antes in, pays a
 * small fee to see the Turn and the River, and pays for every card they throw
 * away; the winner takes the pot.
 */
import type { RulesConfig } from './config';

/** The table ante for a crossing: ceil(crossing / anteEvery). */
export function baseAnte(config: RulesConfig, month: number): number {
  return Math.ceil(month / (config.anteEvery || 3));
}

/** A captain's ante: the table ante plus upkeep for every Joker they carry. */
export function anteFor(config: RulesConfig, month: number, jokers: number): number {
  return baseAnte(config, month) + jokers * config.drainPerJoker;
}

/** Fee to see the next street (1 = Turn, 2 = River): a fraction of the table ante. */
export function streetFee(config: RulesConfig, month: number, nextStreet: number): number {
  const divisor = (config.streetFeeDivisors ?? [3, 2])[nextStreet - 1];
  return divisor ? Math.floor(baseAnte(config, month) / divisor) : 0;
}

/** Throwing away cards gets dearer: the k-th card in a crossing costs $k. */
export function discardCost(alreadyDiscarded: number, count: number): number {
  let cost = 0;
  for (let i = 1; i <= count; i++) cost += alreadyDiscarded + i;
  return cost;
}
