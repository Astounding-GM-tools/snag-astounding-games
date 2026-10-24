import { describe, expect, it } from 'vitest';
import { evaluate, parseCard } from '../engine';
import { describeHand, handLabel, tiebreak } from './handNames';

const hand = (codes: string) => evaluate(codes.split(' ').map(parseCard));

describe('tiebreak', () => {
  it('names the kicker when two pair meets two pair (the Steamboat Bill hand)', () => {
    const bill = hand('As Ad Kh Kd 8h');
    const you = hand('As Ad Kh Kd 6s');
    expect(describeHand(bill)).toBe(describeHand(you));
    expect(tiebreak(bill, you)).toEqual({ kind: 'kicker', winner: 'Eight', loser: 'Six', loserDead: false });
  });

  it('flags a dead card (a snag) that lost the kicker battle', () => {
    const ignatz = evaluate([parseCard('Ks'), parseCard('Kd'), parseCard('9c'), parseCard('4h'), parseCard('3s')]);
    const you = evaluate([parseCard('Ks'), parseCard('Kd'), parseCard('9c'), parseCard('4h'), null]);
    expect(tiebreak(ignatz, you)).toEqual({ kind: 'kicker', winner: 'Three', loser: 'snag', loserDead: true });
  });

  it('uses "next card" for flushes', () => {
    expect(tiebreak(hand('Ks Qs 9s 7s 4s'), hand('Kh Jh 9h 7h 4h'))?.kind).toBe('next');
  });

  it('falls back to suits when every rank matches', () => {
    expect(tiebreak(hand('As 9d 7c 5h 3c'), hand('Ah 9c 7d 5s 3d'))).toEqual({ kind: 'suit', winner: '♠', loser: '♡' });
  });

  it('says nothing when the hands already have different names', () => {
    expect(tiebreak(hand('As Ad Kh Kd 6s'), hand('As Ad Qh Qd 6s'))).toBeNull();
  });
});

describe('handLabel', () => {
  const label = (codes: string) => handLabel(hand(codes));

  it('calls a hand as the dealer would, then in table talk', () => {
    expect(label('Jh Js 9c 5d 2s')).toEqual({ call: 'Pair of Jacks', lingo: 'Hooks' });
    expect(label('Qh Qs Jc Jd 2s')).toEqual({ call: 'Two pair, Queens and Jacks', lingo: 'Ladies over Hooks' });
    expect(label('Qh Qs Qc 5d 2s')).toEqual({ call: 'Three of a kind, Queens', lingo: 'Trip Ladies' });
    expect(label('2h 2s 2c Ad As')).toEqual({ call: 'Full house, Deuces and Aces', lingo: 'Ducks full of Bullets' });
    expect(label('Ah As Ac 6d 6s')).toEqual({ call: 'Full house, Aces and Sixes', lingo: 'Bullets full of Kicks' });
    expect(label('As Ad Ac Ah 7s')).toEqual({ call: 'Four of a kind, Aces', lingo: 'Four Bullets' });
  });

  it('saves the exclamation mark for when it is asked for', () => {
    expect(handLabel(hand('Jh Js 9c 5d 2s'), { exclaim: true }).lingo).toBe('Hooks!');
    expect(handLabel(hand('Ah 9h 7h 5h 3h'), { exclaim: true }).lingo).toBeNull();
  });

  it('falls back to plain names where a rank has no nickname', () => {
    expect(label('Kh Ks 9c 9d 2s').lingo).toBe('Cowboys over Nines');
    expect(label('Kh Ks 5c 5d 2s').lingo).toBe('Cowboys over Nickels');
    expect(label('9h 9s 6c 5d 2s')).toEqual({ call: 'Pair of Nines', lingo: null });
    expect(label('9h 9s 9c 6d 6s').lingo).toBe('Nines full of Kicks');
  });

  it('knows the named hands', () => {
    expect(label('As Ad 8c 8d 2s').lingo).toBe('The Dead Man’s Hand');
    expect(label('Jh Js Jc 3d 3s').lingo).toBe('The Waiter');
    expect(label('Ah Ks Qc Jd Ts')).toEqual({ call: 'Straight, Ace high', lingo: 'Broadway' });
    expect(label('5h 4s 3c 2d As')).toEqual({ call: 'Straight, Five high', lingo: 'The Wheel' });
    expect(label('6h 6s 9c 5d 2s').lingo).toBe('Route 66');
    expect(label('6h 6s 6c 5d 2s').lingo).toBe('Trip Kicks');
    expect(label('As Ks Qs Js Ts')).toEqual({ call: 'Royal flush, Spades', lingo: 'The Royal Flush' });
  });

  it('gives flushes and high cards the call only', () => {
    expect(label('Ah 9h 7h 5h 3h')).toEqual({ call: 'Flush, Hearts, Ace high', lingo: null });
    expect(label('Ah 9s 7h 5d 3c')).toEqual({ call: 'High card, Ace', lingo: null });
  });
});
