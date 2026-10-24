# Steamboat Snag Poker — Game Design Document

> Source of truth for the prototype. The original Norwegian sketch is kept in
> [design-original-no.md](design-original-no.md). Items marked **🔧 Variant** are
> settings in the rules config (`src/engine/config.ts`, try them in the balance
> simulation); items marked **❓ Open**
> are undecided.

## Concept

**River Poker.** Whenever steamboat captains cross paths on the river, they sit
down for a hand of poker. You are **The Captain**, in a tournament against a
cast of public-domain cartoon captains. Each **crossing** you duel one of them;
the rest play each other off-screen. Losing costs money, and can saddle you
with **Snags**: liabilities like stinking cargo, tiresome passengers and
thankless duties that cost upkeep every crossing until you dump them on someone
you beat.

**Aesthetic:** 1928 black-and-white cartoon. High contrast, film grain, flicker,
vignette, intertitle cards for all text.

**Language:** English, with all UI text in translation files from day one.

## Win and loss

- Every captain carries a **purse** of dollars (you start with $50; rivals have
  their own starting purses). There is no cap: money comes and goes, what
  matters is not running out.
- **Busted:** your purse hits $0 at the end of a crossing — your boat is sold at
  auction. Game over.
- **King of the River:** be the last captain afloat. There is no month limit.
- Persisted locally: tournaments won and the longest run (in crossings).

## Cards

> **Snags** were called Jokers in early versions; the code still calls them
> `joker` (e.g. `jokerMode`, `jokerForfeit`).


- A standard 52-card deck, freshly shuffled every round.
- **10 snags** exist in the whole game (🔧 count is configurable). Every snag is
  either *unowned* (in the pool) or *owned* by a player.
- Snags are **dead cards**: no rank, no suit, they never count toward a hand.
  They exist only to be gotten rid of.
- Snags you own are always available to play and **do not take up hand space**.
  You can hold 0, 5 or 10 of them. You cannot discard a snag.

## Play styles and presets

All structural rules live in one config (`src/engine/config.ts`) with named
presets, selectable in the balance simulation. The game itself always plays
`DEFAULT_CONFIG` (the in-game rules lab was retired once the rules settled).

### Snag Poker (the game; preset `draw`)

**Naming**
- **Snag Poker** (or just **Snag**): the core game. The liabilities are
  **snags**, after the sunken trees that sank Mississippi steamboats ("hit a
  snag").
- **Steamboat Snag Poker:** this game, with the steamboat theme. Future themes:
  Stockbroker Snag Poker, Cthulhu Mythos Snag Poker, Sherlock's Snag Poker,
  Supervillain Snag Poker.
- **Kansas Draw** (preset `kansasDraw`): the same rules with a plain deck and
  no snags. "Kansas" because it sits between Texas and Omaha (geographically
  too), and a nod to the "Kansas City Shuffle", the con men's swindle and
  Bennie Moten's 1926 tune.

1. **Flop:** 3 community cards are revealed; each player is dealt **3 cards**.
2. **Flop and Turn:** tap any number of hand cards to **swap** them for
   replacements, or keep the hand: **check** when the next card is free,
   **call** when there is a fee. **Fold** shows what it gives up. Snags cannot be
   discarded. Discards lie **face up**: the opponent can read what you threw
   away, and you can read theirs.
3. **Make your hand (on the River):** when the River card comes there is no
   more discarding — tap the cards you want to play — any
   of your hand cards plus any snags you dare, up to 5. The best community
   cards automatically fill the rest. No pre-selection: choosing is your job.
   Tapping nothing plays the board alone (legal, close to folding).
4. **Showdown:** the best hand wins. Every snag the winner *chose to play*
   goes to the loser, along with any community snags. Every snag the
   *loser* risked costs them a **forfeit** (🔧 default $5 each), paid to the
   winner: sneaking snags into a weak hand is no longer free. There is no automatic
   shedding — betting hands on snags is how the game is won or lost.

The shape of a hand decides how many snags it can carry:

| Hand | Cards that matter | Room for snags |
|---|---|---|
| Four of a kind | 4 | 1 |
| Three of a kind | 3 | 2 |
| Two pair | 4 | 1 |
| Straight / flush / full house | 5 | none |

**The deal** (always fast for people who prefer reduced motion): cards are dealt like at a real table — hole cards one at a time
round the table (you, them, you, them…), a beat, then the Flop one, two, three;
Turn and River cards and replacement cards slide in too. A **Fast deal**
checkbox speeds it up (remembered per browser), and a click on the table
finishes the deal at once. Actions are disabled until the deal is done.

**Willie's reckoning** (in the opponent's details) shows what they could be
harbouring: the chance of each hand category, every rank listed, based only
on what you can see.

