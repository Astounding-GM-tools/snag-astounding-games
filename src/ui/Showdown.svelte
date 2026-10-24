<script lang="ts">
  import { isJoker, planReveal, Rng, type Card, type GameState } from '../engine';
  import { t } from '../i18n';
  import CardView from './CardView.svelte';
  import { cardLabel, jokerList, jokerName, longCardName, name } from './format';
  import { describeHand, nickname, tiebreak } from './handNames';

  /** onverdict: the result is known on screen, so the pot can fly to the winner. */
  let { game, ondone, onverdict }: { game: GameState; ondone: () => void; onverdict?: () => void } = $props();

  const round = $derived(game.round!);
  const result = $derived(round.result!);
  const foe = $derived(name(round.seats[1].playerId));
  const mine = $derived(round.seats[0].slots.filter((c): c is Card => c !== null));
  const theirs = $derived(round.seats[1].slots.filter((c): c is Card => c !== null));
  const myJokers = $derived(mine.filter(isJoker));
  const steps = $derived(planReveal(round, 1, new Rng(round.month * 31 + round.discards.length)));
  const myUsed = $derived(new Set(result.hands[0].cards.map((c) => c.id)));

  /** -1 = your hand is announced; 0..n-1 = opponent cards; n = the verdict (only if they played nothing). */
  let index = $state(-1);
  const lastIndex = $derived(steps.length ? steps.length - 1 : 0);
  const step = $derived(index >= 0 ? steps[index] : null);
  const revealed = $derived(index < 0 ? [] : steps.slice(0, index + 1).map((s) => s.card));
  const atEnd = $derived(index >= lastIndex && index >= 0);

  /** Board cards the opponent's hand uses so far (marked above), and yours (marked below). */
  const theirBoard = $derived.by(() => {
    if (index < 0) return new Set<string>();
    if (step) return new Set(step.boardUsed);
    return new Set(result.hands[1].cards.map((c) => c.id));
  });
  const verdictShown = $derived((step?.last ?? false) || (index >= 0 && steps.length === 0));
  $effect(() => {
    if (verdictShown) onverdict?.();
  });

  // No auto-advance: the player takes each reveal in at their own pace.
  function next() {
    if (atEnd) ondone();
    else index++;
  }

  function skip() {
    onverdict?.();
    ondone();
  }

  /** Same-named hands: what decided it, from your point of view. */
  const decider = $derived.by(() => {
    if (result.winner === null) return '';
    const tb = tiebreak(result.hands[result.winner], result.hands[1 - result.winner]);
    if (!tb) return '';
    const side = result.winner === 0 ? 'you' : 'them';
    if (tb.loserDead) {
      // The deciding spot held the loser's snags: name every one of them
      // ("…beats your Stinking Hides, your Layabout Nephew AND your In-Laws!").
      const owner = result.winner === 0 ? t('show.theirs', { name: foe }) : t('show.yours');
      const snags = round.seats[1 - result.winner].slots.filter(isJoker).map((j) => `${owner} ${jokerName(j.index).replace(/^the /, '')}`);
      const list = snags.length <= 1 ? (snags[0] ?? `${owner} ${t('show.deadCard')}`) : `${snags.slice(0, -1).join(', ')}${t('show.and')}${snags.at(-1)}`;
      return t(`show.tb.kicker.snag.${side}`, { name: foe, win: tb.winner, snags: list, end: snags.length > 1 ? '!' : '.' });
    }
    return t(`show.tb.${tb.kind}.${side}`, { name: foe, win: tb.winner, lose: tb.loser });
  });
  const verdict = $derived(result.winner === 0 ? t('show.youWin') : result.winner === 1 ? t('show.youLose') : t('show.draw'));
  const pct = (x: number) => `${Math.round(x * 100)}%`;
</script>

