<script lang="ts">
  import { t } from '../i18n';

  /**
   * How it works, as a plain page laid over the screen above the two buttons
   * (the screen's own buttons close it). Long text scrolls inside the page.
   */
</script>

<div class="howto" role="dialog" aria-label={t('title.howTo')}>
  <h2>{t('title.howTo')}</h2>
  {#each t('title.howToBody').split('\n\n') as para}<p>{para}</p>{/each}
  <p class="tip">{t('cards.zoomTip')}</p>
</div>

<style>
  .howto {
    position: absolute;
    inset: 0;
    z-index: 30;
    overflow: auto;
    padding: 1rem 1.25rem;
    background: rgba(12, 12, 11, 0.97);
    text-align: left;
    animation: howto-in 0.2s ease-out;
  }
  h2 {
    font-family: var(--title-font);
    font-weight: normal;
    text-align: center;
    margin: 0 0 0.75rem;
  }
  p {
    margin: 0 0 0.75rem;
    line-height: 1.45;
    font-size: 0.95rem;
  }
  .tip {
    color: var(--grey);
  }
  @keyframes howto-in {
    from { opacity: 0; }
  }
</style>
