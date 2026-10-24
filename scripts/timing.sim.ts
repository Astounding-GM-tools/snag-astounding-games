import { it } from 'vitest';
import { DEFAULT_CONFIG, chooseAction, legalActions, newGame, nextMonth, submitAction, viewFor, Rng, planReveal } from '../src/engine';

it('timing', () => {
  const rng = new Rng(1);
  let s = newGame(7, DEFAULT_CONFIG);
  const times: Record<string, number[]> = {};
  const rec = (k: string, ms: number) => (times[k] ??= []).push(ms);
  for (let m = 0; m < 12 && (s.phase === 'duel' || s.phase === 'monthEnd'); ) {
    if (s.phase === 'monthEnd') { s = nextMonth(s); m++; continue; }
    const step = s.round!.street;
    const opp = s.players.find((p) => p.id === s.opponentId)!.ai!;
    let t0 = performance.now();
    chooseAction(opp, viewFor(s.round!, 1), s.config, rng);
    rec(`${opp}@${step}`, performance.now() - t0);
    t0 = performance.now();
    s = submitAction(s, legalActions(s.round!, 0)[0]);
    rec(`submit@${step}`, performance.now() - t0);
    if (s.round?.result) { t0 = performance.now(); planReveal(s.round, 1, rng); rec('reveal', performance.now() - t0); }
  }
  for (const [k, v] of Object.entries(times)) console.error(k.padEnd(14), 'max', Math.max(...v).toFixed(0), 'avg', (v.reduce((a, b) => a + b) / v.length).toFixed(0));
});
