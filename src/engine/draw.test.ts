import { describe, expect, it } from 'vitest';
import { fullDeck, isJoker, jokerCard, parseCard, type Card, type StdCard } from './cards';
import { PRESETS } from './config';
import { planReveal } from './reveal';
import { isComposing, legalActions, resolveStreet, type RoundState, type Seat } from './round';
import { Rng } from './rng';

const config = PRESETS.draw;
const cards = (codes: string) => codes.split(' ').map(parseCard);

/** A draw-style round at the compose step with known cards. */
function composeRound(hands: [string, string], board: string, jokers: [number, number] = [0, 0]): RoundState {
  let next = 0;
  const seat = (hand: string, j: number): Seat => ({
    playerId: `p${next}`,
    hand: cards(hand),
    jokers: Array.from({ length: j }, () => jokerCard(next++)),
    slots: [],
    discarded: [],
  });
  const used = new Set([...hands.join(' ').split(' '), ...board.split(' ')]);
  return {
    month: 2,
    playStyle: 'draw',
    seats: [seat(hands[0], jokers[0]), seat(hands[1], jokers[1])],
    deck: fullDeck().filter((c: StdCard) => !used.has(c.id.replace('T', 'T'))),
    community: cards(board) as Card[],
    communityJoker: null,
    street: 2,
    discards: [],
    history: [],
    fished: [],
    potMode: false,
    bets: [0, 0],
    result: null,
  };
}

describe('draw style', () => {
  it('discarding draws replacements and is visible', () => {
    const r = composeRound(['As Kd 2c', 'Qs Qd 3h'], 'Ah 7c 7d 9s Jc');
    r.street = 0;
    r.community = r.community.slice(0, 3);
    resolveStreet(r, [{ type: 'draw', cardIds: ['2c', 'Kd'] }, { type: 'draw', cardIds: [] }], config);
    expect(r.seats[0].hand).toHaveLength(3);
    expect(r.seats[0].discarded.map((c) => c.id).sort()).toEqual(['2c', 'Kd']);
    // Remembered per street, so the table can show Flop and Turn discards apart.
    expect(r.seats[0].flopDiscards).toBe(2);
    expect(r.seats[1].flopDiscards).toBe(0);
    expect(r.street).toBe(1);
    expect(r.community).toHaveLength(4);
  });

  it('composes on the River, right after the Turn discards', () => {
    const r = composeRound(['As Kd 2c', 'Qs Qd 3h'], 'Ah 7c 7d 9s Jc');
    r.street = 1;
    r.community = r.community.slice(0, 4);
    resolveStreet(r, [{ type: 'draw', cardIds: [] }, { type: 'draw', cardIds: [] }], config);
    expect(r.community).toHaveLength(5);
    expect(isComposing(r)).toBe(true);
    expect(legalActions(r, 0).every((a) => a.type === 'compose')).toBe(true);
  });

  it('trips plus two Jokers plays no board at all, and the winner sheds both Jokers', () => {
    const r = composeRound(['9s 9d 9h', 'Qs 2d 3h'], 'Ah Kc 7d 4s Jc', [2, 0]);
    resolveStreet(r, [{ type: 'compose', cardIds: ['9s', '9d', '9h'], jokers: 2 }, { type: 'compose', cardIds: ['Qs'], jokers: 0 }], config);
    expect(r.result!.winner).toBe(0);
    expect(r.result!.hands[0].category).toBe('threeOfAKind');
    expect(r.result!.dumped).toHaveLength(2);
    expect(r.seats[1].jokers).toHaveLength(2);
    expect(r.seats[0].jokers).toHaveLength(0);
  });

  it('a full house cannot carry a Joker', () => {
    const r = composeRound(['Ks Kd 4h', 'Qs Qd Qh'], 'Kh 4c 7d 2s 9c', [1, 0]);
    // Without the Joker this is kings full of fours; with it, the 4♥ needs a partner it can no longer get.
    resolveStreet(r, [{ type: 'compose', cardIds: ['Ks', 'Kd', '4h'], jokers: 1 }, { type: 'compose', cardIds: ['Qs', 'Qd', 'Qh'], jokers: 0 }], config);
    expect(r.result!.hands[0].category).toBe('threeOfAKind');
    expect(r.result!.winner).toBe(0); // kings still beat queens…
    expect(r.result!.dumped).toHaveLength(1); // …and the Joker goes over
  });

  it('playing zero cards plays the board', () => {
    const r = composeRound(['2s 3d 5h', 'Qs Qd 3h'], 'Ah Ac Ad Kh Kc');
    resolveStreet(r, [{ type: 'compose', cardIds: [], jokers: 0 }, { type: 'compose', cardIds: ['Qs'], jokers: 0 }], config);
    expect(r.result!.hands[0].category).toBe('fullHouse');
  });
});

describe('planReveal', () => {
  it('reveals teasers first, Jokers next and the deciding card last', () => {
    const r = composeRound(['As Ad 2c', 'Ks Qs 3c'], 'Js Ts 7d 4h 2d', [0, 1]);
    // Opponent plays K♠ Q♠ + Joker: K Q J T + dead → King high (no straight with a dead card).
    resolveStreet(r, [{ type: 'compose', cardIds: ['As', 'Ad'], jokers: 0 }, { type: 'compose', cardIds: ['Ks', 'Qs'], jokers: 1 }], config);
    const steps = planReveal(r, 1, new Rng(1));
    expect(steps).toHaveLength(3);
    expect(isJoker(steps[1].card)).toBe(true);
    expect(steps[2].last).toBe(true);
    expect(steps[2].standing).toBe('ahead'); // the viewer's pair of aces wins
    expect(steps[0].possible.length).toBeGreaterThan(0);
  });
});

describe('fishing a Joker', () => {
  it('keeps the Joker and draws again, so the hand stays at three', () => {
    const r = composeRound(['As Kd 2c', 'Qs Qd 3h'], 'Ah 7c 7d 9s Jc');
    r.street = 0;
    r.community = r.community.slice(0, 3);
    // Top of the deck (popped first): a Joker, then a real card.
    r.deck = [parseCard('5h'), parseCard('9h'), jokerCard(7)];
    resolveStreet(r, [{ type: 'draw', cardIds: ['2c'] }, { type: 'draw', cardIds: [] }], config);
    expect(r.seats[0].hand).toHaveLength(3);
    expect(r.seats[0].jokers.map((j) => j.id)).toEqual(['X7']);
    expect(r.fished).toEqual([{ seat: 0, street: 0, joker: jokerCard(7) }]);
  });
});

describe('Joker forfeit', () => {
  it('the loser pays a forfeit for every Joker they risked; the winner pays none', () => {
    const r = composeRound(['2s 3d 5h', 'As Ad 9c'], 'Ah Kc 7d 4s Jc', [2, 1]);
    resolveStreet(r, [{ type: 'compose', cardIds: ['2s'], jokers: 2 }, { type: 'compose', cardIds: ['As', 'Ad'], jokers: 1 }], config);
    expect(r.result!.winner).toBe(1);
    expect(r.result!.forfeit).toBe(2 * config.jokerForfeit);
  });

  it('is zero when the loser risked no Jokers', () => {
    const r = composeRound(['2s 3d 5h', 'As Ad 9c'], 'Ah Kc 7d 4s Jc', [0, 1]);
    resolveStreet(r, [{ type: 'compose', cardIds: ['2s'], jokers: 0 }, { type: 'compose', cardIds: ['As', 'Ad'], jokers: 1 }], config);
    expect(r.result!.forfeit).toBe(0);
  });
});

