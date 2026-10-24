<script lang="ts">
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { HUMAN_ID, type GameState } from '../engine';
  import { t } from '../i18n';
  import { dollars, shortName } from './format';

  /**
   * The standings after a round, shown on the table in the river's place: one
   * row per captain still afloat (and any who went broke this round, once),
   * sorted by purse. The rows start in the old order and slide to the new one,
   * and the purses count to their new amounts, so you see who won, who lost,
   * who moved up and who moved down. You are always in bold.
   */
  let { game }: { game: GameState } = $props();

  const report = $derived(game.report!);
  const rows = $derived(
    game.players
      .filter((p) => p.status === 'active' || report.eliminated.includes(p.id))
      .map((p) => ({
        id: p.id,
        before: report.money[p.id]?.before ?? p.money,
        after: p.money,
        snags: p.jokers.length,
        out: report.eliminated.includes(p.id),
        satOut: report.sittingOut === p.id,
        joined: report.joined.includes(p.id),
      })),
  );
  const rank = (key: 'before' | 'after') =>
    new Map([...rows].sort((a, b) => b[key] - a[key] || a.id.localeCompare(b.id)).map((r, i) => [r.id, i]));
  const beforeRank = $derived(rank('before'));
  const afterRank = $derived(rank('after'));

  // A beat in the old order, then everyone slides to their new place as the purses count.
  let moved = $state(false);
  const progress = new Tween(0, { duration: 900, easing: cubicOut });
  onMount(() => {
    const id = setTimeout(() => {
      moved = true;
      progress.target = 1;
    }, 500);
    return () => clearTimeout(id);
  });
  const order = $derived([...rows].sort((a, b) => (moved ? afterRank : beforeRank).get(a.id)! - (moved ? afterRank : beforeRank).get(b.id)!));
  const shown = (r: { before: number; after: number }) => Math.round(r.before + (r.after - r.before) * progress.current);
</script>

<ol class="standings" aria-label={t('table.league')}>
  {#each order as r (r.id)}
    {@const climb = beforeRank.get(r.id)! - afterRank.get(r.id)!}
    {@const delta = r.after - r.before}
    <li animate:flip={{ duration: 600 }} class:me={r.id === HUMAN_ID} class:out={r.out} class:sat={r.satOut}>
      <span class="move">{moved && !r.out ? (climb > 0 ? '▲' : climb < 0 ? '▼' : '') : ''}</span>
      <span class="who">{r.id === HUMAN_ID ? t('character.captain.you') : shortName(r.id)}{#if r.joined}<small> {t('table.new')}</small>{/if}</span>
      <span class="purse">{dollars(shown(r))}</span>
      <span class="delta">{r.out ? t('table.out') : r.satOut && !delta ? '—' : delta > 0 ? `+${dollars(delta)}` : delta < 0 ? `−${dollars(-delta)}` : ''}</span>
      <span class="snags">{r.snags && !r.out ? `🪵${r.snags}` : ''}</span>
    </li>
  {/each}
</ol>

<style>
  /* The rows share whatever height the river has, up to 1.4rem each. */
  .standings {
    list-style: none;
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    margin: 0 auto;
    padding: 0;
    max-width: 340px;
    font-size: 0.9rem;
    text-align: left;
  }
  li {
    display: grid;
    grid-template-columns: 1rem 1fr 3.4rem 3.2rem 2.4rem;
    align-items: center;
    gap: 0.4rem;
    flex: 1 1 0;
    min-height: 0;
    max-height: 1.4rem;
    border-bottom: 1px dotted var(--dim);
  }
  .move {
    font-size: 0.65rem;
    color: var(--grey);
    text-align: center;
  }
  .who {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .who small {
    color: var(--grey);
    font-size: 0.7rem;
  }
  .purse,
  .delta {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .delta {
    color: var(--grey);
    font-size: 0.8rem;
  }
  .snags {
    font-size: 0.75rem;
    color: var(--grey);
  }
  .me {
    font-weight: bold;
  }
  .me .delta {
    color: var(--paper);
  }
  .sat {
    color: var(--grey);
  }
  .out .who,
  .out .purse {
    text-decoration: line-through;
    color: var(--dim);
  }
</style>