<div class="overlay">
  <div class="intertitle showdown">
    <div class="flourish">❦ {t('street.showdown')} ❦</div>

    <!-- Opponent's played cards -->
    <div class="who">{foe}</div>
    <div class="cards">
      {#each theirs as card (card.id)}
        {@const shown = revealed.find((c) => c.id === card.id)}
        <CardView card={shown ?? null} faceDown={!shown} fresh={!!shown && step?.card.id === card.id} />
      {:else}
        <span class="none">{t('show.noCards')}</span>
      {/each}
    </div>

    <!-- The board -->
    <div class="cards board">
      {#each round.community as card (card.id)}
        <CardView small {card} markAbove={theirBoard.has(card.id)} markBelow={myUsed.has(card.id)} faded={!theirBoard.has(card.id) && !myUsed.has(card.id)} />
      {/each}
    </div>

    <!-- Your played cards -->
    <div class="cards">
      {#each mine as card (card.id)}
        <CardView small {card} used={myUsed.has(card.id)} />
      {:else}
        <span class="none">{t('show.noCards')}</span>
      {/each}
    </div>
    <div class="who">{t('character.captain.you')}</div>

    <div class="commentary">
      {#if index < 0}
        <p class="big">
          {mine.length ? t('show.youPlay', { hand: describeHand(result.hands[0]) }) : t('show.youPlayBoard', { hand: describeHand(result.hands[0]) })}
        </p>
        {#if myJokers.length}<p>{t('show.withJokers', { jokers: jokerList(myJokers) })}</p>{/if}
        {#if nickname(result.hands[0])}<p class="nick">{nickname(result.hands[0])}</p>{/if}
        <p class="sub">{t(theirs.length === 1 ? 'show.nowThem.one' : 'show.nowThem', { name: foe, n: theirs.length })}</p>
      {:else if step}
        <p class="big">
          {#if isJoker(step.card)}{t('show.joker', { name: foe, joker: cardLabel(step.card) })}
          {:else}{t('show.shows', { name: foe, card: longCardName(step.card) })}{/if}
        </p>
        {#if step.last}
          <p>{t('show.finalHand', { name: foe, hand: describeHand(step.hand) })}</p>
          {#if nickname(step.hand)}<p class="nick">{nickname(step.hand)}</p>{/if}
          {#if decider}<p class="decider">{decider}</p>{/if}
          <p class="verdict">{verdict}</p>
        {:else}
          <p>{t('show.bestSoFar', { hand: describeHand(step.hand) })}</p>
          {#if step.possible.length}
            <p>{t('show.possible', { hands: step.possible.slice(0, 2).map((c) => t(`hand.${c}`)).join(t('show.or')) })}</p>
          {/if}
          <p class="sub">
            {step.standing === 'ahead' ? t('show.ahead') : step.standing === 'behind' ? t('show.behind', { name: foe }) : t('show.level')}
            · {t('show.threat', { pct: pct(step.threat), n: theirs.length - index - 1 })}
          </p>
        {/if}
      {:else}
        <p class="big">{t('show.theyPlayBoard', { name: foe, hand: describeHand(result.hands[1]) })}</p>
        {#if decider}<p class="decider">{decider}</p>{/if}
        <p class="verdict">{verdict}</p>
      {/if}
    </div>

    <div class="controls">
      <button onclick={next}>{atEnd ? t('show.continue') : t('show.next')}</button>
      <button class="ghost" onclick={skip}>{t('show.skip')}</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 20;
  }
  /* A lighter veil than other intertitles, so the coin piles stay in view. */
  .overlay :global(.intertitle) {
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
  }
  .showdown {
    width: min(720px, 100%);
    max-height: 96vh;
    overflow: auto;
    padding: 1.25rem 1.5rem;
  }
  .who {
    font-family: var(--title-font);
    letter-spacing: 0.1em;
    color: var(--grey);
    margin: 0.4rem 0;
  }
  .cards {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    min-height: 74px;
    align-items: center;
  }
  .board {
    margin: 0.75rem 0;
    padding: 1.1rem 0;
    border-top: 1px dashed var(--dim);
    border-bottom: 1px dashed var(--dim);
  }
  .none {
    color: var(--grey);
    font-style: italic;
  }
  .commentary {
    min-height: 9rem;
    margin-top: 0.75rem;
  }
  .commentary p {
    margin: 0.3rem 0;
  }
  .big {
    font-family: var(--title-font);
    font-size: 1.35rem;
  }
  .nick {
    font-family: var(--title-font);
    font-size: 1.1rem;
    letter-spacing: 0.08em;
  }
  .sub {
    color: var(--grey);
  }
  .decider {
    font-family: var(--title-font);
    font-size: 1.1rem;
  }
  .verdict {
    font-family: var(--title-font);
    font-size: 2.2rem;
    letter-spacing: 0.08em;
    animation: slam 0.4s ease-out;
  }
  @keyframes slam {
    from { transform: scale(2); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .controls {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    justify-content: center;
    margin-top: 0.75rem;
  }
</style>
