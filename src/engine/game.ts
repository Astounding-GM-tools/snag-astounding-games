/**
 * The whole game: the Captain, the league of opponents, the Joker pool and the
 * month-by-month flow. Every exported function is pure: it clones the state it
 * receives and returns a new one.
 */
import { chooseAction, viewFor } from './ai';
import { jokerCard, type Card, type JokerCard } from './cards';
import { HUMAN_ID, LEGACY_AI, RETIRED_IDS, ROSTER, drawLineUp, type AiId, type CharacterDef, type LineUpEntry } from './characters';
import { DEFAULT_CONFIG, type RulesConfig } from './config';
import { createRound, resolveStreet, type Action, type RoundResult, type RoundState } from './round';
import { Rng } from './rng';

export interface Player {
  id: string;
  /** null for the human Captain. */
  ai: AiId | null;
  money: number;
  jokers: JokerCard[];
  status: 'waiting' | 'active' | 'eliminated';
  /** For a waiting captain: joins once this captain is busted ('*' = anyone). */
  joinsAfter?: string;
  /** Duels won and lost this tournament (a tie counts as neither). */
  won?: number;
  lost?: number;
  /** A rival's duels won and lost against the Captain, from the rival's side. */
  wonVsYou?: number;
  lostVsYou?: number;
}

export interface DuelSummary {
  players: [string, string];
  result: RoundResult;
}

export interface MonthReport {
  month: number;
  duel: DuelSummary;
  offscreen: DuelSummary[];
  /** Money before → after for every player who took part this month. */
  money: Record<string, { before: number; after: number; drained: number }>;
  eliminated: string[];
  joined: string[];
  /** The captain who sat this crossing out (the poorest, when the count is odd). */
  sittingOut?: string | null;
}

/** One of the Captain's showdowns, kept so a player can check what happened. */
export interface ShowdownRecord {
  month: number;
  opponentId: string;
  board: Card[];
  /** Cards each side played (Captain first), Jokers included. */
  played: [Card[], Card[]];
  /** Each side's final hand. */
  hands: RoundResult['hands'];
  winner: 0 | 1 | null;
  gain: number;
  forfeit: number;
  /** Pot mode: what each side paid in; and who folded, if anyone. */
  paid?: [number, number];
  folded?: 0 | 1 | null;
  dumped: JokerCard[];
  communityTaken: JokerCard[];
}

/** How many recent showdowns the hand log keeps. */
export const LOG_SIZE = 10;

export type Phase = 'duel' | 'monthEnd' | 'gameOver' | 'victory';

export interface GameState {
  config: RulesConfig;
  rngState: number;
  month: number;
  players: Player[];
  /** Unowned Jokers. */
  pool: JokerCard[];
  phase: Phase;
  opponentId: string | null;
  /** This round's sitter: with an odd number of captains, a random rival sits out (and pays snag upkeep). */
  sitterId?: string | null;
  lastOpponentId: string | null;
  round: RoundState | null;
  report: MonthReport | null;
  /** The Captain's most recent showdowns, newest first. */
  log: ShowdownRecord[];
}

const clone = <T>(x: T): T => structuredClone(x);

/**
 * Brings a saved game up to date with the current rules format: rule settings
 * added since it was saved get their defaults, and any Money that is not
 * a number (from such a missing setting) is reset to that player's start.
 */
export function migrateGame(saved: GameState, roster: CharacterDef[] = ROSTER): GameState {
  // Retired captains hand their seats (ids anywhere in the save) to their successors.
  let json = JSON.stringify(saved);
  for (const [old, now] of Object.entries(RETIRED_IDS)) json = json.replaceAll(`"${old}"`, `"${now}"`);
  const state = JSON.parse(json) as GameState;
  state.config = { ...DEFAULT_CONFIG, ...state.config, winGain: { ...DEFAULT_CONFIG.winGain, ...state.config.winGain } };
  state.log ??= [];
  if (state.round) {
    state.round.fished ??= [];
    state.round.potMode ??= false;
    state.round.bets ??= [0, 0];
  }
  if (state.report && !state.report.money) {
    state.report.money = (state.report as MonthReport & { popularity?: MonthReport['money'] }).popularity ?? {};
  }
  for (const p of state.players) {
    // A captain in the current gallery plays by the gallery's playbook; older styles map over.
    const def = roster.find((c) => c.id === p.id);
    if (p.ai && def) p.ai = def.ai;
    else if (p.ai && LEGACY_AI[p.ai]) p.ai = LEGACY_AI[p.ai];
    // Before the river tournament, money was called popularity.
    const legacy = (p as Player & { popularity?: number }).popularity;
    if (p.money === undefined && legacy !== undefined) p.money = legacy;
    if (!Number.isFinite(p.money)) {
      p.money = roster.find((c) => c.id === p.id)?.startMoney ?? state.config.startMoney;
    }
  }
  return state;
}

