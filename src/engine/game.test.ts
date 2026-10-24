import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, PRESETS, type RulesConfig } from './config';
import { HUMAN_ID, ROSTER, drawLineUp } from './characters';
import { LOG_SIZE, activeOpponents, migrateGame, newGame, nextMonth, player, submitAction, type GameState } from './game';
import { legalActions } from './round';
import { Rng } from './rng';

function jokerCount(s: GameState) {
  const owned = s.players.reduce((n, p) => n + p.jokers.length, 0);
  return owned + s.pool.length + (s.round && !s.round.result && s.round.communityJoker ? 1 : 0);
}

/** Plays the Captain with random legal moves until the game ends. */
function playOut(seed: number, config: RulesConfig = DEFAULT_CONFIG) {
  let s = newGame(seed, config);
  const rng = new Rng(seed ^ 0xabc);
  while (s.phase === 'duel' || s.phase === 'monthEnd') {
    if (s.phase === 'monthEnd') {
      expect(jokerCount(s)).toBe(config.totalJokers);
      s = nextMonth(s);
    } else {
      s = submitAction(s, rng.pick(legalActions(s.round!, 0)));
    }
  }
  return s;
}

describe('game', () => {
  it('is deterministic for a seed', () => {
    const a = newGame(42);
    const b = newGame(42);
    expect(a).toEqual(b);
  });

  it('does not mutate the previous state', () => {
    const s = newGame(1);
    const snapshot = structuredClone(s);
    submitAction(s, legalActions(s.round!, 0)[0]);
    expect(s).toEqual(snapshot);
  });

  it('never has a community Joker in month 1', () => {
    for (let seed = 0; seed < 50; seed++) expect(newGame(seed).round!.communityJoker).toBeNull();
  });

  for (const [presetName, config] of Object.entries(PRESETS)) {
    it(`plays complete games (${presetName}) and conserves Jokers`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const end = playOut(seed, config);
        expect(['gameOver', 'victory']).toContain(end.phase);
        if (end.phase === 'gameOver') expect(player(end, HUMAN_ID).money).toBeLessThanOrEqual(0);
        else expect(activeOpponents(end).length).toBe(0);
      }
    });
  }

  it('only allows passing when nothing else is possible', () => {
    const s = newGame(5);
    expect(legalActions(s.round!, 0).some((a) => a.type === 'pass')).toBe(false);
  });

  it('migrates saves from before a rule setting existed', () => {
    const old = newGame(3);
    delete (old.config as Partial<RulesConfig>).loserPays;
    old.players[1].money = NaN;
    const fixed = migrateGame(old);
    expect(fixed.config.loserPays).toBe(DEFAULT_CONFIG.loserPays);
    expect(Number.isFinite(fixed.players[1].money)).toBe(true);
  });

  it('keeps a log of the Captain\'s recent showdowns', () => {
    let s = newGame(11);
    const rng = new Rng(2);
    for (let i = 0; i < 40 && (s.phase === 'duel' || s.phase === 'monthEnd'); i++) {
      s = s.phase === 'monthEnd' ? nextMonth(s) : submitAction(s, rng.pick(legalActions(s.round!, 0)));
    }
    expect(s.log.length).toBeGreaterThan(0);
    expect(s.log.length).toBeLessThanOrEqual(LOG_SIZE);
    const last = s.log[0];
    // A fold can end a crossing before the whole board is out.
    expect(last.board.length).toBeGreaterThanOrEqual(3);
    expect(last.hands).toHaveLength(2);
  });

  it('tallies every captain\'s duels won and lost', () => {
    const s = playOut(5);
    const won = s.players.reduce((n, p) => n + (p.won ?? 0), 0);
    const lost = s.players.reduce((n, p) => n + (p.lost ?? 0), 0);
    // Every decided duel has one winner and one loser; ties count for neither.
    expect(won).toBeGreaterThan(0);
    expect(won).toBe(lost);
    // Against the Captain, the rivals' wins are the Captain's losses and vice versa.
    const captain = s.players.find((p) => p.id === HUMAN_ID)!;
    const rivals = s.players.filter((p) => p.id !== HUMAN_ID);
    expect(rivals.reduce((n, p) => n + (p.wonVsYou ?? 0), 0)).toBe(captain.lost ?? 0);
    expect(rivals.reduce((n, p) => n + (p.lostVsYou ?? 0), 0)).toBe(captain.won ?? 0);
  });

  it('Morag comes down to the river once Finlay is busted', () => {
    const def = (id: string) => ROSTER.find((c) => c.id === id)!;
    const lineUp = [
      { def: def('finlay'), joins: 'start' },
      { def: def('nemo'), joins: 'start' },
      { def: def('lenny'), joins: 'start' },
      { def: def('morag'), joins: 'finlay' },
    ];
    let s = newGame(21, DEFAULT_CONFIG, lineUp);
    expect(player(s, 'morag').status).toBe('waiting');
    const finlay = s.players.find((p) => p.id === 'finlay')!;
    finlay.status = 'eliminated';
    finlay.money = 0;
    const rng = new Rng(4);
    while (s.phase === 'duel') s = submitAction(s, rng.pick(legalActions(s.round!, 0)));
    expect(player(s, 'morag').status).toBe('active');
    expect(s.report!.joined).toContain('morag');
  });

  it('draws a mixed line-up: rascals, middling captains, a sharp, and one sharp arriving later', () => {
    for (let seed = 0; seed < 20; seed++) {
      const lineUp = drawLineUp(ROSTER, (n) => new Rng(seed * 7 + n).int(n));
      const starters = lineUp.filter((e) => e.joins === 'start');
      expect(starters.filter((e) => e.def.tier === 'rascal')).toHaveLength(3);
      expect(starters.filter((e) => e.def.tier === 'middle')).toHaveLength(3);
      expect(starters.filter((e) => e.def.tier === 'sharp')).toHaveLength(1);
      expect(lineUp.filter((e) => e.joins === '*')).toHaveLength(1);
      expect(lineUp.some((e) => e.def.id === 'morag')).toBe(lineUp.some((e) => e.def.id === 'finlay'));
      expect(new Set(lineUp.map((e) => e.def.id)).size).toBe(lineUp.length);
    }
  });

  it('with an odd number of captains, a random rival sits the round out and pays snag upkeep', () => {
    const def = (id: string) => ROSTER.find((c) => c.id === id)!;
    const lineUp = ['konrad', 'nemo', 'lenny', 'walrus'].map((id) => ({ def: def(id), joins: 'start' }));
    let s = newGame(31, DEFAULT_CONFIG, lineUp);
    // Five captains (you + 4): odd, so a rival (never you) sits out.
    const sitter = s.sitterId!;
    expect(activeOpponents(s).map((p) => p.id)).toContain(sitter);
    expect(s.opponentId).not.toBe(sitter);
    // Give the sitter two snags from the pool: they pay upkeep for them, and no ante.
    const p = player(s, sitter);
    p.jokers.push(...s.pool.splice(0, 2));
    const before = p.money;
    const rng = new Rng(9);
    while (s.phase === 'duel') s = submitAction(s, rng.pick(legalActions(s.round!, 0)));
    expect(s.report!.sittingOut).toBe(sitter);
    expect(s.report!.offscreen.flatMap((d) => d.players)).not.toContain(sitter);
    expect(player(s, sitter).money).toBe(before - 2 * DEFAULT_CONFIG.drainPerJoker);
    expect(s.report!.money[sitter].drained).toBe(2 * DEFAULT_CONFIG.drainPerJoker);
    // Next round someone else sits out.
    s = nextMonth(s);
    expect(s.sitterId).not.toBe(sitter);
  });

  it('hands retired captains\' seats in old saves to their successors', () => {
    const s = newGame(41);
    const json = JSON.stringify(s)
      .replaceAll('"konrad"', '"pete"')
      .replaceAll('"finlay"', '"jiggs"');
    const old = JSON.parse(json) as GameState;
    for (const p of old.players) if (p.id === 'pete') p.ai = 'pete' as never;
    const fixed = migrateGame(old);
    expect(fixed.players.some((p) => p.id === 'pete' || p.id === 'jiggs')).toBe(false);
    const konrad = fixed.players.find((p) => p.id === 'konrad');
    if (konrad) expect(konrad.ai).toBe('bully');
  });
});
