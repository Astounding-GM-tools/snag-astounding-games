<script lang="ts">
  import { HUMAN_ID, isJoker, player, type GameState } from '../engine';
  import { t } from '../i18n';
  import { dollars, shortName } from './format';

  let { game, opponentId, onmenu }: { game: GameState; opponentId: string; onmenu: () => void } = $props();

  const captain = $derived(player(game, HUMAN_ID));
  const seat = $derived(game.round?.seats[0]);
  const myJokerCount = $derived(seat ? seat.jokers.length + seat.slots.filter(isJoker).length : captain.jokers.length);
  const statusOrder = { active: 0, waiting: 1, eliminated: 2 } as const;
  const league = $derived(
    [...game.players].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.money - a.money),
  );
  /** One coin per $5, capped so a fat purse still fits. */
  const coins = $derived(Math.min(30, Math.ceil(captain.money / 5)));
  const purseLevel = (m: number) => (m < 15 ? 'danger' : m < 25 ? 'warn' : '');
</script>

<aside class="side">
  <div class="month">{t('table.crossing', { month: game.month })}</div>
  <div class="purse {purseLevel(captain.money)}" aria-label={t('table.money')}>
    <div class="stack">
      {#each Array.from({ length: coins }) as _, i (i)}<span class="coin"></span>{/each}
    </div>
    <span class="amount">{dollars(captain.money)}</span>
  </div>
  <div class="label">{t('table.money')}</div>
  <div class="label">🪵 × {myJokerCount}</div>

  <h3>{t('table.league')}</h3>
  <ul class="league">
    {#each league as p (p.id)}
      <li class:out={p.status !== 'active'} class:me={p.id === HUMAN_ID} class:foe={p.id === opponentId}>
        <span>{p.id === opponentId ? '► ' : ''}{p.id === HUMAN_ID ? t('character.captain.you') : shortName(p.id)}</span>
        <span>
          {#if p.status === 'eliminated'}{t('table.out')}
          {:else if p.status === 'waiting'}{t('table.waiting')}
          {:else}{dollars(p.money)} · 🪵{p.jokers.length}{/if}
        </span>
      </li>
    {/each}
  </ul>
  <p class="preset">{t(`preset.${game.config.preset}`)}</p>
  <button class="ghost menu" onclick={onmenu}>{t('table.menu')}</button>
</aside>

<style>
  .purse {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .stack {
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    min-height: 60px;
    justify-content: flex-start;
  }
  .coin {
    width: 44px;
    height: 9px;
    margin-top: -3px;
    border-radius: 50%;
    background: linear-gradient(var(--paper), #9a978f);
    border: 1px solid #111;
  }
  .amount {
    font-family: var(--title-font);
    font-size: 1.6rem;
  }
  .purse.warn .stack {
    animation: shake 0.5s infinite;
  }
  .purse.danger .stack {
    animation: shake 0.18s infinite;
  }
</style>
