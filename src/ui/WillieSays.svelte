<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n';

  /** Willie, the narrator: a silent-film caption card with his face in the corner. */
  let { title, onclose, children }: { title?: string; onclose: () => void; children: Snippet } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="overlay" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="intertitle caption" role="dialog" aria-label={title ?? t('willie.name')} tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <div class="willie">
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <!-- A deckhand's cap over a round face: Willie, no logos. -->
        <circle cx="30" cy="34" r="18" fill="#f2efe6" stroke="#111" stroke-width="3" />
        <path d="M12 26 Q30 8 48 26 Z" fill="#111" />
        <rect x="10" y="24" width="40" height="5" rx="2" fill="#111" />
        <circle cx="24" cy="34" r="2.5" fill="#111" />
        <circle cx="36" cy="34" r="2.5" fill="#111" />
        <path d="M23 42 Q30 48 37 42" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" />
      </svg>
      <span>{t('willie.name')}</span>
    </div>
    {#if title}<h2>{title}</h2>{/if}
    <div class="body">{@render children()}</div>
    <button onclick={onclose}>{t('willie.ok')}</button>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 45;
  }
  .caption {
    position: relative;
    width: min(560px, 100%);
    max-height: 90vh;
    overflow: auto;
    text-align: left;
    padding: 1.5rem 1.5rem 1.25rem;
  }
  .willie {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-family: var(--title-font);
    letter-spacing: 0.1em;
  }
  .willie svg {
    width: 44px;
    height: 44px;
  }
  h2 {
    text-align: center;
  }
  .body {
    line-height: 1.5;
  }
  button {
    display: block;
    margin: 1rem auto 0;
  }
</style>
