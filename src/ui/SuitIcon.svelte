<script lang="ts">
  import type { Suit } from '../engine';

  /**
   * A suit drawn as a shape rather than a font glyph, so all four are the same
   * size on every device (phones swap in other fonts for ♡ and ♢). Black-and-white
   * film: hearts and diamonds are outlines, clubs and spades solid.
   */
  let { suit }: { suit: Suit } = $props();
  const outline = $derived(suit === 'h' || suit === 'd');
</script>

<svg class="suit" viewBox="-6 -6 112 112" aria-hidden="true" fill={outline ? 'none' : 'currentColor'} stroke={outline ? 'currentColor' : 'none'} stroke-width="9" stroke-linejoin="round">
  {#if suit === 'h'}
    <path d="M50 90 C22 68 6 52 6 33 C6 18 17 8 30 8 C40 8 47 14 50 23 C53 14 60 8 70 8 C83 8 94 18 94 33 C94 52 78 68 50 90 Z" />
  {:else if suit === 'd'}
    <path d="M50 4 L86 50 L50 96 L14 50 Z" />
  {:else if suit === 's'}
    <path d="M50 4 C64 26 94 40 94 61 C94 75 84 83 72 83 C63 83 57 79 54 73 C55 83 59 90 67 96 H33 C41 90 45 83 46 73 C43 79 37 83 28 83 C16 83 6 75 6 61 C6 40 36 26 50 4 Z" />
  {:else}
    <circle cx="50" cy="27" r="20" />
    <circle cx="27" cy="60" r="20" />
    <circle cx="73" cy="60" r="20" />
    <circle cx="50" cy="52" r="12" />
    <path d="M46 56 C46 76 40 88 31 96 H69 C60 88 54 76 54 56 Z" />
  {/if}
</svg>

<style>
  .suit {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
</style>