**The reveal:** your hand is announced first (with its nickname, if any). Then
the opponent's played cards are turned over one at a time — teasers first
("a flush is still possible!"), then snags ("the stakes go up!"), and the
deciding card last — each showing how it combines with the board. No auto-advance: the
player steps through with Next (or Skip to the result).

### The pot (draw style)

There are no fixed payouts: captains play for a **pot** in the middle of the
felt, and the winner takes it (a tie splits it).

- **Ante**, paid at the deal: ceil(crossing ÷ 3) (🔧 `anteEvery`), **plus snag
  upkeep** for every snag you carry, so a captain dragging snags around pays
  a fat ante, and everyone knows they will try to dump some.
- **Seeing the Turn** costs floor(ante ÷ 3); **seeing the River** floor(ante ÷ 2)
  (free early on).
- **Discards get dearer:** the k-th card you throw away in a crossing costs $k
  (six cards = $21).
- **Fold** on the Flop or Turn, even after swapping cards (never on the River:
  face the music and take the snags if you've come this far): the
  other captain takes the pot; you keep your snags (including any fished this
  crossing); community snags go back into the deck.
- **Forfeit:** each snag in a losing hand still costs $5, paid to the winner.
- **Debt is all-in:** fees can push a purse below $0 mid-crossing. End a
  crossing at $0 or less and you are busted.

The pot sits left of the board; coins fly in from each side as captains pay,
and every button shows its price ("Discard 2 · $4").



| Preset | Board (Flop/Turn/River) | Deal per player | Slots | Own cards used |
|---|---|---|---|---|
| **Omaha slots** (preset `kansas`) | 3 / 1 / 1 | 3 / 1 / 1 | 3 | exactly 2 |
| **Texas** | 3 / 1 / 1 | 3 / 1 / 1 | 3 | 0–3 |
| **Middle** | 3 / 1 / 1 | 3 / 1 / 1 | 3 | 1–2 |
| **3 + 3** | 1 / 1 / 1 | 3 / 1 / 1 | 3 | 2–3 |
| **Classic** (v1) | 1 / 1 / 1 | 3 / 1 / 1 | 2 | exactly 2, snag in a 4th slot |

In the slots style you place one card per street into a slot (or discard one).
These were stepping stones on the way to Kansas Shuffle.

## Hand ranking

Standard poker ranks. Your hand is the **best 5 cards** made from your slot cards
and the community cards, using the preset's number of own cards (Kansas:
exactly 2 of your 3 slots + exactly 3 of the 5 board cards). Snags and empty
slots are dead cards — but they still count as "your cards", so:

- **1 snag** in your slots is nearly free if the other two carry the hand
  (but you lose your fallback card).
- **2 snags** force you to use a dead card: a 4-card hand.
- **3 snags**: only 3 board cards — suicide unless the opponent is as stuck.
- Snags on the board narrow everyone's choice of board cards the same way.

Straights and flushes need 5 real cards.

Straight flush > Four of a kind > Full house > Flush > Straight > Three of a kind
> Two pair > Pair > High card.

