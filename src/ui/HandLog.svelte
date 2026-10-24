<script lang="ts">
  import type { Card, GameState, ShowdownRecord } from '../engine';
  import { t } from '../i18n';
  import CardView from './CardView.svelte';
  import { cardLabel, jokerList, name } from './format';
  import { describeHand } from './handNames';

  let { game, onclose }: { game: GameState; onclose: () => void } = $props();

  const used = (rec: ShowdownRecord, side: 0 | 1) => new Set(rec.hands[side].cards.map((c) => c.id));

  function outcome(rec: ShowdownRecord): string {
    if (rec.winner === null) return t('log.draw');
    const forfeit = rec.forfeit ?? 0;
    const folded = rec.folded === 0 ? t('log.youFolded') : rec.folded === 1 ? t('log.theyFolded', { name: name(rec.opponentId) }) : '';
    if (rec.paid) {
      // Pot mode: net result is the pot you took (or not) minus what you paid in.
      const net = (rec.winner === 0 ? rec.gain : 0) - rec.paid[0] + (rec.winner === 0 ? forfeit : -forfeit);
      return folded + (net >= 0 ? t('log.won', { n: net }) : t('log.lost', { n: -net }));
    }
    const loss = Math.round(rec.gain * game.config.loserPays) + forfeit;
    return rec.winner === 0 ? t('log.won', { n: rec.gain + forfeit }) : t('log.lost', { n: loss });
  }

  function jokers(rec: ShowdownRecord): string {
    const moved = [...rec.dumped, ...rec.communityTaken];
    if (!moved.length || rec.winner === null) return '';
    const loser = rec.winner === 0 ? name(rec.opponentId) : t('character.captain.you');
    return t('log.jokersTo', { name: loser, jokers: jokerList(moved) });
  }

  const isUsed = (set: Set<string>, c: Card) => set.has(c.id);
</script>

<div class="overlay" role="dialog" aria-label={t('log.title')}>
  <div class="intertitle handlog">
    <h2>{t('log.title')}</h2>
    {#if !game.log?.length}
      <p class="empty">{t('log.empty')}</p>
    {/if}
    {#each game.log ?? [] as rec (rec.month)}
      <article>
        <header>
          <b>{t('log.header', { month: rec.month, name: name(rec.opponentId) })}</b>
          <span class:won={rec.winner === 0}>{outcome(rec)}</span>
        </header>
        <div class="row">
          <span class="who">{t('log.board')}</span>
          <div class="cards">
            {#each rec.board as card (card.id)}
              <CardView small {card} used={isUsed(used(rec, 0), card) || isUsed(used(rec, 1), card)} />
            {/each}
          </div>
        </div>
        {#each [0, 1] as const as side}
          <div class="row">
            <span class="who">{side === 0 ? t('character.captain.you') : name(rec.opponentId)}</span>
            <div class="cards">
              {#each rec.played[side] as card (card.id)}
                <CardView small {card} used={isUsed(used(rec, side), card)} />
              {:else}
                <span class="none">{t('log.boardOnly')}</span>
              {/each}
            </div>
            <span class="hand">{describeHand(rec.hands[side])}<br /><small>{t('log.uses', { cards: rec.hands[side].cards.map(cardLabel).join(' ') || '·' })}</small></span>
          </div>
        {/each}
        {#if jokers(rec)}<p class="jokers">{jokers(rec)}</p>{/if}
      </article>
    {/each}
    <button onclick={onclose}>{t('title.close')}</button>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 40;
  }
  .handlog {
    width: min(760px, 100%);
    max-height: 92vh;
    overflow: auto;
    text-align: left;
    padding: 1.25rem 1.5rem;
  }
  .handlog h2,
  .handlog > button {
    display: block;
    margin: 0 auto 0.75rem;
    text-align: center;
  }
  .handlog > button {
    margin-top: 1rem;
  }
  article {
    border-top: 1px dashed var(--grey);
    padding: 0.6rem 0;
  }
  header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.4rem;
  }
  header span {
    color: var(--grey);
  }
  header .won {
    color: var(--paper);
    font-weight: bold;
  }
  .row {
    display: grid;
    grid-template-columns: 5.5rem 1fr 13rem;
    gap: 0.5rem;
    align-items: center;
    margin: 0.25rem 0;
  }
  .who {
    color: var(--grey);
    font-size: 0.85rem;
  }
  .cards {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }
  .cards :global(.card) {
    --w: 40px;
  }
  .hand {
    font-size: 0.85rem;
  }
  .hand small,
  .none,
  .empty {
    color: var(--grey);
  }
  .jokers {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
  }
  @media (max-width: 600px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
