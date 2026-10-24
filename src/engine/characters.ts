/**
 * How a captain plays: the hidden playbook. Players only ever see a
 * personality blurb; the mechanics live here and in ai.ts (and are written up
 * in docs/roster.md). Several captains may share a style.
 */
export type AiId =
  | 'bully' // Konrad: grips his biggest cards, never risks a snag
  | 'griefer' // Max & Moritz: not out to win, out to make you lose
  | 'swashbuckler' // Kitty: chases big hands, loves a last-minute triumph
  | 'anarchist' // Ignatz: throw-happy, now and then hurls every snag
  | 'dreamer' // Nemo: half brilliant, half baffling
  | 'loose' // Finlay, Jim-Bob: quick decisions, bold with snags
  | 'stubborn' // Steamboat Bill: stands pat, never changes his mind
  | 'defeatist' // Lenny: folds readily, never chases
  | 'shark' // the Walrus: solid, loves a snag tucked into trips
  | 'careful' // Morag: tight, patient, punishing
  | 'gambler' // Gaylord: calculates everything
  | 'predator' // Eliza: patient, then ruthless with snags
  // Retired styles, kept so older saved games keep playing.
  | 'clueless'
  | 'prankster';

/** Rascals are easy, sharps are dangerous; every tournament draws a mix. */
export type Tier = 'rascal' | 'middle' | 'sharp';

export interface CharacterDef {
  id: string;
  ai: AiId;
  tier: Tier;
  startMoney: number;
  /** Only in a tournament alongside this captain, and joins once they are busted. */
  follows?: string;
}

/**
 * The full gallery. Names, boats and blurbs live in the i18n dictionary
 * under `character.<id>.*`. Each tournament draws its line-up from here.
 */
export const ROSTER: CharacterDef[] = [
  // Rascals
  { id: 'konrad', ai: 'bully', tier: 'rascal', startMoney: 45 },
  { id: 'maxMoritz', ai: 'griefer', tier: 'rascal', startMoney: 40 },
  { id: 'kitty', ai: 'swashbuckler', tier: 'rascal', startMoney: 60 },
  { id: 'ignatz', ai: 'anarchist', tier: 'rascal', startMoney: 45 },
  { id: 'nemo', ai: 'dreamer', tier: 'rascal', startMoney: 50 },
  { id: 'jimBob', ai: 'loose', tier: 'rascal', startMoney: 55 },
  // Middle
  { id: 'steamboatBill', ai: 'stubborn', tier: 'middle', startMoney: 50 },
  { id: 'finlay', ai: 'loose', tier: 'middle', startMoney: 60 },
  { id: 'lenny', ai: 'defeatist', tier: 'middle', startMoney: 55 },
  { id: 'walrus', ai: 'shark', tier: 'middle', startMoney: 55 },
  // Sharps
  { id: 'gaylord', ai: 'gambler', tier: 'sharp', startMoney: 40 },
  { id: 'eliza', ai: 'predator', tier: 'sharp', startMoney: 50 },
  // Followers
  { id: 'morag', ai: 'careful', tier: 'middle', startMoney: 70, follows: 'finlay' },
];

/** How many of each tier start a tournament; one more sharp arrives after the first bust. */
export const LINE_UP: Record<Tier, number> = { rascal: 3, middle: 3, sharp: 1 };

export interface LineUpEntry {
  def: CharacterDef;
  /** 'start', '*' (after the first bust) or the id of the captain they follow. */
  joins: 'start' | string;
}

/**
 * Draws a tournament line-up: a few of each tier at the start, one extra sharp
 * arriving after the first bust, and followers (Morag) only alongside the
 * captain they follow. `pick(n)` must return a random index below n.
 */
export function drawLineUp(roster: CharacterDef[], pick: (n: number) => number): LineUpEntry[] {
  const out: LineUpEntry[] = [];
  const free = roster.filter((c) => !c.follows);
  const take = (tier: Tier, n: number, joins: string) => {
    const pool = free.filter((c) => c.tier === tier && !out.some((e) => e.def.id === c.id));
    for (let i = 0; i < n && pool.length; i++) out.push({ def: pool.splice(pick(pool.length), 1)[0], joins });
  };
  take('rascal', LINE_UP.rascal, 'start');
  take('middle', LINE_UP.middle, 'start');
  take('sharp', LINE_UP.sharp, 'start');
  take('sharp', 1, '*');
  for (const f of roster.filter((c) => c.follows)) {
    if (out.some((e) => e.def.id === f.follows)) out.push({ def: f, joins: f.follows! });
  }
  return out;
}

/**
 * Retired captains (borrowed characters from the prototype) and the new
 * captains who take their seats when an older saved game is loaded.
 */
export const RETIRED_IDS: Record<string, string> = {
  pete: 'konrad',
  willie: 'jimBob',
  felix: 'kitty',
  betty: 'lenny',
  sherlock: 'eliza',
  derCaptain: 'walrus',
  hansFritz: 'maxMoritz',
  jiggs: 'finlay',
  maggie: 'morag',
};

/** Playing styles that older saved games may still name. */
export const LEGACY_AI: Record<string, AiId> = {
  pete: 'bully',
  willie: 'dreamer',
  felix: 'clueless',
  betty: 'careful',
  sherlock: 'gambler',
};

export const HUMAN_ID = 'captain';
