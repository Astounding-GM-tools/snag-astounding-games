import { describe, expect, it } from 'vitest';
import { HUMAN_ID } from './characters';
import { PRESETS } from './config';
import { newGame, player, submitAction } from './game';
import { anteFor, baseAnte, discardCost, streetFee } from './pot';
import { actionCost, canFold } from './round';

const config = PRESETS.draw;

describe('pot mode', () => {
  it('the ante rises every three crossings, plus upkeep per Joker', () => {
    expect([1, 3, 4, 6, 7, 20].map((m) => baseAnte(config, m))).toEqual([1, 1, 2, 2, 3, 7]);
    expect(anteFor(config, 4, 2)).toBe(2 + 2 * config.drainPerJoker);
  });

  it('street fees are floor(ante / 3) for the Turn and floor(ante / 2) for the River', () => {
    expect(streetFee(config, 1, 1)).toBe(0);
    expect(streetFee(config, 20, 1)).toBe(2);
    expect(streetFee(config, 20, 2)).toBe(3);
  });

  it('the k-th card thrown away in a crossing costs $k', () => {
    expect(discardCost(0, 2)).toBe(3);
    expect(discardCost(2, 1)).toBe(3);
    expect(discardCost(0, 6)).toBe(21);
  });

  it('antes go into the pot at the deal', () => {
    const s = newGame(5, config);
    expect(s.round!.potMode).toBe(true);
    expect(s.round!.bets).toEqual([1, 1]);
  });

  it('folding hands the pot to the other captain', () => {
    let s = newGame(5, config);
    const opp = s.opponentId!;
    const oppBefore = player(s, opp).money;
    s = submitAction(s, { type: 'fold' });
    const res = s.round!.result!;
    expect(res.folded).not.toBeNull();
    // Either we folded alone (they win), or both folded (split): we never gain.
    expect(player(s, HUMAN_ID).money).toBeLessThanOrEqual(config.startMoney);
    if (res.folded === 0 && res.winner === 1) {
      expect(player(s, HUMAN_ID).money).toBe(config.startMoney - 1);
      expect(player(s, opp).money).toBe(oppBefore + 1);
    }
  });

  it('you can still fold on the Turn after swapping, but never on the River', () => {
    let s = newGame(6, config);
    const card = s.round!.seats[0].hand[0].id;
    expect(actionCost(s.round!, 0, { type: 'draw', cardIds: [card] }, config)).toBe(1);
    s = submitAction(s, { type: 'draw', cardIds: [card] });
    if (s.round!.result) return; // the opponent folded
    expect(s.round!.street).toBe(1);
    expect(canFold(s.round!, 0)).toBe(true);
    s = submitAction(s, { type: 'draw', cardIds: [] });
    if (s.round!.result) return;
    expect(s.round!.street).toBe(2);
    expect(canFold(s.round!, 0)).toBe(false);
  });
});
