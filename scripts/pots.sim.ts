/** How big do pots get? Plays the Captain as a careful and a gambling AI and records each side's bets. */
import { HUMAN_ID, DEFAULT_CONFIG, chooseAction, newGame, nextMonth, submitAction, viewFor, Rng, type AiId } from '../src/engine';

const GAMES = Number(process.env.SIM_GAMES ?? 40);
const per: number[] = [];
const pots: number[] = [];
const late: number[] = [];
for (const ai of ['careful', 'gambler'] as AiId[]) {
  for (let g = 0; g < GAMES; g++) {
    let s = newGame(5000 + g, DEFAULT_CONFIG);
    const rng = new Rng(g);
    while (s.phase === 'duel' || s.phase === 'monthEnd') {
      if (s.phase === 'monthEnd') {
        s = nextMonth(s);
        continue;
      }
      const before = s.round!;
      s = submitAction(s, chooseAction(ai, viewFor(s.round!, 0), DEFAULT_CONFIG, rng));
      const r = s.round!;
      if (r.result && r !== before && s.phase !== 'duel') {
        per.push(...r.bets);
        pots.push(r.bets[0] + r.bets[1]);
        if (s.month >= 30) late.push(r.bets[0] + r.bets[1]);
      }
    }
    void HUMAN_ID;
  }
}
const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)];
console.log(`rounds=${pots.length}`);
console.log(`one side: median ${q(per, 0.5)}, 90% ${q(per, 0.9)}, 99% ${q(per, 0.99)}, max ${Math.max(...per)}`);
console.log(`pot:      median ${q(pots, 0.5)}, 90% ${q(pots, 0.9)}, 99% ${q(pots, 0.99)}, max ${Math.max(...pots)}`);
if (late.length) console.log(`pot from crossing 30: median ${q(late, 0.5)}, 90% ${q(late, 0.9)}, max ${Math.max(...late)} (n=${late.length})`);