**Ties:** compare category, then ranks (kickers) as usual. If still equal, compare
suits card-by-card from the highest card down, with **♣ < ♦ < ♥ < ♠**.
Only when both hands contain exactly the same real cards is it a true **draw**:
nobody wins, no snags move, no money is gained.

## The round in the slots style

Two players, three **streets**: Flop, Turn, River. On each street:

1. Community cards are revealed (Kansas: 3, then 1, then 1).
2. Cards are dealt to the players (Kansas: 3, then 1, then 1).
3. Both players choose **one action** at the same time — the opponent never sees
   your move before making theirs. **A card laid is a card played**: there is no
   confirm button and no undo.

### Actions (exactly one per street)

- **Place** a card from hand (including an owned snag) into one of your slots.
  If the slot is occupied, the old card goes back to your hand (a swap).
- **Discard** a non-snag card from hand and draw a replacement. This is also
  how you "pass" — and it costs you a slot you will never fill.
- **Pass** only exists when nothing else is possible.

An empty slot at showdown is a dead card.

### Community snags (🔧 snag mode)

- **Shuffled** (default): after the Flop deal, some unowned snags are shuffled
  into the deck (🔧 one per N months elapsed, capped by the unowned pool). A
  snag drawn by a player joins their hand (now owned!); one drawn to the board
  is a dead community card and goes to the loser. Discarding is a gamble.
- **Slot** (Classic only): a separate fourth community slot; from month 2, with
  some chance, an unowned snag sits there as the loser's prize.

### Showdown and snag transfer

- **Winner** gains money based on their hand category (see table).
- **Loser** gains nothing, and receives:
  - every snag the **winner** placed (dumped on them),
  - every **community** snag,
  - and keeps any snag they placed themselves.
- Worst case for one round: lose a round where the opponent placed a snag *and*
  there is a community snag → +2 snags, none shed.
- A no-snag round is low stakes: losing just costs the pot.

### Loser pays (🔧)

`loserPays` (0–1) sets how much of the winner's gain the loser loses: 0 = losing
costs nothing, 1 = **zero-sum (default)**: the winner's points come out of
the loser's money. Simulated, this shortens a good player's game from
about 29 to about 20 months.

### End of round

1. Apply snag transfers.
2. Every player (on screen and off) loses **money per snag owned**
   (🔧 default $4 each).
3. Anyone at $0 is eliminated. An eliminated opponent's snags return to the pool.

### money for a win (🔧 tunable)

| Hand | Winnings ($) |
|---|---|
| High card | +1 |
| Pair | +3 |
| Two pair | +5 |
| Three of a kind | +7 |
| Straight | +9 |
| Flush | +11 |
| Full house | +13 |
| Four of a kind | +16 |
| Straight flush | +20 |

## The league ("Meanwhile, on the river…")

The game is not just your duels: a small league of opponents plays each other
every crossing off-screen, trading snags and money with the same rules.

