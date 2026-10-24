import { describe, expect, it } from 'vitest';
import { jokerCard, parseCard, type Card } from './cards';
import { bestHand, compareHands, evaluate } from './evaluate';

const hand = (codes: string): Card[] => codes.split(' ').map((c) => (c === 'X' ? jokerCard(0) : parseCard(c)));
const cat = (codes: string) => evaluate(hand(codes)).category;
const beats = (a: string, b: string) => compareHands(evaluate(hand(a)), evaluate(hand(b)));

describe('evaluate', () => {
  it('recognises every category', () => {
    expect(cat('As Ks Qs Js Ts')).toBe('straightFlush');
    expect(cat('As Ad Ah Ac 2s')).toBe('fourOfAKind');
    expect(cat('As Ad Ah Kc Ks')).toBe('fullHouse');
    expect(cat('2s 7s 9s Js Ks')).toBe('flush');
    expect(cat('5d 6s 7h 8c 9s')).toBe('straight');
    expect(cat('Ad 2s 3h 4c 5s')).toBe('straight');
    expect(cat('7s 7d 7h Kc 2s')).toBe('threeOfAKind');
    expect(cat('7s 7d Kh Kc 2s')).toBe('twoPair');
    expect(cat('7s 7d Kh Qc 2s')).toBe('pair');
    expect(cat('7s 3d Kh Qc 2s')).toBe('highCard');
  });

  it('treats Jokers as dead cards', () => {
    expect(cat('As Ad Ah Ac X')).toBe('fourOfAKind');
    expect(cat('As Ks Qs Js X')).toBe('highCard'); // no flush or straight with 4 real cards
    expect(cat('X X 9h 9c 2s')).toBe('pair');
  });

  it('handles empty slots', () => {
    expect(evaluate([null, null, parseCard('9h'), parseCard('9c'), parseCard('2s')]).category).toBe('pair');
  });

  it('the wheel is the lowest straight', () => {
    expect(beats('2d 3s 4h 5c 6s', 'Ad 2s 3h 4c 5s')).toBeGreaterThan(0);
  });

  it('an Ace-high flush beats a King-high flush', () => {
    expect(beats('As 9s 7s 4s 2s', 'Ks Qs 9s 7s 4s')).toBeGreaterThan(0);
  });

  it('aces are high, and low only in the wheel (no round-the-corner straights)', () => {
    expect(cat('Ts Jd Qh Kc As')).toBe('straight');
    expect(cat('Qs Kd Ah 2c 3s')).toBe('highCard');
    expect(beats('Ad 4s 7h 9c Js', 'Kd 4c 7d 9s Jc')).toBeGreaterThan(0);
  });

  it('uses kickers', () => {
    expect(beats('9s 9d Ah 4c 2s', '9h 9c Kh 4d 2d')).toBeGreaterThan(0);
  });

  it('a real kicker beats a dead card', () => {
    expect(beats('9s 9d 2c Ah Kd', '9h 9c X Ah Kd')).toBeGreaterThan(0);
  });

  it('breaks exact rank ties by suit: clubs < diamonds < hearts < spades', () => {
    expect(beats('Ks 7d 9h 9c 2s', 'Kh 7c 9h 9c 2s')).toBeGreaterThan(0);
    expect(beats('Kc 7s 4h 3c 2s', 'Kd 7d 4h 3c 2s')).toBeLessThan(0);
  });

  it('is a true draw only with identical real cards', () => {
    expect(beats('X X 9h 9c 2s', 'X X 9h 9c 2s')).toBe(0);
  });
});

describe('bestHand', () => {
  const cards = (codes: string) => codes.split(' ').map((c) => (c === 'X' ? jokerCard(1) : c === '_' ? null : parseCard(c)));
  const omaha = { min: 2, max: 2 };
  const texas = { min: 0, max: 3 };
  const best = (slots: string, board: string, rule = omaha) =>
    bestHand(cards(slots), cards(board) as Card[], rule).category;

  it('Omaha rule: must use exactly two own cards', () => {
    // Four hearts on the board but only one heart in hand: no flush in Omaha.
    expect(best('Ah 2c 3d', 'Kh Qh Jh 9h 4s')).not.toBe('flush');
    expect(best('Ah 2h 3d', 'Kh Qh Jh 9c 4s')).toBe('flush');
  });

  it('Texas rule: may play the board', () => {
    expect(best('2c 3d 7s', 'Kh Qh Jh 9h 4h', texas)).toBe('flush');
  });

  it('one Joker is free when the other two cards carry the hand', () => {
    expect(best('As Ad X', 'Ah Kc 7d 4s 2c')).toBe('threeOfAKind');
  });

  it('two Jokers force a dead card', () => {
    // Must use two own cards, one of them a Joker: pair of aces at best, no kicker from hand.
    expect(best('As X X', 'Ah Kc 7d 4s 2c')).toBe('pair');
    const twoJokers = bestHand(cards('As X X'), cards('Ah Kc 7d 4s 2c') as Card[], omaha);
    expect(twoJokers.cards).toHaveLength(4);
  });

  it('works on an incomplete board', () => {
    expect(best('As Ad _', 'Ah')).toBe('threeOfAKind');
  });
});
