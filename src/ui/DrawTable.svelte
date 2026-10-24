<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import {
    STREETS,
    CATEGORIES,
    bestHand,
    canFold,
    discardCost,
    isComposing,
    streetFee,
    isJoker,
    rankLabel,
    opponentOdds,
    HUMAN_ID,
    player,
    viewFor,
    Rng,
    planReveal,
    type Action,
    type Card,
    type GameState,
    type OpponentOdds,
  } from '../engine';
  import { t } from '../i18n';
  import CardView from './CardView.svelte';
  import Pot from './Pot.svelte';
  import Standings from './Standings.svelte';
  import Purse from './Purse.svelte';
  import DiscardChips from './DiscardChips.svelte';
  import HowTo from './HowTo.svelte';
  import WillieSays from './WillieSays.svelte';
  import { cardLabel, dollars, jokerList, name, nickname } from './format';
  import { handLabel, tiebreak } from './handNames';

  interface Props {
    game: GameState;
    onaction: (a: Action) => void;
    /** False while the showdown is still being revealed: the pot hasn't been paid out yet. */
    settled?: boolean;
    /** Back to the main menu (the game is saved after every move). */
    onmenu: () => void;
    /** 'reveal': the showdown plays out on the table, one of their cards per Next. */
    stage?: 'play' | 'reveal' | 'result';
    /** The verdict is on the table: the pot can fly to the winner. */
    onverdict?: () => void;
    /** The showdown is over (or skipped). */
    onrevealed?: () => void;
    /** From the standings: deal the next round. */
    onnext?: () => void;
  }
  let { game, onaction, settled = true, onmenu, stage = 'play', onverdict, onrevealed, onnext }: Props = $props();

  /** Tapped card ids: cards to discard on a street, cards to play when composing. */
  let tapped = $state<string[]>([]);
  let showHelp = $state(false);
  // How it works covers the table down to the two buttons, which close it.
  let tableEl = $state<HTMLElement>();
  let actionsEl = $state<HTMLElement>();
  let helpBottom = $state(0);
  function openHelp() {
    if (tableEl && actionsEl) helpBottom = tableEl.getBoundingClientRect().bottom - actionsEl.getBoundingClientRect().top + 6;
    showHelp = true;
  }
  let showCaptain = $state(false);
  // Their details close when the next round is dealt.
  let infoMonth = -1;
  $effect(() => {
    const m = game.month;
    untrack(() => {
      if (m !== infoMonth) {
        infoMonth = m;
        showCaptain = false;
      }
    });
  });
  /** Jokers you just fished out of the deck, for Willie to announce. */
  let fishedNews = $state<string | null>(null);
  let fishedSeen = 0;
  let fishedMonth = -1;
  $effect(() => {
    const r = round;
    untrack(() => {
      const mine = (r.fished ?? []).filter((f) => f.seat === 0);
      if (fishedMonth !== game.month) {
        // A resumed round shouldn't re-announce old catches; a new month starts fresh.
        fishedSeen = fishedMonth === -1 ? mine.length : 0;
        fishedMonth = game.month;
      }
      const fresh = mine.slice(fishedSeen);
      fishedSeen = mine.length;
      if (fresh.length) fishedNews = t('willie.fished', { jokers: jokerList(fresh.map((f) => f.joker)) });
    });
  });

  const round = $derived(game.round!);
  const config = $derived(game.config);
  const me = $derived(round.seats[0]);
  const them = $derived(round.seats[1]);
  const opponentId = $derived(game.opponentId!);
  const opponent = $derived(player(game, opponentId));
  const captain = $derived(player(game, HUMAN_ID));
  const playing = $derived(game.phase === 'duel');
  const composing = $derived(isComposing(round));
  const boardSize = $derived(config.communitySchedule.reduce((a, b) => a + b, 0));

  // Jokers are interchangeable, so the selection only tracks how many are in.
  const tappedCards = $derived(me.hand.filter((c) => tapped.includes(c.id)));
  const tappedJokers = $derived(me.jokers.filter((c) => tapped.includes(c.id)));
  const preview = $derived(
    composing ? bestHand([...tappedCards, ...tappedJokers], round.community, { min: tapped.length, max: tapped.length }) : null,
  );
  // The showdown, on the table: their played cards flip in place, one per Next,
  // with their hand so far called where the street name was.
  const result = $derived(round.result);
  const shownDown = $derived(!!result && result.folded == null);
  const steps = $derived(shownDown ? planReveal(round, 1, new Rng(round.month * 31 + round.discards.length)) : []);
  // How many of their cards are face up, counted per round: a new showdown starts
  // at its first card at once (a reset after the fact would let the last
  // round's count fire this round's verdict, and pay out the pot, too early).
  let revealPos = $state({ month: -1, i: 0 });
  const revealIndex = $derived(revealPos.month === game.month ? revealPos.i : 0);
  const revealing = $derived(stage === 'reveal' && shownDown);
  /** After the round (not the last): the standings on the table. */
  const standing = $derived(stage === 'result' && game.phase === 'monthEnd' && !!game.report);
  const revealStep = $derived(revealing && steps.length ? steps[Math.min(revealIndex, steps.length - 1)] : null);
  const verdictShown = $derived(revealing && (!steps.length || !!revealStep?.last));
  $effect(() => {
    if (verdictShown) untrack(() => onverdict?.());
  });
  const theirPlayed = $derived(shownDown ? them.slots.filter((c): c is Card => c !== null) : []);
  const playedIds = $derived(new Set(theirPlayed.map((c) => c.id)));
  /** Their cards face up: those flipped so far, or all they played once the showdown is over. */
  const faceUp = $derived(
    !shownDown ? new Set<string>() : revealing ? new Set(steps.slice(0, revealIndex + 1).map((s) => s.card.id)) : playedIds,
  );
  const theirHand = $derived(revealStep?.hand ?? (shownDown ? result!.hands[1] : null));
  /** Once the verdict is in, only the winning hand gets its exclamation mark. */
  const decided = $derived(shownDown && (verdictShown || stage === 'result'));
  const theirCall = $derived(theirHand ? handLabel(theirHand, { exclaim: decided && result?.winner === 1 }) : null);
  /** The third line: what could still come, or what decided it. */
  const theirNote = $derived.by(() => {
    if (!revealing || !result) return '';
    if (!verdictShown && revealStep) {
      const pct = `${Math.round(revealStep.threat * 100)}%`;
      if (revealStep.possible.length) return t('show.stillOpen', { hand: t(`call.cat.${revealStep.possible[0]}`), pct });
      return revealStep.threat > 0 ? t('show.against', { pct }) : '';
    }
    if (result.winner === null) return '';
    const tb = tiebreak(result.hands[result.winner], result.hands[1 - result.winner]);
    return tb ? t(`show.tb.${tb.kind}.${result.winner === 0 ? 'you' : 'them'}`, { name: name(opponentId), win: tb.winner, lose: tb.loser }) : '';
  });
  const verdictLabel = $derived(
    result?.winner === 0 ? t('show.youWin') : result?.winner === 1 ? t('show.youLose') : t('show.draw'),
  );
  function revealNext() {
    if (verdictShown) onrevealed?.();
    else revealPos = { month: game.month, i: revealIndex + 1 };
  }
  function revealSkip() {
    onverdict?.();
    onrevealed?.();
  }
  /** Board cards each hand uses: theirs marked above, yours below. */
  const theirBoard = $derived(
    revealStep ? new Set(revealStep.boardUsed) : shownDown && !revealing ? new Set(result!.hands[1].cards.map((c) => c.id)) : new Set<string>(),
  );
  const myCall = $derived(shownDown ? handLabel(result!.hands[0], { exclaim: decided && result?.winner === 0 }) : null);
  /** After Play hand the played cards leave the hand for the slots: show them first, the rest dimmed. */
  const myPlayed = $derived(shownDown ? me.slots.filter((c): c is Card => c !== null && !isJoker(c)) : []);
  const myPlayedSnagIds = $derived(new Set(shownDown ? me.slots.filter((c): c is Card => c !== null && isJoker(c)).map((c) => c.id) : []));
  /**
   * A side's snags in its fan. The hand is already resolved when the showdown
   * starts (the loser keeps the snags it played, and takes the winner's), so
   * until the verdict each fan shows the snags as they were when the hand was
   * played, then the outcome: snags dumped on the loser land in their fan.
   */
  function fan(seat: typeof me): Card[] {
    const played = seat.slots.filter((c): c is Card => c !== null && isJoker(c));
    if (!shownDown || settled) return seat.jokers;
    const moved = new Set([...result!.dumped, ...result!.communityTaken].map((c) => c.id));
    const kept = seat.jokers.filter((j) => !moved.has(j.id) && !played.some((p) => p.id === j.id));
    return [...kept, ...played];
  }
  const mySnags = $derived(fan(me));
  const theirSnags = $derived(fan(them));

  const callout = $derived(preview ? handLabel(preview) : null);
  const usedIdsPlay = $derived(new Set(preview?.cards.map((c) => c.id) ?? []));
  const usedIds = $derived(shownDown ? new Set(result!.hands[0].cards.map((c) => c.id)) : usedIdsPlay);

  const stakes = $derived([...(round.communityJoker ? [round.communityJoker] : []), ...round.community.filter(isJoker)]);
  const streetName = $derived(composing ? 'compose' : round.street <= 2 ? STREETS[round.street] : 'showdown');

  // Willie's reckoning appears on the captain card while a round is being played.
  const odds = $derived.by((): OpponentOdds | null => {
    if (!showCaptain || !playing) return null;
    // Seeded from the visible situation so the numbers stay put while you look.
    const seed = round.community.length * 7919 + round.discards.length * 104729 + round.month;
    return opponentOdds(viewFor(round, 0), config, new Rng(seed), 600);
  });

  // A new street or a new month clears the selection.
  // --- The deal -----------------------------------------------------------
  // Cards appear one at a time like a real deal: hole cards round the table
  // (you, them, you, them…), then the board. Reduced motion speeds it up; a click
  // on the table finishes it at once.
  /** Fast deal for people who prefer reduced motion; everyone else gets the real deal. */
  const fastDeal = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dealt = $state(new Set<string>());
  let pending = $state<string[]>([]);
  let dealtMonth = -1;
  let dealTimer: ReturnType<typeof setTimeout> | undefined;
  const dealing = $derived(pending.length > 0);


  $effect(() => {
    const r = round;
    untrack(() => scheduleDeal(r));
  });
  onDestroy(() => {
    clearTimeout(dealTimer);
    clearResting();
  });
  // Coins resting on a purse are placed on the screen, not the table: if the
  // screen changes size (a phone turned), they go, and the purse shows the rest.
  $effect(() => {
    const onResize = () => clearResting();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  function scheduleDeal(r: typeof round) {
    clearTimeout(dealTimer);
    const base = dealtMonth === game.month ? new Set(dealt) : new Set<string>();
    dealtMonth = game.month;
    const mine = r.seats[0].hand.map((c) => c.id).filter((id) => !base.has(id));
    const theirs = r.seats[1].hand.map((c) => c.id).filter((id) => !base.has(id));
    const order: string[] = [];
    for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
      if (mine[i]) order.push(mine[i]);
      if (theirs[i]) order.push(theirs[i]);
    }
    order.push(...r.community.map((c) => c.id).filter((id) => !base.has(id)));
    dealt = base;
    pending = order;
    if (order.length) dealTimer = setTimeout(dealNext, 250);
  }

  function dealNext() {
    const [id, ...rest] = pending;
    if (!id) return;
    dealt = new Set([...dealt, id]);
    pending = rest;
    if (!rest.length) return;
    // A beat before the board: the hole cards are out, now the Flop.
    const boardNext = round.community.some((c) => c.id === rest[0]) && !round.community.some((c) => c.id === id);
    const delay = fastDeal ? 70 : boardNext ? 600 : 300;
    dealTimer = setTimeout(dealNext, delay);
  }

  function finishDeal() {
    if (!dealing) return;
    clearTimeout(dealTimer);
    dealt = new Set([...dealt, ...pending]);
    pending = [];
  }

  let lastKey = '';
  $effect.pre(() => {
    const key = `${game.month}:${round.street}`;
    if (key !== lastKey) {
      lastKey = key;
      tapped = [];
    }
  });

  function tap(card: Card) {
    if (!playing || dealing) return;
    if (isJoker(card) && !composing) return; // Jokers can't be discarded
    if (tapped.includes(card.id)) tapped = tapped.filter((id) => id !== card.id);
    else if (isJoker(card)) {
      // Any Joker will do: take the next untapped one.
      const next = me.jokers.find((j) => !tapped.includes(j.id));
      if (next && tapped.length < 5) tapped = [...tapped, next.id];
    } else if (!composing || tapped.length < 5) tapped = [...tapped, card.id];
  }

  function go() {
    if (!playing || dealing) return;
    const action: Action = composing
      ? { type: 'compose', cardIds: tappedCards.map((c) => c.id), jokers: tappedJokers.length }
      : { type: 'draw', cardIds: tappedCards.map((c) => c.id) };
    tapped = [];
    onaction(action);
  }

  // Pot mode: purses shrink as you pay in, and every action shows its price.
  const bets = $derived<[number, number]>(round.potMode ? round.bets : [0, 0]);
  /**
   * What each purse shows: during a round, money minus what's in the pot; while
   * the showdown is being revealed, the purse as it was before the payout; then
   * the settled amount (the pot flies to the winner as it changes).
   */
  function shownMoney(seat: number): number {
    const p = seat === 0 ? captain : opponent;
    if (playing) return p.money - bets[seat];
    if (!settled && round.potMode) return (game.report?.money[p.id]?.before ?? p.money) - bets[seat];
    return p.money;
  }
  /** The purse at the start of this round: it sets how the purse is drawn until the next one. */
  function startMoney(seat: number): number {
    const p = seat === 0 ? captain : opponent;
    return playing ? p.money : (game.report?.money[p.id]?.before ?? p.money);
  }
  const potBets = $derived<[number, number]>(round.potMode ? bets : [0, 0]);
  const payout = $derived<'me' | 'them' | 'split' | null>(
    !playing && settled && round.result && round.potMode
      ? round.result.winner === 0 ? 'me' : round.result.winner === 1 ? 'them' : 'split'
      : null,
  );
  // Coins fly: from the purse's active coin (where it stood) to its spot in the
  // pot as a captain pays in, and from the pot to the winner at the verdict.
  let myPurseEl = $state<HTMLElement>();
  let theirPurseEl = $state<HTMLElement>();
  let potEl = $state<HTMLElement>();
  let flownMonth = -1;
  let flown: [number, number] = [0, 0];
  let paidMonth = -1;
  const MAX_FLYERS = 40;
  const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Winnings resting on the winner's stacks until the next round lays the purse out with them. */
  let resting: HTMLElement[] = [];
  function clearResting() {
    for (const c of resting) c.remove();
    resting = [];
  }

  /** One coin from one spot on screen to another; resolves when it lands. `stay` leaves it there. */
  function fly(from: DOMRect, to: DOMRect, delay: number, stay = false): Promise<void> {
    const coin = document.createElement('span');
    coin.className = 'flying-coin';
    Object.assign(coin.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.append(coin);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = to.width / from.width;
    const anim = coin.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${dx / 2}px, ${dy / 2 - 24}px) scale(${(1 + scale) / 2 + 0.15})`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      ],
      { duration: 520, delay, easing: 'ease-in-out', fill: 'backwards' },
    );
    if (stay) {
      resting.push(coin);
      return anim.finished.then(() => {
        Object.assign(coin.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, transform: 'none' });
        anim.cancel();
      });
    }
    return anim.finished.then(() => coin.remove(), () => coin.remove());
  }

  /** A captain paid dollars a..b into the pot: each coin leaves its purse spot and lands on its pot spot. */
  function payIn(seat: 0 | 1, a: number, b: number) {
    const purse = seat === 0 ? myPurseEl : theirPurseEl;
    if (!purse || !potEl || still()) return;
    const offset = Math.max(0, startMoney(seat) - 400); // purses show at most $400
    for (let k = a; k < Math.min(b, a + MAX_FLYERS); k++) {
      const src = purse.querySelector(`[data-d="${k - offset}"]`);
      const dst = potEl.querySelector<HTMLElement>(`[data-seat="${seat}"][data-k="${k}"]`);
      if (!src || !dst) continue;
      dst.classList.add('landing');
      fly(src.getBoundingClientRect(), dst.getBoundingClientRect(), (k - a) * 45).then(() => dst.classList.remove('landing'));
    }
  }

  /** The tops of a purse's stacks, left to right: where winnings come to rest. */
  function stackTops(purse: HTMLElement): DOMRect[] {
    const tops = new Map<number, DOMRect>();
    for (const c of purse.querySelectorAll<HTMLElement>('[data-d]:not(.spent)')) {
      const r = c.getBoundingClientRect();
      const key = Math.round(r.left);
      if (!tops.has(key) || r.top < tops.get(key)!.top) tops.set(key, r);
    }
    return [...tops.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r);
  }

  /**
   * The verdict: each coin in the pot flies to the winner (on a tie, each side's
   * go home). A captain's own coins return to the very spots they left, which
   * stay empty until they land, so the stacks refill; the loser's coins come to
   * rest on top of the winner's stacks, one stack after another.
   */
  function payOut(to: 'me' | 'them' | 'split') {
    if (!potEl || still()) return;
    const coins = [...potEl.querySelectorAll<HTMLElement>('[data-seat]')].slice(-MAX_FLYERS * 2);
    const tops: Record<number, DOMRect[]> = {};
    const piled: Record<number, number> = { 0: 0, 1: 0 };
    coins.forEach((c, i) => {
      const from = Number(c.dataset.seat) as 0 | 1;
      const k = Number(c.dataset.k);
      const seat = to === 'split' ? from : to === 'me' ? 0 : 1;
      const purse = seat === 0 ? myPurseEl : theirPurseEl;
      if (!purse) return;
      const home = from === seat ? purse.querySelector<HTMLElement>(`[data-d="${k - Math.max(0, startMoney(seat) - 400)}"]`) : null;
      if (home) {
        home.classList.add('landing');
        fly(c.getBoundingClientRect(), home.getBoundingClientRect(), i * 14).then(() => home.classList.remove('landing'));
        return;
      }
      tops[seat] ??= stackTops(purse);
      const list = tops[seat];
      if (!list.length) return;
      const n = piled[seat]++;
      const top = list[n % list.length];
      const step = top.height * 0.5; // each coin sits half a coin higher on the pile
      const spot = new DOMRect(top.left, top.top - step * (1 + Math.floor(n / list.length)), top.width, top.height);
      fly(c.getBoundingClientRect(), spot, i * 14, true);
    });
  }

  $effect(() => {
    const b = potBets;
    const month = game.month;
    const pay = payout;
    untrack(() => {
      if (month !== flownMonth) {
        clearResting();
        flownMonth = month;
        flown = [0, 0];
      }
      ([0, 1] as const).forEach((seat) => {
        if (b[seat] > flown[seat]) payIn(seat, flown[seat], b[seat]);
      });
      flown = [b[0], b[1]];
      if (pay && paidMonth !== month) {
        paidMonth = month;
        payOut(pay);
      }
    });
  });

  const cost = $derived(
    round.potMode && !composing && playing
      ? streetFee(config, round.month, round.street + 1) + discardCost(me.discarded.length, tappedCards.length)
      : 0,
  );
  const priced = (label: string) => (cost ? `${label} · ${dollars(cost)}` : label);
  const buttonLabel = $derived(
    composing
      ? t('draw.play')
      : tapped.length
        ? priced(t('draw.discard', { n: tapped.length }))
        : cost
          ? priced(t('draw.call'))
          : t('draw.check'),
  );
  const showFold = $derived(round.potMode && playing && !composing);
  // Folding gives up everything you have put into the pot so far.
  const foldLabel = $derived(bets[0] ? `${t('draw.fold')} · ${dollars(bets[0])}` : t('draw.fold'));

  function fold() {
    if (!playing || dealing || !canFold(round, 0)) return;
    tapped = [];
    onaction({ type: 'fold' });
  }

  const pct = (x: number) => `${Math.round(x * 100)}%`;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="table solo" onclick={finishDeal} bind:this={tableEl}>
  {#if showHelp}<div class="help-layer" style="bottom: {helpBottom}px"><HowTo /></div>{/if}
  <!-- Their side of the table: everything above the board belongs to the opponent. -->
  <section class="opponent">
    <!-- Name and title over their coins; a tall portrait beside both. -->
    <div class="opp-head">
      <div class="opp-left">
        <button class="name-btn" onclick={() => (showCaptain = !showCaptain)}>
          <span class="who">
            <span class="name">{name(opponentId)}</span>
            <span class="title">{nickname(opponentId) ? `“${nickname(opponentId)}”` : t(`character.${opponentId}.boat`)}</span>
          </span>
        </button>
        <div class="opp-purse" bind:this={theirPurseEl}><Purse amount={shownMoney(1)} start={startMoney(1)} showAmount={false} focus={18} label={name(opponentId)} /></div>
      </div>
      <button class="portrait-btn" onclick={() => (showCaptain = !showCaptain)} aria-label={name(opponentId)}>
        <span class="oval portrait">{name(opponentId)[0]}</span>
      </button>
    </div>
    <div class="opp-cards">
      <!-- At the showdown their played cards flip in place, one per Next. -->
      {#each theirPlayed.filter((c) => !isJoker(c)) as card (card.id)}
        {#if faceUp.has(card.id)}<CardView {card} fresh={revealStep?.card.id === card.id} />{:else}<CardView faceDown />{/if}
      {/each}
      <!-- Held back, but at the verdict shown too (dimmed): you get to see how they play. -->
      {#each them.hand.filter((c) => dealt.has(c.id)) as card (card.id)}
        {#if decided}<CardView {card} faded fresh={stage === 'reveal'} />{:else}<CardView faceDown deal="top" faded={shownDown} />{/if}
      {/each}
      {#if theirSnags.length}
        <!-- However many snags they carry, the fan never grows past its width. Played snags flip like their cards. -->
        <div class="snag-fan" style="--n: {theirSnags.length}">
          {#each theirSnags as card (card.id)}
            {#if !playedIds.has(card.id) || faceUp.has(card.id)}<CardView {card} fresh={revealStep?.card.id === card.id} />{:else}<CardView faceDown />{/if}
          {/each}
          {#if theirSnags.length > 2}<span class="snag-count">×{theirSnags.length}</span>{/if}
        </div>
      {/if}
      <DiscardChips cards={them.discarded} flop={them.flopDiscards} title={t('draw.theirDiscards', { name: name(opponentId) })} />
    </div>
  </section>

  <!-- The river: the border between them and you. -->
  <section class="river">
    {#if revealing && theirCall}
      <!-- The showdown: their hand so far, called where the street name was. -->
      <div class="callout theirs" aria-live="polite">
        <span class="call" class:long={theirCall.call.length > 30}>{theirCall.call}</span>
        <span class="lingo">{theirCall.lingo ?? ''}</span>
        <span class="note">{theirNote}</span>
      </div>
    {:else}
      <div class="river-head">
      <span class="crossing">{t('table.crossing', { month: game.month })}</span>
      <span class="street">
        {standing ? t('street.standings') : t(`street.${streetName}`)}
        <!-- Every street has a second line (blank at the showdown), so nothing moves. -->
        <span class="street-sub">{standing || streetName === 'showdown' ? '' : t(`street.sub.${streetName}`)}</span>
      </span>
      <button class="ghost icon" onclick={openHelp} aria-label={t('title.howTo')}>?</button>
    </div>
    {/if}
    <!-- After the round the standings take the pot's and the board's place (those stay, hidden, so nothing moves). -->
    <div class="river-body" class:cleared={standing}>
      <!-- The pot: their coins above the middle, yours below, filling in from the left. -->
      {#if round.potMode}<div class="pot-band" bind:this={potEl}><Pot bets={potBets} paid={!!payout} /></div>{/if}
      <div class="community">
        {#each Array.from({ length: boardSize }) as _, i}
          {@const card = round.community[i] && dealt.has(round.community[i].id) ? round.community[i] : null}
          <CardView {card} deal="left" markAbove={!!card && theirBoard.has(card.id)} markBelow={!!card && usedIds.has(card.id)} />
        {/each}
      </div>
      {#if standing}<div class="standings-over"><Standings {game} /></div>{/if}
    </div>
    {#if stakes.length}<p class="stakes">{t('table.stakes')}: {stakes.map(cardLabel).join(', ')}</p>{/if}
    {#if showCaptain}
      <!-- Their details take the river's place (tap to go back to the board): who they are and, mid-round, Willie's reckoning. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="river-info" onclick={() => (showCaptain = false)}>
        <p class="blurb">{t(`character.${opponentId}.blurb`)}</p>
        {#if odds}
          <p class="harbour">{t('draw.oddsTitle', { name: name(opponentId) })}</p>
          <!-- Every rank, even the impossible ones (a reminder of what beats what); not the all-but-mythical straight flush. -->
          {#each [...CATEGORIES].filter((c) => c !== 'straightFlush').reverse() as cat}
            {@const p = odds.categories[cat]}
            <div class="bar" class:none={p === 0}>
              <span>{t(`hand.${cat}`)}</span>
              <span class="track"><span class="fill" style="width: {p * 100}%"></span></span>
              <span class="num">{p === 0 ? '–' : p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`}</span>
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </section>

  <!-- Your side of the table, from the pot outwards: your money, your cards, your decisions. Fixed rows, so nothing moves as the round goes on. -->
  <section class="captain">
    <!-- Your money nearest the pot, no figure: never count your money at the table. -->
    <div class="my-purse" bind:this={myPurseEl}>
      <Purse amount={shownMoney(0)} start={startMoney(0)} showAmount={false} focus={18} label={t('character.captain.you')} />
      <!-- On the River your coins are idle, so the hand you're making is called over them, with the count of snags riding along and their forfeit. Fixed size: it never shifts as you tap. -->
      {#if shownDown && myCall}
        <!-- At the showdown your coins show again (the pot may fly to them); your hand is one line above. -->
        <p class="my-hand">{myCall.lingo ?? myCall.call}</p>
      {:else if playing && composing && callout}
        <div class="callout" aria-live="polite">
          <span class="call" class:long={callout.call.length > 30}>{callout.call}</span>
          <span class="lingo">{callout.lingo ?? ''}</span>
          <span class="note">
            {#if tappedJokers.length === 1}{t('draw.ridingOne', { cost: dollars(config.jokerForfeit ?? 0) })}{:else if tappedJokers.length}{t('draw.riding', { n: t(`number.${tappedJokers.length}`), cost: dollars(tappedJokers.length * (config.jokerForfeit ?? 0)) })}{:else if !tapped.length}{t('draw.boardOnly')}{/if}
          </span>
        </div>
      {/if}
    </div>
    <div class="hand-row">
      <!-- At the showdown: the cards you played, then any you kept back, dimmed. -->
      {#each myPlayed as card (card.id)}<CardView {card} used />{/each}
      {#each me.hand.filter((c) => dealt.has(c.id)) as card (card.id)}
        <CardView
          {card}
          selected={composing && tapped.includes(card.id)}
          toss={!composing && tapped.includes(card.id)}
          used={composing && usedIds.has(card.id)}
          faded={shownDown}
          deal="left"
          onclick={playing ? () => tap(card) : undefined}
        />
      {/each}
      {#if mySnags.length}
        <!-- However many snags you carry, the fan never grows past its width. -->
        <div class="snag-fan mine" class:live={composing} style="--n: {mySnags.length}">
          {#each mySnags as card (card.id)}
            <CardView {card} selected={tapped.includes(card.id)} used={shownDown && myPlayedSnagIds.has(card.id)} onclick={playing && composing ? () => tap(card) : undefined} />
          {/each}
          {#if mySnags.length > 2}<span class="snag-count">×{mySnags.length}</span>{/if}
        </div>
      {/if}
      <DiscardChips tall cards={me.discarded} flop={me.flopDiscards} title={t('draw.yourDiscards')} />
    </div>


    <div class="actions" class:idle={!playing && !revealing && !standing && !showCaptain && !showHelp} bind:this={actionsEl}>
      {#if showHelp}
        <!-- How it works is up: Menu (the way out mid-hand) and Close. -->
        <button class="ghost" onclick={() => ((showHelp = false), onmenu())}>{t('end.pause')}</button>
        <button onclick={() => (showHelp = false)}>{t('draw.close')}</button>
      {:else if showCaptain}
        <!-- Their details are up: the white button takes you back, the black one waits. -->
        <button class="ghost" disabled>{standing ? t('end.pause') : revealing ? t('show.skip') : foldLabel}</button>
        <button onclick={() => (showCaptain = false)}>{t('draw.back')}</button>
      {:else if standing}
        <button class="ghost" onclick={onmenu}>{t('end.pause')}</button>
        <button onclick={() => onnext?.()}>{t('end.next')}</button>
      {:else if revealing}
        <button class="ghost" onclick={revealSkip}>{t('show.skip')}</button>
        <button onclick={revealNext}>{verdictShown ? `${verdictLabel} ▸` : t('show.next')}</button>
      {:else}
        <button class="ghost" onclick={fold} disabled={!playing || dealing || !showFold || !canFold(round, 0)}>{foldLabel}</button>
        <button onclick={go} disabled={!playing || dealing}>{buttonLabel}</button>
      {/if}
    </div>

  </section>
</div>


{#if fishedNews}
  <WillieSays onclose={() => (fishedNews = null)}>
    <p>{fishedNews}</p>
  </WillieSays>
{/if}


<style>
  /* The head and the showdown callout that replaces it are the same height: nothing moves. */
  .river-head {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 3.5rem;
    margin-bottom: 0.4rem;
  }
  .crossing {
    font-family: var(--title-font);
    font-size: 0.85rem;
    color: var(--grey);
    text-align: left;
  }
  .river-head .street {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0;
    line-height: 1.1;
  }
  .street-sub {
    min-height: 1.2em;
    font-family: var(--body-font);
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    color: var(--grey);
  }
  .icon {
    justify-self: end;
    padding: 0 0.55em;
    font-size: 1rem;
    border-radius: 50%;
  }
  .opponent {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .opp-head {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
  }
  .opp-left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .opp-left .name-btn {
    align-self: flex-end;
  }
  /* Lifted clear of their cards, into the room under the name. */
  .opp-purse {
    transform: translateY(-12px);
  }
  .portrait-btn {
    flex: none;
    display: flex;
    padding: 0;
    background: none;
    border: none;
    outline: none;
    box-shadow: none;
  }
  /* From the top of the name to the bottom of their coins. */
  .portrait {
    width: 92px;
    height: 100%;
    min-height: 110px;
    font-size: 2.8rem;
  }
  .river {
    position: relative;
  }
  .table.solo {
    position: relative;
  }
  .help-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 30;
  }
  .river-info {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 0.4rem 0.75rem;
    background: rgba(12, 12, 11, 0.97);
    text-align: left;
    overflow: auto;
    cursor: pointer;
    animation: callout-in 0.2s ease-out;
  }
  .river-info .blurb {
    margin: 0 0 0.4rem;
    font-size: 0.85rem;
    line-height: 1.3;
    color: var(--paper);
  }
  .river-info .harbour {
    margin: 0 0 0.2rem;
    font-size: 0.8rem;
    color: var(--grey);
  }
  .bar {
    display: grid;
    grid-template-columns: 7.5rem 1fr 2.4rem;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.75rem;
    line-height: 1.15;
  }
  .bar.none {
    color: var(--grey);
    opacity: 0.7;
  }
  .track {
    height: 7px;
    background: #222;
    border: 1px solid var(--dim);
  }
  .track .fill {
    display: block;
    height: 100%;
    background: var(--paper);
  }
  .num {
    text-align: right;
  }
  .river-body {
    position: relative;
  }
  .river-body.cleared > :not(.standings-over) {
    visibility: hidden;
  }
  .standings-over {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    animation: callout-in 0.3s ease-out;
  }
  .standings-over :global(.standings) {
    width: 100%;
  }
  .standings-over {
    padding: 0.2rem 0;
  }
  .pot-band {
    margin: 0.2rem 0 0.5rem;
  }
  .opp-cards {
    --hgap: 0.75rem;
    display: flex;
    align-items: flex-end;
    gap: var(--hgap);
  }
  .opp-cards .snag-fan {
    margin-left: 0;
  }
  .snag-fan {
    --fan: 120px;
    display: flex;
    margin-left: 0.6rem;
    max-width: var(--fan);
  }
  .snag-fan :global(.card + .card) {
    margin-left: min(3px, calc((var(--fan) - var(--cw) * var(--n)) / (var(--n) - 1)));
  }
  .snag-fan {
    --cw: 76px;
  }
  .snag-fan {
    position: relative;
  }
  /* How many snags, as a badge on the fan: more than two can't be counted by eye. */
  .snag-count {
    position: absolute;
    top: -6px;
    right: -6px;
    z-index: 4;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--ink);
    border: 1px solid var(--grey);
    font-family: var(--title-font);
    font-size: 0.75rem;
    line-height: 1.3;
  }
  .name-btn {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    outline: none;
    border: none;
    color: var(--paper);
    padding: 0;
  }
  .who {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    line-height: 1.15;
  }
  .who {
    align-items: center;
  }
  .title {
    font-size: 0.8rem;
    color: var(--grey);
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  /* An outline keeps the name readable where it overlaps the coins. */
  .name,
  .title {
    text-shadow: 0 0 2px #000, 0 0 4px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
  }
  .name {
    white-space: nowrap;
    font-family: var(--title-font);
    font-size: 1.3rem;
    text-decoration: underline dotted var(--grey);
    text-underline-offset: 4px;
  }
  /*
   * The play screen fills the height (up to a big phone's): the opponent at the
   * top, you at the bottom, the river in between. The gaps take up any slack,
   * so neither end moves when something in the middle changes.
   */
  /*
   * The table keeps to the bottom of the screen, so its two buttons sit exactly
   * where the title screen's do; any spare height goes above the opponent.
   */
  .table.solo {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: clamp(0.6rem, 2.5vh, 1.75rem);
    min-height: 100svh;
    padding-top: 1rem;
    padding-bottom: 0.75rem;
  }
  @media (max-width: 600px) {
    .table.solo {
      padding-bottom: 0.4rem;
    }
  }
  /* Card width and the gap between cards: the buttons below line up with them. */
  .captain {
    --cw: 76px;
    --hgap: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  /* No frames for the players: the river between them is separation enough. */
  .opponent,
  .captain {
    border-color: transparent;
  }
  /* Tall enough for a lifted card, so selecting one doesn't push anything. */
  .hand-row {
    display: flex;
    align-items: flex-end;
    gap: var(--hgap);
    height: 122px;
  }
  .my-purse {
    position: relative;
  }
  .my-hand {
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    margin: 0;
    text-align: center;
    font-style: italic;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 0 3px #000, 0 0 6px #000;
    pointer-events: none;
  }
  .callout {
    position: absolute;
    inset: -4px 0;
    display: grid;
    grid-template-rows: 1fr 1fr auto;
    align-items: center;
    justify-items: center;
    padding: 4px 0.5rem;
    background: rgba(10, 10, 9, 0.88);
    border: 3px double var(--paper);
    text-align: center;
    overflow: hidden;
    animation: callout-in 0.2s ease-out;
  }
  .callout span {
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Their callout takes the street name's place at the head of the river. */
  /* No frame: the river head's own space is frame enough. */
  .callout.theirs {
    border: none;
    background: none;
    position: relative;
    inset: auto;
    height: 3.5rem;
    margin-bottom: 0.4rem;
    padding-top: 2px;
    padding-bottom: 2px;
  }
  .callout.theirs .call {
    font-size: 1rem;
  }
  .callout.theirs .call.long {
    font-size: 0.85rem;
  }
  .callout.theirs .lingo {
    font-size: 0.85rem;
  }
  .call {
    font-family: var(--title-font);
    font-size: 1.1rem;
    line-height: 1.1;
  }
  /* "Straight flush, Diamonds, Queen high" still fits a phone. */
  .call.long {
    font-size: 0.9rem;
  }
  .lingo {
    font-style: italic;
    font-size: 0.95rem;
    line-height: 1.1;
  }
  .note {
    font-size: 0.75rem;
    color: var(--grey);
    min-height: 1em;
    line-height: 1;
  }
  @keyframes callout-in {
    from { opacity: 0; }
  }
  /* Two fixed halves: changing labels and prices never move them. */
  /* Fold as wide as your three cards; the main button under your snags and discards. */
  .actions {
    display: grid;
    grid-template-columns: calc(3 * var(--cw) + 2 * var(--hgap)) 1fr;
    gap: var(--hgap);
  }
  /* The main button's outline goes inside its edge, so both buttons stand the same size. */
  .actions button:not(.ghost) {
    outline-offset: -2px;
  }
  .actions {
    margin-top: 0.5rem;
  }
  .actions button {
    padding-top: 0.6em;
    padding-bottom: 0.6em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .actions.idle {
    visibility: hidden;
  }
  /* Short screens, decided once at load (so hiding a phone's browser bars never changes it): the gaps and paddings give way first. */
  :global(.short) .table.solo {
    gap: 0.4rem;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
  }
  :global(.short) .portrait {
    min-height: 100px;
  }
  :global(.short) .river-head,
  :global(.short) .callout.theirs {
    height: 3.3rem;
  }
  :global(.short) .actions {
    margin-top: 0.3rem;
  }
  :global(.short) .table.solo section {
    padding-top: 0.35rem;
    padding-bottom: 0.35rem;
  }
  :global(.short) .captain {
    gap: 0.2rem;
  }
  :global(.short) .opponent {
    gap: 0.25rem;
  }
  /* Phones: smaller cards (and the gaps the buttons line up with), bigger button type. */
  @media (max-width: 600px) {
    .snag-fan {
      --cw: 54px;
      --fan: 80px;
    }
    /* Their cards may rise into the room under their coins, so the row takes less height. */
    .opp-cards {
      --hgap: 0.5rem;
      height: 54px;
    }
    .captain {
      --cw: 54px;
      --hgap: 0.5rem;
    }
    .hand-row {
      height: 92px;
    }
    .actions button {
      font-size: 1.15rem;
      padding-left: 0.5em;
      padding-right: 0.5em;
    }
    :global(.short) .hand-row {
      height: 84px;
    }
  }
  .snag-fan.mine {
    --cw: 76px;
    --fan: 220px;
    margin-left: 0;
  }
  @media (max-width: 600px) {
    .snag-fan.mine {
      --cw: 54px;
      --fan: 80px;
    }
  }
  .snag-fan.live :global(.card:hover) {
    z-index: 3;
  }
</style>