/**
 * Starts a tournament. The line-up is drawn from the gallery (a mix of rascals,
 * middling captains and sharps) unless one is given, e.g. by tests.
 */
export function newGame(seed: number, config: RulesConfig = DEFAULT_CONFIG, lineUp?: LineUpEntry[]): GameState {
  const drawRng = new Rng((seed ^ 0x5eed) >>> 0);
  const entries = lineUp ?? drawLineUp(ROSTER, (n) => drawRng.int(n));
  const players: Player[] = [
    { id: HUMAN_ID, ai: null, money: config.startMoney, jokers: [], status: 'active' },
    ...entries.map(({ def, joins }): Player => ({
      id: def.id,
      ai: def.ai,
      money: def.startMoney,
      jokers: [],
      status: joins === 'start' ? 'active' : 'waiting',
      ...(joins === 'start' ? {} : { joinsAfter: joins }),
    })),
  ];
  const state: GameState = {
    config: clone(config),
    rngState: seed >>> 0,
    month: 1,
    players,
    pool: Array.from({ length: config.totalJokers }, (_, i) => jokerCard(i)),
    phase: 'duel',
    opponentId: null,
    lastOpponentId: null,
    round: null,
    report: null,
    log: [],
  };
  return startMonthMut(state);
}

export function player(state: GameState, id: string): Player {
  const p = state.players.find((p) => p.id === id);
  if (!p) throw new Error(`No player ${id}`);
  return p;
}

export function activeOpponents(state: GameState): Player[] {
  return state.players.filter((p) => p.id !== HUMAN_ID && p.status === 'active');
}

/**
 * Matchmaking: random active opponent, avoiding a repeat when possible.
 * Kept in one place so weighted/"temperature" matchmaking can replace it.
 */
/**
 * With an odd number of captains on the river (you included), someone has to
 * sit the round out: a rival drawn at random (never you, and not the same one
 * twice running when there's a choice). Sitting out isn't free: the sitter pays
 * their snag upkeep (but no ante, as there's no hand), so nobody can hide.
 */
export function chooseSitter(state: GameState, rng: Rng): Player | null {
  const rivals = activeOpponents(state);
  if ((rivals.length + 1) % 2 === 0 || rivals.length < 2) return null;
  const fresh = rivals.filter((p) => p.id !== state.sitterId);
  return rng.pick(fresh.length ? fresh : rivals);
}

export function pickOpponent(state: GameState, rng: Rng): Player {
  const candidates = activeOpponents(state).filter((p) => p.id !== state.sitterId);
  const fresh = candidates.filter((p) => p.id !== state.lastOpponentId);
  return rng.pick(fresh.length ? fresh : candidates);
}

function startMonthMut(state: GameState): GameState {
  const rng = new Rng(state.rngState);
  state.sitterId = chooseSitter(state, rng)?.id ?? null;
  const opponent = pickOpponent(state, rng);
  state.opponentId = opponent.id;
  const human = player(state, HUMAN_ID);
  state.round = createRound(state.month, [human, opponent], state.pool, state.config, rng);
  state.phase = 'duel';
  state.report = null;
  state.rngState = rng.state;
  return state;
}

/** The Captain's secret action for the current street; the opponent answers. */
export function submitAction(prev: GameState, action: Action): GameState {
  if (prev.phase !== 'duel' || !prev.round) throw new Error('Not in a duel');
  const state = clone(prev);
  const rng = new Rng(state.rngState);
  const round = state.round!;
  const opponent = player(state, state.opponentId!);
  const reply = chooseAction(opponent.ai!, viewFor(round, 1), state.config, rng);
  resolveStreet(round, [action, reply], state.config);
  if (round.result) finishMonth(state, rng);
  state.rngState = rng.state;
  return state;
}

/** Plays a full AI-vs-AI round. Mutates the pool. */
function simulateDuel(state: GameState, a: Player, b: Player, rng: Rng): RoundState {
  const round = createRound(state.month, [a, b], state.pool, state.config, rng);
  while (!round.result) {
    resolveStreet(
      round,
      [chooseAction(a.ai!, viewFor(round, 0), state.config, rng), chooseAction(b.ai!, viewFor(round, 1), state.config, rng)],
      state.config,
    );
  }
  return round;
}