- Each round you duel one opponent; the remaining active opponents are paired
  randomly. With an odd number of captains, **a random rival sits the round
  out** (never you, and not the same one twice running when there's a
  choice). The sitter pays **snag upkeep** but no ante (there's no hand), so
  nobody can hide: the endgame doesn't drag while a poor captain waits it out.
- Off-screen duels are **fully simulated** with the same engine and AIs (cheap,
  and keeps the snag economy honest). ❓ Could later be replaced by a
  probability shortcut if needed.
- The results screen shows a newspaper-style "Meanwhile on the river" summary.
- Since eliminated opponents return their snags to the pool, keeping weak
  players like Felix alive is in your interest.
- Some characters **join later** (e.g. Sherlock enters after the first
  elimination) to keep the river busy.

### Matchmaking

- Prototype: random active opponent, avoiding the same opponent twice in a row
  when possible.
- ❓ Later: weighting by similar money; a "temperature"/eagerness per
  character (desperate or game-loving characters seek duels); the Captain may
  decline a challenge. The engine keeps matchmaking behind one function so this
  can be swapped in.

## Opponents (public domain only)

Ten captains, each with a boat and a playing style — see
[roster.md](roster.md) for the table, sources, starting purses and who joins
when (a second sharp after the first bust; Morag once Finlay is busted).

## Screens

1. **Title** — riverboat, "START" button, best result, short "How it works"
   card: *Steer public opinion. Avoid ruin. Dump your mess on someone else.*
2. **The Table** (draw style), one column so it fits a phone, split by the
   board into **their side** (top) and **yours** (bottom):
   - top: the opponent's name (tap it or the portrait for their **details**,
     shown in the river's place, no modal: their description and, mid-round,
     **Willie's reckoning**; the white button reads Back and the black one
     waits until you're back) beside a big portrait, with
     their nickname in quotes under it, or their title ("Captain of the
     Stonewall") if they have none, portrait on the right; their purse spreads
     behind the head from the left (facing the pot), a rich one growing in
     behind the name; then
     their face-down hand and snags (a fan that never grows past its width,
     with a count badge from three snags), and their discards;
   - middle: crossing number, street, the **?** button (Willie: how to play,
     fast-deal setting), the **pot** and the board; snags at stake are named
     only when there are any;
   - bottom, in fixed rows that never shift, from the pot outwards: your
     **purse** (coins only, no figure: you never count your money at the
     table), your hand and snags (close
     to your chest), and Fold and the action button side by side (the
     decisions you hold closest). On the River, while you compose, the hand you
     are making is called in a fixed-size card laid over your idle coins: the
     dealer's call, category first ("Two pair, Queens and Jacks"), the
     table talk when there is some ("Ladies over Hooks", "Trip Hooks",
     "Broadway"; flavour that teaches the slang), and any snags riding along ("Two snags riding $10"; the
     names are on the cards just below). The
     exclamation mark is saved for the winning hand on the result screen. The wording lives in `handLabel` (handNames.ts), shared with the
     result screens.
   **Purses** (yours, and the opponent's tucked behind their name, which has an
   outline to stay readable) are one coin a dollar: under $10 a few loose coins
   and circling moths (the only low-funds warning); under $50 a small uneven
   pile; from $50 neat stacks of ten filling a row from the right, the odd
   dollars in a short stack on its left; every further $100 starts a staggered
   row in front, so the chip leader is obvious at a glance.
   A purse is laid out at the start of each round; during the round coins only
   come off it as money goes into the pot (no switching to a pile or moths
   mid-round), and winnings show when the next round lays it out afresh.
   **Discards** sit at the end of each side's card row as notation chips (7♣)
   in two little stacks of up to three, the Flop's along the edge and the
   Turn's beside it,
   shorter than a card so the block sits on the table beside them; tap it for
   a close-up of them all, by street, crossed through and named.
   Whose discard it was stays visible on purpose: it is the read on what they
   kept. (Later, a sharp mode could hide them, as real draw poker does: only
   the count shows.) Snag fans never grow past their width, with a count badge.
   The table keeps its natural height, anchored to the bottom so its two
   buttons sit exactly where the title screen's do, with even gaps between the
   opponent, the river and you that give way on shorter screens (it fits
   the smallest Safari view, about 375×635, without scrolling). The players
   have no frames; the river between them is separation enough. The opponent's
   name and title sit over their coins, with a tall portrait beside both, and
   their cards are the same size as yours.
   The **pot** is coins too, no figure: the opponent's stacks of ten just above
   its middle line, yours just below, each filling in from the left (a row
   holds about $150 on a phone; a simulation puts one side's stake at a median
   of $21, 99% under $74, max about $93, see `scripts/pots.sim.ts`). Purses
   face the pot from the left and spend from
   the left, the front row first; each coin flies from the spot it stood on in
   the purse to its spot in the pot, so emptied stacks show what has gone in.
   At the verdict the pot's coins fly to the winner.
3. **Showdown** (draw style) — on the table, no modal. Their played cards
   flip in place, one per **Next**; at the verdict the cards they held back are
   shown too, dimmed, so you see how they play (played
   snags flip in their fan); the board marks ▼ the cards their hand uses and ▲
   yours. Their hand so far is called where the street name was (same height,
   nothing moves): the call, the table talk, and "Still open: Three of a kind ·
   27% against you" (the chance the cards still down beat you). Your callout
   over your coins shows the hand you played. At the last card the verdict goes
   on the white button ("You win! ▸"), any tiebreak on their callout, and the
   pot flies to the winner. **Skip** on the black button.
4. **Round end** — on the table too: the river shows the **standings** (the
   pot and board stay underneath, hidden, so its height never changes). One
   row per captain afloat (plus any who went broke this round, struck through,
   once; a newcomer marked "new"), sorted by purse: the rows start in the old
   order and slide to the new one (▲ ▼), the purses count to their new amounts,
   with the round's +/−; you are always in bold. No headline and no "Meanwhile
   on the river": it's all on the table. **Next** deals the next round;
   **Menu** on the black button. Only the end of the tournament gets a big
   intertitle: "INSOLVENT! Your funds are gone, and you are out of the game."
   then "{name} is the KING OF THE RIVER!" (one rival left) or "You can't
   afford the ante for the next round. Better luck next time!"; or, if you are
   the last one afloat, "KING OF THE RIVER!".

**Hand log:** the last 10 of the Captain's showdowns (board, both played hands,
the cards each hand uses, result and snags moved), saved with the voyage.
Not reachable in the game for now (the rules lab that opened it is gone); it
may come back in a Menu.

**Starting:** a brand-new player (no saved game) goes straight to the table.
**How it works** (the ? on the table or the title) is a plain page over the
screen, closed by the white Close button; on the table the black one is Menu.
No options: the deal is the real deal (fast only for reduced motion), cards
show the big value.
**Phones:** the layout is set against the smallest viewport (browser bars
showing) and compact mode is decided once at load, so bars sliding away never
shift it.

**Pausing:** Menu returns to the title screen, which then offers
the same two buttons as the table, in the same places: **New** (black, left,
with a confirmation) and **Next** (white, right: carry on); with no game in
progress only the white **New**. How it works is the **?** in the
corner of the menu card. Button texts stay plain; the flavour lives in the game.
The voyage is saved in the browser after every move, so it survives a reload.

**Hand nicknames** (in the language file, easy to extend): Dead Man's Hand
(aces and eights), Full Boat (full house), the Waiter (full house of threes and
Jacks — a Jack carrying a tray), the Butler (threes and Kings, our own), the Wheel (A–5
straight), Broadway (10–A straight), Royal Flush, and rank nicknames like
Ducks, Sailboats, Snowmen, Cowboys and Ladies.

Play is by drag-and-drop onto a slot or the discard pile, with click-to-select
as a fallback. Dropping is final.

## Accessibility

- **Reduced motion:** all animations and transitions stop; the deal is fast.
- **High contrast:** no film grain, scratches, vignette or flicker; brighter
  secondary text.

## Technical

- **Vite + Svelte 5 + TypeScript.**
- **Engine** (`src/engine`): pure, framework-free TypeScript. State is plain
  serializable data; transitions are `(state, action) → state`; all randomness
  goes through a seeded RNG so games and simulations are reproducible. This keeps
  the door open for a Kotlin/WASM port and for multiplayer (authoritative server
  running the same engine).
- **UI** (`src/ui`): Svelte components, i18n dictionary in `src/i18n`.
- **Saving:** localStorage for now.
- **Tests:** Vitest on the engine.

## Later / far down river

- Multiplayer duels.
- Richer matchmaking (temperature, declining challenges).
- Distinct snag types with different effects.
- Larger, rotating roster.
$$