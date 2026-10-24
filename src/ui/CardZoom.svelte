<script lang="ts">
  import { isJoker } from '../engine';
  import { t } from '../i18n';
  import CardView from './CardView.svelte';
  import { cardPrefs } from './cards.svelte';
  import { longCardName, snagTitle } from './format';

  /**
   * The card held up for a closer look (long-press any card), with its name
   * spelled out; or a side's discards laid out, crossed through.
   */
  const card = $derived(cardPrefs.zoomed);
  const discards = $derived(cardPrefs.discards);
  const close = () => {
    cardPrefs.zoomed = null;
    cardPrefs.discards = null;
  };
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

{#if card}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="zoom" onclick={close} role="dialog" aria-modal="true" aria-label={longCardName(card)} tabindex="-1">
    <CardView {card} huge />
    <p class="caption">
      {#if isJoker(card)}{t('card.snag')}: {snagTitle(card.index)}{:else}{longCardName(card)}{/if}
    </p>
    <p class="hint">{t('cards.zoomClose')}</p>
  </div>
{:else if discards}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="zoom" onclick={close} role="dialog" aria-modal="true" aria-label={discards.title} tabindex="-1">
    <p class="caption">{discards.title}</p>
    {#each discards.rows as row}
      <p class="street">{row.label}</p>
      <div class="spread">
        {#each row.cards as c (c.id)}
          <figure>
            <CardView card={c} huge crossed width="min(24vw, 100px)" />
            <figcaption>{longCardName(c).replace(/^the /, '')}</figcaption>
          </figure>
        {/each}
      </div>
    {/each}
    <p class="hint">{t('cards.zoomClose')}</p>
  </div>
{/if}

<style>
  .zoom {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background: rgba(0, 0, 0, 0.85);
    animation: lift 0.18s ease-out;
  }
  .caption {
    margin: 0;
    font-family: var(--title-font);
    font-size: 1.6rem;
    text-align: center;
    padding: 0 1rem;
  }
  .caption::first-letter {
    text-transform: uppercase;
  }
  .street {
    margin: 0 0 -0.6rem;
    font-family: var(--title-font);
    color: var(--grey);
  }
  .spread {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 0.75rem;
    padding: 0 1rem;
  }
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }
  figcaption {
    font-size: 0.8rem;
    color: var(--grey);
    text-align: center;
  }
  figcaption::first-letter {
    text-transform: uppercase;
  }
  .hint {
    margin: 0;
    color: var(--grey);
    font-size: 0.85rem;
  }
  @keyframes lift {
    from { opacity: 0; transform: scale(0.9); }
  }
  @media (prefers-reduced-motion: reduce) {
    .zoom { animation: none; }
  }
</style>