function finishMonth(state: GameState, rng: Rng) {
  const cfg = state.config;
  const before: Record<string, number> = {};

  const settle = (round: RoundState): DuelSummary => {
    const res = round.result!;
    round.seats.forEach((seat, i) => {
      const p = player(state, seat.playerId);
      before[p.id] ??= p.money;
      p.jokers = seat.jokers;
      if (res.winner === i) p.won = (p.won ?? 0) + 1;
      else if (res.winner !== null) p.lost = (p.lost ?? 0) + 1;
      if (p.id !== HUMAN_ID && round.seats[1 - i].playerId === HUMAN_ID) {
        if (res.winner === i) p.wonVsYou = (p.wonVsYou ?? 0) + 1;
        else if (res.winner !== null) p.lostVsYou = (p.lostVsYou ?? 0) + 1;
      }
      const forfeit = res.forfeit ?? 0;
      if (round.potMode) {
        // Pot mode: pay in what you bet; the winner takes the pot (a tie splits it).
        p.money -= round.bets[i];
        if (res.winner === i) p.money += res.pot + forfeit;
        else if (res.winner === null) p.money += Math.floor(res.pot / 2);
        else p.money -= forfeit;
      } else if (res.winner === i) p.money += res.gain + forfeit;
      else if (res.winner !== null) p.money = Math.max(0, p.money - Math.round(res.gain * (cfg.loserPays ?? 0)) - forfeit);
    });
    state.pool.push(...res.returnedToPool);
    return { players: [round.seats[0].playerId, round.seats[1].playerId], result: res };
  };

  const duel = settle(state.round!);
  const finished = state.round!;
  const record: ShowdownRecord = {
    month: state.month,
    opponentId: state.opponentId!,
    board: finished.community.slice(),
    played: [
      finished.seats[0].slots.filter((c): c is Card => c !== null),
      finished.seats[1].slots.filter((c): c is Card => c !== null),
    ],
    hands: duel.result.hands,
    winner: duel.result.winner,
    gain: duel.result.gain,
    forfeit: duel.result.forfeit,
    paid: finished.potMode ? [finished.bets[0], finished.bets[1]] : undefined,
    folded: duel.result.folded ?? null,
    dumped: duel.result.dumped,
    communityTaken: duel.result.communityTaken,
  };
  state.log = [record, ...(state.log ?? [])].slice(0, LOG_SIZE);

  // Meanwhile, on the river: everyone else not in the Captain's duel pairs up.
  const others = rng.shuffle(activeOpponents(state).filter((p) => p.id !== state.opponentId && p.id !== state.sitterId));
  const offscreen: DuelSummary[] = [];
  for (let i = 0; i + 1 < others.length; i += 2) {
    offscreen.push(settle(simulateDuel(state, others[i], others[i + 1], rng)));
  }

  // Joker drain hits every player still on the river.
  const money: MonthReport['money'] = {};
  const eliminated: string[] = [];
  for (const p of state.players) {
    if (p.status !== 'active') continue;
    before[p.id] ??= p.money;
    // In pot mode Joker upkeep is paid into each ante instead, except by the
    // captain sitting the round out, who has no ante but still pays upkeep.
    const potUpkeep = cfg.playStyle === 'draw' && cfg.pot;
    const drained = !potUpkeep || p.id === state.sitterId ? p.jokers.length * cfg.drainPerJoker : 0;
    if (drained) p.money = Math.max(0, p.money - drained);
    money[p.id] = { before: before[p.id], after: p.money, drained };
    if (p.money <= 0) {
      p.status = 'eliminated';
      eliminated.push(p.id);
      if (p.id !== HUMAN_ID) {
        state.pool.push(...p.jokers);
        p.jokers = [];
      }
    }
  }

  const joined: string[] = [];
  const busted = (id: string) => state.players.some((q) => q.id === id && q.status === 'eliminated');
  for (const p of state.players) {
    if (p.status !== 'waiting') continue;
    const after = p.joinsAfter ?? '*';
    const due = after === '*' ? eliminated.some((id) => id !== HUMAN_ID) : busted(after);
    if (due) {
      p.status = 'active';
      joined.push(p.id);
    }
  }

  state.report = { month: state.month, duel, offscreen, money, eliminated, joined, sittingOut: state.sitterId ?? null };
  state.lastOpponentId = state.opponentId;

  if (player(state, HUMAN_ID).status === 'eliminated') state.phase = 'gameOver';
  else if (activeOpponents(state).length === 0) state.phase = 'victory';
  else state.phase = 'monthEnd';
}

export function nextMonth(prev: GameState): GameState {
  if (prev.phase !== 'monthEnd') throw new Error('Month is not over');
  const state = clone(prev);
  state.month++;
  return startMonthMut(state);
}
